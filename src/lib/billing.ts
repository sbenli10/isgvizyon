import { supabase } from "@/integrations/supabase/client";
import type { BillingOverview, BillingPeriod, SubscriptionPlan } from "@/types/subscription";

interface EdgeBillingResponse {
  success?: boolean;
  url?: string;
  error?: {
    message?: string;
  };
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

export async function startPremiumTrial(): Promise<BillingOverview> {
  const { data, error } = await (supabase as any).rpc("start_my_premium_trial");

  if (error) {
    throw new Error(error.message || "Deneme suresi baslatilamadi.");
  }

  return assertBillingOverview(data);
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
