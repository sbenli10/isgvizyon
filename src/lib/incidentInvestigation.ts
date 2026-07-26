import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/types/companies";

export type IncidentWizardStatus = "Taslak" | "Tamamlandı";
export type IshikawaKey = "man" | "machine" | "method" | "material" | "measurement" | "environment";

const fiveWhyQuestions = [
  "Neden yaralandı?",
  "Neden bu durum oluştu?",
  "Neden önlem alınmadı?",
  "Neden sistem bunu engellemedi?",
  "Kök neden nedir?",
];
export type CorrectiveActionStatus = "Açık" | "Kapalı";

export interface IncidentCorrectiveAction {
  id: string;
  actionType?: string;
  action: string;
  responsible: string;
  targetDate: string;
  status: CorrectiveActionStatus;
}

export interface IncidentInvestigationRecord {
  id?: string;
  userId?: string;
  organizationId?: string | null;
  companyId: string;
  companyName: string;
  companyAddress: string;
  workplaceRegistrationNumber: string;
  hazardClass: string;
  employerName: string;
  incidentDateTime: string;
  incidentPlace: string;
  injuredEmployeeName: string;
  injuredEmployeeJobTitle: string;
  injuredEmployeeSeniority: string;
  incidentSummary: string;
  fiveWhyAnswers: string[];
  ishikawa: Record<IshikawaKey, string[]>;
  correctiveActions: IncidentCorrectiveAction[];
  evidencePhotoDataUrl?: string | null;
  criticalNotes: string;
  status: IncidentWizardStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface IncidentInvestigationHistoryItem {
  id: string;
  companyName: string;
  incidentDateTime: string;
  injuredEmployeeName: string;
  status: IncidentWizardStatus;
  updatedAt: string;
}

type JsPdfConstructor = new (options?: Record<string, unknown>) => any;

const db = supabase as any;

export const ishikawaCategories: Array<{
  key: IshikawaKey;
  title: string;
  subtitle: string;
  examples: string[];
}> = [
  {
    key: "man",
    title: "İnsan (Man)",
    subtitle: "Çalışanın bilgi, beceri, davranış ve psikolojik durumuna bağlı faktörler",
    examples: ["Eğitim eksikliği", "Yorgunluk / dikkatsizlik", "Yetkinlik yetersizliği"],
  },
  {
    key: "machine",
    title: "Makine (Machine)",
    subtitle: "Kullanılan ekipman, araç gereç ve makinelerle ilişkili sorunlar",
    examples: ["Bakımı yapılmayan ekipman", "Koruyucusu olmayan makine", "Uygunsuz el aleti"],
  },
  {
    key: "method",
    title: "Metot (Method)",
    subtitle: "Çalışma prosedürleri, talimatlar ve iş yapış şekillerindeki eksiklikler",
    examples: ["Talimat olmaması", "Yanlış çalışma prosedürü", "Risk analizindeki eksiklikler"],
  },
  {
    key: "material",
    title: "Malzeme (Material)",
    subtitle: "Kullanılan malzemeler, KKD ve ham maddelere ilişkin sorunlar",
    examples: ["Standart dışı KKD", "Kalitesiz ham madde", "Uygunsuz kimyasal madde"],
  },
  {
    key: "measurement",
    title: "Ölçüm (Measurement)",
    subtitle: "Ölçüm, kalibrasyon, denetim ve kontrol sistemlerindeki aksaklıklar",
    examples: ["Hatalı kalibrasyon", "Yetersiz ortam ölçümü", "Yetersiz gözle denetim"],
  },
  {
    key: "environment",
    title: "Çevre / Ortam (Environment)",
    subtitle: "Fiziksel çalışma ortamı ve çevresel koşullara bağlı faktörler",
    examples: ["Kötü aydınlatma", "Kaygan zemin", "Aşırı sıcaklık / soğuk"],
  },
];

async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }, { addInterFontsToJsPDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("@/utils/fonts"),
  ]);
  return { jsPDF: jsPDF as JsPdfConstructor, autoTable, addInterFontsToJsPDF };
}

export function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyIncidentInvestigationRecord(organizationId?: string | null): IncidentInvestigationRecord {
  return {
    organizationId: organizationId ?? null,
    companyId: "",
    companyName: "",
    companyAddress: "",
    workplaceRegistrationNumber: "",
    hazardClass: "",
    employerName: "",
    incidentDateTime: "",
    incidentPlace: "",
    injuredEmployeeName: "",
    injuredEmployeeJobTitle: "",
    injuredEmployeeSeniority: "",
    incidentSummary: "",
    fiveWhyAnswers: ["", "", "", "", ""],
    ishikawa: {
      man: [],
      machine: [],
      method: [],
      material: [],
      measurement: [],
      environment: [],
    },
    correctiveActions: [],
    evidencePhotoDataUrl: null,
    criticalNotes: "",
    status: "Taslak",
  };
}

