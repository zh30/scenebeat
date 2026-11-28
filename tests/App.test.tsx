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

// ---------------------------------------------------------------------------
// Feature: scenebeat-edit-export — App integration (task 15.3)
// ---------------------------------------------------------------------------

const EDIT_TRANSCRIPT = 'Alpha bravo. Charlie delta. Echo foxtrot.';

const loadText = (value: string) => {
  typeText(value);
  advance(REGENERATE_DEBOUNCE_MS);
};

const templateSelect = (n: number) =>
  screen.getByRole('combobox', { name: `Template for scene ${n}` }) as HTMLSelectElement;
const countOf = (template: string) =>
  Number(screen.getByTestId(`storyboard-count-${template}`).querySelector('.sb-list__num')?.textContent);
const listItems = (container: HTMLElement) => Array.from(container.querySelectorAll('.sb-list__item'));
const rowText = (container: HTMLElement, n: number) =>
  listItems(container)[n - 1].querySelector('.sb-list__text')?.textContent;
const rowChip = (container: HTMLElement, n: number) =>
  listItems(container)[n - 1].querySelector('.sb-editor__chip')?.textContent;
const playerTag = (container: HTMLElement) => container.querySelector('.sb-player__tag')?.textContent;
const playerScreen = (container: HTMLElement) =>
  container.querySelector('.sb-player__screen') as HTMLElement;
const radio = (name: string | RegExp) => screen.getByRole('radio', { name }) as HTMLInputElement;
const isPlaying = () => screen.queryByRole('button', { name: 'Pause' }) !== null;

const saveSceneText = (n: number, value: string) => {
  fireEvent.click(button(`Edit text of scene ${n}`));
  fireEvent.change(screen.getByLabelText(`Text of scene ${n}`), { target: { value } });
  fireEvent.click(button(`Save text of scene ${n}`));
};

describe('App scene editing (Req 1.5, 2.10, 7.1 to 7.4)', () => {
  it('a template change updates counts and the Player, and pauses playback at the same position', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    expect(countOf('keyword-highlight')).toBe(3);
    fireEvent.click(button('Next'));
    fireEvent.click(button('Play'));
    expect(isPlaying()).toBe(true);
    expect(position(container)).toBe('2 / 3');

    fireEvent.change(templateSelect(2), { target: { value: 'quote' } });

    expect(isPlaying()).toBe(false);
    expect(position(container)).toBe('2 / 3');
    expect(templateSelect(2).value).toBe('quote');
    expect(countOf('quote')).toBe(1);
    expect(countOf('keyword-highlight')).toBe(2);
    expect(playerTag(container)).toBe('Quote');
    expect(container.querySelector('.sb-stage blockquote.sb-quote__text')).not.toBeNull();
    expect(rowChip(container, 2)).toBe('Edited');
    expect(rowChip(container, 1)).toBe('Auto');

    advance(10_000);
    expect(position(container)).toBe('2 / 3');
  });

  it('opening the text editor pauses playback and keeps the position', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    fireEvent.click(button('Next'));
    fireEvent.click(button('Play'));
    fireEvent.click(button('Edit text of scene 3'));
    expect(isPlaying()).toBe(false);
    expect(position(container)).toBe('2 / 3');
  });

  it('a text edit changes the scene but not the transcript, and is never re-split', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);

    saveSceneText(1, 'Revenue grew 45%. Really!\nYes.');

    expect(textarea().value).toBe(EDIT_TRANSCRIPT);
    expect(total()).toBe(3);
    expect(rowText(container, 1)).toBe('Revenue grew 45%. Really! Yes.');
    expect(rowChip(container, 1)).toBe('Edited');
    // Template re-assigned from the edited text (no manual template).
    expect(templateSelect(1).value).toBe('big-number');
    expect(countOf('big-number')).toBe(1);
    expect(playerTag(container)).toBe('Big number');
  });

  it('saving empty text shows the error and keeps the scene unchanged', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    saveSceneText(2, '   ');
    expect(screen.getByRole('alert').textContent).toBe("Scene text can't be empty.");
    expect(rowText(container, 2)).toBe('Charlie delta.');
    expect(rowChip(container, 2)).toBe('Auto');
  });

  it('"Reset to automatic" restores the automatic scene', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    fireEvent.change(templateSelect(3), { target: { value: 'timeline' } });
    saveSceneText(3, 'Something new.');
    expect(rowChip(container, 3)).toBe('Edited');

    fireEvent.click(button('Reset scene 3 to automatic'));
    expect(rowText(container, 3)).toBe('Echo foxtrot.');
    expect(templateSelect(3).value).toBe('keyword-highlight');
    expect(rowChip(container, 3)).toBe('Auto');
    expect(button('Reset scene 3 to automatic').disabled).toBe(true);
  });
});

