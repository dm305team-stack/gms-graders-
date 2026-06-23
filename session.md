# Session Handoff — AEO Visibility Auditor

Fecha de actualización: 2026-06-22. Esta es la entrada principal del proyecto.
Lee este archivo primero. Para detalle histórico ver `session-2026-05-20.md` →
`session-2026-05-21.md` → `session-2026-05-28.md` → `session-2026-06-18.md` →
`session-2026-06-22.md`.

> ✅ Lo último (2026-06-22, todo DESPLEGADO a prod, HEAD `cd2edef`):
> 1. **Grounding** (06-18): motores corren con búsqueda web, arregla el 5/100.
> 2. **Prompts curados estilo Peec:** 5 cuadros editables en el form, debajo de
>    "Product or service", opcionales, con botón "Suggest". Las queries salen en
>    el reporte. Endpoint `/api/suggest-queries`.
> 3. **Términos de Servicio:** `/terms.html` + link en footer (data, AI, arbitraje,
>    DMCA).
> 4. **Fix de layout del reporte:** ningún texto toca el borde inferior (pág 3/4/5).
>
> Detalle en `session-2026-06-22.md`. Proceso: el operador autorizó deploy SIN
> preguntar. Pendiente clave: cargar `PERPLEXITY_API_KEY` en el `.env` de prod.

---

## ⚓ ESTADO ACTUAL — EN PRODUCCIÓN en `scanaeo.com`

Deploy Docker en el VPS Hostinger completado ~2026-05-29 (cert Let's Encrypt
emitido May 29). Verificado en vivo el 2026-06-18: `https://scanaeo.com` sirve el
frontend real, `/api/health` responde `ok` en modo REAL (`mock_pipeline:false`,
SMTP + Anthropic configurados), `/console.html` gateada con basic auth (`401`).

| Capa | Estado | Última verificación |
|---|---|---|
| Pipeline 4-stage (queries → motores → parse → synthesis) | ✅ Operativo | Real audit `AEO-996501b3` en 3:25, $0.211 |
| Stage D inglés forzado | ✅ Validado | 0 conjugaciones en español |
| PDF brief 11 páginas, split 3+3 Recommendations | ✅ Validado | Mock audit, 11 páginas |
| Form gate + Bucket C funnel | ✅ Operativo | Sin retroceso |
| **Consola de operador** (`/console.html`, lista + reportes + charts) | ✅ Validado | Mock + Playwright render, 0 errores · commit `44bf076` |
| Persistencia sidecar JSON (`<id>.json` por audit) | ✅ Operativo | Sobrevive reinicio (`source: sidecar`) |
| Repo en GitHub | ✅ `dm305team-stack/gms-graders-` PRIVATE | Branch `feature/aeo-pdf-report` al commit `d1bf95d` |
| **Deploy Hostinger VPS (Docker)** | ✅ **EN PRODUCCIÓN** | `https://scanaeo.com` 200 OK · health `ok` · TLS válido → Aug 27 2026 |
| **Fix grounding (motores buscan en web)** | ✅ **DESPLEGADO** (`15f68fc`) | Prod smoke `AEO-2769a791`: 5/100 → 45/72/75 (cover ~64), $2.34. Falta key Perplexity |
| **Prompts curados Peec (in-form, 5 cuadros)** | ✅ **DESPLEGADO** (`b172678`+`a6354bc`) | Cuadros bajo "Product"; filtro brand-free OK; queries en el reporte |
| **Términos de Servicio** (`/terms.html` + footer) | ✅ **DESPLEGADO** (`8fdda38`) | 4 bloques (data/AI/arbitraje/DMCA); sin dirección física |
| **Fix layout reporte (borde inferior)** | ✅ **DESPLEGADO** (`cd2edef`) | Verificado contra `AEO-e2341ba4`, pág 3/4/5 con aire al footer |
| GitHub App (`/install-github-app`) | ⏸️ Pausado | Fases 1-2 hechas, 3-5 sin ejecutar |

---

## Git

Branch activo: **`feature/aeo-pdf-report`**, tracking `origin/feature/aeo-pdf-report`.
Prod (`scanaeo.com`) corre este mismo branch al HEAD actual.

```
cd2edef fix(aeo): keep report text clear of the bottom page edge
a6354bc fix(aeo): move the 5 prompt boxes into the scope form under Product
8fdda38 feat(aeo): add Terms of Service page + footer link
b172678 feat(aeo): client-curated long-tail prompts (Peec-style)
d6e9532 docs(session): grounding fix deployed to prod, handoff updated
15f68fc feat(aeo): measure grounded AI visibility (fix false 5/100)
```

Remote: `https://github.com/dm305team-stack/gms-graders-.git` (guion final, privado).
Git identity: `dm305team` / `dm305team@gmail.com`. Working tree limpio, todo pusheado.

---

## Deploy a Hostinger VPS (Docker) — EN PRODUCCIÓN

**Vive en `https://scanaeo.com`** (VPS Hostinger, IP `2.24.96.187`). El path que se
ejecutó: Docker, build en el VPS desde el repo privado clonado. Consola con basic
auth. Updates manuales (sin CI). nginx/1.24.0 (Ubuntu) + Express detrás, TLS Let's
Encrypt (`May 29 → Aug 27 2026`). DNS `scanaeo.com` + `www` → `2.24.96.187`.

