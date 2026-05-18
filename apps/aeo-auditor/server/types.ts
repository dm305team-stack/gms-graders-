/**
 * Shared types for the AEO Visibility Auditor backend.
 *
 * Phase 1 keeps analysis state in memory (no Supabase yet), mirroring the
 * pattern used by the HIPAA grader's hpx-api. The aeo.sql schema describes
 * the eventual persisted shape; this is the runtime subset the server needs.
 */

import type { SynthesizeOutput } from '@gms/llm';

/** Engine labels as used in the report (the AEO domain calls OpenAI "chatgpt"). */
export type EngineLabel = 'chatgpt' | 'perplexity' | 'gemini' | 'claude';

/** Pipeline stages, surfaced to the frontend for polling. */
export type AnalysisStatus =
  | 'queued'
  | 'generating_queries'
  | 'running_engines'
  | 'parsing'
  | 'synthesizing'
  | 'rendering'
  | 'emailing'
  | 'done'
  | 'failed';

/** Raw form payload posted by AuditForm.tsx. */
export interface AnalysisInput {
  domain: string;
  brand: string;
  location: string;
  specialty: string;
  social: { yt: string; ig: string; tt: string; fb: string };
  contact: { name: string; company: string; email: string; phone: string };
  org_type: string;
  confirm_authorized: boolean;
}

/** In-memory record for one analysis run. */
export interface Analysis {
  analysis_id: string;
  input: AnalysisInput;
  status: AnalysisStatus;
  created_at: string;
  finished_at?: string;
  error?: string;
  /** Disk path to the rendered HTML report, once produced. */
  report_path?: string;
  /** Disk path to the rendered PDF report, once produced. */
  pdf_path?: string;
  /** {chatgpt, perplexity, gemini, claude} overall scores, once synthesized. */
  overall_scores?: Record<EngineLabel, number>;
  synthesis?: SynthesizeOutput;
  /** Aggregate LLM cost for the run, in USD. */
  cost_usd?: number;
  /** Engine call counters, for the status payload. */
  stats?: { queries: number; engine_calls: number; engine_errors: number };
  /** Outcome of the email send step. */
  email?: { sent?: boolean; skipped?: boolean; error?: string };
  /** Internal start timestamp (ms), stripped from API responses. */
  _t0: number;
}

/** Human-readable labels for each stage, shown in the polling UI. */
export const STAGE_LABELS: Record<AnalysisStatus, string> = {
  queued: 'Queued',
  generating_queries: 'Generating patient search queries',
  running_engines: 'Querying the 4 AI engines',
  parsing: 'Extracting structured signal',
  synthesizing: 'Synthesizing the report',
  rendering: 'Rendering the PDF-ready report',
  emailing: 'Sending the report by email',
  done: 'Complete',
  failed: 'Failed',
};
