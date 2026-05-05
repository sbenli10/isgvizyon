import { useEffect, useMemo, useState } from "react";
import { Crown, ShieldCheck, Sparkles, X, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "subscription-banner-dismissed";
const PREMIUM_PRICE_FALLBACK = 250;

type BannerVariant =
  | "free"
  | "trial"
  | "trial_expired"
  | "premium"
  | "premium_canceling"
  | "past_due";

type BannerCopy = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  surfaceClassName: string;
  badgeClassName: string;
  iconWrapClassName: string;
  iconClassName: string;
  statText: string;
  icon: typeof Crown;
  trigger: "manual" | "trial_expired" | "feature_locked";
};

function formatDate(value: Date | null) {
  if (!value) return null;
  return value.toLocaleDateString("tr-TR");
}

function buildBannerCopy(
  variant: BannerVariant,
  premiumPrice: number,
  daysLeftInTrial: number,
  currentPeriodEnd: Date | null,
  planLabel: string,
): BannerCopy {
  const formattedPrice = `₺${premiumPrice.toLocaleString("tr-TR")}/ay`;
  const endDate = formatDate(currentPeriodEnd);

  const baseSurface =
    "border-border/60 bg-background/80 text-foreground shadow-[0_26px_90px_-46px_rgba(15,23,42,0.22)]";

  switch (variant) {
    case "trial":
      return {
        eyebrow: "Premium Deneme",
        title: `Denemenizde ${daysLeftInTrial} gün kaldı`,
        description:
          "Tüm premium modüller şu anda açık. Süre bitmeden planınızı seçerek erişimi kesintisiz sürdürebilirsiniz.",
        cta: "Planı İncele",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(43_96%_56%/0.18),_transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))] dark:bg-[radial-gradient(circle_at_top_left,_hsl(43_96%_56%/0.18),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))]",
        ),
        badgeClassName:
          "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        iconWrapClassName: "bg-amber-500/10 ring-1 ring-amber-500/20",
        iconClassName: "text-amber-700 dark:text-amber-200",
        statText: `${daysLeftInTrial} gün aktif deneme`,
        icon: Sparkles,
        trigger: "manual",
      };

    case "trial_expired":
      return {
        eyebrow: "Deneme Bitti",
        title: "Premium denemeniz sona erdi",
        description: `Bulk CAPA, gelişmiş AI araçları ve yüksek limitleri yeniden açmak için Premium plana ${formattedPrice} ile geçebilirsiniz.`,
        cta: "Premium'a Geç",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(346_84%_61%/0.16),_transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))] dark:bg-[radial-gradient(circle_at_top_left,_hsl(346_84%_61%/0.16),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))]",
        ),
        badgeClassName:
          "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-200",
        iconWrapClassName: "bg-rose-500/10 ring-1 ring-rose-500/20",
        iconClassName: "text-rose-700 dark:text-rose-200",
        statText: "Yükseltme öneriliyor",
        icon: Crown,
        trigger: "trial_expired",
      };

    case "premium":
      return {
        eyebrow: `${planLabel} Aktif`,
        title: `Tüm ${planLabel.toLocaleLowerCase("tr-TR")} araçları hesabınızda açık`,
        description:
          "Yüksek AI kotaları, premium modüller ve genişletilmiş limitler şu anda kullanılabilir. Faturalama detaylarını istediğiniz zaman yönetebilirsiniz.",
        cta: "Üyeliği Yönet",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(142_76%_36%/0.18),_transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))] dark:bg-[radial-gradient(circle_at_top_left,_hsl(142_76%_36%/0.18),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))]",
        ),
        badgeClassName:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        iconWrapClassName: "bg-emerald-500/10 ring-1 ring-emerald-500/20",
        iconClassName: "text-emerald-700 dark:text-emerald-200",
        statText: `${planLabel} koruma açık`,
        icon: ShieldCheck,
        trigger: "manual",
      };

    case "premium_canceling":
      return {
        eyebrow: "Üyelik Uyarısı",
        title: endDate
          ? `${planLabel} erişim ${endDate} tarihinde kapanacak`
          : `${planLabel} erişim dönem sonunda kapanacak`,
        description:
          "Dönem sonrasında premium modülleri kaybetmemek için abonelik ayarlarınızı gözden geçirmeniz iyi olur.",
        cta: "Aboneliği Yönet",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(24_94%_50%/0.16),_transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))] dark:bg-[radial-gradient(circle_at_top_left,_hsl(24_94%_50%/0.16),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))]",
        ),
        badgeClassName:
          "border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-200",
        iconWrapClassName: "bg-orange-500/10 ring-1 ring-orange-500/20",
        iconClassName: "text-orange-700 dark:text-orange-200",
        statText: endDate ? `${endDate} tarihinde kapanır` : "Dönem sonunda kapanır",
        icon: Crown,
        trigger: "manual",
      };

    case "past_due":
      return {
        eyebrow: "Ödeme Sorunu",
        title: `${planLabel} faturalama güncellemesi gerekiyor`,
        description:
          `Ödeme alınamadı. ${planLabel} erişiminizin kesintiye uğramaması için faturalama bilgilerinizi güncelleyin.`,
        cta: "Faturalamayı Yönet",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(0_84%_60%/0.16),_transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))] dark:bg-[radial-gradient(circle_at_top_left,_hsl(0_84%_60%/0.16),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))]",
        ),
        badgeClassName: "border-destructive/25 bg-destructive/10 text-destructive",
        iconWrapClassName: "bg-destructive/10 ring-1 ring-destructive/20",
        iconClassName: "text-destructive",
        statText: "Ödeme takibi gerekli",
        icon: Crown,
        trigger: "manual",
      };

    case "free":
    default:
      return {
        eyebrow: "Premium Fırsatı",
        title: `Premium şimdi ${formattedPrice}`,
        description:
          "Bulk CAPA, gelişmiş AI araçları, geniş export kapasitesi ve daha yüksek operasyon limitleri tek planda açılır.",
        cta: "Premium'u İncele",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(292_84%_60%/0.16),_transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))] dark:bg-[radial-gradient(circle_at_top_left,_hsl(292_84%_60%/0.16),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))]",
        ),
        badgeClassName:
          "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200",
        iconWrapClassName: "bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20",
        iconClassName: "text-fuchsia-700 dark:text-fuchsia-200",
        statText: `${formattedPrice} başlangıç`,
        icon: Crown,
        trigger: "manual",
      };
  }
}

