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
      "1 firmaya kadar kullanım ve 50 çalışan kaydı desteği sunar",
      "Risk değerlendirmesi, denetim, DÖF, acil durum planı ve kurul kayıtları sınırlı olarak kullanılabilir",
      "Ayda 3 rapor çıktısı alma ve 100 MB dosya yükleme hakkı sağlar",
      "Premium yapay zeka araçları, İSGBot, sertifika ve OSGB modülleri bu pakete dahil değildir",
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
      "Yapay zeka destekli analizleri, gelişmiş raporlama araçlarını ve profesyonel doküman üretim özelliklerini aktif kullanan İSG profesyonelleri için.",
    bullets: [
      "Premium yapay zeka araçları, İSGBot, DÖF oluşturma ve kroki/plan analiz araçları dahildir",
      "Sertifika oluşturma, özel form hazırlama ve gelişmiş çıktı alma araçları kullanılabilir",
      "3 firmaya kadar kullanım, sınırsız çalışan kaydı ve 3 ekip üyesi desteği sunar",
      "OSGB operasyon modülü bu pakete dahil değildir",
    ],
    cta: "Premium'a Başla",
    recommended: true,
  },
  {
    title: "OSGB",
    badge: "Çoklu Firma",
    price: "Fiyat yükleniyor",
    period: "/ ay",
    audience: "Birden fazla firmayı yöneten OSGB yapıları",
    description:
      "Premium'un tüm özellikleriyle birlikte çoklu firma, ekip, İSG-KATİP ve OSGB operasyonlarını yöneten yapılar için.",
    bullets: [
      "Premium paketindeki tüm özellikler dahildir",
      "OSGB dashboard, personel, kapasite ve finans ekranları",
      "İSG-KATİP merkezi, müşteri portalı ve çoklu firma takibi",
      "Firma, çalışan, ekip ve depolama limitleri sınırsız",
    ],
    cta: "OSGB Paketini İncele",
    recommended: false,
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
