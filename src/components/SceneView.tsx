import type { CSSProperties, ReactNode } from 'react';
import type {
  BigNumberData,
  KeywordHighlightData,
  QuoteData,
  Scene,
  TimelineData,
} from '../core/types';

/** Scene-change transition duration (Req 5.10: 300 to 600 ms). */
export const TRANSITION_MS = 450;
/** Reduced-motion transition duration (Req 5.11: 200 ms or less, opacity only). */
export const REDUCED_MOTION_TRANSITION_MS = 150;

export interface SceneViewProps {
  scene: Scene;
  /** Transition duration in ms. Defaults to TRANSITION_MS, or REDUCED_MOTION_TRANSITION_MS when reducedMotion is set. */
  transitionMs?: number;
  /** When true, the enter transition animates opacity only. */
  reducedMotion?: boolean;
}

/** Wraps every occurrence of the given keywords in <mark>. */
function highlightKeywords(text: string, keywords: string[]): ReactNode[] {
  const terms = keywords.filter((k) => k.length > 0);
  if (terms.length === 0) return [text];
  const escaped = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gu');
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="sb-keyword">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function renderLayout(scene: Scene): ReactNode {
  switch (scene.template) {
    case 'big-number': {
      const { value } = scene.data as BigNumberData;
      return (
        <>
          <div className="sb-big-number__value">{value}</div>
          <p className="sb-scene__caption">{scene.text}</p>
        </>
      );
    }
    case 'keyword-highlight': {
      const { keywords } = scene.data as KeywordHighlightData;
      return (
        <>
          <p className="sb-keyword-highlight__text">{highlightKeywords(scene.text, keywords ?? [])}</p>
        </>
      );
    }
    case 'quote': {
      const { quote } = scene.data as QuoteData;
      return (
        <>
          <blockquote className="sb-quote__text">{quote}</blockquote>
          <p className="sb-scene__caption">{scene.text}</p>
        </>
      );
    }
    case 'timeline': {
      const { label } = scene.data as TimelineData;
      return (
        <>
          <div className="sb-timeline__track" aria-hidden="true">
            <span className="sb-timeline__dot" />
          </div>
          <div className="sb-timeline__label">{label}</div>
          <p className="sb-scene__caption">{scene.text}</p>
        </>
      );
    }
  }
}

/**
 * Renders one Scene with the layout of its template (Req 5.1).
 * The inner element is keyed by scene index, so each scene change remounts it
 * and replays the enter transition (transform + opacity, or opacity only).
 */
export function SceneView({ scene, transitionMs, reducedMotion = false }: SceneViewProps) {
  const ms = transitionMs ?? (reducedMotion ? REDUCED_MOTION_TRANSITION_MS : TRANSITION_MS);
  const style = {
    '--sb-transition-ms': `${ms}ms`,
    animationDuration: `${ms}ms`,
  } as CSSProperties;
  const className = [
    'sb-scene',
    `sb-scene--${scene.template}`,
    reducedMotion ? 'sb-scene--reduced-motion' : 'sb-scene--motion',
  ].join(' ');

  return (
    <div className="sb-stage">
      <div
        key={scene.index}
        className={className}
        style={style}
        data-template={scene.template}
        data-transition-ms={ms}
        data-testid="scene-view"
      >
        {renderLayout(scene)}
      </div>
    </div>
  );
}

export default SceneView;
