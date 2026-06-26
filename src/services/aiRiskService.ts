import { invokeEdgeFunction } from "@/lib/ai/invokeEdgeFunction";

export interface RiskHazard {
  hazard: string;
  risk: string;
  preventiveMeasures: string[];
  departmentActivity?: string;
  currentMeasure?: string;
  possibleOutcome?: string;
  probability?: string | number;
  frequency?: string | number;
  severity?: string | number;
  riskScore?: string | number;
  riskLevel?: string;
  postProbability?: string | number;
  postFrequency?: string | number;
  postSeverity?: string | number;
  postRiskScore?: string | number;
  postRiskLevel?: string;
  deadline?: string;
  responsible?: string;
}

export interface RiskAnalysisResponse {
  risks: RiskHazard[];
}

export interface NaceRiskAnalysisParams extends Record<string, unknown> {
  naceCode: string;
  sector: string;
  hazardClass: string;
  naceTitle?: string;
}

interface NaceRiskAnalyzeResponse {
  success: true;
  risks: RiskHazard[];
}

function mapNaceError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("invalid_payload")) {
    return "NACE analizi icin gerekli bilgiler eksik veya gecersiz.";
  }
  if (message.includes("bos yanit") || message.includes("empty")) {
    return "Yapay zeka NACE analizi icin gecerli bir sonuc donmedi.";
  }
  if (message.includes("yogun") || message.includes("rate")) {
    return "Yapay zeka servisi su anda yogun. Biraz sonra tekrar deneyin.";
  }

  return error instanceof Error ? error.message : "NACE risk analizi basarisiz oldu.";
}

const getDefaultNumbers = (hazardClass: string) => {
  if (hazardClass.includes("Çok") || hazardClass.includes("Cok")) {
    return { probability: 6, frequency: 1, severity: 15 };
  }
  if (hazardClass.includes("Tehlikeli")) {
    return { probability: 3, frequency: 1, severity: 7 };
  }
  return { probability: 1, frequency: 1, severity: 3 };
};

const riskLevelFromScore = (score: number) => {
  if (score > 400) return "Çok Yüksek Risk";
  if (score >= 200) return "Yüksek Risk";
  if (score >= 70) return "Önemli Risk";
  if (score >= 20) return "Olası Risk";
  return "Kabul Edilebilir Risk";
};

const buildFallbackRisk = (
  params: NaceRiskAnalysisParams,
  hazard: string,
  risk: string,
  measures: string[],
  outcome: string,
): RiskHazard => {
  const numbers = getDefaultNumbers(params.hazardClass);
  const riskScore = numbers.probability * numbers.frequency * numbers.severity;
  const postProbability = 0.2;
  const postFrequency = 1;
  const postSeverity = Math.min(numbers.severity, 3);
  const postRiskScore = postProbability * postFrequency * postSeverity;

  return {
    departmentActivity: params.naceTitle || params.sector,
    hazard,
    risk,
    currentMeasure: "Mevcut durum saha kontrolünde değerlendirilecek; standart İSG tedbirleri takip edilecektir.",
    probability: String(numbers.probability),
    frequency: String(numbers.frequency),
    severity: String(numbers.severity),
    riskScore: String(riskScore),
    riskLevel: riskLevelFromScore(riskScore),
    possibleOutcome: outcome,
    preventiveMeasures: measures,
    postProbability: String(postProbability),
    postFrequency: String(postFrequency),
    postSeverity: String(postSeverity),
    postRiskScore: String(postRiskScore),
    postRiskLevel: riskLevelFromScore(postRiskScore),
    deadline: "30 gün",
    responsible: "İşveren",
  };
};

