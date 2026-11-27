import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App, REGENERATE_DEBOUNCE_MS } from '../src/components/App';
import { buildStoryboard } from '../src/core/buildStoryboard';
import { SAMPLE_TRANSCRIPT } from '../src/data/sampleTranscript';

const sampleSceneCount = buildStoryboard(SAMPLE_TRANSCRIPT).scenes.length;

const textarea = () => screen.getByLabelText('Transcript') as HTMLTextAreaElement;
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const total = () => Number(screen.getByTestId('storyboard-total').textContent);
const position = (container: HTMLElement) =>
  container.querySelector('.sb-player__position')?.textContent;
const currentRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.sb-list__row[aria-current="true"]'));

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const typeText = (value: string) => fireEvent.change(textarea(), { target: { value } });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App transcript input (Req 1.2, 1.3, 1.4)', () => {
  it('loads the sample transcript at start and builds its storyboard', () => {
    const { container } = render(<App />);
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
    expect(sampleSceneCount).toBeGreaterThan(0);
    expect(total()).toBe(sampleSceneCount);
    expect(position(container)).toBe(`1 / ${sampleSceneCount}`);
  });

  it('"Clear" empties the input and, after the debounce, the storyboard', () => {
    render(<App />);
    fireEvent.click(button('Clear'));
    expect(textarea().value).toBe('');
    advance(REGENERATE_DEBOUNCE_MS);
    expect(total()).toBe(0);
  });

  it('"Load sample" replaces the current content with the sample transcript', () => {
    render(<App />);
    typeText('Something else entirely.');
    advance(REGENERATE_DEBOUNCE_MS);
    expect(total()).toBe(1);

    fireEvent.click(button('Load sample'));
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
    advance(REGENERATE_DEBOUNCE_MS);
    expect(total()).toBe(sampleSceneCount);
  });
});

describe('App regeneration debounce (Req 1.5)', () => {
  it('uses a 300 ms debounce', () => {
    expect(REGENERATE_DEBOUNCE_MS).toBe(300);
  });

  it('regenerates at 300 ms after the last keystroke and not at 299 ms', () => {
    render(<App />);
    typeText('One. Two.');
    advance(299);
    expect(total()).toBe(sampleSceneCount);
    advance(1);
    expect(total()).toBe(2);
  });

  it('restarts the debounce on each keystroke', () => {
    render(<App />);
    typeText('One.');
    advance(200);
    typeText('One. Two. Three.');
    advance(299);
    expect(total()).toBe(sampleSceneCount);
    advance(1);
    expect(total()).toBe(3);
  });
});

describe('App playback reset on regeneration (Req 5.14)', () => {
  it('returns the Player to the first scene and marks the first list row', () => {
    const { container } = render(<App />);
    expect(sampleSceneCount).toBeGreaterThanOrEqual(3);
    fireEvent.click(button('Next'));
    fireEvent.click(button('Next'));
    expect(position(container)).toBe(`3 / ${sampleSceneCount}`);

    typeText('Alpha. Beta. Gamma. Delta.');
    advance(REGENERATE_DEBOUNCE_MS);
    expect(position(container)).toBe('1 / 4');
    const rows = currentRows(container);
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('.sb-list__index')?.textContent).toBe('1');
  });

  it('stops playback when the storyboard is regenerated', () => {
    const { container } = render(<App />);
    fireEvent.click(button('Next'));
    fireEvent.click(button('Play'));
    expect(button('Pause').disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();

    typeText('Alpha. Beta.');
    advance(REGENERATE_DEBOUNCE_MS);
    expect(position(container)).toBe('1 / 2');
    expect(button('Play').disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();

    // No further advance happens once stopped.
    advance(10_000);
    expect(position(container)).toBe('1 / 2');
  });
});
