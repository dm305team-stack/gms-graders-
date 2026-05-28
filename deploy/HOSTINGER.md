# Deploy — AEO Auditor on a Hostinger VPS

> **Using Docker?** See `deploy/HOSTINGER-DOCKER.md`. This file is the bare-metal
> path (Node + pm2 + nginx on plain Ubuntu).

The AEO Auditor is a single Express process. In production it serves both the
API and the built React frontend (landing at `/`, operator console at
`/console.html`) on one port, same-origin. No Vite, no proxy.

> **Shared hosting does not work.** Hostinger Web/Premium/Business cannot run
> this app: `server/pdf.ts` launches Playwright Chromium, which needs ~25 system
> libs installed via `apt`, and the server runs raw TypeScript through `tsx`.
> Use a **VPS (KVM)** with root access. KVM 2 (2 vCPU / 8 GB) is recommended for
> Chromium + four LLMs in parallel.

## What runs in production

- `apps/aeo-auditor/server/index.ts` — Express, run directly with `tsx`
  (no compile step for the server), bound to `0.0.0.0`.
- `apps/aeo-auditor/dist/` — the built frontend (`index.html` + `console.html`),
  produced by `pnpm build` and served statically when `NODE_ENV=production`.

The server resolves `@gms/llm` and `@gms/ui` through the pnpm workspace, so the
**whole monorepo** must be deployed (`apps/` + `packages/` + workspace files),
not just `apps/aeo-auditor`. The build needs devDeps (`vite`), so install with
`--frozen-lockfile` (full), never `--prod`.

Already prepared in the codebase: `0.0.0.0` bind, `tsx`/`express`/`playwright`/
`recharts` in `dependencies`, `packageManager: pnpm@9.15.4` pinned with
`engines.pnpm >=9 <11`, `ecosystem.config.cjs`, and `.env.production.example`.

---

## Runbook (run on the VPS)

Replace `scanaeo.com` with your domain throughout.

### 0. First SSH access

- hPanel → VPS → read the **public IP** and **root password** (or add an SSH key
  under hPanel → SSH Keys).
- From your machine: `ssh root@<IP>` (accept the fingerprint, enter the password).
- Recommended hardening: work as a sudo user instead of root.
  ```bash
  adduser deploy && usermod -aG sudo deploy
  rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # if you logged in with a key
  # otherwise paste your pubkey into /home/deploy/.ssh/authorized_keys
  ```
  Reconnect as `ssh deploy@<IP>` and run the rest as `deploy`.

### 1. Base stack

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git nginx ufw apache2-utils
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
sudo corepack enable && corepack prepare pnpm@9.15.4 --activate
sudo npm i -g pm2
```

### 2. Swap (insurance for Chromium; skip if RAM is comfortably ≥ 8 GB)

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Clone the private repo (read-only deploy key)

```bash
ssh-keygen -t ed25519 -C "vps-aeo-deploy" -f ~/.ssh/id_ed25519_deploy -N ""
cat ~/.ssh/id_ed25519_deploy.pub
```

- Paste that public key into GitHub → repo `dm305team-stack/gms-graders-` →
  Settings → **Deploy keys** → Add (leave write access off).
- Configure ssh and clone (note the repo name has a **trailing dash**):
  ```bash
  printf 'Host github.com\n  IdentityFile ~/.ssh/id_ed25519_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
  git clone git@github.com:dm305team-stack/gms-graders-.git ~/gms-graders
  cd ~/gms-graders
  ```

### 4. Install, build, Chromium, env

```bash
pnpm install --frozen-lockfile
pnpm --filter @gms/aeo-auditor build            # emits dist/index.html + dist/console.html
cd apps/aeo-auditor
npx playwright install --with-deps chromium      # Chromium + system libs (uses sudo internally)
cp .env.production.example .env
nano .env                                         # fill ANTHROPIC/OPENAI/GEMINI + Resend block
cd ~/gms-graders
```

`SMTP_FROM` must be on a domain verified in the Resend account, or email sends
fail with a domain error. Required keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GEMINI_API_KEY`, `RESEND_API_KEY` (+ the `SMTP_*` block). `ENABLE_PERPLEXITY`
stays `false` unless you also set `PERPLEXITY_API_KEY`.

### 5. Start under pm2

```bash
pm2 start ecosystem.config.cjs
pm2 logs aeo-auditor --lines 30                  # expect "listening on http://0.0.0.0:3334", pipeline REAL
curl -s http://127.0.0.1:3334/api/health          # {"status":"ok",...}
pm2 save && pm2 startup                            # run the line it prints (systemd; survives reboot)
```

`ecosystem.config.cjs` runs `npx tsx server/index.ts` from `apps/aeo-auditor`
with `NODE_ENV=production`, one instance, autorestart, 500M memory cap. (Bump
`max_memory_restart` to `768M` if you see memory restarts under load.)

### 6. nginx + basic auth for the console

```bash
sudo htpasswd -c /etc/nginx/.htpasswd operador     # set the console password
sudo cp deploy/nginx-aeo.conf /etc/nginx/sites-available/aeo
sudo nano /etc/nginx/sites-available/aeo           # set server_name to your domain
sudo ln -s /etc/nginx/sites-available/aeo /etc/nginx/sites-enabled/aeo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

`deploy/nginx-aeo.conf` keeps the landing and funnel open and gates
`/console.html`, `GET /api/analyses`, and `/api/analyses/<id>/data` behind basic
auth.

### 7. DNS (Hostinger hPanel)

- hPanel → Domains → `scanaeo.com` → DNS Zone → **A record** `@` → VPS IP
  (and `www` → VPS IP).
- Wait for propagation: `dig +short scanaeo.com` should return the VPS IP.

### 8. HTTPS (Let's Encrypt)

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d scanaeo.com -d www.scanaeo.com
```

certbot rewrites the nginx block to add the 443 server, the 80→443 redirect, and
automatic renewal.

### 9. Firewall

Critical: the Node process listens on `0.0.0.0:3334`, so without a firewall the
console is reachable at `http://<IP>:3334`, bypassing basic auth. UFW blocks that.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Updating a live deploy

```bash
cd ~/gms-graders && git pull
pnpm install --frozen-lockfile
pnpm --filter @gms/aeo-auditor build
pm2 restart aeo-auditor
```

## Verification

1. On the VPS: `curl -s http://127.0.0.1:3334/api/health` → `status:ok`,
   `mock_pipeline:false`.
2. `https://scanaeo.com/` → landing loads (no auth).
3. `https://scanaeo.com/console.html` → nginx prompts for user/password; after
   auth, the console loads with the audit list.
4. `http://<IP>:3334/` from outside → refused (UFW). Confirms basic auth can't be
   bypassed.
5. Run a real audit (form or `curl -X POST .../api/run-analysis`), wait for
   `done`, and confirm: it shows in the console, the PDF opens (Chromium works),
   and the email arrives (Resend/SMTP works).
6. `sudo reboot` → after reboot, `pm2 list` shows `aeo-auditor` online (confirms
   `pm2 startup`).

## Notes

- The server keeps analysis state in memory. A restart drops in-flight audits;
  completed reports and JSON sidecars survive on disk under
  `apps/aeo-auditor/.aeo-data/`.
- Express reads `process.env.PORT || process.env.AEO_API_PORT || 3334`. The
  nginx config proxies to `127.0.0.1:3334`; keep them aligned.
- The dev-only Vite proxy (`vite.config.ts`) is not used in production.
