import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

type AutomationAction = {
  kind: "field_visit" | "document" | "finance";
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  priority: "medium" | "high" | "critical";
  dueDate: string | null;
  source: string;
};

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const buildTaskTitle = (action: AutomationAction) => {
  if (action.kind === "document") return `Belge aksiyonu: ${action.companyName}`;
  if (action.kind === "finance") return `Tahsilat aksiyonu: ${action.companyName}`;
  return `Hizmet kaniti: ${action.companyName}`;
};

const normalizePriority = (score: number): "medium" | "high" | "critical" => {
  if (score >= 80) return "critical";
  if (score >= 50) return "high";
  return "medium";
};

const resolveExecutionUser = async (supabase: ReturnType<typeof createClient>, organizationId: string, userId?: string | null) => {
  if (userId) return userId;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("Bu organizasyon icin gorev atanacak kullanici bulunamadi.");
  return data.id as string;
};

const listFieldVisitActions = async (supabase: ReturnType<typeof createClient>, organizationId: string): Promise<AutomationAction[]> => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("osgb_field_visits")
    .select(`
      id,
      company_id,
      company:isgkatip_companies(company_name),
      planned_start_at,
      actual_end_at,
      check_in_lat,
      check_in_lng,
      check_out_lat,
      check_out_lng,
      evidence:osgb_visit_evidence(id),
      personnel:osgb_visit_personnel(id, signed_at),
      visit_status
    `)
    .eq("organization_id", organizationId)
    .eq("visit_status", "completed")
    .gte("planned_start_at", monthStart.toISOString())
    .order("planned_start_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => {
      const evidenceCount = (row.evidence ?? []).length;
      const hasCheckIn = row.check_in_lat !== null && row.check_in_lng !== null;
      const hasCheckOut = row.check_out_lat !== null && row.check_out_lng !== null;
      const hasSignature = (row.personnel ?? []).some((item: any) => Boolean(item.signed_at));
      const proofScore = (hasCheckIn ? 20 : 0) + (hasCheckOut ? 20 : 0) + Math.min(30, evidenceCount * 15) + (hasSignature ? 30 : 0);
      return proofScore < 45;
    })
    .map((row: any) => ({
      kind: "field_visit" as const,
      companyId: row.company_id,
      companyName: row.company?.company_name || "Firma",
      title: `${row.company?.company_name || "Firma"} saha ziyareti tamamlandi ama hizmet kaniti eksik gorunuyor.`,
      description: "Check-in/check-out, fotograf veya imza kanitlari eksik oldugu icin hizmet kaydi zayif kaldı.",
      priority: "high" as const,
      dueDate: row.actual_end_at?.slice(0, 10) || row.planned_start_at?.slice(0, 10) || null,
      source: "automation_field_visit",
    }));
};

const listDocumentActions = async (supabase: ReturnType<typeof createClient>, organizationId: string): Promise<AutomationAction[]> => {
  const { data, error } = await supabase
    .from("osgb_required_documents")
    .select("id, company_id, document_type, required_reason, risk_if_missing, due_date, delay_days, risk_level, status, company:isgkatip_companies(company_name)")
    .eq("organization_id", organizationId)
    .eq("status", "missing")
    .order("delay_days", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => Number(row.delay_days || 0) > 0 || ["high", "critical"].includes(String(row.risk_level || "")))
    .map((row: any) => ({
      kind: "document" as const,
      companyId: row.company_id,
      companyName: row.company?.company_name || "Firma",
      title: `${row.company?.company_name || "Firma"} icin ${row.document_type} belgesi bekleniyor.`,
      description: row.risk_if_missing || row.required_reason || "Yasal yukumluluk icin belge gerekiyor.",
      priority: String(row.risk_level || "") === "critical" ? "critical" : "high",
      dueDate: row.due_date || null,
      source: "automation_document",
    }));
};

