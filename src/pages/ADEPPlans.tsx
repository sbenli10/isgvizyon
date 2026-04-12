
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Edit,
  Eye,
  FileText,
  LayoutTemplate,
  Layers3,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ADEPPlan {
  id: string;
  plan_name: string;
  company_name: string;
  sector?: string | null;
  hazard_class: string;
  employee_count: number;
  status: string;
  pdf_url: string | null;
  next_review_date: string | null;
  created_at: string;
  updated_at: string;
  plan_data?: {
    export_preferences?: {
      cover_style?: string;
    };
  } | null;
}

type CoverMeta = {
  label: string;
  className: string;
  icon: typeof LayoutTemplate;
};

const eyebrowClass = "text-[11px] uppercase tracking-[0.18em] text-slate-400";
const cardTitleClass =
  "text-[1.08rem] font-semibold tracking-[-0.02em] text-white";

const getHazardTone = (hazardClass: string) => {
  if (hazardClass === "Çok Tehlikeli") {
    return {
      label: "Çok Tehlikeli",
      badge: "border-red-400/25 bg-red-400/10 text-red-100",
      bar: 92,
    };
  }

  if (hazardClass === "Tehlikeli") {
    return {
      label: "Tehlikeli",
      badge: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      bar: 72,
    };
  }

  return {
    label: "Az Tehlikeli",
    badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    bar: 44,
  };
};

const getStatusConfig = (status: string) => {
  if (status === "completed") {
    return {
      label: "Tamamlandı",
      className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      icon: CheckCircle2,
    };
  }

  if (status === "review") {
    return {
      label: "Gözden Geçirme",
      className: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      icon: Clock3,
    };
  }

  if (status === "active") {
    return {
      label: "Aktif",
      className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
      icon: Shield,
    };
  }

  return {
    label: "Taslak",
    className: "border-white/15 bg-white/10 text-slate-200",
    icon: FileText,
  };
};

const getCoverStyleMeta = (coverStyle?: string): CoverMeta => {
  switch (coverStyle) {
    case "classic":
      return {
        label: "Klasik Kapak",
        className: "border-slate-300/25 bg-slate-300/10 text-slate-100",
        icon: LayoutTemplate,
      };
    case "gold":
      return {
        label: "Altın Kapak",
        className: "border-amber-400/25 bg-amber-400/10 text-amber-100",
        icon: BadgeCheck,
      };
    case "blueprint":
      return {
        label: "Mavi Zarif",
        className: "border-blue-400/25 bg-blue-400/10 text-blue-100",
        icon: Layers3,
      };
    case "minimal":
      return {
        label: "Minimalist",
        className: "border-slate-400/25 bg-slate-400/10 text-slate-100",
        icon: FileText,
      };
    case "nature":
      return {
        label: "Yeşil Doğa",
        className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
        icon: Sparkles,
      };
    case "official-red":
      return {
        label: "Kırmızı Resmi",
        className: "border-red-400/25 bg-red-400/10 text-red-100",
        icon: Shield,
      };
    default:
      return {
        label: "Gölgeli",
        className: "border-orange-400/25 bg-orange-400/10 text-orange-100",
        icon: LayoutTemplate,
      };
  }
};

