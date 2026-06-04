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

const normalizeHeader = (value: unknown) => clean(value).toLocaleUpperCase("tr-TR");

const mapRowToInput = (row: unknown[], rowNumber: number, userId: string, organizationId?: string | null): SavedRiskExcelRow => {
  const probabilityBefore = toIntegerOrNull(row[5]);
  const frequencyBefore = toIntegerOrNull(row[6]);
  const severityBefore = toIntegerOrNull(row[7]);
  const probabilityAfter = toIntegerOrNull(row[12]);
  const frequencyAfter = toIntegerOrNull(row[13]);
  const severityAfter = toIntegerOrNull(row[14]);
  const input: SavedRiskInput = {
    userId,
    organizationId: organizationId || null,
    activity: clean(row[0]),
    hazard: clean(row[1]),
    risk: clean(row[2]),
    currentStatus: emptyToNull(clean(row[3])),
    detectionDate: parseSavedRiskDate(row[4]),
    probabilityBefore,
    frequencyBefore,
    severityBefore,
    riskScoreBefore: calculateScore(probabilityBefore, frequencyBefore, severityBefore, toIntegerOrNull(row[8])),
    riskDefinitionBefore: emptyToNull(clean(row[9])),
    possibleConsequence: emptyToNull(clean(row[10])),
    correctivePreventiveAction: emptyToNull(clean(row[11])),
    probabilityAfter,
    frequencyAfter,
    severityAfter,
    riskScoreAfter: calculateScore(probabilityAfter, frequencyAfter, severityAfter, toIntegerOrNull(row[15])),
    riskDefinitionAfter: emptyToNull(clean(row[16])),
    deadline: parseSavedRiskDate(row[17]),
    responsible: emptyToNull(clean(row[18])),
    source: "excel",
  };

  const errors: string[] = [];
  if (!input.activity) errors.push("FAALİYET zorunlu.");
  if (!input.hazard) errors.push("TEHLİKE zorunlu.");
  if (!input.risk) errors.push("RİSK zorunlu.");
  [
    ["O", row[5], probabilityBefore],
    ["F", row[6], frequencyBefore],
    ["Ş", row[7], severityBefore],
    ["R", row[8], input.riskScoreBefore],
    ["DÖF sonrası O", row[12], probabilityAfter],
    ["DÖF sonrası F", row[13], frequencyAfter],
    ["DÖF sonrası Ş", row[14], severityAfter],
    ["DÖF sonrası R", row[15], input.riskScoreAfter],
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
  const headerRow = rows[0] ?? [];
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const missingHeaders = SAVED_RISK_EXCEL_HEADERS
    .map((header, index) => (normalizedHeaders[index] === header ? null : `${index + 1}. kolon: ${header}`))
    .filter(Boolean) as string[];

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => clean(cell)));
  const parsedRows = dataRows.map((row, index) => mapRowToInput(row, index + 2, userId, organizationId));

  return {
    totalRows: dataRows.length,
    validRows: missingHeaders.length ? [] : parsedRows.filter((row) => row.errors.length === 0),
    invalidRows: missingHeaders.length ? parsedRows.map((row) => ({ ...row, errors: [...row.errors, "Şablon başlıkları beklenen sırada değil."] })) : parsedRows.filter((row) => row.errors.length > 0),
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
  const worksheet = XLSX.utils.aoa_to_sheet([SAVED_RISK_EXCEL_HEADERS, example]);
  worksheet["!cols"] = SAVED_RISK_EXCEL_HEADERS.map(() => ({ wch: 24 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Risklerim Şablonu");
  XLSX.writeFile(workbook, "risklerim-resmi-sablon.xlsx");
};
