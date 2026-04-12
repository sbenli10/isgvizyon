import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  BoardMeetingWithRelations,
  MeetingAttendee,
  MeetingAgenda,
} from "@/types/boardMeeting";

export async function generateMeetingPDF(
  meeting: BoardMeetingWithRelations,
  attendees: MeetingAttendee[],
  agenda: MeetingAgenda[]
) {
  // Create PDF (Landscape for wide tables)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // ✅ HEADER
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("İŞ SAĞLIĞI VE GÜVENLİĞİ KURUL TOPLANTISI TUTANAĞI", pageWidth / 2, yPos, {
    align: "center",
  });

  yPos += 15;

  // ✅ MEETING INFO
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const infoData = [
    ["Firma", meeting.company?.name || "-"],
    [
      "Toplantı Tarihi",
      new Date(meeting.meeting_date).toLocaleDateString("tr-TR") +
        (meeting.meeting_time ? ` - ${meeting.meeting_time}` : ""),
    ],
    ["Toplantı Yeri", meeting.location || "-"],
    ["Toplantı Başkanı", meeting.president_name],
    ["Sekreter", meeting.secretary_name || "-"],
    ["Toplantı No", meeting.meeting_number || "-"],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: infoData,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      1: { cellWidth: "auto" },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ✅ ATTENDEES TABLE
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("KATILIMCILAR", 15, yPos);
  yPos += 7;

  const attendeesData = attendees.map((attendee, index) => [
    index + 1,
    (attendee as any).employee?.name || attendee.external_name || "-",
    attendee.role,
    (attendee as any).employee?.position || "-",
    attendee.status === "attended" ? "✓" : "✗",
    "", // İmza alanı
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["No", "Ad Soyad", "Görevi", "Ünvanı", "Katılım", "İmza"]],
    body: attendeesData,
    theme: "striped",
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 15, halign: "center" },
      1: { cellWidth: 50 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 40 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ✅ AGENDA & DECISIONS
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("GÜNDEM VE ALINAN KARARLAR", 15, yPos);
  yPos += 7;

  const agendaData = agenda.map((item) => [
    item.agenda_number,
    item.topic,
    item.discussion || "-",
    item.decision || "-",
    item.responsible_person || "-",
    item.deadline ? new Date(item.deadline).toLocaleDateString("tr-TR") : "-",
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["No", "Gündem", "Görüşmeler", "Karar", "Sorumlu", "Termin"]],
    body: agendaData,
    theme: "striped",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 50 },
      2: { cellWidth: 60 },
      3: { cellWidth: 50 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25, halign: "center" },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ✅ NOTES
  if (meeting.notes) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("NOTLAR:", 15, yPos);
    yPos += 5;

    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(meeting.notes, pageWidth - 30);
    doc.text(splitNotes, 15, yPos);
    yPos += splitNotes.length * 5;
  }

  // ✅ FOOTER - SIGNATURES
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  } else {
    yPos += 15;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const signatureY = yPos;
  const col1X = 40;
  const col2X = pageWidth / 2 + 20;

  // Toplantı Başkanı
  doc.text("Toplantı Başkanı", col1X, signatureY, { align: "center" });
  doc.line(col1X - 30, signatureY + 15, col1X + 30, signatureY + 15);
  doc.setFont("helvetica", "bold");
  doc.text(meeting.president_name, col1X, signatureY + 20, { align: "center" });

  // Sekreter
  if (meeting.secretary_name) {
    doc.setFont("helvetica", "normal");
    doc.text("Sekreter", col2X, signatureY, { align: "center" });
    doc.line(col2X - 30, signatureY + 15, col2X + 30, signatureY + 15);
    doc.setFont("helvetica", "bold");
    doc.text(meeting.secretary_name, col2X, signatureY + 20, { align: "center" });
  }

  // ✅ PAGE NUMBERS
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Sayfa ${i} / ${pageCount}`,
      pageWidth - 20,
      pageHeight - 10,
      { align: "right" }
    );
    doc.text(
      `Oluşturulma: ${new Date().toLocaleString("tr-TR")}`,
      15,
      pageHeight - 10
    );
  }

  // ✅ SAVE PDF
  const fileName = `ISG_Kurul_Toplantisi_${meeting.meeting_number?.replace(/\//g, "-") || "Tutanak"}.pdf`;
  doc.save(fileName);
}