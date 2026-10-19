function cell(v: string): string {
  let s = v ?? '';
  const phoneLike = /^\+?[\d\s().\-/]+$/.test(s);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !phoneLike)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(';') + '\r\n').join('');
}
