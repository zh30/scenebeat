import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SceneEditor, type SceneEditorProps } from '../src/components/SceneEditor';
import { EMPTY_TEXT_MESSAGE } from '../src/core/overrides';
import type { Scene } from '../src/core/types';

const scene: Scene = {
  index: 2,
  text: 'Revenue grew 45% last year.',
  template: 'big-number',
  templateSource: 'auto',
  durationMs: 2500,
  data: { value: '45%' },
};

function setup(props: Partial<SceneEditorProps> = {}) {
  const handlers = {
    onTemplateChange: vi.fn(),
    onSaveText: vi.fn<(raw: string) => string | null>(() => null),
    onReset: vi.fn(),
    onEditStart: vi.fn(),
    onEditEnd: vi.fn(),
  };
  render(<SceneEditor scene={scene} edited={false} {...handlers} {...props} />);
  return handlers;
}

const select = () => screen.getByRole('combobox', { name: 'Template for scene 3' }) as HTMLSelectElement;
const editButton = () => screen.getByRole('button', { name: 'Edit text of scene 3' }) as HTMLButtonElement;
const resetButton = () => screen.getByRole('button', { name: 'Reset scene 3 to automatic' }) as HTMLButtonElement;
const field = () => screen.getByRole('textbox', { name: 'Text of scene 3' }) as HTMLTextAreaElement;
const queryField = () => screen.queryByRole('textbox', { name: 'Text of scene 3' });

describe('SceneEditor', () => {
  it('offers the four templates with plain names and selects the current one', () => {
    const h = setup();
    const options = Array.from(select().options);
    expect(options.map((o) => o.textContent).sort()).toEqual(['Big number', 'Keywords', 'Quote', 'Timeline']);
    expect(select().value).toBe('big-number');

    fireEvent.change(select(), { target: { value: 'quote' } });
    expect(h.onTemplateChange).toHaveBeenCalledWith('quote');
  });

  it('shows the Auto chip and disables Reset when not edited', () => {
    setup({ edited: false });
    expect(screen.getByText('Auto')).toBeTruthy();
    expect(screen.queryByText('Edited')).toBeNull();
    expect(resetButton().disabled).toBe(true);
  });

  it('shows the Edited chip and enables Reset when edited', () => {
    const h = setup({ edited: true });
    expect(screen.getByText('Edited')).toBeTruthy();
    expect(screen.queryByText('Auto')).toBeNull();
    expect(resetButton().disabled).toBe(false);
    fireEvent.click(resetButton());
    expect(h.onReset).toHaveBeenCalledTimes(1);
  });

  it('opens the editor with the scene text and saves with the Save button', () => {
    const h = setup();
    expect(queryField()).toBeNull();
    fireEvent.click(editButton());
    expect(h.onEditStart).toHaveBeenCalledTimes(1);
    expect(field().value).toBe(scene.text);

    fireEvent.change(field(), { target: { value: 'Revenue grew 46%.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save text of scene 3' }));
    expect(h.onSaveText).toHaveBeenCalledWith('Revenue grew 46%.');
    expect(queryField()).toBeNull();
    expect(h.onEditEnd).toHaveBeenCalledTimes(1);
  });

  it('saves on Enter and cancels on Escape', () => {
    const h = setup();
    fireEvent.click(editButton());
    fireEvent.change(field(), { target: { value: 'New text.' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(h.onSaveText).toHaveBeenCalledWith('New text.');
    expect(queryField()).toBeNull();

    fireEvent.click(editButton());
    fireEvent.change(field(), { target: { value: 'Discarded.' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(h.onSaveText).toHaveBeenCalledTimes(1);
    expect(queryField()).toBeNull();
  });

  it('cancels without saving via the Cancel button', () => {
    const h = setup();
    fireEvent.click(editButton());
    fireEvent.change(field(), { target: { value: 'Discarded.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing scene 3' }));
    expect(h.onSaveText).not.toHaveBeenCalled();
    expect(queryField()).toBeNull();
    // Reopening starts from the scene text, not the discarded draft.
    fireEvent.click(editButton());
    expect(field().value).toBe(scene.text);
  });

  it('keeps the editor open and shows the error when the save is rejected', () => {
    const h = setup({ onSaveText: vi.fn(() => EMPTY_TEXT_MESSAGE) });
    fireEvent.click(editButton());
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save text of scene 3' }));
    expect(queryField()).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toBe("Scene text can't be empty.");
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(h.onEditEnd).not.toHaveBeenCalled();

    // Typing clears the error.
    fireEvent.change(field(), { target: { value: 'Fixed.' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables every control when disabled', () => {
    setup({ edited: true, disabled: true, editing: true });
    expect(select().disabled).toBe(true);
    expect(resetButton().disabled).toBe(true);
    expect(field().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save text of scene 3' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel editing scene 3' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables the Edit text button when disabled', () => {
    setup({ disabled: true });
    expect(editButton().disabled).toBe(true);
  });
});
