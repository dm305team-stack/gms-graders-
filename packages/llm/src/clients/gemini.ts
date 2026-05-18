/**
 * @gms/llm — Google Gemini client
 *
 * Default: gemini-3-pro. Para uso ligero (parsing), gemini-3-flash.
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import { BaseLLMClient } from './base.js';
import { getApiKey, getModel } from '../config.js';
import { calculateCost } from '../pricing.js';
import { LLMError } from '../types.js';
import type { LLMRequest, LLMResponse, EngineId } from '../types.js';

export class GeminiClient extends BaseLLMClient {
  readonly engine: EngineId = 'gemini';
  readonly defaultModel: string;
  private readonly client: GoogleGenerativeAI;

  constructor() {
    super();
    this.defaultModel = getModel('gemini');
    this.client = new GoogleGenerativeAI(getApiKey('gemini'));
  }

  protected async executeRequest(request: LLMRequest): Promise<LLMResponse> {
    const model = request.modelOverride ?? this.defaultModel;
    const start = Date.now();

    const generativeModel = this.client.getGenerativeModel({
      model,
      systemInstruction: request.system,
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 4096,
        responseMimeType: request.jsonMode ? 'application/json' : undefined,
      },
      // Para uso B2B/healthcare necesitamos thresholds permisivos
      // o algunos prompts honestos sobre cirugía/medicina son bloqueados.
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
    });

    // Gemini usa estructura de historia distinta. Convertimos.
    const history = request.messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1) // todo menos el último mensaje
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const lastMessage = request.messages
      .filter((m) => m.role !== 'system')
      .at(-1);

    if (!lastMessage) {
      throw new LLMError('Empty message list for Gemini', 'gemini');
    }

    try {
      const chat = generativeModel.startChat({ history });
      const response = await chat.sendMessage(lastMessage.content);

      const content = response.response.text();
      const usage = response.response.usageMetadata;
      const tokensIn = usage?.promptTokenCount ?? 0;
      const tokensOut = usage?.candidatesTokenCount ?? 0;

      const costUsd = calculateCost({ model, tokensIn, tokensOut });

      return {
        engine: 'gemini',
        model,
        content,
        tokensIn,
        tokensOut,
        costUsd,
        latencyMs: Date.now() - start,
        raw: response,
      };
    } catch (err) {
      throw normalizeGeminiError(err);
    }
  }
}

function normalizeGeminiError(err: unknown): LLMError {
  if (err instanceof Error) {
    const msg = err.message;
    const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate');
    const isServerError = msg.includes('500') || msg.includes('503');
    return new LLMError(msg, 'gemini', undefined, isRateLimit || isServerError, err);
  }
  return new LLMError('Unknown Gemini error', 'gemini', undefined, false, err);
}
