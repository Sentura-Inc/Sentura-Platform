> **On-demand reference — not read by default.**
>
> Back-link: [`docs/TESTS.md`](../TESTS.md)

# Sitlink Project Tests

Independent test details for the Sitlink / 座联互动 client-pilot work. Sitlink tests are not owned by Person A/B/C/D and are not cross-team sprint tests unless a future task explicitly touches shared Sentura platform behavior.

## S1 — DidaTravel demo MCP server (Milestone 1)

Locks the client-pilot Tier-2 MCP server at `sentura/mcp-servers/dida-travel-demo/`. The server is fixture-first and must not make real DidaTravel network calls in Milestone 1.

Run:

```bash
pnpm --filter @sentura/mcp-dida-travel-demo test
pnpm --filter @sentura/mcp-dida-travel-demo build
```

Expected: `src/server.test.ts` reports 11 passing tests (10 Milestone 1 flow/status tests plus the S3.1 Chinese-display-field assertion) and `tsc -p tsconfig.json` completes with no TypeScript errors.

| # | Test | Method | Expected result |
|---|------|--------|-----------------|
| S1.1 | Config defaults | `loadConfigFromEnv({})` | `mode="fixture"`, booking base `https://apiint.didatravel.com`, content base `https://static-apiint.didatravel.com`. |
| S1.2 | Tool catalog | `listTools()` | Exactly 6 tools: hotel search, price confirm, hotel booking, booking search, transfer search, attraction search. Hotel tools expose the official Dida endpoint names in metadata. |
| S1.3 | MCP annotations | Connect via `InMemoryTransport` and call `client.listTools()` | Discovery tools are `readOnlyHint=true`; `dida_demo_book_hotel` is `destructiveHint=true` for approval-aware clients. |
| S1.4 | Happy path | Call MCP tools in order | `PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm -> BookingSearch`; booking returns status `2 Confirmed`, `final=true`. |
| S1.5 | `preBook=false` boundary | Call `priceConfirm({ preBook:false })` then try booking | No `ReferenceNo` is returned and `BookingConfirm` rejects missing/non-prebook references. |
| S1.6 | Metadata integrity | Alter `Metadata` before `PriceConfirm` | Server rejects because Dida requires `Metadata` from PriceSearch to be passed unchanged. |
| S1.7 | Duplicate reference guard | Call `BookingConfirm` twice with one `ReferenceNo` | Second call fails; a prebook reference is single-use. |
| S1.8 | Status semantics | Force statuses `0/1/5/6` and `2/3/4` | `0/1/5/6` are non-final; only `2/3/4` return `final=true`. |
| S1.9 | Transfer fixtures | `dida_demo_search_transfer` | Returns local Shenzhen airport transfer options, source `demo-fixture`. |
| S1.10 | Attraction fixtures | `dida_demo_search_attractions` | Returns local Shenzhen attraction ticket options, source `demo-fixture`. |

## S2 — Phase-1 web demo + DidaTravel simulated booking flow

Locks the planned web-demo deliverable designed in `座联互动/DESIGN.md`.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| S2.1 | Proactive greeting | Open `/client-demos/zuolian` with a clean session | Page injects the simulated airport charging-scan context; `zuolian-travel-concierge` sends the first greeting before the user types. |
| S2.2 | Shenzhen itinerary | Send `为我制定5日深圳旅游攻略` | Agent calls web search plus Dida demo hotel / transfer / attraction tools, then returns a 5-day Shenzhen itinerary with hotel options, transfer option, attraction candidates, and budget estimate. |
| S2.3 | Feedback refinement | Send a constraint change such as `预算低一点` or `想住海边` | Agent preserves confirmed constraints, updates only affected itinerary/hotel choices, and re-quotes impacted items. |
| S2.4 | Dida-aligned hotel booking order | Confirm the itinerary and provide guest/contact info | Tool call order is exactly `dida_demo_search_hotels` or prior selected quote -> `dida_demo_price_confirm(preBook=true)` -> `dida_demo_book_hotel` -> `dida_demo_get_booking`. `BookingConfirm` must use a `ReferenceNo` produced by `PriceConfirm`. |
| S2.5 | Booking status safety | Force simulator statuses `0`, `1`, `5`, and `6` in separate runs | Agent says the order is processing / awaiting final confirmation. It may only say "预订已确认" when `BookingSearch` returns status `2 Confirmed`; status `3` is canceled and `4` is failed. |
| S2.6 | Demo boundary | Inspect final user-facing confirmation | Message clearly states this is a simulated Demo booking, masks phone/email where displayed, and does not claim real payment, real Dida production order, or real WeChat integration. |

## S3 — Chinese output + MCP fixture display fields

Locks the Chinese-language policy added to `座联互动/DESIGN.md`: Sitlink serves a Chinese enterprise customer, so user-facing Agent replies must be Simplified Chinese while Dida-aligned machine fields remain intact for booking correctness and future real-API migration.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| S3.1 | MCP Chinese display fields | `src/server.test.ts` calls hotel, transfer, attraction, price-confirm, booking, and booking-search demo tools | PASS 2026-06-02: every user-facing candidate/detail includes `locale="zh-CN"` plus Chinese display fields such as `hotelNameZh`, `roomNameZh`, `cancellationPolicyZh`, `transferNameZh`, `attractionNameZh`, and `displaySummaryZh`; machine fields such as `hotelId`, `ratePlanId`, `metadata`, `referenceNo`, `bookingId`, `status`, and `statusName` remain unchanged. |
| S3.2 | Agent Chinese customer-service output | Run the full planned web-demo conversation | User-visible content is Simplified Chinese except necessary Dida IDs, booking IDs, email, phone masks, and auditable status-code notes; the Agent does not expose raw English hotel names, room names, or cancellation policies when Chinese display fields exist. |

