import { supabase } from "@/integrations/supabase/client";
import type { Company, Employee } from "@/types/companies";

export interface OrientationTrainingParticipant {
  id: string;
  employeeId?: string | null;
  fullName: string;
  nationalId: string;
  jobTitle: string;
  department: string;
  startDate?: string | null;
}

export interface OrientationTrainingRecord {
  id?: string;
  userId?: string;
  organizationId?: string | null;
  companyId: string;
  companyName: string;
  trainingDate: string;
  documentDate: string;
  durationHours: number;
  trainingPlace: string;
  trainingMethod: string;
  trainerName: string;
  includeSpecialistSignature: boolean;
  includeDoctorSignature: boolean;
  hideNationalId: boolean;
  logoDataUrl?: string | null;
  notes: string;
  status: "Taslak" | "Kaydedildi";
  participants: OrientationTrainingParticipant[];
  topics: string[];
  createdAt?: string;
  updatedAt?: string;
}

type JsPdfConstructor = new (options?: Record<string, unknown>) => any;

const db = supabase as any;

async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }, { addInterFontsToJsPDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("@/utils/fonts"),
  ]);
  return { jsPDF: jsPDF as JsPdfConstructor, autoTable, addInterFontsToJsPDF };
}

export const orientationDefaultTopics = [
  "İşyeri ve organizasyonun tanıtımı",
  "Çalışma saatleri, molalar ve vardiya düzeni",
  "İşyeri kuralları, disiplin ve davranış kuralları",
  "Sosyal alanların tanıtımı (yemekhane, soyunma odası, WC, dinlenme)",
  "Amir ve çalışma arkadaşları ile tanıştırma",
  "Görev tanımının aktarılması ve işle ilgili beklentiler",
  "Kullanılacak iş ekipmanlarının tanıtımı ve güvenli kullanımı",
  "İlgili çalışma talimatlarının okutulması ve imzalatılması",
  "İşyerine özgü tehlikeler, riskler ve alınan önlemler",
  "Güvenlik ve sağlık işaretleri",
  "Kişisel koruyucu donanım (KKD) teslimi ve kullanımı",
  "Acil durumlar, tahliye, kaçış yolları ve toplanma yeri",
  "Yangın güvenliği ve yangın söndürücü kullanımı",
  "İlk yardım ve revir / sağlık birimi bilgisi",
  "Ramak kala ve iş kazası bildirimi yükümlülüğü",
  "Temizlik, düzen ve ergonomi kuralları",
];

export function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyOrientationTrainingRecord(organizationId?: string | null): OrientationTrainingRecord {
  const today = new Date().toISOString().slice(0, 10);
  return {
    organizationId: organizationId ?? null,
    companyId: "",
    companyName: "",
    trainingDate: today,
    documentDate: today,
    durationHours: 2,
    trainingPlace: "",
    trainingMethod: "Uygulamalı",
    trainerName: "",
    includeSpecialistSignature: false,
    includeDoctorSignature: false,
    hideNationalId: false,
    logoDataUrl: null,
    notes: "",
    status: "Taslak",
    participants: [],
    topics: orientationDefaultTopics,
  };
}

export function companyDisplayName(company: Company) {
  return company.company_name || (company as unknown as { name?: string }).name || "Firma";
}

