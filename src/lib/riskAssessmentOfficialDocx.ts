import { saveAs } from "file-saver";
import JSZip from "jszip";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

export type OfficialRiskTeamPerson = {
  fullName: string;
  tcNo: string;
  phone: string;
  certificateNo?: string;
};

export type OfficialRiskTeamOsgb = {
  title: string;
  phone: string;
  email: string;
  authorizedPerson: string;
};

export type OfficialRiskAssessmentDocxPayload = {
  companyInfo: {
    companyTitle: string;
    address: string;
    email: string;
    workplaceRegistryNo: string;
    hazardClass: string;
    employeeCount: string;
    assessmentDate: string;
    riskMethod: string;
    activityScope: string;
    note?: string;
  };
  teamInfo: {
    employer: OfficialRiskTeamPerson;
    employeeRepresentative: OfficialRiskTeamPerson;
    safetyExpert: OfficialRiskTeamPerson;
    workplaceDoctor: OfficialRiskTeamPerson;
    osgb: OfficialRiskTeamOsgb;
  };
  scopeInfo: {
    evaluatedSections: string;
    assessmentScopeItems: string[];
  };
  riskItems: Array<{
    no: number;
    departmentActivity: string;
    hazardSource: string;
    riskConsequence: string;
    affectedPeople: string;
    currentMeasure: string;
    probability: string;
    severity: string;
    riskScore: string;
    riskLevel: string;
    additionalMeasures: string;
    responsible: string;
    deadline: string;
  }>;
  correctiveActions: Array<{
    no: number;
    finding: string;
    action: string;
    responsible: string;
    deadline: string;
    status: string;
  }>;
  conclusionInfo: {
    conclusionItems: string[];
    approvalNote: string;
    preparedBy: string;
    approvedBy: string;
    signatureDate: string;
  };
  signatureRows: Array<{
    fullName: string;
    role: string;
    documentOrContact: string;
  }>;
};

const RISK_TEMPLATE_PATH = "/templates/Risk_Analizi.docx";
const METHOD_DESCRIPTION =
  "Risk puanı = Olasılık x Şiddet. Risk düzeyleri: 1-4 Düşük, 5-9 Orta, 10-15 Yüksek, 16-25 Çok Yüksek olarak kabul edilmiştir. Kontrol tedbirlerinde öncelik sırası; tehlikeyi ortadan kaldırma, ikame, mühendislik kontrolü, idari kontrol ve kişisel koruyucu donanım şeklindedir.";

const cleanText = (value?: string | null) => (value || "").replace(/\s+/g, " ").trim();
const normalizeText = (value?: string | null) => cleanText(value).toLocaleLowerCase("tr-TR");
const normalizeLabel = (value?: string | null) => normalizeText(String(value || "").replace(/:$/, ""));
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

const setTextNodeValue = (node: Element, value: string) => {
  if (/\s/.test(value)) {
    node.setAttributeNS(XML_NS, "xml:space", "preserve");
  } else {
    node.removeAttributeNS(XML_NS, "space");
  }
  node.textContent = value;
};

const getParagraphText = (paragraph: Element) => cleanText(getTextNodes(paragraph).map((node) => node.textContent || "").join(""));
const getCellText = (cell: Element) => cleanText(getTextNodes(cell).map((node) => node.textContent || "").join(""));

const getOrCreateTextNode = (cell: Element) => {
  const xml = cell.ownerDocument;
  const textNodes = getTextNodes(cell);
  if (textNodes.length > 0) return textNodes[0];

  const paragraph =
    getParagraphs(cell)[0] ??
    (() => {
      const next = createParagraph(xml);
      cell.appendChild(next);
      return next;
    })();

  const run =
    getRuns(paragraph)[0] ??
    (() => {
      const next = createRun(xml);
      paragraph.appendChild(next);
      return next;
    })();

  const textNode = createText(xml);
  run.appendChild(textNode);
  return textNode;
};

const setCellText = (cell: Element | undefined, value: string) => {
  if (!cell) return;
  const first = getOrCreateTextNode(cell);
  setTextNodeValue(first, value);
  getTextNodes(cell)
    .slice(1)
    .forEach((node) => {
      node.textContent = "";
    });
};

