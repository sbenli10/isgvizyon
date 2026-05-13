import { saveAs } from "file-saver";
import JSZip from "jszip";

export const ANNUAL_EVALUATION_TEMPLATE_PATH = "/templates/YILLIK DEĞERLENDİRME RAPORU.docx";

export interface AnnualEvaluationWorkItem {
  yapilanCalismalar: string;
  tarih: string;
  yapanKisiUnvani: string;
  tekrarSayisi: string;
  kullanilanYontem: string;
  sonucYorum: string;
}

export interface AnnualEvaluationCompanyFormState {
  isyeriUnvani: string;
  sgkSicilNo: string;
  adres: string;
  telFax: string;
  eposta: string;
  iskolu: string;
  calisanErkek: string;
  calisanKadin: string;
  calisanGenc: string;
  calisanCocuk: string;
  calisanToplam: string;
}

export interface AnnualEvaluationOfficialDocxPayload {
  company: AnnualEvaluationCompanyFormState;
  works: AnnualEvaluationWorkItem[];
  year?: number;
}

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

type FrameMeta = { x: number; y: number; w: number };
type ParagraphMeta = { element: Element; index: number; text: string; frame: FrameMeta | null };

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const serializeXml = (xml: XMLDocument) => new XMLSerializer().serializeToString(xml);

const createElement = (xml: XMLDocument, name: string) => xml.createElementNS(WORD_NS, name);

const getChildElements = (parent: Element, tagName: string) =>
  Array.from(parent.childNodes).filter(
    (node): node is Element => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === tagName,
  );

const getParagraphs = (xml: XMLDocument) =>
  Array.from(xml.getElementsByTagNameNS(WORD_NS, "p")) as Element[];

const getTextNodes = (parent: Element) =>
  Array.from(parent.getElementsByTagNameNS(WORD_NS, "t")) as Element[];

const getRunNodes = (parent: Element) =>
  Array.from(parent.getElementsByTagNameNS(WORD_NS, "r")) as Element[];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s:./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getParagraphText = (paragraph: Element) =>
  getTextNodes(paragraph)
    .map((node) => node.textContent || "")
    .join("");

const getParagraphFrame = (paragraph: Element): FrameMeta | null => {
  const paragraphProperties = getChildElements(paragraph, "pPr")[0];
  if (!paragraphProperties) return null;

  const frame = getChildElements(paragraphProperties, "framePr")[0];
  if (!frame) return null;

  const x = Number(frame.getAttribute("w:x") || frame.getAttribute("x") || 0);
  const y = Number(frame.getAttribute("w:y") || frame.getAttribute("y") || 0);
  const w = Number(frame.getAttribute("w:w") || frame.getAttribute("w") || 0);

  return { x, y, w };
};

const setParagraphFrame = (
  paragraph: Element | undefined,
  updates: Partial<Pick<FrameMeta, "x" | "y" | "w">>,
) => {
  if (!paragraph) return;

  const paragraphProperties = getChildElements(paragraph, "pPr")[0];
  if (!paragraphProperties) return;

  const frame = getChildElements(paragraphProperties, "framePr")[0];
  if (!frame) return;

  if (typeof updates.x === "number") {
    frame.setAttribute("w:x", String(updates.x));
  }
  if (typeof updates.y === "number") {
    frame.setAttribute("w:y", String(updates.y));
  }
  if (typeof updates.w === "number") {
    frame.setAttribute("w:w", String(updates.w));
  }
};

const createRunWithText = (paragraph: Element, value: string) => {
  const xml = paragraph.ownerDocument;
  const run = createElement(xml, "w:r");
  const text = createElement(xml, "w:t");
  text.setAttribute("xml:space", "preserve");
  text.textContent = value;
  run.appendChild(text);
  paragraph.appendChild(run);
  return text;
};

const setParagraphText = (paragraph: Element | undefined, value: string) => {
  if (!paragraph) return;

  const runs = getRunNodes(paragraph);
  if (runs.length === 0) {
    createRunWithText(paragraph, value);
    return;
  }

  const textNodes = getTextNodes(paragraph);
  if (textNodes.length === 0) {
    createRunWithText(paragraph, value);
    return;
  }

  textNodes[0].textContent = value;
  textNodes.slice(1).forEach((node) => {
    node.textContent = "";
  });
};

const buildParagraphMeta = (xml: XMLDocument): ParagraphMeta[] =>
  getParagraphs(xml).map((element, index) => ({
    element,
    index,
    text: getParagraphText(element),
    frame: getParagraphFrame(element),
  }));

const findParagraphByLabel = (paragraphs: ParagraphMeta[], label: string) => {
  const normalizedLabel = normalizeText(label);
  return paragraphs.find((paragraph) => normalizeText(paragraph.text) === normalizedLabel);
};

const clearTrailingPages = (xml: XMLDocument) => {
  const body = xml.getElementsByTagNameNS(WORD_NS, "body")[0];
  if (!body) return;

  const children = Array.from(body.childNodes);
  let removeFromIndex = -1;

  children.forEach((node, index) => {
    if (removeFromIndex !== -1 || node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element.localName !== "p") return;

    const breaks = Array.from(element.getElementsByTagNameNS(WORD_NS, "br"));
    const hasPageBreak = breaks.some((breakNode) => (breakNode as Element).getAttribute("w:type") === "page");
    if (hasPageBreak) {
      removeFromIndex = index;
    }
  });

  if (removeFromIndex === -1) return;

  for (let index = children.length - 1; index >= removeFromIndex; index -= 1) {
    const node = children[index];
    if (node.nodeType !== Node.ELEMENT_NODE) {
      body.removeChild(node);
      continue;
    }

    const element = node as Element;
    if (element.localName === "sectPr") {
      continue;
    }

    body.removeChild(node);
  }
};

