import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/Acil_Durum_Destek_Elemani_Atamasi.docx";
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type EmergencySupportTeamKey = "rescue" | "fire" | "firstAid" | "protection";

export type EmergencySupportAssignmentParticipant = {
  fullName: string;
  tcNo: string;
};

export type EmergencySupportAssignmentPayload = {
  workplaceTitle: string;
  workplaceRegistrationNo: string;
  revisionDate: string;
  notifiedByName: string;
  teams: Record<EmergencySupportTeamKey, EmergencySupportAssignmentParticipant[]>;
};

const teamConfigs: Array<{
  key: EmergencySupportTeamKey;
  infoTableIndex: number;
  teamTableIndex: number;
  notificationTableIndex: number;
  rowCount: number;
}> = [
  { key: "rescue", infoTableIndex: 0, teamTableIndex: 1, notificationTableIndex: 2, rowCount: 4 },
  { key: "fire", infoTableIndex: 3, teamTableIndex: 4, notificationTableIndex: 5, rowCount: 4 },
  { key: "firstAid", infoTableIndex: 6, teamTableIndex: 7, notificationTableIndex: 8, rowCount: 10 },
  { key: "protection", infoTableIndex: 9, teamTableIndex: 10, notificationTableIndex: 11, rowCount: 4 },
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

const normalizeTeam = (participants: EmergencySupportAssignmentParticipant[], rowCount: number) =>
  Array.from({ length: rowCount }, (_, index) => ({
    fullName: cleanText(participants[index]?.fullName),
    tcNo: cleanText(participants[index]?.tcNo),
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

  teamConfigs.forEach((config) => {
    const infoRows = getTableRows(tables[config.infoTableIndex]);
    const teamRows = getTableRows(tables[config.teamTableIndex]);
    const notificationRows = getTableRows(tables[config.notificationTableIndex]);

    setCellText(xmlDocument, getRowCells(infoRows[1])[1], "{workplaceTitle}");
    setCellText(xmlDocument, getRowCells(infoRows[2])[1], "{workplaceRegistrationNo}");
    setCellText(xmlDocument, getRowCells(infoRows[2])[2], "Tarihi\n{revisionDate}");

    for (let index = 0; index < config.rowCount; index += 1) {
      const rowCells = getRowCells(teamRows[index + 2]);
      setCellText(xmlDocument, rowCells[1], `{${config.key}${index + 1}FullName}`);
      setCellText(xmlDocument, rowCells[2], `{${config.key}${index + 1}TcNo}`);
    }

    setCellText(xmlDocument, getRowCells(notificationRows[1])[0], `İşyeri / Vekili\n{notifiedByName}`);
  });

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
};

const buildTemplateData = (payload: EmergencySupportAssignmentPayload) => {
  const data: Record<string, string> = {
    workplaceTitle: cleanText(payload.workplaceTitle),
    workplaceRegistrationNo: cleanText(payload.workplaceRegistrationNo),
    revisionDate: formatDateTR(payload.revisionDate),
    notifiedByName: cleanText(payload.notifiedByName),
    "60D5717B-0717-4489-8D7E-F44C90DE6822": "{60D5717B-0717-4489-8D7E-F44C90DE6822}",
  };

  teamConfigs.forEach((config) => {
    const participants = normalizeTeam(payload.teams[config.key], config.rowCount);
    participants.forEach((participant, index) => {
      data[`${config.key}${index + 1}FullName`] = participant.fullName;
      data[`${config.key}${index + 1}TcNo`] = participant.tcNo;
    });
  });

  return data;
};

const buildFileName = (payload: EmergencySupportAssignmentPayload) => {
  const fileDate = new Date().toISOString().slice(0, 10);
  return `acil-durum-destek-elemani-atamasi-${slugifyTR(payload.workplaceTitle)}-${fileDate}.docx`;
};

export async function generateEmergencySupportAssignmentDocx(
  payload: EmergencySupportAssignmentPayload,
): Promise<void> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Acil durum destek elemanı ataması şablonu bulunamadı.");
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
    console.error("Emergency support assignment template render error", error);
    throw new Error("Acil durum destek elemanı ataması oluşturulamadı.");
  }

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  saveAs(blob, buildFileName(payload));
}
