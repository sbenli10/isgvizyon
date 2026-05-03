//src\hooks\usePersistentFormDraft.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  buildDraftStorageKey,
  clearStoredDraft,
  readStoredDraft,
  writeStoredDraft,
} from "@/hooks/usePersistentDraft";

type FormDraftStorage = "localStorage" | "sessionStorage" | "indexedDb";

type FormDraftStorageAdapter<T> = {
  debugStorageKey?: string;
  read: () => Promise<T | null> | T | null;
  write: (value: T) => Promise<void> | void;
  clear: () => Promise<void> | void;
};

type UsePersistentFormDraftOptions<T> = {
  formId: string;
  value: T;
  initialValue: T;
  enabled?: boolean;
  version?: number;
  debounceMs?: number;
  ttlMs?: number;
  storage?: FormDraftStorage;
  routeKey?: string;
  userId?: string | null;
  organizationId?: string | null;
  isDirty?: boolean;
  shouldPersist?: (value: T) => boolean;
  onRestore?: (value: T) => void;
  debugLabel?: string;
  storageAdapter?: FormDraftStorageAdapter<T>;
};

type IndexedDbEnvelope<T> = {
  version: number;
  updatedAt: number;
  data: T;
};

const INDEXED_DB_NAME = "denetron-form-drafts";
const INDEXED_DB_STORE = "drafts";

const isBrowser = () => typeof window !== "undefined";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFilledValue = (value: unknown) => {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return value !== null && typeof value !== "undefined";
};

export const mergeMissingFormValues = <T,>(current: T, defaults: Partial<T>): T => {
  if (!isPlainObject(current) || !isPlainObject(defaults)) {
    return (isFilledValue(current) ? current : defaults) as T;
  }

  const next: Record<string, unknown> = { ...current };

  Object.entries(defaults).forEach(([key, defaultValue]) => {
    const currentValue = next[key];

    if (isPlainObject(currentValue) && isPlainObject(defaultValue)) {
      next[key] = mergeMissingFormValues(
        currentValue as Record<string, unknown>,
        defaultValue as Record<string, unknown>,
      );
      return;
    }

    if (!isFilledValue(currentValue) && typeof defaultValue !== "undefined") {
      next[key] = defaultValue;
    }
  });

  return next as T;
};

