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
| 2026-06-21 | Phase 2 Google Maps + web-search source redesign docs | Researched Google Maps Platform Places API docs and documented Google Maps Places + OpenClaw web search as the target primary Lead acquisition/backcheck route pending user review. |
| 2026-06-21 | Phase 2 Google Maps MCP integration for Lead/Screening | Implemented read-only Google Maps Places, Geocoding, and Address Validation tools in `cross-border-intel`; rewired Lead Discovery to Maps-first discovery plus web-search verification and Screening to local-presence/address-consistency evidence; synced live OpenClaw workspaces and verified MCP, Dashboard, store, concurrency, and CBE static suites. |
| 2026-06-21 | Phase 2 Dashboard Lead timeout and Google env runtime fix | Diagnosed recurring `寻找客户` Dashboard timeout as a valid backend marker arriving after a tight UI wait window plus missing Google key references in live MCP env; fixed long RPC timeout handling, transcript recovery/final grace, setup `.env` loading, reran setup, and verified real Google Places plus regression suites. |
| 2026-06-21 | Phase 2 Dashboard Lead target-count submit fix | Inspected the user's latest `phone case / GB` run: Google Places succeeded, the backend saved 3 unique leads, and the actual submitted `target_count` was 3 rather than 5; fixed the Lead sheet submit path to snapshot the current numeric input and visibly echo the target count. |
| 2026-06-22 | Phase 2 live Google Maps Lead/Screening audit | Inspected two successful `tempered glass screen protector / US` Lead runs and one KIKO Screening run; verified Google Places/Details/Address Validation calls, 10/10 Lead candidates saved, the KIKO Screening report saved, and only recoverable provider gaps remained. |
| 2026-06-22 | Phase 2 P2.4 completion audit | Rechecked the full P2.4 scope against `PHASE-2.md`, CE21 tests, workload/Lead/Screening/Accio/UI source paths, live PostgreSQL behavior, agent regression, Dashboard typecheck, and repo hygiene; confirmed P2.4 is complete and remaining queue-drain/Screening fan-out/Accio work is P2.5. |
| 2026-06-22 | Phase 2 Screening Google Maps address-footprint report design | Documented a new Screening workflow and report section that uses bounded Google Maps Places searches, Place Details, and Address Validation to discover company-related public offices/stores/warehouse/service locations, with implementation pending user review. |
| 2026-06-22 | Phase 2 Screening Google Maps address-footprint implementation | Implemented the approved address-footprint path across Screening prompts/skills, `cross-border-intel`, typed marker/store schemas, Dashboard report rendering, static tests, docs, and live OpenClaw workspace files. |
| 2026-06-22 | Phase 2 Screening dedicated address table | Added `screening_address_locations`, wired `saveScreeningReports` to persist every `address_footprint.locations[]` row, added cleanup/backfill/test coverage, and applied the migration to the local CBE dev database. |
| 2026-06-22 | Phase 2 Google Maps integration final audit | Rechecked the Google Maps integration across MCP tools, Lead Discovery, Screening, Dashboard UI/reporting, address persistence, setup env wiring, scoring boundaries, documentation, and regression suites; no blocking Google Maps gaps remain. |
| 2026-06-23 | Phase 2 scale-aware Google Maps Screening scoring design | Documented the new 25% `公司注册与线下门店/地址` first block, company-scale assessment, medium/large registry+Maps fusion, and small-local/offline Maps-only authenticity rule; implementation remains pending. |
| 2026-06-23 | Phase 2 scale-aware Google Maps Screening scoring implementation | Implemented `company_scale_assessment`, `公司注册与线下门店/地址` labeling, MCP scoring propagation, Dashboard report rendering, static/live store validation, and live `cbe-buyer-screening` workspace sync. |
| 2026-06-24 | Phase 2 Screening parent/child fan-out and queue drain | Implemented P2.5 parent batch plus single-target child run fan-out, queued child claim/drain, parent aggregate updates, Employee execution path, live CE22 PostgreSQL probe, and live OpenClaw validation with operator `吴思彤`. |
| 2026-06-24 | Phase 2 P2.6 load-smoke tooling and readiness drill | Implemented CE23 DB-only load-smoke script, guarded backup/restore drill, runbook/checklist, 50-session/10-Lead/25-Screening/3-Accio/24-soft/32-hard checks, and verified static/live PostgreSQL smoke with cleanup; target go-live remains conditional on remaining CE22/P2.5 work. |
| 2026-06-24 | Phase 2 local production preflight completion | Closed remaining CE22/P2.5 paid retry and durable Accio/Screening workflow blockers, ran CE23 local DB-only smoke, local backup/restore drill, Dashboard build, 410/410 CBE static regression, and Browser memory-approval smoke; only target-environment go-live evidence remains. |
| 2026-06-24 | Agent-memory branch merge and Accio manual import formats | Merged `agent-memory` into `ecommerce`, integrated JSON/text/screenshot Accio manual imports, OpenClaw-compatible image attachments, source/input metadata persistence, and CE24 verification without changing Phase 2 production/go-live boundaries. |
| 2026-06-25 | Accio import migration application fix | Applied the newly merged 008 Accio import-format migration to the local CBE database after a runtime missing-column error, confirmed the three new columns, and re-ran live store checks 243/243. |
| 2026-06-25 | Accio memory report projection fix | Diagnosed a sample report that looked empty despite useful structured extraction, fixed the store/API/UI projection so analyzed customer/profile/intent/price/behavior facts render in the Employee memory report, and verified typecheck, static/live store checks, CBE static regression, and Browser sample smoke. |
| 2026-06-25 | Accio multi-screenshot upload explicit support | Confirmed the screenshot path accepts multiple images and batches Gateway attachments, made the Employee upload UI explicitly multi-select, added normalizer/UI/runner static regression, and verified Dashboard typecheck plus 418/418 CBE static checks. |
| 2026-06-25 | Memory agent separation from Lead/Screening boards | Made `记忆整理` a preview-only board separated from `获客与背调`; removed write approval, Screening handoff, supplement routes, Accio customer projection, and Accio interop writes; verified typecheck, CBE static 415/415, store 218/218 static, and store 244/244 live PostgreSQL. |
| 2026-06-25 | Phase 2 burst/concurrency audit | Checked current CBE handling for task bursts and the "8" limit; confirmed burst admission/queue paths through live PostgreSQL tests, clarified that `MAX_LEAD_COMPLETION_ATTEMPTS = 8` is Lead auto top-up round protection rather than a global task cap, and recorded CE21 46/46 plus CE23 47/47 live DB-only verification. |
| 2026-06-26 | Alibaba Cloud target deployment setup | Completed the first Alibaba Cloud ECS/RDS/ALB target setup after onboard: Sentura setup, RDS migration/seed, Dashboard/Gateway systemd services, Nginx app/admin/gateway routing, public HTTPS/WSS checks, and cleanup of old failed deployment residue. |
| 2026-06-26 | Production Employee/Admin route split | Locally changed CBE public routes to canonical `/employee`, `/employee/login`, `/admin`, `/admin/login`, `/api/employee/*`, `/api/admin/*`, and `/api/session`, while keeping legacy implementation files behind Next rewrites and old page URLs as redirects. |
| 2026-06-26 | Production route split ECS rollout | Rebuilt the pulled route split on Alibaba ECS, restarted Dashboard, updated Nginx root redirects to canonical `/employee` and `/admin/login`, and verified live RDS, public HTTPS page/API smoke, and public WSS Gateway. |
| 2026-06-26 | Admin SSR rewrite hotfix | Fixed `admin.sentura.ai/admin/login` rendering the Employee shell despite HTTP 200 by recognizing Next rewrite destination paths in route helpers and tenant context; deployed the hotfix to ECS and verified manager shell plus login-to-employees. |
| 2026-06-26 | ECS Lead task sandbox readiness fix | Built the missing OpenClaw Docker sandbox image on ECS after the first production `寻找客户` run failed before reply, restarted Gateway, verified sandboxed Lead startup plus Google Places tool execution, marked the stale DB Lead run failed through the store layer, released the active Lead scope, and cleaned diagnostic session artifacts. |
| 2026-06-26 | Screening fenced-JSON timeout recovery | Fixed a production `背调` timeout where OpenClaw completed the CPR report but returned fenced JSON without `SCREENING_REPORTS_JSON` markers; added a guarded whole-response JSON fallback, deployed/rebuilt/restarted ECS Dashboard, and backfilled the CPR report through the normal completion API/store path. |
| 2026-06-26 | Hidden task structured-output repair loop | Added a one-shot no-tools/no-reinvestigation JSON repair turn for malformed or completed non-marker Lead/Screening/Accio/image hidden-task replies, timestamp-scoped transcript reads, local/ECS 420/420 static verification, ECS Dashboard rebuild/restart, and public app/admin shell smoke. |
| 2026-06-26 | Nested OpenClaw transcript recovery | Fixed the latest production `背调` timeout where OpenClaw produced a valid marker-wrapped Cellairis report but Dashboard missed it because `chat.history` returned raw nested `message.role/message.content`; deployed the transcript parser fix and recovered the Cellairis report through the normal completion API/store path. |
| 2026-06-26 | Long transcript repair-result recovery | Fixed the Adorama production `背调` repair-timeout path where the valid repair marker payload was beyond the 300KB transcript read cap; added Gateway-safe 500KB transcript reads, embedded fenced-JSON parsing, final full-transcript reread before repair timeout, deployed the fix to ECS, and recovered the Adorama report through the Dashboard completion route/store path. |
| 2026-06-26 | OpenClaw chat.history cap compatibility and USB-C Lead recovery | Fixed the transient 2MB `chat.history.maxChars` setting that exceeded OpenClaw Gateway's 500,000-char validator, restored the hidden runner to `500_000`, deployed/rebuilt/restarted ECS Dashboard, and recovered the existing `USB-C charger / US` Lead run with 3 saved customers and 12 sources. |
| 2026-06-26 | Dynamic Lead/Screening task time budgeting | Replaced fixed task wait windows with work-size estimates: Lead scales by query breadth/target count, Screening scales by 3-concurrent fan-out waves at ~3 minutes per child, task records persist timing metadata, and queued coordinator records add estimated queue delay. |

## Current Phase 2 Ground Truth

