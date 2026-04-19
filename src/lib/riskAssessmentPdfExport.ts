import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import type { RiskAssessment, RiskItem } from "@/types/risk-assessment";
import { getRiskClassLabel } from "@/types/risk-assessment";

type CompanyLike = {
  name?: string | null;
  logo_url?: string | null;
};

type BuildRiskAssessmentPdfArgs = {
  assessment: RiskAssessment;
  riskItems: RiskItem[];
  company?: CompanyLike | null;
  loadImageAsDataUrl: (url?: string | null) => Promise<string | null>;

  // Dosya yolu (public altından örn: "/assets/xxx.png")
  fineKinneyTableImageUrl?: string | null;
  processFlowImageUrl?: string | null;
};

const COLORS = {
  salmon: [232, 156, 141] as const,
  ink: [17, 24, 39] as const,
  slate: [71, 85, 105] as const,
  line: [203, 213, 225] as const,
  soft: [248, 250, 252] as const,
  rose: [220, 38, 38] as const, // <-- EKLE (fallback error text için)
} as const;

function setFont(doc: jsPDF, weight: "normal" | "bold" = "normal") {
  doc.setFont("Inter", weight);
}
function setText(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}
function setFill(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function setDraw(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}
function upperTr(value: string) {
  return value.toLocaleUpperCase("tr-TR");
}
function split(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(text, width) as string[];
}
function getImageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.includes("image/png") ? "PNG" : "JPEG";
}
function formatProcedurePageLabel(pageNumber: number) {
  return `- ${pageNumber} -`;
}

function drawWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  options?: { fontSize?: number; lineHeight?: number; weight?: "normal" | "bold"; color?: readonly [number, number, number] }
) {
  const fontSize = options?.fontSize ?? 10;
  const lineHeight = options?.lineHeight ?? 4.8;
  doc.setFontSize(fontSize);
  setFont(doc, options?.weight ?? "normal");
  setText(doc, options?.color ?? COLORS.ink);
  const lines = split(doc, text, width);
  doc.text(lines, x, y, { baseline: "top" });
  return lines.length * lineHeight;
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, width: number) {
  setFill(doc, COLORS.soft);
  setDraw(doc, COLORS.salmon);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, 10, 2.5, 2.5, "FD");
  doc.setFontSize(12);
  setFont(doc, "bold");
  setText(doc, COLORS.ink);
  doc.text(title, x + 4, y + 6.2);
}

function drawProcedurePageHeader(doc: jsPDF, pageLabel: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  setDraw(doc, [140, 140, 140]);
  doc.setLineWidth(0.25);
  doc.rect(14, 12, pageWidth - 28, 19);
  doc.line(34, 12, 34, 31);
  doc.line(pageWidth - 56, 12, pageWidth - 56, 31);
  doc.line(pageWidth - 38, 12, pageWidth - 38, 31);
  doc.line(pageWidth - 56, 15.8, pageWidth - 14, 15.8);
  doc.line(pageWidth - 56, 19.6, pageWidth - 14, 19.6);
  doc.line(pageWidth - 56, 23.4, pageWidth - 14, 23.4);
  doc.line(pageWidth - 56, 27.2, pageWidth - 14, 27.2);

  setText(doc, [0, 0, 0]);
  setFont(doc, "bold");
  doc.setFontSize(8);
  doc.text("TEHLİKE TANIMLAMA VE RİSK DEĞERLENDİRMESİ\nPROSEDÜRÜ", pageWidth / 2, 18.6, {
    align: "center",
    baseline: "middle",
  });

  setFont(doc, "normal");
  doc.setFontSize(6);
  doc.text("Doküman No", pageWidth - 54, 14.5);
  doc.text("İSG.PR.002", pageWidth - 36, 14.5);
  doc.text("Yayın Tarihi", pageWidth - 54, 18.3);
  doc.text("01.01.2026", pageWidth - 36, 18.3);
  doc.text("Revizyon Tarihi", pageWidth - 54, 22.1);
  doc.text("-", pageWidth - 36, 22.1);
  doc.text("Revizyon No", pageWidth - 54, 25.9);
  doc.text("-", pageWidth - 36, 25.9);
  doc.text("Sayfa No", pageWidth - 54, 29.7);
  doc.text(pageLabel, pageWidth - 36, 29.7);
}

/** Browser ortamında dataURL görselinin doğal boyutlarını okur. */
function getImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

function getContainedRect(containerW: number, containerH: number, contentW: number, contentH: number) {
  const scale = Math.min(containerW / contentW, containerH / contentH);
  return { w: contentW * scale, h: contentH * scale };
}

/**
 * Verilen dataUrl görselini belirtilen alana ORANI BOZMADAN (contain) sığdırır ve ortalar.
 * Taşma olmaz.
 */
async function drawImageContain(
  doc: jsPDF,
  dataUrl: string,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
  }
) {
  const { width: natW, height: natH } = await getImageNaturalSize(dataUrl);
  const { w, h } = getContainedRect(opts.w, opts.h, natW, natH);
  const x = opts.x + (opts.w - w) / 2;
  const y = opts.y + (opts.h - h) / 2;
  doc.addImage(dataUrl, getImageFormat(dataUrl), x, y, w, h, undefined, "FAST");
}

