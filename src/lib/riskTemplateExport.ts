import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import JSZip from "jszip";

import { addInterFontsToJsPDF } from "@/utils/fonts";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const TEMPLATE_PATH = "/templates/risk-analizi-sablonu.docx";

export type RiskTemplatePerson = {
  fullName?: string;
  tcNo?: string;
  certificateNo?: string;
};

export type RiskTemplateEmergencyInfo = {
  allUnitsContact?: RiskTemplatePerson;
  fireChief?: RiskTemplatePerson;
  rescueChief?: RiskTemplatePerson;
  protectionChief?: RiskTemplatePerson;
  firstAidChief?: RiskTemplatePerson;
};

export type RiskTemplateCompanyInfo = {
  companyTitle: string;
  workplaceRegistryNo?: string;
  hazardClass?: string;
  assessmentDate?: string;
  validUntil?: string;
};

export type RiskTemplateTeamInfo = {
  employer: RiskTemplatePerson;
  employeeRepresentative: RiskTemplatePerson;
  safetyExpert: RiskTemplatePerson;
  workplaceDoctor: RiskTemplatePerson;
};

export type RiskTemplateRow = {
  no: number;
  departmentActivity?: string;
  hazardSource?: string;
  riskConsequence?: string;
  affectedPeople?: string;
  currentMeasure?: string;
  detectionDate?: string;
  probability?: string;
  frequency?: string;
  severity?: string;
  riskScore?: string;
  riskLevel?: string;
  additionalMeasures?: string;
  responsible?: string;
  deadline?: string;
  postProbability?: string;
  postFrequency?: string;
  postSeverity?: string;
  postRiskScore?: string;
  postRiskLevel?: string;
};

export type RiskTemplateExportPayload = {
  companyInfo: RiskTemplateCompanyInfo;
  teamInfo: RiskTemplateTeamInfo;
  emergencyInfo?: RiskTemplateEmergencyInfo;
  logoDataUrl?: string;
  riskItems: RiskTemplateRow[];
};

const cleanText = (value?: string | number | null) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeText = (value?: string | number | null) => cleanText(value).toLocaleLowerCase("tr-TR");
const parseXml = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const serializeXml = (xml: XMLDocument) => new XMLSerializer().serializeToString(xml);
const getElements = (parent: XMLDocument | Element, tagName: string): Element[] =>
  Array.from(parent.getElementsByTagNameNS(WORD_NS, tagName)) as Element[];
const getChildElements = (parent: Element, tagName: string) =>
  Array.from(parent.childNodes).filter(
    (node): node is Element => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === tagName,
  );
const getTables = (xml: XMLDocument) => getElements(xml, "tbl");
const getRows = (table?: Element | null) => (table ? getChildElements(table, "tr") : []);
const getCells = (row?: Element | null) => (row ? getChildElements(row, "tc") : []);
const getParagraphs = (parent: XMLDocument | Element) => getElements(parent, "p");
const getRuns = (parent: XMLDocument | Element) => getElements(parent, "r");
const getTextNodes = (parent: XMLDocument | Element) => getElements(parent, "t");
const createParagraph = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:p");
const createRun = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:r");
const createText = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:t");
const createBreak = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:br");
const createParagraphProps = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:pPr");
const createRunProps = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:rPr");
const createXmlElement = (xml: XMLDocument, namespace: string, tagName: string) => xml.createElementNS(namespace, tagName);

const getLogoMime = (dataUrl?: string) => {
  const match = cleanText(dataUrl).match(/^data:(image\/(?:png|jpeg|jpg));base64,/i);
  return match?.[1]?.toLowerCase() || "";
};

const dataUrlToArrayBuffer = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Logo okunamadi.");
  return response.arrayBuffer();
};

const getImageExtension = (mime: string) => (mime.includes("png") ? "png" : "jpg");

const ensureImageContentType = async (zip: JSZip, extension: string) => {
  const file = zip.file("[Content_Types].xml");
  if (!file) return;
  const xml = parseXml(await file.async("string"));
  const exists = Array.from(xml.getElementsByTagName("Default")).some(
    (node) => node.getAttribute("Extension") === extension,
  );
  if (!exists) {
    const node = xml.createElement("Default");
    node.setAttribute("Extension", extension);
    node.setAttribute("ContentType", extension === "png" ? "image/png" : "image/jpeg");
    xml.documentElement.appendChild(node);
    zip.file("[Content_Types].xml", serializeXml(xml));
  }
};

