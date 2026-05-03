const CHUNK_RECOVERY_KEY = "isgvizyon:chunk-recovery";
export const APP_RELOAD_REQUEST_EVENT = "denetron:reload-requested";
let appRecoveryInstalled = false;

const getErrorText = (error: unknown) => {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const isChunkLoadError = (error: unknown) => {
  const message = getErrorText(error);
  return [
    "Failed to fetch dynamically imported module",
    "Importing a module script failed",
    "ChunkLoadError",
    "Loading chunk",
    "error loading dynamically imported module",
    "Unable to preload CSS",
  ].some((pattern) => message.includes(pattern));
};

export const requestAppReload = (reason: string) => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const lastRecovery = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) || 0);

  if (now - lastRecovery < 30_000) return;

  window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(now));
  window.dispatchEvent(
    new CustomEvent(APP_RELOAD_REQUEST_EVENT, {
      detail: {
        reason,
        requestedAt: now,
      },
    }),
  );
};

export const installAppRecoveryHandlers = () => {
  if (typeof window === "undefined") return;
  if (appRecoveryInstalled) return;
  appRecoveryInstalled = true;

  window.addEventListener("error", (event) => {
    const error = event.error || event.message;
    if (!isChunkLoadError(error)) return;
    event.preventDefault();
    requestAppReload("chunk-error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    requestAppReload("chunk-rejection");
  });
};
