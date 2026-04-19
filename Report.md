# OpenClaw Technical Analysis & Sentura Integration Evaluation Report

> **Prepared for:** Sentura Platform Engineering Team
> **Date:** April 11, 2026
> **OpenClaw Version Analyzed:** `2026.4.4`
> **License:** MIT (Copyright 2025 Peter Steinberger)
> **Runtime:** Node.js 22.14+ (24 recommended), TypeScript (ESM, strict mode, ES2023)

---

## Table of Contents

### Part I — OpenClaw Technical Analysis

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Gateway Server — The Control Plane](#3-gateway-server--the-control-plane)
4. [Agent System — Tool Factory & Execution Model](#4-agent-system--tool-factory--execution-model)
5. [Plugin SDK & Extension System](#5-plugin-sdk--extension-system)
6. [Messaging Channel Architecture](#6-messaging-channel-architecture)
7. [AI Provider Architecture](#7-ai-provider-architecture)
8. [Configuration System](#8-configuration-system)
9. [Session & State Management](#9-session--state-management)
10. [Security Model](#10-security-model)
11. [Memory System](#11-memory-system)
12. [Cron Scheduler](#12-cron-scheduler)
13. [CLI, TUI & Web Control UI](#13-cli-tui--web-control-ui)
14. [Deployment & Packaging](#14-deployment--packaging)
15. [Testing Infrastructure](#15-testing-infrastructure)
16. [Dependency Analysis](#16-dependency-analysis)

### Part II — Sentura Platform Integration Evaluation

17. [Integration Strategy Overview](#17-integration-strategy-overview)
18. [Architectural Alignment — What OpenClaw Provides](#18-architectural-alignment--what-openclaw-provides)
19. [Gap Analysis — What Sentura Must Build](#19-gap-analysis--what-sentura-must-build)
20. [Extension Integration Points](#20-extension-integration-points)
21. [Risk Assessment & Mitigations](#21-risk-assessment--mitigations)
22. [Recommendation & Verdict](#22-recommendation--verdict)

---

# Part I — OpenClaw Technical Analysis

## 1. Executive Summary

OpenClaw is an open-source, self-hosted **multi-channel AI assistant platform** that operates as a single-process gateway routing messages across 22+ messaging platforms through configurable AI providers. It is not merely an API wrapper — it is a full-stack product with native applications, a web control UI, terminal UI, cron scheduling, browser automation, vector memory, and a mature plugin SDK with 86 bundled extensions.

The product philosophy is **"the assistant, not the gateway."** The gateway is the control plane; the user experience is a personal AI assistant that lives across all communication channels, runs on your own hardware, and supports voice, canvas rendering, browser automation, scheduled tasks, and multi-agent coordination.

### Core Capabilities at a Glance

| Capability | Scope |
|-----------|-------|
| Messaging Channels | 22+ (WhatsApp, Telegram, Slack, Discord, Signal, Teams, Matrix, IRC, etc.) |
| AI Providers | 40+ (OpenAI, Anthropic, Google, Ollama, vLLM, SGLang, DeepSeek, 30+ more) |
| Built-in Agent Tools | 30+ (browser, canvas, cron, exec, fs, image gen, web search/fetch, sessions, subagents) |
| Plugin Extensions | 86 bundled (channels, providers, speech, search, tools, infrastructure) |
| Memory | LanceDB vector embeddings + SQLite-vec hybrid with dreaming/consolidation |
| Voice Pipeline | Wake word, Talk Mode, TTS/STT (macOS, iOS, Android) |
| Native Apps | macOS (Swift), iOS (Swift), Android (Kotlin) |
| Web UI | Lit web components (Control UI) + embedded WebChat |
| Deployment | npm, Docker, Podman, Render, Kubernetes, from source |

### Key Technical Metrics

| Metric | Value |
|--------|-------|
| Source files (core `src/`) | 93 top-level modules, 342 files in plugin-sdk |
| Extensions directory | 86 extensions |
| Documentation files | 700+ (English + zh-CN) |
| Package exports | 100+ sub-path exports in `package.json` |
| Test configurations | 15+ Vitest configs (unit, integration, E2E, live, performance) |
| Package manager | pnpm 10.32.1 |
| Build tooling | tsdown / Vite |
| Linting | oxlint + oxfmt |

---

## 2. System Architecture

### High-Level Architecture

OpenClaw operates as a **single Node.js process** serving all functions: HTTP API, WebSocket RPC, channel adapters, agent execution, cron scheduling, and static UI assets. This monolithic-in-process design simplifies deployment while maintaining internal modularity through the plugin system.

```
┌─────────────────────────────────────────────────────────┐
│                     CLI (Commander)                     │
│  entry.ts → run-main.ts → build-program.ts              │
│  Commands: gateway, agent, message, tui, onboard, ...   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   Gateway Server                        │
│  HTTP (Hono) + WebSocket JSON-RPC + SSE Events          │
│  Port: 18789 (default) + 18790 (Control UI)             │
│                                                         │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────────┐    │
│  │ Config RPC  │ │ Session RPC│ │ Agent RPC        │    │
│  │ config.*    │ │ sessions.* │ │ agent, chat.*    │    │
│  └─────────────┘ └────────────┘ └──────────────────┘    │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────────┐    │
│  │ Cron RPC    │ │ Plugin RPC │ │ Exec Approval    │    │
│  │ cron.*      │ │ plugin.*   │ │ exec.approval.*  │    │
│  └─────────────┘ └────────────┘ └──────────────────┘    │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────────┐    │
│  │ Skills RPC  │ │ Models RPC │ │ Device Pairing   │    │
│  │ skills.*    │ │ models.*   │ │ device.pair.*    │    │
│  └─────────────┘ └────────────┘ └──────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Channel Plugin Loaders + MCP Loopback Server    │    │
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
│              State Layer (Disk)                │
│  Sessions │ Config │ Secrets │ Cron │ Memory   │
│  $OPENCLAW_STATE_DIR (~/.openclaw by default)  │
└────────────────────────────────────────────────┘
```

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Single-process gateway** | All channels, agents, cron, and UI served from one Node.js process |
| **Plugin-first** | Channels and providers are extensions, not hardcoded — 86 bundled extensions |
| **Config-driven** | JSON5 config with JSON Schema + Zod validation, hot-patchable via gateway RPC |
| **File-based state** | No external database required; SQLite-vec for embeddings, JSON/JSONL for sessions |
| **Secure by default** | DM pairing, tool denylists on HTTP, owner-only tools, SSRF guards |

### Directory Structure

```
openclaw/
├── openclaw.mjs              # CLI entry (bin wrapper, Node version check)
├── package.json               # v2026.4.4, 86 plugin-sdk exports, 200+ scripts
├── tsconfig.json              # ESM, NodeNext, strict, ES2023
├── Dockerfile                 # Multi-stage Node 24 bookworm build
├── docker-compose.yml         # Gateway + CLI services
│
├── src/                       # Core TypeScript source (93 top-level entries)
│   ├── entry.ts               # CLI entry point
│   ├── index.ts               # Library re-exports for programmatic use
│   ├── agents/                # Agent tools factory, subagent control
│   ├── gateway/               # HTTP + WS server, protocol schemas, RPC methods
│   ├── config/                # Config loader, JSON5 I/O, Zod schemas
│   ├── plugin-sdk/            # Stable public API surface (342 files)
│   ├── plugins/               # Plugin runtime, registry, tool resolution
│   ├── channels/              # Channel plugin types, web channel
│   ├── sessions/              # Session lifecycle, transcript, persistence
│   ├── security/              # Tool policy, dangerous tools, audit
│   ├── secrets/               # Secret storage, auth store, provider credentials
│   ├── cron/                  # Cron scheduler service
│   ├── memory-host-sdk/       # Memory engine host interface
│   ├── mcp/                   # MCP loopback server
│   ├── hooks/                 # Lifecycle hooks (before_prompt_build, etc.)
│   ├── cli/                   # Commander program, subcommands
│   ├── tui/                   # Terminal UI (pi-tui integration)
│   ├── media/                 # Media handling (images, audio, video)
│   ├── image-generation/      # Image generation tool + provider dispatch
│   └── shared/                # Shared utilities (70 files)
│
├── extensions/                # 86 plugin extensions
│   ├── slack/                 # Channel: Slack
│   ├── telegram/              # Channel: Telegram
│   ├── openai/                # Provider: OpenAI
│   ├── anthropic/             # Provider: Anthropic
│   ├── browser/               # Tool: Browser automation (Playwright)
│   ├── acpx/                  # Tool: ACP runtime + MCP servers
│   ├── memory-core/           # Memory: Core engine
│   ├── memory-lancedb/        # Memory: LanceDB vector store
│   └── ... (86 total)
│
├── ui/                        # Control UI (Vite + Lit web components)
├── apps/                      # Native apps (macOS, iOS, Android)
├── skills/                    # Bundled skill definitions
├── docs/                      # Documentation (700+ files)
├── scripts/                   # Build, release, CI, deployment
└── test/                      # Integration/architecture tests
```

---

## 3. Gateway Server — The Control Plane

The gateway is the heart of OpenClaw — a long-lived HTTP + WebSocket server that serves as the control plane for the entire system. Every interaction with OpenClaw — whether from a CLI command, a Slack message, a dashboard click, or a native app — flows through the gateway.

### Bootstrap Chain

```
openclaw (bin) → openclaw.mjs → dist/entry.js → src/entry.ts
  → src/cli/run-main.ts → runCli(argv)
    → src/gateway/server.ts → startGatewayServer()
      → src/gateway/server.impl.ts (full implementation)
```

**Key bootstrap files:**

| File | Responsibility |
|------|---------------|
| `openclaw.mjs` (181 lines) | Node.js version check (>=22.14), compile cache, fast-path `--help`, entry import |
| `src/entry.ts` (214 lines) | Process title, warning filter, env normalization, CLI respawning, profile/dev/container flags |
| `src/gateway/server.ts` | Thin facade — lazy-imports `server.impl.js`, exports `startGatewayServer` |
| `src/gateway/server.impl.ts` | Full orchestration: config load, secrets, plugin runtime, channel manager, cron, WS attachment, MCP loopback, model catalog, subagent registry |

### HTTP Layer (Hono)

The HTTP surface is built on **Hono** and serves multiple purposes:

| Endpoint | Purpose |
|----------|---------|
| `GET /healthz` | Health check (Docker/k8s readiness) |
| `GET /readyz` | Readiness probe |
| `POST /tools/invoke` | HTTP tool invocation (with denylist enforcement) |
| `GET /pair` | Device pairing endpoint |
| `GET /v1/chat/completions` | OpenAI-compatible API surface |
| Plugin HTTP routes | Per-channel webhook receivers (Slack events, Telegram updates, etc.) |
| Static assets | Control UI + WebChat files |

### WebSocket JSON-RPC Protocol

The gateway exposes a **typed RPC protocol over WebSocket** with a custom frame format (not JSON-RPC 2.0):

**Request frame:** `{ type: "req", id: string, method: string, params: object }`
**Response frame:** `{ type: "res", id: string, ok: boolean, payload: object, error?: object }`
**Event frame:** `{ type: "event", event: string, payload: object }`

**Connection handshake:**
1. Server sends `connect.challenge` event with a `nonce`
2. Client responds with `connect` request containing `ConnectParams` (protocol version, client ID, auth token, role, scopes)
3. Server validates and returns `HelloOk` payload

**RPC method domains:**

| Domain | Methods | Purpose |
|--------|---------|---------|
| `config.*` | get, apply, patch, revert, schema | Configuration CRUD with optimistic concurrency |
| `sessions.*` | list, get, transcript, compact, reset, delete, create | Session management |
| `chat.*` | send, abort, history | Real-time chat interaction |
| `cron.*` | list, add, update, remove, run | Scheduled job management |
| `agent` | invoke | Direct agent invocation |
| `exec.approval.*` | list, resolve, requested, resolved | Execution approval workflow |
| `plugin.approval.*` | list, resolve, requested, resolved | Plugin-specific approvals |
| `skills.*` | list, install, enable, disable | Skill management |
| `models.*` | list | Model discovery |
| `tools.*` | catalog | Tool enumeration |
| `device.pair.*` | start, approve | Device pairing protocol |
| `wizard.*` | step operations | Setup wizard |

**RPC method registration architecture:**

The method registry uses flat composition — `src/gateway/server-methods.ts` exports `coreGatewayHandlers` which merges handler objects from domain-specific files. Plugins contribute additional methods via `extraHandlers`. The `handleGatewayRequest` function applies role/scope authorization (`role-policy.ts`, `method-scopes.ts`) and rate limiting for write operations before dispatching to the merged handler map.

### Protocol Codegen

The protocol is defined in `src/gateway/protocol/index.ts` with full TypeScript types and Ajv-validated schemas. It is also codegen'd to:
- **Swift** (`GatewayModels.swift`) for native macOS/iOS apps
- **JSON Schema** (`dist/protocol.schema.json`) for external clients

---

## 4. Agent System — Tool Factory & Execution Model

### Architecture

The agent runtime is built on **`@mariozechner/pi-agent-core`** (v0.65.0), which provides the core agent execution loop, tool calling protocol, and streaming infrastructure. OpenClaw wraps this with its own tool factory and registration system.

### Tool Factory

`src/agents/openclaw-tools.ts` exports `createOpenClawTools(options)` — the central factory that assembles the complete tool set for an agent run:

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
| `web_search` | Search the web (provider-dispatched) |
| `web_fetch` | Fetch web page content |
| `image_generation` | Generate images (provider-dispatched) |
| `pdf` | PDF processing |
| `message` | Send messages to channels |

### Tool Registration Model (Three-Tier)

1. **Core tools** — Explicit `createXTool({ ... })` calls in `openclaw-tools.ts`
2. **Plugin tools** — `resolveOpenClawPluginToolsForOptions({ context, existingToolNames, toolAllowlist })` loads from the runtime plugin registry
3. **Extension tools** — Registered at plugin init via `api.registerTool(factory)`

### Tool Execution Pipeline

Tools implement `execute(toolCallId, args)` returning structured results. The execution pipeline includes:

```
Agent LLM generates tool call
  → Pre-execution hooks (runBeforeToolCallHook)
  → Tool loop detection (prevents infinite tool chains)
  → Owner-only policy enforcement
  → HTTP tool invoke denylist check (for POST /tools/invoke)
  → Tool.execute(toolCallId, args)
  → Structured result (jsonResult, textResult, etc.)
  → Post-execution hooks
  → Result fed back to LLM
```

### Tool Access Control

| Mechanism | Description |
|-----------|------------|
| `tools.profile` | Named profiles (`minimal`, `standard`, `full`) defining base tool sets |
| `tools.alsoAllow` | Whitelist additional tools beyond the profile |
| `tools.deny` | Blacklist specific tools |
| Owner-only tools | `exec`, `gateway` marked `ownerOnly` — restricted to device owner |
| HTTP denylist | `DEFAULT_GATEWAY_HTTP_TOOL_DENY` blocks dangerous tools on HTTP API |

### Subagent System

The subagent system enables multi-agent coordination within a single gateway:

- **`sessions_spawn`** creates isolated agent runs with configurable runtime (`subagent` / `acp`)
- **`subagent-registry.ts`** provides a central registry with run records, persistence, lifecycle management, reconciliation, and timeouts
- The registry is initialized at gateway startup via `initSubagentRegistry`
- Depth limits prevent recursive spawn chains
- **`subagents`** tool provides `list`, `kill`, and `steer` operations for runtime control
- Each subagent gets its own session context and optional thinking mode

### Agent Context Assembly

The system prompt for each agent is assembled from workspace files. OpenClaw loads 8 hardcoded bootstrap files (`VALID_BOOTSTRAP_NAMES` in `src/agents/workspace.ts`):

```
AGENTS.md → SOUL.md → TOOLS.md → IDENTITY.md → USER.md →
HEARTBEAT.md → BOOTSTRAP.md → MEMORY.md
```

A hook system (`bootstrap-hooks.ts` → `applyBootstrapHookOverrides()`) fires `agent:bootstrap` events, allowing plugins to inject additional context into `context.bootstrapFiles`.

---

## 5. Plugin SDK & Extension System

### SDK Architecture

The Plugin SDK (`src/plugin-sdk/`) is the **stable public API surface** for all extensions. It exposes 100+ sub-path exports from `package.json`, organized by domain:

| SDK Sub-path | Purpose |
|-------------|---------|
| `openclaw/plugin-sdk` | Core SDK types and interfaces |
| `openclaw/plugin-sdk/core` | Fundamental primitives, channel contracts |
| `openclaw/plugin-sdk/runtime` | Runtime environment access |
| `openclaw/plugin-sdk/setup` | Plugin setup utilities |
| `openclaw/plugin-sdk/channel-*` (15+ paths) | Channel plugin contracts |
| `openclaw/plugin-sdk/provider-*` (12+ paths) | Provider registration |
| `openclaw/plugin-sdk/approval-*` (6 paths) | Approval workflow types |
| `openclaw/plugin-sdk/reply-*` (6 paths) | Reply pipeline |
| `openclaw/plugin-sdk/memory-*` (10+ paths) | Memory engine interface |
| `openclaw/plugin-sdk/browser-*` (4 paths) | Browser automation |
| `openclaw/plugin-sdk/config-*` (3 paths) | Config schema/runtime |
| `openclaw/plugin-sdk/security-*` | Security runtime |
| `openclaw/plugin-sdk/gateway-*` | Gateway runtime |
| `openclaw/plugin-sdk/testing` | Test utilities |

### Extension Entry Points

Extensions use one of two entry patterns:

**Standard plugin:**
```typescript
definePluginEntry({
  id: "my-plugin",
  register(api: OpenClawPluginApi) {
    api.registerTool(toolFactory);
    api.registerProvider(provider);
    api.registerGatewayMethod("my.method", handler, { scope: "operator" });
    api.registerService({ start, stop });
    api.registerCli(cliDefinition);
    api.on("before_tool_call", hookHandler);
  },
  reload() { /* hot-reload logic */ },
  securityAuditCollectors: [...],
});
```

**Channel plugin:**
```typescript
defineBundledChannelEntry({
  id: "slack",
  plugin: () => import("./api.js"),  // lazy-loaded
  secrets: [...],
  runtime: setSlackRuntime,
});
```

### Extension Manifest (`openclaw.plugin.json`)

Each extension declares capabilities via a JSON manifest:

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
    "tools": [...]
  },
  "providerAuthEnvVars": { ... },
  "cliBackends": [...],
  "skills": ["./skills"],
  "kind": "memory"
}
```

**Role detection** (no explicit `type` field — inferred from keys):
- `"channels"` → messaging channel plugin
- `"providers"` → AI model provider
- `"kind": "memory"` → memory backend
- `"contracts"` → capability registration (tools, search, speech, etc.)
- `"skills"` → skill pack

### Extension Loading Pipeline

1. **Discovery** — `src/plugins/loader.ts` scans extension directories, reads manifests
2. **SDK alias resolution** — `sdk-alias.ts` maps `openclaw/plugin-sdk/*` imports to resolved paths
3. **Jiti loading** — Extensions are loaded via Jiti for TypeScript transpilation at runtime
4. **API construction** — `buildPluginApi()` creates a typed `OpenClawPluginApi` instance per extension
5. **Registration** — Extension's `register(api)` is called, registering tools, providers, hooks, methods
6. **Runtime assembly** — `createPluginRuntime()` returns lazy facades: `agent`, `channel`, `config`, `tts`, media, tasks

### `OpenClawPluginApi` — The Registration Surface

| Method | What It Registers |
|--------|-------------------|
| `registerTool(factory)` | Agent-facing tool |
| `registerProvider(plugin)` | AI model provider |
| `registerImageGenerationProvider(p)` | Image generation capability |
| `registerSpeechProvider(p)` | TTS/STT capability |
| `registerRealtimeVoiceProvider(p)` | Real-time voice capability |
| `registerMediaUnderstandingProvider(p)` | Vision/audio understanding |
| `registerWebSearchProvider(p)` | Web search capability |
| `registerGatewayMethod(name, handler, opts)` | Custom RPC method on the gateway |
| `registerHttpRoute(method, path, handler)` | Custom HTTP endpoint |
| `registerService({ start, stop })` | Long-running service with lifecycle |
| `registerCliBackend(backend)` | CLI subcommand |
| `registerMemoryCapability(config)` | Memory engine |
| `on(event, handler)` | Lifecycle hook subscription |

### Complete Extension Catalog (86 Extensions)

| Category | Count | Examples |
|----------|-------|---------|
| Messaging Channels | 22 | Slack, Telegram, WhatsApp, Discord, Teams, Signal, Matrix, IRC, etc. |
| AI Providers | 35 | OpenAI, Anthropic, Google, Ollama, vLLM, DeepSeek, Groq, xAI, etc. |
| Speech & Media | 4 | Deepgram, ElevenLabs, Fal, Microsoft Edge TTS |
| Web Search | 7 | Brave, DuckDuckGo, SearXNG, Exa, Firecrawl, Tavily, Perplexity |
| Tools & Skills | 8 | Browser (Playwright), ACPX, Diffs, LLM-Task, Lobster, OpenProse, OpenShell, Phone Control |
| Infrastructure | 7 | Device-pair, Diagnostics-OTel, Memory-core, Memory-LanceDB, Talk-voice, Thread-ownership, Voice-call |
| **Total** | **86** | |

---

## 6. Messaging Channel Architecture

### End-to-End Message Flow

```
Inbound message (webhook/WS/poll)
  → Channel Plugin (parse, normalize, extract sender/thread/content)
    → Routing (session key resolution, agent selection via bindings)
      → Agent execution (tool calls, LLM inference)
        → Reply pipeline (chunking, media attachment, markdown formatting)
          → Channel Plugin (format for channel, handle rate limits)
            → Outbound delivery (API call to channel)
```

### Channel Plugin Contract

Channel plugins implement the `ChannelPlugin` interface (via `createChatChannelPlugin` from the SDK):

```typescript
interface ChannelPlugin {
  id: string;
  meta: ChannelMeta;
  capabilities: ChannelCapabilities;
  config: ConfigAdapter;
  setup: SetupAdapter;
  pairing: PairingAdapter;
  security: SecurityAdapter;
  outbound: OutboundAdapter;
  gateway: GatewayAdapter;
  gatewayMethods?: Record<string, MethodHandler>;
  configSchema?: JSONSchema;
}
```

### Slack Extension — A Concrete Example

The Slack extension (`extensions/slack/`) demonstrates the channel plugin pattern:

1. **Entry** (`channel-entry.ts`): Uses `defineBundledChannelEntry` with lazy plugin loading
2. **Plugin assembly** (`src/channel.ts`): `createChatChannelPlugin` composes multiple adapters:
   - Setup wizard for Slack app installation
   - Allowlist/DM adapter for message filtering
   - Approval capability for Slack-based human approvals
   - Group mention + tool policy
   - Outbound session routing with thread key resolution
   - Directory adapter for workspace user/channel discovery
3. **Lazy loading**: Heavy modules (monitor, send, actions) use `createLazyRuntimeModule` to avoid loading on every bootstrap

### Supported Channels (22)

| Channel | Protocol | Key Feature |
|---------|----------|------------|
| WhatsApp | Baileys (WhatsApp Web) | E2E encrypted personal messaging |
| Telegram | Bot API | Groups, channels, inline queries |
| Slack | Bolt / Events API | Threads, rich blocks, approval buttons |
| Discord | Discord.js | Guilds, threads, embeds |
| MS Teams | Bot Framework | Enterprise SSO, adaptive cards |
| Signal | Signal Protocol | E2E encrypted, privacy-focused |
| Matrix | Matrix SDK (E2EE via WASM) | Federated, open standard |
| iMessage | AppleScript / BlueBubbles | Apple ecosystem |
| IRC | IRC Protocol | Legacy systems |
| Google Chat | Chat API | Google Workspace |
| LINE | Messaging API | Asia-Pacific markets |
| Feishu | Feishu/Lark API | Chinese enterprise market |
| Voice Call | Twilio/Telnyx/Plivo | PSTN telephone integration |
| WebChat | Built-in gateway WebSocket | Zero-config web interface |
| + 8 more | Various | Nostr, Twitch, QQ, Zalo, Mattermost, Nextcloud, Synology, Tlon |

---

## 7. AI Provider Architecture

### Provider Plugin Contract

Provider plugins register via `definePluginEntry` and expose a `ProviderPlugin` object:

```typescript
interface ProviderPlugin {
  id: string;
  label: string;
  auth: AuthConfig;
  resolveDynamicModel(modelId): ResolvedModel;
  normalizeResolvedModel(model): NormalizedModel;
  normalizeTransport(transport): NormalizedTransport;
  buildReplayPolicy(): ReplayPolicy;
  augmentModelCatalog(catalog): void;
  // stream hooks, error matching, etc.
}
```

### OpenAI Extension — A Concrete Example

The OpenAI extension (`extensions/openai/`) registers multiple capability providers:

| Registration | What It Provides |
|-------------|-----------------|
| `registerProvider` × 2 | OpenAI + OpenAI Codex text/chat providers |
| `registerImageGenerationProvider` | DALL-E image generation |
| `registerSpeechProvider` | OpenAI TTS |
| `registerRealtimeVoiceProvider` | OpenAI real-time voice |
| `registerRealtimeTranscriptionProvider` | Whisper transcription |
| `registerMediaUnderstandingProvider` × 2 | GPT-4V vision understanding |
| `registerVideoGenerationProvider` | Sora video generation |
| `registerCliBackend` | Codex CLI backend |

### Provider Categories

**Cloud providers (30+):** OpenAI, Anthropic, Google Gemini, Mistral, Groq, DeepSeek, xAI, Perplexity, Together, OpenRouter, NVIDIA, Amazon Bedrock, GitHub Copilot, HuggingFace, Venice, Cloudflare AI Gateway, Vercel AI Gateway, LiteLLM, Microsoft Foundry, Moonshot, Minimax, Qwen, Qianfan, StepFun, Volcengine, BytePlus, Chutes, and more.

**Local/self-hosted (3):** Ollama (auto-detection), vLLM, SGLang — all with custom endpoint configuration for on-premise deployment.

**Speech/TTS (4):** ElevenLabs, Deepgram, Microsoft Edge TTS, OpenAI.

**Web search (7):** Brave, DuckDuckGo, SearXNG, Exa, Firecrawl, Tavily, Perplexity.

---

## 8. Configuration System

### Design Philosophy

The configuration system is designed for **runtime flexibility**: changes can be applied without restarting the gateway, plugins contribute their own schemas, and all changes are conflict-checked via optimistic concurrency.

### Config Format & Storage

- **Primary format**: JSON5 (supports comments, trailing commas)
- **Location**: `$OPENCLAW_STATE_DIR/config.json5` (defaults to `~/.openclaw/openclaw.json`)
- **Environment variable** fallbacks for all settings
- **dotenv** support (`.env` files loaded at startup)
- **Runtime snapshots** for live state without file writes

### Schema & Validation

| Component | Technology | File |
|-----------|-----------|------|
| Runtime validation | Zod (v4.3.6) | `src/config/zod-schema*.ts` |
| JSON Schema (for UI forms) | TypeBox + Ajv | `src/config/schema.ts` |
| Plugin schema composition | JSON Schema merge | Each plugin's `openclaw.plugin.json` → `configSchema` |

### Hot-Patching via Gateway RPC

The `config.patch` RPC method implements **JSON Merge Patch** with OpenClaw-specific extensions:

1. Client reads current config with `config.get` → receives `{ hash, config }`
2. Client sends `config.patch` with the patch object and the base `hash`
3. Server validates the base hash matches current state (optimistic concurrency)
4. Server applies `applyMergePatch` (recursive merge with `mergeObjectArraysById` for id-keyed arrays)
5. Server validates the resulting config with `validateConfigObjectWithPlugins`
6. Server writes the file with atomic backup rotation
7. If the change requires restart (certain fields), a restart sentinel is set

### Config Domains

| Domain | What It Configures |
|--------|-------------------|
| Gateway | Port, bind address, auth, TLS, discovery |
| Providers | API keys, model routing, fallbacks, default model |
| Channels | Per-channel enable/disable, credentials, behavior |
| Agents | `agents.list[]` entries with model, tools, sandbox, runtime |
| Bindings | `bindings[]` routing channel messages to agents |
| MCP Servers | `mcp.servers` with command/args/env per named server |
| Cron | `cron.jobs[]` scheduled task definitions |
| Memory | Memory provider config, dreaming schedule |
| Security | Tool policies, approval settings, SSRF guards |
| Plugins | Each extension contributes its own schema section |

---

## 9. Session & State Management

### State Directory Layout

All persistent state lives under `$OPENCLAW_STATE_DIR` (defaults to `~/.openclaw`):

```
~/.openclaw/
├── openclaw.json              # Primary configuration (JSON5)
├── sessions/                  # Per-session transcript and state (JSONL)
├── secrets/                   # Encrypted credential store
├── cron/                      # Cron job definitions and state
├── memory/                    # Memory engine data (LanceDB tables)
├── plugins/                   # Plugin state
├── workspace/                 # Agent workspace directories
├── hooks/                     # Lifecycle hooks (managed hooks directory)
├── exec-approvals.json        # Execution approval persistence
├── logs/                      # Log files
└── .env                       # Environment variables (loaded by dotenv)
```

### Session Model

| Session Type | Description |
|-------------|-------------|
| **Main session** | Default conversation context |
| **Group sessions** | Per-channel/group isolated conversations |
| **Subagent sessions** | Spawned by tools, isolated execution context |

**Session key format:** `agent:<agentId>:<rest>` — the embedded `agentId` determines which agent handles the conversation.

**Session lifecycle:** `create` → `active` → `compact` (summarize) → `reset` (clear)

### Transcript Persistence

- Transcripts use **DAG/parentId** structure (not linear append)
- Messages appended via `SessionManager.appendMessage`
- Write locks and disk budgets prevent resource exhaustion
- Session pruning runs during maintenance cycles
- Delivery context tracks which channel/account a session belongs to

### Session Store Implementation

`src/config/sessions/store.ts` provides the session store with:
- Optimistic concurrency via serialized writes per store file
- Caching layer (`store-cache.ts`)
- Merge semantics for concurrent updates
- Maintenance operations (prune, rotate, archive)

---

## 10. Security Model

### Layered Security Architecture

OpenClaw implements security through multiple independent layers, each enforcing different aspects of access control:

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| **DM Pairing** | Channel messages require explicit pairing (`openclaw pairing approve`) | Channel access |
| **Gateway Auth** | Token-based authentication on WebSocket connect | Gateway access |
| **Role & Scope** | `role-policy.ts` + `method-scopes.ts` enforce per-RPC authorization | RPC access |
| **Owner-only tools** | Certain tools restricted to the device owner | Tool access |
| **HTTP tool denylist** | `DEFAULT_GATEWAY_HTTP_TOOL_DENY` blocks dangerous tools on HTTP API | Tool access |
| **Tool profiles** | `minimal` / `standard` / `full` + allow/deny lists per agent | Agent-level tool access |
| **Exec approvals** | `ExecApprovalManager` — human approval for dangerous operations | Operation-level |
| **SSRF guards** | `ssrf-policy` and `ssrf-runtime` SDK modules | Network access |
| **Path safety** | Directory traversal prevention | File access |
| **Safe regex** | Regex complexity limits | Input validation |
| **Sandbox mode** | `non-main` sandbox mandatory for AI employees | Agent isolation |
| **Audit logging** | Security events logged | Observability |
| **Skill scanning** | Skill content analysis before execution | Skill access |
| **Doctor command** | `openclaw doctor` audits risky configs, exposed ports, weak settings | Operational health |

### HTTP Tool Deny List

`src/security/dangerous-tools.ts` defines `DEFAULT_GATEWAY_HTTP_TOOL_DENY`:

```
exec, spawn, shell, fs_*, apply_patch, sessions_spawn,
sessions_send, cron, gateway, nodes, whatsapp_login, ...
```

These tools are blocked on `POST /tools/invoke` by default to prevent unauthorized callers from executing dangerous operations via the HTTP API.

### Exec Approval System

The approval system (`src/gateway/exec-approval-manager.ts`) provides:
- **Pending approval map** — tracks awaiting approvals with idempotent register/wait
- **Timeout policies** — approvals expire after configurable duration
- **Persistence** — `exec-approvals.json` survives gateway restarts
- **Security modes**: `deny` (block all), `allowlist` (explicit allow), `full` (require approval)
- **Ask modes**: `off`, `on-miss` (ask if not in allowlist), `always`
- **RPC surface**: `exec.approval.requested` → human reviews → `exec.approval.resolve`

---

## 11. Memory System

### Two-Extension Architecture

OpenClaw's memory system is split across two independent extensions that can operate separately or in parallel:

#### memory-core (`extensions/memory-core/`)

The **integrated memory engine** providing:
- Core memory tools: `memory_search`, `memory_get`
- SQLite-vec + FTS hybrid search
- Dreaming/consolidation cron for memory formation
- QMD (Query-Memory-Decide) cycle
- Memory scoring and relevance ranking
- Foundation model integration for narrative memory
- Built-in embedding provider adapters
- Status tracking and reporting

#### memory-lancedb (`extensions/memory-lancedb/`)

A **separate vector store** providing:
- LanceDB vector table (`memories`) for semantic similarity search
- Tools: `memory_recall`, `memory_store`, `memory_forget`
- OpenAI embeddings (configurable model + dimensions)
- Auto-recall on `before_agent_start` hook
- Auto-capture on `agent_end` hook
- Isolated npm runtime for native LanceDB dependency

### Memory Host SDK (`src/memory-host-sdk/`)

The host interface that memory plugins implement:

| SDK Module | Purpose |
|-----------|---------|
| `memory-core-engine-runtime` | Engine lifecycle management |
| `memory-core-host-engine-embeddings` | Embedding operations |
| `memory-core-host-engine-foundation` | Foundation model calls |
| `memory-core-host-engine-storage` | Persistence layer |
| `memory-core-host-query` | Semantic recall queries |
| `memory-core-host-secret` | Credential management |
| `memory-core-host-status` | Health reporting |
| `memory-core-host-multimodal` | Multimodal memory entries |

### Memory Query/Store Lifecycle (LanceDB Path)

```
Agent needs context → memory_recall(query)
  → Embed query text (OpenAI embeddings)
  → Vector similarity search in LanceDB
  → Return ranked results
  → Optionally prepend to agent context

Agent learns something → memory_store(content)
  → Embed content
  → Write vector + metadata to LanceDB table
  → Available for future recall

Periodic dreaming (cron) →
  → Consolidate episodic memory
  → Extract patterns and insights
  → Form narrative summaries
  → Prune low-relevance entries
```

---

## 12. Cron Scheduler

### CronService (`src/cron/service.ts`)

A persistent scheduler that runs agent tasks on configurable schedules:

| Feature | Implementation |
|---------|---------------|
| **Persistence** | Jobs survive gateway restarts |
| **Isolated execution** | Each job runs an isolated agent session |
| **Delivery context** | Jobs know which channel to reply to |
| **Wake/heartbeat** | Integration for sleeping gateways |
| **Expression parser** | `croner` (v10.0.1) for cron expression parsing |

**API surface:**
- `start()` / `stop()` — service lifecycle
- `list()` — enumerate jobs
- `add(job)` / `update(id, patch)` / `remove(id)` — CRUD
- `run(id)` / `enqueueRun(id)` — manual trigger
- `wake()` — process pending timers

**Gateway RPC:** `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`

---

## 13. CLI, TUI & Web Control UI

### CLI (Commander.js)

The CLI is built on Commander.js with modular command registration:

| Command | Purpose |
|---------|---------|
| `openclaw onboard` | Guided setup wizard |
| `openclaw gateway` | Start gateway server |
| `openclaw agent` | Run agent with a message |
| `openclaw tui` | Launch terminal UI |
| `openclaw config` | Configuration management |
| `openclaw status` / `health` / `doctor` | System health and audit |
| `openclaw sessions` / `channels` / `models` | Resource management |
| `openclaw plugins` / `skills` / `cron` | Extension management |
| `openclaw secrets` / `security` | Credential and security management |
| `openclaw update` | Self-update (stable/beta/dev channels) |

### Terminal UI (TUI)

Built on `@mariozechner/pi-tui` (v0.65.0):
- Interactive terminal chat with markdown rendering
- Session key resolution and management
- Theme support (light/dark)
- Slash commands and overlay system
- Gateway connection via `GatewayChatClient`

### Web Control UI

A separate Vite + Lit web application (`ui/` directory):

| Aspect | Technology |
|--------|-----------|
| Components | Lit web components (not React) |
| Bundler | Vite |
| Styling | CSS modules |
| Markdown | Marked + DOMPurify |
| State | Lit Signals |
| I18n | en, de, es, zh-CN, zh-TW, pt-BR |
| Tests | Playwright browser tests |

**UI views:** Chat, sessions, config editor, agents, skills, cron, logs, debug, overview, usage, channels, dreams, nodes.

Served automatically by the gateway at `http://localhost:18790`.

### Native Applications

| Platform | Technology | Status |
|----------|-----------|--------|
| macOS | Swift menu bar app | Production-ready |
| iOS | Swift (xcodegen, Xcode 16+) | "Super Alpha" |
| Android | Kotlin (Gradle) | "Extremely alpha" |

Shared Swift package (`OpenClawKit`) provides protocol types, Canvas A2UI, Talk pipeline, and device pairing across Apple platforms.

---

## 14. Deployment & Packaging

### Deployment Options

| Method | Target | Details |
|--------|--------|---------|
| npm global | Developer machines | `npm install -g openclaw@latest` → `openclaw onboard --install-daemon` |
| From source | Development | `pnpm install && pnpm ui:build && pnpm build && pnpm gateway:watch` |
| Docker | Production | Multi-stage Node 24 build, configurable extensions, Chromium optional |
| Podman | Production | Container definition + setup scripts |
| Render.com | Cloud PaaS | `render.yaml` with persistent disk |
| Kubernetes | Enterprise | Helm chart or raw manifests (community) |

### Docker Build

The Dockerfile supports several build args:
- `OPENCLAW_EXTENSIONS` — comma-separated list of extensions to include
- `OPENCLAW_VARIANT` — `default` or `slim`
- `OPENCLAW_INSTALL_BROWSER` — include Chromium for browser automation
- `OPENCLAW_INSTALL_DOCKER_CLI` — include Docker CLI for sandbox containers

### Release Channels

| Channel | Tag Format | npm Tag |
|---------|-----------|---------|
| stable | `vYYYY.M.D` | `latest` |
| beta | `vYYYY.M.D-beta.N` | `beta` |
| dev | HEAD of `main` | `dev` |

Switch via `openclaw update --channel stable|beta|dev`.

---

## 15. Testing Infrastructure

### Vitest Configuration Matrix

OpenClaw uses 15+ Vitest configurations organized by scope:

| Config | Scope |
|--------|-------|
| `vitest.config.ts` | Root aggregate |
| `vitest.gateway.config.ts` | Gateway server tests |
| `vitest.extensions.config.ts` | Extension tests |
| `vitest.channels.config.ts` | Channel tests |
| `vitest.e2e.config.ts` | End-to-end tests |
| `vitest.live.config.ts` | Live provider integration tests |
| `vitest.cron.config.ts` | Cron tests |
| `vitest.tooling.config.ts` | Tool tests |
| `vitest.performance-config.ts` | Performance benchmarks |
| `vitest.secrets.config.ts` | Secrets tests |
| `ui/vitest.config.ts` | UI unit tests |

### Test Types

| Type | Location | Technology |
|------|----------|-----------|
| Unit | Co-located `.test.ts` files | Vitest |
| Integration | `test/` directory | Vitest |
| E2E | Docker-based | `test:docker:*` scripts |
| Live | Against real providers | `test:live` |
| Browser | UI tests | Playwright |
| Architecture | Structural validation | `test/architecture-smells.test.ts` |
| Performance | Startup benchmarks | Vitest + custom profiling |

### Quality Tools

| Tool | Purpose |
|------|---------|
| oxlint | Linting |
| oxfmt | Formatting |
| Knip | Dead code detection |
| jscpd | Code duplication detection |
| prepush:ci.sh | Pre-push validation |

---

## 16. Dependency Analysis

### Critical Runtime Dependencies

| Dependency | Version | Purpose | Risk Level |
|------------|---------|---------|-----------|
| `hono` | 4.12.10 | HTTP framework (gateway) | Low — mature, minimal |
| `ws` | ^8.20.0 | WebSocket server | Low — standard Node.js WS |
| `commander` | ^14.0.3 | CLI framework | Low — stable, well-maintained |
| `zod` | ^4.3.6 | Runtime schema validation | Low — widely adopted |
| `@modelcontextprotocol/sdk` | 1.29.0 | MCP protocol | Medium — actively evolving standard |
| `@mariozechner/pi-agent-core` | 0.65.0 | Agent execution engine | **High** — single-maintainer, core dependency |
| `@mariozechner/pi-tui` | 0.65.0 | Terminal UI framework | Medium — TUI only |
| `@agentclientprotocol/sdk` | 0.18.0 | Agent-to-agent communication | Medium — early standard |
| `playwright-core` | 1.59.1 | Browser automation | Low — Microsoft-backed |
| `@lancedb/lancedb` | Latest | Vector database | Medium — relatively new |
| `sqlite-vec` | 0.1.9 | SQLite vector extension | Medium — niche dependency |
| `lit` | ^3.3.2 | Web components (UI) | Low — Google-backed |

### Build & Development Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `typescript` | ^6.0.2 | Type system |
| `tsdown` | 0.21.7 | Build tool |
| `vitest` | ^4.1.2 | Test runner |
| `oxlint` | ^1.58.0 | Linter |
| `oxfmt` | 0.43.0 | Formatter |
| `vite` | Latest | UI bundler |

---

# Part II — Sentura Platform Integration Evaluation

## 17. Integration Strategy Overview

Sentura's architecture places it as a **control plane layer** operating inside and on top of a single OpenClaw gateway process. This is not a fork or a wrapper — it is a set of extensions, skills, hooks, workspace conventions, and a dashboard that together transform OpenClaw from a personal AI assistant into an enterprise AI employee platform.

### Integration Model

```
┌─────────────────────────────────────────────────────────┐
│                    SENTURA LAYER                         │
│                                                         │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────┐ │
│  │ Meta-Agents  │  │ Extensions │  │ Dashboard        │ │
│  │ (Creator,    │  │ (audit,    │  │ (Next.js,        │ │
│  │  Tuner,      │  │  rbac,     │  │  connects via    │ │
│  │  Orchestr.)  │  │  approval, │  │  Gateway WS RPC) │ │
│  │              │  │  provisnr) │  │                  │ │
│  └──────┬───────┘  └──────┬─────┘  └────────┬─────────┘ │
│         │                 │                  │           │
│  ┌──────▼─────────────────▼──────────────────▼─────────┐ │
│  │               OPENCLAW GATEWAY                       │ │
│  │  (unchanged — all Sentura uses standard APIs)        │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key Integration Principle

**Zero OpenClaw core modifications.** Sentura extends OpenClaw exclusively through:
1. **Extensions** — registered via `definePluginEntry` and the Plugin SDK
2. **Skills** — SKILL.md files in agent workspaces
3. **Hooks** — managed hooks in `~/.openclaw/hooks/`
4. **Config patches** — via the `config.patch` RPC
5. **Workspace files** — the 8 native OpenClaw files (AGENTS.md with `§ Hard Rules`, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md with `§ Enterprise Context`, MEMORY.md), plus Sentura-specific `skills/`, `ekg/`, and `memory/users/` subdirectories
6. **Dashboard** — separate Next.js app connecting via Gateway WebSocket

---

## 18. Architectural Alignment — What OpenClaw Provides

### Capabilities Leveraged As-Is

| Sentura Need | OpenClaw Feature | Assessment |
|-------------|-----------------|------------|
| **Agent runtime** | pi-agent-core execution engine | Fully sufficient — tool calling, streaming, context assembly |
| **Channel delivery** | 22+ channel plugins | Fully sufficient — Slack, Teams, WhatsApp, Discord, etc. |
| **LLM flexibility** | 40+ provider plugins | Fully sufficient — cloud APIs + Ollama/vLLM for on-prem |
| **Browser automation** | Playwright browser extension | Fully sufficient for self-provisioning |
| **Config management** | JSON5 + Zod + hot-patching via RPC | Fully sufficient — `config.patch` is the primary control interface |
| **Memory** | LanceDB + SQLite-vec + dreaming | Sufficient as base — Sentura extends with EKG layer |
| **Cron scheduling** | CronService with isolated sessions | Fully sufficient for recurring agent tasks |
| **Secret storage** | Encrypted credential store | Fully sufficient — `$secret` references in config |
| **Tool system** | 30+ built-in tools + plugin tools | Fully sufficient — extensible via `api.registerTool()` |
| **Exec approval** | `exec.approval.*` workflow | Sufficient as primitive — Sentura adds context-aware layer |
| **MCP support** | `mcp.servers` config + loopback server | Sufficient as transport — Sentura generates MCP servers |
| **WebSocket protocol** | Typed JSON-RPC with auth, events, streaming | Fully sufficient — dashboard connects directly |
| **Plugin SDK** | 100+ sub-path exports, typed contracts | Fully sufficient — all Sentura extensions use it |

### Integration Quality Assessment

| Dimension | Score (1-5) | Notes |
|-----------|-------------|-------|
| API stability | 4/5 | Plugin SDK is a designated stable surface; some internal APIs less stable |
| Documentation | 3/5 | 700+ doc files but focused on end-user/dev use, not extension development guides |
| Extension points | 5/5 | Comprehensive: tools, providers, hooks, RPC methods, HTTP routes, services |
| Config extensibility | 5/5 | Plugins contribute their own JSON Schema, merged automatically |
| Testing support | 4/5 | Vitest utilities provided; plugin test examples in extensions |
| Type safety | 5/5 | Strict TypeScript with Zod + TypeBox runtime validation throughout |

---

## 19. Gap Analysis — What Sentura Must Build

### 17 Capabilities Absent from OpenClaw

The following capabilities have been verified absent from the OpenClaw codebase through direct source analysis:

#### Tier 1 — Core Enterprise Capabilities (Must-Have)

| # | Capability | Why OpenClaw Lacks It | Sentura Approach |
|---|-----------|----------------------|-----------------|
| 1 | **Enterprise data integration** | Zero enterprise connectors (no CRM, ERP, HRIS) | Build MCP servers from enterprise API docs |
| 2 | **Internal MCP server generation** | `mcp.servers` is manual JSON5 only | CLI tool + Data Scavenger Agent auto-generation |
| 3 | **Self-provisioning orchestration** | Browser tool exists but no registration workflow | Structured skills + approval chain + error recovery |
| 4 | **Position-specific safety guardrails** | Generic tool denylists; no role-scoped "hard rules" section | Add a `## Hard Rules (must not override)` section inside each agent's `AGENTS.md` (native file, top prompt priority) |
| 5 | **No-code employee creation** | `agents.create` takes structured params only | Creator Agent meta-agent with NL → config pipeline |
| 6 | **Incubation pipeline** | 8 generic workspace files | 5-phase pipeline: research → configure → provision → test → deploy |
| 8 | **Multi-tenancy** | Single-tenant (one user, one gateway, one config) | Tenant isolation via namespaced agents + RBAC extension |
| 9 | **Enterprise authentication** | Token + device pairing only | Dashboard SSO via SAML/OIDC proxy |

#### Tier 2 — Knowledge & Intelligence (Differentiator)

| # | Capability | Why OpenClaw Lacks It | Sentura Approach |
|---|-----------|----------------------|-----------------|
| 11 | **Enterprise Knowledge Graph (EKG)** | Unstructured LanceDB memory only | Per-agent `ekg/` with 4-pillar JSON5 ontology |
| 12 | **Data Scavenger Agent** | No document ingestion agent | Meta-agent for unstructured → structured knowledge |
| 13 | **Progressive knowledge accumulation** | No industry templates or gap detection | 3-tier model: ontology → Q&A → Experience Links |
| 17 | **Cross-agent knowledge aggregation** | Agents operate in isolated workspaces | AI Manager EKG with capability tags + conflict detection |

#### Tier 3 — Lifecycle & Operations (Enterprise-Ready)

| # | Capability | Why OpenClaw Lacks It | Sentura Approach |
|---|-----------|----------------------|-----------------|
| 7 | **Enterprise orchestration** | Basic subagent spawning only | Orchestrator meta-agent with task decomposition |
| 10 | **Cost management** | No per-agent cost tracking | Audit extension with per-agent LLM spend attribution |
| 14 | **Employee lifecycle management** | Create-and-run only | Versioning, cloning, health scoring, rollback, retirement |
| 15 | **Pre-deployment testing** | No test harness | Test runner with 6-dimension scoring + auto-tune |
| 16 | **Communication panel** | Single-pane developer chat | WhatsApp-style 1:1 + group chat in dashboard |

### Critical Architectural Discovery

**Agent config schema difference:** OpenClaw uses `agents.list[]` (array with `id` field), not `agents.entries.{id}` (object map). Identity comes from workspace SOUL.md/AGENTS.md, not a `systemPrompt` field. Tool access uses `tools.profile` + `tools.alsoAllow` / `tools.deny`, not `tools.allowlist`. Bindings and MCP servers are top-level config, not nested in agent entries.

**Workspace bootstrap:** OpenClaw hardcodes 8 valid bootstrap file names in `VALID_BOOTSTRAP_NAMES`. As of 2026-04-17 Sentura aligns with this contract exactly: position-specific hard rules live in a `## Hard Rules (must not override)` section inside `AGENTS.md`, and enterprise context lives in a `## Enterprise Context` section inside `BOOTSTRAP.md` — both native files, so both sit at the top of the prompt priority order. The `sentura-bootstrap` managed hook is narrowed to injecting per-user memory (`memory/users/MEMORY_USER_{token}.md`) for sessions that carry a resolvable `userToken`.

---

## 20. Extension Integration Points

### Sentura Extensions Built on OpenClaw Plugin SDK

| Extension | Registered Capabilities | Integration Points |
|-----------|------------------------|-------------------|
| **sentura-audit** | `before_tool_call`, `after_tool_call` hooks; `sentura.audit.query` RPC; `sentura_audit_query` tool | File-based JSONL with daily rotation, PII redaction, query filtering |
| **sentura-rbac** | `roles.list`, `users.*`, `departments.*`, `authorize`, `scope.employees` RPC methods; `sentura_rbac_manage` tool | 5-role model (platform_admin → end_user), maps to OpenClaw operator scopes |
| **sentura-approval** | `plugin.approval.*` integration; decision-context-aware routing | Layered on OpenClaw's exec.approval with escalation chains and timeout policies |
| **sentura-provisioner** | Service registration coordination; `api.registerTool()` for provisioning actions | Uses browser extension + secret store + approval system |

### Bootstrap Hook

The `sentura-bootstrap` hook (`sentura/hooks/sentura-bootstrap/`) listens for `agent:bootstrap` events and, when the session carries a resolvable `userToken`:
1. Reads `memory/users/MEMORY_USER_{token}.md` from the agent's workspace directory
2. Appends it to `context.bootstrapFiles` as additional per-user memory
3. Silently skips missing / empty files (safe for agents without per-user memory)

Hard Rules and Enterprise Context are **not** hook-injected — they live natively inside `AGENTS.md` and `BOOTSTRAP.md` respectively, so OpenClaw's system prompt assembler loads them at top priority.

Installed to `~/.openclaw/hooks/sentura-bootstrap/` and enabled via `hooks.internal.entries.sentura-bootstrap` in config.

### Meta-Agents

Sentura's three meta-agents are themselves OpenClaw agent configurations:

| Meta-Agent | ID | Key Tools | Purpose |
|-----------|-----|-----------|---------|
| **Creator (Forge)** | `creator` | `gateway` (config.patch), `browser`, `fs_write` | Build new AI employees from NL descriptions |
| **Tuner** | `tuner` | `gateway` (config.patch), `fs_write` | Modify employee config via NL commands |
| **Orchestrator** | `orchestrator` | `sessions_spawn`, `sessions_send`, `subagents` | Multi-agent task coordination |

### Dashboard Integration

The Sentura Dashboard (Next.js) connects to OpenClaw exclusively through the Gateway WebSocket RPC:

| Dashboard Feature | RPC Methods Used |
|------------------|-----------------|
| Employee roster | `config.get` → `agents.list` |
| Session management | `sessions.list`, `sessions.get`, `sessions.create` |
| Chat interface | `chat.send`, `chat.history`, `chat.abort` |
| Approvals | `exec.approval.list`, `exec.approval.resolve` |
| Agent configuration | `config.patch` (for agent config changes) |
| Real-time updates | WebSocket event subscription |
| Model discovery | `models.list` |
| Tool catalog | `tools.catalog` |

---

## 21. Risk Assessment & Mitigations

### Technical Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|------------|------------|
| **pi-agent-core single maintainer** | High | Medium | Core dependency (`@mariozechner/pi-agent-core` v0.65.0) has a single maintainer. If abandoned, Sentura would need to fork or replace the agent execution engine. | Monitor project health; maintain fork readiness; the MIT license permits this. |
| **OpenClaw breaking changes** | Medium | Medium | As a rapidly evolving project, OpenClaw may change internal APIs or config schema between versions. | Pin OpenClaw version; use only Plugin SDK stable surface; test against beta channel before upgrading. |
| **Single-process scalability** | Medium | Low-Medium | One Node.js process handling all channels, agents, and cron may hit CPU/memory limits under enterprise load. | Horizontal scaling via multiple gateway instances with shared state; OpenClaw's file-based state would need external coordination. |
| **LanceDB native dependency** | Low | Medium | `@lancedb/lancedb` requires native compilation; may fail on unusual platforms. | OpenClaw already handles this with isolated npm runtime installation; memory-core provides SQLite-vec fallback. |
| **Multi-tenancy retrofit** | High | High | OpenClaw is fundamentally single-tenant. Multi-tenancy requires careful namespacing of all resources (agents, sessions, config, secrets, memory). | Implement at Sentura extension layer via RBAC + agent ID prefixing + department scoping; avoid modifying OpenClaw core. |
| **Config size growth** | Medium | Medium | All agents, bindings, MCP servers, and cron jobs live in a single JSON5 config file. Enterprise deployments with 100+ agents could strain this. | Monitor config file size; implement config partitioning if needed; use `config.patch` (not `config.apply`) for incremental changes. |

### Operational Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Self-provisioning failures** | Medium | Structured error recovery in skills (CAPTCHA detection, 2FA handling, rate limit backoff); human escalation path |
| **LLM prompt leakage** | High | The `## Hard Rules` section inside `AGENTS.md` + tool denylists prevent agents from exposing system prompts; T0-T4 data classification enforced |
| **Browser automation exfiltration** | Medium | Sandbox mode; approval required for new account creation; audit logging of all browser actions |
| **Credential store compromise** | High | OpenClaw's encrypted secret store; never store credentials in workspace files or conversation history |

---

## 22. Recommendation & Verdict

### Overall Assessment

OpenClaw is a **strong foundation** for the Sentura platform. Its architecture directly addresses the most complex and time-consuming aspects of building an AI employee platform:

| Aspect | Assessment |
|--------|-----------|
| **Agent runtime** | Production-grade, battle-tested, no need to build |
| **Channel ecosystem** | 22+ channels eliminate months of integration work |
| **Provider ecosystem** | 40+ providers with unified interface |
| **Plugin SDK** | Mature, typed, comprehensive — ideal extension point |
| **Config system** | Hot-patchable, validated, conflict-detected — perfect for meta-agent control |
| **Security primitives** | Solid foundation (sandbox, approvals, denylists) — Sentura adds enterprise layers |

### What OpenClaw Saves

Building the equivalent of OpenClaw's core capabilities from scratch would require an estimated **18-24 months of engineering effort** for a team of 4:
- Multi-channel messaging adapters: ~6 months
- AI provider integrations: ~3 months
- Gateway server with typed RPC: ~3 months
- Agent execution engine with tool system: ~4 months
- Memory system with vector search: ~2 months
- Config system with validation: ~1 month
- Browser automation integration: ~1 month

### What Sentura Must Build

The 17 capabilities identified in the gap analysis represent the **enterprise value layer** — the differentiation that makes Sentura more than just another AI chatbot platform. These are estimated at **8 weeks of development** for a team of 4 (per the sprint plan in `docs/TeamPlan.md`).

### Build vs. Buy Decision

**Verdict: Build on OpenClaw.** The platform provides approximately 80% of the infrastructure required for Sentura's AI employee platform. The remaining 20% — enterprise management, knowledge graphs, lifecycle management, and multi-tenancy — is precisely the differentiated value that Sentura brings.

### Key Success Factors

1. **Never modify OpenClaw core.** All Sentura functionality must use the Plugin SDK, hooks, skills, and workspace files. This ensures clean upgrades and prevents divergence.

2. **Pin OpenClaw version.** Test against the beta channel before upgrading. Breaking changes in config schema or Plugin SDK would cascade through all Sentura components.

3. **Use `config.patch` exclusively.** The meta-agents (Creator, Tuner) must use `config.patch` with optimistic concurrency, never `config.apply` or direct file writes to the config.

4. **Leverage the typed protocol.** The Gateway WebSocket RPC is well-typed and Ajv-validated. The dashboard and all programmatic access should use this interface exclusively.

5. **Monitor pi-agent-core.** This single-maintainer dependency is the highest supply-chain risk. Maintain awareness of its development status and fork readiness.

---

*End of Report*
