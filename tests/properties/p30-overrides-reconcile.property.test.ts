// Feature: scenebeat-edit-export, Property 30: Reconciliation discards unmatched overrides and is idempotent.
// For any list of Automatic_Scenes and any set of Scene_Overrides, r = reconcileOverrides(autos, overrides)
// contains exactly the overrides whose (sourceText, rank) matches an Automatic_Scene;
// reconcileOverrides(autos, r) equals r; and applyOverrides(autos, r) deeply equals
// applyOverrides(autos, overrides).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { applyOverrides, overrideKey, reconcileOverrides } from '../../src/core/overrides';
import type { Scene, SceneOverride, SceneOverrides } from '../../src/core/types';
import { FIXED_CREATED_AT, overridesFor, transcript } from './arbitraries';

interface Case {
  autos: Scene[];
  overrides: SceneOverrides;
}

// Overrides built for the same transcript (live plus unrelated keys).
const sameTranscript: fc.Arbitrary<Case> = transcript.chain((text) => {
  const autos = buildStoryboard(text, FIXED_CREATED_AT).scenes;
  return overridesFor(autos).map((overrides) => ({ autos, overrides }));
});

// Overrides built for an earlier transcript, then reconciled against a new one
// (the regeneration case), merged with overrides for the new transcript.
const staleTranscript: fc.Arbitrary<Case> = fc.tuple(transcript, transcript).chain(([oldText, newText]) => {
  const oldAutos = buildStoryboard(oldText, FIXED_CREATED_AT).scenes;
  const autos = buildStoryboard(newText, FIXED_CREATED_AT).scenes;
  return fc
    .tuple(overridesFor(oldAutos), overridesFor(autos))
    .map(([stale, fresh]) => ({ autos, overrides: { ...stale, ...fresh } }));
});

const testCase: fc.Arbitrary<Case> = fc.oneof(sameTranscript, staleTranscript);

/** Reference model: (text, rank) pairs of the scenes, counted independently. */
function livePairs(autos: readonly Scene[]): Set<string> {
  // Prototype-free so texts like "toString" or "__proto__" count from zero.
  const counts: Record<string, number> = Object.create(null);
  const live = new Set<string>();
  for (const a of autos) {
    const rank = counts[a.text] ?? 0;
    counts[a.text] = rank + 1;
    live.add(JSON.stringify([rank, a.text]));
  }
  return live;
}

describe('Property 30: Reconciliation discards unmatched overrides and is idempotent', () => {
  /** **Validates: Requirements 6.4, 6.9** */
  it('keeps exactly the matching overrides, is idempotent, and does not change the merge', () => {
    fc.assert(
      fc.property(testCase, ({ autos, overrides }) => {
        const before = structuredClone(overrides);
        const r = reconcileOverrides(autos, overrides);

        // Exactly the overrides whose (sourceText, rank) matches an Automatic_Scene, unchanged.
        const live = livePairs(autos);
        const expected: Record<string, SceneOverride> = {};
        for (const [key, ov] of Object.entries(overrides)) {
          if (live.has(JSON.stringify([ov.rank, ov.sourceText]))) expected[key] = ov;
        }
        expect(Object.keys(r).sort()).toEqual(Object.keys(expected).sort());
        for (const key of Object.keys(expected)) {
          expect(r[key]).toBe(overrides[key]);
          expect(key).toBe(overrideKey(r[key].sourceText, r[key].rank));
        }

        // Idempotent.
        expect(reconcileOverrides(autos, r)).toEqual(r);

        // Reconciling does not change the edited scenes.
        expect(applyOverrides(autos, r)).toEqual(applyOverrides(autos, overrides));

        // Inputs are not mutated.
        expect(overrides).toEqual(before);
      }),
      { numRuns: 200 },
    );
  });
});
