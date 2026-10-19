import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const TYPES: Record<string, string> = {
  css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon',
};

export async function serveFile(dir: string, name: string, cache: string): Promise<Response | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.startsWith('.') || basename(name) !== name) return null;
  try {
    const data = await readFile(join(dir, name));
    const ext = name.split('.').pop() ?? '';
    return new Response(data, { headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': cache } });
  } catch {
    return null;
  }
}
