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

Expected: `src/server.test.ts` reports 16 passing tests (Milestone 1 flow/status tests, S3.1 Chinese-display-field assertion, Content API detail assertion including blank Dida image fields, 7-city hotel/attraction fixture coverage, Dida Booking Cancel two-step coverage, and modify-by-cancel-rebook coverage) and `tsc -p tsconfig.json` completes with no TypeScript errors.

| # | Test | Method | Expected result |
|---|------|--------|-----------------|
| S1.1 | Config defaults | `loadConfigFromEnv({})` | `mode="fixture"`, booking base `https://apiint.didatravel.com`, content base `https://static-apiint.didatravel.com`. |
| S1.2 | Tool catalog | `listTools()` | Exactly 10 tools: hotel search, hotel details, price confirm, hotel booking, booking search, pre-cancel, cancel confirm, modify booking, transfer search, attraction search. Hotel/cancel tools expose the official Dida endpoint names in metadata. |
| S1.3 | MCP annotations | Connect via `InMemoryTransport` and call `client.listTools()` | Discovery tools are `readOnlyHint=true`; `dida_demo_book_hotel`, `dida_demo_cancel_booking`, and `dida_demo_modify_booking` are `destructiveHint=true` for approval-aware clients. |
| S1.4 | Happy path | Call MCP tools in order | `PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm -> BookingSearch`; booking returns status `2 Confirmed`, `final=true`. |
| S1.5 | `preBook=false` boundary | Call `priceConfirm({ preBook:false })` then try booking | No `ReferenceNo` is returned and `BookingConfirm` rejects missing/non-prebook references. |
| S1.6 | Metadata integrity | Alter `Metadata` before `PriceConfirm` | Server rejects because Dida requires `Metadata` from PriceSearch to be passed unchanged. |
| S1.7 | Duplicate reference guard | Call `BookingConfirm` twice with one `ReferenceNo` | Second call fails; a prebook reference is single-use. |
| S1.8 | Status semantics | Force statuses `0/1/5/6` and `2/3/4` | `0/1/5/6` are non-final; only `2/3/4` return `final=true`. |
| S1.9 | Transfer fixtures | `dida_demo_search_transfer` | Returns local airport-to-hotel/area transfer options for the supplied pickup/dropoff, source `demo-fixture`. |
| S1.10 | Attraction fixtures | `dida_demo_search_attractions` | Returns local destination-city attraction ticket options, source `demo-fixture`. |
| S1.11 | Hotel detail fixture | `dida_demo_get_hotel_details` | Returns Content API `/api/v1/hotel/details`-aligned static details for a supplied `hotelIds` list, including `descriptionZh`, `facilitiesZh`, `nearbyZh`, `addressZh`, `geo`, `images.caption`, blank `images.url`, `images.isDefault`, room details, and Dida machine fields. |
| S1.12 | Shenzhen fixture expansion | `dida_demo_search_hotels({ city:"深圳" })` and `dida_demo_search_attractions({ city:"深圳" })` | Shenzhen returns 5 real hotel-name fixtures and 5 real attraction-name fixtures. |
| S1.13 | 7-city fixture coverage | Loop over 深圳、广州、北京、上海、杭州、香港、澳门 | Each supported destination returns exactly 5 hotel candidates and 5 attraction candidates. |
| S1.14 | Booking Cancel two-step | Create a booking, call `dida_demo_pre_cancel_booking`, then `dida_demo_cancel_booking` | Pre-cancel returns `ConfirmID`, cancellation amount, and refund estimate without changing status; CancelConfirm uses `ConfirmID` and changes the order to status `3 Canceled`; BookingSearch confirms final cancellation. |
| S1.15 | CancelConfirm guard | Call `dida_demo_cancel_booking` with a missing `ConfirmID` | Server rejects because CancelConfirm requires a valid ConfirmID from pre-cancel. |
| S1.16 | Modify booking | Create a booking, call `dida_demo_modify_booking` with updated details | Tool reports `BookingCancel.PreCancel -> BookingCancel.CancelConfirm -> PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm`; old order is status `3`, replacement order is status `2`. |

