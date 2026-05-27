import { createServiceClient, getCorsHeaders, jsonResponse, requireAuthUser } from "../_shared/certificate-utils.ts";

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
    const { data: job, error: jobError } = await supabase
      .from("certificate_jobs")
      .select("id, certificate_id, zip_path, status, progress, completed_files, total_files, error_message")
      .eq("certificate_id", certificateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (jobError) throw jobError;

    if (!job) {
      return jsonResponse({
        id: null,
        certificate_id: certificateId,
        status: "draft",
        progress: 0,
        completed_files: 0,
        total_files: 0,
        zip_path: null,
        error_message: null,
        downloadUrl: null,
      }, 200, req);
    }

    let downloadUrl: string | null = null;
    const zipPath = normalizeText(job.zip_path);
    if (zipPath) {
      const { data, error: signedUrlError } = await supabase.storage.from("certificate-files").createSignedUrl(zipPath, 3600);
      if (signedUrlError) {
        console.error("certificates-download signed url failed", signedUrlError);
      } else {
        downloadUrl = data?.signedUrl ?? null;
      }
    }

    return jsonResponse({ ...job, zip_path: zipPath, downloadUrl }, 200, req);
  } catch (error) {
    console.error("certificates-download failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});
