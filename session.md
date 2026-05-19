# Session Handoff — AEO Visibility Auditor

Fecha de la sesión: 2026-05-18. Siguiente sesión: 2026-05-19 o después.
Lee este archivo completo antes de tocar nada. Resume el trabajo exactamente donde quedó.

---

## Estado en una línea

Fase 1 (reparación de motores + integración del research base con prompt caching)
terminada y commiteada. Queda sin commitear el "Bucket C": todo el funnel de
captura y el pulido del reporte PDF.

---

## Git

- Branch: `feature/aeo-pdf-report` (NO main). Nada se ha pusheado, todo es local.
- 4 commits:
  - `cc91505` Initial commit: monorepo + AEO auditor backend Fase 1
  - `69ca105` AEO report: PDF de 8 secciones tipo HubSpot
  - `c011df6` fix(@gms/llm): repara motores OpenAI/Gemini + gate de Perplexity
  - `53744ca` feat(aeo): research base en Stage D con prompt caching

### Sin commitear — "Bucket C" (funnel + pulido del reporte)

Es una feature completa, decidida para una sesión aparte. NO commitear sin
que el operador lo pida y defina el mensaje.

Modificados: `.env.example` (solo el hunk LEAD_NOTIFICATION_EMAIL), `server/email.ts`,
`server/index.ts`, `server/report.ts`, `server/types.ts`,
`src/components/AuditForm.tsx`, `AuditForm.module.css`, `HeroAEO.tsx`.
Nuevos sin trackear: `src/components/ReportPreview.tsx` + `.module.css`.

Qué contiene el Bucket C: funnel de 5 campos (Domain, Brand, Location, Sector,
Product) -> preview del reporte parcialmente desenfocado -> gate de contacto
(email, nombre, apellido, teléfono) -> tracking -> descarga del PDF; notificación
de lead por email a ferminfleites@gmail.com (asunto "For Rellenado en AEO_Auditor");
veredicto "bajo 75/100" en el reporte; sección de recomendaciones con CTA al
+1 (786) 929-5079; tipografía del PDF +2px; párrafo nuevo del hero.

Stray sin trackear, NO son código: `source/test1.png`, `source/test2.png`
(capturas de comparación con HubSpot). Decidir si se quedan o se borran.

---

## Cómo correr

```
pnpm --filter @gms/aeo-auditor dev:all     # vite (5173) + api Express (3334)
```
O por separado: `... dev` (frontend) y `... api` (backend). Verificar con
`curl localhost:3334/api/health`.

`.env` real está en `apps/aeo-auditor/.env` (gitignored, tiene secretos reales).
Ahora mismo: `AEO_MOCK_PIPELINE=false` (modo REAL, gasta API en cada audit).
Para pruebas de UI sin gastar, ponerlo en `true`.

---

## Arquitectura real (ojo: difiere del CLAUDE.md)

- El `apps/aeo-auditor/CLAUDE.md` describe Supabase Edge Functions. ESO ES
  ASPIRACIONAL. El backend real es un servidor Express en
  `apps/aeo-auditor/server/index.ts`, corrido con `tsx`, estado en memoria.
  Ver la memoria `aeo-backend-phase1-express`.
- Pipeline en `server/pipeline.ts`: Stage A genera queries (Claude Haiku) ->
  Stage B lanza los motores -> Stage C parsea (Claude Haiku) -> Stage D
  sintetiza (Claude Sonnet). Stage D ahora inyecta el research base con
  `enableCache: true`.
- `AEO_MOCK_PIPELINE=true` saltea todo el LLM y devuelve `mockSynthesis`
  (scores fijos). En `false` corre real.
- Reporte: `server/report.ts` genera HTML de 8 secciones, `server/pdf.ts` lo
  pasa a PDF con Playwright. El reporte NO lo escribe un LLM, es un template.

---

## Fase 1: qué se hizo y se verificó (Parts A-D)

- Motores reparados: OpenAI usaba `max_tokens` (los modelos GPT-5 requieren
  `max_completion_tokens`); Gemini apuntaba a `gemini-3-pro` (inválido) ->
  `gemini-2.5-pro`. Antes: 12/12 llamadas fallaban por audit. Ahora: 0 errores.
- Perplexity: opt-in vía `ENABLE_PERPLEXITY=true` + su API key. Sin la key
  corre con 3 motores (chatgpt, gemini, claude), sin ruido de error.
- Research base: `aeo-research/` (8 módulos .md + README, ~59K chars). Loader
  en `packages/llm/src/research/loader.ts` (`loadResearchBase()`, cache en
  memoria). Stage D concatena el prompt de síntesis + el research base como
  `enrichedSystem` con reglas de grounding (tags `[research: X §Y]`).
- Cache verificado: en una corrida de 2 audits casi simultáneos, una llamada
  escribió el cache (`cache_creation_input_tokens: 16128`) y la otra lo leyó
  (`cache_read_input_tokens: 16128`). TTL del cache ephemeral = 5 min.
- Grounding verificado: 58 tags `[research:]` en 2 audits, JSON válido.

---

## Pendientes (open items)

1. Bucket C sin commitear. Decidir agrupación y mensajes de commit.
2. `@gms/llm` tiene 3 errores de typecheck PRE-EXISTENTES (claude.ts x2,
   perplexity.ts x1). No rompen el runtime (corre con `tsx`). Sin arreglar.
3. SMTP no configurado: ni el email del reporte ni la notificación de lead
   salen de verdad. Para activarlos hay que poner credenciales SMTP de Resend
   en `.env` (`SMTP_HOST`, `SMTP_PASS` = una API key `re_...`).
4. `PERPLEXITY_API_KEY` vacía. Hoy el grader corre con 3 motores.
5. El cache solo pega si dos síntesis caen dentro de 5 min. Para un grader de
   bajo volumen casi siempre será cache miss. Si importa, evaluar el TTL de
   1 hora (`cache_control` con `ttl: '1h'`).
6. `vite.config.ts` tiene un alias `@gms/db` que apunta a `packages/db/` que
   NO existe.
7. Fase 2: sin definir. El operador decidirá si seguir o pausar para
   validación con cliente.

---

## Gotchas (cosas que confundieron en esta sesión, no repetir el error)

- `buildEngineClients` está en `server/pipeline.ts`, NO en `@gms/llm/index.ts`.
- `pricing.ts` está en `packages/llm/src/pricing.ts`, NO en `src/clients/`.
  `DEFAULT_MODELS` (los modelos por defecto) vive ahí.
- git interactivo (`add -p`, `add -i`, `rebase -i`) NO funciona en este
  entorno. Para staging por hunks usar `git diff | awk | git apply --cached`.
- `tsx` solo resuelve desde `apps/aeo-auditor` (es devDep de ese app). Desde
  `packages/llm` usar el binario: `apps/aeo-auditor/node_modules/.bin/tsx`.
- El server se corre con `npx tsx server/index.ts` (sin `watch` en las
  corridas de esta sesión): hay que reiniciarlo a mano tras cambiar código.
- Referencia del producto: el AEO Grader de HubSpot. Nuestro reporte copia la
  arquitectura de información pero con 4 motores (no 3), marca GMS y copy
  directo en inglés americano.

---

## Próximo paso sugerido

Esperar instrucción del operador: o (a) commitear el Bucket C y cerrar, o
(b) arrancar Fase 2. No commitear ni pushear nada sin que lo pida.
