import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function useRouteOverlayCleanup(onCleanup: () => void) {
  const location = useLocation();
  const previousRouteRef = useRef<string | null>(null);

  useEffect(() => {
    const nextRoute = `${location.pathname}${location.search}${location.hash}`;

    if (previousRouteRef.current !== null && previousRouteRef.current !== nextRoute) {
      onCleanup();
    }

    previousRouteRef.current = nextRoute;
  }, [location.hash, location.pathname, location.search, onCleanup]);
}
