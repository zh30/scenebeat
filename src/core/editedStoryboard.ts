import { applyOverrides } from './overrides';
import type { SceneOverrides, Storyboard } from './types';

/** Storyboard JSON format version for storyboards that carry templateSource. */
export const EDITED_STORYBOARD_VERSION = '1.1';

/**
 * Applies Scene_Overrides to the automatic storyboard's scenes and returns a
 * version "1.1" storyboard: createdAt is kept, sceneCount equals scenes.length,
 * and every scene has templateSource. Never mutates its inputs.
 */
export function buildEditedStoryboard(auto: Storyboard, overrides: SceneOverrides): Storyboard {
  const scenes = applyOverrides(auto.scenes, overrides);
  return {
    version: EDITED_STORYBOARD_VERSION,
    createdAt: auto.createdAt,
    sceneCount: scenes.length,
    scenes,
  };
}
