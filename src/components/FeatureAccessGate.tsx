import { useMemo, useState } from "react";
import { Crown, LockKeyhole, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import type { FeatureKey } from "@/types/subscription";

type FeatureAccessGateProps = {
  featureKey: FeatureKey | string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function FeatureAccessGate({
  featureKey,
  title,
  description,
  children,
}: FeatureAccessGateProps) {
  const {
    loading,
    plan,
    status,
    isTrialExpired,
    getFeatureEntitlement,
  } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const entitlement = getFeatureEntitlement(featureKey);
  const isLocked = useMemo(() => {
    if (loading) {
      return false;
    }

    if (status === "trial" && isTrialExpired) {
      return true;
    }

    return entitlement ? !entitlement.allowed : plan !== "premium";
  }, [entitlement, isTrialExpired, loading, plan, status]);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-slate-800" />
          <div className="h-4 w-72 rounded bg-slate-900" />
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl border border-slate-800 bg-slate-900/70" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isLocked) {
    return <>{children}</>;
  }

  const triggeredBy = status === "trial" && isTrialExpired ? "trial_expired" : "feature_locked";

  return (
    <>
      <div className="rounded-[30px] border border-fuchsia-400/20 bg-[linear-gradient(180deg,rgba(217,70,239,0.14),rgba(15,23,42,0.45))] p-6 shadow-[0_24px_60px_rgba(168,85,247,0.12)] md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 py-1 text-white">
                Premium Özellik
              </Badge>
              <Badge className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-slate-200">
                {plan === "premium" ? "Üyelik güncellemesi gerekiyor" : "Free planda kilitli"}
              </Badge>
            </div>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950/55 text-white">
                {status === "trial" && isTrialExpired ? <Sparkles className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">{title}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-200/90">{description}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {status === "trial" && isTrialExpired
                    ? "Premium denemeniz sona erdi. Aynı ekrandan premium planı yeniden etkinleştirerek bu modülü kullanmaya devam edebilirsiniz."
                    : "Bu ekran premium plana dahil. Upgrade ekranında tüm modül farklarını, AI kotalarını ve limit artışlarını karşılaştırabilirsiniz."}
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-[280px] rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-cyan-500 text-white">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Premium ile açılır</p>
                <p className="text-xs text-slate-400">Bulk CAPA, Blueprint, ISG Bot, OSGB ve daha fazlası</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Button
                onClick={() => setShowUpgradeModal(true)}
                className="w-full bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white hover:from-fuchsia-500 hover:to-cyan-400"
              >
                Premium'u İncele
              </Button>
              <p className="text-xs leading-5 text-slate-400">
                Free ve Premium arasındaki tüm farkları, limitleri ve avantajlı fiyat bilgisini bu ekrandan görebilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        triggeredBy={triggeredBy}
      />
    </>
  );
}
