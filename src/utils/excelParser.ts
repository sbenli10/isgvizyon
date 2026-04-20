import * as XLSX from "xlsx";

export interface ParsedEmployee {
  full_name?: string | null;
  first_name: string;
  last_name: string;
  tc_number?: string | null;
  job_title: string;
  department?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  employment_type?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  insured_job_code?: string | null;
  insured_job_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

const normalizeHeader = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/\./g, "")
    .replace(/[()]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, "_");

const parseExcelDate = (value: unknown) => {
  if (!value && value !== 0) return null;

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const year = String(parsed.y).padStart(4, "0");
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) return null;

  const dotMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dotMatch) {
    const [, dayRaw, monthRaw, yearRaw] = dotMatch;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year.padStart(4, "0")}-${monthRaw.padStart(2, "0")}-${dayRaw.padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
};

const splitFullName = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
};

export function parseEmployeeExcel(file: File): Promise<ParsedEmployee[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

        const employees: ParsedEmployee[] = rows.flatMap((row) => {
          const normalizedRow = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
            acc[normalizeHeader(key)] = value;
            return acc;
          }, {});

          const fullNameValue = String(
            normalizedRow.adi_soyadi ||
              normalizedRow.ad_soyad ||
              normalizedRow.full_name ||
              normalizedRow.fullname ||
              "",
          ).trim();

          const derivedName = splitFullName(fullNameValue);
          const firstName = String(
            normalizedRow.adi ||
              normalizedRow.ad ||
              normalizedRow.isim ||
              normalizedRow.first_name ||
              derivedName.firstName ||
              "",
          ).trim();
          const lastName = String(
            normalizedRow.soyadi ||
              normalizedRow.soyad ||
              normalizedRow.last_name ||
              derivedName.lastName ||
              "",
          ).trim();

          const insuredJobName = String(
            normalizedRow.sigortali_mes_ismi ||
              normalizedRow.sigortali_meslek_ismi ||
              normalizedRow.meslek_ismi ||
              normalizedRow.meslek_adi ||
              normalizedRow.job_title ||
              normalizedRow.gorev ||
              normalizedRow.gorevi ||
              "",
          ).trim();

          const employee: ParsedEmployee = {
            full_name: fullNameValue || [firstName, lastName].filter(Boolean).join(" ").trim() || null,
            first_name: firstName,
            last_name: lastName,
            tc_number: String(
              normalizedRow.tc_kimlik_no ||
                normalizedRow.tc_no ||
                normalizedRow.tc ||
                normalizedRow.tc_number ||
                "",
            ).trim() || null,
            job_title: insuredJobName || "Belirtilmemiş",
            department: String(
              normalizedRow.department ||
                normalizedRow.departman ||
                normalizedRow.bolum ||
                normalizedRow.birim ||
                "",
            ).trim() || null,
            start_date: parseExcelDate(
              normalizedRow.ise_giris_tar ||
                normalizedRow.ise_giris_tarihi ||
                normalizedRow.baslangic_tarihi ||
                normalizedRow.start_date,
            ),
            end_date: parseExcelDate(
              normalizedRow.isten_cik_tar ||
                normalizedRow.isten_cikis_tar ||
                normalizedRow.isten_cikis_tarihi ||
                normalizedRow.end_date,
            ),
            employment_type: String(
              normalizedRow.employment_type || normalizedRow.calisma_tipi || "Süresiz",
            ).trim() || "Süresiz",
            birth_date: parseExcelDate(normalizedRow.birth_date || normalizedRow.dogum_tarihi),
            gender: String(normalizedRow.cinsiyeti || normalizedRow.cinsiyet || normalizedRow.gender || "").trim() || null,
            insured_job_code: String(
              normalizedRow.sigortali_mes_kodu ||
                normalizedRow.sigortali_meslek_kodu ||
                normalizedRow.meslek_kodu ||
                normalizedRow.insured_job_code ||
                "",
            ).trim() || null,
            insured_job_name: insuredJobName || null,
            email: String(normalizedRow.email || normalizedRow.eposta || "").trim() || null,
            phone: String(normalizedRow.phone || normalizedRow.telefon || "").trim() || null,
          };

          if (!employee.first_name && !employee.last_name && !employee.tc_number) {
            return [];
          }

          if (!employee.first_name && employee.full_name) {
            const split = splitFullName(employee.full_name);
            employee.first_name = split.firstName;
            employee.last_name = split.lastName;
          }

          if (!employee.first_name || !employee.last_name) {
            return [];
          }

          if (!employee.start_date) {
            employee.start_date = new Date().toISOString().slice(0, 10);
          }

          return [employee];
        });

        resolve(employees);
      } catch (error) {
        reject(new Error(`Excel dosyası okunamadı: ${(error as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadEmployeeTemplate() {
  const template = [
    [
      "Adı Soyadı",
      "Adı",
      "Soyadı",
      "Tc Kimlik No",
      "İşe Giriş Tar.",
      "İşten Çık.Tar.",
      "Cinsiyeti",
      "Sigortalı Mes. Kodu",
      "Sigortalı Mes. İsmi",
      "Departman",
      "Telefon",
      "E-Posta",
    ],
    [
      "Ali Yılmaz",
      "Ali",
      "Yılmaz",
      "12345678901",
      "2026-04-01",
      "",
      "Erkek",
      "7223.14",
      "Kaynak Operatörü",
      "Üretim",
      "05551234567",
      "ali@example.com",
    ],
    [
      "Ayşe Kaya",
      "Ayşe",
      "Kaya",
      "10987654321",
      "2026-04-03",
      "",
      "Kadın",
      "3115.08",
      "Kalite Kontrol Elemanı",
      "Kalite",
      "05559876543",
      "ayse@example.com",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Calisanlar");
  XLSX.writeFile(wb, "calisanlar-sablonu.xlsx");
}
