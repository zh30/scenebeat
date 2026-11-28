import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type BuildFiles,
  builtManifestUrls,
  checkBuild,
  cssUrls,
  htmlUrls,
  isRootAbsolute,
  main,
  precacheUrls,
  readBuildDir,
} from '../scripts/check-pwa-build';

const MANIFEST = {
  id: './',
  start_url: './',
  scope: './',
  icons: [{ src: './icons/icon-192.png' }, { src: './icons/icon-512.png' }],
  screenshots: [{ src: './screenshots/wide.png' }],
  shortcuts: [{ url: './?action=new', icons: [{ src: './icons/icon-192.png' }] }],
  share_target: { action: './', method: 'GET' },
};

const INDEX_HTML =
  '<!doctype html><html><head>' +
  '<link rel="icon" href="./favicon.svg">' +
  '<link rel="manifest" href="./manifest.webmanifest">' +
  '<script type="module" src="./assets/index-abc.js"></script>' +
  '<link rel="stylesheet" href="./assets/index-abc.css">' +
  '</head><body><a href="#main">Skip</a></body></html>';

const SW_JS =
  'define(["./workbox-1234"],function(s){s.precacheAndRoute([' +
  '{url:"index.html",revision:"a"},' +
  '{url:"assets/index-abc.js",revision:null},' +
  '{url:"assets/index-abc.css",revision:null},' +
  '{url:"icons/icon-192.png",revision:"b"},' +
  '{url:"icons/icon-512.png",revision:"c"},' +
  '{url:"manifest.webmanifest",revision:"d"}' +
  '],{});s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("index.html")))});';

function passingBuild(): BuildFiles {
  return new Map<string, string | Uint8Array>([
    ['index.html', INDEX_HTML],
    ['manifest.webmanifest', JSON.stringify(MANIFEST)],
    ['sw.js', SW_JS],
    ['workbox-1234.js', 'self.workbox=1;'],
    ['assets/index-abc.js', 'console.log(1);'],
    ['assets/index-abc.css', 'body{background:url(./bg.png)}'],
    ['icons/icon-192.png', new Uint8Array([0x89, 0x50])],
    ['icons/icon-512.png', new Uint8Array([0x89, 0x50])],
    ['favicon.svg', '<svg/>'],
  ]);
}

function withFile(path: string, content: string | Uint8Array): BuildFiles {
  const files = passingBuild();
  files.set(path, content);
  return files;
}

function without(path: string): BuildFiles {
  const files = passingBuild();
  files.delete(path);
  return files;
}

