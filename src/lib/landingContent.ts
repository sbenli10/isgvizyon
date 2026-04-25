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
  "Risk, denetim, düzeltici ve önleyici faaliyet, plan ve belge süreçlerini tek yapıda toplar.",
  "Yapay zeka destekli modüllerle değerlendirme süresini azaltır ve saha kararlarını hızlandırır.",
  "Ücretsiz plan ile başlanır, profesyonel plan ile gelişmiş modüller ve yüksek limitler açılır.",
];

export const productOverviewCards: LandingCard[] = [
  {
    title: "Tek omurgada İSG yönetimi",
    description:
      "Gösterge paneli, risk, denetim, düzeltici ve önleyici faaliyet, rapor ve belge akışı aynı veri yapısında ilerler.",
    icon: LayoutDashboard,
  },
  {
    title: "Yapay zeka destekli hız katmanı",
    description:
      "Toplu düzeltici faaliyet analizi, faaliyet sınıfı analizi, tahliye üretimi ve İSG asistanı gibi akıllı yardımcılar profesyonel planda çalışır.",
    icon: Bot,
    badge: "Profesyonel",
  },
  {
    title: "OSGB operasyon merkezi",
    description:
      "Personel, görevlendirme, kapasite, şirket, finans ve doküman modülleri tek panelde toplanır.",
    icon: Briefcase,
    badge: "Profesyonel",
  },
  {
    title: "Belge ve plan üretimi",
    description:
      "Acil durum planı, yıllık plan, görevlendirme yazısı, sertifika ve rapor süreçleri aynı kurumsal dilde yönetilir.",
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
    title: "Denetim ve bulgu takibi",
    description: "Saha kayıtları, uygunsuzluklar, takip notları ve denetim raporları.",
    icon: ClipboardCheck,
  },
  {
    title: "DÖF ve toplu analiz",
    description: "Tekil DÖF kaydı yanında toplu görsel analiz ve seri aksiyon üretimi.",
    icon: Workflow,
    badge: "Profesyonel",
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
    badge: "Profesyonel",
  },
  {
    title: "Sertifika ve belge merkezi",
    description: "Sertifika üretimi, geçmiş görünümü, görevlendirme yazıları ve rapor akışı.",
    icon: FileCheck2,
    badge: "Kısmen Profesyonel",
  },
];

export const featureHighlightCards: LandingCard[] = [
  {
    title: "Toplu DÖF analizi",
    description:
      "Çoklu görsel üzerinden uygunsuzluk analizi, risk yorumu ve toplu DÖF akışı üretir.",
    icon: Sparkles,
    badge: "Profesyonel",
  },
  {
    title: "Yerleşim planı analizi",
    description:
      "Plan, kroki ve yerleşim görsellerini yorumlayarak gelişmiş analiz ekranı sunar.",
    icon: Sparkles,
    badge: "Profesyonel",
  },
  {
    title: "İSG asistanı",
    description:
      "Hızlı yorum, öneri ve yardımcı akışlarla operasyon kararlarını destekler.",
    icon: Bot,
    badge: "Profesyonel",
  },
  {
    title: "Faaliyet sınıfı analizi",
    description:
      "NACE sorgulama ve sektör bazlı öneri akışlarını daha hızlı hale getirir.",
    icon: Sparkles,
  },
  {
    title: "Tahliye üretimi",
    description:
      "Tahliye planı ve tahliye görseli üretimiyle kritik senaryo kurgusunu hızlandırır.",
    icon: Workflow,
    badge: "Profesyonel",
  },
  {
    title: "Bildirim görünürlüğü",
    description:
      "Yaklaşan işler, açık görevler ve kritik operasyon baskısını görünür tutar.",
    icon: BellRing,
  },
];

export const workflowSteps = [
  {
    step: "01",
    title: "Temel kayıtları kurun",
    description:
      "Firma, çalışan, KKD, sağlık gözetimi ve temel operasyon kayıtları platforma alınır.",
  },
  {
    step: "02",
    title: "Risk ve denetim akışını işletin",
    description:
      "Risk değerlendirme, denetim, DÖF, rapor ve bildirim akışı günlük operasyon omurgasını oluşturur.",
  },
  {
    step: "03",
    title: "Belge ve plan katmanını ekleyin",
    description:
      "Acil durum planı, yıllık plan, görevlendirme yazıları ve rapor çıktıları tek noktadan yönetilir.",
  },
  {
    step: "04",
    title: "Gelişmiş modüllerle ölçekleyin",
    description:
      "Toplu DÖF analizi, yerleşim planı analizi, sertifikalar, İSG asistanı ve OSGB modülü ile ekip büyürken kontrol kaybedilmez.",
  },
];

