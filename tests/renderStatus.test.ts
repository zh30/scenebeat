import { describe, expect, it } from 'vitest';
import {
  INITIAL_RENDER_STATUS,
  renderStatusReducer,
  type RenderStatus,
} from '../src/core/renderStatus';

const rendering: RenderStatus = {
  phase: 'rendering',
  progress: { percent: 37, sceneNumber: 4, sceneTotal: 12 },
};

describe('renderStatusReducer', () => {
  it('starts idle with no notice', () => {
    expect(INITIAL_RENDER_STATUS).toEqual({ phase: 'idle', notice: null });
  });

  it('start moves idle to rendering at 0% on scene 1', () => {
    expect(renderStatusReducer(INITIAL_RENDER_STATUS, { type: 'start', sceneTotal: 12 })).toEqual({
      phase: 'rendering',
      progress: { percent: 0, sceneNumber: 1, sceneTotal: 12 },
    });
  });

  it.each(['webm', 'hidden', 'failed'] as const)('start clears a previous %s notice', (notice) => {
    const s = renderStatusReducer({ phase: 'idle', notice }, { type: 'start', sceneTotal: 3 });
    expect(s.phase).toBe('rendering');
    expect(s).not.toHaveProperty('notice');
  });

  it('progress replaces the progress while rendering', () => {
    const progress = { percent: 50, sceneNumber: 6, sceneTotal: 12 };
    expect(renderStatusReducer(rendering, { type: 'progress', progress })).toEqual({
      phase: 'rendering',
      progress,
    });
  });

  it('completed mp4 returns to idle without a notice', () => {
    expect(renderStatusReducer(rendering, { type: 'completed', container: 'mp4' })).toEqual({
      phase: 'idle',
      notice: null,
    });
  });

  it('completed webm returns to idle with the webm notice', () => {
    expect(renderStatusReducer(rendering, { type: 'completed', container: 'webm' })).toEqual({
      phase: 'idle',
      notice: 'webm',
    });
  });

  it('user cancel returns to idle without a notice', () => {
    expect(renderStatusReducer(rendering, { type: 'cancelled', reason: 'user' })).toEqual({
      phase: 'idle',
      notice: null,
    });
  });

  it('hidden-tab cancel returns to idle with the hidden notice', () => {
    expect(renderStatusReducer(rendering, { type: 'cancelled', reason: 'hidden' })).toEqual({
      phase: 'idle',
      notice: 'hidden',
    });
  });

  it('failure returns to idle with the failed notice', () => {
    expect(renderStatusReducer(rendering, { type: 'failed' })).toEqual({
      phase: 'idle',
      notice: 'failed',
    });
  });

  it('ignores progress and outcomes while idle', () => {
    const idle: RenderStatus = { phase: 'idle', notice: 'webm' };
    expect(
      renderStatusReducer(idle, {
        type: 'progress',
        progress: { percent: 10, sceneNumber: 1, sceneTotal: 2 },
      }),
    ).toBe(idle);
    expect(renderStatusReducer(idle, { type: 'completed', container: 'mp4' })).toBe(idle);
    expect(renderStatusReducer(idle, { type: 'cancelled', reason: 'hidden' })).toBe(idle);
    expect(renderStatusReducer(idle, { type: 'failed' })).toBe(idle);
  });

  it('does not mutate its input', () => {
    const before = structuredClone(rendering);
    renderStatusReducer(rendering, { type: 'failed' });
    expect(rendering).toEqual(before);
  });
});
