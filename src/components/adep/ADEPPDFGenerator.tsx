import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import {
  buildADEPDocumentViewModel,
  fetchADEPDocumentBundle,
  formatDateOrDash,
} from "@/lib/adepDocumentBundle";

type PdfColor = [number, number, number];

const colors: Record<
  "primary" | "slate" | "muted" | "border" | "soft" | "accent" | "white",
  PdfColor
> = {
  primary: [15, 23, 42],
  slate: [51, 65, 85],
  muted: [100, 116, 139],
  border: [203, 213, 225],
  soft: [241, 245, 249],
  accent: [37, 99, 235],
  white: [255, 255, 255],
};

const setupFont = (doc: jsPDF) => {
  const loaded = addInterFontsToJsPDF(doc);
  doc.setFont(loaded ? "Inter" : "helvetica", "normal");
  return loaded;
};

const setFontStyle = (doc: jsPDF, interLoaded: boolean, weight: "normal" | "bold") => {
  doc.setFont(interLoaded ? "Inter" : "helvetica", weight);
};

const addSectionHeading = (doc: jsPDF, y: number, title: string, interLoaded: boolean) => {
  doc.setFillColor(...colors.soft);
  doc.roundedRect(15, y, doc.internal.pageSize.getWidth() - 30, 10, 2, 2, "F");
  doc.setTextColor(...colors.primary);
  doc.setFontSize(13);
  setFontStyle(doc, interLoaded, "bold");
  doc.text(title, 20, y + 6.8);
  return y + 14;
};

const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number, companyName: string) => {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...colors.border);
  doc.line(15, height - 14, width - 15, height - 14);
  doc.setFontSize(8);
  doc.setTextColor(...colors.muted);
  doc.text(`İSGVizyon • ${companyName}`, 15, height - 8.5);
  doc.text(`Sayfa ${pageNumber} / ${totalPages}`, width - 15, height - 8.5, { align: "right" });
};

