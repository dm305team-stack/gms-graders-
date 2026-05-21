/**
 * aeo-api — backend for the AEO Visibility Auditor.
 *
 *   POST /api/run-analysis            accept the 5-field scope form, run the audit
 *   GET  /api/analyses/:id            status polling
 *   GET  /api/analyses/:id/report     the rendered HTML report
 *   GET  /api/analyses/:id/report.pdf the rendered PDF report
 *   POST /api/analyses/:id/unlock     capture the lead, email the report + lead notice
 *   GET  /api/health                  readiness / config check
 *
 * The funnel is two-step: /run-analysis starts the audit with no contact;
 * /unlock captures the lead once the report is ready and sends both emails.
 *
 * Run with: pnpm --filter @gms/aeo-auditor api
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import 'dotenv/config';

import { emailConfigured, sendLeadNotification, sendReportEmail } from './email.js';
import { runPipeline } from './pipeline.js';
import { renderEmailHtml } from './report.js';
import { STAGE_LABELS, type Analysis, type RunAnalysisInput, type UnlockInput } from './types.js';

/** ESM has no __dirname; derive it from import.meta.url. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Hostinger assigns PORT; fall back to AEO_API_PORT, then the dev default. */
const PORT = Number(process.env.PORT || process.env.AEO_API_PORT || 3334);
const MOCK = process.env.AEO_MOCK_PIPELINE === 'true';

/** In-memory analysis store. Phase 2 moves this to aeo.analyses in Postgres. */
const analyses = new Map<string, Analysis>();

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

/** Validate the 5-field scope form posted to /api/run-analysis. */
function parseRunInput(body: unknown): { input?: RunAnalysisInput; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const input: RunAnalysisInput = {
    domain: normalizeDomain(str(b.domain, 200)),
    brand: str(b.brand, 200),
    location: str(b.location, 200),
    specialty: str(b.specialty, 80),
    product: str(b.product, 200),
  };

  const errors: string[] = [];
  if (!input.domain) errors.push('domain is required');
  if (!input.brand) errors.push('brand is required');
  if (!input.location) errors.push('location is required');
  if (!input.specialty) errors.push('specialty is required');
  if (!input.product) errors.push('product is required');

  return errors.length ? { errors } : { input, errors };
}

/** Validate the contact details posted to /api/analyses/:id/unlock. */
function parseUnlockInput(body: unknown): { contact?: UnlockInput; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const contact: UnlockInput = {
    email: str(b.email, 200),
    firstName: str(b.firstName, 120),
    lastName: str(b.lastName, 120),
    phone: str(b.phone, 60),
  };

  const errors: string[] = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) {
    errors.push('a valid email is required');
  }
  if (!contact.firstName) errors.push('firstName is required');
  if (!contact.lastName) errors.push('lastName is required');
  if (!contact.phone) errors.push('phone is required');

  return errors.length ? { errors } : { contact, errors };
}

/** Public view of an analysis: drops internals and the large synthesis blob. */
function publicView(a: Analysis) {
  return {
    analysis_id: a.analysis_id,
    status: a.status,
    stage_label: STAGE_LABELS[a.status],
    created_at: a.created_at,
    finished_at: a.finished_at ?? null,
    error: a.error ?? null,
    overall_scores: a.overall_scores ?? null,
    cost_usd: a.cost_usd ?? null,
    stats: a.stats ?? null,
    unlocked: Boolean(a.contact),
    report_url:
      a.status === 'done' && a.report_path ? `/api/analyses/${a.analysis_id}/report` : null,
    pdf_url:
      a.status === 'done' && a.pdf_path ? `/api/analyses/${a.analysis_id}/report.pdf` : null,
  };
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mock_pipeline: MOCK,
    smtp_configured: emailConfigured(),
    anthropic_configured: Boolean(process.env.ANTHROPIC_API_KEY),
    active: [...analyses.values()].filter((a) => !['done', 'failed'].includes(a.status)).length,
  });
});

