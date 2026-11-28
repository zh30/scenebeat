/**
 * Canvas_Layout: pure text layout of a Scene inside the Safe_Area of an
 * Aspect_Ratio. Both the DOM preview (SceneView) and the canvas painter consume
 * its output, so line breaks match as long as they share the measure function.
 *
 * Pure given the injected `measure`: no DOM, no canvas, no I/O.
 */
import { getAspectRatio, type AspectRatioId } from './aspectRatio';
import { highlightRanges } from './highlight';
import {
  BLOCK_GAP_PX,
  QUOTE_MARK_HEIGHT_FACTOR,
  TEMPLATE_BLOCKS,
  TIMELINE_DECORATION_PX,
  type BlockTypography,
  type FontWeight,
  type ThemeBlockRole,
} from './sceneTheme';
import type { Scene, SceneTemplate } from './types';

export interface FontSpec {
  sizePx: number;
  weight: FontWeight;
}

/** Width in px of `text` drawn with `font`. */
export type MeasureText = (text: string, font: FontSpec) => number;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BlockRole = ThemeBlockRole;

export interface LineSegment {
  text: string;
  highlight: boolean;
  /** Left x in frame px. */
  x: number;
  width: number;
}

export interface LayoutLine {
  /** Line text as cut from the block text, trailing spaces kept; ends with '…' when truncated. */
  text: string;
  /** Width of text.trimEnd() in px. */
  width: number;
  /** Left x and baseline y in frame px, after centering. */
  x: number;
  baseline: number;
  /** Pieces of text.trimEnd(), split at keyword highlight boundaries. */
  segments: LineSegment[];
}

export interface LayoutBlock {
  role: BlockRole;
  font: FontSpec;
  color: string;
  lineHeightPx: number;
  maxWidth: number;
  rect: Rect;
  lines: LayoutLine[];
  /** Decoration area above the text (quote mark, timeline track), in px; 0 when none. */
  decorationHeight: number;
}

export interface SceneLayout {
  ratio: AspectRatioId;
  width: number;
  height: number;
  safe: Rect;
  /** Chosen font scale: 1.0, 0.9, ..., 0.4. */
  scale: number;
  truncated: boolean;
  blocks: LayoutBlock[];
  /** Bounding box of all blocks; the enter transition scales around its center. */
  stack: Rect;
}

/** Fraction of the frame inset on each side for the Safe_Area. */
const SAFE_INSET = 0.06;
/** Baseline position within a line box, as a fraction of the line height. */
const BASELINE_FACTOR = 0.8;
const ELLIPSIS = '…';

/** Safe_Area: 6% of the width inset left and right, 6% of the height top and bottom. */
export function safeArea(width: number, height: number): Rect {
  const insetX = width * SAFE_INSET;
  const insetY = height * SAFE_INSET;
  return { x: insetX, y: insetY, width: width - 2 * insetX, height: height - 2 * insetY };
}

/** Font scales tried in order, computed as k / 10 to avoid float accumulation. */
export const FIT_SCALES: readonly number[] = Object.freeze([10, 9, 8, 7, 6, 5, 4].map((k) => k / 10));

const MIN_SCALE = FIT_SCALES[FIT_SCALES.length - 1];

/**
 * Tokens: each Han, Hiragana, Katakana, or full-width punctuation code point
 * (plus following spaces) is one token; every other run of non-space
 * characters plus its following spaces is one token. Leading whitespace is its
 * own token so the tokens always concatenate to the input.
 */
const WIDE = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\u3000-\\u303F\\uFF00-\\uFFEF';
const TOKEN_RE = new RegExp(`[${WIDE}]\\s*|[^\\s${WIDE}]+\\s*|\\s+`, 'gu');

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

/**
 * Greedy line wrapping. Lines keep trailing spaces (fit is judged on
 * `trimEnd()`), so the lines concatenate to `text`. A token wider than
 * `maxWidth` on its own is split by code points.
 */