function buildFallbackNaceRisks(params: NaceRiskAnalysisParams): RiskAnalysisResponse {
  const activity = params.naceTitle || params.sector || "Faaliyet alanı";
  return {
    risks: [
      buildFallbackRisk(
        params,
        "İşyeri ortam tehlikeleri",
        `${activity} kapsamında çalışma ortamındaki düzensizlik, uygun olmayan geçiş yolları veya kontrolsüz çalışma koşulları yaralanma ve iş kaybına yol açabilir.`,
        [
          "Çalışma alanları düzenli kontrol edilmeli ve uygunsuzluklar kayıt altına alınmalıdır.",
          "Geçiş yolları, çalışma platformları ve acil çıkışlar sürekli açık tutulmalıdır.",
          "Çalışanlara görev bazlı İSG talimatları tebliğ edilmelidir.",
        ],
        "Yaralanma, iş gücü kaybı ve operasyon aksaması",
      ),
      buildFallbackRisk(
        params,
        "Makine ve ekipman kullanımı",
        "Faaliyet sırasında kullanılan ekipmanların uygunsuz kullanımı, bakım eksikliği veya koruyucu donanım yetersizliği yaralanma riski oluşturabilir.",
        [
          "Makine ve ekipmanların periyodik bakım ve kontrol kayıtları tutulmalıdır.",
          "Koruyucu düzenekler devre dışı bırakılmamalıdır.",
          "Yetkisiz kişilerin ekipman kullanması engellenmelidir.",
        ],
        "Ezilme, kesilme, yaralanma veya maddi hasar",
      ),
      buildFallbackRisk(
        params,
        "Elektrik kaynaklı tehlikeler",
        "Elektrik tesisatı, uzatma kabloları veya panolardaki uygunsuzluklar elektrik çarpması ve yangın riskine neden olabilir.",
        [
          "Elektrik panoları kilitli ve yetkisiz erişime kapalı olmalıdır.",
          "Kaçak akım röleleri ve topraklama kontrolleri düzenli yapılmalıdır.",
          "Hasarlı kablo ve prizler kullanılmadan önce değiştirilmelidir.",
        ],
        "Elektrik çarpması, yanık veya yangın",
      ),
      buildFallbackRisk(
        params,
        "Yangın ve acil durum hazırlığı",
        "Yanıcı malzemeler, uygunsuz depolama veya acil durum ekipmanlarının yetersizliği yangın ve tahliye risklerini artırabilir.",
        [
          "Yangın söndürme ekipmanları erişilebilir ve periyodik kontrollü olmalıdır.",
          "Acil çıkış ve tahliye yolları işaretlenmeli ve açık tutulmalıdır.",
          "Acil durum tatbikatları planlı şekilde yapılmalıdır.",
        ],
        "Yangın, yaralanma, panik ve maddi kayıp",
      ),
      buildFallbackRisk(
        params,
        "Ergonomi ve elle taşıma",
        "Uygun olmayan çalışma pozisyonları, tekrarlı işler veya elle taşıma faaliyetleri kas iskelet sistemi rahatsızlıklarına yol açabilir.",
        [
          "Elle taşıma işleri için çalışanlara doğru kaldırma ve taşıma eğitimi verilmelidir.",
          "Ağır yüklerde mekanik yardımcı ekipman kullanılmalıdır.",
          "Çalışma düzeni ergonomik riskleri azaltacak şekilde planlanmalıdır.",
        ],
        "Kas iskelet sistemi rahatsızlığı ve iş gücü kaybı",
      ),
    ],
  };
}

export async function generateNaceRiskAnalysis(
  params: NaceRiskAnalysisParams,
): Promise<RiskAnalysisResponse> {
  try {
    const response = await invokeEdgeFunction<NaceRiskAnalyzeResponse>(
      "nace-risk-analyze",
      params,
    );
    return {
      risks: Array.isArray(response.risks) ? response.risks : [],
    };
  } catch (error) {
    console.warn("NACE AI edge function failed, using local fallback risks.", {
      error: mapNaceError(error),
      params,
    });
    return buildFallbackNaceRisks(params);
  }
}

export function validateAIConfig(): boolean {
  return true;
}
