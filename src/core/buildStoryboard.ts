import { assignTemplate } from './assignTemplate';
import { computeDuration } from './duration';
import { splitSentences } from './splitSentences';
import type { Scene, Storyboard } from './types';

/** Storyboard JSON format version written by SceneBeat. */
export const STORYBOARD_VERSION = '1.0';

/**
 * Builds a Storyboard from transcript text: splits it into sentences, assigns
 * each a template and highlighted data, and computes its display duration.
 * Pure apart from the default `now`, which callers can pass for determinism.
 */
export function buildStoryboard(text: string, now: Date = new Date()): Storyboard {
  const scenes: Scene[] = splitSentences(text).map((sentence, index) => {
    const { template, data } = assignTemplate(sentence);
    return {
      index,
      text: sentence,
      template,
      durationMs: computeDuration(sentence),
      data,
    };
  });

  return {
    version: STORYBOARD_VERSION,
    createdAt: now.toISOString(),
    sceneCount: scenes.length,
    scenes,
  };
}
