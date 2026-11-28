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

type KeyedProps = { durations: readonly number[]; resetKey: string };

function setupKeyed(durations: readonly number[], resetKey: string) {
  return renderHook(({ durations, resetKey }: KeyedProps) => usePlayback(durations, resetKey), {
    initialProps: { durations, resetKey },
  });
}

describe('usePlayback with resetKey and retime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets to the first scene when resetKey changes', () => {
    const { result, rerender } = setupKeyed([2000, 3000, 4000], 'a');
    act(() => result.current.select(2));
    act(() => result.current.play());

    rerender({ durations: [2000, 3000, 4000], resetKey: 'b' });
    expect(result.current.state).toMatchObject({ index: 0, playing: false, remainingMs: 2000 });
  });

  it('retimes, keeping the index and pausing, when only durations change (Req 7.2, 7.3)', () => {
    const { result, rerender } = setupKeyed([2000, 3000, 4000], 'a');
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.state.index).toBe(1);

    rerender({ durations: [2000, 6000, 4000], resetKey: 'a' });
    expect(result.current.state).toMatchObject({
      index: 1,
      playing: false,
      remainingMs: 6000,
      durations: [2000, 6000, 4000],
    });

    // The old timer must not advance the paused scene.
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.state.index).toBe(1);
    expect(result.current.state.playing).toBe(false);
  });

  it('clamps the index on retime when the list gets shorter', () => {
    const { result, rerender } = setupKeyed([2000, 3000, 4000], 'a');
    act(() => result.current.select(2));
    rerender({ durations: [2000, 3000], resetKey: 'a' });
    expect(result.current.state).toMatchObject({ index: 1, playing: false, total: 2 });
  });

  it('does nothing when durations and resetKey are equal by value', () => {
    const { result, rerender } = setupKeyed([2000, 3000], 'a');
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender({ durations: [2000, 3000], resetKey: 'a' });
    expect(result.current.state.playing).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.state.index).toBe(1);
  });

  it('retime() pauses and keeps the position with unchanged durations', () => {
    const { result } = setupKeyed([2000, 3000, 4000], 'a');
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.state.index).toBe(1);

    act(() => result.current.retime());
    expect(result.current.state).toMatchObject({ index: 1, playing: false, remainingMs: 3000 });
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.state.index).toBe(1);
  });

  it('retime() uses the latest durations', () => {
    const { result, rerender } = setupKeyed([2000, 3000], 'a');
    act(() => result.current.select(1));
    rerender({ durations: [2000, 7000], resetKey: 'a' });
    act(() => result.current.play());
    act(() => result.current.retime());
    expect(result.current.state).toMatchObject({ index: 1, playing: false, remainingMs: 7000 });
  });

  it('play after retime continues from the kept scene', () => {
    const { result } = setupKeyed([2000, 3000], 'a');
    act(() => result.current.select(1));
    act(() => result.current.retime());
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.state).toMatchObject({ index: 1, playing: true });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state).toMatchObject({ index: 1, playing: false, remainingMs: 0 });
  });
});
