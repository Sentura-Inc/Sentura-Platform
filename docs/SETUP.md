# Sentura Platform — Setup Guide

## Prerequisites

| Tool | Version | Check | Required? |
|------|---------|-------|-----------|
| Node.js | 22.16+ (Node 24 recommended) | `node --version` | Yes |
| pnpm | 10.33+ | `pnpm --version` | Yes |
| Docker | any recent version | `docker --version` | Recommended (see note) |

> OpenClaw `2026.4.19-beta.2` declares `"engines": { "node": ">=22.14.0" }` and its README recommends Node 24. The `@openclaw/plugin-sdk` is shipped as a workspace package, so pnpm 10.33+ is needed for correct workspace resolution.

> **Docker for meta-agent sandboxes.** The Sentura meta-agents (Creator/Forge, Tuner/Refine, Orchestrator/Conductor, MCP Builder/Socket) are configured with `sandbox.mode: "non-main"`, which runs the agent in a Docker container for isolation. Without Docker on PATH, dashboard chat with any meta-agent fails with:
>
> ```
> Sandbox mode requires Docker, but the "docker" command was not found in PATH.
> ```
>
> Two ways to proceed:
>
> 1. **Install Docker** (`brew install --cask docker` on macOS, or Docker Desktop) — this matches the team's production path and is required to exercise the sandbox tool-policy double filter (see `docs/OPENCLAW.md` § Sandbox tool-policy filter), including reproducing the team's 2026-04-20 `billing-support-rep` 80-second E2E deployment.
> 2. **Disable sandbox for local dev only** — edit `~/.openclaw/openclaw.json` and set `sandbox.mode: "off"` on every meta-agent in `agents.list`. Forge will deploy and chat normally, but Phase 5 smoke tests that need `sessions_spawn` with an `agentId` will be blocked (acceptable for dashboard-only work; not acceptable for CI or demo rehearsals).

> **macOS note on paths with spaces:** if your project path contains a space (e.g. `~/Agent Factory/Sentura/`), the `@discordjs/opus` native module will fail to compile during `pnpm install` — its build script doesn't quote paths correctly. `pnpm install` continues past the error; only the Discord voice channel binding is affected. Core Sentura features (dashboard, Creator/Tuner/Orchestrator meta-agents, gateway, MCP tools) all work fine. For full Discord voice support, clone into a space-free path like `~/sentura/`.

### Installing prerequisites by platform

**macOS:**
```bash
brew install node
npm install -g pnpm   # or: corepack enable
```

**Linux (Ubuntu/Debian):**
```bash
# Node.js 24 via NodeSource (or 22.x if you need LTS)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm   # or: corepack enable
```

**Windows (PowerShell):**
```powershell
# Via winget (preferred)
winget install OpenJS.NodeJS.LTS
npm install -g pnpm   # or: corepack enable

# Or download from https://nodejs.org/
```

**Windows (WSL2) — recommended for Windows users:**
```bash
# Inside WSL2 (Ubuntu), follow the Linux instructions above
wsl --install   # if WSL2 is not yet installed (requires reboot)
```

---

## Cleanup (if you previously installed OpenClaw)

If you used OpenClaw standalone before switching to Sentura — via `sudo npm install -g openclaw@latest` following OpenClaw's own install guide, or by installing the OpenClaw macOS app — you likely have a global `openclaw` binary on PATH and/or a LaunchAgent auto-starting an older `openclaw-gateway`. Both will conflict with the locally-built `openclaw` in this repo:

- Version-mismatch warnings in `sentura-setup.sh` output (config written by the newer local build, CLI is the older global one)
- Port 18789 race between the LaunchAgent gateway and `pnpm gateway:watch`
- Unexpected stderr output from `openclaw gateway status` can appear in setup-script eval contexts

Clean up before building the local source:

**macOS:**
```bash
# Stop and disable the LaunchAgent (OpenClaw macOS app installs this)
launchctl unload -w ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>/dev/null

# Kill any running gateway
pkill -f openclaw-gateway

# Uninstall the global CLI
npm uninstall -g openclaw

# Confirm cleanup
which openclaw    # should print "openclaw not found"
lsof -i :18789    # should be empty
```

