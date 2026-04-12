import { corsHeaders, createServiceClient, jsonResponse, requireAuthUser, workerBaseUrl } from "../_shared/certificate-utils.ts";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 4);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuthUser(req);
    const { certificateId, workerConcurrency = 2 } = await req.json();
    const normalizedCertificateId = normalizeText(certificateId);
    const normalizedConcurrency = normalizePositiveInteger(workerConcurrency, 2);

    if (!normalizedCertificateId) {
      return jsonResponse({ error: "certificateId is required" }, 400);
    }

    const supabase = createServiceClient();
    console.log("generate started", { certificateId: normalizedCertificateId, workerConcurrency: normalizedConcurrency });

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

    const validParticipants = (participants || []).filter((participant: any) => normalizeText(participant?.name));
    console.log("generate participants loaded", {
      certificateId: normalizedCertificateId,
      participantCount: participants?.length || 0,
      validParticipantCount: validParticipants.length,
    });

    if (!validParticipants.length) {
      return jsonResponse({ error: "No valid participants found" }, 400);
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

    console.log("generate job created", { certificateId: normalizedCertificateId, jobId: job.id, totalFiles: validParticipants.length });

    const { error: itemsError } = await supabase.from("certificate_job_items").insert(
      validParticipants.map((participant: any) => ({
        job_id: job.id,
        certificate_id: normalizedCertificateId,
        participant_id: participant.id,
        status: "pending",
      }))
    );
    if (itemsError) throw itemsError;

    console.log("generate job items created", { jobId: job.id, itemCount: validParticipants.length });

    try {
      const workerResponse = await fetch(`${workerBaseUrl()}/certificates-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
        },
        body: JSON.stringify({ jobId: job.id, concurrency: normalizedConcurrency }),
      });

      console.log("generate worker trigger response", { jobId: job.id, status: workerResponse.status });
    } catch (workerTriggerError) {
      console.error("generate worker trigger failed", { jobId: job.id, workerTriggerError });
    }

    return jsonResponse({ certificate, job });
  } catch (error) {
    console.error("certificates-generate failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
