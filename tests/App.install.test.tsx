import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/components/App';
import { IOS_INSTALL_TEXT } from '../src/components/InstallButton';
import { defaultPwaDeps, type PwaDeps } from '../src/pwa/deps';
import type { InstallEnv, MediaQueryLike } from '../src/pwa/install';
import { createMemoryStorage, type StorageLike } from '../src/pwa/storage';
import { INSTALL_DISMISSED_KEY } from '../src/pwa/usePwa';

// Requirements 9.1 to 9.8: install UI driven by a fake InstallEnv.

const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

type WindowEvent = 'beforeinstallprompt' | 'appinstalled';

interface FakeInstallEnv extends InstallEnv {
  dispatch(type: WindowEvent, e: Event): void;
  setStandalone(query: string, matches: boolean): void;
}

function fakeInstallEnv(opts: { userAgent?: string; platform?: string; standalone?: boolean } = {}): FakeInstallEnv {
  const listeners = new Map<WindowEvent, Set<(e: Event) => void>>();
  const queries = new Map<string, { mql: MediaQueryLike; changes: Set<() => void> }>();
  const query = (q: string) => {
    let entry = queries.get(q);
    if (!entry) {
      const changes = new Set<() => void>();
      const mql: MediaQueryLike = {
        matches: q === '(display-mode: standalone)' && opts.standalone === true,
        addEventListener: (_t, f) => void changes.add(f),
        removeEventListener: (_t, f) => void changes.delete(f),
      };
      entry = { mql, changes };
      queries.set(q, entry);
    }
    return entry;
  };
  return {
    matchMedia: (q) => query(q).mql,
    userAgent: opts.userAgent ?? DESKTOP_CHROME_UA,
    platform: opts.platform ?? 'MacIntel',
    maxTouchPoints: 0,
    navigatorStandalone: undefined,
    addWindowListener(type, f) {
      const set = listeners.get(type) ?? new Set();
      listeners.set(type, set);
      set.add(f);
      return () => set.delete(f);
    },
    dispatch(type, e) {
      for (const f of [...(listeners.get(type) ?? [])]) f(e);
    },
    setStandalone(q, matches) {
      const entry = query(q);
      entry.mql.matches = matches;
      for (const f of [...entry.changes]) f();
    },
  };
}

function fakePromptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

function deps(install: InstallEnv | null, storage: StorageLike = createMemoryStorage()): PwaDeps {
  return { ...defaultPwaDeps(), install, storage };
}

const installButton = () => screen.queryByRole('button', { name: /install app/i });

afterEach(cleanup);

describe('App install UI', () => {
  it('stays hidden until beforeinstallprompt, then shows "Install app"', () => {
    const env = fakeInstallEnv();
    render(<App pwa={deps(env)} />);
    expect(installButton()).toBeNull();

    const e = fakePromptEvent('accepted');
    act(() => env.dispatch('beforeinstallprompt', e));
    expect(e.defaultPrevented).toBe(true);
    expect(installButton()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss install' })).toBeTruthy();
  });

  it.each(['accepted', 'dismissed'] as const)(
    'calls prompt() and hides the button after userChoice (%s)',
    async (outcome) => {
      const env = fakeInstallEnv();
      render(<App pwa={deps(env)} />);
      const e = fakePromptEvent(outcome);
      act(() => env.dispatch('beforeinstallprompt', e));

      await userEvent.click(installButton()!);
      expect(e.prompt).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(installButton()).toBeNull());
    },
  );

  it('hides the button when appinstalled fires', () => {
    const env = fakeInstallEnv();
    render(<App pwa={deps(env)} />);
    act(() => env.dispatch('beforeinstallprompt', fakePromptEvent('accepted')));
    expect(installButton()).not.toBeNull();

    act(() => env.dispatch('appinstalled', new Event('appinstalled')));
    expect(installButton()).toBeNull();
  });

  it('shows nothing when launched standalone, even with a prompt', () => {
    const env = fakeInstallEnv({ standalone: true });
    render(<App pwa={deps(env)} />);
    act(() => env.dispatch('beforeinstallprompt', fakePromptEvent('accepted')));
    expect(installButton()).toBeNull();
  });

  it('hides the button when the display mode changes to standalone', () => {
    const env = fakeInstallEnv();
    render(<App pwa={deps(env)} />);
    act(() => env.dispatch('beforeinstallprompt', fakePromptEvent('accepted')));
    expect(installButton()).not.toBeNull();

    act(() => env.setStandalone('(display-mode: window-controls-overlay)', true));
    expect(installButton()).toBeNull();
  });

  it('shows iOS Safari instructions with a dismiss button', () => {
    const env = fakeInstallEnv({ userAgent: IPHONE_SAFARI_UA, platform: 'iPhone' });
    render(<App pwa={deps(env)} />);
    expect(screen.getByText(IOS_INSTALL_TEXT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss install' })).toBeTruthy();
    expect(installButton()).toBeNull();
  });

  it('remembers a dismissal in storage and stays hidden on a new render', async () => {
    const storage = createMemoryStorage();
    const env = fakeInstallEnv();
    const { unmount } = render(<App pwa={deps(env, storage)} />);
    act(() => env.dispatch('beforeinstallprompt', fakePromptEvent('accepted')));

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss install' }));
    expect(installButton()).toBeNull();
    expect(storage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');
    unmount();

    const env2 = fakeInstallEnv();
    render(<App pwa={deps(env2, storage)} />);
    act(() => env2.dispatch('beforeinstallprompt', fakePromptEvent('accepted')));
    expect(installButton()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss install' })).toBeNull();
  });

  it('keeps iOS instructions hidden after dismissal', async () => {
    const storage = createMemoryStorage();
    const ios = () => fakeInstallEnv({ userAgent: IPHONE_SAFARI_UA, platform: 'iPhone' });
    const { unmount } = render(<App pwa={deps(ios(), storage)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss install' }));
    expect(screen.queryByText(IOS_INSTALL_TEXT)).toBeNull();
    unmount();

    render(<App pwa={deps(ios(), storage)} />);
    expect(screen.queryByText(IOS_INSTALL_TEXT)).toBeNull();
  });
});
