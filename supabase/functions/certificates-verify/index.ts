import { corsHeaders, createServiceClient, jsonResponse } from "../_shared/certificate-utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const verificationCode = url.searchParams.get("code");
    if (!verificationCode) {
      return jsonResponse({ error: "code is required" }, 400);
    }

    const supabase = createServiceClient();
    const { data: participant, error } = await supabase
      .from("certificate_participants")
      .select("*, certificates(*)")
      .eq("verification_code", verificationCode)
      .single();

    if (error || !participant) {
      return jsonResponse({ error: "Certificate not found" }, 404);
    }

    const { data: latestJob } = await supabase
      .from("certificate_jobs")
      .select("status, progress, completed_at")
      .eq("certificate_id", participant.certificate_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return jsonResponse({
      participant: {
        name: participant.name,
        job_title: participant.job_title,
        certificate_no: participant.certificate_no,
        verification_code: participant.verification_code,
      },
      certificate: participant.certificates,
      latestJob,
      verified: true,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
