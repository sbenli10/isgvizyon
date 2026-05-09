import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Brain,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  Layers3,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { backfillMyFeatureUsage, openBillingPortal, startPlanCheckout, startPremiumTrial } from "@/lib/billing";
import { getUserFacingError, getUserFacingErrorDescription } from "@/lib/userFacingError";
import type { BillingCatalogPlan, BillingPeriod, SubscriptionPlan } from "@/types/subscription";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggeredBy?: "trial_expired" | "feature_locked" | "manual";
}

type BillingFeatureMeta = {
  key: string;
  label: string;
  description: string;
  category: string;
  kind: "access" | "limit";
  icon: typeof Brain;
};

type PlanPresentation = {
  audience: string;
  eligibility: string;
  usageModel: string;
  highlights: string[];
  demoLabel?: string;
  demoDescription?: string;
};

const FEATURE_TEXT_MAP: Record<string, { label: string; description: string }> = {
  "bulk_capa.access": {
    label: "Toplu DÖF yönetimi",
    description: "Toplu görsel analiz, seri DÖF üretimi ve yapay zeka destekli aksiyon akışı.",
  },
  "ai.risk_generation_monthly": {
    label: "Yapay zeka ile risk üretimi",
    description: "Risk editörü ve sektör bazlı yapay zeka önerileri için aylık kullanım kotası.",
  },
  "ai.bulk_capa_analysis_monthly": {
    label: "Toplu DÖF AI analizi",
    description: "Çoklu fotoğraf analizi ve toplu DÖF önerileri için aylık kullanım limiti.",
  },
  "ai.nace_analysis_monthly": {
    label: "NACE yapay zeka analizi",
    description: "NACE sorgularında yapay zeka yorumları ve risk önerileri için aylık limit.",
  },
  "ai.evacuation_plan_monthly": {
    label: "Tahliye planı AI",
    description: "Tahliye planı üretimi ve iyileştirme işlemleri için aylık kota.",
  },
  "ai.evacuation_image_monthly": {
    label: "Tahliye görseli AI",
    description: "Tahliye görseli üretimi için aylık kullanım limiti.",
  },
  "reports.export_monthly": {
    label: "Rapor dışa aktarma",
    description: "PDF ve diğer dışa aktarma işlemleri için aylık çıktı kapasitesi.",
  },
  "blueprint_analyzer.access": {
    label: "Kroki ve plan analizi",
    description: "Plan, kroki ve yerleşim görsellerini yorumlama ekranı.",
  },
  "certificates.monthly": {
    label: "Sertifika üretimi",
    description: "Aylık oluşturulabilecek sertifika sayısı.",
  },
  "form_builder.access": {
    label: "Özel form tasarlayıcı",
    description: "Özel kontrol formu ve kurumsal şablon tasarımı ekranı.",
  },
  "isg_bot.access": {
    label: "İSG Bot",
    description: "Operasyon komutları, danışman akışları ve hızlı yapay zeka yardımı.",
  },
  "osgb.access": {
    label: "OSGB modülü",
    description: "OSGB dashboard, finans, kapasite ve belge ekranları.",
  },
  "companies.count": {
    label: "Firma limiti",
    description: "Toplam yönetilebilir firma sayısı.",
  },
  "employees.count": {
    label: "Çalışan limiti",
    description: "Toplam çalışan kaydı kapasitesi.",
  },
  "risk_assessments.count": {
    label: "Risk değerlendirme limiti",
    description: "Toplam risk değerlendirme kapasitesi.",
  },
  "inspections.count_monthly": {
    label: "Aylık denetim limiti",
    description: "Her ay açılabilecek denetim sayısı.",
  },
  "storage.upload_mb_monthly": {
    label: "Aylık yükleme alanı",
    description: "Dosya ve görseller için depolama kapasitesi.",
  },
  "team.members": {
    label: "Ekip üyesi limiti",
    description: "Aynı organizasyonda aktif kullanıcı kapasitesi.",
  },
};

