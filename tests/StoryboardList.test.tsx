import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StoryboardList, type SceneEditorBindings } from '../src/components/StoryboardList';
import type { Scene, SceneTemplate, Storyboard } from '../src/core/types';
import { TEMPLATE_LABELS } from '../src/components/templateLabels';

const scenes: Scene[] = [
  { index: 0, text: 'Revenue grew 45% last year.', template: 'big-number', durationMs: 2500, data: { value: '45%' } },
  { index: 1, text: '她说：「别放弃。」', template: 'quote', durationMs: 2600, data: { quote: '别放弃。' } },
  { index: 2, text: 'Then we launched the beta.', template: 'timeline', durationMs: 2250, data: { label: 'Then' } },
  { index: 3, text: 'Growth beats perfection.', template: 'keyword-highlight', durationMs: 2000, data: { keywords: ['Growth'] } },
  { index: 4, text: '用户增长了3倍。', template: 'big-number', durationMs: 2400, data: { value: '3倍' } },
];

const storyboard: Storyboard = {
  version: '1.0',
  createdAt: '2026-01-01T00:00:00.000Z',
  sceneCount: scenes.length,
  scenes,
};

function renderList(currentIndex = 0, onSelect = vi.fn()) {
  render(<StoryboardList storyboard={storyboard} currentIndex={currentIndex} onSelect={onSelect} />);
  return { onSelect, rows: screen.getAllByRole('button') };
}

describe('StoryboardList', () => {
  it('renders one row per scene in order with number, text, and template', () => {
    const { rows } = renderList();
    expect(rows).toHaveLength(scenes.length);
    rows.forEach((row, i) => {
      const content = row.textContent ?? '';
      expect(within(row).getByText(String(i + 1))).toBeTruthy();
      expect(within(row).getByText(scenes[i].text)).toBeTruthy();
      expect(within(row).getByText(TEMPLATE_LABELS[scenes[i].template])).toBeTruthy();
      expect(content.indexOf(String(i + 1))).toBeLessThan(content.indexOf(scenes[i].text));
    });
  });

  it('marks only the current row with aria-current', () => {
    const { rows } = renderList(2);
    rows.forEach((row, i) => {
      expect(row.getAttribute('aria-current')).toBe(i === 2 ? 'true' : null);
    });
  });

  it('calls onSelect with the scene index when a row is clicked', () => {
    const { rows, onSelect } = renderList(0);
    fireEvent.click(rows[3]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('displays the total and per-template counts', () => {
    renderList();
    expect(screen.getByTestId('storyboard-total').textContent).toBe('5');
    const expected = { 'big-number': 2, 'keyword-highlight': 1, quote: 1, timeline: 1 };
    for (const [template, count] of Object.entries(expected)) {
      const item = screen.getByTestId(`storyboard-count-${template}`);
      expect(item.textContent).toContain(TEMPLATE_LABELS[template as SceneTemplate]);
      expect(within(item).getByText(String(count))).toBeTruthy();
    }
  });

  it('shows zero counts and no rows for an empty storyboard', () => {
    const empty: Storyboard = { ...storyboard, sceneCount: 0, scenes: [] };
    render(<StoryboardList storyboard={empty} currentIndex={0} onSelect={vi.fn()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('storyboard-total').textContent).toBe('0');
    expect(within(screen.getByTestId('storyboard-count-quote')).getByText('0')).toBeTruthy();
  });
});

describe('StoryboardList with editor bindings', () => {
  function makeEditor(overrides: Partial<SceneEditorBindings> = {}): SceneEditorBindings {
    return {
      isEdited: (i) => i === 2,
      disabled: false,
      onTemplateChange: vi.fn(),
      onSaveText: vi.fn(() => null),
      onReset: vi.fn(),
      onEditStart: vi.fn(),
      ...overrides,
    };
  }

  function renderEditable(editor = makeEditor(), onSelect = vi.fn()) {
    render(<StoryboardList storyboard={storyboard} currentIndex={0} onSelect={onSelect} editor={editor} />);
    return { editor, onSelect };
  }

  it('renders no editor controls without the editor prop', () => {
    renderList();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Edit text/ })).toBeNull();
  });

  it('hosts a SceneEditor in every row, inside that row', () => {
    renderEditable();
    const items = screen.getAllByRole('listitem').filter((li) => li.classList.contains('sb-list__item'));
    expect(items).toHaveLength(scenes.length);
    items.forEach((item, i) => {
      const n = i + 1;
      const select = within(item).getByRole('combobox', { name: `Template for scene ${n}` }) as HTMLSelectElement;
      expect(select.value).toBe(scenes[i].template);
      expect(within(item).getByRole('button', { name: `Edit text of scene ${n}` })).toBeTruthy();
      expect(within(item).getByText(i === 2 ? 'Edited' : 'Auto')).toBeTruthy();
      expect(within(item).getByText(scenes[i].text)).toBeTruthy();
    });
  });

  it('keeps only one text editor open at a time', () => {
    const { editor } = renderEditable();
    fireEvent.click(screen.getByRole('button', { name: 'Edit text of scene 1' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Text of scene 1' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit text of scene 3' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Text of scene 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit text of scene 1' })).toBeTruthy();
    expect(editor.onEditStart).toHaveBeenNthCalledWith(1, 0);
    expect(editor.onEditStart).toHaveBeenNthCalledWith(2, 2);
    // Switching rows does not save the first draft.
    expect(editor.onSaveText).not.toHaveBeenCalled();
  });

  it('passes the scene index to template, save, and reset callbacks', () => {
    const { editor } = renderEditable();
    fireEvent.change(screen.getByRole('combobox', { name: 'Template for scene 2' }), {
      target: { value: 'timeline' },
    });
    expect(editor.onTemplateChange).toHaveBeenCalledWith(1, 'timeline');

    fireEvent.click(screen.getByRole('button', { name: 'Edit text of scene 4' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Text of scene 4' }), {
      target: { value: 'Speed beats perfection.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save text of scene 4' }));
    expect(editor.onSaveText).toHaveBeenCalledWith(3, 'Speed beats perfection.');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);

    const reset3 = screen.getByRole('button', { name: 'Reset scene 3 to automatic' }) as HTMLButtonElement;
    expect(reset3.disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Reset scene 1 to automatic' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(reset3);
    expect(editor.onReset).toHaveBeenCalledWith(2);
  });

  it('keeps the editor open and shows the error when saving fails', () => {
    const editor = makeEditor({ onSaveText: vi.fn(() => "Scene text can't be empty.") });
    renderEditable(editor);
    fireEvent.click(screen.getByRole('button', { name: 'Edit text of scene 2' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Text of scene 2' }), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save text of scene 2' }));
    expect(screen.getByRole('alert').textContent).toBe("Scene text can't be empty.");
    expect(screen.getByRole('textbox', { name: 'Text of scene 2' })).toBeTruthy();
  });

  it('disables every editor control when bindings are disabled, but rows stay selectable', () => {
    const { onSelect } = renderEditable(makeEditor({ disabled: true }));
    for (const select of screen.getAllByRole('combobox')) {
      expect((select as HTMLSelectElement).disabled).toBe(true);
    }
    for (const btn of screen.getAllByRole('button', { name: /^(Edit text of|Reset scene)/ })) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.click(screen.getByRole('button', { name: /^4\s*Growth beats perfection\./ }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
