export function phoneForDial(raw: string): string {
  const t = raw.trim();
  const plus = t.startsWith('+');
  const digits = t.replace(/[^0-9]/g, '');
  return digits ? (plus ? '+' : '') + digits : '';
}
