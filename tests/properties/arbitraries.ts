// Shared fast-check arbitraries for the scenebeat-edit-export properties
// (P25 and later). Not a test file: vitest only collects *.test.ts(x).
import fc from 'fast-check';
import { ASPECT_RATIOS, type AspectRatioId } from '../../src/core/aspectRatio';
import { buildStoryboard } from '../../src/core/buildStoryboard';
import type { InstallEvent } from '../../src/core/installPrompt';
import type { ExportFormat, SavedWork, SubtitleFormat } from '../../src/core/savedWork';
import { normalizeEditedText, occurrenceRanks, overrideKey } from '../../src/core/overrides';
import {
  TEMPLATES,
  type Scene,
  type SceneOverride,
  type SceneOverrides,
  type SceneTemplate,
  type Storyboard,
} from '../../src/core/types';

// ---------------------------------------------------------------------------
// Transcripts (copied from p19 and p21, not imported from those files)
// ---------------------------------------------------------------------------

// Characters that drive every template rule and the splitter (from p19).
const transcriptChar = fc.constantFrom(
  'a', 'e', 'n', 'r', 't', 'W', ' ', ' ', ' ',
  '中', '文', '我', '们', '年', '月', '日', '万', '亿', '倍',
  '0', '1', '2', '5', '9', '%', '$', '¥',
  '.', '!', '?', '。', '！', '？', '；', '…', '\n',
  '"', '“', '”', '「', '」', '『', '』',
);

// Fragments that trigger every template rule plus terminators, closers,
// whitespace, and line breaks (from p21).
const transcriptFragment = fc.constantFrom(
  'Revenue', 'grew', 'the', 'and', 'important', 'podcast', 'creator', 'I',
  '我们', '今天', '讨论', '内容创作', '视频', '的',
  '"Stay hungry"', '“be bold”', '「保持好奇」', '『未来』', '""', '「」',
  '2025', '1999', '2025年', '3月5日', '2026-10-31', '10/31', 'March 5', 'first', 'Then', 'after that',
  '首先', '然后', '接着', '最后', '之后',
  '45%', '$1,200', '¥300', '€9.99', '£5', '100元', '三万', '3倍', '十亿', '3.5', '42',
  '.', '!', '?', '?!', '。', '！', '？', '；', '……', '"', '”', '」', ')', '）',
  ' ', ' ', '  ', '\t', '\u3000', '\n', '\r\n',
);

/** Transcripts built from template-triggering fragments and characters. */
export const featureTranscript: fc.Arbitrary<string> = fc
  .array(fc.oneof(transcriptChar, transcriptFragment), { maxLength: 120 })
  .map((parts) => parts.join(''));

/** Any transcript: feature-rich text or arbitrary graphemes. */
export const transcript: fc.Arbitrary<string> = fc.oneof(
  { weight: 4, arbitrary: featureTranscript },
  { weight: 1, arbitrary: fc.string({ unit: 'grapheme', maxLength: 300 }) },
);

/** Dates whose toISOString() is a standard 4-digit-year timestamp. */
export const createdAt: fc.Arbitrary<Date> = fc.date({
  min: new Date('1970-01-01T00:00:00.000Z'),
  max: new Date('2999-12-31T23:59:59.999Z'),
  noInvalidDate: true,
});

// ---------------------------------------------------------------------------
// Edited text (raw input to the Scene_Editor)
// ---------------------------------------------------------------------------

const editedFragment = fc.constantFrom(
  'Revenue', 'grew', 'by', 'the', 'first', 'then', '2025', '45%', '$120', '3倍',
  '我们', '今天', '首先', '最后', '内容创作', '三万',
  '“Hello”', '「好」', '"quoted"',
  '.', '!', '?', '。', '！', '？', '；', '…',
  '\n', '\r\n', '\r',
  '😀', '🎬', '👨‍👩‍👧',
  '&', '<', '>', '&amp;', '&lt;', '<b>', '-->',
  ' ', ' ', '  ', '\t',
);