const addImageRelationship = async (zip: JSZip, dataUrl: string) => {
  const mime = getLogoMime(dataUrl);
  if (!mime) return null;
  const extension = getImageExtension(mime);
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (!relsFile) return null;

  const imageBuffer = await dataUrlToArrayBuffer(dataUrl);
  await ensureImageContentType(zip, extension);
  const relsDoc = parseXml(await relsFile.async("string"));
  const relationships = Array.from(relsDoc.getElementsByTagName("Relationship"));
  const nextRelNumber =
    relationships.reduce((max, relation) => {
      const id = relation.getAttribute("Id") || "";
      const numeric = Number(id.replace("rId", ""));
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0) + 1;

  const relId = `rId${nextRelNumber}`;
  const imageName = `risk-kapak-logo-${Date.now()}.${extension}`;
  zip.file(`word/media/${imageName}`, imageBuffer);

  const relationship = relsDoc.createElement("Relationship");
  relationship.setAttribute("Id", relId);
  relationship.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image");
  relationship.setAttribute("Target", `media/${imageName}`);
  relsDoc.documentElement.appendChild(relationship);
  zip.file("word/_rels/document.xml.rels", serializeXml(relsDoc));
  return { relId, imageName };
};

const createInlineImageRun = (xml: XMLDocument, relId: string, imageName: string) => {
  const run = createRun(xml);
  const drawing = createXmlElement(xml, WORD_NS, "w:drawing");
  const inline = createXmlElement(xml, WP_NS, "wp:inline");
  inline.setAttribute("distT", "0");
  inline.setAttribute("distB", "0");
  inline.setAttribute("distL", "0");
  inline.setAttribute("distR", "0");

  const extent = createXmlElement(xml, WP_NS, "wp:extent");
  extent.setAttribute("cx", "1350000");
  extent.setAttribute("cy", "675000");
  const effectExtent = createXmlElement(xml, WP_NS, "wp:effectExtent");
  effectExtent.setAttribute("l", "0");
  effectExtent.setAttribute("t", "0");
  effectExtent.setAttribute("r", "0");
  effectExtent.setAttribute("b", "0");
  const docPr = createXmlElement(xml, WP_NS, "wp:docPr");
  docPr.setAttribute("id", "6101");
  docPr.setAttribute("name", "Risk Analizi Kapak Logosu");
  const cNvGraphicFramePr = createXmlElement(xml, WP_NS, "wp:cNvGraphicFramePr");
  const graphic = createXmlElement(xml, DRAWING_NS, "a:graphic");
  const graphicData = createXmlElement(xml, DRAWING_NS, "a:graphicData");
  graphicData.setAttribute("uri", "http://schemas.openxmlformats.org/drawingml/2006/picture");
  const pic = createXmlElement(xml, PIC_NS, "pic:pic");
  const nvPicPr = createXmlElement(xml, PIC_NS, "pic:nvPicPr");
  const cNvPr = createXmlElement(xml, PIC_NS, "pic:cNvPr");
  cNvPr.setAttribute("id", "0");
  cNvPr.setAttribute("name", imageName);
  nvPicPr.appendChild(cNvPr);
  nvPicPr.appendChild(createXmlElement(xml, PIC_NS, "pic:cNvPicPr"));
  const blipFill = createXmlElement(xml, PIC_NS, "pic:blipFill");
  const blip = createXmlElement(xml, DRAWING_NS, "a:blip");
  blip.setAttributeNS(REL_NS, "r:embed", relId);
  const stretch = createXmlElement(xml, DRAWING_NS, "a:stretch");
  stretch.appendChild(createXmlElement(xml, DRAWING_NS, "a:fillRect"));
  blipFill.appendChild(blip);
  blipFill.appendChild(stretch);
  const spPr = createXmlElement(xml, PIC_NS, "pic:spPr");
  const xfrm = createXmlElement(xml, DRAWING_NS, "a:xfrm");
  const off = createXmlElement(xml, DRAWING_NS, "a:off");
  off.setAttribute("x", "0");
  off.setAttribute("y", "0");
  const ext = createXmlElement(xml, DRAWING_NS, "a:ext");
  ext.setAttribute("cx", "1350000");
  ext.setAttribute("cy", "675000");
  xfrm.appendChild(off);
  xfrm.appendChild(ext);
  const prstGeom = createXmlElement(xml, DRAWING_NS, "a:prstGeom");
  prstGeom.setAttribute("prst", "rect");
  prstGeom.appendChild(createXmlElement(xml, DRAWING_NS, "a:avLst"));
  spPr.appendChild(xfrm);
  spPr.appendChild(prstGeom);
  pic.appendChild(nvPicPr);
  pic.appendChild(blipFill);
  pic.appendChild(spPr);
  graphicData.appendChild(pic);
  graphic.appendChild(graphicData);
  inline.appendChild(extent);
  inline.appendChild(effectExtent);
  inline.appendChild(docPr);
  inline.appendChild(cNvGraphicFramePr);
  inline.appendChild(graphic);
  drawing.appendChild(inline);
  run.appendChild(drawing);
  return run;
};

const insertCoverLogoBeforeHeading = async (zip: JSZip, xml: XMLDocument, dataUrl?: string) => {
  if (!dataUrl) return;
  const image = await addImageRelationship(zip, dataUrl);
  if (!image) return;
  const heading = getParagraphs(xml).find((paragraph) => {
    const text = normalizeText(getParagraphText(paragraph));
    return text.includes("risk") && text.includes("anal") && text.includes("deger");
  });
  if (!heading?.parentNode) return;
  const paragraph = createParagraph(xml);
  setParagraphAlignment(paragraph, "center");
  paragraph.appendChild(createInlineImageRun(xml, image.relId, image.imageName));
  heading.parentNode.insertBefore(paragraph, heading);
};

const getParagraphText = (paragraph: Element) => cleanText(getTextNodes(paragraph).map((node) => node.textContent || "").join(""));
const getCellText = (cell: Element) => cleanText(getTextNodes(cell).map((node) => node.textContent || "").join(""));
const tableText = (table: Element) => normalizeText(getTextNodes(table).map((node) => node.textContent || "").join(" "));

const setTextNodeValue = (node: Element, value: string) => {
  if (/\s/.test(value)) {
    node.setAttributeNS(XML_NS, "xml:space", "preserve");
  } else {
    node.removeAttributeNS(XML_NS, "space");
  }
  node.textContent = value;
};

const clearCell = (cell: Element) => {
  getTextNodes(cell).forEach((node) => {
    node.textContent = "";
  });
};

const setCellLines = (cell: Element | undefined, lines: string[]) => {
  if (!cell) return;
  const xml = cell.ownerDocument;
  clearCell(cell);
  const paragraphs = getParagraphs(cell);
  const paragraph = paragraphs[0] ?? createParagraph(xml);
  if (!paragraph.parentNode) cell.appendChild(paragraph);
  while (paragraph.firstChild) paragraph.removeChild(paragraph.firstChild);

  const run = createRun(xml);
  lines.forEach((line, index) => {
    if (index > 0) run.appendChild(createBreak(xml));
    const text = createText(xml);
    setTextNodeValue(text, line);
    run.appendChild(text);
  });
  paragraph.appendChild(run);
  paragraphs.slice(1).forEach((extra) => extra.parentNode?.removeChild(extra));
};

const setCellText = (cell: Element | undefined, value: string) => setCellLines(cell, [value]);

const setParagraphLines = (paragraph: Element, lines: string[]) => {
  const xml = paragraph.ownerDocument;
  while (paragraph.firstChild) paragraph.removeChild(paragraph.firstChild);
  const run = createRun(xml);
  lines.forEach((line, index) => {
    if (index > 0) run.appendChild(createBreak(xml));
    const text = createText(xml);
    setTextNodeValue(text, line);
    run.appendChild(text);
  });
  paragraph.appendChild(run);
};

const ensureParagraphProps = (paragraph: Element) => {
  const xml = paragraph.ownerDocument;
  const paragraphProps = getChildElements(paragraph, "pPr")[0] ?? createParagraphProps(xml);
  if (!paragraphProps.parentNode) paragraph.insertBefore(paragraphProps, paragraph.firstChild);
  return paragraphProps;
};

const setParagraphAlignment = (paragraph: Element, value: "center" | "left") => {
  const xml = paragraph.ownerDocument;
  const paragraphProps = ensureParagraphProps(paragraph);
  let justification = getChildElements(paragraphProps, "jc")[0];
  if (!justification) {
    justification = xml.createElementNS(WORD_NS, "w:jc");
    paragraphProps.appendChild(justification);
  }
  justification.setAttributeNS(WORD_NS, "w:val", value);
};

const setCompanyTitleParagraph = (paragraph: Element, title: string) => {
  const xml = paragraph.ownerDocument;
  const paragraphProps = ensureParagraphProps(paragraph).cloneNode(true) as Element;
  while (paragraph.firstChild) paragraph.removeChild(paragraph.firstChild);
  paragraph.appendChild(paragraphProps);
  setParagraphAlignment(paragraph, "center");

  const run = createRun(xml);
  const runProps = createRunProps(xml);
  runProps.appendChild(xml.createElementNS(WORD_NS, "w:b"));
  runProps.appendChild(xml.createElementNS(WORD_NS, "w:bCs"));
  run.appendChild(runProps);

  const text = createText(xml);
  setTextNodeValue(text, cleanText(title).toLocaleUpperCase("tr-TR"));
  run.appendChild(text);
  paragraph.appendChild(run);
};

const setCellShading = (cell: Element | undefined, color?: string) => {
  if (!cell || !color) return;
  const xml = cell.ownerDocument;
  const tcPr = getChildElements(cell, "tcPr")[0] ?? xml.createElementNS(WORD_NS, "w:tcPr");
  if (!tcPr.parentNode) cell.insertBefore(tcPr, cell.firstChild);
  let shd = getChildElements(tcPr, "shd")[0];
  if (!shd) {
    shd = xml.createElementNS(WORD_NS, "w:shd");
    tcPr.appendChild(shd);
  }
  shd.setAttributeNS(WORD_NS, "w:fill", color.replace("#", "").toUpperCase());
  shd.setAttributeNS(WORD_NS, "w:val", "clear");
};

const findTableByKeywords = (tables: Element[], keywords: string[]) =>
  tables.find((table) => keywords.every((keyword) => tableText(table).includes(normalizeText(keyword))));

const cloneRow = (table: Element, sourceRow: Element) => {
  const clone = sourceRow.cloneNode(true) as Element;
  table.appendChild(clone);
  return clone;
};

const formatDate = (value?: string | null) => {
  const normalized = cleanText(value);
  if (!normalized) return "";
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return normalized;
  return new Intl.DateTimeFormat("tr-TR").format(date);
};

const addYears = (dateValue: string | undefined, years: number) => {
  const base = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setFullYear(base.getFullYear() + years);
  return base.toISOString().split("T")[0];
};

export const calculateRiskValidityDate = (assessmentDate: string | undefined, hazardClass: string | undefined) => {
  const normalized = normalizeText(hazardClass);
  if (normalized.includes("çok") || normalized.includes("cok")) return addYears(assessmentDate, 2);
  if (normalized.includes("tehlikeli") && !normalized.includes("az")) return addYears(assessmentDate, 4);
  if (normalized.includes("az")) return addYears(assessmentDate, 6);
  return "";
};

const riskColor = (value?: string) => {
  const normalized = normalizeText(value);
  if (normalized.includes("kabul")) return "22C55E";
  if (normalized.includes("olası") || normalized.includes("olasi")) return "FACC15";
  if (normalized.includes("önemli") || normalized.includes("onemli")) return "EF4444";
  if (normalized.includes("cok") || normalized.includes("çok")) return "7F1D1D";
  if (normalized.includes("yuksek") || normalized.includes("yüksek")) return "F97316";
  return undefined;
};

const riskLabelFromScore = (score?: string) => {
  const value = Number(cleanText(score));
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 20) return "Kabul Edilebilir Risk";
  if (value < 70) return "Olası Risk";
  if (value < 200) return "Önemli Risk";
  if (value <= 400) return "Yüksek Risk";
  return "Çok Yüksek Risk";
};