- Phase 2 is the current active CBE implementation lane. New CBE production/database/customer-admin/concurrency/store/UI-persistence work should log here, not in `phase-1.md`.
- Dashboard code and the Alibaba ECS target now use production-facing CBE routes: Employee entry `/employee`, Employee login `/employee/login`, Admin entry `/admin`, Admin login `/admin/login`, Employee APIs `/api/employee/*`, Admin APIs `/api/admin/*`, and role session API `/api/session`. Old `/client-demos/cross-border/{employee,admin}` page URLs redirect to the canonical paths, and canonical routes rewrite to the existing implementation files during the transition. Route helpers also recognize the internal rewrite destination paths so SSR renders Admin pages with the manager shell even when Next resolves `/admin/login` through `/client-demos/cross-border/admin/login`.
- The Alibaba Cloud target setup baseline is complete as of 2026-06-26: OpenClaw Gateway runs loopback-only as root's systemd user service on `127.0.0.1:18789`, Sentura Dashboard runs on `127.0.0.1:3000`, Nginx proxies `app.sentura.ai`, `admin.sentura.ai`, and `/gateway`, Alibaba RDS PostgreSQL database `sentura` has migrations `001`-`008` plus seeded CBE admin/operator profiles, and public HTTPS/WSS reachability is verified through Alibaba ALB. Current target checks include live RDS store 244/244, public canonical app/admin redirects and pages, expected unauthenticated 401s from canonical APIs, public WSS Gateway, built Docker sandbox image `openclaw-sandbox:bookworm-slim`, sandboxed `cbe-lead-discovery` startup, Google Places Lead tool HTTP 200, recovered production CPR Screening report `RPT-20260625-CPR-001` saved from an existing fenced-JSON transcript, recovered production Cellairis Screening report `SR-20260625-CELLAIRIS-001` saved after nested OpenClaw transcript parsing, recovered production Adorama Screening report `cbe_sr_20260626_adorama_001` saved after long-transcript repair-result recovery, recovered production `USB-C charger / US` Lead run with NEM Electronics Corp / Entro Wholesale / Mighty Wireless and 12 sources after OpenClaw `chat.history.maxChars` cap correction, and hidden-task structured-output repair plus nested/long transcript recovery deployed to ECS with CBE static 424/424 plus Dashboard typecheck/build pass. CE33 local code now recalibrates Lead/Screening task time budgets dynamically and records timing metadata, but that timing change has not yet been deployed to ECS. This is deployment/connectivity evidence, not a full `production_go_live_ready` label until target load-smoke, target restore drill, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS are recorded.
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
- Screening user batches now split into parent tasks plus single-target child runs by default. As of 2026-06-24, P2.5 creates a parent `agent_runs` row plus `screening_batches`, one child `agent_runs` / `screening_batch_targets` row per target, and a route-triggered drain that claims queued children with row locks, leases, admission checks, and parent aggregate refresh. Multi-target single-session Screening runs remain blocked unless the explicit batch-3 feature flag is enabled.
- P2.6 DB-only load-smoke tooling is implemented as of 2026-06-24. `scripts/test-cross-border-phase2-load-smoke.ts` validates 50 temporary operators/sessions, 10 Lead `find-10` requests with exact/near duplicate scopes, 5 Screening batches split into 25 single-target children, retry/drain after one child failure, 3 Accio imports, 24 soft-cap queueing, DB-only 32-active hard guard, and p95/cost/audit report metadata. `scripts/cross-border-phase2-backup-restore-drill.sh` and `跨境电商/P2.6-LOAD-SMOKE-RUNBOOK.md` cover the backup/restore drill and readiness labels. Current broad CBE static regression is 415/415. Local preflight is `db_only_preflight_passed`; full target-deployment go-live remains conditional on target smoke, target restore drill, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS behavior.
- Accio `记忆整理` manual intake now supports JSON files, pasted chat text, and multiple screenshot images in one analysis. Screenshot images are passed to OpenClaw through Gateway `chat.send` attachments for immediate hidden preflight transcription and are split into bounded numbered batches when needed, but raw image bytes are not persisted in the CBE business database; image-sourced records cannot be replayed from DB without re-uploading screenshots. Accio import rows carry `source_kind`, `input_format`, and `attachment_metadata_json` via `008_accio_manual_import_formats.sql`. Employee memory projections must prefer analyzed `customer_profile_json` over placeholder import company names and must expose structured `customer_profile`, `purchase_intent`, `negotiated_price`, `behavior_signals`, and `next_actions` facts to the UI report instead of only one generic summary string. As of 2026-06-25, `记忆整理` is a separate preview-only board: it must not write long-term memory, create/update customer rows, route supplement chats from `获客与背调`, or send records to Screening. Current broad CBE static regression is 415/415, current Accio manual-format store regression is 218/218, and current live PostgreSQL store regression is 244/244.
- Historical 2026-06-24 Accio approval-to-memory and Accio-to-Screening handoff entries are audit context only. CE25 supersedes them for current product behavior.
- Local CBE databases created before the `agent-memory` merge must run `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed` before opening Employee `记忆整理`; otherwise Dashboard routes that query `accio_imports ai.source_kind` will fail until `008_accio_manual_import_formats.sql` is applied.
- Screening paid email and paid trade checks are capped once per target and require explicit re-approval before retry repeats a paid lookup. The durable per-target paid retry state is implemented under CE22/P2.5.
- Current Screening country routing: GB Companies House and US SEC/RDAP/email/trade paths are current MCP-backed routes; France/Japan/Korea/Brazil/Italy are adapter backlog items with documented registration steps; Germany/Spain/Mexico stay official-page/manual routes unless a signed provider adapter is added.
- Google Maps Places + OpenClaw web search is implemented as the primary Lead Discovery acquisition route. `cross-border-intel` now exposes read-only `cbe_intel_google_places_search`, `cbe_intel_google_place_details`, `cbe_intel_google_geocode`, and `cbe_intel_google_address_validate`; setup scripts pass `GOOGLE_MAPS_API_KEY` and conservative request caps from env into the MCP server.
- Lead Discovery is Maps-first: Text Search/Nearby Search create storefront/local buyer seeds, Place Details is reserved for shortlists, web search/fetch verifies company-owned site and mobile-accessory buyer fit, and CBE DB reconciliation remains the source of truth for uniqueness/allocation.
- Screening uses Google Maps for public local-presence, address/website consistency, the dedicated address-footprint report section, and the implemented scale-aware first `公司注册与线下门店/地址` score block. Google Maps can satisfy that 25% authenticity block for small local/offline companies when an `OPERATIONAL` physical address is confirmed and no contradictory evidence exists. For listed/public and medium-large companies, Maps must be fused with registry/disclosure evidence and still is not formal KYB, legal ownership, trade, financial, fraud, or Accio behavior proof. `GOOGLE_MAPS_API_KEY` must stay server-side/secret-only; Google API calls require field masks, request caps, source attribution, redacted source URLs, and `api_call_ledger` metadata.
- Screening address-footprint is implemented: every company investigation should attempt a bounded Google Maps address discovery pass and render a visually distinct `Google Maps 地址版图` / `address_footprint` section that lists discovered offices, stores, warehouses/distribution sites, service/repair locations, validation verdicts, match confidence, and coverage limitations. Implementation covers the hidden Employee prompt, Screening workspace skills, `cross-border-intel` `screening_address_footprint` Details field mask, Dashboard marker/schema normalization, dedicated `screening_address_locations` row storage, DB completion metadata, shared report UI, and legacy Screening page rendering.
- Dashboard hidden Lead/Screening/Accio/image tasks now use longer Maps-plus-web estimates, propagate long `timeoutMs` through the Gateway client, treat frontend `chat.send` timeout as recoverable when transcript polling can still find markers, and run a final 60s transcript grace window before reporting marker timeout. Structured-output parsing is marker-first, then whole-response JSON/code-fenced JSON fallback with expected top-level array guards (`leads`, `reports`, `summaries`, image `images`), then one no-tools/no-reinvestigation repair turn for malformed or completed non-marker replies. Transcript reads are timestamp-scoped so old preflight/final/repair messages do not satisfy later turns. Setup now reads both project `.env` and `~/.openclaw/.env` before writing `cross-border-intel` MCP env references.
- The `寻找客户` sheet now snapshots the current target-count input ref at submit time and echoes `目标 N 个客户` in the drawer summary/button. A 2026-06-21 live audit found the Google-backed run succeeded but the backend prompt and `lead_runs.target_count` were already 3, so the 3-result outcome was not caused by Google/API failure or post-run dedupe.

## 2026-06-24 — Agent-memory branch merge and Accio manual import formats

### Context

The user asked to pull the teammate's `agent-memory` branch locally, merge it into the `ecommerce` customer branch, resolve conflicts, and integrate the memory-agent work with the existing CBE Phase 2 design.

### Merge Resolution

- Fetched `origin/agent-memory` and merged local `agent-memory` into `ecommerce`.
- The branch conflicted with current Phase 2 production-hardening files. Resolution kept the existing `ecommerce` P2.5/P2.6 boundaries first, then manually integrated the useful Accio memory import improvements.
- The branch's import-format migration was renamed from the conflicting `007_accio_manual_import_formats.sql` concept to `008_accio_manual_import_formats.sql`, preserving the existing `007_screening_retry_memory_approval.sql` paid retry / memory approval migration.

### Implementation

- Added `memory-import-normalizer.ts` for Employee `记忆整理` JSON, pasted text, and screenshot import preparation.
- Extended the Dashboard Gateway client/types so hidden task calls can pass OpenClaw-compatible image attachments through `chat.send`.
- Extended the hidden Accio runner with screenshot preflight transcription batches. The final Accio prompt receives transcript context plus attachment metadata and asks for Chinese operator-ready deal summaries, product context, price context, follow-up fields, and explicit unit-price versus total-price distinction.
- Updated Employee `记忆整理` to expose JSON/text/image import modes. JSON/text imports can be imported-only or analyzed; screenshots require immediate analysis because raw image bytes are intentionally not stored.
- Extended Accio store schemas and persistence with `source_kind`, `input_format`, and `attachment_metadata_json`. Imports, memory records, analysis payloads, activity/audit metadata, and API projections carry those fields.
- Added output samples under `outputs/memory-agent-samples/` for the teammate's complete Accio case fixtures.
- Expanded static regression coverage in `scripts/test-cross-border-phase2-store.ts` and `scripts/test-cross-border-agents.ts` for manual import formats, image attachments, no raw-image DB replay, screenshot preflight, and Chinese operator summary prompts.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 416/416.
- `git diff --check`: PASS.

### Boundary

- This merge does not change CBE role boundaries, workload caps, P2.6 go-live labels, or the OpenClaw runtime model.
- Screenshot raw images are transient task inputs only. Re-analysis of screenshot-sourced imports requires a fresh upload.

## 2026-06-25 — Accio import migration application fix

### Context

After the `agent-memory` merge, the user reported a runtime database error: `column ai.source_kind does not exist`. The query was valid for the merged code, but the local CBE database had not yet applied `008_accio_manual_import_formats.sql`.

### Action

- Loaded `CBE_DATABASE_URL` from `sentura/dashboard/.env.local`.
- Ran `pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`.
- Migration result applied only `008_accio_manual_import_formats.sql`; migrations `001` through `007` were already skipped as applied.
- Confirmed `accio_imports` now has:
  - `source_kind text`
  - `input_format text`
  - `attachment_metadata_json jsonb`

### Verification

- Live column query against `information_schema.columns`: PASS.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 243/243.

### Boundary

- No application-code change was needed for this fix.
- `sentura/dashboard/next-env.d.ts` was already dirty from Next type generation and was not touched.

## 2026-06-25 — Accio memory report projection fix

### Context

The user reviewed the teammate sample output in the Employee `记忆整理` report dialog and pointed out that the report appeared to have no useful information. The sample itself contained useful deal facts, so this session checked whether the issue was extraction failure, sample quality, or branch design.

### Diagnosis

- The latest local Accio row for operator `吴思彤` had useful structured data in the database:
  - `customer_profile_json`: Rossi Telecom SRL, Marco Rossi, Italy, Milan address, website, email, VAT, buyer role.
  - `purchase_intent_json`: S25 Ultra magnetic rugged case, 500/1000 pcs quantities, sample-first process, DDP Milan / EXW context, payment terms.
  - `negotiated_price_json`: sample cost, unit-price and total-price details including final DDP Milan total USD 1,925.
  - `next_actions_json`: sample feedback, final quote, PI/deposit, logo/EAN/warranty follow-up.
- The poor report was therefore not caused by an empty sample or complete Agent extraction failure.
- The bug was in the merged projection/UI design:
  - `listEmployeeMemoryRecords()` preferred the manual import placeholder `accio_conversations.company_name` (`待确认客户`) over the analyzed customer profile company.
  - `buildMemorySummary()` preferred the generic English `behavior_signals.summary` before synthesizing structured deal facts.
  - The Employee API/UI only carried a single `summary` string, so the report dialog repeated the generic sentence and did not render structured customer, purchase, price, or next-action fields.

### Implementation

- Updated `sentura/dashboard/src/lib/cross-border-store/accio.ts` so `EmployeeMemoryRecord` includes `customerProfile`, `purchaseIntent`, `negotiatedPrices`, and `behaviorSignals`.
- Changed memory summary construction to synthesize useful deal facts from product, quantity, target/best prices, terms, and next action before falling back to behavior summaries.
- Changed the memory record query to prefer analyzed `asum.customer_profile_json->>'company_name'` and `country` over placeholder import conversation values.
- Passed the new structured fields through `employee-api.ts` and `employee-data.ts`.
- Updated `MemoryReportDialog` in `employee/memory/page.tsx` to render:
  - `客户画像`
  - `采购需求`
  - `价格与条款`
  - `下一步`
- Added regression checks so the store projection exposes structured deal facts, prefers analyzed company names, and the Employee report dialog contains the structured report sections.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 417/417.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 218/218.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 245/245.
- API smoke against local Dashboard returned `name: "Rossi Telecom SRL"` plus structured `customerProfile`, `purchaseIntent`, `negotiatedPrices`, `behaviorSignals`, and `nextActions`.
- Browser smoke on `http://localhost:3000/client-demos/cross-border/employee/memory` under operator `吴思彤` showed the sample record as Rossi Telecom SRL, and the report modal rendered the structured sections with Rossi/Marco, S25 Ultra magnetic rugged case, 500/1000 pcs, DDP Milan/payment context, US$1,925 in next actions, and follow-up tasks.

### Boundary

- This is a projection/UI repair, not a change to Accio raw image persistence or the no-raw-chat memory boundary.
- The hidden Accio extraction prompt can still be improved later, but this sample already had enough useful data; the immediate failure was that the UI did not surface it.

## 2026-06-25 — Accio multi-screenshot upload explicit support

### Context

The user clarified that screenshot analysis should support uploading multiple screenshots for one Accio memory analysis.

### Action

- Confirmed the implementation already accepts `FileList | File[]` in `normalizeImageMemoryImport()`, iterates every selected image, produces one attachment metadata row per image, and names multi-image records as `聊天截图 N 张`.
- Confirmed the Employee file input already uses `multiple`, keeps `imageAttachments[]`, and sends all attachments through `toGatewayChatAttachments()`.
- Confirmed the hidden Accio runner already groups multiple image attachments through `imageAttachmentBatches()` and submits numbered preflight transcription batches before the final summary prompt.
- Made the Employee upload copy explicit: `上传聊天截图图片（可多选）`, multi-image description, and safety notice now all mention multi-image support.
- Added static regression `employee memory screenshot import supports multiple screenshots` spanning the normalizer, UI, and runner batching.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 418/418.

### Boundary

- Multi-screenshot support does not change the raw-image retention boundary. Images are still transient task inputs only; the DB stores hashes/metadata and structured results, not raw image bytes.

## 2026-06-25 — Memory agent separation from Lead/Screening boards

### Context

The user clarified that the memory Agent / `记忆整理` board must be separated from `获客与背调`: it should not provide backcheck, write, or cross-board handoff options, and the two boards should not interoperate.

### Implementation

- Updated Employee `记忆整理` so import/analyze flows produce structured analysis previews only. Removed `批准写入`, `发送到背调`, write-status display, supplement-target state, and Screening route actions from the report dialog and import sheet.
- Updated Employee `获客与背调` so selected customers run Lead/Screening only. Removed `补充聊天记录` / memory refresh routing, Accio handoff source labels, and runnable target filtering that depended on memory records.
- Updated the standalone `/client-demos/cross-border/accio-memory` page so it shows analysis preview/copy behavior only and no longer exposes Screening handoff copy/send semantics.
- Updated typed store/API boundaries:
  - Accio import rejects stale `supplement_target` payloads with `accio_interop_disabled`.
  - Accio summary completion persists summaries but returns empty `memoryFactIds` and `handoffIds`.
  - Accio summaries no longer create `memory_facts` or `handoff_events`.
  - Accio rows no longer project into the Employee customer list.
  - Handoff creation rejects Accio-to-Screening requests with `accio_handoff_disabled`.
  - Screening schemas and completion paths no longer accept `accio_memory` source or consume Accio handoff events.
  - The memory-facts route now returns `memory_fact_review_disabled` for write/review attempts.
- Updated `cbe-accio-memory` workspace files and skills to describe preview-only Accio/chat analysis. Removed `skills/handoff-to-screening/SKILL.md`.
- Updated static/live regression coverage in `scripts/test-cross-border-agents.ts` and `scripts/test-cross-border-phase2-store.ts`.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 415/415.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 218/218.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 244/244.

### Boundary

- This session intentionally supersedes the 2026-06-24 local-preflight Accio approval-to-memory and Accio-to-Screening handoff behavior. Those entries remain in memory and tests as historical audit records only.
- Existing `memory_facts` and `handoff_events` schema objects remain for broader platform/history compatibility, but current Accio `记忆整理` does not write to them.

## 2026-06-24 — Phase 2 Screening parent/child fan-out and queue drain

### Context

The user asked to start the next Phase 2 task from `跨境电商/PHASE-2.md` P2.5 and follow the plan strictly. The planned next slice was Screening parent task plus single-target child-run fan-out, then queue draining/claim behavior around queued `agent_runs`.

### Implementation

