import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Building2,
  Check,
  CreditCard,
  Crown,
  Headphones,
  LockKeyhole,
  Rocket,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { startPlanCheckout } from "@/lib/billing";
import { getUserFacingError, getUserFacingErrorDescription } from "@/lib/userFacingError";
import type { BillingCatalogPlan, BillingPeriod, SubscriptionPlan } from "@/types/subscription";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggeredBy?: "trial_expired" | "feature_locked" | "manual";
}

type PaidPlan = Extract<SubscriptionPlan, "premium" | "osgb">;
type PlanTone = "free" | "premium" | "osgb";

const HIDE_UPGRADE_MODAL_KEY = "isgvizyon-hide-upgrade-modal";

const planFeatureHighlights: Record<PlanTone, string[]> = {
  free: [
    "1 firma ve sınırlı çalışan kaydı",
    "Temel İSG formları ve rapor çıktıları",
    "Kısıtlı AI ve aylık kullanım limitleri",
  ],
  premium: [
    "AI destekli DÖF, risk ve saha analizleri",
    "Sertifika, formlar, raporlar ve gelişmiş çıktı araçları",
    "Daha yüksek aylık kota ve profesyonel kullanım",
  ],
  osgb: [
    "Sınırsız firma operasyonu ve OSGB yönetim paneli",
    "Personel, görevlendirme, finans ve müşteri portalı",
    "Premium modüllerin tamamı ve kurumsal kapasite",
  ],
};

const planToneClass: Record<PlanTone, string> = {
  free: "border-slate-700/80 bg-slate-950/60",
  premium:
    "border-violet-400/50 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.28),rgba(15,23,42,0.92)_48%)] shadow-[0_24px_70px_rgba(124,58,237,0.22)]",
  osgb:
    "border-cyan-400/45 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),rgba(15,23,42,0.92)_48%)] shadow-[0_24px_70px_rgba(14,165,233,0.18)]",
};

function formatPrice(value: number | null | undefined, fallback: number) {
  const price = typeof value === "number" && value > 0 ? value : fallback;
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(price);
}

function getPlanPrice(plans: BillingCatalogPlan[], planCode: PaidPlan) {
  return plans.find((entry) => entry.planCode === planCode)?.price ?? null;
}

