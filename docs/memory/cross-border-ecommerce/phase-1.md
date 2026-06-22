> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md)

# Cross-Border E-Commerce — Phase 1

Independent memory for the mobile-accessory cross-border e-commerce client pilot. This lane is outside the core A/B/C/D sprint plan and outside Sitlink; use Owner `cross-border-ecommerce` in `docs/MEMORY.md`.

Phase 2 split: this file is now historical Phase 1/MVP memory. Current and future Phase 2 production/database/customer-admin/concurrency/store/UI-persistence memory belongs in [`phase-2.md`](phase-2.md). Historical Phase 2 entries may remain below for audit continuity, but new Phase 2 sessions should not be appended here.

## Sessions in this file

| Date | Session | Summary |
|---|---|---|
| 2026-06-07 | Phase-1 MVP design and API/tool plan | Wrote the initial OpenClaw/Sentura design for three employees and created the simulated Accio chat fixture. |
| 2026-06-08 | UI/manual-screening/contextual-scoring revision | Added employee-specific demo UI requirements, Screening manual intake, and contextual scoring behavior. |
| 2026-06-08 | Milestone 2 shared ontology and schemas | Added cross-border mobile-accessory ontology files, reusable Zod schemas, contextual score helper, and a 39-check offline validation script. |
| 2026-06-08 | Milestone 3 `cross-border-intel` MCP server | Added the read-mostly stdio MCP server for registry/RDAP/DNS/email/SEC/trade evidence, contextual scoring, and Accio fixture parsing/summarization; 12/12 package tests plus build pass. |
| 2026-06-08 | API key and OpenClaw setup runbook | Added a Chinese operator runbook for API key acquisition, OpenClaw onboard, Sentura setup aftermath, MCP registration, probe commands, sandbox allowlists, and paid-data budget defaults. |
| 2026-06-08 | Sentura setup owns cross-border MCP wiring | Moved `cross-border-intel` MCP registration into `scripts/sentura-setup.{sh,ps1}`, updated docs to use `${ENV_VAR}` references, and added CE9 static checks. |
| 2026-06-08 | MCP doctor warning clarification | Clarified that `literal sensitive value` warnings do not block `cross-border-intel` when the actual config still stores `${ENV_VAR}` placeholders; added runbook troubleshooting and CE8.11. |
| 2026-06-08 | Milestone 4 Marketing Acquisition employee | Added the `cbe-lead-discovery` workspace, setup registration/webchat binding, lead-discovery workbench UI, and CE4 static verification script. |
| 2026-06-08 | Milestone 4 live-data correction | Replaced the lead UI's baked-in candidate fixture with a live Tavily Dashboard API route that reads configured env from process env or `~/.openclaw/.env`; CE4 static checks now pass 102/102 and a minimal live Tavily smoke returned one public-web candidate. |
| 2026-06-08 | Milestone 4 company-buyer filtering correction | Tightened live search to retain specific downstream buyer company websites only, rejecting social profiles, directories, marketplaces, supplier directories, public company-info pages, and wholesale supplier pages; CE4 checks now pass 110/110 and live smoke returned company domains. |
| 2026-06-08 | Milestone 4 lead UI simplification | Removed query log, Screening handoff preview, Marketing AgentChat, and realtime tool trace panels; moved source/dedupe review into expandable candidate-buyer table rows and stretched the table across the right workspace; CE4 checks now pass 107/107. |
| 2026-06-08 | Milestone 5 Screening employee and live background investigation | Added `cbe-buyer-screening`, setup registration, live Screening UI/API route, real configured-provider investigation path, and contextual score/coverage reporting; CE4+CE5 checks now pass 196/196 plus live smoke. |
| 2026-06-08 | Lead-to-Screening copy and state persistence | Added Lead copy-all/per-row Screening JSON, persisted Lead/Screening dashboard state across refresh/navigation, and expanded CE4+CE5 checks to 200/200 plus Browser validation. |
| 2026-06-08 | API-format audit and adapter fixes | Verified OpenClaw env substitution, corrected Abstract Email Reputation and ImportYeti request formats, and made non-2xx paid/official API responses coverage gaps rather than scored evidence. |
| 2026-06-08 | SEC/Companies House country routing | Confirmed SEC no-key access and Companies House REST Basic-auth requirements, then added US -> SEC and GB -> Companies House API/public-page automatic Screening routing. |
| 2026-06-08 | Public adverse scoring gate | Diagnosed Mobile Lab's 86/high-risk mismatch, restricted public adverse downgrades to target-specific company/domain evidence, and confirmed Companies House API 401 remains a coverage-only key/account failure with official public-page fallback. |
| 2026-06-08 | Screening execution-path correction | Corrected the Screening UI so formal investigations are submitted to the real `cbe-buyer-screening` OpenClaw employee through Gateway/AgentChat instead of being generated directly by the Dashboard route. |
| 2026-06-08 | Screening employee-report visual mapping | Normalized employee-returned Screening JSON aliases into the Dashboard report model so evidence and missing-evidence details render in visual panels and survive refresh restore. |
| 2026-06-08 | Screening official-source and paid-email ordering | Added official-site same-domain email discovery before paid validation, SEC company-name lookup before US web fallback, and stricter GB Companies House / US SEC employee ordering. |
| 2026-06-08 | Lead execution-path correction | Corrected the Lead Discovery UI so formal lead generation is submitted to the real `cbe-lead-discovery` OpenClaw employee through Gateway/AgentChat instead of being generated directly by the Dashboard Tavily route. |
| 2026-06-08 | Milestone 6 Accio Memory employee and UI | Added `cbe-accio-memory`, Accio fixture sample route/UI, report preview flow, memory-write previews, Screening handoff payloads, and CE6/CE7 validation. |
| 2026-06-08 | Accio Memory execution-path correction | Removed Dashboard precomputed reports/highlights so sample upload waits for employee `ACCIO_SUMMARIES_JSON`; strengthened Accio summarizer coverage for all three fixture conversations. |
| 2026-06-13 | Production cloud/database/multi-agent operating plan | Added the production deployment design for database layout, OpenClaw/Sentura multi-agent concurrency, China-vs-US hosting, model API routing, and cloud sizing for 30-50 Shenzhen customer users. |
| 2026-06-13 | Alibaba International Station API access investigation | Investigated signed-seller API access, Alibaba Open API authorization flow, ICBU seller/customer/order/member APIs, and documented a read-only `icbu-openapi` Screening enhancement plan. |
| 2026-06-13 | Concurrent Lead Discovery dedupe design | Designed DB-backed run-scope dedupe, shared result pools, candidate identity uniqueness, and top-up-only reruns for overlapping multi-user Lead Discovery tasks. |
| 2026-06-13 | Cross-border design documentation reorganization | Split the monolithic design into shared platform design plus three agent-specific design/status/plan documents while preserving implemented and pending work. |
| 2026-06-13 | Employee role UI design | Added `跨境电商/UI.md` with Employee/Admin role split, Employee navigation, personal center, unified customer list, memory-record list, status colors, and hidden Agent task connection. |
| 2026-06-14 | Employee hidden task runner | Added non-visual hidden Gateway execution for the Employee customer/memory pages, with marker parsing for Lead, Screening, and Accio Memory results and no visible direct Agent chat. |
| 2026-06-14 | Employee UI readiness audit | Verified the Employee routes, hidden runner, Gateway registration, and config state; found cost RPC/startup plugin and live sandbox drift issues that blocked a production-ready claim. |
| 2026-06-15 | Employee demo repair pass | Reworked the Employee flow around selectable customer-search controls, dynamic estimates, clearer Chinese wording, and safe Browser smoke. |
| 2026-06-15 | Employee safe final verification | Confirmed startup plugins, hook permissions, live sandbox policy, Gateway RPCs, desktop/mobile Browser checks, and local tests; left live submit E2E unclicked pending explicit approval for external/LLM calls. |
| 2026-06-15 | User-approved live E2E sandbox blocker | User approved real submit calls; Lead submit created a Gateway session but failed before model/tool execution because Docker is missing while CBE employees are correctly set to `sandbox.mode: "non-main"`. |
| 2026-06-15 | Employee task progress persistence fix | Added ETA/countdown progress, cross-route task/customer state, global status bar, terminal failure visibility, and CE16 checks so Lead/Screening tasks do not disappear when the user navigates to `记忆整理`. |
| 2026-06-15 | Employee screenshot polish and filter fix | Removed duplicate customer-page progress notices, made `本月 API 成本` open per-call cost details, localized filter/display labels while preserving `USB-C`/`OLED`, fixed canonical filter matching and date-range drift, and raised CE16 checks to 315/315. |
| 2026-06-15 | Employee notification center and logo cleanup | Made the header bell a real CBE task notification center with a red unread badge and removed the duplicate standalone icon so the header keeps only `sentura-logo-side.svg`; raised CE16 checks to 317/317. |
| 2026-06-15 | Employee Lead/Screening parallel task gating | Split active-task gating into `leadRunning` and `screeningRunning`, allowing one active Lead and one active Screening task together while keeping same-kind duplicates blocked; task status can show both active cards; raised CE16 checks to 322/322. |
| 2026-06-16 | Employee Screening long-report timeout and Lead target-count fix | Diagnosed failed-looking Screening as frontend history truncation of a long JSON marker message; hidden runner now reads large `chat.history` payloads, Lead target count is manual numeric input, and Lead prompt/import logic treats `target_count` as the requested count; raised CE16 checks to 331/331. |
| 2026-06-16 | Employee repeated Screening timeout fix | Diagnosed a later `单个背调` failure as a real backend `LLM idle timeout (120s)` after tool calls, compacted SEC lookup output from full submissions JSON to bounded recent-filing summaries, surfaced backend transcript errors in the hidden runner, rebuilt/restarted the local demo, and raised CE16 checks to 335/335. |
| 2026-06-16 | Next-phase planning readout | Recommended starting the next phase with the tenant-scoped CBE business database and typed store layer, then replacing localStorage task/customer state, implementing Lead run-scope dedupe/shared-result coordination, and tuning the three employees against durable contracts. |
| 2026-06-16 | Phase 2 execution plan | Filled `跨境电商/PHASE-2.md` with the detailed production-hardening plan for DB schema/migrations, typed store/routes, Employee state migration, Lead coordinator, durable Screening/Accio workflows, backpressure/load smoke, implementation files, tests, and acceptance criteria; linked it from README/AGENTS/DESIGN and added CE17 coverage. |
| 2026-06-16 | Phase 2 user stratification | Added Admin/ordinary Employee/Auditor/Viewer role mapping on top of Sentura RBAC, admin-vs-ordinary permission boundaries, CBE profile/admin settings tables, row-level owner/department/visibility fields, UI/DESIGN/README/AGENTS sync, and CE17 coverage expansion. |
| 2026-06-16 | Phase 2 customer Admin monitoring redesign | Superseded the broad Sentura-RBAC-style CBE role plan with two customer-facing levels (`operator`, `admin`), made the existing Employee UI the ordinary-user surface, and constrained Admin to monitoring/live-task/aggregate/per-user/statistics views. |
| 2026-06-16 | Phase 2 P2.1 business database foundation | Implemented PostgreSQL migrations, migration runner, seed tenant/users/profiles, dashboard CBE role/module constants, and CE18 static/live DB verification against local `sentura_cbe_dev`. |

## 2026-06-07 — Phase-1 MVP design and API/tool plan

### Inputs read

- Sentura platform/progress: `README.md`, `docs/MEMORY.md`, `docs/TeamPlan.md`, `docs/TESTS.md`, and `docs/PLATFORM-DESIGN.md`.
- Client materials: `跨境电商/DESIGN.md` (blank at start) and `跨境电商/Sentura_跨境电商_Agent_商业汇报_v2.pdf`.
- Official docs/pricing pages for OpenClaw web/MCP/config behavior and low-cost search, registry, domain, email, trade-record, financial, and social API constraints.

### Customer facts captured

- Customer sells mobile-phone accessories for B2B cross-border export, primarily through Alibaba International / Accio-style conversations and overseas public channels.
- Target regions in the supplied deck: Europe, North America, and South America.
- Main pain points: buyer authenticity judgment is inconsistent, salespeople manually investigate every buyer, customer records are fragmented, and there is no quantitative risk score.
- Required employees: Marketing Acquisition, Screening/Background Investigation, and Accio Memory Processing.

### Decisions

- Keep this as an independent client lane, not TeamPlan work.
- Phase 1 uses normal OpenClaw embedded-agent workspaces, the 8 native workspace files, local stdio MCP wiring at `mcp.servers.cross-border-intel`, and sandbox tool allowlists. No custom runtime, gateway, or Docker wrapper.
- Marketing Acquisition is fully in Phase 1 and defaults to OpenClaw `web_search` / `web_fetch` with provider keys if available.
- Screening is Phase-1 low-cost only: public web search, RDAP/DNS, Companies House and SEC where applicable, optional Abstract/Hunter email validation, and optional capped Volza or ImportYeti evidence if the customer acquires keys.
- Accio Memory Processing is fully implemented against a simulated JSON fixture first; real upload can later use dashboard attachment or an operator drop folder.

### Files changed

- Wrote `跨境电商/DESIGN.md` with employee design, API/tool pricing, scoring model, OpenClaw/Sentura implementation plan, milestones, cost controls, safety rules, and source list.
- Added `跨境电商/fixtures/accio-chat-records.sample.json` with three simulated Accio conversations covering company identity, requested products, quantities, prices, terms, and follow-ups.
- Updated `AGENTS.md` and `README.md` so Cross-border e-commerce / 跨境电商 has its own memory/test classification.
- Updated `docs/MEMORY.md`, `docs/TESTS.md`, and the matching on-demand detail files.

### Follow-ups

- Implement `sentura/mcp-servers/cross-border-intel/` with fixture-first tests and budget guards.
- Create three employee workspaces: `cbe-lead-discovery`, `cbe-buyer-screening`, and `cbe-accio-memory`.
- Add an end-to-end smoke script that runs: keyword input -> lead list -> screening report -> Accio summary.

## 2026-06-08 — UI/manual-screening/contextual-scoring revision

### User request

The user asked to add three design corrections:

- Each employee needs its own UI like the Sitlink demo, with UI/UX matched to the human workflow.
- Screening must accept both Marketing-generated lead lists and manual company/email/domain/contact inputs.
- Scoring must be flexible: cold leads from Marketing have no behavior record, and demo scoring must adapt to the APIs actually available.

### Design changes

- Added `跨境电商/DESIGN.md §3.3` with three customer demo routes:
  - `/client-demos/cross-border/lead-discovery`
  - `/client-demos/cross-border/screening`
  - `/client-demos/cross-border/accio-memory`
- Added workflow-specific UI requirements for lead-run setup, lead table review, screening evidence timeline, manual screening form, contextual score/coverage panel, Accio upload/transcript view, extracted-fact preview, and memory-write preview.
- Updated Screening to support `manual_input` targets with company name, country, website/domain, email, contact person/title, social/profile URL, product interest, and notes.
- Replaced fixed PDF-weight Phase-1 scoring with contextual evidence blocks:
  - `conversation_behavior` is `not_applicable` for cold Marketing leads, not a zero-point penalty.
  - unavailable paid/API evidence becomes `unavailable_api` or `disabled_by_budget` and affects `evidence_coverage`, not normalized score.
  - reports show `normalized_score` and `evidence_coverage` separately.
  - risk tiers now include `trusted_candidate`, `cautious`, `insufficient_evidence`, and `high_risk`.
- Added Milestone 7 for UI surfaces and moved end-to-end smoke to Milestone 8.

### Tests updated

- `docs/TESTS.md` now tracks CE1 as PASS on 2026-06-08 and adds CE7 for the three demo UI routes.
- `docs/tests/tests-cross-border-ecommerce.md` now includes CE1.9-CE1.11 for UI/manual intake/demo feasibility, expanded CE5 for manual input and contextual scoring, expanded CE6 for memory UI preview, and added CE7 planned UI checks.

## 2026-06-08 — Milestone 2 shared ontology and schemas

### User request

The user asked to complete Milestone 2 strictly according to `跨境电商/DESIGN.md`, then check the result.

### Deliverables completed

- Added `sentura/config/industry-ontologies/cross-border-mobile-accessories/` with:
  - `assets/product-taxonomy.json5`
  - `rules/scoring-rules.json5`
  - `workflows/lead-discovery-sop.json5`
  - `workflows/buyer-screening-sop.json5`
  - `README.md`
