import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackAction,
  type PlaybackState,
} from './playbackReducer';

export interface UsePlaybackResult {
  state: PlaybackState;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  select: (index: number) => void;
  dispatch: (action: PlaybackAction) => void;
}

/** Value-based key for a durations array, so equal arrays never trigger a reset. */
function durationsKey(durations: readonly number[]): string {
  return durations.join(',');
}

/**
 * Timer wrapper around `playbackReducer` (design: "Playback State Machine").
 *
 * While playing, one `setTimeout` is scheduled for the current scene's
 * `remainingMs`. When it fires, a `tick` of that amount advances the scene.
 * Pausing dispatches the time elapsed so far, so resuming continues the
 * remaining portion (Requirements 5.3, 5.4). A change in `durations` (by value)
 * resets playback to the first scene, paused (Requirement 5.14).
 */
export function usePlayback(durations: readonly number[]): UsePlaybackResult {
  const [state, dispatch] = useReducer(playbackReducer, durations, createPlaybackState);

  // Reset during render when the durations change by value, so no frame is
  // rendered with a stale index for the new storyboard.
  const key = durationsKey(durations);
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    dispatch({ type: 'reset', durations });
  }

  // Start time of the currently scheduled scene timer; null when no timer runs.
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state.playing || state.total === 0) {
      startRef.current = null;
      return;
    }
    const remaining = Math.max(0, state.remainingMs);
    startRef.current = Date.now();
    const id = setTimeout(() => {
      startRef.current = null;
      dispatch({ type: 'tick', elapsedMs: remaining });
    }, remaining);
    return () => {
      clearTimeout(id);
    };
    // Any new state object means remainingMs is the fresh truth, so reschedule.
  }, [state]);

  const play = useCallback(() => dispatch({ type: 'play' }), []);

  const pause = useCallback(() => {
    const start = startRef.current;
    if (start !== null) {
      startRef.current = null;
      dispatch({ type: 'tick', elapsedMs: Date.now() - start });
    }
    dispatch({ type: 'pause' });
  }, []);

  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const prev = useCallback(() => dispatch({ type: 'prev' }), []);
  const select = useCallback((index: number) => dispatch({ type: 'select', index }), []);

  return { state, play, pause, next, prev, select, dispatch };
}
