/**
 * Service worker registration behind an injected `registerSW`.
 *
 * This module never imports `virtual:pwa-register`; `src/pwa/browserDeps.ts`
 * (imported only by `src/main.tsx`) passes the plugin's `registerSW` in.
 * Tests can therefore import this module and pass fakes without resolving
 * the virtual module. Registration happens only when `isProduction` and
 * `supported` are both true (Requirements 6.2, 6.3, 6.5).
 */

export interface SwCallbacks {
  onNeedRefresh(): void;
  onOfflineReady(): void;
  onRegisterError(e: unknown): void;
}

/** Shape of `registerSW` from `virtual:pwa-register`, narrowed to what we use. */
export type RegisterSW = (
  opts: { immediate: true } & SwCallbacks,
) => (reloadPage?: boolean) => Promise<void>;

export interface ServiceWorkerHandle {
  /** Activates the waiting worker, then reloads the page (Requirement 7.6). */
  applyUpdate(): Promise<void>;
}

export interface ServiceWorkerDeps {
  /** `import.meta.env.PROD` in `main.tsx`. */
  isProduction: boolean;
  /** `'serviceWorker' in navigator`. */
  supported: boolean;
  registerSW: RegisterSW;
}

const started = new WeakMap<ServiceWorkerDeps, ServiceWorkerHandle | null>();

/**
 * Registers the service worker once per `deps` object.
 * Returns `null` when registration is skipped (dev, tests, unsupported browser)
 * or `registerSW` throws. After a registration error, later update and
 * offline-ready callbacks are ignored (Requirement 6.4).
 */
export function startServiceWorker(
  deps: ServiceWorkerDeps,
  cb: SwCallbacks,
): ServiceWorkerHandle | null {
  if (started.has(deps)) return started.get(deps) ?? null;
  if (!deps.isProduction || !deps.supported) {
    started.set(deps, null);
    return null;
  }

  let failed = false;
  const fail = (e: unknown): void => {
    if (failed) return;
    failed = true;
    cb.onRegisterError(e);
  };

  let updateSW: (reloadPage?: boolean) => Promise<void>;
  try {
    updateSW = deps.registerSW({
      immediate: true,
      onNeedRefresh: () => {
        if (!failed) cb.onNeedRefresh();
      },
      onOfflineReady: () => {
        if (!failed) cb.onOfflineReady();
      },
      onRegisterError: fail,
    });
  } catch (e) {
    started.set(deps, null);
    fail(e);
    return null;
  }

  const handle: ServiceWorkerHandle = {
    applyUpdate: () => updateSW(true),
  };
  started.set(deps, handle);
  return handle;
}
