import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/types/companies";

export type WorkPermitType = "hot-work" | "height-work" | "confined-space" | "electrical-work";

export interface WorkPermitApprover {
  id: string;
  title: string;
  fullName: string;
  signatureDataUrl?: string;
}

export interface WorkPermitRecord {
  id?: string;
  userId?: string;
  organizationId?: string | null;
  companyId: string;
  companyName: string;
  contractorName: string;
  companyAddress: string;
  workplaceRegistrationNumber: string;
  hazardClass: string;
  workLocation: string;
  workDetail: string;
  startDateTime: string;
  endDateTime: string;
  permitTypes: WorkPermitType[];
  safetyChecks: string[];
  ppeItems: string[];
  approvers: WorkPermitApprover[];
  status: "Taslak" | "Onaylandı";
  createdAt?: string;
  updatedAt?: string;
}

type JsPdfConstructor = new (options?: Record<string, unknown>) => any;

const db = supabase as any;

export const workPermitTypes: Array<{
  id: WorkPermitType;
  label: string;
  description: string;
}> = [
  { id: "hot-work", label: "Sıcak İş Çalışması", description: "Kaynak, taşlama, kesme ve kıvılcım çıkaran işler" },
  { id: "height-work", label: "Yüksekte Çalışma", description: "Seviye farkı bulunan alanlarda yapılan işler" },
  { id: "confined-space", label: "Kapalı Alan", description: "Tank, silo, kuyu, kazan ve benzeri kapalı hacimler" },
  { id: "electrical-work", label: "Elektrik Çalışması", description: "Enerji, pano, kablo ve ekipman müdahaleleri" },
];

export const workPermitSafetyChecks = [
  "Çalışma alanı sınırlandırıldı / Uyarı levhaları asıldı",
  "Acil durum planı ve iletişim hazır",
  "İlk yardım malzemeleri kontrol edildi",
  "Çalışanlar iş güvenliği eğitimi aldı",
  "Risk değerlendirmesi yapıldı ve paylaşıldı",
  "Yangın söndürme tüpü hazır (Sıcak İş)",
  "Yanıcı malzemeler uzaklaştırıldı (Sıcak İş)",
  "Yangın gözetlemecisi görevlendirildi (Sıcak İş)",
  "Yaşam hattı / Emniyet kemeri kontrol edildi",
  "İskele ve platformlar kontrol edildi",
  "Düşme önleme sistemleri kuruldu",
  "Gaz ölçümü yapıldı ve uygun (Kapalı Alan)",
  "Havalandırma sistemi çalışıyor (Kapalı Alan)",
  "Kurtarma ekipmanları hazır (Kapalı Alan)",
  "Enerji kesildi ve kilitlendi (LOTO)",
  "Topraklama kontrolü yapıldı (Elektrik)",
];

export const workPermitPpeItems = [
  "Baret",
  "İş Ayakkabısı",
  "Reflektörlü Yelek",
  "Koruyucu Gözlük",
  "Kaynak Maskesi",
  "Emniyet Kemeri",
  "Gaz Maskesi",
  "Kulaklık",
];

export function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyWorkPermitRecord(organizationId?: string | null): WorkPermitRecord {
  return {
    organizationId: organizationId ?? null,
    companyId: "",
    companyName: "",
    contractorName: "",
    companyAddress: "",
    workplaceRegistrationNumber: "",
    hazardClass: "",
    workLocation: "",
    workDetail: "",
    startDateTime: "",
    endDateTime: "",
    permitTypes: [],
    safetyChecks: [],
    ppeItems: [],
    approvers: [
      { id: createClientId("approver"), title: "Mühendis", fullName: "" },
      { id: createClientId("approver"), title: "İSG Uzmanı", fullName: "" },
    ],
    status: "Taslak",
  };
}

export function companyDisplayName(company: Company) {
  return company.company_name || (company as unknown as { name?: string }).name || "Firma";
}

export function applyCompanyToWorkPermit(record: WorkPermitRecord, company: Company): WorkPermitRecord {
  const name = companyDisplayName(company);
  return {
    ...record,
    companyId: company.id,
    companyName: name,
    contractorName: record.contractorName || name,
    companyAddress: company.address || "",
    workplaceRegistrationNumber: company.workplace_registration_number || company.sgk_workplace_number || "",
    hazardClass: company.hazard_class || "",
  };
}

export async function loadWorkPermitCompanies(): Promise<Company[]> {
  const { data, error } = await db.from("companies").select("*").eq("is_active", true);
  if (error) throw error;
  return ((data || []) as Company[]).sort((a, b) => companyDisplayName(a).localeCompare(companyDisplayName(b), "tr-TR"));
}

