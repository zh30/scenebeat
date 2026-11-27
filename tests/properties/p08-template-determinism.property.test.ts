// Feature: scenebeat-mvp, Property 8: Template assignment is deterministic.
// For any sentence, calling assignTemplate twice returns deeply equal results
// (same template and same data).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assignTemplate } from '../../src/core/assignTemplate';

// Fragments that trigger each rule, mixed with plain words, so all four
// templates are exercised.
const fragment = fc.oneof(
  fc.constantFrom(
    // quote
    '"Stay hungry"', '“Less is more”', '「少即是多」', '『大道至简』', '""', '「 」',
    // timeline
    '2025', '1999', '2025年', '3月5日', '2025-03-05', '3/14', 'March 5, 2025', 'May 2025',
    'first', 'Then', 'next', 'finally', 'after that', '首先', '然后', '接着', '最后', '之后',
    // big-number
    '45%', '3.5', '1,000', '$3.5 million', '¥100万', '3倍', '三倍', '十亿', '500元', '42',
    // keyword-highlight material
    'growth', 'revenue', 'creators', 'the', 'and', 'this', '我们', '内容创作者', '增长', '人工智能',
  ),
  fc.string({ unit: 'grapheme', maxLength: 8 }),
);

const sentence = fc.oneof(
  fc
    .tuple(
      fc.array(fragment, { minLength: 1, maxLength: 8 }),
      fc.constantFrom(' ', ''),
      fc.constantFrom('', '.', '!', '?', '。', '！', '？', '；', '…'),
    )
    .map(([parts, sep, end]) => parts.join(sep) + end),
  fc.string({ unit: 'grapheme', maxLength: 40 }),
);

describe('Property 8: Template assignment is deterministic', () => {
  /** **Validates: Requirements 3.10** */
  it('returns deeply equal results when called twice on the same sentence', () => {
    fc.assert(
      fc.property(sentence, (s) => {
        const first = assignTemplate(s);
        const second = assignTemplate(s);
        expect(second).toEqual(first);
      }),
      { numRuns: 300 },
    );
  });

  /** **Validates: Requirements 3.10** */
  it('is unaffected by assigning other sentences in between', () => {
    fc.assert(
      fc.property(sentence, fc.array(sentence, { maxLength: 5 }), (s, others) => {
        const first = assignTemplate(s);
        for (const o of others) assignTemplate(o);
        const second = assignTemplate(s);
        expect(second).toEqual(first);
      }),
      { numRuns: 200 },
    );
  });
});