**Linux / WSL2:** same `npm uninstall -g openclaw` + `pkill -f openclaw-gateway`. No LaunchAgent equivalent on these platforms.

After the local OpenClaw source builds successfully (next section), expose it on PATH as the global `openclaw` so `scripts/sentura-setup.sh` picks up the matching version:

```bash
cd openclaw && npm link
openclaw --version    # should match openclaw/package.json (2026.4.19-beta.2)
```

---

## OpenClaw Setup (from source)

The OpenClaw source is included in the `openclaw/` directory. Build and run it locally — no Docker needed.

These commands work on **macOS, Linux, and WSL2**:

```bash
cd openclaw

pnpm install
pnpm ui:build                                    # auto-installs UI deps on first run
OPENCLAW_A2UI_SKIP_MISSING=1 pnpm build          # skip A2UI bundle (see note below)

pnpm openclaw onboard
```

> **Note on `OPENCLAW_A2UI_SKIP_MISSING=1`:** the `canvas:a2ui:bundle` build step requires Google's A2UI closed-source bundle, which isn't included in this distribution's `openclaw/vendor/a2ui/`. The env var is the officially-supported skip path (see `openclaw/scripts/bundle-a2ui.mjs`). A2UI powers the optional Canvas agent-to-agent UI — it's not needed for Sentura core (dashboard, meta-agents, MCP tools, gateway all work without it). If you have access to A2UI sources, drop the env var and the bundle will build normally.

**Windows (native PowerShell):**
```powershell
cd openclaw

pnpm install
pnpm ui:build
pnpm build

pnpm openclaw onboard
```

Follow the prompts to choose your LLM provider, enter your API key, and set the gateway URL to `http://localhost:18789`. After onboarding, start the gateway:

```bash
cd openclaw
pnpm gateway:watch     # auto-reload on source/config changes
```

### Re-place the Sentura vitest config (after every fresh `openclaw/` pull)

The Sentura extension vitest config lives inside OpenClaw's own test infra so it can import `sharedVitestConfig` via a clean relative path (matching the convention used by `vitest.extension-*.config.ts`). Because `openclaw/` is re-pulled periodically (the whole tree is wiped and replaced), a pristine backup is kept in `scripts/`. Re-place it after each pull:

```bash
cp scripts/vitest.sentura.config.ts openclaw/test/vitest/vitest.sentura.config.ts
```

You only need this if you will run the Sentura extension test suite (`cd openclaw && npx vitest run --config test/vitest/vitest.sentura.config.ts`). See `docs/TESTS.md` for the full test commands.

### API Keys

API keys are stored in the OpenClaw state directory:

| Platform | Path |
|----------|------|
| macOS / Linux / WSL2 | `~/.openclaw/.env` |
| Windows (native) | `%USERPROFILE%\.openclaw\.env` |

