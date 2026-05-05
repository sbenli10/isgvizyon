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

// --------------------------------------------------
// Types
// --------------------------------------------------
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
  firstAidPoints?: AIPlanPointItem[];
  assemblyPoints?: AIPlanPointItem[];
  alarmPoints?: AIPlanPointItem[];
  emergencyLights?: AIPlanPointItem[];
}

interface RequestBody {
  action?: "plan" | "improve" | "image";
  prompt?: string;
  currentPlan?: AIEvacuationPlan;
  planTitle?: string;
  facilityName?: string;
  floorName?: string;
  areaM2?: number;
  revisionNo?: string;
}
type ImageModelKind = "gemini" | "imagen";



// --------------------------------------------------
// Prompts
// --------------------------------------------------
const PLAN_SYSTEM_PROMPT = `Sen yangin guvenligi ve tahliye plani tasarimi konusunda uzman bir yapay zekasin.

Kullanicinin verdigi bina aciklamasina gore mantikli bir tahliye plani uret.

Canvas boyutu:
1200 x 800

TEMEL KURALLAR:
- Odalar mantikli ve okunabilir yerlesimde olmali.
- Koridor akisi mantikli olmali.
- Cikislar bina kenarina yakin olmali.
- Tahliye yollari odalardan en yakin cikisa gitmeli.
- Yangin sonduruculer koridor, cikis ve erisim kolay alanlarda olmali.
- Gecerli JSON haricinde hicbir aciklama yazma.
- Yanit daima TAM ve GECERLI JSON olsun.

JSON formati:
{
  "rooms": [],
  "exits": [],
  "extinguishers": [],
  "routes": [],
  "firstAidPoints": [],
  "assemblyPoints": [],
  "alarmPoints": [],
  "emergencyLights": []
}`;

const IMAGE_SYSTEM_PROMPT = `Sen resmi ve kurumsal acil durum tahliye plani tasarimi konusunda uzman bir yapay zekasin.

Amaç:
Gösterişli 3D render değil, resmi kullanıma uygun, okunaklı, profesyonel, pafta düzeninde bir acil durum tahliye planı oluştur.

ZORUNLU TASARIM KURALLARI:
- Görünüm ağırlıklı olarak 2D üstten plan görünümünde olsun.
- Gerekiyorsa hafif derinlik hissi olabilir ama 3D izometrik sunum görseli gibi olmasın.
- Teknik okunabilirlik estetikten daha önemli olsun.
- Beyaz veya çok açık zemin üzerinde temiz, kurumsal, resmi bir plan paftası düzeni kullan.
- Kalın dış çerçeve ve düzenli sayfa yapısı olsun.

ZORUNLU İÇERİK:
- Üst bölümde büyük ve net başlık: "ACİL DURUM TAHLİYE PLANI"
- Başlığın altında veya yanında alt başlık: tesis/bina adı, kat bilgisi, alan bilgisi
- Sağ üst veya alt bölümde teknik bilgi kutusu:
  * Tesis/Bina adı
  * Kat/Bölüm
  * Alan (m²)
  * Oda sayısı
  * Acil çıkış sayısı
  * Yangın söndürücü sayısı
  * İlk yardım noktası sayısı
  * Alarm noktası sayısı
  * Toplanma alanı
  * Plan No
  * Revizyon No
  * Tarih
  * Ölçek notu: "Ölçekli değildir / Şematik gösterim"
- Lejant / sembol açıklama kutusu mutlaka bulunsun.
- Plan üzerinde "BURADASINIZ" işareti mutlaka yer alsın.
- Toplanma alanı bina dışında net şekilde gösterilsin.
- Tahliye rotaları yeşil yön oklarıyla açıkça gösterilsin.
- Acil çıkışlar standart yeşil kaçış sembolleriyle gösterilsin.
- Yangın söndürücüler kırmızı standart sembollerle gösterilsin.
- İlk yardım, alarm noktası ve diğer güvenlik işaretleri standart plan sembol diliyle gösterilsin.

GÖRSEL KARAKTER:
- Resmi plan paftası hissi versin.
- Mimari yerleşim gerçekçi olsun.
- Ancak poster, konsept art veya reklam görseli gibi görünmesin.
- Su işareti, anlamsız metin, dekoratif fazlalık, insan figürü olmasın.`;

// --------------------------------------------------
// Utilities
// --------------------------------------------------
function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getRoomCenter(room: AIPlanRoom) {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  };
}

