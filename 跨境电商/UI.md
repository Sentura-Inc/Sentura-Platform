# Sentura x Cross-Border E-Commerce — Role UI Design

> **On-demand reference — not read by default.**
>
> Back-link: [`DESIGN.md`](DESIGN.md)
>
> Status: Employee role target UI design plus Phase-2 customer Admin monitoring boundary. Detailed Admin monitoring page implementation remains planned.
>
> Last updated: 2026-06-22

This document defines the customer-facing role UI for the mobile-accessory cross-border e-commerce client lane. Shared platform/runtime design lives in [`DESIGN.md`](DESIGN.md). Phase-2 production/user-permission planning lives in [`PHASE-2.md`](PHASE-2.md). Agent-specific behavior remains in [`MARKET_ACQUISITION.md`](MARKET_ACQUISITION.md), [`SCREENING.md`](SCREENING.md), and [`MEMORY_PROCESSING.md`](MEMORY_PROCESSING.md).

The UI has two roles:

| Role | Scope in this document | Status |
|---|---|---|
| `employee` | Sales/operator user who finds customers, starts background investigation, imports manual chat records, reviews reports, and receives task messages. | Designed below. |
| `admin` | Customer supervisor/manager who monitors user activity, Agent tasks, aggregate lead/screening output, per-user lists, and statistics. | Monitoring boundary designed; full Admin pages planned in Phase 2. |

Employee pages must not expose a direct free-form Agent chat session for Phase 1. Users operate through business buttons, forms, filters, and lists. The backend may still create hidden OpenClaw sessions to run the real employees, but the visible product surface is a controlled task UI.

## 1. Product Principles

- Build an operational B2B sales console, not a marketing landing page.
- Use Simplified Chinese for business labels; keep machine IDs, API names, and source URLs available only in technical detail drawers.
- Keep Admin and Employee experiences separate from the first screen after login.
- Do not display free-form chat input with `cbe-lead-discovery`, `cbe-buyer-screening`, or `cbe-accio-memory` in the Employee UI.
- Every customer row and memory row must show status clearly before the user opens a detail view.
- Every Agent-produced result must remain auditable through `agent_run_id`, source URLs, timestamps, and report IDs.
- No Phase-1 UI sends outreach automatically.
- Admin and ordinary Employee users must see different navigation and data scopes; this customer UI does not expose AI employee creation, prompt tuning, provider-key setup, or OpenClaw config management.

## 1.1 User Levels And Permissions

The CBE UI uses customer-specific product roles, not the full Sentura platform role model:

| Product role | Chinese label | Visible navigation | Data scope | Main actions |
|---|---|---|---|---|
| `operator` | 普通用户 / 业务员工 | `个人中心`, `获客与背调`, `记忆整理` | Own rows, shared customer pool rows, joined shared Lead runs, assigned handoffs. | Start Lead/Screening/Accio tasks, view own reports and task progress, retry own recoverable failures. |
| `admin` | 管理员 / 业务主管 | Existing Employee pages plus `管理员` | Tenant-wide or team-wide monitoring scope. | Monitor who is running which task, which Agent is being called, target under investigation, aggregate lead/screening lists, per-user lists, and statistics. |

Admin monitoring surfaces must not appear for ordinary users:

- `总览`
- `实时任务`
- `获客与背调汇总`
- `员工视图`
- `Agent 使用统计`

Ordinary users can still see task status, cost for their own usage, and report evidence for rows they are allowed to access. They cannot see other users' private task inputs, tenant-wide statistics, or admin monitoring tables.

Admin monitoring pages are read-mostly. Admins cannot create AI employees, change Agent prompts/tools, change model/API/provider keys, edit sandbox settings, or bypass the duplicate Lead coordinator from this customer UI.

## 2. Information Architecture

Target routes:

| Route | Page | Role | Purpose |
|---|---|---|---|
| `/client-demos/cross-border/employee` | 个人中心 | `employee` | Login landing page and personal productivity summary. |
| `/client-demos/cross-border/employee/customers` | 获客与背调 | `employee` | One customer list for Lead Discovery output and Screening actions. |
| `/client-demos/cross-border/employee/memory` | 记忆整理 | `employee` | One chat-record list for manual JSON/text/screenshot import, analysis, report review, and Screening handoff. |
| `/client-demos/cross-border/admin` | 管理员 | `admin` | Phase-2 monitoring shell for aggregate KPIs, realtime tasks, all-customer lead/screening list, per-user lists, and Agent usage statistics. |

