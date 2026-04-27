import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

interface OcrRequestPayload {
  images?: string[];
  fileName?: string;
  languageHints?: string[];
}

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function base64UrlEncode(input: string | Uint8Array) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const cleaned = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function stripDataUrlPrefix(value: string) {
  const parts = value.split(",");
  return parts.length > 1 ? parts[1] : value;
}

function parseServiceAccount(): GoogleServiceAccount {
  const encoded = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
  if (!encoded) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 tanımlı değil.");
  }

  const decodedJson = new TextDecoder().decode(
    Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
  );
  const serviceAccount = JSON.parse(decodedJson) as GoogleServiceAccount;

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Service account içeriği eksik.");
  }

  return serviceAccount;
}

async function createAccessToken(serviceAccount: GoogleServiceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: tokenUri,
      exp: expiresAt,
      iat: issuedAt,
    }),
  );

  const unsignedToken = `${header}.${payload}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );

  const assertion = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google access token alınamadı: ${errorText}`);
  }

  const tokenData = await response.json();
  if (!tokenData.access_token) {
    throw new Error("Google access token yanıtı geçersiz.");
  }

  return tokenData.access_token as string;
}

async function runVisionOcr({
  accessToken,
  images,
  languageHints,
}: {
  accessToken: string;
  images: string[];
  languageHints: string[];
}) {
  const response = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: images.map((image) => ({
        image: {
          content: stripDataUrlPrefix(image),
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        imageContext: { languageHints },
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Vision OCR başarısız oldu: ${errorText}`);
  }

  const data = await response.json();
  const pages = Array.isArray(data.responses)
    ? data.responses.map((entry: Record<string, unknown>) => {
        const fullTextAnnotation = entry.fullTextAnnotation as
          | { text?: string }
          | undefined;
        const textAnnotations = entry.textAnnotations as
          | Array<{ description?: string }>
          | undefined;

        return (
          fullTextAnnotation?.text?.trim() ||
          textAnnotations?.[0]?.description?.trim() ||
          ""
        );
      })
    : [];

  return pages.filter(Boolean).join("\n\n");
}

serve(async (request) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "method_not_allowed" });
    }

    const payload = (await request.json()) as OcrRequestPayload;
    const images = Array.isArray(payload.images)
      ? payload.images.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
      : [];

    if (images.length === 0) {
      return jsonResponse(400, { error: "images_required" });
    }

    console.log(`[extract-pdf-ocr][${requestId}] OCR başlatıldı`, {
      fileName: payload.fileName || null,
      imageCount: images.length,
    });

    const serviceAccount = parseServiceAccount();
    const accessToken = await createAccessToken(serviceAccount);
    const text = await runVisionOcr({
      accessToken,
      images,
      languageHints:
        payload.languageHints && payload.languageHints.length > 0
          ? payload.languageHints
          : ["tr", "en"],
    });

    if (!text.trim()) {
      return jsonResponse(422, {
        error: "ocr_empty",
        message: "OCR tamamlandı ancak okunabilir metin bulunamadı.",
      });
    }

    console.log(`[extract-pdf-ocr][${requestId}] OCR tamamlandı`, {
      textLength: text.length,
    });

    return jsonResponse(200, {
      text,
      textLength: text.length,
      imageCount: images.length,
      source: "google-vision-ocr",
    });
  } catch (error) {
    console.error(`[extract-pdf-ocr][${requestId}] OCR hatası`, error);
    return jsonResponse(500, {
      error: "ocr_failed",
      message: error instanceof Error ? error.message : "OCR işlemi başarısız oldu.",
    });
  }
});
