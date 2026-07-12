import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/Acil_Durum_Ekipleri_Egitim_Katilim_Formu.docx";
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const PARTICIPANT_ROW_COUNT = 22;

export type EmergencyTeamTrainingParticipant = {
  fullName: string;
  tcNo: string;
  team: string;
};

export type EmergencyTeamTrainingAttendancePayload = {
  trainingTopic: string;
  trainingDate: string;
  trainingPlace: string;
  participants: EmergencyTeamTrainingParticipant[];
  signatures: {
    safetyExpertName: string;
    workplaceDoctorName: string;
    employerName: string;
  };
};

const defaultTeams = [
  ...Array.from({ length: 4 }, () => "SÖNDÜRME EKİBİ"),
  ...Array.from({ length: 4 }, () => "KURTARMA EKİBİ"),
  ...Array.from({ length: 4 }, () => "KORUMA EKİBİ"),
  ...Array.from({ length: 10 }, () => "İLK YARDIM EKİBİ"),
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

const normalizeParticipants = (participants: EmergencyTeamTrainingParticipant[]) =>
  Array.from({ length: PARTICIPANT_ROW_COUNT }, (_, index) => ({
    fullName: cleanText(participants[index]?.fullName),
    tcNo: cleanText(participants[index]?.tcNo),
    team: cleanText(participants[index]?.team) || defaultTeams[index] || "",
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
  const informationRows = getTableRows(tables[1]);
  const participantRows = getTableRows(tables[2]);
  const signatureRows = getTableRows(tables[3]);

  setCellText(xmlDocument, getRowCells(informationRows[0])[1], "{trainingTopic}");
  setCellText(xmlDocument, getRowCells(informationRows[1])[1], "{trainingDate}");
  setCellText(xmlDocument, getRowCells(informationRows[2])[1], "{trainingPlace}");

  for (let index = 0; index < PARTICIPANT_ROW_COUNT; index += 1) {
    const rowCells = getRowCells(participantRows[index + 1]);
    setCellText(xmlDocument, rowCells[1], `{p${index + 1}FullName}`);
    setCellText(xmlDocument, rowCells[2], `{p${index + 1}TcNo}`);
    setCellText(xmlDocument, rowCells[3], `{p${index + 1}Team}`);
  }

  const signatureCells = getRowCells(signatureRows[1]);
  setCellText(xmlDocument, signatureCells[0], "{safetyExpertName}");
  setCellText(xmlDocument, signatureCells[1], "{workplaceDoctorName}");
  setCellText(xmlDocument, signatureCells[2], "{employerName}");

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
};

const buildTemplateData = (payload: EmergencyTeamTrainingAttendancePayload) => {
  const participants = normalizeParticipants(payload.participants);
  const data: Record<string, string> = {
    trainingTopic: cleanText(payload.trainingTopic),
    trainingDate: formatDateTR(payload.trainingDate),
    trainingPlace: cleanText(payload.trainingPlace),
    safetyExpertName: cleanText(payload.signatures.safetyExpertName),
    workplaceDoctorName: cleanText(payload.signatures.workplaceDoctorName),
    employerName: cleanText(payload.signatures.employerName),
    "60D5717B-0717-4489-8D7E-F44C90DE6822": "{60D5717B-0717-4489-8D7E-F44C90DE6822}",
  };

  participants.forEach((participant, index) => {
    data[`p${index + 1}FullName`] = participant.fullName;
    data[`p${index + 1}TcNo`] = participant.tcNo;
    data[`p${index + 1}Team`] = participant.team;
  });

  return data;
};

const buildFileName = (payload: EmergencyTeamTrainingAttendancePayload) => {
  const fileDate = new Date().toISOString().slice(0, 10);
  return `acil-durum-ekipleri-egitim-katilim-formu-${slugifyTR(payload.trainingPlace)}-${fileDate}.docx`;
};

export async function generateEmergencyTeamTrainingAttendanceDocx(
  payload: EmergencyTeamTrainingAttendancePayload,
): Promise<void> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Acil durum ekipleri eğitim katılım formu şablonu bulunamadı.");
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
    console.error("Emergency team training attendance template render error", error);
    throw new Error("Acil durum ekipleri eğitim katılım formu oluşturulamadı.");
  }

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  saveAs(blob, buildFileName(payload));
}