function normalizePointItem(
  item: Record<string, unknown>,
  fallbackName: string,
): AIPlanPointItem | null {
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

function normalizeRouteItems(rawRoutes: unknown[]): AIPlanRoute[] {
  const routes: AIPlanRoute[] = [];

  rawRoutes.forEach((routeUnknown, index) => {
    const route = routeUnknown as Record<string, unknown>;

    const direct = {
      x1: toFiniteNumber(route?.x1 ?? route?.fromX ?? route?.startX),
      y1: toFiniteNumber(route?.y1 ?? route?.fromY ?? route?.startY),
      x2: toFiniteNumber(route?.x2 ?? route?.toX ?? route?.endX),
      y2: toFiniteNumber(route?.y2 ?? route?.toY ?? route?.endY),
    };

    if (
      direct.x1 !== null &&
      direct.y1 !== null &&
      direct.x2 !== null &&
      direct.y2 !== null
    ) {
      routes.push({
        id: typeof route?.id === "string" ? route.id : `route-${index}`,
        x1: direct.x1,
        y1: direct.y1,
        x2: direct.x2,
        y2: direct.y2,
      });
      return;
    }

    const points = Array.isArray(route?.points)
      ? route.points
      : Array.isArray(routeUnknown)
        ? routeUnknown as unknown[]
        : null;

    if (!points || points.length < 2) return;

    for (let i = 0; i < points.length - 1; i += 1) {
      const p1 = points[i] as Record<string, unknown> | number[];
      const p2 = points[i + 1] as Record<string, unknown> | number[];

      const x1 = toFiniteNumber((p1 as Record<string, unknown>)?.x ?? (p1 as number[])[0]);
      const y1 = toFiniteNumber((p1 as Record<string, unknown>)?.y ?? (p1 as number[])[1]);
      const x2 = toFiniteNumber((p2 as Record<string, unknown>)?.x ?? (p2 as number[])[0]);
      const y2 = toFiniteNumber((p2 as Record<string, unknown>)?.y ?? (p2 as number[])[1]);

      if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        routes.push({
          id: `${typeof route?.id === "string" ? route.id : `route-${index}`}-${i}`,
          x1,
          y1,
          x2,
          y2,
        });
      }
    }
  });

  return routes;
}

function inferTechnicalInfo(plan: AIEvacuationPlan, body?: RequestBody) {
  const areaFromRooms = plan.rooms.reduce((sum, room) => {
    return sum + Math.max(0, room.width * room.height);
  }, 0);

  // Canvas koordinat alanı olduğu için birebir m² değil.
  // Kullanıcı areaM2 girdiyse onu öncelikli kullan.
  const areaM2 =
    typeof body?.areaM2 === "number" && Number.isFinite(body.areaM2)
      ? body.areaM2
      : Math.max(1, Math.round(areaFromRooms / 1000));

  return {
    planTitle:
      body?.planTitle?.trim() ||
      body?.facilityName?.trim()
        ? `${body?.facilityName?.trim() || "TESİS"} ACİL DURUM TAHLİYE PLANI`
        : "ACİL DURUM TAHLİYE PLANI",

    facilityName: body?.facilityName?.trim() || "Belirtilmemiş",
    floorName: body?.floorName?.trim() || "Zemin Kat",
    revisionNo: body?.revisionNo?.trim() || "Rev.01",
    areaM2,
    roomCount: plan.rooms.length,
    exitCount: plan.exits.length,
    extinguisherCount: plan.extinguishers.length,
    firstAidCount: plan.firstAidPoints?.length || 0,
    alarmCount: plan.alarmPoints?.length || 0,
    emergencyLightCount: plan.emergencyLights?.length || 0,
    assemblyPointCount: plan.assemblyPoints?.length || 0,
    generatedAt: new Date().toLocaleDateString("tr-TR"),
    scaleNote: "Ölçekli değildir / Şematik gösterim",
  };
}

function normalizePointArray(
  raw: unknown,
  fallbackName: string,
): AIPlanPointItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((item) => normalizePointItem(item as Record<string, unknown>, fallbackName))
    .filter((a): a is AIPlanPointItem => !!a);
}

