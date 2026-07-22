import { supabase } from "@/integrations/supabase/client";
import type { Company, Employee } from "@/types/companies";

export type AttendanceStatus = "Katıldı" | "Katılmadı" | "Kısmi katılım" | "Mazeretli";
export type SignatureStatus = "Bekliyor" | "İmzalandı" | "Dijital onay" | "Uygulanamaz";
export type CertificateStatus = "Bekliyor" | "Oluşturuldu" | "Aktarıldı";
export type ParticipantSource = "Firma çalışanı" | "Harici" | "Excel";

export type TrainingDocumentSettings = {
  safetyExpertSignature: boolean;
  doctorSignature: boolean;
  employerSignature: boolean;
  employeeRepresentativeSignature: boolean;
  participantSignature: boolean;
  companyLogo: boolean;
  isgVizyonLogo: boolean;
  pageNumbers: boolean;
};

export type TrainingTopic = {
  id: string;
  category: string;
  title: string;
  durationMinutes: number;
  trainerName: string;
  description: string;
  isRequired: boolean;
};

export type TrainingDay = {
  id: string;
  dayNumber: number;
  trainingDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  trainerName: string;
  topics: TrainingTopic[];
};

export type TrainingParticipant = {
  id: string;
  employeeId?: string | null;
  source: ParticipantSource;
  fullName: string;
  nationalId: string;
  jobTitle: string;
  department: string;
  phone: string;
  email: string;
  companyName: string;
  attendanceStatus: AttendanceStatus;
  signatureStatus: SignatureStatus;
  certificateStatus: CertificateStatus;
};

export type TrainingAttendanceRecord = {
  id?: string;
  userId?: string;
  organizationId?: string | null;
  companyId: string;
  companyName: string;
  title: string;
  trainingType: string;
  trainingMethod: string;
  trainingDate: string;
  durationHours: number;
  location: string;
  trainerNames: string[];
  description: string;
  status: "Taslak" | "Kaydedildi" | "PDF hazır" | "Eksik bilgi var";
  documentSettings: TrainingDocumentSettings;
  days: TrainingDay[];
  participants: TrainingParticipant[];
  createdAt?: string;
  updatedAt?: string;
};

export type TrainingHistoryItem = Pick<
  TrainingAttendanceRecord,
  "id" | "companyId" | "companyName" | "title" | "trainingDate" | "durationHours" | "status" | "updatedAt"
> & {
  participantCount: number;
};

export const defaultDocumentSettings: TrainingDocumentSettings = {
  safetyExpertSignature: true,
  doctorSignature: true,
  employerSignature: true,
  employeeRepresentativeSignature: false,
  participantSignature: true,
  companyLogo: true,
  isgVizyonLogo: true,
  pageNumbers: true,
};

export const topicCatalog = [
  {
    category: "Genel Konular",
    topics: [
      "Çalışma mevzuatı ile ilgili bilgiler",
      "Çalışanların yasal hak ve sorumlulukları",
      "İşyeri temizliği ve düzeni",
      "İş kazası ve meslek hastalığından doğan hukuki sonuçlar",
    ],
  },
  {
    category: "Sağlık Konuları",
    topics: [
      "Meslek hastalıklarının sebepleri",
      "Hastalıktan korunma prensipleri",
      "Biyolojik ve psikososyal risk etmenleri",
      "İlk yardım",
      "Tütün ürünlerinin zararları ve pasif etkilenim",
    ],
  },
  {
    category: "Teknik Konular",
    topics: [
      "Kimyasal, fiziksel ve ergonomik risk etmenleri",
      "Elle kaldırma ve taşıma",
      "Parlama, patlama, yangın ve yangından korunma",
      "İş ekipmanlarının güvenli kullanımı",
      "Ekranlı araçlarla çalışma",
      "Elektrik tehlikeleri, riskleri ve önlemleri",
      "İş kazalarının sebepleri ve korunma prensipleri",
      "Güvenlik ve sağlık işaretleri",
      "Kişisel koruyucu donanım kullanımı",
      "Tahliye ve kurtarma",
    ],
  },
  {
    category: "Diğer Konular",
    topics: ["İşyerine özel riskler", "Acil durum prosedürleri", "Firma içi çalışma kuralları"],
  },
];

export const manualTrainingTitle = "Manuel Eğitim Başlığı Gir";

export type TrainingTitlePreset = {
  title: string;
  topics: string[];
};

