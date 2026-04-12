import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

interface AnalysisResult {
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Normal" | "Yüksek" | "Kritik";
}

interface RequestBody {
  imageUrl: string;
  context: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageUrl } = (await req.json()) as RequestBody;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fotoğrafı base64'e dönüştür
    const imageBase64 = await convertUrlToBase64(imageUrl);

    // Claude API anahtarını al
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = new Anthropic({ apiKey });

    // ✅ DOĞRU FORMAT: base64 ile
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `You are a professional occupational health and safety (OHS) expert analyzing workplace hazards in images.

Analyze this image for workplace hazards and provide a detailed response in Turkish (Türkçe).

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "description": "Bulgu açıklaması - ne gördünüz? (2-3 cümle, Türkçe)",
  "riskDefinition": "Risk tanımı - bu ne kadar tehlikeli ve neden? (2-3 cümle, Türkçe)",
  "correctiveAction": "Düzeltici faaliyet - acil olarak ne yapılmalı? (2-3 madde, Türkçe)",
  "preventiveAction": "Önleyici faaliyet - ileride bunu nasıl önleriz? (2-3 madde, Türkçe)",
  "importance_level": "Normal"
}

Always respond with valid JSON only. Do not add any markdown formatting.`,
            },
          ],
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // JSON'u parse et (markdown formatting'i kaldır)
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    const analysis: AnalysisResult = JSON.parse(jsonText);

    return new Response(JSON.stringify({ analysis }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Analysis error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

// ✅ URL'den Base64'e dönüştür
async function convertUrlToBase64(imageUrl: string): Promise<string> {
  try {
    // Data URL ise doğrudan işle
    if (imageUrl.startsWith("data:")) {
      return imageUrl.split(",")[1];
    }

    // URL'den fotoğrafı indir
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Base64'e çevir
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw error;
  }
}