/** The four output shapes for the Player preview and the exported video. */
export type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5';

/** File-name form of an Aspect_Ratio. */
export type RatioTag = '16x9' | '9x16' | '1x1' | '4x5';

export interface AspectRatioSpec {
  id: AspectRatioId;
  tag: RatioTag;
  /** Frame width in px. */
  width: number;
  /** Frame height in px. */
  height: number;
  label: string;
  hint: string;
}

/** In the order the Aspect_Ratio_Selector shows them (Requirement 8.1). */
export const ASPECT_RATIOS: readonly AspectRatioSpec[] = Object.freeze([
  Object.freeze({ id: '16:9', tag: '16x9', width: 1920, height: 1080, label: '16:9', hint: 'Landscape · YouTube' }),
  Object.freeze({ id: '9:16', tag: '9x16', width: 1080, height: 1920, label: '9:16', hint: 'Portrait · TikTok, Reels, Shorts, 抖音' }),
  Object.freeze({ id: '1:1', tag: '1x1', width: 1080, height: 1080, label: '1:1', hint: 'Square' }),
  Object.freeze({ id: '4:5', tag: '4x5', width: 1080, height: 1350, label: '4:5', hint: 'Portrait post · Instagram' }),
] as const satisfies readonly AspectRatioSpec[]);

export const DEFAULT_ASPECT_RATIO: AspectRatioId = '16:9';

/** Spec for an Aspect_Ratio id. */
export function getAspectRatio(id: AspectRatioId): AspectRatioSpec {
  const spec = ASPECT_RATIOS.find((r) => r.id === id);
  if (spec === undefined) {
    // Unreachable for well-typed callers.
    throw new Error(`Unknown aspect ratio "${String(id)}"`);
  }
  return spec;
}