describe('App edits across transcript changes (Req 6.1, 6.3, 6.4, 6.6)', () => {
  it('keeps edits when another sentence changes or is inserted before them', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    fireEvent.change(templateSelect(2), { target: { value: 'quote' } });
    saveSceneText(3, 'Echo edited.');

    // Change the first sentence: both edits stay.
    loadText('Golf hotel. Charlie delta. Echo foxtrot.');
    expect(templateSelect(2).value).toBe('quote');
    expect(rowChip(container, 2)).toBe('Edited');
    expect(rowText(container, 3)).toBe('Echo edited.');

    // Insert a sentence at the start: the edits follow their sentences.
    loadText('New start. Golf hotel. Charlie delta. Echo foxtrot.');
    expect(total()).toBe(4);
    expect(templateSelect(3).value).toBe('quote');
    expect(rowChip(container, 3)).toBe('Edited');
    expect(rowText(container, 4)).toBe('Echo edited.');
    expect(rowChip(container, 2)).toBe('Auto');
  });

  it('drops an edit whose sentence is removed from the transcript', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    fireEvent.change(templateSelect(2), { target: { value: 'quote' } });
    loadText('Alpha bravo. Echo foxtrot.');
    loadText(EDIT_TRANSCRIPT);
    expect(templateSelect(2).value).toBe('keyword-highlight');
    expect(rowChip(container, 2)).toBe('Auto');
  });

  it('"Clear" drops every edit', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    fireEvent.change(templateSelect(1), { target: { value: 'timeline' } });
    fireEvent.click(button('Clear'));
    advance(REGENERATE_DEBOUNCE_MS);
    expect(total()).toBe(0);

    loadText(EDIT_TRANSCRIPT);
    expect(templateSelect(1).value).toBe('keyword-highlight');
    expect(rowChip(container, 1)).toBe('Auto');
  });
});

describe('App aspect ratio (Req 8.2, 8.5, 8.7)', () => {
  it('starts at 16:9 and a ratio change reshapes the screen without touching playback', () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    expect(radio(/^16:9/).checked).toBe(true);
    expect(playerScreen(container).dataset.ratio).toBe('16:9');

    fireEvent.click(button('Next'));
    fireEvent.click(button('Next'));
    fireEvent.click(button('Play'));
    expect(position(container)).toBe('3 / 3');

    fireEvent.click(radio(/^9:16/));
    const screenEl = playerScreen(container);
    expect(screenEl.dataset.ratio).toBe('9:16');
    expect(screenEl.style.getPropertyValue('--sb-ratio-w')).toBe('9');
    expect(screenEl.style.getPropertyValue('--sb-ratio-h')).toBe('16');
    expect(position(container)).toBe('3 / 3');
    expect(isPlaying()).toBe(true);
  });
});

