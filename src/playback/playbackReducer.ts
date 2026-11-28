/**
 * Pure playback state machine for the Player (design: "Playback State Machine").
 *
 * The reducer tracks the remaining display time of the current scene so that
 * pausing and resuming continues the remaining duration (Requirement 5.4).
 */

export interface PlaybackState {
  /** Zero-based index of the current scene. Always 0 when `total` is 0. */
  index: number;
  /** Whether playback is advancing. Always false when `total` is 0. */
  playing: boolean;
  /** Milliseconds left for the current scene. */
  remainingMs: number;
  /** Number of scenes. */
  total: number;
  /** Display_Duration of every scene, in scene order. */
  durations: readonly number[];
}

export type PlaybackAction =
  | { type: 'reset'; durations: readonly number[] }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'tick'; elapsedMs: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'select'; index: number }
  /** Replaces the durations after an edit: pauses and keeps the position (Requirement 7.2, 7.3). */
  | { type: 'retime'; durations: readonly number[] };

/** Builds the state for a freshly (re)generated storyboard: first scene, paused. */
export function createPlaybackState(durations: readonly number[]): PlaybackState {
  const copy = [...durations];
  return {
    index: 0,
    playing: false,
    remainingMs: copy[0] ?? 0,
    total: copy.length,
    durations: copy,
  };
}

/** Moves to `index` (assumed valid) with that scene's full duration, keeping `playing`. */
function goTo(state: PlaybackState, index: number): PlaybackState {
  return { ...state, index, remainingMs: state.durations[index] ?? 0 };
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'reset':
      return createPlaybackState(action.durations);

    case 'play': {
      if (state.total === 0) return state;
      const isLast = state.index === state.total - 1;
      if (isLast && state.remainingMs <= 0) {
        // Playback previously ended on the last scene: replay that scene.
        return { ...goTo(state, state.index), playing: true };
      }
      return state.playing ? state : { ...state, playing: true };
    }

    case 'pause':
      return state.playing ? { ...state, playing: false } : state;

    case 'tick': {
      if (!state.playing || state.total === 0) return state;
      const elapsed = Number.isFinite(action.elapsedMs) ? Math.max(0, action.elapsedMs) : 0;
      const remainingMs = state.remainingMs - elapsed;
      if (remainingMs > 0) return { ...state, remainingMs };
      if (state.index < state.total - 1) return goTo(state, state.index + 1);
      // End of the last scene: stop and keep it displayed (Requirement 5.9).
      return { ...state, playing: false, remainingMs: 0 };
    }

    case 'next':
      return state.index < state.total - 1 ? goTo(state, state.index + 1) : state;

    case 'prev':
      return state.index > 0 && state.total > 0 ? goTo(state, state.index - 1) : state;

    case 'select': {
      const { index } = action;
      if (!Number.isInteger(index) || index < 0 || index >= state.total) return state;
      return goTo(state, index);
    }

    case 'retime': {
      const durations = [...action.durations];
      const total = durations.length;
      const index = Math.min(state.index, Math.max(0, total - 1));
      return {
        index,
        playing: false,
        remainingMs: durations[index] ?? 0,
        total,
        durations,
      };
    }

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
