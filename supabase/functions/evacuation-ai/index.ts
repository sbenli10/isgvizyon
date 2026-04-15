import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  GeminiHttpError,
  callGemini,
  callGeminiWithRetryAndFallback,
  cleanJsonText,
  extractTextFromGeminiResponse,
  getGoogleLiteModel,
  getGoogleRobustModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

interface AIPlanRoom {
  id?: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AIPlanPointItem {
  id?: string;
  name?: string;
  x: number;
  y: number;
}

interface AIPlanRoute {
  id?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface AIEvacuationPlan {
  rooms: AIPlanRoom[];
  exits: AIPlanPointItem[];
  extinguishers: AIPlanPointItem[];
  routes: AIPlanRoute[];
}

interface RequestBody {
  action?: "plan" | "improve" | "image";
  prompt?: string;
  currentPlan?: AIEvacuationPlan;
}

const PLAN_SYSTEM_PROMPT = `Sen yangin guvenligi ve tahliye plani tasarimi konusunda uzman bir yapay zekasin.

Kullanicinin verdigi bina aciklamasina gore mantikli bir tahliye plani uret.

Canvas boyutu:
1200 x 800

Kurallar:
- Odalar mantikli yerlesimde olmali
- Cikislar bina kenarina yakin olmali
- Tahliye yollari en yakin cikisa gitmeli
- Yangin sonduruculer koridor veya girislerde olmali
- Sadece JSON uret

JSON formati:
{
  "rooms": [],
  "exits": [],
  "extinguishers": [],
  "routes": []
}`;

const IMAGE_SYSTEM_PROMPT = `Sen profesyonel acil durum plani gorsellestirme uzmanisin.
Tek bir yuksek kaliteli, 3D izometrik acil durum plani gorseli uret.

Kurallar:
- Teknik ama estetik ve kurumsal bir poster hissi olsun
- Tahliye yonleri yesil oklarla acikca gosterilsin
- Acil cikislar net gorunsun
- Rastgele yazi, watermark veya insan figuru ekleme`;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizePointItem(item: any, fallbackName: string): AIPlanPointItem | null {
  const x = toFiniteNumber(item?.x ?? item?.left ?? item?.cx);
  const y = toFiniteNumber(item?.y ?? item?.top ?? item?.cy);
  if (x === null || y === null) return null;
  return {
    id: typeof item?.id === "string" ? item.id : undefined,
    name: typeof item?.name === "string" ? item.name : fallbackName,
    x,
    y,
  };
}

function normalizeRouteItems(rawRoutes: any[]): AIPlanRoute[] {
  const routes: AIPlanRoute[] = [];

  rawRoutes.forEach((route: any, index: number) => {
    const direct = {
      x1: toFiniteNumber(route?.x1 ?? route?.fromX ?? route?.startX),
      y1: toFiniteNumber(route?.y1 ?? route?.fromY ?? route?.startY),
      x2: toFiniteNumber(route?.x2 ?? route?.toX ?? route?.endX),
      y2: toFiniteNumber(route?.y2 ?? route?.toY ?? route?.endY),
    };

    if (direct.x1 !== null && direct.y1 !== null && direct.x2 !== null && direct.y2 !== null) {
      routes.push({ id: route?.id ?? `route-${index}`, x1: direct.x1, y1: direct.y1, x2: direct.x2, y2: direct.y2 });
      return;
    }

    const points = Array.isArray(route?.points) ? route.points : Array.isArray(route) ? route : null;
    if (!points || points.length < 2) return;

    for (let i = 0; i < points.length - 1; i += 1) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const x1 = toFiniteNumber(p1?.x ?? p1?.[0]);
      const y1 = toFiniteNumber(p1?.y ?? p1?.[1]);
      const x2 = toFiniteNumber(p2?.x ?? p2?.[0]);
      const y2 = toFiniteNumber(p2?.y ?? p2?.[1]);
      if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        routes.push({ id: `${route?.id ?? `route-${index}`}-${i}`, x1, y1, x2, y2 });
      }
    }
  });

  return routes;
}

