import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  GeminiHttpError,
  callGeminiWithRetryAndFallback,
  cleanJsonText,
  extractTextFromGeminiResponse,
  getGoogleLiteModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

type InstructionCategory =
  | "İş Makineleri"
  | "El Aletleri"
  | "Kimyasal Madde"
  | "Elektrik İşleri"
  | "Yüksekte Çalışma"
  | "Kapalı Alan"
  | "Kaynak ve Kesme"
  | "Taşıma & Depolama"
  | "Mutfak & Yemekhane"
  | "Ofis & Ergonomi"
  | "Ofis & Büro"
  | "İnşaat & Saha"
  | "Genel İSG";

type SectionTone = "green" | "blue" | "yellow" | "red" | "purple";

interface RequestBody {
  workName?: string;
  notes?: string;
}

interface GeneratedInstruction {
  title: string;
  category: InstructionCategory;
  description: string;
  tags: string[];
  requiredPpe: string[];
  risks: string[];
  steps: string[];
  emergencyNotes: string[];
  legalNotes?: string[];
  instructionSections: {
    title: string;
    tone: SectionTone;
    items: string[];
  }[];
}

const categories: InstructionCategory[] = [
  "İş Makineleri",
  "El Aletleri",
  "Kimyasal Madde",
  "Elektrik İşleri",
  "Yüksekte Çalışma",
  "Kapalı Alan",
  "Kaynak ve Kesme",
  "Taşıma & Depolama",
  "Mutfak & Yemekhane",
  "Ofis & Ergonomi",
  "Ofis & Büro",
  "İnşaat & Saha",
  "Genel İSG",
];

const requiredSections = [
  { title: "1. HAZIRLIK", tone: "green" as const },
  { title: "2. OPERASYON", tone: "blue" as const },
  { title: "3. YASAKLAR", tone: "red" as const },
  { title: "4. KİŞİSEL KORUYUCU DONANIM (KKD)", tone: "yellow" as const },
  { title: "5. ACİL DURUM", tone: "purple" as const },
];

const defaultLegalNotes = [
  "Bu talimat 6331 sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında hazırlanmıştır.",
  "Uygulama öncesinde saha koşulları, risk değerlendirmesi ve ilgili mevzuat ayrıca kontrol edilmelidir.",
  "Talimat, işyerine özgü prosedürler ve ekipman kullanım kılavuzlarıyla birlikte değerlendirilmelidir.",
];

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
        .slice(0, 12)
    : [];

const safeText = (value: unknown, fallback: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};

function buildPrompt(workName: string, notes: string) {
  return `Sen Türkiye mevzuatına ve saha uygulamalarına hakim kıdemli bir İş Güvenliği Uzmanısın.

Görev:
"${workName}" için profesyonel bir ÇALIŞMA TALİMATI üret.
${notes ? `Kullanıcının ek bilgisi: ${notes}` : "Kullanıcı ek bilgi vermedi; makul saha varsayımları yap."}

Kesin çıktı kuralları:
- Sadece geçerli JSON OBJECT döndür. Markdown, açıklama, kod bloğu veya ek metin yazma.
- Türkçe yaz.
- Talimat 1-2 sayfalık profesyonel içerik yoğunluğunda olsun.
- category alanı sadece şu değerlerden biri olsun: ${categories.join(", ")}.
- instructionSections tam olarak 5 bölüm içersin ve başlıklar birebir şu olsun:
  1. HAZIRLIK
  2. OPERASYON
  3. YASAKLAR
  4. KİŞİSEL KORUYUCU DONANIM (KKD)
  5. ACİL DURUM
- Her bölümde en az 5, mümkünse 7-9 somut madde olsun.
- Maddeler uygulanabilir, denetlenebilir, sahaya uygun ve gereksiz tekrar içermeyen cümleler olsun.
- KKD bölümünde yalnızca kişisel koruyucu donanım maddeleri yer alsın.
- Yasaklar bölümünde net yasak davranışlar yaz.
- Acil durum bölümünde ilk yardım, 112, alan güvenliği ve bildirim adımları yer alsın.

JSON şeması:
{
  "title": "string",
  "category": "string",
  "description": "string",
  "tags": ["string"],
  "requiredPpe": ["string"],
  "risks": ["string"],
  "steps": ["string"],
  "emergencyNotes": ["string"],
  "instructionSections": [
    { "title": "1. HAZIRLIK", "tone": "green", "items": ["string"] },
    { "title": "2. OPERASYON", "tone": "blue", "items": ["string"] },
    { "title": "3. YASAKLAR", "tone": "red", "items": ["string"] },
    { "title": "4. KİŞİSEL KORUYUCU DONANIM (KKD)", "tone": "yellow", "items": ["string"] },
    { "title": "5. ACİL DURUM", "tone": "purple", "items": ["string"] }
  ]
}`;
}

