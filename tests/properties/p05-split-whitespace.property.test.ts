import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { splitSentences } from '../../src/core/splitSentences';

// Every character that JavaScript treats as whitespace (WhiteSpace and
// LineTerminator in ECMA-262, the set removed by String.prototype.trim).
const WHITESPACE_CHARS = [
  ' ', '\t', '\n', '\r', '\v', '\f',
  '\u00a0', '\u1680',
  '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005',
  '\u2006', '\u2007', '\u2008', '\u2009', '\u200a',
  '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff',
];

const whitespaceOnly = fc.oneof(
  fc.constant(''),
  fc
    .array(fc.constantFrom(...WHITESPACE_CHARS), { maxLength: 60 })
    .map((chars) => chars.join('')),
  // Runs of common whitespace including CRLF sequences.
  fc
    .array(fc.constantFrom(' ', '  ', '\t', '\r\n', '\n\n', '\u3000'), { maxLength: 30 })
    .map((parts) => parts.join('')),
);

describe('splitSentences', () => {
  // Feature: scenebeat-mvp, Property 5: For any string made only of whitespace
  // characters (including empty), splitSentences returns an empty list.
  // **Validates: Requirements 2.9**
  it('Property 5: whitespace-only input yields no sentences', () => {
    fc.assert(
      fc.property(whitespaceOnly, (text) => {
        expect(text.trim()).toBe('');
        expect(splitSentences(text)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });
});
