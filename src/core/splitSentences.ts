/**
 * Sentence splitting for mixed Chinese and English transcripts.
 *
 * Single left-to-right scan:
 * - Line breaks (`\n`, `\r`) end the current segment.
 * - A run of terminators (`. ! ?` and `。 ！ ？ ； …`) plus any directly
 *   following closers ends the current segment and stays attached to it.
 * - A `.` between two ASCII digits (e.g. `3.5`) is not a terminator.
 * - Trailing text without a terminator becomes the final segment.
 * - Segments are trimmed; empty segments are dropped.
 */

const TERMINATORS = new Set(['.', '!', '?', '。', '！', '？', '；', '…']);
const CLOSERS = new Set(['"', "'", '”', '’', '」', '』', ')', '）']);

function isAsciiDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

function isLineBreak(ch: string): boolean {
  return ch === '\n' || ch === '\r';
}

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  let i = 0;
  const n = text.length;

  const emit = (end: number): void => {
    const segment = text.slice(start, end).trim();
    if (segment.length > 0) sentences.push(segment);
  };

  while (i < n) {
    const ch = text[i];

    if (isLineBreak(ch)) {
      emit(i);
      i += 1;
      start = i;
      continue;
    }

    if (TERMINATORS.has(ch)) {
      if (ch === '.' && isAsciiDigit(text[i - 1]) && isAsciiDigit(text[i + 1])) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < n && TERMINATORS.has(text[j])) j += 1;
      while (j < n && CLOSERS.has(text[j])) j += 1;
      emit(j);
      i = j;
      start = j;
      continue;
    }

    i += 1;
  }

  emit(n);
  return sentences;
}
