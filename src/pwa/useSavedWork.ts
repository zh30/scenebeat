import { useEffect, useRef } from 'react';
import type { SavedWork } from '../core/savedWork';
import type { StoreNotice, WorkStore } from './storage';

export interface SavedWorkEvents {
  /** Subscribes to `visibilitychange` (hidden) and `pagehide`; returns an unsubscribe function. */
  onHidden(f: () => void): () => void;
}

/**
 * Keeps the Work_Store in sync with the current Saved_Work (Requirements 13.1, 13.2).
 *
 * - Calls `store.schedule(work)` whenever one of the five Saved_Work fields
 *   changes. The work the hook first sees (the restored or default start-up
 *   state) is not written again.
 * - Registers `store.flush` with `events.onHidden`, so a pending write lands
 *   when the page is hidden or unloaded.
 * - On unmount, flushes a pending write and disposes the store's timer.
 */
export function useSavedWork(store: WorkStore, work: SavedWork, events: SavedWorkEvents): void {
  const { transcript, overrides, aspectRatio, exportFormat, subtitleFormat } = work;

  // Last work seen by the effect. Comparing against it (instead of a
  // "first run" flag) skips the restored state and stays correct when React
  // StrictMode runs effects twice.
  const last = useRef<SavedWork>(work);

  useEffect(() => {
    const prev = last.current;
    if (
      prev.transcript === transcript &&
      prev.overrides === overrides &&
      prev.aspectRatio === aspectRatio &&
      prev.exportFormat === exportFormat &&
      prev.subtitleFormat === subtitleFormat
    ) {
      return;
    }
    const next: SavedWork = { transcript, overrides, aspectRatio, exportFormat, subtitleFormat };
    last.current = next;
    store.schedule(next);
  }, [store, transcript, overrides, aspectRatio, exportFormat, subtitleFormat]);

  // Subscribe once per store; a new `onHidden` identity on re-render (for
  // example `defaultPwaDeps()` called during render) must not re-subscribe,
  // because each cleanup flushes and would defeat the debounce.
  const onHiddenRef = useRef(events.onHidden);
  onHiddenRef.current = events.onHidden;
  useEffect(() => {
    const unsubscribe = onHiddenRef.current(() => store.flush());
    return () => {
      unsubscribe();
      store.flush();
      store.dispose();
    };
  }, [store]);
}

/**
 * Wraps a notice handler for `createWorkStore({ onNotice })`: `unavailable`
 * passes through at most once per launch (Requirement 13.8); `too-large`
 * passes through every time (Requirement 13.7).
 */
export function oncePerLaunchUnavailable(show: (n: StoreNotice) => void): (n: StoreNotice) => void {
  let unavailableShown = false;
  return (n) => {
    if (n === 'unavailable') {
      if (unavailableShown) return;
      unavailableShown = true;
    }
    show(n);
  };
}
