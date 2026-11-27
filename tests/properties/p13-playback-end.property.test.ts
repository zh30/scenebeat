// Feature: scenebeat-mvp, Property 13: Playback stops at the end.
// For any storyboard with at least one scene, repeatedly applying play and tick
// with enough elapsed time ends with playing = false and index = total - 1.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackState,
} from '../../src/playback/playbackReducer';

// Display_Duration values are integers clamped to [2000, 8000] (Requirement 4.2).
const durationsArb = fc.array(fc.integer({ min: 2000, max: 8000 }), {
  minLength: 1,
  maxLength: 20,
});

// Elapsed times per tick: some shorter than a scene, some longer than any scene.
const ticksArb = fc.array(fc.integer({ min: 500, max: 10000 }), {
  minLength: 1,
  maxLength: 30,
});

describe('Property 13: Playback stops at the end', () => {
  /** **Validates: Requirements 5.2, 5.9** */
  it('playing through with enough elapsed time stops on the last scene', () => {
    fc.assert(
      fc.property(
        durationsArb,
        ticksArb,
        fc.nat(),
        (durations, ticks, startSeed) => {
          let state: PlaybackState = createPlaybackState(durations);
          // Start from any scene, as if the user had selected it first.
          state = playbackReducer(state, { type: 'select', index: startSeed % durations.length });
          state = playbackReducer(state, { type: 'play' });
          expect(state.playing).toBe(true);

          // Each tick is >= 500 ms and each scene <= 8000 ms, so this bound is
          // enough to play through every scene.
          const maxSteps = durations.length * 17 + 1;
          let steps = 0;
          let previousIndex = state.index;
          while (state.playing && steps < maxSteps) {
            state = playbackReducer(state, { type: 'play' }); // no-op while playing
            state = playbackReducer(state, { type: 'tick', elapsedMs: ticks[steps % ticks.length] });
            // Playback only ever advances forward, one scene at a time (Req 5.2).
            expect(state.index - previousIndex === 0 || state.index - previousIndex === 1).toBe(true);
            previousIndex = state.index;
            steps += 1;
          }

          expect(state.playing).toBe(false);
          expect(state.index).toBe(durations.length - 1);
          expect(state.total).toBe(durations.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 5.2, 5.9** */
  it('a single tick of exactly the remaining duration on each scene ends on the last scene', () => {
    fc.assert(
      fc.property(durationsArb, (durations) => {
        let state = playbackReducer(createPlaybackState(durations), { type: 'play' });
        for (let i = 0; i < durations.length; i += 1) {
          expect(state.index).toBe(i);
          expect(state.playing).toBe(true);
          state = playbackReducer(state, { type: 'tick', elapsedMs: state.remainingMs });
        }
        expect(state.playing).toBe(false);
        expect(state.index).toBe(durations.length - 1);

        // Further ticks keep the last scene displayed and stopped.
        const after = playbackReducer(state, { type: 'tick', elapsedMs: 10000 });
        expect(after.playing).toBe(false);
        expect(after.index).toBe(durations.length - 1);
      }),
      { numRuns: 200 },
    );
  });
});
