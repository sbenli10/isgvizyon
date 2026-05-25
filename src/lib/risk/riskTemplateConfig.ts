export type RiskTemplateDetailLevel = "Standart" | "Detaylı" | "Kapsamlı";

export type RiskSectorTemplateConfig = {
  code: string;
  key: string;
  name: string;
  itemCount: number;
  icon: string;
  group: string;
  detailLevel: RiskTemplateDetailLevel;
  riskAreas: string[];
  aliases: string[];
};

const normalizeText = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const RISK_TEMPLATE_CONFIGS: RiskSectorTemplateConfig[] = [
  {
    code: "construction",
    key: "insaat",
    name: "İnşaat / Şantiye",
    itemCount: 60,
    icon: "🏗️",
    group: "Risk Yoğun Alanlar",
    detailLevel: "Kapsamlı",
    riskAreas: ["Yüksekte çalışma", "Kazı ve göçük", "Geçici elektrik", "Vinç ve kaldırma", "Şantiye trafiği"],
    aliases: ["inşaat", "şantiye", "yapım işleri", "hafriyat", "yıkım", "kazı", "iskele", "vinç", "tünel", "köprü", "yol", "çatı", "cephe"],
  },
  {
    code: "manufacturing",
    key: "fabrika",
    name: "Fabrika / Atölye / Üretim Alanı",
    itemCount: 60,
    icon: "🏭",
    group: "Risk Yoğun Alanlar",
    detailLevel: "Kapsamlı",
    riskAreas: ["Makine koruyucuları", "LOTO", "Kimyasal maruziyet", "Forklift ve raf güvenliği", "Yangın ve acil çıkışlar"],
    aliases: ["fabrika", "atölye", "üretim alanı", "üretim", "imalat", "montaj", "otomotiv", "plastik", "enerji", "maden"],
  },
  {
    code: "office",
    key: "ofis",
    name: "Ofis / İdari Alan",
    itemCount: 35,
    icon: "💼",
    group: "Hizmet ve Yönetim",
    detailLevel: "Standart",
    riskAreas: ["Ergonomi", "Elektrik ve kablo düzeni", "Acil tahliye", "Psikososyal riskler"],
    aliases: ["ofis", "idari alan", "büro", "çağrı merkezi", "muhasebe", "danışmanlık", "banka"],
  },
  {
    code: "warehouse",
    key: "depo",
    name: "Depo / Lojistik",
    itemCount: 50,
    icon: "📦",
    group: "Lojistik ve Depolama",
    detailLevel: "Detaylı",
    riskAreas: ["İstifleme", "Forklift trafiği", "Raf güvenliği", "Yükleme-sevkiyat"],
    aliases: ["depo", "lojistik", "sevkiyat", "nakliye", "kargo", "kurye", "stok alanı", "depoculuk"],
  },
  {
    code: "restaurant",
    key: "restoran",
    name: "Restoran / Kafe / Mutfak",
    itemCount: 45,
    icon: "🍽️",
    group: "Konaklama ve Gıda",
    detailLevel: "Detaylı",
    riskAreas: ["Sıcak yüzeyler", "Kesici aletler", "Hijyen", "Kaygan zemin", "Gaz ve yangın"],
    aliases: ["restoran", "kafe", "mutfak", "yemekhane", "catering"],
  },
  {
    code: "hotel",
    key: "otel",
    name: "Otel / Konaklama",
    itemCount: 45,
    icon: "🏨",
    group: "Konaklama ve Gıda",
    detailLevel: "Detaylı",
    riskAreas: ["Mutfak ve servis", "Misafir alanları", "Kat hizmetleri", "Acil tahliye"],
    aliases: ["otel", "konaklama", "turizm", "spa", "kaplıca"],
  },
  {
    code: "retail",
    key: "market",
    name: "Market / Perakende",
    itemCount: 40,
    icon: "🛒",
    group: "Hizmet ve Yönetim",
    detailLevel: "Detaylı",
    riskAreas: ["Raf güvenliği", "Kasa ergonomisi", "Müşteri alanı", "Depo arkası operasyon"],
    aliases: ["market", "perakende", "mağaza", "avm", "satış alanı", "nalbur", "kırtasiye"],
  },
  {
    code: "healthcare",
    key: "saglik",
    name: "Sağlık Kuruluşu",
    itemCount: 45,
    icon: "🏥",
    group: "Sağlık ve Laboratuvar",
    detailLevel: "Detaylı",
    riskAreas: ["Biyolojik maruziyet", "Kesici-delici aletler", "Hasta transferi", "Sterilizasyon"],
    aliases: ["sağlık kuruluşu", "sağlık", "hastane", "klinik", "poliklinik", "acil servis", "medikal"],
  },
  {
    code: "education",
    key: "egitim",
    name: "Eğitim Kurumu / Okul",
    itemCount: 40,
    icon: "📚",
    group: "Hizmet ve Yönetim",
    detailLevel: "Detaylı",
    riskAreas: ["Yoğunluk ve tahliye", "Laboratuvar/sınıf güvenliği", "Ergonomi", "Oyun alanı"],
    aliases: ["eğitim kurumu", "okul", "eğitim", "üniversite", "kurs", "yurt", "kreş"],
  },
  {
    code: "laboratory",
    key: "laboratuvar",
    name: "Laboratuvar",
    itemCount: 45,
    icon: "🧪",
    group: "Sağlık ve Laboratuvar",
    detailLevel: "Detaylı",
    riskAreas: ["Cam ekipman", "Biyogüvenlik", "Kimyasal depolama", "Çeker ocak"],
    aliases: ["laboratuvar", "lab", "analiz"],
  },
  {
    code: "chemical",
    key: "kimyasal",
    name: "Akaryakıt / Kimyasal Alan",
    itemCount: 50,
    icon: "⛽",
    group: "Risk Yoğun Alanlar",
    detailLevel: "Kapsamlı",
    riskAreas: ["Yanıcı-parlayıcı maddeler", "Kimyasal transfer", "SDS/GBF", "Patlayıcı ortam"],
    aliases: ["akaryakıt", "kimyasal alan", "kimya", "boya", "solvent", "reaktif", "akaryakıt istasyonu", "lpg"],
  },
  {
    code: "technical-service",
    key: "teknik_servis",
    name: "Elektrik / Bakım / Teknik Servis",
    itemCount: 50,
    icon: "🔧",
    group: "Risk Yoğun Alanlar",
    detailLevel: "Detaylı",
    riskAreas: ["Elektrik panoları", "Bakım-onarım", "LOTO", "El aletleri", "Yüksekte erişim"],
    aliases: ["elektrik", "bakım", "teknik servis", "tesisat", "doğalgaz", "iklimlendirme", "havalandırma", "servis"],
  },
  {
    code: "agriculture",
    key: "tarim",
    name: "Tarım / Hayvancılık",
    itemCount: 45,
    icon: "🌾",
    group: "Açık Alan ve Saha",
    detailLevel: "Detaylı",
    riskAreas: ["Tarım makineleri", "İlaçlama", "Hayvan teması", "Açık alan hava koşulları"],
    aliases: ["tarım", "hayvancılık", "çiftlik", "sera", "bahçe"],
  },
  {
    code: "cleaning",
    key: "temizlik",
    name: "Temizlik Hizmetleri",
    itemCount: 40,
    icon: "🧼",
    group: "Hizmet ve Yönetim",
    detailLevel: "Detaylı",
    riskAreas: ["Kimyasal karışım", "Islak zemin", "Merdivenli çalışma", "Atık toplama"],
    aliases: ["temizlik hizmetleri", "temizlik", "halı yıkama"],
  },
  {
    code: "security",
    key: "guvenlik",
    name: "Güvenlik Hizmetleri",
    itemCount: 40,
    icon: "🛡️",
    group: "Hizmet ve Yönetim",
    detailLevel: "Detaylı",
    riskAreas: ["Gece devriyesi", "Fiziksel müdahale", "Vardiya düzeni", "Ziyaretçi yönetimi"],
    aliases: ["güvenlik hizmetleri", "güvenlik", "özel güvenlik"],
  },
  {
    code: "beauty",
    key: "kuafor",
    name: "Kuaför / Güzellik Salonu",
    itemCount: 40,
    icon: "✂️",
    group: "Hizmet ve Yönetim",
    detailLevel: "Detaylı",
    riskAreas: ["Kesici aletler", "Kimyasal ürünler", "Ergonomi", "Elektrikli cihazlar"],
    aliases: ["kuaför", "güzellik salonu", "solaryum"],
  },
  {
    code: "auto-service",
    key: "oto_servis",
    name: "Oto Servis / Tamirhane",
    itemCount: 50,
    icon: "🚗",
    group: "Risk Yoğun Alanlar",
    detailLevel: "Detaylı",
    riskAreas: ["Araç kaldırma", "Yağ ve kimyasal", "Kaynak ve taşlama", "Akü ve elektrik"],
    aliases: ["oto servis", "tamirhane", "otoservis", "kaporta", "oto yıkama"],
  },
  {
    code: "metal-work",
    key: "metal",
    name: "Metal İşleri / Kaynak Atölyesi",
    itemCount: 60,
    icon: "⚙️",
    group: "Risk Yoğun Alanlar",
    detailLevel: "Kapsamlı",
    riskAreas: ["Kaynak dumanı", "Taşlama", "Sıcak çalışma", "Pres ve kesim", "Kaldırma ekipmanları"],
    aliases: ["metal işleri", "kaynak atölyesi", "metal", "kaynak", "torna", "demircilik", "döküm"],
  },
  {
    code: "wood-work",
    key: "ahsap",
    name: "Ahşap / Mobilya Atölyesi",
    itemCount: 55,
    icon: "🪵",
    group: "Risk Yoğun Alanlar",
    detailLevel: "Detaylı",
    riskAreas: ["Ahşap tozu", "Testere ve freze", "Yapıştırıcılar", "İstifleme"],
    aliases: ["ahşap", "mobilya", "marangoz", "doğrama", "ahşap atölyesi"],
  },
  {
    code: "food-production",
    key: "gida",
    name: "Gıda Üretim Alanı",
    itemCount: 55,
    icon: "🥣",
    group: "Konaklama ve Gıda",
    detailLevel: "Detaylı",
    riskAreas: ["Hijyen", "Çapraz kontaminasyon", "Sıcak-soğuk yüzeyler", "Kesici ekipman"],
    aliases: ["gıda üretim alanı", "gıda", "kasap", "gıda tesisi"],
  },
  {
    code: "textile",
    key: "tekstil",
    name: "Tekstil Atölyesi",
    itemCount: 45,
    icon: "🧵",
    group: "Risk Yoğun Alanlar",
    detailLevel: "Detaylı",
    riskAreas: ["Dikiş ve dokuma makineleri", "Pamuk tozu", "Ergonomi", "Yangın yükü"],
    aliases: ["tekstil", "tekstil atölyesi", "boyahane", "deri", "ayakkabı"],
  },
  {
    code: "cold-storage",
    key: "soguk_hava",
    name: "Soğuk Hava Deposu",
    itemCount: 45,
    icon: "🧊",
    group: "Lojistik ve Depolama",
    detailLevel: "Detaylı",
    riskAreas: ["Düşük sıcaklık", "Buzlanma", "Kapalı alan hissi", "Yükleme"],
    aliases: ["soğuk hava deposu", "soğuk depo", "soğuk oda"],
  },
  {
    code: "working-at-height",
    key: "yuksekte_calisma",
    name: "Yüksekte Çalışma Alanı",
    itemCount: 50,
    icon: "🪜",
    group: "Açık Alan ve Saha",
    detailLevel: "Kapsamlı",
    riskAreas: ["Düşme önleme", "Yaşam hattı", "Mobil platform", "Merdiven ve iskele"],
    aliases: ["yüksekte çalışma alanı", "yüksekte çalışma", "çatı", "platform", "vinç sepeti"],
  },
  {
    code: "confined-space",
    key: "kapali_alan",
    name: "Kapalı Alan Çalışması",
    itemCount: 50,
    icon: "🕳️",
    group: "Açık Alan ve Saha",
    detailLevel: "Kapsamlı",
    riskAreas: ["Oksijen yetersizliği", "Gaz ölçümü", "Kurtarma planı", "İzinli çalışma"],
    aliases: ["kapalı alan çalışması", "kapalı alan", "tank içi", "kuyu", "menhol"],
  },
  {
    code: "general",
    key: "genel",
    name: "Genel Karma Risk Analizi",
    itemCount: 40,
    icon: "📋",
    group: "Genel",
    detailLevel: "Standart",
    riskAreas: ["Ergonomi", "Elektrik", "Yangın", "Acil durum", "Temel iş güvenliği"],
    aliases: ["genel karma risk analizi", "genel", "karma", "tüm sektörler"],
  },
];

