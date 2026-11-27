export const MIN_DURATION_MS = 2000;
export const MAX_DURATION_MS = 8000;

const ENGLISH_WORD = /[A-Za-z0-9'’-]+/g;
const HAN_CHAR = /\p{Script=Han}/gu;

/** Counts English words (runs of [A-Za-z0-9'’-]) and Han characters. */
export function readingLength(sentence: string): {
  englishWords: number;
  chineseChars: number;
} {
  const englishWords = sentence.match(ENGLISH_WORD)?.length ?? 0;
  const chineseChars = sentence.match(HAN_CHAR)?.length ?? 0;
  return { englishWords, chineseChars };
}

/** Display duration in ms: 1000 + 250/word + 200/Han char, clamped to [2000, 8000]. */
export function computeDuration(sentence: string): number {
  const { englishWords, chineseChars } = readingLength(sentence);
  const raw = 1000 + 250 * englishWords + 200 * chineseChars;
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, raw));
}