## S2 — Phase-1 web demo + DidaTravel simulated booking flow

Locks the planned web-demo deliverable designed in `座联互动/DESIGN.md`.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| S2.1 | Proactive greeting | Open `/client-demos/zuolian` with a clean session | Page injects the simulated boarding-gate QR context; `zuolian-travel-concierge` sends the first greeting before the user types. |
| S2.2 | Destination-city itinerary | Select a destination airport, then send `为我制定5日{目的地城市}旅游攻略` | Agent calls Dida demo hotel / transfer / attraction tools for the selected destination city, optionally supplements with web search, then returns a 5-day itinerary with hotel options, transfer option, attraction candidates, and budget estimate. |
| S2.3 | Clickable hotel detail | Click one hotel card in the left "酒店候选" panel after S2.2, then click a candidate hotel name inside an assistant reply | Both clicks open the same local hotel-detail modal. The page must not send a hotel-detail chat message. The modal shows Chinese static details such as description, address, facilities, nearby POIs, room, cancellation policy context, and blank image placeholders. |
| S2.4 | Feedback refinement | Send a constraint change such as `预算低一点` or `想住海边` | Agent preserves confirmed constraints, updates only affected itinerary/hotel choices, and re-quotes impacted items. |
| S2.5 | Dida-aligned hotel booking order | Confirm the itinerary and provide guest/contact info | Tool call order is exactly `dida_demo_search_hotels` or prior selected quote -> optional `dida_demo_get_hotel_details` for inspected hotel -> `dida_demo_price_confirm(preBook=true)` -> `dida_demo_book_hotel` -> `dida_demo_get_booking`. `BookingConfirm` must use a `ReferenceNo` produced by `PriceConfirm`. |
| S2.6 | Booking status safety | Force simulator statuses `0`, `1`, `5`, and `6` in separate runs | Agent says the order is processing / awaiting final confirmation. It may only say "预订已确认" when `BookingSearch` returns status `2 Confirmed`; status `3` is canceled and `4` is failed. |
| S2.7 | Demo boundary | Inspect final user-facing confirmation | Message clearly states this is a simulated Demo booking, masks phone/email where displayed, and does not claim real payment, real Dida production order, or real WeChat integration. |
| S2.8 | Order cancellation | After a simulated booking, send `我不去了，请取消订单` | Agent calls `dida_demo_pre_cancel_booking` -> `dida_demo_cancel_booking` -> `dida_demo_get_booking`; user-facing copy only says canceled after status `3 Canceled` and includes Demo boundary. |
| S2.9 | Order modification | After a simulated booking, ask to change dates/hotel/area | Agent uses `dida_demo_modify_booking` or the equivalent manual chain: pre-cancel -> cancelconfirm -> PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm -> BookingSearch; final reply names old canceled order and new booking. |

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

