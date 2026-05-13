import { saveAs } from "file-saver";
import JSZip from "jszip";

export const ANNUAL_WORK_PLAN_TEMPLATE_PATH =
  "/templates/İŞ SAĞLIĞI ve GÜVENLİĞİ YILLIK ÇALIŞMA PLANI.docx";

export interface AnnualWorkPlanCompanyInfo {
  companyName: string;
  address: string;
  registrationNumber: string;
  year: number;
}

export interface AnnualWorkPlanRow {
  id: string;
  activity: string;
  period: string;
  responsible: string;
  regulation: string;
  currentStatus: string;
  months: boolean[];
}

export interface AnnualWorkPlanDocumentData {
  company: AnnualWorkPlanCompanyInfo;
  rows: AnnualWorkPlanRow[];
}

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const serializeXml = (xml: XMLDocument) => new XMLSerializer().serializeToString(xml);

const createParagraph = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:p");
const createRun = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:r");
const createText = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:t");
const createElement = (xml: XMLDocument, ns: string, name: string) => xml.createElementNS(ns, name);

const getChildElements = (parent: Element, tagName: string) =>
  Array.from(parent.childNodes).filter(
    (node): node is Element => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === tagName,
  );

const getTables = (xml: XMLDocument) =>
  Array.from(xml.getElementsByTagNameNS(WORD_NS, "tbl")) as Element[];

const getRows = (table: Element | undefined) => (table ? getChildElements(table, "tr") : []);
const getCells = (row: Element | undefined) => (row ? getChildElements(row, "tc") : []);

const getTextNodes = (parent: Element) =>
  Array.from(parent.getElementsByTagNameNS(WORD_NS, "t")) as Element[];

const getRunNodes = (parent: Element) =>
  Array.from(parent.getElementsByTagNameNS(WORD_NS, "r")) as Element[];

const getOrCreateRunProperties = (run: Element) => {
  const existing = getChildElements(run, "rPr")[0];
  if (existing) return existing;

  const created = createElement(run.ownerDocument, WORD_NS, "w:rPr");
  run.insertBefore(created, run.firstChild);
  return created;
};

const clearRunFormatting = (run: Element) => {
  const runProperties = getChildElements(run, "rPr")[0];
  if (!runProperties) return;

  getChildElements(runProperties, "color").forEach((node) => runProperties.removeChild(node));
  getChildElements(runProperties, "b").forEach((node) => runProperties.removeChild(node));
};