- Added `sentura/lib/cross-border-ecommerce.ts` with Zod schemas for `LeadCandidate`, `ScreeningReport`, `AccioChatExport`, and `AccioChatSummary`, plus `InvestigationTarget`, score block/evidence schemas, and `calculateContextualScore`.
- Exported the schema module from `sentura/lib/index.ts` and `sentura/lib/package.json`.
- Added root `zod` dev dependency pinned to the existing root-compatible zod 4 line so the new script has an explicit dependency without downgrading the root MCP SDK peer.
- Added `scripts/test-cross-border-milestone2.ts`.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`; CE2 now tracks the full Milestone 2 scope instead of only the Accio fixture.

### Design invariants locked

- Product taxonomy includes the required mobile-accessory categories: phone cases, screen protectors, chargers, cables, mobile holders, power accessories, and repair accessories.
- Scoring rules use contextual evidence blocks, not a single fixed denominator.
- Cold Marketing leads set `conversation_behavior` to `not_applicable`, excluding it from score and coverage denominators.
- Disabled paid trade/financial APIs are `disabled_by_budget`: they reduce evidence coverage but do not reduce normalized score.
- Forced downgrade flags override otherwise good scores and return `high_risk`.

### Verification

- `python3 -m json.tool 跨境电商/fixtures/accio-chat-records.sample.json >/dev/null` — PASS.
- `npx tsx scripts/test-cross-border-milestone2.ts` — 39/39 PASS.
- `node openclaw/node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2023 --module NodeNext --moduleResolution NodeNext sentura/lib/cross-border-ecommerce.ts` — PASS.
- JSON5 parse smoke for all four new ontology JSON5 files — PASS.
- Full `sentura/lib` typecheck remains blocked by pre-existing package config issues: missing Node type declarations and existing `.ts` extension imports not accepted by the current `sentura/lib/tsconfig.json`. The new schema file was checked independently.

### Follow-ups

- Milestone 3 remains pending: implement `sentura/mcp-servers/cross-border-intel/` using these schemas and the contextual score helper.
- Milestones 4-7 remain pending: create the three employee workspaces and the three dashboard demo routes.

## 2026-06-08 — Milestone 3 `cross-border-intel` MCP server

### User request

The user asked to complete Milestone 3 strictly according to `跨境电商/DESIGN.md`, then check the result.

### Deliverables completed

- Added `sentura/mcp-servers/cross-border-intel/` with:
  - `package.json`
  - `tsconfig.json`
  - `vitest.config.ts`
  - `README.md`
  - `src/index.ts`
  - `src/config.ts`
  - `src/schemas.ts`
  - `src/tools.ts`
  - `src/server.test.ts`
- Implemented 9 MCP tools:
  - `cbe_intel_company_registry_search`
  - `cbe_intel_company_profile`
  - `cbe_intel_domain_rdap_lookup`
  - `cbe_intel_email_domain_check`
  - `cbe_intel_sec_lookup`
  - `cbe_intel_trade_record_search`
  - `cbe_intel_score_buyer`
  - `cbe_intel_parse_accio_chat`
  - `cbe_intel_summarize_accio_chat`
- All tools are read-only for Phase 1 and return `source_url`, `source_type`, `fetched_at`, and `confidence`.
- Config keeps optional paid adapters disabled unless keys and explicit budget flags exist. Missing paid keys disable only that adapter, not the MCP server.
- README documents API key setup, spend caps, `mcp.servers.cross-border-intel` wiring, and sandbox tool allowlist requirements.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`; CE3 is now PASS.

### Design invariants locked

- The server is a normal stdio MCP server using `@modelcontextprotocol/sdk` + `McpServer` + `StdioServerTransport`; no custom runtime, gateway, Docker wrapper, or OpenClaw core change.
- Companies House and SEC routes match the designed official-API behavior: Companies House uses `/search/companies` and `/company/{companyNumber}`; SEC pads numeric CIK to ten digits and sends a configured `User-Agent`.
- RDAP handles 200, 302, 404, and 429 explicitly.
- DNS/email checks cover MX, SPF, DMARC, free-provider, disposable-domain, and role-inbox signals without secrets.
- Contextual scoring preserves Milestone 2 behavior: `not_applicable` blocks leave score/coverage denominators; `disabled_by_budget` lowers coverage only; forced downgrades override score.
- Accio parsing/summarization works against the simulated fixture and extracts product, quantity, negotiated price, packaging add-on, next actions, and behavior signals.

### Verification

- `pnpm --filter @sentura/mcp-cross-border-intel test` — 12/12 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel build` — PASS.

### Follow-ups

- Milestones 4-7 remain pending: create the three employee workspaces and the three dashboard demo routes.
- Future live integration can run `openclaw mcp probe cross-border-intel` after the server is built and registered in `mcp.servers.cross-border-intel`.

## 2026-06-08 — API key and OpenClaw setup runbook

### User request

The user asked to write a file under `跨境电商/` explaining the detailed acquisition flow for every API key and how to connect those keys to OpenClaw, especially the OpenClaw onboard flow and what happens after `scripts/sentura-setup`.

### Deliverables completed

- Added `跨境电商/API_KEYS_OPENCLAW_SETUP.md`.
- Covered the OpenClaw source build/onboard flow:
  - `pnpm install`
  - `pnpm ui:build`
  - `OPENCLAW_A2UI_SKIP_MISSING=1 pnpm build`
  - `pnpm openclaw onboard`
  - `pnpm gateway:watch`
- Covered what `scripts/sentura-setup.sh` / `scripts/sentura-setup.ps1` do and do not do. This section was later revised in the same date's setup-wiring session after `cross-border-intel` registration moved into setup.
- Documented key acquisition and usage for:
  - model provider keys
  - `BRAVE_API_KEY`
  - `TAVILY_API_KEY`
  - `COMPANIES_HOUSE_API_KEY`
  - `OPENCORPORATES_API_KEY`
  - `ABSTRACT_API_KEY`
  - `HUNTER_API_KEY`
  - `VOLZA_API_KEY`
  - `IMPORTYETI_API_KEY`
  - `SEC_USER_AGENT`
  - RDAP/DNS no-key routes
  - CBE paid-data budget env vars
- Documented `~/.openclaw/.env` as the key location and avoided repo-local secret storage.
- Documented the original `mcp.servers.cross-border-intel` JSON5 and `openclaw mcp set` examples. This was superseded later the same day by Sentura setup-driven MCP wiring using `${ENV_VAR}` references.
- Documented verification commands:
  - `pnpm --filter @sentura/mcp-cross-border-intel build`
  - `pnpm --filter @sentura/mcp-cross-border-intel test`
  - `openclaw mcp status --verbose`
  - `openclaw mcp doctor cross-border-intel --probe`
  - `openclaw mcp probe cross-border-intel`
- Added sandbox allowlist examples for later `cbe-*` employees.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`; CE8 is now PASS.

### Verification

- Manual review against `跨境电商/DESIGN.md`, `sentura/mcp-servers/cross-border-intel/README.md`, `docs/SETUP.md`, and current OpenClaw/third-party API docs.
- `rg -n "OpenClaw Onboard|COMPANIES_HOUSE_API_KEY|mcp.servers.cross-border-intel|cross-border-intel__\\*|CBE_ENABLE_PAID_TRADE_DATA" 跨境电商/API_KEYS_OPENCLAW_SETUP.md` — key sections present.

### Follow-ups

- When Milestones 4-6 create the three `cbe-*` employees, use the runbook's sandbox allowlist and MCP connection sections as the operator-facing setup instructions.

## 2026-06-08 — Sentura setup owns cross-border MCP wiring

### User request

The user clarified that they manually configured these env vars and that MCP should not require entering OpenClaw config directly:

- `TAVILY_API_KEY`
- `COMPANIES_HOUSE_API_KEY`
- `ABSTRACT_API_KEY`
- `HUNTER_API_KEY`
- `IMPORTYETI_API_KEY`
- `SEC_USER_AGENT`
- `CBE_ENABLE_PAID_TRADE_DATA`
- `CBE_MAX_PAID_SPEND_USD`
- `CBE_INTEL_REQUEST_TIMEOUT_MS`

They specifically asked for `cross-border-intel` MCP wiring to happen through Sentura's setup file.

### Deliverables completed

- Updated `scripts/sentura-setup.sh`:
  - reads current process env and `~/.openclaw/.env`;
  - writes `config.mcp.servers['cross-border-intel']`;
  - uses `command: "node"`, absolute compiled `dist/index.js`, project-root `cwd`, env block, and `requestTimeoutMs`;
  - writes API-key entries as `${ENV_VAR}` references when the env var exists;
  - omits missing optional API-key entries to avoid OpenClaw config-load failures;
  - writes non-secret defaults for `SEC_USER_AGENT`, `CBE_ENABLE_PAID_TRADE_DATA`, `CBE_MAX_PAID_SPEND_USD`, and `CBE_INTEL_REQUEST_TIMEOUT_MS`;
  - at that point, logged `TAVILY_API_KEY` for OpenClaw `web_search` auto-detection and not as MCP env; later Milestone 4 live-data correction also uses Tavily from the Dashboard live search route.
- Mirrored the same behavior in `scripts/sentura-setup.ps1`.
- Updated `跨境电商/API_KEYS_OPENCLAW_SETUP.md` so the main path is:
  1. OpenClaw onboard;
  2. write env vars;
  3. build `cross-border-intel`;
  4. rerun Sentura setup;
  5. verify with `openclaw mcp status/doctor/probe`.
- Updated `跨境电商/DESIGN.md`, `sentura/mcp-servers/cross-border-intel/README.md`, and `docs/SETUP.md` so global MCP setup uses OpenClaw `${ENV_VAR}` config substitution, not `$secret:` markers or manual `openclaw mcp set`.
- Added CE9 to `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- `bash -n scripts/sentura-setup.sh` — PASS.
- Static `rg` checks found `cross-border-intel`, `buildCrossBorderIntelEnv`, the configured env keys, and `TAVILY_API_KEY` handling in both setup scripts.
- Static docs check confirmed no remaining `openclaw mcp set cross-border-intel` instruction and no `$secret:` cross-border global MCP examples.

### Follow-ups

- After the operator reruns `./scripts/sentura-setup.sh`, run `openclaw mcp status --verbose` and `openclaw mcp doctor cross-border-intel --probe`.
- If the probe fails because `dist/index.js` is missing, run `pnpm --filter @sentura/mcp-cross-border-intel build` and rerun setup.

## 2026-06-08 — MCP doctor warning clarification

### User request

The user ran:

```bash
pnpm openclaw mcp doctor cross-border-intel --probe
```

The output showed `cross-border-intel: ok` plus warnings that several `env.*API_KEY` entries contained literal sensitive values. The user asked whether any adjustment was needed and whether this would affect actual operation.

### Finding

- `cross-border-intel: ok` means OpenClaw can load the saved MCP definition and the live probe succeeds.
- The actual `~/.openclaw/openclaw.json` still stores API keys as `${ENV_VAR}` placeholders.
- OpenClaw config loading resolves `${ENV_VAR}` into runtime values before doctor runs its sensitive-value heuristic, so doctor can warn about literal sensitive runtime values even when the on-disk config is still placeholder-backed.
- `sentura-memory-lancedb.config.embedding.apiKey` missing `OPENAI_API_KEY` is unrelated to `cross-border-intel`; the same output shows that plugin disabled while `memory-core` is active, so it does not block this MCP route.

### Deliverables completed

- Added a troubleshooting section to `跨境电商/API_KEYS_OPENCLAW_SETUP.md` explaining the warning and providing a redaction-safe Node snippet that prints only `placeholder` vs `literal`.
- Updated CE8 in `docs/TESTS.md` from 10 to 11 review checks.
- Added CE8.11 to `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- Redaction-safe local config inspection showed `COMPANIES_HOUSE_API_KEY`, `ABSTRACT_API_KEY`, `HUNTER_API_KEY`, and `IMPORTYETI_API_KEY` are stored as placeholders.

### Follow-ups

- No code change is required for the warning. If a future OpenClaw doctor exposes source-preserved env-substitution metadata, setup docs can be simplified.

## 2026-06-08 — Milestone 4 Marketing Acquisition employee

### User request

The user asked to complete Milestone 4 strictly according to `跨境电商/DESIGN.md`, then check the result.

### Deliverables completed

- Added `sentura/agents/cbe-lead-discovery/` with exactly the 8 native OpenClaw workspace files:
  - `AGENTS.md`
  - `SOUL.md`
  - `TOOLS.md`
  - `IDENTITY.md`
  - `USER.md`
  - `HEARTBEAT.md`
  - `BOOTSTRAP.md`
  - `MEMORY.md`
- Added `sentura/agents/cbe-lead-discovery/config.json5`:
  - id/name/model/runtime for `cbe-lead-discovery`;
  - `sandbox.mode = "non-main"`;
  - normal allowlist for `web_search`, `web_fetch`, `cron`, and `group:plugins`;
  - sandbox allowlist for `web_search`, `web_fetch`, `cron`, and `cross-border-intel__*`;
  - denies shell, filesystem mutation, gateway, messaging, subagent, and session-spawn tools;
  - pins OpenAI models to `agentRuntime.id: "openclaw"`.
- Added four Milestone 4 skills:
  - `lead-query-generation/SKILL.md`;
  - `lead-deduplication/SKILL.md`;
  - `lead-list-production/SKILL.md`;
  - `handoff-to-screening/SKILL.md`.
- Updated `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1`:
  - added `cbe-lead-discovery` to the client-demo workspace copy/stamp/register list;
  - applied the same tool/runtime override used by source config;
  - added the webchat binding for `cbe-lead-discovery`.
- Added `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`:
  - dense operational workbench layout;
  - keyword/persona/country run builder;
  - deduplicated lead table with source count, confidence, duplicate status, and demo/live source label;
  - source/evidence/dedupe panel with source URLs, query strings, source type, and timestamps;
  - paid/unavailable source locks;
  - real `AgentChat` session targeting `cbe-lead-discovery`;
  - selected-lead typed handoff preview for `cbe-buyer-screening`.
- Added sidebar route entry `CBE Leads`.
- Added `scripts/test-cross-border-agents.ts` with CE4 offline checks.
- Updated `跨境电商/DESIGN.md`, `跨境电商/API_KEYS_OPENCLAW_SETUP.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Design invariants locked

- Workspace top-level Markdown remains exactly the 8 native OpenClaw files.
- Phase 1 still uses normal OpenClaw employee workspaces and setup-driven `mcp.servers.cross-border-intel`; no custom runtime/gateway/Docker wrapper was added.
- Marketing Acquisition does not send outreach. It returns lead lists, audit sources, and handoff payloads only.
- Public search/fetch remains the default discovery path; `cross-border-intel` is allowed only as a light enrichment tool in this employee.
- The lead UI uses demo-fixture table data for customer review and a real `AgentChat` surface for the employee. Live web-search/tool results require a running OpenClaw Gateway and configured web-search provider.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 93/93 PASS.
- `bash -n scripts/sentura-setup.sh` — PASS.
- `python3 -m json.tool 跨境电商/fixtures/accio-chat-records.sample.json >/dev/null` — PASS.
- `npx tsx scripts/test-cross-border-milestone2.ts` — 39/39 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel test` — 12/12 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel build` — PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `cd sentura/dashboard && pnpm build` — PASS, with `/client-demos/cross-border/lead-discovery` generated.
- Browser verification against `http://localhost:3001/client-demos/cross-border/lead-discovery` — route rendered, key workbench regions were visible, and filtering console errors after a fresh load showed no new errors.
- `git diff --check` — PASS.
- `pwsh` was not installed locally, so PowerShell setup syntax could not be parser-checked live; CE4 static checks verified the PowerShell setup script contains the new client-demo copy, webchat binding, MCP sandbox glob, and cron allowlist entries.

### Follow-ups

- Milestone 5 remains pending: create `cbe-buyer-screening` and connect the handoff preview to a real Screening workflow.
- Milestone 6 remains pending: create `cbe-accio-memory`.
- Milestone 7 remains pending for the full three-route demo suite; CE4 covers only the lead-discovery route.

## 2026-06-08 — Milestone 4 live-data correction

### Trigger

The user clarified that `TAVILY_API_KEY`, `COMPANIES_HOUSE_API_KEY`, `ABSTRACT_API_KEY`, `HUNTER_API_KEY`, `IMPORTYETI_API_KEY`, `SEC_USER_AGENT`, `CBE_ENABLE_PAID_TRADE_DATA`, `CBE_MAX_PAID_SPEND_USD`, and `CBE_INTEL_REQUEST_TIMEOUT_MS` had been manually configured and the workflow should use real sources instead of simulated lead data.

### Changes

- Added `sentura/dashboard/src/app/api/client-demos/cross-border/lead-discovery/run/route.ts`.
  - Calls `POST https://api.tavily.com/search` with `Authorization: Bearer ${TAVILY_API_KEY}`.
  - Reads env from the Dashboard process first and falls back to `~/.openclaw/.env`.
  - Returns only redacted provider status (`configured`, `enabled`, source, timeout, budget cap), never API key values.
  - Builds mobile-accessory buyer queries, applies domain exclusions, dedupes by normalized domain, and emits source-audited `LeadCandidate` records with `source_label: "实时查询"`.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`.
  - Removed the baked-in `sampleLeads` fixture and all `.example` candidate rows.
  - Initial table is empty; clicking `开始获客搜索` calls the live API route and then best-effort sends a redacted result summary to the real `cbe-lead-discovery` AgentChat.
  - Replaced the old locked-source panel with live source status for Tavily, Companies House, Abstract/Hunter, ImportYeti, SEC, and paid trade-data budget state.
- Updated `scripts/test-cross-border-agents.ts` to lock the live route behavior and absence of sample leads.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 102/102 PASS.
- `bash -n scripts/sentura-setup.sh` — PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- Minimal live Tavily smoke through the route function — PASS: HTTP 200, 1 query, 1 deduped candidate, env detected from `~/.openclaw/.env`, no secret values printed.
- `cd sentura/dashboard && pnpm build` — PASS; Next generated the dynamic `/api/client-demos/cross-border/lead-discovery/run` route.
- Browser check against `http://localhost:3001/client-demos/cross-border/lead-discovery` — PASS for live badge and empty live-table state; no sample text or `.example` domains. The only console error was the expected AgentChat WebSocket refusal while the OpenClaw Gateway was not running.

## 2026-06-08 — Milestone 4 company-buyer filtering correction

### Trigger

The user observed that live search results were returning public information websites such as Facebook or generic wholesale pages rather than specific customer companies. The correct Marketing Acquisition target is a concrete company whose business content relates to mobile accessories, phone repair, electronics retail, accessory retail, reseller/import buying, or phone-store operations and that may need to buy from mobile-accessory wholesalers.

### Changes

