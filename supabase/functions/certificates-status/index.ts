import { corsHeaders, createServiceClient, jsonResponse, requireAuthUser, workerBaseUrl } from "../_shared/certificate-utils.ts";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuthUser(req);
    const url = new URL(req.url);
    const certificateId = normalizeText(url.searchParams.get("certificateId"));
    if (!certificateId) {
      return jsonResponse({ error: "certificateId is required" }, 400);
    }

    const supabase = createServiceClient();
    const { data: certificate, error: certificateError } = await supabase
      .from("certificates")
      .select("*")
      .eq("id", certificateId)
      .maybeSingle();
    if (certificateError) throw certificateError;
    if (!certificate) {
      return jsonResponse({ error: "Certificate not found" }, 404);
    }

    const { data: job, error: jobError } = await supabase
      .from("certificate_jobs")
      .select("*")
      .eq("certificate_id", certificateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (jobError) throw jobError;

    if (!job) {
      return jsonResponse({
        certificate,
        job: {
          id: null,
          certificate_id: certificateId,
          status: "draft",
          progress: 0,
          total_files: 0,
          completed_files: 0,
          zip_path: null,
          error_message: null,
        },
        items: [],
      });
    }

    const staleThresholdIso = new Date(Date.now() - 45_000).toISOString();
    const { error: requeueError } = await supabase
      .from("certificate_job_items")
      .update({ status: "pending", worker_id: null })
      .eq("job_id", job.id)
      .eq("status", "processing")
      .lt("started_at", staleThresholdIso);
    if (requeueError) {
      console.error("status stale processing requeue failed", { jobId: job.id, requeueError });
    }

    const { data: items, error: itemError } = await supabase
      .from("certificate_job_items")
      .select("*, certificate_participants(name)")
      .eq("job_id", job.id)
      .order("created_at", { ascending: true });
    if (itemError) throw itemError;

    const mappedItems = (items || []).map((item: any) => ({
      ...item,
      participant_name: item.certificate_participants?.name || null,
    }));

    const pendingCount = mappedItems.filter((item: any) => ["pending", "processing"].includes(item.status)).length;
    const shouldTriggerWorker = pendingCount > 0 && ["queued", "processing", "processing_with_errors"].includes(job.status);
    const shouldFinalizeZip = pendingCount === 0 && !job.zip_path && ["completed", "completed_with_errors"].includes(job.status);

    if (shouldTriggerWorker || shouldFinalizeZip) {
      try {
        const response = await fetch(`${workerBaseUrl()}/certificates-worker`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          },
          body: JSON.stringify({ jobId: job.id, concurrency: 2 }),
        });
        console.log("status triggered worker", { jobId: job.id, pendingCount, shouldFinalizeZip, status: response.status });
      } catch (workerTriggerError) {
        console.error("status worker trigger failed", { jobId: job.id, workerTriggerError });
      }
    }

    return jsonResponse({ certificate, job, items: mappedItems });
  } catch (error) {
    console.error("certificates-status failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
