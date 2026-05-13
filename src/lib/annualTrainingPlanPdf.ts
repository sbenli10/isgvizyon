import jsPDF from "jspdf";

import type {
  AnnualTrainingPlanDocumentData,
  AnnualTrainingPlanItem,
} from "@/lib/annualTrainingPlanOfficialDocx";
import { addInterFontsToJsPDF } from "@/utils/fonts";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT = 10;
const TABLE_TOP = 48;
const TABLE_WIDTH = 190;
const DATA_ROWS_PER_PAGE = 12;
const HEADER_HEIGHT = 13;
const ROW_HEIGHT = 11;
const SIGNATURE_HEIGHT = 24;
const NOTE_TOP = 194;

const COL_WIDTHS = [8, 50, 20, 20, 20, 72];
const COLORS = {
  text: [0, 0, 0] as const,
  blue: [0, 0, 128] as const,
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const wrap = (doc: jsPDF, value: string, width: number) =>
  doc.splitTextToSize(value || "", Math.max(width - 2, 6));

const drawCenteredCellText = (
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const lineHeight = 3.7;
  const totalHeight = lines.length * lineHeight;
  const startY = y + (height - totalHeight) / 2 + 3;
  doc.text(lines, x + width / 2, startY, { align: "center" });
};

const drawTrainingHeader = (doc: jsPDF, payload: AnnualTrainingPlanDocumentData) => {
  doc.setFont("Inter", "bold");
  doc.setFontSize(11);
  doc.text("İŞ SAĞLIĞI ve GÜVENLİĞİ YILLIK EĞİTİM PLANI", PAGE_WIDTH / 2, 20, { align: "center" });

  doc.rect(LEFT, 12, TABLE_WIDTH, 12);
  doc.rect(LEFT, 24, TABLE_WIDTH, 8);
  doc.setFontSize(10);
  doc.text(`${payload.year} YILI EĞİTİM PLANI`, PAGE_WIDTH / 2, 29, { align: "center" });

  doc.rect(LEFT, 32, 58, 24);
  doc.rect(68, 32, 38, 24);
  doc.rect(106, 32, 15, 24);
  doc.rect(121, 32, 79, 24);

  doc.setFontSize(7);
  doc.setFont("Inter", "bold");
  doc.text("İş Yeri Unvanı:", 39, 40, { align: "center" });
  doc.text("İş Yeri Adresi:", 160.5, 40, { align: "center" });
  doc.text("İş Yeri Sicil No:", 39, 52, { align: "center" });

  doc.setFont("Inter", "normal");
  doc.text(wrap(doc, payload.form.isYeriUnvani, 34), 87, 40, { align: "center" });
  doc.text(wrap(doc, payload.form.isYeriAdresi, 75), 160.5, 46, { align: "center" });
  doc.text(wrap(doc, payload.form.isYeriSicilNo, 34), 87, 52, { align: "center" });
};

const drawTrainingTable = (doc: jsPDF, items: AnnualTrainingPlanItem[], pageIndex: number) => {
  const start = pageIndex * DATA_ROWS_PER_PAGE;
  const visible = items.slice(start, start + DATA_ROWS_PER_PAGE);

  let x = LEFT;
  const headers = [
    "Sıra\nNo",
    "EĞİTİM KONUSU",
    "Eğitimi Verecek\nKişi/Kuruluş",
    "Planlanan Tarih",
    "Gerçekleşen Tarih",
    "AÇIKLAMALAR",
  ];

  doc.setFont("Inter", "bold");
  doc.setTextColor(...COLORS.blue);
  headers.forEach((header, index) => {
    doc.rect(x, TABLE_TOP, COL_WIDTHS[index], HEADER_HEIGHT);
    drawCenteredCellText(doc, header.split("\n"), x, TABLE_TOP, COL_WIDTHS[index], HEADER_HEIGHT);
    x += COL_WIDTHS[index];
  });

  doc.setFont("Inter", "normal");
  doc.setTextColor(...COLORS.text);

  for (let rowIndex = 0; rowIndex < DATA_ROWS_PER_PAGE; rowIndex += 1) {
    const item = visible[rowIndex];
    const y = TABLE_TOP + HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
    x = LEFT;
    const values = [
      String(start + rowIndex + 1),
      item?.egitimKonusu || "",
      item?.egitimiVerecekKisiKurulus || "",
      item?.planlananTarih || "",
      item?.gerceklesenTarih || "",
      item?.aciklamalar || "",
    ];

    values.forEach((value, index) => {
      doc.rect(x, y, COL_WIDTHS[index], ROW_HEIGHT);
      const lines = wrap(doc, value, COL_WIDTHS[index]);
      if (index === 0) {
        drawCenteredCellText(doc, lines, x, y, COL_WIDTHS[index], ROW_HEIGHT);
      } else {
        doc.text(lines, x + 1, y + 4);
      }
      x += COL_WIDTHS[index];
    });
  }
};

const drawFooter = (doc: jsPDF, payload: AnnualTrainingPlanDocumentData) => {
  doc.setFont("Inter", "normal");
  doc.setFontSize(6);
  doc.text(
    wrap(
      doc,
      "*EĞİTİMLERİN SÜRESİ : Az tehlikeli işyerleri için en az 8 saat, Tehlikeli işyerleri için en az 12 saat, Çok tehlikeli işyerleri için en az 16 saat olarak her çalışan için düzenlenecektir.",
      TABLE_WIDTH,
    ),
    LEFT,
    NOTE_TOP,
  );

  const signatureTop = 262;
  doc.rect(LEFT, signatureTop, 50, SIGNATURE_HEIGHT);
  doc.rect(60, signatureTop, 70, SIGNATURE_HEIGHT);
  doc.rect(130, signatureTop, 70, SIGNATURE_HEIGHT);

  doc.setFont("Inter", "bold");
  doc.setFontSize(7);
  doc.text("İş Güvenliği Uzmanı", 35, signatureTop + 6, { align: "center" });
  doc.text("İşyeri Hekimi", 95, signatureTop + 6, { align: "center" });
  doc.text("İşveren / İ.Vekili", 165, signatureTop + 6, { align: "center" });

  doc.setFont("Inter", "normal");
  doc.text(wrap(doc, payload.form.isGuvenligiUzmani, 44), 35, signatureTop + 14, { align: "center" });
  doc.text(wrap(doc, payload.form.isyeriHekimi, 64), 95, signatureTop + 14, { align: "center" });
  doc.text(wrap(doc, payload.form.isverenVekili, 64), 165, signatureTop + 14, { align: "center" });
};

export const downloadAnnualTrainingPlanPdf = async (payload: AnnualTrainingPlanDocumentData) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const interLoaded = addInterFontsToJsPDF(doc);
  doc.setFont(interLoaded ? "Inter" : "helvetica", "normal");
  doc.setTextColor(...COLORS.text);

  const totalPages = Math.max(1, Math.ceil(payload.items.length / DATA_ROWS_PER_PAGE));
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    if (pageIndex > 0) {
      doc.addPage("a4", "portrait");
    }
    drawTrainingHeader(doc, payload);
    drawTrainingTable(doc, payload.items, pageIndex);
    if (pageIndex === totalPages - 1) {
      drawFooter(doc, payload);
    }
  }

  const fileName = sanitizeFileName(`ISG-Yillik-Egitim-Plani-${payload.form.isYeriUnvani || "Firma"}-${payload.year}`);
  doc.save(`${fileName}.pdf`);
};