function drawCoverPage(doc: jsPDF, args: BuildRiskAssessmentPdfArgs, logoDataUrl: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const companyName = args.company?.name?.trim() || "FİRMA";
  const companyUpper = upperTr(companyName);
  const reportDate = format(new Date(args.assessment.assessment_date), "dd.MM.yyyy", { locale: tr });
  const validityDate = args.assessment.next_review_date
    ? format(new Date(args.assessment.next_review_date), "dd.MM.yyyy", { locale: tr })
    : format(
        new Date(new Date(args.assessment.assessment_date).setFullYear(new Date(args.assessment.assessment_date).getFullYear() + 2)),
        "dd.MM.yyyy",
        { locale: tr }
      );

  setFill(doc, [24, 36, 56]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  const innerX = 16;
  const innerY = 16;
  const innerW = pageWidth - 32;
  const innerH = pageHeight - 32;

  setFill(doc, [250, 247, 242]);
  setDraw(doc, [250, 247, 242]);
  doc.rect(innerX, innerY, innerW, innerH, "FD");

  setDraw(doc, [184, 129, 96]);
  doc.setLineWidth(0.9);
  doc.rect(innerX + 4, innerY + 4, innerW - 8, innerH - 8);

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), pageWidth / 2 - 16, innerY + 12, 32, 20, undefined, "FAST");
  }

  setText(doc, [12, 18, 30]);
  setFont(doc, "bold");
  doc.setFontSize(20);
  doc.text(companyUpper, pageWidth / 2, innerY + 42, { align: "center" });

  setFont(doc, "normal");
  doc.setFontSize(10);
  doc.text("GAZİANTEP", pageWidth / 2, innerY + 52, { align: "center" });

  setFont(doc, "bold");
  doc.setFontSize(12);
  doc.text("İŞ SAĞLIĞI VE GÜVENLİĞİ", pageWidth / 2, innerY + 70, { align: "center" });
  doc.text("TEHLİKE TANIMLAMA VE RİSK DEĞERLENDİRMESİ PROSEDÜRÜ", pageWidth / 2, innerY + 86, { align: "center" });

  setDraw(doc, [113, 120, 135]);
  doc.setLineWidth(0.2);
  doc.line(pageWidth / 2 - 60, innerY + 89, pageWidth / 2 + 60, innerY + 89);

  setFont(doc, "normal");
  doc.setFontSize(9);
  setText(doc, COLORS.slate);
  doc.text(`${upperTr(companyName)} • Fine-Kinney Risk Değerlendirme Tablosu`, pageWidth / 2, 13.4, { align: "center" });

  const tableX = pageWidth / 2 - 48;
  const tableY = innerY + 136;
  const leftW = 30;
  const labelW = 38;
  const valueW = 28;
  const rowH = 12;

  setDraw(doc, [140, 140, 140]);
  doc.setLineWidth(0.25);
  doc.rect(tableX, tableY, leftW + labelW + valueW, rowH * 3);
  doc.line(tableX + leftW, tableY, tableX + leftW, tableY + rowH * 3);
  doc.line(tableX + leftW + labelW, tableY, tableX + leftW + labelW, tableY + rowH * 3);
  doc.line(tableX + leftW, tableY + rowH, tableX + leftW + labelW + valueW, tableY + rowH);
  doc.line(tableX + leftW, tableY + rowH * 2, tableX + leftW + labelW + valueW, tableY + rowH * 2);

  setFont(doc, "bold");
  doc.setFontSize(8);
  setText(doc, [0, 0, 0]);
  doc.text("RİSK\nDEĞERLENDİRMESİNİN", tableX + leftW / 2, tableY + 13, { align: "center", baseline: "middle" });
  doc.text("YAPILDIĞI TARİH", tableX + leftW + labelW / 2, tableY + 7.8, { align: "center" });
  doc.text("GEÇERLİLİK TARİHİ", tableX + leftW + labelW / 2, tableY + rowH + 7.8, { align: "center" });
  doc.text("REVİZYON NO / TARİHİ", tableX + leftW + labelW / 2, tableY + rowH * 2 + 7.8, { align: "center" });

  setFont(doc, "normal");
  doc.text(reportDate, tableX + leftW + labelW + valueW / 2, tableY + 7.8, { align: "center" });
  doc.text(validityDate, tableX + leftW + labelW + valueW / 2, tableY + rowH + 7.8, { align: "center" });
  doc.text(`Rev.${args.assessment.version ?? 0} / ${reportDate}`, tableX + leftW + labelW + valueW / 2, tableY + rowH * 2 + 7.8, {
    align: "center",
  });
}

