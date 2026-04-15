import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  GeminiHttpError,
  callGeminiWithRetryAndFallback,
  getGoogleModelChain,
  cleanJsonText,
  extractTextFromGeminiResponse,
  getGoogleModel,
  getRequiredGoogleApiKey,
  parseImageInput,
  toInlineDataPart,
} from "../_shared/gemini.ts";

interface BulkCapaAnalysis {
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Düşük" | "Orta" | "Yüksek" | "Kritik";
}

interface RequestBody {
  images?: string[];
  prompt?: string;
}

const DEFAULT_PROMPT = `Bir is sagligi ve guvenligi uzmani gibi davran ve verilen gorselleri dikkatle incele.

Amac:
- Her gorselde yalnizca net olarak gorulen uygunsuzluklari, guvensiz durumlari ve riskleri belirle.
- Net gorunmeyen, emin olunmayan veya fotograf disi kalan ayrintilari varsayma.
- Sonucu tek bir genel CAPA/DOF bulgusu gibi birlestir.
- Duzeltici ve onleyici faaliyetleri uygulanabilir, sahaya uygun ve net maddeler halinde ver.

Kurallar:
- Sadece gorselde desteklenen tespitler yaz.
- Belirsiz ayrintilar icin "goruntu yetersiz" benzeri not kullan; tahmin etme.
- Aciklama, risk tanimi, duzeltici faaliyet ve onleyici faaliyet alanlarini doldur.
- Cikti sadece gecerli bir JSON nesnesi olsun.

JSON formati:
{
  "description": "4-5 cumlelik bulgu ozeti",
  "riskDefinition": "En fazla 4 cumlelik genel risk ozeti",
  "correctiveAction": "- madde 1\\n- madde 2\\n- madde 3",
  "preventiveAction": "- madde 1\\n- madde 2\\n- madde 3",
  "importance_level": "Orta"
}

importance_level secimi:
- Elektrik, yangin, kimyasal veya ciddi yaralanma riski varsa Kritik
- Yaralanma veya kaza ihtimali yuksekse Yuksek
- Duzen, housekeeping veya daha dusuk etkili uygunsuzluklarda Orta
- Cok sinirli etkili ve dusuk olasilikli durumlarda Dusuk`;

function getApproxPayloadSize(images: string[], prompt: string) {
  return images.reduce((total, image) => total + image.length, prompt.length);
}

function getModelCandidates(primaryModel: string) {
  return [primaryModel, ...getGoogleModelChain("lite")]
    .filter((model, index, list): model is string => Boolean(model) && list.indexOf(model) === index);
}

function parseAnalysis(text: string): BulkCapaAnalysis {
  const parsed = JSON.parse(cleanJsonText(text));

  if (
    typeof parsed?.description !== "string" ||
    typeof parsed?.riskDefinition !== "string" ||
    typeof parsed?.correctiveAction !== "string" ||
    typeof parsed?.preventiveAction !== "string"
  ) {
    throw new GeminiHttpError(
      502,
      "empty_response",
      "Yapay zeka yaniti beklenen JSON formatinda degil.",
    );
  }

  return {
    description: parsed.description.trim(),
    riskDefinition: parsed.riskDefinition.trim(),
    correctiveAction: parsed.correctiveAction.trim(),
    preventiveAction: parsed.preventiveAction.trim(),
    importance_level: parsed.importance_level || "Orta",
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
        error: {
          code: "method_not_allowed",
          message: "Yalnizca POST istekleri desteklenir.",
        },
      });
    }

    const body = (await req.json()) as RequestBody;
    const images = Array.isArray(body?.images) ? body.images.filter((item) => typeof item === "string" && item.trim()) : [];
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (images.length === 0 && !prompt) {
      return jsonResponse(400, {
        success: false,
        error: {
          code: "invalid_payload",
          message: "`images` veya `prompt` alanlarindan en az biri gonderilmelidir.",
        },
      });
    }

    const apiKey = getRequiredGoogleApiKey();
    const model = getGoogleModel();
    const modelCandidates = getModelCandidates(model);
    const requestSummary = {
      imageCount: images.length,
      hasPrompt: Boolean(prompt),
      promptLength: prompt.length,
      approxPayloadChars: getApproxPayloadSize(images, prompt || DEFAULT_PROMPT),
      model,
      fallbackModels: modelCandidates.slice(1),
    };

    console.info("bulk-capa-analyze request:", requestSummary);

    const parts = [
      { text: prompt || DEFAULT_PROMPT },
      ...images.map((image) => toInlineDataPart(parseImageInput(image))),
    ];

    const requestBody = {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.15,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096,
      },
    };

    const { payload, model: resolvedModel } = await callGeminiWithRetryAndFallback({
      apiKey,
      models: modelCandidates,
      body: requestBody,
      requestLabel: "bulk-capa-analyze",
      logMeta: requestSummary,
    });

    const text = extractTextFromGeminiResponse(payload);
    let analysis: BulkCapaAnalysis | null = null;

    try {
      analysis = parseAnalysis(text);
    } catch (parseError) {
      console.warn("bulk-capa-analyze parse warning:", {
        ...requestSummary,
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responsePreview: text.slice(0, 500),
      });
      analysis = null;
    }

    return jsonResponse(200, {
      success: true,
      model: resolvedModel,
      text,
      analysis,
    });
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      console.error("bulk-capa-analyze gemini error:", {
        status: error.status,
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return jsonResponse(error.status, {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    console.error("bulk-capa-analyze unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return jsonResponse(500, {
      success: false,
      error: {
        code: "unexpected_error",
        message: "Beklenmeyen bir sunucu hatasi olustu.",
      },
    });
  }
});
