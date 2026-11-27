// Feature: scenebeat-mvp, Property 15: For any index and total >= 1, the position label
// equals `${index + 1} / ${total}`.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatPosition } from '../../src/playback/positionLabel';

// A valid playback position: total >= 1 and 0 <= index < total.
const positionArb = fc
  .integer({ min: 1, max: 10_000 })
  .chain((total) => fc.record({ total: fc.constant(total), index: fc.integer({ min: 0, max: total - 1 }) }));

describe('Property 15: Position label', () => {
  /** **Validates: Requirements 5.13** */
  it('shows the one-based current position and the total', () => {
    fc.assert(
      fc.property(positionArb, ({ index, total }) => {
        const label = formatPosition(index, total);
        expect(label).toBe(`${index + 1} / ${total}`);

        const match = /^(\d+) \/ (\d+)$/.exec(label);
        expect(match).not.toBeNull();
        const current = Number(match![1]);
        const shownTotal = Number(match![2]);
        expect(current).toBe(index + 1);
        expect(shownTotal).toBe(total);
        expect(current).toBeGreaterThanOrEqual(1);
        expect(current).toBeLessThanOrEqual(shownTotal);
      }),
      { numRuns: 200 },
    );
  });
});
