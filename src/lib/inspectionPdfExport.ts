import jsPDF from "jspdf";

interface InspectionData {
  id: string;
  site_name: string;
  inspector_name: string;
  inspection_date: string;
  status: string;
  risk_level: string;
  score?: number;
  observations?: string;
  photo_url?: string;
}

async function loadImageAsDataURL(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error loading image:", error);
    return "";
  }
}

export async function generateInspectionsPDF(inspections: InspectionData[]) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString("tr-TR");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("İSGVizyon Güvenlik Sistemi", 20, 20);

  doc.setFontSize(14);
  doc.text("Denetim Raporu", 20, 30);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Rapor Tarihi: ${now}  |  Toplam Denetim: ${inspections.length}`, 20, 40);

  doc.setDrawColor(100);
  doc.line(20, 44, 190, 44);

  let y = 52;

  for (let i = 0; i < inspections.length; i++) {
    const inspection = inspections[i];

    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${inspection.site_name}`, 20, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Denetim No: ${inspection.id}  |  Denetçi: ${inspection.inspector_name}`, 24, y);
    y += 5;

    const date = new Date(inspection.inspection_date).toLocaleDateString("tr-TR");
    const riskText = inspection.risk_level === "low" ? "Düşük" :
                     inspection.risk_level === "medium" ? "Orta" :
                     inspection.risk_level === "high" ? "Yüksek" : "Kritik";
    const statusText = inspection.status === "completed" ? "Tamamlandı" :
                       inspection.status === "in-progress" ? "Devam Ediyor" :
                       inspection.status === "overdue" ? "Gecikmiş" : "Planlandı";

    doc.text(`Tarih: ${date}  |  Risk: ${riskText}  |  Durum: ${statusText}`, 24, y);
    y += 5;

    if (inspection.score !== undefined) {
      doc.text(`Puan: ${inspection.score}/100`, 24, y);
      y += 5;
    }

    if (inspection.observations) {
      const obsLines = doc.splitTextToSize(`Gözlemler: ${inspection.observations}`, 166);
      doc.text(obsLines, 24, y);
      y += obsLines.length * 4 + 3;
    }

    if (inspection.photo_url) {
      try {
        const imageData = await loadImageAsDataURL(inspection.photo_url);
        if (imageData) {
          if (y + 60 > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }

          const imgWidth = 80;
          const imgHeight = 60;
          doc.addImage(imageData, "JPEG", 24, y, imgWidth, imgHeight);
          y += imgHeight + 5;
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text("Saha Fotoğrafı", 24, y);
          doc.setTextColor(0);
          doc.setFontSize(9);
          y += 3;
        }
      } catch (error) {
        console.error("Failed to add image to PDF:", error);
      }
    }

    y += 8;
  }

  doc.save(`denetimler-raporu-${Date.now()}.pdf`);
}