function buildIntroSections(companyName: string, assessment: RiskAssessment) {
  const companyUpper = upperTr(companyName);
  const assessor = assessment.occupational_safety_specialist_name || assessment.assessor_name || "İş Güvenliği Uzmanı";
  const doctor = assessment.workplace_doctor_name || "İşyeri Hekimi";
  const employer = assessment.employer_name || assessment.employer_representative_name || "İşveren / İşveren Vekili";
  const employeeRep = assessment.employee_representative_name || "Çalışan Temsilcisi";
  const support = assessment.support_personnel_name || "Destek Elemanı";

  return [
    {
      title: "1. AMAÇ",
      paragraphs: [
        `${companyUpper}'de var olan çalışma koşullarından kaynaklanan her türlü tehlike ve riskin tespiti, mevcut iş sağlığı ve güvenliği yasa ve yönetmeliklerine uygunluğunun değerlendirilmesi ve bu risklerin insan sağlığını etkilemeyen seviyeye düşürülmesi amaçlanmaktadır.`,
        `Tehlike tanımlama ve risk değerlendirmesi sonucunda ortaya çıkan risk değerlerinin iyileştirilmesi, önerilerde bulunulması, İSG yönetim sisteminin disiplin altına alınması ve yönetim metodunun belirlenmesi hedeflenmektedir.`,
      ],
    },
    {
      title: "2. KAPSAM",
      paragraphs: [
        `Bu rapor ${companyUpper}'de yapılan gözlemlere göre hazırlanmıştır. Çalışma; işyerinde kullanılan tüm makine, tesisat, bina, eklenti ve sosyal tesisleri, çalışan firma sorumlularını, işçileri, ziyaretçileri ve tedarikçileri kapsar.`,
      ],
    },
    {
      title: "3. REFERANSLAR",
      paragraphs: ["OHSAS 18001, İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği, İş Sağlığı ve Güvenliği Kanunu."],
    },
    {
      title: "4. TANIMLAR",
      paragraphs: [
        "Tehlike: İşyerinde var olan ya da dışarıdan gelebilecek, çalışanı veya işyerini etkileyebilecek zarar veya hasar verme potansiyelidir.",
        "Önleme: İşyerinde yürütülen işlerin bütün safhalarında iş sağlığı ve güvenliği ile ilgili riskleri ortadan kaldırmak veya azaltmak için planlanan ve alınan tedbirlerin tümüdür.",
        "Ramak kala olay: İşyerinde meydana gelen; çalışan, işyeri ya da iş ekipmanını zarara uğratma potansiyeli olduğu halde zarara uğratmayan olaydır.",
        "Risk: Tehlikeden kaynaklanacak kayıp, yaralanma ya da başka zararlı sonuç meydana gelme ihtimalidir.",
        "Risk değerlendirmesi: İşyerinde var olan ya da dışarıdan gelebilecek tehlikelerin belirlenmesi, bu tehlikelerin riske dönüşmesine yol açan faktörler ile tehlikelerden kaynaklanan risklerin analiz edilerek derecelendirilmesi ve kontrol tedbirlerinin kararlaştırılması amacıyla yapılması gerekli çalışmalardır.",
      ],
    },
    {
      title: "5. SORUMLULUKLAR VE PERSONEL",
      paragraphs: [
        `İş kazalarına karşı gerekli önlemlerin alınmasından ${employer}, risk değerlendirmesi çalışmalarının yürütülmesinden risk değerlendirmesi ekibi sorumludur.`,
        `"İSG.PR.016 Tehlike Tanımlama ve Risk Değerlendirmesi Formu" ${companyUpper} tarafından görevlendirilen risk değerlendirme ekibi tarafından hazırlanacak; ${assessor}, ${companyUpper} çalışan tüm personele iş güvenliği eğitimi kapsamında bilgilendirme yapacak ve tehlike bildirim formlarını göz önüne alarak kontrolleri sürdürecektir.`,
      ],
    },
    {
      title: "5.1. İŞ SAĞLIĞI VE GÜVENLİĞİ KONUSUNDA İŞVERENİN GÖREVLERİ",
      paragraphs: [
        "İşveren, çalışanların işle ilgili sağlık ve güvenliğini sağlamakla yükümlüdür. Bu çerçevede mesleki risklerin önlenmesi, eğitim ve bilgi verilmesi dahil her türlü tedbirin alınması, organizasyonun yapılması, gerekli araç ve gereçlerin sağlanması ve sağlık-güvenlik tedbirlerinin değişen şartlara uygun hale getirilmesi için çalışmalar yürütür.",
        "İşyerinde alınan iş sağlığı ve güvenliği tedbirlerine uyulup uyulmadığını izler, denetler ve uygunsuzlukların giderilmesini sağlar; risk değerlendirmesi yapar veya yaptırır; görev verirken çalışanın sağlık ve güvenlik yönünden işe uygunluğunu dikkate alır; hayati tehlike bulunan alanlara yetkisiz girişleri engeller.",
        "İşyeri dışındaki uzman kişi ve kuruluşlardan hizmet alınması işverenin sorumluluklarını ortadan kaldırmaz; iş sağlığı ve güvenliği tedbirlerinin maliyeti çalışanlara yansıtılamaz.",
      ],
    },
    {
      title: "5.2. RİSK DEĞERLENDİRME EKİBİ'NİN GÖREVLERİ",
      paragraphs: [
        "İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği'ne göre yapılacak çalışmalar için ekip oluşturulmalıdır, risk değerlendirmesi ekibinde söz konusu yönetmeliğin 6. Maddesine göre bulunması gereken kişiler aşağıdaki gibi tanımlanmıştır.",
        "\"İSG.FR.017.RİSK DEĞERLENDİRME EKİBİ\"'nde görevlendirilen kişiler formu ile kayıt altına alınacak ve \"İSG.EGT.002 RİSK DEĞERLENDİRME EKİBİ EĞİTİMİ\" ve \"İSG.FR.009.RİSK DEĞERLENDİRME EKİBİ EĞİTİM KATILIM FORMU\" ile eğitimi tamamlanacaktır.",
        "- İşveren veya işveren vekili.",
        "- İşyerinde sağlık ve güvenlik hizmetini yürüten iş güvenliği uzmanları ile işyeri hekimleri.",
        "- İşyerindeki çalışan temsilcileri.",
        "- İşyerindeki destek elemanları.",
        "- İşyerindeki bütün birimleri temsil edecek şekilde belirlenen ve işyerinde yürütülen çalışmalar, mevcut veya muhtemel tehlike kaynakları ile riskler konusunda bilgi sahibi çalışanlar.",
      ],
    },
    {
      title: "6. RİSK DEĞERLENDİRME SÜRECİ",
      paragraphs: [
        `Risk değerlendirmesi için "İSG.FR.016 Tehlike Tanımlama ve Risk Değerlendirme Formu" kullanılır. Tüm işyerleri için tasarım veya kuruluş aşamasından başlamak üzere tehlikeleri tanımlama, riskleri belirleme ve analiz etme, risk kontrol tedbirlerinin kararlaştırılması, dokümantasyon, yapılan çalışmaların güncellenmesi ve gerektiğinde yenilenmesi aşamaları izlenir.`,
      ],
    },
    {
      title: "6.1. RİSK DEĞERLENDİRMESİ",
      paragraphs: [
        "Çalışanların risk değerlendirmesi çalışması yapılırken ihtiyaç duyulan her aşamada sürece katılarak görüşlerinin alınması sağlanır. Bu süreçte ramak kala ve tehlike bildirim formları kullanılarak çalışan görüşleri kayıt altına alınır.",
      ],
    },
    {
    title: "6.2. TEHLİKELERİN TANIMLANMASI",
    paragraphs: [
      "Tehlikeler tanımlanırken çalışma ortamı, çalışanlar ve işyerine ilişkin ilgisine göre asgari olarak aşağıda belirtilen bilgiler toplanır.",
      "a) İşyeri bina ve eklentileri.",
      "b) İşyerinde yürütülen faaliyetler ile iş ve işlemler.",
      "c) Üretim süreç ve teknikleri.",
      "ç) İş ekipmanları.",
      "d) Kullanılan maddeler.",
      "e) Artık ve atıklarla ilgili işlemler.",
      "f) Organizasyon ve hiyerarşik yapı, görev, yetki ve sorumluluklar.",
      "g) Çalışanların tecrübe ve düşünceleri.",
      "ğ) İşe başlamadan önce ilgili mevzuat gereği alınacak çalışma izin belgeleri.",
      "h) Çalışanların eğitim, yaş, cinsiyet ve benzeri özellikleri ile sağlık gözetimi kayıtları.",
      "ı) Genç, yaşlı, engelli, gebe veya emziren çalışanlar gibi özel politika gerektiren gruplar ile kadın çalışanların durumu.",
      "i) İşyerinin teftiş sonuçları.",
      "j) Meslek hastalığı kayıtları.",
      "k) İş kazası kayıtları.",
      "l) İşyerinde meydana gelen ancak yaralanma veya ölüme neden olmadığı halde işyeri ya da iş ekipmanının zarara uğramasına yol açan olaylara ilişkin kayıtlar.",
      "m) Ramak kala olay kayıtları.",
      "n) Malzeme güvenlik bilgi formları.",
      "o) Ortam ve kişisel maruziyet düzeyi ölçüm sonuçları.",
      "ö) Varsa daha önce yapılmış risk değerlendirmesi çalışmaları.",
      "p) Acil durum planları.",
      "r) Sağlık ve güvenlik planı ve patlamadan korunma dokümanı gibi belirli işyerlerinde hazırlanması gereken dokümanlar.",

      "Tehlikelere ilişkin bilgiler toplanırken aynı üretim, yöntem ve teknikleri ile üretim yapan benzer işyerlerinde meydana gelen iş kazaları ve ortaya çıkan meslek hastalıkları da değerlendirilebilir. Toplanan bilgiler ışığında; iş sağlığı ve güvenliği ile ilgili mevzuatta yer alan hükümler de dikkate alınarak, çalışma ortamında bulunan fiziksel, kimyasal, biyolojik, psikososyal, ergonomik ve benzeri tehlike kaynaklarından oluşan veya bunların etkileşimi sonucu ortaya çıkabilecek tehlikeler belirlenir ve kayda alınır. Bu belirleme yapılırken aşağıdaki hususlar, bu hususlardan etkilenecekler ve ne şekilde etkilenebilecekleri göz önünde bulundurulur.",
      "a) İşletmenin yeri nedeniyle ortaya çıkabilecek tehlikeler.",
      "b) Seçilen alanda, işyeri bina ve eklentilerinin plana uygun yerleştirilmemesi veya planda olmayan ilavelerin yapılmasından kaynaklanabilecek tehlikeler.",
      "c) İşyeri bina ve eklentilerinin yapı ve yapım tarzı ile seçilen yapı malzemelerinden kaynaklanabilecek tehlikeler.",
      "ç) Bakım ve onarım işleri de dahil işyerinde yürütülecek her türlü faaliyet esnasında çalışma usulleri, vardiya düzeni, ekip çalışması, organizasyon, nezaret sistemi, hiyerarşik düzen, ziyaretçi veya işyeri çalışanı olmayan diğer kişiler gibi faktörlerden kaynaklanabilecek tehlikeler.",
      "d) İşin yürütümü, üretim teknikleri, kullanılan maddeler, makine ve ekipman, araç ve gereçler ile bunların çalışanların fiziksel özelliklerine uygun tasarlanmaması veya kullanılmamasından kaynaklanabilecek tehlikeler.",
      "e) Kuvvetli akım, aydınlatma, paratoner, topraklama gibi elektrik tesisatının bileşenleri ile ısıtma, havalandırma, atmosferik ve çevresel şartlardan korunma, drenaj, arıtma, yangın önleme ve mücadele ekipmanı ile benzeri yardımcı tesisat ve donanımlardan kaynaklanabilecek tehlikeler.",
      "f) İşyerinde yanma, parlama veya patlama ihtimali olan maddelerin işlenmesi, kullanılması, taşınması, depolanması ya da imha edilmesinden kaynaklanabilecek tehlikeler.",
      "g) Çalışma ortamına ilişkin hijyen koşulları ile çalışanların kişisel hijyen alışkanlıklarından kaynaklanabilecek tehlikeler.",
      "ğ) Çalışanın, işyeri içerisindeki ulaşım yollarının kullanımından kaynaklanabilecek tehlikeler.",
      "h) Çalışanların iş sağlığı ve güvenliği ile ilgili yeterli eğitim almaması, bilgilendirilmemesi, çalışanlara uygun talimat verilmemesi veya çalışma izni prosedürü gereken durumlarda bu izin olmaksızın çalışılmasından kaynaklanabilecek tehlikeler.",
    ],
  },
  {
    title: "6.3. RİSK DEĞERLENDİRMESİ KONTROL ADIMLARI",
    paragraphs: [
      "Risk Değerlendirmesi hazırlanırken izlenecek kontrol adımları aşağıdaki maddelerin yapılması ile sürdürülür.",
      "a) Planlama: Analiz edilerek etkilerinin büyüklüğüne ve önemine göre sıralı hale getirilen risklerin kontrolü amacıyla bir planlama yapılır.",
      "b) Risk kontrol tedbirlerinin kararlaştırılması: Riskin tamamen bertaraf edilmesi, bu mümkün değil ise riskin kabul edilebilir seviyeye indirilmesi için aşağıdaki adımlar uygulanır.",
      "1) Tehlike veya tehlike kaynaklarının ortadan kaldırılması.",
      "2) Tehlikelinin, tehlikeli olmayanla veya daha az tehlikeli olanla değiştirilmesi.",
      "3) Riskler ile kaynağında mücadele edilmesi.",
      "c) Risk kontrol tedbirlerinin uygulanması: Kararlaştırılan tedbirlerin iş ve işlem basamakları, işlemi yapacak kişi ya da işyeri bölümü, sorumlu kişi ya da işyeri bölümü, başlama ve bitiş tarihi ile benzeri bilgileri içeren planlar hazırlanır. Bu planlar işverence uygulamaya konulur.",
      "ç) Uygulamaların izlenmesi: Hazırlanan planların uygulama adımları düzenli olarak izlenir, denetlenir ve aksayan yönler tespit edilerek gerekli düzeltici ve önleyici işlemler tamamlanır.",
      "Risk kontrol adımları uygulanırken toplu korunma önlemlerine, kişisel korunma önlemlerine göre öncelik verilmesi ve uygulanacak önlemlerin yeni risklere neden olmaması sağlanır.",
    ],
  },
    {
    title: "6.4. RİSK DEĞERLENDİRMESİ AKSİYON PLANI",
    paragraphs: [
      `${companyUpper} risk değerlendirmesi ekibi tarafından risk değerlendirmesi sonrasında "İSG.FR.019.RİSK DEĞERLENDİRMESİ AKSİYON PLANI" oluşturulur ve aşağıdakilerin maddeler yapılır.`,
      "a) Belirlenen aksiyonların öncelik derecesine göre aksiyonun kapatılması için planlanan tarih \"hedef tarih\" kolonuna yazılır.",
      "b) Aksiyonları yerine getirecek sorumlular belirlenerek \"sorumlu\" kolonuna isimleri yazılır.",
      "c) Aksiyon planını takip edecek ve planın \"Durum\" ve \"Kapatma Tarihi\" kolonlarını dolduracak kişi veya kişiler belirlenir.",
      "d) \"Durum\" kolonuna aşağıdaki girişler yapılarak aksiyon planı ve performans takip edilir:",
      "- Tamamlanan",
      "- Hedef Tarihi Geçen",
      "- Zaman Var",
      "- Hedef Tarih Verilmemiş",
      "e) Aksiyonlar kapatıldığında risk değerlendirmesinde bulunan \"Kapatma Tarihi\" kolonu doldurulur.",
      "f) Aksiyonların belirlenen hedef tarihler içinde kapatılması sağlanır.",
      "g) Oluşturulan \"Risk Değerlendirmesi Aksiyon Planı\" aksiyonları kapatacak kişiler ile paylaşılır.",
      "h) Risk Değerlendirme çalışmasının yönetmelik haricinde belirtilen haller dışında yılda bir defa ve uzman değişikliği sonucunda ilk olarak aksiyon planı oluşturularak yıl sonunda risk analizinin revize edilmesi sağlanır.",
      `i) Risk değerlendirmesi bu konuda eğitim almış ${companyUpper} tarafından görevlendirilmiş personeller tarafından güncellenebilir.`,
    ],
  },
    {
    title: "6.5. FINE – KINNEY METODU",
    paragraphs: [
      "Kaza kontrolü için matematiksel değerlendirme anlamına gelir. Bu yöntem G.F. Kinney and A.D Wiruth tarafından 1976 yılında geliştirilmiştir. Çalışma ortamındaki tehlikelerin kazaya sebebiyet vermeden tespit edilmesini ve risk skoruna göre en öncelikli olandan başlayıp iyileştirilmesini sağlayan bir metottur.",
      `Bu çalışmada; ${companyUpper}'e ait gerçekleştirilen Kinney Risk Analizi yönetiminin konusu ele alınmıştır. Uygulamayla işletmede iş kazası ve meslek hastalığı oluşturabilecek riskler değerlendirilip, bunların engellenmesine yönelik iyileştirme önerilerinde bulunulmuştur.`,
      "Analiz edilerek belirlenmiş tehlikeler, aşağıda açıklaması yapılan FINE KINNEY risk yöntemine göre değerlendirilir.",
      "RİSK = OLASILIK X FREKANS X ŞİDDET formülü kullanılarak hesaplanır.",
      "Olasılık: Olasılık değerlendirilirken, faaliyet esnasındaki tehlikelerden kaynaklanan zararın gerçekleşme olasılığı sorgulanır ve puanlandırılır.",
      "Frekans: Frekans değerlendirilirken, faaliyet esnasında tehlikeye maruz kalma sıklığı sorgulanır ve puanlandırılır.",
      "Şiddet: Şiddet değerlendirilirken, faaliyet esnasındaki tehlikelerden kaynaklanan zararın çalışan ve veya ekipman üzerinde yaratacağı tahmini etki sorgulanır ve puanlandırılır.",
      "Risk Skoru; Olayın Meydana Gelme İhtimali(O) x Tehlike Maruziyet Sıklığı(F) x Şiddet(Ş)",
      "Bu yöntem sıkça uygulanmakta olup, işverenlerinde algılayabileceği bir yöntemdir. Sadece olasılık ya da şiddete bağlı kalmayıp firma içinde zarara maruz kalma sıklığı parametre olarak da değerlendirilmesinden dolayı daha etkin sonuçlar alınmaktadır.",
    ],
  },
  ];
}

