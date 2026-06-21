> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md)

# Cross-Border E-Commerce — Phase 2

Independent Phase 2 memory for the mobile-accessory Cross-border e-commerce / 跨境电商 client pilot. Use this file for production persistence, customer `admin`/`operator` role boundaries, Admin monitoring, typed store/API routes, DB-backed Employee state, Lead coordination, durable Screening/Accio workflows, load-smoke work, and all future Phase 2 implementation notes. Phase 1 and demo-era history remains in [`phase-1.md`](phase-1.md) as historical audit context.

## Sessions in this file

| Date | Session | Summary |
|---|---|---|
| 2026-06-16 | Next-phase planning readout | Recommended starting Phase 2 with the tenant-scoped CBE business database and typed store layer before localStorage migration, Lead coordinator, or agent tuning. |
| 2026-06-16 | Phase 2 execution plan | Filled `跨境电商/PHASE-2.md` with the production-hardening plan and CE17 coverage. |
| 2026-06-16 | Phase 2 user stratification | Added the first role-boundary design, later superseded by the customer-specific two-level model. |
| 2026-06-16 | Phase 2 customer Admin monitoring redesign | Superseded the broad Sentura-RBAC-style role model with CBE-specific `operator` and `admin` customer levels. |
| 2026-06-16 | Phase 2 P2.1 business database foundation | Implemented PostgreSQL migrations, migration runner, seed tenant/users/profiles, dashboard CBE role/module constants, and CE18 static/live DB verification. |
| 2026-06-17 | Phase 2 memory/test document split | Created this Phase 2 memory file and `docs/tests/tests-cross-border-phase2.md`; updated AGENTS/README/matrices so future CBE Phase 2 memory and tests use the new docs. |
| 2026-06-17 | Phase 2 P2.1 re-verification | Re-ran CE18 static/live PostgreSQL checks, migration seed, focused TS/lint, full dashboard typecheck, legacy CBE suite, DB role/view probes, secret hygiene, and repo hygiene before proceeding to P2.2. |
| 2026-06-17 | Phase 2 P2.2 typed Dashboard store/API routes | Implemented typed Dashboard CBE store modules, Employee/Admin App Router routes, validated Lead/Screening/Accio completion writes, marker parse-failure run/audit handling, and CE19 static/live PostgreSQL checks. |
| 2026-06-17 | Phase 2 P2.3 Employee DB-backed UI migration | Moved Employee home/customers/memory reads to P2.2 APIs, reduced localStorage to draft cache, wired hidden task create-complete-fail DB lifecycle, and passed CE20 verification. |
| 2026-06-17 | Phase 2 DB inspection query fix | Added a schema-correct live DB inspection script after manual psql queries exposed stale UI-projection column assumptions; updated CE20.15 and Phase 2 docs. |
| 2026-06-18 | Phase 2 customer list UX and notification highlight | Simplified the `获客与背调` list by lightening row colors, removing row-level delete, compacting score sort, adding business score wording, and making completed-task notifications flash affected rows for 3 seconds. |
| 2026-06-18 | Phase 2 customer list polish and dismissal fixes | Added click-to-expand product overflow chips, Beijing display times, green `✅` screened status, message-center outside-click close, itemized Screening budget estimates, and durable terminal task-banner dismissal across route switches. |
| 2026-06-19 | Phase 2 Manager report-window parity fix | Reused the shared Employee report dialog for Manager report actions, rendered it through a body portal to avoid parent-dialog clipping, removed stale duplicate Manager report code, and verified Lin Yue -> Currys report layout plus close behavior. |
| 2026-06-19 | Phase 2 Manager login parity | Added a Manager login page copied from the Employee login layout, wired admin name/password auth for preset `孙总/1234`, removed default frontend admin-header bypass, and verified cookie-backed Manager session/API access. |
| 2026-06-19 | Phase 2 Employee/Manager login kickout fix | Split CBE login cookies by role, made Employee and Manager guards call role-specific session checks, enforced expected roles in tenant context, fixed persistent UI hydration mismatch, and verified dual-cookie coexistence plus browser Manager login persistence. |
| 2026-06-21 | Phase 2 report-driven workload/API design update | Incorporated the supplied final pressure/API reports into Phase 2 concurrency, Screening fan-out, API scope, config, tests, and memory docs. |
| 2026-06-21 | Phase 2 country-aware API registration runbook | Added web-researched country routes and detailed API account-prep steps for Screening, while keeping unimplemented country adapters clearly separated from current MCP capability. |
| 2026-06-21 | Phase 2 P2.4 workload coordinator and Lead dedupe | Implemented workload queue/admission, Lead exact/near/completed/top-up coordination, Employee launch gating, Screening session blocking, and CE21 static/live verification. |
| 2026-06-21 | Phase 2 Lead result-level DB dedupe correction | Updated docs/tests so P2.5 starts with database-authoritative Lead reconciliation before customer writes, duplicate skip/audit recording, and missing-count top-up. |
| 2026-06-21 | Phase 2 Lead DB reconciliation implementation and test reset | Implemented completion-time tenant DB dedupe, added pre-search tenant DB denylist for every executable Lead run, removed completed-pool reuse from runtime decisions, added Employee auto top-up, fixed explicit top-up target-count preservation and Lead failure scope release, synced live OpenClaw Lead workspace behavior files, verified CE21 37/37 and store 204/204, and cleared prior local Lead runs/lists for operator testing. |
| 2026-06-21 | Phase 2 Lead strict current-request target correction | After live retest, changed completed same-scope normal requests from "top up this employee's list to target" to "add the full requested net-new target for this request", strengthened Lead prompt/skills to over-collect and replace denylist hits, and synced all Lead workspace behavior files into `~/.openclaw`. |

## Current Phase 2 Ground Truth

