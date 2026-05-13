import jsPDF from "jspdf";

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

const PAGE_WIDTH = 297;
const TABLE_START_X = 15;
const TABLE_START_Y = 74;
const HEADER_HEIGHT = 10;
const ROWS_PER_PAGE = 6;
const MIN_ROW_HEIGHT = 18;
const CELL_PADDING_X = 1.5;
const CELL_PADDING_Y = 3.8;

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

const text = (
  doc: jsPDF,
  value: string | string[],
  x: number,
  y: number,
  options?: Parameters<jsPDF["text"]>[3],
) => {
  doc.text(value as string, x, y, options);
};

const drawLabelValue = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  valueX: number,
  width: number,
) => {
  doc.setFont("Inter", "bold");
  doc.setFontSize(8);
  text(doc, label, x, y);
  doc.setFont("Inter", "normal");
  doc.setFontSize(8);
  const lines = doc.splitTextToSize(value || "", width);
  text(doc, lines.length > 0 ? lines : [""], valueX, y);
};

const drawHeader = (doc: jsPDF, payload: AnnualEvaluationPdfPayload) => {
  doc.setFont("Inter", "bold");
  doc.setFontSize(11);
  text(doc, `YILLIK DEGERLENDIRME RAPORU (${payload.year || new Date().getFullYear()})`, PAGE_WIDTH / 2, 22, {
    align: "center",
  });

  drawLabelValue(doc, "İş Yerinin:", "", 15, 30, 0, 0);
  drawLabelValue(doc, "Ünvanı :", payload.company.isyeriUnvani, 15, 36, 30, 100);
  drawLabelValue(doc, "SGK/Bolge Müdürlüğü Sicil No:", payload.company.sgkSicilNo, 15, 42, 58, 58);
  drawLabelValue(doc, "Adres :", payload.company.adres, 15, 48, 30, 110);
  drawLabelValue(doc, "Tel ve Fax :", payload.company.telFax, 15, 54, 35, 40);
  drawLabelValue(doc, "E-posta:", payload.company.eposta, 83, 54, 99, 58);
  drawLabelValue(doc, "İşkolu :", payload.company.iskolu, 15, 60, 30, 58);
  drawLabelValue(doc, "Çalışan Sayısı:", "", 15, 66, 0, 0);
  drawLabelValue(doc, "Erkek:", payload.company.calisanErkek, 55, 66, 68, 12);
  drawLabelValue(doc, "Kadın:", payload.company.calisanKadin, 88, 66, 101, 12);
  drawLabelValue(doc, "Genç:", payload.company.calisanGenc, 126, 66, 138, 12);
  drawLabelValue(doc, "Çocuk:", payload.company.calisanCocuk, 162, 66, 177, 12);
  drawLabelValue(doc, "Toplam:", payload.company.calisanToplam, 202, 66, 218, 12);
};

const TABLE_COLUMNS = [
  { key: "siraNo", title: "Sira\nNo.", width: 9 },
  { key: "yapilanCalismalar", title: "Yapilan calismalar", width: 34 },
  { key: "tarih", title: "Tarih", width: 22 },
  { key: "yapanKisiUnvani", title: "Yapan Kisi ve Unvani", width: 35 },
  { key: "tekrarSayisi", title: "Tekrar Sayisi", width: 24 },
  { key: "kullanilanYontem", title: "Kullanilan Yontem", width: 28 },
  { key: "sonucYorum", title: "Sonuc ve Yorum", width: 46 },
] as const;

const getCellLines = (
  doc: jsPDF,
  value: string,
  width: number,
  fallbackBlank = false,
) => {
  const safeValue = value?.trim() || "";
  if (!safeValue) {
    return [fallbackBlank ? "" : "-"];
  }

  return doc.splitTextToSize(safeValue, Math.max(width - CELL_PADDING_X * 2, 4));
};

const getRowHeight = (doc: jsPDF, item: AnnualEvaluationWorkItem | undefined, start: number, rowIndex: number) => {
  const lineCounts = TABLE_COLUMNS.map((column) => {
    const rawValue =
      column.key === "siraNo"
        ? item
          ? String(start + rowIndex + 1)
          : ""
        : item
          ? item[column.key]
          : "";

    return getCellLines(doc, rawValue, column.width, column.key === "siraNo").length;
  });

  const maxLines = Math.max(...lineCounts, 1);
  return Math.max(MIN_ROW_HEIGHT, maxLines * 3.6 + CELL_PADDING_Y * 2);
};

const drawTable = (doc: jsPDF, works: AnnualEvaluationWorkItem[], pageIndex: number) => {
  const start = pageIndex * ROWS_PER_PAGE;
  const visibleRows = works.slice(start, start + ROWS_PER_PAGE);

  let cursorX = TABLE_START_X;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.setFont("Inter", "bold");
  doc.setFontSize(7);

  TABLE_COLUMNS.forEach((column) => {
    doc.rect(cursorX, TABLE_START_Y, column.width, HEADER_HEIGHT);
    const lines = column.title.split("\n");
    text(doc, lines, cursorX + column.width / 2, TABLE_START_Y + 4, { align: "center" });
    cursorX += column.width;
  });

  doc.setFont("Inter", "normal");
  doc.setFontSize(7);
  let cursorY = TABLE_START_Y + HEADER_HEIGHT;

  for (let rowIndex = 0; rowIndex < ROWS_PER_PAGE; rowIndex += 1) {
    const item = visibleRows[rowIndex];
    const rowHeight = getRowHeight(doc, item, start, rowIndex);
    cursorX = TABLE_START_X;

    TABLE_COLUMNS.forEach((column) => {
      doc.rect(cursorX, cursorY, column.width, rowHeight);

      const rawValue =
        column.key === "siraNo"
          ? item
            ? String(start + rowIndex + 1)
            : ""
          : item
            ? item[column.key]
            : "";

      const lines = getCellLines(doc, rawValue, column.width, column.key === "siraNo");
      if (column.key === "siraNo") {
        text(doc, lines, cursorX + column.width / 2, cursorY + CELL_PADDING_Y + 1, { align: "center" });
      } else {
        text(doc, lines, cursorX + CELL_PADDING_X, cursorY + CELL_PADDING_Y + 1);
      }
      cursorX += column.width;
    });

    cursorY += rowHeight;
  }
};

const drawSignaturePage = (doc: jsPDF) => {
  doc.addPage("a4", "landscape");
  doc.setFont("Inter", "bold");
  doc.setFontSize(8);
  text(doc, "Tarih:", 145, 30, { align: "center" });
  text(doc, "Is Guvenligi Uzmani", 75, 40, { align: "center" });
  text(doc, "Isveren / Vekili", 148, 40, { align: "center" });
  text(doc, "Isyeri Hekimi", 260, 40, { align: "right" });
};

export const downloadAnnualEvaluationPdf = async (payload: AnnualEvaluationPdfPayload) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const interLoaded = addInterFontsToJsPDF(doc);
  doc.setFont(interLoaded ? "Inter" : "helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  drawHeader(doc, payload);
  const totalPages = Math.max(1, Math.ceil(payload.works.length / ROWS_PER_PAGE));
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    if (pageIndex > 0) {
      doc.addPage("a4", "landscape");
      drawHeader(doc, payload);
    }
    drawTable(doc, payload.works, pageIndex);
  }
  drawSignaturePage(doc);

  const fileName = sanitizeFileName("YILLIK_DEGERLENDIRME_RAPORU");
  doc.save(`${fileName}.pdf`);
};
