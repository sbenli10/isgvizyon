import { saveAs } from "file-saver";
import JSZip from "jszip";

import { supabase } from "@/integrations/supabase/client";
import {
  mergeADEPPlanData,
  type ADEPPlanData,
  type ADEPPlanRow,
  type ADEPPerson,
  type ADEPTeam,
  type ADEPTeamKey,
} from "@/lib/adepPlanSchema";

export const ADEP_OFFICIAL_TEMPLATE_PATH = "/templates/ACİL DURUM PLANI.docx";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const serializeXml = (xml: XMLDocument) => new XMLSerializer().serializeToString(xml);

type XmlParent = XMLDocument | Element;

const getElements = (parent: XmlParent, tagName: string): Element[] =>
  Array.from(parent.getElementsByTagNameNS(WORD_NS, tagName)) as Element[];

const getChildElements = (parent: Element, tagName: string) =>
  Array.from(parent.childNodes).filter(
    (node): node is Element => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === tagName,
  );

const getTables = (xml: XMLDocument) => getElements(xml, "tbl");
const getRows = (table: Element | undefined) => (table ? getChildElements(table, "tr") : []);
const getCells = (row: Element | undefined) => (row ? getChildElements(row, "tc") : []);
const getParagraphs = (parent: XmlParent) => getElements(parent, "p");
const getRuns = (parent: XmlParent) => getElements(parent, "r");
const getTextNodes = (parent: XmlParent) => getElements(parent, "t");

const createParagraph = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:p");
const createRun = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:r");
const createText = (xml: XMLDocument) => xml.createElementNS(WORD_NS, "w:t");
const createElement = (xml: XMLDocument, ns: string, name: string) => xml.createElementNS(ns, name);

const safeText = (value?: string | number | null, fallback = "-") => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : fallback;
};

const safeFileName = (value: string) =>
  value
    .replace(/[^\wğüşıöçİĞÜŞÖÇ-]+/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const formatDateOrDash = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
};

const normalizeWordText = (value: string) => value.replace(/\s+/g, " ").trim();
const getParagraphText = (paragraph: Element) =>
  normalizeWordText(getTextNodes(paragraph).map((node) => node.textContent || "").join(""));

const getOrCreateTextNode = (cell: Element) => {
  const xml = cell.ownerDocument;
  const textNodes = getTextNodes(cell);
  if (textNodes.length) return textNodes[0];

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

  const text = createText(xml);
  run.appendChild(text);
  return text;
};

const setTextNodeValue = (textNode: Element, value: string) => {
  if (/\s/.test(value)) {
    textNode.setAttributeNS(XML_NS, "xml:space", "preserve");
  } else {
    textNode.removeAttributeNS(XML_NS, "space");
  }
  textNode.textContent = value;
};

const setCellText = (cell: Element | undefined, value: string) => {
  if (!cell) return;
  const primaryNode = getOrCreateTextNode(cell);
  setTextNodeValue(primaryNode, value ?? "");
  getTextNodes(cell)
    .slice(1)
    .forEach((node) => {
      node.textContent = "";
    });
};

const setParagraphText = (paragraph: Element | undefined, value: string) => {
  if (!paragraph) return;
  const xml = paragraph.ownerDocument;
  const textNodes = getTextNodes(paragraph);
  const primaryNode =
    textNodes[0] ??
    (() => {
      const run =
        getRuns(paragraph)[0] ??
        (() => {
          const next = createRun(xml);
          paragraph.appendChild(next);
          return next;
        })();
      const text = createText(xml);
      run.appendChild(text);
      return text;
    })();

  setTextNodeValue(primaryNode, value);
  textNodes.slice(1).forEach((node) => {
    node.textContent = "";
  });
};

const findParagraphByExactText = (paragraphs: Element[], target: string) =>
  paragraphs.find((paragraph) => getParagraphText(paragraph) === normalizeWordText(target));

