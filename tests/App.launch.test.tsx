import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App, REGENERATE_DEBOUNCE_MS } from '../src/components/App';
import { DEFAULT_ASPECT_RATIO } from '../src/core/aspectRatio';
import { SAVED_WORK_KEY, serializeWork } from '../src/core/savedWork';
import { SAMPLE_TRANSCRIPT } from '../src/data/sampleTranscript';
import { defaultPwaDeps, type PwaDeps } from '../src/pwa/deps';
import type { LaunchParamsLike } from '../src/pwa/launch';
import { createMemoryStorage } from '../src/pwa/storage';

// Requirements 14.4 to 14.6, 15.7 to 15.10, 16.2 to 16.5: shortcuts, share
// target, Replace_Confirmation, deferral during a render, launch queue, and
// address cleanup, exercised through the full App with fake PwaDeps.

const DIALOG_TITLE = 'Replace your current transcript?';
const ORIGIN = 'https://example.test/';

const textarea = () => screen.getByLabelText('Transcript') as HTMLTextAreaElement;
const dialogTitle = () => screen.queryByText(DIALOG_TITLE);
const dialogButton = (name: 'Replace' | 'Keep current') =>
  screen.getByRole('button', { name, hidden: true }) as HTMLButtonElement;

interface FakeLaunch {
  deps: PwaDeps;
  replaceSearch: ReturnType<typeof vi.fn>;
  /** Delivers launch params to the registered consumer, as Chromium does. */
  deliver(targetURL: string): void;
  consumerCount(): number;
}

function fakeDeps(opts: { initialSearch?: string; storedTranscript?: string; launchQueue?: boolean } = {}): FakeLaunch {
  const base = defaultPwaDeps();
  const storage = createMemoryStorage();
  if (opts.storedTranscript !== undefined) {
    storage.setItem(
      SAVED_WORK_KEY,
      serializeWork({
        transcript: opts.storedTranscript,
        overrides: {},
        aspectRatio: DEFAULT_ASPECT_RATIO,
        exportFormat: 'subtitles',
        subtitleFormat: 'srt',
      }),
    );
  }
  const consumers: Array<(p: LaunchParamsLike) => void> = [];
  const replaceSearch = vi.fn();
  const deps: PwaDeps = {
    ...base,
    storage,
    launch: {
      initialSearch: opts.initialSearch ?? '',
      replaceSearch,
      ...(opts.launchQueue ? { launchQueue: { setConsumer: (f) => void consumers.push(f) } } : {}),
    },
  };
  return {
    deps,
    replaceSearch,
    deliver: (targetURL) =>
      act(() => {
        for (const c of consumers) c({ targetURL });
      }),
    consumerCount: () => consumers.length,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App shortcuts (Req 14.4 to 14.6)', () => {
  it('?action=new with the sample loaded asks first; Replace clears and focuses the textarea', () => {
    const f = fakeDeps({ initialSearch: '?action=new' });
    render(<App pwa={f.deps} />);
    expect(dialogTitle()).not.toBeNull();
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);

    fireEvent.click(dialogButton('Replace'));
    expect(dialogTitle()).toBeNull();
    expect(textarea().value).toBe('');
    expect(document.activeElement).toBe(textarea());
    expect(f.replaceSearch).toHaveBeenCalledWith('');
  });

  it('?action=new into an empty transcript applies directly and focuses the textarea', () => {
    const f = fakeDeps({ initialSearch: '?action=new', storedTranscript: '' });
    render(<App pwa={f.deps} />);
    expect(dialogTitle()).toBeNull();
    expect(textarea().value).toBe('');
    expect(document.activeElement).toBe(textarea());
  });

  it('?action=sample with the sample already loaded applies without asking', () => {
    const f = fakeDeps({ initialSearch: '?action=sample' });
    render(<App pwa={f.deps} />);
    expect(dialogTitle()).toBeNull();
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
    expect(f.replaceSearch).toHaveBeenCalledWith('');
  });

  it('?action=sample over a different transcript asks; Keep current keeps it', () => {
    const f = fakeDeps({ initialSearch: '?action=sample', storedTranscript: 'My own words.' });
    render(<App pwa={f.deps} />);
    expect(dialogTitle()).not.toBeNull();
    fireEvent.click(dialogButton('Keep current'));
    expect(dialogTitle()).toBeNull();
    expect(textarea().value).toBe('My own words.');
  });

  it('?action=sample over a different transcript; Replace loads the sample', () => {
    const f = fakeDeps({ initialSearch: '?action=sample', storedTranscript: 'My own words.' });
    render(<App pwa={f.deps} />);
    fireEvent.click(dialogButton('Replace'));
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
  });
});

