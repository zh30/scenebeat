/**
 * PWA hook: install prompt, update prompt, and offline-ready notice.
 *
 * Every browser API arrives through `PwaDeps`; the decisions are made by the
 * pure modules `src/core/installPrompt.ts` and `src/core/updateGate.ts`.
 * Requirements 6.4, 7.1, 7.3, 7.6, 7.7, 8.1, 8.2, 8.3, 9.1 to 9.5, 9.8.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  initialInstallSignals,
  installReducer,
  installState as toInstallState,
  type InstallState,
} from '../core/installPrompt';
import { updateGate, type UpdateView } from '../core/updateGate';
import type { PwaDeps } from './deps';
import {
  isStandalone,
  platformInstallSignals,
  STANDALONE_QUERIES,
  type InstallPromptEventLike,
  type MediaQueryLike,
} from './install';
import { startServiceWorker, type ServiceWorkerHandle } from './register';
import { readFlag, writeFlag } from './storage';

export const INSTALL_DISMISSED_KEY = 'scenebeat:install-dismissed:v1';
export const OFFLINE_READY_SHOWN_KEY = 'scenebeat:offline-ready-shown:v1';
export const OFFLINE_READY_MS = 8000;

export interface PwaStatus {
  renderInProgress: boolean;
  editing: boolean;
  /** Writes pending Saved_Work now (the Work_Store `flush`). */
  flushWork(): void;
}

export interface PwaApi {
  installState: InstallState;
  install(): void;
  dismissInstall(): void;
  update: UpdateView;
  reload(): void;
  later(): void;
  offlineReady: boolean;
  dismissOfflineReady(): void;
}

export function usePwa(deps: PwaDeps, status: PwaStatus): PwaApi {
  // ---- Install -----------------------------------------------------------
  const [signals, dispatch] = useReducer(installReducer, deps, (d: PwaDeps) => {
    const dismissed = readFlag(d.storage, INSTALL_DISMISSED_KEY);
    return d.install === null
      ? initialInstallSignals({ standalone: false, iosSafari: false, dismissed })
      : platformInstallSignals(d.install, dismissed);
  });
  const promptRef = useRef<InstallPromptEventLike | null>(null);

  useEffect(() => {
    const env = deps.install;
    if (env === null) return undefined;

    const offPrompt = env.addWindowListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      promptRef.current = e as InstallPromptEventLike;
      dispatch({ type: 'prompt-captured' });
    });
    const offInstalled = env.addWindowListener('appinstalled', () => {
      promptRef.current = null;
      dispatch({ type: 'app-installed' });
    });

    const onDisplayChange = (): void => {
      dispatch({ type: 'standalone-changed', standalone: isStandalone(env) });
    };
    const queries: MediaQueryLike[] = [];
    for (const q of STANDALONE_QUERIES) {
      try {
        const mql = env.matchMedia(q);
        mql.addEventListener('change', onDisplayChange);
        queries.push(mql);
      } catch {
        // matchMedia unavailable for this query: no display-mode tracking.
      }
    }

    return () => {
      offPrompt();
      offInstalled();
      for (const mql of queries) mql.removeEventListener('change', onDisplayChange);
    };
  }, [deps.install]);

  const install = useCallback((): void => {
    const event = promptRef.current;
    if (event === null) return;
    promptRef.current = null; // a prompt can be used once
    const closed = (): void => dispatch({ type: 'prompt-closed' });
    let shown: Promise<void>;
    try {
      shown = Promise.resolve(event.prompt());
    } catch {
      closed();
      return;
    }
    // A rejected prompt() or userChoice counts as the dialog being closed (9.3).
    shown.then(() => event.userChoice).then(closed, closed);
  }, []);

  const dismissInstall = useCallback((): void => {
    writeFlag(deps.storage, INSTALL_DISMISSED_KEY);
    dispatch({ type: 'dismissed' });
  }, [deps.storage]);

  // ---- Service worker: update and offline ready --------------------------
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateLater, setUpdateLater] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const handleRef = useRef<ServiceWorkerHandle | null>(null);
  const offlineTimerRef = useRef<number | null>(null);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const clearOfflineTimer = useCallback((): void => {
    if (offlineTimerRef.current !== null) {
      depsRef.current.timers.clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // startServiceWorker registers at most once per `deps.sw` object.
    handleRef.current = startServiceWorker(deps.sw, {
      onNeedRefresh: () => setUpdateAvailable(true),
      onOfflineReady: () => {
        const d = depsRef.current;
        if (readFlag(d.storage, OFFLINE_READY_SHOWN_KEY)) return;
        writeFlag(d.storage, OFFLINE_READY_SHOWN_KEY);
        setOfflineReady(true);
        clearOfflineTimer();
        offlineTimerRef.current = d.timers.setTimeout(() => {
          offlineTimerRef.current = null;
          setOfflineReady(false);
        }, OFFLINE_READY_MS);
      },
      onRegisterError: () => {
        // Registration failed: no Update_Prompt or Offline_Ready_Notice (6.4).
        setUpdateAvailable(false);
        setOfflineReady(false);
      },
    });
  }, [deps.sw, clearOfflineTimer]);

  useEffect(() => clearOfflineTimer, [clearOfflineTimer]);

  const dismissOfflineReady = useCallback((): void => {
    clearOfflineTimer();
    setOfflineReady(false);
  }, [clearOfflineTimer]);

  const update = updateGate({
    updateAvailable,
    renderInProgress: status.renderInProgress,
    editing: status.editing,
    later: updateLater,
  });

  const { flushWork } = status;
  const reloadEnabled = update.reloadEnabled;
  const reload = useCallback((): void => {
    if (!reloadEnabled) return;
    const handle = handleRef.current;
    if (handle === null) return;
    flushWork();
    handle.applyUpdate().catch(() => {
      // Activation failed; the current version keeps running.
    });
  }, [reloadEnabled, flushWork]);

  const later = useCallback((): void => setUpdateLater(true), []);

  return {
    installState: deps.install === null ? 'hidden' : toInstallState(signals),
    install,
    dismissInstall,
    update,
    reload,
    later,
    offlineReady,
    dismissOfflineReady,
  };
}
