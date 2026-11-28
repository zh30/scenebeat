import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FontSpec } from '../src/core/sceneLayout';
import { FONT_FAMILY } from '../src/core/sceneTheme';
import {
  MEASURE_CACHE_LIMIT,
  createBrowserMeasure,
  createCanvasMeasure,
  fallbackMeasure,
} from '../src/video/measure';

const F100: FontSpec = { sizePx: 100, weight: 400 };

/** Fake context: width = text length * 10, records font at each measureText call. */
function fakeCtx() {
  const calls: Array<{ text: string; font: string }> = [];
  const ctx = {
    font: '10px sans-serif',
    measureText(text: string) {
      calls.push({ text, font: ctx.font });
      return { width: text.length * 10 };
    },
  };
  return { ctx, calls };
}

describe('fallbackMeasure', () => {
  it('counts wide code points at full size and others at 0.55', () => {
    expect(fallbackMeasure('中文', F100)).toBe(200);
    expect(fallbackMeasure('ひらカタ', F100)).toBe(400);
    expect(fallbackMeasure('，。', F100)).toBe(200); // full-width / CJK punctuation
    expect(fallbackMeasure('ab', F100)).toBeCloseTo(110);
    expect(fallbackMeasure('a中', F100)).toBeCloseTo(155);
    expect(fallbackMeasure('', F100)).toBe(0);
  });

  it('counts by code point, not UTF-16 unit', () => {
    expect(fallbackMeasure('😀', F100)).toBeCloseTo(55);
  });

  it('scales with font size and is deterministic', () => {
    const t = 'Revenue 增长 45%';
    const a = fallbackMeasure(t, { sizePx: 40, weight: 800 });
    expect(fallbackMeasure(t, { sizePx: 40, weight: 800 })).toBe(a);
    expect(fallbackMeasure(t, { sizePx: 80, weight: 800 })).toBeCloseTo(a * 2);
  });
});

describe('createCanvasMeasure', () => {
  it('sets the font string and returns measureText width', () => {
    const { ctx, calls } = fakeCtx();
    const measure = createCanvasMeasure(ctx);
    expect(measure('hello', { sizePx: 76, weight: 650 })).toBe(50);
    expect(calls).toEqual([{ text: 'hello', font: `650 76px ${FONT_FAMILY}` }]);
  });

  it('caches by font and text', () => {
    const { ctx, calls } = fakeCtx();
    const measure = createCanvasMeasure(ctx);
    measure('abc', F100);
    measure('abc', F100);
    expect(calls).toHaveLength(1);
    measure('abc', { sizePx: 100, weight: 800 });
    measure('abcd', F100);
    expect(calls).toHaveLength(3);
    expect(calls[1].font).toBe(`800 100px ${FONT_FAMILY}`);
  });

  it('clears the cache beyond the limit and keeps measuring correctly', () => {
    const { ctx, calls } = fakeCtx();
    const measure = createCanvasMeasure(ctx);
    measure('first', F100);
    for (let i = 0; i < MEASURE_CACHE_LIMIT; i++) measure(`t${i}`, F100);
    const before = calls.length;
    expect(measure('first', F100)).toBe(50); // evicted, measured again
    expect(calls.length).toBe(before + 1);
  });
});

describe('createBrowserMeasure', () => {
  afterEach(() => vi.restoreAllMocks());

  it('falls back when no 2D context exists (jsdom)', () => {
    expect(createBrowserMeasure(document)).toBe(fallbackMeasure);
  });

  it('falls back when getContext throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(createBrowserMeasure(document)).toBe(fallbackMeasure);
  });

  it('uses the canvas context when available', () => {
    const { ctx, calls } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const measure = createBrowserMeasure(document);
    expect(measure).not.toBe(fallbackMeasure);
    expect(measure('xyz', F100)).toBe(30);
    expect(calls).toHaveLength(1);
  });
});
