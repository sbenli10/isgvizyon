import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  GeminiHttpError,
  callGeminiWithRetryAndFallback,
  cleanJsonText,
  extractTextFromGeminiResponse,
  getGoogleLiteModel,
  getGoogleRobustModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

interface RiskHazard {
  hazard: string;
  risk: string;
  preventiveMeasures: string[];
  departmentActivity?: string;
  currentMeasure?: string;
  possibleOutcome?: string;
  probability?: string | number;
  frequency?: string | number;
  severity?: string | number;
  riskScore?: string | number;
  riskLevel?: string;
  postProbability?: string | number;
  postFrequency?: string | number;
  postSeverity?: string | number;
  postRiskScore?: string | number;
  postRiskLevel?: string;
  deadline?: string;
  responsible?: string;
}

interface RequestBody {
  naceCode?: string;
  sector?: string;
  hazardClass?: string;
  naceTitle?: string;
}

function buildPrompt(
  body: Required<Pick<RequestBody, "naceCode" | "sector" | "hazardClass">> &
    Pick<RequestBody, "naceTitle">,
) {
  return `Sen Turkiye'deki is sagligi ve guvenligi mevzuatina hakim bir uzmansin.

Asagidaki NACE bilgilerine gore en yaygin 5 mesleki tehlikeyi Fine-Kinney risk tablosu formatinda analiz et:
- NACE Kodu: ${body.naceCode}
- Sektor: ${body.sector}
- Tehlike Sinifi: ${body.hazardClass}
${body.naceTitle ? `- Faaliyet Tanimi: ${body.naceTitle}` : ""}

Her kayit icin:
- departmentActivity: FAALIYET / BOLUM
- hazard: tehlikenin adi
- risk: RISK aciklamasi
- currentMeasure: MEVCUT DURUM
- probability: O degeri
- frequency: F degeri
- severity: S degeri
- riskScore: R degeri, O x F x S
- riskLevel: RISKIN TANIMI. Degerlerden biri: Kabul Edilebilir Risk, Olasi Risk, Onemli Risk, Yuksek Risk, Cok Yuksek Risk
- possibleOutcome: OLASI SONUC
- preventiveMeasures: DUZELTICI / ONLEYICI FAALIYET icin 3 ila 5 maddelik somut onlem listesi
- postProbability: DOF sonrasi O degeri
- postFrequency: DOF sonrasi F degeri
- postSeverity: DOF sonrasi S degeri
- postRiskScore: DOF sonrasi R degeri
- postRiskLevel: RISKIN TANIMI (DOF SONRASI)
- deadline: TERMIN. Ornek: 30 gun
- responsible: SORUMLU. Her zaman "Isveren" yaz

Sadece asagidaki formatta gecerli JSON dondur:
{
  "risks": [
    {
      "departmentActivity": "string",
      "hazard": "string",
      "risk": "string",
      "currentMeasure": "string",
      "probability": "string",
      "frequency": "string",
      "severity": "string",
      "riskScore": "string",
      "riskLevel": "string",
      "possibleOutcome": "string",
      "preventiveMeasures": ["string", "string", "string"],
      "postProbability": "string",
      "postFrequency": "string",
      "postSeverity": "string",
      "postRiskScore": "string",
      "postRiskLevel": "string",
      "deadline": "string",
      "responsible": "Isveren"
    }
  ]
}`;
}

function parseResponse(text: string) {
  const parsed = JSON.parse(cleanJsonText(text));
  const risks = Array.isArray(parsed?.risks) ? parsed.risks : [];

  if (risks.length === 0) {
    throw new GeminiHttpError(502, "empty_response", "NACE risk analizi bos dondu.");
  }

  return {
    risks: risks.map((item: any, index: number) => {
      const preventiveMeasures = Array.isArray(item?.preventiveMeasures)
        ? item.preventiveMeasures.filter((value: unknown) => typeof value === "string" && value.trim())
        : [];

      if (
        typeof item?.hazard !== "string" ||
        typeof item?.risk !== "string" ||
        preventiveMeasures.length === 0
      ) {
        throw new GeminiHttpError(
          502,
          "empty_response",
          `NACE risk kaydi #${index + 1} beklenen formatta degil.`,
        );
      }

      return {
        hazard: item.hazard.trim(),
        risk: item.risk.trim(),
        preventiveMeasures,
        departmentActivity: typeof item?.departmentActivity === "string" ? item.departmentActivity.trim() : "",
        currentMeasure: typeof item?.currentMeasure === "string" ? item.currentMeasure.trim() : "",
        possibleOutcome: typeof item?.possibleOutcome === "string" ? item.possibleOutcome.trim() : "",
        probability: item?.probability ?? "",
        frequency: item?.frequency ?? "",
        severity: item?.severity ?? "",
        riskScore: item?.riskScore ?? "",
        riskLevel: typeof item?.riskLevel === "string" ? item.riskLevel.trim() : "",
        postProbability: item?.postProbability ?? "",
        postFrequency: item?.postFrequency ?? "",
        postSeverity: item?.postSeverity ?? "",
        postRiskScore: item?.postRiskScore ?? "",
        postRiskLevel: typeof item?.postRiskLevel === "string" ? item.postRiskLevel.trim() : "",
        deadline: typeof item?.deadline === "string" ? item.deadline.trim() : "",
        responsible: "Isveren",
      } satisfies RiskHazard;
    }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, {
        success: false,
        error: { code: "method_not_allowed", message: "Yalnizca POST desteklenir." },
      });
    }

    const body = (await req.json()) as RequestBody;
    const naceCode = typeof body?.naceCode === "string" ? body.naceCode.trim() : "";
    const sector = typeof body?.sector === "string" ? body.sector.trim() : "";
    const hazardClass = typeof body?.hazardClass === "string" ? body.hazardClass.trim() : "";
    const naceTitle = typeof body?.naceTitle === "string" ? body.naceTitle.trim() : "";

    if (!naceCode || !sector || !hazardClass) {
      return jsonResponse(400, {
        success: false,
        error: {
          code: "invalid_payload",
          message: "`naceCode`, `sector` ve `hazardClass` alanlari zorunludur.",
        },
      });
    }

    const preferredModel =
      hazardClass === "Cok Tehlikeli" || hazardClass === "Çok Tehlikeli"
        ? getGoogleRobustModel()
        : getGoogleLiteModel();

    const { payload } = await callGeminiWithRetryAndFallback({
      apiKey: getRequiredGoogleApiKey(),
      model: preferredModel,
      modelPreference:
        hazardClass === "Cok Tehlikeli" || hazardClass === "Çok Tehlikeli" ? "robust" : "lite",
      requestLabel: "nace-risk-analyze",
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt({ naceCode, sector, hazardClass, naceTitle }) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
        },
      },
    });

    return jsonResponse(200, {
      success: true,
      ...parseResponse(extractTextFromGeminiResponse(payload)),
    });
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      return jsonResponse(error.status, {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    console.error("nace-risk-analyze error:", error);
    return jsonResponse(500, {
      success: false,
      error: { code: "unexpected_error", message: "NACE risk analizi olusturulamadi." },
    });
  }
});