const cloneRow = (table: Element, sourceRowIndex: number) => {
  const rows = getRows(table);
  const sourceRow = rows[sourceRowIndex] ?? rows[rows.length - 1];
  if (!sourceRow) throw new Error("Word şablonunda çoğaltılacak tablo satırı bulunamadı.");
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

const setTableCell = (tables: Element[], tableIndex: number, rowIndex: number, cellIndex: number, value: string) => {
  const row = getRows(tables[tableIndex])[rowIndex];
  const cell = getCells(row)[cellIndex];
  setCellText(cell, value);
};

const fillSimpleRows = (
  table: Element | undefined,
  rows: Array<Array<string>>,
  startRowIndex: number,
  templateRowIndex: number,
) => {
  if (!table) return;

  const requiredTotalRows = Math.max(startRowIndex + rows.length, templateRowIndex + 1);
  const tableRows = ensureRowCount(table, requiredTotalRows, templateRowIndex);

  for (let rowIndex = startRowIndex; rowIndex < tableRows.length; rowIndex += 1) {
    const cells = getCells(tableRows[rowIndex]);
    const source = rows[rowIndex - startRowIndex];

    if (!source) {
      cells.forEach((cell) => setCellText(cell, ""));
      continue;
    }

    source.forEach((value, cellIndex) => setCellText(cells[cellIndex], value));
  }
};

const teamLabels: Record<ADEPTeamKey, string> = {
  sondurme: "Söndürme Elemanı",
  kurtarma: "Kurtarma Elemanı",
  koruma: "Koruma Elemanı",
  ilkyardim: "İlkyardım Elemanı",
};

const getTeamLeader = (planData: ADEPPlanData, key: ADEPTeamKey): ADEPPerson =>
  planData.ekipler[key]?.ekip_baskani || { ad_soyad: "", tc_no: "", telefon: "" };

const getSignatureNames = (planData: ADEPPlanData) => [
  safeText(planData.yetkililer.isveren_vekil.ad_soyad),
  safeText(planData.yetkililer.isg_uzmani.ad_soyad),
  safeText(planData.yetkililer.isyeri_hekimi.ad_soyad),
  safeText(getTeamLeader(planData, "sondurme").ad_soyad),
  safeText(getTeamLeader(planData, "kurtarma").ad_soyad),
  safeText(getTeamLeader(planData, "koruma").ad_soyad),
  safeText(getTeamLeader(planData, "ilkyardim").ad_soyad),
];

const fillFooterSignatureTable = (table: Element | undefined, names: string[]) => {
  if (!table) return;
  const footerRow = getRows(table)[1];
  const cells = getCells(footerRow);
  names.forEach((name, index) => setCellText(cells[index], name));
};

const buildSignatureRows = (planData: ADEPPlanData) => [
  {
    name: safeText(planData.yetkililer.isveren_vekil.ad_soyad),
    tcOrCertificate: safeText(planData.yetkililer.isveren_vekil.tc_no),
    duty: "İşveren / İşveren Vekili",
  },
  {
    name: safeText(getTeamLeader(planData, "sondurme").ad_soyad),
    tcOrCertificate: safeText(getTeamLeader(planData, "sondurme").tc_no),
    duty: "Söndürme Elemanı",
  },
  {
    name: safeText(getTeamLeader(planData, "kurtarma").ad_soyad),
    tcOrCertificate: safeText(getTeamLeader(planData, "kurtarma").tc_no),
    duty: "Kurtarma Elemanı",
  },
  {
    name: safeText(getTeamLeader(planData, "koruma").ad_soyad),
    tcOrCertificate: safeText(getTeamLeader(planData, "koruma").tc_no),
    duty: "Koruma Elemanı",
  },
  {
    name: safeText(getTeamLeader(planData, "ilkyardim").ad_soyad),
    tcOrCertificate: safeText(getTeamLeader(planData, "ilkyardim").tc_no),
    duty: "İlkyardım Elemanı",
  },
  {
    name: safeText(planData.yetkililer.isg_uzmani.ad_soyad),
    tcOrCertificate: safeText(planData.yetkililer.isg_uzmani.belge_no || planData.yetkililer.isg_uzmani.tc_no),
    duty: "İş Güvenliği Uzmanı",
  },
  {
    name: safeText(planData.yetkililer.isyeri_hekimi.ad_soyad),
    tcOrCertificate: safeText(planData.yetkililer.isyeri_hekimi.belge_no || planData.yetkililer.isyeri_hekimi.tc_no),
    duty: "İşyeri Hekimi",
  },
];

const fillSignatureTable = (table: Element | undefined, planData: ADEPPlanData) => {
  if (!table) return;
  const rows = getRows(table);
  const signatureRows = buildSignatureRows(planData);

  signatureRows.forEach((entry, index) => {
    const rowIndex = index < 5 ? index + 1 : index + 2;
    const cells = getCells(rows[rowIndex]);
    setCellText(cells[1], entry.name);
    setCellText(cells[2], entry.tcOrCertificate);
    setCellText(cells[3], entry.duty);
  });
};

const fillMaterialInventory = (table: Element | undefined, planData: ADEPPlanData) => {
  if (!table) return;

  const materials = planData.malzeme_envanteri.filter((item) => item.equipment_name.trim() || item.quantity.trim());
  const equipmentPairs: Array<Array<string>> = [];

  for (let index = 0; index < materials.length; index += 2) {
    const left = materials[index];
    const right = materials[index + 1];
    equipmentPairs.push([
      safeText(left?.equipment_name, ""),
      safeText(left?.quantity, ""),
      safeText(right?.equipment_name, ""),
      safeText(right?.quantity, ""),
    ]);
  }

  fillSimpleRows(table, equipmentPairs.length ? equipmentPairs : [["", "", "", ""]], 1, 6);
};

const buildTeamRows = (team: ADEPTeam, fallbackArea: string) => {
  const members = team.uyeler.filter((member) => member.ad_soyad.trim() || member.telefon.trim() || member.tc_no.trim());
  const leader = team.ekip_baskani;
  const assistant = members[0];
  const remainingMembers = members.slice(1);

  return [
    [safeText(leader.ad_soyad, ""), "Ekip Bşk.", fallbackArea, safeText(leader.telefon, ""), ""],
    [safeText(assistant?.ad_soyad, ""), "Ekip Bşk. Yard.", fallbackArea, safeText(assistant?.telefon, ""), ""],
    ...remainingMembers.map((member) => [
      safeText(member.ad_soyad, ""),
      "Üye",
      fallbackArea,
      safeText(member.telefon, ""),
      "",
    ]),
  ];
};

const fillTeamTable = (table: Element | undefined, team: ADEPTeam, fallbackArea: string) => {
  if (!table) return;
  const rows = buildTeamRows(team, fallbackArea);
  fillSimpleRows(table, rows.length ? rows : [["", "", "", "", ""]], 2, 5);
};

const dataUrlToArrayBuffer = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Seçili kroki görseli okunamadı.");
  }
  return response.arrayBuffer();
};

