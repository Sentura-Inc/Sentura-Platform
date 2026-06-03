> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md)

# Sitlink / 座联互动 Phase-1 MVP Memory

Independent client-project memory for the Sitlink / 座联互动 travel-service AI customer-support employee. Sitlink is owned outside the core A/B/C/D Sentura sprint plan, so its memory lives under `docs/memory/sitlink/` and its task progress is not tracked in `docs/TeamPlan.md`.

## Sessions in this file

| Date | Session | Summary |
|---|---|---|
| 2026-06-02 | Phase-1 MVP detailed design | Read platform/progress docs, extracted customer PDF, verified DidaTravel and OpenClaw docs, wrote `座联互动/DESIGN.md`, and added initial test tracking. |
| 2026-06-02 | Milestone 1 DidaTravel demo MCP server | Added `sentura/mcp-servers/dida-travel-demo/`, implemented 6 fixture tools, verified Dida semantics, and logged 10 passing tests. |
| 2026-06-02 | Sitlink memory-lane split | Moved Sitlink project memory out of `shared` and into this dedicated folder; removed Sitlink task ownership from `docs/TeamPlan.md`; split Sitlink tests out of Person D / Cross-team tracking. |
| 2026-06-02 | Chinese-output and fixture display policy | Clarified Sitlink's Chinese-enterprise requirement: Agent replies are Simplified Chinese, while MCP fixtures store Chinese display fields alongside Dida machine fields. |
| 2026-06-02 | Milestone 1a Chinese display fields | Implemented `zh-CN` display fields across the DidaTravel demo MCP server, kept Dida machine fields intact, and verified 11/11 tests plus build. |
| 2026-06-02 | Milestone 2 AI concierge employee | Added `zuolian-travel-concierge` source workspace, 5 skills, Dida demo MCP config, Chinese/status safety rules, and offline smoke verification. |
| 2026-06-02 | Milestone 2 MCP runtime exposure fix | Replaced bare `dida_demo_*` allowlist assumptions and the web-search escape path with MCP-only `tools.allow: ["group:plugins"]` plus sandbox `tools.allow: ["dida-travel-demo__*"]`; verified live config and runtime final-policy output. |
| 2026-06-02 | Milestone 2 Codex harness root-cause fix | Found that OpenAI models defaulted to Codex app-server harness, whose dynamic tool layer re-exposed `web_search`; pinned the Sitlink model runtime to OpenClaw and verified a fresh dashboard-style session called Dida tools only. |
| 2026-06-02 | Milestone 2 web-search supplement restored | Re-enabled `web_search` / `web_fetch` while keeping the OpenClaw runtime pin and Dida-first policy; updated prompts/skills/tests so user-facing tests use natural travel questions. |
| 2026-06-03 | Milestone 3 web demo route | Added `/client-demos/zuolian` with scan-context session seeding, hidden technical seed support in `AgentChat`, side panels, quick actions, refresh recovery, responsive sidebar behavior, and 41/41 offline checks. |
| 2026-06-03 | Hotel-detail click-through | Verified Dida Content API `/api/v1/hotel/details`, added a demo MCP hotel-detail tool, clickable hotel cards, Agent docs, and test coverage for hotel-detail lookup. |
| 2026-06-03 | Airport-to-airport context and multi-city fixtures | Changed the scan context to boarding-gate origin airport -> destination airport, added airport dropdowns, and expanded Dida demo fixtures to 7 cities with 5 hotels + 5 attractions each. |
| 2026-06-03 | Dida Booking Cancel and modify-order demo | Added Dida-aligned pre-cancel, CancelConfirm, and modify-by-cancel-rebook tools plus agent/web/demo docs and tests. |
| 2026-06-03 | Airport-confirmation greeting fix | Fixed confirmed airport sessions that mounted chat without sending the hidden scan seed, restoring the proactive Agent greeting. |
| 2026-06-03 | Hotel-card click UX simplification | Simplified the hotel-card click message so users only see a natural detail request, not tool wiring. |
| 2026-06-03 | Documentation sync audit | Checked and updated current Sitlink docs against the latest implemented feature set; expanded agent smoke to prevent dynamic-destination regressions. |
| 2026-06-03 | Local OpenClaw workspace sync | Copied the updated concierge Markdown docs into the deployed local OpenClaw workspace while preserving runtime state. |

## 2026-06-02 — Phase-1 MVP detailed design

### Inputs read

- `README.md` for the Sentura platform overview and OpenClaw-based architecture.
- `docs/PLATFORM-DESIGN.md` for the newer multi-tenant product direction and connector/template model.
- `docs/MEMORY.md` for current ground truth and implementation status.
- `docs/TeamPlan.md` and `docs/TESTS.md` for then-current planning and test matrix conventions. Sitlink was later split out of TeamPlan ownership.
- `座联互动/座联互动方案.pdf`, extracted with `pypdf`, for the customer problem statement and staged transformation plan.
- DidaTravel docs:
  - `https://apidoc.didatravel.com/content-api-v2/how-to-use-content-api.html`
  - `https://apidoc.didatravel.com/content-api-v2/hotel/list.html`
  - `https://apidoc.didatravel.com/booking-api/price-search.html`
  - `https://apidoc.didatravel.com/booking-api/price-confirm.html`
  - `https://apidoc.didatravel.com/booking-api/booking-confirm.html`
  - `https://apidoc.didatravel.com/booking-api/booking-search.html`