function normalizePlan(raw: unknown): AIEvacuationPlan {
  const r = (raw ?? {}) as Record<string, unknown>;

  const roomsRaw = Array.isArray(r?.rooms) ? r.rooms : [];
  const routesRaw = Array.isArray(r?.routes) ? r.routes : [];

  const rooms = roomsRaw
    .map((roomUnknown, index) => {
      const room = roomUnknown as Record<string, unknown>;

      const x = toFiniteNumber(room?.x ?? room?.left);
      const y = toFiniteNumber(room?.y ?? room?.top);
      const width = toFiniteNumber(room?.width ?? room?.w);
      const height = toFiniteNumber(room?.height ?? room?.h);

      if (
        x === null ||
        y === null ||
        width === null ||
        height === null ||
        width <= 0 ||
        height <= 0
      ) {
        return null;
      }

      return {
        id: typeof room?.id === "string" ? room.id : `room-${index + 1}`,
        name: typeof room?.name === "string" ? room.name : `Oda ${index + 1}`,
        x,
        y,
        width,
        height,
      } as AIPlanRoom;
    })
    .filter((a): a is AIPlanRoom => !!a);

  return {
    rooms,
    exits: normalizePointArray(r?.exits, "Acil Çıkış"),
    extinguishers: normalizePointArray(r?.extinguishers, "Yangın Söndürücü"),
    routes: normalizeRouteItems(routesRaw as unknown[]),
    firstAidPoints: normalizePointArray(r?.firstAidPoints, "İlk Yardım"),
    assemblyPoints: normalizePointArray(r?.assemblyPoints, "Toplanma Alanı"),
    alarmPoints: normalizePointArray(r?.alarmPoints, "Alarm Butonu"),
    emergencyLights: normalizePointArray(r?.emergencyLights, "Acil Aydınlatma"),
  };
}

function dedupePoints(items: AIPlanPointItem[], gridSize = 24): AIPlanPointItem[] {
  const map = new Map<string, AIPlanPointItem>();

  items.forEach((item, index) => {
    const gx = Math.round(item.x / gridSize) * gridSize;
    const gy = Math.round(item.y / gridSize) * gridSize;
    const key = `${item.name ?? "item"}-${gx}-${gy}`;

    if (!map.has(key)) {
      map.set(key, {
        ...item,
        id: item.id || `${(item.name || "item").toLowerCase().replaceAll(" ", "-")}-${index + 1}`,
        x: gx,
        y: gy,
      });
    }
  });

  return Array.from(map.values());
}

function getBuildingBounds(plan: AIEvacuationPlan) {
  if (!plan.rooms.length) {
    return { minX: 80, minY: 80, maxX: 1120, maxY: 720, width: 1040, height: 640 };
  }

  const minX = Math.min(...plan.rooms.map((r) => r.x));
  const minY = Math.min(...plan.rooms.map((r) => r.y));
  const maxX = Math.max(...plan.rooms.map((r) => r.x + r.width));
  const maxY = Math.max(...plan.rooms.map((r) => r.y + r.height));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function createDefaultExits(plan: AIEvacuationPlan): AIPlanPointItem[] {
  const bounds = getBuildingBounds(plan);
  const cx = bounds.minX + bounds.width / 2;
  const cy = bounds.minY + bounds.height / 2;

  const count = plan.rooms.length >= 4 || bounds.width > 700 || bounds.height > 500 ? 2 : 1;

  const exits: AIPlanPointItem[] = [
    {
      id: "exit-1",
      name: "Acil Çıkış",
      x: round(cx),
      y: round(bounds.maxY + 12),
    },
  ];

  if (count >= 2) {
    exits.push({
      id: "exit-2",
      name: "Acil Çıkış",
      x: round(bounds.maxX + 12),
      y: round(cy),
    });
  }

  return exits;
}

function createDefaultExtinguishers(plan: AIEvacuationPlan): AIPlanPointItem[] {
  const items: AIPlanPointItem[] = [];

  plan.exits.forEach((exit, index) => {
    items.push({
      id: `ext-exit-${index + 1}`,
      name: "Yangın Söndürücü",
      x: clamp(exit.x - 36, 40, 1160),
      y: clamp(exit.y - 24, 40, 760),
    });
  });

  plan.rooms.forEach((room, index) => {
    items.push({
      id: `ext-room-${index + 1}`,
      name: "Yangın Söndürücü",
      x: clamp(room.x + 20, 40, 1160),
      y: clamp(room.y + 20, 40, 760),
    });
  });

  if (!items.length) {
    items.push(
      { id: "ext-1", name: "Yangın Söndürücü", x: 180, y: 160 },
      { id: "ext-2", name: "Yangın Söndürücü", x: 980, y: 620 },
    );
  }

  return dedupePoints(items);
}

function createDefaultAlarmPoints(plan: AIEvacuationPlan): AIPlanPointItem[] {
  const points: AIPlanPointItem[] = [];

  plan.exits.forEach((exit, index) => {
    points.push({
      id: `alarm-${index + 1}`,
      name: "Alarm Butonu",
      x: clamp(exit.x + 28, 40, 1160),
      y: clamp(exit.y - 8, 40, 760),
    });
  });

  if (!points.length) {
    points.push({ id: "alarm-1", name: "Alarm Butonu", x: 120, y: 120 });
  }

  return dedupePoints(points);
}

function createDefaultFirstAidPoints(plan: AIEvacuationPlan): AIPlanPointItem[] {
  const bounds = getBuildingBounds(plan);

  return [
    {
      id: "first-aid-1",
      name: "İlk Yardım",
      x: round(bounds.minX + bounds.width / 2),
      y: round(bounds.minY + bounds.height / 2),
    },
  ];
}

function createDefaultAssemblyPoints(plan: AIEvacuationPlan): AIPlanPointItem[] {
  const bounds = getBuildingBounds(plan);

  return [
    {
      id: "assembly-1",
      name: "Toplanma Alanı",
      x: round(bounds.maxX + 90),
      y: round(bounds.maxY + 60),
    },
  ];
}

function createDefaultEmergencyLights(plan: AIEvacuationPlan): AIPlanPointItem[] {
  const bounds = getBuildingBounds(plan);
  const points: AIPlanPointItem[] = [
    {
      id: "light-1",
      name: "Acil Aydınlatma",
      x: round(bounds.minX + bounds.width / 2),
      y: round(bounds.minY + 24),
    },
    {
      id: "light-2",
      name: "Acil Aydınlatma",
      x: round(bounds.minX + bounds.width / 2),
      y: round(bounds.maxY - 24),
    },
  ];

  plan.exits.forEach((exit, index) => {
    points.push({
      id: `light-exit-${index + 1}`,
      name: "Acil Aydınlatma",
      x: exit.x,
      y: clamp(exit.y - 36, 24, 760),
    });
  });

  return dedupePoints(points);
}

function createDefaultRoutes(plan: AIEvacuationPlan): AIPlanRoute[] {
  const routes: AIPlanRoute[] = [];
  const exits = plan.exits.length ? plan.exits : createDefaultExits(plan);

  if (!plan.rooms.length) {
    if (exits.length) {
      routes.push(
        {
          id: "route-generic-1",
          x1: 300,
          y1: 240,
          x2: 300,
          y2: exits[0].y,
        },
        {
          id: "route-generic-2",
          x1: 300,
          y1: exits[0].y,
          x2: exits[0].x,
          y2: exits[0].y,
        },
      );
    }
    return routes;
  }

  plan.rooms.forEach((room, index) => {
    const center = getRoomCenter(room);

    let nearestExit = exits[0];
    let nearestDistance = distance(center, nearestExit);

    exits.forEach((exit) => {
      const d = distance(center, exit);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestExit = exit;
      }
    });

    const midX = round(center.x);
    const midY = round(nearestExit.y);

    routes.push(
      {
        id: `route-${index + 1}-a`,
        x1: round(center.x),
        y1: round(center.y),
        x2: midX,
        y2: midY,
      },
      {
        id: `route-${index + 1}-b`,
        x1: midX,
        y1: midY,
        x2: round(nearestExit.x),
        y2: round(nearestExit.y),
      },
    );
  });

  return routes;
}

