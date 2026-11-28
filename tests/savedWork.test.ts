import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ExportFormat as PanelExportFormat, SubtitleFormat as PanelSubtitleFormat } from '../src/components/ExportPanel';
import { overrideKey } from '../src/core/overrides';
import {
  defaultWorkSettings,
  parseWork,
  serializeWork,
  type ExportFormat,
  type SubtitleFormat,
} from '../src/core/savedWork';

// The stored record example from design.md ("Stored Saved_Work"), with the key filled in.
const EXAMPLE =
  '{"version":1,"transcript":"First line. 2025年 we grew 3倍.",' +
  '"overrides":{"[0,\\"First line.\\"]":{"sourceText":"First line.","rank":0,"editedText":"First line!","manualTemplate":"quote"}},' +
  '"aspectRatio":"16:9","exportFormat":"video","subtitleFormat":"srt"}';

describe('savedWork', () => {
  it('parses the design example and re-serializes it byte for byte', () => {
    const result = parseWork(EXAMPLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.work).toEqual({
      transcript: 'First line. 2025年 we grew 3倍.',
      overrides: {
        [overrideKey('First line.', 0)]: {
          sourceText: 'First line.',
          rank: 0,
          editedText: 'First line!',
          manualTemplate: 'quote',
        },
      },
      aspectRatio: '16:9',
      exportFormat: 'video',
      subtitleFormat: 'srt',
    });
    expect(serializeWork(result.work)).toBe(EXAMPLE);
  });

  it('defaultWorkSettings picks video only when video is supported', () => {
    expect(defaultWorkSettings(true)).toEqual({ aspectRatio: '16:9', exportFormat: 'video', subtitleFormat: 'srt' });
    expect(defaultWorkSettings(false)).toEqual({ aspectRatio: '16:9', exportFormat: 'subtitles', subtitleFormat: 'srt' });
  });

  it('drops an override with key __proto__ and keeps valid entries', () => {
    const valid = { sourceText: 'Hi.', rank: 0, manualTemplate: 'quote' };
    const raw =
      '{"version":1,"transcript":"Hi.","overrides":{' +
      '"__proto__":{"sourceText":"Hi.","rank":0,"editedText":"Hey."},' +
      `${JSON.stringify(overrideKey('Hi.', 0))}:${JSON.stringify(valid)}` +
      '},"aspectRatio":"1:1","exportFormat":"subtitles","subtitleFormat":"vtt"}';
    const result = parseWork(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.work.overrides)).toEqual([overrideKey('Hi.', 0)]);
    expect(result.work.overrides[overrideKey('Hi.', 0)]).toEqual(valid);
    expect(Object.prototype.hasOwnProperty.call(result.work.overrides, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(result.work.overrides)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).sourceText).toBeUndefined();
  });

  it('ExportFormat and SubtitleFormat are still importable from ExportPanel', async () => {
    expectTypeOf<PanelExportFormat>().toEqualTypeOf<ExportFormat>();
    expectTypeOf<PanelSubtitleFormat>().toEqualTypeOf<SubtitleFormat>();
    const panel = await import('../src/components/ExportPanel');
    expect(panel).toBeDefined();
  });
});
