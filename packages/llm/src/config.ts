/**
 * @gms/llm — Config
 *
 * Resuelve API keys y model IDs desde environment variables.
 * Funciona tanto en Node como en Deno (Supabase Edge Functions).
 */

import { DEFAULT_MODELS } from './pricing.js';
import type { EngineId } from './types.js';

/**
 * Lectura agnóstica de env vars. En Deno usa Deno.env, en Node usa process.env.
 */
function readEnv(key: string): string | undefined {
  // @ts-expect-error — Deno global no existe en types de Node, intencional
  if (typeof Deno !== 'undefined') {
    // @ts-expect-error — runtime check
    return Deno.env.get(key);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

export function getApiKey(engine: EngineId): string {
  const keyName = {
    claude: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
  }[engine];

  const value = readEnv(keyName);
  if (!value) {
    throw new Error(
      `Missing env var ${keyName} for engine "${engine}". ` +
      `Set it in .env or the runtime environment.`,
    );
  }
  return value;
}

export function getModel(engine: EngineId): string {
  const overrideKey = {
    claude: 'ANTHROPIC_MODEL',
    openai: 'OPENAI_MODEL',
    gemini: 'GEMINI_MODEL',
    perplexity: 'PERPLEXITY_MODEL',
  }[engine];

  return readEnv(overrideKey) ?? DEFAULT_MODELS[engine];
}

/**
 * Modelo rápido y barato para tareas auxiliares (parsing, generación de queries).
 * Default: claude-haiku-4-5.
 */
export function getFastModel(): string {
  return readEnv('ANTHROPIC_MODEL_FAST') ?? 'claude-haiku-4-5-20251001';
}