- OpenClaw docs:
  - `https://docs.openclaw.ai/concepts/architecture.md`
  - `https://docs.openclaw.ai/concepts/multi-agent.md`
  - `https://docs.openclaw.ai/cli/mcp.md`
  - `https://docs.openclaw.ai/tools/plugin.md`

### Customer facts captured

- Sitlink / 座联互动 currently owns a traffic entry through transport-station charging hardware.
- The customer wants to move beyond charging plus ad distribution and become a self-owned travel-service platform.
- The long-term target includes itinerary planning, hotel/flight/train/attraction/transfer booking, order handling, complaints, and after-sales service.
- Phase 1 should prove the Agent-service loop before WeChat / WeCom production integration.
- The requested MVP is a backend/web demo where a user scans to charge, the Agent greets proactively, plans a 5-day Shenzhen trip, refines it after feedback, collects identity/contact info, performs a simulated DidaTravel hotel booking, and returns confirmation.

### DidaTravel facts captured

- Content API v2 static domain: `https://static-apiint.didatravel.com`.
- Content API uses Basic auth with `ClientID` as username and `LicenseKey` as password.
- Content API endpoints relevant to MVP: `/api/v1/region/countries`, `/api/v1/region/destinations`, `/api/v1/hotel/list`, `/api/v1/hotel/details`.
- `/api/v1/hotel/list` requires a valid `countryCode`; it is not a global all-hotels dump.
- Booking API test base shown in docs: `https://apiint.didatravel.com`.
- Booking flow is `PriceSearch -> PriceConfirm -> HotelBookingConfirm -> HotelBookingSearch`.
- `PriceSearch` JSON endpoint: `POST /api/rate/pricesearch?$format=json`; it returns one-room pricing and may return `Metadata` that must be passed unchanged into `PriceConfirm`.
- `PriceConfirm` JSON endpoint: `POST /api/rate/PriceConfirm?$format=json`; `PreBook=true` returns `ReferenceNo`, required for booking creation.
- `HotelBookingConfirm` JSON endpoint: `POST /api/booking/HotelBookingConfirm?$format=json`; `ReferenceNo` must come from `PriceConfirm`; guest/contact fields include name, phone, email, and related contact info.
- `HotelBookingSearch` JSON endpoint: `POST /api/booking/HotelBookingSearch?$format=json`; final statuses are only `2 Confirmed`, `3 Canceled`, and `4 Failed`. Statuses `0`, `1`, `5`, and `6` are non-final / processing states.

### Files changed

- Wrote `座联互动/DESIGN.md` from blank to a full Phase-1 design and development plan.
- Initially added a Client Pilot Track to `docs/TeamPlan.md`; this was later removed because Sitlink is owned outside the core A/B/C/D sprint plan.
- Initially updated `docs/TESTS.md` with cross-team X10; this was later moved to a dedicated Sitlink test section.
- Initially added detailed X10 cases to `docs/tests/tests-cross-team.md`; this was later moved to `docs/tests/tests-sitlink.md`.
- Added the first Sitlink memory detail file.

### Decisions

- First phase uses a dedicated `dida-travel-demo` MCP server with fixtures, not real Dida production calls.
- Only hotels follow DidaTravel Booking API in Phase 1. Transfer and attraction lookup are local fixtures because the provided Dida docs cover hotel content/booking, not transfer or attraction booking.
- The Agent may say a hotel booking is confirmed only when simulated `HotelBookingSearch` returns status `2`.
- Real payment, real booking, refunds, complaints, and WeChat/WeCom production integration are Phase 2+ and must use approval/security controls.

## 2026-06-02 — Milestone 1 DidaTravel demo MCP server

### Files changed

- Added `sentura/mcp-servers/dida-travel-demo/` with package config, README, fixture data, MCP server implementation, and tests.
- Implemented six MCP tools: `dida_demo_search_hotels`, `dida_demo_price_confirm`, `dida_demo_book_hotel`, `dida_demo_get_booking`, `dida_demo_search_transfer`, and `dida_demo_search_attractions`.
- Marked Milestone 1 complete in `座联互动/DESIGN.md`.
- Initially added Person D test matrix row D26 in `docs/TESTS.md` and detailed D26 cases in `docs/tests/tests-person-d.md`; this was later moved to the independent Sitlink test file.

### DidaTravel semantics verified

- Booking API test base remains `https://apiint.didatravel.com`.
- Content API static domain remains `https://static-apiint.didatravel.com`.
- `PriceSearch` maps to `POST /api/rate/pricesearch?$format=json`.
- `PriceConfirm` maps to `POST /api/rate/PriceConfirm?$format=json`; `PreBook=true` returns `ReferenceNo`; `PreBook=false` must not proceed to booking.
- `HotelBookingConfirm` maps to `POST /api/booking/HotelBookingConfirm?$format=json` and requires the `ReferenceNo` from PriceConfirm.
- `HotelBookingSearch` maps to `POST /api/booking/HotelBookingSearch?$format=json`; only statuses `2`, `3`, and `4` are final.

### Verification

- `pnpm --filter @sentura/mcp-dida-travel-demo test` — PASS, 10/10.
- `pnpm --filter @sentura/mcp-dida-travel-demo build` — PASS.
- `git diff --check` — PASS.
- `find . \( -name RULES.md -o -name CONTEXT.md \) -print` — no output.

## 2026-06-02 — Sitlink memory-lane split

### Changes

