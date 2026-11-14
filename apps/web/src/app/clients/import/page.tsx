'use client';

import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  MAX_IMPORT_CHARS,
  type ImportMapping,
  type ImportPreview,
  type ImportResult,
  type ImportRowResult,
} from '@deeclinic/shared';
import Link from 'next/link';
import { useState } from 'react';
import { api, describeError } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';

const field = 'rounded-md border border-stone-300 px-3 py-2 text-sm';

const STATUS_LABEL: Record<ImportRowResult['status'], { label: string; style: string }> = {
  valid: { label: 'Will import', style: 'bg-emerald-100 text-emerald-900' },
  invalid: { label: 'Problem', style: 'bg-red-100 text-red-900' },
  duplicate_in_file: { label: 'Duplicate in file', style: 'bg-amber-100 text-amber-900' },
  exists: { label: 'Already a client', style: 'bg-amber-100 text-amber-900' },
};

export default function ImportClientsPage() {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [countryCode, setCountryCode] = useState('+961');
  const [mapping, setMapping] = useState<ImportMapping | undefined>(undefined);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreview(text: string, map: ImportMapping | undefined, cc: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ data: ImportPreview }>('/clients/import/preview', {
        method: 'POST',
        body: JSON.stringify({ csv: text, mapping: map, defaultCountryCode: cc }),
      });
      setPreview(r.data);
      setMapping(r.data.mapping);
    } catch (e) {
      setError(describeError(e, 'Could not read the file.'));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setResult(null);
    if (file.size > MAX_IMPORT_CHARS) {
      setError('That file is too large. Split it into smaller files.');
      return;
    }
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setMapping(undefined);
    await runPreview(text, undefined, countryCode);
  }

  async function onCommit() {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ data: ImportResult }>('/clients/import/commit', {
        method: 'POST',
        body: JSON.stringify({ csv, mapping, defaultCountryCode: countryCode }),
      });
      setResult(r.data);
      setPreview(null);
    } catch (e) {
      setError(describeError(e, 'The import failed. Nothing was lost; you can try again.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadReport(headers: string[], issues: ImportRowResult[]) {
    downloadCsv('import-problems.csv', [
      ['Row', 'Problem', ...headers],
      ...issues.map((i) => [String(i.row), i.reason ?? STATUS_LABEL[i.status].label, ...i.raw]),
    ]);
  }

  function reset() {
    setCsv(null);
    setFileName('');
    setPreview(null);
    setResult(null);
    setMapping(undefined);
    setError(null);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Import clients</h1>
        <Link href="/clients" className="text-sm underline">
          Back to clients
        </Link>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {result ? (
        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6" aria-live="polite">
          <h2 className="text-lg font-semibold">Import finished</h2>
          <ul className="text-sm">
            <li><strong>{result.created}</strong> clients added</li>
            <li><strong>{result.skipped}</strong> skipped (duplicates or already clients)</li>
            <li><strong>{result.failed}</strong> failed</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href="/clients" className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white">
              View clients
            </Link>
            {result.issues.length > 0 && (
              <button type="button" onClick={() => downloadReport(result.headers, result.issues)} className={field}>
                Download problem rows
              </button>
            )}
            <button type="button" onClick={reset} className={field}>
              Import another file
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-sm text-stone-600">
              Upload a CSV with one client per row. It needs at least a name and a phone number. You
              will see a preview before anything is saved.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="file" className="text-sm font-medium">CSV file</label>
                <input id="file" type="file" accept=".csv,.txt,text/csv" onChange={onFile} className="block w-full text-sm" />
              </div>
              <div className="space-y-1">
                <label htmlFor="cc" className="text-sm font-medium">Country code for numbers without one</label>
                <input
                  id="cc"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  onBlur={() => csv && runPreview(csv, mapping, countryCode)}
                  className={`${field} w-28`}
                />
              </div>
            </div>
          </section>

          {busy && !preview && <p className="text-stone-500">Reading the file…</p>}

          {preview && csv && (
            <>
              <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-6">
                <h2 className="text-lg font-semibold">Match the columns</h2>
                <p className="text-sm text-stone-600">
                  {fileName}. Check that each field points at the right column.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {IMPORT_FIELDS.map((f) => (
                    <div key={f} className="space-y-1">
                      <label htmlFor={`map-${f}`} className="text-sm font-medium">
                        {IMPORT_FIELD_LABELS[f]}
                        {(f === 'fullName' || f === 'phone') && ' *'}
                      </label>
                      <select
                        id={`map-${f}`}
                        value={mapping?.[f] ?? ''}
                        onChange={(e) => {
                          const next = { ...mapping, [f]: e.target.value === '' ? null : Number(e.target.value) };
                          setMapping(next);
                          runPreview(csv, next, countryCode);
                        }}
                        className={`${field} w-full`}
                      >
                        <option value="">Not in the file</option>
                        {preview.headers.map((h, i) => (
                          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-6" aria-live="polite">
                <h2 className="text-lg font-semibold">Preview</h2>
                <p className="text-sm">
                  <strong>{preview.counts.valid}</strong> of {preview.counts.total} rows will be imported.
                  {preview.counts.invalid > 0 && ` ${preview.counts.invalid} have problems.`}
                  {preview.counts.duplicateInFile > 0 && ` ${preview.counts.duplicateInFile} repeat a number in the file.`}
                  {preview.counts.exists > 0 && ` ${preview.counts.exists} are already clients.`}
                </p>
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  Imported clients are recorded as <strong>not having agreed to WhatsApp messages</strong>,
                  unless the file has a consent column that says yes. Reminders only go to clients with consent.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-stone-500">
                      <tr>
                        <th className="py-1 pr-3">Row</th>
                        <th className="py-1 pr-3">Name</th>
                        <th className="py-1 pr-3">Phone</th>
                        <th className="py-1">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample.map((r) => (
                        <tr key={r.row} className="border-t border-stone-100 align-top">
                          <td className="py-1.5 pr-3">{r.row}</td>
                          <td className="py-1.5 pr-3">{r.fullName || '—'}</td>
                          <td className="py-1.5 pr-3">{r.phone || '—'}</td>
                          <td className="py-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_LABEL[r.status].style}`}>
                              {STATUS_LABEL[r.status].label}
                            </span>
                            {r.reason && <span className="ml-2 text-stone-600">{r.reason}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.counts.total > preview.sample.length && (
                  <p className="text-sm text-stone-500">
                    Showing the first {preview.sample.length} rows. Every problem row is in the report.
                  </p>
                )}

                {preview.issues.length > 0 && (
                  <button type="button" onClick={() => downloadReport(preview.headers, preview.issues)} className={field}>
                    Download problem rows ({preview.issues.length})
                  </button>
                )}
              </section>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy || preview.counts.valid === 0}
                  onClick={onCommit}
                  className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60"
                >
                  {busy ? 'Working…' : `Import ${preview.counts.valid} clients`}
                </button>
                <button type="button" onClick={reset} className="rounded-md border border-stone-300 px-4 py-2">
                  Start over
                </button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
