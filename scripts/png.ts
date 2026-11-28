/**
 * Minimal PNG encoder and icon rasteriser for the SceneBeat PWA assets.
 *
 * Node-only (uses `node:zlib`); used by `scripts/generate-pwa-assets.ts` and
 * never imported from `src/`. No image dependency, no network.
 *
 * The mark is the favicon geometry on a 32x32 grid: a rounded square with
 * corner radius 9 (9/32 of the side) and the play triangle `M12 9.5v13l10-6.5z`.
 */
import { deflateSync } from 'node:zlib';

/** Straight (non-premultiplied) RGBA colour, each channel 0 to 255. */
export type Rgba = readonly [r: number, g: number, b: number, a: number];

export interface RasterImage {
  width: number;
  height: number;
  /** `width * height * 4` bytes, row-major, straight RGBA. */
  rgba: Uint8Array;
}

export interface MarkScene {
  /** Fill behind the mark; `null` leaves the canvas transparent. */
  background: Rgba | null;
  /** Side of the centred mark square as a fraction of the shorter image side (default 1). */
  markScale?: number;
  /** Rounded-square colour; `null` draws no plate (triangle only). */
  plate: Rgba | null;
  /** Play triangle colour. */
  triangle: Rgba;
}

/** Parses `#rrggbb` or `#rrggbbaa`. */
export function hexColor(hex: string): Rgba {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m) throw new Error(`Invalid colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const a = m[2] === undefined ? 255 : parseInt(m[2], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, a];
}

// ---------------------------------------------------------------------------
// PNG encoding

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeAndData.copy(out, 4);
  out.writeUInt32BE(crc32(typeAndData), 8 + data.length);
  return out;
}

/** Encodes straight RGBA pixels as an 8-bit RGBA PNG (colour type 6, filter 0 on every row). */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid PNG size: ${width}x${height}`);
  }
  const stride = width * 4;
  if (rgba.length !== stride * height) {
    throw new Error(`Expected ${stride * height} bytes of RGBA, got ${rgba.length}`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // no interlace

  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0; // filter type None
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), row + 1);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Rasterising the mark

const GRID = 32;
const CORNER_RADIUS = 9;
const TRIANGLE: readonly (readonly [number, number])[] = [
  [12, 9.5],
  [12, 22.5],
  [22, 16],
];
const SUPERSAMPLE = 4;

function insideRoundedSquare(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > GRID || y > GRID) return false;
  const r = CORNER_RADIUS;
  const dx = Math.max(r - x, 0, x - (GRID - r));
  const dy = Math.max(r - y, 0, y - (GRID - r));
  return dx * dx + dy * dy <= r * r;
}

function edge(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

function insideTriangle(x: number, y: number): boolean {
  const [[ax, ay], [bx, by], [cx, cy]] = TRIANGLE;
  const e0 = edge(ax, ay, bx, by, x, y);
  const e1 = edge(bx, by, cx, cy, x, y);
  const e2 = edge(cx, cy, ax, ay, x, y);
  return (e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0);
}

/** Composites `src` over the premultiplied accumulator `dst` (channels 0 to 1). */
function over(dst: [number, number, number, number], src: Rgba): void {
  const a = src[3] / 255;
  const k = 1 - a;
  dst[0] = (src[0] / 255) * a + dst[0] * k;
  dst[1] = (src[1] / 255) * a + dst[1] * k;
  dst[2] = (src[2] / 255) * a + dst[2] * k;
  dst[3] = a + dst[3] * k;
}

/**
 * Draws the SceneBeat mark centred on an image of `size` (a square side or
 * `{ width, height }`) with 4x4 supersampling. Deterministic.
 */
export function rasterise(size: number | { width: number; height: number }, scene: MarkScene): RasterImage {
  const width = typeof size === 'number' ? size : size.width;
  const height = typeof size === 'number' ? size : size.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid raster size: ${width}x${height}`);
  }

  const side = Math.min(width, height) * (scene.markScale ?? 1);
  const originX = (width - side) / 2;
  const originY = (height - side) / 2;
  const toGrid = GRID / side;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  const rgba = new Uint8Array(width * height * 4);
  const acc: [number, number, number, number] = [0, 0, 0, 0];
  const sum = [0, 0, 0, 0];

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      sum[0] = sum[1] = sum[2] = sum[3] = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        const gy = (py + (sy + 0.5) / SUPERSAMPLE - originY) * toGrid;
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const gx = (px + (sx + 0.5) / SUPERSAMPLE - originX) * toGrid;
          acc[0] = acc[1] = acc[2] = acc[3] = 0;
          if (scene.background) over(acc, scene.background);
          if (scene.plate && insideRoundedSquare(gx, gy)) over(acc, scene.plate);
          if (insideTriangle(gx, gy)) over(acc, scene.triangle);
          sum[0] += acc[0];
          sum[1] += acc[1];
          sum[2] += acc[2];
          sum[3] += acc[3];
        }
      }
      const i = (py * width + px) * 4;
      const a = sum[3] / samples;
      if (a > 0) {
        rgba[i] = Math.round((sum[0] / samples / a) * 255);
        rgba[i + 1] = Math.round((sum[1] / samples / a) * 255);
        rgba[i + 2] = Math.round((sum[2] / samples / a) * 255);
      }
      rgba[i + 3] = Math.round(a * 255);
    }
  }

  return { width, height, rgba };
}