/**
 * Raw edited text: may contain Sentence_Terminators, line breaks, CJK, emoji,
 * and `& < >`. May also be empty or whitespace-only (normalizes to empty).
 */
export const editedText: fc.Arbitrary<string> = fc.oneof(
  { weight: 4, arbitrary: fc.array(editedFragment, { maxLength: 30 }).map((p) => p.join('')) },
  { weight: 1, arbitrary: fc.string({ unit: 'grapheme', maxLength: 80 }) },
);

/** Edited text that is non-empty after line-break replacement and trimming. */
export const nonEmptyEditedText: fc.Arbitrary<string> = editedText.filter(
  (s) => s.replace(/\r\n|\r|\n/g, ' ').trim() !== '',
);

// ---------------------------------------------------------------------------
// Display_Duration lists
// ---------------------------------------------------------------------------

/** One Display_Duration: an integer in [2000, 8000] ms. */
export const displayDuration: fc.Arbitrary<number> = fc.integer({ min: 2000, max: 8000 });

/** A list of Display_Durations (possibly empty). */
export const displayDurations = (
  opts: { minLength?: number; maxLength?: number } = {},
): fc.Arbitrary<number[]> =>
  fc.array(displayDuration, { minLength: opts.minLength ?? 0, maxLength: opts.maxLength ?? 40 });

// ---------------------------------------------------------------------------
// Measure-function family for layout properties
// ---------------------------------------------------------------------------

/**
 * Structural copy of the design's FontSpec (src/core/sceneLayout.ts does not
 * exist yet); assignable to it once it does.
 */
export interface MeasureFont {
  sizePx: number;
  weight: number;
}

export type MeasureFn = (text: string, font: MeasureFont) => number;

/**
 * Measure functions of the form `(cp, font) => factor(cp) * font.sizePx`,
 * summed over code points, with per-code-point factors in [0.3, 1.2].
 * The factor is a deterministic hash of the code point, mixed with a
 * generated seed, so each generated function is pure.
 */
export const measureFn: fc.Arbitrary<MeasureFn> = fc
  .record({
    seed: fc.integer({ min: 0, max: 0x7fffffff }),
    min: fc.double({ min: 0.3, max: 1.2, noNaN: true }),
    max: fc.double({ min: 0.3, max: 1.2, noNaN: true }),
  })
  .map(({ seed, min, max }) => {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const factor = (cp: number): number => {
      let h = (cp ^ seed) >>> 0;
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
      h = (h ^ (h >>> 16)) >>> 0;
      return lo + (hi - lo) * (h / 0xffffffff);
    };
    const fn: MeasureFn = (text, font) => {
      let w = 0;
      for (const ch of text) w += factor(ch.codePointAt(0)!) * font.sizePx;
      return w;
    };
    return fn;
  });

// ---------------------------------------------------------------------------
// Scene_Overrides
// ---------------------------------------------------------------------------

/** Any Scene_Template, including the scene's automatic one. */
export const sceneTemplate: fc.Arbitrary<SceneTemplate> = fc.constantFrom(...TEMPLATES);

/**
 * One override for `(sourceText, rank)` that satisfies the override invariants:
 * at least one field present; `editedText`, when present, is normalized,
 * non-empty, and differs from `sourceText`. Edited texts come from
 * `nonEmptyEditedText` (so they may contain terminators, CJK, emoji, `& < >`);
 * manual templates may equal the automatic template.
 */
export const sceneOverride = (sourceText: string, rank: number): fc.Arbitrary<SceneOverride> =>
  fc
    .record(
      {
        editedText: nonEmptyEditedText.map(normalizeEditedText),
        manualTemplate: sceneTemplate,
      },
      { requiredKeys: [] },
    )
    .map((fields) => {
      const ov: SceneOverride = { sourceText, rank };
      if (fields.editedText !== undefined && fields.editedText !== sourceText) {
        ov.editedText = fields.editedText;
      }
      if (fields.manualTemplate !== undefined) ov.manualTemplate = fields.manualTemplate;
      return ov;
    })
    .filter((ov) => ov.editedText !== undefined || ov.manualTemplate !== undefined);

