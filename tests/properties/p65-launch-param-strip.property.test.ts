// Feature: scenebeat-pwa, Property 65: Launch parameter stripping.
// For any query string, `stripLaunchParams` returns a query with no `action`,
// `title`, `text`, or `url` parameter, keeps every other parameter in its
// original order, and parsing the stripped query yields `none`.
// **Validates: Requirements 16.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { LAUNCH_PARAM_NAMES, parseLaunchParams, stripLaunchParams } from '../../src/core/launchParams';
import { launchQueryArb } from './arbitraries';

const launchNames: readonly string[] = LAUNCH_PARAM_NAMES;

describe('Property 65: Launch parameter stripping', () => {
  it('removes the launch parameters, keeps the others in order, and parses to none', () => {
    fc.assert(
      fc.property(launchQueryArb, (search) => {
        const stripped = stripLaunchParams(search);
        const strippedEntries = [...new URLSearchParams(stripped)];

        // No launch parameter remains.
        for (const [name] of strippedEntries) {
          expect(launchNames).not.toContain(name);
        }

        // Every other parameter is kept, with its value, in the original order.
        const expected = [...new URLSearchParams(search)].filter(([name]) => !launchNames.includes(name));
        expect(strippedEntries).toStrictEqual(expected);

        // The stripped query carries no launch intent.
        expect(parseLaunchParams(stripped)).toStrictEqual({ kind: 'none' });

        // Shape: '' when nothing remains, otherwise a query starting with '?'.
        if (stripped !== '') expect(stripped.startsWith('?')).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
