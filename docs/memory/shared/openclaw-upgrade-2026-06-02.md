> **On-demand reference — not read by default.** Back-link: [`docs/MEMORY.md`](../../MEMORY.md)

# OpenClaw `2026.4.19-beta.2` → `2026.6.2` Upgrade — Setup & Compatibility Re-sync

This shared memory file records the 2026-06-02 OpenClaw baseline update and the Sentura compatibility changes made after the user cloned the latest OpenClaw locally and completed build/onboard manually.

## Sessions in this file

| Date | Session |
|---|---|
| 2026-06-02 | OpenClaw `2026.6.2` setup/docs/import compatibility pass |
| 2026-06-02 | Dashboard WebSocket protocol v4 fix |

## 2026-06-02 — OpenClaw `2026.6.2` setup/docs/import compatibility pass

**Local OpenClaw facts re-derived from source.**
- `openclaw/package.json` reports `version: "2026.6.2"`.
- Local commit checked during the pass: `965c175d4be8e12779b29a243fee67dea5983ee3` (`965c175d-dirty` because the enclosing Sentura worktree already had local changes).
- Runtime requirement changed to `engines.node: ">=22.19.0"`.
- Package manager baseline changed to `pnpm@11.2.2+...`.
- `openclaw/extensions/` contains 135 directories.
- Manifest-derived extension counts: 24 channel extensions, 51 provider-capable extensions, 71 provider ids.
- Root package exports include `./plugin-sdk/diagnostic-runtime`; removed convenience subpaths include `./plugin-sdk/diagnostics-otel` and `./plugin-sdk/memory-lancedb`.
- The current terminal still resolved `node -v` to `v22.18.0` even though the user had updated Node elsewhere, so local build verification from this shell was blocked by the new engine requirement.

**Sentura code compatibility changes.**
- `sentura/extensions/sentura-cost/index.ts` now imports `onDiagnosticEvent` from `openclaw/plugin-sdk/diagnostic-runtime`.
- `sentura/extensions/sentura-monitoring/index.ts` now imports `onDiagnosticEvent` from `openclaw/plugin-sdk/diagnostic-runtime`.
- `sentura/extensions/sentura-memory-lancedb/api.ts` uses a local barrel over stable public SDK subpaths: `openclaw/plugin-sdk/plugin-entry` and `openclaw/plugin-sdk/state-paths`.
- `sentura/extensions/sentura-memory-lancedb/index.ts` and `package.json` were refreshed to document compatibility with OpenClaw `2026.6.2`.
- All Sentura extension packages now use `openclaw: "link:../../../openclaw"` in `devDependencies`. The previous wildcard (`"*"`) resolved to registry `openclaw@2026.4.24`, so strict TypeScript checks were compiling against stale SDK declarations even though the repo source was `2026.6.2`.

**Docs and Sentura instructions updated.**
- `docs/SETUP.md` now requires Node 22.19+ / pnpm 11.2.2+, keeps the A2UI skip note, adds a pnpm 11 non-interactive install note, and warns to verify the same shell used for build/onboard/gateway is actually on Node 22.19+.
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/DESIGN.md`, and `docs/OPENCLAW.md` now reference OpenClaw `2026.6.2`, 135 extension directories, 51 provider-capable extensions, and 24 channels.
- `docs/OPENCLAW.md §21` was regenerated from local manifests for channel/provider tables.
- Current-facing MCP loader references were updated away from the removed `openclaw/src/agents/embedded-pi-mcp.ts` filename. The current path fact is: global MCP entries stay at `mcp.servers.<name>`; `openclaw/src/config/mcp-config.ts` reads `sourceConfig.mcp?.servers` through `normalizeConfiguredMcpServers`, and embedded agents merge bundle config through `openclaw/src/agents/embedded-agent-mcp.ts`.
- `docs/TESTS.md` and `docs/tests/tests-cross-team.md` added X10 for OpenClaw `2026.6.2` baseline compatibility.

**Verification status.**
- PASS: local source inspection of OpenClaw version/engines/packageManager/exports.
- PASS: local manifest count script for extension/provider/channel counts.
- PASS: docs/source grep for current-facing old version strings after the update, with remaining `diagnostics-otel` references limited to real extension names or explicit removed-subpath warnings.
- PASS: offline Sentura logic tests after the upgrade (`test-week4-memory.ts` 21/21, `test-week4-cost.ts` 26/26, `test-week4-health.ts` 22/22) and Sitlink Dida demo test/build (11/11 + `tsc`).
- BLOCKED in this shell: authoritative OpenClaw/Sentura strict build verification, because `node -v` still returns `v22.18.0` while OpenClaw `2026.6.2` requires `>=22.19.0`. Strict extension `tsc` also cannot be marked green until the local OpenClaw build exposes `.d.ts` declarations for the public `openclaw/plugin-sdk/*` subpaths or the team approves a public type-consumption path.

## 2026-06-02 — Dashboard WebSocket protocol v4 fix

**Symptom.** After `pnpm gateway:watch:raw`, OpenClaw `2026.6.2` started cleanly, but Sentura Dashboard repeatedly failed to connect. Gateway logs showed:

```text
[ws] protocol mismatch ... client=Sentura Dashboard ui v0.1.0 min=3 max=3 expected=4 probeMin=4
[ws] closed before connect ... code=1002 reason=protocol mismatch
```

**Root cause.** OpenClaw `2026.6.2` bumped the gateway protocol constants to v4 (`openclaw/packages/gateway-protocol/src/version.ts`: `PROTOCOL_VERSION = 4`, `MIN_CLIENT_PROTOCOL_VERSION = 4`). Sentura's dashboard client and live helper scripts still advertised protocol v3.

**Fix.**
- `sentura/dashboard/src/lib/gateway/client.ts` now uses `PROTOCOL_VERSION = 4`.
- Live helper/probe scripts under `scripts/*.ts` were mechanically updated from `minProtocol/maxProtocol: 3` to `4`.
- `docs/gateway-rpc.md`, `docs/MEMORY.md` Current Ground Truth, and detailed test docs now describe protocol v4 for the current OpenClaw baseline.
- `docs/tests/tests-cross-team.md` added X4.4 to catch this exact `expected=4` mismatch in future dashboard smoke tests.

**Verification.**
- Source grep confirms dashboard and helper scripts now advertise v4.
- Live WebSocket probe against the running gateway succeeded when sending `minProtocol: 4`, `maxProtocol: 4`, `client.id: "openclaw-control-ui"`, and `Origin: http://localhost:3000`; gateway replied `{ ok: true, protocol: 4, serverVersion: "2026.6.2" }`.
- `pnpm --filter dashboard exec tsc --noEmit` passed.
- `pnpm --filter dashboard lint` still fails on pre-existing React hooks lint errors unrelated to the protocol constant; do not treat lint as green until those older dashboard issues are cleaned up.
