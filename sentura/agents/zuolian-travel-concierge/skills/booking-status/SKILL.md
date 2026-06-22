# Booking Status Skill

## When to Use

Use this skill after `dida-travel-demo__dida_demo_get_booking`, when the user asks for order status, or when explaining a simulated booking result.

## Status Map

| Status | Dida Name | Final | User Wording |
|---:|---|---|---|
| 0 | PreBook | no | 订单处理中/待确认，不是最终状态 |
| 1 | Booked | no | 订单处理中/待确认，不是最终状态 |
| 2 | Confirmed | yes | 酒店预订已确认 |
| 3 | Canceled | yes | 订单已取消 |
| 4 | Failed | yes | 预订失败 |
| 5 | Pending | no | 订单处理中/待确认，不是最终状态 |
| 6 | OnRequest | no | 订单处理中/待确认，不是最终状态 |

## Procedure

1. Read `status`, `statusName`, `final`, and any Chinese display summary from the tool response.
2. If status is `2`, generate the confirmation wording and include the auditable note "Dida 状态：2 Confirmed".
3. If status is `3`, say "订单已取消" and include the cancellation fee / refund simulation if the tool returned it.
4. If status is `4`, describe the failed terminal outcome and offer a safe next step.
5. If status is `0`, `1`, `5`, or `6`, explain that the order is processing / awaiting final confirmation and that it is not final.
6. Include the Demo boundary in all status replies.

## Output Requirements

- Use Simplified Chinese plain chat text.
- Do not use Markdown headings, bullet lists, tables, bold/italic markup, or fenced code blocks in user-facing replies.
- Keep the reply short and service-oriented, with natural line breaks if several order fields must be shown.

## Contact Masking

- Phone: keep the first 3 and last 4 digits, replace the middle with `****`.
- Email: keep the first 2 characters and domain when possible, replace the middle with `***`.

## Safety

- Never translate a non-final status into success.
- Never hide a failed or canceled terminal status.
- Never use status wording that implies payment has occurred.
