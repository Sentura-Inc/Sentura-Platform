# Cross-Border E-Commerce — Accio Memory Processing Employee

> **On-demand reference — not read by default.**
>
> Back-link: [`DESIGN.md`](DESIGN.md)
>
> Agent id: `cbe-accio-memory`
>
> Chinese name: 跨境记忆处理员工
>
> Last updated: 2026-06-22

This document owns all design, implementation details, current status, and forward plan for the Accio Memory Processing employee in the mobile-accessory cross-border e-commerce customer lane. Shared platform architecture, database-wide schema, cloud deployment, and cross-agent flow live in [`DESIGN.md`](DESIGN.md). Marketing Acquisition details live in [`MARKET_ACQUISITION.md`](MARKET_ACQUISITION.md). Screening details live in [`SCREENING.md`](SCREENING.md).

## 1. Role And Current Status

The Accio Memory Processing employee receives manually imported cross-border e-commerce chat records, validates and normalizes them, extracts structured deal/customer facts, previews memory writes, and hands buyer context to Screening.

Phase-1 requirement: start with simulated Alibaba Accio chat records in JSON, then parse and summarize company info, requested goods, negotiated prices, and follow-up context.

Phase-2 manual-intake requirement: because Alibaba International Station / Accio official API access is not available for this pilot, the production Employee UI supports manual JSON upload, pasted chat text, and chat screenshot images. The employee must normalize all three into an Accio-compatible conversation export, then produce the same report/memory/handoff contract.

Implementation status as of 2026-06-22:

- Source workspace added: `sentura/agents/cbe-accio-memory/`.
- Workspace uses exactly the 8 OpenClaw-native top-level files plus `config.json5` and skills.
- Skills added:
  - `accio-upload-intake/SKILL.md`
  - `chat-normalization/SKILL.md`
  - `deal-summary/SKILL.md`
  - `customer-profile-memory/SKILL.md`
  - `handoff-to-screening/SKILL.md`
- Config/tool policy allows `memory_search`, `memory_get`, and `cross-border-intel__*`.
- Setup registration and webchat binding added.
- Legacy Accio demo route exists: `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`.
- Production Employee route exists: `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`.
- Local sample route exists: `sentura/dashboard/src/app/api/client-demos/cross-border/accio-memory/sample`.
- Fixture exists at `跨境电商/fixtures/accio-chat-records.sample.json`.
- The Accio page reads the sample fixture, supports JSON upload, validates the Accio export, displays raw conversation list/transcript, and sends the full JSON to the real `cbe-accio-memory` AgentChat execution panel.
- The Employee `记忆整理` page supports three manual intake modes: `JSON 文件`, `粘贴文字`, and `聊天截图`; the former official `阿里国际站` source option is removed.
- Screenshot import accepts any number of selected images at the UI level, validates each image by type and single-file size, sends them to OpenClaw Gateway as chat attachments, batches image transcript extraction by payload size, and then runs one final summary/handoff pass.
- JSON/text/screenshot results share `input_format` and `source_kind` metadata, persisted attachment metadata, and the same strict `ACCIO_SUMMARIES_JSON_START/END` output contract.
- Dashboard no longer precomputes reports/highlights.
- Extracted highlights, structured report rows, customer profile detail, purchase intent, prices/lead time, missing fields, `memory_write_preview`, and `screening_handoff_target` render only after employee output wrapped in `ACCIO_SUMMARIES_JSON_START` / `ACCIO_SUMMARIES_JSON_END`.
- Browser validation confirmed loading the sample keeps the UI in a `待员工分析` state with no pre-set reports and no console errors.
- Browser validation confirmed `/employee/memory` opens the new modal, switches across the three manual modes, accepts the pasted-text sample, accepts a screenshot file selection, enables analysis only when input is present, and has no new console errors after login.

## 2. Work Content

The employee analyzes Accio conversations and produces structured reports emphasizing:

- buyer company information
- contact person / role
- country / city
- email / website
- requested products
- models/specifications
- quantities
- target price
- seller quoted price / best price
- packaging add-ons
- payment terms
- Incoterms / shipping destination
- agreed or disputed terms
- next actions
- behavior signals useful for Screening

The employee must not blindly store raw chat. Raw chat remains T2/T3 business data; only concise approved facts can become memory.

