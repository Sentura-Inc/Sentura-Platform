"use client";

import { useSyncExternalStore } from "react";

type CbeSessionRole = "operator" | "admin";

const STORAGE_PREFIX = "sentura:cbe:session-display-name:";
const displayNameCache: Record<CbeSessionRole, string> = {
  operator: "",
  admin: "",
};
const listeners = new Set<() => void>();

function storageKey(role: CbeSessionRole) {
  return `${STORAGE_PREFIX}${role}`;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function readStoredDisplayName(role: CbeSessionRole) {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(storageKey(role))?.trim() ?? "";
}

export function getCbeSessionDisplayName(role: CbeSessionRole) {
  if (!displayNameCache[role]) {
    displayNameCache[role] = readStoredDisplayName(role);
  }
  return displayNameCache[role];
}

export function setCbeSessionDisplayName(role: CbeSessionRole, displayName: string) {
  const nextName = displayName.trim();
  if (displayNameCache[role] === nextName) return;
  displayNameCache[role] = nextName;
  if (typeof window !== "undefined") {
    if (nextName) window.sessionStorage.setItem(storageKey(role), nextName);
    else window.sessionStorage.removeItem(storageKey(role));
  }
  notifyListeners();
}

export function clearCbeSessionDisplayName(role: CbeSessionRole) {
  setCbeSessionDisplayName(role, "");
}

export function useCbeSessionDisplayName(role: CbeSessionRole) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getCbeSessionDisplayName(role),
    () => "",
  );
}
