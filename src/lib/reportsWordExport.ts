import { saveAs } from "file-saver";

import type { HazardReportPdfItem } from "@/lib/reportsPdfExport";

export interface HazardReportWordExportOptions {
  analyses: HazardReportPdfItem[];
  title?: string;
  subtitle?: string;
  fileName?: string;
  supportingDocuments?: string[];
}

type DocxImageKind = "jpg" | "png" | "gif" | "bmp";

const safeText = (value?: string | null, fallback = "Belirtilmedi") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const toDisplayDate = (value?: string | null) => {
  if (!value) return new Date().toLocaleDateString("tr-TR");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR");
};

const sanitizeFileName = (value: string) =>
  value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

const inferDocxImageType = (value?: string | null): DocxImageKind => {
  if (!value) return "png";
  const lower = value.toLowerCase();
  if (lower.includes("image/jpeg") || lower.includes("image/jpg") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "jpg";
  }
  if (lower.includes("image/gif") || lower.endsWith(".gif")) {
    return "gif";
  }
  if (lower.includes("image/bmp") || lower.endsWith(".bmp")) {
    return "bmp";
  }
  return "png";
};

const fetchImageBytes = async (url?: string | null) => {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.warn("Reports DOCX image load failed:", error);
    return null;
  }
};

export async function generateHazardAnalysisWord(options: HazardReportWordExportOptions) {
  const { analyses, title, subtitle, fileName, supportingDocuments = [] } = options;
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    PageBreak,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const coverImageBytes = await fetchImageBytes(analyses[0]?.imageUrl);
  const analysisImages = await Promise.all(
    analyses.map(async (analysis) => ({
      bytes: await fetchImageBytes(analysis.imageUrl),
      type: inferDocxImageType(analysis.imageUrl),
    })),
  );

  const borderColor = "D4D4D8";
  const mutedColor = "52525B";
  const titleColor = "0F172A";
  const accentColor = "2563EB";
  const tableBorders = {
    top: { color: borderColor, style: BorderStyle.SINGLE, size: 4 },
    bottom: { color: borderColor, style: BorderStyle.SINGLE, size: 4 },
    left: { color: borderColor, style: BorderStyle.SINGLE, size: 4 },
    right: { color: borderColor, style: BorderStyle.SINGLE, size: 4 },
    insideHorizontal: { color: borderColor, style: BorderStyle.SINGLE, size: 3 },
    insideVertical: { color: borderColor, style: BorderStyle.SINGLE, size: 3 },
  };

  const sectionTitle = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
      children: [new TextRun({ text, bold: true, color: titleColor, size: 28 })],
    });

  const bodyParagraph = (text: string) =>
    new Paragraph({
      spacing: { after: 140 },
      children: [new TextRun({ text: safeText(text), color: mutedColor, size: 22 })],
    });

  const metricTable = (analysis: HazardReportPdfItem) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: tableBorders,
      rows: [
        new TableRow({
          children: ["İhtimal", "Frekans", "Şiddet", "Risk Skoru", "Risk Seviyesi"].map(
            (label) =>
              new TableCell({
                shading: { fill: "EFF6FF" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: label, bold: true, color: titleColor, size: 20 })],
                  }),
                ],
              }),
          ),
        }),
        new TableRow({
          children: [
            String(analysis.probability),
            String(analysis.frequency),
            String(analysis.severity),
            String(analysis.riskScore),
            safeText(analysis.riskLevel),
          ].map(
            (value) =>
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: value, color: mutedColor, size: 22 })],
                  }),
                ],
              }),
          ),
        }),
      ],
    });

  const analysesSections = analyses.flatMap((analysis, index) => {
    const blocks: Array<any> = [];
    const imageMeta = analysisImages[index];

    blocks.push(
      new Paragraph({
        pageBreakBefore: index > 0,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: analysis.sourceLabel || `Analiz ${index + 1}`,
            bold: true,
            color: titleColor,
            size: 32,
          }),
        ],
      }),
    );

    if (imageMeta.bytes) {
      blocks.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [
            new ImageRun({
              data: imageMeta.bytes,
              type: imageMeta.type,
              transformation: { width: 420, height: 260 },
            }),
          ],
        }),
      );
    }

    blocks.push(
      metricTable(analysis),
      sectionTitle("Tespit Edilen Tehlike"),
      bodyParagraph(analysis.hazardDescription),
      sectionTitle("Anlık Düzeltici Aksiyon"),
      bodyParagraph(analysis.immediateAction || "-"),
      sectionTitle("Kalıcı Önleyici Aksiyon"),
      bodyParagraph(analysis.preventiveAction || "-"),
      sectionTitle("Yasal Mevzuat ve Dayanak"),
      bodyParagraph(analysis.legalReference || "Belirtilmedi"),
    );

    if (analysis.justification) {
      blocks.push(sectionTitle("Uzman Gerekçesi"), bodyParagraph(analysis.justification));
    }

    return blocks;
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 480, after: 120 },
            children: [
              new TextRun({
                text: title || "Profesyonel Fine-Kinney Risk Analiz Raporu",
                bold: true,
                color: titleColor,
                size: 36,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text:
                  subtitle ||
                  "Analiz edilen görseller, risk puanları, mevzuat dayanakları ve aksiyon planları tek dosyada sunulur.",
                color: mutedColor,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: `Rapor Tarihi: ${toDisplayDate(new Date().toISOString())}`,
                color: accentColor,
                bold: true,
                size: 22,
              }),
            ],
          }),
          ...(coverImageBytes
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 260 },
                  children: [
                    new ImageRun({
                      data: coverImageBytes,
                      type: inferDocxImageType(analyses[0]?.imageUrl),
                      transformation: { width: 420, height: 280 },
                    }),
                  ],
                }),
              ]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: tableBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "F8FAFC" },
                    children: [new Paragraph({ children: [new TextRun({ text: "Toplam Analiz", bold: true, color: titleColor, size: 22 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: String(analyses.length), color: mutedColor, size: 22 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "F8FAFC" },
                    children: [new Paragraph({ children: [new TextRun({ text: "En Yüksek Risk Skoru", bold: true, color: titleColor, size: 22 })] })],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: String(Math.max(...analyses.map((item) => item.riskScore || 0))),
                            color: mutedColor,
                            size: 22,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "F8FAFC" },
                    children: [new Paragraph({ children: [new TextRun({ text: "Destekleyici Belgeler", bold: true, color: titleColor, size: 22 })] })],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: supportingDocuments.length ? supportingDocuments.join(", ") : "Ek belge bulunmuyor.",
                            color: mutedColor,
                            size: 22,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ children: [new PageBreak()] }),
          ...analysesSections,
          ...(supportingDocuments.length
            ? [
                sectionTitle("Ek Belgeler"),
                ...supportingDocuments.map(
                  (documentName) =>
                    new Paragraph({
                      bullet: { level: 0 },
                      spacing: { after: 80 },
                      children: [new TextRun({ text: documentName, color: mutedColor, size: 22 })],
                    }),
                ),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const resolvedFileName =
    fileName || `isg-risk-analiz-raporu-${sanitizeFileName(new Date().toLocaleString("tr-TR"))}.docx`;

  saveAs(blob, resolvedFileName);
}
