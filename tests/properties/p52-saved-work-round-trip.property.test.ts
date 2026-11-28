// Feature: scenebeat-pwa, Property 52: Saved work round trip.
// For any valid Saved_Work `w` (overrides keyed by `overrideKey`, each with a
// non-empty `editedText` or a template or both), parseWork(serializeWork(w))
// returns { ok: true, work } with `work` deep-equal to `w`, and
// serializeWork(work) === serializeWork(w); the serialized object's keys appear
// in the order of Requirement 12.1 and each override's keys in the order of
// Requirement 12.2.
// **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseWork, serializeWork } from '../../src/core/savedWork';
import { savedWorkArb } from './arbitraries';

const TOP_LEVEL_ORDER = ['version', 'transcript', 'overrides', 'aspectRatio', 'exportFormat', 'subtitleFormat'];
const OVERRIDE_ORDER = ['sourceText', 'rank', 'editedText', 'manualTemplate'];

describe('Property 52: Saved work round trip', () => {
  it('parse(serialize(w)) equals w, re-serializes identically, and keeps key order', () => {
    fc.assert(
      fc.property(savedWorkArb, (w) => {
        const s = serializeWork(w);
        const parsed = parseWork(s);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        expect(parsed.work).toStrictEqual(w);
        expect(serializeWork(parsed.work)).toBe(s);

        const obj = JSON.parse(s) as Record<string, unknown>;
        expect(Object.keys(obj)).toEqual(TOP_LEVEL_ORDER);
        expect(obj.version).toBe(1);

        const overrides = obj.overrides as Record<string, Record<string, unknown>>;
        const keys = Object.keys(overrides);
        expect(keys).toEqual([...keys].sort());
        for (const key of keys) {
          const entryKeys = Object.keys(overrides[key]);
          const expected = OVERRIDE_ORDER.filter((k) => entryKeys.includes(k));
          expect(entryKeys).toEqual(expected);
          expect(entryKeys.slice(0, 2)).toEqual(['sourceText', 'rank']);
        }
      }),
      { numRuns: 100 },
    );
  });
});
