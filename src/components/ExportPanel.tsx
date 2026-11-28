import { useEffect, useId, useRef, useState } from 'react';
import { getAspectRatio, type AspectRatioId } from '../core/aspectRatio';
import {
  formatExportFilename,
  formatSubtitleFilename,
  formatVideoFilename,
} from '../core/exportFilename';
import { totalDuration, videoLengthSeconds } from '../core/framePlan';
import type { RenderNotice, RenderStatus, RenderStatusAction } from '../core/renderStatus';
import type { MeasureText } from '../core/sceneLayout';
import { parseStoryboard, serializeStoryboard } from '../core/serialize';
import { buildCues, formatSrt, formatVtt } from '../core/subtitles';
import type { Storyboard, ValidationError } from '../core/types';
import { validateStoryboard } from '../core/validate';
import { createBrowserRenderDeps, renderVideo, type RenderDeps } from '../video/renderJob';
import type { VideoSupport } from '../video/support';
import { downloadBlob } from './download';
import { DownloadIcon } from './icons';

export type ExportFormat = 'video' | 'subtitles' | 'storyboard-json';
export type SubtitleFormat = 'srt' | 'vtt';

export interface ExportPanelProps {
  /** The edited (version 1.1) storyboard to export. */
  storyboard: Storyboard;
  /** Selected Aspect_Ratio; used for the info line and the video. */
  ratio: AspectRatioId;
  videoSupport: VideoSupport;
  format: ExportFormat;
  onFormatChange(format: ExportFormat): void;
  subtitleFormat: SubtitleFormat;
  onSubtitleFormatChange(format: SubtitleFormat): void;
  /** Owned by App via `renderStatusReducer`. */
  renderStatus: RenderStatus;
  dispatchRender(action: RenderStatusAction): void;
  /** Called right before a render job starts (App pauses playback here). */
  onRenderStart?(): void;
  /** Render dependencies. Defaults to the real browser deps, created when a render starts. */
  renderDeps?: RenderDeps;
  /** Measurer for the default browser deps, so video line breaks match the Player. */
  measure?: MeasureText;
  /** Validator run on the serialized storyboard. Injectable so tests can stub errors. */
  validate?: (value: unknown) => ValidationError[];
  /** Clock for the Export_Timestamp. Defaults to the current time. */
  now?: () => Date;
}

interface FormatOption {
  id: ExportFormat;
  label: string;
  desc: string;
}

const FORMAT_OPTIONS: readonly FormatOption[] = [
  { id: 'video', label: 'Video', desc: 'A ready-to-post video of your scenes (no sound)' },
  {
    id: 'subtitles',
    label: 'Subtitles',
    desc: 'Captions to import into CapCut / 剪映, Premiere Pro, DaVinci Resolve, or YouTube',
  },
  { id: 'storyboard-json', label: 'Storyboard (JSON)', desc: 'Scene data for developers and other tools' },
];

const SUBTITLE_OPTIONS: readonly { id: SubtitleFormat; label: string }[] = [
  { id: 'srt', label: 'SRT (works almost everywhere)' },
  { id: 'vtt', label: 'WebVTT (web players and YouTube)' },
];

const DOWNLOAD_LABEL: Readonly<Record<ExportFormat, string>> = {
  video: 'Download video',
  subtitles: 'Download subtitles',
  'storyboard-json': 'Download storyboard',
};

export const UNSUPPORTED_MESSAGE =
  "Video export isn't supported in this browser. Try a recent version of Chrome, Edge, Firefox, or Safari. Subtitles and storyboard downloads still work.";
export const RENDERING_MESSAGE =
  'Keep this tab open while the video renders. It takes about as long as the video itself.';
export const WEBM_MESSAGE =
  'Your browser saved this video as WebM. Most editors open it; to post on Instagram or TikTok, convert it to MP4 first.';
export const HIDDEN_MESSAGE =
  'Video export stopped because the tab was hidden. Keep the tab visible and try again.';
export const FAILED_MESSAGE =
  'Video export failed. Try again, or use a recent version of Chrome, Edge, Firefox, or Safari.';

