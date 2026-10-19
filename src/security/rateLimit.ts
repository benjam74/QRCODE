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

/**
 * Adresse du client. Avec `trustedHops` proxys de confiance devant l'application, chacun ajoute une entrée
 * à la fin de X-Forwarded-For : l'adresse réelle est la `trustedHops`-ième en partant de la fin.
 * Avec 0, on ignore l'en-tête (application exposée directement).
 */
export function clientIp(req: Request, trustedHops: number): string {
  const socket = req.headers.get(REMOTE_HEADER) ?? 'inconnu';
  if (trustedHops <= 0) return socket;
  const parts = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return socket;
  return parts[Math.max(0, parts.length - trustedHops)];
}
