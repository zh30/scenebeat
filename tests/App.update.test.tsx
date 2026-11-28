import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App, REGENERATE_DEBOUNCE_MS } from '../src/components/App';
import { SAVED_WORK_KEY } from '../src/core/savedWork';
import { defaultPwaDeps, type PwaDeps } from '../src/pwa/deps';
import type { RegisterSW, SwCallbacks } from '../src/pwa/register';
import { createMemoryStorage, type StorageLike } from '../src/pwa/storage';
import { OFFLINE_READY_MS, OFFLINE_READY_SHOWN_KEY } from '../src/pwa/usePwa';

const UPDATE_TITLE = 'New version available';
const OFFLINE_TITLE = 'Ready to work offline';
const EDIT_TRANSCRIPT = 'Alpha bravo. Charlie delta. Echo foxtrot.';

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const queryText = (text: string) => screen.queryByText(text);
const textarea = () => screen.getByLabelText('Transcript') as HTMLTextAreaElement;

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

interface FakeSw {
  deps: PwaDeps;
  storage: StorageLike;
  registerSW: ReturnType<typeof vi.fn>;
  updateSW: ReturnType<typeof vi.fn>;
  /** Order of storage writes of the Saved_Work_Key and update activations. */
  log: string[];
  callbacks(): SwCallbacks;
}

