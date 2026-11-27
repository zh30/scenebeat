import { describe, expect, it } from 'vitest';
import { buildStoryboard } from '../src/core/buildStoryboard';
import { serializeStoryboard } from '../src/core/serialize';
import { TEMPLATES } from '../src/core/types';
import { validateStoryboard } from '../src/core/validate';
import { SAMPLE_TRANSCRIPT } from '../src/data/sampleTranscript';

// Requirement 1.2: the Sample_Transcript covers all four templates and both languages.
describe('SAMPLE_TRANSCRIPT', () => {
  const storyboard = buildStoryboard(SAMPLE_TRANSCRIPT, new Date('2026-10-31T00:00:00Z'));

  it('builds a storyboard that uses every scene template', () => {
    const used = new Set(storyboard.scenes.map((s) => s.template));
    for (const template of TEMPLATES) {
      expect(used, `missing template ${template}`).toContain(template);
    }
  });

  it('contains Chinese characters', () => {
    expect(SAMPLE_TRANSCRIPT).toMatch(/\p{Script=Han}/u);
  });

  it('contains English words', () => {
    expect(SAMPLE_TRANSCRIPT).toMatch(/[A-Za-z]+/);
  });

  it('produces a storyboard that passes validation', () => {
    const json = JSON.parse(serializeStoryboard(storyboard)) as unknown;
    expect(validateStoryboard(json)).toEqual([]);
  });
});
