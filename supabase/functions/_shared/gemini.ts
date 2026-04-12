export interface GeminiInlineImage {
  mimeType: string;
  data: string;
}

export interface GeminiRequestOptions {
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
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

export function getGoogleModel(defaultModel = "gemini-2.5-flash") {
  return Deno.env.get("GOOGLE_MODEL") || defaultModel;
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
