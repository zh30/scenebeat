import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, encodePng, hexColor, rasterise } from '../scripts/png';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface Chunk {
  type: string;
  data: Buffer;
  crc: number;
}

function readChunks(png: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    const crc = png.readUInt32BE(off + 8 + len);
    chunks.push({ type, data, crc });
    off += 12 + len;
  }
  return chunks;
}

function pixel(img: { width: number; rgba: Uint8Array }, x: number, y: number): number[] {
  const i = (y * img.width + x) * 4;
  return Array.from(img.rgba.subarray(i, i + 4));
}

describe('crc32', () => {
  it('matches the standard check values', () => {
    expect(crc32(Buffer.from('123456789', 'ascii'))).toBe(0xcbf43926);
    expect(crc32(Buffer.from('IEND', 'ascii'))).toBe(0xae426082);
  });
});

describe('hexColor', () => {
  it('parses #rrggbb and #rrggbbaa', () => {
    expect(hexColor('#ff8a3d')).toEqual([255, 138, 61, 255]);
    expect(hexColor('#12111080')).toEqual([18, 17, 16, 128]);
  });

  it('rejects malformed colours', () => {
    expect(() => hexColor('ff8a3d')).toThrow();
    expect(() => hexColor('#fff')).toThrow();
  });
});

describe('encodePng', () => {
  const width = 3;
  const height = 2;
  const rgba = Uint8Array.from({ length: width * height * 4 }, (_, i) => (i * 37) % 256);
  const png = encodePng(width, height, rgba);
  const chunks = readChunks(png);

  it('writes the PNG signature and IHDR, IDAT, IEND chunks with valid CRCs', () => {
    expect(Array.from(png.subarray(0, 8))).toEqual(SIGNATURE);
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    for (const c of chunks) {
      expect(c.crc).toBe(crc32(Buffer.concat([Buffer.from(c.type, 'ascii'), c.data])));
    }
  });

  it('writes width, height, and 8-bit RGBA in IHDR', () => {
    const ihdr = chunks[0].data;
    expect(ihdr.length).toBe(13);
    expect(ihdr.readUInt32BE(0)).toBe(width);
    expect(ihdr.readUInt32BE(4)).toBe(height);
    expect(Array.from(ihdr.subarray(8))).toEqual([8, 6, 0, 0, 0]);
  });

  it('IDAT inflates to the input rows, each prefixed by filter byte 0', () => {
    const raw = inflateSync(chunks[1].data);
    const stride = width * 4;
    const expected: number[] = [];
    for (let y = 0; y < height; y++) {
      expected.push(0, ...rgba.subarray(y * stride, (y + 1) * stride));
    }
    expect(Array.from(raw)).toEqual(expected);
  });

  it('rejects bad sizes and mismatched buffers', () => {
    expect(() => encodePng(0, 1, new Uint8Array(0))).toThrow();
    expect(() => encodePng(2, 2, new Uint8Array(15))).toThrow();
  });
});

describe('rasterise', () => {
  const orange = hexColor('#ff8a3d');
  const dark = hexColor('#1a0f06');
  const bg = hexColor('#121110');

  it('is deterministic', () => {
    const scene = { background: null, plate: orange, triangle: dark };
    const a = rasterise(48, scene);
    const b = rasterise(48, scene);
    expect(a.width).toBe(48);
    expect(a.height).toBe(48);
    expect(Buffer.from(a.rgba).equals(Buffer.from(b.rgba))).toBe(true);
  });

  it('leaves the corner transparent and fills the triangle centre on a transparent icon', () => {
    const img = rasterise(32, { background: null, plate: orange, triangle: dark });
    expect(pixel(img, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(img, 15, 15)).toEqual([...dark]);
    // Inside the plate but outside the triangle.
    expect(pixel(img, 5, 16)).toEqual([...orange]);
  });

  it('fills corners with the background on a maskable-style icon', () => {
    const img = rasterise(64, { background: bg, markScale: 0.52, plate: orange, triangle: dark });
    for (const [x, y] of [[0, 0], [63, 0], [0, 63], [63, 63]]) {
      expect(pixel(img, x, y)).toEqual([...bg]);
    }
    expect(pixel(img, 32, 32)).toEqual([...dark]);
  });

  it('centres the mark on non-square images', () => {
    const img = rasterise({ width: 80, height: 40 }, { background: bg, plate: orange, triangle: dark });
    expect(img.rgba.length).toBe(80 * 40 * 4);
    expect(pixel(img, 5, 20)).toEqual([...bg]);
    // Mark spans x 20..60; grid (5,16) maps to pixel (26.25, 20).
    expect(pixel(img, 26, 20)).toEqual([...orange]);
  });
});
