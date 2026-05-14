import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const symbolsDir = path.join(publicDir, "symbols");
const outputFile = path.join(
  rootDir,
  "src",
  "components",
  "evacuation-editor",
  "publicSymbols.generated.ts",
);

const allowedExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);

const ISO_MEANINGS_TR = {
  // Emergency / Safe condition
  E001: "Acil çıkış - sol yön",
  E002: "Acil çıkış - sağ yön",
  E003: "İlk yardım",
  E004: "Acil telefon",
  E007: "Toplanma noktası",
  E009: "Doktor",
  E010: "OED / AED cihazı",
  E011: "Göz yıkama istasyonu",
  E012: "Acil duş",
  E013: "Sedye",
  E016: "Kaçış merdivenli acil pencere",
  E017: "Kurtarma penceresi",
  E020: "Acil durdurma butonu",
  E026: "Yürüme engelli kişiler için acil çıkış",
  E053: "Tahliye sandalyesi",

  // Fire protection
  F001: "Yangın söndürücü",
  F002: "Yangın hortum makarası",
  F003: "Yangın merdiveni",
  F004: "Yangınla mücadele ekipmanları",
  F005: "Yangın alarm butonu",
  F006: "Yangın acil telefonu",
  F007: "Yangın kapısı",
  F016: "Yangın battaniyesi",
  F019: "Bağlantısız yangın hortumu",

  // Mandatory
  M001: "Genel emredici işaret",
  M002: "Talimat kitabını / kılavuzu oku",
  M003: "Kulak koruyucu kullan",
  M004: "Göz koruyucu kullan",
  M005: "Topraklama bağlantısı yap",
  M008: "İş güvenliği ayakkabısı kullan",
  M009: "Koruyucu eldiven kullan",
  M010: "Koruyucu kıyafet kullan",
  M014: "Baret kullan",
  M016: "Maske kullan",
  M018: "Emniyet kemeri / güvenlik halatı kullan",
  M020: "Emniyet kemeri tak",
  M046: "Gaz tüpünü sabitle",

  // Warning
  W001: "Genel uyarı",
  W003: "Radyoaktif madde / iyonlaştırıcı radyasyon",
  W008: "Düşme tehlikesi",
  W012: "Elektrik tehlikesi",
  W021: "Yanıcı madde",
  W070: "Basamak / seviye farkı tehlikesi",

  // Prohibition
  P001: "Genel yasak",
  P004: "Geçiş yok / giriş yasak",
  P005: "İçilmez su",
  P010: "Dokunma",
  P012: "Ağır yük yasaktır",
};

const FALLBACK_CATEGORY_LABELS = {
  emergency: "Acil Durum",
  fire: "Yangın",
  mandatory: "Emredici",
  warning: "Uyarı",
  prohibition: "Yasaklayıcı",
  direction: "Yönlendirme",
  custom: "Özel",
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExtensions.has(ext)) return [];

    const relativeFromPublic = path
      .relative(publicDir, fullPath)
      .split(path.sep)
      .join("/");

    return [`/${relativeFromPublic}`];
  });
}

