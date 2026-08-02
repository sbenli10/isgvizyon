import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/Risk_Degerlendirme_Ekipleri_Egitim_Katilim_Formu.docx";
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const TEMPLATE_PARTICIPANT_ROW_COUNT = 16;
const PARTICIPANT_START_ROW_INDEX = 8;

export type RiskAssessmentTeamTrainingParticipant = {
  fullName: string;
  tcNo: string;
  role: string;
};

export type RiskAssessmentTeamTrainingAttendancePayload = {
  organizationName: string;
  address: string;
  sgkRegistrationNo: string;
  trainingDate: string;
  trainingDuration: string;
  trainingTitle: string;
  trainingTopics: string;
  participants: RiskAssessmentTeamTrainingParticipant[];
  signatures: {
    safetyExpertName: string;
    workplaceDoctorName: string;
    employerName: string;
  };
};

const defaultRoles = [
  "ÇALIŞAN BAŞ TEMSİLCİSİ",
  "TÜM BİRİMLERDEN BİLGİ SAHİBİ KİŞİ",
  "SÖNDÜRME EKİBİ",
  "SÖNDÜRME EKİBİ",
  "SÖNDÜRME EKİBİ",
  "SÖNDÜRME EKİBİ",
  "KURTARMA EKİBİ",
  "KURTARMA EKİBİ",
  "KURTARMA EKİBİ",
  "KURTARMA EKİBİ",
  "KORUMA EKİBİ",
  "KORUMA EKİBİ",
  "KORUMA EKİBİ",
  "KORUMA EKİBİ",
  "İLK YARDIM EKİBİ",
  "İLK YARDIM EKİBİ",
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
    .slice(0, 90) || "risk-degerlendirme-egitimi";

const normalizeParticipants = (participants: RiskAssessmentTeamTrainingParticipant[]) =>
  participants.length > 0
    ? participants.map((participant, index) => ({
        fullName: cleanText(participant.fullName),
        tcNo: cleanText(participant.tcNo),
        role: cleanText(participant.role) || defaultRoles[index] || "",
      }))
    : [{ fullName: "", tcNo: "", role: defaultRoles[0] || "" }];

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

const fitParticipantRows = (table: Element | undefined, rows: Element[], participantCount: number) => {
  if (!table) return;

  const requiredCount = Math.max(1, participantCount);
  const templateRows = rows.slice(PARTICIPANT_START_ROW_INDEX, PARTICIPANT_START_ROW_INDEX + TEMPLATE_PARTICIPANT_ROW_COUNT);
  const cloneSource = templateRows[templateRows.length - 1] || templateRows[0];

  if (!cloneSource) return;

  while (templateRows.length < requiredCount) {
    const clonedRow = cloneSource.cloneNode(true) as Element;
    table.appendChild(clonedRow);
    templateRows.push(clonedRow);
  }

  while (templateRows.length > requiredCount) {
    const row = templateRows.pop();
    row?.parentNode?.removeChild(row);
  }

  templateRows.forEach((row, index) => {
    const rowCells = getRowCells(row);
    setCellText(row.ownerDocument, rowCells[0], String(index + 1));
    setCellText(row.ownerDocument, rowCells[1], `{p${index + 1}FullName}`);
    setCellText(row.ownerDocument, rowCells[2], `{p${index + 1}TcNo}`);
    setCellText(row.ownerDocument, rowCells[3], `{p${index + 1}Role}`);
  });
};

const prepareTemplatePlaceholders = (zip: PizZip, participantCount: number) => {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return;

  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(documentFile.asText(), "application/xml");
  const tables = Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "tbl"));
  const mainRows = getTableRows(tables[0]);
  const signatureRows = getTableRows(tables[1]);

  setCellText(xmlDocument, getRowCells(mainRows[1])[1], "{organizationName}");
  setCellText(xmlDocument, getRowCells(mainRows[2])[1], "{address}");
  setCellText(xmlDocument, getRowCells(mainRows[3])[1], "{sgkRegistrationNo}");
  setCellText(xmlDocument, getRowCells(mainRows[4])[1], "{trainingDate}");
  setCellText(xmlDocument, getRowCells(mainRows[4])[3], "{trainingDuration}");
  setCellText(xmlDocument, getRowCells(mainRows[5])[1], "{trainingTitle}");
  setCellText(xmlDocument, getRowCells(mainRows[6])[1], "{trainingTopics}");

  fitParticipantRows(tables[0], mainRows, participantCount);

  const signatureCells = getRowCells(signatureRows[1]);
  setCellText(xmlDocument, signatureCells[0], "{safetyExpertName}");
  setCellText(xmlDocument, signatureCells[1], "{workplaceDoctorName}");
  setCellText(xmlDocument, signatureCells[2], "{employerName}");

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
};

const buildTemplateData = (payload: RiskAssessmentTeamTrainingAttendancePayload) => {
  const participants = normalizeParticipants(payload.participants);
  const data: Record<string, string> = {
    organizationName: cleanText(payload.organizationName),
    address: cleanText(payload.address),
    sgkRegistrationNo: cleanText(payload.sgkRegistrationNo),
    trainingDate: formatDateTR(payload.trainingDate),
    trainingDuration: cleanText(payload.trainingDuration),
    trainingTitle: cleanText(payload.trainingTitle),
    trainingTopics: cleanText(payload.trainingTopics),
    safetyExpertName: cleanText(payload.signatures.safetyExpertName),
    workplaceDoctorName: cleanText(payload.signatures.workplaceDoctorName),
    employerName: cleanText(payload.signatures.employerName),
    "60D5717B-0717-4489-8D7E-F44C90DE6822": "{60D5717B-0717-4489-8D7E-F44C90DE6822}",
  };

  participants.forEach((participant, index) => {
    data[`p${index + 1}FullName`] = participant.fullName;
    data[`p${index + 1}TcNo`] = participant.tcNo;
    data[`p${index + 1}Role`] = participant.role;
  });

  return data;
};

const buildFileName = (payload: RiskAssessmentTeamTrainingAttendancePayload) => {
  const fileDate = new Date().toISOString().slice(0, 10);
  return `risk-degerlendirme-ekipleri-egitim-katilim-formu-${slugifyTR(payload.organizationName)}-${fileDate}.docx`;
};

export async function generateRiskAssessmentTeamTrainingAttendanceDocx(
  payload: RiskAssessmentTeamTrainingAttendancePayload,
): Promise<void> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Risk değerlendirme ekipleri eğitim katılım formu şablonu bulunamadı.");
  }

  const templateBytes = await response.arrayBuffer();
  const zip = new PizZip(templateBytes);
  const normalizedParticipants = normalizeParticipants(payload.participants);
  prepareTemplatePlaceholders(zip, normalizedParticipants.length);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  try {
    doc.render(buildTemplateData({ ...payload, participants: normalizedParticipants }));
  } catch (error) {
    console.error("Risk assessment team training attendance template render error", error);
    throw new Error("Risk değerlendirme ekipleri eğitim katılım formu oluşturulamadı.");
  }

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  saveAs(blob, buildFileName(payload));
}