export const trainingTitlePresets: TrainingTitlePreset[] = [
  {
    title: "İŞ SAĞLIĞI ve GÜVENLİĞİ",
    topics: [
      "Çalışma mevzuatı ile ilgili bilgiler",
      "Çalışanların yasal hak ve sorumlulukları",
      "İşyeri temizliği ve düzeni",
      "İş kazası ve meslek hastalığından doğan hukuki sonuçlar",
      "Meslek hastalıklarının sebepleri",
      "Hastalıktan korunma prensipleri ve korunma tekniklerinin uygulanması",
      "Biyolojik ve psikososyal risk etmenleri",
      "İlkyardım",
      "Bağımlılık yapıcı maddelerin zararları ve teknoloji bağımlılığı",
      "Kimyasal, fiziksel ve ergonomik risk etmenleri",
      "Elle kaldırma ve taşıma",
      "Parlama, patlama, yangın ve yangından korunma",
      "İş ekipmanlarının güvenli kullanımı",
      "Ekranlı araçlarla çalışma",
      "Elektrik, tehlikeleri, riskleri ve önlemleri",
      "İş kazalarının sebepleri ve korunma prensipleri ile teknikleri",
      "Güvenlik ve sağlık işaretleri",
      "Kişisel koruyucu donanım kullanımı",
      "İş sağlığı ve güvenliği genel kuralları ve güvenlik kültürü",
      "Acil durumlar, tahliye ve kurtarma",
    ],
  },
  {
    title: "FİZİKSEL RİSK ETMENLERİ",
    topics: [
      "Tozlu ortamlarda çalışmalarda iş güvenliği",
      "Gürültülü ortamı araç çalışmalarda iş güvenliği",
      "Titreşimli ortamlarda çalışmalarda iş güvenliği",
      "Termal konfor",
      "Ergonomi",
      "Toz, gürültü, titreşim risk etmenleri ve maruziyet sınırları",
    ],
  },
  {
    title: "YÜKSEKTE ÇALIŞMA",
    topics: [
      "Yüksekliğin tanımı ve yüksekte çalışma ortamları",
      "Kaza istatistikleri ve yüksekten düşme şeklindeki kazaların oranı",
      "Yüksekte çalışırken dikkat edilecek hususlar",
      "Temel güvenlik kuralları",
      "İşe uygun merdiven iskele seçimi, merdiven ve iskelelerin kurulması ve sabitlenmesi",
      "Toplu koruma yöntemleri ve önemi",
      "Kişisel koruyucu donanımlar",
      "Temel emniyet ipi ile enerji tutucu sistemlerin kullanımı ve özellikleri",
      "Yüksekte çalışma sırasında olabilecek kazaların önlenmesi ve iş güvenliği performansının iyileştirilmesi",
      "Çatılarda çalışma ve alınacak önlemler",
      "Yüksek iş makinelerinde alınacak önlemler",
      "Yüksekte yapılacak çalışmalarda tehlike ve risklerin önceden belirlenmesi ve önlenmesi",
      "Düşme faktörü kavramı ve önlemler",
      "Düşmeden korunmanın teorisi ve uygulamaları",
      "İş planı ve alanın organizasyonu",
    ],
  },
  {
    title: "KAPALI ALANLARDA ÇALIŞMA EĞİTİMİ",
    topics: [
      "Kapalı sınırlı alan tanımı, türleri ve sınıflandırılması",
      "Yasal çerçeve ve ilgili yönetmelikler",
      "Kapalı alan kaza istatistikleri, önemi ve risk değerlendirmesi zorunluluğu",
      "Atmosferik tehlikeler: oksijen yetersizliği, parlayıcı/patlayıcı ortam ve zehirli gazlar",
      "Oksijen dengesi ve güvenli aralıklar",
      "Boğucu ve zehirli gazlar",
      "Parlayıcı/patlayıcı atmosfer, alt ve üst patlama sınırları",
      "Fiziksel ve diğer tehlikeler",
      "Atmosfer ölçümü ve gaz dedektörü kullanımı",
      "Gaz ölçüm cihazlarının kalibrasyonu, bump test ve alarm seviyeleri",
      "Kapalı alana güvenli giriş izin sistemi",
      "Enerji izolasyonu, kilitleme-etiketleme",
      "Zorlamalı cebri mekanik havalandırma ve ex-proof ekipman kullanımı",
      "Görev ve sorumluluklar",
      "İletişim ve haberleşme sistemleri",
      "Kişisel koruyucu donanım ve solunum koruma",
      "Acil durum, kurtarma ve tahliye planı",
      "Yanlış kurtarmanın ölümcül tehlikesi, ilk yardım ve temel yaşam desteği",
    ],
  },
  {
    title: "KKD KULLANIM EĞİTİMİ (KİŞİSEL KORUYUCU DONANIM)",
    topics: [
      "Yasal mevzuat: 6331 sayılı İSG Kanunu ve kişisel koruyucu donanımların işyerlerinde kullanılması hakkında yönetmelik",
      "KKD tanımı ve kapsamı",
      "Korunma hiyerarşisi: toplu koruma önlemlerinin önceliği ve KKD'nin son çare olması",
      "Risk değerlendirmesine göre KKD seçimi",
      "KKD kategorileri",
      "Baş koruyucular",
      "Göz ve yüz koruyucular",
      "Kulak koruyucular",
      "Solunum koruyucular",
      "El ve kol koruyucular",
      "Ayak ve bacak koruyucular",
      "Vücut koruyucular",
      "Doğru kullanım, bakım, temizlik, saklama koşulları ve hasarlı KKD'nin değiştirilmesi",
      "Çalışanların yükümlülükleri",
    ],
  },
  {
    title: "İŞ KAZASI SONRASI İŞE DÖNÜŞ EĞİTİMİ",
    topics: [
      "Yasal mevzuat: çalışanların İSG eğitimlerinin usul ve esasları hakkında yönetmelik",
      "Yaşanan iş kazasının değerlendirilmesi",
      "Kaza kök neden analizi",
      "Benzer kazaların önlenmesi",
      "Korunma yolları",
      "Güvenli çalışma yöntemleri",
      "Risk değerlendirmesi",
      "Makine ve iş ekipmanı güvenliği",
      "Ramak kala ve tehlikeli durum bildirimi",
      "İşe dönüş sağlık gözetimi",
      "Kaza sonrası psikososyal destek",
      "Çalışanın hak ve yükümlülükleri",
      "Güvenlik kültürü ve sürekli iyileştirme",
    ],
  },
  {
    title: "ÇALIŞAN TEMSİLCİSİ EĞİTİMİ",
    topics: [
      "Yasal mevzuat: 6331 sayılı İSG Kanunu ve çalışan temsilcisi yönetmeliği",
      "Görev ve sorumluluklar",
      "İletişim teknikleri",
      "İSG kuruluna katılım",
      "Tehlike kaynaklarını izleme",
    ],
  },
  {
    title: "RİSK DEĞERLENDİRME EKİBİ EĞİTİMİ",
    topics: [
      "Tehlike ve risk kavramları",
      "Risk değerlendirmesi metodolojisi",
      "Adım adım risk analizi",
      "Kontrol hiyerarşisi",
      "Dokümantasyon ve takip",
    ],
  },
  {
    title: "İSG KURULU EĞİTİMİ",
    topics: [
      "Yasal mevzuat: İSG kurulları hakkında yönetmelik",
      "Kurulun oluşumu",
      "Kurul kurma zorunluluğu",
      "Toplantı periyodu",
      "Görevler",
      "Yıllık plan hazırlama",
      "Acil durum planlarının gözden geçirilmesi",
      "Karar alma ve oy çokluğu",
      "Tutanak ve dokümantasyon",
      "Koordinasyon",
    ],
  },
  {
    title: "ACİL DURUM KOORDİNATÖRÜ EĞİTİMİ",
    topics: [
      "Yasal mevzuat: 6331 sayılı İSG Kanunu ve işyerlerinde acil durumlar hakkında yönetmelik md.11",
      "Acil durum planı: hazırlama, güncelleme ve yasal zorunluluklar",
      "Ekip yönetimi: söndürme, kurtarma, koruma, ilkyardım ekiplerinin koordinasyonu",
      "Tatbikat planlaması: yıllık tatbikat zorunluluğu, senaryo hazırlama ve değerlendirme",
      "Tahliye planı: toplanma yerleri, kaçış yolları, kat planları ve işaretleme",
      "Kriz iletişimi: dış kurumlarla (112, itfaiye, AFAD, kolluk) koordinasyon",
      "Yangın güvenliği: yangın söndürme ekipmanları, dedektörler ve periyodik kontrol",
      "Risk değerlendirme entegrasyonu: sonuçların acil durum planına yansıtılması",
      "Kriz yönetimi ve liderlik: panik kontrol, karar alma ve ekip yönetimi",
      "Olay sonrası: inceleme, raporlama ve düzeltici faaliyet takibi",
      "Bilgilendirme: çalışan eğitimi, ilan panosu ve tahliye krokisi güncelleme",
    ],
  },
  {
    title: "Acil Durum Ekipleri (Yön. md.11)",
    topics: [
      "Acil durum ekiplerinin görev ve sorumlulukları",
      "Söndürme ekibi temel görevleri",
      "Kurtarma ekibi temel görevleri",
      "Koruma ekibi temel görevleri",
      "İlk yardım ekibi koordinasyonu",
      "Tahliye, toplanma alanı ve haberleşme uygulamaları",
    ],
  },
  {
    title: "SÖNDÜRME EKİBİ EĞİTİMİ",
    topics: [
      "Yasal mevzuat: işyerlerinde acil durumlar hakkında yönetmelik md.11, söndürme ekibi tanımı ve tehlike sınıfına göre sayısal zorunluluk",
      "Yangının kimyası: yanma üçgeni, yanma türleri ve yayılma yolları",
      "Yangın sınıfları ve özellikleri",
      "Yangın söndürücü tipleri: kuru kimyevi toz, ABC, CO2, köpük, su; hangi sınıfta hangi söndürücü kullanılacağı",
      "Taşınabilir söndürücü kullanım tekniği (PASS): pimi çek, nozülü yangına yönelt, sık, süpürür gibi hareket et",
      "Yangın hortumu ve dolaplı sistemler: fire hose cabinet kurulumu, bağlantı ve basınçlı kullanım",
      "Yangın algılama ve uyarı sistemleri: duman/ısı dedektörleri, butonlar ve siren",
      "Güvenli müdahale prensipleri: sırtı dönük müdahale etmeme, kaçış yolu bırakma, ekip halinde hareket",
      "Kişisel koruyucu donanım: yangıncı başlığı, eldiven, bot, nefes koruyucu",
      "Tatbikat ve periyodik kontrol yükümlülükleri",
    ],
  },
  {
    title: "KURTARMA EKİBİ EĞİTİMİ",
    topics: [
      "Yasal mevzuat: işyerlerinde acil durumlar hakkında yönetmelik md.11, kurtarma ekibi tanımı ve tehlike sınıfına göre sayısal zorunluluk",
      "Kurtarma ekibinin görevi: evrak, ekipman, personel ve kritik varlıkların güvenli tahliyesi",
      "Bina içi kat planları ve güvenli rota seçimi",
      "Mahsur kalan personele ulaşma yöntemleri: sistematik arama, oda işaretleme, kat tarama",
      "Personel sayımı ve toplanma alanı kontrolü",
      "Kurtarma ekipmanları: halat, sedye, taşıma battaniyesi, kesici aletler",
      "Riskli alana güvenli giriş prosedürleri: hava kontrolü, ışık, geri çekilme planı",
      "Yaralı taşıma teknikleri: sırtta taşıma, koltuk taşıma, sürüklemeyle tahliye",
      "Kapalı alan giriş kuralları ve gözetimi",
      "Koordinasyon: söndürme ve koruma ekipleriyle iş birliği, 112 ile iletişim",
    ],
  },
  {
    title: "KORUMA EKİBİ EĞİTİMİ",
    topics: [
      "Yasal mevzuat: işyerlerinde acil durumlar hakkında yönetmelik md.11, koruma ekibi tanımı",
      "Koruma ekibinin görevi: sevk, söndürme/kurtarma ekibinden farkı",
      "Kaçış yollarının açık tutulması ve periyodik denetimi",
      "Tahliye edilen bina/alanın güvenliğinin sağlanması: yetkisiz girişlerin engellenmesi",
      "Çalışanların güvenli alana sevki ve toplanma alanı disiplini",
      "Mülkiyet koruması: değerli evrak, bilgisayar, makine ve cihaz emniyeti",
      "Trafik ve araç yönetimi: itfaiye/ambulans araçları için yol açma",
      "Bilgilendirme ve panik kontrolü: çalışan ve ziyaretçileri yönlendirme",
      "Dış kurumlarla koordinasyon: polis, itfaiye, sağlık ekipleriyle iletişim",
      "Olay sonrası bölge güvenliğinin korunması ve olay yeri delil muhafazası",
    ],
  },
  {
    title: "İLK YARDIM EKİBİ EĞİTİMİ (İlkyardım Yön. md.19)",
    topics: [
      "Yasal mevzuat: ilkyardım yönetmeliği md.19, tehlike sınıfına göre sayısal zorunluluk ve Sağlık Bakanlığı sertifikası şartı",
      "İlkyardımın temel ilkeleri ve ilkyardımcının sorumlulukları",
      "Olay yerinin değerlendirilmesi ve güvenlik önceliği",
      "Temel yaşam desteği (TYD): yetişkin, çocuk ve bebeklerde CPR uygulaması",
      "Otomatik eksternal defibrilatör (OED/AED) kullanımı",
      "Bilinç değerlendirme ve hava yolu açıklığı",
      "Kanama kontrolü ve şok yönetimi",
      "Yara çeşitleri, yanıklar ve elektrik çarpması müdahalesi",
      "Kırık, çıkık, burkulma ve stabilizasyon teknikleri",
      "Zehirlenmeler, boğulma, ısı çarpması ve hipotermiye müdahale",
      "Hasta taşıma teknikleri ve sedye kullanımı",
      "İlkyardım çantası içeriği, sertifika güncelleme ve yıllık tatbikat",
    ],
  },
  {
    title: "DESTEK ELEMANLARI (TOPLU EĞİTİM)",
    topics: [
      "Yasal mevzuat: 6331 sayılı İSG Kanunu md.11/c ve işyerlerinde acil durumlar hakkında yönetmelik md.11",
      "Acil durum planı: işyerindeki tahliye planı, toplanma yerleri ve kaçış yolları",
      "Söndürme ekibi görevleri: yangın sınıfları, söndürücü tipleri ve müdahale teknikleri",
      "Kurtarma ekibi görevleri: bina içi kat planları, personel sayımı ve mahsur kalanlara güvenli ulaşım",
      "Koruma ekibi görevleri: kaçış yollarının açık tutulması, tahliye edilen alanın güvenliği ve mülkiyet koruması",
      "İlkyardım ekip görevleri: kritik personel için temel yaşam desteği, kanama, yaralanma ve acil müdahale",
      "Haberleşme ve koordinasyon: acil durumlarda ekipler arası iletişim ve dış kurumlarla 112 irtibat",
      "Tatbikat ve değerlendirme: yıllık tatbikat zorunluluğu, kayıtlar ve eksikliklerin giderilmesi",
    ],
  },
];

