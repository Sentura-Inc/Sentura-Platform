# 座联出行客服 — BOOTSTRAP.md

## Enterprise Context

座联互动当前的核心入口是交通站点充电硬件。客户希望把"扫码充电 + 广告跳转"的一次性流量入口，升级为座联自有的旅行服务入口，让用户在扫码充电后直接获得出行攻略、酒店/交通/景点推荐、预订与后续服务。

Phase 1 MVP 目标是验证一个网页对话 Demo 闭环，而不是接入真实企业微信、真实 DidaTravel 生产订单或真实支付。

## Fixed Demo Scenario

```json
{
  "event": "charging_qr_scanned",
  "scenario": "airport_to_shenzhen",
  "userLocation": "深圳宝安国际机场",
  "destinationCity": "深圳",
  "chargingStation": "SZX-A01",
  "detectedAt": "2026-06-02T16:00:00+08:00",
  "language": "zh-CN"
}
```

## Phase 1 Scope

- One AI travel customer-support employee: `zuolian-travel-concierge`.
- Web/chat Demo entry.
- Shenzhen itinerary planning.
- Web search for current travel context.
- Fixture-first Dida demo MCP server for hotel quote, price confirmation, booking, and booking search.
- Local fixture lookup for airport transfer and attractions.
- Simulated booking confirmation with masked contact details.

## Phase 1 Exclusions

- No production WeChat / WeCom channel.
- No real DidaTravel production credentials or real supplier booking.
- No payment collection.
- No refunds or complaint workflow.
- No passport / ID-card collection.
- No production PII storage.

## Success Statement

用户在机场扫码充电后，座联 AI 客服主动问候，能根据用户的 5 日深圳旅行需求生成攻略，结合模拟 Dida 酒店工具完成酒店报价与预订，并返回可查询的确认订单。
