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
