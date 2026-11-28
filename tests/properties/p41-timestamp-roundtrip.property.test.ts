// Feature: scenebeat-edit-export, Property 41: Timestamp round trip.
// For any integer ms from 0 to 359,999,999 and either style,
// formatTimestamp(ms, style) matches ^\d{2}:\d{2}:\d{2},\d{3}$ (SRT) or
// ^\d{2}:\d{2}:\d{2}\.\d{3}$ (VTT), and parseTimestamp of it returns ms.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatTimestamp, parseTimestamp, type TimestampStyle } from '../../src/core/subtitles';

const PATTERNS: Record<TimestampStyle, RegExp> = {
  srt: /^\d{2}:\d{2}:\d{2},\d{3}$/,
  vtt: /^\d{2}:\d{2}:\d{2}\.\d{3}$/,
};

const msArb = fc.oneof(
  fc.integer({ min: 0, max: 359_999_999 }),
  // Values near unit boundaries (seconds, minutes, hours, and the upper bound).
  fc.constantFrom(0, 999, 1000, 59_999, 60_000, 3_599_999, 3_600_000, 359_999_999),
);
const styleArb = fc.constantFrom<TimestampStyle>('srt', 'vtt');

describe('Property 41: Timestamp round trip', () => {
  /** **Validates: Requirements 11.1, 11.2** */
  it('formats to the style pattern and parses back to the same value', () => {
    fc.assert(
      fc.property(msArb, styleArb, (ms, style) => {
        const s = formatTimestamp(ms, style);
        expect(s).toMatch(PATTERNS[style]);
        expect(parseTimestamp(s, style)).toBe(ms);
      }),
      { numRuns: 300 },
    );
  });
});
