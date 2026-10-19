import type { Deps } from './app.ts';
import { processDueLeads } from './leads/dispatcher.ts';
import { runBackup, type BackupStore } from './backup/backup.ts';

export const BACKUP_HOUR_PARIS = 3;

/** Renvoie la date (AAAA-MM-JJ, heure de Paris) si la sauvegarde du jour doit partir maintenant, sinon null. */
export function shouldRunBackup(now: Date, lastDay: string | null): string | null {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  return Number(get('hour')) === BACKUP_HOUR_PARIS && day !== lastDay ? day : null;
}

export function startScheduler(deps: Deps, backupStore: BackupStore | null = null): () => void {
  let busy = false;
  let lastBackupDay: string | null = null;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await processDueLeads(deps);
    } catch (e) {
      console.error('Traitement des contacts :', e);
    }
    const day = backupStore ? shouldRunBackup(deps.now(), lastBackupDay) : null;
    if (backupStore && day) {
      lastBackupDay = day;
      try {
        const r = await runBackup(deps.db, deps.config.dataDir, backupStore, deps.now());
        console.log(`Sauvegarde envoyée : ${r.dbKey}`);
      } catch (e) {
        console.error('Sauvegarde :', e);
        await deps.mailer.send({
          to: deps.config.adminEmail,
          subject: 'Échec de la sauvegarde',
          text: `La sauvegarde du ${day} a échoué :\n\n${(e as Error).message}\n\nVérifiez la configuration S3 du serveur.`,
        }).catch((err) => console.error('E-mail d\'échec de sauvegarde :', err));
      }
    }
    busy = false;
  };
  const timer = setInterval(tick, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