/** `(sourceText, rank)` pairs of the given Automatic_Scenes, in scene order. */
export function liveKeyPairs(scenes: readonly Scene[]): Array<[string, number]> {
  const ranks = occurrenceRanks(scenes.map((s) => s.text));
  return scenes.map((s, i) => [s.text, ranks[i]]);
}

/**
 * `(sourceText, rank)` pairs that match no Automatic_Scene: a live text with a
 * rank past its last occurrence, or an unrelated text.
 */
const unrelatedPair = (scenes: readonly Scene[]): fc.Arbitrary<[string, number]> => {
  const live = new Set(liveKeyPairs(scenes).map(([t, r]) => overrideKey(t, r)));
  const counts = new Map<string, number>();
  for (const s of scenes) counts.set(s.text, (counts.get(s.text) ?? 0) + 1);
  const texts = [...counts.keys()];
  const options: fc.Arbitrary<[string, number]>[] = [
    fc.tuple(
      fc.oneof(featureTranscript, fc.string({ unit: 'grapheme', maxLength: 40 })),
      fc.integer({ min: 0, max: 3 }),
    ),
  ];
  if (texts.length > 0) {
    options.push(
      fc
        .tuple(fc.constantFrom(...texts), fc.integer({ min: 0, max: 3 }))
        .map(([t, extra]): [string, number] => [t, counts.get(t)! + extra]),
    );
  }
  return fc.oneof(...options).filter(([t, r]) => !live.has(overrideKey(t, r)));
};

/**
 * A Scene_Overrides map for the given Automatic_Scenes, keyed by
 * `overrideKey(sourceText, rank)`. Keys come from a subset of the scenes'
 * `(text, rank)` pairs plus up to `maxUnrelated` pairs that match no scene.
 */
export const overridesFor = (
  scenes: readonly Scene[],
  opts: { maxUnrelated?: number } = {},
): fc.Arbitrary<SceneOverrides> => {
  const pairs = liveKeyPairs(scenes);
  const livePicks = fc.subarray(pairs);
  const unrelated = fc.array(unrelatedPair(scenes), { maxLength: opts.maxUnrelated ?? 3 });
  return fc
    .tuple(livePicks, unrelated)
    .chain(([live, extra]) => {
      const all = [...live, ...extra];
      return fc.tuple(...all.map(([t, r]) => sceneOverride(t, r)));
    })
    .map((list) => {
      const result: Record<string, SceneOverride> = {};
      for (const ov of list) result[overrideKey(ov.sourceText, ov.rank)] = ov;
      return result;
    });
};

/** Fixed creation time so generated storyboards are deterministic. */
export const FIXED_CREATED_AT = new Date('2026-10-31T12:00:00.000Z');

export interface StoryboardWithOverrides {
  text: string;
  auto: Storyboard;
  overrides: SceneOverrides;
}

/** A transcript, its automatic storyboard (version 1.0), and an override set for it. */
export const storyboardWithOverrides: fc.Arbitrary<StoryboardWithOverrides> = transcript.chain(
  (text) => {
    const auto = buildStoryboard(text, FIXED_CREATED_AT);
    return overridesFor(auto.scenes).map((overrides) => ({ text, auto, overrides }));
  },
);

// ---------------------------------------------------------------------------
// scenebeat-pwa generators (P52 and later)
// ---------------------------------------------------------------------------

const URL_SAFE_SEGMENT_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_~';

/**
 * One URL-safe path segment (1 to 12 characters). Dots are excluded so a
 * segment can never be `.` or `..`, which URL resolution would collapse.
 */
const urlSafeSegment: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...URL_SAFE_SEGMENT_CHARS.split('')), { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(''));

/**
 * A Deployment_Base: `/`, `/scenebeat/`, or one to four URL-safe segments.
 * Always starts and ends with `/`.
 */
export const deploymentBaseArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant('/'),
  fc.constant('/scenebeat/'),
  fc
    .array(urlSafeSegment, { minLength: 1, maxLength: 4 })
    .map((segments) => `/${segments.join('/')}/`),
);

