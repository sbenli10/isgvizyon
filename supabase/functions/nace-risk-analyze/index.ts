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

const FUNCTION_NAME = "nace-risk-analyze";

function createRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function safeError(error: unknown) {
  if (error instanceof GeminiHttpError) {
    return {
      name: error.name,
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

function logInfo(requestId: string, step: string, meta: Record<string, unknown> = {}) {
  console.info(`[${FUNCTION_NAME}] ${step}`, {
    requestId,
    ...meta,
  });
}

function logWarn(requestId: string, step: string, meta: Record<string, unknown> = {}) {
  console.warn(`[${FUNCTION_NAME}] ${step}`, {
    requestId,
    ...meta,
  });
}

function logError(requestId: string, step: string, error: unknown, meta: Record<string, unknown> = {}) {
  console.error(`[${FUNCTION_NAME}] ${step}`, {
    requestId,
    ...meta,
    error: safeError(error),
  });
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

function parseGeminiJson(text: string) {
  const cleaned = cleanJsonText(text);

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const repaired = cleaned
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/}\s*{/g, "},{")
      .replace(/]\s*"/g, '],"')
      .replace(/"\s*\n\s*"/g, '",\n"');

    try {
      return JSON.parse(repaired);
    } catch {
      throw new GeminiHttpError(
        502,
        "invalid_model_json",
        "Yapay zeka yaniti gecerli JSON formatinda degil.",
        firstError instanceof Error ? firstError.message : String(firstError),
      );
    }
  }
}

function parseResponse(text: string) {
  const parsed = parseGeminiJson(text);
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

function defaultNumbers(hazardClass: string) {
  if (hazardClass.includes("Çok") || hazardClass.includes("Cok") || hazardClass.includes("Ã‡ok")) {
    return { probability: 6, frequency: 1, severity: 15 };
  }
  if (hazardClass.includes("Tehlikeli")) {
    return { probability: 3, frequency: 1, severity: 7 };
  }
  return { probability: 1, frequency: 1, severity: 3 };
}

function riskLevelFromScore(score: number) {
  if (score > 400) return "Cok Yuksek Risk";
  if (score >= 200) return "Yuksek Risk";
  if (score >= 70) return "Onemli Risk";
  if (score >= 20) return "Olasi Risk";
  return "Kabul Edilebilir Risk";
}

function fallbackRisk(
  body: Required<Pick<RequestBody, "naceCode" | "sector" | "hazardClass">> & Pick<RequestBody, "naceTitle">,
  hazard: string,
  risk: string,
  preventiveMeasures: string[],
  possibleOutcome: string,
): RiskHazard {
  const numbers = defaultNumbers(body.hazardClass);
  const riskScore = numbers.probability * numbers.frequency * numbers.severity;
  const postProbability = 0.2;
  const postFrequency = 1;
  const postSeverity = Math.min(numbers.severity, 3);
  const postRiskScore = postProbability * postFrequency * postSeverity;

  return {
    departmentActivity: body.naceTitle || body.sector || body.naceCode,
    hazard,
    risk,
    currentMeasure: "Mevcut durum saha kontrolunde degerlendirilecek; standart ISG tedbirleri takip edilecektir.",
    probability: String(numbers.probability),
    frequency: String(numbers.frequency),
    severity: String(numbers.severity),
    riskScore: String(riskScore),
    riskLevel: riskLevelFromScore(riskScore),
    possibleOutcome,
    preventiveMeasures,
    postProbability: String(postProbability),
    postFrequency: String(postFrequency),
    postSeverity: String(postSeverity),
    postRiskScore: String(postRiskScore),
    postRiskLevel: riskLevelFromScore(postRiskScore),
    deadline: "30 gun",
    responsible: "Isveren",
  };
}

function buildFallbackRisks(
  body: Required<Pick<RequestBody, "naceCode" | "sector" | "hazardClass">> & Pick<RequestBody, "naceTitle">,
) {
  const activity = body.naceTitle || body.sector || "Faaliyet alani";
  return {
    risks: [
      fallbackRisk(body, "Isyeri ortam tehlikeleri", `${activity} kapsaminda calisma ortami duzensizligi, uygun olmayan gecis yollari veya kontrolsuz calisma kosullari yaralanma ve is kaybina yol acabilir.`, ["Calisma alanlari duzenli kontrol edilmeli ve uygunsuzluklar kayit altina alinmalidir.", "Gecis yollari, calisma platformlari ve acil cikislar surekli acik tutulmalidir.", "Calisanlara gorev bazli ISG talimatlari teblig edilmelidir."], "Yaralanma, is gucu kaybi ve operasyon aksaması"),
      fallbackRisk(body, "Makine ve ekipman kullanimi", "Faaliyet sirasinda kullanilan ekipmanlarin uygunsuz kullanimi, bakim eksikligi veya koruyucu donanim yetersizligi yaralanma riski olusturabilir.", ["Makine ve ekipmanlarin periyodik bakim ve kontrol kayitlari tutulmalidir.", "Koruyucu duzenekler devre disi birakilmamalidir.", "Yetkisiz kisilerin ekipman kullanmasi engellenmelidir."], "Ezilme, kesilme, yaralanma veya maddi hasar"),
      fallbackRisk(body, "Elektrik kaynakli tehlikeler", "Elektrik tesisati, uzatma kablolari veya panolardaki uygunsuzluklar elektrik carpmasi ve yangin riskine neden olabilir.", ["Elektrik panolari kilitli ve yetkisiz erisime kapali olmalidir.", "Kacak akim roleleri ve topraklama kontrolleri duzenli yapilmalidir.", "Hasarli kablo ve prizler kullanilmadan once degistirilmelidir."], "Elektrik carpmasi, yanik veya yangin"),
      fallbackRisk(body, "Yangin ve acil durum hazirligi", "Yanici malzemeler, uygunsuz depolama veya acil durum ekipmanlarinin yetersizligi yangin ve tahliye risklerini artirabilir.", ["Yangin sondurme ekipmanlari erisilebilir ve periyodik kontrollu olmalidir.", "Acil cikis ve tahliye yollari isaretlenmeli ve acik tutulmalidir.", "Acil durum tatbikatlari planli sekilde yapilmalidir."], "Yangin, yaralanma, panik ve maddi kayip"),
      fallbackRisk(body, "Ergonomi ve elle tasima", "Uygun olmayan calisma pozisyonlari, tekrarlayan isler veya elle tasima faaliyetleri kas iskelet sistemi rahatsizliklarina yol acabilir.", ["Elle tasima isleri icin calisanlara dogru kaldirma ve tasima egitimi verilmelidir.", "Agir yuklerde mekanik yardimci ekipman kullanilmalidir.", "Calisma duzeni ergonomik riskleri azaltacak sekilde planlanmalidir."], "Kas iskelet sistemi rahatsizligi ve is gucu kaybi"),
    ],
  };
}

Deno.serve(async (req) => {
  const requestId = createRequestId();
  const startedAt = Date.now();

  logInfo(requestId, "request:received", {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get("user-agent"),
    origin: req.headers.get("origin"),
    contentType: req.headers.get("content-type"),
  });

  if (req.method === "OPTIONS") {
    logInfo(requestId, "request:options", {
      durationMs: Date.now() - startedAt,
    });
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      logWarn(requestId, "request:method_not_allowed", {
        method: req.method,
        durationMs: Date.now() - startedAt,
      });
      return jsonResponse(405, {
        success: false,
        requestId,
        error: { code: "method_not_allowed", message: "Yalnizca POST desteklenir." },
      });
    }

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
      logInfo(requestId, "request:body_parsed", {
        bodyKeys: Object.keys(body ?? {}),
        hasNaceCode: typeof body?.naceCode === "string" && body.naceCode.trim().length > 0,
        hasSector: typeof body?.sector === "string" && body.sector.trim().length > 0,
        hasHazardClass: typeof body?.hazardClass === "string" && body.hazardClass.trim().length > 0,
        hasNaceTitle: typeof body?.naceTitle === "string" && body.naceTitle.trim().length > 0,
      });
    } catch (error) {
      logError(requestId, "request:json_parse_failed", error, {
        durationMs: Date.now() - startedAt,
      });
      return jsonResponse(400, {
        success: false,
        requestId,
        error: {
          code: "invalid_json",
          message: "Istek govdesi gecerli JSON formatinda degil.",
        },
      });
    }

    const naceCode = typeof body?.naceCode === "string" ? body.naceCode.trim() : "";
    const sector = typeof body?.sector === "string" ? body.sector.trim() : "";
    const hazardClass = typeof body?.hazardClass === "string" ? body.hazardClass.trim() : "";
    const naceTitle = typeof body?.naceTitle === "string" ? body.naceTitle.trim() : "";

    logInfo(requestId, "request:normalized", {
      naceCode,
      sectorLength: sector.length,
      hazardClass,
      naceTitleLength: naceTitle.length,
    });

    if (!naceCode || !sector || !hazardClass) {
      logWarn(requestId, "request:invalid_payload", {
        missing: {
          naceCode: !naceCode,
          sector: !sector,
          hazardClass: !hazardClass,
        },
        durationMs: Date.now() - startedAt,
      });
      return jsonResponse(400, {
        success: false,
        requestId,
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

    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    const googleModel = Deno.env.get("GOOGLE_MODEL");
    const googleRobustModel = Deno.env.get("GOOGLE_MODEL_ROBUST");
    const googleFallbackModel = Deno.env.get("GOOGLE_MODEL_FALLBACK");
    const modelPreference =
      hazardClass === "Cok Tehlikeli" || hazardClass === "Çok Tehlikeli" ? "robust" : "lite";

    logInfo(requestId, "env:checked", {
      hasGoogleApiKey: Boolean(googleApiKey),
      googleApiKeyLength: googleApiKey?.length ?? 0,
      googleModel: googleModel || null,
      googleRobustModel: googleRobustModel || null,
      googleFallbackModel: googleFallbackModel || null,
      preferredModel,
      modelPreference,
    });

    const prompt = buildPrompt({ naceCode, sector, hazardClass, naceTitle });
    logInfo(requestId, "prompt:built", {
      promptLength: prompt.length,
      maxOutputTokens: 4096,
    });

    let payload: unknown;
    try {
      logInfo(requestId, "gemini:call_started", {
        preferredModel,
        modelPreference,
      });

      const response = await callGeminiWithRetryAndFallback({
        apiKey: getRequiredGoogleApiKey(),
        model: preferredModel,
        modelPreference,
        requestLabel: `${FUNCTION_NAME}:${requestId}`,
        logMeta: {
          requestId,
          naceCode,
          hazardClass,
          sectorLength: sector.length,
          naceTitleLength: naceTitle.length,
        },
        body: {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
          },
        },
      });

      payload = response.payload;
      logInfo(requestId, "gemini:call_succeeded", {
        resolvedModel: response.model,
        hasPayload: Boolean(payload),
      });
    } catch (error) {
      if (error instanceof GeminiHttpError) {
        logWarn(requestId, "gemini:call_failed_using_fallback", {
          status: error.status,
          code: error.code,
          message: error.message,
          details: error.details,
          durationMs: Date.now() - startedAt,
        });

        const fallback = buildFallbackRisks({ naceCode, sector, hazardClass, naceTitle });
        logInfo(requestId, "response:fallback_success", {
          riskCount: fallback.risks.length,
          durationMs: Date.now() - startedAt,
        });

        return jsonResponse(200, {
          success: true,
          requestId,
          fallback: true,
          ...fallback,
        });
      }

      logError(requestId, "gemini:call_unexpected_error", error, {
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }

    logInfo(requestId, "gemini:extract_text_started");
    const text = extractTextFromGeminiResponse(payload);
    logInfo(requestId, "gemini:text_extracted", {
      textLength: text.length,
      textPreview: text.slice(0, 240),
    });

    logInfo(requestId, "gemini:parse_started");
    let parsed: ReturnType<typeof parseResponse>;
    try {
      parsed = parseResponse(text);
    } catch (error) {
      if (error instanceof GeminiHttpError && error.code === "invalid_model_json") {
        logWarn(requestId, "gemini:parse_failed_using_fallback", {
          status: error.status,
          code: error.code,
          message: error.message,
          details: error.details,
          textLength: text.length,
          textPreview: text.slice(0, 800),
          durationMs: Date.now() - startedAt,
        });

        const fallback = buildFallbackRisks({ naceCode, sector, hazardClass, naceTitle });
        logInfo(requestId, "response:fallback_success", {
          reason: "invalid_model_json",
          riskCount: fallback.risks.length,
          durationMs: Date.now() - startedAt,
        });

        return jsonResponse(200, {
          success: true,
          requestId,
          fallback: true,
          fallbackReason: "invalid_model_json",
          ...fallback,
        });
      }

      throw error;
    }
    logInfo(requestId, "gemini:parse_succeeded", {
      riskCount: parsed.risks.length,
      durationMs: Date.now() - startedAt,
    });

    return jsonResponse(200, {
      success: true,
      requestId,
      ...parsed,
    });
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      logError(requestId, "response:gemini_http_error", error, {
        durationMs: Date.now() - startedAt,
      });
      return jsonResponse(error.status, {
        success: false,
        requestId,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    logError(requestId, "response:unexpected_error", error, {
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse(500, {
      success: false,
      requestId,
      error: { code: "unexpected_error", message: "NACE risk analizi olusturulamadi." },
    });
  }
});
