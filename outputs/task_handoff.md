# Sentura CBE Continuation Handoff

## Current Resume Snapshot

Default continuation rule: read `outputs/resume_card.md` first. Then read only this snapshot and `Next Steps` unless deeper history is required. Use `docs/MEMORY.md` as an index only when a specific prior row is needed.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce / 跨境电商 Phase 2 production hardening.

Latest task, 2026-06-24: complete all Cross-border e-commerce / 跨境电商 local pre-production work and tests before customer delivery.

### Result

- Closed the remaining CE22/P2.5 production blockers: paid email/trade retry state is persisted per Screening child target; failed children move paid sources to `reapproval_required`; normal retry disables paid calls; explicit re-approval reopens a paid source for that child only.
- Added `007_screening_retry_memory_approval.sql`, retry route `employee/screening-runs/[id]/retry`, memory review route `employee/memory/facts`, typed schemas/API helpers, child `paidSourcePolicy` enforcement in `获客与背调`, and `批准写入` approval UI in `记忆整理`.
- Screening completion now records observed paid email/trade evidence into per-target state and `api_call_ledger`. Accio memory facts can be approved/rejected without raw chat vector promotion. Accio-to-Screening handoffs are marked accepted on Screening creation and completed when the Screening report is saved.
- Completed CE23/P2.6 local preflight: `scripts/test-cross-border-phase2-load-smoke.ts`, `scripts/cross-border-phase2-backup-restore-drill.sh`, `跨境电商/P2.6-LOAD-SMOKE-RUNBOOK.md`, and refreshed `outputs/cbe-phase2-load-smoke-report.json`.
- The backup/restore drill supports `CBE_POSTGRES_CLIENT_IMAGE` for a matching Docker PostgreSQL client when local `pg_dump/pg_restore` are unavailable or older than the source server.
- Browser smoke verified the Employee `记忆整理` approval flow with a synthetic Accio record: list loaded from DB, report showed `仅预览`, `批准写入` PATCH succeeded, UI showed `已批准`, and the temporary record/import was deleted.
- Latest report: 50 simulated sessions, p95 API/context latency captured, 10 Lead requests / 5 active sessions after dedupe, 25 Screening child runs with 12 running and 13 queued initially, 3 Accio imports, soft cap 24, hard guard queued, `go_live_readiness="db_only_preflight_passed"`, `backup_restore_drill="passed"`.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm --dir sentura/dashboard build`: PASS. Next still warns about multiple lockfiles/root inference, but build completed and route manifest includes new retry/memory routes.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 211/211.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 238/238.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 46/46.
- `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`: PASS, 16/16 static checks.
- `set -a; source sentura/dashboard/.env.local; set +a; CBE_BACKUP_RESTORE_DRILL_PASSED=1 pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts --require-db --report outputs/cbe-phase2-load-smoke-report.json`: PASS, 48/48 static + live PostgreSQL DB-only smoke checks.
- Backup/restore drill: PASS with disposable `sentura_cbe_restore_drill`, `CBE_POSTGRES_CLIENT_IMAGE=postgres:18`, migration seed on restored DB, and restored-store checks 238/238.
- Browser smoke: PASS for `http://localhost:3000/client-demos/cross-border/employee/memory` with `CBE_DEMO_USER_ID=cbe-user-operator-001`; temporary DB record was cleaned up.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 410/410.
- `git diff --check`: PASS.

### Boundary

- Local pre-production implementation/testing is complete for P2.1-P2.6.
- Do not label the customer environment `production_go_live_ready` from local-only evidence. That label still requires the same smoke profile on the actual target deployment with Dashboard/Gateway processes, a target-environment disposable restore drill, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS behavior recorded.

### Next Steps

1. Run the P2.6 load-smoke profile on the actual target deployment with Dashboard/Gateway processes.
2. Run the backup/restore drill against a disposable restore database in the target environment.
3. Record provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS behavior before applying `production_go_live_ready`.

Latest task, 2026-06-24: implement P2.5 Screening parent/child fan-out and queued-child drain from `跨境电商/PHASE-2.md`.

