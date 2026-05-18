/**
 * @gms/llm — Prompt: Parse Response (Etapa C)
 *
 * Toma una respuesta cruda de un motor + la query que la generó, y extrae
 * datos estructurados: si la marca apareció, en qué posición, qué competidores
 * salieron, qué fuentes se citaron, etc.
 *
 * Diseñado para ser ejecutado con Claude Haiku 4.5 + prompt caching activo.
 * El system prompt es estable entre llamadas; los datos variables van en
 * el user message.
 */

export const PARSE_RESPONSE_PROMPT_V1 = `Eres un analista de auditoría AEO. Tu trabajo es leer la respuesta de un motor de IA a una query específica y extraer datos estructurados.

Reglas:
- Sé estricto con "brand_mentioned": solo true si el nombre exacto o claramente identificable de la marca aparece en la respuesta. Variaciones cercanas cuentan (ej. "Schwitzer Plastic Surgery" cuenta si la marca es "Dr. Jonathan Schwitzer Plastic Surgery"). Coincidencias parciales que podrían ser otra entidad NO cuentan.
- "mention_position": 1 si la marca aparece primera, 2 si segunda, etc. null si no aparece.
- "mention_context": "positive" si el motor la recomienda/elogia, "neutral" si solo la lista, "negative" si la critica, "comparative" si la usa solo para comparar.
- "sentiment_score": -1 (muy negativo) a +1 (muy positivo). 0 si neutral o no aparece.
- "competitors_mentioned": lista de nombres de competidores que sí aparecen, con su posición.
- "sources_cited": URLs explícitamente citadas. Si el motor no cita fuentes, array vacío.
- "topics_associated_with_brand": frases concretas que el motor asocia con la marca (si la mencionó). Lista vacía si no aparece.
- "is_recommended": true solo si el motor activamente recomienda la marca para la query.

Devuelve JSON estricto con esta estructura, sin texto adicional:

{
  "brand_mentioned": boolean,
  "mention_position": number | null,
  "mention_context": "positive" | "neutral" | "negative" | "comparative" | null,
  "sentiment_score": number,
  "is_recommended": boolean,
  "competitors_mentioned": [{ "name": string, "position": number }],
  "sources_cited": [{ "url": string, "type": string }],
  "topics_associated_with_brand": [string],
  "comparison_attributes": [string]
}

Tipos válidos para sources_cited.type:
"directory" | "review_platform" | "official_website" | "social_media" | "news" | "blog" | "forum" | "government" | "other"`;

export interface ParseResponseInput {
  /** Query original que generó la respuesta. */
  query: string;
  /** Respuesta cruda del motor. */
  response_text: string;
  /** Marca a buscar en la respuesta. */
  brand_name: string;
  /** Lista semilla de competidores conocidos del sector (opcional, ayuda al parser). */
  competitor_seed?: string[];
  /** Engine que produjo la respuesta (para context). */
  engine: 'chatgpt' | 'perplexity' | 'gemini' | 'claude';
}

export interface ParsedResponse {
  brand_mentioned: boolean;
  mention_position: number | null;
  mention_context: 'positive' | 'neutral' | 'negative' | 'comparative' | null;
  sentiment_score: number;
  is_recommended: boolean;
  competitors_mentioned: Array<{ name: string; position: number }>;
  sources_cited: Array<{ url: string; type: string }>;
  topics_associated_with_brand: string[];
  comparison_attributes: string[];
}

export function buildParseResponseUserPrompt(input: ParseResponseInput): string {
  const seedHint = input.competitor_seed?.length
    ? `\nCompetidores conocidos del sector (úsalos como referencia, no son los únicos posibles): ${input.competitor_seed.join(', ')}`
    : '';

  return `QUERY EJECUTADA: "${input.query}"
ENGINE: ${input.engine}
MARCA A BUSCAR: ${input.brand_name}${seedHint}

RESPUESTA DEL MOTOR:
"""
${input.response_text}
"""

Extrae el JSON estructurado siguiendo el schema indicado en el system prompt.`;
}