- Updated `sentura/dashboard/src/app/api/client-demos/cross-border/lead-discovery/run/route.ts`.
  - Default personas now target downstream buyers: mobile phone repair chains, electronics retailers, and cell phone accessories retailers.
  - Query templates now use natural company/buyer terms instead of negative-operator-heavy searches that degraded Tavily relevance.
  - Added hard blocked domains for social platforms, business directories, marketplaces, supplier directories, public company-info pages, review sites, and generic lead databases.
  - Added candidate rejection logic for non-company source pages, supplier/manufacturer/exporter/OEM/ODM pages, generic wholesale-list pages, and pages missing mobile-accessory plus buyer-business signals.
  - Improved company-name extraction so generic titles like `Contact` or payment-provider text fall back to the candidate domain brand.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`.
  - Default buyer chips now select repair chains, electronics retailers, and accessory retailers.
  - Added downstream buyer personas such as accessory retailer, phone store, reseller buyer, and importer buyer.
  - Updated the AgentChat prompt and empty-table copy to say only company-owned website candidates should be retained.
- Updated `lead-query-generation/SKILL.md` and `lead-list-production/SKILL.md` so the employee no longer treats Facebook, LinkedIn, directories, marketplaces, supplier directories, or generic wholesale pages as leads.
- Updated `scripts/test-cross-border-agents.ts`, `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 110/110 PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `bash -n scripts/sentura-setup.sh` — PASS.
- `git diff --check` — PASS.
- Minimal live Tavily smoke through the route function — PASS: HTTP 200, 2 queries, 3 company-level candidates. Returned domains were `wavecase.co.uk`, `vendulalondon.com`, and `mobilelab.co.uk`; social/directory/generic wholesale pages were not retained.
- `cd sentura/dashboard && pnpm build` — PASS; dynamic route remained generated.
- Browser check against `http://localhost:3001/client-demos/cross-border/lead-discovery` — PASS for live badge, company-website empty-table copy, downstream buyer persona chips, no old wholesaler default, no demo data, and no `.example` domains. The only console error was the expected AgentChat WebSocket refusal while OpenClaw Gateway was not running.

## 2026-06-08 — Milestone 4 lead UI simplification

### Trigger

The user asked to remove the query log, Screening handoff package, Marketing employee conversation, and realtime tool panels. They also asked to make the source/dedupe section part of the candidate buyer table, automatically expand it when the `查看` button is clicked, and extend the table to fill the right-side workspace.

### Changes

- Updated `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`.
  - Removed the `AgentChat` import, chat session state, chat prompt sending, tool-event state, query-log rendering, selected-lead state, and Screening handoff preview rendering.
  - Changed the page from a three-column layout to `xl:grid-cols-[280px_minmax(0,1fr)]`, leaving the run builder on the left and the candidate buyer table to fill the remaining right-side workspace.
  - Added `expandedLeadId` so the table's `查看` icon toggles an inline detail row below the selected lead.
  - Moved `来源与去重` into that expanded table row, including `dedupe_key`, `created_at`, `dedupe_explanation`, source type, fetched timestamp, source URL, excerpt, and originating query.
  - Kept the real Tavily API workflow and redacted live-source status in the run builder.
- Updated `scripts/test-cross-border-agents.ts`.
  - Added static checks that the old panels are absent.
  - Added checks for the two-column full-width layout and inline expandable source/dedupe table row.
  - Adjusted the CE4 total from 110 checks to 107 checks.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md` to make the simplified table workflow the current Milestone 4 acceptance contract.
- Restored `sentura/dashboard/next-env.d.ts` after `next build` rewrote it to production route types.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 107/107 PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `cd sentura/dashboard && pnpm build` — PASS; Next produced the expected dynamic lead-discovery API route.
- Browser check against `http://localhost:3001/client-demos/cross-border/lead-discovery` — PASS for live badge, source status, candidate buyer table, old panel removal, company-owned website empty-state copy, and no browser console errors. Screenshot captured at `/tmp/cbe-lead-discovery-simplified.png`.

## 2026-06-08 — Milestone 5 Screening employee and live background investigation

### User request

The user asked to complete Milestone 5 strictly according to `跨境电商/DESIGN.md`, using the already configured live API env vars for real background investigation:

- `TAVILY_API_KEY`
- `COMPANIES_HOUSE_API_KEY`
- `ABSTRACT_API_KEY`
- `HUNTER_API_KEY`
- `IMPORTYETI_API_KEY`
- `SEC_USER_AGENT`
- `CBE_ENABLE_PAID_TRADE_DATA`
- `CBE_MAX_PAID_SPEND_USD`
- `CBE_INTEL_REQUEST_TIMEOUT_MS`

They also emphasized flexible real-time scoring.

### Deliverables completed

- Added `sentura/agents/cbe-buyer-screening/` with exactly the 8 native OpenClaw workspace files plus `config.json5`.
- Added the six Milestone 5 skills:
  - `evidence-collection/SKILL.md`
  - `registry-verification/SKILL.md`
  - `domain-email-verification/SKILL.md`
  - `trade-record-check/SKILL.md`
  - `buyer-scoring/SKILL.md`
  - `report-writing/SKILL.md`
- Configured the Screening employee with:
  - OpenClaw embedded runtime and model runtime pin;
  - `sandbox.mode = "non-main"`;
  - read-only allowlist for `web_search`, `web_fetch`, `memory_search`, `memory_get`, and `group:plugins`;
  - sandbox allowlist for `cross-border-intel__*`;
  - dangerous tool denials, including shell, filesystem mutation, gateway, external messaging, sessions/subagents, and uncapped paid lookups.
- Updated `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` to copy/stamp/register `cbe-buyer-screening`, apply the same runtime/tool overrides, and add a webchat binding.
- Enhanced `cross-border-intel`:
  - `cbe_intel_email_domain_check` now calls both Abstract and Hunter when `enable_paid_validation=true` and keys exist, without echoing keys.
  - ImportYeti default base URL is now `https://data.importyeti.com`, using `GET /v1.0/company/search`.
  - MCP tests now cover 14 cases.
- Added `/api/client-demos/cross-border/screening/run`:
  - reads env from the Dashboard process or `~/.openclaw/.env`;
  - returns only redacted provider status;
  - calls Tavily, Companies House, RDAP/DNS, Abstract, Hunter, ImportYeti with budget controls, and SEC EDGAR when CIK is supplied;
  - normalizes manual and Marketing lead targets into one `InvestigationTarget` shape;
  - produces evidence items with source type, URL, timestamp, confidence, cost, score block, and score impact;
  - computes contextual normalized score and evidence coverage separately;
  - marks unavailable/disabled evidence as coverage gaps and excludes `not_applicable` behavior from denominators.
- Added `/client-demos/cross-border/screening`:
  - batch `LeadCandidate[]` intake and manual investigation form;
  - source/budget toggles for Abstract/Hunter and ImportYeti;
  - investigation queue;
  - evidence timeline grouped by legal registry, domain/email, public footprint, trade/customs, financial/public filing, and behavior;
  - score/report panel with normalized score and evidence coverage separated;
  - missing/unavailable evidence panel;
  - JSON report export;
  - real `AgentChat` targeting `cbe-buyer-screening`.
- Added sidebar navigation entry `CBE Screening`.
- Updated `跨境电商/DESIGN.md`, `sentura/mcp-servers/cross-border-intel/README.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 196/196 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel test` — 14/14 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel build` — PASS.
- `bash -n scripts/sentura-setup.sh` — PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- Live Screening route smoke — PASS:
  - HTTP 200.
  - Redacted env status showed Tavily, Companies House, Abstract, Hunter, ImportYeti, and SEC configured/enabled where applicable.
  - Returned one report with 12 evidence items across Companies House, DNS/RDAP, Abstract, Hunter, Tavily, ImportYeti, and SEC EDGAR; behavior evidence was `not_applicable` for the cold manual smoke.

### Notes

- The live smoke used a manual target with `sec_cik` so SEC EDGAR was exercised. No secret values were printed.
- CE7 remains pending because the Accio Memory UI is still future work, but CE4 now covers the lead UI and CE5 covers the Screening UI.

## 2026-06-08 — Lead-to-Screening copy and state persistence

### Trigger

The user asked to add a one-click copy button to the CBE Lead page, add a copy button for every search result, align the copied format with Screening input, and keep both Lead and Screening page state/results after refresh or route navigation.

### Changes

- Updated `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`.
  - Added a table-header `一键复制到背调` action for all current candidates.
  - Added a per-row copy icon action next to `查看`.
  - Copy output is `{"leads":[...]}` and includes the fields Screening already normalizes: `company_name`, `website`, `domain`, `country`, `matched_products`, `contact_candidates`, source URLs/evidence, dedupe data, confidence, and timestamps.
  - Added best-effort clipboard fallback for browsers where `navigator.clipboard.writeText` is unavailable.
  - Persisted run configuration, env status, run message, expanded row id, and returned leads under same-origin local storage key `sentura:cbe:lead-discovery:v1`.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`.
  - Persisted batch/manual input, source toggles, budget, env status, run message/status, selected report id, and generated reports under same-origin local storage key `sentura:cbe:screening:v1`.
  - Running states restore as idle with a re-run prompt; completed/error states and reports restore as-is.
- Updated `scripts/test-cross-border-agents.ts` with CE4/CE5 checks for copy payloads and state persistence.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- Inspected the supplied `screen-screen-target-lead-lead-run-2026-06-08-live-0003-1780888601425.json`: it was generated before this fix and is not a trustworthy final score because Companies House no-match and ImportYeti HTTP 401 were still represented as scored evidence with no missing-evidence gap.
- `npx tsx scripts/test-cross-border-agents.ts` — 202/202 PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- Browser check against `http://127.0.0.1:3001/client-demos/cross-border/lead-discovery` — PASS: a small live Tavily run returned 2/3 candidates; per-row copy produced `{"leads":[...]}` with one copied candidate; refresh retained the lead table and ready state.
- Browser check against `http://127.0.0.1:3001/client-demos/cross-border/screening` — PASS: pasted copied Lead payload into batch mode, disabled paid source toggles for the test run, completed a live Screening run, refreshed, and the report/score remained visible. Browser console had no errors.

## 2026-06-08 — API-format audit and adapter fixes

### Trigger

The user supplied screenshots showing configured Companies House and Abstract keys and asked why the already configured API keys were not being called normally. The audit focused on OpenClaw key loading, `~/.openclaw/.env`, `~/.openclaw/openclaw.json`, and current provider API documentation.

### Findings

- `~/.openclaw/.env` contains the expected CBE variables, and `~/.openclaw/openclaw.json` stores `cross-border-intel` MCP env values as `${ENV_VAR}` references.
- OpenClaw loads `.env` before config resolution and resolves the MCP env references to actual runtime values. The Dashboard Screening route also reads `~/.openclaw/.env`, but its env cache means a running Dashboard process must be restarted after changing keys.
- Companies House request formatting is already the official API-key Basic-auth format. A live probe still returned `401 Invalid Authorization`, so the remaining issue is key/account validity or the specific key copied into `.env`, not the code format.
- The Abstract key shown by the user is for Abstract Email Reputation. The previous adapter used the older Email Validation endpoint, causing `401` even with a real key.
- Hunter request formatting matches the documented `email-verifier` query-param API. The configured account returned `429 restricted_account`, which is an account/billing/restriction state, not a parameter-format bug.
- ImportYeti current docs use `GET /v1.0/company/search` with `name` and `page_size` query params and the `IYApiKey` header. The previous adapter used `Authorization: Bearer` plus `q`, which caused `401`.

### Changes

- Updated `sentura/mcp-servers/cross-border-intel/src/config.ts` to default Abstract to `https://emailreputation.abstractapi.com/v1/`.
- Updated `sentura/mcp-servers/cross-border-intel/src/tools.ts`:
  - Abstract evidence now points to the Email Reputation docs.
  - ImportYeti search now calls `/v1.0/company/search?name=...&page_size=...` with `IYApiKey`.
- Updated the Screening Dashboard API route:
  - Abstract now calls Email Reputation and parses `email_deliverability`, `email_quality`, and risk fields.
  - ImportYeti now uses the documented company-search route and `IYApiKey`.
  - Companies House, Abstract, Hunter, ImportYeti, and SEC non-2xx responses are represented as `unavailable_api` coverage gaps when appropriate, with `affects_score: false`, instead of being treated as matched evidence or fraud signals.
- Updated tests and docs: `scripts/test-cross-border-agents.ts`, MCP Vitest cases, `sentura/mcp-servers/cross-border-intel/README.md`, `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Live API-format probes

- Tavily: HTTP 200.
- SEC EDGAR: HTTP 200 with configured `SEC_USER_AGENT`.
- Abstract Email Reputation: HTTP 200 against `emailreputation.abstractapi.com/v1`, with deliverability/quality fields returned.
- ImportYeti: HTTP 200 against the documented company-search route with `IYApiKey`.
- Companies House: HTTP 401 `Invalid Authorization` even with official Basic-auth formatting.
- Hunter: HTTP 429 `restricted_account`.

No secret values were printed in logs or docs. Because screenshots exposed live-looking API keys in the chat, those provider keys should be rotated before production use.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 200/200 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel test` — 14/14 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel build` — PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `cd sentura/dashboard && pnpm build` — PASS; Next generated both cross-border API routes and pages.
- Minimal live API-format probe — Tavily 200, SEC 200, Abstract Email Reputation 200, ImportYeti 200, Companies House 401 `Invalid Authorization`, Hunter 429 `restricted_account`.
- `git diff --check` — PASS.

## 2026-06-08 — SEC/Companies House country routing

### Trigger

The user asked to re-check the official SEC Developer Resources and Companies House API overview/authentication pages, determine whether either source can be used without an API key, confirm the correct API-key format when needed, and ensure copied lead lists automatically call SEC for US companies and Companies House for UK companies during Screening.

### Official-doc conclusions

- SEC EDGAR public data does not use an API key. The official developer page documents JSON APIs on `data.sec.gov`, EDGAR index files, and a fair-access limit of no more than 10 requests/sec. The implementation uses a descriptive `User-Agent`, resolving company name/ticker through `https://www.sec.gov/files/company_tickers.json` and then calling `https://data.sec.gov/submissions/CIK##########.json`.
- Companies House REST API requires authentication credentials on each request. The correct API-key format is HTTP Basic auth with the API key as the username and a blank password: `Authorization: Basic base64(API_KEY + ":")`, equivalent to `curl -u API_KEY:`.
- Companies House has a no-key official public website path at `https://find-and-update.company-information.service.gov.uk/search/companies?q=...`; it is HTML, not a REST JSON API. It is acceptable as a low-volume official registry-page fallback and is marked as `official_registry_page`, not `official_api`.

### Changes

- Updated the Screening route:
  - `country=US` now automatically resolves SEC CIK from company name/ticker and uses SEC submissions without any API key.
  - SEC evidence now contributes to `legal_identity` through the company ticker/CIK mapping and to `trade_financial` through submissions when a CIK is resolved.
  - `country=GB` uses Companies House REST API first. If the key is missing or rejected, it falls back to the official public Companies House search page.
  - Companies House API non-2xx remains coverage-only and does not score; the public-page fallback can score separately if a candidate is found.
  - Lead and Screening source-status UI now states SEC requires no API key, using configured `SEC_USER_AGENT` when present and a default User-Agent otherwise.
- Updated static tests to lock:
  - Companies House public official-page fallback;
  - SEC no-key status;
  - US company-name -> CIK auto resolution;
  - preserved non-2xx coverage-gap behavior.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Live route smoke

- Directly invoked `/api/client-demos/cross-border/screening/run` with copied-list shaped targets:
  - US `Apple Inc.`: SEC `company_tickers.json` returned `AAPL` / CIK `0000320193`, and SEC submissions returned HTTP 200. `legal_identity` and `trade_financial` both scored with official SEC evidence.
  - GB `Mobile Lab`: Companies House API returned HTTP 401 using the official Basic-auth format, then the public official search page returned HTTP 200 and found `MOBILE LAB LTD (08770672)`. The API 401 remained coverage-only; the official public-page result carried the scored registry evidence.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 205/205 PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.

## 2026-06-08 — Public adverse scoring gate

### Trigger

The user supplied `/Users/henry/Desktop/screen-screen-target-lead-lead-run-2026-06-08-live-0003-1780891762117.json` and asked why a report with score 86 was still `high_risk`, and why Companies House API was still returning 401 even though web search returned the correct company.

### Findings

- The report's `score_debug.forced_downgrades` contained three `public_adverse_result:*` entries from generic scam/fraud information pages returned by the query `Mobile Lab fraud scam complaint customs GB`.
- Those pages did not identify Mobile Lab or `mobilelab.co.uk`; they were general Ofcom/Citizens Advice/social scam-warning results. The old public-footprint logic treated any result containing `fraud`, `scam`, or `complaint` as adverse evidence without first checking target relevance.
- Companies House API still returned HTTP 401 `Invalid Authorization` for both search and company-profile probes while using the official Basic-auth format. The configured key is present and UUID-like, so the remaining issue is key/account validity or an un-restarted process using an older value, not the request format.
- The official Companies House public search page returned HTTP 200 and found `MOBILE LAB LTD (08770672)`, so the registry fallback is working and scores separately from the failed API call.

### Changes

- Updated `sentura/dashboard/src/app/api/client-demos/cross-border/screening/run/route.ts` so public adverse keywords only affect scoring when the search result is target-specific:
  - result domain matches the target domain; or
  - result text includes the normalized target company name.