const setLabelValue = (paragraphs: ParagraphMeta[], label: string, value: string) => {
  const paragraph = findParagraphByLabel(paragraphs, label);
  if (!paragraph) return;

  const suffix = label.includes(":") ? "" : " :";
  setParagraphText(paragraph.element, `${label}${suffix} ${value}`.trim());
};

const setInlineValue = (
  paragraphs: ParagraphMeta[],
  label: string,
  value: string,
  width: number,
) => {
  const paragraph = findParagraphByLabel(paragraphs, label);
  if (!paragraph) return;

  const suffix = label.includes(":") ? "" : " :";
  setParagraphFrame(paragraph.element, { w: width });
  setParagraphText(paragraph.element, `${label}${suffix} ${value}`.trim());
};

const setHeaderTitle = (paragraphs: ParagraphMeta[], year?: number) => {
  const titleParagraph = paragraphs.find((paragraph) =>
    normalizeText(paragraph.text).startsWith(normalizeText("YILLIK DEGERLENDIRME RAPORU")),
  );
  if (!titleParagraph) return;

  const resolvedYear = year || new Date().getFullYear();
  setParagraphText(titleParagraph.element, `YILLIK DEĞERLENDİRME RAPORU (${resolvedYear})`);
};

const formatWorkRow = (item: AnnualEvaluationWorkItem, index: number) =>
  [
    `${index + 1}. ${item.yapilanCalismalar || "-"}`,
    `Tarih: ${item.tarih || "-"}`,
    `Yapan: ${item.yapanKisiUnvani || "-"}`,
    `Tekrar: ${item.tekrarSayisi || "-"}`,
    `Yöntem: ${item.kullanilanYontem || "-"}`,
    `Sonuç: ${item.sonucYorum || "-"}`,
  ].join(" | ");

const WORK_ROW_PARAGRAPH_INDEXES = [26, 27, 28, 29, 31, 32] as const;
const WORK_ROW_FRAME = { x: 532, w: 13913 };
const UNUSED_WORK_PARAGRAPH_INDEXES = [30, 33, 34] as const;

const bindWorkItems = (paragraphs: ParagraphMeta[], works: AnnualEvaluationWorkItem[]) => {
  WORK_ROW_PARAGRAPH_INDEXES.forEach((paragraphIndex, index) => {
    const paragraph = paragraphs[paragraphIndex];
    if (!paragraph) return;

    setParagraphFrame(paragraph.element, WORK_ROW_FRAME);
    setParagraphText(paragraph.element, works[index] ? formatWorkRow(works[index], index) : "");
  });

  UNUSED_WORK_PARAGRAPH_INDEXES.forEach((paragraphIndex) => {
    const paragraph = paragraphs[paragraphIndex];
    if (!paragraph) return;
    setParagraphText(paragraph.element, "");
  });
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

const buildDocumentBlob = async (payload: AnnualEvaluationOfficialDocxPayload) => {
  const response = await fetch(ANNUAL_EVALUATION_TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Yıllık değerlendirme raporu şablonu yüklenemedi.");
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new Error("Şablon içindeki Word XML dosyası okunamadı.");
  }

  const xml = parseXml(documentXml);
  clearTrailingPages(xml);

  const paragraphs = buildParagraphMeta(xml);
  setHeaderTitle(paragraphs, payload.year);
  setInlineValue(paragraphs, "Unvani", payload.company.isyeriUnvani, 5200);
  setLabelValue(paragraphs, "SGK/Bölge Müdürlüğü Sicil No:", payload.company.sgkSicilNo);
  setInlineValue(paragraphs, "Adres", payload.company.adres, 6200);
  setInlineValue(paragraphs, "Tel ve Fax :", payload.company.telFax, 4200);
  setInlineValue(paragraphs, "E-posta:", payload.company.eposta, 3500);
  setInlineValue(paragraphs, "Iskolu", payload.company.iskolu, 3400);
  setLabelValue(paragraphs, "Erkek :", payload.company.calisanErkek);
  setLabelValue(paragraphs, "Kadin:", payload.company.calisanKadin);
  setLabelValue(paragraphs, "Genç:", payload.company.calisanGenc);
  setLabelValue(paragraphs, "Çocuk:", payload.company.calisanCocuk);
  setLabelValue(paragraphs, "Toplam:", payload.company.calisanToplam);
  bindWorkItems(paragraphs, payload.works);

  zip.file("word/document.xml", serializeXml(xml));
  return zip.generateAsync({ type: "blob" });
};

export const downloadAnnualEvaluationOfficialDocx = async (
  payload: AnnualEvaluationOfficialDocxPayload,
) => {
  const blob = await buildDocumentBlob(payload);
  const fileName = sanitizeFileName("YILLIK_DEGERLENDIRME_RAPORU");
  saveAs(blob, `${fileName}.docx`);
};