function autoPopulateClassicSafetyItems(plan: AIEvacuationPlan): AIEvacuationPlan {
  const enriched: AIEvacuationPlan = {
    ...plan,
    rooms: [...plan.rooms],
    exits: dedupePoints(plan.exits.length ? plan.exits : createDefaultExits(plan)),
    extinguishers: dedupePoints(
      plan.extinguishers.length ? plan.extinguishers : createDefaultExtinguishers(plan),
    ),
    routes: plan.routes.length ? plan.routes : [],
    firstAidPoints: dedupePoints(
      plan.firstAidPoints?.length ? plan.firstAidPoints : createDefaultFirstAidPoints(plan),
    ),
    assemblyPoints: dedupePoints(
      plan.assemblyPoints?.length ? plan.assemblyPoints : createDefaultAssemblyPoints(plan),
    ),
    alarmPoints: dedupePoints(
      plan.alarmPoints?.length ? plan.alarmPoints : createDefaultAlarmPoints(plan),
    ),
    emergencyLights: dedupePoints(
      plan.emergencyLights?.length ? plan.emergencyLights : createDefaultEmergencyLights(plan),
    ),
  };

  if (!enriched.routes.length) {
    enriched.routes = createDefaultRoutes(enriched);
  }

  return enriched;
}

function mergePlans(basePlan: AIEvacuationPlan, candidatePlan: AIEvacuationPlan): AIEvacuationPlan {
  return {
    rooms: candidatePlan.rooms.length ? candidatePlan.rooms : basePlan.rooms,
    exits: candidatePlan.exits.length ? candidatePlan.exits : basePlan.exits,
    extinguishers: candidatePlan.extinguishers.length
      ? candidatePlan.extinguishers
      : basePlan.extinguishers,
    routes: candidatePlan.routes.length ? candidatePlan.routes : basePlan.routes,
    firstAidPoints: candidatePlan.firstAidPoints?.length
      ? candidatePlan.firstAidPoints
      : basePlan.firstAidPoints,
    assemblyPoints: candidatePlan.assemblyPoints?.length
      ? candidatePlan.assemblyPoints
      : basePlan.assemblyPoints,
    alarmPoints: candidatePlan.alarmPoints?.length
      ? candidatePlan.alarmPoints
      : basePlan.alarmPoints,
    emergencyLights: candidatePlan.emergencyLights?.length
      ? candidatePlan.emergencyLights
      : basePlan.emergencyLights,
  };
}