const riskLabelForTemplate = (level: string | undefined, score: string | undefined) => {
  const normalized = normalizeText(level);
  if (normalized.includes("kabul")) return "Kabul Edilebilir Risk";
  if (normalized.includes("olası") || normalized.includes("olasi")) return "Olası Risk";
  if (normalized.includes("önemli") || normalized.includes("onemli")) return "Önemli Risk";
  if (normalized.includes("çok") || normalized.includes("cok")) return "Çok Yüksek Risk";
  if (normalized.includes("yüksek") || normalized.includes("yuksek")) return "Yüksek Risk";
  if (normalized.includes("orta")) return "Olası Risk";
  if (normalized.includes("düşük") || normalized.includes("dusuk")) return "Kabul Edilebilir Risk";
  return riskLabelFromScore(score);
};

const sanitizeFileName = (value: string) =>
  cleanText(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "FIRMA";

const riskColorRgb = (value?: string): [number, number, number] | undefined => {
  const color = riskColor(value);
  if (color === "22C55E") return [34, 197, 94];
  if (color === "FACC15") return [250, 204, 21];
  if (color === "EF4444") return [239, 68, 68];
  if (color === "F97316") return [249, 115, 22];
  if (color === "7F1D1D") return [127, 29, 29];
  return undefined;
};

const formatRiskNumber = (value: number) => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))));

