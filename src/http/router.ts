export type Ctx = {
  req: Request;
  url: URL;
  params: Record<string, string>;
  vars: Record<string, unknown>;
};
export type Handler = (ctx: Ctx) => Response | void | Promise<Response | void>;

type Route = { method: string; re: RegExp; keys: string[]; handlers: Handler[] };

function compile(pattern: string): { re: RegExp; keys: string[] } {
  const keys: string[] = [];
  const src = pattern
    .split('/')
    .map((seg) => {
      if (seg === '*') return '.*';
      return seg.replace(/:([a-zA-Z]+)|([^:]+)/g, (_m, key: string | undefined, lit: string | undefined) => {
        if (key) {
          keys.push(key);
          return '([^/]+)';
        }
        return (lit as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      });
    })
    .join('/');
  return { re: new RegExp(`^${src}$`), keys };
}

export class Router {
  private routes: Route[] = [];

  on(method: string, pattern: string, ...handlers: Handler[]): this {
    const { re, keys } = compile(pattern);
    this.routes.push({ method, re, keys, handlers });
    return this;
  }
  get(p: string, ...h: Handler[]) { return this.on('GET', p, ...h); }
  post(p: string, ...h: Handler[]) { return this.on('POST', p, ...h); }

  async handle(req: Request, notFound: Handler): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      let bad = false;
      r.keys.forEach((k, i) => {
        try {
          params[k] = decodeURIComponent(m[i + 1]);
        } catch {
          bad = true;
        }
      });
      if (bad) break;
      const ctx: Ctx = { req, url, params, vars: {} };
      for (const h of r.handlers) {
        const res = await h(ctx);
        if (res) return res;
      }
    }
    return (await notFound({ req, url, params: {}, vars: {} })) as Response;
  }
}

export function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}
