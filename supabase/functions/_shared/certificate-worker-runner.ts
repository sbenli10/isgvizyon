import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "https://esm.sh/@zip.js/zip.js@2.7.57";
import { createServiceClient, sanitizeFileName } from "./certificate-utils.ts";
import { generateCertificatePdf } from "./certificate-pdf.ts";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function normalizeWorkerConcurrency(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 4);
}

type RunCertificateWorkerOptions = {
  maxBatches?: number;
};

export async function requeueStaleCertificateItems(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string,
  staleThresholdMs = 45_000,
) {
  const staleThresholdIso = new Date(Date.now() - staleThresholdMs).toISOString();
  const { error } = await supabase
    .from("certificate_job_items")
    .update({ status: "pending", worker_id: null })
    .eq("job_id", jobId)
    .eq("status", "processing")
    .lt("started_at", staleThresholdIso);

  if (error) {
    console.error("worker stale processing requeue failed", { jobId, error });
  }
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

  if (!allItems || allItems.length !== totalFiles) return;
  if (job.zip_path) return;

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

    const participantRecord = Array.isArray(item.certificate_participants)
      ? item.certificate_participants[0]
      : item.certificate_participants;
    const participantName = normalizeText(participantRecord?.name) || item.participant_id || "sertifika";
    fileEntries.push({
      name: buildUniqueZipFileName(participantName, item.participant_id, usedNames),
      bytes: new Uint8Array(await data.arrayBuffer()),
    });
  }

  if (fileEntries.length === 0) return;

  const zipBlob = await createZipBlob(fileEntries);
  const zipPath = `archives/${job.certificate_id}/${job.id}.zip`;
  const { error: zipUploadError } = await supabase.storage.from("certificate-files").upload(zipPath, zipBlob, {
    contentType: "application/zip",
    upsert: true,
  });
  if (zipUploadError) throw zipUploadError;

  const { error: zipUpdateError } = await supabase.from("certificate_jobs").update({ zip_path: zipPath }).eq("id", job.id);
  if (zipUpdateError) throw zipUpdateError;
}

export async function runCertificateWorker(jobId: string, concurrency = 2, options: RunCertificateWorkerOptions = {}) {
  const supabase = createServiceClient();
  const workerId = crypto.randomUUID();
  const normalizedConcurrency = normalizeWorkerConcurrency(concurrency, 2);
  const maxBatches = Number.isFinite(options.maxBatches) && Number(options.maxBatches) > 0
    ? Math.max(1, Math.floor(Number(options.maxBatches)))
    : Number.POSITIVE_INFINITY;

  console.log("[Certificates] processor started", { jobId, concurrency: normalizedConcurrency, workerId });

  const { data: job, error: jobError } = await supabase
    .from("certificate_jobs")
    .select("*, certificates(*)")
    .eq("id", jobId)
    .single();
  if (jobError) throw jobError;
  if (!job?.certificates) {
    throw new Error("Certificate record not found for job");
  }

  const certificate = job.certificates;
  const totalFiles = Number(job.total_files) || 0;

  await requeueStaleCertificateItems(supabase, jobId);

  const { error: markProcessingError } = await supabase
    .from("certificate_jobs")
    .update({ status: "processing", error_message: null })
    .eq("id", jobId);
  if (markProcessingError) throw markProcessingError;

  let processedBatches = 0;
  let summary = await updateJobSummary(supabase, jobId, totalFiles);

  while (true) {
    const { data: pendingItems, error: pendingError } = await supabase
      .from("certificate_job_items")
      .select("*, certificate_participants(*)")
      .eq("job_id", jobId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(normalizedConcurrency);
    if (pendingError) throw pendingError;
    if (!pendingItems?.length) break;

    const pendingIds = pendingItems.map((item: any) => item.id);
    const { error: markItemsProcessingError } = await supabase
      .from("certificate_job_items")
      .update({ status: "processing", worker_id: workerId, started_at: new Date().toISOString() })
      .in("id", pendingIds);
    if (markItemsProcessingError) throw markItemsProcessingError;

    for (const [index, item] of pendingItems.entries()) {
      const participant = item.certificate_participants;
      const participantName = normalizeText(participant?.name);
      const attemptCount = Number(item.attempt_count || 0) + 1;
      const participantIndex = processedBatches * normalizedConcurrency + index;

      if (!participant?.id || !participantName) {
        await supabase.from("certificate_job_items").update({
          status: "failed",
          attempt_count: attemptCount,
          error_message: "Katılımcı verisi eksik veya adı boş.",
          completed_at: new Date().toISOString(),
        }).eq("id", item.id);
        continue;
      }

      try {
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
          participantIndex,
          companyLabel: normalizeText(certificate.company_name) || "Firma Bilgisi Girilmedi",
        });

        const pdfPath = `pdf/${job.certificate_id}/${job.id}/${participant.id}.pdf`;
        const { error: uploadError } = await supabase.storage.from("certificate-files").upload(pdfPath, pdf.bytes, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (uploadError) {
          throw new Error("Sertifika dosyası depolama alanına yüklenemedi.");
        }

        const { error: participantUpdateError } = await supabase
          .from("certificate_participants")
          .update({ pdf_path: pdfPath, certificate_no: pdf.certificateNumber })
          .eq("id", participant.id);
        if (participantUpdateError) throw participantUpdateError;

        const { error: itemUpdateError } = await supabase.from("certificate_job_items").update({
          status: "completed",
          pdf_path: pdfPath,
          attempt_count: attemptCount,
          completed_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", item.id);
        if (itemUpdateError) throw itemUpdateError;

        console.log("[Certificates] certificate generated", { jobId, itemId: item.id, participantId: participant.id, pdfPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sertifika PDF'i oluşturulamadı.";
        console.error("[Certificates] certificate generation failed", { jobId, itemId: item.id, participantId: participant?.id, message });
        await supabase.from("certificate_job_items").update({
          status: "failed",
          attempt_count: attemptCount,
          error_message: message,
          completed_at: new Date().toISOString(),
        }).eq("id", item.id);
      }
    }

    processedBatches += 1;
    summary = await updateJobSummary(supabase, jobId, totalFiles);
    if (summary.remainingFiles <= 0) break;
    if (processedBatches >= maxBatches) break;
  }

  summary = await updateJobSummary(supabase, jobId, totalFiles);
  if (summary.completedFiles === totalFiles && totalFiles > 0) {
    await finalizeZipIfReady(supabase, job, totalFiles);
  }

  console.log("[Certificates] generation completed", { jobId, status: summary.status, progress: summary.progress });
  return { ok: true, workerId, progress: summary.progress, status: summary.status, remainingFiles: summary.remainingFiles };
}
