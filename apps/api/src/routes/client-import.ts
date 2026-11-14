import {
  importRequestSchema,
  type ImportPreview,
  type ImportResult,
  type ImportRowResult,
} from '@deeclinic/shared';
import { Router } from 'express';
import { writeAuditBatch } from '../lib/audit.js';
import { rateLimit } from '../lib/rate-limit.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { findExistingPhones, insertClientsBulk } from '../repositories/clients.js';
import { analyzeCsv, countRows, type Analysis } from '../services/client-import.js';

export const clientImportRouter = Router();

clientImportRouter.use(
  '/clients/import',
  requireAuth,
  requirePermission('clients.import'),
  // Imports are heavy, so they get a tighter limit than normal requests
  rateLimit({ name: 'import', limit: 20, windowSeconds: 60, key: (req) => req.user!.id, failOpen: true }),
);

/** Parses the file and marks rows whose phone number already belongs to a client. */
async function analyze(body: unknown): Promise<Analysis> {
  const req = importRequestSchema.parse(body);
  const analysis = analyzeCsv(req.csv, {
    mapping: req.mapping,
    defaultCountryCode: req.defaultCountryCode,
  });
  const valid = analysis.rows.filter((r) => r.result.status === 'valid');
  const existing = await findExistingPhones(valid.map((r) => r.input!.phoneE164));
  for (const row of valid) {
    if (existing.has(row.input!.phoneE164)) {
      row.result.status = 'exists';
      row.result.reason = 'A client with this phone number already exists.';
      row.result.phone = row.input!.phoneE164;
      delete row.input;
    }
  }
  return analysis;
}

const problems = (rows: Analysis['rows']): ImportRowResult[] =>
  rows.filter((r) => r.result.status !== 'valid').map((r) => r.result);

clientImportRouter.post('/clients/import/preview', async (req, res) => {
  const analysis = await analyze(req.body);
  const data: ImportPreview = {
    headers: analysis.headers,
    mapping: analysis.mapping,
    counts: countRows(analysis.rows),
    sample: analysis.rows.slice(0, 20).map((r) => r.result),
    issues: problems(analysis.rows),
  };
  res.json({ data });
});

clientImportRouter.post('/clients/import/commit', async (req, res) => {
  const analysis = await analyze(req.body);
  const toInsert = analysis.rows
    .filter((r) => r.result.status === 'valid')
    .map((r) => ({ row: r.result.row, input: r.input! }));

  const { created, failed } = await insertClientsBulk(toInsert);

  // One audit row per client, without personal data
  await writeAuditBatch(
    created.map((c) => ({
      actorId: req.user!.id,
      action: 'client.import',
      entity: 'clients',
      entityId: c.id,
      after: { id: c.id, importRow: c.row },
    })),
  );

  const failedByRow = new Map(failed.map((f) => [f.row, f.reason]));
  const issues = analysis.rows
    .map((r) =>
      failedByRow.has(r.result.row)
        ? { ...r.result, status: 'invalid' as const, reason: failedByRow.get(r.result.row) }
        : r.result,
    )
    .filter((r) => r.status !== 'valid');

  const result: ImportResult = {
    created: created.length,
    skipped: issues.length - failed.length,
    failed: failed.length,
    headers: analysis.headers,
    issues,
  };
  res.json({ data: result });
});
