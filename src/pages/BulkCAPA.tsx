import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

type BulkCapaPhotoInput = string | Uint8Array | ArrayBuffer;

interface BulkCapaPhoto {
  file: BulkCapaPhotoInput;
  caption?: string;
}

export interface BulkCapaOfficialEntry {
  itemNo?: number | string;
  title?: string;
  photos?: BulkCapaPhoto[];
  nonCompliance?: string;
  riskAnalysis?: string;
  legislationBasis?: string;
  suggestedCapa?: string;
  dueDate?: string;
  actionPlan?: string;
  responsible?: string;
}

const PHOTO_COLUMNS = 3;
const PHOTO_CELL_WIDTH_PERCENT = Math.floor(100 / PHOTO_COLUMNS);
const PHOTO_WIDTH = 160;
const PHOTO_HEIGHT = 120;

function decodeBase64(value: string) {
  if (typeof globalThis.atob !== "function") {
    throw new Error("Base64 decoding is not supported / Base64 çözümleme desteklenmiyor.");
  }
  return Uint8Array.from(globalThis.atob(value), (char) => char.charCodeAt(0));
}

function normalizePhotoData(input: BulkCapaPhotoInput): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);

  if (!input.startsWith("data:")) {
    return decodeBase64(input);
  }

  const base64Part = input.split(",")[1] || "";
  return decodeBase64(base64Part);
}

export function buildPhotoGridRows(entryIndex: number, photos: BulkCapaPhoto[]) {
  const rows: TableRow[] = [];

  for (let i = 0; i < photos.length; i += PHOTO_COLUMNS) {
    const rowCells: TableCell[] = [];

    for (let offset = 0; offset < PHOTO_COLUMNS; offset += 1) {
      const photo = photos[i + offset];

      if (!photo) {
        rowCells.push(
          new TableCell({
            width: { size: PHOTO_CELL_WIDTH_PERCENT, type: WidthType.PERCENTAGE },
            children: [new Paragraph("")],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
          })
        );
        continue;
      }

      const photoIndex = i + offset + 1;
      const caption = photo.caption || `Madde ${entryIndex + 1} - Fotoğraf ${photoIndex}/${photos.length}`;

      rowCells.push(
        new TableCell({
          width: { size: PHOTO_CELL_WIDTH_PERCENT, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: normalizePhotoData(photo.file),
                  transformation: { width: PHOTO_WIDTH, height: PHOTO_HEIGHT },
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100 },
              children: [new TextRun({ text: caption, size: 18 })],
            }),
          ],
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
        })
      );
    }

    rows.push(new TableRow({ children: rowCells }));
  }

  return rows;
}

function createFieldRow(label: string, value?: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [new Paragraph(value?.trim() || "-")],
      }),
    ],
  });
}

function createMainEntryTable(entry: BulkCapaOfficialEntry) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      createFieldRow("TESPİT EDİLEN UYGUNSUZLUK", entry.nonCompliance),
      createFieldRow("RİSK ANALİZİ", entry.riskAnalysis),
      createFieldRow("MEVZUAT DAYANAĞI", entry.legislationBasis),
      createFieldRow("ÖNERİLEN DÖF", entry.suggestedCapa),
    ],
  });
}

function createActionPlanTable(entry: BulkCapaOfficialEntry) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Termin", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Aksiyon Planı", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Sorumlu", bold: true })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(entry.dueDate?.trim() || "-")] }),
          new TableCell({ children: [new Paragraph(entry.actionPlan?.trim() || "-")] }),
          new TableCell({ children: [new Paragraph(entry.responsible?.trim() || "-")] }),
        ],
      }),
    ],
  });
}

export function generateBulkCapaOfficialDocx(entries: BulkCapaOfficialEntry[]) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "EK-1 FOTOĞRAF KANITLARI",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 240 },
          }),
          ...(entries.length === 0
            ? [new Paragraph("Fotoğraf kanıtı bulunamadı.")]
            : entries.flatMap((entry, entryIndex) => {
                const entryLabel = entry.itemNo ?? entryIndex + 1;
                const entryTitle = entry.title?.trim() ? ` – ${entry.title.trim()}` : "";
                const photos = entry.photos || [];

                return [
                  new Paragraph({
                    text: `Madde ${entryLabel}${entryTitle}`,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 140 },
                  }),
                  ...(photos.length > 0
                    ? [
                        new Table({
                          width: { size: 100, type: WidthType.PERCENTAGE },
                          layout: TableLayoutType.FIXED,
                          rows: buildPhotoGridRows(entryIndex, photos),
                        }),
                      ]
                    : [new Paragraph("Bu madde için fotoğraf kanıtı yok.")]),
                  new Paragraph({ text: "", spacing: { after: 100 } }),
                  createMainEntryTable(entry),
                  new Paragraph({ text: "", spacing: { after: 100 } }),
                  createActionPlanTable(entry),
                  new Paragraph({ text: "", spacing: { after: 240 } }),
                ];
              })),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

const generateBulkCapaReport = (analyses: BulkCapaOfficialEntry[]) => generateBulkCapaOfficialDocx(analyses);

export default generateBulkCapaReport;
