# Session Handoff — AEO Visibility Auditor

Fecha de actualización: 2026-05-21. Esta es la entrada principal del proyecto.
Lee este archivo primero. Para detalle histórico ver `session-2026-05-19` → `session-2026-05-20.md` → `session-2026-05-21.md`.

---

## ⚓ ESTADO ACTUAL — MVP OPERATIVO, EN GITHUB, CORRIENDO LOCAL

| Capa | Estado | Última verificación |
|---|---|---|
| Pipeline 4-stage (queries → motores → parse → synthesis) | ✅ Operativo | Real audit `AEO-996501b3` en 3:25, $0.211 |
| Stage D inglés forzado | ✅ Validado | 0 conjugaciones en español en 271KB HTML |
| PDF brief 11 páginas físicas, split 3+3 Recommendations | ✅ Validado | Mock audit `AEO-b4b7b107`, 11 páginas, 6 rec items |
| Form gate + Bucket C funnel (audit → blur → gate → emails) | ✅ Operativo | Sin retroceso desde sesión 2026-05-19 |
| Landing con `AeoDimensions` (6 parámetros 3x2) | ✅ Nuevo | Commit `4ec4093` |
| Repo en GitHub | ✅ `dm305team-stack/gms-graders-` PRIVATE | Branch `feature/aeo-pdf-report` pusheado al commit `e7c131c` |
| Working tree | ✅ Limpio al cierre | (este archivo lo modificará después de leerlo) |
| Dev servers local (`dev:all`) | ▶️ Corriendo | Vite :5173 + API :3334 (PID 12072, REAL pipeline) |
| Deploy Hostinger | ⏸️ Pausado | Operador trabaja local; plan VPS KVM 2 + `scanaeo.com` armado |
| GitHub App (`/install-github-app`) | ⏸️ Pausado | Fases 1-2 hechas, 3-5 sin ejecutar |

---

## Git

Branch activo: **`feature/aeo-pdf-report`**, tracking `origin/feature/aeo-pdf-report`.

```
e7c131c chore: gitignore zip artifacts and save session handoff docs
a0b1b36 chore(deploy): hostinger prep — listen 0.0.0.0, tsx in deps, .npmrc
4ec4093 feat(aeo): add AeoDimensions section to landing (six weighted parameters)
326aa36 feat(aeo): render Deep Audit Brief on 10-page layout with 3+3 split for Recommendations
1fb9379 feat(@gms/llm): force US English output in SYNTHESIZE_REPORT_PROMPT_V1
34c381a chore: ignore deploy tarballs                       ← anchor MVP (cierre 2026-05-20)
766833e feat(aeo): Bucket C funnel completo
53744ca feat(aeo): ground Stage D synthesis in AEO research base with prompt caching
c011df6 fix(@gms/llm): repair OpenAI/Gemini engines and gate Perplexity
69ca105 AEO report: 8-section multi-page PDF modeled on the HubSpot grader
cc91505 Initial commit: GMS Graders monorepo + AEO auditor Phase 1 backend
```

Remote: `https://github.com/dm305team-stack/gms-graders-.git` (con guion final, repo privado).
Git identity local: `dm305team` / `dm305team@gmail.com`.

---

## Cómo correr ahora mismo

### Local con dev:all (Vite + API en paralelo)

```bash
pnpm --filter @gms/aeo-auditor dev:all
# → Vite frontend en http://localhost:5173/
# → API backend en http://localhost:3334/
```

Si en este momento están corriendo (PID 12072), abrir directo:
**http://localhost:5173/**

### Toggle de modo pipeline

`.env` actual: `AEO_MOCK_PIPELINE=false` (REAL, cada audit cuesta ~$0.21).

Para correr sin costo:
```bash
AEO_MOCK_PIPELINE=true pnpm --filter @gms/aeo-auditor dev:all
```

### Audit real desde CLI (sin pasar por el frontend)

