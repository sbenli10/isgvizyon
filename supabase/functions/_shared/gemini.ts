import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export interface GeminiInlineImage {
  mimeType: string;
  data: string;
}

export interface GeminiRequestOptions {
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
}

export interface GeminiRetryOptions {
  apiKey: string;
  body: Record<string, unknown>;
  model?: string;
  models?: string[];
  modelPreference?: "lite" | "robust" | "fallback";
  maxAttemptsPerModel?: number;
  retryBaseDelayMs?: number;
  requestLabel?: string;
  logMeta?: Record<string, unknown>;
}

export class GeminiHttpError extends Error {
  status: number;
  code: string;
  details?: string;

  constructor(status: number, code: string, message: string, details?: string) {
    super(message);
    this.name = "GeminiHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logGeminiInvocation(entry: {
  requestLabel?: string;
  functionName: string;
  status: "success" | "error";
  resolvedModel?: string;
  attemptedModels: string[];
  attemptsCount: number;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) return;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await supabase.from("ai_function_logs").insert({
      function_name: entry.functionName,
      request_label: entry.requestLabel ?? null,
      status: entry.status,
      resolved_model: entry.resolvedModel ?? null,
      attempted_models: entry.attemptedModels,
      attempts_count: entry.attemptsCount,
      duration_ms: entry.durationMs,
      error_code: entry.errorCode ?? null,
      error_message: entry.errorMessage ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    console.warn("ai_function_logs write failed", error);
  }
}

export function getRequiredGoogleApiKey() {
  const apiKey = Deno.env.get("GOOGLE_API_KEY");
  if (!apiKey) {
    throw new GeminiHttpError(
      500,
      "missing_google_api_key",
      "Sunucu tarafinda GOOGLE_API_KEY tanimli degil.",
    );
  }
  return apiKey;
}

export function getGoogleLiteModel(defaultModel = "gemini-2.5-flash-lite") {
  return Deno.env.get("GOOGLE_MODEL")?.trim() || defaultModel;
}

export function getGoogleRobustModel(defaultModel = "gemini-2.5-flash") {
  return Deno.env.get("GOOGLE_MODEL_ROBUST")?.trim() || getGoogleLiteModel(defaultModel);
}

export function getGoogleFallbackModel(defaultModel = "gemini-2.5-flash") {
  return Deno.env.get("GOOGLE_MODEL_FALLBACK")?.trim() || defaultModel;
}

export function getGoogleModel(defaultModel = "gemini-2.5-flash-lite") {
  return getGoogleLiteModel(defaultModel);
}

export function getGoogleModelChain(
  preference: "lite" | "robust" | "fallback" = "lite",
  defaults?: {
    lite?: string;
    robust?: string;
    fallback?: string;
  },
) {
  const lite = getGoogleLiteModel(defaults?.lite || "gemini-2.5-flash-lite");
  const robust = getGoogleRobustModel(defaults?.robust || "gemini-2.5-flash");
  const fallback = getGoogleFallbackModel(defaults?.fallback || "gemini-2.5-flash");

  const candidates =
    preference === "robust"
      ? [robust, lite, fallback]
      : preference === "fallback"
      ? [fallback, lite, robust]
      : [lite, robust, fallback];

  return candidates.filter((model, index, list): model is string =>
    Boolean(model) && list.indexOf(model) === index
  );
}

export async function callGemini({
  apiKey,
  model,
  body,
}: GeminiRequestOptions) {
  const response = await fetch(
    `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const raw = await response.text();
    let message = response.statusText || "Gemini istegi basarisiz oldu.";
    let code = "gemini_error";

    try {
      const parsed = JSON.parse(raw);
      message = parsed?.error?.message || message;
      code = parsed?.error?.status || code;
    } catch {
      message = raw || message;
    }

    throw mapGeminiError(response.status, code, message);
  }

  return response.json();
}

function shouldRetryGeminiError(error: GeminiHttpError) {
  return error.code === "rate_limited" || error.code === "provider_error";
}

function shouldTryNextGeminiModel(error: GeminiHttpError) {
  return shouldRetryGeminiError(error) || error.code === "provider_model_error";
}

export async function callGeminiWithRetryAndFallback({
  apiKey,
  body,
  model,
  models,
  modelPreference = "lite",
  maxAttemptsPerModel = 3,
  retryBaseDelayMs = 700,
  requestLabel,
  logMeta,
}: GeminiRetryOptions) {
  const startedAt = Date.now();
  const candidates = (models && models.length > 0
    ? models
    : model
    ? [model, ...getGoogleModelChain(modelPreference)]
    : getGoogleModelChain(modelPreference)
  ).filter((candidate, index, list): candidate is string =>
    Boolean(candidate) && list.indexOf(candidate) === index
  );

  let lastError: GeminiHttpError | null = null;
  const attemptedModels: string[] = [];
  let attemptsCount = 0;
  const functionName = requestLabel?.split(":")[0] || requestLabel || "gemini";

  for (const candidateModel of candidates) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
      attemptedModels.push(candidateModel);
      attemptsCount += 1;
      try {
        if (requestLabel) {
          console.info("gemini attempt", {
            requestLabel,
            model: candidateModel,
            attempt,
            maxAttemptsPerModel,
          });
        }

        const payload = await callGemini({
          apiKey,
          model: candidateModel,
          body,
        });

        await logGeminiInvocation({
          requestLabel,
          functionName,
          status: "success",
          resolvedModel: candidateModel,
          attemptedModels,
          attemptsCount,
          durationMs: Date.now() - startedAt,
          metadata: logMeta,
        });

        return { payload, model: candidateModel };
      } catch (error) {
        if (!(error instanceof GeminiHttpError)) {
          throw error;
        }

        lastError = error;

        if (requestLabel) {
          console.warn("gemini retry/fallback", {
            requestLabel,
            model: candidateModel,
            attempt,
            status: error.status,
            code: error.code,
            message: error.message,
            details: error.details,
          });
        }

        if (!shouldTryNextGeminiModel(error)) {
          throw error;
        }

        const hasMoreAttempts = attempt < maxAttemptsPerModel;
        if (hasMoreAttempts && shouldRetryGeminiError(error)) {
          await sleep(retryBaseDelayMs * attempt);
          continue;
        }

        break;
      }
    }
  }

  if (lastError) {
    await logGeminiInvocation({
      requestLabel,
      functionName,
      status: "error",
      resolvedModel: attemptedModels[attemptedModels.length - 1],
      attemptedModels,
      attemptsCount,
      durationMs: Date.now() - startedAt,
      errorCode: lastError.code,
      errorMessage: lastError.message,
      metadata: logMeta,
    });
    throw lastError;
  }

  await logGeminiInvocation({
    requestLabel,
    functionName,
    status: "error",
    resolvedModel: attemptedModels[attemptedModels.length - 1],
    attemptedModels,
    attemptsCount,
    durationMs: Date.now() - startedAt,
    errorCode: "provider_error",
    errorMessage: "Yapay zeka saglayicisinda gecici bir hata olustu.",
    metadata: logMeta,
  });

  throw new GeminiHttpError(502, "provider_error", "Yapay zeka saglayicisinda gecici bir hata olustu.");
}

export function extractTextFromGeminiResponse(payload: any) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();

  if (!text) {
    throw new GeminiHttpError(
      502,
      "empty_response",
      "Yapay zeka servisinden bos yanit dondu.",
    );
  }

  return text;
}

export function cleanJsonText(raw: string) {
  const withoutFence = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  const firstBracket = withoutFence.indexOf("[");
  const lastBracket = withoutFence.lastIndexOf("]");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return withoutFence.slice(firstBrace, lastBrace + 1);
  }

  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return withoutFence.slice(firstBracket, lastBracket + 1);
  }

  return withoutFence;
}

export function parseImageInput(value: string): GeminiInlineImage {
  if (typeof value !== "string" || !value.trim()) {
    throw new GeminiHttpError(
      400,
      "invalid_payload",
      "Gorsel verisi bos olamaz.",
    );
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new GeminiHttpError(
        400,
        "invalid_payload",
        "Data URL formati gecersiz.",
      );
    }

    return {
      mimeType: match[1],
      data: match[2],
    };
  }

  const normalized = trimmed.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) {
    throw new GeminiHttpError(
      400,
      "invalid_payload",
      "Gorsel verisi yalnizca data URL veya raw base64 olabilir.",
    );
  }

  return {
    mimeType: "image/jpeg",
    data: normalized,
  };
}

export function toInlineDataPart(image: GeminiInlineImage) {
  return {
    inline_data: {
      mime_type: image.mimeType,
      data: image.data,
    },
  };
}

export function mapGeminiError(status: number, code: string, message: string) {
  if (status === 400) {
    return new GeminiHttpError(400, "invalid_payload", message);
  }
  if (status === 401 || status === 403) {
    return new GeminiHttpError(502, "provider_auth_error", "Yapay zeka servisi dogrulanamadi.", message);
  }
  if (status === 404) {
    return new GeminiHttpError(502, "provider_model_error", "Yapay zeka modeli bulunamadi.", message);
  }
  if (status === 429) {
    return new GeminiHttpError(429, "rate_limited", "Yapay zeka servisi gecici olarak yogun.", message);
  }
  if (status >= 500) {
    return new GeminiHttpError(502, "provider_error", "Yapay zeka saglayicisinda gecici bir hata olustu.", message);
  }

  return new GeminiHttpError(502, code || "provider_error", message);
}
