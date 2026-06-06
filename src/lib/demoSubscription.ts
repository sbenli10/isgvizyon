import { supabase } from "@/integrations/supabase/client";

export type OsgbDemoSubscription = {
  id: string;
  user_id: string;
  organization_id: string | null;
  demo_type: string;
  status: string;
  started_at: string;
  ends_at: string;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OsgbDemoState = {
  hasDemo: boolean;
  isActive: boolean;
  hasExpired: boolean;
  daysLeft: number;
  startedAt: string | null;
  endsAt: string | null;
};

export function getOsgbDemoState(subscription: OsgbDemoSubscription | null | undefined): OsgbDemoState {
  if (!subscription) {
    return {
      hasDemo: false,
      isActive: false,
      hasExpired: false,
      daysLeft: 0,
      startedAt: null,
      endsAt: null,
    };
  }

  const endsAtMs = new Date(subscription.ends_at).getTime();
  const nowMs = Date.now();
  const hasValidEndDate = Number.isFinite(endsAtMs);
  const isActive = subscription.status === "active" && hasValidEndDate && endsAtMs > nowMs;
  const hasExpired = subscription.status !== "active" || (hasValidEndDate && endsAtMs <= nowMs);
  const daysLeft = isActive ? Math.max(0, Math.ceil((endsAtMs - nowMs) / 86_400_000)) : 0;

  return {
    hasDemo: true,
    isActive,
    hasExpired,
    daysLeft,
    startedAt: subscription.started_at ?? null,
    endsAt: subscription.ends_at ?? null,
  };
}

export async function getOsgbDemoSubscription(userId: string): Promise<OsgbDemoSubscription | null> {
  const { data, error } = await (supabase as any)
    .from("user_demo_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("demo_type", "osgb_full_demo")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Demo üyelik bilgisi alınamadı.");
  }

  return (data ?? null) as OsgbDemoSubscription | null;
}

export async function startOsgbDemoSubscription(
  userId: string,
  organizationId?: string | null,
): Promise<OsgbDemoSubscription> {
  const { data, error } = await (supabase as any).rpc("start_osgb_demo_subscription", {
    p_user_id: userId,
    p_organization_id: organizationId ?? null,
  });

  if (error) {
    throw new Error(error.message || "Demo üyelik başlatılamadı.");
  }

  if (!data) {
    throw new Error("Demo üyelik başlatılamadı.");
  }

  return data as OsgbDemoSubscription;
}
