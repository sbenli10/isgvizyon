type CacheEnvelope<T> = {
  savedAt: number;
  data: T;
};

const STORAGE_PREFIX = "osgb:page-cache:";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

export const readOsgbPageCache = <T>(key: string, ttlMs = 5 * 60 * 1000): T | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      storage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};

export const writeOsgbPageCache = <T>(key: string, data: T) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    const payload: CacheEnvelope<T> = {
      savedAt: Date.now(),
      data,
    };
    storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    // cache failures should never block the UI
  }
};
