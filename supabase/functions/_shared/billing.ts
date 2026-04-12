import Stripe from "https://esm.sh/stripe@16.10.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { jsonResponse } from "./cors.ts";

type BillingUserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  organization_id: string | null;
  role: string | null;
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

export async function requireBillingContext(req: Request) {
  const userClient = createUserSupabaseClient(req);
  const adminClient = createAdminSupabaseClient();
  const stripe = createStripeClient();

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
    .select("id, email, full_name, organization_id, role")
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

  if (!profile.organization_id) {
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
