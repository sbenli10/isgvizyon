import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

import type { RiskTemplateEmergencyInfo, RiskTemplatePerson } from "@/lib/riskTemplateExport";

const PROCEDURE_TEMPLATE_PATH = "/templates/risk-degerlendirme-olusturma-sureci.docx";

export type RiskProcedureCompanyInfo = {
  companyTitle?: string | null;
  workplaceRegistryNo?: string | null;
  hazardClass?: string | null;
  employeeCount?: string | number | null;
  activityScope?: string | null;
  address?: string | null;
};

export type RiskProcedureTeamInfo = {
  employer?: RiskTemplatePerson;
  safetyExpert?: RiskTemplatePerson;
  workplaceDoctor?: RiskTemplatePerson;
  employeeRepresentative?: RiskTemplatePerson;
};

export type RiskProcedureTemplatePayload = {
  companyInfo: RiskProcedureCompanyInfo;
  teamInfo: RiskProcedureTeamInfo;
  emergencyInfo?: RiskTemplateEmergencyInfo | null;
  riskAnalysisPageCount?: string | number | null;
};

const cleanText = (value?: string | number | null) => String(value ?? "").replace(/\s+/g, " ").trim();

const formatDate = (date = new Date()) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

const sanitizeFileName = (value?: string | null) =>
  cleanText(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "FIRMA";

const buildTemplateData = (payload: RiskProcedureTemplatePayload) => {
  const emergency = payload.emergencyInfo || {};
  return {
    firma_adi: cleanText(payload.companyInfo.companyTitle),
    rapor_tarihi: formatDate(),
    risk_sayfa_sayisi: cleanText(payload.riskAnalysisPageCount) || "1",
    sgk_no: cleanText(payload.companyInfo.workplaceRegistryNo),
    tehlike_sinifi: cleanText(payload.companyInfo.hazardClass),
    faaliyet_kapsami: cleanText(payload.companyInfo.activityScope),
    calisan_sayisi: cleanText(payload.companyInfo.employeeCount),
    i1: cleanText(payload.teamInfo.employer?.fullName),
    i2: cleanText(payload.teamInfo.safetyExpert?.fullName),
    i3: cleanText(payload.teamInfo.workplaceDoctor?.fullName),
    i4: cleanText(payload.teamInfo.employeeRepresentative?.fullName),
    i5: cleanText(emergency.allUnitsContact?.fullName),
    i6: cleanText(emergency.fireChief?.fullName),
    i7: cleanText(emergency.rescueChief?.fullName),
    i8: cleanText(emergency.protectionChief?.fullName),
    i9: cleanText(emergency.firstAidChief?.fullName),
  };
};

const normalizeSplitPlaceholders = (zip: PizZip) => {
  const placeholders = [
    "firma_adi",
    "rapor_tarihi",
    "risk_sayfa_sayisi",
    "sgk_no",
    "tehlike_sinifi",
    "faaliyet_kapsami",
    "calisan_sayisi",
  ];
  const normalizePlaceholder = (xmlInput: string, placeholder: string) => {
    let xml = xmlInput;
    let searchFrom = 0;
    const placeholderText = `<w:t>${placeholder}</w:t>`;
    const normalizedPlaceholder = "{{" + placeholder + "}}";

    while (searchFrom < xml.length) {
      const placeholderIndex = xml.indexOf(placeholderText, searchFrom);
      if (placeholderIndex === -1) break;

      const openTextIndex = xml.lastIndexOf("<w:t>{{</w:t>", placeholderIndex);
      const closeTextIndex = xml.indexOf("<w:t>}}</w:t>", placeholderIndex);
      const runStart = openTextIndex >= 0 ? xml.lastIndexOf("<w:r", openTextIndex) : -1;
      const firstRunEnd = openTextIndex >= 0 ? xml.indexOf("</w:r>", openTextIndex) + "</w:r>".length : -1;
      const closeRunEnd = closeTextIndex >= 0 ? xml.indexOf("</w:r>", closeTextIndex) + "</w:r>".length : -1;

      if (openTextIndex === -1 || closeTextIndex === -1 || runStart === -1 || firstRunEnd < 0 || closeRunEnd < 0) {
        searchFrom = placeholderIndex + placeholderText.length;
        continue;
      }

      const firstRun = xml.slice(runStart, firstRunEnd);
      const replacement = firstRun.replace("<w:t>{{</w:t>", `<w:t>${normalizedPlaceholder}</w:t>`);
      xml = xml.slice(0, runStart) + replacement + xml.slice(closeRunEnd);
      searchFrom = runStart + replacement.length;
    }

    return xml;
  };

  Object.keys(zip.files)
    .filter((name) => name.startsWith("word/") && name.endsWith(".xml"))
    .forEach((name) => {
      const file = zip.file(name);
      if (!file) return;

      let xml = file.asText();
      placeholders.forEach((placeholder) => {
        xml = normalizePlaceholder(xml, placeholder);
      });

      zip.file(name, xml);
    });
};

const makeProcedureInsertedTextVisible = (zip: PizZip) => {
  ["word/document.xml", "word/footer2.xml"].forEach((name) => {
    const file = zip.file(name);
    if (!file) return;

    const xml = file.asText().replace(/w:color w:val="FFFFFF"/g, 'w:color w:val="000000"');
    zip.file(name, xml);
  });
};

export async function generateRiskProcedureTemplateDoc(payload: RiskProcedureTemplatePayload) {
  const response = await fetch(PROCEDURE_TEMPLATE_PATH);
  if (!response.ok) throw new Error("Şablon bulunamadı.");

  const templateBytes = await response.arrayBuffer();
  const zip = new PizZip(templateBytes);
  normalizeSplitPlaceholders(zip);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  try {
    doc.render(buildTemplateData(payload));
  } catch (error) {
    console.error("Risk procedure template render error", error);
    throw new Error("Rapor oluşturulamadı.");
  }

  const renderedZip = doc.getZip();
  makeProcedureInsertedTextVisible(renderedZip);

  const blob = renderedZip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const fileDate = new Date().toISOString().split("T")[0];
  saveAs(
    blob,
    `${sanitizeFileName(payload.companyInfo.companyTitle).toLocaleUpperCase("tr-TR")}_Risk_Degerlendirme_Sureci_${fileDate}.docx`,
  );
}
