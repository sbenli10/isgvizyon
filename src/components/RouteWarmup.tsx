import { useEffect } from "react";

type RouteWarmupTask = {
  key: string;
  load: () => Promise<unknown>;
};

const warmedRoutes = new Set<string>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function RouteWarmup({
  tasks,
  enabled,
}: {
  tasks: RouteWarmupTask[];
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;

    const runWarmup = async () => {
      for (const task of tasks) {
        if (cancelled || warmedRoutes.has(task.key)) continue;

        warmedRoutes.add(task.key);

        try {
          await task.load();
        } catch (error) {
          warmedRoutes.delete(task.key);
          console.warn(`Route warmup failed for ${task.key}:`, error);
        }

        await wait(120);
      }
    };

    const requestIdle = window.requestIdleCallback?.bind(window);
    const cancelIdle = window.cancelIdleCallback?.bind(window);
    const idleHandle = requestIdle
      ? requestIdle(() => {
          void runWarmup();
        }, { timeout: 1800 })
      : window.setTimeout(() => {
          void runWarmup();
        }, 500);

    return () => {
      cancelled = true;
      if (typeof idleHandle === "number" && !requestIdle) {
        window.clearTimeout(idleHandle);
        return;
      }
      if (cancelIdle && typeof idleHandle !== "number") {
        cancelIdle(idleHandle);
      }
    };
  }, [enabled, tasks]);

  return null;
}
