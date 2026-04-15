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
    throw new Error("JSON icerigi bulunamadi");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function normalizeResult(parsed: any): BlueprintAnalysisResult {
  const safeProjectInfo: ProjectInfo = {
    area_type: parsed?.project_info?.area_type ?? "Planda görünmüyor.",
    detected_floor:
      typeof parsed?.project_info?.detected_floor === "number" ? parsed.project_info.detected_floor : null,
    building_category: parsed?.project_info?.building_category ?? "Planda görünmüyor.",
    estimated_area_sqm:
      typeof parsed?.project_info?.estimated_area_sqm === "number"
        ? parsed.project_info.estimated_area_sqm
        : null,
    usage_type: parsed?.project_info?.usage_type ?? "Planda görünmüyor.",
    construction_year:
      typeof parsed?.project_info?.construction_year === "number" ? parsed.project_info.construction_year : null,
    occupancy_count:
      typeof parsed?.project_info?.occupancy_count === "number" ? parsed.project_info.occupancy_count : null,
  };

  const equipmentInventory: Equipment[] = Array.isArray(parsed?.equipment_inventory)
    ? parsed.equipment_inventory.map((eq: any) => ({
        type: eq?.type ?? "extinguisher",
        count: typeof eq?.count === "number" ? eq.count : 0,
        locations:
          Array.isArray(eq?.locations) && eq.locations.length > 0 ? eq.locations : ["Planda görünmüyor."],
        adequacy_status:
          eq?.adequacy_status === "insufficient" || eq?.adequacy_status === "excessive"
            ? eq.adequacy_status
            : eq?.adequacy_status === "sufficient"
            ? "sufficient"
            : "unknown",
        recommended_count: typeof eq?.recommended_count === "number" ? eq.recommended_count : null,
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
        issue: "Uygunluk hesabi yapilamiyor cunku gerekli bilgiler planda görünmüyor.",
        regulation_reference: "Planda görünmüyor.",
        severity: "info",
        recommended_action: "Daha net ve detayli plan yukleyin.",
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
        durum: "Uygunluk hesabi yapilamiyor cunku gerekli bilgiler planda görünmüyor.",
      },
      iyilestirme_onerileri: ["Planda görünmüyor."],
      guven_seviyesi: "Düşük",
    },
  };
}

const SYSTEM_PROMPT = `Sen bir bina yangin guvenligi ve tahliye plani analiz uzmansin.

Gorevin: Verilen yangin tahliye plani veya acil durum krokisi gorselini analiz etmek ve yalnizca gorselde acikca bulunan bilgileri raporlamaktir.

Kesin kurallar:
1) Gorselde yazmayan veya acikca gorunmeyen hicbir bilgiyi tahmin etme.
2) Bina alani, kat alani veya olculeri tahmin etme.
3) Gorselde belirtilmeyen ekipmanlari varmis gibi kabul etme.
4) Bir bilgi yoksa tam olarak su ifadeyi yaz: "Planda görünmüyor."
5) Sadece sembol veya yazi olarak acikca gorulen ekipmanlari say.
6) Plan bir kata aitse tum bina icin genelleme yapma.
7) Yonetmelik hesaplari icin gerekli veriler yoksa hesap yapma ve "Uygunluk hesabi yapilamiyor cunku gerekli bilgiler planda görünmüyor." yaz.
8) Bir ekipman gorselde bulunmuyorsa bunun mevcut olmadigi sonucunu cikarma. Bu durumda "Bu plandan dogrulanamaz." yaz.
9) Cikti olarak sadece gecerli JSON ver.
`;

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
              }\nLutfen gorseli analiz et ve sadece JSON dondur.`,
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
