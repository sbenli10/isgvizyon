import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sentry, sentryEnabled } from "@/lib/sentry";
import { getRuntimeDeviceInfo } from "@/lib/runtimeDeviceInfo";
import { getRuntimeUiDiagnostics } from "@/lib/runtimeUiDiagnostics";

const collectRoutePayload = (pathname: string, search: string, hash: string) => ({
  pathname,
  search,
  hash,
  fullRoute: `${pathname}${search}${hash}`,
});

export function SentryRuntimeContext() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const [observationTick, setObservationTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => setObservationTick((current) => current + 1);
    const intervalId = window.setInterval(() => {
      setObservationTick((current) => current + 1);
    }, 4000);

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearInterval(intervalId);
    };
  }, []);

  const deviceInfo = useMemo(() => getRuntimeDeviceInfo(), [observationTick]);
  const routeInfo = useMemo(
    () => collectRoutePayload(location.pathname, location.search, location.hash),
    [location.pathname, location.search, location.hash],
  );
  const uiDiagnostics = useMemo(
    () => getRuntimeUiDiagnostics(location.pathname),
    [location.pathname, observationTick],
  );

  useEffect(() => {
    if (!sentryEnabled) return;

    Sentry.setContext("runtime_device", {
      browser_name: deviceInfo.browserName,
      browser_version: deviceInfo.browserVersion,
      os_name: deviceInfo.osName,
      device_type: deviceInfo.deviceType,
      device_memory_gb: deviceInfo.deviceMemory,
      hardware_concurrency: deviceInfo.hardwareConcurrency,
      viewport_width: deviceInfo.viewportWidth,
      viewport_height: deviceInfo.viewportHeight,
      pixel_ratio: deviceInfo.pixelRatio,
      screen_width: deviceInfo.screenWidth,
      screen_height: deviceInfo.screenHeight,
      language: deviceInfo.language,
      platform: deviceInfo.platform,
      user_agent: deviceInfo.userAgent,
    });

    Sentry.setContext("current_route", routeInfo);
    Sentry.setContext("runtime_ui", {
      component_name: uiDiagnostics.componentName,
      page_translated: uiDiagnostics.pageTranslated,
      mounted_overlay_count: uiDiagnostics.mountedOverlayCount,
      item_count: uiDiagnostics.itemCount,
      feature_flags: uiDiagnostics.featureFlags,
      experiment_id: uiDiagnostics.experimentId,
      dom_guard_failed: uiDiagnostics.domGuardFailed,
      dom_guard_failure_count: uiDiagnostics.domGuardFailureCount,
      dom_guard_last_failure: uiDiagnostics.domGuardLastFailure,
      dom_guard_top_offenders: uiDiagnostics.domGuardTopOffenders,
    });
    Sentry.setTag("browser_name", deviceInfo.browserName);
    Sentry.setTag("browser_version", deviceInfo.browserVersion);
    Sentry.setTag("os_name", deviceInfo.osName);
    Sentry.setTag("device_type", deviceInfo.deviceType);
    Sentry.setTag("current_route", routeInfo.fullRoute || "/");
    Sentry.setTag("component_name", uiDiagnostics.componentName);
    Sentry.setTag("language", deviceInfo.language);
    Sentry.setTag("page_translated", String(uiDiagnostics.pageTranslated));
    Sentry.setTag("mounted_overlay_count", String(uiDiagnostics.mountedOverlayCount));
    Sentry.setTag("dom_guard_failed", String(uiDiagnostics.domGuardFailed));

    if (user?.id) {
      Sentry.setTag("auth_user_id", user.id);
    }

    if (profile?.role) {
      Sentry.setTag("auth_role", profile.role);
      Sentry.setTag("user_role", profile.role);
    }
  }, [deviceInfo, routeInfo, uiDiagnostics, user?.id, profile?.role]);

  return null;
}
