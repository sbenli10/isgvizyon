import { useCallback, useEffect, useMemo, useRef } from "react";

type DraftEnvelope<T> = {
  version: number;
  timestamp: number;
  updatedAt: number;
  data: T;
};

type DraftStorageKind =
  | "local"
  | "session"
  | "localStorage"
  | "sessionStorage";

type DraftScope = {
  userId?: string | null;
  orgId?: string | null;
};

type DraftMeta = {
  updatedAt: number;
  version: number;
  storageKey: string;
};

type UsePersistentDraftOptions<T> = {
  key: string;
  enabled?: boolean;
  autoRestore?: boolean;
  version?: number;
  storage?: DraftStorageKind;
  debounceMs?: number;
  ttlMs?: number;
  scope?: DraftScope;
  value?: T;
  initialValue?: T;
  onRestore?: (value: T, meta: DraftMeta) => void;
};

const PREFIX = "denetron:draft:";

const isBrowser = () => typeof window !== "undefined";

const normalizeStorage = (storage: DraftStorageKind): "local" | "session" =>
  storage === "session" || storage === "sessionStorage" ? "session" : "local";

const resolveStorage = (storage: DraftStorageKind) => {
  if (!isBrowser()) return null;
  return normalizeStorage(storage) === "local"
    ? window.localStorage
    : window.sessionStorage;
};

const hasDraftScope = (scope?: DraftScope) =>
  Boolean(scope?.userId || scope?.orgId);

const buildDraftScopeSuffix = (scope?: DraftScope) => {
  if (!hasDraftScope(scope)) return "";

  const parts = [
    scope?.userId ? `u:${scope.userId}` : null,
    scope?.orgId ? `o:${scope.orgId}` : null,
  ].filter(Boolean);

  return `${parts.join(":")}:`;
};

const pruneStoredDraft = (
  storage: Storage,
  key: string,
  scope?: DraftScope,
) => {
  try {
    storage.removeItem(buildDraftStorageKey(key, scope));
  } catch {
    // ignore
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseDraftEnvelope = <T,>(raw: string): DraftEnvelope<T> | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>>;
    if (
      !isRecord(parsed) ||
      typeof parsed.version !== "number" ||
      !("data" in parsed)
    ) {
      return null;
    }

    const updatedAt =
      typeof parsed.updatedAt === "number"
        ? parsed.updatedAt
        : typeof parsed.timestamp === "number"
          ? parsed.timestamp
          : Date.now();

    return {
      version: parsed.version,
      timestamp:
        typeof parsed.timestamp === "number" ? parsed.timestamp : updatedAt,
      updatedAt,
      data: parsed.data as T,
    };
  } catch {
    return null;
  }
};

const hasExpiredDraft = (updatedAt: number, ttlMs?: number) =>
  Boolean(ttlMs && updatedAt + ttlMs < Date.now());

export const buildDraftStorageKey = (key: string, scope?: DraftScope) =>
  `${PREFIX}${buildDraftScopeSuffix(scope)}${key}`;

export const readStoredDraft = <T,>(
  key: string,
  version = 1,
  storage: DraftStorageKind = "local",
  options?: {
    ttlMs?: number;
    scope?: DraftScope;
  },
) => {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(buildDraftStorageKey(key, options?.scope));
    if (!raw) return null;

    const parsed = parseDraftEnvelope<T>(raw);
    if (!parsed || parsed.version !== version) {
      pruneStoredDraft(targetStorage, key, options?.scope);
      return null;
    }

    if (hasExpiredDraft(parsed.updatedAt, options?.ttlMs)) {
      pruneStoredDraft(targetStorage, key, options?.scope);
      return null;
    }

    return parsed.data;
  } catch {
    pruneStoredDraft(targetStorage, key, options?.scope);
    return null;
  }
};

export const writeStoredDraft = <T,>(
  key: string,
  value: T,
  version = 1,
  storage: DraftStorageKind = "local",
  options?: {
    scope?: DraftScope;
  },
) => {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return;

  try {
    const now = Date.now();
    const payload: DraftEnvelope<T> = {
      version,
      timestamp: now,
      updatedAt: now,
      data: value,
    };

    targetStorage.setItem(
      buildDraftStorageKey(key, options?.scope),
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota/storage failures
  }
};

export const patchStoredDraft = <T extends Record<string, unknown>>(
  key: string,
  patch: Partial<T>,
  version = 1,
  storage: DraftStorageKind = "local",
  options?: {
    ttlMs?: number;
    scope?: DraftScope;
  },
) => {
  const current = readStoredDraft<T>(key, version, storage, options);
  if (!current) return;

  writeStoredDraft<T>(
    key,
    {
      ...current,
      ...patch,
    },
    version,
    storage,
    options,
  );
};

export const clearStoredDraft = (
  key: string,
  storage: DraftStorageKind = "local",
  options?: {
    scope?: DraftScope;
  },
) => {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return;

  pruneStoredDraft(targetStorage, key, options?.scope);
};

const sweepExpiredDraftsFromStorage = (storage: Storage, ttlMs?: number) => {
  if (!ttlMs) return;

  const keysToDelete: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const currentKey = storage.key(index);
    if (!currentKey || !currentKey.startsWith(PREFIX)) continue;

    const raw = storage.getItem(currentKey);
    if (!raw) continue;

    const parsed = parseDraftEnvelope<unknown>(raw);
    if (!parsed || hasExpiredDraft(parsed.updatedAt, ttlMs)) {
      keysToDelete.push(currentKey);
    }
  }

  keysToDelete.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  });
};

