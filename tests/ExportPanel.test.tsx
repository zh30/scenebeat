import { act, fireEvent, render, screen } from '@testing-library/react';
import { useReducer, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExportPanel,
  FAILED_MESSAGE,
  HIDDEN_MESSAGE,
  RENDERING_MESSAGE,
  UNSUPPORTED_MESSAGE,
  WEBM_MESSAGE,
  type ExportFormat,
  type ExportPanelProps,
  type SubtitleFormat,
} from '../src/components/ExportPanel';
import type { AspectRatioId } from '../src/core/aspectRatio';
import { buildStoryboard } from '../src/core/buildStoryboard';
import { buildEditedStoryboard } from '../src/core/editedStoryboard';
import { totalDuration } from '../src/core/framePlan';
import { INITIAL_RENDER_STATUS, renderStatusReducer, type RenderStatus } from '../src/core/renderStatus';
import { serializeStoryboard } from '../src/core/serialize';
import { buildCues, formatSrt, formatVtt } from '../src/core/subtitles';
import type { Storyboard, ValidationError } from '../src/core/types';
import type { FrameContext } from '../src/video/canvasTypes';
import type { FrameClock } from '../src/video/frameClock';
import { fallbackMeasure } from '../src/video/measure';
import type { Recorder } from '../src/video/recorder';
import type { RenderDeps } from '../src/video/renderJob';
import type { VideoSupport } from '../src/video/support';

const MP4 = 'video/mp4;codecs=avc1.640028';
const WEBM = 'video/webm;codecs=vp9';

const created = new Date('2026-10-31T12:00:00.000Z');
const storyboard = buildEditedStoryboard(
  buildStoryboard('Revenue grew 45% last year. She said "ship it today." 首先，我们打开编辑器。', created),
  {},
);
const emptyStoryboard = buildEditedStoryboard(buildStoryboard('', created), {});
const TOTAL_MS = totalDuration(storyboard.scenes.map((s) => s.durationMs));
// Local time, so file names do not depend on the machine's time zone.
const fixedNow = () => new Date(2026, 9, 31, 13, 5, 9);

const SUPPORTED: VideoSupport = { supported: true, mimeType: MP4, container: 'mp4' };
const UNSUPPORTED: VideoSupport = { supported: false };

// ---------------------------------------------------------------------------
// Browser API mocks: object URLs, anchor click, network spies.
// ---------------------------------------------------------------------------

let createdBlobs: Blob[];
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clickedAnchors: { href: string; download: string; connected: boolean }[];
let clickSpy: ReturnType<typeof vi.spyOn>;
let fetchSpy: ReturnType<typeof vi.fn>;
let xhrOpen: ReturnType<typeof vi.fn>;
let xhrSend: ReturnType<typeof vi.fn>;
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  createdBlobs = [];
  clickedAnchors = [];
  createObjectURL = vi.fn((blob: Blob) => {
    createdBlobs.push(blob);
    return 'blob:scenebeat-test';
  });
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedAnchors.push({
      href: this.getAttribute('href') ?? '',
      download: this.download,
      connected: this.isConnected,
    });
  });

  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open') as unknown as ReturnType<typeof vi.fn>;
  xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send') as unknown as ReturnType<typeof vi.fn>;
});

