import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export const SAVED_RISK_EXCEL_HEADERS = [
  "FAALİYET",
  "TEHLİKE",
  "RİSK",
  "MEVCUT DURUM",
  "TESPİT TARİHİ",
  "O",
  "F",
  "Ş",
  "R",
  "RİSKİN TANIMI",
  "OLASI SONUÇ",
  "DÜZELTİCİ / ÖNLEYİCİ FAALİYET",
  "O",
  "F",
  "Ş",
  "R",
  "RİSKİN TANIMI (DÖF SONRASI)",
  "TERMİN",
  "SORUMLU",
] as const;

export type SavedRiskSource = "manual" | "excel" | "ai" | "template";

export interface SavedRiskItem {
  id: string;
  userId: string;
  organizationId: string | null;
  companyId: string | null;
  sectorKey: string | null;
  category: string | null;
  activity: string;
  hazard: string;
  risk: string;
  currentStatus: string | null;
  detectionDate: string | null;
  probabilityBefore: number | null;
  frequencyBefore: number | null;
  severityBefore: number | null;
  riskScoreBefore: number | null;
  riskDefinitionBefore: string | null;
  possibleConsequence: string | null;
  correctivePreventiveAction: string | null;
  probabilityAfter: number | null;
  frequencyAfter: number | null;
  severityAfter: number | null;
  riskScoreAfter: number | null;
  riskDefinitionAfter: string | null;
  deadline: string | null;
  responsible: string | null;
  source: SavedRiskSource;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedRiskInput {
  userId: string;
  organizationId?: string | null;
  companyId?: string | null;
  sectorKey?: string | null;
  category?: string | null;
  activity: string;
  hazard: string;
  risk: string;
  currentStatus?: string | null;
  detectionDate?: string | null;
  probabilityBefore?: number | null;
  frequencyBefore?: number | null;
  severityBefore?: number | null;
  riskScoreBefore?: number | null;
  riskDefinitionBefore?: string | null;
  possibleConsequence?: string | null;
  correctivePreventiveAction?: string | null;
  probabilityAfter?: number | null;
  frequencyAfter?: number | null;
  severityAfter?: number | null;
  riskScoreAfter?: number | null;
  riskDefinitionAfter?: string | null;
  deadline?: string | null;
  responsible?: string | null;
  source?: SavedRiskSource;
}

export interface SavedRiskExcelRow {
  rowNumber: number;
  input?: SavedRiskInput;
  errors: string[];
}

export interface SavedRiskExcelParseResult {
  totalRows: number;
  validRows: SavedRiskExcelRow[];
  invalidRows: SavedRiskExcelRow[];
  missingHeaders: string[];
}

const db = supabase as any;

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const emptyToNull = (value?: string | null) => {
  const cleaned = clean(value);
  return cleaned ? cleaned : null;
};

const toIntegerOrNull = (value: unknown) => {
  if (value === null || value === undefined || clean(value) === "") return null;
  const parsed = Number(clean(value).replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const calculateScore = (probability?: number | null, frequency?: number | null, severity?: number | null, score?: number | null) => {
  if (score !== null && score !== undefined) return score;
  if (probability && frequency && severity) return probability * frequency * severity;
  return null;
};

const excelSerialToDate = (serial: number) => {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export const parseSavedRiskDate = (value: unknown): string | null => {
  if (value === null || value === undefined || clean(value) === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) return excelSerialToDate(value);

  const text = clean(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const tr = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (tr) return `${tr[3]}-${tr[2].padStart(2, "0")}-${tr[1].padStart(2, "0")}`;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

type SavedRiskColumnKey =
  | "activity"
  | "hazard"
  | "risk"
  | "currentStatus"
  | "detectionDate"
  | "probabilityBefore"
  | "frequencyBefore"
  | "severityBefore"
  | "riskScoreBefore"
  | "riskDefinitionBefore"
  | "possibleConsequence"
  | "correctivePreventiveAction"
  | "probabilityAfter"
  | "frequencyAfter"
  | "severityAfter"
  | "riskScoreAfter"
  | "riskDefinitionAfter"
  | "deadline"
  | "responsible";

type SavedRiskColumnMap = Partial<Record<SavedRiskColumnKey, number>>;

const normalizeHeader = (value: unknown) =>
  clean(value)
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[.:;,_()\[\]{}]+/g, " ")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (header: string, aliases: string[]) => aliases.some((alias) => header === alias || header.includes(alias));

const isProbabilityHeader = (header: string) => ["O", "OLASILIK", "OLASILIK O"].includes(header);
const isFrequencyHeader = (header: string) => ["F", "FREKANS", "FREKANS F"].includes(header);
const isSeverityHeader = (header: string) => ["S", "SIDDET", "SIDDET S"].includes(header);
const isScoreHeader = (header: string) => ["R", "RISK SKORU", "RISK PUANI", "RISK DERECESI", "SKOR"].includes(header);

const firstScoreIndex = (headers: string[]) => {
  const indexes = headers
    .map((header, index) => (isProbabilityHeader(header) || isFrequencyHeader(header) || isSeverityHeader(header) || isScoreHeader(header) ? index : -1))
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : Number.POSITIVE_INFINITY;
};

const assignScoreColumns = (headers: string[], columnMap: SavedRiskColumnMap) => {
  const occurrences: Record<"probability" | "frequency" | "severity" | "score", number> = {
    probability: 0,
    frequency: 0,
    severity: 0,
    score: 0,
  };

  headers.forEach((header, index) => {
    const assign = (kind: keyof typeof occurrences, beforeKey: SavedRiskColumnKey, afterKey: SavedRiskColumnKey) => {
      occurrences[kind] += 1;
      const targetKey = occurrences[kind] === 1 ? beforeKey : afterKey;
      if (columnMap[targetKey] === undefined) columnMap[targetKey] = index;
    };

    if (isProbabilityHeader(header)) assign("probability", "probabilityBefore", "probabilityAfter");
    else if (isFrequencyHeader(header)) assign("frequency", "frequencyBefore", "frequencyAfter");
    else if (isSeverityHeader(header)) assign("severity", "severityBefore", "severityAfter");
    else if (isScoreHeader(header)) assign("score", "riskScoreBefore", "riskScoreAfter");
  });
};

const buildColumnMap = (headerRow: unknown[]): SavedRiskColumnMap => {
  const headers = headerRow.map(normalizeHeader);
  const scoreStart = firstScoreIndex(headers);
  const columnMap: SavedRiskColumnMap = {};
  assignScoreColumns(headers, columnMap);

  headers.forEach((header, index) => {
    if (!header) return;
    const assignIfEmpty = (key: SavedRiskColumnKey) => {
      if (columnMap[key] === undefined) columnMap[key] = index;
    };

    if (includesAny(header, ["FAALIYET", "IS FAALIYET", "ISLEM", "SUREC"])) assignIfEmpty("activity");
    else if (includesAny(header, ["TEHLIKE", "TEHLIKE KAYNAGI"])) assignIfEmpty("hazard");
    else if (includesAny(header, ["MEVCUT DURUM", "MEVCUT ONLEM", "MEVCUT KONTROL", "MEVCUT TEDBIR"])) assignIfEmpty("currentStatus");
    else if (includesAny(header, ["TESPIT TARIHI", "TARIH"])) assignIfEmpty("detectionDate");
    else if (includesAny(header, ["OLASI SONUC", "SONUC", "ETKI"])) assignIfEmpty("possibleConsequence");
    else if (includesAny(header, ["DUZELTICI ONLEYICI FAALIYET", "DOF", "DUZELTICI FAALIYET", "ONLEYICI FAALIYET", "ALINACAK ONLEM"])) assignIfEmpty("correctivePreventiveAction");
    else if (includesAny(header, ["DOF SONRASI RISK", "KALAN RISK", "ARTIK RISK", "RISKIN TANIMI DOF SONRASI"])) assignIfEmpty("riskDefinitionAfter");
    else if (includesAny(header, ["TERMIN", "TERMIN TARIHI", "BITIS TARIHI"])) assignIfEmpty("deadline");
    else if (includesAny(header, ["SORUMLU", "SORUMLU KISI", "SORUMLU BIRIM"])) assignIfEmpty("responsible");
    else if (includesAny(header, ["RISKIN TANIMI", "RISK TANIMI", "RISK ACIKLAMASI"])) {
      if (index < scoreStart && columnMap.risk === undefined) assignIfEmpty("risk");
      else assignIfEmpty("riskDefinitionBefore");
    } else if (header === "RISK") assignIfEmpty("risk");
  });

  return columnMap;
};

const requiredMissing = (columnMap: SavedRiskColumnMap) =>
  ([
    ["FAALİYET", columnMap.activity],
    ["TEHLİKE", columnMap.hazard],
    ["RİSK", columnMap.risk],
  ] as const)
    .filter(([, index]) => index === undefined)
    .map(([label]) => label);

const headerScore = (row: unknown[]) => {
  const columnMap = buildColumnMap(row);
  const requiredFound = 3 - requiredMissing(columnMap).length;
  const optionalFound = Object.keys(columnMap).length - requiredFound;
  return requiredFound * 4 + optionalFound;
};

const findHeaderRowIndex = (rows: unknown[][]) => {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 30).forEach((row, index) => {
    const score = headerScore(row);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 8 ? bestIndex : -1;
};

const valueAt = (row: unknown[], columnMap: SavedRiskColumnMap, key: SavedRiskColumnKey) => {
  const index = columnMap[key];
  return index === undefined ? "" : row[index];
};

const validateNumber = (errors: string[], label: string, original: unknown, parsed: number | null) => {
  if (clean(original) && parsed === null) errors.push(`${label} sayısal olmalı.`);
};

const validateDate = (errors: string[], label: string, original: unknown, parsed: string | null) => {
  if (clean(original) && parsed === null) errors.push(`${label} geçerli tarih olmalı.`);
};

const mapRowToInput = (row: unknown[], rowNumber: number, columnMap: SavedRiskColumnMap, userId: string, organizationId?: string | null): SavedRiskExcelRow => {
  const probabilityBefore = toIntegerOrNull(valueAt(row, columnMap, "probabilityBefore"));
  const frequencyBefore = toIntegerOrNull(valueAt(row, columnMap, "frequencyBefore"));
  const severityBefore = toIntegerOrNull(valueAt(row, columnMap, "severityBefore"));
  const probabilityAfter = toIntegerOrNull(valueAt(row, columnMap, "probabilityAfter"));
  const frequencyAfter = toIntegerOrNull(valueAt(row, columnMap, "frequencyAfter"));
  const severityAfter = toIntegerOrNull(valueAt(row, columnMap, "severityAfter"));
  const detectionDate = parseSavedRiskDate(valueAt(row, columnMap, "detectionDate"));
  const deadline = parseSavedRiskDate(valueAt(row, columnMap, "deadline"));
  const input: SavedRiskInput = {
    userId,
    organizationId: organizationId || null,
    activity: clean(valueAt(row, columnMap, "activity")),
    hazard: clean(valueAt(row, columnMap, "hazard")),
    risk: clean(valueAt(row, columnMap, "risk")),
    currentStatus: emptyToNull(clean(valueAt(row, columnMap, "currentStatus"))),
    detectionDate,
    probabilityBefore,
    frequencyBefore,
    severityBefore,
    riskScoreBefore: calculateScore(probabilityBefore, frequencyBefore, severityBefore, toIntegerOrNull(valueAt(row, columnMap, "riskScoreBefore"))),
    riskDefinitionBefore: emptyToNull(clean(valueAt(row, columnMap, "riskDefinitionBefore"))),
    possibleConsequence: emptyToNull(clean(valueAt(row, columnMap, "possibleConsequence"))),
    correctivePreventiveAction: emptyToNull(clean(valueAt(row, columnMap, "correctivePreventiveAction"))),
    probabilityAfter,
    frequencyAfter,
    severityAfter,
    riskScoreAfter: calculateScore(probabilityAfter, frequencyAfter, severityAfter, toIntegerOrNull(valueAt(row, columnMap, "riskScoreAfter"))),
    riskDefinitionAfter: emptyToNull(clean(valueAt(row, columnMap, "riskDefinitionAfter"))),
    deadline,
    responsible: emptyToNull(clean(valueAt(row, columnMap, "responsible"))),
    source: "excel",
  };

  const errors: string[] = [];
  if (!input.activity) errors.push("FAALİYET zorunlu.");
  if (!input.hazard) errors.push("TEHLİKE zorunlu.");
  if (!input.risk) errors.push("RİSK zorunlu.");

  validateNumber(errors, "O", valueAt(row, columnMap, "probabilityBefore"), probabilityBefore);
  validateNumber(errors, "F", valueAt(row, columnMap, "frequencyBefore"), frequencyBefore);
  validateNumber(errors, "Ş", valueAt(row, columnMap, "severityBefore"), severityBefore);
  validateNumber(errors, "R", valueAt(row, columnMap, "riskScoreBefore"), input.riskScoreBefore ?? null);
  validateNumber(errors, "DÖF sonrası O", valueAt(row, columnMap, "probabilityAfter"), probabilityAfter);
  validateNumber(errors, "DÖF sonrası F", valueAt(row, columnMap, "frequencyAfter"), frequencyAfter);
  validateNumber(errors, "DÖF sonrası Ş", valueAt(row, columnMap, "severityAfter"), severityAfter);
  validateNumber(errors, "DÖF sonrası R", valueAt(row, columnMap, "riskScoreAfter"), input.riskScoreAfter ?? null);
  validateDate(errors, "TESPİT TARİHİ", valueAt(row, columnMap, "detectionDate"), detectionDate);
  validateDate(errors, "TERMİN", valueAt(row, columnMap, "deadline"), deadline);

  return { rowNumber, input, errors };
};

export const parseSavedRiskExcel = async (file: File, userId: string, organizationId?: string | null): Promise<SavedRiskExcelParseResult> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true, blankrows: false }) : [];
  const headerRowIndex = findHeaderRowIndex(rows);

  if (headerRowIndex < 0) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      missingHeaders: ["Başlık satırı bulunamadı. İlk 30 satırda FAALİYET, TEHLİKE ve RİSK başlıklarını içeren satır bulunamadı."],
    };
  }

  const columnMap = buildColumnMap(rows[headerRowIndex] ?? []);
  const missingRequiredHeaders = requiredMissing(columnMap);
  const missingHeaders = missingRequiredHeaders.length ? [`Şu zorunlu kolonlar eksik: ${missingRequiredHeaders.join(", ")}`] : [];
  const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((cell) => clean(cell)));
  const parsedRows = dataRows.map((row, index) => mapRowToInput(row, headerRowIndex + index + 2, columnMap, userId, organizationId));

