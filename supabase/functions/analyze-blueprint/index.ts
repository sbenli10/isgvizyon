import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Max-Age": "86400",
};

interface ProjectInfo {
  area_type: string;
  detected_floor: number | null;
  building_category: string;
  estimated_area_sqm: number | null;
  usage_type?: string;
  construction_year?: number | null;
  occupancy_count?: number | null;
}

interface Equipment {
  type:
    | "extinguisher"
    | "exit"
    | "hydrant"
    | "first_aid"
    | "assembly_point"
    | "alarm"
    | "emergency_light"
    | "fire_hose"
    | "smoke_detector";
  count: number;
  locations: string[];
  adequacy_status: "sufficient" | "insufficient" | "excessive" | "unknown";
  recommended_count?: number | null;
  notes?: string;
}

interface Violation {
  issue: string;
  regulation_reference: string;
  severity: "critical" | "warning" | "info";
  recommended_action: string;
  estimated_cost?: number;
  priority_level?: number;
}

interface RiskAssessment {
  fire_risk: "low" | "medium" | "high";
  structural_risk: "low" | "medium" | "high";
  evacuation_capacity: number;
}

interface ImprovementRoadmap {
  immediate: string[];
  short_term: string[];
  long_term: string[];
}

interface BlueprintAnalysisResult {
  project_info: ProjectInfo;
  equipment_inventory: Equipment[];
  safety_violations: Violation[];
  expert_suggestions: string[];
  compliance_score: number | null;
  risk_assessment?: RiskAssessment;
  improvement_roadmap?: ImprovementRoadmap;
  analysis_report?: {
    plan_bilgileri: Record<string, unknown>;
    oda_ve_alan_listesi: unknown[];
    guvenlik_ekipmanlari_tespiti: unknown[];
    tahliye_yollari_analizi: Record<string, unknown>;
    yonetmelik_uygunluk_kontrolu: Record<string, unknown>;
    iyilestirme_onerileri: string[];
    guven_seviyesi: "Yüksek" | "Orta" | "Düşük";
  };
}

