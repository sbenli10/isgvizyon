const LAST_SAFE_ROUTE_KEY = "denetron:last-safe-route";
const INTENDED_ROUTE_KEY = "denetron:intended-route";

const EXCLUDED_PREFIXES = [
  "/auth",
  "/landing",
  "/certificate-verify",
  "/portal/company",
];

type StoredRoute = {
  path: string;
  timestamp: number;
};

const isBrowser = () => typeof window !== "undefined";

export const isPersistableRoute = (pathname: string) => {
  if (!pathname) return false;
  return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

const writeRoute = (storageKey: string, path: string) => {
  if (!isBrowser() || !isPersistableRoute(path)) return;

  try {
    const payload: StoredRoute = {
      path,
      timestamp: Date.now(),
    };
    window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore persistence failures
  }
};

const readRoute = (storageKey: string) => {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredRoute;
    if (!parsed?.path || !isPersistableRoute(parsed.path)) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    return parsed.path;
  } catch {
    return null;
  }
};

export const saveIntendedRoute = (path: string) => {
  writeRoute(INTENDED_ROUTE_KEY, path);
};

export const consumeIntendedRoute = () => {
  if (!isBrowser()) return null;

  const route = readRoute(INTENDED_ROUTE_KEY);
  try {
    window.sessionStorage.removeItem(INTENDED_ROUTE_KEY);
  } catch {
    // ignore
  }
  return route;
};

export const saveLastSafeRoute = (path: string) => {
  writeRoute(LAST_SAFE_ROUTE_KEY, path);
};

export const readLastSafeRoute = () => readRoute(LAST_SAFE_ROUTE_KEY);

export const resolvePostAuthRoute = (fallback = "/") =>
  consumeIntendedRoute() || readLastSafeRoute() || fallback;
