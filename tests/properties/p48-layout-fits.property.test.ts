// Feature: scenebeat-edit-export, Property 48: Layout stays inside the Safe_Area and keeps the text.
// For any scene (generated from transcripts and overrides, including very long
// English and CJK texts and unbroken tokens), any Aspect_Ratio, and any measure
// function from a generated family (per-code-point widths between 0.3 and 1.2
// times the font size), every line of layoutScene has width at most its
// block's max width and at most the Safe_Area width, every line box lies within
// the Safe_Area, the total stacked height is at most the Safe_Area height, and
// when truncated is false each block's lines concatenate to exactly the
// block's text.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ASPECT_RATIOS, type AspectRatioId } from '../../src/core/aspectRatio';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { buildEditedStoryboard } from '../../src/core/editedStoryboard';
import { applyOverride } from '../../src/core/overrides';
import { layoutScene, type BlockRole } from '../../src/core/sceneLayout';
import type { Scene } from '../../src/core/types';
import { FIXED_CREATED_AT, measureFn, sceneTemplate, storyboardWithOverrides } from './arbitraries';

const EPS = 1e-6;

const ratioId: fc.Arbitrary<AspectRatioId> = fc.constantFrom(...ASPECT_RATIOS.map((r) => r.id));

/** Scenes from real transcripts with overrides applied. */
const transcriptScene: fc.Arbitrary<Scene> = storyboardWithOverrides
  .map(({ auto, overrides }) => buildEditedStoryboard(auto, overrides).scenes)
  .filter((scenes) => scenes.length > 0)
  .chain((scenes) => fc.constantFrom(...scenes));

const englishWord = fc.constantFrom(
  'revenue', 'grew', 'the', 'and', 'important', 'podcast', 'creator', 'I', '45%', '2025', 'first',
  'supercalifragilisticexpialidocious',
);
const cjkChar = fc.constantFrom('中', '文', '我', '们', '年', '月', '日', '万', '亿', '倍', '内', '容', '创', '作', '，', '。');

/** Long English, long CJK, unbroken tokens, and mixes of them. */
const longText: fc.Arbitrary<string> = fc.oneof(
  fc.array(englishWord, { minLength: 50, maxLength: 600 }).map((w) => w.join(' ')),
  fc.array(cjkChar, { minLength: 100, maxLength: 1000 }).map((c) => c.join('')),
  fc
    .array(fc.constantFrom('a', 'b', 'W', 'm', '0', '9', '-'), { minLength: 50, maxLength: 800 })
    .map((c) => c.join('')),
  fc
    .array(fc.oneof(englishWord, cjkChar, fc.constantFrom('😀', '👨‍👩‍👧', '"', '「', '」')), {
      minLength: 20,
      maxLength: 600,
    })
    .map((p) => p.join(' ')),
).map((s) => s.trim()).filter((s) => s !== '');

/** A long-text scene: an edited text on a base Automatic_Scene, optionally with a forced template. */
const longScene: fc.Arbitrary<Scene> = fc
  .tuple(longText, fc.option(sceneTemplate, { nil: undefined }))
  .map(([text, manualTemplate]) => {
    const base = buildStoryboard('Base sentence.', FIXED_CREATED_AT).scenes[0];
    const ov = { sourceText: base.text, rank: 0, editedText: text, ...(manualTemplate ? { manualTemplate } : {}) };
    return applyOverride(base, ov);
  });

const scene: fc.Arbitrary<Scene> = fc.oneof(transcriptScene, longScene);

/** Expected block text per role, from the scene's text and data. */
function expectedBlockText(s: Scene, role: BlockRole): string {
  const data = s.data as unknown as Record<string, unknown>;
  switch (role) {
    case 'value':
      return data.value as string;
    case 'quote':
      return data.quote as string;
    case 'label':
      return data.label as string;
    case 'keywords':
    case 'caption':
      return s.text;
  }
}

describe('Property 48: Layout stays inside the Safe_Area and keeps the text', () => {
  /** **Validates: Requirements 13.10, 13.13** */
  it('keeps every line inside the Safe_Area and the text intact when not truncated', () => {
    fc.assert(
      fc.property(scene, ratioId, measureFn, (s, ratio, measure) => {
        const layout = layoutScene(s, ratio, measure);
        const safe = layout.safe;

        let stacked = 0;
        layout.blocks.forEach((block, bi) => {
          if (bi > 0) stacked += layout.blocks[bi].rect.y - (layout.blocks[bi - 1].rect.y + layout.blocks[bi - 1].rect.height);
          stacked += block.decorationHeight + block.lines.length * block.lineHeightPx;

          for (const line of block.lines) {
            expect(line.width).toBeLessThanOrEqual(block.maxWidth + EPS);
            expect(line.width).toBeLessThanOrEqual(safe.width + EPS);
            const top = line.baseline - block.lineHeightPx * 0.8;
            expect(line.x).toBeGreaterThanOrEqual(safe.x - EPS);
            expect(line.x + line.width).toBeLessThanOrEqual(safe.x + safe.width + EPS);
            expect(top).toBeGreaterThanOrEqual(safe.y - EPS);
            expect(top + block.lineHeightPx).toBeLessThanOrEqual(safe.y + safe.height + EPS);
          }
          // Decoration area also sits inside the Safe_Area.
          expect(block.rect.y).toBeGreaterThanOrEqual(safe.y - EPS);
          expect(block.rect.y + block.rect.height).toBeLessThanOrEqual(safe.y + safe.height + EPS);
        });
        expect(stacked).toBeLessThanOrEqual(safe.height + EPS);
        expect(layout.stack.height).toBeLessThanOrEqual(safe.height + EPS);

        if (!layout.truncated) {
          for (const block of layout.blocks) {
            expect(block.lines.map((l) => l.text).join('')).toBe(expectedBlockText(s, block.role));
          }
        }
      }),
      { numRuns: 150 },
    );
  });
});
