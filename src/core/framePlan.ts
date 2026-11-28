/**
 * Frame plan for video rendering: which scene each frame shows and how far
 * into that scene it is. Pure and deterministic; integer arithmetic decides
 * scene boundaries so there is no float drift (Requirements 13.6 to 13.9).
 */

/** Video frame rate in frames per second. */
export const FPS = 30;

export interface PlannedFrame {
  /** Frame number, 0-based. */
  k: number;
  /** Frame time in ms: k * 1000 / fps. */
  timeMs: number;
  /** Index of the scene whose interval [start, start + d) contains timeMs. */
  sceneIndex: number;
  /** timeMs minus the start time of that scene. */
  elapsedMs: number;
}

/** Sum of all Display_Durations in ms. */
export function totalDuration(durations: readonly number[]): number {
  let sum = 0;
  for (const d of durations) sum += d;
  return sum;
}

/** Number of frames for a total length: ceil(totalMs * fps / 1000). */
export function frameCount(totalMs: number, fps: number = FPS): number {
  if (!(totalMs > 0)) return 0;
  return Math.ceil((totalMs * fps) / 1000);
}

/**
 * Plans every frame. Frame k belongs to the scene i with
 * `starts[i] * fps <= k * 1000 < (starts[i] + d_i) * fps`, found with a
 * pointer that only moves forward. Scenes too short to contain a frame time
 * are skipped by the pointer.
 */
export function planFrames(durations: readonly number[], fps: number = FPS): PlannedFrame[] {
  const total = totalDuration(durations);
  const n = frameCount(total, fps);
  const frames: PlannedFrame[] = [];
  let i = 0;
  let start = 0;
  for (let k = 0; k < n; k++) {
    const t = k * 1000;
    // Advance while frame time is at or past the end of scene i.
    while (i < durations.length - 1 && t >= (start + durations[i]) * fps) {
      start += durations[i];
      i++;
    }
    const timeMs = t / fps;
    frames.push({ k, timeMs, sceneIndex: i, elapsedMs: timeMs - start });
  }
  return frames;
}

/** Total length in seconds with one decimal place, e.g. "42.5". */
export function videoLengthSeconds(totalMs: number): string {
  return (Math.round(totalMs / 100) / 10).toFixed(1);
}

export interface RenderProgress {
  /** floor(100 * rendered / total), within 0 to 100. */
  percent: number;
  /** 1-based number of the scene being rendered. */
  sceneNumber: number;
  sceneTotal: number;
}

/** Progress shown while a Render_Job runs (Requirement 15.1). */
export function renderProgress(
  renderedMs: number,
  totalMs: number,
  sceneIndex: number,
  sceneTotal: number,
): RenderProgress {
  let percent = 0;
  if (totalMs > 0 && renderedMs >= totalMs) {
    // Exact completion; avoids floor(99.999…) from float rounding.
    percent = 100;
  } else if (totalMs > 0) {
    const t = Math.min(Math.max(renderedMs, 0), totalMs);
    percent = Math.min(100, Math.max(0, Math.floor((100 * t) / totalMs)));
  }
  return { percent, sceneNumber: sceneIndex + 1, sceneTotal };
}
