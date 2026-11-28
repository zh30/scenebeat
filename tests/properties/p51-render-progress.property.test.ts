// Feature: scenebeat-edit-export, Property 51: Render progress.
// For any total length T > 0, rendered time t in [0, T], and scene index i in
// [0, n), renderProgress(t, T, i, n) has percent = floor(100 * t / T) within
// 0 to 100, sceneNumber = i + 1, and sceneTotal = n; and for t1 <= t2, the
// percent for t1 is at most the percent for t2.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderProgress } from '../../src/core/framePlan';

// The total is a sum of integer Display_Durations, so it is an integer ms.
// Rendered times are integer or fractional ms (clock-elapsed times from the
// render job).
const input = fc
  .record({
    total: fc.integer({ min: 1, max: 10_000_000 }),
    a: fc.double({ min: 0, max: 1, noNaN: true }),
    b: fc.double({ min: 0, max: 1, noNaN: true }),
    useIntegers: fc.boolean(),
    n: fc.integer({ min: 1, max: 5000 }),
    iFrac: fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
  })
  .map(({ total, a, b, useIntegers, n, iFrac }) => {
    const toTime = (f: number) => {
      const t = useIntegers ? Math.round(f * total) : f * total;
      return Math.min(Math.max(t, 0), total);
    };
    const [t1, t2] = [toTime(a), toTime(b)].sort((x, y) => x - y);
    const i = Math.min(n - 1, Math.floor(iFrac * n));
    return { total, t1, t2, n, i };
  });

describe('Property 51: Render progress', () => {
  /** **Validates: Requirements 15.1** */
  it('reports floor percent, 1-based scene number, and monotonic progress', () => {
    fc.assert(
      fc.property(input, ({ total, t1, t2, n, i }) => {
        for (const t of [t1, t2]) {
          const p = renderProgress(t, total, i, n);
          expect(p.percent).toBe(Math.floor((100 * t) / total));
          expect(Number.isInteger(p.percent)).toBe(true);
          expect(p.percent).toBeGreaterThanOrEqual(0);
          expect(p.percent).toBeLessThanOrEqual(100);
          expect(p.sceneNumber).toBe(i + 1);
          expect(p.sceneTotal).toBe(n);
        }
        expect(renderProgress(total, total, i, n).percent).toBe(100);
        expect(renderProgress(0, total, i, n).percent).toBe(0);
        expect(renderProgress(t1, total, i, n).percent).toBeLessThanOrEqual(
          renderProgress(t2, total, i, n).percent,
        );
      }),
      { numRuns: 200 },
    );
  });
});
