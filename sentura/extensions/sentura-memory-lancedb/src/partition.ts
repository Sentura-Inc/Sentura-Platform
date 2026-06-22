/**
 * Pure scope-filter helper used by the search path.
 *
 * Extracted out of `MemoryDB.search` so the unit tests can exercise the
 * partition behaviour without spinning up an embedded LanceDB instance.
 *
 *   "user-plus-global"  — caller's own entries plus globals (default)
 *   "user-only"         — only the caller's own entries
 *   "global-only"       — partitioning disabled; all rows flow through
 *                         (matches upstream memory-lancedb behaviour)
 */

import type { UserTokenScope } from "../config.js";

export const GLOBAL_USER_TOKEN = "";

export interface ScopedEntry {
  userToken: string;
}

export function applyUserTokenScope<T extends ScopedEntry>(
  rows: T[],
  callerUserToken: string,
  scope: UserTokenScope,
  options?: { hasUserTokenColumn?: boolean },
): T[] {
  // Pre-migration tables fall through to "no filtering" so legacy memories
  // don't disappear. The plugin still works in degraded mode until the
  // operator runs `openclaw ltm migrate-userToken`.
  if (scope === "global-only" || options?.hasUserTokenColumn === false) {
    return rows;
  }
  if (scope === "user-only") {
    // An empty caller (raw CLI / no Sentura user attached) has no scope —
    // it cannot read anything in user-only mode, even though global rows
    // also carry `userToken === ""`. Otherwise CLI processes would be
    // able to read every user's "global" entries by accident.
    if (callerUserToken === GLOBAL_USER_TOKEN) return [];
    return rows.filter((r) => r.userToken === callerUserToken);
  }
  // user-plus-global (default)
  return rows.filter(
    (r) => r.userToken === callerUserToken || r.userToken === GLOBAL_USER_TOKEN,
  );
}
