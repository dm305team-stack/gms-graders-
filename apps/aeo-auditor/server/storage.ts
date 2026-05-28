/**
 * Disk storage for analyses: JSON sidecars alongside the HTML/PDF reports.
 *
 * The in-memory Map in index.ts is wiped on every server restart (and every
 * tsx watch reload). To let the operator console list and inspect past audits,
 * runPipeline writes a <id>.json sidecar when a run finishes (done or failed).
 * Legacy reports that predate the sidecar still surface as file-only entries.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { STAGE_LABELS, type Analysis, type AnalysisStatus } from './types.js';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where reports (html, pdf) and sidecars (json) live. Shared with pipeline.ts. */
export const REPORTS_DIR = path.join(
  process.env.AEO_DATA_ROOT || path.join(APP_ROOT, '.aeo-data'),
  'reports',
);

/** Persisted shape: the Analysis minus runtime-only (_t0) and lead PII (contact). */
export type StoredAnalysis = Omit<Analysis, '_t0' | 'contact'> & { schema_version: 1 };

/** A row in the operator console list. */
export interface AuditListItem {
  analysis_id: string;
  brand: string;
  domain: string;
  location: string;
  specialty: string;
  status: AnalysisStatus;
  stage_label: string;
  created_at: string;
  finished_at: string | null;
  error: string | null;
  overall_scores: Analysis['overall_scores'] | null;
  cost_usd: number | null;
  stats: Analysis['stats'] | null;
  unlocked: boolean;
  has_charts: boolean;
  source: 'memory' | 'sidecar' | 'file';
  report_url: string | null;
  pdf_url: string | null;
}

const ID_FILE = /^(AEO-[0-9a-f]+)\.(html|pdf|json)$/i;

export function reportPath(id: string, ext: 'html' | 'pdf' | 'json'): string {
  return path.join(REPORTS_DIR, `${id}.${ext}`);
}

/** Write the <id>.json sidecar. Drops _t0 (internal) and contact (lead PII). */
export function persistSidecar(analysis: Analysis): void {
  try {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const { _t0, contact, ...rest } = analysis;
    void _t0;
    void contact;
    const stored: StoredAnalysis = { ...rest, schema_version: 1 };
    fs.writeFileSync(reportPath(analysis.analysis_id, 'json'), JSON.stringify(stored, null, 2), 'utf8');
  } catch (err) {
    console.error(`[${analysis.analysis_id}] failed to persist sidecar:`, err);
  }
}

/** Read a single <id>.json sidecar, or null if absent / unreadable. */
export function readSidecar(id: string): StoredAnalysis | null {
  try {
    const raw = fs.readFileSync(reportPath(id, 'json'), 'utf8');
    return JSON.parse(raw) as StoredAnalysis;
  } catch {
    return null;
  }
}

/** Build a list item from a sidecar or an in-memory analysis (same readable fields). */
export function toListItem(
  a: StoredAnalysis | Analysis,
  source: 'memory' | 'sidecar',
  unlocked: boolean,
): AuditListItem {
  return {
    analysis_id: a.analysis_id,
    brand: a.input.brand,
    domain: a.input.domain,
    location: a.input.location,
    specialty: a.input.specialty,
    status: a.status,
    stage_label: STAGE_LABELS[a.status],
    created_at: a.created_at,
    finished_at: a.finished_at ?? null,
    error: a.error ?? null,
    overall_scores: a.overall_scores ?? null,
    cost_usd: a.cost_usd ?? null,
    stats: a.stats ?? null,
    unlocked,
    has_charts: Boolean(a.synthesis),
    source,
    report_url: a.report_path ? `/api/analyses/${a.analysis_id}/report` : null,
    pdf_url: a.pdf_path ? `/api/analyses/${a.analysis_id}/report.pdf` : null,
  };
}

/** A legacy report (html/pdf) with no sidecar: openable, but no structured data. */
function fileOnlyItem(id: string, hasHtml: boolean, hasPdf: boolean, mtimeMs: number): AuditListItem {
  return {
    analysis_id: id,
    brand: '(legacy report)',
    domain: '',
    location: '',
    specialty: '',
    status: 'done',
    stage_label: STAGE_LABELS.done,
    created_at: new Date(mtimeMs).toISOString(),
    finished_at: new Date(mtimeMs).toISOString(),
    error: null,
    overall_scores: null,
    cost_usd: null,
    stats: null,
    unlocked: false,
    has_charts: false,
    source: 'file',
    report_url: hasHtml ? `/api/analyses/${id}/report` : null,
    pdf_url: hasPdf ? `/api/analyses/${id}/report.pdf` : null,
  };
}

/**
 * List every audit discoverable on disk: sidecars first (full data), then any
 * html/pdf without a sidecar as a file-only entry. Sorted newest first.
 * index.ts merges live in-memory runs on top of this.
 */
export function listAudits(): AuditListItem[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(REPORTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const sidecars = new Set<string>();
  const files = new Map<string, { hasHtml: boolean; hasPdf: boolean; mtimeMs: number }>();

  for (const e of entries) {
    if (!e.isFile()) continue;
    const m = e.name.match(ID_FILE);
    if (!m) continue;
    const id = m[1];
    const ext = m[2].toLowerCase();
    if (ext === 'json') {
      sidecars.add(id);
      continue;
    }
    const rec = files.get(id) ?? { hasHtml: false, hasPdf: false, mtimeMs: 0 };
    if (ext === 'html') rec.hasHtml = true;
    if (ext === 'pdf') rec.hasPdf = true;
    try {
      rec.mtimeMs = Math.max(rec.mtimeMs, fs.statSync(path.join(REPORTS_DIR, e.name)).mtimeMs);
    } catch {
      /* ignore stat errors */
    }
    files.set(id, rec);
  }

  const items: AuditListItem[] = [];
  for (const id of sidecars) {
    const s = readSidecar(id);
    if (s) items.push(toListItem(s, 'sidecar', false));
  }
  for (const [id, rec] of files) {
    if (sidecars.has(id)) continue;
    items.push(fileOnlyItem(id, rec.hasHtml, rec.hasPdf, rec.mtimeMs));
  }

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return items;
}
