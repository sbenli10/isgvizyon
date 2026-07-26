import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/types/companies";
import { generatedSuggestionCatalog } from "./suggestionLedgerCatalog.generated";

export type SuggestionPriority = "Yüksek Öncelik" | "Orta Öncelik" | "Bilgilendirme" | "Genel";

export interface SuggestionCatalogItem {
  id: string;
  category: string;
  subCategory: string;
  priority: SuggestionPriority;
  finding: string;
  suggestion: string;
  legalReference: string;
  tags: string[];
}

export interface SuggestionLedgerEntry {
  id: string;
  catalogId?: string;
  category: string;
  priority: SuggestionPriority;
  finding: string;
  suggestion: string;
  legalReference: string;
}

export interface SuggestionLedgerRecord {
  id?: string;
  userId?: string;
  organizationId?: string | null;
  companyId: string;
  companyName: string;
  sgkRegistryNo: string;
  hazardClass: string;
  recordDate: string;
  generalNote: string;
  status: "Taslak" | "Kaydedildi";
  entries: SuggestionLedgerEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SuggestionLedgerHistoryItem {
  id: string;
  companyName: string;
  recordDate: string;
  status: SuggestionLedgerRecord["status"];
  entryCount: number;
  updatedAt: string;
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

export const suggestionCatalog: SuggestionCatalogItem[] = generatedSuggestionCatalog;
export const suggestionCategories = ["Tüm konular", ...Array.from(new Set(suggestionCatalog.map((item) => item.category))).sort((a, b) =>
  a.localeCompare(b, "tr-TR"),
)];
export const suggestionPriorities = ["Tüm öncelikler", "Yüksek Öncelik", "Orta Öncelik", "Bilgilendirme", "Genel"] as const;

export function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptySuggestionLedgerRecord(organizationId?: string | null): SuggestionLedgerRecord {
  return {
    organizationId: organizationId ?? null,
    companyId: "",
    companyName: "",
    sgkRegistryNo: "",
    hazardClass: "",
    recordDate: new Date().toISOString().slice(0, 10),
    generalNote: "",
    status: "Taslak",
    entries: [],
  };
}

export function companyDisplayName(company: Company) {
  return company.company_name || (company as unknown as { name?: string }).name || "Firma";
}

export function getCompanyRegistryNo(company?: Company | null) {
  return company?.sgk_workplace_number || company?.workplace_registration_number || "";
}

export function catalogItemToEntry(item: SuggestionCatalogItem): SuggestionLedgerEntry {
  return {
    id: createClientId("entry"),
    catalogId: item.id,
    category: item.category,
    priority: item.priority,
    finding: item.finding,
    suggestion: item.suggestion,
    legalReference: item.legalReference,
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

export function validateSuggestionLedger(record: SuggestionLedgerRecord) {
  const errors: string[] = [];
  if (!record.companyId) errors.push("Firma seçimi zorunlu.");
  if (!record.entries.length) errors.push("Deftere en az bir tespit ve öneri eklenmeli.");
  record.entries.forEach((entry, index) => {
    if (!entry.finding.trim()) errors.push(`${index + 1}. satır için tespit alanı zorunlu.`);
    if (!entry.suggestion.trim()) errors.push(`${index + 1}. satır için öneri alanı zorunlu.`);
  });
  return errors;
}

export async function loadSuggestionLedgerCompanies(): Promise<Company[]> {
  const { data, error } = await db
    .from("companies")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Company[];
}

export async function loadSuggestionLedgerHistory(): Promise<SuggestionLedgerHistoryItem[]> {
  const { data, error } = await db
    .from("suggestion_ledger_records")
    .select("id, company_name, record_date, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw error;

  const ids = (data || []).map((row: any) => row.id).filter(Boolean);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: rows } = await db.from("suggestion_ledger_entries").select("record_id").in("record_id", ids);
    (rows || []).forEach((row: any) => counts.set(row.record_id, (counts.get(row.record_id) || 0) + 1));
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyName: row.company_name || "",
    recordDate: row.record_date || "",
    status: row.status || "Taslak",
    updatedAt: row.updated_at,
    entryCount: counts.get(row.id) || 0,
  }));
}

export async function loadSuggestionLedgerRecord(id: string): Promise<SuggestionLedgerRecord> {
  const [{ data: record, error }, { data: entries, error: entriesError }] = await Promise.all([
    db.from("suggestion_ledger_records").select("*").eq("id", id).single(),
    db.from("suggestion_ledger_entries").select("*").eq("record_id", id).order("sort_order", { ascending: true }),
  ]);
  if (error) throw error;
  if (entriesError) throw entriesError;

  return {
    id: record.id,
    userId: record.user_id,
    organizationId: record.organization_id,
    companyId: record.company_id || "",
    companyName: record.company_name || "",
    sgkRegistryNo: record.sgk_registry_no || "",
    hazardClass: record.hazard_class || "",
    recordDate: record.record_date || "",
    generalNote: record.general_note || "",
    status: record.status || "Taslak",
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    entries: (entries || []).map((entry: any) => ({
      id: entry.id,
      category: entry.category || "",
      priority: entry.priority || "Genel",
      finding: entry.finding || "",
      suggestion: entry.suggestion || "",
      legalReference: entry.legal_reference || "",
    })),
  };
}

export async function saveSuggestionLedgerRecord(record: SuggestionLedgerRecord, userId: string, organizationId?: string | null) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || record.organizationId || null,
    company_id: record.companyId || null,
    company_name: record.companyName,
    sgk_registry_no: record.sgkRegistryNo,
    hazard_class: record.hazardClass,
    record_date: record.recordDate || new Date().toISOString().slice(0, 10),
    general_note: record.generalNote,
    status: "Kaydedildi",
    updated_at: new Date().toISOString(),
  };

  const query = record.id
    ? db.from("suggestion_ledger_records").update(payload).eq("id", record.id).select("*").single()
    : db.from("suggestion_ledger_records").insert(payload).select("*").single();

  const { data: saved, error } = await query;
  if (error) throw error;

  await db.from("suggestion_ledger_entries").delete().eq("record_id", saved.id);

  if (record.entries.length) {
    const entryRows = record.entries.map((entry, index) => ({
      record_id: saved.id,
      category: entry.category,
      finding: entry.finding,
      suggestion: entry.suggestion,
      legal_reference: entry.legalReference,
      priority: entry.priority,
      sort_order: index,
    }));
    const { error: entryError } = await db.from("suggestion_ledger_entries").insert(entryRows);
    if (entryError) throw entryError;
  }

  return loadSuggestionLedgerRecord(saved.id);
}

