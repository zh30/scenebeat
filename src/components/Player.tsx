import { useEffect, useState } from 'react';
import type { Storyboard } from '../core/types';
import { formatPosition } from '../playback/positionLabel';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';
import { SceneView } from './SceneView';
import { TEMPLATE_LABELS } from './templateLabels';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Returns the MediaQueryList for reduced motion, or null when matchMedia is unavailable. */
function getReducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Tracks the OS reduced-motion preference (Req 5.11).
 * A missing `matchMedia` is treated as "no preference".
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => getReducedMotionQuery()?.matches ?? false);

  useEffect(() => {
    const mql = getReducedMotionQuery();
    if (!mql) return;
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Older Safari only supports the deprecated listener API.
    if (typeof mql.addListener === 'function') {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
    return undefined;
  }, []);

  return reduced;
}

export interface PlayerProps {
  storyboard: Storyboard;
  /** Zero-based index of the current scene (from playback state). */
  index: number;
  /** Whether playback is advancing (from playback state). */
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Overrides the detected OS reduced-motion preference when provided. */
  reducedMotion?: boolean;
}

/**
 * Presentational player: renders the current Scene and the playback controls
 * (Req 5.1, 5.2, 5.3, 5.5 to 5.8, 5.11 to 5.13). Timing lives in usePlayback.
 * Play and Pause share one toggle button whose name follows the state.
 */
export function Player({
  storyboard,
  index,
  playing,
  onPlay,
  onPause,
  onPrev,
  onNext,
  reducedMotion,
}: PlayerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduced = reducedMotion ?? prefersReducedMotion;

  const total = storyboard.scenes.length;
  const isEmpty = total === 0;
  const current = isEmpty ? 0 : Math.min(Math.max(0, index), total - 1);
  const scene = isEmpty ? undefined : storyboard.scenes[current];

  return (
    <section className="sb-player" aria-label="Preview">
      <div className="sb-player__screen">
        {scene ? (
          <>
            <span className={`sb-player__tag sb-badge sb-badge--${scene.template}`}>
              {TEMPLATE_LABELS[scene.template]}
            </span>
            <SceneView scene={scene} reducedMotion={reduced} />
          </>
        ) : (
          <div className="sb-player__empty" role="status">
            <strong>Nothing to preview yet</strong>
            <span>Paste some text in step 1, or load the sample.</span>
          </div>
        )}
      </div>

      <ol className="sb-progress" aria-hidden="true">
        {storyboard.scenes.map((s) => (
          <li
            key={s.index}
            className={s.index < current ? 'is-done' : s.index === current ? 'is-current' : undefined}
          />
        ))}
      </ol>

      <div className="sb-player__controls" role="group" aria-label="Playback controls">
        <button
          type="button"
          className="sb-icon-button"
          aria-label="Previous"
          title="Previous scene"
          onClick={onPrev}
          disabled={isEmpty || current === 0}
        >
          <PrevIcon />
        </button>
        <button
          type="button"
          className="sb-play-button"
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
          onClick={playing ? onPause : onPlay}
          disabled={isEmpty}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="sb-icon-button"
          aria-label="Next"
          title="Next scene"
          onClick={onNext}
          disabled={isEmpty || current === total - 1}
        >
          <NextIcon />
        </button>
        <span className="sb-player__position" aria-live="polite">
          {isEmpty ? '0 / 0' : formatPosition(current, total)}
        </span>
      </div>
    </section>
  );
}

export default Player;
