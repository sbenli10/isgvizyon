import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBillingCatalog, getBillingOverview } from "@/lib/billing";
import type {
  BillingCatalogPlan,
  BillingOverview,
  FeatureKey,
  SubscriptionFeatureEntitlement,
  SubscriptionFeatures,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/types/subscription";

const DEFAULT_FEATURES: SubscriptionFeatures = {
  maxCompanies: 1,
  maxEmployees: 25,
  aiRiskAnalysis: false,
  pdfExport: true,
  excelExport: false,
  prioritySupport: false,
};

function normalizeStatus(overview: BillingOverview | null): SubscriptionStatus {
  if (!overview) {
    return "free";
  }

  if (overview.status === "trialing") {
    return "trial";
  }

  if (overview.status === "past_due") {
    return "past_due";
  }

  if ((overview.planCode === "premium" || overview.planCode === "osgb") && overview.status !== "canceled") {
    return "premium";
  }

  if (overview.status === "canceled") {
    return "cancelled";
  }

  return "free";
}

function entitlementMap(entitlements: SubscriptionFeatureEntitlement[]) {
  return entitlements.reduce<Record<string, SubscriptionFeatureEntitlement>>((acc, entitlement) => {
    acc[entitlement.featureKey] = entitlement;
    return acc;
  }, {});
}

function deriveLegacyFeatures(entitlements: SubscriptionFeatureEntitlement[], plan: SubscriptionPlan | string): SubscriptionFeatures {
  const featureMap = entitlementMap(entitlements);

  return {
    maxCompanies: featureMap["companies.count"]?.limitValue ?? DEFAULT_FEATURES.maxCompanies,
    maxEmployees: featureMap["employees.count"]?.limitValue ?? DEFAULT_FEATURES.maxEmployees,
    aiRiskAnalysis: Boolean(featureMap["ai.risk_generation_monthly"]?.isEnabled),
    pdfExport: Boolean(featureMap["reports.export_monthly"]?.isEnabled),
    excelExport: plan !== "free",
    prioritySupport: plan !== "free",
  };
}

export function useSubscription() {
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [catalogPlans, setCatalogPlans] = useState<BillingCatalogPlan[]>([]);

  const refetch = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setOverview(null);
      setCatalogPlans([]);
      setLoading(false);
      return;
    }

    if (!profile?.organization_id) {
      try {
        const catalog = await getBillingCatalog();
        setCatalogPlans(catalog.map((entry) => ({ ...entry, isCurrent: entry.planCode === "free" })));
        setOverview(null);
      } catch (error) {
        console.error("Subscription catalog fetch error:", error);
        setCatalogPlans([]);
        setOverview(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const nextOverview = await getBillingOverview();
      setOverview(nextOverview);
      setCatalogPlans(nextOverview.plans ?? []);
    } catch (error) {
      console.error("Subscription fetch error:", error);
      setOverview(null);
      try {
        const catalog = await getBillingCatalog();
        setCatalogPlans(catalog.map((entry) => ({ ...entry, isCurrent: entry.planCode === "free" })));
      } catch (catalogError) {
        console.error("Subscription catalog fallback error:", catalogError);
        setCatalogPlans([]);
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile?.organization_id, user]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const status = useMemo(() => normalizeStatus(overview), [overview]);
  const plan = (
    overview?.planCode === "osgb"
      ? "osgb"
      : overview?.planCode === "premium"
        ? "premium"
        : "free"
  ) as SubscriptionPlan;
  const entitlements = overview?.entitlements ?? [];
  const featureMap = useMemo(() => entitlementMap(entitlements), [entitlements]);
  const features = useMemo(() => deriveLegacyFeatures(entitlements, plan), [entitlements, plan]);
  const trialEndsAt = overview?.trialEndsAt ? new Date(overview.trialEndsAt) : null;
  const isTrialExpired = status === "trial" && (overview?.daysLeftInTrial ?? 0) <= 0;
  const isPremiumPlan = plan === "premium";
  const isOsgbPlan = plan === "osgb";
  const isPaidPlan = plan === "premium" || plan === "osgb";

  const getFeatureEntitlement = useCallback(
    (featureKey: FeatureKey | string) => featureMap[featureKey] ?? null,
    [featureMap],
  );

  const isFeatureAllowed = useCallback(
    (feature: keyof SubscriptionFeatures | FeatureKey | string) => {
      if (feature in features) {
        const featureValue = features[feature as keyof SubscriptionFeatures];
        return typeof featureValue === "boolean" ? featureValue : true;
      }

      return featureMap[feature]?.allowed ?? false;
    },
    [featureMap, features],
  );

  return {
    loading,
    overview,
    status,
    rawStatus: overview?.status ?? "active",
    plan,
    features,
    plans: overview?.plans ?? catalogPlans,
    entitlements,
    featureMap,
    isOrganizationAdmin: overview?.isOrganizationAdmin ?? false,
    canStartTrial: overview?.canStartTrial ?? false,
    hasStripeCustomer: overview?.hasStripeCustomer ?? false,
    hasStripeSubscription: overview?.hasStripeSubscription ?? false,
    cancelAtPeriodEnd: overview?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: overview?.currentPeriodEnd ? new Date(overview.currentPeriodEnd) : null,
    trialEndsAt,
    isTrialExpired,
    isPremiumPlan,
    isOsgbPlan,
    isPaidPlan,
    daysLeftInTrial: overview?.daysLeftInTrial ?? 0,
    getFeatureEntitlement,
    isFeatureAllowed,
    refetch,
  };
}
