// Feature: scenebeat-mvp, Property 22: Validator detects each kind of corruption.
// For any valid storyboard JSON value and any single mutation drawn from
// {change sceneCount, swap or shift an index, set template to an unknown
// string, remove or retype a required field, set durationMs outside 2000 to
// 8000}, validateStoryboard returns at least one error, and the error names the
// relevant location: both counts for a count mismatch, the first
// out-of-sequence index, the scene index and bad value for an invalid template,
// the JSON path for a missing or mistyped field, and the scene index for a bad
// duration.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { serializeStoryboard } from '../../src/core/serialize';
import { validateStoryboard } from '../../src/core/validate';
import { TEMPLATES } from '../../src/core/types';
import type { ValidationError } from '../../src/core/types';

type Json = Record<string, unknown>;

// Sentences mixing English, Chinese, numbers, years, quotes, and markers so
// every template appears across runs.
const sentence = fc.constantFrom(
  'Revenue grew 45% this quarter.',
  'In 2025 we launched the product.',
  'She said "keep going" to the team.',
  'Simple storytelling matters most.',
  '首先我们打开编辑器。',
  '他说「坚持下去」。',
  '收入增长了3倍！',
  '创作者需要更好的工具？',
  'Then everything changed.',
  'Costs fell by $3 million.',
);

/** A valid storyboard JSON value with at least one scene. */
const validStoryboard: fc.Arbitrary<Json> = fc
  .array(sentence, { minLength: 1, maxLength: 8 })
  .map((sentences) => {
    const sb = buildStoryboard(sentences.join(' '), new Date(Date.UTC(2026, 9, 31, 12)));
    return JSON.parse(serializeStoryboard(sb)) as Json;
  });

const ROOT_FIELDS = ['version', 'createdAt', 'sceneCount', 'scenes'] as const;
const SCENE_FIELDS = ['index', 'text', 'template', 'durationMs', 'data'] as const;

/** A replacement value of the wrong type for each field. */
const WRONG_TYPE: Record<string, readonly unknown[]> = {
  version: [1, null, true, [], {}],
  createdAt: [0, null, false, [], {}],
  sceneCount: ['1', 1.5, null, [], {}],
  scenes: ['scenes', 3, null, {}],
  index: ['0', 0.5, null, [], {}],
  text: [7, null, true, [], {}],
  template: [1, null, false, [], {}],
  durationMs: ['3000', 3000.5, null, [], {}],
  data: ['data', 1, null, [], true],
};

type Mutation =
  | { kind: 'count'; delta: number }
  | { kind: 'index-swap'; a: number; b: number }
  | { kind: 'index-shift'; pick: number; offset: number }
  | { kind: 'template'; pick: number; value: string }
  | { kind: 'remove-root'; field: (typeof ROOT_FIELDS)[number] }
  | { kind: 'retype-root'; field: (typeof ROOT_FIELDS)[number]; pick: number }
  | { kind: 'remove-scene'; pick: number; field: (typeof SCENE_FIELDS)[number] }
  | { kind: 'retype-scene'; pick: number; field: (typeof SCENE_FIELDS)[number]; typePick: number }
  | { kind: 'duration'; pick: number; value: number };

const nat = fc.nat({ max: 1000 });

const mutation: fc.Arbitrary<Mutation> = fc.oneof(
  fc
    .integer({ min: -20, max: 20 })
    .filter((d) => d !== 0)
    .map((delta) => ({ kind: 'count' as const, delta })),
  fc.record({ kind: fc.constant('index-swap' as const), a: nat, b: nat }),
  fc.record({
    kind: fc.constant('index-shift' as const),
    pick: nat,
    offset: fc.integer({ min: -50, max: 50 }).filter((o) => o !== 0),
  }),
  fc.record({
    kind: fc.constant('template' as const),
    pick: nat,
    value: fc.string().filter((s) => !(TEMPLATES as readonly string[]).includes(s)),
  }),
  fc.record({ kind: fc.constant('remove-root' as const), field: fc.constantFrom(...ROOT_FIELDS) }),
  fc.record({
    kind: fc.constant('retype-root' as const),
    field: fc.constantFrom(...ROOT_FIELDS),
    pick: nat,
  }),
  fc.record({
    kind: fc.constant('remove-scene' as const),
    pick: nat,
    field: fc.constantFrom(...SCENE_FIELDS),
  }),
  fc.record({
    kind: fc.constant('retype-scene' as const),
    pick: nat,
    field: fc.constantFrom(...SCENE_FIELDS),
    typePick: nat,
  }),
  fc.record({
    kind: fc.constant('duration' as const),
    pick: nat,
    value: fc.oneof(
      fc.integer({ min: -1_000_000, max: 1999 }),
      fc.integer({ min: 8001, max: 1_000_000 }),
    ),
  }),
);

