import { useId } from 'react';
import type { UpdateView } from '../core/updateGate';

export interface UpdateToastProps {
  /** Output of `updateGate` (visibility, Reload state, note). */
  view: UpdateView;
  /** "Reload": only called while `view.reloadEnabled` is true. */
  onReload: () => void;
  /** "Later": hides the prompt until the next launch. */
  onLater: () => void;
}

/**
 * Update_Prompt (Requirement 7). Non-modal and without a focus trap, so every
 * other control stays usable while it is shown (Requirement 7.2).
 */
export function UpdateToast({ view, onReload, onLater }: UpdateToastProps) {
  const titleId = useId();
  const noteId = useId();

  if (!view.visible) return null;

  const hasNote = view.note !== null;

  return (
    <div className="sb-toast sb-toast--update" role="status" aria-labelledby={titleId}>
      <p className="sb-toast__title" id={titleId}>
        New version available
      </p>
      {hasNote && (
        <p className="sb-toast__note" id={noteId}>
          {view.note}
        </p>
      )}
      <div className="sb-toast__actions">
        <button
          type="button"
          className="sb-button sb-button--primary sb-toast__action"
          disabled={!view.reloadEnabled}
          aria-describedby={hasNote ? noteId : undefined}
          onClick={() => {
            if (view.reloadEnabled) onReload();
          }}
        >
          Reload
        </button>
        <button type="button" className="sb-button sb-button--ghost sb-toast__action" onClick={onLater}>
          Later
        </button>
      </div>
    </div>
  );
}

export default UpdateToast;
