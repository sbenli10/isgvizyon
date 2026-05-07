import { supabase } from "@/integrations/supabase/client";
import type { BillingCatalogPlan, BillingOverview, BillingPeriod, SubscriptionPlan } from "@/types/subscription";

interface EdgeBillingResponse {
  success?: boolean;
  url?: string;
  error?: {
    message?: string;
  };
}

type RawPlanFeature = {
  plan_code: string;
  feature_key: string;
  limit_value: number | null;
  is_enabled: boolean;
  period: "monthly" | "lifetime" | null;
};

type RawSubscriptionPlan = {
  plan_code: string;
  plan_name: string;
  price: number;
  currency: string | null;
  billing_period: string | null;
  is_active: boolean | null;
};

function getFallbackPlanDescription(planCode: string) {
  if (planCode === "osgb") {
    return "Coklu firma, ekip yonetimi ve OSGB operasyonlari icin.";
  }

  if (planCode === "premium") {
    return "AI destekli profesyonel is guvenligi yonetimi icin.";
  }

  return "Temel kullanim ve kontrollu baslangic icin.";
}

function getStaticBillingCatalog(): BillingCatalogPlan[] {
  return [
    {
      planCode: "free",
      planName: "Free",
      description: getFallbackPlanDescription("free"),
      price: 0,
      currency: "TRY",
      billingPeriod: "monthly",
      isCurrent: true,
      features: [],
    },
    {
      planCode: "premium",
      planName: "Premium",
      description: getFallbackPlanDescription("premium"),
      price: 250,
      currency: "TRY",
      billingPeriod: "monthly",
      isCurrent: false,
      features: [],
    },
    {
      planCode: "osgb",
      planName: "OSGB",
      description: getFallbackPlanDescription("osgb"),
      price: null,
      currency: "TRY",
      billingPeriod: "monthly",
      isCurrent: false,
      features: [],
    },
  ];
}

function assertBillingOverview(payload: unknown): BillingOverview {
  if (!payload || typeof payload !== "object") {
    throw new Error("Abonelik bilgisi alinamadi.");
  }

  return payload as BillingOverview;
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const { data, error } = await (supabase as any).rpc("get_my_billing_overview");

  if (error) {
    throw new Error(error.message || "Abonelik bilgileri getirilemedi.");
  }

  return assertBillingOverview(data);
}

export async function getBillingCatalog(): Promise<BillingCatalogPlan[]> {
  const [{ data: planRows, error: plansError }, { data: featureRows, error: featuresError }] = await Promise.all([
    (supabase as any)
      .from("subscription_plans")
      .select("plan_code, plan_name, price, currency, billing_period, is_active")
      .eq("is_active", true),
    (supabase as any)
      .from("plan_features")
      .select("plan_code, feature_key, limit_value, is_enabled, period"),
  ]);

  if (plansError || featuresError) {
    return getStaticBillingCatalog();
  }

  const featuresByPlan = new Map<string, RawPlanFeature[]>();
  for (const row of (featureRows ?? []) as RawPlanFeature[]) {
    const entries = featuresByPlan.get(row.plan_code) ?? [];
    entries.push(row);
    featuresByPlan.set(row.plan_code, entries);
  }

  const orderedCodes = ["free", "premium", "osgb"];
  const rows = ((planRows ?? []) as RawSubscriptionPlan[]).sort((left, right) => {
    const leftIndex = orderedCodes.indexOf(left.plan_code);
    const rightIndex = orderedCodes.indexOf(right.plan_code);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.plan_name.localeCompare(right.plan_name, "tr");
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });

  const catalog = rows.map((row) => ({
    planCode: row.plan_code,
    planName: row.plan_name,
    description: getFallbackPlanDescription(row.plan_code),
    price: row.price,
    currency: row.currency ?? "TRY",
    billingPeriod: row.billing_period === "yearly" ? "yearly" : "monthly",
    isCurrent: row.plan_code === "free",
    features: (featuresByPlan.get(row.plan_code) ?? []).map((feature) => ({
      featureKey: feature.feature_key,
      isEnabled: feature.is_enabled,
      limitValue: feature.limit_value,
      period: feature.period,
    })),
  }));

  return catalog.length > 0 ? catalog : getStaticBillingCatalog();
}

export async function startPremiumTrial(): Promise<BillingOverview> {
  const { data, error } = await supabase.functions.invoke("billing-start-trial", {
    body: {},
  });
  const payload = (data ?? null) as
    | {
        success?: boolean;
        overview?: BillingOverview | null;
        error?: { message?: string };
      }
    | null;

  if (error) {
    throw new Error(error.message || "Deneme suresi baslatilamadi.");
  }

  if (!payload?.success) {
    throw new Error(payload?.error?.message || "Deneme suresi baslatilamadi.");
  }

  return payload.overview ? assertBillingOverview(payload.overview) : ({} as BillingOverview);
}

export async function backfillMyFeatureUsage() {
  const { data, error } = await (supabase as any).rpc("backfill_my_feature_usage");

  if (error) {
    throw new Error(error.message || "Kullanim ozeti senkronize edilemedi.");
  }

  return data;
}

async function openBillingUrl(functionName: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  const payload = (data ?? null) as EdgeBillingResponse | null;

  if (error) {
    throw new Error(error.message || "Odeme servisine baglanilamadi.");
  }

  if (!payload?.success || !payload.url) {
    throw new Error(payload?.error?.message || "Yonlendirme baglantisi olusturulamadi.");
  }

  window.location.assign(payload.url);
}

export type CheckoutPlanCode = Extract<SubscriptionPlan, "premium" | "osgb">;

export async function startPlanCheckout(planCode: CheckoutPlanCode, period: BillingPeriod) {
  await openBillingUrl("billing-checkout", {
    billingPeriod: period,
    planCode,
  });
}

export async function startPremiumCheckout(period: BillingPeriod) {
  await startPlanCheckout("premium", period);
}

export async function startOsgbCheckout(period: BillingPeriod) {
  await startPlanCheckout("osgb", period);
}

export async function openBillingPortal() {
  await openBillingUrl("billing-portal", {});
}