  return {
    totalRows: dataRows.length,
    validRows: missingRequiredHeaders.length ? [] : parsedRows.filter((row) => row.errors.length === 0),
    invalidRows: missingRequiredHeaders.length
      ? parsedRows.map((row) => ({ ...row, errors: [...row.errors, `Zorunlu kolon eksik: ${missingRequiredHeaders.join(", ")}`] }))
      : parsedRows.filter((row) => row.errors.length > 0),
    missingHeaders,
  };
};

const mapSavedRisk = (row: any): SavedRiskItem => ({
  id: row.id,
  userId: row.user_id,
  organizationId: row.organization_id || null,
  companyId: row.company_id || null,
  sectorKey: row.sector_key || null,
  category: row.category || null,
  activity: row.activity || "",
  hazard: row.hazard || row.hazard_source || "",
  risk: row.risk || row.risk_description || "",
  currentStatus: row.current_status || row.current_measures || null,
  detectionDate: row.detection_date || null,
  probabilityBefore: row.probability_before ?? row.probability ?? null,
  frequencyBefore: row.frequency_before ?? null,
  severityBefore: row.severity_before ?? row.severity ?? null,
  riskScoreBefore: row.risk_score_before ?? row.risk_score ?? null,
  riskDefinitionBefore: row.risk_definition_before || row.risk_description || null,
  possibleConsequence: row.possible_consequence || null,
  correctivePreventiveAction: row.corrective_preventive_action || row.additional_measures || null,
  probabilityAfter: row.probability_after ?? null,
  frequencyAfter: row.frequency_after ?? null,
  severityAfter: row.severity_after ?? null,
  riskScoreAfter: row.risk_score_after ?? null,
  riskDefinitionAfter: row.risk_definition_after || null,
  deadline: row.deadline || row.due_date || null,
  responsible: row.responsible || null,
  source: row.source || "manual",
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toPayload = (input: SavedRiskInput) => {
  const beforeScore = calculateScore(input.probabilityBefore, input.frequencyBefore, input.severityBefore, input.riskScoreBefore);
  const afterScore = calculateScore(input.probabilityAfter, input.frequencyAfter, input.severityAfter, input.riskScoreAfter);
  return {
    user_id: input.userId,
    organization_id: input.organizationId || null,
    company_id: input.companyId || null,
    sector_key: input.sectorKey || null,
    category: input.category || null,
    activity: input.activity.trim(),
    hazard: input.hazard.trim(),
    risk: input.risk.trim(),
    current_status: input.currentStatus || null,
    detection_date: input.detectionDate || null,
    probability_before: input.probabilityBefore ?? null,
    frequency_before: input.frequencyBefore ?? null,
    severity_before: input.severityBefore ?? null,
    risk_score_before: beforeScore,
    risk_definition_before: input.riskDefinitionBefore || null,
    possible_consequence: input.possibleConsequence || null,
    corrective_preventive_action: input.correctivePreventiveAction || null,
    probability_after: input.probabilityAfter ?? null,
    frequency_after: input.frequencyAfter ?? null,
    severity_after: input.severityAfter ?? null,
    risk_score_after: afterScore,
    risk_definition_after: input.riskDefinitionAfter || null,
    deadline: input.deadline || null,
    responsible: input.responsible || null,
    source: input.source || "manual",
    is_active: true,
    hazard_source: input.hazard.trim(),
    risk_description: input.risk.trim(),
    current_measures: input.currentStatus || null,
    probability: input.probabilityBefore ?? null,
    severity: input.severityBefore ?? null,
    risk_score: beforeScore,
    additional_measures: input.correctivePreventiveAction || null,
    due_date: input.deadline || null,
  };
};

export const listSavedRiskItems = async (userId: string): Promise<SavedRiskItem[]> => {
  const { data, error } = await db
    .from("saved_risk_items")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSavedRisk);
};

export const createSavedRiskItem = async (input: SavedRiskInput): Promise<SavedRiskItem> => {
  const { data, error } = await db.from("saved_risk_items").insert(toPayload(input)).select("*").single();
  if (error) throw error;
  return mapSavedRisk(data);
};

export const updateSavedRiskItem = async (id: string, input: SavedRiskInput): Promise<SavedRiskItem> => {
  const { data, error } = await db.from("saved_risk_items").update({ ...toPayload(input), updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return mapSavedRisk(data);
};

export const deleteSavedRiskItem = async (id: string) => {
  const { error } = await db.from("saved_risk_items").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
};

export const bulkDeleteSavedRiskItems = async (ids: string[]) => {
  if (ids.length === 0) return;
  const { error } = await db.from("saved_risk_items").update({ is_active: false, updated_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
};

export const bulkCreateSavedRiskItems = async (inputs: SavedRiskInput[], existing: SavedRiskItem[] = []) => {
  const known = new Set(existing.map((item) => `${item.activity}|${item.hazard}|${item.risk}|${item.correctivePreventiveAction || ""}`.toLocaleLowerCase("tr-TR")));
  const uniqueInputs = inputs.filter((input) => {
    const key = `${input.activity}|${input.hazard}|${input.risk}|${input.correctivePreventiveAction || ""}`.toLocaleLowerCase("tr-TR");
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  const skipped = inputs.length - uniqueInputs.length;
  if (uniqueInputs.length === 0) return { inserted: [], skipped };

  const { data, error } = await db.from("saved_risk_items").insert(uniqueInputs.map(toPayload)).select("*");
  if (error) throw error;
  return { inserted: (data ?? []).map(mapSavedRisk), skipped };
};

export const downloadSavedRiskTemplate = () => {
  const example = [
    "Yüksekte çalışma",
    "Düşme",
    "Yüksekten düşme sonucu yaralanma",
    "Korkuluk ve emniyet kemeri kullanımı kısmi",
    "2026-06-04",
    3,
    2,
    5,
    30,
    "Yüksekte çalışma sırasında düşme riski",
    "Ağır yaralanma / ölüm",
    "Yaşam hattı kurulması, KKD kontrolü, eğitim",
    1,
    1,
    5,
    5,
    "Önlemler sonrası kontrol altında risk",
    "2026-06-30",
    "Şantiye Şefi",
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...SAVED_RISK_EXCEL_HEADERS],
    example,
  ]);  worksheet["!cols"] = SAVED_RISK_EXCEL_HEADERS.map(() => ({ wch: 24 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Risklerim Şablonu");
  XLSX.writeFile(workbook, "risklerim-resmi-sablon.xlsx");
};