const NOTICES: Readonly<
  Record<Exclude<RenderNotice, null>, { tone: 'info' | 'warning' | 'error'; title: string; text: string }>
> = {
  webm: { tone: 'info', title: 'Video saved as WebM', text: WEBM_MESSAGE },
  hidden: { tone: 'warning', title: 'Video export stopped', text: HIDDEN_MESSAGE },
  failed: { tone: 'error', title: 'Video export failed', text: FAILED_MESSAGE },
};

const SUBTITLE_MIME: Readonly<Record<SubtitleFormat, string>> = {
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
};

export function ExportPanel({
  storyboard,
  ratio,
  videoSupport,
  format,
  onFormatChange,
  subtitleFormat,
  onSubtitleFormatChange,
  renderStatus,
  dispatchRender,
  onRenderStart,
  renderDeps,
  measure,
  validate = validateStoryboard,
  now = () => new Date(),
}: ExportPanelProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const baseId = useId();

  // Abort a running job when the panel unmounts.
  useEffect(
    () => () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    },
    [],
  );

  const rendering = renderStatus.phase === 'rendering';
  const videoAvailable = videoSupport.supported;
  const effectiveFormat: ExportFormat = format === 'video' && !videoAvailable ? 'subtitles' : format;
  const empty = storyboard.sceneCount === 0 || storyboard.scenes.length === 0;
  const downloadDisabled = empty || rendering;

  const startVideo = (timestamp: Date) => {
    if (!videoAvailable) return;
    const deps = renderDeps ?? createBrowserRenderDeps(measure ? { measure } : {});
    const controller = new AbortController();
    controllerRef.current = controller;
    const jobRatio = ratio;
    onRenderStart?.();
    dispatchRender({ type: 'start', sceneTotal: storyboard.scenes.length });
    void renderVideo({ storyboard, ratio: jobRatio }, deps, {
      signal: controller.signal,
      onProgress: (progress) => {
        if (!controller.signal.aborted) dispatchRender({ type: 'progress', progress });
      },
    }).then((outcome) => {
      if (controllerRef.current === controller) controllerRef.current = null;
      switch (outcome.kind) {
        case 'completed':
          try {
            downloadBlob(outcome.blob, formatVideoFilename(jobRatio, outcome.container, timestamp));
            dispatchRender({ type: 'completed', container: outcome.container });
          } catch {
            dispatchRender({ type: 'failed' });
          }
          break;
        case 'cancelled':
          dispatchRender({ type: 'cancelled', reason: outcome.reason });
          break;
        case 'failed':
          dispatchRender({ type: 'failed' });
          break;
      }
    });
  };

  const handleDownload = () => {
    if (downloadDisabled) return;
    const timestamp = now();
    const json = serializeStoryboard(storyboard);
    const parsed = parseStoryboard(json);
    const found: ValidationError[] = parsed.ok
      ? validate(parsed.value)
      : [{ path: '$', message: parsed.error }];
    if (found.length > 0) {
      setErrors(found);
      return;
    }
    setErrors([]);

    switch (effectiveFormat) {
      case 'storyboard-json':
        downloadBlob(new Blob([json], { type: 'application/json' }), formatExportFilename(timestamp));
        break;
      case 'subtitles': {
        const cues = buildCues(storyboard);
        const text = subtitleFormat === 'srt' ? formatSrt(cues) : formatVtt(cues);
        downloadBlob(
          new Blob([text], { type: SUBTITLE_MIME[subtitleFormat] }),
          formatSubtitleFilename(timestamp, subtitleFormat),
        );
        break;
      }
      case 'video':
        startVideo(timestamp);
        break;
    }
  };

  const handleCancel = () => {
    controllerRef.current?.abort();
  };

  const handleFormatChange = (next: ExportFormat) => {
    setErrors([]);
    onFormatChange(next);
  };

  const notice = renderStatus.phase === 'idle' && renderStatus.notice ? NOTICES[renderStatus.notice] : null;
  const ratioLabel = getAspectRatio(ratio).label;
  const seconds = videoLengthSeconds(totalDuration(storyboard.scenes.map((s) => s.durationMs)));

  return (
    <div className="sb-export-panel">
      <fieldset className="sb-format" disabled={rendering}>
        <legend className="sb-format__legend">What do you want to download?</legend>
        <div className="sb-format__options">
          {FORMAT_OPTIONS.map((option) => {
            const checked = effectiveFormat === option.id;
            const optionDisabled = option.id === 'video' && !videoAvailable;
            const labelId = `${baseId}-format-${option.id}-label`;
            const descId = `${baseId}-format-${option.id}-desc`;
            const classes = [
              'sb-format__option',
              checked ? 'sb-format__option--checked' : '',
              optionDisabled ? 'sb-format__option--disabled' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <label key={option.id} className={classes}>
                <input
                  type="radio"
                  className="sb-format__input sb-visually-hidden"
                  name={`${baseId}-format`}
                  value={option.id}
                  checked={checked}
                  disabled={optionDisabled}
                  aria-labelledby={labelId}
                  aria-describedby={descId}
                  onChange={() => handleFormatChange(option.id)}
                />
                <span className="sb-format__text">
                  <span id={labelId} className="sb-format__label">
                    {option.label}
                  </span>
                  <span id={descId} className="sb-format__desc">
                    {option.desc}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {!videoAvailable && <p className="sb-export-panel__unsupported">{UNSUPPORTED_MESSAGE}</p>}
      </fieldset>

      {effectiveFormat === 'subtitles' && (
        <fieldset className="sb-format__sub" disabled={rendering}>
          <legend className="sb-format__sub-legend">Subtitle file type</legend>
          {SUBTITLE_OPTIONS.map((option) => {
            const checked = subtitleFormat === option.id;
            return (
              <label
                key={option.id}
                className={`sb-format__sub-option${checked ? ' sb-format__sub-option--checked' : ''}`}
              >
                <input
                  type="radio"
                  className="sb-format__sub-input sb-visually-hidden"
                  name={`${baseId}-subtitle`}
                  value={option.id}
                  checked={checked}
                  onChange={() => onSubtitleFormatChange(option.id)}
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
      )}

      {empty ? (
        <p className="sb-export-panel__info">Add some text first. There is nothing to download yet.</p>
      ) : (
        effectiveFormat === 'video' && (
          <p className="sb-export-panel__info">
            <strong>{ratioLabel}</strong> · {seconds} seconds
          </p>
        )
      )}

      <div className="sb-export-panel__actions">
        <button
          type="button"
          className="sb-button sb-button--primary sb-button--large sb-export-panel__download"
          onClick={handleDownload}
          disabled={downloadDisabled}
        >
          <DownloadIcon />
          {DOWNLOAD_LABEL[effectiveFormat]}
        </button>
      </div>

      {renderStatus.phase === 'rendering' && (
        <div className="sb-render">
          <progress
            className="sb-render__bar"
            max={100}
            value={renderStatus.progress.percent}
            aria-label="Video export progress"
          />
          <div className="sb-render__meta" aria-live="polite">
            <span className="sb-render__percent">{renderStatus.progress.percent}%</span>
            <span className="sb-render__scene">
              Scene {renderStatus.progress.sceneNumber} / {renderStatus.progress.sceneTotal}
            </span>
          </div>
          <p className="sb-render__message">{RENDERING_MESSAGE}</p>
          <button type="button" className="sb-button sb-button--soft sb-render__cancel" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}

      {notice && (
        <div
          className={`sb-notice sb-notice--${notice.tone}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          <p className="sb-notice__title">{notice.title}</p>
          <p className="sb-notice__text">{notice.text}</p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="sb-export__problem" role="alert" aria-label="Export validation errors">
          <p className="sb-export__problem-title">The file was not saved because the storyboard has problems:</p>
          <ul className="sb-export__errors">
            {errors.map((error, i) => (
              <li key={`${error.path}-${i}`} className="sb-export__error">
                <span className="sb-export__error-path">{error.path}</span>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ExportPanel;
