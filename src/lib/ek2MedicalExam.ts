import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/types/companies";

type JsPdfConstructor = new (options?: Record<string, unknown>) => any;

const db = supabase as any;

export type YesNo = "yes" | "no";

export interface Ek2CompanyOption {
  id: string;
  name: string;
  workplaceRegistrationNumber: string;
  address: string;
  phone: string;
  email: string;
}

export interface Ek2EmployeeOption {
  id: string;
  companyId: string;
  fullName: string;
  tcNumber: string;
  phone: string;
  gender: string;
  birthDate: string;
  address: string;
  jobTitle: string;
  department: string;
  startDate: string;
  educationLevel: string;
  bloodType: string;
}

export interface Ek2MedicalExamRecord {
  id?: string;
  userId?: string;
  organizationId?: string | null;
  companyId: string;
  employeeId: string;
  company: Ek2CompanyOption;
  employee: Ek2EmployeeOption;
  workplaceDeclaration: string;
  birthPlace: string;
  education: string;
  maritalStatus: string;
  children: string;
  previousJobs: Array<{ workplace: string; job: string; period: string }>;
  medicalHistory: {
    bloodType: string;
    congenitalChronicDisease: string;
    tetanus: string;
    hepatitis: string;
    other: string;
  };
  familyHistory: Record<"mother" | "father" | "sibling" | "child", YesNo>;
  anamnesis: Record<string, YesNo>;
  anamnesisNotes: Record<string, string>;
  smokingStatus: "no" | "quit" | "yes";
  smokingDetails: {
    quitBefore: string;
    smokedFor: string;
    cigarettesPerDay: string;
  };
  alcoholDetails: {
    years: string;
    frequency: string;
  };
  disabilityDetails: {
    reasonAndRate: string;
  };
  physicalExam: Record<string, { normal: boolean; note: string }>;
  vitals: {
    bloodPressure: string;
    pulse: string;
    height: string;
    weight: string;
    bmi: string;
  };
  laboratory: Record<string, { normal: boolean; note: string }>;
  opinion: {
    fit: boolean;
    conditionalFit: boolean;
    canWorkAtHeight: boolean;
    canWorkVeryDangerous: boolean;
    canWorkNight: boolean;
    heavyDangerousWorks: boolean;
    shiftWork: boolean;
    confinedSpace: boolean;
    date: string;
  };
}

export const anamnesisQuestions = [
  "Balgamlı öksürük",
  "Nefes darlığı",
  "Göğüs ağrısı",
  "Çarpıntı",
  "Sırt ağrısı",
  "İshal veya kabızlık",
  "Eklemlerde ağrı",
  "Kalp hastalığı",
  "Şeker hastalığı",
  "Böbrek rahatsızlığı",
  "Sarılık",
  "Mide veya on iki parmak ülseri",
  "İşitme kaybı",
  "Görme bozukluğu",
  "Sinir sistemi hastalığı",
  "Deri hastalığı",
  "Besin zehirlenmesi",
  "Hastanede yattınız mı?",
  "Ameliyat oldunuz mu?",
  "İş kazası geçirdiniz mi?",
  "Meslek hastalıkları şüphesi ile ilgili tetkik veya muayeneye tabi tutuldunuz mu?",
  "Sigara içiyor musunuz?",
  "Şu anda herhangi bir tedavi görüyor musunuz?",
  "Alkol alıyor musunuz?",
  "Maluliyet aldınız mı?",
];

export const physicalExamItems = [
  "Göz",
  "Kulak-Burun-Boğaz",
  "Deri",
  "Diğer (Duyu)",
  "Kardiyovasküler",
  "Solunum",
  "Sindirim",
  "Ürogenital",
  "Kas-İskelet",
  "Nörolojik",
  "Psikiyatrik",
];

export const laboratoryItems = ["Kan", "İdrar", "Radyolojik", "Odyometre", "SFT", "Fizyolojik", "Psikolojik"];

const blankCompany: Ek2CompanyOption = {
  id: "",
  name: "",
  workplaceRegistrationNumber: "",
  address: "",
  phone: "",
  email: "",
};

const blankEmployee: Ek2EmployeeOption = {
  id: "",
  companyId: "",
  fullName: "",
  tcNumber: "",
  phone: "",
  gender: "",
  birthDate: "",
  address: "",
  jobTitle: "",
  department: "",
  startDate: "",
  educationLevel: "",
  bloodType: "",
};