```bash
curl -X POST http://localhost:3334/api/run-analysis \
  -H "Content-Type: application/json" \
  -d '{"domain":"drjonathanschwitzer.com","brand":"Dr. Jonathan Schwitzer Plastic Surgery","location":"Bay Harbor Islands, FL","specialty":"Plastic surgery","product":"Rhinoplasty, facelift, breast augmentation"}'

# Devuelve { "analysis_id": "AEO-...", "status": "queued" }
# Polling:
curl http://localhost:3334/api/analyses/<id>

# Cuando status=done:
open apps/aeo-auditor/.aeo-data/reports/<id>.pdf
```

---

## Qué se hizo en la sesión 2026-05-21

### 1. Setup GitHub (Fases 1-2 de 5)

- Operador autenticado como `dm305team-stack` via `gh auth login`.
- Remote URL corregido: `gms-graders.git` → `gms-graders-.git` (con guion final).
- Git identity local seteada (`dm305team` / `dm305team@gmail.com`).
- `main` y `feature/aeo-pdf-report` pusheados con upstream.
- Repo cambiado a PRIVATE (`gh repo edit --visibility private`).

Fases 3-5 (install-github-app + whitelist workflow + spend cap) pausadas.
Plan completo en `~/.claude/plans/primero-me-gustaria-saber-logical-crystal.md`.

### 2. Diagnóstico estructural Hostinger Premium

Identificadas 6 paredes que hacen Premium inviable sin refactor masivo. Las
dos fatales: Playwright Chromium (sin apt install) y packages internos que
exportan TypeScript crudo (sin tsx como entry).

Path A (Hostinger VPS KVM 2 + `scanaeo.com`) armado como brief listo para
agente de instalación de Hostinger. Operador decidió pausar el deploy y
seguir local.

### 3. Validación end-to-end del MVP

- **Mock audit `AEO-b4b7b107`**: 11 páginas físicas, 6 rec items presentes,
  header `· CONTINUED` en página B. Split 3+3 confirmado.
- **Real audit `AEO-996501b3`**: 3:25 minutos, $0.211, 18 engine calls
  (3 motores × 6 queries). Cero palabras en español en 271KB HTML.
  Stage D inglés confirmado.

### 4. Cinco commits separables ejecutados desde working tree heredado

Trabajo de 3 sesiones (`feature/aeo-pdf-report` desde `34c381a`) consolidado en:
- Stage D English directive
- Brief renderer 10-page + split 3+3
- AeoDimensions landing section
- Hostinger prep (listen 0.0.0.0, tsx en deps, .npmrc)
- gitignore zips + handoff docs (3 archivos session)

Working tree quedó limpio. Todo pusheado a GitHub.

### 5. Dev servers locales arrancados

Para testing manual del operador. Corriendo en `pnpm dev:all` con REAL pipeline.

---

## Pendientes (paused tracks)

### A. Setup GitHub Fases 3-5

1. (operador) `/install-github-app` en Claude Code → elegir repo `gms-graders-` → pegar `ANTHROPIC_API_KEY`. Genera `.github/workflows/claude.yml`.
2. (Claude) Agregar whitelist al workflow: `if: github.event.sender.login == 'dm305team-stack'`. Commit + push.
3. (operador) Monthly spend cap en `console.anthropic.com/settings/limits` como red de seguridad.

Plan completo en `~/.claude/plans/primero-me-gustaria-saber-logical-crystal.md`.

### B. Deploy a Hostinger (cuando se decida)

- Comprar VPS KVM 2 anual ($119.88 primer año, $203.88 renovación)
- Registrar `scanaeo.com` y apuntar A record a IP del VPS
- Brief completo de setup armado, incluye:
  - Node 20 vía nvm, pnpm 9 vía corepack, pm2
  - `npx playwright install chromium --with-deps` (instala las ~25 libs del sistema)
  - Deploy key SSH para clonar el repo privado
  - nginx reverse proxy + certbot Let's Encrypt
  - `.github/workflows/deploy-hostinger.yml` con `appleboy/ssh-action` (post-setup)

Memoria persistente: `~/.claude/projects/.../memory/aeo-deploy-on-hold.md`.

### C. Mejoras futuras (no urgentes)

