import { corsHeaders, jsonResponse } from "../_shared/certificate-utils.ts";
import { normalizeWorkerConcurrency, runCertificateWorker } from "../_shared/certificate-worker-runner.ts";

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
    const { jobId, concurrency = 2 } = await req.json();
    const normalizedJobId = normalizeText(jobId);
    const normalizedConcurrency = normalizeWorkerConcurrency(concurrency, 2);

    if (!normalizedJobId) {
      return jsonResponse({ error: "jobId is required" }, 400);
    }

    const result = await runCertificateWorker(normalizedJobId, normalizedConcurrency, { maxBatches: 1 });
    return jsonResponse(result);
  } catch (error) {
    console.error("certificates-worker failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
