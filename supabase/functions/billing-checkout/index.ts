import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildAppUrl, getPublicAppUrl, requireBillingContext } from "../_shared/billing.ts";

type CheckoutPlanCode = "premium" | "osgb";

function resolvePriceId(planCode: CheckoutPlanCode, billingPeriod: "monthly" | "yearly") {
  if (planCode === "osgb") {
    return billingPeriod === "yearly"
      ? Deno.env.get("STRIPE_OSGB_YEARLY_PRICE_ID")
      : Deno.env.get("STRIPE_OSGB_MONTHLY_PRICE_ID");
  }

  return billingPeriod === "yearly"
    ? Deno.env.get("STRIPE_PREMIUM_YEARLY_PRICE_ID")
    : Deno.env.get("STRIPE_PREMIUM_MONTHLY_PRICE_ID");
}

serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const billingPeriod = body?.billingPeriod === "yearly" ? "yearly" : "monthly";
    const planCode: CheckoutPlanCode = body?.planCode === "osgb" ? "osgb" : "premium";
    const context = await requireBillingContext(req, { allowNoOrganization: planCode === "premium" });
    if ("errorResponse" in context) {
      return context.errorResponse as Response;
    }

    if (!context.stripe) {
      return jsonResponse(500, {
        success: false,
        error: { message: "Stripe istemcisi baslatilamadi." },
      });
    }

    if (planCode === "osgb" && !context.profile.organization_id) {
      return jsonResponse(400, {
        success: false,
        error: { message: "OSGB plani icin once organizasyon kaydi olusturmaniz gerekir." },
      });
    }

    const isPersonalPremiumCheckout = planCode === "premium" && !context.profile.organization_id;

    if (!isPersonalPremiumCheckout && !context.isOrgAdmin) {
      return jsonResponse(403, {
        success: false,
        error: { message: "Abonelik islemlerini yalnizca organizasyon yoneticisi baslatabilir." },
      });
    }

    const successPath = typeof body?.successPath === "string" ? body.successPath : "/settings";
    const cancelPath = typeof body?.cancelPath === "string" ? body.cancelPath : "/settings";
    const priceId = resolvePriceId(planCode, billingPeriod);

    if (!priceId) {
      return jsonResponse(500, {
        success: false,
        error: {
          message:
            planCode === "osgb"
              ? "Stripe OSGB fiyat tanimi eksik. STRIPE_OSGB_*_PRICE_ID secret'lerini ekleyin."
              : "Stripe premium fiyat tanimi eksik. STRIPE_PREMIUM_*_PRICE_ID secret'lerini ekleyin.",
        },
      });
    }

    const appUrl = getPublicAppUrl(req);
    const adminClient = context.adminClient;

    const { data: existingSubscription } = context.profile.organization_id
      ? await adminClient
          .from("organization_subscriptions")
          .select("id, stripe_customer_id, stripe_subscription_id, plan_code, trial_ends_at")
          .eq("org_id", context.profile.organization_id)
          .maybeSingle()
      : { data: null };

    let stripeCustomerId = existingSubscription?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      const customer = await context.stripe.customers.create({
        email: context.user.email ?? context.profile.email ?? undefined,
        name: context.profile.full_name ?? undefined,
        metadata: {
          org_id: context.profile.organization_id ?? "",
          user_id: context.user.id,
        },
      });

      stripeCustomerId = customer.id;
    }

    const session = await context.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: context.profile.organization_id ?? context.user.id,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${buildAppUrl(appUrl, successPath)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${buildAppUrl(appUrl, cancelPath)}?checkout=cancelled`,
      customer_update: {
        address: "auto",
        name: "auto",
      },
      metadata: {
        org_id: context.profile.organization_id ?? "",
        user_id: context.user.id,
        plan_code: planCode,
        billing_period: billingPeriod,
        billing_scope: isPersonalPremiumCheckout ? "personal" : "organization",
      },
      subscription_data: {
        metadata: {
          org_id: context.profile.organization_id ?? "",
          user_id: context.user.id,
          plan_code: planCode,
          billing_period: billingPeriod,
          billing_scope: isPersonalPremiumCheckout ? "personal" : "organization",
        },
      },
    });

    if (context.profile.organization_id) {
      await adminClient
        .from("organization_subscriptions")
        .upsert({
          org_id: context.profile.organization_id,
          plan_code: existingSubscription?.plan_code ?? "free",
          status: "active",
          stripe_customer_id: stripeCustomerId,
          billing_provider: "stripe",
          last_checkout_session_id: session.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "org_id" });
    }

    return jsonResponse(200, {
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error("billing-checkout error", error);
    const message = error instanceof Error ? error.message : "Checkout oturumu olusturulamadi.";
    return jsonResponse(500, {
      success: false,
      error: { message },
    });
  }
});