## S4 — AI travel concierge employee workspace (Milestone 2)

Locks the `zuolian-travel-concierge` employee source workspace added for `座联互动/DESIGN.md` Milestone 2.

Run:

```bash
npx tsx scripts/test-zuolian-agent.ts
```

Expected: all 65 checks pass. This is an offline smoke test; it does not invoke an LLM or a live OpenClaw gateway. A live CLI/dashboard conversation remains part of S2 once the web demo route exists.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| S4.1 | Native workspace files | `scripts/test-zuolian-agent.ts` checks `sentura/agents/zuolian-travel-concierge/` | The 8 OpenClaw-native files exist: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`; no `RULES.md` or `CONTEXT.md`. |
| S4.2 | Required skills | Script checks `skills/*/SKILL.md` | 5 skills exist: `travel-intake`, `itinerary-planning`, `dida-hotel-booking`, `booking-status`, `feedback-refinement`, each with use/procedure guidance. |
| S4.3 | Agent config shape | Script parses `config.json5` | `agents.list` contains `zuolian-travel-concierge`; runtime is embedded; current model is pinned to `agentRuntime.id: "openclaw"`; sandbox is `non-main`; no `systemPrompt` or workspace override; webchat binding exists. |
| S4.4 | Dida demo MCP wiring | Script parses `config.json5` | `mcp.servers.dida-travel-demo` uses `command: "node"`, an argument ending in `sentura/mcp-servers/dida-travel-demo/dist/index.js`, and `DIDA_DEMO_MODE: "fixture"`. |
| S4.5 | Tool visibility | Script checks agent allowlists | Agent uses `tools.profile: "coding"` plus `tools.allow: ["group:plugins", "web_search", "web_fetch"]` so OpenClaw 2026.6.2 creates the MCP bundle runtime while allowing web research supplement; `tools.sandbox.tools.allow: ["dida-travel-demo__*", "web_search", "web_fetch"]` keeps the final sandboxed surface to Dida demo MCP plus web research. High-risk tools such as `exec`, `gateway`, `write`, `edit`, and `apply_patch` are denied. |
| S4.6 | Safety instructions | Script checks workspace text | Hard Rules require Simplified Chinese user output, Dida hotel/transfer/attraction tools before final itinerary answers, web research only after Dida as public-information supplement, `PriceConfirm` as source of truth, and "confirmed" only for Dida status `2 Confirmed`; booking skill requires `preBook: true` and `referenceNo`. |
| S4.7 | Setup wiring | Script checks `scripts/sentura-setup.{sh,ps1}` plus `bash -n scripts/sentura-setup.sh` | Both setup scripts copy/register `zuolian-travel-concierge` as a client-demo source agent, pin its preferred model runtime to OpenClaw, and wire `mcp.servers.dida-travel-demo` with `DIDA_DEMO_MODE=fixture`; setup uses absolute Dida MCP `dist/index.js` paths and bash setup has no shell-parse errors from embedded JavaScript. |

## S5 — Zuolian web demo route (Milestone 3)

Locks the Dashboard web route added for `座联互动/DESIGN.md` Milestone 3. This is an offline structural test for the route and shared chat component wiring; the full live LLM/tool-order conversation remains S2 / Milestone 4.

Run:

```bash
npx tsx scripts/test-zuolian-web-demo.ts
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm build
```

Expected: `scripts/test-zuolian-web-demo.ts` reports 41 passing checks; `next build` lists `/client-demos/zuolian` in the generated route table.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| S5.1 | Route and navigation | Script checks `sentura/dashboard/src/app/client-demos/zuolian/page.tsx` and `src/components/sidebar.tsx` | `/client-demos/zuolian` exists, is a client component, targets `zuolian-travel-concierge`, renders `AgentChat`, and appears in the Dashboard sidebar as "Zuolian Demo". |
| S5.2 | Scan-context proactive greeting seed | Script checks page constants and Gateway call | Page defines the airport charging-scan context (`charging_qr_scanned`, `深圳宝安国际机场`, `深圳`, station `SZX-A01`) and calls `client.createSession(AGENT_ID, seedMessage, ...)` so the greeting is generated by the Agent rather than hardcoded. |
| S5.3 | Hidden technical seed | Script checks `AgentChat` props and implementation | `AgentChat` exposes `hiddenUserPrefixes`, filters the technical seed from hydrated transcripts, and the page passes `[HIDDEN_SEED_PREFIX]` so users see the Agent's greeting without the internal seed prompt. |
| S5.4 | Refresh recovery | Script checks localStorage/session validation logic | Page persists the session key in `localStorage`, validates it with `client.getSession(stored)` on load, clears stale keys, and the "重开 Demo" control creates a fresh seeded session. |
| S5.5 | Quick actions | Script checks route copy and `AgentChatHandle` | Five buttons exist: "制定 5 日深圳旅游攻略", "预算低一点", "住海边", "确认并预订", "查询订单"; buttons send through `chatRef.current.sendMessage(message)`. |
| S5.6 | Side status panels | Script checks page text and tool mappings | Page renders scan-context, itinerary/tool status, and order-status panels. Tool-flow state maps Dida hotel / transfer / attraction / price confirm / booking / booking search plus `web_search` / `web_fetch`. |
| S5.7 | Order status safety display | Script checks order parser and copy | Side panel extracts `bookingId`, `referenceNo`, and Dida `status`; user-facing copy states only status `2 Confirmed` can be treated as confirmed. |
| S5.8 | Build and visual smoke | `next build` plus in-app browser smoke | Build prerenders `/client-demos/zuolian`; browser smoke on desktop and narrow viewport shows the page renders without text overlap, with small screens using the compact icon sidebar. |
