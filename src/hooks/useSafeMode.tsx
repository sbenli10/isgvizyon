import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

export function useSafeMode() {
  const isMobile = useIsMobile();
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const runtime = useMemo(() => {
    if (typeof navigator === "undefined") {
      return {
        deviceMemory: 8,
        hardwareConcurrency: 8,
      };
    }

    const nav = navigator as NavigatorWithHints;
    return {
      deviceMemory: nav.deviceMemory ?? 8,
      hardwareConcurrency: nav.hardwareConcurrency ?? 8,
    };
  }, []);

  const lowMemory = runtime.deviceMemory <= 4;
  const lowCpu = runtime.hardwareConcurrency <= 4;
  const narrowViewport = viewportWidth < 1180;
  const safeMode = isMobile || lowMemory || lowCpu || narrowViewport;
  const lowDataMode = safeMode;

  return {
    isMobile,
    safeMode,
    lowDataMode,
    lowMemory,
    lowCpu,
    narrowViewport,
    deviceMemory: runtime.deviceMemory,
    hardwareConcurrency: runtime.hardwareConcurrency,
    maxCompanyRows: safeMode ? 24 : 120,
    maxRiskRows: safeMode ? 36 : 9999,
  };
}