- Generic scam/complaint pages are now `score_impact: "coverage_only"`, `affects_score: false`, and cannot create `public_adverse_result:*` forced downgrades.
- Product-fit signals from public search are likewise gated to target-specific evidence instead of generic pages.
- Added `scripts/test-cross-border-agents.ts` static coverage for target-relevant public adverse scoring and updated CE5.16.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 206/206 PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- Live route smoke for `Mobile Lab`, `country=GB`, `domain=mobilelab.co.uk` — HTTP 200; score `84.44`, evidence coverage `0.9`, `risk_tier=trusted_candidate`, `forced_downgrades=[]`.
- Live route smoke kept Companies House API as `raw_status=401`, `score_impact=coverage_only`, `affects_score=false`; Companies House public search returned `raw_status=200`, found `MOBILE LAB LTD (08770672)`, and contributed positive registry evidence.

## 2026-06-08 — Screening execution-path correction

### Trigger

The user challenged the implementation after running `scripts/sentura-setup` and observing that results were the same before and after setup. They correctly pointed out that, before setup, the `cbe-buyer-screening` employee was not registered, so a claimed "employee completed investigation" could not have been true.

### Finding

- `/client-demos/cross-border/screening` was generating reports by directly calling the Dashboard Route Handler `/api/client-demos/cross-border/screening/run`.
- That route was not mock data: it performed real provider calls and adapter diagnostics. However, it bypassed OpenClaw employee execution, so it did not prove the Screening employee was doing the work.
- The right-side `AgentChat` was present but only as an adjacent chat/review surface. The formal run button did not submit the task to `cbe-buyer-screening`.
- The static test suite had the wrong invariant: it required `fetch("/api/client-demos/cross-border/screening/run")`, which locked in the bypass.

### Changes

- Updated `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`:
  - imports Gateway/AgentChat primitives and checks `useAgent("cbe-buyer-screening")`;
  - changes the run button to `让背调员工开始调查`;
  - fails visibly if Gateway is disconnected or the employee is not registered;
  - submits a structured hidden task to `cbe-buyer-screening` through `AgentChatHandle.sendMessage`;
  - tracks employee tool-call progress through `onToolCall`;
  - parses employee output between `SCREENING_REPORTS_JSON_START` and `SCREENING_REPORTS_JSON_END` into the report panels;
  - persists the employee session key along with the last input/report state.
- Kept `/api/client-demos/cross-border/screening/run` as a live provider adapter/diagnostic route, not the formal dashboard execution path.
- Updated `scripts/test-cross-border-agents.ts` so CE5 now asserts the page does not directly fetch the route for official report generation and instead triggers `cbe-buyer-screening` through AgentChat/Gateway.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md` to record the corrected execution contract.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 206/206 PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.

## 2026-06-08 — Screening employee-report visual mapping

### Trigger

The user ran the corrected real `cbe-buyer-screening` employee path and received a much stronger CPR Cell Phone Repair investigation. The employee chat contained a valid `SCREENING_REPORTS_JSON_START/END` report with 12 evidence records, but the Dashboard evidence timeline still showed every visual evidence group as `0 条`, and the missing-evidence panel showed statuses without details.

### Finding

- The employee returned a valid report, but its field names followed the employee/MCP output style: `source_url`, `summary`, `detail`, `source_type=official_web`, `source_type=registry_tool`, `score_impact=coverage_gap`, and `target_source=marketing_lead_batch`.
- The Dashboard visual model expected `url`, `finding`, `recommended_next_step`, a precomputed `layer`, and a narrower target-source union. Because the page did not normalize those aliases before grouping, evidence existed in JSON but did not populate the visual timeline.
- Stored reports from local storage also bypassed normalization on refresh, so a previously stored employee-shaped report could continue rendering as empty even after parser fixes.

### Changes

- Updated `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`:
  - added report normalization for employee-returned aliases before rendering;
  - maps score blocks and source URLs into visual layers such as legal registry, domain/email, public footprint, trade/customs, and SEC/public filing;
  - maps `official_web`, `registry_tool`, public review/profile sources, `coverage_gap`, `caution`, and `mixed` into UI-safe source and impact values;
  - maps missing-evidence `detail`/`summary` into the gap panel's recommended next step;
  - normalizes Marketing lead-shaped targets, including `marketing_lead_batch` and `matched_products`;
  - normalizes reports restored from same-origin local storage before setting state.
- Added a static regression check in `scripts/test-cross-border-agents.ts` so CE5 requires employee report JSON normalization for visual panels.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `npx tsx scripts/test-cross-border-agents.ts` — 207/207 PASS.

## 2026-06-08 — Screening official-source and paid-email ordering

### Trigger

The user observed that Cellairis investigation quality was good but asked why enabled email validation APIs were not called when the target had no supplied email. They also clarified the intended ordering: US companies should call SEC first and only then use web/state-registry fallback; UK companies should call Companies House first and only then use web fallback; paid validation should be usable by discovering contact emails from the target's own website.

### Findings

- `cbe_intel_email_domain_check` already calls Abstract Email Reputation and Hunter when `enable_paid_validation=true`, keys exist, and a concrete email is supplied. It cannot validate a bare domain through those email-verifier APIs.
- The Screening employee skill only instructed domain-only DNS checks when no email was provided, so it did not first search the target website for public same-domain contact emails.
- The MCP `cbe_intel_sec_lookup` accepted only numeric CIKs, so the employee could not make a first-class SEC tool call for US leads when only company name was known.
- The skills said Companies House/SEC were prioritized, but they did not explicitly require official-source calls before public web fallback.

### Changes

- Updated `sentura/mcp-servers/cross-border-intel/`:
  - added `cbe_intel_official_contact_email_search`, a read-only tool that fetches a bounded set of official-site pages and extracts same-domain public contact emails;
  - expanded `cbe_intel_sec_lookup` to accept `company_name`, resolve SEC `company_tickers.json`, and then call submissions by ten-digit CIK;
  - SEC private/non-filer `not_found` is returned as not-applicable/coverage gap, not negative evidence.
- Updated `sentura/agents/cbe-buyer-screening/` and the installed runtime copy under `~/.openclaw/workspace/cbe-buyer-screening/`:
  - GB targets must call Companies House before public web fallback;
  - US targets must call SEC by CIK or company name before state registry / official web fallback;
  - paid email validation first searches official website pages for same-domain emails, then validates selected emails with Abstract/Hunter.
- Updated `/client-demos/cross-border/screening` hidden employee task prompt to enforce the same ordering from the Dashboard submission path.
- Updated `sentura/mcp-servers/cross-border-intel/README.md`, `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- `pnpm --filter @sentura/mcp-cross-border-intel test` — 17/17 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel build` — PASS.
- `npx tsx scripts/test-cross-border-agents.ts` — 210/210 PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `cd sentura/dashboard && pnpm build` — PASS.
- Redaction-safe live provider smoke:
  - SEC `company_tickers.json` and `data.sec.gov/submissions/CIK0000320193.json` returned HTTP 200 with Apple resolved from company/ticker data.
  - Abstract Email Reputation returned HTTP 200 for a public same-domain test email.
  - ImportYeti company search returned HTTP 200 with one Cellairis result and `requestCost=0`.
  - Hunter Email Verifier returned HTTP 429, so the endpoint/key path is reachable but current quota/rate limit blocks validation.
  - Companies House live API still returned HTTP 401 even with the documented Basic `api_key:` format; this confirms the remaining issue is key/account acceptance by Companies House, while the employee now records it as a coverage gap and falls back to official public-page/web evidence.

## 2026-06-08 — Lead execution-path correction

### Trigger

The user asked whether Milestone 4 lead generation was a real employee workflow or only Dashboard fixed search. The direct answer was that the lead page was using the Dashboard Tavily route for the formal run, even though `cbe-lead-discovery` existed as an OpenClaw employee. The user required the delivered workflow to use the real employee.

### Finding

- `/client-demos/cross-border/lead-discovery` clicked through to `/api/client-demos/cross-border/lead-discovery/run`.
- That route performed real Tavily search and filtering, but it bypassed OpenClaw employee execution.
- The CE4 static test encoded the wrong invariant by requiring the page to fetch the route and by forbidding the Marketing AgentChat surface.
- The `cbe-lead-discovery` skills defined the lead schema but did not define the Dashboard marker block needed for reliable parsing.

### Changes

- Updated `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`:
  - imports Gateway/AgentChat primitives and checks `useAgent("cbe-lead-discovery")`;
  - changes the formal run button to `让获客员工开始搜索`;
  - fails visibly if Gateway is disconnected or `cbe-lead-discovery` is not registered;
  - sends a structured hidden task to the real employee through `AgentChatHandle.sendMessage`;
  - tracks employee tool calls through `onToolCall`;
  - parses employee output between `LEAD_CANDIDATES_JSON_START` and `LEAD_CANDIDATES_JSON_END`;
  - normalizes employee-shaped lead JSON into the table model;
  - persists the employee session key together with the last run config and returned leads.
- Kept `/api/client-demos/cross-border/lead-discovery/run` as a live Tavily adapter/diagnostic route, not the formal Dashboard execution path.
- Updated `sentura/agents/cbe-lead-discovery/skills/lead-list-production/SKILL.md` and the installed runtime copy under `~/.openclaw/workspace/cbe-lead-discovery/` with the Dashboard marker output contract.
- Updated `scripts/test-cross-border-agents.ts` so CE4 now asserts the page does not directly fetch the route for official lead generation and instead triggers `cbe-lead-discovery` through AgentChat/Gateway.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 213/213 PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.

## 2026-06-08 — Milestone 6 Accio Memory employee and UI

### User request

The user asked to complete Milestone 6 strictly according to `跨境电商/DESIGN.md`, then check the result. They also required the final effect to produce correct reports from the three simulated Accio conversations in the design/fixture.

### Deliverables completed

Correction note: this section records the initial Milestone 6 implementation. The 2026-06-08 "Accio Memory execution-path correction" section below supersedes the Dashboard behavior described here: the current UI no longer precomputes reports/highlights on sample load and waits for employee-returned JSON instead.

- Added `sentura/agents/cbe-accio-memory/` with exactly the 8 native OpenClaw workspace files:
  - `AGENTS.md`
  - `SOUL.md`
  - `TOOLS.md`
  - `IDENTITY.md`
  - `USER.md`
  - `HEARTBEAT.md`
  - `BOOTSTRAP.md`
  - `MEMORY.md`
- Added `sentura/agents/cbe-accio-memory/config.json5`:
  - id/name/model/runtime for `cbe-accio-memory`;
  - `sandbox.mode = "non-main"`;
  - normal allowlist for `memory_search`, `memory_get`, and `group:plugins`;
  - sandbox allowlist for `memory_search`, `memory_get`, and `cross-border-intel__*`;
  - denylist for shell, filesystem mutation, raw read, gateway, external messaging, sessions/subagents, and media/browser tools;
  - OpenClaw `agentRuntime.id = "openclaw"` model pin.
- Added the five Milestone 6 skills:
  - `accio-upload-intake/SKILL.md`
  - `chat-normalization/SKILL.md`
  - `deal-summary/SKILL.md`
  - `customer-profile-memory/SKILL.md`
  - `handoff-to-screening/SKILL.md`
- Updated `scripts/sentura-setup.sh` and `scripts/sentura-setup.ps1` so setup copies/stamps/registers `cbe-accio-memory`, applies the same tool/runtime override, and adds a webchat binding.
- Added `/api/client-demos/cross-border/accio-memory/sample` to read `跨境电商/fixtures/accio-chat-records.sample.json` from the repo and return it as marked `演示数据`.
- Added `/client-demos/cross-border/accio-memory`:
  - JSON upload and "加载演示 Accio 记录";
  - validation status, data classification, and conversation count;
  - conversation list with company/country/product/quantity context;
  - original transcript with product/quantity/price/payment/logistics highlights;
  - attachment list;
  - structured report table for all three simulated conversations;
  - right-side company summary, purchase intent, negotiated price/terms, next actions, behavior signals, `memory_write_preview`, and `screening_handoff_target`;
  - real `AgentChat` targeting `cbe-accio-memory` and parsing `ACCIO_SUMMARIES_JSON_START/END`;
  - local storage restore for last export, summaries, selected conversation, run status, and employee session key.
- Added sidebar route entry `CBE Accio`.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md`; CE6 and CE7 are now PASS.

### Report correctness locked

- `accio_conv_001` / Andes Mobile Parts SpA: tempered glass screen protectors, iPhone 15/Samsung S24, 10,000 pcs, USD 0.35 target, USD 0.36 best price, USD 0.03 packaging add-on, FOB Shenzhen, T/T 30% deposit terms, PI next action, and behavior points.
- `accio_conv_002` / Berlin Gadget Wholesale GmbH: 65W GaN EU plug chargers, 500 pcs trial request, MOQ 1,000 pcs, USD 6.50 target, USD 6.80 quote, EXW, Hamburg warehouse delivery, CE/RoHS requirements, and a next-action warning to verify company/domain because the contact uses Gmail.
- `accio_conv_003` / Northstar Wireless LLC: clear MagSafe phone cases, iPhone 16 / 16 Pro / 16 Pro Max, 15,000 pcs current quote, 20,000 pcs/month potential, USD 1.10 best price, FBA barcode sticker USD 0.015, drop-test packaging USD 0.08, formal quote next action, and Screening handoff.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 291/291 PASS.
- `python3 -m json.tool 跨境电商/fixtures/accio-chat-records.sample.json >/dev/null` — PASS.
- `npx tsx scripts/test-cross-border-milestone2.ts` — 39/39 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel test` — 17/17 PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel build` — PASS.
- `bash -n scripts/sentura-setup.sh` — PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- Initial pre-correction Browser check against `http://127.0.0.1:3001/client-demos/cross-border/accio-memory` — PASS at that time: page opened, "加载演示 Accio 记录" loaded the fixture, Andes/Berlin/Northstar reports rendered, key product/quantity fields appeared, memory/report panel rendered, and console error count was 0. This Dashboard-rendered report behavior was superseded by the execution-path correction below. Screenshot saved at `/tmp/cbe-accio-memory.png`.
- `git diff --check` — PASS.

### Known verification limitation

- `cd sentura/dashboard && pnpm build` did not complete because `next/font` failed to fetch the Google Fonts `Geist` resource during production build. The failure came from `src/app/layout.tsx` font loading and is unrelated to the Accio changes; dashboard TypeScript passed and the dev-server/browser validation succeeded.
- Later correction note: the 2026-06-08 execution-path correction re-ran `cd sentura/dashboard && pnpm build`, and the production build completed successfully.

## 2026-06-08 — Accio Memory execution-path correction

### User correction

The user clarified that even though the Accio records are simulated, the Memory employee must receive the chat records and return the report. The Dashboard must not contain or display pre-set reports. Raw conversation highlights, the structured report table, memory preview, and Screening preview must wait for the employee's analysis response.

### Changes made

- Removed the Dashboard-side deterministic Accio report generator from `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`.
- Changed sample loading and JSON upload so they only validate/cache the Accio export, select the first conversation, clear summaries, and set the UI to `待员工分析`.
- Changed transcript highlighting so it is derived only from the selected employee-returned `AccioSummary`; before employee output, the transcript is plain text with a waiting notice.
- Changed the report table and right-side memory/Screening preview so they remain empty until the page parses employee JSON between `ACCIO_SUMMARIES_JSON_START` and `ACCIO_SUMMARIES_JSON_END`.
- Strengthened the employee prompt and `deal-summary` skill: the employee must use the Accio parser/summarizer tools, verify raw messages, and avoid filling facts from UI templates or file names.
- Extended Accio schemas in `sentura/lib/cross-border-ecommerce.ts` and `sentura/mcp-servers/cross-border-intel/src/schemas.ts` with `monthly_potential_quantity` and `certification_terms`.
- Improved `cross-border-intel` Accio summarization logic so employee tool output correctly distinguishes current quantity vs monthly potential, MOQ vs requested quantity, current quote vs tier price, and product price vs packaging/labeling add-ons.
- Updated `scripts/test-cross-border-agents.ts` so CE6/CE7 assert that the Dashboard does not precompute fixture reports and waits for employee-returned summaries.
- Updated `跨境电商/DESIGN.md`, `docs/TESTS.md`, and `docs/tests/tests-cross-border-ecommerce.md` to reflect the employee-driven Accio report flow.

### Correct report path

- Andes/Berlin/Northstar correctness is now locked in the employee/tool path, not in the UI:
  - `cross-border-intel` parser validates the fixture and conversation count.
  - `cross-border-intel` summarizer extracts Andes, Berlin, and Northstar product/quantity/price/terms fields from raw messages.
  - `cbe-accio-memory` receives the full JSON through AgentChat and returns Dashboard-renderable JSON markers.
  - Dashboard renders highlights, report table, memory preview, and Screening handoff only from the returned JSON.

### Verification

- `npx tsx scripts/test-cross-border-agents.ts` — 291/291 PASS.
- `npx tsx scripts/test-cross-border-milestone2.ts` — 39/39 PASS.
- `python3 -m json.tool 跨境电商/fixtures/accio-chat-records.sample.json >/dev/null` — PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel test` — 17/17 PASS, including all three Accio fixture summaries.
- `pnpm --filter @sentura/mcp-cross-border-intel build` — PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit` — PASS.
- `cd sentura/dashboard && pnpm build` — PASS.
- Browser check against `http://127.0.0.1:3001/client-demos/cross-border/accio-memory` — PASS: page opened, "加载演示 Accio 记录" loaded the fixture, UI showed `待员工分析`, raw conversations appeared, report table kept the `ACCIO_SUMMARIES_JSON` waiting copy, no pre-set reports rendered, and console error count was 0. Screenshot saved at `/tmp/cbe-accio-memory-wait.png`.

## 2026-06-13 — Production cloud/database/multi-agent operating plan

### User request

The user asked for a rigorous investigation and final design covering three production questions for the Shenzhen cross-border customer:

- how to establish the databases for the three agents;
- how OpenClaw + Sentura should run the three agents concurrently;
- how to choose the cloud server region/provider and model API route for a cloud deployment where 30-50 people use the three agent templates on one server.

The user also provided the OpenClaw multi-agent docs link and asked to write the final方案 into `跨境电商/DESIGN.md`.

### Sources checked

- OpenClaw official docs:
  - `https://docs.openclaw.ai/concepts/multi-agent`
  - `https://docs.openclaw.ai/gateway/multiple-gateways`
  - `https://docs.openclaw.ai/gateway/security`
  - `https://docs.openclaw.ai/gateway/sandboxing`
  - `https://docs.openclaw.ai/tools/subagents`
  - `https://docs.openclaw.ai/concepts/session-tool`
  - `https://docs.openclaw.ai/gateway/config-tools`
- Cloud / ICP docs:
  - Alibaba Cloud ECS regions and zones (`cn-shenzhen`, `cn-guangzhou`);
  - Alibaba Cloud global infrastructure and ICP filing docs;
  - Tencent Cloud global infrastructure and ICP docs;
  - Huawei Cloud region availability as a South China cross-check.
- Model / API docs:
  - OpenAI supported countries;
  - Alibaba Cloud Model Studio model/deployment/pricing pages;
  - DeepSeek pricing and context-cache docs.
- Compliance:
  - CAC `个人信息出境标准合同办法`.
- Local OpenClaw source scan confirmed provider extension support for Qwen, DeepSeek, Volcengine/Doubao, Moonshot/Kimi, MiniMax, and custom OpenAI-compatible providers.

### Decisions added to `跨境电商/DESIGN.md §13`

- **Database shape:** do not create three unrelated databases. Use one tenant-scoped CBE business database for Lead, Screening, Accio, handoff, cost, and audit records; keep three per-agent LanceDB memory namespaces; keep OpenClaw runtime state/workspaces under OpenClaw-managed state directories.
- **Production DB recommendation:** managed PostgreSQL-compatible database for production; SQLite WAL is only a single-server pilot fallback with the same schema and explicit migration plan.
- **Typed write boundary:** agents must not get raw SQL credentials or free-form SQL tools. Phase 1 can persist validated employee JSON through Dashboard routes; production hardening should add typed `cross-border-store` MCP/Sentura tools.
- **Multi-agent runtime:** for one customer company trust boundary, run one primary OpenClaw Gateway with three persistent configured agents (`cbe-lead-discovery`, `cbe-buyer-screening`, `cbe-accio-memory`). Do not split one Gateway per employee.
- **Subagent policy:** worker employees continue denying session/subagent tools. If automated Mode-B routing is needed later, add a dedicated `cbe-orchestrator` with allowlisted `sessions_send` / `sessions_spawn`.
- **Concurrency:** set practical active-run limits for 30-50 users: 50-80 web sessions, 8-12 active Lead runs, 8-12 Screening targets or 3-5 Screening batches, 3-5 Accio imports, no normal browser tasks, and provider-quota headroom.
- **Cloud choice:** use a Chinese cloud provider as primary, not a US region. Preferred default is Alibaba Cloud China (Shenzhen) because the customer is in Shenzhen and the lane is Alibaba/Accio-heavy; Tencent Cloud South China is a valid procurement alternative.
- **Egress caveat:** if overseas public-source APIs are unreliable from mainland China, add a later Hong Kong/Singapore low-sensitivity egress worker for public search/registry queries only.
- **Model route:** default to China-accessible model APIs through OpenClaw providers: Qwen and DeepSeek first, Volcengine/Doubao or Kimi as fallback. Do not use OpenAI as the default mainland production route.
- **Compliance posture:** public mainland hosting needs ICP/PSB filing path; raw Accio chats and buyer contacts sent to US hosting or overseas model endpoints should be treated as personal-information outbound-transfer work.
- **Verification:** added a go-live checklist covering OpenClaw setup, MCP doctor, security audit, CBE tests, live China-region API smoke, 50-user load smoke, backup restore, workspace invariant checks, and Simplified Chinese/evidence-source UI checks.

### Files changed

- Updated `跨境电商/DESIGN.md` with `§13 Production Cloud, Database, and Multi-Agent Operating Plan (2026-06-13)`.
- Updated `docs/TESTS.md` with CE10 and the 2026-06-13 Last updated line.
- Updated `docs/tests/tests-cross-border-ecommerce.md` with CE10 detailed review checks.
- Updated `docs/MEMORY.md` and this detail file.

### Verification

- Manual review against the checked web sources and local OpenClaw provider extension scan.
- Static checks:
  - `rg -n "Production Cloud|CE10|2026-06-13|cn-shenzhen|OpenAI" 跨境电商/DESIGN.md docs/TESTS.md docs/tests/tests-cross-border-ecommerce.md docs/MEMORY.md docs/memory/cross-border-ecommerce/phase-1.md`
  - `git diff --check`

### Follow-ups

- Implement the production persistence layer when the customer approves managed PostgreSQL/TDSQL/PolarDB vs SQLite pilot fallback.
- Run real China-region reachability tests from the selected cloud VM for Tavily/Brave, Companies House, SEC, Abstract, Hunter, ImportYeti, and chosen model providers before final procurement.

## 2026-06-13 — Alibaba International Station API access investigation

### User request

The user provided an Alibaba developer URL for International Station API doc `25408` and asked to investigate whether the cross-border customer, as a signed Alibaba International Station seller, can obtain API permissions, what the flow is, and which APIs can optimize the Screening and Background employee.

### Sources checked

- User-supplied International Station API doc: `https://developer.alibaba.com/docs/api.htm?apiId=25408`
- Alibaba.com Open API overview / How to Start: `https://developer.alibaba.com/docs/doc.htm?articleId=118416&docType=1&treeId=684`
- Taobao Global / Alibaba Open Platform development manual authorization flow: `https://developer.alibaba.com/docs/doc.htm?articleId=121120&docType=1&treeId=735`
- ICBU transaction APIs: `alibaba.seller.order.list`, `alibaba.seller.order.fund.get`, related order/logistics/address method lists.
- ICBU seller APIs: `alibaba.seller.customer.batch.get`, `alibaba.seller.customer.get`, `alibaba.seller.customer.note.get`, `alibaba.member.info.get`, `alibaba.member.sub.account.info.get`.
- International Station / ICBU docs for `alibaba.buyer.companyprofile.find`, `alibaba.member.basicprofile.find`, `alibaba.icbu.supplier.identity.verified.get`, `alibaba.icbu.data.verified.get`, `alibaba.procurement.*`, and `alibaba.icbu.risk.send`.

### Findings

- The Alibaba.com Open API docs describe a three-step access flow: developer registration, authorization/access token, and API calls. The overview states the beta Open API is free for paid GGS users, but individual method pages still determine authorization and commercial requirements.
- A signed seller should be treated as likely eligible for a self-use developer app, but not automatically entitled to every API. Methods can be free, value-added, authorization-required, Jushita-only, or private/hidden.
- The practical proof point is a live customer-account console/API-test run: create an app, get `app_key` / `app_secret`, configure callback, have the seller main account authorize, exchange `code` for token, then smoke call harmless read methods.
- High-value Screening methods are seller-owned first-party data: customer batch records, order list/detail, order fund/logistics/address context, customer notes, member/account mapping.
- Buyer-side procurement history and opaque risk submission APIs are not safe defaults for seller-side buyer background checks unless Alibaba or the buyer explicitly authorizes the use case.

### Decisions added to `跨境电商/DESIGN.md §14`

- Added signed-seller API-access caveat: verify permissions in Alibaba Open Platform console; do not assume contract status grants every method.
- Added enablement flow covering account confirmation, developer app/callback, scope request, seller OAuth/TOP session token, smoke tests, and production refresh.
- Added API priority table for Screening:
  - P0: `alibaba.seller.customer.batch.get`, conditional `alibaba.seller.customer.get`, `alibaba.seller.order.list`, `alibaba.seller.order.get`;
  - P1: order fund/logistics/address context, customer notes, member info, sub-account mapping;
  - P2: buyer/company/member profile enrichment only after seller-scope validation; verified-supplier APIs only when screening suppliers or buyer-as-supplier targets;
  - P3: buyer procurement APIs and `alibaba.icbu.risk.send` out of scope until explicit authorization/confirmation.
- Added Screening evidence blocks for Alibaba first-party customer records, order history, payment/logistics context, customer behavior notes, account mapping, and conditional profile enrichment.
- Added proposed read-only `icbu-openapi` MCP tools: auth status, customer sync, order history, customer notes, profile enrichment.
- Added DB additions for authorizations, method status, customer snapshots, order evidence, and customer-note evidence.
- Added data-classification requirements: CRM/customer/order/note data is T2/T3, raw values are redacted from LLM prompts, and raw data must not enter vector memory or external APIs.

### Files changed

- Updated `跨境电商/DESIGN.md` with `§14 Alibaba International Station API Access Plan For Screening Optimization (2026-06-13)`.
- Updated `docs/TESTS.md` with CE11 and the 2026-06-13 Last updated line.
- Updated `docs/tests/tests-cross-border-ecommerce.md` with CE11 detailed review checks.
- Updated `docs/MEMORY.md` and this detail file.

### Verification

- Manual review against Alibaba official/developer documentation and indexed Alibaba API method pages.
- Static checks:
  - `rg -n "Alibaba International Station API|CE11|icbu-openapi|alibaba.seller.customer.batch.get|alibaba.seller.order.list" 跨境电商/DESIGN.md docs/TESTS.md docs/tests/tests-cross-border-ecommerce.md docs/MEMORY.md docs/memory/cross-border-ecommerce/phase-1.md`
  - `git diff --check`

### Follow-ups

- Ask the customer to confirm the exact Alibaba International Station seller package and whether it is paid GGS / equivalent.
- Run a live Open Platform console proof with the customer's main seller account and record which APIs are enabled, denied, value-added, Jushita-only, or private.
- Implement `icbu-openapi` only after the access proof, and keep it read-only with no mutation methods.

## 2026-06-13 — Concurrent Lead Discovery dedupe design

### User request

The user described a concrete concurrency problem: User A starts a Marketing Acquisition / Lead Discovery run for 20 customers that takes about 5 minutes. At minute 2.5, User B starts a similar 20-customer Lead Discovery run. The overlap probability is high, so the platform needs a design that avoids duplicate searches, duplicate lead records, and repeated buyer assignment.

### Context checked

- Existing design already dedupes final lead candidates by normalized domain and dedupe key.
- Existing production database plan has `lead_runs`, `lead_candidates`, `lead_sources`, and `agent_runs`, but no run-scope coordination table.
- Existing concurrency plan limits active Lead Discovery runs to 8-12 but did not yet prevent two active runs from searching the same scope.
- Existing formal Lead Discovery execution path sends tasks through the real `cbe-lead-discovery` OpenClaw AgentChat session; the Dashboard route is diagnostics only.

### Design decisions added to `跨境电商/DESIGN.md §15`

- Add three dedupe layers:
  - run-scope dedupe before launching an employee session;
  - candidate-identity dedupe when saving results;
  - allocation/ownership dedupe only when a user acts on a lead.
- Normalize each Lead Discovery request into product, buyer-persona, country/region, language, source-policy, exclusion, and time-window fields, then compute exact `scope_hash` and weighted `scope_similarity`.
- Exact active scope match: User B joins User A's active run by default and does not start a second AgentChat session.
- High-overlap scope: UI offers shared results, unassigned-only top-up, or narrowing the search.
- Add DB-backed lease tables:
  - `lead_discovery_scopes`
  - `lead_run_memberships`
  - `lead_identities`
  - `lead_run_results`
  - `lead_allocations`
- Use `locked_until` and heartbeat leases, not in-memory locks or long database transactions.
- Define `identity_key` precedence: Alibaba customer id, normalized domain, same-domain email domain, then country plus normalized company name.
- If the shared pool does not satisfy User B's requested unique/unallocated count, start a top-up-only run for the missing count and pass an `existing_identity_keys` denylist to `cbe-lead-discovery`.
- Preserve OpenClaw's role: employees perform search; Sentura coordinates business dedupe, leases, identity pool, and lead ownership.

### Files changed

- Updated `跨境电商/DESIGN.md` with `§15 Concurrent Lead Discovery Dedupe Plan (2026-06-13)`.
- Updated `docs/TESTS.md` with CE12 and the 2026-06-13 Last updated line.
- Updated `docs/tests/tests-cross-border-ecommerce.md` with CE12 detailed review checks.
- Updated `docs/MEMORY.md` and this detail file.

### Verification

- Manual review against the existing Lead Discovery execution path and production DB/multi-agent sections.
- Static checks:
  - `rg -n "Concurrent Lead Discovery|CE12|lead_discovery_scopes|lead_identities|scope_hash|top-up" 跨境电商/DESIGN.md docs/TESTS.md docs/tests/tests-cross-border-ecommerce.md docs/MEMORY.md docs/memory/cross-border-ecommerce/phase-1.md`
  - `git diff --check`

### Follow-ups

- Implement the run coordinator in the Dashboard/server layer before launching AgentChat.
- Add database migrations for the scope, identity, result, and allocation tables.
- Extend the Lead Discovery UI to show duplicate-scope warnings, shared progress, and top-up-only mode.
- Add automated tests that simulate two concurrent start requests for the same `scope_hash` and assert that only one AgentChat run is launched.

## 2026-06-13 — Cross-border design documentation reorganization

### User request

The user said the cross-border design documentation had become cluttered and asked to reorganize it by the three employees:

- `跨境电商/MARKET_ACQUISITION.md`
- `跨境电商/SCREENING.md`
- `跨境电商/MEMORY_PROCESSING.md`

They also asked to simplify `跨境电商/DESIGN.md` so it mainly keeps platform integration and common cross-agent detailed design, while preserving all implemented and still-to-implement information in the appropriate documents.

### Reorganization decisions

- `跨境电商/DESIGN.md` is now the shared platform/cross-agent design. It owns:
  - customer baseline and input summary;
  - employee roster and document map;
  - shared product/persona/geography knowledge pack;
  - shared OpenClaw/Sentura implementation shape;
  - cross-agent data flow;
  - client demo route map;
  - `cross-border-intel` MCP design;
  - shared business database schema;
  - multi-agent runtime/concurrency;
  - China cloud/model deployment plan;
  - shared cost, safety, compliance, data classification;
  - milestone/status overview;
  - go-live checklist;
  - open questions and source index.
- `跨境电商/MARKET_ACQUISITION.md` now owns:
  - `cbe-lead-discovery` role/status;
  - inputs and run-builder controls;
  - search strategy and exclusions;
  - tool/model policy;
  - output schema and marker contract;
  - lead UI design;
  - acceptance criteria;
  - Marketing-specific database/persistence;
  - concurrent Lead Discovery dedupe design from the previous CE12 work;
  - implemented vs still-to-implement plan;
  - source/test traceability.
- `跨境电商/SCREENING.md` now owns:
  - `cbe-buyer-screening` role/status;
  - batch/manual intake schemas;
  - Screening UI;
  - evidence ladder;
  - registry, domain/email, social, trade, and financial checks;
  - contextual scoring model and report schema;
  - Alibaba International Station API enhancement from the previous CE11 work;
  - Screening-specific database/persistence and budget controls;
  - implemented vs still-to-implement plan;
  - source/test traceability.
- `跨境电商/MEMORY_PROCESSING.md` now owns:
  - `cbe-accio-memory` role/status;
  - upload/sample routes;
  - Accio fixture schema and required extraction results;
  - memory summary output contract;
  - Accio UI design;
  - tool/model policy;
  - memory write rules;
  - Accio-specific database/persistence;
  - Screening handoff;
  - implemented vs still-to-implement plan;
  - source/test traceability.

### Files changed

- Rewrote `跨境电商/DESIGN.md` as the shared platform/cross-agent design.
- Populated `跨境电商/MARKET_ACQUISITION.md`.
- Populated `跨境电商/SCREENING.md`.
- Populated `跨境电商/MEMORY_PROCESSING.md`.
- Updated `README.md` Key Documentation with all four CBE docs.
- Updated `AGENTS.md` Cross-border read instructions with the shared design plus relevant agent detail files.
- Updated `docs/TESTS.md`:
  - CE1 now references shared + three agent docs;
  - CE10 remains shared design;
  - CE11 now points to Screening doc;
  - CE12 now points to Marketing doc;
  - CE13 added for documentation reorganization.
- Updated `docs/tests/tests-cross-border-ecommerce.md` with CE13 detailed checks and updated CE10/CE11/CE12 scopes.
- Updated `docs/MEMORY.md` Current Ground Truth and matrix row.

### Verification

- Manual review of the original monolithic `跨境电商/DESIGN.md` structure before replacement.
- Static checks planned/run:
  - key heading/path checks for all four CBE docs;
  - CE13 keyword checks across README, AGENTS, tests, and memory;
  - `git diff --check`;
  - current diff check for forbidden historical workspace artifact reintroduction.

### Follow-ups

- Implement the production persistence layer from the now-separated shared/agent docs.
- When future work touches only one employee, update that employee doc first and keep `DESIGN.md` limited to shared/cross-agent changes.

## 2026-06-13 — Employee role UI design

### User request

The user asked for a professional UI/UX design specifically for the cross-border e-commerce customer, written to `跨境电商/UI.md`. The requested scope was Employee-first:

- Admin and Employee are distinct roles, but Admin pages can be designed later.
- Employee navigation: Sentura logo left, `获客与背调` / `记忆整理` switcher center, user center right with personal center, messages, settings, etc.
- Personal center is the first login page and summarizes the user's personal data.
- `获客与背调` is one customer list with company, country, type, product, website, found time, score, and actions, plus search/filter and `寻找客户` / `批量背调` / `手动背调`.
- `记忆整理` is one chat-record list with name, source, import time, action, search/filter, and `添加新记录`.
- Employee pages should not expose direct Agent chat sessions for now.
- The design must explain how UI actions connect to backend Agents.

### Context read

- Mandatory/current context: `README.md`, `docs/MEMORY.md`, `docs/TESTS.md`.
- Cross-border detail memory: `docs/memory/cross-border-ecommerce/phase-1.md`.
- Cross-border design: `跨境电商/DESIGN.md`, `MARKET_ACQUISITION.md`, `SCREENING.md`, and `MEMORY_PROCESSING.md`.
- Existing Dashboard implementation points for the current CBE demo routes, `AgentChat`, and gateway client.
- Official/current implementation references for OpenClaw Gateway/MCP/tool config and Next.js route handlers.

### Design decisions

- Created `跨境电商/UI.md` as the role-level CBE UI design document.
- Defined target Employee routes:
  - `/client-demos/cross-border/employee` for `个人中心`;
  - `/client-demos/cross-border/employee/customers` for `获客与背调`;
  - `/client-demos/cross-border/employee/memory` for `记忆整理`;
  - `/client-demos/cross-border/admin` reserved for Admin.
- Kept current implemented demo routes documented as source workbenches that can be folded into the new Employee role pages.
- Made the visible Employee product UI list/form/action-driven, with no direct free-form Agent chat surface.
- Preserved the real OpenClaw employee execution path behind the UI: business actions create hidden/auditable Gateway sessions for `cbe-lead-discovery`, `cbe-buyer-screening`, or `cbe-accio-memory`, then parse the established JSON markers:
  - `LEAD_CANDIDATES_JSON_START/END`
  - `SCREENING_REPORTS_JSON_START/END`
  - `ACCIO_SUMMARIES_JSON_START/END`
- Documented the customer-row colors requested by the user:
  - white for not investigated;
  - blue for running;
  - green for high score;
  - orange for medium score;
  - red for low score.
- Documented the memory-row colors:
  - white for not analyzed;
  - green for analyzed;
  - blue/red as operational running/error extensions.

### Files changed

- Wrote `跨境电商/UI.md`.
- Updated `跨境电商/DESIGN.md` to link `UI.md` and clarify current demo routes vs target Employee role UI.
- Added `UI.md` cross-links to `MARKET_ACQUISITION.md`, `SCREENING.md`, and `MEMORY_PROCESSING.md`.
- Updated `README.md` Key Documentation with the new UI document.
- Updated `AGENTS.md` cross-border read instructions and on-demand reference list.
- Updated `docs/TESTS.md` with CE14 and the test-summary count.
- Updated `docs/tests/tests-cross-border-ecommerce.md` with CE14 detailed checks.
- Updated `docs/MEMORY.md` matrix and this detail file.

### Verification

- Manual review against the user's requested page structure.
- Static/documentation checks:
  - `UI.md` is non-empty and carries the on-demand banner.
  - README / AGENTS / shared design / agent docs all link to `UI.md`.
  - CE14 exists in both the test matrix and detailed test file.
  - No TeamPlan row was added because this is independent cross-border client work.

### Follow-ups

- Implement the Employee shell and hidden `EmployeeTaskRunner` (completed by the 2026-06-14 UI implementation and hidden task runner sessions below).
- Fold the existing Lead Discovery, Screening, and Accio demo routes into the new Employee role pages.
- Add browser/Playwright verification after the UI implementation exists.

## 2026-06-14 — Employee role UI implementation

### User request

The user was implementing the Sentura cross-border e-commerce Employee UI from `/Users/purest./Desktop/Sentura跨境电商平台UI设计README.md`. A previous chat had been interrupted after backing up the source and partially implementing the UI. The user asked to inspect current progress and continue the task.

### Context read

- Project instructions: `AGENTS.md`, `sentura/dashboard/AGENTS.md`.
- Mandatory/current docs: `README.md`, `docs/MEMORY.md`, `docs/TeamPlan.md`, `docs/TESTS.md`.
- Cross-border UI design and test detail: `跨境电商/UI.md`, `docs/tests/tests-cross-border-ecommerce.md`.
- External implementation checklist: `/Users/purest./Desktop/Sentura跨境电商平台UI设计README.md`.
- Existing changed files under `sentura/dashboard/src/app/client-demos/cross-border/employee/`, `src/components/app-shell.tsx`, and `src/components/cross-border/employee-cost.tsx`.

### Implementation

- Added/finished the Employee dashboard shell:
  - logo links to `/client-demos/cross-border/employee`;
  - top nav has only the two daily work tabs `获客与背调` and `记忆整理`;
  - user menu keeps `个人中心`, messages, settings, logout;
  - mobile nav is a two-tab bar.
- Kept `/` pointed at `/client-demos/cross-border/employee` for this CBE demo build.
- Localized root metadata and `lang="zh-CN"`.
- Added Sentura logo assets under `sentura/dashboard/public/`.
- Implemented the Employee personal center from demo-local data:
  - greeting, role/tenant badges, range selector;
  - four KPI cards;
  - pending work, recent runs, customer funnel, message reminders;
  - personal API cost card.
- Implemented the `获客与背调` role page:
  - unified customer table with required columns;
  - mobile customer cards to avoid horizontal overflow;
  - status-colored rows/badges;
  - company/product/country search;
  - filter drawer for country, type, product, found time, status, and score tier;
  - removable filter chips plus reset;
  - lead/bulk/manual task drawers with cost notices and Gateway/agent-missing notices;
  - customer detail drawer with overview, source evidence, report summary, and task history;
  - no direct Agent chat composer.
- Implemented the `记忆整理` role page:
  - unified memory record table;
  - mobile record cards;
  - name/source/summary search;
  - filter drawer for source, import time, and analysis status;
  - removable filter chips plus reset;
  - add-record drawer, import-only/import-and-analyze actions, cost notice, and Gateway/agent-missing notices;
  - memory detail drawer with raw overview, conversation summary, analysis report, memory-preview policy, and send-to-screening action;
  - no direct Agent chat composer.
- Added the personal cost widget:
  - `GatewayClient.getCostEvents()` calls `sentura.cost.events`;
  - new cost-event types exported from `src/lib/gateway/{types,index}.ts`;
  - UI falls back to demo estimates when Gateway/cost events are unavailable.
- Wrote `/outputs/task_handoff.md` mid-task to preserve continuation context per the user's project rule.

### Files changed

- `sentura/dashboard/src/app/page.tsx`
- `sentura/dashboard/src/app/layout.tsx`
- `sentura/dashboard/src/components/app-shell.tsx`
- `sentura/dashboard/public/sentura-logo-icon.svg`
- `sentura/dashboard/public/sentura-logo-side.svg`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-data.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/components/cross-border/employee-cost.tsx`
- `sentura/dashboard/src/lib/gateway/client.ts`
- `sentura/dashboard/src/lib/gateway/index.ts`
- `sentura/dashboard/src/lib/gateway/types.ts`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-1.md`
- `outputs/task_handoff.md`

### Verification

- `cd sentura/dashboard && pnpm exec tsc --noEmit` passed.
- `cd sentura/dashboard && pnpm build` passed. Build still prints the existing Next.js multiple-lockfile workspace-root warning.
- `cd sentura/dashboard && pnpm exec next dev --hostname 127.0.0.1 --port 3000` started successfully.
- Browser validation passed for:
  - `/client-demos/cross-border/employee`: greeting, cost panel, two-tab nav, no visible Agent chat, console errors 0.
  - `/client-demos/cross-border/employee/customers`: required columns/actions, no visible Agent chat, customer filter drawer, `高分` filter chip narrows to one row, console errors 0.
  - `/client-demos/cross-border/employee/memory`: required columns/actions, no visible Agent chat, memory filter drawer, `已分析` filter chip narrows to one row, console errors 0.
  - 390px mobile viewport for all three routes: no horizontal overflow, two-tab mobile nav present, no visible Agent chat, console errors 0.
- `cd sentura/dashboard && pnpm lint` still fails because of pre-existing repository-wide React Compiler lint rules in unrelated files such as `src/app/audit/page.tsx`, `src/app/chat/page.tsx`, `src/lib/gateway/hooks.ts`, and older CBE demo routes. New code-specific unused imports and `<img>` warnings were cleaned, but the global lint command remains blocked outside this implementation scope.

### Remaining limitations

- This role UI is still demo/local-state first. Buttons show business-task submission notices and check Gateway/agent availability, but a dedicated non-visual `EmployeeTaskRunner` that creates hidden sessions and parses JSON markers has not yet been extracted for these new role pages.
- Production persistence is still future work; the UI currently uses demo data and Gateway cost events when available.
- Superseded later on 2026-06-14 by the `Employee hidden task runner` section below: the non-visual runner now exists, while production persistence remains future work.

## 2026-06-14 — Employee hidden task runner

### Inputs read

- Continuation handoff: `outputs/task_handoff.md`.
- Current code under `sentura/dashboard/src/app/client-demos/cross-border/employee/`.
- Existing employee-executed demo pages:
  - `sentura/dashboard/src/app/client-demos/cross-border/lead-discovery/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/screening/page.tsx`
  - `sentura/dashboard/src/app/client-demos/cross-border/accio-memory/page.tsx`
- Marker contracts from `跨境电商/UI.md`, existing CE4/CE5/CE6 tests, and employee workspace instructions.

### Implementation

- Added `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`.
- The runner:
  - creates hidden OpenClaw employee sessions with `GatewayClient.createSession(agentId, prompt, { label })`;
  - polls `chat.history` for assistant responses;
  - parses `LEAD_CANDIDATES_JSON_START/END`, `SCREENING_REPORTS_JSON_START/END`, and `ACCIO_SUMMARIES_JSON_START/END`;
  - converts parsed payloads into the Employee UI's local customer/memory row models;
  - returns explicit marker-missing, JSON-parse, timeout, and Gateway errors.
- Updated `获客与背调`:
  - customer rows are now local mutable state instead of a fixed imported array;
  - `寻找客户` submits to `cbe-lead-discovery` and appends parsed lead rows;
  - `批量背调` and `手动背调` submit normalized targets to `cbe-buyer-screening` and upsert returned report rows;
  - the `寻找客户` drawer remains openable when Gateway is unavailable, but final submit is disabled and the user sees the Gateway/agent-missing notice.
- Updated `记忆整理`:
  - uploaded JSON files are actually read and parsed;
  - `仅导入` adds a local `未分析` row only after valid JSON exists;
  - `导入并分析` submits uploaded payloads to `cbe-accio-memory`;
  - row-level `开始分析` submits a normalized local/manual payload through the same hidden employee path.
- Preserved the Employee UX rule: no visible free-form Agent chat composer on the home, customer, or memory pages.

### Files changed

- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-1.md`
- `outputs/task_handoff.md`

### Verification

- `cd sentura/dashboard && pnpm exec tsc --noEmit` passed.
- `cd sentura/dashboard && pnpm build` passed. Build still prints the existing Next.js multiple-lockfile workspace-root warning.
- `cd sentura/dashboard && pnpm lint` still fails on pre-existing repository-wide React Compiler lint errors outside the Employee runner/pages; no lint errors were reported for the new Employee runner/pages.
- Browser desktop validation on `http://127.0.0.1:3000`:
  - `/client-demos/cross-border/employee`: expected labels present, no visible chat-like input, console errors 0.
  - `/client-demos/cross-border/employee/customers`: expected labels present, no visible chat-like input, console errors 0.
  - `寻找客户` drawer: button enabled, drawer opens, product input and submit button present, Gateway/agent-missing notice visible when unavailable, console errors 0.
  - `/client-demos/cross-border/employee/memory`: expected labels present, no visible chat-like input, console errors 0.
  - `添加新记录` drawer: file input, `仅导入`, and `导入并分析` controls present, console errors 0.
- Browser 390px mobile validation:
  - all three Employee routes render expected labels;
  - no horizontal page overflow;
  - console errors 0.

### Remaining limitations

- This is still local row-state persistence. Production persistence for customers, screening reports, Accio imports, memory previews, handoffs, and employee-run records remains future work.
- Browser validation deliberately did not click final task-submit buttons because that would start live employee work and external search/tool calls. The execution path is verified statically and by type/build; live task E2E should be run after Gateway and all three CBE employees are registered in the target environment.

## 2026-06-14 — Employee UI readiness audit

### Inputs read

- `outputs/task_handoff.md`
- `AGENTS.md`
- `sentura/dashboard/AGENTS.md`
- `docs/MEMORY.md`
- `跨境电商/UI.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`
- `sentura/dashboard/src/app/client-demos/cross-border/employee/memory/page.tsx`
- `sentura/dashboard/src/lib/gateway/{client,types,hooks}.ts`
- `openclaw/src/gateway/server-methods/config.ts`
- `openclaw/src/config/types.openclaw.ts`
- local runtime config `/Users/purest./.openclaw/openclaw.json`
- deployed CBE workspaces under `/Users/purest./.openclaw/workspace/cbe-*`

### Verification

- Updated `outputs/task_handoff.md` with this audit continuation before long verification.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm build`: PASS, with the existing Next multiple-workspace-root warning.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 291/291 checks.
- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 17/17 Vitest checks.
- Browser desktop checks on `http://127.0.0.1:3000`:
  - Employee home, customers, and memory routes rendered without console errors.
  - No visible free-form Agent chat composer appeared on the three Employee routes.
  - `寻找客户` and `添加新记录` drawers opened.
- Browser 390px mobile checks:
  - no horizontal overflow on Employee home, customers, or memory routes;
  - no console errors;
  - no visible free-form Agent chat composer.
- Initial port check found dashboard dev server on `127.0.0.1:3000` but no normal OpenClaw Gateway on `18789`.
- Started normal `pnpm openclaw gateway`; dashboard then showed `Gateway: Connected`.
- Direct WebSocket RPC with allowed Origin verified:
  - `config.get` succeeds;
  - all three CBE agents are visible;
  - no-message `sessions.create` for `cbe-accio-memory` returns a session key without starting a run;
  - `sessions.delete` cleaned the audit session.
- Gateway logs during Browser checks showed repeated `sentura.cost.events` failures with `unknown method`. Current `/Users/purest./.openclaw/openclaw.json` does not enable the `sentura-cost` extension, so the personal cost widget is currently demo/fallback-only and creates backend error log noise when it refreshes.
- `tools.effective` against a no-message `cbe-buyer-screening` session returned no tools yet and an `mcp-not-yet-connected` notice. `cross-border-intel` is configured, but MCP tools only appear after an agent run discovers/connects the server, so actual MCP tool availability still requires a live CBE task run.
- `cd sentura/dashboard && pnpm lint`: FAIL, 28 errors and 3 warnings from React Compiler / ESLint rules across existing dashboard files.

### Findings

- The handoff does not mean the CBE Employee UI is fully production-complete. It means a Phase-1 Employee UI plus hidden runner exists, with known caveats.
- The designed Employee UI surface is largely present and usable: personal center, customer list, memory list, action drawers, status badges, cost widget, desktop/mobile layouts, and no visible direct Agent chat.
- Backend connection and registration are real once the normal Gateway is running on `18789`; `useAgent()` can discover `cbe-lead-discovery`, `cbe-buyer-screening`, and `cbe-accio-memory`.
- Current local runtime config drifted from source/setup expectations:
  - live `/Users/purest./.openclaw/openclaw.json` has `sandbox.mode: "off"` for all three CBE employees;
  - live CBE agent entries lack `tools.sandbox.tools.allow`;
  - source `sentura/agents/cbe-*/config.json5` and setup scripts expect `sandbox.mode: "non-main"` plus sandbox tool allowlists.
- Personal API cost is not fully wired in the current Gateway runtime because `sentura.cost.events` is unavailable unless `sentura-cost` is enabled.
- `cross-border-intel` registration is present, but the no-message tools probe showed MCP is not connected until an agent run, so the real investigation path still needs live tool-discovery verification.
- Production persistence is not implemented. Employee pages still write parsed customer rows, screening results, Accio imports, memory previews, and run history into local React state.
- Live marker-producing task execution was not performed in this audit to avoid external search, paid/limited provider calls, and LLM spend. Therefore `LEAD_CANDIDATES_JSON`, `SCREENING_REPORTS_JSON`, and `ACCIO_SUMMARIES_JSON` remain unverified in a real run during this audit.
- Dashboard lint is still red and should be treated as an engineering-readiness blocker, even though `tsc` and `next build` pass.

### Conclusion

Current state is good enough for a local Phase-1 demo after starting dashboard and Gateway, but not good enough to claim "direct production use" or "fully complete." Before that claim, fix the live sandbox config drift, add production persistence, run live marker-producing E2E for all three employee actions, and clean or explicitly waive the dashboard lint failures.

## 2026-06-15 — Employee safe final verification

### Inputs read

- Continuation files: `outputs/resume_card.md` and `outputs/task_handoff.md`.
- Project and Codex memory indexes: `docs/MEMORY.md` and `/Users/purest./.codex/memories/MEMORY.md`.
- User screenshot: `/Users/purest./Desktop/截屏2026-06-15 16.10.39.png`.
- Runtime config: `/Users/purest./.openclaw/openclaw.json`.
- Browser target: `http://localhost:3000/client-demos/cross-border/employee`.

### Verification performed

- Confirmed services were already running:
  - dashboard `node` on TCP `*:3000`;
  - Gateway `node` on `127.0.0.1:18789` and `[::1]:18789`.