- Phase 2 is the current active CBE implementation lane. New CBE production/database/customer-admin/concurrency/store/UI-persistence work should log here, not in `phase-1.md`.
- Phase 1 remains historically important but is not the default detail file for new Phase 2 sessions.
- Customer-facing CBE roles are only `operator` and `admin`.
- `operator` uses the existing `个人中心`, `获客与背调`, and `记忆整理` surfaces.
- `admin` is a customer-side monitoring/supervisor role for live tasks, aggregate lists, per-user lists, Agent usage, costs, failures, and statistics. It is not a Sentura platform administrator and must not expose employee creation, prompt/tool/model/provider settings, OpenClaw config, Gateway config, MCP config, or sandbox/tool-policy changes.
- P2.1 is complete and was re-verified on 2026-06-17. The PostgreSQL foundation lives under `sentura/lib/cross-border-store/` and uses `CBE_DATABASE_URL`; credentials must remain in env/secret injection, not committed files.
- P2.2 typed Dashboard store/API routes are complete.
- P2.3 DB-backed Employee UI migration is complete. `个人中心`, `获客与背调`, `记忆整理`, task notifications, and hidden Lead/Screening/Accio create-complete-fail flows now read/write through the P2.2 APIs; `localStorage` is limited to draft/cache state and explicit demo seed fallback.
- `获客与背调` keeps its current main row information but now uses lighter row backgrounds, a single `评分排序` select, no row-level delete buttons, expandable product overflow chips, Beijing `YYYY-MM-DD HH:mm:ss` found times, no `新找到` row badge, green `✅` screened status, and business score wording. Completed Lead/Screening task links use `highlightTask` to locate affected rows and flash a light-blue outline for 3 seconds.
- The global message center closes when the user clicks outside its dialog. Terminal task-status banners persist dismissal locally and through the task dismiss API so dismissed completed banners do not reappear after route switching.
- Manager-side `查看报告` uses the shared Employee `CustomerReportDialog` implementation. The report overlay renders through `document.body` so it is not clipped by the Manager employee-detail dialog's transform/overflow container; `X` and outside-click close are verified.
- Manager has a dedicated `/client-demos/cross-border/admin/login` page matching the Employee login layout. The preset Manager account is `孙总` / `1234`; login submits `cbeRole: "admin"`. CBE login now writes role-scoped cookies (`sentura_cbe_employee_session`, `sentura_cbe_admin_session`) plus the legacy `sentura_cbe_session` compatibility cookie, and session checks pass `role=operator` or `role=admin` so Employee and Manager sessions can coexist without kicking each other back to login. Manager APIs rely on cookie session by default; `NEXT_PUBLIC_CBE_ADMIN_USER_ID` remains only as an explicit override.
- Manual DB inspection for P2.3 should use `scripts/inspect-cross-border-live-db.sql`. The physical tables intentionally do not duplicate every UI projection field as same-named columns.
- P2.4 workload coordinator and Lead Discovery coordinator are complete as of 2026-06-21. The Dashboard store now queues above 24 active OpenClaw CBE sessions, does not start normal work above the configured caps, and Lead exact/near/top-up scope decisions happen before hidden OpenClaw sessions start.
- Lead Discovery pre-run `scope_hash`/`scope_similarity` is only a cost/backpressure predictor. The database is the authoritative dedupe reference before any customer row becomes visible in an employee list.
- Lead Discovery `targetCount` means database-unique, unassigned customers for the current request, not "number of search results inspected" and not "employee visible-list total". A normal repeated same-scope request keeps the full requested new-customer target; only internal `run_mode = "top_up_unique_leads"` runs use the missing-count remainder. Before any executable hidden search starts, the coordinator retrieves tenant DB identities and passes them as `existing_identity_keys` so the employee avoids already-found customers during query generation and candidate filtering. Completion then reconciles returned candidates against tenant-level identities/candidates/results, writes only new unique candidates, records duplicate same-owner/other-operator reasons in `lead_run_results`, and top-ups missing unique counts with `run_mode = "top_up_unique_leads"` plus database-derived `existing_identity_keys`.
- Runtime no longer returns `reuse_completed_pool`; completed scopes can only provide denylist context for new/top-up work and must not copy one employee's assigned customer rows into another employee's list.
- Screening user batches must split into parent tasks plus single-target child runs by default. P2.4 added the parent/child schema and blocks multi-target single-session Screening runs unless the explicit batch-3 feature flag is enabled; remaining P2.5 work must implement full scheduler fan-out/draining.
- Screening paid email and paid trade checks are capped once per target and require explicit re-approval before retry repeats a paid lookup.
- Current Screening country routing: GB Companies House and US SEC/RDAP/email/trade paths are current MCP-backed routes; France/Japan/Korea/Brazil/Italy are adapter backlog items with documented registration steps; Germany/Spain/Mexico stay official-page/manual routes unless a signed provider adapter is added.

## 2026-06-21 — Phase 2 P2.4 workload coordinator and Lead dedupe

### Context

The user asked to start from P2.4 in `跨境电商/PHASE-2.md`, follow the plan strictly, complete the next-phase implementation, and check it. The current architecture starts hidden OpenClaw sessions from the Employee browser through `GatewayClient`, so the P2.4 server implementation had to return explicit queue/join/reuse/top-up decisions before the browser starts any session.

### Implementation

- Added migration `005_workload_queue_and_screening_batches.sql`:
  - `agent_runs.parent_agent_run_id`, `queue_priority`, `queued_at`, `lease_owner`, `lease_until`;
  - queue/active-session indexes;
  - `screening_batches` and `screening_batch_targets` for P2.5 parent/child fan-out.
- Added Dashboard store workload coordinator:
  - env-backed defaults for 24 soft / 32 hard active CBE session caps, Lead/Screening/Accio subcaps, provider headroom, queue lease, and Screening batch flags;
  - tenant-scoped PostgreSQL advisory transaction lock before active-session admission;
  - active count limited to `running`/`polling` rows with non-null `session_key`, so joined/reused business records do not consume OpenClaw session capacity;
  - `screening_fanout_required` guard blocks multi-target single-session Screening unless explicitly feature-flagged.
- Reworked `createLeadRun`:
  - computes canonical scope JSON and `sha256:` scope hash;
  - exact active scopes return `join_existing` and add membership without creating a second `agent_run`;
  - near active scopes return `offer_near_duplicate_choices`;
  - sufficient completed scopes return `reuse_completed_pool`;
  - short completed scopes create `queue_top_up` with missing-count target size and `existing_identity_keys` denylist;
  - new/queued runs write workload metadata, scope id/hash, run mode, and membership.
- Reworked Lead completion/failure:
  - completion writes `items_produced`, `top_up_needed`, `missing_count`, and `existing_identity_keys`;
  - scope produced count is updated and the active lease is released;
  - failure marks related scope/lead runs failed instead of leaving the lease active.
- Updated Employee UI/API:
  - Lead/Screening/Accio pages no longer start hidden OpenClaw sessions when the server returns queued/join/reuse/near-duplicate decisions;
  - Lead top-up passes `run_mode = "top_up_unique_leads"`, `existing_identity_keys`, and `already_covered_queries` to the hidden prompt;
  - CBE pages using `useSearchParams()` were wrapped in `Suspense` so Next 16 production build succeeds.