export function validateWorkPermit(record: WorkPermitRecord) {
  const errors: string[] = [];
  if (!record.companyId && !record.contractorName.trim()) errors.push("Firma / yüklenici adı zorunlu.");
  if (!record.workLocation.trim()) errors.push("Çalışma alanı / lokasyon zorunlu.");
  if (!record.workDetail.trim()) errors.push("Yapılacak iş detayı zorunlu.");
  if (!record.startDateTime) errors.push("Başlangıç zamanı zorunlu.");
  if (!record.endDateTime) errors.push("Bitiş zamanı zorunlu.");
  if (!record.permitTypes.length) errors.push("En az bir izin türü seçilmeli.");
  return errors;
}

export async function saveWorkPermitRecord(record: WorkPermitRecord, userId: string, organizationId?: string | null) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || record.organizationId || null,
    company_id: record.companyId || null,
    company_name: record.companyName,
    contractor_name: record.contractorName,
    company_address: record.companyAddress,
    workplace_registration_number: record.workplaceRegistrationNumber,
    hazard_class: record.hazardClass,
    work_location: record.workLocation,
    work_detail: record.workDetail,
    start_date_time: record.startDateTime || null,
    end_date_time: record.endDateTime || null,
    permit_types: record.permitTypes,
    safety_checks: record.safetyChecks,
    ppe_items: record.ppeItems,
    approvers: record.approvers,
    status: record.status,
  };

  const query = record.id
    ? db.from("work_permit_records").update(payload).eq("id", record.id).select("*").single()
    : db.from("work_permit_records").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw error;
  return data as Record<string, unknown>;
}

