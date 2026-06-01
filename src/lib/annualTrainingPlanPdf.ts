import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";

import type {
  AnnualTrainingPlanDocumentData,
  AnnualTrainingPlanItem,
} from "@/lib/annualTrainingPlanOfficialDocx";
import { addInterFontsToJsPDF } from "@/utils/fonts";

const COLORS = {
  title: [15, 23, 42] as const,
  text: [20, 25, 35] as const,
  muted: [100, 116, 139] as const,
  border: [20, 25, 35] as const,
  soft: [248, 250, 252] as const,
  blue: [0, 0, 128] as const,
  white: [255, 255, 255] as const,
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const safeText = (value?: string | null) => {
  const text = String(value || "").trim();
  return text || "";
};

const buildBody = (items: AnnualTrainingPlanItem[]) =>
  items.map((item, index) => [
    String(index + 1),
    safeText(item.egitimKonusu),
    safeText(item.egitimiVerecekKisiKurulus),
    safeText(item.planlananTarih),
    safeText(item.gerceklesenTarih),
    safeText(item.aciklamalar),
  ]);

const drawHeader = (doc: jsPDF, payload: AnnualTrainingPlanDocumentData, fontName: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.rect(10, 10, pageWidth - 20, 12);
  doc.rect(10, 22, pageWidth - 20, 9);

  doc.setFont(fontName, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.title);
  doc.text("İŞ SAĞLIĞI ve GÜVENLİĞİ YILLIK EĞİTİM PLANI", pageWidth / 2, 18, { align: "center" });
  doc.setFontSize(9);
  doc.text(`${payload.year} YILI EĞİTİM PLANI`, pageWidth / 2, 28, { align: "center" });

  doc.rect(10, 31, 58, 28);
  doc.rect(68, 31, 38, 28);
  doc.rect(106, 31, 15, 28);
  doc.rect(121, 31, pageWidth - 131, 28);

  doc.setFontSize(6.8);
  doc.setFont(fontName, "bold");
  doc.text("İş Yeri Unvanı:", 39, 39, { align: "center" });
  doc.text("İş Yeri Sicil No:", 39, 53, { align: "center" });
  doc.text("İş Yeri Adresi:", 165, 39, { align: "center" });

  doc.setFont(fontName, "normal");
  doc.setFontSize(6.6);
  doc.text(doc.splitTextToSize(payload.form.isYeriUnvani || "-", 33), 87, 39, { align: "center" });
  doc.text(doc.splitTextToSize(payload.form.isYeriSicilNo || "-", 33), 87, 53, { align: "center" });
  doc.text(doc.splitTextToSize(payload.form.isYeriAdresi || "-", 76), 165, 45, { align: "center" });
};

const addNotesAndSignatures = (
  doc: jsPDF,
  payload: AnnualTrainingPlanDocumentData,
  fontName: string,
  startY: number,
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = Math.min(startY + 5, pageHeight - 58);

  const notes = [
    "*EĞİTİMLERİN SÜRESİ: Az tehlikeli işyerleri için en az 8 saat, tehlikeli işyerleri için en az 12 saat, çok tehlikeli işyerleri için en az 16 saat olarak her çalışan için düzenlenecektir.",
    "*EĞİTİMLERİN TEKRARI: Çok tehlikeli sınıfta yer alan işyerlerinde yılda en az 1 defa, tehlikeli sınıfta yer alan işyerlerinde 2 yılda en az 1 defa, az tehlikeli sınıfta yer alan işyerlerinde 3 yılda en az 1 defa yapılır.",
    "*HİJYEN EĞİTİMİ ALINACAK İŞYERLERİ: Gıda üretim ve perakende iş yerleri, insani tüketim amaçlı sular ile doğal mineralli suların üretimini yapan iş yerleri, kaplıca, hamam, sauna, berber, kuaför ve güzellik salonları gibi iş kolları.",
    "*EĞİTİMLERİN AMACI: Çalışanlarda iş sağlığı ve güvenliğine yönelik davranış değişikliği sağlamayı ve eğitimlerde aktarılan bilgilerin öneminin çalışanlarca kavranmasını sağlamaktır.",
    "*İLK YARDIM EĞİTİMİ ALINACAK İŞYERLERİ: İlkyardım Yönetmeliği'ne göre çok tehlikeli sınıfta her 10 kişiden, tehlikeli sınıfta her 15 kişiden, az tehlikeli sınıfta her 20 kişiden bir kişi ilkyardım eğitimi almış olmalıdır.",
  ];

  doc.setFont(fontName, "bold");
  doc.setFontSize(5);
  doc.setTextColor(...COLORS.text);
  notes.forEach((note) => {
    const lines = doc.splitTextToSize(note, pageWidth - 20);
    doc.text(lines, 10, y);
    y += lines.length * 2.45 + 0.4;
  });

  const signatureY = pageHeight - 34;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.rect(10, signatureY, 55, 22);
  doc.rect(65, signatureY, 70, 22);
  doc.rect(135, signatureY, pageWidth - 145, 22);

  doc.setFont(fontName, "bold");
  doc.setFontSize(5.8);
  doc.text("İş Güvenliği Uzmanı", 37.5, signatureY + 6, { align: "center" });
  doc.text("İşyeri Hekimi", 100, signatureY + 6, { align: "center" });
  doc.text("İşveren / İ.Vekili", 172.5, signatureY + 6, { align: "center" });

  doc.setFont(fontName, "normal");
  doc.setFontSize(5.6);
  doc.text(doc.splitTextToSize(payload.form.isGuvenligiUzmani || "", 48), 37.5, signatureY + 14, { align: "center" });
  doc.text(doc.splitTextToSize(payload.form.isyeriHekimi || "", 63), 100, signatureY + 14, { align: "center" });
  doc.text(doc.splitTextToSize(payload.form.isverenVekili || "", 63), 172.5, signatureY + 14, { align: "center" });
};

export const downloadAnnualTrainingPlanPdf = async (payload: AnnualTrainingPlanDocumentData) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const interLoaded = addInterFontsToJsPDF(doc);
  const fontName = interLoaded ? "Inter" : "helvetica";
  doc.setFont(fontName, "normal");
  doc.setTextColor(...COLORS.text);

  drawHeader(doc, payload, fontName);

  autoTable(doc, {
    startY: 61,
    theme: "grid",
    head: [[
      "Sıra\nNo",
      "EĞİTİM KONUSU",
      "Eğitimi Verecek\nKişi/Kuruluş",
      "Planlanan\nTarih",
      "Gerçekleşen\nTarih",
      "AÇIKLAMALAR",
    ]],
    body: buildBody(payload.items),
    styles: {
      font: fontName,
      fontSize: 5.25,
      cellPadding: 0.65,
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 6,
    },
    headStyles: {
      fillColor: COLORS.white,
      textColor: COLORS.blue,
      fontStyle: "bold",
      fontSize: 5.6,
      halign: "center",
      valign: "middle",
      lineColor: COLORS.border,
    },
    bodyStyles: {
      fillColor: COLORS.white,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 58 },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 54 },
    },
    margin: { left: 10, right: 10, bottom: 46 },
    rowPageBreak: "avoid",
    didParseCell: (hookData: CellHookData) => {
      if (hookData.section !== "body") return;
      if (hookData.column.index === 1) {
        hookData.cell.styles.fontStyle = "bold";
      }
      if ([2, 3].includes(hookData.column.index)) {
        hookData.cell.styles.halign = "center";
      }
    },
    didDrawPage: () => {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const page = doc.getCurrentPageInfo().pageNumber;
      const total = doc.getNumberOfPages();

      doc.setDrawColor(203, 213, 225);
      doc.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);
      doc.setFont(fontName, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.muted);
      doc.text(`Firma: ${payload.form.isYeriUnvani || "-"}`, 10, pageHeight - 5);
      doc.text(`Sayfa ${page} / ${total}`, pageWidth - 10, pageHeight - 5, { align: "right" });
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 61;
  addNotesAndSignatures(doc, payload, fontName, finalY);

  const fileName = sanitizeFileName(`ISG-Yillik-Egitim-Plani-${payload.form.isYeriUnvani || "Firma"}-${payload.year}`);
  doc.save(`${fileName}.pdf`);
};