export const trainingTitleOptions = [...trainingTitlePresets.map((preset) => preset.title), manualTrainingTitle];

const db = supabase as any;

async function loadXlsx() {
  return import("xlsx");
}

async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }, { addInterFontsToJsPDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("@/utils/fonts"),
  ]);
  return { jsPDF, autoTable, addInterFontsToJsPDF };
}

export function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptyTrainingDay(dayNumber = 1, date = new Date().toISOString().slice(0, 10)): TrainingDay {
  return {
    id: createClientId("day"),
    dayNumber,
    trainingDate: date,
    startTime: "09:00",
    endTime: "17:00",
    durationMinutes: 480,
    trainerName: "",
    topics: [
      {
        id: createClientId("topic"),
        category: "Genel Konular",
        title: "Çalışma mevzuatı ile ilgili bilgiler",
        durationMinutes: 60,
        trainerName: "",
        description: "",
        isRequired: true,
      },
    ],
  };
}

export function getTrainingTitlePreset(title: string) {
  return trainingTitlePresets.find((preset) => preset.title === title) || null;
}

export function createTrainingDaysFromPreset(
  title: string,
  date = new Date().toISOString().slice(0, 10),
  trainerName = "",
  location = "",
): TrainingDay[] {
  const preset = getTrainingTitlePreset(title);
  if (!preset) return [emptyTrainingDay(1, date)];

  const totalMinutes = 480;
  const baseDuration = Math.floor(totalMinutes / Math.max(preset.topics.length, 1));
  const remainder = totalMinutes - baseDuration * preset.topics.length;

  return [
    {
      id: createClientId("day"),
      dayNumber: 1,
      trainingDate: date,
      startTime: "09:00",
      endTime: "17:00",
      durationMinutes: totalMinutes,
      trainerName,
      topics: preset.topics.map((topic, index) => ({
        id: createClientId("topic"),
        category: title,
        title: topic,
        durationMinutes: baseDuration + (index < remainder ? 1 : 0),
        trainerName,
        description: location ? `Eğitim yeri: ${location}` : "",
        isRequired: true,
      })),
    },
  ];
}