/** Step 1: the 5-field scope form. Creates the analysis and runs the audit. */
app.post('/api/run-analysis', (req, res) => {
  const { input, errors } = parseRunInput(req.body);
  if (!input) {
    return res.status(400).json({ error: 'invalid form payload', details: errors });
  }

  const analysisId = `AEO-${crypto.randomBytes(4).toString('hex')}`;
  const analysis: Analysis = {
    analysis_id: analysisId,
    input,
    status: 'queued',
    created_at: new Date().toISOString(),
    _t0: Date.now(),
  };
  analyses.set(analysisId, analysis);
  console.log(`[${analysisId}] queued · ${input.brand} · ${input.domain}`);

  // Run the pipeline in the background; respond immediately. No email here:
  // delivery happens at the unlock gate, once the visitor leaves contact details.
  setImmediate(() => {
    runPipeline(analysis).catch((err) => {
      console.error(`[${analysisId}] unhandled pipeline error:`, err);
    });
  });

  res.status(202).json({
    analysis_id: analysisId,
    status: analysis.status,
    estimated_seconds: MOCK ? 10 : 240,
  });
});

app.get('/api/analyses/:id', (req, res) => {
  const analysis = analyses.get(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'analysis not found' });
  res.json(publicView(analysis));
});

app.get('/api/analyses/:id/report', (req, res) => {
  const analysis = analyses.get(req.params.id);
  if (!analysis) return res.status(404).send('analysis not found');
  if (analysis.status !== 'done' || !analysis.report_path) {
    return res.status(409).send(`report not ready (status: ${analysis.status})`);
  }
  res.type('html').sendFile(analysis.report_path);
});

app.get('/api/analyses/:id/report.pdf', (req, res) => {
  const analysis = analyses.get(req.params.id);
  if (!analysis) return res.status(404).send('analysis not found');
  if (analysis.status !== 'done' || !analysis.pdf_path) {
    return res.status(409).send(`report not ready (status: ${analysis.status})`);
  }
  res.type('pdf').sendFile(analysis.pdf_path);
});

/** Step 3: the contact gate. Captures the lead and sends both emails. */
app.post('/api/analyses/:id/unlock', async (req, res) => {
  const analysis = analyses.get(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'analysis not found' });

  const { contact, errors } = parseUnlockInput(req.body);
  if (!contact) {
    return res.status(400).json({ error: 'invalid contact details', details: errors });
  }
  if (analysis.status !== 'done' || !analysis.synthesis || !analysis.pdf_path) {
    return res.status(409).json({ error: `report not ready (status: ${analysis.status})` });
  }

  analysis.contact = contact;
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  console.log(`[${analysis.analysis_id}] unlocked · ${fullName} · ${contact.email}`);

  // Fire both emails in parallel: the report to the visitor, the lead notice
  // (same PDF attached) to the GMS owner inbox.
  const [clientEmail, leadEmail] = await Promise.all([
    sendReportEmail({
      to: contact.email,
      fullName,
      brand: analysis.input.brand,
      domain: analysis.input.domain,
      analysisId: analysis.analysis_id,
      emailHtml: renderEmailHtml(analysis, analysis.synthesis),
      pdfPath: analysis.pdf_path,
    }),
    sendLeadNotification(analysis),
  ]);
  analysis.email = clientEmail;

  res.json({
    analysis_id: analysis.analysis_id,
    client_email: clientEmail,
    lead_email: leadEmail,
    report_url: `/api/analyses/${analysis.analysis_id}/report`,
    pdf_url: `/api/analyses/${analysis.analysis_id}/report.pdf`,
  });
});

// In production, Express serves the built frontend (apps/aeo-auditor/dist)
// same-origin: /api and the SPA share one host, no Vite proxy. API handlers
// are registered above, so they take precedence over the SPA fallback.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[aeo-api] listening on http://0.0.0.0:${PORT}`);
  console.log(`[aeo-api] pipeline: ${MOCK ? 'MOCK (no LLM calls)' : 'REAL (@gms/llm)'}`);
  console.log(`[aeo-api] ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET'}`);
  console.log(
    `[aeo-api] email: ${emailConfigured() ? 'Resend configured' : 'NOT SET — emails skipped'}`,
  );
});