```bash
# ~/.openclaw/.env  (or %USERPROFILE%\.openclaw\.env on Windows)
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

### Local LLM (Ollama)

**macOS:**
```bash
brew install ollama && ollama serve
ollama pull llama3.3:70b
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
ollama pull llama3.3:70b
```

**Windows:**
Download from https://ollama.com/download/windows, then:
```powershell
ollama serve
ollama pull llama3.3:70b
```

Then add to your `.env`:
```bash
OLLAMA_BASE_URL=http://localhost:11434
```

Re-run onboard to select the local provider: `cd openclaw && pnpm openclaw onboard`

---

## Sentura Setup

After OpenClaw is onboarded and the gateway starts successfully, register Sentura's meta-agents.

**macOS / Linux / WSL2:**
```bash
# From the project root (Sentura-Platform/)
./scripts/sentura-setup.sh
```

**Windows (PowerShell):**
```powershell
# From the project root (Sentura-Platform\)
powershell -ExecutionPolicy Bypass -File scripts\sentura-setup.ps1
```

Both scripts perform the same steps:
1. Detect platform and verify prerequisites (Node.js 22.16+/24, pnpm, OpenClaw config)
2. Copy meta-agent workspace files (Creator, Tuner, Orchestrator) to the OpenClaw workspace
3. Register each meta-agent with the OpenClaw gateway via the CLI
4. Apply tool permissions (Creator gets `gateway` access, etc.)
5. Configure the gateway for dashboard access
6. Install the `sentura-bootstrap` hook — this injects per-user memory (`memory/users/MEMORY_USER_{token}.md`) into the system prompt for sessions bound to a user token. Hard Rules and Enterprise Context are **not** hook-injected; they live natively inside `AGENTS.md` and `BOOTSTRAP.md`, which the runtime already loads at top priority.
7. **Seed the first platform admin** (see below) — writes a `platform_admin` user into `sentura-rbac` so agents created after setup are no longer in RBAC bootstrap mode.
8. **Wire the dashboard `.env.local`** — injects the seeded admin's `userToken` as `NEXT_PUBLIC_SENTURA_ADMIN_TOKEN` so the dashboard acts as the admin on RBAC-guarded RPCs without any manual step.
9. **Mark each meta-agent workspace as bootstrap-complete** (see "Meta-agent bootstrap convention" below) — stamps `setupCompletedAt` into `<workspace>/.openclaw/workspace-state.json` for `creator`, `tuner`, and `orchestrator` so OpenClaw stops treating the workspaces as `[Bootstrap pending]` and stops forcing non-primary runs (dashboard-spawned sessions) into "limited" mode. This is required because Sentura keeps `BOOTSTRAP.md` permanently as the Enterprise Context file, while OpenClaw's default convention is to delete `BOOTSTRAP.md` once setup is done.

Both scripts are idempotent — safe to re-run if agents are added later.

### Platform admin bootstrap (auto-seeded, no `curl` required)

The Sentura RBAC layer requires a `platform_admin` before agents can be created outside of bootstrap mode. Both setup scripts seed this admin **for you** — the customer never has to run `curl` against the gateway or write code.

**Behaviour on first run:**

- Writes a new admin record to `~/.openclaw/sentura-rbac/users.json` (or `%USERPROFILE%\.openclaw\sentura-rbac\users.json` on Windows) with:
  - `role: "platform_admin"`
  - a freshly generated user id (`user-admin-<hex>`)
  - a freshly generated `userToken` (UUIDv4)
- Writes / updates `sentura/dashboard/.env.local` with:
  - `NEXT_PUBLIC_SENTURA_ADMIN_USER_ID=<id>`
  - `NEXT_PUBLIC_SENTURA_ADMIN_TOKEN=<token>`

**Behaviour on re-run:**

- If *any* user with `role: "platform_admin"` already exists in `users.json`, the seed step is skipped entirely. The existing id/token are re-used when re-wiring the dashboard `.env.local`, so re-running the setup script never creates a duplicate admin and never rotates the token unintentionally.

**Providing the admin's name/email:**

| Mode | How to supply |
|------|----------------|
| Interactive (default on a TTY) | The script prompts for `Admin full name` and `Admin email`. Press Enter to accept the defaults (`Platform Admin`, `admin@sentura.local`). |
| Non-interactive (CI, unattended) | Set env vars before running the script: `SENTURA_ADMIN_NAME="Ada Lovelace" SENTURA_ADMIN_EMAIL="ada@acme.com" ./scripts/sentura-setup.sh`. Set `SENTURA_ADMIN_NONINTERACTIVE=1` to skip prompts even on a TTY. |

**Rotating the admin `userToken`:**

If you need to issue a fresh `userToken` (for example, if `.env.local` was leaked), delete the admin record and re-run:

```bash
# macOS / Linux / WSL2
node -e 'const fs=require("fs"),p=require("os").homedir()+"/.openclaw/sentura-rbac/users.json";const u=JSON.parse(fs.readFileSync(p,"utf8"));fs.writeFileSync(p,JSON.stringify(u.filter(x=>x.role!=="platform_admin"),null,2));'
./scripts/sentura-setup.sh
```

```powershell
# Windows (PowerShell)
$p = "$env:USERPROFILE\.openclaw\sentura-rbac\users.json"
$u = Get-Content $p -Raw | ConvertFrom-Json
@($u | Where-Object { $_.role -ne 'platform_admin' }) | ConvertTo-Json -Depth 10 | Set-Content $p -Encoding UTF8
powershell -ExecutionPolicy Bypass -File scripts\sentura-setup.ps1
```

The script will seed a new admin (optionally with the same email via env vars) and re-wire `.env.local` with the new token.

**Why file-based seeding (no gateway call)?**

The `sentura-rbac` extension persists users as plain JSON (`~/.openclaw/sentura-rbac/users.json`). Writing the admin record directly lets the setup run without a live gateway connection, without a pre-existing admin token, and without the customer ever seeing a `curl` invocation. The `sentura.rbac.users.upsert` gateway RPC is still used once the dashboard is running — but only to manage *additional* users (department admins, employee owners, auditors) through the UI.

| Platform | State directory | Script |
|----------|----------------|--------|
| macOS | `~/.openclaw/` | `scripts/sentura-setup.sh` |
| Linux | `~/.openclaw/` | `scripts/sentura-setup.sh` |
| WSL2 | `~/.openclaw/` (inside WSL) | `scripts/sentura-setup.sh` |
| Windows (native) | `%USERPROFILE%\.openclaw\` | `scripts/sentura-setup.ps1` |

After setup, restart the gateway:

```bash
cd openclaw && pnpm gateway:watch
```

The Creator Agent ("Forge") will be available in the webchat UI. Send it a message to create your first AI employee.

### Meta-agent bootstrap convention (why `setupCompletedAt` is stamped)

OpenClaw has a per-workspace "bootstrap pending" state defined in `openclaw/src/agents/workspace.ts` (`resolveWorkspaceBootstrapStatus`). The rule is:

> A workspace is **complete** if `.openclaw/workspace-state.json` contains a non-empty `setupCompletedAt` string, **or** if `BOOTSTRAP.md` does not exist. Otherwise it is **pending**.

While a workspace is pending:

- The runtime injects a `[Bootstrap pending]` prefix into every turn's user prompt.
- For non-primary runs (e.g. sessions spawned from the dashboard rather than from `openclaw chat` / the primary CLI), OpenClaw forces the agent into **limited mode**. In limited mode Forge will refuse to actually deploy a new AI employee and will say things like *"This run is still bootstrap-pending, so I should not claim the creator workspace is fully initialized or do the actual deployment from here."*

The OpenClaw-native way to exit this state is to have the agent delete `BOOTSTRAP.md` on its first run. **Sentura deliberately does not do that.** Every Sentura meta-agent and employee keeps `BOOTSTRAP.md` permanently because it hosts the top-level `## Enterprise Context` section — org structure, key systems, MCP inventory, data-classification tiers (T0–T4), approval policies. This is one of the eight native OpenClaw workspace files (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) and deleting it would also delete the enterprise context.