- Created `docs/memory/sitlink/` as the dedicated Sitlink memory folder.
- Moved the old `docs/memory/shared/zuolian-mvp-2026-06-02.md` content into `docs/memory/sitlink/phase-1.md`.
- Updated `docs/MEMORY.md` with owner `sitlink` and a dedicated Sitlink section outside Week-based A/B/C/D/shared sprint rows.
- Removed the Sitlink Client Pilot Track from `docs/TeamPlan.md`.
- Moved Sitlink test tracking from Person D / Cross-team rows into `docs/tests/tests-sitlink.md`.
- Updated root `AGENTS.md` and `CLAUDE.md` so future agents know Sitlink is independently owned and must not be tracked through TeamPlan.

## 2026-06-02 — Chinese-output and fixture display policy

### Customer clarification

- Sitlink / 座联互动's customer is a Chinese enterprise.
- The travel-concierge Agent's conversation language and user-facing output should be Simplified Chinese.
- The MCP server step should store Chinese display content for names and descriptions that users will see, including hotel names, room names, districts, addresses, cancellation policies, transfer/vehicle names, attraction/ticket names, and order summaries.
- Re-checked Dida documentation for the language boundary: Content API supports `zh-CN` but warns non-English static content may be less extensive and non-default test accounts default to English; BookingConfirm `Name` supports Chinese but Dida recommends English conversion to improve supplier-side success.

### Design updates

- Updated `座联互动/DESIGN.md` to require Simplified Chinese for all user-facing Agent replies.
- Added a Dida language boundary: Dida-aligned machine fields such as IDs, status codes, `Metadata`, and `ReferenceNo` remain unchanged, while Sitlink-owned display fields carry `locale: "zh-CN"` and `*Zh` / `displaySummaryZh` content.
- Added Milestone 1a to strengthen MCP fixture Chinese display fields without changing the already-completed Milestone 1 Dida booking-chain semantics.
- Added Sitlink S3 test tracking for Chinese output and MCP fixture display fields.

## 2026-06-02 — Milestone 1a Chinese display fields

### Files changed

- Updated `sentura/mcp-servers/dida-travel-demo/src/index.ts` so hotel search, price confirm, booking confirm/search, transfer search, and attraction search return `locale: "zh-CN"` plus Chinese display fields (`hotelNameZh`, `roomNameZh`, `cancellationPolicyZh`, `transferNameZh`, `vehicleClassZh`, `attractionNameZh`, `ticketTypeZh`, `statusNameZh`, `displaySummaryZh`).
- Kept Dida-aligned machine fields unchanged: `hotelId`, `ratePlanId`, `roomTypeCode`, `metadata`, `referenceNo`, `bookingId`, `status`, `statusName`, and endpoint/doc metadata remain English/code-oriented.
- Updated `sentura/mcp-servers/dida-travel-demo/fixtures/shenzhen-demo.json` with matching `zh-CN` fixture display data.
- Updated `sentura/mcp-servers/dida-travel-demo/src/server.test.ts` to assert Chinese display fields while preserving Dida machine fields.
- Updated `sentura/mcp-servers/dida-travel-demo/README.md` with the two-layer response contract.
- Marked `座联互动/DESIGN.md` Milestone 1a complete and updated Sitlink test tracking.

### Verification

- `pnpm --filter @sentura/mcp-dida-travel-demo test` — PASS, 11/11.
- `pnpm --filter @sentura/mcp-dida-travel-demo build` — PASS.

## 2026-06-02 — Milestone 2 AI concierge employee

### Files changed

- Added `sentura/agents/zuolian-travel-concierge/config.json5` with an embedded `zuolian-travel-concierge` agent, `non-main` sandbox, webchat binding, Dida demo MCP server at `mcp.servers.dida-travel-demo`, and Dida MCP exposure through `tools.allow: ["group:plugins"]` plus sandbox `tools.allow: ["dida-travel-demo__*"]`.
- Added the 8 OpenClaw-native workspace files under `sentura/agents/zuolian-travel-concierge/`: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, and `MEMORY.md`.
- Added 5 skills under `sentura/agents/zuolian-travel-concierge/skills/`: `travel-intake`, `itinerary-planning`, `dida-hotel-booking`, `booking-status`, and `feedback-refinement`.
- Added `scripts/test-zuolian-agent.ts` as an offline Milestone 2 smoke test.
- Updated `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` so setup copies/registers `zuolian-travel-concierge`, stamps its workspace state, applies default tenancy/memory isolation through the existing loops, and wires `mcp.servers.dida-travel-demo`.
- Fixed `scripts/sentura-setup.sh` Step 7a embedded-JavaScript quoting after a live rerun printed `kind:: command not found`; the block now uses a quoted heredoc so shell does not evaluate JavaScript comments or interpolation text.
- Marked Milestone 2 complete in `座联互动/DESIGN.md`.
- Added Sitlink S4 test tracking in `docs/TESTS.md` and `docs/tests/tests-sitlink.md`.

### Safety and behavior captured

- User-facing replies must be Simplified Chinese.
- Dida machine fields (`hotelId`, `ratePlanId`, `metadata`, `referenceNo`, `bookingId`, `status`, `statusName`) remain unchanged for booking-chain correctness.
- Hotel booking must follow search/selected quote -> `PriceConfirm(preBook=true)` -> `BookingConfirm` -> `BookingSearch`.
- Only status `2 Confirmed` may be described as confirmed success; statuses `0`, `1`, `5`, and `6` are non-final / processing.
- Phase 1 remains fixture-only: no real Dida production booking, payment, refund, WeChat/WeCom production integration, or ID/passport collection.

