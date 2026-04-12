// ====================================================
// COMPLIANCE CHECK EDGE FUNCTION
// ====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      case "CHECK_ALL":
        response = await checkAllCompanies(supabase, data.orgId);
        break;

      case "SAVE_FLAGS":
        response = await saveComplianceFlags(supabase, data);
        break;

      case "GET_DASHBOARD":
        response = await getComplianceDashboard(supabase, data.orgId);
        break;

      case "RESOLVE_FLAG":
        response = await resolveFlag(supabase, data);
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
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ====================================================
// CHECK ALL COMPANIES
// ====================================================
async function checkAllCompanies(supabase: any, orgId: string) {
  const { data: companies, error } = await supabase
    .from("isgkatip_companies")
    .select("*")
    .eq("org_id", orgId);

  if (error) throw error;

  const results = [];

  for (const company of companies) {
    const complianceResult = await performComplianceCheck(company);
    results.push(complianceResult);

    // Save flags
    for (const flag of complianceResult.flags) {
      await supabase.from("isgkatip_compliance_flags").upsert(
        {
          org_id: orgId,
          company_id: company.id,
          rule_name: flag.rule,
          severity: flag.severity,
          message: flag.message,
          details: flag.details || {},
          status: "OPEN",
        },
        { onConflict: "company_id,rule_name,status", ignoreDuplicates: true }
      );
    }

    // Update company risk score
    await supabase
      .from("isgkatip_companies")
      .update({ risk_score: complianceResult.riskScore })
      .eq("id", company.id);
  }

  return {
    success: true,
    checkedCount: companies.length,
    results,
  };
}

// ====================================================
// PERFORM COMPLIANCE CHECK
// ====================================================
function performComplianceCheck(company: any) {
  const flags = [];
  let riskScore = 0;

  // Duration check
  if (company.assigned_minutes < company.required_minutes * 0.9) {
    flags.push({
      rule: "DURATION_CHECK",
      severity: "CRITICAL",
      message: `Eksik süre: ${company.required_minutes - company.assigned_minutes} dk/ay`,
      details: {
        required: company.required_minutes,
        assigned: company.assigned_minutes,
      },
    });
    riskScore += 30;
  } else if (company.assigned_minutes < company.required_minutes) {
    flags.push({
      rule: "DURATION_CHECK",
      severity: "WARNING",
      message: "Sınır değerde süre",
      details: {
        required: company.required_minutes,
        assigned: company.assigned_minutes,
      },
    });
    riskScore += 15;
  }

  // Contract expiry
  if (company.contract_end) {
    const daysUntil = getDaysUntil(company.contract_end);

    if (daysUntil < 0) {
      flags.push({
        rule: "CONTRACT_EXPIRY",
        severity: "CRITICAL",
        message: `Sözleşme süresi ${Math.abs(daysUntil)} gün önce doldu`,
        details: { contractEnd: company.contract_end },
      });
      riskScore += 40;
    } else if (daysUntil <= 30) {
      flags.push({
        rule: "CONTRACT_EXPIRY",
        severity: "WARNING",
        message: `Sözleşme ${daysUntil} gün içinde dolacak`,
        details: { contractEnd: company.contract_end, daysUntil },
      });
      riskScore += 20;
    }
  }

  // Kurul obligation
  if (company.employee_count >= 50) {
    flags.push({
      rule: "KURUL_OBLIGATION",
      severity: "INFO",
      message: "İSG Kurulu zorunluluğu var",
      details: { employeeCount: company.employee_count },
    });
    riskScore += 5;
  }

  // Hazard class checks
  if (company.hazard_class === "Çok Tehlikeli") {
    flags.push({
      rule: "HAZARD_CLASS_CHECK",
      severity: "INFO",
      message: "Aylık ziyaret zorunluluğu",
      details: { hazardClass: company.hazard_class },
    });
    riskScore += 5;
  }

  // Normalize risk score
  riskScore = Math.min(riskScore, 100);

  return {
    companyId: company.id,
    sgkNo: company.sgk_no,
    companyName: company.company_name,
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    flags,
  };
}

// ====================================================
// GET COMPLIANCE DASHBOARD
// ====================================================
async function getComplianceDashboard(supabase: any, orgId: string) {
  // Get companies with flags
  const { data: companies, error: companiesError } = await supabase
    .from("vw_compliance_dashboard")
    .select("*")
    .eq("org_id", orgId);

  if (companiesError) throw companiesError;

  // Get summary stats
  const stats = {
    totalCompanies: companies.length,
    compliant: companies.filter((c: any) => c.compliance_status === "COMPLIANT").length,
    warning: companies.filter((c: any) => c.compliance_status === "WARNING").length,
    critical: companies.filter((c: any) => c.compliance_status === "CRITICAL").length,
    expiringContracts: companies.filter((c: any) => c.contract_status === "EXPIRING_SOON").length,
    expiredContracts: companies.filter((c: any) => c.contract_status === "EXPIRED").length,
    criticalFlags: companies.reduce((sum: number, c: any) => sum + c.critical_flags_count, 0),
    warningFlags: companies.reduce((sum: number, c: any) => sum + c.warning_flags_count, 0),
  };

  return {
    success: true,
    companies,
    stats,
  };
}

// ====================================================
// SAVE COMPLIANCE FLAGS
// ====================================================
async function saveComplianceFlags(supabase: any, data: any) {
  const { orgId, companyId, flags } = data;

  for (const flag of flags) {
    await supabase.from("isgkatip_compliance_flags").upsert(
      {
        org_id: orgId,
        company_id: companyId,
        rule_name: flag.rule,
        severity: flag.severity,
        message: flag.message,
        details: flag.details || {},
        status: "OPEN",
      },
      { onConflict: "company_id,rule_name,status", ignoreDuplicates: true }
    );
  }

  return { success: true, savedCount: flags.length };
}

// ====================================================
// RESOLVE FLAG
// ====================================================
async function resolveFlag(supabase: any, data: any) {
  const { flagId, userId, notes } = data;

  const { error } = await supabase
    .from("isgkatip_compliance_flags")
    .update({
      status: "RESOLVED",
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_notes: notes,
    })
    .eq("id", flagId);

  if (error) throw error;

  return { success: true };
}

// ====================================================
// HELPERS
// ====================================================
function getDaysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getRiskLevel(score: number) {
  if (score >= 70) return { level: "CRITICAL", label: "Kritik", color: "red" };
  if (score >= 40) return { level: "HIGH", label: "Yüksek", color: "orange" };
  if (score >= 20) return { level: "MEDIUM", label: "Orta", color: "yellow" };
  return { level: "LOW", label: "Düşük", color: "green" };
}

console.log("🟢 compliance-check Edge Function loaded");