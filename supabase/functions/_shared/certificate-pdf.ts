import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";
import { INTER_BOLD_BASE64, INTER_REGULAR_BASE64 } from "../../../src/utils/fonts.ts";
import { buildCertificateNumber, buildVerificationUrl, createServiceClient, sanitizeFileName, type CertificateParticipant, type CertificateRecord } from "./certificate-utils.ts";

const assetCache = new Map<string, Uint8Array>();
const FONT_REGULAR_KEY = "inter-regular-base64";
const FONT_BOLD_KEY = "inter-bold-base64";
let didLogEmbeddedFonts = false;

type PdfFont = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

type PdfColor = ReturnType<typeof rgb>;

type CertificateRenderData = {
  participantName: string;
  role: string;
  trainingTitle: string;
  date: string;
  duration: string;
  validity: string;
  certificateNo: string;
  companyName: string;
  address: string;
  trainers: string[];
  trainingTopics: string[];
  verificationCode: string;
  issueDate: string;
  qrValue: string;
  summaryText: string;
  templateType: string;
  certificateType: string;
  logoUrl: string;
  design: NormalizedDesignConfig;
};

type NormalizedDesignConfig = {
  primaryColor: PdfColor;
  secondaryColor: PdfColor;
  showBadge: boolean;
  showSeal: boolean;
  titleText: string;
  descriptionText: string;
  osgbLogoUrl: string;
  signatureCount: number;
  signatures: Array<{
    name: string;
    title: string;
    imageUrl: string;
  }>;
};

type InfoRow = {
  label: string;
  value: string;
  highlight?: boolean;
  maxLines?: number;
};

const CERT_LAYOUT = {
  page: { width: 842, height: 595, padding: 28 },
  frame: { outerInset: 14, middleInset: 28, innerInset: 42 },
  header: {
    logo: { x: 58, y: 486, width: 78, height: 54 },
    secondaryLogo: { x: 704, y: 492, width: 78, height: 36 },
    centerX: 421,
    width: 520,
    companyTopY: 522,
    unitTopY: 488,
    titleTopY: 458,
  },
  leftInfo: {
    x: 88,
    topY: 386,
    minY: 203,
    labelWidth: 92,
    colonWidth: 12,
    valueWidth: 252,
    rowGap: 4,
    lineHeight: 11.8,
    fontSize: 9.7,
    labelSize: 9.8,
    minRowHeight: 14.8,
  },
  summaryBox: {
    x: 438,
    y: 252,
    width: 326,
    minHeight: 126,
    maxHeight: 142,
    padding: 18,
    lineHeight: 13.8,
    fontSize: 10.8,
    minFontSize: 9.3,
  },
  topicsBox: {
    x: 76,
    y: 86,
    width: 326,
    height: 104,
    padding: 13,
    lineHeight: 8.7,
    fontSize: 7.3,
  },
  footer: {
    y: 42,
    dividerY: 68,
    leftX: 78,
    leftWidth: 210,
    signatureX: 432,
    signatureWidth: 104,
    signatureGap: 30,
  },
  qr: {
    x: 686,
    y: 72,
    size: 78,
    labelGap: 13,
    textWidth: 122,
  },
} as const;

function normalizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.map((item) => normalizeText(item)).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeDateText(value: unknown, fallback = "") {
  const raw = normalizeText(value);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}/.test(raw)) {
    return parsed.toLocaleDateString("tr-TR");
  }
  return raw;
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

function normalizeDesignConfig(value: unknown): NormalizedDesignConfig {
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
    signatureCount: Math.min(4, Math.max(1, Number(source.signatureCount || 2))),
    signatures: rawSignatures.slice(0, 4).map((signature) => ({
      name: normalizeText(signature.name),
      title: normalizeText(signature.title),
      imageUrl: normalizeText(signature.image_url),
    })),
  };
}

function parseTrainingTopics(notes?: string | null) {
  const items = normalizeText(notes)
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : ["Konu bilgisi bulunmamaktadır."];
}

