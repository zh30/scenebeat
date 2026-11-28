// Feature: scenebeat-edit-export, Property 42: Timestamps sort like their values.
// For any integers 0 <= a < b < 360,000,000 and either style,
// formatTimestamp(a, style) < formatTimestamp(b, style) in plain string comparison.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatTimestamp, type TimestampStyle } from '../../src/core/subtitles';

const MAX = 360_000_000; // exclusive upper bound

// Ordered pairs a < b: a start value plus a positive delta. Small deltas and
// starts just below unit boundaries exercise carries (999 -> 1000 ms, etc.).
const pairArb = fc
  .tuple(
    fc.oneof(
      fc.integer({ min: 0, max: MAX - 2 }),
      fc.constantFrom(0, 999, 59_999, 3_599_999, 35_999_999, MAX - 2),
    ),
    fc.oneof(fc.integer({ min: 1, max: 10 }), fc.integer({ min: 1, max: MAX - 1 })),
  )
  .map(([a, delta]) => [a, Math.min(MAX - 1, a + delta)] as const)
  .filter(([a, b]) => a < b);

const styleArb = fc.constantFrom<TimestampStyle>('srt', 'vtt');

describe('Property 42: Timestamps sort like their values', () => {
  /** **Validates: Requirements 11.3** */
  it('string order of formatted timestamps equals numeric order', () => {
    fc.assert(
      fc.property(pairArb, styleArb, ([a, b], style) => {
        const sa = formatTimestamp(a, style);
        const sb = formatTimestamp(b, style);
        expect(sa < sb).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