export function createEmptyTrainingRecord(profile?: { organization_id?: string | null; full_name?: string | null }): TrainingAttendanceRecord {
  const today = new Date().toISOString().slice(0, 10);
  const defaultTitle = "İŞ SAĞLIĞI ve GÜVENLİĞİ";
  const defaultTrainer = profile?.full_name || "";
  return {
    companyId: "",
    companyName: "",
    title: defaultTitle,
    trainingType: "İlk eğitim",
    trainingMethod: "Yüz yüze",
    trainingDate: today,
    durationHours: 8,
    location: "",
    trainerNames: [defaultTrainer].filter(Boolean),
    description: "",
    status: "Taslak",
    documentSettings: defaultDocumentSettings,
    organizationId: profile?.organization_id ?? null,
    days: createTrainingDaysFromPreset(defaultTitle, today, defaultTrainer),
    participants: [],
  };
}

export function getEmployeeFullName(employee: Employee) {
  return (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();
}

export function maskNationalId(value?: string | null) {
  const clean = String(value || "").replace(/\D/g, "");
  if (clean.length < 4) return clean ? "***" : "";
  return `${clean.slice(0, 3)}******${clean.slice(-2)}`;
}

export function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function employeeToParticipant(employee: Employee, companyName: string): TrainingParticipant {
  return {
    id: createClientId("participant"),
    employeeId: employee.id,
    source: "Firma çalışanı",
    fullName: getEmployeeFullName(employee),
    nationalId: employee.tc_number || "",
    jobTitle: employee.job_title || employee.insured_job_name || "",
    department: employee.department || "",
    phone: employee.phone || "",
    email: employee.email || "",
    companyName,
    attendanceStatus: "Katıldı",
    signatureStatus: "Bekliyor",
    certificateStatus: "Bekliyor",
  };
}

export function participantKey(participant: Pick<TrainingParticipant, "employeeId" | "nationalId" | "fullName">) {
  if (participant.employeeId) return `employee:${participant.employeeId}`;
  const nationalId = participant.nationalId.replace(/\D/g, "");
  if (nationalId) return `tc:${nationalId}`;
  return `name:${participant.fullName.trim().toLocaleLowerCase("tr-TR")}`;
}

export function validateTrainingForPdf(record: TrainingAttendanceRecord) {
  const errors: string[] = [];
  if (!record.companyId) errors.push("Firma seçimi zorunlu.");
  if (!record.title.trim()) errors.push("Eğitim başlığı zorunlu.");
  if (!record.trainingDate) errors.push("Eğitim tarihi zorunlu.");
  if (!record.durationHours || record.durationHours <= 0) errors.push("Eğitim süresi sıfırdan büyük olmalı.");
  if (!record.days.length) errors.push("En az bir eğitim günü eklenmeli.");
  if (!record.days.some((day) => day.topics.length > 0)) errors.push("En az bir eğitim konusu eklenmeli.");
  if (!record.participants.length) errors.push("PDF oluşturmak için en az bir katılımcı eklenmeli.");

  record.days.forEach((day) => {
    if (day.startTime && day.endTime && day.endTime <= day.startTime) {
      errors.push(`${day.dayNumber}. gün için bitiş saati başlangıçtan sonra olmalı.`);
    }
  });

  return errors;
}

export async function loadTrainingCompanies(): Promise<Company[]> {
  const { data, error } = await db
    .from("companies")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Company[];
}

export async function loadCompanyEmployees(companyId: string): Promise<Employee[]> {
  if (!companyId) return [];
  const { data, error } = await db
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data || []) as Employee[];
}