- Updated Lead workspace docs/skills for top-up denylist handling.

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21 static checks.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 30/30 static + live PostgreSQL checks.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 184/184.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 204/204.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 394/394.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm --dir sentura/dashboard build`: PASS; only the existing Next workspace-root warning about multiple lockfiles remains.
- `git diff --check`: PASS.
- Forbidden `RULES.md`/`CONTEXT.md` file scan: PASS, no output.

### Historical next at that time

At P2.4 completion, the next step was Lead result-level DB reconciliation/top-up before customer writes. That work is now implemented in the 2026-06-21 section below. Remaining P2.5 work starts with Screening parent/child fan-out and queue draining/claim behavior so queued work can start outside the original browser request path, then durable Screening/Accio workflow polish.

## 2026-06-21 — Phase 2 Lead result-level DB dedupe correction

### Context

The user tested two real operators, 吴思彤 and 张昊翔, with overlapping Lead Discovery scopes:

- 张昊翔: `phone case + tempered glass screen protector / GB + US`
- 吴思彤: `phone case / GB`

The current P2.4 pre-run `scope_similarity` would not necessarily block this subset overlap, and live results can diverge because the agent's web-search strategy is exploratory. The user clarified the product requirement: no employee list should contain customers already assigned to the same or another human employee. Scope prediction is not reliable enough as the business dedupe source of truth; the database must be authoritative at write time.

### Documentation updates

- `跨境电商/MARKET_ACQUISITION.md`:
  - changed exact/near duplicate wording from result reuse to coordination-only;
  - added `Result Reconciliation Contract`;
  - stated that only `new_unique` candidates may enter visible employee customer rows by default;
  - required top-up when reconciliation leaves fewer unique new customers than requested.
- `跨境电商/PHASE-2.md`:
  - updated P2.5 to start with Lead result-level DB reconciliation before Screening fan-out;
  - added `7.6 Lead Result Reconciliation Correction`;
  - added `8.0 Lead Result-Level DB Reconciliation`;
  - updated Immediate Next Task so Lead reconciliation/top-up is first.
- `docs/tests/tests-cross-border-phase2.md` and `docs/TESTS.md`:
  - expanded CE22 planned scope to cover candidate normalization, duplicate same-owner/other-operator/team/tenant skips, duplicate reason recording, automatic top-up, and Employee/Admin summary counts.
- `docs/MEMORY.md`:
  - added Current Ground Truth that CBE Lead customer uniqueness is database-authoritative.

### Next implementation boundary

Before continuing Screening fan-out, implement Lead completion reconciliation in the Dashboard store/API:

1. Normalize candidate identity keys from returned marker payloads.
2. Query `lead_identities`, `lead_candidates`, `lead_run_results`, and allocations in the same completion transaction.
3. Write only new unique customers to the requesting employee list.
4. Record skipped duplicates for audit/provenance.
5. Compute and launch missing-count top-up when needed.
6. Update Employee/Admin copy so "returned candidates" and "new unique customers" are separate metrics.

## 2026-06-21 — Phase 2 Lead DB reconciliation implementation and test reset

### Context

After the documentation correction, the user required the optimization to be implemented immediately and asked to clear prior Lead Discovery tasks/customer lists from the local database for a clean two-operator test with 张昊翔 and 吴思彤.

### Implementation

- Changed `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts` so `saveLeadRunResult` upserts/normalizes `lead_identities`, checks tenant `lead_candidates` by identity/domain before visible writes, and only inserts `new_unique` candidates into the employee customer list.
- Changed `createLeadRun` so every executable Lead run returns a tenant DB pre-search denylist on the coordinator decision, including normal `start_new_run` decisions. The Employee UI passes that denylist into the hidden Lead prompt as `existing_identity_keys` before any `web_search` or `web_fetch` work starts.
- Duplicate returned candidates are now recorded in `lead_run_results.source_snapshot_json.database_reconciliation` with reason metadata, but do not create or update the current employee's `lead_candidates` row or sources.
- Removed completed-pool reuse from the runtime Lead coordinator decision contract. Completed scopes now create `queue_top_up` runs with database/scope-derived `existing_identity_keys`; assigned customer rows are never copied to another employee.
- Added reconciliation summary output from the Lead completion API: returned count, new unique count, duplicate count, missing count, top-up flag, denylist, and item-level reconciliation records.
- Updated the Employee `获客与背调` page to run bounded automatic top-up attempts after completion when DB reconciliation saves fewer unique customers than the requested target.
- Updated the hidden Lead prompt so `existing_identity_keys` must be avoided in every run mode before and after search, not only explicit top-up mode.
- Synced the same pre-search/top-up denylist behavior rules into the live local OpenClaw workspace at `~/.openclaw/workspace/cbe-lead-discovery` for `AGENTS.md`, `skills/lead-deduplication/SKILL.md`, and `skills/lead-query-generation/SKILL.md`. The runtime `~/.openclaw/openclaw.json` already pointed `cbe-lead-discovery` at that workspace and had the current model/config, so the running agent state/config directories under `~/.openclaw/agents/cbe-lead-discovery` were not overwritten.
- Follow-up log analysis found an explicit top-up bug: the Employee UI passed the remaining missing count, but the API schema dropped `run_mode`, so completed-scope coordination subtracted existing owner rows again and could reduce a 5-customer top-up to 1. Added `run_mode` to `CreateLeadRunRequestSchema`, sent it from `createEmployeeLeadRun`, and adjusted completed-scope missing-count logic so explicit top-ups preserve the caller's remaining target.
- The same log review found failed Lead agent runs could leave `lead_runs.status = running` and an active scope lease. `failEmployeeTask` now cascades Lead failures to `lead_runs`, releases `lead_discovery_scopes.active_agent_run_id`, and preserves completed scope state when previous unique candidates already exist. The local `sentura_cbe_dev` test DB was repaired in place: 2 stale failed Lead runs were marked failed, 1 active failed scope was released, current visible duplicate domains remained 0, and 15 successful Lead customers were preserved.
- Updated CE21 tests to verify completed-scope no-reuse, new-run tenant DB pre-search denylist, duplicate skip before visible writes, reconciliation metadata, and top-up denylist/missing-count behavior.
- Synced docs/tests:
  - `跨境电商/PHASE-2.md`
  - `docs/TESTS.md`
  - `docs/tests/tests-cross-border-phase2.md`
  - `docs/MEMORY.md`
  - `docs/memory/cross-border-ecommerce/phase-2.md`
  - `outputs/resume_card.md`
  - `outputs/task_handoff.md`

### Verification

- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 37/37 static + live PostgreSQL checks.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 204/204 static + live PostgreSQL checks.
- `cd sentura/dashboard && pnpm build`: PASS; only the existing Next workspace-root warning about multiple lockfiles remains.
- `git diff --check`: PASS.
- `cd sentura/dashboard && pnpm lint`: FAIL due existing repo-wide React Hooks lint findings in unrelated/currently pre-existing files; this was not introduced by the Lead reconciliation change. `next build` TypeScript still passes.

### Local DB reset

Used the local `sentura_cbe_dev` development database and cleared only Lead Discovery/task/list state for tenant `cross-border-ecommerce`.

Before cleanup:

- users: 5
- lead_candidates: 14
- lead_sources: 26
- lead_runs: 5
- lead_discovery_scopes: 7
- lead_run_memberships: 4
- lead_run_results: 17
- lead_identities: 14
- lead_agent_runs: 5
- lead_activity_events: 10
- screening_targets_linked_to_leads: 1

After cleanup and post-regression recheck:

- users: 5
- lead_candidates: 0
- lead_sources: 0
- lead_runs: 0
- lead_discovery_scopes: 0
- lead_run_memberships: 0
- lead_run_results: 0
- lead_identities: 0
- lead_agent_runs: 0
- lead_activity_events: 0
- `cbe_customer_work_items`: 0

The existing accounts remain, including 张昊翔 and 吴思彤.

### Next

Continue P2.5 with Screening parent task + single-target child-run fan-out, queue draining/claim behavior, paid-call retry state, and durable Screening/Accio evidence/handoff/memory workflows.

## 2026-06-21 — Phase 2 Lead strict current-request target correction

### Context

The user retested with real operators 吴思彤 and 张昊翔 and asked each employee to find 10 new customers. The visible latest run outputs showed one run saving only 1 customer and another saving only 5. DB inspection showed the final customer lists had 11 and 10 customers with no duplicate domains, but the latest runs were server-created top-up runs with `target_count = 1` and `target_count = 5`. That exposed a product semantics bug: the coordinator treated a normal repeated completed-scope request as "fill this employee's list up to target total" instead of "this request must add target_count new unique customers".

### Fix

- Changed `createLeadRun` so normal requests always keep the full current-request `target_count`, even when the same scope was completed before.
- Restricted missing-count behavior to explicit internal `run_mode = "top_up_unique_leads"` requests created by the Employee auto top-up loop.
- Removed the now-stale owner-scope count discount from completed-scope normal requests.
- Raised the Employee Lead auto top-up attempt limit from 4 to 8 and changed incomplete final notices from success tone to error tone, so partial results are not presented as completed work.
- Strengthened the hidden Lead prompt so `target_count` is a hard net-new output target, `max_results_per_query` is not treated as a final cap, denylist hits must be replaced, and blocked `web_fetch` calls should fall back to search-result evidence while continuing candidate discovery.
- Updated `cbe-lead-discovery` `AGENTS.md`, `lead-query-generation`, `lead-deduplication`, and `lead-list-production` so all workspace steps enforce the same strict target and database-denylist semantics.
- Synced the four updated Lead workspace files into `~/.openclaw/workspace/cbe-lead-discovery` and verified byte-for-byte equality with `cmp`.
- Updated CE21 tests so ordinary repeated completed scopes start a fresh full-target run with a denylist, while explicit top-up requests still create missing-count top-up runs.

### Verification

- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 38/38 static + live PostgreSQL checks.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 204/204 static + live PostgreSQL checks.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 394/394.
- `pnpm --dir sentura/dashboard build`: PASS; only the existing Next workspace-root warning about multiple lockfiles remains.
- `git diff --check`: PASS.

## 2026-06-21 — Phase 2 country-aware API registration runbook

### Context

The user asked to combine web search with the supplied API documentation and focus on the countries mentioned in the API/source discussion, because authoritative background-check reports depend on registering the right sources and knowing which route is strongest in each country.

### Web-researched decisions

- GB remains the highest-confidence current registry route because Companies House has an implemented MCP adapter, clear Basic-auth API-key behavior, and official request limits.
- US uses SEC only for public-company/SEC-filer evidence. Private importers require state/official page evidence plus domain/email/public footprint; ImportYeti/Volza are paid Screening-only trade evidence.
- FR should use API Recherche d'Entreprises for public SIREN/SIRET/name/address search once adapter work starts; API Entreprise requires customer habilitation/token and is not a default public route.
- JP should use the National Tax Agency Corporate Number Publication Site/Web-API for basic corporate number/name/address evidence; it does not replace full registry extracts.
- KR OpenDART is useful for listed/disclosing companies, not ordinary private importers. `not_found` is neutral unless the buyer claimed listed/disclosure status.
- BR should treat Receita Federal/Redesim or Serpro CNPJ as official; BrasilAPI-style no-key aggregators are supporting public data, not official API evidence.
- DE/ES/IT/MX require official page/manual routes by default. Italy has an InfoCamere API path after contract; Germany/Spain/Mexico should not be documented as current self-serve API-backed verification.

### Changes made

- Updated `跨境电商/API_KEYS_OPENCLAW_SETUP.md`:
  - added a country/region routing table for GB, US, FR, JP, KR, BR, DE, ES, IT, MX, and OpenCorporates fallback;
  - added detailed account-prep steps for France API Recherche/API Entreprise, Japan Corporate Number Web-API, Korea OpenDART, Brazil Serpro CNPJ, Italy InfoCamere, plus manual routes for Germany/Spain/Mexico;
  - expanded reference-source links to official pages and OpenClaw web/MCP/tool-policy docs.
- Updated `跨境电商/SCREENING.md`:
  - split the old broad country rows into specific France/Japan/Korea/Brazil routes;
  - added the country-aware verification playbook and adapter backlog rules.
- Updated `sentura/mcp-servers/cross-border-intel/README.md`:
  - added a country coverage boundary that lists current MCP behavior separately from planned country adapters.
- Updated `sentura/agents/cbe-buyer-screening/skills/registry-verification/SKILL.md`:
  - added country-specific ordering and evidence-tag guidance for FR/JP/KR/BR/DE/ES/IT/MX.
- Updated tests/memory:
  - `docs/tests/tests-cross-border-phase2.md` adds CE17.26 and CE22 country-routing planned coverage;
  - `docs/TESTS.md` last-updated line now mentions the country-aware API registration runbook;
  - `docs/MEMORY.md` ground truth and session matrix now track this decision.

### Verification

- Planned static verification:
  - `git diff --check`;
  - targeted `rg` checks for the country-route terms and no accidental `RULES.md` / `CONTEXT.md` files.

## 2026-06-21 — Phase 2 report-driven workload/API design update

### Context

The user supplied three reports from the desktop:

- `final-test-report(1).docx`: 10-task final pressure report with prompt details, Phase A/B results, and the decisive Screening batch-size findings.
- `测试结论总报告.docx`: cloud server test conclusion covering tool connectivity, concurrency, model fallback, latency, and boundaries.
- `Sentura - API Pricing.pdf`: API source/cost notes for registry, trade, sales-enrichment, email, and WHOIS/RDAP-style sources.

Key decisions extracted:

- Lead Discovery `find-10` is safe as one session and should use top-up recovery if high-concurrency marker parsing returns fewer than requested leads.
- Screening must not investigate 10 companies in one session. The production shape is single-target fan-out, with batch-3 only as an explicit experiment.
- On the tested 4C/16G mainland ECS + DeepSeek profile, 32 active tasks is the current healthy upper envelope; 48 hit a Gateway RSS soft threshold. Phase 2 should queue above a 24 soft cap and avoid exceeding 32 normal active CBE sessions until a C=40/48 queue validation and soak test pass.
- Paid Screening sources must be budget-gated and per-target capped: one paid email validation pass and one paid trade-data pass unless the operator re-approves retry spend.
- API source scope stays read-only and low-cost first. Sales-enrichment/enterprise paid databases and Alibaba/ICBU remain deferred until access, budget, and read-only adapter proof exist.

### Changes made

- Updated `跨境电商/PHASE-2.md`:
  - added the three supplied reports as source inputs;
  - changed P2.4 from Lead-only concurrency into a global workload coordinator plus Lead coordinator;
  - added 24 soft / 32 hard active-session settings, Lead `find-10` top-up behavior, Screening single-target fan-out, batch-3 feature flag, paid-call caps, and planned queue/fan-out schema;
  - recalibrated P2.6 load smoke and Phase 2 acceptance criteria.
- Updated `跨境电商/SCREENING.md`:
  - recorded the one-target-per-session production decision;
  - expanded API source scope for registry, RDAP/DNS, paid email, public footprint, trade data, SEC, behavior evidence, Alibaba/ICBU, and deferred sales-enrichment APIs;
  - added production execution/config contracts.
- Updated `跨境电商/API_KEYS_OPENCLAW_SETUP.md`:
  - corrected Hunter from "reserved" to the current optional Email Verifier path when `enable_paid_validation=true`;
  - clarified Phase 2 paid trade pressure-test config versus production default `false/0`.
- Updated Screening workspace source docs/config:
  - `sentura/agents/cbe-buyer-screening/config.json5` now records `single_target_fanout`, `maxTargetsPerSession=1`, batch-5+ block, batch-3 experiment flag, and paid call caps;
  - `TOOLS.md` and Screening skills now reject large batch prompts, cap paid email/trade calls, constrain SEC output, and keep default API scope read-only.
- Updated tests/memory:
  - `docs/tests/tests-cross-border-phase2.md` expands CE17 and rewrites CE21-CE23 planned scopes;
  - `docs/TESTS.md` last-updated note now points to the report-driven workload/API design;
  - `docs/MEMORY.md` Current Ground Truth and matrix row updated.

### Verification

- Documentation-only/static consistency pass planned after edits:
  - check no `RULES.md` / `CONTEXT.md` files were created;
  - `git diff --check`;
  - targeted `rg` checks for the new Phase 2 workload/API terms.

### Next

Start P2.4 implementation with the global CBE workload queue before hidden OpenClaw sessions start, then add Lead scope dedupe/top-up. Prepare P2.5 Screening fan-out migration and block production batch-5/batch-10 prompts before adding more API adapters.

## 2026-06-18 — Phase 2 customer list UX and notification highlight

### Changes made

- Kept the existing `获客与背调` list primary columns and row information intact.
- Lightened full-row status backgrounds so the table reads calmer while preserving status grouping.
- Removed row-level delete buttons and kept the top `删除所选` action as the only delete entry point.
- Replaced persistent `评分高到低` / `评分低到高` buttons with one `评分排序` select.
- Added business score wording:
  - high score: `高分 · 优先跟进`;
  - medium score: `中等 · 谨慎跟进`;
  - low score: `低分 · 暂缓/高风险`;
  - `证据不足` remains gray.
- Added task-to-customer highlight plumbing:
  - Lead/Screening completion metadata stores affected customer IDs for new runs;
  - existing DB customer projections expose `leadAgentRunId` and `screeningAgentRunId`;
  - notification links route to `/client-demos/cross-border/employee/customers?highlightTask=...`;
  - the customer page maps the task to affected rows, clears filters if needed, scrolls to the visible row, and flashes a light-blue outline for 3 seconds.
- Added follow-up list polish:
  - product overflow chips such as `+1` expand inline to show all products and collapse with `收起`;
  - row-level `新找到` badges were removed while row highlight remains available through task links;
  - screened rows render a green `✅` instead of a text `已完成` badge;
  - `找到时间` is formatted in Beijing time as `YYYY-MM-DD HH:mm:ss`;
  - Screening budget estimates are itemized from model/search/email/trade-data unit assumptions instead of a fixed demo value.
- Fixed overlays and terminal task dismissal:
  - message center listens for outside pointer clicks while open and closes itself;
  - terminal task close marks all terminal banners dismissed locally and calls the task dismiss API;
  - local dismissed IDs are preserved when DB task polling refreshes the store.

### Verification

- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 353/353.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 127/127.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147.
- Browser validation on `/client-demos/cross-border/employee/customers`: PASS, sort select present, top `删除所选` present, row-level delete count 0, no console errors.
- Browser validation on `/client-demos/cross-border/employee/customers?highlightTask=run_4d25b516-78d7-438f-9bb4-578a88e22127`: PASS, five visible screening rows flashed and the highlight cleared after 3 seconds.
- Browser validation on `/client-demos/cross-border/employee/customers`: PASS, 15 visible rows, product `+1` expanded in place with `收起`, found times were Beijing `YYYY-MM-DD HH:mm:ss`, no ISO markers or `新找到` text, green `✅` status shown, and no console errors.
- Browser validation on task/message overlays: PASS, message dialog closed on outside click; completed task banner close left zero task-status close buttons immediately and after route switching.
- `git diff --check`: PASS.

## 2026-06-19 — Phase 2 Manager report-window parity fix

### Context

The Manager `员工管理` detail dialog could open `查看报告` from the embedded `获客与背调` list, but the report window still looked messy because a fixed-position report overlay was rendered inside the parent Base UI `DialogContent`. That parent dialog uses transform/overflow constraints, so nested fixed content could be visually clipped or layered awkwardly.

### Changes made

- Kept `sentura/dashboard/src/components/cross-border/customer-report-dialog.tsx` as the single shared Employee report-window implementation.
- Updated `CustomerReportDialog` to render the overlay through `createPortal(..., document.body)` and use `z-[70]`, so report windows opened from Manager detail dialogs escape parent clipping and stack above the underlying detail surface.
- Removed the stale Manager-specific duplicate `ReportDetailDialog` and duplicated report layout helpers from `sentura/dashboard/src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`.
- Manager customer-list and high-value report actions now convert `AdminCustomerRow` into the Employee `CustomerListItem` shape and render `CustomerReportDialog` only.

### Verification

- `pnpm --dir sentura/dashboard exec eslint src/components/cross-border/customer-report-dialog.tsx src/app/client-demos/cross-border/admin/_components/customer-list-table.tsx`: PASS.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Chrome smoke against `http://localhost:3002/client-demos/cross-border/admin/employees`: PASS.
  - Opened Lin Yue detail, then Currys `查看报告`.
  - Report title, top metrics, `背调结论`, `评分维度拆解`, `证据明细`, and `客户概览` were visible.
  - Report dialog bounding box was fully inside the 1440x1000 viewport.
  - Report dialog was not inside Manager Base UI `DialogContent`.
  - `X` closed the report dialog.
  - Outside overlay click closed only the report and left the Manager employee-detail dialog open.
  - Browser console captured no warnings or errors.

