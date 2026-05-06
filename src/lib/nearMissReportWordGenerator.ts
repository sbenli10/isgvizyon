import { saveAs } from "file-saver";

export interface NearMissReportData {
  reportDate: string;
  reportTime: string;
  reporterName: string;
  reporterUnitRole: string;
  isExperiencedByReporter: boolean;
  isWitnessedByReporter: boolean;
  incidentDescription: string;
  incidentLocation: string;
  preventionSuggestion: string;
  safetyOfficerName: string;
  plannedActions: string;
  signerName: string;
}

const safeText = (value?: string | null, fallback = "") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR");
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .trim();

const lineText = (label: string, value: string, totalLength = 64) => {
  const suffix = value.trim();
  const dots = ".".repeat(Math.max(6, totalLength - label.length - suffix.length));
  return `${label}${dots}${suffix}`;
};

export async function generateNearMissReportWord(data: NearMissReportData) {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } = await import("docx");

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 520, bottom: 720, left: 520 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: "OLAY BİLDİRİM FORMU", bold: true, underline: {}, size: 30 })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
            children: [new TextRun({ text: `Tarih: ${formatDate(data.reportDate)}`, size: 24 })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 720 },
            children: [new TextRun({ text: `Saat: ${safeText(data.reportTime)}`, size: 24 })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: lineText("Bildirimi Yapan Kişi:", safeText(data.reporterName), 72), size: 24 })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: lineText("Birimi - Görevi:", safeText(data.reporterUnitRole), 72), size: 24 })],
          }),
          new Paragraph({
            spacing: { after: 360 },
            children: [
              new TextRun({ text: `${data.isExperiencedByReporter ? "☑" : "☐"} Olayı Yaşayan`, size: 24 }),
              new TextRun({ text: "          ", size: 24 }),
              new TextRun({ text: `${data.isWitnessedByReporter ? "☑" : "☐"} Tanıklık Eden`, size: 24 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: "Olayı Tanımlayınız:", bold: true, underline: {}, size: 26 })],
          }),
          new Paragraph({
            spacing: { after: 800 },
            children: [new TextRun({ text: safeText(data.incidentDescription), size: 24 })],
          }),
          new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: lineText("Olay Yerini Belirtiniz:", safeText(data.incidentLocation), 110), size: 24 })],
          }),
          new Paragraph({
            spacing: { after: 720 },
            children: [new TextRun({ text: lineText("Olayın Tekrarlanmaması İçin Çözüm Öneriniz (varsa):", safeText(data.preventionSuggestion), 120), size: 24 })],
          }),
          new Paragraph({
            spacing: { before: 360, after: 120 },
            children: [new TextRun({ text: "Bu Bölüm İş Güvenliği Sorumlusu Tarafından Doldurulacaktır.", size: 24 })],
          }),
          new Paragraph({
            spacing: { after: 720 },
            children: [new TextRun({ text: lineText("İş Güvenliği Sorumlusu:", safeText(data.safetyOfficerName), 48), size: 24, underline: {} })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: "Yapılacak Faaliyetler:", bold: true, underline: {}, size: 26 })],
          }),
          new Paragraph({
            spacing: { after: 1200 },
            children: [new TextRun({ text: safeText(data.plannedActions), size: 24 })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
            children: [new TextRun({ text: `Adı/Soyadı: ${safeText(data.signerName)}`, size: 24 })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "İmza:", size: 24 })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFileName(`Ramak-Kala-Olay-Bildirim-Formu-${data.reporterName || "Form"}`)}.docx`);
}
