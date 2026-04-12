import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
  ShieldAlert,
  Sparkles,
  Users,
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
    title: "Ortak sağlık güvenlik birimi operasyon merkezi",
    description:
      "Personel, görevlendirme, kapasite, şirket, finans ve doküman modülleri tek panelde toplanır.",
    icon: Briefcase,
    badge: "Profesyonel",
  },
  {
    title: "Belge ve plan üretimi",
    description:
      "Acil durum eylem planı, yıllık plan, görevlendirme yazısı, sertifika ve rapor süreçleri aynı kurumsal dilde yönetilir.",
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
    title: "Düzeltici ve önleyici faaliyet ile toplu düzeltici faaliyet analizi",
    description: "Tekil düzeltici ve önleyici faaliyet kaydı yanında toplu görsel analiz ve seri düzeltici faaliyet üretimi.",
    icon: Workflow,
    badge: "Profesyonel",
  },
  {
    title: "Firma ve çalışan yönetimi",
    description: "Firma, çalışan, kişisel koruyucu donanım, sağlık gözetimi ve periyodik kontrol kayıtları.",
    icon: Building2,
  },
  {
    title: "Ortak sağlık güvenlik birimi modülü",
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
    title: "Toplu düzeltici faaliyet analizi",
    description:
      "Çoklu görsel üzerinden uygunsuzluk analizi, risk yorumu ve toplu düzeltici faaliyet akışı üretir.",
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
      "Faaliyet sınıfı kodu sorgulama ve sektör bazlı yapay zeka öneri akışları sağlar.",
    icon: Sparkles,
  },
  {
    title: "Tahliye üretimi",
    description:
      "Tahliye planı ve tahliye görseli üretimiyle gelişmiş senaryo kurgusunu hızlandırır.",
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
      "Firma, çalışan, kişisel koruyucu donanım, sağlık gözetimi ve temel operasyon kayıtları platforma alınır.",
  },
  {
    step: "02",
    title: "Risk ve denetim akışını işletin",
    description:
      "Risk değerlendirme, denetim, düzeltici ve önleyici faaliyet, rapor ve bildirim akışı günlük operasyon omurgasını oluşturur.",
  },
  {
    step: "03",
    title: "Belge ve plan katmanını ekleyin",
    description:
      "Acil durum eylem planı, yıllık plan, görevlendirme yazıları ve rapor çıktıları tek noktadan yönetilir.",
  },
  {
    step: "04",
    title: "Gelişmiş modüllerle ölçekleyin",
    description:
      "Toplu düzeltici faaliyet analizi, yerleşim planı analizi, sertifikalar, İSG asistanı ve ortak sağlık güvenlik birimi modülü ile ekip genişlerken kontrol kaybedilmez.",
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
      "Gemini çağrıları tarayıcıdan kaldırılmıştır; yapay zeka işlemleri Supabase Edge Function üzerinden yürür.",
    icon: Sparkles,
  },
  {
    title: "Abonelik ve deneme süresi kontrolü",
    description:
      "Ücretsiz, profesyonel ve 7 günlük deneme üyelikleri plan ve limit bazlı izlenir; süresi dolan denemeler ücretsiz plana geri döner.",
    icon: BellRing,
  },
];

export const trustMetrics = [
  { label: "Çekirdek modül kümesi", value: "20+" },
  { label: "Profesyonel modül alanı", value: "6+" },
  { label: "Demo süresi", value: "7 gün" },
  { label: "Plan yapısı", value: "Ücretsiz + Profesyonel" },
];

export const trustUseCases = [
  "Kurum içi İSG ekipleri",
  "Ortak sağlık güvenlik birimi operasyon ekipleri",
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
      "Toplu düzeltici faaliyet analizi, yerleşim planı analizi ve İSG asistanı",
      "Sertifika ve ortak sağlık güvenlik birimi modülü",
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