### Result

- Multi-target Screening requests now create one parent `agent_runs` row, one `screening_batches` row, one pre-created `screening_targets` row per target, one child `agent_runs` row per target, and one `screening_batch_targets` row per child.
- Each child run carries exactly one target in its prompt/session payload. Production batch-5 and batch-10 remain blocked; batch-3 remains gated by `CBE_SCREENING_ALLOW_BATCH3=true`.
- Added `POST /api/client-demos/cross-border/employee/screening-runs/drain` for route-triggered queued-child claim using row locks, workload admission, leases, session keys, activity events, and parent aggregate refresh.
- Employee bulk Screening execution now starts one parent task, runs claimed non-queued single-target child sessions, records individual child completion/failure/cancellation, and drains another queued wave after each child wave.
- Ordinary Employee task lists hide silent child notifications and show the parent aggregate task.
- Live-test fixes: parent aggregate refresh now resolves the batch before counting all child targets, preventing one terminal child from completing the parent early; Employee completion messages count backend-saved Screening reports from `completeEmployeeScreeningRun().reports.length`.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 196/196.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 218/218.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 46/46. The live probe verifies a three-target Screening batch under active-target cap 1, queued excess children, child failure, parent remains running after one terminal child, drain claim, aggregate counts, and saved-report completion count sourcing.
- Live OpenClaw/Dashboard validation with operator `吴思彤`: PASS. Two real three-target bulk Screening runs completed; the second ended with parent aggregate `total=3/completed=3/terminal=3` and one saved report per child.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 410/410 after aligning current navigation/status/cost/filter assertions and concrete evidence-gap wording.

### Next Steps

1. Persist per-target paid email/trade call retry state and require explicit re-approval before paid retry repeats a lookup.
2. Finish durable Screening/Accio workflow polish: report/evidence detail UX, retry/recovery, approval-to-memory promotion, and durable Screening handoff consumption.
3. Add the P2.6 load-smoke profile after paid retry and durable workflow paths are stable.

## Active Task — Chinese Label Cleanup And Manager Customer Filter Fix

Date: 2026-06-23

### Task Introduction

The user reported two issues after the broad copy simplification pass:

- Some visible `类型` and `产品` values still show English and must be converted to accurate Chinese.
- The Manager-side customer filtering UI cannot open and must be fixed.

Constraints remain the same as the copy simplification task: preserve business meaning, avoid business-logic/data-structure changes unless needed for display, keep unrelated local changes intact, and verify Employee and Manager customer/report surfaces.

### Workspace And Environment

- Active workspace: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Existing full backup from before the copy simplification work: `/Users/purest./Documents/Sentura/backups/Sentura-Platform-before-copy-simplification-20260623-004415`
- Current known unrelated pre-existing modification: `启动说明.md`; do not revert it.
- Main files to inspect first:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`

### Task Flow

Planned implementation order:

1. Locate every visible buyer-type/product rendering path in Employee and Manager pages.
2. Add or centralize Chinese display helpers for raw English type/product values.
3. Fix the Manager customer filter UI so it opens reliably from both the High-value Customers page and the Employee Detail dialog.
4. Run typecheck, focused store tests if affected, and browser checks for Manager filter opening plus English residue.

### Progress So Far

- Task recorded before edits.
- Previous verification before this follow-up: `pnpm --dir sentura/dashboard exec tsc --noEmit` passed, `pnpm exec tsx scripts/test-cross-border-phase2-store.ts` passed 195/195, and broad browser checks found no overflow or technical-copy leaks in checked routes. These checks did not specifically open the Manager customer filter UI or audit all buyer-type/product raw values.
- Added shared visible label helpers in `sentura/dashboard/src/components/cross-border/customer-labels.ts`.
- Replaced duplicated buyer-type/product display helpers in:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`
  - `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx`
- Updated Manager high-value customer product display in `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`.
- Fixed Manager customer filtering by turning the former static `国家 / 类型 / 产品` button into a real `筛选客户` expandable panel in `AdminCustomerListTable`. The panel filters by country, buyer type, and product, shows active chips, and works inside the Manager employee-detail dialog without opening another nested dialog.

