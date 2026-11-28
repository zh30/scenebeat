// Feature: scenebeat-pwa, Property 57: Debounced saving writes the latest work.
// For any sequence of Saved_Work changes separated by random delays, followed by
// either 500 ms of quiet or a hidden/pagehide event, with an in-memory storage
// and fake timers, the stored string equals `serializeWork` of the last change,
// and no write happens while changes keep arriving less than 500 ms apart.
// **Validates: Requirements 13.1, 13.2**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SAVED_WORK_KEY, serializeWork } from '../../src/core/savedWork';
import { createMemoryStorage, createWorkStore, type StorageLike, type Timers } from '../../src/pwa/storage';
import { changeScheduleArb } from './arbitraries';

/** Manual clock: timers fire only when `advance` moves time past their due time. */
function createFakeTimers(): Timers & { advance(ms: number): void; pendingCount(): number } {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { due: number; f: () => void }>();
  return {
    setTimeout(f, ms) {
      const id = nextId++;
      pending.set(id, { due: now + ms, f });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let nextIdDue: number | null = null;
        let nextDue = Infinity;
        for (const [id, t] of pending) {
          if (t.due <= target && t.due < nextDue) {
            nextDue = t.due;
            nextIdDue = id;
          }
        }
        if (nextIdDue === null) break;
        const t = pending.get(nextIdDue)!;
        pending.delete(nextIdDue);
        now = t.due;
        t.f();
      }
      now = target;
    },
    pendingCount: () => pending.size,
  };
}

describe('Property 57: Debounced saving writes the latest work', () => {
  it('stores the last change and writes only after 500 ms of quiet or on hidden', () => {
    fc.assert(
      fc.property(changeScheduleArb, ({ changes, end }) => {
        const memory = createMemoryStorage();
        const writes: string[] = [];
        const storage: StorageLike = {
          getItem: (k) => memory.getItem(k),
          setItem: (k, v) => {
            writes.push(v);
            memory.setItem(k, v);
          },
          removeItem: (k) => memory.removeItem(k),
        };
        const timers = createFakeTimers();
        const notices: string[] = [];
        const store = createWorkStore({ storage, timers, onNotice: (n) => notices.push(n) });

        // A write may happen only when a gap of at least 500 ms follows a change,
        // and then it holds exactly that change.
        const expectedWrites: string[] = [];
        changes.forEach(({ delayMs, work }, i) => {
          timers.advance(delayMs);
          if (i > 0 && delayMs >= 500) expectedWrites.push(serializeWork(changes[i - 1].work));
          expect(writes).toStrictEqual(expectedWrites);
          store.schedule(work);
        });

        const last = serializeWork(changes[changes.length - 1].work);
        if (end.kind === 'quiet') {
          timers.advance(499);
          expect(writes).toStrictEqual(expectedWrites);
          timers.advance(end.ms - 499);
        } else {
          store.flush();
        }
        expectedWrites.push(last);

        expect(writes).toStrictEqual(expectedWrites);
        expect(memory.getItem(SAVED_WORK_KEY)).toBe(last);
        expect(timers.pendingCount()).toBe(0);
        expect(notices).toStrictEqual([]);

        // Nothing further is written once the pending value has been saved.
        timers.advance(5000);
        store.flush();
        expect(writes).toHaveLength(expectedWrites.length);
        store.dispose();
      }),
      { numRuns: 100 },
    );
  });
});
