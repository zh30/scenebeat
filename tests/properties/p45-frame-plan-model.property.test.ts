// Feature: scenebeat-edit-export, Property 45: Frame plan matches cue intervals.
// For any list of Display_Durations, planFrames returns ceil(T * 30 / 1000)
// frames; frame k has timeMs = k * 1000 / 30; its sceneIndex is the scene
// whose interval [start, end) from buildCues contains timeMs; and its
// elapsedMs equals timeMs - start.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { planFrames } from '../../src/core/framePlan';
import { displayDurations } from './arbitraries';

const FPS = 30;

/** Independent cue intervals: prefix sums, as buildCues defines them. */
function cueIntervals(durations: readonly number[]): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (const d of durations) {
    out.push({ start, end: start + d });
    start += d;
  }
  return out;
}

describe('Property 45: Frame plan matches cue intervals', () => {
  /** **Validates: Requirements 13.6, 13.7, 13.8** */
  it('plans ceil(T*30/1000) frames, each in the cue interval containing its time', () => {
    fc.assert(
      fc.property(displayDurations({ maxLength: 40 }), (durations) => {
        const total = durations.reduce((a, b) => a + b, 0);
        const intervals = cueIntervals(durations);
        const frames = planFrames(durations);

        expect(frames.length).toBe(Math.ceil((total * FPS) / 1000));

        frames.forEach((frame, k) => {
          expect(frame.k).toBe(k);
          expect(frame.timeMs).toBe((k * 1000) / FPS);

          // Scene whose [start, end) contains timeMs; compared on integers
          // (start <= k*1000/30 < end  <=>  start*30 <= k*1000 < end*30).
          const expected = intervals.findIndex(
            ({ start, end }) => start * FPS <= k * 1000 && k * 1000 < end * FPS,
          );
          expect(expected).toBeGreaterThanOrEqual(0);
          expect(frame.sceneIndex).toBe(expected);
          expect(frame.elapsedMs).toBe(frame.timeMs - intervals[expected].start);
        });
      }),
      { numRuns: 200 },
    );
  });
});
