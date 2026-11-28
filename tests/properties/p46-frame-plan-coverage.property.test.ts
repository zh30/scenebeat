// Feature: scenebeat-edit-export, Property 46: Frame plan is ordered and covers every scene.
// For any list of Display_Durations (including durations below 2000 ms down to
// 1 ms, to exercise the bound), the sceneIndex values of consecutive frames are
// non-decreasing, and every scene with a duration of at least 34 ms is named by
// at least one frame.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { planFrames } from '../../src/core/framePlan';

// Mix very short durations (1 to 100 ms, around the 34 ms bound) with
// ordinary Display_Durations so short scenes sit between long ones.
const duration = fc.oneof(
  fc.integer({ min: 1, max: 100 }),
  fc.integer({ min: 2000, max: 8000 }),
  fc.integer({ min: 1, max: 8000 }),
);
const durations = fc.array(duration, { minLength: 1, maxLength: 30 });

describe('Property 46: Frame plan is ordered and covers every scene', () => {
  /** **Validates: Requirements 13.9** */
  it('scene indices never decrease and every scene of at least 34 ms gets a frame', () => {
    fc.assert(
      fc.property(durations, (ds) => {
        const frames = planFrames(ds);
        for (let k = 1; k < frames.length; k++) {
          expect(frames[k].sceneIndex).toBeGreaterThanOrEqual(frames[k - 1].sceneIndex);
        }
        const named = new Set(frames.map((f) => f.sceneIndex));
        ds.forEach((d, i) => {
          if (d >= 34) expect(named.has(i), `scene ${i} (${d} ms) has no frame`).toBe(true);
        });
      }),
      { numRuns: 200 },
    );
  });
});
