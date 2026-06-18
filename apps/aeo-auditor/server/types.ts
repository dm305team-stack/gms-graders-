/**
 * Shared types for the AEO Visibility Auditor backend.
 *
 * Phase 1 keeps analysis state in memory (no Supabase yet), mirroring the
 * pattern used by the HIPAA grader's hpx-api. The aeo.sql schema describes
 * the eventual persisted shape; this is the runtime subset the server needs.
 *
 * The funnel is two-step: the scope form (RunAnalysisInput) starts the audit;
 * the unlock gate (UnlockInput) captures the lead and triggers delivery.
 */

import type { SynthesizeOutput, EngineResults } from '@gms/llm';

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
  | 'done'
  | 'failed';

/** The 5-field scope form posted to POST /api/run-analysis. No contact. */
export interface RunAnalysisInput {
  domain: string;
  brand: string;
  location: string;
  specialty: string;
  /** Free-text product or service line, from the scope form. */
  product: string;
}

/** Contact details captured at the unlock gate, posted to POST /api/analyses/:id/unlock. */
export interface UnlockInput {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

/** In-memory record for one analysis run. */
export interface Analysis {
  analysis_id: string;
  input: RunAnalysisInput;
  /** Lead contact, captured at the unlock gate. Absent until the visitor unlocks. */
  contact?: UnlockInput;
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
  /**
   * Stage C raw output per engine: parsed responses (brand_mentioned, position,
   * etc.) + the real citations the engine returned. Persisted in the sidecar so
   * the scoring is auditable. Absent on mock runs.
   */
  parsed_engine_results?: EngineResults[];
  /** Aggregate LLM cost for the run, in USD. */
  cost_usd?: number;
  /** Engine call counters, for the status payload. */
  stats?: { queries: number; engine_calls: number; engine_errors: number };
  /** Outcome of the report email to the visitor, set at unlock. */
  email?: { sent?: boolean; skipped?: boolean; error?: string };
  /** Internal start timestamp (ms), stripped from API responses. */
  _t0: number;
}

/** Human-readable labels for each stage, shown in the polling UI. */
export const STAGE_LABELS: Record<AnalysisStatus, string> = {
  queued: 'Queued',
  generating_queries: 'Generating patient search queries',
  running_engines: 'Querying the AI engines',
  parsing: 'Extracting structured signal',
  synthesizing: 'Synthesizing the report',
  rendering: 'Rendering the report',
  done: 'Complete',
  failed: 'Failed',
};
