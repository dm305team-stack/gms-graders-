# Session Handoff — AEO Visibility Auditor

Fecha de la sesión: 2026-05-19 (jornada extendida). Siguiente sesión: 2026-05-20.
Lee este archivo completo antes de tocar nada.

---

## Estado en una línea

Phase 2 brief renderer terminado + bug del layout del PDF (17 páginas con
orphans) **arreglado** (17 → 10 páginas). Sin commitear. Mañana: validación
visual + audit real + decidir commits.

---

## Git

Branch: `feature/aeo-pdf-report`. NO main. Nada pusheado.

HEAD: `766833e feat(aeo): Bucket C funnel completo - form->audit->blur+gate->emails`

### Working tree — sin commitear

Modificados:

- `apps/aeo-auditor/server/report.ts`
  Reescritura completa del renderer del brief (Phase 2) +
  bloque `PRINT_OVERRIDES` para fix del layout del PDF (ver más abajo).

- `apps/aeo-auditor/server/pdf.ts`
  Agregado `preferCSSPageSize: true` al `page.pdf({...})` de Playwright.

- `packages/llm/src/prompts/synthesize.ts`
  Directiva `CRITICAL OUTPUT LANGUAGE: ... US English` prepended al
  `SYNTHESIZE_REPORT_PROMPT_V1`. **Próxima audit paga ~14K tokens de cache
  write**, esperado.

- `package.json` (root), `pnpm-lock.yaml`, `apps/aeo-auditor/package.json`
  Trabajo de la saga pnpm/corepack para Hostinger (`packageManager`
  eliminado, lockfile en pnpm 9.15.9, `tsx` movido a `dependencies`).

- `apps/aeo-auditor/server/index.ts`
  Solo diferencia cosmética vs HEAD (trabajo del Hostinger task con
  `'0.0.0.0'` listen + bloque static + dynamic PORT). Net funcional cero
  más allá de eso. `git checkout` si querés dejarlo limpio.

Untracked:

- `.npmrc` — `minimum-release-age=0`. Desactiva cooldown anti-supply-chain.
- `gms-graders-deploy.zip` — artefacto de deploy (2.2 MB). Considerar
  `*.zip` en gitignore.
- `source/test*.png` — pre-existente.
- `session.md` — este archivo.

---

## Qué se hizo HOY (jornada extendida)

### 1. Bucket C — committed en `766833e`

Funnel: form 5 campos → audit → vista del report real desenfocado con gate
inline → 2 emails (cliente + Fermin) con PDF adjunto. SMTP Resend gateway.

### 2. Phase 2 — Brief renderer (sin commitear)

`server/report.ts` reescrito para producir el Deep Audit Brief matcheando
`templates/brief-master.html`. 10 secciones. Engine count dinámico. Footnotes
numerados a partir de tags `[research:]` del JSON. Más detalle en el handoff
previo y en los comments del archivo.

### 3. Prompt: forzado de idioma inglés (sin commitear)

Directiva al comienzo de `SYNTHESIZE_REPORT_PROMPT_V1` que fuerza US English
en todos los strings narrativos. El resto del prompt intacto. Antes producía
español; ahora va a producir inglés.

### 4. PDF layout fix (sin commitear) — bug del audit AEO-cb80553e

**Síntoma**: PDFs renderizaban 17 páginas en vez de 10. Headers de sección
quedaban huérfanos en su propia página, con el contenido en la siguiente. Una
sentencia única en otra página. Márgenes inferiores variables.

**Diagnóstico**: el master spec tiene `.page { min-height: 11in }` con
`@page { size: letter; margin: 0 }`. Cada `<section class="page">` quiere
llenar exactamente una página física. Pero Chromium con sub-pixel font
metrics renderiza el box ligeramente más alto que 11in (overshoot por unos
pocos píxeles), lo que empuja cada sección a una segunda página física, con
el `.page-footer` (absoluto en `bottom: 0.4in`) en página 2 solo. 10 secciones
× ~1.7 páginas reales = 17 páginas con orphans.

**Fix**: bloque `PRINT_OVERRIDES` en `report.ts` que clampa la altura a
exactamente 11in con `overflow: hidden` y tightenea el contenido para que
NO recorte:

  ```css
  .page:not(.cover) {
    height: 11in; min-height: 11in; max-height: 11in;
    overflow: hidden;
    padding: 0.6in 0.75in 0.65in 0.75in;
  }
  .cover { height: 11in; min-height: 11in; max-height: 11in; overflow: hidden; }
  ```

