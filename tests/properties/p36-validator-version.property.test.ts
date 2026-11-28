// Feature: scenebeat-edit-export, Property 36: Version and templateSource errors are reported at their paths.
// For any valid storyboard value of version 1.0 or 1.1 and any single mutation
// drawn from {set `version` to a string other than "1.0" and "1.1", remove a
// scene's `templateSource` from a 1.1 value, set it to a value other than
// "auto" or "manual", add a `templateSource` to a scene of a 1.0 value},
// `validateStoryboard` returns at least one error, and an error exists at
// `$.version` naming the unsupported value, or at
// `$.scenes[i].templateSource` for the mutated scene `i`, as applicable.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildEditedStoryboard } from '../../src/core/editedStoryboard';
import { serializeStoryboard } from '../../src/core/serialize';
import { validateStoryboard } from '../../src/core/validate';
import { storyboardWithOverrides } from './arbitraries';

type Json = Record<string, unknown>;

/** Any JSON-like value other than the two valid templateSource strings. */
const invalidSource: fc.Arbitrary<unknown> = fc.oneof(
  fc.string().filter((s) => s !== 'auto' && s !== 'manual'),
  fc.constantFrom('Auto', 'MANUAL', ' auto', 'manual ', ''),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.constantFrom('auto', 'manual', 1)),
  fc.constant({ source: 'auto' }),
);

/** Any value, including the valid strings (all are invalid on a 1.0 scene). */
const anySource: fc.Arbitrary<unknown> = fc.oneof(
  fc.constantFrom('auto', 'manual'),
  invalidSource,
);

type Mutation =
  | { kind: 'version'; value: string }
  | { kind: 'remove-source'; pick: number }
  | { kind: 'bad-source'; pick: number; value: unknown }
  | { kind: 'add-source'; pick: number; value: unknown };

const pick = fc.nat({ max: 1000 });
const badVersion = fc.oneof(
  fc.string().filter((s) => s !== '1.0' && s !== '1.1'),
  fc.constantFrom('1', '1.2', '2.0', '1.0 ', ' 1.1', '1.10', 'v1.1', ''),
);

/** A valid storyboard JSON value (version 1.0 or 1.1) with an applicable mutation. */
const caseArb = fc
  .tuple(storyboardWithOverrides, fc.boolean())
  .chain(([{ auto, overrides }, edited]) => {
    const sb = edited ? buildEditedStoryboard(auto, overrides) : auto;
    const value = JSON.parse(serializeStoryboard(sb)) as Json;
    const hasScenes = sb.scenes.length > 0;
    const options: fc.Arbitrary<Mutation>[] = [
      badVersion.map((v) => ({ kind: 'version' as const, value: v })),
    ];
    if (hasScenes && edited) {
      options.push(pick.map((p) => ({ kind: 'remove-source' as const, pick: p })));
      options.push(
        fc.record({ kind: fc.constant('bad-source' as const), pick, value: invalidSource }),
      );
    }
    if (hasScenes && !edited) {
      options.push(fc.record({ kind: fc.constant('add-source' as const), pick, value: anySource }));
    }
    return fc.oneof(...options).map((m) => ({ value, m }));
  });

describe('Property 36: Version and templateSource errors are reported at their paths', () => {
  /** **Validates: Requirements 5.7, 5.8, 5.9** */
  it('reports the mutation at $.version or $.scenes[i].templateSource', () => {
    fc.assert(
      fc.property(caseArb, ({ value, m }) => {
        // Sanity: the generated storyboard starts valid.
        expect(validateStoryboard(value)).toEqual([]);
        const scenes = value.scenes as Json[];
        const at = (p: number): number => p % scenes.length;

        let path: string;
        let mustMention: string | undefined;
        switch (m.kind) {
          case 'version':
            value.version = m.value;
            path = '$.version';
            mustMention = m.value;
            break;
          case 'remove-source': {
            const i = at(m.pick);
            delete scenes[i].templateSource;
            path = `$.scenes[${i}].templateSource`;
            break;
          }
          case 'bad-source':
          case 'add-source': {
            const i = at(m.pick);
            scenes[i].templateSource = m.value;
            path = `$.scenes[${i}].templateSource`;
            break;
          }
        }

        const errors = validateStoryboard(value);
        expect(errors.length).toBeGreaterThan(0);
        const hits = errors.filter((e) => e.path === path);
        expect(hits.length).toBeGreaterThan(0);
        if (mustMention !== undefined) {
          expect(hits.some((e) => e.message.includes(`"${mustMention}"`))).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
