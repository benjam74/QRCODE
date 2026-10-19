export function phoneForDial(raw: string): string {
  let t = raw.trim();
  const plus = t.startsWith('+');
  // « +41 (0)79 … » : le (0) national ne se compose pas après l'indicatif international.
  if (plus) t = t.replace(/\(\s*0\s*\)/, '');
  const digits = t.replace(/[^0-9]/g, '');
  return digits ? (plus ? '+' : '') + digits : '';
}
