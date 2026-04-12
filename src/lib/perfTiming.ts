export type AppTimingEntry = {
  name: string;
  durationMs: number;
  startedAt: number;
  completedAt: number;
  meta?: Record<string, unknown>;
};

type TimingStore = {
  active: Record<string, number>;
  entries: AppTimingEntry[];
};

declare global {
  interface Window {
    __appTimings?: TimingStore;
  }
}

const STORE_KEY = "__appTimings";

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const getStore = (): TimingStore => {
  if (typeof window === "undefined") {
    return { active: {}, entries: [] };
  }

  if (!window[STORE_KEY]) {
    window[STORE_KEY] = { active: {}, entries: [] };
  }

  return window[STORE_KEY] as TimingStore;
};

const start = (name: string) => {
  const store = getStore();
  store.active[name] = now();
};

const complete = (name: string, meta?: Record<string, unknown>) => {
  const store = getStore();
  const startedAt = store.active[name];
  if (startedAt == null) {
    return null;
  }

  const completedAt = now();
  const entry: AppTimingEntry = {
    name,
    durationMs: completedAt - startedAt,
    startedAt,
    completedAt,
    meta,
  };

  delete store.active[name];
  store.entries.push(entry);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app-timing", {
        detail: entry,
      }),
    );
  }

  return entry;
};

export const resetAppTimings = () => {
  const store = getStore();
  store.active = {};
  store.entries = [];
};

export const getAppTimings = () => getStore().entries.slice();

export const startNamedFlow = (name: string, meta?: Record<string, unknown>) => {
  start(`flow:${name}`);
  if (meta) {
    const store = getStore();
    const startedAt = store.active[`flow:${name}`];
    store.entries.push({
      name: `flow:${name}:start`,
      durationMs: 0,
      startedAt,
      completedAt: startedAt,
      meta,
    });
  }
};

export const completeNamedFlow = (name: string, meta?: Record<string, unknown>) =>
  complete(`flow:${name}`, meta);

export const startRouteTransition = (route: string) => {
  start(`route:${route}:shell`);
  start(`route:${route}:data`);
};

export const completeRouteShell = (route: string) =>
  complete(`route:${route}:shell`, { route, phase: "shell" });

export const completeRouteData = (route: string) =>
  complete(`route:${route}:data`, { route, phase: "data" });
