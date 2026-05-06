import { saveAs } from "file-saver";

export interface EmergencyDrillAttendanceParticipant {
  fullName: string;
  tcNumber: string;
}

export interface EmergencyDrillAttendanceData {
  drillTopic: string;
  drillDate: string;
  drillDuration: string;
  participants: EmergencyDrillAttendanceParticipant[];
}

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

export async function generateEmergencyDrillAttendanceWord(data: EmergencyDrillAttendanceData) {
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
  const rows = Array.from({ length: 96 }, (_, index) => data.participants[index] || { fullName: "", tcNumber: "" });
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
    options?: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; colSpan?: number },
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      columnSpan: options?.colSpan,
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: options?.align,
          children: [new TextRun({ text, bold: options?.bold, size: 20 })],
        }),
      ],
    });

  const tableRows = [
    new TableRow({
      children: [cell("ACİL DURUM TATBİKATI KATILIM KAYIT FORMU", 100, { bold: true, align: AlignmentType.CENTER, colSpan: 8 })],
    }),
    new TableRow({
      children: [cell(`TATBİKATIN KONUSU: ${safeText(data.drillTopic)}`, 100, { bold: true, colSpan: 8 })],
    }),
    new TableRow({
      children: [
        cell(`TATBİKAT TARİHİ: ${formatDate(data.drillDate)}`, 50, { bold: true, colSpan: 4 }),
        cell(`TATBİKAT SÜRESİ: ${safeText(data.drillDuration)}`, 50, { bold: true, colSpan: 4 }),
      ],
    }),
    new TableRow({
      children: [
        cell("SAYI", 6, { bold: true, align: AlignmentType.CENTER }),
        cell("AD-SOYAD", 19, { bold: true, align: AlignmentType.CENTER }),
        cell("TC", 15, { bold: true, align: AlignmentType.CENTER }),
        cell("İMZA", 10, { bold: true, align: AlignmentType.CENTER }),
        cell("SAYI", 6, { bold: true, align: AlignmentType.CENTER }),
        cell("AD-SOYAD", 19, { bold: true, align: AlignmentType.CENTER }),
        cell("TC", 15, { bold: true, align: AlignmentType.CENTER }),
        cell("İMZA", 10, { bold: true, align: AlignmentType.CENTER }),
      ],
    }),
    ...Array.from({ length: 48 }, (_, index) => {
      const left = rows[index];
      const right = rows[index + 48];
      return new TableRow({
        children: [
          cell(String(index + 1), 6, { align: AlignmentType.CENTER }),
          cell(safeText(left.fullName), 19),
          cell(safeText(left.tcNumber), 15),
          cell("", 10),
          cell(String(index + 49), 6, { align: AlignmentType.CENTER }),
          cell(safeText(right.fullName), 19),
          cell(safeText(right.tcNumber), 15),
          cell("", 10),
        ],
      });
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 360, right: 320, bottom: 360, left: 320 },
          },
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: tableRows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFileName(`Acil-Durum-Tatbikati-Katilim-Kayit-Formu-${data.drillTopic || "Form"}`)}.docx`);
}
