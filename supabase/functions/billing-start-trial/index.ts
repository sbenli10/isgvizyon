import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminSupabaseClient, createUserSupabaseClient, requireBillingContext } from "../_shared/billing.ts";

function addDaysIso(days: number) {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const context = await requireBillingContext(req, { allowNoOrganization: true });
    if ("errorResponse" in context) {
      return context.errorResponse;
    }

    if (context.profile.organization_id) {
      if (!context.isOrgAdmin) {
        return jsonResponse(403, {
          success: false,
          error: { message: "Deneme suresini yalnizca organizasyon yoneticisi baslatabilir." },
        });
      }

      const userClient = createUserSupabaseClient(req);
      const { data, error } = await (userClient as any).rpc("start_my_premium_trial");

      if (error) {
        return jsonResponse(400, {
          success: false,
          error: { message: error.message || "Deneme suresi baslatilamadi." },
        });
      }

      return jsonResponse(200, {
        success: true,
        overview: data ?? null,
      });
    }

    const adminClient = createAdminSupabaseClient();
    const existingStatus = context.profile.subscription_status?.toLowerCase() ?? null;
    const existingPlan = context.profile.subscription_plan?.toLowerCase() ?? null;
    const hasUsedTrialBefore = Boolean(context.profile.subscription_started_at || context.profile.trial_ends_at);

    if (existingStatus === "trial" || existingStatus === "active" || existingStatus === "premium") {
      return jsonResponse(400, {
        success: false,
        error: { message: "Aktif bir Premium uyeliginiz veya denemeniz zaten bulunuyor." },
      });
    }

    if (existingPlan === "premium" && hasUsedTrialBefore) {
      return jsonResponse(400, {
        success: false,
        error: { message: "7 gunluk Premium demo hakkinizi daha once kullandiniz." },
      });
    }

    const nowIso = new Date().toISOString();
    const trialEndsAt = addDaysIso(7);

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        subscription_plan: "premium",
        subscription_status: "trial",
        subscription_started_at: nowIso,
        trial_ends_at: trialEndsAt,
        updated_at: nowIso,
      })
      .eq("id", context.user.id);

    if (updateError) {
      return jsonResponse(400, {
        success: false,
        error: { message: updateError.message || "Demo uyeligi profilde baslatilamadi." },
      });
    }

    return jsonResponse(200, {
      success: true,
      overview: null,
      trialEndsAt,
      mode: "personal",
    });
  } catch (error) {
    console.error("billing-start-trial error", error);
    return jsonResponse(500, {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Deneme suresi baslatilamadi.",
      },
    });
  }
});
