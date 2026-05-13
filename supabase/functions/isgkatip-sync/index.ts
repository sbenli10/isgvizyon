import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompanyData {
  sgkNo: string;
  companyName: string;
  employeeCount?: number;
  hazardClass?: string;
  naceCode?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  assignedMinutes?: number;
  requiredMinutes?: number | null;
}

interface AuthContext {
  organizationId: string;
  userId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const authContext = await requireAuthContext(req, supabaseUrl, anonKey, serviceClient);
    const { action, data } = await req.json();

    let response;
    switch (action) {
      case "SYNC_COMPANY":
        response = await syncCompany(serviceClient, authContext, data);
        break;
      case "BATCH_SYNC":
        response = await batchSyncCompanies(serviceClient, authContext, data);
        break;
      case "GET_COMPANIES":
        response = await getCompanies(serviceClient, authContext, data?.filters || {});
        break;
      case "PULL_REMOTE_AND_SYNC":
        response = await pullRemoteAndSync(serviceClient, authContext, data || {});
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        status: error?.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function requireAuthContext(req: Request, supabaseUrl: string, anonKey: string, serviceClient: any): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    const error: any = new Error("Yetkisiz istek.");
    error.status = 401;
    throw error;
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    const error: any = new Error("ISGVizyon oturumu doğrulanamadı.");
    error.status = 401;
    throw error;
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  const organizationId =
    profile?.organization_id ||
    user.user_metadata?.organization_id ||
    user.app_metadata?.organization_id ||
    null;

  if (!organizationId) {
    const error: any = new Error("Kullanıcı için organization_id bulunamadı.");
    error.status = 403;
    throw error;
  }

  return {
    organizationId,
    userId: user.id,
  };
}

function normalizeHazardClass(value?: string | null): string {
  const normalized = String(value || "Az Tehlikeli").toLocaleLowerCase("tr-TR");
  if (normalized.includes("çok") || normalized.includes("cok")) return "Çok Tehlikeli";
  if (normalized.includes("tehlikeli")) return "Tehlikeli";
  return "Az Tehlikeli";
}

function normalizeInteger(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = String(value).trim();
  const trDate = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (trDate) {
    const [, day, month, year] = trDate;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().split("T")[0];
}

function calculateRequiredMinutes(employeeCount: number, hazardClass: string): number {
  const normalizedHazard = normalizeHazardClass(hazardClass);
  let perEmployee = 10;
  if (normalizedHazard === "Çok Tehlikeli") perEmployee = 30;
  else if (normalizedHazard === "Tehlikeli") perEmployee = 20;
  return Math.max(0, employeeCount) * perEmployee;
}

function calculateComplianceStatus(assignedMinutes: number, requiredMinutes: number): string {
  if (!requiredMinutes || requiredMinutes <= 0) return "UNKNOWN";
  if (assignedMinutes >= requiredMinutes) return "COMPLIANT";
  if (assignedMinutes >= requiredMinutes * 0.8) return "WARNING";
  return "CRITICAL";
}

function calculateRiskScore(company: Record<string, unknown>): number {
  let score = 45;
  const hazardClass = normalizeHazardClass(String(company.hazard_class || "Az Tehlikeli"));
  const employeeCount = normalizeInteger(company.employee_count, 0);
  const assignedMinutes = normalizeInteger(company.assigned_minutes, 0);
  const requiredMinutes = normalizeInteger(company.required_minutes, 0);
  const complianceStatus = calculateComplianceStatus(assignedMinutes, requiredMinutes);

  if (hazardClass === "Çok Tehlikeli") score += 25;
  else if (hazardClass === "Tehlikeli") score += 12;

  if (employeeCount >= 100) score += 10;
  else if (employeeCount >= 50) score += 5;

  if (complianceStatus === "CRITICAL") score += 20;
  else if (complianceStatus === "WARNING") score += 10;

  return Math.min(score, 100);
}

function buildCompanyPayload(authContext: AuthContext, company: CompanyData) {
  const employeeCount = normalizeInteger(company.employeeCount, 0);
  const assignedMinutes = normalizeInteger(company.assignedMinutes, 0);
  const hazardClass = normalizeHazardClass(company.hazardClass);
  const requiredMinutes =
    company.requiredMinutes == null
      ? calculateRequiredMinutes(employeeCount, hazardClass)
      : normalizeInteger(company.requiredMinutes, calculateRequiredMinutes(employeeCount, hazardClass));

  return {
    org_id: authContext.organizationId,
    user_id: authContext.userId,
    sgk_no: String(company.sgkNo || "").trim(),
    company_name: String(company.companyName || "").trim(),
    employee_count: employeeCount,
    hazard_class: hazardClass,
    nace_code: company.naceCode ? String(company.naceCode).trim() : null,
    contract_start: normalizeDate(company.contractStart),
    contract_end: normalizeDate(company.contractEnd),
    assigned_minutes: assignedMinutes,
    required_minutes: requiredMinutes,
    compliance_status: calculateComplianceStatus(assignedMinutes, requiredMinutes),
    risk_score: calculateRiskScore({
      employee_count: employeeCount,
      hazard_class: hazardClass,
      assigned_minutes: assignedMinutes,
      required_minutes: requiredMinutes,
    }),
    last_synced_at: new Date().toISOString(),
    is_deleted: false,
    deleted_at: null,
  };
}

async function findExistingCompany(supabase: any, authContext: AuthContext, payload: ReturnType<typeof buildCompanyPayload>) {
  const bySgk = payload.sgk_no
    ? await supabase
        .from("isgkatip_companies")
        .select("*")
        .eq("org_id", authContext.organizationId)
        .eq("sgk_no", payload.sgk_no)
        .maybeSingle()
    : null;

  if (bySgk?.error) throw bySgk.error;
  if (bySgk?.data) return bySgk.data;

  const byName = await supabase
    .from("isgkatip_companies")
    .select("*")
    .eq("org_id", authContext.organizationId)
    .eq("company_name", payload.company_name)
    .maybeSingle();

  if (byName.error) throw byName.error;
  return byName.data || null;
}

function hasMeaningfulChange(existing: Record<string, unknown> | null, payload: ReturnType<typeof buildCompanyPayload>) {
  if (!existing) return true;

  const keys: Array<keyof typeof payload> = [
    "sgk_no",
    "company_name",
    "employee_count",
    "hazard_class",
    "nace_code",
    "contract_start",
    "contract_end",
    "assigned_minutes",
    "required_minutes",
    "compliance_status",
    "risk_score",
  ];

  return keys.some((key) => (existing?.[key] ?? null) !== (payload[key] ?? null));
}

async function syncCompany(supabase: any, authContext: AuthContext, incoming: CompanyData) {
  if (!incoming?.sgkNo || !incoming?.companyName) {
    throw new Error("sgkNo ve companyName zorunludur.");
  }

  const payload = buildCompanyPayload(authContext, incoming);
  const existing = await findExistingCompany(supabase, authContext, payload);

  if (existing && !hasMeaningfulChange(existing, payload)) {
    await logAudit(supabase, authContext, {
      action: "SYNC_COMPANY_SKIPPED",
      source: "ISGKATIP_EXTENSION",
      details: {
        sgk_no: payload.sgk_no,
        company_name: payload.company_name,
      },
      status: "SUCCESS",
    });

    return {
      success: true,
      operation: "skipped",
      company: existing,
    };
  }

  const upsertPayload = existing ? { ...payload, id: existing.id } : payload;

  const { data, error } = await supabase
    .from("isgkatip_companies")
    .upsert(upsertPayload, {
      onConflict: "org_id,sgk_no",
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;

  await runComplianceCheck(supabase, data);
  await logAudit(supabase, authContext, {
    action: existing ? "SYNC_COMPANY_UPDATED" : "SYNC_COMPANY_CREATED",
    source: "ISGKATIP_EXTENSION",
    details: {
      sgk_no: payload.sgk_no,
      company_name: payload.company_name,
    },
    status: "SUCCESS",
    resourceId: data.id,
  });

  return {
    success: true,
    operation: existing ? "updated" : "inserted",
    company: data,
  };
}

async function batchSyncCompanies(supabase: any, authContext: AuthContext, data: any) {
  const companies = Array.isArray(data?.companies) ? data.companies : [];
  if (!companies.length) {
    throw new Error("Aktarılacak firma listesi boş.");
  }

  const results = [];
  const summary = {
    total: companies.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const company of companies) {
    try {
      const result = await syncCompany(supabase, authContext, company);
      results.push({
        sgkNo: company.sgkNo || null,
        companyName: company.companyName || null,
        operation: result.operation,
        success: true,
      });
      summary[result.operation] += 1;
    } catch (error: any) {
      results.push({
        sgkNo: company?.sgkNo || null,
        companyName: company?.companyName || null,
        success: false,
        error: error.message || "Unknown sync error",
      });
      summary.errors += 1;
    }
  }

  await supabase.from("isgkatip_sync_logs").insert({
    org_id: authContext.organizationId,
    user_id: authContext.userId,
    action: "BATCH_SYNC",
    source: data?.source || "ISGKATIP_EXTENSION",
    total_companies: summary.total,
    success_count: summary.inserted + summary.updated,
    error_count: summary.errors,
    metadata: {
      inserted: summary.inserted,
      updated: summary.updated,
      skipped: summary.skipped,
      previewSummary: data?.metadata?.previewSummary || null,
    },
    status: summary.errors > 0 ? "PARTIAL" : "SUCCESS",
    details: null,
    resource_type: "isgkatip_company_batch",
    resource_id: null,
  });

  return {
    success: true,
    results,
    summary,
  };
}

async function getCompanies(supabase: any, authContext: AuthContext, filters: Record<string, unknown>) {
  let query = supabase
    .from("isgkatip_companies")
    .select("*")
    .eq("org_id", authContext.organizationId)
    .eq("is_deleted", false);

  if (filters?.complianceStatus) {
    query = query.eq("compliance_status", filters.complianceStatus);
  }

  if (filters?.hazardClass) {
    query = query.eq("hazard_class", filters.hazardClass);
  }

  const { data, error } = await query.order("company_name");
  if (error) throw error;

  return {
    success: true,
    companies: data || [],
    count: (data || []).length,
  };
}

async function runComplianceCheck(supabase: any, company: Record<string, unknown>) {
  const flags = [];
  const assigned = normalizeInteger(company.assigned_minutes, 0);
  const required = normalizeInteger(company.required_minutes, 0);
  const employeeCount = normalizeInteger(company.employee_count, 0);

  if (assigned < required * 0.9) {
    flags.push({
      rule_name: "DURATION_CHECK",
      severity: "CRITICAL",
      message: `Eksik süre: ${required - assigned} dk/ay`,
      details: { required, assigned },
    });
  } else if (assigned < required) {
    flags.push({
      rule_name: "DURATION_CHECK",
      severity: "WARNING",
      message: "Sınır değerde süre ataması",
      details: { required, assigned },
    });
  }

  if (company.contract_end) {
    const daysUntil = getDaysUntil(String(company.contract_end));
    if (daysUntil < 0) {
      flags.push({
        rule_name: "CONTRACT_EXPIRY",
        severity: "CRITICAL",
        message: `Sözleşme ${Math.abs(daysUntil)} gün önce sona erdi`,
        details: { contract_end: company.contract_end },
      });
    } else if (daysUntil <= 30) {
      flags.push({
        rule_name: "CONTRACT_EXPIRY",
        severity: "WARNING",
        message: `Sözleşme ${daysUntil} gün içinde sona erecek`,
        details: { contract_end: company.contract_end, days_until: daysUntil },
      });
    }
  }

  if (employeeCount >= 50) {
    flags.push({
      rule_name: "KURUL_OBLIGATION",
      severity: "INFO",
      message: "İSG Kurulu zorunluluğu var (50+ çalışan)",
      details: { employee_count: employeeCount },
    });
  }

  for (const flag of flags) {
    await supabase.from("isgkatip_compliance_flags").upsert(
      {
        org_id: String(company.org_id),
        company_id: String(company.id),
        rule_name: flag.rule_name,
        severity: flag.severity,
        message: flag.message,
        details: flag.details,
        status: "OPEN",
      },
      { onConflict: "company_id,rule_name,status", ignoreDuplicates: true },
    );
  }
}

async function logAudit(supabase: any, authContext: AuthContext, logData: {
  action: string;
  source: string;
  details: unknown;
  status: string;
  resourceId?: string | null;
}) {
  await supabase.from("isgkatip_sync_logs").insert({
    org_id: authContext.organizationId,
    user_id: authContext.userId,
    action: logData.action,
    source: logData.source,
    total_companies: 1,
    success_count: 1,
    error_count: 0,
    details: logData.details,
    metadata: null,
    status: logData.status,
    resource_type: "isgkatip_company",
    resource_id: logData.resourceId || null,
  });
}

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function firstDefined(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function normalizeRemoteCompany(row: Record<string, unknown>): CompanyData | null {
  const sgkNo = firstDefined(row.sgkNo, row.sgk_no, row.taxNo, row.tax_no, row.registration_no);
  const companyName = firstDefined(row.companyName, row.company_name, row.name, row.unvan);
  if (!sgkNo || !companyName) return null;

  return {
    sgkNo: String(sgkNo),
    companyName: String(companyName),
    employeeCount: normalizeInteger(firstDefined(row.employeeCount, row.employee_count, row.staffCount, row.staff_count), 0),
    hazardClass: String(firstDefined(row.hazardClass, row.hazard_class, row.dangerClass, row.danger_class) || "Az Tehlikeli"),
    contractStart: firstDefined(row.contractStart, row.contract_start, row.startDate, row.start_date) as string | null,
    contractEnd: firstDefined(row.contractEnd, row.contract_end, row.endDate, row.end_date) as string | null,
    assignedMinutes: normalizeInteger(firstDefined(row.assignedMinutes, row.assigned_minutes, row.serviceMinutes, row.service_minutes), 0),
    naceCode: firstDefined(row.naceCode, row.nace_code) as string | null,
  };
}

async function pullRemoteAndSync(supabase: any, authContext: AuthContext, data: Record<string, unknown>) {
  let query = supabase
    .from("osgb_external_integrations")
    .select("*")
    .eq("organization_id", authContext.organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (data?.integrationId) {
    query = supabase
      .from("osgb_external_integrations")
      .select("*")
      .eq("organization_id", authContext.organizationId)
      .eq("id", data.integrationId)
      .limit(1);
  }

  const { data: integrations, error } = await query;
  if (error) throw error;
  const integration = integrations?.[0];
  if (!integration) throw new Error("Aktif dış kaynak entegrasyonu bulunamadı.");

  const remoteRows = await fetchRemoteCompanies(integration);
  const normalizedCompanies = remoteRows
    .map((row: unknown) => normalizeRemoteCompany(row as Record<string, unknown>))
    .filter(Boolean) as CompanyData[];

  if (!normalizedCompanies.length) {
    throw new Error("Dış kaynak yanıtında eşlenebilir firma kaydı bulunamadı.");
  }

  return batchSyncCompanies(supabase, authContext, {
    companies: normalizedCompanies,
    source: data?.source || integration.integration_name || "external_integration",
    metadata: {
      integrationId: integration.id,
    },
  });
}

async function fetchRemoteCompanies(integration: Record<string, unknown>) {
  const baseUrl = String(integration.base_url || "").replace(/\/+$/, "");
  const apiPath = String(integration.api_path || "/companies");
  const url = `${baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;

  const headers: HeadersInit = { Accept: "application/json" };
  const authHeaderName = Deno.env.get("ISGKATIP_REMOTE_AUTH_HEADER") || "x-api-key";
  const apiKey = Deno.env.get("ISGKATIP_REMOTE_API_KEY");
  const bearerToken = Deno.env.get("ISGKATIP_REMOTE_BEARER");

  if (apiKey) headers[authHeaderName] = apiKey;
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`Dış kaynak cevabı başarısız: ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  if (integration.source_key && Array.isArray(payload?.[String(integration.source_key)])) {
    return payload[String(integration.source_key)];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.companies)) return payload.companies;
  return [];
}
