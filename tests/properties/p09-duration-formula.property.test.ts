// Feature: scenebeat-mvp, Property 9: Duration formula and clamp.
// For any sentence, computeDuration equals
// min(8000, max(2000, 1000 + 250 * englishWords + 200 * chineseChars)),
// and the result is always within 2000 to 8000 inclusive.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeDuration,
  readingLength,
  MIN_DURATION_MS,
  MAX_DURATION_MS,
} from '../../src/core/duration';

const expected = (words: number, chars: number) =>
  Math.min(8000, Math.max(2000, 1000 + 250 * words + 200 * chars));

// English word tokens and Han characters with known counts.
const englishWord = fc.stringMatching(/^[A-Za-z0-9'’-]{1,8}$/);
const hanChar = fc.constantFrom('我', '们', '增', '长', '内', '容', '创', '作', '者', '年', '万', '亿', '倍');
// Separators that are neither English word characters nor Han characters.
const separator = fc.constantFrom(' ', '  ', ', ', '。', '！', '？', '；', '…', '「', '」', '“', '”', '\t', '%', '$');

type Token = { kind: 'word'; text: string } | { kind: 'han'; text: string };

// Every token is wrapped in separators so adjacent English words never merge.
const knownSentence = fc
  .array(
    fc.oneof(
      englishWord.map((text): Token => ({ kind: 'word', text })),
      hanChar.map((text): Token => ({ kind: 'han', text })),
    ),
    { maxLength: 60 },
  )
  .chain((tokens) =>
    fc.array(separator, { minLength: tokens.length + 1, maxLength: tokens.length + 1 }).map((seps) => {
      let text = seps[0];
      tokens.forEach((t, i) => {
        text += t.text + seps[i + 1];
      });
      return {
        text,
        words: tokens.filter((t) => t.kind === 'word').length,
        chars: tokens.filter((t) => t.kind === 'han').length,
      };
    }),
  );

describe('Property 9: Duration formula and clamp', () => {
  it('exports the 2000 to 8000 ms bounds', () => {
    expect(MIN_DURATION_MS).toBe(2000);
    expect(MAX_DURATION_MS).toBe(8000);
  });

  /** **Validates: Requirements 4.1, 4.2** */
  it('matches the clamped formula for sentences with known word and character counts', () => {
    fc.assert(
      fc.property(knownSentence, ({ text, words, chars }) => {
        expect(readingLength(text)).toEqual({ englishWords: words, chineseChars: chars });
        expect(computeDuration(text)).toBe(expected(words, chars));
      }),
      { numRuns: 300 },
    );
  });

  /** **Validates: Requirements 4.1, 4.2** */
  it('is an integer within [2000, 8000] consistent with readingLength for arbitrary text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 200 }), (s) => {
        const { englishWords, chineseChars } = readingLength(s);
        const d = computeDuration(s);
        expect(d).toBe(expected(englishWords, chineseChars));
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(2000);
        expect(d).toBeLessThanOrEqual(8000);
      }),
      { numRuns: 300 },
    );
  });
});
