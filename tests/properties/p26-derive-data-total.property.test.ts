// Feature: scenebeat-edit-export, Property 26: Data derivation is total.
// For any Scene_Template and any text that is non-empty after trimming,
// `deriveData(template, text)` returns an object with exactly the data key
// required for that template, every value (or every keyword, of which there
// are 1 to 3) is a non-empty string, and every value is a substring of
// `text.trim()`.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deriveData } from '../../src/core/deriveData';
import type { SceneTemplate } from '../../src/core/types';
import { editedText, sceneTemplate, transcript } from './arbitraries';

const REQUIRED_KEY: Record<SceneTemplate, string> = {
  'big-number': 'value',
  'keyword-highlight': 'keywords',
  quote: 'quote',
  timeline: 'label',
};

// Texts with edge whitespace, terminators, line breaks, CJK, emoji, quotes,
// numbers, and punctuation-only tokens; non-empty after trimming.
const edgeSpace = fc.constantFrom('', ' ', '  ', '\t', '\n', '\u3000', '\r\n');
const text = fc
  .tuple(
    edgeSpace,
    fc.oneof(
      { weight: 3, arbitrary: transcript },
      { weight: 3, arbitrary: editedText },
      { weight: 1, arbitrary: fc.constantFrom('...', '!!!', '“”', '「」', '—', '$', '%', '🎬', '"', '¥¥¥ ...') },
      { weight: 1, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 40 }) },
    ),
    edgeSpace,
  )
  .map(([a, body, b]) => `${a}${body}${b}`)
  .filter((s) => s.trim() !== '');

describe('Property 26: Data derivation is total', () => {
  /** **Validates: Requirements 4.8** */
  it('returns the required key with non-empty substrings of the trimmed text', () => {
    fc.assert(
      fc.property(sceneTemplate, text, (template, s) => {
        const t = s.trim();
        const data = deriveData(template, s) as unknown as Record<string, unknown>;
        const key = REQUIRED_KEY[template];
        expect(Object.keys(data)).toEqual([key]);

        const value = data[key];
        const values: unknown[] = template === 'keyword-highlight' ? (value as unknown[]) : [value];
        if (template === 'keyword-highlight') {
          expect(Array.isArray(value)).toBe(true);
          expect(values.length).toBeGreaterThanOrEqual(1);
          expect(values.length).toBeLessThanOrEqual(3);
        }
        for (const v of values) {
          expect(typeof v).toBe('string');
          expect((v as string).length).toBeGreaterThan(0);
          expect(t.includes(v as string)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });
});
