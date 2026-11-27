// Feature: scenebeat-mvp, Property 17: Scene counts are consistent.
// For any storyboard, the total shown by the list equals scenes.length, and the
// per-template counts sum to that total.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { countByTemplate } from '../../src/core/stats';
import { TEMPLATES } from '../../src/core/types';

// Fragments that trigger every template rule plus plain words, terminators,
// closers, whitespace, and line breaks.
const fragment = fc.constantFrom(
  'Revenue', 'grew', 'the', 'important', 'podcast', 'creator',
  '我们', '今天', '讨论', '内容创作', '视频',
  '"Stay hungry"', '“be bold”', '「保持好奇」', '『未来』',
  '2025', '2025年', '3月5日', 'first', 'Then', '首先', '最后',
  '45%', '$1,200', '¥300', '三万', '3倍', '3.5', '42',
  '.', '!', '?', '?!', '。', '！', '？', '；', '……', '”', '」', '）',
  ' ', '  ', '\n',
);

const transcript = fc.oneof(
  fc.array(fragment, { maxLength: 80 }).map((parts) => parts.join('')),
  fc.string({ unit: 'grapheme', maxLength: 300 }),
);

describe('Property 17: Scene counts are consistent', () => {
  /** **Validates: Requirements 6.4** */
  it('total equals scenes.length and per-template counts sum to the total', () => {
    fc.assert(
      fc.property(transcript, (text) => {
        const sb = buildStoryboard(text, new Date('2026-10-31T12:00:00.000Z'));
        const counts = countByTemplate(sb);

        expect(sb.sceneCount).toBe(sb.scenes.length);
        expect(Object.keys(counts).sort()).toEqual([...TEMPLATES].sort());

        let sum = 0;
        for (const t of TEMPLATES) {
          const n = counts[t];
          expect(Number.isInteger(n) && n >= 0).toBe(true);
          expect(n).toBe(sb.scenes.filter((s) => s.template === t).length);
          sum += n;
        }
        expect(sum).toBe(sb.scenes.length);
      }),
      { numRuns: 300 },
    );
  });
});