### Current State

Implementation and verification for this follow-up are complete.

Verification completed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 195/195.
- Local Chrome/Playwright check on Manager `/client-demos/cross-border/admin/employees`: opened Lin Yue employee detail, clicked `筛选客户`, confirmed the panel opens and common raw English buyer/product terms are absent from the detail surface.
- Local Chrome/Playwright check on Manager `/client-demos/cross-border/admin/high-value-customers`: confirmed common raw English product terms are absent.
- Local Chrome/Playwright check on Employee `/client-demos/cross-border/employee/customers`: confirmed `类型` and `产品` table columns do not expose common raw English values.
- Mobile Chrome/Playwright check at `390x844`: Manager employee-detail `筛选客户` opens and has no document-level horizontal overflow.

### Next Steps

No required next implementation step remains for this follow-up. If new English residue is reported, first check whether it is a company name/domain versus a visible `类型` or `产品` field before changing display text.

## Active Task — Copy Simplification Across CBE Employee And Manager UI

Date: 2026-06-23

### Task Introduction

The user asked to first back up the current `Sentura-Platform` checkout, then implement a broad copy simplification pass for the Sentura cross-border e-commerce Employee and Manager platforms. The goal is to remove technical, hard-to-read default copy while preserving the original meaning and precision. This is a UI-copy-only task: do not change business logic, database schemas, score/cost calculations, runtime task behavior, or permissions.

Hard constraints:

- Keep accurate business meaning.
- Default visible UI should be clear for ordinary employees and managers.
- Keep technical details available, but move them behind short tooltips, collapsible detail sections, or diagnostic-only surfaces.
- Do not revert unrelated local changes.

### Workspace And Environment

- Active workspace: `/Users/purest./Documents/Sentura/Sentura-Platform`
- Full backup created before edits: `/Users/purest./Documents/Sentura/backups/Sentura-Platform-before-copy-simplification-20260623-004415`
- Pre-change `git status --short`: only `M 启动说明.md` existed before this task.
- Target app: `sentura/dashboard` Next.js CBE UI.
- Main target areas:
  - Employee: `个人中心`, `获客与背调`, `记忆整理`, task status bar, message center, employee cost card/detail, report dialogs.
  - Manager: `员工管理`, `高分客户`, `成本监控`, employee detail, cost detail, approval table, customer report dialogs.
  - Shared components under `sentura/dashboard/src/components/cross-border/`.

### Task Flow

Planned implementation order:

1. Simplify shared CBE copy in the app shell, task status, employee cost, and report dialog components.
2. Simplify Employee pages and all drawers/dialogs while preserving current information architecture.
3. Simplify Manager pages and detail dialogs.
4. Hide or downgrade legacy diagnostic entries (`CBE Leads`, `CBE Screening`, `CBE Accio`) from ordinary navigation.
5. Run typecheck, focused store tests, copy scan, and browser checks.

Technical detail presentation rule:

- Short explanations: small tooltip/question-style helper text.
- Long explanations: collapsed sections such as `费用怎么算`, `查看核验依据`, `查看技术详情`.
- Failure/debug information: diagnostic details only, not default UI.

### Progress So Far