Current demo routes can be folded into these targets:

| Current route | Target role page |
|---|---|
| `/client-demos/cross-border/lead-discovery` | `/employee/customers` via `寻找客户`. |
| `/client-demos/cross-border/screening` | `/employee/customers` via `开始调研`, `批量背调`, and `手动背调`. |
| `/client-demos/cross-border/accio-memory` | `/employee/memory` via `添加新记录` and `开始分析`. |

## 3. Global Navigation

### 3.1 Layout

Desktop top bar:

| Area | Content | Behavior |
|---|---|---|
| Left | Sentura logo + `跨境电商客户系统` | Logo links to Employee personal center after login. |
| Center | Segmented navigation: `获客与背调`, `记忆整理`; admins also see `管理员`. | Switches between work pages. Active tab has strong underline or filled segment. |
| Right | User center trigger | Opens menu with `个人中心`, `消息中心`, `设置`, `退出登录`. Shows unread message dot when tasks complete or fail. |

Personal center is not a center nav item because the user specifically reaches it after login and from the user menu. This keeps the daily workspace focused on the two operational modes.

Mobile behavior:

- Left logo remains.
- Center nav collapses into a two-item bottom bar or compact segmented control.
- User center remains an avatar button.
- Lists become horizontally scrollable tables or dense row cards; columns must not overlap.

### 3.2 User Center Menu

Menu items:

| Item | Purpose |
|---|---|
| `个人中心` | Return to personal summary and latest activity. |
| `消息中心` | Task-completion messages, failed Agent runs, approval requests, imported-record warnings. |
| `设置` | User preferences only. Platform/API/Agent configuration is not part of this customer UI. |
| `退出登录` | End current Dashboard session. |

### 3.3 Admin Page Boundary

The Admin page is planned for Phase 2. It should be a quiet monitoring console, not a platform configuration area and not a marketing dashboard.

| Admin module | Purpose | Ordinary user behavior |
|---|---|---|
| `总览` | KPI cards and trends for lead count, Screening count, high-score buyers, failed tasks, active tasks, and cost. | Hidden. |
| `实时任务` | Shows each running/queued/recent task: business user, Agent, task type, investigated target, current stage, last tool/source, elapsed time, and status. | Hidden except own task cards. |
| `获客与背调汇总` | Tenant/team-wide customer list with filters by owner, country, product, score tier, status, source, and date. | Ordinary users see only their scoped `获客与背调` list. |
| `员工视图` | Per-user lists and statistics: leads found, screenings completed, Accio records processed, failed tasks, high-score buyers, and cost. | Hidden. |
| `Agent 使用统计` | Per-Agent usage for `cbe-lead-discovery`, `cbe-buyer-screening`, and `cbe-accio-memory`: runs, errors, average duration, tool/source usage, cost, and evidence coverage. | Hidden. |

## 4. Employee Page 1 — 个人中心

Login landing route:

```text
/client-demos/cross-border/employee
```

Page goal: let the user understand personal work progress without opening the Agent workbench.

### 4.1 Layout

Top band:

- Greeting: `你好，{用户姓名}`
- Role badge: `员工`
- Tenant badge: `跨境电商`
- Date range selector: `今日`, `本周`, `本月`, `全部`

Primary statistic cards:

| Metric | Data source | Example label |
|---|---|---|
| Leads found through Marketing Acquisition | `lead_candidates` filtered by `user_id` or joined run membership. | `获客员工找到的潜在客户` |
| Customers deeply investigated through Screening | `screening_reports` filtered by `user_id` / selected target ownership. | `背调员工深度调研客户` |
| Chat records organized through Accio Memory | `accio_summaries` or analyzed `accio_imports`. | `记忆员工整理聊天记录` |
| High-score buyers | `screening_reports.normalized_score >= 80`. | `高分客户` |

Secondary panels:

