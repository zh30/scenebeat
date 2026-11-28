import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AspectRatioPicker } from '../src/components/AspectRatioPicker';
import { ASPECT_RATIOS, DEFAULT_ASPECT_RATIO, type AspectRatioId } from '../src/core/aspectRatio';

const EXPECTED = [
  { id: '16:9', hint: 'Landscape · YouTube' },
  { id: '9:16', hint: 'Portrait · TikTok, Reels, Shorts, 抖音' },
  { id: '1:1', hint: 'Square' },
  { id: '4:5', hint: 'Portrait post · Instagram' },
] as const;

function renderPicker(value: AspectRatioId = DEFAULT_ASPECT_RATIO, disabled?: boolean) {
  const onChange = vi.fn();
  render(<AspectRatioPicker value={value} onChange={onChange} disabled={disabled} />);
  return { onChange, radios: screen.getAllByRole('radio') as HTMLInputElement[] };
}

describe('AspectRatioPicker', () => {
  it('shows a "Video shape" group with four options, labels, and hints in order', () => {
    const { radios } = renderPicker();
    expect(screen.getByRole('group', { name: 'Video shape' })).toBeTruthy();
    expect(radios).toHaveLength(4);
    expect(ASPECT_RATIOS.map((r) => r.id)).toEqual(EXPECTED.map((e) => e.id));
    EXPECTED.forEach(({ id, hint }, i) => {
      expect(radios[i].value).toBe(id);
      // jsdom applies no CSS, so the label and hint spans (grid items in a browser)
      // are joined without a space in the computed name.
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const name = new RegExp(`^${escape(id)}\\s*${escape(hint)}$`);
      expect(screen.getByRole('radio', { name })).toBe(radios[i]);
      const label = radios[i].closest('label');
      expect(label?.textContent).toContain(id);
      expect(label?.textContent).toContain(hint);
    });
  });

  it('has 16:9 checked initially and exactly one option checked', () => {
    expect(DEFAULT_ASPECT_RATIO).toBe('16:9');
    const { radios } = renderPicker();
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(['16:9']);
  });

  it('reflects the value prop', () => {
    const { radios } = renderPicker('4:5');
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(['4:5']);
  });

  it('calls onChange with the selected ratio', () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: /^9:16/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('9:16');
  });

  it('disables every option when disabled', () => {
    // jsdom still runs click activation on inputs disabled only through their
    // fieldset, so this checks the disabled state rather than simulating a click.
    const { radios } = renderPicker('16:9', true);
    expect((screen.getByRole('group', { name: 'Video shape' }) as HTMLFieldSetElement).disabled).toBe(true);
    for (const r of radios) expect(r.matches(':disabled')).toBe(true);
  });

  it('enables every option by default', () => {
    const { radios } = renderPicker();
    for (const r of radios) expect(r.matches(':disabled')).toBe(false);
  });
});
