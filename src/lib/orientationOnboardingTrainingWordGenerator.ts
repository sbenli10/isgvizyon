import { saveAs } from "file-saver";
import { ONBOARDING_TOPICS, ORIENTATION_TOPICS, type TopicStatus } from "@/components/assignment-letters/OrientationOnboardingTrainingModal";

export interface OrientationOnboardingTrainingData {
  fullName: string;
  birthPlaceYear: string;
  startDate: string;
  educationLevel: string;
  position: string;
  orientationDuration: string;
  orientationTopics: Record<string, TopicStatus>;
  orientationTrainer: string;
  onboardingDuration: string;
  onboardingTopics: Record<string, TopicStatus>;
  onboardingTrainer: string;
  notes: string;
  traineeSignatureName: string;
  employerSignatureName: string;
}

const safeText = (value?: string | null, fallback = "") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .trim();

const mark = (status: TopicStatus, target: "provided" | "not_provided") => (status === target ? "☒" : "☐");

export async function generateOrientationOnboardingTrainingWord(data: OrientationOnboardingTrainingData) {
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
    VerticalAlign,
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

  const textCell = (
    text: string,
    width: number,
    options?: { bold?: boolean; colSpan?: number; rowSpan?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; minLines?: number; verticalAlign?: (typeof VerticalAlign)[keyof typeof VerticalAlign] },
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      columnSpan: options?.colSpan,
      rowSpan: options?.rowSpan,
      verticalAlign: options?.verticalAlign,
      margins: { top: 70, bottom: 70, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: options?.align,
          children: [new TextRun({ text, bold: options?.bold, size: 20 })],
        }),
        ...Array.from({ length: options?.minLines ?? 0 }).map(() => new Paragraph({ children: [new TextRun({ text: " ", size: 20 })] })),
      ],
    });

  const buildTrainingRows = (
    sectionTitle: string,
    duration: string,
    topics: readonly string[],
    statuses: Record<string, TopicStatus>,
    trainer: string,
  ) => [
    new TableRow({
      children: [
        textCell(sectionTitle, 58, { bold: true, colSpan: 3 }),
        textCell("Süresi:", 18, { bold: true, align: AlignmentType.CENTER }),
        textCell(safeText(duration), 24),
      ],
    }),
    new TableRow({
      children: [
        textCell("KONULAR", 42, { bold: true, rowSpan: 2 }),
        textCell("Durumu", 20, { bold: true, colSpan: 2, align: AlignmentType.CENTER }),
        textCell("Açıklama", 38, { bold: true, rowSpan: 2, align: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      children: [
        textCell("Verildi", 10, { bold: true, align: AlignmentType.CENTER }),
        textCell("Verilmedi", 10, { bold: true, align: AlignmentType.CENTER }),
      ],
    }),
    ...topics.map(
      (topic) =>
        new TableRow({
          children: [
            textCell(topic, 42),
            textCell(mark(statuses[topic] ?? null, "provided"), 10, { align: AlignmentType.CENTER }),
            textCell(mark(statuses[topic] ?? null, "not_provided"), 10, { align: AlignmentType.CENTER }),
            textCell("", 38),
          ],
        }),
    ),
    new TableRow({
      children: [textCell("Eğitimi Veren Ad Soyad - İmza:", 52, { colSpan: 3, align: AlignmentType.CENTER }), textCell(safeText(trainer), 48)],
    }),
  ];

  const formTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [textCell("ORYANTASYON ve İŞBAŞI EĞİTİMİ FORMU", 100, { bold: true, colSpan: 5, align: AlignmentType.CENTER })],
      }),
      new TableRow({
        children: [textCell("", 100, { colSpan: 5, minLines: 1 })],
      }),
      new TableRow({
        children: [
          textCell("PERSONELİN", 4, { rowSpan: 5, align: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
          textCell("Adı Soyadı", 27),
          textCell(safeText(data.fullName), 69, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          textCell("Doğum Yeri ve Yılı", 27),
          textCell(safeText(data.birthPlaceYear), 69, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          textCell("İşe Giriş Tarihi", 27),
          textCell(safeText(data.startDate), 69, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          textCell("Öğrenim Durumu", 27),
          textCell(safeText(data.educationLevel), 69, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          textCell("Pozisyonu", 27),
          textCell(safeText(data.position), 69, { colSpan: 3 }),
        ],
      }),
      ...buildTrainingRows("1- ORYANTASYON EĞİTİMİ", data.orientationDuration, ORIENTATION_TOPICS, data.orientationTopics, data.orientationTrainer),
      ...buildTrainingRows("2- İŞBAŞI EĞİTİMİ :", data.onboardingDuration, ONBOARDING_TOPICS, data.onboardingTopics, data.onboardingTrainer),
      new TableRow({
        children: [textCell("AÇIKLAMA VE NOTLAR :", 100, { bold: true, colSpan: 5 })],
      }),
      new TableRow({
        children: [textCell(safeText(data.notes), 100, { colSpan: 5, minLines: 6 })],
      }),
      new TableRow({
        children: [
          textCell("Eğitimi Alan Personelin", 40, { bold: true, align: AlignmentType.CENTER }),
          textCell("", 20, { minLines: 2 }),
          textCell("İşveren / İ.Vekili", 40, { bold: true, align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          textCell(safeText(data.traineeSignatureName, "Adı Soyadı / İmzası"), 40, { align: AlignmentType.CENTER, minLines: 2 }),
          textCell("", 20, { minLines: 2 }),
          textCell(safeText(data.employerSignatureName, "Adı Soyadı / İmzası"), 40, { align: AlignmentType.CENTER, minLines: 2 }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 360, right: 320, bottom: 360, left: 320 },
          },
        },
        children: [formTable],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${sanitizeFileName(`Oryantasyon-Isbasi-Egitimi-${data.fullName || "Form"}`)}.docx`;
  saveAs(blob, fileName);
  return { blob, fileName };
}
