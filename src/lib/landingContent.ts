import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Bot,
  Boxes, 
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  FolderKanban,
  Layers,
  LayoutDashboard,
  LineChart,
  ShieldAlert,
  Siren,
  Sparkles,
  Target,
  TrendingUp,
  UserCog,
  Users,
  Video,
  Waypoints,
  Workflow,
} from "lucide-react";

/**
 * Navigasyon linkleri
 */
export type MainNavLink = {
  etiket: string;
  url: string;
};

export const anaNavLinkler: MainNavLink[] = [
  { etiket: "Ürün", url: "/landing/product" },
  { etiket: "Özellikler", url: "/landing/features" },
  { etiket: "Süreç Akışı", url: "/landing/flow" },
  { etiket: "Güven", url: "/landing/trust" },
  { etiket: "Fiyatlandırma", url: "/landing/pricing" },
];

/**
 * Kart tipi
 */
export type TanitimKart = {
  baslik: string;
  aciklama: string;
  ikon: LucideIcon;
  rozet?: string;
};

export const degerOnerileri = [
  "Risk, denetim, uygunsuzluk, aksiyon, plan ve rapor akışını tek bir veri omurgasında birleştirir.",
  "Yapay zeka analizleri, saha verisini sadece kaydetmez; tekrarlayan riskleri ve öncelikli müdahale alanlarını öne çıkarır.",
  "Kurumsal ekipler, OSGB yapıları ve çoklu lokasyon operasyonları için izlenebilir ve yönetilebilir bir İSG standardı sunar.",
];

/** Ürün genel görünüm kartları */
export const urunGenelKartlar: TanitimKart[] = [
  {
    baslik: "Merkezi İSG Yönetimi",
    aciklama:
      "Gösterge paneli, riskler, saha denetimleri, uygunsuzluklar, aksiyonlar ve rapor akışı tek bir veri setinde ilerler.",
    ikon: LayoutDashboard,
  },
  {
    baslik: "Yapay Zeka Destekli Karar",
    aciklama:
      "Risk önceliklendirme, bulgu analizi, tekrar tespiti ve akıllı önerilerle karar hızınızı artırın.",
    ikon: Bot,
    rozet: "AI Katmanı",
  },
  {
    baslik: "OSGB Operasyon Merkezi",
    aciklama:
      "Personel, görevlendirme, kapasite, firma, finans ve doküman yönetimini tek panelde sunar.",
    ikon: Briefcase,
    rozet: "B2B Akış",
  },
  {
    baslik: "Belge ve Plan Üretimi",
    aciklama:
      "Acil durum planı, kurul toplantısı, görevlendirme yazıları ve çıktı süreçlerini tek bir dille yönetin.",
    ikon: FileCheck2,
  },
];

/** Ürün modül kartları */
export const urunModulKartlari: TanitimKart[] = [
  {
    baslik: "Risk Değerlendirme",
    aciklama: "Şirket bazlı değerlendirme, risk sihirbazı ve editör.",
    ikon: ShieldAlert,
  },
  {
    baslik: "Dijital Saha Denetimi",
    aciklama: "Saha kayıtları, fotoğraflar, denetim raporları.",
    ikon: ClipboardCheck,
  },
  {
    baslik: "DÖF ve Toplu Analiz",
    aciklama: "Bireysel ve toplu DÖF kayıtları, görsel analiz ve seri aksiyon.",
    ikon: Workflow,
    rozet: "AI Destekli",
  },
  {
    baslik: "Firma ve Çalışan Yönetimi",
    aciklama: "Firma, çalışan, KKD, sağlık ve periyodik kontroller.",
    ikon: Building2,
  },
  {
    baslik: "OSGB Modülü",
    aciklama: "Personel, atama, kapasite, finans, doküman ve analiz.",
    ikon: Users,
    rozet: "Operasyon",
  },
  {
    baslik: "Dokümantasyon Merkezi",
    aciklama: "Sertifikalar, görevlendirme yazıları ve çıktı belgeleri.",
    ikon: FileCheck2,
    rozet: "Kurumsal Çıktı",
  },
];

/**
 * Öne çıkan fonksiyonellik kartları
 */