function fakeSw(): FakeSw {
  const log: string[] = [];
  const inner = createMemoryStorage();
  const storage: StorageLike = {
    getItem: (k) => inner.getItem(k),
    removeItem: (k) => inner.removeItem(k),
    setItem: (k, v) => {
      if (k === SAVED_WORK_KEY) log.push('save');
      inner.setItem(k, v);
    },
  };
  let captured: SwCallbacks | null = null;
  const updateSW = vi.fn(async (_reload?: boolean) => {
    log.push('apply');
  });
  const registerSW = vi.fn(((opts) => {
    captured = opts;
    return updateSW;
  }) as RegisterSW);
  const deps: PwaDeps = {
    ...defaultPwaDeps(),
    sw: { isProduction: true, supported: true, registerSW: registerSW as unknown as RegisterSW },
    storage,
  };
  return {
    deps,
    storage,
    registerSW,
    updateSW,
    log,
    callbacks: () => {
      if (captured === null) throw new Error('registerSW was not called');
      return captured;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App update prompt (Req 6.4, 7.1, 7.3, 7.5, 7.6, 7.7)', () => {
  it('registers once and shows the toast when an update is waiting', () => {
    const sw = fakeSw();
    render(<App pwa={sw.deps} />);
    expect(sw.registerSW).toHaveBeenCalledTimes(1);
    expect(sw.registerSW.mock.calls[0][0]).toMatchObject({ immediate: true });
    expect(queryText(UPDATE_TITLE)).toBeNull();

    act(() => sw.callbacks().onNeedRefresh());
    expect(queryText(UPDATE_TITLE)).not.toBeNull();
    expect(button('Reload').disabled).toBe(false);
    expect(button('Later').disabled).toBe(false);
    // Non-modal: the rest of the page stays usable.
    expect(textarea().disabled).toBe(false);
  });

  it('disables Reload with a note while a scene text editor is open', () => {
    const sw = fakeSw();
    render(<App pwa={sw.deps} />);
    act(() => sw.callbacks().onNeedRefresh());

    fireEvent.click(button('Edit text of scene 1'));
    expect(button('Reload').disabled).toBe(true);
    expect(queryText('Finish editing to reload')).not.toBeNull();

    fireEvent.click(button('Reload'));
    expect(sw.updateSW).not.toHaveBeenCalled();

    fireEvent.click(button('Cancel editing scene 1'));
    expect(button('Reload').disabled).toBe(false);
    expect(queryText('Finish editing to reload')).toBeNull();
  });

  it('"Later" hides the toast for the rest of the launch', () => {
    const sw = fakeSw();
    render(<App pwa={sw.deps} />);
    act(() => sw.callbacks().onNeedRefresh());
    fireEvent.click(button('Later'));
    expect(queryText(UPDATE_TITLE)).toBeNull();

    act(() => sw.callbacks().onNeedRefresh());
    expect(queryText(UPDATE_TITLE)).toBeNull();
    expect(sw.updateSW).not.toHaveBeenCalled();
  });

  it('"Reload" writes pending work before activating the update', () => {
    const sw = fakeSw();
    render(<App pwa={sw.deps} />);
    act(() => sw.callbacks().onNeedRefresh());

    fireEvent.change(textarea(), { target: { value: EDIT_TRANSCRIPT } });
    advance(100); // well inside the 500 ms save debounce
    expect(sw.storage.getItem(SAVED_WORK_KEY)).toBeNull();

    fireEvent.click(button('Reload'));
    expect(sw.updateSW).toHaveBeenCalledTimes(1);
    expect(sw.updateSW).toHaveBeenCalledWith(true);
    expect(sw.log).toEqual(['save', 'apply']);
    const stored = JSON.parse(sw.storage.getItem(SAVED_WORK_KEY) ?? 'null');
    expect(stored.transcript).toBe(EDIT_TRANSCRIPT);
  });

  it('a registration error leaves no update toast or offline notice', () => {
    const sw = fakeSw();
    render(<App pwa={sw.deps} />);
    act(() => sw.callbacks().onRegisterError(new Error('boom')));
    act(() => {
      sw.callbacks().onNeedRefresh();
      sw.callbacks().onOfflineReady();
    });
    expect(queryText(UPDATE_TITLE)).toBeNull();
    expect(queryText(OFFLINE_TITLE)).toBeNull();
    expect(textarea().disabled).toBe(false);
  });

  it('never registers in dev or without service worker support', () => {
    for (const sw of [
      { isProduction: false, supported: true },
      { isProduction: true, supported: false },
    ]) {
      const registerSW = vi.fn(() => async () => {});
      const { unmount } = render(
        <App pwa={{ ...defaultPwaDeps(), sw: { ...sw, registerSW: registerSW as unknown as RegisterSW } }} />,
      );
      expect(registerSW).not.toHaveBeenCalled();
      unmount();
    }
    render(<App />);
    expect(queryText(UPDATE_TITLE)).toBeNull();
    expect(queryText(OFFLINE_TITLE)).toBeNull();
  });
});

describe('App offline-ready notice (Req 8.1, 8.2, 8.3)', () => {
  it('shows once, records the flag, and hides after 8 seconds', () => {
    const sw = fakeSw();
    render(<App pwa={sw.deps} />);
    act(() => sw.callbacks().onOfflineReady());
    expect(queryText(OFFLINE_TITLE)).not.toBeNull();
    expect(sw.storage.getItem(OFFLINE_READY_SHOWN_KEY)).not.toBeNull();

    advance(OFFLINE_READY_MS - 1);
    expect(queryText(OFFLINE_TITLE)).not.toBeNull();
    advance(1);
    expect(queryText(OFFLINE_TITLE)).toBeNull();

    // Flag set: a later offline-ready event shows nothing.
    act(() => sw.callbacks().onOfflineReady());
    expect(queryText(OFFLINE_TITLE)).toBeNull();
  });

  it('"Dismiss" hides it at once', () => {
    const sw = fakeSw();
    render(<App pwa={sw.deps} />);
    act(() => sw.callbacks().onOfflineReady());
    fireEvent.click(button('Dismiss'));
    expect(queryText(OFFLINE_TITLE)).toBeNull();
  });

  it('is not shown on a new launch when the flag is already stored', () => {
    const sw = fakeSw();
    sw.storage.setItem(OFFLINE_READY_SHOWN_KEY, '1');
    render(<App pwa={sw.deps} />);
    act(() => sw.callbacks().onOfflineReady());
    expect(queryText(OFFLINE_TITLE)).toBeNull();
  });
});

describe('App update prompt during a video render (Req 7.4)', () => {
  beforeEach(() => {
    const noop = () => undefined;
    const fakeCtx: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(fakeCtx, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'canvas') return { width: 0, height: 0 };
        if (prop === 'measureText') return (t: string) => ({ width: [...t].length * 10 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: noop });
        }
        return noop;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ctx as unknown as CanvasRenderingContext2D,
    );
    (HTMLCanvasElement.prototype as unknown as { captureStream: unknown }).captureStream = () => ({
      getTracks: () => [],
      getAudioTracks: () => [],
    });
    class FakeMediaRecorder {
      static isTypeSupported(type: string) {
        return type === 'video/mp4;codecs=avc1.640028';
      }
      state: 'inactive' | 'recording' = 'inactive';
      ondataavailable = null;
      onstop: (() => void) | null = null;
      onerror = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', noop);
  });

  afterEach(() => {
    delete (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('disables Reload with a note until the render is cancelled', async () => {
    const sw = fakeSw();
    render(<App pwa={sw.deps} />);
    fireEvent.change(textarea(), { target: { value: EDIT_TRANSCRIPT } });
    advance(REGENERATE_DEBOUNCE_MS);
    act(() => sw.callbacks().onNeedRefresh());

    fireEvent.click(button('Download video'));
    await act(async () => {});
    expect(button('Reload').disabled).toBe(true);
    expect(queryText('Available after the video finishes')).not.toBeNull();
    fireEvent.click(button('Reload'));
    expect(sw.updateSW).not.toHaveBeenCalled();

    fireEvent.click(button('Cancel'));
    await act(async () => {});
    expect(button('Reload').disabled).toBe(false);
    expect(queryText('Available after the video finishes')).toBeNull();
  });
});
