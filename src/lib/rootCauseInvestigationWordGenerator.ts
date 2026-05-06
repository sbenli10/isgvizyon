import { saveAs } from "file-saver";

export interface RootCauseInvestigationData {
  unitName: string;
  location: string;
  eventTypes: string[];
  otherEventType: string;
  eventDate: string;
  eventTime: string;
  taskTitle: string;
  treatmentDuration: string;
  unitChief: string;
  lostTime: string;
  injuredName: string;
  treatingPerson: string;
  bodyParts: string[];
  otherBodyPart: string;
  damagedEquipment: string;
  incidentDescription: string;
  unitChiefOpinion: string;
  safetyExpertName: string;
  workplaceDoctorName: string;
  boardMemberName: string;
  otherEvaluatorName: string;
  recommendedMeasures: string;
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

export async function generateRootCauseInvestigationWord(data: RootCauseInvestigationData) {
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
  const fullBorder = {
    top: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    left: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    right: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
    insideVertical: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
  } as const;

  const mark = (selected: boolean) => (selected ? "☑" : "☐");

  const optionParagraph = (label: string, selected: boolean) =>
    new Paragraph({
      children: [new TextRun({ text: `${mark(selected)} ${label}`, size: 22 })],
    });

  const bodyPartCell = (label: string, selected: boolean) =>
    new TableCell({
      width: { size: 16.66, type: WidthType.PERCENTAGE },
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      children: [optionParagraph(label, selected)],
    });

  const textCell = (
    text: string,
    width: number,
    options?: { bold?: boolean; colSpan?: number; rowSpan?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; minLines?: number },
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      columnSpan: options?.colSpan,
      rowSpan: options?.rowSpan,
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: options?.align,
          children: [new TextRun({ text, bold: options?.bold, size: 22 })],
        }),
        ...Array.from({ length: options?.minLines ?? 0 }).map(() => new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] })),
      ],
    });

  const eventTypeRows = [
    ["Yaralanma/Meslek Hastalığı", "Çevre Hasarı"],
    ["Tehlikeli Durum", "Maddi Hasar"],
    ["Tehlikeli Davranış", `Diğer (${safeText(data.otherEventType)})`],
  ];

  const selectedBodyParts = new Set(data.bodyParts);
  const selectedEventTypes = new Set(data.eventTypes);

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 520, right: 420, bottom: 520, left: 420 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({ text: "İŞ KAZASI/GÜVENSİZ DAVRANIŞ", bold: true, size: 28 }),
              new TextRun({ text: "\nKÖK NEDEN ARAŞTIRMA FORMU", bold: true, size: 28 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: [
              new TableRow({
                children: [
                  textCell("Kaza/Olay/Mesl. Hast. Meydana Geldiği Birim", 40, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.unitName), 57),
                ],
              }),
              new TableRow({
                children: [
                  textCell("Olayın Meydana Geldiği Yer", 40, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.location), 57),
                ],
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: eventTypeRows.map((row, index) =>
              new TableRow({
                children: [
                  ...(index === 0
                    ? [textCell("Kaza/Olay Tipi", 20, { bold: true, rowSpan: 3 }), textCell(":", 3, { bold: true, align: AlignmentType.CENTER, rowSpan: 3 })]
                    : []),
                  new TableCell({
                    width: { size: 38.5, type: WidthType.PERCENTAGE },
                    margins: { top: 80, bottom: 80, left: 80, right: 80 },
                    children: [optionParagraph(row[0], selectedEventTypes.has(row[0]))],
                  }),
                  new TableCell({
                    width: { size: 38.5, type: WidthType.PERCENTAGE },
                    margins: { top: 80, bottom: 80, left: 80, right: 80 },
                    children: [optionParagraph(row[1], row[1].startsWith("Diğer") ? Boolean(data.otherEventType.trim()) : selectedEventTypes.has(row[1]))],
                  }),
                ],
              }),
            ),
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: [
              new TableRow({
                children: [textCell("KAZA/OLAY/MESLEK HASTALIĞI HAKKINDA BİLGİ", 100, { colSpan: 6, bold: true, align: AlignmentType.CENTER })],
              }),
              new TableRow({
                children: [
                  textCell("Olay Tarihi", 19, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(formatDate(data.eventDate), 28),
                  textCell("Görevi", 16, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.taskTitle), 31),
                ],
              }),
              new TableRow({
                children: [
                  textCell("Olay Saati", 19, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.eventTime), 28),
                  textCell("Tedavi Süresi", 16, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.treatmentDuration), 31),
                ],
              }),
              new TableRow({
                children: [
                  textCell("Birim Amiri", 19, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.unitChief), 28),
                  textCell("Kaybedilen Süre", 16, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.lostTime), 31),
                ],
              }),
              new TableRow({
                children: [
                  textCell("Kazazede (ad-soyad)", 19, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.injuredName), 28),
                  textCell("Tedavi Eden", 16, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.treatingPerson), 31),
                ],
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: [
              new TableRow({
                children: [
                  textCell("Yaralanan Vücut Bölgesi", 19, { bold: true, rowSpan: 2 }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER, rowSpan: 2 }),
                  bodyPartCell("Baş", selectedBodyParts.has("Baş")),
                  bodyPartCell("Göz", selectedBodyParts.has("Göz")),
                  bodyPartCell("Kol", selectedBodyParts.has("Kol")),
                  bodyPartCell("Bacak", selectedBodyParts.has("Bacak")),
                  bodyPartCell("Diğer", selectedBodyParts.has("Diğer")),
                ],
              }),
              new TableRow({
                children: [
                  bodyPartCell("Yüz", selectedBodyParts.has("Yüz")),
                  bodyPartCell("El", selectedBodyParts.has("El")),
                  bodyPartCell("Ayak", selectedBodyParts.has("Ayak")),
                  bodyPartCell("Gövde", selectedBodyParts.has("Gövde")),
                  textCell(safeText(data.otherBodyPart), 16.66),
                ],
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: [
              new TableRow({
                children: [
                  textCell("Zarar Gören Ekipman", 19, { bold: true }),
                  textCell(":", 3, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.damagedEquipment), 78),
                ],
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: [
              new TableRow({
                children: [textCell("KAZA/OLAY/MESLEK HASTALIĞI TANIMI :", 100, { colSpan: 1, bold: true, minLines: 12 })],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: safeText(data.incidentDescription), size: 22 })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: [
              new TableRow({
                children: [
                  textCell("BÖLÜM AMİRİ GÖRÜŞÜ :", 49, { bold: true, minLines: 9 }),
                  textCell("DEĞERLENDİRMEYİ YAPAN EKİP", 51, { bold: true, align: AlignmentType.CENTER, colSpan: 3 }),
                ],
              }),
              new TableRow({
                children: [
                  textCell(safeText(data.unitChiefOpinion), 49, { minLines: 7 }),
                  textCell("İSG Uzmanı", 15, { bold: true }),
                  textCell(":", 2, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.safetyExpertName), 27),
                  textCell("İmza", 7, { align: AlignmentType.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  textCell("", 49),
                  textCell("İşyeri Hekimi", 15, { bold: true }),
                  textCell(":", 2, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.workplaceDoctorName), 27),
                  textCell("", 7),
                ],
              }),
              new TableRow({
                children: [
                  textCell("", 49),
                  textCell("İSG Kurul Üyesi", 15, { bold: true }),
                  textCell(":", 2, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.boardMemberName), 27),
                  textCell("", 7),
                ],
              }),
              new TableRow({
                children: [
                  textCell("", 49),
                  textCell("Diğer", 15, { bold: true }),
                  textCell(":", 2, { bold: true, align: AlignmentType.CENTER }),
                  textCell(safeText(data.otherEvaluatorName), 27),
                  textCell("", 7),
                ],
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: [
              new TableRow({
                children: [textCell("ÖNERİLEN ÖNLEMLER", 100, { bold: true, align: AlignmentType.CENTER })],
              }),
              new TableRow({
                children: [textCell(safeText(data.recommendedMeasures), 100, { minLines: 10 })],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `${sanitizeFileName(`Kok-Neden-Arastirma-Formu-${data.injuredName || data.unitName || "Form"}`)}.docx`);
}
