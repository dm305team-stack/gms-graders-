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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import 'dotenv/config';

import { brandVariants } from '@gms/llm';

import { emailConfigured, sendLeadNotification, sendReportEmail } from './email.js';
import { generateQueries, runPipeline } from './pipeline.js';
import { renderEmailHtml } from './report.js';
import {
  listAudits,
  readSidecar,
  reportPath,
  toListItem,
  type AuditListItem,
  type StoredAnalysis,
} from './storage.js';
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

/**
 * Up to 5 client-curated prompts (Peec-style), trimmed, deduped, brand-free.
 * AEO rule: a prompt that names the brand or its domain corrupts the measurement,
 * so we drop those silently (the client is guided not to include them).
 */
function parseCustomQueries(raw: unknown, brand: string, domain: string): string[] {
  if (!Array.isArray(raw)) return [];
  const variants = brandVariants(brand, domain)
    .map((v) => v.toLowerCase())
    .filter((v) => v.length >= 3);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw.slice(0, 5)) {
    const q = str(item, 150);
    if (!q) continue;
    const lc = q.toLowerCase();
    if (variants.some((v) => lc.includes(v))) continue; // brand-free guard
    const key = lc.replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

/** Canned long-tail suggestions for mock mode, so the review step works offline. */
function mockSuggestions(input: RunAnalysisInput): string[] {
  const p = input.product || input.specialty || 'services';
  const loc = input.location || 'your area';
  return [
    `where can I find ${p} near ${loc}`,
    `best ${p} in ${loc} for first-timers`,
    `how much does ${p} cost in ${loc}`,
    `who offers ${p} close to ${loc} with good reviews`,
    `looking for ${p} in ${loc}, what are my options`,
  ];
}

/** Validate the 5-field scope form posted to /api/run-analysis. */
function parseRunInput(body: unknown): { input?: RunAnalysisInput; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const domain = normalizeDomain(str(b.domain, 200));
  const brand = str(b.brand, 200);
  const input: RunAnalysisInput = {
    domain,
    brand,
    location: str(b.location, 200),
    specialty: str(b.specialty, 80),
    product: str(b.product, 200),
    custom_queries: parseCustomQueries(b.custom_queries, brand, domain),
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

/** Detail view for the operator console: includes the full synthesis blob. */
function detailView(a: Analysis | StoredAnalysis) {
  return {
    analysis_id: a.analysis_id,
    input: a.input,
    status: a.status,
    stage_label: STAGE_LABELS[a.status],
    created_at: a.created_at,
    finished_at: a.finished_at ?? null,
    error: a.error ?? null,
    overall_scores: a.overall_scores ?? null,
    cost_usd: a.cost_usd ?? null,
    stats: a.stats ?? null,
    synthesis: a.synthesis ?? null,
    report_url: a.report_path ? `/api/analyses/${a.analysis_id}/report` : null,
    pdf_url: a.pdf_path ? `/api/analyses/${a.analysis_id}/report.pdf` : null,
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

/**
 * Review step: turn the scope into 5 editable long-tail prompt suggestions
 * (Peec-style). One Haiku call, no engines. The client edits these, then posts
 * them back as `custom_queries` to /api/run-analysis.
 */
app.post('/api/suggest-queries', async (req, res) => {
  const { input, errors } = parseRunInput(req.body);
  if (!input) {
    return res.status(400).json({ error: 'invalid form payload', details: errors });
  }
  if (MOCK) {
    return res.json({ queries: mockSuggestions(input) });
  }
  try {
    const { queries } = await generateQueries(input, { count: 5, longtail: true });
    res.json({ queries: queries.map((q) => q.query) });
  } catch (err) {
    console.error('[suggest-queries] failed:', err);
    res.status(502).json({ error: 'could not generate suggestions' });
  }
});

/** Step 2: the scope + curated prompts. Creates the analysis and runs the audit. */
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

/** Operator console: every audit on disk, with live in-memory runs layered on top. */
app.get('/api/analyses', (_req, res) => {
  const byId = new Map<string, AuditListItem>();
  for (const item of listAudits()) byId.set(item.analysis_id, item);
  for (const a of analyses.values()) {
    byId.set(a.analysis_id, toListItem(a, 'memory', Boolean(a.contact)));
  }
  const items = [...byId.values()].sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
  res.json({ analyses: items, count: items.length });
});

app.get('/api/analyses/:id', (req, res) => {
  const analysis = analyses.get(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'analysis not found' });
  res.json(publicView(analysis));
});

/** Operator console detail: full synthesis from memory, falling back to the sidecar. */
app.get('/api/analyses/:id/data', (req, res) => {
  const live = analyses.get(req.params.id);
  if (live) return res.json(detailView(live));
  const stored = readSidecar(req.params.id);
  if (stored) return res.json(detailView(stored));
  return res.status(404).json({ error: 'analysis not found' });
});

app.get('/api/analyses/:id/report', (req, res) => {
  const analysis = analyses.get(req.params.id);
  if (analysis) {
    if (analysis.status !== 'done' || !analysis.report_path) {
      return res.status(409).send(`report not ready (status: ${analysis.status})`);
    }
    return res.type('html').sendFile(analysis.report_path);
  }
  // Not in memory (server restarted, or legacy report): serve from disk if present.
  const diskPath = reportPath(req.params.id, 'html');
  if (fs.existsSync(diskPath)) return res.type('html').sendFile(diskPath);
  return res.status(404).send('analysis not found');
});

app.get('/api/analyses/:id/report.pdf', (req, res) => {
  const analysis = analyses.get(req.params.id);
  if (analysis) {
    if (analysis.status !== 'done' || !analysis.pdf_path) {
      return res.status(409).send(`report not ready (status: ${analysis.status})`);
    }
    return res.type('pdf').sendFile(analysis.pdf_path);
  }
  const diskPath = reportPath(req.params.id, 'pdf');
  if (fs.existsSync(diskPath)) return res.type('pdf').sendFile(diskPath);
  return res.status(404).send('analysis not found');
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
