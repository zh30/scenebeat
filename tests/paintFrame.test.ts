import { describe, expect, it } from 'vitest';
import { buildStoryboard } from '../src/core/buildStoryboard';
import { layoutScene, type SceneLayout } from '../src/core/sceneLayout';
import { fontString, QUOTE_MARK, THEME_COLORS } from '../src/core/sceneTheme';
import { enterTransition, type EnterState } from '../src/core/transition';
import type { Scene, SceneTemplate } from '../src/core/types';
import type { FrameContext } from '../src/video/canvasTypes';
import { fallbackMeasure } from '../src/video/measure';
import { paintFrame } from '../src/video/paintFrame';

interface FakeGradient {
  kind: 'linear' | 'radial';
  stops: Array<[number, string]>;
  addColorStop(offset: number, color: string): void;
}

interface Call {
  op: string;
  args: unknown[];
  fillStyle: string | FakeGradient;
  globalAlpha: number;
  font: string;
}

/** A FrameContext that records every method call with the drawing state at call time. */
function createRecordingContext(width: number, height: number) {
  const calls: Call[] = [];
  const state = {
    fillStyle: '#000000' as string | FakeGradient,
    globalAlpha: 1,
    font: '10px sans-serif',
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    textAlign: 'start' as CanvasTextAlign,
  };
  const record =
    (op: string) =>
    (...args: unknown[]): void => {
      calls.push({ op, args, fillStyle: state.fillStyle, globalAlpha: state.globalAlpha, font: state.font });
    };
  const gradient = (kind: FakeGradient['kind']): FakeGradient => {
    const g: FakeGradient = {
      kind,
      stops: [],
      addColorStop(offset, color) {
        g.stops.push([offset, color]);
      },
    };
    return g;
  };
  const ctx = {
    canvas: { width, height },
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v) {
      state.fillStyle = v;
    },
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(v: number) {
      state.globalAlpha = v;
    },
    get font() {
      return state.font;
    },
    set font(v: string) {
      state.font = v;
    },
    get textBaseline() {
      return state.textBaseline;
    },
    set textBaseline(v: CanvasTextBaseline) {
      state.textBaseline = v;
    },
    get textAlign() {
      return state.textAlign;
    },
    set textAlign(v: CanvasTextAlign) {
      state.textAlign = v;
    },
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    scale: record('scale'),
    setTransform: record('setTransform'),
    fillRect: record('fillRect'),
    fillText: record('fillText'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    arcTo: record('arcTo'),
    closePath: record('closePath'),
    fill: record('fill'),
    createLinearGradient: (...args: number[]) => {
      record('createLinearGradient')(...args);
      return gradient('linear');
    },
    createRadialGradient: (...args: number[]) => {
      record('createRadialGradient')(...args);
      return gradient('radial');
    },
    measureText: (text: string) => ({ width: text.length }),
  };
  return { ctx: ctx as unknown as FrameContext, calls };
}

const SENTENCES: Record<SceneTemplate, string> = {
  'big-number': 'Revenue grew 45% last quarter.',
  'keyword-highlight': 'Designers love simple tools that explain themselves clearly.',
  quote: 'She said "ship it before Halloween" with a grin.',
  timeline: 'In 2025 the team launched the product.',
};

function sceneFor(template: SceneTemplate): Scene {
  const [scene] = buildStoryboard(SENTENCES[template]).scenes;
  expect(scene.template).toBe(template);
  return scene;
}

const DONE: EnterState = { opacity: 1, translateY: 0, scale: 1 };

function paint(template: SceneTemplate, enter: EnterState = DONE) {
  const scene = sceneFor(template);
  const layout = layoutScene(scene, '16:9', fallbackMeasure);
  const { ctx, calls } = createRecordingContext(layout.width, layout.height);
  paintFrame(ctx, { scene, layout, enter });
  return { scene, layout, calls };
}

/** Expected text draws in layout order: each segment at its x and its line's baseline. */
function expectedSegments(layout: SceneLayout) {
  return layout.blocks.flatMap((block) =>
    block.lines.flatMap((line) =>
      line.segments.map((seg) => ({
        text: seg.text,
        x: seg.x,
        y: line.baseline,
        color: seg.highlight ? THEME_COLORS.keywordHighlight : block.color,
        font: fontString(block.font.sizePx, block.font.weight),
      })),
    ),
  );
}

const TEMPLATES: SceneTemplate[] = ['big-number', 'keyword-highlight', 'quote', 'timeline'];

