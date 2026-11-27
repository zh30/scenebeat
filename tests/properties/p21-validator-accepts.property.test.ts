// Feature: scenebeat-mvp, Property 21: Validator accepts every generated storyboard.
// For any transcript text, the Storyboard built from it and serialized is
// reported valid by validateStoryboard (empty error list).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { parseStoryboard, serializeStoryboard } from '../../src/core/serialize';
import { validateStoryboard } from '../../src/core/validate';

// Fragments that trigger every template rule (quotes, years, dates, markers,
// numbers, currency, CJK units) plus plain words, terminators, closers,
// whitespace, and line breaks.
const fragment = fc.constantFrom(
  'Revenue', 'grew', 'the', 'and', 'important', 'podcast', 'creator', 'I',
  '我们', '今天', '讨论', '内容创作', '视频', '的',
  '"Stay hungry"', '“be bold”', '「保持好奇」', '『未来』', '""', '「」',
  '2025', '1999', '2025年', '3月5日', '2026-10-31', '10/31', 'March 5', 'first', 'Then', 'after that',
  '首先', '然后', '接着', '最后', '之后',
  '45%', '$1,200', '¥300', '€9.99', '£5', '100元', '三万', '3倍', '十亿', '3.5', '42',
  '.', '!', '?', '?!', '。', '！', '？', '；', '……', '"', '”', '」', ')', '）',
  ' ', ' ', '  ', '\t', '\u3000', '\n', '\r\n',
);

const featureTranscript = fc
  .array(fragment, { maxLength: 80 })
  .map((parts) => parts.join(''));

const anyTranscript = fc.oneof(
  featureTranscript,
  fc.string({ unit: 'grapheme', maxLength: 300 }),
);

// Dates whose toISOString() is a standard 4-digit-year timestamp.
const createdAt = fc.date({
  min: new Date('1970-01-01T00:00:00.000Z'),
  max: new Date('2999-12-31T23:59:59.999Z'),
  noInvalidDate: true,
});

describe('Property 21: Validator accepts every generated storyboard', () => {
  /** **Validates: Requirements 8.1, 8.7** */
  it('reports every serialized generated storyboard as valid', () => {
    fc.assert(
      fc.property(anyTranscript, createdAt, (text, now) => {
        const json = serializeStoryboard(buildStoryboard(text, now));
        expect(validateStoryboard(JSON.parse(json))).toEqual([]);
      }),
      { numRuns: 500 },
    );
  });

  /** **Validates: Requirements 8.1, 8.7** */
  it('reports the storyboard as valid after a parseStoryboard round trip', () => {
    fc.assert(
      fc.property(anyTranscript, createdAt, (text, now) => {
        const parsed = parseStoryboard(serializeStoryboard(buildStoryboard(text, now)));
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
          expect(validateStoryboard(parsed.value)).toEqual([]);
        }
      }),
      { numRuns: 200 },
    );
  });
});
