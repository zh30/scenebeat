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
  /** Pauses and replaces the durations with the current ones, keeping the index (Requirement 7.2, 7.3). */
  retime: () => void;
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
 *
 * With `resetKey` given (the automatic scenes' identity), a changed `resetKey`
 * resets playback, while a change of `durations` alone (an edit) dispatches
 * `retime`, which pauses and keeps the current index (Requirements 6.5, 7.2, 7.3).
 */
export function usePlayback(durations: readonly number[], resetKey?: string): UsePlaybackResult {
  const [state, dispatch] = useReducer(playbackReducer, durations, createPlaybackState);

  // Adjust during render when the inputs change by value, so no frame is
  // rendered with a stale index for the new storyboard.
  const key = durationsKey(durations);
  const [prev, setPrev] = useState({ key, resetKey });
  if (key !== prev.key || resetKey !== prev.resetKey) {
    setPrev({ key, resetKey });
    if (resetKey === undefined || resetKey !== prev.resetKey) {
      dispatch({ type: 'reset', durations });
    } else {
      dispatch({ type: 'retime', durations });
    }
  }

  // Latest durations for the retime() helper.
  const durationsRef = useRef(durations);
  durationsRef.current = durations;

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
  const prevScene = useCallback(() => dispatch({ type: 'prev' }), []);
  const select = useCallback((index: number) => dispatch({ type: 'select', index }), []);

  const retime = useCallback(() => {
    startRef.current = null;
    dispatch({ type: 'retime', durations: durationsRef.current });
  }, []);

  return { state, play, pause, next, prev: prevScene, select, retime, dispatch };
}