function parseGeneratedInstruction(rawText: string, workName: string): GeneratedInstruction {
  let parsed: any;

  try {
    parsed = JSON.parse(cleanJsonText(rawText));
  } catch (error) {
    console.error("work-instruction-generate JSON parse failed", { rawText, error });
    throw new GeminiHttpError(502, "json_parse_error", "Yapay zeka yanıtı geçerli JSON olarak okunamadı.");
  }

  const category = categories.includes(parsed?.category) ? parsed.category : "Genel İSG";
  const aiSections = Array.isArray(parsed?.instructionSections) ? parsed.instructionSections : [];

  const instructionSections = requiredSections.map((required, index) => {
    const aiSection = aiSections[index] || aiSections.find((section: any) => section?.title === required.title) || {};
    const items = toStringList(aiSection?.items);

    if (!items.length) {
      throw new GeminiHttpError(502, "empty_section", `${required.title} bölümü üretilemedi.`);
    }

    return {
      title: required.title,
      tone: required.tone,
      items,
    };
  });

  const requiredPpe = toStringList(parsed?.requiredPpe);
  const risks = toStringList(parsed?.risks);
  const steps = toStringList(parsed?.steps);
  const emergencyNotes = toStringList(parsed?.emergencyNotes);

  return {
    title: safeText(parsed?.title, `${workName} Çalışma Talimatı`),
    category,
    description: safeText(
      parsed?.description,
      `${workName} faaliyeti için yapay zeka ile oluşturulan profesyonel İSG çalışma talimatı.`,
    ),
    tags: toStringList(parsed?.tags).length ? toStringList(parsed?.tags) : [workName, category, "AI"],
    requiredPpe: requiredPpe.length ? requiredPpe : instructionSections[3].items,
    risks: risks.length ? risks : [
      `${workName} sırasında ekipman/ortam kaynaklı yaralanma`,
      "Yetkisiz kullanım veya kontrolsüz müdahale",
      "KKD kullanılmaması nedeniyle maruziyet",
    ],
    steps: steps.length ? steps : instructionSections.slice(0, 2).flatMap((section) => section.items),
    emergencyNotes: emergencyNotes.length ? emergencyNotes : instructionSections[4].items,
    legalNotes: defaultLegalNotes,
    instructionSections,
  };
}

Deno.serve(async (req) => {
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
    const workName = typeof body?.workName === "string" ? body.workName.trim() : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 600) : "";

    if (!workName) {
      return jsonResponse(400, {
        success: false,
        error: { code: "invalid_payload", message: "İş / makine / ekipman adı boş bırakılamaz." },
      });
    }

    const apiKey = getRequiredGoogleApiKey();
    const modelName = getGoogleLiteModel("gemini-2.5-flash");

    const { payload, model } = await callGeminiWithRetryAndFallback({
      apiKey,
      model: modelName,
      modelPreference: "lite",
      requestLabel: "work-instruction-generate",
      logMeta: { workName },
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(workName, notes) }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      },
    });

    const rawText = extractTextFromGeminiResponse(payload);
    const instruction = parseGeneratedInstruction(rawText, workName);

    return jsonResponse(200, {
      success: true,
      model,
      instruction,
    });
  } catch (error) {
    console.error("work-instruction-generate failed", error);

    if (error instanceof GeminiHttpError) {
      return jsonResponse(error.status, {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    return jsonResponse(500, {
      success: false,
      error: {
        code: "unexpected_error",
        message: error instanceof Error ? error.message : "Talimat oluşturulurken beklenmeyen bir hata oluştu.",
      },
    });
  }
});