export const oneCikanOzellikler: TanitimKart[] = [
  {
    baslik: "Dijital Saha Denetimi",
    aciklama:
      "Denetim, gözlem ve fotoğraf kayıtlarını merkezi, hızlı ve izlenebilir şekilde toplayın.",
    ikon: ClipboardCheck,
    rozet: "Operasyon",
  },
  {
    baslik: "Uygunsuzluk ve Aksiyon Takibi",
    aciklama:
      "Sorumluları, terminleri ve kapanış oranlarını tek ekranda takip edin.",
    ikon: Target,
  },
  {
    baslik: "Yapay Zeka Risk Önceliklendirme",
    aciklama:
      "AI risk seviyesi, tekrar olasılığı ve müdahale önceliği tahmini.",
    ikon: Bot,
    rozet: "AI",
  },
  {
    baslik: "Akıllı Aksiyon Önerileri",
    aciklama:
      "Saha verisinden öğrenen öneri kutuları ile çözüm adımlarını hızlandırın.",
    ikon: Sparkles,
  },
  {
    baslik: "Trend ve Tekrar Analizi",
    aciklama:
      "Tekrarlayan sorunları, yüksek risk alanlarını ve gecikmeleri proaktif görün.",
    ikon: TrendingUp,
  },
  {
    baslik: "Yönetici Raporlama Paneli",
    aciklama:
      "Kapanış performansını ve özet metrikleri profesyonel panellerde sunun.",
    ikon: LayoutDashboard,
  },
];

// 3D izometrik süreç dizisi
export const izometrikSurecAdimlari = [
  {
    adim: "01",
    baslik: "Risk Tespiti & Dijital Kayıt",
    aciklama:
      "Tehlikeyi görün ve anında kaydedin. 3D karakterler, mobil entegrasyon ve fiziksel risklerin fotoğraflanması örneği.",
    ikon: ClipboardCheck,
    sahneRef: "scene-risk-detection",
  },
  {
    adim: "02",
    baslik: "Yapay Zeka & Akıllı Analiz",
    aciklama:
      "AI ile tehlike, DÖF önerisi ve önceliklendirme otomasyon akışı.",
    ikon: Bot,
    sahneRef: "scene-ai-analysis",
  },
  {
    adim: "03",
    baslik: "Uygulama & Dijital Eğitim",
    aciklama:
      "Sahada uygulama, eğitim ve görev ataması 3D ortamında modellenir.",
    ikon: Video,
    sahneRef: "scene-implementation-training",
  },
  {
    adim: "04",
    baslik: "Denetim & Şeffaf Raporlama",
    aciklama:
      "Denetimlerin ve raporların şeffaf, onay mekanizmasına sahip ve özet çıktı ile tamamlanması.",
    ikon: LineChart,
    sahneRef: "scene-audit-reporting",
  },
];

/**
 * Güven kartları
 */
export const guvenKartlari: TanitimKart[] = [
  {
    baslik: "Merkezi Kayıt",
    aciklama:
      "Tüm kritik İSG verilerini tek merkezde tutarak dağınıklığın önüne geçin.",
    ikon: FileCheck2,
  },
  {
    baslik: "İzlenebilir Aksiyonlar",
    aciklama:
      "Atanan sorumluluklar ve süreçlerin durumu net şekilde izlenebilir.",
    ikon: Target,
  },
  {
    baslik: "Yetkilendirilmiş Erişim",
    aciklama:
      "Rol, organizasyon ve modül bazlı erişim yönetimi.",
    ikon: ShieldAlert,
  },
  {
    baslik: "KVKK Odaklı Yaklaşım",
    aciklama:
      "Veri işleme, görünürlük ve süreç yönetimi için kurumsal uyumluluk mimarisi.",
    ikon: CheckCircle2,
  },
];

// Güven metriği
export const guvenMetrikleri = [
  { etiket: "Erişim modeli", deger: "Rol bazlı" },
  { etiket: "Süreç görünürlüğü", deger: "Tek panel" },
  { etiket: "Raporlama", deger: "İzlenebilir" },
  { etiket: "Kullanım yapısı", deger: "Firma + ekip" },
];

