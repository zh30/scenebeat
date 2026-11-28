// Feature: scenebeat-pwa — App persistence (task 9.4)
// Requirements 13.1 to 13.10
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App, REGENERATE_DEBOUNCE_MS } from '../src/components/App';
import { overrideKey } from '../src/core/overrides';
import { SAVED_WORK_KEY, serializeWork, type SavedWork } from '../src/core/savedWork';
import { SAMPLE_TRANSCRIPT } from '../src/data/sampleTranscript';
import { defaultPwaDeps, type PwaDeps } from '../src/pwa/deps';
import { createMemoryStorage, type StorageLike } from '../src/pwa/storage';

const TOO_LARGE = 'This transcript is too large to save on this device';
const UNAVAILABLE = "Your work can't be saved in this browser";
const TRANSCRIPT = 'Alpha bravo. Charlie delta. Echo foxtrot.';

const textarea = () => screen.getByLabelText('Transcript') as HTMLTextAreaElement;
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const radio = (name: string | RegExp) => screen.getByRole('radio', { name }) as HTMLInputElement;
const templateSelect = (n: number) =>
  screen.getByRole('combobox', { name: `Template for scene ${n}` }) as HTMLSelectElement;
const rowChip = (container: HTMLElement, n: number) =>
  container.querySelectorAll('.sb-list__item')[n - 1]?.querySelector('.sb-editor__chip')?.textContent;
const typeText = (value: string) => fireEvent.change(textarea(), { target: { value } });
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

interface Harness {
  deps: PwaDeps;
  storage: StorageLike;
  hide(): void;
}

/** Fake PwaDeps with the given storage and a controllable onHidden trigger. */
function harness(storage: StorageLike = createMemoryStorage(), useNullStorage = false): Harness {
  const listeners = new Set<() => void>();
  const deps: PwaDeps = {
    ...defaultPwaDeps(),
    storage: useNullStorage ? null : storage,
    onHidden: (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
  return {
    deps,
    storage,
    hide: () =>
      act(() => {
        for (const f of [...listeners]) f();
      }),
  };
}

const stored = (s: StorageLike) => s.getItem(SAVED_WORK_KEY);
const storedWork = (s: StorageLike) => JSON.parse(stored(s) as string) as SavedWork & { version: number };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App restores Saved_Work on start (Req 13.3 to 13.6)', () => {
  it('restores transcript, overrides, ratio, and export choices instead of the sample', () => {
    const h = harness();
    const work: SavedWork = {
      transcript: TRANSCRIPT,
      overrides: {
        [overrideKey('Charlie delta.', 0)]: { sourceText: 'Charlie delta.', rank: 0, manualTemplate: 'quote' },
      },
      aspectRatio: '9:16',
      exportFormat: 'subtitles',
      subtitleFormat: 'vtt',
    };
    h.storage.setItem(SAVED_WORK_KEY, serializeWork(work));

    const { container } = render(<App pwa={h.deps} />);

    expect(textarea().value).toBe(TRANSCRIPT);
    expect(templateSelect(2).value).toBe('quote');
    expect(rowChip(container, 2)).toBe('Edited');
    expect(rowChip(container, 1)).toBe('Auto');
    expect(radio(/^9:16/).checked).toBe(true);
    expect(radio('Subtitles').checked).toBe(true);
    expect(radio('WebVTT (web players and YouTube)').checked).toBe(true);
  });

  it('drops restored overrides whose sentence is not in the transcript (reconcile)', () => {
    const h = harness();
    h.storage.setItem(
      SAVED_WORK_KEY,
      serializeWork({
        transcript: TRANSCRIPT,
        overrides: {
          [overrideKey('Missing sentence.', 0)]: { sourceText: 'Missing sentence.', rank: 0, manualTemplate: 'quote' },
        },
        aspectRatio: '16:9',
        exportFormat: 'subtitles',
        subtitleFormat: 'srt',
      }),
    );
    const { container } = render(<App pwa={h.deps} />);
    expect([1, 2, 3].map((n) => rowChip(container, n))).toEqual(['Auto', 'Auto', 'Auto']);
  });

  it('a restored "video" format falls back to the browser default without video support', () => {
    const h = harness();
    h.storage.setItem(
      SAVED_WORK_KEY,
      serializeWork({
        transcript: TRANSCRIPT,
        overrides: {},
        aspectRatio: '1:1',
        exportFormat: 'video',
        subtitleFormat: 'srt',
      }),
    );
    render(<App pwa={h.deps} />);
    expect(textarea().value).toBe(TRANSCRIPT);
    expect(radio(/^1:1/).checked).toBe(true);
    expect(radio('Video').checked).toBe(false);
    expect(radio('Subtitles').checked).toBe(true);
  });

  it.each(['not json', '{"version":2,"transcript":"x"}', '{"version":1,"transcript":5}'])(
    'corrupt stored value %j falls back to the sample, and the next write replaces it',
    (raw) => {
      const h = harness();
      h.storage.setItem(SAVED_WORK_KEY, raw);
      render(<App pwa={h.deps} />);
      expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
      expect(radio(/^16:9/).checked).toBe(true);

      typeText('Fresh start.');
      advance(500);
      expect(storedWork(h.storage).transcript).toBe('Fresh start.');
    },
  );
});

