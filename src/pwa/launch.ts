/**
 * Browser launch environment, injected into `useLaunchIntent`.
 *
 * The query string is parsed by `parseLaunchParams` and cleaned by
 * `stripLaunchParams` in `src/core/launchParams.ts`; this module only
 * describes the browser APIs those results are read from and written to,
 * so tests can pass fakes. The real values are built in `browserDeps.ts`
 * from `location.search`, `history.replaceState`, and `window.launchQueue`.
 */

/** The subset of a Launch Handler API `LaunchParams` the app reads. */
export interface LaunchParamsLike {
  targetURL?: string;
}

/** The subset of `window.launchQueue` the app uses (Chromium only). */
export interface LaunchQueueLike {
  setConsumer(consumer: (params: LaunchParamsLike) => void): void;
}

export interface LaunchEnv {
  /** `location.search` at start-up, including the leading `?` when present. */
  initialSearch: string;
  /**
   * Replaces the query string of the current history entry, keeping the
   * path and hash (`history.replaceState`). May throw; callers ignore errors.
   */
  replaceSearch(search: string): void;
  /** Present only where the Launch Handler API exists. */
  launchQueue?: LaunchQueueLike;
}
