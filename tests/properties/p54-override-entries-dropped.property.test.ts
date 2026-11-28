// Feature: scenebeat-pwa, Property 54: For any valid Saved_Work and any set of invalid override
// entries (each breaking exactly one rule of Requirement 12.7) mixed into its `overrides`,
// parsing the result yields exactly the original valid overrides.
// **Validates: Requirements 12.7**
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseWork, serializeWork } from '../../src/core/savedWork';
import { invalidOverrideEntryArb, objectWithEntries, savedWorkArb } from './arbitraries';

describe('Property 54: invalid override entries are dropped individually', () => {
  it('parsing keeps exactly the valid overrides', () => {
    fc.assert(
      fc.property(
        savedWorkArb,
        fc.array(fc.tuple(invalidOverrideEntryArb, fc.nat()), { minLength: 1, maxLength: 8 }),
        (work, invalid) => {
          // Interleave the invalid entries among the valid ones at generated positions.
          const pairs: Array<readonly [string, unknown]> = Object.entries(work.overrides);
          for (const [{ key, entry }, pos] of invalid) {
            pairs.splice(pos % (pairs.length + 1), 0, [key, entry]);
          }

          const stored = JSON.parse(serializeWork(work)) as Record<string, unknown>;
          stored.overrides = objectWithEntries(pairs);
          const raw = JSON.stringify(stored);

          const result = parseWork(raw);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.work.overrides).toEqual(work.overrides);
          expect(Object.keys(result.work.overrides).sort()).toEqual(Object.keys(work.overrides).sort());
          expect(result.work.transcript).toBe(work.transcript);
        },
      ),
      { numRuns: 100 },
    );
  });
});
