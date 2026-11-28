/**
 * Every browser API the PWA layer uses, gathered into one injected object.
 *
 * `App` receives a `PwaDeps` through its optional `pwa` prop. The real
 * browser values are built by `src/pwa/browserDeps.ts`, which only
 * `src/main.tsx` imports. `defaultPwaDeps()` is the safe fallback used when
 * no prop is passed (tests, existing component tests): no service worker,
 * no install UI, in-memory storage, and an empty launch URL
 * (Requirements 6.5, 13.11, 17.8).
 */

import type { InstallEnv } from './install';
import type { LaunchEnv } from './launch';
import type { RegisterSW, ServiceWorkerDeps } from './register';
import { createMemoryStorage, type StorageLike, type Timers } from './storage';

export interface PwaDeps {
  /** Service worker registration inputs for `startServiceWorker`. */
  sw: ServiceWorkerDeps;
  /** `null`: the Install_UI stays hidden. */
  install: InstallEnv | null;
  /** `null`: `localStorage` is unavailable. */
  storage: StorageLike | null;
  timers: Timers;
  launch: LaunchEnv;
  /** Subscribes to `visibilitychange` (hidden only) and `pagehide`; returns an unsubscribe function. */
  onHidden(f: () => void): () => void;
}

/** A `registerSW` that never registers; unused because `supported` is false. */
const noRegisterSW: RegisterSW = () => async () => {};

/** Real timer functions, typed as numeric ids regardless of the runtime (browser or Node). */
const realTimers: Timers = {
  setTimeout: (f, ms) => globalThis.setTimeout(f, ms) as unknown as number,
  clearTimeout: (id) => {
    globalThis.clearTimeout(id as unknown as Parameters<typeof globalThis.clearTimeout>[0]);
  },
};

/** Defaults with no browser integration: no SW, no install env, in-memory storage, empty search. */
export function defaultPwaDeps(): PwaDeps {
  return {
    sw: { isProduction: false, supported: false, registerSW: noRegisterSW },
    install: null,
    storage: createMemoryStorage(),
    timers: realTimers,
    launch: {
      initialSearch: '',
      replaceSearch: () => {},
    },
    onHidden: () => () => {},
  };
}
