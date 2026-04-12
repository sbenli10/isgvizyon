import { invokeEdgeFunction } from "@/lib/ai/invokeEdgeFunction";

export interface RiskHazard {
  hazard: string;
  risk: string;
  preventiveMeasures: string[];
}

export interface RiskAnalysisResponse {
  risks: RiskHazard[];
}

export interface NaceRiskAnalysisParams {
  naceCode: string;
  sector: string;
  hazardClass: string;
  naceTitle?: string;
}

interface NaceRiskAnalyzeResponse {
  success: true;
  risks: RiskHazard[];
}

function mapNaceError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("invalid_payload")) {
    return "NACE analizi icin gerekli bilgiler eksik veya gecersiz.";
  }
  if (message.includes("bos yanit") || message.includes("empty")) {
    return "Yapay zeka NACE analizi icin gecerli bir sonuc donmedi.";
  }
  if (message.includes("yogun") || message.includes("rate")) {
    return "Yapay zeka servisi su anda yogun. Biraz sonra tekrar deneyin.";
  }

  return error instanceof Error ? error.message : "NACE risk analizi basarisiz oldu.";
}

export async function generateNaceRiskAnalysis(
  params: NaceRiskAnalysisParams,
): Promise<RiskAnalysisResponse> {
  try {
    const response = await invokeEdgeFunction<NaceRiskAnalyzeResponse>("nace-risk-analyze", params);
    return {
      risks: Array.isArray(response.risks) ? response.risks : [],
    };
  } catch (error) {
    throw new Error(mapNaceError(error));
  }
}

export function validateAIConfig(): boolean {
  return true;
}
