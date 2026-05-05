import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  ShieldAlert,
  Siren,
  Sparkles,
  Target,
  TrendingUp,
  UserCog,
  Users,
  Waypoints,
  Workflow,
} from "lucide-react";

export type LandingNavLink = {
  label: string;
  path: string;
};

export const landingNavLinks: LandingNavLink[] = [
  { label: "Ürün", path: "/landing/product" },
  { label: "Özellikler", path: "/landing/features" },
  { label: "Akış", path: "/landing/flow" },
  { label: "Güven", path: "/landing/trust" },
  { label: "Fiyatlandırma", path: "/landing/pricing" },
];

export type LandingCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
};

export const landingValueProps = [
  "Risk, denetim, uygunsuzluk, aksiyon, plan ve rapor akışını tek veri omurgasında birleştirir.",
  "Yapay zeka destekli analizler saha verisini yalnızca kaydetmez; tekrar eden riskleri ve öncelikli müdahale alanlarını görünür kılar.",
  "Kurumsal ekipler, OSGB yapıları ve çok lokasyonlu operasyonlar için ölçülebilir, izlenebilir ve yönetilebilir bir İSG standardı oluşturur.",
];

export const productOverviewCards: LandingCard[] = [
  {
    title: "Tek omurgada İSG yönetimi",
    description:
      "Gösterge paneli, riskler, saha denetimleri, uygunsuzluklar, aksiyonlar ve rapor akışı aynı veri yapısında ilerler.",
    icon: LayoutDashboard,
  },
  {
    title: "Yapay zeka destekli karar katmanı",
    description:
      "Risk önceliklendirme, bulgu yorumlama, tekrar analizi ve akıllı öneri akışlarıyla ekiplerin karar hızını artırır.",
    icon: Bot,
    badge: "AI Katmanı",
  },
  {
    title: "OSGB operasyon merkezi",
    description:
      "Personel, görevlendirme, kapasite, firma, finans ve doküman yönetimi tek panelde toplanır.",
    icon: Briefcase,
    badge: "B2B Akış",
  },
  {
    title: "Belge ve plan üretimi",
    description:
      "Acil durum planı, kurul toplantısı, görevlendirme yazıları, sertifikalar ve çıktı süreçleri aynı kurumsal dilde yönetilir.",
    icon: FileCheck2,
  },
];

export const productModuleCards: LandingCard[] = [
  {
    title: "Risk değerlendirme",
    description: "Risk sihirbazı, editör ve kayıt listesi ile şirket bazlı değerlendirme akışı.",
    icon: ShieldAlert,
  },
  {
    title: "Dijital saha denetimleri",
    description: "Saha kayıtları, uygunsuzluklar, fotoğraflar, takip notları ve denetim raporları.",
    icon: ClipboardCheck,
  },
  {
    title: "DÖF ve toplu analiz",
    description: "Tekil DÖF kaydı yanında toplu görsel analiz ve seri aksiyon üretimi.",
    icon: Workflow,
    badge: "AI Destekli",
  },
  {
    title: "Firma ve çalışan yönetimi",
    description: "Firma, çalışan, KKD, sağlık gözetimi ve periyodik kontrol kayıtları.",
    icon: Building2,
  },
  {
    title: "OSGB modülü",
    description: "Personel, görevlendirme, kapasite, finans, doküman, görev ve analitik ekranları.",
    icon: Users,
    badge: "Operasyon",
  },
  {
    title: "Dokümantasyon merkezi",
    description: "Sertifikalar, görevlendirme yazıları, rapor çıktıları ve plan dokümanları.",
    icon: FileCheck2,
    badge: "Kurumsal Çıktı",
  },
];