- Extended the Screening create request schema to accept `targets` and planned `child_session_keys`, and added a drain request schema with optional `screening_batch_id` plus bounded `limit`.
- Implemented `createScreeningBatchRun` in the Dashboard CBE store. Multi-target Screening requests now create one parent `agent_runs` row, one `screening_batches` row, one pre-created `screening_targets` row per target, one child `agent_runs` row per target, and one `screening_batch_targets` row per child.
- Child runs carry exactly one target in `child_target_json`; production batch-5/batch-10 prompts remain blocked, and the old batch-3 single-session path remains gated by `CBE_SCREENING_ALLOW_BATCH3=true`.
- Child admission uses the existing workload coordinator inside the create transaction. Children over the active cap stay `queued` with planned session keys and `notification_silent` metadata.
- Added `POST /api/client-demos/cross-border/employee/screening-runs/drain`, which claims queued child runs with `FOR UPDATE SKIP LOCKED`, lease fields, admission checks, running session keys, activity events, and parent aggregate refresh.
- Updated Employee bulk Screening execution so the UI creates one parent task, runs only claimed non-queued child rows, sends exactly one target per hidden child session, records child completion/failure/cancellation, and drains additional queued work after each wave.
- Updated task listing/failure/cancellation handling so ordinary Employee views hide silent child notifications, while child completion/failure/cancellation updates `screening_batch_targets` and the parent aggregate counts.
- Fixed the live-test-discovered aggregate bug where `refreshScreeningBatchAggregate(... childAgentRunId)` counted only the matching child row. It now resolves the batch first and then counts every target in that batch, preventing premature parent completion.
- Fixed the Employee task completion message to count backend-saved Screening reports from `completeEmployeeScreeningRun().reports.length`; the hidden runner's local `records.length` remains only a fallback.
- Added static and live PostgreSQL coverage to `scripts/test-cross-border-phase2-concurrency.ts` for a three-target Screening batch under an active-target cap of 1, parent-not-prematurely-completed behavior, and saved-report completion count sourcing.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 196/196.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 218/218.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 46/46. The live probe verifies parent/child rows, queued excess children, child failure, parent remains running after one terminal child, queued child drain, aggregate counts, and saved-report completion count sourcing.
- Live OpenClaw/Dashboard validation with operator `吴思彤`: PASS. Started `pnpm gateway:watch:raw` in `openclaw/`, started `pnpm dev` in `sentura/dashboard`, logged into `/client-demos/cross-border/employee/customers`, ran two real 3-target bulk Screening batches, monitored Gateway/Dashboard logs, and queried the DB. The second run ended with parent aggregate `total=3/completed=3/terminal=3`, three completed child runs, and one saved Screening report per child.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: FAIL, 398/410. Failures are stale legacy static/UI-copy assertions outside this P2.5 fan-out path: removed ordinary CBE sidebar demo links, older terminal/status strings, older cost/detail locations, older label expectations, evidence-gap wording, and historical budget-copy assumptions.

### Remaining Boundary

P2.5 still needs per-target paid email/trade retry state with explicit re-approval, durable Screening report/evidence retry UX, Accio approval-to-memory promotion, and durable Screening handoff consumption. P2.6 load smoke should start after those paths are stable.

## 2026-06-23 — Phase 2 scale-aware Google Maps Screening scoring implementation

### Context

After reviewing the docs-first design, the user asked to strictly implement the Google Maps scoring redesign. The key product requirement was that real small retailers, repair stores, and local distributors should not be scored down only because company registry APIs fail to find them.

### Implementation

- Added `company_scale_assessment` to the MCP `ContextualScoreResult` and `score_buyer` input path so reports can carry scale class, confidence, rationale, and first-block strategy.
- Updated the hidden Employee Screening prompt and legacy `/screening` workbench prompt to require `company_scale_assessment`, display the first block as `公司注册与线下门店/地址`, keep `legal_identity` as the backward-compatible JSON block id, and apply the scale-aware Maps/registry scoring rule.
- Updated `cbe-buyer-screening` `AGENTS.md`, `BOOTSTRAP.md`, `TOOLS.md`, `evidence-collection`, `buyer-scoring`, and `report-writing` so the live agent treats Google Maps address-footprint evidence as first-block authenticity support only under the small-local/offline rule, never as formal KYB/legal ownership proof.
- Extended Dashboard marker/store schemas and normalization so completed Screening reports preserve `company_scale_assessment` in `screening_reports.report_json`.
- Updated shared Employee/Manager report UI and the legacy Screening page to show a distinct company-scale panel and relabel score/evidence blocks from pure `公司注册` to `公司注册与线下门店/地址`.
- Updated the legacy diagnostic Screening API route to infer conservative scale assessment from available registry/site context without fabricating Maps-only evidence when the route did not execute a Maps address-footprint pass.
- Added regression checks for the scale-aware first-block rule, report JSON persistence/display, MCP scoring context propagation, and live workspace sync.
- Synced the source Screening workspace behavior files into `~/.openclaw/workspace/cbe-buyer-screening/`.

### Verification

- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 24/24.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 409/409.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 195/195.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 217/217 static + live PostgreSQL checks.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- Minimal real Google Places API (New) smoke with configured `GOOGLE_MAPS_API_KEY`: PASS, HTTP 200, one candidate, place id present, Maps URI present, `business_status="OPERATIONAL"`; no key or full provider response printed.
- Live workspace diff: `AGENTS.md`, `BOOTSTRAP.md`, `TOOLS.md`, `evidence-collection`, `buyer-scoring`, and `report-writing` match source; no `RULES.md` / `CONTEXT.md`.
- `git diff --check`: PASS before final documentation updates.

### Boundary

This completes the Google Maps scoring fusion requested in this round. Remaining Phase 2 work is still P2.5 queue draining/claim behavior, Screening parent/child fan-out, paid-call retry state, durable Screening/Accio workflow polish, and later P2.6 load smoke.

## 2026-06-23 — Phase 2 scale-aware Google Maps Screening scoring design

### Context

The user said Google Maps should be much more important in 背调. Registry APIs often cover listed or larger companies but miss real small retailers, repair shops, and local distributors. The requested design changes the first company-registration/authenticity block so small local/offline companies are not scored low only because a registry API cannot match them.

### Design

- Added company scale assessment before Screening scoring: `listed_or_public`, `medium_large_registered`, `small_local_offline`, `small_online_only`, and `unknown_scale`.
- Reframed the first 25% block as `公司注册与线下门店/地址`; the implementation can keep JSON block id `legal_identity` for compatibility.
- For listed/public and medium-large companies, official registry/disclosure evidence remains primary and Google Maps address/local-presence evidence is fused as support.
- For small local/offline companies, Google Maps can satisfy the first block when a confirmed/probable place is `OPERATIONAL`, has a physical address, plausible name/category/location match, and no contradictory official-site/registry/web evidence.
- Report wording must distinguish practical offline-existence evidence from formal KYB/legal registration proof.
- Regression requirements now include small-shop no-registry-but-operational-Maps, listed/public Maps-without-registry, closed-location caution, and online-only small-business no-Maps-neutral cases.

### Files updated

- `跨境电商/SCREENING.md`
- `跨境电商/PHASE-2.md`
- `跨境电商/DESIGN.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `outputs/resume_card.md`
- `outputs/task_handoff.md`

### Boundary

This session is documentation/design only. Runtime-facing Screening skills, deterministic scoring logic, marker/report schemas, report UI labels, and regression scripts still need to be changed in the implementation pass.

## 2026-06-22 — Phase 2 Google Maps integration final audit

### Scope

The user asked to verify that all Google Maps API updates and integrations are complete and that related documentation is updated. This was an audit-only pass; no business-code changes were needed.

### Findings

- Google Maps MCP support is present in `cross-border-intel` for Places search, Place Details, Geocoding, and Address Validation, with conservative field-mask profiles, request caps, source attribution, and key redaction.
- Lead Discovery is Maps-first plus web-search/web-fetch verification; Dashboard timeout recovery and target-count submission fixes are documented and implemented.
- Screening uses Maps for public local presence, address consistency, and the mandatory `address_footprint`/`Google Maps 地址版图` section, while keeping Maps evidence out of legal/KYB/trade/financial/Accio proof lanes.
- `screening_address_locations` exists as the normalized company-address table linked to reports, targets, optional Lead candidates, optional runs, tenant/user/team scope, and Google place identity; `report_json.address_footprint` remains the full report snapshot.
- Documentation is synchronized across `跨境电商/API_KEYS_OPENCLAW_SETUP.md`, `MARKET_ACQUISITION.md`, `SCREENING.md`, `PHASE-2.md`, `DESIGN.md`, `sentura/mcp-servers/cross-border-intel/README.md`, agent workspace files, Dashboard behavior, tests, memory, and handoff docs.
- Historical rows that say "implementation pending" are append-only audit records from the docs-first design step and are superseded by later implementation, address-table, and final-audit rows.

### Verification

- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 23/23.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 406/406.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 194/194 static checks.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL CBE_REQUIRE_DB=1 pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216 static + live PostgreSQL checks, including `screening_address_locations` write/read through the typed store.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `bash -n scripts/sentura-setup.sh`: PASS.
- Minimal live Google Maps API smoke with the configured `GOOGLE_MAPS_API_KEY`: PASS for Places API (New) Text Search, Geocoding API, and Address Validation API; output redacted and did not print the key.
- `git diff --check`: PASS before this memory update.

### Boundary

This audit clears the Google Maps integration itself. Remaining CBE Phase 2 work such as queue draining/claim behavior, Screening parent/child fan-out, and durable Screening/Accio workflow polish remains P2.5 scope, not an unfinished Google Maps API integration gap.

## 2026-06-22 — Phase 2 Screening dedicated address table

### Context

The user asked for a dedicated table that collects every address related to a investigated company, so the Google Maps address-footprint section can be managed and retrieved later without traversing full report JSON.

### Implementation

- Added migration `sentura/lib/cross-border-store/migrations/006_screening_address_locations.sql`.
- Created `screening_address_locations` with tenant scope and links to `screening_reports`, `screening_targets`, optional `lead_candidates`, optional `agent_runs`, owner/team/visibility fields, company/domain identity, Google place id, display name, formatted address, address type, relationship status, city/region/country, business status, Google types, website URI, domain/phone match verdicts, Address Validation JSON, Maps URI, confidence, match reasons, source type, and fetched timestamp.
- Added report/target indexes plus place/country-city/domain lookup indexes for later address management and Admin/Employee retrieval.
- The migration backfills any existing `screening_reports.report_json.address_footprint.locations[]` rows into the dedicated table.
- Wired `saveScreeningReports` so every new `address_footprint.locations[]` row is inserted into `screening_address_locations` in the same transaction as the report, evidence, score blocks, activity, and audit metadata.
- Added typed `listScreeningAddressLocations` retrieval with tenant/user scope and filters for report, target, Lead candidate, run, company, domain, Google place id, country, city, relationship status, and address type.
- Added cleanup integration in Accio/customer deletion paths and the Phase 2 live probe cleanup so address rows do not block report/target cleanup.
- Updated Phase 2 docs/tests so `report_json` remains the full immutable report snapshot while `screening_address_locations` is the queryable company-address management table.

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 194/194 static checks.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216 static + live PostgreSQL checks, including true `saveScreeningReports` write/read of `screening_address_locations` and typed `listScreeningAddressLocations` retrieval.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS; applied `006_screening_address_locations.sql` to the local CBE dev database.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 406/406.

### Boundary

The local table row count is currently 0 after the live probe cleanup because the historical KIKO report predates `address_footprint`; the next real 背调 report with Google Maps address-footprint locations will persist rows into `screening_address_locations`.

## 2026-06-22 — Phase 2 Screening Google Maps address-footprint implementation

### Context

After reviewing the docs-only design, the user asked to strictly implement it. The implementation needed to make the 背调 Agent actively request Google Maps address-footprint evidence and show it as a dedicated report section, not just document the intended workflow.

### Implementation

- Updated the hidden Employee Screening prompt and the legacy `/screening` workbench prompt to require `address_footprint` for every target, build up to six Google Places Text Search variants, call Place Details with `field_mask_profile="screening_address_footprint"`, run Address Validation for complete addresses, classify relationship/address type, and keep Maps evidence out of legal/KYB/trade/financial scoring lanes.
- Added the shared `CustomerAddressFootprint` model, parser normalization, source URL propagation, and DB completion payload conversion so both snake_case agent markers and camelCase UI state are supported.
- Added `ScreeningAddressFootprintSchema` to the CBE store schema and included saved address-footprint location counts in completion/activity/audit metadata.
- Added the `screening_address_footprint` Place Details profile in `cross-border-intel` with bounded id/name/address/website/phone/business-status/type/opening-hours/Maps URI fields, plus mocked MCP test coverage.
- Rendered a visually distinct `Google Maps 地址版图` panel in the shared `CustomerReportDialog`, with coverage status, summary counts, limitations/open questions, grouped confirmed/probable/review locations, validation verdicts, match reasons, and Maps links. The legacy Screening page renders a compact equivalent section.
- Updated `cbe-buyer-screening` `TOOLS.md` and skills so the live agent treats address-footprint discovery as mandatory when Maps is available while preserving the non-KYB boundary.

### Verification Notes

- Static CBE regression now includes checks for the address-footprint workspace guidance, prompt marker, store schema, completion normalization, and report renderer.
- MCP mocked tests cover the new Place Details field-mask profile.
- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 23/23.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 406/406.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 184/184.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `bash -n scripts/sentura-setup.sh`: PASS.
- `git diff --check`: PASS after docs/handoff updates.
- Live `~/.openclaw/workspace/cbe-buyer-screening` sync check: `TOOLS.md`, `evidence-collection`, `report-writing`, and `buyer-scoring` match source; top-level markdown files remain exactly the 8 OpenClaw-native files; no `RULES.md` / `CONTEXT.md`.
- Browser smoke: started Dashboard dev server, logged into Manager as `孙总/1234`, opened 吴思彤's employee detail, and opened the KIKO shared report dialog with no browser console errors. The historical KIKO report predates this implementation and therefore did not contain `address_footprint`; the next live Screening run should verify populated `Google Maps 地址版图` rows.

### Boundary

This implementation does not yet perform a new live Dashboard Screening run after the code change. The next real 背调 task should be inspected to confirm Google Places/Details/Address Validation calls now populate `address_footprint` in persisted reports.

## 2026-06-22 — Phase 2 Screening Google Maps address-footprint report design

### Context

The user requested a documentation-first change before implementation: the 背调 Agent should call Google Maps API during company investigations to find all company-related public addresses, including stores, offices, warehouses/distribution sites, and service locations, then show those addresses in a dedicated report section that is clearly separate from normal evidence blocks.

### Design Written

- `跨境电商/SCREENING.md` now owns the detailed workflow. Screening builds query variants from legal/brand names, country/city/region, website/domain, phone when available, and official-site location/address pages discovered via web search/fetch.
- The planned workflow runs bounded `cbe_intel_google_places_search` Text Search variants, deduplicates candidates by Google place id, normalized address, phone, website domain, and display name, then calls `cbe_intel_google_place_details` for shortlisted unique places under the address-footprint cap.
- Unique complete-enough formatted addresses should call `cbe_intel_google_address_validate` under a separate validation cap.
- Each place is classified as `confirmed_company_location`, `probable_company_location`, `possible_related_location`, or `rejected_unrelated_location`, and the address role is classified as office/headquarters, storefront, warehouse/distribution, service/repair, or unknown business location.
- The Screening report schema now includes `address_footprint` with `coverage_status`, query scope/cap limitations, summary counts, normalized location rows, validation verdicts, Maps URIs, confidence, match reasons, and open questions.
- The report UI contract requires a standalone `Google Maps 地址版图` / `Google Maps Address Footprint` panel after the executive conclusion/score summary and before the generic evidence timeline. It should use a summary strip plus grouped address rows/cards so physical footprint is readable at a glance.
- Maps address footprint can support `public_footprint`, `domain_email`, and `business_fit` when there is domain/phone/category consistency, but it must not score `legal_identity` or replace registry/KYB/trade/financial/Accio evidence.

### Docs And Tests Updated

- `跨境电商/SCREENING.md`
- `跨境电商/PHASE-2.md`
- `跨境电商/DESIGN.md`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-phase2.md`