function buildPlanSummary(plan: AIEvacuationPlan): string {
  const roomsText = plan.rooms.length
    ? plan.rooms
      .map(
        (room, index) =>
          `${index + 1}. ${room.name ?? `Oda ${index + 1}`} (x:${room.x}, y:${room.y}, w:${room.width}, h:${room.height})`,
      )
      .join("\n")
    : "Oda bilgisi yok";

  const exitsText = plan.exits.length
    ? plan.exits.map((e, i) => `${i + 1}. ${e.name ?? "Acil Çıkış"} (${e.x}, ${e.y})`).join("\n")
    : "Çıkış bilgisi yok";

  const extText = plan.extinguishers.length
    ? plan.extinguishers.map((e, i) => `${i + 1}. ${e.name ?? "Yangın Söndürücü"} (${e.x}, ${e.y})`).join("\n")
    : "Yangın söndürücü bilgisi yok";

  const routeText = plan.routes.length
    ? plan.routes.map((r, i) => `${i + 1}. (${r.x1}, ${r.y1}) -> (${r.x2}, ${r.y2})`).join("\n")
    : "Rota bilgisi yok";

  const firstAidText = plan.firstAidPoints?.length
    ? plan.firstAidPoints.map((e, i) => `${i + 1}. ${e.name ?? "İlk Yardım"} (${e.x}, ${e.y})`).join("\n")
    : "İlk yardım noktası yok";

  const assemblyText = plan.assemblyPoints?.length
    ? plan.assemblyPoints.map((e, i) => `${i + 1}. ${e.name ?? "Toplanma Alanı"} (${e.x}, ${e.y})`).join("\n")
    : "Toplanma alanı yok";

  const alarmText = plan.alarmPoints?.length
    ? plan.alarmPoints.map((e, i) => `${i + 1}. ${e.name ?? "Alarm Butonu"} (${e.x}, ${e.y})`).join("\n")
    : "Alarm noktası yok";

  return `PLAN ÖZETİ
Odalar:
${roomsText}

Çıkışlar:
${exitsText}

Yangın Söndürücüler:
${extText}

Tahliye Rotaları:
${routeText}

İlk Yardım Noktaları:
${firstAidText}

Toplanma Alanları:
${assemblyText}

Alarm Noktaları:
${alarmText}`;
}

function buildImagePrompt(
  userPrompt: string,
  plan?: AIEvacuationPlan,
  body?: RequestBody,
): string {
  const planSummary = plan ? buildPlanSummary(plan) : "Yapısal plan özeti gönderilmedi.";
  const tech = plan ? inferTechnicalInfo(plan, body) : null;

  return `${IMAGE_SYSTEM_PROMPT}

Kullanıcının bina/mekan açıklaması:
${userPrompt}

${planSummary}

BAŞLIK:
"${tech?.planTitle || "ACİL DURUM TAHLİYE PLANI"}"

ALT BAŞLIK:
"${tech ? `${tech.areaM2} m² - ${tech.roomCount} oda - ${tech.exitCount} acil çıkış` : "Teknik plan görünümü" }"

TEKNİK BİLGİLER:
- Tesis / Alan: ${tech?.facilityName || "Belirtilmemiş"}
- Kat: ${tech?.floorName || "Zemin Kat"}
- Toplam Alan: ${tech?.areaM2 || "-"} m²
- Oda Sayısı: ${tech?.roomCount || 0}
- Acil Çıkış Sayısı: ${tech?.exitCount || 0}
- Yangın Söndürücü Sayısı: ${tech?.extinguisherCount || 0}
- İlk Yardım Noktası Sayısı: ${tech?.firstAidCount || 0}
- Alarm Noktası Sayısı: ${tech?.alarmCount || 0}
- Acil Aydınlatma Sayısı: ${tech?.emergencyLightCount || 0}
- Toplanma Alanı Sayısı: ${tech?.assemblyPointCount || 0}
- Revizyon No: ${tech?.revisionNo || "Rev.01"}
- Tarih: ${tech?.generatedAt || ""}
- Ölçek Notu: ${tech?.scaleNote || "Ölçekli değildir / Şematik gösterim"}

GÖRSEL HEDEFİ:
- Bu çıktı resmi kurumsal kullanım için hazırlanmış bir tahliye planı paftası gibi görünmelidir.
- Öncelik görsel şıklık değil, okunabilirlik ve plan standardıdır.
- 3D render görünümünden kaçın, 2D top-view plan düzenini tercih et.
- Metinler okunaklı ve düzenli olsun.
- Teknik tablo ve lejant gerçeğe uygun şekilde yerleştirilsin.
- Beyaz veya açık zeminli teknik pafta düzeni kullan.
- Kalın dış çerçeve, başlık bandı, teknik bilgi kutusu ve lejant alanı olsun.
- Plan üzerinde "BURADASINIZ" işareti mutlaka yer alsın.
- Toplanma alanı bina dışında net şekilde gösterilsin.
- Tahliye rotaları yeşil yön oklarıyla açıkça gösterilsin.
- Acil çıkışlar standart yeşil kaçış sembolleriyle gösterilsin.
- Yangın söndürücüler kırmızı standart sembollerle gösterilsin.
- İlk yardım noktası, alarm butonu ve acil aydınlatma noktaları standart sembollerle gösterilsin.
- Görsel resmi, sade, teknik ve yazdırılabilir formatta olsun.`;
}

