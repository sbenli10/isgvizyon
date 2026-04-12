// src/utils/boardMeetingPdfGenerator.ts

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface MeetingData {
  meeting_number: string;
  meeting_date: string;
  meeting_time: string;
  location: string;
  president_name: string;
  secretary_name: string;
  status: string;
  company_name: string;
  company_industry: string;
  attendees: Array<{
    name: string;
    role: string;
    attendance_status: string;
  }>;
  agenda: Array<{
    agenda_number: number;
    topic: string;
    discussion: string;
    decision: string;
    responsible_person: string;
    deadline: string;
  }>;
  decisions: Array<{
    decision_number: number;
    description: string;
    responsible: string;
    deadline: string;
  }>;
}

// Türkçe karakterleri ASCII'ye çevir
const turkishToAscii = (text: string): string => {
  const charMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'C',
    'ğ': 'g', 'Ğ': 'G',
    'ı': 'i', 'İ': 'I',
    'ö': 'o', 'Ö': 'O',
    'ş': 's', 'Ş': 'S',
    'ü': 'u', 'Ü': 'U',
  };
  
  return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, (match) => charMap[match] || match);
};

export const generateBoardMeetingPDF = (data: MeetingData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Helvetica (jsPDF built-in)
  doc.setFont("helvetica");

  let yPos = 15;

  // ============================================
  // HEADER - LOGO ALANI VE BAŞLIK
  // ============================================
  
  // Üst bant (gradient efekti için)
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(0, 0, 210, 45, 'F');
  
  // Başlık
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("ISG KURUL TOPLANTISI TUTANAGI", 105, 20, { align: "center" });
  
  // Alt başlık
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("6331 Sayili Is Sagligi ve Guvenligi Kanunu Uyarinca", 105, 28, { align: "center" });
  
  // Toplantı numarası badge
  doc.setFillColor(59, 130, 246); // blue-500
  doc.roundedRect(75, 33, 60, 8, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(turkishToAscii(data.meeting_number), 105, 38, { align: "center" });
  
  yPos = 50;

  // ============================================
  // TOPLANTI BİLGİLERİ KARTI
  // ============================================
  
  // Kart background
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(15, yPos, 180, 65, 3, 3, 'FD');
  
  yPos += 8;
  
  // Başlık
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.setFont("helvetica", "bold");
  doc.text("TOPLANTI BILGILERI", 20, yPos);
  
  yPos += 8;
  
  // Bilgi satırları
  const info = [
    { label: "Firma", value: turkishToAscii(data.company_name) },
    { label: "Sektor", value: turkishToAscii(data.company_industry || "-") },
    { label: "Tarih", value: new Date(data.meeting_date).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }) },
    { label: "Saat", value: data.meeting_time },
    { label: "Yer", value: turkishToAscii(data.location || "-") },
    { label: "Toplanti Baskani", value: turkishToAscii(data.president_name) },
    { label: "Sekreter", value: turkishToAscii(data.secretary_name || "-") },
  ];
  
  doc.setFontSize(9);
  let infoYPos = yPos;
  
  info.forEach((item, index) => {
    const xPos = index % 2 === 0 ? 20 : 110;
    const currentY = infoYPos + Math.floor(index / 2) * 7;
    
    // Label
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(turkishToAscii(item.label + ":"), xPos, currentY);
    
    // Value
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42); // slate-900
    const valueX = xPos + doc.getTextWidth(turkishToAscii(item.label + ": "));
    doc.text(item.value, valueX, currentY);
  });
  
  yPos += 60;

  // ============================================
  // KATILIMCILAR TABLOSU
  // ============================================
  
  if (data.attendees.length > 0) {
    yPos += 5;
    
    // Başlık
    doc.setFillColor(124, 58, 237); // purple-600
    doc.roundedRect(15, yPos, 180, 10, 2, 2, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("KATILIMCILAR", 20, yPos + 6.5);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.attendees.length} Katilimci`, 180, yPos + 6.5, { align: "right" });
    
    yPos += 12;

    const attendeeRows = data.attendees.map((att, index) => [
      (index + 1).toString(),
      turkishToAscii(att.name),
      turkishToAscii(att.role || "-"),
      turkishToAscii(att.attendance_status || "Katildi"),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["#", "Ad Soyad", "Rol", "Durum"]],
      body: attendeeRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [71, 85, 105],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { 
          cellWidth: 15, 
          halign: "center",
          fontStyle: "bold",
          textColor: [124, 58, 237],
        },
        1: { 
          cellWidth: 70,
        },
        2: { 
          cellWidth: 50,
        },
        3: { 
          cellWidth: 45, 
          halign: "center",
          fontStyle: "bold",
        },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 15, right: 15 },
      didParseCell: (hookData) => {
        if (hookData.column.index === 3 && hookData.section === "body") {
          const status = hookData.cell.text[0];
          if (status === "Katildi") {
            hookData.cell.styles.textColor = [22, 163, 74]; // green-600
          } else if (status === "Katilmadi") {
            hookData.cell.styles.textColor = [220, 38, 38]; // red-600
          } else if (status === "Mazeret") {
            hookData.cell.styles.textColor = [234, 179, 8]; // yellow-600
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============================================
  // GÜNDEM MADDELERİ
  // ============================================
  
  if (data.agenda.length > 0) {
    // Yeni sayfa gerekirse
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Başlık
    doc.setFillColor(59, 130, 246); // blue-500
    doc.roundedRect(15, yPos, 180, 10, 2, 2, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("GUNDEM MADDELERI", 20, yPos + 6.5);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.agenda.length} Madde`, 180, yPos + 6.5, { align: "right" });
    
    yPos += 15;

    data.agenda.forEach((item, index) => {
      // Sayfa kontrolü
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      // Madde kartı
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(15, yPos, 180, 0, 2, 2, 'S');
      
      // Numara badge
      doc.setFillColor(239, 246, 255); // blue-50
      doc.circle(22, yPos + 5, 4, 'F');
      doc.setFontSize(10);
      doc.setTextColor(59, 130, 246); // blue-500
      doc.setFont("helvetica", "bold");
      doc.text(item.agenda_number.toString(), 22, yPos + 6.5, { align: "center" });
      
      // Başlık
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59); // slate-800
      const topicLines = doc.splitTextToSize(turkishToAscii(item.topic), 160);
      doc.text(topicLines, 28, yPos + 6);
      
      let itemYPos = yPos + 6 + (topicLines.length * 5);

      // Görüşmeler
      if (item.discussion) {
        itemYPos += 3;
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "bold");
        doc.text("Gorusmeler:", 20, itemYPos);
        
        itemYPos += 4;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        const discussionLines = doc.splitTextToSize(turkishToAscii(item.discussion), 170);
        doc.text(discussionLines, 20, itemYPos);
        itemYPos += discussionLines.length * 4;
      }

      // Karar (vurgulu)
      if (item.decision) {
        itemYPos += 3;
        
        // Yeşil background
        const decisionLines = doc.splitTextToSize(turkishToAscii(item.decision), 165);
        doc.setFillColor(220, 252, 231); // green-50
        doc.roundedRect(18, itemYPos - 2, 174, decisionLines.length * 4 + 6, 2, 2, 'F');
        
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74); // green-600
        doc.setFont("helvetica", "bold");
        doc.text("KARAR:", 20, itemYPos);
        
        itemYPos += 4;
        doc.setFont("helvetica", "normal");
        doc.text(decisionLines, 20, itemYPos);
        itemYPos += decisionLines.length * 4 + 2;
      }

      // Sorumlu ve Termin
      if (item.responsible_person || item.deadline) {
        itemYPos += 2;
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        
        const details = [];
        if (item.responsible_person) 
          details.push(`Sorumlu: ${turkishToAscii(item.responsible_person)}`);
        if (item.deadline)
          details.push(`Termin: ${new Date(item.deadline).toLocaleDateString("tr-TR")}`);
        
        doc.text(details.join("  |  "), 20, itemYPos);
        itemYPos += 5;
      }

      yPos = itemYPos + 5;

      // Ayırıcı çizgi
      if (index < data.agenda.length - 1) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, yPos, 195, yPos);
        yPos += 5;
      }
    });
  }

  // ============================================
  // KARARLAR ÖZETİ
  // ============================================
  
  if (data.decisions.length > 0) {
    doc.addPage();
    yPos = 20;

    // Başlık
    doc.setFillColor(34, 197, 94); // green-500
    doc.roundedRect(15, yPos, 180, 10, 2, 2, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("ALINAN KARARLAR", 20, yPos + 6.5);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.decisions.length} Karar`, 180, yPos + 6.5, { align: "right" });
    
    yPos += 12;

    const decisionRows = data.decisions.map((dec) => [
      dec.decision_number.toString(),
      turkishToAscii(dec.description),
      turkishToAscii(dec.responsible || "-"),
      dec.deadline ? new Date(dec.deadline).toLocaleDateString("tr-TR") : "-",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["#", "Karar", "Sorumlu", "Termin"]],
      body: decisionRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [240, 253, 244],
        textColor: [21, 128, 61],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { 
          cellWidth: 12, 
          halign: "center",
          fontStyle: "bold",
          textColor: [34, 197, 94],
        },
        1: { 
          cellWidth: 105,
        },
        2: { 
          cellWidth: 38,
        },
        3: { 
          cellWidth: 25, 
          halign: "center",
          fontSize: 8,
        },
      },
      margin: { left: 15, right: 15 },
    });
  }

  // ============================================
  // FOOTER (Her sayfaya)
  // ============================================
  
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    const pageHeight = doc.internal.pageSize.height;
    const footerY = pageHeight - 12;

    // Footer çizgisi
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, footerY - 3, 195, footerY - 3);

    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    
    // Sol: Tarih
    doc.text(
      `${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR")}`,
      15,
      footerY
    );

    // Orta: Sayfa no
    doc.setFont("helvetica", "bold");
    doc.text(
      `${i} / ${pageCount}`,
      105,
      footerY,
      { align: "center" }
    );

    // Sağ: Firma
    doc.setFont("helvetica", "normal");
    doc.text(
      turkishToAscii(data.company_name),
      195,
      footerY,
      { align: "right" }
    );
  }

  // ============================================
  // KAYDET
  // ============================================
  
  const fileName = `ISG_Kurul_${turkishToAscii(data.meeting_number).replace(/\//g, "-")}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;
  
  doc.save(fileName);
};