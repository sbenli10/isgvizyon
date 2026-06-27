import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = "/templates/ACİL EYLEM PLANI (1).docx";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NAMESPACE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const WP_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const DRAWING_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PICTURE_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/picture";

export type EmergencyTeamMember = {
  fullName: string;
  responsibilityArea: string;
  role: string;
  phone: string;
};

export type EmergencyActionPlanPayload = {
  planDate: string;
  companyTitle: string;
  companyAddress: string;
  companyContact: string;
  employerName: string;
  hazardClass: string;
  sgkNumber: string;
  preparedByTitle: string;
  preparedByName: string;
  preparedDate: string;
  validUntilDate: string;
  revisionNo: string;
  revisionDate: string;
  assemblyArea: string;
  selectedEmergencies: {
    fire: boolean;
    poisoning: boolean;
    epidemic: boolean;
    naturalDisaster: boolean;
    sabotage: boolean;
    firstAid: boolean;
    fallFromHeight: boolean;
    electricShock: boolean;
    explosion: boolean;
    chemicalSpill: boolean;
    biologicalSpread: boolean;
    radioactiveSpread: boolean;
    nuclearSpread: boolean;
    other: boolean;
  };
  otherEmergencyText: string;
  externalRisk: {
    companyTitle: string;
    activity: string;
    possibleEffect: string;
  };
  evacuation: {
    evacuationPlanNote: string;
    assemblyPointNote: string;
    fireEquipmentLocations: string;
    electricGasCutoffLocations: string;
    firstAidMaterialLocations: string;
    explosionRiskAreas: string;
    chemicalSpreadAreas: string;
  };
  contactNumbers: {
    police: string;
    ambulance: string;
    covidLine: string;
    naturalGas: string;
    electricity: string;
    governorship: string;
    gendarmerie: string;
    afad: string;
    fireDepartment: string;
    forestFire: string;
  };
  teams: {
    fire: EmergencyTeamMember[];
    rescue: EmergencyTeamMember[];
    protection: EmergencyTeamMember[];
    firstAid: EmergencyTeamMember[];
  };
  signatures: {
    safetyExpertName: string;
    employerName: string;
  };
  logoDataUrl?: string;
  fileName?: string;
};

const emptyMember: EmergencyTeamMember = {
  fullName: "",
  responsibilityArea: "",
  role: "",
  phone: "",
};

export const cleanText = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return /^(undefined|null|nan)$/i.test(text) ? "" : text;
};

