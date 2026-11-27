import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportButton } from '../src/components/ExportButton';
import { buildStoryboard } from '../src/core/buildStoryboard';
import { serializeStoryboard } from '../src/core/serialize';
import type { ValidationError } from '../src/core/types';

const storyboard = buildStoryboard(
  'Revenue grew 45% last year. She said "ship it today." 首先，我们打开编辑器。',
  new Date('2026-10-31T12:00:00.000Z'),
);
const emptyStoryboard = buildStoryboard('', new Date('2026-10-31T12:00:00.000Z'));
// Local time, so the filename is independent of the machine's time zone.
const fixedNow = () => new Date(2026, 9, 31, 13, 5, 9);

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

function exportButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Download storyboard' }) as HTMLButtonElement;
}

describe('ExportButton', () => {
  it('validates the serialized storyboard before downloading (9.1)', () => {
    const validate = vi.fn((_value: unknown): ValidationError[] => []);
    render(<ExportButton storyboard={storyboard} validate={validate} now={fixedNow} />);

    fireEvent.click(exportButton());

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.calls[0][0]).toEqual(JSON.parse(serializeStoryboard(storyboard)));
    expect(validate.mock.invocationCallOrder[0]).toBeLessThan(
      createObjectURL.mock.invocationCallOrder[0],
    );
  });

  it('downloads an application/json Blob with the timestamped filename (9.2)', async () => {
    render(<ExportButton storyboard={storyboard} now={fixedNow} />);

    fireEvent.click(exportButton());

    expect(createdBlobs).toHaveLength(1);
    const blob = createdBlobs[0];
    expect(blob.type).toBe('application/json');
    if (typeof blob.text === 'function') {
      expect(await blob.text()).toBe(serializeStoryboard(storyboard));
    }

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickedAnchors).toEqual([
      {
        href: 'blob:scenebeat-test',
        download: 'scenebeat-storyboard-20261031-130509.json',
        connected: true,
      },
    ]);
    // The temporary anchor is removed and the object URL released.
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:scenebeat-test');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cancels the download and lists errors when validation fails (9.3)', () => {
    const errors: ValidationError[] = [
      { path: '$.sceneCount', message: 'sceneCount 4 does not match scenes length 3' },
      { path: '$.scenes[1].template', message: 'invalid template "slideshow"' },
    ];
    render(<ExportButton storyboard={storyboard} validate={() => errors} now={fixedNow} />);

    fireEvent.click(exportButton());

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();

    const alert = screen.getByRole('alert');
    const list = alert.querySelector('ul.sb-export__errors');
    expect(list).not.toBeNull();
    const items = list!.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe(
      '$.sceneCount: sceneCount 4 does not match scenes length 3',
    );
    expect(items[1].textContent).toBe('$.scenes[1].template: invalid template "slideshow"');
  });

  it('clears previous errors after a later successful export', () => {
    let errors: ValidationError[] = [{ path: '$', message: 'broken' }];
    render(<ExportButton storyboard={storyboard} validate={() => errors} now={fixedNow} />);

    fireEvent.click(exportButton());
    expect(screen.getByRole('alert')).toBeTruthy();

    errors = [];
    fireEvent.click(exportButton());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('is disabled when the storyboard has zero scenes (9.4)', () => {
    render(<ExportButton storyboard={emptyStoryboard} now={fixedNow} />);

    const button = exportButton();
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('is enabled when the storyboard has scenes', () => {
    render(<ExportButton storyboard={storyboard} now={fixedNow} />);
    expect(exportButton().disabled).toBe(false);
  });

  it('makes no network requests during export (9.5)', () => {
    render(<ExportButton storyboard={storyboard} now={fixedNow} />);

    fireEvent.click(exportButton());

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(xhrSend).not.toHaveBeenCalled();
  });
});