Además: tightening en cover (font 64→56px, score 140→124px), sec-head
(h2 42→36px), method-cards, scorecard rows, e-cards, recs (font 26→21px,
tier badges, etc.), comp-table. `break-inside: avoid` en cards/recs/fn-items
y `break-after: avoid` en headers. `orphans: 3; widows: 3;` en paragraphs.

Además en `pdf.ts`: `preferCSSPageSize: true` para que el `@page` del CSS
gobierne sobre los args de Playwright.

**Resultado verificado**: re-rendericé el HTML de `AEO-cb80553e` con los
overrides inyectados y el nuevo `pdf.ts`. PDF resultado en `/tmp/AEO-cb80553e-fixed.pdf`.
**17 → 10 páginas**, una por sección, todas con contenido sustantivo:

  p1 Cover · p2 Executive Verdict · p3 Methodology · p4 Scorecard ·
  p5 Per-Engine Findings · p6 Structural Analysis · p7 Competitive Landscape ·
  p8 Recommendations · p9 Sources & Footnotes · p10 Next Steps

El master spec **NO se tocó** (`brief-master.html` intacto). Los overrides
viven como un segundo `<style>` block dentro de `report.ts`, inyectado
después del CSS extraído del master. Cascade resuelve a los overrides.

**Compromises visuales aceptados**:
- Tipografía levemente reducida vs el master para garantizar que el
  contenido entre en 11in (h1 cover 64→56px, h2 sec-head 42→36px,
  cover-score-num 140→124px, recs title 26→21px, etc.).
- `overflow: hidden` en cada sección: si una sección tiene contenido
  excepcionalmente largo (más allá del worst-case planificado), las
  últimas líneas se clipean al borde inferior del frame de 11in en lugar
  de spillear a una segunda página. Mejor que orphans.
- Cover-title sin italic-split (sigue así desde Phase 2 — no se puede
  auto-derivar el split del master `Dr. Jonathan <em>Schwitzer</em><br>
  Plastic Surgery` desde un brand genérico).

---

## Pendientes (open items)

### 1. Validación visual del PDF arreglado

`/tmp/AEO-cb80553e-fixed.pdf` quedó en disco para que lo abras y verifiques
visualmente:
```bash
open /tmp/AEO-cb80553e-fixed.pdf
```
Comparar contra `apps/aeo-auditor/.aeo-data/reports/AEO-cb80553e.pdf` (el
buggy de 17 páginas). Confirmá:
- 10 páginas, una por sección.
- Cover completa con todo (sin spill a página 2).
- Per-Engine en página 5 con las 4 cards (no header solo).
- Competitive context en página 7 con la tabla (no sentencia única en
  página aparte).
- Next Steps en página 10, sin cramping arriba.

Si encontrás alguna sección donde se clipea contenido por el `overflow: hidden`,
decime cuál y hago tightening puntual ahí.

### 2. Audit real para validar end-to-end con el prompt nuevo

Necesario para confirmar:
- Que Stage D produce inglés (no español).
- Que el renderer + PDF fix funciona en el camino productivo (no solo en
  test). El test usó el HTML de cb80553e + override injection; el path real
  va por `renderReportHtml` que ya inyecta `PRINT_OVERRIDES` por código.
- Que los emails siguen saliendo y el flujo Bucket C completo no rompió.

Costo: la primera audit paga ~14K tokens de cache write por el prompt nuevo
(~$0.21 extra). Las siguientes vuelven a cache hits normales.

Payload Schwitzer en sección "Cómo correr" del handoff previo.

### 3. Decidir commits

Cuatro bloques separables:

a. **Prompt language directive** (`packages/llm/src/prompts/synthesize.ts`)
   `feat(@gms/llm): force US English output in SYNTHESIZE_REPORT_PROMPT_V1`

b. **Phase 2 brief renderer + PDF layout fix** (`report.ts`, `pdf.ts`)
   `feat(aeo): render Deep Audit Brief against brief-master.html (10-page layout)`
   Se pueden combinar — el PDF fix es un addendum al brief refactor; van
   funcionalmente juntos.

c. **Deploy prep dust** (`package.json`, `pnpm-lock.yaml`,
   `apps/aeo-auditor/package.json`, `.npmrc`)
   `chore(deploy): hostinger pnpm 9 config, no packageManager pin`

d. **server/index.ts cosmético** (si el diff vs HEAD existe)
   `git checkout` si solo es whitespace; el bloque productivo ya está
   en `766833e`.

### 4. Hostinger deploy

Sin resolver. Path recomendado: cambiar a Node 22 en el panel (1 clic).
Si no, manual SSH con `corepack disable` + `npm i -g pnpm@9`. Más
detalle en `deploy/HOSTINGER.md`.

