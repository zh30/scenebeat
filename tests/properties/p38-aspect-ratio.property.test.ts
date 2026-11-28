// Feature: scenebeat-edit-export, Property 38: Aspect ratio dimensions.
// For any Aspect_Ratio in the table, width * second = height * first for the
// ratio first:second, both dimensions are even positive integers, and the
// dimensions equal those listed in Requirement 8.3.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  ASPECT_RATIOS,
  getAspectRatio,
  type AspectRatioId,
} from '../../src/core/aspectRatio';

// Reference table written from Requirement 8.3, independent of the code.
const EXPECTED: Record<AspectRatioId, { width: number; height: number; tag: string }> = {
  '16:9': { width: 1920, height: 1080, tag: '16x9' },
  '9:16': { width: 1080, height: 1920, tag: '9x16' },
  '1:1': { width: 1080, height: 1080, tag: '1x1' },
  '4:5': { width: 1080, height: 1350, tag: '4x5' },
};

const ratioId = fc.constantFrom<AspectRatioId>('16:9', '9:16', '1:1', '4:5');

describe('Property 38: Aspect ratio dimensions', () => {
  /** **Validates: Requirements 8.3, 8.4** */
  it('maps each ratio to even integer dimensions in the exact proportion', () => {
    expect(ASPECT_RATIOS.map((r) => r.id).sort()).toEqual(Object.keys(EXPECTED).sort());

    fc.assert(
      fc.property(ratioId, (id) => {
        const spec = getAspectRatio(id);
        const [first, second] = id.split(':').map(Number);
        expect(spec.id).toBe(id);
        expect(Number.isInteger(spec.width)).toBe(true);
        expect(Number.isInteger(spec.height)).toBe(true);
        expect(spec.width).toBeGreaterThan(0);
        expect(spec.height).toBeGreaterThan(0);
        expect(spec.width % 2).toBe(0);
        expect(spec.height % 2).toBe(0);
        expect(spec.width * second).toBe(spec.height * first);
        expect({ width: spec.width, height: spec.height, tag: spec.tag }).toEqual(EXPECTED[id]);
        // The table entry and the lookup agree.
        expect(ASPECT_RATIOS.find((r) => r.id === id)).toBe(spec);
      }),
      { numRuns: 100 },
    );
  });
});
