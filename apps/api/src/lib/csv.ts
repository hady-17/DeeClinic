export interface CsvRecord {
  cells: string[];
  /** 1-based record number, counting blank lines, so it matches a spreadsheet row */
  line: number;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  let best = ',';
  let bestCount = 0;
  for (const d of [',', ';', '\t']) {
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, embedded newlines, BOM. */
export function parseCsv(input: string): { records: CsvRecord[]; delimiter: string } {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const records: CsvRecord[] = [];

  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;

  const endRecord = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== '')) records.push({ cells, line });
    cells = [];
    cell = '';
    line++;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRecord();
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || cells.length > 0) endRecord();

  return { records, delimiter };
}
