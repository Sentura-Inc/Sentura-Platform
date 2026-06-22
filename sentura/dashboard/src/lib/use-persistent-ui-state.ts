"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type StoredValueValidator<T> = (value: unknown) => value is T;

function readStoredValue<T>(
  storageKey: string,
  defaultValue: T,
  validate?: StoredValueValidator<T>,
) {
  if (typeof window === "undefined") return defaultValue;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return defaultValue;
    const parsed: unknown = JSON.parse(raw);
    return validate && !validate(parsed) ? defaultValue : (parsed as T);
  } catch {
    return defaultValue;
  }
}

export function usePersistentUiState<T>(
  storageKey: string,
  defaultValue: T,
  validate?: StoredValueValidator<T>,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setValue(readStoredValue(storageKey, defaultValue, validate));
    setIsHydrated(true);
  }, [storageKey, defaultValue, validate]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // UI preferences should never block the page if browser storage is unavailable.
    }
  }, [isHydrated, storageKey, value]);

  return [value, setValue] as const;
}
