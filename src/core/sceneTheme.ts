import type { SceneTemplate } from './types';

/**
 * Visual theme shared by the DOM preview (SceneView) and the canvas video
 * painter, so both draw the same colors, fonts, and block sizes.
 * Colors mirror the custom properties in `src/styles/app.css`.
 */

/** Font family stack, equal to `--sb-font` in app.css. */
export const FONT_FAMILY =
  "'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";

export const THEME_COLORS = {
  /** `--sb-ink`: primary text. */
  ink: '#f4f0e8',
  /** `--sb-muted`: captions. */
  muted: '#a8a196',
  /** `--sb-accent`: pumpkin accent, used by the background glow. */
  accent: '#ff8a3d',
  /** Stage background of `.sb-player__screen`. */
  stage: '#0b0a09',
  /** Radial glow of `.sb-player__screen`. */
  stageGlow: 'rgba(255, 138, 61, 0.12)',
  /** `--sb-c-*` template colors. */
  bigNumber: '#ffb547',
  keywordHighlight: '#4fd1b5',
  quote: '#ff7a90',
  timeline: '#6cb4ff',
  /** `.sb-keyword` background. */
  keywordBackground: 'rgba(79, 209, 181, 0.18)',
  /** `.sb-timeline__dot` halo. */
  timelineHalo: 'rgba(108, 180, 255, 0.2)',
} as const;

export type ThemeColorName = keyof typeof THEME_COLORS;

/** CSS custom property in app.css that each theme color mirrors, where one exists. */
export const THEME_CSS_VARS: Partial<Record<ThemeColorName, string>> = {
  ink: '--sb-ink',
  muted: '--sb-muted',
  accent: '--sb-accent',
  bigNumber: '--sb-c-big-number',
  keywordHighlight: '--sb-c-keyword-highlight',
  quote: '--sb-c-quote',
  timeline: '--sb-c-timeline',
};

/** Accent color per template (`--sb-c-<template>`). */
export const TEMPLATE_COLORS: Readonly<Record<SceneTemplate, string>> = {
  'big-number': THEME_COLORS.bigNumber,
  'keyword-highlight': THEME_COLORS.keywordHighlight,
  quote: THEME_COLORS.quote,
  timeline: THEME_COLORS.timeline,
};

/**
 * Background glow geometry, from
 * `radial-gradient(120% 90% at 50% 110%, glow, transparent 60%)`.
 * Radii and center are fractions of the frame width/height.
 */
export const STAGE_GLOW = {
  centerX: 0.5,
  centerY: 1.1,
  radiusX: 1.2,
  radiusY: 0.9,
  /** Color stop where the glow reaches transparent. */
  fadeStop: 0.6,
} as const;

export type FontWeight = 400 | 600 | 650 | 800;
export type ThemeBlockRole = 'value' | 'keywords' | 'quote' | 'label' | 'caption';

export interface BlockTypography {
  role: ThemeBlockRole;
  /** Font size in logical px at scale 1.0. */
  sizePx: number;
  weight: FontWeight;
  /** Line height as a multiple of the font size. */
  lineHeight: number;
  color: string;
  /** Max line width as a fraction of the Safe_Area width. */
  maxWidthFactor: number;
}

/** Block gap at scale 1.0, in logical px. */
export const BLOCK_GAP_PX = 40;

/** Quote-mark decoration height above the quote block, as a multiple of its font size. */
export const QUOTE_MARK_HEIGHT_FACTOR = 0.9;
/** The quote-mark glyph drawn above the quote block. */
export const QUOTE_MARK = '“';

/** Timeline track-and-dot decoration height above the label block, at scale 1.0, in px. */
export const TIMELINE_DECORATION_PX = 28;
/** Timeline dot diameter and halo width at scale 1.0, in px. */
export const TIMELINE_DOT_PX = 14;
export const TIMELINE_HALO_PX = 6;
/** Timeline track width as a fraction of the Safe_Area width, and its thickness in px. */
export const TIMELINE_TRACK_WIDTH_FACTOR = 0.7;
export const TIMELINE_TRACK_PX = 2;

/** Keyword highlight padding (em) and corner radius (em), from `.sb-keyword`. */
export const KEYWORD_PADDING_EM = 0.15;
export const KEYWORD_RADIUS_EM = 0.2;

const caption: BlockTypography = {
  role: 'caption',
  sizePx: 44,
  weight: 400,
  lineHeight: 1.5,
  color: THEME_COLORS.muted,
  maxWidthFactor: 0.8,
};

/** Blocks of each template, top to bottom, at scale 1.0. */
export const TEMPLATE_BLOCKS: Readonly<Record<SceneTemplate, readonly BlockTypography[]>> = {
  'big-number': [
    { role: 'value', sizePx: 200, weight: 800, lineHeight: 1.0, color: THEME_COLORS.bigNumber, maxWidthFactor: 1 },
    caption,
  ],
  'keyword-highlight': [
    { role: 'keywords', sizePx: 76, weight: 650, lineHeight: 1.35, color: THEME_COLORS.ink, maxWidthFactor: 1 },
  ],
  quote: [
    { role: 'quote', sizePx: 84, weight: 600, lineHeight: 1.3, color: THEME_COLORS.ink, maxWidthFactor: 1 },
    caption,
  ],
  timeline: [
    { role: 'label', sizePx: 140, weight: 800, lineHeight: 1.05, color: THEME_COLORS.timeline, maxWidthFactor: 1 },
    caption,
  ],
};

/** Canvas/CSS font shorthand, e.g. `800 200px 'Inter', ...`. */
export function fontString(sizePx: number, weight: FontWeight): string {
  return `${weight} ${sizePx}px ${FONT_FAMILY}`;
}
