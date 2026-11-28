import { describe, expect, it } from 'vitest';
import type { Storyboard } from '../src/core/types';
import {
  buildCues,
  escapeVtt,
  formatSrt,
  formatVtt,
  parseSubtitles,
  unescapeVtt,
} from '../src/core/subtitles';

const storyboard: Storyboard = {
  version: '1.1',
  createdAt: '2026-10-31T12:00:00.000Z',
  sceneCount: 2,
  scenes: [
    {
      index: 0,
      text: 'Revenue grew 45% in 2025.',
      template: 'big-number',
      templateSource: 'manual',
      durationMs: 2750,
      data: { value: '45%' },
    },
    {
      index: 1,
      text: 'Costs fell by 3 million.',
      template: 'big-number',
      templateSource: 'auto',
      durationMs: 2250,
      data: { value: '3' },
    },
  ],
};

const EXPECTED_SRT =
  '1\n00:00:00,000 --> 00:00:02,750\nRevenue grew 45% in 2025.\n\n' +
  '2\n00:00:02,750 --> 00:00:05,000\nCosts fell by 3 million.\n\n';

const EXPECTED_VTT =
  'WEBVTT\n\n' +
  '1\n00:00:00.000 --> 00:00:02.750\nRevenue grew 45% in 2025.\n\n' +
  '2\n00:00:02.750 --> 00:00:05.000\nCosts fell by 3 million.\n\n';

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('formatSrt and formatVtt', () => {
  it('writes the exact SRT text from the design', () => {
    expect(formatSrt(buildCues(storyboard))).toBe(EXPECTED_SRT);
  });

  it('writes the exact WebVTT text from the design', () => {
    expect(formatVtt(buildCues(storyboard))).toBe(EXPECTED_VTT);
  });

  it('returns an empty string for SRT and only the header for WebVTT on an empty list', () => {
    expect(formatSrt([])).toBe('');
    expect(formatVtt([])).toBe('WEBVTT\n\n');
  });

  it('parses its own empty outputs back to an empty list', () => {
    expect(parseSubtitles('', 'srt')).toEqual({ ok: true, cues: [] });
    expect(parseSubtitles('WEBVTT\n\n', 'vtt')).toEqual({ ok: true, cues: [] });
  });

  it('parses the design texts back to the cues', () => {
    const cues = buildCues(storyboard);
    expect(parseSubtitles(EXPECTED_SRT, 'srt')).toEqual({ ok: true, cues });
    expect(parseSubtitles(EXPECTED_VTT, 'vtt')).toEqual({ ok: true, cues });
  });
});

describe('WebVTT escaping', () => {
  it('escapes &, <, and >', () => {
    expect(escapeVtt('A & B <i>x</i> -->')).toBe('A &amp; B &lt;i&gt;x&lt;/i&gt; --&gt;');
  });

  it('escapes existing entities so they survive unescaping', () => {
    expect(escapeVtt('&lt;')).toBe('&amp;lt;');
    expect(unescapeVtt(escapeVtt('&lt; &amp; &gt;'))).toBe('&lt; &amp; &gt;');
  });

  it('escapes cue text in formatVtt but not in formatSrt', () => {
    const cues = [{ number: 1, startMs: 0, endMs: 2000, text: 'a < b & c > d' }];
    expect(formatVtt(cues)).toBe(
      'WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\na &lt; b &amp; c &gt; d\n\n',
    );
    expect(formatSrt(cues)).toBe('1\n00:00:00,000 --> 00:00:02,000\na < b & c > d\n\n');
  });
});

describe('subtitle file encoding', () => {
  it('encodes as UTF-8 without a byte-order mark', async () => {
    const text = formatVtt([
      { number: 1, startMs: 0, endMs: 2000, text: '首先，收入增长了45%。🚀' },
    ]);
    const bytes = await blobBytes(new Blob([text], { type: 'text/vtt' }));
    expect([bytes[0], bytes[1], bytes[2]]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes[0]).toBe('W'.charCodeAt(0));
    expect(new TextDecoder('utf-8').decode(bytes)).toBe(text);
  });
});
