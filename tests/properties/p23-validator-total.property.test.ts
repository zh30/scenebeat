// Feature: scenebeat-mvp, Property 23: Validator is total.
// For any JSON value (including non-objects, null, and deeply mixed types),
// validateStoryboard returns a list and never throws.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateStoryboard } from '../../src/core/validate';

// Any value at a field position: arbitrary JSON plus the edge values the
// validator branches on (empty strings, non-integers, NaN, near-miss shapes).
const fieldValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.jsonValue({ maxDepth: 3 }),
  fc.constantFrom(
    null, '', 0, -1, 1.5, NaN, Infinity, 2000, 8000, 1999, 8001, [], {},
    'quote', 'timeline', 'big-number', 'keyword-highlight', 'bogus',
    '2026-10-31T12:00:00.000Z', '2026-13-45', 'not a date',
    ['a'], ['a', 'b', 'c', 'd'], [1, null, {}],
  ),
);

// Optional fields: each key is present with an arbitrary value or absent.
const looseRecord = <K extends string>(keys: readonly K[]) =>
  fc.record(
    Object.fromEntries(keys.map((k) => [k, fieldValue])) as Record<K, fc.Arbitrary<unknown>>,
    { requiredKeys: [] },
  );

const dataLike = fc.oneof(
  fieldValue,
  looseRecord(['value', 'keywords', 'quote', 'label'] as const),
);

const sceneLike = fc.oneof(
  fieldValue,
  fc
    .tuple(looseRecord(['index', 'text', 'template', 'durationMs'] as const), fc.option(dataLike))
    .map(([scene, data]) => (data === null ? scene : { ...scene, data })),
);

// Storyboard-shaped objects with arbitrary field values, so the validator's
// deeper per-scene branches are exercised, not only the root type check.
const storyboardLike = fc
  .tuple(
    looseRecord(['version', 'createdAt', 'sceneCount'] as const),
    fc.option(fc.oneof(fieldValue, fc.array(sceneLike, { maxLength: 6 }))),
  )
  .map(([root, scenes]) => (scenes === null ? root : { ...root, scenes }));

const anyInput: fc.Arbitrary<unknown> = fc.oneof(
  fc.jsonValue(),
  fc.anything(),
  storyboardLike,
);

describe('Property 23: Validator is total', () => {
  /** **Validates: Requirements 8.1, 8.5** */
  it('returns an array of path/message errors and never throws for any value', () => {
    fc.assert(
      fc.property(anyInput, (value) => {
        let result: unknown;
        expect(() => {
          result = validateStoryboard(value);
        }).not.toThrow();
        expect(Array.isArray(result)).toBe(true);
        for (const err of result as unknown[]) {
          expect(err).toEqual({ path: expect.any(String), message: expect.any(String) });
          expect((err as { path: string }).path.startsWith('$')).toBe(true);
        }
      }),
      { numRuns: 1000 },
    );
  });
});
