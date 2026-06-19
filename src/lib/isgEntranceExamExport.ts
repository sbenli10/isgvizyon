import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/isg-giris-sinavi.docx";
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type IsgEntranceExamPayload = {
  participantFullName: string;
  participantTcNo: string;
  trainingDate: string;
  signatureText: string;
  companyTitle: string;
  examResult: string;
};

const cleanText = (value?: string | number | null) => String(value ?? "").replace(/\s+/g, " ").trim();

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
    .slice(0, 90);

const createWordElement = (document: XMLDocument, tagName: string) =>
  document.createElementNS(WORD_NAMESPACE, `w:${tagName}`);

const getParagraphText = (paragraph: Element) =>
  Array.from(paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "t"))
    .map((node) => node.textContent || "")
    .join("");

const setParagraphText = (document: XMLDocument, paragraph: Element | undefined, text: string) => {
  if (!paragraph) return;

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

const prepareTemplatePlaceholders = (zip: PizZip) => {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return;

  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(documentFile.asText(), "application/xml");
  const paragraphs = Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "p"));

  const nameParagraph = paragraphs.find((paragraph) => getParagraphText(paragraph).includes("Adı Soyadı"));
  const tcDateParagraph = paragraphs.find((paragraph) => getParagraphText(paragraph).includes("Tc No"));
  const signatureParagraph = paragraphs.find((paragraph) => getParagraphText(paragraph).includes("İmza"));
  const companyResultParagraph = paragraphs.find((paragraph) => getParagraphText(paragraph).includes("FİRMA UNVANI"));

  setParagraphText(xmlDocument, nameParagraph, "Adı Soyadı : {participantFullName}");
  setParagraphText(
    xmlDocument,
    tcDateParagraph,
    "Tc No          : {participantTcNo}                                                   Eğitim Tarih : {trainingDate}",
  );
  setParagraphText(xmlDocument, signatureParagraph, "İmza            : {signatureText}");
  setParagraphText(xmlDocument, companyResultParagraph, "FİRMA UNVANI : {companyTitle}     Sınav Sonucu : {examResult}");

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
};

const buildTemplateData = (payload: IsgEntranceExamPayload) => ({
  participantFullName: cleanText(payload.participantFullName),
  participantTcNo: cleanText(payload.participantTcNo),
  trainingDate: formatDateTR(payload.trainingDate),
  signatureText: cleanText(payload.signatureText),
  companyTitle: cleanText(payload.companyTitle),
  examResult: cleanText(payload.examResult),
  "60D5717B-0717-4489-8D7E-F44C90DE6822": "{60D5717B-0717-4489-8D7E-F44C90DE6822}",
});

const buildFileName = (payload: IsgEntranceExamPayload) => {
  const fileDate = new Date().toISOString().slice(0, 10);
  const companySlug = slugifyTR(payload.companyTitle);
  const participantSlug = slugifyTR(payload.participantFullName);
  const suffix = [companySlug, participantSlug].filter(Boolean).join("-");

  return `isg-giris-sinavi-${suffix || "bos-form"}-${fileDate}.docx`;
};

export async function generateIsgEntranceExamDocx(payload: IsgEntranceExamPayload): Promise<void> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("İSG giriş sınavı şablonu bulunamadı.");
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
    console.error("ISG entrance exam template render error", error);
    throw new Error("İSG giriş sınavı oluşturulamadı.");
  }

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  saveAs(blob, buildFileName(payload));
}
