// Feature: scenebeat-edit-export, Property 25: Data derivation follows matcher-or-fallback rules.
// For any Scene_Template and any text that is non-empty after trimming,
// deriveData(template, text) equals the template's matcher result on text.trim()
// when that result is non-null (matchQuote for quote, matchTimeline for timeline,
// matchBigNumber for big-number, extractKeywords for keyword-highlight), and
// otherwise the fallback (the trimmed text for quote, leadingLabel(text.trim())
// for timeline and big-number); and calling it twice returns deeply equal data.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deriveData, leadingLabel } from '../../src/core/deriveData';
import {
  extractKeywords,
  matchBigNumber,
  matchQuote,
  matchTimeline,
} from '../../src/core/assignTemplate';
import type { SceneData, SceneTemplate } from '../../src/core/types';
import { editedText, sceneTemplate, transcript } from './arbitraries';

// Texts from transcripts and edited-text input, with whitespace padding at the
// edges so the trim step is exercised; kept only when non-empty after trimming.
const pad = fc.constantFrom('', ' ', '  ', '\t', '\n', '\u3000', ' \r\n ');
const text: fc.Arbitrary<string> = fc
  .tuple(pad, fc.oneof(transcript, editedText), pad)
  .map(([a, s, b]) => a + s + b)
  .filter((s) => s.trim() !== '');

/** Reference model written from the requirement text. */
function expected(template: SceneTemplate, raw: string): SceneData {
  const t = raw.trim();
  switch (template) {
    case 'quote': {
      const m = matchQuote(t);
      return { quote: m !== null ? m : t };
    }
    case 'timeline': {
      const m = matchTimeline(t);
      return { label: m !== null ? m : leadingLabel(t) };
    }
    case 'big-number': {
      const m = matchBigNumber(t);
      return { value: m !== null ? m : leadingLabel(t) };
    }
    case 'keyword-highlight':
      return { keywords: extractKeywords(t) };
  }
}

describe('Property 25: Data derivation follows matcher-or-fallback rules', () => {
  /** **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.10** */
  it('equals the matcher result on the trimmed text, else the fallback, and is deterministic', () => {
    fc.assert(
      fc.property(sceneTemplate, text, (template, raw) => {
        const first = deriveData(template, raw);
        expect(first).toEqual(expected(template, raw));
        const second = deriveData(template, raw);
        expect(second).toEqual(first);
      }),
      { numRuns: 300 },
    );
  });
});