// ---------------------------------------------------------------------------
// Saved_Work (P52 to P58)
// ---------------------------------------------------------------------------

/** Allowed values of the three Saved_Work settings. */
export const ASPECT_RATIO_IDS: readonly AspectRatioId[] = ASPECT_RATIOS.map((r) => r.id);
export const EXPORT_FORMATS: readonly ExportFormat[] = ['video', 'subtitles', 'storyboard-json'];
export const SUBTITLE_FORMATS: readonly SubtitleFormat[] = ['srt', 'vtt'];

/**
 * Valid Saved_Work: a transcript from `transcript`, overrides from
 * `overridesFor` (keyed by `overrideKey`, each with a normalized non-empty
 * `editedText` that differs from `sourceText`, a `manualTemplate`, or both),
 * and settings from their allowed sets.
 */
export const savedWorkArb: fc.Arbitrary<SavedWork> = fc
  .tuple(
    storyboardWithOverrides,
    fc.constantFrom(...ASPECT_RATIO_IDS),
    fc.constantFrom(...EXPORT_FORMATS),
    fc.constantFrom(...SUBTITLE_FORMATS),
  )
  .map(([{ text, overrides }, aspectRatio, exportFormat, subtitleFormat]) => ({
    transcript: text,
    overrides,
    aspectRatio,
    exportFormat,
    subtitleFormat,
  }));

/** The rule of Requirement 12.7 that an invalid override entry breaks. */
export type InvalidOverrideRule =
  | 'source-text-not-string'
  | 'rank-invalid'
  | 'key-mismatch'
  | 'edited-text-invalid'
  | 'manual-template-invalid'
  | 'no-fields';

export interface InvalidOverrideEntry {
  rule: InvalidOverrideRule;
  /** Key under which the entry is stored in `overrides`. */
  key: string;
  /** JSON-serializable entry value (fields absent when `undefined`). */
  entry: unknown;
}

// Ranks of invalid entries start at 1000, far above any rank a generated
// transcript can produce, so their keys never collide with valid keys.
const invalidRank = fc.integer({ min: 1000, max: 1_000_000 });
const invalidSourceText = fc.oneof(featureTranscript, fc.string({ unit: 'grapheme', maxLength: 40 }));
const validEditedText = nonEmptyEditedText.map(normalizeEditedText);

/** One or both of a valid `editedText` and a valid `manualTemplate`. */
const validOverrideFields = fc
  .record({ editedText: validEditedText, manualTemplate: sceneTemplate }, { requiredKeys: [] })
  .filter((f) => f.editedText !== undefined || f.manualTemplate !== undefined);

const nonStringJson = fc.jsonValue().filter((v) => typeof v !== 'string');

/** JSON object with the defined fields of `fields` (undefined values omitted). */
function entryObject(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) out[k] = v;
  return out;
}

const brokenSourceText: fc.Arbitrary<InvalidOverrideEntry> = fc
  .tuple(fc.option(nonStringJson, { nil: undefined }), invalidRank, invalidSourceText, validOverrideFields)
  .map(([sourceText, rank, keyText, fields]) => ({
    rule: 'source-text-not-string' as const,
    key: overrideKey(keyText, rank),
    entry: entryObject({ sourceText, rank, ...fields }),
  }));

const badRank: fc.Arbitrary<unknown> = fc.oneof(
  fc.integer({ min: -1_000_000, max: -1 }),
  fc
    .double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
    .filter((d) => !Number.isInteger(d)),
  fc.string({ maxLength: 6 }),
  fc.constantFrom(null, true, false, [], {}, undefined),
);

const brokenRank: fc.Arbitrary<InvalidOverrideEntry> = fc
  .tuple(invalidSourceText, badRank, invalidRank, validOverrideFields)
  .map(([sourceText, rank, keyRank, fields]) => ({
    rule: 'rank-invalid' as const,
    key: overrideKey(sourceText, keyRank),
    entry: entryObject({ sourceText, rank, ...fields }),
  }));

