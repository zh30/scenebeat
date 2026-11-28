import { describe, expect, it } from 'vitest';
import {
  createPlaybackState,
  playbackReducer,
  type PlaybackState,
} from '../src/playback/playbackReducer';

function playingAt(durations: number[], index: number, remainingMs: number): PlaybackState {
  return { ...createPlaybackState(durations), index, playing: true, remainingMs };
}

describe('playbackReducer retime', () => {
  it('pauses, keeps the index, and uses the new duration (Req 7.2, 7.3)', () => {
    const state = playingAt([2000, 3000, 4000], 1, 1200);
    const next = playbackReducer(state, { type: 'retime', durations: [2000, 5500, 4000] });
    expect(next).toEqual({
      index: 1,
      playing: false,
      remainingMs: 5500,
      total: 3,
      durations: [2000, 5500, 4000],
    });
  });

  it('restarts the current scene from its full duration when durations are unchanged', () => {
    const state = playingAt([2000, 3000], 0, 500);
    const next = playbackReducer(state, { type: 'retime', durations: [2000, 3000] });
    expect(next).toMatchObject({ index: 0, playing: false, remainingMs: 2000 });
  });

  it('clamps the index when the new list is shorter', () => {
    const state = playingAt([2000, 3000, 4000], 2, 4000);
    const next = playbackReducer(state, { type: 'retime', durations: [2500] });
    expect(next).toMatchObject({ index: 0, playing: false, remainingMs: 2500, total: 1 });
  });

  it('handles an empty list', () => {
    const state = playingAt([2000, 3000], 1, 3000);
    const next = playbackReducer(state, { type: 'retime', durations: [] });
    expect(next).toEqual({ index: 0, playing: false, remainingMs: 0, total: 0, durations: [] });
  });

  it('copies the durations instead of keeping the caller array', () => {
    const input = [2000, 3000];
    const next = playbackReducer(createPlaybackState([2000, 2000]), { type: 'retime', durations: input });
    input[0] = 9999;
    expect(next.durations).toEqual([2000, 3000]);
  });

  it('does not mutate the previous state', () => {
    const state = playingAt([2000, 3000], 1, 1000);
    const snapshot = structuredClone(state);
    playbackReducer(state, { type: 'retime', durations: [4000, 5000] });
    expect(state).toEqual(snapshot);
  });
});
