import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  callGeminiWithRetryAndFallback,
  getRequiredGoogleApiKey,
  GeminiHttpError,
} from "../_shared/gemini.ts";

type DocumentType =
  | "legislation"
  | "internal_procedure"
  | "technical_instruction"
  | "official_letter"
  | "contractual_obligation";

interface AnalysisRequestPayload {
  companyName?: string | null;
  documentType?: DocumentType;
  fileName?: string | null;
  text?: string | null;
  contextNote?: string | null;
}

const ALLOWED_TYPES: DocumentType[] = [
  "legislation",
  "internal_procedure",
  "technical_instruction",
  "official_letter",
  "contractual_obligation",
];

function parseJsonBlock(raw: string) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI yanıtında geçerli JSON bulunamadı.");
  }
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function truncateText(value: string, maxLength = 24000) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

serve(async (request) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      return jsonResponse(405, {
        success: false,
        error: { code: "method_not_allowed", message: "Yalnızca POST desteklenir." },
      });
    }

    const payload = (await request.json()) as AnalysisRequestPayload;
    const text = String(payload.text || "").trim();
    const documentType = ALLOWED_TYPES.includes(payload.documentType as DocumentType)
      ? (payload.documentType as DocumentType)
      : "legislation";

    if (!text) {
      return jsonResponse(400, {
        success: false,
        error: { code: "text_required", message: "Analiz için belge metni gerekli." },
      });
    }

    const apiKey = getRequiredGoogleApiKey();
    const typeLabelMap: Record<DocumentType, string> = {
      legislation: "Mevzuat",
      internal_procedure: "İç prosedür",
      technical_instruction: "Teknik talimat",
      official_letter: "Denetim / resmî yazı",
      contractual_obligation: "Sözleşme / yükümlülük dokümanı",
    };

    const prompt = `
Sen deneyimli bir iş sağlığı ve güvenliği mevzuat/uyum danışmanısın.
Kullanıcının yüklediği belgeyi oku ve sadece aşağıdaki JSON yapısında, Türkçe ve kurumsal bir çıktı üret.

Belge türü: ${typeLabelMap[documentType]}
Firma: ${payload.companyName || "Belirtilmedi"}
Dosya adı: ${payload.fileName || "Belirtilmedi"}
Ek bağlam: ${payload.contextNote || "Yok"}

Kurallar:
- Yalnızca geçerli JSON döndür.
- summary alanı 2-4 cümle olsun.
- keyObligations alanı 3-8 madde içersin.
- criticalPoints alanı 2-6 madde içersin.
- actionItems alanı 3-8 madde içersin.
- riskNotes alanı 1-4 madde içersin.
- priority ve urgency değerleri sadece low, medium, high, critical olabilir.
- suggestedModule değerleri sadece capa, inspection, archive, report olabilir.
- Belge metni yetersizse bunu summary içinde açıkça söyle ve yine de makul bir yapı üret.

JSON şeması:
{
  "summary": "string",
  "keyObligations": [
    { "title": "string", "description": "string", "legalBasis": "string", "priority": "low|medium|high|critical" }
  ],
  "criticalPoints": [
    { "title": "string", "description": "string", "whyItMatters": "string" }
  ],
  "actionItems": [
    { "title": "string", "description": "string", "urgency": "low|medium|high|critical", "suggestedModule": "capa|inspection|archive|report" }
  ],
  "riskNotes": [
    { "title": "string", "description": "string" }
  ]
}

Belge metni:
${truncateText(text)}
`.trim();

    console.log(`[analyze-document-obligations][${requestId}] analiz başlatıldı`, {
      documentType,
      fileName: payload.fileName || null,
      companyName: payload.companyName || null,
      textLength: text.length,
    });

    const response = await callGeminiWithRetryAndFallback({
      apiKey,
      modelPreference: "robust",
      requestLabel: "analyze-document-obligations",
      maxAttemptsPerModel: 2,
      body: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      },
      logMeta: {
        requestId,
        documentType,
        fileName: payload.fileName || null,
      },
    });

    const contentText =
      response?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n") || "";
    const parsed = parseJsonBlock(contentText);

    console.log(`[analyze-document-obligations][${requestId}] analiz tamamlandı`, {
      obligations: Array.isArray(parsed.keyObligations) ? parsed.keyObligations.length : 0,
      actions: Array.isArray(parsed.actionItems) ? parsed.actionItems.length : 0,
    });

    return jsonResponse(200, { success: true, result: parsed });
  } catch (error) {
    console.error(`[analyze-document-obligations][${requestId}] hata`, error);

    const message =
      error instanceof GeminiHttpError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Belge analizi başarısız oldu.";

    return jsonResponse(500, {
      success: false,
      error: {
        code: "analysis_failed",
        message,
      },
    });
  }
});