function addIntroPages(doc: jsPDF, args: BuildRiskAssessmentPdfArgs) {
  const companyName = args.company?.name?.trim() || "Firma";
  const sections = buildIntroSections(companyName, args.assessment);
  const pageWidth = () => doc.internal.pageSize.getWidth();
  const pageHeight = () => doc.internal.pageSize.getHeight();
  const marginX = 14;
  const bottomLimit = () => pageHeight() - 26; // 18 yerine 26: footer + yazı güvenliği
  drawProcedurePageHeader(doc, formatProcedurePageLabel(doc.getCurrentPageInfo().pageNumber));
  let y = 37;

const ensureSpace = (needed: number, minKeep = 0) => {
  // minKeep: bu paragraf başlamadan önce sayfada kalmasını istediğimiz minimum boşluk (mm)
  if (y + needed <= bottomLimit() && y + minKeep <= bottomLimit()) return;

  doc.addPage("a4", "portrait");
  drawProcedurePageHeader(doc, formatProcedurePageLabel(doc.getCurrentPageInfo().pageNumber));
  y = 37;
};

  sections.forEach((section) => {
    ensureSpace(18);
    drawSectionTitle(doc, section.title, marginX, y, pageWidth() - marginX * 2);
    y += 13;

    section.paragraphs.forEach((paragraph) => {
      const lineHeight = 4.7;
      const lines = split(doc, paragraph, pageWidth() - marginX * 2);
      const minKeep = 12; // ~ en az 2-3 satır sayfa sonunda kalmadan yeni sayfaya geç
      ensureSpace(lines.length * lineHeight + 4, minKeep);

      drawWrappedText(doc, paragraph, marginX, y, pageWidth() - marginX * 2, {
        fontSize: 9.3,
        lineHeight,
        color: COLORS.ink,
      });
      y += lines.length * lineHeight + 3;
    });

    y += 2;
  });
}

