// Feature: scenebeat-mvp, Property 1: Splitting preserves content and order.
// For any transcript text, removing all whitespace from the concatenation of
// splitSentences(text) equals the text with all whitespace removed.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { splitSentences } from '../../src/core/splitSentences';

const stripWhitespace = (s: string): string => s.replace(/\s+/g, '');

// Characters that exercise every branch of the scanner: English and CJK
// letters, digits (for the decimal rule), terminators, closers, whitespace,
// and line breaks.
const transcriptChar = fc.constantFrom(
  'a', 'B', 'z', 'W', '中', '文', '字', '我',
  '0', '3', '5', '9',
  '.', '!', '?', '。', '！', '？', '；', '…',
  '"', "'", '”', '’', '「', '」', '『', '』', '(', ')', '（', '）',
  ' ', '\t', '\u3000', '\u00a0', '\n', '\r',
);

const mixedTranscript = fc
  .array(transcriptChar, { maxLength: 200 })
  .map((chars) => chars.join(''));

describe('Property 1: Splitting preserves content and order', () => {
  /** **Validates: Requirements 2.7, 2.8** */
  it('preserves non-whitespace content in order for mixed transcripts', () => {
    fc.assert(
      fc.property(mixedTranscript, (text) => {
        expect(stripWhitespace(splitSentences(text).join(''))).toBe(stripWhitespace(text));
      }),
      { numRuns: 500 },
    );
  });

  /** **Validates: Requirements 2.7, 2.8** */
  it('preserves non-whitespace content in order for arbitrary unicode strings', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 200 }), (text) => {
        expect(stripWhitespace(splitSentences(text).join(''))).toBe(stripWhitespace(text));
      }),
      { numRuns: 200 },
    );
  });
});
