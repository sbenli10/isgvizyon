import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createUserSupabaseClient, requireBillingContext } from "../_shared/billing.ts";

function createRequestId() {
  return crypto.randomUUID();
}

function logTrialEvent(requestId: string, step: string, details: Record<string, unknown> = {}) {
  console.log("[billing-start-trial]", JSON.stringify({ requestId, step, ...details }));
}

function logTrialError(requestId: string, step: string, error: unknown, details: Record<string, unknown> = {}) {
  console.error(
    "[billing-start-trial]",
    JSON.stringify({
      requestId,
      step,
      ...details,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    }),
  );
}

serve(async (req): Promise<Response> => {
  const requestId = createRequestId();

  if (req.method === "OPTIONS") {
    logTrialEvent(requestId, "options");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    logTrialEvent(requestId, "request_received", {
      method: req.method,
      hasAuthorization: Boolean(req.headers.get("Authorization")),
      origin: req.headers.get("origin"),
    });

    logTrialEvent(requestId, "context_start");
    const context = await requireBillingContext(req, {
      allowNoOrganization: true,
      requireStripe: false,
    });
    if ("errorResponse" in context) {
      logTrialEvent(requestId, "context_failed");
      return context.errorResponse as Response;
    }

    logTrialEvent(requestId, "context_loaded", {
      userId: context.user.id,
      email: context.profile.email,
      organizationId: context.profile.organization_id,
      role: context.profile.role,
      subscriptionPlan: context.profile.subscription_plan,
      subscriptionStatus: context.profile.subscription_status,
      subscriptionStartedAt: context.profile.subscription_started_at,
      trialEndsAt: context.profile.trial_ends_at,
      isOrgAdmin: context.isOrgAdmin,
    });

    if (context.profile.organization_id) {
      if (!context.isOrgAdmin) {
        logTrialEvent(requestId, "organization_trial_forbidden", {
          userId: context.user.id,
          organizationId: context.profile.organization_id,
          role: context.profile.role,
        });
        return jsonResponse(403, {
          success: false,
          requestId,
          error: { message: "Deneme suresini yalnizca organizasyon yoneticisi baslatabilir." },
        });
      }

      const userClient = createUserSupabaseClient(req);
      logTrialEvent(requestId, "organization_trial_rpc_start", {
        userId: context.user.id,
        organizationId: context.profile.organization_id,
      });
      const { data, error } = await userClient.rpc("start_my_premium_trial");

      if (error) {
        logTrialError(requestId, "organization_trial_rpc_failed", error, {
          userId: context.user.id,
          organizationId: context.profile.organization_id,
        });
        return jsonResponse(400, {
          success: false,
          requestId,
          error: { message: error.message || "Deneme suresi baslatilamadi." },
        });
      }

      logTrialEvent(requestId, "organization_trial_started", {
        userId: context.user.id,
        organizationId: context.profile.organization_id,
      });
      return jsonResponse(200, {
        success: true,
        requestId,
        overview: data ?? null,
      });
    }

    const existingStatus = context.profile.subscription_status?.toLowerCase() ?? null;
    const existingPlan = context.profile.subscription_plan?.toLowerCase() ?? null;
    const hasUsedTrialBefore = Boolean(context.profile.subscription_started_at || context.profile.trial_ends_at);

    if (existingStatus === "trial" || existingStatus === "active" || existingStatus === "premium") {
      logTrialEvent(requestId, "personal_trial_blocked_active_subscription", {
        userId: context.user.id,
        existingStatus,
        existingPlan,
        subscriptionStartedAt: context.profile.subscription_started_at,
        trialEndsAt: context.profile.trial_ends_at,
      });
      return jsonResponse(400, {
        success: false,
        requestId,
        error: { message: "Aktif bir uyeliginiz veya denemeniz zaten bulunuyor." },
      });
    }

    if (hasUsedTrialBefore) {
      logTrialEvent(requestId, "personal_trial_blocked_used_before", {
        userId: context.user.id,
        existingStatus,
        existingPlan,
        subscriptionStartedAt: context.profile.subscription_started_at,
        trialEndsAt: context.profile.trial_ends_at,
      });
      return jsonResponse(400, {
        success: false,
        requestId,
        error: { message: "7 gunluk demo hakkinizi daha once kullandiniz." },
      });
    }

    logTrialEvent(requestId, "personal_trial_update_start", {
      userId: context.user.id,
    });

    const userClient = createUserSupabaseClient(req);
    const { data: personalTrial, error: updateError } = await userClient.rpc("start_my_personal_premium_trial");

    if (updateError) {
      logTrialError(requestId, "personal_trial_update_failed", updateError, {
        userId: context.user.id,
      });
      return jsonResponse(400, {
        success: false,
        requestId,
        error: { message: updateError.message || "Demo uyeligi profilde baslatilamadi." },
      });
    }

    logTrialEvent(requestId, "personal_trial_started", {
      userId: context.user.id,
      trialEndsAt: personalTrial?.trialEndsAt ?? null,
    });

    return jsonResponse(200, {
      success: true,
      requestId,
      overview: null,
      trialEndsAt: personalTrial?.trialEndsAt ?? null,
      mode: "personal",
    });
  } catch (error) {
    logTrialError(requestId, "unhandled_error", error);
    return jsonResponse(500, {
      success: false,
      requestId,
      error: {
        message: error instanceof Error ? error.message : "Deneme suresi baslatilamadi.",
      },
    });
  }
});
