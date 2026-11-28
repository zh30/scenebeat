import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import type { AspectRatioId } from '../core/aspectRatio';
import { buildStoryboard } from '../core/buildStoryboard';
import { initialWork, SAVED_WORK_KEY, type SavedWork } from '../core/savedWork';
import { defaultPwaDeps, type PwaDeps } from '../pwa/deps';
import { createWorkStore, type StorageLike, type StoreNotice, type WorkStore } from '../pwa/storage';
import { useLaunchIntent, type LaunchIntentResult } from '../pwa/useLaunchIntent';
import { usePwa } from '../pwa/usePwa';
import { oncePerLaunchUnavailable, useSavedWork } from '../pwa/useSavedWork';
import { ConfirmReplaceDialog } from './ConfirmReplaceDialog';
import { InstallButton } from './InstallButton';
import { NoticeArea } from './NoticeArea';
import { UpdateToast } from './UpdateToast';
import { buildEditedStoryboard } from '../core/editedStoryboard';
import {
  hasOverride,
  occurrenceRanks,
  overrideKey,
  reconcileOverrides,
  resetSceneOverride,
  setEditedText,
  setManualTemplate,
} from '../core/overrides';
import { INITIAL_RENDER_STATUS, renderStatusReducer } from '../core/renderStatus';
import type { SceneOverrides, SceneTemplate } from '../core/types';
import { SAMPLE_TRANSCRIPT } from '../data/sampleTranscript';
import { usePlayback } from '../playback/usePlayback';
import { createBrowserMeasure } from '../video/measure';
import { browserVideoEnv, detectVideoSupport } from '../video/support';
import { AspectRatioPicker } from './AspectRatioPicker';
import { ExportPanel, type ExportFormat, type SubtitleFormat } from './ExportPanel';
import { Player } from './Player';
import { StoryboardList, type SceneEditorBindings } from './StoryboardList';
import { TranscriptInput } from './TranscriptInput';
import '../styles/app.css';

/** Delay between the last edit and storyboard regeneration (Req 1.5). */
export const REGENERATE_DEBOUNCE_MS = 300;

/** Returns `value` once it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

const EMPTY_OVERRIDES: SceneOverrides = {};

export const SAVED_NOTE = 'Saved on this device only';
const HEADER_TITLE = 'Turn a transcript into an animated storyboard.';
const HEADER_TAGLINE =
  'Paste text, watch it play as motion scenes, download the result. No sign-up, nothing leaves your browser.';
export const TOO_LARGE_NOTICE = 'This transcript is too large to save on this device';
export const UNAVAILABLE_NOTICE = "Your work can't be saved in this browser";

interface StoreNotices {
  tooLarge: boolean;
  unavailable: boolean;
}

/**
 * Creates the Work_Store for one `PwaDeps` object. A successful write of the
 * Saved_Work_Key clears the "too large" notice (design: "too-large stays until
 * the next successful write clears it"); notices raised before `App` mounts
 * (from `load()` during the first render) are queued and applied on mount.
 */
function createAppWorkStore(deps: PwaDeps, onNotices: (f: (n: StoreNotices) => StoreNotices) => void): WorkStore {
  const inner = deps.storage;
  const storage: StorageLike | null =
    inner === null
      ? null
      : {
          getItem: (k) => inner.getItem(k),
          removeItem: (k) => inner.removeItem(k),
          setItem: (k, v) => {
            inner.setItem(k, v);
            if (k === SAVED_WORK_KEY) onNotices((n) => (n.tooLarge ? { ...n, tooLarge: false } : n));
          },
        };
  const show = (notice: StoreNotice): void =>
    onNotices((n) => (notice === 'too-large' ? { ...n, tooLarge: true } : { ...n, unavailable: true }));
  return createWorkStore({ storage, timers: deps.timers, onNotice: oncePerLaunchUnavailable(show) });
}

