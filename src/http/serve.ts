import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { Readable } from 'node:stream';

export const MAX_BODY_BYTES = 6 * 1024 * 1024;
export const REMOTE_HEADER = 'x-carte-remote-addr';

class TooLarge extends Error {}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new TooLarge();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function toRequest(req: IncomingMessage, origin: string): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined || k.toLowerCase() === REMOTE_HEADER) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }
  headers.set(REMOTE_HEADER, req.socket.remoteAddress ?? '');
  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
  return new Request(new URL(req.url ?? '/', origin), { method, headers, body: body as BodyInit | undefined });
}

export async function writeResponse(res: ServerResponse, response: Response, head: boolean): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((v, k) => {
    if (k === 'set-cookie') return;
    headers[k] = v;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  if (head || !response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res);
}

export function serve(app: (req: Request) => Promise<Response>, port: number, origin: string, host = '127.0.0.1'): Server {
  const server = createServer(async (req, res) => {
    try {
      const request = await toRequest(req, origin);
      const response = await app(request);
      await writeResponse(res, response, req.method === 'HEAD');
    } catch (e) {
      if (e instanceof TooLarge) {
        res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' }).end('Fichier trop volumineux.');
        return;
      }
      console.error(e);
      if (!res.headersSent) res.writeHead(500).end('Erreur interne');
    }
  });
  server.listen(port, host);
  return server;
}
