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

  const personalTrialEndsAt = useMemo(
    () => (!profile?.organization_id && profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null),
    [profile?.organization_id, profile?.trial_ends_at],
  );
  const personalDaysLeftInTrial = useMemo(() => {
    if (!personalTrialEndsAt) {
      return 0;
    }

    return Math.min(7, Math.max(0, Math.ceil((personalTrialEndsAt.getTime() - Date.now()) / 86_400_000)));
  }, [personalTrialEndsAt]);
  const personalPlan = useMemo<SubscriptionPlan>(() => {
    if (profile?.subscription_plan === "osgb") {
      return "osgb";
    }

    if (profile?.subscription_plan === "premium") {
      return "premium";
    }

    return "free";
  }, [profile?.subscription_plan]);
  const personalStatus = useMemo<SubscriptionStatus>(() => {
    if (profile?.organization_id) {
      return "free";
    }

    if (profile?.subscription_status === "past_due") {
      return "past_due";
    }

    if (profile?.subscription_status === "trial") {
      return "trial";
    }

    if (
      (profile?.subscription_status === "active" || profile?.subscription_status === "premium") &&
      (personalPlan === "premium" || personalPlan === "osgb")
    ) {
      return "premium";
    }

    if (profile?.subscription_status === "cancelled" || profile?.subscription_status === "canceled") {
      return "cancelled";
    }

    return "free";
  }, [personalPlan, profile?.organization_id, profile?.subscription_status]);

  const status = useMemo(
    () => (profile?.organization_id ? normalizeStatus(overview) : personalStatus),
    [overview, personalStatus, profile?.organization_id],
  );
  const plan = useMemo<SubscriptionPlan>(() => {
    if (!profile?.organization_id) {
      return personalPlan;
    }

    if (overview?.planCode === "osgb") {
      return "osgb";
    }

    if (overview?.planCode === "premium") {
      return "premium";
    }

    return "free";
  }, [overview?.planCode, personalPlan, profile?.organization_id]);
  const entitlements = profile?.organization_id ? overview?.entitlements ?? [] : [];
  const featureMap = useMemo(() => entitlementMap(entitlements), [entitlements]);
  const features = useMemo(() => deriveLegacyFeatures(entitlements, plan), [entitlements, plan]);
  const trialEndsAt = profile?.organization_id
    ? overview?.trialEndsAt
      ? new Date(overview.trialEndsAt)
      : null
    : personalTrialEndsAt;
  const daysLeftInTrial = profile?.organization_id ? overview?.daysLeftInTrial ?? 0 : personalDaysLeftInTrial;
  const isTrialExpired = status === "trial" && daysLeftInTrial <= 0;
  const isPremiumPlan = plan === "premium" || status === "trial";
  const isOsgbPlan = plan === "osgb";
  const isPaidPlan = plan === "premium" || plan === "osgb";
  const canStartPersonalTrial = !profile?.organization_id && personalPlan === "free" && !profile?.subscription_started_at;
  const currentPlans = useMemo(() => {
    const activePlanCode = plan;
    return (overview?.plans ?? catalogPlans).map((entry) => ({
      ...entry,
      isCurrent: entry.planCode === activePlanCode,
    }));
  }, [catalogPlans, overview?.plans, plan]);

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
    rawStatus: profile?.organization_id ? overview?.status ?? "active" : profile?.subscription_status ?? "free",
    plan,
    features,
    plans: currentPlans,
    entitlements,
    featureMap,
    isOrganizationAdmin: overview?.isOrganizationAdmin ?? false,
    canStartTrial: profile?.organization_id ? overview?.canStartTrial ?? false : canStartPersonalTrial,
    hasStripeCustomer: overview?.hasStripeCustomer ?? false,
    hasStripeSubscription: overview?.hasStripeSubscription ?? false,
    cancelAtPeriodEnd: overview?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: profile?.organization_id && overview?.currentPeriodEnd ? new Date(overview.currentPeriodEnd) : trialEndsAt,
    trialEndsAt,
    isTrialExpired,
    isPremiumPlan,
    isOsgbPlan,
    isPaidPlan,
    daysLeftInTrial,
    getFeatureEntitlement,
    isFeatureAllowed,
    refetch,
  };
}
