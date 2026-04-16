import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompanyData {
  orgId: string;
  sgkNo: string;
  companyName: string;
  employeeCount: number;
  hazardClass: string;
  contractStart?: string;
  contractEnd?: string;
  assignedMinutes: number;
  userId?: string;
  source: string;
}

interface AuditLogData {
  orgId: string;
  userId: string;
  action: string;
  details: unknown;
  source: string;
}

interface ExternalIntegrationData {
  orgId: string;
  userId?: string;
  integrationId?: string | null;
  source: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, data } = await req.json();

    let response;
    switch (action) {
      case "SYNC_COMPANY":
        response = await handleSyncCompany(supabase, data);
        break;
      case "LOG_AUDIT":
        response = await handleLogAudit(supabase, data);
        break;
      case "BATCH_SYNC":
        response = await handleBatchSync(supabase, data);
        break;
      case "GET_COMPANIES":
        response = await handleGetCompanies(supabase, data);
        break;
      case "PULL_REMOTE_AND_SYNC":
        response = await handlePullRemoteAndSync(supabase, data);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleSyncCompany(supabase: any, data: CompanyData) {
  const {
    orgId,
    sgkNo,
    companyName,
    employeeCount,
    hazardClass,
    contractStart,
    contractEnd,
    assignedMinutes,
    userId,
    source,
  } = data;

  if (!orgId || !sgkNo || !companyName) {
    throw new Error("Missing required fields: orgId, sgkNo, companyName");
  }

  const requiredMinutes = calculateRequiredMinutes(employeeCount, hazardClass);

  const { data: companyData, error: companyError } = await supabase
    .from("isgkatip_companies")
    .upsert(
      {
        org_id: orgId,
        sgk_no: sgkNo,
        company_name: companyName,
        employee_count: employeeCount,
        hazard_class: hazardClass,
        contract_start: contractStart || null,
        contract_end: contractEnd || null,
        assigned_minutes: assignedMinutes,
        required_minutes: requiredMinutes,
        last_synced_at: new Date().toISOString(),
      },
      {
        onConflict: "org_id,sgk_no",
        ignoreDuplicates: false,
      },
    )
    .select()
    .single();

  if (companyError) throw companyError;

  await runComplianceCheck(supabase, companyData);

  await logAudit(supabase, {
    org_id: orgId,
    user_id: userId || null,
    action: "SYNC_COMPANY",
    resource_type: "isgkatip_company",
    resource_id: companyData.id,
    details: { sgk_no: sgkNo, company_name: companyName },
    status: "SUCCESS",
    source,
  });

  return {
    success: true,
    company: companyData,
  };
}

async function handleBatchSync(supabase: any, data: any) {
  const { companies, orgId, userId, source } = data;

  if (!Array.isArray(companies) || companies.length === 0) {
    throw new Error("Invalid companies array");
  }

  const results = [];

  for (const company of companies) {
    try {
      const result = await handleSyncCompany(supabase, {
        ...company,
        orgId,
        userId,
        source,
      });
      results.push({ sgkNo: company.sgkNo, status: "success", data: result });
    } catch (error: any) {
      results.push({
        sgkNo: company.sgkNo,
        status: "error",
        error: error.message,
      });
    }
  }

  const successCount = results.filter((result) => result.status === "success").length;
  const errorCount = results.filter((result) => result.status === "error").length;

  return {
    success: true,
    results,
    summary: { total: companies.length, success: successCount, errors: errorCount },
  };
}

async function handleGetCompanies(supabase: any, data: any) {
  const { orgId, filters } = data;

  let query = supabase
    .from("isgkatip_companies")
    .select("*")
    .eq("org_id", orgId);

  if (filters?.complianceStatus) {
    query = query.eq("compliance_status", filters.complianceStatus);
  }

  if (filters?.hazardClass) {
    query = query.eq("hazard_class", filters.hazardClass);
  }

  if (filters?.contractExpiring) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    query = query
      .lte("contract_end", thirtyDaysFromNow.toISOString().split("T")[0])
      .gte("contract_end", new Date().toISOString().split("T")[0]);
  }

  const { data: companies, error } = await query.order("company_name");
  if (error) throw error;

  return {
    success: true,
    companies,
    count: companies.length,
  };
}

