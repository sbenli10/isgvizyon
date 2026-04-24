import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserFacingError, getUserFacingErrorDescription } from "@/lib/userFacingError";

type AppCrashFallbackProps = {
  error?: unknown;
  resetError?: () => void;
};

const RELOAD_LABEL = "Sayfay\u0131 yenile";

export function AppCrashFallback({ error, resetError }: AppCrashFallbackProps) {
  const details = getUserFacingError(error);
  const title = "Sayfa yüklenirken beklenmeyen bir sorun oluştu";
  const description = getUserFacingErrorDescription(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/80 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-300">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
        <div className="mt-4 inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
          Hata kodu: {details.code}
        </div>
        <div className="mt-5 grid gap-3">
          {resetError ? (
            <Button className="w-full gap-2" onClick={resetError}>
              <RefreshCcw className="h-4 w-4" />
              Yeniden dene
            </Button>
          ) : null}
          <Button className="w-full gap-2" variant={resetError ? "outline" : "default"} onClick={() => window.location.reload()}>
            <RefreshCcw className="h-4 w-4" />
            {RELOAD_LABEL}
          </Button>
        </div>
      </div>
    </div>
  );
}