// --------------------------------------------------
// Safe JSON Parse / Repair
// --------------------------------------------------
function repairTruncatedJson(input: string): string {
  let text = input.trim();

  const firstBrace = text.indexOf("{");
  if (firstBrace > 0) {
    text = text.slice(firstBrace);
  }

  text = text
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]");

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") stack.push("}");
    if (ch === "[") stack.push("]");
    if (ch === "}" || ch === "]") {
      if (stack.length && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  if (inString) text += "\"";

  while (stack.length) {
    text += stack.pop();
  }

  return text;
}

function safeParsePlanJson(cleaned: string): unknown {
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    console.error("Ilk JSON parse hatasi:", firstError);
    console.error("Ilk parse edilemeyen text:", cleaned);

    const repaired = repairTruncatedJson(cleaned);

    try {
      return JSON.parse(repaired);
    } catch (secondError) {
      console.error("Repair sonrasi JSON parse hatasi:", secondError);
      console.error("Repair edilmis text:", repaired);

      throw new GeminiHttpError(
        502,
        "invalid_model_json",
        "AI modeli gecerli JSON dondurmedi.",
        JSON.stringify({
          firstError: String(firstError),
          secondError: String(secondError),
          rawText: cleaned.slice(0, 3000),
        }),
      );
    }
  }
}

// --------------------------------------------------
// Image Model Helpers
// --------------------------------------------------
function normalizeImageModelName(modelName: string): string {
  const normalized = modelName.trim();

  const aliases: Record<string, string> = {
    "gemini-3.1-flash-image": "gemini-3.1-flash-image-preview",
    "gemini-3-pro-image": "gemini-3-pro-image-preview",
    "imagen-4-generate": "imagen-4.0-generate-001",
  };

  return aliases[normalized] ?? normalized;
}

function getImageModelKind(modelName: string): ImageModelKind {
  if (modelName.startsWith("imagen-")) return "imagen";
  return "gemini";
}

function getImageModelList(): string[] {
  const models = [
    Deno.env.get("GOOGLE_GEMINI_MODEL") || "gemini-3.1-flash-image-preview",
    Deno.env.get("GOOGLE_MODEL_IMAGE_FALLBACK_1") || "imagen-4.0-generate-001",
    Deno.env.get("GOOGLE_MODEL_IMAGE_FALLBACK_2") || "gemini-3-pro-image-preview",
  ]
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    .map(normalizeImageModelName);

  return [...new Set(models)];
}

function extractImageData(payload: unknown) {
  const candidates = Array.isArray((payload as Record<string, unknown>)?.candidates)
    ? (payload as Record<string, unknown>).candidates as unknown[]
    : [];

  for (const candidate of candidates) {
    const content = (candidate as Record<string, unknown>)?.content as
      | Record<string, unknown>
      | undefined;

    const parts = Array.isArray(content?.parts) ? content.parts as unknown[] : [];

    for (const part of parts) {
      const p = part as Record<string, unknown>;

      let base64: string | undefined;
      let mimeType = "image/png";

      if (typeof p.inlineData === "object" && p.inlineData !== null) {
        const inlineData = p.inlineData as Record<string, unknown>;
        if (typeof inlineData.data === "string") base64 = inlineData.data;
        if (typeof inlineData.mimeType === "string") mimeType = inlineData.mimeType;
      }

      if (!base64 && typeof p.inline_data === "object" && p.inline_data !== null) {
        const inlineData = p.inline_data as Record<string, unknown>;
        if (typeof inlineData.data === "string") base64 = inlineData.data;
        if (typeof inlineData.mime_type === "string") mimeType = inlineData.mime_type;
      }

      if (typeof base64 === "string" && base64.length > 100) {
        return { base64, mimeType };
      }
    }
  }

  throw new GeminiHttpError(
    502,
    "empty_response",
    "Görsel üretimi sonucunda beklenen veri dönmedi.",
  );
}