export function companyDisplayName(company: Company) {
  return company.company_name || (company as unknown as { name?: string }).name || "Firma";
}

export function getCompanyRegistryNo(company?: Company | null) {
  return company?.sgk_workplace_number || company?.workplace_registration_number || "";
}

export function applyCompanyToIncidentRecord(record: IncidentInvestigationRecord, company: Company): IncidentInvestigationRecord {
  return {
    ...record,
    companyId: company.id,
    companyName: companyDisplayName(company),
    companyAddress: company.address || "",
    workplaceRegistrationNumber: getCompanyRegistryNo(company),
    hazardClass: company.hazard_class || "",
    employerName: company.employer_representative_name || "",
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

export function formatDateTimeTr(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function validateIncidentInvestigation(record: IncidentInvestigationRecord) {
  const errors: string[] = [];
  if (!record.companyId) errors.push("Firma seçimi zorunlu.");
  if (!record.incidentDateTime) errors.push("Kaza tarihi ve saati zorunlu.");
  if (!record.incidentPlace.trim()) errors.push("Kaza yeri / bölümü zorunlu.");
  if (!record.injuredEmployeeName.trim()) errors.push("Kazazede adı soyadı zorunlu.");
  if (!record.incidentSummary.trim()) errors.push("Kaza özeti zorunlu.");
  return errors;
}

export async function loadIncidentInvestigationCompanies(): Promise<Company[]> {
  const { data, error } = await db.from("companies").select("*").eq("is_active", true);
  if (error) throw error;
  return ((data || []) as Company[]).sort((a, b) => companyDisplayName(a).localeCompare(companyDisplayName(b), "tr-TR"));
}

export async function loadIncidentInvestigationHistory(): Promise<IncidentInvestigationHistoryItem[]> {
  const { data, error } = await db
    .from("incident_investigation_reports")
    .select("id, company_name, incident_date_time, injured_employee_name, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    companyName: row.company_name || "",
    incidentDateTime: row.incident_date_time || "",
    injuredEmployeeName: row.injured_employee_name || "",
    status: row.status || "Taslak",
    updatedAt: row.updated_at || "",
  }));
}

export async function saveIncidentInvestigationRecord(
  record: IncidentInvestigationRecord,
  userId: string,
  organizationId?: string | null,
) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || record.organizationId || null,
    company_id: record.companyId || null,
    company_name: record.companyName,
    company_address: record.companyAddress,
    workplace_registration_number: record.workplaceRegistrationNumber,
    hazard_class: record.hazardClass,
    employer_name: record.employerName,
    incident_date_time: record.incidentDateTime ? new Date(record.incidentDateTime).toISOString() : null,
    incident_place: record.incidentPlace,
    injured_employee_name: record.injuredEmployeeName,
    injured_employee_job_title: record.injuredEmployeeJobTitle,
    injured_employee_seniority: record.injuredEmployeeSeniority,
    incident_summary: record.incidentSummary,
    five_why_answers: record.fiveWhyAnswers,
    ishikawa: record.ishikawa,
    corrective_actions: record.correctiveActions,
    evidence_photo_data_url: record.evidencePhotoDataUrl || null,
    critical_notes: record.criticalNotes,
    status: record.status,
    updated_at: new Date().toISOString(),
  };

  const query = record.id
    ? db.from("incident_investigation_reports").update(payload).eq("id", record.id).select("*").single()
    : db.from("incident_investigation_reports").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw error;
  return { ...record, id: data.id, status: data.status as IncidentWizardStatus };
}

function getAutoTableFinalY(doc: any, fallback = 30) {
  return doc.lastAutoTable?.finalY || fallback;
}

