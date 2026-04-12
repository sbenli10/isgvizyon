import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type DocumentRecord = {
  id: string;
  user_id: string;
  company_id: string;
  document_name: string;
  document_type: string;
  expiry_date: string | null;
  status: "active" | "warning" | "expired" | "archived";
  company?: { company_name: string | null } | null;
};

type DocumentQueryRow = {
  id: string;
  user_id: string;
  company_id: string;
  document_name: string;
  document_type: string;
  expiry_date: string | null;
  status: "active" | "warning" | "expired" | "archived";
  company?: Array<{ company_name: string | null }> | { company_name: string | null } | null;
};

type ExistingTaskRow = {
  id: string;
  user_id: string;
  related_document_id: string | null;
  status: string;
  title: string;
  source: string;
};

type PersonnelRecord = {
  id: string;
  user_id: string;
  full_name: string;
  role: "igu" | "hekim" | "dsp";
  certificate_expiry_date: string | null;
  is_active: boolean;
};

const roleLabel = (role: PersonnelRecord["role"]) => {
  if (role === "igu") return "İGU";
  if (role === "hekim") return "İşyeri Hekimi";
  return "DSP";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get("OSGB_BATCH_SECRET");
    const incomingSecret = req.headers.get("x-cron-secret");

    if (cronSecret && incomingSecret !== cronSecret) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: documents, error: documentsError } = await supabase
      .from("osgb_document_tracking")
      .select("id,user_id,company_id,document_name,document_type,expiry_date,status,company:isgkatip_companies(company_name)")
      .in("status", ["warning", "expired"])
      .order("expiry_date", { ascending: true });

    if (documentsError) throw documentsError;

    const actionableDocuments: DocumentRecord[] = ((documents ?? []) as DocumentQueryRow[]).map((document) => {
      const companyValue = Array.isArray(document.company) ? document.company[0] ?? null : document.company ?? null;
      return {
        id: document.id,
        user_id: document.user_id,
        company_id: document.company_id,
        document_name: document.document_name,
        document_type: document.document_type,
        expiry_date: document.expiry_date,
        status: document.status,
        company: companyValue,
      };
    });
    const userIds = Array.from(new Set(actionableDocuments.map((item) => item.user_id)));

    const { data: existingTasks, error: taskError } = await supabase
      .from("osgb_tasks")
      .select("id,user_id,related_document_id,status,title,source")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"])
      .neq("status", "cancelled");

    if (taskError) throw taskError;

    const { data: personnelRows, error: personnelError } = await supabase
      .from("osgb_personnel")
      .select("id,user_id,full_name,role,certificate_expiry_date,is_active")
      .eq("is_active", true)
      .not("certificate_expiry_date", "is", null);

    if (personnelError) throw personnelError;

    let created = 0;
    let skipped = 0;
    const perUserStats = new Map<string, { processed: number; created: number; skipped: number }>();

    for (const document of actionableDocuments) {
      const currentStats = perUserStats.get(document.user_id) ?? { processed: 0, created: 0, skipped: 0 };
      currentStats.processed += 1;
      perUserStats.set(document.user_id, currentStats);

      const duplicate = ((existingTasks ?? []) as ExistingTaskRow[]).some(
        (task) => task.user_id === document.user_id && task.related_document_id === document.id,
      );

      if (duplicate) {
        skipped += 1;
        currentStats.skipped += 1;
        continue;
      }

      const title = `Evrak yenileme: ${document.document_name}`;
      const description = `${document.company?.company_name || "Firma"} için ${document.document_type} belgesi takip edilmeli. Son geçerlilik: ${document.expiry_date || "-"}.`;

      const { error: insertError } = await supabase.from("osgb_tasks").insert({
        user_id: document.user_id,
        company_id: document.company_id,
        related_document_id: document.id,
        title,
        description,
        priority: document.status === "expired" ? "critical" : "high",
        status: "open",
        due_date: document.expiry_date,
        source: "document_batch",
      });

      if (insertError) throw insertError;
      created += 1;
      currentStats.created += 1;
    }

    const now = Date.now();
    const horizon = now + 1000 * 60 * 60 * 24 * 45;
    const actionablePersonnel = (personnelRows ?? []) as PersonnelRecord[];

    for (const person of actionablePersonnel) {
      if (!person.certificate_expiry_date) continue;
      const expiry = new Date(person.certificate_expiry_date).getTime();
      if (Number.isNaN(expiry) || expiry > horizon) continue;

      const currentStats = perUserStats.get(person.user_id) ?? { processed: 0, created: 0, skipped: 0 };
      currentStats.processed += 1;
      perUserStats.set(person.user_id, currentStats);

      const title = `Belge yenileme: ${person.full_name}`;
      const duplicate = ((existingTasks ?? []) as ExistingTaskRow[]).some(
        (task) =>
          task.user_id === person.user_id &&
          task.source === "personnel_certificate" &&
          task.title === title &&
          task.status !== "completed",
      );

      if (duplicate) {
        skipped += 1;
        currentStats.skipped += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("osgb_tasks").insert({
        user_id: person.user_id,
        title,
        description: `${person.full_name} için ${roleLabel(person.role)} belgesinin geçerlilik tarihi ${person.certificate_expiry_date}. Yenileme süreci başlatılmalı.`,
        priority: expiry < now ? "critical" : "high",
        status: "open",
        due_date: person.certificate_expiry_date,
        assigned_to: person.full_name,
        source: "personnel_certificate",
      });

      if (insertError) throw insertError;
      created += 1;
      currentStats.created += 1;
    }

    const userLogRows = Array.from(perUserStats.entries()).map(([userId, stats]) => ({
      user_id: userId,
      batch_type: "osgb_daily_batch",
      run_source: "cron",
      status: "success",
      processed_count: stats.processed,
      created_count: stats.created,
      skipped_count: stats.skipped,
      error_message: null,
    }));

    if (userLogRows.length > 0) {
      const { error: logError } = await supabase.from("osgb_batch_logs").insert(userLogRows);
      if (logError) throw logError;
    }

    return new Response(JSON.stringify({ success: true, created, skipped, total: actionableDocuments.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await supabase.from("osgb_batch_logs").insert({
          user_id: null,
          batch_type: "osgb_daily_batch",
          run_source: "cron",
          status: "error",
          processed_count: 0,
          created_count: 0,
          skipped_count: 0,
          error_message: message,
        });
      }
    } catch {
      // ignore secondary logging errors
    }
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
