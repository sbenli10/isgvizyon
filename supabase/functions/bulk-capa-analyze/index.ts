import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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

interface BulkCapaGeneratedEntry {
  id: string;
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  termin_date: string;
  related_department: string;
  notification_method: string;
  responsible_name: string;
  responsible_role: string;
  approver_name: string;
  approver_title: string;
  include_stamp: boolean;
  media_urls: string[];
  ai_analyzed: boolean;
}

type JobType = "single_analysis" | "bulk_generation" | "overall_analysis";

interface SessionJobContext {
  relatedDepartment?: string | null;
  areaRegion?: string | null;
  responsiblePerson?: string | null;
  employerRepresentativeTitle?: string | null;
  employerRepresentativeName?: string | null;
  observerName?: string | null;
  observerTitle?: string | null;
}

interface SessionJobDraftPayload {
  [key: string]: unknown;
}

interface RequestBody {
  images?: string[];
  prompt?: string;
  mode?: "direct" | "session-job";
  sessionId?: string;
  jobType?: JobType;
  context?: SessionJobContext;
  draftPayload?: SessionJobDraftPayload;
}

// --- CONSTANTS & PROMPTS ---
const DEFAULT_PROMPT = `Lütfen bir iş sağlığı ve güvenliği uzmanı gibi davran ve gönderilen GÖRSELLERİ dikkatle incele.
Her GÖRSELDE gözüken tüm uygunsuzlukları ve riskleri tespit et.

Kurallar:
- Analiz çıktısı SADECE geçerli ve tek bir JSON nesnesinden oluşmalı, çıktının ilk karakteri { olmalı.
- ASLA herhangi bir açıklama, açıklayıcı cümle veya markdown etiketi (örn. \`\`\`json) ekleme.
- Cevabın tamamı saf JSON olacak ve başında ya da sonunda fazladan karakter bulunmayacak.

JSON formatı tam olarak böyle:
{
  "description": "bulgu özeti",
  "riskDefinition": "risk özeti",
  "correctiveAction": "- madde 1\\n- madde 2",
  "preventiveAction": "- madde 1\\n- madde 2",
  "importance_level": "Orta"
}`;

function getApproxPayloadSize(images: string[], prompt: string) {
  return images.reduce((total, image) => total + image.length, prompt.length);
}

function getModelCandidates(primaryModel: string) {
  return [primaryModel, ...getGoogleModelChain("lite")]
    .filter((model, index, list): model is string => Boolean(model) && list.indexOf(model) === index);
}

function normalizeJobType(value: unknown): JobType | null {
  return value === "single_analysis" || value === "bulk_generation" || value === "overall_analysis"
    ? value
    : null;
}

// --- HELPERS ---
function coerceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(i => String(i ?? "")).filter(Boolean).join("\n");
  return String(value ?? "");
}

function parseAnalysis(text: string): BulkCapaAnalysis {
  try {
    const cleaned = cleanJsonText(text);
    const parsed = JSON.parse(cleaned);

    return {
      description: coerceText(parsed.description || "Bulgu özeti üretilemedi."),
      riskDefinition: coerceText(parsed.riskDefinition || "Risk tanımı üretilemedi."),
      correctiveAction: coerceText(parsed.correctiveAction || "- Aksiyon belirtilmedi."),
      preventiveAction: coerceText(parsed.preventiveAction || "- Önleyici faaliyet belirtilmedi."),
      importance_level: parsed.importance_level || "Orta",
    };
  } catch (e) {
    // Uygulama çökmemeli! Varsayılan analiz objesi dönülür
    console.error("JSON Parse Error Content in parseAnalysis:", text);
    console.error("Parse exception:", e);
    return {
      description: "Analiz üretilemedi",
      riskDefinition: "Analiz üretilemedi",
      correctiveAction: "Analiz üretilemedi",
      preventiveAction: "Analiz üretilemedi",
      importance_level: "Orta",
    };
  }
}

async function runBulkCapaAnalysis(images: string[], prompt?: string, forceJson = true) {
  const apiKey = getRequiredGoogleApiKey();
  const model = getGoogleModel();
  const modelCandidates = [model, ...getGoogleModelChain("lite")].filter((m, i, l) => m && l.indexOf(m) === i);
  const effectivePrompt = prompt?.trim() || DEFAULT_PROMPT;

  const parts = [
    { text: effectivePrompt },
    ...images.map((img) => toInlineDataPart(parseImageInput(img))),
  ];

  const generationConfig: Record<string, any> = {
    temperature: forceJson ? 0.1 : 0.4,
    maxOutputTokens: 4096,
  };
  if (forceJson) {
    generationConfig.response_mime_type = "application/json";
  }

  const requestBody = {
    contents: [{ role: "user", parts }],
    generationConfig,
  };

  const { payload, model: resolvedModel } = await callGeminiWithRetryAndFallback({
    apiKey,
    models: modelCandidates as string[],
    body: requestBody,
    requestLabel: "bulk-capa-analyze",
  });

  const text = extractTextFromGeminiResponse(payload);
  let analysis: BulkCapaAnalysis | null = null;

  if (forceJson) {
    analysis = parseAnalysis(text);
  }

  return { analysis, text, resolvedModel };
}

