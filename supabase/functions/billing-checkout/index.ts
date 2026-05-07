import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildAppUrl, getPublicAppUrl, requireBillingContext } from "../_shared/billing.ts";

type CheckoutPlanCode = "premium" | "osgb";

type CheckoutProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  organization_id: string | null;
  role: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_started_at: string | null;
  trial_ends_at: string | null;
};

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

function buildPersonalWorkspaceName(email: string | null, fullName: string | null) {
  const normalizedName = fullName?.trim();
  if (normalizedName) {
    return `${normalizedName} Calisma Alani`;
  }

  const emailPrefix = email?.split("@")[0]?.trim();
  if (emailPrefix) {
    return `${emailPrefix} Calisma Alani`;
  }

  return "Kisisel Calisma Alani";
}

function slugifyValue(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensurePersonalBillingOrganization(adminClient: any, profile: CheckoutProfile) {
  if (profile.organization_id) {
    return profile;
  }

  const workspaceName = buildPersonalWorkspaceName(profile.email, profile.full_name);
  const slugBase = slugifyValue(workspaceName) || "kisisel-calisma-alani";
  let slug = `${slugBase}-${profile.id.slice(0, 8)}`;
  let suffix = 1;

  while (true) {
    const { data: existingOrg, error: existingOrgError } = await adminClient
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingOrgError) {
      throw new Error(existingOrgError.message || "Organizasyon slugu kontrol edilemedi.");
    }

    if (!existingOrg) {
      break;
    }

    suffix += 1;
    slug = `${slugBase}-${profile.id.slice(0, 8)}-${suffix}`;
  }

  const { data: organization, error: organizationError } = await adminClient
    .from("organizations")
    .insert({
      name: workspaceName,
      slug,
      country: "Türkiye",
    })
    .select("id")
    .single();

  if (organizationError || !organization?.id) {
    throw new Error(organizationError?.message || "Kisisel organizasyon olusturulamadi.");
  }

  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({
      organization_id: organization.id,
      role: "admin",
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (profileUpdateError) {
    throw new Error(profileUpdateError.message || "Profil organizasyon baglantisi kurulamadi.");
  }

  const { data: refreshedProfile, error: refreshedProfileError } = await adminClient
    .from("profiles")
    .select("id, email, full_name, organization_id, role, subscription_plan, subscription_status, subscription_started_at, trial_ends_at")
    .eq("id", profile.id)
    .single();

  if (refreshedProfileError || !refreshedProfile?.organization_id) {
    throw new Error(refreshedProfileError?.message || "Organizasyon baglantisi tamamlanamadi.");
  }

  return refreshedProfile as CheckoutProfile;
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

    if (planCode === "osgb" && !context.profile.organization_id) {
      return jsonResponse(400, {
        success: false,
        error: { message: "OSGB plani icin once organizasyon kaydi olusturmaniz gerekir." },
      });
    }

    if (planCode === "premium" && !context.profile.organization_id) {
      try {
        const refreshedProfile = await ensurePersonalBillingOrganization(context.adminClient, context.profile);
        context.profile = refreshedProfile;
        context.isOrgAdmin = refreshedProfile.role?.toLowerCase() === "admin";
      } catch (error) {
        return jsonResponse(400, {
          success: false,
          error: {
            message: error instanceof Error ? error.message : "Premium plan icin kisisel organizasyon olusturulamadi.",
          },
        });
      }
    }

    if (!context.isOrgAdmin) {
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

    const { data: existingSubscription } = await adminClient
      .from("organization_subscriptions")
      .select("id, stripe_customer_id, stripe_subscription_id, plan_code, trial_ends_at")
      .eq("org_id", context.profile.organization_id)
      .maybeSingle();

    let stripeCustomerId = existingSubscription?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      const customer = await context.stripe.customers.create({
        email: context.user.email ?? context.profile.email ?? undefined,
        name: context.profile.full_name ?? undefined,
        metadata: {
          org_id: context.profile.organization_id,
          user_id: context.user.id,
        },
      });

      stripeCustomerId = customer.id;
    }

    const session = await context.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: context.profile.organization_id,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${buildAppUrl(appUrl, successPath)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${buildAppUrl(appUrl, cancelPath)}?checkout=cancelled`,
      customer_update: {
        address: "auto",
        name: "auto",
      },
      metadata: {
        org_id: context.profile.organization_id,
        user_id: context.user.id,
        plan_code: planCode,
        billing_period: billingPeriod,
      },
      subscription_data: {
        metadata: {
          org_id: context.profile.organization_id,
          user_id: context.user.id,
          plan_code: planCode,
          billing_period: billingPeriod,
        },
      },
    });

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
