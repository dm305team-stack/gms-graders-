/**
 * @gms/llm — Google Gemini client (@google/genai)
 *
 * Default: gemini-2.5-pro. Para uso ligero (parsing), gemini-3-flash.
 *
 * Dos modos:
 *  - webSearch: false (default) -> generateContent sin tools, vista "training data".
 *  - webSearch: true -> tool nativa Google Search grounding (`googleSearch`), que
 *    reproduce lo que ve un usuario en Gemini con búsqueda. Las citas
 *    (groundingChunks[].web) se devuelven en `sources`.
 *
 * AEO: la búsqueda es del propio motor respondiendo una query de categoría;
 * la query nunca nombra la marca (eso lo garantiza el pipeline).
 */

import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
  type SafetySetting,
  type Tool,
} from '@google/genai';
import { BaseLLMClient } from './base.js';
import { getApiKey, getModel } from '../config.js';
import { calculateCost } from '../pricing.js';
import { LLMError } from '../types.js';
import type { LLMRequest, LLMResponse, EngineId } from '../types.js';

// Para uso B2B/healthcare necesitamos thresholds permisivos o algunos prompts
// honestos sobre cirugía/medicina/etc. son bloqueados.
const SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export class GeminiClient extends BaseLLMClient {
  readonly engine: EngineId = 'gemini';
  readonly defaultModel: string;
  private readonly client: GoogleGenAI;

  constructor() {
    super();
    this.defaultModel = getModel('gemini');
    this.client = new GoogleGenAI({ apiKey: getApiKey('gemini') });
  }

  protected async executeRequest(request: LLMRequest): Promise<LLMResponse> {
    const model = request.modelOverride ?? this.defaultModel;
    const start = Date.now();

    const contents: Content[] = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Google Search grounding is incompatible with responseMimeType JSON, so
    // only force JSON mode on the ungrounded path.
    const tools: Tool[] | undefined = request.webSearch
      ? [{ googleSearch: {} }]
      : undefined;

    try {
      const response = await this.client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: request.system,
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxTokens ?? 4096,
          responseMimeType:
            request.jsonMode && !request.webSearch ? 'application/json' : undefined,
          safetySettings: SAFETY_SETTINGS,
          tools,
        },
      });

      const content = response.text ?? '';

      const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
        .map((chunk) => chunk.web)
        .filter((w): w is NonNullable<typeof w> => Boolean(w?.uri))
        .map((w) => ({ url: w.uri as string, title: w.title }));

      const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
      const tokensOut = response.usageMetadata?.candidatesTokenCount ?? 0;

      // Grounded prompts bill one Google Search grounding per request.
      const searchCount = request.webSearch && sources.length ? 1 : 0;

      const costUsd = calculateCost({ model, tokensIn, tokensOut, searchCount });

      return {
        engine: 'gemini',
        model,
        content,
        tokensIn,
        tokensOut,
        costUsd,
        latencyMs: Date.now() - start,
        sources: sources.length ? sources : undefined,
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