const FEATURE_CATALOG: BillingFeatureMeta[] = [
  {
    key: "bulk_capa.access",
    label: "Bulk CAPA",
    description: "Toplu görsel analiz, seri CAPA ve AI destekli aksiyon akışı.",
    category: "AI ve Otomasyon",
    kind: "access",
    icon: Brain,
  },
  {
    key: "ai.risk_generation_monthly",
    label: "AI risk üretimi",
    description: "Risk editörü ve sektör bazlı AI öneri kotası.",
    category: "AI ve Otomasyon",
    kind: "limit",
    icon: Brain,
  },
  {
    key: "ai.bulk_capa_analysis_monthly",
    label: "AI Bulk CAPA analizi",
    description: "Çoklu fotoğraf için aylık AI analiz limiti.",
    category: "AI ve Otomasyon",
    kind: "limit",
    icon: Brain,
  },
  {
    key: "ai.nace_analysis_monthly",
    label: "NACE AI analizi",
    description: "NACE sorgularında AI yorum ve risk öneri limiti.",
    category: "AI ve Otomasyon",
    kind: "limit",
    icon: Brain,
  },
  {
    key: "ai.evacuation_plan_monthly",
    label: "Tahliye planı AI",
    description: "Tahliye planı üretimi ve iyileştirme kotası.",
    category: "AI ve Otomasyon",
    kind: "limit",
    icon: Brain,
  },
  {
    key: "ai.evacuation_image_monthly",
    label: "Tahliye görseli AI",
    description: "Tahliye görseli üretimi için aylık kullanım limiti.",
    category: "AI ve Otomasyon",
    kind: "limit",
    icon: Brain,
  },
  {
    key: "reports.export_monthly",
    label: "Rapor dışa aktarma",
    description: "PDF/export işlemleri için aylık çıktı kapasitesi.",
    category: "Raporlama ve Çıktı",
    kind: "limit",
    icon: BarChart3,
  },
  {
    key: "blueprint_analyzer.access",
    label: "Blueprint Analyzer",
    description: "Plan, kroki ve yerleşim görseli yorumlama ekranı.",
    category: "Raporlama ve Çıktı",
    kind: "access",
    icon: Layers3,
  },
  {
    key: "certificates.monthly",
    label: "Sertifika üretimi",
    description: "Aylık üretilebilecek sertifika sayısı.",
    category: "Raporlama ve Çıktı",
    kind: "limit",
    icon: BarChart3,
  },
  {
    key: "form_builder.access",
    label: "Form Builder",
    description: "Özel kontrol formu ve kurumsal şablon tasarımı.",
    category: "Operasyon",
    kind: "access",
    icon: Layers3,
  },
  {
    key: "isg_bot.access",
    label: "ISG Bot",
    description: "Operasyon komutları ve danışman akışları.",
    category: "Operasyon",
    kind: "access",
    icon: Rocket,
  },
  {
    key: "osgb.access",
    label: "OSGB modülü",
    description: "OSGB dashboard, finans, kapasite ve belge ekranları.",
    category: "Operasyon",
    kind: "access",
    icon: Rocket,
  },
  {
    key: "companies.count",
    label: "Firma limiti",
    description: "Toplam yönetilebilir firma sayısı.",
    category: "Temel Limitler",
    kind: "limit",
    icon: LockKeyhole,
  },
  {
    key: "employees.count",
    label: "Çalışan limiti",
    description: "Toplam çalışan kaydı kapasitesi.",
    category: "Temel Limitler",
    kind: "limit",
    icon: LockKeyhole,
  },
  {
    key: "risk_assessments.count",
    label: "Risk değerlendirme limiti",
    description: "Toplam risk değerlendirme kapasitesi.",
    category: "Temel Limitler",
    kind: "limit",
    icon: LockKeyhole,
  },
  {
    key: "inspections.count_monthly",
    label: "Aylık denetim limiti",
    description: "Her ay açılabilecek denetim sayısı.",
    category: "Temel Limitler",
    kind: "limit",
    icon: LockKeyhole,
  },
  {
    key: "storage.upload_mb_monthly",
    label: "Aylık yükleme alanı",
    description: "Dosya ve görseller için depolama kapasitesi.",
    category: "Temel Limitler",
    kind: "limit",
    icon: LockKeyhole,
  },
  {
    key: "team.members",
    label: "Ekip üyesi limiti",
    description: "Aynı organizasyonda aktif kullanıcı kapasitesi.",
    category: "Temel Limitler",
    kind: "limit",
    icon: LockKeyhole,
  },
];

