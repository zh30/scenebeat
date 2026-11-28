import { useEffect, useRef, useState } from 'react';
import { countByTemplate } from '../core/stats';
import { TEMPLATES, type Scene, type SceneTemplate, type Storyboard } from '../core/types';
import { SceneEditor } from './SceneEditor';
import { TEMPLATE_LABELS } from './templateLabels';

/** Callbacks and state that turn the read-only list into an editable one (Req 1, 2, 3). */
export interface SceneEditorBindings {
  /** True when the scene at `index` has a Scene_Override. */
  isEdited(index: number): boolean;
  /** Disables every editor control, e.g. while a video renders (Req 15.3). */
  disabled: boolean;
  onTemplateChange(index: number, template: SceneTemplate): void;
  /** Returns null on success or the error message to show. */
  onSaveText(index: number, raw: string): string | null;
  onReset(index: number): void;
  /** Called when the text editor of the scene at `index` opens. */
  onEditStart(index: number): void;
}

export interface StoryboardListProps {
  storyboard: Storyboard;
  currentIndex: number;
  onSelect: (index: number) => void;
  /** When given, each row hosts a SceneEditor; without it the list is read-only as in the MVP. */
  editor?: SceneEditorBindings;
  /** Called with true when a scene text editor opens and false when none is open (Req 7.5). */
  onEditingChange?: (editing: boolean) => void;
}

/** One row per scene (Req 6.1 to 6.3) plus total and per-template counts (Req 6.4). */
export function StoryboardList({ storyboard, currentIndex, onSelect, editor, onEditingChange }: StoryboardListProps) {
  const counts = countByTemplate(storyboard);
  const total = storyboard.scenes.length;
  // Index of the scene whose text editor is open; only one at a time.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const openIndex = editingIndex !== null && editingIndex < total ? editingIndex : null;

  // Report the Editing_Session flag (Req 7.5). The callback is kept in a ref so a new
  // function identity from the parent does not re-fire the report.
  const editing = openIndex !== null;
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
  useEffect(() => {
    onEditingChangeRef.current?.(editing);
  }, [editing]);

  const rowButton = (scene: Scene, isCurrent: boolean) => (
    <button
      type="button"
      className={isCurrent ? 'sb-list__row sb-list__row--current' : 'sb-list__row'}
      aria-current={isCurrent ? 'true' : undefined}
      data-template={scene.template}
      onClick={() => onSelect(scene.index)}
    >
      <span className="sb-list__index">{scene.index + 1}</span>
      <span className="sb-list__text">{scene.text}</span>
      <span className={`sb-badge sb-badge--${scene.template}`}>{TEMPLATE_LABELS[scene.template]}</span>
    </button>
  );

  return (
    <section className="sb-list" aria-label="Storyboard">
      <div className="sb-list__summary">
        <span className="sb-list__total">
          <strong data-testid="storyboard-total">{total}</strong> {total === 1 ? 'scene' : 'scenes'}
        </span>
        <ul className="sb-list__counts">
          {TEMPLATES.map((template) => (
            <li
              key={template}
              className="sb-list__count"
              data-template={template}
              data-testid={`storyboard-count-${template}`}
            >
              <span className={`sb-dot sb-dot--${template}`} aria-hidden="true" />
              <span>{TEMPLATE_LABELS[template]}</span> <span className="sb-list__num">{counts[template]}</span>
            </li>
          ))}
        </ul>
      </div>
      {total === 0 ? (
        <p className="sb-list__empty">Scenes will be listed here, one per sentence.</p>
      ) : editor ? (
        <ol className="sb-list__rows sb-list__rows--editable">
          {storyboard.scenes.map((scene) => {
            const i = scene.index;
            const isCurrent = i === currentIndex;
            const isEditing = i === openIndex;
            const className = [
              'sb-list__item',
              isCurrent ? 'sb-list__item--current' : '',
              isEditing ? 'sb-list__item--editing' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <li key={i} className={className}>
                {rowButton(scene, isCurrent)}
                <div className="sb-list__editor">
                  <SceneEditor
                    scene={scene}
                    edited={editor.isEdited(i)}
                    disabled={editor.disabled}
                    editing={isEditing}
                    onTemplateChange={(t) => editor.onTemplateChange(i, t)}
                    onSaveText={(raw) => editor.onSaveText(i, raw)}
                    onReset={() => editor.onReset(i)}
                    onEditStart={() => {
                      setEditingIndex(i);
                      editor.onEditStart(i);
                    }}
                    onEditEnd={() => setEditingIndex((cur) => (cur === i ? null : cur))}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="sb-list__rows">
          {storyboard.scenes.map((scene) => (
            <li key={scene.index}>{rowButton(scene, scene.index === currentIndex)}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
