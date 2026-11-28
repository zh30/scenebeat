import { SAVE_LIMIT, SAVED_WORK_KEY, serializeWork, type SavedWork } from '../core/savedWork';

/** The subset of the `localStorage` interface the Work_Store uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Injected timer functions (window timers in the browser, fakes in tests). */
export interface Timers {
  setTimeout(f: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export type StoreNotice = 'too-large' | 'unavailable';

export interface WorkStore {
  /** Raw stored string, or `null`; parsing happens in `initialWork`. */
  load(): string | null;
  /** Debounced write, `delayMs` after the last call. */
  schedule(work: SavedWork): void;
  /** Writes a pending value now. */
  flush(): void;
  /** Cancels a pending write and removes the Saved_Work_Key. */
  clear(): void;
  /** Cancels a pending timer. */
  dispose(): void;
}

export interface WorkStoreDeps {
  storage: StorageLike | null;
  timers: Timers;
  onNotice(n: StoreNotice): void;
  /** Debounce delay in ms (default 500). */
  delayMs?: number;
  /** Maximum serialized length in UTF-16 code units (default `SAVE_LIMIT`). */
  limit?: number;
}

/** Requirements 13.1, 13.2, 13.7, 13.8, 13.9, 13.11. Never throws on storage errors. */
export function createWorkStore(deps: WorkStoreDeps): WorkStore {
  const { storage, timers, onNotice } = deps;
  const delayMs = deps.delayMs ?? 500;
  const limit = deps.limit ?? SAVE_LIMIT;
  let pending: SavedWork | null = null;
  let timer: number | null = null;

  const cancelTimer = (): void => {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
  };

  const flush = (): void => {
    cancelTimer();
    if (pending === null) return;
    const serialized = serializeWork(pending);
    pending = null;
    if (serialized.length > limit) {
      onNotice('too-large');
      return;
    }
    if (storage === null) {
      onNotice('unavailable');
      return;
    }
    try {
      storage.setItem(SAVED_WORK_KEY, serialized);
    } catch {
      onNotice('unavailable');
    }
  };

  return {
    load() {
      if (storage === null) return null;
      try {
        return storage.getItem(SAVED_WORK_KEY) ?? null;
      } catch {
        onNotice('unavailable');
        return null;
      }
    },
    schedule(work) {
      pending = work;
      cancelTimer();
      timer = timers.setTimeout(() => {
        timer = null;
        flush();
      }, delayMs);
    },
    flush,
    clear() {
      cancelTimer();
      pending = null;
      try {
        storage?.removeItem(SAVED_WORK_KEY);
      } catch {
        // Storage unavailable: nothing to remove.
      }
    },
    dispose() {
      cancelTimer();
    },
  };
}

/** In-memory `StorageLike`, used by the App defaults and tests. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** True when `key` holds a value; read errors count as "not set" (Requirements 8.3, 9.8). */
export function readFlag(s: StorageLike | null, key: string): boolean {
  if (s === null) return false;
  try {
    return s.getItem(key) !== null;
  } catch {
    return false;
  }
}

/** Records `key` as `"1"`; write errors are swallowed. */
export function writeFlag(s: StorageLike | null, key: string): void {
  if (s === null) return;
  try {
    s.setItem(key, '1');
  } catch {
    // Ignored: the flag is treated as "not set" next launch.
  }
}
