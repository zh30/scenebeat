/**
 * Minimal structural types for the canvas APIs the video code uses.
 * A real `CanvasRenderingContext2D` satisfies `FrameContext`; tests pass a
 * recording fake instead, because jsdom has no 2D context.
 */

/** The subset of CanvasRenderingContext2D the frame painter uses. */
export interface FrameContext {
  canvas: { width: number; height: number };
  fillStyle: string | CanvasGradient;
  globalAlpha: number;
  font: string;
  textBaseline: CanvasTextBaseline;
  textAlign: CanvasTextAlign;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  closePath(): void;
  fill(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradient;
  measureText(text: string): { width: number };
}

/** A canvas the render job paints into and records from. */
export interface CaptureCanvas {
  ctx: FrameContext;
  captureStream(fps: number): MediaStream;
}
