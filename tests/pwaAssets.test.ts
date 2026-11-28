import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { MANIFEST } from '../src/pwa/manifest';

// Requirements 2.2, 2.3, 2.4, 2.5, 17.2: the committed files under public/
// match what the manifest declares.

const PUBLIC = join(__dirname, '..', 'public');
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function publicPath(src: string): string {
  return join(PUBLIC, src.replace(/^\.\//, ''));
}

interface Png {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  idat: Buffer;
}

function readPng(file: string): Png {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8).equals(SIGNATURE)).toBe(true);
  expect(buf.toString('ascii', 12, 16)).toBe('IHDR');
  const idat: Buffer[] = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    if (buf.toString('ascii', off + 4, off + 8) === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
    idat: Buffer.concat(idat),
  };
}

/** Decodes an 8-bit RGB or RGBA, non-interlaced PNG to RGBA pixels (all five filter types). */
function decodeRgba(png: Png): Uint8Array {
  expect(png.bitDepth).toBe(8);
  expect([2, 6]).toContain(png.colorType);
  const bpp = png.colorType === 6 ? 4 : 3;
  const stride = png.width * bpp;
  const raw = inflateSync(png.idat);
  const out = new Uint8Array(png.width * png.height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < png.height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let p: number;
      switch (filter) {
        case 0: p = 0; break;
        case 1: p = a; break;
        case 2: p = b; break;
        case 3: p = (a + b) >> 1; break;
        case 4: {
          const e = a + b - c;
          const pa = Math.abs(e - a), pb = Math.abs(e - b), pc = Math.abs(e - c);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      cur[i] = (line[i] + p) & 0xff;
    }
    for (let x = 0; x < png.width; x++) {
      const o = (y * png.width + x) * 4;
      out[o] = cur[x * bpp];
      out[o + 1] = cur[x * bpp + 1];
      out[o + 2] = cur[x * bpp + 2];
      out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
    }
    prev = cur;
  }
  return out;
}

const BG = [0x12, 0x11, 0x10, 0xff];

const entries = [
  ...MANIFEST.icons.map((i) => ({ kind: 'icon', src: i.src, sizes: i.sizes })),
  ...MANIFEST.screenshots.map((s) => ({ kind: 'screenshot', src: s.src, sizes: s.sizes })),
  { kind: 'apple-touch-icon', src: './icons/apple-touch-icon-180.png', sizes: '180x180' },
];

describe('PWA assets under public/', () => {
  it.each(entries)('$kind $src exists and its IHDR matches $sizes', ({ src, sizes }) => {
    const file = publicPath(src);
    expect(existsSync(file)).toBe(true);
    const png = readPng(file);
    expect(`${png.width}x${png.height}`).toBe(sizes);
  });

  it('maskable icon is full-bleed #121110 outside the central 80% circle', () => {
    const icon = MANIFEST.icons.find((i) => i.purpose === 'maskable');
    expect(icon).toBeDefined();
    const png = readPng(publicPath(icon!.src));
    const rgba = decodeRgba(png);
    const w = png.width;
    const px = (x: number, y: number) => Array.from(rgba.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));

    for (const [x, y] of [[0, 0], [w - 1, 0], [0, w - 1], [w - 1, w - 1]]) {
      expect(px(x, y)).toEqual(BG);
    }

    const r = 0.4 * w;
    const c = w / 2;
    let outside = 0;
    const bad: string[] = [];
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < w; x++) {
        if (Math.hypot(x + 0.5 - c, y + 0.5 - c) <= r) continue;
        outside++;
        const p = px(x, y);
        if (p.some((v, i) => v !== BG[i]) && bad.length < 5) bad.push(`(${x},${y})=${p.join(',')}`);
      }
    }
    expect(outside).toBeGreaterThan(0);
    expect(bad).toEqual([]);

    // The mark is actually drawn (inside the circle there is non-background colour).
    expect(px(Math.floor(c), Math.floor(c))).not.toEqual(BG);
  });

  it('favicon.svg exists and uses the play-mark colours', () => {
    const file = join(PUBLIC, 'favicon.svg');
    expect(existsSync(file)).toBe(true);
    const svg = readFileSync(file, 'utf8').toLowerCase();
    expect(svg).toContain('#ff8a3d');
    expect(svg).toContain('#1a0f06');
  });
});
