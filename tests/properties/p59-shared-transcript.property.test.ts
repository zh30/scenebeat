// Feature: scenebeat-pwa, Property 59: Shared transcript composition.
// For any `title`, `text`, and `url` strings, `buildSharedTranscript` equals the
// reference composition of Requirement 15.3 (trimmed text, then title prepended
// and url appended when non-empty and not already contained, joined by a line
// break), contains every non-empty trimmed `text` unchanged, and is empty
// exactly when all three trimmed values are empty.
// **Validates: Requirements 15.3, 15.4, 15.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildSharedTranscript, parseLaunchParams } from '../../src/core/launchParams';

/** Independent reference: collect the parts in order, then join non-empty ones with '\n'. */
function reference(title: string, text: string, url: string): string {
  const parts: string[] = [];
  const x = text.trim();
  if (x !== '') parts.push(x);
  const t = title.trim();
  if (t !== '' && !parts.join('\n').includes(t)) parts.unshift(t);
  const u = url.trim();
  if (u !== '' && !parts.join('\n').includes(u)) parts.push(u);
  return parts.join('\n');
}

const pad = fc.constantFrom('', ' ', '\t', '\n', '  \n ', '\u3000');
const core = fc.oneof(
  fc.constant(''),
  fc.constantFrom('Note', 'Hello world.', 'https://example.test/a?b=1', '你好。', 'a\nb'),
  fc.string({ unit: 'grapheme', maxLength: 30 }),
);
const padded = fc.tuple(pad, core, pad).map(([a, s, b]) => a + s + b);

/** Title/url that are often substrings of the text, to exercise the "already contained" rule. */
const shareInputs = fc
  .tuple(padded, padded, padded, fc.nat(), fc.nat(), fc.nat(), fc.boolean(), fc.boolean())
  .map(([title, text, url, i, j, k, titleFromText, urlFromText]) => {
    // Slice by code points so a substring never holds a lone surrogate
    // (a URL query cannot carry one; URLSearchParams would turn it into U+FFFD).
    const t = Array.from(text.trim());
    const sub = (a: number, b: number) => {
      if (t.length === 0) return '';
      const start = a % t.length;
      return t.slice(start, start + 1 + (b % (t.length - start))).join('');
    };
    return {
      title: titleFromText ? ` ${sub(i, j)} ` : title,
      text,
      url: urlFromText ? sub(j, k) : url,
    };
  });

describe('Property 59: Shared transcript composition', () => {
  it('matches the reference composition, keeps the text, and is empty only when all inputs are blank', () => {
    fc.assert(
      fc.property(shareInputs, ({ title, text, url }) => {
        const result = buildSharedTranscript(title, text, url);

        expect(result).toBe(reference(title, text, url));

        const trimmedText = text.trim();
        if (trimmedText !== '') expect(result).toContain(trimmedText);

        const allBlank = title.trim() === '' && trimmedText === '' && url.trim() === '';
        expect(result === '').toBe(allBlank);

        // Through the parser: share with this transcript, or none when empty (15.4).
        const search = `?${new URLSearchParams({ title, text, url }).toString()}`;
        const intent = parseLaunchParams(search);
        expect(intent).toStrictEqual(allBlank ? { kind: 'none' } : { kind: 'share', transcript: result });
      }),
      { numRuns: 200 },
    );
  });
});