### Boundary

At this design-session boundary, no implementation had started for `address_footprint`. The later 2026-06-22 implementation session in this file supersedes that pending state while preserving the original review-first decision.

## 2026-06-22 — Phase 2 P2.4 completion audit

### Context

The user asked to inspect whether the entire P2.4 implementation is complete. The audit treated P2.4 as the CE21 delivery slice: global CBE workload admission/queue metadata, Lead Discovery scope coordination, Employee hidden-run gating, Lead pre-search/top-up denylist handling, completion-time DB reconciliation/failure release as already implemented after P2.4, and Screening/Accio workload admission boundaries.

### Result

P2.4 is complete. The implementation matches the current `跨境电商/PHASE-2.md` boundary and the CE21 test contract:

- `005_workload_queue_and_screening_batches.sql` adds queue/lease columns, queue/active-session indexes, and prepares `screening_batches` / `screening_batch_targets`.
- `workload-coordinator.ts` reads env-backed caps, uses a tenant-scoped PostgreSQL advisory transaction lock, counts only active OpenClaw sessions with non-null `session_key`, queues above configured caps, and blocks multi-target Screening sessions unless the explicit feature flag allows them.
- `agent-runs.ts` persists queue metadata and preserves queued rows without a runnable `session_key`.
- `lead-runs.ts` computes canonical scope hashes, joins exact active scopes, offers near-duplicate choices, starts fresh full-target runs for normal completed same-scope requests, supports explicit `top_up_unique_leads`, carries tenant DB denylist context, reconciles candidates before visible writes, and releases active scope leases on completion/failure.
- Employee `获客与背调` and `记忆整理` pages do not launch hidden OpenClaw sessions when the server returns queued/join/near decisions; executable Lead runs pass `existing_identity_keys` into the hidden prompt and auto top-up bounded missing counts.
- Screening and Accio create paths call workload admission. Screening fan-out tables and blocking are present, but full parent/child scheduler and queue draining are intentionally P2.5.

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21 static checks.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 38/38 static + live PostgreSQL checks.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 184/184.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 204/204.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 403/403.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm --dir sentura/dashboard build`: PASS; only the existing Next workspace-root warning about multiple lockfiles appeared.
- `git diff --check`: PASS before this documentation update.
- Targeted `RULES.md` / `CONTEXT.md` scan under the updated CBE agent source workspaces: PASS, no output.

### Boundary

Not P2.4 blockers:

- Queue draining/claim behavior that starts queued work outside the original browser request path remains P2.5.
- Screening parent task + single-target child-run fan-out remains P2.5.
- Durable Screening retry/report polish, paid-call retry state, Accio approval-to-memory promotion, and Screening handoff consumption remain P2.5.
- P2.6 load smoke is still later and should not be used to mark P2.4 incomplete.

## 2026-06-22 — Phase 2 live Google Maps Lead/Screening audit

### Context

The user reran two Lead Discovery tasks and one Screening task from the Dashboard and asked whether Google Maps API was actually called and whether the three task processes had completion or quality issues.

### Findings

- Lead session `17f94f97-3c0e-4f9a-9113-d3b61b50a140` completed successfully in about 98 seconds for `tempered glass screen protector / US`, target count 5. The final marker parsed cleanly and 5 candidates were saved: ZAGG Durham, Global Cellular Repair, Mr Repair USA, LGS Electronics, and Electronic World.
- Lead session `a1bd63d9-38c2-4a54-986b-7d8f9b7af987` completed successfully in about 134 seconds for `tempered glass screen protector / US`, target count 5. The final marker parsed cleanly and 5 candidates were saved: Mighty Wireless Wholesale Cellphone Accessories, KIKO Group USA (KIKO Wireless), NEM Electronics Corp, Fatboy Cellular Wholesale Cell Phone Accessories, and USA Cell Inc.
- Screening session `bcbf1824-def7-4085-bb8c-94fd5c649733` completed successfully in about 90 seconds for KIKO Group USA (KIKO Wireless). The report saved with 11 evidence items, 3 Google evidence items, 6 score blocks, evidence coverage 0.78, normalized score 78.41, and risk tier `cautious`.
- The three matching `agent_runs` rows are all `completed` with no error message; Lead rows are at `lead_results_saved`, and the Screening row is at `screening_reports_saved`.

### Google Maps status

- Lead #1 used 9 Google Places Search calls and 5 Place Details calls; all Google results returned HTTP 200 with `found` status.
- Lead #2 used 7 Google Places Search calls and 8 Place Details calls. Places Search calls returned HTTP 200 with `found` status; Place Details had 7 HTTP 200 `found` results and one recoverable HTTP 400 `api_error` for an intermediate candidate. The final run still saved 5 target candidates, so this was not a task-completion blocker.
- Screening used Google Places Search, Place Details, and Address Validation. All three Google calls succeeded: Places Search HTTP 200 `found`, Place Details HTTP 200 `found`, and Address Validation HTTP 200 `validated`.
- No Google API key leakage was found in the checked transcripts, database source snapshots, or normalized evidence.

### Completion and issues

- Lead completion is correct for the requested target counts: 10/10 candidates saved across the two runs, `duplicate_result_count = 0` for both runs, and each saved lead includes Google Maps evidence plus company/product web evidence.
- The KIKO Screening completion is correct: the report persisted, scoring blocks were generated, and Google evidence supported public local presence/address consistency without being treated as registry/KYB proof.
- Expected non-blocking coverage gaps remained: US registry API is not configured, SEC lookup did not find KIKO as a public filer, Hunter email lookup hit account/rate restriction, and Google Address Validation returned `address_complete=false` while still giving an `ACCEPT`-style next action.
- Minor future improvement: `lead_sources` still stores Google Maps URLs with `source_type = public_web` even though Google provenance is preserved in source URLs and discovery evidence. This does not affect task completion, but exact `google_maps_places` source-type preservation would make later report filtering cleaner.

## 2026-06-21 — Phase 2 Dashboard Lead target-count submit fix

### Context

After the timeout fix, the user reran `寻找客户` for `phone case / GB` and asked why requesting 5 customers returned only 3.

### Diagnosis

- Latest session `bce8c811-1f42-43b9-8969-1b138d482cfd` ended successfully, not timed out.
- The run called Google Maps successfully: 4 Places Text Search calls and 4 Place Details calls returned HTTP 200 `found`, plus web search/fetch evidence calls. No Google API key leaked in logs.
- The final marker contained exactly 3 leads: Adam's Phone Fix, Capital Connection, and Tech Haven.
- The prompt's task input and the DB row `lead_run_518ae7a0-bdad-44e2-85bd-aa0c3c464176` both had `target_count = 3`; `lead_candidates` saved 3 new unique rows and no duplicate skip compressed a 5-result output down to 3.

### Fix

- Updated the `寻找客户` drawer in `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx` so submit reads the current numeric input DOM ref at click time, normalizes it, rebuilds the Lead payload from that submitted selection, and updates state from the same value.
- Added visible target echo in the Lead drawer summary and submit button: `目标 N 个客户` / `提交获客任务（N 个）`.
- Added static regression checks for target input snapshot submit and visible target echo.

### Verification

- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 403/403.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.

## 2026-06-21 — Phase 2 Dashboard Lead timeout and Google env runtime fix

### Context

The user tested `寻找客户` from the Dashboard with `phone case / GB` and repeatedly saw `等待后台 AI 员工返回结构化结果超时。`

### Diagnosis

- The latest `cbe-lead-discovery` session under `~/.openclaw/agents/cbe-lead-discovery/sessions/` did produce a valid `LEAD_CANDIDATES_JSON_START/END` block with two leads, but only after about 5 minutes 9 seconds. The UI timeout window was too tight for the real Maps-plus-web route.
- The same transcript showed Google MCP calls returning `unavailable_api` because the live OpenClaw config did not yet pass `GOOGLE_MAPS_API_KEY` into `mcp.servers.cross-border-intel.env`. The employee fell back to web search, increasing latency and reducing Maps coverage.
- The failed Dashboard run did not leave a persisted `lead_discovery` `agent_runs` failure row in the local CBE database, so no DB repair was required.

### Fixes

- Updated `sentura/dashboard/src/lib/gateway/client.ts` so long `chat.send` RPC calls honor the caller-provided `timeoutMs` plus a local grace window instead of always using the short default WebSocket request timeout.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts` to:
  - increase Lead task estimates for Google Maps plus web verification;
  - treat Gateway send timeouts as recoverable when a session exists;
  - continue polling transcript markers after a send timeout;
  - add a final 60s transcript grace window before reporting structured-result timeout.
- Updated `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` so setup reads both the project `.env` and `~/.openclaw/.env`, then writes Google Maps key/cap references into the OpenClaw MCP config when configured.
- Reran `bash scripts/sentura-setup.sh`; a redacted config check confirmed `GOOGLE_MAPS_API_KEY` and `CBE_GOOGLE_MAPS_*` caps are configured in `~/.openclaw/openclaw.json`.

### Verification

- Real Google Places smoke through the MCP server: PASS, HTTP 200, `status="found"`, one candidate, `place_id`, and `google_maps_uri`; no raw key or full provider response printed.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 23/23.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `bash -n scripts/sentura-setup.sh`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 401/401.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 184/184.
- Live workspace 8-file checks for `cbe-lead-discovery` and `cbe-buyer-screening`: PASS, only the native top-level OpenClaw workspace files are present and no `RULES.md`/`CONTEXT.md` files were created.

## 2026-06-21 — Phase 2 Google Maps MCP integration for Lead/Screening

### Context

After reviewing the Google Maps source-redesign docs, the user configured Google Maps API permissions for Places API (New), Address Validation API, and Geocoding API in `.env` and `.openclaw/.env`, then asked to strictly integrate Google Maps API into the Lead Discovery and Screening employees.

### Implementation

- Implemented Google Maps configuration in `sentura/mcp-servers/cross-border-intel/src/config.ts`: `GOOGLE_MAPS_API_KEY`, optional endpoint overrides, and per-run caps for Places results, Place Details calls, and Address Validation calls.
- Added source/input schemas for `google_maps_places`, `google_maps_geocoding`, and `google_maps_address_validation`.
- Added four read-only MCP tools in `cross-border-intel`:
  - `cbe_intel_google_places_search` for Places API (New) Text Search and Nearby Search with narrow field-mask profile `lead_discovery_list`.
  - `cbe_intel_google_place_details` for shortlist enrichment/local-presence checks with `lead_discovery_basic` and `screening_local_presence` field masks.
  - `cbe_intel_google_geocode` for address/city-to-coordinate support with redacted source URLs.
  - `cbe_intel_google_address_validate` for public address consistency checks with bounded normalized verdict/address/geocode output.
- Normalized Google outputs with `source_type`, `source_url`, `fetched_at`, confidence, attribution metadata, and `api_call_ledger`; missing keys return `unavailable_api`, quota errors return `rate_limited`, and API keys are never emitted.
- Updated setup scripts so `GOOGLE_MAPS_API_KEY` and `CBE_GOOGLE_MAPS_*` caps are injected into the MCP server env when present.
- Reworked Lead Discovery workspace docs, config, tools, and skills to use Google Maps Places as the primary discovery source, followed by OpenClaw `web_search`/`web_fetch` verification; dedupe now prefers `google_place_id`, then domain/name/location.
- Reworked Screening workspace docs, config, tools, and skills to use Place Details and Address Validation as supporting local-presence/address-consistency evidence only, while retaining registry/domain/trade/financial/Accio boundaries.
- Synced the updated Lead Discovery and Screening behavior files into the live `~/.openclaw/workspace/cbe-lead-discovery` and `~/.openclaw/workspace/cbe-buyer-screening` workspaces, preserving exactly the 8 native top-level OpenClaw workspace markdown files and no `RULES.md`/`CONTEXT.md`.
- Updated Dashboard hidden prompts, source/evidence enums, source normalization, report layers, diagnostic env-status routes, and typed store schemas so Google Maps evidence and `google_place_id`/`google_maps_uri` provenance are preserved without exposing secrets.
- Updated CBE design/API/test docs from "planned" to implemented status.

### Verification

- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 23 mocked tests covering 14 tools, Google missing-key handling, Text/Nearby Search field masks, Place Details, Geocoding, Address Validation, quota errors, normalization, and key redaction.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 397/397 static CBE checks at the time of the initial integration; later timeout/runtime-env follow-up raised the same suite to 401/401.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 184/184 static store checks.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21 checks.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `bash -n scripts/sentura-setup.sh`: PASS.
- `git diff --check`: PASS before memory/handoff updates; rerun after final docs is expected.
- Targeted no-deprecated-file check across updated agent/MCP/test paths found no `RULES.md` or `CONTEXT.md` references.
- Live workspace top-level markdown file check passed for both CBE employees: only `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, and `MEMORY.md` are present.

### Boundary

No live Google API call was made during the initial integration verification. A later timeout/runtime-env follow-up on the same date ran a real Google Places smoke successfully after rerunning setup and confirming the OpenClaw MCP env references.

## 2026-06-21 — Phase 2 Google Maps + web-search source redesign docs

### Context

The user asked to add Google Maps API into the Lead Discovery and Screening employees: Google Maps should help find customers and support customer background checks, and Google Maps + web search should become the main acquisition route. The user explicitly requested documentation first for review before any implementation.

### Research summary

Official Google Maps Platform docs checked:

- Places API (New) Text Search: `https://developers.google.com/maps/documentation/places/web-service/text-search`
- Places API (New) Nearby Search: `https://developers.google.com/maps/documentation/places/web-service/nearby-search`
- Places API (New) Place Details: `https://developers.google.com/maps/documentation/places/web-service/place-details`
- Places API place data fields: `https://developers.google.com/maps/documentation/places/web-service/data-fields`
- Places API place types: `https://developers.google.com/maps/documentation/places/web-service/place-types`
- Places API usage/billing and policies: `https://developers.google.com/maps/documentation/places/web-service/usage-and-billing`, `https://developers.google.com/maps/documentation/places/web-service/policies`
- Google Maps Platform API key/security best practices: `https://developers.google.com/maps/api-security-best-practices`
- Google Business Profile APIs overview: `https://developers.google.com/my-business`

Key design conclusions:

- Use Places API (New), especially Text Search, optional Nearby Search, and Place Details. Do not use Business Profile API for third-party prospecting or backchecks because Business Profile APIs are for managing merchant-owned/administered locations.
- Maps is strong for local/storefront buyer seeds: phone repair shops, mobile shops, electronics stores, accessory stores, local wholesalers, and distributors.
- Place Details can provide website URI, phones, formatted address, business status, types, rating/user rating count, regular opening hours, and Google Maps URI when requested through narrow field masks.
- Reviews/photos are not default evidence because they add policy/caching/attribution burden and are not needed for Lead generation.
- Maps evidence is local-presence/public-footprint evidence only. It cannot replace registry, domain/email, trade, financial, or Accio behavior evidence.

### Documents updated

- `跨境电商/MARKET_ACQUISITION.md`: made Google Maps Places + OpenClaw web search the target main Lead route; added Text/Nearby/Details workflow, query families, field-mask profiles, output schema, DB/source metadata, tool-policy plan, source list, and safety defaults.
- `跨境电商/SCREENING.md`: added Google Maps/local-presence checks, evidence mapping, scoring boundaries, per-target Details cap, source list, and implementation backlog note.
- `跨境电商/DESIGN.md`: updated status, cross-agent architecture, execution flow, planned MCP tools, data classification, cost defaults, and milestone table.
- `跨境电商/PHASE-2.md`: added official Google docs to source alignment, added Phase 2 goal, updated P2.5 scope, added `8.0.1 Google Maps + Web Search Source Redesign`, added Screening API-scope row, risks, and immediate-next implementation sequence after user approval.
- `跨境电商/API_KEYS_OPENCLAW_SETUP.md`: added `GOOGLE_MAPS_API_KEY` acquisition, server-side restrictions, API restrictions, budget alerts, `.env` placement, and explicit "planned, not current capability" warning.
- `sentura/mcp-servers/cross-border-intel/README.md`: added planned `cbe_intel_google_places_search` and `cbe_intel_google_place_details` tool rows, env boundary, and not-current-capability warnings.
- `docs/TESTS.md` and `docs/tests/tests-cross-border-phase2.md`: added CE17.27 and expanded CE22 to include the Google Maps source redesign.

### Boundary

No code, setup script, workspace prompt, or live `~/.openclaw` behavior file was modified. Implementation should not start until the user reviews and approves this design.

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

## 2026-06-24 — Phase 2 P2.6 load-smoke tooling and readiness drill

### Context

The user asked to start the next stage from `跨境电商/PHASE-2.md` P2.6, follow the plan strictly, and inspect the implementation. The P2.6 scope is multi-user/load smoke against the calibrated 24/32/48 active-task envelope, backup/restore drill, and a production-readiness report. Remaining CE22/P2.5 paid retry and durable Screening/Accio polish were kept as explicit go-live blockers instead of being treated as complete.

### Implementation

- Added `scripts/test-cross-border-phase2-load-smoke.ts`.
- Static CE23 checks validate the P2.6 plan, workload-cap defaults, CE23 test docs, P2.6 runbook, and backup/restore drill contract.
- Live PostgreSQL checks run through the typed CBE store boundary and direct migration-safe SQL, but do not start real OpenClaw AgentChat sessions or external provider calls.
- The live smoke seeds and later cleans 50 temporary `operator` users/profiles under tenant `cross-border-ecommerce`, resolves 50 Dashboard session contexts, records p95 context/API latency, creates 10 Lead `find-10` requests with 3 exact duplicate scopes and 2 near-duplicate scopes, creates 5 Screening batches totaling 25 single-target child runs, verifies retry/drain after one child failure, creates 3 Accio imports, validates C=48 soft-cap queueing, validates a DB-only 32-active hard guard, writes cost/audit probe rows, and optionally writes a JSON report.
- Added `scripts/cross-border-phase2-backup-restore-drill.sh`, guarded by required `CBE_DATABASE_URL` and separate `CBE_RESTORE_DATABASE_URL`, refusing identical source/restore URLs and defaulting to restore/drill-looking disposable targets. It runs custom-format `pg_dump`, `pg_restore --clean --if-exists`, migration seed, and Phase 2 store checks against the restored DB.
- Added `跨境电商/P2.6-LOAD-SMOKE-RUNBOOK.md` with commands, expected results, backup/restore drill steps, result labels, and conditional go-live checklist.
- Updated `跨境电商/PHASE-2.md`, `docs/TESTS.md`, `docs/tests/tests-cross-border-phase2.md`, `README.md`, and `AGENTS.md` so CE23 and the runbook are discoverable.
- Generated `outputs/cbe-phase2-load-smoke-report.json` from the local live DB-only smoke. The report recorded 50 seeded users/simulated sessions, p95 latency 0.76 ms, 10 Lead requests / 5 active sessions after dedupe, 25 Screening child runs with 12 running and 13 queued initially, 3 Accio imports, soft-cap active count 24, hard guard queued, and `go_live_readiness = "conditional"`.

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`: PASS, 16/16 static checks, live skipped when `CBE_DATABASE_URL` is not in the shell.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts --require-db --report outputs/cbe-phase2-load-smoke-report.json`: PASS, 48/48 static + live PostgreSQL DB-only smoke checks.
- CE23 cleanup probe after the live smoke: PASS, `ce23_users=0`, `ce23_agent_runs=0`, `ce23_audits=0`.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 196/196 static checks.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 218/218 static + live PostgreSQL checks.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23 static checks.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 46/46 static + live PostgreSQL checks.
- `bash -n scripts/cross-border-phase2-backup-restore-drill.sh`: PASS.
- `git diff --check`: PASS.

### Boundary

P2.6 DB-only smoke tooling is implemented and verified. The guarded backup/restore drill entrypoint exists but was not run end-to-end because no disposable `CBE_RESTORE_DATABASE_URL` was provided in this session. Full target-deployment go-live remains conditional until CE22/P2.5 closes per-target paid email/trade retry state with explicit re-approval, durable Screening report/evidence retry UX, Accio approval-to-memory promotion, and durable Screening handoff consumption.

## 2026-06-24 — Phase 2 local production preflight completion

### Context

The user asked to complete all remaining work and tests needed before delivering the Cross-border e-commerce / 跨境电商 customer pilot to production. This session closed the remaining local P2.5/P2.6 blockers instead of leaving them as go-live conditions.

### Implementation

- Added `sentura/lib/cross-border-store/migrations/007_screening_retry_memory_approval.sql`.
- Persisted per-target Screening paid email/trade status, call counts, spend, retry count, retry timestamps, and re-approval metadata on `screening_batch_targets`.
- Added failed-child retry support through `POST /api/client-demos/cross-border/employee/screening-runs/[id]/retry`. Normal retry disables paid sources when re-approval is required; explicit re-approval reopens paid lookup for that child only.
- Updated Screening completion to detect observed paid email/trade evidence, update per-target paid state, and write `api_call_ledger` rows.
- Added Accio memory fact review through `PATCH /api/client-demos/cross-border/employee/memory/facts`, including reviewer metadata and raw-chat exclusion from vector memory.
- Marked Accio-to-Screening handoffs `accepted` on Screening creation and `completed` when the Screening report is saved for the Accio summary target.
- Updated the Employee UI so child Screening execution honors server `paidSourcePolicy`, and `记忆整理` exposes `批准写入` for preview-only memory facts.
- Updated `scripts/cross-border-phase2-backup-restore-drill.sh` to support `CBE_POSTGRES_CLIENT_IMAGE` for matching Docker PostgreSQL clients when local `pg_dump` / `pg_restore` are unavailable or too old for the source server.
- Updated `scripts/test-cross-border-phase2-load-smoke.ts` so reports can record `backup_restore_drill = "passed"` when `CBE_BACKUP_RESTORE_DRILL_PASSED=1`.
- Tightened Employee evidence-gap wording so missing domain/email evidence names RDAP/DNS/official contact-email searches, and missing trade/financial evidence names trade/customs, SEC, and public financial-file sources.
- Updated `scripts/test-cross-border-agents.ts` to match the current Employee/Admin navigation, task status, cost-detail, customer-label, budget, and evidence-gap contracts.
- Updated `跨境电商/PHASE-2.md`, `跨境电商/P2.6-LOAD-SMOKE-RUNBOOK.md`, `docs/TESTS.md`, `docs/tests/tests-cross-border-phase2.md`, `outputs/resume_card.md`, and `outputs/task_handoff.md` to reflect the completed local preflight.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm --dir sentura/dashboard build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 211/211.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 238/238.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 46/46.
- `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`: PASS, 16/16.
- `set -a; source sentura/dashboard/.env.local; set +a; CBE_BACKUP_RESTORE_DRILL_PASSED=1 pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts --require-db --report outputs/cbe-phase2-load-smoke-report.json`: PASS, 48/48.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 410/410.
- Backup/restore drill: PASS against disposable local `sentura_cbe_restore_drill` using `CBE_POSTGRES_CLIENT_IMAGE=postgres:18`; restored migration seed skipped already-applied migrations and restored-store checks passed 238/238.
- Browser smoke: PASS. With `CBE_DEMO_USER_ID=cbe-user-operator-001`, `http://localhost:3000/client-demos/cross-border/employee/memory` loaded a synthetic Accio memory record, report dialog showed `仅预览`, `批准写入` PATCH succeeded, UI showed `已批准`, and the temporary record/import was deleted.
- `git diff --check`: PASS after final documentation/handoff updates.

### Boundary

Local production-shaped preflight for P2.1-P2.6 is complete. Do not label a customer deployment `production_go_live_ready` from local-only evidence. The remaining gate is target-environment evidence: run the same load-smoke profile on the actual target deployment with Dashboard/Gateway processes, run the restore drill against a target disposable restore DB, and record provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS behavior.

## 2026-06-25 — Phase 2 burst/concurrency audit

### Context

The user asked whether the current CBE platform can handle multi-task bursts and what happens after reaching the "8" limit.

### Findings

- The implemented workload caps are not 8 globally. `sentura/dashboard/src/lib/cross-border-store/workload-coordinator.ts` defaults are:
  - `CBE_TASK_MAX_ACTIVE_TOTAL = 24`
  - `CBE_TASK_MAX_ACTIVE_TOTAL_HARD = 32`
  - `CBE_LEAD_MAX_ACTIVE_RUNS = 12`
  - `CBE_SCREENING_MAX_ACTIVE_TARGETS = 12`
  - `CBE_ACCIO_MAX_ACTIVE_IMPORTS = 3`
- `MAX_LEAD_COMPLETION_ATTEMPTS = 8` in `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx` is the Lead Discovery automatic top-up round guard. It prevents endless automatic refetch loops when public sources keep returning duplicates or too few unique buyers. After the 8th attempt, the UI stops launching new top-up sessions and reports the partial result as `公开来源暂时不足以补齐`.
- Workload admission uses a tenant-scoped PostgreSQL advisory transaction lock before counting active sessions. Queued rows are created without `session_key`, so no extra OpenClaw session is started once the soft/hard cap or per-agent cap is reached.
- Lead bursts are controlled by exact-scope join, near-duplicate choice responses, DB-derived pre-search denylists, completion-time tenant dedupe, and bounded top-up runs.
- Screening bursts are split into one parent batch plus one single-target child run per target. Child admission respects the active-target cap; excess children stay queued. `claimQueuedScreeningChildRuns()` uses `FOR UPDATE SKIP LOCKED`, re-runs admission before claiming, writes a lease/session key only for admitted children, and refreshes parent aggregate counts after child completion/failure/cancellation.
- Accio imports also use workload admission. JSON/text imports can be queued. Screenshot image analysis is intentionally failed rather than queued if capacity is unavailable, because raw image bytes are transient and are not stored in the CBE business database.

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23 static checks.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 46/46 static + live PostgreSQL checks.
- `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`: PASS, 16/16 static checks.
- `set -a; source sentura/dashboard/.env.local; set +a; pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts --require-db`: PASS, 47/47 static + live PostgreSQL DB-only load-smoke checks.
- A first attempt ran CE21 live and CE23 live in parallel; CE21 Screening drain and CE23 soft-cap assertions failed because the two DB-only pressure tests interfered with the same tenant-level active cap. Rerunning them sequentially passed. This is a test-orchestration caveat, not a product-path failure.
- A focused Screening cap repro with `CBE_SCREENING_MAX_ACTIVE_TARGETS=1` showed the expected state transitions: 1 running child + 2 queued children, failing the running child drops active count to 0, drain claims exactly 1 queued child, and aggregate becomes failed=1/running=1/queued=1.

