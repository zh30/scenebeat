// Feature: scenebeat-edit-export, Property 35: Round trip for versions 1.0 and 1.1.
// For any transcript and any set of overrides, for both the version 1.0
// storyboard (buildStoryboard) and the version 1.1 storyboard
// (buildEditedStoryboard), serializing, parsing, and serializing again produces
// identical text; the parsed value keeps `version` and, for 1.1, every scene's
// `templateSource`; and the 1.0 serialization contains no `templateSource` key.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { buildEditedStoryboard } from '../../src/core/editedStoryboard';
import { parseStoryboard, serializeStoryboard } from '../../src/core/serialize';
import { createdAt, overridesFor, transcript } from './arbitraries';

const input = fc
  .tuple(transcript, createdAt)
  .chain(([text, now]) => {
    const auto = buildStoryboard(text, now);
    return overridesFor(auto.scenes).map((overrides) => ({ auto, overrides }));
  });

describe('Property 35: Round trip for versions 1.0 and 1.1', () => {
  /** **Validates: Requirements 5.3, 5.4, 5.10** */
  it('serialize -> parse -> serialize is identical and keeps version and templateSource', () => {
    fc.assert(
      fc.property(input, ({ auto, overrides }) => {
        const edited = buildEditedStoryboard(auto, overrides);

        // Version 1.0 (automatic storyboard).
        const text10 = serializeStoryboard(auto);
        const parsed10 = parseStoryboard(text10);
        expect(parsed10.ok).toBe(true);
        if (!parsed10.ok) return;
        expect(parsed10.value.version).toBe('1.0');
        expect(serializeStoryboard(parsed10.value)).toBe(text10);
        expect(text10).not.toContain('"templateSource"');
        for (const scene of parsed10.value.scenes) {
          expect(Object.prototype.hasOwnProperty.call(scene, 'templateSource')).toBe(false);
        }

        // Version 1.1 (edited storyboard).
        const text11 = serializeStoryboard(edited);
        const parsed11 = parseStoryboard(text11);
        expect(parsed11.ok).toBe(true);
        if (!parsed11.ok) return;
        expect(parsed11.value.version).toBe('1.1');
        expect(serializeStoryboard(parsed11.value)).toBe(text11);
        expect(parsed11.value.scenes).toHaveLength(edited.scenes.length);
        parsed11.value.scenes.forEach((scene, i) => {
          expect(scene.templateSource).toBe(edited.scenes[i].templateSource);
          expect(['auto', 'manual']).toContain(scene.templateSource);
        });
        expect(parsed11.value).toEqual(edited);
      }),
      { numRuns: 200 },
    );
  });
});
