import { invokeEdgeFunction } from "@/lib/ai/invokeEdgeFunction";

interface EvacuationImageResponse {
  success: true;
  dataUrl: string;
  mimeType: string;
}

function mapImageError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("invalid_payload")) {
    return "Gorsel uretimi icin gonderilen aciklama gecersiz.";
  }
  if (message.includes("bos yanit") || message.includes("empty")) {
    return "Yapay zeka gorsel verisi donmedi.";
  }
  if (message.includes("yogun") || message.includes("rate")) {
    return "Yapay zeka servisi su anda yogun. Biraz sonra tekrar deneyin.";
  }

  return error instanceof Error ? error.message : "Tahliye gorseli olusturulamadi.";
}

export async function generateEvacuationImage(prompt: string): Promise<{ dataUrl: string; mimeType: string }> {
  const userPrompt = prompt.trim();
  if (!userPrompt) {
    throw new Error("Lutfen gorsel icin bina aciklamasi girin.");
  }

  try {
    const response = await invokeEdgeFunction<EvacuationImageResponse>("evacuation-ai", {
      action: "image",
      prompt: userPrompt,
    });

    if (!response.dataUrl) {
      throw new Error("Bos yanit alindi.");
    }

    return {
      dataUrl: response.dataUrl,
      mimeType: response.mimeType || "image/png",
    };
  } catch (error) {
    throw new Error(mapImageError(error));
  }
}
