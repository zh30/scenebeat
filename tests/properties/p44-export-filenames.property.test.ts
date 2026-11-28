// Feature: scenebeat-edit-export, Property 44: Subtitle and video file names.
// For any valid Date, Aspect_Ratio, and Video_Container,
// formatSubtitleFilename(d, ext) matches
// ^scenebeat-subtitles-\d{8}-\d{6}\.(srt|vtt)$ with the given extension,
// formatVideoFilename(r, c, d) matches
// ^scenebeat-video-(16x9|9x16|1x1|4x5)-\d{8}-\d{6}\.(mp4|webm)$ with the
// Ratio_Tag of r and the extension c, and in both the digits equal the date's
// local year, month, day, hour, minute, and second, zero-padded.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatSubtitleFilename, formatVideoFilename } from '../../src/core/exportFilename';
import type { AspectRatioId } from '../../src/core/aspectRatio';
import type { VideoContainer } from '../../src/core/mimeType';

// Four-digit local years only, with a one-day margin for every time zone.
const minDate = new Date(0);
minDate.setUTCFullYear(0, 0, 2);
const validDate = fc.date({
  min: minDate,
  max: new Date(Date.UTC(9999, 11, 30)),
  noInvalidDate: true,
});

// Ratio_Tag table from Requirement 8.3, written independently of the code.
const RATIO_TAGS: Record<AspectRatioId, string> = {
  '16:9': '16x9',
  '9:16': '9x16',
  '1:1': '1x1',
  '4:5': '4x5',
};
const ratioArb = fc.constantFrom<AspectRatioId>('16:9', '9:16', '1:1', '4:5');
const containerArb = fc.constantFrom<VideoContainer>('mp4', 'webm');
const extArb = fc.constantFrom<'srt' | 'vtt'>('srt', 'vtt');

const subtitlePattern =
  /^scenebeat-subtitles-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.(srt|vtt)$/;
const videoPattern =
  /^scenebeat-video-(16x9|9x16|1x1|4x5)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.(mp4|webm)$/;

function expectLocalDigits(digits: string[], d: Date): void {
  const [y, mo, da, h, mi, s] = digits.map(Number);
  expect(y).toBe(d.getFullYear());
  expect(mo).toBe(d.getMonth() + 1);
  expect(da).toBe(d.getDate());
  expect(h).toBe(d.getHours());
  expect(mi).toBe(d.getMinutes());
  expect(s).toBe(d.getSeconds());
}

describe('Property 44: Subtitle and video file names', () => {
  /** **Validates: Requirements 12.4, 14.4** */
  it('subtitle and video names match their patterns and encode local date and time', () => {
    fc.assert(
      fc.property(validDate, extArb, ratioArb, containerArb, (d, ext, ratio, container) => {
        const sub = subtitlePattern.exec(formatSubtitleFilename(d, ext));
        expect(sub).not.toBeNull();
        expect(sub![7]).toBe(ext);
        expectLocalDigits(sub!.slice(1, 7), d);

        const vid = videoPattern.exec(formatVideoFilename(ratio, container, d));
        expect(vid).not.toBeNull();
        expect(vid![1]).toBe(RATIO_TAGS[ratio]);
        expect(vid![8]).toBe(container);
        expectLocalDigits(vid!.slice(2, 8), d);
      }),
      { numRuns: 200 },
    );
  });
});
