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

## Sentura Layer

Sentura is the enterprise control plane built on top of the running OpenClaw instance. It adds:

- AI employee management (Creator, Tuner, Orchestrator meta-agents)
- Enterprise dashboard
- RBAC, audit logging, approval workflows
- Sentura-specific extensions and skills

Development of Sentura components (once OpenClaw is running):

```bash
# Dashboard (when built)
pnpm dev:dashboard
```

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
