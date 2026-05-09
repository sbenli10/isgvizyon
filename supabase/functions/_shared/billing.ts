import Stripe from "https://esm.sh/stripe@16.10.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { jsonResponse } from "./cors.ts";

type BillingUserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  organization_id: string | null;
  role: string | null;
  plan_type: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_started_at: string | null;
  trial_ends_at: string | null;
};

type RequireBillingContextOptions = {
  allowNoOrganization?: boolean;
  requireStripe?: boolean;
};

export function createStripeClient() {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY tanimli degil.");
  }

  return new Stripe(secretKey, {
    apiVersion: "2024-06-20",
  });
}

export function createUserSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL veya anon key eksik.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

export function createAdminSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tanimli degil.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function requireBillingContext(req: Request, options: RequireBillingContextOptions = {}) {
  const userClient = createUserSupabaseClient(req);
  const adminClient = createAdminSupabaseClient();
  const stripe = options.requireStripe === false ? null : createStripeClient();

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return {
      errorResponse: jsonResponse(401, {
        success: false,
        error: { message: "Oturum bulunamadi." },
      }),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, full_name, organization_id, role, plan_type, subscription_plan, subscription_status, subscription_started_at, trial_ends_at")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      errorResponse: jsonResponse(404, {
        success: false,
        error: { message: "Profil kaydi bulunamadi." },
      }),
    };
  }

  if (!profile.organization_id && !options.allowNoOrganization) {
    return {
      errorResponse: jsonResponse(400, {
        success: false,
        error: { message: "Kullanici bir organizasyona bagli degil." },
      }),
    };
  }

  const typedProfile = profile as BillingUserProfile;
  const isOrgAdmin = typedProfile.role?.toLowerCase() === "admin";

  return {
    adminClient,
    stripe,
    user: data.user,
    profile: typedProfile,
    isOrgAdmin,
  };
}

export function getPublicAppUrl(req: Request) {
  return (
    Deno.env.get("PUBLIC_APP_URL") ||
    Deno.env.get("SITE_URL") ||
    req.headers.get("origin") ||
    "http://localhost:5173"
  );
}

export function buildAppUrl(baseUrl: string, path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
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

export async function ensurePersonalBillingOrganization(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  profile: BillingUserProfile,
) {
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
    .select("id, email, full_name, organization_id, role, plan_type, subscription_plan, subscription_status, subscription_started_at, trial_ends_at")
    .eq("id", profile.id)
    .single();

  if (refreshedProfileError || !refreshedProfile?.organization_id) {
    throw new Error(refreshedProfileError?.message || "Organizasyon baglantisi tamamlanamadi.");
  }

  return refreshedProfile as BillingUserProfile;
}

export async function resolveBillingOwnerUserId(adminClient: ReturnType<typeof createAdminSupabaseClient>, organizationId: string) {
  const { data: adminProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return adminProfile?.id ?? null;
}
