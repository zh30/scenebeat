// Feature: scenebeat-edit-export, Property 49: Layout picks the largest fitting scale, else truncates at 40%.
// For any scene, Aspect_Ratio, and measure function as in Property 48, if some
// scale in 1.0, 0.9, ..., 0.4 fits, layoutScene uses the largest such scale
// and truncated is false, and no larger scale fits; if none fits, it uses
// scale 0.4, truncated is true, and the last kept line ends with '…'.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { layoutScene, wrapText, type MeasureText } from '../../src/core/sceneLayout';
import { ASPECT_RATIOS, type AspectRatioId } from '../../src/core/aspectRatio';
import {
  BLOCK_GAP_PX,
  QUOTE_MARK_HEIGHT_FACTOR,
  TEMPLATE_BLOCKS,
  TIMELINE_DECORATION_PX,
} from '../../src/core/sceneTheme';
import { applyOverrides } from '../../src/core/overrides';
import { deriveData } from '../../src/core/deriveData';
import { computeDuration } from '../../src/core/duration';
import type { Scene } from '../../src/core/types';
import { measureFn, sceneTemplate, storyboardWithOverrides } from './arbitraries';

/** The seven candidate scales, written out from the requirement text. */
const SCALES = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

const ratioId: fc.Arbitrary<AspectRatioId> = fc.constantFrom(...ASPECT_RATIOS.map((r) => r.id));

/** Scenes from transcripts with overrides applied. */
const editedScene: fc.Arbitrary<Scene> = storyboardWithOverrides
  .map(({ auto, overrides }) => applyOverrides(auto.scenes, overrides))
  .filter((scenes) => scenes.length > 0)
  .chain((scenes) => fc.constantFrom(...scenes));

/** Very long English, CJK, emoji, and unbroken-token texts with a forced template. */
const longPiece = fc.constantFrom(
  'Revenue grew fast this year ',
  '我们今天讨论内容创作的未来',
  'Supercalifragilisticexpialidocious',
  '😀🎬',
  '2025 45% ',
  '「保持好奇」',
);
const longScene: fc.Arbitrary<Scene> = fc
  .array(fc.tuple(longPiece, fc.integer({ min: 1, max: 120 })), { minLength: 1, maxLength: 4 })
  .map((parts) => parts.map(([p, n]) => p.repeat(n)).join('').trim())
  .filter((t) => t !== '')
  .chain((text) =>
    sceneTemplate.map(
      (template): Scene => ({
        index: 0,
        text,
        template,
        templateSource: 'manual',
        durationMs: computeDuration(text),
        data: deriveData(template, text),
      }),
    ),
  );

const scene: fc.Arbitrary<Scene> = fc.oneof(editedScene, longScene);

/** Text drawn by each block, per the design's layout step 2. */
function blockTexts(s: Scene): string[] {
  const d = s.data as unknown as Record<string, unknown>;
  return TEMPLATE_BLOCKS[s.template].map((typo) => {
    switch (typo.role) {
      case 'value':
      case 'quote':
      case 'label':
        return d[typo.role] as string;
      case 'keywords':
      case 'caption':
        return s.text;
    }
  });
}

/** Reference fit test: Σ(decoration + lines * lineHeight) + gap * (blocks - 1) <= safe height. */
function fitsAt(s: Scene, ratio: AspectRatioId, scale: number, measure: MeasureText): boolean {
  const spec = ASPECT_RATIOS.find((r) => r.id === ratio)!;
  // Safe_Area: 6% insets on each side.
  const safeW = spec.width - 2 * (spec.width * 0.06);
  const safeH = spec.height - 2 * (spec.height * 0.06);
  const texts = blockTexts(s);
  const blocks = TEMPLATE_BLOCKS[s.template];
  let h = BLOCK_GAP_PX * scale * (blocks.length - 1);
  blocks.forEach((typo, i) => {
    const font = { sizePx: Math.round(typo.sizePx * scale), weight: typo.weight };
    const lines = wrapText(texts[i], safeW * typo.maxWidthFactor, font, measure).length;
    let deco = 0;
    if (s.template === 'quote' && typo.role === 'quote') deco = QUOTE_MARK_HEIGHT_FACTOR * font.sizePx;
    if (s.template === 'timeline' && typo.role === 'label') deco = TIMELINE_DECORATION_PX * scale;
    h += deco + lines * font.sizePx * typo.lineHeight;
  });
  return h <= safeH;
}

describe('Property 49: Layout picks the largest fitting scale, else truncates at 40%', () => {
  /** **Validates: Requirements 13.11, 13.12** */
  it('uses the largest fitting scale, or 0.4 with an ellipsis when none fits', () => {
    let truncatedRuns = 0;
    fc.assert(
      fc.property(scene, ratioId, measureFn, (s, ratio, measure) => {
        const layout = layoutScene(s, ratio, measure as MeasureText);
        const firstFit = SCALES.find((k) => fitsAt(s, ratio, k, measure as MeasureText));

        if (firstFit !== undefined) {
          expect(layout.truncated).toBe(false);
          expect(layout.scale).toBe(firstFit);
          for (const k of SCALES) {
            if (k > layout.scale) expect(fitsAt(s, ratio, k, measure as MeasureText)).toBe(false);
          }
        } else {
          truncatedRuns++;
          expect(layout.scale).toBe(0.4);
          expect(layout.truncated).toBe(true);
          const kept = layout.blocks.filter((b) => b.lines.length > 0);
          expect(kept.length).toBeGreaterThan(0);
          const lastBlock = kept[kept.length - 1];
          const lastLine = lastBlock.lines[lastBlock.lines.length - 1];
          expect(lastLine.text.endsWith('…')).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
    // The generators must reach the truncation branch, not only the fitting one.
    expect(truncatedRuns).toBeGreaterThan(0);
  });
});