function emptyYesNoMap(keys: string[]) {
  return keys.reduce<Record<string, YesNo>>((acc, key) => {
    acc[key] = "no";
    return acc;
  }, {});
}

function emptyCheckNoteMap(keys: string[]) {
  return keys.reduce<Record<string, { normal: boolean; note: string }>>((acc, key) => {
    acc[key] = { normal: false, note: "" };
    return acc;
  }, {});
}

export function createEmptyEk2MedicalExamRecord(organizationId?: string | null): Ek2MedicalExamRecord {
  return {
    organizationId: organizationId ?? null,
    companyId: "",
    employeeId: "",
    company: blankCompany,
    employee: blankEmployee,
    workplaceDeclaration: "İşe giriş/periyodik muayene olmayı kabul ettiğimi ve muayene sırasında verdiğim bilgilerin doğru ve eksiksiz olduğunu beyan ederim.",
    birthPlace: "",
    education: "",
    maritalStatus: "",
    children: "",
    previousJobs: [
      { workplace: "", job: "", period: "" },
      { workplace: "", job: "", period: "" },
    ],
    medicalHistory: {
      bloodType: "",
      congenitalChronicDisease: "",
      tetanus: "",
      hepatitis: "",
      other: "",
    },
    familyHistory: {
      mother: "no",
      father: "no",
      sibling: "no",
      child: "no",
    },
    anamnesis: emptyYesNoMap(anamnesisQuestions),
    anamnesisNotes: {},
    smokingStatus: "no",
    smokingDetails: {
      quitBefore: "",
      smokedFor: "",
      cigarettesPerDay: "",
    },
    alcoholDetails: {
      years: "",
      frequency: "",
    },
    disabilityDetails: {
      reasonAndRate: "",
    },
    physicalExam: emptyCheckNoteMap(physicalExamItems),
    vitals: {
      bloodPressure: "120/80",
      pulse: "72",
      height: "",
      weight: "",
      bmi: "",
    },
    laboratory: emptyCheckNoteMap(laboratoryItems),
    opinion: {
      fit: true,
      conditionalFit: false,
      canWorkAtHeight: false,
      canWorkVeryDangerous: false,
      canWorkNight: false,
      heavyDangerousWorks: false,
      shiftWork: false,
      confinedSpace: false,
      date: new Date().toISOString().slice(0, 10),
    },
  };
}

function companyName(company: Company & { name?: string }) {
  return company.company_name || company.name || "Firma";
}

