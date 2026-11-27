// Feature: scenebeat-mvp, Property 12: Pause and resume preserve remaining time.
// For any playback state with playing = true and any elapsed time t less than
// remainingMs, applying tick(t), then pause, then play leaves index unchanged
// and remainingMs equal to the earlier value minus t.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackAction,
  type PlaybackState,
} from '../../src/playback/playbackReducer';

const durationsArb = fc.array(fc.integer({ min: 2000, max: 8000 }), { minLength: 1, maxLength: 20 });

// Arbitrary actions used to reach varied states before the property is checked.
const prefixActionArb: fc.Arbitrary<PlaybackAction> = fc.oneof(
  fc.constant<PlaybackAction>({ type: 'play' }),
  fc.constant<PlaybackAction>({ type: 'pause' }),
  fc.constant<PlaybackAction>({ type: 'next' }),
  fc.constant<PlaybackAction>({ type: 'prev' }),
  fc.integer({ min: -2, max: 22 }).map((index): PlaybackAction => ({ type: 'select', index })),
  fc.integer({ min: 0, max: 10000 }).map((elapsedMs): PlaybackAction => ({ type: 'tick', elapsedMs })),
);

// A playing state with time left on the current scene, reached from a fresh state.
const playingStateArb: fc.Arbitrary<PlaybackState> = fc
  .tuple(durationsArb, fc.array(prefixActionArb, { maxLength: 30 }))
  .map(([durations, actions]) => {
    const reached = actions.reduce(playbackReducer, createPlaybackState(durations));
    return playbackReducer(reached, { type: 'play' });
  })
  .filter((s) => s.playing && s.remainingMs > 0);

// The state together with an elapsed time strictly below remainingMs.
const caseArb = playingStateArb.chain((state) =>
  fc.oneof(
    fc.integer({ min: 0, max: state.remainingMs - 1 }),
    fc.double({ min: 0, max: state.remainingMs, maxExcluded: true, noNaN: true }),
  ).map((t) => ({ state, t })),
);

describe('Property 12: Pause and resume preserve remaining time', () => {
  /** **Validates: Requirements 5.2, 5.3, 5.4** */
  it('tick(t), pause, play keeps the scene and resumes with remainingMs - t', () => {
    fc.assert(
      fc.property(caseArb, ({ state, t }) => {
        const before = state.remainingMs;

        const ticked = playbackReducer(state, { type: 'tick', elapsedMs: t });
        expect(ticked.index).toBe(state.index);
        expect(ticked.playing).toBe(true);

        const paused = playbackReducer(ticked, { type: 'pause' });
        expect(paused.playing).toBe(false);
        expect(paused.index).toBe(state.index);
        expect(paused.remainingMs).toBe(before - t);

        const resumed = playbackReducer(paused, { type: 'play' });
        expect(resumed.playing).toBe(true);
        expect(resumed.index).toBe(state.index);
        expect(resumed.remainingMs).toBe(before - t);
      }),
      { numRuns: 300 },
    );
  });
});