describe('App share target (Req 15.7 to 15.10, 16.5)', () => {
  it('shares into an empty transcript directly and strips only the launch params', () => {
    const f = fakeDeps({ initialSearch: '?utm=x&title=Note&text=Hello%20world.', storedTranscript: '' });
    render(<App pwa={f.deps} />);
    expect(dialogTitle()).toBeNull();
    expect(textarea().value).toBe('Note\nHello world.');
    expect(f.replaceSearch).toHaveBeenCalledTimes(1);
    expect(f.replaceSearch).toHaveBeenCalledWith('?utm=x');
  });

  it('shares into a different transcript: Replace applies the shared text', () => {
    const f = fakeDeps({ initialSearch: '?text=Shared%20line.' });
    render(<App pwa={f.deps} />);
    expect(dialogTitle()).not.toBeNull();
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
    fireEvent.click(dialogButton('Replace'));
    expect(textarea().value).toBe('Shared line.');
  });

  it('shares into a different transcript: Keep current leaves everything unchanged', () => {
    const f = fakeDeps({ initialSearch: '?text=Shared%20line.' });
    render(<App pwa={f.deps} />);
    fireEvent.click(dialogButton('Keep current'));
    expect(dialogTitle()).toBeNull();
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
  });

  it('does nothing and keeps the address for a query without launch params', () => {
    const f = fakeDeps({ initialSearch: '?utm=x' });
    render(<App pwa={f.deps} />);
    expect(dialogTitle()).toBeNull();
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
    expect(f.replaceSearch).not.toHaveBeenCalled();
  });
});

describe('App launch queue (Req 16.3)', () => {
  it('ignores the duplicate initial delivery and handles a later one without reloading', () => {
    const f = fakeDeps({ initialSearch: '?action=sample', storedTranscript: '', launchQueue: true });
    render(<App pwa={f.deps} />);
    expect(f.consumerCount()).toBe(1);
    expect(textarea().value).toBe(SAMPLE_TRANSCRIPT);
    expect(f.replaceSearch).toHaveBeenCalledTimes(1);

    // Chromium re-delivers the start URL: already handled, so ignored.
    fireEvent.change(textarea(), { target: { value: '' } });
    f.deliver(`${ORIGIN}?action=sample`);
    expect(textarea().value).toBe('');
    expect(f.replaceSearch).toHaveBeenCalledTimes(1);

    // A later launch is handled in the same page.
    f.deliver(`${ORIGIN}?text=From%20the%20queue.`);
    expect(textarea().value).toBe('From the queue.');
    expect(f.replaceSearch).toHaveBeenCalledTimes(2);
    expect(f.replaceSearch).toHaveBeenLastCalledWith('');
  });

  it('a later delivery over a different transcript opens the confirmation', () => {
    const f = fakeDeps({ launchQueue: true });
    render(<App pwa={f.deps} />);
    f.deliver(`${ORIGIN}`); // first delivery, no params
    f.deliver(`${ORIGIN}?action=new`);
    expect(dialogTitle()).not.toBeNull();
    fireEvent.click(dialogButton('Replace'));
    expect(textarea().value).toBe('');
  });
});

describe('App defers launch intents during a render (Req 16.4)', () => {
  const g = globalThis as { MediaRecorder?: unknown };
  const canvasProto = HTMLCanvasElement.prototype as unknown as { captureStream?: unknown };
  let hadRecorder = false;
  let originalRecorder: unknown;

  beforeEach(() => {
    // Report video as supported so the App starts a real Render_Job.
    hadRecorder = 'MediaRecorder' in g;
    originalRecorder = g.MediaRecorder;
    g.MediaRecorder = { isTypeSupported: () => true };
    canvasProto.captureStream = () => ({ getTracks: () => [] });
  });

  afterEach(() => {
    if (hadRecorder) g.MediaRecorder = originalRecorder;
    else delete g.MediaRecorder;
    delete canvasProto.captureStream;
  });

  it('waits until the render ends, then applies the latest intent', async () => {
    const f = fakeDeps({ launchQueue: true, storedTranscript: 'Short line.' });
    // Stored export format is subtitles; switch to video before rendering.
    const { container } = render(<App pwa={f.deps} />);
    act(() => {
      vi.advanceTimersByTime(REGENERATE_DEBOUNCE_MS);
    });
    fireEvent.click(screen.getByRole('radio', { name: /video/i }));
    fireEvent.click(container.querySelector('.sb-export-panel__download') as HTMLButtonElement);
    expect(container.querySelector('.sb-render__cancel')).not.toBeNull();

    f.deliver(`${ORIGIN}`);
    f.deliver(`${ORIGIN}?text=First.`);
    f.deliver(`${ORIGIN}?text=Latest.`);
    expect(textarea().value).toBe('Short line.');
    expect(dialogTitle()).toBeNull();
    expect(f.replaceSearch).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.sb-render__cancel') as HTMLButtonElement);
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(container.querySelector('.sb-render__cancel')).toBeNull();

    // Applied after the render with the transcript current then: different, so confirm.
    expect(dialogTitle()).not.toBeNull();
    fireEvent.click(dialogButton('Replace'));
    expect(textarea().value).toBe('Latest.');
    expect(f.replaceSearch).toHaveBeenCalledTimes(1);
  });
});
