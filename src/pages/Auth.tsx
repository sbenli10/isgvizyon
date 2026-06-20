import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileCheck2,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchDashboardSnapshot, writeDashboardSnapshot } from "@/lib/dashboardCache";
import { resolvePostAuthRoute } from "@/lib/navigationPersistence";
import { startNamedFlow } from "@/lib/perfTiming";
import { getUserFacingError, getUserFacingErrorDescription } from "@/lib/userFacingError";
import { isDeviceTrusted, trustCurrentDevice } from "@/utils/deviceFingerprint";
import { toast } from "sonner";

type AuthMode = "login" | "register" | "wait" | "mfa";
type NoticeType = "info" | "success" | "warning" | "error";

const OAUTH_INTENT_STORAGE_KEY = "denetron-oauth-intent";
const APP_URL_FALLBACK = "https://www.isgvizyon.com";

interface FormData {
  email: string;
  password: string;
  passwordConfirm: string;
  fullName: string;
  consentDataProcessing: boolean;
  consentMarketing: boolean;
}

type FieldErrors = Partial<Record<keyof FormData | "mfaCode" | "forgotEmail", string>>;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getAppOrigin() {
  const configuredUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location.origin) {
    const { origin, hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return origin;
  }

  return APP_URL_FALLBACK;
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
          wrap: "border-emerald-200 bg-emerald-50",
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        };
      case "warning":
        return {
          wrap: "border-amber-200 bg-amber-50",
          icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
        };
      case "error":
        return {
          wrap: "border-rose-200 bg-rose-50",
          icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
        };
      case "info":
      default:
        return {
          wrap: "border-slate-200 bg-slate-50",
          icon: <Info className="h-4 w-4 text-slate-700" />,
        };
    }
  }, [type]);

  return (
    <div className={cn("rounded-xl border p-4", styles.wrap)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{styles.icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-bold !text-slate-950">{title}</div>
          {description ? <div className="mt-1 text-xs leading-5 !text-slate-600">{description}</div> : null}
        </div>
      </div>
    </div>
  );
}

type StrengthLevel = "zayıf" | "orta" | "iyi" | "çok iyi";

function scorePassword(pw: string): { score: number; level: StrengthLevel } {
  if (!pw) return { score: 0, level: "zayıf" };

  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (/password|123456|qwerty|111111|000000/i.test(pw)) score = Math.max(0, score - 2);

  const clamped = Math.min(5, Math.max(0, score));
  const level: StrengthLevel = clamped <= 1 ? "zayıf" : clamped === 2 ? "orta" : clamped === 3 ? "iyi" : "çok iyi";

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
        <span className="text-[11px] !text-slate-500">Şifre Gücü</span>
        <span
          className={cn(
            "text-[11px] font-bold tracking-wide",
            level === "zayıf"
              ? "text-rose-300"
              : level === "orta"
                ? "text-amber-300"
                : level === "iyi"
                  ? "text-emerald-300"
                  : "text-cyan-300",
          )}
        >
          {level.toUpperCase()}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-300", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AnimatedPanel({ activeKey, children }: { activeKey: string; children: React.ReactNode }) {
  return (
    <div key={activeKey} className="animate-[authIn_220ms_ease-out]">
      {children}
      <style>{`
        @keyframes authIn {
          from { opacity: 0; transform: translateY(10px) scale(0.995); filter: blur(10px); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}

function FancyInput({ icon, error, children }: { icon: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <div
        className={cn(
          "relative rounded-2xl border bg-white transition",
          error ? "border-rose-400 shadow-[0_0_0_4px_rgba(244,63,94,0.10)]" : "border-slate-200 shadow-sm focus-within:border-blue-500 focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]",
        )}
      >
        <div className="relative rounded-2xl bg-white">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-blue-600">{icon}</div>
          <div className="pl-10">{children}</div>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.34-.18-1.97H12v3.73h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.98-4.34 2.98-7.28Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.23-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.58A9.98 9.98 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.9A5.98 5.98 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.52H3.08A9.98 9.98 0 0 0 2 12c0 1.61.39 3.13 1.08 4.48l3.33-2.58Z" />
      <path fill="#EA4335" d="M12 5.98c1.47 0 2.8.5 3.84 1.5l2.88-2.88C16.95 2.98 14.69 2 12 2 8.09 2 4.73 4.24 3.08 7.52l3.33 2.58C7.2 7.74 9.4 5.98 12 5.98Z" />
    </svg>
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [mfaCode, setMfaCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: NoticeType; title: string; description?: string } | null>({
    type: "info",
    title: "Güvenli giriş",
    description: "Hesabınıza güvenli şekilde erişin. Şüpheli cihazlarda ek doğrulama otomatik devreye girer.",
  });
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    passwordConfirm: "",
    fullName: "",
    consentDataProcessing: false,
    consentMarketing: false,
  });

  const isExtension = useMemo(() => new URLSearchParams(window.location.search).get("ext") === "true", []);
  const callbackUrl = useMemo(() => (isExtension ? "/auth/callback?ext=true" : "/auth/callback"), [isExtension]);
  const appOrigin = useMemo(() => getAppOrigin(), []);
  const authCallbackRedirect = useMemo(() => `${appOrigin}${isExtension ? "/auth/callback?ext=true" : "/auth/callback"}`, [appOrigin, isExtension]);
  const isBusy = loading || googleLoading;

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const previousHtmlBackground = document.documentElement.style.background;
    const appRoot = document.getElementById("root");
    const previousRootBackground = appRoot?.style.background;

    document.body.style.background = "#eaf0f8";
    document.documentElement.style.background = "#eaf0f8";
    if (appRoot) appRoot.style.background = "#eaf0f8";

    return () => {
      document.body.style.background = previousBodyBackground;
      document.documentElement.style.background = previousHtmlBackground;
      if (appRoot && previousRootBackground !== undefined) appRoot.style.background = previousRootBackground;
    };
  }, []);

  const setFieldError = (field: keyof FieldErrors, message?: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (!message) delete next[field];
      else next[field] = message;
      return next;
    });
  };

  const clearAllErrors = () => setFieldErrors({});

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

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
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
        JSON.stringify({ accountType: "individual", email: formData.email.trim() || null }),
      );

      const redirectTo = `${window.location.origin}${callbackUrl}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { access_type: "offline", prompt: "select_account" } },
      });
      if (error) throw error;
    } catch (error: unknown) {
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
    const email = formData.email.trim();

    if (!formData.fullName.trim()) {
      setFieldError("fullName", "Ad-soyad gerekli.");
      ok = false;
    }
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
    if (!formData.consentDataProcessing) {
      setFieldError("consentDataProcessing", "Kayıt olmak için Aydınlatma Metni ve Kullanıcı Sözleşmesini onaylamanız gerekmektedir.");
      ok = false;
    }

    if (!ok) setNotice({ type: "error", title: "Lütfen alanları kontrol edin", description: "Eksik veya hatalı bilgi var." });
    return ok;
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
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
      if (factors?.totp && factors.totp.length > 0) {
        const totpFactor = factors.totp[0];
        const deviceTrusted = await isDeviceTrusted(authData.user.id);

        if (deviceTrusted) {
          toast.success("Giriş başarılı!", { description: "Güvenilir cihaz" });
          await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", authData.user.id);
          await prefetchInitialData(authData.user.id);
          navigate(callbackUrl);
          return;
        }

        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
        if (challengeError) throw challengeError;

        setFactorId(totpFactor.id);
        setChallengeId(challengeData.id);
        setPendingUserId(authData.user.id);
        setMfaCode("");
        setTrustDevice(false);
        setMode("mfa");
        setNotice({ type: "warning", title: "Ek doğrulama gerekli", description: "Yeni cihaz algılandı. 6 haneli kodu girin." });
        toast.info("2FA kodu gerekli", { description: "Yeni cihaz tespit edildi" });
        return;
      }

      await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", authData.user.id);
      await prefetchInitialData(authData.user.id);
      toast.success("Giriş başarılı!");
      setNotice({ type: "success", title: "Giriş başarılı", description: "Yönlendiriliyorsunuz..." });
      navigate(callbackUrl);
    } catch (error: unknown) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      setNotice({ type: details.severity, title: details.title, description: getUserFacingErrorDescription(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (event: React.FormEvent) => {
    event.preventDefault();
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
    } catch (error: unknown) {
      const details = getUserFacingError(error);
      const description = getUserFacingErrorDescription(error);
      setFieldError("mfaCode", `${details.title}. ${details.action}`);
      setNotice({ type: details.severity, title: details.title, description });
      toast.error(details.title, { description });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
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
    } catch (error: unknown) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      setNotice({ type: details.severity, title: details.title, description: getUserFacingErrorDescription(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verifyEmail,
        options: { emailRedirectTo: authCallbackRedirect },
      });
      if (error) throw error;

      setResendCountdown(60);
      toast.success("E-posta yeniden gönderildi");
      setNotice({ type: "success", title: "E-posta yeniden gönderildi", description: "Gelen kutunuzu ve spam klasörünü kontrol edin." });
    } catch (error: unknown) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      setNotice({ type: details.severity, title: details.title, description: getUserFacingErrorDescription(error) });
    }
  };

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
    } catch (error: unknown) {
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
      setNotice({ type: "info", title: "Güvenli giriş", description: "Hesabınıza güvenli şekilde erişin. Şüpheli cihazlarda ek doğrulama otomatik devreye girer." });
    } else if (next === "register") {
      setNotice({ type: "info", title: "Yeni hesap oluştur", description: "Hesabınızı oluşturun ve İSG süreçlerinizi dakikalar içinde yönetmeye başlayın." });
    }
  };

  const activeHeading =
    mode === "register"
      ? "ISGVizyon'a başlayın"
      : mode === "mfa"
        ? "Ek doğrulama"
        : mode === "wait"
          ? "E-postanızı kontrol edin"
          : "Tekrar Hoş Geldiniz!";

  const activeEyebrow = mode === "register" ? "Yeni hesabınızı oluşturun" : "Hesabınıza giriş yapın";

  return (
    <div
      data-auth-root="true"
      data-theme="light"
      className="auth-minimal-surface fixed inset-0 isolate h-dvh w-screen overflow-y-auto overflow-x-hidden bg-white text-slate-950 lg:overflow-hidden"
      style={{ colorScheme: "light" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.15),transparent_31%),linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]" />
      <div className="pointer-events-none absolute left-[-8rem] top-[-8rem] h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-9rem] right-[-7rem] h-[30rem] w-[30rem] rounded-full bg-violet-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(#2563eb_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1480px] grid-cols-1 items-center gap-10 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 lg:px-12 xl:px-16 2xl:px-20">
        <section className="relative min-w-0 overflow-hidden py-2 lg:py-0">
          <div aria-hidden="true" className="absolute left-[9%] top-[12%] h-40 w-40 rounded-[3rem] bg-gradient-to-br from-cyan-300/35 to-blue-500/20 blur-2xl" />
          <div aria-hidden="true" className="absolute bottom-[8%] right-[8%] h-56 w-56 rounded-full bg-gradient-to-br from-violet-400/25 to-blue-500/20 blur-3xl" />
          <div aria-hidden="true" className="absolute left-[55%] top-[10%] hidden h-24 w-24 rotate-12 rounded-[2rem] border border-blue-200/70 bg-white/40 shadow-xl shadow-blue-500/10 backdrop-blur-xl lg:block" />

          <div className="relative flex w-full min-w-0 flex-col gap-10 lg:gap-14">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-700 shadow-sm backdrop-blur-xl">
                <Sparkles className="h-4 w-4 text-cyan-500" />
                AI destekli İSG yönetimi
              </div>
              <h2 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-7xl">
                İSG süreçlerini
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-violet-600 bg-clip-text text-transparent">tek ekranda yönetin</span>
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Risk analizi, çalışan yönetimi, eğitim planları, sertifikalar ve doküman süreçlerini tek merkezden yönetin.
              </p>
            </div>

            <div className="relative min-h-[330px] lg:min-h-[390px]">
              <div className="absolute left-0 top-0 w-[min(88vw,520px)] rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-[0_24px_70px_rgba(37,99,235,0.16)] backdrop-blur-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-sm font-black text-slate-950">ISGVizyon Operasyon Merkezi</p>
                    <p className="mt-1 text-xs text-slate-500">Bugünün güvenlik akışı</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">Canlı</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["128", "Aktif Firma", "from-blue-500 to-cyan-400"],
                    ["34", "Açık Risk", "from-violet-500 to-blue-500"],
                    ["92%", "Eğitim Uyum", "from-emerald-400 to-cyan-400"],
                  ].map(([value, label, gradient]) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                      <div className={cn("mb-3 h-1.5 rounded-full bg-gradient-to-r", gradient)} />
                      <p className="text-2xl font-black text-slate-950">{value}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" />
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="h-full w-[58%] rounded-full bg-gradient-to-r from-violet-500 to-blue-500" />
                  </div>
                </div>
              </div>

              <div className="absolute right-0 top-8 hidden w-64 rounded-[1.75rem] border border-cyan-100 bg-white/85 p-4 shadow-[0_22px_55px_rgba(6,182,212,0.18)] backdrop-blur-xl md:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Sertifika Durumu</p>
                    <p className="text-xs text-slate-500">1.764 belge takipte</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-6 left-8 hidden w-72 rounded-[1.75rem] border border-violet-100 bg-white/85 p-4 shadow-[0_22px_55px_rgba(124,58,237,0.16)] backdrop-blur-xl sm:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">Eğitim Planları</p>
                    <p className="truncate text-xs text-slate-500">7 günlük aksiyon takvimi hazır</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 right-8 w-72 rounded-[1.75rem] border border-blue-100 bg-white/90 p-4 shadow-[0_22px_55px_rgba(37,99,235,0.16)] backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-950">AI Önerisi</p>
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700">Yeni</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Kritik risk kayıtları için otomatik önceliklendirme hazır.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex w-full justify-center lg:min-h-[620px] lg:items-center">
          <div className="mx-auto w-full max-w-[400px] rounded-[32px] border border-slate-200/80 bg-white/95 p-7 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-violet-600 shadow-lg shadow-blue-500/20">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-black leading-none !text-slate-950">ISGVizyon</p>
                      <p className="mt-1 text-xs font-medium !text-slate-500">İSG yönetim platformu</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.18em] !text-blue-600">{activeEyebrow}</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight !text-slate-950">{activeHeading}</h1>
                    <p className="mt-2 text-sm leading-6 !text-slate-500">Hesabınıza giriş yaparak İSGVizyon panelinize devam edin.</p>
                  </div>
                </div>

                <div>
                  {notice ? (
                    <div className="mb-5">
                      <Notice type={notice.type} title={notice.title} description={notice.description} />
                    </div>
                  ) : null}

                  {mode === "login" && (
                    <AnimatedPanel activeKey="login">
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="login-email" className="flex items-center gap-2 text-sm font-medium !text-slate-700">
                            <Mail className="h-4 w-4 text-slate-400" />
                            E-posta adresi
                          </Label>
                          <FancyInput icon={<Mail className="h-4 w-4" />} error={fieldErrors.email}>
                            <Input
                              id="login-email"
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleInputChange}
                              placeholder="ornek@firma.com"
                              className="h-12 border-0 bg-transparent !text-slate-950 placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                              disabled={isBusy}
                              required
                              autoComplete="email"
                            />
                          </FancyInput>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="login-password" className="flex items-center gap-2 text-sm font-medium !text-slate-700">
                            <Lock className="h-4 w-4 text-slate-400" />
                            Şifre
                          </Label>
                          <div className="relative">
                            <FancyInput icon={<Lock className="h-4 w-4" />} error={fieldErrors.password}>
                              <Input
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="Şifrenizi girin"
                                className="h-12 border-0 bg-transparent pr-10 !text-slate-950 placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                                disabled={isBusy}
                                required
                                autoComplete="current-password"
                              />
                            </FancyInput>
                            <button
                              type="button"
                              onClick={() => setShowPassword((value) => !value)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-950"
                              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                              disabled={isBusy}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>

                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 accent-[#2b2b2b]" />
                              Beni hatırla
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setForgotOpen((value) => !value);
                                setForgotEmail(formData.email.trim());
                                setFieldError("forgotEmail", undefined);
                              }}
                              className="text-xs font-medium text-slate-800 transition hover:text-slate-500"
                              disabled={isBusy}
                            >
                              Şifremi sıfırla
                            </button>
                          </div>
                        </div>

                        {forgotOpen ? (
                          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start gap-3">
                              <KeyRound className="mt-0.5 h-4 w-4 text-slate-700" />
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-950">Şifre sıfırlama</div>
                                <div className="mt-1 text-xs leading-5 text-slate-600">
                                  E-posta adresinizi girin. Eğer hesap varsa, sıfırlama bağlantısı gönderilecektir.
                                </div>
                              </div>
                            </div>
                            <FancyInput icon={<Mail className="h-4 w-4" />} error={fieldErrors.forgotEmail}>
                              <Input
                                id="forgot-email"
                                name="forgotEmail"
                                type="email"
                                value={forgotEmail}
                                onChange={(event) => {
                                  setForgotEmail(event.target.value);
                                  setFieldError("forgotEmail", undefined);
                                }}
                                placeholder="ornek@firma.com"
                                className="h-10 border-0 bg-transparent !text-slate-950 placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                                disabled={isBusy}
                                autoComplete="email"
                              />
                            </FancyInput>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                onClick={() => void handleForgotPassword()}
                                disabled={isBusy}
                                className="h-10 flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm hover:from-blue-700 hover:to-cyan-600"
                              >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                Gönder
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => setForgotOpen(false)}
                                className="h-10 rounded-lg border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                              >
                                İptal
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <Button
                          type="submit"
                          disabled={isBusy}
                          className="auth-minimal-primary h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 font-black text-white shadow-[0_20px_45px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 disabled:opacity-60"
                        >
                          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                        </Button>

                        <div className="relative py-1">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-200" />
                          </div>
                          <div className="relative flex justify-center text-xs text-slate-500">
                            <span className="bg-white px-3">veya</span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void handleGoogleLogin()}
                          className="h-12 w-full rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
                        >
                          {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                          {googleLoading ? "Yönlendiriliyor..." : "Google ile giriş yap"}
                        </Button>

                        <p className="text-sm text-slate-500">
                          Hesabınız yok mu?{" "}
                          <button type="button" onClick={() => switchMode("register")} disabled={isBusy} className="font-bold text-slate-950 hover:text-slate-600">
                            Kayıt Ol
                          </button>
                        </p>
                      </form>
                    </AnimatedPanel>
                  )}

                  {mode === "register" && (
                    <AnimatedPanel activeKey="register">
                      <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="register-name" className="flex items-center gap-2 text-sm font-medium !text-slate-700">
                            <User className="h-4 w-4 text-slate-400" />
                            Ad Soyad
                          </Label>
                          <FancyInput icon={<User className="h-4 w-4" />} error={fieldErrors.fullName}>
                            <Input
                              id="register-name"
                              type="text"
                              name="fullName"
                              value={formData.fullName}
                              onChange={handleInputChange}
                              placeholder="Örn: Ahmet Yılmaz"
                              className="h-12 border-0 bg-transparent !text-slate-950 placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                              disabled={isBusy}
                              required
                              autoComplete="name"
                            />
                          </FancyInput>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="register-email" className="flex items-center gap-2 text-sm font-medium !text-slate-700">
                            <Mail className="h-4 w-4 text-slate-400" />
                            E-posta
                          </Label>
                          <FancyInput icon={<Mail className="h-4 w-4" />} error={fieldErrors.email}>
                            <Input
                              id="register-email"
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleInputChange}
                              placeholder="ornek@firma.com"
                              className="h-12 border-0 bg-transparent !text-slate-950 placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                              disabled={isBusy}
                              required
                              autoComplete="email"
                            />
                          </FancyInput>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="register-password" className="flex items-center gap-2 text-sm font-medium !text-slate-700">
                              <Lock className="h-4 w-4 text-slate-400" />
                              Şifre
                            </Label>
                            <FancyInput icon={<Lock className="h-4 w-4" />} error={fieldErrors.password}>
                              <Input
                                id="register-password"
                                type={showRegisterPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="••••••••"
                                className="h-12 border-0 bg-transparent !text-slate-950 placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                                disabled={isBusy}
                                required
                                autoComplete="new-password"
                              />
                            </FancyInput>
                            {fieldErrors.password ? null : <StrengthBar password={formData.password} />}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="register-password-confirm" className="flex items-center gap-2 text-sm font-medium !text-slate-700">
                              <Lock className="h-4 w-4 text-slate-400" />
                              Şifre Tekrar
                            </Label>
                            <FancyInput icon={<Lock className="h-4 w-4" />} error={fieldErrors.passwordConfirm}>
                              <Input
                                id="register-password-confirm"
                                type={showRegisterPassword ? "text" : "password"}
                                name="passwordConfirm"
                                value={formData.passwordConfirm}
                                onChange={handleInputChange}
                                placeholder="••••••••"
                                className="h-12 border-0 bg-transparent !text-slate-950 placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                                disabled={isBusy}
                                required
                                autoComplete="new-password"
                              />
                            </FancyInput>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <Checkbox
                            id="show-register-password"
                            checked={showRegisterPassword}
                            onCheckedChange={(checked) => setShowRegisterPassword(Boolean(checked))}
                            disabled={isBusy}
                          />
                          <Label htmlFor="show-register-password" className="cursor-pointer text-sm !text-slate-700">
                            Şifreyi göster
                          </Label>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                              <Label htmlFor="consentDataProcessing" className="cursor-pointer text-xs leading-5 !text-slate-700">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    setShowKvkkModal(true);
                                  }}
                                  className="font-semibold text-slate-950 underline decoration-slate-300 hover:text-slate-600"
                                >
                                  KVKK Aydınlatma Metni
                                </button>{" "}
                                ve{" "}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    setShowTermsModal(true);
                                  }}
                                  className="font-semibold text-slate-950 underline decoration-slate-300 hover:text-slate-600"
                                >
                                  Kullanıcı Sözleşmesi
                                </button>{" "}
                                metinlerini okudum, kişisel verilerimin işlenmesini onaylıyorum.
                              </Label>
                              {fieldErrors.consentDataProcessing ? <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.consentDataProcessing}</p> : null}
                            </div>
                          </div>

                          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <Checkbox
                              id="consentMarketing"
                              checked={formData.consentMarketing}
                              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, consentMarketing: Boolean(checked) }))}
                              disabled={isBusy}
                              className="mt-1"
                            />
                            <Label htmlFor="consentMarketing" className="flex-1 cursor-pointer text-xs leading-5 !text-slate-700">
                              İndirimler, yeni özellikler ve İSG sektörel güncellemeleri hakkında e-posta almayı kabul ediyorum. (Opsiyonel)
                            </Label>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          disabled={isBusy}
                          className="auth-minimal-primary h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 font-black text-white shadow-[0_20px_45px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 disabled:opacity-60"
                        >
                          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {loading ? "Kayıt ediliyor..." : "Hesabı Oluştur"}
                        </Button>

                        <p className="text-sm text-slate-500">
                          Zaten hesabınız var mı?{" "}
                          <button type="button" onClick={() => switchMode("login")} disabled={isBusy} className="font-bold text-slate-950 hover:text-slate-600">
                            Giriş Yap
                          </button>
                        </p>
                      </form>
                    </AnimatedPanel>
                  )}

                  {mode === "mfa" && (
                    <AnimatedPanel activeKey="mfa">
                      <form onSubmit={(event) => void handleVerify2FA(event)} className="space-y-6">
                        <div className="text-center">
                          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2b2b2b] shadow-sm">
                            <Shield className="h-8 w-8 text-white" />
                          </div>
                          <h2 className="text-xl font-bold text-slate-950">2FA Doğrulama</h2>
                          <p className="mt-1 text-sm text-slate-600">Authenticator uygulamanızdan 6 haneli kodu girin.</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="mfa-code" className="text-sm font-medium !text-slate-700">
                            Doğrulama Kodu
                          </Label>
                          <FancyInput icon={<Shield className="h-4 w-4" />} error={fieldErrors.mfaCode}>
                            <Input
                              id="mfa-code"
                              type="text"
                              value={mfaCode}
                              onChange={(event) => {
                                const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                                setMfaCode(value);
                                setFieldError("mfaCode", undefined);
                              }}
                              placeholder="123456"
                              className="h-12 border-0 bg-transparent text-center font-mono text-2xl tracking-widest !text-slate-950 placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                              maxLength={6}
                              autoFocus
                              disabled={isBusy}
                              inputMode="numeric"
                            />
                          </FancyInput>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <Checkbox id="trust" checked={trustDevice} onCheckedChange={(checked) => setTrustDevice(Boolean(checked))} disabled={isBusy} />
                          <Label htmlFor="trust" className="flex-1 cursor-pointer text-sm !text-slate-800">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                              Bu cihazı 30 gün güvenilir olarak işaretle
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Ortak cihazlarda işaretlemeyin.</div>
                          </Label>
                        </div>

                        <Button
                          type="submit"
                          disabled={loading || mfaCode.length !== 6}
                          className="auth-minimal-primary h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_20px_45px_rgba(37,99,235,0.25)] hover:from-blue-700 hover:to-cyan-600"
                        >
                          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {loading ? "Doğrulanıyor..." : "Doğrula ve Giriş Yap"}
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
                          className="w-full text-slate-700 hover:text-slate-950"
                          disabled={isBusy}
                        >
                          Geri Dön
                        </Button>
                      </form>
                    </AnimatedPanel>
                  )}

                  {mode === "wait" && (
                    <AnimatedPanel activeKey="wait">
                      <div className="space-y-6">
                        <div className="text-center">
                          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-600" />
                          <h2 className="text-xl font-bold text-slate-950">E-postanızı Kontrol Edin</h2>
                          <p className="mt-2 break-all text-sm text-slate-600">{verifyEmail}</p>
                        </div>

                        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <p className="text-xs text-amber-800">E-posta birkaç dakika içinde ulaşmalı. Spam/Junk klasörünü de kontrol edin.</p>
                        </div>

                        <Button
                          onClick={handleResendEmail}
                          disabled={resendCountdown > 0 || isBusy}
                          variant="outline"
                          className="w-full rounded-lg border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                        >
                          {resendCountdown > 0 ? <Clock className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          {resendCountdown > 0 ? `E-postayı yeniden gönder (${resendCountdown}s)` : "E-postayı Yeniden Gönder"}
                        </Button>

                        <Button onClick={() => switchMode("login")} variant="ghost" className="w-full text-slate-700 hover:text-slate-950" disabled={isBusy}>
                          ← Giriş Sayfasına Dön
                        </Button>
                      </div>
                    </AnimatedPanel>
                  )}
                </div>

                <p className="text-center text-xs text-slate-400">© 2026 İSGVizyon. Tüm hakları saklıdır.</p>
              </div>
            </section>
      </div>

      <Dialog open={showKvkkModal} onOpenChange={setShowKvkkModal}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto border-slate-700 bg-slate-950 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">KVKK Aydınlatma Metni</DialogTitle>
            <DialogDescription className="text-slate-400">Kişisel verilerinizin işlenmesi hakkında bilgilendirme.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-white">1. Veri Sorumlusu</h4>
            <p>İSGVizyon İSG Platformu veri sorumlusu olarak, 6698 sayılı KVKK kapsamında kişisel verilerinizi işlemektedir.</p>
            <h4 className="mt-4 font-semibold text-white">2. İşlenen Kişisel Veriler ve Amaçları</h4>
            <p>Ad, soyad, e-posta ve çalıştığınız kurum bilgileri; platform hizmetlerinin sunulması, risk değerlendirmelerinin yapılması ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir.</p>
            <h4 className="mt-4 font-semibold text-white">3. Veri Güvenliği</h4>
            <p>Verileriniz, rol tabanlı erişim kontrolü ve şifreleme yöntemleriyle yüksek güvenlik standartlarında korunmaktadır.</p>
            <h4 className="mt-4 font-semibold text-white">4. Haklarınız</h4>
            <p>KVKK Madde 11 kapsamında verilerinizin silinmesini, güncellenmesini veya dışa aktarılmasını talep etme hakkına sahipsiniz.</p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowKvkkModal(false)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              Okudum, Anladım
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto border-slate-700 bg-slate-950 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Kullanıcı Sözleşmesi</DialogTitle>
            <DialogDescription className="text-slate-400">Platformun kullanım koşulları ve hizmet şartları.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-white">1. Taraflar ve Kapsam</h4>
            <p>Bu sözleşme, İSGVizyon platformunu kullanan bireysel uzmanlar ve kurumsal OSGB'ler ile platform yönetimi arasındaki kullanım şartlarını belirler.</p>
            <h4 className="mt-4 font-semibold text-white">2. Hizmet Kullanımı</h4>
            <p>Kullanıcı, platforma girdiği verilerin doğruluğundan bizzat sorumludur. Platformdaki mevzuat içerikleri bilgilendirme amaçlıdır.</p>
            <h4 className="mt-4 font-semibold text-white">3. Fikri Mülkiyet</h4>
            <p>Uygulama içindeki AI analiz algoritmaları, risk matrisi tasarımları ve arayüz öğeleri İSGVizyon'a aittir.</p>
            <h4 className="mt-4 font-semibold text-white">4. Sözleşme Feshi</h4>
            <p>Kullanıcı dilediği zaman aboneliğini iptal edebilir ve verilerinin dışa aktarımını talep edebilir.</p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowTermsModal(false)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              Okudum, Anladım
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
