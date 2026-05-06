import { saveAs } from "file-saver";

export interface EmployeeRepresentativeAppointmentData {
  workplaceTitle: string;
  workplaceAddress: string;
  sgkRegistrationNo: string;
  representativeName: string;
  representativeTc: string;
  representativeTitle: string;
  representativeDepartment: string;
  appointmentDate: string;
  documentNumber: string;
  representativeType: string;
  appointmentReason: string;
  legalBasis: string;
  dutiesAndAuthorities: string;
  communicationMethod: string;
  trainingCommitment: string;
  employerName: string;
  employerTitle: string;
  employeeSignatureName: string;
  revisionNo?: string;
  preparedByName?: string;
  preparedByTitle?: string;
  approvedByName?: string;
  approvedByTitle?: string;
  trainerName?: string;
  trainerTitle?: string;
  additionalNotes: string;
}

const safeText = (value?: string | null, fallback = "-") => {
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

const trainingNotePages = [
  [
    "ÇALIŞAN TEMSİLCİSİ EĞİTİM NOTLARI",
    "6331 sayılı İş Sağlığı ve Güvenliği Kanunu",
    "Tanımlar - Madde 3: Çalışan temsilcisi; iş sağlığı ve güvenliği ile ilgili çalışmalara katılma, çalışmaları izleme, tedbir alınmasını isteme, teklifte bulunma ve benzeri konularda çalışanları temsil etmeye yetkili çalışandır.",
    "Çalışmaktan kaçınma hakkı - Madde 13: Ciddi ve yakın tehlike ile karşı karşıya kalan çalışanlar kurul veya işverene başvurarak durumun tespit edilmesini ve gerekli tedbirlerin alınmasına karar verilmesini talep edebilir.",
    "Çalışanların bilgilendirilmesi - Madde 16: Risk değerlendirmesi, koruyucu ve önleyici tedbirler, ölçüm, analiz, teknik kontrol, kayıtlar ve raporlara ilişkin bilgilere çalışan temsilcilerinin ulaşması sağlanır.",
    "Çalışanların eğitimi - Madde 17: Çalışan temsilcileri özel olarak eğitilir. Eğitimler işe başlamadan önce, iş değişikliğinde, ekipman değiştiğinde veya yeni teknoloji halinde yenilenir.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ EĞİTİM NOTLARI",
    "Çalışanların görüşlerinin alınması ve katılımlarının sağlanması - Madde 18: İşveren, çalışanların veya çalışan temsilcilerinin iş sağlığı ve güvenliği konularında görüşlerini alır ve katılımlarını sağlar.",
    "Çalışanların yükümlülükleri - Madde 19: Çalışanlar, aldıkları eğitim ve talimatlar doğrultusunda makine, cihaz, araç ve ekipmanı doğru kullanmak, tehlike gördüklerinde derhal bildirmek ve iş birliği yapmakla yükümlüdür.",
    "Çalışan temsilcisi - Madde 20: İşveren, işyerindeki riskler ve çalışan sayısını dikkate alarak çalışan temsilcisini görevlendirir. Birden fazla temsilci olması halinde baş temsilci seçimle belirlenir.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ EĞİTİM NOTLARI",
    "İş sağlığı ve güvenliği kurulu - Madde 22: Elli ve daha fazla çalışanın bulunduğu ve altı aydan fazla süren sürekli işlerin yapıldığı işyerlerinde kurul oluşturulur.",
    "İşin durdurulması - Madde 25: Hayati tehlike oluşturan husus tespit edildiğinde, tehlike giderilinceye kadar işin bir bölümünde veya tamamında iş durdurulabilir.",
    "Bağımlılık yapan maddeleri kullanma yasağı - Madde 28: İşyerine sarhoş veya uyuşturucu madde etkisi altında gelmek ve işyerinde bu maddeleri kullanmak yasaktır.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ EĞİTİM NOTLARI",
    "Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik",
    "İşverenin yükümlülükleri - Madde 5: Eğitim programlarının hazırlanması, uygulanması, uygun yer ve araçların temin edilmesi, çalışanların programa katılması ve eğitim belgelerinin düzenlenmesi işverenin sorumluluğundadır.",
    "İş sağlığı ve güvenliği eğitimi - Madde 6: Verilen eğitimler değişen riskler de dikkate alınarak belirli periyotlarla yenilenir. İş kazası sonrası işe dönüşte ilave eğitim verilir.",
    "Özel politika gerektiren grupların eğitimi - Madde 7: Destek elemanlarına ve çalışan temsilcilerine görevlendirilecekleri konularla ilgili özel eğitim verilir.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ EĞİTİM NOTLARI",
    "Eğitimin maliyeti ve eğitimde geçen süreler - Madde 8: İş sağlığı ve güvenliği eğitimlerinin maliyeti çalışanlara yansıtılamaz, eğitimde geçen süre çalışma süresinden sayılır.",
    "Çalışanların yükümlülükleri - Madde 9: Çalışanlar eğitimlerde edindikleri bilgileri işlerinde uygular ve talimatlara uyar.",
    "Eğitim programlarının hazırlanması - Madde 10: İşveren yıllık eğitim programını hazırlar ve yeni riskler ortaya çıktığında ilave program yapar.",
    "Eğitim süreleri ve konuları - Madde 11: Az tehlikeli işyerlerinde en az sekiz saat, tehlikeli işyerlerinde on iki saat, çok tehlikeli işyerlerinde on altı saat eğitim düzenlenir.",
    "Eğitimin temel prensipleri - Madde 12: Eğitim ihtiyaca göre seçilir, teorik ve uygulamalı olabilir, ölçme ve değerlendirme ile desteklenir.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ EĞİTİM NOTLARI",
    "Eğitimi verebilecek kişi ve kuruluşlar - Madde 13: Eğitimler iş güvenliği uzmanı, işyeri hekimi, yetkilendirilmiş kurumlar, üniversiteler ve kamu kurumlarının eğitim birimleri tarafından verilebilir.",
    "Eğitim verilecek mekânın nitelikleri - Madde 14: Eğitimlerin uygun ve yeterli mekânda, yeterli aydınlatma ve uygun araç-gereç ile yapılması esastır.",
    "Eğitimlerin belgelendirilmesi - Madde 15: Düzenlenen eğitimler çalışanların özlük dosyasında saklanır; katılım belgesi ve eğitim tarihleri kayda alınır.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ EĞİTİM NOTLARI",
    "İş Sağlığı ve Güvenliği Kurulları Hakkında Yönetmelik",
    "Kurulun oluşumu - Madde 6: Kurul; işveren veya vekili, iş güvenliği uzmanı, işyeri hekimi, insan kaynakları veya idari işler temsilcisi, sivil savunma uzmanı, formen/usta ve çalışan temsilcisinden oluşur.",
    "Eğitim - Madde 7: Kurul üyelerine kurulun görev ve yetkileri, ulusal mevzuat ve standartlar, sık rastlanan iş kazaları, iletişim teknikleri, acil durum önlemleri ve risk değerlendirmesi hakkında eğitim verilir.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ EĞİTİM NOTLARI",
    "Görev ve yetkiler - Madde 8: Kurul veya temsilci; iş sağlığı ve güvenliği iç yönergesi taslağı hazırlamak, çalışanları yönlendirmek, iş kazaları ve ramak kala olaylarını incelemek, düzeltici faaliyet önermek ve takip etmekle görevlidir.",
    "Bu eğitim notları, çalışan temsilcisinin görevini bilinçli ve mevzuata uygun biçimde yürütmesi amacıyla hazırlanmıştır.",
  ],
];

const dutyInstructionPages = [
  [
    "ÇALIŞAN TEMSİLCİSİ GÖREV TALİMATI",
    "1. Amaç ve Kapsam",
    "Bu talimatın amacı, çalışan temsilcisinin görev, yetki ve sorumluluklarını tanımlamak; çalışanların iş sağlığı ve güvenliği süreçlerine katılımını etkin ve düzenli hale getirmektir.",
    "Talimat, çalışan temsilcisinin risklerin belirlenmesi, önleyici faaliyetlerin izlenmesi ve çalışan görüşlerinin iletilmesi süreçlerini kapsar.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ GÖREV TALİMATI",
    "2. Temel Görevler",
    "Çalışanlardan gelen İSG bildirimlerini toplar, kayıt altına alır ve ilgili kişilere iletir.",
    "Sahada gözlem yapar, uygunsuzlukları tespit eder ve düzeltici faaliyet önerileri sunar.",
    "Kurul toplantılarına katılır, çalışan görüşlerini gündeme taşır ve kararların çalışanlara duyurulmasına destek verir.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ GÖREV TALİMATI",
    "3. Yetkiler",
    "Risklerin azaltılması için tedbir alınmasını isteme, inceleme talep etme, çalışanların görüş ve şikayetlerini temsil etme, saha denetimlerine katılma ve bilgi talep etme hakkına sahiptir.",
    "Görevini yürütmesi nedeniyle hakları kısıtlanamaz; işveren gerekli çalışma ortamını ve zamanı sağlar.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ GÖREV TALİMATI",
    "4. Sorumluluklar",
    "İşyeri sırlarını ve kişisel verileri gizli tutar.",
    "Bildirimleri tarafsız biçimde ele alır, kayıtların doğruluğunu korur.",
    "Çalışanlara geri bildirim verir ve alınan aksiyonların sahaya yansımasını takip eder.",
  ],
  [
    "ÇALIŞAN TEMSİLCİSİ GÖREV TALİMATI",
    "5. Uygulama Esasları",
    "Temsilci, görevini işveren, iş güvenliği uzmanı, işyeri hekimi ve kurul ile koordineli yürütür.",
    "Gerekli hallerde saha ziyaretleri, toplantılar ve bilgilendirme oturumları düzenler.",
    "Bu talimat, temsilcinin görevi süresince yürürlükte kalır ve ihtiyaç halinde güncellenir.",
  ],
];

const testQuestionPairs = [
  ["1- Çalışan temsilcisi görevleri içinde hangisi yer almaz?", "A) Çalışanları temsil etmek  B) Riskleri izlemek  C) Ücret bordrosu hazırlamak  D) Tedbir önermek"],
  ["2- Tehlikeli durum tespit edildiğinde çalışan temsilcisi ne yapmalıdır?", "A) Bildirmeden bekler  B) Gerekli kişilere bildirir  C) Alanı terk eder  D) Yalnızca not alır"],
  ["3- Acil durumda çalışan temsilcisi aşağıdakilerden hangisini destekler?", "A) Tahliye  B) Satış  C) Bordro  D) Sevkiyat"],
  ["4- Eğitim hangi amaçla verilir?", "A) Mevzuat bilgisi  B) Güvenli davranış  C) Risk farkındalığı  D) Hepsi"],
  ["5- Aşağıdakilerden hangisi çalışan temsilcisi yetkisidir?", "A) Tehlikeyi bildirme  B) Tedbir önermek  C) Görüş iletmek  D) Hepsi"],
  ["6- Çalışan temsilcisi bilgileri kimlerle paylaşmalıdır?", "A) İlgili yetkililerle  B) Herkesle  C) Sadece arkadaşlarıyla  D) Kimseyle"],
  ["7- Kurul kararı neyi destekler?", "A) Sistematik takip  B) Rastgele işlem  C) Kayıtsız çalışma  D) Yetkisiz uygulama"],
  ["8- Uygunsuzluk görüldüğünde ilk adım nedir?", "A) Görmezden gelmek  B) Bildirim yapmak  C) Beklemek  D) Alanı kapatmak"],
];

export async function generateEmployeeRepresentativeAppointmentWord(data: EmployeeRepresentativeAppointmentData) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Packer,
    PageNumber,
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

  const textCell = (
    text: string,
    width: number,
    options?: { bold?: boolean; colSpan?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; minLines?: number; size?: number },
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      columnSpan: options?.colSpan,
      margins: { top: 80, bottom: 80, left: 90, right: 90 },
      children: [
        new Paragraph({
          alignment: options?.align,
          children: [new TextRun({ text, bold: options?.bold, size: options?.size ?? 20 })],
        }),
        ...Array.from({ length: options?.minLines ?? 0 }).map(() => new Paragraph({ children: [new TextRun({ text: " ", size: 20 })] })),
      ],
    });

  const buildHeaderBlock = (title: string) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: fullBorder,
      rows: [
        new TableRow({
          children: [
            textCell(title, 74, {
              bold: true,
              align: AlignmentType.CENTER,
              size: 24,
            }),
            textCell("", 26, { minLines: 1 }),
          ],
        }),
      ],
    });

  const buildContentPage = (title: string, paragraphs: string[], withBreak = true) => [
    ...(withBreak ? [new Paragraph({ pageBreakBefore: true })] : []),
    buildHeaderBlock(title),
    new Paragraph({ spacing: { after: 160 } }),
    ...paragraphs.map((paragraph, index) =>
      new Paragraph({
        spacing: { after: index === 0 ? 160 : 100 },
        alignment: index > 1 ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
        children: [new TextRun({ text: paragraph, bold: index <= 1, size: index === 0 ? 22 : 20 })],
      }),
    ),
  ];

  const legalBasis =
    safeText(data.legalBasis, "") !== "-"
      ? safeText(data.legalBasis)
      : "30.06.2012 tarih ve 6331 sayılı İş Sağlığı ve Güvenliği Kanunu ile İş Sağlığı ve Güvenliği ile İlgili Çalışan Temsilcisinin Nitelikleri ve Seçilme Usul ve Esaslarına İlişkin Tebliğ hükümleri.";

  const duties =
    safeText(data.dutiesAndAuthorities, "") !== "-"
      ? safeText(data.dutiesAndAuthorities)
      : "Çalışan temsilcisi; iş sağlığı ve güvenliği ile ilgili çalışmalara katılma, çalışmaları izleme, tehlike kaynağının yok edilmesi veya tehlikeden kaynaklanan riskin azaltılması için tedbir alınmasını isteme, teklifte bulunma ve benzeri konularda çalışanları temsil etmeye yetkilidir.";

  const communication =
    safeText(data.communicationMethod, "") !== "-"
      ? safeText(data.communicationMethod)
      : "Çalışanlardan gelen İSG bildirimleri düzenli olarak kayıt altına alınır, işveren, iş güvenliği uzmanı ve ilgili kurul yapılarına iletilir.";

  const training =
    safeText(data.trainingCommitment, "") !== "-"
      ? safeText(data.trainingCommitment)
      : "Çalışan temsilcisine görevini yerine getirebilmesi için gerekli iş sağlığı ve güvenliği eğitimleri ve mevzuat bilgilendirmeleri verilecektir.";

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          textCell("İŞ SAĞLIĞI ve GÜVENLİĞİ\nÇALIŞAN TEMSİLCİSİ ATAMASI", 72, {
            bold: true,
            align: AlignmentType.CENTER,
            size: 26,
          }),
          textCell("", 28, { minLines: 2 }),
        ],
      }),
      new TableRow({
        children: [
          textCell("İşyeri Ünvanı", 20, { bold: true }),
          textCell(safeText(data.workplaceTitle), 50),
          textCell("Hazırlama/\nGüncelleme Tarihi", 16, { bold: true, align: AlignmentType.CENTER }),
          textCell(formatDate(data.appointmentDate), 14, { align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          textCell("İşyeri Sicil No", 20, { bold: true }),
          textCell(safeText(data.sgkRegistrationNo), 50),
          textCell("", 16),
          textCell("", 14),
        ],
      }),
    ],
  });

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          textCell("ADI SOYADI", 26, { bold: true, align: AlignmentType.CENTER }),
          textCell("TC", 22, { bold: true, align: AlignmentType.CENTER }),
          textCell("GÖREVİ", 28, { bold: true, align: AlignmentType.CENTER }),
          textCell("İMZA", 24, { bold: true, align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          textCell(safeText(data.representativeName), 26, { minLines: 3 }),
          textCell(safeText(data.representativeTc), 22, { minLines: 3 }),
          textCell(safeText(data.representativeType, "Çalışan Baş Temsilcisi"), 28, { minLines: 3 }),
          textCell("", 24, { minLines: 3 }),
        ],
      }),
      new TableRow({
        children: [
          textCell("", 26, { minLines: 3 }),
          textCell("", 22, { minLines: 3 }),
          textCell("", 28, { minLines: 3 }),
          textCell("", 24, { minLines: 3 }),
        ],
      }),
    ],
  });

  const revisionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          textCell(`REVİZYON NO   : ${safeText(data.revisionNo, data.documentNumber)}\nREVİZYON TARİHİ : ${formatDate(data.appointmentDate)}\nSAYFA NO :`, 28, { bold: true, minLines: 2 }),
          textCell(`HAZIRLAYAN\n${safeText(data.preparedByName, data.employerName || "İş Güvenliği Uzmanı")}\n${safeText(data.preparedByTitle, data.employerTitle || "İş Güvenliği Uzmanı")}`, 36, {
            bold: true,
            align: AlignmentType.CENTER,
            minLines: 2,
          }),
          textCell(`ONAYLAYAN\n${safeText(data.approvedByName, data.employeeSignatureName || "İşveren / İ.Vekili")}\n${safeText(data.approvedByTitle, data.representativeTitle || "İşveren / İ.Vekili")}`, 36, {
            bold: true,
            align: AlignmentType.CENTER,
            minLines: 2,
          }),
        ],
      }),
    ],
  });

  const attendanceTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          textCell("İşyeri Ünvanı", 24, { bold: true }),
          textCell(safeText(data.workplaceTitle), 46),
          textCell("Eğitim Tarihi", 15, { bold: true }),
          textCell(formatDate(data.appointmentDate), 15),
        ],
      }),
      new TableRow({
        children: [
          textCell("İşyeri Sicil No", 24, { bold: true }),
          textCell(safeText(data.sgkRegistrationNo), 46),
          textCell("", 15),
          textCell("", 15),
        ],
      }),
      new TableRow({
        children: [textCell("ÇALIŞAN TEMSİLCİSİ EĞİTİME KATILIM", 100, { bold: true, colSpan: 4, align: AlignmentType.CENTER })],
      }),
      new TableRow({
        children: [
          textCell(
            "İş sağlığı ve güvenliği ile ilgili çalışan temsilcisi eğitimine katıldım. Eğitim kapsamında mevzuat, hak ve yükümlülükler, görev ve yetkiler, çalışan katılımı ve kurul süreçleri hakkında bilgilendirildim.",
            100,
            { colSpan: 4, minLines: 6 },
          ),
        ],
      }),
      new TableRow({
        children: [
          textCell("ADI SOYADI", 26, { bold: true, align: AlignmentType.CENTER }),
          textCell("TC", 22, { bold: true, align: AlignmentType.CENTER }),
          textCell("İMZA", 24, { bold: true, align: AlignmentType.CENTER }),
          textCell("İSG Uzmanı / Eğitici İmzası", 28, { bold: true, align: AlignmentType.CENTER }),
        ],
      }),
              new TableRow({
                children: [
                  textCell(safeText(data.representativeName), 26, { minLines: 3 }),
                  textCell(safeText(data.representativeTc), 22, { minLines: 3 }),
                  textCell("", 24, { minLines: 3 }),
                  textCell(
                    `${safeText(data.trainerName, data.employerName)}${safeText(data.trainerTitle, "") !== "-" ? `\n${safeText(data.trainerTitle)}` : ""}`,
                    28,
                    { minLines: 3 },
                  ),
                ],
              }),
            ],
  });

  const testIntroTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: fullBorder,
    rows: [
      new TableRow({
        children: [
          textCell("İşyeri Ünvanı", 24, { bold: true }),
          textCell(safeText(data.workplaceTitle), 46),
          textCell("Eğitim Tarihi", 15, { bold: true }),
          textCell(formatDate(data.appointmentDate), 15),
        ],
      }),
      new TableRow({
        children: [
          textCell("İşyeri Sicil No", 24, { bold: true }),
          textCell(safeText(data.sgkRegistrationNo), 46),
          textCell("Adı Soyadı", 15, { bold: true }),
          textCell(safeText(data.representativeName), 15),
        ],
      }),
      new TableRow({
        children: [textCell("ÇALIŞAN TEMSİLCİSİ EĞİTİMİ ÖLÇME DEĞERLENDİRME SORULARI", 100, { bold: true, colSpan: 4, align: AlignmentType.CENTER })],
      }),
    ],
  });

  const buildQuestionTable = (pairs: typeof testQuestionPairs) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: fullBorder,
      rows: pairs.map(([question, choices]) =>
        new TableRow({
          children: [
            textCell(`${question}\n${choices}`, 100, { colSpan: 4, minLines: 3 }),
          ],
        }),
      ),
    });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 360, right: 320, bottom: 360, left: 320 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Sayfa ", size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                ],
              }),
            ],
          }),
        },
        children: [
          headerTable,
          new Paragraph({ spacing: { after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: "Konu: İş Sağlığı ve Güvenliği çalışmalarında görev almak üzere Çalışan Temsilcisi atanması", size: 22, bold: true })],
            spacing: { after: 180 },
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: "30.06.2012 tarih ve 6331 sayılı İş Sağlığı ve Güvenliği Kanunu gereği iş sağlığı ve güvenliği ile ilgili konularda şirket çalışanlarını temsil etmek üzere aşağıda bilgileri yer alan çalışan ilgili göreve atanmıştır.",
                size: 22,
              }),
            ],
            spacing: { after: 180 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Çalışan temsilcisinin yetki ve yükümlülüğü;", size: 22, bold: true })],
            spacing: { after: 140 },
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({ text: duties, size: 22 })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({ text: communication, size: 22 })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({ text: training, size: 22 })],
            spacing: { after: 180 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Çalışmalarınızda başarılar dilerim.", size: 22 })],
            spacing: { after: 220 },
            alignment: AlignmentType.CENTER,
          }),
          signatureTable,
          new Paragraph({ spacing: { after: 160 } }),
          revisionTable,
          ...trainingNotePages.flatMap((page) => buildContentPage(page[0], page.slice(1))),
          new Paragraph({ pageBreakBefore: true }),
          buildHeaderBlock("İŞ SAĞLIĞI ve GÜVENLİĞİ\nÇALIŞAN TEMSİLCİSİ EĞİTİME KATILIM"),
          new Paragraph({ spacing: { after: 160 } }),
          attendanceTable,
          new Paragraph({ pageBreakBefore: true }),
          buildHeaderBlock("İŞ SAĞLIĞI ve GÜVENLİĞİ\nÇALIŞAN TEMSİLCİSİ ÖLÇME DEĞERLENDİRME TESTİ"),
          new Paragraph({ spacing: { after: 160 } }),
          testIntroTable,
          new Paragraph({ spacing: { after: 120 } }),
          buildQuestionTable(testQuestionPairs.slice(0, 4)),
          new Paragraph({ pageBreakBefore: true }),
          buildHeaderBlock("İŞ SAĞLIĞI ve GÜVENLİĞİ\nÇALIŞAN TEMSİLCİSİ ÖLÇME DEĞERLENDİRME TESTİ"),
          new Paragraph({ spacing: { after: 160 } }),
          buildQuestionTable(testQuestionPairs.slice(4)),
          new Paragraph({ spacing: { after: 120 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: fullBorder,
            rows: [
              new TableRow({
                children: [
                  textCell("ADI SOYADI", 34, { bold: true, align: AlignmentType.CENTER }),
                  textCell("TC", 26, { bold: true, align: AlignmentType.CENTER }),
                  textCell("TARİH", 20, { bold: true, align: AlignmentType.CENTER }),
                  textCell("İMZA", 20, { bold: true, align: AlignmentType.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  textCell(safeText(data.representativeName), 34, { minLines: 2 }),
                  textCell(safeText(data.representativeTc), 26, { minLines: 2 }),
                  textCell(formatDate(data.appointmentDate), 20, { minLines: 2 }),
                  textCell(safeText(data.trainerName, ""), 20, { minLines: 2 }),
                ],
              }),
            ],
          }),
          ...dutyInstructionPages.flatMap((page) => buildContentPage(page[0], page.slice(1))),
          new Paragraph({ pageBreakBefore: true }),
          buildHeaderBlock("İŞ SAĞLIĞI ve GÜVENLİĞİ\nÇALIŞAN TEMSİLCİSİ DOSYA EKLERİ"),
          new Paragraph({ spacing: { after: 160 } }),
          new Paragraph({
            children: [new TextRun({ text: `Dayanak / Mevzuat: ${legalBasis}`, size: 20 })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Atama Gerekçesi: ${safeText(data.appointmentReason)}`, size: 20 })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Ek Notlar: ${safeText(data.additionalNotes)}`, size: 20 })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Bu dosya; çalışan temsilcisi ataması, eğitime katılımı, eğitim notları, ölçme değerlendirme testi ve görev talimatı kayıtlarını tek bir resmi Word dosyasında birleştirir.", size: 20 })],
            spacing: { after: 120 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFileName(`Calisan-Temsilcisi-Dosyasi-${data.representativeName || "Belge"}`)}.docx`);
}
