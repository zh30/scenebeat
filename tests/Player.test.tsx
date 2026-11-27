import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Player, type PlayerProps } from '../src/components/Player';
import { REDUCED_MOTION_TRANSITION_MS, TRANSITION_MS } from '../src/components/SceneView';
import type { Scene, Storyboard } from '../src/core/types';

const scenes: Scene[] = [
  { index: 0, text: 'Revenue grew 45% last year.', template: 'big-number', durationMs: 2500, data: { value: '45%' } },
  { index: 1, text: '她说：「别放弃。」', template: 'quote', durationMs: 2600, data: { quote: '别放弃。' } },
  { index: 2, text: 'Then we launched the beta.', template: 'timeline', durationMs: 2250, data: { label: 'Then' } },
  { index: 3, text: 'Growth beats perfection.', template: 'keyword-highlight', durationMs: 2000, data: { keywords: ['Growth', 'perfection'] } },
];

const storyboard: Storyboard = {
  version: '1.0',
  createdAt: '2026-01-01T00:00:00.000Z',
  sceneCount: scenes.length,
  scenes,
};

const emptyStoryboard: Storyboard = { ...storyboard, sceneCount: 0, scenes: [] };

function renderPlayer(overrides: Partial<PlayerProps> = {}) {
  const props: PlayerProps = {
    storyboard,
    index: 0,
    playing: false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
  const utils = render(<Player {...props} />);
  return { ...utils, props };
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const sceneView = () => screen.getByTestId('scene-view');

/** Installs a matchMedia stub reporting the given reduced-motion preference. */
function mockMatchMedia(reduce: boolean) {
  const impl = vi.fn((query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: impl });
  return impl;
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: originalMatchMedia });
});

describe('Player template layouts (Req 5.1)', () => {
  it('renders the big-number layout with the highlighted value', () => {
    const { container } = renderPlayer({ index: 0 });
    expect(sceneView().dataset.template).toBe('big-number');
    expect(container.querySelector('.sb-big-number__value')?.textContent).toBe('45%');
    expect(screen.getByText(scenes[0].text)).toBeTruthy();
  });

  it('renders the quote layout with the quoted text', () => {
    const { container } = renderPlayer({ index: 1 });
    expect(sceneView().dataset.template).toBe('quote');
    expect(container.querySelector('blockquote.sb-quote__text')?.textContent).toBe('别放弃。');
  });

  it('renders the timeline layout with the label', () => {
    const { container } = renderPlayer({ index: 2 });
    expect(sceneView().dataset.template).toBe('timeline');
    expect(container.querySelector('.sb-timeline__label')?.textContent).toBe('Then');
  });

  it('renders the keyword-highlight layout with marked keywords', () => {
    const { container } = renderPlayer({ index: 3 });
    expect(sceneView().dataset.template).toBe('keyword-highlight');
    const marks = Array.from(container.querySelectorAll('mark.sb-keyword')).map((m) => m.textContent);
    expect(marks).toEqual(['Growth', 'perfection']);
    expect(container.querySelector('.sb-keyword-highlight__text')?.textContent).toBe(scenes[3].text);
  });
});

describe('Player controls (Req 5.5 to 5.8, 5.13)', () => {
  it('calls the matching callbacks when controls are clicked', () => {
    const { props, rerender } = renderPlayer({ index: 1 });
    fireEvent.click(button('Next'));
    fireEvent.click(button('Previous'));
    fireEvent.click(button('Play'));
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onPrev).toHaveBeenCalledTimes(1);
    expect(props.onPlay).toHaveBeenCalledTimes(1);

    rerender(<Player {...props} playing />);
    fireEvent.click(button('Pause'));
    expect(props.onPause).toHaveBeenCalledTimes(1);
  });

  it('disables Previous on the first scene and enables Next', () => {
    renderPlayer({ index: 0 });
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(false);
  });

  it('disables Next on the last scene and enables Previous', () => {
    renderPlayer({ index: scenes.length - 1 });
    expect(button('Next').disabled).toBe(true);
    expect(button('Previous').disabled).toBe(false);
  });

  it('enables both Previous and Next on a middle scene', () => {
    renderPlayer({ index: 1 });
    expect(button('Previous').disabled).toBe(false);
    expect(button('Next').disabled).toBe(false);
  });

  it('shows one Play/Pause toggle whose name and action follow the playing state', () => {
    const { props, rerender } = renderPlayer({ playing: false });
    expect(button('Play').disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    rerender(<Player {...props} playing />);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    expect(button('Pause').disabled).toBe(false);
    fireEvent.click(button('Pause'));
    expect(props.onPause).toHaveBeenCalledTimes(1);
    expect(props.onPlay).not.toHaveBeenCalled();
  });

  it('shows the current position as "current / total"', () => {
    const { container, props, rerender } = renderPlayer({ index: 0 });
    const label = () => container.querySelector('.sb-player__position')?.textContent;
    expect(label()).toBe('1 / 4');
    rerender(<Player {...props} index={2} />);
    expect(label()).toBe('3 / 4');
  });

  it('displays the scene at the given index after a change', () => {
    const { props, rerender } = renderPlayer({ index: 0 });
    rerender(<Player {...props} index={1} />);
    expect(sceneView().dataset.template).toBe('quote');
  });
});

