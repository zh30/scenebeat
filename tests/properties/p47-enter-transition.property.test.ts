// Feature: scenebeat-edit-export, Property 47: Enter transition plays at each scene start and ends inside the scene.
// For any list of Display_Durations within [2000, 8000], for the planned
// frames, enterTransition(frame.elapsedMs) has opacity, translate, and scale
// within their start and end values; the first frame of every scene, including
// scene 0, has opacity below 1 (the transition is applied regardless of any
// reduced-motion setting, which the renderer does not read); and every frame
// with elapsedMs >= 450 has exactly opacity 1, translate 0, and scale 1, so
// each transition finishes before its scene ends.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  ENTER_OFFSET_PX,
  ENTER_TRANSITION_MS,
  enterTransition,
} from '../../src/core/transition';
import { displayDurations } from './arbitraries';

const FPS = 30;

interface Frame {
  sceneIndex: number;
  elapsedMs: number;
}

/**
 * Independent reference frame plan (the design's "Frame plan" rule): frame k
 * is at k * 1000 / 30 ms and belongs to the scene i with
 * starts[i] * 30 <= k * 1000 < (starts[i] + d_i) * 30.
 */
function referenceFrames(durations: readonly number[]): Frame[] {
  const total = durations.reduce((a, b) => a + b, 0);
  const n = Math.ceil((total * FPS) / 1000);
  const frames: Frame[] = [];
  let i = 0;
  let start = 0;
  for (let k = 0; k < n; k++) {
    while ((start + durations[i]) * FPS <= k * 1000) {
      start += durations[i];
      i++;
    }
    frames.push({ sceneIndex: i, elapsedMs: (k * 1000) / FPS - start });
  }
  return frames;
}

describe('Property 47: Enter transition plays at each scene start and ends inside the scene', () => {
  /** **Validates: Requirements 13.4, 13.5** */
  it('starts every scene mid-transition, stays in range, and settles exactly by 450 ms', () => {
    fc.assert(
      fc.property(displayDurations({ minLength: 1, maxLength: 12 }), (durations) => {
        const frames = referenceFrames(durations);
        const seen = new Set<number>();
        for (const f of frames) {
          const s = enterTransition(f.elapsedMs);

          // Within start and end values.
          expect(s.opacity).toBeGreaterThanOrEqual(0);
          expect(s.opacity).toBeLessThanOrEqual(1);
          expect(s.translateY).toBeGreaterThanOrEqual(0);
          expect(s.translateY).toBeLessThanOrEqual(ENTER_OFFSET_PX);
          expect(s.scale).toBeGreaterThanOrEqual(0.98);
          expect(s.scale).toBeLessThanOrEqual(1);

          // First frame of every scene is still entering.
          if (!seen.has(f.sceneIndex)) {
            seen.add(f.sceneIndex);
            expect(s.opacity).toBeLessThan(1);
          }

          // Settled exactly once the transition time has passed.
          if (f.elapsedMs >= ENTER_TRANSITION_MS) {
            expect(s).toEqual({ opacity: 1, translateY: 0, scale: 1 });
          }
        }
        // Every scene got a first frame, and the transition ends inside each
        // scene because every duration exceeds ENTER_TRANSITION_MS.
        expect(seen.size).toBe(durations.length);
        for (const d of durations) expect(d).toBeGreaterThan(ENTER_TRANSITION_MS);
      }),
      { numRuns: 200 },
    );
  });
});
