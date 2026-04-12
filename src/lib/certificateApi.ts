import { supabase } from "@/integrations/supabase/client";
import type {
  CertificateDesignConfig,
  CertificateFormValues,
  CertificateJobItem,
  CertificateJobRecord,
  CertificateParticipantInput,
  CertificateRecord,
} from "@/types/certificates";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePrimitiveText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === "object") {
    const candidate = (value as Record<string, unknown>).name;
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
}

function normalizeCertificatePayload(input: CertificateFormValues, participants: CertificateParticipantInput[]) {
  const defaultDesignConfig: CertificateDesignConfig = {
    primaryColor: "#d4af37",
    secondaryColor: "#294d77",
    fontFamily: "serif",
    showBadge: true,
    showSeal: true,
    titleText: "",
    descriptionText: "",
    osgb_logo_url: "",
    signatureCount: 4,
    signatures: (Array.isArray(input.design_config?.signatures) ? input.design_config?.signatures : []).slice(0, 4).map((signature) => ({
      name: typeof signature?.name === "string" ? signature.name.trim() : "",
      title: typeof signature?.title === "string" ? signature.title.trim() : "",
      image_url: normalizeOptionalText(signature?.image_url),
    })),
  };

  return {
    ...input,
    company_name: input.company_name.trim(),
    company_address: input.company_address.trim(),
    company_phone: input.company_phone.trim(),
    training_name: input.training_name.trim(),
    training_date: input.training_date.trim(),
    training_duration: input.training_duration.trim(),
    certificate_type: input.certificate_type.trim(),
    validity_date: normalizeOptionalText(input.validity_date),
    logo_url: normalizeOptionalText(input.logo_url),
    trainer_names: Array.isArray(input.trainer_names)
      ? input.trainer_names.map((item) => item.trim()).filter(Boolean)
      : [],
    notes: normalizeOptionalText(input.notes),
    design_config: {
      ...defaultDesignConfig,
      ...(input.design_config || {}),
      titleText: normalizeOptionalText(input.design_config?.titleText),
      descriptionText: normalizeOptionalText(input.design_config?.descriptionText),
      osgb_logo_url: normalizeOptionalText(input.design_config?.osgb_logo_url),
      signatureCount: Math.min(4, Math.max(1, Number(input.design_config?.signatureCount || 4))),
      signatures: defaultDesignConfig.signatures,
    },
    participants: participants.map((participant) => ({
      ...participant,
      name: participant.name.trim(),
      tc_no: normalizeOptionalText(participant.tc_no),
      job_title: normalizeOptionalText(participant.job_title),
    })),
  };
}

async function callFunction<T>(name: string, options: RequestInit = {}, query?: Record<string, string>) {
  const token = await getAccessToken();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = new URL(`${supabaseUrl}/functions/v1/${name}`);

  Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload as T;
}

export async function createCertificate(input: CertificateFormValues, participants: CertificateParticipantInput[]) {
  return await callFunction<{ certificate: CertificateRecord; job: CertificateJobRecord }>("certificates-create", {
    method: "POST",
    body: JSON.stringify(normalizeCertificatePayload(input, participants)),
  });
}

export async function generateCertificateJob(certificateId: string) {
  return await callFunction<{ certificate: CertificateRecord; job: CertificateJobRecord }>("certificates-generate", {
    method: "POST",
    body: JSON.stringify({ certificateId }),
  });
}

export async function getCertificateStatus(certificateId: string) {
  const payload = await callFunction<{ certificate: CertificateRecord; job: CertificateJobRecord; items: CertificateJobItem[] }>(
    "certificates-status",
    { method: "GET" },
    { certificateId }
  );

  return {
    ...payload,
    items: (payload.items || []).map((item: any) => ({
      ...item,
      participant_name: normalizePrimitiveText(item.participant_name) || normalizePrimitiveText(item.certificate_participants) || null,
    })),
  };
}

export async function getCertificateDownload(certificateId: string) {
  return await callFunction<CertificateJobRecord>("certificates-download", { method: "GET" }, { certificateId });
}

export async function getCertificateVerification(code: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = new URL(`${supabaseUrl}/functions/v1/certificates-verify`);
  url.searchParams.set("code", code);
  const response = await fetch(url.toString(), {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Verification failed");
  }
  return payload;
}
