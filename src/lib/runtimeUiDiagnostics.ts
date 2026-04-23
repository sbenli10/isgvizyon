import { getDomGuardSnapshot } from "@/lib/domMutationGuards";

type WindowWithDiagnostics = Window & {
  __ISGVIZYON_FEATURE_FLAGS__?: Record<string, unknown> | string;
  __ISGVIZYON_EXPERIMENT_ID__?: string;
};

const TRANSLATION_SELECTORS = [
  "iframe.goog-te-banner-frame",
  ".skiptranslate",
  "[class*='translated-ltr']",
  "[class*='translated-rtl']",
];

const OVERLAY_SELECTORS = [
  "[data-radix-popper-content-wrapper]",
  "[data-radix-portal] > *",
  "[role='dialog']",
  "[role='tooltip']",
  "[role='menu']",
  "[role='listbox']",
  "[data-state='open'][data-side]",
];

export const getRouteComponentName = (pathname: string) => {
  if (pathname.startsWith("/companies")) return "CompanyManager";
  if (pathname.startsWith("/risk-assessment")) return "RiskAssessmentEditor";
  if (pathname.startsWith("/bulk-capa")) return "BulkCAPA";
  if (pathname.startsWith("/adep")) return "ADEPWizard";
  if (pathname.startsWith("/evacuation")) return "EvacuationEditor";
  return "unknown";
};

const parseMaybeJson = (value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const detectPageTranslated = () => {
  if (typeof document === "undefined") return false;

  const root = document.documentElement;
  const body = document.body;

  if (
    root.classList.contains("translated-ltr") ||
    root.classList.contains("translated-rtl") ||
    body?.classList.contains("translated-ltr") ||
    body?.classList.contains("translated-rtl")
  ) {
    return true;
  }

  return TRANSLATION_SELECTORS.some((selector) => Boolean(document.querySelector(selector)));
};

export const getMountedOverlayCount = () => {
  if (typeof document === "undefined") return 0;

  const elements = new Set<Element>();
  OVERLAY_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => elements.add(element));
  });

  return elements.size;
};

export const getCompaniesItemCount = () => {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll("[data-company-card], [data-company-row]").length;
};

export const getFeatureFlags = () => {
  if (typeof window === "undefined") return null;

  const runtimeWindow = window as WindowWithDiagnostics;
  const runtimeFlags = runtimeWindow.__ISGVIZYON_FEATURE_FLAGS__;
  if (runtimeFlags) return runtimeFlags;

  return parseMaybeJson(window.localStorage.getItem("featureFlags"));
};

export const getExperimentId = () => {
  if (typeof window === "undefined") return import.meta.env.VITE_EXPERIMENT_ID ?? null;

  const runtimeWindow = window as WindowWithDiagnostics;
  return (
    runtimeWindow.__ISGVIZYON_EXPERIMENT_ID__ ||
    window.localStorage.getItem("experimentId") ||
    import.meta.env.VITE_EXPERIMENT_ID ||
    null
  );
};

export const getRuntimeUiDiagnostics = (pathname: string) => {
  const domGuard = getDomGuardSnapshot();

  return {
    componentName: getRouteComponentName(pathname),
    pageTranslated: detectPageTranslated(),
    mountedOverlayCount: getMountedOverlayCount(),
    itemCount: pathname.startsWith("/companies") ? getCompaniesItemCount() : null,
    featureFlags: getFeatureFlags(),
    experimentId: getExperimentId(),
    domGuardFailed: domGuard.failureCount > 0,
    domGuardFailureCount: domGuard.failureCount,
    domGuardLastFailure: domGuard.lastFailure,
  };
};
