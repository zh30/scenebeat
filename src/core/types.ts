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

export interface Scene {
  /** Zero-based position in the storyboard. */
  index: number;
  /** Non-empty, trimmed sentence text. */
  text: string;
  template: SceneTemplate;
  /** Display duration in milliseconds, within [2000, 8000]. */
  durationMs: number;
  data: SceneData;
}

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
