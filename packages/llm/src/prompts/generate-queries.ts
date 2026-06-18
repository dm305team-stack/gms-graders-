/**
 * @gms/llm — Prompt: Generate Queries (Etapa A)
 *
 * Genera 25-30 queries que un cliente real haría al buscar soluciones
 * en el sector del brand. Versionado para poder iterar sin breaking changes.
 */

export const GENERATE_QUERIES_PROMPT_V1 = `Eres un especialista en investigación de marca para auditorías AEO (Answer Engine Optimization).

Tu tarea: generar un conjunto representativo de queries que un cliente real ejecutaría en motores de IA (ChatGPT, Perplexity, Gemini, Claude) cuando busca soluciones como las que ofrece la marca a evaluar.

Importante:
- Las queries NO deben mencionar el nombre de la marca a evaluar.
- Las queries deben reflejar el comportamiento real de búsqueda de un cliente potencial.
- ANCLA las queries al producto/servicio ESPECÍFICO (campo "product"), no a la categoría madre. Si el product es "wine storage", las queries son de wine storage (lockers, climate-controlled, collectors), NO de self-storage genérico. Si es "rhinoplasty", son de rinoplastia, no de cirugía plástica en general. El nicho es lo que define a los competidores reales y lo que el cliente realmente busca.
- Incluye el matiz geográfico del "location" cuando aplique (barrio, calle, ciudad), tal como lo escribiría un cliente local.
- Combina queries en inglés y español si la audiencia es bilingüe.
- Mezcla intents: descubrimiento, comparación, decisión, especificidad técnica.

Devuelve JSON con esta estructura exacta:

{
  "queries": [
    { "query": "best plastic surgeon in Miami", "type": "best_in_location", "language": "en" },
    { "query": "mejor cirujano plástico Miami", "type": "best_in_location", "language": "es" },
    { "query": "what does rhinoplasty cost in Florida", "type": "price_inquiry", "language": "en" },
    ...
  ]
}

Tipos válidos:
- best_in_location: "best/top X in Y"
- compare_competitors: comparación entre proveedores conocidos del sector
- how_to_choose: "how to choose / what to ask before / questions about"
- specialty_specific: subespecialidades concretas (ej. rinoplastia, implantes, etc.)
- problem_solution: queries que parten del problema del cliente
- price_inquiry: cost / pricing / how much does
- before_after: "before and after / reviews / results"
- doctor_name_lookup: solo si se proporciona doctor_name explícito

Distribución recomendada (25-30 queries):
- 8 best_in_location
- 5 compare_competitors
- 5 specialty_specific
- 4 how_to_choose
- 3 price_inquiry
- 3 problem_solution
- 1-2 before_after
- 0-3 doctor_name_lookup (solo si aplica)`;

export interface GenerateQueriesInput {
  brand_name: string;
  domain: string;
  location: string;
  specialty: string;
  org_type: string;
  /** Producto/servicio específico (ej. "wine storage", "rhinoplasty"). Ancla el nicho. */
  product?: string;
  doctor_name?: string;
  bilingual?: boolean;
}

export interface GeneratedQuery {
  query: string;
  type:
    | 'best_in_location'
    | 'compare_competitors'
    | 'how_to_choose'
    | 'specialty_specific'
    | 'problem_solution'
    | 'price_inquiry'
    | 'before_after'
    | 'doctor_name_lookup';
  language: 'en' | 'es';
}

export interface GenerateQueriesOutput {
  queries: GeneratedQuery[];
}

export function buildGenerateQueriesUserPrompt(input: GenerateQueriesInput): string {
  return `Marca a evaluar (NO mencionar en las queries):
- Brand name: ${input.brand_name}
- Domain: ${input.domain}
- Location: ${input.location}
- Specialty: ${input.specialty}
${input.product ? `- Product / service line (ANCLA EL NICHO aquí): ${input.product}` : ''}
- Org type: ${input.org_type}
${input.doctor_name ? `- Doctor name: ${input.doctor_name}` : ''}
${input.bilingual ? '- Bilingual (genera mix en/es)' : '- Solo inglés'}

Genera el JSON de queries siguiendo la estructura indicada. Las queries deben ser del producto/servicio específico (el campo "product" si está presente), no de la categoría madre.`;
}
