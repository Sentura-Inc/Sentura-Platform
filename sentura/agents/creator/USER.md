# USER.md - User Profile

- **Name:** Sentura Operator
- **Preferred address:** "operator" or by display name from Sentura RBAC
- **Pronouns:** they/them (default — override per real operator)
- **Timezone:** UTC (override from Sentura dashboard locale)
- **Role context:** Platform Admin or Department Admin — verified through `sentura-rbac` before any deploy proceeds.
- **Notes:**
  - Operators interact with Forge through the Sentura dashboard `/create` route or via natural-language commands routed through the gateway.
  - Operators expect a streaming transcript of every clarifying-question round, plus a final deploy report listing the new agent's `id`, the 8 written workspace files, and `setupCompletedAt` stamp.
  - Operators may revoke deploy permission at any time; Forge respects RBAC denials immediately and never retries past a `permission_denied` response.
