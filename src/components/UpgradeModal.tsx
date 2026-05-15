import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Check,
  Flame,
  Gift,
  Rocket,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { startPlanCheckout } from "@/lib/billing";
import { getUserFacingError, getUserFacingErrorDescription } from "@/lib/userFacingError";
import type { BillingPeriod, SubscriptionPlan } from "@/types/subscription";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggeredBy?: "trial_expired" | "feature_locked" | "manual";
}

type FeatureState = "included" | "warning" | "disabled";

type PlanFeature = {
  label: string;
  state?: FeatureState;
};

type PlanVariant = "free" | "expert" | "osgb";

const HIDE_UPGRADE_MODAL_KEY = "isgvizyon-hide-upgrade-modal";

const freeFeatures: PlanFeature[] = [
  { label: "Temel İSG araçları" },
  { label: "Risk değerlendirme" },
  { label: "Tüm İSG evrakları" },
  { label: "Günde sadece 3 PDF/WORD", state: "warning" },
  { label: "Maksimum 50 çalışan", state: "warning" },
  { label: "Çoklu atama en fazla 3 firma", state: "warning" },
  { label: "Toplu atama en fazla 3 firma", state: "warning" },
  { label: "Sınırsız rapor", state: "disabled" },
  { label: "ZIP indirme ve kroki editörü", state: "disabled" },
  { label: "Firmalara rapor gönderme", state: "disabled" },
];

const expertFeatures: PlanFeature[] = [
  { label: "Sınırsız rapor oluşturma" },
  { label: "ZIP dosya indirme" },
  { label: "Kroki editörü" },
  { label: "Evraklara kaşe/imza ekleme" },
  { label: "Firmalara rapor gönderme" },
  { label: "Sınırsız çalışan ekleme" },
  { label: "Çoklu atama en fazla 3 firma", state: "warning" },
  { label: "Toplu atama en fazla 3 firma", state: "warning" },
];

const osgbFeatures: PlanFeature[] = [
  { label: "Tüm Uzman özellikleri +" },
  { label: "OSGB modülü sınırsız" },
  { label: "İSG fiyat teklifi verme" },
  { label: "ISGVizyon Bot desteği" },
  { label: "Tam kapsamlı İSG yönetimi" },
  { label: "Çoklu atama sınırsız" },
  { label: "Toplu atama indirme sınırsız" },
];

const planStyles: Record<
  PlanVariant,
  {
    card: string;
    icon: string;
    badge?: string;
    button: string;
  }
> = {
  free: {
    card:
      "!border-sky-200/80 !bg-blue-500 bg-gradient-to-br from-sky-400 via-blue-500 to-cyan-500 shadow-sky-500/20 dark:!border-slate-700/80 dark:!bg-[#12213a] dark:from-[#12213a] dark:via-[#12213a] dark:to-[#12213a] dark:shadow-black/20",
    icon: "bg-white/20 text-white ring-1 ring-white/25",
    button:
      "bg-white/20 text-white ring-1 ring-white/25 hover:bg-white/25 disabled:bg-white/15 disabled:text-white/70",
  },
  expert: {
    card:
      "relative !border-blue-200/80 !bg-indigo-500 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 shadow-blue-500/25 dark:!border-blue-400/40 dark:!bg-[#0f2746] dark:from-[#0f2746] dark:via-[#0f2746] dark:to-[#0f2746] dark:shadow-blue-950/40",
    icon: "bg-white/20 text-white ring-1 ring-white/25",
    badge: "bg-white text-blue-600 shadow-lg shadow-blue-950/10 dark:bg-blue-500 dark:text-white",
    button:
      "bg-white text-blue-700 hover:bg-blue-50 disabled:bg-white/20 disabled:text-white/70 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400",
  },
  osgb: {
    card:
      "!border-cyan-200/80 !bg-cyan-500 bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 shadow-cyan-500/25 dark:!border-cyan-400/40 dark:!bg-[#102a42] dark:from-[#102a42] dark:via-[#102a42] dark:to-[#102a42] dark:shadow-cyan-950/40",
    icon: "bg-white/20 text-white ring-1 ring-white/25",
    button:
      "bg-white text-cyan-700 hover:bg-cyan-50 disabled:bg-white/20 disabled:text-white/70 dark:bg-cyan-500 dark:text-white dark:hover:bg-cyan-400",
  },
};

