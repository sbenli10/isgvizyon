import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  GeminiHttpError,
  callGeminiWithRetryAndFallback,
  cleanJsonText,
  extractTextFromGeminiResponse,
  getGoogleLiteModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

interface GeminiRiskResult {
  hazard: string;
  risk: string;
  category: string;
  probability: number;
  frequency: number;
  severity: number;
  controls: string[];
}

interface RequestBody {
  sector?: string;
  companyName?: string;
}

function buildPrompt(sector: string, companyName?: string) {
  return `Sen Turkiye mevzuatina hakim kidemli bir ISG uzmani ve Fine-Kinney degerlendirme uzmansin.

Gorev:
- ${companyName ? `"${companyName}" icin` : "Bir firma icin"} ${sector} sektorune ozel 30 ila 40 farkli risk maddesi uret.
- Maddeler tekrarsiz, uygulanabilir ve sahaya ozgu olsun.
- Her madde icin hazard, risk, category, probability, frequency, severity ve controls alanlarini doldur.
- Controls alaninda en az 3 somut onlem olsun.
- Sonucu sadece gecerli bir JSON array olarak dondur.

Fine-Kinney notlari:
- probability, frequency ve severity sayi olmali.
- Skorlar sektorun gercek riskiyle uyumlu olmali; asiri veya anlamsiz deger verme.

JSON ornegi:
[
  {
    "hazard": "Spesifik tehlike",
    "risk": "Detayli risk aciklamasi",
    "category": "Kategori",
    "probability": 6,
    "frequency": 6,
    "severity": 15,
    "controls": ["Onlem 1", "Onlem 2", "Onlem 3"]
  }
]`;
}

function parseRisks(text: string): GeminiRiskResult[] {
  const parsed = JSON.parse(cleanJsonText(text));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new GeminiHttpError(502, "empty_response", "Risk listesi bos veya gecersiz geldi.");
  }

  const normalized = parsed.map((item, index) => {
    const controls = Array.isArray(item?.controls)
      ? item.controls.filter((value: unknown) => typeof value === "string" && value.trim())
      : [];

    if (
      typeof item?.hazard !== "string" ||
      typeof item?.risk !== "string" ||
      typeof item?.category !== "string" ||
      typeof item?.probability !== "number" ||
      typeof item?.frequency !== "number" ||
      typeof item?.severity !== "number" ||
      controls.length === 0
    ) {
      throw new GeminiHttpError(
        502,
        "empty_response",
        `Risk kaydi #${index + 1} beklenen formatta degil.`,
      );
    }

    return {
      hazard: item.hazard.trim(),
      risk: item.risk.trim(),
      category: item.category.trim(),
      probability: item.probability,
      frequency: item.frequency,
      severity: item.severity,
      controls,
    } satisfies GeminiRiskResult;
  });

  return normalized;
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
    const sector = typeof body?.sector === "string" ? body.sector.trim() : "";
    const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";

    if (!sector) {
      return jsonResponse(400, {
        success: false,
        error: { code: "invalid_payload", message: "`sector` alani zorunludur." },
      });
    }

    const { payload } = await callGeminiWithRetryAndFallback({
      apiKey: getRequiredGoogleApiKey(),
      model: getGoogleLiteModel(),
      modelPreference: "lite",
      requestLabel: "risk-library-generate",
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(sector, companyName || undefined) }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      },
    });

    const risks = parseRisks(extractTextFromGeminiResponse(payload));
    return jsonResponse(200, { success: true, risks });
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      return jsonResponse(error.status, {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    console.error("risk-library-generate error:", error);
    return jsonResponse(500, {
      success: false,
      error: { code: "unexpected_error", message: "Risk analizi olusturulamadi." },
    });
  }
});