describe('checkBuild', () => {
  it('passes a complete build with relative URLs', () => {
    expect(checkBuild(passingBuild())).toEqual([]);
  });

  it('accepts text given as bytes', () => {
    const files = passingBuild();
    for (const [k, v] of files) if (typeof v === 'string') files.set(k, new TextEncoder().encode(v));
    expect(checkBuild(files)).toEqual([]);
  });

  it('reports a missing sw.js', () => {
    expect(checkBuild(without('sw.js'))).toContain('missing required file: sw.js');
  });

  it('reports a missing workbox runtime', () => {
    expect(checkBuild(without('workbox-1234.js'))).toEqual(['missing required file: workbox-*.js']);
  });

  it('reports missing index.html and manifest', () => {
    const files = without('index.html');
    files.delete('manifest.webmanifest');
    const problems = checkBuild(files);
    expect(problems).toContain('missing required file: index.html');
    expect(problems).toContain('missing required file: manifest.webmanifest');
  });

  it('reports an unprecached bundle', () => {
    expect(checkBuild(withFile('assets/extra-def.js', 'x'))).toEqual([
      'not precached by sw.js: assets/extra-def.js',
    ]);
  });

  it('reports an unprecached icon', () => {
    expect(checkBuild(withFile('icons/apple-touch-icon-180.png', new Uint8Array([1])))).toEqual([
      'not precached by sw.js: icons/apple-touch-icon-180.png',
    ]);
  });

  it('accepts precache URLs written with a leading ./', () => {
    const files = withFile('sw.js', SW_JS.replace(/url:"/g, 'url:"./'));
    expect(checkBuild(files)).toEqual([]);
  });

  it('reports an sw.js without precache entries', () => {
    const problems = checkBuild(withFile('sw.js', 'self.x=1;'));
    expect(problems).toContain('sw.js: no precache entries found');
  });

  it('reports a root-absolute precache URL', () => {
    const files = withFile('sw.js', SW_JS.replace('url:"index.html"', 'url:"/index.html"'));
    expect(checkBuild(files)).toEqual([
      'not precached by sw.js: index.html',
      'sw.js: root-absolute precache URL: /index.html',
    ]);
  });

  it('reports a root-absolute src in index.html', () => {
    const files = withFile('index.html', INDEX_HTML.replace('src="./assets/index-abc.js"', 'src="/assets/index-abc.js"'));
    expect(checkBuild(files)).toEqual(['index.html: root-absolute URL: /assets/index-abc.js']);
  });

  it('reports url(/…) in CSS', () => {
    const files = withFile('assets/index-abc.css', 'body{background:url("/bg.png")}');
    expect(checkBuild(files)).toEqual(['assets/index-abc.css: root-absolute url(): /bg.png']);
  });

  it('reports a root-absolute manifest URL', () => {
    const files = withFile('manifest.webmanifest', JSON.stringify({ ...MANIFEST, start_url: '/' }));
    expect(checkBuild(files)).toEqual(['manifest.webmanifest: root-absolute URL: /']);
  });

  it('reports a root-absolute shortcut icon in the manifest', () => {
    const m = { ...MANIFEST, shortcuts: [{ url: './?action=new', icons: [{ src: '/icons/icon-192.png' }] }] };
    expect(checkBuild(withFile('manifest.webmanifest', JSON.stringify(m)))).toEqual([
      'manifest.webmanifest: root-absolute URL: /icons/icon-192.png',
    ]);
  });

  it('reports an invalid manifest without throwing', () => {
    expect(checkBuild(withFile('manifest.webmanifest', '{not json'))).toEqual([
      'manifest.webmanifest: not valid JSON',
    ]);
  });
});

describe('URL extractors', () => {
  it('isRootAbsolute', () => {
    expect(isRootAbsolute('/x')).toBe(true);
    expect(isRootAbsolute('//cdn.test/x')).toBe(true);
    expect(isRootAbsolute(' /x')).toBe(true);
    expect(isRootAbsolute('./x')).toBe(false);
    expect(isRootAbsolute('x')).toBe(false);
    expect(isRootAbsolute('https://a.test/x')).toBe(false);
    expect(isRootAbsolute('#top')).toBe(false);
    expect(isRootAbsolute('data:image/svg+xml,<svg/>')).toBe(false);
  });

  it('precacheUrls reads every url entry', () => {
    expect(precacheUrls('[{url:"a.js",revision:null},{ url : \'b.css\' }]')).toEqual(['a.js', 'b.css']);
  });

  it('htmlUrls reads quoted and unquoted src and href', () => {
    expect(htmlUrls('<img src="a.png"><a href=\'b\'></a><link HREF=/c.css>')).toEqual(['a.png', 'b', '/c.css']);
  });

  it('cssUrls reads quoted and unquoted url()', () => {
    expect(cssUrls('a{b:url(x.png)}c{d:url( "/y.png" )}e{f:url(\'z\')}')).toEqual(['x.png', '/y.png', 'z']);
  });

  it('builtManifestUrls reads every URL field and tolerates bad shapes', () => {
    expect(builtManifestUrls(MANIFEST)).toEqual([
      './',
      './',
      './',
      './icons/icon-192.png',
      './icons/icon-512.png',
      './screenshots/wide.png',
      './?action=new',
      './icons/icon-192.png',
      './',
    ]);
    expect(builtManifestUrls(null)).toEqual([]);
    expect(builtManifestUrls([1])).toEqual([]);
    expect(builtManifestUrls({ icons: 'x', shortcuts: [null, { icons: 5 }], share_target: null })).toEqual([]);
  });
});

describe('readBuildDir and main', () => {
  let dir: string | null = null;

  afterEach(() => {
    if (dir !== null) rmSync(dir, { recursive: true, force: true });
    dir = null;
    vi.restoreAllMocks();
  });

  function writeBuild(files: BuildFiles): string {
    dir = mkdtempSync(join(tmpdir(), 'scenebeat-check-'));
    for (const [path, content] of files) {
      const full = join(dir, ...path.split('/'));
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, content);
    }
    return dir;
  }

  it('readBuildDir maps nested files with forward slashes', () => {
    const d = writeBuild(passingBuild());
    const files = readBuildDir(d);
    expect([...files.keys()].sort()).toEqual([...passingBuild().keys()].sort());
    expect(checkBuild(files)).toEqual([]);
  });

  it('main returns 0 for a passing build', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(main([writeBuild(passingBuild())])).toBe(0);
    expect(log).toHaveBeenCalled();
  });

  it('main returns 1 and prints problems for a failing build', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(main([writeBuild(without('sw.js'))])).toBe(1);
    expect(err.mock.calls.flat().join('\n')).toContain('missing required file: sw.js');
  });

  it('main returns 1 when the directory is missing', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(main([join(tmpdir(), 'scenebeat-does-not-exist-' + process.pid)])).toBe(1);
    expect(err).toHaveBeenCalled();
  });
});