const CATEGORY_ORDER = ["AI ve Otomasyon", "Raporlama ve Çıktı", "Operasyon", "Temel Limitler"] as const;

const PLAN_PRESENTATION: Record<SubscriptionPlan, PlanPresentation> = {
  free: {
    audience: "Platformu denemek isteyen bireysel kullanıcılar",
    eligibility: "Herkes kullanabilir",
    usageModel: "Temel kayıtlar ve sınırlı kullanım",
    highlights: [
      "Temel İSG kayıtlarını oluşturma",
      "Sınırlı firma ve çalışan kapasitesi",
      "Premium AI, raporlama ve gelişmiş üretim araçları kapalı",
    ],
  },
  premium: {
    audience: "İSG uzmanları, danışmanlar ve aktif operasyon yürüten ekipler",
    eligibility: "Bireysel kullanıcılar ve organizasyon yöneticileri satın alabilir",
    usageModel: "AI, raporlama, analiz ve yüksek limitli profesyonel kullanım",
    highlights: [
      "AI destekli risk, DÖF ve NACE analizleri",
      "PDF/rapor çıktıları, sertifika üretimi ve gelişmiş üretim araçları",
      "Daha yüksek firma, çalışan, denetim ve dosya kullanım limitleri",
      "7 günlük Premium deneme ile risksiz başlangıç",
    ],
    demoLabel: "7 günlük ücretsiz Premium deneme",
    demoDescription: "Deneme yalnızca Premium paket içindir. OSGB modülü deneme kapsamına dahil değildir.",
  },
  osgb: {
    audience: "OSGB'ler, çoklu firma yöneten ekipler ve kurumsal operasyonlar",
    eligibility: "Organizasyon kaydı ve yönetici yetkisi gerekir",
    usageModel: "Premium özellikler + OSGB yönetim ekranları",
    highlights: [
      "Premium'un tüm özellikleri dahildir",
      "OSGB dashboard, finans, kapasite ve belge akışları açılır",
      "Ekip, çoklu firma ve kurumsal süreç yönetimi için tasarlanmıştır",
    ],
  },
};

function getFeatureDisplayLabel(feature: BillingFeatureMeta) {
  return FEATURE_TEXT_MAP[feature.key]?.label ?? feature.label;
}

function getFeatureDisplayDescription(feature: BillingFeatureMeta) {
  return FEATURE_TEXT_MAP[feature.key]?.description ?? feature.description;
}

function formatPrice(price: number | null, currency: string, period: BillingPeriod) {
  if (price === null) {
    return "Fiyat bilgisi yükleniyor";
  }

  if (price <= 0) {
    return "Ücretsiz";
  }

  const formatted = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency || "TRY",
    maximumFractionDigits: 0,
  }).format(price);

  return `${formatted}/${period === "yearly" ? "yıl" : "ay"}`;
}

function formatFeatureValue(enabled: boolean, limitValue: number | null, kind: BillingFeatureMeta["kind"]) {
  if (!enabled) {
    return "Yok";
  }

  if (kind === "access") {
    return "Var";
  }

  if (limitValue === null || limitValue >= 999999) {
    return "Limitsiz";
  }

  return `${limitValue}`;
}

function isPremiumPlan(planCode: string) {
  return planCode === "premium";
}

function isOsgbPlan(planCode: string) {
  return planCode === "osgb";
}

function getPlanDisplayPrice(entry?: BillingCatalogPlan) {
  return entry?.price ?? null;
}