| Panel | Content |
|---|---|
| `待处理事项` | Pending screenings, failed runs, memory records waiting for analysis, records needing extra clues. |
| `最近完成` | Last 10 Agent tasks with customer name, employee, completion time, and report link. |
| `我的客户漏斗` | Counts by status: `未背调`, `背调中`, `高分`, `中等`, `低分`, `证据不足`. |
| `消息提醒` | Latest task completion/failure messages from message center. |

### 4.2 Interactions

- Clicking `获客员工找到的潜在客户` opens `获客与背调` with the user's discovered customers.
- Clicking `背调员工深度调研客户` opens `获客与背调` filtered to `已评分`.
- Clicking `记忆员工整理聊天记录` opens `记忆整理` filtered to `已分析`.
- Clicking any recent activity opens the customer or memory detail drawer, not a chat session.

## 5. Employee Page 2 — 获客与背调

Route:

```text
/client-demos/cross-border/employee/customers
```

Page goal: one list for customer discovery and buyer investigation. The user should not need to know whether the current row came from Lead Discovery, manual input, or Accio handoff to start Screening.

### 5.1 Header And Controls

Header row:

| Position | UI |
|---|---|
| Left | Title `获客与背调` + small subtitle showing row count and active filters. |
| Right | Action buttons: `寻找客户`, `批量背调`, `手动背调`. |

Search row:

| Control | Behavior |
|---|---|
| Search input | Placeholder `按公司名称搜索`; filters by normalized company name and aliases. |
| Filter button | Opens drawer/popover with country, type, product, found time, score status, score tier. |
| Selected filter chips | Appear under search; each chip removable. |

Primary buttons:

| Button | Opens | Agent connection |
|---|---|---|
| `寻找客户` | Lead-run drawer with product, country, buyer type, target count, exclusions. | Starts hidden `cbe-lead-discovery` task. |
| `批量背调` | Confirmation drawer for selected customer rows. | Starts hidden `cbe-buyer-screening` batch task. |
| `手动背调` | Manual form for company/country/type/product/website/email/contact/notes. | Creates manual target, then starts hidden `cbe-buyer-screening` task. |

### 5.2 Customer List Columns

The main body is a full-width list/table. Use stable column widths on desktop; convert to dense cards on mobile.

| Column | Field | Notes |
|---|---|---|
| 公司名称 | `company_name` | Primary text; secondary line can show city or normalized domain. |
| 国家 | `country` | ISO country code plus localized display label where useful. |
| 类型 | `buyer_type` | Importer, distributor, retailer, repair chain, e-commerce seller, manual input, Accio handoff. |
| 产品 | `matched_products` / `product_interest` | Show 1-2 chips, then `+N`. |
| 网站 | `website` | Domain text; opens source drawer or external URL in a safe new tab. |
| 找到时间 | `found_at` | From Lead Discovery, manual creation, or Accio handoff time. |
| 评分 | final `normalized_score` + `score_tier` | `normalized_score` is the single customer-facing score: evidence quality 80% + evidence coverage 20%. Hidden as `未评分` until Screening can calculate a score. |
| 操作 | row actions | `开始调研` if not scored; `查看报告` if scored; `查看进度` while running. |

### 5.3 Row Status Colors

Use color as a row background plus a text badge; never rely on color only.

| State | Background | Badge | Meaning |
|---|---|---|---|
| Not investigated | White / neutral | `未背调` | Lead exists but Screening has not run. |
| Running | Light blue | `背调中` | Hidden Screening task is active. |
| High score | Light green | `高分` | final `normalized_score >= 80`. |
| Medium score | Light orange | `中等` | final `60 <= normalized_score < 80`. |
| Low score | Light red | `低分` | final `normalized_score < 60`; forced downgrades must be reflected by capping the final score into this band. |

Recommended implementation tokens:

| Tier | Tailwind-style tokens |
|---|---|
| Not investigated | `bg-white border-slate-200` |
| Running | `bg-sky-50 border-sky-200` |
| High | `bg-emerald-50 border-emerald-200` |
| Medium | `bg-amber-50 border-amber-200` |
| Low | `bg-rose-50 border-rose-200` |

If Screening returns `insufficient_evidence`, show a neutral row with badge `证据不足` and keep `评分` as `--`; do not color it red unless a forced downgrade exists.

### 5.4 Filters

Filter drawer fields:

