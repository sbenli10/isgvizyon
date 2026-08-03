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
  MessageCircle,
  RefreshCw,
  Save,
  Search,
  Send,
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
type AdminView = "overview" | "users" | "activity" | "modules" | "pricing" | "moderation" | "announcements";

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

const emptyOverview: PlatformOverview = {
  users: { total: 0, today_signups: 0, today_logins: 0, active: 0, platform_admins: 0 },
  jobs: { pending_posts: 0, approved_posts: 0, pending_comments: 0 },
  modules: {},
  daily_signups: [],
  daily_logins: [],
  latest_users: [],
  alerts: [],
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
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [adminSession] = useState(() => hasPlatformAdminSession());

  const canManage = isPlatformAdmin(profile) && adminSession;

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

  const loadPricingData = async () => {
    if (!canManage) return;
    setPricingBusy(true);

    try {
      const { data, error } = await (supabase as any).rpc("get_platform_admin_plan_prices");
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

                {!pricingBusy && planPrices.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                    Paket fiyatı bulunamadı. Supabase migration çalıştırıldıktan sonra bu alan Free, Premium ve OSGB kayıtlarını gösterecek.
                  </div>
                ) : null}
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
          </div>
        </section>
      </div>
    </main>
  );
}
