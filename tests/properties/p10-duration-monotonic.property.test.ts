// Feature: scenebeat-mvp, Property 10: Duration is monotonic in reading length.
// For any two sentences A and B where A has at least as many English words and
// at least as many Chinese characters as B, computeDuration(A) >= computeDuration(B).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeDuration, readingLength } from '../../src/core/duration';

// Mixed English words, Han text, digits, punctuation, and whitespace.
const token = fc.oneof(
  fc.constantFrom(
    'growth', 'revenue', "don't", 'well-known', 'AI', '2025', '3.5', '45%',
    '我们', '内容创作者', '增长', '人工智能', '年', '「少即是多」',
    '.', ',', '!', '?', '。', '，', '…', ' ', '  ', '\n', '—',
  ),
  fc.string({ unit: 'grapheme', maxLength: 6 }),
);

const sentence = fc
  .tuple(fc.array(token, { maxLength: 40 }), fc.constantFrom(' ', ''))
  .map(([parts, sep]) => parts.join(sep));

function dominates(a: string, b: string): boolean {
  const la = readingLength(a);
  const lb = readingLength(b);
  return la.englishWords >= lb.englishWords && la.chineseChars >= lb.chineseChars;
}

describe('Property 10: Duration is monotonic in reading length', () => {
  /** **Validates: Requirements 4.3** */
  it('a sentence extended with more content never gets a shorter duration', () => {
    fc.assert(
      fc.property(sentence, sentence, (b, extra) => {
        // The space separator keeps B's word runs intact, so A dominates B.
        const a = `${b} ${extra}`;
        expect(dominates(a, b)).toBe(true);
        expect(computeDuration(a)).toBeGreaterThanOrEqual(computeDuration(b));
      }),
      { numRuns: 300 },
    );
  });

  /** **Validates: Requirements 4.3** */
  it('for independent sentence pairs, dominance in both counts implies >= duration', () => {
    fc.assert(
      fc.property(sentence, sentence, (x, y) => {
        // Order the pair so the dominating sentence (if any) is checked as A.
        for (const [a, b] of [
          [x, y],
          [y, x],
        ] as const) {
          if (dominates(a, b)) {
            expect(computeDuration(a)).toBeGreaterThanOrEqual(computeDuration(b));
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
