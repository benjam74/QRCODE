import type { Deps } from '../app.ts';
import { getLead, type LeadRow } from './repo.ts';
import { pushToFolk } from './folk.ts';

export const RETRY_DELAY_MS = 15 * 60_000;
export const MAX_FOLK_ATTEMPTS = 5;
export const PENDING_GRACE_MS = 2 * 60_000;

const running = new Set<number>();

function leadEmail(lead: LeadRow, baseUrl: string): { subject: string; text: string } {
  const name = `${lead.firstName} ${lead.lastName}`;
  const lines = [
    `${name} vous a laissé ses coordonnées${lead.eventName ? ` (${lead.eventName})` : ''}.`,
    '',
    `Prénom : ${lead.firstName}`,
    `Nom : ${lead.lastName}`,
    `E-mail : ${lead.email ?? '—'}`,
    `Téléphone : ${lead.phone ?? '—'}`,
    `Société : ${lead.company ?? '—'}`,
    `Événement : ${lead.eventName ?? '—'}`,
    `Date : ${new Date(lead.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
    '',
    `Tous vos contacts : ${baseUrl}/admin/contacts`,
  ];
  return { subject: `Nouveau contact : ${name}${lead.eventName ? ` — ${lead.eventName}` : ''}`, text: lines.join('\n') };
}

export async function dispatchLead(deps: Deps, leadId: number): Promise<void> {
  if (running.has(leadId)) return;
  running.add(leadId);
  try {
    const { db } = deps;
    const lead = getLead(db, leadId);
    if (!lead) return;
    const errors: string[] = [];

    if (lead.emailStatus === 'pending') {
      const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(lead.userId) as { email: string } | undefined;
      try {
        await deps.mailer.send({ to: owner?.email ?? deps.config.adminEmail, ...leadEmail(lead, deps.config.baseUrl) });
        db.prepare("UPDATE leads SET email_status = 'sent' WHERE id = ?").run(leadId);
      } catch (e) {
        errors.push(`E-mail : ${(e as Error).message}`);
        db.prepare("UPDATE leads SET email_status = 'error' WHERE id = ?").run(leadId);
      }
    }

    if (lead.folkStatus === 'pending' || lead.folkStatus === 'retry') {
      if (!deps.config.folk.apiKey || !deps.config.folk.groupId) {
        db.prepare("UPDATE leads SET folk_status = 'off' WHERE id = ?").run(leadId);
      } else {
        const r = await pushToFolk(lead, lead.eventName, deps.config.folk, deps.fetch);
        if (r.ok) {
          db.prepare("UPDATE leads SET folk_status = 'sent', folk_person_id = ?, folk_attempts = folk_attempts + 1, folk_next_at = NULL WHERE id = ?").run(r.personId, leadId);
        } else {
          errors.push(r.error);
          const attempts = lead.folkAttempts + 1;
          const final = !r.retryable || attempts >= MAX_FOLK_ATTEMPTS;
          const next = final ? null : new Date(deps.now().getTime() + RETRY_DELAY_MS).toISOString();
          db.prepare('UPDATE leads SET folk_status = ?, folk_attempts = ?, folk_next_at = ? WHERE id = ?').run(final ? 'error' : 'retry', attempts, next, leadId);
        }
      }
    }
    db.prepare('UPDATE leads SET last_error = ? WHERE id = ?').run(errors.length ? errors.join(' / ').slice(0, 1000) : null, leadId);
  } finally {
    running.delete(leadId);
  }
}

export async function processDueLeads(deps: Deps): Promise<number> {
  const now = deps.now();
  const rows = deps.db.prepare(
    `SELECT id FROM leads WHERE (folk_status = 'retry' AND folk_next_at <= ?)
       OR ((folk_status = 'pending' OR email_status = 'pending') AND created_at <= ?) ORDER BY id LIMIT 50`,
  ).all(now.toISOString(), new Date(now.getTime() - PENDING_GRACE_MS).toISOString()) as { id: number }[];
  for (const r of rows) await dispatchLead(deps, r.id);
  return rows.length;
}
