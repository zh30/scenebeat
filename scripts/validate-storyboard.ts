/**
 * Validate a storyboard JSON file against the SceneBeat storyboard structure.
 *
 * Usage:
 *   pnpm exec tsx scripts/validate-storyboard.ts <file>
 *   echo '{"filePath":"x.storyboard.json"}' | pnpm exec tsx scripts/validate-storyboard.ts
 *
 * The file path is taken from the first non-empty argument. If there is none,
 * the script reads a JSON object from stdin (the Kiro hook payload) and looks
 * for a file path in common fields (`filePath`, `file_path`, `path`, `file`,
 * also nested under `tool_input`, `input`, `event`, or `data`). It does not
 * wait on an interactive terminal, and gives up on stdin after a short timeout.
 *
 * Output: one `path: message` line per validation error, or `<file>: valid`.
 *
 * Exit codes:
 *   0  the file is a valid storyboard
 *   1  validation errors, malformed JSON, or the file cannot be read
 *   2  usage error: no file path from argv or stdin
 */
import { readFileSync } from 'node:fs';
import { parseStoryboard } from '../src/core/serialize';
import { validateStoryboard } from '../src/core/validate';

const USAGE = 'Usage: pnpm exec tsx scripts/validate-storyboard.ts <file.storyboard.json>';
const STDIN_TIMEOUT_MS = 2000;

const PATH_KEYS = ['filePath', 'file_path', 'path', 'file', 'filename'] as const;
const NESTED_KEYS = ['tool_input', 'toolInput', 'input', 'event', 'data'] as const;

function findPath(value: unknown, depth = 0): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || depth > 2) {
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  for (const key of PATH_KEYS) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  for (const key of NESTED_KEYS) {
    const found = findPath(obj[key], depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Reads all of stdin, or returns '' for a TTY, empty input, or a timeout. */
function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return Promise.resolve('');
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const finish = (): void => {
      clearTimeout(timer);
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const timer = setTimeout(finish, STDIN_TIMEOUT_MS);
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}

async function resolveFilePath(): Promise<string | undefined> {
  const arg = process.argv.slice(2).find((a) => a.trim() !== '');
  if (arg !== undefined) return arg.trim();
  const envFile = process.env.FILE;
  if (envFile !== undefined && envFile.trim() !== '') return envFile.trim();

  const input = (await readStdin()).trim();
  if (input === '') return undefined;
  try {
    return findPath(JSON.parse(input));
  } catch {
    return undefined;
  }
}

async function main(): Promise<number> {
  const file = await resolveFilePath();
  if (file === undefined) {
    console.error(USAGE);
    return 2;
  }

  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`${file}: cannot read file: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }

  const parsed = parseStoryboard(text);
  if (!parsed.ok) {
    console.error(`$: ${parsed.error}`);
    console.error(`${file}: invalid storyboard`);
    return 1;
  }

  const errors = validateStoryboard(parsed.value);
  if (errors.length > 0) {
    for (const { path, message } of errors) console.error(`${path}: ${message}`);
    console.error(`${file}: ${errors.length} validation error(s)`);
    return 1;
  }

  console.log(`${file}: valid`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  },
);
