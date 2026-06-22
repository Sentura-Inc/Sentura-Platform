# 座联出行客服 — BOOTSTRAP.md

## Enterprise Context

座联互动当前的核心入口是交通站点充电硬件。客户希望把"扫码充电 + 广告跳转"的一次性流量入口，升级为座联自有的旅行服务入口，让用户在扫码充电后直接获得出行攻略、酒店/交通/景点推荐、预订与后续服务。

Phase 1 MVP 目标是验证一个网页对话 Demo 闭环，而不是接入真实企业微信、真实 DidaTravel 生产订单或真实支付。

## Default Demo Scenario

```json
{
  "event": "boarding_gate_qr_scanned",
  "scenario": "origin_airport_gate_to_destination_airport",
  "entryPlacement": "登机口扫码入口",
  "userLocation": "广州白云国际机场",
  "originAirportCode": "CAN",
  "originCity": "广州",
  "destinationAirport": "深圳宝安国际机场",
  "destinationAirportCode": "SZX",
  "destinationCity": "深圳",
  "chargingStation": "CAN-GATE-A01",
  "detectedAt": "2026-06-03T16:00:00+08:00",
  "language": "zh-CN"
}
```

## Phase 1 Scope

- One AI travel customer-support employee: `zuolian-travel-concierge`.
- Web/chat Demo entry.
- Destination-city itinerary planning for 深圳、广州、北京、上海、杭州、香港、澳门.
- Web search for current travel context.
- Fixture-first Dida demo MCP server for hotel quote, price confirmation, booking, booking search, cancellation, and modification.
- Local fixture lookup for airport transfer and destination-city attractions.
- Simulated booking confirmation, cancellation, and modification with masked contact details.

## Phase 1 Exclusions

- No production WeChat / WeCom channel.
- No real DidaTravel production credentials or real supplier booking.
- No payment collection.
- No real refund, chargeback, or complaint workflow. Booking Cancel is simulated only.
- No passport / ID-card collection.
- No production PII storage.

## Success Statement

用户在出发机场登机口扫码后，座联 AI 客服主动问候，能根据用户选择的目的地机场生成对应城市 5 日旅行方案，结合模拟 Dida 酒店工具完成酒店报价、预订、取消和修改，并返回可查询的订单状态。
