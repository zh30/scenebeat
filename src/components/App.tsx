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

  return (
    <div className="sb-app">
      <header className="sb-header">
        <h1 className="sb-header__title">
          Scene<span>Beat</span>
        </h1>
        <p className="sb-header__tagline">Turn a transcript into a motion storyboard.</p>
      </header>
      <main className="sb-main">
        <section className="sb-panel" aria-labelledby="sb-input-title">
          <h2 className="sb-panel__title" id="sb-input-title">
            Input
          </h2>
          <TranscriptInput
            value={text}
            onChange={setText}
            onLoadSample={() => setText(SAMPLE_TRANSCRIPT)}
            onClear={() => setText('')}
          />
        </section>
        <section className="sb-panel" aria-labelledby="sb-preview-title">
          <h2 className="sb-panel__title" id="sb-preview-title">
            Preview
          </h2>
          <Player
            storyboard={storyboard}
            index={state.index}
            playing={state.playing}
            onPlay={play}
            onPause={pause}
            onPrev={prev}
            onNext={next}
          />
          <ExportButton storyboard={storyboard} />
          <h2 className="sb-panel__title">Storyboard</h2>
          <StoryboardList storyboard={storyboard} currentIndex={state.index} onSelect={select} />
        </section>
      </main>
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
          <button type="button" className="sb-button--primary" onClick={() => window.location.reload()}>
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
