import { useEffect, useRef } from 'react';
import { parseLaunchParams, resolveLaunch, stripLaunchParams } from '../core/launchParams';
import type { LaunchIntent } from '../core/launchParams';
import type { LaunchEnv } from './launch';

export interface LaunchIntentResult {
  transcript: string;
  focusInput: boolean;
}

export interface LaunchIntentOptions {
  /** True once Saved_Work has been restored (Req 16.2). */
  ready: boolean;
  /** True while a Render_Job runs; intents wait until it ends (Req 16.4). */
  renderInProgress: boolean;
  currentTranscript: string;
  sampleTranscript: string;
  /** The intent can replace the transcript without asking. */
  onApply(r: LaunchIntentResult): void;
  /** The intent would replace a non-empty, different transcript: ask first. */
  onConfirm(r: LaunchIntentResult): void;
}

interface PendingIntent {
  intent: LaunchIntent;
  /** Query string the intent came from, used to clean the address afterwards. */
  search: string;
}

/** Query string of a launch target URL, or `null` when it cannot be parsed. */
function searchOf(targetURL: string | undefined): string | null {
  if (targetURL === undefined) return null;
  try {
    return new URL(targetURL).search;
  } catch {
    return null;
  }
}

/**
 * Handles the Launch_Intent of the start URL and of later `launchQueue`
 * deliveries. Intents wait until `ready` and until no render is in progress;
 * while waiting, the latest intent wins. The decision between applying and
 * confirming is made with the transcript current at processing time.
 */
export function useLaunchIntent(env: LaunchEnv, opts: LaunchIntentOptions): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const envRef = useRef(env);
  envRef.current = env;

  const pendingRef = useRef<PendingIntent | null>(null);
  const initialParsedRef = useRef(false);
  const consumerSetRef = useRef(false);
  const sawDeliveryRef = useRef(false);

  // Parse the start URL exactly once, before anything else can be queued.
  if (!initialParsedRef.current) {
    initialParsedRef.current = true;
    const intent = parseLaunchParams(env.initialSearch);
    if (intent.kind !== 'none') pendingRef.current = { intent, search: env.initialSearch };
  }

  const drainRef = useRef<() => void>(() => {});
  drainRef.current = () => {
    const o = optsRef.current;
    const pending = pendingRef.current;
    if (pending === null || !o.ready || o.renderInProgress) return;
    pendingRef.current = null;

    const resolution = resolveLaunch(pending.intent, o.currentTranscript, o.sampleTranscript);
    if (resolution.kind === 'noop') return;
    const result = { transcript: resolution.transcript, focusInput: resolution.focusInput };
    if (resolution.kind === 'apply') o.onApply(result);
    else o.onConfirm(result);

    try {
      envRef.current.replaceSearch(stripLaunchParams(pending.search));
    } catch {
      // Address cleanup is best effort; the intent stays handled for this page.
    }
  };

  // Register the launch queue consumer once (Req 16.3).
  useEffect(() => {
    const queue = env.launchQueue;
    if (queue === undefined || consumerSetRef.current) return;
    consumerSetRef.current = true;
    queue.setConsumer((params) => {
      const search = searchOf(params.targetURL);
      const first = !sawDeliveryRef.current;
      sawDeliveryRef.current = true;
      // Chromium also delivers the initial navigation; it was already parsed.
      if (search === null || (first && search === envRef.current.initialSearch)) return;
      const intent = parseLaunchParams(search);
      if (intent.kind === 'none') return;
      pendingRef.current = { intent, search };
      drainRef.current();
    });
  }, [env.launchQueue]);

  // Process a waiting intent once restored and no render is running.
  useEffect(() => {
    drainRef.current();
  }, [opts.ready, opts.renderInProgress]);
}
