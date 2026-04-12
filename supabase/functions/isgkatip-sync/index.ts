// ====================================================
// İSG-KATİP SYNC EDGE FUNCTION
// ====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ====================================================
// TYPES
// ====================================================
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
  details: any;
  source: string;
}

// ====================================================
// MAIN HANDLER
// ====================================================
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const { action, data } = await req.json();

    console.log("📥 Received action:", action);

    // Route to handler
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

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ====================================================
// SYNC COMPANY
// ====================================================
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

  // Validate
  if (!orgId || !sgkNo || !companyName) {
    throw new Error("Missing required fields: orgId, sgkNo, companyName");
  }

  // Calculate required minutes (mevzuat tablosu)
  const requiredMinutes = calculateRequiredMinutes(employeeCount, hazardClass);

  console.log(`✅ Required minutes for ${sgkNo}:`, requiredMinutes);

  // Upsert company
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
      }
    )
    .select()
    .single();

  if (companyError) {
    console.error("❌ Company upsert error:", companyError);
    throw companyError;
  }

  console.log("✅ Company synced:", companyData.id);

  // Run compliance check
  await runComplianceCheck(supabase, companyData);

  // Log audit
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

// ====================================================
// BATCH SYNC
// ====================================================
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

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  console.log(`✅ Batch sync completed: ${successCount} success, ${errorCount} errors`);

  return {
    success: true,
    results,
    summary: { total: companies.length, success: successCount, errors: errorCount },
  };
}

// ====================================================
// GET COMPANIES
// ====================================================
async function handleGetCompanies(supabase: any, data: any) {
  const { orgId, filters } = data;

  let query = supabase
    .from("isgkatip_companies")
    .select("*")
    .eq("org_id", orgId);

  // Apply filters
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

// ====================================================
// COMPLIANCE CHECK
// ====================================================
async function runComplianceCheck(supabase: any, company: any) {
  const flags = [];

  // Rule 1: Duration check
  if (company.assigned_minutes < company.required_minutes * 0.9) {
    flags.push({
      rule_name: "DURATION_CHECK",
      severity: "CRITICAL",
      message: `Eksik süre: ${company.required_minutes - company.assigned_minutes} dk/ay`,
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
      message: "Sınır değerde süre ataması",
      details: {
        required: company.required_minutes,
        assigned: company.assigned_minutes,
      },
    });
  }

  // Rule 2: Contract expiry
  if (company.contract_end) {
    const daysUntilExpiry = getDaysUntil(company.contract_end);

    if (daysUntilExpiry < 0) {
      flags.push({
        rule_name: "CONTRACT_EXPIRY",
        severity: "CRITICAL",
        message: `Sözleşme ${Math.abs(daysUntilExpiry)} gün önce sona erdi`,
        details: { contract_end: company.contract_end },
      });
    } else if (daysUntilExpiry <= 30) {
      flags.push({
        rule_name: "CONTRACT_EXPIRY",
        severity: "WARNING",
        message: `Sözleşme ${daysUntilExpiry} gün içinde sona erecek`,
        details: { contract_end: company.contract_end, days_until: daysUntilExpiry },
      });
    }
  }

  // Rule 3: Kurul obligation
  if (company.employee_count >= 50) {
    flags.push({
      rule_name: "KURUL_OBLIGATION",
      severity: "INFO",
      message: "İSG Kurulu zorunluluğu var (50+ çalışan)",
      details: { employee_count: company.employee_count },
    });
  }

  // Save flags
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
      { onConflict: "company_id,rule_name,status", ignoreDuplicates: true }
    );
  }

  console.log(`✅ Compliance check completed: ${flags.length} flags`);
}

// ====================================================
// AUDIT LOG
// ====================================================
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
    console.error("❌ Audit log error:", error);
  } else {
    console.log("✅ Audit logged:", logData.action);
  }
}

// ====================================================
// HELPERS
// ====================================================
function calculateRequiredMinutes(employeeCount: number, hazardClass: string): number {
  const rules = [
    // Az Tehlikeli
    { min: 1, max: 10, hazard: "Az Tehlikeli", minutes: 20 },
    { min: 11, max: 50, hazard: "Az Tehlikeli", minutes: 45 },
    { min: 51, max: 100, hazard: "Az Tehlikeli", minutes: 90 },
    { min: 101, max: 250, hazard: "Az Tehlikeli", minutes: 150 },
    { min: 251, max: 500, hazard: "Az Tehlikeli", minutes: 240 },
    { min: 501, max: 1000, hazard: "Az Tehlikeli", minutes: 390 },
    { min: 1001, max: 2000, hazard: "Az Tehlikeli", minutes: 660 },
    { min: 2001, max: Infinity, hazard: "Az Tehlikeli", minutes: 1200 },

    // Tehlikeli
    { min: 1, max: 10, hazard: "Tehlikeli", minutes: 30 },
    { min: 11, max: 50, hazard: "Tehlikeli", minutes: 90 },
    { min: 51, max: 100, hazard: "Tehlikeli", minutes: 180 },
    { min: 101, max: 250, hazard: "Tehlikeli", minutes: 300 },
    { min: 251, max: 500, hazard: "Tehlikeli", minutes: 480 },
    { min: 501, max: 1000, hazard: "Tehlikeli", minutes: 780 },
    { min: 1001, max: 2000, hazard: "Tehlikeli", minutes: 1320 },
    { min: 2001, max: Infinity, hazard: "Tehlikeli", minutes: 2400 },

    // Çok Tehlikeli
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
    (r) =>
      employeeCount >= r.min &&
      employeeCount <= r.max &&
      r.hazard === hazardClass
  );

  return rule ? rule.minutes : 0;
}

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

console.log("🟢 isgkatip-sync Edge Function loaded");