| Filter | Values |
|---|---|
| 国家 | Multi-select from active countries. |
| 类型 | Importer, distributor, retailer, repair chain, e-commerce seller, manual input, Accio handoff. |
| 产品 | Product taxonomy chips plus text search. |
| 找到时间 | Today, last 7 days, last 30 days, custom range. |
| 是否评完 | `未背调`, `背调中`, `已评分`, `证据不足`. |
| 评分 | `高分`, `中等`, `低分`. |

Filter behavior:

- Filters combine with `AND`.
- Search input applies after filters.
- `重置` clears all filters but not search text unless the user clears it.

### 5.5 Customer Detail Drawer

Clicking a row opens a right drawer:

| Section | Content |
|---|---|
| `客户概览` | Company, country, type, product, website, source, found time. |
| `来源证据` | Search queries, source URLs, snippets, fetched time, dedupe explanation. |
| `背调报告` | Score, coverage, score blocks, evidence timeline, open questions, recommended action. |
| `任务历史` | Agent run ID, session key reference, employee ID, status, started/completed time. |

The drawer may include `重新背调` and `复制到记忆整理` actions, but no free-form Agent input.

## 6. Employee Page 3 — 记忆整理

Route:

```text
/client-demos/cross-border/employee/memory
```

Page goal: review imported customer chat records, start structured analysis, and inspect memory/report output before anything is written to long-term memory.

### 6.1 Header And Controls

Header row:

| Position | UI |
|---|---|
| Left | Title `记忆整理` + row count. |
| Right | Primary button `添加新记录`. |

Search row:

| Control | Behavior |
|---|---|
| Search input | Placeholder `按名称搜索`; searches company name, contact name, conversation title, file name. |
| Filter button | Opens drawer for source, import time, analysis status. |

`添加新记录` opens an import drawer:

| Input | Requirement |
|---|---|
| Mode selector | `JSON 文件`, `粘贴文字`, `聊天截图`. No official `阿里国际站` API/import option is shown. |
| JSON upload | Supports Accio-compatible export JSON and the demo fixture shape. |
| Pasted text | Supports copied WeChat/Accio/manual chat fragments, including incomplete snippets. The normalizer may create placeholder customer/contact fields and require `missing_fields`. |
| Screenshot upload | Supports PNG/JPEG/WebP/HEIC/HEIF screenshots with per-image type/size checks, no fixed image-count cap in the UI, and automatic Gateway/model-sized transcript batching. |
| Name field | Defaults from file/company or manual chat source; editable before import. |
| Classification | Defaults to T2/T3 business conversation. |
| Import action | JSON/text can `仅导入` or `导入并分析`; screenshots must `导入并分析` immediately because raw images are not durably stored for queued/retry analysis. |
| Source label | Auto-derived as `手动 JSON`, `手动文字`, or `手动图片`; historical imported rows may still display legacy provenance labels. |

### 6.2 Memory Record List Columns

| Column | Field | Notes |
|---|---|---|
| 名称 | `record_name` | Company name, conversation group, or file title. |
| 来源 | `source_kind` / `input_format` | Manual JSON, manual text, manual image, demo data, or historical provenance. |
| 导入时间 | `imported_at` | Localized timestamp. |
| 操作 | row actions | `开始分析` if not analyzed; `查看报告` if analyzed; `查看进度` while running. |

### 6.3 Row Status Colors

| State | Background | Badge | Meaning |
|---|---|---|---|
| Not analyzed | White / neutral | `未分析` | Imported, but `cbe-accio-memory` has not processed it. |
| Running | Light blue | `分析中` | Hidden Accio Memory task is active. |
| Analyzed | Light green | `已分析` | Structured summaries and memory preview exist. |
| Error | Light red | `失败` | Invalid JSON, Gateway failure, Agent missing, or missing output marker. |

The user's requested primary states are green for analyzed and white for not analyzed; blue/red are operational extensions for transparent task feedback.

### 6.4 Filters

| Filter | Values |
|---|---|
| 来源 | Manual JSON, manual text, manual image, demo data, historical/other. |
| 导入时间 | Today, last 7 days, last 30 days, custom range. |
| 是否分析 | `未分析`, `分析中`, `已分析`, `失败`. |