const residualValues = (item: RiskTemplateRow, severity: string) => {
  const postProbability = cleanText(item.postProbability) || "0.2";
  const postFrequency = cleanText(item.postFrequency) || "1";
  const postSeverity = cleanText(item.postSeverity) || (Number(severity) > 0 ? formatRiskNumber(Math.min(3, Number(severity))) : "1");
  const postRiskScore =
    cleanText(item.postRiskScore) ||
    (Number(postProbability) && Number(postFrequency) && Number(postSeverity)
      ? formatRiskNumber(Number(postProbability) * Number(postFrequency) * Number(postSeverity))
      : "");
  const postRiskLevel = riskLabelForTemplate(item.postRiskLevel, postRiskScore);
  return { postProbability, postFrequency, postSeverity, postRiskScore, postRiskLevel };
};

const templateRiskRows = (riskItems: RiskTemplateRow[]) =>
  riskItems.map((item, index) => {
    const probability = cleanText(item.probability);
    const frequency = cleanText(item.frequency) || "1";
    const severity = cleanText(item.severity);
    const score =
      cleanText(item.riskScore) ||
      (Number(probability) && Number(frequency) && Number(severity)
        ? String(Number(probability) * Number(frequency) * Number(severity))
        : "");
    const riskLevel = riskLabelForTemplate(item.riskLevel, score);
    const { postProbability, postFrequency, postSeverity, postRiskScore, postRiskLevel } = residualValues(item, severity);

    return [
      String(item.no || index + 1),
      cleanText(item.departmentActivity),
      cleanText(item.hazardSource),
      cleanText(item.riskConsequence),
      cleanText(item.currentMeasure),
      formatDate(item.detectionDate),
      probability,
      frequency,
      severity,
      score,
      riskLevel,
      cleanText(item.affectedPeople),
      cleanText(item.additionalMeasures),
      postProbability,
      postFrequency,
      postSeverity,
      postRiskScore,
      postRiskLevel,
      formatDate(item.deadline),
      cleanText(item.responsible),
    ];
  });

