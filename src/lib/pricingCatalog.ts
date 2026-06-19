export type PricingComparisonValue = "Var" | "Kısıtlı" | "Yok" | string;

export type PricingPlan = {
  title: "Ücretsiz" | "Premium" | "OSGB";
  badge: string;
  price: string;
  period: string;
  audience: string;
  description: string;
  bullets: string[];
  cta: string;
  recommended: boolean;
};

export type PricingComparisonRow = {
  feature: string;
  free: PricingComparisonValue;
  premium: PricingComparisonValue;
  osgb: PricingComparisonValue;
};

export const pricingPlans: PricingPlan[] = [
  {
    title: "Ücretsiz",
    badge: "Başlangıç",
    price: "₺0",
    period: "/ sınırsız süre",
    audience: "Platformu tanımak isteyen bireysel kullanıcılar",
    description:
      "Temel İSG süreçlerini başlatmak, platformu keşfetmek ve ihtiyaçlarını risksiz şekilde denemek isteyen kullanıcılar için.",
    bullets: [
      "1 firmaya kadar kullanım",
      "50 çalışan kaydı desteği",
      "Temel risk, denetim ve DÖF kayıtları",
      "Ayda 3 rapor çıktısı",
    ],
    cta: "Ücretsiz Başla",
    recommended: false,
  },
  {
    title: "Premium",
    badge: "Popüler",
    price: "Fiyat yükleniyor",
    period: "/ ay",
    audience: "Aktif operasyon yürüten İSG profesyonelleri",
    description:
      "Yapay zeka destekli analizleri, gelişmiş raporlama araçlarını ve profesyonel doküman üretimini aktif kullanan ekipler için.",
    bullets: [
      "Premium yapay zeka araçları",
      "İSGBot, DÖF ve kroki analizleri",
      "3 firmaya kadar kullanım",
      "Sınırsız çalışan kaydı",
    ],
    cta: "Premium'a Başla",
    recommended: false,
  },
  {
    title: "OSGB",
    badge: "Öne Çıkan Paket",
    price: "Fiyat yükleniyor",
    period: "/ ay",
    audience: "Birden fazla firmayı yöneten OSGB yapıları",
    description:
      "Premium'un tüm özellikleriyle birlikte çoklu firma, ekip, İSG-KATİP, finans ve OSGB operasyonlarını tek merkezden yöneten yapılar için.",
    bullets: [
      "Premium paketindeki tüm özellikler",
      "OSGB dashboard, kapasite ve finans",
      "İSG-KATİP merkezi ve müşteri portalı",
      "Sınırsız firma, çalışan ve ekip yönetimi",
    ],
    cta: "OSGB Paketini İncele",
    recommended: true,
  },
];

export const pricingComparisonRows: PricingComparisonRow[] = [
  { feature: "Firma limiti", free: "1 firma", premium: "3 firma", osgb: "Sınırsız" },
  { feature: "Çalışan limiti", free: "50 çalışan", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "Ekip üyesi limiti", free: "1 kişi", premium: "3 kişi", osgb: "Sınırsız" },
  { feature: "Aylık dosya yükleme kotası", free: "100 MB / ay", premium: "2048 MB / ay", osgb: "Sınırsız" },
  { feature: "Risk değerlendirme kayıtları", free: "3 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "Aylık saha denetimi", free: "5 / ay", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "DÖF / CAPA kayıtları", free: "10 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "ADEP planları", free: "1 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "Yıllık planlar", free: "1 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "Kurul toplantısı kayıtları", free: "2 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "Periyodik kontrol kayıtları", free: "10 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "KKD zimmet ve takip kayıtları", free: "50 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "Sağlık gözetimi kayıtları", free: "50 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "Atama yazısı ve hazır formlar", free: "10 toplam", premium: "Sınırsız", osgb: "Sınırsız" },
  { feature: "Aylık rapor çıktısı", free: "3 / ay", premium: "100 / ay", osgb: "Sınırsız" },
  { feature: "Sertifika / katılım belgesi üretimi", free: "Yok", premium: "100 / ay", osgb: "Sınırsız" },
  { feature: "AI destekli risk üretimi", free: "Yok", premium: "100 / ay", osgb: "Sınırsız" },
  { feature: "AI toplu CAPA analizi", free: "Yok", premium: "100 / ay", osgb: "Sınırsız" },
  { feature: "AI NACE tehlike analizi", free: "Yok", premium: "100 / ay", osgb: "Sınırsız" },
  { feature: "AI tahliye planı üretimi", free: "Yok", premium: "50 / ay", osgb: "Sınırsız" },
  { feature: "AI tahliye görseli üretimi", free: "Yok", premium: "50 / ay", osgb: "Sınırsız" },
  { feature: "Toplu CAPA ve görsel uygunsuzluk analizi", free: "Yok", premium: "Var", osgb: "Var" },
  { feature: "AI kroki / blueprint analizi", free: "Yok", premium: "Var", osgb: "Var" },
  { feature: "ISGBot ve AI danışman asistanı", free: "Yok", premium: "Var", osgb: "Var" },
  { feature: "Özel form oluşturucu", free: "Yok", premium: "Var", osgb: "Var" },
  { feature: "OSGB modülü ve çoklu firma operasyonları", free: "Yok", premium: "Yok", osgb: "Var" },
  { feature: "OSGB dashboard, kapasite, finans ve görev takibi", free: "Yok", premium: "Yok", osgb: "Var" },
  { feature: "İSG-KATİP merkezi ve müşteri portalı", free: "Yok", premium: "Yok", osgb: "Var" },
];
