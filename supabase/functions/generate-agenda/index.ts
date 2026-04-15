import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  callGeminiWithRetryAndFallback,
  extractTextFromGeminiResponse,
  getGoogleLiteModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

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

function extractJSON(content: string): unknown[] {
  let cleaned = content.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  cleaned = cleaned.replace(/`/g, "");

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    throw new Error("No valid JSON array found.");
  }

  cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not a JSON array.");
    }
    return parsed;
  } catch {
    const aggressive = cleaned
      .replace(/[\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");

    const parsed = JSON.parse(aggressive);
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not a JSON array.");
    }
    return parsed;
  }
}

function cleanAgendaItem(item: any): AgendaItem | null {
  if (!item || typeof item !== "object") return null;

  const topic = item.topic || item.title || "";
  const description = item.description || item.details || "";

  if (!topic || !description) return null;

  return {
    topic: String(topic).trim().substring(0, 100),
    description: String(description).trim().substring(0, 200),
  };
}

function getFallbackAgenda(): AgendaItem[] {
  return [
    {
      topic: "Acilis ve Yoklama",
      description: "Kurul uyelerinin katilim kontrolu ve toplanti acilisi",
    },
    {
      topic: "Onceki Kararlarin Takibi",
      description: "Bir onceki toplantida alinan kararlarin uygulama durumu",
    },
    {
      topic: "Is Kazalari ve Ramak Kala Olaylar",
      description: "Son donemde meydana gelen kazalarin incelenmesi",
    },
    {
      topic: "Risk Degerlendirmesi Guncelleme",
      description: "Mevcut risk degerlendirmelerinin gozden gecirilmesi",
    },
    {
      topic: "Acil Durum Planlari",
      description: "Acil durum senaryolarinin kontrolu ve tatbikat planlamasi",
    },
    {
      topic: "KKD Kullanim Kontrolu",
      description: "Kisisel koruyucu donanim kullanimina iliskin denetim basliklari",
    },
    {
      topic: "ISG Egitim Programlari",
      description: "Calisanlara verilecek ISG egitimlerinin planlanmasi",
    },
    {
      topic: "Saglik Gozetimi",
      description: "Periyodik saglik muayenelerinin takibi",
    },
    {
      topic: "Dilek ve Temenniler",
      description: "Calisan temsilcilerinin ve kurul uyelerinin onerileri",
    },
    {
      topic: "Kapanis",
      description: "Toplantinin sonlandirilmasi ve bir sonraki tarih",
    },
  ];
}

function buildFallbackResponse(note: string, error?: string) {
  return {
    success: true,
    agenda: getFallbackAgenda(),
    metadata: {
      companyName: "Unknown",
      industry: "Unknown",
      itemCount: 10,
      model: "fallback",
      note,
      error,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = (await req.json()) as RequestBody;
    const { prompt, companyName, industry } = body;

    if (!prompt || !companyName || !industry) {
      throw new Error("Missing required fields");
    }

    const googleApiKey = getRequiredGoogleApiKey();
    const googleModel = getGoogleLiteModel();

    const { payload, model } = await callGeminiWithRetryAndFallback({
      apiKey: googleApiKey,
      model: googleModel,
      modelPreference: "lite",
      requestLabel: "generate-agenda",
      body: {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          topP: 0.8,
          topK: 40,
        },
      },
    });

    const rawContent = extractTextFromGeminiResponse(payload);
    const agenda = extractJSON(rawContent)
      .map((item) => cleanAgendaItem(item))
      .filter((item): item is AgendaItem => item !== null);

    if (agenda.length === 0) {
      throw new Error("No valid agenda items");
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        agenda,
        metadata: {
          companyName,
          industry,
          itemCount: agenda.length,
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
    const fallbackPayload = buildFallbackResponse("Varsayilan gundem kullanildi (hata).", errorMessage);

    return new Response(
      JSON.stringify({
        ...fallbackPayload,
        metadata: {
          ...fallbackPayload.metadata,
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
