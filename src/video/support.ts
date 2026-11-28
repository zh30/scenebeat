/**
 * Video export feature detection (Requirement 16.1).
 *
 * `detectVideoSupport` is pure: the browser capabilities arrive as a `VideoEnv`
 * value, so tests can describe any browser. `browserVideoEnv` reads the
 * capabilities from a real `Window` without creating anything (no canvas, no
 * recorder, no stream). In jsdom, MediaRecorder and `captureStream` are absent,
 * so detection reports video as unsupported.
 */

import { pickMimeType, type VideoContainer } from '../core/mimeType';

export interface VideoEnv {
  MediaRecorder?: { isTypeSupported?: (type: string) => boolean };
  /** `typeof HTMLCanvasElement.prototype.captureStream === 'function'`. */
  canvasCaptureStream: boolean;
}

export type VideoSupport =
  | { supported: true; mimeType: string; container: VideoContainer }
  | { supported: false };

const UNSUPPORTED: VideoSupport = Object.freeze({ supported: false });

/**
 * Supported only when MediaRecorder exists, canvas `captureStream` exists, and
 * `pickMimeType` accepts a candidate. A missing or throwing `isTypeSupported`
 * counts as no supported type. Never throws.
 */
export function detectVideoSupport(env: VideoEnv): VideoSupport {
  const recorder = env.MediaRecorder;
  if (recorder == null || env.canvasCaptureStream !== true) return UNSUPPORTED;

  const isTypeSupported = recorder.isTypeSupported;
  if (typeof isTypeSupported !== 'function') return UNSUPPORTED;

  const pick = pickMimeType((type) => isTypeSupported.call(recorder, type));
  if (pick === null) return UNSUPPORTED;
  return { supported: true, mimeType: pick.mimeType, container: pick.container };
}

/** Window shape read by `browserVideoEnv`; every member may be missing. */
interface VideoWindow {
  MediaRecorder?: { isTypeSupported?: (type: string) => boolean };
  HTMLCanvasElement?: { prototype?: { captureStream?: unknown } };
}

/** Reads the video capabilities of a browser window. Side-effect-free; never throws. */
export function browserVideoEnv(win: Window): VideoEnv {
  try {
    const w = win as unknown as VideoWindow;
    const recorder = w.MediaRecorder;
    const canvasCaptureStream =
      typeof w.HTMLCanvasElement?.prototype?.captureStream === 'function';
    return recorder == null
      ? { canvasCaptureStream }
      : { MediaRecorder: recorder, canvasCaptureStream };
  } catch {
    return { canvasCaptureStream: false };
  }
}
