import jsPDF from "jspdf";

import { addInterFontsToJsPDF } from "@/utils/fonts";
import type { DocumentAnalysisRecord, DocumentAnalysisType } from "@/lib/documentAnalysisTypes";

const PAGE = {
  width: 210,
  height: 297,
  marginX: 16,
  top: 18,
  bottom: 16,
};

const COLORS = {
  ink: [15, 23, 42] as const,
  body: [51, 65, 85] as const,
  muted: [100, 116, 139] as const,
  border: [226, 232, 240] as const,
  soft: [248, 250, 252] as const,
  primary: [37, 99, 235] as const,
  accent: [14, 165, 233] as const,
  high: [234, 88, 12] as const,
  critical: [220, 38, 38] as const,
  low: [22, 163, 74] as const,
  medium: [217, 119, 6] as const,
};

const typeLabelMap: Record<DocumentAnalysisType, string> = {
  legislation: "Mevzuat",
  internal_procedure: "İç prosedür",
  technical_instruction: "Teknik talimat",
  official_letter: "Denetim / resmî yazı",
  contractual_obligation: "Sözleşme / yükümlülük dokümanı",
};

function setFont(doc: jsPDF, weight: "normal" | "bold" = "normal") {
  doc.setFont("Inter", weight);
}

function setTextColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function setFillColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function sanitizeFileName(value: string) {
  return value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function splitText(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(text || "-", width) as string[];
}

function contentBottom() {
  return PAGE.height - PAGE.bottom;
}

function addPage(doc: jsPDF, title: string) {
  doc.addPage();
  setFillColor(doc, [255, 255, 255]);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  setFillColor(doc, COLORS.primary);
  doc.rect(0, 0, PAGE.width, 9, "F");
  setFont(doc, "bold");
  doc.setFontSize(11);
  setTextColor(doc, COLORS.primary);
  doc.text("İSGVizyon", PAGE.marginX, 17);
  setFont(doc, "bold");
  doc.setFontSize(17);
  setTextColor(doc, COLORS.ink);
  doc.text(title, PAGE.marginX, 27);
  setDrawColor(doc, COLORS.border);
  doc.line(PAGE.marginX, 31, PAGE.width - PAGE.marginX, 31);
  return 40;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, title: string) {
  if (y > 42 && y + needed > contentBottom()) {
    return addPage(doc, title);
  }
  return y;
}

function drawSection(
  doc: jsPDF,
  heading: string,
  body: string | string[],
  y: number,
  accent: readonly [number, number, number],
  pageTitle: string,
) {
  const lines = Array.isArray(body) ? body : splitText(doc, body || "-", PAGE.width - PAGE.marginX * 2 - 8);
  const height = Math.max(26, 14 + lines.length * 4.8);
  const nextY = ensureSpace(doc, y, height + 10, pageTitle);

  setFillColor(doc, [255, 255, 255]);
  setDrawColor(doc, COLORS.border);
  doc.roundedRect(PAGE.marginX, nextY, PAGE.width - PAGE.marginX * 2, height, 4, 4, "FD");
  setFillColor(doc, accent);
  doc.roundedRect(PAGE.marginX, nextY, PAGE.width - PAGE.marginX * 2, 6, 4, 4, "F");

  setFont(doc, "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(heading, PAGE.marginX + 4, nextY + 4.5);

  setFont(doc, "normal");
  doc.setFontSize(9.5);
  setTextColor(doc, COLORS.body);
  doc.text(lines, PAGE.marginX + 4, nextY + 12);

  return nextY + height + 8;
}

export async function generateDocumentAnalysisPdf(record: DocumentAnalysisRecord) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  addInterFontsToJsPDF(doc);

  setFillColor(doc, COLORS.soft);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  setFillColor(doc, COLORS.primary);
  doc.rect(0, 0, PAGE.width, 68, "F");
  setFillColor(doc, COLORS.accent);
  doc.circle(PAGE.width - 28, 20, 30, "F");

  setFont(doc, "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text("Mevzuat Belge Analizi", PAGE.marginX, 34);

  setFont(doc, "normal");
  doc.setFontSize(12);
  doc.text("Belge özeti, kritik yükümlülükler ve aksiyon önerileri", PAGE.marginX, 43);

  setFont(doc, "bold");
  doc.setFontSize(20);
  setTextColor(doc, COLORS.ink);
  doc.text(record.title || record.source_file_name, PAGE.marginX, 88);

  const infoRows = [
    ["Firma", record.company_name || "Bağlanmadı"],
    ["Belge tipi", typeLabelMap[record.document_type]],
    ["Dosya", record.source_file_name],
    ["Analiz tarihi", new Date(record.created_at).toLocaleDateString("tr-TR")],
  ];

  let y = 98;
  infoRows.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? PAGE.marginX : PAGE.width / 2 + 2;
    const rowY = y + Math.floor(index / 2) * 20;
    setFillColor(doc, [255, 255, 255]);
    setDrawColor(doc, COLORS.border);
    doc.roundedRect(x, rowY, 86, 16, 4, 4, "FD");
    setFont(doc, "normal");
    doc.setFontSize(8);
    setTextColor(doc, COLORS.muted);
    doc.text(label, x + 4, rowY + 6);
    setFont(doc, "bold");
    doc.setFontSize(11);
    setTextColor(doc, COLORS.ink);
    doc.text(String(value), x + 4, rowY + 12);
  });

  y = 145;
  y = drawSection(doc, "Belge Özeti", record.summary, y, COLORS.primary, "Belge Analizi");
  y = drawSection(
    doc,
    "Kritik Yükümlülükler",
    record.keyObligations.map((item, index) => `${index + 1}. ${item.title} - ${item.description}${item.legalBasis ? ` (${item.legalBasis})` : ""}`),
    y,
    COLORS.medium,
    "Belge Analizi",
  );
  y = drawSection(
    doc,
    "Dikkat Gerektiren Maddeler",
    record.criticalPoints.map((item, index) => `${index + 1}. ${item.title} - ${item.description}${item.whyItMatters ? ` / Neden önemli: ${item.whyItMatters}` : ""}`),
    y,
    COLORS.critical,
    "Belge Analizi",
  );
  y = drawSection(
    doc,
    "Uygulanabilir Aksiyon Önerileri",
    record.actionItems.map((item, index) => `${index + 1}. ${item.title} - ${item.description}`),
    y,
    COLORS.low,
    "Belge Analizi",
  );

  if (record.riskNotes.length > 0) {
    y = drawSection(
      doc,
      "Risk ve Uyum Notları",
      record.riskNotes.map((item, index) => `${index + 1}. ${item.title} - ${item.description}`),
      y,
      COLORS.accent,
      "Belge Analizi",
    );
  }

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    setDrawColor(doc, COLORS.border);
    doc.line(PAGE.marginX, PAGE.height - 10, PAGE.width - PAGE.marginX, PAGE.height - 10);
    setFont(doc, "normal");
    doc.setFontSize(8);
    setTextColor(doc, COLORS.muted);
    doc.text(`Oluşturulma: ${new Date().toLocaleString("tr-TR")}`, PAGE.marginX, PAGE.height - 5);
    doc.text(`Sayfa ${page} / ${total}`, PAGE.width - PAGE.marginX, PAGE.height - 5, { align: "right" });
  }

  doc.save(`${sanitizeFileName(record.title || record.source_file_name || "mevzuat-belge-analizi")}.pdf`);
}
