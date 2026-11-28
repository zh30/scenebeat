/**
 * Real browser `PwaDeps`. This is the only module that imports
 * `virtual:pwa-register` and reads browser globals for the PWA layer.
 * Only `src/main.tsx` imports it; tests use `defaultPwaDeps()` or fakes
 * (Requirements 4.3, 6.2, 6.3, 10.3, 13.2, 16.3, 16.5).
 */

import { registerSW } from 'virtual:pwa-register';
import type { PwaDeps } from './deps';
import type { InstallEnv, MediaQueryLike } from './install';
import type { LaunchEnv, LaunchQueueLike } from './launch';
import type { RegisterSW } from './register';
import type { StorageLike, Timers } from './storage';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };
type WindowWithLaunchQueue = Window & { launchQueue?: LaunchQueueLike };

function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

const browserTimers: Timers = {
  setTimeout: (f, ms) => window.setTimeout(f, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

/** Wraps a `MediaQueryList`, falling back to `addListener` on older Safari. */
function mediaQuery(query: string): MediaQueryLike {
  const mql = window.matchMedia(query);
  return {
    get matches() {
      return mql.matches;
    },
    addEventListener(type, f) {
      if (typeof mql.addEventListener === 'function') mql.addEventListener(type, f);
      else mql.addListener(f);
    },
    removeEventListener(type, f) {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener(type, f);
      else mql.removeListener(f);
    },
  };
}

function browserInstallEnv(): InstallEnv | null {
  if (typeof window.matchMedia !== 'function') return null;
  const nav = navigator as NavigatorWithStandalone;
  return {
    matchMedia: mediaQuery,
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    navigatorStandalone: nav.standalone,
    addWindowListener(type, f) {
      window.addEventListener(type, f);
      return () => window.removeEventListener(type, f);
    },
  };
}

function browserLaunchEnv(): LaunchEnv {
  const env: LaunchEnv = {
    initialSearch: window.location.search,
    replaceSearch(search) {
      const { pathname, hash } = window.location;
      const query = search === '' || search.startsWith('?') ? search : `?${search}`;
      window.history.replaceState(window.history.state, '', `${pathname}${query}${hash}`);
    },
  };
  const queue = (window as WindowWithLaunchQueue).launchQueue;
  if (queue && typeof queue.setConsumer === 'function') env.launchQueue = queue;
  return env;
}

function onHidden(f: () => void): () => void {
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') f();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', f);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', f);
  };
}

export function createBrowserPwaDeps(): PwaDeps {
  if ((navigator as NavigatorWithStandalone).standalone === true) {
    document.documentElement.classList.add('sb-standalone');
  }
  return {
    sw: {
      isProduction: import.meta.env.PROD,
      supported: 'serviceWorker' in navigator,
      registerSW: registerSW as RegisterSW,
    },
    install: browserInstallEnv(),
    storage: browserStorage(),
    timers: browserTimers,
    launch: browserLaunchEnv(),
    onHidden,
  };
}
