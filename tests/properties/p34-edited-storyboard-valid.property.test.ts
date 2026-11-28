// Feature: scenebeat-edit-export, Property 34: Edited storyboards are valid version 1.1 storyboards.
// For any transcript and any set of overrides,
// buildEditedStoryboard(buildStoryboard(text), overrides) has version "1.1";
// its serialization has scene keys in the order index, text, template,
// templateSource, durationMs, data with templateSource in {"auto", "manual"};
// and validateStoryboard on the parsed serialization returns an empty list.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { buildEditedStoryboard } from '../../src/core/editedStoryboard';
import { parseStoryboard, serializeStoryboard } from '../../src/core/serialize';
import { validateStoryboard } from '../../src/core/validate';
import { createdAt, overridesFor, transcript } from './arbitraries';

const TOP_LEVEL_KEYS = ['version', 'createdAt', 'sceneCount', 'scenes'];
const SCENE_KEYS = ['index', 'text', 'template', 'templateSource', 'durationMs', 'data'];

const input = fc.tuple(transcript, createdAt).chain(([text, date]) => {
  const auto = buildStoryboard(text, date);
  return overridesFor(auto.scenes).map((overrides) => ({ auto, overrides }));
});

describe('Property 34: Edited storyboards are valid version 1.1 storyboards', () => {
  /** **Validates: Requirements 5.1, 5.2, 5.6, 5.11** */
  it('builds, serializes with templateSource after template, and validates cleanly', () => {
    fc.assert(
      fc.property(input, ({ auto, overrides }) => {
        const edited = buildEditedStoryboard(auto, overrides);
        expect(edited.version).toBe('1.1');

        const json = serializeStoryboard(edited);
        // JSON.parse keeps the insertion order of non-numeric string keys,
        // so Object.keys reflects the order written in the JSON text.
        const raw = JSON.parse(json) as Record<string, unknown>;
        expect(Object.keys(raw)).toStrictEqual(TOP_LEVEL_KEYS);
        expect(raw.version).toBe('1.1');

        const scenes = raw.scenes as Array<Record<string, unknown>>;
        expect(scenes).toHaveLength(auto.scenes.length);
        for (const scene of scenes) {
          expect(Object.keys(scene)).toStrictEqual(SCENE_KEYS);
          expect(['auto', 'manual']).toContain(scene.templateSource);
        }

        const parsed = parseStoryboard(json);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(validateStoryboard(parsed.value)).toStrictEqual([]);
      }),
      { numRuns: 200 },
    );
  });
});
