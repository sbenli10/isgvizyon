import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchDashboardSnapshot,
  writeDashboardSnapshot,
} from "@/lib/dashboardCache";
import { completeNamedFlow } from "@/lib/perfTiming";
import { resolvePostAuthRoute } from "@/lib/navigationPersistence";
import { ISGVIZYON_CHROME_EXTENSION_ID } from "@/lib/constants/extension";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const OAUTH_INTENT_STORAGE_KEY = "denetron-oauth-intent";
const EXTENSION_AUTH_STORAGE_KEY = "denetron_extension_auth";

type ExtensionAuthResult = {
  success: boolean;
  channel: "external-message" | "page-bridge" | "fallback-storage";
  error?: string;
};

function buildExtensionAuthPayload(session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>) {
  return {
    session,
    user: session.user,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
  };
}

function saveExtensionAuthFallback(authPayload: ReturnType<typeof buildExtensionAuthPayload>) {
  window.localStorage.setItem(EXTENSION_AUTH_STORAGE_KEY, JSON.stringify(authPayload));
}

function sendExtensionAuthExternal(authPayload: ReturnType<typeof buildExtensionAuthPayload>): Promise<ExtensionAuthResult> {
  return new Promise((resolve) => {
    const chromeRuntime = (window as any).chrome?.runtime;

    if (!chromeRuntime?.sendMessage) {
      resolve({
        success: false,
        channel: "external-message",
        error: "CHROME_RUNTIME_NOT_AVAILABLE",
      });
      return;
    }

    chromeRuntime.sendMessage(
      ISGVIZYON_CHROME_EXTENSION_ID,
      {
        type: "DENETRON_AUTH_SUCCESS",
        authData: authPayload,
      },
      (response: { ok?: boolean; success?: boolean; saved?: boolean; error?: string } | undefined) => {
        const lastError = chromeRuntime.lastError;

        if (lastError) {
          resolve({
            success: false,
            channel: "external-message",
            error: lastError.message,
          });
          return;
        }

        resolve({
          success: Boolean(response?.ok || response?.success || response?.saved),
          channel: "external-message",
          error: response?.error,
        });
      },
    );
  });
}

function sendExtensionAuthViaPageBridge(authPayload: ReturnType<typeof buildExtensionAuthPayload>): Promise<ExtensionAuthResult> {
  return new Promise((resolve) => {
    const requestId = `extension-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const finish = (result: ExtensionAuthResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handleResponse);
      resolve(result);
    };

    const handleResponse = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== "isgvizyon-extension-bridge") return;
      if (data?.type !== "ISGVIZYON_EXTENSION_AUTH_RESPONSE") return;
      if (data?.requestId !== requestId) return;

      finish({
        success: Boolean(data?.payload?.success || data?.payload?.ok || data?.payload?.saved),
        channel: "page-bridge",
        error: data?.payload?.error,
      });
    };

    window.addEventListener("message", handleResponse);

    window.postMessage(
      {
        source: "denetron-web-app",
        type: "DENETRON_AUTH_UPDATED",
        requestId,
        data: authPayload,
      },
      window.location.origin,
    );

    window.setTimeout(() => {
      finish({
        success: false,
        channel: "page-bridge",
        error: "PAGE_BRIDGE_TIMEOUT",
      });
    }, 2500);
  });
}

async function sendAuthToExtension(session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>) {
  const authPayload = buildExtensionAuthPayload(session);
  saveExtensionAuthFallback(authPayload);

  const bridgeResult = await sendExtensionAuthViaPageBridge(authPayload);
  if (bridgeResult.success) return bridgeResult;

  const externalResult = await sendExtensionAuthExternal(authPayload);
  if (externalResult.success) return externalResult;

  return {
    success: false,
    channel: "fallback-storage" as const,
    error: externalResult.error || bridgeResult.error,
  };
}

async function ensureOAuthProfile(user: any) {
  const metadata = user?.user_metadata ?? {};
  const oauthIntentRaw = window.localStorage.getItem(OAUTH_INTENT_STORAGE_KEY);
  const oauthIntent = oauthIntentRaw ? JSON.parse(oauthIntentRaw) : null;

  const fullName =
    metadata.full_name ||
    metadata.name ||
    metadata.display_name ||
    user?.email?.split("@")[0] ||
    "Kullanıcı";

  const avatarUrl = metadata.avatar_url || metadata.picture || null;

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, email, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name: existingProfile?.full_name || fullName,
      email: existingProfile?.email || user.email || null,
      avatar_url: existingProfile?.avatar_url || avatarUrl,
      role: existingProfile?.role || (oauthIntent?.accountType === "individual" ? "staff" : "viewer"),
      organization_id: existingProfile?.organization_id || null,
      subscription_plan: existingProfile ? undefined : "free",
      subscription_status: existingProfile ? undefined : "free",
      subscription_started_at: existingProfile ? undefined : null,
      trial_ends_at: existingProfile ? undefined : null,
      is_active: true,
    });

  if (upsertError) {
    throw upsertError;
  }

  window.localStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
  return {};
}

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
          await ensureOAuthProfile(data.session.user);

          if (isExtension) {
            completeNamedFlow("login", {
              method: "extension",
              target: "extension",
            });

            setStatus("Giriş başarılı. Uzantıya aktarılıyor...");
            const extensionResult = await sendAuthToExtension(data.session);

            if (!extensionResult.success) {
              setStatus("Giriş başarılı. Uzantıyı tekrar açın.");
              setErrorMessage(
                "Oturum web tarafında hazırlandı ancak uzantıya otomatik aktarılamadı. Bu sekmeyi kapatmadan uzantıyı tekrar açın; eklenti oturumu buradan alacaktır.",
              );
              return;
            }

            setStatus("Giriş başarılı. Uzantı bağlantısı tamamlandı.");

            setTimeout(() => {
              window.close();
            }, 1200);

            return;
          }

          setStatus("Oturum hazır. Yönlendiriliyorsunuz...");
          const restoredRoute = resolvePostAuthRoute("/");
          const targetRoute = restoredRoute;
          completeNamedFlow("login", {
            method: code ? "oauth-or-callback" : "password",
            target: targetRoute,
          });
          navigate(targetRoute, { replace: true });
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
