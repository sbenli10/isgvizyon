import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildAppUrl, createAdminSupabaseClient, getPublicAppUrl, requireBillingContext } from "../_shared/billing.ts";

type CheckoutPlanCode = "premium" | "osgb";
type BillingPeriod = "monthly" | "yearly";

function safeCheckoutError(message: string, code = "checkout_not_ready") {
  return jsonResponse(200, {
    success: false,
    error: { code, message },
  });
}

function getPlanLabel(planCode: CheckoutPlanCode) {
  return planCode === "osgb" ? "OSGB" : "Premium";
}

function getStripeSecretKey() {
  return Deno.env.get("STRIPE_SECRET_KEY")?.trim() || "";
}

function getFallbackPriceId(planCode: CheckoutPlanCode, billingPeriod: BillingPeriod) {
  if (planCode === "osgb") {
    return billingPeriod === "yearly"
      ? Deno.env.get("STRIPE_OSGB_YEARLY_PRICE_ID")?.trim()
      : Deno.env.get("STRIPE_OSGB_MONTHLY_PRICE_ID")?.trim();
  }

  return billingPeriod === "yearly"
    ? Deno.env.get("STRIPE_PREMIUM_YEARLY_PRICE_ID")?.trim()
    : Deno.env.get("STRIPE_PREMIUM_MONTHLY_PRICE_ID")?.trim();
}

async function resolvePriceId(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  planCode: CheckoutPlanCode,
  billingPeriod: BillingPeriod,
) {
  const fallbackPriceId = getFallbackPriceId(planCode, billingPeriod);

  const { data: planRow, error: planError } = await adminClient
    .from("subscription_plans")
    .select("provider_monthly_price_id, provider_yearly_price_id, checkout_enabled, is_active")
    .or(`plan_code.eq.${planCode},code.eq.${planCode}`)
    .maybeSingle();

  if (planError) {
    console.warn("billing-checkout plan lookup failed; falling back to env price id", {
      planCode,
      billingPeriod,
      message: planError.message,
    });
    return fallbackPriceId || null;
  }

  if (planRow && (planRow.checkout_enabled === false || planRow.is_active === false)) {
    throw new Error(`${getPlanLabel(planCode)} planı için ödeme ekranı geçici olarak kapalı.`);
  }

  const databasePriceId = billingPeriod === "yearly"
    ? planRow?.provider_yearly_price_id?.trim()
    : planRow?.provider_monthly_price_id?.trim();

  return databasePriceId || fallbackPriceId || null;
}

serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const billingPeriod: BillingPeriod = body?.billingPeriod === "yearly" ? "yearly" : "monthly";
    const planCode: CheckoutPlanCode = body?.planCode === "osgb" ? "osgb" : "premium";

    if (!getStripeSecretKey()) {
      console.error("billing-checkout missing STRIPE_SECRET_KEY");
      return safeCheckoutError(
        "Ödeme altyapısı henüz tamamlanmamış. Lütfen daha sonra tekrar deneyin veya destek ekibine bildirin.",
        "payment_provider_not_configured",
      );
    }

    const context = await requireBillingContext(req, { allowNoOrganization: planCode === "premium" });
    if ("errorResponse" in context) {
      return context.errorResponse as Response;
    }

    if (!context.stripe) {
      return safeCheckoutError(
        "Ödeme altyapısı şu anda başlatılamıyor. Lütfen daha sonra tekrar deneyin.",
        "payment_provider_unavailable",
      );
    }

    if (planCode === "osgb" && !context.profile.organization_id) {
      return safeCheckoutError(
        "OSGB planına geçmek için önce çalışma alanı oluşturmanız gerekir.",
        "organization_required",
      );
    }

    const isPersonalPremiumCheckout = planCode === "premium" && !context.profile.organization_id;

    if (!isPersonalPremiumCheckout && !context.isOrgAdmin) {
      return safeCheckoutError(
        "Abonelik işlemlerini yalnızca organizasyon yöneticisi başlatabilir.",
        "organization_admin_required",
      );
    }

    const successPath = typeof body?.successPath === "string" ? body.successPath : "/settings";
    const cancelPath = typeof body?.cancelPath === "string" ? body.cancelPath : "/settings";
    const adminClient = context.adminClient;
    const priceId = await resolvePriceId(adminClient, planCode, billingPeriod);

    if (!priceId) {
      console.error("billing-checkout missing price id", { planCode, billingPeriod });
      return safeCheckoutError(
        `${getPlanLabel(planCode)} planı için ödeme fiyatı henüz tanımlanmamış. Lütfen destek ekibine bildirin.`,
        "price_not_configured",
      );
    }

    const appUrl = getPublicAppUrl(req);

    const { data: existingSubscription, error: existingSubscriptionError } = context.profile.organization_id
      ? await adminClient
          .from("organization_subscriptions")
          .select("id, stripe_customer_id, stripe_subscription_id, plan_code, trial_ends_at")
          .eq("org_id", context.profile.organization_id)
          .maybeSingle()
      : { data: null, error: null };

    if (existingSubscriptionError) {
      console.warn("billing-checkout existing subscription lookup failed", existingSubscriptionError.message);
    }

    if (
      planCode === "premium" &&
      (existingSubscription?.plan_code === "osgb" || context.profile.subscription_plan === "osgb")
    ) {
      return safeCheckoutError(
        "OSGB paketinde Premium özellikleri zaten dahildir. OSGB üyeliği aktifken ayrıca Premium pakete geçiş başlatılamaz.",
        "premium_included_in_osgb",
      );
    }

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
      const { error: subscriptionUpsertError } = await adminClient
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

      if (subscriptionUpsertError) {
        console.warn("billing-checkout subscription checkout marker failed", subscriptionUpsertError.message);
      }
    }

    return jsonResponse(200, {
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error("billing-checkout error", error);
    const rawMessage = error instanceof Error ? error.message : "";
    const normalized = rawMessage.toLocaleLowerCase("tr-TR");

    if (
      normalized.includes("no such price") ||
      normalized.includes("no such customer") ||
      normalized.includes("invalid api key") ||
      normalized.includes("price")
    ) {
      return safeCheckoutError(
        "Ödeme sağlayıcısı ayarlarında eksik veya hatalı bilgi var. Lütfen destek ekibine bildirin.",
        "payment_provider_setup_error",
      );
    }

    return safeCheckoutError(
      "Ödeme ekranı şu anda açılamıyor. Birkaç dakika sonra tekrar deneyin.",
      "checkout_failed",
    );
  }
});
