import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { splitSentences } from '../../src/core/splitSentences';

/**
 * Feature: scenebeat-mvp, Property 2: Splitting at terminators
 *
 * For any list of non-empty sentence bodies (free of terminators and line
 * breaks), each followed by a run of one or more terminators and optional
 * closers, and joined by optional spaces, splitSentences returns exactly those
 * sentences, each keeping its terminators and closers. The generator also
 * includes an unterminated final segment.
 *
 * **Validates: Requirements 2.1, 2.3, 2.6**
 */

const TERMINATORS = ['.', '!', '?', '。', '！', '？', '；', '…'];
const CLOSERS = ['"', "'", '”', '’', '」', '』', ')', '）'];

// Body characters: no terminators, closers, or line breaks.
const BODY_CHARS = [
  ...'abcXYZ',
  ...'我们今天说',
  ...'0123456789',
  ' ',
  ',',
  '，',
  '-',
];

const isDigit = (c: string) => c >= '0' && c <= '9';

// Bodies are trimmed and do not start or end with a digit, so a single `.`
// terminator never falls between two digits (that case is Requirement 2.5).
const bodyArb = fc
  .array(fc.constantFrom(...BODY_CHARS), { minLength: 1, maxLength: 12 })
  .map((cs) => cs.join('').trim())
  .filter(
    (s) => s.length > 0 && !isDigit(s[0]) && !isDigit(s[s.length - 1]),
  );

// Includes fixed runs like `?!` and `……` alongside random runs.
const terminatorRunArb = fc.oneof(
  fc.constantFrom('?!', '……', '。', '!', '.', '？！'),
  fc
    .array(fc.constantFrom(...TERMINATORS), { minLength: 1, maxLength: 4 })
    .map((cs) => cs.join('')),
);

const closersArb = fc
  .array(fc.constantFrom(...CLOSERS), { minLength: 0, maxLength: 2 })
  .map((cs) => cs.join(''));

const separatorArb = fc.constantFrom('', ' ', '  ', '\t');

const sentenceArb = fc
  .tuple(bodyArb, terminatorRunArb, closersArb)
  .map(([body, run, closers]) => body + run + closers);

describe('Property 2: Splitting at terminators', () => {
  it('returns exactly the generated sentences with terminators and closers attached', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(sentenceArb, separatorArb), { minLength: 0, maxLength: 8 }),
        fc.option(bodyArb, { nil: undefined }),
        (parts, trailing) => {
          const expected = parts.map(([s]) => s);
          let text = parts.map(([s, sep]) => s + sep).join('');
          if (trailing !== undefined) {
            text += trailing;
            expected.push(trailing);
          }
          expect(splitSentences(text)).toEqual(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