describe('paintFrame', () => {
  it.each(TEMPLATES)('%s: fills the whole background with the stage color first', (template) => {
    const { layout, calls } = paint(template);
    const firstFill = calls.find((c) => c.op === 'fillRect' || c.op === 'fill' || c.op === 'fillText');
    expect(firstFill?.op).toBe('fillRect');
    expect(firstFill?.args).toEqual([0, 0, layout.width, layout.height]);
    expect(firstFill?.fillStyle).toBe(THEME_COLORS.stage);
    // The radial glow follows, using a gradient with color stops.
    const glowFill = calls.filter((c) => c.op === 'fillRect')[1];
    expect(typeof glowFill.fillStyle).toBe('object');
    const glow = glowFill.fillStyle as FakeGradient;
    expect(glow.kind).toBe('radial');
    expect(glow.stops[0]).toEqual([0, THEME_COLORS.stageGlow]);
  });

  it.each(TEMPLATES)('%s: draws every layout segment at layout coordinates with the block style', (template) => {
    const { layout, calls } = paint(template);
    const texts = calls
      .filter((c) => c.op === 'fillText' && c.args[0] !== QUOTE_MARK)
      .map((c) => ({ text: c.args[0], x: c.args[1], y: c.args[2], color: c.fillStyle, font: c.font }));
    const expected = expectedSegments(layout);
    expect(expected.length).toBeGreaterThan(0);
    expect(texts).toEqual(expected);
  });

  it('big-number: value drawn in the big-number accent color', () => {
    const { scene, calls } = paint('big-number');
    const value = calls.find((c) => c.op === 'fillText' && c.args[0] === (scene.data as { value: string }).value);
    expect(value?.fillStyle).toBe(THEME_COLORS.bigNumber);
  });

  it('keyword-highlight: keywords use the highlight color over a rounded background', () => {
    const { layout, calls } = paint('keyword-highlight');
    const highlighted = layout.blocks.flatMap((b) => b.lines.flatMap((l) => l.segments.filter((s) => s.highlight)));
    expect(highlighted.length).toBeGreaterThan(0);
    for (const seg of highlighted) {
      const draw = calls.find((c) => c.op === 'fillText' && c.args[0] === seg.text && c.args[1] === seg.x);
      expect(draw?.fillStyle).toBe(THEME_COLORS.keywordHighlight);
    }
    const backgrounds = calls.filter((c) => c.op === 'fill' && c.fillStyle === THEME_COLORS.keywordBackground);
    expect(backgrounds).toHaveLength(highlighted.length);
    expect(calls.some((c) => c.op === 'arcTo')).toBe(true);
    // Backgrounds are painted before any text of the block.
    const lastBg = calls.lastIndexOf(backgrounds[backgrounds.length - 1]);
    const firstText = calls.findIndex((c) => c.op === 'fillText');
    expect(lastBg).toBeLessThan(firstText);
  });

  it('quote: draws the quote mark in the quote accent color', () => {
    const { calls } = paint('quote');
    const mark = calls.find((c) => c.op === 'fillText' && c.args[0] === QUOTE_MARK);
    expect(mark).toBeDefined();
    expect(mark?.fillStyle).toBe(THEME_COLORS.quote);
  });

  it('timeline: draws a gradient track and a dot in the timeline color', () => {
    const { calls } = paint('timeline');
    const track = calls.find(
      (c) => c.op === 'fillRect' && typeof c.fillStyle === 'object' && (c.fillStyle as FakeGradient).kind === 'linear',
    );
    expect(track).toBeDefined();
    expect((track!.fillStyle as FakeGradient).stops).toContainEqual([0.5, THEME_COLORS.timeline]);
    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === THEME_COLORS.timeline)).toBe(true);
    expect(calls.some((c) => c.op === 'arc')).toBe(true);
  });

  it.each(TEMPLATES)('%s: scene drawing uses globalAlpha equal to the enter opacity', (template) => {
    for (const elapsed of [0, 100, 225, 449, 450]) {
      const enter = enterTransition(elapsed);
      const { calls } = paint(template, enter);
      const backgroundFill = calls.find((c) => c.op === 'fillRect');
      expect(backgroundFill?.globalAlpha).toBe(1);
      const texts = calls.filter((c) => c.op === 'fillText');
      expect(texts.length).toBeGreaterThan(0);
      for (const t of texts) expect(t.globalAlpha).toBe(enter.opacity);
    }
  });

  it('applies the enter transform around the stack center and restores state', () => {
    const enter: EnterState = { opacity: 0.5, translateY: 20, scale: 0.99 };
    const { layout, calls } = paint('keyword-highlight', enter);
    const cx = layout.stack.x + layout.stack.width / 2;
    const cy = layout.stack.y + layout.stack.height / 2;
    const ops = calls.map((c) => [c.op, ...c.args]);
    const i = ops.findIndex((o) => o[0] === 'translate' && o[1] === cx && o[2] === cy + 20);
    expect(i).toBeGreaterThan(-1);
    expect(ops[i + 1]).toEqual(['scale', 0.99, 0.99]);
    expect(ops[i + 2]).toEqual(['translate', -cx, -cy]);
    expect(calls.filter((c) => c.op === 'save')).toHaveLength(calls.filter((c) => c.op === 'restore').length);
  });
});