export const trustCards: LandingCard[] = [
  {
    title: "Rol bazlı erişim ve koruma",
    description:
      "Korunan sayfa yapısı, organizasyon bazlı plan yönetimi ve profesyonel erişim kontrolü birlikte çalışır.",
    icon: ShieldAlert,
  },
  {
    title: "KVKK ve veri talepleri altyapısı",
    description:
      "Gizlilik politikası, veri talep kayıtları ve rıza alanları için veritabanı altyapısı hazırdır.",
    icon: CheckCircle2,
  },
  {
    title: "Sunucu taraflı yapay zeka mimarisi",
    description:
      "AI çağrıları tarayıcıdan değil, kontrollü sunucu katmanından yürütülür.",
    icon: Sparkles,
  },
  {
    title: "Abonelik ve deneme kontrolü",
    description:
      "Ücretsiz, profesyonel ve deneme üyelikleri plan ve limit bazlı izlenir.",
    icon: BellRing,
  },
];

export const trustMetrics = [
  { label: "Çekirdek modül kümesi", value: "20+" },
  { label: "Operasyon görünürlüğü", value: "Tek panel" },
  { label: "Dışa aktarma", value: "Excel / CSV" },
  { label: "Kullanım modeli", value: "Firma + ekip" },
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
    description:
      "Temel İSG süreçlerini gerçek verilerle başlatmak ve sistemi kontrollü denemek isteyen ekipler için.",
    bullets: [
      "1 firma yönetimi",
      "25 çalışan limiti",
      "3 risk değerlendirme kaydı",
      "Aylık 10 denetim",
      "Sınırlı yapay zeka ve dışa aktarma kapasitesi",
    ],
    cta: "Ücretsiz planla başla",
    recommended: false,
  },
  {
    title: "Profesyonel",
    badge: "Avantajlı fiyat",
    description:
      "Yapay zeka modülleri, yüksek limitler ve gelişmiş operasyon ekranlarını aktif kullanmak isteyen ekipler için.",
    bullets: [
      "₺250 / ay",
      "7 günlük profesyonel deneme",
      "Toplu DÖF analizi, yerleşim planı analizi ve İSG asistanı",
      "Sertifika ve OSGB modülü",
      "Yüksek yapay zeka kotaları ve daha geniş limitler",
    ],
    cta: "Profesyonel planı incele",
    recommended: true,
  },
  {
    title: "Kurumsal",
    badge: "Planlı geçiş",
    description:
      "Çok ekipli veya çok firmalı yapılarda onboarding, kullanım modeli ve geçiş planını birlikte netleştirmek için.",
    bullets: [
      "Profesyonel plan omurgası üzerine kurulur",
      "Ekip ve süreç yapısına göre planlama",
      "Geçiş ve onboarding odaklı kurulum",
      "Kurumsal görüşme ile netleştirilir",
    ],
    cta: "Kurumsal görüşme talep et",
    recommended: false,
  },
];

export type LandingStat = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