export const featureHighlightCards: LandingCard[] = [
  {
    title: "Dijital saha denetimleri",
    description:
      "Denetim, gözlem, fotoğraf ve saha kayıtlarını merkezi, hızlı ve izlenebilir bir yapıda toplayın.",
    icon: ClipboardCheck,
    badge: "Operasyon",
  },
  {
    title: "Uygunsuzluk ve aksiyon takibi",
    description:
      "Sorumluları, termin tarihlerini ve kapanış oranlarını tek ekranda yönetin.",
    icon: Target,
  },
  {
    title: "AI risk önceliklendirme",
    description:
      "Yapay zeka, risk seviyesi, tekrar olasılığı ve müdahale önceliğini analiz ederek yön verir.",
    icon: Bot,
    badge: "AI",
  },
  {
    title: "Akıllı aksiyon önerileri",
    description:
      "Benzer saha kayıtlarından öğrenen öneri kutuları ile çözüm adımlarını hızlandırın.",
    icon: Sparkles,
  },
  {
    title: "Trend ve tekrar analizi",
    description:
      "Tekrarlayan problemleri, yüksek riskli alanları ve gecikme eğilimlerini erken görün.",
    icon: TrendingUp,
  },
  {
    title: "Yönetici raporlama paneli",
    description:
      "Yönetim için özet, metrik ve kapanış performansını profesyonel dashboard’larda sunun.",
    icon: LayoutDashboard,
  },
];

export const workflowSteps = [
  {
    step: "01",
    title: "Saha verisini toplayın",
    description:
      "Denetim, uygunsuzluk, fotoğraf ve gözlem kayıtlarını dijital olarak toplayın.",
  },
  {
    step: "02",
    title: "AI ile analiz edin",
    description:
      "Yapay zeka risk seviyelerini, tekrar eden problemleri ve öncelikli alanları analiz eder.",
  },
  {
    step: "03",
    title: "Aksiyonları atayın",
    description:
      "Sorumluları, terminleri ve aksiyon planlarını merkezi olarak yönetin.",
  },
  {
    step: "04",
    title: "Sonuçları izleyin",
    description:
      "Dashboard üzerinden risk trendlerini, kapanma sürelerini ve performansı takip edin.",
  },
];

export const trustCards: LandingCard[] = [
  {
    title: "Merkezi kayıt",
    description:
      "Kritik İSG verilerini tek sistemde toplayarak dağınık kayıt riskini azaltın.",
    icon: FileCheck2,
  },
  {
    title: "İzlenebilir aksiyonlar",
    description:
      "Atanan sorumlular, terminler ve tamamlanma durumu tek akışta görünür kalır.",
    icon: Target,
  },
  {
    title: "Yetkilendirilmiş erişim",
    description:
      "Rol, organizasyon ve modül seviyesinde kontrollü erişim modeliyle ilerler.",
    icon: ShieldAlert,
  },
  {
    title: "KVKK odaklı yaklaşım",
    description:
      "Veri işleme, görünürlük ve süreç yönetimi kurumsal sorumlulukları destekleyecek şekilde tasarlanır.",
    icon: CheckCircle2,
  },
];

export const trustMetrics = [
  { label: "Erişim modeli", value: "Rol bazlı" },
  { label: "Süreç görünürlüğü", value: "Tek panel" },
  { label: "Raporlama", value: "İzlenebilir" },
  { label: "Kullanım yapısı", value: "Firma + ekip" },
];

export const trustUseCases = [
  "Kurum içi İSG ekipleri",
  "OSGB operasyon ekipleri",
  "Birden fazla firma yöneten profesyoneller",
  "Saha denetimi yoğun yapılar",
];

export const pricingPlans = [
  {
    title: "Ücretsiz",
    badge: "Başlangıç",
    price: "₺0",
    description:
      "Temel İSG süreçlerini başlatmak ve platformu kontrollü şekilde denemek isteyen ekipler için.",
    bullets: [
      "Tek firma ile hızlı başlangıç",
      "Temel risk, denetim ve DÖF akışları",
      "Sınırlı yapay zeka kullanımı",
      "Platformu gerçek veriyle deneme imkanı",
    ],
    cta: "Panele Git",
    recommended: false,
  },
  {
    title: "Premium",
    badge: "Popüler",
    price: "₺250 / ay",
    description:
      "Yapay zeka destekli analizleri ve yüksek kullanım limitlerini aktif operasyonlarında kullanan ekipler için.",
    bullets: [
      "Toplu DÖF ve plan analizi",
      "İSG asistanı ve akıllı öneriler",
      "Gelişmiş raporlama ve dışa aktarma",
      "Daha yüksek kullanıcı ve işlem limitleri",
    ],
    cta: "Fiyatlandırmayı İncele",
    recommended: true,
  },
  {
    title: "OSGB",
    badge: "Çoklu Firma",
    price: "Özel planlama",
    description:
      "Birden fazla firmayı, personeli ve operasyon akışını tek merkezden yöneten OSGB yapıları için.",
    bullets: [
      "Çoklu firma ve görevlendirme akışları",
      "OSGB personel, kapasite ve finans ekranları",
      "Müşteri portalı ve doküman yönetimi",
      "Operasyon modeline göre ölçeklenebilir kurulum",
    ],
    cta: "Firma Girişi",
    recommended: false,
  },
];

