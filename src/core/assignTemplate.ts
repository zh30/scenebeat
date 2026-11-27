import type { SceneDataByTemplate, SceneTemplate } from './types';

/** Result of template assignment: the template plus its template-specific data. */
export type TemplateAssignment = {
  [T in SceneTemplate]: { template: T; data: SceneDataByTemplate[T] };
}[SceneTemplate];

// ---------------------------------------------------------------------------
// Rule 1: quote
// ---------------------------------------------------------------------------

const QUOTE_RE = /"([^"]*)"|“([^”]*)”|「([^」]*)」|『([^』]*)』/g;

/** Returns the trimmed inner text of the first quotation with non-empty inner text, or null. */
export function matchQuote(sentence: string): string | null {
  const re = new RegExp(QUOTE_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    const inner = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
    if (inner.length > 0) return inner;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 2: timeline
// ---------------------------------------------------------------------------

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December|' +
  'Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec';

// Alternatives are ordered so that, at the same start position, the longer form wins.
const TIMELINE_RE = new RegExp(
  [
    // Chinese dates: 2025年3月5日, 2025年, 3月5日
    String.raw`\d+年(?:\d+月(?:\d+日)?)?`,
    String.raw`\d+月\d+日`,
    // ISO date: 2025-03-05
    String.raw`\b\d{4}-\d{1,2}-\d{1,2}\b`,
    // M/D or M/D/Y
    String.raw`\b(?:0?[1-9]|1[0-2])/(?:0?[1-9]|[12]\d|3[01])(?:/\d{2,4})?\b`,
    // English month name followed by a day or year: March 5, March 5, 2025, May 2025
    String.raw`\b(?:${MONTHS})\.?\s+\d{1,4}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b`,
    // Four-digit year 1000-2999
    String.raw`\b[12]\d{3}\b`,
    // English sequence markers
    String.raw`\b(?:after\s+that|first|then|next|finally)\b`,
    // Chinese sequence markers
    '首先|然后|接着|最后|之后',
  ].join('|'),
  'i',
);

/** Returns the first matched year, date, or sequence marker, or null. */
export function matchTimeline(sentence: string): string | null {
  const m = TIMELINE_RE.exec(sentence);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------
// Rule 3: big-number
// ---------------------------------------------------------------------------

const NUM = String.raw`\d+(?:[,，]\d{3})*(?:\.\d+)?`;
const BIG_NUMBER_RE = new RegExp(
  [
    // Currency prefix: $3.5 million, ¥100万
    String.raw`[$¥€£]\s?${NUM}(?:\s?(?:万|亿|千|million|billion|thousand|[kKMB]\b))?`,
    // Arabic number with optional percent, currency suffix, or unit
    String.raw`${NUM}(?:\s?(?:%|％|万元|亿元|元|万|亿|倍))?`,
    // Chinese numeral followed by a unit
    '[零〇一二两三四五六七八九十百千]+[万亿倍%％]+',
  ].join('|'),
);

/** Returns the first matched numeric value, or null. */
export function matchBigNumber(sentence: string): string | null {
  const m = BIG_NUMBER_RE.exec(sentence);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------
// Rule 4: keyword-highlight
// ---------------------------------------------------------------------------

const EN_STOPWORDS = new Set([
  'about', 'after', 'also', 'been', 'before', 'being', 'could', 'does', 'from', 'have',
  'here', 'into', 'just', 'like', 'more', 'most', 'much', 'only', 'over', 'should',
  'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'those', 'very', 'were', 'what', 'when', 'where', 'which', 'while', 'will',
  'with', 'would', 'your', 'yours',
]);

const EN_WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;
const HAN_RUN_RE = /\p{Script=Han}+/gu;
const ANY_TOKEN_RE = /[\p{L}\p{N}]+/u;

interface Candidate {
  text: string;
  pos: number;
  len: number;
}

function codePointLength(s: string): number {
  return [...s].length;
}

function segmentHanRun(run: string): { text: string; offset: number }[] {
  const Seg = typeof Intl !== 'undefined' ? Intl.Segmenter : undefined;
  if (typeof Seg === 'function') {
    const out: { text: string; offset: number }[] = [];
    for (const s of new Seg('zh', { granularity: 'word' }).segment(run)) {
      if (s.isWordLike !== false) out.push({ text: s.segment, offset: s.index });
    }
    return out;
  }
  // Fallback: consecutive 2-character chunks (by code point).
  const chars = [...run];
  const out: { text: string; offset: number }[] = [];
  let offset = 0;
  for (let i = 0; i < chars.length; i += 2) {
    const text = chars.slice(i, i + 2).join('');
    out.push({ text, offset });
    offset += text.length;
  }
  return out;
}

/** Picks 1 to 3 keywords that occur in the sentence. */
export function extractKeywords(sentence: string): string[] {
  const candidates: Candidate[] = [];

  for (const m of sentence.matchAll(EN_WORD_RE)) {
    const word = m[0].replace(/['’-]+$/, '');
    if (word.length >= 4 && !EN_STOPWORDS.has(word.toLowerCase())) {
      candidates.push({ text: word, pos: m.index ?? 0, len: word.length });
    }
  }

  for (const m of sentence.matchAll(HAN_RUN_RE)) {
    const base = m.index ?? 0;
    for (const seg of segmentHanRun(m[0])) {
      const len = codePointLength(seg.text);
      if (len >= 2) candidates.push({ text: seg.text, pos: base + seg.offset, len });
    }
  }

  candidates.sort((a, b) => b.len - a.len || a.pos - b.pos);

  const keywords: string[] = [];
  for (const c of candidates) {
    if (!keywords.includes(c.text)) keywords.push(c.text);
    if (keywords.length === 3) break;
  }
  if (keywords.length > 0) return keywords;

  const first = ANY_TOKEN_RE.exec(sentence);
  return [first ? first[0] : sentence.trim()];
}

// ---------------------------------------------------------------------------
// Rule chain
// ---------------------------------------------------------------------------

/**
 * Assigns exactly one template to a sentence. Rules are evaluated in fixed order
 * (quote, timeline, big-number, keyword-highlight); the first match wins.
 * Pure and deterministic.
 */
export function assignTemplate(sentence: string): TemplateAssignment {
  const quote = matchQuote(sentence);
  if (quote !== null) return { template: 'quote', data: { quote } };

  const label = matchTimeline(sentence);
  if (label !== null) return { template: 'timeline', data: { label } };

  const value = matchBigNumber(sentence);
  if (value !== null) return { template: 'big-number', data: { value } };

  return { template: 'keyword-highlight', data: { keywords: extractKeywords(sentence) } };
}