function getPlanPrice(price: number | null | undefined, fallback: number) {
  if (typeof price === "number" && price > 0) {
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(price);
  }

  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(fallback);
}

function FeatureRow({ feature }: { feature: PlanFeature }) {
  const state = feature.state ?? "included";

  if (state === "warning") {
    return (
      <li className="flex items-start gap-2 text-[11px] font-semibold leading-5 text-amber-100">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />
        <span>{feature.label}</span>
      </li>
    );
  }

  if (state === "disabled") {
    return (
      <li className="flex items-start gap-2 text-[11px] leading-5 text-white/55 line-through">
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{feature.label}</span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 text-[11px] font-medium leading-5 text-white">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-200" />
      <span>{feature.label}</span>
    </li>
  );
}

function PlanCard({
  title,
  subtitle,
  price,
  period,
  icon,
  features,
  variant,
  buttonLabel,
  disabled,
  loading,
  current,
  onClick,
}: {
  title: string;
  subtitle: string;
  price: string;
  period: string;
  icon: React.ReactNode;
  features: PlanFeature[];
  variant: PlanVariant;
  buttonLabel: string;
  disabled?: boolean;
  loading?: boolean;
  current?: boolean;
  onClick?: () => void;
}) {
  const styles = planStyles[variant];

  return (
    <div
      className={`flex min-h-[360px] flex-col rounded-2xl border p-4 text-white shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl sm:p-5 ${styles.card}`}
    >
      {variant === "expert" && (
        <div
          className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-wider ${styles.badge}`}
        >
          En Popüler
        </div>
      )}

      <div className="mb-4 flex items-start gap-3">
        <div className={`rounded-xl p-2 shadow-sm ${styles.icon}`}>{icon}</div>
        <div className="min-w-0">
          <h3 className="text-base font-black leading-tight text-white">{title}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/75">{subtitle}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black tracking-tight text-white">{price}₺</span>
          <span className="text-xs font-semibold text-white/75">/{period}</span>
        </div>
      </div>

      <ul className="mb-5 flex-1 space-y-1.5">
        {features.map((feature) => (
          <FeatureRow key={`${title}-${feature.label}`} feature={feature} />
        ))}
      </ul>

      <Button
        disabled={disabled || loading || current}
        onClick={onClick}
        className={`h-10 w-full rounded-xl text-sm font-black shadow-lg transition ${styles.button}`}
      >
        {loading ? "Hazırlanıyor..." : buttonLabel}
      </Button>
    </div>
  );
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { plan, status, plans, isOrganizationAdmin } = useSubscription();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [hideAgain, setHideAgain] = useState(false);

  const hasOrganization = Boolean(profile?.organization_id);
  const canPurchasePremium = !hasOrganization || isOrganizationAdmin;
  const hasPremiumAccess = status === "trial" || plan === "premium" || plan === "osgb";

  const premiumPlan = plans.find((entry) => entry.planCode === "premium");
  const osgbPlan = plans.find((entry) => entry.planCode === "osgb");

  const expertPrice = useMemo(() => getPlanPrice(premiumPlan?.price, 249), [premiumPlan?.price]);
  const osgbPrice = useMemo(() => getPlanPrice(osgbPlan?.price, 349), [osgbPlan?.price]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && hideAgain) {
      window.localStorage.setItem(HIDE_UPGRADE_MODAL_KEY, "1");
    }

    onOpenChange(nextOpen);
  };

  const runCheckout = async (
    planCode: Extract<SubscriptionPlan, "premium" | "osgb">,
    billingPeriod: BillingPeriod,
  ) => {
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

  const handleOsgbClick = () => {
    if (!hasOrganization) {
      navigate("/profile?tab=workspace&action=create&next=/settings?tab=billing&upgrade=1");
      handleOpenChange(false);
      return;
    }

    void runCheckout("osgb", "monthly");
  };

  const premiumButtonLabel =
    plan === "osgb" ? "OSGB’ye Dahil" : plan === "premium" || status === "trial" ? "Aktif Planınız" : "Uzman Paketi Seç";

  const osgbButtonLabel =
    plan === "osgb" ? "OSGB Aktif" : !hasOrganization ? "Organizasyon Oluştur" : "OSGB Paketi Seç";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-24px)] max-w-[760px] overflow-hidden rounded-2xl border border-sky-200/70 bg-sky-50 p-0 text-white shadow-2xl shadow-blue-950/20 dark:border-slate-700/80 dark:bg-[#08111f] dark:shadow-black/40">
        <div className="flex min-h-0 w-full flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-sky-200/70 bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100 px-5 py-4 text-center dark:border-slate-700/80 dark:bg-none dark:bg-[#0f1d33] sm:px-6">
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 shadow-sm ring-1 ring-sky-200/80 dark:bg-white/10 dark:text-emerald-300 dark:ring-white/10">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Sınırlı Süre Kampanyası
            </div>

            <DialogTitle className="text-2xl font-black leading-tight text-slate-950 dark:text-white sm:text-3xl">
              İSG İşlerinizi <span className="text-indigo-600 dark:text-cyan-300">10 Kat Hızlandırın!</span>
            </DialogTitle>

            <p className="mx-auto mt-2 max-w-2xl text-sm font-medium leading-5 text-slate-700 dark:text-slate-300">
              Binlerce İSG uzmanı ISGVizyon ile zamandan tasarruf ediyor. Siz de hemen başlayın.
            </p>
          </DialogHeader>

          <div className="max-h-[calc(88vh-190px)] overflow-y-auto bg-sky-50 px-4 py-4 dark:bg-[#08111f] sm:px-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <PlanCard
                title="Ücretsiz"
                subtitle="Mevcut Planınız"
                price="0"
                period="sonsuz kadar"
                icon={<Gift className="h-5 w-5" />}
                features={freeFeatures}
                variant="free"
                current={plan === "free" && status !== "trial"}
                buttonLabel="Şu Anki Planınız"
                disabled
              />

              <PlanCard
                title="Uzman"
                subtitle="İSG Profesyonelleri"
                price={expertPrice}
                period="aylık"
                icon={<Rocket className="h-5 w-5" />}
                features={expertFeatures}
                variant="expert"
                current={plan === "premium" || status === "trial"}
                buttonLabel={premiumButtonLabel}
                disabled={loadingAction !== null || !canPurchasePremium || hasPremiumAccess}
                loading={loadingAction === "premium"}
                onClick={() => void runCheckout("premium", "monthly")}
              />

              <PlanCard
                title="OSGB"
                subtitle="Şirketler & OSGB’ler"
                price={osgbPrice}
                period="aylık"
                icon={<Building2 className="h-5 w-5" />}
                features={osgbFeatures}
                variant="osgb"
                current={plan === "osgb"}
                buttonLabel={osgbButtonLabel}
                disabled={loadingAction !== null || plan === "osgb" || (hasOrganization && !isOrganizationAdmin)}
                loading={loadingAction === "osgb"}
                onClick={handleOsgbClick}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-sky-200/70 bg-sky-100/80 px-5 py-4 dark:border-slate-700/80 dark:bg-[#0f1d33] sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hideAgain}
                onChange={(event) => setHideAgain(event.target.checked)}
                className="h-4 w-4 rounded border-sky-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
              />
              Bir daha gösterme
            </label>

            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-300">
              <Send className="h-3.5 w-3.5 text-blue-500 dark:text-cyan-300" />
              Tüm ödemeler 3D Secure ile korunur
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
