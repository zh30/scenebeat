// Feature: scenebeat-pwa, Property 63: Update gate model.
// For any combination of `updateAvailable`, `renderInProgress`, `editing`, and
// `later`, updateGate reports `visible` exactly when `updateAvailable && !later`,
// `reloadEnabled` exactly when visible and neither a render nor an editing
// session is active, and the note "Available after the video finishes" when
// visible with a render in progress, "Finish editing to reload" when visible
// with editing and no render, and no note otherwise.
// **Validates: Requirements 7.4, 7.5, 7.7, 7.8**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { updateGate } from '../../src/core/updateGate';

const inputsArb = fc.record({
  updateAvailable: fc.boolean(),
  renderInProgress: fc.boolean(),
  editing: fc.boolean(),
  later: fc.boolean(),
});

describe('Property 63: Update gate model', () => {
  it('visibility, reload enablement, and note follow the gate rules', () => {
    fc.assert(
      fc.property(inputsArb, (i) => {
        const view = updateGate(i);

        const visible = i.updateAvailable && !i.later;
        expect(view.visible).toBe(visible);
        expect(view.reloadEnabled).toBe(visible && !i.renderInProgress && !i.editing);

        if (visible && i.renderInProgress) {
          expect(view.note).toBe('Available after the video finishes');
        } else if (visible && i.editing) {
          expect(view.note).toBe('Finish editing to reload');
        } else {
          expect(view.note).toBeNull();
        }

        // A disabled Reload on a visible prompt always explains why.
        if (view.visible && !view.reloadEnabled) {
          expect(view.note).not.toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });
});
