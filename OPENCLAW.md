# OpenClaw — Technical Reference Document

> **Version analyzed:** `2026.4.4` (package.json)
> **License:** MIT (Copyright 2025 Peter Steinberger)
> **Repository:** `github.com/openclaw/openclaw`
> **Runtime:** Node.js 22.12+ (24 recommended)
> **Language:** TypeScript (ESM, strict mode, ES2023 target)
> **Package manager:** pnpm 10.32.1

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

**OpenClaw** is an open-source, self-hosted **personal AI assistant** platform. It operates as a **multi-channel AI gateway** that receives messages from 22+ messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Matrix, MS Teams, IRC, etc.), routes them through configurable AI providers (OpenAI, Anthropic, Ollama, vLLM, 40+ providers), and delivers responses back to the originating channel.

The product philosophy is **"the assistant, not the gateway."** The gateway is the control plane; the user experience is a personal AI assistant that lives across all your communication channels, runs on your own hardware, and supports voice, canvas rendering, browser automation, scheduled tasks, and multi-agent coordination.

### Core Capabilities

- **22+ messaging channels** with unified conversation model
- **40+ AI provider integrations** (cloud APIs + local inference)
- **Agent tool system** with 30+ built-in tools (browser, canvas, cron, exec, file system, image generation, web search/fetch, session coordination)
- **Subagent spawning** with depth limits and isolated sessions
- **Cron scheduler** for persistent scheduled agent runs
- **Memory system** with LanceDB vector embeddings and dreaming/consolidation
- **Voice pipeline** (Wake Word, Talk Mode, TTS/STT on macOS/iOS/Android)
- **Live Canvas** with A2UI (agent-driven visual workspace)
- **MCP loopback server** for tool protocol interop
- **Plugin SDK** with 86 bundled extensions
- **Control UI** (web dashboard) + **WebChat** interface
- **Native apps** for macOS, iOS, and Android
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

```
openclaw/
├── openclaw.mjs              # CLI entry (bin wrapper, Node version check)
├── package.json               # v2026.4.4, 86 plugin-sdk exports, 200+ scripts
├── tsconfig.json              # ESM, NodeNext, strict, ES2023
├── Dockerfile                 # Multi-stage Node 24 bookworm build
├── docker-compose.yml         # Gateway + CLI services
├── render.yaml                # Render.com deployment config
├── openclaw.podman.env        # Podman environment template
│
├── src/                       # Core TypeScript source (93 top-level entries)
│   ├── entry.ts               # CLI entry point (respawn, profile, container target)
│   ├── index.ts               # Library re-exports for programmatic use
│   ├── agents/                # Agent tools factory, subagent control, tool types
│   ├── gateway/               # HTTP + WS server, protocol schemas, methods
│   ├── config/                # Config loader, JSON5 I/O, Zod schemas, session store
│   ├── infra/                 # Platform infra (root resolution, env, updates, TLS, etc.)
│   ├── channels/              # Channel plugin types, web channel, plugin contracts
│   ├── plugin-sdk/            # Stable public API surface for extensions (342 files)
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
│   ├── memory-host-sdk/       # Memory engine host interface
│   ├── mcp/                   # MCP loopback server
│   ├── hooks/                 # Lifecycle hooks (before_prompt_build, etc.)
│   ├── flows/                 # Agent flow definitions
│   ├── routing/               # Message routing logic
│   ├── tasks/                 # Task management
│   ├── canvas-host/           # Canvas A2UI host
│   ├── terminal/              # Terminal/PTY management
│   ├── pairing/               # Device pairing protocol
│   ├── shared/                # Shared utilities (70 files)
│   ├── utils/                 # General utilities
│   ├── logging/               # Structured logging (tslog)
│   ├── types/                 # Shared type definitions
│   ├── wizard/                # Setup wizard
│   └── ...
│
├── extensions/                # 86 plugin extensions
│   ├── slack/                 # Channel: Slack (defineChannelPluginEntry)
│   ├── telegram/              # Channel: Telegram
│   ├── whatsapp/              # Channel: WhatsApp
│   ├── openai/                # Provider: OpenAI (definePluginEntry)
│   ├── anthropic/             # Provider: Anthropic/Claude
│   ├── ollama/                # Provider: Ollama (local)
│   ├── memory-core/           # Memory: Core memory engine
│   ├── memory-lancedb/        # Memory: LanceDB vector store
│   ├── browser/               # Tool: Browser automation (Playwright)
│   ├── acpx/                  # Tool: ACP runtime + MCP servers
│   └── ... (86 total)
│
├── ui/                        # Control UI (Vite + Lit web components)
│   ├── package.json           # "openclaw-control-ui"
│   ├── src/
│   │   ├── main.ts            # UI entry
│   │   ├── ui/                # App shell, views, controllers, gateway client
│   │   ├── i18n/              # Internationalization (en, de, es, zh-CN, zh-TW, pt-BR)
│   │   └── styles/            # CSS modules
│   └── vite.config.ts
│
├── apps/                      # Native companion apps
│   ├── macos/                 # macOS menu bar app (Swift)
│   ├── ios/                   # iOS app (Swift, xcodegen)
│   ├── android/               # Android app (Kotlin, Gradle)
│   └── shared/OpenClawKit/    # Shared Swift kit (protocol, Canvas, Talk, pairing)
│
├── skills/                    # Bundled skill definitions
├── docs/                      # Documentation (700+ files, English + zh-CN)
├── scripts/                   # Build, release, CI, deployment scripts
├── test/                      # Integration/architecture tests
└── git-hooks/                 # Pre-commit hooks
```

