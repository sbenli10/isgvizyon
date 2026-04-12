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
  if (message.includes("yogun") || message.includes("rate")) {
    return "Yapay zeka servisi su anda yogun. Biraz sonra tekrar deneyin.";
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
