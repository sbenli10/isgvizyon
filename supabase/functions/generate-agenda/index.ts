//supabase\functions\generate-agenda\index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AgendaItem {
  topic: string;
  description: string;
}

interface RequestBody {
  prompt: string;
  companyName: string;
  industry: string;
}

/**
 * 🛡️ Extract JSON with full response handling
 */
function extractJSON(content: string): any[] {
  console.log("🔍 Starting JSON extraction...");
  console.log("📝 Content length:", content.length);
  console.log("📝 Full content:", content); // ✅ LOG FULL CONTENT

  let cleaned = content.trim();

  // Remove markdown code blocks
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
    console.log("✅ Extracted from markdown block");
  }

  // Remove remaining backticks
  cleaned = cleaned.replace(/`/g, "");

  // Find array boundaries
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    console.error("❌ Invalid JSON array boundaries:", {
      firstBracket,
      lastBracket,
      content: cleaned,
    });
    throw new Error(
      `No valid JSON array found. First bracket: ${firstBracket}, Last bracket: ${lastBracket}`
    );
  }

  cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  console.log("📦 Extracted JSON array (length:", cleaned.length, ")");

  // Fix common issues
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  // Parse attempts
  let parsed: any;

  try {
    parsed = JSON.parse(cleaned);
  } catch (firstError) {
    console.warn("⚠️ First parse failed, trying cleanup...");
    try {
      const aggressive = cleaned
        .replace(/[\n\r\t]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      parsed = JSON.parse(aggressive);
    } catch (secondError) {
      console.error("❌ All parse attempts failed");
      throw new Error(
        `JSON parse failed: ${
          secondError instanceof Error ? secondError.message : "Unknown"
        }`
      );
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Response is not a JSON array");
  }

  console.log(`✅ Successfully parsed array with ${parsed.length} items`);
  return parsed;
}

/**
 * 🛡️ Clean agenda item
 */
function cleanAgendaItem(item: any, index: number): AgendaItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const topic = item.topic || item.title || "";
  const description = item.description || item.details || "";

  if (!topic || !description) {
    return null;
  }

  return {
    topic: String(topic).trim().substring(0, 100),
    description: String(description).trim().substring(0, 200),
  };
}

/**
 * 🛡️ Fallback agenda when AI fails
 */
function getFallbackAgenda(): AgendaItem[] {
  return [
    {
      topic: "Açılış ve Yoklama",
      description: "Kurul üyelerinin katılım kontrolü ve toplantı açılışı",
    },
    {
      topic: "Önceki Kararların Takibi",
      description: "Bir önceki toplantıda alınan kararların uygulama durumu",
    },
    {
      topic: "İş Kazaları ve Ramak Kala Olaylar",
      description: "Son dönemde meydana gelen kazaların incelenmesi",
    },
    {
      topic: "Risk Değerlendirmesi Güncelleme",
      description: "Mevcut risk değerlendirmelerinin gözden geçirilmesi",
    },
    {
      topic: "Acil Durum Planları",
      description: "Acil durum senaryolarının kontrolü ve tatbikat planlaması",
    },
    {
      topic: "KKD Kullanım Kontrolü",
      description: "Kişisel koruyucu donanım kullanımının denetimi",
    },
    {
      topic: "İSG Eğitim Programları",
      description: "Çalışanlara verilecek İSG eğitimlerinin planlanması",
    },
    {
      topic: "Sağlık Gözetimi",
      description: "Periyodik sağlık muayenelerinin takibi",
    },
    {
      topic: "Dilek ve Temenniler",
      description: "Çalışan temsilcilerinin ve kurul üyelerinin önerileri",
    },
    {
      topic: "Kapanış",
      description: "Toplantının sona erdirilmesi ve gelecek toplantı tarihi",
    },
  ];
}

/**
 * 🛡️ Main Handler
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("🚀 Request started at:", new Date().toISOString());

  try {
    const body = (await req.json()) as RequestBody;
    const { prompt, companyName, industry } = body;

    console.log("📋 Request:", { companyName, industry });

    if (!prompt || !companyName || !industry) {
      throw new Error("Missing required fields");
    }

    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    const googleModel = Deno.env.get("GOOGLE_MODEL") || "gemini-1.5-flash";

    if (!googleApiKey) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    console.log(`🤖 Using model: ${googleModel}`);

    // ✅ Gemini API call with increased maxOutputTokens
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
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
      
      // ✅ Return fallback on API error
      console.log("⚠️ Using fallback agenda due to API error");
      return new Response(
        JSON.stringify({
          success: true,
          agenda: getFallbackAgenda(),
          metadata: {
            companyName,
            industry,
            itemCount: 10,
            model: "fallback",
            note: "Varsayılan gündem kullanıldı (API hatası)",
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await geminiResponse.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      console.error("❌ No content in response");
      
      // ✅ Return fallback
      return new Response(
        JSON.stringify({
          success: true,
          agenda: getFallbackAgenda(),
          metadata: {
            companyName,
            industry,
            itemCount: 10,
            model: "fallback",
            note: "Varsayılan gündem kullanıldı (boş yanıt)",
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Gemini response received");
    console.log("📊 Response length:", rawContent.length);

    // Extract and parse
    let agenda: AgendaItem[];
    try {
      const parsedArray = extractJSON(rawContent);
      agenda = parsedArray
        .map((item, index) => cleanAgendaItem(item, index))
        .filter((item): item is AgendaItem => item !== null);

      if (agenda.length === 0) {
        throw new Error("No valid agenda items");
      }

      console.log(`✅ Parsed ${agenda.length} items`);
    } catch (parseError) {
      console.error("❌ Parse failed:", parseError);
      
      // ✅ Return fallback on parse error
      console.log("⚠️ Using fallback agenda due to parse error");
      return new Response(
        JSON.stringify({
          success: true,
          agenda: getFallbackAgenda(),
          metadata: {
            companyName,
            industry,
            itemCount: 10,
            model: "fallback",
            note: "Varsayılan gündem kullanıldı (parse hatası)",
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Success in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        agenda,
        metadata: {
          companyName,
          industry,
          itemCount: agenda.length,
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error("❌ Request failed:", errorMessage);

    // ✅ Always return fallback on error
    return new Response(
      JSON.stringify({
        success: true,
        agenda: getFallbackAgenda(),
        metadata: {
          companyName: "Unknown",
          industry: "Unknown",
          itemCount: 10,
          model: "fallback",
          note: "Varsayılan gündem kullanıldı (hata)",
          error: errorMessage,
        },
      }),
      {
        status: 200, // ✅ Return 200 even on error
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

console.log("🟢 Edge Function loaded");