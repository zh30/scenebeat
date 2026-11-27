// Feature: scenebeat-mvp, Property 11: For any storyboard length and any sequence of playback
// actions (play, pause, next, prev, select, tick, reset), the state satisfies 0 <= index < total
// when total > 0, index = 0 when total = 0, and playing is false when total = 0.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackAction,
  type PlaybackState,
} from '../../src/playback/playbackReducer';

const durationsArb = fc.array(fc.integer({ min: 2000, max: 8000 }), { minLength: 0, maxLength: 8 });

const actionArb: fc.Arbitrary<PlaybackAction> = fc.oneof(
  { weight: 3, arbitrary: fc.constant<PlaybackAction>({ type: 'play' }) },
  { weight: 2, arbitrary: fc.constant<PlaybackAction>({ type: 'pause' }) },
  { weight: 3, arbitrary: fc.constant<PlaybackAction>({ type: 'next' }) },
  { weight: 3, arbitrary: fc.constant<PlaybackAction>({ type: 'prev' }) },
  {
    weight: 2,
    // Includes out-of-range and negative indices to check that select cannot escape the bounds.
    arbitrary: fc.integer({ min: -3, max: 12 }).map<PlaybackAction>((index) => ({ type: 'select', index })),
  },
  {
    weight: 4,
    arbitrary: fc.integer({ min: 0, max: 20000 }).map<PlaybackAction>((elapsedMs) => ({ type: 'tick', elapsedMs })),
  },
  { weight: 1, arbitrary: durationsArb.map<PlaybackAction>((durations) => ({ type: 'reset', durations })) },
);

function assertInBounds(state: PlaybackState): void {
  if (state.total > 0) {
    expect(Number.isInteger(state.index)).toBe(true);
    expect(state.index).toBeGreaterThanOrEqual(0);
    expect(state.index).toBeLessThan(state.total);
  } else {
    expect(state.index).toBe(0);
    expect(state.playing).toBe(false);
  }
}

describe('Property 11: Playback never leaves valid bounds', () => {
  it('keeps index within [0, total) and stays idle with zero scenes', () => {
    // **Validates: Requirements 5.5, 5.6, 5.7, 5.8, 5.12**
    fc.assert(
      fc.property(durationsArb, fc.array(actionArb, { maxLength: 60 }), (durations, actions) => {
        let state = createPlaybackState(durations);
        assertInBounds(state);
        for (const action of actions) {
          state = playbackReducer(state, action);
          assertInBounds(state);
        }
      }),
      { numRuns: 200 },
    );
  });
});
