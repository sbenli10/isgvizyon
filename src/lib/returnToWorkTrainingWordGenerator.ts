import { saveAs } from "file-saver";

export interface ReturnToWorkTrainingInstructor {
  fullName: string;
  tcNumber: string;
  title: string;
}

export interface ReturnToWorkTrainingData {
  organizationName: string;
  address: string;
  sgkRegistrationNo: string;
  trainingMethod: string;
  trainingDate: string;
  trainingDuration: string;
  participantName: string;
  participantTitle: string;
  participantTc: string;
  instructors: ReturnToWorkTrainingInstructor[];
}

const LEGAL_BASIS =
  "Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik\nMadde 6 – 5 İş kazası geçiren veya meslek hastalığına yakalanan çalışana işe dönüşünde çalışmaya başlamadan önce, kazanın veya meslek hastalığının sebepleri, korunma yolları ve güvenli çalışma yöntemleri ile ilgili ilave eğitim verilir.";

const TRAINING_TOPICS = [
  "a) İş Sağlığı ve Güvenliği Genel Kuralları ve İşyeri Çalışma Prosedürleri Uygulama Bilgileri",
  "b) İşyeri Hiyerarşisi, Sorumluluklar ve Ödevler",
  "c) İşyeri Temizliği ve Düzeni",
  "d) İşyerinde Bulunan Risk Etmenleri ve Önlemler",
  "e) İş Ekipmanlarının Güvenli Kullanımı",
  "f) İş Kazalarından Korunma Tekniklerinin Uygulanması",
  "g) İşyeri; Sağlık Güvenlik İşaretleri ve Levhalarının Özellikleri",
  "h) Çalışanların Kişisel Koruyucu Donanım Kullanımı",
  "i) Acil Durum Tahliye İşlemleri",
  "j) Diğer: Eğitmenlerin Kişisel Tecrübeleri",
];

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

export async function generateReturnToWorkTrainingWord(data: ReturnToWorkTrainingData) {
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
  const emptyRows = Array.from({ length: 5 }, (_, index) => data.instructors[index] || { fullName: "", tcNumber: "", title: "" });

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
    options?: {
      bold?: boolean;
      align?: (typeof AlignmentType)[keyof typeof AlignmentType];
      colSpan?: number;
      rowSpan?: number;
      size?: number;
      margins?: { top?: number; bottom?: number; left?: number; right?: number };
    },
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      columnSpan: options?.colSpan,
      rowSpan: options?.rowSpan,
      margins: {
        top: options?.margins?.top ?? 90,
        bottom: options?.margins?.bottom ?? 90,
        left: options?.margins?.left ?? 100,
        right: options?.margins?.right ?? 100,
      },
      children: [
        new Paragraph({
          alignment: options?.align,
          children: [new TextRun({ text, bold: options?.bold, size: options?.size ?? 24 })],
        }),
      ],
    });

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          cell("Kuruluş", 21, { bold: true }),
          cell(safeText(data.organizationName), 79, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Adres", 21, { bold: true }),
          cell(safeText(data.address), 79, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Sgk Sicil No", 21, { bold: true }),
          cell(safeText(data.sgkRegistrationNo), 36),
          cell("Eğitim Şekli", 21, { bold: true }),
          cell(safeText(data.trainingMethod), 22),
        ],
      }),
      new TableRow({
        children: [
          cell("Eğitim Tarihi", 21, { bold: true }),
          cell(formatDate(data.trainingDate), 36),
          cell("Eğitim Süresi", 21, { bold: true }),
          cell(safeText(data.trainingDuration), 22),
        ],
      }),
      new TableRow({
        children: [
          cell("Dayanak", 21, { bold: true }),
          new TableCell({
            width: { size: 79, type: WidthType.PERCENTAGE },
            columnSpan: 3,
            margins: { top: 110, bottom: 110, left: 100, right: 100 },
            children: LEGAL_BASIS.split("\n").map((line, index) =>
              new Paragraph({
                spacing: { after: index === 0 ? 60 : 0 },
                children: [new TextRun({ text: line, bold: index === 0, size: 24 })],
              }),
            ),
          }),
        ],
      }),
      new TableRow({
        children: [
          cell("Eğitim Konuları", 21, { bold: true, rowSpan: 2 }),
          cell("İşe Başlama ve Oryantasyon Eğitimi", 79, {
            colSpan: 3,
            bold: true,
            align: AlignmentType.CENTER,
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 79, type: WidthType.PERCENTAGE },
            columnSpan: 3,
            margins: { top: 110, bottom: 110, left: 100, right: 100 },
            children: TRAINING_TOPICS.map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 24 })] })),
          }),
        ],
      }),
      new TableRow({
        children: [
          cell("İşveren & İşyeri Teknik Eğitmeni & Birim Amiri & Formen & Usta Başı & Usta", 100, {
            colSpan: 4,
            bold: true,
            align: AlignmentType.CENTER,
          }),
        ],
      }),
    ],
  });

  const instructorsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          cell("No", 7, { bold: true, align: AlignmentType.CENTER }),
          cell("Adı-Soyadı", 28, { bold: true, align: AlignmentType.CENTER }),
          cell("TC No", 21, { bold: true, align: AlignmentType.CENTER }),
          cell("Unvanı", 21, { bold: true, align: AlignmentType.CENTER }),
          cell("İmza", 23, { bold: true, align: AlignmentType.CENTER }),
        ],
      }),
      ...emptyRows.map((item, index) =>
        new TableRow({
          children: [
            cell(String(index + 1), 7, { bold: true, align: AlignmentType.CENTER }),
            cell(safeText(item.fullName), 28),
            cell(safeText(item.tcNumber), 21),
            cell(safeText(item.title), 21),
            cell("", 23),
          ],
        }),
      ),
      new TableRow({
        children: [cell("Katılımcı", 100, { colSpan: 5, bold: true, align: AlignmentType.CENTER })],
      }),
      new TableRow({
        children: [
          cell("Adı-Soyadı", 25, { bold: true }),
          cell(safeText(data.participantName), 75, { colSpan: 4 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Görevi", 25, { bold: true }),
          cell(safeText(data.participantTitle), 75, { colSpan: 4 }),
        ],
      }),
      new TableRow({
        children: [
          cell("T.C. Kimlik No", 25, { bold: true }),
          cell(safeText(data.participantTc), 35),
          cell("İmza", 10, { bold: true, align: AlignmentType.CENTER }),
          cell("", 30, { colSpan: 2 }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 520, bottom: 720, left: 520 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [new TextRun({ text: "İŞE DÖNÜŞ İLAVE EĞİTİM KATILIM FORMU", bold: true, size: 30 })],
          }),
          infoTable,
          instructorsTable,
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 120 },
            children: [new TextRun({ text: "Sayfa 1 / 1", size: 18 })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFileName(`Ise-Donus-Ilave-Egitim-Katilim-Formu-${data.participantName || data.organizationName || "Form"}`)}.docx`);
}
