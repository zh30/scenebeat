import { useEffect, useState } from 'react';
import type { Storyboard } from '../core/types';
import { formatPosition } from '../playback/positionLabel';
import { SceneView } from './SceneView';

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
      {scene ? (
        <SceneView scene={scene} reducedMotion={reduced} />
      ) : (
        <div className="sb-player__empty" role="status">
          No scenes yet. Paste a transcript to build a storyboard.
        </div>
      )}

      <div className="sb-player__controls" role="group" aria-label="Playback controls">
        <button
          type="button"
          className="sb-player__button"
          onClick={onPrev}
          disabled={isEmpty || current === 0}
        >
          Previous
        </button>
        <button
          type="button"
          className="sb-player__button"
          onClick={onPlay}
          disabled={isEmpty || playing}
        >
          Play
        </button>
        <button
          type="button"
          className="sb-player__button"
          onClick={onPause}
          disabled={isEmpty || !playing}
        >
          Pause
        </button>
        <button
          type="button"
          className="sb-player__button"
          onClick={onNext}
          disabled={isEmpty || current === total - 1}
        >
          Next
        </button>
        <span className="sb-player__position" aria-live="polite">
          {isEmpty ? '0 / 0' : formatPosition(current, total)}
        </span>
      </div>
    </section>
  );
}

export default Player;
