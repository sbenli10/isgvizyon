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

const setCellRedFill = (cell: Element | undefined, active: boolean) => {
  if (!cell) return;

  const xml = cell.ownerDocument;
  const tcPr =
    getChildElements(cell, "tcPr")[0] ??
    (() => {
      const created = createElement(xml, WORD_NS, "w:tcPr");
      cell.insertBefore(created, cell.firstChild);
      return created;
    })();

  const existingShading = getChildElements(tcPr, "shd")[0];

  if (!active) {
    if (existingShading) {
      tcPr.removeChild(existingShading);
    }
    return;
  }

  const shading = existingShading ?? createElement(xml, WORD_NS, "w:shd");
  shading.setAttribute("w:val", "clear");
  shading.setAttribute("w:color", "auto");
  shading.setAttribute("w:fill", "FF4D4F");

  if (!existingShading) {
    tcPr.appendChild(shading);
  }
};

const cloneRow = (table: Element, sourceRowIndex: number) => {
  const rows = getRows(table);
  const sourceRow = rows[sourceRowIndex] ?? rows[rows.length - 1];
  if (!sourceRow) {
    throw new Error("Word şablonunda çoğaltılacak satır bulunamadı.");
  }

  const clone = sourceRow.cloneNode(true) as Element;
  table.appendChild(clone);
  return clone;
};

const ensureRowCount = (table: Element, minimumCount: number, templateRowIndex: number) => {
  let rows = getRows(table);
  while (rows.length < minimumCount) {
    cloneRow(table, templateRowIndex);
    rows = getRows(table);
  }
  return rows;
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

const clearMatrixRow = (row: Element | undefined) => {
  const cells = getCells(row);
  cells.forEach((cell, cellIndex) => {
    setCellText(cell, "");
    if (cellIndex >= 5) {
      setCellRedFill(cell, false);
    }
  });
};

const writeMatrixRows = (
  table: Element,
  rows: AnnualWorkPlanRow[],
  startIndex: number,
  templateRowIndex: number,
) => {
  const tableRows = ensureRowCount(table, startIndex + rows.length, templateRowIndex);

  rows.forEach((row, index) => {
    const tableRow = tableRows[startIndex + index];
    const cells = getCells(tableRow);
    setCellText(cells[0], row.activity);
    setCellText(cells[1], row.period);
    setCellText(cells[2], row.responsible);
    setCellText(cells[3], row.regulation);
    setCellText(cells[4], row.currentStatus);

    row.months.forEach((active, monthIndex) => {
      setCellText(cells[monthIndex + 5], "");
      setCellRedFill(cells[monthIndex + 5], active);
    });
  });

  for (let rowIndex = startIndex + rows.length; rowIndex < tableRows.length; rowIndex += 1) {
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
  writeMatrixRows(mainTable, primaryRows, PRIMARY_TABLE_START_INDEX, PRIMARY_TABLE_START_INDEX);

  if (secondaryTable) {
    writeSecondaryTableHeader(secondaryTable, payload);
    writeMatrixRows(
      secondaryTable,
      secondaryRows,
      SECONDARY_TABLE_START_INDEX,
      SECONDARY_TABLE_START_INDEX,
    );
  } else if (secondaryRows.length > 0) {
    writeMatrixRows(
      mainTable,
      normalizedRows,
      PRIMARY_TABLE_START_INDEX,
      PRIMARY_TABLE_START_INDEX,
    );
  }
};

const buildDocumentBlob = async (payload: AnnualWorkPlanDocumentData) => {
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