### 5. Limpieza menor

- `engines.pnpm: ">=9"` en root `package.json` es stale.
- Considerar `*.zip` en `.gitignore`.
- `source/test*.png` siguen untracked.

---

## Cómo correr

```bash
pnpm --filter @gms/aeo-auditor dev:all   # vite 5173 + api 3334
open http://localhost:5173                # webapp
```

Payload Schwitzer para audit real:
```json
{
  "domain": "drjonathanschwitzer.com",
  "brand": "Dr. Jonathan Schwitzer Plastic Surgery",
  "location": "Bay Harbor Islands, FL",
  "specialty": "Plastic surgery",
  "product": "Rhinoplasty, facelift, breast augmentation, mommy makeover"
}
```

Smoke test prod local:
```bash
cd apps/aeo-auditor
pnpm build
NODE_ENV=production PORT=4173 npx tsx server/index.ts
curl -I http://localhost:4173
```

Para mock testing sin gastar API: `AEO_MOCK_PIPELINE=true` en `.env`.

---

## Arquitectura — recordatorio

- `server/index.ts`: Express + in-memory `Map`. Endpoints `/api/run-analysis`,
  `/api/analyses/:id`, `/api/analyses/:id/{report,report.pdf}`,
  `/api/analyses/:id/unlock`. En prod sirve `dist/` también.

- `server/pipeline.ts`: Stage A (Haiku queries) → Stage B (motores en
  paralelo) → Stage C (Haiku parse) → Stage D (Sonnet synthesis con research
  base + prompt caching) → renderiza HTML/PDF. Status → `done`. NO envía
  emails — eso lo hace `/unlock`.

- `server/report.ts`: renderer del brief. Lee `templates/brief-master.html`
  solo para extraer el `<style>` block + inyectar `PRINT_OVERRIDES`. El
  resto del HTML se genera por código.

- `server/pdf.ts`: HTML → PDF vía Playwright headless Chromium.
  `preferCSSPageSize: true` deja al `@page` del master gobernar.

- `server/email.ts`: Resend SMTP gateway. `sendReportEmail` + `sendLeadNotification`,
  ambos con PDF adjunto.

- `packages/llm/`: clients de los 4 motores + prompts + research base loader.
  El prompt `SYNTHESIZE_REPORT_PROMPT_V1` arranca con la directiva de inglés.

- `apps/aeo-auditor/server/templates/brief-master.html`: master spec.
  **READ-ONLY.** El renderer le extrae el CSS al cargar.

- `aeo-research/`: research base (8 módulos + README). **READ-ONLY.**

---

## Gotchas (no repetir errores)

- **Master tiene `min-height: 11in` que causa overshoot**. Si querés volver
  a un PDF que respete el master 100% en tipografía, el bug de las 17
  páginas vuelve. El fix actual prioriza layout limpio sobre 100% fidelidad
  tipográfica.

- **Idioma del JSON**: hasta esta sesión salía en español. El prompt nuevo
  fuerza inglés. Validación end-to-end pendiente.

- **`by_engine` siempre tiene 4 llaves** aunque ENABLE_PERPLEXITY=false.
  El renderer filtra por `activeEngines()`. No iterar `Object.keys`.

- **Source scores en 0-10**: el JSON real trae score en 0-10. El renderer
  auto-normaliza ×10 si ≤ 10.

- **Hostinger panel no lee `package.json`**: la saga de pnpm versions fue
  inútil contra el panel. El fix real está en plataforma (Node 22 / SSH).

- **`tsx watch` borra el `Map` de analyses al recargar**. Audits en curso
  se pierden al guardar un archivo del server.

- **`brief-master.html` pesa 270KB por el logo en base64**. No abrir con
  Read tool de golpe; usar offset+limit.

- **`/tmp/AEO-cb80553e-fixed.pdf`** es el archivo de verificación visual
  del fix de layout. Si querés reproducirlo, el path real productivo va
  por `renderReportHtml` que ya tiene `PRINT_OVERRIDES` bakeado adentro;
  un audit real ya genera con el fix aplicado.

---

## Próximo paso sugerido (mañana)

1. Abrí `/tmp/AEO-cb80553e-fixed.pdf` y verificá las 10 páginas.
2. Corré una audit real con el prompt nuevo (Schwitzer payload). Validá
   idioma inglés + email delivery + brief PDF.
3. Si todo OK: commitear en 2-3 commits separados (ver Pendientes #3).
4. Resolver Hostinger (Node 22 en panel o SSH manual).
