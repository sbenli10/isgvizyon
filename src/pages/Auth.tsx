import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Shield,
  Mail,
  Lock,
  User,
  Info,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { fetchDashboardSnapshot, writeDashboardSnapshot } from "@/lib/dashboardCache";
import { resolvePostAuthRoute } from "@/lib/navigationPersistence";
import { startNamedFlow } from "@/lib/perfTiming";
import { getUserFacingError, getUserFacingErrorDescription, getUserFacingErrorMessage } from "@/lib/userFacingError";
import { toast } from "sonner";
import { isDeviceTrusted, trustCurrentDevice } from "@/utils/deviceFingerprint";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type AuthMode = "login" | "register" | "wait" | "mfa";
type NoticeType = "info" | "success" | "warning" | "error";
const OAUTH_INTENT_STORAGE_KEY = "denetron-oauth-intent";
const APP_URL_FALLBACK = "https://www.isgvizyon.com";

interface FormData {
  email: string;
  password: string;
  passwordConfirm: string;
  fullName: string;
  consentDataProcessing: boolean; // YENİ: KVKK Onayı
  consentMarketing: boolean;      // YENİ: Pazarlama Onayı
}

type FieldErrors = Partial<Record<keyof FormData | "mfaCode" | "forgotEmail", string>>;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getAppOrigin() {
  const configuredUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location.origin) {
    const { origin, hostname } = window.location;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return origin;
    }
  }

  return APP_URL_FALLBACK;
}

