import { invokeEdgeFunction } from "@/lib/ai/invokeEdgeFunction";

export interface BulkCapaAIAnalysis {
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Düşük" | "Orta" | "Yüksek" | "Kritik";
}

interface BulkCapaAnalyzeResponse {
  success: true;
  text: string;
  analysis: BulkCapaAIAnalysis | null;
}

export type BulkCapaJobType = "single_analysis" | "bulk_generation" | "overall_analysis";

export interface BulkCapaSessionJobContext {
  relatedDepartment?: string | null;
  areaRegion?: string | null;
  responsiblePerson?: string | null;
  employerRepresentativeTitle?: string | null;
  employerRepresentativeName?: string | null;
  observerName?: string | null;
  observerTitle?: string | null;
}

interface BulkCapaSessionJobResponse {
  success: true;
  mode: "session-job";
  sessionId: string;
  status: "completed";
  jobType: BulkCapaJobType;
  result: Record<string, unknown>;
}

function getMimeTypeFromUrl(url: string) {
  const normalized = url.split("?")[0].toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function imageUrlToDataUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Gorsel okunamadi (${response.status})`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || getMimeTypeFromUrl(imageUrl);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gorsel base64 formatina cevrilemedi."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(new Blob([blob], { type: mimeType }));
  });

  if (!dataUrl.startsWith("data:")) {
    throw new Error("Gorsel data URL formatina cevrilemedi.");
  }

  return dataUrl;
}

function mapBulkCapaError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("invalid_payload") || message.includes("data url") || message.includes("base64")) {
    return "Gonderilen gorsel verisi gecersiz. Fotografi yeniden yukleyip tekrar deneyin.";
  }
  if (message.includes("bos yanit") || message.includes("empty response")) {
    return "Yapay zeka servisi anlamli bir yanit donmedi. Tekrar deneyin.";
  }
  if (message.includes("currently experiencing high demand") || message.includes("high demand")) {
    return "Yapay zeka servisi su anda yogun. Sistem otomatik olarak tekrar denedi ancak yanit alinmadi. Bir iki dakika sonra yeniden deneyin.";
  }
  if (message.includes("provider_error")) {
    return "Yapay zeka saglayicisinda gecici bir sorun olustu. Sistem farkli model ve tekrar deneme uyguladi ancak sonuc alinamadi. Biraz sonra yeniden deneyin.";
  }
  if (message.includes("yogun") || message.includes("rate")) {
    return "Yapay zeka servisi su anda yogun. Biraz sonra tekrar deneyin.";
  }
  if (message.includes("provider_model_error") || message.includes("modeli bulunamadi")) {
    return "Yapay zeka modeli su anda kullanilamiyor. Sistem yedek modele gecti ancak analiz tamamlanamadi.";
  }
  if (message.includes("edge function") || message.includes("failed to send a request")) {
    return "Sunucu tarafi analiz servisine ulasilamadi. Baglantinizi kontrol edip tekrar deneyin.";
  }

  return error instanceof Error ? error.message : "Fotograf analizi tamamlanamadi.";
}

export async function analyzeBulkCapaImages(imageUrls: string[]) {
  const images = await Promise.all(imageUrls.map((url) => imageUrlToDataUrl(url)));

  try {
    const result = await invokeEdgeFunction<BulkCapaAnalyzeResponse>("bulk-capa-analyze", {
      images,
    });

    if (!result.analysis) {
      throw new Error("Bos yanit alindi.");
    }

    return result.analysis;
  } catch (error) {
    throw new Error(mapBulkCapaError(error));
  }
}

export async function generateBulkCapaOverallAnalysis(prompt: string) {
  try {
    const result = await invokeEdgeFunction<BulkCapaAnalyzeResponse>("bulk-capa-analyze", {
      images: [],
      prompt,
    });

    const text = result.text?.trim();
    if (!text) {
      throw new Error("Bos yanit alindi.");
    }

    return text;
  } catch (error) {
    throw new Error(mapBulkCapaError(error));
  }
}

export async function startBulkCapaSessionJob({
  sessionId,
  jobType,
  images = [],
  prompt,
  context,
  draftPayload,
}: {
  sessionId: string;
  jobType: BulkCapaJobType;
  images?: string[];
  prompt?: string;
  context?: BulkCapaSessionJobContext;
  draftPayload?: unknown;
}) {
  const normalizedImages = await Promise.all(images.map((url) => imageUrlToDataUrl(url)));

  try {
    return await invokeEdgeFunction<BulkCapaSessionJobResponse>("bulk-capa-analyze", {
      mode: "session-job",
      sessionId,
      jobType,
      images: normalizedImages,
      prompt,
      context,
      draftPayload,
    });
  } catch (error) {
    throw new Error(mapBulkCapaError(error));
  }
}
