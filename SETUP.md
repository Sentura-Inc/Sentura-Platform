# Sentura Platform — Setup Guide

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 22.14+ | `node --version` |
| pnpm | 10+ | `pnpm --version` |

Install Node.js: https://nodejs.org/ (or `brew install node` on macOS)
Install pnpm: `npm install -g pnpm` (or `corepack enable`)

---

## OpenClaw Setup (from source)

The OpenClaw source is included in the `openclaw/` directory. Build and run it locally — no Docker needed.

```bash
cd openclaw

pnpm install
pnpm ui:build          # auto-installs UI deps on first run
pnpm build

pnpm openclaw onboard
```

Follow the prompts to choose your LLM provider, enter your API key, and set the gateway URL to `http://localhost:18789`. After onboarding, start the gateway:

```bash
cd openclaw
pnpm gateway:watch     # auto-reload on source/config changes
```

### API Keys

API keys are stored in `~/.openclaw/.env`. You can edit this file directly:

```bash
# ~/.openclaw/.env
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

### Local LLM (Ollama)

```bash
# Install Ollama
brew install ollama && ollama serve
ollama pull llama3.3:70b

# Add to ~/.openclaw/.env
OLLAMA_BASE_URL=http://localhost:11434

# Re-run onboard to select local provider
cd openclaw && pnpm openclaw onboard
```

---

## Sentura Setup

After OpenClaw is onboarded and the gateway starts successfully, register Sentura's meta-agents:

```bash
# From the project root (Sentura-Platform/)
./scripts/sentura-setup.sh
```

This script:
1. Verifies OpenClaw is onboarded (`~/.openclaw/openclaw.json` exists)
2. Copies meta-agent workspace files (Creator, Tuner, Orchestrator) to `~/.openclaw/workspace/`
3. Registers each meta-agent with the OpenClaw gateway via the CLI
4. Applies tool permissions (Creator gets `gateway` access, etc.)
5. Installs the `sentura-bootstrap` hook at `~/.openclaw/hooks/sentura-bootstrap/` and enables it — this hook injects RULES.md and CONTEXT.md into every agent's system prompt

The script is idempotent — safe to re-run if agents are added later.

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
| **Position-specific guardrails** | RULES.md files, decision-context approvals | Planned |
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

```bash
# Logs are at ~/.openclaw/logs/
ls ~/.openclaw/logs/

# Or run diagnostics
cd openclaw && pnpm openclaw doctor
```

### Fresh restart

```bash
rm -rf ~/.openclaw
cd openclaw && pnpm openclaw onboard
```

### Control UI auth issues

Use the `#token=` URL from the onboard output, or try an incognito window.