async function handlePullRemoteAndSync(supabase: any, data: ExternalIntegrationData) {
  const { orgId, userId, integrationId, source } = data;
  if (!orgId) throw new Error("Missing required field: orgId");

  let query = supabase
    .from("osgb_external_integrations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (integrationId) {
    query = supabase
      .from("osgb_external_integrations")
      .select("*")
      .eq("organization_id", orgId)
      .eq("id", integrationId)
      .limit(1);
  }

  const { data: integrations, error: integrationError } = await query;
  if (integrationError) throw integrationError;

  const integration = integrations?.[0];
  if (!integration) {
    throw new Error("Aktif dis kaynak entegrasyonu bulunamadi.");
  }

  try {
    const remoteRows = await fetchRemoteCompanies(integration);
    const normalizedCompanies = remoteRows
      .map((row: unknown) => normalizeRemoteCompany(row as Record<string, unknown>, orgId, integration))
      .filter(Boolean) as CompanyData[];

    if (!normalizedCompanies.length) {
      throw new Error("Dis kaynak yanitinda eslenebilir firma kaydi bulunamadi.");
    }

    const batchResult = await handleBatchSync(supabase, {
      companies: normalizedCompanies,
      orgId,
      userId,
      source: source || integration.integration_name || "external_integration",
    });

    await supabase
      .from("osgb_external_integrations")
      .update({
        status: "active",
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("id", integration.id);

    return {
      success: true,
      integrationId: integration.id,
      imported: normalizedCompanies.length,
      summary: batchResult.summary,
    };
  } catch (error: any) {
    await supabase
      .from("osgb_external_integrations")
      .update({
        status: "error",
        last_error: error.message || "Unknown integration error",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("id", integration.id);

    throw error;
  }
}

async function runComplianceCheck(supabase: any, company: any) {
  const flags = [];

  if (company.assigned_minutes < company.required_minutes * 0.9) {
    flags.push({
      rule_name: "DURATION_CHECK",
      severity: "CRITICAL",
      message: `Eksik sure: ${company.required_minutes - company.assigned_minutes} dk/ay`,
      details: {
        required: company.required_minutes,
        assigned: company.assigned_minutes,
        diff: company.required_minutes - company.assigned_minutes,
      },
    });
  } else if (company.assigned_minutes < company.required_minutes) {
    flags.push({
      rule_name: "DURATION_CHECK",
      severity: "WARNING",
      message: "Sinir degerde sure atamasi",
      details: {
        required: company.required_minutes,
        assigned: company.assigned_minutes,
      },
    });
  }

  if (company.contract_end) {
    const daysUntilExpiry = getDaysUntil(company.contract_end);

    if (daysUntilExpiry < 0) {
      flags.push({
        rule_name: "CONTRACT_EXPIRY",
        severity: "CRITICAL",
        message: `Sozlesme ${Math.abs(daysUntilExpiry)} gun once sona erdi`,
        details: { contract_end: company.contract_end },
      });
    } else if (daysUntilExpiry <= 30) {
      flags.push({
        rule_name: "CONTRACT_EXPIRY",
        severity: "WARNING",
        message: `Sozlesme ${daysUntilExpiry} gun icinde sona erecek`,
        details: { contract_end: company.contract_end, days_until: daysUntilExpiry },
      });
    }
  }

  if (company.employee_count >= 50) {
    flags.push({
      rule_name: "KURUL_OBLIGATION",
      severity: "INFO",
      message: "ISG Kurulu zorunlulugu var (50+ calisan)",
      details: { employee_count: company.employee_count },
    });
  }

  for (const flag of flags) {
    await supabase.from("isgkatip_compliance_flags").upsert(
      {
        org_id: company.org_id,
        company_id: company.id,
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

async function handleLogAudit(supabase: any, data: AuditLogData) {
  return await logAudit(supabase, {
    org_id: data.orgId,
    user_id: data.userId || null,
    action: data.action,
    resource_type: "manual",
    resource_id: null,
    details: data.details,
    status: "SUCCESS",
    source: data.source,
  });
}

async function logAudit(supabase: any, logData: any) {
  const { error } = await supabase.from("isgkatip_sync_logs").insert([logData]);
  if (error) {
    console.error("Audit log error:", error);
  }
}

function calculateRequiredMinutes(employeeCount: number, hazardClass: string): number {
  const rules = [
    { min: 1, max: 10, hazard: "Az Tehlikeli", minutes: 20 },
    { min: 11, max: 50, hazard: "Az Tehlikeli", minutes: 45 },
    { min: 51, max: 100, hazard: "Az Tehlikeli", minutes: 90 },
    { min: 101, max: 250, hazard: "Az Tehlikeli", minutes: 150 },
    { min: 251, max: 500, hazard: "Az Tehlikeli", minutes: 240 },
    { min: 501, max: 1000, hazard: "Az Tehlikeli", minutes: 390 },
    { min: 1001, max: 2000, hazard: "Az Tehlikeli", minutes: 660 },
    { min: 2001, max: Infinity, hazard: "Az Tehlikeli", minutes: 1200 },
    { min: 1, max: 10, hazard: "Tehlikeli", minutes: 30 },
    { min: 11, max: 50, hazard: "Tehlikeli", minutes: 90 },
    { min: 51, max: 100, hazard: "Tehlikeli", minutes: 180 },
    { min: 101, max: 250, hazard: "Tehlikeli", minutes: 300 },
    { min: 251, max: 500, hazard: "Tehlikeli", minutes: 480 },
    { min: 501, max: 1000, hazard: "Tehlikeli", minutes: 780 },
    { min: 1001, max: 2000, hazard: "Tehlikeli", minutes: 1320 },
    { min: 2001, max: Infinity, hazard: "Tehlikeli", minutes: 2400 },
    { min: 1, max: 10, hazard: "Çok Tehlikeli", minutes: 60 },
    { min: 11, max: 50, hazard: "Çok Tehlikeli", minutes: 180 },
    { min: 51, max: 100, hazard: "Çok Tehlikeli", minutes: 360 },
    { min: 101, max: 250, hazard: "Çok Tehlikeli", minutes: 600 },
    { min: 251, max: 500, hazard: "Çok Tehlikeli", minutes: 960 },
    { min: 501, max: 1000, hazard: "Çok Tehlikeli", minutes: 1560 },
    { min: 1001, max: 2000, hazard: "Çok Tehlikeli", minutes: 2640 },
    { min: 2001, max: Infinity, hazard: "Çok Tehlikeli", minutes: 4800 },
  ];

  const rule = rules.find(
    (item) => employeeCount >= item.min && employeeCount <= item.max && item.hazard === hazardClass,
  );

  return rule ? rule.minutes : 0;
}

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function normalizeHazardClass(value: string): string {
  const normalized = value.toLocaleLowerCase("tr-TR");
  if (normalized.includes("cok") || normalized.includes("çok")) return "Çok Tehlikeli";
  if (normalized.includes("tehlikeli")) return "Tehlikeli";
  return "Az Tehlikeli";
}

function firstDefined(...values: unknown[]): unknown | null {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function normalizeRemoteCompany(
  row: Record<string, unknown>,
  orgId: string,
  integration: Record<string, unknown>,
): CompanyData | null {
  const sgkNo = firstDefined(row.sgkNo, row.sgk_no, row.taxNo, row.tax_no, row.registration_no);
  const companyName = firstDefined(row.companyName, row.company_name, row.name, row.unvan);
  if (!sgkNo || !companyName) return null;

  const employeeCount = Number(firstDefined(row.employeeCount, row.employee_count, row.staffCount, row.staff_count) || 0);
  const hazardClass = normalizeHazardClass(String(firstDefined(row.hazardClass, row.hazard_class, row.dangerClass, row.danger_class) || "Az Tehlikeli"));
  const contractStart = firstDefined(row.contractStart, row.contract_start, row.startDate, row.start_date);
  const contractEnd = firstDefined(row.contractEnd, row.contract_end, row.endDate, row.end_date);
  const assignedMinutes = Number(firstDefined(row.assignedMinutes, row.assigned_minutes, row.serviceMinutes, row.service_minutes) || 0);

  return {
    orgId,
    sgkNo: String(sgkNo),
    companyName: String(companyName),
    employeeCount,
    hazardClass,
    contractStart: contractStart ? String(contractStart) : undefined,
    contractEnd: contractEnd ? String(contractEnd) : undefined,
    assignedMinutes,
    source: String(integration.integration_name || integration.provider || "external_integration"),
  };
}

async function fetchRemoteCompanies(integration: Record<string, unknown>) {
  const baseUrl = String(integration.base_url || "").replace(/\/+$/, "");
  const apiPath = String(integration.api_path || "/companies");
  const url = `${baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;

  const headers: HeadersInit = {
    Accept: "application/json",
  };

  const authHeaderName = Deno.env.get("ISGKATIP_REMOTE_AUTH_HEADER") || "x-api-key";
  const apiKey = Deno.env.get("ISGKATIP_REMOTE_API_KEY");
  const bearerToken = Deno.env.get("ISGKATIP_REMOTE_BEARER");

  if (apiKey) headers[authHeaderName] = apiKey;
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`Dis kaynak cevabi basarisiz: ${response.status}`);
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