function resolveDescriptionText(
  templateType: string,
  customText: string | null,
  participantName: string,
  companyLabel: string,
  trainingName: string,
  trainingDate: string,
  trainingDuration: string,
) {
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

function normalizeCertificateData(options: {
  certificate: CertificateRecord;
  participant: CertificateParticipant;
  participantIndex: number;
  companyLabel: string;
}): CertificateRenderData {
  const { certificate, participant, participantIndex, companyLabel } = options;
  const design = normalizeDesignConfig(certificate.design_config);
  const participantName = normalizeText(participant.name, "Katılımcı");
  const trainingTitle = normalizeText(certificate.training_name, "Eğitim Bilgisi Girilmedi");
  const date = normalizeDateText(certificate.training_date, "Belirtilmedi");
  const duration = normalizeText(certificate.training_duration, "Belirtilmedi");
  const certificateNo = normalizeText(participant.certificate_no) || buildCertificateNumber(certificate.id, participantIndex);
  const companyName = normalizeText(companyLabel, "Firma Bilgisi Girilmedi");
  const verificationCode = normalizeText(participant.verification_code);
  const issueDate = normalizeDateText((certificate as Record<string, unknown>).issue_date)
    || normalizeDateText((certificate as Record<string, unknown>).issued_at)
    || normalizeDateText((certificate as Record<string, unknown>).created_at)
    || new Date().toLocaleDateString("tr-TR");
  const templateType = normalizeText(certificate.template_type, "classic");

  const summaryText = resolveDescriptionText(
    templateType,
    design.descriptionText,
    participantName,
    companyName,
    trainingTitle,
    date,
    duration,
  );

  return {
    participantName,
    role: normalizeText(participant.job_title, "Belirtilmedi"),
    trainingTitle,
    date,
    duration,
    validity: normalizeText(certificate.validity_date, "Süresiz"),
    certificateNo,
    companyName,
    address: normalizeText(certificate.company_address),
    trainers: normalizeStringArray(certificate.trainer_names, ["Belirtilmedi"]),
    trainingTopics: parseTrainingTopics(certificate.notes),
    verificationCode,
    issueDate,
    qrValue: verificationCode ? buildVerificationUrl(verificationCode) : "",
    summaryText,
    templateType,
    certificateType: normalizeText(certificate.certificate_type, "Katılım"),
    logoUrl: normalizeText(certificate.logo_url),
    design,
  };
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
        console.error("certificate pdf asset storage download failed", {
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
      console.error("certificate pdf asset fetch failed", { logoUrl, status: response.status });
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    assetCache.set(logoUrl, bytes);
    return bytes;
  } catch (error) {
    console.error("certificate pdf asset fetch error", { logoUrl, error: error instanceof Error ? error.message : error });
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

    if (!didLogEmbeddedFonts) {
      didLogEmbeddedFonts = true;
      console.log("certificate pdf fonts ready", {
        regularBytes: regularBytes.length,
        boldBytes: boldBytes.length,
        source: "embedded-base64",
      });
    }

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

function isPngBytes(bytes: Uint8Array) {
  return bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4E
    && bytes[3] === 0x47;
}

async function drawImageAsset(pdfDoc: PDFDocument, page: any, assetUrl: string | null | undefined, options: { x: number; y: number; width: number; height: number }) {
  if (!assetUrl) return;
  const assetBytes = await fetchLogoBytes(assetUrl);
  if (!assetBytes) return;
  try {
    const asset = isPngBytes(assetBytes) ? await pdfDoc.embedPng(assetBytes) : await pdfDoc.embedJpg(assetBytes);
    page.drawImage(asset, options);
  } catch (error) {
    console.error("certificate pdf asset embed failed", { assetUrl, error: error instanceof Error ? error.message : error });
  }
}

function fitText(value: string, maxChars: number) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function truncateLineToWidth(font: PdfFont, text: string, fontSize: number, maxWidth: number) {
  const normalized = normalizeText(text);
  if (font.widthOfTextAtSize(normalized, fontSize) <= maxWidth) return normalized;
  const ellipsis = "…";
  let candidate = normalized;
  while (candidate.length > 0 && font.widthOfTextAtSize(`${candidate}${ellipsis}`, fontSize) > maxWidth) {
    candidate = candidate.slice(0, -1).trimEnd();
  }
  return candidate ? `${candidate}${ellipsis}` : ellipsis;
}

function splitLongWord(font: PdfFont, word: string, fontSize: number, maxWidth: number) {
  const chunks: string[] = [];
  let remaining = word;
  while (remaining.length > 0) {
    let slice = remaining;
    while (slice.length > 1 && font.widthOfTextAtSize(slice, fontSize) > maxWidth) {
      slice = slice.slice(0, -1);
    }
    chunks.push(slice);
    remaining = remaining.slice(slice.length);
  }
  return chunks;
}

function wrapTextLines(font: PdfFont, text: string, fontSize: number, maxWidth: number, maxLines = 0) {
  const normalized = normalizeText(text);
  if (!normalized) return [""];

  const lines: string[] = [];
  const paragraphs = normalized.split(/\r?\n/);

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const wordParts = font.widthOfTextAtSize(word, fontSize) > maxWidth
        ? splitLongWord(font, word, fontSize, maxWidth)
        : [word];

      for (const part of wordParts) {
        const candidate = current ? `${current} ${part}` : part;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = part;
        }

        if (maxLines > 0 && lines.length >= maxLines) {
          const limited = lines.slice(0, maxLines);
          limited[maxLines - 1] = truncateLineToWidth(font, limited[maxLines - 1], fontSize, maxWidth);
          return limited;
        }
      }
    }

    if (current) lines.push(current);
    if (maxLines > 0 && lines.length >= maxLines) {
      const limited = lines.slice(0, maxLines);
      limited[maxLines - 1] = truncateLineToWidth(font, limited[maxLines - 1], fontSize, maxWidth);
      return limited;
    }
  }

  return lines;
}

function measureWrappedText(font: PdfFont, text: string, fontSize: number, maxWidth: number, lineHeight: number, maxLines = 0) {
  const lines = wrapTextLines(font, text, fontSize, maxWidth, maxLines);
  return {
    lines,
    height: Math.max(1, lines.length) * lineHeight,
  };
}

function fitTextToBox(font: PdfFont, text: string, options: {
  maxWidth: number;
  maxHeight: number;
  preferredFontSize: number;
  minFontSize: number;
  lineHeightRatio?: number;
}) {
  const lineHeightRatio = options.lineHeightRatio || 1.28;
  for (let size = options.preferredFontSize; size >= options.minFontSize; size -= 0.4) {
    const lineHeight = size * lineHeightRatio;
    const maxLines = Math.max(1, Math.floor(options.maxHeight / lineHeight));
    const measured = measureWrappedText(font, text, size, options.maxWidth, lineHeight, maxLines);
    if (measured.height <= options.maxHeight) {
      return { fontSize: size, lineHeight, lines: measured.lines };
    }
  }

  const lineHeight = options.minFontSize * lineHeightRatio;
  const maxLines = Math.max(1, Math.floor(options.maxHeight / lineHeight));
  return {
    fontSize: options.minFontSize,
    lineHeight,
    lines: wrapTextLines(font, text, options.minFontSize, options.maxWidth, maxLines),
  };
}

function drawLines(page: any, font: PdfFont, lines: string[], options: {
  x: number;
  topY: number;
  fontSize: number;
  lineHeight: number;
  color: PdfColor;
  maxWidth?: number;
}) {
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.topY - index * options.lineHeight,
      size: options.fontSize,
      font,
      color: options.color,
      maxWidth: options.maxWidth,
    });
  });
}

