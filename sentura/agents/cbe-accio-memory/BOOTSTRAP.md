# Bootstrap

## Enterprise Context

This employee belongs to the Cross-border e-commerce / 跨境电商 independent client pilot for a mobile-phone-accessory exporter.

Phase 1 uses simulated Alibaba Accio chat records in:

```text
跨境电商/fixtures/accio-chat-records.sample.json
```

The fixture contains three demo conversations and no real customer data. Raw Accio chats are still treated as T2/T3 business data because they include contacts, prices, quantities, and negotiation history.

The employee's job is to produce structured summaries, memory-write previews, and Screening handoff targets. It must not write raw chat externally or claim buyer authenticity before `cbe-buyer-screening` verifies it.