### Verification

- `npx tsx scripts/test-zuolian-agent.ts` — PASS, 62/62.
- `pnpm --filter @sentura/mcp-dida-travel-demo test` — PASS, 11/11.
- `pnpm --filter @sentura/mcp-dida-travel-demo build` — PASS.
- `cd openclaw && pnpm exec tsx -e "<createSessionMcpRuntime + materializeBundleMcpToolsForRun probe>"` — PASS, materialized all six runtime tool names: `dida-travel-demo__dida_demo_book_hotel`, `dida-travel-demo__dida_demo_get_booking`, `dida-travel-demo__dida_demo_price_confirm`, `dida-travel-demo__dida_demo_search_attractions`, `dida-travel-demo__dida_demo_search_hotels`, `dida-travel-demo__dida_demo_search_transfer`.

## 2026-06-02 — Milestone 2 MCP runtime exposure fix

### Finding

A live dashboard chat with `zuolian-travel-concierge` produced the correct Chinese greeting, but the 5-day itinerary turn only called `web_search`. OpenClaw logs showed:

- `tools.profile (minimal) allowlist contains unknown entries (dida_demo_search_hotels, ...)`
- `agents.zuolian-travel-concierge.tools.allow allowlist contains unknown entries (dida_demo_search_hotels, ...)`

This means the Dida demo MCP server was configured, but its tools were not exposed under the bare MCP tool names. In OpenClaw `2026.6.2`, configured MCP tools are exposed through `bundle-mcp` and materialized as server-prefixed tool names such as `dida-travel-demo__dida_demo_search_hotels`.

A second live dashboard test removed the bare names and non-callable `bundle-mcp` allowlist entry, but the model still only called `web_search`. The remaining issue was not Docker or MCP server build state; the agent still had a valid web-search-only path. The hardened fix removes web tools from this Phase 1 demo agent and uses `tools.allow: ["group:plugins"]` to trigger MCP runtime plus sandbox `tools.allow: ["dida-travel-demo__*"]` to expose only the Dida fixture tools.

### Files changed

- Updated `sentura/agents/zuolian-travel-concierge/config.json5` to use the `coding` profile plus `tools.allow: ["group:plugins"]` for OpenClaw MCP-bundle exposure and sandbox `tools.allow: ["dida-travel-demo__*"]` instead of bare `dida_demo_*` names.
- Updated `AGENTS.md`, `TOOLS.md`, and related skills to refer to callable OpenClaw MCP tool names (`dida-travel-demo__...`) while preserving original MCP tool names in the explanatory table.
- Updated `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` so setup writes the `coding` profile, explicit MCP/plugin allow entry, sandbox Dida-only allow entry, and an absolute `dist/index.js` path for the Dida demo MCP server.
- Updated `scripts/test-zuolian-agent.ts` so this exact runtime-exposure mistake fails offline.
- Updated Sitlink S4 test detail wording.

### Verification

- `npx tsx scripts/test-zuolian-agent.ts` — PASS, 62/62.
- `pnpm --filter @sentura/mcp-dida-travel-demo test` — PASS, 11/11.
- `pnpm --filter @sentura/mcp-dida-travel-demo build` — PASS.
- `./scripts/sentura-setup.sh` — PASS; live `~/.openclaw/openclaw.json` now has `tools.allow: ["group:plugins"]` and sandbox `tools.allow: ["dida-travel-demo__*"]`.
- Gateway log showed hot reload applied for `agents.list` at 2026-06-02 22:15:51 Asia/Shanghai.
- `cd openclaw && pnpm exec tsx -e "<createSessionMcpRuntime + materializeBundleMcpToolsForRun + applyEmbeddedAttemptToolsAllow + applyFinalEffectiveToolPolicy probe>"` — PASS, final provider-bound tools are exactly the six `dida-travel-demo__dida_demo_*` tools and no `web_search`.

## 2026-06-02 — Milestone 2 Codex harness root-cause fix

### Final root cause

The previous MCP exposure fix was necessary but incomplete. The Dida tools were correctly configured and the normal OpenClaw policy pipeline could produce a final six-tool Dida-only surface, but live dashboard turns still called `web_search`.

The missing dimension was harness selection. In OpenClaw `2026.6.2`, OpenAI model refs can default to the Codex app-server harness. That path builds a separate dynamic tool surface and can include `web_search` even when the ordinary embedded OpenClaw tool-policy logs show `web_search` / `web_fetch` removed. This is why deleting Docker containers/images would not help: the running gateway was local `pnpm gateway:watch`, config hot reload was working, and the issue was the selected agent runtime/tool-surface path.

### Files changed

- Updated `sentura/agents/zuolian-travel-concierge/config.json5` with per-model `models.<model>.agentRuntime.id = "openclaw"` for `openai/gpt-5.4` and `openai/gpt-5.5`.
- Updated `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` so setup writes the preferred Sitlink model with the same OpenClaw runtime pin into `~/.openclaw/openclaw.json`.
- Updated `scripts/test-zuolian-agent.ts` to assert the model runtime pin and fail with an explanation if it is removed.
- Removed remaining design/skill language that implied Milestone 2 should call `web_search`.
- Updated Sitlink test and memory documentation.

### Verification

