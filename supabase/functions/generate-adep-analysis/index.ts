// supabase/functions/generate-adep-analysis/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ADEPModule = "scenario" | "preventive" | "equipment" | "drill" | "checklist" | "raci" | "legal" | "risk";

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

/**
 * 🛡️ Extract JSON with robust parsing
 */
function extractJSON(content: string): unknown[] {
  console.log("🔍 Starting JSON extraction...");

  let cleaned = content.trim();

  // Remove markdown code blocks
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  cleaned = cleaned.replace(/`/g, "");

  // Find array boundaries
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    throw new Error("No valid JSON array found in response");
  }

  cleaned = cleaned.substring(firstBracket, lastBracket + 1);

  // Fix common issues
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not a JSON array");
    }
    console.log(`✅ Successfully parsed array with ${parsed.length} items`);
    return parsed;
  } catch (error) {
    console.error("❌ JSON parse failed:", error);
    throw new Error("Failed to parse JSON response");
  }
}

/**
 * 🎯 Generate module-specific prompt
 */
function generatePrompt(module: ADEPModule, context: PlanContext): string {
  const baseContext = `Şirket: ${context.company_name}
Sektör: ${context.sector}
Tehlike Sınıfı: ${context.hazard_class}
Çalışan Sayısı: ${context.employee_count}

Sen bir İş Güvenliği Uzmanısın. Türkiye'deki 6331 sayılı İSG Kanunu ve ilgili yönetmeliklere göre çalışıyorsun.`;

  const prompts: Record<ADEPModule, string> = {
    scenario: `${baseContext}

Bu işyeri için acil durum senaryoları ve müdahale adımları oluştur.

SADECE JSON array döndür:
[
  {
    "hazard_type": "string",
    "action_steps": "string (her adım yeni satırda, numara ile başlayan)"
  }
]

5-7 senaryo üret (YANGIN, DEPREM, İŞ KAZASI, SABOTAJ, SEL, vb.)`,

    preventive: `${baseContext}

Önleyici ve Sınırlandırıcı Tedbir Matrisi oluştur.

SADECE JSON array döndür:
[
  {
    "risk_type": "string",
    "preventive_action": "string",
    "responsible_role": "string",
    "control_period": "string (Günlük/Haftalık/Aylık/Yıllık)",
    "status": "pending"
  }
]

10-15 tedbir üret.`,

    equipment: `${baseContext}

Acil durum ekipman envanteri oluştur.

SADECE JSON array döndür:
[
  {
    "equipment_name": "string",
    "equipment_type": "string (Yangın/İlk Yardım/Tahliye/Koruma)",
    "quantity": number,
    "location": "string",
    "last_inspection_date": null,
    "next_inspection_date": "YYYY-MM-DD",
    "status": "active",
    "responsible_person": "string"
  }
]

15-20 ekipman üret.`,

    drill: `${baseContext}

Tatbikat planı oluştur (geçmiş ve gelecek tatbikatlar).

SADECE JSON array döndür:
[
  {
    "drill_type": "string (Yangın/Deprem/Tahliye)",
    "drill_date": "YYYY-MM-DD",
    "participants_count": number,
    "duration_minutes": number,
    "scenario_tested": "string",
    "success_rate": "string (%85, İyi, vb.)",
    "observations": "string",
    "action_items": "string",
    "next_drill_date": "YYYY-MM-DD"
  }
]

6-8 tatbikat kaydı üret (2'si geçmiş, 4'ü gelecek).`,

    checklist: `${baseContext}

Periyodik kontrol checklist'i oluştur.

SADECE JSON array döndür:
[
  {
    "checklist_category": "string (Yangın/İlk Yardım/Ekipman/Tahliye)",
    "checklist_item": "string",
    "check_frequency": "string (Günlük/Haftalık/Aylık)",
    "responsible_role": "string",
    "last_checked_date": null,
    "next_check_date": "YYYY-MM-DD",
    "status": "pending",
    "notes": null
  }
]

20-25 kontrol maddesi üret.`,

    raci: `${baseContext}

RACI Sorumluluk Matrisi oluştur.

RACI tanımları:
- Responsible (R): İşi yapan
- Accountable (A): Hesap veren (karar verici)
- Consulted (C): Danışılan
- Informed (I): Bilgilendirilen

SADECE JSON array döndür:
[
  {
    "task_name": "string",
    "responsible": "string",
    "accountable": "string",
    "consulted": "string",
    "informed": "string",
    "task_category": "string (Planlama/Tatbikat/Kontrol/Eğitim)",
    "priority": "medium"
  }
]

12-15 görev üret.`,

    legal: `${baseContext}

İlgili mevzuat referansları oluştur.

SADECE JSON array döndür:
[
  {
    "law_name": "string",
    "article_number": "string",
    "requirement_summary": "string",
    "compliance_status": "compliant",
    "responsible_person": "İSG Uzmanı",
    "review_date": "YYYY-MM-DD"
  }
]

10-12 mevzuat maddesi üret (6331 sayılı Kanun, Acil Durumlar Yönetmeliği, vb.)`,

    risk: `${baseContext}

Risk kaynakları haritası oluştur.

SADECE JSON array döndür:
[
  {
    "risk_source": "string",
    "location": "string",
    "risk_level": "medium",
    "potential_impact": "string",
    "mitigation_measures": "string",
    "monitoring_frequency": "string (Günlük/Haftalık/Aylık)",
    "last_assessment_date": "YYYY-MM-DD"
  }
]

15-20 risk kaynağı üret.`,
  };

  return prompts[module];
}

/**
 * 🗄️ Get table name from module
 */
function getTableName(module: ADEPModule): string {
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

/**
 * 🚀 Main Handler
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("🚀 ADEP AI Generator started at:", new Date().toISOString());

  try {
    const body = (await req.json()) as ADEPRequestBody;
    const { planId, module } = body;

    if (!planId || !module) {
      throw new Error("Missing required fields: planId or module");
    }

    console.log(`📋 Request: planId=${planId}, module=${module}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch plan context
    const { data: plan, error: planError } = await supabase
      .from("adep_plans")
      .select("company_name, sector, hazard_class, employee_count")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      throw new Error("Plan not found: " + planId);
    }

    const context: PlanContext = {
      company_name: plan.company_name,
      sector: plan.sector || "Genel",
      hazard_class: plan.hazard_class,
      employee_count: plan.employee_count,
    };

    console.log("✅ Plan context fetched:", context);

    // 2. Generate prompt
    const prompt = generatePrompt(module, context);
    console.log("📝 Prompt generated");

    // 3. Call Gemini API
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    const googleModel = Deno.env.get("GOOGLE_MODEL") || "gemini-1.5-flash";

    if (!googleApiKey) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    console.log(`🤖 Using model: ${googleModel}`);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            topP: 0.8,
            topK: 40,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("❌ Gemini API error:", errorText);
      throw new Error("Gemini API failed");
    }

    const geminiData = await geminiResponse.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      throw new Error("No content in Gemini response");
    }

    console.log("✅ Gemini response received");

    // 4. Parse JSON
    const parsedArray = extractJSON(rawContent);

    // 5. Insert to database
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
      console.error("❌ Insert error:", insertError);
      throw new Error("Failed to insert records: " + insertError.message);
    }

    const insertedCount = insertedData?.length || 0;
    const duration = Date.now() - startTime;

    console.log(`✅ Success: ${insertedCount} records inserted in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        insertedCount,
        module,
        metadata: {
          model: googleModel,
          processingTimeMs: duration,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("❌ Request failed:", errorMessage);

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
        status: 200, // ✅ Return 200 to prevent client-side errors
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

console.log("🟢 ADEP AI Generator Edge Function loaded");