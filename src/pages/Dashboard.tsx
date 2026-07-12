import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Bell,
  BookOpen,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  HelpCircle,
  MapPin,
  Megaphone,
  Plus,
  Rocket,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DashboardCompany = {
  id: string;
  name?: string | null;
  hazard_class?: string | null;
  employee_count?: number | null;
  visit_frequency?: string | null;
  created_at?: string | null;
};

type DashboardVisit = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  visit_date?: string | null;
  visit_time?: string | null;
  visit_type?: string | null;
  notes?: string | null;
  next_visit_date?: string | null;
  status?: string | null;
};

type DashboardStats = {
  companies: number;
  employees: number;
  documents: number;
  trainings: number;
  risks: number;
  visits: number;
};

type VisitCompanySource = "osgb" | "own";

type VisitCompanyOption = {
  id: string;
  name: string;
  source: VisitCompanySource;
  hazardClass?: string | null;
  employeeCount?: number | null;
};

const db = supabase as any;

const announcements = [
  {
    title: "Risk Sihirbazı tek ekranda toplandı",
    date: "31 May 2026",
    tone: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
    badge: "Yeni",
  },
  {
    title: "Firma ve çalışan toplu yükleme akışları yenilendi",
    date: "29 May 2026",
    tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  },
  {
    title: "Sertifika üretiminde kuyruk ve hata takibi güçlendirildi",
    date: "27 May 2026",
    tone: "border-blue-400/40 bg-blue-500/10 text-blue-100",
  },
  {
    title: "İSGBot canlı pilot güvenlik kontrolleri eklendi",
    date: "24 May 2026",
    tone: "border-violet-400/40 bg-violet-500/10 text-violet-100",
  },
  {
    title: "Evrak takip ve rapor arşivi firma paneline bağlandı",
    date: "21 May 2026",
    tone: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  },
  {
    title: "PDF ve Word çıktılarına Türkçe karakter iyileştirmeleri yapıldı",
    date: "18 May 2026",
    tone: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100",
  },
  {
    title: "WhatsApp ile rapor paylaşım akışı hazırlandı",
    date: "15 May 2026",
    tone: "border-rose-400/40 bg-rose-500/10 text-rose-100",
  },
  {
    title: "OSGB modülünde kapasite ve atama ekranları güncellendi",
    date: "12 May 2026",
    tone: "border-orange-400/40 bg-orange-500/10 text-orange-100",
  },
];

async function safeCount(table: string, filters?: (query: any) => any) {
  try {
    let query = db.from(table).select("id", { count: "exact", head: true });
    if (filters) query = filters(query);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.warn(`[Dashboard] ${table} sayısı alınamadı`, error);
    return 0;
  }
}

async function safeRows<T>(table: string, select = "*", limit = 20, filters?: (query: any) => any): Promise<T[]> {
  try {
    let query = db.from(table).select(select).limit(limit);
    if (filters) query = filters(query);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as T[];
  } catch (error) {
    console.warn(`[Dashboard] ${table} verisi alınamadı`, error);
    return [];
  }
}

async function loadAssignedOsgbCompanies(userId?: string | null): Promise<VisitCompanyOption[]> {
  if (!userId) return [];

  try {
    const { data: assignments, error: assignmentError } = await db
      .from("osgb_assignments")
      .select("company_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(500);
    if (assignmentError) throw assignmentError;

    const companyIds = Array.from(new Set(((assignments || []) as { company_id?: string | null }[]).map((item) => item.company_id).filter(Boolean))) as string[];
    if (companyIds.length === 0) return [];

    const { data: companyRows, error: companyError } = await db
      .from("isgkatip_companies")
      .select("id,company_name,hazard_class,employee_count")
      .in("id", companyIds)
      .limit(500);
    if (companyError) throw companyError;

    return ((companyRows || []) as any[]).map((company) => ({
      id: String(company.id),
      name: String(company.company_name || "İsimsiz OSGB firması"),
      source: "osgb" as const,
      hazardClass: company.hazard_class || null,
      employeeCount: typeof company.employee_count === "number" ? company.employee_count : null,
    }));
  } catch (error) {
    console.warn("[Dashboard] OSGB atanmış firma listesi alınamadı", error);
    return [];
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Tarih belirtilmedi";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentTimeInputValue() {
  return new Date().toTimeString().slice(0, 5);
}

function requestCurrentPosition(): Promise<GeolocationPosition | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 6000 },
    );
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi Günler";
  return "İyi Akşamlar";
}

