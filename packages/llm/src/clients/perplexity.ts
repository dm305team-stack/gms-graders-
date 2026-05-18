/**
 * @gms/llm — Perplexity client
 *
 * Perplexity expone una API OpenAI-compatible, así que reusamos el SDK
 * de OpenAI apuntando a su baseURL. Modelos disponibles:
 *  - sonar (base, $1/$1, search-augmented)
 *  - sonar-pro (default, $3/$15, mejor reasoning + más fuentes)
 *  - sonar-reasoning-pro
 *
 * Perplexity siempre hace búsqueda web. Las fuentes vienen en `citations`
 * del response (extension propietaria sobre el spec OpenAI).
 */

import OpenAI from 'openai';
import { BaseLLMClient } from './base.js';
import { getApiKey, getModel } from '../config.js';
import { calculateCost } from '../pricing.js';
import { LLMError } from '../types.js';
import type { LLMRequest, LLMResponse, EngineId } from '../types.js';

interface PerplexityCompletion extends OpenAI.Chat.Completions.ChatCompletion {
  citations?: string[];
}

export class PerplexityClient extends BaseLLMClient {
  readonly engine: EngineId = 'perplexity';
  readonly defaultModel: string;
  private readonly client: OpenAI;

  constructor() {
    super();
    this.defaultModel = getModel('perplexity');
    this.client = new OpenAI({
      apiKey: getApiKey('perplexity'),
      baseURL: 'https://api.perplexity.ai',
    });
  }

  protected async executeRequest(request: LLMRequest): Promise<LLMResponse> {
    const model = request.modelOverride ?? this.defaultModel;
    const start = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }
    for (const msg of request.messages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      } as OpenAI.Chat.ChatCompletionMessageParam);
    }

    try {
      // Perplexity acepta extra params propietarios. Casteamos any para evitar
      // que el type-check de OpenAI los rechace.
      const params: Record<string, unknown> = {
        model,
        messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.3,
        return_citations: true,
      };

      if (request.searchRecency) {
        params.search_recency_filter = request.searchRecency;
      }

      const response = (await this.client.chat.completions.create(
        params as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
      )) as PerplexityCompletion;

      const content = response.choices[0]?.message?.content ?? '';
      const tokensIn = response.usage?.prompt_tokens ?? 0;
      const tokensOut = response.usage?.completion_tokens ?? 0;

      const sources = (response.citations ?? []).map((url) => ({ url }));

      const costUsd = calculateCost({
        model,
        tokensIn,
        tokensOut,
        perRequestCount: 1,
      });

      return {
        engine: 'perplexity',
        model,
        content,
        tokensIn,
        tokensOut,
        costUsd,
        latencyMs: Date.now() - start,
        sources,
        raw: response,
      };
    } catch (err) {
      throw normalizePerplexityError(err);
    }
  }
}

function normalizePerplexityError(err: unknown): LLMError {
  if (err instanceof OpenAI.APIError) {
    const retryable = err.status === 429 || (err.status ?? 0) >= 500;
    return new LLMError(err.message, 'perplexity', err.status, retryable, err);
  }
  if (err instanceof Error) {
    return new LLMError(err.message, 'perplexity', undefined, false, err);
  }
  return new LLMError('Unknown Perplexity error', 'perplexity', undefined, false, err);
}