export async function loadTrainingHistory(): Promise<TrainingHistoryItem[]> {
  const { data, error } = await db
    .from("training_attendance_records")
    .select("id, company_id, company_name, title, training_date, duration_hours, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const ids = (data || []).map((row: any) => row.id).filter(Boolean);
  let counts = new Map<string, number>();

  if (ids.length) {
    const { data: participantRows } = await db
      .from("training_attendance_participants")
      .select("training_id")
      .in("training_id", ids);

    counts = new Map<string, number>();
    (participantRows || []).forEach((row: any) => {
      counts.set(row.training_id, (counts.get(row.training_id) || 0) + 1);
    });
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name || "",
    title: row.title || "",
    trainingDate: row.training_date || "",
    durationHours: Number(row.duration_hours || 0),
    status: row.status || "Taslak",
    updatedAt: row.updated_at,
    participantCount: counts.get(row.id) || 0,
  }));
}

function mapRecordRow(row: any, days: any[], participants: any[]): TrainingAttendanceRecord {
  const topicsByDay = new Map<string, TrainingTopic[]>();
  days.forEach((day) => {
    (day.training_attendance_topics || []).forEach((topic: any) => {
      const list = topicsByDay.get(day.id) || [];
      list.push({
        id: topic.id,
        category: topic.category || "Diğer Konular",
        title: topic.title || "",
        durationMinutes: Number(topic.duration_minutes || 0),
        trainerName: topic.trainer_name || "",
        description: topic.description || "",
        isRequired: Boolean(topic.is_required),
      });
      topicsByDay.set(day.id, list);
    });
  });

  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    companyId: row.company_id || "",
    companyName: row.company_name || "",
    title: row.title || "",
    trainingType: row.training_type || "İlk eğitim",
    trainingMethod: row.training_method || "Yüz yüze",
    trainingDate: row.training_date || "",
    durationHours: Number(row.duration_hours || 0),
    location: row.location || "",
    trainerNames: Array.isArray(row.trainer_names) ? row.trainer_names : [],
    description: row.description || "",
    status: row.status || "Taslak",
    documentSettings: { ...defaultDocumentSettings, ...(row.document_settings || {}) },
    days: days.map((day) => ({
      id: day.id,
      dayNumber: Number(day.day_number || 1),
      trainingDate: day.training_date || "",
      startTime: String(day.start_time || "").slice(0, 5),
      endTime: String(day.end_time || "").slice(0, 5),
      durationMinutes: Number(day.duration_minutes || 0),
      trainerName: day.trainer_name || "",
      topics: topicsByDay.get(day.id) || [],
    })),
    participants: participants.map((item) => ({
      id: item.id,
      employeeId: item.employee_id,
      source: item.source || "Harici",
      fullName: item.full_name || "",
      nationalId: item.national_id || "",
      jobTitle: item.job_title || "",
      department: item.department || "",
      phone: item.phone || "",
      email: item.email || "",
      companyName: item.company_name || "",
      attendanceStatus: item.attendance_status || "Katıldı",
      signatureStatus: item.signature_status || "Bekliyor",
      certificateStatus: item.certificate_status || "Bekliyor",
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadTrainingRecord(id: string): Promise<TrainingAttendanceRecord> {
  const { data: record, error } = await db.from("training_attendance_records").select("*").eq("id", id).single();
  if (error) throw error;

  const [{ data: days, error: daysError }, { data: participants, error: participantsError }] = await Promise.all([
    db
      .from("training_attendance_days")
      .select("*")
      .eq("training_id", id)
      .order("sort_order", { ascending: true }),
    db
      .from("training_attendance_participants")
      .select("*")
      .eq("training_id", id)
      .order("sort_order", { ascending: true }),
  ]);
  if (daysError) throw daysError;
  if (participantsError) throw participantsError;

  const dayIds = (days || []).map((day: any) => day.id).filter(Boolean);
  let topics: any[] = [];
  if (dayIds.length) {
    const { data: topicRows, error: topicsError } = await db
      .from("training_attendance_topics")
      .select("*")
      .in("training_day_id", dayIds)
      .order("sort_order", { ascending: true });
    if (topicsError) throw topicsError;
    topics = topicRows || [];
  }

  const topicsByDay = new Map<string, any[]>();
  topics.forEach((topic) => {
    const list = topicsByDay.get(topic.training_day_id) || [];
    list.push(topic);
    topicsByDay.set(topic.training_day_id, list);
  });

  const daysWithTopics = (days || []).map((day: any) => ({
    ...day,
    training_attendance_topics: topicsByDay.get(day.id) || [],
  }));

  return mapRecordRow(record, daysWithTopics, participants || []);
}

export async function saveTrainingRecord(record: TrainingAttendanceRecord, userId: string, organizationId?: string | null) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || record.organizationId || null,
    company_id: record.companyId || null,
    company_name: record.companyName,
    title: record.title,
    training_type: record.trainingType,
    training_method: record.trainingMethod,
    training_date: record.trainingDate || null,
    duration_hours: record.durationHours,
    location: record.location,
    trainer_names: record.trainerNames,
    description: record.description,
    status: record.status,
    document_settings: record.documentSettings,
    updated_at: new Date().toISOString(),
  };

  const recordQuery = record.id
    ? db.from("training_attendance_records").update(payload).eq("id", record.id).select("*").single()
    : db.from("training_attendance_records").insert(payload).select("*").single();
  const { data: saved, error } = await recordQuery;
  if (error) throw error;

  const trainingId = saved.id as string;
  await db.from("training_attendance_participants").delete().eq("training_id", trainingId);
  await db.from("training_attendance_days").delete().eq("training_id", trainingId);

  const dayRows = record.days.map((day, index) => ({
    training_id: trainingId,
    day_number: index + 1,
    training_date: day.trainingDate || null,
    start_time: day.startTime || null,
    end_time: day.endTime || null,
    duration_minutes: day.durationMinutes,
    trainer_name: day.trainerName,
    sort_order: index,
  }));

  const { data: insertedDays, error: dayError } = await db
    .from("training_attendance_days")
    .insert(dayRows)
    .select("*")
    .order("sort_order", { ascending: true });
  if (dayError) throw dayError;

  const topicRows = (insertedDays || []).flatMap((dayRow: any, dayIndex: number) =>
    (record.days[dayIndex]?.topics || []).map((topic, topicIndex) => ({
      training_day_id: dayRow.id,
      category: topic.category,
      title: topic.title,
      duration_minutes: topic.durationMinutes,
      trainer_name: topic.trainerName,
      description: topic.description,
      is_required: topic.isRequired,
      sort_order: topicIndex,
    })),
  );

  if (topicRows.length) {
    const { error: topicError } = await db.from("training_attendance_topics").insert(topicRows);
    if (topicError) throw topicError;
  }

  const participantRows = record.participants.map((participant, index) => ({
    training_id: trainingId,
    employee_id: participant.employeeId || null,
    source: participant.source,
    full_name: participant.fullName,
    national_id: participant.nationalId,
    job_title: participant.jobTitle,
    department: participant.department,
    phone: participant.phone,
    email: participant.email,
    company_name: participant.companyName,
    attendance_status: participant.attendanceStatus,
    signature_status: participant.signatureStatus,
    certificate_status: participant.certificateStatus,
    sort_order: index,
  }));

  if (participantRows.length) {
    const { error: participantError } = await db.from("training_attendance_participants").insert(participantRows);
    if (participantError) throw participantError;
  }

  return loadTrainingRecord(trainingId);
}

export async function deleteTrainingRecord(id: string) {
  const { error } = await db.from("training_attendance_records").delete().eq("id", id);
  if (error) throw error;
}

export type ExcelImportResult = {
  valid: TrainingParticipant[];
  invalid: Array<{ row: number; reason: string; value: Record<string, unknown> }>;
};

export function parseTrainingParticipantsExcel(file: File, fallbackCompanyName: string): Promise<ExcelImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await loadXlsx();
        const workbook = XLSX.read(event.target?.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const seen = new Set<string>();
        const valid: TrainingParticipant[] = [];
        const invalid: ExcelImportResult["invalid"] = [];

        rows.forEach((row, index) => {
          const fullName = String(row["Ad Soyad"] || row["Ad-Soyad"] || row.ad_soyad || row.name || "").trim();
          const nationalId = String(row["TC No"] || row["TC Kimlik No"] || row.tc_no || row.tc || "").replace(/\D/g, "");
          if (!fullName) {
            invalid.push({ row: index + 2, reason: "Ad Soyad boş.", value: row });
            return;
          }
          if (nationalId && nationalId.length !== 11) {
            invalid.push({ row: index + 2, reason: "TC Kimlik No 11 hane olmalı.", value: row });
            return;
          }
          const key = nationalId || fullName.toLocaleLowerCase("tr-TR");
          if (seen.has(key)) {
            invalid.push({ row: index + 2, reason: "Dosya içinde tekrar eden katılımcı.", value: row });
            return;
          }
          seen.add(key);
          valid.push({
            id: createClientId("excel"),
            source: "Excel",
            fullName,
            nationalId,
            jobTitle: String(row["Görev"] || row["Gorev"] || row["Ünvan"] || row.job_title || "").trim(),
            department: String(row["Departman"] || row.department || "").trim(),
            phone: String(row["Telefon"] || row.phone || "").trim(),
            email: String(row["E-posta"] || row.email || "").trim(),
            companyName: String(row["Firma"] || fallbackCompanyName || "").trim(),
            attendanceStatus: "Katıldı",
            signatureStatus: "Bekliyor",
            certificateStatus: "Bekliyor",
          });
        });

        resolve({ valid, invalid });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function downloadTrainingExcelTemplate() {
  const XLSX = await loadXlsx();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Ad Soyad", "TC No", "Görev"],
    ["Ahmet Yılmaz", "12345678950", "Operatör"],
    ["Ayşe Kaya", "98765432150", "Kalite Kontrol"],
    ["Mehmet Demir", "11122233320", "Forklift Operatörü"],
  ]);
  worksheet["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 28 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Eğitim Katılımı");
  XLSX.writeFile(workbook, "egitim-katilimi-katilimci-sablonu.xlsx");
}

export async function exportTrainingParticipantsToExcel(record: TrainingAttendanceRecord) {
  const XLSX = await loadXlsx();
  const rows = record.participants.map((participant, index) => ({
    "Eğitim Adı": record.title,
    "Eğitim Tarihi": record.trainingDate,
    "Sıra No": index + 1,
    "Katılımcı Adı": participant.fullName,
    "TC Kimlik No": participant.nationalId,
    "Görev": participant.jobTitle,
    "Departman": participant.department,
    "Katılım Durumu": participant.attendanceStatus,
    "İmza Durumu": participant.signatureStatus,
    "Sertifika Durumu": participant.certificateStatus,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Eğitim Katılımı");
  XLSX.writeFile(workbook, `Egitim_Katilim_${safeFileName(record.companyName || "Firma")}_${record.trainingDate || "taslak"}.xlsx`);
}

function formatTrainingDate(value?: string) {
  return value ? new Date(value).toLocaleDateString("tr-TR") : new Date().toLocaleDateString("tr-TR");
}

function getTrainingFormTitle(title: string) {
  const cleaned = title.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "EĞİTİM KATILIM FORMU";
  return `${cleaned} KATILIM FORMU`.toLocaleUpperCase("tr-TR");
}

function getTrainingLegalBasis(title: string) {
  const normalized = title.toLocaleUpperCase("tr-TR");
  if (normalized.includes("KKD")) {
    return [
      "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu madde 30",
      "02.07.2013 tarih ve 28695 sayılı Resmi Gazete'de yayımlanan Kişisel Koruyucu Donanımların İşyerlerinde Kullanılması Hakkında Yönetmelik",
      "29.08.2019 tarih ve 30752 sayılı Resmi Gazete'de yayımlanan Kişisel Koruyucu Donanım Yönetmeliği",
    ].join("\n");
  }
  if (normalized.includes("İLK YARDIM")) {
    return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu, İlkyardım Yönetmeliği md.19 ve işyerlerinde acil durumlar hakkında yönetmelik hükümleri.";
  }
  if (normalized.includes("ACİL") || normalized.includes("SÖNDÜRME") || normalized.includes("KURTARMA") || normalized.includes("KORUMA") || normalized.includes("DESTEK")) {
    return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu md.11 ve İşyerlerinde Acil Durumlar Hakkında Yönetmelik md.11 hükümleri.";
  }
  if (normalized.includes("ÇALIŞAN TEMSİLCİSİ")) {
    return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu md.20 ve Çalışan Temsilcisi Yönetmeliği hükümleri.";
  }
  if (normalized.includes("RİSK DEĞERLENDİRME")) {
    return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu md.10 ve İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği hükümleri.";
  }
  if (normalized.includes("KURUL")) {
    return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu md.22 ve İş Sağlığı ve Güvenliği Kurulları Hakkında Yönetmelik hükümleri.";
  }
  return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu ve Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik hükümleri.";
}

export async function generateTrainingAttendancePdf(record: TrainingAttendanceRecord, save = true) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const fontsLoaded = addInterFontsToJsPDF(doc);
  const fontName = fontsLoaded ? "Inter" : "helvetica";
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 11;
  const formWidth = pageWidth - marginX * 2;
  const leftLabelWidth = 45;
  const rightWidth = formWidth - leftLabelWidth;
  const topicLines = record.days.flatMap((day) => day.topics.map((topic) => topic.title));
  const topicText = topicLines.map((topic, topicIndex) => `${topicIndex + 1}. ${topic}`).join("\n");
  const firstDay = record.days[0];
  const dateText = formatTrainingDate(record.trainingDate || firstDay?.trainingDate);
  const trainingSequence = record.trainingType ? record.trainingType.replace("İlk eğitim", "1. Eğitim") : "1. Eğitim";
  const signatureTitle = record.days.length > 1 ? "EĞİTİM İMZA" : "1. EĞİTİM İMZA";
  const participants = record.participants;

  doc.setFont(fontName, "normal");
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);

  const drawCell = (
    x: number,
    y: number,
    w: number,
    h: number,
    cellText = "",
    options: { bold?: boolean; size?: number; align?: "left" | "center" | "right"; valign?: "top" | "middle"; padding?: number } = {},
  ) => {
    doc.rect(x, y, w, h);
    if (!cellText) return;
    const padding = options.padding ?? 2;
    const size = options.size ?? 7;
    doc.setFont(fontName, options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(cellText, w - padding * 2);
    const lineHeight = size * 0.35;
    const textHeight = lines.length * lineHeight;
    const textY = options.valign === "middle" ? y + (h - textHeight) / 2 + lineHeight * 0.75 : y + padding + lineHeight;
    doc.text(lines, options.align === "center" ? x + w / 2 : options.align === "right" ? x + w - padding : x + padding, textY, {
      align: options.align || "left",
      baseline: "alphabetic",
    });
  };

  const topY = 10;
  drawCell(marginX, topY, leftLabelWidth, 22, "");
  drawCell(marginX + leftLabelWidth, topY, rightWidth, 22, getTrainingFormTitle(record.title), {
    bold: true,
    size: 11,
    align: "center",
    valign: "middle",
  });

  const contentY = topY + 22;
  const contentH = 48;
  drawCell(marginX, contentY, leftLabelWidth, contentH, getTrainingLegalBasis(record.title), {
    size: 5,
    align: "center",
    valign: "middle",
    padding: 2,
  });
  drawCell(marginX + leftLabelWidth, contentY, rightWidth, contentH, "");
  doc.setFont(fontName, "bold");
  doc.setFontSize(7);
  doc.text("EĞİTİM KONUSU", marginX + leftLabelWidth + rightWidth / 2, contentY + 5, { align: "center" });
  doc.setFontSize(topicLines.length > 14 ? 4.2 : 4.8);
  doc.text(doc.splitTextToSize(topicText || record.title, rightWidth - 5), marginX + leftLabelWidth + 2, contentY + 9);

  const infoY = contentY + contentH;
  drawCell(marginX, infoY, leftLabelWidth, 6, `Düzenleme Tarihi : ${new Date().toLocaleDateString("tr-TR")}`, { bold: true, size: 4.6, align: "center", valign: "middle" });
  drawCell(marginX + leftLabelWidth, infoY, rightWidth, 6, "");

  const rows = [
    ["FİRMA", record.companyName || "-"],
    ["EĞİTİM SIRASI / TÜRÜ", `${trainingSequence} / ${record.trainingMethod}`],
    ["EĞİTİM TARİHİ", dateText],
    ["EĞİTİM SÜRESİ / YERİ", `${record.durationHours || Math.round((firstDay?.durationMinutes || 480) / 60)} Saat / ${record.location || "-"}`],
    ["EĞİTİM KONULARI", record.title || "-"],
  ];

  let rowY = infoY + 6;
  rows.forEach(([label, value]) => {
    drawCell(marginX, rowY, leftLabelWidth, 6, label, { bold: true, size: 7, align: "left", valign: "middle" });
    drawCell(marginX + leftLabelWidth, rowY, rightWidth, 6, value, { size: 6.5, align: "center", valign: "middle" });
    rowY += 6;
  });

  autoTable(doc, {
    startY: rowY,
    theme: "grid",
    margin: { left: marginX, right: marginX },
    tableWidth: formWidth,
    head: [["NO", "AD-SOYAD", "TC KİMLİK NO", "GÖREVİ", signatureTitle]],
    body: participants.map((participant, index) => [
      index + 1,
      participant.fullName,
      participant.nationalId,
      participant.jobTitle || participant.department || "",
      "",
    ]),
    styles: {
      font: fontName,
      fontSize: 7,
      cellPadding: 1.5,
      minCellHeight: 12,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    headStyles: {
      fillColor: [238, 238, 238],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { halign: "center" },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 42 },
      2: { cellWidth: 32 },
      3: { cellWidth: 37 },
      4: { cellWidth: formWidth - 119 },
    },
    rowPageBreak: "avoid",
  });

  let finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || rowY + 25;
  if (finalY > 232) {
    doc.addPage();
    finalY = 34;
  }

  const signY = Math.max(finalY + 24, 205);
  const signatureBlocks = [
    record.documentSettings.safetyExpertSignature && { title: "İŞ GÜVENLİĞİ UZMANI", name: record.trainerNames[0] || "Ad Soyad", bottom: "İmza" },
    record.documentSettings.doctorSignature && { title: "İŞYERİ HEKİMİ", name: record.trainerNames[1] || "Ad Soyad", bottom: "İmza" },
    record.documentSettings.employerSignature && { title: "İŞVEREN / İŞVEREN VEKİLİ", name: record.trainerNames[2] || "Ad Soyad", bottom: "Kaşe / İmza" },
  ].filter(Boolean) as Array<{ title: string; name: string; bottom: string }>;

  const blockWidth = formWidth / Math.max(signatureBlocks.length, 1);
  signatureBlocks.forEach((block, blockIndex) => {
    const x = marginX + blockIndex * blockWidth;
    doc.setFont(fontName, "bold");
    doc.setFontSize(7);
    doc.text(block.title, x + blockWidth / 2, signY, { align: "center" });
    doc.setFont(fontName, "normal");
    doc.setFontSize(6.5);
    doc.text(block.name, x + blockWidth / 2, signY + 7, { align: "center" });
    doc.text(block.bottom, x + blockWidth / 2, signY + 13, { align: "center" });
  });

  if (record.documentSettings.pageNumbers) {
    const pages = doc.getNumberOfPages();
    for (let pageIndex = 1; pageIndex <= pages; pageIndex += 1) {
      doc.setPage(pageIndex);
      doc.setFont(fontName, "normal");
      doc.setFontSize(6);
      doc.text(`Sayfa ${pageIndex}/${pages}`, pageWidth - marginX, 290, { align: "right" });
    }
  }

  const fileName = `${safeFileName(record.title || "Egitim")}_Katilim_Formu_${safeFileName(record.companyName || "Firma")}_${record.trainingDate || new Date().toISOString().slice(0, 10)}.pdf`;
  if (save) doc.save(fileName);
  return doc.output("bloburl");
}