describe('App saves Saved_Work (Req 13.1, 13.2)', () => {
  it('does not write on mount', () => {
    const h = harness();
    render(<App pwa={h.deps} />);
    advance(2000);
    expect(stored(h.storage)).toBeNull();
  });

  it('writes 500 ms after the last change, restarting on each change', () => {
    const h = harness();
    render(<App pwa={h.deps} />);
    typeText('One.');
    advance(400);
    typeText('One. Two.');
    advance(499);
    expect(stored(h.storage)).toBeNull();
    advance(1);
    expect(stored(h.storage)).toBe(
      serializeWork({
        transcript: 'One. Two.',
        overrides: {},
        aspectRatio: '16:9',
        exportFormat: 'subtitles',
        subtitleFormat: 'srt',
      }),
    );
  });

  it('saves settings and scene edits', () => {
    const h = harness();
    render(<App pwa={h.deps} />);
    typeText(TRANSCRIPT);
    advance(REGENERATE_DEBOUNCE_MS);
    fireEvent.change(templateSelect(1), { target: { value: 'timeline' } });
    fireEvent.click(radio(/^4:5/));
    fireEvent.click(radio('Storyboard (JSON)'));
    advance(500);
    const w = storedWork(h.storage);
    expect(w.aspectRatio).toBe('4:5');
    expect(w.exportFormat).toBe('storyboard-json');
    expect(w.overrides).toEqual({
      [overrideKey('Alpha bravo.', 0)]: { sourceText: 'Alpha bravo.', rank: 0, manualTemplate: 'timeline' },
    });
  });

  it('flushes a pending write at once when the page is hidden', () => {
    const h = harness();
    render(<App pwa={h.deps} />);
    typeText('Pending text.');
    advance(100);
    expect(stored(h.storage)).toBeNull();
    h.hide();
    expect(storedWork(h.storage).transcript).toBe('Pending text.');
  });
});

describe('App "Clear" and the saved note (Req 13.9, 13.10)', () => {
  it('"Clear" removes the key at once and the next write stores the cleared state', () => {
    const h = harness();
    h.storage.setItem(
      SAVED_WORK_KEY,
      serializeWork({ transcript: TRANSCRIPT, overrides: {}, aspectRatio: '16:9', exportFormat: 'subtitles', subtitleFormat: 'srt' }),
    );
    render(<App pwa={h.deps} />);
    fireEvent.click(button('Clear'));
    expect(stored(h.storage)).toBeNull();
    advance(500);
    expect(storedWork(h.storage).transcript).toBe('');
  });

  it('shows "Saved on this device only"', () => {
    render(<App pwa={harness().deps} />);
    expect(screen.getByText('Saved on this device only')).not.toBeNull();
  });
});

describe('App storage notices (Req 13.7, 13.8)', () => {
  it('too-large work keeps the previous string, shows the notice, and the next successful write clears it', () => {
    const h = harness();
    const previous = serializeWork({
      transcript: TRANSCRIPT,
      overrides: {},
      aspectRatio: '16:9',
      exportFormat: 'subtitles',
      subtitleFormat: 'srt',
    });
    h.storage.setItem(SAVED_WORK_KEY, previous);
    render(<App pwa={h.deps} />);

    // Flush through "hidden" before the storyboard debounce, so the huge text is never split.
    typeText('a'.repeat(1_000_001));
    h.hide();
    expect(screen.getByText(TOO_LARGE)).not.toBeNull();
    expect(stored(h.storage)).toBe(previous);

    typeText('Short again.');
    h.hide();
    expect(storedWork(h.storage).transcript).toBe('Short again.');
    expect(screen.queryByText(TOO_LARGE)).toBeNull();
  });

  it('a throwing setItem shows the unavailable notice once and the app keeps working', () => {
    const h = harness({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
      removeItem: () => {},
    });
    render(<App pwa={h.deps} />);
    typeText('First.');
    advance(500);
    expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(1);
    typeText('First. Second.');
    advance(500);
    expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(1);
    expect(textarea().value).toBe('First. Second.');
    expect(Number(screen.getByTestId('storyboard-total').textContent)).toBe(2);
  });

  it('a throwing getItem at start shows the notice and starts with the sample', () => {
    const h = harness({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {},
    });
    render(<App pwa={h.deps} />);
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
    expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(1);
    typeText('Next.');
    advance(500);
    expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(1);
  });

  it('missing storage (null) shows the unavailable notice on the first write', () => {
    const h = harness(createMemoryStorage(), true);
    render(<App pwa={h.deps} />);
    expect(screen.queryByText(UNAVAILABLE)).toBeNull();
    typeText('Hello.');
    advance(500);
    expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(1);
  });
});