afterEach(() => {
  vi.restoreAllMocks();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Fake render dependencies (same shape as tests/renderJob.test.ts).
// ---------------------------------------------------------------------------

function fakeContext(width: number, height: number): FrameContext {
  const noop = (): void => {};
  const gradient = () => ({ addColorStop: noop }) as unknown as CanvasGradient;
  return {
    canvas: { width, height },
    fillStyle: '#000',
    globalAlpha: 1,
    font: '10px sans-serif',
    textBaseline: 'alphabetic',
    textAlign: 'start',
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    setTransform: noop,
    fillRect: noop,
    fillText: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    arcTo: noop,
    closePath: noop,
    fill: noop,
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    measureText: (text) => ({ width: text.length * 10 }),
  };
}

function createFakeDeps(isTypeSupported: (type: string) => boolean = (t) => t === MP4) {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, (now: number) => void>();
  const clock: FrameClock = {
    now: () => now,
    request: (cb) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel: (id) => {
      pending.delete(id);
    },
  };
  const advanceTo = (t: number) => {
    now = t;
    const due = [...pending.values()];
    pending.clear();
    for (const cb of due) cb(now);
  };

  const recorderLog: string[] = [];
  let errorCb: ((e: unknown) => void) | null = null;
  const recorder: Recorder = {
    start: () => {
      recorderLog.push('start');
    },
    stop: () => {
      recorderLog.push('stop');
      return Promise.resolve([new Blob(['video-bytes'])]);
    },
    discard: () => {
      recorderLog.push('discard');
    },
    onError: (cb) => {
      errorCb = cb;
    },
  };

  const hiddenListeners = new Set<() => void>();
  const track = { kind: 'video', stop: vi.fn() };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
  const canvasSizes: Array<[number, number]> = [];

  const deps: RenderDeps = {
    createCanvas: (w, h) => {
      canvasSizes.push([w, h]);
      return { ctx: fakeContext(w, h), captureStream: () => stream };
    },
    createRecorder: () => recorder,
    clock,
    fontsReady: () => Promise.resolve(),
    isTypeSupported,
    visibility: {
      isHidden: () => false,
      onHidden: (cb) => {
        hiddenListeners.add(cb);
        return () => hiddenListeners.delete(cb);
      },
    },
    measure: fallbackMeasure,
  };
  return {
    deps,
    advanceTo,
    pending,
    recorderLog,
    canvasSizes,
    emitError: (e: unknown) => errorCb?.(e),
    hide: () => {
      for (const cb of [...hiddenListeners]) cb();
    },
  };
}

const flush = () =>
  act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });

// ---------------------------------------------------------------------------
// Harness: real useReducer with renderStatusReducer and local format state.
// ---------------------------------------------------------------------------

interface HarnessProps {
  storyboard?: Storyboard;
  ratio?: AspectRatioId;
  videoSupport?: VideoSupport;
  initialFormat?: ExportFormat;
  initialSubtitleFormat?: SubtitleFormat;
  initialStatus?: RenderStatus;
  renderDeps?: RenderDeps;
  validate?: ExportPanelProps['validate'];
  onRenderStart?: () => void;
}

function Harness({
  storyboard: sb = storyboard,
  ratio = '16:9',
  videoSupport = SUPPORTED,
  initialFormat,
  initialSubtitleFormat = 'srt',
  initialStatus = INITIAL_RENDER_STATUS,
  renderDeps,
  validate,
  onRenderStart,
}: HarnessProps) {
  const [format, setFormat] = useState<ExportFormat>(
    initialFormat ?? (videoSupport.supported ? 'video' : 'subtitles'),
  );
  const [subtitleFormat, setSubtitleFormat] = useState<SubtitleFormat>(initialSubtitleFormat);
  const [status, dispatch] = useReducer(renderStatusReducer, initialStatus);
  return (
    <ExportPanel
      storyboard={sb}
      ratio={ratio}
      videoSupport={videoSupport}
      format={format}
      onFormatChange={setFormat}
      subtitleFormat={subtitleFormat}
      onSubtitleFormatChange={setSubtitleFormat}
      renderStatus={status}
      dispatchRender={dispatch}
      onRenderStart={onRenderStart}
      renderDeps={renderDeps}
      validate={validate}
      now={fixedNow}
    />
  );
}

