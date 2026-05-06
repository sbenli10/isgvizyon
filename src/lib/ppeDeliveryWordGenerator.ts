import { saveAs } from "file-saver";

export interface PpeDeliveryDocumentItem {
  itemName: string;
  quantity: string;
  deliveryDate: string;
}

export interface PpeDeliveryDocumentData {
  companyName: string;
  employeeName: string;
  employeeTc: string;
  employeeJobTitle: string;
  deliveryDate: string;
  periodicControlDate?: string;
  delivererName: string;
  delivererTc?: string;
  delivererJobTitle?: string;
  items: PpeDeliveryDocumentItem[];
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

export async function generatePpeDeliveryWord(data: PpeDeliveryDocumentData) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const borderColor = "111827";
  const introRows = [
    "6331 sayılı İş Sağlığı ve Güvenliği Kanunu uyarınca, işyerinde kullanılması gereken ve aşağıda adı geçen kişisel koruyucu donanımı, belirtilen miktarda, sağlam ve çalışır durumda ve muhakkak surette kullanmak üzere teslim aldım.",
    "Bu kişisel koruyucuları nerede, ne zaman ve nasıl kullanacağım, nasıl temizleyip muhafaza edeceğim ve kullanmadığım takdirde karşılaşacağım tehlikeler konusunda tarafıma verilen eğitimler esnasında bilgilendirildim.",
    "İşimle ilgili verilen bu kişisel koruyucu donanımları;",
    "1. İş esnasında mutlaka verilen eğitimler doğrultusunda kullanacağımı,",
    "2. Bunları kullanmadığım takdirde bana ihtar verileceğini, ikinci ihtarda ise İş Kanunu'nun 25/II-h maddesi uyarınca görevime son verileceğini,",
    "3. Sürekli uygun kullanım için bakımını ve temizliğini yaparak muhafaza edeceğimi,",
    "4. Kişisel koruyucu donanımların eskimesi veya arızalanması halinde, yenisini almak üzere iade edeceğimi ve arızalı kullanılamayacak durumdaki kişisel koruyucu donanımlar ile çalışmayacağımı,",
    "Kabul ve Taahhüt ederim.",
  ];

  const tableRows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 53, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "KKD TÜRÜ", bold: true, size: 24 })] })],
        }),
        new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MİKTAR", bold: true, size: 24 })] })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TARİH", bold: true, size: 24 })] })],
        }),
        new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "İMZA", bold: true, size: 24 })] })],
        }),
      ],
    }),
    ...data.items.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: safeText(item.itemName), size: 22 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: safeText(item.quantity), size: 22 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: formatDate(item.deliveryDate), size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] })] }),
          ],
        }),
    ),
    ...Array.from({ length: Math.max(0, 8 - data.items.length) }).map(
      () =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: " ", size: 22 })] })] }),
          ],
        }),
    ),
  ];

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
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: "TESLİM EDEN GÖREVLİ", bold: true, size: 24 })] })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: "TESLİM ALAN ÇALIŞAN", bold: true, size: 24 })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: `ADI SOYADI  : ${safeText(data.delivererName, "")}`, size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: `TC          : ${safeText(data.delivererTc, "")}`, size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: `GÖREVİ      : ${safeText(data.delivererJobTitle, "")}`, size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "İMZA        :", size: 22 })] }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: `ADI SOYADI  : ${safeText(data.employeeName, "")}`, size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: `TC          : ${safeText(data.employeeTc, "")}`, size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: `GÖREVİ      : ${safeText(data.employeeJobTitle, "")}`, size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "İMZA        :", size: 22 })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "Sayfa 1/1", size: 18 })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "KİŞİSEL KORUYUCU DONANIM", bold: true, size: 34 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: "ZİMMET TUTANAĞI", bold: true, size: 34 })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: `Firma: ${safeText(data.companyName)}`, size: 20 })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `Teslim Tarihi: ${formatDate(data.deliveryDate)}${data.periodicControlDate ? `   •   Periyodik Kontrol Tarihi: ${formatDate(data.periodicControlDate)}` : ""}`,
                size: 20,
              }),
            ],
          }),
          ...introRows.map(
            (row) =>
              new Paragraph({
                spacing: { after: 60 },
                alignment: AlignmentType.JUSTIFIED,
                children: [new TextRun({ text: row, size: 22 })],
              }),
          ),
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
            rows: tableRows,
          }),
          new Paragraph({ spacing: { after: 140 } }),
          signatureTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFileName(`KKD-Zimmet-Formu-${data.employeeName || "Calisan"}`)}.docx`);
}
