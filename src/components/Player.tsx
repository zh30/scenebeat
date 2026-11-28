import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { DEFAULT_ASPECT_RATIO, getAspectRatio, type AspectRatioId } from '../core/aspectRatio';
import { layoutScene, type MeasureText } from '../core/sceneLayout';
import { FONT_FAMILY } from '../core/sceneTheme';
import type { Storyboard } from '../core/types';
import { formatPosition } from '../playback/positionLabel';
import { fallbackMeasure } from '../video/measure';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';
import { SceneView } from './SceneView';
import { TEMPLATE_LABELS } from './templateLabels';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Returns the MediaQueryList for reduced motion, or null when matchMedia is unavailable. */
function getReducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Tracks the OS reduced-motion preference (Req 5.11).
 * A missing `matchMedia` is treated as "no preference".
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => getReducedMotionQuery()?.matches ?? false);

  useEffect(() => {
    const mql = getReducedMotionQuery();
    if (!mql) return;
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Older Safari only supports the deprecated listener API.
    if (typeof mql.addListener === 'function') {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
    return undefined;
  }, []);

  return reduced;
}

/**
 * Width in CSS px of the referenced element, tracked with ResizeObserver.
 * Falls back to `clientWidth`, then 1, when ResizeObserver or layout is unavailable.
 */
export function useElementWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth(el.clientWidth || 1);
    read();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number' && w > 0) setWidth(w);
      else read();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}

export interface PlayerProps {
  storyboard: Storyboard;
  /** Zero-based index of the current scene (from playback state). */
  index: number;
  /** Whether playback is advancing (from playback state). */
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Overrides the detected OS reduced-motion preference when provided. */
  reducedMotion?: boolean;
  /** Output shape of the screen and stage. Defaults to 16:9. */
  ratio?: AspectRatioId;
  /** Text measurer shared with the video renderer. Defaults to `fallbackMeasure`. */
  measure?: MeasureText;
  /** Disables every playback control (while a video renders). */
  disabled?: boolean;
}

/**
 * Presentational player: renders the current Scene and the playback controls
 * (Req 5.1, 5.2, 5.3, 5.5 to 5.8, 5.11 to 5.13). Timing lives in usePlayback.
 * Play and Pause share one toggle button whose name follows the state.
 * The screen takes the Aspect_Ratio's shape; the stage is laid out at the
 * ratio's logical pixel size and scaled to the screen width (Req 8.5, 8.6).
 */
export function Player({
  storyboard,
  index,
  playing,
  onPlay,
  onPause,
  onPrev,
  onNext,
  reducedMotion,
  ratio = DEFAULT_ASPECT_RATIO,
  measure = fallbackMeasure,
  disabled = false,
}: PlayerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduced = reducedMotion ?? prefersReducedMotion;
  const screenRef = useRef<HTMLDivElement>(null);
  const screenWidth = useElementWidth(screenRef);

  const total = storyboard.scenes.length;
  const isEmpty = total === 0;
  const current = isEmpty ? 0 : Math.min(Math.max(0, index), total - 1);
  const scene = isEmpty ? undefined : storyboard.scenes[current];

  const spec = getAspectRatio(ratio);
  const layout = useMemo(() => (scene ? layoutScene(scene, ratio, measure) : null), [scene, ratio, measure]);
  const [ratioW, ratioH] = spec.id.split(':');
  const screenStyle = { '--sb-ratio-w': ratioW, '--sb-ratio-h': ratioH } as CSSProperties;
  const stageStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${spec.width}px`,
    height: `${spec.height}px`,
    padding: 0,
    transform: `scale(${screenWidth / spec.width})`,
    transformOrigin: '0 0',
    fontFamily: FONT_FAMILY,
    letterSpacing: 'normal',
  };

  return (
    <section className="sb-player" aria-label="Preview">
      <div className="sb-player__screen" ref={screenRef} data-ratio={spec.id} style={screenStyle}>
        {scene && layout ? (
          <>
            <span className={`sb-player__tag sb-badge sb-badge--${scene.template}`}>
              {TEMPLATE_LABELS[scene.template]}
            </span>
            <div className="sb-stage" style={stageStyle}>
              <SceneView scene={scene} layout={layout} reducedMotion={reduced} />
            </div>
          </>
        ) : (
          <div className="sb-player__empty" role="status">
            <strong>Nothing to preview yet</strong>
            <span>Paste some text in step 1, or load the sample.</span>
          </div>
        )}
      </div>

      <ol className="sb-progress" aria-hidden="true">
        {storyboard.scenes.map((s) => (
          <li
            key={s.index}
            className={s.index < current ? 'is-done' : s.index === current ? 'is-current' : undefined}
          />
        ))}
      </ol>

      <div className="sb-player__controls" role="group" aria-label="Playback controls">
        <button
          type="button"
          className="sb-icon-button"
          aria-label="Previous"
          title="Previous scene"
          onClick={onPrev}
          disabled={disabled || isEmpty || current === 0}
        >
          <PrevIcon />
        </button>
        <button
          type="button"
          className="sb-play-button"
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
          onClick={playing ? onPause : onPlay}
          disabled={disabled || isEmpty}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="sb-icon-button"
          aria-label="Next"
          title="Next scene"
          onClick={onNext}
          disabled={disabled || isEmpty || current === total - 1}
        >
          <NextIcon />
        </button>
        <span className="sb-player__position" aria-live="polite">
          {isEmpty ? '0 / 0' : formatPosition(current, total)}
        </span>
      </div>
    </section>
  );
}

export default Player;
