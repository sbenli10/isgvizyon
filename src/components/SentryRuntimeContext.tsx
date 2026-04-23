import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sentry, sentryEnabled } from "@/lib/sentry";
import { getRuntimeDeviceInfo } from "@/lib/runtimeDeviceInfo";

const collectRoutePayload = (pathname: string, search: string, hash: string) => ({
  pathname,
  search,
  hash,
  fullRoute: `${pathname}${search}${hash}`,
});

export function SentryRuntimeContext() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const [viewportTick, setViewportTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => setViewportTick((current) => current + 1);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const deviceInfo = useMemo(() => getRuntimeDeviceInfo(), [viewportTick]);
  const routeInfo = useMemo(
    () => collectRoutePayload(location.pathname, location.search, location.hash),
    [location.pathname, location.search, location.hash],
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
    Sentry.setTag("browser_name", deviceInfo.browserName);
    Sentry.setTag("browser_version", deviceInfo.browserVersion);
    Sentry.setTag("os_name", deviceInfo.osName);
    Sentry.setTag("device_type", deviceInfo.deviceType);
    Sentry.setTag("current_route", routeInfo.fullRoute || "/");

    if (user?.id) {
      Sentry.setTag("auth_user_id", user.id);
    }

    if (profile?.role) {
      Sentry.setTag("auth_role", profile.role);
    }
  }, [deviceInfo, routeInfo, user?.id, profile?.role]);

  return null;
}
