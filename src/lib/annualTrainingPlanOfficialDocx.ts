import { saveAs } from "file-saver";
import JSZip from "jszip";

export const ANNUAL_TRAINING_PLAN_TEMPLATE_PATH =
  "/templates/%C4%B0%C5%9E%20SA%C4%9ELI%C4%9EI%20ve%20G%C3%9CVENL%C4%B0%C4%9E%C4%B0%20YILLIK%20E%C4%9E%C4%B0T%C4%B0M%20PLANI.docx";

export interface AnnualTrainingPlanItem {
  egitimKonusu: string;
  egitimiVerecekKisiKurulus: string;
  planlananTarih: string;
  gerceklesenTarih: string;
  aciklamalar: string;
}

export interface AnnualTrainingPlanFormState {
  isYeriUnvani: string;
  isYeriAdresi: string;
  isYeriSicilNo: string;
  isGuvenligiUzmani: string;
  isyeriHekimi: string;
  isverenVekili: string;
}

export interface AnnualTrainingPlanDocumentData {
  year: number;
  form: AnnualTrainingPlanFormState;
  items: AnnualTrainingPlanItem[];
}

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const HEADER_YEAR_ROW_INDEX = 1;
const COMPANY_ROW_INDEX = 2;
const SICIL_ROW_INDEX = 3;
const DATA_ROW_START_INDEX = 5;

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const serializeXml = (xml: XMLDocument) => new XMLSerializer().serializeToString(xml);
const createElement = (xml: XMLDocument, name: string) => xml.createElementNS(WORD_NS, name);

const getChildElements = (parent: Element, tagName: string) =>
  Array.from(parent.childNodes).filter(
    (node): node is Element =>
      node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === tagName,
  );

const getTables = (xml: XMLDocument) =>
  Array.from(xml.getElementsByTagNameNS(WORD_NS, "tbl")) as Element[];

const getRows = (table?: Element) => (table ? getChildElements(table, "tr") : []);
const getCells = (row?: Element) => (row ? getChildElements(row, "tc") : []);
const getParagraphs = (cell?: Element) => (cell ? getChildElements(cell, "p") : []);
const getTextNodes = (parent: Element) =>
  Array.from(parent.getElementsByTagNameNS(WORD_NS, "t")) as Element[];

const createParagraph = (xml: XMLDocument) => createElement(xml, "w:p");
const createRun = (xml: XMLDocument) => createElement(xml, "w:r");
const createText = (xml: XMLDocument) => createElement(xml, "w:t");

const getOrCreateTextNode = (cell: Element) => {
  const textNodes = getTextNodes(cell);
  if (textNodes.length > 0) return textNodes[0];

  const paragraph = createParagraph(cell.ownerDocument);
  const run = createRun(cell.ownerDocument);
  const text = createText(cell.ownerDocument);
  run.appendChild(text);
  paragraph.appendChild(run);
  cell.appendChild(paragraph);
  return text;
};

const setCellText = (cell: Element | undefined, value: string) => {
  if (!cell) return;

  const primaryNode = getOrCreateTextNode(cell);
  primaryNode.textContent = value;
  getTextNodes(cell)
    .slice(1)
    .forEach((node) => {
      node.textContent = "";
    });
};

const clearCellText = (cell: Element | undefined) => {
  if (!cell) return;
  getTextNodes(cell).forEach((node) => {
    node.textContent = "";
  });
};

const ensureParagraphText = (paragraph: Element, value: string) => {
  const textNodes = getTextNodes(paragraph);
  if (textNodes.length > 0) {
    textNodes[0].textContent = value;
    textNodes.slice(1).forEach((node) => {
      node.textContent = "";
    });
    return;
  }

  const run = createRun(paragraph.ownerDocument);
  const text = createText(paragraph.ownerDocument);
  text.textContent = value;
  run.appendChild(text);
  paragraph.appendChild(run);
};

