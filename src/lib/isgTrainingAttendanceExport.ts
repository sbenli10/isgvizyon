import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/isg-egitim-katilim-listesi.docx";
const PARTICIPANT_ROW_COUNT = 13;
const SESSION_COUNT = 4;
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type TrainingAttendanceParticipant = {
  fullName: string;
  tcNo: string;
  profession: string;
};

export type TrainingAttendanceSession = {
  date: string;
  time: string;
};

export type TrainingAttendancePayload = {
  companyTitle: string;
  trainingPlace: string;
  topics: {
    general: string;
    health: string;
    technical: string;
    other: string;
  };
  sessions: TrainingAttendanceSession[];
  participants: TrainingAttendanceParticipant[];
  signatures: {
    safetyExpertName: string;
    workplaceDoctorName: string;
    employerName: string;
  };
};

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

const formatTimeTR = (value?: string | null) => {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return cleaned;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
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

const normalizeSessions = (sessions: TrainingAttendanceSession[]) =>
  Array.from({ length: SESSION_COUNT }, (_, index) => sessions[index] || { date: "", time: "" });

const normalizeParticipants = (participants: TrainingAttendanceParticipant[]) =>
  Array.from(
    { length: PARTICIPANT_ROW_COUNT },
    (_, index) => participants[index] || { fullName: "", tcNo: "", profession: "" },
  );

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
  const informationRows = getTableRows(tables[0]);
  const participantRows = getTableRows(tables[1]);

  setCellText(xmlDocument, getRowCells(informationRows[0])[1], "{companyTitle}");
  setCellText(xmlDocument, getRowCells(informationRows[1])[1], "{trainingPlace}");
  setCellText(xmlDocument, getRowCells(informationRows[2])[1], "{topicGeneral}");
  setCellText(xmlDocument, getRowCells(informationRows[2])[2], "{topicHealth}");
  setCellText(xmlDocument, getRowCells(informationRows[3])[1], "{topicTechnical}");
  setCellText(xmlDocument, getRowCells(informationRows[3])[2], "{topicOther}");

  const headerCells = getRowCells(participantRows[0]);
  for (let index = 0; index < SESSION_COUNT; index += 1) {
    setCellText(xmlDocument, headerCells[index + 4], `{session${index + 1}Date}\n{session${index + 1}Time}`);
  }

  for (let index = 0; index < PARTICIPANT_ROW_COUNT; index += 1) {
    const rowCells = getRowCells(participantRows[index + 1]);
    setCellText(xmlDocument, rowCells[1], `{p${index + 1}FullName}`);
    setCellText(xmlDocument, rowCells[2], `{p${index + 1}TcNo}`);
    setCellText(xmlDocument, rowCells[3], `{p${index + 1}Profession}`);
  }

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));

  const footerFile = zip.file("word/footer1.xml");
  if (!footerFile) return;

  const footerDocument = parser.parseFromString(footerFile.asText(), "application/xml");
  const footerTable = footerDocument.getElementsByTagNameNS(WORD_NAMESPACE, "tbl")[0];
  const footerCells = getRowCells(getTableRows(footerTable)[0]);
  setCellText(footerDocument, footerCells[0], "İG UZMANI\n{safetyExpertName}");
  setCellText(footerDocument, footerCells[1], "İŞYERİ HEKİMİ\n{workplaceDoctorName}");
  setCellText(footerDocument, footerCells[2], "İŞVEREN\n{employerName}");
  zip.file("word/footer1.xml", new XMLSerializer().serializeToString(footerDocument));
};

const buildTemplateData = (payload: TrainingAttendancePayload) => {
  const sessions = normalizeSessions(payload.sessions);
  const participants = normalizeParticipants(payload.participants);
  const data: Record<string, string> = {
    companyTitle: cleanText(payload.companyTitle),
    trainingPlace: cleanText(payload.trainingPlace),
    topicGeneral: cleanText(payload.topics.general),
    topicHealth: cleanText(payload.topics.health),
    topicTechnical: cleanText(payload.topics.technical),
    topicOther: cleanText(payload.topics.other),
    safetyExpertName: cleanText(payload.signatures.safetyExpertName),
    workplaceDoctorName: cleanText(payload.signatures.workplaceDoctorName),
    employerName: cleanText(payload.signatures.employerName),
    "60D5717B-0717-4489-8D7E-F44C90DE6822": "{60D5717B-0717-4489-8D7E-F44C90DE6822}",
  };

  sessions.forEach((session, index) => {
    data[`session${index + 1}Date`] = formatDateTR(session.date);
    data[`session${index + 1}Time`] = formatTimeTR(session.time);
  });

  participants.forEach((participant, index) => {
    data[`p${index + 1}FullName`] = cleanText(participant.fullName);
    data[`p${index + 1}TcNo`] = cleanText(participant.tcNo);
    data[`p${index + 1}Profession`] = cleanText(participant.profession);
  });

  return data;
};

export async function generateIsgTrainingAttendanceDocx(payload: TrainingAttendancePayload): Promise<void> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Eğitim katılım listesi şablonu bulunamadı.");
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
    console.error("ISG training attendance template render error", error);
    throw new Error("Eğitim katılım listesi oluşturulamadı.");
  }

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const fileDate = new Date().toISOString().slice(0, 10);
  saveAs(blob, `isg-egitim-katilim-listesi-${slugifyTR(payload.companyTitle)}-${fileDate}.docx`);
}
