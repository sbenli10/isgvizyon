// supabase\functions\risk-library-generate\index.ts
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  GeminiHttpError,
  callGeminiWithRetryAndFallback,
  cleanJsonText,
  extractTextFromGeminiResponse,
  getGoogleLiteModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

interface GeminiRiskResult {
  hazard: string;
  risk: string;
  category: string;
  probability: number;
  frequency: number;
  severity: number;
  controls: string[];
}

interface RequestBody {
  sector?: string;
  companyName?: string;
}

// LLM'den gelen cevap ne olursa olsun ilk düzgün JSON array literalini çıkarır
function extractFirstJSONArray(text: string): string | null {
  let start = -1, depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

// JSON stringi hatalı kaçış veya markdown'dan arındırır
function safeCleanAndRepairJson(text: string): string {
  // Markdown veya code block ayıklama:
  // [```json\n ... \n```], [``` ...```], extra başlık vb.
  let cleaned = text
    .replace(/^```json|^```|```$/gm, "") // baştaki/sondaki markdown bloklarını sil
    .replace(/^\s*\w+?:\s*$/gm, "")      // başlık/etiket satırlarını sil
    .trim();

  // LLM bazen \"5S\" string basar, onları düzeltelim
  cleaned = cleaned.replace(/\\"/g, "'");
  //  “ ve ” gibi tipografik double quotes düzeltmesi
  cleaned = cleaned.replace(/[“”]/g, "'");
  // Gereksiz ters slashları
  cleaned = cleaned.replace(/\\'/g, "'");

  // Eğer hala bir trunc var ve dizi açık bitmişse, düzelt
  if (cleaned.startsWith("[") && !cleaned.endsWith("]")) {
    const lastObjEnd = cleaned.lastIndexOf("}");
    if (lastObjEnd !== -1) cleaned = cleaned.slice(0, lastObjEnd + 1) + "]";
  }

  return cleaned;
}

function parseRisks(text: string): GeminiRiskResult[] {
  console.log("[PARSE] JSON temizleme ve ayrıştırma işlemi başlatıldı.");

  // 1. İlk JSON dizisini çıkar
  const arrStr = extractFirstJSONArray(text);
  if (!arrStr) {
    console.error("[PARSE ERROR] Hiçbir JSON array literal'i bulunamadı! Ham yanıt:", text);
    throw new GeminiHttpError(502, "json_parse_error", "LLM yanıtında geçerli bir JSON array bulunamadı.");
  }

  let parsed: any = null;
  try {
    // 2. Temizle ve parse et
    const cleaned = safeCleanAndRepairJson(arrStr);
    parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Çıkarılan veri array değil!");
    console.log("[PARSE] JSON başarıyla parse edildi ve dizi olarak tanındı.");
  } catch (err) {
    console.error("[PARSE ERROR] JSON.parse başarısız! Ham metin:", arrStr);
    console.error("[PARSE ERROR] Hata detayı:", err);
    throw new GeminiHttpError(502, "json_parse_error", "Yanıttan geçerli bir JSON array ayrıştırılamadı.");
  }

  if (!parsed.length) {
    console.error("[PARSE ERROR] Dizi boş geldi: LLM risk üretiminde başarısız.");
    throw new GeminiHttpError(502, "empty_response", "Yapay zeka geçerli bir risk dizisi oluşturamadı.");
  }

  // 3. Validasyon ve normalizasyon
  const normalized: GeminiRiskResult[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== "object") continue;

    const controls = Array.isArray(item?.controls) ? item.controls.filter((v: any) => typeof v === "string" && v.trim()) : [];
    const hazard   = (item.hazard   || item.tehlike || "").toString().trim();
    const risk     = (item.risk     || item.risk_aciklamasi || "").toString().trim();
    const category = (item.category || item.kategori || "Genel").toString().trim();
    const probability = Number(item.probability ?? item.olasilik ?? 0);
    const frequency   = Number(item.frequency   ?? item.frekans   ?? 0);
    const severity    = Number(item.severity    ?? item.siddet    ?? 0);

    if (!hazard || !risk || !controls.length || !probability || !frequency || !severity)
      continue;

    normalized.push({
      hazard, risk, category, probability, frequency, severity, controls,
    });
  }

  if (!normalized.length) {
    console.error("[PARSE ERROR] Hiç geçerli risk maddesi yok.");
    throw new GeminiHttpError(502, "empty_response", "Risk dizisi doğrulanamadı.");
  }

  console.log(`[PARSE SUCCESS] ${normalized.length} adet risk başarıyla doğrulandı.`);
  return normalized;
}


function buildPrompt(sector: string, companyName?: string) {
  return `Sen Turkiye mevzuatina hakim kidemli bir ISG uzmani ve Fine-Kinney degerlendirme uzmansin.

Gorev:
- ${companyName ? `"${companyName}" icin` : "Bir firma icin"} "${sector}" sektorune ozel 15 adet en kritik risk maddesi uret.
- Maddeler tekrarsiz, uygulanabilir ve sahaya ozgu olsun.
- Her madde icin hazard, risk, category, probability, frequency, severity ve controls alanlarini doldur.
- Controls alaninda tam olarak 3 somut, net ve uygulanabilir onlem olsun.
- Yanitini baska hicbir aciklama metni eklemeden, doğrudan bir JSON ARRAY (dizi) dondur.

KRITIK KURALLAR (JSON BOZULMAMASI ICIN):
- JSON string degerleri icerisinde kesinlikle cift tirnak (") isareti kullanma! Gerekirse tek tirnak (') kullan veya hic kullanma. (Ornegin "5S" yerine '5S' yaz).
- probability, frequency ve severity sayi (number) olmali, asla string ("6" gibi) olmamali.

JSON ornegi:
[
  {
    "hazard": "Elektrik panolarinin acik ve korumasiz olmasi",
    "risk": "Temas halinde elektrik carpmasi ve olumcul yaralanma",
    "category": "Elektrik Güvenliği",
    "probability": 3,
    "frequency": 6,
    "severity": 15,
    "controls": [
      "Panolarin kilitli tutulmasi ve sadece yetkili personelin erismesi",
      "Kacak akim rolelerinin aylik test edilmesi",
      "Pano onlerine yalitimkan paspas serilmesi"
    ]
  }
]`;
}


Deno.serve(async (req) => {
  console.log(`[HTTP REQUEST] Gelen İstek Metodu: ${req.method} | URL: ${req.url}`);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, {
        success: false,
        error: { code: "method_not_allowed", message: "Yalnızca POST istekleri desteklenir." },
      });
    }

    const body = (await req.json()) as RequestBody;
    const sector = typeof body?.sector === "string" ? body.sector.trim() : "";
    const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";

    if (!sector) {
      return jsonResponse(400, {
        success: false,
        error: { code: "invalid_payload", message: "`sector` alanı boş bırakılamaz." },
      });
    }

    const apiKey = getRequiredGoogleApiKey();
    const modelName = getGoogleLiteModel();

    const { payload } = await callGeminiWithRetryAndFallback({
      apiKey,
      model: modelName,
      modelPreference: "lite",
      requestLabel: "risk-library-generate",
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(sector, companyName || undefined) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      },
    });

    const rawText = extractTextFromGeminiResponse(payload);

    const risks = parseRisks(rawText);

    return jsonResponse(200, { success: true, risks });

  } catch (error) {
    console.error(`[FATAL ERROR] İstek başarısız oldu!`, error);
    if (error instanceof GeminiHttpError) {
      return jsonResponse(error.status, {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    return jsonResponse(500, {
      success: false,
      error: { code: "unexpected_error", message: "Risk analizi oluşturulamadı. Sunucu veya yapay zeka zaman aşımına uğramış olabilir." },
    });
  }
});