function drawCenteredLines(page: any, font: PdfFont, lines: string[], options: {
  centerX: number;
  topY: number;
  fontSize: number;
  lineHeight: number;
  color: PdfColor;
  maxWidth: number;
}) {
  lines.forEach((line, index) => {
    const lineWidth = Math.min(font.widthOfTextAtSize(line, options.fontSize), options.maxWidth);
    page.drawText(line, {
      x: options.centerX - lineWidth / 2,
      y: options.topY - index * options.lineHeight,
      size: options.fontSize,
      font,
      color: options.color,
      maxWidth: options.maxWidth,
    });
  });
}

function drawCertificateBackground(page: any, data: CertificateRenderData) {
  const { width, height } = page.getSize();
  const primary = data.design.primaryColor;
  const secondary = data.design.secondaryColor;

  if (data.templateType === "modern") {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.07, 0.11, 0.2) });
    page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderWidth: 2, borderColor: primary });
    page.drawRectangle({ x: 34, y: 438, width: width - 68, height: 96, color: rgb(0.09, 0.18, 0.33), opacity: 0.94 });
    page.drawCircle({ x: 728, y: 478, size: 104, color: rgb(0.14, 0.38, 0.56), opacity: 0.23 });
    page.drawCircle({ x: 713, y: 186, size: 132, borderWidth: 26, borderColor: rgb(0.08, 0.7, 0.75), opacity: 0.1 });
    return;
  }

  if (data.templateType === "minimal") {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.985, 0.98) });
    page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderWidth: 1.4, borderColor: rgb(0.8, 0.82, 0.86) });
    page.drawRectangle({ x: 58, y: 505, width: 178, height: 6, color: primary });
    return;
  }

  if (data.templateType === "compliance") {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.97, 0.985, 0.975) });
    page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderWidth: 4, borderColor: rgb(0.1, 0.42, 0.28) });
    page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderWidth: 1, borderColor: rgb(0.52, 0.65, 0.58) });
    page.drawRectangle({ x: 42, y: 486, width: width - 84, height: 52, color: rgb(0.12, 0.38, 0.28), opacity: 0.9 });
    return;
  }

  if (data.templateType === "academy") {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0, 0.3, 0.55) });
    page.drawRectangle({ x: 14, y: 14, width: width - 28, height: height - 28, color: rgb(0.97, 0.985, 0.995) });
    page.drawRectangle({ x: 27, y: 27, width: width - 54, height: height - 54, borderWidth: 8, borderColor: rgb(0.8, 0.86, 0.91) });
    page.drawRectangle({ x: 42, y: 42, width: width - 84, height: height - 84, color: rgb(0.985, 0.99, 1), opacity: 0.96 });
    page.drawSvgPath(`M 0 ${height} L 302 ${height} L 0 362 Z`, { color: rgb(0.02, 0.54, 0.78) });
    page.drawSvgPath(`M 0 ${height} L 282 ${height} L 0 383 Z`, { color: rgb(0, 0.39, 0.68), opacity: 0.74 });
    page.drawCircle({ x: 706, y: 304, size: 148, borderWidth: 36, borderColor: rgb(0.01, 0.29, 0.52), opacity: 0.04 });
    return;
  }

  if (data.templateType === "executive") {
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.975, 0.95) });
    page.drawRectangle({ x: 26, y: 26, width: width - 52, height: height - 52, borderWidth: 2, borderColor: rgb(0.47, 0.37, 0.14) });
    page.drawRectangle({ x: 40, y: 40, width: width - 80, height: height - 80, borderWidth: 0.7, borderColor: rgb(0.83, 0.75, 0.55) });
    page.drawRectangle({ x: 56, y: 500, width: width - 112, height: 24, color: rgb(0.35, 0.28, 0.12), opacity: 0.08 });
    return;
  }

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.99, 0.985, 0.96) });
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderWidth: 5, borderColor: primary });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderWidth: 1.5, borderColor: primary });
  page.drawRectangle({ x: 46, y: 46, width: width - 92, height: height - 92, borderWidth: 0.5, borderColor: rgb(0.86, 0.82, 0.68) });
  page.drawRectangle({ x: 56, y: 500, width: width - 112, height: 36, color: secondary, opacity: 0.08 });
}

