import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  LayoutDashboard,
  Loader2,
  KeyRound,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { clearPlatformAdminSession, hasPlatformAdminSession } from "@/lib/platformAdminSession";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type JobStatus = "pending" | "approved" | "rejected" | "archived";
type AdminView = "overview" | "users" | "activity" | "modules" | "pricing" | "security" | "system" | "audit" | "moderation" | "announcements";

type JobPost = {
  id: string;
  title: string;
  content: string;
  city: string | null;
  source_name: string | null;
  source_type: string;
  contact_phone: string | null;
  contact_email: string | null;
  status: JobStatus;
  created_at: string | null;
  published_at: string | null;
};

type JobComment = {
  id: string;
  job_post_id: string;
  author_name: string | null;
  comment: string;
  status: "pending" | "approved" | "rejected";
  created_at: string | null;
};

type TrendPoint = {
  label: string;
  day?: string;
  value: number;
};

type PlatformUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  is_active: boolean | null;
  is_platform_admin: boolean | null;
  created_at: string | null;
  last_login_at: string | null;
};

type ModuleMetric = {
  label: string;
  total: number;
  today: number;
};

type UserActivity = {
  id: string;
  module: string;
  action: string;
  detail: string | null;
  created_at: string | null;
};

type PlatformOverview = {
  generated_at?: string;
  users: {
    total: number;
    today_signups: number;
    today_logins: number;
    active: number;
    platform_admins: number;
  };
  jobs: {
    pending_posts: number;
    approved_posts: number;
    pending_comments: number;
  };
  modules: Record<string, ModuleMetric>;
  daily_signups: TrendPoint[];
  daily_logins: TrendPoint[];
  latest_users: PlatformUser[];
  alerts: Array<{ label: string; value: number }>;
};

