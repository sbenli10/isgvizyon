import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Brain,
  Check,
  Crown,
  Layers3,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  Sparkles,
  X,
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

const CATEGORY_ORDER = [
  "AI ve Otomasyon",
  "Raporlama ve Çıktı",
  "Operasyon",
  "Temel Limitler",
] as const;

const PREMIUM_MONTHLY_PRICE = 250;

function formatPrice(price: number | null, currency: string, period: BillingPeriod) {
  if (!price || price <= 0) {
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
    return "Kapalı";
  }

  if (kind === "access") {
    return "Açık";
  }

  if (limitValue === null || limitValue >= 999999) {
    return "Sınırsız";
  }

  return `${limitValue}`;
}

function isPremiumPlan(planCode: string) {
  return planCode === "premium";
}

function isOsgbPlan(planCode: string) {
  return planCode === "osgb";
}

function getPlanDisplayPrice(entry: BillingCatalogPlan) {
  if (entry.planCode === "premium") {
    return PREMIUM_MONTHLY_PRICE;
  }

  return entry.price;
}

export function UpgradeModal({ open, onOpenChange, triggeredBy = "manual" }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
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
  const hasOrganization = Boolean(profile?.organization_id);

  const freePlan = plans.find((entry) => entry.planCode === "free");
  const premiumPlan = plans.find((entry) => entry.planCode === "premium");
  const osgbPlan = plans.find((entry) => entry.planCode === "osgb");
  const planCards = useMemo(
    () => [freePlan, premiumPlan, osgbPlan].filter(Boolean) as BillingCatalogPlan[],
    [freePlan, premiumPlan, osgbPlan],
  );
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

  const runAction = async (key: string, task: () => Promise<void>) => {
    setLoadingAction(key);
    try {
      await task();
    } catch (error) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
      return;
      const message = error instanceof Error ? error.message : "İşlem tamamlanamadı.";
      toast.error("İşlem tamamlanamadı", { description: message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTrialStart = () =>
    runAction("trial", async () => {
      await startPremiumTrial();
      await refetch();
      toast.success("7 günlük premium deneme başlatıldı", {
        description: "Tüm premium özellikleri bu süre boyunca deneyebilirsiniz.",
      });
    });

  const handleCheckout = (planCode: Extract<SubscriptionPlan, "premium" | "osgb">, billingPeriod: BillingPeriod) =>
    runAction(`checkout-${planCode}-${billingPeriod}`, async () => {
      await startPlanCheckout(planCode, billingPeriod);
    });

  const handleOpenOrganizationSetup = () => {
    onOpenChange(false);
    navigate(`/profile?tab=workspace&action=create&next=${encodeURIComponent("/settings?tab=billing&upgrade=1")}`);
    toast.info("Organizasyon kaydı gerekli.", {
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
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border border-cyan-400/20 bg-[linear-gradient(160deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] text-white shadow-[0_30px_90px_rgba(8,145,178,0.16)]">
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between gap-4 text-left text-2xl font-semibold text-white">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-cyan-500 text-white shadow-[0_14px_32px_rgba(34,211,238,0.18)]">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p>Faturalama ve üyelik yönetimi</p>
                <p className="mt-2 text-sm font-normal leading-6 text-slate-300">
                  Free, Premium ve OSGB planlarını bütün modüller, limitler ve kilitli araçlar üzerinden karşılaştırın. Kullanıcı burada neyin açıldığını ve hangi pakette açıldığını net görür.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {triggeredBy === "trial_expired" && (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
            Deneme süreniz sona erdi. Aynı ekrandan uygun ücretli plana geçebilir veya Free planda devam edebilirsiniz.
          </div>
        )}

        {triggeredBy === "feature_locked" && (
          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-4 text-sm text-cyan-100">
            Açmaya çalıştığınız özellik mevcut planınızda kapalı ya da limitiniz dolmuş. Aşağıdaki karşılaştırma tablosu tam olarak hangi modülde ne açıldığını gösterir.
          </div>
        )}

        {!isOrganizationAdmin && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            Üyelik ve faturalama işlemlerini yalnızca organizasyon yöneticisi başlatabilir. Bilgileri görebilir, fakat satın alma ve iptal işlemleri için yönetici hesabına geçmeniz gerekir.
          </div>
        )}

        {!hasOrganization && (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
            OSGB modülünü aktifleştirmek için bir kurum kaydı oluşturmanız gerekmektedir.
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              {planCards.map((entry) => {
                const premium = isPremiumPlan(entry.planCode);
                const osgb = isOsgbPlan(entry.planCode);
                const current = entry.isCurrent;
                const displayPrice = getPlanDisplayPrice(entry);

                return (
                  <div
                    key={entry.planCode}
                    className={`rounded-[28px] border p-6 ${
                      premium
                        ? "border-fuchsia-400/25 bg-[linear-gradient(180deg,rgba(168,85,247,0.14),rgba(15,23,42,0.4))]"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                            premium
                              ? "bg-gradient-to-br from-fuchsia-600 to-cyan-500"
                              : "bg-gradient-to-br from-slate-700 to-slate-900"
                          }`}
                        >
                          {premium ? <Crown className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                        </div>
                        <div>
                          <p className="text-xl font-semibold text-white">{entry.planName}</p>
                          <p className="text-sm text-slate-300">
                            {entry.description || (osgb ? "Çoklu firma ve OSGB operasyonları için." : premium ? "Kurumsal ekipler ve yüksek hacimli kullanım için." : "Temel kullanım ve kontrollü başlangıç için.")}
                          </p>
                        </div>
                      </div>
                      {current ? (
                        <Badge className="border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                          Aktif
                        </Badge>
                      ) : premium || osgb ? (
                        <div className="flex items-center gap-2">
                          {premium ? (
                            <Badge className="bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 py-1 text-white">
                              Avantajlı fiyat
                            </Badge>
                          ) : null}
                          <Badge className="border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">
                            {osgb ? "OSGB paketi" : "Önerilen"}
                          </Badge>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-6">
                      <p className="text-3xl font-semibold text-white">
                        {osgb && (!displayPrice || displayPrice <= 0)
                          ? "Özel fiyat"
                          : formatPrice(displayPrice, entry.currency, entry.billingPeriod)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                        {entry.billingPeriod === "yearly" ? "yıllık plan" : "aylık plan"}
                      </p>
                    </div>

                    {premium || osgb ? (
                      <div className="mt-6 space-y-3">
                        {osgb && !hasOrganization ? (
                          <Button
                            onClick={handleOpenOrganizationSetup}
                            disabled={loadingAction !== null}
                            className="w-full bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white hover:from-fuchsia-500 hover:to-cyan-400"
                          >
                            Şimdi Organizasyon Oluştur
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={() => void handleCheckout(osgb ? "osgb" : "premium", "monthly")}
                              disabled={loadingAction !== null || !isOrganizationAdmin}
                              className="w-full bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white hover:from-fuchsia-500 hover:to-cyan-400"
                            >
                              {loadingAction === `checkout-${osgb ? "osgb" : "premium"}-monthly`
                                ? "Hazırlanıyor..."
                                : osgb
                                  ? "OSGB paketini seç"
                                  : "Premium aylık satın al"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void handleCheckout(osgb ? "osgb" : "premium", "yearly")}
                              disabled={loadingAction !== null || !isOrganizationAdmin}
                              className="w-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                            >
                              {loadingAction === `checkout-${osgb ? "osgb" : "premium"}-yearly`
                                ? "Hazırlanıyor..."
                                : osgb
                                  ? "OSGB yıllık planı seç"
                                  : "Premium yıllık satın al"}
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-6">
                        <Button variant="outline" disabled className="w-full border-white/10 bg-white/5 text-slate-300">
                          Free plan çekirdek erişim
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Üst planlarla açılanlar</p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                {premiumOnlyOrExpanded.length} başlıkta fark var
              </h3>
              <div className="mt-4 space-y-3">
                {premiumOnlyOrExpanded.slice(0, 6).map((feature) => {
                  const Icon = feature.icon;
                  const freeFeature = freeFeatureMap.get(feature.key);
                  const premiumFeature = premiumFeatureMap.get(feature.key);
                  const osgbFeature = osgbFeatureMap.get(feature.key);

                  return (
                    <div key={feature.key} className="rounded-2xl border border-fuchsia-400/10 bg-[linear-gradient(180deg,rgba(168,85,247,0.08),rgba(15,23,42,0.26))] p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{feature.label}</p>
                            <Badge className="border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-100">
                              Free: {formatFeatureValue(Boolean(freeFeature?.isEnabled), freeFeature?.limitValue ?? null, feature.kind)}
                            </Badge>
                            <Badge className="border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">
                              Premium: {formatFeatureValue(Boolean(premiumFeature?.isEnabled), premiumFeature?.limitValue ?? null, feature.kind)}
                            </Badge>
                            <Badge className="border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                              OSGB: {formatFeatureValue(Boolean(osgbFeature?.isEnabled), osgbFeature?.limitValue ?? null, feature.kind)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-fuchsia-300/80">Hızlı işlemler</p>
              <div className="mt-4 space-y-3">
                {canStartTrial && (
                  <Button
                    onClick={() => void handleTrialStart()}
                    disabled={loadingAction !== null || !isOrganizationAdmin}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400"
                  >
                    {loadingAction === "trial" ? "Başlatılıyor..." : "7 günlük premium denemeyi başlat"}
                  </Button>
                )}

                {(hasStripeSubscription || plan === "premium" || plan === "osgb") && (
                  <Button
                    variant="outline"
                    onClick={() => void handlePortal()}
                    disabled={loadingAction !== null || !isOrganizationAdmin}
                    className="w-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                  >
                    {loadingAction === "portal" ? "Portal açılıyor..." : hasStripeSubscription ? "Stripe portalında aboneliği yönet" : "Faturalama durumunu görüntüle"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => void handleBackfill()}
                  disabled={loadingAction !== null || !isOrganizationAdmin}
                  className="w-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                >
                  {loadingAction === "backfill" ? "Senkronize ediliyor..." : "Mevcut kayıtları limit sayaçlarına eşitle"}
                </Button>
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan-400/15 bg-cyan-400/10 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950/60 text-cyan-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Abonelik özeti</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {status === "trial"
                      ? `${daysLeftInTrial} gün daha tüm premium modülleri deneyebilirsiniz.`
                      : plan === "premium" || plan === "osgb"
                        ? cancelAtPeriodEnd
                          ? "Aboneliğiniz dönem sonunda iptale ayarlı, ancak şu an tüm premium modüller açık."
                          : "Premium araçlar ve yüksek limitler hesabınızda aktif."
                        : "Free plan ile temel modüller açık, detaylı farklar sağ taraftaki tabloda listeleniyor."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300/80">Detaylı karşılaştırma</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Hangi ekranda ne açılıyor, hangi limit ne kadar artıyor?</h2>
              <p className="mt-1 text-sm text-slate-400">
                Her satırda Free ve ücretli plan değerlerini birlikte görürsünüz. Son sütun, mevcut hesabınızda özelliğin açık mı kilitli mi olduğunu gösterir.
              </p>
            </div>

            <div className="space-y-5">
              {groupedFeatures.map((group) => (
                <div key={group.category} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">{group.category}</p>
                    <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                      {group.items.length} kalem
                    </Badge>
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
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-200">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">{feature.label}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-400">{feature.description}</p>
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
                            <p className="mt-2 text-sm font-semibold text-cyan-50">
                              {currentFeature?.allowed ? "Aktif" : "Kilitli"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
