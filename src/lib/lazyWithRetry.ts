import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type ModuleLoader<T extends ComponentType<any>> = () => Promise<{ default: T }>;

const RETRY_PREFIX = "lazy-retry:";

const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("ChunkLoadError") ||
    message.includes("error loading dynamically imported module")
  );
};

export function lazyWithRetry<T extends ComponentType<any>>(
  key: string,
  importer: ModuleLoader<T>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const loaded = await importer();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`${RETRY_PREFIX}${key}`);
      }
      return loaded;
    } catch (error) {
      if (typeof window === "undefined" || !isChunkLoadError(error)) {
        throw error;
      }

      const storageKey = `${RETRY_PREFIX}${key}`;
      const alreadyRetried = window.sessionStorage.getItem(storageKey) === "1";

      if (!alreadyRetried) {
        window.sessionStorage.setItem(storageKey, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }

      window.sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}
