import jsPDF from "jspdf";

import { addInterFontsToJsPDF } from "@/utils/fonts";

export const NACE_RISK_WIZARD_TRANSFER_KEY = "isgvizyon:nace-risk-wizard-transfer";

export type NaceFineKinneyRiskRow = {
  departmentActivity: string;
  hazardSource: string;
  riskConsequence: string;
  affectedPeople: string;
  currentMeasure: string;
  detectionDate: string;
  probability: string;
  frequency: string;
  severity: string;
  riskScore: string;
  riskLevel: string;
  possibleOutcome: string;
  additionalMeasures: string;
  postProbability: string;
  postFrequency: string;
  postSeverity: string;
  postRiskScore: string;
  postRiskLevel: string;
  deadline: string;
  responsible: string;
};

export type NaceRiskWizardTransferPayload = {
  createdAt: string;
  naceCode: string;
  naceTitle: string;
  sector: string;
  hazardClass: string;
  rows: NaceFineKinneyRiskRow[];
};

export type NaceRiskSourceItem = {
  hazard?: string;
  risk?: string;
  preventiveMeasures?: string[];
  additionalMeasures?: string;
  departmentActivity?: string;
  currentMeasure?: string;
  possibleOutcome?: string;
  probability?: string | number;
  frequency?: string | number;
  severity?: string | number;
  riskScore?: string | number;
  riskLevel?: string;
  postProbability?: string | number;
  postFrequency?: string | number;
  postSeverity?: string | number;
  postRiskScore?: string | number;
  postRiskLevel?: string;
  deadline?: string;
  responsible?: string;
};

type BuildRowsArgs = {
  risks: NaceRiskSourceItem[];
  naceCode: string;
  naceTitle: string;
  sector: string;
  hazardClass: string;
};

const empty = (value: unknown) =>
  value === undefined || value === null || String(value).trim() === ""
    ? ""
    : String(value).trim();

const todayIso = () => new Date().toISOString().split("T")[0];

const formatDateTR = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR").format(parsed);
};

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const formatRiskNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

export const getFineKinneyRiskLevel = (score: number) => {
  if (score > 400) return "Çok Yüksek Risk";
  if (score >= 200) return "Yüksek Risk";
  if (score >= 70) return "Önemli Risk";
  if (score >= 20) return "Olası Risk";
  if (score > 0) return "Kabul Edilebilir Risk";
  return "";
};

const normalizeRiskLevel = (level: string) => {
  const clean = empty(level);
  if (!clean) return "";
  return /risk$/i.test(clean) ? clean : `${clean} Risk`;
};

const defaultProbabilityForHazard = (hazardClass: string) => {
  if (hazardClass.includes("Çok")) return 6;
  if (hazardClass.includes("Tehlikeli")) return 3;
  return 1;
};

const defaultSeverityForHazard = (hazardClass: string) => {
  if (hazardClass.includes("Çok")) return 15;
  if (hazardClass.includes("Tehlikeli")) return 7;
  return 3;
};

const defaultOutcome = (riskText: string) => {
  const lower = riskText.toLocaleLowerCase("tr-TR");
  if (lower.includes("ölüm")) return "Yaralanma / ölüm";
  if (lower.includes("yangın")) return "Yangın, yaralanma ve maddi kayıp";
  if (lower.includes("hastalık")) return "Meslek hastalığı";
  if (lower.includes("elektrik")) return "Elektrik çarpması / yanık";
  return "Yaralanma, iş gücü kaybı ve operasyon aksaması";
};