describe('Player empty state (Req 5.12)', () => {
  it('shows an empty-state message and disables every control', () => {
    const { container, props, rerender } = renderPlayer({ storyboard: emptyStoryboard });
    expect(container.querySelector('.sb-player__empty')?.textContent).toMatch(/\S/);
    expect(screen.queryByTestId('scene-view')).toBeNull();
    for (const name of ['Play', 'Previous', 'Next']) {
      expect(button(name).disabled).toBe(true);
    }
    rerender(<Player {...props} playing />);
    expect(button('Pause').disabled).toBe(true);
  });

  it('keeps Play disabled when empty even if playing is false', () => {
    renderPlayer({ storyboard: emptyStoryboard, playing: false });
    expect(button('Play').disabled).toBe(true);
  });
});

describe('Player transitions (Req 5.10, 5.11)', () => {
  const css = readFileSync(resolve(__dirname, '../src/styles/app.css'), 'utf8');
  const keyframes = (name: string) => {
    const match = css.match(new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
    return match?.[1] ?? '';
  };

  it('uses a motion transition between 300 and 600 ms with no reduced-motion preference', () => {
    mockMatchMedia(false);
    renderPlayer();
    const view = sceneView();
    const ms = Number(view.dataset.transitionMs);
    expect(ms).toBe(TRANSITION_MS);
    expect(ms).toBeGreaterThanOrEqual(300);
    expect(ms).toBeLessThanOrEqual(600);
    expect(view.style.animationDuration).toBe(`${ms}ms`);
    expect(view.classList.contains('sb-scene--motion')).toBe(true);
    expect(view.classList.contains('sb-scene--reduced-motion')).toBe(false);
  });

  it('treats missing matchMedia as no preference', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
    renderPlayer();
    expect(sceneView().classList.contains('sb-scene--motion')).toBe(true);
    expect(Number(sceneView().dataset.transitionMs)).toBe(TRANSITION_MS);
  });

  it('switches to an opacity-only fade of 200 ms or less when the OS reports reduced motion', () => {
    const mm = mockMatchMedia(true);
    renderPlayer();
    expect(mm).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    const view = sceneView();
    const ms = Number(view.dataset.transitionMs);
    expect(ms).toBe(REDUCED_MOTION_TRANSITION_MS);
    expect(ms).toBeLessThanOrEqual(200);
    expect(view.style.animationDuration).toBe(`${ms}ms`);
    expect(view.classList.contains('sb-scene--reduced-motion')).toBe(true);
    expect(view.classList.contains('sb-scene--motion')).toBe(false);
  });

  it('lets the reducedMotion prop override the OS preference', () => {
    mockMatchMedia(false);
    renderPlayer({ reducedMotion: true });
    expect(sceneView().classList.contains('sb-scene--reduced-motion')).toBe(true);
  });

  it('defines the reduced-motion keyframes with opacity only and the motion keyframes with transform', () => {
    const fade = keyframes('sb-scene-fade');
    const enter = keyframes('sb-scene-enter');
    expect(fade).toContain('opacity');
    expect(fade).not.toMatch(/transform|translate|scale/);
    expect(enter).toContain('opacity');
    expect(enter).toContain('transform');
    expect(css).toMatch(/\.sb-scene--reduced-motion\s*\{[^}]*animation-name:\s*sb-scene-fade/);
    expect(css).toMatch(/\.sb-scene--motion\s*\{[^}]*animation-name:\s*sb-scene-enter/);
  });
});