function colorTheme(data: CertificateRenderData) {
  if (data.templateType === "modern") {
    return {
      primaryText: rgb(0.93, 0.98, 1),
      secondaryText: rgb(0.77, 0.87, 0.94),
      contentText: rgb(0.06, 0.21, 0.34),
      mutedText: rgb(0.24, 0.36, 0.45),
      cardBorder: rgb(0.63, 0.76, 0.86),
      cardFill: rgb(1, 1, 1),
      accent: rgb(0.45, 0.85, 0.96),
    };
  }

  if (data.templateType === "compliance") {
    return {
      primaryText: rgb(0.93, 0.98, 0.96),
      secondaryText: rgb(0.12, 0.38, 0.28),
      contentText: rgb(0.08, 0.25, 0.18),
      mutedText: rgb(0.32, 0.4, 0.35),
      cardBorder: rgb(0.7, 0.8, 0.74),
      cardFill: rgb(1, 1, 1),
      accent: rgb(0.12, 0.38, 0.28),
    };
  }

  if (data.templateType === "academy") {
    return {
      primaryText: rgb(0, 0.33, 0.58),
      secondaryText: rgb(0, 0.35, 0.62),
      contentText: rgb(0.05, 0.24, 0.38),
      mutedText: rgb(0.16, 0.34, 0.48),
      cardBorder: rgb(0.72, 0.82, 0.9),
      cardFill: rgb(1, 1, 1),
      accent: rgb(0.02, 0.54, 0.78),
    };
  }

  return {
    primaryText: data.design.primaryColor,
    secondaryText: rgb(0.34, 0.3, 0.2),
    contentText: rgb(0.16, 0.16, 0.16),
    mutedText: rgb(0.38, 0.38, 0.38),
    cardBorder: rgb(0.78, 0.78, 0.74),
    cardFill: rgb(1, 1, 1),
    accent: data.design.primaryColor,
  };
}