function formatRadio(label: string): HTMLInputElement {
  return screen.getByRole('radio', { name: label }) as HTMLInputElement;
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function isDisabled(el: Element): boolean {
  return el.matches(':disabled');
}

// ---------------------------------------------------------------------------
// Storyboard (JSON): cases ported from ExportButton.test.tsx
// ---------------------------------------------------------------------------

describe('ExportPanel: Storyboard (JSON)', () => {
  const renderJson = (props: HarnessProps = {}) =>
    render(<Harness initialFormat="storyboard-json" {...props} />);

  it('validates the serialized storyboard before downloading (9.8)', () => {
    const validate = vi.fn((_value: unknown): ValidationError[] => []);
    renderJson({ validate });

    fireEvent.click(button('Download storyboard'));

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.calls[0][0]).toEqual(JSON.parse(serializeStoryboard(storyboard)));
    expect(validate.mock.invocationCallOrder[0]).toBeLessThan(
      createObjectURL.mock.invocationCallOrder[0],
    );
  });

  it('downloads an application/json Blob with the timestamped filename', async () => {
    renderJson();

    fireEvent.click(button('Download storyboard'));

    expect(createdBlobs).toHaveLength(1);
    const blob = createdBlobs[0];
    expect(blob.type).toBe('application/json');
    if (typeof blob.text === 'function') {
      const text = await blob.text();
      expect(text).toBe(serializeStoryboard(storyboard));
      expect(JSON.parse(text).version).toBe('1.1');
    }
    expect(clickedAnchors).toEqual([
      {
        href: 'blob:scenebeat-test',
        download: 'scenebeat-storyboard-20261031-130509.json',
        connected: true,
      },
    ]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:scenebeat-test');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cancels the download and lists errors when validation fails (9.8)', () => {
    const errors: ValidationError[] = [
      { path: '$.sceneCount', message: 'sceneCount 4 does not match scenes length 3' },
      { path: '$.scenes[1].template', message: 'invalid template "slideshow"' },
    ];
    renderJson({ validate: () => errors });

    fireEvent.click(button('Download storyboard'));

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    const items = screen.getByRole('alert').querySelectorAll('ul.sb-export__errors li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('$.sceneCount: sceneCount 4 does not match scenes length 3');
    expect(items[1].textContent).toBe('$.scenes[1].template: invalid template "slideshow"');
  });

  it('clears previous errors after a later successful export', () => {
    let errors: ValidationError[] = [{ path: '$', message: 'broken' }];
    renderJson({ validate: () => errors });

    fireEvent.click(button('Download storyboard'));
    expect(screen.getByRole('alert')).toBeTruthy();

    errors = [];
    fireEvent.click(button('Download storyboard'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('is disabled when the storyboard has zero scenes (9.6)', () => {
    renderJson({ storyboard: emptyStoryboard });
    const b = button('Download storyboard');
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('is enabled when the storyboard has scenes', () => {
    renderJson();
    expect(button('Download storyboard').disabled).toBe(false);
  });

  it('makes no network requests during export (17.1)', () => {
    renderJson();
    fireEvent.click(button('Download storyboard'));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(xhrSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Format choice
// ---------------------------------------------------------------------------

describe('ExportPanel: format choice', () => {
  it('shows the three options with descriptions, Video selected by default when supported (9.1)', () => {
    render(<Harness />);
    const video = formatRadio('Video');
    const subtitles = formatRadio('Subtitles');
    const json = formatRadio('Storyboard (JSON)');
    expect(video.checked).toBe(true);
    expect(subtitles.checked).toBe(false);
    expect(json.checked).toBe(false);

    const desc = (input: HTMLInputElement) =>
      document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent;
    expect(desc(video)).toBe('A ready-to-post video of your scenes (no sound)');
    expect(desc(subtitles)).toContain('CapCut / 剪映, Premiere Pro, DaVinci Resolve, or YouTube');
    expect(desc(json)).toBe('Scene data for developers and other tools');
  });

  it('shows the video info line with ratio and length (9.4)', () => {
    render(<Harness ratio="9:16" />);
    const info = document.querySelector('.sb-export-panel__info');
    const seconds = (Math.round(TOTAL_MS / 100) / 10).toFixed(1);
    expect(info?.textContent).toBe(`9:16 · ${seconds} seconds`);
  });

  it('names the Download button after the chosen format', () => {
    render(<Harness />);
    expect(button('Download video')).toBeTruthy();
    fireEvent.click(formatRadio('Subtitles'));
    expect(button('Download subtitles')).toBeTruthy();
    fireEvent.click(formatRadio('Storyboard (JSON)'));
    expect(button('Download storyboard')).toBeTruthy();
  });

  it('shows the SRT/WebVTT sub-choice only for subtitles, with SRT as the default (9.2)', () => {
    render(<Harness />);
    expect(screen.queryByRole('radio', { name: 'SRT (works almost everywhere)' })).toBeNull();
    fireEvent.click(formatRadio('Subtitles'));
    expect(formatRadio('SRT (works almost everywhere)').checked).toBe(true);
    expect(formatRadio('WebVTT (web players and YouTube)').checked).toBe(false);
  });

  it.each(['video', 'subtitles', 'storyboard-json'] as const)(
    'disables Download with zero scenes for %s (9.6)',
    (format) => {
      render(<Harness storyboard={emptyStoryboard} initialFormat={format} />);
      const b = document.querySelector('.sb-export-panel__download') as HTMLButtonElement;
      expect(b.disabled).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------

describe('ExportPanel: subtitles', () => {
  it('downloads an SRT file with the subtitle name and MIME type (12.1)', async () => {
    render(<Harness initialFormat="subtitles" />);
    fireEvent.click(button('Download subtitles'));

    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0].type).toBe('application/x-subrip');
    expect(clickedAnchors.map((a) => a.download)).toEqual(['scenebeat-subtitles-20261031-130509.srt']);
    if (typeof createdBlobs[0].text === 'function') {
      expect(await createdBlobs[0].text()).toBe(formatSrt(buildCues(storyboard)));
    }
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:scenebeat-test');
  });

  it('downloads a WebVTT file after choosing WebVTT (12.2)', async () => {
    render(<Harness initialFormat="subtitles" />);
    fireEvent.click(formatRadio('WebVTT (web players and YouTube)'));
    fireEvent.click(button('Download subtitles'));

    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0].type).toBe('text/vtt');
    expect(clickedAnchors.map((a) => a.download)).toEqual(['scenebeat-subtitles-20261031-130509.vtt']);
    if (typeof createdBlobs[0].text === 'function') {
      expect(await createdBlobs[0].text()).toBe(formatVtt(buildCues(storyboard)));
    }
  });

  it('validates before creating a subtitle file (9.8)', () => {
    render(
      <Harness initialFormat="subtitles" validate={() => [{ path: '$.version', message: 'bad' }]} />,
    );
    fireEvent.click(button('Download subtitles'));
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('$.version: bad');
  });

  it('makes no network requests for subtitles (17.1)', () => {
    render(<Harness initialFormat="subtitles" />);
    fireEvent.click(button('Download subtitles'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unsupported video
// ---------------------------------------------------------------------------

describe('ExportPanel: unsupported video (16.2)', () => {
  it('disables the Video option, preselects Subtitles, and shows the message', () => {
    render(<Harness videoSupport={UNSUPPORTED} />);
    expect(formatRadio('Video').disabled).toBe(true);
    expect(formatRadio('Subtitles').checked).toBe(true);
    expect(screen.getByText(UNSUPPORTED_MESSAGE)).toBeTruthy();
    expect(button('Download subtitles').disabled).toBe(false);
  });

  it('falls back to subtitles even if the format state says video', () => {
    render(<Harness videoSupport={UNSUPPORTED} initialFormat="video" />);
    expect(formatRadio('Subtitles').checked).toBe(true);
    fireEvent.click(button('Download subtitles'));
    expect(clickedAnchors.map((a) => a.download)).toEqual(['scenebeat-subtitles-20261031-130509.srt']);
  });

  it('does not show the message when video is supported', () => {
    render(<Harness />);
    expect(screen.queryByText(UNSUPPORTED_MESSAGE)).toBeNull();
    expect(formatRadio('Video').disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Video rendering
// ---------------------------------------------------------------------------

describe('ExportPanel: video', () => {
  it('validates first and starts no job when validation fails (9.8)', async () => {
    const fake = createFakeDeps();
    const onRenderStart = vi.fn();
    render(
      <Harness
        renderDeps={fake.deps}
        onRenderStart={onRenderStart}
        validate={() => [{ path: '$', message: 'broken' }]}
      />,
    );
    fireEvent.click(button('Download video'));
    await flush();
    expect(onRenderStart).not.toHaveBeenCalled();
    expect(fake.canvasSizes).toHaveLength(0);
    expect(document.querySelector('progress')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('$: broken');
  });

  it('shows progress, locks controls, then downloads an MP4 named after ratio and timestamp (14.3, 15.1, 15.2)', async () => {
    const fake = createFakeDeps();
    const onRenderStart = vi.fn();
    render(<Harness ratio="9:16" renderDeps={fake.deps} onRenderStart={onRenderStart} />);

    fireEvent.click(button('Download video'));
    expect(onRenderStart).toHaveBeenCalledTimes(1);
    await flush();
    expect(fake.canvasSizes).toEqual([[1080, 1920]]);

    const progress = document.querySelector('progress') as HTMLProgressElement;
    expect(progress).not.toBeNull();
    expect(progress.max).toBe(100);
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText(`Scene 1 / ${storyboard.scenes.length}`)).toBeTruthy();
    expect(screen.getByText(RENDERING_MESSAGE)).toBeTruthy();

    // Controls are locked; Cancel is the only enabled export control.
    expect(button('Download video').disabled).toBe(true);
    for (const label of ['Video', 'Subtitles', 'Storyboard (JSON)']) {
      expect(isDisabled(formatRadio(label))).toBe(true);
    }
    expect(button('Cancel').disabled).toBe(false);

    act(() => fake.advanceTo(TOTAL_MS / 2));
    const half = Math.floor((100 * (TOTAL_MS / 2)) / TOTAL_MS);
    expect(screen.getByText(`${half}%`)).toBeTruthy();
    expect(progress.value).toBe(half);

    act(() => fake.advanceTo(TOTAL_MS));
    await flush();

    expect(document.querySelector('progress')).toBeNull();
    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0].type).toBe('video/mp4');
    expect(clickedAnchors.map((a) => a.download)).toEqual([
      'scenebeat-video-9x16-20261031-130509.mp4',
    ]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:scenebeat-test');
    expect(screen.queryByRole('status')).toBeNull();
    expect(button('Download video').disabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
  });

  it('downloads a WebM and shows the WebM note (14.6)', async () => {
    const fake = createFakeDeps((t) => t === WEBM);
    render(<Harness renderDeps={fake.deps} />);
    fireEvent.click(button('Download video'));
    await flush();
    act(() => fake.advanceTo(TOTAL_MS));
    await flush();

    expect(createdBlobs[0].type).toBe('video/webm');
    expect(clickedAnchors.map((a) => a.download)).toEqual([
      'scenebeat-video-16x9-20261031-130509.webm',
    ]);
    expect(screen.getByRole('status').textContent).toContain(WEBM_MESSAGE);
  });

  it('Cancel stops the job without a file and returns to idle (15.5)', async () => {
    const fake = createFakeDeps();
    render(<Harness renderDeps={fake.deps} />);
    fireEvent.click(button('Download video'));
    await flush();
    act(() => fake.advanceTo(500));

    fireEvent.click(button('Cancel'));
    await flush();

    expect(fake.recorderLog).toContain('discard');
    expect(fake.pending.size).toBe(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector('progress')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(button('Download video').disabled).toBe(false);
  });

  it('shows the hidden-tab message when the tab is hidden (15.6)', async () => {
    const fake = createFakeDeps();
    render(<Harness renderDeps={fake.deps} />);
    fireEvent.click(button('Download video'));
    await flush();
    act(() => fake.hide());
    await flush();

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain(HIDDEN_MESSAGE);
    expect(button('Download video').disabled).toBe(false);
  });

  it('shows the failure message on a recorder error (15.7)', async () => {
    const fake = createFakeDeps();
    render(<Harness renderDeps={fake.deps} />);
    fireEvent.click(button('Download video'));
    await flush();
    act(() => fake.emitError(new Error('encoder died')));
    await flush();

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(FAILED_MESSAGE);
  });

  it('clears the previous notice when the next export starts', async () => {
    const fake = createFakeDeps();
    render(<Harness renderDeps={fake.deps} initialStatus={{ phase: 'idle', notice: 'failed' }} />);
    expect(screen.getByRole('alert').textContent).toContain(FAILED_MESSAGE);

    fireEvent.click(button('Download video'));
    await flush();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('progress')).not.toBeNull();

    fireEvent.click(button('Cancel'));
    await flush();
  });

  it('aborts a running job when the panel unmounts', async () => {
    const fake = createFakeDeps();
    const { unmount } = render(<Harness renderDeps={fake.deps} />);
    fireEvent.click(button('Download video'));
    await flush();
    unmount();
    await flush();
    expect(fake.recorderLog).toContain('discard');
    expect(fake.pending.size).toBe(0);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