## 3. Intake Routes

Current supported intake:

1. JSON upload from the Accio Memory UI.
2. Pasted chat text from Accio, WeChat, or other manual chat copy.
3. Chat screenshot images through OpenClaw Gateway chat attachments.
4. Loading demo fixture through the local sample route.
5. Operator-controlled local fixture/drop-folder processing:

```text
跨境电商/fixtures/accio-chat-records.sample.json
```

The current fixture is simulated and contains no real customer data.

Official Alibaba/Accio API import is intentionally not exposed in the Employee UI. Historical records may retain an `alibaba_international` source label for provenance, but new imports use:

- `source_kind = "manual_json"` with `input_format = "json"`;
- `source_kind = "manual_text"` with `input_format = "pasted_text"`;
- `source_kind = "manual_image"` with `input_format = "image"`.

Text imports may be incomplete or copied out of order. The normalizer preserves the raw pasted text in the task input, builds a best-effort conversation with placeholder `待确认客户` / `待确认联系人` / country `ZZ` where needed, and requires the employee to put unverified or absent values in `missing_fields` rather than inventing them.

Screenshot imports do not persist raw images for later reanalysis. The browser keeps image bytes only for the immediate hidden task, sends metadata plus Gateway attachments, and persists only hash/name/mime/size, transcript uncertainty, redacted text, structured summary, and pending facts.

## 4. Accio JSON Fixture Schema

The fixture structure:

```json
{
  "export_metadata": {
    "platform": "Alibaba Accio",
    "exported_at": "2026-06-07T09:30:00Z",
    "seller_company": "Sentura Demo Mobile Accessories Co., Ltd.",
    "source_file": "accio-chat-records.sample.json"
  },
  "conversations": [
    {
      "conversation_id": "accio_conv_001",
      "buyer": {
        "display_name": "Maria Torres",
        "company_name": "Andes Mobile Parts SpA",
        "country": "CL",
        "city": "Santiago",
        "email": "purchasing@andesmobileparts.cl",
        "website": "https://andesmobileparts.cl",
        "claimed_role": "Purchasing Manager"
      },
      "messages": [
        {
          "timestamp": "2026-06-01T14:05:00Z",
          "sender": "buyer",
          "text": "Hello, we distribute mobile phone repair parts in Chile. We need tempered glass screen protectors for iPhone 15 and Samsung S24. What is your MOQ and FOB Shenzhen price?"
        },
        {
          "timestamp": "2026-06-01T14:12:00Z",
          "sender": "seller",
          "text": "MOQ is 2,000 pcs per model. FOB Shenzhen price is USD 0.38 per piece for iPhone 15 and USD 0.42 per piece for Samsung S24."
        },
        {
          "timestamp": "2026-06-01T14:30:00Z",
          "sender": "buyer",
          "text": "If we order 10,000 pcs mixed models, can you do USD 0.35? We need retail packaging with our brand."
        },
        {
          "timestamp": "2026-06-01T14:44:00Z",
          "sender": "seller",
          "text": "For 10,000 pcs, best price is USD 0.36 per piece. Custom retail packaging adds USD 0.03 per piece and 7 days lead time."
        },
        {
          "timestamp": "2026-06-01T15:10:00Z",
          "sender": "buyer",
          "text": "Please send PI for 10,000 pcs at USD 0.36 plus USD 0.03 packaging. Payment by T/T 30% deposit, balance before shipment is acceptable."
        }
      ],
      "attachments": [
        {
          "file_name": "brand_packaging_reference.pdf",
          "type": "packaging_reference",
          "description": "Buyer brand packaging sample"
        }
      ]
    },
    {
      "conversation_id": "accio_conv_002",
      "buyer": {
        "display_name": "Daniel Weber",
        "company_name": "Berlin Gadget Wholesale GmbH",
        "country": "DE",
        "city": "Berlin",
        "email": "daniel.weber@gmail.com",
        "website": "https://berlin-gadget-wholesale.example",
        "claimed_role": "Owner"
      },
      "messages": [
        {
          "timestamp": "2026-06-03T08:20:00Z",
          "sender": "buyer",
          "text": "We are looking for 65W GaN chargers with EU plug, CE and RoHS certificates. Initial quantity 500 pcs for testing."
        },
        {
          "timestamp": "2026-06-03T08:35:00Z",
          "sender": "seller",
          "text": "For 65W GaN charger EU plug, MOQ is 1,000 pcs. EXW price USD 6.80 per piece. CE/RoHS certificates available."
        },
        {
          "timestamp": "2026-06-03T09:05:00Z",
          "sender": "buyer",
          "text": "Can we start with 500 pcs at USD 6.50? We need delivery to Hamburg warehouse."
        }
      ],
      "attachments": []
    }
  ]
}
```