### 6.5 Memory Detail Drawer

Clicking a memory row opens a right drawer:

| Section | Content |
|---|---|
| `原始记录概览` | File name, source kind, input format, import time, classification, conversation count, and attachment metadata where applicable. |
| `客户档案` | Extracted or placeholder company, country, city, contact, role, email, website, and `missing_fields`. |
| `咨询内容与采购意图` | Requested products/models, quantity, packaging/specifications, buyer question, urgency, and intent quality. |
| `价格与条款` | Target price, seller quote/best price, payment terms, Incoterm, shipping destination, stock/lead-time answer, and other negotiated terms. |
| `聊天摘要` | Concise redacted summary plus uncertainty notes for incomplete text or screenshot transcription. |
| `写入记忆预览` | Concise facts only; source references attached; raw chat and raw screenshots never written directly to vector memory. |
| `发送到背调` | Creates or updates a customer row with source `Accio handoff` / manual chat handoff. |
| `任务历史` | Agent run ID, hidden session reference, employee ID, status, timestamps. |

No direct chat input is shown in the drawer.

## 7. Backend And Agent Connection

### 7.1 Connection Rule

Employee UI uses business actions, not visible Agent chat.

Allowed backend path:

```text
Employee button/form
  -> Dashboard task runner
  -> OpenClaw Gateway WebSocket RPC
  -> hidden OpenClaw session for the target cbe-* employee
  -> employee tools / MCP / memory
  -> structured JSON marker output
  -> Dashboard validation + persistence
  -> list/report UI update
```

Do not build a custom agent runtime or direct provider SDK path. All model/tool execution remains inside OpenClaw employees.

### 7.2 Gateway Calls

Use the existing Dashboard gateway client pattern:

| Step | Method | Purpose |
|---|---|---|
| Connect | Gateway protocol v4 handshake through `GatewayClient`. | Establish Dashboard control-plane connection. |
| Check employee | `config.get` through `useAgent(agentId)` / gateway helper. | Confirm `cbe-lead-discovery`, `cbe-buyer-screening`, or `cbe-accio-memory` is registered. |
| Create hidden session | `sessions.create` with `agentId`, first structured task, and label. | Starts an auditable employee run without showing chat UI. |
| Continue run | `chat.send` with `sessionKey` and idempotency key. | Sends follow-up structured payloads only when required. |
| Subscribe progress | `sessions.subscribe` and gateway events. | Capture tool progress, assistant terminal output, and errors. |
| Read history | `chat.history` / transcript helper for restore/debug. | Used internally for audit or retry, not as visible chat. |

The current `AgentChat` component can be wrapped as a hidden transport initially because it already creates sessions, sends `chat.send`, receives tool events, and supports hidden user prefixes. Product implementation should then extract a dedicated `EmployeeTaskRunner` so no chat transcript is rendered.

### 7.3 Task Types And Output Markers

| UI action | Employee | Input payload | Required output marker | UI update |
|---|---|---|---|---|
| `寻找客户` | `cbe-lead-discovery` | Product keywords, countries, buyer types, target count, exclusions, source policy. | `LEAD_CANDIDATES_JSON_START` / `LEAD_CANDIDATES_JSON_END` | Add/update customer rows as `未背调`. |
| `开始调研` | `cbe-buyer-screening` | One selected customer as `InvestigationTarget`. | `SCREENING_REPORTS_JSON_START` / `SCREENING_REPORTS_JSON_END` | Set row to high/medium/low/insufficient, attach report. |
| `批量背调` | `cbe-buyer-screening` | Selected customer targets. | `SCREENING_REPORTS_JSON_START` / `SCREENING_REPORTS_JSON_END` | Update each selected row and report. |
| `手动背调` | `cbe-buyer-screening` | Manual target fields. | `SCREENING_REPORTS_JSON_START` / `SCREENING_REPORTS_JSON_END` | Create customer row and attach report. |
| `添加新记录` | none by default | Uploaded/imported record metadata. | none | Create memory row as `未分析`. |
| `开始分析` | `cbe-accio-memory` | Normalized JSON, pasted-text, or screenshot-transcript chat record payload; screenshot mode also sends OpenClaw Gateway image attachments in preflight transcript batches. | `ACCIO_SUMMARIES_JSON_START` / `ACCIO_SUMMARIES_JSON_END` with `{ "summaries": [...] }` | Set memory row to `已分析`, attach report and memory preview. |

