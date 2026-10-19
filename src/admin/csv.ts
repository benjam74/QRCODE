function cell(v: string): string {
  let s = v ?? '';
  if (/^[=@\t\r]/.test(s) || /^[+-](?![\d\s])/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(';') + '\r\n').join('');
}
