import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assignTemplate } from '../../src/core/assignTemplate';
import { TEMPLATES, type SceneTemplate } from '../../src/core/types';

/**
 * Feature: scenebeat-mvp, Property 6: Template assignment follows precedence
 *
 * For any sentence, assignTemplate returns exactly one template from the four
 * identifiers, and that template equals the first matching rule in the order
 * quote, timeline, big-number, keyword-highlight, as determined by an
 * independent reference predicate for each rule.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * Two complementary checks:
 * 1. Structured sentences are built from labelled fragments (quote, timeline,
 *    number, filler). The reference predicate for each rule is "a fragment of
 *    that kind is present", which is independent of the implementation's
 *    regexes. Filler fragments are chosen so they cannot trigger any rule.
 * 2. Arbitrary strings over a feature-rich alphabet are checked against
 *    string-level reference predicates: a pair-scanning quote detector, and a
 *    conservative "no rule can fire" detector for the keyword fallback.
 */

// ---------------------------------------------------------------------------
// Structured generator
// ---------------------------------------------------------------------------

type Kind = 'quote' | 'timeline' | 'number' | 'filler';
interface Fragment {
  kind: Kind;
  text: string;
}

// English filler: no sequence markers, month names, or digits.
const EN_FILLER = [
  'product', 'design', 'users', 'growth', 'team', 'story', 'launch', 'people',
  'simple', 'idea', 'video', 'creator', 'the', 'and', 'we', 'built', 'really',
  'matters', 'because', 'quality',
];
// Chinese filler: excludes 年月日, numerals, units, and marker characters.
const ZH_FILLER_CHARS = [...'我们今天讨论产品设计团队用户体验很重要的问题'];

const enWordArb = fc.constantFrom(...EN_FILLER);
const zhRunArb = fc
  .array(fc.constantFrom(...ZH_FILLER_CHARS), { minLength: 2, maxLength: 6 })
  .map((cs) => cs.join(''));
const fillerTextArb = fc.oneof(enWordArb, zhRunArb);

const fillerArb: fc.Arbitrary<Fragment> = fillerTextArb.map((text) => ({ kind: 'filler', text }));

// Empty or whitespace-only quotations do not qualify for `quote`.
const emptyQuoteArb: fc.Arbitrary<Fragment> = fc
  .constantFrom('""', '" "', '“”', '“ ”', '「」', '『 』')
  .map((text) => ({ kind: 'filler', text }));

const QUOTE_PAIRS: [string, string][] = [
  ['"', '"'],
  ['“', '”'],
  ['「', '」'],
  ['『', '』'],
];
const quoteArb: fc.Arbitrary<Fragment> = fc
  .tuple(
    fc.constantFrom(...QUOTE_PAIRS),
    fc.array(fillerTextArb, { minLength: 1, maxLength: 3 }),
    fc.constantFrom('', ' '),
  )
  .map(([[open, close], words, pad]) => ({
    kind: 'quote',
    text: `${open}${pad}${words.join(' ')}${pad}${close}`,
  }));

const randomCase = (word: string) =>
  fc
    .array(fc.boolean(), { minLength: word.length, maxLength: word.length })
    .map((flags) => [...word].map((c, i) => (flags[i] ? c.toUpperCase() : c)).join(''));

const pad2 = (n: number) => String(n).padStart(2, '0');

const timelineArb: fc.Arbitrary<Fragment> = fc
  .oneof(
    fc.integer({ min: 1000, max: 2999 }).map(String),
    fc.integer({ min: 1, max: 3000 }).map((n) => `${n}年`),
    fc
      .tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
      .map(([m, d]) => `${m}月${d}日`),
    fc
      .tuple(
        fc.integer({ min: 1000, max: 2999 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
      )
      .map(([y, m, d]) => `${y}-${pad2(m)}-${pad2(d)}`),
    fc
      .tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }))
      .map(([m, d]) => `${m}/${d}`),
    fc
      .tuple(
        fc.constantFrom('January', 'March', 'October', 'Dec', 'Sept'),
        fc.integer({ min: 1, max: 31 }),
      )
      .map(([mon, d]) => `${mon} ${d}`),
    fc.constantFrom('first', 'then', 'next', 'finally', 'after that').chain(randomCase),
    fc.constantFrom('首先', '然后', '接着', '最后', '之后'),
  )
  .map((text) => ({ kind: 'timeline', text }));

