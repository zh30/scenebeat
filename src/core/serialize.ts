import type { Scene, SceneData, Storyboard } from './types';

export type ParseResult = { ok: true; value: Storyboard } | { ok: false; error: string };

/** Known `data` keys, emitted first in this order; any other keys follow in insertion order. */
const DATA_KEY_ORDER = ['value', 'keywords', 'quote', 'label'] as const;

function orderData(data: SceneData): Record<string, unknown> {
  const source = data as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of DATA_KEY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const v = source[key];
      out[key] = Array.isArray(v) ? [...v] : v;
    }
  }
  for (const key of Object.keys(source)) {
    if (!(key in out)) out[key] = source[key];
  }
  return out;
}

function orderScene(scene: Scene): Record<string, unknown> {
  return {
    index: scene.index,
    text: scene.text,
    template: scene.template,
    durationMs: scene.durationMs,
    data: orderData(scene.data),
  };
}

/**
 * Serializes a storyboard to JSON text with a fixed key order
 * (`version`, `createdAt`, `sceneCount`, `scenes`; per scene `index`, `text`,
 * `template`, `durationMs`, `data`) and two-space indentation.
 */
export function serializeStoryboard(sb: Storyboard): string {
  const ordered = {
    version: sb.version,
    createdAt: sb.createdAt,
    sceneCount: sb.sceneCount,
    scenes: sb.scenes.map(orderScene),
  };
  return JSON.stringify(ordered, null, 2);
}

/**
 * Parses storyboard JSON text. Never throws: malformed JSON or a non-object
 * root yields `{ ok: false, error }`. Structural checks beyond the root are the
 * job of `validateStoryboard`.
 */
export function parseStoryboard(json: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    const detail = e instanceof Error && e.message ? e.message : String(e);
    return { ok: false, error: `Malformed JSON: ${detail || 'unknown parse error'}` };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Storyboard JSON root must be an object' };
  }
  return { ok: true, value: parsed as Storyboard };
}
