import { gzipSync } from 'node:zlib';

// Archive tar (format ustar, noms longs via en-tête PAX) compressée en gzip.

function header(name: string, size: number, mtime: Date, type: '0' | 'x'): Buffer {
  const h = Buffer.alloc(512);
  const oct = (n: number, len: number) => n.toString(8).padStart(len - 1, '0') + '\0';
  h.write(name.slice(0, 100), 0, 'utf8');
  h.write(oct(0o644, 8), 100);
  h.write(oct(0, 8), 108);
  h.write(oct(0, 8), 116);
  h.write(oct(size, 12), 124);
  h.write(oct(Math.floor(mtime.getTime() / 1000), 12), 136);
  h.write('        ', 148);
  h.write(type, 156);
  h.write('ustar\0', 257);
  h.write('00', 263);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}

const pad = (n: number) => Buffer.alloc((512 - (n % 512)) % 512);

export function createTarGz(files: { name: string; data: Buffer }[], mtime: Date): Buffer {
  const parts: Buffer[] = [];
  for (const f of files) {
    if (Buffer.byteLength(f.name) > 100) {
      let rec = ` path=${f.name}\n`;
      let len = Buffer.byteLength(rec);
      len += String(len + String(len).length).length;
      rec = `${len}${rec}`;
      const pax = Buffer.from(rec, 'utf8');
      parts.push(header('PaxHeader', pax.length, mtime, 'x'), pax, pad(pax.length));
    }
    parts.push(header(f.name, f.data.length, mtime, '0'), f.data, pad(f.data.length));
  }
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts));
}
