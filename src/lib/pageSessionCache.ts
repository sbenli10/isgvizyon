type CacheEnvelope<T> = {
  timestamp: number;
  data: T;
};

const PREFIX = "denetron:page-cache:";

export const readPageSessionCache = <T>(key: string, ttlMs: number): T | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.timestamp) return null;
    if (Date.now() - parsed.timestamp > ttlMs) {
      window.sessionStorage.removeItem(`${PREFIX}${key}`);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};

export const writePageSessionCache = <T>(key: string, data: T) => {
  if (typeof window === "undefined") return;

  try {
    const payload: CacheEnvelope<T> = {
      timestamp: Date.now(),
      data,
    };
    window.sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    // ignore cache write failures
  }
};