function getSubscriptionLabel(plan?: string | null, isPaidPlan?: boolean) {
  if (!isPaidPlan) return "Ücretsiz";
  if (plan === "osgb") return "OSGB";
  if (plan === "premium") return "Premium";
  return "Aktif";
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  tone: string;
  subtitle?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-slate-700/70 bg-slate-950/55 text-white shadow-sm", tone)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>
            <p className="mt-2 text-2xl font-black">{value}</p>
            {subtitle ? <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p> : null}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  badge,
  className,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group min-h-[112px] rounded-2xl border border-white/10 p-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl border border-white/15 bg-white/15 p-2">
          <Icon className="h-4 w-4" />
        </div>
        {badge ? (
          <span className="rounded-lg border border-white/20 bg-white/20 px-2 py-1 text-[10px] font-black uppercase">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-base font-black leading-tight">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/82">{description}</p>
      <span className="mt-2 inline-flex text-[11px] font-bold text-white/90">
        İncele <ExternalLink className="ml-1 h-3 w-3 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function EmptyVisitState() {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center text-center">
      <MapPin className="h-9 w-9 text-cyan-300" />
      <p className="mt-3 text-sm font-black text-white">Ziyaret beklemiyor</p>
      <p className="mt-1 text-xs text-slate-400">Bugün için planlanmış firma ziyareti görünmüyor.</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { plan, isPaidPlan } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    companies: 0,
    employees: 0,
    documents: 0,
    trainings: 0,
    risks: 0,
    visits: 0,
  });
  const [companies, setCompanies] = useState<DashboardCompany[]>([]);
  const [osgbCompanies, setOsgbCompanies] = useState<VisitCompanyOption[]>([]);
  const [visits, setVisits] = useState<DashboardVisit[]>([]);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [visitSource, setVisitSource] = useState<VisitCompanySource>("own");
  const [visitSearch, setVisitSearch] = useState("");
  const [selectedVisitCompanyId, setSelectedVisitCompanyId] = useState("");
  const [visitDate, setVisitDate] = useState(getTodayInputValue());
  const [visitTime, setVisitTime] = useState(getCurrentTimeInputValue());
  const [visitNote, setVisitNote] = useState("");
  const [visitSubmitting, setVisitSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      const orgId = profile?.organization_id;
      const userId = user?.id;

      const companyFilter = (query: any) => {
        let next = query.eq("is_active", true);
        if (orgId) next = next.eq("organization_id", orgId);
        else if (userId) next = next.eq("user_id", userId);
        return next;
      };

      const userFilter = (query: any) => (userId ? query.eq("user_id", userId) : query);

      const [companyRows, employeeCount, documentCount, trainingCount, riskCount, visitRows, osgbRows] = await Promise.all([
        safeRows<DashboardCompany>("companies", "id,name,hazard_class,employee_count,visit_frequency,created_at", 120, (query) =>
          companyFilter(query).order("created_at", { ascending: false }),
        ),
        safeCount("employees", (query) => query.eq("is_active", true)),
        safeCount("company_documents", userFilter),
        safeCount("trainings", userFilter),
        safeCount("saved_risk_items", userFilter),
        safeRows<DashboardVisit>("company_visits", "*", 8, (query) => userFilter(query).order("visit_date", { ascending: true })),
        loadAssignedOsgbCompanies(userId),
      ]);

      if (!active) return;

      setCompanies(companyRows);
      setOsgbCompanies(osgbRows);
      setVisitSource(osgbRows.length > 0 ? "osgb" : "own");
      setVisits(visitRows);
      setStats({
        companies: companyRows.length,
        employees: employeeCount,
        documents: documentCount,
        trainings: trainingCount,
        risks: riskCount,
        visits: visitRows.length,
      });
      setLoading(false);
    };

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [profile?.organization_id, user?.id]);

  const ownVisitCompanies = useMemo<VisitCompanyOption[]>(
    () =>
      companies.map((company) => ({
        id: company.id,
        name: company.name || "İsimsiz firma",
        source: "own" as const,
        hazardClass: company.hazard_class || null,
        employeeCount: typeof company.employee_count === "number" ? company.employee_count : null,
      })),
    [companies],
  );

  const activeVisitCompanies = visitSource === "osgb" ? osgbCompanies : ownVisitCompanies;
  const selectedVisitCompany = activeVisitCompanies.find((company) => company.id === selectedVisitCompanyId) || null;
  const filteredVisitCompanies = activeVisitCompanies.filter((company) =>
    company.name.toLocaleLowerCase("tr-TR").includes(visitSearch.trim().toLocaleLowerCase("tr-TR")),
  );

  const resetVisitDialog = () => {
    setVisitSearch("");
    setSelectedVisitCompanyId("");
    setVisitDate(getTodayInputValue());
    setVisitTime(getCurrentTimeInputValue());
    setVisitNote("");
    setVisitSource(osgbCompanies.length > 0 ? "osgb" : "own");
  };

  const handleOpenVisitDialog = () => {
    resetVisitDialog();
    setVisitDialogOpen(true);
  };

  const handleVisitSourceChange = (value: VisitCompanySource) => {
    setVisitSource(value);
    setSelectedVisitCompanyId("");
    setVisitSearch("");
  };

  const handleCreateVisit = async () => {
    if (!user?.id) {
      toast.error("Ziyaret kaydı için oturum bulunamadı.");
      return;
    }
    if (!selectedVisitCompany) {
      toast.error("Lütfen ziyaret edilecek firmayı seçin.");
      return;
    }
    if (!visitDate) {
      toast.error("Lütfen ziyaret tarihini seçin.");
      return;
    }

    setVisitSubmitting(true);
    const position = await requestCurrentPosition();
    const locationNote = position
      ? `Konum: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
      : "Konum: alınamadı veya izin verilmedi";
    const sourceLabel = visitSource === "osgb" ? "OSGB görevlendirilmiş firma" : "Kendi firmam";
    const notes = [visitNote.trim(), `Kaynak: ${sourceLabel}`, locationNote].filter(Boolean).join("\n");

    const payload = {
      user_id: user.id,
      organization_id: profile?.organization_id || null,
      company_id: selectedVisitCompany.id,
      visit_date: visitDate,
      visit_time: visitTime || null,
      visit_type: "Firma Ziyareti",
      notes,
      next_visit_date: null,
    };

    const { data, error } = await db.from("company_visits").insert(payload).select("*").single();
    setVisitSubmitting(false);

    if (error) {
      console.error("[Dashboard] ziyaret kaydı oluşturulamadı", error);
      toast.error("Ziyaret kaydı oluşturulamadı.");
      return;
    }

    const createdVisit = {
      ...(data as DashboardVisit),
      company_name: selectedVisitCompany.name,
    };
    setVisits((current) => [createdVisit, ...current].slice(0, 8));
    setStats((current) => ({ ...current, visits: current.visits + 1 }));
    setVisitDialogOpen(false);
    toast.success("Firma ziyareti kaydedildi.");
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Kullanıcı";
  const complianceScore = useMemo(() => {
    if (loading) return 0;
    if (stats.companies === 0) return 0;
    const documentWeight = Math.min(35, stats.documents * 4);
    const employeeWeight = Math.min(25, stats.employees * 2);
    const trainingWeight = Math.min(20, stats.trainings * 3);
    const riskWeight = Math.min(20, stats.risks * 3);
    return Math.max(0, Math.min(100, Math.round(documentWeight + employeeWeight + trainingWeight + riskWeight)));
  }, [loading, stats]);

  const trendPoints = useMemo(() => {
    const values = [0, stats.companies, stats.employees, stats.documents, stats.trainings, stats.risks].map((value) =>
      Math.min(8, Math.max(0, Number(value) || 0)),
    );
    return values.map((value, index) => `${index * 58},${96 - value * 9}`).join(" ");
  }, [stats]);

  const latestCompanies = companies.slice(0, 3);

  return (
    <div className="w-full min-w-0 space-y-5 px-3 pb-8 text-slate-100 sm:px-4 lg:px-6">
      <section className="overflow-hidden rounded-2xl border border-violet-400/20 bg-[linear-gradient(110deg,#4f46e5,#8b1cf6_48%,#b000f5)] p-4 shadow-[0_20px_80px_-52px_rgba(168,85,247,0.9)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-h-[74px]">
            <p className="text-xs font-semibold text-white/85">{getGreeting()}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">{displayName}</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Button
              type="button"
              size="sm"
              onClick={handleOpenVisitDialog}
              className="rounded-xl bg-cyan-400 px-3 text-xs font-black text-cyan-950 hover:bg-cyan-300"
            >
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Firma Ziyareti Bildir
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate("/settings?tab=billing")}
              className="rounded-xl bg-orange-500 px-3 text-xs font-black text-white hover:bg-orange-400"
            >
              <Rocket className="mr-1.5 h-3.5 w-3.5" />
              Şimdi Satın Al
            </Button>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs text-white shadow-inner">
              <p className="font-black uppercase tracking-[0.12em] text-white/70">Mevcut Abonelik</p>
              <p className="mt-1 text-lg font-black">{getSubscriptionLabel(plan, isPaidPlan)}</p>
              <p className="mt-1 text-[10px] text-white/75">Başlangıç: - · Bitiş: Süresiz</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <button
              type="button"
              onClick={() => navigate("/profile?tab=companies")}
              className="flex items-center justify-between rounded-2xl border border-dashed border-slate-500/70 bg-slate-950/45 p-4 text-left transition hover:border-cyan-300 hover:bg-slate-900/80"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-200 p-2 text-indigo-700">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black text-white">Yeni Firma Ekle</p>
                  <p className="text-xs text-slate-400">Firma bilgilerini kaydet</p>
                </div>
              </div>
              <Badge className="rounded-lg bg-emerald-500 text-white">Toplu Yükle</Badge>
            </button>

            <button
              type="button"
              onClick={() => navigate("/docs/isg-bot-setup")}
              className="flex items-center justify-between rounded-2xl border border-violet-400/25 bg-gradient-to-r from-blue-600 to-violet-700 p-4 text-left text-white shadow-sm transition hover:brightness-110"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-white/20 bg-white/15 p-2">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black">Yardım Merkezi</p>
                  <p className="text-xs text-white/78">Platform rehberleri, adım adım videolar ve pratik çözümler.</p>
                </div>
              </div>
              <ChevronDown className="-rotate-90 h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[0.72fr_2fr]">
            <Card className="border-rose-500/30 bg-slate-950/55 text-white">
              <CardContent className="p-4">
                <p className="text-center text-xs font-black uppercase tracking-[0.16em] text-slate-400">İSG Uyum Skoru</p>
                <div className="mx-auto mt-5 flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-slate-800 border-t-rose-500 border-r-rose-500">
                  <div className="text-center">
                    <p className="text-3xl font-black">{loading ? "..." : complianceScore}</p>
                    <p className="text-xs text-slate-400">/100</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <Badge className={cn("rounded-lg", complianceScore >= 70 ? "bg-emerald-500" : complianceScore >= 40 ? "bg-amber-500" : "bg-rose-500")}>
                    {complianceScore >= 70 ? "İyi" : complianceScore >= 40 ? "Orta" : "Düşük"}
                  </Badge>
                </div>
                <p className="mt-3 text-center text-[11px] text-slate-500">Detay için tıkla</p>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard title="Firma" value={loading ? "..." : stats.companies} icon={Building2} tone="border-blue-500/30" />
              <StatCard title="Çalışanlar" value={loading ? "..." : stats.employees} icon={Users} tone="border-cyan-500/30" />
              <StatCard title="Önemli Risk" value={loading ? "..." : stats.risks} icon={ShieldAlert} tone="border-violet-500/30" subtitle="Risk skoru > 140" />
              <StatCard title="70 Biten Evrak" value={loading ? "..." : stats.documents} icon={FileText} tone="border-amber-500/30" />
              <StatCard title="Açık Görev" value={loading ? "..." : stats.visits} icon={ClipboardList} tone="border-emerald-500/30" />
              <StatCard title="Eğitim Kapsamı" value={loading ? "..." : `${Math.min(100, stats.trainings * 10)}%`} icon={GraduationCap} tone="border-blue-500/30" subtitle={`Eğitime düşen: ${stats.trainings}`} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FeatureCard title="Firma Arşivi" description="OSGB yönetim PDF belgelerini yükleyin, indeksleyin ve güvenle saklayın." icon={Archive} badge="Yeni" className="bg-gradient-to-br from-violet-600 to-purple-700" onClick={() => navigate("/profile?tab=archive")} />
            <FeatureCard title="Firma Yetki" description="OSGB yönetim firmalarınızla portal bağlantısı açın, kendileri yönetsin." icon={Zap} badge="Yeni" className="bg-gradient-to-br from-orange-500 to-amber-600" onClick={() => navigate("/profile?tab=settings")} />
            <FeatureCard title="Chrome Store" description="İSGBot eklentisini yükleyin, otomatik güncelleme alın." icon={Bot} badge="Google" className="bg-gradient-to-br from-blue-600 to-cyan-600" onClick={() => navigate("/docs/isg-bot-setup")} />
            <FeatureCard title="Risk Sihirbazı" description="Akıllı değerlendirme adımlarıyla risk raporu üretin." icon={ShieldAlert} badge="Yeni" className="bg-gradient-to-br from-rose-600 to-pink-700" onClick={() => navigate("/risk-wizard")} />
            <FeatureCard title="İSG Robot AI" description="Sektörel İSG sorularınız için akıllı danışmanlık alın." icon={Sparkles} badge="AI" className="bg-gradient-to-br from-fuchsia-600 to-violet-700" onClick={() => navigate("/isg-bot")} />
            <FeatureCard title="Davet Et Kazan" description="Arkadaş davet et, üyelik sürenize avantaj kazandırın." icon={UserPlus} badge="Hediye" className="bg-gradient-to-br from-orange-600 to-red-600" onClick={() => navigate("/settings?tab=organization")} />
          </div>

          <Card className="border-slate-700/70 bg-slate-950/55 text-white">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-black">
                  <TrendingUp className="h-5 w-5 text-indigo-300" />
                  Aktivite Trendi
                </CardTitle>
                <p className="mt-1 text-xs text-slate-400">Toplam: {stats.companies + stats.employees + stats.documents + stats.trainings + stats.risks}</p>
              </div>
              <div className="flex gap-1">
                {["7G", "30G", "12A"].map((item, index) => (
                  <span key={item} className={cn("rounded-lg px-2 py-1 text-[10px] font-black", index === 1 ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-400")}>
                    {item}
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2 text-[10px]">
                {["Raporlar", "Riskler", "Eğitimler", "Evraklar"].map((item, index) => (
                  <Badge key={item} className={cn("rounded-full", ["bg-indigo-500", "bg-rose-500", "bg-emerald-500", "bg-amber-500"][index])}>{item}</Badge>
                ))}
              </div>
              <svg viewBox="0 0 300 110" className="h-36 w-full overflow-visible">
                {[20, 40, 60, 80, 100].map((y) => (
                  <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgba(148,163,184,0.16)" strokeDasharray="3 4" />
                ))}
                <polyline points={trendPoints} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="border-slate-700/70 bg-slate-950/55 text-white">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="flex items-center justify-between text-base font-black">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-cyan-300" />
                  Ziyaret Programım
                </span>
                <Badge variant="outline" className="border-slate-600 text-slate-300">Bugün</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {visits.length === 0 ? (
                <EmptyVisitState />
              ) : (
                <div className="divide-y divide-slate-800">
                  {visits.slice(0, 5).map((visit) => (
                    <div key={visit.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{visit.company_name || "Firma ziyareti"}</p>
                          <p className="mt-1 text-xs text-slate-400">{visit.visit_type || "Planlı ziyaret"} · {formatDate(visit.visit_date || visit.next_visit_date)}</p>
                        </div>
                        <Badge className="rounded-lg bg-cyan-500/20 text-cyan-100">{visit.visit_time || "Saat yok"}</Badge>
                      </div>
                      {visit.notes ? <p className="mt-2 line-clamp-2 text-xs text-slate-400">{visit.notes}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-700/70 bg-slate-950/55 text-white">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-800 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Bell className="h-4 w-4 text-blue-300" />
                Duyurular & Yenilikler
              </CardTitle>
              <Badge className="rounded-lg bg-blue-600">Güncel</Badge>
            </CardHeader>
            <CardContent className="max-h-[430px] space-y-2 overflow-y-auto p-3">
              {announcements.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className={cn("flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition hover:bg-white/5", item.tone)}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <Megaphone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-xs font-black">{item.title}</span>
                      {item.badge ? <Badge className="h-4 rounded bg-blue-500 px-1.5 text-[9px]">{item.badge}</Badge> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] opacity-70">{item.date}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-700/70 bg-slate-950/55 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Building2 className="h-4 w-4 text-emerald-300" />
                Son Firmalar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestCompanies.length === 0 ? (
                <p className="rounded-xl border border-slate-800 bg-slate-900/45 p-4 text-center text-xs text-slate-400">Henüz firma eklenmemiş.</p>
              ) : (
                latestCompanies.map((company) => (
                  <div key={company.id} className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-black">{company.name || "İsimsiz firma"}</p>
                      <Badge className="rounded-lg bg-emerald-500/20 text-emerald-100">{company.hazard_class || "Sınıf yok"}</Badge>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                        <span>Takip doluluğu</span>
                        <span>{Math.min(100, Number(company.employee_count || 0) * 10)}%</span>
                      </div>
                      <Progress value={Math.min(100, Number(company.employee_count || 0) * 10)} className="h-1.5" />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={visitDialogOpen} onOpenChange={(open) => {
        setVisitDialogOpen(open);
        if (!open) resetVisitDialog();
      }}>
        <DialogContent className="max-h-[calc(100dvh-28px)] max-w-[520px] overflow-hidden border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl">
          <DialogHeader className="border-b border-slate-800 px-6 py-5">
            <DialogTitle className="flex items-center justify-between gap-3 text-2xl font-black">
              <span className="flex items-center gap-3">
                <MapPin className="h-6 w-6 text-cyan-300" />
                Firma Ziyareti Bildir
              </span>
              <Badge className="rounded-full bg-cyan-400 px-3 py-1 text-cyan-950">Ziyaretederim</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(100dvh-150px)] space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label className="text-sm font-black text-slate-300">Firma Kaynağı</Label>
              <Select value={visitSource} onValueChange={(value) => handleVisitSourceChange(value as VisitCompanySource)}>
                <SelectTrigger className="h-11 rounded-xl border-slate-700 bg-slate-800 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">Kendi Firmalarım ({ownVisitCompanies.length})</SelectItem>
                  <SelectItem value="osgb" disabled={osgbCompanies.length === 0}>
                    OSGB Görevlendirilen Firmalar ({osgbCompanies.length})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-black text-slate-300">Ziyaret Edilen Firma ({activeVisitCompanies.length})</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={visitSearch}
                  onChange={(event) => setVisitSearch(event.target.value)}
                  placeholder="Firma ara (ünvan veya takma ad)..."
                  className="h-11 rounded-xl border-slate-700 bg-slate-800 pl-10 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="max-h-[310px] space-y-2 overflow-y-auto pr-1">
                {filteredVisitCompanies.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/60 p-5 text-center text-sm text-slate-400">
                    Bu kaynakta firma bulunamadı.
                  </div>
                ) : (
                  filteredVisitCompanies.map((company) => (
                    <button
                      key={`${company.source}-${company.id}`}
                      type="button"
                      onClick={() => setSelectedVisitCompanyId(company.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                        selectedVisitCompanyId === company.id
                          ? "border-cyan-400 bg-cyan-500/15 text-cyan-50"
                          : "border-slate-800 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700/80",
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate font-black">{company.name}</span>
                      {company.hazardClass ? <Badge className="shrink-0 bg-slate-700 text-slate-100">{company.hazardClass}</Badge> : null}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-400">Ziyaret Tarihi</Label>
                <Input type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} className="rounded-xl border-slate-700 bg-slate-800" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-400">Saat</Label>
                <Input type="time" value={visitTime} onChange={(event) => setVisitTime(event.target.value)} className="rounded-xl border-slate-700 bg-slate-800" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400">Ziyaret Notu</Label>
              <Textarea
                value={visitNote}
                onChange={(event) => setVisitNote(event.target.value)}
                placeholder="Kısa ziyaret notu..."
                className="min-h-20 rounded-xl border-slate-700 bg-slate-800"
              />
            </div>

            <Button
              type="button"
              onClick={() => void handleCreateVisit()}
              disabled={visitSubmitting || !selectedVisitCompany}
              className="h-12 w-full rounded-xl bg-slate-700 text-base font-black text-slate-200 hover:bg-cyan-500 hover:text-cyan-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="mr-2 h-4 w-4" />
              {visitSubmitting ? "Ziyaret kaydediliyor..." : "Ziyaret Yapıldı"}
            </Button>
            <p className="text-center text-xs text-slate-400">Butona bastığınızda tarayıcınızdan konum izni istenebilir.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