const setParagraphText = (paragraph: Element | undefined, value: string) => {
  if (!paragraph) return;
  const xml = paragraph.ownerDocument;
  const runs = getRuns(paragraph);
  if (runs.length === 0) {
    const run = createRun(xml);
    const textNode = createText(xml);
    setTextNodeValue(textNode, value);
    run.appendChild(textNode);
    paragraph.appendChild(run);
    return;
  }

  runs.forEach((run, index) => {
    if (index === 0) {
      const texts = getTextNodes(run);
      const textNode =
        texts[0] ??
        (() => {
          const next = createText(xml);
          run.appendChild(next);
          return next;
        })();
      setTextNodeValue(textNode, value);
      texts.slice(1).forEach((node) => {
        node.textContent = "";
      });
      Array.from(run.childNodes)
        .filter((node) => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "br")
        .forEach((node) => run.removeChild(node));
    } else {
      run.parentNode?.removeChild(run);
    }
  });
};

const setParagraphLines = (paragraph: Element | undefined, lines: string[]) => {
  if (!paragraph) return;
  const xml = paragraph.ownerDocument;
  while (paragraph.firstChild) {
    paragraph.removeChild(paragraph.firstChild);
  }

  const run = createRun(xml);
  if (lines.length === 0) {
    const textNode = createText(xml);
    setTextNodeValue(textNode, "");
    run.appendChild(textNode);
    paragraph.appendChild(run);
    return;
  }

  lines.forEach((line, index) => {
    if (index > 0) {
      run.appendChild(createBreak(xml));
    }
    const textNode = createText(xml);
    setTextNodeValue(textNode, line);
    run.appendChild(textNode);
  });
  paragraph.appendChild(run);
};

const findTableByKeywords = (tables: Element[], keywords: string[]) =>
  tables.find((table) => {
    const tableText = normalizeText(getTextNodes(table).map((node) => node.textContent || "").join(" "));
    return keywords.every((keyword) => tableText.includes(normalizeText(keyword)));
  });

const findRowByFirstCell = (table: Element | undefined, label: string) =>
  getRows(table).find((row) => normalizeLabel(getCellText(getCells(row)[0] || row)) === normalizeLabel(label));

const findHeaderRowIndex = (table: Element | undefined, requiredHeaders: string[]) =>
  getRows(table).findIndex((row) => {
    const rowText = normalizeText(getCells(row).map((cell) => getCellText(cell)).join(" | "));
    return requiredHeaders.every((header) => rowText.includes(normalizeText(header)));
  });

const cloneRow = (table: Element, sourceRowIndex: number) => {
  const rows = getRows(table);
  const sourceRow = rows[sourceRowIndex] ?? rows[rows.length - 1];
  if (!sourceRow) {
    throw new Error("Word şablonunda çoğaltılacak tablo satırı bulunamadı.");
  }
  const clone = sourceRow.cloneNode(true) as Element;
  table.appendChild(clone);
  return clone;
};

const fillStrictRows = (table: Element | undefined, rows: string[][], templateRowIndex: number, startRowIndex: number) => {
  if (!table) return;
  let tableRows = getRows(table);

  while (tableRows.length < startRowIndex + rows.length) {
    cloneRow(table, templateRowIndex);
    tableRows = getRows(table);
  }

  while (tableRows.length > startRowIndex + rows.length && tableRows.length > startRowIndex) {
    const lastRow = tableRows[tableRows.length - 1];
    lastRow.parentNode?.removeChild(lastRow);
    tableRows = getRows(table);
  }

  if (rows.length === 0) {
    while (tableRows.length > startRowIndex) {
      const lastRow = tableRows[tableRows.length - 1];
      lastRow.parentNode?.removeChild(lastRow);
      tableRows = getRows(table);
    }
    return;
  }

  rows.forEach((source, rowOffset) => {
    const cells = getCells(tableRows[startRowIndex + rowOffset]);
    source.forEach((value, cellIndex) => setCellText(cells[cellIndex], value));
  });
};

const removeRowIfExists = (row: Element | undefined) => {
  row?.parentNode?.removeChild(row);
};

const findParagraphByExactText = (paragraphs: Element[], text: string) =>
  paragraphs.find((paragraph) => normalizeText(getParagraphText(paragraph)) === normalizeText(text));

const getNextParagraph = (paragraphs: Element[], paragraph: Element | undefined) => {
  if (!paragraph) return undefined;
  const index = paragraphs.indexOf(paragraph);
  if (index < 0) return undefined;
  return paragraphs[index + 1];
};

const formatDate = (value?: string | null) => {
  const normalized = cleanText(value);
  if (!normalized) return "";
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return normalized;
  return new Intl.DateTimeFormat("tr-TR").format(date);
};

const slugify = (value: string) =>
  cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "risk-degerlendirme";