## 2026-06-19 — Phase 2 Manager login parity

### Context

The user asked for a Manager login interface matching the Employee login screen and a temporary preset Manager account:

- Name: `孙总`
- Password: `1234`

The Manager area previously still had frontend code that sent a default `x-cbe-admin-user-id: cbe-user-admin-001` header, so Manager pages could bypass a real login session.

### Changes made

- Added `sentura/dashboard/src/app/client-demos/cross-border/admin/login/page.tsx`, copied from the Employee login page's logo/card/input/button layout, with Manager labels and `cbeRole: "admin"` in the login request.
- Extended `sentura/dashboard/src/app/api/auth/login/route.ts` so name/password login can target either `operator` or `admin`.
- Added a narrow preset-manager self-heal path for seeded admin `cbe-user-admin-001`: when `孙总/1234` is submitted, the API updates the old seeded admin profile to `孙总` and writes a scrypt password hash before signing the admin session.
- Updated `sentura/lib/cross-border-store/ids.ts` and `seed.ts` so future seed runs create/update the preset admin as `孙总` with password hash for `1234`.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/admin/_data/admin-api.ts` so Manager API calls use cookie session by default and redirect to Manager login on 401/403. The admin debug header is now only sent if `NEXT_PUBLIC_CBE_ADMIN_USER_ID` is explicitly set.
- Updated `sentura/dashboard/src/components/app-shell.tsx` so Manager business pages require an `admin` session, Manager login hides app nav/account chrome like Employee login, and the Manager account menu displays the session name and supports logout.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 172/172.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 389/389.
- `POST http://localhost:3002/api/auth/login` with `{"displayName":"孙总","password":"1234","cbeRole":"admin"}`: PASS, returned 200, `displayName=孙总`, `cbeRole=admin`, session cookie, and Manager employees redirect.
- Same login route with wrong password: PASS, returned 401.
- Cookie-authenticated `GET /api/client-demos/cross-border/session`: PASS, returned `孙总/admin`.
- Cookie-authenticated `GET /api/client-demos/cross-border/admin/operators`: PASS, returned 200.

