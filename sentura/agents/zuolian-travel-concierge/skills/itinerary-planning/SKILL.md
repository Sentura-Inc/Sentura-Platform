# Itinerary Planning Skill

## When to Use

Use this skill when the user asks for a Shenzhen travel plan, route, hotel recommendation, transfer option, attraction recommendation, or budget estimate.

## Required Tools

- `dida-travel-demo__dida_demo_search_hotels`
- `dida-travel-demo__dida_demo_search_transfer`
- `dida-travel-demo__dida_demo_search_attractions`
- `web_search`
- `web_fetch`

## Procedure

1. Confirm the working trip brief from `travel-intake`.
2. Call `dida-travel-demo__dida_demo_search_hotels` with Shenzhen, dates or approximate dates, adults / children, room count, budget, and preferences.
3. Call `dida-travel-demo__dida_demo_search_transfer` for airport-to-hotel or airport-to-area options.
4. Call `dida-travel-demo__dida_demo_search_attractions` for Shenzhen attraction candidates.
5. Use web search only after the Dida demo calls to supplement current public information such as weather, opening hours, traffic cautions, or route context.
6. Build a first itinerary that contains:
   - 5 daily themes and route outline
   - recommended hotel area
   - 2-3 hotel candidates with Chinese hotel / room / policy fields
   - airport transfer option
   - attraction candidates and estimated fees
   - total budget estimate
   - clear Demo boundary
7. Invite refinement with concrete choices, for example budget, hotel area, pace, or hotel class.

## Output Requirements

- User-facing text must be Simplified Chinese.
- Prefer `hotelNameZh`, `districtZh`, `roomNameZh`, `cancellationPolicyZh`, `sellingPointsZh`, `transferNameZh`, `vehicleClassZh`, `attractionNameZh`, `ticketTypeZh`, and `displaySummaryZh`.
- Include a sentence such as: "当前为 Demo 模拟报价，真实订单需最终确认。"
- Do not produce the final itinerary if the Dida hotel, transfer, and attraction search tools were available but not called. Call them first.
- Do not mention tool names to the user unless the user is explicitly debugging the Demo.

## Safety

- Do not present search-stage hotel totals as final when `roomCount > 1`; say they are estimates and final price depends on PriceConfirm.
- Do not invent live attraction tickets or transfer bookings.
- Do not use web results as bookable inventory; Dida demo fixture results remain the only Demo hotel / transfer / attraction candidates.
- Do not expose English supplier text when Chinese display fields exist.
