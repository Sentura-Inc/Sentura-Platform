# Sentura CBE Resume Card

Workspace: `/Users/henry/Desktop/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese product/customer/UI names unchanged.

Active product area: Cross-border e-commerce / 跨境电商 Phase 2 production hardening.

Latest implementation, 2026-06-22:

- Added the dedicated Screening company-address table requested by the user.
- New migration: `sentura/lib/cross-border-store/migrations/006_screening_address_locations.sql`.
- New table: `screening_address_locations`, tenant-scoped and linked to `screening_reports`, `screening_targets`, optional `lead_candidates`, optional `agent_runs`, user/team/visibility scope, company/domain identity, Google place id, formatted address, address type, relationship status, city/country, business status, website, match flags, Address Validation JSON, Maps URI, confidence, reasons, source type, and timestamps.
- `saveScreeningReports` now writes every `address_footprint.locations[]` row into `screening_address_locations` in the same transaction as the report. `screening_reports.report_json` remains the full report snapshot.
- The migration backfills any existing report JSON address-footprint rows and local dev DB migration was applied successfully.
- Delete/cleanup paths now clear address rows with reports/customers so FK cleanup stays consistent.
- Real live store round-trip against the local CBE dev DB verified `saveScreeningReports` writes and reads a `screening_address_locations` row.

Previous implementation, 2026-06-22:

- Implemented the approved 背调 Agent Google Maps address-footprint path.
- Screening now requires a dedicated `Google Maps 地址版图` / `address_footprint` report object for every target, even when Maps is unavailable or no locations are found.
- Hidden Employee and legacy Screening prompts require bounded Places Text Search variants, Place Details with `field_mask_profile="screening_address_footprint"`, Address Validation for complete addresses, dedupe by place id/address/phone/domain/name, relationship/address-type classification, and non-KYB scoring boundaries.
- Dashboard now normalizes, persists, restores, and renders `address_footprint` through the shared report dialog as a distinct panel after the conclusion and before score/evidence details.
- Store schemas now accept `address_footprint`; completion/activity/audit metadata records saved address-footprint location counts.
- `cross-border-intel` now exposes the `screening_address_footprint` Place Details field-mask profile and mocked test coverage.
- Live `~/.openclaw/workspace/cbe-buyer-screening` behavior files were synced for `TOOLS.md`, `evidence-collection`, `report-writing`, and `buyer-scoring`; top-level markdown files remain exactly the 8 OpenClaw-native files and no `RULES.md`/`CONTEXT.md` exists.

Latest P2.4 audit, 2026-06-22:

- Full P2.4 scope was rechecked against `跨境电商/PHASE-2.md`, CE21 test contract, implementation source paths, and live PostgreSQL behavior.
- Conclusion: P2.4 is complete. It covers global CBE workload admission/queue metadata, env-backed caps, tenant admission lock, active-session counting by non-null `session_key`, Lead exact join / near-duplicate choice / top-up decisions, Employee hidden-run gating, pre-search DB denylist, completion-time DB reconciliation, and failure scope release.
- Verification rerun:
  - CE21 static: 21/21 PASS.
  - CE21 live PostgreSQL: 38/38 PASS.
  - Phase 2 store static/live: 184/184 and 204/204 PASS at that audit; current post-address-table counts are 194/194 static and 216/216 live below.
  - CBE agent regression at that audit: 403/403 PASS; current post-address-footprint regression is 406/406 below.
  - Dashboard `tsc --noEmit`: PASS.
  - Dashboard production build: PASS, with only the known Next multiple-lockfile workspace-root warning.
  - `git diff --check`: PASS before final memory/handoff docs.
- Remaining work is not P2.4: queue draining/claim outside the original browser request, Screening parent/child fan-out, durable Screening/Accio workflow polish, and P2.6 load smoke.

Latest live audit, 2026-06-22:

- Inspected two new Dashboard Lead Discovery runs and one Screening run after the Google Maps integration.
- Lead run `17f94f97-3c0e-4f9a-9113-d3b61b50a140`: completed, target 5, saved 5, Google Places/Details calls succeeded.
- Lead run `a1bd63d9-38c2-4a54-986b-7d8f9b7af987`: completed, target 5, saved 5, Google Places calls succeeded; one non-selected/intermediate Place Details call returned a recoverable HTTP 400, but the run completed and saved 5.
- Screening run `bcbf1824-def7-4085-bb8c-94fd5c649733`: completed for KIKO Group USA (KIKO Wireless), used Google Places Search, Place Details, and Address Validation successfully, and saved a `cautious` report with score 78.41, coverage 0.78, and 11 evidence items.
- No timeout, DB write failure, duplicate compression, or Google API key leakage was found in these three runs.

Latest completed task, 2026-06-21:

- Fixed the recurring Dashboard `寻找客户` timeout reported for `phone case / GB` after implementing Google Maps API integration.
- Follow-up audit of the user's next run found Google Maps succeeded, but the submitted prompt/DB `lead_runs.target_count` was 3, not 5; the 3-result output was not caused by Google failure or post-run dedupe.
- Root cause 1: the backend `cbe-lead-discovery` session did eventually produce valid `LEAD_CANDIDATES_JSON_START/END`, but it took about 5m09s, just beyond the tight UI/Gateway wait path.
- Root cause 2: live `~/.openclaw/openclaw.json` did not yet pass `GOOGLE_MAPS_API_KEY` into `mcp.servers.cross-border-intel.env`, so Google MCP calls returned `unavailable_api` and the employee fell back to slower web search.
- `cross-border-intel` now has 14 tools, including:
  - `cbe_intel_google_places_search`
  - `cbe_intel_google_place_details`
  - `cbe_intel_google_geocode`
  - `cbe_intel_google_address_validate`
- Google config is server-side only: `GOOGLE_MAPS_API_KEY`, optional endpoint overrides, and `CBE_GOOGLE_MAPS_*` request caps. Setup scripts now read project `.env`, `~/.openclaw/.env`, and process env, then inject key/cap references into MCP env when present.
- Lead Discovery is now Maps-first: Places Text/Nearby Search for local/storefront buyer seeds, Place Details for shortlisted enrichment, OpenClaw web search/fetch for company-owned site and mobile-accessory buyer-fit verification, then DB reconciliation for uniqueness/allocation.
- Screening uses Google Maps only as supporting public local-presence and address/website consistency evidence. It is not registry/KYB/trade/financial/fraud/Accio proof.
- Dashboard prompts, source/evidence enums, typed store schemas, report layers, diagnostic env status, and live OpenClaw workspaces were updated.
- Dashboard hidden Lead tasks now use longer Maps-plus-web estimates, propagate long `timeoutMs` through the Gateway client, treat `chat.send` timeout as recoverable when the transcript can still produce markers, and add a final 60s transcript grace window.
- The `寻找客户` drawer now snapshots the current target-count input ref at submit time and echoes `目标 N 个客户` in the summary/button so the submitted payload matches the visible number.
- Live workspace sync verified for:
  - `~/.openclaw/workspace/cbe-lead-discovery`
  - `~/.openclaw/workspace/cbe-buyer-screening`
  Both still have exactly the 8 native top-level OpenClaw markdown files; no `RULES.md`/`CONTEXT.md`.

Files intentionally edited include:

- `sentura/mcp-servers/cross-border-intel/src/{config.ts,schemas.ts,tools.ts,server.test.ts}`
- `sentura/mcp-servers/cross-border-intel/README.md`
- `scripts/sentura-setup.sh`
- `scripts/sentura-setup.ps1`
- `sentura/agents/cbe-lead-discovery/**`
- `sentura/agents/cbe-buyer-screening/**`
- `sentura/dashboard/src/app/client-demos/cross-border/**`
- `sentura/dashboard/src/lib/cross-border-store/**`
- `sentura/dashboard/src/lib/gateway/client.ts`
- `scripts/test-cross-border-agents.ts`
- `跨境电商/{API_KEYS_OPENCLAW_SETUP.md,DESIGN.md,MARKET_ACQUISITION.md,PHASE-2.md,SCREENING.md}`
- `docs/TESTS.md`
- `docs/tests/tests-cross-border-ecommerce.md`
- `docs/tests/tests-cross-border-phase2.md`
- `docs/MEMORY.md`
- `docs/memory/cross-border-ecommerce/phase-2.md`
- `outputs/resume_card.md`
- `outputs/task_handoff.md`

Verification completed:

- `pnpm --filter @sentura/mcp-cross-border-intel build`: PASS.
- `pnpm --filter @sentura/mcp-cross-border-intel test`: PASS, 23/23.
- Real Google Places smoke through MCP with configured API key: PASS, HTTP 200, `status="found"`, one candidate, `place_id`, and `google_maps_uri`; no raw key/full provider response printed.
- `pnpm exec tsx scripts/test-cross-border-agents.ts`: PASS, 406/406.
- `pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 194/194.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx scripts/test-cross-border-phase2-store.ts`: PASS, 216/216 static + live PostgreSQL, including true `screening_address_locations` write/read through `saveScreeningReports` and typed lookup.
- `CBE_DATABASE_URL=$CBE_DATABASE_URL pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed`: PASS, applied `006_screening_address_locations.sql`.
- `pnpm exec tsx scripts/test-cross-border-phase2-concurrency.ts`: PASS, 21/21.
- `pnpm --dir sentura/dashboard exec tsc --noEmit`: PASS.
- `bash -n scripts/sentura-setup.sh`: PASS.
- `git diff --check`: PASS.
- Live `cbe-buyer-screening` workspace sync and no-`RULES.md`/`CONTEXT.md` checks: PASS.
- Browser smoke: Dashboard dev server loaded, Manager login `孙总/1234` worked, 吴思彤 employee detail opened, and KIKO shared report dialog opened with no browser console errors. The existing KIKO report predates address-footprint implementation, so it did not contain `address_footprint`; verify populated `Google Maps 地址版图` on the next real Screening run.

`bash scripts/sentura-setup.sh` was rerun and redacted config checks confirmed Google env references are configured in `~/.openclaw/openclaw.json`.

Next:

- Rerun `git diff --check` after these memory/handoff edits.
- Tell user to restart the OpenClaw Gateway/MCP process and Dashboard dev server before retesting so the running processes pick up config/code changes.