### Boundary

- Current local evidence supports DB-level burst handling and queue/backpressure behavior. It does not replace target-deployment go-live evidence: the same smoke must still run against the actual deployment with Dashboard/Gateway processes, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS observations.
- No code changes were made in this audit.

## 2026-06-26 — Alibaba Cloud target deployment setup

### Context

The user had pulled the `ecommerce` branch onto the Alibaba Cloud ECS host, completed `pnpm build`, and then completed `pnpm openclaw onboard` manually with the intended LLM and Tavily configuration. The requested follow-up was to run Sentura setup, wire the target Alibaba RDS database, expose `app.sentura.ai` and `admin.sentura.ai`, test database and external port connectivity, and remove prior failed deployment residue.

### Implementation

- Ran `scripts/sentura-setup.sh` in non-interactive admin bootstrap mode after onboard. The script registered Sentura meta-agents, the Sitlink agent, and the CBE agents (`cbe-lead-discovery`, `cbe-buyer-screening`, `cbe-accio-memory`) into the OpenClaw config/workspace.
- Installed the root workspace dependencies needed by the Dashboard/store test tooling.
- Created the Alibaba RDS PostgreSQL database `sentura`, wrote the Dashboard target env entries, and ran the CBE migration runner with seed data. The target DB now has migrations `001`-`008`, one CBE `admin` profile, and two CBE `operator` profiles.
- Built the root workspace packages (`pnpm -r --if-present build`), including the Dashboard production build and MCP server builds.
- Restarted the OpenClaw Gateway user service and verified it listens only on loopback `127.0.0.1:18789` / `::1:18789`.
- Added a systemd service for the production Sentura Dashboard process on loopback `127.0.0.1:3000`.
- Configured Nginx so `app.sentura.ai` redirects to the Employee UI, `admin.sentura.ai` redirects to the Admin login UI, and `/gateway` proxies WebSocket traffic to the loopback OpenClaw Gateway.
- Updated Gateway allowed origins/trusted proxies for the ALB/Nginx path. OpenClaw device identity is temporarily disabled for Dashboard compatibility while keeping the Gateway loopback-only and token-protected behind Nginx/ALB.
- Removed the prior failed `/srv/sentura` deployment directory and fixed the stale bash-completion source line in `/root/.bashrc` so new root logins no longer print a missing completion-file error.

### Verification

- OpenClaw Gateway service: active, listening on loopback port `18789`.
- Sentura Dashboard service: active, listening on loopback port `3000`.
- Nginx: active, listening on public port `80` for ALB forwarding.
- RDS connectivity: connected to Alibaba RDS from the ECS host, created/used database `sentura`, and confirmed the migration/seed state.
- Live CBE store check against target RDS: `pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db` passed `244/244`.
- Local Nginx host-header checks: `app.sentura.ai` root redirects to `/client-demos/cross-border/employee`; `admin.sentura.ai` root redirects to `/client-demos/cross-border/admin/login`; the Admin login route returns `200`.
- Admin login API through Nginx returned a valid authenticated redirect to the Admin employees page.
- Public DNS/HTTPS checks: both `app.sentura.ai` and `admin.sentura.ai` resolve through Alibaba ALB and return the expected HTTPS redirects.
- Public Gateway WebSocket check: `wss://admin.sentura.ai/gateway` completed the OpenClaw Gateway connect handshake.
- ECS Nginx access logs showed Alibaba SLB health checks from private VPC addresses, confirming the ALB target group is forwarding to the ECS/Nginx service.

### Boundary

- This setup proves the DNS/ALB/ECS/Nginx/Dashboard/Gateway/RDS path is connected and usable. It does not by itself close the full production go-live gate.
- Remaining go-live evidence still needs a target load-smoke run, a target disposable-restore drill, and recorded provider/source-rate headroom, model concurrency behavior, DB connection-limit headroom, and Gateway RSS/runtime behavior.
- `sentura-memory-lancedb` was configured but did not become active because the current runtime memory slot remained `memory-core` and the embedding key path was not present. This does not block Dashboard, RDS, app/admin routing, or the current CBE store checks.
- Gateway device-auth bypass is a temporary compatibility setting for the Sentura Dashboard/OpenClaw `2026.6.2` client path. Keep port `18789` loopback-only and do not expose it directly to the internet.

## 2026-06-26 — Production Employee/Admin route split

### Context

The user noticed that deployment had split Employee and Admin by domain prefix, but the Dashboard implementation still exposed CBE through demo-style paths such as `/client-demos/cross-border/employee` and `/client-demos/cross-border/admin/login`. The requested local fix was to give Employee and Admin separate production entrances and change runtime endpoints away from demo wording. Server changes were explicitly deferred until after the user reviews, pushes the branch, and pulls it on the ECS host.

### Implementation

- Added `sentura/dashboard/src/lib/cross-border-routes.ts` as the canonical CBE route source:
  - Employee pages: `/employee`, `/employee/login`, `/employee/customers`, `/employee/memory`.
  - Admin pages: `/admin`, `/admin/login`, `/admin/employees`, `/admin/high-value-customers`, `/admin/costs`.
  - APIs: `/api/employee/*`, `/api/admin/*`, `/api/session`.
- Updated `sentura/dashboard/next.config.ts`:
  - Redirects old CBE page URLs from `/client-demos/cross-border/employee*` to `/employee*`.
  - Redirects old CBE page URLs from `/client-demos/cross-border/admin*` to `/admin*`.
  - Redirects `/auth/login` to `/employee/login`.
  - Rewrites canonical `/employee*`, `/admin*`, `/api/employee/*`, `/api/admin/*`, and `/api/session` to the existing implementation files/handlers.
- Updated AppShell navigation, role-session checks, notification links, logout targets, admin notification fetches, Employee home session fetch, memory import redirect, login pages, and login/session API `redirectTo` values to use canonical route constants.
- Updated Employee/Admin API client helpers so user-facing runtime calls go through `/api/employee/*` and `/api/admin/*`.
- Updated static regression scripts to assert the new canonical routes and Next rewrites, and to avoid checking old demo URLs as current runtime endpoints.
- Updated the test matrix/detail docs and handoff files for CE26.

### Verification

- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 417/417.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 218/218.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 23/23.
- `pnpm exec tsx scripts/test-cross-border-phase2-load-smoke.ts`: PASS, 16/16.
- `pnpm --dir sentura/dashboard build`: PASS, with only the existing multiple-lockfile workspace-root warning.
- Local HTTP smoke through production `next start` on `127.0.0.1:3000`:
  - `/employee`: `200`.
  - `/admin/login`: `200`.
  - `/client-demos/cross-border/employee`: `307` to `/employee`.
  - `/client-demos/cross-border/admin/login`: `307` to `/admin/login`.
  - `/auth/login`: `307` to `/employee/login`.
  - `/api/session`, `/api/employee/customers`, `/api/admin/operators`: reached handlers and returned expected unauthenticated `401`, not `404`.
- Browser smoke:
  - `/employee` loaded the Employee shell/login surface.
  - `/admin/login` exposed the `管理者姓名` / `密码` login form and `登录` button.

### Boundary

- The source implementation files remain under `src/app/client-demos/cross-border/**` for now. This is a transitional, lower-risk aliasing strategy; public paths and API endpoints are no longer demo-style.
- Standalone historical demo pages under `/client-demos/cross-border/lead-discovery`, `/screening`, and `/accio-memory` are not promoted to production entrypoints in this pass.

## 2026-06-26 — Production route split ECS rollout

### Context

After the user reviewed the local route split, pushed the branch, and pulled it on the Alibaba ECS target, the requested follow-up was to connect the server to the canonical Employee/Admin paths and test the public domains.

### Implementation

- Confirmed `/root/Sentura-Platform` on ECS was clean on `ecommerce` and contained `sentura/dashboard/src/lib/cross-border-routes.ts`.
- Rebuilt the Dashboard on ECS with `pnpm --dir sentura/dashboard build`.
- Restarted `sentura-dashboard.service`; Dashboard remained loopback-only on `127.0.0.1:3000`.
- Backed up `/etc/nginx/sites-available/sentura.conf` to `/etc/nginx/sites-available/sentura.conf.bak-20260626043945`.
- Changed Nginx root redirects:
  - `app.sentura.ai/` -> `https://app.sentura.ai/employee`.
  - `admin.sentura.ai/` -> `https://admin.sentura.ai/admin/login`.
  - default root -> `/admin/login`.
- Ran `nginx -t` and reloaded Nginx.
- Confirmed OpenClaw Gateway is root's systemd user service and listens only on `127.0.0.1:18789`.

### Verification

- `pnpm --dir sentura/dashboard build`: PASS on ECS.
- `sentura-dashboard.service`: active.
- `nginx`: active.
- `systemctl --user status openclaw-gateway`: active.
- Loopback smoke:
  - Dashboard `/employee`: `200`.
  - Dashboard `/admin/login`: `200`.
  - Old demo URLs redirect to `/employee` and `/admin/login`.
  - Nginx Host smoke routes `app.sentura.ai/` to `https://app.sentura.ai/employee` and `admin.sentura.ai/` to `https://admin.sentura.ai/admin/login`.
  - Canonical APIs reached handlers and returned expected unauthenticated `401`.
- Live RDS store check: `pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 244/244.
- Public HTTPS smoke:
  - `https://app.sentura.ai/`: `302` to `/employee`.
  - `https://admin.sentura.ai/`: `302` to `/admin/login`.
  - `https://app.sentura.ai/employee`: `200`.
  - `https://admin.sentura.ai/admin/login`: `200`.
  - Old public demo URLs return `307` to canonical paths.
  - Public canonical APIs return expected unauthenticated `401`, not `404`.
- Public Gateway smoke: `wss://admin.sentura.ai/gateway` opened successfully.
- Server repo was left clean after restoring build-generated `sentura/dashboard/next-env.d.ts`.

### Boundary

- This completes the route split deployment/connectivity work, but does not declare `production_go_live_ready`.
- Remaining readiness evidence still includes target load-smoke/restore drill, provider/source-rate headroom, model concurrency, DB connection-limit observations, and Gateway RSS/runtime observations.
- The source implementation files remain under `src/app/client-demos/cross-border/**` for now. This is a transitional, lower-risk aliasing strategy; public paths and API endpoints are no longer demo-style.
- Standalone historical demo pages under `/client-demos/cross-border/lead-discovery`, `/screening`, and `/accio-memory` are not promoted to production entrypoints in this pass.

## 2026-06-26 — Admin SSR rewrite hotfix

### Context

After the route split deployment, `https://app.sentura.ai` opened the Employee side correctly, but the user reported that `https://admin.sentura.ai` did not open the Admin side. Public HTTP checks showed the domain and Nginx were healthy: `admin.sentura.ai/` redirected to `/admin/login` and `/admin/login` returned `200`. The actual failure was in the HTML: the page contained `跨境电商员工操作系统` in the AppShell while also showing the Admin login form.

### Root Cause

`next.config.ts` rewrites `/admin/login` to the existing implementation route `/client-demos/cross-border/admin/login`. During server rendering, AppShell can see the rewrite destination path. The new route helpers only recognized canonical `/admin*`, so the SSR shell fell back to Employee mode for the internal destination path. The same edge existed for tenant role inference if a route handler saw rewritten internal API paths.

### Implementation

- Updated `sentura/dashboard/src/lib/cross-border-routes.ts`:
  - Added internal rewrite destination constants for `/client-demos/cross-border/{employee,admin}` and `/api/client-demos/cross-border/{employee,admin,session}`.
  - Added `matchesPath()` helper.
  - Updated `isCbeEmployeePath`, `isCbeAdminPath`, and `isCbeAdminLoginPath` to recognize canonical and internal rewrite paths.
- Updated `sentura/dashboard/src/lib/cross-border-store/tenant-context.ts`:
  - `expectedRoleFromPath()` recognizes canonical and rewritten Employee/Admin API paths.
  - Admin override header logic recognizes canonical and rewritten Admin API paths.
- Added regression checks:
  - `scripts/test-cross-border-agents.ts` asserts route helpers recognize Next rewrite destination paths during SSR.
  - `scripts/test-cross-border-phase2-store.ts` asserts tenant context recognizes canonical and rewritten CBE API paths.
- Applied the two-source-file hotfix directly on ECS with `git apply`, rebuilt Dashboard, restarted `sentura-dashboard.service`, and restored generated `next-env.d.ts`.

### Verification

- Local:
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 418/418.
  - `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 219/219.
  - `pnpm --dir sentura/dashboard build`: PASS, with the existing multiple-lockfile workspace-root warning only.
  - Local production HTTP smoke: `/admin/login` SSR HTML contains `跨境电商管理者系统`, does not contain `跨境电商员工操作系统`, and includes `管理者姓名`, `密码`, and `登录`.
- ECS:
  - `pnpm --dir sentura/dashboard build`: PASS.
  - `sentura-dashboard.service`: active after restart.
  - Server loopback HTML smoke: `/admin/login` contains `跨境电商管理者系统`, not `跨境电商员工操作系统`.
  - Public HTML smoke: `https://admin.sentura.ai/admin/login` contains `跨境电商管理者系统`, not `跨境电商员工操作系统`.
  - Public login smoke with `孙总` / `1234`: `/api/auth/login` returns `200` with `redirectTo: "/admin/employees"`; authenticated `/admin/employees` returns `200` and renders `员工管理`, `优先跟进客户`, and `费用监控`.
  - `https://app.sentura.ai/employee` remains `200`.
  - ECS services active after cleanup: `sentura-dashboard`, root `openclaw-gateway`, and `nginx`.

### Boundary

- ECS currently carries this hotfix as uncommitted changes in the two source files until the local branch is pushed and the server is aligned with `origin/ecommerce`.
- This is a route-shell correctness fix, not a change to Nginx, DNS, ALB, credentials, or RDS schema.

