> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md)

# Person A — Deployment & Infrastructure — Week 7

This file records Person A sessions for Week 7 deployment, infrastructure, hosting, and production-readiness work. Read only the relevant dated section after locating it from the matrix in `docs/MEMORY.md`.

## Sessions in this file

| Date | Session | Anchor |
|---|---|---|
| 2026-06-25 | Alibaba Cloud deployment report | [2026-06-25 — Alibaba Cloud deployment report](#2026-06-25--alibaba-cloud-deployment-report) |
| 2026-06-25 | Alibaba Cloud full-stack deployment runbook | [2026-06-25 — Alibaba Cloud full-stack deployment runbook](#2026-06-25--alibaba-cloud-full-stack-deployment-runbook) |
| 2026-06-25 | Alibaba Cloud DNS plan revision | [2026-06-25 — Alibaba Cloud DNS plan revision](#2026-06-25--alibaba-cloud-dns-plan-revision) |
| 2026-06-26 | Alibaba Cloud live ECS/RDS setup | [2026-06-26 — Alibaba Cloud live ECS/RDS setup](#2026-06-26--alibaba-cloud-live-ecsrds-setup) |

## 2026-06-25 — Alibaba Cloud deployment report

**User request.** The user asked for a deployment report for Sentura on Alibaba Cloud, covering OpenClaw Gateway, Sentura Dashboard, database, Docker, the existing `www.sentura.ai` domain currently attached to Render and managed through Squarespace, and the best SaaS pattern for separating admin and ordinary employee access.

**Research performed.**

- Checked local Sentura docs and architecture: `README.md`, `docs/HOSTING.md`, `docs/DESIGN.md §16`, `sentura/dashboard/README.md`, `sentura/dashboard/package.json`, `sentura/dashboard/next.config.ts`, and current DNS via `dig`.
- Verified `www.sentura.ai` currently resolves through `sentura-website-r35a.onrender.com`; apex `sentura.ai` points at Render IPv4 addresses; authoritative NS records are Google Domains/Squarespace-style `ns-cloud-b*.googledomains.com`.
- Web-checked Alibaba Cloud ECS, general-purpose instance families, ICP filing requirement, ALB WSS/WebSocket listener support, RDS HA/PITR and PostgreSQL HA edition, CloudMonitor, DNS records, Certificate Management Service, WAF, ECS backup to OSS, plus Squarespace DNS editing, Render custom domains, OpenClaw Docker/security/web docs, and Next.js self-hosting.

**Files changed.**

- Added `docs/ALIYUN-DEPLOYMENT.md`.
- Updated `docs/HOSTING.md` with a provider-specific link and revised Deployment Packaging to say OpenClaw infrastructure remains upstream-managed (`openclaw/scripts/docker/setup.sh` + `openclaw/docker-compose.yml` in the current checkout), not a custom Sentura Compose wrapper.
- Added `docs/ALIYUN-DEPLOYMENT.md` to the README Key Documentation table.
- Added a TeamPlan note under the cloud/on-prem deployment docs task; full all-provider/on-prem finalization remains open.
- Added A28 to `docs/TESTS.md` and `docs/tests/tests-person-a.md`.
- Added this memory entry and the matching matrix row.

**Key recommendations recorded.**

- Do not expose separate public ports for admin and ordinary employee experiences. Use HTTPS `443` with subdomains/routes plus RBAC: `app.sentura.ai` for employees, `admin.sentura.ai` for managers/admins, `ops.sentura.ai` or private `/control/` for OpenClaw operations, and keep `3000`, `18789`, and `5432` private.
- Keep `www.sentura.ai` on Render for the beta marketing site, and add `app`/`admin`/`ops` DNS records in Squarespace. If `www` must move, cut it over deliberately and retain the Render rollback CNAME.
- Use Alibaba Cloud Hong Kong or Singapore for immediate launch. Mainland China regions require ICP filing before resolving a public domain to Alibaba Cloud mainland servers.
- Start with one ECS app/Gateway host and RDS PostgreSQL for business/customer data. Preserve OpenClaw's stateful `~/.openclaw` workspace/memory/config on durable disk with snapshots and OSS backup; do not move OpenClaw state into RDS.
- Production beta sizing: 4 vCPU / 16 GiB for internal beta; 8 vCPU / 32 GiB for 30-50 active users or heavier browser automation; RDS PostgreSQL HA when real customer data is involved.
- Use ALB/WAF when public traffic or stricter perimeter controls are needed; Alibaba ALB supports WSS/WebSocket on HTTPS listeners.
- Product adjustments before real SaaS production: real OIDC/SAML/trusted-proxy auth, route middleware, secure cookies, Dashboard production env examples, optional Next standalone output, explicit Gateway `allowedOrigins`, disabled `allowInsecureAuth`, target-environment smoke and restore drill.

**Verification.**

- Documentation-only change. Manual A28 review checks added.
- Need final `git diff --check` after all edits.

## 2026-06-25 — Alibaba Cloud full-stack deployment runbook

**User request.** The user asked for a detailed Chinese deployment tutorial and method, with as much of the Sentura production ecosystem as possible kept inside Alibaba Cloud for better operational control.

**Research performed.**

- Reused the prior Alibaba deployment report and web-verified additional current Alibaba Cloud official docs for DNS Public Zone records and nameserver status, Squarespace nameserver changes, WAF 3.0 CNAME access, ALB listeners/server groups, ECS security groups and automatic snapshots, RDS PostgreSQL backups, ACR image push/pull, RAM least-privilege guidance, KMS Secrets Manager, IDaaS OIDC, Bastionhost, CloudMonitor, ICP filing, OpenClaw Docker/security docs, and Next.js self-hosting.
- Checked local repository state before writing the runbook: `sentura/dashboard` currently has no Dockerfile and `next.config.ts` does not enable `output: "standalone"`, so the runbook separates a source/systemd first deployment path from the future ACR/Docker image path.

**Files changed.**

- Added `docs/ALIYUN-FULL-STACK-RUNBOOK.md` with a Chinese step-by-step deployment tutorial.
- Updated `docs/HOSTING.md`, `README.md`, and `docs/ALIYUN-DEPLOYMENT.md` to link to the runbook.
- Added TeamPlan note under Person A deployment documentation.
- Added A29 to `docs/TESTS.md` and `docs/tests/tests-person-a.md`.
- Added this memory entry and the matching matrix row.

**Key content recorded.**

- Target Alibaba-first topology: Alibaba Cloud DNS -> WAF -> ALB -> private ECS reverse proxy -> Sentura Dashboard/OpenClaw Gateway, with RDS PostgreSQL, ACR, OSS, SLS, CloudMonitor, KMS, IDaaS, and Bastionhost.
- DNS migration plan: keep the domain registrar at Squarespace at first, add `sentura.ai` to Alibaba Cloud DNS, copy existing Render/email records, verify Alibaba-assigned nameservers, then switch nameservers in Squarespace. Registrar transfer remains optional and depends on `.ai` transfer support.
- Production network plan: ECS should ideally have no public IP; inbound traffic comes through WAF/ALB, outbound traffic goes through NAT Gateway, and security groups keep `3000`, `18789`, and `5432` private.
- Deployment path: OpenClaw uses upstream Docker assets and durable host-mounted config/workspace directories; Dashboard can run through systemd first, then move to ACR after adding standalone output and a Dockerfile.
- Required production adjustments: Dashboard Dockerfile/standalone output, `/api/health`, `.env.production.example`, OIDC/SAML login, hostname/route RBAC middleware, Gateway `allowedOrigins`, disabled insecure auth, trusted proxy validation, audit coverage, backup/restore scripts, and Alibaba smoke tests.

**Verification.**

- Documentation-only change. Manual A29 review checks added.
- Need final `git diff --check` after all edits.

## 2026-06-25 — Alibaba Cloud DNS plan revision

**User request.** The user changed the DNS decision: keep Squarespace as the DNS manager and only add `app` and `admin` prefixes pointing to Alibaba Cloud.

**Files changed.**

- Updated `docs/ALIYUN-FULL-STACK-RUNBOOK.md`: the target topology now uses Squarespace DNS, the DNS product row says Squarespace DNS, Section 4 now instructs operators to add only `app`/`admin` CNAME records in Squarespace, Section 13 is now the Squarespace DNS final-record section, the execution order no longer includes Alibaba Cloud DNS or nameserver switching, and common DNS mistakes focus on not touching `www`, apex, MX, or TXT records.
- Updated `docs/ALIYUN-DEPLOYMENT.md` with the current decision to keep Squarespace DNS and only add `app`/`admin` CNAME records.
- Updated README, TeamPlan, `docs/TESTS.md`, and `docs/tests/tests-person-a.md` so A29 tests now verify the Squarespace DNS add-record path instead of an Alibaba Cloud DNS migration.

**Current decision.**

- Do not migrate nameservers.
- Do not add `sentura.ai` to Alibaba Cloud DNS for this deployment pass.
- Do not alter `www.sentura.ai`, apex `sentura.ai`, MX, SPF/DKIM/DMARC, TXT, or existing Render/Squarespace records.
- Add `app.sentura.ai` and `admin.sentura.ai` as Squarespace CNAME records pointing to the Alibaba WAF CNAME, or temporarily to the ALB DNS name if WAF is not yet enabled.

**Verification.**

- Documentation-only change.
- Need final `git diff --check` after all edits.

## 2026-06-26 — Alibaba Cloud live ECS/RDS setup

**User request.** The user provided Alibaba Cloud ECS and RDS connection details and asked for help setting up the server and database. Secrets were used only for live setup and were not written to repo docs.

**Server setup completed.**

- Installed Ubuntu 24.04 runtime dependencies: Docker CE/Compose, Node.js 24, pnpm via Corepack, Nginx, PostgreSQL client, UFW, build tools, and supporting utilities.
- Created the `sentura` runtime user and `/srv/sentura/{app,secrets,backups,logs,openclaw-home}` directory layout with restrictive permissions for secrets and OpenClaw state.
- Added a 4 GiB swapfile because the ECS instance has only a 40 GiB root disk and no separate data disk yet.
- UFW is active and allows SSH, HTTP, and HTTPS. Application internals stay bound to localhost: Dashboard `127.0.0.1:3000`, OpenClaw `127.0.0.1:18789-18790`, and Teams sidecar `127.0.0.1:3978`.
- Recovered disk after OpenClaw image build by pruning Docker build cache; root disk ended at about 28 GiB free.

**Database setup completed.**

- Verified ECS-to-RDS private endpoint connectivity.
- Created low-privilege app roles/databases for Sentura business data and CBE Phase 2 data. Generated app-user passwords are stored only in `/srv/sentura/secrets/dashboard.env`.
- RDS reported PostgreSQL 18.3. The server did not accept SSL for the tested endpoint, so app DSNs use `sslmode=disable` over the private VPC endpoint until RDS SSL is explicitly enabled.
- Applied CBE Phase 2 migrations `001_initial_schema.sql` through `008_accio_manual_import_formats.sql`, seeded the tenant/users/admin/operator records, and verified `scripts/test-cross-border-phase2-store.ts --require-db` with 244/244 live store checks passing.

**Application setup completed.**

- Synced the committed repo tree to `/srv/sentura/app/Sentura-Platform` and installed dependencies with `pnpm install --frozen-lockfile`.
- Built `sentura/dashboard` successfully and installed `sentura-dashboard.service` with `next start -H 127.0.0.1 -p 3000`.
- Ran upstream OpenClaw Docker setup from `openclaw/scripts/docker/setup.sh`, built `openclaw:local`, and started `openclaw-openclaw-gateway-1` as a healthy container using upstream `openclaw/docker-compose.yml`.
- Configured Nginx for `app.sentura.ai` and `admin.sentura.ai` Host headers, proxying `/` to Dashboard and `/gateway/` to OpenClaw Gateway. Added forwarded-proto handling so an eventual WAF/ALB TLS terminator can pass `X-Forwarded-Proto: https`.
- Added Dashboard Gateway env keys for server and browser contexts. Browser public URL points at `wss://app.sentura.ai/gateway/`; token remains stored server-side in the env file but is compiled as `NEXT_PUBLIC_GATEWAY_TOKEN` per the current Dashboard client design.

**Verification.**

- `systemctl is-active sentura-dashboard nginx docker` returned active.
- `docker compose ps` showed `openclaw-openclaw-gateway-1` Up/healthy with host mappings on `127.0.0.1` only.
- `curl http://127.0.0.1:18789/healthz` returned `{"ok":true,"status":"live"}`.
- Nginx local Host-header checks returned `307` for `app.sentura.ai /` and `200` for `admin.sentura.ai /client-demos/cross-border/admin/login`.
- Nginx `/gateway/healthz` returned OpenClaw live status.
- RDS smoke query against the CBE database returned the seeded tenant count.

**Open blockers / go-live notes.**

- Public `<ECS_PUBLIC_IP>:80` timed out from local and from the server's public self-check even though Nginx and UFW are open; likely Alibaba Cloud security group, ALB, or WAF ingress still needs to be configured. DNS should not be switched until this is resolved.
- The current Sentura browser Gateway client does not implement OpenClaw browser device identity. Remote browser WebSocket handshakes from `app.sentura.ai`/`admin.sentura.ai` are rejected with `control ui requires device identity`. I did not enable `gateway.controlUi.dangerouslyDisableDeviceAuth`; that requires an explicit security decision or a proper IDaaS/OIDC/trusted-proxy/device-identity implementation.
- No LLM provider key was configured during this setup. Gateway is live, but real agent runs still need provider credentials in OpenClaw's secret/env path.
- The ECS has only a 40 GiB root disk. For beta it is usable after cache pruning, but production should attach and mount a 100-200 GiB data disk at `/srv/sentura` or move OpenClaw state/backups there.
- Rotate the supplied root/RDS bootstrap passwords after setup and prefer SSH key/RAM/Bastionhost access.
