import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  callGeminiWithRetryAndFallback,
  extractTextFromGeminiResponse,
  getGoogleLiteModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ADEPModule =
  | "scenario"
  | "preventive"
  | "equipment"
  | "drill"
  | "checklist"
  | "raci"
  | "legal"
  | "risk";

interface ADEPRequestBody {
  planId: string;
  module: ADEPModule;
}

interface PlanContext {
  company_name: string;
  sector: string;
  hazard_class: string;
  employee_count: number;
}

function extractJSON(content: string): unknown[] {
  let cleaned = content.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

  cleaned = cleaned.replace(/`/g, "");

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    throw new Error("No valid JSON array found in response");
  }

  cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("Response is not a JSON array");
  }
  return parsed;
}

function generatePrompt(module: ADEPModule, context: PlanContext): string {
  const baseContext = `Sirket: ${context.company_name}
Sektor: ${context.sector}
Tehlike Sinifi: ${context.hazard_class}
Calisan Sayisi: ${context.employee_count}

Sen bir Is Guvenligi UZmani olarak Turkiye'deki 6331 sayili ISG Kanunu ve ilgili yonetmeliklere gore calisiyorsun.`;

  const prompts: Record<ADEPModule, string> = {
    scenario: `${baseContext}

Bu isyeri icin acil durum senaryolari ve mudahale adimlari olustur.

SADECE JSON array dondur:
[
  {
    "hazard_type": "string",
    "action_steps": "string (her adim yeni satirda, numara ile baslayan)"
  }
]

5-7 senaryo uret (yangin, deprem, is kazasi, sabotaj, sel vb.)`,

    preventive: `${baseContext}

Onleyici ve sinirlandirici tedbir matrisi olustur.

SADECE JSON array dondur:
[
  {
    "risk_type": "string",
    "preventive_action": "string",
    "responsible_role": "string",
    "control_period": "string (Gunluk/Haftalik/Aylik/Yillik)",
    "status": "pending"
  }
]

10-15 tedbir uret.`,

    equipment: `${baseContext}

Acil durum ekipman envanteri olustur.

SADECE JSON array dondur:
[
  {
    "equipment_name": "string",
    "equipment_type": "string (Yangin/Ilk Yardim/Tahliye/Koruma)",
    "quantity": number,
    "location": "string",
    "last_inspection_date": null,
    "next_inspection_date": "YYYY-MM-DD",
    "status": "active",
    "responsible_person": "string"
  }
]

15-20 ekipman uret.`,

    drill: `${baseContext}

Tatbikat plani olustur (gecmis ve gelecek tatbikatlar).

SADECE JSON array dondur:
[
  {
    "drill_type": "string (Yangin/Deprem/Tahliye)",
    "drill_date": "YYYY-MM-DD",
    "participants_count": number,
    "duration_minutes": number,
    "scenario_tested": "string",
    "success_rate": "string",
    "observations": "string",
    "action_items": "string",
    "next_drill_date": "YYYY-MM-DD"
  }
]

6-8 tatbikat kaydi uret.`,

    checklist: `${baseContext}

Periyodik kontrol checklist'i olustur.

SADECE JSON array dondur:
[
  {
    "checklist_category": "string (Yangin/Ilk Yardim/Ekipman/Tahliye)",
    "checklist_item": "string",
    "check_frequency": "string (Gunluk/Haftalik/Aylik)",
    "responsible_role": "string",
    "last_checked_date": null,
    "next_check_date": "YYYY-MM-DD",
    "status": "pending",
    "notes": null
  }
]

20-25 kontrol maddesi uret.`,

    raci: `${baseContext}

RACI sorumluluk matrisi olustur.

SADECE JSON array dondur:
[
  {
    "task_name": "string",
    "responsible": "string",
    "accountable": "string",
    "consulted": "string",
    "informed": "string",
    "task_category": "string (Planlama/Tatbikat/Kontrol/Egitim)",
    "priority": "medium"
  }
]

12-15 gorev uret.`,

    legal: `${baseContext}

Ilgili mevzuat referanslari olustur.

SADECE JSON array dondur:
[
  {
    "law_name": "string",
    "article_number": "string",
    "requirement_summary": "string",
    "compliance_status": "compliant",
    "responsible_person": "ISG UZmani",
    "review_date": "YYYY-MM-DD"
  }
]

10-12 mevzuat maddesi uret.`,

    risk: `${baseContext}

Risk kaynaklari haritasi olustur.

SADECE JSON array dondur:
[
  {
    "risk_source": "string",
    "location": "string",
    "risk_level": "medium",
    "potential_impact": "string",
    "mitigation_measures": "string",
    "monitoring_frequency": "string (Gunluk/Haftalik/Aylik)",
    "last_assessment_date": "YYYY-MM-DD"
  }
]

15-20 risk kaynagi uret.`,
  };

  return prompts[module];
}

function getTableName(module: ADEPModule) {
  const mapping: Record<ADEPModule, string> = {
    scenario: "adep_scenarios",
    preventive: "adep_preventive_measures",
    equipment: "adep_equipment_inventory",
    drill: "adep_drills",
    checklist: "adep_checklists",
    raci: "adep_raci_matrix",
    legal: "adep_legal_references",
    risk: "adep_risk_sources",
  };
  return mapping[module];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = (await req.json()) as ADEPRequestBody;
    const { planId, module } = body;

    if (!planId || !module) {
      throw new Error("Missing required fields: planId or module");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: plan, error: planError } = await supabase
      .from("adep_plans")
      .select("company_name, sector, hazard_class, employee_count")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const context: PlanContext = {
      company_name: plan.company_name,
      sector: plan.sector || "Genel",
      hazard_class: plan.hazard_class,
      employee_count: plan.employee_count,
    };

    const googleModel = getGoogleLiteModel();
    const { payload, model } = await callGeminiWithRetryAndFallback({
      apiKey: getRequiredGoogleApiKey(),
      model: googleModel,
      modelPreference: "lite",
      requestLabel: `generate-adep-analysis:${module}`,
      body: {
        contents: [{ parts: [{ text: generatePrompt(module, context) }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          topP: 0.8,
          topK: 40,
        },
      },
    });

    const parsedArray = extractJSON(extractTextFromGeminiResponse(payload));
    const tableName = getTableName(module);
    const recordsToInsert = parsedArray.map((item) => ({
      ...(item as Record<string, unknown>),
      plan_id: planId,
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from(tableName)
      .insert(recordsToInsert)
      .select();

    if (insertError) {
      throw new Error(`Failed to insert records: ${insertError.message}`);
    }

    const insertedCount = insertedData?.length || 0;
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        insertedCount,
        module,
        metadata: {
          model,
          processingTimeMs: duration,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        success: false,
        insertedCount: 0,
        module: "unknown",
        error: errorMessage,
        metadata: {
          processingTimeMs: duration,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
