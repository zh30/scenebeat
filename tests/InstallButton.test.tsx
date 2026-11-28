import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InstallButton, IOS_INSTALL_TEXT } from '../src/components/InstallButton';
import type { InstallState } from '../src/core/installPrompt';

function renderButton(state: InstallState) {
  const onInstall = vi.fn();
  const onDismiss = vi.fn();
  const view = render(<InstallButton state={state} onInstall={onInstall} onDismiss={onDismiss} />);
  return { onInstall, onDismiss, container: view.container };
}

describe('InstallButton', () => {
  it('shows "Install app" and a dismiss button when an install prompt is available', () => {
    renderButton('install-available');
    expect(screen.getByRole('button', { name: 'Install app' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss install' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByText(IOS_INSTALL_TEXT)).toBeNull();
  });

  it('calls onInstall and onDismiss from their buttons', () => {
    const { onInstall, onDismiss } = renderButton('install-available');
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss install' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('shows iOS instructions with only a dismiss button on iOS Safari', () => {
    const { onDismiss, onInstall } = renderButton('ios-instructions');
    expect(IOS_INSTALL_TEXT).toBe('Install: tap Share, then Add to Home Screen');
    expect(screen.getByText(IOS_INSTALL_TEXT)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss install' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onInstall).not.toHaveBeenCalled();
  });

  it.each<InstallState>(['hidden', 'installed'])('renders nothing when the state is %s', (state) => {
    const { container } = renderButton(state);
    expect(container.innerHTML).toBe('');
  });
});
