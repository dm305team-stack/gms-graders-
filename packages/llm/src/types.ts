/**
 * @gms/llm — Shared types
 *
 * Tipos comunes para el wrapper unificado de los 4 motores de IA evaluados
 * por los graders de GMS.
 */

export type EngineId = 'claude' | 'openai' | 'gemini' | 'perplexity';

/**
 * Mensaje en una conversación. Compatible con OpenAI message format,
 * que es el de-facto standard adoptado por los 4 proveedores.
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Request unificado a cualquier motor.
 */
export interface LLMRequest {
  messages: LLMMessage[];
  /** System prompt separado. Para Claude se mapea a `system`, para OpenAI a `messages[0]`. */
  system?: string;
  /** 0.0 a 2.0. Default 0.3 (preferimos consistencia para extracción estructurada). */
  temperature?: number;
  /** Max output tokens. Default 4096. */
  maxTokens?: number;
  /** Si está activo, activa prompt caching cuando el proveedor lo soporte (Claude). */
  enableCache?: boolean;
  /** Force JSON mode cuando el proveedor lo soporte. */
  jsonMode?: boolean;
  /** Override del modelo. Si no se pasa, usa el del config. */
  modelOverride?: string;
  /** Solo para Perplexity. Si está presente, fuerza búsqueda web. */
  searchRecency?: 'hour' | 'day' | 'week' | 'month' | 'year';
  /**
   * Activa búsqueda web / grounding en el proveedor (cuando lo soporta).
   * Solo lo prenden las llamadas a motores evaluados (Stage B del pipeline AEO):
   * mide lo que el usuario ve al buscar, no la memoria paramétrica del modelo.
   * Las stages auxiliares (generación de queries, parsing, síntesis) lo dejan
   * en false porque operan sobre texto ya provisto y no deben buscar.
   * Perplexity ignora este flag (siempre busca).
   */
  webSearch?: boolean;
}

/**
 * Respuesta normalizada de cualquier motor.
 */
export interface LLMResponse {
  /** Texto generado por el modelo. */
  content: string;
  /** Engine que respondió. */
  engine: EngineId;
  /** Model ID concreto que se usó. */
  model: string;
  /** Tokens consumidos. */
  tokensIn: number;
  tokensOut: number;
  /** Tokens leídos de cache (Claude). 0 si no aplica. */
  tokensCached?: number;
  /** Costo estimado en USD. Calculado en client side usando pricing.ts. */
  costUsd: number;
  /** Latencia total en ms. */
  latencyMs: number;
  /** Fuentes citadas (solo para Perplexity y Claude con web search). */
  sources?: Array<{ url: string; title?: string; snippet?: string }>;
  /** Respuesta cruda del SDK, por si se necesita debug. */
  raw: unknown;
}

/**
 * Error estructurado de llamada a LLM.
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public engine: EngineId,
    public statusCode?: number,
    public retryable: boolean = false,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * Interfaz que todo cliente concreto debe implementar.
 */
export interface LLMClient {
  readonly engine: EngineId;
  readonly defaultModel: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
}

/**
 * Telemetría agregada por análisis.
 */
export interface LLMTelemetry {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  byEngine: Record<EngineId, {
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    avgLatencyMs: number;
  }>;
}