export const formatDateTR = (value: string): string => {
  const text = cleanText(value);
  if (!text) return "";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export const slugifyTR = (value: string): string =>
  cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "bos-form";

export const boolToCheckboxMark = (value: boolean): string => (value ? "☒" : "☐");

export const normalizeTeamRows = (team: EmergencyTeamMember[], size: number): EmergencyTeamMember[] =>
  Array.from({ length: size }, (_, index) => {
    const row = team[index] || emptyMember;
    return {
      fullName: cleanText(row.fullName),
      responsibilityArea: cleanText(row.responsibilityArea),
      role: cleanText(row.role),
      phone: cleanText(row.phone),
    };
  });

const firstNonEmptyMember = (team: EmergencyTeamMember[]): EmergencyTeamMember =>
  team.find(
    (member) =>
      cleanText(member.fullName) ||
      cleanText(member.responsibilityArea) ||
      cleanText(member.role) ||
      cleanText(member.phone),
  ) || emptyMember;

const assignTeamData = (
  data: Record<string, string>,
  prefix: "fire" | "rescue" | "protection" | "firstAid",
  team: EmergencyTeamMember[],
  size: number,
) => {
  normalizeTeamRows(team, size).forEach((member, index) => {
    const rowNumber = index + 1;
    data[`${prefix}${rowNumber}Name`] = member.fullName;
    data[`${prefix}${rowNumber}Area`] = member.responsibilityArea;
    data[`${prefix}${rowNumber}Role`] = member.role;
    data[`${prefix}${rowNumber}Phone`] = member.phone;
  });
};

const buildTemplateData = (payload: EmergencyActionPlanPayload): Record<string, string> => {
  const fireSummary = firstNonEmptyMember(payload.teams.fire);
  const rescueSummary = firstNonEmptyMember(payload.teams.rescue);
  const protectionSummary = firstNonEmptyMember(payload.teams.protection);
  const firstAidSummary = firstNonEmptyMember(payload.teams.firstAid);

  const data: Record<string, string> = {
    planDate: formatDateTR(payload.planDate),
    coverAddress: cleanText(payload.companyAddress),
    coverContact: cleanText(payload.companyContact),

    preparedByTitle: cleanText(payload.preparedByTitle || "İş Güvenliği Uzmanı"),
    preparedByName: cleanText(payload.preparedByName),
    preparedDate: formatDateTR(payload.preparedDate),
    validUntilDate: formatDateTR(payload.validUntilDate),
    revisionNo: cleanText(payload.revisionNo),
    revisionDate: formatDateTR(payload.revisionDate),

    companyTitle: cleanText(payload.companyTitle),
    companyAddress: cleanText(payload.companyAddress),
    companyContact: cleanText(payload.companyContact),
    employerName: cleanText(payload.employerName),
    hazardClass: cleanText(payload.hazardClass),
    sgkNumber: cleanText(payload.sgkNumber),

    fireEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.fire),
    poisoningEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.poisoning),
    epidemicEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.epidemic),
    naturalDisasterEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.naturalDisaster),
    sabotageEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.sabotage),
    firstAidEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.firstAid),
    fallFromHeightEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.fallFromHeight),
    electricShockEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.electricShock),
    explosionEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.explosion),
    chemicalSpillEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.chemicalSpill),
    biologicalSpreadEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.biologicalSpread),
    radioactiveSpreadEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.radioactiveSpread),
    nuclearSpreadEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.nuclearSpread),
    otherEmergencyMark: boolToCheckboxMark(payload.selectedEmergencies.other),
    otherEmergencyText: cleanText(payload.otherEmergencyText),

    assemblyArea: cleanText(payload.assemblyArea),

    externalCompanyTitle: cleanText(payload.externalRisk.companyTitle),
    externalCompanyActivity: cleanText(payload.externalRisk.activity),
    externalCompanyEffect: cleanText(payload.externalRisk.possibleEffect),

    evacuationPlanNote: cleanText(payload.evacuation.evacuationPlanNote),
    assemblyPointNote: cleanText(payload.evacuation.assemblyPointNote),
    fireEquipmentLocations: cleanText(payload.evacuation.fireEquipmentLocations),
    electricGasCutoffLocations: cleanText(payload.evacuation.electricGasCutoffLocations),
    firstAidMaterialLocations: cleanText(payload.evacuation.firstAidMaterialLocations),
    explosionRiskAreas: cleanText(payload.evacuation.explosionRiskAreas),
    chemicalSpreadAreas: cleanText(payload.evacuation.chemicalSpreadAreas),

    policePhone: cleanText(payload.contactNumbers.police),
    ambulancePhone: cleanText(payload.contactNumbers.ambulance),
    covidLinePhone: cleanText(payload.contactNumbers.covidLine),
    naturalGasPhone: cleanText(payload.contactNumbers.naturalGas),
    electricityPhone: cleanText(payload.contactNumbers.electricity),
    governorshipPhone: cleanText(payload.contactNumbers.governorship),
    gendarmeriePhone: cleanText(payload.contactNumbers.gendarmerie),
    afadPhone: cleanText(payload.contactNumbers.afad),
    fireDepartmentPhone: cleanText(payload.contactNumbers.fireDepartment),
    forestFirePhone: cleanText(payload.contactNumbers.forestFire),

    fireTeamSummaryName: cleanText(fireSummary.fullName),
    fireTeamSummaryArea: cleanText(fireSummary.responsibilityArea),
    fireTeamSummaryPhone: cleanText(fireSummary.phone),
    rescueTeamSummaryName: cleanText(rescueSummary.fullName),
    rescueTeamSummaryArea: cleanText(rescueSummary.responsibilityArea),
    rescueTeamSummaryPhone: cleanText(rescueSummary.phone),
    protectionTeamSummaryName: cleanText(protectionSummary.fullName),
    protectionTeamSummaryArea: cleanText(protectionSummary.responsibilityArea),
    protectionTeamSummaryPhone: cleanText(protectionSummary.phone),
    firstAidTeamSummaryName: cleanText(firstAidSummary.fullName),
    firstAidTeamSummaryArea: cleanText(firstAidSummary.responsibilityArea),
    firstAidTeamSummaryPhone: cleanText(firstAidSummary.phone),

    safetyExpertName: cleanText(payload.signatures.safetyExpertName),
    employerSignatureName: cleanText(payload.signatures.employerName),
  };

  assignTeamData(data, "fire", payload.teams.fire, 4);
  assignTeamData(data, "rescue", payload.teams.rescue, 4);
  assignTeamData(data, "protection", payload.teams.protection, 3);
  assignTeamData(data, "firstAid", payload.teams.firstAid, 3);

  return data;
};

