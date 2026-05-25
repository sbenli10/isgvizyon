import {
  buildCertificateNumber,
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  requireAuthUser,
} from "../_shared/certificate-utils.ts";
import { generateCertificatePdf } from "../_shared/certificate-pdf.ts";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStoragePath(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return null;

  let path = raw.split("?")[0].split("#")[0];
  path = path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\/certificate-files\//i, "");
  path = path.replace(/^certificate-files\//i, "");
  path = path.replace(/^\/+/, "");

  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep original path when decodeURIComponent fails.
  }

  return path.replace(/^\/+/, "") || null;
}

async function createSignedUrlIfExists(supabase: ReturnType<typeof createServiceClient>, path: string) {
  const { data, error } = await supabase.storage.from("certificate-files").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req.headers.get("origin")) });
  }

  try {
    const user = await requireAuthUser(req);
    const url = new URL(req.url);
    const itemId = normalizeText(url.searchParams.get("itemId"));
    if (!itemId) {
      return jsonResponse({ error: "itemId is required" }, 400, req);
    }

    const supabase = createServiceClient();
    const { data: item, error: itemError } = await supabase
      .from("certificate_job_items")
      .select("*, certificates(*), certificate_participants(*)")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) {
      return jsonResponse({ error: "Sertifika PDF kaydı bulunamadı." }, 404, req);
    }

    const certificate = item.certificates;
    const participant = item.certificate_participants;
    if (!certificate || certificate.created_by !== user.id) {
      return jsonResponse({ error: "Bu sertifika dosyasına erişim yetkiniz yok." }, 403, req);
    }
    if (!participant?.id || !normalizeText(participant.name)) {
      return jsonResponse({ error: "Katılımcı bilgisi eksik olduğu için PDF oluşturulamadı." }, 400, req);
    }

    const existingPath = normalizeStoragePath(item.pdf_path || participant.pdf_path);
    if (existingPath) {
      const existingSignedUrl = await createSignedUrlIfExists(supabase, existingPath);
      if (existingSignedUrl) {
        return jsonResponse(
          {
            downloadUrl: existingSignedUrl,
            pdfPath: existingPath,
            regenerated: false,
          },
          200,
          req,
        );
      }

      console.warn("certificate item pdf missing, regenerating", {
        itemId,
        certificateId: item.certificate_id,
        participantId: item.participant_id,
        path: existingPath,
      });
    }

    const { data: participants, error: participantListError } = await supabase
      .from("certificate_participants")
      .select("id")
      .eq("certificate_id", item.certificate_id)
      .order("created_at", { ascending: true });
    if (participantListError) throw participantListError;

    const participantIndex = Math.max(
      0,
      (participants || []).findIndex((row: { id: string }) => row.id === participant.id),
    );
    const certificateNumber =
      normalizeText(participant.certificate_no) || buildCertificateNumber(item.certificate_id, participantIndex);

    const pdf = await generateCertificatePdf({
      certificate,
      participant: {
        ...participant,
        name: normalizeText(participant.name) || "Katılımcı",
        tc_no: normalizeText(participant.tc_no),
        job_title: normalizeText(participant.job_title),
        certificate_no: certificateNumber,
        pdf_path: existingPath,
        verification_code: normalizeText(participant.verification_code),
      },
      participantIndex,
      companyLabel: normalizeText(certificate.company_name) || "Firma Bilgisi Girilmedi",
    });

    const pdfPath = existingPath || `pdf/${item.certificate_id}/${item.job_id}/${participant.id}.pdf`;
    const pdfBuffer = pdf.bytes.buffer.slice(
      pdf.bytes.byteOffset,
      pdf.bytes.byteOffset + pdf.bytes.byteLength,
    ) as ArrayBuffer;
    const { error: uploadError } = await supabase.storage
      .from("certificate-files")
      .upload(pdfPath, new Blob([pdfBuffer], { type: "application/pdf" }), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const [{ error: participantUpdateError }, { error: itemUpdateError }] = await Promise.all([
      supabase
        .from("certificate_participants")
        .update({ pdf_path: pdfPath, certificate_no: pdf.certificateNumber || certificateNumber })
        .eq("id", participant.id),
      supabase
        .from("certificate_job_items")
        .update({
          status: "completed",
          pdf_path: pdfPath,
          error_message: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", item.id),
    ]);

    if (participantUpdateError) throw participantUpdateError;
    if (itemUpdateError) throw itemUpdateError;

    const signedUrl = await createSignedUrlIfExists(supabase, pdfPath);
    if (!signedUrl) {
      return jsonResponse({ error: "PDF yeniden oluşturuldu ancak indirme bağlantısı hazırlanamadı." }, 500, req);
    }

    return jsonResponse(
      {
        downloadUrl: signedUrl,
        pdfPath,
        regenerated: true,
      },
      200,
      req,
    );
  } catch (error) {
    console.error("certificates-download-item failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500, req);
  }
});