export async function generateRiskAssessmentOfficialDocx(payload: OfficialRiskAssessmentDocxPayload) {
  const response = await fetch(RISK_TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("Word şablonu yüklenemedi.");
  }

  const templateBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("Word şablonunda document.xml bulunamadı.");
  }

  const xml = parseXml(await documentFile.async("string"));
  const tables = getTables(xml);
  const paragraphs = getParagraphs(xml);
  const hasNote = Boolean(cleanText(payload.companyInfo.note));

  const coverTable = findTableByKeywords(tables, ["Tehlike Sınıfı", "Faaliyet Kapsamı", "Firma Ünvanı"]);
  const coverValueMap: Record<string, string> = {
    "Tehlike Sınıfı": cleanText(payload.companyInfo.hazardClass),
    "Faaliyet Kapsamı": cleanText(payload.companyInfo.activityScope),
    "Firma Ünvanı": cleanText(payload.companyInfo.companyTitle),
    Adres: cleanText(payload.companyInfo.address),
    "E-posta": cleanText(payload.companyInfo.email),
    "İşyeri Sicil No": cleanText(payload.companyInfo.workplaceRegistryNo),
    "Çalışan Sayısı": cleanText(payload.companyInfo.employeeCount),
    "Değerlendirme Tarihi": formatDate(payload.companyInfo.assessmentDate),
    "Risk Değerlendirme Yöntemi": cleanText(payload.companyInfo.riskMethod),
    Not: cleanText(payload.companyInfo.note),
  };

  getRows(coverTable).forEach((row) => {
    const cells = getCells(row);
    const label = getCellText(cells[0]);
    if (normalizeLabel(label) === normalizeLabel("Not") && !hasNote) {
      removeRowIfExists(row);
      return;
    }
    const nextValue = Object.entries(coverValueMap).find(([key]) => normalizeLabel(key) === normalizeLabel(label))?.[1];
    if (nextValue !== undefined) {
      setCellText(cells[1], nextValue);
    }
  });

  const teamTable = findTableByKeywords(tables, ["İşveren", "Çalışan Temsilcisi", "İş Güvenliği Uzmanı"]);
  const teamRows = [
    ["İşveren", payload.teamInfo.employer.fullName, payload.teamInfo.employer.tcNo, payload.teamInfo.employer.phone, ""],
    [
      "Çalışan Temsilcisi",
      payload.teamInfo.employeeRepresentative.fullName,
      payload.teamInfo.employeeRepresentative.tcNo,
      payload.teamInfo.employeeRepresentative.phone,
      "",
    ],
    [
      "İş Güvenliği Uzmanı",
      payload.teamInfo.safetyExpert.fullName,
      payload.teamInfo.safetyExpert.tcNo,
      payload.teamInfo.safetyExpert.phone,
      payload.teamInfo.safetyExpert.certificateNo || "",
    ],
    [
      "İşyeri Hekimi",
      payload.teamInfo.workplaceDoctor.fullName,
      payload.teamInfo.workplaceDoctor.tcNo,
      payload.teamInfo.workplaceDoctor.phone,
      payload.teamInfo.workplaceDoctor.certificateNo || "",
    ],
    [
      "OSGB",
      payload.teamInfo.osgb.title,
      "",
      payload.teamInfo.osgb.phone,
      cleanText(
        [
          payload.teamInfo.osgb.authorizedPerson ? `Yetkili: ${payload.teamInfo.osgb.authorizedPerson}` : "",
          payload.teamInfo.osgb.email ? `E-posta: ${payload.teamInfo.osgb.email}` : "",
        ]
          .filter(Boolean)
          .join(" / "),
      ),
    ],
  ];

  teamRows.forEach((teamRow) => {
    const row = findRowByFirstCell(teamTable, teamRow[0]);
    const cells = getCells(row);
    teamRow.forEach((value, cellIndex) => setCellText(cells[cellIndex], cleanText(value)));
  });

  const scopeHeading = findParagraphByExactText(paragraphs, "2. Değerlendirme Kapsamı");
  const scopeParagraph = getNextParagraph(paragraphs, scopeHeading);
  const scopeLines =
    payload.scopeInfo.assessmentScopeItems.map((item) => cleanText(item)).filter(Boolean).length > 0
      ? payload.scopeInfo.assessmentScopeItems.map((item) => cleanText(item)).filter(Boolean).map((item) => `• ${item}`)
      : ["Değerlendirme kapsamı belirtilmemiştir."];
  setParagraphLines(scopeParagraph, scopeLines);

  const sectionsHeading = findParagraphByExactText(paragraphs, "Değerlendirilen Bölümler / Faaliyetler");
  const sectionsParagraph = getNextParagraph(paragraphs, sectionsHeading);
  if (sectionsHeading && sectionsParagraph) {
    setParagraphText(sectionsParagraph, cleanText(payload.scopeInfo.evaluatedSections));
  }

  const methodHeading = findParagraphByExactText(paragraphs, "3. Risk Puanlama Metodu");
  const methodParagraph = getNextParagraph(paragraphs, methodHeading);
  setParagraphText(methodParagraph, METHOD_DESCRIPTION);

  const riskTable = findTableByKeywords(tables, ["Bölüm / Faaliyet", "Tehlike Kaynağı", "Alınacak İlave Önlemler"]);
  const riskHeaderIndex = findHeaderRowIndex(riskTable, ["No", "Bölüm / Faaliyet", "Tehlike Kaynağı"]);
  const riskRows = payload.riskItems.map((item, index) => [
    String(item.no || index + 1),
    cleanText(item.departmentActivity),
    cleanText(item.hazardSource),
    cleanText(item.riskConsequence),
    cleanText(item.affectedPeople),
    cleanText(item.currentMeasure),
    cleanText(item.probability),
    cleanText(item.severity),
    cleanText(item.riskScore),
    cleanText(item.riskLevel),
    cleanText(item.additionalMeasures),
    cleanText(item.responsible),
    formatDate(item.deadline),
  ]);
  if (riskTable && riskHeaderIndex >= 0) {
    fillStrictRows(riskTable, riskRows, riskHeaderIndex + 1, riskHeaderIndex + 1);
  }

  const actionTable = findTableByKeywords(tables, ["Tespit / Risk", "Yapılacak Faaliyet", "Sorumlu"]);
  const actionHeaderIndex = findHeaderRowIndex(actionTable, ["No", "Tespit / Risk", "Yapılacak Faaliyet"]);
  const actionRows = payload.correctiveActions.map((item, index) => [
    String(item.no || index + 1),
    cleanText(item.finding),
    cleanText(item.action),
    cleanText(item.responsible),
    formatDate(item.deadline),
    cleanText(item.status),
  ]);
  if (actionTable && actionHeaderIndex >= 0) {
    fillStrictRows(actionTable, actionRows, actionHeaderIndex + 1, actionHeaderIndex + 1);
  }

  const conclusionHeading = findParagraphByExactText(paragraphs, "6. Genel Sonuç ve Onay");
  const conclusionParagraph = getNextParagraph(paragraphs, conclusionHeading);
  const conclusionLines =
    payload.conclusionInfo.conclusionItems.map((item) => cleanText(item)).filter(Boolean).length > 0
      ? payload.conclusionInfo.conclusionItems.map((item) => cleanText(item)).filter(Boolean).map((item) => `• ${item}`)
      : ["Genel sonuç belirtilmemiştir."];
  setParagraphLines(conclusionParagraph, conclusionLines);

  const conclusionInfoTable = findTableByKeywords(tables, ["Hazırlayan", "Onaylayan", "İmza Tarihi"]);
  const conclusionValueMap: Record<string, string> = {
    Hazırlayan: cleanText(payload.conclusionInfo.preparedBy),
    Onaylayan: cleanText(payload.conclusionInfo.approvedBy),
    "İmza Tarihi": formatDate(payload.conclusionInfo.signatureDate),
    "Onay Notu": cleanText(payload.conclusionInfo.approvalNote),
  };
  getRows(conclusionInfoTable).forEach((row) => {
    const cells = getCells(row);
    const label = getCellText(cells[0]);
    if (normalizeLabel(label) === normalizeLabel("Onay Notu") && !cleanText(payload.conclusionInfo.approvalNote)) {
      removeRowIfExists(row);
      return;
    }
    const nextValue = Object.entries(conclusionValueMap).find(([key]) => normalizeLabel(key) === normalizeLabel(label))?.[1];
    if (nextValue !== undefined) {
      setCellText(cells[1], nextValue);
    }
  });

  const signatureTable = findTableByKeywords(tables, ["Adı Soyadı", "Görevi", "Belge / İletişim Bilgisi"]);
  const signatureHeaderIndex = findHeaderRowIndex(signatureTable, ["Adı Soyadı", "Görevi", "Belge / İletişim Bilgisi"]);
  const signatureRows = payload.signatureRows.map((row) => [
    cleanText(row.fullName),
    cleanText(row.role),
    cleanText(row.documentOrContact),
    "",
  ]);
  if (signatureTable && signatureHeaderIndex >= 0) {
    fillStrictRows(signatureTable, signatureRows, signatureHeaderIndex + 1, signatureHeaderIndex + 1);
  }

  zip.file("word/document.xml", serializeXml(xml));
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const fileName = `risk-analizi-${slugify(payload.companyInfo.companyTitle)}-${payload.companyInfo.assessmentDate || "taslak"}.docx`;
  saveAs(blob, fileName);
}