- Validar email delivery end-to-end (Bucket C completo con SMTP Resend en prod)
- Refactor del `Map<id, Analysis>` en memoria a Supabase Postgres (preparación multi-instance)
- Monitoring del costo por audit en producción
- Test visual del PDF (abrir manualmente y verificar layout en cada página)

---

## Arquitectura (sin cambios)

```
gms-graders/                            ← monorepo pnpm
├── apps/aeo-auditor/
│   ├── server/
│   │   ├── index.ts                    ← Express + Map<id, Analysis>, listen 0.0.0.0:$PORT
│   │   ├── pipeline.ts                 ← Stage A-D orchestration
│   │   ├── report.ts                   ← renderer del brief (renderRecommendationsPage retorna 2 sections)
│   │   ├── pdf.ts                      ← Playwright headless Chromium, preferCSSPageSize=true
│   │   └── email.ts                    ← Resend SMTP, 2 emails (lead + Fermin)
│   ├── src/                            ← Vite + React frontend
│   │   ├── App.tsx
│   │   └── components/
│   │       └── AeoDimensions.tsx       ← NEW: 6 parámetros del análisis (3x2 grid)
│   ├── templates/brief-master.html     ← READ-ONLY, master del layout (270KB con logo base64)
│   └── .aeo-data/reports/              ← runtime, gitignored, PDFs + HTMLs renderizados
│
├── packages/
│   ├── llm/                            ← clients 4 motores + prompts + research base
│   │   └── src/prompts/synthesize.ts   ← directiva inglés prepended HOY
│   └── ui/                             ← design system compartido
│
├── aeo-research/                       ← READ-ONLY base de evidencia académica para Stage D
├── ecosystem.config.cjs                ← pm2 config (npx tsx server/index.ts)
└── deploy/HOSTINGER.md                 ← docs deploy VPS (referencia para retomar)
```

---

## Endpoints del API

```
GET   /api/health                       → estado del server
POST  /api/run-analysis                 → kick-off audit (body: domain, brand, location, specialty, product)
GET   /api/analyses/:id                 → estado de un audit
GET   /api/analyses/:id/report          → HTML del brief
GET   /api/analyses/:id/report.pdf      → PDF del brief
POST  /api/analyses/:id/unlock          → captura de lead + envía emails (Bucket C gate)
```

---

## Gotchas

- **`renderRecommendationsPage` retorna 2 sections, no 1**. Si se agrega item 07, hay que splitar a 3 páginas o aceptar overflow.
- **`break-inside: avoid` en `.rec-item` no defiende** cuando la página tiene `overflow: hidden` + altura fija. Defensa real = split manual en HTML.
- **Brief tiene 11 páginas físicas** (cover + 9 numeradas + next steps). Footers van `02 / 10` a `10 / 10`.
- **`tsx watch` borra el `Map` de analyses al recargar**. Audits en curso se pierden al guardar un archivo del server.
- **`brief-master.html` pesa 270KB por el logo base64**. No abrir con Read tool de golpe; usar offset+limit.
- **Perplexity disabled por default**: `ENABLE_PERPLEXITY` no está set en `.env`, así que solo corren 3 motores. Audit real costó $0.211 con esa config.
- **Idioma Stage D**: forzado a inglés vía directiva en `SYNTHESIZE_REPORT_PROMPT_V1`. No quitar ni mover esa directiva sin re-validar.
- **`packages/llm` y `packages/ui` exportan TypeScript crudo** (`"main": "./src/index.ts"`), no JS compilado. El server depende de tsx como loader. Crítico para cualquier deploy futuro.

---

## Próximo paso sugerido

El proyecto está operativo y pusheado. Opciones para la próxima sesión:

1. **Retomar setup GitHub Fases 3-5** si querés `@claude` en issues/PRs del repo.
2. **Retomar deploy Hostinger** cuando el VPS esté comprado (plan listo).
3. **Nueva feature** sobre el MVP estable.
4. **Refactor del state en memoria** a Supabase Postgres.

Nada urgente. MVP corre y entrega PDF completo bajo Bucket C.