function normalizePlan(raw: any): AIEvacuationPlan {
  const roomsRaw = Array.isArray(raw?.rooms) ? raw.rooms : [];
  const exitsRaw = Array.isArray(raw?.exits) ? raw.exits : [];
  const extRaw = Array.isArray(raw?.extinguishers) ? raw.extinguishers : [];
  const routesRaw = Array.isArray(raw?.routes) ? raw.routes : [];

  const rooms = roomsRaw
    .map((room: any, index: number) => {
      const x = toFiniteNumber(room?.x ?? room?.left);
      const y = toFiniteNumber(room?.y ?? room?.top);
      const width = toFiniteNumber(room?.width ?? room?.w);
      const height = toFiniteNumber(room?.height ?? room?.h);
      if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
        return null;
      }
      return {
        id: typeof room?.id === "string" ? room.id : `room-${index}`,
        name: typeof room?.name === "string" ? room.name : "Oda",
        x,
        y,
        width,
        height,
      } satisfies AIPlanRoom;
    })
    .filter(Boolean) as AIPlanRoom[];

  return {
    rooms,
    exits: exitsRaw.map((item: any) => normalizePointItem(item, "Acil Cikis")).filter(Boolean) as AIPlanPointItem[],
    extinguishers: extRaw
      .map((item: any) => normalizePointItem(item, "Yangin Sondurucu"))
      .filter(Boolean) as AIPlanPointItem[],
    routes: normalizeRouteItems(routesRaw),
  };
}

function extractImageData(payload: any) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const base64 = part?.inlineData?.data ?? part?.inline_data?.data;
      const mimeType = part?.inlineData?.mimeType ?? part?.inline_data?.mime_type ?? "image/png";
      if (typeof base64 === "string" && base64.length > 100) {
        return { base64, mimeType };
      }
    }
  }

  throw new GeminiHttpError(502, "empty_response", "Gorsel uretimi sonucunda beklenen veri donmedi.");
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
    const action = body?.action;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!action || !["plan", "improve", "image"].includes(action)) {
      return jsonResponse(400, {
        success: false,
        error: { code: "invalid_payload", message: "Gecerli bir `action` gonderilmelidir." },
      });
    }

    if (!prompt) {
      return jsonResponse(400, {
        success: false,
        error: { code: "invalid_payload", message: "`prompt` alani zorunludur." },
      });
    }

    const apiKey = getRequiredGoogleApiKey();

    if (action === "image") {
      const imagePayload = await callGemini({
        apiKey,
        model: "gemini-2.5-flash-image-preview",
        body: {
          contents: [
            {
              role: "user",
              parts: [{ text: `${IMAGE_SYSTEM_PROMPT}\n\nKullanici gereksinimleri:\n${prompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            responseModalities: ["IMAGE", "TEXT"],
          },
        },
      });

      const image = extractImageData(imagePayload);
      return jsonResponse(200, {
        success: true,
        dataUrl: `data:${image.mimeType};base64,${image.base64}`,
        mimeType: image.mimeType,
      });
    }

    const currentPlan = body?.currentPlan ? JSON.stringify(body.currentPlan) : "";
    const textPrompt =
      action === "improve"
        ? `${PLAN_SYSTEM_PROMPT}\n\nMevcut plan JSON:\n${currentPlan}\n\nGuncelleme istegi:\n${prompt}\n\nYanit olarak guncellenmis tum JSON plani dondur.`
        : `${PLAN_SYSTEM_PROMPT}\n\nKullanici aciklamasi:\n${prompt}`;

    const preferredModel = action === "improve" ? getGoogleRobustModel() : getGoogleLiteModel();
    const { payload: planPayload } = await callGeminiWithRetryAndFallback({
      apiKey,
      model: preferredModel,
      modelPreference: action === "improve" ? "robust" : "lite",
      requestLabel: `evacuation-ai:${action}`,
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: textPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
        },
      },
    });

    const normalized = normalizePlan(JSON.parse(cleanJsonText(extractTextFromGeminiResponse(planPayload))));
    return jsonResponse(200, { success: true, plan: normalized });
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      return jsonResponse(error.status, {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    console.error("evacuation-ai error:", error);
    return jsonResponse(500, {
      success: false,
      error: { code: "unexpected_error", message: "Tahliye AI islemi tamamlanamadi." },
    });
  }
});