export function SubscriptionBanner() {
  const {
    loading,
    plan,
    status,
    isPaidPlan,
    plans,
    daysLeftInTrial,
    isTrialExpired,
    cancelAtPeriodEnd,
    currentPeriodEnd,
  } = useSubscription();

  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const premiumPlan = plans.find((entry) => entry.planCode === "premium");
  const premiumPrice = premiumPlan?.price ?? PREMIUM_PRICE_FALLBACK;
  const activePlanLabel = plan === "osgb" ? "OSGB" : "Premium";

  const variant = useMemo<BannerVariant | null>(() => {
    if (loading) return null;
    if (status === "past_due") return "past_due";
    if (status === "trial" && isTrialExpired) return "trial_expired";
    if (status === "trial") return "trial";
    if (isPaidPlan && cancelAtPeriodEnd) return "premium_canceling";
    if (isPaidPlan) return "premium";
    return "free";
  }, [cancelAtPeriodEnd, isPaidPlan, isTrialExpired, loading, status]);

  const bannerKey = useMemo(() => {
    if (!variant) return null;
    return [variant, premiumPrice, daysLeftInTrial, formatDate(currentPeriodEnd)].join(":");
  }, [variant, premiumPrice, daysLeftInTrial, currentPeriodEnd]);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    setDismissedKey(stored);
  }, []);

  useEffect(() => {
    if (!bannerKey) return;
    if (dismissedKey && dismissedKey !== bannerKey) {
      localStorage.removeItem(DISMISS_KEY);
      setDismissedKey(null);
    }
  }, [bannerKey, dismissedKey]);

  if (!variant || !bannerKey || dismissedKey === bannerKey) return null;

  const copy = buildBannerCopy(variant, premiumPrice, daysLeftInTrial, currentPeriodEnd, activePlanLabel);
  const Icon = copy.icon;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, bannerKey);
    setDismissedKey(bannerKey);
  };

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-[26px] border px-4 py-4 backdrop-blur-2xl lg:px-5 lg:py-5",
          copy.surfaceClassName,
        )}
      >
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.30),transparent_60%)] lg:block dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)]" />

        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] shadow-sm",
                copy.iconWrapClassName,
              )}
            >
              <Icon className={cn("h-5 w-5", copy.iconClassName)} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {copy.eyebrow}
                </p>

                <Badge className={cn("rounded-full px-3 py-1 shadow-none", copy.badgeClassName)}>
                  {variant === "premium" ? "Aktif" : variant === "trial" ? "Deneme" : "Öne Çıkan"}
                </Badge>
              </div>

              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground lg:text-xl">
                {copy.title}
              </p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {copy.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[290px] xl:items-end">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-2 text-xs font-medium text-foreground/80 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {copy.statText}
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button
                onClick={() => setShowUpgradeModal(true)}
                className="h-10 gap-2 rounded-2xl px-4 shadow-sm"
              >
                {copy.cta}
                <ArrowUpRight className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                onClick={handleDismiss}
                className="h-10 rounded-2xl border border-border/60 px-4 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                Kapat
              </Button>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        triggeredBy={copy.trigger}
      />
    </>
  );
}