// Integers avoid 1000-2999 so a bare number never reads as a year.
const nonYearIntArb = fc.oneof(
  fc.integer({ min: 0, max: 999 }),
  fc.integer({ min: 3000, max: 9999 }),
  fc.integer({ min: 10000, max: 9_999_999 }),
);
const numberArb: fc.Arbitrary<Fragment> = fc
  .oneof(
    nonYearIntArb.map(String),
    nonYearIntArb.map((n) => `${n}%`),
    nonYearIntArb.map((n) => `$${n}`),
    nonYearIntArb.map((n) => `¥${n}`),
    nonYearIntArb.map((n) => `${n}元`),
    fc
      .tuple(fc.integer({ min: 0, max: 999 }), fc.integer({ min: 0, max: 99 }))
      .map(([a, b]) => `${a}.${b}`),
    fc.constantFrom('三倍', '五十万', '两亿', '十%', '一百万'),
  )
  .map((text) => ({ kind: 'number', text }));

const fragmentArb = fc.oneof(
  { arbitrary: fillerArb, weight: 6 },
  { arbitrary: emptyQuoteArb, weight: 1 },
  { arbitrary: quoteArb, weight: 1 },
  { arbitrary: timelineArb, weight: 1 },
  { arbitrary: numberArb, weight: 1 },
);

const structuredSentenceArb = fc
  .tuple(
    fc.array(fragmentArb, { minLength: 1, maxLength: 8 }),
    fc.constantFrom('', '.', '。', '!', '?', '！'),
  )
  .map(([fragments, end]) => ({
    fragments,
    text: fragments.map((f) => f.text).join(' ') + end,
  }));

function expectedFromFragments(fragments: Fragment[]): SceneTemplate {
  const has = (k: Kind) => fragments.some((f) => f.kind === k);
  if (has('quote')) return 'quote';
  if (has('timeline')) return 'timeline';
  if (has('number')) return 'big-number';
  return 'keyword-highlight';
}

// ---------------------------------------------------------------------------
// String-level reference predicates
// ---------------------------------------------------------------------------

/** Scans each delimiter pair left to right for a quotation with non-blank inner text. */
function refHasQuote(s: string): boolean {
  for (const [open, close] of QUOTE_PAIRS) {
    let from = 0;
    for (;;) {
      const o = s.indexOf(open, from);
      if (o === -1) break;
      const c = s.indexOf(close, o + 1);
      if (c === -1) break;
      if (s.slice(o + 1, c).trim().length > 0) return true;
      from = c + 1;
    }
  }
  return false;
}

const EN_MARKERS = ['first', 'then', 'next', 'finally', 'after'];
const ZH_MARKERS = ['首先', '然后', '接着', '最后', '之后'];
const CN_NUMERALS = new Set([...'零〇一二两三四五六七八九十百千']);
const CN_UNITS = new Set([...'万亿倍%％']);

/**
 * Conservative check: true only when no timeline or big-number rule can fire.
 * Every year, date, and number form needs an ASCII digit, except markers and
 * Chinese numeral-unit pairs, which are checked as plain substrings.
 */
function refNoTimelineOrNumber(s: string): boolean {
  if (/[0-9]/.test(s)) return false;
  const lower = s.toLowerCase();
  if (EN_MARKERS.some((m) => lower.includes(m))) return false;
  if (ZH_MARKERS.some((m) => s.includes(m))) return false;
  const chars = [...s];
  for (let i = 0; i + 1 < chars.length; i++) {
    if (CN_NUMERALS.has(chars[i]) && CN_UNITS.has(chars[i + 1])) return false;
  }
  return true;
}

const ALPHABET = [
  ...'abcdefhnrstxyz ',
  'first', 'then', 'next', 'Finally', 'after that', 'March ',
  ...'0123456789.,%/-$¥',
  ...'我们产品年月日首先然后最后之后三十万倍',
  '"', '“', '”', '「', '」', '『', '』',
];
const arbitrarySentenceArb = fc
  .array(fc.constantFrom(...ALPHABET), { minLength: 0, maxLength: 30 })
  .map((parts) => parts.join(''));

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('Property 6: Template assignment follows precedence', () => {
  it('assigns the first matching rule for sentences built from labelled fragments', () => {
    fc.assert(
      fc.property(structuredSentenceArb, ({ fragments, text }) => {
        const { template } = assignTemplate(text);
        expect(TEMPLATES).toContain(template);
        expect(template).toBe(expectedFromFragments(fragments));
      }),
      { numRuns: 500 },
    );
  });

  it('agrees with string-level reference predicates for arbitrary sentences', () => {
    fc.assert(
      fc.property(arbitrarySentenceArb, (text) => {
        const { template } = assignTemplate(text);
        expect(TEMPLATES).toContain(template);
        if (refHasQuote(text)) {
          expect(template).toBe('quote');
        } else {
          expect(template).not.toBe('quote');
          if (refNoTimelineOrNumber(text)) expect(template).toBe('keyword-highlight');
        }
      }),
      { numRuns: 500 },
    );
  });
});
