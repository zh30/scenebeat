// Feature: scenebeat-pwa, Property 61: Replace confirmation decision.
// For any Launch_Intent, current transcript, and sample transcript, `resolveLaunch`
// returns `noop` for `none`, and otherwise targets the intent's transcript (`''`,
// the sample, or the Shared_Transcript) and returns `confirm` exactly when the
// current transcript is non-empty after trimming and differs from the target,
// and `apply` otherwise.
// **Validates: Requirements 14.4, 14.5, 14.6, 15.7, 15.8**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveLaunch, type LaunchIntent } from '../../src/core/launchParams';

const SAMPLE_POOL = ['', 'First line. 2025年 we grew 3倍.', 'Hello world.', '  ', 'Note\nHello'];

const pad = fc.constantFrom('', ' ', '\n', '\t', '\u3000');
const text = fc.oneof(
  fc.constantFrom(...SAMPLE_POOL),
  fc.string({ unit: 'grapheme', maxLength: 40 }),
  fc.tuple(pad, fc.constantFrom(...SAMPLE_POOL), pad).map(([a, s, b]) => a + s + b),
);

const intentArb: fc.Arbitrary<LaunchIntent> = fc.oneof(
  fc.constant<LaunchIntent>({ kind: 'none' }),
  fc.constant<LaunchIntent>({ kind: 'new-transcript' }),
  fc.constant<LaunchIntent>({ kind: 'load-sample' }),
  // A Shared_Transcript is non-empty (an empty composition yields `none`).
  text.filter((t) => t !== '').map<LaunchIntent>((transcript) => ({ kind: 'share', transcript })),
);

/**
 * Inputs where the current transcript often equals the target exactly, or
 * equals it up to surrounding whitespace, to exercise both decision branches.
 */
const inputs = fc
  .tuple(intentArb, text, text, fc.constantFrom('random', 'sample', 'share', 'padded-sample', 'blank'), pad)
  .map(([intent, current, sample, mode, p]) => {
    const shared = intent.kind === 'share' ? intent.transcript : current;
    switch (mode) {
      case 'sample':
        return { intent, current: sample, sample };
      case 'share':
        return { intent, current: shared, sample };
      case 'padded-sample':
        return { intent, current: `${p}${sample} `, sample };
      case 'blank':
        return { intent, current: p, sample };
      default:
        return { intent, current, sample };
    }
  });

function expectedTarget(intent: LaunchIntent, sample: string): string | null {
  switch (intent.kind) {
    case 'none':
      return null;
    case 'new-transcript':
      return '';
    case 'load-sample':
      return sample;
    case 'share':
      return intent.transcript;
  }
}

describe('Property 61: Replace confirmation decision', () => {
  it('returns noop for none, else targets the intent transcript and confirms exactly when a different non-blank transcript would be replaced', () => {
    fc.assert(
      fc.property(inputs, ({ intent, current, sample }) => {
        const result = resolveLaunch(intent, current, sample);
        const target = expectedTarget(intent, sample);

        if (target === null) {
          expect(result).toStrictEqual({ kind: 'noop' });
          return;
        }

        const needsConfirm = current.trim() !== '' && current !== target;
        expect(result).toStrictEqual({
          kind: needsConfirm ? 'confirm' : 'apply',
          transcript: target,
          focusInput: intent.kind === 'new-transcript',
        });
      }),
      { numRuns: 300 },
    );
  });
});