const listFinanceActions = async (supabase: ReturnType<typeof createClient>, organizationId: string): Promise<AutomationAction[]> => {
  const [accountsResponse, entriesResponse] = await Promise.all([
    supabase
      .from("osgb_finance_accounts")
      .select("company_id, overdue_balance, collection_risk_score, company:isgkatip_companies(company_name)")
      .eq("organization_id", organizationId),
    supabase
      .from("osgb_financial_entries")
      .select("company_id, entry_type, due_date, status")
      .eq("organization_id", organizationId)
      .eq("entry_type", "invoice"),
  ]);

  if (accountsResponse.error) throw accountsResponse.error;
  if (entriesResponse.error) throw entriesResponse.error;

  const lateInvoiceCount = new Map<string, number>();
  const now = new Date();
  for (const row of entriesResponse.data ?? []) {
    const isLate = row.status !== "paid" && row.status !== "cancelled" && row.due_date && new Date(row.due_date) < now;
    if (!isLate) continue;
    lateInvoiceCount.set(row.company_id, (lateInvoiceCount.get(row.company_id) || 0) + 1);
  }

  return (accountsResponse.data ?? [])
    .filter((row: any) => Number(row.overdue_balance || 0) > 0 || (lateInvoiceCount.get(row.company_id) || 0) > 0)
    .map((row: any) => ({
      kind: "finance" as const,
      companyId: row.company_id,
      companyName: row.company?.company_name || "Firma",
      title: `${row.company?.company_name || "Firma"} icin gecikmis tahsilat gorunuyor.`,
      description: `${lateInvoiceCount.get(row.company_id) || 0} acik fatura ve ${Number(row.overdue_balance || 0).toLocaleString("tr-TR")} TL gecikmis bakiye var.`,
      priority: normalizePriority(Number(row.collection_risk_score || 0)),
      dueDate: null,
      source: "automation_finance",
    }));
};

const ensureTask = async (
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  userId: string,
  action: AutomationAction,
) => {
  const title = buildTaskTitle(action);
  const { data: existing, error: existingError } = await supabase
    .from("osgb_tasks")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("company_id", action.companyId)
    .eq("title", title)
    .neq("status", "completed")
    .neq("status", "cancelled")
    .limit(1);

  if (existingError) throw existingError;
  if ((existing ?? []).length > 0) return false;

  const { error } = await supabase.from("osgb_tasks").insert({
    user_id: userId,
    organization_id: organizationId,
    company_id: action.companyId,
    title,
    description: `${action.title}\n\nNeden: ${action.description}`,
    priority: action.priority,
    status: "open",
    due_date: action.dueDate,
    source: action.source,
    created_by: userId,
  });

  if (error) throw error;
  return true;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("OSGB_BATCH_SECRET");
  const incomingSecret = req.headers.get("x-cron-secret");
  const hasAuthorization = Boolean(req.headers.get("authorization"));
  if (cronSecret && !hasAuthorization && incomingSecret !== cronSecret) {
    return jsonResponse(401, { success: false, error: "Unauthorized" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { organizationId, userId, source } = await req.json();
    if (!organizationId) {
      return jsonResponse(400, { success: false, error: "organizationId zorunlu." });
    }

    const executionUserId = await resolveExecutionUser(supabase, organizationId, userId);
    const [visitActions, documentActions, financeActions] = await Promise.all([
      listFieldVisitActions(supabase, organizationId),
      listDocumentActions(supabase, organizationId),
      listFinanceActions(supabase, organizationId),
    ]);

    const actions = [...visitActions, ...documentActions, ...financeActions];
    let createdTasks = 0;
    let skippedTasks = 0;

    for (const action of actions) {
      const created = await ensureTask(supabase, organizationId, executionUserId, action);
      if (created) createdTasks += 1;
      else skippedTasks += 1;
    }

    await supabase.from("osgb_batch_logs").insert({
      user_id: executionUserId,
      organization_id: organizationId,
      batch_type: "osgb_phase3_automation_batch",
      run_source: source || (incomingSecret ? "cron" : "manual"),
      status: "success",
      processed_count: actions.length,
      created_count: createdTasks,
      skipped_count: skippedTasks,
      error_message: null,
    });

    return jsonResponse(200, {
      success: true,
      processed: actions.length,
      createdTasks,
      skippedTasks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(500, { success: false, error: message });
  }
});
