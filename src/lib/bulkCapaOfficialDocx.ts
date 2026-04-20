import type { IBorderOptions } from "docx";

export interface BulkCapaOfficialEntry {
  id: string;
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importanceLevel: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  terminDate: string;
  relatedDepartment: string;
  notificationMethod: string;
  responsibleName: string;
  responsibleRole: string;
  approverName: string;
  approverTitle: string;
  includeStamp: boolean;
  mediaUrls: string[];
  aiAnalyzed: boolean;
}

export interface BulkCapaOfficialGeneralInfo {
  companyName: string;
  companyLogoUrl: string | null;
  providerLogoUrl: string | null;
  areaRegion: string;
  observationRange: string;
  reportDate: string;
  observerName: string;
  observerCertificateNo: string;
  responsiblePerson: string;
  employerRepresentativeTitle: string;
  employerRepresentativeName: string;
  reportNo: string;
}

export interface BulkCapaOfficialCompany {
  id: string;
  name: string;
  industry?: string | null;
  employee_count?: number | null;
  notes?: string | null;
  logo_url?: string | null;
}

export interface BulkCapaOfficialOrganization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
}

export interface BulkCapaOfficialProfileContext {
  full_name: string | null;
  position: string | null;
  avatar_url: string | null;
  stamp_url: string | null;
}

export interface BulkCapaOfficialDocxInput {
  entries: BulkCapaOfficialEntry[];
  locationName: string;
  reportCompanyName: string;
  orgData: BulkCapaOfficialOrganization | null;
  selectedCompany: BulkCapaOfficialCompany | null;
  overallAnalysis: string;
  profileContext: BulkCapaOfficialProfileContext | null;
  generalInfo: BulkCapaOfficialGeneralInfo;
}

type DocxImageKind = "jpg" | "png" | "gif" | "bmp";

type LoadedPhoto = {
  entry: BulkCapaOfficialEntry;
  bytes: Uint8Array;
  type: DocxImageKind;
  index: number;
};

const FULL_WIDTH = { size: 100, type: "pct" as const };
const TABLE_BORDERS: Record<string, IBorderOptions> = {
  top: { color: "7A7A7A", style: "single", size: 6 },
  bottom: { color: "7A7A7A", style: "single", size: 6 },
  left: { color: "7A7A7A", style: "single", size: 6 },
  right: { color: "7A7A7A", style: "single", size: 6 },
  insideHorizontal: { color: "B7B7B7", style: "single", size: 4 },
  insideVertical: { color: "B7B7B7", style: "single", size: 4 },
};

const HEADER_BLUE = "173B67";
const HEADER_LIGHT = "F5F7FA";
const ACCENT_RED = "B42318";
const SOFT_RED = "FFF4F2";
const SOFT_BLUE = "EEF4FB";
const MUTED = "667085";
const PAGE_MARGIN = 900;

const toDisplayDate = (value?: string | null) => {
  if (!value) return new Date().toLocaleDateString("tr-TR");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR");
};

const safeText = (value?: string | null, fallback = "Belirtilmedi") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const createCellMargins = (all = 120) => ({
  top: all,
  bottom: all,
  left: all,
  right: all,
});

const inferDocxImageType = (value?: string | null): DocxImageKind => {
  if (!value) return "png";
  const lower = value.toLowerCase();
  if (lower.includes("image/jpeg") || lower.includes("image/jpg") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "jpg";
  }
  if (lower.includes("image/gif") || lower.endsWith(".gif")) return "gif";
  if (lower.includes("image/bmp") || lower.endsWith(".bmp")) return "bmp";
  return "png";
};

const fetchImageBytes = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.warn("Bulk CAPA DOCX image load failed:", error);
    return null;
  }
};

const buildActionText = (entry: BulkCapaOfficialEntry) => {
  const corrective = safeText(entry.correctiveAction, "");
  const preventive = safeText(entry.preventiveAction, "");
  if (corrective && preventive) return `${corrective} ${preventive}`;
  return corrective || preventive || "Aksiyon bilgisi belirtilmedi.";
};

