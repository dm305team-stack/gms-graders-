# Deploy — AEO Auditor on Hostinger (Node.js)

The AEO Auditor is a single Express process. In production it serves both the
API and the built React frontend on one port, same-origin. No Vite, no proxy.

## What runs in production

- `apps/aeo-auditor/server/index.ts` — Express, run directly with `tsx`
  (no compile step for the server).
- `apps/aeo-auditor/dist/` — the built frontend, produced by `pnpm build` and
  served statically by Express when `NODE_ENV=production`.

The server resolves `@gms/llm` and `@gms/ui` through the pnpm workspace, so the
**whole monorepo** must be deployed (`apps/` + `packages/` + workspace files),
not just `apps/aeo-auditor`.

## Prerequisites on the server

- Node.js 20+ and `pnpm` (`npm i -g pnpm`).
- `pm2` for process management (`npm i -g pm2`).

## Deploy steps

From the repo root on the server:

```bash
# 1. Install all workspace dependencies
pnpm install --frozen-lockfile

# 2. Build the frontend (produces apps/aeo-auditor/dist/)
pnpm --filter @gms/aeo-auditor build

# 3. Install the Chromium runtime for PDF rendering (server/pdf.ts uses Playwright)
cd apps/aeo-auditor && npx playwright install chromium && cd ../..

# 4. Configure environment
cp apps/aeo-auditor/.env.production.example apps/aeo-auditor/.env
#    then edit apps/aeo-auditor/.env and fill in the real secret values

# 5. Start under pm2 using the root ecosystem file
pm2 start ecosystem.config.cjs
pm2 save
```

`ecosystem.config.cjs` runs `npx tsx server/index.ts` from `apps/aeo-auditor`
with `NODE_ENV=production`, one instance, autorestart, 500M memory cap.

## Port

Express reads `process.env.PORT || process.env.AEO_API_PORT || 3334`. Hostinger
assigns `PORT` automatically; the app picks it up with no change. `AEO_API_PORT`
in `.env` is only a local-prod fallback.

## Environment

See `apps/aeo-auditor/.env.production.example` for the full list. Required for a
real run: the three LLM keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GEMINI_API_KEY`) and the Resend block (`RESEND_API_KEY`, `SMTP_FROM`, etc.).

`SMTP_FROM` must be on a domain verified in the Resend account, or email sends
fail with a domain error.

## Updating a live deploy

```bash
git pull
pnpm install --frozen-lockfile
pnpm --filter @gms/aeo-auditor build
pm2 restart aeo-auditor
```

## Notes

- The server keeps analysis state in memory. A restart drops in-flight audits;
  completed report files survive on disk under `apps/aeo-auditor/.aeo-data/`.
- The dev-only Vite proxy (`vite.config.ts`) is not used in production.
