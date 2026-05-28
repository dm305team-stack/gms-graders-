# AEO Visibility Auditor — production image.
#
# Base: Playwright's official image ships Chromium + all ~25 system libs + Node,
# so PDF rendering (apps/aeo-auditor/server/pdf.ts) works with no apt dance.
# The tag MUST match the `playwright` npm version in
# apps/aeo-auditor/package.json (^1.60.0), or the browser revision won't match.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# Use the browsers already baked into the base image; do not re-download them
# during `pnpm install` (the playwright npm package would otherwise try).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# pnpm via corepack, pinned to the repo's packageManager.
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy the whole monorepo: the server resolves @gms/llm and @gms/ui from the
# pnpm workspace, the frontend build needs devDeps (vite), and Stage D reads
# aeo-research/ at runtime. .dockerignore keeps node_modules, dist, .env, .git out.
COPY . .

# Install all workspace deps (NODE_ENV unset here, so devDeps install) and build
# the frontend (dist/ with index.html + console.html).
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @gms/aeo-auditor build

# Runtime config.
ENV NODE_ENV=production
WORKDIR /app/apps/aeo-auditor
EXPOSE 3334

# Run the Express server directly with tsx (no compile step for the server).
CMD ["pnpm", "exec", "tsx", "server/index.ts"]