export async function loadEk2Companies(): Promise<Ek2CompanyOption[]> {
  const { data, error } = await db.from("companies").select("*").eq("is_active", true);
  if (error) throw error;
  return ((data || []) as Array<Company & { name?: string }>)
    .map((company) => ({
      id: company.id,
      name: companyName(company),
      workplaceRegistrationNumber: company.workplace_registration_number || company.sgk_workplace_number || "",
      address: company.address || [company.city, company.district].filter(Boolean).join(" / "),
      phone: company.phone || "",
      email: company.email || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
}

export async function loadEk2Employees(): Promise<Ek2EmployeeOption[]> {
  const { data, error } = await db.from("employees").select("*").eq("is_active", true);
  if (error) throw error;
  return (data || [])
    .map((employee: any) => ({
      id: employee.id,
      companyId: employee.company_id || "",
      fullName: employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
      tcNumber: employee.tc_number || employee.tc_no || "",
      phone: employee.phone || "",
      gender: employee.gender || "",
      birthDate: employee.birth_date || "",
      address: employee.address || "",
      jobTitle: employee.job_title || employee.position || "",
      department: employee.department || "",
      startDate: employee.start_date || "",
      educationLevel: employee.education_level || "",
      bloodType: employee.blood_type || "",
    }))
    .sort((a: Ek2EmployeeOption, b: Ek2EmployeeOption) => a.fullName.localeCompare(b.fullName, "tr-TR"));
}

export function applyEk2Company(record: Ek2MedicalExamRecord, company: Ek2CompanyOption): Ek2MedicalExamRecord {
  return {
    ...record,
    companyId: company.id,
    company,
    employeeId: "",
    employee: blankEmployee,
  };
}

export function applyEk2Employee(record: Ek2MedicalExamRecord, employee: Ek2EmployeeOption): Ek2MedicalExamRecord {
  return {
    ...record,
    employeeId: employee.id,
    employee,
    birthPlace: record.birthPlace,
    education: record.education || employee.educationLevel,
    medicalHistory: {
      ...record.medicalHistory,
      bloodType: record.medicalHistory.bloodType || employee.bloodType,
    },
  };
}

export function validateEk2MedicalExam(record: Ek2MedicalExamRecord) {
  const errors: string[] = [];
  if (!record.companyId) errors.push("Firma seçimi zorunludur.");
  if (!record.employee.fullName.trim()) errors.push("Çalışan adı soyadı zorunludur.");
  if (!record.opinion.date) errors.push("Muayene / düzenleme tarihi zorunludur.");
  return errors;
}

export async function saveEk2MedicalExamRecord(record: Ek2MedicalExamRecord, userId: string, organizationId?: string | null) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || record.organizationId || null,
    company_id: record.companyId || null,
    employee_id: record.employeeId || null,
    company_snapshot: record.company,
    employee_snapshot: record.employee,
    workplace_declaration: record.workplaceDeclaration,
    birth_place: record.birthPlace,
    education: record.education,
    marital_status: record.maritalStatus,
    children: record.children,
    previous_jobs: record.previousJobs,
    medical_history: record.medicalHistory,
    family_history: record.familyHistory,
    anamnesis: record.anamnesis,
    anamnesis_notes: record.anamnesisNotes,
    smoking_status: record.smokingStatus,
    smoking_details: record.smokingDetails,
    alcohol_details: record.alcoholDetails,
    disability_details: record.disabilityDetails,
    physical_exam: record.physicalExam,
    vitals: record.vitals,
    laboratory: record.laboratory,
    opinion: record.opinion,
  };

  const query = record.id
    ? db.from("ek2_medical_exam_records").update(payload).eq("id", record.id).select("*").single()
    : db.from("ek2_medical_exam_records").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw error;
  return data as Record<string, unknown>;
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

async function loadPdfTools() {
  const [{ default: jsPDF }, { addInterFontsToJsPDF }] = await Promise.all([
    import("jspdf"),
    import("@/utils/fonts"),
  ]);
  return { jsPDF: jsPDF as JsPdfConstructor, addInterFontsToJsPDF };
}

function drawHeader(doc: any, x: number, y: number, width: number, title: string, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.rect(x, y, width, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("Inter", "bold");
  doc.setFontSize(8);
  doc.text(title, x + 2, y + 5.3);
}

function drawCell(doc: any, label: string, value: string, x: number, y: number, w: number, h = 9) {
  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(248, 250, 252);
  doc.rect(x, y, w, h, "FD");
  doc.setTextColor(15, 23, 42);
  doc.setFont("Inter", "bold");
  doc.setFontSize(6);
  doc.text(label, x + 1.5, y + 3.2);
  doc.setFont("Inter", "normal");
  doc.text(doc.splitTextToSize(value || "-", w - 3), x + 1.5, y + 6.8);
}

function yesNo(value: YesNo) {
  return value === "yes" ? "Evet" : "Hayır";
}

async function generateEk2MedicalExamPdfLegacy(record: Ek2MedicalExamRecord, doublePage = false) {
  const { jsPDF, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addInterFontsToJsPDF(doc);
  doc.setFont("Inter", "normal");
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2;

  doc.setFillColor(236, 244, 255);
  doc.rect(0, 0, pageWidth, 18, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFont("Inter", "bold");
  doc.setFontSize(12);
  doc.text("İŞE GİRİŞ / PERİYODİK MUAYENE FORMU (EK-2)", pageWidth / 2, 11, { align: "center" });

  let y = 24;
  drawHeader(doc, marginX, y, contentWidth, "İŞYERİNİN", [51, 65, 85]);
  y += 8;
  drawCell(doc, "Unvanı", record.company.name, marginX, y, 54);
  drawCell(doc, "SGK Sicil No", record.company.workplaceRegistrationNumber, marginX + 54, y, 44);
  drawCell(doc, "Adres", record.company.address, marginX + 98, y, 58);
  drawCell(doc, "Tel / E-posta", [record.company.phone, record.company.email].filter(Boolean).join(" / "), marginX + 156, y, contentWidth - 156);
  y += 13;
  doc.setFontSize(6);
  doc.setTextColor(37, 99, 235);
  doc.text(doc.splitTextToSize(record.workplaceDeclaration, contentWidth - 3), marginX + 1.5, y);
  y += 8;

  drawHeader(doc, marginX, y, contentWidth, "ÇALIŞANIN", [37, 99, 235]);
  y += 8;
  drawCell(doc, "Ad Soyad", record.employee.fullName, marginX, y, 46);
  drawCell(doc, "TC Kimlik No", record.employee.tcNumber, marginX + 46, y, 38);
  drawCell(doc, "Tel No", record.employee.phone, marginX + 84, y, 32);
  drawCell(doc, "Cinsiyet", record.employee.gender, marginX + 116, y, 25);
  drawCell(doc, "Doğum Tarihi", record.employee.birthDate, marginX + 141, y, 31);
  y += 9;
  drawCell(doc, "Doğum Yeri", record.birthPlace, marginX, y, 32);
  drawCell(doc, "Eğitim", record.education, marginX + 32, y, 35);
  drawCell(doc, "Medeni Hali", record.maritalStatus, marginX + 67, y, 34);
  drawCell(doc, "Çocuk", record.children, marginX + 101, y, 22);
  drawCell(doc, "Ev Adresi", record.employee.address, marginX + 123, y, contentWidth - 123);
  y += 9;
  drawCell(doc, "Mesleği", record.employee.jobTitle, marginX, y, 64);
  drawCell(doc, "Yaptığı İş", record.employee.jobTitle, marginX + 64, y, 58);
  drawCell(doc, "Çalıştığı Bölüm", record.employee.department, marginX + 122, y, contentWidth - 122);
  y += 13;

  drawHeader(doc, marginX, y, contentWidth, "ÖZGEÇMİŞİ", [5, 150, 105]);
  y += 8;
  drawCell(doc, "Kan Grubu", record.medicalHistory.bloodType, marginX, y, 30);
  drawCell(doc, "Konjenital/Kronik Hastalık", record.medicalHistory.congenitalChronicDisease, marginX + 30, y, 72);
  drawCell(doc, "Tetanoz", record.medicalHistory.tetanus, marginX + 102, y, 30);
  drawCell(doc, "Hepatit", record.medicalHistory.hepatitis, marginX + 132, y, 30);
  drawCell(doc, "Diğer", record.medicalHistory.other, marginX + 162, y, contentWidth - 162);
  y += 14;

  drawHeader(doc, marginX, y, contentWidth, "SOY GEÇMİŞİ", [124, 58, 237]);
  y += 8;
  ["mother", "father", "sibling", "child"].forEach((key, index) => {
    const labels: Record<string, string> = { mother: "Anne", father: "Baba", sibling: "Kardeş", child: "Çocuk" };
    drawCell(doc, labels[key], yesNo(record.familyHistory[key as keyof typeof record.familyHistory]), marginX + index * (contentWidth / 4), y, contentWidth / 4);
  });
  y += 14;

  drawHeader(doc, marginX, y, contentWidth, "TIBBİ ANAMNEZ", [217, 119, 6]);
  y += 9;
  doc.setFontSize(6);
  const anamnesisRows = anamnesisQuestions.slice(0, doublePage ? 25 : 18);
  anamnesisRows.forEach((question, index) => {
    const col = index < Math.ceil(anamnesisRows.length / 2) ? 0 : 1;
    const row = col === 0 ? index : index - Math.ceil(anamnesisRows.length / 2);
    const x = marginX + col * (contentWidth / 2);
    const textY = y + row * 5;
    doc.setTextColor(15, 23, 42);
    const note = record.anamnesisNotes[question] ? ` - ${record.anamnesisNotes[question]}` : "";
    const smoking =
      question === "Sigara içiyor musunuz?"
        ? ` (${record.smokingStatus === "quit" ? "Bırakmış" : yesNo(record.anamnesis[question] || "no")}${record.smokingDetails.quitBefore ? `, ${record.smokingDetails.quitBefore} önce` : ""}${record.smokingDetails.smokedFor ? `, ${record.smokingDetails.smokedFor} içmiş` : ""}${record.smokingDetails.cigarettesPerDay ? `, ${record.smokingDetails.cigarettesPerDay}/gün` : ""})`
        : "";
    const alcohol = question === "Alkol alıyor musunuz?" && record.anamnesis[question] === "yes" ? ` (${[record.alcoholDetails.years, record.alcoholDetails.frequency].filter(Boolean).join(", ")})` : "";
    const disability = question === "Maluliyet aldınız mı?" && record.anamnesis[question] === "yes" ? ` (${record.disabilityDetails.reasonAndRate || "Detay belirtilmedi"})` : "";
    doc.text(`${question}: ${yesNo(record.anamnesis[question] || "no")}${smoking}${alcohol}${disability}${note}`, x, textY);
  });
  y += Math.ceil(anamnesisRows.length / 2) * 5 + 4;

  if (doublePage || y > 230) {
    doc.addPage();
    y = 18;
  }

  drawHeader(doc, marginX, y, contentWidth, "FİZİK MUAYENE SONUÇLARI", [8, 145, 178]);
  y += 9;
  physicalExamItems.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const entry = record.physicalExam[item];
    drawCell(doc, item, `${entry?.normal ? "Normal" : "Not"} ${entry?.note || ""}`.trim(), marginX + col * (contentWidth / 3), y + row * 9, contentWidth / 3);
  });
  y += Math.ceil(physicalExamItems.length / 3) * 9 + 4;
  drawCell(doc, "Tansiyon (TA)", record.vitals.bloodPressure, marginX, y, 34);
  drawCell(doc, "Nabız (Nb)", record.vitals.pulse, marginX + 34, y, 30);
  drawCell(doc, "Boy (cm)", record.vitals.height, marginX + 64, y, 30);
  drawCell(doc, "Kilo (kg)", record.vitals.weight, marginX + 94, y, 30);
  drawCell(doc, "VKİ", record.vitals.bmi, marginX + 124, y, 30);
  y += 14;

  drawHeader(doc, marginX, y, contentWidth, "LABORATUVAR BULGULARI", [79, 70, 229]);
  y += 9;
  laboratoryItems.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const entry = record.laboratory[item];
    drawCell(doc, item, `${entry?.normal ? "Normal" : "Not"} ${entry?.note || ""}`.trim(), marginX + col * (contentWidth / 3), y + row * 9, contentWidth / 3);
  });
  y += Math.ceil(laboratoryItems.length / 3) * 9 + 5;

  drawHeader(doc, marginX, y, contentWidth, "KANAAT VE SONUÇ", [5, 150, 65]);
  y += 10;
  drawCell(doc, "Kanaat", record.opinion.fit ? "İşinde bedenen ve ruhen çalışmaya elverişlidir." : record.opinion.conditionalFit ? "Şartıyla çalışmaya elverişlidir." : "-", marginX, y, contentWidth, 12);
  y += 14;
  const restrictions = [
    record.opinion.canWorkAtHeight && "Yüksekte Çalışabilir",
    record.opinion.canWorkVeryDangerous && "Çok Tehlikeli İşlerde Çalışabilir",
    record.opinion.canWorkNight && "Gece Çalışabilir",
    record.opinion.heavyDangerousWorks && "Ağır ve Tehlikeli İşler",
    record.opinion.shiftWork && "Vardiyalı İşler",
    record.opinion.confinedSpace && "Kapalı Alanda",
  ].filter(Boolean).join(", ");
  drawCell(doc, "Çalışabileceği İşler", restrictions || "-", marginX, y, contentWidth - 45, 12);
  drawCell(doc, "Muayene Tarihi", record.opinion.date, marginX + contentWidth - 45, y, 45, 12);

  const fileName = `${safeFileName(record.employee.fullName || "EK2_Muayene_Formu")}_EK2_Muayene_Formu.pdf`;
  doc.save(fileName);
}

function ek2Date(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

function ek2Font(doc: any, bold = false, size = 5.5) {
  doc.setFont("Inter", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.16);
}

function ek2Section(doc: any, title: string, x: number, y: number, w: number) {
  doc.setFillColor(235, 240, 248);
  doc.rect(x, y, w, 5.2, "FD");
  ek2Font(doc, true, 5.8);
  doc.text(title, x + 1.3, y + 3.55);
}

function ek2Text(doc: any, text: string, x: number, y: number, w: number, h: number, bold = false, align: "left" | "center" = "left") {
  doc.rect(x, y, w, h);
  ek2Font(doc, bold, 5.15);
  const lines = doc.splitTextToSize(text || "", Math.max(4, w - 2));
  doc.text(lines.slice(0, Math.max(1, Math.floor(h / 2.7))), align === "center" ? x + w / 2 : x + 1, y + 3.35, { align });
}

function ek2Field(doc: any, label: string, value: string, x: number, y: number, w: number, h = 5.05, labelW = 43) {
  doc.rect(x, y, w, h);
  doc.line(x + labelW, y, x + labelW, y + h);
  ek2Font(doc, true, 5.15);
  doc.text(label, x + 1.2, y + 3.35);
  ek2Font(doc, false, 5.05);
  const lines = doc.splitTextToSize(value || "", Math.max(4, w - labelW - 2.4));
  doc.text(lines.slice(0, Math.max(1, Math.floor(h / 2.7))), x + labelW + 1.2, y + 3.35);
}

function ek2Check(doc: any, x: number, y: number, checked: boolean) {
  doc.rect(x, y - 2.35, 2.5, 2.5);
  if (checked) {
    ek2Font(doc, true, 4.8);
    doc.text("X", x + 0.45, y - 0.25);
  }
}

function ek2OpinionLine(doc: any, no: string, checked: boolean, text: string, x: number, y: number) {
  ek2Font(doc, true, 5.7);
  doc.text(no, x + 1, y);
  ek2Check(doc, x + 11, y, checked);
  doc.setLineWidth(0.22);
  doc.line(x + 20, y - 1.2, x + 88, y - 1.2);
  doc.text(text, x + 93, y);
  doc.setLineWidth(0.16);
}

function ek2AnamnesisAnswer(record: Ek2MedicalExamRecord, question: string) {
  if (question === "Sigara içiyor musunuz?") {
    if (record.smokingStatus === "quit") {
      const detail = [
        record.smokingDetails.quitBefore && `${record.smokingDetails.quitBefore} önce`,
        record.smokingDetails.smokedFor && `${record.smokingDetails.smokedFor} içmiş`,
        record.smokingDetails.cigarettesPerDay && `${record.smokingDetails.cigarettesPerDay} adet/gün`,
      ].filter(Boolean).join(", ");
      return `Bırakmış${detail ? ` (${detail})` : ""}`;
    }
    return record.smokingStatus === "yes" ? "Evet" : "Hayır";
  }
  if (question === "Alkol alıyor musunuz?" && record.anamnesis[question] === "yes") {
    return `Evet${[record.alcoholDetails.years, record.alcoholDetails.frequency].filter(Boolean).length ? ` (${[record.alcoholDetails.years, record.alcoholDetails.frequency].filter(Boolean).join(", ")})` : ""}`;
  }
  if (question === "Maluliyet aldınız mı?" && record.anamnesis[question] === "yes") {
    return `Evet${record.disabilityDetails.reasonAndRate ? ` (${record.disabilityDetails.reasonAndRate})` : ""}`;
  }
  const answer = yesNo(record.anamnesis[question] || "no");
  return record.anamnesisNotes[question] ? `${answer} (${record.anamnesisNotes[question]})` : answer;
}

function ek2Question(doc: any, question: string, answer: string, x: number, y: number, w: number, h = 5.05) {
  doc.rect(x, y, w, h);
  doc.line(x + w - 44, y, x + w - 44, y + h);
  doc.line(x + w - 22, y, x + w - 22, y + h);
  ek2Font(doc, false, 5.05);
  doc.text(doc.splitTextToSize(question, w - 47).slice(0, 1), x + 1.2, y + 3.35);
  doc.text("Hayır", x + w - 38, y + 3.35);
  doc.text("Evet", x + w - 16.5, y + 3.35);
  if (answer === "Hayır") doc.text("X", x + w - 30, y + 3.35);
  else if (answer === "Evet") doc.text("X", x + w - 9, y + 3.35);
  else doc.text(doc.splitTextToSize(answer, 41).slice(0, 1), x + w - 42, y + 3.35);
}

export async function generateEk2MedicalExamPdf(record: Ek2MedicalExamRecord, _doublePage = false) {
  const { jsPDF, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addInterFontsToJsPDF(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const x = 18;
  const w = 174;
  const row = 5.05;

  const title = (page: number) => {
    ek2Font(doc, true, 8.2);
    doc.text("İŞE GİRİŞ / PERİYODİK MUAYENE FORMU", pageWidth / 2, 16, { align: "center" });
    if (page === 1) {
      ek2Font(doc, true, 6);
      doc.text("Ek-2", x + w - 23, 16);
    }
  };

  title(1);
  let y = 24;

  ek2Section(doc, "İŞYERİNİN", x, y, w - 34);
  doc.rect(x + w - 34, y, 34, 62.4);
  ek2Font(doc, false, 5.1);
  doc.rect(x + w - 25, y + 21, 19, 31);
  doc.text("Fotoğraf", x + w - 15.5, y + 37, { align: "center" });
  y += 5.2;

  ek2Field(doc, "Unvanı", record.company.name, x, y, w - 34, row);
  y += row;
  ek2Field(doc, "SGK Sicil No.", record.company.workplaceRegistrationNumber, x, y, w - 34, row);
  y += row;
  ek2Field(doc, "Adresi", record.company.address, x, y, w - 34, row);
  y += row;
  ek2Field(doc, "Tel ve Faks No.", record.company.phone, x, y, w - 34, row);
  y += row;
  ek2Field(doc, "E-Posta", record.company.email, x, y, w - 34, row);
  y += row;

  doc.rect(x, y, w - 34, 21);
  ek2Font(doc, false, 5);
  doc.text(doc.splitTextToSize(record.workplaceDeclaration || "İşe giriş/periyodik muayene olmayı kabul ettiğimi ve muayene sırasında verdiğim bilgilerin doğru ve eksiksiz olduğunu beyan ederim.", w - 38), x + 1.4, y + 3.8);
  doc.text("Çalışanın Adı Soyadı", x + 71, y + 12.6, { align: "center" });
  doc.text(record.employee.fullName || "", x + 71, y + 15.8, { align: "center" });
  doc.text("İmza", x + 71, y + 19, { align: "center" });
  y += 21;

  ek2Section(doc, "ÇALIŞANIN / İŞE GİRENİN", x, y, w);
  y += 5.2;
  [
    ["Adı ve soyadı", record.employee.fullName],
    ["T.C. Kimlik No", record.employee.tcNumber],
    ["Doğum Yeri ve Tarihi", [record.birthPlace, ek2Date(record.employee.birthDate)].filter(Boolean).join(" / ")],
    ["Cinsiyeti", record.employee.gender],
    ["Eğitim durumu", record.education],
    ["Medeni durumu", record.maritalStatus],
    ["Ev Adresi", record.employee.address],
    ["Tel No.", record.employee.phone],
    ["Mesleği/Meslek Dalı", record.employee.jobTitle],
    ["Yaptığı iş (Ayrıntılı olarak tanımlanacak.)", record.employee.jobTitle],
    ["Çalıştığı bölüm", record.employee.department],
  ].forEach(([label, value]) => {
    ek2Field(doc, label, value, x, y, w, row);
    y += row;
  });

  ek2Text(doc, "Daha önce çalıştığı yerler", x, y, w, row, true);
  y += row;
  ek2Text(doc, "No", x, y, 10, row, true, "center");
  ek2Text(doc, "Kuruluş", x + 10, y, 58, row, true, "center");
  ek2Text(doc, "Yaptığı iş", x + 68, y, 58, row, true, "center");
  ek2Text(doc, "Giriş-çıkış tarihi", x + 126, y, 48, row, true, "center");
  y += row;
  [...record.previousJobs, { workplace: "", job: "", period: "" }, { workplace: "", job: "", period: "" }].slice(0, 4).forEach((job, index) => {
    ek2Text(doc, String(index + 1), x, y, 10, row, false, "center");
    ek2Text(doc, job.workplace, x + 10, y, 58, row);
    ek2Text(doc, job.job, x + 68, y, 58, row);
    ek2Text(doc, job.period, x + 126, y, 48, row);
    y += row;
  });

  ek2Section(doc, "Özgeçmişi", x, y, w);
  y += 5.2;
  [
    ["Kan grubu", record.medicalHistory.bloodType],
    ["Konjenital/kronik hastalık", record.medicalHistory.congenitalChronicDisease],
    ["Bağışıklama", ""],
    ["  - Tetanoz", record.medicalHistory.tetanus],
    ["  - Hepatit", record.medicalHistory.hepatitis],
    ["  - Diğer", record.medicalHistory.other],
  ].forEach(([label, value]) => {
    ek2Field(doc, label, value, x, y, w, row);
    y += row;
  });

  ek2Section(doc, "Soygeçmişi", x, y, w);
  y += 5.2;
  ([
    ["Anne", record.familyHistory.mother],
    ["Baba", record.familyHistory.father],
    ["Kardeş", record.familyHistory.sibling],
    ["Çocuk", record.familyHistory.child],
  ] as const).forEach(([label, value], index) => {
    ek2Text(doc, `${label}: ${yesNo(value)}`, x + index * (w / 4), y, w / 4, row);
  });
  y += row + 1.2;

  ek2Section(doc, "TIBBİ ANAMNEZ", x, y, w);
  y += 5.2;
  ek2Text(doc, "1. Aşağıdaki yakınmalardan herhangi birini yaşadınız mı?", x, y, w - 44, row, true);
  ek2Text(doc, "Hayır", x + w - 44, y, 22, row, true, "center");
  ek2Text(doc, "Evet", x + w - 22, y, 22, row, true, "center");
  y += row;
  anamnesisQuestions.slice(0, 11).forEach((question) => {
    ek2Question(doc, question, ek2AnamnesisAnswer(record, question), x, y, w, row);
    y += row;
  });

  doc.addPage();
  title(2);
  y = 22;
  anamnesisQuestions.slice(11).forEach((question) => {
    ek2Question(doc, question, ek2AnamnesisAnswer(record, question), x, y, w, row);
    y += row;
  });
  y += 2;

  ek2Section(doc, "FİZİK MUAYENE SONUÇLARI", x, y, w);
  y += 5.2;
  physicalExamItems.forEach((item) => {
    const entry = record.physicalExam[item];
    ek2Field(doc, item, entry?.note || (entry?.normal ? "Normal" : ""), x, y, w, row);
    y += row;
  });
  ek2Text(doc, "T.A:", x, y, 18, row, true);
  ek2Text(doc, `${record.vitals.bloodPressure || ""} mm-Hg`, x + 18, y, 42, row);
  ek2Text(doc, "Nb:", x + 60, y, 15, row, true);
  ek2Text(doc, `${record.vitals.pulse || ""} /dk.`, x + 75, y, 32, row);
  ek2Text(doc, "Boy:", x + 107, y, 18, row, true);
  ek2Text(doc, record.vitals.height, x + 125, y, 20, row);
  ek2Text(doc, "Kilo:", x + 145, y, 14, row, true);
  ek2Text(doc, record.vitals.weight, x + 159, y, 15, row);
  y += row;
  ek2Field(doc, "Vücut Kitle İndeksi", record.vitals.bmi, x, y, w, row);
  y += row + 2;

  ek2Section(doc, "LABORATUVAR BULGULARI", x, y, w);
  y += 5.2;
  laboratoryItems.forEach((item) => {
    const entry = record.laboratory[item];
    ek2Field(doc, item, entry?.note || (entry?.normal ? "Normal" : ""), x, y, w, row);
    y += row;
  });
  ek2Field(doc, "Diğer", "", x, y, w, row);
  y += row + 2;

  ek2Section(doc, "KANAAT VE SONUÇ *", x, y, w);
  y += 7;
  ek2OpinionLine(doc, "1-", record.opinion.fit, "işinde bedenen ve ruhen çalışmaya elverişlidir.", x, y);
  y += 7;
  ek2OpinionLine(doc, "2-", record.opinion.conditionalFit, "şartı ile çalışmaya elverişlidir.", x, y);
  y += 8;
  ek2Font(doc, false, 4.75);
  doc.text(
    doc.splitTextToSize(
      "(*Yapılan muayene sonucunda çalışana görev yapacağı çalışma koşullarında çalışıp çalışamayacağı; ne kadar süreyle ve hangi koşullarda muayeneye gelmesi gerektiği işyeri hekimi tarafından değerlendirilir.)",
      w,
    ),
    x,
    y,
  );
  y += 10;
  ek2Font(doc, false, 6);
  doc.text(`_____/_____/20____`, x + w - 45, y);
  y += 7;
  ek2Font(doc, true, 6);
  doc.text("İMZA", x, y);
  y += 5;
  ek2Font(doc, false, 5.4);
  doc.text("Adı ve Soyadı:", x, y);
  doc.text(record.employee.fullName || "", x + 27, y);
  y += 4.4;
  doc.text("Diploma Tarih ve No:", x, y);
  y += 4.4;
  doc.text("Diploma Tescil Tarih ve No:", x, y);
  y += 4.4;
  doc.text("İşyeri Hekimliği Belgesi Tarih ve No:", x, y);

  ek2Font(doc, false, 5);
  doc.text("Sayfa 2 / 2", pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.setPage(1);
  ek2Font(doc, false, 5);
  doc.text("Sayfa 1 / 2", pageWidth / 2, pageHeight - 8, { align: "center" });

  const fileName = `${safeFileName(record.employee.fullName || "EK2_Muayene_Formu")}_EK2_Muayene_Formu.pdf`;
  doc.save(fileName);
}
