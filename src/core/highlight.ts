/**
 * Keyword marking shared by the DOM preview and the canvas painter.
 * Same matching as the MVP `highlightKeywords` in SceneView: every occurrence
 * of any non-empty keyword, longest keyword first at each position, scanning
 * left to right without overlaps.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns sorted, non-overlapping, non-empty `[start, end)` ranges (UTF-16
 * indexes into `text`) of keyword occurrences. Empty keywords are ignored.
 */
export function highlightRanges(text: string, keywords: readonly string[]): Array<[number, number]> {
  const terms = keywords.filter((k) => k.length > 0);
  if (terms.length === 0 || text.length === 0) return [];
  const pattern = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const re = new RegExp(pattern, 'gu');
  const ranges: Array<[number, number]> = [];
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    ranges.push([start, start + m[0].length]);
  }
  return ranges;
}

export interface HighlightPart {
  text: string;
  highlight: boolean;
}

/** Splits `text` into alternating plain and highlighted parts; empty parts are omitted. */
export function splitHighlights(text: string, keywords: readonly string[]): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let pos = 0;
  for (const [start, end] of highlightRanges(text, keywords)) {
    if (start > pos) parts.push({ text: text.slice(pos, start), highlight: false });
    parts.push({ text: text.slice(start, end), highlight: true });
    pos = end;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), highlight: false });
  return parts;
}
