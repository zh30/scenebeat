import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayback } from '../src/playback/usePlayback';

type Props = { durations: readonly number[] };

function setup(durations: readonly number[]) {
  return renderHook(({ durations }: Props) => usePlayback(durations), {
    initialProps: { durations },
  });
}

describe('usePlayback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts paused on the first scene', () => {
    const { result } = setup([2000, 3000]);
    expect(result.current.state).toMatchObject({
      index: 0,
      playing: false,
      remainingMs: 2000,
      total: 2,
    });
  });

  it('advances to the next scene only after the duration elapses (Req 5.2)', () => {
    const { result } = setup([2000, 3000, 4000]);
    act(() => result.current.play());
    expect(result.current.state.playing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(result.current.state.index).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state.index).toBe(1);
    expect(result.current.state.remainingMs).toBe(3000);
    expect(result.current.state.playing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.state.index).toBe(2);
  });

  it('pauses mid-scene and resumes for the remainder (Req 5.3, 5.4)', () => {
    const { result } = setup([4000, 3000]);
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => result.current.pause());

    expect(result.current.state.playing).toBe(false);
    expect(result.current.state.index).toBe(0);
    expect(result.current.state.remainingMs).toBe(2500);

    // While paused, time passing does not advance the scene.
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.state.index).toBe(0);
    expect(result.current.state.remainingMs).toBe(2500);

    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(2499);
    });
    expect(result.current.state.index).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state.index).toBe(1);
  });

  it('stops on the last scene and keeps it displayed (Req 5.9)', () => {
    const { result } = setup([2000, 2500]);
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.state.index).toBe(1);
    expect(result.current.state.playing).toBe(false);
    expect(result.current.state.remainingMs).toBe(0);

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(result.current.state.index).toBe(1);
    expect(result.current.state.playing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resets to the first scene, paused, when durations change (Req 5.14)', () => {
    const { result, rerender } = setup([2000, 3000, 4000]);
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.state.index).toBe(1);

    rerender({ durations: [5000, 6000] });
    expect(result.current.state).toMatchObject({
      index: 0,
      playing: false,
      remainingMs: 5000,
      total: 2,
    });

    // The old timer must not advance the new storyboard.
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.state.index).toBe(0);
    expect(result.current.state.playing).toBe(false);
  });

  it('does not reset when given an equal durations array', () => {
    const { result, rerender } = setup([2000, 3000, 4000]);
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.state.index).toBe(1);

    rerender({ durations: [2000, 3000, 4000] });
    expect(result.current.state.index).toBe(1);
    expect(result.current.state.playing).toBe(true);

    // Playback continues on schedule: 2000 ms left on scene 1.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.state.index).toBe(2);
  });

  it('clears the pending timer on unmount', () => {
    const { result, unmount } = setup([2000, 3000]);
    act(() => result.current.play());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
