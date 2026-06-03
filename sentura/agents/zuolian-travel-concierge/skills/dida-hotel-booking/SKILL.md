# Dida Hotel Booking Skill

## When to Use

Use this skill when the user confirms a selected hotel option and provides enough guest/contact information to create a simulated Phase 1 hotel booking.

Also use this skill for post-booking changes:

- User says they are not going, wants to cancel, or asks to remove the booking.
- User asks to modify dates, hotel, room count, guest count, budget, or area after a simulated order exists.

## Required Tools

- `dida-travel-demo__dida_demo_search_hotels`
- `dida-travel-demo__dida_demo_price_confirm`
- `dida-travel-demo__dida_demo_book_hotel`
- `dida-travel-demo__dida_demo_get_booking`
- `dida-travel-demo__dida_demo_pre_cancel_booking`
- `dida-travel-demo__dida_demo_cancel_booking`
- `dida-travel-demo__dida_demo_modify_booking`

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

## Cancellation Procedure

1. Identify the latest simulated `bookingId` or `referenceNo`.
2. Call `dida-travel-demo__dida_demo_pre_cancel_booking` with the order identifier and cancellation reason.
3. Read `confirmId`, `amountCny`, `refundAmountCny`, and `expiresAt`.
4. Call `dida-travel-demo__dida_demo_cancel_booking` with the same booking identifier plus `confirmId`.
5. Call `dida-travel-demo__dida_demo_get_booking` and only say canceled if status is `3`.

```text
dida-travel-demo__dida_demo_pre_cancel_booking
-> dida-travel-demo__dida_demo_cancel_booking
-> dida-travel-demo__dida_demo_get_booking
```

## Modification Procedure

Modification is cancel-and-rebook. When `dida-travel-demo__dida_demo_modify_booking` is available, use it once with the existing order identifier and only the updated constraints. The tool performs this sequence in the background:

```text
BookingCancel.PreCancel
-> BookingCancel.CancelConfirm
-> PriceSearch
-> PriceConfirm(preBook=true)
-> BookingConfirm
```

After the tool returns, summarize both the old canceled order and the new booking. If the composite tool is unavailable, perform the same sequence manually with the individual tools.

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
- Do not say canceled after pre-cancel alone; status `3` is required.
