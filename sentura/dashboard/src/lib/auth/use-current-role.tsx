"use client";

/**
 * Current-role hook + provider.
 *
 * Today (W5 dev): role is sourced from localStorage with `?as=<role>` URL
 * param as a one-shot override (for sharing reproducible permission states).
 * Default = `DEFAULT_DEV_ROLE` (`platform_admin`) so single-tenant local
 * setup keeps the full experience until SSO lands.
 *
 * W6+ (post-SSO): swap the localStorage source for an SSO-asserted role
 * served via a server component or context. The hook signature stays the
 * same so callers don't refactor.
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

export function RoleProvider({ children }: { children: ReactNode }) {
  // Initial render uses the default to avoid SSR/hydration mismatch.
  // The mount effect immediately re-syncs from localStorage / URL.
  const [role, setRoleState] = useState<Role>(DEFAULT_DEV_ROLE);
  useEffect(() => {
    const persisted = readPersistedRole();
    if (persisted !== role) setRoleState(persisted);
    // intentionally only run on mount — subsequent role changes go through setRole
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
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