function extractImagenImageData(payload: unknown) {
  const p = payload as Record<string, unknown>;
  const predictions = Array.isArray(p?.predictions) ? p.predictions as unknown[] : [];

  for (const predictionUnknown of predictions) {
    const prediction = predictionUnknown as Record<string, unknown>;

    const base64 =
      typeof prediction?.bytesBase64Encoded === "string"
        ? prediction.bytesBase64Encoded
        : typeof prediction?.bytes_base64_encoded === "string"
          ? prediction.bytes_base64_encoded
          : undefined;

    const mimeType =
      typeof prediction?.mimeType === "string"
        ? prediction.mimeType
        : typeof prediction?.mime_type === "string"
          ? prediction.mime_type
          : "image/png";

    if (typeof base64 === "string" && base64.length > 100) {
      return { base64, mimeType };
    }
  }

  throw new GeminiHttpError(
    502,
    "empty_response",
    "Imagen görsel üretimi sonucunda beklenen veri dönmedi.",
  );
}

async function callImagenGenerateImage(params: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const { apiKey, model, prompt } = params;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "4:3",
          personGeneration: "dont_allow",
        },
      }),
    },
  );

  const text = await response.text();

  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new GeminiHttpError(
      response.status || 502,
      "provider_parse_error",
      "Imagen API cevabı JSON olarak okunamadı.",
      text,
    );
  }

  if (!response.ok) {
    const errorPayload = payload as {
      error?: { code?: number; status?: string; message?: string; details?: unknown };
    };

    throw new GeminiHttpError(
      response.status,
      "provider_model_error",
      errorPayload?.error?.message || "Imagen görsel üretimi başarısız oldu.",
      JSON.stringify(errorPayload?.error ?? payload),
    );
  }

  return payload;
}

