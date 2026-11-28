import { describe, expect, it } from 'vitest';
import {
  isIosSafari,
  isStandalone,
  platformInstallSignals,
  type InstallEnv,
} from '../src/pwa/install';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ Safari requests the desktop site and reports a Mac user agent.
  ipadDesktopSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
  firefoxIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
  edgeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/123.0.2420.56 Mobile/15E148 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

function fakeEnv(over: Partial<InstallEnv> & { matching?: string[] } = {}): InstallEnv {
  const { matching = [], ...rest } = over;
  return {
    matchMedia: (q: string) => ({
      matches: matching.includes(q),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    userAgent: UA.desktopChrome,
    platform: 'MacIntel',
    maxTouchPoints: 0,
    navigatorStandalone: undefined,
    addWindowListener: () => () => {},
    ...rest,
  };
}

describe('isIosSafari', () => {
  it('detects iPhone Safari', () => {
    expect(isIosSafari(fakeEnv({ userAgent: UA.iphoneSafari, platform: 'iPhone', maxTouchPoints: 5 }))).toBe(true);
  });

  it('detects iPadOS Safari in desktop mode (MacIntel with touch points)', () => {
    expect(isIosSafari(fakeEnv({ userAgent: UA.ipadDesktopSafari, platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true);
  });

  it.each([
    ['Chrome on iOS', UA.chromeIos],
    ['Firefox on iOS', UA.firefoxIos],
    ['Edge on iOS', UA.edgeIos],
  ])('excludes %s', (_name, ua) => {
    expect(isIosSafari(fakeEnv({ userAgent: ua, platform: 'iPhone', maxTouchPoints: 5 }))).toBe(false);
  });

  it('is false for Android Chrome', () => {
    expect(isIosSafari(fakeEnv({ userAgent: UA.androidChrome, platform: 'Linux armv8l', maxTouchPoints: 5 }))).toBe(false);
  });

  it('is false for desktop Chrome and desktop Safari on a Mac without touch', () => {
    expect(isIosSafari(fakeEnv({ userAgent: UA.desktopChrome, platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false);
    expect(isIosSafari(fakeEnv({ userAgent: UA.ipadDesktopSafari, platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false);
  });
});

describe('isStandalone', () => {
  it('is false in a browser tab', () => {
    expect(isStandalone(fakeEnv())).toBe(false);
  });

  it('is true for display-mode: standalone', () => {
    expect(isStandalone(fakeEnv({ matching: ['(display-mode: standalone)'] }))).toBe(true);
  });

  it('is true for display-mode: window-controls-overlay', () => {
    expect(isStandalone(fakeEnv({ matching: ['(display-mode: window-controls-overlay)'] }))).toBe(true);
  });

  it('is true for iOS navigator.standalone === true', () => {
    expect(isStandalone(fakeEnv({ navigatorStandalone: true }))).toBe(true);
  });

  it('is false for navigator.standalone === false with no matching display mode', () => {
    expect(isStandalone(fakeEnv({ navigatorStandalone: false }))).toBe(false);
  });

  it('ignores unrelated display modes', () => {
    expect(isStandalone(fakeEnv({ matching: ['(display-mode: browser)', '(display-mode: minimal-ui)'] }))).toBe(false);
  });

  it('treats a throwing matchMedia as not standalone', () => {
    const env = fakeEnv({
      matchMedia: () => {
        throw new Error('unsupported');
      },
    });
    expect(isStandalone(env)).toBe(false);
  });
});

describe('platformInstallSignals', () => {
  it('combines platform detection with the dismissal flag', () => {
    const env = fakeEnv({ userAgent: UA.iphoneSafari, platform: 'iPhone', maxTouchPoints: 5, navigatorStandalone: false });
    expect(platformInstallSignals(env, true)).toEqual({
      standalone: false,
      iosSafari: true,
      promptAvailable: false,
      appInstalled: false,
      dismissed: true,
    });
  });

  it('reports standalone for an installed desktop window', () => {
    const env = fakeEnv({ matching: ['(display-mode: standalone)'] });
    expect(platformInstallSignals(env, false)).toMatchObject({ standalone: true, iosSafari: false, dismissed: false });
  });
});
