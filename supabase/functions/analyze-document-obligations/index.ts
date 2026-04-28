import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  callGeminiWithRetryAndFallback,
  GeminiHttpError,
  getGoogleFallbackModel,
  getGoogleLiteModel,
  getGoogleRobustModel,
  getRequiredGoogleApiKey,
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

type Priority = "low" | "medium" | "high" | "critical";
type SuggestedModule = "capa" | "inspection" | "archive" | "report";

interface ObligationItem {
  title: string;
  description: string;
  legalBasis: string;
  priority: Priority;
}

interface CriticalPointItem {
  title: string;
  description: string;
  whyItMatters: string;
}

interface ActionItem {
  title: string;
  description: string;
  urgency: Priority;
  suggestedModule: SuggestedModule;
}

interface RiskNoteItem {
  title: string;
  description: string;
}

interface DocumentAnalysisResult {
  summary: string;
  keyObligations: ObligationItem[];
  criticalPoints: CriticalPointItem[];
  actionItems: ActionItem[];
  riskNotes: RiskNoteItem[];
}

const ALLOWED_TYPES: DocumentType[] = [
  "legislation",
  "internal_procedure",
  "technical_instruction",
  "official_letter",
  "contractual_obligation",
];

const TYPE_LABELS: Record<DocumentType, string> = {
  legislation: "Mevzuat",
  internal_procedure: "İç prosedür",
  technical_instruction: "Teknik talimat",
  official_letter: "Denetim / resmi yazı",
  contractual_obligation: "Sözleşme / yükümlülük dokümanı",
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    keyObligations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          legalBasis: { type: "STRING" },
          priority: { type: "STRING" },
        },
      },
    },
    criticalPoints: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          whyItMatters: { type: "STRING" },
        },
      },
    },
    actionItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          urgency: { type: "STRING" },
          suggestedModule: { type: "STRING" },
        },
      },
    },
    riskNotes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
        },
      },
    },
  },
} as const;

function parseJsonBlock(raw: string, requestId: string) {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.error(`[analyze-document-obligations][${requestId}] geçerli JSON bloğu bulunamadı`);
    throw new Error("AI yanıtında geçerli JSON bulunamadı.");
  }

  let candidate = cleaned.slice(firstBrace, lastBrace + 1);
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(candidate);
  } catch (parseError) {
    console.error(`[analyze-document-obligations][${requestId}] JSON parse başarısız`, {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      snippet: candidate.slice(0, 900),
    });
    throw new Error("AI yanıtı JSON olarak çözümlenemedi.");
  }
}

function truncateText(value: string, maxLength = 18000) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function chunkText(value: string, maxChunkLength = 12000) {
  const normalized = value.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChunkLength) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (paragraph.length <= maxChunkLength) {
      current = paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += maxChunkLength) {
      chunks.push(paragraph.slice(index, index + maxChunkLength));
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function extractCandidateText(response: any) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((part: { text?: string }) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (joined) return joined;
  }

  const fallbackText = response?.text;
  return typeof fallbackText === "string" ? fallbackText.trim() : "";
}

function toStringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePriority(value: unknown): Priority {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function normalizeModule(value: unknown): SuggestedModule {
  return value === "capa" || value === "inspection" || value === "archive" || value === "report" ? value : "report";
}

function normalizeAnalysisResult(raw: any): DocumentAnalysisResult {
  const keyObligations = Array.isArray(raw?.keyObligations)
    ? raw.keyObligations
        .map((item: any, index: number) => ({
          title: toStringValue(item?.title, `Yükümlülük ${index + 1}`),
          description: toStringValue(item?.description, "Belgeden türetilen yükümlülük açıklaması."),
          legalBasis: toStringValue(item?.legalBasis, "Belge metninden türetildi"),
          priority: normalizePriority(item?.priority),
        }))
        .filter((item: ObligationItem) => item.title && item.description)
    : [];

  const criticalPoints = Array.isArray(raw?.criticalPoints)
    ? raw.criticalPoints
        .map((item: any, index: number) => ({
          title: toStringValue(item?.title, `Kritik Madde ${index + 1}`),
          description: toStringValue(item?.description, "Belgedeki kritik nokta açıklaması."),
          whyItMatters: toStringValue(item?.whyItMatters, "Uyum ve operasyon açısından önem taşır."),
        }))
        .filter((item: CriticalPointItem) => item.title && item.description)
    : [];

  const actionItems = Array.isArray(raw?.actionItems)
    ? raw.actionItems
        .map((item: any, index: number) => ({
          title: toStringValue(item?.title, `Aksiyon ${index + 1}`),
          description: toStringValue(item?.description, "Belgeden üretilen uygulanabilir aksiyon."),
          urgency: normalizePriority(item?.urgency),
          suggestedModule: normalizeModule(item?.suggestedModule),
        }))
        .filter((item: ActionItem) => item.title && item.description)
    : [];

  const riskNotes = Array.isArray(raw?.riskNotes)
    ? raw.riskNotes
        .map((item: any, index: number) => ({
          title: toStringValue(item?.title, `Not ${index + 1}`),
          description: toStringValue(item?.description, "Belgeden türetilen risk veya uyum notu."),
        }))
        .filter((item: RiskNoteItem) => item.title && item.description)
    : [];

  return {
    summary: toStringValue(raw?.summary, "Belge analiz edildi ancak özet sınırlı içerikle üretildi."),
    keyObligations,
    criticalPoints,
    actionItems,
    riskNotes,
  };
}

function dedupeByTitle<T extends { title: string }>(items: T[], maxItems: number) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = item.title.trim().toLocaleLowerCase("tr-TR");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= maxItems) break;
  }

  return result;
}

function mergeChunkResults(chunks: DocumentAnalysisResult[]): DocumentAnalysisResult {
  const summaries = chunks.map((chunk) => chunk.summary).filter(Boolean);

  return {
    summary: summaries.length
      ? summaries.slice(0, 3).join(" ").slice(0, 1800)
      : "Belge parça parça analiz edildi ancak özet sınırlı kaldı.",
    keyObligations: dedupeByTitle(chunks.flatMap((chunk) => chunk.keyObligations), 8),
    criticalPoints: dedupeByTitle(chunks.flatMap((chunk) => chunk.criticalPoints), 6),
    actionItems: dedupeByTitle(chunks.flatMap((chunk) => chunk.actionItems), 8),
    riskNotes: dedupeByTitle(chunks.flatMap((chunk) => chunk.riskNotes), 4),
  };
}

function buildPrompt({
  documentType,
  companyName,
  fileName,
  contextNote,
  text,
  chunkInfo,
}: {
  documentType: DocumentType;
  companyName?: string | null;
  fileName?: string | null;
  contextNote?: string | null;
  text: string;
  chunkInfo?: string;
}) {
  return `
Sen deneyimli bir iş sağlığı ve güvenliği mevzuat/uyum danışmanısın.
Kullanıcının yüklediği belgeyi oku ve sadece aşağıdaki JSON yapısında, Türkçe ve kurumsal bir çıktı üret.

Belge türü: ${TYPE_LABELS[documentType]}
Firma: ${companyName || "Belirtilmedi"}
Dosya adı: ${fileName || "Belirtilmedi"}
Ek bağlam: ${contextNote || "Yok"}
${chunkInfo ? `Belge parçası: ${chunkInfo}` : ""}

Kurallar:
- Yalnızca geçerli JSON döndür.
- summary alanı ${chunkInfo ? "1-2" : "2-4"} cümle olsun.
- keyObligations alanı ${chunkInfo ? "1-4" : "3-8"} madde içersin.
- criticalPoints alanı ${chunkInfo ? "1-3" : "2-6"} madde içersin.
- actionItems alanı ${chunkInfo ? "1-4" : "3-8"} madde içersin.
- riskNotes alanı ${chunkInfo ? "0-2" : "1-4"} madde içersin.
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
${text}
`.trim();
}

async function repairJsonResponse({
  apiKey,
  rawResponse,
  requestId,
}: {
  apiKey: string;
  rawResponse: string;
  requestId: string;
}) {
  const repairPrompt = `
Aşağıdaki AI yanıtını GEÇERLİ JSON haline getir.

Kurallar:
- Yalnızca JSON döndür.
- Açıklama, markdown, kod bloğu ekleme.
- Alan adlarını değiştirme.
- Eksik dizi alanlarını boş dizi ile tamamla.
- Eksik string alanlarını kısa ama anlamlı Türkçe metin ile tamamla.

Bozuk yanıt:
${rawResponse.slice(0, 12000)}
`.trim();

  const repairResponse = await callGeminiWithRetryAndFallback({
    apiKey,
    modelPreference: "fallback",
    models: [getGoogleFallbackModel("gemini-2.5-flash")],
    requestLabel: "analyze-document-obligations:repair",
    maxAttemptsPerModel: 1,
    body: {
      contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
      generationConfig: {
        temperature: 0,
        topP: 0.8,
        maxOutputTokens: 3072,
        responseMimeType: "application/json",
      },
    },
    logMeta: { requestId, phase: "repair" },
  });

  const repairedText = extractCandidateText(repairResponse);
  if (!repairedText) {
    throw new Error("AI onarım yanıtı boş geldi.");
  }

  return parseJsonBlock(repairedText, requestId);
}

