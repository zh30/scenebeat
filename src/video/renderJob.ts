/**
 * Render_Job: paints every frame of a storyboard onto a canvas in real time and
 * records it with MediaRecorder.
 *
 * Every browser API arrives through `RenderDeps`, so tests drive the job with a
 * fake canvas, a fake recorder, a manual clock, and a fake visibility source.
 * `createBrowserRenderDeps` builds the real dependencies; it reads globals only
 * when called, so importing this module is safe in jsdom.
 *
 * All exits (completion, abort, hidden tab, recorder error, empty data, thrown
 * errors) go through one `finish()` that runs once: it cancels the pending clock
 * callback, discards the recorder for non-completed outcomes, stops the stream
 * tracks, removes listeners, and resolves. Cancellation resolves synchronously
 * inside the abort or visibility handler (Requirements 15.5, 15.6, 15.8).
 */
import type { AspectRatioId } from '../core/aspectRatio';
import { getAspectRatio } from '../core/aspectRatio';
import { FPS, planFrames, renderProgress, totalDuration, type RenderProgress } from '../core/framePlan';
import { pickMimeType, type VideoContainer } from '../core/mimeType';
import { layoutScene, type FontSpec, type MeasureText, type SceneLayout } from '../core/sceneLayout';
import { fontString } from '../core/sceneTheme';
import { enterTransition } from '../core/transition';
import type { Scene, Storyboard } from '../core/types';
import type { CaptureCanvas, FrameContext } from './canvasTypes';
import { rafClock, type FrameClock } from './frameClock';
import { createBrowserMeasure } from './measure';
import { paintFrame } from './paintFrame';
import { createMediaRecorder, type Recorder, type RecorderFactory } from './recorder';

export interface RenderVisibility {
  isHidden(): boolean;
  /** Subscribes to the document becoming hidden; returns the unsubscribe function. */
  onHidden(cb: () => void): () => void;
}

export interface RenderDeps {
  createCanvas(width: number, height: number): CaptureCanvas;
  createRecorder: RecorderFactory;
  clock: FrameClock;
  /** Resolves when the given fonts are usable (or a timeout passed). */
  fontsReady(fonts: readonly FontSpec[]): Promise<void>;
  isTypeSupported(type: string): boolean;
  visibility: RenderVisibility;
  measure: MeasureText;
}

export interface RenderRequest {
  storyboard: Storyboard;
  ratio: AspectRatioId;
}

export type RenderOutcome =
  | { kind: 'completed'; blob: Blob; container: VideoContainer; mimeType: string }
  | { kind: 'cancelled'; reason: 'user' | 'hidden' }
  | { kind: 'failed'; error: unknown };

export interface RenderOptions {
  signal: AbortSignal;
  onProgress(p: RenderProgress): void;
}

/** Blob type for each container. */
export const CONTAINER_BLOB_TYPE: Readonly<Record<VideoContainer, string>> = Object.freeze({
  mp4: 'video/mp4',
  webm: 'video/webm',
});

/** How long the browser deps wait for fonts before rendering anyway. */
export const FONTS_READY_TIMEOUT_MS = 3000;

/** Deep copy of the scenes, so later edits to the storyboard cannot reach the job (Req 13.3). */
function snapshotScenes(sb: Storyboard): Scene[] {
  return JSON.parse(JSON.stringify(sb.scenes)) as Scene[];
}

/** Distinct fonts used by the layouts. */
function collectFonts(layouts: readonly SceneLayout[]): FontSpec[] {
  const seen = new Map<string, FontSpec>();
  for (const layout of layouts) {
    for (const block of layout.blocks) {
      const key = `${block.font.weight}/${block.font.sizePx}`;
      if (!seen.has(key)) seen.set(key, { sizePx: block.font.sizePx, weight: block.font.weight });
    }
  }
  return [...seen.values()];
}

function stopTracks(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    for (const track of stream.getTracks()) track.stop();
  } catch {
    // Cleanup must never throw.
  }
}