/**
 * Applies the mutation in place and returns a check that the errors name the
 * relevant location.
 */
function applyMutation(sb: Json, m: Mutation): (errors: ValidationError[]) => void {
  const scenes = sb.scenes as Json[];
  const n = scenes.length;
  const at = (p: number): number => p % n;
  const hasPath = (errors: ValidationError[], path: string) =>
    errors.filter((e) => e.path === path);

  switch (m.kind) {
    case 'count': {
      const bad = Math.max(0, n + m.delta) === n ? n + 1 : Math.max(0, n + m.delta);
      sb.sceneCount = bad;
      return (errors) => {
        const hit = hasPath(errors, '$.sceneCount');
        expect(hit.length).toBeGreaterThan(0);
        expect(hit.some((e) => e.message.includes(String(bad)) && e.message.includes(String(n)))).toBe(true);
      };
    }
    case 'index-swap': {
      let a = at(m.a);
      let b = at(m.b);
      if (a === b) {
        // Single scene or same pick: shift instead.
        scenes[a].index = a + 1;
        return (errors) => {
          const hit = hasPath(errors, `$.scenes[${a}].index`);
          expect(hit.length).toBeGreaterThan(0);
          expect(hit[0].message).toContain(String(a + 1));
        };
      }
      if (a > b) [a, b] = [b, a];
      scenes[a].index = b;
      scenes[b].index = a;
      return (errors) => {
        // The first out-of-sequence index is at position a.
        const indexErrors = errors.filter((e) => /^\$\.scenes\[\d+\]\.index$/.test(e.path));
        expect(indexErrors.length).toBeGreaterThan(0);
        expect(indexErrors[0].path).toBe(`$.scenes[${a}].index`);
        expect(indexErrors[0].message).toContain(String(b));
      };
    }
    case 'index-shift': {
      const i = at(m.pick);
      // Shift every index from position i onward by the offset.
      for (let k = i; k < n; k++) scenes[k].index = k + m.offset;
      return (errors) => {
        const indexErrors = errors.filter((e) => /^\$\.scenes\[\d+\]\.index$/.test(e.path));
        expect(indexErrors.length).toBeGreaterThan(0);
        expect(indexErrors[0].path).toBe(`$.scenes[${i}].index`);
        expect(indexErrors[0].message).toContain(String(i + m.offset));
      };
    }
    case 'template': {
      const i = at(m.pick);
      scenes[i].template = m.value;
      return (errors) => {
        const hit = hasPath(errors, `$.scenes[${i}].template`);
        expect(hit.length).toBeGreaterThan(0);
        expect(hit.some((e) => e.message.includes(String(i)) && e.message.includes(m.value))).toBe(true);
      };
    }
    case 'remove-root': {
      delete sb[m.field];
      return (errors) => {
        expect(hasPath(errors, `$.${m.field}`).length).toBeGreaterThan(0);
      };
    }
    case 'retype-root': {
      const options = WRONG_TYPE[m.field];
      sb[m.field] = options[m.pick % options.length];
      return (errors) => {
        expect(hasPath(errors, `$.${m.field}`).length).toBeGreaterThan(0);
      };
    }
    case 'remove-scene': {
      const i = at(m.pick);
      delete scenes[i][m.field];
      return (errors) => {
        expect(hasPath(errors, `$.scenes[${i}].${m.field}`).length).toBeGreaterThan(0);
      };
    }
    case 'retype-scene': {
      const i = at(m.pick);
      const options = WRONG_TYPE[m.field];
      scenes[i][m.field] = options[m.typePick % options.length];
      return (errors) => {
        expect(hasPath(errors, `$.scenes[${i}].${m.field}`).length).toBeGreaterThan(0);
      };
    }
    case 'duration': {
      const i = at(m.pick);
      scenes[i].durationMs = m.value;
      return (errors) => {
        const hit = hasPath(errors, `$.scenes[${i}].durationMs`);
        expect(hit.length).toBeGreaterThan(0);
        expect(hit.some((e) => e.message.includes(`Scene ${i}`))).toBe(true);
      };
    }
  }
}

describe('Property 22: Validator detects each kind of corruption', () => {
  /** **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6** */
  it('reports an error naming the corrupted location', () => {
    fc.assert(
      fc.property(validStoryboard, mutation, (sb, m) => {
        // Sanity: the generated storyboard starts valid.
        expect(validateStoryboard(sb)).toEqual([]);
        const check = applyMutation(sb, m);
        const errors = validateStoryboard(sb);
        expect(errors.length).toBeGreaterThan(0);
        check(errors);
      }),
      { numRuns: 300 },
    );
  });
});
