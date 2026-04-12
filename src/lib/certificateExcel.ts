import * as XLSX from "xlsx";
import type { CertificateParticipantInput } from "@/types/certificates";

export function parseCertificateParticipantsExcel(file: File): Promise<CertificateParticipantInput[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
        const participants = rows
          .map((row) => ({
            name: String(row.name || row.ad_soyad || row.ad || "").trim(),
            tc_no: String(row.tc_no || row.tc || row.tckn || "").trim(),
            job_title: String(row.job_title || row.gorev || row.unvan || "").trim(),
          }))
          .filter((row) => row.name.length > 0);
        resolve(participants);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function createCertificateExcelTemplate() {
  const worksheet = XLSX.utils.json_to_sheet([
    { name: "Ahmet Yılmaz", tc_no: "12345678901", job_title: "Operatör" },
    { name: "Ayşe Demir", tc_no: "10987654321", job_title: "Teknisyen" },
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Katılımcılar");
  XLSX.writeFile(workbook, "sertifika-katilimci-sablonu.xlsx");
}
