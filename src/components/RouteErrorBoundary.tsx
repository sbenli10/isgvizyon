import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sentry } from "@/lib/sentry";
import { getRuntimeDeviceInfo } from "@/lib/runtimeDeviceInfo";
import { getRuntimeUiDiagnostics } from "@/lib/runtimeUiDiagnostics";

type RouteErrorBoundaryProps = {
  children: ReactNode;
  routeKey: string;
  componentName?: string;
};

type RouteErrorBoundaryState = {
  error: Error | null;
};

const TITLE = "Bu ekran y\u00fcklenirken sorun olu\u015ftu";
const DESCRIPTION =
  "Uygulaman\u0131n tamam\u0131 kapanmad\u0131. Bu ekran\u0131 tekrar deneyebilir veya ana sayfaya d\u00f6nebilirsiniz.";
const HOME_LABEL = "Ana sayfaya d\u00f6n";

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : this.props.routeKey;
    const runtimeDevice = getRuntimeDeviceInfo();
    const runtimeUi = getRuntimeUiDiagnostics(currentPath);

    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
        runtime_device: {
          browser_name: runtimeDevice.browserName,
          browser_version: runtimeDevice.browserVersion,
          os_name: runtimeDevice.osName,
          device_type: runtimeDevice.deviceType,
          language: runtimeDevice.language,
          user_agent: runtimeDevice.userAgent,
        },
        runtime_ui: {
          component_name: this.props.componentName || runtimeUi.componentName,
          page_translated: runtimeUi.pageTranslated,
          mounted_overlay_count: runtimeUi.mountedOverlayCount,
          item_count: runtimeUi.itemCount,
          feature_flags: runtimeUi.featureFlags,
          experiment_id: runtimeUi.experimentId,
          dom_guard_failed: runtimeUi.domGuardFailed,
          dom_guard_failure_count: runtimeUi.domGuardFailureCount,
          dom_guard_last_failure: runtimeUi.domGuardLastFailure,
        },
      },
      tags: {
        boundary: "route",
        routeKey: this.props.routeKey,
        component_name: this.props.componentName || runtimeUi.componentName,
        browser_name: runtimeDevice.browserName,
        browser_version: runtimeDevice.browserVersion,
        language: runtimeDevice.language,
        page_translated: String(runtimeUi.pageTranslated),
        dom_guard_failed: String(runtimeUi.domGuardFailed),
      },
      extra: {
        currentRoute: this.props.routeKey,
        route: currentPath,
      },
    });
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (previousProps.routeKey !== this.props.routeKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[520px] bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-3xl border border-amber-300/20 bg-slate-950/80 p-6 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-200">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">{TITLE}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{DESCRIPTION}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button onClick={this.reset} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Tekrar dene
            </Button>
            <Button variant="outline" onClick={() => window.location.assign("/")} className="gap-2">
              <Home className="h-4 w-4" />
              {HOME_LABEL}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
