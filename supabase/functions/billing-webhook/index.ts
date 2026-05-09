import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.10.0?target=denonext";
import { createAdminSupabaseClient, createStripeClient, resolveBillingOwnerUserId } from "../_shared/billing.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type StripeSubscriptionLike = {
  id: string;
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  status: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: number | null;
  trial_start?: number | null;
  trial_end?: number | null;
  items?: {
    data: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  } | null;
  metadata?: Record<string, string>;
};

function unixToIso(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function normalizeSubscriptionStatus(status: string) {
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "active";
}

function inferPlanCodeFromSubscription(subscription: StripeSubscriptionLike) {
  const metadataPlanCode = subscription.metadata?.plan_code;
  if (metadataPlanCode === "osgb" || metadataPlanCode === "premium") {
    return metadataPlanCode;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const osgbPriceIds = [
    Deno.env.get("STRIPE_OSGB_MONTHLY_PRICE_ID"),
    Deno.env.get("STRIPE_OSGB_YEARLY_PRICE_ID"),
  ].filter(Boolean);

  if (priceId && osgbPriceIds.includes(priceId)) {
    return "osgb";
  }

  return "premium";
}

async function findOrganizationSubscription(adminClient: ReturnType<typeof createAdminSupabaseClient>, lookup: {
  orgId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
}) {
  if (lookup.orgId) {
    const { data } = await adminClient
      .from("organization_subscriptions")
      .select("*")
      .eq("org_id", lookup.orgId)
      .maybeSingle();
    if (data) return data;
  }

  if (lookup.stripeSubscriptionId) {
    const { data } = await adminClient
      .from("organization_subscriptions")
      .select("*")
      .eq("stripe_subscription_id", lookup.stripeSubscriptionId)
      .maybeSingle();
    if (data) return data;
  }

  if (lookup.stripeCustomerId) {
    const { data } = await adminClient
      .from("organization_subscriptions")
      .select("*")
      .eq("stripe_customer_id", lookup.stripeCustomerId)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function upsertFromStripeSubscription(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  subscription: StripeSubscriptionLike,
) {
  const stripeCustomerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;
  const orgIdFromMetadata = subscription.metadata?.org_id || null;
  const userIdFromMetadata = subscription.metadata?.user_id || null;
  const billingScope = subscription.metadata?.billing_scope ?? null;
  const resolvedPlanCode = inferPlanCodeFromSubscription(subscription);
  const normalizedStatus = normalizeSubscriptionStatus(subscription.status);
  const nextPlanCode = normalizedStatus === "canceled" ? "free" : resolvedPlanCode;

  if (!orgIdFromMetadata && billingScope === "personal" && userIdFromMetadata) {
    await adminClient
      .from("profiles")
      .update({
        plan_type: nextPlanCode,
        subscription_plan: nextPlanCode,
        subscription_status:
          normalizedStatus === "canceled"
            ? "free"
            : normalizedStatus === "past_due"
              ? "past_due"
              : normalizedStatus === "trialing"
                ? "trial"
                : "active",
        subscription_started_at: unixToIso(subscription.current_period_start) ?? new Date().toISOString(),
        trial_ends_at: unixToIso(subscription.trial_end),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userIdFromMetadata);

    return null;
  }

  const existing = await findOrganizationSubscription(adminClient, {
    orgId: orgIdFromMetadata,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId,
  });

  const orgId = orgIdFromMetadata ?? existing?.org_id ?? null;
  if (!orgId) {
    throw new Error("Stripe aboneligini esleyecek organization id bulunamadi.");
  }

  await adminClient
    .from("organization_subscriptions")
    .upsert({
      org_id: orgId,
      plan_code: nextPlanCode,
      status: normalizedStatus,
      starts_at: unixToIso(subscription.current_period_start) ?? new Date().toISOString(),
      current_period_start: unixToIso(subscription.current_period_start),
      current_period_end: unixToIso(subscription.current_period_end),
      trial_started_at: unixToIso(subscription.trial_start),
      trial_ends_at: unixToIso(subscription.trial_end),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      canceled_at: unixToIso(subscription.canceled_at),
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
      billing_provider: "stripe",
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });

  await adminClient
    .from("profiles")
    .update({
      plan_type: nextPlanCode,
      subscription_plan: nextPlanCode,
      subscription_status:
        normalizedStatus === "canceled"
          ? "free"
          : normalizedStatus === "past_due"
            ? "past_due"
            : normalizedStatus === "trialing"
              ? "trial"
              : "active",
      subscription_started_at: unixToIso(subscription.current_period_start) ?? new Date().toISOString(),
      trial_ends_at: unixToIso(subscription.trial_end),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId);

  return orgId;
}

async function handleInvoiceEvent(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  invoice: Stripe.Invoice,
  status: "paid" | "failed",
) {
  const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  const stripeSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;
  const subscription = await findOrganizationSubscription(adminClient, {
    stripeCustomerId,
    stripeSubscriptionId,
  });

  if (!subscription?.org_id) {
    return;
  }

  const billingOwnerUserId = await resolveBillingOwnerUserId(adminClient, subscription.org_id);
  if (!billingOwnerUserId) {
    return;
  }

  await adminClient
    .from("billing_history")
    .insert({
      user_id: billingOwnerUserId,
      organization_id: subscription.org_id,
      plan_name: subscription.plan_code === "osgb" ? "OSGB" : "Premium",
      amount: ((status === "paid" ? invoice.amount_paid : invoice.amount_due) ?? 0) / 100,
      currency: invoice.currency?.toUpperCase() ?? "TRY",
      status,
      invoice_url: invoice.hosted_invoice_url,
      billing_date: new Date().toISOString().split("T")[0],
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString().split("T")[0] : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString().split("T")[0] : null,
      payment_method: "Stripe",
      provider: "stripe",
      provider_reference: invoice.id,
      metadata: {
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
      },
    } as never);

  if (status === "failed") {
    await adminClient
      .from("organization_subscriptions")
      .update({
        status: "past_due",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", subscription.org_id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!signature || !webhookSecret) {
      return jsonResponse(400, {
        success: false,
        error: { message: "Stripe webhook imzasi dogrulanamadi." },
      });
    }

    const body = await req.text();
    const stripe = createStripeClient();
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
    const adminClient = createAdminSupabaseClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertFromStripeSubscription(adminClient, subscription as unknown as StripeSubscriptionLike);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertFromStripeSubscription(adminClient, event.data.object as StripeSubscriptionLike);
        break;
      }
      case "invoice.payment_succeeded": {
        await handleInvoiceEvent(adminClient, event.data.object as Stripe.Invoice, "paid");
        break;
      }
      case "invoice.payment_failed": {
        await handleInvoiceEvent(adminClient, event.data.object as Stripe.Invoice, "failed");
        break;
      }
      default:
        break;
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error("billing-webhook error", error);
    const message = error instanceof Error ? error.message : "Webhook islenemedi.";
    return jsonResponse(400, {
      success: false,
      error: { message },
    });
  }
});
