/**
 * Update gate: decides whether the Update_Prompt is visible, whether its
 * "Reload" button is enabled, and which note it shows. Pure, no DOM.
 */

export interface UpdateInputs {
  /** A new service worker is waiting. */
  updateAvailable: boolean;
  /** A Render_Job is in progress. */
  renderInProgress: boolean;
  /** An Editing_Session (scene text editor) is open. */
  editing: boolean;
  /** The user chose "Later" on this launch. */
  later: boolean;
}

export type UpdateNote = 'Available after the video finishes' | 'Finish editing to reload';

export interface UpdateView {
  visible: boolean;
  reloadEnabled: boolean;
  note: null | UpdateNote;
}

export function updateGate(i: UpdateInputs): UpdateView {
  const visible = i.updateAvailable && !i.later;
  const reloadEnabled = visible && !i.renderInProgress && !i.editing;
  // The render note takes precedence over the editing note.
  const note: UpdateView['note'] = !visible
    ? null
    : i.renderInProgress
      ? 'Available after the video finishes'
      : i.editing
        ? 'Finish editing to reload'
        : null;
  return { visible, reloadEnabled, note };
}
