import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { highlightRanges } from '../src/core/highlight';
import { FONT_FAMILY, THEME_COLORS, THEME_CSS_VARS, type ThemeColorName } from '../src/core/sceneTheme';
import { layoutScene, safeArea, type MeasureText, type SceneLayout } from '../src/core/sceneLayout';
import type { Scene } from '../src/core/types';

/** Deterministic measure: full size per CJK code point, 0.55 x size otherwise. */
const WIDE_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303F\uFF00-\uFFEF]/u;
const measure: MeasureText = (text, font) => {
  let w = 0;
  for (const ch of text) w += (WIDE_RE.test(ch) ? 1 : 0.55) * font.sizePx;
  return w;
};

function keywordScene(text: string, keywords: string[]): Scene {
  return { index: 0, text, template: 'keyword-highlight', durationMs: 2000, data: { keywords } };
}

function stackedHeight(layout: SceneLayout): number {
  return layout.blocks.reduce((h, b) => h + b.rect.height, 0) + 40 * layout.scale * (layout.blocks.length - 1);
}

function expectInsideSafeArea(layout: SceneLayout): void {
  const { safe } = layout;
  expect(stackedHeight(layout)).toBeLessThanOrEqual(safe.height + 1e-6);
  for (const block of layout.blocks) {
    expect(block.rect.y).toBeGreaterThanOrEqual(safe.y - 1e-6);
    expect(block.rect.y + block.rect.height).toBeLessThanOrEqual(safe.y + safe.height + 1e-6);
    for (const line of block.lines) {
      expect(line.width).toBeLessThanOrEqual(block.maxWidth + 1e-6);
      expect(line.x).toBeGreaterThanOrEqual(safe.x - 1e-6);
    }
  }
}

const CJK = '我们今天讨论内容创作与视频的未来发展方向';

describe('layoutScene', () => {
  it('lays out a short sentence at 16:9 at scale 1.0 on one centered line', () => {
    const text = 'Stay curious and keep building.';
    const layout = layoutScene(keywordScene(text, ['curious']), '16:9', measure);

    expect(layout.width).toBe(1920);
    expect(layout.height).toBe(1080);
    expect(layout.safe).toEqual(safeArea(1920, 1080));
    expect(layout.scale).toBe(1);
    expect(layout.truncated).toBe(false);
    expect(layout.blocks).toHaveLength(1);

    const [block] = layout.blocks;
    expect(block.role).toBe('keywords');
    expect(block.font).toEqual({ sizePx: 76, weight: 650 });
    expect(block.lines).toHaveLength(1);
    const [line] = block.lines;
    expect(line.text).toBe(text);
    expect(line.x).toBeCloseTo(layout.safe.x + (layout.safe.width - line.width) / 2, 6);
    expect(line.segments.map((s) => [s.text, s.highlight])).toEqual([
      ['Stay ', false],
      ['curious', true],
      [' and keep building.', false],
    ]);
    // Stack is vertically centered in the Safe_Area.
    expect(layout.stack.y).toBeCloseTo(layout.safe.y + (layout.safe.height - layout.stack.height) / 2, 6);
    expectInsideSafeArea(layout);
  });

  it('fits a 600-character CJK text at 9:16 by shrinking, without truncation', () => {
    const text = CJK.repeat(30); // 600 code points
    expect([...text]).toHaveLength(600);
    const layout = layoutScene(keywordScene(text, ['内容创作']), '9:16', measure);

    expect(layout.scale).toBeLessThan(1);
    expect(layout.truncated).toBe(false);
    expect(layout.blocks[0].lines.map((l) => l.text).join('')).toBe(text);
    expectInsideSafeArea(layout);
  });

  it('truncates a very long CJK text at 9:16 with scale 0.4 and a trailing ellipsis', () => {
    const text = CJK.repeat(100); // 2000 code points
    const layout = layoutScene(keywordScene(text, ['内容创作']), '9:16', measure);

    expect(layout.scale).toBe(0.4);
    expect(layout.truncated).toBe(true);
    const block = layout.blocks[layout.blocks.length - 1];
    const last = block.lines[block.lines.length - 1];
    expect(last.text.endsWith('…')).toBe(true);
    expect(block.lines.slice(0, -1).every((l) => !l.text.includes('…'))).toBe(true);
    expectInsideSafeArea(layout);
  });
});

describe('highlightRanges', () => {
  it('marks every occurrence, longest keyword first, without overlaps', () => {
    expect(highlightRanges('AI and AI tools', ['AI', 'AI tools'])).toEqual([
      [0, 2],
      [7, 15],
    ]);
    expect(highlightRanges('text', ['', 'zzz'])).toEqual([]);
  });
});

describe('sceneTheme', () => {
  const css = readFileSync(resolve(__dirname, '../src/styles/app.css'), 'utf8');
  const cssVar = (name: string): string | undefined =>
    new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css)?.[1].trim();

  it('every mapped theme color equals its CSS custom property in app.css', () => {
    const entries = Object.entries(THEME_CSS_VARS) as Array<[ThemeColorName, string]>;
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, prop] of entries) {
      expect({ prop, value: cssVar(prop)?.toLowerCase() }).toEqual({
        prop,
        value: THEME_COLORS[name].toLowerCase(),
      });
    }
  });

  it('font family equals --sb-font', () => {
    const value = cssVar('--sb-font');
    expect(value?.replace(/\s+/g, ' ')).toBe(FONT_FAMILY);
  });
});
