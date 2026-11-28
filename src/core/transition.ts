/** Duration of the scene-enter Motion_Transition, in ms (matches the Player CSS). */
export const ENTER_TRANSITION_MS = 450;

/** Vertical start offset of the enter transition, in logical px (the CSS `--sb-enter-offset`). */
export const ENTER_OFFSET_PX = 48;

const ENTER_START_SCALE = 0.98;

/**
 * CSS-style cubic Bézier easing with control points (x1, y1) and (x2, y2);
 * endpoints are fixed at (0, 0) and (1, 1). x1 and x2 must lie in [0, 1].
 * Solves x(s) = t for the curve parameter s by Newton iteration, falling back
 * to bisection, then returns y(s).
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  // Polynomial coefficients for B(s) = ((a s + b) s + c) s.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (s: number): number => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number): number => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number): number => (3 * ax * s + 2 * bx) * s + cx;

  const EPS = 1e-7;

  const solveS = (x: number): number => {
    // Newton iteration.
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(s) - x;
      if (Math.abs(err) < EPS) return s;
      const d = slopeX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    // Bisection fallback (x(s) is monotonic for x1, x2 in [0, 1]).
    let lo = 0;
    let hi = 1;
    s = x;
    for (let i = 0; i < 60; i++) {
      const v = sampleX(s);
      if (Math.abs(v - x) < EPS) return s;
      if (v < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };

  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveS(t));
  };
}

/** The `--sb-ease` curve from `app.css`. */
const ease = cubicBezier(0.22, 1, 0.36, 1);

export interface EnterState {
  opacity: number;
  translateY: number;
  scale: number;
}

/**
 * Enter-transition state `elapsedMs` after a scene starts. From
 * ENTER_TRANSITION_MS on it is exactly `{ opacity: 1, translateY: 0, scale: 1 }`.
 */
export function enterTransition(elapsedMs: number): EnterState {
  if (!(elapsedMs < ENTER_TRANSITION_MS)) {
    return { opacity: 1, translateY: 0, scale: 1 };
  }
  const p = Math.min(1, Math.max(0, elapsedMs / ENTER_TRANSITION_MS));
  const q = Math.min(1, Math.max(0, ease(p)));
  return {
    opacity: q,
    translateY: ENTER_OFFSET_PX * (1 - q),
    scale: ENTER_START_SCALE + (1 - ENTER_START_SCALE) * q,
  };
}
