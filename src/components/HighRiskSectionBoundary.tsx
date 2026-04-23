import { type ReactNode, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

type HighRiskSectionBoundaryProps = {
  children: ReactNode;
  section: string;
  componentName?: string;
};

export function HighRiskSectionBoundary({
  children,
  section,
  componentName,
}: HighRiskSectionBoundaryProps) {
  const location = useLocation();
  const routeKey = useMemo(
    () => `${location.pathname}${location.search}::${section}`,
    [location.pathname, location.search, section],
  );

  return (
    <RouteErrorBoundary routeKey={routeKey} componentName={componentName}>
      {children}
    </RouteErrorBoundary>
  );
}
