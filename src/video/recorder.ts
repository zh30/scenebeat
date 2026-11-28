/**
 * MediaRecorder adapter for the video renderer.
 *
 * The renderer only sees the `Recorder` interface. The MediaRecorder
 * constructor is injected through `createMediaRecorderFactory`, so tests pass
 * a fake; `createMediaRecorder` looks up the global `MediaRecorder` lazily,
 * at call time, so importing this module is safe in jsdom.
 *
 * The `mimeType` argument is the type chosen by `pickMimeType` in
 * `src/core/mimeType.ts`. Those candidates are video-only, and the canvas
 * stream has no audio track, so recordings are silent.
 */

/** Chunk interval passed to `MediaRecorder.start`. */
export const RECORDER_TIMESLICE_MS = 1000;

/** Target video bit rate. */
export const VIDEO_BITS_PER_SECOND = 8_000_000;

export interface Recorder {
  /** Starts recording, collecting chunks every 1000 ms. May throw. */
  start(): void;
  /** Stops recording; resolves on `onstop` with all collected chunks. */
  stop(): Promise<Blob[]>;
  /** Stops if needed and drops all chunks. Never throws. */
  discard(): void;
  /** Registers a callback for recorder errors. */
  onError(cb: (e: unknown) => void): void;
}

export type RecorderFactory = (stream: MediaStream, mimeType: string) => Recorder;

/** The subset of a MediaRecorder instance the adapter uses. */
export interface MediaRecorderLike {
  readonly state: 'inactive' | 'recording' | 'paused';
  start(timeslice?: number): void;
  stop(): void;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type MediaRecorderCtor = new (
  stream: MediaStream,
  options: { mimeType: string; videoBitsPerSecond: number },
) => MediaRecorderLike;

/** Builds a `RecorderFactory` around the given MediaRecorder constructor. */
export function createMediaRecorderFactory(Ctor: MediaRecorderCtor): RecorderFactory {
  return (stream, mimeType) => {
    const media = new Ctor(stream, { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
    let chunks: Blob[] = [];
    let discarded = false;
    let stopped = false;
    let stopPromise: Promise<Blob[]> | null = null;
    let resolveStop: ((chunks: Blob[]) => void) | null = null;
    const errorCallbacks: Array<(e: unknown) => void> = [];

    const settle = (result: Blob[]): void => {
      stopped = true;
      const resolve = resolveStop;
      resolveStop = null;
      resolve?.(result);
    };

    media.ondataavailable = (event) => {
      if (!discarded && event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    media.onstop = () => {
      settle(discarded ? [] : chunks.slice());
    };
    media.onerror = (event) => {
      if (discarded) return;
      const error =
        event && typeof event === 'object' && 'error' in event
          ? (event as { error: unknown }).error ?? event
          : event;
      for (const cb of errorCallbacks.slice()) cb(error);
    };

    return {
      start() {
        media.start(RECORDER_TIMESLICE_MS);
      },
      stop() {
        if (stopPromise) return stopPromise;
        stopPromise = new Promise<Blob[]>((resolve) => {
          resolveStop = resolve;
        });
        if (stopped || discarded || media.state === 'inactive') {
          settle(discarded ? [] : chunks.slice());
        } else {
          try {
            media.stop();
          } catch {
            settle(chunks.slice());
          }
        }
        return stopPromise;
      },
      discard() {
        discarded = true;
        chunks = [];
        try {
          if (media.state !== 'inactive') media.stop();
        } catch {
          // Discarding must never throw.
        }
        // Never leave a pending stop() hanging.
        settle([]);
      },
      onError(cb) {
        errorCallbacks.push(cb);
      },
    };
  };
}

/**
 * Default factory: wraps the browser's global `MediaRecorder`. Throws when
 * it is missing; callers check `detectVideoSupport` first.
 */
export const createMediaRecorder: RecorderFactory = (stream, mimeType) => {
  const Ctor = (globalThis as { MediaRecorder?: MediaRecorderCtor }).MediaRecorder;
  if (typeof Ctor !== 'function') {
    throw new Error('MediaRecorder is not available in this browser.');
  }
  return createMediaRecorderFactory(Ctor)(stream, mimeType);
};