type PlatformPlanPrice = {
  plan_code: string;
  code: string | null;
  plan_name: string | null;
  name: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  billing_period: string | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type PlanPriceFormState = Record<
  string,
  {
    price: string;
    currency: string;
    billing_period: string;
    is_active: boolean;
    description: string;
  }
>;

type DemoSettingsForm = {
  duration_days: string;
  title: string;
  description: string;
};

type PlatformPlanComparisonFormRow = {
  id?: string | null;
  feature_key: string;
  feature_label: string;
  free_value: string;
  premium_value: string;
  osgb_value: string;
  sort_order: number;
  is_active: boolean;
};

type PlatformAdminSecuritySettings = {
  guard_enabled: boolean;
  guard_configured: boolean;
  session_ttl_minutes: string;
  maintenance_mode: boolean;
  registration_enabled: boolean;
  job_moderation_required: boolean;
  readonly_mode: boolean;
  support_email: string;
  platform_notice: string;
  notice_enabled: boolean;
};

type PlatformAdminAuditLog = {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

const emptyOverview: PlatformOverview = {
  users: { total: 0, today_signups: 0, today_logins: 0, active: 0, platform_admins: 0 },
  jobs: { pending_posts: 0, approved_posts: 0, pending_comments: 0 },
  modules: {},
  daily_signups: [],
  daily_logins: [],
  latest_users: [],
  alerts: [],
};

const defaultSecuritySettings: PlatformAdminSecuritySettings = {
  guard_enabled: false,
  guard_configured: false,
  session_ttl_minutes: "45",
  maintenance_mode: false,
  registration_enabled: true,
  job_moderation_required: true,
  readonly_mode: false,
  support_email: "",
  platform_notice: "",
  notice_enabled: false,
};

const statusLabels: Record<JobStatus, string> = {
  pending: "Onay Bekliyor",
  approved: "Yayında",
  rejected: "Reddedildi",
  archived: "Arşiv",
};

const statusStyles: Record<JobStatus, string> = {
  pending: "border-amber-400/25 bg-amber-500/12 text-amber-200",
  approved: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200",
  rejected: "border-rose-400/25 bg-rose-500/12 text-rose-200",
  archived: "border-slate-400/20 bg-slate-500/12 text-slate-200",
};

const adminViews: Array<{
  id: AdminView;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Genel Bakış", description: "Canlı özet ve grafikler", icon: LayoutDashboard },
  { id: "users", label: "Üyeler", description: "Kayıt ve son giriş listesi", icon: Users },
  { id: "activity", label: "Üye Hareketleri", description: "Seçili kullanıcının kayıtları", icon: Activity },
  { id: "modules", label: "Modüller", description: "Ürün kullanım metrikleri", icon: BarChart3 },
  { id: "pricing", label: "Fiyatlar", description: "Paket tutarlarını yönet", icon: CreditCard },
  { id: "security", label: "Güvenlik", description: "Gizli koruma ve erişim", icon: KeyRound },
  { id: "system", label: "Sistem Ayarları", description: "Bakım, duyuru ve kayıt", icon: Settings },
  { id: "audit", label: "Denetim Kaydı", description: "Admin işlem izi", icon: ScrollText },
  { id: "moderation", label: "İlan Yönetimi", description: "Onay, ret ve yorumlar", icon: BriefcaseBusiness },
  { id: "announcements", label: "Duyuru", description: "Platform bildirimi yayınla", icon: Bell },
];

function isPlatformAdmin(profile: ReturnType<typeof useAuth>["profile"]) {
  return Boolean(profile?.is_platform_admin || profile?.role === "platform_admin" || profile?.role === "owner");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userName(user?: PlatformUser | null) {
  if (!user) return "Kullanıcı seçilmedi";
  return user.full_name || user.email || "İsimsiz kullanıcı";
}

function normalizePlanPrices(payload: unknown): PlatformPlanPrice[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => item as Partial<PlatformPlanPrice>)
    .filter((item) => Boolean(item.plan_code || item.code))
    .map((item) => ({
      plan_code: String(item.plan_code || item.code),
      code: item.code ?? null,
      plan_name: item.plan_name ?? null,
      name: item.name ?? null,
      description: item.description ?? null,
      price: typeof item.price === "number" ? item.price : Number(item.price ?? 0),
      currency: item.currency ?? "TRY",
      billing_period: item.billing_period ?? "monthly",
      is_active: item.is_active ?? true,
      updated_at: item.updated_at ?? null,
    }));
}

function normalizeDemoSettings(payload: unknown): DemoSettingsForm {
  const source = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  return {
    duration_days: String(Number(source.duration_days ?? 30) || 30),
    title: String(source.title || "OSGB Demo Üyelik"),
    description: String(source.description || "Demo süresince OSGB modülü ve platform özellikleri kullanılabilir."),
  };
}

function normalizePlanComparisonRows(payload: unknown): PlatformPlanComparisonFormRow[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const featureKey = String(row.feature_key || row.featureKey || `custom.${index + 1}`);
      return {
        id: row.id ? String(row.id) : null,
        feature_key: featureKey,
        feature_label: String(row.feature_label || row.featureLabel || featureKey),
        free_value: String(row.free_value || row.freeValue || "Yok"),
        premium_value: String(row.premium_value || row.premiumValue || "Yok"),
        osgb_value: String(row.osgb_value || row.osgbValue || "Yok"),
        sort_order: Number(row.sort_order ?? row.sortOrder ?? (index + 1) * 10),
        is_active: row.is_active !== false,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeSecuritySettings(payload: unknown): PlatformAdminSecuritySettings {
  const source = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  return {
    guard_enabled: source.guard_enabled === true,
    guard_configured: source.guard_configured === true,
    session_ttl_minutes: String(Number(source.session_ttl_minutes ?? 45) || 45),
    maintenance_mode: source.maintenance_mode === true,
    registration_enabled: source.registration_enabled !== false,
    job_moderation_required: source.job_moderation_required !== false,
    readonly_mode: source.readonly_mode === true,
    support_email: String(source.support_email || ""),
    platform_notice: String(source.platform_notice || ""),
    notice_enabled: source.notice_enabled === true,
  };
}

function normalizeAuditLogs(payload: unknown): PlatformAdminAuditLog[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: String(row.id || crypto.randomUUID()),
      admin_email: row.admin_email ? String(row.admin_email) : null,
      action: String(row.action || "admin_action"),
      target_type: row.target_type ? String(row.target_type) : null,
      target_id: row.target_id ? String(row.target_id) : null,
      metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null,
      created_at: row.created_at ? String(row.created_at) : null,
    };
  });
}

function planDisplayName(plan: PlatformPlanPrice) {
  const code = (plan.plan_code || plan.code || "").toLocaleLowerCase("tr-TR");
  if (code === "free") return "Free";
  if (code === "premium") return "Premium";
  if (code === "osgb") return "OSGB";
  return plan.name || plan.plan_name || plan.plan_code;
}

function formatMoney(value: number | null | undefined, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency || "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
}: {
  title: string;
  value: number | string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "cyan" | "emerald" | "violet" | "amber" | "rose";
}) {
  const tones = {
    cyan: "from-cyan-500/20 to-blue-500/10 text-cyan-200 border-cyan-400/20",
    emerald: "from-emerald-500/20 to-teal-500/10 text-emerald-200 border-emerald-400/20",
    violet: "from-violet-500/20 to-fuchsia-500/10 text-violet-200 border-violet-400/20",
    amber: "from-amber-500/20 to-orange-500/10 text-amber-200 border-amber-400/20",
    rose: "from-rose-500/20 to-red-500/10 text-rose-200 border-rose-400/20",
  };

  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-5", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({ title, data, color }: { title: string; data: TrendPoint[]; color: string }) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-black text-white">{title}</h3>
        <BarChart3 className="h-4 w-4 text-slate-500" />
      </div>
      <div className="flex h-40 items-end gap-2">
        {data.map((item) => (
          <div key={`${title}-${item.label}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="relative flex h-32 w-full items-end rounded-full bg-slate-950/70">
              <div
                className={cn("w-full rounded-full transition-all", color)}
                style={{ height: `${Math.max(6, (item.value / maxValue) * 100)}%` }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
            <span className="max-w-full truncate text-[10px] text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlatformAdmin() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [comments, setComments] = useState<JobComment[]>([]);
  const [overview, setOverview] = useState<PlatformOverview>(emptyOverview);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [activityBusy, setActivityBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [pricingActionId, setPricingActionId] = useState<string | null>(null);
  const [planPrices, setPlanPrices] = useState<PlatformPlanPrice[]>([]);
  const [planPriceForms, setPlanPriceForms] = useState<PlanPriceFormState>({});
  const [demoSettings, setDemoSettings] = useState<DemoSettingsForm>({
    duration_days: "30",
    title: "OSGB Demo Üyelik",
    description: "Demo süresince OSGB modülü ve platform özellikleri kullanılabilir.",
  });
  const [planComparisonRows, setPlanComparisonRows] = useState<PlatformPlanComparisonFormRow[]>([]);
  const [securitySettings, setSecuritySettings] = useState<PlatformAdminSecuritySettings>(defaultSecuritySettings);
  const [auditLogs, setAuditLogs] = useState<PlatformAdminAuditLog[]>([]);
  const [guardPhrase, setGuardPhrase] = useState("");
  const [newGuardPhrase, setNewGuardPhrase] = useState("");
  const [guardVerified, setGuardVerified] = useState(() => typeof window !== "undefined" && window.sessionStorage.getItem("isgvizyon-admin-guard-verified") === "true");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [adminSession] = useState(() => hasPlatformAdminSession());

  const canManage = isPlatformAdmin(profile) && adminSession;
  const guardRequired = securitySettings.guard_enabled && !guardVerified;

  const counts = useMemo(() => {
    return posts.reduce(
      (acc, post) => {
        acc[post.status] += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0, archived: 0 } as Record<JobStatus, number>,
    );
  }, [posts]);

  const moduleMetrics = useMemo(() => {
    return Object.entries(overview.modules || {})
      .map(([key, metric]) => ({ key, ...metric }))
      .sort((a, b) => b.total - a.total);
  }, [overview.modules]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return overview.latest_users;
    return overview.latest_users.filter((member) => {
      return [member.full_name, member.email, member.role, member.subscription_plan]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(query));
    });
  }, [overview.latest_users, userSearch]);

  const loadUserActivity = async (member: PlatformUser) => {
    setSelectedUser(member);
    setActiveView("activity");
    setActivityBusy(true);

    try {
      const { data, error } = await (supabase as any).rpc("get_platform_admin_user_activity", {
        p_user_id: member.id,
      });

      if (error) throw error;
      setUserActivities(((data as { activities?: UserActivity[] } | null)?.activities || []) as UserActivity[]);
    } catch (error) {
      console.error("Platform user activity could not be loaded:", error);
      setUserActivities([]);
      toast.error("Üye hareketleri yüklenemedi.");
    } finally {
      setActivityBusy(false);
    }
  };

  const loadSecurityData = async () => {
    if (!canManage) return defaultSecuritySettings;

    try {
      const { data, error } = await (supabase as any).rpc("get_platform_admin_security_state");
      if (error) throw error;

      const payload = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      const nextSettings = normalizeSecuritySettings(payload.settings);
      setSecuritySettings(nextSettings);
      setAuditLogs(normalizeAuditLogs(payload.auditLogs));
      return nextSettings;
    } catch (error) {
      console.error("Platform admin security state could not be loaded:", error);
      toast.error("Admin güvenlik ayarları yüklenemedi.");
      return defaultSecuritySettings;
    }
  };

  const loadPricingData = async () => {
    if (!canManage || guardRequired) return;
    setPricingBusy(true);

    try {
      const [{ data, error }, { data: configData, error: configError }] = await Promise.all([
        (supabase as any).rpc("get_platform_admin_plan_prices"),
        (supabase as any).rpc("get_platform_admin_plan_configuration"),
      ]);
      if (error) throw error;

      const rows = normalizePlanPrices(data);
      setPlanPrices(rows);
      setPlanPriceForms(
        rows.reduce<PlanPriceFormState>((acc, plan) => {
          const code = plan.plan_code || plan.code || "";
          acc[code] = {
            price: String(plan.price ?? 0),
            currency: plan.currency || "TRY",
            billing_period: plan.billing_period || "monthly",
            is_active: plan.is_active !== false,
            description: plan.description || "",
          };
          return acc;
        }, {}),
      );

      if (!configError) {
        const config = (configData && typeof configData === "object" ? configData : {}) as Record<string, unknown>;
        setDemoSettings(normalizeDemoSettings(config.demo));
        setPlanComparisonRows(normalizePlanComparisonRows(config.comparisonRows));
      } else {
        console.warn("Platform plan configuration could not be loaded:", configError);
      }
    } catch (error) {
      console.error("Platform plan prices could not be loaded:", error);
      toast.error("Paket fiyatları yüklenemedi.");
    } finally {
      setPricingBusy(false);
    }
  };

  const loadPlatformData = async () => {
    if (!canManage) return;
    setBusy(true);

    try {
      const security = await loadSecurityData();
      if (security.guard_enabled && !guardVerified) {
        setBusy(false);
        return;
      }

      const [{ data: overviewData, error: overviewError }, { data: postsData, error: postsError }, { data: commentsData, error: commentsError }] = await Promise.all([
        (supabase as any).rpc("get_platform_admin_overview"),
        (supabase as any)
          .from("isg_job_posts")
          .select("id,title,content,city,source_name,source_type,contact_phone,contact_email,status,created_at,published_at")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("isg_job_comments")
          .select("id,job_post_id,author_name,comment,status,created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (overviewError) throw overviewError;
      if (postsError) throw postsError;
      if (commentsError) throw commentsError;

      const nextOverview = (overviewData || emptyOverview) as PlatformOverview;
      setOverview(nextOverview);
      setPosts((postsData || []) as JobPost[]);
      setComments((commentsData || []) as JobComment[]);
      setSelectedUser((current) => current || nextOverview.latest_users[0] || null);
      await loadPricingData();
    } catch (error) {
      console.error("Platform admin data could not be loaded:", error);
      toast.error("Platform yönetim verileri yüklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadPlatformData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  useEffect(() => {
    if (activeView === "activity" && selectedUser && userActivities.length === 0 && !activityBusy) {
      void loadUserActivity(selectedUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedUser?.id]);

  const handleAdminExit = async () => {
    clearPlatformAdminSession();
    await signOut();
    navigate("/admin-login", { replace: true });
  };

  const updatePostStatus = async (postId: string, status: JobStatus) => {
    setActionId(postId);

    try {
      const patch = {
        status,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        published_at: status === "approved" ? new Date().toISOString() : null,
      };

      const { error } = await (supabase as any).from("isg_job_posts").update(patch).eq("id", postId);
      if (error) throw error;

      toast.success(status === "approved" ? "İlan yayına alındı." : status === "rejected" ? "İlan reddedildi." : "İlan arşive alındı.");
      await loadPlatformData();
    } catch (error) {
      console.error("Job post status update failed:", error);
      toast.error("İlan durumu güncellenemedi.");
    } finally {
      setActionId(null);
    }
  };

  const updateCommentStatus = async (commentId: string, status: "approved" | "rejected") => {
    setActionId(commentId);

    try {
      const { error } = await (supabase as any)
        .from("isg_job_comments")
        .update({
          status,
          approved_at: status === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", commentId);

      if (error) throw error;

      toast.success(status === "approved" ? "Yorum onaylandı." : "Yorum reddedildi.");
      await loadPlatformData();
    } catch (error) {
      console.error("Comment status update failed:", error);
      toast.error("Yorum durumu güncellenemedi.");
    } finally {
      setActionId(null);
    }
  };

  const publishAnnouncement = async () => {
    const title = announcementTitle.trim();
    const message = announcementMessage.trim();

    if (!title || !message) {
      toast.error("Duyuru başlığı ve metni gerekli.");
      return;
    }

    setActionId("announcement");

    try {
      const { error } = await (supabase as any).from("isg_job_announcements").insert({
        title,
        message,
        type: "info",
        is_active: true,
        published_at: new Date().toISOString(),
      });

      if (error) throw error;

      setAnnouncementTitle("");
      setAnnouncementMessage("");
      toast.success("Duyuru yayınlandı.");
    } catch (error) {
      console.error("Announcement publish failed:", error);
      toast.error("Duyuru yayınlanamadı.");
    } finally {
      setActionId(null);
    }
  };

  const updatePlanPriceForm = (planCode: string, patch: Partial<PlanPriceFormState[string]>) => {
    setPlanPriceForms((current) => ({
      ...current,
      [planCode]: {
        price: current[planCode]?.price ?? "0",
        currency: current[planCode]?.currency ?? "TRY",
        billing_period: current[planCode]?.billing_period ?? "monthly",
        is_active: current[planCode]?.is_active ?? true,
        description: current[planCode]?.description ?? "",
        ...patch,
      },
    }));
  };

  const savePlanPrice = async (planCode: string) => {
    const form = planPriceForms[planCode];
    const price = Number(String(form?.price || "0").replace(",", "."));

    if (!Number.isFinite(price) || price < 0) {
      toast.error("Geçerli bir fiyat girin.");
      return;
    }

    setPricingActionId(planCode);

    try {
      const { error } = await (supabase as any).rpc("update_platform_admin_plan_price", {
        p_plan_code: planCode,
        p_price: price,
        p_currency: form?.currency || "TRY",
        p_billing_period: form?.billing_period || "monthly",
        p_is_active: form?.is_active ?? true,
        p_description: form?.description || null,
      });

      if (error) throw error;

      toast.success(`${planCode.toUpperCase()} fiyatı güncellendi.`);
      await loadPricingData();
    } catch (error) {
      console.error("Platform plan price update failed:", error);
      toast.error("Paket fiyatı güncellenemedi.");
    } finally {
      setPricingActionId(null);
    }
  };

  const updatePlanComparisonRow = (index: number, patch: Partial<PlatformPlanComparisonFormRow>) => {
    setPlanComparisonRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const addPlanComparisonRow = () => {
    const lastRow = planComparisonRows[planComparisonRows.length - 1];
    const nextOrder = (lastRow?.sort_order ?? planComparisonRows.length * 10) + 10;
    setPlanComparisonRows((current) => [
      ...current,
      {
        feature_key: `custom.${Date.now()}`,
        feature_label: "Yeni özellik",
        free_value: "Yok",
        premium_value: "Yok",
        osgb_value: "Var",
        sort_order: nextOrder,
        is_active: true,
      },
    ]);
  };

  const saveDemoSettings = async () => {
    const durationDays = Number(demoSettings.duration_days);

    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
      toast.error("Demo süresi 1 ile 365 gün arasında olmalıdır.");
      return;
    }

    setPricingActionId("demo-settings");

    try {
      const { data, error } = await (supabase as any).rpc("update_platform_admin_demo_settings", {
        p_duration_days: durationDays,
        p_title: demoSettings.title,
        p_description: demoSettings.description,
      });

      if (error) throw error;

      setDemoSettings(normalizeDemoSettings(data));
      toast.success("Demo plan ayarları güncellendi.");
    } catch (error) {
      console.error("Demo settings update failed:", error);
      toast.error("Demo plan ayarları güncellenemedi.");
    } finally {
      setPricingActionId(null);
    }
  };

  const savePlanComparisonRows = async () => {
    const normalizedRows = planComparisonRows.map((row, index) => ({
      ...row,
      feature_key: row.feature_key.trim() || `custom.${index + 1}`,
      feature_label: row.feature_label.trim() || "Yeni özellik",
      free_value: row.free_value.trim() || "Yok",
      premium_value: row.premium_value.trim() || "Yok",
      osgb_value: row.osgb_value.trim() || "Yok",
      sort_order: (index + 1) * 10,
    }));

    setPricingActionId("comparison-rows");

    try {
      const { data, error } = await (supabase as any).rpc("upsert_platform_admin_plan_comparison_rows", {
        p_rows: normalizedRows,
      });

      if (error) throw error;

      setPlanComparisonRows(normalizePlanComparisonRows(data));
      toast.success("Plan karşılaştırma tablosu güncellendi.");
    } catch (error) {
      console.error("Plan comparison update failed:", error);
      toast.error("Plan karşılaştırma tablosu güncellenemedi.");
    } finally {
      setPricingActionId(null);
    }
  };

  const verifyAdminGuard = async () => {
    if (!guardPhrase.trim()) {
      toast.error("Gizli yönetim anahtarını yazın.");
      return;
    }

    setActionId("verify-admin-guard");

    try {
      const { data, error } = await (supabase as any).rpc("verify_platform_admin_guard", {
        p_guard_phrase: guardPhrase,
      });

      if (error) throw error;

      const verified = Boolean((data as { verified?: boolean } | null)?.verified);
      if (!verified) {
        toast.error("Gizli yönetim anahtarı doğrulanamadı.");
        return;
      }

      setGuardPhrase("");
      setGuardVerified(true);
      window.sessionStorage.setItem("isgvizyon-admin-guard-verified", "true");
      toast.success("Gizli koruma doğrulandı.");
      await loadPlatformData();
    } catch (error) {
      console.error("Admin guard verification failed:", error);
      toast.error("Gizli yönetim anahtarı doğrulanamadı.");
    } finally {
      setActionId(null);
    }
  };

  const saveSecuritySettings = async () => {
    const ttl = Number(securitySettings.session_ttl_minutes);
    if (!Number.isFinite(ttl) || ttl < 10 || ttl > 480) {
      toast.error("Oturum süresi 10 ile 480 dakika arasında olmalıdır.");
      return;
    }

    if (securitySettings.guard_enabled && !securitySettings.guard_configured && !newGuardPhrase.trim()) {
      toast.error("Gizli korumayı etkinleştirmek için önce anahtar belirleyin.");
      return;
    }

    setActionId("save-security-settings");

    try {
      const { data, error } = await (supabase as any).rpc("update_platform_admin_security_settings", {
        p_settings: {
          ...securitySettings,
          session_ttl_minutes: ttl,
        },
        p_new_guard_phrase: newGuardPhrase.trim() || null,
      });

      if (error) throw error;

      setSecuritySettings(normalizeSecuritySettings(data));
      setNewGuardPhrase("");
      if (!securitySettings.guard_enabled) {
        setGuardVerified(false);
        window.sessionStorage.removeItem("isgvizyon-admin-guard-verified");
      }
      toast.success("Admin güvenlik ve sistem ayarları kaydedildi.");
      await loadSecurityData();
    } catch (error) {
      console.error("Admin security settings update failed:", error);
      toast.error("Admin ayarları kaydedilemedi.");
    } finally {
      setActionId(null);
    }
  };

  const renderPosts = (status: JobStatus) => {
    const filtered = posts.filter((post) => post.status === status);

    if (!filtered.length) {
      return <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-6 text-sm text-slate-400">Bu durumda ilan bulunmuyor.</div>;
    }

    return (
      <div className="space-y-4">
        {filtered.map((post) => (
          <article key={post.id} className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5 shadow-xl shadow-black/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-white">{post.title}</h3>
                  <Badge className={cn("border", statusStyles[post.status])}>{statusLabels[post.status]}</Badge>
                  <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">{post.city || "Tüm Türkiye"}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {post.source_name || "İSGVizyon"} • {formatDate(post.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => updatePostStatus(post.id, "approved")} disabled={actionId === post.id} className="bg-emerald-600 hover:bg-emerald-500">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Yayına Al
                </Button>
                <Button size="sm" variant="outline" onClick={() => updatePostStatus(post.id, "rejected")} disabled={actionId === post.id} className="border-rose-400/30 bg-rose-950/20 text-rose-100 hover:bg-rose-900/30">
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Reddet
                </Button>
                <Button size="sm" variant="outline" onClick={() => updatePostStatus(post.id, "archived")} disabled={actionId === post.id} className="border-slate-600 bg-slate-900/50 text-slate-200 hover:bg-slate-800">
                  <Archive className="mr-1.5 h-4 w-4" />
                  Arşivle
                </Button>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{post.content}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
              {post.contact_phone ? <span>Telefon: {post.contact_phone}</span> : null}
              {post.contact_email ? <span>E-posta: {post.contact_email}</span> : null}
            </div>
          </article>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08111f] text-slate-300">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Platform yetkisi kontrol ediliyor...
      </div>
    );
  }

  if (!canManage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08111f] px-6 text-slate-100">
        <div className="w-full max-w-xl rounded-3xl border border-rose-400/30 bg-rose-950/25 p-7 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-3 text-xl font-black text-rose-100">
            <AlertTriangle className="h-6 w-6" />
            Platform yönetim girişi reddedildi
          </div>
          <p className="mt-4 text-sm leading-7 text-rose-100/80">
            Bu ekran yalnızca `/admin-login` üzerinden giriş yapan ve platform yönetim yetkisi bulunan hesaplar tarafından kullanılabilir.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => navigate("/admin-login", { replace: true })} className="bg-rose-600 hover:bg-rose-500">
              Admin girişine git
            </Button>
            <Button variant="outline" onClick={() => navigate("/auth", { replace: true })} className="border-slate-600 bg-slate-900/70 text-slate-100 hover:bg-slate-800">
              Normal giriş ekranı
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-80 shrink-0 border-r border-slate-800 bg-[#0b1424] p-5 xl:block">
          <div className="rounded-3xl border border-violet-400/20 bg-violet-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-100">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">Platform Sahibi</p>
                <h1 className="text-lg font-black text-white">Yönetim Konsolu</h1>
              </div>
            </div>
          </div>

          <nav className="mt-5 space-y-2">
            {adminViews.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    active ? "border-cyan-400/30 bg-cyan-500/12 text-white" : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white",
                  )}
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-cyan-400/15 text-cyan-200" : "bg-slate-900 text-slate-500 group-hover:text-cyan-200")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{item.label}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.description}</p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4", active ? "text-cyan-200" : "text-slate-600")} />
                </button>
              );
            })}
          </nav>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Hızlı üye erişimi</p>
            <div className="mt-3 space-y-2">
              {overview.latest_users.slice(0, 5).map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => void loadUserActivity(member)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-900/70 px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <span className="min-w-0 truncate">{userName(member)}</span>
                  <Eye className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-5 py-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <section className="rounded-[30px] border border-slate-700/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),linear-gradient(135deg,#101827,#1d1740_58%,#101827)] p-6 shadow-2xl shadow-black/30">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-100 ring-1 ring-violet-300/20">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">Platform Sahibi Konsolu</p>
                    <h1 className="text-3xl font-black text-white">Platform Yönetimi</h1>
                    <p className="mt-1 text-sm text-slate-300">Üyeler, hareketler, modül kullanımı, ilanlar ve sistem işleyişi tek ekranda.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void loadPlatformData()} disabled={busy} className="bg-slate-800 text-slate-100 hover:bg-slate-700">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Yenile
                  </Button>
                  <Button variant="outline" onClick={() => void handleAdminExit()} className="border-slate-600 bg-slate-950/50 text-slate-100 hover:bg-slate-900">
                    Admin çıkışı
                  </Button>
                </div>
              </div>
            </section>

            {guardRequired ? (
              <section className="rounded-[28px] border border-amber-400/30 bg-amber-500/10 p-6 shadow-2xl shadow-black/20">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200 ring-1 ring-amber-300/20">
                      <KeyRound className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Gizli Koruma Aktif</p>
                      <h2 className="mt-1 text-2xl font-black text-white">Platform yönetimi için ek anahtar gerekli</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/80">
                        Bu panelde üyeler, fiyatlar, sistem ayarları ve operasyon kayıtları yönetildiği için ikinci bir koruma katmanı etkinleştirilmiş.
                      </p>
                    </div>
                  </div>
                  <div className="w-full max-w-md rounded-2xl border border-amber-300/20 bg-slate-950/60 p-4">
                    <Label className="text-amber-50">Gizli yönetim anahtarı</Label>
                    <Input
                      type="password"
                      value={guardPhrase}
                      onChange={(event) => setGuardPhrase(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void verifyAdminGuard();
                      }}
                      className="mt-2 border-amber-300/25 bg-slate-950 text-white"
                      placeholder="Anahtarı girin"
                    />
                    <Button onClick={() => void verifyAdminGuard()} disabled={actionId === "verify-admin-guard"} className="mt-3 w-full bg-amber-500 font-black text-slate-950 hover:bg-amber-400">
                      {actionId === "verify-admin-guard" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      Paneli Aç
                    </Button>
                  </div>
                </div>
              </section>
            ) : (
              <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard title="Toplam Üye" value={overview.users.total} detail={`${overview.users.today_signups} bugün yeni üye`} icon={Users} tone="cyan" />
              <StatCard title="Bugün Giriş" value={overview.users.today_logins} detail="Günlük aktif kullanıcı sinyali" icon={UserCheck} tone="emerald" />
              <StatCard title="DÖF Kayıtları" value={overview.modules.bulk_capa_entries?.total || 0} detail={`${overview.modules.bulk_capa_entries?.today || 0} bugün oluşturuldu`} icon={Activity} tone="violet" />
              <StatCard title="Bekleyen İlan" value={overview.jobs.pending_posts} detail={`${overview.jobs.pending_comments} yorum onay bekliyor`} icon={BriefcaseBusiness} tone="amber" />
              <StatCard title="Risk / Sorun" value={overview.alerts.reduce((sum, item) => sum + item.value, 0)} detail="Anlık müdahale bekleyen kayıtlar" icon={AlertTriangle} tone="rose" />
            </div>

            <div className="xl:hidden">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 p-2 md:grid-cols-3">
                {adminViews.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveView(item.id)}
                    className={cn("justify-start text-slate-300 hover:bg-slate-800 hover:text-white", activeView === item.id && "bg-cyan-500 text-slate-950 hover:bg-cyan-400 hover:text-slate-950")}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {activeView === "overview" && (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <MiniBarChart title="Son 14 Gün Üyelik" data={overview.daily_signups} color="bg-cyan-400" />
                  <MiniBarChart title="Son 14 Gün Giriş" data={overview.daily_logins} color="bg-emerald-400" />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {overview.alerts.map((alert) => (
                    <div key={alert.label} className="rounded-2xl border border-amber-400/20 bg-amber-950/20 p-5">
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-300">{alert.label}</p>
                      <p className="mt-3 text-3xl font-black text-white">{alert.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeView === "users" && (
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/55">
                  <div className="flex flex-col gap-3 border-b border-slate-700/70 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-white">Üye Listesi</h2>
                      <p className="text-sm text-slate-500">Yeni kayıtlar en üstte görünür. Tek tuşla hareket dökümüne geçebilirsiniz.</p>
                    </div>
                    <div className="relative w-full lg:w-80">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Üye ara..." className="border-slate-700 bg-slate-950/70 pl-9 text-white" />
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {filteredUsers.map((member) => (
                      <div key={member.id} className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.5fr_0.8fr_0.8fr_1fr_auto] lg:items-center">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">{userName(member)}</p>
                          <p className="truncate text-xs text-slate-500">{member.email || "-"}</p>
                        </div>
                        <span className="text-slate-300">{member.subscription_plan || "free"}</span>
                        <span className="text-slate-300">{member.is_platform_admin ? "Platform Admin" : member.role || "-"}</span>
                        <span className="text-slate-400">{formatDate(member.created_at)}</span>
                        <Button size="sm" onClick={() => void loadUserActivity(member)} className="bg-cyan-600 hover:bg-cyan-500">
                          <Eye className="mr-1.5 h-4 w-4" />
                          Hareketler
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                  <h3 className="text-sm font-black text-white">Son Üye Özeti</h3>
                  <div className="mt-4 space-y-3">
                    {overview.latest_users.slice(0, 6).map((member) => (
                      <button key={member.id} type="button" onClick={() => void loadUserActivity(member)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left hover:border-cyan-400/40">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{userName(member)}</p>
                          <p className="text-xs text-slate-500">{formatDate(member.created_at)}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeView === "activity" && (
              <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                  <h2 className="text-lg font-black text-white">Üye Seç</h2>
                  <p className="mt-1 text-sm text-slate-500">Bir üyeye tıklayın, sağda hareketleri açılsın.</p>
                  <div className="relative mt-4">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Üye ara..." className="border-slate-700 bg-slate-950/70 pl-9 text-white" />
                  </div>
                  <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                    {filteredUsers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => void loadUserActivity(member)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition",
                          selectedUser?.id === member.id ? "border-cyan-400/40 bg-cyan-500/10" : "border-slate-800 bg-slate-950/45 hover:border-slate-600",
                        )}
                      >
                        <p className="truncate text-sm font-bold text-white">{userName(member)}</p>
                        <p className="truncate text-xs text-slate-500">{member.email || "-"}</p>
                        <p className="mt-2 text-[11px] text-slate-500">Kayıt: {formatDate(member.created_at)}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55">
                  <div className="flex flex-col gap-3 border-b border-slate-700/70 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Üye Hareketleri</p>
                      <h2 className="mt-1 text-2xl font-black text-white">{userName(selectedUser)}</h2>
                      <p className="mt-1 text-sm text-slate-500">{selectedUser?.email || "Listeden bir üye seçin."}</p>
                    </div>
                    {selectedUser ? (
                      <Button onClick={() => void loadUserActivity(selectedUser)} disabled={activityBusy} className="bg-cyan-600 hover:bg-cyan-500">
                        {activityBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Hareketleri Yenile
                      </Button>
                    ) : null}
                  </div>
                  <div className="p-5">
                    {activityBusy ? (
                      <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/40 p-10 text-slate-400">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Hareketler yükleniyor...
                      </div>
                    ) : userActivities.length ? (
                      <div className="relative space-y-3 before:absolute before:left-5 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-slate-700">
                        {userActivities.map((activity) => (
                          <div key={`${activity.module}-${activity.id}-${activity.created_at}`} className="relative flex gap-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                            <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200 ring-4 ring-slate-950">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">{activity.module}</Badge>
                                <span className="text-xs text-slate-500">{formatDate(activity.created_at)}</span>
                              </div>
                              <p className="mt-2 font-bold text-white">{activity.action}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-400">{activity.detail || "Detay bilgisi yok."}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-10 text-center">
                        <Sparkles className="mx-auto h-8 w-8 text-slate-600" />
                        <p className="mt-3 font-bold text-white">Hareket bulunamadı</p>
                        <p className="mt-1 text-sm text-slate-500">Bu üye için henüz modül kaydı yakalanmadı ya da kayıtlar kullanıcı ile eşleşmiyor.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeView === "modules" && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {moduleMetrics.map((metric) => (
                  <div key={metric.key} className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{metric.label}</p>
                        <p className="mt-1 text-xs text-slate-500">Bugün: {metric.today}</p>
                      </div>
                      <TrendingUp className="h-5 w-5 text-cyan-300" />
                    </div>
                    <p className="mt-5 text-3xl font-black text-white">{metric.total}</p>
                    <div className="mt-4 h-2 rounded-full bg-slate-950">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${Math.min(100, Math.max(8, metric.today ? 35 : metric.total ? 18 : 8))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeView === "pricing" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Paket Fiyatları</p>
                      <h2 className="mt-1 text-2xl font-black text-white">Kullanıcıya Gösterilen Fiyatları Yönet</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                        Bu alan `subscription_plans` katalog fiyatlarını günceller. Ayarlar ve fiyatlandırma ekranları aynı katalogdan beslendiği için değişiklikler kullanıcı tarafına yansır.
                      </p>
                    </div>
                    <Button onClick={() => void loadPricingData()} disabled={pricingBusy} className="bg-cyan-600 hover:bg-cyan-500">
                      {pricingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Fiyatları Yenile
                    </Button>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-3">
                  {planPrices.map((plan) => {
                    const planCode = plan.plan_code || plan.code || "";
                    const form = planPriceForms[planCode];
                    const numericPrice = Number(String(form?.price || plan.price || 0).replace(",", "."));
                    const annualEstimate = planCode === "premium" ? numericPrice * 10 : null;

                    return (
                      <article key={planCode} className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5 shadow-xl shadow-black/10">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Badge className="border border-violet-400/25 bg-violet-500/12 text-violet-100">{planCode.toUpperCase()}</Badge>
                            <h3 className="mt-3 text-2xl font-black text-white">{planDisplayName(plan)}</h3>
                            <p className="mt-1 text-sm text-slate-400">Güncel fiyat: {formatMoney(plan.price, plan.currency || "TRY")}</p>
                          </div>
                          <div className={cn("rounded-full px-3 py-1 text-xs font-black", form?.is_active !== false ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-700 text-slate-300")}>
                            {form?.is_active !== false ? "Aktif" : "Pasif"}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-300">Fiyat</Label>
                            <Input
                              value={form?.price ?? ""}
                              onChange={(event) => updatePlanPriceForm(planCode, { price: event.target.value })}
                              inputMode="decimal"
                              className="border-slate-700 bg-slate-950/70 text-white"
                              placeholder="Örn: 150"
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-slate-300">Para Birimi</Label>
                              <Input
                                value={form?.currency ?? "TRY"}
                                onChange={(event) => updatePlanPriceForm(planCode, { currency: event.target.value.toUpperCase() })}
                                className="border-slate-700 bg-slate-950/70 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">Periyot</Label>
                              <select
                                value={form?.billing_period ?? "monthly"}
                                onChange={(event) => updatePlanPriceForm(planCode, { billing_period: event.target.value })}
                                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-cyan-400"
                              >
                                <option value="monthly">Aylık</option>
                                <option value="yearly">Yıllık</option>
                                <option value="custom">Özel</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-300">Açıklama</Label>
                            <Textarea
                              value={form?.description ?? ""}
                              onChange={(event) => updatePlanPriceForm(planCode, { description: event.target.value })}
                              className="min-h-24 border-slate-700 bg-slate-950/70 text-white"
                              placeholder="Plan açıklaması..."
                            />
                          </div>

                          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
                            <span>Katalogda aktif göster</span>
                            <input
                              type="checkbox"
                              checked={form?.is_active !== false}
                              onChange={(event) => updatePlanPriceForm(planCode, { is_active: event.target.checked })}
                              className="h-4 w-4 accent-cyan-500"
                            />
                          </label>

                          {annualEstimate !== null ? (
                            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                              Ayarlar ekranındaki yıllık Premium kartı şu an aylık fiyatın 10 katı olarak hesaplanır: <strong>{formatMoney(annualEstimate, form?.currency || "TRY")}</strong>.
                            </div>
                          ) : null}

                          <Button onClick={() => void savePlanPrice(planCode)} disabled={pricingActionId === planCode} className="bg-emerald-600 hover:bg-emerald-500">
                            {pricingActionId === planCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Kaydet
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
                  <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Demo Planı</p>
                        <h3 className="mt-1 text-xl font-black text-white">Demo Süresi ve Metni</h3>
                        <p className="mt-1 text-sm leading-6 text-amber-100/80">
                          Kullanıcı demo başlattığında bitiş tarihi bu gün sayısına göre hesaplanır.
                        </p>
                      </div>
                      <Clock className="h-5 w-5 text-amber-200" />
                    </div>

                    <div className="mt-5 grid gap-4">
                      <div className="space-y-2">
                        <Label className="text-amber-50">Demo süresi (gün)</Label>
                        <Input
                          value={demoSettings.duration_days}
                          onChange={(event) => setDemoSettings((current) => ({ ...current, duration_days: event.target.value }))}
                          inputMode="numeric"
                          className="border-amber-300/25 bg-slate-950/70 text-white"
                          placeholder="Örn: 30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-amber-50">Demo başlığı</Label>
                        <Input
                          value={demoSettings.title}
                          onChange={(event) => setDemoSettings((current) => ({ ...current, title: event.target.value }))}
                          className="border-amber-300/25 bg-slate-950/70 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-amber-50">Açıklama</Label>
                        <Textarea
                          value={demoSettings.description}
                          onChange={(event) => setDemoSettings((current) => ({ ...current, description: event.target.value }))}
                          className="min-h-24 border-amber-300/25 bg-slate-950/70 text-white"
                        />
                      </div>
                      <Button onClick={() => void saveDemoSettings()} disabled={pricingActionId === "demo-settings"} className="bg-amber-500 font-black text-slate-950 hover:bg-amber-400">
                        {pricingActionId === "demo-settings" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Demo Ayarlarını Kaydet
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Plan Karşılaştırması</p>
                        <h3 className="mt-1 text-xl font-black text-white">Limit ve Özellik Tablosu</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          Bu satırlar fiyatlandırma sayfasındaki plan karşılaştırma tablosunu besler.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={addPlanComparisonRow} className="bg-cyan-600 hover:bg-cyan-500">
                          <Plus className="mr-2 h-4 w-4" />
                          Satır Ekle
                        </Button>
                        <Button type="button" onClick={() => void savePlanComparisonRows()} disabled={pricingActionId === "comparison-rows"} className="bg-emerald-600 hover:bg-emerald-500">
                          {pricingActionId === "comparison-rows" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Tabloyu Kaydet
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 max-h-[620px] overflow-auto rounded-2xl border border-slate-800">
                      <div className="grid min-w-[940px] grid-cols-[1.45fr_1fr_1fr_1fr_110px] gap-0 border-b border-slate-800 bg-slate-950/80 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                        <div>Özellik</div>
                        <div>Ücretsiz</div>
                        <div>Premium</div>
                        <div>OSGB</div>
                        <div>Durum</div>
                      </div>
                      <div className="min-w-[940px] divide-y divide-slate-800">
                        {planComparisonRows.map((row, index) => (
                          <div key={row.feature_key} className="grid grid-cols-[1.45fr_1fr_1fr_1fr_110px] gap-3 bg-slate-950/35 p-3">
                            <Input
                              value={row.feature_label}
                              onChange={(event) => updatePlanComparisonRow(index, { feature_label: event.target.value })}
                              className="border-slate-700 bg-slate-950/70 text-white"
                            />
                            <Input
                              value={row.free_value}
                              onChange={(event) => updatePlanComparisonRow(index, { free_value: event.target.value })}
                              className="border-slate-700 bg-slate-950/70 text-white"
                            />
                            <Input
                              value={row.premium_value}
                              onChange={(event) => updatePlanComparisonRow(index, { premium_value: event.target.value })}
                              className="border-slate-700 bg-slate-950/70 text-white"
                            />
                            <Input
                              value={row.osgb_value}
                              onChange={(event) => updatePlanComparisonRow(index, { osgb_value: event.target.value })}
                              className="border-slate-700 bg-slate-950/70 text-white"
                            />
                            <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-xs font-bold text-slate-200">
                              <input
                                type="checkbox"
                                checked={row.is_active}
                                onChange={(event) => updatePlanComparisonRow(index, { is_active: event.target.checked })}
                                className="h-4 w-4 accent-emerald-500"
                              />
                              Aktif
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>

                {!pricingBusy && planPrices.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                    Paket fiyatı bulunamadı. Supabase migration çalıştırıldıktan sonra bu alan Free, Premium ve OSGB kayıtlarını gösterecek.
                  </div>
                ) : null}
              </div>
            )}

            {activeView === "security" && (
              <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
                <section className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Gizli Koruma</p>
                      <h2 className="mt-1 text-2xl font-black text-white">Platform Admin Erişimini Sertleştir</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                        Admin paneli zaten platform yetkisi ister. Bu alan, ikinci kapı olarak gizli anahtar ve oturum kurallarını yönetir.
                      </p>
                    </div>
                    <KeyRound className="h-6 w-6 text-amber-200" />
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/45 p-4">
                      <div>
                        <p className="font-black text-white">Gizli yönetim anahtarı</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Açık olduğunda panel içeriği ek anahtar doğrulanmadan yüklenmez.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={securitySettings.guard_enabled}
                        onChange={(event) => setSecuritySettings((current) => ({ ...current, guard_enabled: event.target.checked }))}
                        className="h-5 w-5 accent-amber-500"
                      />
                    </label>

                    <div className="rounded-2xl border border-slate-700 bg-slate-950/45 p-4">
                      <Label className="text-slate-300">Yeni gizli anahtar</Label>
                      <Input
                        type="password"
                        value={newGuardPhrase}
                        onChange={(event) => setNewGuardPhrase(event.target.value)}
                        className="mt-2 border-slate-700 bg-slate-950/70 text-white"
                        placeholder={securitySettings.guard_configured ? "Değiştirmeyecekseniz boş bırakın" : "İlk anahtarı belirleyin"}
                      />
                      <p className="mt-2 text-xs text-slate-500">{securitySettings.guard_configured ? "Anahtar sunucuda hash olarak tutuluyor." : "Henüz gizli anahtar tanımlı değil."}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-950/45 p-4">
                      <Label className="text-slate-300">Admin oturum süresi (dk)</Label>
                      <Input
                        value={securitySettings.session_ttl_minutes}
                        onChange={(event) => setSecuritySettings((current) => ({ ...current, session_ttl_minutes: event.target.value }))}
                        inputMode="numeric"
                        className="mt-2 border-slate-700 bg-slate-950/70 text-white"
                        placeholder="45"
                      />
                      <p className="mt-2 text-xs text-slate-500">Sunucu ayarı 10-480 dakika aralığında saklanır.</p>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <p className="font-black text-emerald-100">Yetki kapısı</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-100/75">
                        Admin ekranına erişim için `profiles.is_platform_admin = true` ve `/admin-login` oturumu birlikte gerekir. Normal kullanıcı girişi bu panele geçemez.
                      </p>
                    </div>
                  </div>

                  <Button onClick={() => void saveSecuritySettings()} disabled={actionId === "save-security-settings"} className="mt-6 bg-amber-500 font-black text-slate-950 hover:bg-amber-400">
                    {actionId === "save-security-settings" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Güvenliği Kaydet
                  </Button>
                </section>

                <aside className="space-y-4">
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Koruma Durumu</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2 text-sm">
                        <span className="text-slate-400">Gizli koruma</span>
                        <Badge className={securitySettings.guard_enabled ? "bg-amber-500/15 text-amber-200" : "bg-slate-700 text-slate-200"}>{securitySettings.guard_enabled ? "Açık" : "Kapalı"}</Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2 text-sm">
                        <span className="text-slate-400">Anahtar</span>
                        <Badge className={securitySettings.guard_configured ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}>{securitySettings.guard_configured ? "Tanımlı" : "Eksik"}</Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2 text-sm">
                        <span className="text-slate-400">Platform admin</span>
                        <Badge className="bg-cyan-500/15 text-cyan-200">{overview.users.platform_admins}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5">
                    <p className="font-black text-rose-100">Güvenlik notu</p>
                    <p className="mt-2 text-sm leading-6 text-rose-100/75">
                      Platform sahibi yetkisi doğrudan SQL ile rastgele verilmemeli. Yetki verme işlemini yalnızca Supabase service role veya güvenli yönetim prosedürüyle yapın.
                    </p>
                  </div>
                </aside>
              </div>
            )}

            {activeView === "system" && (
              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-cyan-300" />
                  <div>
                    <h2 className="text-lg font-black text-white">Platform Sistem Ayarları</h2>
                    <p className="text-sm text-slate-400">Bakım modu, kayıt alımı, ilan onayı ve platform duyuru bandını buradan yönetin.</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[
                    ["maintenance_mode", "Bakım modu", "Açıkken kullanıcı tarafında bakım uyarısı göstermek için merkezi ayar."],
                    ["registration_enabled", "Yeni üyelik açık", "Kapalı olduğunda yeni kayıt akışı durdurulabilir."],
                    ["job_moderation_required", "İlan admin onayı", "Kullanıcı ilanları yayınlanmadan önce admin onayına düşsün."],
                    ["readonly_mode", "Salt okunur mod", "Kritik bakımda yeni kayıt/oluşturma işlemlerini durdurmak için."],
                    ["notice_enabled", "Platform duyuru bandı", "Kullanıcı arayüzünde merkezi bilgilendirme metni göster."],
                  ].map(([key, title, detail]) => (
                    <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-950/45 p-4">
                      <div>
                        <p className="font-black text-white">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(securitySettings[key as keyof PlatformAdminSecuritySettings])}
                        onChange={(event) => setSecuritySettings((current) => ({ ...current, [key]: event.target.checked }))}
                        className="h-5 w-5 accent-cyan-500"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Destek e-posta adresi</Label>
                    <Input
                      value={securitySettings.support_email}
                      onChange={(event) => setSecuritySettings((current) => ({ ...current, support_email: event.target.value }))}
                      className="border-slate-700 bg-slate-950/70 text-white"
                      placeholder="destek@isgvizyon.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Platform duyuru metni</Label>
                    <Textarea
                      value={securitySettings.platform_notice}
                      onChange={(event) => setSecuritySettings((current) => ({ ...current, platform_notice: event.target.value }))}
                      className="min-h-24 border-slate-700 bg-slate-950/70 text-white"
                      placeholder="Kullanıcılara gösterilecek kısa sistem mesajı..."
                    />
                  </div>
                </div>

                <Button onClick={() => void saveSecuritySettings()} disabled={actionId === "save-security-settings"} className="mt-6 bg-cyan-600 hover:bg-cyan-500">
                  {actionId === "save-security-settings" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Sistem Ayarlarını Kaydet
                </Button>
              </div>
            )}

            {activeView === "audit" && (
              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55">
                <div className="flex flex-col gap-3 border-b border-slate-700/70 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Denetim Kaydı</p>
                    <h2 className="mt-1 text-2xl font-black text-white">Admin İşlem Geçmişi</h2>
                    <p className="mt-1 text-sm text-slate-400">Güvenlik anahtarı denemeleri, ayar değişiklikleri ve yönetim aksiyonları burada izlenir.</p>
                  </div>
                  <Button onClick={() => void loadSecurityData()} className="bg-slate-800 text-slate-100 hover:bg-slate-700">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Kayıtları Yenile
                  </Button>
                </div>
                <div className="divide-y divide-slate-800">
                  {auditLogs.length ? (
                    auditLogs.map((log) => (
                      <div key={log.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[220px_1fr_220px] lg:items-center">
                        <div>
                          <p className="font-bold text-white">{log.admin_email || "Bilinmeyen admin"}</p>
                          <p className="text-xs text-slate-500">{formatDate(log.created_at)}</p>
                        </div>
                        <div>
                          <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">{log.action}</Badge>
                          <p className="mt-2 text-xs text-slate-500">{log.target_type || "platform"} {log.target_id ? `• ${log.target_id}` : ""}</p>
                        </div>
                        <pre className="max-h-24 overflow-auto rounded-xl bg-slate-950/70 p-3 text-[11px] leading-5 text-slate-400">
                          {JSON.stringify(log.metadata || {}, null, 2)}
                        </pre>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-sm text-slate-400">Henüz admin işlem kaydı bulunmuyor.</div>
                  )}
                </div>
              </div>
            )}

            {activeView === "moderation" && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  {(["pending", "approved", "rejected", "archived"] as JobStatus[]).map((status) => (
                    <button key={status} type="button" onClick={() => setActiveView("moderation")} className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-4 text-left">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{statusLabels[status]}</p>
                      <p className="mt-2 text-3xl font-black text-white">{counts[status]}</p>
                    </button>
                  ))}
                </div>
                <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-5">
                    <h2 className="text-lg font-black text-white">Onay Bekleyen İlanlar</h2>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : renderPosts("pending")}
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-lg font-black text-white">Yorum Onayı</h2>
                    {comments.filter((comment) => comment.status === "pending").length ? (
                      comments.filter((comment) => comment.status === "pending").map((comment) => (
                        <div key={comment.id} className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-white">
                            <MessageCircle className="h-4 w-4 text-cyan-300" />
                            {comment.author_name || "Anonim"}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{comment.comment}</p>
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" onClick={() => updateCommentStatus(comment.id, "approved")} disabled={actionId === comment.id} className="bg-emerald-600 hover:bg-emerald-500">Onayla</Button>
                            <Button size="sm" variant="outline" onClick={() => updateCommentStatus(comment.id, "rejected")} disabled={actionId === comment.id} className="border-rose-400/30 bg-rose-950/20 text-rose-100 hover:bg-rose-900/30">Reddet</Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-6 text-sm text-slate-400">Onay bekleyen yorum bulunmuyor.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeView === "announcements" && (
              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <Bell className="h-5 w-5 text-violet-300" />
                  <div>
                    <h2 className="text-lg font-black text-white">Platform Duyurusu Yayınla</h2>
                    <p className="text-sm text-slate-400">İş ilanları ekranındaki bildirim panelinde görünür.</p>
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Başlık</Label>
                    <Input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Örn: Yeni ilan filtreleri yayında" className="border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Duyuru metni</Label>
                    <Textarea value={announcementMessage} onChange={(event) => setAnnouncementMessage(event.target.value)} placeholder="Duyuru metnini yazın..." className="min-h-28 border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                  <Button onClick={() => void publishAnnouncement()} disabled={actionId === "announcement"} className="bg-violet-600 hover:bg-violet-500">
                    {actionId === "announcement" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Duyuruyu Yayınla
                  </Button>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
