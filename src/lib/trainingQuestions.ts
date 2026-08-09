import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Company, Employee } from "@/types/companies";
import { addInterFontsToJsPDF } from "@/utils/fonts";

export type QuestionDifficulty = "Kolay" | "Orta" | "Zor" | "Karışık";
export type ExamType = "Önce" | "Sonra";

export interface TrainingQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
}

export interface QuestionParticipant {
  id: string;
  fullName: string;
  nationalId: string;
}

export interface TrainingQuestionSet {
  id?: string;
  sector: string;
  difficulty: QuestionDifficulty;
  title: string;
  examType: ExamType;
  examDate: string;
  companyId: string;
  companyName: string;
  employeeName: string;
  employeeNationalId: string;
  questions: TrainingQuestion[];
  participants: QuestionParticipant[];
  status: "Taslak" | "Kaydedildi" | "PDF hazır";
}

export interface QuestionHistoryItem {
  id: string;
  title: string;
  sector: string;
  difficulty: QuestionDifficulty;
  companyName: string;
  questionCount: number;
  examDate: string | null;
  updatedAt: string;
}

const sectorOptions = [
  "Genel İSG",
  "İnşaat",
  "Metal / Demir-Çelik",
  "Gıda Üretimi",
  "Tekstil",
  "Maden",
  "Kimya / Petrokimya",
  "Sağlık / Hastane",
  "Eğitim",
  "Lojistik / Depoculuk",
  "Otomotiv",
  "Enerji / Elektrik",
  "Tarım / Hayvancılık",
  "Mobilya / Ağaç İşleri",
  "Plastik / Kauçuk",
  "Cam / Seramik",
  "Matbaa / Ambalaj",
  "Otel / Turizm",
  "Perakende / AVM",
  "Doğalgaz / LPG",
  "İtfaiye / Kurtarma",
];

export { sectorOptions as trainingQuestionSectors };

export const difficultyOptions: QuestionDifficulty[] = ["Kolay", "Orta", "Zor", "Karışık"];