const buildFileName = (payload: EmergencyActionPlanPayload) => {
  if (payload.fileName) return payload.fileName;
  const fileDate = new Date().toISOString().slice(0, 10);
  return `acil-durum-eylem-plani-${slugifyTR(payload.companyTitle)}-${fileDate}.docx`;
};

const createWordElement = (document: XMLDocument, tagName: string) =>
  document.createElementNS(WORD_NAMESPACE, `w:${tagName}`);
const createXmlElement = (document: XMLDocument, namespace: string, tagName: string) =>
  document.createElementNS(namespace, tagName);

const getLogoMime = (dataUrl?: string) => {
  const match = cleanText(dataUrl).match(/^data:(image\/(?:png|jpeg|jpg));base64,/i);
  return match?.[1]?.toLowerCase() || "";
};

const dataUrlToArrayBuffer = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("LOGO_READ_FAILED");
  return response.arrayBuffer();
};

const ensureImageContentType = (zip: PizZip, extension: string) => {
  const file = zip.file("[Content_Types].xml");
  if (!file) return;
  const xml = new DOMParser().parseFromString(file.asText(), "application/xml");
  const exists = Array.from(xml.getElementsByTagName("Default")).some(
    (node) => node.getAttribute("Extension") === extension,
  );
  if (exists) return;
  const node = xml.createElement("Default");
  node.setAttribute("Extension", extension);
  node.setAttribute("ContentType", extension === "png" ? "image/png" : "image/jpeg");
  xml.documentElement.appendChild(node);
  zip.file("[Content_Types].xml", new XMLSerializer().serializeToString(xml));
};

