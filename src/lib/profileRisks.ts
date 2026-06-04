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
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
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
  if (value === null || value === undefined || value === "") return null;
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


const normalizeHeader = (value: unknown) =>
  clean(value)
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const HEADER_ALIASES: Record<keyof RiskColumnMap, string[]> = {
  activity: ["FAALIYET", "IS FAALIYET", "ISLEM", "SUREC", "CALISMA ALANI"],
  hazard: ["TEHLIKE", "TEHLIKE KAYNAGI", "TEHLIKE TANIMI"],
  risk: ["RISK", "RISK TANIMI", "RISK ACIKLAMASI"],
  currentStatus: ["MEVCUT DURUM", "MEVCUT ONLEM", "MEVCUT KONTROL", "MEVCUT TEDBIR", "MEVCUT ONLEMLER"],
  detectionDate: ["TESPIT TARIHI", "TARIH", "SAPTAMA TARIHI"],
  riskDefinitionBefore: ["RISKIN TANIMI", "RISK TANIMI"],
  possibleConsequence: ["OLASI SONUC", "SONUC", "ETKI", "OLASI ETKI", "ZARAR"],
  correctivePreventiveAction: [
    "DUZELTICI ONLEYICI FAALIYET",
    "DUZELTICI VE ONLEYICI FAALIYET",
    "DOF",
    "DUZELTICI FAALIYET",
    "ONLEYICI FAALIYET",
    "ALINACAK ONLEM",
    "ALINACAK ONLEMLER",
    "YAPILACAK FAALIYET",
  ],
  riskDefinitionAfter: ["RISKIN TANIMI DOF SONRASI", "DOF SONRASI RISK", "KALAN RISK", "ARTIK RISK", "RISK TANIMI DOF SONRASI"],
  deadline: ["TERMIN", "TERMIN TARIHI", "BITIS TARIHI", "SON TARIH"],
  responsible: ["SORUMLU", "SORUMLU KISI", "SORUMLU BIRIM", "SORUMLULAR"],
  probabilityBefore: ["O", "OLASILIK"],
  frequencyBefore: ["F", "FREKANS", "SIKLIK"],
  severityBefore: ["S", "SIDDET", "Ş", "SİDDET"],
  riskScoreBefore: ["R", "RISK SKORU", "SKOR", "RISK PUANI"],
  probabilityAfter: ["O", "OLASILIK"],
  frequencyAfter: ["F", "FREKANS", "SIKLIK"],
  severityAfter: ["S", "SIDDET", "Ş", "SİDDET"],
  riskScoreAfter: ["R", "RISK SKORU", "SKOR", "RISK PUANI"],
};

type RiskColumnMap = {
  activity?: number;
  hazard?: number;
  risk?: number;
  currentStatus?: number;
  detectionDate?: number;
  probabilityBefore?: number;
  frequencyBefore?: number;
  severityBefore?: number;
  riskScoreBefore?: number;
  riskDefinitionBefore?: number;
  possibleConsequence?: number;
  correctivePreventiveAction?: number;
  probabilityAfter?: number;
  frequencyAfter?: number;
  severityAfter?: number;
  riskScoreAfter?: number;
  riskDefinitionAfter?: number;
  deadline?: number;
  responsible?: number;
};

const matchesAlias = (header: string, aliases: string[]) => aliases.some((alias) => header === normalizeHeader(alias));

const isProbabilityHeader = (header: string) => matchesAlias(header, HEADER_ALIASES.probabilityBefore);
const isFrequencyHeader = (header: string) => matchesAlias(header, HEADER_ALIASES.frequencyBefore);
const isSeverityHeader = (header: string) => matchesAlias(header, HEADER_ALIASES.severityBefore);
const isScoreHeader = (header: string) => matchesAlias(header, HEADER_ALIASES.riskScoreBefore);

const findHeaderRowIndex = (rows: unknown[][]) => {
  const scanLimit = Math.min(rows.length, 30);

  for (let index = 0; index < scanLimit; index += 1) {
    const normalized = (rows[index] ?? []).map(normalizeHeader);
    const hasActivity = normalized.some((header) => matchesAlias(header, HEADER_ALIASES.activity));
    const hasHazard = normalized.some((header) => matchesAlias(header, HEADER_ALIASES.hazard));
    const hasRisk = normalized.some((header) => matchesAlias(header, HEADER_ALIASES.risk));
    const scoreHeaderCount = normalized.filter((header) => isProbabilityHeader(header) || isFrequencyHeader(header) || isSeverityHeader(header) || isScoreHeader(header)).length;

    if ((hasActivity && hasHazard && hasRisk) || (hasActivity && hasRisk && scoreHeaderCount >= 3)) {
      return index;
    }
  }

  return -1;
};