function SceneBeat({ pwa: pwaProp }: { pwa?: PwaDeps }) {
  // One deps object per mount: startServiceWorker registers once per deps object.
  const [defaultDeps] = useState<PwaDeps | null>(() => (pwaProp === undefined ? defaultPwaDeps() : null));
  const pwa = pwaProp ?? (defaultDeps as PwaDeps);

  // Storage notices. Updates requested before mount are queued, then applied.
  const [storeNotices, setStoreNotices] = useState<StoreNotices>({ tooLarge: false, unavailable: false });
  const mountedRef = useRef(false);
  const queuedNoticesRef = useRef<Array<(n: StoreNotices) => StoreNotices>>([]);
  const updateNotices = useCallback((f: (n: StoreNotices) => StoreNotices) => {
    if (mountedRef.current) setStoreNotices(f);
    else queuedNoticesRef.current.push(f);
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    const queued = queuedNoticesRef.current;
    queuedNoticesRef.current = [];
    for (const f of queued) setStoreNotices(f);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [store] = useState(() => createAppWorkStore(pwa, updateNotices));
  const [videoSupport] = useState(() => detectVideoSupport(browserVideoEnv(window)));
  // Start-up state: restored Saved_Work, else the sample transcript and defaults (Req 13.3 to 13.6).
  const [start] = useState(() => initialWork(store.load(), videoSupport.supported, SAMPLE_TRANSCRIPT));

  const [text, setText] = useState(start.work.transcript);
  const debouncedText = useDebouncedValue(text, REGENERATE_DEBOUNCE_MS);
  const auto = useMemo(() => buildStoryboard(debouncedText), [debouncedText]);
  const ranks = useMemo(() => occurrenceRanks(auto.scenes.map((s) => s.text)), [auto]);

  // Scene_Overrides, reconciled during render whenever the Automatic_Scenes change (Req 6.3, 6.4).
  // Restored overrides go through the same reconcile on the first render (Req 13.4).
  const [overridesState, setOverrides] = useState<SceneOverrides>(() =>
    Object.keys(start.work.overrides).length === 0 ? EMPTY_OVERRIDES : start.work.overrides,
  );
  const [overridesAuto, setOverridesAuto] = useState<typeof auto | null>(() =>
    Object.keys(start.work.overrides).length === 0 ? auto : null,
  );
  let overrides = overridesState;
  if (overridesAuto !== auto) {
    overrides = reconcileOverrides(auto.scenes, overridesState);
    setOverridesAuto(auto);
    setOverrides(overrides);
  }

  const storyboard = useMemo(() => buildEditedStoryboard(auto, overrides), [auto, overrides]);
  const durations = useMemo(() => storyboard.scenes.map((s) => s.durationMs), [storyboard]);
  const resetKey = useMemo(
    () => JSON.stringify(auto.scenes.map((s) => [s.text, s.durationMs])),
    [auto],
  );
  const { state, play, pause, next, prev, select, retime } = usePlayback(durations, resetKey);

  const [ratio, setRatio] = useState<AspectRatioId>(start.work.aspectRatio);
  const measure = useMemo(() => createBrowserMeasure(document), []);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(start.work.exportFormat);
  const [subtitleFormat, setSubtitleFormat] = useState<SubtitleFormat>(start.work.subtitleFormat);
  const [renderStatus, dispatchRender] = useReducer(renderStatusReducer, INITIAL_RENDER_STATUS);
  const locked = renderStatus.phase === 'rendering';
  const [editing, setEditing] = useState(false);

  // Saved_Work: debounced writes, flushed when the page is hidden (Req 13.1, 13.2).
  const work: SavedWork = { transcript: text, overrides, aspectRatio: ratio, exportFormat, subtitleFormat };
  useSavedWork(store, work, { onHidden: pwa.onHidden });

  const handleClear = (): void => {
    store.clear(); // Req 13.9: the next write stores the cleared state.
    setText('');
    setOverrides(EMPTY_OVERRIDES);
  };
  const handleLoadSample = (): void => setText(SAMPLE_TRANSCRIPT);

  // Launch intents (shortcuts, share target, launch queue) (Req 14 to 16).
  const inputCardRef = useRef<HTMLElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest === 0) return;
    inputCardRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }, [focusRequest]);

  const applyLaunch = (r: LaunchIntentResult): void => {
    if (r.focusInput) {
      handleClear();
      setFocusRequest((n) => n + 1);
    } else if (r.transcript === SAMPLE_TRANSCRIPT) {
      handleLoadSample();
    } else {
      setText(r.transcript);
    }
  };
  const [pendingReplace, setPendingReplace] = useState<LaunchIntentResult | null>(null);
  useLaunchIntent(pwa.launch, {
    ready: true,
    renderInProgress: locked,
    currentTranscript: text,
    sampleTranscript: SAMPLE_TRANSCRIPT,
    onApply: applyLaunch,
    onConfirm: setPendingReplace,
  });

  // Install, update, and offline-ready (Req 6 to 9).
  const pwaUi = usePwa(pwa, { renderInProgress: locked, editing, flushWork: store.flush });

  // Every edit pauses playback and keeps the position (Req 7.2, 7.3).
  const stopForEdit = () => {
    pause();
    retime();
  };

  const editor: SceneEditorBindings = {
    disabled: locked,
    isEdited: (i) => {
      const a = auto.scenes[i];
      return a !== undefined && hasOverride(overrides, a, ranks[i]);
    },
    onTemplateChange: (i, template: SceneTemplate) => {
      const a = auto.scenes[i];
      if (a === undefined || locked) return;
      setOverrides(setManualTemplate(overrides, a, ranks[i], template));
      stopForEdit();
    },
    onSaveText: (i, raw) => {
      const a = auto.scenes[i];
      if (a === undefined || locked) return null;
      const result = setEditedText(overrides, a, ranks[i], raw);
      if (!result.ok) return result.error;
      setOverrides(result.overrides);
      stopForEdit();
      return null;
    },
    onReset: (i) => {
      const a = auto.scenes[i];
      if (a === undefined || locked) return;
      setOverrides(resetSceneOverride(overrides, overrideKey(a.text, ranks[i])));
      stopForEdit();
    },
    onEditStart: () => stopForEdit(),
  };

  const total = storyboard.scenes.length;

  return (
    <div className="sb-app">
      <header className="sb-header">
        <div className="sb-brand">
          <span className="sb-brand__mark" aria-hidden="true" />
          <span className="sb-brand__name">SceneBeat</span>
        </div>
        <InstallButton state={pwaUi.installState} onInstall={pwaUi.install} onDismiss={pwaUi.dismissInstall} />
        <h1 className="sb-header__title">{HEADER_TITLE}</h1>
        <p className="sb-header__tagline">{HEADER_TAGLINE}</p>
      </header>

      <main className="sb-main">
        <section className="sb-card sb-card--input" aria-labelledby="sb-step-1" ref={inputCardRef}>
          {/* Header copy repeated as plain text; CSS shows it only in Window Controls Overlay mode,
              where .sb-header__title and .sb-header__tagline are hidden. */}
          <div className="sb-wco-intro">
            <p className="sb-wco-intro__title">{HEADER_TITLE}</p>
            <p className="sb-wco-intro__tagline">{HEADER_TAGLINE}</p>
          </div>
          <StepTitle id="sb-step-1" step={1} title="Paste your transcript" />
          <TranscriptInput
            value={text}
            onChange={setText}
            onLoadSample={handleLoadSample}
            onClear={handleClear}
            disabled={locked}
            savedNote={SAVED_NOTE}
          />
        </section>

        <div className="sb-column">
          <section className="sb-card" aria-labelledby="sb-step-2">
            <StepTitle
              id="sb-step-2"
              step={2}
              title="Watch the preview"
              aside={total > 0 ? `${total} ${total === 1 ? 'scene' : 'scenes'}` : undefined}
            />
            <AspectRatioPicker value={ratio} onChange={setRatio} disabled={locked} />
            <Player
              storyboard={storyboard}
              index={state.index}
              playing={state.playing}
              onPlay={play}
              onPause={pause}
              onPrev={prev}
              onNext={next}
              ratio={ratio}
              measure={measure}
              disabled={locked}
            />
          </section>

          <section className="sb-card sb-card--row" aria-labelledby="sb-step-3">
            <StepTitle id="sb-step-3" step={3} title="Download" />
            <ExportPanel
              storyboard={storyboard}
              ratio={ratio}
              videoSupport={videoSupport}
              format={exportFormat}
              onFormatChange={setExportFormat}
              subtitleFormat={subtitleFormat}
              onSubtitleFormatChange={setSubtitleFormat}
              renderStatus={renderStatus}
              dispatchRender={dispatchRender}
              onRenderStart={pause}
              measure={measure}
            />
          </section>
        </div>

        <section className="sb-card sb-card--wide" aria-labelledby="sb-scenes">
          <div className="sb-step">
            <h2 className="sb-step__title" id="sb-scenes">
              All scenes
            </h2>
            <span className="sb-step__aside">Click a scene to jump to it</span>
          </div>
          <StoryboardList
            storyboard={storyboard}
            currentIndex={state.index}
            onSelect={select}
            editor={editor}
            onEditingChange={setEditing}
          />
        </section>
      </main>

      <footer className="sb-footer">Made with Kiro for Kiroween 2026 · MIT licensed</footer>

      <NoticeArea>
        <UpdateToast view={pwaUi.update} onReload={pwaUi.reload} onLater={pwaUi.later} />
        {pwaUi.offlineReady && (
          <div className="sb-notice sb-notice--info sb-notice--offline">
            <span className="sb-notice__title">Ready to work offline</span>
            <button type="button" className="sb-button sb-button--ghost" onClick={pwaUi.dismissOfflineReady}>
              Dismiss
            </button>
          </div>
        )}
        {storeNotices.tooLarge && <p className="sb-notice sb-notice--warning">{TOO_LARGE_NOTICE}</p>}
        {storeNotices.unavailable && <p className="sb-notice sb-notice--warning">{UNAVAILABLE_NOTICE}</p>}
      </NoticeArea>

      <ConfirmReplaceDialog
        open={pendingReplace !== null}
        onReplace={() => {
          const r = pendingReplace;
          setPendingReplace(null);
          if (r !== null) applyLaunch(r);
        }}
        onKeep={() => setPendingReplace(null)}
      />
    </div>
  );
}

function StepTitle({ id, step, title, aside }: { id: string; step: number; title: string; aside?: string }) {
  return (
    <div className="sb-step">
      <span className="sb-step__number" aria-hidden="true">
        {step}
      </span>
      <h2 className="sb-step__title" id={id}>
        <span className="sb-visually-hidden">Step {step}: </span>
        {title}
      </h2>
      {aside && <span className="sb-step__aside">{aside}</span>}
    </div>
  );
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Top-level boundary: shows a short message and a "Reload" button on render errors. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('SceneBeat crashed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="sb-error-boundary" role="alert">
          <h1>Something went wrong.</h1>
          <p>SceneBeat hit an unexpected error.</p>
          <button type="button" className="sb-button sb-button--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface AppProps {
  /** Browser integration (service worker, install, storage, launch). Defaults to `defaultPwaDeps()`. */
  pwa?: PwaDeps;
}

export function App({ pwa }: AppProps = {}) {
  return (
    <AppErrorBoundary>
      <SceneBeat pwa={pwa} />
    </AppErrorBoundary>
  );
}

export default App;
