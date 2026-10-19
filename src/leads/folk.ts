import type { Config } from '../config.ts';
import type { LeadRow } from './repo.ts';

export type FolkResult = { ok: true; personId: string } | { ok: false; error: string; retryable: boolean };

export function parisDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

export function folkDescription(eventName: string | null, createdAt: string): string {
  return eventName
    ? `Rencontré via carte QR, événement ${eventName}, le ${parisDate(createdAt)}`
    : `Rencontré via carte QR, le ${parisDate(createdAt)}`;
}

export async function pushToFolk(lead: LeadRow, eventName: string | null, cfg: Config['folk'], fetchFn: typeof fetch): Promise<FolkResult> {
  if (!cfg.apiKey || !cfg.groupId) return { ok: false, error: 'Folk non configuré', retryable: false };
  const body: Record<string, unknown> = { firstName: lead.firstName, lastName: lead.lastName };
  if (lead.email) body.emails = [lead.email];
  if (lead.phone) body.phones = [lead.phone.slice(0, 30)];
  if (lead.company) body.companies = [{ name: lead.company }];
  body.groups = [{ id: cfg.groupId }];
  body.description = folkDescription(eventName, lead.createdAt);
  let res: Response;
  try {
    res = await fetchFn('https://api.folk.app/v1/people', {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, error: `Folk injoignable : ${(e as Error).message}`, retryable: true };
  }
  const text = await res.text().catch(() => '');
  if (res.ok) {
    try {
      const id = (JSON.parse(text) as { data?: { id?: string } }).data?.id;
      if (id) return { ok: true, personId: id };
    } catch { /* corps illisible */ }
    return { ok: false, error: 'Réponse Folk inattendue', retryable: false };
  }
  return { ok: false, error: `Folk ${res.status} : ${text.slice(0, 300)}`, retryable: res.status === 429 || res.status >= 500 };
}