- Backup completed successfully.
- Pre-change status recorded.
- Shared UI copy simplified:
  - `sentura/dashboard/src/components/app-shell.tsx`
  - `sentura/dashboard/src/components/sidebar.tsx`
  - `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`
  - `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
  - `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx`
- Employee UI copy simplified:
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-notification-targets.ts`
- Manager UI copy simplified:
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/employees/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/high-value-customers/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/costs/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/report-dialog.tsx`
- Legacy ordinary sidebar entries `CBE Leads`, `CBE Screening`, and `CBE Accio` removed from normal navigation.
- Technical data is now mostly behind `查看技术详情`, `查看诊断信息`, `评分说明`, or `费用怎么算`; report evidence source URLs show as `查看来源` instead of raw URLs.

### Current State

Implementation and verification are complete. The Employee home mobile overflow was fixed by constraining the main two-column grid and list links with `min-w-0`. Historical report text that contained technical terms such as `RDAP`, `JSON`, `API authorization failure`, `HTTP 401`, `MX`, `SPF`, `DMARC`, `provider`, and raw `URL` references is cleaned at display time in Employee and Manager report surfaces. Raw source links remain available as `查看来源` links rather than default visible text.

Final verification completed:

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 195/195.
- `git diff --check`: PASS.
- Authenticated browser checks on desktop and mobile for:
  - Employee: `/client-demos/cross-border/employee`, `/employee/customers`, `/employee/memory`
  - Manager: `/admin/employees`, `/admin/high-value-customers`, `/admin/costs`
  - Employee report dialog, Manager report dialog, Manager employee detail, and Manager cost detail.
- Browser results: no horizontal overflow, no default-visible banned technical terms, and no raw URL text in checked report/detail surfaces.
- Dashboard dev server restarted from current workspace and is running at `http://127.0.0.1:3000`.

Known existing local modification before this task: `启动说明.md`; do not revert it unless the user explicitly asks.

### Next Steps

No required next implementation step remains for this task. If continuing from this handoff, first inspect `git status --short`, keep the pre-existing `启动说明.md` change separate, and use `http://127.0.0.1:3000` for manual review while the dev server is still running.

## Current Resume Snapshot

Default continuation rule: read `outputs/resume_card.md` first. Then read only this snapshot and `Next Steps` unless deeper history is required. Use `docs/MEMORY.md` as an index only when a specific prior row is needed.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce / 跨境电商 Phase 2 production hardening.

## Latest Implementation Update

Date: 2026-06-23

Task: Implement the user's approved Google Maps scoring redesign for the Screening/背调 Agent.

### Result

The scale-aware Screening scoring redesign is now implemented:

- Screening reports carry `company_scale_assessment` with `scale_class`, confidence, rationale, and `first_block_strategy`.
- The first 25% block is displayed as `公司注册与线下门店/地址`; JSON keeps `legal_identity` for backward compatibility.
- For listed/public and medium-large companies, the scoring path fuses official registry/disclosure evidence with Google Maps address/local-presence consistency.
- For small local/offline companies, an `OPERATIONAL` Google Maps Place with physical address, plausible name/category/location match, and no contradictory evidence can satisfy the first block as real-company/offline-existence evidence when registry APIs cannot match the company.
- Reports must distinguish this from formal legal registration/KYB proof.

### Files Updated

- MCP scoring schema/result path: `sentura/mcp-servers/cross-border-intel/src/{schemas.ts,tools.ts,server.test.ts}`.
- Dashboard report persistence/display path: `sentura/dashboard/src/lib/cross-border-store/schemas.ts`, Employee data/API/task-runner files, shared `CustomerReportDialog`, Employee customers page, legacy `/screening` page, and legacy diagnostic Screening route.
- Screening workspace source files: `sentura/agents/cbe-buyer-screening/{AGENTS.md,BOOTSTRAP.md,TOOLS.md,skills/evidence-collection/SKILL.md,skills/buyer-scoring/SKILL.md,skills/report-writing/SKILL.md}`.
- Live OpenClaw workspace: synced the same behavior files into `~/.openclaw/workspace/cbe-buyer-screening/`.
- Static regression scripts and docs/handoff/memory were updated.

### Verification

- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 24/24.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 409/409.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 195/195.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 217/217.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- Minimal real Google Places API (New) smoke with configured `GOOGLE_MAPS_API_KEY`: PASS, HTTP 200, one `OPERATIONAL` candidate with place id and Maps URI; key/full response not printed.
- Live workspace diff and `RULES.md`/`CONTEXT.md` scan: PASS.
- `git diff --check`: PASS before final docs.

### Boundary

This completes the Google Maps scoring fusion requested in that round. As of 2026-06-24, Screening parent/child fan-out plus queued-child drain are also implemented. Remaining CBE Phase 2 work is paid-call retry state, durable Screening/Accio workflow polish, and later P2.6 load smoke.

## Latest Implementation