const addLogoRelationship = async (zip: PizZip, dataUrl: string) => {
  const mime = getLogoMime(dataUrl);
  if (!mime) return null;
  const extension = mime.includes("png") ? "png" : "jpg";
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (!relsFile) return null;
  const relsDocument = new DOMParser().parseFromString(relsFile.asText(), "application/xml");
  const relationships = Array.from(relsDocument.getElementsByTagName("Relationship"));
  const nextRelNumber =
    relationships.reduce((max, relation) => {
      const numeric = Number((relation.getAttribute("Id") || "").replace("rId", ""));
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0) + 1;
  const relId = `rId${nextRelNumber}`;
  const imageName = `adep-kapak-logo-${Date.now()}.${extension}`;
  ensureImageContentType(zip, extension);
  zip.file(`word/media/${imageName}`, await dataUrlToArrayBuffer(dataUrl));
  const relationship = relsDocument.createElement("Relationship");
  relationship.setAttribute("Id", relId);
  relationship.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image");
  relationship.setAttribute("Target", `media/${imageName}`);
  relsDocument.documentElement.appendChild(relationship);
  zip.file("word/_rels/document.xml.rels", new XMLSerializer().serializeToString(relsDocument));
  return { relId, imageName };
};

const createLogoRun = (document: XMLDocument, relId: string, imageName: string) => {
  const run = createWordElement(document, "r");
  const drawing = createWordElement(document, "drawing");
  const inline = createXmlElement(document, WP_NAMESPACE, "wp:inline");
  inline.setAttribute("distT", "0");
  inline.setAttribute("distB", "0");
  inline.setAttribute("distL", "0");
  inline.setAttribute("distR", "0");
  const extent = createXmlElement(document, WP_NAMESPACE, "wp:extent");
  extent.setAttribute("cx", "1450000");
  extent.setAttribute("cy", "725000");
  const effectExtent = createXmlElement(document, WP_NAMESPACE, "wp:effectExtent");
  effectExtent.setAttribute("l", "0");
  effectExtent.setAttribute("t", "0");
  effectExtent.setAttribute("r", "0");
  effectExtent.setAttribute("b", "0");
  const docPr = createXmlElement(document, WP_NAMESPACE, "wp:docPr");
  docPr.setAttribute("id", "7201");
  docPr.setAttribute("name", "Acil Durum Kapak Logosu");
  const graphic = createXmlElement(document, DRAWING_NAMESPACE, "a:graphic");
  const graphicData = createXmlElement(document, DRAWING_NAMESPACE, "a:graphicData");
  graphicData.setAttribute("uri", "http://schemas.openxmlformats.org/drawingml/2006/picture");
  const pic = createXmlElement(document, PICTURE_NAMESPACE, "pic:pic");
  const nvPicPr = createXmlElement(document, PICTURE_NAMESPACE, "pic:nvPicPr");
  const cNvPr = createXmlElement(document, PICTURE_NAMESPACE, "pic:cNvPr");
  cNvPr.setAttribute("id", "0");
  cNvPr.setAttribute("name", imageName);
  nvPicPr.appendChild(cNvPr);
  nvPicPr.appendChild(createXmlElement(document, PICTURE_NAMESPACE, "pic:cNvPicPr"));
  const blipFill = createXmlElement(document, PICTURE_NAMESPACE, "pic:blipFill");
  const blip = createXmlElement(document, DRAWING_NAMESPACE, "a:blip");
  blip.setAttributeNS(REL_NAMESPACE, "r:embed", relId);
  const stretch = createXmlElement(document, DRAWING_NAMESPACE, "a:stretch");
  stretch.appendChild(createXmlElement(document, DRAWING_NAMESPACE, "a:fillRect"));
  blipFill.appendChild(blip);
  blipFill.appendChild(stretch);
  const spPr = createXmlElement(document, PICTURE_NAMESPACE, "pic:spPr");
  const xfrm = createXmlElement(document, DRAWING_NAMESPACE, "a:xfrm");
  const off = createXmlElement(document, DRAWING_NAMESPACE, "a:off");
  off.setAttribute("x", "0");
  off.setAttribute("y", "0");
  const ext = createXmlElement(document, DRAWING_NAMESPACE, "a:ext");
  ext.setAttribute("cx", "1450000");
  ext.setAttribute("cy", "725000");
  xfrm.appendChild(off);
  xfrm.appendChild(ext);
  const prstGeom = createXmlElement(document, DRAWING_NAMESPACE, "a:prstGeom");
  prstGeom.setAttribute("prst", "rect");
  prstGeom.appendChild(createXmlElement(document, DRAWING_NAMESPACE, "a:avLst"));
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
  inline.appendChild(createXmlElement(document, WP_NAMESPACE, "wp:cNvGraphicFramePr"));
  inline.appendChild(graphic);
  drawing.appendChild(inline);
  run.appendChild(drawing);
  return run;
};

const insertCoverLogo = async (zip: PizZip, document: XMLDocument, dataUrl?: string) => {
  if (!dataUrl) return;
  const image = await addLogoRelationship(zip, dataUrl);
  if (!image) return;
  const paragraphs = Array.from(document.getElementsByTagNameNS(WORD_NAMESPACE, "p"));
  const companyTitleParagraph = paragraphs.find((paragraph) => cleanText(getElementText(paragraph)) === "{companyTitle}");
  const titleParagraph = paragraphs.find((paragraph) => {
    const text = cleanText(getElementText(paragraph)).toLocaleLowerCase("tr-TR");
    return text.includes("eylem") && text.includes("plani");
  });
  const target = companyTitleParagraph || titleParagraph;
  if (!target?.parentNode) return;
  const paragraph = createWordElement(document, "p");
  const paragraphProps = createWordElement(document, "pPr");
  const justification = createWordElement(document, "jc");
  justification.setAttribute("w:val", "center");
  paragraphProps.appendChild(justification);
  paragraph.appendChild(paragraphProps);
  paragraph.appendChild(createLogoRun(document, image.relId, image.imageName));
  target.parentNode.insertBefore(paragraph, target);
};

const getElementText = (element: Element) =>
  Array.from(element.getElementsByTagNameNS(WORD_NAMESPACE, "t"))
    .map((node) => node.textContent || "")
    .join("");

const compactText = (value: string) =>
  value
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, "")
    .replace(/[.:/\\-]/g, "");

const textMatches = (text: string, label: string) => compactText(text).includes(compactText(label));

const getRows = (table: Element) => Array.from(table.childNodes).filter((node): node is Element => {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "tr";
});

