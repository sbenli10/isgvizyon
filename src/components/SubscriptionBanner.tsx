import { useEffect, useMemo, useState } from "react";
import { Crown, ShieldCheck, Sparkles, X } from "lucide-react";
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
  // style tokens (theme-safe)
  surfaceClassName: string;
  badgeClassName: string;
  iconWrapClassName: string;
  iconClassName: string;
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
): BannerCopy {
  const formattedPrice = `₺${premiumPrice.toLocaleString("tr-TR")}/ay`;
  const endDate = formatDate(currentPeriodEnd);

  // Common surface: card + subtle gradient overlay, no hardcoded white/black text.
  const baseSurface =
    "bg-card text-foreground border-border shadow-[0_18px_50px_rgba(15,23,42,0.10)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.45)]";

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
          "bg-[radial-gradient(circle_at_top_left,_hsl(43_96%_56%/0.18),_transparent_40%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))]",
        ),
        badgeClassName:
          "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        iconWrapClassName: "bg-amber-500/10 ring-1 ring-amber-500/20",
        iconClassName: "text-amber-700 dark:text-amber-200",
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
          "bg-[radial-gradient(circle_at_top_left,_hsl(346_84%_61%/0.18),_transparent_42%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))]",
        ),
        badgeClassName:
          "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-200",
        iconWrapClassName: "bg-rose-500/10 ring-1 ring-rose-500/20",
        iconClassName: "text-rose-700 dark:text-rose-200",
        icon: Crown,
        trigger: "trial_expired",
      };

    case "premium":
      return {
        eyebrow: "Premium Aktif",
        title: "Tüm premium araçlar hesabınızda açık",
        description:
          "Yüksek AI kotaları, premium modüller ve genişletilmiş limitler şu anda kullanılabilir. Faturalama detaylarını istediğiniz zaman yönetebilirsiniz.",
        cta: "Üyeliği Yönet",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(142_76%_36%/0.18),_transparent_42%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))]",
        ),
        badgeClassName:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        iconWrapClassName: "bg-emerald-500/10 ring-1 ring-emerald-500/20",
        iconClassName: "text-emerald-700 dark:text-emerald-200",
        icon: ShieldCheck,
        trigger: "manual",
      };

    case "premium_canceling":
      return {
        eyebrow: "Üyelik Uyarısı",
        title: endDate
          ? `Premium erişim ${endDate} tarihinde kapanacak`
          : "Premium erişim dönem sonunda kapanacak",
        description:
          "Dönem sonrasında premium modülleri kaybetmemek için abonelik ayarlarını gözden geçirmeniz iyi olur.",
        cta: "Aboneliği Yönet",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(24_94%_50%/0.16),_transparent_42%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))]",
        ),
        badgeClassName:
          "border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-200",
        iconWrapClassName: "bg-orange-500/10 ring-1 ring-orange-500/20",
        iconClassName: "text-orange-700 dark:text-orange-200",
        icon: Crown,
        trigger: "manual",
      };

    case "past_due":
      return {
        eyebrow: "Ödeme Sorunu",
        title: "Premium faturalama güncellemesi gerekiyor",
        description:
          "Ödeme alınamadı. Premium erişiminizin kesintiye uğramaması için faturalama bilgilerinizi güncelleyin.",
        cta: "Faturalamayı Yönet",
        surfaceClassName: cn(
          baseSurface,
          "bg-[radial-gradient(circle_at_top_left,_hsl(0_84%_60%/0.16),_transparent_42%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))]",
        ),
        badgeClassName:
          "border-destructive/25 bg-destructive/10 text-destructive",
        iconWrapClassName: "bg-destructive/10 ring-1 ring-destructive/20",
        iconClassName: "text-destructive",
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
          "bg-[radial-gradient(circle_at_top_left,_hsl(292_84%_60%/0.16),_transparent_42%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))]",
        ),
        badgeClassName:
          "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200",
        iconWrapClassName: "bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20",
        iconClassName: "text-fuchsia-700 dark:text-fuchsia-200",
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

  const variant = useMemo<BannerVariant | null>(() => {
    if (loading) return null;
    if (status === "past_due") return "past_due";
    if (status === "trial" && isTrialExpired) return "trial_expired";
    if (status === "trial") return "trial";
    if (plan === "premium" && cancelAtPeriodEnd) return "premium_canceling";
    if (plan === "premium") return "premium";
    return "free";
  }, [cancelAtPeriodEnd, isTrialExpired, loading, plan, status]);

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

  const copy = buildBannerCopy(variant, premiumPrice, daysLeftInTrial, currentPeriodEnd);
  const Icon = copy.icon;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, bannerKey);
    setDismissedKey(bannerKey);
  };

  return (
    <>
      <div
        className={cn(
          "rounded-[24px] border px-4 py-4",
          "backdrop-blur-sm",
          copy.surfaceClassName,
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                copy.iconWrapClassName,
              )}
            >
              <Icon className={cn("h-5 w-5", copy.iconClassName)} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {copy.eyebrow}
                </p>

                <Badge className={cn("rounded-full px-3 py-1", copy.badgeClassName)}>
                  {variant === "premium" ? "Aktif" : variant === "trial" ? "Deneme" : "Avantajlı"}
                </Badge>
              </div>

              <p className="mt-2 text-lg font-semibold text-foreground">{copy.title}</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {copy.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button onClick={() => setShowUpgradeModal(true)} className="gap-2">
              {copy.cta}
            </Button>

            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="gap-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
              Kapat
            </Button>
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