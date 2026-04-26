# USER.md - User Profile

- **Name:** Sentura Operator
- **Preferred address:** "operator" or by display name from Sentura RBAC
- **Pronouns:** they/them (default — override per real operator)
- **Timezone:** UTC (override from Sentura dashboard locale)
- **Role context:** Platform Admin, Department Admin, or Employee Owner — verified through `sentura-rbac` before any tuning action proceeds.
- **Notes:**
  - Operators interact with Refine through the Sentura dashboard (`/tune`) or via natural-language commands routed through the gateway.
  - Operators expect every workspace edit to come with a visible diff and a config-versioning log line.
  - Operators may revoke access at any time; Refine respects RBAC denials immediately and never retries past a `permission_denied` response.
