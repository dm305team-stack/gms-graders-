# Session Handoff — AEO Visibility Auditor

Fecha de actualización: 2026-06-18. Esta es la entrada principal del proyecto.
Lee este archivo primero. Para detalle histórico ver `session-2026-05-20.md` →
`session-2026-05-21.md` → `session-2026-05-28.md` → `session-2026-06-18.md`.

> ✅ Lo último (2026-06-18): se arregló el bug de scoring (medía sin búsqueda
> web, daba 5/100 a marcas visibles). Ahora los motores corren con grounding.
> **Commiteado (`15f68fc`) y DESPLEGADO a prod.** Smoke real en prod
> `AEO-2769a791`: 5/100 → 45/72/75 (cover ~64), $2.34. Pendiente: cargar
> `PERPLEXITY_API_KEY` en el `.env` de prod para el 4º motor. Detalle en
> `session-2026-06-18.md`.

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
| GitHub App (`/install-github-app`) | ⏸️ Pausado | Fases 1-2 hechas, 3-5 sin ejecutar |

---

## Git

Branch activo: **`feature/aeo-pdf-report`**, tracking `origin/feature/aeo-pdf-report`.

```
d1bf95d docs(deploy): clarify container binds 0.0.0.0, host publishes 127.0.0.1
3b316f3 chore(deploy): Docker build-on-VPS path (Dockerfile, compose, runbook)
0945d93 chore: hero copy tweak + refresh session handoff doc
06afe58 chore(deploy): VPS runbook + nginx config with gated console
44bf076 feat(aeo): operator console with per-audit charts and JSON persistence
2be0b4b chore(deploy): pin pnpm to 9.15.4 via packageManager + cap engines <11
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
`.env` actual: `AEO_MOCK_PIPELINE=false` (REAL, ~$0.21/audit).

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
POST  /api/run-analysis                 → kick-off audit
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
- **Perplexity disabled** por default (`ENABLE_PERPLEXITY` sin set): corren 3 motores.
- **Consola es interna:** en prod va detrás de basic auth (nginx); UFW debe bloquear
  el `:3334` directo o el basic auth se saltea.
