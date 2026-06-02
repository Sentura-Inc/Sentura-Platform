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
