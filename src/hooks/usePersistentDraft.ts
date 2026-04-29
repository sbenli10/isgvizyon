import { useEffect, useMemo, useRef } from "react";

type DraftEnvelope<T> = {
  version: number;
  timestamp: number;
  data: T;
};

type UsePersistentDraftOptions<T> = {
  key: string;
  enabled?: boolean;
  version?: number;
  storage?: "local" | "session";
  debounceMs?: number;
  value: T;
  onRestore?: (value: T) => void;
};

const PREFIX = "denetron:draft:";

const isBrowser = () => typeof window !== "undefined";

const resolveStorage = (storage: "local" | "session") => {
  if (!isBrowser()) return null;
  return storage === "local" ? window.localStorage : window.sessionStorage;
};

export const buildDraftStorageKey = (key: string) => `${PREFIX}${key}`;

export const readStoredDraft = <T,>(key: string, version = 1, storage: "local" | "session" = "local") => {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(buildDraftStorageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || parsed.version !== version) {
      targetStorage.removeItem(buildDraftStorageKey(key));
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};

export const writeStoredDraft = <T,>(key: string, value: T, version = 1, storage: "local" | "session" = "local") => {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return;

  try {
    const payload: DraftEnvelope<T> = {
      version,
      timestamp: Date.now(),
      data: value,
    };
    targetStorage.setItem(buildDraftStorageKey(key), JSON.stringify(payload));
  } catch {
    // ignore quota/storage failures
  }
};

export const clearStoredDraft = (key: string, storage: "local" | "session" = "local") => {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return;

  try {
    targetStorage.removeItem(buildDraftStorageKey(key));
  } catch {
    // ignore
  }
};

export function usePersistentDraft<T>({
  key,
  enabled = true,
  version = 1,
  storage = "local",
  debounceMs = 500,
  value,
  onRestore,
}: UsePersistentDraftOptions<T>) {
  const restoreIdentity = useMemo(
    () => `${storage}:${version}:${key}`,
    [key, storage, version],
  );
  const restoredIdentityRef = useRef<string | null>(null);
  const stableKey = useMemo(() => buildDraftStorageKey(key), [key]);

  useEffect(() => {
    if (!enabled || restoredIdentityRef.current === restoreIdentity) return;

    const restoredValue = readStoredDraft<T>(key, version, storage);
    restoredIdentityRef.current = restoreIdentity;
    if (restoredValue !== null) {
      onRestore?.(restoredValue);
    }
  }, [enabled, key, onRestore, restoreIdentity, storage, version]);

  useEffect(() => {
    if (!enabled || restoredIdentityRef.current !== restoreIdentity) return;

    const timer = window.setTimeout(() => {
      writeStoredDraft(key, value, version, storage);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, enabled, key, restoreIdentity, storage, value, version]);

  return {
    clearDraft: () => clearStoredDraft(key, storage),
    storageKey: stableKey,
  };
}
