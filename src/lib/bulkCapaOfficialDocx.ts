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
  entryId: string;
  bytes: Uint8Array;
  type: DocxImageKind;
  index: number;
};

const FULL_WIDTH = { size: 100, type: "pct" as const };

const TABLE_BORDERS: Record<string, IBorderOptions> = {
  top: { color: "8C8C8C", style: "single", size: 6 },
  bottom: { color: "8C8C8C", style: "single", size: 6 },
  left: { color: "8C8C8C", style: "single", size: 6 },
  right: { color: "8C8C8C", style: "single", size: 6 },
  insideHorizontal: { color: "B8B8B8", style: "single", size: 4 },
  insideVertical: { color: "B8B8B8", style: "single", size: 4 },
};

const HEADER_BLUE = "1D3760";
const HEADER_RED = "C1121F";
const SOFT_RED = "FFF4F2";
const HEADER_LIGHT = "F4F6F8";
const MUTED = "6B7280";

const safeText = (value?: string | null, fallback = "Belirtilmedi") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const toDisplayDate = (value?: string | null) => {
  if (!value) return new Date().toLocaleDateString("tr-TR");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR");
};

const inferDocxImageType = (value?: string | null): DocxImageKind => {
  if (!value) return "png";
  const lower = value.toLowerCase();
  if (lower.includes("image/jpeg") || lower.includes("image/jpg") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
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

const createCellMargins = (all = 100) => ({
  top: all,
  bottom: all,
  left: all,
  right: all,
});

const buildActionText = (entry: BulkCapaOfficialEntry) => {
  const corrective = safeText(entry.correctiveAction, "");
  const preventive = safeText(entry.preventiveAction, "");
  if (corrective && preventive) {
    return `${corrective} ${preventive}`;
  }
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
    return "İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği, Güvenlik ve Sağlık İşaretleri Yönetmeliği.";
  }
  if (haystack.includes("yüksekte") || haystack.includes("iskele") || haystack.includes("merdiven")) {
    return "Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği, İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği.";
  }

  return "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu Md. 4, İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği, İşyeri Bina ve Eklentileri Yönetmeliği.";
};

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
  const employerName = safeText(generalInfo.employerRepresentativeName, "İşveren / İşveren Vekili");
  const reportDate = toDisplayDate(generalInfo.reportDate);
  const topic = safeText(generalInfo.areaRegion, effectiveLocation);
  const hazardClass = safeText(selectedCompany?.notes || selectedCompany?.industry, "Çok Tehlikeli");

  const companyLogoSource = generalInfo.companyLogoUrl || selectedCompany?.logo_url || null;
  const [companyLogoBytes, stampBytes, providerLogoBytes, photoEvidence] = await Promise.all([
    companyLogoSource ? fetchImageBytes(companyLogoSource) : Promise.resolve(null),
    entries.some((entry) => entry.includeStamp) && profileContext?.stamp_url ? fetchImageBytes(profileContext.stamp_url) : Promise.resolve(null),
    generalInfo.providerLogoUrl || orgData?.logo_url
      ? fetchImageBytes(generalInfo.providerLogoUrl || orgData?.logo_url || "")
      : Promise.resolve(null),
    Promise.all(
      entries.flatMap((entry) =>
        entry.mediaUrls.map(async (url, index) => {
          const bytes = await fetchImageBytes(url);
          if (!bytes) return null;
          return {
            entryId: entry.id,
            bytes,
            type: inferDocxImageType(url),
            index,
          } as LoadedPhoto;
        }),
      ),
    ).then((items) => items.filter((item): item is LoadedPhoto => Boolean(item))),
  ]);

  const buildHeaderTable = () =>
    new Table({
      width: FULL_WIDTH,
      layout: TableLayoutType.FIXED,
      borders: {
        top: { color: "FFFFFF", style: "none", size: 0 },
        left: { color: "FFFFFF", style: "none", size: 0 },
        right: { color: "FFFFFF", style: "none", size: 0 },
        bottom: { color: "9AA4B2", style: "single", size: 4 },
        insideHorizontal: { color: "FFFFFF", style: "none", size: 0 },
        insideVertical: { color: "FFFFFF", style: "none", size: 0 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: "İSG TESPİT VE DÖF RAPORU", color: MUTED, size: 14 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: reportDate, color: MUTED, size: 14 })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

  const defaultHeader = new Header({
    children: [buildHeaderTable()],
  });

  const defaultFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: " ", size: 14, color: MUTED })],
      }),
    ],
  });

  const metaTable = new Table({
    width: { size: 72, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      ["Rapor Tarihi", reportDate],
      ["Hazırlayan", `${effectiveObserver} - ${effectiveObserverTitle}`],
      ["Konu", `${topic} Risk Analizi`],
      ["Tehlike Sınıfı", hazardClass.toLocaleUpperCase("tr-TR")],
    ].map(
      ([label, value], index) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_BLUE },
              margins: createCellMargins(80),
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label, color: "FFFFFF", bold: true, size: 17 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 76, type: WidthType.PERCENTAGE },
              shading: { fill: index === 3 ? SOFT_RED : "FFFFFF" },
              margins: createCellMargins(80),
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: value,
                      size: 17,
                      bold: index === 3,
                      color: index === 3 ? HEADER_RED : "000000",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const buildEntryTable = (entry: BulkCapaOfficialEntry) =>
    new Table({
      width: FULL_WIDTH,
      layout: TableLayoutType.FIXED,
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            ["TESPİT EDİLEN\nUYGUNSUZLUK", 25],
            ["RİSK ANALİZİ", 25],
            ["MEVZUAT\nDAYANAĞI", 20],
            ["ÖNERİLEN DÖF\n(AKSİYON)", 30],
          ].map(
            ([title, width]) =>
              new TableCell({
                width: { size: width as number, type: WidthType.PERCENTAGE },
                shading: { fill: HEADER_BLUE },
                margins: createCellMargins(70),
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: title as string, color: "FFFFFF", bold: true, size: 16 })],
                  }),
                ],
              }),
          ),
        }),
        new TableRow({
          children: [
            entry.description,
            entry.riskDefinition,
            getBulkCapaLegalBasis(entry),
            buildActionText(entry),
          ].map((text, index) =>
            new TableCell({
              margins: createCellMargins(90),
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text,
                      size: 17,
                      color: index === 3 && entry.importanceLevel === "Kritik" ? HEADER_RED : "000000",
                      bold: index === 3 && entry.importanceLevel === "Kritik",
                    }),
                  ],
                }),
              ],
            }),
          ),
        }),
      ],
    });

  const actionPlanTable = new Table({
    width: { size: 78, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          ["RİSK SEVİYESİ", 24],
          ["TERMİN", 16],
          ["YAPILACAK İŞLEMLER", 60],
        ].map(
          ([title, width]) =>
            new TableCell({
              width: { size: width as number, type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_BLUE },
              margins: createCellMargins(70),
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: title as string, color: "FFFFFF", bold: true, size: 16 })],
                }),
              ],
            }),
        ),
      }),
      ...entries.map((entry) => {
        const priority = getPriorityGroup(entry.importanceLevel);
        return new TableRow({
          children: [
            new TableCell({
              shading: { fill: priority.fill },
              margins: createCellMargins(70),
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: priority.label, color: priority.text, bold: true, size: 16 })],
                }),
              ],
            }),
            new TableCell({
              margins: createCellMargins(70),
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: entry.terminDate ? toDisplayDate(entry.terminDate) : priority.term, size: 16, bold: true })],
                }),
              ],
            }),
            new TableCell({
              margins: createCellMargins(70),
              children: [new Paragraph({ children: [new TextRun({ text: buildActionText(entry), size: 16 })] })],
            }),
          ],
        });
      }),
    ],
  });

  const reportChildren: any[] = [];

  reportChildren.push(
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "İŞ SAĞLIĞI VE GÜVENLİĞİ", bold: true, color: HEADER_BLUE, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "TESPİT VE DÜZELTİCİ / ÖNLEYİCİ FAALİYET (DÖF) RAPORU", bold: true, size: 22 })],
    }),
    new Paragraph({
      border: { bottom: { color: HEADER_RED, style: BorderStyle.SINGLE, size: 6 } },
      spacing: { after: 120 },
      children: [new TextRun("")],
    }),
    metaTable,
  );

  entries.forEach((entry, index) => {
    const relatedPhotos = photoEvidence.filter((photo) => photo.entryId === entry.id);
    const sectionTitle = `${index + 1}. ${safeText(entry.relatedDepartment, "GENEL SAHA").toLocaleUpperCase("tr-TR")}`;

    if (index > 0) {
      reportChildren.push(new Paragraph({ children: [new PageBreak()] }));
    } else {
      reportChildren.push(new Paragraph({ spacing: { after: 140 }, children: [new TextRun("")] }));
    }

    if (relatedPhotos.length > 0) {
      reportChildren.push(
        new Table({
          width: { size: 76, type: WidthType.PERCENTAGE },
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
              children: relatedPhotos.map((photo) =>
                new TableCell({
                  width: { size: Math.floor(100 / relatedPhotos.length), type: WidthType.PERCENTAGE },
                  borders: TABLE_BORDERS,
                  margins: createCellMargins(70),
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: photo.bytes,
                          type: photo.type,
                          transformation: { width: relatedPhotos.length === 1 ? 230 : 150, height: relatedPhotos.length === 1 ? 210 : 170 },
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 60 },
                      children: [new TextRun({ text: `Görsel ${photo.index + 1} — ${safeText(entry.relatedDepartment, "Genel Alan")}`, size: 14 })],
                    }),
                  ],
                }),
              ),
            }),
          ],
        }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun("")] }),
      );
    }

    reportChildren.push(
      new Paragraph({
        border: { bottom: { color: HEADER_BLUE, style: BorderStyle.SINGLE, size: 6 } },
        spacing: { after: 90 },
        children: [new TextRun({ text: sectionTitle, bold: true, color: HEADER_BLUE, size: 24 })],
      }),
      buildEntryTable(entry),
      new Paragraph({
        spacing: { before: 90 },
        children: [new TextRun({ text: `FOTOĞRAF KANITI — ${safeText(entry.relatedDepartment, "GENEL SAHA").toLocaleUpperCase("tr-TR")} UYGUNSUZLUKLARI`, bold: true, size: 16 })],
      }),
      new Paragraph({
        border: { bottom: { color: HEADER_BLUE, style: BorderStyle.SINGLE, size: 4 } },
        children: [new TextRun("")],
      }),
    );
  });

  reportChildren.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      border: { bottom: { color: HEADER_BLUE, style: BorderStyle.SINGLE, size: 6 } },
      spacing: { after: 100 },
      children: [new TextRun({ text: "TERMİN VE AKSİYON PLANI", bold: true, color: HEADER_BLUE, size: 24 })],
    }),
    actionPlanTable,
    new Paragraph({ spacing: { before: 180, after: 80 }, children: [new TextRun({ text: "HUKUKİ HATIRLATMA (Yönetici Özeti)", bold: true, color: HEADER_RED, size: 20 })] }),
    new Table({
      width: { size: 82, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { color: HEADER_RED, style: BorderStyle.SINGLE, size: 8 },
        bottom: { color: HEADER_RED, style: BorderStyle.SINGLE, size: 8 },
        left: { color: HEADER_RED, style: BorderStyle.SINGLE, size: 8 },
        right: { color: HEADER_RED, style: BorderStyle.SINGLE, size: 8 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: SOFT_RED },
              margins: createCellMargins(120),
              children: [
                new Paragraph({
                  spacing: { after: 80 },
                  children: [new TextRun({ text: "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu gereğince;", color: HEADER_RED, bold: true, size: 16 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 80 },
                  children: [new TextRun({ text: "İŞVEREN, ÇALIŞANLARIN BAĞLILIĞINI VE GÜVENLİĞİNİ SAĞLAMAKLA YÜKÜMLÜDÜR.", bold: true, size: 16 })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: overallAnalysis.trim() || "Bu raporda fotoğraf kanıtlarıyla sunulan uygunsuzlukların giderilmemesi durumunda meydana gelebilecek iş kazalarında işveren, ilgili mevzuat kapsamında idari ve hukuki sorumlulukla karşılaşabilir.", size: 16 })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 180, after: 120 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Onayınıza arz ederim.", size: 16 })] }),
    new Table({
      width: { size: 82, type: WidthType.PERCENTAGE },
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
                  border: { top: { color: "000000", style: BorderStyle.SINGLE, size: 6 } },
                  spacing: { before: 120, after: 40 },
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Hazırlayan", bold: true, size: 16 })],
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: effectiveObserver, size: 15 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: effectiveObserverTitle, color: MUTED, size: 14 })] }),
                ...(stampBytes
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80 },
                        children: [
                          new ImageRun({
                            data: stampBytes,
                            type: inferDocxImageType(profileContext?.stamp_url),
                            transformation: { width: 90, height: 90 },
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
                  border: { top: { color: "000000", style: BorderStyle.SINGLE, size: 6 } },
                  spacing: { before: 120, after: 40 },
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Onaylayan", bold: true, size: 16 })],
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: employerName, size: 15 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: safeText(generalInfo.employerRepresentativeTitle, "İşveren / İşveren Vekili"), color: MUTED, size: 14 })] }),
                ...(providerLogoBytes
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80 },
                        children: [
                          new ImageRun({
                            data: providerLogoBytes,
                            type: inferDocxImageType(generalInfo.providerLogoUrl || orgData?.logo_url),
                            transformation: { width: 80, height: 80 },
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
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 900, bottom: 720, left: 900 },
          },
        },
        headers: { default: defaultHeader },
        footers: { default: defaultFooter },
        children: reportChildren,
      },
    ],
  });

  return Packer.toBlob(doc);
}
