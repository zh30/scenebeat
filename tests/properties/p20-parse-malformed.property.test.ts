// Feature: scenebeat-mvp, Property 20: Malformed JSON is rejected with an error.
// For any string that is not valid JSON, parseStoryboard returns { ok: false }
// with a non-empty error message and does not throw.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseStoryboard } from '../../src/core/serialize';

function isMalformed(s: string): boolean {
  try {
    JSON.parse(s);
    return false;
  } catch {
    return true;
  }
}

// Random text: almost always not JSON.
const randomText = fc.string({ unit: 'binary', maxLength: 80 });

// Near-miss JSON: a valid JSON object text that is truncated, or has a
// JSON-breaking fragment inserted at some position.
const validJsonText = fc
  .dictionary(fc.string({ maxLength: 8 }), fc.jsonValue({ maxDepth: 2 }), { minKeys: 1, maxKeys: 4 })
  .map((o) => JSON.stringify(o, null, 2));

const truncated = validJsonText.chain((s) =>
  fc.integer({ min: 0, max: s.length - 1 }).map((n) => s.slice(0, n)),
);

const injected = fc
  .tuple(validJsonText, fc.constantFrom('{', '}', ',', ':', '"', "'", 'undefined', 'NaN', '//', '\u0000'), fc.nat())
  .map(([s, frag, pos]) => {
    const i = pos % (s.length + 1);
    return s.slice(0, i) + frag + s.slice(i);
  });

const malformedJson = fc.oneof(randomText, truncated, injected).filter(isMalformed);

describe('Property 20: Malformed JSON is rejected with an error', () => {
  /** **Validates: Requirements 7.5** */
  it('returns ok:false with a non-empty error and never throws', () => {
    fc.assert(
      fc.property(malformedJson, (s) => {
        let result: ReturnType<typeof parseStoryboard> | undefined;
        expect(() => {
          result = parseStoryboard(s);
        }).not.toThrow();
        expect(result!.ok).toBe(false);
        if (!result!.ok) {
          expect(typeof result!.error).toBe('string');
          expect(result!.error.trim().length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 300 },
    );
  });
});
