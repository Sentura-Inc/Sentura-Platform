# Travel Intake Skill

## When to Use

Use this skill at the start of a Sitlink travel session, after a charging QR scan context arrives, or whenever the user's travel requirements are incomplete.

## Procedure

1. Read the available scan context: user location, destination city, charging station, detected time, and language.
2. Extract travel facts from the user's message:
   - destination city
   - trip length or dates
   - adults, children, and room count
   - budget level
   - hotel area preference
   - pace preference
   - must-see or must-avoid attractions
   - booking readiness
3. Ask only for missing facts that block the next step. If the user asks for a 5-day Shenzhen itinerary, assume destination is Shenzhen and proceed with a first draft instead of interrogating them.
4. Keep a short working summary in the reply before moving into planning:
   - "我先按 5 天、深圳、轻松城市探索来出第一版；人数/预算缺失处先用 Demo 默认值，后面可改。"
5. If the user provides booking contact information, validate only the minimum Phase 1 fields: pinyin / English guest name, phone, email, guest count, and room count.

## Defaults for the Phase 1 Demo

- Destination: 深圳.
- Arrival area: 深圳宝安国际机场.
- Trip length: 5 days if the user asks for a 5-day plan.
- Adults: 1 when unspecified.
- Children: 0 when unspecified.
- Room count: 1 when unspecified.
- Currency: CNY.
- Nationality: CN.
- Language: zh-CN.

## Safety

- Do not request ID card, passport, payment-card, or account credential data.
- Do not claim real booking readiness from incomplete information.
- If contact details are repeated back, mask phone and email.
