import { useEffect } from "react";
import { useSafeMode } from "@/hooks/useSafeMode";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
  const { safeMode } = useSafeMode();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || safeMode || prefersReducedMotion) return;

    let cancelled = false;

    const runWarmup = async () => {
      if (document.visibilityState !== "visible") return;

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
        if (document.visibilityState !== "visible") return;
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
  }, [enabled, prefersReducedMotion, safeMode, tasks]);

  return null;
}
