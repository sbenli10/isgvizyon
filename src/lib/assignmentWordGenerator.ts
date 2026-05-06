import { saveAs } from "file-saver";

export type AssignmentType =
  | "risk_assessment_team"
  | "support_staff"
  | "employee_representative";

export type HazardClass = "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";

export interface AssignmentLetterDocumentData {
  assignmentType: AssignmentType;
  assignmentTitle: string;
  companyName: string;
  companyLogoUrl?: string;
  institutionTitle?: string;
  institutionSubtitle?: string;
  documentCode?: string;
  publishNumber?: string;
  revisionDate?: string;
  employeeName: string;
  employeeJobTitle: string;
  startDate: string;
  duration: number;
  weeklyHours: number;
  hazardClass: HazardClass;
  createdAt?: string;
  documentNumber?: string;
  leftSignatureName?: string;
  leftSignatureTitle?: string;
  rightSignatureName?: string;
  rightSignatureTitle?: string;
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

const getAssignmentSubject = (data: AssignmentLetterDocumentData) => {
  if (data.assignmentType === "risk_assessment_team") {
    return "Risk değerlendirme ekibi görevlendirmesi hk.";
  }
  if (data.assignmentType === "support_staff") {
    return "İSG destek elemanı görevlendirmesi hk.";
  }
  return "Çalışan temsilcisi görevlendirmesi hk.";
};

const getLegalReferences = (type: AssignmentType) => {
  if (type === "support_staff") {
    return [
      "6331 sayılı İş Sağlığı ve Güvenliği Kanunu",
      "İş Sağlığı ve İş Güvenliği Kurulları Hakkında Yönetmelik",
      "İşyerlerinde Acil Durumlar Hakkında Yönetmelik",
      "Esaslara İlişkin Tebliğ",
    ];
  }

  if (type === "employee_representative") {
    return [
      "6331 sayılı İş Sağlığı ve Güvenliği Kanunu",
      "İş Sağlığı ve Güvenliği ile İlgili Çalışan Temsilcisinin Nitelikleri ve Seçilme Usul ve Esaslarına İlişkin Tebliğ",
      "İş Sağlığı ve Güvenliği Kurulları Hakkında Yönetmelik",
    ];
  }

  return [
    "6331 sayılı İş Sağlığı ve Güvenliği Kanunu",
    "İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği",
    "İş Sağlığı ve Güvenliği Kurulları Hakkında Yönetmelik",
  ];
};

const getBodyParagraphs = (data: AssignmentLetterDocumentData) => {
  const commonIntro =
    "İlgi yazılar ve yürürlükte bulunan iş sağlığı ve güvenliği mevzuatı kapsamında işyerimizde/işletmemizde kurulması ve sürdürülmesi gereken iş sağlığı ve güvenliği süreçleri doğrultusunda aşağıda bilgileri yer alan personelin görevlendirilmesi uygun görülmüştür.";

  if (data.assignmentType === "support_staff") {
    return [
      commonIntro,
      `${data.employeeName}, ${safeText(data.employeeJobTitle)} unvanıyla destek elemanı olarak görevlendirilmiştir. Görev başlangıç tarihi ${formatDate(data.startDate)} olup görevlendirme süresi ${data.duration} ay, haftalık görev süresi ${data.weeklyHours} saat olarak planlanmıştır.`,
      "Görev kapsamında acil durumlara hazırlık, tahliye organizasyonu, yangınla mücadele desteği, çalışan yönlendirmesi ve ilgili eğitim/tatbikat süreçlerine katılım sağlanması beklenmektedir.",
      "Bilgi ve gereğini rica ederim.",
    ];
  }

  if (data.assignmentType === "employee_representative") {
    return [
      commonIntro,
      `${data.employeeName}, ${safeText(data.employeeJobTitle)} unvanıyla çalışan temsilcisi olarak görevlendirilmiştir. Görev başlangıç tarihi ${formatDate(data.startDate)} olup görevlendirme süresi ${data.duration} ay, haftalık görev süresi ${data.weeklyHours} saat olarak planlanmıştır.`,
      "Görev kapsamında çalışanların iş sağlığı ve güvenliği konularındaki görüş, öneri ve taleplerinin iletilmesi; iyileştirme süreçlerine katılım sağlanması ve kurul/işveren ile iletişim süreçlerinde temsil görevinin yürütülmesi beklenmektedir.",
      "Bilgi ve gereğini rica ederim.",
    ];
  }

  return [
    commonIntro,
    `${data.employeeName}, ${safeText(data.employeeJobTitle)} unvanıyla risk değerlendirme ekibi üyesi olarak görevlendirilmiştir. Görev başlangıç tarihi ${formatDate(data.startDate)} olup görevlendirme süresi ${data.duration} ay, haftalık görev süresi ${data.weeklyHours} saat olarak planlanmıştır.`,
    `Görev kapsamında ${data.hazardClass.toLocaleLowerCase("tr-TR")} sınıfta yer alan işyerimizde tehlikelerin belirlenmesi, risklerin analiz edilmesi, gerekli kontrol tedbirlerinin önerilmesi ve iyileştirme süreçlerine katılım sağlanması beklenmektedir.`,
    "Bilgi ve gereğini rica ederim.",
  ];
};

async function loadImageBytes(imageUrl?: string) {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function generateAssignmentWord(data: AssignmentLetterDocumentData) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
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

  const headerBlue = "1D3760";
  const headerRed = "C1121F";
  const headerLight = "F4F6F8";
  const borderColor = "7A7A7A";

  const logoBytes = await loadImageBytes(data.companyLogoUrl);
  const references = getLegalReferences(data.assignmentType);
  const bodyParagraphs = getBodyParagraphs(data);
  const institutionTitle = safeText(data.institutionTitle, "T.C.");
  const institutionSubtitle = safeText(data.institutionSubtitle, data.companyName.toUpperCase("tr-TR"));
  const documentCode = safeText(data.documentCode, "ISG-BLG-ATM");
  const publishNumber = safeText(data.publishNumber, "Yayın 00");
  const revisionDate = formatDate(data.revisionDate || data.createdAt);
  const leftSignatureName = safeText(data.leftSignatureName, "İşveren / İşveren Vekili");
  const leftSignatureTitle = safeText(data.leftSignatureTitle, "");
  const rightSignatureName = safeText(data.rightSignatureName, data.employeeName);
  const rightSignatureTitle = safeText(data.rightSignatureTitle, safeText(data.employeeJobTitle));

  const buildMetaRow = (label: string, value: string) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 42, type: WidthType.PERCENTAGE },
          shading: { fill: headerLight },
          margins: { top: 70, bottom: 70, left: 90, right: 90 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: 18 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 58, type: WidthType.PERCENTAGE },
          margins: { top: 70, bottom: 70, left: 90, right: 90 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: value, size: 18 })],
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
              top: 900,
              right: 900,
              bottom: 900,
              left: 900,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                layout: TableLayoutType.FIXED,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
                  bottom: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
                  left: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
                  right: { style: BorderStyle.SINGLE, size: 8, color: borderColor },
                  insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
                  insideVertical: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 18, type: WidthType.PERCENTAGE },
                        margins: { top: 120, bottom: 120, left: 120, right: 120 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: logoBytes
                              ? [
                                  new ImageRun({
                                    data: logoBytes,
                                    transformation: { width: 72, height: 72 },
                                  }),
                                ]
                              : [new TextRun({ text: " ", size: 18 })],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 52, type: WidthType.PERCENTAGE },
                        margins: { top: 90, bottom: 90, left: 120, right: 120 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: institutionTitle, bold: true, size: 18 })],
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: institutionSubtitle.toUpperCase("tr-TR"), bold: true, color: headerRed, size: 18 })],
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 80 },
                            children: [new TextRun({ text: data.assignmentTitle.toUpperCase("tr-TR"), bold: true, color: headerBlue, size: 22 })],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                        children: [
                          new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                              buildMetaRow("Belge No", data.documentNumber || "-"),
                              buildMetaRow("Belge Kodu", documentCode),
                              buildMetaRow("Yayın No", publishNumber),
                              buildMetaRow("Revizyon Tarihi", revisionDate),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "İSGVizyon tarafından oluşturulan resmi atama yazısı", size: 16, color: "6B7280" })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { before: 260, after: 120 },
            children: [
              new TextRun({ text: "Sayı    : ", size: 20 }),
              new TextRun({ text: data.documentNumber || "-", size: 20 }),
              new TextRun({ text: "\t\t\t\t\tTarih: ", size: 20 }),
              new TextRun({ text: formatDate(data.createdAt), size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 220 },
            children: [
              new TextRun({ text: "Konu  : ", size: 20 }),
              new TextRun({ text: getAssignmentSubject(data), size: 20 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 220 },
            children: [new TextRun({ text: "Sayın: ............................................................", bold: true, size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "İlgi:", bold: true, size: 20 })],
            spacing: { after: 80 },
          }),
          ...references.map((item, index) =>
            new Paragraph({
              children: [new TextRun({ text: `${String.fromCharCode(97 + index)}) ${item}`, size: 20 })],
              indent: { left: 500 },
              spacing: { after: 30 },
            }),
          ),
          new Paragraph({ spacing: { after: 200 } }),
          ...bodyParagraphs.map((paragraph) =>
            new Paragraph({
              spacing: { after: 160 },
              alignment: AlignmentType.JUSTIFIED,
              children: [new TextRun({ text: paragraph, size: 20 })],
            }),
          ),
          new Paragraph({ spacing: { after: 500 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: leftSignatureName, bold: true, size: 20 })],
                      }),
                      leftSignatureTitle !== "-"
                        ? new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: leftSignatureTitle, size: 18 })],
                          })
                        : new Paragraph({}),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 500 },
                        children: [new TextRun({ text: "İmza", size: 18 })],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: rightSignatureName, bold: true, size: 20 })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: rightSignatureTitle, size: 18 })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 500 },
                        children: [new TextRun({ text: "İmza", size: 18 })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFileName(`Atama-Yazisi-${data.employeeName}`)}.docx`);
}