function addTeamPage(doc: jsPDF, args: BuildRiskAssessmentPdfArgs) {
  doc.addPage("a4", "portrait");
  drawProcedurePageHeader(doc, formatProcedurePageLabel(doc.getCurrentPageInfo().pageNumber));
  const pageWidth = doc.internal.pageSize.getWidth();
  const employer = args.assessment.employer_name || args.assessment.employer_representative_name || "";
  const assessor = args.assessment.occupational_safety_specialist_name || args.assessment.assessor_name || "";
  const doctor = args.assessment.workplace_doctor_name || "";
  const employeeRep = args.assessment.employee_representative_name || "";
  const support = args.assessment.support_personnel_name || "";

  setText(doc, COLORS.ink);
  setFont(doc, "bold");
  doc.setFontSize(12);
  doc.text("7. RİSK DEĞERLENDİRME EKİBİ", 14, 40);
  setFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(
    split(
      doc,
      "29.12.2012 tarihli ve 28512 sayılı Resmi Gazete'de yayımlanan İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği Madde 6'ya göre belirlenen Risk Değerlendirme Ekibi aşağıdaki gibidir.",
      pageWidth - 28
    ),
    14,
    46,
    { baseline: "top" }
  );

  const x = 14;
  const y = 66;
  const leftW = 36;
  const titleW = 76;
  const nameW = 50;
  const signW = 20;
  const rowH = 12;
  const rows = [
    ["İŞVEREN / İŞVEREN VEKİLİ", employer],
    ["İŞ GÜVENLİĞİ UZMANI", assessor],
    ["İŞ YERİ HEKİMİ", doctor],
    ["ÇALIŞAN TEMSİLCİSİ", employeeRep],
    ["DESTEK ELEMANI", support],
    ["BİLGİ SAHİBİ ÇALIŞAN", ""],
  ];

  doc.rect(x, y, leftW + titleW + nameW + signW, rowH * (rows.length + 1));
  doc.line(x + leftW, y, x + leftW, y + rowH * (rows.length + 1));
  doc.line(x + leftW + titleW, y, x + leftW + titleW, y + rowH * (rows.length + 1));
  doc.line(x + leftW + titleW + nameW, y, x + leftW + titleW + nameW, y + rowH * (rows.length + 1));
  rows.forEach((_, index) => {
    doc.line(x + leftW, y + rowH * (index + 1), x + leftW + titleW + nameW + signW, y + rowH * (index + 1));
  });

  setFont(doc, "bold");
  doc.text("Unvan", x + leftW + titleW / 2, y + 7.5, { align: "center" });
  doc.text("Ad - Soyad", x + leftW + titleW + nameW / 2, y + 7.5, { align: "center" });
  doc.text("İmza", x + leftW + titleW + nameW + signW / 2, y + 7.5, { align: "center" });
  doc.text("RİSK\nDEĞERLENDİRME\nEKİBİ", x + leftW / 2, y + rowH * 4.1, { align: "center", baseline: "middle" });

  setFont(doc, "normal");
  rows.forEach((row, index) => {
    const rowY = y + rowH * (index + 1) + 7.5;
    doc.text(row[0], x + leftW + 2, rowY);
    doc.text(":", x + leftW + titleW - 4, rowY);
    doc.text(row[1], x + leftW + titleW + 2, rowY);
  });
}

