import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_DESCRIPTION, MANIFEST, THEME_COLOR } from '../src/pwa/manifest';

const root = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function metaDescription(html: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (/\bname\s*=\s*["']description["']/i.test(tag)) {
      return /\bcontent\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? /\bcontent\s*=\s*'([^']*)'/i.exec(tag)?.[1];
    }
  }
  return undefined;
}

const ICON_192 = { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' };

describe('MANIFEST (Requirement 1)', () => {
  it('names the app and mirrors the index.html description', () => {
    expect(MANIFEST.name).toBe('SceneBeat');
    expect(MANIFEST.short_name).toBe('SceneBeat');
    const description = metaDescription(read('index.html'));
    expect(description).toBeDefined();
    expect(APP_DESCRIPTION).toBe(description);
    expect(MANIFEST.description).toBe(APP_DESCRIPTION);
  });

  it('uses relative id, start_url, and scope that resolve to the base', () => {
    expect(MANIFEST.id).toBe('./');
    expect(MANIFEST.start_url).toBe('./');
    expect(MANIFEST.scope).toBe('./');
    const manifestUrl = 'https://example.test/scenebeat/manifest.webmanifest';
    const start = new URL(MANIFEST.start_url, manifestUrl).href;
    expect(start).toBe('https://example.test/scenebeat/');
    expect(new URL(MANIFEST.scope, manifestUrl).href).toBe('https://example.test/scenebeat/');
    expect(new URL(MANIFEST.id, start).href).toBe('https://example.test/scenebeat/');
  });

  it('sets display, colours, orientation, language, and categories', () => {
    expect(MANIFEST.display).toBe('standalone');
    expect(MANIFEST.display_override).toEqual(['window-controls-overlay', 'standalone']);
    expect(THEME_COLOR).toBe('#121110');
    expect(MANIFEST.theme_color).toBe(THEME_COLOR);
    expect(MANIFEST.background_color).toBe(THEME_COLOR);
    expect(read('src/styles/app.css')).toMatch(/--sb-bg:\s*#121110\s*;/i);
    expect(MANIFEST.orientation).toBe('any');
    expect(MANIFEST.lang).toBe('en');
    expect(MANIFEST.dir).toBe('ltr');
    expect(MANIFEST.categories).toEqual(['productivity', 'utilities']);
  });

  it('lists the icons with src, sizes, type, and purpose', () => {
    expect(MANIFEST.icons).toEqual([
      { ...ICON_192, purpose: 'any' },
      { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });

  it('lists the wide and narrow screenshots with labels', () => {
    expect(MANIFEST.screenshots).toEqual([
      {
        src: './screenshots/wide.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'SceneBeat with the Player and the storyboard list',
      },
      {
        src: './screenshots/narrow.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'SceneBeat on a phone',
      },
    ]);
    for (const s of MANIFEST.screenshots) expect(s.label.trim()).not.toBe('');
  });
});

describe('MANIFEST OS integration (Requirements 14.1, 15.1, 16.1)', () => {
  it('declares the two shortcuts with the 192x192 icon', () => {
    expect(MANIFEST.shortcuts).toEqual([
      { name: 'New transcript', url: './?action=new', icons: [ICON_192] },
      { name: 'Load sample', url: './?action=sample', icons: [ICON_192] },
    ]);
  });

  it('declares a GET share target at the base', () => {
    expect(MANIFEST.share_target).toEqual({
      action: './',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' },
    });
  });

  it('declares launch_handler focus-existing', () => {
    expect(MANIFEST.launch_handler).toEqual({ client_mode: 'focus-existing' });
  });
});

describe('MANIFEST scope boundaries (Requirement 18.5)', () => {
  it('has no file_handlers or protocol_handlers', () => {
    expect(MANIFEST).not.toHaveProperty('file_handlers');
    expect(MANIFEST).not.toHaveProperty('protocol_handlers');
  });

  it('has exactly the designed top-level fields', () => {
    expect(Object.keys(MANIFEST).sort()).toEqual(
      [
        'name', 'short_name', 'description', 'id', 'start_url', 'scope', 'display', 'display_override',
        'theme_color', 'background_color', 'orientation', 'lang', 'dir', 'categories', 'icons',
        'screenshots', 'shortcuts', 'share_target', 'launch_handler',
      ].sort(),
    );
  });
});