function resolveCertificateHeading(data: CertificateRenderData) {
  if (data.design.titleText) return data.design.titleText;
  if (data.trainingTitle.toLocaleLowerCase("tr-TR").includes("iş sağlığı")) {
    return "İŞ SAĞLIĞI VE GÜVENLİĞİ EĞİTİM SERTİFİKASI";
  }
  if (data.templateType === "executive") return "KURUMSAL BAŞARI SERTİFİKASI";
  if (data.templateType === "minimal") return "KATILIM SERTİFİKASI";
  return "EĞİTİM KATILIM BELGESİ";
}

async function drawHeader(pdfDoc: PDFDocument, page: any, fonts: { bodyFont: PdfFont; titleFont: PdfFont }, data: CertificateRenderData) {
  const colors = colorTheme(data);
  await drawImageAsset(pdfDoc, page, data.logoUrl, CERT_LAYOUT.header.logo);
  await drawImageAsset(pdfDoc, page, data.design.osgbLogoUrl, CERT_LAYOUT.header.secondaryLogo);

  const companyLines = wrapTextLines(
    fonts.titleFont,
    data.companyName.toLocaleUpperCase("tr-TR"),
    12.5,
    CERT_LAYOUT.header.width,
    2,
  );
  drawCenteredLines(page, fonts.titleFont, companyLines, {
    centerX: CERT_LAYOUT.header.centerX,
    topY: CERT_LAYOUT.header.companyTopY,
    fontSize: 12.5,
    lineHeight: 15,
    color: data.templateType === "modern" ? colors.primaryText : colors.secondaryText,
    maxWidth: CERT_LAYOUT.header.width,
  });

  drawCenteredLines(page, fonts.titleFont, ["EĞİTİM VE BELGELENDİRME BİRİMİ"], {
    centerX: CERT_LAYOUT.header.centerX,
    topY: CERT_LAYOUT.header.unitTopY,
    fontSize: 10.2,
    lineHeight: 12,
    color: data.templateType === "modern" ? colors.secondaryText : colors.secondaryText,
    maxWidth: CERT_LAYOUT.header.width,
  });

  const heading = resolveCertificateHeading(data).toLocaleUpperCase("tr-TR");
  const headingFit = fitTextToBox(fonts.titleFont, heading, {
    maxWidth: 666,
    maxHeight: 43,
    preferredFontSize: 20.5,
    minFontSize: 15,
    lineHeightRatio: 1.18,
  });
  drawCenteredLines(page, fonts.titleFont, headingFit.lines, {
    centerX: CERT_LAYOUT.header.centerX,
    topY: CERT_LAYOUT.header.titleTopY,
    fontSize: headingFit.fontSize,
    lineHeight: headingFit.lineHeight,
    color: data.templateType === "modern" ? colors.primaryText : colors.primaryText,
    maxWidth: 666,
  });
}

function infoRows(data: CertificateRenderData): InfoRow[] {
  return [
    { label: "Katılımcı", value: data.participantName, highlight: true, maxLines: 2 },
    { label: "Görev", value: data.role, maxLines: 2 },
    { label: "Eğitim", value: data.trainingTitle, maxLines: 3 },
    { label: "Tarih", value: data.date, maxLines: 1 },
    { label: "Süre", value: data.duration, maxLines: 1 },
    { label: "Geçerlilik", value: data.validity, maxLines: 1 },
    { label: "Sertifika No", value: data.certificateNo, maxLines: 1 },
    { label: "Firma", value: data.companyName, maxLines: 2 },
    { label: "Adres", value: data.address || "-", maxLines: 3 },
    { label: "Eğitmenler", value: data.trainers.join(", "), maxLines: 2 },
  ];
}

