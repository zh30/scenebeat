import { getAspectRatio, type AspectRatioId, type RatioTag } from './aspectRatio';
import type { VideoContainer } from './mimeType';

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** The Export_Timestamp tag `YYYYMMDD-HHmmss`, in the date's local time. */
export function formatTimestampTag(d: Date): string {
  const date = `${pad(d.getFullYear(), 4)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${date}-${time}`;
}

/**
 * Formats the export filename using the date's local time:
 * `scenebeat-storyboard-YYYYMMDD-HHmmss.json`.
 */
export function formatExportFilename(d: Date): string {
  return `scenebeat-storyboard-${formatTimestampTag(d)}.json`;
}

/** `scenebeat-subtitles-YYYYMMDD-HHmmss.<srt|vtt>` (Requirements 12.1, 12.2). */
export function formatSubtitleFilename(d: Date, ext: 'srt' | 'vtt'): string {
  return `scenebeat-subtitles-${formatTimestampTag(d)}.${ext}`;
}

/** `scenebeat-video-<Ratio_Tag>-YYYYMMDD-HHmmss.<mp4|webm>` (Requirement 14.3). */
export function formatVideoFilename(ratio: AspectRatioId, container: VideoContainer, d: Date): string {
  const tag: RatioTag = getAspectRatio(ratio).tag;
  return `scenebeat-video-${tag}-${formatTimestampTag(d)}.${container}`;
}