Parsing rules:

- If the expected marker is missing, the task fails visibly with a retry action.
- JSON must be validated with the existing cross-border schemas before persistence.
- Non-2xx provider failures remain coverage gaps where applicable; they must not silently become fraud findings.
- Store raw assistant text for audit only if it follows project data-tier and redaction rules.

### 7.4 Data Model For The UI

Customer list item:

```ts
type CustomerListItem = {
  customerId: string;
  tenantId: string;
  ownerUserId: string;
  createdByUserId: string;
  departmentId?: string;
  visibilityScope: "private" | "department" | "tenant_shared";
  source: "lead_discovery" | "manual_screening" | "accio_handoff";
  companyName: string;
  country?: string;
  buyerType?: string;
  products: string[];
  website?: string;
  foundAt: string;
  leadCandidateId?: string;
  screeningStatus: "not_started" | "running" | "screened" | "insufficient_evidence" | "failed";
  normalizedScore?: number;
  scoreTier?: "high" | "medium" | "low";
  reportId?: string;
  latestAgentRunId?: string;
};
```

Memory record item:

```ts
type MemoryRecordItem = {
  recordId: string;
  tenantId: string;
  ownerUserId: string;
  createdByUserId: string;
  departmentId?: string;
  visibilityScope: "private" | "department" | "tenant_shared";
  name: string;
  source: "manual_json" | "manual_text" | "manual_image" | "demo_data" | "historical" | "other";
  inputFormat: "json" | "pasted_text" | "image";
  importedAt: string;
  analysisStatus: "not_started" | "running" | "analyzed" | "failed";
  conversationCount?: number;
  reportId?: string;
  memoryPreviewStatus?: "preview_only" | "approved" | "rejected";
  latestAgentRunId?: string;
};
```

Task run item:

```ts
type EmployeeTaskRun = {
  agentRunId: string;
  agentId: "cbe-lead-discovery" | "cbe-buyer-screening" | "cbe-accio-memory";
  hiddenSessionKey?: string;
  userId: string;
  ownerUserId: string;
  departmentId?: string;
  visibilityScope: "private" | "department" | "tenant_shared";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  taskType: "lead_discovery" | "screening" | "accio_memory_analysis";
  inputHash: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
};
```

### 7.5 Persistence Boundary

Phase 1 can keep local UI state only for demo continuity, but production must persist structured records:

- Customer page writes: `lead_runs`, `lead_candidates`, `lead_sources`, `screening_targets`, `screening_reports`, `screening_evidence`, `screening_score_blocks`, `agent_runs`.
- Memory page writes: `accio_imports`, `accio_conversations`, `accio_messages`, `accio_summaries`, `memory_facts` as preview only, `handoff_events`, `agent_runs`.
- Admin monitoring pages read `agent_runs`, `agent_run_activity_events`, Lead/Screening/Accio projections, and cost/audit rows; they do not write platform or Agent configuration.
- Every list endpoint must enforce `ownerUserId`, `departmentId`, and `visibilityScope` on the server. Browser-side filters are only presentation.
- Hidden session keys are audit references, not user-facing navigation.
- Raw business chats are T2/T3 and must not be written to vector memory or external channels. Raw screenshot images are not durably stored in v1; only metadata/hash/redacted transcript and structured facts persist.

Production hardening should use a typed `cross-border-store` MCP server or Sentura plugin tools instead of giving employees raw database access.

## 8. Messages And Notifications

Message center events:

| Event | Message example | Target |
|---|---|---|
| Lead run completed | `获客任务完成：找到 18 个潜在客户` | Opens filtered customer list. |
| Screening completed | `背调完成：Mobile Lab 评分 84，高分` | Opens report drawer. |
| Screening needs clue | `背调证据不足：请补充公司注册号或公司邮箱` | Opens manual edit drawer. |
| Accio analysis completed | `聊天记录分析完成：3 个客户记录已整理` | Opens memory list. |
| Agent run failed | `员工任务失败：Gateway 未连接 / 未返回结构化结果` | Opens task history and retry. |

