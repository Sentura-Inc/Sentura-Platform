# Sentura Platform — Setup Guide

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 22.14+ | `node --version` |
| pnpm | 10+ | `pnpm --version` |

### Installing prerequisites by platform

**macOS:**
```bash
brew install node
npm install -g pnpm   # or: corepack enable
```

**Linux (Ubuntu/Debian):**
```bash
# Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
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

## OpenClaw Setup (from source)

The OpenClaw source is included in the `openclaw/` directory. Build and run it locally — no Docker needed.

These commands work on **macOS, Linux, and WSL2**:

```bash
cd openclaw

pnpm install
pnpm ui:build          # auto-installs UI deps on first run
pnpm build

pnpm openclaw onboard
```

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
1. Detect platform and verify prerequisites (Node.js 22+, OpenClaw config)
2. Copy meta-agent workspace files (Creator, Tuner, Orchestrator) to the OpenClaw workspace
3. Register each meta-agent with the OpenClaw gateway via the CLI
4. Apply tool permissions (Creator gets `gateway` access, etc.)
5. Configure the gateway for dashboard access
6. Install the `sentura-bootstrap` hook — this injects per-user memory (`memory/users/MEMORY_USER_{token}.md`) into the system prompt for sessions bound to a user token. Hard Rules and Enterprise Context are **not** hook-injected; they live natively inside `AGENTS.md` and `BOOTSTRAP.md`, which the runtime already loads at top priority.

Both scripts are idempotent — safe to re-run if agents are added later.

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

### Key Directories

- `sentura/agents/` — Meta-agents (Creator, Tuner, Orchestrator) with their workspace files
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
