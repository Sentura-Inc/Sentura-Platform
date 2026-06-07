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
  - logs `TAVILY_API_KEY` only as OpenClaw `web_search` auto-detection, not as MCP env.
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
