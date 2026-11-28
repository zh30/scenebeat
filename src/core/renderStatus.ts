import type { RenderProgress } from './framePlan';
import type { VideoContainer } from './mimeType';

/**
 * Notice shown after a Render_Job ends:
 * - 'webm': the video was recorded as WebM (Requirement 14.6)
 * - 'hidden': the job was cancelled because the tab became hidden (Requirement 15.6)
 * - 'failed': the job failed and produced no file (Requirement 15.7)
 */
export type RenderNotice = 'webm' | 'hidden' | 'failed' | null;

export type RenderStatus =
  | { phase: 'idle'; notice: RenderNotice }
  | { phase: 'rendering'; progress: RenderProgress };

export type RenderStatusAction =
  | { type: 'start'; sceneTotal: number }
  | { type: 'progress'; progress: RenderProgress }
  | { type: 'completed'; container: VideoContainer }
  | { type: 'cancelled'; reason: 'user' | 'hidden' }
  | { type: 'failed' };

export const INITIAL_RENDER_STATUS: RenderStatus = { phase: 'idle', notice: null };

/**
 * Pure render-status state machine (design: "Render status" diagram).
 * `start` begins rendering and clears any previous notice. `progress` and the
 * outcome actions only apply while rendering; in any other state they are ignored
 * and the same state object is returned.
 */
export function renderStatusReducer(
  s: RenderStatus,
  a: RenderStatusAction,
): RenderStatus {
  switch (a.type) {
    case 'start':
      if (s.phase === 'rendering') return s;
      return {
        phase: 'rendering',
        progress: {
          percent: 0,
          sceneNumber: a.sceneTotal > 0 ? 1 : 0,
          sceneTotal: Math.max(0, a.sceneTotal),
        },
      };
    case 'progress':
      if (s.phase !== 'rendering') return s;
      return { phase: 'rendering', progress: a.progress };
    case 'completed':
      if (s.phase !== 'rendering') return s;
      return { phase: 'idle', notice: a.container === 'webm' ? 'webm' : null };
    case 'cancelled':
      if (s.phase !== 'rendering') return s;
      return { phase: 'idle', notice: a.reason === 'hidden' ? 'hidden' : null };
    case 'failed':
      if (s.phase !== 'rendering') return s;
      return { phase: 'idle', notice: 'failed' };
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}
