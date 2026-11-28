import { extractKeywords, matchBigNumber, matchQuote, matchTimeline } from './assignTemplate';
import type { SceneDataByTemplate, SceneTemplate } from './types';

const LEADING_LABEL_MAX_CODE_POINTS = 12;
const EDGE_PUNCTUATION_RE = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;
const FIRST_TOKEN_RE = /\S+/u;

/**
 * Leading_Label: the first whitespace-delimited token of the trimmed text with
 * leading and trailing punctuation and symbols removed, cut to its first 12 code
 * points. When removal leaves nothing, the first 12 code points of the trimmed text.
 */
export function leadingLabel(text: string): string {
  const t = text.trim();
  const token = FIRST_TOKEN_RE.exec(t)?.[0] ?? '';
  const stripped = token.replace(EDGE_PUNCTUATION_RE, '');
  const base = stripped.length > 0 ? stripped : t;
  return [...base].slice(0, LEADING_LABEL_MAX_CODE_POINTS).join('');
}

/**
 * Template data for a forced or automatic template. Uses the Template_Assigner
 * matchers on `text.trim()`, falling back to the trimmed text (quote) or the
 * Leading_Label (timeline, big-number) when the matcher finds nothing.
 * Precondition: `text.trim() !== ''`. Pure and deterministic.
 */
export function deriveData<T extends SceneTemplate>(template: T, text: string): SceneDataByTemplate[T] {
  const t = text.trim();
  const data: SceneDataByTemplate[SceneTemplate] = (() => {
    switch (template) {
      case 'quote':
        return { quote: matchQuote(t) ?? t };
      case 'timeline':
        return { label: matchTimeline(t) ?? leadingLabel(t) };
      case 'big-number':
        return { value: matchBigNumber(t) ?? leadingLabel(t) };
      case 'keyword-highlight':
        return { keywords: extractKeywords(t) };
      default: {
        const unreachable: never = template as never;
        throw new Error(`Unknown template: ${String(unreachable)}`);
      }
    }
  })();
  return data as SceneDataByTemplate[T];
}
