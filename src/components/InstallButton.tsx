import type { InstallState } from '../core/installPrompt';
import { DownloadIcon } from './icons';

export interface InstallButtonProps {
  /** Current Install_State from `usePwa`. */
  state: InstallState;
  /** Opens the browser install dialog (`usePwa().install`). */
  onInstall: () => void;
  /** Hides the install UI for good (`usePwa().dismissInstall`). */
  onDismiss: () => void;
}

export const IOS_INSTALL_TEXT = 'Install: tap Share, then Add to Home Screen';

/**
 * Header install control. Shows an "Install app" button when the browser offers
 * an install prompt, short instructions on iOS Safari, and nothing otherwise.
 */
export function InstallButton({ state, onInstall, onDismiss }: InstallButtonProps) {
  if (state !== 'install-available' && state !== 'ios-instructions') return null;

  const dismiss = (
    <button
      type="button"
      className="sb-button sb-button--ghost sb-install__dismiss"
      aria-label="Dismiss install"
      title="Dismiss install"
      onClick={onDismiss}
    >
      <span aria-hidden="true">×</span>
    </button>
  );

  if (state === 'install-available') {
    return (
      <div className="sb-install">
        <button type="button" className="sb-button sb-button--soft sb-install__button" onClick={onInstall}>
          <DownloadIcon />
          <span>Install app</span>
        </button>
        {dismiss}
      </div>
    );
  }

  return (
    <div className="sb-install sb-install--ios">
      <p className="sb-install__text">{IOS_INSTALL_TEXT}</p>
      {dismiss}
    </div>
  );
}
