import { useEffect, useMemo, useState } from "react";
import { Crown, ShieldCheck, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";

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
  accentClassName: string;
  badgeClassName: string;
  icon: typeof Crown;
  trigger: "manual" | "trial_expired" | "feature_locked";
};

function formatDate(value: Date | null) {
  if (!value) {
    return null;
  }

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

  switch (variant) {
    case "trial":
      return {
        eyebrow: "Premium Deneme",
        title: `Denemenizde ${daysLeftInTrial} gün kaldı`,
        description: "Tüm premium modüller şu anda açık. Süre bitmeden planınızı seçerek erişimi kesintisiz sürdürebilirsiniz.",
        cta: "Planı İncele",
        accentClassName: "border-amber-400/25 bg-[linear-gradient(90deg,rgba(245,158,11,0.16),rgba(15,23,42,0.4))]",
        badgeClassName: "border border-amber-400/25 bg-amber-400/15 text-amber-700 dark:text-amber-50",
        icon: Sparkles,
        trigger: "manual",
      };
    case "trial_expired":
      return {
        eyebrow: "Deneme Bitti",
        title: "Premium denemeniz sona erdi",
        description: `Bulk CAPA, gelişmiş AI araçları ve yüksek limitleri yeniden açmak için Premium plana ${formattedPrice} ile geçebilirsiniz.`,
        cta: "Premium'a Geç",
        accentClassName: "border-rose-400/25 bg-[linear-gradient(90deg,rgba(244,63,94,0.16),rgba(15,23,42,0.4))]",
        badgeClassName: "border border-rose-400/25 bg-rose-400/15 text-rose-700 dark:text-rose-50",
        icon: Crown,
        trigger: "trial_expired",
      };
    case "premium":
      return {
        eyebrow: "Premium Aktif",
        title: "Tüm premium araçlar hesabınızda açık",
        description: "Yüksek AI kotaları, premium modüller ve genişletilmiş limitler şu anda kullanılabilir. Faturalama detaylarını istediğiniz zaman yönetebilirsiniz.",
        cta: "Üyeliği Yönet",
        accentClassName: "border-emerald-400/25 bg-[linear-gradient(90deg,rgba(16,185,129,0.16),rgba(15,23,42,0.4))]",
        badgeClassName: "border border-emerald-400/25 bg-emerald-400/15 text-emerald-700 dark:text-emerald-50",
        icon: ShieldCheck,
        trigger: "manual",
      };
    case "premium_canceling":
      return {
        eyebrow: "Üyelik Uyarısı",
        title: endDate ? `Premium erişim ${endDate} tarihinde kapanacak` : "Premium erişim dönem sonunda kapanacak",
        description: "Dönem sonrasında premium modülleri kaybetmemek için abonelik ayarlarını gözden geçirmeniz iyi olur.",
        cta: "Aboneliği Yönet",
        accentClassName: "border-orange-400/25 bg-[linear-gradient(90deg,rgba(251,146,60,0.16),rgba(15,23,42,0.4))]",
        badgeClassName: "border border-orange-400/25 bg-orange-400/15 text-orange-700 dark:text-orange-50",
        icon: Crown,
        trigger: "manual",
      };
    case "past_due":
      return {
        eyebrow: "Ödeme Sorunu",
        title: "Premium faturalama güncellemesi gerekiyor",
        description: "Ödeme alınamadı. Premium erişiminizin kesintiye uğramaması için faturalama bilgilerinizi güncelleyin.",
        cta: "Faturalamayı Yönet",
        accentClassName: "border-rose-400/25 bg-[linear-gradient(90deg,rgba(239,68,68,0.16),rgba(15,23,42,0.4))]",
        badgeClassName: "border border-rose-400/25 bg-rose-400/15 text-rose-700 dark:text-rose-50",
        icon: Crown,
        trigger: "manual",
      };
    case "free":
    default:
      return {
        eyebrow: "Premium Fırsatı",
        title: `Premium şimdi ${formattedPrice}`,
        description: "Bulk CAPA, gelişmiş AI araçları, geniş export kapasitesi ve daha yüksek operasyon limitleri tek planda açılır.",
        cta: "Premium'u İncele",
        accentClassName: "border-fuchsia-400/25 bg-[linear-gradient(90deg,rgba(217,70,239,0.16),rgba(15,23,42,0.4))]",
        badgeClassName: "border border-fuchsia-400/25 bg-fuchsia-400/15 text-fuchsia-700 dark:text-fuchsia-50",
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
    if (loading) {
      return null;
    }

    if (status === "past_due") {
      return "past_due";
    }

    if (status === "trial" && isTrialExpired) {
      return "trial_expired";
    }

    if (status === "trial") {
      return "trial";
    }

    if (plan === "premium" && cancelAtPeriodEnd) {
      return "premium_canceling";
    }

    if (plan === "premium") {
      return "premium";
    }

    return "free";
  }, [cancelAtPeriodEnd, isTrialExpired, loading, plan, status]);

  const bannerKey = useMemo(() => {
    if (!variant) {
      return null;
    }

    return [variant, premiumPrice, daysLeftInTrial, formatDate(currentPeriodEnd)].join(":");
  }, [variant, premiumPrice, daysLeftInTrial, currentPeriodEnd]);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    setDismissedKey(stored);
  }, []);

  useEffect(() => {
    if (!bannerKey) {
      return;
    }

    if (dismissedKey && dismissedKey !== bannerKey) {
      localStorage.removeItem(DISMISS_KEY);
      setDismissedKey(null);
    }
  }, [bannerKey, dismissedKey]);

  if (!variant || !bannerKey || dismissedKey === bannerKey) {
    return null;
  }

  const copy = buildBannerCopy(variant, premiumPrice, daysLeftInTrial, currentPeriodEnd);
  const Icon = copy.icon;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, bannerKey);
    setDismissedKey(bannerKey);
  };

  return (
    <>
      <div className={`rounded-[24px] border px-4 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.14)] ${copy.accentClassName}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card/80 text-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{copy.eyebrow}</p>
                <Badge className={`rounded-full px-3 py-1 ${copy.badgeClassName}`}>
                  {variant === "premium" ? "Aktif" : variant === "trial" ? "Deneme" : "Avantajlı"}
                </Badge>
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">{copy.title}</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {copy.cta}
            </Button>
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="text-foreground hover:bg-accent"
            >
              <X className="mr-2 h-4 w-4" />
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
