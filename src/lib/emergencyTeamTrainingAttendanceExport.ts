import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/Acil_Durum_Ekipleri_Egitim_Katilim_Formu.docx";
const PARTICIPANT_ROW_COUNT = 22;
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type EmergencyTeamTrainingParticipant = {
  fullName: string;
  tcNo: string;
  team: string;
};

export type EmergencyTeamTrainingAttendancePayload = {
  trainingTopics: string;
  trainingDate: string;
  trainingPlace: string;
  participants: EmergencyTeamTrainingParticipant[];
  signatures: {
    safetyExpertName: string;
    workplaceDoctorName: string;
    employerName: string;
  };
};

export const EMERGENCY_TEAM_OPTIONS = [
  "SÖNDÜRME EKİBİ",
  "KURTARMA EKİBİ",
  "KORUMA EKİBİ",
  "İLK YARDIM EKİBİ",
] as const;

export const DEFAULT_EMERGENCY_TEAM_TOPICS =
  "• Binaların Yangından Korunması Hakkında Yönetmelik\n" +
  "• Bina Analizi ve Tehlikeler\n" +
  "• Yangına neden Olabilecek Risklerin Tespiti\n" +
  "• Yangın ve Yanma Kimyası\n" +
  "• Yangın Söndürücülerin Sınıflandırılması ve Teknik Özellikleri\n" +
  "• Yangın Algılama, Uyarı, Söndürme ve Tahliye Sistemlerinin Kullanımı\n" +
  "• Yangın Söndürme Güvenliği\n" +
  "• Yangın İhbar Verme ve İşletme İçi İletişim\n" +
  "• Acil Durum Planının Değerlendirilmesi\n" +
  "• Ekip Liderleri ve Görevleri\n" +
  "• Temel Tahliye Eğitimi\n" +
  "• Tahliye Tatbikatında Yapılması Gerekenler\n" +
  "• Kişisel Koruyucu Ekipman Kullanımı\n" +
  "• Temel Afet Bilinci\n" +
  "• Afet ve Acil Durumlar\n" +
  "• Afet ve Acil Durum Planları\n" +
  "• Afetlere Hazırlık\n" +
  "• Ekiplerin Kurulması ve Görevleri\n" +
  "• Arama Kurtarma Eğitimi\n" +
  "• Arama Stratejileri ve Çeşitleri\n" +
  "• Alan Güvenliği\n" +
  "• Olay, İhbar\n" +
  "• Kurtarmada İpler ve Düğümler\n" +
  "• Afetlerde İlk Yardım Bilgilendirilmesi\n" +
  "• Arama ve Dinlenme Evreleri\n" +
  "• Tahkimat ve Destek Malzemeleri";

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
    .slice(0, 90) || "acil-durum-ekipleri";

const defaultTeamForRow = (index: number) => {
  if (index < 4) return "SÖNDÜRME EKİBİ";
  if (index < 8) return "KURTARMA EKİBİ";
  if (index < 12) return "KORUMA EKİBİ";
  return "İLK YARDIM EKİBİ";
};

const normalizeParticipants = (participants: EmergencyTeamTrainingParticipant[]) =>
  Array.from(
    { length: PARTICIPANT_ROW_COUNT },
    (_, index) =>
      participants[index] || {
        fullName: "",
        tcNo: "",
        team: defaultTeamForRow(index),
      },
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

  const informationRows = getTableRows(tables[1]);
  setCellText(xmlDocument, getRowCells(informationRows[0])[1], "{trainingTopics}");
  setCellText(xmlDocument, getRowCells(informationRows[1])[1], "{trainingDate}");
  setCellText(xmlDocument, getRowCells(informationRows[2])[1], "{trainingPlace}");

  const participantRows = getTableRows(tables[2]);
  for (let index = 0; index < PARTICIPANT_ROW_COUNT; index += 1) {
    const rowCells = getRowCells(participantRows[index + 1]);
    setCellText(xmlDocument, rowCells[1], `{p${index + 1}FullName}`);
    setCellText(xmlDocument, rowCells[2], `{p${index + 1}TcNo}`);
    setCellText(xmlDocument, rowCells[3], `{p${index + 1}Team}`);
  }

  const signatureRows = getTableRows(tables[3]);
  const signatureCells = getRowCells(signatureRows[1]);
  setCellText(xmlDocument, signatureCells[0], "{safetyExpertName}");
  setCellText(xmlDocument, signatureCells[1], "{workplaceDoctorName}");
  setCellText(xmlDocument, signatureCells[2], "{employerName}");

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
};

const buildTemplateData = (payload: EmergencyTeamTrainingAttendancePayload) => {
  const participants = normalizeParticipants(payload.participants);
  const data: Record<string, string> = {
    trainingTopics: cleanText(payload.trainingTopics),
    trainingDate: formatDateTR(payload.trainingDate),
    trainingPlace: cleanText(payload.trainingPlace),
    safetyExpertName: cleanText(payload.signatures.safetyExpertName),
    workplaceDoctorName: cleanText(payload.signatures.workplaceDoctorName),
    employerName: cleanText(payload.signatures.employerName),
  };

  participants.forEach((participant, index) => {
    data[`p${index + 1}FullName`] = cleanText(participant.fullName);
    data[`p${index + 1}TcNo`] = cleanText(participant.tcNo);
    data[`p${index + 1}Team`] = cleanText(participant.team) || defaultTeamForRow(index);
  });

  return data;
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
  const fileDate = new Date().toISOString().slice(0, 10);
  saveAs(blob, `acil-durum-ekipleri-egitim-katilim-formu-${slugifyTR(payload.trainingPlace)}-${fileDate}.docx`);
}