## 2026-06-26 — ECS Lead task sandbox readiness fix

### Context

After the production domain/server setup succeeded, the first `app.sentura.ai` Employee `寻找客户` run failed with:

`未写入客户：本地页面超过等待时间仍未收到结构化结果，请查看任务编号或重新提交。`

The failed session key was `agent:cbe-lead-discovery:user:0c01d63d-de13-4478-a6a7-af3680b979b6:0deacf0e-2189-48a5-a26d-fb8056b592c2`.

### Root Cause

The OpenClaw session transcript and Gateway journal showed the run failed before the model/tool workflow could begin:

`Sandbox image not found: openclaw-sandbox:bookworm-slim. Build it with scripts/sandbox-setup.sh before enabling Docker sandboxing.`

Docker itself was installed and active, but the required upstream OpenClaw sandbox image did not exist on the ECS host. Because `cbe-lead-discovery` runs with sandboxing enabled, Gateway returned an assistant-side failure before any `LEAD_CANDIDATES_JSON` marker could be produced. The Dashboard's local task recovery then reported a structured-result timeout.

A second operational issue was found in RDS: the failed `agent_runs` row and its `lead_runs` row still had `status = 'running'`, leaving an active Lead scope lease that could block or join later retries for the same `phone case / GB` scope.

### Fix

- Built the upstream OpenClaw sandbox image on ECS:
  - `bash openclaw/scripts/sandbox-setup.sh`
  - Result: `openclaw-sandbox:bookworm-slim` present in Docker images.
- Restarted root's user Gateway service:
  - `systemctl --user restart openclaw-gateway`
  - Gateway returned to `active` and `ready`.
- Verified sandboxed `cbe-lead-discovery` startup with a temporary `READY` session, then removed its diagnostic artifacts.
- Ran a non-writing smoke that reached `cross-border-intel__cbe_intel_google_places_search`; Google Places returned HTTP 200. The smoke was intentionally not completed into the production customer table, and diagnostic session artifacts were removed.
- Marked the stale RDS run failed through the existing store path `failEmployeeTask()` so it updated:
  - `agent_runs.status = 'failed'`
  - `lead_runs.status = 'failed'`
  - `lead_discovery_scopes.active_agent_run_id = null`
  - audit/activity metadata with the sandbox root cause.

### Verification

- `docker image ls` includes `openclaw-sandbox:bookworm-slim`.
- `systemctl --user is-active openclaw-gateway`: `active`.
- OpenClaw Gateway logs after the fix show no new `Sandbox image not found` errors during the diagnostic Lead startup.
- Temporary sandbox startup probe returned `READY` from `cbe-lead-discovery`.
- Lead tool smoke called `cross-border-intel__cbe_intel_google_places_search` and received Google Places HTTP 200 candidates.
- RDS check for the original failed session:
  - `agent_runs.status = failed`
  - `agent_runs.error_code = gateway`
  - `lead_runs.status = failed`
  - active `cbe-lead-discovery` run count = `0`
  - lingering scopes for the failed run = `[]`
- Removed diagnostic session files for the temporary `READY` and tool-smoke runs. The user's original failed session remains as an audit record.

### Boundary

- No application source code changed for this fix.
- The user should now retry the `寻找客户` task from `app.sentura.ai`; the previous failed task can be dismissed in the UI.
- This proves the missing sandbox dependency and stale Lead lease are fixed. It is still not a full `production_go_live_ready` label; target load-smoke, restore drill, provider/source-rate headroom, model concurrency, DB connection limits, and Gateway RSS remain separate readiness evidence.

## 2026-06-26 — Screening fenced-JSON timeout recovery

### Context

After the Lead task succeeded in production, the user ran a `背调` task and saw another failure that appeared to happen when the estimated wait time expired. The failed production run was:

- RDS run: `run_bd41a833-f84b-4b20-930d-65732ffab564`
- OpenClaw session key: `agent:cbe-buyer-screening:user:0c01d63d-de13-4478-a6a7-af3680b979b6:f70c7296-85d5-4f1c-b4d5-ba0bf659c81b`
- OpenClaw session file: `/root/.openclaw/agents/cbe-buyer-screening/sessions/bb9127f8-5645-4e06-9c57-93ca8f6fa220.jsonl`
- Target: `CPR Cell Phone Repair`

### Root Cause

This was not a sandbox or DNS/RDS connectivity problem. The OpenClaw session completed successfully in about 195 seconds and returned a long, valid JSON Screening report. The model did not follow the final output contract exactly: it omitted `SCREENING_REPORTS_JSON_START` / `SCREENING_REPORTS_JSON_END` and wrapped the JSON in a ```json fenced block.

The Dashboard hidden runner only accepted explicit marker-delimited payloads. Since no marker was found, it kept polling until the 6-minute local wait window ended and then wrote:

`error_code = timeout`

### Fix

- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - Kept marker extraction as the primary path.
  - Added `stripJsonCodeFence()`.
  - Added `expectedPayloadKeyForMarker()`.
  - Added `parseWholeJsonPayload()` fallback.
  - Fallback only accepts a whole JSON object when the expected top-level key is present as an array:
    - Lead: `leads`
    - Screening: `reports`
    - Accio memory: `summaries`
    - Image transcription preflight: `images`
- Updated `scripts/test-cross-border-agents.ts` with a static regression for the fenced JSON fallback.
- Applied the same patch on ECS via `git apply`, rebuilt Dashboard, restarted `sentura-dashboard.service`, and restored build-generated `next-env.d.ts`.
- Backfilled the already-generated CPR Screening report through the normal Dashboard completion API/store path:
  - Parsed the existing OpenClaw transcript payload.
  - Let Dashboard normalization handle schema differences such as string confidence labels.
  - Called the existing completion path instead of hand-writing raw SQL.

### Verification

- Local:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 419/419.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- ECS:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 419/419.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm --dir sentura/dashboard build`: PASS, with the existing Next multiple-lockfile workspace-root warning only.
  - `systemctl is-active sentura-dashboard nginx`: both `active`.
  - `systemctl --user is-active openclaw-gateway`: `active`.
  - Public HTTPS:
    - `https://app.sentura.ai/employee`: 200.
    - `https://admin.sentura.ai/admin/login`: 200.
- RDS:
  - `agent_runs.status = completed`.
  - `agent_runs.current_stage = screening_reports_saved`.
  - `agent_runs.error_code = null`.
  - saved reports = 1.
  - report id `RPT-20260625-CPR-001`.
  - risk tier `cautious`.
  - normalized score `78.67`.
  - address-footprint locations = 16.
  - active Screening run count = 0.
- Employee API smoke for `query=CPR` returned `CPR Cell Phone Repair` with:
  - `screeningStatus = cautious`
  - `normalizedScore = 78.67`
  - `latestScreeningReportId = RPT-20260625-CPR-001`
  - `screeningAgentRunId = run_bd41a833-f84b-4b20-930d-65732ffab564`

### Boundary

- The prompt contract still requires markers; this fallback is a runtime resilience path for model formatting drift.
- The fallback is intentionally narrow and does not parse arbitrary prose.
- The production backfill did not rerun the agent and did not insert a synthetic test customer.
- ECS now intentionally has two source hotfix changes for this issue until the local branch is pushed and the server is aligned with `origin/ecommerce`.

## 2026-06-26 — Hidden task structured-output repair loop

### Context

After CE28, the user asked whether future tasks could still timeout due to output format drift and whether there is an enforcement path to ensure the Dashboard receives structured JSON.

CE28 made the common successful-but-unmarked case recoverable by accepting whole-response JSON and fenced JSON. The remaining format-only risk was a completed assistant reply that still cannot be parsed, such as malformed JSON, prose wrapped around the payload, or a missing marker response that is not a clean full JSON object.

### Fix

- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - Added `HIDDEN_TASK_FORMAT_REPAIR_TIMEOUT_MS = 90_000`.
  - Added timestamp-scoped transcript filtering with `minMessageTimestampMs`.
  - Added `buildStructuredOutputRepairPrompt()` and `requestHiddenTaskFormatRepair()`.
  - The repair prompt tells the employee that the Dashboard could not read the JSON and requires a pure marker-wrapped JSON object.
  - The repair prompt explicitly forbids re-investigation, tool calls, adding/deleting evidence, or inventing facts.
  - The expected top-level array is derived from the original task marker: `leads`, `reports`, `summaries`, or image `images`.
  - Repair polling only reads transcript messages after the repair request timestamp.
- Wired the repair path into:
  - screenshot preflight turns after the preflight `chat.send` completes;
  - final Lead/Screening/Accio turns on JSON parse errors;
  - final Lead/Screening/Accio turns when a completed `chat.send` produces non-marker assistant output;
  - the final transcript grace window after a long `chat.send` timeout.
- Kept the parsing order conservative:
  - explicit markers first;
  - whole-response JSON/code-fenced JSON fallback second;
  - one format-repair turn third;
  - explicit parse/timeout/backend failure only after those paths fail.
- Updated `scripts/test-cross-border-agents.ts` with a static regression for the repair loop.

### ECS Rollout

- Applied the local two-file source patch on `/root/Sentura-Platform`.
- Rebuilt the Dashboard on ECS.
- Restarted `sentura-dashboard.service`.
- Restored build-generated `sentura/dashboard/next-env.d.ts`.
- ECS repo status after cleanup intentionally shows only:
  - `scripts/test-cross-border-agents.ts`
  - `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`

### Verification

- Local:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 420/420.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
- ECS:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 420/420.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm --dir sentura/dashboard build`: PASS, with the existing Next multiple-lockfile workspace-root warning only.
  - `systemctl is-active sentura-dashboard`: `active`.
  - `systemctl is-active nginx`: `active`.
  - `systemctl --user is-active openclaw-gateway`: `active`.
- Public HTTPS:
  - `https://app.sentura.ai/employee`: 200; contains `跨境电商员工操作系统` and not `跨境电商管理者系统`.
  - `https://admin.sentura.ai/admin/login`: 200; contains `跨境电商管理者系统` and not `跨境电商员工操作系统`.

### Boundary

- This is a format enforcement and recovery layer, not a guarantee that every AI task succeeds.
- If the model never reaches a final answer, a tool/provider/backend failure occurs, or the repair turn itself cannot produce parseable JSON, the task still fails explicitly.
- The repair turn is intentionally not a second investigation pass; it may only reformat the prior assistant result.

## 2026-06-26 — Nested OpenClaw transcript recovery

### Context

After the CE29 repair-loop hotfix was deployed, the user ran another production `背调` task from `app.sentura.ai` and saw the same local timeout behavior.

RDS showed latest failed Screening run:

- `agent_run_id`: `run_230efb76-4442-4e46-a5d0-0467dea30b8f`
- `target_summary`: `Cellairis`
- `session_key`: `agent:cbe-buyer-screening:user:0c01d63d-de13-4478-a6a7-af3680b979b6:18ac43d8-10b0-4812-8b98-e82504b0dbdd`
- failure: `status = failed`, `current_stage = submitted_to_employee`, `error_code = timeout`, `error_message = 等待任务返回结果超时。`

The OpenClaw session file `/root/.openclaw/agents/cbe-buyer-screening/sessions/2cd1d554-f500-41d4-927b-8aa225f3d96c.jsonl` showed the actual agent completed the Cellairis report before the Dashboard timed out:

- final report timestamp: `2026-06-25T23:03:59.697Z`
- Dashboard timeout timestamp: `2026-06-25T23:06:34.074Z`
- final assistant text included `SCREENING_REPORTS_JSON_START` / `SCREENING_REPORTS_JSON_END`

### Root Cause

CE29's parser still assumed `chat.history` returned flat `TranscriptMessage` rows with top-level `role` and `content`.

The production OpenClaw transcript exposed raw nested entries shaped like:

```json
{
  "type": "message",
  "timestamp": "2026-06-25T23:03:59.697Z",
  "message": {
    "role": "assistant",
    "content": [{ "type": "text", "text": "SCREENING_REPORTS_JSON_START..." }]
  }
}
```

Because the hidden runner filtered for `message.role === "assistant"` on the top-level row, it never saw the assistant result. This also explained why CE29's repair path did not activate: the Dashboard thought there was no assistant text to repair.

### Fix

- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - Added `transcriptMessageRecord()`.
  - Added `messageRole()` to read top-level `role` or nested `message.role`.
  - Added `messageContent()` to read top-level `content` or nested `message.content`.
  - Updated `assistantTexts()` and terminal failure detection to use those helpers.
  - Added `coerceTimestampMs()` and expanded timestamp parsing to top-level/nested `timestamp`, `createdAt`, `created_at`, `updatedAt`, and `ts`.
  - Updated `transcriptMessagesSince()` to fall back to the full transcript when no comparable timestamp exists, instead of dropping every transcript row.
- Updated `scripts/test-cross-border-agents.ts`:
  - Added static regression for nested OpenClaw transcript messages.
  - Added static regression for non-comparable timestamp fallback.

### ECS Rollout

- Applied the same two-file patch on `/root/Sentura-Platform`.
- Rebuilt Dashboard with `pnpm --dir sentura/dashboard build`.
- Restarted `sentura-dashboard`.
- Restored build-generated `sentura/dashboard/next-env.d.ts`.
- Verified services:
  - `sentura-dashboard`: active
  - `nginx`: active
  - root `openclaw-gateway`: active

### Production Recovery

Recovered the existing Cellairis transcript through the normal Dashboard completion path:

- Extracted the marker payload from the existing OpenClaw session file.
- Reused `completeEmployeeScreeningRun()` so the existing `normalizeScreeningPayload()` and API/store validation path handled schema cleanup.
- Did not write raw SQL reports manually.

RDS verification after recovery:

- `agent_runs.status = completed`
- `current_stage = screening_reports_saved`
- `error_code = null`
- report id `SR-20260625-CELLAIRIS-001`
- company `Cellairis`
- normalized score `88.44`
- risk tier `trusted_candidate`
- evidence rows `29`
- score blocks `6`
- address-footprint locations `14`
- active Screening run count `0`

### Verification

- Local:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 422/422.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `git diff --check`: PASS.
- ECS:
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 422/422.
  - `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
  - `pnpm --dir sentura/dashboard build`: PASS.
  - `systemctl is-active sentura-dashboard`: active.
  - `systemctl is-active nginx`: active.
  - `systemctl --user is-active openclaw-gateway`: active.
- Public HTTPS:
  - `https://app.sentura.ai/employee`: 200.
  - `https://admin.sentura.ai/admin/login`: 200.

