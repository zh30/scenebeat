// Feature: scenebeat-edit-export, Property 32: Edit operations record edits as specified.
// For any Automatic_Scene, rank, override set, Scene_Template t, and raw string r:
// setManualTemplate yields an override for the scene with manualTemplate = t (also
// when t equals the automatic template); setEditedText with r returns
// { ok: false, error: "Scene text can't be empty." } and leaves the set unchanged
// when normalizeEditedText(r) is empty, removes editedText when the normalized text
// equals the Source_Text, and otherwise records editedText = normalizeEditedText(r),
// which contains no CR or LF and equals its own trimmed form.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  EMPTY_TEXT_MESSAGE,
  normalizeEditedText,
  overrideKey,
  setEditedText,
  setManualTemplate,
} from '../../src/core/overrides';
import type { Scene, SceneOverrides, SceneTemplate } from '../../src/core/types';
import { editedText, liveKeyPairs, sceneTemplate, storyboardWithOverrides } from './arbitraries';

/** Reference normalization written from Requirement 2.2: line breaks become spaces, then trim. */
function modelNormalize(raw: string): string {
  return raw.split('\r\n').join(' ').split('\r').join(' ').split('\n').join(' ').trim();
}

interface Case {
  auto: Scene;
  rank: number;
  overrides: SceneOverrides;
  template: SceneTemplate;
  raw: string;
}

// Raw input: arbitrary edited text, whitespace or line breaks only, or the
// Source_Text with its spaces turned into line breaks and padded edges.
const rawFor = (source: string): fc.Arbitrary<string> =>
  fc.oneof(
    { weight: 3, arbitrary: editedText },
    {
      weight: 1,
      arbitrary: fc
        .array(fc.constantFrom(' ', '\t', '\n', '\r\n', '\r', '\u3000'), { maxLength: 6 })
        .map((p) => p.join('')),
    },
    {
      weight: 2,
      arbitrary: fc
        .tuple(
          fc.constantFrom('', ' ', '\n', '\r\n ', '\t'),
          fc.boolean(),
          fc.constantFrom('', ' ', '\n', ' \r'),
        )
        .map(([a, breaks, b]) => a + (breaks ? source.split(' ').join('\n') : source) + b),
    },
  );

const editCase: fc.Arbitrary<Case> = storyboardWithOverrides
  .filter(({ auto }) => auto.scenes.length > 0)
  .chain(({ auto, overrides }) => {
    const pairs = liveKeyPairs(auto.scenes);
    return fc.integer({ min: 0, max: auto.scenes.length - 1 }).chain((i) =>
      fc.record({
        auto: fc.constant(auto.scenes[i]),
        rank: fc.constant(pairs[i][1]),
        overrides: fc.constant(overrides),
        template: fc.oneof(fc.constant(auto.scenes[i].template), sceneTemplate),
        raw: rawFor(auto.scenes[i].text),
      }),
    );
  });

/** Every key other than `key` maps to the same override object as before. */
function othersUnchanged(before: SceneOverrides, after: SceneOverrides, key: string): void {
  const b = Object.keys(before).filter((k) => k !== key).sort();
  const a = Object.keys(after).filter((k) => k !== key).sort();
  expect(a).toEqual(b);
  for (const k of b) expect(after[k]).toBe(before[k]);
}

describe('Property 32: Edit operations record edits as specified', () => {
  /**
   * **Validates: Requirements 1.3, 2.2, 2.7, 2.9**
   */
  it('setManualTemplate and setEditedText record edits per the rules', () => {
    fc.assert(
      fc.property(editCase, ({ auto, rank, overrides, template, raw }) => {
        const key = overrideKey(auto.text, rank);
        const snapshot = JSON.stringify(overrides);
        const prev = Object.prototype.hasOwnProperty.call(overrides, key)
          ? overrides[key]
          : undefined;

        // setManualTemplate (Requirement 1.3)
        const afterTemplate = setManualTemplate(overrides, auto, rank, template);
        const ovT = afterTemplate[key];
        expect(ovT).toBeDefined();
        expect(ovT.manualTemplate).toBe(template);
        expect(ovT.sourceText).toBe(auto.text);
        expect(ovT.rank).toBe(rank);
        expect(ovT.editedText).toBe(prev?.editedText);
        othersUnchanged(overrides, afterTemplate, key);
        expect(JSON.stringify(overrides)).toBe(snapshot);

        // setEditedText (Requirements 2.2, 2.7, 2.9)
        const n = modelNormalize(raw);
        expect(normalizeEditedText(raw)).toBe(n);
        const result = setEditedText(overrides, auto, rank, raw);
        expect(JSON.stringify(overrides)).toBe(snapshot);

        if (n === '') {
          expect(result).toEqual({ ok: false, error: EMPTY_TEXT_MESSAGE });
          expect(result.ok ? null : result.error).toBe("Scene text can't be empty.");
          return;
        }
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const after = result.overrides;
        othersUnchanged(overrides, after, key);
        const ovE = Object.prototype.hasOwnProperty.call(after, key) ? after[key] : undefined;

        if (n === auto.text) {
          // Equal to the Source_Text: editedText removed; override kept only for a manual template.
          if (prev?.manualTemplate !== undefined) {
            expect(ovE).toEqual({ sourceText: auto.text, rank, manualTemplate: prev.manualTemplate });
          } else {
            expect(ovE).toBeUndefined();
          }
        } else {
          expect(ovE).toBeDefined();
          expect(ovE!.editedText).toBe(n);
          expect(ovE!.editedText).not.toMatch(/[\r\n]/);
          expect(ovE!.editedText).toBe(ovE!.editedText!.trim());
          expect(ovE!.sourceText).toBe(auto.text);
          expect(ovE!.rank).toBe(rank);
          expect(ovE!.manualTemplate).toBe(prev?.manualTemplate);
        }
      }),
      { numRuns: 200 },
    );
  });
});
