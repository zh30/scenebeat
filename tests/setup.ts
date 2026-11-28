// Vitest setup (jsdom). jsdom has no 2D canvas context and logs
// "not implemented" when getContext is called. Return null instead, so the app
// falls back to fallbackMeasure and reports video export as unsupported unless
// a test installs its own fakes.
HTMLCanvasElement.prototype.getContext = function getContext() {
  return null;
} as typeof HTMLCanvasElement.prototype.getContext;