function getSuggestedTerminDate(importanceLevel: string) {
  const days = importanceLevel === "Kritik" ? 1 : importanceLevel === "Yüksek" ? 3 : importanceLevel === "Orta" ? 7 : 14;
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().split("T")[0];
}
function buildBulkEntryFromAnalysis(
  analysis: BulkCapaAnalysis,
  imageUrl: string,
  index: number,
  context: SessionJobContext,
): BulkCapaGeneratedEntry {
  return {
    id: `bulk-ai-${Date.now()}-${index}`,
    description: coerceText(analysis.description).trim(),
    riskDefinition: coerceText(analysis.riskDefinition).trim(),
    correctiveAction: coerceText(analysis.correctiveAction).trim(),
    preventiveAction: coerceText(analysis.preventiveAction).trim(),
    importance_level: analysis.importance_level,
    termin_date: getSuggestedTerminDate(analysis.importance_level),
    related_department:
      context.relatedDepartment?.trim() && context.relatedDepartment !== "Diger"
        ? context.relatedDepartment
        : context.areaRegion?.trim() || "Genel Saha",
    notification_method: "E-mail",
    responsible_name:
      context.employerRepresentativeName?.trim() ||
      context.responsiblePerson?.trim() ||
      "İşveren / İşveren Vekili",
    responsible_role:
      context.employerRepresentativeTitle?.trim() ||
      "İşveren / İşveren Vekili",
    approver_name: context.observerName?.trim() || "",
    approver_title: context.observerTitle?.trim() || "İş Güvenliği Uzmanı",
    include_stamp: true,
    media_urls: [imageUrl],
    ai_analyzed: true,
  };
}

function buildServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey);
}

function buildAnonClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(supabaseUrl, anonKey);
}

