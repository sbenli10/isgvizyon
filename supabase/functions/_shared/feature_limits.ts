import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { jsonResponse } from "./cors.ts";

type FeatureLimitResult = {
  allowed?: boolean;
  reason?: string;
  feature_key?: string;
};

function createAuthedClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    throw new Error("Veri servisi yapılandırması eksik.");
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

export async function consumeFeatureOrRespond(req: Request, featureKey: string, byCount = 1, byValue = 0) {
  const client = createAuthedClient(req);
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError || !userData.user) {
    return jsonResponse(401, {
      success: false,
      error: {
        code: "not_authenticated",
        message: "Bu işlemi yapmak için oturum açmanız gerekir.",
      },
    });
  }

  const { data: accessData, error: accessError } = await client.rpc("check_my_feature_access", {
    p_feature_key: featureKey,
  });

  if (accessError) {
    return jsonResponse(403, {
      success: false,
      error: {
        code: "feature_check_failed",
        message: "Paket hakkınız kontrol edilemedi. Lütfen tekrar deneyin.",
      },
    });
  }

  const access = (Array.isArray(accessData) ? accessData[0] : accessData) as FeatureLimitResult | null;

  if (!access?.allowed) {
    return jsonResponse(402, {
      success: false,
      error: {
        code: access?.reason === "limit_reached" ? "feature_limit_reached" : "feature_locked",
        message:
          access?.reason === "limit_reached"
            ? "Bu paket için kullanım limitinize ulaştınız. Devam etmek için paketinizi yükseltin."
            : "Bu özellik mevcut paketinizde açık değil. Devam etmek için paketinizi yükseltin.",
      },
    });
  }

  const { error: incrementError } = await client.rpc("increment_my_feature_usage", {
    p_feature_key: featureKey,
    p_by_count: byCount,
    p_by_value: byValue,
  });

  if (incrementError) {
    return jsonResponse(402, {
      success: false,
      error: {
        code: "feature_limit_increment_failed",
        message: "Kullanım hakkınız güncellenemedi. Limit dolmuş olabilir.",
      },
    });
  }

  return null;
}