const getPriorityGroup = (level: BulkCapaOfficialEntry["importanceLevel"]) => {
  if (level === "Kritik" || level === "Yüksek") {
    return {
      label: "YÜKSEK RİSK",
      term: "24 Saat İçinde",
      fill: "C1121F",
      text: "FFFFFF",
    };
  }

  if (level === "Orta") {
    return {
      label: "ORTA RİSK",
      term: "3 İş Günü İçinde",
      fill: "D97706",
      text: "FFFFFF",
    };
  }

  return {
    label: "DÜŞÜK RİSK",
    term: "1 Hafta İçinde",
    fill: "2E7D32",
    text: "FFFFFF",
  };
};

const buildManagerSummary = (entries: BulkCapaOfficialEntry[]) => {
  const critical = entries.filter((entry) => entry.importanceLevel === "Kritik").length;
  const high = entries.filter((entry) => entry.importanceLevel === "Yüksek").length;
  const medium = entries.filter((entry) => entry.importanceLevel === "Orta").length;
  const low = entries.filter((entry) => entry.importanceLevel === "Düşük").length;

  return [
    critical > 0 ? `${critical} kritik bulgu için derhal müdahale gerekmektedir.` : null,
    high > 0 ? `${high} yüksek riskli bulgu için kısa sürede aksiyon alınmalıdır.` : null,
    medium > 0 ? `${medium} orta riskli bulgu için planlı iyileştirme takvimi oluşturulmalıdır.` : null,
    low > 0 ? `${low} düşük riskli bulgu izleme planına alınmalıdır.` : null,
  ]
    .filter(Boolean)
    .join(" ");
};

export const getBulkCapaLegalBasis = (entry: BulkCapaOfficialEntry) => {
  const haystack = `${entry.description} ${entry.riskDefinition} ${entry.relatedDepartment}`.toLocaleLowerCase("tr-TR");

  if (haystack.includes("elektrik") || haystack.includes("pano") || haystack.includes("priz") || haystack.includes("kablo")) {
    return "İşyeri Bina ve Eklentileri Yönetmeliği Ek-1, Elektrik Tesislerinde Topraklamalar Yönetmeliği, 6331 Sayılı Kanun Md. 4.";
  }

  if (haystack.includes("yangın") || haystack.includes("tüp") || haystack.includes("acil durum") || haystack.includes("parlama")) {
    return "Binaların Yangından Korunması Hakkında Yönetmelik, Acil Durumlar Hakkında Yönetmelik, 6331 Sayılı Kanun Md. 11.";
  }

  if (haystack.includes("kimyasal") || haystack.includes("solvent") || haystack.includes("boya")) {
    return "Kimyasal Maddelerle Çalışmalarda Sağlık ve Güvenlik Önlemleri Yönetmeliği, KKD Kullanımı Yönetmeliği.";
  }

  if (haystack.includes("forklift") || haystack.includes("istif") || haystack.includes("trafik")) {
    return "İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği, İşaretler Yönetmeliği.";
  }

  if (haystack.includes("yüksekte") || haystack.includes("iskele") || haystack.includes("merdiven")) {
    return "Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği, İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği.";
  }

  return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu Md. 4, İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği, İşyeri Bina ve Eklentileri Yönetmeliği.";
};