const pdfTextColorForRisk = (label: string): [number, number, number] => {
  const normalized = normalizeText(label);
  return normalized.includes("olasÄ±") || normalized.includes("olasi") ? [15, 23, 42] : [255, 255, 255];
};

const drawTemplatePdfHeader = (doc: jsPDF, payload: RiskTemplateExportPayload) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(5, 87, 137);
  doc.setLineWidth(1);
  doc.rect(8, 8, pageWidth - 16, 194);
  doc.setFillColor(5, 87, 137);
  doc.rect(8, 202, pageWidth - 16, 5, "F");

  doc.setFont("Inter", "bold");
  doc.setTextColor(5, 87, 137);
  doc.setFontSize(11);
  const companyTitle = cleanText(payload.companyInfo.companyTitle).toLocaleUpperCase("tr-TR");
  const titleLines = doc.splitTextToSize(companyTitle, pageWidth - 26) as string[];
  doc.text(titleLines.slice(0, 2), pageWidth / 2, 16, { align: "center" });
  doc.setFontSize(13);
  doc.text("RİSK ANALİZİ VE DEĞERLENDİRMESİ", pageWidth / 2, 30, { align: "center" });
};

const drawTemplateInfoTable = (doc: jsPDF, payload: RiskTemplateExportPayload, startY: number) => {
  autoTable(doc, {
    startY,
    margin: { left: 12, right: 12 },
    theme: "grid",
    body: [
      [
        "FİRMA ADI:",
        cleanText(payload.companyInfo.companyTitle).toLocaleUpperCase("tr-TR"),
        "SGK SİCİL NO:",
        cleanText(payload.companyInfo.workplaceRegistryNo),
      ],
      [
        "TEHLİKE SINIFI:",
        cleanText(payload.companyInfo.hazardClass),
        "GEÇERLİLİK:",
        formatDate(payload.companyInfo.validUntil || calculateRiskValidityDate(payload.companyInfo.assessmentDate, payload.companyInfo.hazardClass)),
      ],
    ],
    styles: {
      font: "Inter",
      fontSize: 7.2,
      cellPadding: 1.2,
      lineColor: [5, 87, 137],
      lineWidth: 0.25,
      textColor: [15, 23, 42],
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 31, fontStyle: "bold", fillColor: [226, 242, 252] },
      1: { cellWidth: 113 },
      2: { cellWidth: 31, fontStyle: "bold", fillColor: [226, 242, 252] },
      3: { cellWidth: 98 },
    },
  });
  return (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || startY;
};

