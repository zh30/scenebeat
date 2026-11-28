// Feature: scenebeat-pwa, Property 60: Launch parser totality and precedence.
// For any query string built from arbitrary parameter names and values
// (including `action`, `title`, `text`, `url`, repeats, and unicode),
// `parseLaunchParams` returns exactly one Launch_Intent without throwing; the
// result is `share` or `none` (by Property 59's emptiness rule) whenever
// `title`, `text`, or `url` is present, regardless of `action`; otherwise it is
// `new-transcript` for `action=new`, `load-sample` for `action=sample`, and
// `none` for every other query, including queries with none of the four parameters.
// **Validates: Requirements 14.2, 14.3, 15.2, 15.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildSharedTranscript, parseLaunchParams, type LaunchIntent } from '../../src/core/launchParams';
import { launchQueryArb } from './arbitraries';

/**
 * Independent application/x-www-form-urlencoded decoder (WHATWG URL spec):
 * `+` becomes a space, valid `%XX` sequences become bytes, malformed ones stay
 * as-is, and the bytes are decoded as UTF-8 with replacement characters.
 */
function decodeComponent(s: string): string {
  const encoder = new TextEncoder();
  const bytes: number[] = [];
  const input = s.replace(/\+/g, ' ');
  for (let i = 0; i < input.length; ) {
    const hex = input.slice(i + 1, i + 3);
    if (input[i] === '%' && /^[0-9a-fA-F]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 3;
    } else {
      const cp = input.codePointAt(i)!;
      const ch = String.fromCodePoint(cp);
      bytes.push(...encoder.encode(ch));
      i += ch.length;
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

/** First decoded value per decoded name, in query order. */
function firstValues(search: string): Map<string, string> {
  const body = search.startsWith('?') ? search.slice(1) : search;
  const out = new Map<string, string>();
  for (const segment of body.split('&')) {
    if (segment === '') continue;
    const eq = segment.indexOf('=');
    const name = decodeComponent(eq === -1 ? segment : segment.slice(0, eq));
    const value = eq === -1 ? '' : decodeComponent(segment.slice(eq + 1));
    if (!out.has(name)) out.set(name, value);
  }
  return out;
}

function expectedIntent(search: string): LaunchIntent {
  const p = firstValues(search);
  if (p.has('title') || p.has('text') || p.has('url')) {
    const t = buildSharedTranscript(p.get('title') ?? '', p.get('text') ?? '', p.get('url') ?? '');
    return t === '' ? { kind: 'none' } : { kind: 'share', transcript: t };
  }
  const action = p.get('action');
  if (action === 'new') return { kind: 'new-transcript' };
  if (action === 'sample') return { kind: 'load-sample' };
  return { kind: 'none' };
}

const KINDS = ['none', 'new-transcript', 'load-sample', 'share'];

describe('Property 60: Launch parser totality and precedence', () => {
  it('returns exactly one intent, share params win over action, and action maps new/sample', () => {
    fc.assert(
      fc.property(launchQueryArb, (search) => {
        let intent: LaunchIntent | undefined;
        expect(() => {
          intent = parseLaunchParams(search);
        }).not.toThrow();
        expect(intent).toBeDefined();
        expect(KINDS).toContain(intent!.kind);
        expect(intent).toStrictEqual(expectedIntent(search));

        const p = firstValues(search);
        if (p.has('title') || p.has('text') || p.has('url')) {
          expect(['share', 'none']).toContain(intent!.kind);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never throws for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 40 }), (search) => {
        const intent = parseLaunchParams(search);
        expect(KINDS).toContain(intent.kind);
      }),
      { numRuns: 100 },
    );
  });
});
