# Sentura CBE Continuation Handoff

## Current Resume Snapshot

Default continuation rule: read `outputs/resume_card.md` first. Then read only this snapshot and `Next Steps` unless deeper history is required. Use `docs/MEMORY.md` as an index only when a specific prior row is needed.

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: answer the user in Chinese. Keep handoff updates concise English for token efficiency, while preserving exact Chinese UI labels when they matter.

Current active product area: Sentura cross-border e-commerce / 跨境电商 Phase 2 production hardening.

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

Maps can support public footprint/domain/business-fit evidence, but not legal identity or registry/KYB proof. A fresh live Dashboard Screening run still needs to be inspected after deployment/restart to confirm persisted reports now include `address_footprint` rows from real Google calls.

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
- Screening multi-target production-session block and P2.5 fan-out schema preparation.

### Verification

- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts --require-db`: PASS, 38/38.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 194/194.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216 static + live PostgreSQL, including true `screening_address_locations` write/read through `saveScreeningReports` and typed lookup.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS, applied `006_screening_address_locations.sql`.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 406/406.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `pnpm --dir sentura/dashboard build`: PASS; only the known Next multiple-lockfile workspace-root warning appeared.
- `git diff --check`: PASS before final docs update.
- Targeted `RULES.md` / `CONTEXT.md` scan under CBE agent source workspaces: PASS, no output.

### Boundary

Remaining work belongs to P2.5/P2.6, not P2.4: queued-work draining/claim outside the original browser request, Screening parent/child fan-out, durable Screening report/retry polish, paid-call retry state, Accio approval-to-memory promotion, Screening handoff consumption, and later load smoke.

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
- `pnpm --filter @sentura/mcp-cross-border-intel test`: 23/23
- Real Google Places smoke through MCP with configured API key: HTTP 200, `status="found"`, one candidate, `place_id`, `google_maps_uri`; no key/full response printed
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: 406/406
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: 194/194
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: 216/216
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

1. Rerun final hygiene after handoff updates:
   - `git diff --check`
   - optionally `git status --short`
2. In the final user response, note:
   - Backend actually returned a valid marker; the old UI wait path timed out too early.
   - Live MCP env lacked Google key references until setup was rerun; now fixed and verified with a real Google Places smoke.
   - Tests passed; restart Gateway/MCP and Dashboard dev server before retesting.
3. Remaining Phase 2 work is separate: Screening parent/child queue fan-out/draining, paid-call retry state, durable Screening report UX polish, Accio approval-to-memory promotion, and Screening handoff consumption.
