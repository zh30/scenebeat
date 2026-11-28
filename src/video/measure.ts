import type { FontSpec, MeasureText } from '../core/sceneLayout';
import { fontString } from '../core/sceneTheme';
import type { FrameContext } from './canvasTypes';

/** The measure cache is cleared once it holds more than this many entries. */
export const MEASURE_CACHE_LIMIT = 5000;

/**
 * Canvas text measurer. Sets `ctx.font` from the FontSpec (same font string
 * the painter uses) and returns `measureText(text).width`, cached by font and text.
 */
export function createCanvasMeasure(ctx: Pick<FrameContext, 'font' | 'measureText'>): MeasureText {
  const cache = new Map<string, number>();
  return (text: string, font: FontSpec): number => {
    const fontStr = fontString(font.sizePx, font.weight);
    const key = `${fontStr}\u0000${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    if (ctx.font !== fontStr) ctx.font = fontStr;
    const width = ctx.measureText(text).width;
    if (cache.size >= MEASURE_CACHE_LIMIT) cache.clear();
    cache.set(key, width);
    return width;
  };
}

/** Han, Hiragana, Katakana, CJK punctuation, and full-width forms. */
const WIDE_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303F\uFF00-\uFFEF]/u;

/** Width factor (times the font size) for non-wide code points. */
export const FALLBACK_NARROW_FACTOR = 0.55;

/**
 * Deterministic estimate used when no 2D context exists (jsdom, locked-down
 * browsers): `sizePx` per wide code point, `0.55 * sizePx` per other code point.
 */
export const fallbackMeasure: MeasureText = (text: string, font: FontSpec): number => {
  let width = 0;
  for (const cp of text) {
    width += WIDE_RE.test(cp) ? font.sizePx : FALLBACK_NARROW_FACTOR * font.sizePx;
  }
  return width;
};

/**
 * Canvas measurer when the document can create a 2D context, else `fallbackMeasure`.
 * The Player and the video renderer share the result so their line breaks match.
 */
export function createBrowserMeasure(doc: Document): MeasureText {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = doc.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  return ctx ? createCanvasMeasure(ctx) : fallbackMeasure;
}
