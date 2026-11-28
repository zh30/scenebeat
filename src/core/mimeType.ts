/**
 * Recording MIME type selection for the video renderer.
 *
 * Pure: the browser's `MediaRecorder.isTypeSupported` is passed in, so this
 * module has no DOM or browser dependency.
 */

/** The recorded file format. */
export type VideoContainer = 'mp4' | 'webm';

export interface MimeCandidate {
  mimeType: string;
  container: VideoContainer;
}

/**
 * Candidates in preference order: video-only H.264 MP4 types first, then WebM.
 * No candidate requests an audio codec (no `mp4a`, no `opus`), so recordings
 * have no audio track. Plain `video/mp4` is deliberately absent because a
 * browser may record a non-H.264 codec inside MP4 for it.
 */
export const MIME_CANDIDATES: readonly MimeCandidate[] = Object.freeze([
  { mimeType: 'video/mp4;codecs=avc1.640028', container: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1.4D401F', container: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1.42E01E', container: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1', container: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', container: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', container: 'webm' },
  { mimeType: 'video/webm', container: 'webm' },
] as const satisfies readonly MimeCandidate[]);

/**
 * Returns the first candidate the predicate accepts, or null when none is
 * accepted. A predicate that throws counts as false for that candidate.
 */
export function pickMimeType(
  isTypeSupported: (type: string) => boolean,
): { mimeType: string; container: VideoContainer } | null {
  for (const candidate of MIME_CANDIDATES) {
    let supported = false;
    try {
      supported = isTypeSupported(candidate.mimeType) === true;
    } catch {
      supported = false;
    }
    if (supported) {
      return { mimeType: candidate.mimeType, container: candidate.container };
    }
  }
  return null;
}