- `npx tsx scripts/test-zuolian-agent.ts` — PASS, 65/65.
- `bash -n scripts/sentura-setup.sh && git diff --check` — PASS.
- `find . \( -name RULES.md -o -name CONTEXT.md \) -print` — PASS, no output.
- Source config harness resolver probe — PASS: `runtime: "openclaw"`, `runtimeSource: "model"`.
- `./scripts/sentura-setup.sh` — PASS; no `kind:: command not found`; live config patched `zuolian-travel-concierge.models["openai/gpt-5.5"].agentRuntime.id = "openclaw"` and gateway hot-reloaded `agents.list`.
- Live config harness resolver probe — PASS: `runtime: "openclaw"`, `runtimeSource: "model"`.
- Fresh dashboard-style `chat.send` session — PASS: the assistant called `dida-travel-demo__dida_demo_search_hotels`, `dida-travel-demo__dida_demo_search_transfer`, and `dida-travel-demo__dida_demo_search_attractions`; no `web_search` or `web_fetch` appeared in that session.

## 2026-06-02 — Milestone 2 web-search supplement restored

### Change

After the Dida-only fix proved the root cause, the demo requirement changed back to allowing web research. The stable policy is now:

- keep `agentRuntime.id = "openclaw"` so OpenAI models do not fall back to Codex app-server dynamic tools;
- expose Dida demo MCP plus `web_search` / `web_fetch`;
- require Dida hotel / transfer / attraction calls before the final itinerary;
- use web research only as public-information supplement for weather, opening hours, traffic notes, and route context;
- test with user-facing natural prompts, not prompts that mention backend tools.

### Files changed

- Updated `sentura/agents/zuolian-travel-concierge/config.json5` to allow `group:plugins`, `web_search`, and `web_fetch` at both top-level and sandbox tool-policy layers.
- Updated `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` with the same allowlists so setup preserves the change.
- Updated `AGENTS.md`, `TOOLS.md`, `itinerary-planning/SKILL.md`, and `feedback-refinement/SKILL.md` to describe Dida-first + web supplement behavior.
- Updated `座联互动/DESIGN.md`, `docs/TESTS.md`, `docs/tests/tests-sitlink.md`, and `scripts/test-zuolian-agent.ts`.

### User-facing test prompts

Use prompts like:

- "我刚在深圳宝安国际机场扫码充电，准备去深圳市区玩。为我制定 5 日深圳旅游攻略。"
- "我预算低一点，住得方便就行，不要太赶。"
- "我想住离海边近一点，帮我改一版。"

Expected behavior: the backend may show Dida demo tool calls and web search calls, but the user-facing conversation should not require or mention tool names unless the operator is debugging.

## 2026-06-03 — Milestone 3 web demo route

### Files changed

- Added `sentura/dashboard/src/app/client-demos/zuolian/page.tsx`.
- Updated `sentura/dashboard/src/components/agent-chat.tsx` with `hiddenUserPrefixes` so technical seed messages can be hidden from visible transcripts, plus an imperative `sendMessage()` handle for page-level quick actions.
- Updated `sentura/dashboard/src/components/sidebar.tsx` with a "Zuolian Demo" navigation entry and compact small-screen icon-sidebar behavior.
- Added `scripts/test-zuolian-web-demo.ts` as the Milestone 3 offline structural test.
- Marked Milestone 3 complete in `座联互动/DESIGN.md`.
- Added Sitlink S5 test tracking in `docs/TESTS.md` and `docs/tests/tests-sitlink.md`.

### Behavior captured

- `/client-demos/zuolian` creates or restores a `zuolian-travel-concierge` session.
- First-load session creation sends a hidden scan-context seed with `charging_qr_scanned`, `深圳宝安国际机场`, destination `深圳`, station `SZX-A01`, and `zh-CN` language.
- The first visible greeting remains Agent-generated; the front end does not hardcode the full customer-service greeting.
- The page persists the session key in `localStorage`, validates it with `sessions.get`, clears stale keys, and offers "重开 Demo" to create a fresh seeded session.
- Side panels show scan context, itinerary/tool progress, and order status. Tool-event handling maps Dida hotel/transfer/attraction/price-confirm/booking/booking-search plus `web_search` / `web_fetch` into panel status.
- Quick actions send natural Chinese prompts for the 5-day Shenzhen itinerary, lower budget, beach stay, simulated booking, and booking lookup.
- Order display keeps the status safety invariant: only status `2 Confirmed` can be described as confirmed.

### Verification

- `npx tsx scripts/test-zuolian-web-demo.ts` — PASS, 41/41.
- `npx tsx scripts/test-zuolian-agent.ts` — PASS, 65/65.
- `pnpm --filter @sentura/mcp-dida-travel-demo test` — PASS, 11/11.
- `pnpm --filter @sentura/mcp-dida-travel-demo build` — PASS, with Node engine warning because the shell uses Node 22.18.0 while OpenClaw requires 22.19+.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `cd sentura/dashboard && pnpm exec eslint src/app/client-demos/zuolian/page.tsx src/components/sidebar.tsx` — PASS.
- `cd sentura/dashboard && pnpm build` — PASS; route table includes `/client-demos/zuolian`. Next.js warned that it inferred `/Users/henry` as the workspace root because multiple lockfiles exist.
- Full `cd sentura/dashboard && pnpm lint` — attempted, but still fails on pre-existing React 19 lint rules across older dashboard files (`react-hooks/set-state-in-effect`, `react-hooks/refs`) plus existing unused-var warnings; targeted lint for the new page/sidebar passes.
- In-app Browser smoke — PASS on `http://127.0.0.1:3001/client-demos/zuolian`; desktop renders the route and side panels, narrow viewport uses compact icon sidebar and keeps the Demo content readable. Gateway was disconnected during visual smoke, so live proactive greeting/tool calls remain covered by S2/Milestone 4.

