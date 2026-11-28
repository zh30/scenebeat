import type { Storyboard } from './types';

/** One subtitle cue with integer millisecond times. */
export interface SubtitleCue {
  number: number;
  startMs: number;
  endMs: number;
  text: string;
}

/** `srt` uses `,` before milliseconds; `vtt` uses `.`. */
export type TimestampStyle = 'srt' | 'vtt';

export type SubtitleParseResult = { ok: true; cues: SubtitleCue[] } | { ok: false; error: string };

const VTT_HEADER = 'WEBVTT\n\n';
const ARROW = ' --> ';

/** One cue per scene, back to back, starting at 0 (Requirement 10). */
export function buildCues(sb: Storyboard): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let start = 0;
  sb.scenes.forEach((scene, i) => {
    const end = start + scene.durationMs;
    cues.push({ number: i + 1, startMs: start, endMs: end, text: scene.text });
    start = end;
  });
  return cues;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** `HH:MM:SS,mmm` (SRT) or `HH:MM:SS.mmm` (VTT); hours have at least two digits. */
export function formatTimestamp(ms: number, style: TimestampStyle): string {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const mmm = total % 1000;
  const sep = style === 'srt' ? ',' : '.';
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${sep}${pad(mmm, 3)}`;
}

const TIMESTAMP_RE: Record<TimestampStyle, RegExp> = {
  srt: /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/,
  vtt: /^(\d{2,}):([0-5]\d):([0-5]\d)\.(\d{3})$/,
};

/** Inverse of `formatTimestamp`; null when `s` is not a timestamp of the given style. */
export function parseTimestamp(s: string, style: TimestampStyle): number | null {
  const m = TIMESTAMP_RE[style].exec(s);
  if (!m) return null;
  return Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1000 + Number(m[4]);
}

/** Escapes `&`, `<`, `>` for WebVTT cue text. */
export function escapeVtt(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inverse of `escapeVtt`: `&lt;` and `&gt;` first, `&amp;` last. */
export function unescapeVtt(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Replaces CR and LF with spaces so a cue text never breaks the block structure. */
function singleLine(text: string): string {
  return text.replace(/\r\n|\r|\n/g, ' ');
}

function formatBlocks(cues: readonly SubtitleCue[], style: TimestampStyle): string {
  return cues
    .map((cue) => {
      const text = style === 'vtt' ? escapeVtt(singleLine(cue.text)) : singleLine(cue.text);
      const timing = `${formatTimestamp(cue.startMs, style)}${ARROW}${formatTimestamp(cue.endMs, style)}`;
      return `${cue.number}\n${timing}\n${text}\n\n`;
    })
    .join('');
}

/** SRT text with LF line endings; empty list gives ''. */
export function formatSrt(cues: readonly SubtitleCue[]): string {
  return formatBlocks(cues, 'srt');
}

/** WebVTT text with LF line endings; empty list gives 'WEBVTT\n\n'. */
export function formatVtt(cues: readonly SubtitleCue[]): string {
  return VTT_HEADER + formatBlocks(cues, 'vtt');
}

/** Parses SRT or WebVTT text in the shape SceneBeat writes. Never throws. */
export function parseSubtitles(text: string, format: 'srt' | 'vtt'): SubtitleParseResult {
  try {
    let body = text;
    if (format === 'vtt') {
      if (!body.startsWith(VTT_HEADER)) {
        return { ok: false, error: 'Missing "WEBVTT" header followed by a blank line' };
      }
      body = body.slice(VTT_HEADER.length);
    }
    if (body === '') return { ok: true, cues: [] };
    if (!body.endsWith('\n\n')) {
      return { ok: false, error: 'Subtitle text must end with a blank line' };
    }
    const blocks = body.slice(0, -2).split('\n\n');
    const cues: SubtitleCue[] = [];
    for (let b = 0; b < blocks.length; b++) {
      const label = `Block ${b + 1}`;
      const lines = blocks[b].split('\n');
      if (lines.length !== 3) {
        return { ok: false, error: `${label}: expected 3 lines, found ${lines.length}` };
      }
      const [numLine, timingLine, textLine] = lines;
      if (!/^\d+$/.test(numLine)) {
        return { ok: false, error: `${label}: invalid cue number "${numLine}"` };
      }
      const parts = timingLine.split(ARROW);
      if (parts.length !== 2) {
        return { ok: false, error: `${label}: invalid timing line "${timingLine}"` };
      }
      const startMs = parseTimestamp(parts[0], format);
      const endMs = parseTimestamp(parts[1], format);
      if (startMs === null || endMs === null) {
        return { ok: false, error: `${label}: invalid timestamp in "${timingLine}"` };
      }
      cues.push({
        number: Number(numLine),
        startMs,
        endMs,
        text: format === 'vtt' ? unescapeVtt(textLine) : textLine,
      });
    }
    return { ok: true, cues };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