const drawTemplateRiskTable = (doc: jsPDF, payload: RiskTemplateExportPayload, startY: number) => {
  const body = templateRiskRows(payload.riskItems);
  const pageWidth = doc.internal.pageSize.getWidth();
  const columnWidths = [8, 18, 18, 18, 17, 14, 5, 5, 5, 6, 16, 18, 33, 5, 5, 5, 6, 17, 13, 16];
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0);
  const horizontalMargin = Math.max(5, (pageWidth - tableWidth) / 2);
  autoTable(doc, {
    startY,
    margin: { left: horizontalMargin, right: horizontalMargin, bottom: 12 },
    tableWidth,
    theme: "grid",
    head: [[
      "SIRA NO",
      "FAALİYET / BÖLÜM",
      "TEHLİKE",
      "RİSK",
      "MEVCUT DURUM",
      "TESPİT TARİHİ",
      "O",
      "F",
      "Ş",
      "R",
      "RİSKİN TANIMI",
      "OLASI SONUÇ",
      "DÜZELTİCİ / ÖNLEYİCİ FAALİYET",
      "O",
      "F",
      "Ş",
      "R",
      "RİSKİN TANIMI (DÖF SONRASI)",
      "TERMİN",
      "SORUMLU",
    ]],
    body,
    styles: {
      font: "Inter",
      fontSize: 4.8,
      cellPadding: 0.75,
      lineColor: [5, 87, 137],
      lineWidth: 0.12,
      textColor: [15, 23, 42],
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [5, 87, 137],
      textColor: [255, 255, 255],
      font: "Inter",
      fontStyle: "bold",
      fontSize: 4.6,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: columnWidths[0], halign: "center" },
      1: { cellWidth: columnWidths[1] },
      2: { cellWidth: columnWidths[2] },
      3: { cellWidth: columnWidths[3] },
      4: { cellWidth: columnWidths[4] },
      5: { cellWidth: columnWidths[5], halign: "center" },
      6: { cellWidth: columnWidths[6], halign: "center" },
      7: { cellWidth: columnWidths[7], halign: "center" },
      8: { cellWidth: columnWidths[8], halign: "center" },
      9: { cellWidth: columnWidths[9], halign: "center" },
      10: { cellWidth: columnWidths[10], halign: "center", fontStyle: "bold" },
      11: { cellWidth: columnWidths[11] },
      12: { cellWidth: columnWidths[12] },
      13: { cellWidth: columnWidths[13], halign: "center" },
      14: { cellWidth: columnWidths[14], halign: "center" },
      15: { cellWidth: columnWidths[15], halign: "center" },
      16: { cellWidth: columnWidths[16], halign: "center" },
      17: { cellWidth: columnWidths[17], halign: "center", fontStyle: "bold" },
      18: { cellWidth: columnWidths[18], halign: "center" },
      19: { cellWidth: columnWidths[19] },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section !== "body") return;
      if (data.column.index !== 10 && data.column.index !== 17) return;
      const value = cleanText(data.cell.raw as string);
      const color = riskColorRgb(value);
      if (!color) return;
      data.cell.styles.fillColor = color;
      data.cell.styles.textColor = pdfTextColorForRisk(value);
      data.cell.styles.fontStyle = "bold";
    },
  });
  return (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || startY;
};

