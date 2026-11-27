// Feature: scenebeat-mvp, Property 7: Highlighted data matches the template.
// For any sentence, the recorded data satisfies the template's contract:
// `big-number` records a numeric value that occurs in the sentence and is the
// first numeric match; `keyword-highlight` records 1 to 3 keywords each
// occurring in the sentence; `quote` records the text inside the delimiters;
// `timeline` records a year, date, or marker that occurs in the sentence.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assignTemplate } from '../../src/core/assignTemplate';

// ---------------------------------------------------------------------------
// Generators: sentences built from fragments that trigger each rule, mixed with
// plain English and Chinese words, plus fully arbitrary strings.
// ---------------------------------------------------------------------------

const englishWord = fc.constantFrom(
  'revenue', 'growth', 'the', 'team', 'shipped', 'product', 'market', 'a', 'is',
  'customers', 'Kiro', 'spooky', 'with', 'that', 'pumpkin',
);
const chineseWord = fc.constantFrom('我们', '产品', '增长', '用户', '市场', '的', '团队', '发布', '万圣节');
const year = fc.integer({ min: 1000, max: 2999 }).map(String);
const chineseDate = fc.oneof(
  fc.integer({ min: 1, max: 2999 }).map((y) => `${y}年`),
  fc.tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 })).map(([m, d]) => `${m}月${d}日`),
);
const isoDate = fc
  .tuple(fc.integer({ min: 1000, max: 2999 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }))
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
const slashDate = fc
  .tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
  .map(([m, d]) => `${m}/${d}`);
const monthDate = fc
  .tuple(fc.constantFrom('March', 'Oct', 'December', 'May'), fc.integer({ min: 1, max: 28 }))
  .map(([m, d]) => `${m} ${d}`);
const marker = fc.constantFrom('first', 'Then', 'next', 'finally', 'after that', '首先', '然后', '接着', '最后', '之后');
const number = fc.oneof(
  fc.nat({ max: 999 }).map(String),
  fc.tuple(fc.nat({ max: 99 }), fc.nat({ max: 99 })).map(([a, b]) => `${a}.${b}`),
  fc.nat({ max: 100 }).map((n) => `${n}%`),
  fc.nat({ max: 999 }).map((n) => `$${n}`),
  fc.nat({ max: 999 }).map((n) => `${n}元`),
  fc.nat({ max: 99 }).map((n) => `${n}倍`),
  fc.constantFrom('三倍', '五万', '两亿', '十%'),
  fc.integer({ min: 1, max: 999 }).map((n) => `${n},000`),
);
const quoteInner = fc
  .array(fc.oneof(englishWord, chineseWord, number, fc.constant(' ')), { minLength: 0, maxLength: 4 })
  .map((parts) => parts.join(' '));
const quote = fc
  .tuple(fc.constantFrom(['"', '"'], ['“', '”'], ['「', '」'], ['『', '』']), quoteInner)
  .map(([[o, c], inner]) => `${o}${inner}${c}`);

const fragment = fc.oneof(
  { weight: 4, arbitrary: englishWord },
  { weight: 4, arbitrary: chineseWord },
  { weight: 1, arbitrary: year },
  { weight: 1, arbitrary: chineseDate },
  { weight: 1, arbitrary: isoDate },
  { weight: 1, arbitrary: slashDate },
  { weight: 1, arbitrary: monthDate },
  { weight: 1, arbitrary: marker },
  { weight: 2, arbitrary: number },
  { weight: 1, arbitrary: quote },
  { weight: 1, arbitrary: fc.constantFrom('.', '!', '?', '。', '，', ',') },
);

const builtSentence = fc
  .tuple(fc.array(fragment, { minLength: 1, maxLength: 8 }), fc.constantFrom(' ', ''))
  .map(([parts, sep]) => parts.join(sep));

const sentence = fc.oneof(
  { weight: 4, arbitrary: builtSentence },
  { weight: 1, arbitrary: fc.string({ minLength: 1, maxLength: 30 }) },
);

