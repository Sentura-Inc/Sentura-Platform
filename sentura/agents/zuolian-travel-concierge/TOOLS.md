# 座联出行客服 — TOOLS.md

## Dida Demo MCP Tools

All Dida demo tools are fixture-only for Phase 1. They must never be described as live production supplier calls.

| OpenClaw tool | MCP tool | Use | Notes |
|---|---|---|
| `dida-travel-demo__dida_demo_search_hotels` | `dida_demo_search_hotels` | Search destination-city hotel/rate candidates | Uses Content API + PriceSearch-aligned fixture output. Preserve `metadata`. |
| `dida-travel-demo__dida_demo_get_hotel_details` | `dida_demo_get_hotel_details` | Retrieve hotel static details | Uses Content API `/api/v1/hotel/details`-aligned fixture output for clicked hotel cards. |
| `dida-travel-demo__dida_demo_price_confirm` | `dida_demo_price_confirm` | Confirm final hotel price and optionally prebook | Call with `preBook: true` before booking. Final price and cancellation policy win over search. |
| `dida-travel-demo__dida_demo_book_hotel` | `dida_demo_book_hotel` | Create simulated hotel booking | Requires unused `referenceNo` from `preBook: true`. Mutating Demo tool. |
| `dida-travel-demo__dida_demo_get_booking` | `dida_demo_get_booking` | Query simulated booking status | Only status `2 Confirmed` is user-facing confirmed success. |
| `dida-travel-demo__dida_demo_pre_cancel_booking` | `dida_demo_pre_cancel_booking` | Pre-cancel simulated booking | Dida Booking Cancel first step. Returns cancellation amount and `ConfirmID`; does not cancel by itself. |
| `dida-travel-demo__dida_demo_cancel_booking` | `dida_demo_cancel_booking` | Confirm simulated booking cancellation | Dida BookingCancelConfirm second step. Requires `ConfirmID`; changes status to `3 Canceled`. Mutating Demo tool. |
| `dida-travel-demo__dida_demo_modify_booking` | `dida_demo_modify_booking` | Modify simulated booking | Composite background flow: cancel old order, then PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm for updated details. Mutating Demo tool. |
| `dida-travel-demo__dida_demo_search_transfer` | `dida_demo_search_transfer` | Search airport transfer fixture options | Local fixture, not Dida production. |
| `dida-travel-demo__dida_demo_search_attractions` | `dida_demo_search_attractions` | Search destination-city attraction fixture options | Local fixture, not Dida production. |

## Web Research Tools

Use web tools only after the Dida demo tools when current public information matters.

| Tool | Use | Boundary |
|---|---|---|
| `web_search` | Search public destination-city travel context, weather, opening-hour notes, route cautions, or current attraction context | Supplement only; do not treat as bookable inventory. |
| `web_fetch` | Fetch a page returned by search when source detail is needed | Supplement only; do not replace Dida demo candidates. |

## Tool Order

Itinerary planning must call these three Dida demo tools before the final answer:

```text
dida-travel-demo__dida_demo_search_hotels
dida-travel-demo__dida_demo_search_transfer
dida-travel-demo__dida_demo_search_attractions
```

Then, if current public information would improve the plan, use `web_search` / `web_fetch` as supplement. Do not mention tool names to normal users.

Hotel booking must follow this order:

```text
dida-travel-demo__dida_demo_search_hotels
-> dida-travel-demo__dida_demo_get_hotel_details (when the user asks to inspect a hotel)
-> dida-travel-demo__dida_demo_price_confirm(preBook=true)
-> dida-travel-demo__dida_demo_book_hotel
-> dida-travel-demo__dida_demo_get_booking
```

If a previous search candidate is already selected and still valid, you may reuse it, but you still must run `dida-travel-demo__dida_demo_price_confirm(preBook=true)` before booking.

Canceling a simulated hotel order must follow this order when the user says they are not going, wants to cancel, or no longer needs the trip:

```text
dida-travel-demo__dida_demo_pre_cancel_booking
-> dida-travel-demo__dida_demo_cancel_booking
-> dida-travel-demo__dida_demo_get_booking
```

Pre-cancel only returns the Dida cancel `ConfirmID` and cancellation amount. Do not say the order is canceled until `dida-travel-demo__dida_demo_cancel_booking` returns status `3 Canceled` or `dida-travel-demo__dida_demo_get_booking` confirms status `3`.

Order modification must be implemented as cancel-and-rebook in the background. Prefer the composite tool when available:

```text
dida-travel-demo__dida_demo_modify_booking
```

If the composite tool is unavailable, perform the same sequence manually:

```text
dida-travel-demo__dida_demo_pre_cancel_booking
-> dida-travel-demo__dida_demo_cancel_booking
-> dida-travel-demo__dida_demo_search_hotels
-> dida-travel-demo__dida_demo_price_confirm(preBook=true)
-> dida-travel-demo__dida_demo_book_hotel
-> dida-travel-demo__dida_demo_get_booking
```

## Contact Handling

- Minimum booking fields: pinyin / English guest name, phone, email, adult / child count, room count.
- Do not request ID card or passport number in Phase 1.
- Mask phone and email in final customer-facing summaries.