export function getEmployeeFullName(employee: Employee) {
  return (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();
}

export function employeeToOrientationParticipant(employee: Employee): OrientationTrainingParticipant {
  return {
    id: createClientId("participant"),
    employeeId: employee.id,
    fullName: getEmployeeFullName(employee),
    nationalId: employee.tc_number || "",
    jobTitle: employee.job_title || employee.insured_job_name || "",
    department: employee.department || "",
    startDate: employee.start_date || null,
  };
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

export function formatDateTr(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

export function maskNationalId(value?: string | null) {
  const clean = String(value || "").replace(/\D/g, "");
  if (clean.length < 4) return clean || "-";
  return `${clean.slice(0, 3)}******${clean.slice(-2)}`;
}

export function validateOrientationTraining(record: OrientationTrainingRecord) {
  const errors: string[] = [];
  if (!record.companyId) errors.push("Firma seçimi zorunlu.");
  if (!record.trainingDate) errors.push("Eğitim tarihi zorunlu.");
  if (!record.durationHours || record.durationHours <= 0) errors.push("Eğitim süresi sıfırdan büyük olmalı.");
  if (!record.trainingPlace.trim()) errors.push("Eğitim yeri zorunlu.");
  if (!record.trainerName.trim()) errors.push("Eğitimi veren kişi zorunlu.");
  if (!record.topics.length) errors.push("En az bir eğitim konusu seçilmeli.");
  if (!record.participants.length) errors.push("Tutanak için en az bir çalışan eklenmeli.");
  return errors;
}

export async function loadOrientationCompanies(): Promise<Company[]> {
  const { data, error } = await db.from("companies").select("*").eq("is_active", true).order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Company[];
}

export async function loadOrientationCompanyEmployees(companyId: string): Promise<Employee[]> {
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

export async function saveOrientationTrainingRecord(record: OrientationTrainingRecord, userId: string, organizationId?: string | null) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || record.organizationId || null,
    company_id: record.companyId || null,
    company_name: record.companyName,
    training_date: record.trainingDate,
    document_date: record.documentDate,
    duration_hours: record.durationHours,
    training_place: record.trainingPlace,
    training_method: record.trainingMethod,
    trainer_name: record.trainerName,
    include_specialist_signature: record.includeSpecialistSignature,
    include_doctor_signature: record.includeDoctorSignature,
    hide_national_id: record.hideNationalId,
    logo_data_url: record.logoDataUrl || null,
    notes: record.notes,
    status: "Kaydedildi",
    updated_at: new Date().toISOString(),
  };

  const query = record.id
    ? db.from("orientation_training_records").update(payload).eq("id", record.id).select("*").single()
    : db.from("orientation_training_records").insert(payload).select("*").single();

  const { data: saved, error } = await query;
  if (error) throw error;

  await db.from("orientation_training_participants").delete().eq("record_id", saved.id);
  await db.from("orientation_training_topics").delete().eq("record_id", saved.id);

  if (record.participants.length) {
    const rows = record.participants.map((participant, index) => ({
      record_id: saved.id,
      employee_id: participant.employeeId || null,
      full_name: participant.fullName,
      national_id: participant.nationalId,
      job_title: participant.jobTitle,
      department: participant.department,
      start_date: participant.startDate || null,
      sort_order: index,
    }));
    const { error: participantError } = await db.from("orientation_training_participants").insert(rows);
    if (participantError) throw participantError;
  }

  if (record.topics.length) {
    const rows = record.topics.map((topic, index) => ({
      record_id: saved.id,
      title: topic,
      is_selected: true,
      sort_order: index,
    }));
    const { error: topicError } = await db.from("orientation_training_topics").insert(rows);
    if (topicError) throw topicError;
  }

  return { ...record, id: saved.id, status: "Kaydedildi" as const };
}

function splitColumns<T>(items: T[]) {
  const midpoint = Math.ceil(items.length / 2);
  return [items.slice(0, midpoint), items.slice(midpoint)];
}

function drawHeader(doc: any, record: OrientationTrainingRecord, fontName: string) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(10, 10, 190, 20);
  doc.line(50, 10, 50, 30);
  if (record.logoDataUrl) {
    try {
      doc.addImage(record.logoDataUrl, "PNG", 15, 13, 28, 14, undefined, "FAST");
    } catch {
      // Logo formatı desteklenmezse başlık bozulmasın.
    }
  }
  doc.setFont(fontName, "bold");
  doc.setFontSize(11);
  doc.text("İŞBAŞI / ORYANTASYON İSG EĞİTİM TUTANAĞI", 125, 21, { align: "center" });
}

export async function generateOrientationTrainingPdf(record: OrientationTrainingRecord) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontsLoaded = addInterFontsToJsPDF(doc);
  const fontName = fontsLoaded ? "Inter" : "helvetica";
  doc.setFont(fontName, "normal");

  record.participants.forEach((participant, pageIndex) => {
    if (pageIndex > 0) doc.addPage();
    drawHeader(doc, record, fontName);

    autoTable(doc, {
      startY: 36,
      theme: "grid",
      margin: { left: 10, right: 10 },
      styles: { font: fontName, fontSize: 6.8, cellPadding: 1.6, textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
      body: [
        [
          "6331 sayılı İş Sağlığı ve Güvenliği Kanunu Madde 17 ile 15.05.2013 tarih ve 28648 sayılı Resmi Gazete'de yayımlanan Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik hükümleri gereği; çalışanların işe başlamadan önce işyerine özgü iş sağlığı ve güvenliği tedbirlerine ilişkin uygulamalı işbaşı/oryantasyon eğitimi verilmiştir.",
        ],
      ],
      columnStyles: { 0: { cellWidth: 190 } },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      theme: "grid",
      margin: { left: 10, right: 10 },
      styles: { font: fontName, fontSize: 7, cellPadding: 1.6, textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
      headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
      head: [[{ content: "ÇALIŞAN VE EĞİTİM BİLGİLERİ", colSpan: 4 }]],
      body: [
        ["Adı Soyadı", participant.fullName || "-", "Firma / İşyeri", record.companyName || "-"],
        ["T.C. Kimlik No", record.hideNationalId ? maskNationalId(participant.nationalId) : participant.nationalId || "-", "Eğitim Tarihi", formatDateTr(record.trainingDate)],
        ["Görevi / Ünvanı", participant.jobTitle || "-", "Eğitim Yeri", record.trainingPlace || "-"],
        ["Departmanı", participant.department || "-", "Süre", `${record.durationHours} Saat`],
        ["İşe Giriş Tarihi", formatDateTr(participant.startDate), "Eğitim Yöntemi", record.trainingMethod || "-"],
      ],
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold" },
        1: { cellWidth: 65 },
        2: { cellWidth: 30, fontStyle: "bold" },
        3: { cellWidth: 65 },
      },
    });

    const [leftTopics, rightTopics] = splitColumns(record.topics);
    const maxRows = Math.max(leftTopics.length, rightTopics.length);
    const topicRows = Array.from({ length: maxRows }).map((_, index) => [
      leftTopics[index] ? `✓ ${leftTopics[index]}` : "",
      rightTopics[index] ? `✓ ${rightTopics[index]}` : "",
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 2,
      theme: "grid",
      margin: { left: 10, right: 10 },
      styles: { font: fontName, fontSize: 6.7, cellPadding: 1.3, textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
      headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
      head: [[{ content: "VERİLEN EĞİTİM KONULARI", colSpan: 2 }]],
      body: topicRows,
      columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 95 } },
      didParseCell: (data: any) => {
        if (data.section === "body" && String(data.cell.raw || "").startsWith("✓")) {
          data.cell.styles.textColor = [15, 118, 110];
        }
      },
    });

    const declarationY = Math.max((doc as any).lastAutoTable.finalY + 8, 146);
    autoTable(doc, {
      startY: declarationY,
      theme: "grid",
      margin: { left: 10, right: 10 },
      styles: { font: fontName, fontSize: 7.2, cellPadding: 2, textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
      body: [
        [
          record.notes ||
            "Yukarıda belirtilen işbaşı/oryantasyon iş sağlığı ve güvenliği eğitimini aldığımı; konuları anladığımı, kullanacağım iş ekipmanlarını ve işyerine özgü riskleri öğrendiğimi, belirtilen kurallara uyacağımı beyan ederim.",
        ],
      ],
      columnStyles: { 0: { cellWidth: 190 } },
    });

    const signatureCells = [
      `EĞİTİMİ ALAN (Çalışan)\n\n${participant.fullName || "Ad Soyad"}\n\nİmza`,
      `EĞİTİMİ VEREN (Eğitici)\n\n${record.trainerName || "Ad Soyad"}\n\nİmza`,
      record.includeSpecialistSignature ? "İŞ GÜVENLİĞİ UZMANI\n\nAd Soyad\n\nİmza" : "",
      record.includeDoctorSignature ? "İŞYERİ HEKİMİ\n\nAd Soyad\n\nİmza" : "",
    ].filter(Boolean);

    autoTable(doc, {
      startY: Math.max((doc as any).lastAutoTable.finalY + 4, 170),
      theme: "grid",
      margin: { left: 10, right: 10 },
      styles: { font: fontName, fontSize: 6.8, cellPadding: 2, halign: "center", valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.25, minCellHeight: 24 },
      body: [signatureCells],
      columnStyles: Object.fromEntries(signatureCells.map((_, index) => [index, { cellWidth: 190 / signatureCells.length }])),
    });

    doc.setFontSize(7);
    doc.setTextColor(90, 96, 110);
    doc.text(`Sayfa ${pageIndex + 1} / ${record.participants.length}`, 105, 286, { align: "center" });
  });

  doc.save(`Isbasi_Oryantasyon_Egitim_Tutanagi_${safeFileName(record.companyName || "Firma")}_${record.documentDate}.pdf`);
}