export type PricingComparisonValue = "Var" | "Kısıtlı" | "Yok" | string;

export type PricingComparisonRow = {
  feature: string;
  free: PricingComparisonValue;
  premium: PricingComparisonValue;
  osgb: PricingComparisonValue;
};

export const pricingComparisonRows: PricingComparisonRow[] = [
  { feature: "Firma yönetimi", free: "1 firma", premium: "Var", osgb: "Çoklu firma" },
  { feature: "Çalışan yönetimi", free: "Kısıtlı", premium: "Var", osgb: "Var" },
  { feature: "Risk değerlendirme", free: "Kısıtlı", premium: "Var", osgb: "Var" },
  { feature: "Dijital saha denetimi", free: "Kısıtlı", premium: "Var", osgb: "Var" },
  { feature: "DÖF ve aksiyon takibi", free: "Var", premium: "Var", osgb: "Var" },
  { feature: "Toplu DÖF analizi", free: "Yok", premium: "Var", osgb: "Var" },
  { feature: "Yapay zeka destekli öneriler", free: "Kısıtlı", premium: "Var", osgb: "Var" },
  { feature: "İSG asistanı", free: "Yok", premium: "Var", osgb: "Var" },
  { feature: "Raporlama ve dışa aktarma", free: "Kısıtlı", premium: "Var", osgb: "Var" },
  { feature: "OSGB operasyon modülü", free: "Yok", premium: "Kısıtlı", osgb: "Var" },
  { feature: "Görevlendirme ve kapasite takibi", free: "Yok", premium: "Yok", osgb: "Var" },
  { feature: "Müşteri portalı", free: "Yok", premium: "Kısıtlı", osgb: "Var" },
];

export type LandingStat = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

export const landingHeroStats: LandingStat[] = [
  {
    label: "AI Risk Skoru",
    value: "84/100",
    hint: "Kritik alanları hızlıca görün.",
    icon: LayoutDashboard,
  },
  {
    label: "Kritik Uygunsuzluk",
    value: "17",
    hint: "Öncelikli aksiyonları ayırın.",
    icon: AlertTriangle,
  },
  {
    label: "Tamamlanan Denetim",
    value: "%92",
    hint: "Süreç performansını izleyin.",
    icon: TrendingUp,
  },
  {
    label: "Akıllı Öneri",
    value: "9",
    hint: "Geciken aksiyonları yönetin.",
    icon: BellRing,
  },
];

export type ProblemItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const landingProblemItems: ProblemItem[] = [
  {
    title: "Denetim notları farklı yerlerde kalıyor",
    description: "Saha bulguları dosyalar, mesajlar ve kişisel notlar arasında dağınık kalabiliyor.",
    icon: ClipboardCheck,
  },
  {
    title: "Uygunsuzluk takibi kişilere bağlı ilerliyor",
    description: "Termin, sorumlu ve aksiyon takibi merkezi ilerlemeyince süreçler kırılabiliyor.",
    icon: Target,
  },
  {
    title: "Çalışan evrakları dağınık tutuluyor",
    description: "Firma bazlı çalışan havuzu yerine ayrı dosyalarla ilerlemek kontrolü zorlaştırıyor.",
    icon: FileSpreadsheet,
  },
  {
    title: "Kurul, acil durum ve risk süreçleri güncelliğini kaybediyor",
    description: "Aynı operasyon birden fazla dosyada yürüdüğünde güncel durum kolayca kayboluyor.",
    icon: AlertTriangle,
  },
  {
    title: "Yönetici raporu gerektiğinde veri toplamak zaman alıyor",
    description: "Veri merkezi değilse rapor hazırlığı operasyon yüküne dönüşüyor.",
    icon: FolderKanban,
  },
];

