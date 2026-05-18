/**
 * @gms/llm — Claude (Anthropic) client
 *
 * Soporta:
 *  - claude-opus-4-7 (flagship)
 *  - claude-sonnet-4-6 (default, mejor balance)
 *  - claude-haiku-4-5 (rápido y barato, para parsing y queries auxiliares)
 *
 * Activa prompt caching automáticamente cuando `enableCache: true`.
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMClient } from './base.js';
import { getApiKey, getModel } from '../config.js';
import { calculateCost, supportsCaching } from '../pricing.js';
import { LLMError } from '../types.js';
import type { LLMRequest, LLMResponse, EngineId } from '../types.js';

export class ClaudeClient extends BaseLLMClient {
  readonly engine: EngineId = 'claude';
  readonly defaultModel: string;
  private readonly client: Anthropic;

  constructor() {
    super();
    this.defaultModel = getModel('claude');
    this.client = new Anthropic({ apiKey: getApiKey('claude') });
  }

  protected async executeRequest(request: LLMRequest): Promise<LLMResponse> {
    const model = request.modelOverride ?? this.defaultModel;
    const start = Date.now();

    // Map mensajes al formato de Anthropic (system separado, no en messages)
    const anthropicMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const systemBlocks = buildSystemBlocks(
      request.system ?? extractSystemFromMessages(request.messages),
      request.enableCache && supportsCaching(model),
    );

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.3,
        system: systemBlocks,
        messages: anthropicMessages,
      });

      const content =
        response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n') ?? '';

      const tokensIn = response.usage.input_tokens ?? 0;
      const tokensOut = response.usage.output_tokens ?? 0;
      const tokensCached = response.usage.cache_read_input_tokens ?? 0;

      const costUsd = calculateCost({
        model,
        tokensIn,
        tokensOut,
        tokensCached,
      });

      return {
        engine: 'claude',
        model,
        content,
        tokensIn,
        tokensOut,
        tokensCached,
        costUsd,
        latencyMs: Date.now() - start,
        raw: response,
      };
    } catch (err) {
      throw normalizeAnthropicError(err);
    }
  }
}

/**
 * Si el usuario pasa system como un string, lo convertimos a array de bloques
 * para poder marcar el bloque como cacheable (Anthropic permite cache_control
 * en bloques individuales del system).
 */
function buildSystemBlocks(
  system: string | undefined,
  useCache: boolean,
): Anthropic.TextBlockParam[] | undefined {
  if (!system) return undefined;

  if (useCache) {
    return [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' },
      } as Anthropic.TextBlockParam,
    ];
  }

  return [{ type: 'text', text: system }];
}

function extractSystemFromMessages(messages: LLMRequest['messages']): string | undefined {
  const sys = messages.find((m) => m.role === 'system');
  return sys?.content;
}

function normalizeAnthropicError(err: unknown): LLMError {
  if (err instanceof Anthropic.APIError) {
    const retryable = err.status === 429 || (err.status ?? 0) >= 500;
    return new LLMError(err.message, 'claude', err.status, retryable, err);
  }
  if (err instanceof Error) {
    return new LLMError(err.message, 'claude', undefined, false, err);
  }
  return new LLMError('Unknown Claude error', 'claude', undefined, false, err);
}
