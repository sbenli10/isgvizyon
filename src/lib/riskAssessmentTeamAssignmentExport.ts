import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/Risk_Degerlendirme_Ekibi_Atamas.docx";
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type RiskAssessmentTeamAssignmentMember = {
  role: string;
  fullName: string;
};

export type RiskAssessmentTeamAssignmentPayload = {
  workplaceTitle: string;
  workplaceRegistryNo: string;
  documentDate: string;
  members: RiskAssessmentTeamAssignmentMember[];
  notifiedByName: string;
};

export const RISK_ASSESSMENT_TEAM_ASSIGNMENT_ROLES = [
  "İşveren / İ. Vekili",
  "İş Güvenliği Uzmanı",
  "İşyeri Hekimi",
  "Çalışan Baş Temsilcisi",
  "Tüm Br. Bilgi Sahibi Kişi",
  "Söndürme Ekip Başkanı",
  "Kurtarma Ekip Başkanı",
  "Koruma Ekip Başkanı",
  "İlk Yardım Ekip Başkanı",
] as const;

const cleanText = (value?: string | number | null) => String(value ?? "").trim();

const formatDateTR = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return cleanText(String(value));

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const slugifyTR = (value?: string | null) =>
  cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "risk-degerlendirme-ekibi";

const createWordElement = (document: XMLDocument, tagName: string) =>
  document.createElementNS(WORD_NAMESPACE, `w:${tagName}`);

const setCellText = (document: XMLDocument, cell: Element | undefined, text: string) => {
  if (!cell) return;

  const paragraphs = Array.from(cell.getElementsByTagNameNS(WORD_NAMESPACE, "p"));
  const paragraph = paragraphs[0] || createWordElement(document, "p");
  if (!paragraph.parentNode) cell.appendChild(paragraph);

  paragraphs.slice(1).forEach((extraParagraph) => extraParagraph.parentNode?.removeChild(extraParagraph));

  Array.from(paragraph.childNodes).forEach((child) => {
    const isParagraphProperties = child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === "pPr";
    if (!isParagraphProperties) paragraph.removeChild(child);
  });

  const run = createWordElement(document, "r");
  const textNode = createWordElement(document, "t");
  textNode.setAttribute("xml:space", "preserve");
  textNode.textContent = text;
  run.appendChild(textNode);
  paragraph.appendChild(run);
};

const getTableRows = (table: Element | undefined) =>
  table ? Array.from(table.getElementsByTagNameNS(WORD_NAMESPACE, "tr")) : [];

const getRowCells = (row: Element | undefined) =>
  row ? Array.from(row.getElementsByTagNameNS(WORD_NAMESPACE, "tc")) : [];

const prepareTemplatePlaceholders = (zip: PizZip) => {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return;

  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(documentFile.asText(), "application/xml");
  const tables = Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "tbl"));

  const informationRows = getTableRows(tables[1]);
  setCellText(xmlDocument, getRowCells(informationRows[0])[1], "{workplaceTitle}");
  setCellText(xmlDocument, getRowCells(informationRows[0])[3], "{documentDate}");
  setCellText(xmlDocument, getRowCells(informationRows[1])[1], "{workplaceRegistryNo}");

  const memberRows = getTableRows(tables[2]);
  for (let index = 0; index < RISK_ASSESSMENT_TEAM_ASSIGNMENT_ROLES.length; index += 1) {
    const rowCells = getRowCells(memberRows[index + 1]);
    setCellText(xmlDocument, rowCells[0], `{m${index + 1}FullName}`);
    setCellText(xmlDocument, rowCells[1], `{m${index + 1}Role}`);
  }

  const notifiedRows = getTableRows(tables[3]);
  setCellText(xmlDocument, getRowCells(notifiedRows[1])[0], "{notifiedByName}");

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
};

const normalizeMembers = (members: RiskAssessmentTeamAssignmentMember[]) =>
  RISK_ASSESSMENT_TEAM_ASSIGNMENT_ROLES.map((role, index) => ({
    role,
    fullName: members[index]?.fullName || "",
  }));

const buildTemplateData = (payload: RiskAssessmentTeamAssignmentPayload) => {
  const members = normalizeMembers(payload.members);
  const data: Record<string, string> = {
    workplaceTitle: cleanText(payload.workplaceTitle),
    workplaceRegistryNo: cleanText(payload.workplaceRegistryNo),
    documentDate: formatDateTR(payload.documentDate),
    notifiedByName: cleanText(payload.notifiedByName),
  };

  members.forEach((member, index) => {
    data[`m${index + 1}FullName`] = cleanText(member.fullName);
    data[`m${index + 1}Role`] = cleanText(member.role);
  });

  return data;
};

export async function generateRiskAssessmentTeamAssignmentDocx(
  payload: RiskAssessmentTeamAssignmentPayload,
): Promise<void> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Risk değerlendirme ekibi ataması şablonu bulunamadı.");
  }

  const templateBytes = await response.arrayBuffer();
  const zip = new PizZip(templateBytes);
  prepareTemplatePlaceholders(zip);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  try {
    doc.render(buildTemplateData(payload));
  } catch (error) {
    console.error("Risk assessment team assignment template render error", error);
    throw new Error("Risk değerlendirme ekibi ataması oluşturulamadı.");
  }

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const fileDate = new Date().toISOString().slice(0, 10);
  saveAs(blob, `risk-degerlendirme-ekibi-atamasi-${slugifyTR(payload.workplaceTitle)}-${fileDate}.docx`);
}
