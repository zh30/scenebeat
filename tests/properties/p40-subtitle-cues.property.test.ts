// Feature: scenebeat-edit-export, Property 40: Subtitle cues follow scene timing.
// For any edited storyboard, buildCues returns one cue per scene in order with
// numbers 1..n; cue 1 starts at 0; each cue starts where the previous one ends;
// each cue's end minus start equals its scene's Display_Duration and is
// positive; the last cue ends at the sum of all durations; and each cue's text
// equals its scene's text.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildEditedStoryboard } from '../../src/core/editedStoryboard';
import { buildCues } from '../../src/core/subtitles';
import { storyboardWithOverrides } from './arbitraries';

describe('Property 40: Subtitle cues follow scene timing', () => {
  /** **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6** */
  it('produces back-to-back cues that match scene order, durations, and text', () => {
    fc.assert(
      fc.property(storyboardWithOverrides, ({ auto, overrides }) => {
        const sb = buildEditedStoryboard(auto, overrides);
        const cues = buildCues(sb);

        expect(cues).toHaveLength(sb.scenes.length);

        let expectedStart = 0;
        cues.forEach((cue, i) => {
          const scene = sb.scenes[i];
          expect(cue.number).toBe(i + 1);
          expect(cue.startMs).toBe(expectedStart);
          expect(cue.endMs - cue.startMs).toBe(scene.durationMs);
          expect(cue.endMs).toBeGreaterThan(cue.startMs);
          expect(cue.text).toBe(scene.text);
          expectedStart = cue.endMs;
        });

        const sum = sb.scenes.reduce((acc, s) => acc + s.durationMs, 0);
        if (cues.length > 0) {
          expect(cues[0].startMs).toBe(0);
          expect(cues[cues.length - 1].endMs).toBe(sum);
        }
      }),
      { numRuns: 200 },
    );
  });
});
