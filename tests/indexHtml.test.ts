import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MANIFEST, THEME_COLOR } from '../src/pwa/manifest';

const root = resolve(__dirname, '..');
const doc = new DOMParser().parseFromString(readFileSync(resolve(root, 'index.html'), 'utf8'), 'text/html');

function metas(name: string): HTMLMetaElement[] {
  return Array.from(doc.querySelectorAll<HTMLMetaElement>('meta[name]')).filter((m) => m.getAttribute('name') === name);
}

function metaContent(name: string): string | null {
  const found = metas(name);
  expect(found, `exactly one <meta name="${name}">`).toHaveLength(1);
  return found[0].getAttribute('content');
}

function links(rel: string): HTMLLinkElement[] {
  return Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel]')).filter((l) =>
    (l.getAttribute('rel') ?? '').split(/\s+/).includes(rel),
  );
}

function isRelative(url: string): boolean {
  return url !== '' && !url.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(url);
}

describe('index.html platform tags (Requirement 3)', () => {
  it('links the SVG favicon with a relative URL to a committed file', () => {
    const icons = links('icon');
    expect(icons).toHaveLength(1);
    expect(icons[0].getAttribute('type')).toBe('image/svg+xml');
    const href = icons[0].getAttribute('href') ?? '';
    expect(href).toBe('./favicon.svg');
    expect(existsSync(resolve(root, 'public', href))).toBe(true);
  });

  it('links the 180x180 Apple touch icon with a relative URL to a committed file', () => {
    const touch = links('apple-touch-icon');
    expect(touch).toHaveLength(1);
    expect(touch[0].getAttribute('sizes')).toBe('180x180');
    const href = touch[0].getAttribute('href') ?? '';
    expect(href).toBe('./icons/apple-touch-icon-180.png');
    expect(existsSync(resolve(root, 'public', href))).toBe(true);
  });

  it('includes the Apple and mobile web app meta tags', () => {
    expect(metaContent('apple-mobile-web-app-capable')).toBe('yes');
    expect(metaContent('mobile-web-app-capable')).toBe('yes');
    expect(metaContent('apple-mobile-web-app-status-bar-style')).toBe('black-translucent');
    expect(metaContent('apple-mobile-web-app-title')).toBe('SceneBeat');
  });

  it('sets theme-color equal to THEME_COLOR and the manifest theme_color', () => {
    expect(metaContent('theme-color')).toBe('#121110');
    expect(metaContent('theme-color')).toBe(THEME_COLOR);
    expect(metaContent('theme-color')).toBe(MANIFEST.theme_color);
  });

  it('sets the viewport with viewport-fit=cover', () => {
    expect(metaContent('viewport')).toBe('width=device-width, initial-scale=1, viewport-fit=cover');
  });
});

describe('index.html URLs are relative (Requirement 17.3)', () => {
  it('uses no root-absolute or absolute URL in any href or src', () => {
    const urls = Array.from(doc.querySelectorAll('[href], [src]')).flatMap((el) =>
      ['href', 'src'].map((a) => el.getAttribute(a)).filter((v): v is string => v !== null),
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(isRelative(url), url).toBe(true);
  });
});