export const landingHeroStats: LandingStat[] = [
  {
    label: "Operasyon görünürlüğü",
    value: "Tek panel",
    hint: "Dağınık kayıtları tek merkezde toplayın.",
    icon: LayoutDashboard,
  },
  {
    label: "Çalışan akışı",
    value: "Firma bazlı",
    hint: "Aktif/pasif çalışan takibini merkezileştirin.",
    icon: Users,
  },
  {
    label: "Raporlama",
    value: "İzlenebilir",
    hint: "Yönetici görünürlüğünü artırın.",
    icon: TrendingUp,
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
    label: "Operasyon Merkezi",
    title: "Günlük operasyonu tek ekranda görün",
    description:
      "Açık aksiyonları, kritik işleri, yaklaşan denetimleri ve ekip baskısını tek merkezden takip edin.",
    bullets: [
      "Öncelikli aksiyon görünümü",
      "Firma ve ekip bazlı takip",
      "Bildirim ve durum görünürlüğü",
    ],
    stats: [
      { label: "Açık aksiyon", value: "24" },
      { label: "Kritik iş", value: "6" },
      { label: "Aktif firma", value: "18" },
    ],
    panelTitle: "Operasyon Merkezi",
    panelSubtitle: "Bugün öne çıkan başlıklar",
    panelRows: [
      { label: "Kritik denetimler", value: "06", tone: "warning" },
      { label: "Termin yaklaşan işler", value: "14", tone: "primary" },
      { label: "Tamamlanan görevler", value: "32", tone: "success" },
    ],
  },
  {
    id: "employees",
    label: "Çalışan Yönetimi",
    title: "Firma bazlı çalışan havuzunu tek yerde yönetin",
    description:
      "Çalışan kayıtlarını, aktif/pasif durumlarını ve toplu içe aktarma süreçlerini düzenli tutun.",
    bullets: [
      "Firma bazlı çalışan görünümü",
      "Toplu Excel/CSV içe aktarma",
      "Aktif ve pasif ayrımı",
    ],
    stats: [
      { label: "Toplam çalışan", value: "1.248" },
      { label: "Pasif kayıt", value: "38" },
      { label: "Excel eşleşme", value: "%99" },
    ],
    panelTitle: "Çalışan Havuzu",
    panelSubtitle: "Kayıt akışı",
    panelRows: [
      { label: "Bugün eklenen", value: "19", tone: "success" },
      { label: "Evrak bekleyen", value: "11", tone: "warning" },
      { label: "Şirket filtresi", value: "12 firma", tone: "primary" },
    ],
  },
  {
    id: "inspections",
    label: "Denetimler",
    title: "Saha bulgularını aksiyona dönüştürün",
    description:
      "Denetim notlarını, uygunsuzlukları ve sorumlu atamalarını izlenebilir bir akışta toplayın.",
    bullets: [
      "Bulgu ve DÖF eşleştirme",
      "Termin ve sorumlu takibi",
      "Yönetici görünürlüğü",
    ],
    stats: [
      { label: "Bu ay denetim", value: "42" },
      { label: "Açık uygunsuzluk", value: "17" },
      { label: "Kapanış oranı", value: "%81" },
    ],
    panelTitle: "Denetim Takibi",
    panelSubtitle: "Saha akışı",
    panelRows: [
      { label: "Yeni bulgular", value: "08", tone: "warning" },
      { label: "Atanan sorumlular", value: "17", tone: "primary" },
      { label: "Kapanan kayıtlar", value: "29", tone: "success" },
    ],
  },
  {
    id: "risk",
    label: "Risk Sihirbazı",
    title: "Risk süreçlerini yaşayan bir kayıt sistemine taşıyın",
    description:
      "Risk değerlendirme, aksiyon planı ve dokümantasyon akışını aynı operasyon yapısında yönetin.",
    bullets: [
      "Sektör ve şablon bazlı başlangıç",
      "Maddeler üzerinde düzenlenebilir akış",
      "Raporlama ve dışa aktarma",
    ],
    stats: [
      { label: "Açık risk planı", value: "12" },
      { label: "Yüksek risk", value: "5" },
      { label: "Hazır şablon", value: "40+" },
    ],
    panelTitle: "Risk Yönetimi",
    panelSubtitle: "Öncelikli maddeler",
    panelRows: [
      { label: "Kritik risk", value: "05", tone: "warning" },
      { label: "Gözden geçirme", value: "09", tone: "primary" },
      { label: "Kapatılan aksiyon", value: "21", tone: "success" },
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
    title: "Operasyon",
    icon: Waypoints,
    items: ["Görev takibi", "Denetim planlama", "Saha aksiyonları", "Durum takibi"],
  },
  {
    title: "Çalışan",
    icon: Users,
    items: ["Çalışan havuzu", "Firma bazlı filtreleme", "Aktif/pasif durum", "Excel import/export"],
  },
  {
    title: "İSG Süreçleri",
    icon: ShieldAlert,
    items: ["Risk değerlendirme", "Acil durum planı", "Kurul toplantıları", "Atama yazıları", "İş kazası kayıtları"],
  },
  {
    title: "Raporlama",
    icon: Activity,
    items: ["Dashboard", "Firma bazlı görünüm", "CSV/Excel dışa aktarma", "Yönetici raporları"],
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
  "Sorumlu atama",
  "Termin takibi",
  "Firma bazlı raporlama",
  "Excel/CSV dışa aktarma",
  "Yönetim görünürlüğü",
];

export const landingFooterGroups = [
  {
    title: "Ürün",
    links: ["Operasyon Merkezi", "Çalışan Yönetimi", "Denetimler", "Risk Sihirbazı"],
  },
  {
    title: "Modüller",
    links: ["Kurul Toplantıları", "Atama Yazıları", "İş Kazası Süreçleri", "Acil Durum Planı"],
  },
  {
    title: "İletişim",
    links: ["Demo Talebi", "Destek", "info@isgvizyon.com", "www.isgvizyon.com"],
  },
  {
    title: "Yasal",
    links: ["KVKK", "Gizlilik", "Çerez Tercihleri", "Kullanım Koşulları"],
  },
];
