// Feature: scenebeat-edit-export, Property 27: Data derivation agrees with automatic assignment.
// For any text that is non-empty after trimming, with a = assignTemplate(text.trim()),
// deriveData(a.template, text) deeply equals a.data.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assignTemplate } from '../../src/core/assignTemplate';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { deriveData } from '../../src/core/deriveData';
import { FIXED_CREATED_AT, editedText, transcript } from './arbitraries';

// Real sentences as the splitter produces them, so every template rule is hit.
const sceneSentence: fc.Arbitrary<string> = transcript
  .map((t) => buildStoryboard(t, FIXED_CREATED_AT).scenes.map((s) => s.text))
  .filter((texts) => texts.length > 0)
  .chain((texts) => fc.constantFrom(...texts));

// Edge whitespace around the text, to check deriveData trims before matching.
const edgeSpace = fc.constantFrom('', ' ', '  ', '\t', '\u3000', '\n', ' \n ');

const text: fc.Arbitrary<string> = fc
  .tuple(
    edgeSpace,
    fc.oneof(
      { weight: 3, arbitrary: sceneSentence },
      { weight: 2, arbitrary: editedText },
      { weight: 1, arbitrary: fc.string({ unit: 'grapheme', maxLength: 60 }) },
    ),
    edgeSpace,
  )
  .map(([pre, body, post]) => pre + body + post)
  .filter((s) => s.trim() !== '');

describe('Property 27: Data derivation agrees with automatic assignment', () => {
  /** **Validates: Requirements 4.9** */
  it('deriveData(assignTemplate(t).template, text) equals assignTemplate(t).data', () => {
    fc.assert(
      fc.property(text, (s) => {
        const a = assignTemplate(s.trim());
        expect(deriveData(a.template, s)).toEqual(a.data);
      }),
      { numRuns: 300 },
    );
  });
});
