import { createHash, createHmac } from 'node:crypto';
import type { Config } from '../config.ts';
import type { BackupStore } from './backup.ts';

// Client S3 minimal (signature AWS v4, adressage path-style) : PUT, LIST v2, DELETE.

const sha256 = (d: string | Buffer) => createHash('sha256').update(d).digest('hex');
const hmac = (k: string | Buffer, d: string) => createHmac('sha256', k).update(d).digest();

function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export function signRequest(opts: {
  method: string; url: URL; region: string; accessKeyId: string; secretAccessKey: string;
  headers?: Record<string, string>; payloadHash: string; date: Date;
}): Record<string, string> {
  const amzDate = opts.date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers ?? {})) headers[k.toLowerCase()] = v.trim();
  headers.host = opts.url.host;
  headers['x-amz-content-sha256'] = opts.payloadHash;
  headers['x-amz-date'] = amzDate;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const query = [...opts.url.searchParams.entries()]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)])
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join('&');
  const path = opts.url.pathname.split('/').map((seg) => encodeRfc3986(decodeURIComponent(seg))).join('/');
  const canonical = [opts.method, path, query, canonicalHeaders, signedHeaders, opts.payloadHash].join('\n');
  const scope = `${day}/${opts.region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const kDate = hmac('AWS4' + opts.secretAccessKey, day);
  const kSigning = hmac(hmac(hmac(kDate, opts.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex');
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`,
  };
}

export function createS3Store(cfg: NonNullable<Config['s3']>, fetchFn: typeof fetch = fetch): BackupStore {
  const base = cfg.endpoint.replace(/\/+$/, '');
  const keyUrl = (key: string) => new URL(`${base}/${encodeURIComponent(cfg.bucket)}/${key.split('/').map(encodeRfc3986).join('/')}`);
  async function call(method: string, url: URL, body?: Buffer): Promise<string> {
    const payload = body ?? Buffer.alloc(0);
    const headers = signRequest({ method, url, region: cfg.region, accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, payloadHash: sha256(payload), date: new Date() });
    delete headers.host;
    const res = await fetchFn(url.toString(), { method, headers, body: body ? new Uint8Array(body) : undefined, signal: AbortSignal.timeout(120_000) });
    const text = await res.text();
    if (!res.ok) throw new Error(`S3 ${method} ${url.pathname} : ${res.status} ${text.slice(0, 200)}`);
    return text;
  }
  return {
    async put(key, body) { await call('PUT', keyUrl(key), body); },
    async delete(key) { await call('DELETE', keyUrl(key)); },
    async list(prefix) {
      const keys: string[] = [];
      let token: string | null = null;
      do {
        const url = new URL(`${base}/${encodeURIComponent(cfg.bucket)}`);
        url.searchParams.set('list-type', '2');
        url.searchParams.set('prefix', prefix);
        if (token) url.searchParams.set('continuation-token', token);
        const xml = await call('GET', url);
        for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(decodeXml(m[1]));
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? decodeXml(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '') || null : null;
      } while (token);
      return keys;
    },
  };
}

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
