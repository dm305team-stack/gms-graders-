/**
 * @gms/llm — Public API
 *
 * Wrapper unificado para los 4 motores de IA evaluados por los graders GMS.
 *
 * Uso típico:
 *
 *   import { createClient, type EngineId } from '@gms/llm';
 *
 *   const claude = createClient('claude');
 *   const response = await claude.complete({
 *     system: 'Eres un experto en X',
 *     messages: [{ role: 'user', content: 'Hola' }],
 *     enableCache: true,
 *   });
 *
 *   console.log(response.content, response.costUsd);
 */

export * from './types.js';
export { calculateCost, supportsCaching, DEFAULT_MODELS, MODEL_PRICING } from './pricing.js';
export { getApiKey, getModel, getFastModel } from './config.js';

export { ClaudeClient } from './clients/claude.js';
export { OpenAIClient } from './clients/openai.js';
export { GeminiClient } from './clients/gemini.js';
export { PerplexityClient } from './clients/perplexity.js';

import type { EngineId, LLMClient } from './types.js';
import { ClaudeClient } from './clients/claude.js';
import { OpenAIClient } from './clients/openai.js';
import { GeminiClient } from './clients/gemini.js';
import { PerplexityClient } from './clients/perplexity.js';

/**
 * Factory para crear un cliente por engine ID.
 * Lazy: solo instancia el cliente cuando se pide.
 */
export function createClient(engine: EngineId): LLMClient {
  switch (engine) {
    case 'claude':     return new ClaudeClient();
    case 'openai':     return new OpenAIClient();
    case 'gemini':     return new GeminiClient();
    case 'perplexity': return new PerplexityClient();
    default: {
      const _exhaustive: never = engine;
      throw new Error(`Unknown engine: ${_exhaustive}`);
    }
  }
}

/**
 * Crea todos los clientes a la vez. Útil para los grader runners que
 * evalúan los 4 motores en paralelo.
 */
export function createAllClients(): Record<EngineId, LLMClient> {
  return {
    claude:     new ClaudeClient(),
    openai:     new OpenAIClient(),
    gemini:     new GeminiClient(),
    perplexity: new PerplexityClient(),
  };
}

// ---- Prompts versionados ----
export {
  GENERATE_QUERIES_PROMPT_V1,
  buildGenerateQueriesUserPrompt,
  type GenerateQueriesInput,
  type GeneratedQuery,
  type GenerateQueriesOutput,
} from './prompts/generate-queries.js';

export {
  PARSE_RESPONSE_PROMPT_V1,
  buildParseResponseUserPrompt,
  brandVariants,
  type ParseResponseInput,
  type ParsedResponse,
} from './prompts/parse-response.js';

export {
  SYNTHESIZE_REPORT_PROMPT_V1,
  buildSynthesizeUserPrompt,
  type SynthesizeInput,
  type SynthesizeOutput,
  type EngineReport,
  type EngineResults,
} from './prompts/synthesize.js';

export { loadResearchBase } from './research/loader.js';
