import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildAppUrl, getPublicAppUrl, requireBillingContext } from "../_shared/billing.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const context = await requireBillingContext(req);
    if ("errorResponse" in context) {
      return context.errorResponse;
    }

    if (!context.isOrgAdmin) {
      return jsonResponse(403, {
        success: false,
        error: { message: "Abonelik portalini yalnizca organizasyon yoneticisi acabilir." },
      });
    }

    const adminClient = context.adminClient;
    const { data: subscription } = await adminClient
      .from("organization_subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", context.profile.organization_id)
      .maybeSingle();

    if (!subscription?.stripe_customer_id) {
      return jsonResponse(400, {
        success: false,
        error: { message: "Bu organizasyon icin aktif bir Stripe musterisi bulunamadi." },
      });
    }

    const body = await req.json().catch(() => ({}));
    const returnPath = typeof body?.returnPath === "string" ? body.returnPath : "/settings";
    const appUrl = getPublicAppUrl(req);

    const portalSession = await context.stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: buildAppUrl(appUrl, returnPath),
    });

    return jsonResponse(200, {
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error("billing-portal error", error);
    const message = error instanceof Error ? error.message : "Stripe portal oturumu acilamadi.";
    return jsonResponse(500, {
      success: false,
      error: { message },
    });
  }
});