Date: 2026-06-22

Task: Add the dedicated Screening company-address table and connect it to the existing Google Maps address-footprint workflow.

### User Request

After reviewing the documentation-first design, the user asked to strictly implement it. The 背调 Agent should call Google Maps API to find company-related public addresses, including stores, offices, warehouses/distribution sites, and service/repair locations, then show those locations in a clearly distinct report section.

### Result

Implemented dedicated normalized storage for `Google Maps 地址版图` / `address_footprint` locations:

- added migration `sentura/lib/cross-border-store/migrations/006_screening_address_locations.sql`;
- created `screening_address_locations` with tenant scope, report/target/Lead/run links, owner/team/visibility fields, company/domain identity, Google place id, display/formatted address, address type, relationship status, city/region/country, business status, Google types, website URI, domain/phone match flags, Address Validation JSON, Maps URI, confidence, match reasons, source type, fetched timestamp, and lookup indexes;
- migration backfills any existing `screening_reports.report_json.address_footprint.locations[]` rows;
- `saveScreeningReports` now writes every new `address_footprint.locations[]` row in the same DB transaction as report/evidence/score-block/activity/audit writes;
- customer/Accio cleanup paths now clear address rows together with Screening reports;
- local CBE dev DB migration was applied and live store round-trip verified real write/read of `screening_address_locations`.

Previous implementation in this thread also completed `Google Maps 地址版图` / `address_footprint` across the runtime-facing path:

- bounded Google Places Text Search query variants from legal/brand names, country/city/region, website/domain, phone when available, and official-site location pages discovered through web search/fetch;
- candidate dedupe by Google place id, normalized address, phone, website domain, and display name;
- Place Details for shortlisted unique places using `field_mask_profile="screening_address_footprint"`;
- Address Validation for unique complete-enough addresses;
- relationship classification: `confirmed_company_location`, `probable_company_location`, `possible_related_location`, `rejected_unrelated_location`;
- address role classification: office/headquarters, storefront, warehouse/distribution, service/repair, unknown business location;
- report schema object `address_footprint` with coverage status, search scope, summary counts, location rows, validation verdicts, Maps URIs, confidence, match reasons, and open questions;
- marker normalization, store schema validation, DB completion metadata, report source URL propagation, and shared report UI rendering.

### Docs Updated

- `跨境电商/SCREENING.md`
- `跨境电商/PHASE-2.md`
- `跨境电商/DESIGN.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `sentura/agents/cbe-buyer-screening/{TOOLS.md,skills/**/SKILL.md}`
- `sentura/mcp-servers/cross-border-intel/{README.md,src/schemas.ts,src/tools.ts,src/server.test.ts}`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/{employee-data.ts,employee-api.ts,employee-task-runner.ts}`
- `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`
- `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx`
- `sentura/dashboard/src/lib/cross-border-store/{schemas.ts,screening.ts}`
- `sentura/lib/cross-border-store/migrations/006_screening_address_locations.sql`
- `scripts/test-cross-border-agents.ts`

### Boundary

Maps is still not formal legal/KYB proof. Under the 2026-06-23 design, it can satisfy the first `公司注册与线下门店/地址` authenticity block only for small local/offline companies with an operational matched physical address and no contradictory evidence. A fresh live Dashboard Screening run still needs to be inspected after deployment/restart to confirm persisted reports now include `address_footprint` rows from real Google calls.

## Latest P2.4 Audit

Date: 2026-06-22

Task: Check whether the entire P2.4 implementation is complete.

### Result

P2.4 is complete. The current implementation matches the CE21/P2.4 boundary:

- global workload admission and queue metadata;
- env-backed soft/hard caps and per-agent caps;
- tenant-scoped PostgreSQL advisory admission lock;
- active OpenClaw session counting by `running`/`polling` rows with non-null `session_key`;
- queued `agent_runs` without runnable session keys;
- Lead scope hash, exact join, near-duplicate choice, explicit top-up, no completed-pool row reuse;
- tenant DB pre-search denylist and completion-time DB reconciliation before visible Lead writes;
- Lead failure cascade and scope lease release;
- Employee Lead/Screening/Accio UI gating so queued/join/near responses do not start hidden sessions;
- Screening multi-target production-session block, P2.5 fan-out schema preparation, and the 2026-06-24 parent/child fan-out plus queued-child drain implementation.

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 38/38.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 195/195.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 217/217 static + live PostgreSQL, including true `screening_address_locations` write/read through `saveScreeningReports` and typed lookup.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS, applied `006_screening_address_locations.sql`.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 409/409.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm --dir sentura/dashboard build`: PASS; only the known Next multiple-lockfile workspace-root warning appeared.
- `git diff --check`: PASS before final docs update.
- Targeted `RULES.md` / `CONTEXT.md` scan under CBE agent source workspaces: PASS, no output.

### Boundary

Remaining work belongs to P2.5/P2.6, not P2.4: durable Screening report/retry polish, paid-call retry state, Accio approval-to-memory promotion, Screening handoff consumption, and later load smoke. Queued-work drain/claim and Screening parent/child fan-out were implemented on 2026-06-24.

## Latest Live Audit

Date: 2026-06-22

Task: Inspect two Dashboard Lead Discovery runs and one Screening run after Google Maps integration.

### Result

- Lead session `17f94f97-3c0e-4f9a-9113-d3b61b50a140`: completed successfully in about 98s, target count 5, saved 5 candidates, no duplicates.
- Lead session `a1bd63d9-38c2-4a54-986b-7d8f9b7af987`: completed successfully in about 134s, target count 5, saved 5 candidates, no duplicates.
- Screening session `bcbf1824-def7-4085-bb8c-94fd5c649733`: completed successfully in about 90s for KIKO Group USA (KIKO Wireless), saved one report with 11 evidence items, 3 Google evidence items, coverage 0.78, score 78.41, risk tier `cautious`.
- Matching `agent_runs` rows are all `completed`, with stages `lead_results_saved` or `screening_reports_saved` and no error message.

### Google Maps Evidence

- Lead #1: 9 Places Search calls and 5 Place Details calls; all checked Google results were HTTP 200 `found`.
- Lead #2: 7 Places Search calls and 8 Place Details calls; Search calls were HTTP 200 `found`, Details had 7 HTTP 200 `found` plus one recoverable HTTP 400 `api_error` for an intermediate candidate. The final target count was still met.
- Screening: Places Search HTTP 200 `found`, Place Details HTTP 200 `found`, Address Validation HTTP 200 `validated`.
- No Google API key leakage was found in checked transcripts or persisted normalized evidence.

### Residual Notes

- Non-blocking provider gaps remained: US registry API unavailable, SEC lookup not found for private/non-filer KIKO, Hunter returned account/rate restriction, and Address Validation had `address_complete=false` while still giving an acceptable next-action path.
- Minor future improvement: persisted `lead_sources.source_type` still labels Google Maps URLs as `public_web`; Google provenance is present through URLs/evidence, but preserving exact `google_maps_places` source type would make later filtering cleaner.

## Latest Completed Task

Date: 2026-06-21

Task: Fix recurring Dashboard `寻找客户` timeout after Google Maps API integration for CBE Lead Discovery.

### User Request

The user tested Dashboard `寻找客户` with `phone case / GB` and repeatedly saw `等待后台 AI 员工返回结构化结果超时。`
After the timeout fix, the user reran and said they requested 5 customers but only received 3.

### Google Docs Used

Official docs checked and reflected in implementation/docs:

- Places API (New) Text Search: `https://developers.google.com/maps/documentation/places/web-service/text-search`
- Places API (New) Nearby Search: `https://developers.google.com/maps/documentation/places/web-service/nearby-search`
- Place Details: `https://developers.google.com/maps/documentation/places/web-service/place-details`
- Place data fields and field masks: `https://developers.google.com/maps/documentation/places/web-service/data-fields`
- Place types: `https://developers.google.com/maps/documentation/places/web-service/place-types`
- Usage/billing: `https://developers.google.com/maps/documentation/places/web-service/usage-and-billing`
- Places policies: `https://developers.google.com/maps/documentation/places/web-service/policies`
- API security best practices: `https://developers.google.com/maps/api-security-best-practices`
- Geocoding API overview: `https://developers.google.com/maps/documentation/geocoding/overview`
- Address Validation API overview: `https://developers.google.com/maps/documentation/address-validation/overview`