async function addFineKinneyReferencePage(doc: jsPDF, args: BuildRiskAssessmentPdfArgs) {
  doc.addPage("a4", "portrait");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  drawProcedurePageHeader(doc, formatProcedurePageLabel(doc.getCurrentPageInfo().pageNumber));
  drawSectionTitle(doc, "FINE-KINNEY REFERANS TABLOSU", 14, 36, pageWidth - 28);
  drawWrappedText(
    doc,
    "Aşağıdaki referans tablo, olasılık, frekans ve şiddet değerlerinin değerlendirilmesinde ortak bir karar dili oluşturmak amacıyla rapora eklenmiştir.",
    14,
    50,
    pageWidth - 28,
    { fontSize: 8.8, color: COLORS.slate }
  );

  const url = args.fineKinneyTableImageUrl ?? "/assets/fine-kinney-reference.png";
  const dataUrl = await args.loadImageAsDataUrl(url);

  if (!dataUrl) {
    setFont(doc, "bold");
    setText(doc, COLORS.rose);
    doc.setFontSize(10);
    doc.text("Fine-Kinney tablo görseli yüklenemedi.", 14, 70);
    return;
  }

  const marginX = 14;
  const topY = 58;
  const bottomY = pageHeight - 18;
  const maxW = pageWidth - marginX * 2;
  const maxH = bottomY - topY;

  await drawImageContain(doc, dataUrl, {
    x: marginX,
    y: topY,
    w: maxW,
    h: maxH,
  });
}

