"use client";

/**
 * Current-role hook + provider.
 *
 * Dev mode: role lives in a cookie (`sentura_dev_role`) so the server can
 * read it for SSR + API auth. localStorage is kept as a secondary mirror
 * for legacy code paths and `?as=<role>` URL one-shot overrides.
 *
 * Post-SSO: swap the cookie for an SSO-asserted session cookie. The hook
 * signature stays the same so callers don't refactor.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_DEV_ROLE,
  isRole,
  type Role,
} from "./roles";
import { writeRoleCookie } from "./role-cookie";

const STORAGE_KEY = "sentura.dev.role";
const URL_PARAM = "as";

interface RoleContextValue {
  role: Role;
  setRole: (next: Role) => void;
  /**
   * True when role-switcher UI should be shown (env-gated).
   * `NEXT_PUBLIC_ENABLE_ROLE_SWITCHER=1` to enable.
   */
  switcherEnabled: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function readPersistedRole(): Role {
  // SSR-safe: localStorage doesn't exist server-side. The provider's first
  // render uses the default; useEffect re-syncs from localStorage on mount.
  if (typeof window === "undefined") return DEFAULT_DEV_ROLE;
  try {
    // URL param takes precedence (useful for "open this link as auditor").
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get(URL_PARAM);
    if (fromUrl && isRole(fromUrl)) return fromUrl;

    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (fromStorage && isRole(fromStorage)) return fromStorage;
  } catch {
    // localStorage may throw in private browsing; fall through.
  }
  return DEFAULT_DEV_ROLE;
}

export function RoleProvider({
  children,
  initialRole,
}: {
  children: ReactNode;
  /**
   * Server-resolved initial role (from `getServerRole(req)`). When provided,
   * the first client render matches the server render — no hydration flash.
   * Falls back to `DEFAULT_DEV_ROLE` for tests / pages mounted standalone.
   */
  initialRole?: Role;
}) {
  const [role, setRoleState] = useState<Role>(initialRole ?? DEFAULT_DEV_ROLE);
  useEffect(() => {
    // Re-sync from localStorage / URL one-shot override after mount. If the
    // server already resolved the cookie, this is a no-op for the common case.
    const persisted = readPersistedRole();
    if (persisted !== role) {
      setRoleState(persisted);
      // Mirror to cookie too, in case localStorage drifted ahead of cookie.
      writeRoleCookie(persisted);
    }
    // intentionally only run on mount — subsequent role changes go through setRole
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    writeRoleCookie(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — non-persistent role for this session
    }
  }, []);

  const switcherEnabled =
    process.env.NEXT_PUBLIC_ENABLE_ROLE_SWITCHER === "1";

  return (
    <RoleContext.Provider value={{ role, setRole, switcherEnabled }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useCurrentRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    // Fallback for tests / Storybook / pages mounted outside RoleProvider —
    // never throws, just returns the default. Switcher is always off here.
    return {
      role: DEFAULT_DEV_ROLE,
      setRole: () => {},
      switcherEnabled: false,
    };
  }
  return ctx;
}
