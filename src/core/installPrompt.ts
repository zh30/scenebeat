/**
 * Install_State_Machine: pure reducer over platform signals and user actions.
 * The browser layer (`src/pwa/usePwa.ts`) captures `beforeinstallprompt`,
 * `appinstalled`, and display-mode changes and dispatches `InstallEvent`s.
 */

export type InstallState = 'hidden' | 'install-available' | 'ios-instructions' | 'installed';

export interface InstallSignals {
  standalone: boolean;
  iosSafari: boolean;
  /** A captured beforeinstallprompt that has not been used. */
  promptAvailable: boolean;
  /** appinstalled fired on this launch. */
  appInstalled: boolean;
  /** scenebeat:install-dismissed:v1 recorded. */
  dismissed: boolean;
}

export type InstallEvent =
  | { type: 'prompt-captured' }
  | { type: 'prompt-closed' } // dialog closed, accepted or declined
  | { type: 'app-installed' }
  | { type: 'standalone-changed'; standalone: boolean }
  | { type: 'dismissed' };

export function initialInstallSignals(p: {
  standalone: boolean;
  iosSafari: boolean;
  dismissed: boolean;
}): InstallSignals {
  return {
    standalone: p.standalone,
    iosSafari: p.iosSafari,
    promptAvailable: false,
    appInstalled: false,
    dismissed: p.dismissed,
  };
}

export function installReducer(s: InstallSignals, e: InstallEvent): InstallSignals {
  switch (e.type) {
    case 'prompt-captured':
      return { ...s, promptAvailable: true };
    case 'prompt-closed':
      return { ...s, promptAvailable: false };
    case 'app-installed':
      return { ...s, appInstalled: true, promptAvailable: false };
    case 'standalone-changed':
      return { ...s, standalone: e.standalone };
    case 'dismissed':
      return { ...s, dismissed: true };
    default:
      return s;
  }
}

export function installState(s: InstallSignals): InstallState {
  if (s.standalone || s.appInstalled) return 'installed';
  if (s.dismissed) return 'hidden';
  if (s.promptAvailable) return 'install-available';
  if (s.iosSafari) return 'ios-instructions';
  return 'hidden';
}