- Confirmed live config now includes Sentura extension load paths and enabled entries for `sentura-agents`, `sentura-rbac`, `sentura-audit`, `sentura-approval`, `sentura-provisioner`, `sentura-experience-extraction`, `sentura-memory-lancedb`, `sentura-cost`, `sentura-monitoring`, and `sentura-mcp-health`.
- Confirmed `sentura-audit` and `sentura-experience-extraction` live entries carry `hooks.allowConversationAccess: true`.
- Confirmed all three CBE employee live configs use `sandbox.mode: "non-main"` and have sandbox tool allowlists for `cross-border-intel__*`.
- Direct Gateway WebSocket RPC smoke passed:
  - `sentura.cost.events` returned OK with zero current events, so the dashboard fallback label means no real cost events yet, not an unknown method.
  - `sentura.health.gateway` returned OK.
  - `sentura.mcp.health.list` returned OK with two server records.
  - `sentura.audit.stats` returned OK.
  - `sentura.approval.requests.list` returned OK with count 0.
  - `sentura.provisioner.requests.list` returned OK with count 0.
- In-app Browser desktop checks passed:
  - Employee home: connected, no console errors, no visible free-form chat/input, first-sample/home state renders.
  - Customers page: connected, no console errors, no visible free-form chat; `寻找客户` drawer opens.
  - Lead estimate changed from `US$4.99` to `US$6.07` after adding `MagSafe 配件`, proving target choices affect cost estimates.
  - Memory page: connected, no console errors, no visible free-form chat; `添加新记录` drawer opens with upload/source/import/analyze controls.
- In-app Browser 390px mobile checks passed for Employee home/customers/memory:
  - expected labels render;
  - Gateway connected;
  - no console errors;
  - no horizontal overflow;
  - no visible free-form chat composer.
- Local checks passed:
  - `pnpm exec tsx scripts/test-week2.ts`: 148/148.
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: 291/291.
  - `pnpm --filter @sentura/mcp-cross-border-intel test`: 17/17.
  - `cd sentura/dashboard && pnpm exec tsc --noEmit`: passed.

### Current conclusion

The safe local demo path is now verified: start/reuse Gateway on `18789`, dashboard on `3000`, open the Employee demo, and the home/customers/memory pages connect to Gateway without visible free-form chat. Sentura startup plugin loading and hook access are fixed in current live config, and the prior `sentura.cost.events` unknown-method failure is resolved.

This still should not be described as fully production-complete. Production persistence is not implemented, global dashboard lint was not re-run in this final pass and was previously red from existing React Compiler issues, and final live task-submit E2E for `LEAD_CANDIDATES_JSON`, `SCREENING_REPORTS_JSON`, and `ACCIO_SUMMARIES_JSON` remains intentionally unclicked to avoid external search, paid/limited provider calls, and LLM spend without explicit user approval.

## 2026-06-15 — User-approved live E2E sandbox blocker

### User authorization

The user explicitly approved clicking the final submit buttons even though they can trigger real external search, LLM, and provider calls.

### What was attempted

- Runtime was rechecked first:
  - dashboard `node` PID `34688` listening on TCP `*:3000`;
  - Gateway `node` PID `46860` listening on `127.0.0.1:18789` and `[::1]:18789`.
- In the Employee `获客与背调` page, Lead Discovery scope was minimized before submission:
  - 1 product: `手机壳`;
  - 1 buyer type: `维修连锁`;
  - 1 country: `英国`;
  - target count: `20 个`;
  - per-query limit: `5 条`;
  - displayed estimate: `US$1.00`.
- Clicked `提交获客任务`.

### Result

- The page immediately displayed `隐藏员工任务提交失败。`
- Direct Gateway reproduction with the same minimal Lead payload proved that Gateway/session creation works:
  - session key: `agent:cbe-lead-discovery:dashboard:99908386-9c5a-4b38-8c7b-a4c49013b6be`;
  - `sessions.create` returned `runStarted: true`.
- The run then failed before model/tool execution with:
  - `Sandbox mode requires Docker, but the "docker" command was not found in PATH. Install Docker (and ensure "docker" is available), or set agents.defaults.sandbox.mode=off to disable sandboxing. | spawn docker ENOENT.`
- `docker` and `podman` were not found in PATH.
- `/Applications/Docker.app`, `/Applications/OrbStack.app`, and `/Applications/Podman Desktop.app` were not present.
- Current CBE employees are correctly configured with `sandbox.mode: "non-main"`; this is the intended safety posture, not a config drift.

### Decision point

Do not silently set sandbox off. Sentura project rules require sandboxed AI employees. The next live E2E needs either:

- Docker or another OpenClaw-supported sandbox runtime installed and available on PATH, then rerun the live UI submit flow; or
- explicit user approval for a temporary local-only sandbox-off override for the three CBE employees, followed by Gateway restart, live E2E, config restore to `non-main`, and another Gateway restart. Any result from that path must be labeled unsafe local-only evidence.

## 2026-06-15 — Employee task progress persistence fix

### User report

The user reported three Employee UI issues:

1. `寻找客户` / `背调` showed only `正在读取后台任务进度...`, with no approximate duration or countdown.
2. Starting Lead Discovery or Screening, then switching to `记忆整理` or another page, made the task/progress disappear.
3. Some runs searched for a while, then disappeared without results or a clear failure.

### Root cause

The `获客与背调` page kept task lifecycle in page-local React state:

- `rows` came from `useState(customerRows)`.
- `taskRunning` came from page-local `useState`.
- progress surfaced only through a local notice/toast.
- result writes happened in the page handler after `await runLeadDiscoveryTask(...)` / `await runScreeningTask(...)`.

This meant route navigation unmounted the page UI that displayed progress and owned the visible result update. The underlying hidden OpenClaw session might continue, but the customer-facing Employee UI no longer had durable task state or terminal error visibility.

### Changes made

- Added `sentura/dashboard/src/stores/use-cbe-employee-store.ts`:
  - stores customer rows and Employee task records;
  - persists rows/tasks under `sentura-cbe-employee-state-v1`;
  - tracks active, completed, failed, and stale tasks;
  - keeps session keys on failure where available.
- Added `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`:
  - global task status bar for Employee routes;
  - shows task title, target label, status, message, estimated total time, elapsed time, countdown, progress bar, result count, and session key;
  - terminal success/failure remains visible until dismissed.
- Updated `sentura/dashboard/src/components/app-shell.tsx` to render the task status bar globally above page content, so active Lead/Screening progress remains visible when the user navigates to `记忆整理`.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`:
  - reads/writes rows through `useCbeEmployeeStore`;
  - starts global task records for `寻找客户`, `批量背调`, and `手动背调`;
  - routes runner progress into the store;
  - completes/fails tasks explicitly and retains failure notices instead of auto-clearing them after 8 seconds.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - exports Lead/Screening duration estimators and dynamic timeout helper;
  - progress now includes ETA/remaining time and percent;
  - hidden task timeout scales with task scope;
  - Gateway/RPC plain-object errors now surface their actual message instead of falling back to generic text;
  - Gateway submit errors keep `sessionKey` when one was already created.
- Updated `scripts/test-cross-border-agents.ts` with CE16 static guards for ETA/dynamic timeout, persistent CBE Employee store, global task status bar, failure/session-key retention, and removal of page-local `setTaskRunning`.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 310/310.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm build`: PASS. Build warning only: existing Next workspace-root inference warning due multiple lockfiles.
- `git diff --check` on touched files: PASS.
- Browser desktop:
  - `/client-demos/cross-border/employee/customers` loaded, Gateway showed connected after handshake, `寻找客户` drawer opened, no console errors.
  - `/client-demos/cross-border/employee/memory` loaded, Gateway connected, no console errors.
- Browser mobile 390px:
  - `/client-demos/cross-border/employee/customers` had no horizontal overflow, action buttons and navigation remained visible, no console errors.

### Caveat

This fix intentionally did not click final submit buttons during verification, to avoid new live external search, LLM, and paid/limited provider calls. The verified claim is UI/state/runtime-path robustness for progress display and route navigation, plus existing hidden-runner static coverage. A fresh live E2E can still be run separately when the user wants to spend provider/API calls.

## 2026-06-15 — Employee screenshot polish and filter fix

### User report

The user attached `/Users/purest./Desktop/截屏2026-06-15 22.04.38.png` and requested three Employee UI fixes:

1. Keep only the top `正在读取后台任务进度` progress surface and remove the duplicate lower customer-page progress strip.
2. Make the top-right `本月 API 成本` box scale on hover and open a clickable detail view showing each cost consumption record.
3. Translate the `筛选客户` drawer's English labels to Chinese while preserving product terms such as `USB-C` and `OLED`; fix the filtering bug where selected filters did not return correct rows.

### Changes made

- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`:
  - stopped emitting page-local info/success notices for task progress/completion, so ongoing task progress is surfaced by the global `EmployeeTaskStatusBar` only;
  - added canonical buyer-type and product filter values, with Chinese display labels for rows, chips, mobile cards, detail sheets, and filter options;
  - preserved product-specific terms in display labels such as `USB-C 充电器`, `OLED 屏幕`, and `MagSafe 配件`;
  - changed `foundAtInRange` to use the current browser date instead of the stale fixed date `2026-06-14`.
- Updated `sentura/dashboard/src/components/cross-border/employee-cost.tsx`:
  - turned `EmployeeCostMini` into a clickable, hover-scaling button;
  - added `本月 API 成本明细` dialog backed by the existing `sentura.cost.events` records, listing time, employee, model, usage, duration, and cost for each event.
- Updated `scripts/test-cross-border-agents.ts`:
  - added CE16 regression checks for global-only progress, canonical Chinese filters, current-date range filtering, and per-call cost details.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`:
  - CE16 now records 22 checks and `scripts/test-cross-border-agents.ts` at 315/315.

### Verification

- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/components/cross-border/employee-cost.tsx src/app/client-demos/cross-border/employee/customers/page.tsx`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 315/315.
- `cd sentura/dashboard && pnpm build`: PASS. Warning only: existing Next workspace-root inference warning due multiple lockfiles.
- Browser check on `http://localhost:3000/client-demos/cross-border/employee/customers`:
  - customer list displays Chinese buyer/product labels, with `USB-C 充电器` and `OLED 屏幕` preserved;
  - clicking `本月 API 成本` opens `本月 API 成本明细` with per-call rows from real cost events;
  - selecting `USB-C 充电器` in `筛选客户` narrows the table to `Nordic Accessories AB` and shows chip `产品：USB-C 充电器`;
  - main page has no lower duplicate `正在读取后台任务进度` notice.

### Remaining boundary

This was a UI/filter/cost-detail fix. It did not add production persistence or billing-grade external-provider cost ingestion, and it did not trigger new live Lead/Screening/Accio employee submit calls.

## 2026-06-15 — Employee notification center and logo cleanup

### User report

The user asked what the bell icon does, then requested:

1. Make it actually useful, and show a red numeric badge after tasks complete to reflect notification count.
2. Remove `sentura-logo-icon.svg` from the top-left header because the platform showed two logos; keep only `sentura-logo-side.svg` and preserve a clean layout.

### Changes made

- Updated `sentura/dashboard/src/components/app-shell.tsx`:
  - replaced the header bell's static hash link with a real `消息中心` popover;
  - reads completed/failed Lead/Screening task records from `useCbeEmployeeStore`;
  - shows a red unread count badge on the bell when terminal task notifications have not been read;
  - persists read task IDs in `localStorage` under `sentura-cbe-notification-read-task-ids-v1`;
  - supports row click-to-read and `全部已读`;
  - links task notifications back to the customer work page;
  - removed the standalone `sentura-logo-icon.svg` image and kept only `sentura-logo-side.svg` plus the Chinese subtitle.
- Updated `scripts/test-cross-border-agents.ts`:
  - added static guards for the real notification center, unread badge, and single-logo header.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`:
  - CE16 now records 24 checks and `scripts/test-cross-border-agents.ts` at 317/317.

### Verification

- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/components/app-shell.tsx`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 317/317.
- `cd sentura/dashboard && pnpm build`: PASS. Warning only: existing Next workspace-root inference warning due multiple lockfiles.
- Browser DOM check on `http://127.0.0.1:3000/client-demos/cross-border/employee/customers`:
  - header loaded only `/sentura-logo-side.svg`;
  - header did not load `/sentura-logo-icon.svg`;
  - header rendered the `消息中心` button with dialog semantics and no console errors.
- Browser automation note: this Browser session did not trigger any page click handlers, including existing unrelated controls such as `寻找客户`, so the bell popover click path was validated by source/static/type/build checks rather than a successful Browser click.

### Remaining boundary

The notification center is backed by the existing client-persisted CBE Employee task store. It is suitable for the current local Employee flow, but it is not yet a production multi-user notification database or push notification service.

## 2026-06-15 — Employee Lead/Screening parallel task gating

### User request

The user asked to implement the assessed behavior: on the same Employee `获客与背调` page, allow `寻找客户` and `背调` to run at the same time, with one active task allowed per task kind.

### Changes made

- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`:
  - replaced the previous single `activeTask` / `taskRunning` gate with independent `leadRunning` and `screeningRunning` checks;
  - `寻找客户` now blocks only when another Lead task is active;
  - `批量背调` and `手动背调` now block only when another Screening task is active;
  - sheet submit buttons and notices now explain that the other task type can continue running concurrently;
  - same-kind duplicates remain blocked to avoid uncontrolled repeated submissions.
- Updated `sentura/dashboard/src/components/cross-border/employee-task-status.tsx`:
  - changed the global Employee task status bar from one visible active task to up to two visible active tasks;
  - added a compact `正在同时运行` label when Lead and Screening are both active.
- Updated `scripts/test-cross-border-agents.ts`:
  - added static guards for independent Lead/Screening task gates;
  - added static guards for multi-task status-bar rendering.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`:
  - CE16 now records 29 checks and `scripts/test-cross-border-agents.ts` at 322/322.

### Verification

- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/app/client-demos/cross-border/employee/customers/page.tsx src/components/cross-border/employee-task-status.tsx`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 322/322.

### Remaining boundary

This pass intentionally implements one Lead plus one Screening task on the same Employee page. It does not implement unlimited same-kind task concurrency, cross-user database-backed queueing/dedupe, or a new production notification system. Live task-submit E2E was not newly clicked in this pass to avoid additional external search/LLM/API spend.

## 2026-06-16 — Employee Screening long-report timeout and Lead target-count fix

### User report

The user tried running `寻找客户` and `背调` at the same time. `寻找客户` succeeded, but the `背调` task showed a timeout/failure card. The user also reported that selecting 20 targets in `寻找客户` still produced only 5 leads, and asked for arbitrary manual target-count input with strict target-count behavior.

### Root cause

- The failed-looking Screening task was not a backend execution failure. The OpenClaw session mapped to the screenshot key completed on the backend.
- The session JSONL contained a final assistant message with both `SCREENING_REPORTS_JSON_START` and `SCREENING_REPORTS_JSON_END`.
- That final assistant text was 10,570 characters, longer than the default chat-history text projection used by the frontend polling path.
- The hidden runner polled `chat.history` without an explicit high `maxChars`, so the frontend could miss the end marker and report `等待后台 AI 员工返回结构化结果超时。` even though the backend had already returned the structured report.
- Lead Discovery was capped by the prompt itself: `buildLeadPrompt()` told the employee to prefer 1-5 high-quality candidates, so a requested target count such as 20 was contradicted by the task instructions.

### Changes made

- Updated `sentura/dashboard/src/lib/gateway/client.ts`:
  - `GatewayClient.getTranscript(...)` now accepts an optional `maxChars` argument and forwards it to `chat.history`.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - hidden employee polling now requests `HIDDEN_TASK_TRANSCRIPT_MAX_CHARS = 300_000`;
  - hidden task timeout grace was widened for longer real Screening runs;
  - Lead prompt no longer contains the old 1-5 candidate cap;
  - Lead prompt treats `target_count` as the requested count and asks for `shortage_reason` only when compliant public sources remain insufficient;
  - parsed Lead rows are capped to the normalized requested target count, so employee over-return cannot insert more rows than requested.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/customers/page.tsx`:
  - fixed `寻找客户` target quantity from preset buttons to manual numeric input;
  - validates and normalizes target count to integer `>= 1`;
  - passes the normalized count into the hidden Lead Discovery runner.
- Updated `scripts/test-cross-border-agents.ts`:
  - added static guards for high-`maxChars` history reads, hard target-count prompt behavior, manual numeric target input, and over-return row capping.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`:
  - CE16 now records 33 checks and `scripts/test-cross-border-agents.ts` at 331/331.

### Verification

- Evidence check against the reported Screening session JSONL: final assistant text had 10,570 characters, included both Screening JSON markers, and exceeded the default frontend history projection.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/gateway/client.ts src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts src/app/client-demos/cross-border/employee/customers/page.tsx`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 331/331.

### Remaining boundary

The target count is now treated as a hard requested count and over-return is capped. The system will not fabricate companies to fill an arbitrary number; if public sources and exclusion rules leave fewer compliant buyer companies than requested, the employee should return fewer rows with `shortage_reason`.

## 2026-06-16 — Employee API cost truth fix

### User report

The user opened `本月 API 成本明细` and saw only `gpt-5.5` model usage, while the platform status page showed many connected investigation sources: Tavily/web_search, Companies House, RDAP, DNS MX/SPF/DMARC, Abstract Email Reputation, Hunter Email Verifier, SEC EDGAR, ImportYeti, and official website contact search. The user asked whether those key/API-call costs were counted and requested the most truthful API cost details.

### Root cause