const brokenKey: fc.Arbitrary<InvalidOverrideEntry> = fc
  .tuple(
    invalidSourceText,
    invalidRank,
    fc.oneof(
      fc.constant('rank+1' as const),
      fc.constant('__proto__'),
      fc.string({ maxLength: 20 }).filter((s) => !s.startsWith('[')),
    ),
    validOverrideFields,
  )
  .map(([sourceText, rank, keyKind, fields]) => ({
    rule: 'key-mismatch' as const,
    key: keyKind === 'rank+1' ? overrideKey(sourceText, rank + 1) : keyKind,
    entry: entryObject({ sourceText, rank, ...fields }),
  }));

const brokenEditedText: fc.Arbitrary<InvalidOverrideEntry> = fc
  .tuple(invalidSourceText, invalidRank, fc.oneof(fc.constant(''), nonStringJson), sceneTemplate)
  .map(([sourceText, rank, editedText, manualTemplate]) => ({
    rule: 'edited-text-invalid' as const,
    key: overrideKey(sourceText, rank),
    entry: { sourceText, rank, editedText, manualTemplate },
  }));

const brokenTemplate: fc.Arbitrary<InvalidOverrideEntry> = fc
  .tuple(
    invalidSourceText,
    invalidRank,
    fc.oneof(
      fc.constantFrom('', 'Quote', 'big_number', 'keyword', 'timeline ', 'auto'),
      fc.string({ maxLength: 12 }),
      nonStringJson,
    ).filter((t) => !(TEMPLATES as readonly unknown[]).includes(t)),
    fc.option(validEditedText, { nil: undefined }),
  )
  .map(([sourceText, rank, manualTemplate, editedText]) => ({
    rule: 'manual-template-invalid' as const,
    key: overrideKey(sourceText, rank),
    entry: entryObject({ sourceText, rank, editedText, manualTemplate }),
  }));

const brokenNoFields: fc.Arbitrary<InvalidOverrideEntry> = fc
  .tuple(invalidSourceText, invalidRank, fc.boolean())
  .map(([sourceText, rank, extra]) => ({
    rule: 'no-fields' as const,
    key: overrideKey(sourceText, rank),
    entry: extra ? { sourceText, rank, note: 'unknown field' } : { sourceText, rank },
  }));

/**
 * An override entry that breaks exactly one rule of Requirement 12.7, tagged
 * with that rule. Keys never equal the key of a valid `savedWorkArb` override
 * (invalid ranks start at 1000; mismatched keys are `rank + 1` keys,
 * `__proto__`, or strings not starting with `[`). Use `objectWithEntries` to
 * mix entries into an object, so a `__proto__` key becomes an own property.
 */
export const invalidOverrideEntryArb: fc.Arbitrary<InvalidOverrideEntry> = fc.oneof(
  brokenSourceText,
  brokenRank,
  brokenKey,
  brokenEditedText,
  brokenTemplate,
  brokenNoFields,
);

/**
 * Plain object with the given `[key, value]` pairs as own enumerable
 * properties (later pairs win). Uses `Object.defineProperty`, so `__proto__`
 * is stored as data and `JSON.stringify` writes it.
 */
export function objectWithEntries(pairs: Iterable<readonly [string, unknown]>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of pairs) {
    Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  }
  return out;
}

/**
 * Arbitrary JSON values outside `allowed`: near-miss strings and any JSON
 * value, never a member of `allowed`.
 */
export const outOfSetValueArb = (allowed: readonly unknown[]): fc.Arbitrary<unknown> =>
  fc
    .oneof(
      fc.constantFrom('', '16x9', '16:10', 'SRT', 'webvtt', 'Video', ' video', 'json', 'mp4'),
      fc.string({ maxLength: 12 }),
      fc.jsonValue(),
    )
    .filter((v) => !allowed.includes(v));

/** One Saved_Work change of a debounce schedule. */
export interface ScheduledChange {
  /** Delay in ms after the previous change (or the start) before this change. */
  delayMs: number;
  work: SavedWork;
}

export type ScheduleEnd = { kind: 'quiet'; ms: number } | { kind: 'hidden' };

