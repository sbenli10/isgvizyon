import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchDashboardSnapshot,
  writeDashboardSnapshot,
} from "@/lib/dashboardCache";
import { completeNamedFlow } from "@/lib/perfTiming";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Giriş doğrulanıyor...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const isExtension = params.get("ext") === "true";

      if (code) {
        setStatus("Oturum doğrulanıyor...");

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          throw error;
        }

        if (!isExtension && data.session?.user?.id) {
          try {
            const snapshot = await fetchDashboardSnapshot(data.session.user.id);
            writeDashboardSnapshot(data.session.user.id, snapshot);
          } catch (prefetchError) {
            console.warn("Dashboard prefetch skipped:", prefetchError);
          }
        }
      }

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data.session) {
          if (isExtension) {
            completeNamedFlow("login", {
              method: "extension",
              target: "extension",
            });
            localStorage.setItem(
              "denetron_extension_auth",
              JSON.stringify({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_in: data.session.expires_in,
                user: data.session.user,
              })
            );

            setStatus("Giriş başarılı. Uzantı bağlantısı tamamlandı.");

            setTimeout(() => {
              window.close();
            }, 1200);

            return;
          }

          setStatus("Oturum hazır. Yönlendiriliyorsunuz...");
          completeNamedFlow("login", {
            method: code ? "oauth-or-callback" : "password",
            target: "/",
          });
          navigate("/", { replace: true });
          return;
        }

        await wait(250);
      }

      throw new Error("Oturum oluşturulamadı. Lütfen tekrar deneyin.");
    } catch (error) {
      console.error("Auth callback failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Bilinmeyen hata");
      setStatus("Giriş tamamlanamadı.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 bg-slate-800">
          {errorMessage ? (
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          ) : status.includes("başarılı") || status.includes("hazır") ? (
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          ) : (
            <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
          )}
        </div>

        <h1 className="mb-2 text-xl font-semibold">İSGVizyon Oturum Doğrulama</h1>
        <p className="text-sm text-slate-300">{status}</p>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-left">
            <p className="text-sm font-medium text-amber-200">Hata detayı</p>
            <p className="mt-1 text-sm text-amber-100/90">{errorMessage}</p>
            <button
              type="button"
              onClick={() => navigate("/auth", { replace: true })}
              className="mt-4 inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm text-white transition hover:bg-slate-800"
            >
              Giriş sayfasına dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