**Artefactos en el repo:** `Dockerfile`, `docker-compose.yml`, `.dockerignore`,
`deploy/nginx-aeo.conf`, `deploy/HOSTINGER-DOCKER.md` (runbook del path Docker),
`deploy/HOSTINGER.md` (path bare-metal alternativo).

**Cómo actualizar prod (manual, sin CI):**

```bash
ssh root@2.24.96.187
cd <repo>                       # donde se clonó gms-graders-
git pull                        # branch feature/aeo-pdf-report
docker compose up -d --build    # rebuild + restart
curl http://127.0.0.1:3334/api/health
```

**Verificación rápida desde fuera:** `curl https://scanaeo.com/api/health`
(debe dar `status:ok`); `/console.html` debe dar `401` (basic auth).

> El cuadro de Hostinger "pegar docker-compose URL/YAML" NO sirve: repo privado
> (raw URL da 404) y el compose hace `build: .` (necesita el código). Por eso se
> clonó y buildeó en el VPS.

---

## Cómo correr local

```bash
pnpm --filter @gms/aeo-auditor dev:all
# Vite frontend  → http://localhost:5173/
# Consola        → http://localhost:5173/console.html
# API backend    → http://localhost:3334/
```

Mock sin costo: `AEO_MOCK_PIPELINE=true pnpm --filter @gms/aeo-auditor dev:all`.
`.env` actual: `AEO_MOCK_PIPELINE=false` (REAL grounded, ~$2/audit con 12 queries × 3 motores).
Render del reporte desde un sidecar sin correr audit: script tsx que llame
`renderReportHtml` + `renderPdf` (ver `session-2026-06-22.md`).

Audit por CLI:
```bash
curl -X POST http://localhost:3334/api/run-analysis -H "Content-Type: application/json" \
  -d '{"domain":"drjonathanschwitzer.com","brand":"Dr. Jonathan Schwitzer","location":"Bay Harbor Islands, FL","specialty":"Plastic surgery","product":"Rhinoplasty"}'
```

---

## Pendientes

- **Cargar `PERPLEXITY_API_KEY` en el `.env` de PROD** (`/docker/gms-graders/apps/aeo-auditor/.env`,
  hoy vacío) y `docker compose up -d --build`. Con eso entra el 4º motor.
- **Costo por audit en prod ≈ $2.34** (12 queries × 3 motores grounded; sube con
  Perplexity). Endpoint público: cada submission cuesta eso. Si el volumen lo amerita,
  bajar `AEO_MAX_QUERIES` en el `.env`/compose de prod.
- **Validar email en prod:** completar el unlock en `scanaeo.com` y confirmar
  entrega del PDF vía Resend en vivo.
- Renovación TLS: confirmar que `certbot` tiene el timer/cron activo (cert vence
  Aug 27 2026).
- Eventualmente: merge de `feature/aeo-pdf-report` a `main` (hoy prod corre sobre
  la feature branch; el deploy hace `git pull` de esa branch).
- Mejoras no urgentes: refactor del `Map` en memoria a Postgres; backups del
  directorio `.aeo-data/` (sidecars + reportes) en el VPS.

---

## Endpoints del API

```
GET   /api/health
POST  /api/suggest-queries               → 5 prompts long-tail (paso de sugerencias) [NUEVO]
POST  /api/run-analysis                 → kick-off audit (acepta custom_queries)
GET   /api/analyses                      → lista (consola; memoria + disco)   [NUEVO]
GET   /api/analyses/:id                  → estado de un audit
GET   /api/analyses/:id/data             → payload completo + synthesis (consola) [NUEVO]
GET   /api/analyses/:id/report           → HTML del brief (fallback a disco)
GET   /api/analyses/:id/report.pdf       → PDF del brief (fallback a disco)
POST  /api/analyses/:id/unlock           → captura de lead + emails
```

---

## Gotchas

- **Config-shadow:** `tsc -b` emitía `vite.config.js` que shadoweaba `vite.config.ts`
  (Vite resuelve `.js` antes que `.ts`). Arreglado con `outDir` en `tsconfig.node.json`
  + gitignore. **No recommitear `vite.config.js`.**
- **Build necesita install completo:** `vite` es devDep, `recharts`/`tsx`/`playwright`
  en deps. Usar `pnpm install --frozen-lockfile` (NO `--prod`).
- **Contenedor bindea `0.0.0.0:3334`** (`server/index.ts:302`); el host publica
  `127.0.0.1:3334`. El `127.0.0.1` del healthcheck es el loopback del propio
  contenedor (OK porque bindea 0.0.0.0).
- **Imagen Docker:** tag de Playwright debe igualar el npm `playwright` (^1.60.0).
- **`tsx watch` borra el `Map`** al recargar (audits en curso se pierden; los
  sidecars JSON y reportes en `.aeo-data/` sobreviven).
- **Perplexity:** prende solo si hay `PERPLEXITY_API_KEY` (gate `ENABLE_PERPLEXITY !== 'false'`).
  En prod la key está vacía → corren 3 motores (chatgpt/gemini/claude grounded).
- **Consola es interna:** en prod va detrás de basic auth (nginx); UFW debe bloquear
  el `:3334` directo o el basic auth se saltea.
