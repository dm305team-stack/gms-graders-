/**
 * @gms/llm — Base client
 *
 * Clase abstracta con retry, timeout, y normalización de errores.
 * Cada cliente concreto implementa `executeRequest`.
 */

import type {
  EngineId,
  LLMClient,
  LLMRequest,
  LLMResponse,
} from '../types.js';
import { LLMError } from '../types.js';

const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 60_000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 16_000;

export abstract class BaseLLMClient implements LLMClient {
  abstract readonly engine: EngineId;
  abstract readonly defaultModel: string;

  protected abstract executeRequest(request: LLMRequest): Promise<LLMResponse>;

  async complete(request: LLMRequest): Promise<LLMResponse> {
    return retryWithBackoff(
      () => this.runWithTimeout(request),
      DEFAULT_RETRIES,
      this.engine,
    );
  }

  private async runWithTimeout(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      return await this.executeRequest(request);
    } catch (err) {
      if (controller.signal.aborted) {
        throw new LLMError(
          `Request to ${this.engine} timed out after ${DEFAULT_TIMEOUT_MS}ms`,
          this.engine,
          undefined,
          true,
          err,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Retry con exponential backoff. Solo reintenta si el error es retryable.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  engine: EngineId,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isRetryable = err instanceof LLMError ? err.retryable : isRetryableError(err);

      if (!isRetryable || attempt === maxAttempts - 1) {
        throw err;
      }

      const backoff = Math.min(
        INITIAL_BACKOFF_MS * Math.pow(2, attempt),
        MAX_BACKOFF_MS,
      );
      const jitter = Math.random() * 250;
      await sleep(backoff + jitter);
    }
  }

  throw lastError ?? new LLMError(`Unknown error in retry loop`, engine);
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('rate limit') ||
      msg.includes('429') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout')
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
