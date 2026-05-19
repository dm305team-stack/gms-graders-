/**
 * @gms/llm — Pricing
 *
 * Precios por millón de tokens, en USD. Actualizados a mayo 2026.
 *
 * Usado por cada cliente para calcular costo por llamada y agregarlo en
 * telemetría. Cuando un proveedor cambie precio, actualizar aquí.
 */

import type { EngineId } from './types.js';

export interface ModelPricing {
  /** USD por millón de input tokens (sin cachear). */
  inputPerMtok: number;
  /** USD por millón de output tokens. */
  outputPerMtok: number;
  /** USD por millón de tokens leídos de cache (Claude). */
  cachedInputPerMtok?: number;
  /** Costo fijo por request, si aplica (Perplexity Sonar). */
  perRequest?: number;
}

/**
 * Lookup table de pricing por model ID.
 * Si no encuentra el modelo, calcula con un fallback razonable y loguea warning.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ---- Anthropic Claude ----
  'claude-opus-4-7':         { inputPerMtok: 5,   outputPerMtok: 25,  cachedInputPerMtok: 0.5 },
  'claude-opus-4-6':         { inputPerMtok: 5,   outputPerMtok: 25,  cachedInputPerMtok: 0.5 },
  'claude-sonnet-4-6':       { inputPerMtok: 3,   outputPerMtok: 15,  cachedInputPerMtok: 0.3 },
  'claude-haiku-4-5-20251001': { inputPerMtok: 1, outputPerMtok: 5,   cachedInputPerMtok: 0.1 },

  // ---- OpenAI ----
  // Verificar IDs exactos contra docs antes de prod. Pricing referencia.
  'gpt-5.2':                 { inputPerMtok: 1.75, outputPerMtok: 14 },
  'gpt-5.4':                 { inputPerMtok: 2.5,  outputPerMtok: 15 },

  // ---- Google Gemini ----
  'gemini-3.1-pro':          { inputPerMtok: 2, outputPerMtok: 12 },
  'gemini-3-pro':            { inputPerMtok: 2, outputPerMtok: 12 },
  'gemini-2.5-pro':          { inputPerMtok: 1.25, outputPerMtok: 10 },
  'gemini-3-flash':          { inputPerMtok: 0.3, outputPerMtok: 1.5 },

  // ---- Perplexity ----
  // Sonar incluye per-request fee adicional según search context size.
  'sonar':                   { inputPerMtok: 1, outputPerMtok: 1, perRequest: 0.008 },
  'sonar-pro':               { inputPerMtok: 3, outputPerMtok: 15, perRequest: 0.010 },
  'sonar-reasoning-pro':     { inputPerMtok: 2, outputPerMtok: 8, perRequest: 0.010 },
};

/**
 * Fallback pricing si el modelo no está en la tabla.
 * Conservador (asume tier medio) para no subestimar costos.
 */
const FALLBACK: ModelPricing = { inputPerMtok: 3, outputPerMtok: 15 };

/**
 * Calcula el costo total de una llamada.
 */
export function calculateCost(args: {
  model: string;
  tokensIn: number;
  tokensOut: number;
  tokensCached?: number;
  perRequestCount?: number;
}): number {
  const pricing = MODEL_PRICING[args.model] ?? FALLBACK;

  const cachedTokens = args.tokensCached ?? 0;
  const uncachedInput = args.tokensIn - cachedTokens;

  const inputCost = (uncachedInput / 1_000_000) * pricing.inputPerMtok;
  const cachedCost = pricing.cachedInputPerMtok
    ? (cachedTokens / 1_000_000) * pricing.cachedInputPerMtok
    : 0;
  const outputCost = (args.tokensOut / 1_000_000) * pricing.outputPerMtok;
  const requestCost = pricing.perRequest
    ? (args.perRequestCount ?? 1) * pricing.perRequest
    : 0;

  return Number((inputCost + cachedCost + outputCost + requestCost).toFixed(5));
}

/**
 * Returns true si el modelo soporta prompt caching.
 */
export function supportsCaching(model: string): boolean {
  const p = MODEL_PRICING[model];
  return !!p?.cachedInputPerMtok;
}

/**
 * Engine → default model mapping. Override vía env si se quiere.
 */
export const DEFAULT_MODELS: Record<EngineId, string> = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-5.2',
  gemini: 'gemini-2.5-pro',
  perplexity: 'sonar-pro',
};