const addWrappedText = (
  doc: jsPDF,
  text: string,
  startY: number,
  options?: {
    fontSize?: number;
    color?: PdfColor;
    maxWidth?: number;
    interLoaded?: boolean;
  },
) => {
  const maxWidth = options?.maxWidth || doc.internal.pageSize.getWidth() - 30;
  const fontSize = options?.fontSize || 10;
  const color = options?.color || colors.slate;
  setFontStyle(doc, options?.interLoaded ?? true, "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, 15, startY);
  return startY + lines.length * (fontSize * 0.45 + 1.5);
};

const getLastAutoTableY = (doc: jsPDF) => {
  const tableDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  return tableDoc.lastAutoTable?.finalY || 18;
};

export const generateADEPPDF = async (planId: string) => {
  try {
    const bundle = await fetchADEPDocumentBundle(planId);
    const model = buildADEPDocumentViewModel(bundle);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const interLoaded = setupFont(doc);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 70, "F");
    doc.setFillColor(...colors.accent);
    doc.rect(0, 70, pageWidth, 18, "F");

    setFontStyle(doc, interLoaded, "bold");
    doc.setFontSize(26);
    doc.setTextColor(...colors.white);
    doc.text(model.cover.title, pageWidth / 2, 34, { align: "center" });
    doc.setFontSize(20);
    doc.text(model.cover.subtitle, pageWidth / 2, 46, { align: "center" });
    doc.setFontSize(18);
    doc.text(model.cover.companyName, pageWidth / 2, 80, { align: "center" });

    doc.setTextColor(...colors.slate);
    setFontStyle(doc, interLoaded, "normal");
    doc.setFontSize(11);
    doc.text(`Hazırlama Tarihi: ${model.cover.preparedDate}`, pageWidth / 2, 102, { align: "center" });
    doc.text(
      `Geçerlilik: ${formatDateOrDash(bundle.plan.plan_data.genel_bilgiler.gecerlilik_tarihi)}`,
      pageWidth / 2,
      109,
      { align: "center" },
    );

    autoTable(doc, {
      startY: 122,
      theme: "grid",
      head: [["Belge Özeti", "Değer"]],
      body: model.companySummaryRows.map((row) => [row.label, row.value]),
      styles: {
        font: "Inter",
        fontSize: 9,
        textColor: colors.slate,
        lineColor: colors.border,
        lineWidth: 0.35,
      },
      headStyles: {
        fillColor: colors.primary,
        textColor: colors.white,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 48, fillColor: colors.soft, fontStyle: "bold" },
        1: { cellWidth: pageWidth - 78 },
      },
      margin: { left: 15, right: 15 },
    });

    doc.addPage();
    let y = 18;

    y = addSectionHeading(doc, y, "OSGB Bilgileri", interLoaded);
    autoTable(doc, {
      startY: y,
      theme: "grid",
      body: model.osgbRows.map((row) => [row.label, row.value]),
      styles: {
        font: "Inter",
        fontSize: 9,
        textColor: colors.slate,
        lineColor: colors.border,
        lineWidth: 0.35,
      },
      columnStyles: {
        0: { cellWidth: 48, fillColor: colors.soft, fontStyle: "bold" },
        1: { cellWidth: pageWidth - 78 },
      },
      margin: { left: 15, right: 15 },
    });

    y = getLastAutoTableY(doc) + 10;
    y = addSectionHeading(doc, y, "İşyeri ve Görevli Bilgileri", interLoaded);
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Görev / Ünvan", "Adı Soyadı", "Sorumluluk / İletişim"]],
      body: model.personnelRows.map((row) => [
        row.role,
        row.name,
        [row.duty, row.phone, row.meta].filter(Boolean).join(" • ") || "-",
      ]),
      styles: {
        font: "Inter",
        fontSize: 8.5,
        textColor: colors.slate,
        lineColor: colors.border,
        lineWidth: 0.35,
      },
      headStyles: {
        fillColor: colors.primary,
        textColor: colors.white,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 48, fillColor: colors.soft, fontStyle: "bold" },
        1: { cellWidth: 48 },
        2: { cellWidth: pageWidth - 126 },
      },
      margin: { left: 15, right: 15 },
    });

    doc.addPage();
    y = 18;
    y = addSectionHeading(doc, y, "Genel Hükümler", interLoaded);
    y = addWrappedText(doc, `1.1 Amaç\n${model.legislation.amac}`, y + 2, { interLoaded });
    y = addWrappedText(doc, `\n1.2 Kapsam\n${model.legislation.kapsam}`, y + 2, { interLoaded });
    y = addWrappedText(doc, `\n1.3 Tanımlar\n${model.legislation.tanimlar}`, y + 2, { interLoaded });
    y = addWrappedText(doc, `\n1.4 Yasal Dayanak\n${model.legislation.dayanak}`, y + 2, { interLoaded });

    y += 6;
    y = addSectionHeading(doc, y, "Muhtemel Acil Durumlar ve Müdahale Özeti", interLoaded);
    if (model.scenarioRows.length) {
      autoTable(doc, {
        startY: y,
        theme: "grid",
        head: [["Senaryo", "Özet Müdahale Akışı"]],
        body: model.scenarioRows.map((row) => [row.title, row.summary]),
        styles: {
          font: "Inter",
          fontSize: 8.5,
          textColor: colors.slate,
          lineColor: colors.border,
          lineWidth: 0.35,
          cellPadding: 2.4,
        },
        headStyles: {
          fillColor: colors.primary,
          textColor: colors.white,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 42, fillColor: colors.soft, fontStyle: "bold" },
          1: { cellWidth: pageWidth - 72 },
        },
        margin: { left: 15, right: 15 },
      });
      y = getLastAutoTableY(doc) + 8;
    } else {
      y = addWrappedText(doc, "Henüz senaryo tanımlanmadı.", y + 2, { interLoaded });
    }

    y = addSectionHeading(doc, y, "Toplanma Yeri", interLoaded);
    y = addWrappedText(doc, model.meetingPoint, y + 2, { interLoaded });

    doc.addPage();
    y = 18;
    y = addSectionHeading(doc, y, "Acil Durum Telefon Numaraları", interLoaded);
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Kurum", "Telefon"]],
      body: model.contactRows.length
        ? model.contactRows.map((row) => [row.institution, row.phone])
        : [["-", "Henüz iletişim bilgisi girilmedi"]],
      styles: {
        font: "Inter",
        fontSize: 9,
        textColor: colors.slate,
        lineColor: colors.border,
        lineWidth: 0.35,
      },
      headStyles: {
        fillColor: colors.primary,
        textColor: colors.white,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 90, fillColor: colors.soft, fontStyle: "bold" },
        1: { cellWidth: pageWidth - 120 },
      },
      margin: { left: 15, right: 15 },
    });

    y = getLastAutoTableY(doc) + 10;
    y = addSectionHeading(doc, y, "Acil Durum Ekipleri", interLoaded);
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Ekip", "Ekip Lideri", "Üye Sayısı"]],
      body: model.emergencyTeamRows.length
        ? model.emergencyTeamRows.map((row) => [row.team, row.leader, row.memberCount])
        : [["-", "Henüz ekip tanımlanmadı", "-"]],
      styles: {
        font: "Inter",
        fontSize: 9,
        textColor: colors.slate,
        lineColor: colors.border,
        lineWidth: 0.35,
      },
      headStyles: {
        fillColor: colors.primary,
        textColor: colors.white,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 60, fillColor: colors.soft, fontStyle: "bold" },
        1: { cellWidth: 70 },
        2: { cellWidth: pageWidth - 160 },
      },
      margin: { left: 15, right: 15 },
    });

    y = getLastAutoTableY(doc) + 10;
    y = addSectionHeading(doc, y, "Ekler", interLoaded);
    y = addWrappedText(doc, model.appendixRows.map((item) => `• ${item}`).join("\n"), y + 2, { interLoaded });
    if (model.notes.length) {
      y = addSectionHeading(doc, y + 4, "Ek Açıklamalar", interLoaded);
      addWrappedText(doc, model.notes.map((item) => `• ${item}`).join("\n"), y + 2, { interLoaded });
    }

    if (model.selectedSketch?.thumbnail_data_url) {
      doc.addPage();
      y = 18;
      y = addSectionHeading(doc, y, "Ek-9 Kroki", interLoaded);
      y = addWrappedText(
        doc,
        [
          model.selectedSketch.project_name
            ? `Seçili kroki: ${model.selectedSketch.project_name}`
            : "Sistemde oluşturulan kroki",
          model.selectedSketch.created_at
            ? `Kayıt tarihi: ${formatDateOrDash(model.selectedSketch.created_at)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        y + 2,
        { interLoaded },
      );

      try {
        const imageProps = doc.getImageProperties(model.selectedSketch.thumbnail_data_url);
        const maxWidth = pageWidth - 30;
        const maxHeight = pageHeight - y - 25;
        const ratio = Math.min(maxWidth / imageProps.width, maxHeight / imageProps.height);
        const drawWidth = imageProps.width * ratio;
        const drawHeight = imageProps.height * ratio;
        const drawX = (pageWidth - drawWidth) / 2;

        doc.addImage(
          model.selectedSketch.thumbnail_data_url,
          "PNG",
          drawX,
          y + 4,
          drawWidth,
          drawHeight,
          undefined,
          "FAST",
        );
      } catch (imageError) {
        console.error("ADEP kroki görseli PDF'e eklenemedi:", imageError);
        addWrappedText(
          doc,
          "Seçilen kroki önizlemesi PDF çıktısına eklenemedi. Kroki bilgisi plan notlarında korunmuştur.",
          y + 12,
          { interLoaded, color: colors.muted },
        );
      }
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      addFooter(doc, page, totalPages, model.cover.companyName);
    }

    const fileName = `ADEP_${model.cover.companyName.replace(/[^\w-]+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
    toast.success("PDF başarıyla indirildi");
    return doc;
  } catch (error: unknown) {
    console.error("ADEP PDF generation error:", error);
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    toast.error("PDF oluşturma hatası", {
      description: message,
    });
    throw error;
  }
};
