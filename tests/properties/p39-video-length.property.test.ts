// Feature: scenebeat-edit-export, Property 39: Video length label.
// For any list of Display_Durations, videoLengthSeconds(totalDuration(durations))
// equals (Math.round(sum / 100) / 10).toFixed(1), which is the sum divided by
// 1000 rounded to one decimal place.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { totalDuration, videoLengthSeconds } from '../../src/core/framePlan';
import { displayDurations } from './arbitraries';

describe('Property 39: Video length label', () => {
  /** **Validates: Requirements 9.4** */
  it('shows the total length in seconds rounded to one decimal place', () => {
    fc.assert(
      fc.property(displayDurations({ maxLength: 200 }), (durations) => {
        // Reference sum, written independently of totalDuration.
        const sum = durations.reduce((a, b) => a + b, 0);
        expect(totalDuration(durations)).toBe(sum);

        const label = videoLengthSeconds(totalDuration(durations));

        // The formula stated in the property.
        expect(label).toBe((Math.round(sum / 100) / 10).toFixed(1));

        // Independent integer model: tenths of a second, rounded half up.
        const tenths = Math.floor((sum + 50) / 100);
        expect(label).toBe(`${Math.floor(tenths / 10)}.${tenths % 10}`);

        // Exactly one decimal place, and within half a tenth of the true length.
        expect(label).toMatch(/^\d+\.\d$/);
        expect(Math.abs(Number(label) - sum / 1000)).toBeLessThanOrEqual(0.05 + 1e-9);
      }),
      { numRuns: 200 },
    );
  });
});