function PlanCard({
  tone,
  title,
  subtitle,
  price,
  period,
  icon,
  current,
  badge,
  disabled,
  loading,
  buttonLabel,
  onClick,
}: {
  tone: PlanTone;
  title: string;
  subtitle: string;
  price: string;
  period: string;
  icon: ReactNode;
  current?: boolean;
  badge?: string;
  disabled?: boolean;
  loading?: boolean;
  buttonLabel: string;
  onClick?: () => void;
}) {
  return (
    <div className={`relative flex min-h-[390px] flex-col rounded-2xl border p-5 ${planToneClass[tone]}`}>
      {badge && (
        <Badge className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold text-white">
          {badge}
        </Badge>
      )}

      <div className="mb-5 flex items-start gap-3 pr-20">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white">{icon}</div>
        <div>
          <h3 className="text-xl font-black text-white">{title}</h3>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-300">{subtitle}</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black tracking-tight text-white">{price}</span>
          {price !== "Ücretsiz" && <span className="pb-1 text-sm font-semibold text-slate-300">₺</span>}
          <span className="pb-1 text-xs font-semibold text-slate-400">/{period}</span>
        </div>
      </div>

      <ul className="mb-6 flex-1 space-y-3">
        {planFeatureHighlights[tone].map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm leading-5 text-slate-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {current && (
        <div className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          Bu paket şu anda hesabınızda aktif.
        </div>
      )}

      <Button
        disabled={disabled || loading || current}
        onClick={onClick}
        className={
          tone === "premium"
            ? "h-11 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 font-bold text-white shadow-lg shadow-violet-950/30 hover:from-violet-500 hover:to-fuchsia-400"
            : tone === "osgb"
              ? "h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white shadow-lg shadow-cyan-950/30 hover:from-cyan-400 hover:to-blue-500"
              : "h-11 rounded-xl border border-white/10 bg-white/10 font-bold text-white hover:bg-white/15"
        }
      >
        {loading ? "Ödeme hazırlanıyor..." : buttonLabel}
      </Button>
    </div>
  );
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    plan,
    status,
    plans,
    isOrganizationAdmin,
    isDemoActive,
    hasStripeCustomer,
    hasStripeSubscription,
  } = useSubscription();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [hideAgain, setHideAgain] = useState(false);

  const hasOrganization = Boolean(profile?.organization_id);
  const canPurchase = !hasOrganization || isOrganizationAdmin;
  const premiumMonthly = getPlanPrice(plans, "premium");
  const osgbMonthly = getPlanPrice(plans, "osgb");

  const premiumPrice = useMemo(() => {
    const monthly = Number(formatPrice(premiumMonthly, 249).replace(/\./g, ""));
    return billingPeriod === "yearly" ? formatPrice(monthly * 10, 2490) : formatPrice(premiumMonthly, 249);
  }, [billingPeriod, premiumMonthly]);

  const osgbPrice = useMemo(() => {
    const monthly = Number(formatPrice(osgbMonthly, 499).replace(/\./g, ""));
    return billingPeriod === "yearly" ? formatPrice(monthly * 10, 4990) : formatPrice(osgbMonthly, 499);
  }, [billingPeriod, osgbMonthly]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && hideAgain) {
      window.localStorage.setItem(HIDE_UPGRADE_MODAL_KEY, "1");
    }

    onOpenChange(nextOpen);
  };

  const runCheckout = async (planCode: PaidPlan) => {
    if (planCode === "osgb" && !hasOrganization) {
      navigate("/profile?tab=workspace&action=create&next=/settings?tab=billing&upgrade=1");
      handleOpenChange(false);
      return;
    }

    setLoadingAction(planCode);
    try {
      await startPlanCheckout(planCode, billingPeriod);
    } catch (error) {
      const details = getUserFacingError(error);
      toast.error(details.title, { description: getUserFacingErrorDescription(error) });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Dialog open={open && !isDemoActive} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-6xl overflow-hidden rounded-3xl border border-slate-700/80 bg-[#07111f] p-0 text-white shadow-2xl shadow-black/50">
        <DialogHeader className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.96))] px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100">
                <LockKeyhole className="h-3.5 w-3.5" />
                Güvenli Ödeme
              </div>
              <DialogTitle className="text-3xl font-black tracking-tight text-white">
                Planınızı seçin, ödeme adımına güvenle geçin
              </DialogTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Free, Premium ve OSGB paketlerini tek ekranda karşılaştırın. Ödeme Stripe Checkout üzerinden
                3D Secure destekli güvenli ödeme sayfasında tamamlanır.
              </p>
            </div>

            <div className="flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
              {(["monthly", "yearly"] as BillingPeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setBillingPeriod(period)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    billingPeriod === period
                      ? "bg-white text-slate-950 shadow-lg"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {period === "monthly" ? "Aylık" : "Yıllık"}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(92vh-210px)] overflow-y-auto p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <PlanCard
              tone="free"
              title="Free"
              subtitle="Temel başlangıç ve sınırlı kullanım"
              price="Ücretsiz"
              period="süresiz"
              icon={<BadgeCheck className="h-6 w-6" />}
              current={plan === "free" && status !== "trial"}
              buttonLabel="Mevcut plan"
              disabled
            />

            <PlanCard
              tone="premium"
              title="Premium"
              subtitle="İSG profesyonelleri için gelişmiş üretim paketi"
              price={premiumPrice}
              period={billingPeriod === "monthly" ? "ay" : "yıl"}
              icon={<Rocket className="h-6 w-6" />}
              badge={billingPeriod === "yearly" ? "2 ay avantaj" : "Popüler"}
              current={plan === "premium" || status === "trial"}
              disabled={!canPurchase || loadingAction !== null || plan === "osgb"}
              loading={loadingAction === "premium"}
              buttonLabel={plan === "osgb" ? "OSGB paketine dahil" : "Premium'a geç"}
              onClick={() => void runCheckout("premium")}
            />

            <PlanCard
              tone="osgb"
              title="OSGB"
              subtitle="Çoklu firma, ekip ve operasyon yönetimi"
              price={osgbPrice}
              period={billingPeriod === "monthly" ? "ay" : "yıl"}
              icon={<Building2 className="h-6 w-6" />}
              badge="Kurumsal"
              current={plan === "osgb"}
              disabled={!canPurchase || loadingAction !== null}
              loading={loadingAction === "osgb"}
              buttonLabel={!hasOrganization ? "Organizasyon oluştur" : "OSGB'ye geç"}
              onClick={() => void runCheckout("osgb")}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <CreditCard className="mb-3 h-5 w-5 text-cyan-300" />
              <p className="font-bold text-white">Gerçek ödeme akışı</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Checkout, abonelik ve müşteri portalı canlı ödeme altyapısına bağlıdır.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <Sparkles className="mb-3 h-5 w-5 text-violet-300" />
              <p className="font-bold text-white">Üyelik ayrışması</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Plan değişince modül izinleri ve limitler otomatik olarak ayrışır.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <Headphones className="mb-3 h-5 w-5 text-emerald-300" />
              <p className="font-bold text-white">Portal yönetimi</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {hasStripeCustomer || hasStripeSubscription
                  ? "Aktif müşteri kaydınız bulundu; abonelik portalı kullanılabilir."
                  : "Ödeme sonrası müşteri portalı otomatik açılabilir hale gelir."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <input
              type="checkbox"
              checked={hideAgain}
              onChange={(event) => setHideAgain(event.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
            />
            Bu bilgilendirme penceresini tekrar gösterme
          </label>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Crown className="h-4 w-4 text-amber-300" />
            Fiyatlar admin panelinden güncellenebilir, checkout canlı price id ile çalışır.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
