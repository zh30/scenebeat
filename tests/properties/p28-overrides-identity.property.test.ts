// Feature: scenebeat-edit-export, Property 28: Empty overrides are the identity.
// For any transcript, applyOverrides(auto.scenes, {}) returns scenes deeply
// equal to auto.scenes with templateSource: "auto" added to each.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { buildEditedStoryboard } from '../../src/core/editedStoryboard';
import { applyOverrides } from '../../src/core/overrides';
import { FIXED_CREATED_AT, transcript } from './arbitraries';

describe('Property 28: Empty overrides are the identity', () => {
  /** **Validates: Requirements 3.5** */
  it('applyOverrides with an empty map only adds templateSource "auto"', () => {
    fc.assert(
      fc.property(transcript, (text) => {
        const auto = buildStoryboard(text, FIXED_CREATED_AT);
        const snapshot = structuredClone(auto.scenes);
        const expected = auto.scenes.map((s) => ({ ...s, templateSource: 'auto' as const }));

        const result = applyOverrides(auto.scenes, {});
        expect(result).toStrictEqual(expected);

        // The edited storyboard built from an empty map carries the same scenes.
        expect(buildEditedStoryboard(auto, {}).scenes).toStrictEqual(expected);

        // Inputs are not mutated.
        expect(auto.scenes).toStrictEqual(snapshot);
      }),
      { numRuns: 200 },
    );
  });
});