export const buildNaceFineKinneyRows = ({
  risks,
  naceCode,
  naceTitle,
  sector,
  hazardClass,
}: BuildRowsArgs): NaceFineKinneyRiskRow[] =>
  risks.map((risk) => {
    const probability = toNumber(risk.probability, defaultProbabilityForHazard(hazardClass));
    const frequency = toNumber(risk.frequency, 1);
    const severity = toNumber(risk.severity, defaultSeverityForHazard(hazardClass));
    const riskScore = toNumber(risk.riskScore, probability * frequency * severity);
    const postProbability = toNumber(risk.postProbability, 0.2);
    const postFrequency = toNumber(risk.postFrequency, 1);
    const postSeverity = toNumber(risk.postSeverity, Math.min(severity, 3));
    const postRiskScore = toNumber(
      risk.postRiskScore,
      postProbability * postFrequency * postSeverity,
    );
    const measures = Array.isArray(risk.preventiveMeasures)
      ? risk.preventiveMeasures.filter(Boolean).join("\n")
      : "";
    const riskText = empty(risk.risk);

    return {
      departmentActivity: empty(risk.departmentActivity) || sector || naceTitle || naceCode,
      hazardSource: empty(risk.hazard),
      riskConsequence: riskText,
      affectedPeople: "Çalışanlar, ziyaretçiler ve ilgili üçüncü kişiler",
      currentMeasure:
        empty(risk.currentMeasure) ||
        "Mevcut durum saha kontrolünde değerlendirilecek; standart İSG tedbirleri takip edilecektir.",
      detectionDate: todayIso(),
      probability: formatRiskNumber(probability),
      frequency: formatRiskNumber(frequency),
      severity: formatRiskNumber(severity),
      riskScore: formatRiskNumber(riskScore),
      riskLevel: normalizeRiskLevel(risk.riskLevel || getFineKinneyRiskLevel(riskScore)),
      possibleOutcome: empty(risk.possibleOutcome) || defaultOutcome(riskText),
      additionalMeasures: empty(risk.additionalMeasures) || measures,
      postProbability: formatRiskNumber(postProbability),
      postFrequency: formatRiskNumber(postFrequency),
      postSeverity: formatRiskNumber(postSeverity),
      postRiskScore: formatRiskNumber(postRiskScore),
      postRiskLevel: normalizeRiskLevel(
        risk.postRiskLevel || getFineKinneyRiskLevel(postRiskScore),
      ),
      deadline: empty(risk.deadline) || "30 gün",
      responsible: empty(risk.responsible) || "İşveren",
    };
  });

export const saveNaceRiskRowsForRiskWizard = (payload: NaceRiskWizardTransferPayload) => {
  window.localStorage.setItem(NACE_RISK_WIZARD_TRANSFER_KEY, JSON.stringify(payload));
};

const riskColor = (level: string): [number, number, number] => {
  const normalized = level.toLocaleLowerCase("tr-TR");
  if (normalized.includes("çok yüksek")) return [127, 29, 29];
  if (normalized.includes("yüksek")) return [249, 115, 22];
  if (normalized.includes("önemli")) return [239, 68, 68];
  if (normalized.includes("olası")) return [250, 204, 21];
  return [34, 197, 94];
};

const safeFileName = (value: string) =>
  (value || "nace-risk-analizi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLocaleLowerCase("tr-TR");

const addWrappedText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 4.2,
) => {
  const lines = doc.splitTextToSize(text || "-", width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

export const exportNaceRiskAnalysisPdf = (payload: NaceRiskWizardTransferPayload) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  const margin = 14;
  const pageWidth = 210;
  const pageHeight = 297;
  let y = 18;

  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("ISGVizyon NACE AI Risk Analizi", margin, pageHeight - 8);
    doc.text(formatDateTR(todayIso()), pageWidth - margin, pageHeight - 8, { align: "right" });
  };

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, 10, pageWidth - margin * 2, 34, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("Inter", "bold");
  doc.setFontSize(16);
  doc.text("NACE Yapay Zeka Risk Analizi", margin + 6, 22);
  doc.setFont("Inter", "normal");
  doc.setFontSize(9);
  doc.text(`NACE ${payload.naceCode} • ${payload.hazardClass}`, margin + 6, 31);
  doc.text(payload.naceTitle || payload.sector || "-", margin + 6, 38);
  y = 54;

  payload.rows.forEach((row, index) => {
    if (y > 242) {
      addFooter();
      doc.addPage();
      y = 18;
    }

    const color = riskColor(row.riskLevel);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 3, 3, "FD");

    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(margin + 3, y + 3, 14, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Inter", "bold");
    doc.setFontSize(9);
    doc.text(String(index + 1), margin + 10, y + 9.5, { align: "center" });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(row.hazardSource || "Tehlike", margin + 21, y + 8);
    doc.setFont("Inter", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`${row.departmentActivity} • R: ${row.riskScore} • ${row.riskLevel}`, margin + 21, y + 14);

    let textY = y + 22;
    doc.setTextColor(30, 41, 59);
    doc.setFont("Inter", "bold");
    doc.text("Risk:", margin + 5, textY);
    doc.setFont("Inter", "normal");
    textY = addWrappedText(doc, row.riskConsequence, margin + 18, textY, 72, 3.5);

    doc.setFont("Inter", "bold");
    doc.text("Önlem:", margin + 96, y + 22);
    doc.setFont("Inter", "normal");
    addWrappedText(doc, row.additionalMeasures, margin + 111, y + 22, 68, 3.5);

    y += 49;
  });

  addFooter();
  doc.save(`${safeFileName(payload.naceCode || payload.sector)}-ai-risk-analizi.pdf`);
};