const openDraftDb = async () => {
  if (!isBrowser() || !("indexedDB" in window)) return null;

  return new Promise<IDBDatabase | null>((resolve) => {
    const request = window.indexedDB.open(INDEXED_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
        db.createObjectStore(INDEXED_DB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
};

const readIndexedDbDraft = async <T,>(storageKey: string, version: number, ttlMs?: number) => {
  const db = await openDraftDb();
  if (!db) return null;

  return new Promise<T | null>((resolve) => {
    const transaction = db.transaction(INDEXED_DB_STORE, "readonly");
    const store = transaction.objectStore(INDEXED_DB_STORE);
    const request = store.get(storageKey);

    request.onsuccess = () => {
      const payload = request.result as IndexedDbEnvelope<T> | undefined;
      if (!payload || payload.version !== version) {
        resolve(null);
        return;
      }

      if (ttlMs && payload.updatedAt + ttlMs < Date.now()) {
        resolve(null);
        return;
      }

      resolve(payload.data);
    };

    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
  });
};

const writeIndexedDbDraft = async <T,>(storageKey: string, value: T, version: number) => {
  const db = await openDraftDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(INDEXED_DB_STORE, "readwrite");
    const store = transaction.objectStore(INDEXED_DB_STORE);
    store.put(
      {
        version,
        updatedAt: Date.now(),
        data: value,
      } satisfies IndexedDbEnvelope<T>,
      storageKey,
    );
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
};

const clearIndexedDbDraft = async (storageKey: string) => {
  const db = await openDraftDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(INDEXED_DB_STORE, "readwrite");
    const store = transaction.objectStore(INDEXED_DB_STORE);
    store.delete(storageKey);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
};

export function usePersistentFormDraft<T>({
  formId,
  value,
  initialValue,
  enabled = true,
  version = 1,
  debounceMs = 500,
  ttlMs,
  storage = "localStorage",
  routeKey,
  userId,
  organizationId,
  isDirty = false,
  shouldPersist,
  onRestore,
  debugLabel,
  storageAdapter,
}: UsePersistentFormDraftOptions<T>) {
  const location = useLocation();
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const hasRestoredDraftRef = useRef(false);
  const submittingRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  const isDirtyRef = useRef(isDirty);
  const lastSavedValueRef = useRef<T | null>(null);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const routeIdentity = routeKey || location.pathname;
  const key = useMemo(() => `form:${routeIdentity}:${formId}`, [formId, routeIdentity]);
  const scope = useMemo(
    () => ({
      userId: userId || null,
      orgId: organizationId || null,
    }),
    [organizationId, userId],
  );
  const storageKey = useMemo(() => buildDraftStorageKey(key, scope), [key, scope]);
  const effectiveStorageKey = storageAdapter?.debugStorageKey || storageKey;
  const debugEnabled = useMemo(() => {
    if (!isBrowser()) return false;
    return import.meta.env.DEV && new URLSearchParams(location.search).get("debugFormPersistence") === "1";
  }, [location.search]);
  const debugName = debugLabel || formId;

  const debugLog = useCallback(
    (event: string, details?: Record<string, unknown>) => {
      if (!debugEnabled) return;
      console.log("[FormPersistence]", event, {
        at: new Date().toISOString(),
        routeKey: routeIdentity,
        formId,
        debugName,
        storage,
        storageKey: effectiveStorageKey,
        hasRestoredDraft: hasRestoredDraftRef.current,
        isDirty: isDirtyRef.current,
        ...details,
      });
    },
    [debugEnabled, debugName, effectiveStorageKey, formId, routeIdentity, storage],
  );

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const readDraft = useCallback(async () => {
    if (!enabled || !isBrowser()) return null;

    if (storageAdapter) {
      return await storageAdapter.read();
    }

    if (storage === "indexedDb") {
      return readIndexedDbDraft<T>(storageKey, version, ttlMs);
    }

    return readStoredDraft<T>(key, version, storage, {
      ttlMs,
      scope,
    });
  }, [enabled, key, scope, storage, storageAdapter, storageKey, ttlMs, version]);

  const writeDraft = useCallback(
    async (nextValue: T) => {
      if (!enabled || !isBrowser()) return;

      if (storageAdapter) {
        await storageAdapter.write(nextValue);
        return;
      }

      if (storage === "indexedDb") {
        await writeIndexedDbDraft(storageKey, nextValue, version);
      } else {
        writeStoredDraft(key, nextValue, version, storage, { scope });
      }
    },
    [enabled, key, scope, storage, storageAdapter, storageKey, version],
  );

  const clearDraft = useCallback(async () => {
    if (!isBrowser()) return;

    if (storageAdapter) {
      await storageAdapter.clear();
    } else if (storage === "indexedDb") {
      await clearIndexedDbDraft(storageKey);
    } else {
      clearStoredDraft(key, storage, { scope });
    }

    hasRestoredDraftRef.current = false;
    setHasRestoredDraft(false);
    lastSavedValueRef.current = null;
    lastSavedFingerprintRef.current = null;
    debugLog("draft cleared", {});
  }, [debugLog, key, scope, storage, storageAdapter, storageKey]);

  const restoreDraft = useCallback(async () => {
    debugLog("draft restore started", {});
    const restored = await readDraft();

    if (restored !== null) {
      try {
        lastSavedFingerprintRef.current = JSON.stringify(restored);
      } catch {
        lastSavedFingerprintRef.current = null;
      }
      lastSavedValueRef.current = restored;
      hasRestoredDraftRef.current = true;
      setHasRestoredDraft(true);
      onRestoreRef.current?.(restored);
      debugLog("draft restore completed", {
        restored: true,
      });
      return restored;
    }

    debugLog("draft restore completed", {
      restored: false,
    });
    return null;
  }, [debugLog, readDraft]);

  useEffect(() => {
    let cancelled = false;

    debugLog("component mounted", {});
    void (async () => {
      const restored = await restoreDraft();
      if (!cancelled) {
        if (restored === null) {
          hasRestoredDraftRef.current = false;
          setHasRestoredDraft(false);
        }
        setDraftLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
      debugLog("component unmounted", {});
    };
  }, [debugLog, restoreDraft, storageKey]);

  useEffect(() => {
    if (!enabled || !draftLoaded) return;
    if (submittingRef.current) return;

    const canPersist = shouldPersist ? shouldPersist(value) : true;
    if (!canPersist && !isDirty) return;

    const timer = window.setTimeout(() => {
      let serializedValue = "";

      try {
        serializedValue = JSON.stringify(value);
      } catch {
        debugLog("draft save skipped", {
          reason: "serialize-failed",
        });
        return;
      }

      if (lastSavedFingerprintRef.current === serializedValue) {
        debugLog("draft save skipped", {
          reason: "unchanged",
          payloadSize: serializedValue.length,
        });
        return;
      }

      debugLog("draft save started", {
        payloadSize: serializedValue.length,
      });
      void writeDraft(value).then(() => {
        lastSavedValueRef.current = value;
        lastSavedFingerprintRef.current = serializedValue;
        debugLog("draft save completed", {
          payloadSize: serializedValue.length,
        });
      });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, debugLog, draftLoaded, enabled, isDirty, shouldPersist, value, writeDraft]);

  useEffect(() => {
    debugLog("auth/session change", {
      userId,
      organizationId,
    });
  }, [debugLog, organizationId, userId]);

  useEffect(() => {
    debugLog("form dirty state", {
      dirty: isDirty,
      draftLoaded,
    });
  }, [debugLog, draftLoaded, isDirty]);

  useEffect(() => {
    debugLog("route/pathname change", {
      pathname: location.pathname,
      search: location.search,
    });
  }, [debugLog, location.pathname, location.search]);

  useEffect(() => {
    if (!debugEnabled || !isBrowser()) return;

    const handleFocus = () => {
      debugLog("window focus", {});
    };

    const handleBlur = () => {
      debugLog("window blur", {});
    };

    const handleVisibilityChange = () => {
      debugLog("visibilitychange", {
        visibilityState: document.visibilityState,
      });
    };

    const handlePageHide = () => {
      debugLog("pagehide", {});
    };

    const handlePageShow = () => {
      debugLog("pageshow", {});
    };

    const handleBeforeUnload = () => {
      debugLog("beforeunload", {});
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [debugEnabled, debugLog]);

  const markSubmitted = useCallback(async () => {
    submittingRef.current = true;
    await clearDraft();
    submittingRef.current = false;
  }, [clearDraft]);

  const discardDraft = useCallback(async () => {
    await clearDraft();
  }, [clearDraft]);

  const mergeDefaults = useCallback(
    (defaults: Partial<T>) => {
      if (hasRestoredDraftRef.current || isDirty) {
        debugLog("API/default applied", {
          reason: "merge-missing-defaults",
          mode: "non-destructive",
        });
        return mergeMissingFormValues(value, defaults);
      }

      debugLog("API/default applied", {
        reason: "merge-defaults",
        mode: "normal",
      });
      return {
        ...(value as Record<string, unknown>),
        ...(defaults as Record<string, unknown>),
      } as T;
    },
    [debugLog, isDirty, value],
  );

  const logFormReset = useCallback(
    (reason: string, nextSnapshot: unknown) => {
      debugLog("form reset reason", {
        reason,
        previous: value,
        next: nextSnapshot,
        dirty: isDirty,
        draftExisted: hasRestoredDraftRef.current,
      });
    },
    [debugLog, isDirty, value],
  );

  // EKLENEN KOD BAŞLANGICI
  useEffect(() => {
    return () => {
      // Bileşen DOM'dan silinirken (unmount), mevcut URL formun URL'sinden farklıysa
      // (Yani kullanıcı sayfayı yenilemedi, bilerek başka bir modüle / sayfaya geçtiyse)
      if (isBrowser() && window.location.pathname !== routeIdentity) {
        debugLog("Sayfadan çıkıldı, taslak temizleniyor", {
          from: routeIdentity,
          to: window.location.pathname
        });
        
        // Taslağı kalıcı olarak sil
        void clearDraft();
      }
    };
  }, [routeIdentity, clearDraft, debugLog]);
  // EKLENEN KOD BİTİŞİ

  return {
    draftKey: effectiveStorageKey,
    clearDraft,
    discardDraft,
    restoreDraft,
    markSubmitted,
    hasRestoredDraft,
    hasRestoredDraftRef,
    draftLoaded,
    shouldProtectFromDefaults: isDirty || hasRestoredDraftRef.current,
    mergeDefaults,
    logFormReset,
    debugEnabled,
  };
}
