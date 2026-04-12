import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { completeRouteData } from "@/lib/perfTiming";

export function usePageDataTiming(loading: boolean) {
  const location = useLocation();
  const completedRouteRef = useRef<string | null>(null);

  useEffect(() => {
    completedRouteRef.current = null;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}`;
    if (loading || completedRouteRef.current === routeKey) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      completeRouteData(routeKey);
      completedRouteRef.current = routeKey;
    });

    return () => window.cancelAnimationFrame(raf);
  }, [loading, location.pathname, location.search]);
}