function formatDateTimeTr(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

async function loadPdfTools() {
  const [{ default: jsPDF }, { addInterFontsToJsPDF }] = await Promise.all([
    import("jspdf"),
    import("@/utils/fonts"),
  ]);
  return { jsPDF: jsPDF as JsPdfConstructor, addInterFontsToJsPDF };
}

function drawSectionHeader(doc: any, x: number, y: number, width: number, title: string, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.rect(x, y, width, 7.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("Inter", "bold");
  doc.setFontSize(8);
  doc.text(title, x + 3, y + 5);
}

function drawText(doc: any, text: string, x: number, y: number, options: Record<string, unknown> = {}) {
  doc.setTextColor(15, 23, 42);
  doc.setFont("Inter", "normal");
  doc.setFontSize(7);
  doc.text(text, x, y, options);
}

function drawBoldText(doc: any, text: string, x: number, y: number, options: Record<string, unknown> = {}) {
  doc.setTextColor(15, 23, 42);
  doc.setFont("Inter", "bold");
  doc.setFontSize(7);
  doc.text(text, x, y, options);
}

function dataUrlImageType(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg") ? "JPEG" : "PNG";
}

function drawSignatureBox(doc: any, approver: WorkPermitApprover, x: number, y: number, width: number, height: number) {
  doc.setDrawColor(198, 204, 212);
  doc.setFillColor(244, 246, 248);
  doc.rect(x, y, width, height, "FD");
  drawBoldText(doc, approver.title || "-", x + 3, y + 6);
  drawText(doc, approver.fullName || "-", x + 3, y + 14);

  if (approver.signatureDataUrl) {
    try {
      doc.addImage(approver.signatureDataUrl, dataUrlImageType(approver.signatureDataUrl), x + 16, y + 16, width - 32, 16, undefined, "FAST");
    } catch (error) {
      console.warn("İmza görseli PDF'e eklenemedi:", error);
    }
  } else {
    doc.setDrawColor(150, 150, 150);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(x + 8, y + height - 10, x + width - 8, y + height - 10);
    doc.setLineDashPattern([], 0);
  }

  doc.setTextColor(120, 120, 120);
  doc.setFont("Inter", "normal");
  doc.setFontSize(6);
  doc.text("İmza", x + width / 2, y + height - 4, { align: "center" });
}

export async function generateWorkPermitPdf(record: WorkPermitRecord) {
  const { jsPDF, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;

  doc.setFillColor(245, 247, 250);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("Inter", "bold");
  doc.setFontSize(15);
  doc.text("İŞ İZİN FORMU", marginX, 14.5);
  doc.setFontSize(8);
  doc.text(`İzin No: #${record.id || "2026-0000"}`, pageWidth - marginX, 14.5, { align: "right" });

  let y = 34;

  drawSectionHeader(doc, marginX, y, contentWidth, "1. İŞ TANIMI VE LOKASYON", [51, 65, 85]);
  y += 10;
  doc.setDrawColor(198, 204, 212);
  doc.setFillColor(239, 242, 245);
  doc.rect(marginX, y, contentWidth, 31, "FD");
  drawBoldText(doc, "Firma / Yüklenici:", marginX + 3, y + 6);
  drawText(doc, record.contractorName || record.companyName || "-", marginX + 32, y + 6);
  drawBoldText(doc, "Başlangıç:", marginX + 94, y + 6);
  drawText(doc, formatDateTimeTr(record.startDateTime), marginX + 116, y + 6);
  drawBoldText(doc, "Çalışma Alanı:", marginX + 3, y + 13);
  drawText(doc, record.workLocation || "-", marginX + 32, y + 13);
  drawBoldText(doc, "Bitiş:", marginX + 94, y + 13);
  drawText(doc, formatDateTimeTr(record.endDateTime), marginX + 116, y + 13);
  drawBoldText(doc, "İş Detayı:", marginX + 3, y + 20);
  const detailLines = doc.splitTextToSize(record.workDetail || "-", contentWidth - 36).slice(0, 2);
  drawText(doc, detailLines, marginX + 32, y + 20);
  y += 37;

  drawSectionHeader(doc, marginX, y, contentWidth, "2. İZİN TÜRÜ", [226, 116, 0]);
  y += 10;
  doc.setDrawColor(198, 204, 212);
  doc.setFillColor(239, 242, 245);
  doc.rect(marginX, y, contentWidth, 14, "FD");
  let tagX = marginX + 5;
  workPermitTypes
    .filter((item) => record.permitTypes.includes(item.id))
    .forEach((item) => {
      const tagWidth = Math.max(28, doc.getTextWidth(item.label) + 7);
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(tagX, y + 4, tagWidth, 6, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("Inter", "bold");
      doc.setFontSize(6);
      doc.text(item.label, tagX + 3, y + 8);
      tagX += tagWidth + 4;
    });
  y += 20;

  drawSectionHeader(doc, marginX, y, contentWidth, "3. GÜVENLİK ÖNLEMLERİ KONTROL LİSTESİ", [22, 163, 74]);
  y += 10;
  const safetyBoxHeight = 43;
  doc.setDrawColor(198, 204, 212);
  doc.setFillColor(239, 242, 245);
  doc.rect(marginX, y, contentWidth, safetyBoxHeight, "FD");
  const selectedSafety = record.safetyChecks.length ? record.safetyChecks : workPermitSafetyChecks.filter((_, index) => index < 10);
  selectedSafety.slice(0, 12).forEach((item, index) => {
    const col = index < 6 ? 0 : 1;
    const row = index % 6;
    const x = marginX + 5 + col * (contentWidth / 2);
    const textY = y + 7 + row * 6;
    doc.setFillColor(22, 163, 74);
    doc.rect(x, textY - 3.2, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Inter", "bold");
    doc.setFontSize(5);
    doc.text("✓", x + 0.6, textY - 0.8);
    const lines = doc.splitTextToSize(item, contentWidth / 2 - 14).slice(0, 1);
    drawText(doc, lines, x + 5, textY - 0.6);
  });
  y += safetyBoxHeight + 10;

  drawSectionHeader(doc, marginX, y, contentWidth, "4. KİŞİSEL KORUYUCU DONANIMLAR", [147, 51, 234]);
  y += 10;
  doc.setDrawColor(198, 204, 212);
  doc.setFillColor(239, 242, 245);
  doc.rect(marginX, y, contentWidth, 14, "FD");
  tagX = marginX + 5;
  (record.ppeItems.length ? record.ppeItems : workPermitPpeItems.slice(0, 4)).slice(0, 6).forEach((item) => {
    const tagWidth = Math.max(24, doc.getTextWidth(item) + 7);
    doc.setFillColor(124, 58, 237);
    doc.roundedRect(tagX, y + 4, tagWidth, 6, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Inter", "bold");
    doc.setFontSize(6);
    doc.text(item, tagX + 3, y + 8);
    tagX += tagWidth + 4;
  });
  y += 20;

  drawSectionHeader(doc, marginX, y, contentWidth, "5. ONAY VE İMZALAR", [71, 85, 105]);
  y += 10;
  const gap = 10;
  const boxWidth = (contentWidth - gap) / 2;
  const boxHeight = 32;
  const approvers = record.approvers.slice(0, 2);
  drawSignatureBox(doc, approvers[0] || { id: "a1", title: "Mühendis", fullName: "" }, marginX, y, boxWidth, boxHeight);
  drawSignatureBox(doc, approvers[1] || { id: "a2", title: "İSG Uzmanı", fullName: "" }, marginX + boxWidth + gap, y, boxWidth, boxHeight);

  doc.setFillColor(226, 232, 240);
  doc.rect(0, pageHeight - 12, pageWidth, 12, "F");

  const fileName = `${safeFileName(record.contractorName || record.companyName || "Is_Izin_Formu")}_Is_Izin_Formu.pdf`;
  doc.save(fileName);
}
