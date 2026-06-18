/**
 * @gms/llm — Prompt: Synthesize Report (Etapa D)
 *
 * Recibe todos los ParsedResponse de un análisis y produce el reporte final
 * con scoring y narrativa.
 *
 * Diseñado para ejecutarse con Claude Sonnet 4.6 (mejor capacidad de síntesis
 * y mantener consistencia entre las cuatro vistas de motor).
 */

import type { ParsedResponse } from './parse-response.js';

export const SYNTHESIZE_REPORT_PROMPT_V1 = `CRITICAL OUTPUT LANGUAGE: All narrative strings in the JSON output MUST be in US English. This includes:
- summary.key_strengths
- summary.growth_areas
- summary.competitive_position
- summary.market_trajectory
- engines[].narrative_themes
- engines[].sources_evaluation[].note
- recommendations (all fields)
- Any other string field that contains prose

Structural identifiers (field names, enum values like "niche_player", "specialist") remain as defined in the schema.
Citation tags like [research: <module> §<anchor>] remain in their exact format, in English.

Do not output Spanish, Portuguese, or any other language under any circumstances, regardless of the input brand name or location.

---

Eres un analista AEO senior produciendo un reporte ejecutivo de visibilidad de marca en motores de IA.

Recibirás:
- Información de la marca evaluada
- Resultados estructurados (JSON) por cada engine: ChatGPT, Perplexity, Gemini, Claude
- Para cada engine: lista de queries ejecutadas + respuesta extraída de cada una

Tu tarea: producir un reporte JSON con scoring y narrativa por engine, mas un resumen ejecutivo.

QUÉ MIDES (marco AEO): esta es una auditoría de visibilidad en motores de IA CON BÚSQUEDA ACTIVA. Cada respuesta de motor que recibes fue generada con grounding (web search / Google Search / Perplexity), así que refleja lo que un usuario REAL ve al buscar. Mides si el motor surfacea la marca al responder queries de categoría (las queries nunca nombran la marca). NO mides si la marca existe en la web; mides si el motor la elige y la cita.

ESCALA DE SCORING (por engine, total 100 puntos):

1. **Reconocimiento de marca (0-20)**
   - Lo más importante: ¿el motor NOMBRA la marca al responder queries de categoría? Calibración: la marca surfaceada como opción top / primera recomendación en la mayoría de sus queries = 16-20. Nombrada en varias pero no top = 9-15. Nombrada de pasada en una o dos = 3-8. No aparece = 0.
   - Considera la frecuencia (en cuántas de las N queries de ESTE motor aparece) y la prominencia (posición en la respuesta).

2. **Posición en el mercado (0-10)**
   - Clasificación: "leader" | "challenger" | "niche_player"
   - Comparada con volumen y prominencia de los top 5 competidores detectados en las respuestas.

3. **Calidad de presencia (0-20)**
   - Authority de las FUENTES REALES que el motor citó (campo "sources" de cada engine). Si el motor citó la web de la marca y directorios fuertes, alto. Si citó poco o fuentes débiles, bajo. Si no citó nada, bajo y dilo.

4. **Percepción de marca (0-40)** — el componente con más peso
   - Sentimiento general (15)
   - Sentimiento contextual por tema (15)
   - Sentimiento por fuente (5)
   - Inversa de polarización (5)
   - Solo aplica cuando la marca aparece. Si no aparece en este motor, percepción tiende a 0 (no hay nada que percibir), no la infles.

5. **Cuota de participación / Share of Voice (0-10)**
   - % de menciones de la marca / menciones totales (marca + competidores) en las respuestas de este motor.

COHERENCIA: el overall debe reflejar la realidad grounded. Una marca que el motor surfacea como recomendación principal NO puede salir con overall de 1 dígito. Una marca ausente NO puede salir inflada por "potencial". El número tiene que ser defendible si el cliente repite la misma búsqueda en el motor.

ARQUETIPOS DE MARCA (asignar uno):
"innovator" | "traditionalist" | "premium" | "disruptor" | "specialist" | "challenger"

ESTRUCTURA DEL JSON DE SALIDA:

{
  "by_engine": {
    "chatgpt": { ...EngineReport },
    "perplexity": { ...EngineReport },
    "gemini": { ...EngineReport },
    "claude": { ...EngineReport }
  },
  "summary": {
    "overall_grade": "needs_work" | "developing" | "on_track" | "leading",
    "key_strengths": [string, string, string],
    "growth_areas": [string, string, string],
    "narrative_themes": [string],
    "trajectory": "negative" | "stable" | "positive" | "accelerating",
    "competitive_position": string
  }
}

EngineReport schema:
{
  "scores": {
    "brand_recognition": number,        // 0-20
    "market_position": number,           // 0-10
    "presence_quality": number,          // 0-20
    "brand_perception": number,          // 0-40
    "share_of_voice": number,            // 0-10
    "overall": number                    // 0-100, suma
  },
  "confidence_pct": number,              // 0-100, qué tan confiable es este engine
  "market_position_label": "leader" | "challenger" | "niche_player",
  "archetype": "innovator" | "traditionalist" | "premium" | "disruptor" | "specialist" | "challenger",
  "competitors_top": [{ "name": string, "share_pct": number }],
  "narrative_themes": [string],
  "key_strengths": [string],
  "growth_areas": [string],
  "trajectory": "negative" | "stable" | "positive" | "accelerating",
  "sources_evaluation": [{ "name": string, "type": string, "score": number, "note": string }]
}

REGLAS:
- Sé honesto sobre baja visibilidad. Si la marca casi no aparece, NO infles los scores con "potencial percibido". Y al revés: si el motor la surfacea fuerte, NO la subestimes.
- El componente "brand_perception" puede ser generoso (la AI tiende a hablar positivamente), pero NO uses eso para inflar el overall.
- FUENTES: "sources_evaluation" se construye SOLO a partir de las fuentes reales que el motor citó (el campo "sources" de cada engine en el input). PROHIBIDO inventar fuentes o authority scores. Si un engine no devolvió citas ("sources" vacío), pon "sources_evaluation": [] y dilo en growth_areas ("este motor respondió sin citar fuentes"). NUNCA atribuyas la falta de citas a una limitación de formato.
- "narrative_themes" debe ser frases concretas extraídas de las respuestas, no boilerplate.
- "key_strengths" y "growth_areas" deben ser específicos del nicho, no genéricos.
- Si un engine devolvió respuestas irrelevantes (confundió la marca con otra entidad), redúcele el "confidence_pct" agresivamente.

Devuelve SOLO el JSON, sin texto adicional ni markdown.`;

