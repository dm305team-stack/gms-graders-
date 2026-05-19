/**
 * @gms/llm — OpenAI (ChatGPT) client
 *
 * Soporta GPT-5.2 (default), GPT-5.4, y modelos legacy.
 * No tiene búsqueda web nativa por API; representa la "vista training data".
 */

import OpenAI from 'openai';
import { BaseLLMClient } from './base.js';
import { getApiKey, getModel } from '../config.js';
import { calculateCost } from '../pricing.js';
import { LLMError } from '../types.js';
import type { LLMRequest, LLMResponse, EngineId } from '../types.js';

export class OpenAIClient extends BaseLLMClient {
  readonly engine: EngineId = 'openai';
  readonly defaultModel: string;
  private readonly client: OpenAI;

  constructor() {
    super();
    this.defaultModel = getModel('openai');
    this.client = new OpenAI({ apiKey: getApiKey('openai') });
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
      const response = await this.client.chat.completions.create({
        model,
        messages,
        // GPT-5 models require max_completion_tokens (not max_tokens) and
        // spend reasoning tokens from the same budget, so keep a floor of 8000
        // to avoid empty completions.
        max_completion_tokens: Math.max(8000, request.maxTokens ?? 4096),
        temperature: request.temperature ?? 0.3,
        response_format: request.jsonMode ? { type: 'json_object' } : undefined,
      });

      const content = response.choices[0]?.message?.content ?? '';
      const tokensIn = response.usage?.prompt_tokens ?? 0;
      const tokensOut = response.usage?.completion_tokens ?? 0;

      const costUsd = calculateCost({ model, tokensIn, tokensOut });

      return {
        engine: 'openai',
        model,
        content,
        tokensIn,
        tokensOut,
        costUsd,
        latencyMs: Date.now() - start,
        raw: response,
      };
    } catch (err) {
      throw normalizeOpenAIError(err);
    }
  }
}

function normalizeOpenAIError(err: unknown): LLMError {
  if (err instanceof OpenAI.APIError) {
    const retryable = err.status === 429 || (err.status ?? 0) >= 500;
    return new LLMError(err.message, 'openai', err.status, retryable, err);
  }
  if (err instanceof Error) {
    return new LLMError(err.message, 'openai', undefined, false, err);
  }
  return new LLMError('Unknown OpenAI error', 'openai', undefined, false, err);
}
