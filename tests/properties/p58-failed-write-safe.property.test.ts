// Feature: scenebeat-pwa, Property 58: Oversized or failing writes never corrupt stored work.
// For any previously stored string and any Saved_Work, flushing with a storage
// that throws, or with a serialization longer than the Save_Limit, leaves the
// stored string unchanged and reports exactly the notice `unavailable` or
// `too-large` respectively, without throwing.
// **Validates: Requirements 13.7, 13.8**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SAVED_WORK_KEY, serializeWork } from '../../src/core/savedWork';
import { createWorkStore, type StorageLike, type StoreNotice, type Timers } from '../../src/pwa/storage';
import { savedWorkArb } from './arbitraries';

/** Fake timers that never fire on their own; the test flushes explicitly. */
function idleTimers(): Timers {
  let next = 1;
  return { setTimeout: () => next++, clearTimeout: () => {} };
}

/** Map-backed storage whose `setItem` can be made to throw (quota, privacy mode). */
function fakeStorage(initial: string | null, throwOnSet: boolean): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  if (initial !== null) map.set(SAVED_WORK_KEY, initial);
  return {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      if (throwOnSet) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const previousArb = fc.option(fc.string({ unit: 'grapheme', maxLength: 200 }), { nil: null });

describe('Property 58: Oversized or failing writes never corrupt stored work', () => {
  it('a throwing storage keeps the stored string and reports only "unavailable"', () => {
    fc.assert(
      fc.property(previousArb, savedWorkArb, (previous, work) => {
        const storage = fakeStorage(previous, true);
        const notices: StoreNotice[] = [];
        const store = createWorkStore({ storage, timers: idleTimers(), onNotice: (n) => notices.push(n) });

        store.schedule(work);
        expect(() => store.flush()).not.toThrow();

        expect(storage.map.get(SAVED_WORK_KEY) ?? null).toBe(previous);
        expect(notices).toEqual(['unavailable']);
      }),
      { numRuns: 100 },
    );
  });

  it('a serialization above the limit keeps the stored string and reports only "too-large"', () => {
    fc.assert(
      fc.property(previousArb, savedWorkArb, fc.nat(), (previous, work, shortBy) => {
        const length = serializeWork(work).length;
        const limit = Math.max(0, length - 1 - (shortBy % length));
        const storage = fakeStorage(previous, false);
        const notices: StoreNotice[] = [];
        const store = createWorkStore({
          storage,
          timers: idleTimers(),
          onNotice: (n) => notices.push(n),
          limit,
        });

        store.schedule(work);
        expect(() => store.flush()).not.toThrow();

        expect(storage.map.get(SAVED_WORK_KEY) ?? null).toBe(previous);
        expect(notices).toEqual(['too-large']);
      }),
      { numRuns: 100 },
    );
  });
});
