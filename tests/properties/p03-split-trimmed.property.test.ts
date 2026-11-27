import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { splitSentences } from '../../src/core/splitSentences';

// Mixed transcript text: English, CJK, digits, terminators, closers,
// and a variety of whitespace and line breaks (\n, \r, \r\n).
const piece = fc.oneof(
  fc.constantFrom('a', 'Z', 'hello', 'world', '中', '文字', '你好', '0', '7', '3.5'),
  fc.constantFrom('.', '!', '?', '。', '！', '？', '；', '…', '?!', '……'),
  fc.constantFrom('"', "'", '”', '’', '「', '」', '『', '』', '(', ')', '）'),
  fc.constantFrom(' ', '  ', '\t', '\u3000', '\u00a0'),
  fc.constantFrom('\n', '\r', '\r\n', '\n\n', ' \n ', '\t\r\n\t'),
);

const transcript = fc.oneof(
  fc.array(piece, { maxLength: 40 }).map((parts) => parts.join('')),
  fc.string({ unit: 'grapheme', maxLength: 80 }),
);

describe('splitSentences', () => {
  // Feature: scenebeat-mvp, Property 3: For any text, every sentence returned by
  // splitSentences is non-empty, equals its own trimmed form, and contains no line break.
  // **Validates: Requirements 2.2, 2.4**
  it('Property 3: sentences are trimmed, non-empty, and line-free', () => {
    fc.assert(
      fc.property(transcript, (text) => {
        for (const s of splitSentences(text)) {
          expect(s.length).toBeGreaterThan(0);
          expect(s).toBe(s.trim());
          expect(s).not.toMatch(/[\n\r]/);
        }
      }),
      { numRuns: 200 },
    );
  });
});
