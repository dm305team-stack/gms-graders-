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
      Boolean(request.enableCache) && supportsCaching(model),
    );

    // Grounded path: the native web_search server tool reproduces what a user
    // sees in Claude with search on. Citations land on the text blocks.
    const tools: Anthropic.ToolUnion[] | undefined = request.webSearch
      ? [{ type: 'web_search_20250305', name: 'web_search' }]
      : undefined;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.3,
        system: systemBlocks,
        messages: anthropicMessages,
        tools,
      });

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      const content = textBlocks.map((block) => block.text).join('\n') ?? '';

      const sources = extractWebSearchCitations(textBlocks);

      const tokensIn = response.usage.input_tokens ?? 0;
      const tokensOut = response.usage.output_tokens ?? 0;
      const tokensCached = response.usage.cache_read_input_tokens ?? 0;
      const searchCount = response.usage.server_tool_use?.web_search_requests ?? 0;

      const costUsd = calculateCost({
        model,
        tokensIn,
        tokensOut,
        tokensCached,
        searchCount,
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
        sources: sources.length ? sources : undefined,
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

/** Collect web_search citations attached to the response text blocks. */
function extractWebSearchCitations(
  textBlocks: Anthropic.TextBlock[],
): Array<{ url: string; title?: string }> {
  const seen = new Set<string>();
  const sources: Array<{ url: string; title?: string }> = [];
  for (const block of textBlocks) {
    for (const citation of block.citations ?? []) {
      if (citation.type !== 'web_search_result_location') continue;
      if (!citation.url || seen.has(citation.url)) continue;
      seen.add(citation.url);
      sources.push({ url: citation.url, title: citation.title ?? undefined });
    }
  }
  return sources;
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
