/**
 * Install platform signals. Every browser API (`matchMedia`, user agent,
 * `navigator.standalone`, window listeners) arrives through `InstallEnv`, so
 * tests can pass fakes. The state machine itself lives in
 * `src/core/installPrompt.ts`; `usePwa.ts` wires the two together.
 */

import { initialInstallSignals, type InstallSignals } from '../core/installPrompt';

/** The `beforeinstallprompt` event (not in the DOM typings). */
export interface InstallPromptEventLike extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface MediaQueryLike {
  matches: boolean;
  addEventListener(type: 'change', f: () => void): void;
  removeEventListener(type: 'change', f: () => void): void;
}

export interface InstallEnv {
  matchMedia(query: string): MediaQueryLike;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** iOS `navigator.standalone`; `undefined` elsewhere. */
  navigatorStandalone: boolean | undefined;
  /** Adds a window listener and returns a function that removes it. */
  addWindowListener(type: 'beforeinstallprompt' | 'appinstalled', f: (e: Event) => void): () => void;
}

/** Display-mode media queries that count as Standalone_Mode. */
export const STANDALONE_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: window-controls-overlay)',
] as const;

export function isStandalone(env: InstallEnv): boolean {
  if (env.navigatorStandalone === true) return true;
  return STANDALONE_QUERIES.some((q) => {
    try {
      return env.matchMedia(q).matches;
    } catch {
      return false;
    }
  });
}

export function isIosSafari(env: InstallEnv): boolean {
  const ua = env.userAgent;
  const iosDevice =
    /iPhone|iPad|iPod/.test(ua) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
  if (!iosDevice) return false;
  return !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** Initial Install_State_Machine signals from the platform and the dismissal flag. */
export function platformInstallSignals(env: InstallEnv, dismissed: boolean): InstallSignals {
  return initialInstallSignals({
    standalone: isStandalone(env),
    iosSafari: isIosSafari(env),
    dismissed,
  });
}
