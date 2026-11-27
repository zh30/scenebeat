import { TEMPLATES, type SceneTemplate, type Storyboard } from './types';

/** Count of scenes per Scene_Template. Every template is present, with 0 when unused. */
export function countByTemplate(storyboard: Storyboard): Record<SceneTemplate, number> {
  const counts = Object.fromEntries(TEMPLATES.map((t) => [t, 0])) as Record<SceneTemplate, number>;
  for (const scene of storyboard.scenes) {
    counts[scene.template] += 1;
  }
  return counts;
}
