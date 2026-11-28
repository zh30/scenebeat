import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmReplaceDialog } from '../src/components/ConfirmReplaceDialog';

// Requirements 14.6, 15.9, 15.10: the Replace_Confirmation dialog.

const TITLE = 'Replace your current transcript?';

type ProtoKey = 'showModal' | 'close';
const proto = HTMLDialogElement.prototype as unknown as Record<ProtoKey, unknown>;
const originals: Partial<Record<ProtoKey, PropertyDescriptor | undefined>> = {};

function saveProto() {
  for (const k of ['showModal', 'close'] as ProtoKey[]) {
    originals[k] = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, k);
  }
}

function restoreProto() {
  for (const k of ['showModal', 'close'] as ProtoKey[]) {
    const d = originals[k];
    if (d) Object.defineProperty(HTMLDialogElement.prototype, k, d);
    else delete proto[k];
  }
}

function renderDialog(open = true) {
  const onReplace = vi.fn();
  const onKeep = vi.fn();
  const utils = render(<ConfirmReplaceDialog open={open} onReplace={onReplace} onKeep={onKeep} />);
  return { ...utils, onReplace, onKeep };
}

beforeEach(saveProto);
afterEach(() => {
  cleanup();
  restoreProto();
});

describe('ConfirmReplaceDialog (fallback without showModal)', () => {
  beforeEach(() => {
    // Force the fallback path regardless of jsdom's dialog support.
    delete proto.showModal;
  });

  it('renders nothing when closed', () => {
    const { container } = renderDialog(false);
    expect(container.innerHTML).toBe('');
  });

  it('shows the title and both buttons in an accessible modal dialog', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = screen.getByRole('heading', { name: TITLE });
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep current' })).toBeTruthy();
  });

  it('Replace calls onReplace only', () => {
    const { onReplace, onKeep } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onKeep).not.toHaveBeenCalled();
  });

  it('Keep current calls onKeep only', () => {
    const { onReplace, onKeep } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Keep current' }));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
  });

  it('Escape counts as Keep current', () => {
    const { onReplace, onKeep } = renderDialog();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Keep current' }), { key: 'Escape' });
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
  });

  it('focuses Keep current on open and restores focus on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onReplace = vi.fn();
    const onKeep = vi.fn();
    const { rerender } = render(
      <ConfirmReplaceDialog open onReplace={onReplace} onKeep={onKeep} />,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep current' }));
    rerender(<ConfirmReplaceDialog open={false} onReplace={onReplace} onKeep={onKeep} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('ConfirmReplaceDialog (native dialog)', () => {
  let showModal: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: showModal,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: close,
      configurable: true,
      writable: true,
    });
  });

  it('opens a <dialog> with showModal and closes it on unmount', () => {
    const { container, unmount } = renderDialog();
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog!.open).toBe(true);
    expect(dialog!.textContent).toContain(TITLE);
    unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('buttons call their callbacks', () => {
    const { container, onReplace, onKeep } = renderDialog();
    const dialog = container.querySelector('dialog')!;
    const buttons = Array.from(dialog.querySelectorAll('button'));
    fireEvent.click(buttons.find((b) => b.textContent === 'Replace')!);
    fireEvent.click(buttons.find((b) => b.textContent === 'Keep current')!);
    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('the cancel event (Escape) calls onKeep and is prevented', () => {
    const { container, onReplace, onKeep } = renderDialog();
    const dialog = container.querySelector('dialog')!;
    const event = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
  });
});