---

## 4. Entry Points & Bootstrap

### CLI Bootstrap Chain

```
openclaw (bin) → openclaw.mjs → dist/entry.js → src/entry.ts
```

**`openclaw.mjs`** (181 lines):
- Validates Node.js version (>=22.12)
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

### Plugin SDK (`src/plugin-sdk/`)

The plugin SDK is the **stable public API** for extensions. It exposes 100+ sub-path exports from `package.json`:

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

### Memory Host SDK (`src/memory-host-sdk/`)

Host interface for memory engines:
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
| `hono` | 4.12.10 | HTTP framework (gateway) |
| `ws` | ^8.20.0 | WebSocket server |
| `commander` | ^14.0.3 | CLI framework |
| `zod` | ^4.3.6 | Schema validation |
| `@sinclair/typebox` | 0.34.49 | JSON Schema types |
| `ajv` | ^8.18.0 | JSON Schema validation |
| `@modelcontextprotocol/sdk` | 1.29.0 | MCP protocol support |
| `@mariozechner/pi-agent-core` | 0.65.0 | Agent runtime core |
| `@mariozechner/pi-tui` | 0.65.0 | Terminal UI framework |
| `@agentclientprotocol/sdk` | 0.18.0 | ACP protocol support |
| `matrix-js-sdk` | 41.3.0 | Matrix protocol |
| `playwright-core` | 1.59.1 | Browser automation |
| `sharp` | ^0.34.5 | Image processing |
| `pdfjs-dist` | ^5.6.205 | PDF processing |
| `sqlite-vec` | 0.1.9 | Vector similarity (SQLite) |
| `markdown-it` | ^14.1.1 | Markdown parsing |
| `@line/bot-sdk` | ^10.6.0 | LINE API |
| `croner` | ^10.0.1 | Cron expression parser |
| `chokidar` | ^5.0.0 | File watching |
| `dotenv` | ^17.4.0 | Environment variables |
| `yaml` | ^2.8.3 | YAML parsing |
| `undici` | ^8.0.0 | HTTP client |
| `tslog` | ^4.10.2 | Structured logging |
| `lit` | ^3.3.2 | Web components (UI) |
| `vitest` | ^4.1.2 | Test runner |
| `typescript` | ^6.0.2 | TypeScript compiler |
| `tsdown` | 0.21.7 | Build tool |
| `oxlint` | ^1.58.0 | Linter |
| `oxfmt` | 0.43.0 | Formatter |

---

## 23. Relevance to Sentura

OpenClaw represents a production-grade reference implementation for several Sentura subsystems:

### Architectural Patterns to Study

| OpenClaw Feature | Sentura Equivalent |
|-----------------|-------------------|
| Multi-channel gateway | `packages/communication/` (Slack, Teams, Notion) |
| Plugin SDK + extension system | `packages/integrations/` MCP server architecture |
| Agent tool registration | `packages/runtime/` LangGraph tool binding |
| Session management | `packages/memory/` per-employee sessions |
| Config-driven behavior | `config/sectors/` YAML-driven sector config |
| Cron scheduler | `packages/orchestration/` scheduled agent runs |
| Security/tool policy | `packages/safety/` guardrails and circuit breakers |
| Device pairing | Could inform Sentura's enterprise device enrollment |
| Gateway RPC protocol | Could inform Sentura's FastAPI WebSocket protocol |

### Key Differences from Sentura

| Aspect | OpenClaw | Sentura |
|--------|----------|---------|
| **Scope** | Personal assistant (single user) | Enterprise AI employees (multi-tenant) |
| **Runtime** | Node.js / TypeScript | Python / FastAPI / LangGraph |
| **Deployment** | User device / Docker | On-premise enterprise datacenter |
| **LLM access** | Direct provider APIs + local | LiteLLM gateway → Ollama/vLLM only in prod |
| **Data store** | File-based (JSON, SQLite-vec) | PostgreSQL + Neo4j + pgvector + Redis |
| **Safety** | Tool denylists, owner-only | NeMo Guardrails, HITL, circuit breakers |
| **Auth** | Token + pairing | RBAC + MFA + PII tiers (T0-T4) |
| **Multi-agent** | Subagent spawning | Orchestration (Mode B), incubation pipeline |
| **Channels** | 22+ messaging (notification + response) | Slack/Teams/Notion (notification only, dashboard for actions) |

### What Sentura Can Learn

1. **Plugin SDK design** — OpenClaw's 100+ sub-path exports with typed contracts is a mature pattern for extensibility
2. **Channel abstraction** — The `ChannelPlugin` interface with adapters (config, setup, pairing, security, outbound) is a clean separation
3. **Gateway protocol** — Typed JSON-RPC over WebSocket with Ajv validation and codegen to Swift is robust
4. **Config schema composition** — Each plugin contributing its own `configSchema` merged into a unified schema
5. **Tool policy enforcement** — Layered security (denylists, owner-only, approval workflows) before tool execution
6. **Memory architecture** — Separate memory engine (core) from storage (LanceDB) with a host SDK interface
7. **Native app strategy** — Shared protocol types codegen'd across platforms (TypeScript → Swift → Kotlin)