const drawTemplateSignatureTable = (doc: jsPDF, payload: RiskTemplateExportPayload, startY: number) => {
  const emergency = payload.emergencyInfo || {};
  const people = [
    { role: "İŞVEREN / VEKİLİ", person: payload.teamInfo.employer, label: "T.C." },
    { role: "İŞ GÜVENLİĞİ UZMANI", person: payload.teamInfo.safetyExpert, label: "Sertifika No" },
    { role: "İŞYERİ HEKİMİ", person: payload.teamInfo.workplaceDoctor, label: "Sertifika No" },
    { role: "ÇALIŞAN TEMSİLCİSİ", person: payload.teamInfo.employeeRepresentative, label: "T.C." },
    { role: "TÜM BİRİMLERDEN BİLGİ SAHİBİ", person: emergency.allUnitsContact || {}, label: "T.C." },
    { role: "SÖNDÜRME EKİP BAŞKANI", person: emergency.fireChief || {}, label: "T.C." },
    { role: "KURTARMA EKİP BAŞKANI", person: emergency.rescueChief || {}, label: "T.C." },
    { role: "KORUMA EKİP BAŞKANI", person: emergency.protectionChief || {}, label: "T.C." },
    { role: "İLK YARDIM EKİP BAŞKANI", person: emergency.firstAidChief || {}, label: "T.C." },
  ];

  autoTable(doc, {
    startY,
    margin: { left: 12, right: 12 },
    theme: "grid",
    head: [people.slice(0, 3).map((item) => item.role)],
    body: [
      people.slice(0, 3).map((item) => `Adı Soyadı: ${cleanText(item.person.fullName)}\n${item.label}: ${cleanText(item.label === "Sertifika No" ? item.person.certificateNo : item.person.tcNo)}\nİmza:`),
      people.slice(3, 6).map((item) => item.role),
      people.slice(3, 6).map((item) => `Adı Soyadı: ${cleanText(item.person.fullName)}\n${item.label}: ${cleanText(item.person.tcNo)}\nİmza:`),
      people.slice(6, 9).map((item) => item.role),
      people.slice(6, 9).map((item) => `Adı Soyadı: ${cleanText(item.person.fullName)}\n${item.label}: ${cleanText(item.person.tcNo)}\nİmza:`),
    ],
    styles: {
      font: "Inter",
      fontSize: 6.1,
      cellPadding: 1.4,
      lineColor: [5, 87, 137],
      lineWidth: 0.18,
      textColor: [15, 23, 42],
      minCellHeight: 11,
    },
    headStyles: {
      fillColor: [5, 87, 137],
      textColor: [255, 255, 255],
      font: "Inter",
      fontStyle: "bold",
      halign: "center",
    },
    didParseCell: (data: CellHookData) => {
      if (data.section === "body" && (data.row.index === 1 || data.row.index === 3)) {
        data.cell.styles.fillColor = [5, 87, 137];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";
      }
    },
  });
  return (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || startY;
};

const fillInfoTable = (table: Element | undefined, payload: RiskTemplateExportPayload) => {
  if (!table) return;
  const rows = getRows(table);
  const values: Record<string, string> = {
    "FİRMA ADI": cleanText(payload.companyInfo.companyTitle).toLocaleUpperCase("tr-TR"),
    "TEHLİKE SINIFI": cleanText(payload.companyInfo.hazardClass),
    "SGK SİCİL NO": cleanText(payload.companyInfo.workplaceRegistryNo),
    GEÇERLİLİK: formatDate(payload.companyInfo.validUntil || calculateRiskValidityDate(payload.companyInfo.assessmentDate, payload.companyInfo.hazardClass)),
  };

  rows.forEach((row) => {
    const cells = getCells(row);
    for (let index = 0; index < cells.length; index += 2) {
      const label = getCellText(cells[index]);
      const value = Object.entries(values).find(([key]) => normalizeText(key) === normalizeText(label))?.[1];
      if (value !== undefined) setCellText(cells[index + 1], value);
    }
  });
};

const fillRiskTable = (table: Element | undefined, riskItems: RiskTemplateRow[]) => {
  if (!table) return;
  const rows = getRows(table);
  const templateRow = rows[1];
  if (!templateRow) throw new Error("Risk tablosunda veri satırı bulunamadı.");
  rows.slice(1).forEach((row) => row.parentNode?.removeChild(row));

  riskItems.forEach((item, index) => {
    const row = cloneRow(table, templateRow);
    const cells = getCells(row);
    const probability = cleanText(item.probability);
    const frequency = cleanText(item.frequency) || "1";
    const severity = cleanText(item.severity);
    const score = cleanText(item.riskScore) || (Number(probability) && Number(frequency) && Number(severity) ? String(Number(probability) * Number(frequency) * Number(severity)) : "");
    const riskLevel = riskLabelForTemplate(item.riskLevel, score);
    const { postProbability, postFrequency, postSeverity, postRiskScore, postRiskLevel } = residualValues(item, severity);

    [
      String(item.no || index + 1),
      cleanText(item.departmentActivity),
      cleanText(item.hazardSource),
      cleanText(item.riskConsequence),
      cleanText(item.currentMeasure),
      formatDate(item.detectionDate),
      probability,
      frequency,
      severity,
      score,
      riskLevel,
      cleanText(item.affectedPeople),
      cleanText(item.additionalMeasures),
      postProbability,
      postFrequency,
      postSeverity,
      postRiskScore,
      postRiskLevel,
      formatDate(item.deadline),
      cleanText(item.responsible),
    ].forEach((value, cellIndex) => setCellText(cells[cellIndex], value));

    setCellShading(cells[10], riskColor(riskLevel));
    setCellShading(cells[17], riskColor(postRiskLevel));
  });
};

const fillSignatureTable = (table: Element | undefined, payload: RiskTemplateExportPayload) => {
  if (!table) return;
  const rows = getRows(table);
  const emergency = payload.emergencyInfo || {};
  const data: RiskTemplatePerson[] = [
    payload.teamInfo.employer,
    payload.teamInfo.safetyExpert,
    payload.teamInfo.workplaceDoctor,
    payload.teamInfo.employeeRepresentative,
    emergency.allUnitsContact || {},
    emergency.fireChief || {},
    emergency.rescueChief || {},
    emergency.protectionChief || {},
    emergency.firstAidChief || {},
  ];

  [1, 3, 5].forEach((rowIndex, blockIndex) => {
    const cells = getCells(rows[rowIndex]);
    cells.forEach((cell, cellIndex) => {
      const person = data[blockIndex * 3 + cellIndex] || {};
      const isCertificateCell = blockIndex === 0 && (cellIndex === 1 || cellIndex === 2);
      setCellLines(cell, [
        `Adı Soyadı: ${cleanText(person.fullName)}`,
        `${isCertificateCell ? "Sertifika No" : "T.C."}: ${cleanText(isCertificateCell ? person.certificateNo : person.tcNo)}`,
        "İmza:",
      ]);
    });
  });
};

const addCompanyTitleAboveHeading = (xml: XMLDocument, companyTitle: string) => {
  const heading = getParagraphs(xml).find((paragraph) => normalizeText(getParagraphText(paragraph)) === normalizeText("RİSK ANALİZİ VE DEĞERLENDİRMESİ"));
  if (!heading?.parentNode) return;
  const titleParagraph = heading.cloneNode(true) as Element;
  setCompanyTitleParagraph(titleParagraph, companyTitle);
  heading.parentNode.insertBefore(titleParagraph, heading);
};

export async function generateRiskAnalysisTemplateDocx(payload: RiskTemplateExportPayload) {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Şablon bulunamadı.");
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Word şablonunda document.xml bulunamadı.");

  const xml = parseXml(await documentFile.async("string"));
  const tables = getTables(xml);

  await insertCoverLogoBeforeHeading(zip, xml, payload.logoDataUrl);
  addCompanyTitleAboveHeading(xml, payload.companyInfo.companyTitle);
  fillInfoTable(findTableByKeywords(tables, ["FİRMA ADI", "TEHLİKE SINIFI", "SGK SİCİL NO", "GEÇERLİLİK"]), payload);
  fillRiskTable(findTableByKeywords(tables, ["SIRA NO", "FAALİYET", "RİSKİN TANIMI", "SORUMLU"]), payload.riskItems);
  fillSignatureTable(findTableByKeywords(tables, ["İŞVEREN / VEKİLİ", "İLK YARDIM EKİP BAŞKANI"]), payload);

  zip.file("word/document.xml", serializeXml(xml));
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const fileDate = new Date().toISOString().split("T")[0];
  saveAs(blob, `${sanitizeFileName(payload.companyInfo.companyTitle).toLocaleUpperCase("tr-TR")}_Risk_Analizi_${fileDate}.docx`);
}

export async function generateRiskAnalysisTemplatePdf(payload: RiskTemplateExportPayload) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  drawTemplatePdfHeader(doc, payload);
  let cursorY = drawTemplateInfoTable(doc, payload, payload.logoDataUrl ? 55 : 36) + 4;
  cursorY = drawTemplateRiskTable(doc, payload, cursorY) + 5;

  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY > pageHeight - 58) {
    doc.addPage("a4", "landscape");
    cursorY = 14;
  }
  drawTemplateSignatureTable(doc, payload, cursorY);

  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    doc.setPage(pageIndex);
    doc.setDrawColor(5, 87, 137);
    doc.setLineWidth(0.35);
    doc.line(8, pageHeight - 9, pageWidth - 8, pageHeight - 9);
    doc.setFont("Inter", "normal");
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    doc.text("Bu belge İSGVİZYON sistemi üzerinden dijital kayıtla oluşturulmuştur.", pageWidth / 2, pageHeight - 5.2, {
      align: "center",
    });
  }

  const fileDate = new Date().toISOString().split("T")[0];
  doc.save(`${sanitizeFileName(payload.companyInfo.companyTitle).toLocaleUpperCase("tr-TR")}_Risk_Analizi_${fileDate}.pdf`);
}
