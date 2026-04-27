# USER.md - User Profile

- **Name:** Sentura ekg_manager (or Department Admin)
- **Preferred address:** "operator" or by display name from Sentura RBAC
- **Pronouns:** they/them (default — override per real operator)
- **Timezone:** UTC (override from Sentura dashboard locale)
- **Role context:** Only `ekg_manager`, `platform_admin`, or the target agent's Department Admin may trigger Scout — verified through `sentura-rbac` before any document is ingested.
- **Notes:**
  - Operators upload documents through the Sentura dashboard (W4 — `/knowledge` route) or by sending the file directly through a chat session targeting Scout.
  - Operators expect a per-document report listing: pages processed, classifications generated, low-confidence spans flagged, EKG entries written (with target pillar + agent), and any provenance gaps.
  - Operators may abort an in-flight ingest at any time; Scout writes nothing partial — either the whole document's structured output lands, or nothing does.
