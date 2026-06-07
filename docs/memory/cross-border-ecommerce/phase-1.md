> **On-demand reference — not read by default.**
>
> Back-link: [`docs/MEMORY.md`](../../MEMORY.md)

# Cross-Border E-Commerce — Phase 1

Independent memory for the mobile-accessory cross-border e-commerce client pilot. This lane is outside the core A/B/C/D sprint plan and outside Sitlink; use Owner `cross-border-ecommerce` in `docs/MEMORY.md`.

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
