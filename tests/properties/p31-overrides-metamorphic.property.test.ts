// Feature: scenebeat-edit-export, Property 31: Overrides survive a one-sentence change.
// For any list of sentences, any position j, any replacement sentence, and any
// set of overrides on the original Automatic_Scenes, after replacing sentence j
// and reconciling, every override whose scene is not at j and whose
// Occurrence_Rank is the same in the new list is retained with all fields
// unchanged.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { occurrenceRanks, overrideKey, reconcileOverrides } from '../../src/core/overrides';
import {
  FIXED_CREATED_AT,
  featureTranscript,
  overridesFor,
  transcript,
} from './arbitraries';

const sceneTexts = (t: string): string[] =>
  buildStoryboard(t, FIXED_CREATED_AT).scenes.map((s) => s.text);

/** A transcript with at least one sentence; its sentences are the Automatic_Scene texts. */
const sentences = transcript.map(sceneTexts).filter((texts) => texts.length > 0);

/** A single sentence: one that the splitter returns unchanged as exactly one scene. */
const freshSentence = featureTranscript
  .map(sceneTexts)
  .filter((texts) => texts.length > 0)
  .chain((texts) => fc.constantFrom(...texts));

const scenario = sentences.chain((texts) => {
  const auto = buildStoryboard(texts.join('\n'), FIXED_CREATED_AT);
  return fc.record({
    auto: fc.constant(auto),
    j: fc.nat({ max: texts.length - 1 }),
    // Replacements include existing sentences, so ranks of duplicates shift.
    replacement: fc.oneof(freshSentence, fc.constantFrom(...texts)),
    overrides: overridesFor(auto.scenes),
  });
});

describe('Property 31: Overrides survive a one-sentence change', () => {
  /** **Validates: Requirements 6.10** */
  it('retains every override whose scene keeps its position-independent identity', () => {
    fc.assert(
      fc.property(scenario, ({ auto, j, replacement, overrides }) => {
        const oldTexts = auto.scenes.map((s) => s.text);
        const newTexts = oldTexts.slice();
        newTexts[j] = replacement;

        const next = buildStoryboard(newTexts.join('\n'), FIXED_CREATED_AT);
        // Sanity: the change touched only sentence j.
        expect(next.scenes.map((s) => s.text)).toEqual(newTexts);

        const reconciled = reconcileOverrides(next.scenes, overrides);
        const oldRanks = occurrenceRanks(oldTexts);
        const newRanks = occurrenceRanks(newTexts);

        for (let i = 0; i < oldTexts.length; i += 1) {
          if (i === j || oldRanks[i] !== newRanks[i]) continue;
          const key = overrideKey(oldTexts[i], oldRanks[i]);
          if (!Object.prototype.hasOwnProperty.call(overrides, key)) continue;
          expect(Object.prototype.hasOwnProperty.call(reconciled, key)).toBe(true);
          expect(reconciled[key]).toBe(overrides[key]);
          expect(reconciled[key]).toEqual(overrides[key]);
        }
      }),
      { numRuns: 200 },
    );
  });
});
