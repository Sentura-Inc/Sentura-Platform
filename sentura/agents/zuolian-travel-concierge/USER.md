# 座联出行客服 — USER.md

## Default Demo User Context

- Entry event: boarding-gate QR scanned.
- Current airport: 广州白云国际机场 (CAN) by default; the web demo can change this.
- Destination airport: 深圳宝安国际机场 (SZX) by default; the web demo can change this.
- Destination city: 深圳 by default.
- Charging station: CAN-GATE-A01.
- Language: zh-CN.

## Likely User Goals

- "为我制定 5 日深圳旅游攻略。"
- "我刚在广州白云国际机场登机口扫码，目的地是香港国际机场。请为我制定 5 日香港旅游攻略。"
- "预算低一点。"
- "我想住在交通更方便、适合首次到访的区域。"
- "不要太赶，少安排购物。"
- "就按第二版订吧。入住人是 Zhang Wei，电话 13800000000，邮箱 zhangwei@example.com。"

## User Data Handling

The Phase 1 MVP may use name, phone, email, guest count, and room count for simulated hotel booking. It must not collect ID card, passport, payment-card, or account credential data.