const buildColumnMap = (headerRow: unknown[]): RiskColumnMap => {
  const normalized = headerRow.map(normalizeHeader);
  const map: RiskColumnMap = {};

  const findFirst = (aliases: string[], used = new Set<number>()) => {
    const index = normalized.findIndex((header, headerIndex) => !used.has(headerIndex) && matchesAlias(header, aliases));
    return index >= 0 ? index : undefined;
  };

  map.activity = findFirst(HEADER_ALIASES.activity);
  map.hazard = findFirst(HEADER_ALIASES.hazard);

  const riskDefinitionIndex = findFirst(HEADER_ALIASES.riskDefinitionBefore);
  map.risk = normalized.findIndex((header, index) => index !== riskDefinitionIndex && matchesAlias(header, HEADER_ALIASES.risk));
  if (map.risk < 0) map.risk = undefined;

  map.currentStatus = findFirst(HEADER_ALIASES.currentStatus);
  map.detectionDate = findFirst(HEADER_ALIASES.detectionDate);
  map.riskDefinitionBefore = riskDefinitionIndex;
  map.possibleConsequence = findFirst(HEADER_ALIASES.possibleConsequence);
  map.correctivePreventiveAction = findFirst(HEADER_ALIASES.correctivePreventiveAction);
  map.riskDefinitionAfter = findFirst(HEADER_ALIASES.riskDefinitionAfter);
  map.deadline = findFirst(HEADER_ALIASES.deadline);
  map.responsible = findFirst(HEADER_ALIASES.responsible);

  const scoreColumns = normalized
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => isProbabilityHeader(header) || isFrequencyHeader(header) || isSeverityHeader(header) || isScoreHeader(header));

  const firstSet = scoreColumns.slice(0, 4);
  const secondSet = scoreColumns.slice(4, 8);

  const assignScoreSet = (set: Array<{ header: string; index: number }>, suffix: "Before" | "After") => {
    for (const item of set) {
      if (isProbabilityHeader(item.header)) map[`probability${suffix}` as keyof RiskColumnMap] = item.index;
      else if (isFrequencyHeader(item.header)) map[`frequency${suffix}` as keyof RiskColumnMap] = item.index;
      else if (isSeverityHeader(item.header)) map[`severity${suffix}` as keyof RiskColumnMap] = item.index;
      else if (isScoreHeader(item.header)) map[`riskScore${suffix}` as keyof RiskColumnMap] = item.index;
    }
  };

  assignScoreSet(firstSet, "Before");
  assignScoreSet(secondSet, "After");

  // Official template fallback: use index positions when duplicate O/F/Ş/R headers are present.
  if (map.probabilityBefore === undefined && headerRow.length >= 9) map.probabilityBefore = 5;
  if (map.frequencyBefore === undefined && headerRow.length >= 9) map.frequencyBefore = 6;
  if (map.severityBefore === undefined && headerRow.length >= 9) map.severityBefore = 7;
  if (map.riskScoreBefore === undefined && headerRow.length >= 9) map.riskScoreBefore = 8;
  if (map.probabilityAfter === undefined && headerRow.length >= 16) map.probabilityAfter = 12;
  if (map.frequencyAfter === undefined && headerRow.length >= 16) map.frequencyAfter = 13;
  if (map.severityAfter === undefined && headerRow.length >= 16) map.severityAfter = 14;
  if (map.riskScoreAfter === undefined && headerRow.length >= 16) map.riskScoreAfter = 15;

  return map;
};

const getCell = (row: unknown[], index?: number) => (index === undefined || index < 0 ? "" : row[index]);

