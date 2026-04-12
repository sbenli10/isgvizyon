import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { completeRouteShell, startRouteTransition } from "@/lib/perfTiming";

export function RouteTimingObserver() {
  const location = useLocation();

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}`;
    startRouteTransition(routeKey);

    let raf2 = 0;

    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        completeRouteShell(routeKey);
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) {
        window.cancelAnimationFrame(raf2);
      }
    };
  }, [location.pathname, location.search]);

  return null;
}
