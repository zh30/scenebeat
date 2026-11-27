// Feature: scenebeat-mvp, Property 14: For any playback state and any new list of durations,
// the reset action yields index = 0 and playing = false.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackAction,
} from '../../src/playback/playbackReducer';

const durationsArb = fc.array(fc.integer({ min: 2000, max: 8000 }), { minLength: 0, maxLength: 8 });

// Actions used to drive the reducer into an arbitrary reachable state before the reset.
const actionArb: fc.Arbitrary<PlaybackAction> = fc.oneof(
  fc.constant<PlaybackAction>({ type: 'play' }),
  fc.constant<PlaybackAction>({ type: 'pause' }),
  fc.constant<PlaybackAction>({ type: 'next' }),
  fc.constant<PlaybackAction>({ type: 'prev' }),
  fc.integer({ min: 0, max: 8 }).map<PlaybackAction>((index) => ({ type: 'select', index })),
  fc.integer({ min: 0, max: 10000 }).map<PlaybackAction>((elapsedMs) => ({ type: 'tick', elapsedMs })),
);

describe('Property 14: Regeneration resets playback', () => {
  it('reset always returns to the first scene, paused, with the new durations', () => {
    // **Validates: Requirements 5.14**
    fc.assert(
      fc.property(
        durationsArb,
        fc.array(actionArb, { maxLength: 40 }),
        durationsArb,
        (initial, actions, next) => {
          let state = createPlaybackState(initial);
          for (const action of actions) state = playbackReducer(state, action);

          const after = playbackReducer(state, { type: 'reset', durations: next });

          expect(after.index).toBe(0);
          expect(after.playing).toBe(false);
          expect(after.total).toBe(next.length);
          expect(after.remainingMs).toBe(next[0] ?? 0);
          expect([...after.durations]).toEqual(next);
        },
      ),
      { numRuns: 200 },
    );
  });
});