const getOrCreateTextNode = (cell: Element) => {
  const textNodes = getTextNodes(cell);
  if (textNodes.length > 0) return textNodes[0];

  const xml = cell.ownerDocument;
  const paragraph = createParagraph(xml);
  const run = createRun(xml);
  const text = createText(xml);
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

const setMonthCellMarker = (cell: Element | undefined, active: boolean) => {
  if (!cell) return;

  setCellText(cell, active ? "X" : "");

  const runs = getRunNodes(cell);
  runs.forEach((run) => clearRunFormatting(run));

  if (!active || runs.length === 0) return;

  const runProperties = getOrCreateRunProperties(runs[0]);
  const bold = createElement(cell.ownerDocument, WORD_NS, "w:b");
  const color = createElement(cell.ownerDocument, WORD_NS, "w:color");
  color.setAttribute("w:val", "C00000");
  runProperties.appendChild(bold);
  runProperties.appendChild(color);
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeRows = (rows: AnnualWorkPlanRow[]) =>
  rows.map((row) => ({
    ...row,
    months: Array.from({ length: 12 }, (_, index) => Boolean(row.months[index])),
  }));

const PRIMARY_TABLE_START_INDEX = 6;
const PRIMARY_TABLE_TEMPLATE_ROWS = 14;
const SECONDARY_TABLE_START_INDEX = 2;
const SECONDARY_TABLE_TEMPLATE_ROWS = 11;

const clearMatrixRow = (row: Element | undefined) => {
  const cells = getCells(row);
  cells.forEach((cell, cellIndex) => {
    setCellText(cell, "");
    if (cellIndex >= 5) {
      setMonthCellMarker(cell, false);
    }
  });
};

const writeMatrixRows = (table: Element, rows: AnnualWorkPlanRow[], startIndex: number) => {
  const tableRows = getRows(table);

  rows.forEach((row, index) => {
    const tableRow = tableRows[startIndex + index];
    const cells = getCells(tableRow);
    setCellText(cells[0], row.activity);
    setCellText(cells[1], row.period);
    setCellText(cells[2], row.responsible);
    setCellText(cells[3], row.regulation);
    setCellText(cells[4], row.currentStatus);

    row.months.forEach((active, monthIndex) => {
      setMonthCellMarker(cells[monthIndex + 5], active);
    });
  });

  const maxWritableRowIndex = startIndex + rows.length;
  for (let rowIndex = maxWritableRowIndex; rowIndex < tableRows.length; rowIndex += 1) {
    clearMatrixRow(tableRows[rowIndex]);
  }
};

const writeMainTableHeader = (table: Element, payload: AnnualWorkPlanDocumentData) => {
  const tableRows = getRows(table);
  setCellText(getCells(tableRows[1])[0], `${payload.company.year} YILI ÇALIŞMA PLANI`);
  setCellText(getCells(tableRows[2])[1], payload.company.companyName);
  setCellText(getCells(tableRows[2])[3], payload.company.address);
  setCellText(getCells(tableRows[3])[1], payload.company.registrationNumber);
};

const writeSecondaryTableHeader = (table: Element, payload: AnnualWorkPlanDocumentData) => {
  const tableRows = getRows(table);
  if (tableRows[1]) {
    setCellText(getCells(tableRows[1])[0], `${payload.company.year} YILI ÇALIŞMA PLANI`);
  }
};

const writeOfficialTables = (tables: Element[], payload: AnnualWorkPlanDocumentData) => {
  const normalizedRows = normalizeRows(payload.rows);
  const mainTable = tables[0];
  const secondaryTable = tables[1];

  if (!mainTable) {
    throw new Error("Resmi çalışma planı tablosu şablonda bulunamadı.");
  }

  const primaryRows = normalizedRows.slice(0, PRIMARY_TABLE_TEMPLATE_ROWS);
  const secondaryRows = normalizedRows.slice(PRIMARY_TABLE_TEMPLATE_ROWS);

  writeMainTableHeader(mainTable, payload);
  writeMatrixRows(mainTable, primaryRows, PRIMARY_TABLE_START_INDEX);

  if (secondaryTable) {
    writeSecondaryTableHeader(secondaryTable, payload);
    writeMatrixRows(secondaryTable, secondaryRows, SECONDARY_TABLE_START_INDEX);
  }
};

const buildDocumentBlob = async (payload: AnnualWorkPlanDocumentData) => {
  const templateCapacity = PRIMARY_TABLE_TEMPLATE_ROWS + SECONDARY_TABLE_TEMPLATE_ROWS;
  if (payload.rows.length > templateCapacity) {
    throw new Error(
      `Resmi şablon en fazla ${templateCapacity} faaliyet satırını destekliyor. Fazla satırlar sayfa düzenini bozacağı için Word çıktısı oluşturulmadı.`,
    );
  }

  const response = await fetch(ANNUAL_WORK_PLAN_TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Yıllık çalışma planı Word şablonu yüklenemedi.");
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new Error("Şablon içindeki Word XML dosyası okunamadı.");
  }

  const xml = parseXml(documentXml);
  const tables = getTables(xml);
  writeOfficialTables(tables, payload);
  zip.file("word/document.xml", serializeXml(xml));

  return zip.generateAsync({ type: "blob" });
};

export const downloadAnnualWorkPlanOfficialDocx = async (payload: AnnualWorkPlanDocumentData) => {
  const blob = await buildDocumentBlob(payload);
  const fileName = sanitizeFileName(
    `Yillik-Calisma-Plani-${payload.company.companyName || "Firma"}-${payload.company.year}`,
  );
  saveAs(blob, `${fileName}.docx`);
};