### Diagnosis

- Latest live `cbe-lead-discovery` session did produce a valid `LEAD_CANDIDATES_JSON_START/END` block with two leads, but the marker arrived after about 5m09s. The UI/Gateway wait path was too tight.
- Google MCP tool calls returned `unavailable_api` because live OpenClaw config did not yet include `GOOGLE_MAPS_API_KEY` in `mcp.servers.cross-border-intel.env`; the employee fell back to slower web search.
- Local DB query for recent persisted `agent_runs.task_kind='lead_discovery'` failures returned no rows, so no DB repair was needed.
- Follow-up run `bce8c811-1f42-43b9-8969-1b138d482cfd`: Google Maps succeeded with HTTP 200 `found` Places/Details calls, final marker had 3 leads, and DB `lead_runs.target_count` was 3. The backend was never asked for 5 in that run.

### Implementation Summary

`cross-border-intel` MCP:

- Added env-backed Google Maps config:
  - `GOOGLE_MAPS_API_KEY`
  - `GOOGLE_MAPS_PLACES_BASE_URL`
  - `GOOGLE_MAPS_GEOCODING_BASE_URL`
  - `GOOGLE_MAPS_ADDRESS_VALIDATION_BASE_URL`
  - `CBE_GOOGLE_MAPS_MAX_RESULTS_PER_SEARCH`
  - `CBE_GOOGLE_MAPS_MAX_DETAILS_PER_RUN`
  - `CBE_GOOGLE_MAPS_MAX_ADDRESS_VALIDATION_PER_RUN`
- Added source types:
  - `google_maps_places`
  - `google_maps_geocoding`
  - `google_maps_address_validation`
- Added four read-only tools:
  - `cbe_intel_google_places_search`: Places Text Search/Nearby Search with `X-Goog-FieldMask`, result caps, and normalized candidates.
  - `cbe_intel_google_place_details`: Place Details with separate `lead_discovery_basic` and `screening_local_presence` field masks.
  - `cbe_intel_google_geocode`: Geocoding with redacted key in `source_url`.
  - `cbe_intel_google_address_validate`: Address Validation with normalized verdict/address/geocode output and no raw-response retention.
- All Google tools return structured statuses (`found`, `not_found`, `validated`, `unavailable_api`, `rate_limited`, `api_error`) and include source metadata plus `api_call_ledger`.
- Missing key returns `unavailable_api`; 429/quota errors return `rate_limited`; API keys are never emitted.
- Setup now reads project `.env`, `~/.openclaw/.env`, and process env before writing MCP env references. `bash scripts/sentura-setup.sh` was rerun, and a redacted config check confirmed Google key/cap references are configured in `~/.openclaw/openclaw.json`.

Agent workspaces:

- Lead Discovery now uses Google Maps Places as the primary discovery source:
  - Text Search/Nearby Search for buyer seeds.
  - Place Details only for shortlists.
  - Web search/fetch confirms company-owned site and mobile-accessory buyer fit.
  - Dedupe prefers `google_place_id`, then domain, name+city/country, email.
- Screening uses Google only as supporting public-footprint evidence:
  - Place Details for local presence.
  - Address Validation for public address consistency.
  - Maps evidence does not count as registry/KYB/trade/financial/fraud/Accio proof.
- Live workspaces synced:
  - `~/.openclaw/workspace/cbe-lead-discovery`
  - `~/.openclaw/workspace/cbe-buyer-screening`
- Verified both still contain exactly the 8 native OpenClaw top-level markdown files and no `RULES.md`/`CONTEXT.md`.

Dashboard/store:

- Updated hidden Lead and Screening prompts to call Google Maps tools first where appropriate.
- Updated source/evidence enums and report labels for:
  - `google_maps_places`
  - `google_maps_geocoding`
  - `google_maps_address_validation`
  - `google_maps_local_presence`
  - `address_validation`
