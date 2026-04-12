import jsPDF from "jspdf";
import { addInterFontsToJsPDF } from "@/utils/fonts";

export type AssignmentType =
  | "risk_assessment_team"
  | "support_staff"
  | "employee_representative";

export type HazardClass = "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";

export interface AssignmentPDFData {
  assignmentType: AssignmentType;
  assignmentTitle: string;
  companyName: string;
  companyLogoUrl?: string;
  employeeName: string;
  employeeJobTitle: string;
  startDate: string;
  duration: number;
  weeklyHours: number;
  hazardClass: HazardClass;
  createdAt?: string;
  documentNumber?: string;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR");
}

function assignmentTypeLabel(type: AssignmentType) {
  if (type === "risk_assessment_team") return "Risk Değerlendirme Ekibi Atama Yazısı";
  if (type === "support_staff") return "Destek Elemanı Atama Yazısı";
  return "Çalışan Temsilcisi Atama Yazısı";
}

function buildAssignmentBody(data: AssignmentPDFData) {
  if (data.assignmentType === "risk_assessment_team") {
    return `${data.employeeName}, işyerinde yürütülecek risk değerlendirme çalışmalarında ekip üyesi olarak görevlendirilmiştir. Görev süresi boyunca tehlikelerin belirlenmesi, risklerin değerlendirilmesi ve gerekli önlemlerin planlanması süreçlerine aktif katkı sağlaması beklenir.`;
  }

  if (data.assignmentType === "support_staff") {
    return `${data.employeeName}, işyerinde acil durum, tahliye, yangınla mücadele ve benzeri destek faaliyetlerinde görev almak üzere destek elemanı olarak atanmıştır. Görev kapsamında ilgili planlara uygun hareket edilmesi ve zorunlu eğitimlere katılım sağlanması esastır.`;
  }

  return `${data.employeeName}, çalışan temsilcisi olarak atanmıştır. Görev süresi boyunca çalışanların iş sağlığı ve güvenliği ile ilgili görüş ve taleplerinin iletilmesi, iyileştirme süreçlerine katılım ve işveren ile iletişim süreçlerinde temsil görevinin yürütülmesi beklenir.`;
}

async function loadImageAsDataUrl(imageUrl: string) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:")) return imageUrl;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Logo okunamadı"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateAssignmentPDF(data: AssignmentPDFData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  doc.setDrawColor(28, 60, 110);
  doc.setLineWidth(0.8);
  doc.rect(12, 12, pageWidth - 24, 273);
  doc.setLineWidth(0.3);
  doc.rect(16, 16, pageWidth - 32, 265);

  doc.setFillColor(15, 23, 42);
  doc.rect(16, 16, pageWidth - 32, 24, "F");

  const logoDataUrl = data.companyLogoUrl ? await loadImageAsDataUrl(data.companyLogoUrl) : null;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", pageWidth - 52, 19, 22, 18);
    } catch {
      // Logo açılamazsa belge üretimini durdurma.
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("Inter", "bold");
  doc.setFontSize(18);
  doc.text("ATAMA YAZISI", pageWidth / 2, 31, { align: "center" });

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  doc.setFont("Inter", "normal");
  const intro =
    "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında aşağıda bilgileri verilen personel görevlendirilmiştir.";
  const introLines = doc.splitTextToSize(intro, contentWidth);
  doc.text(introLines, margin, 52);

  let y = 70;

  doc.setFont("Inter", "bold");
  doc.setFontSize(12);
  doc.text("Firma Bilgileri", margin, y);
  y += 7;

  doc.setFont("Inter", "normal");
  doc.setFontSize(10);
  doc.text(`Firma Adı: ${data.companyName}`, margin, y);
  y += 8;
  doc.text(`Belge No: ${data.documentNumber || "-"}`, margin, y);
  y += 12;

  doc.setFont("Inter", "bold");
  doc.setFontSize(12);
  doc.text("Personel Bilgileri", margin, y);
  y += 7;

  const detailRows = [
    ["Ad Soyad", data.employeeName],
    ["Görevi", data.employeeJobTitle || "-"],
    ["Atama Türü", data.assignmentTitle || assignmentTypeLabel(data.assignmentType)],
    ["Görev Başlangıç Tarihi", formatDate(data.startDate)],
    ["Görev Süresi", `${data.duration} ay`],
    ["Haftalık Çalışma Saati", `${data.weeklyHours} saat`],
    ["Tehlike Sınıfı", data.hazardClass],
    ["Belge Tarihi", formatDate(data.createdAt || new Date().toISOString())],
  ];

  const labelX = margin;
  const valueX = 74;
  detailRows.forEach(([label, value]) => {
    doc.setFont("Inter", "bold");
    doc.text(`${label}:`, labelX, y);
    doc.setFont("Inter", "normal");
    doc.text(String(value), valueX, y);
    y += 8;
  });

  y += 8;
  doc.setFont("Inter", "normal");
  doc.setFontSize(10);
  const bodyText = buildAssignmentBody(data);
  const bodyLines = doc.splitTextToSize(bodyText, contentWidth);
  doc.text(bodyLines, margin, y);

  const signatureTop = 230;
  const signatureBlocks = [
    { title: "İşveren", x: 28 },
    { title: "İSG Uzmanı", x: 82 },
    { title: "Görevlendirilen Personel", x: 138 },
  ];

  signatureBlocks.forEach((block) => {
    doc.setDrawColor(71, 85, 105);
    doc.line(block.x, signatureTop, block.x + 44, signatureTop);
    doc.setFont("Inter", "bold");
    doc.setFontSize(10);
    doc.text(block.title, block.x + 22, signatureTop + 7, { align: "center" });
    doc.setFont("Inter", "normal");
    doc.setFontSize(8);
    doc.text("İmza", block.x + 22, signatureTop + 12, { align: "center" });
  });

  doc.setFont("Inter", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("İSGVizyon İSG Yönetim Platformu", pageWidth / 2, 280, { align: "center" });

  const fileName = `Atama-Yazisi-${data.employeeName.replace(/\s+/g, "-")}.pdf`;
  doc.save(fileName);
}