- `sentura-cost` originally modeled cost rows as LLM calls and captured OpenClaw `model.usage` diagnostics/session-log usage.
- Cross-border investigation APIs were invoked through OpenClaw tool calls and MCP `toolResult` logs, but those tool results were not converted into `sentura.cost.events` rows.
- As a result, the Employee cost detail could look like only OpenAI model usage existed, even when real external investigation tools had been called.

### Changes made

- Updated `sentura/extensions/sentura-cost/src/types.ts`:
  - added `model`, `external_api`, and `local_tool` event kinds;
  - added pricing status, service/interface labels, operation labels, tool names, HTTP status, pricing notes, and external usage units such as request, credit, page, and local call.
- Updated `sentura/extensions/sentura-cost/src/session-log-backfill.ts`:
  - reads assistant `toolCall` IDs and matching `toolResult` rows from OpenClaw session JSONL files;
  - backfills external CBE tool calls into cost events for Companies House, RDAP, DNS, Abstract Email Reputation, Hunter Email Verifier, SEC EDGAR, ImportYeti, Tavily/web_search, public web fetches, official contact search, and local scoring;
  - records free/public sources as `$0`, provider-included responses such as ImportYeti `requestCost=0` as included `$0`, priced/estimated services only where a safe unit price is available, and unpriced provider calls without inventing USD.
- Updated `sentura/extensions/sentura-cost/index.ts` and dashboard gateway cost types so live diagnostic rows and backfilled rows share the richer schema.
- Updated `sentura/dashboard/src/components/cross-border/employee-cost.tsx`:
  - `本月 API 成本明细` now labels rows as model, external backfill, model backfill, live record, real USD, estimated, free, included, or unpriced;
  - table column changed from model-only wording to `服务 / 接口`;
  - visible usage strings now show external units such as requests, credits, pages, or local calls.
- Updated tests:
  - `scripts/test-week4-cost.ts` covers model session-log backfill and external tool-log backfill, including ImportYeti included `$0`, Abstract unpriced request visibility, Hunter 0.5-credit visibility, and DNS free public infrastructure.
  - `scripts/test-cross-border-agents.ts` guards the richer cost schema, external CBE backfill support, and Employee cost detail UI.

### Verification

- `pnpm exec tsx scripts/test-week4-cost.ts`: PASS, 37/37.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 333/333.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/components/cross-border/employee-cost.tsx src/lib/gateway/types.ts`: PASS.
- Direct probe over local `~/.openclaw` session logs after the code change collected 220 total cost events: 83 model/session rows and 137 external tool-log rows.

### Remaining boundary

The cost view is now truthful about observed model and external tool/API calls in OpenClaw logs. It still does not claim billing-grade reconciliation against each provider's invoice. Abstract/Hunter and similar subscription or credit-plan services are shown as requests/credits with `未折算美元` unless the platform has a safe per-call conversion for the current account plan. ImportYeti uses provider response metadata such as `requestCost`; when that value is `0`, the row is shown as included/zero spend rather than converted to an artificial dollar amount.

## 2026-06-16 — Employee repeated Screening timeout fix

### User report

The user attached a notification-center screenshot showing `单个背调` failed with `等待后台 AI 员工返回结构化结果超时。`, timestamp `06/16 01:22`, `需要处理 1 个客户`.

### Root cause

- This later failure was different from the earlier 10,570-character marker truncation bug.
- The matching `cbe-buyer-screening` OpenClaw session reached backend status `done`, but its final assistant message had `stopReason: "aborted"` and `errorMessage: "LLM idle timeout (120s): no response from model"`.
- The trajectory recorded `finalStatus: "error"`, `aborted: true`, `timedOut: true`, and `idleTimedOut: true`.
- The session had already executed evidence tools before failing. One SEC EDGAR tool result was about 64 KB because the MCP adapter returned the full SEC submissions object, increasing context volume before the final structured report generation.
- The Employee hidden runner only waited for JSON markers and did not inspect transcript error metadata, so it displayed the generic Chinese marker-timeout message instead of the real backend model timeout.

### Changes made

- Updated `sentura/mcp-servers/cross-border-intel/src/tools.ts`:
  - `cbe_intel_sec_lookup` now returns entity metadata plus `submissions_summary`;
  - `submissions_summary` contains recent filing count, bounded form list, and the latest 8 filing records;
  - the full `submissions` object is no longer returned to the model.
- Updated `sentura/mcp-servers/cross-border-intel/src/server.test.ts`:
  - SEC lookup test now creates 40 mocked filings;
  - verifies the result has no `submissions` property;
  - verifies only 8 recent filings are returned;
  - enforces a compact serialized payload threshold.
- Updated `sentura/dashboard/src/lib/gateway/types.ts`:
  - `TranscriptMessage` now includes optional `stopReason`, `errorMessage`, and an index signature for gateway transcript metadata.
- Updated `sentura/dashboard/src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`:
  - hidden polling inspects transcript `errorMessage` and `stopReason`;
  - `LLM idle timeout` now becomes a specific `backend_error` message: `后台模型在工具调用后超时，未能生成结构化报告：...`;
  - aborted empty assistant messages are surfaced as backend generation aborts instead of waiting for the generic marker timeout.
- Updated `scripts/test-cross-border-agents.ts`:
  - added CE16 guards for backend model failure surfacing and compact SEC lookup output.
- Updated docs/tests/memory for CE16 335/335 coverage.

### Verification

- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 17/17.
- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/gateway/types.ts src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts`: PASS.
- `cd sentura/dashboard && pnpm build`: PASS. Warning only: existing Next workspace-root inference warning due multiple lockfiles.
- Restarted the local runtime after rebuilding MCP: Gateway is running on `http://localhost:18789`, Dashboard is running on `http://localhost:3000`, demo URL is `http://localhost:3000/client-demos/cross-border/employee`.

### Remaining boundary

This pass did not rerun a new paid/live Screening submit, to avoid spending additional LLM/provider calls while the failing session already contained the backend evidence. The old failed notification remains a historical failed task record in the client-persisted task list; new failures should show the real backend model error, and new SEC lookups should avoid the oversized submissions payload.

## 2026-06-16 — Next-phase planning readout

### Context read

- Read `docs/MEMORY.md`, `outputs/resume_card.md`, `outputs/task_handoff.md`, this file's latest CBE sections, and the relevant database/concurrency sections in `跨境电商/DESIGN.md`, `MARKET_ACQUISITION.md`, `SCREENING.md`, `MEMORY_PROCESSING.md`, and `UI.md`.
- Latest state: Employee UI and hidden OpenClaw task runner are mostly complete; CE4/CE5/CE6/CE7/CE16 offline coverage is green; recent fixes handled long Screening marker output, Lead target-count behavior, cost visibility, task progress, notifications, filters, and backend failure surfacing.

### Recommendation

The next phase should start with the shared CBE business database and typed persistence/store layer, not more page polish or isolated prompt tuning. The current blocker for production work is that customers, task records, notifications, reports, and memory previews are still effectively client-persisted/local-state artifacts. Database-backed `agent_runs`, Lead/Screening/Accio records, evidence rows, `api_call_ledger`, and handoff records are prerequisites for multi-user behavior, dedupe, audit, retry, and load testing.

Suggested order:

1. Implement tenant-scoped CBE database schema/migrations plus a typed store boundary for validated Dashboard writes after employee JSON marker parsing.
2. Replace Employee localStorage as source of truth for customer rows, task records, reports, notifications, and memory records; keep localStorage only for drafts/cache if useful.
3. Add Lead Discovery run-scope coordinator with `scope_hash`, leases, memberships, shared result pools, identity dedupe, and top-up-only reruns.
4. Tune the three employees against durable contracts: Lead incremental/top-up batches, Screening bounded evidence/partial failure handling, and Accio upload/redaction/approval-to-memory.
5. Add automated duplicate-run and 50-user/load-smoke coverage once the store and coordinator exist.

### Boundaries

- Keep one Gateway with three persistent CBE employees for this single customer trust boundary.
- Do not give employees raw database access; use Dashboard route handlers first or a typed `cross-border-store` MCP/Sentura plugin boundary.
- True live E2E still depends on a supported sandbox runtime on the target environment, or an explicit unsafe local-only sandbox-off override for short debugging.

## 2026-06-16 — Phase 2 execution plan

### User request

The user asked to put the next work into `跨境电商/PHASE-2.md`, including a detailed schedule and implementation method, and to base it on the existing documentation.

### Inputs read

- `跨境电商/PHASE-2.md` was present but empty.
- Read the relevant Phase-2 source sections in `跨境电商/DESIGN.md`, `UI.md`, `MARKET_ACQUISITION.md`, `SCREENING.md`, and `MEMORY_PROCESSING.md`.
- Checked the existing CBE test matrix/detail and the latest memory/handoff entries.
- Verified current official implementation references for Next.js App Router route handlers, PostgreSQL row locks / `SKIP LOCKED`, and OpenClaw Gateway/MCP/sandbox tool policy.

### Changes made

- Filled `跨境电商/PHASE-2.md` with:
  - source alignment table tying the plan to the existing CBE docs;
  - Phase 2 goals and non-goals;
  - P2.1-P2.6 execution order;
  - PostgreSQL-compatible tenant-scoped schema and minimum indexes;
  - typed store and Next.js route-handler boundary;
  - plan to move Employee state off `localStorage`;
  - Lead Discovery coordinator algorithm with `scope_hash`, leases, memberships, shared pools, near-duplicate choices, and top-up-only denylist;
  - durable Screening and Accio persistence/approval workflows;
  - backpressure/load-smoke plan;
  - expected implementation file map, test roadmap, acceptance criteria, risks, and immediate next task.
- Updated `README.md`, `AGENTS.md`, and `跨境电商/DESIGN.md` to expose `PHASE-2.md` as the production/database/concurrency entrypoint.
- Added CE17 to `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md`.

### Verification

- Documentation link/static verification and `git diff --check` were run after the edits.

### Boundary

No production database code or route implementation was added in this session. The next implementation task is P2.1: schema/migrations, DB config loading, seed tenant/users, and `scripts/test-cross-border-phase2-store.ts`.

## 2026-06-16 — Phase 2 user stratification

### User request

The user asked to add a section for user stratification, covering admin and ordinary-user permissions, permission boundaries, and database-design distinctions.

### Changes made

- Updated `跨境电商/PHASE-2.md`:
  - added `## 2.1 User Stratification And Permission Boundary`;
  - mapped Sentura RBAC roles into CBE product roles: `admin`, `employee`, `auditor`, `viewer`;
  - documented admin-only capabilities versus ordinary employee capabilities;
  - added auditor/viewer boundaries;
  - added `cbe_user_profiles`, admin capability flags, row-level `owner_user_id` / `created_by_user_id` / `department_id` / `visibility_scope` fields, and admin-only `cbe_budget_policies` / `cbe_data_source_settings`;
  - updated typed tenant context, admin route handler plan, file map, indexes, and seed expectations.
- Updated `跨境电商/DESIGN.md` with the Phase 2 user-stratification pointer and DB/RBAC summary.
- Updated `跨境电商/UI.md` with visible role/navigation differences, Admin modules, ordinary-user restrictions, and UI data model scope fields.
- Updated `README.md` and `AGENTS.md` so Phase 2 is described as production/database/RBAC/concurrency work.
- Updated CE17 in `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md` from 14 to 19 review checks.

### Verification

- Static review and `git diff --check` were run after the edits.

### Boundary

This is a design/documentation update only. No RBAC runtime code, database migration, admin page, or route handler implementation was added yet.

## 2026-06-16 — Phase 2 customer Admin monitoring redesign

### User request

The user clarified that the customer does not need the original Sentura-platform-style user hierarchy. This cross-border customer is not buying an employee-creation console. The current UI is what ordinary users should use and see. Admin should mainly monitor and inspect: which employee is calling which Agent to investigate what, aggregate acquisition/screening lists, per-employee lists, and statistics.

### Decision

The previous broad CBE role plan (`admin`, `employee`, `auditor`, `viewer` mapped from Sentura RBAC) is now superseded for this customer lane. Current Phase 2 design uses only two customer-facing levels:

- `operator` / 普通用户 / 业务员工: uses existing `个人中心`, `获客与背调`, and `记忆整理` pages; starts Lead/Screening/Accio tasks; sees own/shared work.
- `admin` / 管理员 / 业务主管: read-mostly customer supervisor; monitors live/recent Agent task activity, aggregate lead/screening results, per-user lists, per-agent usage, cost, failures, and business statistics.

Admin is not a Sentura platform administrator. The CBE customer UI must not expose AI employee creation, prompt tuning, provider/model/key settings, OpenClaw config, Gateway config, MCP server config, sandbox/tool-policy changes, or duplicate-run bypass.

### Changes made

- Updated `跨境电商/PHASE-2.md`:
  - renamed the section to `## 2.1 Customer User Levels And Permission Boundary`;
  - defined `operator` and `admin` only;
  - described ordinary-user permissions around the existing UI;
  - described Admin monitoring modules: `总览`, `实时任务`, `获客与背调汇总`, `员工视图`, and `Agent 使用统计`;
  - added monitoring fields on `agent_runs` and a new `agent_run_activity_events` table;
  - changed route planning to read-mostly Admin monitoring endpoints: `overview`, `live-tasks`, `customers`, `operators`, `operators/[id]`, and `agent-usage`;
  - updated `resolveCbeTenantContext` to return CBE role and data scope without old capability flags.
- Updated `跨境电商/UI.md` so the Admin page is a customer supervisor console, while ordinary users keep the already-built Employee UI.
- Updated `跨境电商/DESIGN.md` to remove current-facing `auditor`/`viewer` and Admin-management language from the CBE role/database summary.
- Updated `README.md` and `AGENTS.md` so Phase 2 is described as production/database/customer-admin-monitoring/concurrency work, not RBAC platform work.
- Updated CE17 in `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md` to validate the two-level customer model, Admin monitoring boundary, activity-event database design, and Admin monitoring route plan.
- Updated `docs/MEMORY.md` with a new matrix row for this superseding design decision.

### Verification

- Static review of current design docs for old CBE role-model remnants.
- `git diff --check` was run after the edits.

### Boundary

This is still a design/documentation update only. No database migration, store module, Admin page, route handler, or runtime permission enforcement code was implemented in this pass.

## 2026-06-16 — Phase 2 P2.1 business database foundation

### User request

The user asked to start the next phase from `跨境电商/PHASE-2.md` 2.1/P2.1, using the local PostgreSQL installation (`postgres` user on port 5432), strictly follow the plan, and check the implementation.

### Scope

Implemented the P2.1 foundation only:

- Database schema/migration files.
- `CBE_DATABASE_URL`-driven DB config loading.
- Migration runner and deterministic seed data.
- One customer tenant, one `admin`, and two `operator` profiles.
- Dashboard-side CBE role/module boundary constants for later P2.2 route work.
- CE18 verification script with static and live PostgreSQL checks.

Did not start P2.2 route handlers, P2.3 UI localStorage migration, P2.4 Lead coordinator transactions, or Admin pages.

### Files changed

- Added `sentura/lib/cross-border-store/migrations/001_initial_schema.sql`:
  - `tenants`, `sentura_users`, `cbe_user_profiles`;
  - `agent_runs`, `agent_run_activity_events`;
  - Lead, Screening, Accio, handoff, memory fact, API ledger, and audit tables;
  - owner/team/visibility fields;
  - required indexes;
  - projection views `cbe_customer_work_items`, `cbe_operator_workload_daily`, and `cbe_agent_usage_daily`.
- Added `sentura/lib/cross-border-store/migrations/002_lead_scope_coordinator.sql`:
  - `lead_discovery_scopes`, `lead_run_memberships`, `lead_identities`, `lead_run_results`, and `lead_allocations`;
  - active-scope, membership, identity, and allocation indexes.
- Added `sentura/lib/cross-border-store/db.ts`, `ids.ts`, `schemas.ts`, `seed.ts`, `migrate.ts`, and `index.ts`.
- Added `sentura/dashboard/src/lib/cross-border-store/index.ts` with CBE customer role and module constants.
- Updated `sentura/lib/index.ts`, `sentura/lib/package.json`, and `sentura/lib/tsconfig.json` so the cross-border store can be exported/typechecked.
- Added root dependencies `pg` and `@types/pg`.
- Added `scripts/test-cross-border-phase2-store.ts`.
- Updated `跨境电商/PHASE-2.md` so P2.1 is marked complete and the immediate next task is P2.2.
- Updated `docs/TESTS.md` and `docs/tests/tests-cross-border-ecommerce.md` with CE18.

### Local database work

- `psql` was not on the current shell PATH, but node-postgres could connect to local PostgreSQL on port 5432.
- Created local development database `sentura_cbe_dev`.
- Ran migrations and seed through `CBE_DATABASE_URL` pointing at `sentura_cbe_dev`.
- Re-ran migrations to confirm no-op behavior.

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 64/64 static checks.
- `CBE_DATABASE_URL=... pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db`: PASS, 74/74 static + live DB checks.
- `CBE_DATABASE_URL=... pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS; skipped both already-applied migrations and returned seed counts `seededUsers=3`, `adminProfiles=1`, `operatorProfiles=2`.
- Focused TypeScript compile for new store/test files: PASS.
- `cd sentura/dashboard && pnpm exec tsc --noEmit`: PASS.
- `cd sentura/dashboard && pnpm exec eslint src/lib/cross-border-store/index.ts`: PASS.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 335/335.
- `git diff --check`: PASS.

### Known boundary

Full `sentura/lib` typecheck is still blocked by pre-existing `.ts` import-extension errors in `config-versioning.ts`, `per-agent-mcp.ts`, and `secrets.ts`. The new cross-border store files were typechecked directly under strict NodeNext settings.

Next implementation step is P2.2: typed store API and Next.js route handlers that validate employee marker JSON before DB writes.
