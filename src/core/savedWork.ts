import { ASPECT_RATIOS, DEFAULT_ASPECT_RATIO, type AspectRatioId } from './aspectRatio';
import { overrideKey } from './overrides';
import { TEMPLATES, type SceneOverride, type SceneOverrides, type SceneTemplate } from './types';

/** Versioned `localStorage` key for Saved_Work. */
export const SAVED_WORK_KEY = 'scenebeat:work:v1';
/** Maximum serialized length the Work_Store writes, in UTF-16 code units. */
export const SAVE_LIMIT = 1_000_000;

export type ExportFormat = 'video' | 'subtitles' | 'storyboard-json';
export type SubtitleFormat = 'srt' | 'vtt';

const EXPORT_FORMATS: readonly ExportFormat[] = ['video', 'subtitles', 'storyboard-json'];
const SUBTITLE_FORMATS: readonly SubtitleFormat[] = ['srt', 'vtt'];

export interface SavedWork {
  transcript: string;
  overrides: SceneOverrides;
  aspectRatio: AspectRatioId;
  exportFormat: ExportFormat;
  subtitleFormat: SubtitleFormat;
}

export type ParseWorkResult = { ok: true; work: SavedWork } | { ok: false };

export interface WorkDefaults {
  aspectRatio: AspectRatioId;
  exportFormat: ExportFormat;
  subtitleFormat: SubtitleFormat;
}

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v);
}

/** Copy of an override with only the known fields, in the fixed key order. */
function cleanOverride(o: SceneOverride): SceneOverride {
  const out: SceneOverride = { sourceText: o.sourceText, rank: o.rank };
  if (o.editedText !== undefined) out.editedText = o.editedText;
  if (o.manualTemplate !== undefined) out.manualTemplate = o.manualTemplate;
  return out;
}

/** Saved_Work as JSON with fixed key order; overrides sorted by key (Requirements 12.1, 12.2). */
export function serializeWork(work: SavedWork): string {
  const overrides: Record<string, SceneOverride> = {};
  for (const key of Object.keys(work.overrides).sort()) {
    overrides[key] = cleanOverride(work.overrides[key]);
  }
  return JSON.stringify({
    version: 1,
    transcript: work.transcript,
    overrides,
    aspectRatio: work.aspectRatio,
    exportFormat: work.exportFormat,
    subtitleFormat: work.subtitleFormat,
  });
}

function parseOverride(key: string, e: unknown): SceneOverride | null {
  if (!isRecord(e)) return null;
  const sourceText = hasOwn(e, 'sourceText') ? e.sourceText : undefined;
  const rank = hasOwn(e, 'rank') ? e.rank : undefined;
  if (typeof sourceText !== 'string') return null;
  if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 0) return null;
  if (key !== overrideKey(sourceText, rank)) return null;

  const out: SceneOverride = { sourceText, rank };
  if (hasOwn(e, 'editedText') && e.editedText !== undefined) {
    if (typeof e.editedText !== 'string' || e.editedText === '') return null;
    out.editedText = e.editedText;
  }
  if (hasOwn(e, 'manualTemplate') && e.manualTemplate !== undefined) {
    if (!oneOf<SceneTemplate>(e.manualTemplate, TEMPLATES)) return null;
    out.manualTemplate = e.manualTemplate;
  }
  if (out.editedText === undefined && out.manualTemplate === undefined) return null;
  return out;
}

/** Stored string to Saved_Work; never throws (Requirements 12.3 to 12.10). */
export function parseWork(raw: string): ParseWorkResult {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (!isRecord(v)) return { ok: false };
  if (!hasOwn(v, 'version') || v.version !== 1) return { ok: false };
  if (!hasOwn(v, 'transcript') || typeof v.transcript !== 'string') return { ok: false };

  const overrides: Record<string, SceneOverride> = {};
  const rawOverrides = hasOwn(v, 'overrides') ? v.overrides : undefined;
  if (isRecord(rawOverrides)) {
    for (const key of Object.keys(rawOverrides).sort()) {
      const parsed = parseOverride(key, rawOverrides[key]);
      if (parsed !== null) overrides[key] = parsed;
    }
  }

  const ratioIds = ASPECT_RATIOS.map((r) => r.id);
  const aspectRatio = hasOwn(v, 'aspectRatio') && oneOf(v.aspectRatio, ratioIds) ? v.aspectRatio : DEFAULT_ASPECT_RATIO;
  const exportFormat = hasOwn(v, 'exportFormat') && oneOf(v.exportFormat, EXPORT_FORMATS) ? v.exportFormat : 'video';
  const subtitleFormat =
    hasOwn(v, 'subtitleFormat') && oneOf(v.subtitleFormat, SUBTITLE_FORMATS) ? v.subtitleFormat : 'srt';

  return {
    ok: true,
    work: { transcript: v.transcript, overrides, aspectRatio, exportFormat, subtitleFormat },
  };
}

/** Default settings; the export format rule matches the Export_Panel default. */
export function defaultWorkSettings(videoSupported: boolean): WorkDefaults {
  return {
    aspectRatio: DEFAULT_ASPECT_RATIO,
    exportFormat: videoSupported ? 'video' : 'subtitles',
    subtitleFormat: 'srt',
  };
}

/** Start-up state: restored work or the sample transcript with defaults (Requirements 13.3, 13.5, 13.6). */
export function initialWork(
  stored: string | null,
  videoSupported: boolean,
  sampleTranscript: string,
): { work: SavedWork; restored: boolean } {
  const defaults = defaultWorkSettings(videoSupported);
  const parsed = stored === null ? ({ ok: false } as const) : parseWork(stored);
  if (!parsed.ok) {
    return { work: { transcript: sampleTranscript, overrides: {}, ...defaults }, restored: false };
  }
  const work = parsed.work;
  const exportFormat = work.exportFormat === 'video' && !videoSupported ? defaults.exportFormat : work.exportFormat;
  return { work: { ...work, exportFormat }, restored: true };
}