export function normalizeRiskSectorKey(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  for (const config of RISK_TEMPLATE_CONFIGS) {
    const candidates = [config.code, config.key, config.name, ...config.aliases].map(normalizeText);
    if (candidates.some((candidate) => candidate === normalized || normalized.includes(candidate) || candidate.includes(normalized))) {
      return config.key;
    }
  }

  return normalized.replace(/\s+/g, "_");
}

export function getRiskSectorTemplateConfig(value?: string | null) {
  if (!value) return undefined;
  const normalizedKey = normalizeRiskSectorKey(value);
  return RISK_TEMPLATE_CONFIGS.find((config) => config.key === normalizedKey);
}

export function getSectorMinimumRiskItemCount(value?: string | null, fallback = 40) {
  return getRiskSectorTemplateConfig(value)?.itemCount ?? fallback;
}

export function doesRiskSectorMatch(sourceValue?: string | null, targetValue?: string | null) {
  const sourceConfig = getRiskSectorTemplateConfig(sourceValue);
  const targetConfig = getRiskSectorTemplateConfig(targetValue);

  if (sourceConfig && targetConfig) {
    return sourceConfig.key === targetConfig.key;
  }

  const source = normalizeRiskSectorKey(sourceValue || "");
  const target = normalizeRiskSectorKey(targetValue || "");
  return Boolean(source && target && (source === target || source.includes(target) || target.includes(source)));
}