The implementation has since validated three simulated conversations:

- Andes Mobile Parts SpA
- Berlin Gadget Wholesale GmbH
- Northstar Wireless LLC

## 5. Required Extraction Results

For Andes Mobile Parts SpA:

- buyer: Maria Torres
- company: Andes Mobile Parts SpA
- country/city: CL / Santiago
- email: `purchasing@andesmobileparts.cl`
- website: `https://andesmobileparts.cl`
- role: Purchasing Manager
- product: tempered glass screen protector
- models: iPhone 15, Samsung S24
- quantity: 10,000 pcs mixed models
- target price: USD 0.35
- seller best price: USD 0.36
- packaging add-on: USD 0.03
- Incoterm: FOB Shenzhen
- payment: T/T 30% deposit, balance before shipment
- next action: prepare/send PI and packaging artwork requirements
- Screening handoff: needs registry/domain/trade verification

For Berlin Gadget Wholesale GmbH:

- buyer: Daniel Weber
- company: Berlin Gadget Wholesale GmbH
- country/city: DE / Berlin
- email: `daniel.weber@gmail.com`
- website: `https://berlin-gadget-wholesale.example`
- product: 65W GaN charger, EU plug
- quantity: 500 pcs trial request
- MOQ: 1,000 pcs
- seller quote/best known price: USD 6.80
- buyer target: USD 6.50
- Incoterm: EXW
- logistics: Hamburg warehouse delivery
- certification: CE/RoHS
- Screening warning: free-provider email / domain-email verification required

For Northstar Wireless LLC:

- product: clear MagSafe cases
- current quote quantity: 15,000 pcs
- monthly potential: 20,000 pcs/month
- best price: USD 1.10
- FBA barcode sticker: USD 0.015
- drop-test packaging: USD 0.08
- Screening handoff required

## 6. Memory Summary Output

For each conversation, produce:

```json
{
  "conversation_id": "accio_conv_001",
  "customer_profile": {
    "company_name": "Andes Mobile Parts SpA",
    "country": "CL",
    "city": "Santiago",
    "contact_person": "Maria Torres",
    "role": "Purchasing Manager",
    "email": "purchasing@andesmobileparts.cl",
    "website": "https://andesmobileparts.cl",
    "company_evidence_status": "needs_screening"
  },
  "purchase_intent": [
    {
      "product": "tempered glass screen protector",
      "models": ["iPhone 15", "Samsung S24"],
      "quantity": 10000,
      "packaging": "custom retail packaging with buyer brand",
      "target_price_usd": 0.35,
      "seller_best_price_usd": 0.36,
      "packaging_addon_usd": 0.03,
      "incoterm": "FOB Shenzhen",
      "payment_terms": "T/T 30% deposit, balance before shipment"
    }
  ],
  "negotiation_summary": "Buyer requested 10,000 mixed tempered glass protectors, pushed price from USD 0.38/0.42 to USD 0.35, seller countered USD 0.36 plus USD 0.03 packaging. Buyer accepted PI request.",
  "next_actions": [
    "Prepare PI with 10,000 pcs at USD 0.36 plus USD 0.03 packaging.",
    "Send packaging artwork requirements.",
    "Send buyer profile to Screening Employee for registry/domain/trade verification."
  ],
  "behavior_signals": {
    "inquiry_professionalism_points": 8,
    "responsiveness_points": 7,
    "notes": "Specific products, models, volume, Incoterm, payment terms, and packaging requirements supplied."
  }
}
```

Output marker contract:

- `ACCIO_SUMMARIES_JSON_START`
- JSON object with one top-level key: `{ "summaries": [...] }`
- `ACCIO_SUMMARIES_JSON_END`

The Dashboard renders:

- extracted highlights
- structured report rows
- `memory_write_preview`
- `screening_handoff_target`

