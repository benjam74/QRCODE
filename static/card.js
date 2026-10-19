// Amélioration progressive de la page de la carte : la page fonctionne entièrement sans ce script.
(() => {
  const exchange = document.getElementById('echange');
  const save = document.getElementById('save-contact');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Après « Enregistrer le contact », mettre en avant l'échange de coordonnées.
  if (save && exchange) {
    save.addEventListener('click', () => {
      setTimeout(() => {
        exchange.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        exchange.classList.remove('highlight');
        void exchange.offsetWidth;
        exchange.classList.add('highlight');
      }, 1500);
    });
  }

  // Sélection de sa propre fiche dans le carnet d'adresses (Chrome Android).
  const pick = document.getElementById('pick-contact');
  if (pick && 'contacts' in navigator && 'ContactsManager' in window) {
    pick.hidden = false;
    pick.addEventListener('click', async () => {
      try {
        const [c] = await navigator.contacts.select(['name', 'email', 'tel'], { multiple: false });
        if (!c) return;
        const form = pick.closest('form');
        const set = (name, value) => { const el = form.elements.namedItem(name); if (el && value) el.value = value.trim(); };
        const full = (c.name && c.name[0]) || '';
        const i = full.indexOf(' ');
        set('firstName', i > 0 ? full.slice(0, i) : full);
        set('lastName', i > 0 ? full.slice(i + 1) : '');
        set('email', c.email && c.email[0]);
        set('phone', c.tel && c.tel[0]);
      } catch {
        // Sélection annulée ou refusée : on laisse le formulaire tel quel.
      }
    });
  }
})();
