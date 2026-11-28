import type { CSSProperties, ReactNode } from 'react';
import type { BlockRole, LayoutBlock, LayoutLine, SceneLayout } from '../core/sceneLayout';
import { BLOCK_GAP_PX, QUOTE_MARK } from '../core/sceneTheme';
import type { Scene } from '../core/types';

/** Scene-change transition duration (Req 5.10: 300 to 600 ms). */
export const TRANSITION_MS = 450;
/** Reduced-motion transition duration (Req 5.11: 200 ms or less, opacity only). */
export const REDUCED_MOTION_TRANSITION_MS = 150;

export interface SceneViewProps {
  scene: Scene;
  /** Canvas_Layout of the scene; positions and line breaks are in logical frame px. */
  layout: SceneLayout;
  /** Transition duration in ms. Defaults to TRANSITION_MS, or REDUCED_MOTION_TRANSITION_MS when reducedMotion is set. */
  transitionMs?: number;
  /** When true, the enter transition animates opacity only. */
  reducedMotion?: boolean;
}

/** MVP class name of each block's text element, kept so existing selectors still match. */
const BLOCK_CLASS: Record<BlockRole, string> = {
  value: 'sb-big-number__value',
  keywords: 'sb-keyword-highlight__text',
  quote: 'sb-quote__text',
  label: 'sb-timeline__label',
  caption: 'sb-scene__caption',
};

/** One line: its segments (keyword highlights as <mark>) plus any trailing spaces of the cut. */
function renderLine(line: LayoutLine): ReactNode[] {
  const shown = line.text.trimEnd();
  const trailing = line.text.slice(shown.length);
  const nodes: ReactNode[] = line.segments.map((seg, i) =>
    seg.highlight ? (
      <mark key={i} className="sb-keyword">
        {seg.text}
      </mark>
    ) : (
      seg.text
    ),
  );
  if (trailing !== '') nodes.push(trailing);
  return nodes;
}

/** Lines separated by <br>, so the block's textContent equals its text when not truncated. */
function renderLines(lines: readonly LayoutLine[]): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`br-${i}`} />);
    out.push(<span key={`l-${i}`}>{renderLine(line)}</span>);
  });
  return out;
}

function renderDecoration(template: Scene['template'], block: LayoutBlock): ReactNode {
  if (block.decorationHeight <= 0) return null;
  const style: CSSProperties = { height: `${block.decorationHeight}px` };
  if (template === 'quote' && block.role === 'quote') {
    return (
      <div
        className="sb-quote__mark"
        aria-hidden="true"
        style={{ ...style, fontSize: `${block.font.sizePx}px`, lineHeight: `${block.decorationHeight}px` }}
      >
        {QUOTE_MARK}
      </div>
    );
  }
  if (template === 'timeline' && block.role === 'label') {
    return (
      <div className="sb-timeline__track" aria-hidden="true" style={style}>
        <span className="sb-timeline__dot" />
      </div>
    );
  }
  return null;
}

function renderBlock(template: Scene['template'], block: LayoutBlock, i: number): ReactNode {
  const textStyle: CSSProperties = {
    margin: 0,
    width: `${block.maxWidth}px`,
    maxWidth: 'none',
    fontSize: `${block.font.sizePx}px`,
    fontWeight: block.font.weight,
    lineHeight: `${block.lineHeightPx}px`,
    color: block.color,
    whiteSpace: 'nowrap',
  };
  const className = BLOCK_CLASS[block.role];
  const lines = renderLines(block.lines);
  const text =
    block.role === 'quote' ? (
      <blockquote className={className} style={textStyle}>
        {lines}
      </blockquote>
    ) : block.role === 'caption' || block.role === 'keywords' ? (
      <p className={className} style={textStyle}>
        {lines}
      </p>
    ) : (
      <div className={className} style={textStyle}>
        {lines}
      </div>
    );
  return (
    <div key={i} className={`sb-scene__block sb-scene__block--${block.role}`} data-role={block.role}>
      {renderDecoration(template, block)}
      {text}
    </div>
  );
}

/**
 * Renders one Scene from its Canvas_Layout (Req 5.1, 8.6). Coordinates are in
 * logical frame px; the Player scales the stage to fit the screen.
 * The inner element is keyed by scene index, so each scene change remounts it
 * and replays the enter transition (transform + opacity, or opacity only).
 */
export function SceneView({ scene, layout, transitionMs, reducedMotion = false }: SceneViewProps) {
  const ms = transitionMs ?? (reducedMotion ? REDUCED_MOTION_TRANSITION_MS : TRANSITION_MS);
  const gapPx = BLOCK_GAP_PX * layout.scale;
  const style = {
    '--sb-transition-ms': `${ms}ms`,
    animationDuration: `${ms}ms`,
    position: 'absolute',
    left: `${layout.stack.x}px`,
    top: `${layout.stack.y}px`,
    width: `${layout.stack.width}px`,
    height: `${layout.stack.height}px`,
    maxWidth: 'none',
    gap: `${gapPx}px`,
    justifyContent: 'flex-start',
  } as CSSProperties;
  const className = [
    'sb-scene',
    `sb-scene--${scene.template}`,
    reducedMotion ? 'sb-scene--reduced-motion' : 'sb-scene--motion',
  ].join(' ');

  return (
    <div
      key={scene.index}
      className={className}
      style={style}
      data-template={scene.template}
      data-transition-ms={ms}
      data-scale={layout.scale}
      data-truncated={layout.truncated ? 'true' : undefined}
      data-testid="scene-view"
    >
      {layout.blocks.map((block, i) => renderBlock(scene.template, block, i))}
    </div>
  );
}

export default SceneView;