const buildProcedureSections = (
  companyName: string,
  locationName: string,
  summaryText: string,
) => [
  {
    title: "1. AMAÇ",
    body: `${companyName} işyerinde mevcut çalışma koşullarından kaynaklanan tehlike ve risklerin tespit edilmesi, yürürlükteki iş sağlığı ve güvenliği mevzuatına uygunluğunun değerlendirilmesi ve çalışan maruziyetinin kabul edilebilir seviyeye indirilmesi amaçlanmaktadır.`,
  },
  {
    title: "2. KAPSAM",
    body: `Bu rapor ${companyName} işyerinde gözlem yapılan ${locationName} alanı ve yüklenen saha fotoğrafları esas alınarak hazırlanmıştır. İşyerinde bulunan makine, ekipman, bina, eklenti, çalışan, ziyaretçi ve tedarikçi kaynaklı uygunsuzluklar kapsam dahilindedir.`,
  },
  {
    title: "3. REFERANSLAR",
    body: "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu, İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği, İşyeri Bina ve Eklentileri Yönetmeliği ve ilgili ikincil mevzuat hükümleri esas alınmıştır.",
  },
  {
    title: "4. TANIMLAR",
    body: "Tehlike; zarar verme potansiyeli olan durum veya kaynağı, risk ise bu tehlikeden kaynaklanabilecek kayıp, yaralanma ya da zararlı sonuç meydana gelme ihtimalini ifade eder. Önleme, riskleri ortadan kaldırmak veya kabul edilebilir seviyeye indirmek için planlanan tüm tedbirlerdir.",
  },
  {
    title: "5. RAPORLAMA YÖNTEMİ",
    body: "Yüklenen saha fotoğrafları yapay zeka destekli analiz ile incelenmiş; her fotoğraf için tespit edilen uygunsuzluk, risk analizi, mevzuat dayanağı ve önerilen DÖF aksiyonu ayrı satır halinde yapılandırılmıştır. Nihai çıktı uzman kontrolü için düzenlenebilir resmi rapor formatında hazırlanmıştır.",
  },
  {
    title: "6.4. RİSK DEĞERLENDİRMESİ AKSİYON PLANI",
    body: `${companyName} risk değerlendirmesi ekibi tarafından çalışma sonrasında aksiyon planı oluşturulur. Belirlenen aksiyonların öncelik derecesine göre hedef tarih yazılır, sorumlular atanır, durum ve kapatma tarihi takip edilir. Tamamlanan, hedef tarihi geçen, zaman var ve hedef tarih verilmemiş statüleri üzerinden aksiyon performansı izlenir. ${summaryText}`,
  },
  {
    title: "6.5. FINE-KINNEY METODU",
    body: "Risk skoru Olasılık x Frekans x Şiddet formülü ile hesaplanır. Olasılık, tehlikenin gerçekleşme ihtimalini; frekans, maruziyet sıklığını; şiddet ise oluşabilecek zararın etkisini ifade eder. Bu yöntem, riskleri önceliklendirerek iyileştirme planının sistematik şekilde oluşturulmasını sağlar.",
  },
];

