import { saveAs } from "file-saver";

import type { DocumentAnalysisRecord, DocumentAnalysisType } from "@/lib/documentAnalysisTypes";

const typeLabelMap: Record<DocumentAnalysisType, string> = {
  legislation: "Mevzuat",
  internal_procedure: "İç prosedür",
  technical_instruction: "Teknik talimat",
  official_letter: "Denetim / resmî yazı",
  contractual_obligation: "Sözleşme / yükümlülük dokümanı",
};

const safeText = (value?: string | null, fallback = "Belirtilmedi") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const sanitizeFileName = (value: string) =>
  value.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

export async function generateDocumentAnalysisWord(record: DocumentAnalysisRecord) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const borderColor = "D4D4D8";
  const mutedColor = "475569";
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
      spacing: { before: 220, after: 100 },
      children: [new TextRun({ text, bold: true, color: titleColor, size: 28 })],
    });

  const bodyParagraph = (text: string) =>
    new Paragraph({
      spacing: { after: 140 },
      children: [new TextRun({ text: safeText(text), color: mutedColor, size: 22 })],
    });

  const bullets = (items: string[]) =>
    items.map(
      (text) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 90 },
          children: [new TextRun({ text, color: mutedColor, size: 22 })],
        }),
    );

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: tableBorders,
    rows: [
      ["Firma", record.company_name || "Bağlanmadı"],
      ["Belge tipi", typeLabelMap[record.document_type]],
      ["Dosya adı", record.source_file_name],
      ["Analiz tarihi", new Date(record.created_at).toLocaleDateString("tr-TR")],
    ].map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "EFF6FF" },
              width: { size: 28, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label, bold: true, color: titleColor, size: 22 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: safeText(String(value)), color: mutedColor, size: 22 })],
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 320, after: 100 },
            children: [
              new TextRun({
                text: "Mevzuat Belge Analizi",
                bold: true,
                color: accentColor,
                size: 30,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: safeText(record.title || record.source_file_name),
                bold: true,
                color: titleColor,
                size: 38,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: "Belge özeti, kritik yükümlülükler ve uygulanabilir aksiyon önerileri",
                color: mutedColor,
                size: 24,
              }),
            ],
          }),
          metaTable,
          sectionTitle("Belge Özeti"),
          bodyParagraph(record.summary),
          sectionTitle("Kritik Yükümlülükler"),
          ...bullets(
            record.keyObligations.map(
              (item, index) =>
                `${index + 1}. ${item.title} - ${item.description}${item.legalBasis ? ` (${item.legalBasis})` : ""}`,
            ),
          ),
          sectionTitle("Dikkat Gerektiren Maddeler"),
          ...bullets(
            record.criticalPoints.map(
              (item, index) =>
                `${index + 1}. ${item.title} - ${item.description}${item.whyItMatters ? ` / Neden önemli: ${item.whyItMatters}` : ""}`,
            ),
          ),
          sectionTitle("Uygulanabilir Aksiyon Önerileri"),
          ...bullets(
            record.actionItems.map((item, index) => `${index + 1}. ${item.title} - ${item.description}`),
          ),
          ...(record.riskNotes.length > 0
            ? [
                sectionTitle("Risk ve Uyum Notları"),
                ...bullets(
                  record.riskNotes.map((item, index) => `${index + 1}. ${item.title} - ${item.description}`),
                ),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFileName(record.title || record.source_file_name || "mevzuat-belge-analizi")}.docx`);
}