const getImageDimensions = (buffer: ArrayBuffer, mimeType: string) => {
  const view = new DataView(buffer);

  if (mimeType === "image/png" && view.byteLength >= 24) {
    return {
      width: view.getUint32(16),
      height: view.getUint32(20),
    };
  }

  if ((mimeType === "image/jpeg" || mimeType === "image/jpg") && view.byteLength >= 4) {
    let offset = 2;
    while (offset < view.byteLength) {
      const marker = view.getUint16(offset);
      offset += 2;
      if (marker === 0xffc0 || marker === 0xffc2) {
        offset += 3;
        return {
          height: view.getUint16(offset),
          width: view.getUint16(offset + 2),
        };
      }
      const blockLength = view.getUint16(offset);
      offset += blockLength;
    }
  }

  return { width: 1600, height: 900 };
};

const computeImageExtent = (width: number, height: number) => {
  const maxWidth = 5_900_000;
  const maxHeight = 4_100_000;
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    cx: Math.round(width * ratio),
    cy: Math.round(height * ratio),
  };
};

const addAppendixSketchImage = async (zip: JSZip, xml: XMLDocument, dataUrl: string) => {
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  if (!relsXml) {
    throw new Error("Word ilişkileri dosyası okunamadı.");
  }

  const relsDoc = parseXml(relsXml);
  const relationships = Array.from(relsDoc.getElementsByTagName("Relationship"));
  const nextRelNumber =
    relationships.reduce((max, relation) => {
      const id = relation.getAttribute("Id") || "";
      const numeric = Number(id.replace("rId", ""));
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0) + 1;

  const imageRelId = `rId${nextRelNumber}`;
  const imageName = `ek9-kroki-${Date.now()}.png`;
  const mediaPath = `word/media/${imageName}`;

  const imageBuffer = await dataUrlToArrayBuffer(dataUrl);
  const { width, height } = getImageDimensions(imageBuffer, "image/png");
  const { cx, cy } = computeImageExtent(width, height);

  zip.file(mediaPath, imageBuffer);

  const relationship = relsDoc.createElement("Relationship");
  relationship.setAttribute("Id", imageRelId);
  relationship.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image");
  relationship.setAttribute("Target", `media/${imageName}`);
  relsDoc.documentElement.appendChild(relationship);
  zip.file("word/_rels/document.xml.rels", serializeXml(relsDoc));

  const paragraphs = getParagraphs(xml);
  const appendixParagraph = findParagraphByExactText(paragraphs, "Ek-9 : İşyeri Krokisi");
  const targetParagraph = appendixParagraph ? paragraphs[paragraphs.indexOf(appendixParagraph) + 1] : undefined;
  if (!targetParagraph) {
    throw new Error("Ek-9 kroki bölümü Word şablonunda bulunamadı.");
  }

  while (targetParagraph.firstChild) {
    targetParagraph.removeChild(targetParagraph.firstChild);
  }

  const paragraphProps = createElement(xml, WORD_NS, "w:pPr");
  const spacing = createElement(xml, WORD_NS, "w:spacing");
  spacing.setAttribute("w:before", "120");
  spacing.setAttribute("w:after", "120");
  paragraphProps.appendChild(spacing);
  targetParagraph.appendChild(paragraphProps);

  const run = createElement(xml, WORD_NS, "w:r");
  const drawing = createElement(xml, WORD_NS, "w:drawing");
  const inline = createElement(xml, WP_NS, "wp:inline");
  inline.setAttribute("distT", "0");
  inline.setAttribute("distB", "0");
  inline.setAttribute("distL", "0");
  inline.setAttribute("distR", "0");

  const extent = createElement(xml, WP_NS, "wp:extent");
  extent.setAttribute("cx", String(cx));
  extent.setAttribute("cy", String(cy));

  const effectExtent = createElement(xml, WP_NS, "wp:effectExtent");
  effectExtent.setAttribute("l", "0");
  effectExtent.setAttribute("t", "0");
  effectExtent.setAttribute("r", "0");
  effectExtent.setAttribute("b", "0");

  const docPr = createElement(xml, WP_NS, "wp:docPr");
  docPr.setAttribute("id", "9001");
  docPr.setAttribute("name", "Ek-9 İşyeri Krokisi");

  const cNvGraphicFramePr = createElement(xml, WP_NS, "wp:cNvGraphicFramePr");

  const graphic = createElement(xml, DRAWING_NS, "a:graphic");
  const graphicData = createElement(xml, DRAWING_NS, "a:graphicData");
  graphicData.setAttribute("uri", "http://schemas.openxmlformats.org/drawingml/2006/picture");

  const pic = createElement(xml, PIC_NS, "pic:pic");
  const nvPicPr = createElement(xml, PIC_NS, "pic:nvPicPr");
  const cNvPr = createElement(xml, PIC_NS, "pic:cNvPr");
  cNvPr.setAttribute("id", "0");
  cNvPr.setAttribute("name", imageName);
  const cNvPicPr = createElement(xml, PIC_NS, "pic:cNvPicPr");
  nvPicPr.appendChild(cNvPr);
  nvPicPr.appendChild(cNvPicPr);

  const blipFill = createElement(xml, PIC_NS, "pic:blipFill");
  const blip = createElement(xml, DRAWING_NS, "a:blip");
  blip.setAttributeNS(REL_NS, "r:embed", imageRelId);
  const stretch = createElement(xml, DRAWING_NS, "a:stretch");
  stretch.appendChild(createElement(xml, DRAWING_NS, "a:fillRect"));
  blipFill.appendChild(blip);
  blipFill.appendChild(stretch);

  const spPr = createElement(xml, PIC_NS, "pic:spPr");
  const xfrm = createElement(xml, DRAWING_NS, "a:xfrm");
  const off = createElement(xml, DRAWING_NS, "a:off");
  off.setAttribute("x", "0");
  off.setAttribute("y", "0");
  const ext = createElement(xml, DRAWING_NS, "a:ext");
  ext.setAttribute("cx", String(cx));
  ext.setAttribute("cy", String(cy));
  xfrm.appendChild(off);
  xfrm.appendChild(ext);
  const prstGeom = createElement(xml, DRAWING_NS, "a:prstGeom");
  prstGeom.setAttribute("prst", "rect");
  prstGeom.appendChild(createElement(xml, DRAWING_NS, "a:avLst"));
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
  targetParagraph.appendChild(run);
};

type ADEPWordPlanSource = Pick<ADEPPlanRow, "plan_name" | "company_name" | "plan_data"> & {
  created_at?: string | null;
};

const replaceWordTemplate = async (plan: ADEPWordPlanSource) => {
  const templateResponse = await fetch(ADEP_OFFICIAL_TEMPLATE_PATH);
  if (!templateResponse.ok) {
    throw new Error("Acil durum Word şablonu yüklenemedi.");
  }

  const zip = await JSZip.loadAsync(await templateResponse.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("Word şablonunun document.xml dosyası okunamadı.");
  }

  const planData = mergeADEPPlanData(plan.plan_data);
  const xml = parseXml(documentXml);
  const tables = getTables(xml);
  const paragraphs = getParagraphs(xml);

  const companyName = safeText(planData.firma_bilgileri.unvan || plan.company_name);
  const preparedAt = formatDateOrDash(planData.genel_bilgiler.hazirlanma_tarihi || plan.created_at);
  const validUntil = formatDateOrDash(planData.genel_bilgiler.gecerlilik_tarihi);
  const defaultArea = safeText(planData.firma_bilgileri.unvan || planData.firma_bilgileri.adres, "İşletme geneli");
  const signatoryNames = getSignatureNames(planData);

  const titleParagraph = findParagraphByExactText(paragraphs, "ACİL DURUM PLANI");
  const subtitleParagraph = findParagraphByExactText(paragraphs, "ACİL DURUM EYLEM PLANI");
  setParagraphText(titleParagraph, safeText(planData.genel_bilgiler.plan_basligi, "ACİL DURUM PLANI"));
  setParagraphText(subtitleParagraph, safeText(planData.genel_bilgiler.plan_alt_basligi, "ACİL DURUM EYLEM PLANI"));

  setTableCell(tables, 2, 0, 1, safeText(planData.osgb_bilgileri.unvan));
  setTableCell(tables, 2, 1, 1, safeText(planData.osgb_bilgileri.adres));
  setTableCell(tables, 2, 1, 2, safeText(planData.osgb_bilgileri.telefon || planData.osgb_bilgileri.iletisim_bilgisi, ""));
  setTableCell(tables, 2, 2, 2, companyName);
  setTableCell(tables, 2, 3, 2, safeText(planData.firma_bilgileri.adres));
  setTableCell(tables, 2, 4, 2, safeText(planData.firma_bilgileri.sgk_sicil_no));
  setTableCell(tables, 2, 5, 2, safeText(planData.firma_bilgileri.tehlike_sinifi));

  setTableCell(tables, 3, 0, 1, preparedAt);
  setTableCell(tables, 3, 1, 1, validUntil);

  const summaryNames = [
    safeText(planData.yetkililer.isveren_vekil.ad_soyad),
    safeText(planData.yetkililer.isg_uzmani.ad_soyad),
    safeText(planData.yetkililer.isyeri_hekimi.ad_soyad),
    safeText(getTeamLeader(planData, "sondurme").ad_soyad),
    safeText(getTeamLeader(planData, "kurtarma").ad_soyad),
    safeText(getTeamLeader(planData, "koruma").ad_soyad),
    safeText(getTeamLeader(planData, "ilkyardim").ad_soyad),
  ];
  summaryNames.forEach((name, index) => setTableCell(tables, 4, index + 1, 0, name));

  [5, 8, 43, 44, 45, 47, 49, 50, 51, 52, 53, 54, 55, 57, 62, 65, 67, 69].forEach((tableIndex) =>
    fillFooterSignatureTable(tables[tableIndex], signatoryNames),
  );

  setTableCell(tables, 56, 2, 0, safeText(planData.yetkililer.isveren_vekil.ad_soyad));
  setTableCell(tables, 56, 2, 2, defaultArea);
  setTableCell(tables, 56, 2, 3, safeText(planData.yetkililer.isveren_vekil.telefon));

  fillTeamTable(tables[58], planData.ekipler.sondurme, defaultArea);
  fillTeamTable(tables[59], planData.ekipler.kurtarma, defaultArea);
  fillTeamTable(tables[60], planData.ekipler.koruma, defaultArea);
  fillTeamTable(tables[61], planData.ekipler.ilkyardim, defaultArea);

  fillMaterialInventory(tables[64], planData);
  setTableCell(tables, 66, 1, 1, safeText(planData.toplanma_alani));
  fillSignatureTable(tables[68], planData);

  if (planData.ekler.secili_kroki?.thumbnail_data_url) {
    await addAppendixSketchImage(zip, xml, planData.ekler.secili_kroki.thumbnail_data_url);
  }

  zip.file("word/document.xml", serializeXml(xml));
  return zip.generateAsync({ type: "blob" });
};

export const generateADEPWordDocumentFromData = async (
  planData: ADEPPlanData,
  planName = "Acil Durum Eylem Planı",
): Promise<Blob> =>
  replaceWordTemplate({
    plan_name: planName,
    company_name: planData.firma_bilgileri.unvan,
    plan_data: planData,
    created_at: new Date().toISOString(),
  });

export const generateADEPWordDocument = async (planId: string): Promise<Blob> => {
  const { data, error } = await supabase.from("adep_plans").select("*").eq("id", planId).single();
  if (error || !data) {
    throw new Error(error?.message || "ADEP plan kaydı bulunamadı.");
  }

  return replaceWordTemplate({
    plan_name: data.plan_name,
    company_name: data.company_name,
    plan_data: mergeADEPPlanData(data.plan_data),
    created_at: data.created_at,
  });
};

export const downloadADEPWordDocument = async (planId: string) => {
  const { data, error } = await supabase.from("adep_plans").select("*").eq("id", planId).single();
  if (error || !data) {
    throw new Error(error?.message || "ADEP plan kaydı bulunamadı.");
  }

  const normalizedData = mergeADEPPlanData(data.plan_data);
  const blob = await replaceWordTemplate({
    plan_name: data.plan_name,
    company_name: data.company_name,
    plan_data: normalizedData,
    created_at: data.created_at,
  });
  const fallbackName = safeFileName(data.plan_name || normalizedData.firma_bilgileri.unvan || "adep-plan");
  saveAs(blob, `${fallbackName || "adep-plan"}.docx`);
};
