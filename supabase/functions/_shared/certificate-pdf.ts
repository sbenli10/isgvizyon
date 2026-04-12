import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";
import { INTER_BOLD_BASE64, INTER_REGULAR_BASE64 } from "../../../src/utils/fonts.ts";
import { buildCertificateNumber, buildVerificationUrl, createServiceClient, sanitizeFileName, type CertificateParticipant, type CertificateRecord } from "./certificate-utils.ts";

const assetCache = new Map<string, Uint8Array>();
const FONT_REGULAR_KEY = "inter-regular-base64";
const FONT_BOLD_KEY = "inter-bold-base64";

function normalizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function hexToRgbColor(value: unknown, fallback: { r: number; g: number; b: number }) {
  const input = typeof value === "string" ? value.trim() : "";
  if (!/^#?[0-9a-fA-F]{6}$/.test(input)) {
    return rgb(fallback.r, fallback.g, fallback.b);
  }
  const normalized = input.replace(/^#/, "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function normalizeDesignConfig(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawSignatures = Array.isArray(source.signatures) ? source.signatures as Array<Record<string, unknown>> : [];
  return {
    primaryColor: hexToRgbColor(source.primaryColor, { r: 0.83, g: 0.69, b: 0.22 }),
    secondaryColor: hexToRgbColor(source.secondaryColor, { r: 0.16, g: 0.3, b: 0.46 }),
    showBadge: typeof source.showBadge === "boolean" ? source.showBadge : true,
    showSeal: typeof source.showSeal === "boolean" ? source.showSeal : true,
    titleText: normalizeText(source.titleText),
    descriptionText: normalizeText(source.descriptionText),
    osgbLogoUrl: normalizeText(source.osgb_logo_url),
    signatureCount: Math.min(4, Math.max(1, Number(source.signatureCount || 4))),
    signatures: rawSignatures.slice(0, 4).map((signature) => ({
      name: normalizeText(signature.name),
      title: normalizeText(signature.title),
      imageUrl: normalizeText(signature.image_url),
    })),
  };
}

function resolveDescriptionText(templateType: string, customText: string | null, participantName: string, companyLabel: string, trainingName: string, trainingDate: string, trainingDuration: string) {
  const fallback = templateType === "academy"
    ? `${participantName}, çalışanların iş sağlığı ve güvenliği eğitimlerine ilişkin program kapsamında verilen eğitimi başarıyla tamamlayarak bu belgeyi almaya hak kazanmıştır.`
    : templateType === "compliance"
      ? `${participantName}, mevzuata uygun olarak planlanan eğitimi başarıyla tamamlamış olup bu belge resmi kayıt ve doğrulama amacıyla düzenlenmiştir.`
      : `${participantName}, ${companyLabel || "kurum"} tarafından düzenlenen ${trainingName || "eğitim"} programını başarıyla tamamlamıştır.`;

  const template = customText || fallback;
  return template
    .replaceAll("{name}", participantName)
    .replaceAll("{company}", companyLabel || "Kurum")
    .replaceAll("{training}", trainingName || "Eğitim")
    .replaceAll("{date}", trainingDate || "-")
    .replaceAll("{duration}", trainingDuration || "-");
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getFontBytes(cacheKey: string, base64: string) {
  if (assetCache.has(cacheKey)) return assetCache.get(cacheKey)!;
  const bytes = base64ToUint8Array(base64);
  assetCache.set(cacheKey, bytes);
  return bytes;
}

async function fetchLogoBytes(logoUrl?: string | null) {
  if (!logoUrl) return null;
  if (assetCache.has(logoUrl)) return assetCache.get(logoUrl)!;

  try {
    if (!/^https?:\/\//i.test(logoUrl)) {
      const supabase = createServiceClient();
      const companyLogoDownload = await supabase.storage.from("company-logos").download(logoUrl);
      if (!companyLogoDownload.error && companyLogoDownload.data) {
        const bytes = new Uint8Array(await companyLogoDownload.data.arrayBuffer());
        assetCache.set(logoUrl, bytes);
        return bytes;
      }

      const certificateLogoDownload = await supabase.storage.from("certificate-files").download(logoUrl);
      if (certificateLogoDownload.error || !certificateLogoDownload.data) {
        console.error("certificate pdf logo storage download failed", {
          logoUrl,
          companyLogoError: companyLogoDownload.error,
          certificateLogoError: certificateLogoDownload.error,
        });
        return null;
      }
      const bytes = new Uint8Array(await certificateLogoDownload.data.arrayBuffer());
      assetCache.set(logoUrl, bytes);
      return bytes;
    }

    const response = await fetch(logoUrl);
    if (!response.ok) {
      console.error("certificate pdf logo fetch failed", { logoUrl, status: response.status });
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    assetCache.set(logoUrl, bytes);
    return bytes;
  } catch (error) {
    console.error("certificate pdf logo fetch error", { logoUrl, error: error instanceof Error ? error.message : error });
    return null;
  }
}

async function loadFonts(pdfDoc: PDFDocument) {
  try {
    pdfDoc.registerFontkit(fontkit);

    const [regularBytes, boldBytes] = await Promise.all([
      getFontBytes(FONT_REGULAR_KEY, INTER_REGULAR_BASE64),
      getFontBytes(FONT_BOLD_KEY, INTER_BOLD_BASE64),
    ]);

    console.log("certificate pdf fonts ready", {
      regularBytes: regularBytes.length,
      boldBytes: boldBytes.length,
      source: "embedded-base64",
    });

    const [bodyFont, titleFont] = await Promise.all([
      pdfDoc.embedFont(regularBytes),
      pdfDoc.embedFont(boldBytes),
    ]);

    return { bodyFont, titleFont };
  } catch (error) {
    console.error("certificate pdf font load failed", error);
    throw new Error(`Sertifika fontları yüklenemedi: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
  }
}

function frameColor(style: string) {
  if (style === "blue") return rgb(0.12, 0.33, 0.71);
  if (style === "green") return rgb(0.08, 0.45, 0.28);
  return rgb(0.72, 0.56, 0.17);
}

function drawHeader(page: any, titleFont: any, primary: any, certificate: CertificateRecord, participantName: string) {
  page.drawText("EĞİTİM SERTİFİKASI", { x: 230, y: 520, size: 26, font: titleFont, color: primary });
  page.drawText(normalizeText(certificate.certificate_type, "KATILIM").toUpperCase(), { x: 330, y: 490, size: 12, font: titleFont, color: primary });
  page.drawText(participantName, { x: 150, y: 410, size: 30, font: titleFont, color: rgb(0.08, 0.08, 0.08) });
}

async function drawLogo(pdfDoc: any, page: any, logoUrl?: string | null, x = 50, y = 470) {
  const logoBytes = await fetchLogoBytes(logoUrl);
  if (!logoBytes) return;
  try {
    const lowerUrl = logoUrl?.toLowerCase() || "";
    const logo = lowerUrl.includes("png") ? await pdfDoc.embedPng(logoBytes) : await pdfDoc.embedJpg(logoBytes);
    page.drawImage(logo, { x, y, width: 90, height: 70 });
  } catch (error) {
    console.error("certificate pdf logo embed failed", { logoUrl, error: error instanceof Error ? error.message : error });
  }
}

async function drawImageAsset(pdfDoc: any, page: any, assetUrl: string | null | undefined, options: { x: number; y: number; width: number; height: number }) {
  if (!assetUrl) return;
  const assetBytes = await fetchLogoBytes(assetUrl);
  if (!assetBytes) return;
  try {
    const lowerUrl = assetUrl.toLowerCase();
    const asset = lowerUrl.includes("png") ? await pdfDoc.embedPng(assetBytes) : await pdfDoc.embedJpg(assetBytes);
    page.drawImage(asset, options);
  } catch (error) {
    console.error("certificate pdf asset embed failed", { assetUrl, error: error instanceof Error ? error.message : error });
  }
}

function drawQr(page: any, bodyFont: any, verificationCode?: string | null, x = 680, y = 55) {
  if (!verificationCode) return;

  const verificationUrl = buildVerificationUrl(verificationCode);
  const qr = qrcode(0, "M");
  qr.addData(verificationUrl);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const qrSize = 90;
  const quietZone = 4;
  const cellSize = qrSize / (moduleCount + quietZone * 2);

  page.drawRectangle({
    x,
    y,
    width: qrSize,
    height: qrSize,
    color: rgb(1, 1, 1),
  });

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) continue;
      page.drawRectangle({
        x: x + (col + quietZone) * cellSize,
        y: y + qrSize - (row + quietZone + 1) * cellSize,
        width: cellSize,
        height: cellSize,
        color: rgb(0.05, 0.05, 0.05),
      });
    }
  }

  page.drawText("QR ile doğrula", { x: x - 4, y: y - 14, size: 9, font: bodyFont, color: rgb(0.3, 0.3, 0.3) });
}

function drawClassicTheme(page: any, primary: any, width: number, height: number) {
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderWidth: 5, borderColor: primary });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderWidth: 1.5, borderColor: primary });
  page.drawRectangle({ x: 46, y: 46, width: width - 92, height: height - 92, borderWidth: 0.5, borderColor: rgb(0.86, 0.82, 0.68) });
  page.drawRectangle({ x: 55, y: 505, width: width - 110, height: 46, color: rgb(0.95, 0.92, 0.84), opacity: 0.7 });
}

function drawModernTheme(page: any, primary: any, width: number, height: number) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.07, 0.11, 0.2) });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderWidth: 2, borderColor: primary });
  page.drawRectangle({ x: 24, y: 450, width: width - 48, height: 121, color: rgb(0.09, 0.18, 0.33), opacity: 0.92 });
  page.drawCircle({ x: 760, y: 530, size: 120, color: rgb(0.14, 0.38, 0.56), opacity: 0.25 });
  page.drawCircle({ x: 720, y: 70, size: 100, color: rgb(0.08, 0.7, 0.75), opacity: 0.15 });
}

function drawMinimalTheme(page: any, primary: any, width: number, height: number) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.985, 0.98) });
  page.drawRectangle({ x: 50, y: 60, width: width - 100, height: height - 120, borderWidth: 1.5, borderColor: rgb(0.8, 0.82, 0.86) });
  page.drawRectangle({ x: 70, y: 495, width: 220, height: 6, color: primary });
}

function drawAcademyTheme(page: any, primary: any, width: number, height: number, showSeal = true) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.96, 0.96, 0.94) });
  page.drawRectangle({ x: 12, y: 12, width: width - 24, height: height - 24, borderWidth: 6, borderColor: rgb(0.75, 0.8, 0.17) });
  page.drawRectangle({ x: 0, y: 430, width, height: 165, color: rgb(0.16, 0.3, 0.46) });
  page.drawLine({ start: { x: 0, y: 430 }, end: { x: width, y: 505 }, thickness: 4, color: primary });
  page.drawRectangle({ x: 0, y: 0, width, height, borderWidth: 1, borderColor: rgb(0.86, 0.88, 0.9), opacity: 0.5 });
  if (showSeal) {
    page.drawCircle({ x: 150, y: 445, size: 42, color: rgb(0.18, 0.16, 0.14) });
    page.drawCircle({ x: 150, y: 445, size: 48, borderWidth: 6, borderColor: primary });
  }
}

function drawExecutiveTheme(page: any, primary: any, width: number, height: number) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.975, 0.95) });
  page.drawRectangle({ x: 26, y: 26, width: width - 52, height: height - 52, borderWidth: 2, borderColor: rgb(0.47, 0.37, 0.14) });
  page.drawRectangle({ x: 40, y: 40, width: width - 80, height: height - 80, borderWidth: 0.7, borderColor: rgb(0.83, 0.75, 0.55) });
  page.drawRectangle({ x: 60, y: 502, width: width - 120, height: 22, color: rgb(0.35, 0.28, 0.12), opacity: 0.08 });
  page.drawRectangle({ x: 60, y: 82, width: width - 120, height: 22, color: rgb(0.35, 0.28, 0.12), opacity: 0.05 });
}

function drawComplianceTheme(page: any, primary: any, width: number, height: number) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.97, 0.985, 0.975) });
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderWidth: 4, borderColor: rgb(0.1, 0.42, 0.28) });
  page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderWidth: 1, borderColor: rgb(0.52, 0.65, 0.58) });
  page.drawRectangle({ x: 36, y: 486, width: width - 72, height: 54, color: rgb(0.12, 0.38, 0.28), opacity: 0.92 });
  page.drawRectangle({ x: 80, y: 118, width: 220, height: 132, borderWidth: 1, borderColor: rgb(0.7, 0.8, 0.74), color: rgb(1, 1, 1), opacity: 0.85 });
}

function drawDetails(page: any, titleFont: any, bodyFont: any, primary: any, certificate: CertificateRecord, participant: CertificateParticipant, certificateNumber: string, companyLabel: string, isDark = false) {
  const trainerNames = normalizeStringArray(certificate.trainer_names);
  const details = [
    ["Katılımcı", normalizeText(participant.name, "Katılımcı")],
    ["Görev", normalizeText(participant.job_title, "Belirtilmedi")],
    ["Eğitim", normalizeText(certificate.training_name, "Eğitim Bilgisi Girilmedi")],
    ["Tarih", normalizeText(certificate.training_date, "Belirtilmedi")],
    ["Süre", normalizeText(certificate.training_duration, "Belirtilmedi")],
    ["Geçerlilik", normalizeText(certificate.validity_date, "Süresiz")],
    ["Sertifika No", normalizeText(certificateNumber, "Belirtilmedi")],
  ];

  let lineY = 308;
  for (const [label, value] of details) {
    page.drawText(`${label}:`, { x: 118, y: lineY, size: 12, font: titleFont, color: primary });
    page.drawText(value, { x: 245, y: lineY, size: 12, font: bodyFont, color: isDark ? rgb(0.92, 0.95, 0.99) : rgb(0.15, 0.15, 0.15) });
    lineY -= 24;
  }

  page.drawText(`Firma: ${normalizeText(companyLabel, "Firma Bilgisi Girilmedi")}`, { x: 118, y: 120, size: 12, font: bodyFont, color: isDark ? rgb(0.92, 0.95, 0.99) : rgb(0.15, 0.15, 0.15) });
  page.drawText(`Adres: ${normalizeText(certificate.company_address, "Belirtilmedi")}`, { x: 118, y: 100, size: 11, font: bodyFont, color: isDark ? rgb(0.82, 0.86, 0.91) : rgb(0.2, 0.2, 0.2), maxWidth: 520 });
  page.drawText(`Eğitmenler: ${trainerNames.join(", ") || "Belirtilmedi"}`, { x: 118, y: 80, size: 11, font: bodyFont, color: isDark ? rgb(0.82, 0.86, 0.91) : rgb(0.2, 0.2, 0.2), maxWidth: 520 });
}

function parseCurriculumColumns(notes?: string | null) {
  const items = normalizeText(notes)
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return { hasCurriculum: false, left: [] as string[], right: [] as string[] };
  }

  const midpoint = Math.ceil(items.length / 2);
  return {
    hasCurriculum: true,
    left: items.slice(0, midpoint),
    right: items.slice(midpoint),
  };
}

function drawCurriculumPanel(page: any, titleFont: any, bodyFont: any, options: {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  left: string[];
  right: string[];
  dark?: boolean;
  accent?: { r: number; g: number; b: number };
}) {
  const accent = options.accent ? rgb(options.accent.r, options.accent.g, options.accent.b) : rgb(0.2, 0.36, 0.28);
  const dark = Boolean(options.dark);
  page.drawRectangle({
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    borderWidth: 1,
    borderColor: dark ? rgb(0.45, 0.5, 0.58) : rgb(0.78, 0.82, 0.8),
    color: dark ? rgb(0.09, 0.14, 0.22) : rgb(1, 1, 1),
    opacity: dark ? 0.24 : 0.88,
  });
  page.drawText(options.title, {
    x: options.x + 14,
    y: options.y + options.height - 18,
    size: 11,
    font: titleFont,
    color: accent,
  });
  let leftY = options.y + options.height - 38;
  for (const item of options.left) {
    page.drawText(`• ${item}`, {
      x: options.x + 14,
      y: leftY,
      size: 8.8,
      font: bodyFont,
      color: dark ? rgb(0.9, 0.94, 1) : rgb(0.25, 0.25, 0.25),
      maxWidth: options.width / 2 - 24,
      lineHeight: 10.5,
    });
    leftY -= 12;
  }

  let rightY = options.y + options.height - 38;
  for (const item of options.right) {
    page.drawText(`• ${item}`, {
      x: options.x + options.width / 2 + 4,
      y: rightY,
      size: 8.8,
      font: bodyFont,
      color: dark ? rgb(0.9, 0.94, 1) : rgb(0.25, 0.25, 0.25),
      maxWidth: options.width / 2 - 20,
      lineHeight: 10.5,
    });
    rightY -= 12;
  }
}

function drawSignatureGrid(page: any, bodyFont: any, signatures: Array<{ label: string; subtitle?: string }>, y = 72) {
  const startX = 94;
  const blockWidth = 150;
  const gap = 28;
  signatures.forEach((signature, index) => {
    const x = startX + index * (blockWidth + gap);
    page.drawLine({
      start: { x, y },
      end: { x: x + blockWidth, y },
      thickness: 1,
      color: rgb(0.32, 0.32, 0.32),
    });
    page.drawText(signature.label, {
      x: x + 12,
      y: y - 18,
      size: 10,
      font: bodyFont,
      color: rgb(0.22, 0.22, 0.22),
    });
    if (signature.subtitle) {
      page.drawText(signature.subtitle, {
        x: x + 12,
        y: y - 31,
        size: 8.5,
        font: bodyFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  });
}

async function drawSignatureAssets(pdfDoc: any, page: any, signatures: Array<{ imageUrl?: string | null }>, y = 84) {
  const startX = 94;
  const blockWidth = 150;
  const gap = 28;
  for (let index = 0; index < signatures.length; index += 1) {
    const imageUrl = signatures[index]?.imageUrl;
    if (!imageUrl) continue;
    const x = startX + index * (blockWidth + gap) + 20;
    await drawImageAsset(pdfDoc, page, imageUrl, { x, y, width: 110, height: 34 });
  }
}

export async function generateCertificatePdf(options: {
  certificate: CertificateRecord;
  participant: CertificateParticipant;
  participantIndex: number;
  companyLabel: string;
}) {
  try {
    const { certificate, participant, participantIndex, companyLabel } = options;
    const participantName = normalizeText(participant.name, "Katılımcı");
    const normalizedTrainingName = normalizeText(certificate.training_name, "egitim");
    const pdfDoc = await PDFDocument.create();
    const { bodyFont, titleFont } = await loadFonts(pdfDoc);
    const page = pdfDoc.addPage([842, 595]);
    const { width, height } = page.getSize();
    const design = normalizeDesignConfig(certificate.design_config);
    const primary = design.primaryColor;
    const certificateNumber = normalizeText(participant.certificate_no) || buildCertificateNumber(certificate.id, participantIndex);
    const curriculum = parseCurriculumColumns(certificate.notes);
    const resolvedDescription = resolveDescriptionText(
      certificate.template_type,
      design.descriptionText,
      participantName,
      normalizeText(companyLabel, "Kurum"),
      normalizedTrainingName,
      normalizeText(certificate.training_date, "-"),
      normalizeText(certificate.training_duration, "-"),
    );

    if (certificate.template_type === "academy") {
      drawAcademyTheme(page, primary, width, height, design.showSeal);
      await drawLogo(pdfDoc, page, certificate.logo_url, 626, 490);
      await drawImageAsset(pdfDoc, page, design.osgbLogoUrl, { x: 624, y: 440, width: 140, height: 42 });
      page.drawText(normalizeText(companyLabel, "Firma Logo"), {
        x: 540,
        y: 540,
        size: 30,
        font: titleFont,
        color: design.primaryColor,
      });
      if (design.showBadge) {
        page.drawText("RESMİ EĞİTİM BELGESİ", { x: 96, y: 548, size: 12, font: bodyFont, color: design.primaryColor });
      }
      page.drawText(design.titleText || "Temel Eğitim Sertifikası", { x: 204, y: 418, size: 31, font: titleFont, color: rgb(0.12, 0.12, 0.12) });
      page.drawLine({ start: { x: 205, y: 388 }, end: { x: 656, y: 388 }, thickness: 1.9, color: rgb(0.16, 0.16, 0.16) });
      page.drawText(resolvedDescription, { x: 74, y: 324, size: 12.5, font: bodyFont, color: rgb(0.22, 0.22, 0.22), maxWidth: 690, lineHeight: 17 });
      page.drawText(`Katılımcı ve TCKN No : ${participantName} / ${normalizeText(participant.tc_no, "Belirtilmedi")}`, { x: 76, y: 266, size: 11.5, font: titleFont, color: rgb(0.22, 0.22, 0.22) });
      page.drawText(`İşyeri Görev Tanımı : ${normalizeText(participant.job_title, "Belirtilmedi")}`, { x: 76, y: 246, size: 11.5, font: bodyFont, color: rgb(0.28, 0.28, 0.28) });
      page.drawText(`Eğitim Tamamlama Tarihi : ${normalizeText(certificate.training_date, "Belirtilmedi")}`, { x: 76, y: 226, size: 11.5, font: bodyFont, color: rgb(0.28, 0.28, 0.28) });
      page.drawText(`Toplam Kurs Süresi : ${normalizeText(certificate.training_duration, "Belirtilmedi")}`, { x: 76, y: 206, size: 11.5, font: bodyFont, color: rgb(0.28, 0.28, 0.28) });
      if (curriculum.hasCurriculum) {
        drawCurriculumPanel(page, titleFont, bodyFont, {
          x: 74,
          y: 64,
          width: 244,
          height: 118,
          title: "Eğitim Konuları",
          left: curriculum.left,
          right: curriculum.right,
          accent: { r: 0.18, g: 0.32, b: 0.28 },
        });
      }
      page.drawText(normalizeText(companyLabel, "Firma & OSGB"), { x: 462, y: 166, size: 20, font: titleFont, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(`Kurs No : ${certificateNumber}`, { x: 76, y: 48, size: 9.5, font: bodyFont, color: rgb(0.25, 0.25, 0.25) });
      drawSignatureGrid(page, bodyFont, design.signatures.slice(0, design.signatureCount).map((signature, index) => ({
        label: signature.name || (index === 2 ? normalizeText(companyLabel, "Firma Yetkilisi") : "Ad Soyad"),
        subtitle: signature.title || (index === 0 ? "İSG Uzmanı" : index === 1 ? "İşyeri Hekimi" : index === 2 ? "İşveren Vekili" : "Düzenleyen Kurum"),
      })));
      await drawSignatureAssets(pdfDoc, page, design.signatures.slice(0, design.signatureCount));
    } else if (certificate.template_type === "executive") {
      drawExecutiveTheme(page, primary, width, height);
      await drawLogo(pdfDoc, page, certificate.logo_url, 630, 470);
      page.drawText(design.titleText || "KURUMSAL BAŞARI SERTİFİKASI", { x: 180, y: 495, size: 24, font: titleFont, color: rgb(0.35, 0.28, 0.12) });
      page.drawText(participantName, { x: 150, y: 410, size: 34, font: titleFont, color: rgb(0.12, 0.11, 0.09) });
      page.drawText(resolvedDescription, { x: 118, y: 372, size: 13.5, font: bodyFont, color: rgb(0.25, 0.22, 0.18), maxWidth: 610 });
      drawDetails(page, titleFont, bodyFont, rgb(0.55, 0.42, 0.12), certificate, participant, certificateNumber, companyLabel, false);
      await drawImageAsset(pdfDoc, page, design.osgbLogoUrl, { x: 626, y: 420, width: 130, height: 40 });
      if (curriculum.hasCurriculum) {
        drawCurriculumPanel(page, titleFont, bodyFont, {
          x: 520,
          y: 124,
          width: 246,
          height: 116,
          title: "Eğitim Konuları",
          left: curriculum.left,
          right: curriculum.right,
          accent: { r: 0.55, g: 0.42, b: 0.12 },
        });
      }
    } else if (certificate.template_type === "compliance") {
      drawComplianceTheme(page, primary, width, height);
      await drawLogo(pdfDoc, page, certificate.logo_url, 650, 495);
      page.drawText(design.titleText || "İŞ SAĞLIĞI VE GÜVENLİĞİ EĞİTİM SERTİFİKASI", { x: 86, y: 505, size: 20, font: titleFont, color: rgb(0.95, 0.98, 0.96) });
      page.drawText(participantName, { x: 98, y: 430, size: 28, font: titleFont, color: rgb(0.12, 0.2, 0.18) });
      page.drawText(resolvedDescription, { x: 98, y: 394, size: 12.5, font: bodyFont, color: rgb(0.2, 0.24, 0.22), maxWidth: 620 });
      drawDetails(page, titleFont, bodyFont, rgb(0.12, 0.38, 0.28), certificate, participant, certificateNumber, companyLabel, false);
      if (curriculum.hasCurriculum) {
        drawCurriculumPanel(page, titleFont, bodyFont, {
          x: 82,
          y: 108,
          width: 250,
          height: 142,
          title: "Eğitim İçerik Listesi",
          left: curriculum.left,
          right: curriculum.right,
          accent: { r: 0.1, g: 0.34, b: 0.25 },
        });
      } else {
        page.drawText("Uyum Notu", { x: 96, y: 232, size: 12, font: titleFont, color: rgb(0.1, 0.34, 0.25) });
        page.drawText(
          "Belge, çalışanların İSG eğitimlerine ilişkin resmi kayıt ve doğrulama amacıyla düzenlenmiştir.",
          { x: 96, y: 214, size: 9.5, font: bodyFont, color: rgb(0.25, 0.29, 0.27), maxWidth: 188, lineHeight: 12 }
        );
      }
      drawSignatureGrid(page, bodyFont, design.signatures.slice(0, design.signatureCount).map((signature, index) => ({
        label: signature.name || (index === 2 ? normalizeText(companyLabel, "Firma Yetkilisi") : "Ad Soyad"),
        subtitle: signature.title || (index === 0 ? "İSG Uzmanı" : index === 1 ? "İşyeri Hekimi" : index === 2 ? "İşveren Vekili" : "OSGB Yetkilisi"),
      })), 84);
      await drawSignatureAssets(pdfDoc, page, design.signatures.slice(0, design.signatureCount), 96);
    } else if (certificate.template_type === "modern") {
      drawModernTheme(page, primary, width, height);
      await drawLogo(pdfDoc, page, certificate.logo_url, 56, 480);
      page.drawText("Kurumsal Eğitim Programı", { x: 120, y: 545, size: 12, font: bodyFont, color: rgb(0.8, 0.9, 0.98) });
      page.drawText(design.titleText || "EĞİTİM SERTİFİKASI", { x: 220, y: 500, size: 26, font: titleFont, color: rgb(0.95, 0.98, 1) });
      page.drawText(participantName, { x: 150, y: 410, size: 30, font: titleFont, color: rgb(1, 1, 1) });
      page.drawText(resolvedDescription, { x: 100, y: 365, size: 14, font: bodyFont, color: rgb(0.86, 0.9, 0.97), maxWidth: 650 });
      drawDetails(page, titleFont, bodyFont, rgb(0.45, 0.85, 0.96), certificate, participant, certificateNumber, companyLabel, true);
      await drawImageAsset(pdfDoc, page, design.osgbLogoUrl, { x: 628, y: 440, width: 124, height: 38 });
      if (curriculum.hasCurriculum) {
        drawCurriculumPanel(page, titleFont, bodyFont, {
          x: 528,
          y: 122,
          width: 236,
          height: 118,
          title: "Eğitim Konuları",
          left: curriculum.left,
          right: curriculum.right,
          dark: true,
          accent: { r: 0.45, g: 0.85, b: 0.96 },
        });
      }
    } else if (certificate.template_type === "minimal") {
      drawMinimalTheme(page, primary, width, height);
      await drawLogo(pdfDoc, page, certificate.logo_url, 675, 485);
      page.drawText(design.titleText || "Katılım Sertifikası", { x: 70, y: 530, size: 13, font: bodyFont, color: rgb(0.38, 0.42, 0.48) });
      page.drawText(participantName, { x: 70, y: 420, size: 32, font: titleFont, color: rgb(0.07, 0.11, 0.15) });
      page.drawText(normalizedTrainingName, { x: 70, y: 385, size: 16, font: titleFont, color: primary });
      page.drawText(resolvedDescription, { x: 70, y: 355, size: 13, font: bodyFont, color: rgb(0.28, 0.31, 0.35), maxWidth: 640 });
      drawDetails(page, titleFont, bodyFont, primary, certificate, participant, certificateNumber, companyLabel, false);
      if (curriculum.hasCurriculum) {
        drawCurriculumPanel(page, titleFont, bodyFont, {
          x: 518,
          y: 126,
          width: 248,
          height: 110,
          title: "Eğitim Konuları",
          left: curriculum.left,
          right: curriculum.right,
          accent: { r: 0.42, g: 0.42, b: 0.42 },
        });
      }
    } else {
      drawClassicTheme(page, primary, width, height);
      await drawLogo(pdfDoc, page, certificate.logo_url, 62, 470);
      page.drawText(design.titleText || "KURUMSAL EĞİTİM BELGESİ", { x: 276, y: 530, size: 13, font: bodyFont, color: rgb(0.42, 0.34, 0.11) });
      drawHeader(page, titleFont, primary, certificate, participantName);
      page.drawText(resolvedDescription, { x: 100, y: 360, size: 14, font: bodyFont, color: rgb(0.2, 0.2, 0.2), maxWidth: 640 });
      drawDetails(page, titleFont, bodyFont, primary, certificate, participant, certificateNumber, companyLabel, false);
      await drawImageAsset(pdfDoc, page, design.osgbLogoUrl, { x: 630, y: 438, width: 126, height: 38 });
      if (curriculum.hasCurriculum) {
        drawCurriculumPanel(page, titleFont, bodyFont, {
          x: 516,
          y: 124,
          width: 250,
          height: 116,
          title: "Eğitim Konuları",
          left: curriculum.left,
          right: curriculum.right,
          accent: { r: 0.55, g: 0.42, b: 0.12 },
        });
      }
    }

    drawQr(page, bodyFont, normalizeText(participant.verification_code));
    page.drawText("Doğrulama: QR kodu okutun veya doğrulama sayfasını ziyaret edin.", { x: 520, y: 34, size: 8, font: bodyFont, color: certificate.template_type === "modern" ? rgb(0.88, 0.94, 1) : rgb(0.35, 0.35, 0.35) });
    if (!["academy", "compliance"].includes(certificate.template_type || "")) {
      page.drawLine({ start: { x: 120, y: 60 }, end: { x: 300, y: 60 }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
      page.drawLine({ start: { x: 500, y: 60 }, end: { x: 680, y: 60 }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
      page.drawText("Eğitmen İmzası", { x: 155, y: 42, size: 10, font: bodyFont, color: certificate.template_type === "modern" ? rgb(0.88, 0.94, 1) : rgb(0.25, 0.25, 0.25) });
      page.drawText("Firma Yetkilisi", { x: 540, y: 42, size: 10, font: bodyFont, color: certificate.template_type === "modern" ? rgb(0.88, 0.94, 1) : rgb(0.25, 0.25, 0.25) });
    }

    return {
      bytes: await pdfDoc.save(),
      certificateNumber,
      fileName: `${sanitizeFileName(participantName)}-${sanitizeFileName(normalizedTrainingName)}.pdf`,
    };
  } catch (error) {
    console.error("generateCertificatePdf failed", {
      certificateId: options.certificate.id,
      participantId: options.participant.id,
      participantName: options.participant.name,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