const getCells = (row: Element) => Array.from(row.childNodes).filter((node): node is Element => {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "tc";
});

const setCellText = (document: XMLDocument, cell: Element | undefined, text: string) => {
  if (!cell) return;

  Array.from(cell.childNodes).forEach((child) => {
    const isCellProperties = child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === "tcPr";
    if (!isCellProperties) cell.removeChild(child);
  });

  const paragraph = createWordElement(document, "p");
  const run = createWordElement(document, "r");
  const textNode = createWordElement(document, "t");
  textNode.setAttribute("xml:space", "preserve");
  textNode.textContent = text;
  run.appendChild(textNode);
  paragraph.appendChild(run);
  cell.appendChild(paragraph);
};

const setParagraphText = (document: XMLDocument, paragraph: Element, text: string) => {
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

const createStyledRun = (document: XMLDocument, text: string, fontSizePt = 26) => {
  const run = createWordElement(document, "r");
  const runProperties = createWordElement(document, "rPr");
  const fonts = createWordElement(document, "rFonts");
  const size = createWordElement(document, "sz");
  const complexSize = createWordElement(document, "szCs");
  const textNode = createWordElement(document, "t");

  fonts.setAttribute("w:ascii", "Arial");
  fonts.setAttribute("w:hAnsi", "Arial");
  fonts.setAttribute("w:cs", "Arial");
  size.setAttribute("w:val", String(fontSizePt * 2));
  complexSize.setAttribute("w:val", String(fontSizePt * 2));
  textNode.setAttribute("xml:space", "preserve");
  textNode.textContent = text;

  runProperties.appendChild(fonts);
  runProperties.appendChild(size);
  runProperties.appendChild(complexSize);
  run.appendChild(runProperties);
  run.appendChild(textNode);

  return run;
};

const setParagraphStyledText = (document: XMLDocument, paragraph: Element, text: string, fontSizePt = 26) => {
  Array.from(paragraph.childNodes).forEach((child) => {
    const isParagraphProperties = child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === "pPr";
    if (!isParagraphProperties) paragraph.removeChild(child);
  });

  paragraph.appendChild(createStyledRun(document, text, fontSizePt));
};

const insertParagraphBefore = (
  document: XMLDocument,
  targetParagraph: Element,
  text: string,
  fontSizePt = 26,
) => {
  const paragraph = createWordElement(document, "p");
  const paragraphProperties = Array.from(targetParagraph.childNodes).find(
    (child) => child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === "pPr",
  );

  if (paragraphProperties) {
    paragraph.appendChild(paragraphProperties.cloneNode(true));
  }

  paragraph.appendChild(createStyledRun(document, text, fontSizePt));
  targetParagraph.parentNode?.insertBefore(paragraph, targetParagraph);
};

const fillCellAfterLabel = (document: XMLDocument, tables: Element[], label: string, placeholder: string) => {
  tables.forEach((table) => {
    getRows(table).forEach((row) => {
      const cells = getCells(row);
      const labelIndex = cells.findIndex((cell) => textMatches(getElementText(cell), label));
      if (labelIndex >= 0 && cells[labelIndex + 1]) {
        setCellText(document, cells[labelIndex + 1], `{${placeholder}}`);
      }
    });
  });
};

const fillPreparedParagraphs = (document: XMLDocument) => {
  const replacements: Array<{ label: string; text: string }> = [
    { label: "Unvanı", text: "Unvanı: {preparedByTitle}" },
    { label: "Hazırlanma Tarihi", text: "Hazırlanma Tarihi: {preparedDate}" },
    { label: "Geçerlilik Tarihi", text: "Geçerlilik Tarihi: {validUntilDate}" },
    { label: "Rev. No", text: "Rev. No: {revisionNo}" },
    { label: "Rev. Tarihi", text: "Rev. Tarihi: {revisionDate}" },
  ];

  const paragraphs = Array.from(document.getElementsByTagNameNS(WORD_NAMESPACE, "p"));
  replacements.forEach((replacement) => {
    const paragraph = paragraphs.find((item) => textMatches(getElementText(item), replacement.label));
    if (paragraph) setParagraphText(document, paragraph, replacement.text);
  });
};

const fillCoverTitleAndDate = (document: XMLDocument) => {
  const paragraphs = Array.from(document.getElementsByTagNameNS(WORD_NAMESPACE, "p"));
  const titleParagraph = paragraphs.find((paragraph) => textMatches(getElementText(paragraph), "ACİL EYLEM PLANI"));
  if (!titleParagraph) return;

  insertParagraphBefore(document, titleParagraph, "{companyTitle}", 26);
  const titleIndex = paragraphs.indexOf(titleParagraph);
  const coverDateParagraph = paragraphs
    .slice(titleIndex + 1, titleIndex + 8)
    .find((paragraph) => /\b\d{2}[./-]\d{2}[./-]\d{4}\b/.test(getElementText(paragraph)));

  if (coverDateParagraph) {
    setParagraphStyledText(document, coverDateParagraph, "{planDate}", 26);
  }
};

const fillSupportSummaryRows = (document: XMLDocument, tables: Element[]) => {
  const rows: Array<{ label: string; name: string; area: string; phone: string }> = [
    { label: "SÖNDÜRME EKİBİ", name: "fireTeamSummaryName", area: "fireTeamSummaryArea", phone: "fireTeamSummaryPhone" },
    { label: "KURTARMA EKİBİ", name: "rescueTeamSummaryName", area: "rescueTeamSummaryArea", phone: "rescueTeamSummaryPhone" },
    { label: "KORUMA EKİBİ", name: "protectionTeamSummaryName", area: "protectionTeamSummaryArea", phone: "protectionTeamSummaryPhone" },
    { label: "İLKYARDIM EKİBİ", name: "firstAidTeamSummaryName", area: "firstAidTeamSummaryArea", phone: "firstAidTeamSummaryPhone" },
    { label: "İLK YARDIM EKİBİ", name: "firstAidTeamSummaryName", area: "firstAidTeamSummaryArea", phone: "firstAidTeamSummaryPhone" },
  ];

  tables.forEach((table) => {
    getRows(table).forEach((row) => {
      const cells = getCells(row);
      if (cells.length < 4) return;
      const rowLabel = getElementText(cells[0]);
      const match = rows.find((item) => textMatches(rowLabel, item.label));
      if (!match) return;

      setCellText(document, cells[1], `{${match.name}}`);
      setCellText(document, cells[2], `{${match.area}}`);
      setCellText(document, cells[3], `{${match.phone}}`);
    });
  });
};

const fillEmergencyMarkRows = (document: XMLDocument, tables: Element[]) => {
  const rows: Array<{ label: string; placeholder: string }> = [
    { label: "YANGIN İHTİMALİ", placeholder: "fireEmergencyMark" },
    { label: "ZEHİRLENME İHTİMALİ", placeholder: "poisoningEmergencyMark" },
    { label: "SALGIN HASTALIK İHTİMALİ", placeholder: "epidemicEmergencyMark" },
    { label: "DOĞAL AFETLERİN MEYDANA GELME İHTİMALİ", placeholder: "naturalDisasterEmergencyMark" },
    { label: "SABOTAJ İHTİMALİ", placeholder: "sabotageEmergencyMark" },
    { label: "İLKYARDIM GEREKTİREN DURUMLAR", placeholder: "firstAidEmergencyMark" },
    { label: "YÜKSEKTEN DÜŞME SONUCU ASKIDA KALMA DURUMU", placeholder: "fallFromHeightEmergencyMark" },
    { label: "ELEKTRİK ÇARPMASI", placeholder: "electricShockEmergencyMark" },
    { label: "PATLAMA", placeholder: "explosionEmergencyMark" },
    { label: "TEHLİKELİ KİMYASAL MADDELERDEN KAYNAKLANAN YAYILIM", placeholder: "chemicalSpillEmergencyMark" },
    { label: "BİYOLOJİK MADDELERDEN KAYNAKLANAN YAYILIM", placeholder: "biologicalSpreadEmergencyMark" },
    { label: "RADYOAKTİF MADDELERDEN KAYNAKLANAN YAYILIM", placeholder: "radioactiveSpreadEmergencyMark" },
    { label: "NÜKLEER MADDELERDEN KAYNAKLANAN YAYILIM", placeholder: "nuclearSpreadEmergencyMark" },
    { label: "DİĞER", placeholder: "otherEmergencyMark" },
  ];

  tables.forEach((table) => {
    const tableText = getElementText(table);
    const isEmergencySelectionTable =
      textMatches(tableText, "BELİRLENEN ACİL DURUMLAR TABLODA İŞARETLENMİŞTİR") ||
      textMatches(tableText, "YANGIN İHTİMALİ ZEHİRLENME İHTİMALİ SALGIN HASTALIK İHTİMALİ");
    const isPreventiveMeasuresTable = textMatches(tableText, "ÖNLEYİCİ VE SINIRLANDIRICI TEDBİRLER");

    if (!isEmergencySelectionTable || isPreventiveMeasuresTable) return;

    getRows(table).forEach((row) => {
      const cells = getCells(row);
      if (cells.length < 2) return;

      const firstCellText = getElementText(cells[0]);
      const match = rows.find((item) => textMatches(firstCellText, item.label));
      if (!match) return;

      setCellText(document, cells[cells.length - 1], `{${match.placeholder}}`);
    });
  });
};

const fillDetailedTeamRows = (document: XMLDocument, tables: Element[]) => {
  const sections: Array<{ label: string; prefix: "fire" | "rescue" | "protection" | "firstAid"; size: number }> = [
    { label: "SÖNDÜRME EKİBİ", prefix: "fire", size: 4 },
    { label: "KURTARMA EKİBİ", prefix: "rescue", size: 4 },
    { label: "KORUMA EKİBİ", prefix: "protection", size: 3 },
    { label: "İLKYARDIM EKİBİ", prefix: "firstAid", size: 3 },
    { label: "İLK YARDIM EKİBİ", prefix: "firstAid", size: 3 },
  ];

  tables.forEach((table) => {
    const rows = getRows(table);
    let activeSection: (typeof sections)[number] | null = null;

    rows.forEach((row) => {
      const rowText = getElementText(row);
      const nextSection = sections.find((section) => textMatches(rowText, section.label));
      if (nextSection) {
        activeSection = nextSection;
        return;
      }
      if (!activeSection) return;

      const cells = getCells(row);
      if (cells.length < 5) return;

      const sequence = Number.parseInt(getElementText(cells[0]).trim(), 10);
      if (!Number.isInteger(sequence) || sequence < 1 || sequence > activeSection.size) return;

      setCellText(document, cells[1], `{${activeSection.prefix}${sequence}Name}`);
      setCellText(document, cells[2], `{${activeSection.prefix}${sequence}Area}`);
      setCellText(document, cells[3], `{${activeSection.prefix}${sequence}Role}`);
      setCellText(document, cells[4], `{${activeSection.prefix}${sequence}Phone}`);
    });
  });
};

const prepareEmergencyTemplatePlaceholders = async (zip: PizZip, payload: EmergencyActionPlanPayload) => {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return;

  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(documentFile.asText(), "application/xml");
  const tables = Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "tbl"));

  fillCellAfterLabel(xmlDocument, tables, "ADRES", "companyAddress");
  fillCellAfterLabel(xmlDocument, tables, "İLETİŞİM", "companyContact");
  fillCellAfterLabel(xmlDocument, tables, "İŞYERİ ADI/UNVANI", "companyTitle");
  fillCellAfterLabel(xmlDocument, tables, "İŞVEREN/İŞVEREN VEK", "employerName");
  fillCellAfterLabel(xmlDocument, tables, "TEHLİKE SINIFI", "hazardClass");
  fillCellAfterLabel(xmlDocument, tables, "SGK SİCİL NO", "sgkNumber");
  fillCoverTitleAndDate(xmlDocument);
  await insertCoverLogo(zip, xmlDocument, payload.logoDataUrl);
  fillPreparedParagraphs(xmlDocument);
  fillEmergencyMarkRows(xmlDocument, tables);
  fillSupportSummaryRows(xmlDocument, tables);
  fillDetailedTeamRows(xmlDocument, tables);

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
};

export async function generateEmergencyActionPlanDocx(payload: EmergencyActionPlanPayload): Promise<void> {
  const response = await fetch(encodeURI(TEMPLATE_PATH));
  if (!response.ok) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }

  const templateBytes = await response.arrayBuffer();
  const zip = new PizZip(templateBytes);
  await prepareEmergencyTemplatePlaceholders(zip, payload);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  try {
    doc.render(buildTemplateData(payload));
  } catch (error) {
    console.error("Emergency action plan template render error:", error);
    throw new Error("TEMPLATE_RENDER_FAILED");
  }

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: DOCX_MIME,
  });
  saveAs(blob, buildFileName(payload));
}
