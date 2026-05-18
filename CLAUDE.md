# GMS Graders — Reglas Globales del Monorepo

Este monorepo agrupa las herramientas de diagnóstico (graders) de **Growth Marketing Studios**. Cada grader es un lead magnet con el mismo patrón mecánico:

**Form Gate → Análisis automatizado → PDF report → Captura de lead → Embudo a retainer GMS.**

---

## Filosofía operativa

- **Operador a operador.** Código directo, sin abstracciones innecesarias. Si una cosa se hace dos veces, sube a `packages/`. Si se hace una sola vez, vive en el app que la usa.
- **Branding GMS consistente.** Todos los graders comparten el sistema visual definido en `packages/ui/`. Nadie inventa paletas ni tipografías nuevas sin actualizar primero el design system.
- **Ningún grader es la solución final.** Cada uno revela el dolor visible. La conversión es a retainer GMS o producto de pago. El PDF debe abrir la puerta, no cerrarla.
- **El reporte vende, no diagnostica.** Cada grader devuelve un PDF que es a la vez auditoría real y pieza de venta. Tono técnico, citas verificables, recomendación accionable que solo GMS puede ejecutar bien.

---

## Stack

- **Frontend:** Vite + React + TypeScript
- **Estilos:** CSS Modules con design tokens compartidos (no Tailwind por ahora)
- **Backend:** Supabase Edge Functions (Deno runtime)
- **Database:** Supabase Postgres con Row Level Security
- **Email:** Resend con templates MJML
- **PDF:** generación server-side en `packages/pdf/` (Puppeteer o React-PDF, decidir por grader)
- **LLMs:** wrapper unificado en `packages/llm/` (Claude Sonnet 4.6, GPT-5.2, Gemini 3 Pro, Perplexity Sonar Pro)
- **Hosting:** Vercel (frontends) + Supabase (backend, DB, edge functions)
- **Package manager:** pnpm con workspaces (nunca npm o yarn)

---

## Estructura del monorepo

```
gms-graders/
├── apps/
│   ├── hipaa-auditor/         # HIPAA Privacy Express Auditor
│   └── aeo-auditor/           # AEO Visibility Auditor
│
├── packages/
│   ├── ui/                    # Design system + componentes compartidos
│   ├── form-engine/           # Patrón form gate (validación, captcha, anti-spam)
│   ├── pdf/                   # Renderer base de reportes
│   ├── email/                 # Templates MJML para Resend
│   ├── llm/                   # Clientes unificados de los 4 motores
│   ├── db/                    # Cliente Supabase + tipos generados
│   └── config/                # tsconfig, eslint, vite base
│
└── supabase/
    ├── migrations/
    └── schemas/
        ├── shared.sql         # leads, users, billing (cross-grader)
        ├── hipaa.sql          # scans, vectors, findings
        └── aeo.sql            # analyses, queries, sources, competitors
```

Cada app vive bajo su propio dominio y captura sus propios leads, pero **todos los leads llegan a `shared.leads`** con `source` indicando qué grader los generó. Esto permite cross-sell y telemetría unificada.

---

## Cómo agregar un grader nuevo

1. `mkdir apps/{nombre}-auditor`
2. `pnpm create vite apps/{nombre}-auditor --template react-ts`
3. Copiar `CLAUDE.md` y `package.json` del grader más reciente como template
4. Crear schema en `supabase/schemas/{nombre}.sql`
5. Importar componentes compartidos desde `@gms/ui`, motores desde `@gms/llm`
6. Registrar el grader en la tabla `shared.graders` con su slug y dominio

---

## Convenciones de código

- **Naming de packages:** `@gms/{nombre}` (ej. `@gms/ui`, `@gms/llm`)
- **Naming de apps:** `@gms/{nombre}-auditor`
- **Naming de archivos:** kebab-case para componentes (`form-card.tsx`), camelCase para utilidades (`generatePrompt.ts`)
- **Imports:** absolutos vía alias `@gms/*`, no relativos profundos
- **Tipos:** generados de Supabase con `pnpm db:types`, nunca a mano
- **Idioma del código:** inglés (variables, funciones, comentarios)
- **Idioma del producto:** inglés (audiencia objetivo es Florida + USA)
- **Idioma de comunicación con Claude:** español

---

## Preferencias de redacción para Claude

- **Tono:** directo, operador a operador, técnicamente creíble
- **NO usar** em dashes (—) ni guiones largos como separadores. Punto, coma, o reescribir la frase.
- **NO usar** clichés de copy genérico ("unlock", "supercharge", "synergize", "leverage", "robust", "seamless"). Lenguaje concreto.
- **NO usar** disclaimers innecesarios ni explicaciones de obviedades.
- **SÍ usar** ejemplos concretos con datos reales cuando se proponga algo.
- **SÍ cuestionar** decisiones que parezcan subóptimas en lugar de implementarlas calladamente.

---

## LLM routing

Los wrappers de `packages/llm/` exponen una interfaz unificada. Para cada caso de uso, escoger el modelo correcto:

| Tarea | Modelo |
|---|---|
| Generación de queries (1 vez por análisis) | Claude Haiku 4.5 |
| Lanzamiento contra motores evaluados | GPT-5.2, Perplexity Sonar Pro, Gemini 3 Pro, Claude Sonnet 4.6 |
| Parsing/extracción JSON de respuestas | Claude Haiku 4.5 con prompt caching |
| Síntesis final del reporte | Claude Sonnet 4.6 |
| Razonamiento complejo / debugging | Claude Opus 4.7 (solo cuando se requiera) |

**Activar prompt caching siempre** que el system prompt o context se repita entre llamadas. Reduce input costs hasta 90%.

---

## Variables de entorno

Cada app y cada package tiene su `.env.example`. Las claves de LLM viven configuradas en cada app que consuma `@gms/llm`, no en el package mismo.

Variables comunes:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `PERPLEXITY_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

---

## Deploy

- **Apps:** Vercel, un proyecto por app, deploy automático desde `main`
- **Edge functions:** `supabase functions deploy {nombre}` desde el CI
- **Schema changes:** PR con migration en `supabase/migrations/`, review obligatorio
- **Secrets:** Vercel env vars + Supabase secrets, nunca commitear

---

## Owner

**Fermin Fleites** (Ferminius), Growth Marketing Studios, Miami.

Multi-agente con Claude Code (Opus 4.7) + Antigravity IDE.