Expected: all 80 checks pass. This is an offline smoke test; it does not invoke an LLM or a live OpenClaw gateway. A live CLI/dashboard conversation remains part of S2 once the web demo route exists.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| S4.1 | Native workspace files | `scripts/test-zuolian-agent.ts` checks `sentura/agents/zuolian-travel-concierge/` | The 8 OpenClaw-native files exist: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`; no `RULES.md` or `CONTEXT.md`. |
| S4.2 | Required skills | Script checks `skills/*/SKILL.md` | 5 skills exist: `travel-intake`, `itinerary-planning`, `dida-hotel-booking`, `booking-status`, `feedback-refinement`, each with use/procedure guidance. |
| S4.3 | Agent config shape | Script parses `config.json5` | `agents.list` contains `zuolian-travel-concierge`; runtime is embedded; current model is pinned to `agentRuntime.id: "openclaw"`; sandbox is `non-main`; no `systemPrompt` or workspace override; webchat binding exists. |
| S4.4 | Dida demo MCP wiring | Script parses `config.json5` | `mcp.servers.dida-travel-demo` uses `command: "node"`, an argument ending in `sentura/mcp-servers/dida-travel-demo/dist/index.js`, and `DIDA_DEMO_MODE: "fixture"`. |
| S4.5 | Tool visibility | Script checks agent allowlists | Agent uses `tools.profile: "coding"` plus `tools.allow: ["group:plugins", "web_search", "web_fetch"]` so OpenClaw 2026.6.2 creates the MCP bundle runtime while allowing web research supplement; `tools.sandbox.tools.allow: ["dida-travel-demo__*", "web_search", "web_fetch"]` keeps the final sandboxed surface to Dida demo MCP plus web research. High-risk tools such as `exec`, `gateway`, `write`, `edit`, and `apply_patch` are denied. |
| S4.6 | Safety instructions | Script checks workspace text | Hard Rules require Simplified Chinese user output, normal chat-text replies instead of Markdown documents, no Markdown headings/tables/bullets/bold/code fences in customer-facing replies, Dida hotel/transfer/attraction tools before final itinerary answers, web research only after Dida as public-information supplement, dynamic destination-city identity/intake wording, `PriceConfirm` as source of truth, "confirmed" only for Dida status `2 Confirmed`, cancel only after status `3`, and modification as cancel-and-rebook; booking skill requires `preBook: true`, `referenceNo`, pre-cancel, CancelConfirm, modify guidance, and a plain-chat final confirmation style. |
| S4.7 | Setup wiring | Script checks `scripts/sentura-setup.{sh,ps1}` plus `bash -n scripts/sentura-setup.sh` | Both setup scripts copy/register `zuolian-travel-concierge` as a client-demo source agent, pin its preferred model runtime to OpenClaw, and wire `mcp.servers.dida-travel-demo` with `DIDA_DEMO_MODE=fixture`; setup uses absolute Dida MCP `dist/index.js` paths and bash setup has no shell-parse errors from embedded JavaScript. |

## S5 — Zuolian web demo route (Milestone 3)

Locks the Dashboard web route added for `座联互动/DESIGN.md` Milestone 3. This is an offline structural test for the route, shared chat component wiring, and the client-facing iPhone/企业微信 chat presentation; the full live LLM/tool-order conversation remains S2 / Milestone 4.

Run:

```bash
npx tsx scripts/test-zuolian-web-demo.ts
cd sentura/dashboard && pnpm exec tsc --noEmit
cd sentura/dashboard && pnpm build
```

Expected: `scripts/test-zuolian-web-demo.ts` reports 98 passing checks; `next build` lists `/client-demos/zuolian` and `/api/client-demos/zuolian/hotel-details` in the generated route table.

| # | Test | Method | What to Check |
|---|------|--------|---------------|
| S5.1 | Route and navigation | Script checks `sentura/dashboard/src/app/client-demos/zuolian/page.tsx` and `src/components/sidebar.tsx` | `/client-demos/zuolian` exists, is a client component, targets `zuolian-travel-concierge`, renders `AgentChat`, and appears in the Dashboard sidebar as "Zuolian Demo". |
| S5.2 | Scan-context proactive greeting seed | Script checks page constants and Gateway call | Page defines a boarding-gate QR context (`boarding_gate_qr_scanned`, origin/destination airport codes, destination airport/city, station like `CAN-GATE-A01`), creates the session only after airport confirmation, then sends the seed through `AgentChat.sendMessage()` as a hidden user message so the greeting is generated by the Agent rather than hardcoded. |
| S5.3 | Hidden technical seed | Script checks `AgentChat` props and implementation | `AgentChat` exposes `hiddenUserPrefixes`, filters the technical seed from hydrated transcripts, and the page passes `[HIDDEN_SEED_PREFIX]` so users see the Agent's greeting without the internal seed prompt. |
| S5.4 | Refresh recovery | Script checks localStorage/session validation logic | Page persists airport-scoped session keys in `localStorage`, validates them with `client.getSession(stored)` on load, re-sends the hidden scan seed if the restored transcript is empty, clears stale keys, and the "重开 Demo" control creates a fresh seeded session. |
| S5.5 | Airport selectors and confirmation gate | Script checks route copy and selector logic | Page renders origin and destination airport dropdowns with 广州、北京、上海、杭州、香港、澳门、深圳 airport options; the destination selector disables the current origin airport; "确认机场并通知客服" is required before the page creates/switches the Agent session. |
| S5.6 | Quick actions | Script checks route copy and `AgentChatHandle` | Seven buttons exist with dynamic destination-city copy: "制定 5 日{目的地城市}旅游攻略", "预算低一点", "住宿更方便", "确认并预订", "查询订单", "取消订单", "修改订单"; buttons send through `chatRef.current.sendMessage(message)` and remain disabled until the airport route is confirmed and the session is ready. Cancel/modify buttons explicitly request Dida Booking Cancel pre-cancel/cancelconfirm and background cancel-and-rebook. |
| S5.7 | Clickable hotel candidates and MCP-backed modal | Script checks page text, parsers, `handleHotelClick`, `AgentChat` interactive terms, and `src/app/api/client-demos/zuolian/hotel-details/route.ts` | Page extracts hotel candidates from `dida_demo_search_hotels` tool results, renders them as clickable cards, makes known hotel names inside assistant bubbles visibly clickable, and opens the same `HotelDetailDialog` for both surfaces. The modal is rendered as an absolute overlay inside the simulated iPhone shell, not as a full-page portal. Opening the modal fetches `/api/client-demos/zuolian/hotel-details`, whose route reuses `DidaTravelDemoClient.getHotelDetails()` so the detail content comes from the MCP fixture payload. The modal shows loading/error states and renders MCP fields such as `descriptionZh`, `addressZh`, `facilitiesZh`, `nearbyZh`, room/board/cancellation policy, check-in instructions, geo, and source metadata instead of using a uniform template. The chat term list falls back to a 35-hotel local demo catalog only for matching clickable hotel names before the MCP detail fetch. Candidate clicks must not call `AgentChat.sendMessage()` with a hotel-detail request. |
| S5.8 | Side status panels | Script checks page text and tool mappings | Page renders scan-context, hotel-candidate/detail, itinerary/tool status, and order-status panels. Tool-flow state maps Dida hotel search / hotel details / transfer / attraction / price confirm / booking / booking search / pre-cancel / cancelconfirm / modify plus `web_search` / `web_fetch`. |
| S5.9 | Order status safety display | Script checks order parser and copy | Side panel extracts `bookingId`, `referenceNo`, and Dida `status`; modification results prefer `newBooking`; user-facing copy states only status `2 Confirmed` can be treated as confirmed. |
| S5.10 | iPhone / 企业微信 chat shell | Script checks `page.tsx` + `AgentChat` presentation prop | Right chat window is centered in the right panel and wrapped in a screenshot-style iPhone shell with fixed desktop dimensions, blue status bar, title `座联互动客服`, video/more controls, light-grey chat canvas, enterprise/user avatars, WeCom-like bubbles, Chinese input placeholder, and bottom voice/input/smile/plus controls. Before airport confirmation, the WeCom conversation body is blank with no fake startup records, attachment stack, unread preview, or prompt card; after confirmation, the first visible message is generated through `AgentChat` from the hidden seed. The seven quick actions remain wired for the demo but are hidden from the screenshot-style header. |
| S5.11 | Build and visual smoke | `next build` plus in-app browser smoke | Build prerenders `/client-demos/zuolian`; browser smoke confirms default 广州白云 -> 深圳宝安 context, the left status toolbar remains visible, the right side shows the screenshot-style iPhone 企业微信 UI centered in the chat panel, and the page is optimized for desktop demonstration. |
