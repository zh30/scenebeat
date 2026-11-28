/**
 * Check a finished Production_Build for the PWA App_Shell (Requirement 17.6, 17.7).
 *
 * Usage:
 *   pnpm check:pwa                 (checks dist/)
 *   pnpm exec tsx scripts/check-pwa-build.ts <dir>
 *
 * Checks:
 *   1. Required files: index.html, manifest.webmanifest, sw.js, at least one workbox-*.js.
 *   2. Precache list: every .html, .js, .css file (except sw.js and workbox-*.js)
 *      and every file under icons/ appears as a quoted `url:` entry of the
 *      precache list in sw.js.
 *   3. No root-absolute URLs: index.html src/href attributes, CSS url(/…),
 *      built manifest URLs, and precache URLs in sw.js.
 *
 * Exit codes: 0 when the build passes, 1 when any problem is found or the
 * directory cannot be read.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type BuildFiles = Map<string, string | Uint8Array>;

const decoder = new TextDecoder();

function asText(content: string | Uint8Array): string {
  return typeof content === 'string' ? content : decoder.decode(content);
}

function baseName(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

function isWorkboxRuntime(path: string): boolean {
  return /^workbox-[^/]*\.js$/.test(path);
}

/** True for `/x` and `//host/x`; false for relative URLs, schemes, and fragments. */
export function isRootAbsolute(url: string): boolean {
  return url.trim().startsWith('/');
}

/** Normalises a precache or file URL for comparison: drops a leading `./`. */
function normalise(url: string): string {
  return url.replace(/^(\.\/)+/, '');
}

/** Every `url:"…"` entry in the precache manifest inlined into sw.js. */
export function precacheUrls(sw: string): string[] {
  const urls: string[] = [];
  const re = /\burl\s*:\s*(["'`])([^"'`]*)\1/g;
  for (let m = re.exec(sw); m !== null; m = re.exec(sw)) urls.push(m[2]);
  return urls;
}

/** `src` and `href` attribute values in an HTML document. */
export function htmlUrls(html: string): string[] {
  const urls: string[] = [];
  const re = /\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) urls.push(m[1] ?? m[2] ?? m[3] ?? '');
  return urls;
}

/** `url(…)` values in a stylesheet. */
export function cssUrls(css: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) urls.push(m[1] ?? m[2] ?? m[3] ?? '');
  return urls;
}

function str(v: unknown): string[] {
  return typeof v === 'string' ? [v] : [];
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];
}

/**
 * The URLs of a parsed manifest (same set as `manifestUrls` in src/pwa/manifest.ts),
 * read defensively because the built file is untrusted input.
 */
export function builtManifestUrls(m: unknown): string[] {
  if (typeof m !== 'object' || m === null || Array.isArray(m)) return [];
  const o = m as Record<string, unknown>;
  const share = typeof o.share_target === 'object' && o.share_target !== null ? (o.share_target as Record<string, unknown>) : {};
  return [
    ...str(o.id),
    ...str(o.start_url),
    ...str(o.scope),
    ...arr(o.icons).flatMap((i) => str(i.src)),
    ...arr(o.screenshots).flatMap((s) => str(s.src)),
    ...arr(o.shortcuts).flatMap((s) => [...str(s.url), ...arr(s.icons).flatMap((i) => str(i.src))]),
    ...str(share.action),
  ];
}

/**
 * Pure build check. `files` maps paths relative to the build directory
 * (forward slashes, no leading `./`) to their contents. Returns one message
 * per problem; an empty list means the build passes.
 */
export function checkBuild(files: BuildFiles): string[] {
  const problems: string[] = [];
  const paths = [...files.keys()];

  // 1. Required files.
  for (const required of ['index.html', 'manifest.webmanifest', 'sw.js']) {
    if (!files.has(required)) problems.push(`missing required file: ${required}`);
  }
  if (!paths.some(isWorkboxRuntime)) problems.push('missing required file: workbox-*.js');

  // 2. Precache list.
  const sw = files.get('sw.js');
  if (sw !== undefined) {
    const swText = asText(sw);
    const precache = precacheUrls(swText);
    if (precache.length === 0) problems.push('sw.js: no precache entries found');
    const listed = new Set(precache.map(normalise));
    for (const path of paths) {
      if (path === 'sw.js' || isWorkboxRuntime(path)) continue;
      const shell = /\.(html|js|css)$/.test(baseName(path)) || path.startsWith('icons/');
      if (shell && !listed.has(path)) problems.push(`not precached by sw.js: ${path}`);
    }
    // 3c. Precache URLs.
    for (const url of precache) {
      if (isRootAbsolute(url)) problems.push(`sw.js: root-absolute precache URL: ${url}`);
    }
  }

  // 3a. index.html src/href.
  const html = files.get('index.html');
  if (html !== undefined) {
    for (const url of htmlUrls(asText(html))) {
      if (isRootAbsolute(url)) problems.push(`index.html: root-absolute URL: ${url}`);
    }
  }

  // 3b. CSS url(/…).
  for (const [path, content] of files) {
    if (!path.endsWith('.css')) continue;
    for (const url of cssUrls(asText(content))) {
      if (isRootAbsolute(url)) problems.push(`${path}: root-absolute url(): ${url}`);
    }
  }

  // 3d. Manifest URLs.
  const manifest = files.get('manifest.webmanifest');
  if (manifest !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(asText(manifest));
    } catch {
      problems.push('manifest.webmanifest: not valid JSON');
    }
    for (const url of builtManifestUrls(parsed)) {
      if (isRootAbsolute(url)) problems.push(`manifest.webmanifest: root-absolute URL: ${url}`);
    }
  }

  return problems;
}

/** Reads every file under `dir` into a BuildFiles map. Throws when `dir` is unreadable. */
export function readBuildDir(dir: string): BuildFiles {
  const files: BuildFiles = new Map();
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.set(relative(dir, full).split(sep).join('/'), new Uint8Array(readFileSync(full)));
    }
  };
  if (!statSync(dir).isDirectory()) throw new Error('not a directory');
  walk(dir);
  return files;
}

export function main(argv: string[]): number {
  const dir = argv.find((a) => a.trim() !== '') ?? 'dist';
  let files: BuildFiles;
  try {
    files = readBuildDir(dir);
  } catch (e) {
    console.error(`${dir}: cannot read build directory: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  const problems = checkBuild(files);
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    console.error(`${dir}: ${problems.length} PWA build problem(s)`);
    return 1;
  }
  console.log(`${dir}: PWA build OK (${files.size} files checked)`);
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = main(process.argv.slice(2));
