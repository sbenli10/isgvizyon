import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addInterFontsToJsPDF } from "./fonts";
import type { WorkPlanRow, TrainingPlanMeta, TrainingPlanRow, EvaluationRow } from "@/types/annualPlans";
import { MONTH_NAMES } from "@/types/annualPlans";

function addDocumentHeader(doc: jsPDF, title: string, companyName: string, subtitle: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("Inter", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(title, pageWidth / 2, 18, { align: "center" });

  doc.setFont("Inter", "normal");
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(companyName, pageWidth / 2, 26, { align: "center" });

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, pageWidth / 2, 31, { align: "center" });
}

export async function generateWorkPlanPDF(data: WorkPlanRow[], year: number, companyName: string): Promise<Blob> {
  const doc = new jsPDF("landscape", "mm", "a4");
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  addDocumentHeader(doc, `${year} YILI ÇALIŞMA PLANI`, companyName, "AnnualPlans • Yıllık çalışma planı şablonu");

  const headers = [
    { content: "Faaliyet", styles: { cellWidth: 60 } },
    { content: "Sorumlu", styles: { cellWidth: 40 } },
    ...MONTH_NAMES.map((month) => ({ content: month.substring(0, 3), styles: { cellWidth: 12 } })),
  ];

  const tableData = data.map((row) => {
    const monthCells = Object.values(row.months).map((status) => {
      if (status === "planned") {
        return { content: "P", styles: { fillColor: [253, 224, 71] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } };
      }
      if (status === "completed") {
        return { content: "✓", styles: { fillColor: [34, 197, 94] as [number, number, number], textColor: [255, 255, 255] as [number, number, number] } };
      }
      return { content: "-", styles: { fillColor: [241, 245, 249] as [number, number, number], textColor: [148, 163, 184] as [number, number, number] } };
    });

    return [row.activity_name, row.responsible, ...monthCells];
  });

  autoTable(doc, {
    startY: 36,
    head: [headers],
    body: tableData,
    theme: "grid",
    styles: { font: "Inter", fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [30, 41, 59] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "left" } },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setFont("Inter", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text("Lejant:", margin, finalY);
  doc.setFillColor(253, 224, 71);
  doc.rect(margin + 15, finalY - 3, 5, 4, "F");
  doc.text("Planlandı", margin + 22, finalY);
  doc.setFillColor(34, 197, 94);
  doc.rect(margin + 45, finalY - 3, 5, 4, "F");
  doc.text("Tamamlandı", margin + 52, finalY);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString("tr-TR")} | İSGVizyon İSG`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  return doc.output("blob");
}

export async function generateTrainingPlanPDF(
  data: TrainingPlanRow[],
  year: number,
  companyName: string,
  meta?: Partial<TrainingPlanMeta>
): Promise<Blob> {
  const doc = new jsPDF("portrait", "mm", "a4");
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  doc.setLineWidth(0.2);
  doc.rect(margin, 8, pageWidth - margin * 2, 281);
  doc.setFont("Inter", "bold");
  doc.setFontSize(15.5);
  doc.setTextColor(17, 24, 39);
  doc.text("İŞ SAĞLIĞI ve GÜVENLİĞİ YILLIK EĞİTİM PLANI", pageWidth / 2, 18, { align: "center" });
  doc.line(margin, 24, pageWidth - margin, 24);

  if (meta?.organizationLogoUrl) {
    try {
      const response = await fetch(meta.organizationLogoUrl);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const mimeType = response.headers.get("content-type") || "image/png";
      const base64 = btoa(bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), ""));
      doc.addImage(`data:${mimeType};base64,${base64}`, mimeType.includes("jpeg") ? "JPEG" : "PNG", pageWidth - 28, 10, 16, 10);
    } catch {
      doc.setFontSize(9);
      doc.text(companyName, pageWidth - 18, 16, { align: "center" });
    }
  } else {
    doc.setFontSize(9);
    doc.text(companyName, pageWidth - 18, 16, { align: "center" });
  }

  doc.setFontSize(14);
  doc.text(`${year} YILI EĞİTİM PLANI`, pageWidth / 2, 31, { align: "center" });

  autoTable(doc, {
    startY: 36,
    body: [
      [
        { content: "İş Yeri Unvanı:", styles: { fontStyle: "bold" } },
        meta?.workplaceTitle || companyName || "-",
        { content: "İş Yeri Adresi:", styles: { fontStyle: "bold" } },
        meta?.workplaceAddress || "-",
      ],
      [
        { content: "İş Yeri Sicil No:", styles: { fontStyle: "bold" } },
        meta?.workplaceRegistrationNo || "-",
        "",
        "",
      ],
    ],
    theme: "grid",
    styles: { font: "Inter", fontSize: 9, cellPadding: 6, lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 55 },
      2: { cellWidth: 35 },
      3: { cellWidth: 52 },
    },
  });

  const tableData = data.map((row, idx) => [
    (idx + 1).toString(),
    row.topic,
    row.provider,
    row.planned_date || "-",
    row.actual_date || "",
    row.notes || "",
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY,
    head: [["Sıra No", "EĞİTİM KONUSU", "Eğitimi Verecek Kişi/Kuruluş", "Planlanan Tarih", "Gerçekleşen Tarih", "AÇIKLAMALAR"]],
    body: tableData,
    theme: "grid",
    styles: { font: "Inter", fontSize: 8.1, cellPadding: 3, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: [30, 64, 175] as [number, number, number],
      fontStyle: "bold",
      lineColor: [0, 0, 0] as [number, number, number],
      lineWidth: 0.2,
    },
    bodyStyles: {
      lineColor: [0, 0, 0] as [number, number, number],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 56 },
      2: { cellWidth: 35 },
      3: { cellWidth: 23, halign: "center" },
      4: { cellWidth: 23, halign: "center" },
      5: { cellWidth: 36 },
    },
  });

  const notesY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(7.5);
  doc.setTextColor(17, 24, 39);
  const noteLines = [
    "*EĞİTİMLERİN SÜRESİ : Az tehlikeli işyerleri için en az 8 saat, tehlikeli işyerleri için en az 12 saat, çok tehlikeli işyerleri için en az 16 saat olarak her çalışan için düzenlenecektir.",
    "*EĞİTİMLERİN TEKRARI : Çok tehlikeli sınıfta yer alan işyerlerinde yılda en az 1 defa, tehlikeli sınıfta yer alan işyerlerinde 2 yılda en az 1 defa, az tehlikeli sınıfta yer alan işyerlerinde 3 yılda en az 1 defa yinelenir.",
    "*HİJYEN EĞİTİMİ ALINACAK İŞYERLERİ : Gıda üretimi ve perakende iş yerleri, insan tüketimi amaçlı sular ile doğal mineralli suların üretimini yapan iş yerleri ve benzeri alanlar.",
    "*EĞİTİMLERİN AMACI : Çalışanlarda iş sağlığı ve güvenliğine yönelik davranış değişikliği sağlamayı ve eğitimlerde aktarılan bilgilerin öneminin çalışanlarca kavranmasını sağlamaktır.",
    "*İlk Yardım Eğitimi Alması Gereken Personel Sayısı : Tehlike sınıfına göre yönetmelikte belirtilen asgari sayıda personel ilk yardımcı olarak planlanmalıdır.",
  ];
  noteLines.forEach((line, index) => {
    const lines = doc.splitTextToSize(line, pageWidth - 24);
    doc.text(lines, 12, notesY + index * 8);
  });

  const signY = notesY + noteLines.length * 8 + 10;
  autoTable(doc, {
    startY: signY,
    body: [[meta?.specialistName || "-", meta?.doctorName || "-", meta?.employerRepresentativeName || "-"]],
    head: [["İş Güvenliği Uzmanı", "İşyeri Hekimi", "İşveren / İ.Vekili"]],
    theme: "grid",
    styles: { font: "Inter", fontSize: 9, cellPadding: 10, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: [17, 24, 39] as [number, number, number],
      fontStyle: "bold",
      lineColor: [0, 0, 0] as [number, number, number],
      lineWidth: 0.2,
    },
    bodyStyles: {
      lineColor: [0, 0, 0] as [number, number, number],
      lineWidth: 0.2,
      minCellHeight: 22,
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Sayfa 1`, pageWidth / 2, 194, { align: "center", angle: 0 });

  return doc.output("blob");
}

export async function generateEvaluationReportPDF(data: EvaluationRow[], year: number, companyName: string): Promise<Blob> {
  const doc = new jsPDF("portrait", "mm", "a4");
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  addDocumentHeader(doc, `${year} YILI DEĞERLENDİRME RAPORU`, companyName, "AnnualPlans • Yıllık değerlendirme raporu şablonu");

  const tableData = data.map((row, idx) => [
    (idx + 1).toString(),
    row.activity,
    row.planned_date,
    row.actual_date || "-",
    row.status === "completed" ? "✓" : row.status === "pending" ? "Beklemede" : "İptal",
    row.result_comment,
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["#", "Faaliyet", "Planlanan", "Gerçekleşen", "Durum", "Sonuç ve Yorum"]],
    body: tableData,
    theme: "grid",
    styles: { font: "Inter", fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [30, 41, 59] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 50 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 25, halign: "center" },
      5: { cellWidth: 35 },
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.text(`Sayfa ${i}/${totalPages} | İSGVizyon İSG © ${new Date().getFullYear()}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  }

  return doc.output("blob");
}
