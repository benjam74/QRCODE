import { REMOTE_HEADER } from '../http/serve.ts';

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): { hit(key: string): boolean } {
  const hits = new Map<string, number[]>();
  return {
    hit(key: string): boolean {
      const t = now();
      const list = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (list.length >= limit) {
        hits.set(key, list);
        return false;
      }
      list.push(t);
      hits.set(key, list);
      if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
      return true;
    },
  };
}

/** Adresse du client : dernière entrée de X-Forwarded-For (ajoutée par le proxy de confiance), sinon l'adresse de la socket. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get(REMOTE_HEADER) ?? 'inconnu';
}