export const guvenKullanimAlanlari = [
  "Kurum içi İSG ekipleri",
  "OSGB operasyon ekipleri",
  "Birden fazla firma yöneten profesyoneller",
  "Saha denetimi yoğun organizasyonlar",
];

/**
 * Fiyatlandırma ve karşılaştırma
 */
export const fiyatPlanlari = [
  {
    baslik: "Ücretsiz",
    rozet: "Başlangıç",
    fiyat: "₺0",
    aciklama:
      "Temel İSG süreçlerini başlatmak isteyen ekipler için; hızlı ve risksiz giriş.",
    maddeler: [
      "Tek firma ile hızlı başlangıç",
      "Temel risk, denetim ve DÖF akışları",
      "Sınırlı AI kullanımı",
      "Gerçek veriyle ücretsiz deneme",
    ],
    cta: "Panele Git",
    populer: false,
  },
  {
    baslik: "Premium",
    rozet: "Popüler",
    fiyat: "₺250 / ay",
    aciklama:
      "Yapay zeka destekli modülleri ve geniş kapsamı ile aktif operasyonlar için.",
    maddeler: [
      "Toplu analiz ve DÖF",
      "AI asistan & öneriler",
      "Gelişmiş raporlama",
      "Yüksek kullanıcı limiti",
    ],
    cta: "Fiyatlandırmayı İncele",
    populer: true,
  },
  {
    baslik: "OSGB",
    rozet: "Çoklu Firma",
    fiyat: "Özel Fiyat",
    aciklama:
      "Birden fazla firma ve personel yöneten, ileri operasyonel akışları ihtiyacı olan OSGB'ler için.",
    maddeler: [
      "Çoklu firma + atama",
      "Kapasite/finans ekranları",
      "Müşteri portalı",
      "Ölçeklenebilir kurulum",
    ],
    cta: "Teklif Al",
    populer: false,
  },
];

export type KarsilastirmaSatiri = {
  ozellik: string;
  ucretsiz: string;
  premium: string;
  osgb: string;
};

export const fiyatKarsilastirmalari: KarsilastirmaSatiri[] = [
  { ozellik: "Firma yönetimi", ucretsiz: "1 firma", premium: "Var", osgb: "Çoklu firma" },
  { ozellik: "Çalışan yönetimi", ucretsiz: "Kısıtlı", premium: "Var", osgb: "Var" },
  { ozellik: "Risk değerlendirme", ucretsiz: "Kısıtlı", premium: "Var", osgb: "Var" },
  { ozellik: "Dijital saha denetimi", ucretsiz: "Kısıtlı", premium: "Var", osgb: "Var" },
  { ozellik: "DÖF/Aksiyon takibi", ucretsiz: "Var", premium: "Var", osgb: "Var" },
  { ozellik: "Toplu DÖF analizi", ucretsiz: "Yok", premium: "Var", osgb: "Var" },
  { ozellik: "AI destekli öneriler", ucretsiz: "Kısıtlı", premium: "Var", osgb: "Var" },
  { ozellik: "İSG asistanı", ucretsiz: "Yok", premium: "Var", osgb: "Var" },
  { ozellik: "Raporlama/Dışa Akt.", ucretsiz: "Kısıtlı", premium: "Var", osgb: "Var" },
  { ozellik: "OSGB operasyon modülü", ucretsiz: "Yok", premium: "Kısıtlı", osgb: "Var" },
  { ozellik: "Kapasite takibi", ucretsiz: "Yok", premium: "Yok", osgb: "Var" },
  { ozellik: "Müşteri portalı", ucretsiz: "Yok", premium: "Kısıtlı", osgb: "Var" },
];

/**
 * İstatistik örnekleri (Hero)
 */
export type Istatistik = {
  etiket: string;
  deger: string;
  aciklama: string;
  ikon: LucideIcon;
};

