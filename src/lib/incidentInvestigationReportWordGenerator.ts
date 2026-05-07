import { saveAs } from "file-saver";

export interface IncidentInvestigationReportData {
  causeActivity: string;
  whereWhen: string;
  incidentType: string;
  incidentOutcome: string;
  injuredFullName: string;
  injuredJobTitle: string;
  injuredDepartment: string;
  injuredAge: string;
  insuredNumber: string;
  serviceDuration: string;
  incidentDescription: string;
  riskAnalysisStatus: string;
  hazard: string;
  risk: string;
  rootCause: string;
  correctiveActions: string;
  witnessOneName: string;
  witnessOneTitle: string;
  witnessOneDepartment: string;
  witnessTwoName: string;
  witnessTwoTitle: string;
  witnessTwoDepartment: string;
  witnessThreeName: string;
  witnessThreeTitle: string;
  witnessThreeDepartment: string;
  reportDate: string;
  preparedBy: string;
  approvedBy: string;
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

export async function generateIncidentInvestigationReportWord(data: IncidentInvestigationReportData) {
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

  const cell = (
    text: string,
    width: number,
    options?: { bold?: boolean; colSpan?: number; rowSpan?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; minLines?: number; size?: number; color?: string },
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      columnSpan: options?.colSpan,
      rowSpan: options?.rowSpan,
      margins: { top: 70, bottom: 70, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: options?.align,
          children: [new TextRun({ text, bold: options?.bold, size: options?.size ?? 20, color: options?.color })],
        }),
        ...Array.from({ length: options?.minLines ?? 0 }).map(() => new Paragraph({ children: [new TextRun({ text: " ", size: 20 })] })),
      ],
    });

  const witnessRows = [
    [data.witnessOneName, data.witnessOneTitle, data.witnessOneDepartment],
    [data.witnessTwoName, data.witnessTwoTitle, data.witnessTwoDepartment],
    [data.witnessThreeName, data.witnessThreeTitle, data.witnessThreeDepartment],
  ];

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          cell("KAZA / OLAY\nARAŞTIRMA RAPORU", 100, {
            bold: true,
            align: AlignmentType.CENTER,
            colSpan: 4,
            size: 28,
            color: "C00000",
          }),
        ],
      }),
      new TableRow({
        children: [
          cell("Kaza / Olaya neden olan faaliyet :", 30, { bold: true }),
          cell(safeText(data.causeActivity), 70, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Kaza / olay nerede ve ne zaman oldu :", 30, { bold: true }),
          cell(safeText(data.whereWhen), 70, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Kaza / olay türü :", 30, { bold: true }),
          cell(safeText(data.incidentType), 70, { colSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          cell("Kaza / olay sonucu:", 30, { bold: true }),
          cell(safeText(data.incidentOutcome), 70, { colSpan: 3 }),
        ],
      }),
    ],
  });

  const injuredTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          cell("Kazazedenin", 6, { bold: true, rowSpan: 3, align: AlignmentType.CENTER }),
          cell("Adı Soyadı", 18, { bold: true, align: AlignmentType.CENTER }),
          cell(safeText(data.injuredFullName), 26),
          cell("Yaşı", 18, { bold: true, align: AlignmentType.CENTER }),
          cell(safeText(data.injuredAge), 32),
        ],
      }),
      new TableRow({
        children: [
          cell("Görev Ünvanı", 18, { bold: true, align: AlignmentType.CENTER }),
          cell(safeText(data.injuredJobTitle), 26),
          cell("Sigorta sicil no", 18, { bold: true, align: AlignmentType.CENTER }),
          cell(safeText(data.insuredNumber), 32),
        ],
      }),
      new TableRow({
        children: [
          cell("Görev yaptığı bünye", 18, { bold: true, align: AlignmentType.CENTER }),
          cell(safeText(data.injuredDepartment), 26),
          cell("Görev Süresi", 18, { bold: true, align: AlignmentType.CENTER }),
          cell(safeText(data.serviceDuration), 32),
        ],
      }),
    ],
  });

  const bodyTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [cell("KAZA VE OLAYIN TANIMLANMASI", 100, { bold: true, colSpan: 4, align: AlignmentType.CENTER })],
      }),
      new TableRow({
        children: [
          cell(
            `${safeText(data.incidentDescription)}\n\nKazanın oluş mekanizmasını ve şemasını tanımlayınız. Kazaya ilişkin resimleri kaza / olay tanımlamasını doğrulamak amacıyla metin içinde uygun yerlerde kullanmanız uygun olacaktır.`,
            100,
            { colSpan: 4, minLines: 14 },
          ),
        ],
      }),
      new TableRow({
        children: [cell("Kazaya ilişkin risk analizi yapılmış, risk kontrol süreci uygulanıyor mu ? Kurul Kararı var mı?", 100, { bold: true, colSpan: 4 })],
      }),
      new TableRow({
        children: [cell(safeText(data.riskAnalysisStatus), 100, { colSpan: 4, minLines: 5 })],
      }),
      new TableRow({
        children: [cell(`Kaza/ olay ilişkin :\nTehlike: ${safeText(data.hazard)}\nRisk: ${safeText(data.risk)}\nKök Sebep: ${safeText(data.rootCause)}`, 100, { colSpan: 4, minLines: 4 })],
      }),
      new TableRow({
        children: [cell("Kazanın tekrarını engellemek için planlanan düzeltici -Önleyici faaliyetler nelerdir?", 100, { bold: true, colSpan: 4 })],
      }),
      new TableRow({
        children: [cell(safeText(data.correctiveActions), 100, { colSpan: 4, minLines: 8 })],
      }),
    ],
  });

  const witnessTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      ...witnessRows.flatMap(([name, title, department]) => [
        new TableRow({
          children: [
            cell("Görgü Şahidinin", 6, { bold: true, rowSpan: 3, align: AlignmentType.CENTER }),
            cell("Adı Soyadı", 14, { bold: true, align: AlignmentType.CENTER }),
            cell(safeText(name), 80, { colSpan: 2 }),
          ],
        }),
        new TableRow({
          children: [
            cell("Görev Ünvanı", 14, { bold: true, align: AlignmentType.CENTER }),
            cell(safeText(title), 80, { colSpan: 2 }),
          ],
        }),
        new TableRow({
          children: [
            cell("Görev yaptığı bünye", 14, { bold: true, align: AlignmentType.CENTER }),
            cell(safeText(department), 80, { colSpan: 2 }),
          ],
        }),
      ]),
      new TableRow({
        children: [
          cell("Ek-1 Görgü şahitlerinin ifade tutanakları alınması ve kaza / olay araştırma formunun eki olarak saklanması uygun olacaktır.", 100, {
            colSpan: 4,
          }),
        ],
      }),
      new TableRow({
        children: [
          cell("Raporun düzenlenme tarihi:", 28, { bold: true }),
          cell(formatDate(data.reportDate), 44, { align: AlignmentType.CENTER }),
          cell("İmza", 28, { bold: true, align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          cell("Raporu düzenleyen :", 28, { bold: true }),
          cell(safeText(data.preparedBy), 44),
          cell("", 28),
        ],
      }),
      new TableRow({
        children: [
          cell("Raporu Onaylayan:", 28, { bold: true }),
          cell(safeText(data.approvedBy), 44),
          cell("", 28),
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
        children: [
          headerTable,
          new Paragraph({ spacing: { after: 120 } }),
          injuredTable,
          new Paragraph({ spacing: { after: 120 } }),
          bodyTable,
          new Paragraph({ pageBreakBefore: true }),
          witnessTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${sanitizeFileName(`Kaza-Olay-Arastirma-Raporu-${data.injuredFullName || "Rapor"}`)}.docx`;
  saveAs(blob, fileName);
  return { blob, fileName };
}
