import { useCallback, useMemo } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import type { FeatureKey, SubscriptionPlan } from "@/types/subscription";

export type PlanAccessReason = "allowed" | "upgrade_to_premium" | "upgrade_to_osgb" | "limit_reached";

export type PlanAccessResult = {
  allowed: boolean;
  reason: PlanAccessReason;
  currentPlan: SubscriptionPlan;
  featureKey: FeatureKey | string;
};

const FEATURE_ALIASES: Record<string, FeatureKey | string> = {
  osgb_module: "osgb.access",
  osgb: "osgb.access",
  isg_bot: "isg_bot.access",
  isgbot: "isg_bot.access",
  risk_assessment: "risk_assessments.count",
  risk_assessments: "risk_assessments.count",
  inspection: "inspections.count_monthly",
  inspections: "inspections.count_monthly",
  capa: "capa.count",
  bulk_capa: "bulk_capa.access",
  blueprint_analyzer: "blueprint_analyzer.access",
  reports: "reports.export_monthly",
  certificates: "certificates.monthly",
  form_builder: "form_builder.access",
};

const PREMIUM_LOCKED_FEATURES = new Set(["osgb.access"]);
const FREE_LOCKED_FEATURES = new Set(["osgb.access", "isg_bot.access"]);

function normalizeFeatureName(featureName: FeatureKey | string) {
  return FEATURE_ALIASES[featureName] ?? featureName;
}

export function usePlanLimits() {
  const subscription = useSubscription();
  const {
    status,
    plan,
    daysLeftInTrial,
    getFeatureEntitlement,
  } = subscription;

  const currentPlan = useMemo<SubscriptionPlan>(() => {
    if (status === "trial" && daysLeftInTrial > 0) {
      return "osgb";
    }

    return plan;
  }, [daysLeftInTrial, plan, status]);

  const hasAccess = useCallback(
    (featureName: FeatureKey | string): PlanAccessResult => {
      const featureKey = normalizeFeatureName(featureName);
      const entitlement = getFeatureEntitlement(featureKey);

      if (currentPlan === "osgb") {
        return { allowed: true, reason: "allowed", currentPlan, featureKey };
      }

      if (currentPlan === "premium") {
        if (PREMIUM_LOCKED_FEATURES.has(featureKey)) {
          return { allowed: false, reason: "upgrade_to_osgb", currentPlan, featureKey };
        }

        return { allowed: true, reason: "allowed", currentPlan, featureKey };
      }

      if (FREE_LOCKED_FEATURES.has(featureKey)) {
        return {
          allowed: false,
          reason: featureKey === "osgb.access" ? "upgrade_to_osgb" : "upgrade_to_premium",
          currentPlan,
          featureKey,
        };
      }

      if (entitlement) {
        return {
          allowed: entitlement.allowed,
          reason: entitlement.allowed ? "allowed" : entitlement.isEnabled ? "limit_reached" : "upgrade_to_premium",
          currentPlan,
          featureKey,
        };
      }

      return { allowed: true, reason: "allowed", currentPlan, featureKey };
    },
    [currentPlan, getFeatureEntitlement],
  );

  return {
    ...subscription,
    currentPlan,
    hasAccess,
  };
}