function getUpgradeReason(triggeredBy: UpgradeModalProps["triggeredBy"], plan: SubscriptionPlan, status: string) {
  if (triggeredBy === "trial_expired") {
    return {
      title: "Deneme süreniz bitti",
      description:
        "Premium özellikleri kullanmaya devam etmek için ücretli plana geçebilirsiniz. Free planda temel özellikler açık kalır.",
      tone: "amber" as const,
    };
  }

  if (triggeredBy === "feature_locked") {
    return {
      title: "Açmak istediğiniz özellik mevcut planınızda yok",
      description:
        "Bu özellik Premium veya OSGB planıyla açılır. Aşağıda size en uygun planı, fiyatı ve kazanacağınız özellikleri görebilirsiniz.",
      tone: "cyan" as const,
    };
  }

  if (status === "trial") {
    return {
      title: "Premium denemeniz aktif",
      description:
        "Deneme süreniz bitmeden ücretli plana geçerek AI, raporlama ve gelişmiş analiz özelliklerini kesintisiz kullanabilirsiniz.",
      tone: "cyan" as const,
    };
  }

  if (plan === "premium" || plan === "osgb") {
    return {
      title: "Üyeliğiniz aktif",
      description:
        "Planınızın kapsadığı özellikleri ve daha üst paketlerde açılan ek modülleri bu ekrandan kontrol edebilirsiniz.",
      tone: "emerald" as const,
    };
  }

  return {
    title: "Daha fazla analiz, rapor ve AI aracı için yükseltin",
    description:
      "Free plan temel kullanım içindir. Premium ile AI destekli üretim araçları, gelişmiş rapor çıktıları ve daha yüksek kullanım limitleri açılır.",
    tone: "cyan" as const,
  };
}

function getReasonClassName(tone: "amber" | "cyan" | "emerald") {
  if (tone === "amber") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-50";
  }

  if (tone === "emerald") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-50";
  }

  return "border-cyan-400/25 bg-cyan-400/10 text-cyan-50";
}

function MiniFeature({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-2 text-sm leading-6 text-slate-200">
      <Check className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
      <span>{children}</span>
    </div>
  );
}

