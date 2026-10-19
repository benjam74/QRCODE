import sharp from 'sharp';

// Encodeur QR code : mode octet, niveau de correction M, versions 1 à 15.
// Références : ISO/IEC 18004:2015 ; structure inspirée de la bibliothèque de Project Nayuki (MIT).

const EC_M: Record<number, [number, [number, number][]]> = {
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]],
  10: [26, [[4, 43], [1, 44]]], 11: [30, [[1, 50], [4, 51]]], 12: [22, [[6, 36], [2, 37]]],
  13: [22, [[8, 37], [1, 38]]], 14: [24, [[4, 40], [5, 41]]], 15: [24, [[5, 41], [5, 42]]],
};
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46],
  10: [6, 28, 50], 11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66], 15: [6, 26, 48, 70],
};
const MAX_VERSION = 15;

function dataCapacity(v: number): number {
  return EC_M[v][1].reduce((s, [n, d]) => s + n * d, 0);
}

// --- Reed-Solomon sur GF(256), polynôme 0x11D ---
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

function rsRemainder(data: number[], degree: number): number[] {
  const gen = rsGenerator(degree);
  const res = new Array(degree).fill(0);
  for (const b of data) {
    const factor = b ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < degree; i++) res[i] ^= mul(gen[i + 1], factor);
  }
  return res;
}

// --- Construction des codewords ---
function encodeData(bytes: Uint8Array): { version: number; codewords: number[] } {
  let version = 0;
  for (let v = 1; v <= MAX_VERSION; v++) {
    const countBits = v <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCapacity(v) * 8) { version = v; break; }
  }
  if (!version) throw new Error('Texte trop long pour un QR code (version 15 maximum).');
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capBits = dataCapacity(version) * 8;
  push(0, Math.min(4, capBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < dataCapacity(version); pad ^= 0xec ^ 0x11) data.push(pad);

  const [ecLen, groups] = EC_M[version];
  const blocks: { d: number[]; e: number[] }[] = [];
  let off = 0;
  for (const [n, d] of groups) {
    for (let i = 0; i < n; i++) {
      const chunk = data.slice(off, off + d);
      off += d;
      blocks.push({ d: chunk, e: rsRemainder(chunk, ecLen) });
    }
  }
  const out: number[] = [];
  const maxD = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.e[i]);
  return { version, codewords: out };
}

// --- Matrice ---
type Grid = { size: number; mod: boolean[][]; fn: boolean[][] };

function newGrid(version: number): Grid {
  const size = 17 + 4 * version;
  return { size, mod: Array.from({ length: size }, () => new Array(size).fill(false)), fn: Array.from({ length: size }, () => new Array(size).fill(false)) };
}
const setFn = (g: Grid, x: number, y: number, dark: boolean) => { g.mod[y][x] = dark; g.fn[y][x] = true; };

function drawFunctionPatterns(g: Grid, version: number): void {
  const { size } = g;
  for (let i = 0; i < size; i++) { setFn(g, 6, i, i % 2 === 0); setFn(g, i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setFn(g, x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const pos = ALIGN[version];
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(g, pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  drawFormat(g, 0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFn(g, a, b, bit); setFn(g, b, a, bit);
    }
  }
}

function drawFormat(g: Grid, mask: number): void {
  const data = (0 << 3) | mask; // niveau M = 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  const { size } = g;
  for (let i = 0; i <= 5; i++) setFn(g, 8, i, bit(i));
  setFn(g, 8, 7, bit(6)); setFn(g, 8, 8, bit(7)); setFn(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFn(g, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setFn(g, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFn(g, 8, size - 15 + i, bit(i));
  setFn(g, 8, size - 8, true);
}

function drawCodewords(g: Grid, cw: number[]): void {
  const { size } = g;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vert : vert;
      if (!g.fn[y][x] && i < cw.length * 8) {
        g.mod[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(g: Grid, m: number): void {
  for (let y = 0; y < g.size; y++) for (let x = 0; x < g.size; x++) if (!g.fn[y][x] && MASKS[m](x, y)) g.mod[y][x] = !g.mod[y][x];
}

function penalty(mod: boolean[][]): number {
  const size = mod.length;
  let p = 0;
  const lines: boolean[][] = [];
  for (let i = 0; i < size; i++) { lines.push(mod[i]); lines.push(mod.map((r) => r[i])); }
  const F1 = [true, false, true, true, true, false, true, false, false, false, false];
  const F2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    for (let i = 0; i + 11 <= size; i++) {
      if (F1.every((v, k) => line[i + k] === v) || F2.every((v, k) => line[i + k] === v)) p += 40;
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = mod[y][x];
    if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
  }
  const dark = mod.reduce((s, r) => s + r.filter(Boolean).length, 0);
  const total = size * size;
  p += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return p;
}

export function qrMatrix(text: string): boolean[][] {
  const { version, codewords } = encodeData(new TextEncoder().encode(text));
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const g = newGrid(version);
    drawFunctionPatterns(g, version);
    drawCodewords(g, codewords);
    applyMask(g, m);
    drawFormat(g, m);
    const s = penalty(g.mod);
    if (s < bestScore) { bestScore = s; best = g.mod; }
  }
  return best as boolean[][];
}

export async function qrSvg(text: string, quiet = 4): Promise<string> {
  const m = qrMatrix(text);
  const n = m.length + quiet * 2;
  let path = '';
  m.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 8}" height="${n * 8}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

export async function qrPng(text: string, size: number): Promise<Buffer> {
  const m = qrMatrix(text);
  const quiet = 4;
  const n = m.length + quiet * 2;
  const px = Buffer.alloc(n * n, 255);
  m.forEach((row, y) => row.forEach((dark, x) => { if (dark) px[(y + quiet) * n + x + quiet] = 0; }));
  return sharp(px, { raw: { width: n, height: n, channels: 1 } }).resize(size, size, { kernel: 'nearest' }).png().toBuffer();
}
