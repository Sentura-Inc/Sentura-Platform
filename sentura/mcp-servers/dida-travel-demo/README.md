# Sentura DidaTravel Demo MCP Server

Fixture-first MCP server for the 座联互动 Phase 1 MVP. It simulates the DidaTravel hotel flow with official endpoint names and status semantics, while keeping network calls disabled by default.

Runtime fixtures currently cover seven destination cities for the airport-to-airport demo: 深圳、广州、北京、上海、杭州、香港、澳门. Each city has five hotel candidates using real hotel names and five attraction candidates using real attraction names; Demo IDs, prices, cancellation policies, blank image slots, and booking outcomes remain simulated fixtures.

The server uses a two-layer response shape:

- Dida-aligned machine fields stay unchanged, such as `hotelId`, `ratePlanId`, `metadata`, `referenceNo`, `bookingId`, `status`, and `statusName`.
- Sitlink user-facing fields use Simplified Chinese display data, such as `locale: "zh-CN"`, `hotelNameZh`, `roomNameZh`, `cancellationPolicyZh`, `descriptionZh`, `facilitiesZh`, `nearbyZh`, `images.caption`, `images.url`, `images.isDefault`, `transferNameZh`, `attractionNameZh`, and `displaySummaryZh`. Demo image `url` values are intentionally empty so the web demo renders blank placeholders instead of real images.

## Mode

- `DIDA_DEMO_MODE=fixture` runs deterministic local fixtures. This is the default and the only active mode for Milestone 1.
- `DIDA_DEMO_MODE=proxy-disabled` keeps the same tool surface but still refuses live proxying. Real Dida credentials must not be used by this demo package.

## Tools

- `dida_demo_search_hotels` maps to Dida Booking API `POST /api/rate/pricesearch?$format=json`.
- `dida_demo_get_hotel_details` maps to Dida Content API `GET /api/v1/hotel/details`; it returns static hotel details for a specific list of hotel IDs. The Zuolian web demo's `/api/client-demos/zuolian/hotel-details` route reuses `DidaTravelDemoClient.getHotelDetails()` so the phone-contained hotel modal is filled from the same MCP fixture payload, while Agent-initiated detail tool calls remain available.
- `dida_demo_price_confirm` maps to `POST /api/rate/PriceConfirm?$format=json`; `preBook=true` creates a `ReferenceNo`, while `preBook=false` only confirms price.
- `dida_demo_book_hotel` maps to `POST /api/booking/HotelBookingConfirm?$format=json`; it requires a `ReferenceNo` created by `preBook=true`.
- `dida_demo_get_booking` maps to `POST /api/booking/HotelBookingSearch?$format=json`; only status `2`, `3`, and `4` are final.
- `dida_demo_pre_cancel_booking` maps to `POST /api/booking/HotelBookingCancel?$format=json`; it returns a cancellation amount and `ConfirmID` but does not cancel the order by itself.
- `dida_demo_cancel_booking` maps to `POST /api/booking/HotelBookingCancelConfirm?$format=json`; it requires the pre-cancel `ConfirmID` and changes the fixture booking to status `3 Canceled`.
- `dida_demo_modify_booking` is a composite fixture flow for order changes: BookingCancel pre-cancel, BookingCancelConfirm, PriceSearch, PriceConfirm(`preBook=true`), then BookingConfirm with updated details.
- `dida_demo_search_transfer` dynamically returns local airport-to-hotel/area transfer fixtures for the supplied pickup/dropoff.
- `dida_demo_search_attractions` returns local fixture attraction candidates for the selected destination city.

## Verify

```bash
pnpm --filter @sentura/mcp-dida-travel-demo test
pnpm --filter @sentura/mcp-dida-travel-demo build
```
