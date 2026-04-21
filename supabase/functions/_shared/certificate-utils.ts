import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const ALLOWED_ORIGINS = [
  "https://isgvizyon.com",
  "https://www.isgvizyon.com",
  "https://elmdzekyyoepdrpnfppn.supabase.co",
  Deno.env.get("PUBLIC_APP_URL"),
  Deno.env.get("SITE_URL"),
].filter(Boolean);

export function getCorsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

/** @deprecated Use getCorsHeaders(req.headers.get("origin")) instead */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type CertificateRecord = {
  id: string;
  company_id: string | null;
  created_by: string;
  training_name: string;
  training_date: string;
  training_duration: string;
  certificate_type: string;
  validity_date: string | null;
  logo_url: string | null;
  template_type: string;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  trainer_names: string[];
  frame_style: string;
  notes: string | null;
  design_config: Record<string, unknown> | null;
  created_at: string;
};

export type CertificateParticipant = {
  id: string;
  certificate_id: string;
  name: string;
  tc_no: string | null;
  job_title: string | null;
  certificate_no: string | null;
  pdf_path: string | null;
  verification_code: string | null;
};

export type CertificateJob = {
  id: string;
  certificate_id: string;
  status: string;
  progress: number;
  total_files: number;
  completed_files: number;
  zip_path: string | null;
  error_message: string | null;
};

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function jsonResponse(payload: unknown, status = 200, req?: Request) {
  const origin = req?.headers.get("origin") ?? null;
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) },
  });
}

export async function requireAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Authorization header missing");
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Authorization token missing");
  }

  const client = createServiceClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new Error(error?.message || "Unauthorized");
  }

  return data.user;
}

export function buildCertificateNumber(certificateId: string, participantIndex: number) {
  const shortId = certificateId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `CERT-${shortId}-${String(participantIndex + 1).padStart(5, "0")}`;
}

export function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function workerBaseUrl() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  return `${url}/functions/v1`;
}

export function buildVerificationUrl(code: string) {
  const appUrl = Deno.env.get("PUBLIC_APP_URL") ?? Deno.env.get("SITE_URL") ?? "";
  if (!appUrl) {
    return `/certificate-verify/${code}`;
  }
  return `${appUrl.replace(/\/$/, "")}/certificate-verify/${code}`;
}