function addSectionTitle(doc: any, title: string, y: number, fontName: string) {
  doc.setFillColor(226, 232, 240);
  doc.setDrawColor(30, 41, 59);
  doc.rect(12, y, 186, 7, "FD");
  doc.setFont(fontName, "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y + 4.8);
}

export async function generateIncidentInvestigationPdf(record: IncidentInvestigationRecord) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontsLoaded = addInterFontsToJsPDF(doc);
  const fontName = fontsLoaded ? "Inter" : "helvetica";
  doc.setFont(fontName, "normal");
  doc.setTextColor(0, 0, 0);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2;
  const red = [185, 28, 28] as const;
  const orange = [217, 119, 6] as const;
  const teal = [13, 148, 136] as const;
  const paleYellow = [254, 249, 195] as const;

  const formatDateOnly = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("tr-TR");
  };

  const sectionLabel = (label: string, y: number) => {
    doc.setFont(fontName, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(red[0], red[1], red[2]);
    doc.text(label, marginX, y);
    doc.setTextColor(0, 0, 0);
  };

  doc.setFillColor(red[0], red[1], red[2]);
  doc.rect(0, 0, pageWidth, 16, "F");
  doc.setFont(fontName, "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("İŞ KAZASI İNCELEME VE KÖK NEDEN ANALİZ RAPORU", pageWidth / 2, 7.5, { align: "center" });
  doc.setFont(fontName, "normal");
  doc.setFontSize(5.5);
  doc.text("5 Neden Analizi • Kaza Nedenleri Analizi (6M Modeli) • Düzeltici Önleyici Faaliyetler", pageWidth / 2, 12, { align: "center" });
  doc.setTextColor(0, 0, 0);

  let y = 22;
  sectionLabel("1. GENEL BİLGİLER", y);
  autoTable(doc, {
    startY: y + 3,
    theme: "grid",
    margin: { left: marginX, right: marginX },
    styles: { font: fontName, fontSize: 7, cellPadding: 1.8, lineColor: [150, 150, 150], lineWidth: 0.25, textColor: [0, 0, 0] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 35 },
      1: { cellWidth: 58 },
      2: { fontStyle: "bold", cellWidth: 35 },
      3: { cellWidth: contentWidth - 128 },
    },
    body: [
      ["Kaza Tarihi", formatDateOnly(record.incidentDateTime), "Kaza Yeri", record.incidentPlace || "-"],
      ["Kazazede", record.injuredEmployeeName || "-", "Görev", record.injuredEmployeeJobTitle || "-"],
      ["Kıdem", record.injuredEmployeeSeniority || "-", "Durum", record.status || "-"],
    ],
  });

  y = getAutoTableFinalY(doc, y + 28) + 3;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: marginX, right: marginX },
    styles: { font: fontName, fontSize: 7, cellPadding: 1.8, lineColor: [150, 150, 150], lineWidth: 0.25, textColor: [0, 0, 0] },
    body: [
      [{ content: "KAZA ÖZETİ", styles: { fontStyle: "bold", fillColor: [248, 250, 252] } }],
      [record.incidentSummary || "-"],
    ],
  });

  y = getAutoTableFinalY(doc, y + 22) + 7;
  sectionLabel("2. KÖK NEDEN ANALİZİ (5 NEDEN)", y);
  const fiveWhyRows = fiveWhyQuestions
    .map((question, index) => [String(index + 1), question, record.fiveWhyAnswers[index] || "-"])
    .filter((row) => row[2] !== "-");
  autoTable(doc, {
    startY: y + 3,
    head: [["#", "Soru", "Yanıt"]],
    body: fiveWhyRows.length ? fiveWhyRows : [["-", "Henüz yanıt eklenmedi.", "-"]],
    theme: "grid",
    margin: { left: marginX, right: marginX },
    headStyles: { fillColor: [orange[0], orange[1], orange[2]], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    styles: { font: fontName, fontSize: 7, cellPadding: 1.8, lineColor: [150, 150, 150], lineWidth: 0.25, textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: paleYellow },
    columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 70, fontStyle: "bold" }, 2: { cellWidth: contentWidth - 80 } },
  });

  y = getAutoTableFinalY(doc, y + 45) + 7;
  if (y > 188) {
    doc.addPage();
    y = 18;
  }
  sectionLabel("3. KAZA NEDENLERİ ANALİZİ (6M MODELİ)", y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Kategori", "Bulgular"]],
    body: ishikawaCategories
      .filter((category) => record.ishikawa[category.key].length)
      .map((category) => [category.title, record.ishikawa[category.key].map((item, index) => `${index + 1}. ${item}`).join("\n")]),
    theme: "grid",
    margin: { left: marginX, right: marginX },
    headStyles: { fillColor: [teal[0], teal[1], teal[2]], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    styles: { font: fontName, fontSize: 7, cellPadding: 2, lineColor: [150, 150, 150], lineWidth: 0.25, textColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold" }, 1: { cellWidth: contentWidth - 45 } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index % 2 === 1) {
        data.cell.styles.fillColor = [248, 250, 252];
      }
    },
  });

  y = getAutoTableFinalY(doc, y + 55) + 7;
  if (record.correctiveActions.length) {
    if (y > 210) {
      doc.addPage();
      y = 18;
    }
    sectionLabel("4. DÜZELTİCİ VE ÖNLEYİCİ FAALİYETLER", y);
    autoTable(doc, {
      startY: y + 3,
      head: [["#", "Önlem Tipi", "Faaliyet", "Sorumlu", "Hedef Tarih", "Durum"]],
      body: record.correctiveActions.map((action, index) => [
        String(index + 1),
        action.actionType || "Yönetsel Önlem",
        action.action || "-",
        action.responsible || "-",
        action.targetDate || "-",
        action.status,
      ]),
      theme: "grid",
      margin: { left: marginX, right: marginX },
      headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { font: fontName, fontSize: 6.6, cellPadding: 1.8, lineColor: [150, 150, 150], lineWidth: 0.25 },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 28 }, 2: { cellWidth: 66 }, 3: { cellWidth: 30 }, 4: { cellWidth: 26 }, 5: { cellWidth: contentWidth - 158 } },
    });
    y = getAutoTableFinalY(doc, y + 36) + 7;
  }

  if (record.criticalNotes) {
    if (y > 218) {
      doc.addPage();
      y = 18;
    }
    sectionLabel("5. KRİTİK NOTLAR", y);
    autoTable(doc, {
      startY: y + 3,
      theme: "grid",
      margin: { left: marginX, right: marginX },
      styles: { font: fontName, fontSize: 7, cellPadding: 2, lineColor: [150, 150, 150], lineWidth: 0.25 },
      body: [[record.criticalNotes]],
    });
    y = getAutoTableFinalY(doc, y + 24) + 7;
  }

  if (y > 216) {
    doc.addPage();
    y = 18;
  }

  doc.setDrawColor(150, 150, 150);
  doc.line(marginX, y, pageWidth - marginX, y);
  autoTable(doc, {
    startY: y + 7,
    theme: "plain",
    margin: { left: marginX, right: marginX },
    styles: { font: fontName, fontSize: 7, halign: "center", valign: "middle", cellPadding: 1.5, textColor: [0, 0, 0] },
    body: [
      [
        { content: "HAZIRLAYAN\nİş Güvenliği Uzmanı", styles: { fontStyle: "bold" } },
        { content: "ONAYLAYAN\nİşyeri Hekimi", styles: { fontStyle: "bold" } },
        { content: "İŞVEREN / VEKİLİ", styles: { fontStyle: "bold" } },
      ],
      ["", "", ""],
    ],
    columnStyles: { 0: { cellWidth: contentWidth / 3 }, 1: { cellWidth: contentWidth / 3 }, 2: { cellWidth: contentWidth / 3 } },
    didDrawCell: (data: any) => {
      if (data.section === "body" && data.row.index === 1) {
        doc.setDrawColor(150, 150, 150);
        doc.rect(data.cell.x + 4, data.cell.y, data.cell.width - 8, 18);
      }
    },
  });

  doc.setFont(fontName, "normal");
  doc.setFontSize(6);
  doc.setTextColor(120, 120, 120);
  doc.text("Sayfa 1", pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.text(`Oluşturulma: ${new Date().toLocaleDateString("tr-TR")}`, pageWidth - marginX, pageHeight - 8, { align: "right" });

  if (record.evidencePhotoDataUrl) {
    doc.addPage();
    doc.setFillColor(red[0], red[1], red[2]);
    doc.rect(0, 0, pageWidth, 14, "F");
    doc.setFont(fontName, "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("KAZA YERİ FOTOĞRAFI", pageWidth / 2, 9, { align: "center" });
    try {
      const imageFormat = record.evidencePhotoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(record.evidencePhotoDataUrl, imageFormat, marginX, 24, contentWidth, 120, undefined, "FAST");
    } catch {
      doc.setTextColor(0, 0, 0);
      doc.setFont(fontName, "normal");
      doc.setFontSize(8);
      doc.text("Fotoğraf PDF'e eklenemedi; dosya formatı desteklenmiyor olabilir.", marginX, 30);
    }
    doc.setFont(fontName, "normal");
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text("Sayfa 2", pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  const fileName = `${safeFileName(record.companyName || "Is_Kazasi")}_Is_Kazasi_Inceleme_Raporu.pdf`;
  doc.save(fileName);
}