// ---------------------------------------------------------------------------
// Independent reference checks
// ---------------------------------------------------------------------------

const QUOTE_PAIRS: [string, string][] = [['"', '"'], ['“', '”'], ['「', '」'], ['『', '』']];

/** True if `q` appears in the sentence between a matching open and close delimiter (with only whitespace padding). */
function isDelimitedQuote(s: string, q: string): boolean {
  for (const [o, c] of QUOTE_PAIRS) {
    let from = 0;
    let at: number;
    while ((at = s.indexOf(q, from)) !== -1) {
      const before = s.slice(0, at).replace(/\s+$/, '');
      const after = s.slice(at + q.length).replace(/^\s+/, '');
      if (before.endsWith(o) && after.startsWith(c)) return true;
      from = at + 1;
    }
  }
  return false;
}

const TIMELINE_SHAPES: RegExp[] = [
  /^[12]\d{3}$/, // year
  /^\d+年(\d+月(\d+日)?)?$/, // Chinese year / date
  /^\d+月\d+日$/, // Chinese month-day
  /^\d{4}-\d{1,2}-\d{1,2}$/, // ISO date
  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/, // M/D or M/D/Y
  /^[A-Za-z]{3,9}\.?\s+\d{1,4}(st|nd|rd|th)?(,?\s+\d{4})?$/, // month name + day/year
  /^(first|then|next|finally|after\s+that)$/i, // English markers
  /^(首先|然后|接着|最后|之后)$/, // Chinese markers
];

const CHINESE_NUMERAL_UNIT = /[零〇一二两三四五六七八九十百千]+[万亿倍%％]/;

/** Position of the earliest numeric token start (ASCII digit or Chinese numeral + unit), or Infinity. */
function firstNumericPos(s: string): number {
  const d = s.search(/\d/);
  const c = s.search(CHINESE_NUMERAL_UNIT);
  return Math.min(d === -1 ? Infinity : d, c === -1 ? Infinity : c);
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

describe('Property 7: Highlighted data matches the template', () => {
  /** **Validates: Requirements 3.6, 3.7, 3.8, 3.9** */
  it('records template-specific data that satisfies its contract', () => {
    fc.assert(
      fc.property(sentence, (s) => {
        const result = assignTemplate(s);
        const keys = Object.keys(result.data);
        expect(keys).toHaveLength(1);

        switch (result.template) {
          case 'big-number': {
            // Req 3.6: first matched numeric value, occurring in the sentence.
            const { value } = result.data;
            expect(keys).toEqual(['value']);
            expect(value.length).toBeGreaterThan(0);
            const pos = s.indexOf(value);
            expect(pos).toBeGreaterThanOrEqual(0);
            expect(/\d/.test(value) || CHINESE_NUMERAL_UNIT.test(value)).toBe(true);
            // No numeric token starts before the recorded value.
            expect(firstNumericPos(s)).toBeGreaterThanOrEqual(pos);
            break;
          }
          case 'keyword-highlight': {
            // Req 3.7: 1 to 3 keywords taken from the sentence.
            const { keywords } = result.data;
            expect(keys).toEqual(['keywords']);
            expect(keywords.length).toBeGreaterThanOrEqual(1);
            expect(keywords.length).toBeLessThanOrEqual(3);
            for (const k of keywords) {
              expect(typeof k).toBe('string');
              expect(s).toContain(k);
            }
            break;
          }
          case 'quote': {
            // Req 3.8: text inside the quotation delimiters.
            const { quote: q } = result.data;
            expect(keys).toEqual(['quote']);
            expect(q.length).toBeGreaterThan(0);
            expect(q).toBe(q.trim());
            expect(isDelimitedQuote(s, q)).toBe(true);
            break;
          }
          case 'timeline': {
            // Req 3.9: matched year, date, or sequence marker from the sentence.
            const { label } = result.data;
            expect(keys).toEqual(['label']);
            expect(s).toContain(label);
            expect(TIMELINE_SHAPES.some((re) => re.test(label))).toBe(true);
            break;
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
