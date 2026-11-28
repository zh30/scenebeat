/**
 * Paints one video frame of a scene onto a 2D context. All geometry comes from
 * `layoutScene` (the same layout the DOM preview renders) and all colors and
 * sizes from `sceneTheme`, so the frame matches SceneView and app.css.
 *
 * Works against the `FrameContext` subset only, so tests can pass a recording fake.
 */
import type { LayoutBlock, LayoutLine, SceneLayout } from '../core/sceneLayout';
import {
  fontString,
  KEYWORD_PADDING_EM,
  KEYWORD_RADIUS_EM,
  QUOTE_MARK,
  STAGE_GLOW,
  THEME_COLORS,
  TIMELINE_DOT_PX,
  TIMELINE_HALO_PX,
  TIMELINE_TRACK_PX,
  TIMELINE_TRACK_WIDTH_FACTOR,
} from '../core/sceneTheme';
import type { EnterState } from '../core/transition';
import type { Scene } from '../core/types';
import type { FrameContext } from './canvasTypes';

export interface FrameInput {
  scene: Scene;
  layout: SceneLayout;
  enter: EnterState;
}

/** Fully transparent versions of the gradient colors (canvas interpolates unpremultiplied). */
const GLOW_TRANSPARENT = 'rgba(255, 138, 61, 0)';
const TIMELINE_TRANSPARENT = 'rgba(108, 180, 255, 0)';

/** Quote mark: `font-size: 2.4em; line-height: 1` in `.sb-quote__text::before`. */
const QUOTE_MARK_SIZE_EM = 2.4;
const QUOTE_MARK_WEIGHT = 600;
/** Baseline within a line box, as in sceneLayout. */
const BASELINE_FACTOR = 0.8;

/** Keyword background box relative to the baseline, in em (approximates the inline content area). */
const KEYWORD_BOX_ASCENT_EM = 0.95;
const KEYWORD_BOX_HEIGHT_EM = 1.2;

/** Paints the stage background, then the scene with the enter-transition state applied. */
export function paintFrame(ctx: FrameContext, input: FrameInput): void {
  const { scene, layout, enter } = input;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  paintBackground(ctx, layout.width, layout.height);

  ctx.save();
  // Same as CSS `translateY(ty) scale(s)` with the origin at the stack center:
  // p -> c + (0, ty) + s * (p - c).
  const cx = layout.stack.x + layout.stack.width / 2;
  const cy = layout.stack.y + layout.stack.height / 2;
  ctx.translate(cx, cy + enter.translateY);
  ctx.scale(enter.scale, enter.scale);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = enter.opacity;
  ctx.textBaseline = 'alphabetic';

  for (const block of layout.blocks) {
    if (scene.template === 'quote' && block.role === 'quote') paintQuoteMark(ctx, block, layout);
    if (scene.template === 'timeline' && block.role === 'label') paintTimelineTrack(ctx, block, layout);
    paintBlockText(ctx, block);
  }

  ctx.restore();
}

/** `#0b0a09` plus `radial-gradient(120% 90% at 50% 110%, glow, transparent 60%)`. */
function paintBackground(ctx: FrameContext, width: number, height: number): void {
  ctx.fillStyle = THEME_COLORS.stage;
  ctx.fillRect(0, 0, width, height);

  // Elliptical gradient: a unit-radius circular gradient under a non-uniform scale.
  const cx = width * STAGE_GLOW.centerX;
  const cy = height * STAGE_GLOW.centerY;
  const rx = width * STAGE_GLOW.radiusX;
  const ry = height * STAGE_GLOW.radiusY;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  glow.addColorStop(0, THEME_COLORS.stageGlow);
  glow.addColorStop(STAGE_GLOW.fadeStop, GLOW_TRANSPARENT);
  glow.addColorStop(1, GLOW_TRANSPARENT);
  ctx.fillStyle = glow;
  ctx.fillRect(-cx / rx, -cy / ry, width / rx, height / ry);
  ctx.restore();
}

/** The `“` glyph above the quote text, centered in the block's decoration area. */
function paintQuoteMark(ctx: FrameContext, block: LayoutBlock, layout: SceneLayout): void {
  if (block.decorationHeight <= 0) return;
  const markSize = Math.round(block.font.sizePx * QUOTE_MARK_SIZE_EM);
  ctx.font = fontString(markSize, QUOTE_MARK_WEIGHT);
  ctx.fillStyle = THEME_COLORS.quote;
  ctx.textAlign = 'center';
  ctx.fillText(QUOTE_MARK, layout.safe.x + layout.safe.width / 2, block.rect.y + markSize * BASELINE_FACTOR);
}

/** Gradient track with a dot and halo, centered in the label block's decoration area. */
function paintTimelineTrack(ctx: FrameContext, block: LayoutBlock, layout: SceneLayout): void {
  if (block.decorationHeight <= 0) return;
  const s = layout.scale;
  const centerX = layout.safe.x + layout.safe.width / 2;
  const centerY = block.rect.y + block.decorationHeight / 2;
  const trackWidth = layout.safe.width * TIMELINE_TRACK_WIDTH_FACTOR;
  const trackHeight = Math.max(1, TIMELINE_TRACK_PX * s);
  const x0 = centerX - trackWidth / 2;

  const track = ctx.createLinearGradient(x0, 0, x0 + trackWidth, 0);
  track.addColorStop(0, TIMELINE_TRANSPARENT);
  track.addColorStop(0.5, THEME_COLORS.timeline);
  track.addColorStop(1, TIMELINE_TRANSPARENT);
  ctx.fillStyle = track;
  ctx.fillRect(x0, centerY - trackHeight / 2, trackWidth, trackHeight);

  const dotRadius = (TIMELINE_DOT_PX * s) / 2;
  fillCircle(ctx, centerX, centerY, dotRadius + TIMELINE_HALO_PX * s, THEME_COLORS.timelineHalo);
  fillCircle(ctx, centerX, centerY, dotRadius, THEME_COLORS.timeline);
}

function fillCircle(ctx: FrameContext, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

/** Keyword backgrounds first, then every segment at its layout position. */
function paintBlockText(ctx: FrameContext, block: LayoutBlock): void {
  ctx.textAlign = 'left';
  for (const line of block.lines) paintHighlights(ctx, block, line);
  ctx.font = fontString(block.font.sizePx, block.font.weight);
  for (const line of block.lines) {
    for (const seg of line.segments) {
      ctx.fillStyle = seg.highlight ? THEME_COLORS.keywordHighlight : block.color;
      ctx.fillText(seg.text, seg.x, line.baseline);
    }
  }
}

function paintHighlights(ctx: FrameContext, block: LayoutBlock, line: LayoutLine): void {
  const size = block.font.sizePx;
  const pad = KEYWORD_PADDING_EM * size;
  const radius = KEYWORD_RADIUS_EM * size;
  const top = line.baseline - KEYWORD_BOX_ASCENT_EM * size;
  const height = KEYWORD_BOX_HEIGHT_EM * size;
  for (const seg of line.segments) {
    if (!seg.highlight) continue;
    ctx.fillStyle = THEME_COLORS.keywordBackground;
    fillRoundedRect(ctx, seg.x - pad, top, seg.width + 2 * pad, height, radius);
  }
}

function fillRoundedRect(
  ctx: FrameContext,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
