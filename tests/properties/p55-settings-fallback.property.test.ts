// Feature: scenebeat-pwa, Property 55: Out-of-range settings fall back per field.
// For any valid Saved_Work and any subset of `aspectRatio`, `exportFormat`,
// `subtitleFormat` replaced by arbitrary values outside their allowed sets,
// the parser returns ok: true, each replaced field equals its default, and
// every other field equals the original.
// **Validates: Requirements 12.8**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseWork, serializeWork, type SavedWork } from '../../src/core/savedWork';
import {
  ASPECT_RATIO_IDS,
  EXPORT_FORMATS,
  SUBTITLE_FORMATS,
  outOfSetValueArb,
  savedWorkArb,
} from './arbitraries';

type SettingKey = 'aspectRatio' | 'exportFormat' | 'subtitleFormat';

const DEFAULTS: Record<SettingKey, string> = {
  aspectRatio: '16:9',
  exportFormat: 'video',
  subtitleFormat: 'srt',
};

// Each setting is either kept (undefined) or replaced by an out-of-set value.
const replacementsArb = fc
  .record({
    aspectRatio: fc.option(outOfSetValueArb(ASPECT_RATIO_IDS), { nil: undefined, freq: 2 }),
    exportFormat: fc.option(outOfSetValueArb(EXPORT_FORMATS), { nil: undefined, freq: 2 }),
    subtitleFormat: fc.option(outOfSetValueArb(SUBTITLE_FORMATS), { nil: undefined, freq: 2 }),
  })
  .map((r) => {
    const out: Partial<Record<SettingKey, unknown>> = {};
    for (const k of Object.keys(r) as SettingKey[]) {
      // fc.option uses undefined for "kept"; jsonValue never yields undefined.
      if (r[k] !== undefined) out[k] = r[k];
    }
    return out;
  });

describe('Property 55: Out-of-range settings fall back per field', () => {
  it('replaced settings become their defaults and other fields are kept', () => {
    fc.assert(
      fc.property(savedWorkArb, replacementsArb, (w, replacements) => {
        const obj = JSON.parse(serializeWork(w)) as Record<string, unknown>;
        for (const [k, v] of Object.entries(replacements)) obj[k] = v;

        const parsed = parseWork(JSON.stringify(obj));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        const expected: SavedWork = { ...w };
        for (const k of Object.keys(replacements) as SettingKey[]) {
          (expected as unknown as Record<SettingKey, string>)[k] = DEFAULTS[k];
        }
        expect(parsed.work).toStrictEqual(expected);
      }),
      { numRuns: 100 },
    );
  });
});
