// Feature: scenebeat-pwa, Property 62: Install state invariant.
// For any initial platform signals and any sequence of Install events, after
// every step `installState` returns exactly one of the four states; it is
// `installed` whenever `standalone` is true or `app-installed` has occurred; it
// is `hidden` whenever a dismissal has occurred and the state is not
// `installed`; it is `install-available` only while a captured prompt has not
// been closed; and it is `ios-instructions` only when `iosSafari` is true and no
// captured prompt is pending.
// **Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  initialInstallSignals,
  installReducer,
  installState,
  type InstallState,
} from '../../src/core/installPrompt';
import { installEventsArb } from './arbitraries';

const STATES: readonly InstallState[] = ['hidden', 'install-available', 'ios-instructions', 'installed'];

describe('Property 62: Install state invariant', () => {
  it('holds after every Install event', () => {
    fc.assert(
      fc.property(installEventsArb, ({ initial, events }) => {
        // Independent model of the history, tracked by the test itself.
        let standalone = initial.standalone;
        let installedOccurred = false;
        let dismissedOccurred = initial.dismissed;
        let promptPending = false;

        let signals = initialInstallSignals(initial);

        const check = () => {
          const state = installState(signals);
          expect(STATES).toContain(state);

          if (standalone || installedOccurred) {
            expect(state).toBe('installed');
          } else {
            expect(state).not.toBe('installed');
            if (dismissedOccurred) expect(state).toBe('hidden');
          }
          if (state === 'install-available') expect(promptPending).toBe(true);
          if (state === 'ios-instructions') {
            expect(initial.iosSafari).toBe(true);
            expect(promptPending).toBe(false);
          }
          // A pending prompt with nothing hiding it must be offered.
          if (promptPending && !standalone && !installedOccurred && !dismissedOccurred) {
            expect(state).toBe('install-available');
          }
        };

        check();
        for (const e of events) {
          switch (e.type) {
            case 'prompt-captured':
              promptPending = true;
              break;
            case 'prompt-closed':
              promptPending = false;
              break;
            case 'app-installed':
              installedOccurred = true;
              promptPending = false;
              break;
            case 'standalone-changed':
              standalone = e.standalone;
              break;
            case 'dismissed':
              dismissedOccurred = true;
              break;
          }
          signals = installReducer(signals, e);
          check();
        }
      }),
      { numRuns: 100 },
    );
  });
});
