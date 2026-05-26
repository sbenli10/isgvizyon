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

  // Dosya yolu (public altÄ±ndan Ã¶rn: "/assets/xxx.png")
  fineKinneyTableImageUrl?: string | null;
  processFlowImageUrl?: string | null;
};

const COLORS = {
  salmon: [232, 156, 141] as const,
  ink: [17, 24, 39] as const,
  slate: [71, 85, 105] as const,
  line: [203, 213, 225] as const,
  soft: [248, 250, 252] as const,
  rose: [220, 38, 38] as const, // <-- EKLE (fallback error text iÃ§in)
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
  return normalizePdfText(value).toLocaleUpperCase("tr-TR");
}
function normalizePdfText(value: string) {
  return value
    .replace(/Ä°/g, "İ")
    .replace(/Ä±/g, "ı")
    .replace(/Åž/g, "Ş")
    .replace(/ÅŸ/g, "ş")
    .replace(/Äž/g, "Ğ")
    .replace(/ÄŸ/g, "ğ")
    .replace(/Ãœ/g, "Ü")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã–/g, "Ö")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã‡/g, "Ç")
    .replace(/Ã§/g, "ç")
    .replace(/â€¢/g, "•")
    .replace(/â€”/g, "—")
    .replace(/â€“/g, "–")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/Â°/g, "°")
    .replace(/B\?\?LG\?\? SAH\?\?B\?\? \?\?ALI\?\?AN/g, "BİLGİ SAHİBİ ÇALIŞAN");
}
function split(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(normalizePdfText(text), width) as string[];
}
function truncateLines(lines: string[], maxLines: number) {
  if (lines.length <= maxLines) return lines;
  const nextLines = lines.slice(0, maxLines);
  const lastLine = nextLines[maxLines - 1] || "";
  nextLines[maxLines - 1] = `${lastLine.replace(/[. ]+$/g, "").slice(0, Math.max(0, lastLine.length - 3)).trimEnd()}...`;
  return nextLines;
}
function fitTextToWidth(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  options?: { startFontSize?: number; minFontSize?: number; maxLines?: number }
) {
  const startFontSize = options?.startFontSize ?? 24;
  const minFontSize = options?.minFontSize ?? 12;
  const maxLines = options?.maxLines ?? 3;
  let fontSize = startFontSize;
  let lines: string[] = [];

  while (fontSize >= minFontSize) {
    doc.setFontSize(fontSize);
    lines = split(doc, text, maxWidth);
    if (lines.length <= maxLines) {
      return { fontSize, lines };
    }
    fontSize -= 1;
  }

  doc.setFontSize(minFontSize);
  return {
    fontSize: minFontSize,
    lines: truncateLines(split(doc, text, maxWidth), maxLines),
  };
}
function drawWrappedCenteredText(
  doc: jsPDF,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  options?: {
    startFontSize?: number;
    minFontSize?: number;
    maxLines?: number;
    lineHeight?: number;
    weight?: "normal" | "bold";
    color?: readonly [number, number, number];
  }
) {
  const { fontSize, lines } = fitTextToWidth(doc, text, maxWidth, {
    startFontSize: options?.startFontSize,
    minFontSize: options?.minFontSize,
    maxLines: options?.maxLines,
  });
  const lineHeight = options?.lineHeight ?? Math.max(6, fontSize * 0.48);
  doc.setFontSize(fontSize);
  setFont(doc, options?.weight ?? "normal");
  setText(doc, options?.color ?? COLORS.ink);
  doc.text(lines, centerX, startY, { align: "center", baseline: "top" });
  return { fontSize, lines, height: lines.length * lineHeight };
}
function getImageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.includes("image/png") ? "PNG" : "JPEG";
}
function formatProcedurePageLabel(pageNumber: number) {
  return `- ${pageNumber} -`;
}

function formatTableDate(value?: string | null) {
  if (!value) return "—";

  const rawValue = String(value).trim();
  if (!rawValue || rawValue === "-" || rawValue === "—") return "—";

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return format(parsedDate, "dd.MM.yy", { locale: tr });
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
  doc.text("TEHLÄ°KE TANIMLAMA VE RÄ°SK DEÄžERLENDÄ°RMESÄ°\nPROSEDÃœRÃœ", pageWidth / 2, 18.6, {
    align: "center",
    baseline: "middle",
  });

  setFont(doc, "normal");
  doc.setFontSize(6);
  doc.text("DokÃ¼man No", pageWidth - 54, 14.5);
  doc.text("Ä°SG.PR.002", pageWidth - 36, 14.5);
  doc.text("YayÄ±n Tarihi", pageWidth - 54, 18.3);
  doc.text("01.01.2026", pageWidth - 36, 18.3);
  doc.text("Revizyon Tarihi", pageWidth - 54, 22.1);
  doc.text("-", pageWidth - 36, 22.1);
  doc.text("Revizyon No", pageWidth - 54, 25.9);
  doc.text("-", pageWidth - 36, 25.9);
  doc.text("Sayfa No", pageWidth - 54, 29.7);
  doc.text(pageLabel, pageWidth - 36, 29.7);
}

/** Browser ortamÄ±nda dataURL gÃ¶rselinin doÄŸal boyutlarÄ±nÄ± okur. */
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
 * Verilen dataUrl gÃ¶rselini belirtilen alana ORANI BOZMADAN (contain) sÄ±ÄŸdÄ±rÄ±r ve ortalar.
 * TaÅŸma olmaz.
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
  const companyName = args.company?.name?.trim() || "FÄ°RMA";
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
  doc.text("GAZÄ°ANTEP", pageWidth / 2, innerY + 52, { align: "center" });

  setFont(doc, "bold");
  doc.setFontSize(12);
  doc.text("Ä°Åž SAÄžLIÄžI VE GÃœVENLÄ°ÄžÄ°", pageWidth / 2, innerY + 70, { align: "center" });
  doc.text("TEHLÄ°KE TANIMLAMA VE RÄ°SK DEÄžERLENDÄ°RMESÄ° PROSEDÃœRÃœ", pageWidth / 2, innerY + 86, { align: "center" });

  setDraw(doc, [113, 120, 135]);
  doc.setLineWidth(0.2);
  doc.line(pageWidth / 2 - 60, innerY + 89, pageWidth / 2 + 60, innerY + 89);

  setFont(doc, "normal");
  doc.setFontSize(9);
  setText(doc, COLORS.slate);
  doc.text(`${upperTr(companyName)} â€¢ Fine-Kinney Risk DeÄŸerlendirme Tablosu`, pageWidth / 2, 13.4, { align: "center" });

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
  doc.text("RÄ°SK\nDEÄžERLENDÄ°RMESÄ°NÄ°N", tableX + leftW / 2, tableY + 13, { align: "center", baseline: "middle" });
  doc.text("YAPILDIÄžI TARÄ°H", tableX + leftW + labelW / 2, tableY + 7.8, { align: "center" });
  doc.text("GEÃ‡ERLÄ°LÄ°K TARÄ°HÄ°", tableX + leftW + labelW / 2, tableY + rowH + 7.8, { align: "center" });
  doc.text("REVÄ°ZYON NO / TARÄ°HÄ°", tableX + leftW + labelW / 2, tableY + rowH * 2 + 7.8, { align: "center" });

  setFont(doc, "normal");
  doc.text(reportDate, tableX + leftW + labelW + valueW / 2, tableY + 7.8, { align: "center" });
  doc.text(validityDate, tableX + leftW + labelW + valueW / 2, tableY + rowH + 7.8, { align: "center" });
  doc.text(`Rev.${args.assessment.version ?? 0} / ${reportDate}`, tableX + leftW + labelW + valueW / 2, tableY + rowH * 2 + 7.8, {
    align: "center",
  });
}

