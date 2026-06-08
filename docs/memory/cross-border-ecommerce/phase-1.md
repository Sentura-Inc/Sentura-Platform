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
| 2026-06-08 | Milestone 5 Screening employee and live background investigation | Added `cbe-buyer-screening`, setup registration, live Screening UI/API route, real configured-provider investigation path, and contextual score/coverage reporting; CE4+CE5 checks now pass 196/196 plus live smoke. |
| 2026-06-08 | Lead-to-Screening copy and state persistence | Added Lead copy-all/per-row Screening JSON, persisted Lead/Screening dashboard state across refresh/navigation, and expanded CE4+CE5 checks to 200/200 plus Browser validation. |
| 2026-06-08 | API-format audit and adapter fixes | Verified OpenClaw env substitution, corrected Abstract Email Reputation and ImportYeti request formats, and made non-2xx paid/official API responses coverage gaps rather than scored evidence. |
| 2026-06-08 | SEC/Companies House country routing | Confirmed SEC no-key access and Companies House REST Basic-auth requirements, then added US -> SEC and GB -> Companies House API/public-page automatic Screening routing. |
| 2026-06-08 | Public adverse scoring gate | Diagnosed Mobile Lab's 86/high-risk mismatch, restricted public adverse downgrades to target-specific company/domain evidence, and confirmed Companies House API 401 remains a coverage-only key/account failure with official public-page fallback. |
| 2026-06-08 | Screening execution-path correction | Corrected the Screening UI so formal investigations are submitted to the real `cbe-buyer-screening` OpenClaw employee through Gateway/AgentChat instead of being generated directly by the Dashboard route. |
| 2026-06-08 | Screening employee-report visual mapping | Normalized employee-returned Screening JSON aliases into the Dashboard report model so evidence and missing-evidence details render in visual panels and survive refresh restore. |
| 2026-06-08 | Screening official-source and paid-email ordering | Added official-site same-domain email discovery before paid validation, SEC company-name lookup before US web fallback, and stricter GB Companies House / US SEC employee ordering. |
| 2026-06-08 | Lead execution-path correction | Corrected the Lead Discovery UI so formal lead generation is submitted to the real `cbe-lead-discovery` OpenClaw employee through Gateway/AgentChat instead of being generated directly by the Dashboard Tavily route. |

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
