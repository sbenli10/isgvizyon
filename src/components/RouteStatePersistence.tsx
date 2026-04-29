import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { saveLastSafeRoute } from "@/lib/navigationPersistence";

export function RouteStatePersistence() {
  const location = useLocation();

  useEffect(() => {
    const route = `${location.pathname}${location.search}${location.hash}`;
    saveLastSafeRoute(route);
  }, [location.hash, location.pathname, location.search]);

  return null;
}
