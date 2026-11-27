// Feature: scenebeat-mvp, Property 19: Serialized structure.
// For any Storyboard, the serialized text parses as JSON with `version`,
// `createdAt`, `sceneCount`, and `scenes`; every scene has the five required
// fields with the correct types; and the text is formatted with two-space
// indentation (equal to `JSON.stringify(parsed, null, 2)`).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import { serializeStoryboard } from '../../src/core/serialize';
import { TEMPLATES } from '../../src/core/types';

// Characters that drive every template rule and the splitter: English and CJK
// letters, digits, units, quotes, terminators, and whitespace.
const transcriptChar = fc.constantFrom(
  'a', 'e', 'n', 'r', 't', 'W', ' ', ' ', ' ',
  '中', '文', '我', '们', '年', '月', '日', '万', '亿', '倍',
  '0', '1', '2', '5', '9', '%', '$', '¥',
  '.', '!', '?', '。', '！', '？', '；', '…', '\n',
  '"', '“', '”', '「', '」', '『', '』',
);

const fragment = fc.constantFrom(
  'first ', 'then ', 'finally ', 'after that ', '首先', '最后',
  '2025', '1999年', '3月5日', '45%', '$120', '3倍', '“Hello world”', '「好」',
  'Revenue grew. ', '我们很高兴。',
);

const transcript = fc
  .array(fc.oneof(transcriptChar, fragment), { maxLength: 150 })
  .map((parts) => parts.join(''));

const createdAt = fc.date({
  min: new Date('1970-01-01T00:00:00.000Z'),
  max: new Date('2100-12-31T23:59:59.999Z'),
  noInvalidDate: true,
});

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe('Property 19: Serialized structure', () => {
  /** **Validates: Requirements 7.1, 7.2, 7.3** */
  it('serializes every storyboard with the required fields, types, and two-space indentation', () => {
    fc.assert(
      fc.property(transcript, createdAt, (text, now) => {
        const sb = buildStoryboard(text, now);
        const json = serializeStoryboard(sb);
        const parsed: unknown = JSON.parse(json);

        // Req 7.3: two-space indentation.
        expect(json).toBe(JSON.stringify(parsed, null, 2));

        // Req 7.1: root fields.
        expect(parsed).not.toBeNull();
        expect(typeof parsed).toBe('object');
        expect(Array.isArray(parsed)).toBe(false);
        const root = parsed as Record<string, unknown>;
        expect(Object.keys(root)).toEqual(['version', 'createdAt', 'sceneCount', 'scenes']);
        expect(typeof root.version).toBe('string');
        expect(typeof root.createdAt).toBe('string');
        expect(root.createdAt as string).toMatch(ISO_8601);
        expect(Number.isNaN(Date.parse(root.createdAt as string))).toBe(false);
        expect(Number.isInteger(root.sceneCount)).toBe(true);
        expect(Array.isArray(root.scenes)).toBe(true);

        // Req 7.2: per-scene fields.
        const scenes = root.scenes as unknown[];
        for (const s of scenes) {
          expect(s).not.toBeNull();
          expect(typeof s).toBe('object');
          expect(Array.isArray(s)).toBe(false);
          const scene = s as Record<string, unknown>;
          expect(Object.keys(scene)).toEqual(['index', 'text', 'template', 'durationMs', 'data']);
          expect(Number.isInteger(scene.index)).toBe(true);
          expect(typeof scene.text).toBe('string');
          expect((scene.text as string).length).toBeGreaterThan(0);
          expect(TEMPLATES).toContain(scene.template);
          expect(Number.isInteger(scene.durationMs)).toBe(true);
          expect(scene.data).not.toBeNull();
          expect(typeof scene.data).toBe('object');
          expect(Array.isArray(scene.data)).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
});