To reconcile, `sentura-setup.sh` / `sentura-setup.ps1` takes the alternative path: after all the other setup steps succeed, the script stamps `setupCompletedAt` into `<workspace>/.openclaw/workspace-state.json` for each meta-agent (`creator`, `tuner`, `orchestrator`). OpenClaw now considers those workspaces complete, so Forge runs in full primary-session capability — while `BOOTSTRAP.md` stays on disk as the Enterprise Context document.

**Behaviour on re-run:** if `setupCompletedAt` is already set, the original timestamp is preserved (no churn, no rotation). If the file is missing, malformed, or has no `setupCompletedAt`, a fresh ISO-8601 timestamp is written.

**When to re-stamp manually:** almost never. If you explicitly want the agent to be treated as pending again (e.g. debugging the limited-mode behavior), delete the `setupCompletedAt` field from the state file and re-run the setup script — it will stamp a new one.

**Does this apply to user-created employees too?** No. The Creator Agent (Forge) deploys employees with their own workspace directory under `~/.openclaw/workspace/<employee-id>/`. Whether those employees are bootstrap-pending or not is part of Forge's deployment flow (currently: Forge generates the employee's workspace files, registers the agent via the gateway, and then the employee's workspace follows the normal OpenClaw convention). The `setupCompletedAt` stamp applies only to Sentura's three meta-agents, which are set up once per customer installation.