export function UpgradeModal({ open, onOpenChange, triggeredBy = "manual" }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const {
    plan,
    status,
    plans,
    entitlements,
    canStartTrial,
    isOrganizationAdmin,
    hasStripeSubscription,
    daysLeftInTrial,
    cancelAtPeriodEnd,
    refetch,
  } = useSubscription();

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const hasOrganization = Boolean(profile?.organization_id);
  const canManageBilling = hasOrganization ? isOrganizationAdmin : true;
  const canPurchasePremium = !hasOrganization || isOrganizationAdmin;
  const canPurchaseOsgb = hasOrganization && isOrganizationAdmin;
  const hasActivePremiumAccess = status === "trial" || plan === "premium" || plan === "osgb";
  const canStartTrialCta = canStartTrial && !hasActivePremiumAccess && canPurchasePremium;

  const freePlan = plans.find((entry) => entry.planCode === "free");
  const premiumPlan = plans.find((entry) => entry.planCode === "premium");
  const osgbPlan = plans.find((entry) => entry.planCode === "osgb");

  const freeFeatureMap = useMemo(
    () => new Map((freePlan?.features ?? []).map((feature) => [feature.featureKey, feature])),
    [freePlan],
  );

  const premiumFeatureMap = useMemo(
    () => new Map((premiumPlan?.features ?? []).map((feature) => [feature.featureKey, feature])),
    [premiumPlan],
  );

  const osgbFeatureMap = useMemo(
    () => new Map((osgbPlan?.features ?? []).map((feature) => [feature.featureKey, feature])),
    [osgbPlan],
  );

  const entitlementMap = useMemo(
    () => new Map(entitlements.map((feature) => [feature.featureKey, feature])),
    [entitlements],
  );

  const premiumOnlyOrExpanded = useMemo(() => {
    return FEATURE_CATALOG.filter((feature) => {
      const premiumFeature = premiumFeatureMap.get(feature.key);
      const freeFeature = freeFeatureMap.get(feature.key);

      if (!premiumFeature?.isEnabled) {
        return false;
      }

      if (!freeFeature?.isEnabled) {
        return true;
      }

      const premiumLimit = premiumFeature.limitValue ?? Number.POSITIVE_INFINITY;
      const freeLimit = freeFeature.limitValue ?? Number.POSITIVE_INFINITY;

      return premiumLimit > freeLimit;
    });
  }, [freeFeatureMap, premiumFeatureMap]);

  const groupedFeatures = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: FEATURE_CATALOG.filter((feature) => feature.category === category),
    })).filter((group) => group.items.length > 0);
  }, []);

  const upgradeReason = getUpgradeReason(triggeredBy, plan, status);
  const premiumPrice = formatPrice(getPlanDisplayPrice(premiumPlan), premiumPlan?.currency ?? "TRY", premiumPlan?.billingPeriod ?? "monthly");
  const osgbPrice = osgbPlan && getPlanDisplayPrice(osgbPlan) && getPlanDisplayPrice(osgbPlan)! > 0
    ? formatPrice(getPlanDisplayPrice(osgbPlan), osgbPlan.currency, osgbPlan.billingPeriod)
    : "Özel fiyat";

  const runAction = async (key: string, task: () => Promise<void>) => {
    setLoadingAction(key);

    try {
      await task();
    } catch (error) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTrialStart = () =>
    runAction("trial", async () => {
      await startPremiumTrial();
      await refreshProfile();
      await refetch();
      toast.success("7 günlük Premium deneme başlatıldı", {
        description: "Premium AI, analiz ve raporlama özelliklerini 7 gün boyunca deneyebilirsiniz.",
      });
    });

  const handleCheckout = (planCode: Extract<SubscriptionPlan, "premium" | "osgb">, billingPeriod: BillingPeriod) =>
    runAction(`checkout-${planCode}-${billingPeriod}`, async () => {
      await startPlanCheckout(planCode, billingPeriod);
    });

  const handleOpenOrganizationSetup = () => {
    onOpenChange(false);
    navigate(`/profile?tab=workspace&action=create&next=${encodeURIComponent("/settings?tab=billing&upgrade=1")}`);
    toast.info("Organizasyon kaydı gerekli", {
      description: "OSGB modülünü kullanmak veya satın almak için önce organizasyon oluşturmanız gerekir.",
    });
  };

  const handlePortal = () =>
    runAction("portal", async () => {
      await openBillingPortal();
    });

  const handleBackfill = () =>
    runAction("backfill", async () => {
      await backfillMyFeatureUsage();
      await refetch();
      toast.success("Kullanım sayaçları senkronize edildi", {
        description: "Mevcut kayıtlarınız abonelik limitleriyle eşitlendi.",
      });
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border border-slate-800 bg-slate-950 p-0 text-white shadow-2xl [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:border [&>button]:border-white/10 [&>button]:bg-white/5 [&>button]:p-1.5 [&>button]:text-slate-300 [&>button]:opacity-100 [&>button:hover]:bg-white/10 [&>button:hover]:text-white">
        <div className="p-5 md:p-7">
          <DialogHeader>
            <DialogTitle className="text-left">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 pr-14 md:p-6 md:pr-16">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 shadow-sm">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className="border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                        Premium yükseltme
                      </Badge>
                      {status === "trial" ? (
                        <Badge className="border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-100">
                          {daysLeftInTrial} gün deneme kaldı
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                      {triggeredBy === "feature_locked"
                        ? "Bu yetenek mevcut planınızda kapalı"
                        : triggeredBy === "trial_expired"
                          ? "Premium erişiminizi kesintisiz sürdürün"
                          : "İSG süreçlerinizi profesyonel plana taşıyın"}
                    </p>
                    <p className="mt-3 max-w-3xl text-sm font-normal leading-6 text-slate-300 md:text-base">
                      AI destekli analizler, gelişmiş rapor çıktıları ve daha yüksek kullanım limitleriyle operasyonunuzu tek ekrandan daha verimli yönetin.
                    </p>
                  </div>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 space-y-5">
            <section className={`rounded-[24px] border p-5 ${getReasonClassName(upgradeReason.tone)}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950/40">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-75">1. Neden upgrade gerekiyor?</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{upgradeReason.title}</h3>
                  <p className="mt-1 text-sm leading-6 opacity-90">{upgradeReason.description}</p>
                </div>
              </div>
            </section>

            {hasOrganization && !isOrganizationAdmin && (
              <section className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-5 text-sm leading-6 text-rose-100">
                Üyelik ve faturalama işlemlerini yalnızca organizasyon yöneticisi başlatabilir. Planları inceleyebilirsiniz, fakat satın alma için yönetici hesabı gerekir.
              </section>
            )}

            <section className="grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
              <div className="rounded-[30px] border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.22),transparent_38%),linear-gradient(180deg,rgba(168,85,247,0.14),rgba(15,23,42,0.62))] p-6 shadow-[0_24px_70px_rgba(168,85,247,0.14)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-cyan-500 text-white">
                      <Crown className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold text-white">Premium</h3>
                        <Badge className="bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 py-1 text-white">Önerilen</Badge>
                      </div>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{PLAN_PRESENTATION.premium.audience}</p>
                    </div>
                  </div>

                  {premiumPlan?.isCurrent || plan === "premium" ? (
                    <Badge className="border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">Aktif plan</Badge>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-[0.92fr_1.08fr]">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200/80">2. En iyi seçenek hangisi?</p>
                    <p className="mt-3 text-lg font-semibold text-white">Çoğu kullanıcı için Premium</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      AI, raporlama ve yüksek limitler istiyorsanız en doğrudan seçenek Premium’dur. OSGB yalnızca kurumsal/organizasyonlu kullanımda gerekir.
                    </p>

                    <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                      <p className="text-sm font-semibold text-amber-50">{PLAN_PRESENTATION.premium.demoLabel}</p>
                      <p className="mt-1 text-sm leading-6 text-amber-50/90">{PLAN_PRESENTATION.premium.demoDescription}</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">3. Ne kazanacağım?</p>
                    <div className="mt-4 space-y-3">
                      {PLAN_PRESENTATION.premium.highlights.map((item) => (
                        <MiniFeature key={item}>{item}</MiniFeature>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-[0.62fr_1.38fr] md:items-center">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">4. Fiyat ne?</p>
                    <p className="mt-2 text-4xl font-semibold text-white">{premiumPrice}</p>
                    <p className="mt-2 text-sm text-slate-400">Premium aylık plan</p>
                  </div>

                  <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">5. Hemen ne yapacağım?</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Button
                        onClick={() => void handleCheckout("premium", "monthly")}
                        disabled={loadingAction !== null || !canPurchasePremium}
                        className="h-12 bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white hover:from-fuchsia-500 hover:to-cyan-400"
                      >
                        {loadingAction === "checkout-premium-monthly" ? "Hazırlanıyor..." : "Premium’a geç"}
                      </Button>

                      {canStartTrialCta ? (
                        <Button
                          variant="outline"
                          onClick={() => void handleTrialStart()}
                          disabled={loadingAction !== null}
                          className="h-12 border-amber-300/30 bg-amber-400/10 text-amber-50 hover:bg-amber-400/20 hover:text-white"
                        >
                          {loadingAction === "trial" ? "Başlatılıyor..." : "7 gün ücretsiz dene"}
                        </Button>
                      ) : (
                        <Button disabled className="h-12 bg-slate-800 text-slate-300 hover:bg-slate-800">
                          {status === "trial"
                            ? `${daysLeftInTrial} gün deneme kaldı`
                            : plan === "premium" || plan === "osgb"
                              ? "Premium erişim aktif"
                              : "Deneme hakkı kullanılmış"}
                        </Button>
                      )}
                    </div>
                    {!canPurchasePremium ? (
                      <p className="mt-3 text-xs leading-5 text-cyan-100/80">Satın alma işlemi için organizasyon yöneticisi hesabı gerekir.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950/60 text-slate-200">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">Free</h3>
                        {freePlan?.isCurrent || plan === "free" ? (
                          <Badge className="border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">Mevcut plan</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">Temel kullanım için uygundur. AI, gelişmiş rapor ve yüksek limitler kapalıdır.</p>
                      <p className="mt-4 text-2xl font-semibold text-white">Ücretsiz</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-cyan-400/15 bg-cyan-500/10 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950/60 text-cyan-200">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">OSGB</h3>
                        <Badge className="border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">Kurumsal</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">Premium özelliklerine ek olarak OSGB dashboard, finans, kapasite ve belge akışlarını açar.</p>
                      <p className="mt-4 text-2xl font-semibold text-white">{osgbPrice}</p>
                      <div className="mt-4 space-y-2">
                        {PLAN_PRESENTATION.osgb.highlights.slice(0, 3).map((item) => (
                          <MiniFeature key={item}>{item}</MiniFeature>
                        ))}
                      </div>

                      <div className="mt-5">
                        {!hasOrganization ? (
                          <Button
                            onClick={handleOpenOrganizationSetup}
                            disabled={loadingAction !== null}
                            className="w-full bg-gradient-to-r from-cyan-600 to-blue-500 text-white hover:from-cyan-500 hover:to-blue-400"
                          >
                            Organizasyon oluştur
                          </Button>
                        ) : (
                          <Button
                            onClick={() => void handleCheckout("osgb", "monthly")}
                            disabled={loadingAction !== null || !canPurchaseOsgb}
                            className="w-full bg-gradient-to-r from-cyan-600 to-blue-500 text-white hover:from-cyan-500 hover:to-blue-400"
                          >
                            {loadingAction === "checkout-osgb-monthly" ? "Hazırlanıyor..." : "OSGB planını seç"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950/60 text-cyan-300">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Abonelik özeti</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {status === "trial"
                          ? `${daysLeftInTrial} gün daha Premium özellikleri deneyebilirsiniz.`
                          : plan === "premium" || plan === "osgb"
                            ? cancelAtPeriodEnd
                              ? "Aboneliğiniz dönem sonunda iptale ayarlı, ancak erişiminiz şu an aktif."
                              : "Ücretli plan erişiminiz aktif."
                            : "Şu anda Free plan kullanıyorsunuz."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">6. Detayları istersem nerede görürüm?</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Tüm özellikleri ve limitleri karşılaştırın</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Karar vermek için önce Premium kartı yeterli olmalı. Daha teknik karşılaştırma gerektiğinde tabloyu buradan açabilirsiniz.
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowComparison((value) => !value)}
                  className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                >
                  {showComparison ? "Karşılaştırmayı gizle" : "Tüm özellikleri karşılaştır"}
                  {showComparison ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                </Button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {premiumOnlyOrExpanded.slice(0, 6).map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div key={feature.key} className="rounded-2xl border border-fuchsia-400/10 bg-slate-950/45 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{getFeatureDisplayLabel(feature)}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{getFeatureDisplayDescription(feature)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {showComparison ? (
                <div className="mt-6 space-y-5">
                  {groupedFeatures.map((group) => (
                    <div key={group.category} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">{group.category}</p>
                        <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">{group.items.length} kalem</Badge>
                      </div>

                      <div className="space-y-3">
                        {group.items.map((feature) => {
                          const freeFeature = freeFeatureMap.get(feature.key);
                          const premiumFeature = premiumFeatureMap.get(feature.key);
                          const osgbFeature = osgbFeatureMap.get(feature.key);
                          const currentFeature = entitlementMap.get(feature.key);
                          const Icon = feature.icon;

                          return (
                            <div
                              key={feature.key}
                              className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 lg:grid-cols-[1.35fr_0.5fr_0.5fr_0.5fr_0.46fr] lg:items-center"
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-slate-200">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-white">{getFeatureDisplayLabel(feature)}</p>
                                  <p className="mt-1 text-xs leading-5 text-slate-400">{getFeatureDisplayDescription(feature)}</p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Free</p>
                                <p className="mt-2 text-sm font-semibold text-slate-100">
                                  {formatFeatureValue(Boolean(freeFeature?.isEnabled), freeFeature?.limitValue ?? null, feature.kind)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-fuchsia-200/70">Premium</p>
                                <p className="mt-2 text-sm font-semibold text-white">
                                  {formatFeatureValue(Boolean(premiumFeature?.isEnabled), premiumFeature?.limitValue ?? null, feature.kind)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/70">OSGB</p>
                                <p className="mt-2 text-sm font-semibold text-white">
                                  {formatFeatureValue(Boolean(osgbFeature?.isEnabled), osgbFeature?.limitValue ?? null, feature.kind)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/70">Hesabınız</p>
                                <p className="mt-2 text-sm font-semibold text-cyan-50">{currentFeature?.allowed ? "Aktif" : "Kilitli"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            {(hasStripeSubscription || plan === "premium" || plan === "osgb") || canManageBilling ? (
              <section className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Faturalama ve teknik işlemler</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">Satın alma kararından bağımsız yönetim işlemleri burada tutulur.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(hasStripeSubscription || plan === "premium" || plan === "osgb") && (
                      <Button
                        variant="outline"
                        onClick={() => void handlePortal()}
                        disabled={loadingAction !== null || !canManageBilling}
                        className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                      >
                        {loadingAction === "portal" ? "Portal açılıyor..." : "Aboneliği yönet"}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => void handleBackfill()}
                      disabled={loadingAction !== null || !canManageBilling}
                      className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                    >
                      {loadingAction === "backfill" ? "Senkronize ediliyor..." : "Limit sayaçlarını eşitle"}
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
