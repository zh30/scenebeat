// Feature: scenebeat-mvp, Property 16: For any storyboard and any valid index i, the select(i)
// action sets the playback index to i.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackAction,
} from '../../src/playback/playbackReducer';

const durationsArb = fc.array(fc.integer({ min: 2000, max: 8000 }), { minLength: 1, maxLength: 10 });

// Actions used to reach an arbitrary prior state (playing or paused, any scene, partial time).
// Reset is excluded so the storyboard under test stays fixed.
const priorActionArb: fc.Arbitrary<PlaybackAction> = fc.oneof(
  fc.constant<PlaybackAction>({ type: 'play' }),
  fc.constant<PlaybackAction>({ type: 'pause' }),
  fc.constant<PlaybackAction>({ type: 'next' }),
  fc.constant<PlaybackAction>({ type: 'prev' }),
  fc.nat({ max: 12 }).map<PlaybackAction>((index) => ({ type: 'select', index })),
  fc.integer({ min: 0, max: 10000 }).map<PlaybackAction>((elapsedMs) => ({ type: 'tick', elapsedMs })),
);

// A storyboard (as scene durations) plus a valid index into it.
const storyboardAndIndexArb = durationsArb.chain((durations) =>
  fc.tuple(fc.constant(durations), fc.nat({ max: durations.length - 1 })),
);

describe('Property 16: Selecting a list entry shows that scene', () => {
  it('select(i) shows scene i from any reachable playback state', () => {
    // **Validates: Requirements 6.3**
    fc.assert(
      fc.property(
        storyboardAndIndexArb,
        fc.array(priorActionArb, { maxLength: 30 }),
        ([durations, i], prior) => {
          let state = createPlaybackState(durations);
          for (const action of prior) state = playbackReducer(state, action);

          const next = playbackReducer(state, { type: 'select', index: i });

          expect(next.index).toBe(i);
          // The selected scene starts with its full duration and the storyboard is unchanged.
          expect(next.remainingMs).toBe(durations[i]);
          expect(next.total).toBe(durations.length);
          expect(next.playing).toBe(state.playing);
        },
      ),
      { numRuns: 200 },
    );
  });
});
