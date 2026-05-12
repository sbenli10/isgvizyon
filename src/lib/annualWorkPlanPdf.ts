import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import type { AnnualWorkPlanCompanyInfo, AnnualWorkPlanRow } from "@/lib/annualWorkPlanOfficialDocx";

export interface AnnualWorkPlanPdfPayload {
  company: AnnualWorkPlanCompanyInfo;
  rows: AnnualWorkPlanRow[];
}

const MONTH_HEADERS = [
  "OCAK",
  "ŞUBAT",
  "MART",
  "NİSAN",
  "MAYIS",
  "HAZİRAN",
  "TEMMUZ",
  "AĞUSTOS",
  "EYLÜL",
  "EKİM",
  "KASIM",
  "ARALIK",
] as const;

const COLORS = {
  title: [15, 23, 42] as const,
  text: [51, 65, 85] as const,
  muted: [100, 116, 139] as const,
  border: [203, 213, 225] as const,
  soft: [248, 250, 252] as const,
  red: [220, 38, 38] as const,
  redSoft: [254, 226, 226] as const,
  white: [255, 255, 255] as const,
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeRows = (rows: AnnualWorkPlanRow[]) =>
  rows.map((row) => ({
    ...row,
    months: Array.from({ length: 12 }, (_, index) => Boolean(row.months[index])),
  }));

const isMonthColumn = (index: number) => index >= 5;

const buildBody = (rows: AnnualWorkPlanRow[]) =>
  rows.map((row) => [
    row.activity,
    row.period,
    row.responsible,
    row.regulation,
    row.currentStatus,
    ...row.months.map((active) => (active ? "■" : "")),
  ]);

export const downloadAnnualWorkPlanPdf = async ({ company, rows }: AnnualWorkPlanPdfPayload) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3",
    compress: true,
  });

  const interLoaded = addInterFontsToJsPDF(doc);
  doc.setFont(interLoaded ? "Inter" : "helvetica", "bold");
  doc.setTextColor(...COLORS.title);
  doc.setFontSize(18);
  doc.text("İŞ SAĞLIĞI ve GÜVENLİĞİ YILLIK ÇALIŞMA PLANI", 15, 18);

  doc.setFont(interLoaded ? "Inter" : "helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.text(`${company.year} YILI ÇALIŞMA PLANI`, 15, 26);
  doc.text(`İş Yeri Unvanı: ${company.companyName || "-"}`, 15, 34);
  doc.text(`İş Yeri Sicil / Vergi No: ${company.registrationNumber || "-"}`, 15, 41);

  const addressLines = doc.splitTextToSize(
    `İş Yeri Adresi: ${company.address || "-"}`,
    140,
  );
  doc.text(addressLines, 150, 34);

  autoTable(doc, {
    startY: 50,
    theme: "grid",
    head: [[
      "PERİYODİK FAALİYETLER",
      "PERİYOT",
      "SORUMLU",
      "İLGİLİ MEVZUAT",
      "MEVCUT DURUM",
      ...MONTH_HEADERS,
    ]],
    body: buildBody(normalizeRows(rows)),
    styles: {
      font: interLoaded ? "Inter" : "helvetica",
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: COLORS.soft,
      textColor: COLORS.title,
      fontStyle: "bold",
      lineColor: COLORS.border,
      halign: "center",
      valign: "middle",
    },
    bodyStyles: {
      fillColor: COLORS.white,
    },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 20 },
      2: { cellWidth: 27 },
      3: { cellWidth: 61 },
      4: { cellWidth: 24 },
      5: { cellWidth: 9.8, halign: "center" },
      6: { cellWidth: 9.8, halign: "center" },
      7: { cellWidth: 9.8, halign: "center" },
      8: { cellWidth: 9.8, halign: "center" },
      9: { cellWidth: 9.8, halign: "center" },
      10: { cellWidth: 9.8, halign: "center" },
      11: { cellWidth: 9.8, halign: "center" },
      12: { cellWidth: 9.8, halign: "center" },
      13: { cellWidth: 9.8, halign: "center" },
      14: { cellWidth: 9.8, halign: "center" },
      15: { cellWidth: 9.8, halign: "center" },
      16: { cellWidth: 9.8, halign: "center" },
    },
    margin: { left: 10, right: 10, bottom: 16 },
    didParseCell: (hookData: CellHookData) => {
      if (hookData.section !== "body" || !isMonthColumn(hookData.column.index)) {
        return;
      }

      if (String(hookData.cell.raw).trim() === "■") {
        hookData.cell.styles.fillColor = [...COLORS.redSoft];
        hookData.cell.styles.textColor = [...COLORS.red];
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.halign = "center";
      } else {
        hookData.cell.text = [""];
      }
    },
    didDrawPage: () => {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const page = doc.getCurrentPageInfo().pageNumber;
      const total = doc.getNumberOfPages();

      doc.setDrawColor(...COLORS.border);
      doc.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);
      doc.setFont(interLoaded ? "Inter" : "helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(`Firma: ${company.companyName || "-"}`, 10, pageHeight - 5);
      doc.text(`Sayfa ${page} / ${total}`, pageWidth - 10, pageHeight - 5, { align: "right" });
    },
  });

  const fileName = sanitizeFileName(
    `Yillik-Calisma-Plani-${company.companyName || "Firma"}-${company.year}`,
  );
  doc.save(`${fileName}.pdf`);
};
