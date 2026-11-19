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
import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Alert, Badge, Button, Card, Field, Input, LinkButton, PageHeader, SectionHeading, Select, Spinner, cn, type Tone } from '@/components/ui';
import { api, describeError } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';

const STATUS: Record<ImportRowResult['status'], { label: string; tone: Tone }> = {
  valid: { label: 'Will import', tone: 'ok' },
  invalid: { label: 'Problem', tone: 'bad' },
  duplicate_in_file: { label: 'Duplicate in file', tone: 'warn' },
  exists: { label: 'Already a client', tone: 'warn' },
};

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Choose a file', 'Check and match', 'Done'];
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm" aria-label="Progress">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                done && 'bg-primary text-on-primary',
                active && 'bg-primary-soft text-primary-ink ring-2 ring-primary',
                !done && !active && 'bg-sunken text-muted',
              )}
            >
              {done ? <Icon name="check" size={13} /> : n}
            </span>
            <span className={cn('hidden sm:inline', active ? 'font-medium text-fg' : 'text-muted')}>{label}</span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-line-strong sm:w-10" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function ImportClientsPage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [countryCode, setCountryCode] = useState('+961');
  const [mapping, setMapping] = useState<ImportMapping | undefined>(undefined);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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

  async function readFile(file: File | undefined) {
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
      toast.show(`${r.data.created} clients added`);
    } catch (e) {
      setError(describeError(e, 'The import failed. Nothing was lost; you can try again.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadReport(headers: string[], issues: ImportRowResult[]) {
    downloadCsv('import-problems.csv', [
      ['Row', 'Problem', ...headers],
      ...issues.map((i) => [String(i.row), i.reason ?? STATUS[i.status].label, ...i.raw]),
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

  const step = result ? 3 : preview ? 2 : 1;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Import clients"
        description="Bring in your existing client list from a CSV file. You will see a preview before anything is saved."
        back={{ href: '/clients', label: 'Clients' }}
      />
      <Steps current={step} />

      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}

      {/* Step 3: result */}
      {result && (
        <Card className="space-y-5 p-6" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ok-soft text-ok-ink">
              <Icon name="check" size={22} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-fg">Import finished</h2>
              <p className="text-sm text-muted">{fileName}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Added', value: result.created, tone: 'bg-ok-soft text-ok-ink' },
              { label: 'Skipped', value: result.skipped, tone: 'bg-warn-soft text-warn-ink' },
              { label: 'Failed', value: result.failed, tone: result.failed ? 'bg-bad-soft text-bad-ink' : 'bg-sunken text-muted' },
            ].map((s) => (
              <div key={s.label} className={cn('rounded-xl p-4', s.tone)}>
                <dd className="text-3xl font-semibold">{s.value}</dd>
                <dt className="text-xs font-medium uppercase tracking-wide opacity-80">{s.label}</dt>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted">Skipped means a repeat in the file or a client who already exists. Nothing existing was changed.</p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/clients" variant="primary">
              View clients
            </LinkButton>
            {result.issues.length > 0 && (
              <Button icon="file" onClick={() => downloadReport(result.headers, result.issues)}>
                Download problem rows
              </Button>
            )}
            <Button onClick={reset}>Import another file</Button>
          </div>
        </Card>
      )}

      {/* Step 1: choose a file */}
      {!result && !preview && (
        <Card className="p-6">
          <div className="grid gap-6 sm:grid-cols-[1fr_14rem]">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                readFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                dragging ? 'border-primary bg-primary-soft' : 'border-line-strong bg-sunken/40',
              )}
            >
              {busy ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Spinner /> Reading the file…
                </p>
              ) : (
                <>
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                    <Icon name="upload" size={22} />
                  </span>
                  <p className="font-medium text-fg">Drop your CSV file here</p>
                  <p className="mb-4 mt-1 text-sm text-muted">or choose it from your computer</p>
                  <Button onClick={() => fileInput.current?.click()}>Choose a file</Button>
                  <input
                    ref={fileInput}
                    id="file"
                    type="file"
                    accept=".csv,.txt,text/csv"
                    className="sr-only"
                    aria-label="CSV file"
                    onChange={(e) => readFile(e.target.files?.[0])}
                  />
                </>
              )}
            </div>

            <div className="space-y-4">
              <Field label="Country code" htmlFor="cc" hint="Added to numbers written without one, such as 71 123 456.">
                <Input id="cc" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
              </Field>
              <div className="rounded-lg bg-sunken p-3 text-xs text-muted">
                <p className="font-medium text-fg">Your file needs</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>A header row</li>
                  <li>A name column</li>
                  <li>A phone column</li>
                </ul>
                <p className="mt-2">Email, Instagram, source, notes and consent are optional.</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: check and match */}
      {!result && preview && csv && (
        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <SectionHeading title="Match the columns" />
            <p className="text-sm text-muted">
              {fileName}. We guessed which column is which. Change any that look wrong.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <Field
                  key={f}
                  label={`${IMPORT_FIELD_LABELS[f]}${f === 'fullName' || f === 'phone' ? ' *' : ''}`}
                  htmlFor={`map-${f}`}
                >
                  <Select
                    id={`map-${f}`}
                    value={mapping?.[f] ?? ''}
                    onChange={(e) => {
                      const next = { ...mapping, [f]: e.target.value === '' ? null : Number(e.target.value) };
                      setMapping(next);
                      runPreview(csv, next, countryCode);
                    }}
                  >
                    <option value="">Not in the file</option>
                    {preview.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
              <Field label="Country code" htmlFor="cc2">
                <Input id="cc2" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} onBlur={() => runPreview(csv, mapping, countryCode)} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 p-6" aria-live="polite">
            <SectionHeading title="Preview" />
            <div className="flex flex-wrap gap-2">
              <Badge tone="ok">{preview.counts.valid} will import</Badge>
              {preview.counts.invalid > 0 && <Badge tone="bad">{preview.counts.invalid} have problems</Badge>}
              {preview.counts.duplicateInFile > 0 && <Badge tone="warn">{preview.counts.duplicateInFile} repeat a number in the file</Badge>}
              {preview.counts.exists > 0 && <Badge tone="warn">{preview.counts.exists} already clients</Badge>}
              <Badge>{preview.counts.total} rows in total</Badge>
            </div>

            <Alert tone="info">
              Imported clients are recorded as <strong>not having agreed to WhatsApp messages</strong>, unless the file has a consent column that says yes.
              Reminders only go to clients with consent.
            </Alert>

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-sunken text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.sample.map((r) => (
                    <tr key={r.row} className="align-top">
                      <td className="px-3 py-2 text-muted">{r.row}</td>
                      <td className="px-3 py-2 text-fg">{r.fullName || '—'}</td>
                      <td className="px-3 py-2 text-fg">{r.phone || '—'}</td>
                      <td className="px-3 py-2">
                        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                        {r.reason && <span className="ml-2 text-muted">{r.reason}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.counts.total > preview.sample.length && (
              <p className="text-sm text-muted">Showing the first {preview.sample.length} rows. Every problem row is in the report.</p>
            )}
            {preview.issues.length > 0 && (
              <Button icon="file" onClick={() => downloadReport(preview.headers, preview.issues)}>
                Download problem rows ({preview.issues.length})
              </Button>
            )}
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button variant="primary" loading={busy} disabled={preview.counts.valid === 0} onClick={onCommit}>
              {busy ? 'Working…' : `Import ${preview.counts.valid} clients`}
            </Button>
            <Button onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </div>
  );
}
