import jsPDF from "jspdf";

import { addInterFontsToJsPDF } from "@/utils/fonts";

export interface HazardReportPdfItem {
  hazardDescription: string;
  probability: number;
  frequency: number;
  severity: number;
  riskScore: number;
  riskLevel: string;
  legalReference?: string;
  immediateAction?: string;
  preventiveAction?: string;
  justification?: string;
  photoNumber?: number;
  imageUrl?: string;
  sourceLabel?: string;
}

interface ExportOptions {
  analyses: HazardReportPdfItem[];
  title?: string;
  subtitle?: string;
  fileName?: string;
}

const PAGE = {
  width: 210,
  height: 297,
  marginX: 14,
  marginTop: 16,
  marginBottom: 14,
};

const COLORS = {
  ink: [24, 24, 27] as const,
  body: [63, 63, 70] as const,
  muted: [113, 113, 122] as const,
  border: [228, 228, 231] as const,
  soft: [250, 250, 250] as const,
  coverBase: [254, 242, 242] as const,
  coverAccent: [252, 226, 226] as const,
  coverStrong: [220, 38, 38] as const,
  critical: [220, 38, 38] as const,
  high: [234, 88, 12] as const,
  medium: [217, 119, 6] as const,
  low: [22, 163, 74] as const,
  slate: [51, 65, 85] as const,
};