---

## Sentura Layer

Sentura is the enterprise management layer built on top of the running OpenClaw instance. OpenClaw provides the runtime (gateway, channels, providers, tools, memory, config). Sentura builds everything an enterprise needs that OpenClaw does not have:

### What Sentura Adds

| Capability | Component | Status |
|-----------|-----------|--------|
| **No-code employee creation** | Creator Agent (`sentura/agents/creator/`) | In progress |
| **NL configuration** | Tuner Agent (`sentura/agents/tuner/`) | Planned |
| **Multi-agent orchestration** | Orchestrator Agent (`sentura/agents/orchestrator/`) | Planned |
| **Enterprise MCP generation** | Build/wire internal API tools for employees | Planned |
| **Position-specific guardrails** | `## Hard Rules` section inside each employee's `AGENTS.md`, decision-context approvals | Planned |
| **Self-provisioning pipeline** | Skills + approval + error handling for service registration | Planned |
| **Multi-tenancy** | Tenant isolation, department namespacing | Planned |
| **Enterprise SSO** | SAML/OIDC integration for dashboard | Planned |
| **Cost management** | Per-employee, per-department LLM spend tracking | Planned |
| **Knowledge ingestion** | Documents → SKILL.md distribution | Planned |
| **Employee lifecycle** | Versioning, cloning, health scoring, rollback | Planned |
| **Pre-deployment testing** | Test employees against real/mock tasks before going live, auto-tune on failure | Planned |
| **Admin Dashboard** | Next.js app with RBAC, approvals, monitoring | Scaffolded (Week 1) |
| **Enterprise extensions** | sentura-approval, sentura-audit, sentura-rbac, sentura-provisioner | Planned |

### Development (once OpenClaw is running)

```bash
# Dashboard (when built)
pnpm dev:dashboard

# Run tests
pnpm test
```

### Sandbox tool-policy filter

**Why this matters.** The Sentura meta-agents (Forge, Refine, Conductor, Socket) run inside OpenClaw's `non-main` sandbox. That sandbox applies a **second** tool-policy filter *after* the agent-level `tools.allow`/`tools.alsoAllow` step (source: `openclaw/src/agents/sandbox/tool-policy.ts`, constants in `openclaw/src/agents/sandbox/constants.ts`). Its hardcoded `DEFAULT_TOOL_ALLOW` only covers `exec`, `read`, `write`, `edit`, `apply_patch`, `process`, `image`, `sessions_*`, `session_status`, and `subagents`; its `DEFAULT_TOOL_DENY` blocks `gateway`, `browser`, `canvas`, `cron`, `nodes`, and every channel id. Any plugin tool (`sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`, `memory_search`, `memory_get`, `update_plan`, `web_fetch`, `web_search`, `pdf`, `image_generate`, `video_generate`) is silently stripped at the sandbox stage unless it is explicitly re-added under `tools.sandbox.tools.alsoAllow`.

**Where this bites.** The CLI entry point (`openclaw agent --agent creator`) resolves tools *before* the sandbox filter, so CLI sessions see the full 21-tool toolset. The **dashboard webchat** (`chat.send` RPC) and any other embedded-runner session go through the sandbox filter, so they see only ~7 tools unless the sandbox allowlist is set. Round 20 (2026-04-19) traced a full-day deploy outage — Forge reporting "I don't have `sentura_agents_manage` in this session" from the dashboard only — to this exact divergence.

**How setup fixes it.** `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` both write `tools.sandbox.tools.alsoAllow` into `~/.openclaw/openclaw.json` for all four meta-agents:

