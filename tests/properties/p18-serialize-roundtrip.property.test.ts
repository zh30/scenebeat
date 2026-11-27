// Feature: scenebeat-mvp, Property 18: Serialization round trip.
// For any valid Storyboard generated from arbitrary text,
// serializeStoryboard(parseStoryboard(serializeStoryboard(sb)).value) is
// identical to serializeStoryboard(sb), and the parsed value deeply equals sb.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { parseStoryboard, serializeStoryboard } from '../../src/core/serialize';

// Fragments that trigger each template (quotes, years, markers, numbers,
// keywords) mixed with terminators, closers, and line breaks.
const fragment = fc.constantFrom(
  'Revenue grew 45% in 2025.', 'Costs fell by 3 million.', 'She said "ship it now".',
  'First, we plan.', 'Then we build', 'Kubernetes orchestration matters!',
  '他说「我们成功了」。', '2025年我们上线了。', '首先，准备数据；', '收入增长了3倍！',
  '用户体验非常重要……', 'Price is $3.50?!', '¥100元', ' ', '\n', '\r\n', '\t',
  '"', '」', '）', 'a', '中', '7', '.', '。',
);

const transcript = fc.oneof(
  fc.array(fragment, { maxLength: 30 }).map((parts) => parts.join(' ')),
  fc.string({ unit: 'grapheme', maxLength: 200 }),
);

// Valid dates only, so createdAt is a real ISO string.
const date = fc.date({
  min: new Date('1970-01-01T00:00:00.000Z'),
  max: new Date('2999-12-31T23:59:59.999Z'),
  noInvalidDate: true,
});

describe('Property 18: Serialization round trip', () => {
  /** **Validates: Requirements 7.4, 7.6** */
  it('serialize -> parse -> serialize is byte-identical and parse yields an equal storyboard', () => {
    fc.assert(
      fc.property(transcript, date, (text, now) => {
        const sb = buildStoryboard(text, now);
        const first = serializeStoryboard(sb);
        const parsed = parseStoryboard(first);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value).toEqual(sb);
        expect(serializeStoryboard(parsed.value)).toBe(first);
      }),
      { numRuns: 300 },
    );
  });
});