export default function ADEPPlans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<ADEPPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPlan, setPreviewPlan] = useState<ADEPPlan | null>(null);
  const [companyLogos, setCompanyLogos] = useState<Record<string, string>>({});
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState("");

  useEffect(() => {
    void fetchPlans();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchBrandingAssets();
  }, [user, plans]);

  const fetchPlans = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("adep_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlans((data as ADEPPlan[]) || []);
    } catch (error: any) {
      console.error("Plan fetch error:", error);
      toast.error("Planlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm("Bu planı silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("adep_plans")
        .update({ is_deleted: true })
        .eq("id", id);

      if (error) throw error;

      toast.success("Plan silindi");
      void fetchPlans();
    } catch (error: any) {
      toast.error("Plan silinemedi: " + error.message);
    }
  };

  const resolveMaybeSignedUrl = async (bucket: string, value?: string | null) => {
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(value, 3600);
    return data?.signedUrl || value;
  };

  const fetchBrandingAssets = async () => {
    if (!user) return;

    try {
      const [profileResult, companiesResult] = await Promise.all([
        supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle(),
        supabase
          .from("companies")
          .select("name, logo_url")
          .eq("user_id", user.id)
          .not("logo_url", "is", null),
      ]);

      const logoMap: Record<string, string> = {};

      const companies = companiesResult.data || [];
      for (const company of companies) {
        const resolved = await resolveMaybeSignedUrl("company-logos", company.logo_url);
        if (resolved) {
          logoMap[company.name.toLocaleLowerCase("tr-TR")] = resolved;
        }
      }

      setCompanyLogos(logoMap);

      const organizationId = profileResult.data?.organization_id;
      if (organizationId) {
        const organizationResult = await supabase
          .from("organizations")
          .select("logo_url")
          .eq("id", organizationId)
          .maybeSingle();

        const resolvedOrgLogo = await resolveMaybeSignedUrl(
          "company-logos",
          organizationResult.data?.logo_url
        );
        setOrganizationLogoUrl(resolvedOrgLogo);
      }
    } catch (error) {
      console.warn("ADEP branding assets could not be loaded:", error);
    }
  };

  const dashboardSummary = useMemo(() => {
    const total = plans.length;
    const completed = plans.filter((plan) => plan.status === "completed").length;
    const withPdf = plans.filter((plan) => !!plan.pdf_url).length;
    const critical = plans.filter(
      (plan) => plan.hazard_class === "Çok Tehlikeli"
    ).length;
    const upcomingReview = plans.filter((plan) => {
      if (!plan.next_review_date) return false;
      return new Date(plan.next_review_date).getTime() > Date.now();
    }).length;

    const dominantHazard = plans.reduce<Record<string, number>>((acc, plan) => {
      acc[plan.hazard_class] = (acc[plan.hazard_class] || 0) + 1;
      return acc;
    }, {});

    const topHazard =
      Object.entries(dominantHazard).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "Veri bekleniyor";

    return { total, completed, withPdf, critical, upcomingReview, topHazard };
  }, [plans]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-8 shadow-[0_24px_60px_rgba(2,6,23,0.35)]">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
            <div className="space-y-4">
              <div className="h-10 w-72 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-5 w-96 animate-pulse rounded-xl bg-white/5" />
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                  />
                ))}
              </div>
            </div>
            <div className="h-48 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.03]" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-[24px] border border-white/10 bg-slate-950/65"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 pb-10">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_35%,transparent_70%,rgba(255,255,255,0.04))]" />
          <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.82fr] xl:items-end">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_12px_30px_rgba(15,23,42,0.35)] backdrop-blur">
                  <AlertTriangle className="h-7 w-7 text-emerald-200" />
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                      ADEP Plan Merkezi
                    </Badge>
                    <Badge className="border-white/10 bg-white/10 text-slate-200 hover:bg-white/10">
                      Kurumsal plan listesi
                    </Badge>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                    Acil Durum Eylem Planları
                  </h1>
                  <p className="mt-2 text-sm text-slate-300">
                    Hazırlanan planları yönetin, PDF hazır durumlarını görün ve gözden geçirme baskısını tek panelden takip edin.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Toplam Plan</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{dashboardSummary.total}</div>
                  <div className="mt-1 text-xs text-slate-400">Aktif kurumsal plan envanteri</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">PDF Hazır</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{dashboardSummary.withPdf}</div>
                  <div className="mt-1 text-xs text-slate-400">Paylaşıma hazır çıktı adedi</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Kritik Risk</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{dashboardSummary.critical}</div>
                  <div className="mt-1 text-xs text-slate-400">Çok tehlikeli sınıftaki planlar</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => navigate("/adep-plans/new")}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                >
                  <Plus className="h-4 w-4" />
                  Yeni ADEP Oluştur
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => navigate("/adep-wizard")}
                >
                  <Sparkles className="h-4 w-4" />
                  Sihirbazı Aç
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Operasyon Özeti</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-400">Tamamlanan plan oranı</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        %{dashboardSummary.total ? Math.round((dashboardSummary.completed / dashboardSummary.total) * 100) : 0}
                      </div>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                  </div>
                  <Progress
                    value={
                      dashboardSummary.total
                        ? (dashboardSummary.completed / dashboardSummary.total) * 100
                        : 0
                    }
                    className="mt-4 h-2.5 bg-white/10"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">Yoğun risk tonu</div>
                    <div className="mt-2 text-lg font-semibold text-white">{dashboardSummary.topHazard}</div>
                  </div>
                  <div className="rounded-2xl border border-amber-400/15 bg-amber-400/8 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200">Yaklaşan gözden geçirme</div>
                    <div className="mt-2 text-lg font-semibold text-white">{dashboardSummary.upcomingReview}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                  Kullanıcı burada hazırlanan tüm ADEP planlarını aynı dilde görür, PDF hazır durumunu ayırt eder ve hızlıca düzenleme veya inceleme akışına geçer.
                </div>
              </div>
            </div>
          </div>
        </div>
        {plans.length === 0 ? (
          <Card className="rounded-[26px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_24px_65px_rgba(2,6,23,0.32)]">
            <CardContent className="py-16">
              <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <FileText className="h-10 w-10 text-slate-400" />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-white">Henüz ADEP oluşturulmadı</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  İlk planı sihirbazla kurup bu ekranda kurumsal liste görünümüne taşıyabiliriz.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() => navigate("/adep-wizard")}
                    className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                  >
                    <Plus className="h-4 w-4" />
                    İlk Planı Oluştur
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => navigate("/adep-plans/new")}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Hızlı Plan Formu
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {plans.map((plan) => {
              const hazard = getHazardTone(plan.hazard_class);
              const status = getStatusConfig(plan.status);
              const coverStyle = getCoverStyleMeta(
                plan.plan_data?.export_preferences?.cover_style
              );
              const StatusIcon = status.icon;
              const CoverIcon = coverStyle.icon;
              const logoSource =
                companyLogos[plan.company_name.toLocaleLowerCase("tr-TR")] ||
                organizationLogoUrl ||
                "";
              const reviewText = plan.next_review_date
                ? format(new Date(plan.next_review_date), "dd MMM yyyy", { locale: tr })
                : "Planlama bekleniyor";

              return (
                <Card
                  key={plan.id}
                  className="overflow-hidden rounded-[26px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_22px_55px_rgba(2,6,23,0.28)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/25 hover:shadow-[0_30px_80px_rgba(2,6,23,0.4)]"
                >
                  <CardHeader className="border-b border-white/10 bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`${status.className} border`}>
                            <StatusIcon className="mr-1 h-3.5 w-3.5" />
                            {status.label}
                          </Badge>
                          <Badge className={`${hazard.badge} border`}>{hazard.label}</Badge>
                          <Badge className={`${coverStyle.className} border`}>
                            <CoverIcon className="mr-1 h-3.5 w-3.5" />
                            {coverStyle.label}
                          </Badge>
                        </div>
                        <CardTitle className={cardTitleClass}>{plan.plan_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-sm text-slate-400">
                          <Building2 className="h-4 w-4 text-cyan-300" />
                          {plan.company_name}
                        </CardDescription>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
                        <div className={eyebrowClass}>Risk skoru</div>
                        <div className="mt-1 text-lg font-semibold text-white">{hazard.bar}/100</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 p-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className={eyebrowClass}>Çalışan</div>
                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                          <Users className="h-4 w-4 text-cyan-300" />
                          {plan.employee_count} kişi
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className={eyebrowClass}>Son güncelleme</div>
                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                          <Clock3 className="h-4 w-4 text-violet-300" />
                          {format(new Date(plan.updated_at), "dd MMM yyyy", { locale: tr })}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className={eyebrowClass}>Gözden geçirme baskısı</div>
                        <Badge className="border-white/10 bg-white/10 text-slate-200 hover:bg-white/10">
                          {plan.next_review_date ? "Planlı" : "Bekliyor"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <CalendarClock className="h-4 w-4 text-amber-300" />
                        {reviewText}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/6 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                        Sonraki önerilen aksiyon
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-200">
                        {plan.pdf_url
                          ? "Plan PDF çıktısı hazır. Şimdi inceleme veya paylaşım akışına geçmek en doğru adım."
                          : "Planı açıp son kontrolleri tamamlayın, ardından PDF çıktısını üretin."}
                      </div>
                    </div>

                    {plan.pdf_url && (
                      <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className={eyebrowClass}>Belge kartı</div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              PDF hazır mini önizleme
                            </div>
                          </div>
                          <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                            Hazır
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewPlan(plan)}
                          className="group relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/80 p-4 text-left transition hover:border-cyan-400/30 hover:bg-slate-950"
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.16),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.12),_transparent_28%)] opacity-90" />
                          <div className="relative space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-200">
                                  ADEP PDF Kapağı
                                </div>
                                <div className="mt-2 text-base font-semibold text-white">
                                  {plan.plan_name}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {plan.company_name}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                  Stil
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white">
                                  <CoverIcon className="h-4 w-4 text-cyan-200" />
                                  {coverStyle.label}
                                </div>
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Durum</div>
                                <div className="mt-1 text-sm font-medium text-white">{status.label}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Tehlike</div>
                                <div className="mt-1 text-sm font-medium text-white">{hazard.label}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Gözden Geçirme</div>
                                <div className="mt-1 text-sm font-medium text-white">{reviewText}</div>
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Sektör</div>
                                <div className="mt-1 text-sm font-medium text-white">
                                  {plan.sector || "Belirtilmedi"}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Tehlike Sınıfı</div>
                                <div className="mt-1 text-sm font-medium text-white">{hazard.label}</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                                Rev. 0
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                                Hazırlanma: {format(new Date(plan.created_at), "dd.MM.yyyy", { locale: tr })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>Gerçek belge hissiyle hızlı kontrol</span>
                              <span className="inline-flex items-center gap-1 text-cyan-200 transition group-hover:translate-x-0.5">
                                Önizlemeyi aç
                                <ArrowRight className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {plan.pdf_url && (
                        <Button
                          variant="outline"
                          className="gap-2 border-cyan-400/20 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/15 hover:text-cyan-50"
                          onClick={() => setPreviewPlan(plan)}
                        >
                          <Eye className="h-4 w-4" />
                          Mini Önizleme
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        onClick={() => navigate(`/adep-plans/${plan.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        Görüntüle
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        onClick={() => navigate(`/adep-plans/${plan.id}/edit`)}
                      >
                        <Edit className="h-4 w-4" />
                        Düzenle
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        disabled={!plan.pdf_url}
                        onClick={() => plan.pdf_url && window.open(plan.pdf_url, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                        PDF Aç
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-red-400/20 bg-red-400/8 text-red-100 hover:bg-red-400/14 hover:text-red-50 sm:col-span-2"
                        onClick={() => void deletePlan(plan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Sil
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!previewPlan} onOpenChange={(open) => !open && setPreviewPlan(null)}>
        <DialogContent className="max-w-4xl border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-0 text-white shadow-[0_30px_90px_rgba(2,6,23,0.55)]">
          {previewPlan && (
            <>
              {(() => {
                const previewLogo =
                  companyLogos[previewPlan.company_name.toLocaleLowerCase("tr-TR")] ||
                  organizationLogoUrl ||
                  "";
                return (
                  <>
              <DialogHeader className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
                <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-white">
                  Belge Önizleme
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {previewPlan.plan_name} için hazırlanmış ADEP PDF görünümü.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
                  <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,47,73,0.96),rgba(15,23,42,0.96)_55%,rgba(2,6,23,0.98))] p-6 shadow-[0_24px_65px_rgba(2,6,23,0.35)]">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                        ADEP Kapak
                      </Badge>
                      <Badge className={`${getCoverStyleMeta(previewPlan.plan_data?.export_preferences?.cover_style).className} border`}>
                        {getCoverStyleMeta(previewPlan.plan_data?.export_preferences?.cover_style).label}
                      </Badge>
                    </div>
                    <div className="mt-10 rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
                      <div className="mb-5 flex items-center justify-between gap-4">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/95 p-2 shadow-[0_10px_24px_rgba(2,6,23,0.22)]">
                          {previewLogo ? (
                            <img
                              src={previewLogo}
                              alt="Şirket logosu"
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <Building2 className="h-7 w-7 text-slate-500" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2 text-right">
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                            Rev. 0
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                            Hazırlanma {format(new Date(previewPlan.created_at), "dd.MM.yyyy", { locale: tr })}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                        Acil Durum Eylem Planı
                      </div>
                      <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">
                        {previewPlan.plan_name}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {previewPlan.company_name} için hazırlanan planın kapak dili, risk tonu ve belge kimliği burada özetlenir.
                      </p>
                      <div className="mt-8 space-y-3">
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Durum</span>
                          <span className="text-sm font-medium text-white">{getStatusConfig(previewPlan.status).label}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Tehlike Sınıfı</span>
                          <span className="text-sm font-medium text-white">{getHazardTone(previewPlan.hazard_class).label}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Çalışan</span>
                          <span className="text-sm font-medium text-white">{previewPlan.employee_count} kişi</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Sektör</span>
                            <div className="mt-1 text-sm font-medium text-white">
                              {previewPlan.sector || "Belirtilmedi"}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Tehlike</span>
                            <div className="mt-1 text-sm font-medium text-white">
                              {getHazardTone(previewPlan.hazard_class).label}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className={eyebrowClass}>Belge meta</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          Hazır PDF görünümü
                        </div>
                      </div>
                      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                        Önizlenebilir
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                        <div className={eyebrowClass}>Şirket</div>
                        <div className="mt-2 text-sm font-medium text-white">{previewPlan.company_name}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                        <div className={eyebrowClass}>Son Güncelleme</div>
                        <div className="mt-2 text-sm font-medium text-white">
                          {format(new Date(previewPlan.updated_at), "dd MMMM yyyy", { locale: tr })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/70">
                    <iframe
                      src={previewPlan.pdf_url ?? ""}
                      title={`${previewPlan.plan_name} PDF önizleme`}
                      className="h-[540px] w-full bg-white"
                    />
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      variant="outline"
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                      onClick={() => window.open(previewPlan.pdf_url ?? "", "_blank")}
                    >
                      <Download className="h-4 w-4" />
                      PDF Aç
                    </Button>
                    <Button
                      className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                      onClick={() => navigate(`/adep-plans/${previewPlan.id}`)}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Plan Detayına Git
                    </Button>
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