function renderInfoRows(page: any, fonts: { bodyFont: PdfFont; titleFont: PdfFont }, rows: InfoRow[], data: CertificateRenderData) {
  const layout = CERT_LAYOUT.leftInfo;
  const colors = colorTheme(data);
  let y = layout.topY;

  for (const row of rows) {
    const valueFont = row.highlight ? fonts.titleFont : fonts.bodyFont;
    const valueSize = row.highlight ? 10.7 : layout.fontSize;
    const maxLines = row.maxLines || 2;
    let lines = wrapTextLines(valueFont, row.value, valueSize, layout.valueWidth, maxLines);
    let rowHeight = Math.max(layout.minRowHeight, lines.length * layout.lineHeight);

    if (y - rowHeight < layout.minY) {
      lines = wrapTextLines(valueFont, row.value, valueSize, layout.valueWidth, 1);
      rowHeight = Math.max(layout.minRowHeight, lines.length * layout.lineHeight);
    }

    page.drawText(row.label, {
      x: layout.x,
      y,
      size: layout.labelSize,
      font: fonts.titleFont,
      color: colors.accent,
      maxWidth: layout.labelWidth,
    });
    page.drawText(":", {
      x: layout.x + layout.labelWidth,
      y,
      size: layout.labelSize,
      font: fonts.titleFont,
      color: colors.accent,
    });

    drawLines(page, valueFont, lines, {
      x: layout.x + layout.labelWidth + layout.colonWidth,
      topY: y,
      fontSize: valueSize,
      lineHeight: layout.lineHeight,
      color: colors.contentText,
      maxWidth: layout.valueWidth,
    });

    y -= rowHeight + layout.rowGap;
    if (y < layout.minY - 4) break;
  }

  return y;
}

function renderSummaryBox(page: any, bodyFont: PdfFont, data: CertificateRenderData) {
  const layout = CERT_LAYOUT.summaryBox;
  const colors = colorTheme(data);
  const boxHeight = layout.minHeight;

  page.drawRectangle({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: boxHeight,
    color: colors.cardFill,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    opacity: data.templateType === "modern" ? 0.94 : 0.88,
  });
  page.drawRectangle({
    x: layout.x,
    y: layout.y + boxHeight - 4,
    width: layout.width,
    height: 4,
    color: colors.accent,
    opacity: 0.8,
  });

  const fit = fitTextToBox(bodyFont, data.summaryText, {
    maxWidth: layout.width - layout.padding * 2,
    maxHeight: boxHeight - layout.padding * 2,
    preferredFontSize: layout.fontSize,
    minFontSize: layout.minFontSize,
    lineHeightRatio: 1.28,
  });

  drawLines(page, bodyFont, fit.lines, {
    x: layout.x + layout.padding,
    topY: layout.y + boxHeight - layout.padding - fit.fontSize,
    fontSize: fit.fontSize,
    lineHeight: fit.lineHeight,
    color: colors.contentText,
    maxWidth: layout.width - layout.padding * 2,
  });
}

function renderBulletList(page: any, bodyFont: PdfFont, items: string[], options: {
  x: number;
  topY: number;
  width: number;
  bottomY: number;
  fontSize: number;
  lineHeight: number;
  color: PdfColor;
}) {
  let y = options.topY;
  const bulletX = options.x;
  const textX = options.x + 9;
  const textWidth = options.width - 9;

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = normalizeText(items[itemIndex], "Konu bilgisi bulunmamaktadır.");
    const remainingLines = Math.max(1, Math.floor((y - options.bottomY) / options.lineHeight));
    const lines = wrapTextLines(bodyFont, item, options.fontSize, textWidth, remainingLines);

    if (y < options.bottomY) break;
    lines.forEach((line, lineIndex) => {
      const lineY = y - lineIndex * options.lineHeight;
      if (lineY < options.bottomY) return;
      if (lineIndex === 0) {
        page.drawText("•", { x: bulletX, y: lineY, size: options.fontSize, font: bodyFont, color: options.color });
      }
      page.drawText(line, {
        x: textX,
        y: lineY,
        size: options.fontSize,
        font: bodyFont,
        color: options.color,
        maxWidth: textWidth,
      });
    });

    y -= Math.max(options.lineHeight, lines.length * options.lineHeight) + 2.2;
    if (y < options.bottomY) break;
  }
}