function getErrorMessage(err: any): string {
  return getUserFacingErrorMessage(err);
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validatePassword(password: string) {
  return password.length >= 8;
}

function Notice({ type, title, description }: { type: NoticeType; title: string; description?: string }) {
  const styles = useMemo(() => {
    switch (type) {
      case "success":
        return {
          wrap: "border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10",
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" />,
        };
      case "warning":
        return {
          wrap: "border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-orange-500/10",
          icon: <AlertTriangle className="h-4 w-4 text-amber-300" />,
        };
      case "error":
        return {
          wrap: "border-rose-500/25 bg-gradient-to-r from-rose-500/10 to-fuchsia-500/10",
          icon: <AlertTriangle className="h-4 w-4 text-rose-300" />,
        };
      case "info":
      default:
        return {
          wrap: "border-sky-500/25 bg-gradient-to-r from-sky-500/10 to-blue-500/10",
          icon: <Info className="h-4 w-4 text-sky-300" />,
        };
    }
  }, [type]);

  return (
    <div className={cn("rounded-2xl border p-4 shadow-[0_20px_60px_-40px_rgba(56,189,248,0.35)]", styles.wrap)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{styles.icon}</div>
        <div className="min-w-0">
          <div className="font-semibold text-sm text-white">{title}</div>
          {description ? <div className="mt-1 text-xs leading-5 text-slate-200/90">{description}</div> : null}
        </div>
      </div>
    </div>
  );
}

type StrengthLevel = "zayıf" | "orta" | "iyi" | "çok iyi";
function scorePassword(pw: string): { score: number; level: StrengthLevel } {
  if (!pw) return { score: 0, level: "zayıf" };
  let score = 0;
  const length = pw.length;
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (/password|123456|qwerty|111111|000000/i.test(pw)) score = Math.max(0, score - 2);

  const clamped = Math.min(5, Math.max(0, score));
  const level: StrengthLevel =
    clamped <= 1 ? "zayıf" : clamped === 2 ? "orta" : clamped === 3 ? "iyi" : "çok iyi";
  return { score: clamped, level };
}

function StrengthBar({ password }: { password: string }) {
  const { score, level } = useMemo(() => scorePassword(password), [password]);
  const pct = (score / 5) * 100;
  const color =
    level === "zayıf"
      ? "from-rose-500 to-orange-500"
      : level === "orta"
        ? "from-amber-500 to-yellow-500"
        : level === "iyi"
          ? "from-emerald-500 to-cyan-500"
          : "from-cyan-500 to-indigo-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">Şifre Gücü</span>
        <span
          className={cn(
            "text-[11px] font-semibold tracking-wide",
            level === "zayıf"
              ? "text-rose-300"
              : level === "orta"
                ? "text-amber-300"
                : level === "iyi"
                  ? "text-emerald-300"
                  : "text-cyan-300"
          )}
        >
          {level.toUpperCase()}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-950/50 border border-slate-700/60 overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-300", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function getDomain(email: string) {
  const v = email.trim().toLowerCase();
  const at = v.indexOf("@");
  if (at < 0) return "";
  return v.slice(at + 1);
}
function isLikelyCorporateDomain(domain: string) {
  if (!domain) return false;
  const personal = new Set([
    "gmail.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "yahoo.com",
    "icloud.com",
    "yandex.com",
    "proton.me",
    "protonmail.com",
  ]);
  return !personal.has(domain);
}

function AnimatedPanel({ activeKey, children }: { activeKey: string; children: React.ReactNode }) {
  return (
    <div key={activeKey} className="animate-[authIn_220ms_ease-out]">
      {children}
      <style>{`
        @keyframes authIn {
          from { opacity: 0; transform: translateY(12px) scale(0.995); filter: blur(10px); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
        }
      `}</style>
    </div>
  );
}

function FancyInput({
  icon,
  error,
  children,
}: {
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group">
      <div
        className={cn(
          "relative rounded-2xl p-[1px] transition",
          error
            ? "bg-gradient-to-r from-rose-500/70 via-fuchsia-500/60 to-orange-500/60"
            : "bg-gradient-to-r from-slate-700/70 via-slate-600/40 to-slate-700/70",
          "shadow-[0_18px_55px_-35px_rgba(99,102,241,0.45)]"
        )}
      >
        <div
          className={cn(
            "relative rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/5",
            "transition group-hover:bg-slate-900/45"
          )}
        >
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-slate-200 transition">
            {icon}
          </div>
          <div className="pl-10">{children}</div>

          {/* glow */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition",
              error ? "shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_0_60px_-10px_rgba(244,63,94,0.35)]" : "shadow-[0_0_0_1px_rgba(99,102,241,0.25),0_0_80px_-15px_rgba(99,102,241,0.35)]"
            )}
          />
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [resendCountdown, setResendCountdown] = useState(0);
  const [verifyEmail, setVerifyEmail] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [notice, setNotice] = useState<{ type: NoticeType; title: string; description?: string } | null>({
    type: "info",
    title: "Güvenli Giriş",
    description: "Hesabınıza güvenli şekilde erişin. Şüpheli cihazlarda ek doğrulama otomatik devreye girer.",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    passwordConfirm: "",
    fullName: "",
    consentDataProcessing: false, // Varsayılan olarak işaretlenmemiş
    consentMarketing: false,      // Varsayılan olarak işaretlenmemiş
  });

  // ✅ 2FA
  const [mfaCode, setMfaCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const isExtension = useMemo(() => new URLSearchParams(window.location.search).get("ext") === "true", []);
  const callbackUrl = useMemo(() => (isExtension ? "/auth/callback?ext=true" : "/auth/callback"), [isExtension]);
  const appOrigin = useMemo(() => getAppOrigin(), []);
  const authCallbackRedirect = useMemo(
    () => `${appOrigin}${isExtension ? "/auth/callback?ext=true" : "/auth/callback"}`,
    [appOrigin, isExtension],
  );
  const isBusy = loading || googleLoading;

  const domainHint = useMemo(() => {
    const domain = getDomain(formData.email);
    if (!domain) return null;

    if (isLikelyCorporateDomain(domain)) {
      return {
        type: "info" as const,
        title: "Kurumsal e-posta algılandı",
        description:
          "Şirket hesabınız varsa SSO kullanılabilir. Yöneticinizden SSO bağlantısı veya kurumsal giriş politikasını isteyin.",
      };
    }
    return {
      type: "warning" as const,
      title: "Kişisel e-posta algılandı",
      description: "Kurumsal kullanım için şirket e-postasıyla giriş yapmanız önerilir.",
    };
  }, [formData.email]);

  const setFieldError = (field: keyof FieldErrors, message?: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (!message) delete next[field];
      else next[field] = message;
      return next;
    });
  };
  const clearAllErrors = () => setFieldErrors({});

  // ✅ already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const targetRoute = resolvePostAuthRoute(callbackUrl);
        navigate(targetRoute, { replace: true });
      }
    };
    void checkUser();
  }, [navigate, callbackUrl]);

  // ✅ Email confirmation handler
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=signup")) {
      setNotice({ type: "info", title: "E-posta doğrulanıyor", description: "Kısa bir süre içinde girişe döneceksiniz." });
      toast.info("E-posta doğrulanıyor...");
      setTimeout(() => {
        toast.success("E-posta doğrulandı! Giriş yapabilirsiniz.");
        setMode("login");
        setNotice({ type: "success", title: "E-posta doğrulandı", description: "Şimdi giriş yapabilirsiniz." });
        window.location.hash = "";
      }, 1500);
    }
  }, []);

  // ✅ Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldError(name as keyof FormData, undefined);
  };

  const prefetchInitialData = async (userId: string) => {
    try {
      const snapshot = await fetchDashboardSnapshot(userId);
      writeDashboardSnapshot(userId, snapshot);
    } catch (error) {
      console.warn("Initial dashboard prefetch skipped:", error);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setNotice({ type: "info", title: "Google ile giriş", description: "Google hesabınıza yönlendiriliyorsunuz..." });

    try {
      window.localStorage.setItem(
        OAUTH_INTENT_STORAGE_KEY,
        JSON.stringify({
          accountType: "individual",
          email: formData.email.trim() || null,
        }),
      );

      const redirectTo = `${window.location.origin}${callbackUrl}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      setNotice({ type: details.severity, title: details.title, description: getUserFacingErrorDescription(error) });
      setGoogleLoading(false);
    }
  };

  const validateLoginForm = () => {
    clearAllErrors();
    let ok = true;

    const email = formData.email.trim();
    if (!email) {
      setFieldError("email", "E-posta gerekli.");
      ok = false;
    } else if (!validateEmail(email)) {
      setFieldError("email", "Geçerli bir e-posta adresi girin.");
      ok = false;
    }

    if (!formData.password) {
      setFieldError("password", "Şifre gerekli.");
      ok = false;
    }

    if (!ok) setNotice({ type: "error", title: "Lütfen alanları kontrol edin", description: "Eksik veya hatalı bilgi var." });
    return ok;
  };

  const validateRegisterForm = () => {
    clearAllErrors();
    let ok = true;

    if (!formData.fullName.trim()) {
      setFieldError("fullName", "Ad-soyad gerekli.");
      ok = false;
    }

    const email = formData.email.trim();
    if (!email) {
      setFieldError("email", "E-posta gerekli.");
      ok = false;
    } else if (!validateEmail(email)) {
      setFieldError("email", "Geçerli bir e-posta adresi girin.");
      ok = false;
    }

    if (!validatePassword(formData.password)) {
      setFieldError("password", "Şifre en az 8 karakter olmalı.");
      ok = false;
    }

    if (formData.password !== formData.passwordConfirm) {
      setFieldError("passwordConfirm", "Şifreler eşleşmiyor.");
      ok = false;
    }

    // YENİ: KVKK Checkbox Kontrolü
    if (!formData.consentDataProcessing) {
      setFieldError("consentDataProcessing", "Kayıt olmak için Aydınlatma Metni ve Kullanıcı Sözleşmesini onaylamanız gerekmektedir.");
      ok = false;
    }

    if (!ok) setNotice({ type: "error", title: "Lütfen alanları kontrol edin", description: "Eksik veya hatalı bilgi var." });
    return ok;
  };

  // ✅ LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;

    setLoading(true);
    setNotice({ type: "info", title: "Giriş yapılıyor", description: "Bilgileriniz doğrulanıyor..." });

    try {
      startNamedFlow("login", { method: "password", email: formData.email });

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (authError) {
        if (authError.message.includes("Email not confirmed")) {
          setMode("wait");
          setVerifyEmail(formData.email.trim());
          setNotice({ type: "warning", title: "E-posta doğrulaması gerekli", description: "Gelen kutunuzu ve spam klasörünü kontrol edin." });
          toast.info("E-postanızı doğrulayın");
          return;
        }
        throw authError;
      }

      if (!authData?.user?.id) throw new Error("Giriş başarısız. Lütfen tekrar deneyin.");

      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors && factors.totp && factors.totp.length > 0) {
        const totpFactor = factors.totp[0];

        const deviceTrusted = await isDeviceTrusted(authData.user.id);
        if (deviceTrusted) {
          toast.success("Giriş başarılı!", { description: "Güvenilir cihaz" });
          setNotice({ type: "success", title: "Giriş başarılı", description: "Güvenilir cihazdan giriş yapıldı." });

          await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", authData.user.id);
          await prefetchInitialData(authData.user.id);

          navigate(callbackUrl);
          return;
        }

        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: totpFactor.id,
        });
        if (challengeError) throw challengeError;

        setFactorId(totpFactor.id);
        setChallengeId(challengeData.id);
        setPendingUserId(authData.user.id);
        setMfaCode("");
        setTrustDevice(false);
        setMode("mfa");

        setNotice({ type: "warning", title: "Ek doğrulama gerekli (2FA)", description: "Yeni cihaz algılandı. 6 haneli kodu girin." });
        toast.info("2FA Kodu Gerekli", { description: "Yeni cihaz tespit edildi" });
        return;
      }

      await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", authData.user.id);
      await prefetchInitialData(authData.user.id);

      toast.success("Giriş başarılı!");
      setNotice({ type: "success", title: "Giriş başarılı", description: "Yönlendiriliyorsunuz..." });

      navigate(callbackUrl);
    } catch (error: any) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      setNotice({ type: details.severity, title: details.title, description: getUserFacingErrorDescription(error) });
    } finally {
      setLoading(false);
    }
  };

  // ✅ VERIFY 2FA
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();

    setFieldError("mfaCode", undefined);

    if (!mfaCode || mfaCode.length !== 6) {
      setFieldError("mfaCode", "Lütfen 6 haneli kod girin.");
      setNotice({ type: "error", title: "Kod eksik", description: "Authenticator kodu 6 haneli olmalı." });
      toast.error("6 haneli kod girin");
      return;
    }

    if (!factorId || !challengeId) {
      setNotice({ type: "error", title: "2FA verisi eksik", description: "Lütfen giriş akışını yeniden başlatın." });
      toast.error("2FA verisi eksik");
      return;
    }

    setLoading(true);
    setNotice({ type: "info", title: "Doğrulanıyor", description: "2FA kodu doğrulanıyor..." });

    try {
      const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: mfaCode });
      if (error) throw error;

      if (trustDevice && pendingUserId) {
        await trustCurrentDevice(pendingUserId);
        toast.success("Cihaz güvenilir olarak işaretlendi");
      }

      if (data.user) {
        await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);
        await prefetchInitialData(data.user.id);
      }

      toast.success("Giriş başarılı!");
      setNotice({ type: "success", title: "Giriş başarılı", description: "Yönlendiriliyorsunuz..." });
      navigate(callbackUrl);
    } catch (error: any) {
      const details = getUserFacingError(error);
      const description = getUserFacingErrorDescription(error);
      setFieldError("mfaCode", `${details.title}. ${details.action}`);
      setNotice({ type: details.severity, title: details.title, description });
      toast.error(details.title, { description });
    } finally {
      setLoading(false);
    }
  };

  // ✅ REGISTER
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;

    setLoading(true);
    setNotice({ type: "info", title: "Hesap oluşturuluyor", description: "Bilgileriniz kaydediliyor..." });

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: authCallbackRedirect,
          data: {
            full_name: formData.fullName.trim(),
            account_type: "individual",
            // YENİ: KVKK verileri metadata içine yazılır
            consent_data_processing: formData.consentDataProcessing,
            consent_marketing: formData.consentMarketing,
            consent_version: "v1.0",
            consent_date: new Date().toISOString(),
          },
        },
      });

      if (authError) throw new Error(`Hesap oluşturulamadı: ${authError.message}`);
      if (!authData?.user?.id) throw new Error("Kullanıcı oluşturulamadı");

      setVerifyEmail(formData.email.trim());
      setMode("wait");

      toast.success("Kayıt başarılı!", { description: "E-postanızı kontrol edin" });
      setNotice({ type: "success", title: "Kayıt başarılı", description: "Giriş yapabilmek için e-postanızı doğrulayın." });
    } catch (error: any) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      setNotice({ type: details.severity, title: details.title, description: getUserFacingErrorDescription(error) });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Resend email
  const handleResendEmail = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verifyEmail,
        options: {
          emailRedirectTo: authCallbackRedirect,
        },
      });
      if (error) throw error;

      setResendCountdown(60);
      toast.success("E-posta yeniden gönderildi");
      setNotice({ type: "success", title: "E-posta yeniden gönderildi", description: "Gelen kutunuzu ve spam klasörünü kontrol edin." });
    } catch (error: any) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      setNotice({ type: details.severity, title: details.title, description: getUserFacingErrorDescription(error) });
    }
  };

  // ✅ Forgot password
  const handleForgotPassword = async () => {
    setFieldError("forgotEmail", undefined);

    const email = (forgotEmail || formData.email).trim();
    if (!email) {
      setFieldError("forgotEmail", "E-posta gerekli.");
      toast.error("E-posta girin");
      return;
    }
    if (!validateEmail(email)) {
      setFieldError("forgotEmail", "Geçerli bir e-posta adresi girin.");
      toast.error("Geçerli e-posta girin");
      return;
    }

    setLoading(true);
    setNotice({ type: "info", title: "Sıfırlama e-postası gönderiliyor", description: "Lütfen bekleyin..." });

    try {
      const redirectTo = `${appOrigin}/auth/callback`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      toast.success("Eğer bu e-posta kayıtlıysa, sıfırlama bağlantısı gönderildi.");
      setNotice({
        type: "success",
        title: "E-posta gönderildi",
        description: "Eğer hesap varsa, şifre sıfırlama bağlantısı gelen kutunuza ulaşacaktır.",
      });

      setForgotOpen(false);
      setForgotEmail("");
    } catch (error: any) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      setNotice({ type: details.severity, title: details.title, description: getUserFacingErrorDescription(error) });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    clearAllErrors();
    setForgotOpen(false);

    if (next === "login") {
      setNotice({ type: "info", title: "Güvenli Giriş", description: "Hesabınıza güvenli şekilde erişin. Şüpheli cihazlarda ek doğrulama otomatik devreye girer." });
    } else if (next === "register") {
      setNotice({ type: "info", title: "Yeni hesap oluştur", description: "Kurumsal hesabınızı oluşturun ve ekibinizi dakikalar içinde yönetin." });
    }
  };

  // ======= RENDER =======
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ultra background (aurora + grid + noise) */}
      <div className="absolute inset-0 -z-10 bg-[#050816]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(99,102,241,0.35),transparent_65%),radial-gradient(900px_500px_at_10%_20%,rgba(168,85,247,0.25),transparent_60%),radial-gradient(900px_500px_at_90%_40%,rgba(34,211,238,0.18),transparent_60%)]" />
      <div className="absolute inset-0 -z-10 opacity-[0.25] bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div
        className="absolute inset-0 -z-10 opacity-[0.10] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[900px] rounded-full bg-gradient-to-r from-indigo-500/25 via-fuchsia-500/20 to-cyan-500/20 blur-3xl -z-10" />

      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="relative mx-auto h-16 w-16">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-[0_35px_90px_-35px_rgba(99,102,241,0.9)]" />
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-400/25 via-indigo-400/25 to-fuchsia-400/25 blur-xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 ring-1 ring-white/15">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                İSGVİZYON{" "}
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-200/90 align-middle">
                  <Sparkles className="h-3.5 w-3.5" />
                  Premium
                </span>
              </h1>
              <p className="text-sm text-slate-300/80 mt-1">AI Destekli İSG Yönetim Sistemi</p>
            </div>
          </div>

          {/* Card with gradient border */}
          <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-white/10 shadow-[0_50px_130px_-70px_rgba(99,102,241,0.75)]">
            <div className="rounded-3xl bg-slate-950/35 backdrop-blur-2xl border border-white/5 p-6">
              {notice ? (
                <div className="mb-5">
                  <Notice type={notice.type} title={notice.title} description={notice.description} />
                </div>
              ) : null}

              {domainHint && mode !== "mfa" && mode !== "wait" ? (
                <div className="mb-5">
                  <Notice type={domainHint.type} title={domainHint.title} description={domainHint.description} />
                </div>
              ) : null}

              {(mode === "login" || mode === "register") && (
                <div className="flex gap-2 bg-white/5 p-1 rounded-2xl mb-6 border border-white/10">
                  <button
                    onClick={() => switchMode("login")}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl font-semibold text-sm transition",
                      mode === "login"
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_20px_60px_-35px_rgba(99,102,241,0.9)]"
                        : "text-slate-200/80 hover:text-white hover:bg-white/5"
                    )}
                    type="button"
                    disabled={isBusy}
                  >
                    Giriş Yap
                  </button>
                  <button
                    onClick={() => switchMode("register")}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl font-semibold text-sm transition",
                      mode === "register"
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_20px_60px_-35px_rgba(99,102,241,0.9)]"
                        : "text-slate-200/80 hover:text-white hover:bg-white/5"
                    )}
                    type="button"
                    disabled={isBusy}
                  >
                    Kayıt Ol
                  </button>
                </div>
              )}

              {/* LOGIN */}
              {mode === "login" && (
                <AnimatedPanel activeKey="login">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-4 shadow-[0_30px_90px_-70px_rgba(16,185,129,0.7)]">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-emerald-300 mt-0.5" />
                        <div>
                          <h3 className="text-white font-semibold text-sm">Premium Güvenlik</h3>
                          <p className="text-slate-200/90 text-xs mt-1 leading-5">
                            2FA etkin hesaplarda yeni cihazlarda ek doğrulama devreye girer. Güvenilir cihaz seçeneğiyle 30 gün hızlı giriş yapabilirsiniz.
                          </p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white text-sm flex items-center gap-2">
                          <Mail className="h-4 w-4 text-cyan-300" />
                          E-posta
                        </Label>

                        <FancyInput icon={<Mail className="h-4 w-4" />} error={fieldErrors.email}>
                          <Input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="ornek@firma.com"
                            className="bg-transparent border-0 text-white h-11 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                             disabled={isBusy}
                            required
                            autoComplete="email"
                          />
                        </FancyInput>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white text-sm flex items-center gap-2">
                          <Lock className="h-4 w-4 text-cyan-300" />
                          Şifre
                        </Label>

                        <div className="relative">
                          <FancyInput icon={<Lock className="h-4 w-4" />} error={fieldErrors.password}>
                            <Input
                              type={showPassword ? "text" : "password"}
                              name="password"
                              value={formData.password}
                              onChange={handleInputChange}
                              placeholder="••••••••"
                              className="bg-transparent border-0 text-white h-11 pr-10 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                              disabled={isBusy}
                              required
                              autoComplete="current-password"
                            />
                          </FancyInput>

                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                            disabled={isBusy}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setForgotOpen((v) => !v);
                              setForgotEmail(formData.email.trim());
                              setFieldError("forgotEmail", undefined);
                            }}
                            className="text-xs text-slate-200/80 hover:text-white underline decoration-white/20 hover:decoration-white/60 transition"
                            disabled={isBusy}
                          >
                            Şifremi unuttum
                          </button>

                          <div className="text-xs text-slate-300/70 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-300" />
                            2FA destekli
                          </div>
                        </div>
                      </div>

                      {forgotOpen && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3 shadow-[0_40px_120px_-85px_rgba(56,189,248,0.7)]">
                          <div className="flex items-start gap-3">
                            <KeyRound className="h-4 w-4 text-sky-300 mt-0.5" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">Şifre Sıfırlama</div>
                              <div className="text-xs text-slate-300 mt-1 leading-5">
                                E-posta adresinizi girin. Eğer hesap varsa, sıfırlama bağlantısı gönderilecektir.
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white text-sm">E-posta</Label>

                            <FancyInput icon={<Mail className="h-4 w-4" />} error={fieldErrors.forgotEmail}>
                              <Input
                                type="email"
                                value={forgotEmail}
                                onChange={(e) => {
                                  setForgotEmail(e.target.value);
                                  setFieldError("forgotEmail", undefined);
                                }}
                                placeholder="ornek@firma.com"
                                className="bg-transparent border-0 text-white h-10 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                                disabled={isBusy}
                                autoComplete="email"
                              />
                            </FancyInput>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => void handleForgotPassword()}
                              disabled={isBusy}
                              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 shadow-[0_25px_80px_-45px_rgba(56,189,248,0.9)]"
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Gönderiliyor...
                                </>
                              ) : (
                                <>
                                  Bağlantı Gönder <ArrowRight className="h-4 w-4 ml-2" />
                                </>
                              )}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => setForgotOpen(false)}
                              className="h-10 rounded-xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                            >
                              İptal
                            </Button>
                          </div>
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={isBusy}
                        className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-[0_35px_110px_-70px_rgba(99,102,241,1)]"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Giriş yapılıyor...
                          </>
                        ) : (
                          "Giriş Yap"
                        )}
                      </Button>

                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-[11px] uppercase tracking-[0.30em] text-slate-400">
                          <span className="bg-slate-950/35 px-3 rounded-full border border-white/10">veya</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void handleGoogleLogin()}
                        className="h-11 w-full rounded-xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                      >
                        {googleLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Yönlendiriliyor...
                          </>
                        ) : (
                          <>
                            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                fill="#4285F4"
                                d="M21.6 12.23c0-.68-.06-1.34-.18-1.97H12v3.73h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.98-4.34 2.98-7.28Z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.23-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.58A9.98 9.98 0 0 0 12 22Z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M6.41 13.9A5.98 5.98 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.52H3.08A9.98 9.98 0 0 0 2 12c0 1.61.39 3.13 1.08 4.48l3.33-2.58Z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.98c1.47 0 2.8.5 3.84 1.5l2.88-2.88C16.95 2.98 14.69 2 12 2 8.09 2 4.73 4.24 3.08 7.52l3.33 2.58C7.2 7.74 9.4 5.98 12 5.98Z"
                              />
                            </svg>
                            Google ile giriş yap
                          </>
                        )}
                      </Button>
                    </form>
                  </div>
                </AnimatedPanel>
              )}

              {/* REGISTER */}
              {mode === "register" && (
                <AnimatedPanel activeKey="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-4 shadow-[0_30px_90px_-70px_rgba(59,130,246,0.75)]">
                      <div className="flex items-start gap-3">
                        <User className="mt-0.5 h-5 w-5 text-blue-300" />
                        <div>
                          <h3 className="text-sm font-semibold text-white">Bireysel kullanıcı kaydı</h3>
                          <p className="text-slate-200/90 text-xs mt-1 leading-5">
                            Hesabınızı ad, soyad, e-posta ve şifrenizle oluşturun. Organizasyon oluşturma adımı girişten sonra, ihtiyaç duyduğunuz anda ayrı olarak başlatılır.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white text-sm flex items-center gap-2">
                        <User className="h-4 w-4 text-cyan-300" />
                          Ad Soyad
                      </Label>
                      <FancyInput icon={<User className="h-4 w-4" />} error={fieldErrors.fullName}>
                        <Input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          placeholder="Örn: Ahmet Yılmaz"
                          className="bg-transparent border-0 text-white h-11 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                          disabled={isBusy}
                          required
                          autoComplete="name"
                        />
                      </FancyInput>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white text-sm flex items-center gap-2">
                        <Mail className="h-4 w-4 text-cyan-300" />
                        E-posta
                      </Label>
                      <FancyInput icon={<Mail className="h-4 w-4" />} error={fieldErrors.email}>
                        <Input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="ornek@firma.com"
                          className="bg-transparent border-0 text-white h-11 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                          disabled={isBusy}
                          required
                          autoComplete="email"
                        />
                      </FancyInput>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-white text-sm flex items-center gap-2">
                          <Lock className="h-4 w-4 text-cyan-300" />
                          Şifre
                        </Label>
                        <FancyInput icon={<Lock className="h-4 w-4" />} error={fieldErrors.password}>
                          <Input
                            type={showRegisterPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            className="bg-transparent border-0 text-white h-11 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                            disabled={isBusy}
                            required
                            autoComplete="new-password"
                          />
                        </FancyInput>
                        {fieldErrors.password ? <p className="text-xs text-rose-300">{fieldErrors.password}</p> : <StrengthBar password={formData.password} />}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white text-sm flex items-center gap-2">
                          <Lock className="h-4 w-4 text-cyan-300" />
                          Şifre Tekrar
                        </Label>
                        <FancyInput icon={<Lock className="h-4 w-4" />} error={fieldErrors.passwordConfirm}>
                          <Input
                            type={showRegisterPassword ? "text" : "password"}
                            name="passwordConfirm"
                            value={formData.passwordConfirm}
                            onChange={handleInputChange}
                            className="bg-transparent border-0 text-white h-11 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                            disabled={isBusy}
                            required
                            autoComplete="new-password"
                          />
                        </FancyInput>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <Checkbox
                        id="show-register-password"
                        checked={showRegisterPassword}
                        onCheckedChange={(checked) => setShowRegisterPassword(Boolean(checked))}
                        disabled={isBusy}
                      />
                      <Label htmlFor="show-register-password" className="text-sm text-slate-200 cursor-pointer">
                        Şifreyi göster
                      </Label>
                    </div>

                   {/* KVKK ve Sözleşme Onay Alanları */}
                      <div className="space-y-3 mt-4 mb-2">
                        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <Checkbox
                            id="consentDataProcessing"
                            checked={formData.consentDataProcessing}
                            onCheckedChange={(checked) => {
                              setFormData((prev) => ({ ...prev, consentDataProcessing: Boolean(checked) }));
                              setFieldError("consentDataProcessing", undefined);
                            }}
                            disabled={isBusy}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label htmlFor="consentDataProcessing" className="text-xs text-slate-300 cursor-pointer leading-5">
                              <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); setShowKvkkModal(true); }} 
                                className="text-cyan-400 hover:underline"
                              >
                                KVKK Aydınlatma Metni
                              </button>
                              'ni ve{' '}
                              <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }} 
                                className="text-cyan-400 hover:underline"
                              >
                                Kullanıcı Sözleşmesi
                              </button>
                              'ni okudum, kişisel verilerimin işlenmesini onaylıyorum.
                            </Label>
                            {fieldErrors.consentDataProcessing && (
                              <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.consentDataProcessing}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <Checkbox
                            id="consentMarketing"
                            checked={formData.consentMarketing}
                            onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, consentMarketing: Boolean(checked) }))}
                            disabled={isBusy}
                            className="mt-1"
                          />
                          <Label htmlFor="consentMarketing" className="text-xs text-slate-300 cursor-pointer leading-5 flex-1">
                            İndirimler, yeni özellikler ve İSG sektörel güncellemeleri hakkında e-posta almayı kabul ediyorum. (Opsiyonel)
                          </Label>
                        </div>
                      </div>

                    <Button
                      type="submit"
                      disabled={isBusy}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-[0_35px_110px_-70px_rgba(99,102,241,1)]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Kayıt ediliyor...
                        </>
                      ) : (
                        "Hesabı Oluştur"
                      )}
                    </Button>
                  </form>
                </AnimatedPanel>
              )}

              {/* MFA */}
              {mode === "mfa" && (
                <AnimatedPanel activeKey="mfa">
                  <form onSubmit={(e) => void handleVerify2FA(e)} className="space-y-6">
                    <div className="text-center">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20 ring-1 ring-white/10">
                        <Shield className="h-8 w-8 text-white" />
                      </div>
                      <h2 className="text-xl font-bold text-white">2FA Doğrulama</h2>
                      <p className="text-sm text-slate-400 mt-1">Authenticator uygulamanızdan 6 haneli kodu girin</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white">Doğrulama Kodu</Label>
                      <FancyInput icon={<Shield className="h-4 w-4" />} error={fieldErrors.mfaCode}>
                        <Input
                          type="text"
                          value={mfaCode}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setMfaCode(v);
                            setFieldError("mfaCode", undefined);
                          }}
                          placeholder="123456"
                          className="bg-transparent border-0 text-white h-12 text-center text-2xl tracking-widest font-mono focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                          maxLength={6}
                          autoFocus
                          disabled={isBusy}
                          inputMode="numeric"
                        />
                      </FancyInput>
                    </div>

                    <div className="flex items-center space-x-2 p-3 bg-white/[0.03] rounded-xl border border-white/10">
                      <Checkbox
                        id="trust"
                        checked={trustDevice}
                        onCheckedChange={(checked) => setTrustDevice(checked as boolean)}
                        disabled={isBusy}
                      />
                      <label htmlFor="trust" className="text-sm text-white cursor-pointer flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                          Bu cihazı 30 gün güvenilir olarak işaretle
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Ortak cihazlarda işaretlemeyin.</div>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <Button
                        type="submit"
                        disabled={loading || mfaCode.length !== 6}
                        className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Doğrulanıyor...
                          </>
                        ) : (
                          "Doğrula ve Giriş Yap"
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          switchMode("login");
                          setMfaCode("");
                          setTrustDevice(false);
                          setFactorId(null);
                          setChallengeId(null);
                          setPendingUserId(null);
                        }}
                        className="w-full text-slate-300 hover:text-white"
                        disabled={isBusy}
                      >
                        Geri Dön
                      </Button>
                    </div>
                  </form>
                </AnimatedPanel>
              )}

              {/* WAIT */}
              {mode === "wait" && (
                <AnimatedPanel activeKey="wait">
                  <div className="space-y-6">
                    <div className="text-center">
                      <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
                      <h2 className="text-xl font-bold text-white">E-postanızı Kontrol Edin</h2>
                      <p className="text-sm text-slate-400 mt-2 break-all">{verifyEmail}</p>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2">
                      <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200">
                        E-posta birkaç dakika içinde ulaşmalı. Spam/Junk klasörünü de kontrol edin.
                      </p>
                    </div>

                    <Button
                      onClick={handleResendEmail}
                      disabled={resendCountdown > 0 || isBusy}
                      variant="outline"
                      className="w-full rounded-xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                    >
                      {resendCountdown > 0 ? (
                        <>
                          <Clock className="h-4 w-4 mr-2" />
                          E-postayı yeniden gönder ({resendCountdown}s)
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          E-postayı Yeniden Gönder
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => switchMode("login")}
                      variant="ghost"
                      className="w-full text-slate-300 hover:text-white"
                      disabled={isBusy}
                    >
                      ← Giriş Sayfasına Dön
                    </Button>
                  </div>
                </AnimatedPanel>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400/70">© 2026 İSGVizyon. Tüm hakları saklıdır.</p>
        </div>
      </div>
      {/* ↓↓↓ YENİ EKLENEN MODALLAR ↓↓↓ */}
      <Dialog open={showKvkkModal} onOpenChange={setShowKvkkModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-slate-700 bg-slate-950 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">KVKK Aydınlatma Metni</DialogTitle>
            <DialogDescription className="text-slate-400">
              Kişisel verilerinizin işlenmesi hakkında bilgilendirme.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed mt-4">
            <h4 className="font-semibold text-white">1. Veri Sorumlusu</h4>
            <p>İSGVİZYON İSG Platformu veri sorumlusu olarak, 6698 sayılı KVKK kapsamında kişisel verilerinizi işlemektedir.</p>
            
            <h4 className="font-semibold text-white mt-4">2. İşlenen Kişisel Veriler ve Amaçları</h4>
            <p>Ad, soyad, e-posta ve çalıştığınız kurum bilgileri; platform hizmetlerinin sunulması, risk değerlendirmelerinin yapılması ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir.</p>
            
            <h4 className="font-semibold text-white mt-4">3. Veri Güvenliği</h4>
            <p>Verileriniz, rol tabanlı erişim kontrolü (RLS) ve şifreleme yöntemleriyle SOC 2 uyumlu sunucularda yüksek güvenlik standartlarında korunmaktadır.</p>
            
            <h4 className="font-semibold text-white mt-4">4. Haklarınız</h4>
            <p>KVKK Madde 11 kapsamında verilerinizin silinmesini, güncellenmesini veya dışa aktarılmasını talep etme hakkına sahipsiniz. Bu işlemleri platform içindeki "Veri Haklarım" menüsünden gerçekleştirebilirsiniz.</p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowKvkkModal(false)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">Okudum, Anladım</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-slate-700 bg-slate-950 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">Kullanıcı Sözleşmesi</DialogTitle>
            <DialogDescription className="text-slate-400">
              Platformun kullanım koşulları ve hizmet şartları.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed mt-4">
            <h4 className="font-semibold text-white">1. Taraflar ve Kapsam</h4>
            <p>Bu sözleşme, İSGVizyon platformunu kullanan bireysel uzmanlar ve kurumsal OSGB'ler ile platform yönetimi arasındaki kullanım şartlarını belirler.</p>
            
            <h4 className="font-semibold text-white mt-4">2. Hizmet Kullanımı</h4>
            <p>Kullanıcı, platforma girdiği verilerin (risk analizleri, denetimler, personel kayıtları) doğruluğundan bizzat sorumludur. Platform, sağlanan yasal içeriklerin (mevzuat özetleri vb.) sadece bilgilendirme amaçlı olduğunu beyan eder.</p>
            
            <h4 className="font-semibold text-white mt-4">3. Fikri Mülkiyet</h4>
            <p>Uygulama içindeki AI analiz algoritmaları, risk matrisi tasarımları ve arayüz öğeleri İSGVizyon'a aittir, kopyalanamaz ve çoğaltılamaz.</p>
            
            <h4 className="font-semibold text-white mt-4">4. Sözleşme Feshi</h4>
            <p>Kullanıcı dilediği zaman aboneliğini iptal edebilir ve verilerinin dışa aktarımını talep ettikten sonra tamamen silinmesini isteyebilir.</p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowTermsModal(false)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">Okudum, Anladım</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
