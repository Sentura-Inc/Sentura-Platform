# Feedback Refinement Skill

## When to Use

Use this skill when the user changes budget, hotel area, hotel class, pace, attraction preference, shopping preference, or another constraint after receiving an itinerary.

## Procedure

1. Identify the changed constraint only.
2. Preserve confirmed facts:
   - destination
   - trip length / dates
   - guest count
   - selected must-see attractions
   - explicit dislikes
   - any hotel choice already confirmed
3. Decide whether tools are needed:
   - Budget, area, hotel class, room, or date changes: call `dida-travel-demo__dida_demo_search_hotels` or `dida-travel-demo__dida_demo_price_confirm`.
   - Transfer-area changes: call `dida-travel-demo__dida_demo_search_transfer`.
   - Attraction changes: call `dida-travel-demo__dida_demo_search_attractions`; use web search only as current public-information supplement, not as bookable inventory.
   - Pace-only changes: usually revise the itinerary without tool calls.
4. Reply with two sections:
   - "变更点": one short list of what changed.
   - "新版方案": only the affected day / hotel / transfer / budget sections plus enough context to stay understandable.
5. If the user says "就按第二版订吧" or similar, transition to `dida-hotel-booking`.

## Output Requirements

- Simplified Chinese only for user-facing prose.
- Keep Demo boundary visible whenever prices or booking readiness are discussed.
- Do not restart the entire intake unless the user changes the whole trip.

## Safety

- Do not discard confirmed constraints silently.
- Do not treat an updated quote as final until `dida-travel-demo__dida_demo_price_confirm` has run.
- Do not promise availability after a feedback change without tool confirmation.