Only after employee output arrives.

## 7. UI Design

Role-level target UI for Employee users is defined in [`UI.md`](UI.md). This section describes the implemented Employee memory surface plus the legacy Accio demo workbench.

Primary Employee route:

```text
/client-demos/cross-border/employee/memory
```

Legacy demo route:

```text
/client-demos/cross-border/accio-memory
```

Page goal: make chat-record ingestion auditable before anything is written to memory.

Employee `记忆整理` modal:

- Mode buttons:
  - `JSON 文件`
  - `粘贴文字`
  - `聊天截图`
- JSON mode:
  - JSON file upload
  - no official Alibaba API button
  - supports `仅导入` and `导入并分析`
- Text mode:
  - large pasted-chat textarea
  - accepts incomplete snippets such as seller answer + timestamp + buyer question
  - supports `仅导入` and `导入并分析`
- Screenshot mode:
  - image file picker with `multiple`
  - accepts PNG/JPEG/WebP/HEIC/HEIF
  - no fixed image-count cap in the UI
  - per-image type/size validation
  - only `导入并分析`, because raw images are not stored for later queued/retry analysis
- Report detail:
  - customer profile
  - inquiry and purchase intent
  - price, shipment, payment, and negotiated terms
  - chat summary
  - missing fields
  - memory-write preview
  - Screening handoff recommendation

Legacy Accio demo layout:

- Left upload/source panel:
  - JSON upload
  - `加载演示 Accio 记录`
  - validation status
  - conversation count
  - conversation list with company, country, product, price, follow-up status
- Center transcript and extraction view:
  - original chat transcript
  - highlighted product/quantity/price/payment/shipping entities
  - attachment list
- Right memory/report panel:
  - company summary
  - purchase intent cards
  - negotiated price table
  - next actions
  - behavior signals only when conversation exists
  - `写入记忆预览`
  - `发送到背调`
  - live `cbe-accio-memory` AgentChat

UI safety:

- Never write raw chat directly to memory.
- Show structured preview first.
- Raw chat is local T2/T3 data.
- Memory writes are concise facts plus source references.
- Sample/demo data must be visibly marked as `演示数据`.
- Employee-produced analysis must be marked as `员工执行`.

## 8. Tools And OpenClaw Configuration

Allowed tools:

- `memory_search`
- `memory_get`
- `cross-border-intel__*`

Key MCP tools:

- `cbe_intel_parse_accio_chat`
- `cbe_intel_summarize_accio_chat`

Denied tools:

- shell / exec
- filesystem mutation outside controlled upload/sample paths
- direct gateway mutation
- external messaging/outreach
- raw memory writes without preview/approval
- `sessions_spawn`
- `subagents`
- `sessions_yield`

Model route:

- Use the active OpenClaw model/provider configured for `cbe-accio-memory`.
- Do not hardcode OpenAI or any single cloud provider in the import UI/task runner.
- JSON and pasted-text modes require normal text input capability.
- Screenshot mode requires the active model/provider to support vision/image attachments through OpenClaw. If the current model cannot process images, the user should switch the memory employee to a vision-capable model or paste text instead.
- Recommended qualities: Chinese/English mixed long-context conversation summarization, screenshot OCR/transcription, and structured JSON extraction.

## 9. Memory Write Policy

Store structured summaries under the customer profile EKG or future business DB/memory-fact layer, not as unbounded prose only.

Raw chat and image handling:

- classify raw Accio chats as T2/T3 business data;
- store raw text uploads in the business database only as redacted/hash message rows;
- store raw screenshot images nowhere in vector memory and nowhere as durable image blobs in v1;
- store hash, classification, input format, source kind, and attachment metadata in DB;
- never send raw chats through external channels;
- never send raw chats to external search APIs;
- do not write raw chats into vector memory.

Facts eligible for memory after preview approval:

- buyer name
- company/domain
- verified product interest
- quantity/specification
- accepted or discussed price
- next action
- risk tier if Screening has scored it
- concise behavior signal

Memory facts must include source references and be traceable to the originating Accio import/conversation.

## 10. Database And Persistence

Accio-specific tables from the shared production schema:

