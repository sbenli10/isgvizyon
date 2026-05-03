import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { isChunkLoadError, requestAppReload } from "@/lib/appRecovery";

type ModuleLoader<T extends ComponentType<any>> = () => Promise<{ default: T }>;

const RETRY_PREFIX = "lazy-retry:";

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
        requestAppReload(`lazy-chunk:${key}`);
        return new Promise<never>(() => {});
      }

      window.sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}
