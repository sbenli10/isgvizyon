import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { consumeFeatureOrRespond } from "../_shared/feature_limits.ts";
import {
  GeminiHttpError,
  callGeminiWithRetryAndFallback,
  cleanJsonText,
  extractTextFromGeminiResponse,
  getGoogleLiteModel,
  getRequiredGoogleApiKey,
} from "../_shared/gemini.ts";

type Difficulty = "Kolay" | "Orta" | "Zor" | "Karışık";

interface RequestBody {
  sector?: string;
  difficulty?: Difficulty;
  count?: number;
}

interface TrainingQuestion {
  question: string;
  options: string[];
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
}

function normalizeDifficulty(value?: string): Difficulty {
  if (value === "Kolay" || value === "Orta" || value === "Zor" || value === "Karışık") return value;
  return "Karışık";
}

function buildPrompt(sector: string, difficulty: Difficulty, count: number) {
  return `Sen Türkiye mevzuatına hakim kıdemli bir iş sağlığı ve güvenliği eğitim uzmanısın.

Görev:
- "${sector}" sektörü için eğitim sonrası uygulanacak ${count} soruluk çoktan seçmeli İSG sınavı hazırla.
- Zorluk seviyesi: ${difficulty}.
- Sorular sahaya uygun, anlaşılır, ölçülebilir ve mevzuat diline yakın olsun.
- Her soru için 4 seçenek üret.
- Doğru cevap A, B, C veya D olmalı.
- Açıklama kısa olmalı ve kullanıcının öğrenmesine yardım etmeli.
- Yanıtı sadece JSON array olarak döndür. Markdown, başlık veya ek açıklama ekleme.

JSON şeması:
[
  {
    "question": "Soru metni",
    "options": ["A seçeneği", "B seçeneği", "C seçeneği", "D seçeneği"],
    "correctAnswer": "A",
    "explanation": "Kısa açıklama"
  }
]`;
}

function safeJsonParse(raw: string): unknown {
  const candidates = [
    cleanJsonText(raw),
    raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim(),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  throw new GeminiHttpError(
    502,
    "json_parse_error",
    "Sorular oluşturuldu ancak okunabilir formata çevrilemedi.",
  );
}

function getOptionText(row: Record<string, unknown>, index: number) {
  const letter = ["A", "B", "C", "D"][index];
  return String(
    row[`option${letter}`] ||
      row[`secenek${letter}`] ||
      row[`seçenek${letter}`] ||
      row[letter] ||
      "",
  ).trim();
}

function normalizeOptions(row: Record<string, unknown>) {
  const optionSource = row.options || row.secenekler || row["seçenekler"];
  const options = Array.isArray(optionSource)
    ? optionSource.map((option) => String(option || "").trim()).filter(Boolean)
    : [0, 1, 2, 3].map((index) => getOptionText(row, index)).filter(Boolean);

  return options.slice(0, 4);
}

function parseQuestions(raw: string): TrainingQuestion[] {
  const parsed = safeJsonParse(raw);
  const questionRows = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.questions)
      ? (parsed as Record<string, unknown>).questions
      : Array.isArray((parsed as Record<string, unknown>)?.sorular)
        ? (parsed as Record<string, unknown>).sorular
        : null;

  if (!questionRows) {
    throw new GeminiHttpError(502, "invalid_response", "Yapay zeka geçerli soru listesi döndürmedi.");
  }

  const normalized = questionRows
    .map((item): TrainingQuestion | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const question = String(row.question || row.soru || row.text || "").trim();
      const options = normalizeOptions(row);
      const correct = String(
        row.correctAnswer ||
          row.correct_answer ||
          row.answer ||
          row.dogruCevap ||
          row.dogru_cevap ||
          row["doğruCevap"] ||
          row["doğru_cevap"] ||
          "",
      )
        .trim()
        .toUpperCase()
        .replace(/[^A-D]/g, "");
      const explanation = String(row.explanation || row.aciklama || row["açıklama"] || "").trim();

      if (!question || options.length !== 4 || !["A", "B", "C", "D"].includes(correct)) return null;

      return {
        question,
        options,
        correctAnswer: correct as TrainingQuestion["correctAnswer"],
        explanation,
      };
    })
    .filter((item): item is TrainingQuestion => Boolean(item));

  if (!normalized.length) {
    throw new GeminiHttpError(502, "empty_response", "Yapay zeka geçerli soru üretemedi.");
  }

  return normalized;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, {
        success: false,
        error: { code: "method_not_allowed", message: "Yalnızca POST istekleri desteklenir." },
      });
    }

    const body = (await req.json()) as RequestBody;
    const sector = typeof body?.sector === "string" && body.sector.trim() ? body.sector.trim() : "Genel İSG";
    const difficulty = normalizeDifficulty(body?.difficulty);
    const count = Math.min(Math.max(Number(body?.count || 10), 5), 20);
    const limitResponse = await consumeFeatureOrRespond(req, "ai.risk_generation_monthly");
    if (limitResponse) return limitResponse;

    const apiKey = getRequiredGoogleApiKey();
    const { payload } = await callGeminiWithRetryAndFallback({
      apiKey,
      model: getGoogleLiteModel(),
      modelPreference: "lite",
      requestLabel: "training-questions-generate",
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(sector, difficulty, count) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      },
      logMeta: { sector, difficulty, count },
    });

    const questions = parseQuestions(extractTextFromGeminiResponse(payload)).slice(0, count);

    return jsonResponse(200, { success: true, questions });
  } catch (error) {
    console.error("training-questions-generate failed", error);

    if (error instanceof GeminiHttpError) {
      return jsonResponse(error.status, {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    return jsonResponse(500, {
      success: false,
      error: {
        code: "unexpected_error",
        message: "Eğitim soruları şu anda oluşturulamadı. Birkaç dakika sonra tekrar deneyin.",
      },
    });
  }
});
