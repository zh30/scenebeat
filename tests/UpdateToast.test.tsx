import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdateToast } from '../src/components/UpdateToast';
import { updateGate, type UpdateView } from '../src/core/updateGate';

const RENDER_NOTE = 'Available after the video finishes';
const EDIT_NOTE = 'Finish editing to reload';

function view(inputs: Partial<{ renderInProgress: boolean; editing: boolean; later: boolean }> = {}): UpdateView {
  return updateGate({ updateAvailable: true, renderInProgress: false, editing: false, later: false, ...inputs });
}

function setup(v: UpdateView) {
  const onReload = vi.fn();
  const onLater = vi.fn();
  const utils = render(<UpdateToast view={v} onReload={onReload} onLater={onLater} />);
  return { ...utils, onReload, onLater };
}

const reloadButton = () => screen.getByRole('button', { name: 'Reload' }) as HTMLButtonElement;

describe('UpdateToast', () => {
  it('renders nothing when the view is not visible', () => {
    const hidden = updateGate({ updateAvailable: false, renderInProgress: false, editing: false, later: false });
    const { container } = setup(hidden);
    expect(container.innerHTML).toBe('');
    const later = updateGate({ updateAvailable: true, renderInProgress: false, editing: false, later: true });
    const second = setup(later);
    expect(second.container.innerHTML).toBe('');
  });

  it('shows the title, an enabled Reload, Later, and no note when nothing blocks the reload', () => {
    const { onReload } = setup(view());
    expect(screen.getByText('New version available')).toBeTruthy();
    expect(reloadButton().disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Later' })).toBeTruthy();
    expect(screen.queryByText(RENDER_NOTE)).toBeNull();
    expect(screen.queryByText(EDIT_NOTE)).toBeNull();
    fireEvent.click(reloadButton());
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('disables Reload with the render note while a render is in progress', () => {
    const { onReload } = setup(view({ renderInProgress: true, editing: true }));
    expect(reloadButton().disabled).toBe(true);
    expect(screen.getByText(RENDER_NOTE)).toBeTruthy();
    expect(screen.queryByText(EDIT_NOTE)).toBeNull();
    fireEvent.click(reloadButton());
    expect(onReload).not.toHaveBeenCalled();
  });

  it('disables Reload with the editing note while a scene editor is open', () => {
    const { onReload } = setup(view({ editing: true }));
    expect(reloadButton().disabled).toBe(true);
    expect(screen.getByText(EDIT_NOTE)).toBeTruthy();
    expect(screen.queryByText(RENDER_NOTE)).toBeNull();
    fireEvent.click(reloadButton());
    expect(onReload).not.toHaveBeenCalled();
  });

  it('calls onLater when Later is clicked, also while Reload is disabled', () => {
    const { onLater, onReload } = setup(view({ renderInProgress: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onReload).not.toHaveBeenCalled();
  });

  it('is not modal: other page controls stay focusable and clickable', () => {
    const onOther = vi.fn();
    render(
      <div>
        <button type="button" onClick={onOther}>
          Play
        </button>
        <textarea aria-label="Transcript" />
        <UpdateToast view={view()} onReload={() => {}} onLater={() => {}} />
      </div>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();

    const play = screen.getByRole('button', { name: 'Play' });
    play.focus();
    expect(document.activeElement).toBe(play);
    fireEvent.click(play);
    expect(onOther).toHaveBeenCalledTimes(1);

    const textarea = screen.getByLabelText('Transcript');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Focus can move into the toast and back out again (no trap).
    reloadButton().focus();
    expect(document.activeElement).toBe(reloadButton());
    play.focus();
    expect(document.activeElement).toBe(play);
  });
});