async function analyzeChunk({
  apiKey,
  requestId,
  prompt,
  documentType,
  fileName,
}: {
  apiKey: string;
  requestId: string;
  prompt: string;
  documentType: DocumentType;
  fileName?: string | null;
}) {
  const response = await callGeminiWithRetryAndFallback({
    apiKey,
    modelPreference: "fallback",
    models: [
      getGoogleFallbackModel("gemini-2.5-flash"),
      getGoogleLiteModel("gemini-1.5-flash"),
      getGoogleRobustModel("gemini-1.5-pro"),
    ].filter((model, index, list): model is string => Boolean(model) && list.indexOf(model) === index),
    requestLabel: "analyze-document-obligations",
    maxAttemptsPerModel: 2,
    body: {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    },
    logMeta: {
      requestId,
      documentType,
      fileName: fileName || null,
    },
  });

  const contentText = extractCandidateText(response);
  if (!contentText) {
    throw new Error("AI yanıtı boş geldi.");
  }

  try {
    return normalizeAnalysisResult(parseJsonBlock(contentText, requestId));
  } catch (parseError) {
    console.warn(`[analyze-document-obligations][${requestId}] ilk parse başarısız, JSON onarımı deneniyor`, {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      snippet: contentText.slice(0, 800),
    });
    const repaired = await repairJsonResponse({
      apiKey,
      rawResponse: contentText,
      requestId,
    });
    return normalizeAnalysisResult(repaired);
  }
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
    console.log(`[analyze-document-obligations][${requestId}] analiz başlatıldı`, {
      documentType,
      fileName: payload.fileName || null,
      companyName: payload.companyName || null,
      textLength: text.length,
    });

    let result: DocumentAnalysisResult;

    try {
      result = await analyzeChunk({
        apiKey,
        requestId,
        documentType,
        fileName: payload.fileName || null,
        prompt: buildPrompt({
          documentType,
          companyName: payload.companyName || null,
          fileName: payload.fileName || null,
          contextNote: payload.contextNote || null,
          text: truncateText(text, 18000),
        }),
      });
    } catch (primaryError) {
      console.warn(`[analyze-document-obligations][${requestId}] tek parça analiz başarısız, belge parçalanarak tekrar deneniyor`, {
        message: primaryError instanceof Error ? primaryError.message : String(primaryError),
      });

      const chunks = chunkText(text, 12000).slice(0, 6);
      if (!chunks.length) {
        throw primaryError;
      }

      const chunkResults: DocumentAnalysisResult[] = [];
      for (let index = 0; index < chunks.length; index += 1) {
        try {
          const chunkResult = await analyzeChunk({
            apiKey,
            requestId: `${requestId}-chunk${index + 1}`,
            documentType,
            fileName: payload.fileName || null,
            prompt: buildPrompt({
              documentType,
              companyName: payload.companyName || null,
              fileName: payload.fileName || null,
              contextNote: payload.contextNote || null,
              text: chunks[index],
              chunkInfo: `${index + 1}/${chunks.length}`,
            }),
          });
          chunkResults.push(chunkResult);
        } catch (chunkError) {
          console.warn(`[analyze-document-obligations][${requestId}] belge parçası atlandı`, {
            chunk: index + 1,
            message: chunkError instanceof Error ? chunkError.message : String(chunkError),
          });
        }
      }

      if (!chunkResults.length) {
        throw primaryError;
      }

      result = mergeChunkResults(chunkResults);
    }

    console.log(`[analyze-document-obligations][${requestId}] analiz tamamlandı`, {
      obligations: result.keyObligations.length,
      actions: result.actionItems.length,
    });

    return jsonResponse(200, { success: true, result });
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
