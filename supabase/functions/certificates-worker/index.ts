import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "https://esm.sh/@zip.js/zip.js@2.7.57";
import { corsHeaders, createServiceClient, jsonResponse, sanitizeFileName } from "../_shared/certificate-utils.ts";
import { generateCertificatePdf } from "../_shared/certificate-pdf.ts";

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

function buildUniqueZipFileName(baseName: string, participantId: string, usedNames: Set<string>) {
  const safeBaseName = sanitizeFileName(baseName || "sertifika") || "sertifika";
  const shortId = participantId.replace(/-/g, "").slice(0, 8).toLowerCase();
  let candidate = `${safeBaseName}-${shortId}.pdf`;
  let counter = 1;

  while (usedNames.has(candidate)) {
    candidate = `${safeBaseName}-${shortId}-${counter}.pdf`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

async function createZipBlob(files: Array<{ name: string; bytes: Uint8Array }>) {
  const writer = new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(writer);
  await zipWriter.add("README.txt", new TextReader("Bu klasör toplu sertifika çıktıları içerir."));
  for (const file of files) {
    await zipWriter.add(file.name, new Uint8ArrayReader(file.bytes));
  }
  await zipWriter.close();
  return await writer.getData();
}

async function updateJobSummary(supabase: ReturnType<typeof createServiceClient>, jobId: string, totalFiles: number) {
  const [{ count: completedCount }, { count: failedCount }, { count: pendingCount }, { data: failedRows }] = await Promise.all([
    supabase.from("certificate_job_items").select("*", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "completed"),
    supabase.from("certificate_job_items").select("*", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "failed"),
    supabase.from("certificate_job_items").select("*", { count: "exact", head: true }).eq("job_id", jobId).in("status", ["pending", "processing"]),
    supabase.from("certificate_job_items").select("participant_id, error_message").eq("job_id", jobId).eq("status", "failed").limit(5),
  ]);

  const completedFiles = completedCount || 0;
  const failedFiles = failedCount || 0;
  const remainingFiles = pendingCount || 0;
  const processedFiles = completedFiles + failedFiles;
  const progress = totalFiles > 0 ? Number(((processedFiles / totalFiles) * 100).toFixed(2)) : 0;
  const errorSummary = (failedRows || [])
    .map((row: any) => `${row.participant_id}: ${row.error_message || "Bilinmeyen hata"}`)
    .join(" | ");

  let status = "processing";
  if (remainingFiles > 0) {
    status = failedFiles > 0 ? "processing_with_errors" : "processing";
  } else if (completedFiles === totalFiles && failedFiles === 0) {
    status = "completed";
  } else if (completedFiles > 0 && failedFiles > 0) {
    status = "completed_with_errors";
  } else if (completedFiles > 0) {
    status = "completed";
  } else if (failedFiles > 0) {
    status = "failed";
  } else {
    status = "failed";
  }

  const updatePayload: Record<string, unknown> = {
    completed_files: completedFiles,
    progress,
    status,
    error_message: errorSummary || null,
  };

  if (status === "completed" || status === "completed_with_errors" || status === "failed") {
    updatePayload.completed_at = new Date().toISOString();
  }

  console.log("worker summary", { jobId, completedFiles, failedFiles, remainingFiles, processedFiles, progress, status, errorSummary });

  const { error: updateError } = await supabase.from("certificate_jobs").update(updatePayload).eq("id", jobId);
  if (updateError) {
    console.error("worker summary update failed", { jobId, updateError });
    throw updateError;
  }

  return { completedFiles, failedFiles, remainingFiles, processedFiles, progress, status };
}

async function finalizeZipIfReady(supabase: ReturnType<typeof createServiceClient>, job: any, totalFiles: number) {
  const { data: allItems, error: allItemsError } = await supabase
    .from("certificate_job_items")
    .select("pdf_path, participant_id, certificate_participants(name)")
    .eq("job_id", job.id)
    .eq("status", "completed");
  if (allItemsError) throw allItemsError;

  if (!allItems || allItems.length !== totalFiles) {
    return;
  }

  if (job.zip_path) {
    return;
  }

  const usedNames = new Set<string>(["README.txt"]);
  const fileEntries: Array<{ name: string; bytes: Uint8Array }> = [];
  for (const item of allItems) {
    const pdfPath = normalizeText(item.pdf_path);
    if (!pdfPath) continue;

    const { data, error: downloadError } = await supabase.storage.from("certificate-files").download(pdfPath);
    if (downloadError) {
      console.error("worker zip download failed", { jobId: job.id, pdfPath, downloadError });
      continue;
    }
    if (!data) continue;

    const participantName = normalizeText(item.certificate_participants?.name) || item.participant_id || "sertifika";
    fileEntries.push({
      name: buildUniqueZipFileName(participantName, item.participant_id, usedNames),
      bytes: new Uint8Array(await data.arrayBuffer()),
    });
  }

  if (fileEntries.length === 0) {
    return;
  }

  console.log("worker creating zip", { jobId: job.id, fileCount: fileEntries.length });
  const zipBlob = await createZipBlob(fileEntries);
  const zipPath = `archives/${job.certificate_id}/${job.id}.zip`;
  const { error: zipUploadError } = await supabase.storage.from("certificate-files").upload(zipPath, zipBlob, {
    contentType: "application/zip",
    upsert: true,
  });
  if (zipUploadError) {
    console.error("worker zip upload failed", { jobId: job.id, zipUploadError });
    throw zipUploadError;
  }

  const { error: zipUpdateError } = await supabase.from("certificate_jobs").update({ zip_path: zipPath }).eq("id", job.id);
  if (zipUpdateError) {
    console.error("worker zip path update failed", { jobId: job.id, zipUpdateError });
    throw zipUpdateError;
  }

  console.log("worker zip ready", { jobId: job.id, zipPath });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobId, concurrency = 2 } = await req.json();
    const normalizedJobId = normalizeText(jobId);
    const normalizedConcurrency = normalizePositiveInteger(concurrency, 2);

    if (!normalizedJobId) return jsonResponse({ error: "jobId is required" }, 400);

    const supabase = createServiceClient();
    const workerId = crypto.randomUUID();
    console.log("worker started", { jobId: normalizedJobId, concurrency: normalizedConcurrency, workerId });

    const { data: job, error: jobError } = await supabase
      .from("certificate_jobs")
      .select("*, certificates(*)")
      .eq("id", normalizedJobId)
      .single();
    if (jobError) throw jobError;
    if (!job?.certificates) {
      throw new Error("Certificate record not found for job");
    }

    const certificate = job.certificates;
    const totalFiles = Number(job.total_files) || 0;

    const staleThresholdIso = new Date(Date.now() - 45_000).toISOString();
    const { error: requeueError } = await supabase
      .from("certificate_job_items")
      .update({ status: "pending", worker_id: null })
      .eq("job_id", normalizedJobId)
      .eq("status", "processing")
      .lt("started_at", staleThresholdIso);
    if (requeueError) {
      console.error("worker stale processing requeue failed", { jobId: normalizedJobId, requeueError });
    }

    const { error: markProcessingError } = await supabase.from("certificate_jobs").update({ status: "processing" }).eq("id", normalizedJobId);
    if (markProcessingError) {
      console.error("worker failed to mark job as processing", { jobId: normalizedJobId, markProcessingError });
      throw markProcessingError;
    }

    const { data: pendingItems, error: pendingError } = await supabase
      .from("certificate_job_items")
      .select("*, certificate_participants(*)")
      .eq("job_id", normalizedJobId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(normalizedConcurrency);
    if (pendingError) throw pendingError;

    console.log("worker fetched pending items", { jobId: normalizedJobId, pendingCount: pendingItems?.length || 0, totalFiles });

    if (!pendingItems?.length) {
      const summary = await updateJobSummary(supabase, normalizedJobId, totalFiles);
      if (summary.completedFiles === totalFiles && totalFiles > 0) {
        await finalizeZipIfReady(supabase, job, totalFiles);
      }
      return jsonResponse({ ok: true, message: "No pending items", summary });
    }

    const pendingIds = pendingItems.map((item: any) => item.id);
    const { error: markItemsProcessingError } = await supabase
      .from("certificate_job_items")
      .update({ status: "processing", worker_id: workerId, started_at: new Date().toISOString() })
      .in("id", pendingIds);
    if (markItemsProcessingError) {
      console.error("worker failed to mark items as processing", { jobId: normalizedJobId, pendingIds, markItemsProcessingError });
      throw markItemsProcessingError;
    }

    for (const [index, item] of pendingItems.entries()) {
      const participant = item.certificate_participants;
      const participantName = normalizeText(participant?.name);
      const attemptCount = Number(item.attempt_count || 0) + 1;

      if (!participant?.id || !participantName) {
        console.error("worker invalid participant payload", { jobId: normalizedJobId, itemId: item.id, participant });
        await supabase.from("certificate_job_items").update({
          status: "failed",
          attempt_count: attemptCount,
          error_message: "Katılımcı verisi eksik veya adı boş.",
          completed_at: new Date().toISOString(),
        }).eq("id", item.id);
        continue;
      }

      try {
        console.log("worker generating pdf", { jobId: normalizedJobId, itemId: item.id, participantId: participant.id, participantName, attemptCount });
        const pdf = await generateCertificatePdf({
          certificate,
          participant: {
            ...participant,
            name: participantName,
            tc_no: normalizeText(participant.tc_no),
            job_title: normalizeText(participant.job_title),
            certificate_no: normalizeText(participant.certificate_no),
            pdf_path: normalizeText(participant.pdf_path),
            verification_code: normalizeText(participant.verification_code),
          },
          participantIndex: index,
          companyLabel: normalizeText(certificate.company_name) || "Firma Bilgisi Girilmedi",
        });

        const pdfPath = `pdf/${job.certificate_id}/${job.id}/${participant.id}.pdf`;
        const { error: uploadError } = await supabase.storage.from("certificate-files").upload(pdfPath, new Blob([pdf.bytes], { type: "application/pdf" }), {
          contentType: "application/pdf",
          upsert: true,
        });
        if (uploadError) {
          console.error("worker pdf upload failed", { jobId: normalizedJobId, itemId: item.id, participantId: participant.id, uploadError });
          throw uploadError;
        }

        const { error: participantUpdateError } = await supabase
          .from("certificate_participants")
          .update({ pdf_path: pdfPath, certificate_no: pdf.certificateNumber })
          .eq("id", participant.id);
        if (participantUpdateError) {
          console.error("worker participant update failed", { jobId: normalizedJobId, itemId: item.id, participantId: participant.id, participantUpdateError });
          throw participantUpdateError;
        }

        const { error: itemUpdateError } = await supabase.from("certificate_job_items").update({
          status: "completed",
          pdf_path: pdfPath,
          attempt_count: attemptCount,
          completed_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", item.id);
        if (itemUpdateError) {
          console.error("worker item complete update failed", { jobId: normalizedJobId, itemId: item.id, itemUpdateError });
          throw itemUpdateError;
        }

        console.log("worker item completed", { jobId: normalizedJobId, itemId: item.id, participantId: participant.id, pdfPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("worker item failed", { jobId: normalizedJobId, itemId: item.id, participantId: participant?.id, message, error });
        await supabase.from("certificate_job_items").update({
          status: "failed",
          attempt_count: attemptCount,
          error_message: message,
          completed_at: new Date().toISOString(),
        }).eq("id", item.id);
      }
    }

    const summary = await updateJobSummary(supabase, normalizedJobId, totalFiles);
    if (summary.completedFiles === totalFiles && totalFiles > 0) {
      await finalizeZipIfReady(supabase, job, totalFiles);
    }

    return jsonResponse({ ok: true, workerId, progress: summary.progress, status: summary.status, remainingFiles: summary.remainingFiles });
  } catch (error) {
    console.error("certificates-worker failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
