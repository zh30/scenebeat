import { assignTemplate } from './assignTemplate';
import { deriveData } from './deriveData';
import { computeDuration } from './duration';
import type { Scene, SceneOverride, SceneOverrides, SceneTemplate } from './types';

/** Message returned when a saved scene text is empty after normalization. */
export const EMPTY_TEXT_MESSAGE = "Scene text can't be empty.";

/** Map key for an override: identifies an Automatic_Scene by Source_Text and Occurrence_Rank. */
export function overrideKey(sourceText: string, rank: number): string {
  return JSON.stringify([rank, sourceText]);
}

/** Occurrence_Rank of each text: how many earlier entries have exactly the same text. */
export function occurrenceRanks(texts: readonly string[]): number[] {
  const seen = new Map<string, number>();
  return texts.map((t) => {
    const rank = seen.get(t) ?? 0;
    seen.set(t, rank + 1);
    return rank;
  });
}

/** Replaces every CR, LF, or CRLF with one space, then trims. */
export function normalizeEditedText(raw: string): string {
  return raw.replace(/\r\n|\r|\n/g, ' ').trim();
}

/** True when the override carries at least one edit. */
function isMeaningful(ov: SceneOverride | undefined): ov is SceneOverride {
  return ov !== undefined && (ov.editedText !== undefined || ov.manualTemplate !== undefined);
}

/** Automatic_Scene plus optional override -> edited Scene with templateSource. Never re-splits text. */
export function applyOverride(auto: Scene, override: SceneOverride | undefined): Scene {
  if (!isMeaningful(override)) {
    return {
      index: auto.index,
      text: auto.text,
      template: auto.template,
      templateSource: 'auto',
      durationMs: auto.durationMs,
      data: auto.data,
    };
  }
  const text = override.editedText ?? auto.text;
  const durationMs = override.editedText !== undefined ? computeDuration(text) : auto.durationMs;
  if (override.manualTemplate !== undefined) {
    return {
      index: auto.index,
      text,
      template: override.manualTemplate,
      templateSource: 'manual',
      durationMs,
      data: deriveData(override.manualTemplate, text),
    };
  }
  const assigned = assignTemplate(text);
  return {
    index: auto.index,
    text,
    template: assigned.template,
    templateSource: 'auto',
    durationMs,
    data: assigned.data,
  };
}

/** Applies overrides by (Source_Text, Occurrence_Rank); output keeps the length and order of `autos`. */
export function applyOverrides(autos: readonly Scene[], overrides: SceneOverrides): Scene[] {
  const ranks = occurrenceRanks(autos.map((a) => a.text));
  return autos.map((a, i) => {
    const key = overrideKey(a.text, ranks[i]);
    const ov = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : undefined;
    return applyOverride(a, ov);
  });
}

/** Keeps only overrides whose (sourceText, rank) matches some Automatic_Scene. */
export function reconcileOverrides(autos: readonly Scene[], overrides: SceneOverrides): SceneOverrides {
  const ranks = occurrenceRanks(autos.map((a) => a.text));
  const live = new Set(autos.map((a, i) => overrideKey(a.text, ranks[i])));
  const result: Record<string, SceneOverride> = {};
  for (const [key, ov] of Object.entries(overrides)) {
    if (live.has(key) && key === overrideKey(ov.sourceText, ov.rank)) result[key] = ov;
  }
  return result;
}

/** Returns a copy of `overrides` with `key` set to `ov`, or removed when `ov` carries no edit. */
function withOverride(overrides: SceneOverrides, key: string, ov: SceneOverride): SceneOverrides {
  const next: Record<string, SceneOverride> = { ...overrides };
  if (isMeaningful(ov)) next[key] = ov;
  else delete next[key];
  return next;
}

function existing(overrides: SceneOverrides, key: string): SceneOverride | undefined {
  return Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : undefined;
}

/** Records a manual template for the scene (kept even when it equals the automatic template). */
export function setManualTemplate(
  overrides: SceneOverrides,
  auto: Scene,
  rank: number,
  template: SceneTemplate,
): SceneOverrides {
  const key = overrideKey(auto.text, rank);
  const prev = existing(overrides, key);
  const ov: SceneOverride = { sourceText: auto.text, rank, manualTemplate: template };
  if (prev?.editedText !== undefined) ov.editedText = prev.editedText;
  return withOverride(overrides, key, ov);
}

export type TextEditResult =
  | { ok: true; overrides: SceneOverrides }
  | { ok: false; error: typeof EMPTY_TEXT_MESSAGE };

/**
 * Records an edited text for the scene. Empty after normalization: error, overrides unchanged.
 * Equal to the Source_Text: removes editedText (and the override when nothing remains).
 */
export function setEditedText(
  overrides: SceneOverrides,
  auto: Scene,
  rank: number,
  raw: string,
): TextEditResult {
  const normalized = normalizeEditedText(raw);
  if (normalized === '') return { ok: false, error: EMPTY_TEXT_MESSAGE };
  const key = overrideKey(auto.text, rank);
  const prev = existing(overrides, key);
  const ov: SceneOverride = { sourceText: auto.text, rank };
  if (normalized !== auto.text) ov.editedText = normalized;
  if (prev?.manualTemplate !== undefined) ov.manualTemplate = prev.manualTemplate;
  return { ok: true, overrides: withOverride(overrides, key, ov) };
}

/** Removes the override at `key`; every other entry is the same object. */
export function resetSceneOverride(overrides: SceneOverrides, key: string): SceneOverrides {
  if (!Object.prototype.hasOwnProperty.call(overrides, key)) return overrides;
  const next: Record<string, SceneOverride> = { ...overrides };
  delete next[key];
  return next;
}

/** True when an override with at least one edit exists for the scene. */
export function hasOverride(overrides: SceneOverrides, auto: Scene, rank: number): boolean {
  return isMeaningful(existing(overrides, overrideKey(auto.text, rank)));
}
