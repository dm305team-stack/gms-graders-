# Deploy — AEO Auditor on a Hostinger VPS with Docker

This is the **Docker** path. The image is built **on the VPS** from the cloned
private repo (so nothing private leaves GitHub and Chromium comes baked into the
Playwright base image). The host runs nginx for TLS + the gated console.

> Hostinger's "paste a docker-compose.yml URL/content" wizard does **not** work
> for this app: it has no published image, and a `build:` from a private repo
> can't clone without credentials. Ignore that box. Provision a VPS that gives
> you **Docker + SSH**, then follow the steps below in the VPS shell.

Files used: `Dockerfile`, `docker-compose.yml`, `.dockerignore` (repo root) and
`deploy/nginx-aeo.conf`. Replace `scanaeo.com` with your domain throughout.

---

## 0. SSH access
- hPanel → VPS → read the **public IP** and **root password** (or add your SSH
  key under hPanel → SSH Keys).
- `ssh root@<IP>` (accept fingerprint, enter password). Optional hardening:
  create a sudo `deploy` user and work as that user.

## 1. Docker + host tooling
Hostinger's Docker template usually has Docker preinstalled (`docker --version`).
If not, install Docker Engine + Compose plugin, then the host proxy tools:
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo apt update && sudo apt -y install git nginx ufw apache2-utils
```

## 2. Clone the private repo (read-only deploy key, feature branch)
```bash
ssh-keygen -t ed25519 -C "vps-aeo-deploy" -f ~/.ssh/id_ed25519_deploy -N ""
cat ~/.ssh/id_ed25519_deploy.pub
```
- Paste that pubkey into GitHub → repo `dm305team-stack/gms-graders-` → Settings
  → **Deploy keys** → Add (read-only).
- Clone the **feature branch** (note the trailing dash in the repo name):
  ```bash
  printf 'Host github.com\n  IdentityFile ~/.ssh/id_ed25519_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
  git clone -b feature/aeo-pdf-report git@github.com:dm305team-stack/gms-graders-.git ~/gms-graders
  cd ~/gms-graders
  ```

## 3. Environment
```bash
cp apps/aeo-auditor/.env.production.example apps/aeo-auditor/.env
nano apps/aeo-auditor/.env     # fill ANTHROPIC/OPENAI/GEMINI + Resend block
```
`SMTP_FROM` must be on a domain verified in Resend, or email sends fail.
`ENABLE_PERPLEXITY` stays `false` unless you also set `PERPLEXITY_API_KEY`.
(Leave `NODE_ENV`/`PORT`; compose sets them.)

## 4. Build and run the container
```bash
docker compose up -d --build           # first build pulls the Playwright base, ~few min
docker compose logs -f aeo-auditor      # expect "listening on http://0.0.0.0:3334", pipeline REAL
curl -s http://127.0.0.1:3334/api/health # {"status":"ok",...}
docker compose ps                        # STATUS should turn healthy
```
The container restarts automatically (`restart: unless-stopped`) and on reboot
(Docker service is enabled by default). Reports/sidecars persist in the
`aeo-data` named volume.

## 5. nginx + basic auth for the console (on the host)
```bash
sudo htpasswd -c /etc/nginx/.htpasswd operador
sudo cp deploy/nginx-aeo.conf /etc/nginx/sites-available/aeo
sudo nano /etc/nginx/sites-available/aeo          # set server_name to your domain
sudo ln -s /etc/nginx/sites-available/aeo /etc/nginx/sites-enabled/aeo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
nginx proxies to `127.0.0.1:3334` (the container), keeps the landing/funnel open,
and gates `/console.html`, `GET /api/analyses`, and `/api/analyses/<id>/data`.

## 6. DNS (Hostinger hPanel)
- hPanel → Domains → `scanaeo.com` → DNS Zone → **A record** `@` → VPS IP (and
  `www` → VPS IP). Verify: `dig +short scanaeo.com` returns the VPS IP.

## 7. HTTPS
```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d scanaeo.com -d www.scanaeo.com
```

## 8. Firewall
The container publishes only on `127.0.0.1:3334`, so it isn't directly exposed.
Still lock the host down:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Updating a live deploy
```bash
cd ~/gms-graders && git pull
docker compose up -d --build
```

## Verification
1. On the VPS: `curl -s http://127.0.0.1:3334/api/health` → `status:ok`, `mock_pipeline:false`.
2. `https://scanaeo.com/` → landing loads (no auth).
3. `https://scanaeo.com/console.html` → basic-auth prompt; after auth, console loads.
4. Run a real audit, wait for `done`: it shows in the console, the PDF opens
   (Chromium works in the container), and the email arrives (Resend/SMTP).
5. `docker compose ps` shows `healthy`; `sudo reboot` then `docker compose ps`
   shows it back up.

## Notes
- Analysis state is in memory; a container restart drops in-flight audits.
  Completed reports + JSON sidecars survive in the `aeo-data` volume.
- The non-Docker path (Node + pm2 + nginx on bare Ubuntu) is in
  `deploy/HOSTINGER.md` if you ever want it instead.
