import { supabase } from "@/integrations/supabase/client";
import type { FeatureKey } from "@/types/subscription";

export type FeatureLimitCheck = {
  allowed: boolean;
  reason: string;
  featureKey: FeatureKey | string;
  currentUsage: number;
  limitValue: number | null;
};

type RawFeatureLimitCheck = {
  allowed?: boolean;
  reason?: string;
  feature_key?: string;
  current_usage?: number;
  limit_value?: number | null;
};

function normalizeFeatureLimitRow(featureKey: FeatureKey | string, row?: RawFeatureLimitCheck | null): FeatureLimitCheck {
  return {
    allowed: row?.allowed === true,
    reason: row?.reason || "feature_not_found",
    featureKey: row?.feature_key || featureKey,
    currentUsage: Number(row?.current_usage || 0),
    limitValue: typeof row?.limit_value === "number" ? row.limit_value : null,
  };
}

export async function checkFeatureAccess(featureKey: FeatureKey | string): Promise<FeatureLimitCheck> {
  const { data, error } = await (supabase as any).rpc("check_my_feature_access", {
    p_feature_key: featureKey,
  });

  if (error) {
    throw new Error(error.message || "Paket hakkı kontrol edilemedi.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return normalizeFeatureLimitRow(featureKey, row);
}

export async function incrementFeatureUsage(
  featureKey: FeatureKey | string,
  byCount = 1,
  byValue = 0,
) {
  const { data, error } = await (supabase as any).rpc("increment_my_feature_usage", {
    p_feature_key: featureKey,
    p_by_count: byCount,
    p_by_value: byValue,
  });

  if (error) {
    throw new Error(error.message || "Paket kullanım hakkı güncellenemedi.");
  }

  return data;
}

export async function requireFeatureAccess(featureKey: FeatureKey | string) {
  const result = await checkFeatureAccess(featureKey);

  if (!result.allowed) {
    throw new Error(
      result.reason === "limit_reached"
        ? "Bu paket için kullanım limitinize ulaştınız. Devam etmek için paketinizi yükseltin."
        : "Bu özellik mevcut paketinizde açık değil. Devam etmek için paketinizi yükseltin.",
    );
  }

  return result;
}

export async function consumeFeatureUsage(featureKey: FeatureKey | string, byCount = 1, byValue = 0) {
  await requireFeatureAccess(featureKey);
  return incrementFeatureUsage(featureKey, byCount, byValue);
}
