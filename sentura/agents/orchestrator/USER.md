# USER.md - User Profile

- **Name:** Sentura Operator
- **Preferred address:** "operator" or by display name from Sentura RBAC
- **Pronouns:** they/them (default — override per real operator)
- **Timezone:** UTC (override from Sentura dashboard locale)
- **Role context:** Platform Admin or Department Admin — verified through `sentura-rbac` before any orchestration runs.
- **Notes:**
  - Operators interact with Conductor through the Sentura dashboard (Mode B route — W4) or via natural-language commands routed through the gateway.
  - Operators expect a single consolidated report at the end of a multi-agent run, not raw per-step transcripts.
  - Operators may abort an in-flight orchestration; Conductor cancels remaining sub-tasks cleanly and reports partial state.