### Boundary

- CE30 fixes transcript-shape compatibility only.
- The marker contract remains required.
- CE28's whole-response JSON fallback and CE29's no-tools repair loop remain the two recovery layers after marker parsing.
- If OpenClaw never writes a final assistant result, or the final result has no usable structured payload after fallback/repair, the task still fails explicitly.

## 2026-06-26 — Long transcript repair-result recovery

### Context

After CE30 was deployed and a new Screening run succeeded, the user ran another production `背调` task from `app.sentura.ai` for `Adorama`. The UI failed with:

- `员工已返回结果，但格式修复超时，仍未收到可写入 结构化结果。`
- task key: `agent:cbe-buyer-screening:user:0c01d63d-de13-4478-a6a7-af3680b979b6:4497ff46-c5a9-489c-92b1-fed3ba9fb902`

RDS showed:

- `agent_run_id`: `run_0ce71f21-efbc-43be-909d-6309c7039548`
- `agent_id`: `cbe-buyer-screening`
- `status`: `failed`
- `current_stage`: `submitted_to_employee`
- `error_code`: `timeout`
- `error_message`: `员工已返回结果，但格式修复超时，仍未收到可写入 JSON。`
- `target_summary`: `Adorama`
- `target_record_id`: `lead_21e69a32-27a9-4180-ad28-7e68f0bf2524`

The OpenClaw session map pointed to:

- session id: `8f062995-9c46-43ce-bf7a-5eb985b760d3`
- session file: `/root/.openclaw/agents/cbe-buyer-screening/sessions/8f062995-9c46-43ce-bf7a-5eb985b760d3.jsonl`
- trajectory file: `/root/.openclaw/agents/cbe-buyer-screening/sessions/8f062995-9c46-43ce-bf7a-5eb985b760d3.trajectory.jsonl`
- session JSONL size: about 333KB

### Root Cause

The employee did complete the work and the repair turn also succeeded.

The session JSONL showed:

- original final assistant row: prose before a ```json fenced object with top-level `reports`;
- repair user row: `[CBE Structured Output Repair]`;
- repair assistant row: `SCREENING_REPORTS_JSON_START` followed by a strict JSON object with top-level `reports`, then `SCREENING_REPORTS_JSON_END`.

The Dashboard hidden runner requested only `300_000` characters from `chat.history`. The Adorama session was about 333KB because the Screening task gathered many tool results and a long report. The valid repair marker payload lived at the end of the transcript, beyond the 300KB cap, so the Dashboard polling loop could not see it and incorrectly reported a repair timeout.

This was a Dashboard transcript-read bug, not a missing employee result.

### Fix

Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:

- Raised `HIDDEN_TASK_TRANSCRIPT_MAX_CHARS` from `300_000` to the OpenClaw Gateway-safe `500_000` limit. The first CE31 rollout briefly used 2MB; CE32 corrected it because Gateway validates `chat.history.maxChars <= 500000`.
- Added `parseJsonPayloadCandidate()` to share expected-key validation between whole-object and fenced-object parsing.
- Added `parseFencedJsonPayload()` so a marker-less response with prose before a ```json fenced object can still be parsed when it contains the expected top-level array.
- Kept marker parsing first; fallback parsing remains guarded by the expected task key (`leads`, `reports`, `summaries`, or image `images`).
- Added a final unscoped `readHiddenTaskPayload()` inside `requestHiddenTaskFormatRepair()` before throwing the repair-timeout error.

Updated `scripts/test-cross-border-agents.ts`:

- Added `employee runner accepts embedded fenced JSON when model adds prose`.
- Added `employee runner rereads full transcript before declaring repair timeout`.
- Updated `employee runner reads full structured task output from chat history` to assert the 500KB cap.

### Verification

Local:

- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 424/424.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `git diff --check`: PASS.

ECS:

- Pulled commit `df08d317` onto `/root/Sentura-Platform`.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 424/424.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm --dir sentura/dashboard build`: PASS, with the existing multiple-lockfile workspace-root warning only.
- Restarted `sentura-dashboard`; `sentura-dashboard`, `nginx`, and root `openclaw-gateway` were all active.
- Restored build-generated `sentura/dashboard/next-env.d.ts` so the server repo stayed clean.

Production recovery:

- Parsed the existing repair marker payload from `/root/.openclaw/agents/cbe-buyer-screening/sessions/8f062995-9c46-43ce-bf7a-5eb985b760d3.jsonl`.
- Posted the payload through the Dashboard completion route/store path after minimal schema cleanup equivalent to the Employee API normalizer; did not hand-write report rows with raw SQL.
- Cleaned the stale validation metadata left by an initial dry-run POST that intentionally exposed raw schema errors.

RDS verification after recovery:

- `agent_runs.status = completed`.
- `current_stage = screening_reports_saved`.
- `error_code = null`.
- report id `cbe_sr_20260626_adorama_001`.
- company `Adorama`.
- normalized score `59`.
- risk tier `high_risk`.
- evidence rows `22`.
- score blocks `6`.
- address-footprint locations `6`.
- active Screening run count `0`.

Public/API verification:

- `https://app.sentura.ai/employee`: 200 and contains `跨境电商员工操作系统`.
- `https://admin.sentura.ai/admin/login`: 200 and contains `跨境电商管理者系统`.
- Employee API query for `Adorama`: HTTP 200, `screeningStatus = high_risk`, `normalizedScore = 59`, and `screeningAgentRunId = run_0ce71f21-efbc-43be-909d-6309c7039548`.

### Boundary

- CE31 fixes transcript truncation and embedded fenced-JSON parsing for completed hidden tasks.
- It still requires an actual parseable payload to exist in the transcript.
- The transcript cap is now larger, not unbounded; pathological sessions that exceed the cap and do not include a returned recent payload may still fail explicitly.

## 2026-06-26 — OpenClaw chat.history Cap Compatibility and USB-C Lead Recovery

Context:

- The user reported a production `寻找客户` failure for `USB-C charger / US`.
- UI error: `invalid chat.history params: at /maxChars: must be <= 500000`.
- Failed task key: `agent:cbe-lead-discovery:user:0c01d63d-de13-4478-a6a7-af3680b979b6:cab9a635-ee0f-4216-82eb-c5c7e9647f8c`.
- RDS run: `run_e9dc249b-d1b0-4243-81c2-7eadd5f1549f`.
- Lead run: `lead_run_58f1040e-4fc5-45d7-8fcc-c4f94859ff68`.

Root cause:

- CE31's first rollout raised `HIDDEN_TASK_TRANSCRIPT_MAX_CHARS` to 2MB.
- OpenClaw Gateway rejects `chat.history` calls with `maxChars > 500000`, so Dashboard polling failed immediately before it could read the finished employee result.
- The OpenClaw session itself completed successfully in about 120 seconds and wrote a valid marker payload in `/root/.openclaw/agents/cbe-lead-discovery/sessions/22929183-100d-4872-9a65-06906b1e3f16.jsonl`.
- Session file size was about 242KB, inside the Gateway-safe 500KB limit.

Fix:

- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts` now keeps `HIDDEN_TASK_TRANSCRIPT_MAX_CHARS = 500_000`.
- `scripts/test-cross-border-agents.ts` asserts the `500_000` cap and the `client.getTranscript()` `maxChars` wiring.
- Local commit `1fd474e4` was pushed to `origin/ecommerce`, pulled on ECS, built, and deployed.

Verification:

- Local `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 424/424.
- Local `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- ECS `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 424/424.
- ECS `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- ECS `pnpm --dir sentura/dashboard build`: PASS, with the existing multiple-lockfile workspace-root warning only.
- Restarted `sentura-dashboard`.
- ECS services after restart: `sentura-dashboard`, `nginx`, and root `openclaw-gateway` active.
- Public HTTPS:
  - `https://app.sentura.ai/employee`: 200 and contains `跨境电商员工操作系统`.
  - `https://admin.sentura.ai/admin/login`: 200 and contains `跨境电商管理者系统`.
- Restored build-generated `sentura/dashboard/next-env.d.ts`; server repo stayed clean at `1fd474e4`.

Production recovery:

- Parsed the existing `LEAD_CANDIDATES_JSON_START` / `LEAD_CANDIDATES_JSON_END` payload from the OpenClaw session file.
- Posted the payload through the Dashboard Lead completion route/store path after minimal schema cleanup equivalent to the Employee API normalizer (`duplicate_status: "unique"` -> `"new"` and null optional fields removed).
- Cleaned the stale validation metadata left by the first recovery POST attempt.
- Did not hand-write lead candidate/source rows with raw SQL.

RDS verification after recovery:

- `agent_runs.status = completed`.
- `agent_runs.current_stage = lead_results_saved`.
- `agent_runs.error_code = null`.
- `lead_runs.status = completed`.
- saved lead candidates `3`.
- saved lead sources `12`.
- active Lead scope count `0`.

Recovered leads:

- `NEM Electronics Corp` (`nemusa.com`).
- `Entro Wholesale` (`entrowholesale.com`).
- `Mighty Wireless Wholesale Cellphone Accessories` (`mightywireless.com`).

Boundary:

- CE32 fixes the invalid `maxChars` parameter regression.
- The Gateway-safe transcript cap remains finite. If a future transcript exceeds 500KB and the final structured payload is outside the returned history, the task can still fail explicitly until the runner uses a session-file-aware or incremental transcript retrieval path.

## 2026-06-26 — Dynamic Lead/Screening Task Time Budgeting

Context:

- The user asked for a dynamic growth mechanism after clarifying that one Screening task is now about 3 minutes and multiple targets should increase the planned duration.
- The concern was both direct timeout behavior and burst/coordinator behavior: a batch of 10 customers can be legitimate work, not a failed task, and queued coordinator work should not be marked stale before it starts.

Root cause:

- The previous task estimates were partly fixed by task kind:
  - Lead had target-count input, but the estimator was still too tightly capped for larger requests and top-up runs.
  - Screening estimated too little per target and did not reflect the current single-target child fan-out pattern.
  - DB task hydration in `employee-api.ts` could fall back to fixed task-kind estimates, shrinking refreshed tasks after they were created.
  - Queued task records did not add coordinator `estimated_start_seconds` to the local wait window.

Fix:

- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - added named timing constants;
  - Lead estimate now scales by product/buyer/country query breadth, requested target count, max search-result scan count, and top-up overhead;
  - Screening estimate now uses `SCREENING_SINGLE_TARGET_DURATION_MS = 180_000` and scales by `SCREENING_CHILD_CONCURRENCY = 3` waves plus drain overhead and paid-source overhead;
  - timeout budget now uses estimate + max(3 minutes, 50% grace), clamped from 6 to 30 minutes.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-api.ts`:
  - Lead/Screening creation sends `metadata_json.estimated_ms` and `metadata_json.timeout_ms`;
  - task hydration uses stored timing metadata first, then reconstructs estimates from task metadata;
  - queued tasks add `workload_admission.estimated_start_seconds` to the local wait window.
- Updated `sentura/dashboard/src/lib/cross-border-store/schemas.ts` and `lead-runs.ts`:
  - Lead create requests now accept `metadata_json`;
  - Lead run records preserve timing metadata next to `query_config`, target counts, and workload coordinator metadata without putting timing fields into the Lead scope fingerprint.
- Updated static regressions:
  - `scripts/test-cross-border-agents.ts` adds Lead scaling, Screening fan-out wave, and timeout-cap assertions.
  - `scripts/test-cross-border-phase2-store.ts` adds DB timing metadata and coordinator queue-delay assertions.

Verification:

- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 427/427.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 220/220.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.

Boundary:

- This fix prevents expected long work from failing solely because the old fixed window was too short.
- It does not remove all possible timeouts: the task can still fail if the employee never produces a parseable payload, the provider/backend fails, or queue assumptions are exceeded.
- This session did not deploy the CE33 timing change to ECS; deployment requires commit/push, server pull/build/restart, and target smoke checks.

## 2026-06-26 — Screening Batch Deduplication and Score Reconciliation

Context:

- The user ran production batch `背调` for three customers.
- The Employee `获客与背调` list showed duplicate rows for BrandsMart USA and Altex Computers & Electronics: one scored row plus one remaining `未评分`.
- BrandsMart USA also showed `59/100` in the list while the report's score blocks and 100% evidence coverage indicated a high-score report.

Root cause:

- A Lead can accumulate multiple `screening_targets` rows over retries/batches.
- `cbe_customer_work_items` joined `lead_candidates` to every target for the Lead, so historical target rows expanded one customer into multiple visible rows.
- The save path could insert a new target instead of reusing the Lead's existing target when a batch/employee response omitted or rewrote the expected target id.
- Employee normalization trusted model-returned `normalized_score` even when `score_blocks` and `evidence_coverage` implied a different final score.

Fix:

- `sentura/dashboard/src/lib/cross-border-store/screening.ts`:
  - resolves Lead candidates from `target.lead_id`, `target.target_id`, normalized domain, and company/country fallback;
  - reuses the latest non-Accio `screening_targets` row for a resolved Lead before inserting a new target;
  - fills `lead_candidate_id` on existing targets when enough target metadata is available.
- `sentura/lib/cross-border-store/migrations/009_customer_work_items_deduped_screening.sql`:
  - replaces `cbe_customer_work_items` so each Lead projects one latest Screening report instead of one row per historical target.
- `sentura/lib/cross-border-store/migrations/001_initial_schema.sql`:
  - mirrors the deduped projection for fresh databases.
- `employee-api.ts` and `employee-task-runner.ts`:
  - recompute final Screening score from score-block quality and evidence coverage using the existing rule: quality score 80% + `evidence_coverage * 100` 20%;
  - make `risk_tier` follow that recomputed final score;
  - prefer recomputed report score over stale stored row score when rendering customer list rows.

Verification:

- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 428/428.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 222/222.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.

Production note:

- Pre-fix RDS inspection confirmed BrandsMart USA had `normalized_score = 59` while score blocks + coverage recomputed to a high score.
- Existing production data still needs migration 009 plus a targeted report-score repair during ECS deployment.
