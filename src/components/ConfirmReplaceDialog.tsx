import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';

export interface ConfirmReplaceDialogProps {
  /** Whether the Replace_Confirmation is shown. Nothing is rendered while false. */
  open: boolean;
  /** "Replace": apply the pending transcript. */
  onReplace: () => void;
  /** "Keep current" (also Escape): discard the pending transcript. */
  onKeep: () => void;
}

const TITLE = 'Replace your current transcript?';
const MESSAGE = 'Your current transcript and scene edits will be replaced.';

function nativeModalSupported(): boolean {
  return (
    typeof HTMLDialogElement !== 'undefined' &&
    typeof HTMLDialogElement.prototype.showModal === 'function'
  );
}

/**
 * The Replace_Confirmation (Requirements 14.6, 15.8 to 15.10). Uses a native
 * `<dialog>` opened with `showModal()` when the browser supports it, otherwise
 * an accessible `role="dialog" aria-modal="true"` element (for example in
 * jsdom). Focus moves to "Keep current" on open and returns to the previously
 * focused element on close. Escape counts as "Keep current".
 */
export function ConfirmReplaceDialog({ open, onReplace, onKeep }: ConfirmReplaceDialogProps) {
  if (!open) return null;
  return <DialogBody onReplace={onReplace} onKeep={onKeep} />;
}

function DialogBody({ onReplace, onKeep }: Omit<ConfirmReplaceDialogProps, 'open'>) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);
  const onKeepRef = useRef(onKeep);
  onKeepRef.current = onKeep;
  // Decided once per opening so the rendered element never switches.
  const nativeRef = useRef<boolean | null>(null);
  if (nativeRef.current === null) nativeRef.current = nativeModalSupported();
  const native = nativeRef.current;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    let onCancel: ((e: Event) => void) | null = null;

    if (native && dialog) {
      onCancel = (e: Event) => {
        // Keep React in control of closing; Escape means "Keep current".
        e.preventDefault();
        onKeepRef.current();
      };
      dialog.addEventListener('cancel', onCancel);
      try {
        if (!dialog.open) dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }
    keepRef.current?.focus();

    return () => {
      if (dialog) {
        if (onCancel) dialog.removeEventListener('cancel', onCancel);
        try {
          if (dialog.open) dialog.close();
        } catch {
          /* element already detached */
        }
      }
      if (previous && previous.isConnected) previous.focus();
    };
  }, [native]);

  const body = (
    <>
      <h2 id={titleId} className="sb-dialog__title">
        {TITLE}
      </h2>
      <p id={messageId} className="sb-dialog__message">
        {MESSAGE}
      </p>
      <div className="sb-dialog__actions">
        <button
          ref={keepRef}
          type="button"
          className="sb-button sb-button--ghost sb-dialog__keep"
          onClick={onKeep}
        >
          Keep current
        </button>
        <button
          ref={replaceRef}
          type="button"
          className="sb-button sb-button--primary sb-dialog__replace"
          onClick={onReplace}
        >
          Replace
        </button>
      </div>
    </>
  );

  if (native) {
    return (
      <dialog
        ref={dialogRef}
        className="sb-dialog"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        {body}
      </dialog>
    );
  }

  // Fallback: Escape closes as "Keep current"; Tab cycles between the two buttons.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onKeep();
      return;
    }
    if (e.key === 'Tab') {
      const first = keepRef.current;
      const last = replaceRef.current;
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !fallbackRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !fallbackRef.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="sb-dialog-backdrop">
      <div
        ref={fallbackRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="sb-dialog sb-dialog--fallback"
        onKeyDown={handleKeyDown}
      >
        {body}
      </div>
    </div>
  );
}
