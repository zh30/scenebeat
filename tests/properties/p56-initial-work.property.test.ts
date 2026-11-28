// Feature: scenebeat-pwa, Property 56: Start-up state from storage.
// For any stored value (null, an arbitrary string, or a serialized valid
// Saved_Work) and any `videoSupported`, `initialWork` returns the parsed
// Saved_Work with `restored: true` when `parseWork` accepts the value, except
// that `exportFormat` `video` becomes the browser default when `videoSupported`
// is false; and returns the sample transcript, no overrides, and default
// settings with `restored: false` otherwise.
// **Validates: Requirements 13.3, 13.5, 13.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { initialWork, parseWork, serializeWork, type SavedWork } from '../../src/core/savedWork';
import { savedWorkArb, transcript } from './arbitraries';

const storedArb: fc.Arbitrary<{ stored: string | null; original: SavedWork | null }> = fc.oneof(
  fc.constant({ stored: null, original: null }),
  fc.string({ unit: 'grapheme', maxLength: 200 }).map((s) => ({ stored: s, original: null })),
  fc.jsonValue().map((v) => ({ stored: JSON.stringify(v), original: null })),
  savedWorkArb.map((w) => ({ stored: serializeWork(w), original: w })),
);

describe('Property 56: Start-up state from storage', () => {
  it('restores accepted work (with the video fallback) and otherwise uses the sample and defaults', () => {
    fc.assert(
      fc.property(storedArb, fc.boolean(), transcript, ({ stored, original }, videoSupported, sample) => {
        const result = initialWork(stored, videoSupported, sample);
        const parsed = stored === null ? null : parseWork(stored);

        if (parsed !== null && parsed.ok) {
          const expectedFormat =
            parsed.work.exportFormat === 'video' && !videoSupported ? 'subtitles' : parsed.work.exportFormat;
          expect(result.restored).toBe(true);
          expect(result.work).toStrictEqual({ ...parsed.work, exportFormat: expectedFormat });
          if (original !== null) {
            const fromOriginal =
              original.exportFormat === 'video' && !videoSupported ? 'subtitles' : original.exportFormat;
            expect(result.work).toStrictEqual({ ...original, exportFormat: fromOriginal });
          }
        } else {
          expect(original).toBeNull();
          expect(result.restored).toBe(false);
          expect(result.work).toStrictEqual({
            transcript: sample,
            overrides: {},
            aspectRatio: '16:9',
            exportFormat: videoSupported ? 'video' : 'subtitles',
            subtitleFormat: 'srt',
          });
        }
      }),
      { numRuns: 200 },
    );
  });
});
