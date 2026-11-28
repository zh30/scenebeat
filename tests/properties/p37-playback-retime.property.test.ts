// Feature: scenebeat-edit-export, Property 37: For any playback state reached by any action
// sequence and any new durations list of the same length, `retime` yields `playing = false`, the
// same `index`, `durations` equal to the new list, and `remainingMs` equal to the new duration at
// `index`.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackAction,
} from '../../src/playback/playbackReducer';
import { displayDuration, displayDurations } from './arbitraries';

// Actions used to reach an arbitrary prior state (playing or paused, any scene, partial time).
// Reset is excluded so the scene count under test stays fixed.
const priorActionArb: fc.Arbitrary<PlaybackAction> = fc.oneof(
  fc.constant<PlaybackAction>({ type: 'play' }),
  fc.constant<PlaybackAction>({ type: 'pause' }),
  fc.constant<PlaybackAction>({ type: 'next' }),
  fc.constant<PlaybackAction>({ type: 'prev' }),
  fc.nat({ max: 12 }).map<PlaybackAction>((index) => ({ type: 'select', index })),
  fc.integer({ min: 0, max: 10000 }).map<PlaybackAction>((elapsedMs) => ({ type: 'tick', elapsedMs })),
);

// Old and new durations of the same length (possibly empty).
const durationPairArb = displayDurations({ maxLength: 10 }).chain((before) =>
  fc.tuple(
    fc.constant(before),
    fc.array(displayDuration, { minLength: before.length, maxLength: before.length }),
  ),
);

describe('Property 37: Retiming pauses and keeps the position', () => {
  it('retime pauses, keeps the index, and replaces the durations', () => {
    // **Validates: Requirements 7.2, 7.3**
    fc.assert(
      fc.property(durationPairArb, fc.array(priorActionArb, { maxLength: 30 }), ([before, after], prior) => {
        let state = createPlaybackState(before);
        for (const action of prior) state = playbackReducer(state, action);

        const input = [...after];
        const next = playbackReducer(state, { type: 'retime', durations: input });

        expect(next.playing).toBe(false);
        expect(next.index).toBe(state.index);
        expect(next.durations).toEqual(after);
        expect(next.total).toBe(after.length);
        expect(next.remainingMs).toBe(after[state.index] ?? 0);
        // The action's array is not mutated.
        expect(input).toEqual(after);
      }),
      { numRuns: 200 },
    );
  });
});
