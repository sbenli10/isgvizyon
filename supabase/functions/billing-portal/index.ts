import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildAppUrl, createStripeClient, getPublicAppUrl, requireBillingContext } from "../_shared/billing.ts";

serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // A manual bank-transfer subscription does not require Stripe. Resolve the
    // user and subscription first so those accounts receive a controlled
    // response instead of a missing Stripe configuration error.
    const context = await requireBillingContext(req, { requireStripe: false });
    if ("errorResponse" in context) {
      return context.errorResponse as Response;
    }

    if (!context.isOrgAdmin) {
      return jsonResponse(403, {
        success: false,
        error: { message: "Abonelik portalini yalnizca organizasyon yoneticisi acabilir." },
      });
    }

    const adminClient = context.adminClient;
    const { data: subscription, error: subscriptionError } = await adminClient
      .from("organization_subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", context.profile.organization_id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(subscriptionError.message || "Abonelik kaydı alınamadı.");
    }

    if (!subscription?.stripe_customer_id) {
      return jsonResponse(409, {
        success: false,
        error: {
          message: "Bu üyelik Havale/EFT ile etkinleştirildiği için çevrim içi abonelik portalı bulunmuyor. Üyelik değişiklikleri için destek ekibiyle iletişime geçin.",
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const returnPath = typeof body?.returnPath === "string" ? body.returnPath : "/settings";
    const appUrl = getPublicAppUrl(req);

    const stripe = createStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
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
