// Shared fast-check arbitraries for the scenebeat-edit-export properties
// (P25 and later). Not a test file: vitest only collects *.test.ts(x).
import fc from 'fast-check';
import { buildStoryboard } from '../../src/core/buildStoryboard';
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