```sql
accio_imports(id, tenant_id, user_id, agent_run_id, source_file_name, file_hash, storage_key, validation_status, classification, source_kind, input_format, attachment_metadata_json, uploaded_at)
accio_conversations(id, tenant_id, accio_import_id, external_conversation_id, company_name, country, contact_person, email, website)
accio_messages(id, tenant_id, accio_conversation_id, message_ts, sender_role, text_hash, text_redacted, attachment_json)
accio_summaries(id, tenant_id, accio_conversation_id, agent_run_id, customer_profile_json, purchase_intent_json, negotiated_price_json, next_actions_json, behavior_signals_json, created_at)
memory_facts(id, tenant_id, agent_id, source_record_type, source_record_id, fact_json, vector_memory_ref, status, created_at)
handoff_events(id, tenant_id, from_agent_id, to_agent_id, source_record_type, source_record_id, payload_json, status, created_at)
```

Minimum index:

- `accio_conversations(tenant_id, company_name, email)`.

Memory employee reads:

- raw uploaded file from object storage / local fixture
- prior company memory facts

Memory employee writes:

- `accio_imports`
- `accio_conversations`
- `accio_messages` with redacted text/hash
- `accio_summaries`
- `memory_facts`
- `handoff_events`

## 11. Screening Handoff

The Memory employee hands context to Screening through a typed payload, not free-form chat.

Handoff target should include:

- company name
- country
- website/domain/email if present
- contact person/role
- product interest
- quantity and price context
- behavior signals
- source conversation id
- classification level
- notes about missing verification

Screening then uses this as manual/contextual intake and applies its own evidence ladder. Behavior signals become applicable only when a real Accio or sales interaction exists.

## 12. Implementation Plan

Already implemented:

- `cbe-accio-memory` source workspace.
- Five skills listed above.
- Setup registration/webchat binding.
- Accio Memory UI route.
- Local sample route.
- Simulated Accio fixture.
- JSON upload/sample loading.
- Raw transcript review.
- Employee AgentChat formal execution path.
- Output marker parsing.
- Memory-write preview.
- Screening handoff payload.
- Browser validation that no precomputed reports appear before employee analysis.
- CE6 and CE7 validation coverage.
- Employee `记忆整理` multi-format intake for manual JSON, pasted text, and screenshot images.
- `memory-import-normalizer.ts` that unifies JSON/text/image into an Accio-compatible conversation export.
- Gateway client attachment forwarding for hidden employee tasks.
- Screenshot transcript preflight batches before final summary/handoff analysis.
- `source_kind`, `input_format`, and attachment metadata persistence on Accio imports.
- Auto-created pending customer profiles with `missing_fields` instead of invented company/country/contact values.
- Enhanced memory report detail sections for customer profile, inquiry, purchase intent, terms, missing fields, memory preview, and Screening handoff.
- Regression coverage in `scripts/test-cross-border-agents.ts` and `scripts/test-cross-border-phase2-store.ts`.

Still to implement:

- Approval workflow for committing `memory_write_preview` to vector memory/business memory.
- Real Accio export format validation once customer provides a sample.
- Operator workflow for resolving `missing_fields` and re-running analysis without raw screenshot images.
- Link Accio behavior summaries into Screening report recalculation.
- Optional Alibaba/Accio official API alignment remains out of scope until the customer has seller authorization and accessible APIs; do not expose it as a current import option.

## 13. Source And Test Traceability

Relevant test rows:

- CE2 — shared fixtures, ontology, schemas, and contextual scoring.
- CE3 — `cross-border-intel` MCP parser/summarizer tools.
- CE6 — Accio Memory workspace/report correctness.
- CE7 — Cross-border employee demo UIs.
- CE10 — production cloud/database/multi-agent operating plan.
- CE20 — Employee DB-backed UI migration.
- CE22 — Phase 2 Lead/Screening/Accio durable workflow.

Relevant files:

- `跨境电商/fixtures/accio-chat-records.sample.json`
- `sentura/agents/cbe-accio-memory/`
- `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/memory-import-normalizer.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/lib/gateway/client.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/accio-memory/sample`
- `sentura/mcp-servers/cross-border-intel/`

Safety defaults:

- Raw Accio chats are T2/T3.
- Raw chats never go to external channels.
- Raw chats are not written to vector memory.
- Memory writes require preview.
- External outreach is not sent automatically.