## 2026-06-03 — Hotel-detail click-through

### Dida API finding

- Verified Dida Content API v2 docs: `/api/v1/hotel/details` retrieves hotel details from a specific list of hotel IDs and has default QPS 10.
- Verified the same Content API page documents Basic auth with `ClientID` / `LicenseKey`, JSON static content, gzip, and multilingual support including `zh-CN`.
- Also checked Dida's API solution page wording that Content API covers hotel details including rooms, images, descriptions, and amenities.
- Conclusion: the requested click-through is feasible. In the demo, it should remain fixture-backed and Dida-aligned; real integration later should call Content API with authenticated hotel IDs and preserve the Chinese-display fallback layer.

### Files changed

- `sentura/mcp-servers/dida-travel-demo/src/index.ts`
  - Added `dida_demo_get_hotel_details`.
  - Added hotel static details to fixtures in code: Chinese descriptions, facilities, nearby POIs, geo coordinates, image placeholders, and check-in instructions.
  - Returned Content API-style response metadata with `didaEndpoint: "GET /api/v1/hotel/details"`, `hotelIds`, and `language`.
- `sentura/mcp-servers/dida-travel-demo/fixtures/shenzhen-demo.json`
  - Mirrored the Chinese hotel-detail fields.
- `sentura/mcp-servers/dida-travel-demo/src/server.test.ts`
  - Expanded the tool catalog to 7 tools and added the hotel-detail fixture test.
- `sentura/mcp-servers/dida-travel-demo/README.md`
  - Documented the hotel-detail tool and new Chinese fields.
- `sentura/dashboard/src/app/client-demos/zuolian/page.tsx`
  - Parses hotel search results into clickable hotel cards.
  - Clicking a hotel sends a natural Chinese request asking the Agent to call `dida-travel-demo__dida_demo_get_hotel_details` for the selected `hotelId`.
  - Parses detail-tool results into the side panel: description, address, facilities, nearby POIs, and star rating.
- `sentura/agents/zuolian-travel-concierge/TOOLS.md` and `skills/itinerary-planning/SKILL.md`
  - Added tool visibility and usage instructions for hotel details.
- `scripts/test-zuolian-agent.ts`
  - Added the new OpenClaw-prefixed MCP tool to the expected workspace references.
- `scripts/test-zuolian-web-demo.ts`
  - Added checks for clickable hotel candidates, detail-tool request wording, and hotel-detail parsing.
- Updated `座联互动/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-sitlink.md`.

### Verification

- `pnpm --filter @sentura/mcp-dida-travel-demo test` — PASS, 12/12, with Node engine warning because the shell uses Node 22.18.0 while OpenClaw requires 22.19+.
- `npx tsx scripts/test-zuolian-web-demo.ts` — PASS, 46/46.
- `npx tsx scripts/test-zuolian-agent.ts` — PASS, 66/66.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.

## 2026-06-03 — Airport-to-airport context and multi-city fixtures

### Change

The Sitlink demo scan-entry model changed from a single Shenzhen airport/downtown assumption to a boarding-gate QR flow: the user's current location is an origin airport gate and the destination is another city's airport.

### Files changed

- `sentura/dashboard/src/app/client-demos/zuolian/page.tsx`
  - Added origin and destination airport dropdowns for 广州白云、北京首都、上海浦东、杭州萧山、香港、澳门、深圳宝安.
  - Changed the hidden seed to `boarding_gate_qr_scanned` with origin/destination airport codes and destination airport/city.
  - Scoped session persistence by airport pair so a CAN -> SZX demo does not reuse a CAN -> HKG session.
  - Added a "确认机场并通知客服" gate so dropdown changes stay as draft selections until the user confirms; Agent sessions and seed messages are only created after confirmation.
  - Made quick actions destination-aware, e.g. "制定 5 日香港旅游攻略" after selecting 香港国际机场.
- `sentura/mcp-servers/dida-travel-demo/src/index.ts`
  - Expanded hotel fixtures to 7 cities: 深圳、广州、北京、上海、杭州、香港、澳门, 5 hotels each.
  - Expanded attraction fixtures to the same 7 cities, 5 attractions each.
  - Kept real hotel/attraction names but simulated Dida IDs, rate plans, prices, cancellation policies, image URLs, and booking outcomes.
  - Changed transfer search from Shenzhen fixed options to generic pickup/dropoff-based fixture options.
- `sentura/agents/zuolian-travel-concierge/TOOLS.md` and `skills/itinerary-planning/SKILL.md`
  - Replaced Shenzhen-specific planning language with destination-city planning language.
- `sentura/agents/zuolian-travel-concierge/BOOTSTRAP.md` and `USER.md`
  - Replaced the old `charging_qr_scanned` / `airport_to_shenzhen` static defaults with the boarding-gate CAN -> SZX default and noted the UI can change both airports.
- `scripts/test-zuolian-web-demo.ts`
  - Expanded S5 structural checks from 46 to 60, covering airport options, boarding-gate seed, the airport confirmation gate, and destination-aware quick actions.
