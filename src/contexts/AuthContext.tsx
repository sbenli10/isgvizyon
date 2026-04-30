import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Sentry } from "@/lib/sentry";
import { clearUserDrafts } from "@/hooks/usePersistentDraft";

type AuthProfile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  refreshProfile: () => Promise<void>;
  loading: boolean;
  signOut: () => Promise<void>;
}

type ExtensionAuthResponse = {
  ok?: boolean;
  success?: boolean;
  saved?: boolean;
  error?: string;
  userId?: string | null;
  orgId?: string | null;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  refreshProfile: async () => {},
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const EXTENSION_ID = "hgcbdpekhlgfnfofogfkhjccnkpbmlcj";

function isExtensionCallback() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);

  return params.get("ext") === "true" && window.location.pathname === "/auth/callback";
}

function saveExtensionAuthFallback(session: Session) {
  try {
    localStorage.setItem(
      "denetron_extension_auth",
      JSON.stringify({
        session,
        user: session.user,
      }),
    );

    console.log("[ISGVizyon Callback] denetron_extension_auth fallback kaydedildi", {
      hasSession: Boolean(session),
      hasUser: Boolean(session.user),
      userId: session.user?.id ?? null,
    });
  } catch (error) {
    console.error("[ISGVizyon Callback] fallback localStorage kaydedilemedi:", error);
  }
}

function sendAuthToExtension(session: Session): Promise<ExtensionAuthResponse> {
  return new Promise((resolve) => {
    const chromeRuntime = (window as any).chrome?.runtime;

    console.log("[ISGVizyon Callback] sendAuthToExtension:start", {
      extensionId: EXTENSION_ID,
      hasChromeRuntime: Boolean(chromeRuntime),
      hasSendMessage: Boolean(chromeRuntime?.sendMessage),
      hasSession: Boolean(session),
      hasUser: Boolean(session?.user),
      userId: session?.user?.id ?? null,
    });

    saveExtensionAuthFallback(session);

    if (!chromeRuntime?.sendMessage) {
      console.error("[ISGVizyon Callback] chrome.runtime.sendMessage bulunamadi");

      resolve({
        ok: false,
        success: false,
        saved: false,
        error: "CHROME_RUNTIME_NOT_AVAILABLE",
      });

      return;
    }

    chromeRuntime.sendMessage(
      EXTENSION_ID,
      {
        type: "DENETRON_AUTH_SUCCESS",
        authData: {
          session,
          user: session.user,
        },
      },
      (response: ExtensionAuthResponse | undefined) => {
        const lastError = chromeRuntime.lastError;

        if (lastError) {
          console.error("[ISGVizyon Callback] extension mesaj hatasi:", lastError.message);

          resolve({
            ok: false,
            success: false,
            saved: false,
            error: lastError.message,
          });

          return;
        }

        console.log("[ISGVizyon Callback] extension response:", response);

        resolve(
          response ?? {
            ok: false,
            success: false,
            saved: false,
            error: "EMPTY_EXTENSION_RESPONSE",
          },
        );
      },
    );
  });
}

function renderExtensionCallbackStatus(status: "success" | "failed", message?: string) {
  if (typeof document === "undefined") return;

  const title =
    status === "success"
      ? "Giriş başarılı. Uzantı bağlantısı tamamlandı."
      : "Giriş başarılı fakat uzantıya aktarılamadı.";

  const detail =
    status === "success"
      ? "Bu sekmeyi kapatıp uzantıyı tekrar açabilirsiniz."
      : message || "Extension ID, manifest veya bağlantı ayarlarını kontrol edin.";

  document.body.innerHTML = `
    <div style="
      background: #020817;
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    ">
      <div style="max-width: 520px;">
        <h1 style="font-size: 24px; margin: 0 0 12px;">
          İSGVizyon Oturum Doğrulama
        </h1>
        <p style="font-size: 16px; line-height: 1.5; margin: 0 0 10px;">
          ${title}
        </p>
        <p style="font-size: 14px; line-height: 1.5; opacity: .75; margin: 0;">
          ${detail}
        </p>
      </div>
    </div>
  `;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const extensionAuthSentRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to get profile:", error);
      setProfile(null);
      return;
    }

    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialSessionResolved = false;

    const hasAuthParams =
      window.location.search.includes("code=") ||
      window.location.search.includes("access_token=") ||
      window.location.hash.includes("access_token=") ||
      window.location.pathname === "/auth/callback";

    const maybeSendExtensionAuth = async (nextSession: Session | null) => {
      if (!mounted) return;
      if (!nextSession) return;
      if (!isExtensionCallback()) return;
      if (extensionAuthSentRef.current) return;

      extensionAuthSentRef.current = true;

      const result = await sendAuthToExtension(nextSession);

      console.log("[ISGVizyon Callback] extension auth result", result);

      if (result?.ok || result?.success || result?.saved) {
        console.log("[ISGVizyon Callback] extension auth saved successfully");

        document.body.dataset.extensionAuthStatus = "success";
        renderExtensionCallbackStatus("success");

        return;
      }

      console.error("[ISGVizyon Callback] extension auth failed", result);

      document.body.dataset.extensionAuthStatus = "failed";
      renderExtensionCallbackStatus("failed", result?.error);
    };

    const applySession = async (nextSession: Session | null, finishLoading = false) => {
      if (!mounted) return;

      setSession(nextSession);

      Sentry.setUser(
        nextSession?.user
          ? {
              id: nextSession.user.id,
              email: nextSession.user.email,
            }
          : null,
      );

      await fetchProfile(nextSession?.user?.id ?? null);

      if (mounted && finishLoading) {
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession, initialSessionResolved);
    });

    const initializeSession = async () => {
      setLoading(true);

      if (hasAuthParams) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            console.error("Auth initialization failed:", error);
            break;
          }

          if (data.session) {
            if (!mounted) return;

            initialSessionResolved = true;

            await maybeSendExtensionAuth(data.session);
            await applySession(data.session, true);

            return;
          }

          await wait(250);
        }
      }

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Failed to get session:", error);
      }

      initialSessionResolved = true;

      await maybeSendExtensionAuth(data.session);
      await applySession(data.session, true);
    };

    void initializeSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    const activeUserId = session?.user?.id ?? null;
    let signOutError: unknown = null;

    try {
      await supabase.auth.signOut();
    } catch (error) {
      signOutError = error;
    } finally {

    try {
      localStorage.removeItem("denetron_extension_auth");
    } catch (error) {
      console.warn("Extension auth fallback temizlenemedi:", error);
    }

    if (activeUserId) {
      try {
        clearUserDrafts(activeUserId);
      } catch (error) {
        console.warn("Kullanıcı draftları temizlenemedi:", error);
      }
    }
    }

    if (signOutError) {
      throw signOutError;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        refreshProfile: async () => {
          await fetchProfile(session?.user?.id ?? null);
        },
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
