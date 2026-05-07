import { saveAs } from "file-saver";

export interface WorkAccidentReportData {
  accidentDate: string;
  accidentTime: string;
  injuredFullName: string;
  accidentPlace: string;
  injuredTc: string;
  injuredBodyPart: string;
  victimStatement: string;
  witnessStatement: string;
  witnessName: string;
  departmentChiefName: string;
  safetyExpertName: string;
  reportDate: string;
  photos?: File[];
}

const formatDate = (value?: string) => {
  if (!value) return new Date().toLocaleDateString("tr-TR");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR");
};

const safeText = (value?: string | null, fallback = "-") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .trim();

async function loadPhotoBytes(files: File[] = []) {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
}

export async function generateWorkAccidentWord(data: WorkAccidentReportData) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const borderColor = "1F2937";
  const labelCellFill = "F8FAFC";
  const photoAssets = await loadPhotoBytes(data.photos);

  const baseCell = (children: InstanceType<typeof Paragraph>[], widthPercent: number) =>
    new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      children,
    });

  const labelValueRow = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { fill: labelCellFill },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: leftLabel, bold: true, size: 22 })] })],
        }),
        baseCell([new Paragraph({ children: [new TextRun({ text: safeText(leftValue), size: 22 })] })], 25),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { fill: labelCellFill },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: rightLabel, bold: true, size: 22 })] })],
        }),
        baseCell([new Paragraph({ children: [new TextRun({ text: safeText(rightValue), size: 22 })] })], 25),
      ],
    });

  const narrativeSection = (title: string, value: string, minLines = 8) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
        left: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
        right: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: title, bold: true, underline: {}, size: 22 })],
                }),
                new Paragraph({
                  spacing: { before: 80 },
                  children: [new TextRun({ text: safeText(value, ""), size: 22 })],
                }),
                ...Array.from({ length: minLines }).map(() => new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] })),
              ],
            }),
          ],
        }),
      ],
    });

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
      left: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
      right: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
      insideVertical: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    },
    rows: [
      new TableRow({
        children: [
          baseCell([new Paragraph({ children: [new TextRun({ text: "Kazalı", bold: true, size: 22 })] })], 50),
          baseCell([new Paragraph({ children: [new TextRun({ text: "Tanık", bold: true, size: 22 })] })], 50),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({ children: [new TextRun({ text: safeText(data.injuredFullName), size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "İmza", size: 20 })] }),
            ],
          }),
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({ children: [new TextRun({ text: safeText(data.witnessName), size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "İmza", size: 20 })] }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Bölüm Amiri", bold: true, size: 22 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: safeText(data.departmentChiefName, ""), size: 22 })] }),
            ],
          }),
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "İş Güvenliği Uzmanı", bold: true, size: 22 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: safeText(data.safetyExpertName, ""), size: 22 })] }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80 },
                children: [new TextRun({ text: `Tarih: ${formatDate(data.reportDate)}`, size: 20 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const photoParagraphs =
    photoAssets.length > 0
      ? [
          new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: "Olay Fotoğrafları", bold: true, size: 24 })],
          }),
          ...photoAssets.flatMap((photo) => [
            new Paragraph({
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text: photo.name, bold: true, size: 18 })],
            }),
            new Paragraph({
              spacing: { after: 180 },
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: photo.bytes,
                  transformation: { width: 420, height: 280 },
                }),
              ],
            }),
          ]),
        ]
      : [];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 900,
              right: 720,
              bottom: 900,
              left: 720,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "İSGVizyon iş kazası tutanağı çıktısı", size: 16, color: "6B7280" })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 220 },
            children: [new TextRun({ text: "İŞ KAZASI TUTANAĞI", bold: true, size: 34 })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
              left: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
              right: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
              insideVertical: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
            },
            rows: [
              labelValueRow("Kaza tarihi", formatDate(data.accidentDate), "Kaza saati", safeText(data.accidentTime)),
              labelValueRow("Kazalının Adı Soyadı", safeText(data.injuredFullName), "Kaza yeri", safeText(data.accidentPlace)),
              labelValueRow("Kazalının TC", safeText(data.injuredTc), "Yaralanan bölge", safeText(data.injuredBodyPart)),
            ],
          }),
          new Paragraph({ spacing: { after: 160 } }),
          narrativeSection("Kazanın anlatımı (Kazalıya göre):", data.victimStatement, 10),
          new Paragraph({ spacing: { after: 160 } }),
          narrativeSection("Kazanın anlatımı (Tanığa göre):", data.witnessStatement, 8),
          new Paragraph({ spacing: { after: 180 } }),
          signatureTable,
          ...photoParagraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${sanitizeFileName(`Is-Kazasi-Tutanagi-${data.injuredFullName || "Rapor"}`)}.docx`;
  saveAs(blob, fileName);
  return { blob, fileName };
}