async function addProcessFlowPage(doc: jsPDF, args: BuildRiskAssessmentPdfArgs) {
  doc.addPage("a4", "portrait");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  drawProcedurePageHeader(doc, formatProcedurePageLabel(doc.getCurrentPageInfo().pageNumber));
  drawSectionTitle(doc, "RİSK DEĞERLENDİRME SÜREÇ AKIŞI", 14, 36, pageWidth - 28);

  drawWrappedText(
    doc,
    "Bu akış, faaliyetlerin sınıflandırılmasından kontrol tedbirlerinin izlenmesine kadar risk değerlendirme döngüsünü görsel olarak özetler.",
    14,
    50,
    pageWidth - 28,
    { fontSize: 8.8, color: COLORS.slate }
  );

  const url = args.processFlowImageUrl ?? "/assets/risk-process-flow.png";
  const dataUrl = await args.loadImageAsDataUrl(url);

  if (!dataUrl) {
    setFont(doc, "bold");
    setText(doc, COLORS.rose);
    doc.setFontSize(10);
    doc.text("Süreç akış görseli yüklenemedi.", 14, 70);
    return;
  }

  const marginX = 14;
  const topY = 58;
  const bottomY = pageHeight - 18;
  const maxW = pageWidth - marginX * 2;
  const maxH = bottomY - topY;

  await drawImageContain(doc, dataUrl, {
    x: marginX,
    y: topY,
    w: maxW,
    h: maxH,
  });
}

function addPhotoGalleryPage(doc: jsPDF, itemsWithPhotos: Array<{ item: RiskItem; image: string }>) {
  if (itemsWithPhotos.length === 0) return;
  doc.addPage("a4", "portrait");
  const pageWidth = doc.internal.pageSize.getWidth();
  drawProcedurePageHeader(doc, formatProcedurePageLabel(doc.getCurrentPageInfo().pageNumber));
  drawSectionTitle(doc, "ANALİZ EDİLEN FOTOĞRAFLAR", 14, 34, pageWidth - 28);
  drawWrappedText(
    doc,
    "Sahada tespit edilen risk maddelerine ait görseller aşağıda referans amacıyla sunulmuştur. Bu bölüm, bulguların savunulabilirliğini ve raporun saha kaynağını güçlendirir.",
    14,
    48,
    pageWidth - 28,
    { fontSize: 9.2, color: COLORS.slate }
  );

  const cardW = 56;
  const cardH = 70;
  const gapX = 7;
  const gapY = 8;
  const startX = 14;
  const startY = 60;

  itemsWithPhotos.slice(0, 6).forEach(({ item, image }, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    setFill(doc, [255, 255, 255]);
    setDraw(doc, COLORS.line);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, "FD");
    doc.addImage(image, getImageFormat(image), x + 3, y + 3, cardW - 6, 34, undefined, "FAST");
    setFont(doc, "bold");
    setText(doc, COLORS.ink);
    doc.setFontSize(8.2);
    doc.text(`Madde ${item.item_number || index + 1}`, x + 3, y + 42);
    drawWrappedText(doc, item.department || "Genel Alan", x + 3, y + 45, cardW - 6, {
      fontSize: 7.4,
      color: COLORS.slate,
      weight: "bold",
      lineHeight: 3.7,
    });
    drawWrappedText(doc, item.hazard || "Tehlike açıklaması yok", x + 3, y + 51, cardW - 6, {
      fontSize: 7.1,
      color: COLORS.ink,
      lineHeight: 3.6,
    });
  });
}

