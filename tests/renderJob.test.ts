import { describe, expect, it, vi } from 'vitest';
import { buildStoryboard } from '../src/core/buildStoryboard';
import { getAspectRatio } from '../src/core/aspectRatio';
import { FPS, renderProgress, totalDuration } from '../src/core/framePlan';
import type { RenderProgress } from '../src/core/framePlan';
import type { Storyboard } from '../src/core/types';
import type { FrameContext } from '../src/video/canvasTypes';
import type { FrameClock } from '../src/video/frameClock';
import { fallbackMeasure } from '../src/video/measure';
import type { Recorder } from '../src/video/recorder';
import { renderVideo, type RenderDeps, type RenderOutcome } from '../src/video/renderJob';

const MP4 = 'video/mp4;codecs=avc1.640028';
const FRAME_MS = 1000 / FPS;

/** Two keyword-highlight scenes of 2000 ms each (4000 ms, 120 frames). */
const TRANSCRIPT = 'Alpha bravo charlie.\nDelta echo foxtrot.';

interface PaintedFrame {
  texts: string[];
}

/** A FrameContext that groups fillText calls into frames (paintFrame starts each frame with setTransform). */
function createFakeContext(width: number, height: number, frames: PaintedFrame[]) {
  const noop = (): void => {};
  const gradient = () => ({ addColorStop: noop }) as unknown as CanvasGradient;
  const ctx: FrameContext = {
    canvas: { width, height },
    fillStyle: '#000',
    globalAlpha: 1,
    font: '10px sans-serif',
    textBaseline: 'alphabetic',
    textAlign: 'start',
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    setTransform: (a, b, c, d, e, f) => {
      if (a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0) frames.push({ texts: [] });
    },
    fillRect: noop,
    fillText: (text) => {
      frames[frames.length - 1]?.texts.push(text);
    },
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    arcTo: noop,
    closePath: noop,
    fill: noop,
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    measureText: (text) => ({ width: text.length * 10 }),
  };
  return ctx;
}

function createManualClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, (now: number) => void>();
  const cancelled: number[] = [];
  const clock: FrameClock = {
    now: () => now,
    request: (cb) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel: (id) => {
      cancelled.push(id);
      pending.delete(id);
    },
  };
  /** Moves time to `t` and runs the callbacks pending at that moment. */
  const advanceTo = (t: number): void => {
    now = t;
    const due = [...pending.entries()];
    pending.clear();
    for (const [, cb] of due) cb(now);
  };
  return { clock, advanceTo, pending, cancelled };
}

function createFakeRecorder(chunks: Blob[] = [new Blob(['video-bytes'])]) {
  const log: string[] = [];
  let errorCb: ((e: unknown) => void) | null = null;
  const recorder: Recorder = {
    start: () => {
      log.push('start');
    },
    stop: () => {
      log.push('stop');
      return Promise.resolve(chunks);
    },
    discard: () => {
      log.push('discard');
    },
    onError: (cb) => {
      errorCb = cb;
    },
  };
  return { recorder, log, emitError: (e: unknown) => errorCb?.(e) };
}

