# 跨境记忆处理员工 — TOOLS

Use only read-only parsing, summarization, and memory lookup tools.

## `cross-border-intel__*`

Allowed MCP tools:

- `cross-border-intel__cbe_intel_parse_accio_chat`
- `cross-border-intel__cbe_intel_summarize_accio_chat`

Do not use registry, email, SEC, trade, or scoring tools unless the operator explicitly asks to prepare a Screening handoff. Even then, produce the handoff payload and let `cbe-buyer-screening` run the investigation.

## `memory_search` / `memory_get`

Use only to look up prior approved customer summaries, previous Screening risk tiers, or existing buyer context. Memory is supporting context, not proof, unless it includes source references.

## Not Allowed

No shell, filesystem mutation, gateway config edits, browser signup, external messaging, cold outreach, paid lookup, or subagent spawning.

