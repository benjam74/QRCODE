import type { Deps } from './app.ts';
import { processDueLeads } from './leads/dispatcher.ts';

export function startScheduler(deps: Deps): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await processDueLeads(deps); } catch (e) { console.error('Traitement des contacts :', e); } finally { busy = false; }
  };
  const timer = setInterval(tick, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