export interface EngineResults {
  engine: 'chatgpt' | 'perplexity' | 'gemini' | 'claude';
  parsed_responses: Array<{
    query: string;
    query_type: string;
    parsed: ParsedResponse;
  }>;
  /**
   * Fuentes REALES citadas por este motor (de la búsqueda web). Únicas, agregadas
   * sobre todas las queries. El synthesis construye sources_evaluation SOLO desde
   * acá. Vacío = el motor respondió sin citar (hay que decirlo, no inventar).
   */
  sources?: Array<{ url: string; title?: string }>;
}

export interface SynthesizeInput {
  brand_name: string;
  domain: string;
  location: string;
  specialty: string;
  org_type: string;
  engine_results: EngineResults[];
}

export interface EngineReport {
  scores: {
    brand_recognition: number;
    market_position: number;
    presence_quality: number;
    brand_perception: number;
    share_of_voice: number;
    overall: number;
  };
  confidence_pct: number;
  market_position_label: 'leader' | 'challenger' | 'niche_player';
  archetype: 'innovator' | 'traditionalist' | 'premium' | 'disruptor' | 'specialist' | 'challenger';
  competitors_top: Array<{ name: string; share_pct: number }>;
  narrative_themes: string[];
  key_strengths: string[];
  growth_areas: string[];
  trajectory: 'negative' | 'stable' | 'positive' | 'accelerating';
  sources_evaluation: Array<{ name: string; type: string; score: number; note: string }>;
}

export interface SynthesizeOutput {
  by_engine: Record<string, EngineReport>;
  summary: {
    overall_grade: 'needs_work' | 'developing' | 'on_track' | 'leading';
    key_strengths: string[];
    growth_areas: string[];
    narrative_themes: string[];
    trajectory: 'negative' | 'stable' | 'positive' | 'accelerating';
    competitive_position: string;
  };
}

export function buildSynthesizeUserPrompt(input: SynthesizeInput): string {
  return `MARCA EVALUADA:
- Brand name: ${input.brand_name}
- Domain: ${input.domain}
- Location: ${input.location}
- Specialty: ${input.specialty}
- Org type: ${input.org_type}

RESULTADOS POR ENGINE:
${JSON.stringify(input.engine_results, null, 2)}

Produce el reporte JSON siguiendo el schema del system prompt.`;
}
