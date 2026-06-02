# Dida Hotel Booking Skill

## When to Use

Use this skill when the user confirms a selected hotel option and provides enough guest/contact information to create a simulated Phase 1 hotel booking.

## Required Tools

- `dida-travel-demo__dida_demo_search_hotels`
- `dida-travel-demo__dida_demo_price_confirm`
- `dida-travel-demo__dida_demo_book_hotel`
- `dida-travel-demo__dida_demo_get_booking`

## Preconditions

You need:

- Selected `hotelId`
- Selected `ratePlanId`
- Unmodified `metadata` from hotel search
- Check-in and check-out dates
- Occupancy
- Guest name in pinyin / English
- Phone
- Email
- Room count

If any required item is missing, ask for only that item.

## Procedure

1. If no valid hotel candidate is selected, call `dida-travel-demo__dida_demo_search_hotels` first.
2. Call `dida-travel-demo__dida_demo_price_confirm` with:
   - `hotelId`
   - `ratePlanId`
   - dates
   - occupancy
   - `preBook: true`
   - original `metadata`
3. Read the confirmed price, room, meal, cancellation policy, and `referenceNo`.
4. If no `referenceNo` is returned, stop. Explain in Chinese that Demo prebooking did not produce a booking reference.
5. Call `dida-travel-demo__dida_demo_book_hotel` with:
   - `referenceNo`
   - dates
   - `guestList`
   - `contact`
   - `customerRequest`
   - `clientReference`
6. Immediately call `dida-travel-demo__dida_demo_get_booking` with the returned `bookingId` or `referenceNo`.
7. Use the `booking-status` skill to decide the final wording.

## Required Tool Order

```text
dida-travel-demo__dida_demo_search_hotels
-> dida-travel-demo__dida_demo_price_confirm(preBook=true)
-> dida-travel-demo__dida_demo_book_hotel
-> dida-travel-demo__dida_demo_get_booking
```

If a selected hotel search result already exists in the current conversation, the first call may be considered satisfied, but `dida-travel-demo__dida_demo_price_confirm(preBook=true)` is still mandatory.

## Final Confirmation Template

```text
酒店预订已确认
订单号: <bookingId>
Dida ReferenceNo: <referenceNo>
状态: 2 Confirmed（Dida 状态，最终成功）
酒店: <hotelNameZh>
入住/离店: <checkInDate> 至 <checkOutDate>
房型: <roomNameZh>
入住人: <guest summary>
联系电话: <masked phone>
邮箱: <masked email>
取消政策: <cancellationPolicyZh>
备注: 当前为座联互动 Phase 1 Demo 模拟预订，不代表真实付款或真实 Dida 生产订单。
```

## Safety

- Do not call booking with `preBook: false` output.
- Do not reuse a `referenceNo`.
- Do not ask for passport or ID number.
- Do not say confirmed unless booking search returns status `2`.