export function createQuestionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `question-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyQuestionSet(): TrainingQuestionSet {
  return {
    sector: "Tekstil",
    difficulty: "Karışık",
    title: "İSG Eğitim Sınavı",
    examType: "Sonra",
    examDate: new Date().toISOString().slice(0, 10),
    companyId: "",
    companyName: "",
    employeeName: "",
    employeeNationalId: "",
    questions: [],
    participants: [],
    status: "Taslak",
  };
}

export function createEmptyQuestion(): TrainingQuestion {
  return {
    id: createQuestionId(),
    question: "",
    options: ["", "", "", ""],
    correctAnswer: "A",
    explanation: "",
  };
}

function companyName(company: any) {
  return company.company_name || company.companyName || company.name || "Firma";
}

async function loadQuestionCompaniesLegacy(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_active", true)
    .order("company_name", { ascending: true });

  if (error) throw new Error("Firma listesi yüklenemedi.");
  return (data || []) as unknown as Company[];
}

async function tryQuestionRows(builder: any) {
  const { data, error } = await builder;
  if (error) return [];
  return data || [];
}

function normalizeQuestionCompany(row: any, source: "companies" | "isgkatip_companies") {
  const name = companyName(row);
  return {
    ...row,
    company_name: name,
    name,
    __source: source,
  } as Company & { __source?: string };
}

export async function loadQuestionCompanies(organizationId?: string | null): Promise<Company[]> {
  const standardRows = await tryQuestionRows(
    supabase
      .from("companies")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  );

  let fallbackStandardRows: any[] = [];
  if (!standardRows.length) {
    fallbackStandardRows = await tryQuestionRows(
      supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false }),
    );
  }

  const osgbQuery = (supabase as any)
    .from("isgkatip_companies")
    .select("id, company_name, sgk_no, hazard_class, employee_count, service_receiver_city, org_id, is_deleted")
    .eq("is_deleted", false)
    .order("company_name", { ascending: true });

  const osgbRows = await tryQuestionRows(
    organizationId ? osgbQuery.eq("org_id", organizationId) : osgbQuery,
  );

  const osgbFallbackRows = organizationId && !osgbRows.length
    ? await tryQuestionRows(
        (supabase as any)
          .from("isgkatip_companies")
          .select("id, company_name, sgk_no, hazard_class, employee_count, service_receiver_city, org_id, is_deleted")
          .eq("is_deleted", false)
          .order("company_name", { ascending: true }),
      )
    : [];

  const unique = new Map<string, Company>();
  [...standardRows, ...fallbackStandardRows]
    .map((row) => normalizeQuestionCompany(row, "companies"))
    .concat([...osgbRows, ...osgbFallbackRows].map((row: any) => normalizeQuestionCompany(row, "isgkatip_companies")))
    .forEach((company) => {
      if (!company.id || unique.has(company.id)) return;
      unique.set(company.id, company);
    });

  return Array.from(unique.values()).sort((a, b) => companyName(a).localeCompare(companyName(b), "tr-TR"));
}

async function loadQuestionEmployeesLegacy(companyId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw new Error("Firma çalışanları yüklenemedi.");
  return (data || []) as unknown as Employee[];
}

export async function loadQuestionEmployees(companyId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const standardEmployees = error ? [] : data || [];
  if (standardEmployees.length) return standardEmployees as unknown as Employee[];

  const { data: osgbData, error: osgbError } = await (supabase as any)
    .from("osgb_company_employees")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error && osgbError) throw new Error("Firma çalışanları yüklenemedi.");

  return ((osgbData || []) as any[]).map((employee) => ({
    ...employee,
    first_name: employee.first_name || String(employee.full_name || "").split(" ")[0] || "",
    last_name: employee.last_name || String(employee.full_name || "").split(" ").slice(1).join(" "),
    job_title: employee.job_title || employee.position || "",
    start_date: employee.start_date || "",
  })) as unknown as Employee[];
}

export function employeeToQuestionParticipant(employee: Employee): QuestionParticipant {
  const fullName = employee.full_name || [employee.first_name, employee.last_name].filter(Boolean).join(" ");
  return {
    id: employee.id,
    fullName,
    nationalId: employee.tc_number || "",
  };
}

export async function generateTrainingQuestions(sector: string, difficulty: QuestionDifficulty) {
  const { data, error } = await supabase.functions.invoke("training-questions-generate", {
    body: { sector, difficulty, count: 10 },
  });

  if (error) throw new Error(error.message || "Eğitim soruları oluşturulamadı.");
  if (!data?.success) throw new Error(data?.error?.message || "Eğitim soruları oluşturulamadı.");

  return (data.questions || []).map((question: Omit<TrainingQuestion, "id">) => ({
    ...question,
    id: createQuestionId(),
  })) as TrainingQuestion[];
}

export function loadTemplateQuestions(sector: string, difficulty: QuestionDifficulty): TrainingQuestion[] {
  const base = [
    "Çalışanın iş sağlığı ve güvenliği kurallarına uymadaki temel sorumluluğu nedir?",
    "Risk değerlendirmesi sonucunda belirlenen önlemler neden takip edilmelidir?",
    "Kişisel koruyucu donanım hangi durumda kullanılmalıdır?",
    "Acil durumda çalışanların ilk yapması gereken doğru davranış nedir?",
    "Ramak kala olaylarının bildirilmesi neden önemlidir?",
    "Yangın söndürücülerin önünün kapatılması hangi riski artırır?",
    "Güvenlik işaretleri işyerinde hangi amaçla kullanılır?",
    "Çalışma alanında düzen ve temizlik neden İSG açısından önemlidir?",
    "Yetkisiz makine kullanımı hangi sonucu doğurabilir?",
    "İSG eğitimlerinin yenilenmesi neden gereklidir?",
  ];

  return base.map((question, index) => ({
    id: createQuestionId(),
    question: `${sector} alanında ${question}`,
    options: [
      "Kuralları sadece denetim günlerinde uygulamak",
      "Talimatlara uymak, tehlikeleri bildirmek ve güvenli çalışmak",
      "Sadece yöneticinin yanında dikkatli davranmak",
      "Riskleri kendi başına yok saymak",
    ],
    correctAnswer: "B",
    explanation: `${difficulty} seviyesinde temel güvenli çalışma davranışı ölçülür.`,
    index,
  })).map(({ index: _index, ...item }) => item);
}

export async function saveQuestionSet(record: TrainingQuestionSet, userId: string, organizationId?: string | null) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || null,
    company_id: record.companyId || null,
    company_name: record.companyName,
    sector: record.sector,
    difficulty: record.difficulty,
    title: record.title || "İSG Eğitim Sınavı",
    exam_type: record.examType,
    exam_date: record.examDate || null,
    employee_name: record.employeeName,
    employee_national_id: record.employeeNationalId,
    questions: record.questions,
    participants: record.participants,
    source: "app",
    status: record.status,
  };

  const query = record.id
    ? supabase.from("training_question_sets" as any).update(payload).eq("id", record.id).select("*").single()
    : supabase.from("training_question_sets" as any).insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw new Error("Soru seti kaydedilemedi.");
  return rowToQuestionSet(data);
}

export async function loadQuestionHistory(): Promise<QuestionHistoryItem[]> {
  const { data, error } = await supabase
    .from("training_question_sets" as any)
    .select("id,title,sector,difficulty,company_name,questions,exam_date,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error("Soru geçmişi yüklenemedi.");

  return ((data || []) as any[]).map((row) => ({
    id: row.id,
    title: row.title || "İSG Eğitim Sınavı",
    sector: row.sector || "Genel",
    difficulty: row.difficulty || "Karışık",
    companyName: row.company_name || "",
    questionCount: Array.isArray(row.questions) ? row.questions.length : 0,
    examDate: row.exam_date,
    updatedAt: row.updated_at,
  }));
}

export async function loadQuestionSet(id: string): Promise<TrainingQuestionSet> {
  const { data, error } = await supabase
    .from("training_question_sets" as any)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error("Soru seti açılamadı.");
  return rowToQuestionSet(data);
}

function rowToQuestionSet(row: any): TrainingQuestionSet {
  return {
    id: row.id,
    sector: row.sector || "Genel İSG",
    difficulty: row.difficulty || "Karışık",
    title: row.title || "İSG Eğitim Sınavı",
    examType: row.exam_type || "Sonra",
    examDate: row.exam_date || "",
    companyId: row.company_id || "",
    companyName: row.company_name || "",
    employeeName: row.employee_name || "",
    employeeNationalId: row.employee_national_id || "",
    questions: Array.isArray(row.questions) ? row.questions.map((item: any) => ({ ...item, id: item.id || createQuestionId() })) : [],
    participants: Array.isArray(row.participants) ? row.participants : [],
    status: row.status || "Taslak",
  };
}

export function downloadQuestionExcelTemplate() {
  const rows = [
    ["Soru", "A", "B", "C", "D", "Doğru Cevap", "Açıklama"],
    ["İşyerinde tehlikeli bir durum fark edildiğinde ne yapılmalıdır?", "Görmezden gelinir", "Yetkili kişiye bildirilir", "Sosyal medyada paylaşılır", "İş bitince bakılır", "B", "Tehlikeli durumlar zaman kaybetmeden bildirilmelidir."],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sorular");
  XLSX.writeFile(book, "egitim-sorulari-sablonu.xlsx");
}

export async function parseQuestionsExcel(file: File): Promise<TrainingQuestion[]> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .map((row) => {
      const question = String(row["Soru"] || row["soru"] || "").trim();
      const options = ["A", "B", "C", "D"].map((key) => String(row[key] || "").trim());
      const correctAnswer = String(row["Doğru Cevap"] || row["Dogru Cevap"] || "A").trim().toUpperCase();
      if (!question || options.some((option) => !option) || !["A", "B", "C", "D"].includes(correctAnswer)) return null;
      return {
        id: createQuestionId(),
        question,
        options,
        correctAnswer: correctAnswer as TrainingQuestion["correctAnswer"],
        explanation: String(row["Açıklama"] || row["Aciklama"] || "").trim(),
      };
    })
    .filter((item): item is TrainingQuestion => Boolean(item));
}

export function validateQuestionSet(record: TrainingQuestionSet) {
  if (!record.questions.length) return "PDF için en az bir soru ekleyin.";
  if (record.questions.some((question) => !question.question.trim() || question.options.some((option) => !option.trim()))) {
    return "Tüm soruların metni ve dört seçeneği dolu olmalı.";
  }
  return "";
}

export function generateQuestionPdf(record: TrainingQuestionSet, includeAnswerKey = false) {
  const doc = new jsPDF("p", "mm", "a4");
  const pdfFont = addInterFontsToJsPDF(doc) ? "Inter" : "helvetica";
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const letters = ["A", "B", "C", "D"];
  const participants = record.participants.length
    ? record.participants
    : [{ id: "single", fullName: record.employeeName, nationalId: record.employeeNationalId }];

  participants.forEach((participant, participantIndex) => {
    if (participantIndex > 0) doc.addPage();

    doc.setFillColor(88, 28, 135);
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont(pdfFont, "bold");
    doc.setFontSize(15);
    doc.text(record.title || "İSG Eğitim Sınavı", margin, 12);
    doc.setFontSize(9);
    doc.text(`${record.sector} • ${record.difficulty} • ${record.examType} sınav`, margin, 19);

    doc.setTextColor(15, 23, 42);
    autoTable(doc, {
      startY: 34,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { font: pdfFont, fontSize: 8, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.2 },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
      body: [
        ["Ad Soyad", participant.fullName || record.employeeName || ""],
        ["T.C. Kimlik No", participant.nationalId || record.employeeNationalId || ""],
        ["Firma", record.companyName || ""],
        ["Sınav Tarihi", record.examDate || ""],
      ],
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 }, 1: { cellWidth: 140 } },
    });

    let y = ((doc as any).lastAutoTable?.finalY || 60) + 7;
    record.questions.forEach((question, index) => {
      if (y > 250) {
        doc.addPage();
        y = 18;
      }

      doc.setFont(pdfFont, "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const questionLines = doc.splitTextToSize(`${index + 1}. ${question.question}`, pageWidth - margin * 2);
      doc.text(questionLines, margin, y);
      y += questionLines.length * 5 + 2;

      doc.setFont(pdfFont, "normal");
      question.options.forEach((option, optionIndex) => {
        const optionLines = doc.splitTextToSize(`${letters[optionIndex]}) ${option}`, pageWidth - margin * 2 - 6);
        doc.text(optionLines, margin + 4, y);
        y += optionLines.length * 4.5;
      });
      y += 4;
    });

    if (y > 236) {
      doc.addPage();
      y = 22;
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { font: pdfFont, fontSize: 8, cellPadding: 2.5, lineColor: [148, 163, 184], lineWidth: 0.2 },
      body: [
        ["Toplam Doğru", "", "Puan", ""],
        ["Çalışan İmza", "", "Değerlendiren", ""],
      ],
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 35 },
        1: { cellWidth: 55, minCellHeight: 14 },
        2: { fontStyle: "bold", cellWidth: 35 },
        3: { cellWidth: 55, minCellHeight: 14 },
      },
    });
  });

  if (includeAnswerKey) {
    doc.addPage();
    doc.setFont(pdfFont, "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("Cevap Anahtarı", margin, 18);
    autoTable(doc, {
      startY: 24,
      margin: { left: margin, right: margin },
      head: [["No", "Doğru Cevap", "Açıklama"]],
      body: record.questions.map((question, index) => [String(index + 1), question.correctAnswer, question.explanation || "-"]),
      theme: "grid",
      styles: { font: pdfFont, fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 28 }, 2: { cellWidth: 130 } },
    });
  }

  const fileName = `${(record.title || "egitim-sinavi").replace(/[^\p{L}\p{N}]+/gu, "-")}.pdf`;
  doc.save(fileName);
}

export function getCompanyDisplayName(company: Company) {
  return companyName(company);
}
