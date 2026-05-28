/**
 * API response shapes for the operator console. These mirror the server's
 * storage.AuditListItem and index.detailView outputs. The console is a separate
 * Vite bundle, so it does not import server types directly; SynthesizeOutput /
 * EngineReport come from @gms/llm (the shared source of truth for the data).
 */
import type { SynthesizeOutput, EngineReport } from '@gms/llm';

export type { SynthesizeOutput, EngineReport };

export type EngineLabel = 'chatgpt' | 'perplexity' | 'gemini' | 'claude';

export interface AuditStats {
  queries: number;
  engine_calls: number;
  engine_errors: number;
}

export interface AuditListItem {
  analysis_id: string;
  brand: string;
  domain: string;
  location: string;
  specialty: string;
  status: string;
  stage_label: string;
  created_at: string;
  finished_at: string | null;
  error: string | null;
  overall_scores: Record<string, number> | null;
  cost_usd: number | null;
  stats: AuditStats | null;
  unlocked: boolean;
  has_charts: boolean;
  source: 'memory' | 'sidecar' | 'file';
  report_url: string | null;
  pdf_url: string | null;
}

export interface AuditDetail {
  analysis_id: string;
  input: {
    domain: string;
    brand: string;
    location: string;
    specialty: string;
    product: string;
  };
  status: string;
  stage_label: string;
  created_at: string;
  finished_at: string | null;
  error: string | null;
  overall_scores: Record<string, number> | null;
  cost_usd: number | null;
  stats: AuditStats | null;
  synthesis: SynthesizeOutput | null;
  report_url: string | null;
  pdf_url: string | null;
}

/** The four engines, in canonical display order, with their accent colors. */
export const ENGINES: { label: EngineLabel; name: string; color: string }[] = [
  { label: 'chatgpt', name: 'ChatGPT', color: '#1f3a5f' },
  { label: 'perplexity', name: 'Perplexity', color: '#b04a26' },
  { label: 'gemini', name: 'Gemini', color: '#e25a1f' },
  { label: 'claude', name: 'Claude', color: '#5a3a3a' },
];

/** The six scored dimensions, in display order. */
export const DIMENSIONS: { key: keyof EngineReport['scores']; label: string }[] = [
  { key: 'brand_recognition', label: 'Brand recognition' },
  { key: 'market_position', label: 'Market position' },
  { key: 'presence_quality', label: 'Presence quality' },
  { key: 'brand_perception', label: 'Brand perception' },
  { key: 'share_of_voice', label: 'Share of voice' },
  { key: 'overall', label: 'Overall' },
];
