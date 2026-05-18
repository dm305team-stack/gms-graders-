# @gms/llm

Wrapper unificado para los 4 motores de IA evaluados por los graders de GMS.

## Motores soportados

| Engine ID | Default Model | Use case |
|---|---|---|
| `claude` | `claude-sonnet-4-6` | Síntesis, razonamiento, parsing con caching |
| `openai` | `gpt-5.2` | Vista "training data" para ChatGPT |
| `gemini` | `gemini-3-pro` | Tercera vista con cutoff intermedio |
| `perplexity` | `sonar-pro` | Vista "web search en tiempo real" con citaciones |

## Uso

### Cliente individual

```ts
import { createClient } from '@gms/llm';

const claude = createClient('claude');

const response = await claude.complete({
  system: 'Eres un analista AEO senior.',
  messages: [
    { role: 'user', content: '¿Qué es Answer Engine Optimization?' },
  ],
  temperature: 0.3,
  enableCache: true,
});

console.log(response.content);
console.log(`Cost: $${response.costUsd}`);
console.log(`Tokens: ${response.tokensIn} in, ${response.tokensOut} out`);
```

### Todos a la vez (paralelo)

```ts
import { createAllClients } from '@gms/llm';

const clients = createAllClients();

const results = await Promise.allSettled(
  Object.values(clients).map((c) =>
    c.complete({
      messages: [{ role: 'user', content: 'best plastic surgeon Miami' }],
    }),
  ),
);
```

### Con prompts versionados

```ts
import {
  createClient,
  GENERATE_QUERIES_PROMPT_V1,
  buildGenerateQueriesUserPrompt,
  getFastModel,
} from '@gms/llm';

const claude = createClient('claude');

const response = await claude.complete({
  system: GENERATE_QUERIES_PROMPT_V1,
  messages: [
    {
      role: 'user',
      content: buildGenerateQueriesUserPrompt({
        brand_name: 'Dr. Jonathan Schwitzer Plastic Surgery',
        domain: 'drjschwitzer.com',
        location: 'Bay Harbor Islands, FL',
        specialty: 'Plastic Surgery',
        org_type: 'clinic',
        bilingual: true,
      }),
    },
  ],
  modelOverride: getFastModel(),
  jsonMode: true,
  enableCache: true,
});

const { queries } = JSON.parse(response.content);
```

## Variables de entorno

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
PERPLEXITY_API_KEY=pplx-...

# Optional overrides (defaults arriba en la tabla)
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MODEL_FAST=claude-haiku-4-5-20251001
OPENAI_MODEL=gpt-5.2
GEMINI_MODEL=gemini-3-pro
PERPLEXITY_MODEL=sonar-pro
```

## Costos y caching

`pricing.ts` mantiene los precios por modelo. Cada llamada incluye `costUsd` calculado.

**Prompt caching (solo Claude):** activar con `enableCache: true`. El system prompt se cachea automáticamente y los reads posteriores cuestan 10% del rate normal. Útil cuando se ejecuta el mismo system prompt sobre 30 queries (caso típico del parser).

## Versionado de prompts

Los prompts viven como constantes en `src/prompts/` con sufijo `_V1`, `_V2`, etc. Cuando cambies un prompt:

1. Crea `_V2` en paralelo
2. Migra los callers uno a uno
3. Deprecate `_V1` cuando todos pasen

Nunca edites un prompt versionado in-place. Eso rompe reproducibilidad de análisis históricos.
