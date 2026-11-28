import { describe, expect, it, vi } from 'vitest';
import {
  startServiceWorker,
  type RegisterSW,
  type ServiceWorkerDeps,
  type SwCallbacks,
} from '../src/pwa/register';

// Requirements 6.2, 6.3, 6.4, 6.5, 17.5

type Opts = Parameters<RegisterSW>[0];

function fakeRegister() {
  const calls: Opts[] = [];
  const updateSW = vi.fn(async (_reload?: boolean) => {});
  const registerSW: RegisterSW = (opts) => {
    calls.push(opts);
    return updateSW;
  };
  return { calls, updateSW, registerSW };
}

function callbacks() {
  return {
    onNeedRefresh: vi.fn<() => void>(),
    onOfflineReady: vi.fn<() => void>(),
    onRegisterError: vi.fn<(e: unknown) => void>(),
  } satisfies SwCallbacks;
}

function deps(registerSW: RegisterSW, over: Partial<ServiceWorkerDeps> = {}): ServiceWorkerDeps {
  return { isProduction: true, supported: true, registerSW, ...over };
}

describe('startServiceWorker', () => {
  it('registers once in production with immediate: true and forwards callbacks', () => {
    const f = fakeRegister();
    const cb = callbacks();
    const handle = startServiceWorker(deps(f.registerSW), cb);

    expect(handle).not.toBeNull();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].immediate).toBe(true);

    f.calls[0].onNeedRefresh();
    f.calls[0].onOfflineReady();
    expect(cb.onNeedRefresh).toHaveBeenCalledTimes(1);
    expect(cb.onOfflineReady).toHaveBeenCalledTimes(1);
  });

  it('does not register outside production', () => {
    const f = fakeRegister();
    expect(startServiceWorker(deps(f.registerSW, { isProduction: false }), callbacks())).toBeNull();
    expect(f.calls).toHaveLength(0);
  });

  it('does not register when service workers are unsupported', () => {
    const f = fakeRegister();
    expect(startServiceWorker(deps(f.registerSW, { supported: false }), callbacks())).toBeNull();
    expect(f.calls).toHaveLength(0);
  });

  it('does not register again for the same deps object', () => {
    const f = fakeRegister();
    const d = deps(f.registerSW);
    const first = startServiceWorker(d, callbacks());
    const second = startServiceWorker(d, callbacks());
    expect(f.calls).toHaveLength(1);
    expect(second).toBe(first);
  });

  it('after onRegisterError, update and offline callbacks are ignored', () => {
    const f = fakeRegister();
    const cb = callbacks();
    startServiceWorker(deps(f.registerSW), cb);
    const err = new Error('register failed');

    f.calls[0].onRegisterError(err);
    f.calls[0].onNeedRefresh();
    f.calls[0].onOfflineReady();

    expect(cb.onRegisterError).toHaveBeenCalledWith(err);
    expect(cb.onNeedRefresh).not.toHaveBeenCalled();
    expect(cb.onOfflineReady).not.toHaveBeenCalled();
  });

  it('returns null and reports the error when registerSW throws', () => {
    const cb = callbacks();
    const err = new Error('boom');
    const registerSW: RegisterSW = () => {
      throw err;
    };
    expect(() => startServiceWorker(deps(registerSW), cb)).not.toThrow();
    expect(cb.onRegisterError).toHaveBeenCalledWith(err);
  });

  it('applyUpdate calls updateSW(true)', async () => {
    const f = fakeRegister();
    const handle = startServiceWorker(deps(f.registerSW), callbacks());
    await handle!.applyUpdate();
    expect(f.updateSW).toHaveBeenCalledTimes(1);
    expect(f.updateSW).toHaveBeenCalledWith(true);
  });
});
