import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface LegendItem {
  id: string;
  name: string;
  emoji: string;
  count: number;
}

export class ExportService {
  static exportPNG(canvas: any, fileName: string) {
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 } as any);
    ExportService.downloadFile(dataUrl, `${fileName}.png`);
  }

  static exportSVG(canvas: any, fileName: string) {
    const svg = canvas.toSVG();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    ExportService.downloadFile(url, `${fileName}.svg`, true);
  }

  static async exportPDF(params: {
    canvas: any;
    fileName: string;
    projectName: string;
    legendItems: LegendItem[];
    legendElement?: HTMLElement | null;
    dateLabel: string;
  }) {
    const { canvas, fileName, projectName, legendItems, legendElement, dateLabel } = params;
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageWidth, 64, "F");

    pdf.setTextColor(248, 250, 252);
    pdf.setFontSize(16);
    pdf.text(projectName || "Acil Durum Kroki", 24, 36);

    pdf.setFontSize(10);
    pdf.text(`Tarih: ${dateLabel}`, pageWidth - 160, 36);

    const canvasImage = canvas.toDataURL({ format: "png", multiplier: 2 } as any);
    pdf.addImage(canvasImage, "PNG", 24, 84, pageWidth - 48, pageHeight - 220, undefined, "FAST");

    let legendY = pageHeight - 110;
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(11);
    pdf.text("Lejant", 24, legendY);
    legendY += 16;

    if (legendElement) {
      const captured = await html2canvas(legendElement, { backgroundColor: "#ffffff", scale: 2 });
      const legendImage = captured.toDataURL("image/png");
      pdf.addImage(legendImage, "PNG", 24, legendY, Math.min(320, pageWidth - 48), 72, undefined, "FAST");
    } else {
      legendItems.forEach((item, idx) => {
        pdf.text(`${item.emoji} ${item.name} x ${item.count}`, 24, legendY + idx * 14);
      });
    }

    pdf.save(`${fileName}.pdf`);
  }

  private static downloadFile(url: string, name: string, revoke = false) {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (revoke) {
      URL.revokeObjectURL(url);
    }
  }
}