function sanitizeFileName(value: string) {
  return value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function setFont(doc: jsPDF, weight: "normal" | "bold" = "normal") {
  doc.setFont("Inter", weight);
}

function setRgbText(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setRgbFill(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setRgbDraw(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function getRiskColor(score: number) {
  if (score >= 400) return COLORS.critical;
  if (score >= 200) return COLORS.high;
  if (score >= 70) return COLORS.medium;
  return COLORS.low;
}

function contentBottom() {
  return PAGE.height - PAGE.marginBottom;
}

function addNewContentPage(doc: jsPDF, pageTitle = "Risk Analiz Maddeleri") {
  doc.addPage();

  setRgbFill(doc, [255, 255, 255]);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");

  setRgbFill(doc, COLORS.coverStrong);
  doc.rect(0, 0, PAGE.width, 10, "F");

  setRgbText(doc, COLORS.coverStrong);
  setFont(doc, "bold");
  doc.setFontSize(10);
  doc.text("ISG Vizyon", PAGE.marginX, 18);

  setRgbText(doc, COLORS.ink);
  doc.setFontSize(16);
  doc.text(pageTitle, PAGE.marginX, 26);

  setRgbDraw(doc, COLORS.border);
  doc.line(PAGE.marginX, 31, PAGE.width - PAGE.marginX, 31);

  return 40;
}

function addFooter(doc: jsPDF) {
  const createdAt = new Date().toLocaleString("tr-TR");
  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    setRgbDraw(doc, COLORS.border);
    doc.line(PAGE.marginX, PAGE.height - 10, PAGE.width - PAGE.marginX, PAGE.height - 10);
    setFont(doc, "normal");
    doc.setFontSize(8);
    setRgbText(doc, COLORS.muted);
    doc.text(`Olusturulma: ${createdAt}`, PAGE.marginX, PAGE.height - 5);
    doc.text(`Sayfa ${page} / ${total}`, PAGE.width - PAGE.marginX, PAGE.height - 5, { align: "right" });
  }
}

function splitLines(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(text || "-", width);
}

function drawInfoChip(doc: jsPDF, label: string, value: string, x: number, y: number, width: number, accent: readonly [number, number, number]) {
  setRgbFill(doc, COLORS.soft);
  setRgbDraw(doc, COLORS.border);
  doc.roundedRect(x, y, width, 18, 4, 4, "FD");

  setRgbFill(doc, accent);
  doc.roundedRect(x, y, width, 4, 4, 4, "F");

  setFont(doc, "normal");
  doc.setFontSize(8);
  setRgbText(doc, COLORS.muted);
  doc.text(label, x + 3, y + 10);

  setFont(doc, "bold");
  doc.setFontSize(12);
  setRgbText(doc, COLORS.ink);
  doc.text(value, x + 3, y + 15);
}

function calcCardHeight(doc: jsPDF, body: string, width: number) {
  const lines = splitLines(doc, body, width - 8);
  return Math.max(24, 14 + lines.length * 4.8);
}

function getSectionCardHeight(lineCount: number) {
  return Math.max(24, 14 + lineCount * 4.8);
}

function ensureContentSpace(doc: jsPDF, y: number, needed: number, pageTitle?: string) {
  if (y > 45 && y + needed > contentBottom()) {
    return addNewContentPage(doc, pageTitle);
  }

  return y;
}

function drawSectionCard(
  doc: jsPDF,
  title: string,
  body: string,
  x: number,
  y: number,
  width: number,
  accent: readonly [number, number, number],
) {
  const lines = splitLines(doc, body || "-", width - 8);
  const height = Math.max(24, 14 + lines.length * 4.8);

  setRgbFill(doc, [255, 255, 255]);
  setRgbDraw(doc, COLORS.border);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");

  setRgbFill(doc, accent);
  doc.roundedRect(x, y, width, 6, 4, 4, "F");

  setFont(doc, "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(title, x + 4, y + 4.5);

  setFont(doc, "normal");
  doc.setFontSize(9.5);
  setRgbText(doc, COLORS.body);
  doc.text(lines, x + 4, y + 12);

  return y + height;
}

function drawPaginatedSectionCard(
  doc: jsPDF,
  title: string,
  body: string,
  x: number,
  y: number,
  width: number,
  accent: readonly [number, number, number],
  pageTitle = "Risk Analiz Maddeleri",
) {
  const allLines = splitLines(doc, body || "-", width - 8) as string[];
  const lineHeight = 4.8;
  const textStartOffset = 12;
  const cardPaddingBottom = 4;
  const minCardHeight = 24;
  let remainingLines = [...allLines];
  let cursorY = y;
  let firstChunk = true;

  while (remainingLines.length > 0) {
    const availableHeight = contentBottom() - cursorY;
    const reservedHeight = Math.max(minCardHeight, textStartOffset + lineHeight + cardPaddingBottom);
    const maxTextHeight = Math.max(lineHeight, availableHeight - textStartOffset - cardPaddingBottom);
    const linesThatFit = Math.max(1, Math.floor(maxTextHeight / lineHeight));
    const chunkSize = Math.max(1, Math.min(remainingLines.length, linesThatFit));
    const currentLines = remainingLines.splice(0, chunkSize);
    const currentHeight = Math.max(
      minCardHeight,
      textStartOffset + currentLines.length * lineHeight + cardPaddingBottom,
    );

    cursorY = ensureContentSpace(doc, cursorY, currentHeight, pageTitle);

    setRgbFill(doc, [255, 255, 255]);
    setRgbDraw(doc, COLORS.border);
    doc.roundedRect(x, cursorY, width, currentHeight, 4, 4, "FD");

    setRgbFill(doc, accent);
    doc.roundedRect(x, cursorY, width, 6, 4, 4, "F");

    setFont(doc, "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(firstChunk ? title : `${title} (devam)`, x + 4, cursorY + 4.5);

    setFont(doc, "normal");
    doc.setFontSize(9.5);
    setRgbText(doc, COLORS.body);
    doc.text(currentLines, x + 4, cursorY + textStartOffset);

    cursorY += currentHeight + 8;
    firstChunk = false;
  }

  return cursorY;
}

async function imageToJpegData(url: string) {
  return await new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas hazirlanamadi"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = () => reject(new Error("Gorsel yuklenemedi"));
    img.src = url;
  });
}

function drawCoverPage(doc: jsPDF, analyses: HazardReportPdfItem[], title?: string, subtitle?: string) {
  setRgbFill(doc, COLORS.coverBase);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");

  setRgbFill(doc, COLORS.coverAccent);
  doc.circle(PAGE.width - 24, 32, 34, "F");
  doc.circle(28, PAGE.height - 28, 24, "F");

  setRgbDraw(doc, COLORS.coverStrong);
  doc.setLineWidth(0.8);
  doc.roundedRect(18, 18, PAGE.width - 36, PAGE.height - 36, 8, 8, "S");

  setRgbFill(doc, COLORS.coverStrong);
  doc.roundedRect(28, 34, 42, 14, 4, 4, "F");
  setFont(doc, "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("ISG VIZYON", 49, 43, { align: "center" });

  setFont(doc, "bold");
  doc.setFontSize(28);
  setRgbText(doc, COLORS.coverStrong);
  doc.text(title || "RISK ANALIZ RAPORU", PAGE.width / 2, 98, { align: "center" });

  setFont(doc, "normal");
  doc.setFontSize(13);
  setRgbText(doc, COLORS.slate);
  const subtitleLines = splitLines(
    doc,
    subtitle || "Fotograf tabanli Fine-Kinney analiz sonuclari, risk puanlari ve aksiyon planlari",
    120,
  );
  doc.text(subtitleLines, PAGE.width / 2, 113, { align: "center" });

  setRgbFill(doc, [255, 255, 255]);
  setRgbDraw(doc, [252, 165, 165]);
  doc.roundedRect(28, 136, PAGE.width - 56, 58, 6, 6, "FD");

  setFont(doc, "bold");
  doc.setFontSize(12);
  setRgbText(doc, COLORS.ink);
  doc.text("Rapor Ozeti", 38, 149);

  setFont(doc, "normal");
  doc.setFontSize(11);
  setRgbText(doc, COLORS.body);
  doc.text(`Toplam analiz edilen madde: ${analyses.length}`, 38, 161);
  doc.text(`En yuksek risk skoru: ${Math.max(...analyses.map((item) => item.riskScore || 0))}`, 38, 171);
  doc.text(
    `Ortalama risk skoru: ${Math.round(
      analyses.reduce((sum, item) => sum + (item.riskScore || 0), 0) / Math.max(analyses.length, 1),
    )}`,
    38,
    181,
  );

  setFont(doc, "normal");
  doc.setFontSize(10);
  setRgbText(doc, COLORS.muted);
  doc.text("Icerik sirasi: Kapak > Analiz maddeleri > Risk puanlari > Aksiyonlar > Mevzuat > Gerekce", PAGE.width / 2, 232, {
    align: "center",
  });

  setFont(doc, "bold");
  doc.setFontSize(14);
  setRgbText(doc, COLORS.coverStrong);
  doc.text("RISK TESPIT VE DEGERLENDIRME DOSYASI", PAGE.width / 2, 250, { align: "center" });
}

async function drawAnalysisBlock(doc: jsPDF, analysis: HazardReportPdfItem, y: number) {
  const pageInnerWidth = PAGE.width - PAGE.marginX * 2;
  const imageColumnWidth = analysis.imageUrl ? 50 : 0;
  const gap = analysis.imageUrl ? 8 : 0;
  const rightX = PAGE.marginX + imageColumnWidth + gap;
  const rightWidth = pageInnerWidth - imageColumnWidth - gap;
  const metricWidth = (rightWidth - 6) / 2;

  const hazardHeight = Math.max(24, splitLines(doc, analysis.hazardDescription || "-", pageInnerWidth - 8).length * 4.8 + 14);
  const actionHeightLeft = calcCardHeight(doc, analysis.immediateAction || "-", (pageInnerWidth - 6) / 2);
  const actionHeightRight = calcCardHeight(doc, analysis.preventiveAction || "-", (pageInnerWidth - 6) / 2);
  const legalHeight = calcCardHeight(doc, analysis.legalReference || "Belirtilmedi", pageInnerWidth);
  const justificationHeight = analysis.justification ? calcCardHeight(doc, analysis.justification, pageInnerWidth) : 0;

  const topAreaHeight = analysis.imageUrl ? 58 : 22;
  const estimatedHeight =
    16 +
    topAreaHeight +
    8 +
    hazardHeight +
    8 +
    Math.max(actionHeightLeft, actionHeightRight) +
    8 +
    legalHeight +
    (analysis.justification ? 8 + justificationHeight : 0) +
    8;

  if (y > 45 && y + estimatedHeight > contentBottom()) {
    y = addNewContentPage(doc);
  }

  const blockStart = y;
  const accent = getRiskColor(analysis.riskScore);

  setRgbFill(doc, [255, 255, 255]);
  setRgbDraw(doc, COLORS.border);
  doc.roundedRect(PAGE.marginX, y, pageInnerWidth, estimatedHeight, 6, 6, "FD");

  setRgbFill(doc, accent);
  doc.roundedRect(PAGE.marginX, y, pageInnerWidth, 8, 6, 6, "F");

  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(analysis.sourceLabel || `Fotograf ${analysis.photoNumber || 1} Analizi`, PAGE.marginX + 4, y + 5.5);

  y += 14;

  if (analysis.imageUrl) {
    try {
      const image = await imageToJpegData(analysis.imageUrl);
      const maxW = imageColumnWidth;
      const maxH = 50;
      const ratio = Math.min(maxW / image.width, maxH / image.height);
      const drawW = image.width * ratio;
      const drawH = image.height * ratio;

      setRgbDraw(doc, COLORS.border);
      doc.roundedRect(PAGE.marginX + 2, y, imageColumnWidth - 2, 50, 4, 4, "S");
      doc.addImage(
        image.dataUrl,
        "JPEG",
        PAGE.marginX + 2 + (imageColumnWidth - 2 - drawW) / 2,
        y + (50 - drawH) / 2,
        drawW,
        drawH,
      );
    } catch {
      setRgbDraw(doc, COLORS.border);
      doc.roundedRect(PAGE.marginX + 2, y, imageColumnWidth - 2, 50, 4, 4, "S");
      setFont(doc, "normal");
      doc.setFontSize(8);
      setRgbText(doc, COLORS.muted);
      doc.text("Gorsel yuklenemedi", PAGE.marginX + imageColumnWidth / 2, y + 25, { align: "center" });
    }
  }

  if (analysis.imageUrl) {
    drawInfoChip(doc, "Ihtimal", String(analysis.probability), rightX, y, metricWidth, COLORS.slate);
    drawInfoChip(doc, "Frekans", String(analysis.frequency), rightX + metricWidth + 6, y, metricWidth, COLORS.slate);
    drawInfoChip(doc, "Siddet", String(analysis.severity), rightX, y + 22, metricWidth, COLORS.slate);
    drawInfoChip(doc, "Toplam Risk", String(analysis.riskScore), rightX + metricWidth + 6, y + 22, metricWidth, accent);
    y += 58;
  } else {
    const rowWidth = (pageInnerWidth - 9) / 4;
    drawInfoChip(doc, "Ihtimal", String(analysis.probability), PAGE.marginX, y, rowWidth, COLORS.slate);
    drawInfoChip(doc, "Frekans", String(analysis.frequency), PAGE.marginX + rowWidth + 3, y, rowWidth, COLORS.slate);
    drawInfoChip(doc, "Siddet", String(analysis.severity), PAGE.marginX + (rowWidth + 3) * 2, y, rowWidth, COLORS.slate);
    drawInfoChip(doc, "Toplam Risk", String(analysis.riskScore), PAGE.marginX + (rowWidth + 3) * 3, y, rowWidth, accent);
    y += 26;
  }

  y = drawPaginatedSectionCard(
    doc,
    "Tespit Edilen Tehlike",
    analysis.hazardDescription || "-",
    PAGE.marginX,
    y,
    pageInnerWidth,
    COLORS.slate,
  );

  const halfWidth = (pageInnerWidth - 6) / 2;
  const actionRowHeight = Math.max(
    getSectionCardHeight(splitLines(doc, analysis.immediateAction || "-", halfWidth - 8).length),
    getSectionCardHeight(splitLines(doc, analysis.preventiveAction || "-", halfWidth - 8).length),
  );

  y = ensureContentSpace(doc, y, actionRowHeight, "Risk Analiz Maddeleri");

  const leftBottom = drawSectionCard(
    doc,
    "Anlik Duzeltici Aksiyon",
    analysis.immediateAction || "-",
    PAGE.marginX,
    y,
    halfWidth,
    COLORS.critical,
  );
  const rightBottom = drawSectionCard(
    doc,
    "Kalici Onleyici Aksiyon",
    analysis.preventiveAction || "-",
    PAGE.marginX + halfWidth + 6,
    y,
    halfWidth,
    COLORS.low,
  );
  y = Math.max(leftBottom, rightBottom) + 8;

  y = drawPaginatedSectionCard(
    doc,
    "Yasal Mevzuat ve Dayanak",
    analysis.legalReference || "Belirtilmedi",
    PAGE.marginX,
    y,
    pageInnerWidth,
    [37, 99, 235],
  );

  if (analysis.justification) {
    y = drawPaginatedSectionCard(
      doc,
      "Uzman Gerekcesi",
      analysis.justification,
      PAGE.marginX,
      y,
      pageInnerWidth,
      [71, 85, 105],
    );
  }

  return Math.max(y, blockStart + estimatedHeight) + 6;
}

export async function generateHazardAnalysisPdf(options: ExportOptions) {
  const { analyses, title, subtitle, fileName } = options;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  if (addInterFontsToJsPDF(doc)) {
    setFont(doc, "normal");
  }

  drawCoverPage(doc, analyses, title, subtitle);

  let y = 0;

  for (let index = 0; index < analyses.length; index += 1) {
    if (index === 0) {
      y = addNewContentPage(doc);
    }
    y = await drawAnalysisBlock(doc, analyses[index], y);
  }

  addFooter(doc);

  const resolvedFileName =
    fileName || `isg-risk-analiz-raporu-${sanitizeFileName(new Date().toLocaleString("tr-TR"))}.pdf`;
  doc.save(resolvedFileName);
}