const setSignatureCell = (cell: Element | undefined, value: string) => {
  if (!cell) return;

  const paragraphs = getParagraphs(cell);
  if (paragraphs.length === 0) {
    setCellText(cell, value);
    return;
  }

  const xml = cell.ownerDocument;
  const valueParagraph =
    paragraphs.length >= 2
      ? paragraphs[paragraphs.length - 1]
      : (() => {
          const paragraph = createParagraph(xml);
          cell.appendChild(paragraph);
          return paragraph;
        })();

  ensureParagraphText(valueParagraph, value);
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const getRowText = (row: Element | undefined) =>
  getCells(row)
    .flatMap((cell) => getTextNodes(cell).map((node) => node.textContent || ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const findRowIndex = (rows: Element[], predicate: (text: string) => boolean) =>
  rows.findIndex((row) => predicate(getRowText(row)));

const clearTrainingDataRow = (row: Element | undefined) => {
  const cells = getCells(row);
  if (cells.length === 0) return;

  clearCellText(cells[0]);
  for (let index = 1; index < cells.length; index += 1) {
    clearCellText(cells[index]);
  }
};

const cloneRow = (row: Element) => row.cloneNode(true) as Element;

const writeTrainingRows = (table: Element, items: AnnualTrainingPlanItem[]) => {
  const tableRows = getRows(table);
  const noteRowIndex = findRowIndex(tableRows, (text) => text.includes("*EĞİTİMLERİN SÜRESİ"));
  const noteRow = noteRowIndex >= 0 ? tableRows[noteRowIndex] : undefined;

  if (!noteRow) {
    throw new Error("Eğitim planı not satırı şablonda bulunamadı.");
  }

  const templateRow = tableRows[DATA_ROW_START_INDEX];
  if (!templateRow) {
    throw new Error("Eğitim planı örnek satırı şablonda bulunamadı.");
  }

  const initialTemplateCount = Math.max(1, noteRowIndex - DATA_ROW_START_INDEX);
  const requiredExtraRows = Math.max(0, items.length - initialTemplateCount);

  for (let index = 0; index < requiredExtraRows; index += 1) {
    const clonedRow = cloneRow(templateRow);
    clearTrainingDataRow(clonedRow);
    table.insertBefore(clonedRow, noteRow);
  }

  const writableRows = getRows(table).slice(DATA_ROW_START_INDEX, DATA_ROW_START_INDEX + items.length);

  items.forEach((item, index) => {
    const cells = getCells(writableRows[index]);
    setCellText(cells[0], String(index + 1));
    setCellText(cells[1], item.egitimKonusu);
    setCellText(cells[2], item.egitimiVerecekKisiKurulus);
    setCellText(cells[3], item.planlananTarih);
    setCellText(cells[4], item.gerceklesenTarih);
    setCellText(cells[5], item.aciklamalar);
  });

  const trailingRows = getRows(table).slice(
    DATA_ROW_START_INDEX + items.length,
    DATA_ROW_START_INDEX + initialTemplateCount + requiredExtraRows,
  );

  trailingRows.forEach((row) => {
    clearTrainingDataRow(row);
  });
};

const writeOfficialTable = (tables: Element[], payload: AnnualTrainingPlanDocumentData) => {
  const table = tables[0];
  if (!table) {
    throw new Error("Eğitim planı tablosu şablonda bulunamadı.");
  }

  const rows = getRows(table);
  setCellText(getCells(rows[HEADER_YEAR_ROW_INDEX])[0], `${payload.year} YILI EĞİTİM PLANI`);
  setCellText(getCells(rows[COMPANY_ROW_INDEX])[1], payload.form.isYeriUnvani);
  setCellText(getCells(rows[COMPANY_ROW_INDEX])[3], payload.form.isYeriAdresi);
  setCellText(getCells(rows[SICIL_ROW_INDEX])[1], payload.form.isYeriSicilNo);

  writeTrainingRows(table, payload.items);

  const updatedRows = getRows(table);
  const signatureRow = updatedRows[updatedRows.length - 1];
  if (!signatureRow) {
    throw new Error("Eğitim planı imza satırı şablonda bulunamadı.");
  }

  const signatureCells = getCells(signatureRow);
  if (signatureCells.length < 3) {
    throw new Error("Eğitim planı imza kutuları şablonda beklenen yapıda bulunamadı.");
  }

  setSignatureCell(signatureCells[0], payload.form.isGuvenligiUzmani);
  setSignatureCell(signatureCells[1], payload.form.isyeriHekimi);
  setSignatureCell(signatureCells[2], payload.form.isverenVekili);
};

const buildDocumentBlob = async (payload: AnnualTrainingPlanDocumentData) => {
  const response = await fetch(ANNUAL_TRAINING_PLAN_TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Yıllık eğitim planı Word şablonu yüklenemedi.");
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new Error("Şablon içindeki Word XML dosyası okunamadı.");
  }

  const xml = parseXml(documentXml);
  writeOfficialTable(getTables(xml), payload);
  zip.file("word/document.xml", serializeXml(xml));

  return zip.generateAsync({ type: "blob" });
};

export const downloadAnnualTrainingPlanOfficialDocx = async (
  payload: AnnualTrainingPlanDocumentData,
) => {
  const blob = await buildDocumentBlob(payload);
  const fileName = sanitizeFileName(
    `ISG-Yillik-Egitim-Plani-${payload.form.isYeriUnvani || "Firma"}-${payload.year}`,
  );
  saveAs(blob, `${fileName}.docx`);
};
