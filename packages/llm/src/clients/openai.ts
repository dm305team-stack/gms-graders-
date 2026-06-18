/**
 * @gms/llm — OpenAI (ChatGPT) client
 *
 * Soporta GPT-5.2 (default), GPT-5.4, y modelos legacy.
 *
 * Dos modos:
 *  - webSearch: false (default) -> chat.completions, vista "training data".
 *  - webSearch: true -> Responses API con la tool nativa `web_search`, que
 *    reproduce lo que ve un usuario en ChatGPT con búsqueda activa. Las citas
 *    (url_citation) se devuelven en `sources`.
 *
 * AEO: la búsqueda es del propio motor respondiendo una query de categoría;
 * la query nunca nombra la marca (eso lo garantiza el pipeline).
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
    return request.webSearch
      ? this.executeWebSearch(request)
      : this.executeChat(request);
  }

  /** Grounded path: Responses API + native web_search tool, with citations. */
  private async executeWebSearch(request: LLMRequest): Promise<LLMResponse> {
    const model = request.modelOverride ?? this.defaultModel;
    const start = Date.now();

    // Engine calls are single-turn: the user message carries the customer query.
    const input = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => m.content)
      .join('\n\n');

    try {
      const response = await this.client.responses.create({
        model,
        input,
        instructions: request.system,
        tools: [{ type: 'web_search_preview' }],
        max_output_tokens: Math.max(8000, request.maxTokens ?? 4096),
      });

      const content = response.output_text ?? '';
      const sources = extractResponsesCitations(response);
      const tokensIn = response.usage?.input_tokens ?? 0;
      const tokensOut = response.usage?.output_tokens ?? 0;

      // Count the web_search_call items, so pricing can bill per search.
      const searchCount = (response.output ?? []).filter(
        (item) => item.type === 'web_search_call',
      ).length;

      const costUsd = calculateCost({ model, tokensIn, tokensOut, searchCount });

      return {
        engine: 'openai',
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
      throw normalizeOpenAIError(err);
    }
  }

  /** Ungrounded path: chat.completions (no web search). Used by aux stages. */
  private async executeChat(request: LLMRequest): Promise<LLMResponse> {
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

/** Pull url_citation annotations out of a Responses API result into `sources`. */
function extractResponsesCitations(
  response: OpenAI.Responses.Response,
): Array<{ url: string; title?: string }> {
  const seen = new Set<string>();
  const sources: Array<{ url: string; title?: string }> = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type !== 'output_text') continue;
      for (const ann of part.annotations ?? []) {
        if (ann.type === 'url_citation' && ann.url && !seen.has(ann.url)) {
          seen.add(ann.url);
          sources.push({ url: ann.url, title: ann.title });
        }
      }
    }
  }
  return sources;
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