Notifications should be stored against `user_id` and `agent_run_id`.

## 9. Empty, Loading, Error, And Permission States

| State | Customer page | Memory page |
|---|---|---|
| Empty | `还没有潜在客户，点击“寻找客户”开始。` | `还没有聊天记录，点击“添加新记录”导入。` |
| Gateway disconnected | Disable run buttons; show `OpenClaw Gateway 未连接，无法执行员工任务。` | Same. |
| Employee missing | Show setup message naming the missing agent id. | Same. |
| Running | Row background blue; operation becomes `查看进度`; progress drawer shows tool/source stages. | Row background blue; operation becomes `查看进度`. |
| Failed | Keep row; show retry and error details. | Keep record; show retry and validation error. |
| No permission | Hide Admin route and any tenant-wide data; show only user's scoped records. | Same. |

## 10. Visual System

Use existing Sentura Dashboard conventions:

- Next.js App Router page surfaces.
- Tailwind + shadcn/ui if the route is implemented in the current dashboard stack.
- Lucide icons for buttons:
  - `Search` for search/finding customers
  - `Filter` for filters
  - `UserRoundCheck` or `ShieldCheck` for Screening
  - `Upload` / `FileJson` for record import
  - `Bell` for message center
  - `Settings` for settings
- Dense 8px-radius operational cards and table rows.
- Avoid large hero sections, decorative gradients, and marketing-style layouts.

Preferred palette:

| Use | Color family |
|---|---|
| Base UI | White, slate, zinc neutrals. |
| Running | Sky blue. |
| High score / analyzed | Emerald green. |
| Medium score | Amber/orange. |
| Low score / failure | Rose/red. |
| Action emphasis | Sentura primary blue or existing dashboard primary token. |

## 11. Implementation Sequence

1. Create the Employee shell route and global navigation.
2. Implement `EmployeeTaskRunner` as a non-visual task transport using the existing gateway client.
3. Build `个人中心` from current local/demo data first, then wire to business DB.
4. Merge Lead Discovery and Screening surfaces into `获客与背调` list.
5. Move Accio Memory surface into `记忆整理` list.
6. Replace visible AgentChat panels with task progress drawers and message center events.
7. Add persistence-backed filters/search and report drawers.
8. Add Admin placeholder route only after Employee pages are stable.

## 12. Acceptance Checks

Employee UI is acceptable when:

- Login lands on `个人中心`.
- Top navigation matches the requested structure: logo left, two work tabs center, user center right.
- `获客与背调` displays one customer list with the required columns and status colors.
- `获客与背调` supports company-name search and all requested filters.
- `获客与背调` exposes `寻找客户`, `批量背调`, and `手动背调`.
- `记忆整理` displays one chat-record list with the required columns and analyzed/not-analyzed colors.
- `记忆整理` supports name search, source/import-time/analysis filters, and `添加新记录`.
- No Employee page shows direct free-form Agent chat.
- All business actions still execute through the real OpenClaw employees and structured JSON markers.
- Missing Gateway/employee/marker failures are visible and recoverable.

## 13. Sources Used

Local project sources:

- [`DESIGN.md`](DESIGN.md)
- [`MARKET_ACQUISITION.md`](MARKET_ACQUISITION.md)
- [`SCREENING.md`](SCREENING.md)
- [`MEMORY_PROCESSING.md`](MEMORY_PROCESSING.md)
- [`../docs/memory/cross-border-ecommerce/phase-1.md`](../docs/memory/cross-border-ecommerce/phase-1.md)
- [`../docs/tests/tests-cross-border-ecommerce.md`](../docs/tests/tests-cross-border-ecommerce.md)
- Existing Dashboard gateway/client and CBE route code under `sentura/dashboard/src/`.

External docs checked for implementation contracts:

- OpenClaw Gateway protocol: `https://docs.openclaw.ai/gateway/protocol`
- OpenClaw Gateway runbook: `https://docs.openclaw.ai/gateway`
- OpenClaw MCP config/CLI: `https://docs.openclaw.ai/cli/mcp`
- OpenClaw tool and sandbox config: `https://docs.openclaw.ai/gateway/config-tools`
- Next.js App Router Route Handlers: `https://nextjs.org/docs/app/getting-started/route-handlers`
