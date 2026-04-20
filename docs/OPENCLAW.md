> **On-demand reference — not read by default.** Consult when working on OpenClaw internals: extensions, gateway RPC, plugin SDK, channels, providers, memory, approvals, or hooks. Core agent loop is read by Sentura code via the stable `@openclaw/plugin-sdk` package (under `openclaw/packages/plugin-sdk/`) — never from OpenClaw's internal `src/` paths.

# OpenClaw — Technical Reference Document

> **Version analyzed:** `2026.4.19-beta.2` (package.json)
> **License:** MIT (Copyright 2025 Peter Steinberger)
> **Repository:** `github.com/openclaw/openclaw`
> **Runtime:** Node.js 24 (recommended) or Node 22.16+ (engines declare `>=22.14.0`; README recommends 24)
> **Language:** TypeScript (ESM, strict mode, ES2023 target) + Swift (Swabble package, native apps)
> **Package manager:** pnpm 10.33.0 (pnpm workspaces: `.`, `ui`, `packages/*`, `extensions/*`)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Entry Points & Bootstrap](#4-entry-points--bootstrap)
5. [Gateway Server](#5-gateway-server)
6. [Agent System](#6-agent-system)
7. [Plugin SDK & Extension System](#7-plugin-sdk--extension-system)
8. [Messaging Channels](#8-messaging-channels)
9. [AI Providers](#9-ai-providers)
10. [Configuration System](#10-configuration-system)
11. [Session & State Management](#11-session--state-management)
12. [Security Model](#12-security-model)
13. [Cron Scheduler](#13-cron-scheduler)
14. [Memory System](#14-memory-system)
15. [CLI Architecture](#15-cli-architecture)
16. [Terminal UI (TUI)](#16-terminal-ui-tui)
17. [Web Control UI](#17-web-control-ui)
18. [Native Applications](#18-native-applications)
19. [Deployment Options](#19-deployment-options)
20. [Testing Infrastructure](#20-testing-infrastructure)
21. [Complete Extension Catalog](#21-complete-extension-catalog)
22. [Key Dependencies](#22-key-dependencies)
23. [Relevance to Sentura](#23-relevance-to-sentura)

---

## 1. Overview

**OpenClaw** is an open-source, self-hosted **personal AI assistant** platform. It operates as a **multi-channel AI gateway** that receives messages from 22+ messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Matrix, MS Teams, IRC, etc.), routes them through configurable AI providers (OpenAI, Anthropic, Ollama, vLLM, 37+ providers), and delivers responses back to the originating channel.

The product philosophy is **"the assistant, not the gateway."** The gateway is the control plane; the user experience is a personal AI assistant that lives across all your communication channels, runs on your own hardware, and supports voice, canvas rendering, browser automation, scheduled tasks, and multi-agent coordination.

### Core Capabilities

- **22+ messaging channels** with unified conversation model
- **37+ AI provider integrations** (cloud APIs + local inference; see §21 for the full catalog)
- **Agent tool system** with 30+ built-in tools (browser, canvas, cron, exec, file system, image generation, web search/fetch, session coordination)
- **Subagent spawning** with depth limits and isolated sessions
- **Cron scheduler** for persistent scheduled agent runs
- **Memory system** with LanceDB vector embeddings and dreaming/consolidation
- **Voice pipeline** (Wake Word, Talk Mode, TTS/STT on macOS/iOS/Android)
- **Live Canvas** with A2UI (agent-driven visual workspace)
- **MCP loopback server** + child-process stdio MCP servers configured via `mcp.servers.<name>`
- **Plugin SDK** (`@openclaw/plugin-sdk`) with **107 bundled extensions**
- **Control UI** (web dashboard, now a pnpm workspace package) + **WebChat** interface
- **Native apps** for macOS, iOS, and Android, plus the `Swabble/` Swift package
- **Multi-agent routing** (per-channel/account/peer agent isolation)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLI (Commander)                       │
│  entry.ts → run-main.ts → build-program.ts               │
│  Commands: gateway, agent, message, tui, onboard, ...    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   Gateway Server                         │
│  HTTP (Hono) + WebSocket JSON-RPC + SSE Events           │
│  Port: 18789 (default) + 18790 (Control UI)              │
│                                                          │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────────┐    │
│  │ Config RPC   │ │ Session RPC│ │ Agent RPC        │    │
│  │ config.*     │ │ sessions.* │ │ agent, chat.*    │    │
│  └─────────────┘ └────────────┘ └──────────────────┘    │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────────┐    │
│  │ Cron RPC     │ │ Node RPC   │ │ Plugin RPC       │    │
│  │ cron.*       │ │ node.*     │ │ plugin.approval.*│    │
│  └─────────────┘ └────────────┘ └──────────────────┘    │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────────┐    │
│  │ Skills RPC   │ │ Models RPC │ │ Device Pairing   │    │
│  │ skills.*     │ │ models.*   │ │ device.pair.*    │    │
│  └─────────────┘ └────────────┘ └──────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Channel Plugin Loaders (per-channel adapters)    │    │
│  │ Webhook receivers, outbound dispatch             │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ MCP Loopback Server (tool protocol bridge)       │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Control UI Static Assets + WebChat               │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────────┐
│ Agent Core │  │ Plugin     │  │ Channel Plugins│
│ (pi-agent) │  │ Registry   │  │ (22+ channels) │
│ Tools +    │  │ Tools +    │  │ Inbound →      │
│ Subagents  │  │ Providers  │  │ Agent → Reply  │
└────────────┘  └────────────┘  └────────────────┘
       │
       ▼
┌────────────────────────────────────────────────┐
│              State Layer (Disk)                  │
│  Sessions │ Config │ Secrets │ Cron │ Memory    │
│  $OPENCLAW_STATE_DIR (~/.openclaw by default)   │
└────────────────────────────────────────────────┘
```

### Design Principles

- **Single-process gateway** — all channels, agents, cron, and UI served from one Node.js process
- **Plugin-first** — channels and providers are extensions, not hardcoded
- **Config-driven** — JSON5 config with JSON Schema validation, hot-patchable via gateway RPC
- **File-based state** — no external database required; SQLite-vec for embeddings, JSON for sessions
- **Secure by default** — DM pairing, tool denylists on HTTP, owner-only tools, SSRF guards

---

## 3. Directory Structure

OpenClaw is now a **pnpm monorepo** (`pnpm-workspace.yaml` lists `.`, `ui`, `packages/*`, `extensions/*`). Top-level layout:

```
openclaw/
├── openclaw.mjs              # CLI entry (bin wrapper, Node version check)
├── package.json               # v2026.4.19-beta.2, exports ./plugin-sdk/* from dist/plugin-sdk/
├── pnpm-workspace.yaml        # pnpm monorepo definition
├── tsconfig.json              # ESM, NodeNext, strict, ES2023
├── Dockerfile                 # Multi-stage Node 24 bookworm build
├── docker-compose.yml         # Gateway + CLI services
├── render.yaml                # Render.com deployment config
├── openclaw.podman.env        # Podman environment template
│
├── src/                       # Core TypeScript source (root workspace `openclaw`)
│   ├── entry.ts               # CLI entry point (respawn, profile, container target)
│   ├── index.ts               # Library re-exports for programmatic use
│   ├── agents/                # Agent tools factory, subagent control, embedded-pi-mcp loader
│   ├── gateway/               # HTTP + WS server, protocol schemas, methods
│   ├── config/                # Config loader, JSON5 I/O, Zod schemas, mcp-config.ts, types.mcp.ts
│   ├── infra/                 # Platform infra (root resolution, env, updates, TLS, etc.)
│   ├── channels/              # Channel plugin types, web channel, plugin contracts
│   ├── plugin-sdk/            # Source of the plugin SDK (compiled into dist/plugin-sdk)
│   ├── plugins/               # Plugin runtime, registry, tool resolution
│   ├── cli/                   # Commander program, subcommands, root help
│   ├── commands/              # CLI command implementations
│   ├── cron/                  # Cron scheduler service
│   ├── sessions/              # Session lifecycle, transcript, persistence
│   ├── security/              # Tool policy, dangerous tools, audit, path safety
│   ├── secrets/               # Secret storage, auth store, provider credentials
│   ├── tui/                   # Terminal UI (pi-tui integration)
│   ├── tts/                   # Text-to-speech pipeline
│   ├── media/                 # Media handling (images, audio, video, attachments)
│   ├── media-understanding/   # Vision/audio understanding pipeline
│   ├── image-generation/      # Image generation tool + provider dispatch
│   ├── video-generation/      # Video generation tool + provider dispatch
│   ├── memory-host-sdk/       # In-tree host interface (mirrors packages/memory-host-sdk)
│   ├── mcp/                   # MCP loopback server + plugin-tools serve
│   ├── hooks/                 # Lifecycle hooks (before_prompt_build, etc.)
│   ├── flows/                 # Agent flow definitions
│   ├── routing/               # Message routing logic
│   ├── tasks/                 # Task management
│   ├── canvas-host/           # Canvas A2UI host
│   ├── terminal/              # Terminal/PTY management
│   ├── pairing/               # Device pairing protocol
│   ├── shared/                # Shared utilities
│   ├── utils/                 # General utilities
│   ├── logging/               # Structured logging (tslog)
│   ├── types/                 # Shared type definitions
│   ├── wizard/                # Setup wizard
│   └── ...
│
├── packages/                  # pnpm workspace packages (NEW in this version)
│   ├── plugin-sdk/            # @openclaw/plugin-sdk — stable public SDK surface (per-entry
│   │                           #   exports resolve TypeScript to src/ and declarations to
│   │                           #   dist/src/plugin-sdk/*.d.ts)
│   ├── memory-host-sdk/       # @openclaw/memory-host-sdk — memory engine host interface
│   │                           #   (./runtime, ./engine, ./engine-foundation, …)
│   └── plugin-package-contract/ # @openclaw/plugin-package-contract — plugin package contract
│                              #   shared between SDK and plugin manifests
│
├── extensions/                # 107 plugin extensions (channel / provider / memory / tool /
│                              #   search / speech / infrastructure)
│   ├── slack/  telegram/  whatsapp/  discord/  signal/  imessage/  msteams/  matrix/ …
│   ├── openai/  anthropic/  google/  mistral/  groq/  ollama/  vllm/  sglang/ …
│   ├── memory-core/  memory-lancedb/  memory-wiki/  active-memory/
│   ├── browser/  acpx/  firecrawl/  tavily/  exa/  brave/  duckduckgo/ …
│   ├── speech-core/  elevenlabs/  deepgram/  tts/  voice-call/  talk-voice/
│   ├── image-generation-core/  video-generation-core/  media-understanding-core/
│   ├── diagnostics-otel/  device-pair/  webhooks/  qa-lab/  qa-matrix/  qa-channel/
│   └── …  (see §21 for the full catalog)
│
├── ui/                        # Control UI (Vite + Lit web components, now a pnpm workspace
│                              #   package — "openclaw-control-ui")
│   ├── package.json
│   ├── src/
│   │   ├── main.ts            # UI entry
│   │   ├── ui/                # App shell, views, controllers, gateway client
│   │   ├── i18n/              # en, de, es, zh-CN, zh-TW, pt-BR
│   │   └── styles/            # CSS modules
│   └── vite.config.ts
│
├── apps/                      # Native companion apps
│   ├── macos/                 # macOS menu bar app (Swift)
│   ├── ios/                   # iOS app (Swift, xcodegen)
│   ├── android/               # Android app (Kotlin, Gradle)
│   └── shared/OpenClawKit/    # Shared Swift kit (protocol, Canvas, Talk, pairing)
│
├── Swabble/                   # Standalone Swift package (Package.swift, Sources/, Tests/)
│                              #   shared Swift surface separate from apps/shared
│
├── skills/                    # Bundled skill definitions
├── docs/                      # Documentation (English + zh-CN)
├── scripts/                   # Build, release, CI, deployment scripts
├── test/                      # Integration/architecture tests
└── git-hooks/                 # Pre-commit hooks
```

**Monorepo migration notes:** the SDK used to be imported from `openclaw/plugin-sdk/*` (subpath exports of the root package). As of `2026.4.19-beta.2` the same subpath exports still work (package.json resolves `./plugin-sdk/*` to `dist/plugin-sdk/*`), **and** a parallel workspace package `@openclaw/plugin-sdk` exists under `packages/plugin-sdk/` that exposes the same surface with per-entry exports (`./core`, `./acp-runtime`, `./browser-config-runtime`, `./approval-runtime`, …). Sentura code should keep importing from `openclaw/plugin-sdk/*` — do NOT reach into `src/plugin-sdk/` or `packages/plugin-sdk/src/` directly.

---

## 4. Entry Points & Bootstrap

### CLI Bootstrap Chain

```
openclaw (bin) → openclaw.mjs → dist/entry.js → src/entry.ts
```

**`openclaw.mjs`** (CLI bin wrapper):
- Validates Node.js version (engines declare `>=22.14.0`; Node 24 recommended, Node 22.16+ supported)
- Enables compile cache
- Handles fast-path `--help` via precomputed metadata
- Imports `dist/entry.js` or `dist/entry.mjs`

**`src/entry.ts`** (214 lines):
- Sets `process.title = "openclaw"`
- Installs warning filter and env normalization
- Handles CLI respawning (for container targets, profile switching)
- Parses `--profile`, `--dev`, `--container` flags
- Fast-paths `--version` and `--help`
- Delegates to `cli/run-main.ts` → `runCli(argv)`

**`src/index.ts`** (100 lines):
- Library mode re-exports (`loadConfig`, `resolveStorePath`, `monitorWebChannel`, etc.)
- Only loads library modules when **not** running as main (avoids CLI side-effects)
- Legacy CLI entry function `runLegacyCliEntry` for backward compat

### Per-workspace bootstrap state (`resolveWorkspaceBootstrapStatus`)

Defined in `openclaw/src/agents/workspace.ts`. A workspace is considered **complete** if either:

1. `<workspace>/.openclaw/workspace-state.json` contains a non-empty `setupCompletedAt` string, OR
2. `<workspace>/BOOTSTRAP.md` does **not** exist.

Otherwise it is **pending**. When a workspace is pending:

- The runtime injects a `[Bootstrap pending]` prefix into every turn's user prompt.
- Non-primary runs (sessions spawned via gateway RPC — e.g. the dashboard) are forced into **limited mode**, which causes agents to refuse destructive or deployment actions.

The OpenClaw-native escape from this state is for the agent to delete `BOOTSTRAP.md` during its first run. **Sentura diverges here**: `BOOTSTRAP.md` is permanent because it hosts `## Enterprise Context`. `scripts/sentura-setup.sh` / `scripts/sentura-setup.ps1` stamp `setupCompletedAt` into each meta-agent workspace instead. See `docs/SETUP.md` § "Meta-agent bootstrap convention" and `docs/workspace-convention.md` § 7 for the full reasoning.

---

## 5. Gateway Server

### Architecture

The gateway is a long-lived HTTP + WebSocket server that serves as the control plane for the entire system.

**Implementation files:**
- `src/gateway/server.ts` — public `startGatewayServer` export
- `src/gateway/server.impl.ts` — full implementation (plugins, channels, cron, WS, discovery)
- `src/gateway/server-ws-runtime.ts` — WebSocket attachment layer
- `src/gateway/server-methods-list.ts` — RPC method registry

### HTTP Layer (Hono)

| Endpoint | Purpose |
|----------|---------|
| `GET /healthz` | Health check (Docker/k8s readiness) |
| `GET /readyz` | Readiness probe |
| `POST /tools/invoke` | HTTP tool invocation (with denylist enforcement) |
| `GET /pair` | Device pairing endpoint |
| Plugin HTTP routes | Per-channel webhook receivers (e.g., Slack events, Telegram updates) |
| Static assets | Control UI + WebChat files |
| OpenAI-compatible | `/v1/chat/completions`-style surface for external clients |

### WebSocket JSON-RPC API

The gateway exposes a typed RPC protocol over WebSocket. Methods are organized by domain:

**Core methods:**
- `health` — server health
- `config.*` — configuration read/write/patch/apply/revert
- `sessions.*` — session CRUD, transcript, compact, reset
- `agent` — agent invocation
- `chat.*` — chat history, send, abort, streaming
- `cron.*` — scheduled job CRUD, run, wake
- `node.*` — device node control (camera, screen, location, notifications)
- `device.pair.*` — device pairing protocol
- `tools.catalog` — list available tools
- `models.list` — list configured models
- `skills.*` — skill management (list, install, enable, disable)
- `wizard.*` — setup wizard steps
- `exec.approval.*` — execution approval workflow
- `plugin.approval.*` — plugin-specific approval flows

**Gateway events (SSE/WS frames):**
- `session.message` — new message in session
- `session.tool` — tool execution event
- `presence` — user/agent presence
- `heartbeat` — keepalive
- `cron` — cron job events
- Pairing, approval, and config change events

### Protocol Contract

`src/gateway/protocol/index.ts` exports the full typed protocol:
- `ConnectParams`, `GatewayFrame`, `EventFrame`
- Schemas for cron, config, agent, session operations
- `ErrorCodes` enumeration
- Ajv-validated request/response schemas

The protocol is also codegen'd to Swift (`GatewayModels.swift`) for native apps and has a JSON Schema artifact at `dist/protocol.schema.json`.

---

## 6. Agent System

### Tool Architecture

The agent runtime is built on **`@mariozechner/pi-agent-core`** (`AnyAgentTool` extends `AgentTool`). Tools are assembled in `src/agents/openclaw-tools.ts` via `createOpenClawTools(options)`.

**Core tools (always available):**

| Tool | Purpose |
|------|---------|
| `canvas` | Live Canvas rendering and A2UI control |
| `nodes` | Device node actions (camera, screen, notifications) |
| `cron` | Create/manage scheduled jobs |
| `tts` | Text-to-speech output |
| `gateway` | Gateway control (restart, config, status) |
| `agents` | List/manage multi-agent configurations |
| `sessions_list` | List active sessions |
| `sessions_history` | Read session transcript |
| `sessions_send` | Send message to another session |
| `sessions_yield` | Yield control to another session |
| `sessions_spawn` | Spawn subagent sessions |
| `subagents` | List/kill/steer running subagents |
| `session_status` | Current session state |
| `web_search` | Search the web (provider-dispatched) |
| `web_fetch` | Fetch web page content |
| `image_generation` | Generate images (provider-dispatched) |
| `pdf` | PDF processing |
| `message` | Send messages to channels |

**Plugin tools** are merged after core tools via `resolvePluginTools()` from the plugin registry.

### Tool Registration Model

1. **Core tools:** Explicit `createXTool({ ... })` calls in `openclaw-tools.ts`
2. **Plugin tools:** `resolvePluginTools({ context, existingToolNames, toolAllowlist })` loads from runtime plugin registry
3. **Tool allowlisting:** Optional per-session/agent tool allowlists
4. **Owner-only tools:** Some tools (e.g., `exec`, `gateway`) are marked `ownerOnly` and restricted

### Tool Execution Model

Tools implement `execute(toolCallId, args)` returning structured results (`jsonResult`, `textResult`, etc.). The execution pipeline includes:
- Pre-execution hooks (`runBeforeToolCallHook`)
- Tool loop detection (prevents infinite tool chains)
- Owner-only policy enforcement
- HTTP tool invoke denylist (for `POST /tools/invoke`)

### Subagent System

- `sessions_spawn` creates isolated agent runs with configurable runtime (`subagent` / `acp`)
- Subagent registry tracks active runs via `registerSubagentRun`
- Depth limits prevent recursive spawn chains
- `subagents` tool provides `list`, `kill`, and `steer` operations
- Each subagent gets its own session context and optional thinking mode

---

## 7. Plugin SDK & Extension System

### Plugin SDK

As of `2026.4.19-beta.2` the plugin SDK lives in two places that expose the **same public API**:

| Location | Package name | Used by |
|----------|--------------|---------|
| `openclaw/packages/plugin-sdk/` | `@openclaw/plugin-sdk` (private workspace package) | Internal workspace packages and extensions inside the OpenClaw monorepo (via pnpm workspace linking). |
| `openclaw/src/plugin-sdk/` → compiled to `openclaw/dist/plugin-sdk/` | Re-exported from the root `openclaw` package as subpath exports `./plugin-sdk/*` | External consumers (including Sentura). |

**Sentura rule:** always import from `openclaw/plugin-sdk/...` (the root package's subpath exports). Never import from `src/plugin-sdk/` or `packages/plugin-sdk/src/` directly — those are build-time paths that change between versions.

The SDK exposes 100+ sub-path exports:

```
openclaw/plugin-sdk              — Core SDK types and interfaces
openclaw/plugin-sdk/core         — Fundamental primitives
openclaw/plugin-sdk/runtime      — Runtime environment
openclaw/plugin-sdk/setup        — Plugin setup utilities
openclaw/plugin-sdk/channel-*    — Channel plugin contracts (15+ sub-paths)
openclaw/plugin-sdk/approval-*   — Approval workflow types (6 sub-paths)
openclaw/plugin-sdk/provider-*   — Provider registration (12+ sub-paths)
openclaw/plugin-sdk/reply-*      — Reply pipeline (6 sub-paths)
openclaw/plugin-sdk/memory-*     — Memory engine interface (10+ sub-paths)
openclaw/plugin-sdk/speech-*     — Speech/TTS/STT (2 sub-paths)
openclaw/plugin-sdk/media-*      — Media handling (3 sub-paths)
openclaw/plugin-sdk/browser-*    — Browser automation (4 sub-paths)
openclaw/plugin-sdk/config-*     — Config schema/runtime (3 sub-paths)
openclaw/plugin-sdk/security-*   — Security runtime
openclaw/plugin-sdk/gateway-*    — Gateway runtime
openclaw/plugin-sdk/testing      — Test utilities
```

### Extension Manifest (`openclaw.plugin.json`)

Each extension declares its capabilities via a JSON manifest:

```json
{
  "id": "slack",
  "channels": ["slack"],
  "configSchema": { ... },
  "enabledByDefault": true,
  "providers": ["openai"],
  "contracts": {
    "webSearchProviders": [...],
    "speechProviders": [...],
    "imageGenerationProviders": [...],
    "mediaUnderstandingProviders": [...],
    "tools": [...]
  },
  "providerAuthEnvVars": { ... },
  "providerAuthChoices": [...],
  "modelSupport": { ... },
  "cliBackends": [...],
  "skills": ["./skills"],
  "kind": "memory"
}
```

**Role detection** (no explicit `type` field):
- `"channels"` key → messaging channel plugin
- `"providers"` key → AI model provider
- `"skills"` key → skill pack
- `"kind": "memory"` → memory backend
- `"contracts"` key → capability registration (tools, search, speech, etc.)

### Channel Plugin Contract

Channel plugins implement the `ChannelPlugin` interface from `src/channels/plugins/types.plugin.ts`:

```typescript
interface ChannelPlugin {
  id: string;
  meta: ChannelMeta;
  capabilities: ChannelCapabilities;
  // Adapters:
  config: ConfigAdapter;
  setup: SetupAdapter;
  pairing: PairingAdapter;
  security: SecurityAdapter;
  outbound: OutboundAdapter;
  gateway: GatewayAdapter;
  // Optional:
  gatewayMethods?: Record<string, MethodHandler>;
  configSchema?: JSONSchema;
}
```

### Provider Plugin Contract

Provider plugins use `definePluginEntry` and register via `OpenClawPluginApi`:

```typescript
api.registerProvider(provider);
api.registerImageGenerationProvider(imageGen);
api.registerSpeechProvider(speech);
api.registerRealtimeVoiceProvider(voice);
api.registerMediaUnderstandingProvider(mediaUnderstanding);
api.registerWebSearchProvider(webSearch);
api.registerCliBackend(cliBackend);
api.on("before_prompt_build", handler);
```

---

## 8. Messaging Channels

### Supported Channels (22)

| Channel | Extension | Protocol |
|---------|-----------|----------|
| WhatsApp | `whatsapp` | Baileys (WhatsApp Web) |
| Telegram | `telegram` | Telegram Bot API |
| Slack | `slack` | Slack Bolt / Events API |
| Discord | `discord` | Discord.js |
| Google Chat | `googlechat` | Google Chat API |
| Signal | `signal` | Signal Protocol |
| iMessage | `imessage` | AppleScript / BlueBubbles |
| BlueBubbles | `bluebubbles` | BlueBubbles API |
| IRC | `irc` | IRC protocol |
| Microsoft Teams | `msteams` | MS Teams Bot Framework |
| Matrix | `matrix` | Matrix SDK (E2EE via WASM) |
| Feishu | `feishu` | Feishu/Lark API |
| LINE | `line` | LINE Messaging API |
| Mattermost | `mattermost` | Mattermost API |
| Nextcloud Talk | `nextcloud-talk` | Nextcloud API |
| Nostr | `nostr` | Nostr protocol (NIP relays) |
| Synology Chat | `synology-chat` | Synology API |
| Tlon | `tlon` | Tlon/Urbit protocol |
| Twitch | `twitch` | Twitch IRC/API |
| Zalo | `zalo` | Zalo OA API |
| Zalo Personal | `zalouser` | Zalo user API |
| QQBot | `qqbot` | QQ Bot API |
| WebChat | Built-in | Gateway WebSocket |
| Voice Call | `voice-call` | Twilio/Telnyx/Plivo PSTN |

### Channel Architecture

```
Inbound message (webhook/WS/poll)
  → Channel Plugin (parse, normalize)
    → Routing (session key resolution, agent selection)
      → Agent execution (tool calls, LLM inference)
        → Reply pipeline (chunking, media, markdown)
          → Channel Plugin (format, send)
            → Outbound delivery (API call)
```

---

## 9. AI Providers

### Supported Providers (40+)

**Cloud providers:**

| Provider | Extension | Auth |
|----------|-----------|------|
| OpenAI | `openai` | API key / OAuth |
| Anthropic | `anthropic` | API key / OAuth |
| Google (Gemini) | `google` | API key / OAuth |
| Mistral | `mistral` | API key |
| Groq | `groq` | API key |
| DeepSeek | `deepseek` | API key |
| xAI (Grok) | `xai` | API key |
| Perplexity | `perplexity` | API key |
| Together | `together` | API key |
| OpenRouter | `openrouter` | API key |
| NVIDIA | `nvidia` | API key |
| Amazon Bedrock | `amazon-bedrock` | AWS credentials |
| Anthropic Vertex | `anthropic-vertex` | Google Cloud |
| GitHub Copilot | `github-copilot` | Device login / GH_TOKEN |
| Copilot Proxy | `copilot-proxy` | Local method |
| HuggingFace | `huggingface` | HF_TOKEN |
| Venice | `venice` | API key |
| Cloudflare AI Gateway | `cloudflare-ai-gateway` | API key |
| Vercel AI Gateway | `vercel-ai-gateway` | API key |
| LiteLLM | `litellm` | API key |
| Microsoft Foundry | `microsoft-foundry` | Entra ID / Azure key |
| Moonshot (Kimi) | `moonshot` | API key |
| Minimax | `minimax` | OAuth / API key |
| Qwen | `qwen` | DashScope API |
| Qianfan | `qianfan` | API key |
| StepFun | `stepfun` | API key |
| Volcengine | `volcengine` | API key |
| BytePlus | `byteplus` | API key |
| Chutes | `chutes` | OAuth / API key |
| Fal | `fal` | API key (image gen) |
| Synthetic | `synthetic` | API key |
| Xiaomi | `xiaomi` | API key |
| Zai | `zai` | API key |
| Lobster | `lobster` | API key |

**Local/self-hosted providers:**

| Provider | Extension | Notes |
|----------|-----------|-------|
| Ollama | `ollama` | Local inference, auto-detection |
| vLLM | `vllm` | Self-hosted, custom endpoint |
| SGLang | `sglang` | Self-hosted, custom endpoint |

**Speech/TTS providers:**

| Provider | Extension | Capabilities |
|----------|-----------|-------------|
| ElevenLabs | `elevenlabs` | TTS |
| Deepgram | `deepgram` | STT / media understanding |
| Microsoft | `microsoft` | TTS (Edge TTS) |
| OpenAI | `openai` | TTS + realtime voice |

**Web search providers:**

| Provider | Extension |
|----------|-----------|
| Brave | `brave` |
| DuckDuckGo | `duckduckgo` |
| SearXNG | `searxng` |
| Exa | `exa` |
| Firecrawl | `firecrawl` |
| Tavily | `tavily` |
| Perplexity | `perplexity` |

---

## 10. Configuration System

### Config Format

- **JSON5** primary config file (supports comments, trailing commas)
- **Environment variable** fallbacks for all settings
- **dotenv** support (`.env` files)
- **Config patches** via gateway RPC with hash conflict detection
- **Runtime snapshots** for live state

### Config Management

**Key files:**
- `src/config/config.ts` — `loadConfig`, `writeConfigFile`, validation
- `src/config/io.ts` — JSON5 I/O, env substitution, merge patches, audit logging
- `src/config/schema.ts` — Merged JSON Schema (for UI form rendering)
- `src/config/zod-schema*.ts` — Zod validation layers per domain
- `src/config/sessions/store*.ts` — Session store persistence

**Config schema** includes domains for:
- Gateway settings (port, bind, auth, TLS)
- Provider configuration (API keys, model routing, fallbacks)
- Channel settings (per-channel enable/disable, credentials, behavior)
- Agent configuration (system prompt, tools, thinking mode)
- Cron jobs
- Memory settings
- Security policies
- Plugin-specific settings (each extension contributes its own `configSchema`)

### Config RPC Methods

- `config.get` — read current config
- `config.apply` — apply full config replacement
- `config.patch` — merge patch with conflict detection
- `config.revert` — revert to previous state

---

## 11. Session & State Management

### State Directory

All persistent state lives under `$OPENCLAW_STATE_DIR` (defaults to `~/.openclaw`):

```
~/.openclaw/
├── config.json5           # Primary configuration
├── sessions/              # Per-session transcript and state
├── secrets/               # Encrypted credential store
├── cron/                  # Cron job definitions and state
├── memory/                # Memory engine data (LanceDB)
├── plugins/               # Plugin state
├── logs/                  # Log files
└── workspace/             # Agent workspace directory
```

### Session Model

- **Main session** — default conversation context
- **Group sessions** — per-channel/group isolated conversations
- **Subagent sessions** — spawned by tools, isolated execution context
- **Session keys** — derived from channel + account + thread identifiers

**Session lifecycle:**
- `create` → `active` → `compact` (summarize) → `reset` (clear)
- Transcript persistence with locked writes and disk budgets
- Delivery context tracking (which channel/account a session belongs to)
- Session pruning for disk space management

### Session RPC Methods

- `sessions.list` — enumerate sessions
- `sessions.get` — read session state
- `sessions.transcript` — full conversation transcript
- `sessions.compact` — summarize and compact
- `sessions.reset` — clear session
- `sessions.delete` — remove session

---

## 12. Security Model

### Tool Policy

`src/security/dangerous-tools.ts` defines `DEFAULT_GATEWAY_HTTP_TOOL_DENY` — tools blocked on `POST /tools/invoke` by default:

```
exec, spawn, shell, fs_*, apply_patch, sessions_spawn,
sessions_send, cron, gateway, nodes, whatsapp_login, ...
```

### Sandbox tool-policy filter (dashboard vs CLI divergence)

OpenClaw applies tool policy in **two** stages when an agent runs in `sandbox.mode = "non-main"`:

1. **Agent-level pipeline** (`openclaw/src/agents/tool-policy.ts` + `tool-policy-pipeline.ts`). Reads `agent.tools.profile`, `agent.tools.allow`, `agent.tools.alsoAllow`, `agent.tools.deny` and produces the "agent toolset".
2. **Sandbox-level pipeline** (`openclaw/src/agents/sandbox/tool-policy.ts`). Intersects the agent toolset with the hardcoded constants in `openclaw/src/agents/sandbox/constants.ts`:
    - `DEFAULT_TOOL_ALLOW` = `{exec, read, write, edit, apply_patch, process, image, sessions_list, sessions_history, sessions_send, session_status, subagents}` (narrow on purpose).
    - `DEFAULT_TOOL_DENY` = `{gateway, browser, canvas, cron, nodes, <every channel id>}`.
    - `filterDefaultDenyForExplicitAllows` removes a channel-like deny entry if it is re-added via `tools.sandbox.tools.alsoAllow`.

The critical consequence: **agent-level `tools.alsoAllow` does NOT bleed into the sandbox filter.** Plugin tools (`sentura_agents_manage`, `sentura_rbac_manage`, `sentura_audit_query`, `memory_search`, `memory_get`, `update_plan`, `web_fetch`, `web_search`, `pdf`, `image_generate`, `video_generate`) vanish at stage 2 unless re-listed under `tools.sandbox.tools.alsoAllow`.

**Why this matters for entry points:**

| Entry point | Goes through sandbox filter? | Visible tool count (Forge, 2026-04-19) |
|-------------|:---------------------------:|----------------------------------------|
| CLI: `openclaw agent --agent creator` | No (main-process path) | 21 (full toolset) |
| Gateway RPC: `tools.effective` | No (reports pre-sandbox view) | 21 |
| Dashboard webchat: `chat.send` RPC | **Yes** (embedded runner) | 7 without the fix, 21 with it |
| `sessions.send` (cross-session) | **Yes** if target agent is `non-main` | same as dashboard |

This is why the Sentura debug cycle that was stuck for a full day (Creator deployment Rounds 15–19) looked like two contradictory worlds: every CLI probe said "the tool is there" while every dashboard chat said "I don't have `sentura_agents_manage`." Round 20 resolved it by adding `tools.sandbox.tools.alsoAllow` to every meta-agent. See `docs/SETUP.md` § "Sandbox tool-policy filter" for the per-agent allowlists and verification command, and `docs/memory/shared/creator-deployment-rounds-1-14.md` for the full postmortem.

**Checklist when adding or modifying a sandboxed agent:**

1. Agent-level `tools.alsoAllow` — tools the agent should be able to see and plan around.
2. Sandbox-level `tools.sandbox.tools.alsoAllow` — MUST list every plugin tool from step 1 that is not already in `DEFAULT_TOOL_ALLOW`. Channel-like entries listed here are automatically exempted from `DEFAULT_TOOL_DENY`.
3. Verify from the dashboard session, not only the CLI — run `tools.effective` via the gateway **and** send an actual `chat.send` before declaring the wiring correct.

### Security Layers

| Layer | Mechanism |
|-------|-----------|
| **DM Pairing** | Channel messages require explicit pairing (`openclaw pairing approve`) |
| **Owner-only tools** | Certain tools restricted to the device owner |
| **HTTP tool denylist** | Dangerous tools blocked on HTTP API by default |
| **SSRF guards** | `ssrf-policy` and `ssrf-runtime` SDK modules |
| **Path safety** | Directory traversal prevention |
| **Safe regex** | Regex complexity limits |
| **Gateway auth** | Token-based gateway authentication |
| **Windows ACLs** | Platform-specific file permissions |
| **Audit logging** | Security events logged |
| **Skill scanning** | Skill content analysis before execution |
| **Exec approval** | Human approval workflow for high-risk operations |

### Doctor Command

`openclaw doctor` audits the installation for:
- Risky configurations
- Exposed ports without auth
- Weak pairing settings
- Missing security headers

---

## 13. Cron Scheduler

### CronService (`src/cron/service.ts`)

Persistent cron jobs with timer-based scheduling, isolated agent runs, and delivery integration.

**API:**
- `start()` / `stop()` — lifecycle
- `list()` — enumerate jobs
- `add(job)` / `update(id, patch)` / `remove(id)` — CRUD
- `run(id)` / `enqueueRun(id)` — manual trigger
- `wake()` — process pending timers

**Features:**
- Jobs persist across gateway restarts
- Each job runs an isolated agent session
- Delivery context (which channel to reply to)
- Wake/heartbeat integration for sleeping gateways

**Gateway RPC:** `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`

---

## 14. Memory System

### Architecture

Two-extension memory system:

**`memory-core`** (`kind: memory`):
- Core memory engine with dreaming/consolidation cron
- Memory scoring and relevance ranking
- Foundation model integration for memory formation
- QMD (query-memory-decide) cycle
- Status tracking and reporting

**`memory-lancedb`** (`kind: memory`):
- LanceDB vector store for semantic memory
- Embedding generation and storage
- Similarity search for memory recall
- Configurable embedding dimensions and models

### Memory Host SDK (`packages/memory-host-sdk/` → `@openclaw/memory-host-sdk`, mirrored in `src/memory-host-sdk/`)

Host interface for memory engines. The package exposes per-entry exports: `./runtime`, `./runtime-core`, `./runtime-cli`, `./runtime-files`, `./engine`, `./engine-foundation`, and the additional host sub-modules listed below:
- `memory-core-engine-runtime` — engine lifecycle
- `memory-core-host-engine-embeddings` — embedding operations
- `memory-core-host-engine-foundation` — foundation model calls
- `memory-core-host-engine-storage` — persistence
- `memory-core-host-query` — semantic recall queries
- `memory-core-host-secret` — credential management
- `memory-core-host-status` — health reporting
- `memory-core-host-multimodal` — multimodal memory entries

---

## 15. CLI Architecture

### Commander Program

Built on **Commander.js** with a modular command registration system.

**Entry:** `src/cli/run-main.ts` → `runCli(argv)` → `build-program.ts` → `registerProgramCommands`

### Core Commands

| Command | Purpose |
|---------|---------|
| `openclaw onboard` | Guided setup wizard (auth, channels, daemon) |
| `openclaw gateway` | Start the gateway server |
| `openclaw agent` | Run agent with a message |
| `openclaw tui` | Launch terminal UI |
| `openclaw message send` | Send message to a channel |
| `openclaw config` | Configuration management subcommands |
| `openclaw status` | Gateway and channel status |
| `openclaw health` | Health check |
| `openclaw doctor` | Security and config audit |
| `openclaw dashboard` | Open Control UI |
| `openclaw sessions` | Session management |
| `openclaw models` | Model listing and management |
| `openclaw channels` | Channel login/status/management |
| `openclaw plugins` | Plugin install/enable/disable |
| `openclaw skills` | Skill management |
| `openclaw cron` | Cron job management |
| `openclaw pairing` | Device pairing approval |
| `openclaw nodes` | Device node management |
| `openclaw secrets` | Credential management |
| `openclaw security` | Security audit tools |
| `openclaw update` | Self-update (`--channel stable|beta|dev`) |
| `openclaw logs` | Log viewer |
| `openclaw backup` | Config/state backup |
| `openclaw reset` | Factory reset |
| `openclaw uninstall` | Clean uninstall |
| `openclaw sandbox` | Docker sandbox management |
| `openclaw dns` | DNS configuration |
| `openclaw hooks` | Lifecycle hooks management |
| `openclaw webhooks` | Webhook management |
| `openclaw qr` | QR code display (for channel pairing) |
| `openclaw completion` | Shell completion generation |

### Sub-CLIs

Additional sub-CLI registrations: `acp`, `gateway`, `daemon`, `system`, `approvals`, `devices`, `directory`, `clawbot`, `plugins`.

---

## 16. Terminal UI (TUI)

### Implementation

Built on **`@mariozechner/pi-tui`**, the TUI provides an interactive terminal chat interface.

**Entry:** `src/tui/tui.ts`
- Connects to gateway via `GatewayChatClient` (`gateway-chat.ts`)
- Session key resolution and management
- Theme support (light/dark)
- Chat log with markdown rendering
- Custom editor for multi-line input
- Command handlers for slash commands
- Overlay system (settings, help, etc.)
- Local shell runner integration

**Launch:** `openclaw tui` or `openclaw tui --dev`

---

## 17. Web Control UI

### Architecture

A separate **Vite + Lit** web application (`ui/` directory, package name `openclaw-control-ui`).

**Tech stack:**
- **Lit** web components (not React)
- **Vite** bundler
- **CSS modules** for styling
- **Marked** + DOMPurify for markdown
- **Lit Signals** for reactive state
- **Playwright** for browser tests

**UI Structure:**
- `ui/src/ui/app.ts` — main app shell
- `ui/src/ui/views/` — page views (chat, sessions, config, agents, skills, cron, logs, debug, overview, usage, channels, dreams, nodes)
- `ui/src/ui/controllers/` — state controllers (chat, sessions, agents, devices, usage, config, cron, logs, debug, skills, channels)
- `ui/src/ui/gateway.ts` — WebSocket gateway client
- `ui/src/ui/chat/` — chat rendering (messages, tools, markdown, export, slash commands)

**Internationalization:** en, de, es, zh-CN, zh-TW, pt-BR

**Features:**
- Real-time chat with tool streaming
- Session management and history
- Config editor with JSON Schema-driven forms
- Agent management and monitoring
- Skill browsing and installation
- Cron job management
- Usage tracking and billing display
- Device/node management
- Log viewer
- Debug panel

The gateway serves the built UI assets automatically. Accessible at `http://localhost:18790` (default).

---

## 18. Native Applications

### macOS App (`apps/macos/`)

- **Swift** menu bar application
- Voice Wake (always-listening wake word detection)
- WebChat embedded view
- Remote gateway connection
- Canvas A2UI rendering
- Device node (camera, screen, location, notifications)
- Packaging: `scripts/package-mac-app.sh` → `dist/OpenClaw.app`

### iOS App (`apps/ios/`)

- **Swift** (xcodegen project, Xcode 16+)
- Status: "Super Alpha" / internal TestFlight
- Connects as gateway `role: node`
- Voice, Canvas, Chat
- Uses `OpenClawKit` shared library

### Android App (`apps/android/`)

- **Kotlin** (Gradle, Play + third-party flavors)
- Status: "Extremely alpha"
- Connect via setup code or manual config
- Chat, Voice, Canvas
- Biometric security

### Shared Kit (`apps/shared/OpenClawKit/`)

- Swift package shared between macOS and iOS
- Gateway protocol types (`GatewayModels.swift`)
- Canvas A2UI host
- Talk/voice pipeline
- Device pairing protocol

---

## 19. Deployment Options

### npm (Recommended)

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Installs as a **launchd** (macOS) or **systemd user** service.

### Docker

**Dockerfile** (multi-stage, Node 24 bookworm):
- Build args: `OPENCLAW_EXTENSIONS`, `OPENCLAW_VARIANT` (default/slim), `OPENCLAW_INSTALL_BROWSER` (Chromium), `OPENCLAW_INSTALL_DOCKER_CLI`
- Default CMD: `gateway --allow-unconfigured`
- Health: `/healthz`, `/readyz`

**docker-compose.yml:**
- `openclaw-gateway`: port 18789+18790, bind `lan`, health check
- `openclaw-cli`: TTY/stdin, shared network

### Podman

- `setup-podman.sh` → `scripts/podman/setup.sh`
- `openclaw.podman.env` — environment template
- `scripts/podman/openclaw.container.in` — container definition

### Render.com

```yaml
# render.yaml
services:
  - type: web
    name: openclaw
    runtime: docker
    healthCheckPath: /health
    envVars:
      - key: OPENCLAW_GATEWAY_PORT
        value: "8080"
      - key: OPENCLAW_STATE_DIR
        value: /data/.openclaw
    disk:
      name: openclaw-data
      mountPath: /data
      sizeGB: 1
```

### Nix

External `nix-openclaw` repository for NixOS/Nix package management.

### From Source

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw && pnpm install && pnpm ui:build && pnpm build
pnpm dev gateway --port 18789
```

### Release Channels

- **stable** — tagged releases (`vYYYY.M.D`), npm `latest`
- **beta** — prerelease tags (`vYYYY.M.D-beta.N`), npm `beta`
- **dev** — HEAD of `main`, npm `dev`

Switch: `openclaw update --channel stable|beta|dev`

---

## 20. Testing Infrastructure

### Vitest Configuration

Multiple project-scoped Vitest configs aggregated in `vitest.config.ts`:

| Config | Scope |
|--------|-------|
| `vitest.config.ts` | Root aggregate |
| `vitest.gateway.config.ts` | Gateway tests |
| `vitest.extensions.config.ts` | Extension tests |
| `vitest.bundled.config.ts` | Bundled plugin tests |
| `vitest.channels.config.ts` | Channel tests |
| `vitest.e2e.config.ts` | End-to-end tests |
| `vitest.live.config.ts` | Live integration tests |
| `vitest.cron.config.ts` | Cron tests |
| `vitest.tasks.config.ts` | Task tests |
| `vitest.tooling.config.ts` | Tool tests |
| `vitest.performance-config.ts` | Performance benchmarks |
| `vitest.secrets.config.ts` | Secrets tests |
| `vitest.logging.config.ts` | Logging tests |
| `vitest.extension-*.config.ts` | Per-extension test configs |
| `ui/vitest.config.ts` | UI unit tests |
| `ui/vitest.node.config.ts` | UI node tests |

### Test Types

- **Unit tests** — co-located with source (`.test.ts`)
- **Integration tests** — `test/` directory
- **E2E tests** — Docker-based (`test:docker:*` scripts)
- **Live tests** — against real providers (`test:live`)
- **Browser tests** — Playwright for UI (`.browser.test.ts`)
- **Architecture tests** — structural validation (`test/architecture-smells.test.ts`)
- **Contract tests** — channel/plugin interface contracts
- **Performance tests** — startup benchmarks, import profiling, hotspot detection

### CI Scripts

- `prepush:ci.sh` — pre-push validation
- `test:all` — full test suite (lint, build, unit, e2e, live, docker)
- `deadcode:ci` — dead code detection (Knip)
- Code duplication detection (jscpd)

---

## 21. Complete Extension Catalog

`openclaw/extensions/` contains **107 extension directories** in the `2026.4.19-beta.2` cut (count via `ls -d openclaw/extensions/*/ | wc -l`). The tables below group them by role and reflect what shipped in this release. The directory also contains shared tsconfig fragments (`tsconfig.package-boundary.base.json`, `tsconfig.package-boundary.paths.json`), a `shared/` helpers directory, and a couple of live-test files (`music-generation-providers.live.test.ts`, `video-generation-providers.live.test.ts`) which are **not** extensions.

**New extensions since `2026.4.4`:** `active-memory`, `alibaba`, `amazon-bedrock-mantle`, `arcee`, `codex`, `comfy`, `fireworks`, `image-generation-core`, `lmstudio`, `media-understanding-core`, `memory-wiki`, `qa-channel`, `qa-lab`, `qa-matrix`, `runway`, `speech-core`, `video-generation-core`, `voyage`, `vydra`, `webhooks`. Always re-derive from the directory rather than trusting this list — it is maintained best-effort.

### Messaging Channels (22 extensions)

| Extension | ID | Channel |
|-----------|----|---------|
| `bluebubbles` | bluebubbles | BlueBubbles (iMessage bridge) |
| `discord` | discord | Discord |
| `feishu` | feishu | Feishu/Lark |
| `googlechat` | googlechat | Google Chat |
| `imessage` | imessage | iMessage (legacy AppleScript) |
| `irc` | irc | IRC |
| `line` | line | LINE |
| `matrix` | matrix | Matrix (E2EE) |
| `mattermost` | mattermost | Mattermost |
| `msteams` | msteams | Microsoft Teams |
| `nextcloud-talk` | nextcloud-talk | Nextcloud Talk |
| `nostr` | nostr | Nostr |
| `qqbot` | qqbot | QQ Bot |
| `signal` | signal | Signal |
| `slack` | slack | Slack |
| `synology-chat` | synology-chat | Synology Chat |
| `telegram` | telegram | Telegram |
| `tlon` | tlon | Tlon/Urbit |
| `twitch` | twitch | Twitch |
| `whatsapp` | whatsapp | WhatsApp |
| `zalo` | zalo | Zalo Official Account |
| `zalouser` | zalouser | Zalo Personal |

### AI Providers (35 extensions)

| Extension | ID | Provider(s) |
|-----------|----|-------------|
| `amazon-bedrock` | amazon-bedrock | Amazon Bedrock |
| `anthropic` | anthropic | Anthropic Claude |
| `anthropic-vertex` | anthropic-vertex | Claude on Vertex AI |
| `byteplus` | byteplus | BytePlus |
| `chutes` | chutes | Chutes |
| `cloudflare-ai-gateway` | cloudflare-ai-gateway | Cloudflare AI Gateway |
| `copilot-proxy` | copilot-proxy | GitHub Copilot Proxy |
| `deepseek` | deepseek | DeepSeek |
| `github-copilot` | github-copilot | GitHub Copilot |
| `google` | google | Google Gemini |
| `groq` | groq | Groq |
| `huggingface` | huggingface | HuggingFace |
| `kimi-coding` | kimi | Kimi / Moonshot |
| `kilocode` | kilocode | KiloCode |
| `litellm` | litellm | LiteLLM |
| `microsoft-foundry` | microsoft-foundry | Microsoft Foundry |
| `minimax` | minimax | Minimax |
| `mistral` | mistral | Mistral AI |
| `moonshot` | moonshot | Moonshot (Kimi) |
| `nvidia` | nvidia | NVIDIA |
| `ollama` | ollama | Ollama (local) |
| `openai` | openai | OpenAI + Codex |
| `opencode` | opencode | OpenCode |
| `opencode-go` | opencode-go | OpenCode Go |
| `openrouter` | openrouter | OpenRouter |
| `qianfan` | qianfan | Baidu Qianfan |
| `qwen` | qwen | Alibaba Qwen |
| `sglang` | sglang | SGLang (local) |
| `stepfun` | stepfun | StepFun |
| `synthetic` | synthetic | Synthetic |
| `together` | together | Together AI |
| `venice` | venice | Venice AI |
| `vercel-ai-gateway` | vercel-ai-gateway | Vercel AI Gateway |
| `vllm` | vllm | vLLM (local) |
| `volcengine` | volcengine | Volcengine |
| `xai` | xai | xAI (Grok) |
| `xiaomi` | xiaomi | Xiaomi |
| `zai` | zai | Zai |

### Speech & Media (4 extensions)

| Extension | ID | Capabilities |
|-----------|----|-------------|
| `deepgram` | deepgram | STT, media understanding |
| `elevenlabs` | elevenlabs | TTS |
| `fal` | fal | Image generation |
| `microsoft` | microsoft | TTS (Edge TTS) |

### Web Search (7 extensions)

| Extension | ID |
|-----------|----|
| `brave` | brave |
| `duckduckgo` | duckduckgo |
| `exa` | exa |
| `firecrawl` | firecrawl |
| `perplexity` | perplexity |
| `searxng` | searxng |
| `tavily` | tavily |

### Tools & Skills (8 extensions)

| Extension | ID | Purpose |
|-----------|----|---------|
| `acpx` | acpx | ACP Runtime + MCP servers |
| `browser` | browser | Browser automation (Playwright) |
| `diffs` | diffs | Diff viewer |
| `llm-task` | llm-task | Structured LLM tasks |
| `lobster` | lobster | Workflow automation |
| `open-prose` | open-prose | Writing assistant |
| `openshell` | openshell | OpenShell sandbox |
| `phone-control` | phone-control | Phone control commands |

### Infrastructure (7 extensions)

| Extension | ID | Purpose |
|-----------|----|---------|
| `device-pair` | device-pair | Device pairing gateway |
| `diagnostics-otel` | diagnostics-otel | OpenTelemetry diagnostics |
| `memory-core` | memory-core | Core memory engine |
| `memory-lancedb` | memory-lancedb | LanceDB vector memory |
| `talk-voice` | talk-voice | Voice management |
| `thread-ownership` | thread-ownership | Thread ownership tracking |
| `voice-call` | voice-call | PSTN voice (Twilio/Telnyx/Plivo) |

---

## 22. Key Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `hono` | 4.12.14 (pinned via pnpm overrides) | HTTP framework (gateway) |
| `ws` | ^8.20.0 | WebSocket server |
| `commander` | ^14.0.3 | CLI framework |
| `zod` | ^4.3.6 | Schema validation |
| `@sinclair/typebox` | 0.34.49 | JSON Schema types |
| `ajv` | ^8.18.0 | JSON Schema validation |
| `@modelcontextprotocol/sdk` | 1.29.0 | MCP protocol support |
| `@mariozechner/pi-agent-core` | 0.67.68 | Agent runtime core |
| `@mariozechner/pi-tui` | 0.67.68 | Terminal UI framework |
| `@agentclientprotocol/sdk` | 0.19.0 | ACP protocol support |
| `matrix-js-sdk` | 41.3.0 | Matrix protocol |
| `playwright-core` | 1.59.1 | Browser automation |
| `sharp` | ^0.34.5 | Image processing |
| `pdfjs-dist` | ^5.6.205 | PDF processing |
| `sqlite-vec` | 0.1.9 | Vector similarity (SQLite) |
| `markdown-it` | 14.1.1 | Markdown parsing |
| `croner` | ^10.0.1 | Cron expression parser |
| `chokidar` | ^5.0.0 | File watching |
| `dotenv` | ^17.4.2 | Environment variables |
| `yaml` | ^2.8.3 | YAML parsing |
| `undici` | 8.1.0 | HTTP client |
| `tslog` | ^4.10.2 | Structured logging |
| `lit` | ^3.3.2 | Web components (UI, `openclaw/ui`) |
| `vitest` | ^4.1.4 | Test runner |
| `typescript` | ^6.0.2 | TypeScript compiler |
| `tsdown` | 0.21.9 | Build tool |
| `oxlint` | ^1.60.0 | Linter |

---

## 23. Relevance to Sentura

OpenClaw **is** the Sentura runtime — Sentura does not wrap or replace it. Sentura is a control-plane layer of extensions, skills, configured AI employees, meta-agents (Creator/Tuner/Orchestrator), an admin dashboard, and enterprise MCP servers that all run on top of OpenClaw's gateway, agent loop, plugin system, and memory host. Every Sentura AI employee is a configured OpenClaw agent.

### OpenClaw features leveraged by Sentura

| OpenClaw feature | How Sentura uses it |
|------------------|----------------------|
| Gateway RPC (`agent.run`, `config.patch`, `exec.approval`, `cron.*`, `sessions.*`) | Primary interface from the Sentura dashboard and meta-agents. Dashboard never talks directly to agents. |
| Plugin SDK (`openclaw/plugin-sdk/*`) | Sentura extensions (`sentura/extensions/*`) register channels, tools, approval providers, and memory hooks via the same contracts. |
| Channel extensions (22+) | Used as-is for Slack/Teams/Discord/WhatsApp/etc. notification and chat surfaces. Sensitive actions are always routed to the dashboard. |
| Provider extensions (37+) | LLM selection per employee — cloud API keys or self-hosted Ollama/vLLM/SGLang. Sentura policy picks a default per tenant; users can override. |
| Memory host (`@openclaw/memory-host-sdk`) + `memory-lancedb` | Per-employee vector memory namespaces with dreaming/consolidation on the OpenClaw cron. |
| Approval workflow (`exec.approval`) | Sentura's HITL UI surfaces pending approvals from OpenClaw's queue and routes them to the right role via RBAC. |
| MCP servers (`mcp.servers.<name>`) | Sentura-built enterprise MCP servers (e.g. `@sentura/mcp-gradsale-admin`) are wired into an employee's config via `config.patch` under `mcp.servers.<name>`. Sentura does **not** invent a different MCP wiring. |
| Config JSON5 + Zod schemas | Sentura ships agent templates as JSON5 diffs applied through `config.patch`, never by hand-editing config files at runtime. |
| Workspace convention (`SOUL.md`, `AGENTS.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`) | The only 8 native OpenClaw workspace files. Sentura's safety boundaries live in `AGENTS.md → Hard Rules`; enterprise context lives in `BOOTSTRAP.md → Enterprise Context`. |
| Sandbox mode (`non-main`) | Mandatory for every AI employee deployed by Sentura's Creator agent. |
| Device pairing + Control UI | Available for employee owners/admins who want OpenClaw's native view alongside the Sentura dashboard. |

### Boundary rules (non-negotiable)

1. **Never modify OpenClaw core source.** Sentura changes happen in `sentura/extensions/*`, `sentura/skills/*`, `sentura/agents/*`, `sentura/dashboard/*`, and `sentura/mcp-servers/*`.
2. **Never import from `openclaw/src/*` or `openclaw/packages/plugin-sdk/src/*`.** Always use the stable subpath exports `openclaw/plugin-sdk/*`.
3. **Never call LLM providers directly.** All LLM access flows through OpenClaw's provider system.
4. **Never bypass the config system.** Runtime changes go through `config.patch`.
5. **Never store credentials in config or conversation.** Use OpenClaw's secret store (`$secret` references) or `~/.openclaw/.env`.
6. **Never build a custom Docker/docker-compose for the gateway.** Use `pnpm openclaw onboard` + `pnpm gateway:watch` in dev, or `openclaw/docker-setup.sh` in production.

### Differences in posture (same runtime, different surface)

| Aspect | OpenClaw (stock) | Sentura (control plane) |
|--------|------------------|-------------------------|
| **Primary user** | An individual power user | Enterprise admin + role-scoped employee users |
| **Provisioning** | Manual channel linking, config editing | Natural-language employee creation via the Creator agent; self-provisioning skills via `browser` with approval |
| **Safety** | Tool denylists + owner-only | Adds RBAC, data-tier (T0–T4) routing, enhanced HITL, audit logs |
| **Multi-agent** | Subagent spawning | Adds the Orchestrator meta-agent (Mode B), Creator, and Tuner |
| **Deployment flexibility** | User device / personal Docker | Cloud, on-prem, hybrid — without changing agent code |
| **LLM policy** | User-chosen keys or local models | Tenant-level default provider policy with per-employee override |
| **Channels** | Full-bidirectional per user | Bidirectional for T0/T1; sensitive ops always surface on the Sentura dashboard |
