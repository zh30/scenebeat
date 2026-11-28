import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EMPTY_TEXT_MESSAGE } from '../core/overrides';
import { TEMPLATES, type Scene, type SceneTemplate } from '../core/types';
import { TEMPLATE_LABELS } from './templateLabels';

export interface SceneEditorProps {
  /** The edited scene shown in the list (its text is the Effective_Text). */
  scene: Scene;
  /** True when the scene has a Scene_Override (shows "Edited" and enables Reset). */
  edited: boolean;
  /** Disables every control, e.g. while a video renders (Req 15.3). */
  disabled?: boolean;
  /**
   * Controls whether the text editor is open. When omitted, the editor keeps
   * its own open state. A parent list passes it to keep one editor open at a time.
   */
  editing?: boolean;
  onTemplateChange: (template: SceneTemplate) => void;
  /** Returns null on success, or the error message to show. */
  onSaveText: (raw: string) => string | null;
  onReset: () => void;
  /** Called when the text editor opens. */
  onEditStart: () => void;
  /** Called when the text editor closes (saved or cancelled). */
  onEditEnd?: () => void;
}

/** Per-scene controls: template choice, Auto/Edited chip, text editing, reset (Req 1, 2, 3). */
export function SceneEditor({
  scene,
  edited,
  disabled = false,
  editing,
  onTemplateChange,
  onSaveText,
  onReset,
  onEditStart,
  onEditEnd,
}: SceneEditorProps) {
  const number = scene.index + 1;
  const ids = useId();
  const selectId = `${ids}-template`;
  const fieldId = `${ids}-text`;
  const errorId = `${ids}-error`;

  const [ownEditing, setOwnEditing] = useState(false);
  const isEditing = editing ?? ownEditing;
  const [draft, setDraft] = useState(scene.text);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(isEditing);

  // Focus the field on open; on close, return focus to "Edit text" only if focus
  // was inside this editor (so closing because another row opened doesn't steal it).
  useEffect(() => {
    if (isEditing && !wasEditing.current) {
      fieldRef.current?.focus();
      fieldRef.current?.select();
    } else if (!isEditing && wasEditing.current) {
      const active = document.activeElement;
      const root = rootRef.current;
      if (!active || active === document.body || (root && root.contains(active))) {
        editButtonRef.current?.focus();
      }
    }
    wasEditing.current = isEditing;
  }, [isEditing]);

  // Auto-size the textarea to its content.
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  }, [draft, isEditing]);

  const open = () => {
    setDraft(scene.text);
    setError(null);
    if (editing === undefined) setOwnEditing(true);
    onEditStart();
  };

  const close = () => {
    setError(null);
    if (editing === undefined) setOwnEditing(false);
    onEditEnd?.();
  };

  const save = () => {
    const result = onSaveText(draft);
    if (result !== null) {
      setError(result || EMPTY_TEXT_MESSAGE);
      fieldRef.current?.focus();
      return;
    }
    close();
  };

  const onFieldKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore keys that confirm an IME composition (Chinese, Japanese input).
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      // Line breaks become spaces on save, so Enter (with or without Shift) never inserts one.
      e.preventDefault();
      if (!e.shiftKey) save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <div ref={rootRef} className="sb-editor" data-edited={edited ? 'true' : 'false'}>
      {isEditing && (
        <div className="sb-editor__edit">
          <label className="sb-editor__label" htmlFor={fieldId}>
            Text of scene {number}
          </label>
          <textarea
            ref={fieldRef}
            id={fieldId}
            className={error ? 'sb-editor__field sb-editor__field--invalid' : 'sb-editor__field'}
            rows={1}
            value={draft}
            disabled={disabled}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onFieldKeyDown}
          />
          {error && (
            <p id={errorId} className="sb-editor__error" role="alert">
              {error}
            </p>
          )}
          <div className="sb-editor__edit-actions">
            <button
              type="button"
              className="sb-button sb-button--primary sb-editor__save"
              disabled={disabled}
              aria-label={`Save text of scene ${number}`}
              onClick={save}
            >
              Save
            </button>
            <button
              type="button"
              className="sb-button sb-button--ghost sb-editor__cancel"
              disabled={disabled}
              aria-label={`Cancel editing scene ${number}`}
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="sb-editor__controls">
        <div className="sb-editor__template">
          <label className="sb-editor__template-label" htmlFor={selectId}>
            Template
          </label>
          <select
            id={selectId}
            className="sb-editor__select"
            aria-label={`Template for scene ${number}`}
            value={scene.template}
            disabled={disabled}
            data-template={scene.template}
            onChange={(e) => onTemplateChange(e.target.value as SceneTemplate)}
          >
            {TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {TEMPLATE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <span
          className={edited ? 'sb-editor__chip sb-editor__chip--edited' : 'sb-editor__chip sb-editor__chip--auto'}
        >
          {edited ? 'Edited' : 'Auto'}
        </span>
        {!isEditing && (
          <button
            ref={editButtonRef}
            type="button"
            className="sb-button sb-button--soft sb-editor__edit-button"
            disabled={disabled}
            aria-label={`Edit text of scene ${number}`}
            onClick={open}
          >
            Edit text
          </button>
        )}
        <button
          type="button"
          className="sb-button sb-button--ghost sb-editor__reset"
          disabled={disabled || !edited}
          aria-label={`Reset scene ${number} to automatic`}
          onClick={onReset}
        >
          Reset to automatic
        </button>
      </div>
    </div>
  );
}
