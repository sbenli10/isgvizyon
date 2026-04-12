import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppCrashFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/80 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-300">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-white">Sayfa yüklenirken beklenmeyen bir sorun oluştu</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Uygulama boş ekranda kalmasın diye kurtarma ekranı gösteriyoruz. Tek dokunuşla sayfayı yeniden yükleyebilirsiniz.
        </p>
        <Button
          className="mt-5 w-full gap-2"
          onClick={() => window.location.reload()}
        >
          <RefreshCcw className="h-4 w-4" />
          Sayfayı yeniden yükle
        </Button>
      </div>
    </div>
  );
}
