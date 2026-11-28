// Web App Manifest data for SceneBeat. Pure data: no DOM, no React, no plugin
// types, so vite.config.ts (Node) and tests can import it directly.
// Every URL is relative (`./…`) so one build works at any Deployment_Base.

export interface ManifestImage {
  src: string;
  sizes: string;
  type: string;
}

export interface ManifestIcon extends ManifestImage {
  purpose?: 'any' | 'maskable' | 'monochrome';
}

export interface ManifestScreenshot extends ManifestImage {
  form_factor: 'wide' | 'narrow';
  label: string;
}

export interface ManifestShortcut {
  name: string;
  url: string;
  icons: ManifestImage[];
}

export interface ManifestShareTarget {
  action: string;
  method: 'GET' | 'POST';
  params: { title?: string; text?: string; url?: string };
}

export interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  id: string;
  start_url: string;
  scope: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  display_override: string[];
  theme_color: string;
  background_color: string;
  orientation: 'any';
  lang: string;
  dir: 'ltr' | 'rtl' | 'auto';
  categories: string[];
  icons: ManifestIcon[];
  screenshots: ManifestScreenshot[];
  shortcuts: ManifestShortcut[];
  share_target: ManifestShareTarget;
  launch_handler: { client_mode: 'focus-existing' | 'navigate-existing' | 'navigate-new' | 'auto' };
}

/** Identical to `<meta name="description">` in index.html. */
export const APP_DESCRIPTION =
  'Paste a transcript and SceneBeat turns it into an animated storyboard you can preview and download.';

/** The `--sb-bg` colour of src/styles/app.css. */
export const THEME_COLOR = '#121110';

const SHORTCUT_ICON: ManifestImage = { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' };

export const MANIFEST: WebAppManifest = {
  name: 'SceneBeat',
  short_name: 'SceneBeat',
  description: APP_DESCRIPTION,
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone'],
  theme_color: THEME_COLOR,
  background_color: THEME_COLOR,
  orientation: 'any',
  lang: 'en',
  dir: 'ltr',
  categories: ['productivity', 'utilities'],
  icons: [
    { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  screenshots: [
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
  ],
  shortcuts: [
    { name: 'New transcript', url: './?action=new', icons: [{ ...SHORTCUT_ICON }] },
    { name: 'Load sample', url: './?action=sample', icons: [{ ...SHORTCUT_ICON }] },
  ],
  share_target: {
    action: './',
    method: 'GET',
    params: { title: 'title', text: 'text', url: 'url' },
  },
  launch_handler: { client_mode: 'focus-existing' },
};

/**
 * Every URL in the manifest: id, start_url, scope, icon and screenshot src,
 * shortcut url and shortcut icon src, and share_target.action.
 */
export function manifestUrls(m: WebAppManifest): string[] {
  return [
    m.id,
    m.start_url,
    m.scope,
    ...m.icons.map((i) => i.src),
    ...m.screenshots.map((s) => s.src),
    ...m.shortcuts.flatMap((s) => [s.url, ...s.icons.map((i) => i.src)]),
    m.share_target.action,
  ];
}
