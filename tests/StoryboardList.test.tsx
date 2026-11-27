import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StoryboardList } from '../src/components/StoryboardList';
import type { Scene, Storyboard } from '../src/core/types';

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
      expect(within(row).getByText(scenes[i].template)).toBeTruthy();
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
      expect(item.textContent).toContain(template);
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
