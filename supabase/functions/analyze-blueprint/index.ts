import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  callGeminiWithRetryAndFallback,
  extractTextFromGeminiResponse,
  getGoogleRobustModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

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
  analysis_status: "risks_found" | "no_risk_detected" | "needs_review";
  executive_summary: string;
  no_risk_explanation?: string;
  limitations: string[];
  next_actions: string[];
  project_info: ProjectInfo;
  equipment_inventory: Equipment[];
  safety_violations: Violation[];
  expert_suggestions: string[];
  compliance_score: number | null;
  risk_assessment?: RiskAssessment;
  improvement_roadmap?: ImprovementRoadmap;
  analysis_report?: Record<string, unknown>;
}

const NOT_VISIBLE = "Planda gorunmuyor.";
const NEEDS_DATA = "Uygunluk hesabi yapilamiyor cunku gerekli bilgiler planda gorunmuyor.";

function toText(value: unknown, fallback = NOT_VISIBLE) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function toStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => toText(item, "")).filter(Boolean);
  return items.length ? items : fallback;
}

function parseAIResponse(contentText: string): unknown {
  let cleaned = (contentText || "").trim();
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("JSON icerigi bulunamadi");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function normalizeResult(raw: unknown): BlueprintAnalysisResult {
  const parsed = raw as Record<string, any>;

  const safetyViolations: Violation[] = Array.isArray(parsed?.safety_violations)
    ? parsed.safety_violations.map((item: any) => ({
        issue: toText(item?.issue),
        regulation_reference: toText(item?.regulation_reference),
        severity: item?.severity === "critical" || item?.severity === "warning" ? item.severity : "info",
        recommended_action: toText(item?.recommended_action),
        estimated_cost: typeof item?.estimated_cost === "number" ? item.estimated_cost : undefined,
        priority_level: typeof item?.priority_level === "number" ? item.priority_level : undefined,
      }))
    : [];

  const actionableRiskCount = safetyViolations.filter((item) => item.severity !== "info").length;
  const analysisStatus =
    parsed?.analysis_status === "risks_found" ||
    parsed?.analysis_status === "no_risk_detected" ||
    parsed?.analysis_status === "needs_review"
      ? parsed.analysis_status
      : actionableRiskCount > 0
      ? "risks_found"
      : "no_risk_detected";

  const projectInfo: ProjectInfo = {
    area_type: toText(parsed?.project_info?.area_type),
    detected_floor:
      typeof parsed?.project_info?.detected_floor === "number" ? parsed.project_info.detected_floor : null,
    building_category: toText(parsed?.project_info?.building_category),
    estimated_area_sqm:
      typeof parsed?.project_info?.estimated_area_sqm === "number" ? parsed.project_info.estimated_area_sqm : null,
    usage_type: toText(parsed?.project_info?.usage_type),
    construction_year:
      typeof parsed?.project_info?.construction_year === "number" ? parsed.project_info.construction_year : null,
    occupancy_count:
      typeof parsed?.project_info?.occupancy_count === "number" ? parsed.project_info.occupancy_count : null,
  };

  const equipmentInventory: Equipment[] = Array.isArray(parsed?.equipment_inventory)
    ? parsed.equipment_inventory.map((item: any) => ({
        type: [
          "extinguisher",
          "exit",
          "hydrant",
          "first_aid",
          "assembly_point",
          "alarm",
          "emergency_light",
          "fire_hose",
          "smoke_detector",
        ].includes(item?.type)
          ? item.type
          : "extinguisher",
        count: typeof item?.count === "number" ? item.count : 0,
        locations: toStringArray(item?.locations, [NOT_VISIBLE]),
        adequacy_status:
          item?.adequacy_status === "sufficient" ||
          item?.adequacy_status === "insufficient" ||
          item?.adequacy_status === "excessive"
            ? item.adequacy_status
            : "unknown",
        recommended_count: typeof item?.recommended_count === "number" ? item.recommended_count : null,
        notes: toText(item?.notes),
      }))
    : [];

  const defaultSummary =
    analysisStatus === "risks_found"
      ? "AI kroki uzerinde aksiyon gerektiren risk bulgulari tespit etti."
      : analysisStatus === "no_risk_detected"
      ? "AI kroki uzerinde acikca risk olusturan bir bulgu tespit etmedi."
      : "Kroki netligi veya icerigi nedeniyle AI analizi kesinlestirilemedi.";

  const defaultNextActions =
    analysisStatus === "risks_found"
      ? ["Tespit edilen bulgulari sahada dogrulayin.", "Aksiyonlari ADEP surecine aktarip sorumlu ve termin belirleyin."]
      : ["Saha kontrol listesi ile manuel dogrulama yapin.", "Yeni revizyon veya daha net kroki varsa tekrar analiz edin."];

  const result: BlueprintAnalysisResult = {
    analysis_status: analysisStatus,
    executive_summary: toText(parsed?.executive_summary, defaultSummary),
    no_risk_explanation:
      typeof parsed?.no_risk_explanation === "string" ? parsed.no_risk_explanation.trim() : undefined,
    limitations: toStringArray(parsed?.limitations, [
      "AI analizi yalnizca yuklenen gorselde acikca gorunen bilgiye dayanir.",
    ]),
    next_actions: toStringArray(parsed?.next_actions, defaultNextActions),
    project_info: projectInfo,
    equipment_inventory: equipmentInventory,
    safety_violations: safetyViolations,
    expert_suggestions: toStringArray(
      parsed?.expert_suggestions,
      analysisStatus === "no_risk_detected"
        ? ["Gorselde acik risk bulgusu yoksa bile tahliye rotalari, ekipman konumlari ve isaretlemeler sahada kontrol edilmelidir."]
        : ["Planda gorunmuyor."],
    ),
    compliance_score: typeof parsed?.compliance_score === "number" ? parsed.compliance_score : null,
  };

  if (parsed?.risk_assessment) result.risk_assessment = parsed.risk_assessment;
  if (parsed?.improvement_roadmap) result.improvement_roadmap = parsed.improvement_roadmap;
  if (parsed?.analysis_report && typeof parsed.analysis_report === "object") result.analysis_report = parsed.analysis_report;

  return result;
}

function safeFallback(): BlueprintAnalysisResult {
  return {
    analysis_status: "needs_review",
    executive_summary: "Kroki netligi veya AI yaniti nedeniyle analiz kesinlestirilemedi.",
    no_risk_explanation: "",
    limitations: ["Gorselden guvenilir yapi veya ekipman bilgisi cikarilamadi."],
    next_actions: ["Daha net ve yuksek cozumlu kroki yukleyin.", "Lejant, cikis ve ekipman sembollerini kontrol edin."],
    project_info: {
      area_type: NOT_VISIBLE,
      detected_floor: null,
      building_category: NOT_VISIBLE,
      estimated_area_sqm: null,
      usage_type: NOT_VISIBLE,
      occupancy_count: null,
      construction_year: null,
    },
    equipment_inventory: [],
    safety_violations: [
      {
        issue: NEEDS_DATA,
        regulation_reference: NOT_VISIBLE,
        severity: "info",
        recommended_action: "Daha net ve detayli plan yukleyin.",
      },
    ],
    expert_suggestions: [NOT_VISIBLE],
    compliance_score: null,
    analysis_report: {
      plan_bilgileri: {
        kat_bilgisi: NOT_VISIBLE,
        acil_durum_telefonu: NOT_VISIBLE,
        plan_basligi: NOT_VISIBLE,
        lejant: NOT_VISIBLE,
        gorunen_oda_isimleri: [NOT_VISIBLE],
      },
      oda_ve_alan_listesi: [],
      guvenlik_ekipmanlari_tespiti: [],
      tahliye_yollari_analizi: {
        ana_tahliye_yonleri: NOT_VISIBLE,
        cikis_kapilari: NOT_VISIBLE,
        yangin_merdivenleri: NOT_VISIBLE,
        yonlendirme_oklari: NOT_VISIBLE,
      },
      yonetmelik_uygunluk_kontrolu: {
        durum: NEEDS_DATA,
      },
      iyilestirme_onerileri: [NOT_VISIBLE],
      guven_seviyesi: "Dusuk",
    },
  };
}

const SYSTEM_PROMPT = `Sen bir bina yangin guvenligi ve tahliye plani analiz uzmansin.

Gorevin: Verilen yangin tahliye plani veya acil durum krokisi gorselini analiz etmek ve yalnizca gorselde acikca bulunan bilgileri raporlamaktir.

Kesin kurallar:
1) Gorselde yazmayan veya acikca gorunmeyen hicbir bilgiyi tahmin etme.
2) Bina alani, kat alani veya olculeri tahmin etme.
3) Gorselde belirtilmeyen ekipmanlari varmis gibi kabul etme.
4) Bir bilgi yoksa tam olarak su ifadeyi yaz: "Planda gorunmuyor."
5) Sadece sembol veya yazi olarak acikca gorulen ekipmanlari say.
6) Plan bir kata aitse tum bina icin genelleme yapma.
7) Yonetmelik hesaplari icin gerekli veriler yoksa hesap yapma ve "Uygunluk hesabi yapilamiyor cunku gerekli bilgiler planda gorunmuyor." yaz.
8) Bir ekipman gorselde bulunmuyorsa bunun mevcut olmadigi sonucunu cikarma. Bu durumda "Bu plandan dogrulanamaz." yaz.
9) Cikti olarak sadece gecerli JSON ver.
10) Risk tespit edersen nedenini, olasi sonucunu ve uygulanabilir aksiyonunu yaz.
11) Acik risk tespit edemezsen bu durumu "kesin guvenli" diye yorumlama; yalnizca gorselde acik risk bulunmadigini belirt.

JSON semasi:
{
  "analysis_status": "risks_found | no_risk_detected | needs_review",
  "executive_summary": "Kisa ve net sonuc. Risk varsa detayli ozetle.",
  "no_risk_explanation": "Risk tespit edilmediyse, bunun sadece gorselde acik bulgu olmadigi anlamina geldigini acikla.",
  "project_info": {
    "area_type": "string",
    "detected_floor": number | null,
    "building_category": "string",
    "estimated_area_sqm": number | null,
    "usage_type": "string",
    "construction_year": number | null,
    "occupancy_count": number | null
  },
  "equipment_inventory": [
    {
      "type": "extinguisher | exit | hydrant | first_aid | assembly_point | alarm | emergency_light | fire_hose | smoke_detector",
      "count": number,
      "locations": ["string"],
      "adequacy_status": "sufficient | insufficient | excessive | unknown",
      "recommended_count": number | null,
      "notes": "string"
    }
  ],
  "safety_violations": [
    {
      "issue": "Somut risk veya eksikligin adi",
      "regulation_reference": "Ilgili mevzuat veya kontrol basligi",
      "severity": "critical | warning | info",
      "recommended_action": "Uygulanabilir aksiyon",
      "estimated_cost": number,
      "priority_level": number
    }
  ],
  "expert_suggestions": ["string"],
  "compliance_score": number | null,
  "risk_assessment": {
    "fire_risk": "low | medium | high",
    "structural_risk": "low | medium | high",
    "evacuation_capacity": number
  },
  "improvement_roadmap": {
    "immediate": ["0-7 gun aksiyonlari"],
    "short_term": ["1-3 ay aksiyonlari"],
    "long_term": ["6-12 ay aksiyonlari"]
  },
  "limitations": ["Analizin sinirlarini yaz"],
  "next_actions": ["Kullanicinin sonraki adimlarini yaz"]
}

analysis_status kurali:
- Aksiyon gerektiren somut bulgu varsa "risks_found".
- Acik risk bulgusu yoksa "no_risk_detected" ve safety_violations bos dizi.
- Gorsel okunamiyorsa veya karar vermek mumkun degilse "needs_review".`;

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
      return new Response(JSON.stringify({ error: "Kroki gorseli zorunludur" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageSizeKB = (image.length * 0.75) / 1024;
    if (imageSizeKB > 3072) {
      return new Response(
        JSON.stringify({
          error: `Gorsel cok buyuk (${(imageSizeKB / 1024).toFixed(2)} MB). Maksimum 3MB olmali.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const base64Match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error("Gecersiz gorsel formati. Base64 encoded image gerekli.");
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
                user_notes ? `Kullanici notu: ${user_notes}\n` : ""
              }\nLutfen gorseli analiz et ve yalnizca semaya uygun JSON dondur.`,
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
    const { payload, model } = await callGeminiWithRetryAndFallback({
      apiKey: getRequiredGoogleApiKey(),
      model: getGoogleRobustModel(),
      modelPreference: "robust",
      requestLabel: "analyze-blueprint",
      body: requestBody,
    });
    const apiDuration = Date.now() - apiStart;

    let parsedResult: BlueprintAnalysisResult;
    try {
      parsedResult = normalizeResult(parseAIResponse(extractTextFromGeminiResponse(payload)));
    } catch (parseError) {
      console.error("analyze-blueprint parse failed", {
        requestId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
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
          model,
          processed_at: new Date().toISOString(),
          project_name: project_name || null,
          user_notes: user_notes || null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;
    console.error("analyze-blueprint failed", {
      requestId,
      durationMs: errorDuration,
      message: error?.message || String(error),
    });

    return new Response(
      JSON.stringify({
        error: error?.message || "Kroki analizi sirasinda beklenmeyen bir hata olustu",
        request_id: requestId,
        duration_ms: errorDuration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
