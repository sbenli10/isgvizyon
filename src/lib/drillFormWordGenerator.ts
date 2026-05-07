import { saveAs } from "file-saver";

export interface DrillFormData {
  workplaceName: string;
  drillName: string;
  drillDate: string;
  drillTypes: string[];
  otherDrillType: string;
  participantCount: string;
  assemblyCountResult: string;
  startTime: string;
  endTime: string;
  drillSubject: string;
  drillPurpose: string;
  postDrillEvaluation: string;
  thingsDoneCorrectly: string;
  thingsDoneWrong: string;
  conclusions: string;
  conductorName: string;
  conductorTitle: string;
  approverName: string;
}

const DRILL_TYPES = [
  "Yangın",
  "Patlama",
  "Doğal Afet",
  "Tehlikeli Kimyasal, Biyolojik, Radyoaktif",
  "Zehirlenme veya Salgın Hastalıklar ve Nükleer Maddelerden Kaynaklanan Yayılım",
  "Sabotaj",
  "Diğer",
] as const;

const safeText = (value?: string | null, fallback = "") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR");
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .trim();

export async function generateDrillFormWord(data: DrillFormData) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const borderColor = "000000";
  const selectedTypes = new Set(data.drillTypes);
  const mark = (selected: boolean) => (selected ? "◉" : "○");
  const fullBorder = {
    top: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    left: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    right: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    insideVertical: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
  } as const;

  const cell = (
    text: string,
    width: number,
    options?: { bold?: boolean; colSpan?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; minLines?: number; size?: number },
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      columnSpan: options?.colSpan,
      margins: { top: 70, bottom: 70, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: options?.align,
          children: [new TextRun({ text, bold: options?.bold, size: options?.size ?? 22 })],
        }),
        ...Array.from({ length: options?.minLines ?? 0 }).map(() => new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] })),
      ],
    });

  const drillTypeRows = DRILL_TYPES.map((type) =>
    new TableRow({
      children: [
        cell(
          `${mark(selectedTypes.has(type))} ${
            type === "Diğer" || type === "Doğal Afet" ? `${type} (${safeText(data.otherDrillType)})` : type
          }`,
          100,
          { colSpan: 4 },
        ),
      ],
    }),
  );

  const topTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [cell("TATBİKAT FORMU", 100, { bold: true, align: AlignmentType.CENTER, colSpan: 4, size: 30 })],
      }),
      new TableRow({
        children: [
          cell("İşyeri Adı/Unvanı:", 19, { bold: true }),
          cell(safeText(data.workplaceName), 81, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Tatbikat Adı:", 45, { bold: true, colSpan: 2 }),
          cell(`${safeText(data.drillName)}`, 20),
          cell(`Tatbikat Tarihi: ${formatDate(data.drillDate)}`, 35, { bold: true }),
        ],
      }),
      new TableRow({
        children: [cell("Tatbikat Türü", 100, { bold: true, colSpan: 4 })],
      }),
      ...drillTypeRows,
      new TableRow({
        children: [cell("Tatbikat Katılım Sayıları", 100, { bold: true, colSpan: 4 })],
      }),
      new TableRow({
        children: [
          cell("Katılan Kişi Sayısı", 35, { bold: true }),
          cell(safeText(data.participantCount), 15),
          cell("Toplanma Yerindeki Sayım Sonucu", 35, { bold: true }),
          cell(safeText(data.assemblyCountResult), 15),
        ],
      }),
      new TableRow({
        children: [cell("Tatbikat Süreleri", 100, { bold: true, colSpan: 4 })],
      }),
      new TableRow({
        children: [
          cell("Başlangıç Saati", 35, { bold: true }),
          cell(safeText(data.startTime), 15),
          cell("Bitiş Saati", 35, { bold: true }),
          cell(safeText(data.endTime), 15),
        ],
      }),
      new TableRow({
        children: [cell("Tatbikat Konumu:", 100, { bold: true, colSpan: 4 })],
      }),
      new TableRow({
        children: [cell(safeText(data.drillSubject), 100, { colSpan: 4, minLines: 5 })],
      }),
    ],
  });

  const bottomTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({ children: [cell("Tatbikatın Amacı:", 100, { bold: true, colSpan: 4 })] }),
      new TableRow({ children: [cell(safeText(data.drillPurpose), 100, { colSpan: 4, minLines: 5 })] }),
      new TableRow({ children: [cell("Tatbikat Sonrası Değerlendirme:", 100, { bold: true, colSpan: 4 })] }),
      new TableRow({ children: [cell(safeText(data.postDrillEvaluation), 100, { colSpan: 4, minLines: 5 })] }),
      new TableRow({ children: [cell("Tatbikat Esnasında Doğru Yapılanlar:", 100, { bold: true, colSpan: 4 })] }),
      new TableRow({ children: [cell(safeText(data.thingsDoneCorrectly), 100, { colSpan: 4, minLines: 5 })] }),
      new TableRow({ children: [cell("Tatbikat Esnasında Yanlış Yapılanlar:", 100, { bold: true, colSpan: 4 })] }),
      new TableRow({ children: [cell(safeText(data.thingsDoneWrong), 100, { colSpan: 4, minLines: 5 })] }),
      new TableRow({ children: [cell("Çıkarılan Sonuçlar:", 100, { bold: true, colSpan: 4 })] }),
      new TableRow({ children: [cell(safeText(data.conclusions), 100, { colSpan: 4, minLines: 5 })] }),
      new TableRow({
        children: [
          cell("Tatbikatı Yürüten", 50, { bold: true, align: AlignmentType.CENTER, colSpan: 2 }),
          cell("Tatbikatı Onaylayan (İşveren / İ.Vekili)", 50, { bold: true, align: AlignmentType.CENTER, colSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          cell(`Adı Soyadı: ${safeText(data.conductorName)}`, 50, { colSpan: 2 }),
          cell(`Adı Soyadı: ${safeText(data.approverName)}`, 50, { colSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          cell(`Ünvanı: ${safeText(data.conductorTitle)}`, 50, { colSpan: 2 }),
          cell("İmza:", 50, { colSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          cell("İmza:", 50, { colSpan: 2 }),
          cell("", 50, { colSpan: 2 }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 420, right: 320, bottom: 420, left: 320 },
          },
        },
        children: [
          topTable,
          new Paragraph({ pageBreakBefore: true }),
          bottomTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${sanitizeFileName(`Tatbikat-Formu-${data.drillName || "Form"}`)}.docx`;
  saveAs(blob, fileName);
  return { blob, fileName };
}
