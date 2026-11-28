// Feature: scenebeat-edit-export, Property 29: Override merge matches the reference model.
// For any transcript and any set of Scene_Overrides (generated with keys taken
// both from the transcript's (text, rank) pairs and from unrelated pairs, with
// edited texts that may contain Sentence_Terminators, and manual templates that
// may equal the automatic template), applyOverrides(autos, overrides) has the
// same length as autos, has index values 0..n-1 in order, and each scene equals
// a reference model: the Automatic_Scene when no override has its (text, rank),
// and otherwise the scene with text = editedText ?? source,
// template = manualTemplate ?? assignTemplate(text).template,
// data = manualTemplate ? deriveData(manualTemplate, text) : assignTemplate(text).data,
// durationMs = computeDuration(text), and
// templateSource = manualTemplate ? "manual" : "auto".
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { applyOverrides } from '../../src/core/overrides';
import { assignTemplate } from '../../src/core/assignTemplate';
import { deriveData } from '../../src/core/deriveData';
import { computeDuration } from '../../src/core/duration';
import type { Scene, SceneOverride, SceneOverrides } from '../../src/core/types';
import { storyboardWithOverrides } from './arbitraries';

/**
 * Reference model written from the requirement text: an override applies to
 * the Automatic_Scene whose Source_Text equals override.sourceText and whose
 * Occurrence_Rank (count of earlier scenes with the same text) equals
 * override.rank. Lookup goes by the override records' own fields, not by the
 * map key encoding.
 */
function referenceMerge(autos: readonly Scene[], overrides: SceneOverrides): Scene[] {
  const records: SceneOverride[] = Object.values(overrides);
  return autos.map((auto, i) => {
    let rank = 0;
    for (let j = 0; j < i; j++) if (autos[j].text === auto.text) rank++;
    const ov = records.find((o) => o.sourceText === auto.text && o.rank === rank);
    if (ov === undefined) return { ...auto, templateSource: 'auto' };
    const text = ov.editedText ?? auto.text;
    const assigned = assignTemplate(text);
    const manual = ov.manualTemplate;
    return {
      index: i,
      text,
      template: manual ?? assigned.template,
      templateSource: manual !== undefined ? 'manual' : 'auto',
      durationMs: computeDuration(text),
      data: manual !== undefined ? deriveData(manual, text) : assigned.data,
    };
  });
}

describe('Property 29: Override merge matches the reference model', () => {
  /** **Validates: Requirements 1.4, 2.3, 2.4, 2.5, 2.6, 6.2, 6.3, 6.5, 6.7, 6.8** */
  it('keeps length and index order and matches the reference model per scene', () => {
    fc.assert(
      fc.property(storyboardWithOverrides, ({ auto, overrides }) => {
        const autos = auto.scenes;
        const result = applyOverrides(autos, overrides);

        expect(result).toHaveLength(autos.length);
        expect(result.map((s) => s.index)).toEqual(autos.map((_, i) => i));
        expect(result).toEqual(referenceMerge(autos, overrides));
      }),
      { numRuns: 200 },
    );
  });
});
