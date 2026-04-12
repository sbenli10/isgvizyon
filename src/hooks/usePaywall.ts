import { useState } from "react";
import { toast } from "sonner";
import { useSubscription } from "./useSubscription";

type UpgradeReason = "trial_expired" | "feature_locked" | "manual";

const legacyFeatureMap = {
  aiRiskAnalysis: "ai.risk_generation_monthly",
  pdfExport: "reports.export_monthly",
  excelExport: "reports.export_monthly",
} as const;

export function usePaywall() {
  const { isFeatureAllowed, status, isTrialExpired, features } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason>("manual");

  const openLockedFeature = (title: string, description: string) => {
    setUpgradeReason("feature_locked");
    setShowUpgradeModal(true);
    toast.warning(title, { description });
  };

  const checkFeatureAccess = (
    feature: keyof typeof legacyFeatureMap,
    featureName: string,
  ): boolean => {
    if (status === "trial" && isTrialExpired) {
      setUpgradeReason("trial_expired");
      setShowUpgradeModal(true);
      toast.error("Deneme suresi sona erdi", {
        description: "Devam etmek icin premium plana gecebilirsiniz.",
      });
      return false;
    }

    const featureKey = legacyFeatureMap[feature];
    if (!isFeatureAllowed(featureKey)) {
      openLockedFeature(
        `${featureName} ozelligi premium planda acilir`,
        "Bu ozellige erismek icin hesabinizi yukseltebilirsiniz.",
      );
      return false;
    }

    return true;
  };

  const checkLimitAccess = async (
    resourceType: "companies" | "employees",
    currentCount: number,
  ): Promise<boolean> => {
    const limit = resourceType === "companies" ? features.maxCompanies : features.maxEmployees;

    if (limit === null) {
      return true;
    }

    if (currentCount >= limit) {
      openLockedFeature(
        resourceType === "companies" ? "Firma limiti doldu" : "Calisan limiti doldu",
        `Mevcut planinizda en fazla ${limit} ${resourceType === "companies" ? "firma" : "calisan"} yonetebilirsiniz.`,
      );
      return false;
    }

    return true;
  };

  return {
    showUpgradeModal,
    setShowUpgradeModal,
    upgradeReason,
    checkFeatureAccess,
    checkLimitAccess,
  };
}