const keyMatchesScopedUser = (storageKey: string, userId: string) => {
  if (!storageKey.startsWith(PREFIX)) return false;

  const suffix = storageKey.slice(PREFIX.length);
  const segments = suffix.split(":").filter(Boolean);
  if (segments.length === 0) return false;

  for (let index = 0; index < segments.length - 1; index += 1) {
    if (segments[index] === "u" && segments[index + 1] === userId) {
      return true;
    }
  }

  return false;
};

const keyMatchesLegacyUserSegment = (storageKey: string, userId: string) => {
  if (!storageKey.startsWith(PREFIX)) return false;

  const suffix = storageKey.slice(PREFIX.length);
  const segments = suffix.split(":").filter(Boolean);
  return segments.some((segment) => segment === userId);
};

export const clearUserDrafts = (userId: string) => {
  if (!isBrowser() || !userId) return;

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    const keysToDelete: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const currentKey = storage.key(index);
      if (!currentKey || !currentKey.startsWith(PREFIX)) continue;

      if (
        keyMatchesScopedUser(currentKey, userId) ||
        keyMatchesLegacyUserSegment(currentKey, userId)
      ) {
        keysToDelete.push(currentKey);
      }
    }

    keysToDelete.forEach((key) => {
      try {
        storage.removeItem(key);
      } catch {
        // ignore
      }
    });
  });
};

export function usePersistentDraft<T>({
  key,
  enabled = true,
  autoRestore = true,
  version = 1,
  storage = "local",
  debounceMs = 500,
  ttlMs,
  scope,
  value,
  initialValue,
  onRestore,
}: UsePersistentDraftOptions<T>) {
  const normalizedStorage = normalizeStorage(storage);
  const restoreIdentity = useMemo(
    () => `${normalizedStorage}:${version}:${buildDraftStorageKey(key, scope)}`,
    [key, normalizedStorage, scope, version],
  );
  const restoredIdentityRef = useRef<string | null>(null);
  const stableKey = useMemo(
    () => buildDraftStorageKey(key, scope),
    [key, scope],
  );
  const latestValue = value ?? initialValue;
  const latestMetaRef = useRef<DraftMeta | null>(null);

  const restoreDraft = useCallback(() => {
    const restoredValue = readStoredDraft<T>(key, version, normalizedStorage, {
      ttlMs,
      scope,
    });

    if (restoredValue === null) return null;

    const meta: DraftMeta = {
      updatedAt: Date.now(),
      version,
      storageKey: stableKey,
    };
    latestMetaRef.current = meta;
    onRestore?.(restoredValue, meta);
    return restoredValue;
  }, [key, normalizedStorage, onRestore, scope, stableKey, ttlMs, version]);

  const saveDraft = useCallback(
    (nextValue: T) => {
      writeStoredDraft(key, nextValue, version, normalizedStorage, { scope });
      latestMetaRef.current = {
        updatedAt: Date.now(),
        version,
        storageKey: stableKey,
      };
    },
    [key, normalizedStorage, scope, stableKey, version],
  );

  const patchDraft = useCallback(
    // patchDraft intentionally performs a shallow merge. Callers should pass
    // full nested objects when updating nested state slices.
    (patch: T extends Record<string, unknown> ? Partial<T> : never) => {
      patchStoredDraft(
        key,
        patch as Partial<Record<string, unknown>>,
        version,
        normalizedStorage,
        {
          ttlMs,
          scope,
        },
      );
    },
    [key, normalizedStorage, scope, ttlMs, version],
  );

  const clearDraft = useCallback(() => {
    clearStoredDraft(key, normalizedStorage, { scope });
  }, [key, normalizedStorage, scope]);

  useEffect(() => {
    if (!enabled) {
      restoredIdentityRef.current = null;
      return;
    }

    if (!isBrowser()) return;

    sweepExpiredDraftsFromStorage(window.localStorage, ttlMs);
    sweepExpiredDraftsFromStorage(window.sessionStorage, ttlMs);

    if (restoredIdentityRef.current === restoreIdentity) return;

    restoredIdentityRef.current = restoreIdentity;
    if (!autoRestore) return;
    restoreDraft();
  }, [autoRestore, enabled, restoreDraft, restoreIdentity, ttlMs]);

  useEffect(() => {
    if (!enabled || restoredIdentityRef.current !== restoreIdentity) return;
    if (typeof latestValue === "undefined") return;

    const timer = window.setTimeout(() => {
      saveDraft(latestValue);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, enabled, latestValue, restoreIdentity, saveDraft]);

  return {
    clearDraft,
    patchDraft,
    restoreDraft,
    saveDraft,
    storageKey: stableKey,
    meta: latestMetaRef.current,
  };
}