export const anaIstatistikler: Istatistik[] = [
  {
    etiket: "AI Risk Skoru",
    deger: "84/100",
    aciklama: "Kritik alanları hızlıca görün.",
    ikon: Boxes,
  },
  {
    etiket: "Kritik Uygunsuzluk",
    deger: "17",
    aciklama: "Öncelikli aksiyonları ayırın.",
    ikon: AlertTriangle,
  },
  {
    etiket: "Tamamlanan Denetim",
    deger: "%92",
    aciklama: "Süreç performansını izleyin.",
    ikon: TrendingUp,
  },
  {
    etiket: "Akıllı Öneri",
    deger: "9",
    aciklama: "Geciken aksiyonları yönetin.",
    ikon: BellRing,
  },
];

/**
 * Sık Gösterilen Problemler
 */
export type Problem = {
  baslik: string;
  aciklama: string;
  ikon: LucideIcon;
};

export const cozumlenenProblemler: Problem[] = [
  {
    baslik: "Denetim notları farklı yerlerde",
    aciklama: "Saha bulguları dosya/mesaj/veri arasında dağınık olabiliyor.",
    ikon: ClipboardCheck,
  },
  {
    baslik: "Takip kişilere bağımlı",
    aciklama: "Aksiyon-takibi merkezi ilerlemediğinde süreç kırılabiliyor.",
    ikon: Target,
  },
  {
    baslik: "Çalışan evrakları dağınık",
    aciklama: "Havuz yönetimi yerine dosya usulü ilerlemek kontrolü zorlaştırır.",
    ikon: FileSpreadsheet,
  },
  {
    baslik: "Kurul/risk süreçleri güncelliğini kaybediyor",
    aciklama: "Birden fazla dosyada yürütülen operasyon güncel kalmıyor.",
    ikon: AlertTriangle,
  },
  {
    baslik: "Raporlama yavaş",
    aciklama: "Veri merkezi değilse, rapor hazırlığı operasyon yükü oluşturuyor.",
    ikon: FolderKanban,
  },
];

/**
 * Çözüm Alanı Kartları
 */
export const cozumKartlari: TanitimKart[] = [
  {
    baslik: "Denetim Yönetimi",
    aciklama: "Saha kontrolleri, uygunsuzluk ve aksiyonları tek akışta toplar.",
    ikon: ClipboardCheck,
  },
  {
    baslik: "Çalışan Yönetimi",
    aciklama: "Ortak havuz, toplu excel/durum takibi.",
    ikon: UserCog,
  },
  {
    baslik: "Kurul ve Evrak Süreçleri",
    aciklama: "Kurul, atama ve dokümantasyon akışlarını merkezileştirir.",
    ikon: FileCheck2,
  },
  {
    baslik: "Risk ve Acil Durum",
    aciklama: "Risk sihirbazı, acil durum planı ve kritik aksiyon yönetimi.",
    ikon: Siren,
  },
];

/**
 * Ayak menüsü: SEO ve navigasyon için link nesneleri!
 */
export const landingFooterGroups = [
  {
    title: "Ürün",
    links: [
      { name: "Risk Intelligence", href: "/product" },
      { name: "Saha Denetimleri", href: "/features/saha-denetim" },
      { name: "Aksiyon Takibi", href: "/features/aksiyon" },
      { name: "Raporlama", href: "/features/raporlama" },
    ],
  },
  {
    title: "Modüller",
    links: [
      { name: "Kurul Toplantıları", href: "/modules/kurul" },
      { name: "Atama Yazıları", href: "/modules/atama" },
      { name: "İş Kazası Süreçleri", href: "/modules/kaza" },
      { name: "Acil Durum Planı", href: "/modules/acil-durum" },
    ],
  },
  {
    title: "İletişim",
    links: [
      { name: "Firma Girişi", href: "/girisyap" },
      { name: "Destek", href: "/support" },
      { name: "info@isgvizyon.com", href: "mailto:info@isgvizyon.com" },
      { name: "www.isgvizyon.com", href: "https://www.isgvizyon.com" },
    ],
  },
  {
    title: "Yasal",
    links: [
      { name: "KVKK", href: "/kvkk" },
      { name: "Gizlilik", href: "/gizlilik" },
      { name: "Çerez Tercihleri", href: "/cookies" },
      { name: "Kullanım Koşulları", href: "/terms" },
    ],
  },
];