function addTablePages(doc: jsPDF, args: BuildRiskAssessmentPdfArgs, photoMap: Map<string, string>, logoDataUrl: string | null) {
  doc.addPage("a4", "landscape");
  const pageWidth = doc.internal.pageSize.getWidth();
  const companyName = args.company?.name || "Firma";

  setFill(doc, COLORS.ink);
  doc.rect(0, 0, pageWidth, 18, "F");
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), 10, 3.4, 13, 10, undefined, "FAST");
  }
  setText(doc, [255, 255, 255]);
  setFont(doc, "bold");
  doc.setFontSize(12.5);
  doc.text("RİSK ANALİZ TABLOSU", pageWidth / 2, 8.7, { align: "center" });
  setFont(doc, "normal");
  doc.setFontSize(7.5);
  doc.text(`${upperTr(companyName)} • Fine-Kinney Risk Değerlendirme Tablosu`, pageWidth / 2, 13.4, { align: "center" });

  const stats = {
    total: args.riskItems.length,
    critical: args.riskItems.filter((item) => item.risk_class_1 === "Yüksek" || item.risk_class_1 === "Çok Yüksek").length,
    residualSafe: args.riskItems.filter((item) => item.risk_class_2 === "Kabul Edilebilir" || item.risk_class_2 === "Olası").length,
  };

  setFill(doc, COLORS.soft);
  setDraw(doc, COLORS.line);
  doc.roundedRect(8, 22, pageWidth - 16, 12, 2.5, 2.5, "FD");
  setText(doc, COLORS.ink);
  setFont(doc, "bold");
  doc.setFontSize(8);
  doc.text(`Toplam Madde: ${stats.total}`, 12, 29);
  doc.text(`Kritik Madde: ${stats.critical}`, 58, 29);
  doc.text(`Kabul Edilebilir / Olası Kalıntı Risk: ${stats.residualSafe}`, 103, 29);
  doc.text(`Değerlendirme Tarihi: ${format(new Date(args.assessment.assessment_date), "dd.MM.yyyy", { locale: tr })}`, pageWidth - 12, 29, {
    align: "right",
  });

  const tableData = args.riskItems.map((item, idx) => [
    String(idx + 1).padStart(2, "0"),
    item.department || "—",
    photoMap.has(item.id) ? " " : "—",
    item.hazard || "—",
    item.risk || "—",
    item.affected_people || "—",
    String(item.probability_1),
    String(item.frequency_1),
    String(item.severity_1),
    String(item.score_1),
    getRiskClassLabel(item.risk_class_1),
    item.proposed_controls || item.existing_controls || "—",
    String(item.probability_2 ?? 0),
    String(item.frequency_2 ?? 0),
    String(item.severity_2 ?? 0),
    String(item.score_2 ?? 0),
    getRiskClassLabel(item.risk_class_2 || "Kabul Edilebilir"),
    item.responsible_person || "—",
    item.deadline ? format(new Date(item.deadline), "dd.MM.yy", { locale: tr }) : "—",
  ]);

  autoTable(doc, {
    startY: 42,
    margin: { left: 8, right: 8, bottom: 16 },
    head: [["No", "Bölüm", "Foto", "Tehlike", "Risk", "Etkilenen", "O", "F", "Ş", "Skor", "Sınıf", "Önlemler", "O", "F", "Ş", "Skor", "Sınıf", "Sorumlu", "Termin"]],
    body: tableData,
    theme: "grid",
    styles: {
      fontSize: 6,
      cellPadding: 1.4,
      font: "Inter",
      lineColor: [148, 163, 184],
      lineWidth: 0.1,
      textColor: [30, 41, 59],
      fillColor: [248, 250, 252],
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      font: "Inter",
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 27 },
      4: { cellWidth: 30 },
      5: { cellWidth: 18 },
      6: { cellWidth: 8, halign: "center" },
      7: { cellWidth: 8, halign: "center" },
      8: { cellWidth: 8, halign: "center" },
      9: { cellWidth: 10, halign: "center" },
      10: { cellWidth: 16, halign: "center" },
      11: { cellWidth: 36 },
      12: { cellWidth: 8, halign: "center" },
      13: { cellWidth: 8, halign: "center" },
      14: { cellWidth: 8, halign: "center" },
      15: { cellWidth: 10, halign: "center" },
      16: { cellWidth: 16, halign: "center" },
      17: { cellWidth: 20 },
      18: { cellWidth: 16, halign: "center" },
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 2) return;
      const riskItem = args.riskItems[data.row.index];
      const imageData = riskItem ? photoMap.get(riskItem.id) : null;
      if (!imageData) return;
      const size = Math.min(data.cell.width - 3, data.cell.height - 3, 13);
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;
      doc.addImage(imageData, getImageFormat(imageData), x, y, size, size, undefined, "FAST");
    },
  });
}

function addPageFooters(doc: jsPDF, companyName: string) {
  const totalPages = doc.getNumberOfPages();
  const roles = ["İŞ GÜVENLİĞİ UZMANI", "İŞYERİ HEKİMİ", "ÇALIŞAN TEM.", "DESTEK ELEMANI", "Bilgi Sahibi Çalışan", "İŞVEREN/VEKİLİ"];

  for (let page = 2; page <= totalPages; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    setDraw(doc, COLORS.line);
    doc.setLineWidth(0.15);
    doc.line(10, pageHeight - 10.5, pageWidth - 10, pageHeight - 10.5);
    setText(doc, COLORS.slate);
    setFont(doc, "normal");
    doc.setFontSize(6.2);

    const usableWidth = pageWidth - 20;
    const step = usableWidth / (roles.length - 1);
    roles.forEach((role, index) => {
      const x = 10 + step * index;
      const align = index === 0 ? "left" : index === roles.length - 1 ? "right" : "center";
      doc.text(role, x, pageHeight - 6.6, { align });
    });

    doc.text(`Sayfa ${page} / ${totalPages}`, pageWidth - 10, pageHeight - 3.2, { align: "right" });
  }
}

export async function buildRiskAssessmentPdf(args: BuildRiskAssessmentPdfArgs) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  addInterFontsToJsPDF(doc);
  setFont(doc, "normal");

  const logoDataUrl = await args.loadImageAsDataUrl(args.company?.logo_url);

  const photoEntries = await Promise.all(
    args.riskItems.map(async (item) => {
      if (!item.photo_url) return null;
      const image = await args.loadImageAsDataUrl(item.photo_url);
      if (!image) return null;
      return { item, image };
    })
  );
  const photoItems = photoEntries.filter(Boolean) as Array<{ item: RiskItem; image: string }>;
  const photoMap = new Map(photoItems.map((entry) => [entry.item.id, entry.image]));

  drawCoverPage(doc, args, logoDataUrl);
  doc.addPage("a4", "portrait");
  addIntroPages(doc, args);
  addTeamPage(doc, args);
  await addFineKinneyReferencePage(doc, args);
  await addProcessFlowPage(doc, args);
  addPhotoGalleryPage(doc, photoItems);
  addTablePages(doc, args, photoMap, logoDataUrl);
  addPageFooters(doc, args.company?.name?.trim() || "Firma");

  return doc;
}