function drawCoverPageV2(doc: jsPDF, args: BuildRiskAssessmentPdfArgs, logoDataUrl: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const companyName = args.company?.name?.trim() || "FÄ°RMA";
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

  const logoWidth = 34;
  const logoHeight = 20;
  const logoX = innerX + innerW - logoWidth - 12;
  const logoY = innerY + 10;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), logoX, logoY, logoWidth, logoHeight, undefined, "FAST");
  }

  const companyTitle = drawWrappedCenteredText(doc, companyUpper, pageWidth / 2, innerY + 42, logoDataUrl ? innerW - 64 : innerW - 40, {
    startFontSize: 23,
    minFontSize: 14,
    maxLines: 3,
    lineHeight: 7.2,
    weight: "bold",
    color: [12, 18, 30],
  });
  const subtitleY = innerY + 38 + companyTitle.height + 7;

  doc.setFontSize(10);
  setFont(doc, "normal");
  setText(doc, [12, 18, 30]);
  doc.text("GAZÄ°ANTEP", pageWidth / 2, subtitleY, { align: "center" });

  const headingY = subtitleY + 18;
  doc.setFontSize(12);
  setFont(doc, "bold");
  doc.text("Ä°Åž SAÄžLIÄžI VE GÃœVENLÄ°ÄžÄ°", pageWidth / 2, headingY, { align: "center" });

  const procedureTitle = drawWrappedCenteredText(
    doc,
    "TEHLÄ°KE TANIMLAMA VE RÄ°SK DEÄžERLENDÄ°RMESÄ° PROSEDÃœRÃœ",
    pageWidth / 2,
    headingY + 9,
    innerW - 44,
    {
      startFontSize: 12,
      minFontSize: 10,
      maxLines: 2,
      lineHeight: 5.6,
      weight: "bold",
      color: [12, 18, 30],
    }
  );

  const separatorY = headingY + 9 + procedureTitle.height + 3;
  setDraw(doc, [113, 120, 135]);
  doc.setLineWidth(0.2);
  doc.line(pageWidth / 2 - 60, separatorY, pageWidth / 2 + 60, separatorY);

  drawWrappedCenteredText(doc, `${upperTr(companyName)} â€¢ Fine-Kinney Risk DeÄŸerlendirme Tablosu`, pageWidth / 2, 10.8, pageWidth - 38, {
    startFontSize: 9,
    minFontSize: 7,
    maxLines: 2,
    lineHeight: 3.8,
    color: COLORS.slate,
  });

  const tableX = pageWidth / 2 - 48;
  const tableY = Math.max(innerY + 136, separatorY + 44);
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
  doc.text("RÄ°SK\nDEÄžERLENDÄ°RMESÄ°NÄ°N", tableX + leftW / 2, tableY + 13, { align: "center", baseline: "middle" });
  doc.text("YAPILDIÄžI TARÄ°H", tableX + leftW + labelW / 2, tableY + 7.8, { align: "center" });
  doc.text("GEÃ‡ERLÄ°LÄ°K TARÄ°HÄ°", tableX + leftW + labelW / 2, tableY + rowH + 7.8, { align: "center" });
  doc.text("REVÄ°ZYON NO / TARÄ°HÄ°", tableX + leftW + labelW / 2, tableY + rowH * 2 + 7.8, { align: "center" });

  setFont(doc, "normal");
  doc.text(reportDate, tableX + leftW + labelW + valueW / 2, tableY + 7.8, { align: "center" });
  doc.text(validityDate, tableX + leftW + labelW + valueW / 2, tableY + rowH + 7.8, { align: "center" });
  doc.text(`Rev.${args.assessment.version ?? 0} / ${reportDate}`, tableX + leftW + labelW + valueW / 2, tableY + rowH * 2 + 7.8, {
    align: "center",
  });
}