export function wrapText(text: string, maxWidth: number, font: FontSpec, measure: MeasureText): string[] {
  const lines: string[] = [];
  let current = '';
  const fits = (s: string): boolean => measure(s.trimEnd(), font) <= maxWidth;

  for (const token of tokenize(text)) {
    if (fits(current + token)) {
      current += token;
      continue;
    }
    if (current !== '') {
      lines.push(current);
      current = '';
    }
    if (fits(token)) {
      current = token;
      continue;
    }
    for (const cp of token) {
      if (current === '' || fits(current + cp)) {
        current += cp;
      } else {
        lines.push(current);
        current = cp;
      }
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

interface BlockSource {
  typo: BlockTypography;
  text: string;
  /** Keyword ranges in `text`; empty for non-keyword blocks. */
  ranges: Array<[number, number]>;
}

function dataString(data: Scene['data'], key: 'value' | 'quote' | 'label', fallback: string): string {
  const v = (data as unknown as Record<string, unknown>)[key];
  return typeof v === 'string' && v !== '' ? v : fallback;
}

function blockText(scene: Scene, role: BlockRole): { text: string; ranges: Array<[number, number]> } {
  switch (role) {
    case 'value':
      return { text: dataString(scene.data, 'value', scene.text), ranges: [] };
    case 'quote':
      return { text: dataString(scene.data, 'quote', scene.text), ranges: [] };
    case 'label':
      return { text: dataString(scene.data, 'label', scene.text), ranges: [] };
    case 'keywords': {
      const kw = (scene.data as unknown as Record<string, unknown>).keywords;
      const keywords = Array.isArray(kw) ? kw.filter((k): k is string => typeof k === 'string') : [];
      return { text: scene.text, ranges: highlightRanges(scene.text, keywords) };
    }
    case 'caption':
      return { text: scene.text, ranges: [] };
  }
}

function blockSources(scene: Scene): BlockSource[] {
  const template: SceneTemplate = scene.template;
  return TEMPLATE_BLOCKS[template].map((typo) => ({ typo, ...blockText(scene, typo.role) }));
}

function decorationHeight(template: SceneTemplate, role: BlockRole, sizePx: number, scale: number): number {
  if (template === 'quote' && role === 'quote') return QUOTE_MARK_HEIGHT_FACTOR * sizePx;
  if (template === 'timeline' && role === 'label') return TIMELINE_DECORATION_PX * scale;
  return 0;
}

/** A block wrapped at one scale, before positioning. */
interface WrappedBlock {
  source: BlockSource;
  font: FontSpec;
  lineHeightPx: number;
  maxWidth: number;
  decorationHeight: number;
  /** Raw wrapped lines with their start offset in the block text. */
  lines: Array<{ text: string; start: number }>;
  /** True when this line was shortened and ends with the ellipsis. */
  ellipsized: boolean;
}

function wrapBlocks(
  template: SceneTemplate,
  sources: readonly BlockSource[],
  scale: number,
  safe: Rect,
  measure: MeasureText,
): WrappedBlock[] {
  return sources.map((source) => {
    const font: FontSpec = { sizePx: Math.round(source.typo.sizePx * scale), weight: source.typo.weight };
    const maxWidth = safe.width * source.typo.maxWidthFactor;
    let start = 0;
    const lines = wrapText(source.text, maxWidth, font, measure).map((text) => {
      const line = { text, start };
      start += text.length;
      return line;
    });
    return {
      source,
      font,
      lineHeightPx: font.sizePx * source.typo.lineHeight,
      maxWidth,
      decorationHeight: decorationHeight(template, source.typo.role, font.sizePx, scale),
      lines,
      ellipsized: false,
    };
  });
}

function stackHeight(blocks: readonly WrappedBlock[], gap: number): number {
  let h = 0;
  blocks.forEach((b, i) => {
    if (i > 0) h += gap;
    h += b.decorationHeight + b.lines.length * b.lineHeightPx;
  });
  return h;
}

/** Keeps the lines that fit in `maxHeight` and ellipsizes the last kept line. */
function truncateBlocks(
  blocks: readonly WrappedBlock[],
  gap: number,
  maxHeight: number,
  measure: MeasureText,
): WrappedBlock[] {
  const kept: WrappedBlock[] = [];
  let h = 0;
  outer: for (const b of blocks) {
    if (b.lines.length === 0) continue;
    const head = (kept.length > 0 ? gap : 0) + b.decorationHeight;
    const lines: WrappedBlock['lines'] = [];
    let blockH = head;
    for (const line of b.lines) {
      if (h + blockH + b.lineHeightPx > maxHeight) {
        if (lines.length > 0) kept.push({ ...b, lines });
        break outer;
      }
      lines.push(line);
      blockH += b.lineHeightPx;
    }
    if (lines.length === 0) break;
    kept.push({ ...b, lines });
    h += blockH;
  }

  const last = kept[kept.length - 1];
  if (last !== undefined) {
    const lastLine = last.lines[last.lines.length - 1];
    let cps = [...lastLine.text.trimEnd()];
    while (cps.length > 0 && measure(cps.join('').trimEnd() + ELLIPSIS, last.font) > last.maxWidth) {
      cps = cps.slice(0, -1);
    }
    const text = cps.join('').trimEnd() + ELLIPSIS;
    kept[kept.length - 1] = {
      ...last,
      lines: [...last.lines.slice(0, -1), { text, start: lastLine.start }],
      ellipsized: true,
    };
  }
  return kept;
}

function segmentsFor(
  shown: string,
  originalLength: number,
  start: number,
  ranges: ReadonlyArray<[number, number]>,
  x0: number,
  font: FontSpec,
  measure: MeasureText,
): LineSegment[] {
  // Boundaries in `shown` coordinates; text beyond originalLength (the ellipsis) is plain.
  const parts: Array<{ text: string; highlight: boolean }> = [];
  const limit = Math.min(shown.length, originalLength);
  let pos = 0;
  for (const [rs, re] of ranges) {
    const s = Math.max(rs - start, 0);
    const e = Math.min(re - start, limit);
    if (e <= s || s >= limit) continue;
    if (s > pos) parts.push({ text: shown.slice(pos, s), highlight: false });
    parts.push({ text: shown.slice(s, e), highlight: true });
    pos = e;
  }
  if (pos < shown.length) parts.push({ text: shown.slice(pos), highlight: false });

  const segments: LineSegment[] = [];
  let x = x0;
  for (const p of parts) {
    if (p.text === '') continue;
    const width = measure(p.text, font);
    segments.push({ text: p.text, highlight: p.highlight, x, width });
    x += width;
  }
  return segments;
}

function positionBlocks(
  wrapped: readonly WrappedBlock[],
  gap: number,
  safe: Rect,
  measure: MeasureText,
): { blocks: LayoutBlock[]; stack: Rect } {
  const total = stackHeight(wrapped, gap);
  const top = safe.y + (safe.height - total) / 2;
  let cursor = top;
  const blocks: LayoutBlock[] = wrapped.map((b, i) => {
    if (i > 0) cursor += gap;
    const rectY = cursor;
    const textTop = cursor + b.decorationHeight;
    const lines: LayoutLine[] = b.lines.map((raw, li) => {
      const isEllipsisLine = b.ellipsized && li === b.lines.length - 1;
      const shown = raw.text.trimEnd();
      const width = measure(shown, b.font);
      const x = safe.x + (safe.width - width) / 2;
      const lineTop = textTop + li * b.lineHeightPx;
      const originalLength = isEllipsisLine ? shown.length - ELLIPSIS.length : shown.length;
      return {
        text: raw.text,
        width,
        x,
        baseline: lineTop + b.lineHeightPx * BASELINE_FACTOR,
        segments: segmentsFor(shown, originalLength, raw.start, b.source.ranges, x, b.font, measure),
      };
    });
    const height = b.decorationHeight + b.lines.length * b.lineHeightPx;
    cursor += height;
    return {
      role: b.source.typo.role,
      font: b.font,
      color: b.source.typo.color,
      lineHeightPx: b.lineHeightPx,
      maxWidth: b.maxWidth,
      rect: { x: safe.x + (safe.width - b.maxWidth) / 2, y: rectY, width: b.maxWidth, height },
      lines,
      decorationHeight: b.decorationHeight,
    };
  });

  if (blocks.length === 0) {
    return { blocks, stack: { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2, width: 0, height: 0 } };
  }
  const left = Math.min(...blocks.map((b) => b.rect.x));
  const right = Math.max(...blocks.map((b) => b.rect.x + b.rect.width));
  return { blocks, stack: { x: left, y: top, width: right - left, height: total } };
}

/**
 * Lays out a scene for an Aspect_Ratio: picks the largest scale in FIT_SCALES
 * at which all blocks fit the Safe_Area height; otherwise uses 40% and
 * truncates with '…'. The stack is centered vertically and each line
 * horizontally in the Safe_Area.
 */
export function layoutScene(scene: Scene, ratio: AspectRatioId, measure: MeasureText): SceneLayout {
  const spec = getAspectRatio(ratio);
  const safe = safeArea(spec.width, spec.height);
  const sources = blockSources(scene);

  let chosen: { scale: number; wrapped: WrappedBlock[] } | null = null;
  for (const scale of FIT_SCALES) {
    const wrapped = wrapBlocks(scene.template, sources, scale, safe, measure);
    if (stackHeight(wrapped, BLOCK_GAP_PX * scale) <= safe.height) {
      chosen = { scale, wrapped };
      break;
    }
  }

  let scale: number;
  let wrapped: WrappedBlock[];
  let truncated = false;
  if (chosen !== null) {
    ({ scale, wrapped } = chosen);
  } else {
    scale = MIN_SCALE;
    truncated = true;
    wrapped = truncateBlocks(
      wrapBlocks(scene.template, sources, scale, safe, measure),
      BLOCK_GAP_PX * scale,
      safe.height,
      measure,
    );
  }

  const { blocks, stack } = positionBlocks(wrapped, BLOCK_GAP_PX * scale, safe, measure);
  return { ratio, width: spec.width, height: spec.height, safe, scale, truncated, blocks, stack };
}
