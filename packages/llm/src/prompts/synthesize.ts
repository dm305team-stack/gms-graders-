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

ESCALA DE SCORING (por engine, total 100 puntos):

1. **Reconocimiento de marca (0-20)**
   - Frecuencia de menciones / total de queries
   - Diversidad de fuentes que mencionan la marca
   - Riqueza de datos disponibles

2. **Posición en el mercado (0-10)**
   - Clasificación: "leader" | "challenger" | "niche_player"
   - Comparada con volumen y prominencia de los top 5 competidores detectados

3. **Calidad de presencia (0-20)**
   - Score promedio ponderado de las fuentes citadas
   - Authority de los dominios que aparecen

4. **Percepción de marca (0-40)** — el componente con más peso
   - Sentimiento general (15)
   - Sentimiento contextual por tema (15)
   - Sentimiento por fuente (5)
   - Inversa de polarización (5)

5. **Cuota de participación / Share of Voice (0-10)**
   - % de menciones de la marca / menciones totales (marca + competidores)

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
- Sé honesto sobre baja visibilidad. Si la marca casi no aparece, NO infles los scores con "potencial percibido".
- El componente "brand_perception" puede ser generoso (la AI tiende a hablar positivamente), pero NO uses eso para inflar el overall.
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
