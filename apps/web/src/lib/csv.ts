const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quote).join(',')).join('\r\n');
}

/** Downloads text as a CSV. The BOM makes Excel read accents and Arabic correctly. */
export function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
