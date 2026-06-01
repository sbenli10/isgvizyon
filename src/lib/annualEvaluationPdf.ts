import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";

import type {
  AnnualEvaluationCompanyFormState,
  AnnualEvaluationWorkItem,
} from "@/lib/annualEvaluationOfficialDocx";
import { addInterFontsToJsPDF } from "@/utils/fonts";

export interface AnnualEvaluationPdfPayload {
  company: AnnualEvaluationCompanyFormState;
  works: AnnualEvaluationWorkItem[];
  year?: number;
}

const COLORS = {
  title: [15, 23, 42] as const,
  text: [51, 65, 85] as const,
  muted: [100, 116, 139] as const,
  border: [203, 213, 225] as const,
  soft: [248, 250, 252] as const,
  blue: [0, 102, 204] as const,
  white: [255, 255, 255] as const,
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const safeText = (value?: string | null) => {
  const text = String(value || "").trim();
  return text || "-";
};

const buildBody = (works: AnnualEvaluationWorkItem[]) =>
  works.map((item, index) => [
    String(index + 1),
    safeText(item.yapilanCalismalar),
    safeText(item.tarih),
    safeText(item.yapanKisiUnvani),
    safeText(item.tekrarSayisi),
    safeText(item.kullanilanYontem),
    safeText(item.sonucYorum),
  ]);

const drawHeader = (
  doc: jsPDF,
  payload: AnnualEvaluationPdfPayload,
  fontName: string,
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const year = payload.year || new Date().getFullYear();

  doc.setFont(fontName, "bold");
  doc.setTextColor(...COLORS.title);
  doc.setFontSize(18);
  doc.text(`YILLIK DEĞERLENDİRME RAPORU (${year})`, 15, 18);

  doc.setFont(fontName, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);

  doc.text(`İş Yerinin Unvanı: ${payload.company.isyeriUnvani || "-"}`, 15, 28);
  doc.text(`SGK / Bölge Müdürlüğü Sicil No: ${payload.company.sgkSicilNo || "-"}`, 15, 35);
  doc.text(`Tel ve Fax: ${payload.company.telFax || "-"}`, 15, 42);
  doc.text(`E-posta: ${payload.company.eposta || "-"}`, 15, 49);
  doc.text(`İşkolu: ${payload.company.iskolu || "-"}`, 15, 56);

  const addressLines = doc.splitTextToSize(`Adres: ${payload.company.adres || "-"}`, 150);
  doc.text(addressLines, pageWidth - 165, 28);

  doc.setFont(fontName, "bold");
  doc.text("Çalışan Sayısı", pageWidth - 165, 49);
  doc.setFont(fontName, "normal");
  doc.text(
    `Erkek: ${payload.company.calisanErkek || "-"}   Kadın: ${payload.company.calisanKadin || "-"}   Genç: ${payload.company.calisanGenc || "-"}   Çocuk: ${payload.company.calisanCocuk || "-"}   Toplam: ${payload.company.calisanToplam || "-"}`,
    pageWidth - 165,
    56,
  );
};

const drawSignatureBlock = (doc: jsPDF, fontName: string, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const blockY = startY + 12 > pageHeight - 45 ? pageHeight - 42 : startY + 12;

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(15, blockY, pageWidth - 30, 28, 2, 2);

  doc.setFont(fontName, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.title);
  doc.text("Tarih:", pageWidth / 2, blockY + 7, { align: "center" });
  doc.text("İş Güvenliği Uzmanı", 70, blockY + 18, { align: "center" });
  doc.text("İşveren / Vekili", pageWidth / 2, blockY + 18, { align: "center" });
  doc.text("İşyeri Hekimi", pageWidth - 70, blockY + 18, { align: "center" });
};

export const downloadAnnualEvaluationPdf = async (payload: AnnualEvaluationPdfPayload) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3",
    compress: true,
  });

  const interLoaded = addInterFontsToJsPDF(doc);
  const fontName = interLoaded ? "Inter" : "helvetica";
  doc.setFont(fontName, "normal");
  doc.setTextColor(...COLORS.text);

  drawHeader(doc, payload, fontName);

  autoTable(doc, {
    startY: 68,
    theme: "grid",
    head: [[
      "Sıra No.",
      "Yapılan Çalışmalar",
      "Tarih",
      "Yapan Kişi ve Unvanı",
      "Tekrar Sayısı",
      "Kullanılan Yöntem",
      "Sonuç ve Yorum",
    ]],
    body: buildBody(payload.works),
    styles: {
      font: fontName,
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 10,
    },
    headStyles: {
      fillColor: COLORS.soft,
      textColor: COLORS.title,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      lineColor: COLORS.border,
    },
    bodyStyles: {
      fillColor: COLORS.white,
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 58 },
      2: { cellWidth: 42, halign: "center" },
      3: { cellWidth: 62, halign: "center" },
      4: { cellWidth: 42, halign: "center" },
      5: { cellWidth: 58, halign: "center" },
      6: { cellWidth: 114 },
    },
    margin: { left: 15, right: 15, bottom: 18 },
    didParseCell: (hookData: CellHookData) => {
      if (hookData.section !== "body") return;

      const raw = String(hookData.cell.raw || "");
      if (["4 yılda 1", "3 yılda 1", "Yılda 1", "yılda 1"].some((value) => raw.includes(value))) {
        hookData.cell.styles.textColor = [...COLORS.blue];
      }
      if (hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const page = doc.getCurrentPageInfo().pageNumber;
      const total = doc.getNumberOfPages();

      doc.setDrawColor(...COLORS.border);
      doc.line(15, pageHeight - 10, pageWidth - 15, pageHeight - 10);
      doc.setFont(fontName, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(`Firma: ${payload.company.isyeriUnvani || "-"}`, 15, pageHeight - 5);
      doc.text(`Sayfa ${page} / ${total}`, pageWidth - 15, pageHeight - 5, { align: "right" });
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 68;
  drawSignatureBlock(doc, fontName, finalY);

  const fileName = sanitizeFileName(
    `Yillik-Degerlendirme-Raporu-${payload.company.isyeriUnvani || "Firma"}-${payload.year || new Date().getFullYear()}`,
  );
  doc.save(`${fileName}.pdf`);
};
