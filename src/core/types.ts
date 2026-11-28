/** The four motion scene layouts a sentence can be assigned. */
export type SceneTemplate = 'big-number' | 'keyword-highlight' | 'quote' | 'timeline';

/** All Scene_Template identifiers (display order, not rule precedence). */
export const TEMPLATES: readonly SceneTemplate[] = [
  'big-number',
  'keyword-highlight',
  'quote',
  'timeline',
] as const;

/** Template-specific highlighted data. */
export interface BigNumberData {
  /** First matched numeric text in the sentence. */
  value: string;
}

export interface KeywordHighlightData {
  /** One to three keywords taken from the sentence. */
  keywords: string[];
}

export interface QuoteData {
  /** Text inside the quotation delimiters, trimmed. */
  quote: string;
}

export interface TimelineData {
  /** Matched year, date, or sequence marker. */
  label: string;
}

export type SceneData = BigNumberData | KeywordHighlightData | QuoteData | TimelineData;

/** Maps each template to the shape of its `data` object. */
export interface SceneDataByTemplate {
  'big-number': BigNumberData;
  'keyword-highlight': KeywordHighlightData;
  quote: QuoteData;
  timeline: TimelineData;
}

/** Whether a scene's template was chosen automatically or by the user. */
export type TemplateSource = 'auto' | 'manual';

export interface Scene {
  /** Zero-based position in the storyboard. */
  index: number;
  /** Non-empty, trimmed sentence text. */
  text: string;
  template: SceneTemplate;
  /** Present on version "1.1" scenes; absent on version "1.0" scenes. */
  templateSource?: TemplateSource;
  /** Display duration in milliseconds, within [2000, 8000]. */
  durationMs: number;
  data: SceneData;
}

/** A user edit attached to an Automatic_Scene by its Source_Text and Occurrence_Rank. */
export interface SceneOverride {
  /** Source_Text of the Automatic_Scene the override was created on. */
  sourceText: string;
  /** Occurrence_Rank of that Automatic_Scene. */
  rank: number;
  /** Normalized, non-empty, and different from sourceText when present. */
  editedText?: string;
  manualTemplate?: SceneTemplate;
}

/** Key: overrideKey(sourceText, rank). Values never have both optional fields missing. */
export type SceneOverrides = Readonly<Record<string, SceneOverride>>;

export interface Storyboard {
  /** Storyboard JSON format version, e.g. "1.0". */
  version: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** Equals `scenes.length`. */
  sceneCount: number;
  scenes: Scene[];
}

/** A single validation problem, located by JSON path (e.g. `$.scenes[2].durationMs`). */
export interface ValidationError {
  path: string;
  message: string;
}
