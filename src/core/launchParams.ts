// Launch parameters: app shortcuts (`?action=new|sample`) and the Web Share
// Target (`?title=&text=&url=`). Pure: works on query strings only, never
// touches `location` or `history`, and never throws.

export type LaunchIntent =
  | { kind: 'none' }
  | { kind: 'new-transcript' }
  | { kind: 'load-sample' }
  | { kind: 'share'; transcript: string };

export const LAUNCH_PARAM_NAMES = ['action', 'title', 'text', 'url'] as const;

export type LaunchResolution =
  | { kind: 'noop' }
  | { kind: 'apply'; transcript: string; focusInput: boolean }
  | { kind: 'confirm'; transcript: string; focusInput: boolean };

const NONE: LaunchIntent = { kind: 'none' };
const SHARE_PARAM_NAMES = ['title', 'text', 'url'] as const;

/**
 * Builds the Shared_Transcript (Req 15.3): trimmed text, then the trimmed title
 * prepended and the trimmed url appended, each only when non-empty and not
 * already contained. A line break is added only between two non-empty parts.
 */
export function buildSharedTranscript(title: string, text: string, url: string): string {
  let result = text.trim();
  const t = title.trim();
  if (t !== '' && !result.includes(t)) {
    result = result === '' ? t : `${t}\n${result}`;
  }
  const u = url.trim();
  if (u !== '' && !result.includes(u)) {
    result = result === '' ? u : `${result}\n${u}`;
  }
  return result;
}

/**
 * Parses a query string (with or without the leading `?`) into one Launch_Intent.
 * Share parameters win over `action`; the first value of a repeated parameter is used.
 */
export function parseLaunchParams(search: string): LaunchIntent {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return NONE;
  }
  if (SHARE_PARAM_NAMES.some((name) => params.has(name))) {
    const transcript = buildSharedTranscript(
      params.get('title') ?? '',
      params.get('text') ?? '',
      params.get('url') ?? '',
    );
    return transcript === '' ? NONE : { kind: 'share', transcript };
  }
  switch (params.get('action')) {
    case 'new':
      return { kind: 'new-transcript' };
    case 'sample':
      return { kind: 'load-sample' };
    default:
      return NONE;
  }
}

/** Decides whether an intent applies directly or needs the Replace_Confirmation. */
export function resolveLaunch(
  intent: LaunchIntent,
  currentTranscript: string,
  sampleTranscript: string,
): LaunchResolution {
  let transcript: string;
  let focusInput = false;
  switch (intent.kind) {
    case 'none':
      return { kind: 'noop' };
    case 'new-transcript':
      transcript = '';
      focusInput = true;
      break;
    case 'load-sample':
      transcript = sampleTranscript;
      break;
    case 'share':
      transcript = intent.transcript;
      break;
  }
  const needsConfirm = currentTranscript.trim() !== '' && currentTranscript !== transcript;
  return { kind: needsConfirm ? 'confirm' : 'apply', transcript, focusInput };
}

/** Decoded name of one raw `name=value` segment, decoded the same way URLSearchParams does. */
function segmentName(segment: string): string {
  const eq = segment.indexOf('=');
  const rawName = eq === -1 ? segment : segment.slice(0, eq);
  // URLSearchParams decodes leniently (malformed % sequences are kept as-is).
  const first = new URLSearchParams(`${rawName}=`).keys().next();
  return first.done ? '' : first.value;
}

/**
 * Returns `search` without the `action`, `title`, `text`, and `url` parameters.
 * Other parameters keep their original order and raw encoding. The result starts
 * with `?` when any parameter remains, and is `''` otherwise.
 */
export function stripLaunchParams(search: string): string {
  const body = search.startsWith('?') ? search.slice(1) : search;
  const names: readonly string[] = LAUNCH_PARAM_NAMES;
  const kept = body
    .split('&')
    .filter((segment) => segment !== '' && !names.includes(segmentName(segment)));
  return kept.length === 0 ? '' : `?${kept.join('&')}`;
}