function buildIntroSections(companyName: string, assessment: RiskAssessment) {
  const companyUpper = upperTr(companyName);
  const assessor = assessment.occupational_safety_specialist_name || assessment.assessor_name || "Ä°ÅŸ GÃ¼venliÄŸi UzmanÄ±";
  const doctor = assessment.workplace_doctor_name || "Ä°ÅŸyeri Hekimi";
  const employer = assessment.employer_name || assessment.employer_representative_name || "Ä°ÅŸveren / Ä°ÅŸveren Vekili";
  const employeeRep = assessment.employee_representative_name || "Ã‡alÄ±ÅŸan Temsilcisi";
  const support = assessment.support_personnel_name || "Destek ElemanÄ±";

  return [
    {
      title: "1. AMAÃ‡",
      paragraphs: [
        `${companyUpper}'de var olan Ã§alÄ±ÅŸma koÅŸullarÄ±ndan kaynaklanan her tÃ¼rlÃ¼ tehlike ve riskin tespiti, mevcut iÅŸ saÄŸlÄ±ÄŸÄ± ve gÃ¼venliÄŸi yasa ve yÃ¶netmeliklerine uygunluÄŸunun deÄŸerlendirilmesi ve bu risklerin insan saÄŸlÄ±ÄŸÄ±nÄ± etkilemeyen seviyeye dÃ¼ÅŸÃ¼rÃ¼lmesi amaÃ§lanmaktadÄ±r.`,
        `Tehlike tanÄ±mlama ve risk deÄŸerlendirmesi sonucunda ortaya Ã§Ä±kan risk deÄŸerlerinin iyileÅŸtirilmesi, Ã¶nerilerde bulunulmasÄ±, Ä°SG yÃ¶netim sisteminin disiplin altÄ±na alÄ±nmasÄ± ve yÃ¶netim metodunun belirlenmesi hedeflenmektedir.`,
      ],
    },
    {
      title: "2. KAPSAM",
      paragraphs: [
        `Bu rapor ${companyUpper}'de yapÄ±lan gÃ¶zlemlere gÃ¶re hazÄ±rlanmÄ±ÅŸtÄ±r. Ã‡alÄ±ÅŸma; iÅŸyerinde kullanÄ±lan tÃ¼m makine, tesisat, bina, eklenti ve sosyal tesisleri, Ã§alÄ±ÅŸan firma sorumlularÄ±nÄ±, iÅŸÃ§ileri, ziyaretÃ§ileri ve tedarikÃ§ileri kapsar.`,
      ],
    },
    {
      title: "3. REFERANSLAR",
      paragraphs: ["OHSAS 18001, Ä°ÅŸ SaÄŸlÄ±ÄŸÄ± ve GÃ¼venliÄŸi Risk DeÄŸerlendirmesi YÃ¶netmeliÄŸi, Ä°ÅŸ SaÄŸlÄ±ÄŸÄ± ve GÃ¼venliÄŸi Kanunu."],
    },
    {
      title: "4. TANIMLAR",
      paragraphs: [
        "Tehlike: Ä°ÅŸyerinde var olan ya da dÄ±ÅŸarÄ±dan gelebilecek, Ã§alÄ±ÅŸanÄ± veya iÅŸyerini etkileyebilecek zarar veya hasar verme potansiyelidir.",
        "Ã–nleme: Ä°ÅŸyerinde yÃ¼rÃ¼tÃ¼len iÅŸlerin bÃ¼tÃ¼n safhalarÄ±nda iÅŸ saÄŸlÄ±ÄŸÄ± ve gÃ¼venliÄŸi ile ilgili riskleri ortadan kaldÄ±rmak veya azaltmak iÃ§in planlanan ve alÄ±nan tedbirlerin tÃ¼mÃ¼dÃ¼r.",
        "Ramak kala olay: Ä°ÅŸyerinde meydana gelen; Ã§alÄ±ÅŸan, iÅŸyeri ya da iÅŸ ekipmanÄ±nÄ± zarara uÄŸratma potansiyeli olduÄŸu halde zarara uÄŸratmayan olaydÄ±r.",
        "Risk: Tehlikeden kaynaklanacak kayÄ±p, yaralanma ya da baÅŸka zararlÄ± sonuÃ§ meydana gelme ihtimalidir.",
        "Risk deÄŸerlendirmesi: Ä°ÅŸyerinde var olan ya da dÄ±ÅŸarÄ±dan gelebilecek tehlikelerin belirlenmesi, bu tehlikelerin riske dÃ¶nÃ¼ÅŸmesine yol aÃ§an faktÃ¶rler ile tehlikelerden kaynaklanan risklerin analiz edilerek derecelendirilmesi ve kontrol tedbirlerinin kararlaÅŸtÄ±rÄ±lmasÄ± amacÄ±yla yapÄ±lmasÄ± gerekli Ã§alÄ±ÅŸmalardÄ±r.",
      ],
    },
    {
      title: "5. SORUMLULUKLAR VE PERSONEL",
      paragraphs: [
        `Ä°ÅŸ kazalarÄ±na karÅŸÄ± gerekli Ã¶nlemlerin alÄ±nmasÄ±ndan ${employer}, risk deÄŸerlendirmesi Ã§alÄ±ÅŸmalarÄ±nÄ±n yÃ¼rÃ¼tÃ¼lmesinden risk deÄŸerlendirmesi ekibi sorumludur.`,
        `"Ä°SG.PR.016 Tehlike TanÄ±mlama ve Risk DeÄŸerlendirmesi Formu" ${companyUpper} tarafÄ±ndan gÃ¶revlendirilen risk deÄŸerlendirme ekibi tarafÄ±ndan hazÄ±rlanacak; ${assessor}, ${companyUpper} Ã§alÄ±ÅŸan tÃ¼m personele iÅŸ gÃ¼venliÄŸi eÄŸitimi kapsamÄ±nda bilgilendirme yapacak ve tehlike bildirim formlarÄ±nÄ± gÃ¶z Ã¶nÃ¼ne alarak kontrolleri sÃ¼rdÃ¼recektir.`,
      ],
    },
    {
      title: "5.1. Ä°Åž SAÄžLIÄžI VE GÃœVENLÄ°ÄžÄ° KONUSUNDA Ä°ÅžVERENÄ°N GÃ–REVLERÄ°",
      paragraphs: [
        "Ä°ÅŸveren, Ã§alÄ±ÅŸanlarÄ±n iÅŸle ilgili saÄŸlÄ±k ve gÃ¼venliÄŸini saÄŸlamakla yÃ¼kÃ¼mlÃ¼dÃ¼r. Bu Ã§erÃ§evede mesleki risklerin Ã¶nlenmesi, eÄŸitim ve bilgi verilmesi dahil her tÃ¼rlÃ¼ tedbirin alÄ±nmasÄ±, organizasyonun yapÄ±lmasÄ±, gerekli araÃ§ ve gereÃ§lerin saÄŸlanmasÄ± ve saÄŸlÄ±k-gÃ¼venlik tedbirlerinin deÄŸiÅŸen ÅŸartlara uygun hale getirilmesi iÃ§in Ã§alÄ±ÅŸmalar yÃ¼rÃ¼tÃ¼r.",
        "Ä°ÅŸyerinde alÄ±nan iÅŸ saÄŸlÄ±ÄŸÄ± ve gÃ¼venliÄŸi tedbirlerine uyulup uyulmadÄ±ÄŸÄ±nÄ± izler, denetler ve uygunsuzluklarÄ±n giderilmesini saÄŸlar; risk deÄŸerlendirmesi yapar veya yaptÄ±rÄ±r; gÃ¶rev verirken Ã§alÄ±ÅŸanÄ±n saÄŸlÄ±k ve gÃ¼venlik yÃ¶nÃ¼nden iÅŸe uygunluÄŸunu dikkate alÄ±r; hayati tehlike bulunan alanlara yetkisiz giriÅŸleri engeller.",
        "Ä°ÅŸyeri dÄ±ÅŸÄ±ndaki uzman kiÅŸi ve kuruluÅŸlardan hizmet alÄ±nmasÄ± iÅŸverenin sorumluluklarÄ±nÄ± ortadan kaldÄ±rmaz; iÅŸ saÄŸlÄ±ÄŸÄ± ve gÃ¼venliÄŸi tedbirlerinin maliyeti Ã§alÄ±ÅŸanlara yansÄ±tÄ±lamaz.",
      ],
    },
    {
      title: "5.2. RÄ°SK DEÄžERLENDÄ°RME EKÄ°BÄ°'NÄ°N GÃ–REVLERÄ°",
      paragraphs: [
        "Ä°ÅŸ SaÄŸlÄ±ÄŸÄ± ve GÃ¼venliÄŸi Risk DeÄŸerlendirmesi YÃ¶netmeliÄŸi'ne gÃ¶re yapÄ±lacak Ã§alÄ±ÅŸmalar iÃ§in ekip oluÅŸturulmalÄ±dÄ±r, risk deÄŸerlendirmesi ekibinde sÃ¶z konusu yÃ¶netmeliÄŸin 6. Maddesine gÃ¶re bulunmasÄ± gereken kiÅŸiler aÅŸaÄŸÄ±daki gibi tanÄ±mlanmÄ±ÅŸtÄ±r.",
        "\"Ä°SG.FR.017.RÄ°SK DEÄžERLENDÄ°RME EKÄ°BÄ°\"'nde gÃ¶revlendirilen kiÅŸiler formu ile kayÄ±t altÄ±na alÄ±nacak ve \"Ä°SG.EGT.002 RÄ°SK DEÄžERLENDÄ°RME EKÄ°BÄ° EÄžÄ°TÄ°MÄ°\" ve \"Ä°SG.FR.009.RÄ°SK DEÄžERLENDÄ°RME EKÄ°BÄ° EÄžÄ°TÄ°M KATILIM FORMU\" ile eÄŸitimi tamamlanacaktÄ±r.",
        "- Ä°ÅŸveren veya iÅŸveren vekili.",
        "- Ä°ÅŸyerinde saÄŸlÄ±k ve gÃ¼venlik hizmetini yÃ¼rÃ¼ten iÅŸ gÃ¼venliÄŸi uzmanlarÄ± ile iÅŸyeri hekimleri.",
        "- Ä°ÅŸyerindeki Ã§alÄ±ÅŸan temsilcileri.",
        "- Ä°ÅŸyerindeki destek elemanlarÄ±.",
        "- Ä°ÅŸyerindeki bÃ¼tÃ¼n birimleri temsil edecek ÅŸekilde belirlenen ve iÅŸyerinde yÃ¼rÃ¼tÃ¼len Ã§alÄ±ÅŸmalar, mevcut veya muhtemel tehlike kaynaklarÄ± ile riskler konusunda bilgi sahibi Ã§alÄ±ÅŸanlar.",
      ],
    },
    {
      title: "6. RÄ°SK DEÄžERLENDÄ°RME SÃœRECÄ°",
      paragraphs: [
        `Risk deÄŸerlendirmesi iÃ§in "Ä°SG.FR.016 Tehlike TanÄ±mlama ve Risk DeÄŸerlendirme Formu" kullanÄ±lÄ±r. TÃ¼m iÅŸyerleri iÃ§in tasarÄ±m veya kuruluÅŸ aÅŸamasÄ±ndan baÅŸlamak Ã¼zere tehlikeleri tanÄ±mlama, riskleri belirleme ve analiz etme, risk kontrol tedbirlerinin kararlaÅŸtÄ±rÄ±lmasÄ±, dokÃ¼mantasyon, yapÄ±lan Ã§alÄ±ÅŸmalarÄ±n gÃ¼ncellenmesi ve gerektiÄŸinde yenilenmesi aÅŸamalarÄ± izlenir.`,
      ],
    },
    {
      title: "6.1. RÄ°SK DEÄžERLENDÄ°RMESÄ°",
      paragraphs: [
        "Ã‡alÄ±ÅŸanlarÄ±n risk deÄŸerlendirmesi Ã§alÄ±ÅŸmasÄ± yapÄ±lÄ±rken ihtiyaÃ§ duyulan her aÅŸamada sÃ¼rece katÄ±larak gÃ¶rÃ¼ÅŸlerinin alÄ±nmasÄ± saÄŸlanÄ±r. Bu sÃ¼reÃ§te ramak kala ve tehlike bildirim formlarÄ± kullanÄ±larak Ã§alÄ±ÅŸan gÃ¶rÃ¼ÅŸleri kayÄ±t altÄ±na alÄ±nÄ±r.",
      ],
    },
    {
    title: "6.2. TEHLÄ°KELERÄ°N TANIMLANMASI",
    paragraphs: [
      "Tehlikeler tanÄ±mlanÄ±rken Ã§alÄ±ÅŸma ortamÄ±, Ã§alÄ±ÅŸanlar ve iÅŸyerine iliÅŸkin ilgisine gÃ¶re asgari olarak aÅŸaÄŸÄ±da belirtilen bilgiler toplanÄ±r.",
      "a) Ä°ÅŸyeri bina ve eklentileri.",
      "b) Ä°ÅŸyerinde yÃ¼rÃ¼tÃ¼len faaliyetler ile iÅŸ ve iÅŸlemler.",
      "c) Ãœretim sÃ¼reÃ§ ve teknikleri.",
      "Ã§) Ä°ÅŸ ekipmanlarÄ±.",
      "d) KullanÄ±lan maddeler.",
      "e) ArtÄ±k ve atÄ±klarla ilgili iÅŸlemler.",
      "f) Organizasyon ve hiyerarÅŸik yapÄ±, gÃ¶rev, yetki ve sorumluluklar.",
      "g) Ã‡alÄ±ÅŸanlarÄ±n tecrÃ¼be ve dÃ¼ÅŸÃ¼nceleri.",
      "ÄŸ) Ä°ÅŸe baÅŸlamadan Ã¶nce ilgili mevzuat gereÄŸi alÄ±nacak Ã§alÄ±ÅŸma izin belgeleri.",
      "h) Ã‡alÄ±ÅŸanlarÄ±n eÄŸitim, yaÅŸ, cinsiyet ve benzeri Ã¶zellikleri ile saÄŸlÄ±k gÃ¶zetimi kayÄ±tlarÄ±.",
      "Ä±) GenÃ§, yaÅŸlÄ±, engelli, gebe veya emziren Ã§alÄ±ÅŸanlar gibi Ã¶zel politika gerektiren gruplar ile kadÄ±n Ã§alÄ±ÅŸanlarÄ±n durumu.",
      "i) Ä°ÅŸyerinin teftiÅŸ sonuÃ§larÄ±.",
      "j) Meslek hastalÄ±ÄŸÄ± kayÄ±tlarÄ±.",
      "k) Ä°ÅŸ kazasÄ± kayÄ±tlarÄ±.",
      "l) Ä°ÅŸyerinde meydana gelen ancak yaralanma veya Ã¶lÃ¼me neden olmadÄ±ÄŸÄ± halde iÅŸyeri ya da iÅŸ ekipmanÄ±nÄ±n zarara uÄŸramasÄ±na yol aÃ§an olaylara iliÅŸkin kayÄ±tlar.",
      "m) Ramak kala olay kayÄ±tlarÄ±.",
      "n) Malzeme gÃ¼venlik bilgi formlarÄ±.",
      "o) Ortam ve kiÅŸisel maruziyet dÃ¼zeyi Ã¶lÃ§Ã¼m sonuÃ§larÄ±.",
      "Ã¶) Varsa daha Ã¶nce yapÄ±lmÄ±ÅŸ risk deÄŸerlendirmesi Ã§alÄ±ÅŸmalarÄ±.",
      "p) Acil durum planlarÄ±.",
      "r) SaÄŸlÄ±k ve gÃ¼venlik planÄ± ve patlamadan korunma dokÃ¼manÄ± gibi belirli iÅŸyerlerinde hazÄ±rlanmasÄ± gereken dokÃ¼manlar.",

      "Tehlikelere iliÅŸkin bilgiler toplanÄ±rken aynÄ± Ã¼retim, yÃ¶ntem ve teknikleri ile Ã¼retim yapan benzer iÅŸyerlerinde meydana gelen iÅŸ kazalarÄ± ve ortaya Ã§Ä±kan meslek hastalÄ±klarÄ± da deÄŸerlendirilebilir. Toplanan bilgiler Ä±ÅŸÄ±ÄŸÄ±nda; iÅŸ saÄŸlÄ±ÄŸÄ± ve gÃ¼venliÄŸi ile ilgili mevzuatta yer alan hÃ¼kÃ¼mler de dikkate alÄ±narak, Ã§alÄ±ÅŸma ortamÄ±nda bulunan fiziksel, kimyasal, biyolojik, psikososyal, ergonomik ve benzeri tehlike kaynaklarÄ±ndan oluÅŸan veya bunlarÄ±n etkileÅŸimi sonucu ortaya Ã§Ä±kabilecek tehlikeler belirlenir ve kayda alÄ±nÄ±r. Bu belirleme yapÄ±lÄ±rken aÅŸaÄŸÄ±daki hususlar, bu hususlardan etkilenecekler ve ne ÅŸekilde etkilenebilecekleri gÃ¶z Ã¶nÃ¼nde bulundurulur.",
      "a) Ä°ÅŸletmenin yeri nedeniyle ortaya Ã§Ä±kabilecek tehlikeler.",
      "b) SeÃ§ilen alanda, iÅŸyeri bina ve eklentilerinin plana uygun yerleÅŸtirilmemesi veya planda olmayan ilavelerin yapÄ±lmasÄ±ndan kaynaklanabilecek tehlikeler.",
      "c) Ä°ÅŸyeri bina ve eklentilerinin yapÄ± ve yapÄ±m tarzÄ± ile seÃ§ilen yapÄ± malzemelerinden kaynaklanabilecek tehlikeler.",
      "Ã§) BakÄ±m ve onarÄ±m iÅŸleri de dahil iÅŸyerinde yÃ¼rÃ¼tÃ¼lecek her tÃ¼rlÃ¼ faaliyet esnasÄ±nda Ã§alÄ±ÅŸma usulleri, vardiya dÃ¼zeni, ekip Ã§alÄ±ÅŸmasÄ±, organizasyon, nezaret sistemi, hiyerarÅŸik dÃ¼zen, ziyaretÃ§i veya iÅŸyeri Ã§alÄ±ÅŸanÄ± olmayan diÄŸer kiÅŸiler gibi faktÃ¶rlerden kaynaklanabilecek tehlikeler.",
      "d) Ä°ÅŸin yÃ¼rÃ¼tÃ¼mÃ¼, Ã¼retim teknikleri, kullanÄ±lan maddeler, makine ve ekipman, araÃ§ ve gereÃ§ler ile bunlarÄ±n Ã§alÄ±ÅŸanlarÄ±n fiziksel Ã¶zelliklerine uygun tasarlanmamasÄ± veya kullanÄ±lmamasÄ±ndan kaynaklanabilecek tehlikeler.",
      "e) Kuvvetli akÄ±m, aydÄ±nlatma, paratoner, topraklama gibi elektrik tesisatÄ±nÄ±n bileÅŸenleri ile Ä±sÄ±tma, havalandÄ±rma, atmosferik ve Ã§evresel ÅŸartlardan korunma, drenaj, arÄ±tma, yangÄ±n Ã¶nleme ve mÃ¼cadele ekipmanÄ± ile benzeri yardÄ±mcÄ± tesisat ve donanÄ±mlardan kaynaklanabilecek tehlikeler.",
      "f) Ä°ÅŸyerinde yanma, parlama veya patlama ihtimali olan maddelerin iÅŸlenmesi, kullanÄ±lmasÄ±, taÅŸÄ±nmasÄ±, depolanmasÄ± ya da imha edilmesinden kaynaklanabilecek tehlikeler.",
      "g) Ã‡alÄ±ÅŸma ortamÄ±na iliÅŸkin hijyen koÅŸullarÄ± ile Ã§alÄ±ÅŸanlarÄ±n kiÅŸisel hijyen alÄ±ÅŸkanlÄ±klarÄ±ndan kaynaklanabilecek tehlikeler.",
      "ÄŸ) Ã‡alÄ±ÅŸanÄ±n, iÅŸyeri iÃ§erisindeki ulaÅŸÄ±m yollarÄ±nÄ±n kullanÄ±mÄ±ndan kaynaklanabilecek tehlikeler.",
      "h) Ã‡alÄ±ÅŸanlarÄ±n iÅŸ saÄŸlÄ±ÄŸÄ± ve gÃ¼venliÄŸi ile ilgili yeterli eÄŸitim almamasÄ±, bilgilendirilmemesi, Ã§alÄ±ÅŸanlara uygun talimat verilmemesi veya Ã§alÄ±ÅŸma izni prosedÃ¼rÃ¼ gereken durumlarda bu izin olmaksÄ±zÄ±n Ã§alÄ±ÅŸÄ±lmasÄ±ndan kaynaklanabilecek tehlikeler.",
    ],
  },
  {
    title: "6.3. RÄ°SK DEÄžERLENDÄ°RMESÄ° KONTROL ADIMLARI",
    paragraphs: [
      "Risk DeÄŸerlendirmesi hazÄ±rlanÄ±rken izlenecek kontrol adÄ±mlarÄ± aÅŸaÄŸÄ±daki maddelerin yapÄ±lmasÄ± ile sÃ¼rdÃ¼rÃ¼lÃ¼r.",
      "a) Planlama: Analiz edilerek etkilerinin bÃ¼yÃ¼klÃ¼ÄŸÃ¼ne ve Ã¶nemine gÃ¶re sÄ±ralÄ± hale getirilen risklerin kontrolÃ¼ amacÄ±yla bir planlama yapÄ±lÄ±r.",
      "b) Risk kontrol tedbirlerinin kararlaÅŸtÄ±rÄ±lmasÄ±: Riskin tamamen bertaraf edilmesi, bu mÃ¼mkÃ¼n deÄŸil ise riskin kabul edilebilir seviyeye indirilmesi iÃ§in aÅŸaÄŸÄ±daki adÄ±mlar uygulanÄ±r.",
      "1) Tehlike veya tehlike kaynaklarÄ±nÄ±n ortadan kaldÄ±rÄ±lmasÄ±.",
      "2) Tehlikelinin, tehlikeli olmayanla veya daha az tehlikeli olanla deÄŸiÅŸtirilmesi.",
      "3) Riskler ile kaynaÄŸÄ±nda mÃ¼cadele edilmesi.",
      "c) Risk kontrol tedbirlerinin uygulanmasÄ±: KararlaÅŸtÄ±rÄ±lan tedbirlerin iÅŸ ve iÅŸlem basamaklarÄ±, iÅŸlemi yapacak kiÅŸi ya da iÅŸyeri bÃ¶lÃ¼mÃ¼, sorumlu kiÅŸi ya da iÅŸyeri bÃ¶lÃ¼mÃ¼, baÅŸlama ve bitiÅŸ tarihi ile benzeri bilgileri iÃ§eren planlar hazÄ±rlanÄ±r. Bu planlar iÅŸverence uygulamaya konulur.",
      "Ã§) UygulamalarÄ±n izlenmesi: HazÄ±rlanan planlarÄ±n uygulama adÄ±mlarÄ± dÃ¼zenli olarak izlenir, denetlenir ve aksayan yÃ¶nler tespit edilerek gerekli dÃ¼zeltici ve Ã¶nleyici iÅŸlemler tamamlanÄ±r.",
      "Risk kontrol adÄ±mlarÄ± uygulanÄ±rken toplu korunma Ã¶nlemlerine, kiÅŸisel korunma Ã¶nlemlerine gÃ¶re Ã¶ncelik verilmesi ve uygulanacak Ã¶nlemlerin yeni risklere neden olmamasÄ± saÄŸlanÄ±r.",
    ],
  },
    {
    title: "6.4. RÄ°SK DEÄžERLENDÄ°RMESÄ° AKSÄ°YON PLANI",
    paragraphs: [
      `${companyUpper} risk deÄŸerlendirmesi ekibi tarafÄ±ndan risk deÄŸerlendirmesi sonrasÄ±nda "Ä°SG.FR.019.RÄ°SK DEÄžERLENDÄ°RMESÄ° AKSÄ°YON PLANI" oluÅŸturulur ve aÅŸaÄŸÄ±dakilerin maddeler yapÄ±lÄ±r.`,
      "a) Belirlenen aksiyonlarÄ±n Ã¶ncelik derecesine gÃ¶re aksiyonun kapatÄ±lmasÄ± iÃ§in planlanan tarih \"hedef tarih\" kolonuna yazÄ±lÄ±r.",
      "b) AksiyonlarÄ± yerine getirecek sorumlular belirlenerek \"sorumlu\" kolonuna isimleri yazÄ±lÄ±r.",
      "c) Aksiyon planÄ±nÄ± takip edecek ve planÄ±n \"Durum\" ve \"Kapatma Tarihi\" kolonlarÄ±nÄ± dolduracak kiÅŸi veya kiÅŸiler belirlenir.",
      "d) \"Durum\" kolonuna aÅŸaÄŸÄ±daki giriÅŸler yapÄ±larak aksiyon planÄ± ve performans takip edilir:",
      "- Tamamlanan",
      "- Hedef Tarihi GeÃ§en",
      "- Zaman Var",
      "- Hedef Tarih VerilmemiÅŸ",
      "e) Aksiyonlar kapatÄ±ldÄ±ÄŸÄ±nda risk deÄŸerlendirmesinde bulunan \"Kapatma Tarihi\" kolonu doldurulur.",
      "f) AksiyonlarÄ±n belirlenen hedef tarihler iÃ§inde kapatÄ±lmasÄ± saÄŸlanÄ±r.",
      "g) OluÅŸturulan \"Risk DeÄŸerlendirmesi Aksiyon PlanÄ±\" aksiyonlarÄ± kapatacak kiÅŸiler ile paylaÅŸÄ±lÄ±r.",
      "h) Risk DeÄŸerlendirme Ã§alÄ±ÅŸmasÄ±nÄ±n yÃ¶netmelik haricinde belirtilen haller dÄ±ÅŸÄ±nda yÄ±lda bir defa ve uzman deÄŸiÅŸikliÄŸi sonucunda ilk olarak aksiyon planÄ± oluÅŸturularak yÄ±l sonunda risk analizinin revize edilmesi saÄŸlanÄ±r.",
      `i) Risk deÄŸerlendirmesi bu konuda eÄŸitim almÄ±ÅŸ ${companyUpper} tarafÄ±ndan gÃ¶revlendirilmiÅŸ personeller tarafÄ±ndan gÃ¼ncellenebilir.`,
    ],
  },
    {
    title: "6.5. FINE â€“ KINNEY METODU",
    paragraphs: [
      "Kaza kontrolÃ¼ iÃ§in matematiksel deÄŸerlendirme anlamÄ±na gelir. Bu yÃ¶ntem G.F. Kinney and A.D Wiruth tarafÄ±ndan 1976 yÄ±lÄ±nda geliÅŸtirilmiÅŸtir. Ã‡alÄ±ÅŸma ortamÄ±ndaki tehlikelerin kazaya sebebiyet vermeden tespit edilmesini ve risk skoruna gÃ¶re en Ã¶ncelikli olandan baÅŸlayÄ±p iyileÅŸtirilmesini saÄŸlayan bir metottur.",
      `Bu Ã§alÄ±ÅŸmada; ${companyUpper}'e ait gerÃ§ekleÅŸtirilen Kinney Risk Analizi yÃ¶netiminin konusu ele alÄ±nmÄ±ÅŸtÄ±r. Uygulamayla iÅŸletmede iÅŸ kazasÄ± ve meslek hastalÄ±ÄŸÄ± oluÅŸturabilecek riskler deÄŸerlendirilip, bunlarÄ±n engellenmesine yÃ¶nelik iyileÅŸtirme Ã¶nerilerinde bulunulmuÅŸtur.`,
      "Analiz edilerek belirlenmiÅŸ tehlikeler, aÅŸaÄŸÄ±da aÃ§Ä±klamasÄ± yapÄ±lan FINE KINNEY risk yÃ¶ntemine gÃ¶re deÄŸerlendirilir.",
      "RÄ°SK = OLASILIK X FREKANS X ÅžÄ°DDET formÃ¼lÃ¼ kullanÄ±larak hesaplanÄ±r.",
      "OlasÄ±lÄ±k: OlasÄ±lÄ±k deÄŸerlendirilirken, faaliyet esnasÄ±ndaki tehlikelerden kaynaklanan zararÄ±n gerÃ§ekleÅŸme olasÄ±lÄ±ÄŸÄ± sorgulanÄ±r ve puanlandÄ±rÄ±lÄ±r.",
      "Frekans: Frekans deÄŸerlendirilirken, faaliyet esnasÄ±nda tehlikeye maruz kalma sÄ±klÄ±ÄŸÄ± sorgulanÄ±r ve puanlandÄ±rÄ±lÄ±r.",
      "Åžiddet: Åžiddet deÄŸerlendirilirken, faaliyet esnasÄ±ndaki tehlikelerden kaynaklanan zararÄ±n Ã§alÄ±ÅŸan ve veya ekipman Ã¼zerinde yaratacaÄŸÄ± tahmini etki sorgulanÄ±r ve puanlandÄ±rÄ±lÄ±r.",
      "Risk Skoru; OlayÄ±n Meydana Gelme Ä°htimali(O) x Tehlike Maruziyet SÄ±klÄ±ÄŸÄ±(F) x Åžiddet(Åž)",
      "Bu yÃ¶ntem sÄ±kÃ§a uygulanmakta olup, iÅŸverenlerinde algÄ±layabileceÄŸi bir yÃ¶ntemdir. Sadece olasÄ±lÄ±k ya da ÅŸiddete baÄŸlÄ± kalmayÄ±p firma iÃ§inde zarara maruz kalma sÄ±klÄ±ÄŸÄ± parametre olarak da deÄŸerlendirilmesinden dolayÄ± daha etkin sonuÃ§lar alÄ±nmaktadÄ±r.",
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
  const bottomLimit = () => pageHeight() - 26; // 18 yerine 26: footer + yazÄ± gÃ¼venliÄŸi
  drawProcedurePageHeader(doc, formatProcedurePageLabel(doc.getCurrentPageInfo().pageNumber));
  let y = 37;

const ensureSpace = (needed: number, minKeep = 0) => {
  // minKeep: bu paragraf baÅŸlamadan Ã¶nce sayfada kalmasÄ±nÄ± istediÄŸimiz minimum boÅŸluk (mm)
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
      const minKeep = 12; // ~ en az 2-3 satÄ±r sayfa sonunda kalmadan yeni sayfaya geÃ§
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
  const informedEmployee = args.assessment.informed_employee_name || "";

  setText(doc, COLORS.ink);
  setFont(doc, "bold");
  doc.setFontSize(12);
  doc.text("7. RÄ°SK DEÄžERLENDÄ°RME EKÄ°BÄ°", 14, 40);
  setFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(
    split(
      doc,
      "29.12.2012 tarihli ve 28512 sayÄ±lÄ± Resmi Gazete'de yayÄ±mlanan Ä°ÅŸ SaÄŸlÄ±ÄŸÄ± ve GÃ¼venliÄŸi Risk DeÄŸerlendirmesi YÃ¶netmeliÄŸi Madde 6'ya gÃ¶re belirlenen Risk DeÄŸerlendirme Ekibi aÅŸaÄŸÄ±daki gibidir.",
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
    ["Ä°ÅžVEREN / Ä°ÅžVEREN VEKÄ°LÄ°", employer],
    ["Ä°Åž GÃœVENLÄ°ÄžÄ° UZMANI", assessor],
    ["Ä°Åž YERÄ° HEKÄ°MÄ°", doctor],
    ["Ã‡ALIÅžAN TEMSÄ°LCÄ°SÄ°", employeeRep],
    ["DESTEK ELEMANI", support],
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
  doc.text("Ä°mza", x + leftW + titleW + nameW + signW / 2, y + 7.5, { align: "center" });
  doc.text("RÄ°SK\nDEÄžERLENDÄ°RME\nEKÄ°BÄ°", x + leftW / 2, y + rowH * 4.1, { align: "center", baseline: "middle" });

  setFont(doc, "normal");
  rows.forEach((row, index) => {
    const rowY = y + rowH * (index + 1) + 7.5;
    doc.text(row[0], x + leftW + 2, rowY);
    doc.text(":", x + leftW + titleW - 4, rowY);
    doc.text(split(doc, row[1] || "", nameW - 4), x + leftW + titleW + 2, rowY - 2, { baseline: "top" });
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
    "AÅŸaÄŸÄ±daki referans tablo, olasÄ±lÄ±k, frekans ve ÅŸiddet deÄŸerlerinin deÄŸerlendirilmesinde ortak bir karar dili oluÅŸturmak amacÄ±yla rapora eklenmiÅŸtir.",
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
    doc.text("Fine-Kinney tablo gÃ¶rseli yÃ¼klenemedi.", 14, 70);
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
  drawSectionTitle(doc, "RÄ°SK DEÄžERLENDÄ°RME SÃœREÃ‡ AKIÅžI", 14, 36, pageWidth - 28);

  drawWrappedText(
    doc,
    "Bu akÄ±ÅŸ, faaliyetlerin sÄ±nÄ±flandÄ±rÄ±lmasÄ±ndan kontrol tedbirlerinin izlenmesine kadar risk deÄŸerlendirme dÃ¶ngÃ¼sÃ¼nÃ¼ gÃ¶rsel olarak Ã¶zetler.",
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
    doc.text("SÃ¼reÃ§ akÄ±ÅŸ gÃ¶rseli yÃ¼klenemedi.", 14, 70);
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
  drawSectionTitle(doc, "ANALÄ°Z EDÄ°LEN FOTOÄžRAFLAR", 14, 34, pageWidth - 28);
  drawWrappedText(
    doc,
    "Sahada tespit edilen risk maddelerine ait gÃ¶rseller aÅŸaÄŸÄ±da referans amacÄ±yla sunulmuÅŸtur. Bu bÃ¶lÃ¼m, bulgularÄ±n savunulabilirliÄŸini ve raporun saha kaynaÄŸÄ±nÄ± gÃ¼Ã§lendirir.",
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
    drawWrappedText(doc, item.hazard || "Tehlike aÃ§Ä±klamasÄ± yok", x + 3, y + 51, cardW - 6, {
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
  doc.text("RÄ°SK ANALÄ°Z TABLOSU", pageWidth / 2, 8.7, { align: "center" });
  setFont(doc, "normal");
  doc.setFontSize(7.5);
  doc.text(`${upperTr(companyName)} â€¢ Fine-Kinney Risk DeÄŸerlendirme Tablosu`, pageWidth / 2, 13.4, { align: "center" });

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
  doc.text(`Kabul Edilebilir / OlasÄ± KalÄ±ntÄ± Risk: ${stats.residualSafe}`, 103, 29);
  doc.text(`DeÄŸerlendirme Tarihi: ${format(new Date(args.assessment.assessment_date), "dd.MM.yyyy", { locale: tr })}`, pageWidth - 12, 29, {
    align: "right",
  });

  const tableData = args.riskItems.map((item, idx) => [
    String(idx + 1).padStart(2, "0"),
    item.department || "â€”",
    photoMap.has(item.id) ? " " : "â€”",
    item.hazard || "â€”",
    item.risk || "â€”",
    item.affected_people || "â€”",
    String(item.probability_1),
    String(item.frequency_1),
    String(item.severity_1),
    String(item.score_1),
    getRiskClassLabel(item.risk_class_1),
    item.proposed_controls || item.existing_controls || "â€”",
    String(item.probability_2 ?? 0),
    String(item.frequency_2 ?? 0),
    String(item.severity_2 ?? 0),
    String(item.score_2 ?? 0),
    getRiskClassLabel(item.risk_class_2 || "Kabul Edilebilir"),
    item.responsible_person || "â€”",
    item.deadline ? format(new Date(item.deadline), "dd.MM.yy", { locale: tr }) : "â€”",
  ]);

  autoTable(doc, {
    startY: 42,
    margin: { left: 8, right: 8, bottom: 16 },
    head: [["No", "BÃ¶lÃ¼m", "Foto", "Tehlike", "Risk", "Etkilenen", "O", "F", "Åž", "Skor", "SÄ±nÄ±f", "Ã–nlemler", "O", "F", "Åž", "Skor", "SÄ±nÄ±f", "Sorumlu", "Termin"]],
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

function addRiskTablePagesV2(doc: jsPDF, args: BuildRiskAssessmentPdfArgs, photoMap: Map<string, string>, logoDataUrl: string | null) {
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
  doc.text("RÄ°SK ANALÄ°Z TABLOSU", pageWidth / 2, 8.7, { align: "center" });
  setFont(doc, "normal");
  doc.setFontSize(7.5);
  doc.text(`${upperTr(companyName)} â€¢ Fine-Kinney Risk DeÄŸerlendirme Tablosu`, pageWidth / 2, 13.4, { align: "center" });

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
  doc.text(`Kabul Edilebilir / OlasÄ± KalÄ±ntÄ± Risk: ${stats.residualSafe}`, 103, 29);
  doc.text(`DeÄŸerlendirme Tarihi: ${formatTableDate(args.assessment.assessment_date)}`, pageWidth - 12, 29, { align: "right" });

  const tableData = args.riskItems.map((item, idx) => [
    String(idx + 1).padStart(2, "0"),
    item.department || "â€”",
    photoMap.has(item.id) ? " " : "â€”",
    item.hazard || "â€”",
    item.risk || "â€”",
    item.existing_controls || "â€”",
    item.affected_people || "â€”",
    String(item.probability_1),
    String(item.frequency_1),
    String(item.severity_1),
    String(item.score_1),
    getRiskClassLabel(item.risk_class_1),
    item.proposed_controls || "â€”",
    String(item.probability_2 ?? 0),
    String(item.frequency_2 ?? 0),
    String(item.severity_2 ?? 0),
    String(item.score_2 ?? 0),
    getRiskClassLabel(item.risk_class_2 || "Kabul Edilebilir"),
    formatTableDate(item.deadline),
    item.responsible_person || "â€”",
    formatTableDate(item.completion_date),
    item.completed_activity || (item.status === "completed" ? "Tamamlandı" : "—"),
  ]);

  autoTable(doc, {
    startY: 42,
    margin: { left: 8, right: 8, bottom: 16 },
    head: [[
      "No",
      "Faaliyet",
      "Foto",
      "Tehlike",
      "Risk",
      "Mevcut Durum",
      "OlasÄ± SonuÃ§",
      "O",
      "F",
      "Åž",
      "Skor",
      "Riskin TanÄ±mÄ±",
      "YapÄ±lmasÄ± Gereken DÃ–F",
      "O",
      "F",
      "Åž",
      "Skor",
      "Riskin TanÄ±mÄ±",
      "Termin SÃ¼resi",
      "Sorumlu",
      "GerÃ§ekleÅŸme Tarihi",
      "GerÃ§ekleÅŸen Faaliyetler",
    ]],
    body: tableData,
    theme: "grid",
    styles: {
      fontSize: 4.7,
      cellPadding: 0.9,
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
      fontSize: 5.4,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 16 },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 24 },
      4: { cellWidth: 25 },
      5: { cellWidth: 19 },
      6: { cellWidth: 16 },
      7: { cellWidth: 6, halign: "center" },
      8: { cellWidth: 6, halign: "center" },
      9: { cellWidth: 6, halign: "center" },
      10: { cellWidth: 8, halign: "center" },
      11: { cellWidth: 13, halign: "center" },
      12: { cellWidth: 28 },
      13: { cellWidth: 6, halign: "center" },
      14: { cellWidth: 6, halign: "center" },
      15: { cellWidth: 6, halign: "center" },
      16: { cellWidth: 8, halign: "center" },
      17: { cellWidth: 13, halign: "center" },
      18: { cellWidth: 14, halign: "center" },
      19: { cellWidth: 15 },
      20: { cellWidth: 14, halign: "center" },
      21: { cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section !== "head") return;
      if (data.column.index >= 7 && data.column.index <= 11) {
        data.cell.styles.fillColor = [127, 29, 29];
      }
      if (data.column.index >= 13 && data.column.index <= 17) {
        data.cell.styles.fillColor = [20, 83, 45];
      }
      if (data.column.index >= 18 && data.column.index <= 21) {
        data.cell.styles.fillColor = [30, 41, 59];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 2) return;
      const riskItem = args.riskItems[data.row.index];
      const imageData = riskItem ? photoMap.get(riskItem.id) : null;
      if (!imageData) return;
      const size = Math.min(data.cell.width - 3, data.cell.height - 3, 10);
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;
      doc.addImage(imageData, getImageFormat(imageData), x, y, size, size, undefined, "FAST");
    },
  });
}

function addPageFooters(doc: jsPDF, companyName: string) {
  const totalPages = doc.getNumberOfPages();
  const roles = ["Ä°Åž GÃœVENLÄ°ÄžÄ° UZMANI", "Ä°ÅžYERÄ° HEKÄ°MÄ°", "Ã‡ALIÅžAN TEM.", "DESTEK ELEMANI","Ä°ÅžVEREN/VEKÄ°LÄ°"];

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
  const originalText = doc.text.bind(doc);
  doc.text = ((text: string | string[], ...args: unknown[]) => {
    const normalizedText = Array.isArray(text) ? text.map((line) => normalizePdfText(String(line))) : normalizePdfText(String(text));
    return (originalText as (...innerArgs: unknown[]) => jsPDF)(normalizedText, ...args);
  }) as typeof doc.text;

  const logoDataUrl = await args.loadImageAsDataUrl(
    args.assessment.risk_assessment_logo_data_url || args.company?.logo_url
  );

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

  drawCoverPageV2(doc, args, logoDataUrl);
  doc.addPage("a4", "portrait");
  addIntroPages(doc, args);
  addTeamPage(doc, args);
  await addFineKinneyReferencePage(doc, args);
  await addProcessFlowPage(doc, args);
  addPhotoGalleryPage(doc, photoItems);
  addRiskTablePagesV2(doc, args, photoMap, logoDataUrl);
  addPageFooters(doc, args.company?.name?.trim() || "Firma");

  return doc;
}