/** Renders the storyboard to a video Blob. Never rejects. */
export function renderVideo(
  req: RenderRequest,
  deps: RenderDeps,
  opts: RenderOptions,
): Promise<RenderOutcome> {
  return new Promise<RenderOutcome>((resolve) => {
    const { signal, onProgress } = opts;
    let done = false;
    let frameId: number | null = null;
    let recorder: Recorder | null = null;
    let stream: MediaStream | null = null;
    const unsubscribers: Array<() => void> = [];

    const finish = (outcome: RenderOutcome): void => {
      if (done) return;
      done = true;
      if (frameId !== null) {
        try {
          deps.clock.cancel(frameId);
        } catch {
          // ignore
        }
        frameId = null;
      }
      if (outcome.kind !== 'completed' && recorder) {
        try {
          recorder.discard();
        } catch {
          // discard is documented never to throw; guard anyway
        }
      }
      stopTracks(stream);
      for (const unsubscribe of unsubscribers.splice(0)) {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      }
      resolve(outcome);
    };

    if (signal.aborted) {
      finish({ kind: 'cancelled', reason: 'user' });
      return;
    }
    const onAbort = (): void => finish({ kind: 'cancelled', reason: 'user' });
    signal.addEventListener('abort', onAbort);
    unsubscribers.push(() => signal.removeEventListener('abort', onAbort));

    try {
      unsubscribers.push(deps.visibility.onHidden(() => finish({ kind: 'cancelled', reason: 'hidden' })));
      if (deps.visibility.isHidden()) {
        finish({ kind: 'cancelled', reason: 'hidden' });
        return;
      }
    } catch (error) {
      finish({ kind: 'failed', error });
      return;
    }

    // Snapshot and pre-compute everything before any async step.
    let scenes: Scene[];
    let layouts: SceneLayout[];
    let pick: { mimeType: string; container: VideoContainer } | null;
    let width: number;
    let height: number;
    try {
      pick = pickMimeType((type) => deps.isTypeSupported(type));
      if (pick === null) throw new Error('No supported video recording format.');
      scenes = snapshotScenes(req.storyboard);
      if (scenes.length === 0) throw new Error('The storyboard has no scenes.');
      ({ width, height } = getAspectRatio(req.ratio));
      layouts = scenes.map((scene) => layoutScene(scene, req.ratio, deps.measure));
    } catch (error) {
      finish({ kind: 'failed', error });
      return;
    }
    const chosen = pick;
    const durations = scenes.map((s) => s.durationMs);
    const totalMs = totalDuration(durations);
    const plan = planFrames(durations, FPS);
    const sceneTotal = scenes.length;
    if (plan.length === 0) {
      finish({ kind: 'failed', error: new Error('The storyboard has no length.') });
      return;
    }

    let ctx: FrameContext;
    let t0 = 0;
    let lastPainted = -1;

    const paint = (k: number): void => {
      const frame = plan[k];
      paintFrame(ctx, {
        scene: scenes[frame.sceneIndex],
        layout: layouts[frame.sceneIndex],
        enter: enterTransition(frame.elapsedMs),
      });
      lastPainted = k;
    };

    const schedule = (): void => {
      frameId = deps.clock.request(tick);
    };

    const complete = (chunks: Blob[]): void => {
      if (done) return;
      const size = chunks.reduce((sum, c) => sum + c.size, 0);
      if (chunks.length === 0 || size === 0) {
        finish({ kind: 'failed', error: new Error('The recording produced no data.') });
        return;
      }
      const blob = new Blob(chunks, { type: CONTAINER_BLOB_TYPE[chosen.container] });
      finish({ kind: 'completed', blob, container: chosen.container, mimeType: chosen.mimeType });
    };

    function tick(now: number): void {
      frameId = null;
      if (done) return;
      try {
        const elapsed = Math.max(0, now - t0);
        // Paint the frame for the current real time; frames that fell behind are skipped.
        const k = Math.min(plan.length - 1, Math.floor((elapsed * FPS) / 1000));
        if (k > lastPainted) paint(k);
        onProgress(renderProgress(elapsed, totalMs, plan[k].sceneIndex, sceneTotal));
        if (elapsed >= totalMs) {
          const rec = recorder as Recorder;
          rec.stop().then(complete, (error: unknown) => finish({ kind: 'failed', error }));
        } else {
          schedule();
        }
      } catch (error) {
        finish({ kind: 'failed', error });
      }
    }

    const begin = (): void => {
      if (done) return;
      try {
        const canvas = deps.createCanvas(width, height);
        ctx = canvas.ctx;
        paint(0);
        stream = canvas.captureStream(FPS);
        const rec = deps.createRecorder(stream, chosen.mimeType);
        recorder = rec;
        rec.onError((error) => finish({ kind: 'failed', error }));
        rec.start();
        if (done) return; // an error callback may have fired during start()
        t0 = deps.clock.now();
        onProgress(renderProgress(0, totalMs, 0, sceneTotal));
        schedule();
      } catch (error) {
        finish({ kind: 'failed', error });
      }
    };

    let fontsPromise: Promise<void>;
    try {
      fontsPromise = deps.fontsReady(collectFonts(layouts));
    } catch {
      fontsPromise = Promise.resolve();
    }
    // A font loading failure is not fatal: render with whatever fonts exist.
    fontsPromise.then(begin, begin);
  });
}

