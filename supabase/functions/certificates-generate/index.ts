import { createServiceClient, getCorsHeaders, jsonResponse, requireAuthUser } from "../_shared/certificate-utils.ts";
import { normalizeWorkerConcurrency, runCertificateWorker } from "../_shared/certificate-worker-runner.ts";

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
    const { certificateId, workerConcurrency = 2, retryFailedOnly = false } = await req.json();
    const normalizedCertificateId = normalizeText(certificateId);
    const normalizedConcurrency = normalizeWorkerConcurrency(workerConcurrency, 2);

    if (!normalizedCertificateId) {
      return jsonResponse({ error: "certificateId is required" }, 400, req);
    }

    const supabase = createServiceClient();
    console.log("[Certificates] generation requested", {
      certificateId: normalizedCertificateId,
      workerConcurrency: normalizedConcurrency,
      retryFailedOnly: Boolean(retryFailedOnly),
    });

    const { data: certificate, error: certificateError } = await supabase
      .from("certificates")
      .select("*")
      .eq("id", normalizedCertificateId)
      .single();
    if (certificateError) throw certificateError;

    const { data: participants, error: participantError } = await supabase
      .from("certificate_participants")
      .select("*")
      .eq("certificate_id", normalizedCertificateId)
      .order("created_at", { ascending: true });
    if (participantError) throw participantError;

    let validParticipants = (participants || []).filter((participant: any) => normalizeText(participant?.name));
    if (!validParticipants.length) {
      return jsonResponse({ error: "No valid participants found" }, 400, req);
    }

    if (retryFailedOnly) {
      const { data: latestJob, error: latestJobError } = await supabase
        .from("certificate_jobs")
        .select("id")
        .eq("certificate_id", normalizedCertificateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestJobError) throw latestJobError;
      if (!latestJob?.id) {
        return jsonResponse({ error: "Retry edilecek üretim kaydı bulunamadı." }, 400, req);
      }

      const { data: failedItems, error: failedItemsError } = await supabase
        .from("certificate_job_items")
        .select("participant_id")
        .eq("job_id", latestJob.id)
        .eq("status", "failed");

      if (failedItemsError) throw failedItemsError;

      const failedParticipantIds = new Set((failedItems || []).map((item: any) => item.participant_id).filter(Boolean));
      validParticipants = validParticipants.filter((participant: any) => failedParticipantIds.has(participant.id));

      if (!validParticipants.length) {
        return jsonResponse({ error: "Tekrar denenecek hatalı sertifika bulunamadı." }, 400, req);
      }
    }

    const { data: job, error: jobError } = await supabase
      .from("certificate_jobs")
      .insert({
        certificate_id: normalizedCertificateId,
        status: "queued",
        total_files: validParticipants.length,
        completed_files: 0,
        progress: 0,
        started_at: new Date().toISOString(),
        error_message: null,
        zip_path: null,
      })
      .select()
      .single();
    if (jobError) throw jobError;

    const { error: itemsError } = await supabase.from("certificate_job_items").insert(
      validParticipants.map((participant: any) => ({
        job_id: job.id,
        certificate_id: normalizedCertificateId,
        participant_id: participant.id,
        status: "pending",
      })),
    );
    if (itemsError) throw itemsError;

    console.log("[Certificates] queue created", { certificateId: normalizedCertificateId, jobId: job.id, itemCount: validParticipants.length });

    try {
      await runCertificateWorker(job.id, normalizedConcurrency, { maxBatches: 1 });
    } catch (workerTriggerError) {
      console.error("[Certificates] processor start failed", { jobId: job.id, workerTriggerError });
      const workerMessage = "Sertifika üretim işlemi başlatılamadı.";

      await supabase
        .from("certificate_jobs")
        .update({
          status: "failed",
          error_message: workerMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return jsonResponse(
        {
          error: workerMessage,
          certificate,
          job: {
            ...job,
            status: "failed",
            error_message: workerMessage,
            completed_at: new Date().toISOString(),
          },
        },
        500,
        req,
      );
    }

    const { data: latestJob, error: latestJobError } = await supabase
      .from("certificate_jobs")
      .select("*")
      .eq("id", job.id)
      .maybeSingle();
    if (latestJobError) throw latestJobError;

    return jsonResponse({ certificate, job: latestJob || job }, 200, req);
  } catch (error) {
    console.error("certificates-generate failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});