export async function generateBulkCapaOfficialDocx(input: BulkCapaOfficialDocxInput): Promise<Blob> {
  const {
    entries,
    locationName,
    reportCompanyName,
    orgData,
    selectedCompany,
    overallAnalysis,
    profileContext,
    generalInfo,
  } = input;

  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    HeadingLevel,
    ImageRun,
    Packer,
    PageBreak,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const effectiveCompanyName = safeText(
    reportCompanyName || generalInfo.companyName || selectedCompany?.name || orgData?.name,
    "Firma Belirtilmedi",
  );
  const effectiveLocation = safeText(generalInfo.areaRegion || locationName, "Genel Saha");
  const effectiveObserver = safeText(generalInfo.observerName || profileContext?.full_name, "İş Güvenliği Uzmanı");
  const effectiveObserverTitle = safeText(profileContext?.position, "İş Güvenliği Uzmanı");
  const effectiveObserverCertificate = safeText(generalInfo.observerCertificateNo, "-");
  const effectiveDate = toDisplayDate(generalInfo.reportDate);
  const hazardClass = safeText(selectedCompany?.notes || selectedCompany?.industry, "Tehlike sınıfı belirtilmedi");

  const managerSummary = overallAnalysis?.trim() || `${buildManagerSummary(entries)} Aksiyonların termin ve sorumluluk bazında düzenli takibi yapılmalıdır.`;
  const procedureSections = buildProcedureSections(effectiveCompanyName, effectiveLocation, managerSummary);

  const companyLogoSource = generalInfo.companyLogoUrl || selectedCompany?.logo_url || null;
  const providerLogoSource = generalInfo.providerLogoUrl || orgData?.logo_url || null;
  const stampSource = entries.some((entry) => entry.includeStamp) ? profileContext?.stamp_url || null : null;

  const [companyLogoBytes, providerLogoBytes, stampBytes, photoEvidence] = await Promise.all([
    companyLogoSource ? fetchImageBytes(companyLogoSource) : Promise.resolve(null),
    providerLogoSource ? fetchImageBytes(providerLogoSource) : Promise.resolve(null),
    stampSource ? fetchImageBytes(stampSource) : Promise.resolve(null),
    Promise.all(
      entries.flatMap((entry) =>
        entry.mediaUrls.map(async (url, index) => {
          const bytes = await fetchImageBytes(url);
          if (!bytes) return null;
          return {
            entry,
            bytes,
            type: inferDocxImageType(url),
            index,
          } as LoadedPhoto;
        }),
      ),
    ).then((items) => items.filter((item): item is LoadedPhoto => Boolean(item))),
  ]);

  const buildProcedureHeaderTable = (pageLabel: string) =>
    new Table({
      width: FULL_WIDTH,
      layout: TableLayoutType.FIXED,
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 18, type: WidthType.PERCENTAGE },
              verticalAlign: "center",
              children: companyLogoBytes
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: companyLogoBytes,
                          type: inferDocxImageType(companyLogoSource),
                          transformation: { width: 58, height: 58 },
                        }),
                      ],
                    }),
                  ]
                : [new Paragraph({ children: [new TextRun("")] })],
            }),
            new TableCell({
              width: { size: 54, type: WidthType.PERCENTAGE },
              margins: createCellMargins(130),
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "TEHLİKE TANIMLAMA VE RİSK DEĞERLENDİRMESİ", bold: true, size: 22 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "PROSEDÜRÜ", bold: true, size: 22 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              children: [
                new Table({
                  width: FULL_WIDTH,
                  borders: TABLE_BORDERS,
                  rows: [
                    ["Doküman No", "İSG.PR.002"],
                    ["Yayın Tarihi", "01.01.2026"],
                    ["Revizyon Tarihi", "-"],
                    ["Revizyon No", "-"],
                    ["Sayfa No", pageLabel],
                  ].map(
                    ([label, value]) =>
                      new TableRow({
                        children: [
                          new TableCell({
                            shading: { fill: HEADER_LIGHT },
                            margins: createCellMargins(70),
                            children: [new Paragraph({ children: [new TextRun({ text: label, size: 15, bold: true })] })],
                          }),
                          new TableCell({
                            margins: createCellMargins(70),
                            children: [new Paragraph({ children: [new TextRun({ text: value, size: 15 })] })],
                          }),
                        ],
                      }),
                  ),
                }),
              ],
            }),
          ],
        }),
      ],
    });

  const header = (pageLabel: string) =>
    new Header({
      children: [buildProcedureHeaderTable(pageLabel)],
    });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "İŞ GÜVENLİĞİ UZMANI    İŞYERİ HEKİMİ    ÇALIŞAN TEM.    DESTEK ELEMANI    İŞVEREN/VEKİLİ", size: 16, color: MUTED })],
      }),
    ],
  });

  const coverMetaTable = new Table({
    width: { size: 72, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      ["Rapor Tarihi", effectiveDate],
      ["Hazırlayan", `${effectiveObserver} / ${effectiveObserverTitle}`],
      ["Rapor No", safeText(generalInfo.reportNo, "-")],
      ["Tehlike Sınıfı", hazardClass],
    ].map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 42, type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_LIGHT },
              margins: createCellMargins(120),
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: label, bold: true, size: 18 })] })],
            }),
            new TableCell({
              width: { size: 58, type: WidthType.PERCENTAGE },
              margins: createCellMargins(120),
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: value, size: 18 })] })],
            }),
          ],
        }),
    ),
  });

  const mainFindingTable = new Table({
    width: FULL_WIDTH,
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          ["TESPİT EDİLEN UYGUNSUZLUK", 25],
          ["RİSK ANALİZİ", 22],
          ["MEVZUAT DAYANAĞI", 23],
          ["ÖNERİLEN DÖF (AKSİYON)", 30],
        ].map(
          ([title, width]) =>
            new TableCell({
              width: { size: width as number, type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_BLUE },
              margins: createCellMargins(100),
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: title as string, bold: true, color: "FFFFFF", size: 18 })],
                }),
              ],
            }),
        ),
      }),
      ...entries.map(
        (entry, index) =>
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: index % 2 === 0 ? "FFFFFF" : "FAFAFA" },
                margins: createCellMargins(110),
                children: [new Paragraph({ children: [new TextRun({ text: entry.description, size: 18 })] })],
              }),
              new TableCell({
                shading: { fill: index % 2 === 0 ? "FFFFFF" : "FAFAFA" },
                margins: createCellMargins(110),
                children: [new Paragraph({ children: [new TextRun({ text: entry.riskDefinition, size: 18 })] })],
              }),
              new TableCell({
                shading: { fill: index % 2 === 0 ? "FFFFFF" : "FAFAFA" },
                margins: createCellMargins(110),
                children: [new Paragraph({ children: [new TextRun({ text: getBulkCapaLegalBasis(entry), size: 18 })] })],
              }),
              new TableCell({
                shading: { fill: index % 2 === 0 ? "FFFFFF" : "FAFAFA" },
                margins: createCellMargins(110),
                children: [new Paragraph({ children: [new TextRun({ text: buildActionText(entry), size: 18 })] })],
              }),
            ],
          }),
      ),
    ],
  });

  const actionPlanTable = new Table({
    width: FULL_WIDTH,
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          ["RİSK SEVİYESİ", 20],
          ["TERMİN", 16],
          ["YAPILACAK İŞLEMLER", 44],
          ["SORUMLU", 20],
        ].map(
          ([title, width]) =>
            new TableCell({
              width: { size: width as number, type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_BLUE },
              margins: createCellMargins(100),
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title as string, bold: true, color: "FFFFFF", size: 18 })] })],
            }),
        ),
      }),
      ...entries.map((entry) => {
        const priority = getPriorityGroup(entry.importanceLevel);
        return new TableRow({
          children: [
            new TableCell({
              shading: { fill: priority.fill },
              margins: createCellMargins(110),
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: priority.label, bold: true, color: priority.text, size: 18 })] })],
            }),
            new TableCell({
              margins: createCellMargins(110),
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: entry.terminDate ? toDisplayDate(entry.terminDate) : priority.term, size: 18 })] })],
            }),
            new TableCell({
              margins: createCellMargins(110),
              children: [new Paragraph({ children: [new TextRun({ text: buildActionText(entry), size: 18 })] })],
            }),
            new TableCell({
              margins: createCellMargins(110),
              children: [new Paragraph({ children: [new TextRun({ text: `${safeText(entry.responsibleName, "-")} / ${safeText(entry.responsibleRole, "-")}`, size: 18 })] })],
            }),
          ],
        });
      }),
    ],
  });

  const teamRows = [
    ["İŞVEREN / İŞVEREN VEKİLİ", safeText(generalInfo.employerRepresentativeName, "Belirtilmedi"), ""],
    ["İŞ GÜVENLİĞİ UZMANI", effectiveObserver, ""],
    ["İŞYERİ HEKİMİ", safeText(generalInfo.responsiblePerson, "-"), ""],
    ["ÇALIŞAN TEMSİLCİSİ", "Belirtilmedi", ""],
    ["DESTEK ELEMANI", "Belirtilmedi", ""],
    ["BİLGİ SAHİBİ ÇALIŞAN", "Belirtilmedi", ""],
  ];

  const teamTable = new Table({
    width: { size: 82, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          ["RİSK DEĞERLENDİRME EKİBİ", 24],
          ["Unvan", 38],
          ["Ad - Soyad", 28],
          ["İmza", 10],
        ].map(
          ([title, width]) =>
            new TableCell({
              width: { size: width as number, type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_LIGHT },
              margins: createCellMargins(100),
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title as string, bold: true, size: 18 })] })],
            }),
        ),
      }),
      ...teamRows.map(([role, name, sign], index) =>
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: index === 0 ? SOFT_BLUE : "FFFFFF" },
              margins: createCellMargins(100),
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: index === 0 ? "RİSK\nDEĞERLENDİRME\nEKİBİ" : "", bold: true, size: 16 })],
                }),
              ],
            }),
            new TableCell({
              margins: createCellMargins(100),
              children: [new Paragraph({ children: [new TextRun({ text: role, size: 18 })] })],
            }),
            new TableCell({
              margins: createCellMargins(100),
              children: [new Paragraph({ children: [new TextRun({ text: name, size: 18 })] })],
            }),
            new TableCell({
              margins: createCellMargins(100),
              children: [new Paragraph({ children: [new TextRun({ text: sign, size: 18 })] })],
            }),
          ],
        }),
      ),
    ],
  });

  const signatureTable = new Table({
    width: FULL_WIDTH,
    layout: TableLayoutType.FIXED,
    borders: {
      top: { color: "FFFFFF", style: "none", size: 0 },
      bottom: { color: "FFFFFF", style: "none", size: 0 },
      left: { color: "FFFFFF", style: "none", size: 0 },
      right: { color: "FFFFFF", style: "none", size: 0 },
      insideHorizontal: { color: "FFFFFF", style: "none", size: 0 },
      insideVertical: { color: "FFFFFF", style: "none", size: 0 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [new TextRun({ text: "Hazırlayan", bold: true, size: 20 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: effectiveObserver, bold: true, size: 19 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${effectiveObserverTitle} / Belge No: ${effectiveObserverCertificate}`, size: 17, color: MUTED })],
              }),
              ...(stampBytes
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 100 },
                      children: [
                        new ImageRun({
                          data: stampBytes,
                          type: inferDocxImageType(stampSource),
                          transformation: { width: 110, height: 110 },
                        }),
                      ],
                    }),
                  ]
                : []),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [new TextRun({ text: "Onaylayan", bold: true, size: 20 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: safeText(generalInfo.employerRepresentativeName, "İşveren / İşveren Vekili"), bold: true, size: 19 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: safeText(generalInfo.employerRepresentativeTitle, "İşveren / İşveren Vekili"), size: 17, color: MUTED })],
              }),
              ...(providerLogoBytes
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 100 },
                      children: [
                        new ImageRun({
                          data: providerLogoBytes,
                          type: inferDocxImageType(providerLogoSource),
                          transformation: { width: 92, height: 92 },
                        }),
                      ],
                    }),
                  ]
                : []),
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
              top: PAGE_MARGIN,
              right: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
            },
          },
        },
        headers: { default: header("Kapak") },
        footers: { default: footer },
        children: [
          new Paragraph({ spacing: { after: 260 }, children: [new TextRun("")] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 260, after: 90 },
            children: [new TextRun({ text: effectiveCompanyName.toLocaleUpperCase("tr-TR"), bold: true, color: HEADER_BLUE, size: 30 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: effectiveLocation.toLocaleUpperCase("tr-TR"), color: MUTED, size: 18 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 260, after: 120 },
            children: [new TextRun({ text: "İŞ SAĞLIĞI VE GÜVENLİĞİ", color: HEADER_BLUE, bold: true, size: 24 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 260 },
            children: [new TextRun({ text: "TESPİT VE DÜZELTİCİ / ÖNLEYİCİ FAALİYET RAPORU", bold: true, color: ACCENT_RED, size: 26 })],
          }),
          coverMetaTable,
          new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: "" })] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Resmi fotoğraf analiz raporu", italics: true, color: MUTED, size: 18 })],
          }),
        ],
      },
      {
        properties: {
          page: {
            margin: {
              top: PAGE_MARGIN,
              right: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
            },
          },
        },
        headers: { default: header("2") },
        footers: { default: footer },
        children: [
          ...procedureSections.flatMap((section) => [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 120, after: 80 },
              children: [new TextRun({ text: section.title, bold: true, size: 24 })],
            }),
            new Paragraph({
              spacing: { after: 140 },
              children: [new TextRun({ text: section.body, size: 20 })],
            }),
          ]),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 120, after: 80 },
            children: [new TextRun({ text: "7. RİSK DEĞERLENDİRME EKİBİ", bold: true, size: 24 })],
          }),
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: "İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği esas alınarak ekip bilgileri aşağıda resmi tablo halinde gösterilmiştir.", size: 20 })],
          }),
          teamTable,
          new Paragraph({
            spacing: { before: 220, after: 80 },
            children: [new TextRun({ text: "8. FOTOĞRAF ANALİZİNE DAYALI TESPİT TABLOSU", bold: true, size: 24 })],
          }),
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: "Aşağıdaki tablo, yüklenen saha fotoğraflarından otomatik analiz edilen uygunsuzlukları ve uzman düzenlemesinden geçirilmiş DÖF aksiyonlarını göstermektedir.", size: 20 })],
          }),
          mainFindingTable,
          new Paragraph({
            spacing: { before: 220, after: 80 },
            children: [new TextRun({ text: "9. TERMİN VE AKSİYON PLANI", bold: true, size: 24 })],
          }),
          actionPlanTable,
          new Paragraph({
            spacing: { before: 220, after: 80 },
            children: [new TextRun({ text: "10. YÖNETİCİ ÖZETİ VE HUKUKİ HATIRLATMA", bold: true, size: 24, color: ACCENT_RED })],
          }),
          new Table({
            width: FULL_WIDTH,
            layout: TableLayoutType.FIXED,
            borders: {
              top: { color: ACCENT_RED, style: BorderStyle.SINGLE, size: 10 },
              bottom: { color: ACCENT_RED, style: BorderStyle.SINGLE, size: 10 },
              left: { color: ACCENT_RED, style: BorderStyle.SINGLE, size: 10 },
              right: { color: ACCENT_RED, style: BorderStyle.SINGLE, size: 10 },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: SOFT_RED },
                    margins: { top: 180, bottom: 180, left: 220, right: 220 },
                    children: [
                      new Paragraph({
                        spacing: { after: 100 },
                        children: [new TextRun({ text: "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu gereğince işveren, çalışanların sağlık ve güvenliğini sağlamakla yükümlüdür.", bold: true, color: ACCENT_RED, size: 20 })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: managerSummary, size: 20 })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 220, after: 80 },
            children: [new TextRun({ text: "11. ONAY VE İMZA ALANI", bold: true, size: 24 })],
          }),
          signatureTable,
          ...(photoEvidence.length > 0
            ? [
                new Paragraph({ children: [new PageBreak()] }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: "EK-1 FOTOĞRAF KANITLARI", bold: true, size: 24 })],
                }),
                ...photoEvidence.flatMap((photo, index) => [
                  new Paragraph({
                    spacing: { before: index === 0 ? 80 : 220, after: 80 },
                    children: [new TextRun({ text: `Fotoğraf ${index + 1} - ${photo.entry.relatedDepartment || "Genel Alan"}`, bold: true, size: 20 })],
                  }),
                  new Paragraph({
                    spacing: { after: 60 },
                    children: [new TextRun({ text: photo.entry.description, size: 18 })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 },
                    children: [
                      new ImageRun({
                        data: photo.bytes,
                        type: photo.type,
                        transformation: { width: 420, height: 280 },
                      }),
                    ],
                  }),
                ]),
              ]
            : []),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