export async function deleteSuggestionLedgerRecord(id: string) {
  const { error } = await db.from("suggestion_ledger_records").delete().eq("id", id);
  if (error) throw error;
}

function addPageFooter(doc: any) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(90, 96, 110);
    doc.text(`Sayfa ${page} / ${pageCount}`, 105, 286, { align: "center" });
  }
}

export async function generateSuggestionLedgerPdf(record: SuggestionLedgerRecord) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontsLoaded = addInterFontsToJsPDF(doc);
  doc.setFont(fontsLoaded ? "Inter" : "helvetica", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const tableWidth = pageWidth - margin * 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, 10, tableWidth, 16);
  doc.setFont(fontsLoaded ? "Inter" : "helvetica", "bold");
  doc.setFontSize(11);
  doc.text("İŞ SAĞLIĞI VE GÜVENLİĞİ TESPİT VE ÖNERİ DEFTERİ", pageWidth / 2, 17, { align: "center" });
  doc.setFont(fontsLoaded ? "Inter" : "helvetica", "normal");
  doc.setFontSize(8);
  doc.text(record.companyName || "-", pageWidth / 2, 22, { align: "center" });

  autoTable(doc, {
    startY: 30,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: {
      font: fontsLoaded ? "Inter" : "helvetica",
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [15, 23, 42],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [238, 242, 248],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      halign: "left",
    },
    head: [["İŞYERİ BİLGİLERİ", ""]],
    body: [
      ["Firma Ünvanı", record.companyName || "-"],
      ["SGK Sicil No", record.sgkRegistryNo || "-"],
      ["Tehlike Sınıfı", record.hazardClass || "-"],
      ["Düzenleme Tarihi", formatDateTr(record.recordDate)],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: tableWidth - 42 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 5 || 62,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: {
      font: fontsLoaded ? "Inter" : "helvetica",
      fontSize: 7.2,
      cellPadding: 2,
      valign: "top",
      overflow: "linebreak",
      textColor: [15, 23, 42],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [238, 242, 248],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    head: [
      [{ content: "TESPİT VE ÖNERİLER", colSpan: 3 }],
      ["#", "TESPİT", "ÖNERİ"],
    ],
    body: record.entries.map((entry, index) => [
      String(index + 1),
      entry.finding,
      `${entry.suggestion}${entry.legalReference ? `\n\nYasal Dayanak: ${entry.legalReference}` : ""}`,
    ]),
    foot: [["", record.generalNote ? `Genel Not: ${record.generalNote}` : "Yasal Dayanak: 6331 s. K. m.10, İSG Risk Değerlendirmesi Yönetmeliği", ""]],
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [51, 65, 85],
      fontSize: 6.8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 86 },
      2: { cellWidth: tableWidth - 96 },
    },
  });

  const signatureY = 250;
  autoTable(doc, {
    startY: signatureY,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: {
      font: fontsLoaded ? "Inter" : "helvetica",
      fontSize: 7,
      cellPadding: 2,
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      minCellHeight: 22,
    },
    body: [
      ["İŞ GÜVENLİĞİ UZMANI\n\nAd Soyad\nİmza", "İŞYERİ HEKİMİ\n\nAd Soyad\nİmza", "İŞVEREN / İŞVEREN VEKİLİ\n\nAd Soyad\nİmza"],
    ],
    columnStyles: {
      0: { cellWidth: tableWidth / 3 },
      1: { cellWidth: tableWidth / 3 },
      2: { cellWidth: tableWidth / 3 },
    },
  });

  addPageFooter(doc);
  doc.save(`Tespit_ve_Oneri_Defteri_${safeFileName(record.companyName || "Firma")}_${record.recordDate || "taslak"}.pdf`);
}