## 2026-06-19 — Phase 2 Employee/Manager login kickout fix

### Context

The user reported that both the Employee operating platform and Manager platform could flash and then return to login. Root cause: both platforms shared `sentura_cbe_session`, while AppShell immediately redirected when the cookie role did not match the current platform. Logging into one platform could therefore overwrite the cookie needed by the other platform.

The Next dev log also showed a related page-stability issue on Employee home: persisted range state rendered as `本周` on the client while the server rendered the default `本月`, causing a hydration mismatch.

### Changes made

- Added role-scoped CBE session cookies:
  - `sentura_cbe_employee_session`;
  - `sentura_cbe_admin_session`;
  - legacy `sentura_cbe_session` is still written/read for compatibility, but only accepted when the decoded role matches the expected role.
- Updated `cbeSessionFromRequest(request, expectedRole)` and tenant context resolution so Employee API paths expect `operator` and Manager API paths expect `admin`.
- Updated login to set both the legacy cookie and the matching role cookie.
- Updated logout to support `?role=operator|admin`, clearing only the relevant role cookie plus the legacy cookie for that logout.
- Updated AppShell and Employee home session fetches to call `/api/client-demos/cross-border/session?role=operator` or `?role=admin`.
- Fixed `usePersistentUiState` so first render uses the stable default and reads `localStorage` after mount, preventing first-render SSR/client text mismatch for filters such as Employee home `本月/本周`.
- Added static regression coverage for role-scoped session cookies, role-specific guards/logout, and hydration-safe persistent UI state.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `node_modules/.bin/tsx scripts/test-cross-border-phase2-store.ts`: PASS, 174/174.
- `node_modules/.bin/tsx scripts/test-cross-border-agents.ts`: PASS, 392/392.
- HTTP smoke on `http://127.0.0.1:3002`:
  - `POST /api/auth/login` with `孙总/1234/admin`: PASS, returned 200 and wrote both `sentura_cbe_session` and `sentura_cbe_admin_session`.
  - Admin cookie accepted `role=admin` and was rejected for `role=operator`.
  - Generated Employee role cookie accepted `role=operator` and was rejected for `role=admin`.
  - Combined Admin + Employee cookies kept both `role=admin` and `role=operator` session endpoints active.
