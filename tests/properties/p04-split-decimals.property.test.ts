// Feature: scenebeat-mvp, Property 4: Decimal points do not split.
// For any two non-negative integers a and b, a text containing `a.b` between
// other words yields a single sentence that contains `a.b` intact.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { splitSentences } from '../../src/core/splitSentences';

// Words free of terminators, closers, digits, whitespace, and line breaks.
const word = fc
  .array(fc.constantFrom('a', 'B', 'k', 'Z', '中', '文', '增', '长', '倍'), {
    minLength: 1,
    maxLength: 8,
  })
  .map((chars) => chars.join(''));

const words = fc.array(word, { minLength: 1, maxLength: 5 });

// Separator between the number and the neighbouring words: a space, or nothing
// (as in Chinese text such as `增长3.5倍`). Never a line break.
const separator = fc.constantFrom(' ', '');

// The fractional part may have leading zeros (e.g. `1.05`).
const fractional = fc.oneof(
  fc.nat().map(String),
  fc.stringMatching(/^[0-9]{1,6}$/),
);

describe('Property 4: Decimal points do not split', () => {
  /** **Validates: Requirements 2.5** */
  it('keeps a.b intact inside a single sentence', () => {
    fc.assert(
      fc.property(
        words,
        separator,
        fc.nat(),
        fractional,
        separator,
        words,
        (before, sepBefore, a, b, sepAfter, after) => {
          const decimal = `${a}.${b}`;
          const text = `${before.join(' ')}${sepBefore}${decimal}${sepAfter}${after.join(' ')}`;
          const sentences = splitSentences(text);
          expect(sentences).toHaveLength(1);
          expect(sentences[0]).toBe(text);
          expect(sentences[0]).toContain(decimal);
        },
      ),
      { numRuns: 200 },
    );
  });
});