| Agent | Sandbox `alsoAllow` (count) | Key plugin tools re-surfaced |
|-------|----------------------------:|------------------------------|
| `creator` (Forge) | 16 | `sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`, `gateway`, `browser`, `pdf`, `canvas`, `cron`, `memory_*`, `update_plan`, `image_generate`, `video_generate`, `web_fetch`, `web_search`, `sessions_send` |
| `tuner` (Refine) | 13 | `sentura_*`, `gateway`, `memory_*`, `update_plan`, `pdf`, `canvas`, `cron`, `web_fetch`, `web_search`, `sessions_send` |
| `orchestrator` (Conductor) | 9 | `sessions_send`, `sessions_spawn`, `subagents`, `memory_*`, `update_plan`, `cron`, `web_fetch`, `web_search` |
| `mcp-builder` (Socket) | 11 | `gateway`, `browser`, `pdf`, `canvas`, `memory_*`, `update_plan`, `cron`, `web_fetch`, `web_search`, `sessions_send` |

Channel-like entries (`gateway`, `browser`, `canvas`, `pdf`, `cron`) are also automatically removed from the sandbox `DEFAULT_TOOL_DENY` list by `filterDefaultDenyForExplicitAllows` once they appear in `alsoAllow` — no extra deny-list edit is required.

**Verifying the fix on your machine.**

```bash
node -e "const c=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.openclaw/openclaw.json','utf8'));for(const a of c.agents.list.filter(x=>['creator','tuner','orchestrator','mcp-builder'].includes(x.id))){console.log(a.id, a.tools?.sandbox?.tools?.alsoAllow?.length||0)}"
# Expected: creator 16, tuner 13, orchestrator 9, mcp-builder 11
```

If any row reports `0`, re-run `bash scripts/sentura-setup.sh` (or `.ps1` on Windows). The setup script is idempotent — it will only patch the missing keys and preserve existing customizations.

**When adding a NEW meta-agent.** Any agent you add under `sentura/agents/<id>/config.json5` with `sandbox: { mode: "non-main" }` MUST also set `tools.sandbox.tools.alsoAllow` listing every plugin tool the agent will invoke. Mirror the same list into both setup scripts' override blocks. The runtime failure mode for forgetting this is silent: the tool just disappears from the model's visible toolset in dashboard sessions.

**Further reading.** `docs/OPENCLAW.md` § "Sandbox tool-policy filter" documents the two-layer pipeline in detail. `docs/DESIGN.md` § "Sandbox runtime" lists the CLI-vs-dashboard divergence.

---

### Key Directories

- `sentura/agents/` — Meta-agents (Creator, Tuner, Orchestrator, MCP Builder) with their workspace files
- `sentura/dashboard/` — Next.js admin dashboard
- `sentura/extensions/` — OpenClaw extensions for enterprise features (approval, audit, RBAC)
- `sentura/skills/` — Bundled skills (self-provisioning, knowledge curation, compliance)
- `sentura/config/` — Default configs, templates, and policies
- `workspaces/` — Git-tracked reference employee workspaces (runtime workspaces live in `~/.openclaw/workspace/`)
- `scripts/` — Setup and utility scripts (including `sentura-setup.sh`)
- `ekg/` — GradSale enterprise documentation (test enterprise for integration features)

---

## Verification

- [ ] `curl http://localhost:18789/healthz` returns OK
- [ ] Control UI loads and connects
- [ ] Chat produces an LLM response

---

## Troubleshooting

### Gateway logs

**macOS / Linux / WSL2:**
```bash
ls ~/.openclaw/logs/
cd openclaw && pnpm openclaw doctor
```

**Windows (PowerShell):**
```powershell
Get-ChildItem "$env:USERPROFILE\.openclaw\logs\"
cd openclaw; pnpm openclaw doctor
```

### Fresh restart

**macOS / Linux / WSL2:**
```bash
rm -rf ~/.openclaw
cd openclaw && pnpm openclaw onboard
```

**Windows (PowerShell):**
```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.openclaw"
cd openclaw; pnpm openclaw onboard
```

### Control UI auth issues

Use the `#token=` URL from the onboard output, or try an incognito window.

### Windows-specific issues

- **Execution policy errors**: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` before running the setup script
- **Long path errors**: Enable long paths: `New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force` (requires admin)
- **WSL2 recommended**: For the smoothest experience on Windows, use WSL2 (`wsl --install`) and follow the Linux instructions inside it