- Browser smoke on `http://127.0.0.1:3002/client-demos/cross-border/admin/login`: PASS, submitted `孙总/1234`, reached `/client-demos/cross-border/admin/employees`, saw Manager business page content, no Next error overlay, and no browser console errors. Navigating to Employee without an Employee cookie correctly showed Employee login; navigating back to Manager kept the Manager session active and did not flash back to Manager login.

## 2026-06-18 — Phase 2 customer list polish and dismissal fixes

### Changes made

- Added `CustomerProductBadges` so compact product chips show the first two products and a clickable `+N`; clicking expands the complete product list in place and shows `收起`.
- Removed row `新找到` badges from desktop and mobile customer rows while preserving task-linked flash highlighting.
- Replaced text `已完成` list badges with a green `✅` for screened customers.
- Formatted `找到时间` in Beijing time as `YYYY-MM-DD HH:mm:ss` across list rows, mobile cards, and detail metrics.
- Reworked Screening estimated cost from fixed demo per-target pricing into itemized OpenAI model token, Tavily search, optional Abstract/Hunter email validation, and optional paid trade-data budget assumptions.
- Added outside-pointer close behavior for the global message center dialog.
- Persisted terminal task-status dismissal locally and through `/employee/tasks/[id]/dismiss`; closing a terminal banner dismisses all terminal banners so older completed tasks do not reappear after route switching.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 353/353.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 127/127.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147.
- `git diff --check`: PASS.
- Browser validation on `/client-demos/cross-border/employee/customers`: PASS, product `+1` expanded and collapsed, Beijing display times had no ISO markers, `新找到` was absent, green `✅` was present, task status close remained dismissed after route switching, and browser console had no errors.
- Browser validation on message center: PASS, dialog opened with `aria-expanded=true`, outside click closed it and reset `aria-expanded=false`, and browser console had no errors.

## 2026-06-16 — Next-phase planning readout

### Context

The Employee UI and hidden OpenClaw task runner had reached CE16 coverage, but customer rows, task records, notifications, reports, and memory previews were still local/client-persisted. That blocked multi-user behavior, dedupe, audit, retry, and production readiness.

### Decision

Start Phase 2 with the shared CBE business database and typed persistence/store layer, then:

1. Replace Employee localStorage as the source of truth.
2. Add Lead Discovery run-scope dedupe/shared-result coordination.
3. Tune the three employees against durable run/evidence/handoff contracts.
4. Add duplicate-run and 30-50 user/load-smoke coverage once the store and coordinator exist.

### Boundary

Keep one OpenClaw Gateway with three persistent CBE employees for this single customer trust boundary. Do not give employees raw SQL credentials or SQL tools.

## 2026-06-16 — Phase 2 execution plan

### Changes made

- Filled `跨境电商/PHASE-2.md` with:
  - source alignment table;
  - Phase 2 goals and non-goals;
  - P2.1-P2.6 execution order;
  - PostgreSQL-compatible tenant-scoped schema and indexes;
  - typed store and Next.js route-handler boundary;
  - Employee state migration plan;
  - Lead Discovery coordinator algorithm;
  - durable Screening and Accio persistence/approval workflows;
  - backpressure/load-smoke plan;
  - implementation files, tests, acceptance criteria, and risks.
- Linked Phase 2 from README/AGENTS/DESIGN.
- Added CE17 coverage.

### Boundary

This was a planning/documentation pass. No runtime schema, route, store, or UI migration code was added in that session.

## 2026-06-16 — Phase 2 user stratification

### Changes made

- Added an initial user-stratification design in `跨境电商/PHASE-2.md`.
- Mapped broader Sentura-style roles into CBE-facing concepts.
- Added database implications around CBE profiles, row ownership, departments, visibility, budget policies, and data-source settings.
- Expanded CE17 coverage.

### Supersession

This session was superseded later the same day by the customer-specific Admin monitoring redesign. The current model is only `operator` and `admin`.

## 2026-06-16 — Phase 2 customer Admin monitoring redesign

### User clarification

The customer is not buying an employee-creation console. Ordinary users should use the current Employee UI. Admin should monitor which human user is running which task, which CBE Agent is investigating which target, aggregate acquisition/screening lists, per-user lists, usage, costs, failures, and statistics.

### Current decision

- `operator` / 普通用户 / 业务员工:
  - uses `个人中心`, `获客与背调`, and `记忆整理`;
  - starts Lead/Screening/Accio work;
  - sees own/shared work and retryable own failures.
- `admin` / 管理员 / 业务主管:
  - read-mostly customer supervisor;
  - monitors live/recent tasks, aggregate lists, per-user views, Agent usage, costs, failures, and statistics;
  - cannot create AI employees or modify prompts, tools, models, providers, OpenClaw config, Gateway config, MCP config, sandbox/tool policy, or duplicate-run coordinator behavior.

### Files updated

- `跨境电商/PHASE-2.md`
- `跨境电商/UI.md`
- `跨境电商/DESIGN.md`
- `README.md`
- `AGENTS.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-1.md`

### Boundary

This was still design/documentation only. Runtime enforcement and Admin pages remained future work.

## 2026-06-16 — Phase 2 P2.1 business database foundation

### User request

Start the next phase from `跨境电商/PHASE-2.md` 2.1/P2.1, use local PostgreSQL (`postgres` user on port 5432), strictly follow the plan, and check the implementation.

### Scope completed

- PostgreSQL schema/migration files.
- `CBE_DATABASE_URL`-driven DB config loading.
- Migration runner and deterministic seed data.
- Tenant `cross-border-ecommerce`, one `admin`, and two `operator` profiles.
- Dashboard-side CBE role/module boundary constants for later P2.2 route work.
- CE18 verification script with static and live PostgreSQL checks.

