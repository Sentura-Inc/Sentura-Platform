# Itinerary Planning Skill

## When to Use

Use this skill when the user asks for a destination-city travel plan, route, hotel recommendation, transfer option, attraction recommendation, or budget estimate.

## Required Tools

- `dida-travel-demo__dida_demo_search_hotels`
- `dida-travel-demo__dida_demo_get_hotel_details`
- `dida-travel-demo__dida_demo_search_transfer`
- `dida-travel-demo__dida_demo_search_attractions`
- `web_search`
- `web_fetch`

## Procedure

1. Confirm the working trip brief from `travel-intake`.
2. Identify the destination city from the scan context or the user's message. Supported demo destinations include 深圳、广州、北京、上海、杭州、香港、澳门.
3. Call `dida-travel-demo__dida_demo_search_hotels` with the destination city, dates or approximate dates, adults / children, room count, budget, and preferences.
4. If the user clicks a hotel card or asks to inspect one hotel, call `dida-travel-demo__dida_demo_get_hotel_details` with that `hotelId` and summarize the returned Chinese static details before making a recommendation.
5. Call `dida-travel-demo__dida_demo_search_transfer` for destination-airport-to-hotel or destination-airport-to-area options.
6. Call `dida-travel-demo__dida_demo_search_attractions` for destination-city attraction candidates.
7. Use web search only after the Dida demo calls to supplement current public information such as weather, opening hours, traffic cautions, or route context.
8. Build a first itinerary that contains:
   - 5 daily themes and route outline
   - recommended hotel area
   - 2-3 hotel candidates with Chinese hotel / room / policy fields
   - airport transfer option
   - attraction candidates and estimated fees
   - total budget estimate
   - clear Demo boundary
9. Invite refinement with concrete choices, for example budget, hotel area, pace, or hotel class.

## Output Requirements

- User-facing text must be Simplified Chinese.
- Prefer `hotelNameZh`, `districtZh`, `roomNameZh`, `cancellationPolicyZh`, `sellingPointsZh`, `transferNameZh`, `vehicleClassZh`, `attractionNameZh`, `ticketTypeZh`, and `displaySummaryZh`.
- For clicked hotel details, also use `descriptionZh`, `facilitiesZh`, `nearbyZh`, `addressZh`, and `checkInInstructionsZh`.
- Include a sentence such as: "当前为 Demo 模拟报价，真实订单需最终确认。"
- Do not produce the final itinerary if the Dida hotel, transfer, and attraction search tools were available but not called. Call them first.
- Do not mention tool names to the user unless the user is explicitly debugging the Demo.

## Safety

- Do not present search-stage hotel totals as final when `roomCount > 1`; say they are estimates and final price depends on PriceConfirm.
- Do not invent live attraction tickets or transfer bookings.
- Do not use web results as bookable inventory; Dida demo fixture results remain the only Demo hotel / transfer / attraction candidates.
- Do not expose English supplier text when Chinese display fields exist.