// --------------------------------------------------
// Main
// --------------------------------------------------
Deno.serve(async (req) => {
  console.info("Yeni istek alindi:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers),
  });

  if (req.method === "OPTIONS") {
    console.info("OPTIONS istek tipi icin CORS header donduruluyor.");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, {
        success: false,
        error: {
          code: "method_not_allowed",
          message: "Yalnizca POST desteklenir.",
        },
      });
    }

    const body = (await req.json()) as RequestBody;
    console.log("Gelen body:", body);

    const action = body?.action;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!action || !["plan", "improve", "image"].includes(action)) {
      return jsonResponse(400, {
        success: false,
        error: {
          code: "invalid_payload",
          message: "Gecerli bir `action` gonderilmelidir.",
        },
      });
    }

    if (!prompt) {
      return jsonResponse(400, {
        success: false,
        error: {
          code: "invalid_payload",
          message: "`prompt` alani zorunludur.",
        },
      });
    }

    const apiKey = getRequiredGoogleApiKey();
    console.log("Gerekli Google API key alindi:", !!apiKey);

    // ----------------------------------------------
    // IMAGE
    // ----------------------------------------------
    if (action === "image") {
      const inputPlan = body?.currentPlan
        ? autoPopulateClassicSafetyItems(normalizePlan(body.currentPlan))
        : undefined;

      const imagePrompt = buildImagePrompt(prompt, inputPlan, body);
      const imageModels = getImageModelList();
      let lastError: unknown = null;

      console.info("Denenecek image modelleri:", imageModels);

      for (const modelName of imageModels) {
        try {
          const modelKind = getImageModelKind(modelName);
          console.info(`[${modelName}] ile görsel üretiliyor. Model tipi: ${modelKind}`);

          if (modelKind === "imagen") {
            const imagePayload = await callImagenGenerateImage({
              apiKey,
              model: modelName,
              prompt: imagePrompt,
            });

            const image = extractImagenImageData(imagePayload);

            return jsonResponse(200, {
              success: true,
              dataUrl: `data:${image.mimeType};base64,${image.base64}`,
              mimeType: image.mimeType,
              usedModel: modelName,
              generatedFromPlan: !!inputPlan,
            });
          }

          const imagePayload = await callGemini({
            apiKey,
            model: modelName,
            body: {
              contents: [
                {
                  role: "user",
                  parts: [{ text: imagePrompt }],
                },
              ],
              generationConfig: {
                temperature: 0.4,
                responseModalities: ["IMAGE"],
              },
            },
          });

          const image = extractImageData(imagePayload);

          return jsonResponse(200, {
            success: true,
            dataUrl: `data:${image.mimeType};base64,${image.base64}`,
            mimeType: image.mimeType,
            usedModel: modelName,
            generatedFromPlan: !!inputPlan,
          });
        } catch (err) {
          lastError = err;

          if (err instanceof GeminiHttpError) {
            console.error(`[${modelName}] GeminiHttpError:`, {
              status: err.status,
              code: err.code,
              message: err.message,
              details: err.details,
            });
          } else {
            console.error(`[${modelName}] modelinde bilinmeyen hata:`, err);
          }
        }
      }

      if (lastError instanceof GeminiHttpError) {
        return jsonResponse(lastError.status, {
          success: false,
          error: {
            code: lastError.code,
            message: lastError.message,
            details: lastError.details,
            triedModels: imageModels,
          },
        });
      }

      return jsonResponse(500, {
        success: false,
        error: {
          code: "all_models_failed",
          message: "Hiçbir model ile görsel üretilemedi.",
          details: String(lastError),
          triedModels: imageModels,
        },
      });
    }

    // ----------------------------------------------
    // PLAN / IMPROVE
    // ----------------------------------------------
    const currentPlanObj = body?.currentPlan
      ? autoPopulateClassicSafetyItems(normalizePlan(body.currentPlan))
      : null;

    const currentPlanText = currentPlanObj ? JSON.stringify(currentPlanObj) : "";
    console.log("CurrentPlan bilgisi:", currentPlanText);

    const textPrompt =
      action === "improve"
        ? `${PLAN_SYSTEM_PROMPT}

Mevcut plan JSON:
${currentPlanText}

Guncelleme istegi:
${prompt}

COK ONEMLI:
- Mevcut yapiyi koru, sadece gerekli iyilestirmeleri yap.
- Odalari, cikislari ve rotalari gereksiz yere silme.
- Klasik acil durum ogelerini eksikse tamamla.
- Yangin sonduruculer, alarm noktasi, ilk yardim noktasi, acil aydinlatma ve toplanma alani mantikli sekilde bulunsun.
- JSON disinda hicbir metin yazma.
- Cevap MUTLAKA tam ve gecerli JSON olsun.`
        : `${PLAN_SYSTEM_PROMPT}

Kullanici aciklamasi:
${prompt}

COK ONEMLI:
- Kullanici her detayi yazmasa da klasik acil durum plani ogelerini mantikli sekilde olustur.
- En az mantikli sayida cikis ve tahliye rotasi olustur.
- Yangin sonduruculer, ilk yardim noktasi, alarm noktasi, acil aydinlatma ve toplanma alani ekle.
- JSON disinda hicbir metin yazma.
- Cevap MUTLAKA tam ve gecerli JSON olsun.`;

    const preferredModel = action === "improve"
      ? getGoogleRobustModel()
      : getGoogleLiteModel();

    console.log("Kullanilacak model tercih:", preferredModel);

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
          temperature: 0.1,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      },
    });

    console.log(
      "LLM plan cevabi alindi. Ham sonuc:",
      JSON.stringify(planPayload).slice(0, 800),
      "...",
    );

    const planText = extractTextFromGeminiResponse(planPayload);
    console.log("LLM'den cikan planText:", planText);

    const cleaned = cleanJsonText(planText);
    console.log("Temizlenmis JSON text:", cleaned);

    const parsedPlan = safeParsePlanJson(cleaned);
    const llmNormalized = normalizePlan(parsedPlan);

    const finalPlan = autoPopulateClassicSafetyItems(
      currentPlanObj
        ? mergePlans(currentPlanObj, llmNormalized)
        : llmNormalized,
    );

    const imagePrompt = buildImagePrompt(prompt, finalPlan, body);
    const technicalInfo = inferTechnicalInfo(finalPlan, body);

    console.info("Final normalize + enrich plan:", finalPlan);

    return jsonResponse(200, {
      success: true,
      plan: finalPlan,
      imagePrompt,
      technicalInfo,
      meta: {
        classicItemsAutoGenerated: true,
        usedModel: preferredModel,
      },
    });
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      console.error(
        "GeminiHttpError:",
        error.status,
        error.code,
        error.message,
        error.details,
      );

      return jsonResponse(error.status, {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    console.error("evacuation-ai hata:", error);

    return jsonResponse(500, {
      success: false,
      error: {
        code: "unexpected_error",
        message: "Tahliye AI islemi tamamlanamadi.",
      },
    });
  }
});