const mapRowToInput = (row: unknown[], rowNumber: number, userId: string, organizationId: string | null | undefined, columns: RiskColumnMap): SavedRiskExcelRow => {
  const probabilityBefore = toIntegerOrNull(getCell(row, columns.probabilityBefore));
  const frequencyBefore = toIntegerOrNull(getCell(row, columns.frequencyBefore));
  const severityBefore = toIntegerOrNull(getCell(row, columns.severityBefore));
  const probabilityAfter = toIntegerOrNull(getCell(row, columns.probabilityAfter));
  const frequencyAfter = toIntegerOrNull(getCell(row, columns.frequencyAfter));
  const severityAfter = toIntegerOrNull(getCell(row, columns.severityAfter));

  const input: SavedRiskInput = {
    userId,
    organizationId: organizationId || null,
    activity: clean(getCell(row, columns.activity)),
    hazard: clean(getCell(row, columns.hazard)),
    risk: clean(getCell(row, columns.risk)),
    currentStatus: emptyToNull(clean(getCell(row, columns.currentStatus))),
    detectionDate: parseSavedRiskDate(getCell(row, columns.detectionDate)),
    probabilityBefore,
    frequencyBefore,
    severityBefore,
    riskScoreBefore: calculateScore(probabilityBefore, frequencyBefore, severityBefore, toIntegerOrNull(getCell(row, columns.riskScoreBefore))),
    riskDefinitionBefore: emptyToNull(clean(getCell(row, columns.riskDefinitionBefore))),
    possibleConsequence: emptyToNull(clean(getCell(row, columns.possibleConsequence))),
    correctivePreventiveAction: emptyToNull(clean(getCell(row, columns.correctivePreventiveAction))),
    probabilityAfter,
    frequencyAfter,
    severityAfter,
    riskScoreAfter: calculateScore(probabilityAfter, frequencyAfter, severityAfter, toIntegerOrNull(getCell(row, columns.riskScoreAfter))),
    riskDefinitionAfter: emptyToNull(clean(getCell(row, columns.riskDefinitionAfter))),
    deadline: parseSavedRiskDate(getCell(row, columns.deadline)),
    responsible: emptyToNull(clean(getCell(row, columns.responsible))),
    source: "excel",
  };

  const errors: string[] = [];
  if (!input.activity) errors.push("FAALİYET zorunlu.");
  if (!input.hazard) errors.push("TEHLİKE zorunlu.");
  if (!input.risk) errors.push("RİSK zorunlu.");

  [
    ["O", getCell(row, columns.probabilityBefore), probabilityBefore],
    ["F", getCell(row, columns.frequencyBefore), frequencyBefore],
    ["Ş", getCell(row, columns.severityBefore), severityBefore],
    ["R", getCell(row, columns.riskScoreBefore), input.riskScoreBefore],
    ["DÖF sonrası O", getCell(row, columns.probabilityAfter), probabilityAfter],
    ["DÖF sonrası F", getCell(row, columns.frequencyAfter), frequencyAfter],
    ["DÖF sonrası Ş", getCell(row, columns.severityAfter), severityAfter],
    ["DÖF sonrası R", getCell(row, columns.riskScoreAfter), input.riskScoreAfter],
  ].forEach(([label, original, parsed]) => {
    if (original !== null && original !== undefined && original !== "" && parsed === null) errors.push(`${label} sayısal olmalı.`);
  });

  return { rowNumber, input, errors };
};

export const parseSavedRiskExcel = async (file: File, userId: string, organizationId?: string | null): Promise<SavedRiskExcelParseResult> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true }) : [];

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      missingHeaders: ["Başlık satırı bulunamadı. FAALİYET, TEHLİKE ve RİSK başlıklarını içeren satır bulunmalı."],
    };
  }

  const columns = buildColumnMap(rows[headerRowIndex] ?? []);
  const missingHeaders = [
    columns.activity === undefined ? "FAALİYET" : null,
    columns.hazard === undefined ? "TEHLİKE" : null,
    columns.risk === undefined ? "RİSK" : null,
  ].filter(Boolean) as string[];

  const dataRows = rows
    .slice(headerRowIndex + 1)
    .map((row, index) => ({ row, rowNumber: headerRowIndex + index + 2 }))
    .filter(({ row }) => row.some((cell) => clean(cell)));

  if (missingHeaders.length > 0) {
    return {
      totalRows: dataRows.length,
      validRows: [],
      invalidRows: dataRows.map(({ rowNumber }) => ({
        rowNumber,
        errors: [`Zorunlu kolonlar eksik: ${missingHeaders.join(", ")}`],
      })),
      missingHeaders,
    };
  }

  const parsedRows = dataRows.map(({ row, rowNumber }) => mapRowToInput(row, rowNumber, userId, organizationId, columns));

  return {
    totalRows: dataRows.length,
    validRows: parsedRows.filter((row) => row.errors.length === 0),
    invalidRows: parsedRows.filter((row) => row.errors.length > 0),
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
  ]);
  worksheet["!cols"] = SAVED_RISK_EXCEL_HEADERS.map(() => ({ wch: 24 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Risklerim Şablonu");
  XLSX.writeFile(workbook, "risklerim-resmi-sablon.xlsx");
};
