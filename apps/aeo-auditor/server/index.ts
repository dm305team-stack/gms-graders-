/**
 * aeo-api — backend for the AEO Visibility Auditor.
 *
 * Ported from the HIPAA grader's hpx-api pattern: a small Express server with
 * in-memory job state (Phase 1, no Supabase yet).
 *
 *   POST /api/run-analysis        accept the form, return analysis_id (202)
 *   GET  /api/analyses/:id        status polling
 *   GET  /api/analyses/:id/report download the rendered HTML report
 *   GET  /api/health              readiness / config check
 *
 * Run with: pnpm --filter @gms/aeo-auditor api
 */

import crypto from 'node:crypto';
import express from 'express';
import 'dotenv/config';

import { emailConfigured } from './email.js';
import { runPipeline } from './pipeline.js';
import { STAGE_LABELS, type Analysis, type AnalysisInput } from './types.js';

const PORT = Number(process.env.AEO_API_PORT || 3334);
const MOCK = process.env.AEO_MOCK_PIPELINE === 'true';

/** In-memory analysis store. Phase 2 moves this to aeo.analyses in Postgres. */
const analyses = new Map<string, Analysis>();

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Validate and normalize the form payload. Returns the input or a list of errors. */
function parseInput(body: unknown): { input?: AnalysisInput; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const contact = (b.contact ?? {}) as Record<string, unknown>;
  const social = (b.social ?? {}) as Record<string, unknown>;

  const input: AnalysisInput = {
    domain: normalizeDomain(str(b.domain, 200)),
    brand: str(b.brand, 200),
    location: str(b.location, 200),
    specialty: str(b.specialty, 80),
    social: {
      yt: str(social.yt, 300),
      ig: str(social.ig, 300),
      tt: str(social.tt, 300),
      fb: str(social.fb, 300),
    },
    contact: {
      name: str(contact.name, 160),
      company: str(contact.company, 200),
      email: str(contact.email, 200),
      phone: str(contact.phone, 60),
    },
    org_type: str(b.org_type, 60),
    confirm_authorized: b.confirm_authorized === true,
  };

  const errors: string[] = [];
  if (!input.domain) errors.push('domain is required');
  if (!input.brand) errors.push('brand is required');
  if (!input.location) errors.push('location is required');
  if (!input.specialty) errors.push('specialty is required');
  if (!input.org_type) errors.push('org_type is required');
  if (!input.contact.name) errors.push('contact.name is required');
  if (!input.contact.company) errors.push('contact.company is required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.contact.email)) {
    errors.push('a valid contact.email is required');
  }
  if (!input.contact.phone) errors.push('contact.phone is required');
  if (!input.confirm_authorized) errors.push('confirm_authorized must be true');

  return errors.length ? { errors } : { input, errors };
}

function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
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
    email: a.email ?? null,
    report_url: a.status === 'done' && a.report_path ? `/api/analyses/${a.analysis_id}/report` : null,
    pdf_url: a.status === 'done' && a.pdf_path ? `/api/analyses/${a.analysis_id}/report.pdf` : null,
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

app.post('/api/run-analysis', (req, res) => {
  const { input, errors } = parseInput(req.body);
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
  console.log(`[${analysisId}] queued · ${input.brand} · ${input.domain} · ${input.contact.email}`);

  // Kick off the pipeline in the background; respond immediately.
  setImmediate(() => {
    runPipeline(analysis).catch((err) => {
      console.error(`[${analysisId}] unhandled pipeline error:`, err);
    });
  });

  res.status(202).json({
    analysis_id: analysisId,
    status: analysis.status,
    estimated_seconds: MOCK ? 10 : 240,
    delivery_email: input.contact.email,
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

app.listen(PORT, () => {
  console.log(`[aeo-api] listening on http://localhost:${PORT}`);
  console.log(`[aeo-api] pipeline: ${MOCK ? 'MOCK (no LLM calls)' : 'REAL (@gms/llm)'}`);
  console.log(`[aeo-api] ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET'}`);
  console.log(`[aeo-api] SMTP: ${emailConfigured() ? process.env.SMTP_HOST : 'NOT SET — emails skipped'}`);
});
