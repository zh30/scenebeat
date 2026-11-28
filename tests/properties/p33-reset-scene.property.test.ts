// Feature: scenebeat-edit-export, Property 33: Reset restores the automatic scene and nothing else.
// For any transcript, any set of overrides, and any scene i, after
// resetSceneOverride on scene i's key, scene i of applyOverrides deeply equals
// the Automatic_Scene with templateSource: "auto", and every other key in the
// set maps to the same override as before.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import {
  applyOverrides,
  occurrenceRanks,
  overrideKey,
  resetSceneOverride,
} from '../../src/core/overrides';
import type { SceneOverrides } from '../../src/core/types';
import { FIXED_CREATED_AT, overridesFor, sceneOverride, transcript } from './arbitraries';

/** A transcript with at least one scene, an override set, and a chosen scene index. */
const caseArb = transcript
  .map((text) => buildStoryboard(text, FIXED_CREATED_AT))
  .filter((auto) => auto.scenes.length > 0)
  .chain((auto) =>
    fc.integer({ min: 0, max: auto.scenes.length - 1 }).chain((i) => {
      const ranks = occurrenceRanks(auto.scenes.map((s) => s.text));
      const text = auto.scenes[i].text;
      const rank = ranks[i];
      return fc
        .tuple(
          overridesFor(auto.scenes),
          // Usually make sure scene i itself carries an override before the reset.
          fc.option(sceneOverride(text, rank), { freq: 4, nil: undefined }),
        )
        .map(([base, forced]) => {
          const overrides: SceneOverrides =
            forced === undefined ? base : { ...base, [overrideKey(text, rank)]: forced };
          return { auto, i, key: overrideKey(text, rank), overrides };
        });
    }),
  );

describe('Property 33: Reset restores the automatic scene and nothing else', () => {
  /** **Validates: Requirements 3.3, 3.4** */
  it('resetSceneOverride restores scene i and keeps every other override object', () => {
    fc.assert(
      fc.property(caseArb, ({ auto, i, key, overrides }) => {
        const snapshot = structuredClone(overrides);

        const next = resetSceneOverride(overrides, key);

        // Scene i is back to the Automatic_Scene.
        const scenes = applyOverrides(auto.scenes, next);
        expect(scenes[i]).toStrictEqual({ ...auto.scenes[i], templateSource: 'auto' });

        // The reset key is gone; every other key maps to the same object.
        expect(Object.prototype.hasOwnProperty.call(next, key)).toBe(false);
        const otherKeys = Object.keys(overrides).filter((k) => k !== key);
        expect(Object.keys(next).sort()).toEqual([...otherKeys].sort());
        for (const k of otherKeys) expect(next[k]).toBe(overrides[k]);

        // The input map is not mutated.
        expect(overrides).toStrictEqual(snapshot);
      }),
      { numRuns: 200 },
    );
  });
});
