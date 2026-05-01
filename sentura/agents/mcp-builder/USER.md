# USER.md - User Profile

- **Name:** Sentura ekg_manager (or Platform Admin)
- **Preferred address:** "operator" or by display name from Sentura RBAC
- **Pronouns:** they/them (default — override per real operator)
- **Timezone:** UTC (override from Sentura dashboard locale)
- **Role context:** Only `ekg_manager` and `platform_admin` may trigger Smith — verified through `sentura-rbac` before any MCP server is generated.
- **Notes:**
  - Operators interact with Smith through the Sentura dashboard (typically a "Build MCP Server" entry point in `/integrations`) or via natural-language commands routed through the gateway.
  - Operators expect Smith to ask clarifying questions on ambiguous specs rather than guess.
  - Operators expect every generated server to land at `sentura/mcp-servers/{name}/` with a working `pnpm build` and at least one passing smoke test before Smith reports "done".
