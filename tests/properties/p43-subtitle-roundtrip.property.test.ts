// Feature: scenebeat-edit-export, Property 43: SRT and WebVTT round trip.
// For any edited storyboard (with generated scene texts that include `&`, `<`,
// `>`, `-->`, existing entities such as `&lt;`, CJK, and emoji), with
// cues = buildCues(sb): parseSubtitles(formatSrt(cues), 'srt') and
// parseSubtitles(formatVtt(cues), 'vtt') both return { ok: true, cues };
// neither output contains `\r`; every cue block has exactly three lines; and
// the VTT cue text lines contain no `<` or `>`.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildEditedStoryboard } from '../../src/core/editedStoryboard';
import { buildCues, formatSrt, formatVtt, parseSubtitles } from '../../src/core/subtitles';
import { storyboardWithOverrides } from './arbitraries';

const VTT_HEADER = 'WEBVTT\n\n';

/** Splits a cue body (header removed) into blocks, each a list of lines. */
function blocksOf(body: string): string[][] {
  if (body === '') return [];
  expect(body.endsWith('\n\n')).toBe(true);
  return body
    .slice(0, -2)
    .split('\n\n')
    .map((b) => b.split('\n'));
}

describe('Property 43: SRT and WebVTT round trip', () => {
  /** **Validates: Requirements 11.6, 11.7, 11.9, 11.10** */
  it('formats and parses SRT and WebVTT back to the same cues', () => {
    fc.assert(
      fc.property(storyboardWithOverrides, ({ auto, overrides }) => {
        const sb = buildEditedStoryboard(auto, overrides);
        const cues = buildCues(sb);

        const srt = formatSrt(cues);
        const vtt = formatVtt(cues);

        expect(parseSubtitles(srt, 'srt')).toEqual({ ok: true, cues });
        expect(parseSubtitles(vtt, 'vtt')).toEqual({ ok: true, cues });

        expect(srt.includes('\r')).toBe(false);
        expect(vtt.includes('\r')).toBe(false);

        expect(vtt.startsWith(VTT_HEADER)).toBe(true);
        const srtBlocks = blocksOf(srt);
        const vttBlocks = blocksOf(vtt.slice(VTT_HEADER.length));
        expect(srtBlocks).toHaveLength(cues.length);
        expect(vttBlocks).toHaveLength(cues.length);
        for (const block of [...srtBlocks, ...vttBlocks]) {
          expect(block).toHaveLength(3);
        }
        for (const block of vttBlocks) {
          expect(/[<>]/.test(block[2])).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
});