- `sentura/mcp-servers/dida-travel-demo/src/server.test.ts`
  - Expanded S1 tests from 12 to 13, covering 7-city fixture coverage.
- Updated `座联互动/DESIGN.md`, `docs/TESTS.md`, `docs/tests/tests-sitlink.md`, and the Dida demo MCP README.

### Verification

- `pnpm --filter @sentura/mcp-dida-travel-demo test` — PASS, 13/13, with the existing Node engine warning because this shell uses Node 22.18.0 while OpenClaw requires 22.19+.
- `pnpm --filter @sentura/mcp-dida-travel-demo build` — PASS, same engine warning.
- `npx tsx scripts/test-zuolian-web-demo.ts` — PASS, 60/60.
- `npx tsx scripts/test-zuolian-agent.ts` — PASS, 66/66.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `cd sentura/dashboard && pnpm exec eslint src/app/client-demos/zuolian/page.tsx src/components/agent-chat.tsx src/components/sidebar.tsx` — PASS.
- `cd sentura/dashboard && pnpm build` — PASS; route table includes `/client-demos/zuolian`.
- In-app Browser smoke on `http://127.0.0.1:3000/client-demos/zuolian` — PASS: default dropdowns show 广州白云 -> 深圳宝安, destination options include all 7 airports with the origin disabled, and switching destination to 香港 updates the side-panel destination plus quick-action copy.

## 2026-06-03 — Dida Booking Cancel and modify-order demo

### Dida API finding

- Verified Dida Booking API generated docs for Booking Cancel:
  - Pre-cancel endpoint: `POST /api/booking/HotelBookingCancel`.
  - Confirm-cancel endpoint: `POST /api/booking/HotelBookingCancelConfirm`.
  - Pre-cancel returns cancellation amount and `ConfirmID`; pre-cancel alone does not cancel the booking.
  - `ConfirmID` is valid for 10 minutes and must be passed to the confirm-cancel step.
- Verified Dida BookingSearch status semantics still govern customer-facing cancellation: status `3 Canceled` is the final canceled state.
- Design decision: modification is implemented as cancel-and-rebook because the requested Dida-compatible flow is `BookingCancel -> PriceSearch -> PriceConfirm -> BookingConfirm`, with all rebooking work hidden from the user except the final old/new order summary.

### Files changed

- `sentura/mcp-servers/dida-travel-demo/src/index.ts`
  - Added pending cancellation records and cancel ConfirmID generation.
  - Added `dida_demo_pre_cancel_booking`, `dida_demo_cancel_booking`, and `dida_demo_modify_booking`.
  - Pre-cancel returns fee/refund and leaves the booking status unchanged.
  - CancelConfirm changes the fixture order to status `3 Canceled`.
  - Modify first cancels the old order, then runs `PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm` with updated details and links old/new booking IDs.
- `sentura/mcp-servers/dida-travel-demo/src/server.test.ts`
  - Expanded tests from 13 to 16.
  - Added Booking Cancel two-step coverage, missing ConfirmID rejection, and modify-by-cancel-rebook coverage.
- `sentura/mcp-servers/dida-travel-demo/README.md`
  - Documented the new cancel and modify tools.
- `sentura/agents/zuolian-travel-concierge/AGENTS.md`, `TOOLS.md`, `skills/dida-hotel-booking/SKILL.md`, and `skills/booking-status/SKILL.md`
  - Added cancellation and modification tool order, status safety, and customer-facing wording requirements.
- `sentura/dashboard/src/app/client-demos/zuolian/page.tsx`
  - Added cancel and modify quick actions.
  - Added tool-flow steps for pre-cancel, CancelConfirm, and modify.
  - Updated order parsing to prefer `newBooking` from modify results.
- `scripts/test-zuolian-agent.ts`
  - Expanded agent smoke coverage from 66 to 71 checks.
- `scripts/test-zuolian-web-demo.ts`
  - Expanded web route structural coverage from 60 to 68 checks.
- Updated `座联互动/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-sitlink.md`.

### Verification

- `pnpm --filter @sentura/mcp-dida-travel-demo test` — PASS, 16/16, with the existing Node engine warning because this shell uses Node 22.18.0 while OpenClaw requires 22.19+.
- `pnpm --filter @sentura/mcp-dida-travel-demo build` — PASS, same engine warning.
- `npx tsx scripts/test-zuolian-agent.ts` — PASS, 71/71.
- `npx tsx scripts/test-zuolian-web-demo.ts` — PASS, 68/68.

## 2026-06-03 — Airport-confirmation greeting fix

### Root cause

The Milestone 3 confirmation-gate page created a session with `client.createSession(AGENT_ID, buildSeedMessage(...))` after the user clicked "确认机场并通知客服". In the current Gateway behavior, the page-owned session creation path was not a reliable substitute for `AgentChat`'s first-message send path, so the chat UI could mount with a session key but no actual hidden scan-context user message sent through `chat.send`. The result was that the concierge no longer proactively replied after airport confirmation.

### Fix

- `sentura/dashboard/src/app/client-demos/zuolian/page.tsx`
  - Changed `createDemoSession()` to create an empty labeled session first.
  - Added `pendingSeed` state so the page sends `buildSeedMessage(origin, destination)` through the mounted `AgentChat` imperative `sendMessage()` handle.
  - Kept the hidden seed prefix so the technical scan context remains invisible to the user.
  - When restoring a stored airport-scoped session, the page now checks `client.getTranscript(stored, 1)` and re-sends the hidden seed if the transcript is empty.
