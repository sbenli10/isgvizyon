//src\main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry, sentryEnabled, Sentry } from "@/lib/sentry";
import { AppCrashFallback } from "@/components/AppCrashFallback";
import { installDomMutationGuards } from "@/lib/domMutationGuards";
import { installAppRecoveryHandlers } from "@/lib/appRecovery";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

installDomMutationGuards();
installAppRecoveryHandlers();
initSentry();

const root = createRoot(document.getElementById("root")!);
const app = (
  <RouteErrorBoundary routeKey="root">
    <App />
  </RouteErrorBoundary>
);

root.render(
  sentryEnabled ? (
    <Sentry.ErrorBoundary fallback={({ error, resetError }) => <AppCrashFallback error={error} resetError={resetError} />}>
      {app}
    </Sentry.ErrorBoundary>
  ) : (
    app
  ),
);
