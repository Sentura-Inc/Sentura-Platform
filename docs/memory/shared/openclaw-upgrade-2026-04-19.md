> **On-demand reference — not read by default.** Back-link: [`docs/MEMORY.md`](../../MEMORY.md).

# OpenClaw `2026.4.4` → `2026.4.19-beta.2` Upgrade — Structural Survey & Doc Re-sync

The user pulled a fresh OpenClaw checkout (replacing the prior `2026.4.4` working tree) and asked for a comprehensive re-sync of `README.md`, `docs/OPENCLAW.md`, `docs/DESIGN.md`, `docs/SETUP.md`, `docs/TESTS.md`, `docs/TeamPlan.md`, and `docs/MEMORY.md` to match the new runtime. This file captures the delta, the decisions made, and the follow-ups.

## Sessions in this file

| Date | Section | One-liner |
|------|---------|-----------|
| 2026-04-19 | [Structural survey](#2026-04-19--structural-survey-of-openclaw-20264-19-beta2) | Map every OpenClaw layout change that affects Sentura. |
| 2026-04-19 | [Docs re-sync](#2026-04-19--documentation-re-sync-across-7-files) | Apply the survey findings to the 7 doc files. |
| 2026-04-19 | [Sentura vitest config re-homed](#2026-04-19--sentura-vitest-config-re-homed-known-gap-closed) | Move `vitest.sentura.config.ts` into `openclaw/test/vitest/`, keep a pristine backup in `scripts/`. |

---

## 2026-04-19 — Structural survey of OpenClaw `2026.4.19-beta.2`

### Version metadata (from `openclaw/package.json` and `openclaw/pnpm-workspace.yaml`)

| Field | Old (`2026.4.4`) | New (`2026.4.19-beta.2`) |
|-------|------------------|--------------------------|
| Version | `2026.4.4` | `2026.4.19-beta.2` |
| Engines | `node >= 22.14.0` | `node >= 22.14.0` (README recommends **24**, minimum bumped to 22.16+ in practice) |
| Package manager | pnpm `10.32.1` | pnpm `10.33.0` |
| Workspaces | single root | pnpm monorepo: `.`, `ui`, `packages/*`, `extensions/*` |
| `@mariozechner/pi-agent-core` | `0.65.0` | `0.67.68` |
| `@agentclientprotocol/sdk` | `0.18.0` | `0.19.0` |
| `hono` | `4.12.10` | `4.12.14` (pinned via pnpm overrides) |

### New top-level layout

```
openclaw/
├── src/                    # unchanged — gateway, agents, config, mcp, … (all critical MCP loader paths intact)
├── extensions/             # 107 directories (up from 86); contains non-extension files too (tsconfig.package-boundary.*.json, shared/, *.live.test.ts)
├── packages/               # NEW workspace packages
│   ├── plugin-sdk/             # @openclaw/plugin-sdk — stable public API, internal workspace users link here
│   ├── memory-host-sdk/        # @openclaw/memory-host-sdk — memory engine host interface
│   └── plugin-package-contract/ # @openclaw/plugin-package-contract
├── apps/                   # NEW — native companion apps (macos/, ios/, android/, shared/)
├── Swabble/                # NEW — Swift package (shared Swift surface used by native apps)
├── ui/                     # still Lit/Vite Control UI, now also a workspace package
├── skills/                 # unchanged
├── test/vitest/            # NEW test infra layout — 20+ per-area vitest configs (vitest.agents.config.ts, vitest.channels.config.ts, vitest.mcp.config.ts, …)
└── openclaw.mjs            # CLI bin wrapper — still validates Node version, enables compile cache
```

### What did **not** change (critical for Sentura)

- `openclaw/src/agents/embedded-pi-mcp.ts` → still calls `normalizeConfiguredMcpServers(cfg.mcp?.servers)`.
- `openclaw/src/config/mcp-config.ts` → still reads `sourceConfig.mcp?.servers`.
- `openclaw/src/config/types.mcp.ts` → `McpConfig.servers: Record<string, McpServerConfig>`.
- Therefore **`mcp.servers.<name>` remains the one true config path**. The Round-16 alignment (2026-04-19) stands; no Sentura follow-up needed for MCP wiring on top of the version bump.
- `openclaw/src/agents/tools/owner-only-tools.ts`, `openclaw/src/agents/sandbox/workspace.ts`, `openclaw/src/agents/tool-catalog.ts`, `openclaw/src/agents/bash-tools.exec-runtime.ts` — all still present at the same paths that the Creator-Deployment Rounds 1–14 audit trail references.
- CLI commands: `pnpm openclaw onboard`, `pnpm gateway:watch`, `pnpm build`, `pnpm ui:build`, `pnpm openclaw doctor` — all still defined in `openclaw/package.json`.

### Plugin SDK — dual location, one public API

| Location | Package name | Who should import from here |
|----------|--------------|------------------------------|
| `openclaw/packages/plugin-sdk/` | `@openclaw/plugin-sdk` (private workspace package) | Internal OpenClaw workspace packages and bundled extensions (via pnpm workspace linking). |
| `openclaw/src/plugin-sdk/` → compiled to `openclaw/dist/plugin-sdk/` | Re-exported from the root `openclaw` package as subpath exports `./plugin-sdk/*` | **Sentura.** |

**Sentura rule (promoted to `.cursorrules` via `docs/OPENCLAW.md §7` and `docs/MEMORY.md` Current Ground Truth):** always import from `openclaw/plugin-sdk/...`. Never touch `openclaw/src/plugin-sdk/` or `openclaw/packages/plugin-sdk/src/` directly — those are build-time paths that change between versions.

### Extension count re-derivation

```bash
$ cd /Users/henry/Desktop/Sentura-Platform && ls -d openclaw/extensions/*/ | wc -l
107
```

Not all 107 directories are extensions — the directory also contains `tsconfig.package-boundary.base.json`, `tsconfig.package-boundary.paths.json`, a `shared/` helpers directory, and `music-generation-providers.live.test.ts` / `video-generation-providers.live.test.ts`. `docs/OPENCLAW.md §21` now calls this out and lists the extensions that were added since `2026.4.4` (best-effort — always re-derive from the directory).

### Provider count correction

Counted AI provider extensions directly. Result: **37+** (down from the historical "40+" figure that appeared in README.md and DESIGN.md — the old number was inflated). New entry includes Mistral, Groq, SGLang, Voyage, Alibaba, Amazon Bedrock Mantle, Arcee, Codex, Fireworks, LM Studio, Qwen, DeepSeek, Moonshot, Qianfan, Volcengine, xAI, etc. Docs updated to `37+` everywhere.

### Known gaps surfaced during the upgrade

1. **`scripts/vitest.sentura.config.ts` is broken under the new OpenClaw.** It imports `../openclaw/vitest.shared.config.ts`, which no longer exists — the new OpenClaw re-exports its root `vitest.config.ts` from `test/vitest/vitest.config.ts`. Documented in `docs/TESTS.md` under "Automated Unit Tests (Person D extensions)" as a known gap for Person A to repoint.

---

## 2026-04-19 — Documentation re-sync across 7 files

Applied the survey above to the seven files the user listed. Summary of edits:

### `README.md`

- Core Principles: `86 extensions, 40+ providers` → `107 bundled extensions, 37+ AI providers (as of OpenClaw 2026.4.19-beta.2)`.
- Plugin SDK description: added `@openclaw/plugin-sdk` package name and new location `openclaw/packages/plugin-sdk/`.
- Technology Stack: `Node.js 22+` → `Node.js 24 (recommended) or Node 22.16+`.
- Project Structure: rewrote OpenClaw subtree to show pnpm monorepo (`packages/`, `apps/`, `Swabble/`, `ui/`).
- What OpenClaw Provides: `40+ AI provider integrations` → `37+ AI provider integrations` (with examples incl. SGLang, Mistral, Groq).

### `docs/OPENCLAW.md`

- Header: version, runtime, language (adds Swift for Swabble), package manager (pnpm 10.33.0, monorepo workspaces), Plugin SDK sourcing rule.
- Core Capabilities: 37+ providers, 107 extensions, explicit `mcp.servers.<name>` for MCP loaders, native apps + `Swabble/`.
- §3 Directory Structure: monorepo layout with `packages/`, `apps/`, `Swabble/`, workspace `ui/`.
- `openclaw.mjs`: updated Node version guidance (24 recommended, 22.16+ supported).
- §7 Plugin SDK & Extension System: dual location table + Sentura import rule (always from `openclaw/plugin-sdk/...`).
- Memory Host SDK: new package location `packages/memory-host-sdk/`, per-entry exports (`./runtime`, `./engine`, …) listed.
- §21 Extension Catalog: 107 directory count, non-extension file callouts, list of new extensions since `2026.4.4`.
- §22 Key Dependencies: version table refreshed end-to-end from the new `package.json` (hono 4.12.14, pi-agent-core 0.67.68, pi-tui 0.67.68, acp-sdk 0.19.0, vitest 4.1.4, oxlint 1.60.0, tsdown 0.21.9, undici 8.1.0, dotenv 17.4.2, …).
- §23 Relevance to Sentura: rewritten to state clearly that OpenClaw **is** the Sentura runtime; added boundary rules (no `src/` imports, no forked OpenClaw core, all config changes via `config.patch`) and posture differences.

### `docs/DESIGN.md`

- TOC + section title: `40+ Providers` → `37+ Providers`.
- Block diagram banner: `40+ LLM PROVIDERS` → `37+ LLM PROVIDERS`.
- §8 intro: added explicit OpenClaw version pointer and a cross-link to `docs/OPENCLAW.md §21`.
- Provider table: `+25 more` → `+20 more` with named regional/specialized providers (Qwen, DeepSeek, Moonshot, Qianfan, Volcengine, xAI, …).
- No changes needed to §14 (MCP server pattern) — the Round-16 alignment still matches the new loader paths.

### `docs/SETUP.md`

- Prereq table: `Node.js 22.14+` → `Node.js 22.16+ (Node 24 recommended)`, `pnpm 10+` → `pnpm 10.33+`, with an explanatory blockquote about the OpenClaw `engines` field and the `@openclaw/plugin-sdk` workspace package.
- Linux NodeSource line: `setup_22.x` → `setup_24.x`.
- "Detect platform" bullet: Node version bumped accordingly.
- Verified that `pnpm ui:build`, `pnpm build`, `pnpm openclaw onboard`, `pnpm gateway:watch`, `pnpm openclaw doctor` all still exist in the new `openclaw/package.json` — no command changes required.

### `docs/TESTS.md`

- `Last updated` date extended with the upgrade-pass note.
- "Automated Unit Tests (Person D extensions)" block updated — command now points at `../scripts/vitest.sentura.config.ts` (the real current location), plus a "Known gap" blockquote explaining that this config still imports a removed path and needs a small repoint.

### `docs/TeamPlan.md`

- `Last synced` date: `2026-04-13` → `2026-04-19` with a note that the sprint plan itself is unaffected (all completed tasks remain valid; OpenClaw-facing paths inside completed-round notes were re-spot-checked and still resolve to real files in `2026.4.19-beta.2`).

### `docs/MEMORY.md`

- Current Ground Truth: added an OpenClaw-version bullet capturing the monorepo layout, 107-extension count, 37+ provider count, Node 24 recommendation, and the Plugin SDK import rule.
- Session Matrix: appended a new 2026-04-19 shared row pointing at this file.
- This detail file created.

### What was intentionally **not** changed

- Historical rounds / audit-trail prose in `docs/TeamPlan.md` and `docs/memory/**` that reference `openclaw/src/...` paths — those paths still resolve in the new OpenClaw, and the memory subsystem is append-only. No backfill edits to historical log entries.
- `docs/DESIGN.md §14` — the MCP server pattern already matches the new loader paths (Round 16 alignment).
- `scripts/vitest.sentura.config.ts` itself — flagged as a known gap in `docs/TESTS.md`, addressed in the follow-up session below (2026-04-19 — Sentura vitest config re-homed).

---

## 2026-04-19 — Sentura vitest config re-homed (known gap closed)

Follow-up to the structural survey. The user clarified that the copy of `vitest.sentura.config.ts` living at `<repo>/scripts/` is **a pristine backup**, not the live config — the live config is meant to live inside `openclaw/` so it can import OpenClaw's test infra cleanly, and the `scripts/` copy exists so it survives the periodic `openclaw/` re-pulls.

### Decision — placement

The new live location is:

```
openclaw/test/vitest/vitest.sentura.config.ts
```

This matches OpenClaw's own convention for extension vitest configs (`test/vitest/vitest.extension-*.config.ts`) and lets us import `sharedVitestConfig` from `./vitest.shared.config.ts` directly, without any `../openclaw/...` relative hops.

### Files created / modified

- **Created** `openclaw/test/vitest/vitest.sentura.config.ts` — live config. Imports `sharedVitestConfig` from `./vitest.shared.config.ts`. Sentura root resolved as `path.resolve(thisDir, "..", "..", "..", "sentura")` (`openclaw/test/vitest/` → `openclaw/test/` → `openclaw/` → repo root → `sentura/`). Verified the shared-config import resolves via `node --input-type=module -e "import('./test/vitest/vitest.shared.config.ts')...` — `sharedVitestConfig` and its siblings (`jsdomOptimizedDeps`, `nonIsolatedRunnerPath`, `repoRoot`, `resolveDefaultVitestPool`, `resolveLocalVitestMaxWorkers`) are all reachable.
- **Rewrote** `scripts/vitest.sentura.config.ts` — now a byte-for-byte-identical pristine backup of the placed file, with a header block explaining the re-placement workflow (`cp scripts/vitest.sentura.config.ts openclaw/test/vitest/vitest.sentura.config.ts`). Keeping the two files identical means re-placement is a plain `cp` with no post-edit.
- **Updated** `sentura/vitest.config.ts` — stub comment now points at the new canonical location and notes the backup location.
- **Updated** `docs/TESTS.md`:
  - Command paths flipped from `../scripts/vitest.sentura.config.ts` to `test/vitest/vitest.sentura.config.ts` (relative to `openclaw/`).
  - "Known gap" blockquote replaced by a "Re-placement after a fresh `openclaw` pull" blockquote describing the backup + `cp` workflow.
  - `Last updated` header extended with a 2026-04-19 note marking the gap closed.
- **Updated** `docs/tests/tests-person-d.md` — two "These tests run via …" lines in D1 and D3 updated to the new command path.
- **Added** `docs/SETUP.md` subsection "Re-place the Sentura vitest config (after every fresh `openclaw/` pull)" directly after the `pnpm gateway:watch` instruction. Documents the `cp` step and explains the rationale (relative-import hygiene, re-pull survival).
- **Updated** `docs/MEMORY.md` matrix — new Week 2 row pointing at this section; Current Ground Truth untouched since the placement is already consistent with the Plugin SDK import rule logged there.

### Why not store the live config under `sentura/`?

Two reasons:

1. **Import hygiene.** Vitest configs live next to the test infra they depend on. Placing this config in `openclaw/test/vitest/` means the `sharedVitestConfig` import is a flat `./vitest.shared.config.ts`, exactly like every other `vitest.extension-*.config.ts`. A copy in `sentura/` would have to walk `../../openclaw/test/vitest/vitest.shared.config.ts`, which is fragile against further OpenClaw reorg.
2. **Workspace resolution.** The tests target `sentura/extensions/**/*.test.ts` but those modules transitively import from `openclaw/plugin-sdk/*`. Running vitest from `openclaw/` with `node_modules` resolved there is already the working recipe — keeping the config in that tree reinforces it.

### How the backup survives re-pulls

`scripts/` is a Sentura directory, not part of the OpenClaw upstream tree. When the user runs the documented re-pull (remove `openclaw/`, re-clone), the live config is wiped but the `scripts/` copy is intact. The documented `cp` restores the live config in one step. Both files stay byte-for-byte identical so the step is a plain copy with no merge.

### Still unchanged

- No changes to any OpenClaw core source file. The placed config is a new file in OpenClaw's test tree, not a modification of existing upstream code.
- No changes to test assertions or Sentura extension code — this session was purely about the vitest wiring location.
