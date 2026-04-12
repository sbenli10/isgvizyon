export type MonthStatus = "empty" | "planned" | "completed";

export interface WorkPlanRow {
  id: string;
  activity_name: string;
  responsible: string;
  months: {
    [key: number]: MonthStatus; // 0-11 (Ocak-Aralık)
  };
}

export interface TrainingPlanRow {
  id: string;
  topic: string;
  provider: string;
  planned_date: string;
  actual_date: string;
  notes: string;
}

export interface TrainingPlanMeta {
  workplaceTitle: string;
  workplaceAddress: string;
  workplaceRegistrationNo: string;
  specialistName: string;
  doctorName: string;
  employerRepresentativeName: string;
  organizationLogoUrl?: string;
}

export interface EvaluationRow {
  id: string;
  activity: string;
  planned_date: string;
  actual_date: string;
  status: "completed" | "pending" | "cancelled";
  result_comment: string;
}

export interface AnnualPlanData {
  work_plan: WorkPlanRow[];
  training_plan: TrainingPlanRow[];
  evaluation_report: EvaluationRow[];
}

export const WORK_PLAN_TEMPLATE: Omit<WorkPlanRow, "id">[] = [
  {
    activity_name: "Asansör Periyodik Kontrolü",
    responsible: "Teknik Müdür",
    months: Array.from({ length: 12 }, (_, i) => [i, i % 6 === 0 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "Yangın Söndürme Tüpü Kontrol ve Dolumu",
    responsible: "İSG Uzmanı",
    months: Array.from({ length: 12 }, (_, i) => [i, i === 0 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "Tahliye Tatbikatı",
    responsible: "Acil Durum Ekibi",
    months: Array.from({ length: 12 }, (_, i) => [i, i === 5 || i === 11 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "İlk Yardım Eğitimi",
    responsible: "İSG Uzmanı",
    months: Array.from({ length: 12 }, (_, i) => [i, i === 2 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "KKD Temini ve Dağıtımı",
    responsible: "Satın Alma",
    months: Array.from({ length: 12 }, (_, i) => [i, i % 3 === 0 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "Risk Değerlendirmesi Güncellemesi",
    responsible: "İSG Uzmanı",
    months: Array.from({ length: 12 }, (_, i) => [i, i === 0 || i === 6 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "İşyeri Hekimi Kontrolleri",
    responsible: "İşyeri Hekimi",
    months: Array.from({ length: 12 }, (_, i) => [i, "planned"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "Acil Durum Planı Revizyonu",
    responsible: "İSG Uzmanı",
    months: Array.from({ length: 12 }, (_, i) => [i, i === 0 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "Elektrik Panosu Termografik Kontrol",
    responsible: "Elektrik Mühendisi",
    months: Array.from({ length: 12 }, (_, i) => [i, i === 3 || i === 9 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
  {
    activity_name: "Yıldırım Tesisatı Topraklama Ölçümü",
    responsible: "Teknik Ekip",
    months: Array.from({ length: 12 }, (_, i) => [i, i === 4 ? "planned" : "empty"]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  },
];

export const TRAINING_PLAN_TEMPLATE: Omit<TrainingPlanRow, "id">[] = [
  {
    topic: "Genel Konular\na) Çalışma mevzuatı ile ilgili bilgiler\nb) Çalışanların yasal hak ve sorumlulukları\nc) İşyeri temizliği ve düzeni\nd) İş kazası ve meslek hastalığından doğan hukuki sonuçlar",
    provider: "İş Güvenliği Uzmanı",
    planned_date: "SÜREKLİ",
    actual_date: "",
    notes: "",
  },
  {
    topic: "Sağlık Konuları\na) Meslek hastalıklarının sebepleri\nb) Hastalıktan korunma prensipleri ve korunma tekniklerinin uygulanması\nc) Biyolojik ve psikososyal risk etmenleri\nd) İlkyardım",
    provider: "İşyeri Hekimi",
    planned_date: "SÜREKLİ",
    actual_date: "",
    notes: "",
  },
  {
    topic: "Teknik Konular\na) Kimyasal, fiziksel ve ergonomik risk etmenleri\nb) Elle kaldırma ve taşıma\nc) Parlama, patlama, yangın ve yangından korunma\nd) İş ekipmanlarının güvenli kullanımı\ne) Ekranlı araçlarla çalışma",
    provider: "İş Güvenliği Uzmanı",
    planned_date: "SÜREKLİ",
    actual_date: "",
    notes: "",
  },
  {
    topic: "Risk Değerlendirme Ekibi Eğitimi",
    provider: "İş Güvenliği Uzmanı",
    planned_date: "OCAK",
    actual_date: "",
    notes: "",
  },
  {
    topic: "İş Sağlığı ve Güvenliği Kurulu Eğitimi",
    provider: "İş Güvenliği Uzmanı",
    planned_date: "MUAF",
    actual_date: "",
    notes: "",
  },
  {
    topic: "Çalışan Temsilcisi Eğitimi",
    provider: "İş Güvenliği Uzmanı",
    planned_date: "OCAK",
    actual_date: "",
    notes: "",
  },
  {
    topic: "Acil Durum Planı Pers. Bilgilendirme Eğitimi",
    provider: "İş Güvenliği Uzmanı / İşyeri Hekimi",
    planned_date: "OCAK",
    actual_date: "",
    notes: "",
  },
  {
    topic: "İlk Yardımcı Eğitimi",
    provider: "Yetkili Eğitim Kuruluşu",
    planned_date: "3 YIL",
    actual_date: "",
    notes: "",
  },
  {
    topic: "Hijyen Eğitimi",
    provider: "Yetkili Kuruluş",
    planned_date: "ŞUBAT",
    actual_date: "",
    notes: "",
  },
  {
    topic: "Destek Elemanı ve Ekipler Eğitimi",
    provider: "İş Güvenliği Uzmanı",
    planned_date: "OCAK",
    actual_date: "",
    notes: "",
  },
];

export const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