/** Minimal shapes of the browser globals the default deps read. */
interface FontFaceSetLike {
  ready: Promise<unknown>;
  load(font: string): Promise<unknown>;
}
interface MediaRecorderStatic {
  isTypeSupported?: (type: string) => boolean;
}

export interface BrowserRenderDepsOptions {
  doc?: Document;
  /** Share the Player's measurer so preview and video line breaks match. */
  measure?: MeasureText;
  clock?: FrameClock;
  fontsTimeoutMs?: number;
}

/** Real browser dependencies for `renderVideo`. Reads globals only when called. */
export function createBrowserRenderDeps(options: BrowserRenderDepsOptions = {}): RenderDeps {
  const doc = options.doc ?? document;
  const timeoutMs = options.fontsTimeoutMs ?? FONTS_READY_TIMEOUT_MS;
  return {
    createCanvas(width, height) {
      const canvas = doc.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot draw video frames.');
      const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream })
        .captureStream;
      if (typeof capture !== 'function') throw new Error('This browser cannot record a canvas.');
      return {
        ctx: ctx as unknown as FrameContext,
        captureStream: (fps) => capture.call(canvas, fps),
      };
    },
    createRecorder: createMediaRecorder,
    clock: options.clock ?? rafClock,
    fontsReady(fonts) {
      const set = (doc as Document & { fonts?: FontFaceSetLike }).fonts;
      if (!set) return Promise.resolve();
      const loading = Promise.resolve(set.ready)
        .then(() => Promise.all(fonts.map((f) => set.load(fontString(f.sizePx, f.weight)))))
        .then(
          () => undefined,
          () => undefined,
        );
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      });
      return Promise.race([loading, timeout]).finally(() => clearTimeout(timer));
    },
    isTypeSupported(type) {
      const MR = (globalThis as { MediaRecorder?: MediaRecorderStatic }).MediaRecorder;
      try {
        return typeof MR?.isTypeSupported === 'function' && MR.isTypeSupported(type) === true;
      } catch {
        return false;
      }
    },
    visibility: {
      isHidden: () => doc.visibilityState === 'hidden',
      onHidden(cb) {
        const listener = (): void => {
          if (doc.visibilityState === 'hidden') cb();
        };
        doc.addEventListener('visibilitychange', listener);
        return () => doc.removeEventListener('visibilitychange', listener);
      },
    },
    measure: options.measure ?? createBrowserMeasure(doc),
  };
}
