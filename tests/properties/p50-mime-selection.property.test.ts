// Feature: scenebeat-edit-export, Property 50: Container selection prefers H.264 MP4, then WebM.
// For any predicate over the MIME candidates (including predicates that throw),
// pickMimeType returns the first MP4 avc1 candidate the predicate accepts when
// one exists, otherwise the first accepted WebM candidate, otherwise null; the
// returned container matches the MIME type's prefix; and detectVideoSupport
// reports supported exactly when MediaRecorder is present, captureStream is
// present, and pickMimeType returns a candidate.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MIME_CANDIDATES, pickMimeType } from '../../src/core/mimeType';
import { detectVideoSupport, type VideoEnv, type VideoSupport } from '../../src/video/support';

// Reference candidate lists written from Requirement 14.1 and the design's
// MIME selection list, independent of the code under test.
const MP4_AVC1 = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1.4D401F',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
];
const WEBM = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

type Behavior = 'accept' | 'reject' | 'throw';
const behavior = fc.constantFrom<Behavior>('accept', 'reject', 'throw');

/** A behavior for every reference candidate plus one for any other string. */
const predicateSpec = fc.record({
  known: fc.array(behavior, { minLength: MP4_AVC1.length + WEBM.length, maxLength: MP4_AVC1.length + WEBM.length }),
  other: behavior,
});

function buildPredicate(spec: { known: Behavior[]; other: Behavior }) {
  const all = [...MP4_AVC1, ...WEBM];
  return (type: string): boolean => {
    const i = all.indexOf(type);
    const b = i >= 0 ? spec.known[i] : spec.other;
    if (b === 'throw') throw new Error(`probe failed for ${type}`);
    return b === 'accept';
  };
}

describe('Property 50: Container selection prefers H.264 MP4, then WebM', () => {
  /** **Validates: Requirements 14.1, 16.1** */
  it('picks the first accepted avc1 MP4, else the first accepted WebM, else null', () => {
    // The candidate table is exactly the reference list, MP4 first.
    expect(MIME_CANDIDATES.map((c) => c.mimeType)).toEqual([...MP4_AVC1, ...WEBM]);

    fc.assert(
      fc.property(predicateSpec, (spec) => {
        const accepted = (types: string[], offset: number) =>
          types.find((_, j) => spec.known[offset + j] === 'accept');
        const mp4 = accepted(MP4_AVC1, 0);
        const webm = accepted(WEBM, MP4_AVC1.length);
        const expected = mp4
          ? { mimeType: mp4, container: 'mp4' }
          : webm
            ? { mimeType: webm, container: 'webm' }
            : null;

        let result: ReturnType<typeof pickMimeType> = null;
        expect(() => {
          result = pickMimeType(buildPredicate(spec));
        }).not.toThrow();
        expect(result).toEqual(expected);

        if (result !== null) {
          const { mimeType, container } = result as { mimeType: string; container: string };
          expect(mimeType.startsWith(`video/${container}`)).toBe(true);
          expect(mimeType).not.toMatch(/mp4a|opus/);
        }
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 14.1, 16.1** */
  it('detectVideoSupport is supported exactly when MediaRecorder, captureStream, and a candidate exist', () => {
    const envSpec = fc.record({
      recorder: fc.constantFrom('absent', 'no-isTypeSupported', 'with-isTypeSupported'),
      canvasCaptureStream: fc.boolean(),
      predicate: predicateSpec,
    });

    fc.assert(
      fc.property(envSpec, (spec) => {
        const predicate = buildPredicate(spec.predicate);
        const env: VideoEnv =
          spec.recorder === 'absent'
            ? { canvasCaptureStream: spec.canvasCaptureStream }
            : spec.recorder === 'no-isTypeSupported'
              ? { MediaRecorder: {}, canvasCaptureStream: spec.canvasCaptureStream }
              : { MediaRecorder: { isTypeSupported: predicate }, canvasCaptureStream: spec.canvasCaptureStream };

        // Independent model: some reference candidate is accepted.
        const anyAccepted = spec.predicate.known.some((b) => b === 'accept');
        const expectedSupported =
          spec.recorder === 'with-isTypeSupported' && spec.canvasCaptureStream && anyAccepted;

        let result: VideoSupport = { supported: false };
        expect(() => {
          result = detectVideoSupport(env);
        }).not.toThrow();

        const r = result as VideoSupport;
        expect(r.supported).toBe(expectedSupported);
        if (r.supported) {
          const pick = pickMimeType(predicate);
          expect(pick).not.toBeNull();
          expect({ mimeType: r.mimeType, container: r.container }).toEqual(pick);
        } else {
          expect(r).toEqual({ supported: false });
        }
      }),
      { numRuns: 200 },
    );
  });
});
