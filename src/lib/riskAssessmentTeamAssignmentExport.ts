import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/Risk_Degerlendirme_Ekibi_Atamas.docx";
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type RiskAssessmentTeamMember = {
  role: string;
  fullName: string;
};

export type RiskAssessmentTeamAssignmentPayload = {
  workplaceTitle: string;
  workplaceRegistrationNo: string;
  revisionDate: string;
  members: RiskAssessmentTeamMember[];
  notifiedByName: string;
};

const defaultRoles = [
  "İşveren / İ.Vekili",
  "İş Güvenliği Uzmanı",
  "İşyeri Hekimi",
  "Çalışan Baş Temsilcisi",
  "Tüm Br. Bilgi Sahibi Kişi",
  "Söndürme Ekip Başkanı",
  "Kurtarma Ekip Başkanı",
  "Koruma Ekip Başkanı",
  "İlk Yardım Ekip Başkanı",
];

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
    .slice(0, 90) || "bos-form";

const normalizeMembers = (members: RiskAssessmentTeamMember[]) =>
  defaultRoles.map((role, index) => ({
    role: cleanText(members[index]?.role) || role,
    fullName: cleanText(members[index]?.fullName),
  }));

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
  const workplaceRows = getTableRows(tables[1]);
  const teamRows = getTableRows(tables[2]);
  const notificationRows = getTableRows(tables[3]);

  setCellText(xmlDocument, getRowCells(workplaceRows[0])[1], "{workplaceTitle}");
  setCellText(xmlDocument, getRowCells(workplaceRows[0])[3], "{revisionDate}");
  setCellText(xmlDocument, getRowCells(workplaceRows[1])[1], "{workplaceRegistrationNo}");

  for (let index = 0; index < defaultRoles.length; index += 1) {
    const rowCells = getRowCells(teamRows[index + 1]);
    setCellText(xmlDocument, rowCells[0], `{member${index + 1}FullName}`);
    setCellText(xmlDocument, rowCells[1], `{member${index + 1}Role}`);
  }

  setCellText(xmlDocument, getRowCells(notificationRows[1])[0], "{notifiedByName}");

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
};

const buildTemplateData = (payload: RiskAssessmentTeamAssignmentPayload) => {
  const members = normalizeMembers(payload.members);
  const data: Record<string, string> = {
    workplaceTitle: cleanText(payload.workplaceTitle),
    workplaceRegistrationNo: cleanText(payload.workplaceRegistrationNo),
    revisionDate: formatDateTR(payload.revisionDate),
    notifiedByName: cleanText(payload.notifiedByName),
    "60D5717B-0717-4489-8D7E-F44C90DE6822": "{60D5717B-0717-4489-8D7E-F44C90DE6822}",
  };

  members.forEach((member, index) => {
    data[`member${index + 1}FullName`] = member.fullName;
    data[`member${index + 1}Role`] = member.role;
  });

  return data;
};

const buildFileName = (payload: RiskAssessmentTeamAssignmentPayload) => {
  const fileDate = new Date().toISOString().slice(0, 10);
  return `risk-degerlendirme-ekibi-atamasi-${slugifyTR(payload.workplaceTitle)}-${fileDate}.docx`;
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

  saveAs(blob, buildFileName(payload));
}