- Updated source normalization and typed store schemas to preserve `google_place_id`, `google_maps_uri`, `field_mask_profile`, `business_status`, and `formatted_address`.
- Updated Lead DB identity logic to prefer `google_place_id` while keeping normalized-domain fallback.
- Diagnostic routes expose only redacted configured/missing Google status.
- Updated Gateway client RPC timeout handling so long `chat.send` calls honor caller `timeoutMs` plus a local grace window.
- Updated hidden Employee task runner so Lead estimates are longer for Maps-plus-web work, frontend send timeout is recoverable, transcript polling continues after send timeout, and a final 60s transcript grace window runs before marker timeout.
- Updated the `寻找客户` drawer so the submit path snapshots the current numeric target input ref, rebuilds the Lead payload from that submitted value, and visibly echoes `目标 N 个客户` in the summary/button.

Setup/docs:

- `scripts/sentura-setup.sh` and `.ps1` now read project `.env` and OpenClaw `.env`, then inject `GOOGLE_MAPS_API_KEY` and Google request caps into the MCP server env when present.
- CBE docs were updated from "planned" to implemented status across API setup, design, Lead, Screening, Phase 2, MCP README, TESTS matrix/detail, and memory.

### Verification

Passed:

- `pnpm --filter @sentura/mcp-cross-border-intel build`
- `pnpm --filter @sentura/mcp-cross-border-intel test`: 24/24
- Real Google Places smoke through MCP with configured API key: HTTP 200, `status="found"`, one candidate, `place_id`, `google_maps_uri`; no key/full response printed
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: 409/409
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: 195/195
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: 217/217
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: 21/21
- `pnpm --dir sentura/dashboard exec tsc --noEmit`
- `bash -n scripts/sentura-setup.sh`
- targeted no-`RULES.md`/`CONTEXT.md` check for updated agent/MCP/test paths
- live workspace 8-top-level-markdown-file checks for both CBE employees
- live `cbe-buyer-screening` workspace diff checks for `TOOLS.md`, `evidence-collection`, `report-writing`, and `buyer-scoring`
- `git diff --check`
- Browser smoke: Dashboard dev server loaded, Manager login `孙总/1234` worked, 吴思彤 employee detail opened, and KIKO shared report dialog opened with no browser console errors. The existing KIKO report predates address-footprint implementation, so it did not contain `address_footprint`; verify populated `Google Maps 地址版图` on the next real Screening run.

Important runtime note:

- Restart the OpenClaw Gateway/MCP process after setup so `cross-border-intel` inherits the configured `GOOGLE_MAPS_API_KEY`.
- Restart Dashboard dev server before retesting so the updated Gateway client/task runner code is loaded.

## Current Dirty Worktree Note

The latest task intentionally changed code, agent workspace files, setup scripts, Dashboard/store integration, docs, tests, memory, and handoff files. Do not revert unrelated work unless the user explicitly asks.

## Next Steps

1. Implement the 2026-06-23 Screening scoring redesign:
   - update runtime-facing `cbe-buyer-screening` prompt/skills;
   - update deterministic scoring behavior and report normalization/schema if needed;
   - update report UI labels from pure `公司注册` to `公司注册与线下门店/地址`;
   - add regression fixtures for small-local Maps-only authenticity, listed/public Maps-without-registry, closed-location caution, and online-only no-Maps-neutral cases.
2. Rerun final hygiene after handoff updates:
   - `git diff --check`
   - optionally `git status --short`
3. In the final user response, note:
   - Backend actually returned a valid marker; the old UI wait path timed out too early.
   - Live MCP env lacked Google key references until setup was rerun; now fixed and verified with a real Google Places smoke.
   - Tests passed; restart Gateway/MCP and Dashboard dev server before retesting.
4. Remaining Phase 2 work includes paid-call retry state, durable Screening report UX polish, Accio approval-to-memory promotion, and Screening handoff consumption. Screening parent/child queue fan-out/draining was implemented on 2026-06-24.