export const landingSolutionCards: LandingCard[] = [
  {
    title: "Denetim Yönetimi",
    description: "Saha kontrolleri, uygunsuzluklar, aksiyonlar ve takip süreçlerini tek akışta toplar.",
    icon: ClipboardCheck,
  },
  {
    title: "Çalışan Yönetimi",
    description: "Firma bazlı çalışan havuzu, aktif/pasif durum takibi ve toplu Excel işlemleri sunar.",
    icon: UserCog,
  },
  {
    title: "Kurul ve Evrak Süreçleri",
    description: "Kurul toplantıları, atama yazıları ve dokümantasyon akışlarını merkezileştirir.",
    icon: FileCheck2,
  },
  {
    title: "Risk ve Acil Durum",
    description: "Risk sihirbazı, acil durum planları ve kritik aksiyon yönetimini aynı panelde toplar.",
    icon: Siren,
  },
];

export type ProductScreenTab = {
  id: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  stats: { label: string; value: string }[];
  panelTitle: string;
  panelSubtitle: string;
  panelRows: { label: string; value: string; tone?: "primary" | "success" | "warning" }[];
};

export const landingProductScreenTabs: ProductScreenTab[] = [
  {
    id: "operations",
    label: "Risk Intelligence",
    title: "Riskleri yalnızca listelemeyin, önceliklendirin",
    description:
      "Dashboard, tekrar eden bulguları, yüksek riskli alanları ve kapanması geciken aksiyonları yöneticiler için okunabilir hale getirir.",
    bullets: [
      "AI risk skoru ve öncelik görünümü",
      "Kritik saha aksiyon listesi",
      "Yöneticiler için okunabilir özet kartlar",
    ],
    stats: [
      { label: "AI Risk Skoru", value: "84/100" },
      { label: "Kritik DÖF", value: "17" },
      { label: "Geciken aksiyon", value: "9" },
    ],
    panelTitle: "İSGVizyon Risk Intelligence Paneli",
    panelSubtitle: "Günün en kritik sinyalleri",
    panelRows: [
      { label: "Yüksek riskli alan", value: "04", tone: "warning" },
      { label: "Akıllı öneri", value: "09", tone: "primary" },
      { label: "Kapanan iş", value: "32", tone: "success" },
    ],
  },
  {
    id: "employees",
    label: "Saha ve Ekip",
    title: "Firma ve ekip akışını tek operasyon görünümüne bağlayın",
    description:
      "Çalışan, firma ve saha akışları ayrı listeler olarak değil; aksiyon takibini besleyen ortak operasyon verisi olarak ilerler.",
    bullets: [
      "Firma bazlı çalışan görünümü",
      "Evrak ve durum takibi",
      "Operasyonel sorumluluk eşleştirmesi",
    ],
    stats: [
      { label: "Aktif firma", value: "12" },
      { label: "Bekleyen evrak", value: "11" },
      { label: "Sorumlu atama", value: "27" },
    ],
    panelTitle: "Operasyon ve Ekip Akışı",
    panelSubtitle: "Sahadan merkeze görünürlük",
    panelRows: [
      { label: "Yeni kayıt", value: "19", tone: "success" },
      { label: "Açık görev", value: "14", tone: "primary" },
      { label: "Kritik gecikme", value: "03", tone: "warning" },
    ],
  },
  {
    id: "inspections",
    label: "Denetim ve DÖF",
    title: "Bulguyu kayıttan aksiyona taşıyan akış",
    description:
      "Fotoğraf, uygunsuzluk, DÖF ve sorumlu ataması aynı ekran mantığıyla ilerler; denetim sonrası takip dağılmaz.",
    bullets: [
      "Fotoğraflı bulgu akışı",
      "DÖF ve sorumlu eşleştirmesi",
      "Termin ve kapanış takibi",
    ],
    stats: [
      { label: "Bu ay denetim", value: "42" },
      { label: "Açık uygunsuzluk", value: "17" },
      { label: "Kapanış oranı", value: "%81" },
    ],
    panelTitle: "Denetim Akışı",
    panelSubtitle: "Bulgu, aksiyon ve sonuç",
    panelRows: [
      { label: "Yeni bulgu", value: "08", tone: "warning" },
      { label: "Atanan sorumlu", value: "17", tone: "primary" },
      { label: "Tamamlanan iş", value: "29", tone: "success" },
    ],
  },
  {
    id: "risk",
    label: "Raporlama",
    title: "Yönetici raporlarını sonradan değil, süreç içinde üretin",
    description:
      "Risk değerlendirme, acil durum, denetim ve aksiyon verileri aynı akışta tutulduğu için raporlama daha hızlı ve daha güvenilir hale gelir.",
    bullets: [
      "Kurumsal çıktı mantığı",
      "Excel / CSV dışa aktarma",
      "Karar destekli yönetici görünümü",
    ],
    stats: [
      { label: "Hazır şablon", value: "40+" },
      { label: "Aktif rapor", value: "12" },
      { label: "Trend görünümü", value: "Canlı" },
    ],
    panelTitle: "Raporlama ve Yönetim",
    panelSubtitle: "İzlenebilir çıktı yapısı",
    panelRows: [
      { label: "Hazır özet", value: "06", tone: "primary" },
      { label: "Yüksek risk", value: "05", tone: "warning" },
      { label: "Tamamlanan süreç", value: "21", tone: "success" },
    ],
  },
];