- `scripts/test-zuolian-web-demo.ts`
  - Expanded S5 checks from 68 to 70 to assert the new create-session-then-hidden-send contract and empty-session re-seeding.
- Updated `docs/TESTS.md` and `docs/tests/tests-sitlink.md`.

### Verification

- `npx tsx scripts/test-zuolian-web-demo.ts` — PASS, 70/70.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `cd sentura/dashboard && pnpm exec eslint src/app/client-demos/zuolian/page.tsx` — PASS.

## 2026-06-03 — Hotel-card click UX simplification

### Change

The hotel candidate card click previously sent a long user-visible instruction that named the Dida Content API demo tool and included `hotelIds` wiring. This was useful for early testing but too technical for the client-facing demo.

### Files changed

- `sentura/dashboard/src/app/client-demos/zuolian/page.tsx`
  - `handleHotelClick()` now sends only `我想查看{hotelNameZh}的详情`.
- `scripts/test-zuolian-web-demo.ts`
  - Replaced the old tool-wiring assertion with checks that the simplified sentence exists and the click message no longer contains `hotelIds 只传` or the explicit tool-call instruction.
- Updated `docs/TESTS.md` and `docs/tests/tests-sitlink.md`.

### Verification

- `npx tsx scripts/test-zuolian-web-demo.ts` — PASS, 71/71.

## 2026-06-03 — Documentation sync audit

### Scope checked

- `座联互动/DESIGN.md`
- `docs/TESTS.md`
- `docs/tests/tests-sitlink.md`
- `sentura/mcp-servers/dida-travel-demo/README.md`
- `sentura/agents/zuolian-travel-concierge/{AGENTS,SOUL,IDENTITY,BOOTSTRAP,USER,TOOLS}.md`
- `sentura/agents/zuolian-travel-concierge/skills/*.md`
- `scripts/test-zuolian-agent.ts`
- `scripts/test-zuolian-web-demo.ts`

### Findings and fixes

- Current design/test/MCP docs already reflected the 10-tool Dida demo surface, 16 MCP tests, 71 web checks, hotel details, airport selectors, Booking Cancel, and modify-by-cancel-rebook.
- Fixed stale current agent docs that still described the scope as fixed Shenzhen / charging QR:
  - `IDENTITY.md` and `SOUL.md` now describe boarding-gate QR and destination-city planning.
  - `AGENTS.md` now describes the Phase 1 route as boarding-gate QR -> destination-city itinerary -> booking lookup -> cancel/modify when requested.
  - `travel-intake/SKILL.md` now derives defaults from confirmed destination airport/city.
  - `BOOTSTRAP.md` now includes simulated cancellation and modification in scope and clarifies no real refunds/complaints.
  - `USER.md` now includes hotel-detail, cancel, and modify example requests.
- Fixed stale `座联互动/DESIGN.md` sections:
  - Phase 1 scope now says hotel quote, booking, order lookup, cancellation, and modification are simulated.
  - Booking template uses current `DIDA-BOOK-ZL-*` / `DIDA-PRE-ZL-*` IDs.
  - Web route section lists seven quick actions and the simplified hotel-card click message.
  - Proactive greeting section documents the current empty-session + hidden `AgentChat.sendMessage()` seed behavior.
  - Milestone and test plan sections include hotel detail, cancel/modify, simplified hotel-card copy, and cancel/modify quick actions.
- Updated `docs/TESTS.md` and `docs/tests/tests-sitlink.md`:
  - S4 agent smoke now reports 74 checks.
  - Summary template now uses S1 16/16, S4 74/74, and S5 71/71.
- Historical `docs/MEMORY.md` and `docs/memory/sitlink/phase-1.md` rows that mention older counts or old feature stages were left unchanged because they are append-only audit records.

### Verification

- `npx tsx scripts/test-zuolian-agent.ts` — PASS, 74/74.
- `npx tsx scripts/test-zuolian-web-demo.ts` — PASS, 71/71.

## 2026-06-03 — Local OpenClaw workspace sync

### Change

The source workspace under `sentura/agents/zuolian-travel-concierge/` had been updated, but the deployed local OpenClaw workspace under `~/.openclaw/workspace/zuolian-travel-concierge/` still had older Markdown instructions. Synced the runtime-facing Markdown files so local conversations use the latest airport-to-airport, destination-city, hotel-detail, cancel/modify, and safety instructions.

### Files copied

- 8 native OpenClaw workspace files:
  - `AGENTS.md`
  - `SOUL.md`
  - `TOOLS.md`
  - `IDENTITY.md`
  - `USER.md`
  - `HEARTBEAT.md`
  - `BOOTSTRAP.md`
  - `MEMORY.md`
- 5 skill files:
  - `skills/travel-intake/SKILL.md`
  - `skills/itinerary-planning/SKILL.md`
  - `skills/dida-hotel-booking/SKILL.md`
  - `skills/booking-status/SKILL.md`
  - `skills/feedback-refinement/SKILL.md`

### Verification

- `diff -qr sentura/agents/zuolian-travel-concierge ~/.openclaw/workspace/zuolian-travel-concierge` now reports only runtime-local directories: `.openclaw`, `ekg`, and `memory`.
- `rg` spot-checks in `~/.openclaw/workspace/zuolian-travel-concierge` confirm the latest destination-city, boarding-gate QR, `dida_demo_modify_booking`, `ConfirmID`, and simplified hotel-detail request wording.
