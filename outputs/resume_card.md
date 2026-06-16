# Sentura CBE Resume Card

Workspace: `/Users/purest./Documents/Sentura/Sentura-Platform`

Conversation language: Chinese for user-facing replies. Keep handoff notes concise English with exact Chinese UI labels.

Completed task, 2026-06-16:

- User tried same-page parallel `寻找客户` + `背调`.
- Observed: Lead succeeded, Screening showed `等待后台 AI 员工返回结构化结果超时。`
- User also reports Lead target count set to `20` but only 5 leads are returned.

Findings:

- Screenshot Screening session key maps to session id `a118d03c-331d-4a57-91f7-c36820081c1d`.
- OpenClaw session status was `done`, runtime about 168s, and the final assistant message was 10,570 characters with both `SCREENING_REPORTS_JSON_START/END`.
- Frontend still failed because `chat.history` defaults to about 8000 chars per assistant message; the long Screening JSON was truncated before `SCREENING_REPORTS_JSON_END`, so the hidden runner never parsed it.
- Lead only returning 5 is caused by `buildLeadPrompt()` saying `优先返回 1-5 个高质量候选`, even when `target_count` is 20.

Completed fix:

- Dashboard `GatewayClient.getTranscript()` now passes optional `maxChars` into `chat.history`.
- Hidden employee runner requests `300_000` chars for structured marker parsing.
- Lead prompt treats `target_count` as the requested count and removes the 1-5 cap.
- Employee Lead `目标数量` is now a manual numeric input (`min=1`, normalized integer), not preset buttons.
- Parsed Lead rows are capped to the requested target count to prevent over-return inserts.
- Updated CBE static checks/docs/handoff.
- Verification completed so far:
  - `cd sentura/dashboard && pnpm exec tsc --noEmit`: pass
  - `cd sentura/dashboard && pnpm exec eslint src/lib/gateway/client.ts src/app/client-demos/cross-border/employee/_data/employee-task-runner.ts src/app/client-demos/cross-border/employee/customers/page.tsx`: pass
  - `pnpm exec tsx scripts/test-cross-border-agents.ts`: `331 passed, 0 failed`
  - `cd sentura/dashboard && pnpm build`: pass; existing Next workspace-root warning only
  - `git diff --check`: pass

Boundary:

- The system will not invent companies to hit an arbitrary number. If compliant public sources are insufficient, the employee should return fewer rows with `shortage_reason`.
