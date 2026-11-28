/**
 * Frame clock for the video renderer.
 *
 * The renderer paces painting through this interface, so tests drive it with
 * a manual clock. `createRafClock` takes the timing functions explicitly;
 * `rafClock` reads `performance.now` and `requestAnimationFrame` from the
 * global scope lazily, at call time, so importing it is safe in jsdom.
 */

export interface FrameClock {
  now(): number;
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

export interface RafApi {
  now(): number;
  requestAnimationFrame(cb: (now: number) => void): number;
  cancelAnimationFrame(id: number): void;
}

/** Builds a `FrameClock` from explicit timing functions. */
export function createRafClock(api: RafApi): FrameClock {
  return {
    now: () => api.now(),
    request: (cb) => api.requestAnimationFrame(cb),
    cancel: (id) => api.cancelAnimationFrame(id),
  };
}

/** Browser clock: `performance.now` plus `requestAnimationFrame`. */
export const rafClock: FrameClock = createRafClock({
  now: () => globalThis.performance.now(),
  requestAnimationFrame: (cb) => globalThis.requestAnimationFrame(cb),
  cancelAnimationFrame: (id) => globalThis.cancelAnimationFrame(id),
});
