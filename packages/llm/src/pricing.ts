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
  /** USD por búsqueda web (web_search tool / Google Search grounding). */
  searchPerCall?: number;
}

/**
 * Lookup table de pricing por model ID.
 * Si no encuentra el modelo, calcula con un fallback razonable y loguea warning.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ---- Anthropic Claude ----
  // web_search server tool: ~$10 / 1k búsquedas = $0.01/búsqueda.
  'claude-opus-4-7':         { inputPerMtok: 5,   outputPerMtok: 25,  cachedInputPerMtok: 0.5, searchPerCall: 0.01 },
  'claude-opus-4-6':         { inputPerMtok: 5,   outputPerMtok: 25,  cachedInputPerMtok: 0.5, searchPerCall: 0.01 },
  'claude-sonnet-4-6':       { inputPerMtok: 3,   outputPerMtok: 15,  cachedInputPerMtok: 0.3, searchPerCall: 0.01 },
  'claude-haiku-4-5-20251001': { inputPerMtok: 1, outputPerMtok: 5,   cachedInputPerMtok: 0.1 },

  // ---- OpenAI ----
  // Verificar IDs exactos contra docs antes de prod. Pricing referencia.
  // Responses API web_search tool: ~$10 / 1k llamadas = $0.01/búsqueda.
  'gpt-5.2':                 { inputPerMtok: 1.75, outputPerMtok: 14, searchPerCall: 0.01 },
  'gpt-5.4':                 { inputPerMtok: 2.5,  outputPerMtok: 15, searchPerCall: 0.01 },

  // ---- Google Gemini ----
  // Google Search grounding: ~$35 / 1k prompts grounded = $0.035/búsqueda.
  'gemini-3.1-pro':          { inputPerMtok: 2, outputPerMtok: 12, searchPerCall: 0.035 },
  'gemini-3-pro':            { inputPerMtok: 2, outputPerMtok: 12, searchPerCall: 0.035 },
  'gemini-2.5-pro':          { inputPerMtok: 1.25, outputPerMtok: 10, searchPerCall: 0.035 },
  'gemini-3-flash':          { inputPerMtok: 0.3, outputPerMtok: 1.5, searchPerCall: 0.035 },

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
  /** Número de búsquedas web ejecutadas por el motor en esta llamada. */
  searchCount?: number;
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
  const searchCost = pricing.searchPerCall
    ? (args.searchCount ?? 0) * pricing.searchPerCall
    : 0;

  return Number(
    (inputCost + cachedCost + outputCost + requestCost + searchCost).toFixed(5),
  );
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
