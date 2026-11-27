import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { buildStoryboard } from '../core/buildStoryboard';
import { SAMPLE_TRANSCRIPT } from '../data/sampleTranscript';
import { usePlayback } from '../playback/usePlayback';
import { ExportButton } from './ExportButton';
import { Player } from './Player';
import { StoryboardList } from './StoryboardList';
import { TranscriptInput } from './TranscriptInput';
import '../styles/app.css';

/** Delay between the last edit and storyboard regeneration (Req 1.5). */
export const REGENERATE_DEBOUNCE_MS = 300;

/** Returns `value` once it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function SceneBeat() {
  const [text, setText] = useState(SAMPLE_TRANSCRIPT);
  const debouncedText = useDebouncedValue(text, REGENERATE_DEBOUNCE_MS);
  const storyboard = useMemo(() => buildStoryboard(debouncedText), [debouncedText]);
  const durations = useMemo(() => storyboard.scenes.map((s) => s.durationMs), [storyboard]);
  const { state, play, pause, next, prev, select } = usePlayback(durations);

  const total = storyboard.scenes.length;

  return (
    <div className="sb-app">
      <header className="sb-header">
        <div className="sb-brand">
          <span className="sb-brand__mark" aria-hidden="true" />
          <span className="sb-brand__name">SceneBeat</span>
        </div>
        <h1 className="sb-header__title">Turn a transcript into an animated storyboard.</h1>
        <p className="sb-header__tagline">
          Paste text, watch it play as motion scenes, download the result. No sign-up, nothing leaves your browser.
        </p>
      </header>

      <main className="sb-main">
        <section className="sb-card sb-card--input" aria-labelledby="sb-step-1">
          <StepTitle id="sb-step-1" step={1} title="Paste your transcript" />
          <TranscriptInput
            value={text}
            onChange={setText}
            onLoadSample={() => setText(SAMPLE_TRANSCRIPT)}
            onClear={() => setText('')}
          />
        </section>

        <div className="sb-column">
          <section className="sb-card" aria-labelledby="sb-step-2">
            <StepTitle
              id="sb-step-2"
              step={2}
              title="Watch the preview"
              aside={total > 0 ? `${total} ${total === 1 ? 'scene' : 'scenes'}` : undefined}
            />
            <Player
              storyboard={storyboard}
              index={state.index}
              playing={state.playing}
              onPlay={play}
              onPause={pause}
              onPrev={prev}
              onNext={next}
            />
          </section>

          <section className="sb-card sb-card--row" aria-labelledby="sb-step-3">
            <StepTitle id="sb-step-3" step={3} title="Download the storyboard" />
            <ExportButton storyboard={storyboard} />
          </section>
        </div>

        <section className="sb-card sb-card--wide" aria-labelledby="sb-scenes">
          <div className="sb-step">
            <h2 className="sb-step__title" id="sb-scenes">
              All scenes
            </h2>
            <span className="sb-step__aside">Click a scene to jump to it</span>
          </div>
          <StoryboardList storyboard={storyboard} currentIndex={state.index} onSelect={select} />
        </section>
      </main>

      <footer className="sb-footer">Made with Kiro for Kiroween 2026 · MIT licensed</footer>
    </div>
  );
}

function StepTitle({ id, step, title, aside }: { id: string; step: number; title: string; aside?: string }) {
  return (
    <div className="sb-step">
      <span className="sb-step__number" aria-hidden="true">
        {step}
      </span>
      <h2 className="sb-step__title" id={id}>
        <span className="sb-visually-hidden">Step {step}: </span>
        {title}
      </h2>
      {aside && <span className="sb-step__aside">{aside}</span>}
    </div>
  );
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Top-level boundary: shows a short message and a "Reload" button on render errors. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('SceneBeat crashed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="sb-error-boundary" role="alert">
          <h1>Something went wrong.</h1>
          <p>SceneBeat hit an unexpected error.</p>
          <button type="button" className="sb-button sb-button--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <AppErrorBoundary>
      <SceneBeat />
    </AppErrorBoundary>
  );
}

export default App;
