import { invokeEdgeFunction } from "@/lib/ai/invokeEdgeFunction";

export interface GeminiRiskResult {
  hazard: string;
  risk: string;
  category: string;
  probability: number;
  frequency: number;
  severity: number;
  controls: string[];
}

interface RiskLibraryGenerateResponse {
  success: true;
  risks: GeminiRiskResult[];
}

function mapRiskGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("invalid_payload")) {
    return "Risk analizi icin gonderilen sektor bilgisi gecersiz.";
  }
  if (message.includes("bos yanit") || message.includes("empty")) {
    return "Yapay zeka beklenen formatta risk listesi donmedi. Tekrar deneyin.";
  }
  if (message.includes("yogun") || message.includes("rate")) {
    return "Yapay zeka servisi su anda yogun. Biraz sonra tekrar deneyin.";
  }

  return error instanceof Error ? error.message : "Yapay zeka ile risk listesi olusturulamadi.";
}

export async function generateRisksWithGemini(
  sector: string,
  companyName?: string,
): Promise<GeminiRiskResult[]> {
  try {
    const response = await invokeEdgeFunction<RiskLibraryGenerateResponse>("risk-library-generate", {
      sector,
      companyName,
    });

    if (!Array.isArray(response.risks) || response.risks.length === 0) {
      throw new Error("Bos yanit alindi.");
    }

    return response.risks;
  } catch (error) {
    throw new Error(mapRiskGenerationError(error));
  }
}

export async function generateRisksWithGeminiPro(
  sector: string,
  companyName?: string,
): Promise<GeminiRiskResult[]> {
  return generateRisksWithGemini(sector, companyName);
}