export type FeatureGroup = {
  title: string;
  icon: LucideIcon;
  items: string[];
};

export const landingFeatureGroups: FeatureGroup[] = [
  {
    title: "Dijital Saha Denetimleri",
    icon: Waypoints,
    items: ["Mobil uyumlu denetim akışı", "Fotoğraf ve gözlem kaydı", "Hızlı saha notları", "Planlı denetim görünümü"],
  },
  {
    title: "Uygunsuzluk ve Aksiyon Takibi",
    icon: Target,
    items: ["Sorumlu ve termin atama", "Açık / kapalı aksiyon görünümü", "Geciken iş takibi", "Merkezi iş listesi"],
  },
  {
    title: "AI Risk Önceliklendirme",
    icon: Sparkles,
    items: ["Risk skoru görünümü", "Tekrar eden problem tespiti", "Öncelik sıralama", "Veri temelli yorumlama"],
  },
  {
    title: "Yönetici Raporlama Paneli",
    icon: Activity,
    items: ["Trend ve tekrar analizi", "Firma bazlı görünüm", "CSV / Excel dışa aktarma", "Karar destek özeti"],
  },
];

export type AudienceItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const landingAudienceItems: AudienceItem[] = [
  {
    title: "OSGB firmaları",
    description: "Birden fazla firmayı, personeli ve hizmet akışını tek panelden izlemek isteyen ekipler için.",
    icon: Briefcase,
  },
  {
    title: "İnşaat ve şantiye ekipleri",
    description: "Saha denetimlerini, aksiyonları ve çalışan akışını merkezi görmek isteyen yapılar için.",
    icon: Building2,
  },
  {
    title: "Çok lokasyonlu işletmeler",
    description: "Farklı saha ve firma kayıtlarını tek operasyon modeliyle yürütmek isteyen kurumlar için.",
    icon: FolderKanban,
  },
  {
    title: "İSG uzmanları",
    description: "Risk, denetim, kurul ve belge süreçlerini tek merkezde toplamak isteyen profesyoneller için.",
    icon: ShieldAlert,
  },
  {
    title: "İnsan kaynakları ekipleri",
    description: "Çalışan kayıtları, evrak akışı ve durum görünürlüğünü daha düzenli tutmak isteyen ekipler için.",
    icon: UserCog,
  },
  {
    title: "Operasyon ve yönetim ekipleri",
    description: "Yönetici görünürlüğü, raporlama ve termin takibi ile karar hızını artırmak isteyen yapılar için.",
    icon: TrendingUp,
  },
];

export const landingTrustPoints = [
  "Merkezi kayıt",
  "İzlenebilir aksiyonlar",
  "Yetkilendirilmiş erişim",
  "KVKK odaklı yaklaşım",
  "Raporlanabilir süreçler",
  "Karar desteği",
];

export const landingFooterGroups = [
  {
    title: "Ürün",
    links: ["Risk Intelligence", "Saha Denetimleri", "Aksiyon Takibi", "Raporlama"],
  },
  {
    title: "Modüller",
    links: ["Kurul Toplantıları", "Atama Yazıları", "İş Kazası Süreçleri", "Acil Durum Planı"],
  },
  {
    title: "İletişim",
    links: ["Firma Girişi", "Destek", "info@isgvizyon.com", "www.isgvizyon.com"],
  },
  {
    title: "Yasal",
    links: ["KVKK", "Gizlilik", "Çerez Tercihleri", "Kullanım Koşulları"],
  },
];
