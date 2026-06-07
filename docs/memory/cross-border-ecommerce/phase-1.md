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