### Files added

- `sentura/lib/cross-border-store/migrations/001_initial_schema.sql`
- `sentura/lib/cross-border-store/migrations/002_lead_scope_coordinator.sql`
- `sentura/lib/cross-border-store/db.ts`
- `sentura/lib/cross-border-store/ids.ts`
- `sentura/lib/cross-border-store/schemas.ts`
- `sentura/lib/cross-border-store/seed.ts`
- `sentura/lib/cross-border-store/migrate.ts`
- `sentura/lib/cross-border-store/index.ts`
- `sentura/dashboard/src/lib/cross-border-store/index.ts`
- `scripts/test-cross-border-phase2-store.ts`

### Files updated

- `package.json`
- `pnpm-lock.yaml`
- `sentura/lib/index.ts`
- `sentura/lib/package.json`
- `sentura/lib/tsconfig.json`
- `跨境电商/PHASE-2.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-1.md`

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 64/64 static checks.
- `CBE_DATABASE_URL=... pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 74/74 static + live DB checks.
- `CBE_DATABASE_URL=... pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS; skipped both already-applied migrations and returned `seededUsers=3`, `adminProfiles=1`, `operatorProfiles=2`.
- Focused TypeScript compile for new store/test files: PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store/index.ts`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.
- `git diff --check`: PASS.

### Known boundary

Full `sentura/lib` typecheck remained blocked by pre-existing `.ts` import-extension errors in `config-versioning.ts`, `per-agent-mcp.ts`, and `secrets.ts`. The new cross-border store files were typechecked directly under strict NodeNext settings.

Next implementation step is P2.2: typed store API and Next.js route handlers that validate employee marker JSON before DB writes.

## 2026-06-17 — Phase 2 memory/test document split

### User request

The user clarified that from now on all CBE memory and tests should be Phase 2 related, and asked to create new Phase 2 memory and test documents, reorganize the relevant content into them, and update `AGENTS.md`.

### Changes made

- Created this file: `docs/memory/cross-border-ecommerce/phase-2.md`.
- Created `docs/tests/tests-cross-border-phase2.md`.
- Updated `docs/MEMORY.md` so Phase 2 rows point to this file and future Phase 2 sessions are expected here.
- Updated `docs/TESTS.md` so CE17/CE18 detail links point to the new Phase 2 test detail file.
- Updated `AGENTS.md` to make the Phase 2 CBE memory/test docs the default for production/database/concurrency/customer-admin/store/UI-persistence work.
- Updated `README.md` Key Documentation so the new docs are visible from the doc hub.

### Boundary

No business-code changes were made in this session. This is a documentation topology change for future Phase 2 work. Historical Phase 1 detail and test files remain intact for auditability.

## 2026-06-17 — Phase 2 P2.1 re-verification

### User request

The user asked to recheck the P2.1 implementation and decide whether Phase 2 can proceed to the next step.

### Verification performed

- Read the current resume card and targeted handoff references for P2.1/CE18.
- Verified local tool versions: Node `v24.16.0`, pnpm `11.5.1`.
- Confirmed `pg_isready`, `psql`, and `createdb` are not on the current shell `PATH`, then used the project `pg` dependency to connect to local PostgreSQL as `postgres:postgres` and reuse `sentura_cbe_dev`.
- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 64/64 static checks.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 74/74 static + live DB checks.
- `CBE_DATABASE_URL=... pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS; migrations skipped as already applied and seed returned `seededUsers=3`, `adminProfiles=1`, `operatorProfiles=2`.
- Focused strict NodeNext compile for new store/test files: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store/index.ts`: PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335 legacy CBE checks.
- DB probe confirmed migrations `001/002`, CBE roles `admin=1` and `operator=2`, all three projection views, and rejection of invalid `platform_admin` CBE role by DB constraint.
- Secret hygiene grep over migration/seed/source ID files returned no committed database URLs, passwords, API keys, app secrets, bearer tokens, emails, or raw tokens.
- `git diff --check`: PASS.
- No `RULES.md` / `CONTEXT.md` files were found outside pruned dependency/git directories.

### Decision

P2.1 remains complete. It is safe to proceed to P2.2: typed Dashboard store API modules and Next.js route handlers for validated Employee customer/task/memory reads plus Lead/Screening/Accio completion writes.

## 2026-06-17 — Phase 2 P2.2 typed Dashboard store/API routes

### User request

The user asked to start from P2.2 in `跨境电商/PHASE-2.md`, strictly follow the plan, complete the next-phase work, and check the implementation.

### Scope completed

- Added typed Dashboard CBE store modules under `sentura/dashboard/src/lib/cross-border-store/`:
  - DB pool/config boundary using `CBE_DATABASE_URL`;
  - Zod request/marker schemas;
  - tenant context and `operator`/`admin` role enforcement;
  - `agent_runs`, audit, activity event, customer, task, notification, Lead, Screening, Accio, handoff, API ledger, and Admin read modules.
- Added Employee App Router API routes under `sentura/dashboard/src/app/api/client-demos/cross-border/employee/`:
  - customer/task/notification/memory reads;
  - Lead run create and complete;
  - Screening run create and complete;
  - Accio import create and complete;
  - task dismiss, notification read, and handoff create.
- Added Admin read-only monitoring API routes under `sentura/dashboard/src/app/api/client-demos/cross-border/admin/`:
  - overview;
  - live tasks;
  - customers;
  - operators;
  - operator detail;
  - Agent usage.
- Completion endpoints validate marker payloads before writes.
- Evidence-bearing Lead/Screening markers require source URLs and fetched timestamps.
- Validation failure routes mark the referenced `agent_runs` row failed with `error_code = marker_parse_failed` and write audit metadata when an `agent_run_id` is available.
- Lead completion writes candidates, source evidence, identities/results, activity events, and audits.
- Screening completion writes targets, reports, evidence, score blocks, activity events, and audits.
- Accio imports store hash/redacted message records only; Accio summaries create pending-review memory facts and Screening handoffs.
- Dashboard package now declares `pg`, `zod`, and `@types/pg`.
- Extended `scripts/test-cross-border-phase2-store.ts` with CE19 static checks and live PostgreSQL round-trip checks.

### Important boundary

P2.2 is server-side store/API work. It does not migrate the existing React Employee pages or `use-cbe-employee-store` off `localStorage`; that is P2.3. The P2.2 routes are now ready for that migration.

### Files added

- `sentura/dashboard/src/lib/cross-border-store/db.ts`
- `sentura/dashboard/src/lib/cross-border-store/schemas.ts`
- `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`
- `sentura/dashboard/src/lib/cross-border-store/errors.ts`
- `sentura/dashboard/src/lib/cross-border-store/ids.ts`
- `sentura/dashboard/src/lib/cross-border-store/agent-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/audit.ts`
- `sentura/dashboard/src/lib/cross-border-store/api-ledger.ts`
- `sentura/dashboard/src/lib/cross-border-store/customers.ts`
- `sentura/dashboard/src/lib/cross-border-store/tasks.ts`
- `sentura/dashboard/src/lib/cross-border-store/notifications.ts`
- `sentura/dashboard/src/lib/cross-border-store/lead-runs.ts`
- `sentura/dashboard/src/lib/cross-border-store/screening.ts`
- `sentura/dashboard/src/lib/cross-border-store/accio.ts`
- `sentura/dashboard/src/lib/cross-border-store/handoffs.ts`
- `sentura/dashboard/src/lib/cross-border-store/admin.ts`
- `sentura/dashboard/src/lib/cross-border-store/route-utils.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/customers/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/lead-runs/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/lead-runs/[id]/complete/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/screening-runs/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/screening-runs/[id]/complete/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/[id]/dismiss/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/notifications/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/notifications/read/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/imports/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/memory/imports/[id]/complete/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/handoffs/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/overview/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/live-tasks/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/customers/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/operators/[id]/route.ts`
- `sentura/dashboard/src/app/api/client-demos/cross-border/admin/agent-usage/route.ts`

### Files updated

- `sentura/dashboard/src/lib/cross-border-store/index.ts`
- `sentura/dashboard/package.json`
- `pnpm-lock.yaml`
- `scripts/test-cross-border-phase2-store.ts`
- `跨境电商/PHASE-2.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`

### Verification

- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 109/109 static checks.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 129/129 static + live PostgreSQL checks.
- Live CE19 probe created and cleaned up Lead, Screening, Accio import/summary, pending memory fact, handoff, completed task, and failed marker-parse records.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store src/app/api/client-demos/cross-border/employee src/app/api/client-demos/cross-border/admin`: PASS.
- `cd sentura/dashboard && pnpm build`: PASS; Next route manifest includes all new Employee/Admin API routes.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.

