//src\main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry, sentryEnabled, Sentry } from "@/lib/sentry";
import { AppCrashFallback } from "@/components/AppCrashFallback";

initSentry();

const root = createRoot(document.getElementById("root")!);

root.render(
  sentryEnabled ? (
    <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  ) : (
    <App />
  ),
);