describe('App export panel (Req 5.1, 9.1, 9.2, 16.2)', () => {
  let createdBlobs: Blob[];
  let downloads: string[];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    createdBlobs = [];
    downloads = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      createdBlobs.push(blob);
      return 'blob:scenebeat-app-test';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it('defaults to Subtitles with Video disabled when video is unsupported (jsdom)', () => {
    render(<App />);
    expect(radio('Video').disabled).toBe(true);
    expect(radio('Subtitles').checked).toBe(true);
    expect(radio('SRT (works almost everywhere)').checked).toBe(true);
    expect(button('Download subtitles').disabled).toBe(false);
  });

  it('subtitle downloads reflect edited text', async () => {
    render(<App />);
    loadText(EDIT_TRANSCRIPT);
    saveSceneText(2, 'Charlie & <delta> edited.');

    fireEvent.click(button('Download subtitles'));
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^scenebeat-subtitles-\d{8}-\d{6}\.srt$/);
    expect(createdBlobs[0].type).toBe('application/x-subrip');
    const srt = await createdBlobs[0].text();
    expect(srt).toContain('\nCharlie & <delta> edited.\n');
    expect(srt).not.toContain('Charlie delta.');

    fireEvent.click(radio('WebVTT (web players and YouTube)'));
    fireEvent.click(button('Download subtitles'));
    expect(downloads[1]).toMatch(/^scenebeat-subtitles-\d{8}-\d{6}\.vtt$/);
    expect(createdBlobs[1].type).toBe('text/vtt');
    const vtt = await createdBlobs[1].text();
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('\nCharlie &amp; &lt;delta&gt; edited.\n');
  });

  it('the storyboard JSON is version 1.1 and records edits', async () => {
    render(<App />);
    loadText(EDIT_TRANSCRIPT);
    fireEvent.change(templateSelect(1), { target: { value: 'quote' } });
    saveSceneText(3, 'Echo edited.');

    fireEvent.click(radio('Storyboard (JSON)'));
    fireEvent.click(button('Download storyboard'));
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^scenebeat-storyboard-\d{8}-\d{6}\.json$/);
    const json = JSON.parse(await createdBlobs[0].text());
    expect(json.version).toBe('1.1');
    expect(json.sceneCount).toBe(3);
    expect(json.scenes.map((s: { templateSource: string }) => s.templateSource)).toEqual([
      'manual',
      'auto',
      'auto',
    ]);
    expect(json.scenes[0].template).toBe('quote');
    expect(json.scenes[0].data).toEqual({ quote: 'Alpha bravo.' });
    expect(json.scenes[2].text).toBe('Echo edited.');
    expect(Object.keys(json.scenes[0])).toEqual([
      'index',
      'text',
      'template',
      'templateSource',
      'durationMs',
      'data',
    ]);
  });
});

describe('App locks controls while a video renders (Req 15.3)', () => {
  beforeEach(() => {
    const noop = () => undefined;
    const fakeCtx: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(fakeCtx, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'canvas') return { width: 0, height: 0 };
        if (prop === 'measureText') return (t: string) => ({ width: [...t].length * 10 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: noop });
        }
        return noop;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ctx as unknown as CanvasRenderingContext2D,
    );
    (HTMLCanvasElement.prototype as unknown as { captureStream: unknown }).captureStream = () => ({
      getTracks: () => [],
      getAudioTracks: () => [],
    });
    class FakeMediaRecorder {
      static isTypeSupported(type: string) {
        return type === 'video/mp4;codecs=avc1.640028';
      }
      state: 'inactive' | 'recording' = 'inactive';
      ondataavailable = null;
      onstop: (() => void) | null = null;
      onerror = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', noop);
  });

  afterEach(() => {
    delete (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('disables input, editors, picker, format choice, Download, and Player controls until cancelled', async () => {
    const { container } = render(<App />);
    loadText(EDIT_TRANSCRIPT);
    expect(radio('Video').checked).toBe(true);
    fireEvent.click(button('Next'));
    fireEvent.click(button('Play'));

    fireEvent.click(button('Download video'));
    await act(async () => {});

    expect(screen.getByRole('progressbar', { name: 'Video export progress' })).not.toBeNull();
    expect(isPlaying()).toBe(false);
    expect(position(container)).toBe('2 / 3');
    expect(textarea().disabled).toBe(true);
    expect(button('Load sample').disabled).toBe(true);
    expect(button('Clear').disabled).toBe(true);
    expect(templateSelect(1).disabled).toBe(true);
    expect(button('Edit text of scene 1').disabled).toBe(true);
    // Radios are disabled through their <fieldset>, so check the :disabled state.
    expect(radio(/^9:16/).matches(':disabled')).toBe(true);
    expect(radio('Subtitles').matches(':disabled')).toBe(true);
    expect(button('Download video').disabled).toBe(true);
    expect(button('Play').disabled).toBe(true);
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(false);

    fireEvent.click(button('Cancel'));
    await act(async () => {});
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(textarea().disabled).toBe(false);
    expect(templateSelect(1).disabled).toBe(false);
    expect(button('Download video').disabled).toBe(false);
    expect(button('Play').disabled).toBe(false);
  });
});
