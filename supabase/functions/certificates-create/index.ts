import { corsHeaders, createServiceClient, jsonResponse, requireAuthUser } from "../_shared/certificate-utils.ts";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value: unknown) {
  return normalizeText(value) ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireAuthUser(req);
    const payload = await req.json();
    const supabase = createServiceClient();
    const participants = Array.isArray(payload.participants) ? payload.participants : [];

    const companyName = normalizeRequiredText(payload.company_name);
    const trainingName = normalizeRequiredText(payload.training_name);
    const trainingDate = normalizeRequiredText(payload.training_date);
    const trainingDuration = normalizeRequiredText(payload.training_duration);
    const validityDate = normalizeText(payload.validity_date);
    const logoUrl = normalizeText(payload.logo_url);
    const companyAddress = normalizeText(payload.company_address);
    const companyPhone = normalizeText(payload.company_phone);
    const notes = normalizeText(payload.notes);
    const designConfig = payload.design_config && typeof payload.design_config === "object" ? payload.design_config : {};

    if (!companyName || !trainingName || !trainingDate || !trainingDuration) {
      return jsonResponse({ error: "Firma adı, eğitim adı, eğitim tarihi ve eğitim süresi zorunludur." }, 400);
    }

    if (participants.length === 0) {
      return jsonResponse({ error: "En az bir katılımcı eklenmelidir." }, 400);
    }

    const certificateInsert = {
      company_id: payload.company_id ?? null,
      created_by: user.id,
      training_name: trainingName,
      training_date: trainingDate,
      training_duration: trainingDuration,
      certificate_type: normalizeText(payload.certificate_type) ?? "Katılım",
      validity_date: validityDate,
      logo_url: logoUrl,
      template_type: normalizeText(payload.template_type) ?? "classic",
      company_name: companyName,
      company_address: companyAddress,
      company_phone: companyPhone,
      trainer_names: Array.isArray(payload.trainer_names)
        ? payload.trainer_names.map((item: unknown) => normalizeText(item)).filter(Boolean)
        : [],
      frame_style: normalizeText(payload.frame_style) ?? "gold",
      notes,
      design_config: designConfig,
    };

    const { data: certificate, error: certificateError } = await supabase
      .from("certificates")
      .insert(certificateInsert)
      .select()
      .single();

    if (certificateError) throw certificateError;

    const normalizedParticipants = participants
      .map((participant: any) => ({
        certificate_id: certificate.id,
        name: normalizeRequiredText(participant?.name),
        tc_no: normalizeText(participant?.tc_no),
        job_title: normalizeText(participant?.job_title),
      }))
      .filter((participant: { name: string }) => participant.name.length > 0);

    if (normalizedParticipants.length === 0) {
      return jsonResponse({ error: "En az bir geçerli katılımcı adı girilmelidir." }, 400);
    }

    const { error: participantError } = await supabase.from("certificate_participants").insert(normalizedParticipants);

    if (participantError) throw participantError;

    const { data: job, error: jobError } = await supabase
      .from("certificate_jobs")
      .insert({
        certificate_id: certificate.id,
        status: "draft",
        total_files: normalizedParticipants.length,
        completed_files: 0,
        progress: 0,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    return jsonResponse({ certificate, job }, 201);
  } catch (error) {
    console.error("certificates-create failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