function renderTrainingTopicsBox(page: any, fonts: { bodyFont: PdfFont; titleFont: PdfFont }, data: CertificateRenderData) {
  const layout = CERT_LAYOUT.topicsBox;
  const colors = colorTheme(data);

  page.drawRectangle({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    color: colors.cardFill,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    opacity: data.templateType === "modern" ? 0.93 : 0.86,
  });
  page.drawText("Eğitim Konuları", {
    x: layout.x + layout.padding,
    y: layout.y + layout.height - 18,
    size: 10.3,
    font: fonts.titleFont,
    color: colors.accent,
  });

  renderBulletList(page, fonts.bodyFont, data.trainingTopics, {
    x: layout.x + layout.padding,
    topY: layout.y + layout.height - 35,
    width: layout.width - layout.padding * 2,
    bottomY: layout.y + 12,
    fontSize: layout.fontSize,
    lineHeight: layout.lineHeight,
    color: colors.contentText,
  });
}

function drawQrMatrix(page: any, qrValue: string, options: { x: number; y: number; size: number }) {
  if (!qrValue) return;

  const qr = qrcode(0, "M");
  qr.addData(qrValue);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const quietZone = 4;
  const cellSize = options.size / (moduleCount + quietZone * 2);

  page.drawRectangle({
    x: options.x,
    y: options.y,
    width: options.size,
    height: options.size,
    color: rgb(1, 1, 1),
  });
  page.drawRectangle({
    x: options.x,
    y: options.y,
    width: options.size,
    height: options.size,
    borderColor: rgb(0.82, 0.84, 0.84),
    borderWidth: 0.5,
  });

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) continue;
      page.drawRectangle({
        x: options.x + (col + quietZone) * cellSize,
        y: options.y + options.size - (row + quietZone + 1) * cellSize,
        width: cellSize,
        height: cellSize,
        color: rgb(0.05, 0.05, 0.05),
      });
    }
  }
}

function renderQrSection(page: any, bodyFont: PdfFont, titleFont: PdfFont, data: CertificateRenderData) {
  if (!data.qrValue) return;
  const layout = CERT_LAYOUT.qr;
  const colors = colorTheme(data);

  drawQrMatrix(page, data.qrValue, { x: layout.x, y: layout.y, size: layout.size });

  const label = "QR ile doğrula";
  const labelWidth = titleFont.widthOfTextAtSize(label, 8.3);
  page.drawText(label, {
    x: layout.x + layout.size / 2 - labelWidth / 2,
    y: layout.y - layout.labelGap,
    size: 8.3,
    font: titleFont,
    color: colors.accent,
  });

  const noteLines = wrapTextLines(
    bodyFont,
    "Doğrulama: QR kodu okutun veya doğrulama sayfasını ziyaret edin.",
    6.7,
    layout.textWidth,
    2,
  );
  drawCenteredLines(page, bodyFont, noteLines, {
    centerX: layout.x + layout.size / 2,
    topY: layout.y - 25,
    fontSize: 6.7,
    lineHeight: 8,
    color: colors.mutedText,
    maxWidth: layout.textWidth,
  });
}