function parseAIResponse(contentText: string): any {
  let cleaned = (contentText || "").trim();
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("JSON içeriği bulunamadı");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function normalizeResult(parsed: any): BlueprintAnalysisResult {
  const safeProjectInfo: ProjectInfo = {
    area_type: parsed?.project_info?.area_type ?? "Planda görünmüyor.",
    detected_floor:
      typeof parsed?.project_info?.detected_floor === "number"
        ? parsed.project_info.detected_floor
        : null,
    building_category: parsed?.project_info?.building_category ?? "Planda görünmüyor.",
    estimated_area_sqm:
      typeof parsed?.project_info?.estimated_area_sqm === "number"
        ? parsed.project_info.estimated_area_sqm
        : null,
    usage_type: parsed?.project_info?.usage_type ?? "Planda görünmüyor.",
    construction_year:
      typeof parsed?.project_info?.construction_year === "number"
        ? parsed.project_info.construction_year
        : null,
    occupancy_count:
      typeof parsed?.project_info?.occupancy_count === "number"
        ? parsed.project_info.occupancy_count
        : null,
  };

  const equipmentInventory: Equipment[] = Array.isArray(parsed?.equipment_inventory)
    ? parsed.equipment_inventory.map((eq: any) => ({
        type: eq?.type ?? "extinguisher",
        count: typeof eq?.count === "number" ? eq.count : 0,
        locations:
          Array.isArray(eq?.locations) && eq.locations.length > 0
            ? eq.locations
            : ["Planda görünmüyor."],
        adequacy_status:
          eq?.adequacy_status === "insufficient" || eq?.adequacy_status === "excessive"
            ? eq.adequacy_status
            : eq?.adequacy_status === "sufficient"
            ? "sufficient"
            : "unknown",
        recommended_count:
          typeof eq?.recommended_count === "number" ? eq.recommended_count : null,
        notes: eq?.notes ?? "Planda görünmüyor.",
      }))
    : [];

  const safetyViolations: Violation[] = Array.isArray(parsed?.safety_violations)
    ? parsed.safety_violations.map((v: any) => ({
        issue: v?.issue ?? "Planda görünmüyor.",
        regulation_reference: v?.regulation_reference ?? "Planda görünmüyor.",
        severity: v?.severity === "critical" || v?.severity === "warning" ? v.severity : "info",
        recommended_action: v?.recommended_action ?? "Planda görünmüyor.",
        estimated_cost: typeof v?.estimated_cost === "number" ? v.estimated_cost : undefined,
        priority_level: typeof v?.priority_level === "number" ? v.priority_level : undefined,
      }))
    : [];

  const expertSuggestions: string[] = Array.isArray(parsed?.expert_suggestions)
    ? parsed.expert_suggestions
    : ["Planda görünmüyor."];

  const complianceScore =
    typeof parsed?.compliance_score === "number" ? parsed.compliance_score : null;

  const result: BlueprintAnalysisResult = {
    project_info: safeProjectInfo,
    equipment_inventory: equipmentInventory,
    safety_violations: safetyViolations,
    expert_suggestions: expertSuggestions,
    compliance_score: complianceScore,
  };

  if (parsed?.risk_assessment) result.risk_assessment = parsed.risk_assessment;
  if (parsed?.improvement_roadmap) result.improvement_roadmap = parsed.improvement_roadmap;
  if (parsed?.analysis_report) result.analysis_report = parsed.analysis_report;

  return result;
}

function safeFallback(): BlueprintAnalysisResult {
  return {
    project_info: {
      area_type: "Planda görünmüyor.",
      detected_floor: null,
      building_category: "Planda görünmüyor.",
      estimated_area_sqm: null,
      usage_type: "Planda görünmüyor.",
      occupancy_count: null,
      construction_year: null,
    },
    equipment_inventory: [],
    safety_violations: [
      {
        issue: "Uygunluk hesabı yapılamıyor çünkü gerekli bilgiler planda görünmüyor.",
        regulation_reference: "Planda görünmüyor.",
        severity: "info",
        recommended_action: "Daha net ve detaylı plan yükleyin.",
      },
    ],
    expert_suggestions: ["Planda görünmüyor."],
    compliance_score: null,
    analysis_report: {
      plan_bilgileri: {
        kat_bilgisi: "Planda görünmüyor.",
        acil_durum_telefonu: "Planda görünmüyor.",
        plan_basligi: "Planda görünmüyor.",
        lejant: "Planda görünmüyor.",
        gorunen_oda_isimleri: ["Planda görünmüyor."],
      },
      oda_ve_alan_listesi: [],
      guvenlik_ekipmanlari_tespiti: [],
      tahliye_yollari_analizi: {
        ana_tahliye_yonleri: "Planda görünmüyor.",
        cikis_kapilari: "Planda görünmüyor.",
        yangin_merdivenleri: "Planda görünmüyor.",
        yonlendirme_oklari: "Planda görünmüyor.",
      },
      yonetmelik_uygunluk_kontrolu: {
        durum: "Uygunluk hesabı yapılamıyor çünkü gerekli bilgiler planda görünmüyor.",
      },
      iyilestirme_onerileri: ["Planda görünmüyor."],
      guven_seviyesi: "Düşük",
    },
  };
}

const SYSTEM_PROMPT = `Sen bir bina yangın güvenliği ve tahliye planı analiz uzmanısın.

Görevin: Verilen yangın tahliye planı / acil durum krokisi görselini analiz etmek ve yalnızca görselde açıkça bulunan bilgileri raporlamaktır.

KESİN KURALLAR:
1) Görselde yazmayan veya açıkça görünmeyen hiçbir bilgiyi tahmin etme.
2) Bina alanını, kat alanını veya ölçüleri tahmin etme.
3) Görselde belirtilmeyen ekipmanları varmış gibi kabul etme.
4) Bir bilgi yoksa tam olarak şu ifadeyi yaz: "Planda görünmüyor."
5) Sadece sembol veya yazı olarak açıkça görülen ekipmanları say.
6) Plan bir kata aitse tüm bina için genelleme yapma.
7) Yönetmelik hesapları için gerekli veriler yoksa hesap yapma ve şu ifadeyi yaz:
"Uygunluk hesabı yapılamıyor çünkü gerekli bilgiler planda görünmüyor."
8) Bir ekipman görselde bulunmuyorsa bunun mevcut olmadığı sonucunu çıkarma.
Bu durumda "Bu plandan doğrulanamaz." yaz.
ÇIKTIYI SADECE GEÇERLİ JSON VER.

JSON ŞEMASI (zorunlu):
{
  "project_info": {
    "area_type": "string",
    "detected_floor": null,
    "building_category": "string",
    "estimated_area_sqm": null,
    "usage_type": "string",
    "occupancy_count": null
  },
  "equipment_inventory": [
    {
      "type": "extinguisher|exit|hydrant|first_aid|assembly_point|alarm|emergency_light|fire_hose|smoke_detector",
      "count": 0,
      "locations": ["string"],
      "adequacy_status": "sufficient|insufficient|excessive|unknown",
      "recommended_count": null,
      "notes": "string"
    }
  ],
  "safety_violations": [
    {
      "issue": "string",
      "regulation_reference": "string",
      "severity": "critical|warning|info",
      "recommended_action": "string"
    }
  ],
  "expert_suggestions": ["string"],
  "compliance_score": null,
  "analysis_report": {
    "plan_bilgileri": {
      "kat_bilgisi": "string",
      "acil_durum_telefonu": "string",
      "plan_basligi": "string",
      "lejant": "string",
      "gorunen_oda_isimleri": ["string"]
    },
    "oda_ve_alan_listesi": [
      {
        "oda_adi": "string",
        "baglantili_alanlar": ["string"],
        "tahliye_yon_oklari": "string"
      }
    ],
    "guvenlik_ekipmanlari_tespiti": [
      {
        "ekipman_turu": "string",
        "konum": "string",
        "adet": 0
      }
    ],
    "tahliye_yollari_analizi": {
      "ana_tahliye_yonleri": "string",
      "cikis_kapilari": "string",
      "yangin_merdivenleri": "string",
      "yonlendirme_oklari": "string",
      "odalarin_cikisa_yonlendirilmesi": "string"
    },
    "yonetmelik_uygunluk_kontrolu": {
      "durum": "string"
    },
    "iyilestirme_onerileri": ["string"],
    "guven_seviyesi": "Yüksek|Orta|Düşük"
  }
}

ÇOK ÖNEMLİ:
- Eksik metinsel bilgi için "Planda görünmüyor." yaz.
- Eksik sayısal/hesap gerektiren bilgi için null kullan.
- Uydurma veri üretme.
- Markdown yazma.
- Sadece JSON döndür.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { image, project_name, user_notes } = body;

    if (!image) {
      return new Response(JSON.stringify({ error: "Kroki görseli zorunludur" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageSizeKB = (image.length * 0.75) / 1024;
    if (imageSizeKB > 3072) {
      return new Response(
        JSON.stringify({
          error: `Görsel çok büyük (${(imageSizeKB / 1024).toFixed(2)} MB). Maksimum 3MB olmalı.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GOOGLE_MODEL = Deno.env.get("GOOGLE_MODEL") || "gemini-2.0-flash-exp";

    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY yapılandırması eksik");
    }

    const base64Match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error("Geçersiz görsel formatı. Base64 encoded image gerekli.");
    }

    const mimeType = base64Match[1];
    const base64Data = base64Match[2];

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            {
              text: `${project_name ? `Proje: ${project_name}\n` : ""}${
                user_notes ? `Kullanıcı notu: ${user_notes}\n` : ""
              }\nLütfen görseli analiz et.`,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        topP: 0.95,
        topK: 40,
        responseMimeType: "application/json",
      },
    };

    const apiStart = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );
    const apiDuration = Date.now() - apiStart;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText.substring(0, 300)}`);
    }

    const data = await response.json();
    const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsedResult: BlueprintAnalysisResult;
    try {
      parsedResult = normalizeResult(parseAIResponse(contentText));
    } catch {
      parsedResult = safeFallback();
    }

    const totalDuration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        analysis: parsedResult,
        metadata: {
          request_id: requestId,
          image_size_kb: Math.round(imageSizeKB),
          api_duration_ms: apiDuration,
          total_duration_ms: totalDuration,
          model: GOOGLE_MODEL,
          processed_at: new Date().toISOString(),
          project_name: project_name || null,
          user_notes: user_notes || null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        error: error?.message || "Kroki analizi sırasında beklenmeyen bir hata oluştu",
        request_id: requestId,
        duration_ms: errorDuration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