async function updateSessionStatus(
  supabase: ReturnType<typeof buildServiceClient>,
  sessionId: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from("bulk_capa_sessions").update(payload).eq("id", sessionId);
  if (error) throw error;
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
    const mode = body.mode === "session-job" ? "session-job" : "direct";
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

    if (mode === "direct") {
      const { analysis, text, resolvedModel } = await runBulkCapaAnalysis(images, prompt);
      return jsonResponse(200, {
        success: true,
        mode,
        model: resolvedModel,
        text,
        analysis,
      });
    }

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const jobType = normalizeJobType(body.jobType);
    if (!sessionId || !jobType) {
      return jsonResponse(400, {
        success: false,
        error: {
          code: "invalid_session_job",
          message: "`sessionId` ve gecerli `jobType` zorunludur.",
        },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) {
      return jsonResponse(401, {
        success: false,
        error: {
          code: "missing_authorization",
          message: "Authorization bearer token bulunamadi.",
        },
      });
    }

    const userClient = buildAnonClient();
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonResponse(401, {
        success: false,
        error: {
          code: "not_authenticated",
          message: "Oturum dogrulanamadi.",
        },
      });
    }

    const serviceSupabase = buildServiceClient();
    const { data: sessionRow, error: sessionError } = await serviceSupabase
      .from("bulk_capa_sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!sessionRow || sessionRow.user_id !== user.id) {
      return jsonResponse(403, {
        success: false,
        error: {
          code: "forbidden_session",
          message: "Bu Bulk CAPA oturumunu isleme yetkiniz yok.",
        },
      });
    }

    const now = new Date().toISOString();
    await updateSessionStatus(serviceSupabase, sessionId, {
      status: "processing",
      job_type: jobType,
      processing_started_at: now,
      processing_completed_at: null,
      processing_error: null,
      draft_payload: body.draftPayload ?? {},
    });

    let resultPayload: Record<string, unknown> = {};

    try {
      if (jobType === "single_analysis") {
        const { analysis } = await runBulkCapaAnalysis(images);
        resultPayload = {
          jobType,
          newEntry: {
            description: analysis?.description ?? "Analiz üretilemedi",
            riskDefinition: analysis?.riskDefinition ?? "Analiz üretilemedi",
            correctiveAction: analysis?.correctiveAction ?? "Analiz üretilemedi",
            preventiveAction: analysis?.preventiveAction ?? "Analiz üretilemedi",
            importance_level: analysis?.importance_level ?? "Orta",
            ai_analyzed: true,
          },
        };
      }

      if (jobType === "bulk_generation") {
        const context = body.context || {};
        const generatedEntries: BulkCapaGeneratedEntry[] = [];
        for (let index = 0; index < images.length; index += 1) {
          const imageUrl = images[index];
          const { analysis } = await runBulkCapaAnalysis([imageUrl]);
          if (!analysis) continue;
          generatedEntries.push(buildBulkEntryFromAnalysis(analysis, imageUrl, index, context));
        }

        if (generatedEntries.length === 0) {
          throw new GeminiHttpError(502, "empty_response", "Yuklenen fotograflardan analiz üretilemedi.");
        }

        const overallPrompt =
          typeof prompt === "string" && prompt.trim()
            ? prompt
            : `Sen deneyimli bir iş sağlığı ve güvenliği uzmanısın.
Aşağıdaki toplu DÖF maddeleri için resmi raporda kullanılacak yönetici özetini yaz.

Kurallar:
- 1 kısa paragraf yaz.
- Genel risk yoğunluğunu, tekrar eden uygunsuzlukları ve öncelikli aksiyon temasını özetle.
- Düz metin üret.

Maddeler:
${generatedEntries
  .map(
    (entry, index) =>
      `${index + 1}. Bulgu: ${entry.description}\nRisk: ${entry.riskDefinition}\nDüzeltici Faaliyet: ${entry.correctiveAction}\nÖnleyici Faaliyet: ${entry.preventiveAction}\nÖnemlilik: ${entry.importance_level}`,
  )
  .join("\n\n")}`;

        const { text } = await runBulkCapaAnalysis([], overallPrompt, false);

        resultPayload = {
          jobType,
          entries: generatedEntries,
          overallAnalysis: coerceText(text).trim(),
          createMode: "bulk",
          createStep: "items",
          createDialogOpen: true,
        };

        await serviceSupabase.from("bulk_capa_entries").delete().eq("session_id", sessionId);
        const entriesPayload = generatedEntries.map((entry) => ({
          session_id: sessionId,
          description: entry.description,
          risk_definition: entry.riskDefinition,
          corrective_action: entry.correctiveAction,
          preventive_action: entry.preventiveAction,
          priority:
            entry.importance_level === "Kritik"
              ? "critical"
              : entry.importance_level === "Yüksek"
              ? "high"
              : entry.importance_level === "Düşük"
              ? "low"
              : "medium",
          due_date: entry.termin_date || null,
          related_department: entry.related_department || null,
          notification_method: entry.notification_method || null,
          responsible_name: entry.responsible_name || null,
          responsible_role: entry.responsible_role || null,
          approver_name: entry.approver_name || null,
          approver_title: entry.approver_title || null,
          include_stamp: entry.include_stamp,
          media_urls: [],
          ai_analyzed: entry.ai_analyzed,
        }));
        const { error: entriesError } = await serviceSupabase.from("bulk_capa_entries").insert(entriesPayload);
        if (entriesError) throw entriesError;
      }

      if (jobType === "overall_analysis") {
        const { text } = await runBulkCapaAnalysis([], prompt, false);
        const overallAnalysis = coerceText(text).trim();
        if (!overallAnalysis) {
          throw new GeminiHttpError(502, "empty_response", "Genel analiz metni üretilemedi.");
        }
        resultPayload = {
          jobType,
          overallAnalysis,
        };
      }

      const completedAt = new Date().toISOString();
      await updateSessionStatus(serviceSupabase, sessionId, {
        status: "completed",
        job_type: jobType,
        processing_completed_at: completedAt,
        processing_error: null,
        job_result_payload: resultPayload,
        overall_analysis:
          typeof resultPayload.overallAnalysis === "string" ? resultPayload.overallAnalysis : undefined,
        entries_count:
          Array.isArray(resultPayload.entries) ? resultPayload.entries.length : undefined,
      });

      return jsonResponse(200, {
        success: true,
        mode,
        sessionId,
        status: "completed",
        jobType,
        result: resultPayload,
      });
    } catch (jobError) {
      const message = jobError instanceof Error ? jobError.message : String(jobError);
      await updateSessionStatus(serviceSupabase, sessionId, {
        status: "failed",
        job_type: jobType,
        processing_completed_at: new Date().toISOString(),
        processing_error: message,
      });
      throw jobError;
    }
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