### Fixes found during verification

- Store functions originally relied on route-level Zod defaults for `visibility_scope`; live direct-store tests caught null `visibility_scope` inserts. Fixed by parsing create inputs at the store boundary as well.
- Task/notification reads originally reused a scope helper that referenced `team_name`, but `agent_runs` has no `team_name` column. Fixed task/notification filters to use owner/user/tenant-shared scope for `agent_runs`, while keeping team scope for business record projections that actually have `team_name`.

### Next

Proceed to P2.3: migrate the Employee UI pages and `use-cbe-employee-store` to read/write through these DB-backed APIs, keeping localStorage only for drafts/cache or explicit fallback.

## 2026-06-17 — Phase 2 P2.3 Employee DB-backed UI migration

### Context

The user asked to start from P2.3 in `跨境电商/PHASE-2.md`, strictly follow the plan, complete the next-stage work, and check the implementation. P2.2 had already created the durable Dashboard store/API boundary, but the Employee React pages still used `localStorage` as the working source of truth.

### Files updated

- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/components/app-shell.tsx`
- `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`
- `sentura/dashboard/src/stores/use-cbe-employee-store.ts`
- `sentura/dashboard/src/lib/cross-border-store/{accio.ts,customers.ts,schemas.ts,tasks.ts}`
- `sentura/dashboard/src/app/api/client-demos/cross-border/employee/tasks/[id]/fail/route.ts`
- `scripts/test-cross-border-agents.ts`
- `scripts/test-cross-border-phase2-store.ts`
- `跨境电商/PHASE-2.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `outputs/resume_card.md`
- `outputs/task_handoff.md`

### Behavior implemented

- Added a typed Employee client API adapter for customer/task/memory reads, notification read writes, Lead/Screening/Accio create-complete calls, and task failure writes.
- Moved `use-cbe-employee-store` away from source-of-truth persistence: it now persists only `draftCache`; rows, memory rows, and tasks are hydrated from DB-backed API reads.
- Kept demo seed state only behind `NEXT_PUBLIC_CBE_USE_DEMO_SEED=1` or `CBE_USE_DEMO_SEED=1`.
- Updated `个人中心`, `获客与背调`, and `记忆整理` to load from Employee APIs and refresh DB-backed lists after successful writes.
- Wired hidden Lead, Screening, and Accio runs to create a DB run/import before OpenClaw session start, reuse a planned session key, complete through validated endpoints after marker parsing, and mark DB tasks failed on Gateway/model/marker failures.
- Updated notification reads to poll terminal task projections and mark read state through the API instead of browser-only localStorage.
- Expanded customer and Accio read projections with report/source/memory fields needed by the existing UI.
- Normalized Lead/Screening/Accio marker payloads client-side before completion so source URLs, evidence timestamps, redacted Accio messages, and memory-preview metadata satisfy the P2.2 server schemas. Lead/Screening normalization now fails missing traceable source URLs instead of writing placeholder evidence.

### Verification

- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 123/123 static checks.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 337/337 legacy CBE checks.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 143/143 static + live PostgreSQL checks.
- Focused Dashboard ESLint for Employee pages/components/store/API/store modules: PASS.
- `cd sentura/dashboard && pnpm build`: PASS; route manifest includes `employee/tasks/[id]/fail`.
- Browser validation against `http://localhost:3000/client-demos/cross-border/employee`, `/employee/customers`, and `/employee/memory`: PASS, no runtime or console errors. The local DB had no business rows, so DB-backed empty states were expected.
- Employee GET API probes for customers, memory, and tasks returned HTTP 200 envelopes from the local Dashboard server.
- `git diff --check`: PASS before documentation updates; rerun after doc updates is expected in final verification.

### Boundary and next

P2.3 creates durable DB-backed Employee UI reads and task lifecycle writes, but it does not yet dedupe cross-user Lead Discovery scopes. Proceed to P2.4: implement the Lead Discovery coordinator so exact same-scope requests join one active OpenClaw run, near duplicates offer choices, and top-up mode passes an existing-identity denylist.

## 2026-06-17 — Phase 2 DB inspection query fix

### Context

After P2.3, the user tested manual PostgreSQL queries against `sentura_cbe_dev` and found missing-column errors for fields such as `lead_candidates.website`, `lead_sources.finding`, `screening_targets.website`, `screening_reports.company_name`, and `lead_candidates.agent_run_id`. The runtime schema and store code were correct; the problem was the manual inspection SQL using UI/API projection field names as if they were physical table columns.

### Fix

- Added `scripts/inspect-cross-border-live-db.sql` as the supported live DB inspection runbook for Lead, Screening, task, evidence, and activity records.
- The script derives `website` from `lead_run_results.source_snapshot_json->>'website'`, `lead_candidates.normalized_domain`, or `screening_targets.supplied_fields_json->>'website'` depending on record family.
- It uses `lead_sources.excerpt` for Lead source text, while `screening_evidence.finding` remains valid only for Screening evidence.
- It joins `screening_reports -> screening_targets` for company metadata and `lead_candidates -> lead_runs -> agent_runs` for run metadata.
- Updated `跨境电商/PHASE-2.md`, `docs/tests/tests-cross-border-phase2.md`, and `docs/TESTS.md` so future DB checks use the script or Employee API projections instead of guessed raw table columns.
- Added CE20.15 static checks that assert the inspection SQL uses the real FK paths and does not reintroduce stale projection-only columns.

### Verification

- `env -u CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 127/127 static checks.
- `CBE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sentura_cbe_dev pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 147/147 static + live PostgreSQL checks.
- Executed `scripts/inspect-cross-border-live-db.sql` against local `sentura_cbe_dev` through `node-postgres` after stripping psql-only `\echo` lines: PASS, no missing-column errors.

### Boundary and next

The physical schema was not changed. The fix is a correct inspection/runbook layer plus test coverage. P2.4 Lead Discovery coordinator concurrency remains the next implementation task.