function createFakeVisibility() {
  const listeners = new Set<() => void>();
  return {
    listeners,
    visibility: {
      isHidden: () => false,
      onHidden: (cb: () => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    },
    hide: () => {
      for (const cb of [...listeners]) cb();
    },
  };
}

interface Harness {
  deps: RenderDeps;
  frames: PaintedFrame[];
  canvasSizes: Array<[number, number]>;
  captureFps: number[];
  trackStop: ReturnType<typeof vi.fn>;
  stream: MediaStream;
  clock: ReturnType<typeof createManualClock>;
  rec: ReturnType<typeof createFakeRecorder>;
  vis: ReturnType<typeof createFakeVisibility>;
  recorderMimes: string[];
}

function createHarness(overrides: Partial<RenderDeps> = {}, chunks?: Blob[]): Harness {
  const frames: PaintedFrame[] = [];
  const canvasSizes: Array<[number, number]> = [];
  const captureFps: number[] = [];
  const recorderMimes: string[] = [];
  const trackStop = vi.fn();
  const track = { kind: 'video', stop: trackStop };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
  const clock = createManualClock();
  const rec = createFakeRecorder(chunks);
  const vis = createFakeVisibility();
  const deps: RenderDeps = {
    createCanvas: (w, h) => {
      canvasSizes.push([w, h]);
      return {
        ctx: createFakeContext(w, h, frames),
        captureStream: (fps) => {
          captureFps.push(fps);
          return stream;
        },
      };
    },
    createRecorder: (_s, mime) => {
      recorderMimes.push(mime);
      return rec.recorder;
    },
    clock: clock.clock,
    fontsReady: () => Promise.resolve(),
    isTypeSupported: (type) => type === MP4,
    visibility: vis.visibility,
    measure: fallbackMeasure,
    ...overrides,
  };
  return { deps, frames, canvasSizes, captureFps, trackStop, stream, clock, rec, vis, recorderMimes };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function start(sb: Storyboard, h: Harness, controller = new AbortController()) {
  const progress: RenderProgress[] = [];
  let outcome: RenderOutcome | null = null;
  const promise = renderVideo({ storyboard: sb, ratio: '9:16' }, h.deps, {
    signal: controller.signal,
    onProgress: (p) => progress.push(p),
  }).then((o) => {
    outcome = o;
    return o;
  });
  return { promise, progress, controller, outcome: () => outcome };
}

/** Steps the manual clock one frame period at a time until `untilMs`. */
function runClock(h: Harness, fromMs: number, untilMs: number, stepMs = FRAME_MS): void {
  for (let t = fromMs; t <= untilMs + 1e-9 && h.clock.pending.size > 0; t += stepMs) {
    h.clock.advanceTo(t);
  }
}

function sceneOfFrame(f: PaintedFrame): number {
  const joined = f.texts.join('');
  if (joined.includes('Alpha')) return 0;
  if (joined.includes('Delta')) return 1;
  return -1;
}

describe('renderVideo', () => {
  const sb = buildStoryboard(TRANSCRIPT, new Date(0));
  const T = totalDuration(sb.scenes.map((s) => s.durationMs));

  it('records a completed MP4 with the ratio size, 30 fps stream, no audio, and frames in order', async () => {
    expect(T).toBe(4000);
    const h = createHarness();
    const job = start(sb, h);
    await flush();

    const { width, height } = getAspectRatio('9:16');
    expect(h.canvasSizes).toEqual([[width, height]]);
    expect(h.captureFps).toEqual([30]);
    expect(h.stream.getAudioTracks()).toHaveLength(0);
    expect(h.recorderMimes).toEqual([MP4]);
    expect(h.rec.log).toEqual(['start']);
    expect(h.frames).toHaveLength(1); // frame 0 painted before capture

    runClock(h, FRAME_MS, T);
    const outcome = await job.promise;

    expect(outcome.kind).toBe('completed');
    if (outcome.kind !== 'completed') return;
    expect(outcome.container).toBe('mp4');
    expect(outcome.blob.type).toBe('video/mp4');
    expect(outcome.blob.size).toBeGreaterThan(0);
    expect(h.rec.log).toEqual(['start', 'stop']); // no discard on completion

    const scenes = h.frames.map(sceneOfFrame);
    expect(scenes).not.toContain(-1);
    expect(scenes[0]).toBe(0);
    expect(scenes[scenes.length - 1]).toBe(1);
    for (let i = 1; i < scenes.length; i++) expect(scenes[i]).toBeGreaterThanOrEqual(scenes[i - 1]);

    const last = job.progress[job.progress.length - 1];
    expect(last).toEqual({ percent: 100, sceneNumber: 2, sceneTotal: 2 });
    for (let i = 1; i < job.progress.length; i++) {
      expect(job.progress[i].percent).toBeGreaterThanOrEqual(job.progress[i - 1].percent);
    }

    expect(h.trackStop).toHaveBeenCalled();
    expect(h.vis.listeners.size).toBe(0);
    expect(h.clock.pending.size).toBe(0);
  });

  it('uses WebM when no MP4 candidate is supported', async () => {
    const h = createHarness({ isTypeSupported: (t) => t === 'video/webm;codecs=vp9' });
    const job = start(sb, h);
    await flush();
    runClock(h, FRAME_MS, T);
    const outcome = await job.promise;
    expect(outcome.kind).toBe('completed');
    if (outcome.kind !== 'completed') return;
    expect(outcome.container).toBe('webm');
    expect(outcome.blob.type).toBe('video/webm');
  });

  it('paints nothing before fontsReady resolves', async () => {
    let release!: () => void;
    const fonts = new Promise<void>((r) => {
      release = r;
    });
    const h = createHarness({ fontsReady: () => fonts });
    const job = start(sb, h);
    await flush();
    expect(h.canvasSizes).toHaveLength(0);
    expect(h.frames).toHaveLength(0);
    release();
    await flush();
    expect(h.frames).toHaveLength(1);
    job.controller.abort();
    await job.promise;
  });

  it('skips frames that fell behind and reports progress for the current time', async () => {
    const h = createHarness();
    const job = start(sb, h);
    await flush();
    h.clock.advanceTo(1000); // frame 30
    expect(h.frames).toHaveLength(2);
    expect(job.progress[job.progress.length - 1]).toEqual(renderProgress(1000, T, 0, 2));
    h.clock.advanceTo(3000); // frame 90, scene 2
    expect(h.frames).toHaveLength(3);
    expect(sceneOfFrame(h.frames[2])).toBe(1);
    expect(job.progress[job.progress.length - 1]).toEqual(renderProgress(3000, T, 1, 2));
    h.clock.advanceTo(T);
    expect((await job.promise).kind).toBe('completed');
  });

  it('cancels synchronously on abort and cleans up', async () => {
    const h = createHarness();
    const job = start(sb, h);
    await flush();
    h.clock.advanceTo(500);
    expect(h.clock.pending.size).toBe(1);
    job.controller.abort();
    await Promise.resolve();
    await Promise.resolve();
    expect(job.outcome()).toEqual({ kind: 'cancelled', reason: 'user' });
    expect(h.rec.log).toContain('discard');
    expect(h.rec.log).not.toContain('stop');
    expect(h.trackStop).toHaveBeenCalled();
    expect(h.clock.pending.size).toBe(0);
    expect(h.clock.cancelled).toHaveLength(1);
    expect(h.vis.listeners.size).toBe(0);
  });

  it('resolves cancelled immediately when the signal is already aborted', async () => {
    const h = createHarness();
    const controller = new AbortController();
    controller.abort();
    const outcome = await start(sb, h, controller).promise;
    expect(outcome).toEqual({ kind: 'cancelled', reason: 'user' });
    expect(h.canvasSizes).toHaveLength(0);
  });

  it('cancels with reason hidden when the tab becomes hidden', async () => {
    const h = createHarness();
    const job = start(sb, h);
    await flush();
    h.vis.hide();
    const outcome = await job.promise;
    expect(outcome).toEqual({ kind: 'cancelled', reason: 'hidden' });
    expect(h.rec.log).toContain('discard');
    expect(h.trackStop).toHaveBeenCalled();
    expect(h.vis.listeners.size).toBe(0);
    expect(h.clock.pending.size).toBe(0);
  });

  it('cancels with reason hidden when the tab is already hidden', async () => {
    const h = createHarness();
    h.deps.visibility = { ...h.deps.visibility, isHidden: () => true };
    const outcome = await start(sb, h).promise;
    expect(outcome).toEqual({ kind: 'cancelled', reason: 'hidden' });
    expect(h.vis.listeners.size).toBe(0);
  });

  it('fails on a recorder error and discards the recording', async () => {
    const h = createHarness();
    const job = start(sb, h);
    await flush();
    h.clock.advanceTo(500);
    h.rec.emitError(new Error('encoder died'));
    const outcome = await job.promise;
    expect(outcome.kind).toBe('failed');
    expect(h.rec.log).toContain('discard');
    expect(h.trackStop).toHaveBeenCalled();
    expect(h.clock.pending.size).toBe(0);
    expect(h.vis.listeners.size).toBe(0);
  });

  it('fails when recorder.start throws', async () => {
    const h = createHarness();
    h.rec.recorder.start = () => {
      throw new Error('cannot start');
    };
    const outcome = await start(sb, h).promise;
    expect(outcome.kind).toBe('failed');
    expect(h.rec.log).toContain('discard');
    expect(h.trackStop).toHaveBeenCalled();
  });

  it.each([
    ['no chunks', [] as Blob[]],
    ['zero-byte chunks', [new Blob([])]],
  ])('fails when the recording has %s', async (_label, chunks) => {
    const h = createHarness({}, chunks);
    const job = start(sb, h);
    await flush();
    runClock(h, FRAME_MS, T);
    const outcome = await job.promise;
    expect(outcome.kind).toBe('failed');
    expect(h.rec.log).toEqual(['start', 'stop', 'discard']);
    expect(h.trackStop).toHaveBeenCalled();
  });

  it('fails without painting when no MIME type is supported', async () => {
    const h = createHarness({ isTypeSupported: () => false });
    const outcome = await start(sb, h).promise;
    expect(outcome.kind).toBe('failed');
    expect(h.canvasSizes).toHaveLength(0);
    expect(h.vis.listeners.size).toBe(0);
  });

  it('fails for an empty storyboard', async () => {
    const h = createHarness();
    const outcome = await start(buildStoryboard('', new Date(0)), h).promise;
    expect(outcome.kind).toBe('failed');
    expect(h.canvasSizes).toHaveLength(0);
    expect(h.vis.listeners.size).toBe(0);
  });

  it('works on a snapshot: edits after start do not change painted text', async () => {
    const copy: Storyboard = JSON.parse(JSON.stringify(sb));
    const h = createHarness();
    const job = start(copy, h);
    copy.scenes[1].text = 'Zulu yankee xray.';
    copy.scenes[1].data = { keywords: ['Zulu'] };
    await flush();
    runClock(h, FRAME_MS, T);
    expect((await job.promise).kind).toBe('completed');
    const allText = h.frames.flatMap((f) => f.texts).join('');
    expect(allText).toContain('Delta');
    expect(allText).not.toContain('Zulu');
  });
});