export interface ChangeSchedule {
  changes: ScheduledChange[];
  /** After the last change: at least 500 ms of quiet time, or a hidden/pagehide event. */
  end: ScheduleEnd;
}

/** One to eight Saved_Work changes with delays from 0 to 1500 ms, then quiet time or a hidden event. */
export const changeScheduleArb: fc.Arbitrary<ChangeSchedule> = fc.record({
  changes: fc.array(
    fc.record({ delayMs: fc.integer({ min: 0, max: 1500 }), work: savedWorkArb }),
    { minLength: 1, maxLength: 8 },
  ),
  end: fc.oneof(
    fc.record({ kind: fc.constant('quiet' as const), ms: fc.integer({ min: 500, max: 2000 }) }),
    fc.constant({ kind: 'hidden' as const }),
  ),
});

// ---------------------------------------------------------------------------
// Launch parameters (P59, P60, P65)
// ---------------------------------------------------------------------------

const launchParamName = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom('action', 'title', 'text', 'url') },
  { weight: 1, arbitrary: fc.constantFrom('utm_source', 'ref', 'Action', 'TEXT', 'q', '') },
  { weight: 1, arbitrary: fc.string({ unit: 'grapheme', maxLength: 8 }) },
);

const launchParamValue = fc.oneof(
  fc.constantFrom('new', 'sample', '', 'New', ' sample', 'share'),
  fc.constantFrom('Hello world.', '2025年 we grew 3倍。', 'https://example.test/a?b=c', '  padded  '),
  fc.constantFrom('%', '%2', '%zz', '%E4', '%E4%B8', '+', 'a+b', '%20', '%25', '100%'),
  fc.string({ unit: 'grapheme', maxLength: 20 }),
);

/** How a name or value is written into the query: raw, percent-encoded, or spaces as `+`. */
const encodeAs = fc.constantFrom('raw', 'uri', 'plus');

function encodeQueryPart(s: string, how: 'raw' | 'uri' | 'plus'): string {
  if (how === 'raw') return s;
  const enc = encodeURIComponent(s);
  return how === 'plus' ? enc.replace(/%20/g, '+') : enc;
}

/**
 * Query strings mixing `action`, `title`, `text`, `url`, and random names,
 * with unicode, `+`, `%` sequences (including malformed ones), repeats, bare
 * names without `=`, and an optional leading `?`.
 */
export const launchQueryArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.boolean(),
    fc.array(
      fc.record({
        name: launchParamName,
        value: fc.option(launchParamValue, { nil: undefined }),
        nameEnc: encodeAs,
        valueEnc: encodeAs,
      }),
      { maxLength: 8 },
    ),
  )
  .map(([question, params]) => {
    const parts = params.map(({ name, value, nameEnc, valueEnc }) =>
      value === undefined
        ? encodeQueryPart(name, nameEnc)
        : `${encodeQueryPart(name, nameEnc)}=${encodeQueryPart(value, valueEnc)}`,
    );
    return (question ? '?' : '') + parts.join('&');
  });

// ---------------------------------------------------------------------------
// Install_State_Machine (P62)
// ---------------------------------------------------------------------------

export interface InstallScenario {
  initial: { standalone: boolean; iosSafari: boolean; dismissed: boolean };
  events: InstallEvent[];
}

const installEventArb: fc.Arbitrary<InstallEvent> = fc.oneof(
  fc.constant({ type: 'prompt-captured' as const }),
  fc.constant({ type: 'prompt-closed' as const }),
  fc.constant({ type: 'app-installed' as const }),
  fc.boolean().map((standalone) => ({ type: 'standalone-changed' as const, standalone })),
  fc.constant({ type: 'dismissed' as const }),
);

/** Initial platform signals plus a sequence of up to 20 Install events. */
export const installEventsArb: fc.Arbitrary<InstallScenario> = fc.record({
  initial: fc.record({ standalone: fc.boolean(), iosSafari: fc.boolean(), dismissed: fc.boolean() }),
  events: fc.array(installEventArb, { maxLength: 20 }),
});
