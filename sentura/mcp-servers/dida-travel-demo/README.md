# Sentura DidaTravel Demo MCP Server

Fixture-first MCP server for the 座联互动 Phase 1 MVP. It simulates the DidaTravel hotel flow with official endpoint names and status semantics, while keeping network calls disabled by default.

The server uses a two-layer response shape:

- Dida-aligned machine fields stay unchanged, such as `hotelId`, `ratePlanId`, `metadata`, `referenceNo`, `bookingId`, `status`, and `statusName`.
- Sitlink user-facing fields use Simplified Chinese display data, such as `locale: "zh-CN"`, `hotelNameZh`, `roomNameZh`, `cancellationPolicyZh`, `transferNameZh`, `attractionNameZh`, and `displaySummaryZh`.

## Mode

- `DIDA_DEMO_MODE=fixture` runs deterministic local fixtures. This is the default and the only active mode for Milestone 1.
- `DIDA_DEMO_MODE=proxy-disabled` keeps the same tool surface but still refuses live proxying. Real Dida credentials must not be used by this demo package.

## Tools

- `dida_demo_search_hotels` maps to Dida Booking API `POST /api/rate/pricesearch?$format=json`.
- `dida_demo_price_confirm` maps to `POST /api/rate/PriceConfirm?$format=json`; `preBook=true` creates a `ReferenceNo`, while `preBook=false` only confirms price.
- `dida_demo_book_hotel` maps to `POST /api/booking/HotelBookingConfirm?$format=json`; it requires a `ReferenceNo` created by `preBook=true`.
- `dida_demo_get_booking` maps to `POST /api/booking/HotelBookingSearch?$format=json`; only status `2`, `3`, and `4` are final.
- `dida_demo_search_transfer` and `dida_demo_search_attractions` are local fixture tools for Phase 1 itinerary planning.

## Verify

```bash
pnpm --filter @sentura/mcp-dida-travel-demo test
pnpm --filter @sentura/mcp-dida-travel-demo build
```
