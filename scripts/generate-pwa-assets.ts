/**
 * Generates the committed PWA assets under `public/`:
 * favicon, app icons, Apple touch icon, and screenshot placeholders.
 *
 * Run with `pnpm generate:pwa-assets`. Not part of `pnpm build`; the build
 * only copies the committed files. Icons are always regenerated (the output
 * is deterministic); screenshots are written only when missing, so manual
 * captures are never overwritten.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, hexColor, rasterise, type MarkScene } from './png';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

const ORANGE = hexColor('#ff8a3d');
const INK = hexColor('#1a0f06');
const SHELL = hexColor('#121110');

const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" rx="9" fill="#ff8a3d"/>' +
  '<path d="M12 9.5v13l10-6.5z" fill="#1a0f06"/>' +
  '</svg>\n';

interface PngAsset {
  path: string;
  width: number;
  height: number;
  scene: MarkScene;
  /** Keep an existing file instead of regenerating it. */
  keepExisting?: boolean;
}

const MARK: MarkScene = { background: null, plate: ORANGE, triangle: INK };

const ASSETS: PngAsset[] = [
  { path: 'icons/icon-192.png', width: 192, height: 192, scene: MARK },
  { path: 'icons/icon-512.png', width: 512, height: 512, scene: MARK },
  {
    path: 'icons/icon-maskable-512.png',
    width: 512,
    height: 512,
    // A 0.52-wide square has a 0.735-wide diagonal, inside the 0.8 safe circle.
    scene: { ...MARK, background: SHELL, markScale: 0.52 },
  },
  {
    path: 'icons/apple-touch-icon-180.png',
    width: 180,
    height: 180,
    // iOS fills transparency with black and applies its own corner mask.
    scene: { background: ORANGE, plate: null, triangle: INK },
  },
  {
    path: 'screenshots/wide.png',
    width: 1280,
    height: 720,
    scene: { ...MARK, background: SHELL, markScale: 0.3 },
    keepExisting: true,
  },
  {
    path: 'screenshots/narrow.png',
    width: 750,
    height: 1334,
    scene: { ...MARK, background: SHELL, markScale: 0.3 },
    keepExisting: true,
  },
];

function write(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

function main(): void {
  const faviconPath = join(PUBLIC, 'favicon.svg');
  write(faviconPath, FAVICON_SVG);
  console.log(`wrote ${relative(ROOT, faviconPath)}`);

  for (const asset of ASSETS) {
    const target = join(PUBLIC, asset.path);
    if (asset.keepExisting && existsSync(target)) {
      console.log(`kept  ${relative(ROOT, target)} (already exists)`);
      continue;
    }
    const image = rasterise({ width: asset.width, height: asset.height }, asset.scene);
    write(target, encodePng(image.width, image.height, image.rgba));
    console.log(`wrote ${relative(ROOT, target)} (${asset.width}x${asset.height})`);
  }
}

main();