async function renderFooterInfo(pdfDoc: PDFDocument, page: any, fonts: { bodyFont: PdfFont; titleFont: PdfFont }, data: CertificateRenderData) {
  const layout = CERT_LAYOUT.footer;
  const colors = colorTheme(data);
  page.drawLine({
    start: { x: 72, y: layout.dividerY },
    end: { x: 666, y: layout.dividerY },
    thickness: 0.6,
    color: colors.cardBorder,
  });

  page.drawText("Doğrulama Kodu", {
    x: layout.leftX,
    y: layout.y + 13,
    size: 7.6,
    font: fonts.titleFont,
    color: colors.accent,
  });
  drawLines(page, fonts.bodyFont, wrapTextLines(fonts.bodyFont, data.verificationCode || "Üretimde oluşur", 7.2, layout.leftWidth, 2), {
    x: layout.leftX,
    topY: layout.y + 2,
    fontSize: 7.2,
    lineHeight: 8.3,
    color: colors.mutedText,
    maxWidth: layout.leftWidth,
  });

  page.drawText("Düzenlenme Tarihi", {
    x: layout.leftX,
    y: layout.y - 20,
    size: 7.6,
    font: fonts.titleFont,
    color: colors.accent,
  });
  page.drawText(data.issueDate, {
    x: layout.leftX + 92,
    y: layout.y - 20,
    size: 7.2,
    font: fonts.bodyFont,
    color: colors.mutedText,
    maxWidth: 94,
  });

  const trainerLabel = data.trainers.join(", ");
  const defaultSignatures = [
    { name: fitText(trainerLabel || "Eğitmen", 26), title: "Eğitmen", imageUrl: "" },
    { name: fitText(data.companyName || "Yetkili", 26), title: "Yetkili", imageUrl: "" },
  ];
  const configured = data.design.signatures.length > 0
    ? data.design.signatures.slice(0, Math.min(2, data.design.signatureCount)).map((signature, index) => ({
      name: signature.name || defaultSignatures[index]?.name || "Yetkili",
      title: signature.title || defaultSignatures[index]?.title || "Yetkili",
      imageUrl: signature.imageUrl,
    }))
    : defaultSignatures;

  for (let index = 0; index < configured.length; index += 1) {
    const signature = configured[index];
    const x = layout.signatureX + index * (layout.signatureWidth + layout.signatureGap);
    if (signature.imageUrl) {
      await drawImageAsset(pdfDoc, page, signature.imageUrl, { x: x + 12, y: layout.y + 27, width: 78, height: 28 });
    }
    page.drawLine({
      start: { x, y: layout.y + 20 },
      end: { x: x + layout.signatureWidth, y: layout.y + 20 },
      thickness: 0.8,
      color: colors.accent,
    });
    page.drawText(fitText(signature.name, 24), {
      x: x + 7,
      y: layout.y + 7,
      size: 8.3,
      font: fonts.titleFont,
      color: colors.contentText,
      maxWidth: layout.signatureWidth - 14,
    });
    page.drawText(fitText(signature.title, 26), {
      x: x + 7,
      y: layout.y - 5,
      size: 7,
      font: fonts.bodyFont,
      color: colors.mutedText,
      maxWidth: layout.signatureWidth - 14,
    });
  }

  renderQrSection(page, fonts.bodyFont, fonts.titleFont, data);

  page.drawText("Bu belge İSGVİZYON sistemi üzerinden dijital doğrulama kaydıyla oluşturulmuştur.", {
    x: 254,
    y: 18,
    size: 6.8,
    font: fonts.bodyFont,
    color: colors.mutedText,
    maxWidth: 344,
  });
}

async function drawUnifiedCertificate(pdfDoc: PDFDocument, page: any, fonts: { bodyFont: PdfFont; titleFont: PdfFont }, data: CertificateRenderData) {
  drawCertificateBackground(page, data);
  await drawHeader(pdfDoc, page, fonts, data);
  renderInfoRows(page, fonts, infoRows(data), data);
  renderSummaryBox(page, fonts.bodyFont, data);
  renderTrainingTopicsBox(page, fonts, data);
  await renderFooterInfo(pdfDoc, page, fonts, data);
}

export async function generateCertificatePdf(options: {
  certificate: CertificateRecord;
  participant: CertificateParticipant;
  participantIndex: number;
  companyLabel: string;
}) {
  try {
    const data = normalizeCertificateData(options);
    const pdfDoc = await PDFDocument.create();
    const fonts = await loadFonts(pdfDoc);
    const page = pdfDoc.addPage([CERT_LAYOUT.page.width, CERT_LAYOUT.page.height]);

    await drawUnifiedCertificate(pdfDoc, page, fonts, data);

    return {
      bytes: await pdfDoc.save(),
      certificateNumber: data.certificateNo,
      fileName: `${sanitizeFileName(data.participantName)}-${sanitizeFileName(data.trainingTitle)}.pdf`,
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