function makeSafeId(url) {
  return url
    .replace(/^\/symbols\//, "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractIsoCode(url) {
  const fileName = decodeURIComponent(path.basename(url));

  const match = fileName.match(/ISO_7010_([A-Z]\d{3})/i);
  if (match?.[1]) {
    return match[1].toUpperCase();
  }

  if (fileName.toLowerCase().includes("elektrik-tehlikesi")) {
    return "W012";
  }

  return null;
}

function getCategoryFromUrl(url) {
  const fileName = decodeURIComponent(path.basename(url)).toLowerCase();
  const code = extractIsoCode(url);

  if (fileName.includes("fire_protection_arrow")) return "direction";
  if (fileName.includes("safe_condition_arrow")) return "direction";

  if (code?.startsWith("E")) return "emergency";
  if (code?.startsWith("F")) return "fire";
  if (code?.startsWith("M")) return "mandatory";
  if (code?.startsWith("W")) return "warning";
  if (code?.startsWith("P")) return "prohibition";

  if (fileName.includes("elektrik")) return "warning";

  return "custom";
}

function getColorFromCategory(category) {
  switch (category) {
    case "emergency":
      return "#009966";
    case "fire":
      return "#dc2626";
    case "mandatory":
      return "#2563eb";
    case "warning":
      return "#f59e0b";
    case "prohibition":
      return "#dc2626";
    case "direction":
      return "#009966";
    default:
      return "#06b6d4";
  }
}

function getShortCodeFromUrl(url) {
  const code = extractIsoCode(url);
  const fileName = decodeURIComponent(path.basename(url)).toLowerCase();

  if (code) return code;
  if (fileName.includes("fire_protection_arrow")) return "F→";
  if (fileName.includes("safe_condition_arrow")) return "E→";
  if (fileName.includes("elektrik")) return "W012";

  return "S";
}

function makeHumanizedFileLabel(url) {
  return decodeURIComponent(path.basename(url))
    .replace(/\.[^.]+$/, "")
    .replace(/^500px-/i, "")
    .replace(/^ISO_7010_/i, "")
    .replace(/_/g, " ")
    .replace(/\+/g, "+")
    .replace(/\s+/g, " ")
    .trim();
}

function getDirectionLabel(url) {
  const fileName = decodeURIComponent(path.basename(url)).toLowerCase();

  if (fileName.includes("fire_protection_arrow_1")) {
    return "Yangın ekipmanı yön oku 1";
  }

  if (fileName.includes("fire_protection_arrow_2")) {
    return "Yangın ekipmanı yön oku 2";
  }

  if (fileName.includes("safe_condition_arrow_1")) {
    return "Güvenli yön oku 1";
  }

  if (fileName.includes("safe_condition_arrow_2")) {
    return "Güvenli yön oku 2";
  }

  return null;
}

function getLabelFromUrl(url) {
  const code = extractIsoCode(url);
  const directionLabel = getDirectionLabel(url);

  if (directionLabel) return directionLabel;

  if (code && ISO_MEANINGS_TR[code]) {
    return ISO_MEANINGS_TR[code];
  }

  return makeHumanizedFileLabel(url);
}

function shouldSkip(url) {
  const fileName = decodeURIComponent(path.basename(url)).toLowerCase();

  // Aynı sembolün 500px PNG önizlemesi varsa SVG varken gereksiz kalabalık yapmasın.
  if (fileName.startsWith("500px-")) return true;

  return false;
}

const urls = walk(symbolsDir)
  .filter((url) => !shouldSkip(url))
  .sort((a, b) => a.localeCompare(b, "tr"));

const symbols = urls.map((url) => {
  const category = getCategoryFromUrl(url);
  const isSvg = url.toLowerCase().endsWith(".svg");

  return {
    id: makeSafeId(url),
    label: getLabelFromUrl(url),
    category,
    color: getColorFromCategory(category),
    shortCode: getShortCodeFromUrl(url),
    ...(isSvg ? { svgUrl: url } : { imageSrc: url }),
  };
});

const fileContent = `/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
 * Generated by scripts/generate-public-symbols.mjs
 */

export type GeneratedPublicSymbolCategory =
  | "custom"
  | "emergency"
  | "fire"
  | "mandatory"
  | "warning"
  | "prohibition"
  | "direction";

export interface GeneratedPublicSymbol {
  id: string;
  label: string;
  category: GeneratedPublicSymbolCategory;
  color: string;
  shortCode: string;
  svgUrl?: string;
  imageSrc?: string;
}

export const PUBLIC_SYMBOLS = ${JSON.stringify(symbols, null, 2)} satisfies GeneratedPublicSymbol[];
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, fileContent, "utf8");

console.log(`Generated ${symbols.length} public symbols.`);
console.log(outputFile);