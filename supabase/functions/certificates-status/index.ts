import { createServiceClient, getCorsHeaders, jsonResponse, requireAuthUser } from "../_shared/certificate-utils.ts";
import { requeueStaleCertificateItems, runCertificateWorker } from "../_shared/certificate-worker-runner.ts";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req.headers.get("origin")) });
  }

  try {
    await requireAuthUser(req);
    const url = new URL(req.url);
    const certificateId = normalizeText(url.searchParams.get("certificateId"));
    if (!certificateId) {
      return jsonResponse({ error: "certificateId is required" }, 400, req);
    }

    const supabase = createServiceClient();
    const { data: certificate, error: certificateError } = await supabase
      .from("certificates")
      .select("*")
      .eq("id", certificateId)
      .maybeSingle();
    if (certificateError) throw certificateError;
    if (!certificate) {
      return jsonResponse({ error: "Certificate not found" }, 404, req);
    }

    let { data: job, error: jobError } = await supabase
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
      }, 200, req);
    }

    await requeueStaleCertificateItems(supabase, job.id);

    let { data: items, error: itemError } = await supabase
      .from("certificate_job_items")
      .select("*, certificate_participants(name)")
      .eq("job_id", job.id)
      .order("created_at", { ascending: true });
    if (itemError) throw itemError;

    const pendingCount = (items || []).filter((item: any) => ["pending", "processing"].includes(item.status)).length;
    const shouldTriggerWorker = pendingCount > 0 && ["queued", "processing", "processing_with_errors"].includes(job.status);
    const shouldFinalizeZip = pendingCount === 0 && !job.zip_path && ["completed", "completed_with_errors"].includes(job.status);

    if (shouldTriggerWorker || shouldFinalizeZip) {
      try {
        await runCertificateWorker(job.id, 2, { maxBatches: 1 });
      } catch (workerTriggerError) {
        console.error("status worker trigger failed", { jobId: job.id, workerTriggerError });
      }

      const latestJobResponse = await supabase
        .from("certificate_jobs")
        .select("*")
        .eq("id", job.id)
        .maybeSingle();
      if (!latestJobResponse.error && latestJobResponse.data) {
        job = latestJobResponse.data;
      }

      const latestItemsResponse = await supabase
        .from("certificate_job_items")
        .select("*, certificate_participants(name)")
        .eq("job_id", job.id)
        .order("created_at", { ascending: true });
      if (!latestItemsResponse.error && latestItemsResponse.data) {
        items = latestItemsResponse.data;
      }
    }

    const mappedItems = (items || []).map((item: any) => {
      const participantRecord = Array.isArray(item.certificate_participants)
        ? item.certificate_participants[0]
        : item.certificate_participants;

      return {
        ...item,
        participant_name: participantRecord?.name || null,
      };
    });

    return jsonResponse({ certificate, job, items: mappedItems }, 200, req);
  } catch (error) {
    console.error("certificates-status failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});
