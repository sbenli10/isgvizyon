import { supabase } from "@/integrations/supabase/client";
import type { Company, Employee } from "@/types/companies";

export type DisciplinaryPenaltyType =
  | "Kuralsız Çalışma"
  | "Atıl Koruyucu / Ekipman"
  | "Geçici Görevli Çalışan"
  | "Diğer";

export type DisciplinaryActionType =
  | "Sözlü Uyarı"
  | "Yazılı İhtar"
  | "Ücret Kesme Cezası"
  | "Yasal Savunma Talebi";

export type DeliveryStatus = "İmzalandı / Teslim aldı" | "İmzadan imtina etti" | "Tebliğ edilemedi";
export type DisciplinaryNoticeType = "employee" | "employer";
export type EmploymentStatusType = "Kadrolu Çalışan" | "Alt İşveren (Taşeron) Çalışanı" | "Geçici Görevli Çalışan";

export interface EmployerIpcRule {
  id: string;
  title: string;
  article: string;
  baseAmount: number;
}

export interface EmployerIpcPenaltyLine {
  id: string;
  ruleId: string;
  article: string;
  title: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
  correctiveAction: string;
}

export interface DisciplinaryRule {
  id: string;
  category: string;
  title: string;
  legalReference: string;
}

export interface DisciplinaryWitness {
  id: string;
  fullName: string;
  jobTitle: string;
}

export interface DisciplinaryNoticeRecord {
  id?: string;
  userId?: string;
  organizationId?: string | null;
  noticeType?: DisciplinaryNoticeType;
  companyId: string;
  companyName: string;
  companyAddress: string;
  workplaceRegistrationNumber: string;
  hazardClass: string;
  employerName: string;
  employeeId?: string | null;
  employeeName: string;
  employeeNationalId: string;
  employeeJobTitle: string;
  employeeDepartment: string;
  employeeStartDate?: string | null;
  employmentStatus: EmploymentStatusType;
  payrollEmployerTitle: string;
  payrollEmployerRegistryNumber: string;
  payrollEmployerRepresentative: string;
  noticeDate: string;
  incidentDate: string;
  incidentTime: string;
  incidentPlace: string;
  incidentDescription: string;
  employeeDefense: string;
  violationType: DisciplinaryPenaltyType;
  penaltyType: DisciplinaryActionType;
  penaltyNote: string;
  wageDeductionAmount: string;
  wageDeductionDayCount: string;
  defensePeriodBusinessDays: string;
  selectedRules: DisciplinaryRule[];
  witnesses: DisciplinaryWitness[];
  deliveryDate: string;
  deliveryStatus: DeliveryStatus;
  logoDataUrl?: string | null;
  ipcEmployeeRange?: string;
  ipcRuleId?: string;
  ipcRuleTitle?: string;
  ipcRuleArticle?: string;
  ipcBaseAmount?: number;
  ipcMultiplier?: number;
  ipcPenaltyAmount?: number;
  ipcPenaltyLines?: EmployerIpcPenaltyLine[];
  ipcExplanation?: string;
  ipcRequestNote?: string;
  status: "Taslak" | "Kaydedildi";
  createdAt?: string;
  updatedAt?: string;
}

type JsPdfConstructor = new (options?: Record<string, unknown>) => any;

const db = supabase as any;

async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }, { addInterFontsToJsPDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("@/utils/fonts"),
  ]);
  return { jsPDF: jsPDF as JsPdfConstructor, autoTable, addInterFontsToJsPDF };
}

export const disciplinaryRuleCatalog: DisciplinaryRule[] = [
  {
    id: "kkd-kullanmama",
    category: "Kişisel Koruyucu Donanım",
    title: "KKD kullanmama",
    legalReference: "6331 s.K. m.19/2-b; KKD Yönetmeliği m.10",
  },
  {
    id: "emniyet-kemeri-takmama",
    category: "Kişisel Koruyucu Donanım",
    title: "Emniyet kemeri takmama (yüksekte çalışma)",
    legalReference: "6331 s.K. m.19/2-b; Yapı İşlerinde İSG Yönetmeliği",
  },
  {
    id: "kkd-amacina-uygun-kullanmama",
    category: "Kişisel Koruyucu Donanım",
    title: "KKD'yi amacına uygun kullanmama / koruma",
    legalReference: "6331 s.K. m.19/2-b; 4857 s.K. m.25-II/(ı)",
  },
  {
    id: "guvenlik-tertibatini-devre-disi-birakma",
    category: "Makine ve Ekipman",
    title: "Güvenlik tertibatını devre dışı bırakma",
    legalReference: "6331 s.K. m.19/2-a,c; 4857 s.K. m.25-II/(ı)",
  },
  {
    id: "yetkisiz-makine-ekipman-kullanimi",
    category: "Makine ve Ekipman",
    title: "Yetkisiz makine/ekipman kullanımı",
    legalReference: "6331 s.K. m.19/2-ç; İş Ekipmanları Yönetmeliği",
  },
  {
    id: "arizali-ekipmanla-calisma",
    category: "Makine ve Ekipman",
    title: "Arızalı ekipmanla çalışmaya devam etme",
    legalReference: "6331 s.K. m.19/2-e",
  },
  {
    id: "ekipmani-talimata-aykiri-kullanma",
    category: "Makine ve Ekipman",
    title: "Ekipmanı talimata aykırı kullanma",
    legalReference: "6331 s.K. m.19/2-a; 4857 s.K. m.25-II/(ı)",
  },
  {
    id: "sigara-acik-alev-yasagi-ihlali",
    category: "Tehlikeli Davranış",
    title: "Sigara / açık alev yasağı ihlali",
    legalReference: "6331 s.K. m.19/1; 4857 s.K. m.25-II/(ı)",
  },
  {
    id: "alkol-uyusturucu-etkisinde-calisma",
    category: "Tehlikeli Davranış",
    title: "Alkol veya uyuşturucu etkisinde çalışma",
    legalReference: "4857 s.K. m.25-II/(d) ve m.84",
  },
  {
    id: "tehlikeli-saka-kavga",
    category: "Tehlikeli Davranış",
    title: "Tehlikeli şaka / kavga",
    legalReference: "6331 s.K. m.19/1; 4857 s.K. m.25-II/(d)",
  },
  {
    id: "yetkisiz-alana-girme",
    category: "Tehlikeli Davranış",
    title: "Yetkisiz alana girme",
    legalReference: "6331 s.K. m.19/1; Sağlık ve Güvenlik İşaretleri Yönetmeliği",
  },
  {
    id: "arac-kullanim-kurallari-ihlali",
    category: "Tehlikeli Davranış",
    title: "Araç kullanım kurallarını ihlal (hız/manevra)",
    legalReference: "6331 s.K. m.19/2-a; işyeri trafik talimatı",
  },
  {
    id: "talimatsiz-calisma",
    category: "Talimat ve Prosedür",
    title: "Çalışma talimatına aykırı çalışma",
    legalReference: "6331 s.K. m.19/1; 4857 s.K. m.25-II/(ı)",
  },
  {
    id: "is-izni-almadan-tehlikeli-is",
    category: "Talimat ve Prosedür",
    title: "İş izni almadan tehlikeli iş yapma",
    legalReference: "6331 s.K. m.19/1; işyeri iş izin prosedürü",
  },
  {
    id: "kilitleme-etiketleme-ihlali",
    category: "Talimat ve Prosedür",
    title: "Kilitleme-etiketleme (LOTO) ihlali",
    legalReference: "6331 s.K. m.19/2-a; İş Ekipmanları Yönetmeliği",
  },
  {
    id: "tehlikeli-durumu-bildirmeme",
    category: "Talimat ve Prosedür",
    title: "Tehlikeli durumu bildirmeme",
    legalReference: "6331 s.K. m.19/2-e",
  },
  {
    id: "ramak-kala-bildirmeme",
    category: "Talimat ve Prosedür",
    title: "Kaza / ramak kala olayını bildirmeme",
    legalReference: "6331 s.K. m.19/2-e; işyeri iç yönetmeliği",
  },
  {
    id: "isg-egitimine-katilmama",
    category: "Eğitim ve Sağlık Gözetimi",
    title: "İSG eğitimine katılmama",
    legalReference: "6331 s.K. m.19/1 ve m.17",
  },
  {
    id: "saglik-gozetiminden-kacinma",
    category: "Eğitim ve Sağlık Gözetimi",
    title: "Sağlık gözetiminden kaçınma",
    legalReference: "6331 s.K. m.19/1 ve m.15",
  },
  {
    id: "acil-cikis-kacis-yolu-kapatma",
    category: "Düzen ve Çevre Güvenliği",
    title: "Acil çıkış / kaçış yolunu kapatma",
    legalReference: "6331 s.K. m.19/1; Acil Durumlar Yönetmeliği",
  },
  {
    id: "calisma-alanini-daginik-birakma",
    category: "Düzen ve Çevre Güvenliği",
    title: "Çalışma alanını tehlikeli şekilde dağınık bırakma",
    legalReference: "6331 s.K. m.19/1; işyeri düzen (5S) talimatı",
  },
  {
    id: "yangin-ekipmani-onunu-kapatma",
    category: "Düzen ve Çevre Güvenliği",
    title: "Yangın söndürücü/ekipman önünü kapatma",
    legalReference: "6331 s.K. m.19/1; Binaların Yangından Korunması Yön.",
  },
];

export const violationTypes: DisciplinaryPenaltyType[] = [
  "Kuralsız Çalışma",
  "Atıl Koruyucu / Ekipman",
  "Geçici Görevli Çalışan",
  "Diğer",
];

export const penaltyTypes: DisciplinaryActionType[] = [
  "Sözlü Uyarı",
  "Yazılı İhtar",
  "Ücret Kesme Cezası",
  "Yasal Savunma Talebi",
];

export const deliveryStatuses: DeliveryStatus[] = ["İmzalandı / Teslim aldı", "İmzadan imtina etti", "Tebliğ edilemedi"];

export const employerIpcEmployeeRanges = ["10'dan Az Çalışan", "10-49 Çalışan", "50 ve Üzeri Çalışan"];

export const employerIpcRuleCatalog: EmployerIpcRule[] = [
  { id: "ipc-4-1-a-genel-tedbir-organizasyon", title: "Genel tedbir ve organizasyon yükümlülüğü", article: "4/1-a", baseAmount: 0 },
  { id: "ipc-4-1-b-tedbirleri-izleme-denetleme", title: "Tedbirleri izleme ve denetleme", article: "4/1-b", baseAmount: 0 },
  { id: "ipc-6-1-a-is-guvenligi-uzmani-gorevlendirmemek", title: "İş güvenliği uzmanı görevlendirmemek", article: "6/1-a", baseAmount: 0 },
  { id: "ipc-6-1-a-isyeri-hekimi-gorevlendirmemek", title: "İşyeri hekimi görevlendirmemek", article: "6/1-a", baseAmount: 0 },
  { id: "ipc-6-1-a-diger-saglik-personeli-gorevlendirmemek", title: "Diğer sağlık personeli görevlendirmemek", article: "6/1-a", baseAmount: 0 },
  { id: "ipc-6-1-b-isg-hizmetleri-arac-gerec-mekan", title: "İSG hizmetleri için araç-gereç-mekân sağlamamak", article: "6/1-b", baseAmount: 0 },
  { id: "ipc-6-1-c-isg-hizmetleri-koordinasyon", title: "İSG hizmetlerinde koordinasyonu sağlamamak", article: "6/1-c", baseAmount: 0 },
  { id: "ipc-6-1-c-yazili-tedbirleri-yerine-getirmemek", title: "Yazılı bildirilen tedbirleri yerine getirmemek", article: "6/1-ç", baseAmount: 0 },
  { id: "ipc-6-1-d-gorevlendirilenleri-riskler-konusunda-bilgilendirmemek", title: "Görevlendirilenleri riskler konusunda bilgilendirmemek", article: "6/1-d", baseAmount: 0 },
  { id: "ipc-8-1-uzman-hekim-hak-yetki-kisitlama", title: "Uzman/hekimin hak ve yetkilerini kısıtlamak", article: "8/1", baseAmount: 0 },
  { id: "ipc-8-6-isg-birimi-kurmamak", title: "İşyeri sağlık ve güvenlik birimini kurmamak", article: "8/6", baseAmount: 0 },
  { id: "ipc-10-1-risk-degerlendirmesi-ilk-tespit", title: "Risk değerlendirmesi yapmamak (ilk tespit)", article: "10/1", baseAmount: 0 },
  { id: "ipc-10-1-risk-degerlendirmesi-devam-eden-ay", title: "Risk değerlendirmesi yapmamak (devam eden her ay)", article: "10/1", baseAmount: 0 },
  { id: "ipc-10-4-kontrol-olcum-inceleme-arastirma", title: "Kontrol, ölçüm, inceleme ve araştırma yapmamak", article: "10/4", baseAmount: 0 },
  { id: "ipc-11-acil-durum-plani-tedbirleri", title: "Acil durum planı ve tedbirleri", article: "11", baseAmount: 0 },
  { id: "ipc-12-tahliye-guvenli-yere-gitmeyi-saglamamak", title: "Tahliye: güvenli yere gitmeyi sağlamamak", article: "12", baseAmount: 0 },
  { id: "ipc-12-tahliye-donanimsiz-calisandan-is-istemek", title: "Tahliye: donanımsız çalışandan işe devam istemek", article: "12", baseAmount: 0 },
  { id: "ipc-12-mudahale-eden-calisani-sorumlu-tutmak", title: "Müdahale eden çalışanı sorumlu tutmak", article: "12", baseAmount: 0 },
  { id: "ipc-14-1-kaza-meslek-hastaligi-kaydi-incelemesi", title: "Kaza/meslek hastalığı kaydı ve incelemesi", article: "14/1", baseAmount: 0 },
  { id: "ipc-14-2-kazayi-sgkya-bildirmemek", title: "Kazayı 3 iş günü içinde SGK'ya bildirmemek", article: "14/2", baseAmount: 0 },
  { id: "ipc-15-1-2-saglik-gozetimi-ise-giris-raporu", title: "Sağlık gözetimi / işe giriş raporu", article: "15/1-2", baseAmount: 0 },
  { id: "ipc-16-calisanlari-bilgilendirmemek", title: "Çalışanları bilgilendirmemek", article: "16", baseAmount: 0 },
  { id: "ipc-17-isg-egitimi-vermemek", title: "İSG eğitimi vermemek", article: "17", baseAmount: 0 },
  { id: "ipc-18-calisan-goruslerini-almamak", title: "Çalışanların görüşlerini almamak", article: "18", baseAmount: 0 },
  { id: "ipc-20-1-calisan-temsilcisi-gorevlendirmemek", title: "Çalışan temsilcisi görevlendirmemek", article: "20/1", baseAmount: 0 },
  { id: "ipc-20-3-temsilci-oneri-tedbir-hakki-ihlali", title: "Temsilcinin öneri/tedbir isteme hakkını ihlal", article: "20/3", baseAmount: 0 },
  { id: "ipc-20-4-temsilci-destek-elemani-haklari-kisitlama", title: "Temsilci/destek elemanı haklarını kısıtlamak", article: "20/4", baseAmount: 0 },
  { id: "ipc-22-1-isg-kurulu-olusturmamak", title: "İSG kurulu oluşturmamak", article: "22/1", baseAmount: 0 },
  { id: "ipc-22-2-3-alt-isveren-kurul-koordinasyonu", title: "Alt işveren kurul koordinasyonu", article: "22/2-3", baseAmount: 0 },
  { id: "ipc-23-2-is-merkezi-yonetimi-bildirim", title: "İş merkezi yönetiminin bildirim yükümlülüğü", article: "23/2", baseAmount: 0 },
  { id: "ipc-24-a-1-denetime-engel-olmak", title: "Ölçüm, inceleme ve denetime engel olmak", article: "24/A-1", baseAmount: 0 },
  { id: "ipc-25-6-isin-durdurulmasinda-ucret-odememek", title: "İşin durdurulmasında ücret ödememek", article: "25/6", baseAmount: 0 },
  { id: "ipc-29-bekra-buyuk-kaza-onleme-politika", title: "Büyük kaza önleme politika belgesi (BEKRA)", article: "29", baseAmount: 0 },
  { id: "ipc-29-bekra-guvenlik-raporu-olmadan-faaliyet", title: "Güvenlik raporu olmadan faaliyete geçmek (BEKRA)", article: "29", baseAmount: 0 },
  { id: "ipc-30-isg-yonetmeliklerine-aykirilik", title: "İSG yönetmeliklerine aykırılık", article: "30", baseAmount: 0 },
  { id: "ipc-26-1-o-ce-belgeli-kkd-temin-etmemek", title: "CE belgeli KKD temin etmemek", article: "26/1-o", baseAmount: 0 },
  { id: "ipc-26-1-o-yer-alti-maden-takip-sistemi-kurmamak", title: "Yer altı maden takip sistemi kurmamak", article: "26/1-ö", baseAmount: 0 },
];

export function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyDisciplinaryNoticeRecord(organizationId?: string | null): DisciplinaryNoticeRecord {
  const today = new Date().toISOString().slice(0, 10);
  return {
    organizationId: organizationId ?? null,
    noticeType: "employee",
    companyId: "",
    companyName: "",
    companyAddress: "",
    workplaceRegistrationNumber: "",
    hazardClass: "",
    employerName: "",
    employeeId: null,
    employeeName: "",
    employeeNationalId: "",
    employeeJobTitle: "",
    employeeDepartment: "",
    employeeStartDate: null,
    employmentStatus: "Kadrolu Çalışan",
    payrollEmployerTitle: "",
    payrollEmployerRegistryNumber: "",
    payrollEmployerRepresentative: "",
    noticeDate: today,
    incidentDate: today,
    incidentTime: "",
    incidentPlace: "",
    incidentDescription: "",
    employeeDefense: "",
    violationType: "Kuralsız Çalışma",
    penaltyType: "Yazılı İhtar",
    penaltyNote: "",
    wageDeductionAmount: "",
    wageDeductionDayCount: "",
    defensePeriodBusinessDays: "3",
    selectedRules: [],
    witnesses: [],
    deliveryDate: today,
    deliveryStatus: "İmzalandı / Teslim aldı",
    logoDataUrl: null,
    ipcEmployeeRange: "10'dan Az Çalışan",
    ipcRuleId: employerIpcRuleCatalog[0]?.id || "",
    ipcRuleTitle: employerIpcRuleCatalog[0]?.title || "",
    ipcRuleArticle: employerIpcRuleCatalog[0]?.article || "",
    ipcBaseAmount: employerIpcRuleCatalog[0]?.baseAmount || 0,
    ipcMultiplier: 1,
    ipcPenaltyAmount: employerIpcRuleCatalog[0]?.baseAmount || 0,
    ipcPenaltyLines: [],
    ipcExplanation: "",
    ipcRequestNote: "",
    status: "Taslak",
  };
}

export function calculateEmployerIpcPenalty(baseAmount = 0, multiplier = 1) {
  const amount = Number(baseAmount || 0) * Number(multiplier || 1);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

export function companyDisplayName(company: Company) {
  return company.company_name || (company as unknown as { name?: string }).name || "Firma";
}

export function getCompanyRegistryNo(company?: Company | null) {
  return company?.sgk_workplace_number || company?.workplace_registration_number || "";
}

export function getEmployeeFullName(employee: Employee) {
  return (employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`).replace(/\s+/g, " ").trim();
}

export function employeeToNoticeFields(employee: Employee) {
  return {
    employeeId: employee.id,
    employeeName: getEmployeeFullName(employee),
    employeeNationalId: employee.tc_number || "",
    employeeJobTitle: employee.job_title || employee.insured_job_name || "",
    employeeDepartment: employee.department || "",
    employeeStartDate: employee.start_date || null,
  };
}

export function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function formatDateTr(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

export function validateDisciplinaryNotice(record: DisciplinaryNoticeRecord) {
  const errors: string[] = [];
  if (!record.companyId) errors.push("Firma seçimi zorunlu.");
  if (!record.employeeName.trim()) errors.push("Çalışan adı soyadı zorunlu.");
  if (!record.incidentDescription.trim()) errors.push("Olay açıklaması zorunlu.");
  if (!record.incidentPlace.trim()) errors.push("Olay yeri zorunlu.");
  if (!record.selectedRules.length) errors.push("En az bir ihlal edilen kural seçilmeli.");
  if (!record.penaltyType) errors.push("Uygulanacak ceza tipi seçilmeli.");
  return errors;
}

export function validateEmployerIpcNotice(record: DisciplinaryNoticeRecord) {
  const errors: string[] = [];
  if (!record.companyId) errors.push("Firma seçimi zorunlu.");
  const penaltyLines = record.ipcPenaltyLines || [];
  if (!penaltyLines.length && !record.ipcRuleTitle?.trim()) errors.push("En az bir ceza kalemi eklenmeli.");
  if (!penaltyLines.length && !record.ipcRuleArticle?.trim()) errors.push("Madde / yasal dayanak zorunlu.");
  if (!Number(record.ipcPenaltyAmount || 0)) errors.push("Toplam tebligat cezası 0 TL olamaz.");
  return errors;
}

export async function loadDisciplinaryNoticeCompanies(): Promise<Company[]> {
  const { data, error } = await db.from("companies").select("*");
  if (error) throw error;
  return ((data || []) as Company[])
    .filter((company) => company.is_active !== false)
    .sort((first, second) => companyDisplayName(first).localeCompare(companyDisplayName(second), "tr"));
}

export async function loadDisciplinaryNoticeEmployees(companyId: string): Promise<Employee[]> {
  if (!companyId) return [];
  const { data, error } = await db
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data || []) as Employee[];
}

export async function saveDisciplinaryNoticeRecord(record: DisciplinaryNoticeRecord, userId: string, organizationId?: string | null) {
  const payload = {
    user_id: userId,
    organization_id: organizationId || record.organizationId || null,
    notice_type: record.noticeType || "employee",
    company_id: record.companyId || null,
    company_name: record.companyName,
    company_address: record.companyAddress,
    workplace_registration_number: record.workplaceRegistrationNumber,
    hazard_class: record.hazardClass,
    employer_name: record.employerName,
    employee_id: record.employeeId || null,
    employee_name: record.employeeName,
    employee_national_id: record.employeeNationalId,
    employee_job_title: record.employeeJobTitle,
    employee_department: record.employeeDepartment,
    employee_start_date: record.employeeStartDate || null,
    employment_status: record.employmentStatus,
    payroll_employer_title: record.payrollEmployerTitle,
    payroll_employer_registry_number: record.payrollEmployerRegistryNumber,
    payroll_employer_representative: record.payrollEmployerRepresentative,
    notice_date: record.noticeDate,
    incident_date: record.incidentDate,
    incident_time: record.incidentTime,
    incident_place: record.incidentPlace,
    incident_description: record.incidentDescription,
    employee_defense: record.employeeDefense,
    violation_type: record.violationType,
    penalty_type: record.penaltyType,
    penalty_note: record.penaltyNote,
    wage_deduction_amount: record.wageDeductionAmount || "",
    wage_deduction_day_count: record.wageDeductionDayCount || "",
    defense_period_business_days: record.defensePeriodBusinessDays || "",
    selected_rules: record.selectedRules,
    witnesses: record.witnesses,
    delivery_date: record.deliveryDate,
    delivery_status: record.deliveryStatus,
    logo_data_url: record.logoDataUrl || null,
    ipc_employee_range: record.ipcEmployeeRange || "",
    ipc_rule_id: record.ipcRuleId || "",
    ipc_rule_title: record.ipcRuleTitle || "",
    ipc_rule_article: record.ipcRuleArticle || "",
    ipc_base_amount: record.ipcBaseAmount || 0,
    ipc_multiplier: record.ipcMultiplier || 1,
    ipc_penalty_amount: record.ipcPenaltyAmount || calculateEmployerIpcPenalty(record.ipcBaseAmount, record.ipcMultiplier),
    ipc_penalty_lines: record.ipcPenaltyLines || [],
    ipc_explanation: record.ipcExplanation || "",
    ipc_request_note: record.ipcRequestNote || "",
    status: "Kaydedildi",
    updated_at: new Date().toISOString(),
  };

  const query = record.id
    ? db.from("disciplinary_notice_records").update(payload).eq("id", record.id).select("*").single()
    : db.from("disciplinary_notice_records").insert(payload).select("*").single();

  const { data: saved, error } = await query;
  if (error) throw error;
  return { ...record, id: saved.id, status: "Kaydedildi" as const, createdAt: saved.created_at, updatedAt: saved.updated_at };
}

function signatureText(title: string, name?: string) {
  return `${title}\n\n${name || "Ad Soyad"}\n\nİmza`;
}

async function generateDisciplinaryNoticePdfLegacy(record: DisciplinaryNoticeRecord) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontsLoaded = addInterFontsToJsPDF(doc);
  const fontName = fontsLoaded ? "Inter" : "helvetica";
  doc.setFont(fontName, "normal");

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(10, 10, 190, 20);
  doc.line(46, 10, 46, 30);
  if (record.logoDataUrl) {
    try {
      doc.addImage(record.logoDataUrl, "PNG", 14, 13, 26, 14, undefined, "FAST");
    } catch {
      // Logo okunamazsa çıktı devam etsin.
    }
  }
  doc.setFont(fontName, "bold");
  doc.setFontSize(11);
  doc.text("İSG CEZA VE TEBLİĞ TUTANAĞI", 123, 19, { align: "center" });
  doc.setFont(fontName, "normal");
  doc.setFontSize(7.5);
  doc.text(record.companyName || "-", 123, 24, { align: "center" });

  autoTable(doc, {
    startY: 36,
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 7, cellPadding: 1.5, textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
    headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "FİRMA VE ÇALIŞAN BİLGİLERİ", colSpan: 4 }]],
    body: [
      ["Firma", record.companyName || "-", "Tehlike Sınıfı", record.hazardClass || "-"],
      ["Adres", record.companyAddress || "-", "SGK Sicil No", record.workplaceRegistrationNumber || "-"],
      ["İşveren / Vekili", record.employerName || "-", "Tutanak Tarihi", formatDateTr(record.noticeDate)],
      ["Çalışan", record.employeeName || "-", "T.C. Kimlik No", record.employeeNationalId || "-"],
      ["Görevi", record.employeeJobTitle || "-", "Bölüm", record.employeeDepartment || "-"],
      ["İşe Giriş Tarihi", formatDateTr(record.employeeStartDate), "Ceza Tipi", record.penaltyType],
    ],
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 68 },
      2: { cellWidth: 34, fontStyle: "bold" },
      3: { cellWidth: 56 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 7, cellPadding: 1.6, valign: "top", textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
    headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "OLAY BİLGİLERİ", colSpan: 2 }]],
    body: [
      ["Olay Tarihi / Saati", `${formatDateTr(record.incidentDate)} ${record.incidentTime || ""}`.trim()],
      ["Olay Yeri", record.incidentPlace || "-"],
      ["Olay Açıklaması", record.incidentDescription || "-"],
      ["Çalışanın Savunması", record.employeeDefense || "Savunma alınmadı / beyan sunulmadı."],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 148 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 6.8, cellPadding: 1.5, valign: "top", textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
    headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
    head: [["#", "İHLAL EDİLEN KURAL", "YASAL / İÇ YÖNERGE DAYANAĞI"]],
    body: record.selectedRules.map((rule, index) => [String(index + 1), `${rule.category} - ${rule.title}`, rule.legalReference || "-"]),
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 100 },
      2: { cellWidth: 80 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 7, cellPadding: 1.6, textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
    headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "CEZA / TEBLİĞ", colSpan: 2 }]],
    body: [
      ["Uygulanacak İşlem", `${record.penaltyType} - ${record.violationType}`],
      ["Ceza Notu", record.penaltyNote || "-"],
      ["Tebliğ Tarihi", formatDateTr(record.deliveryDate)],
      ["Çalışanın İmza Durumu", record.deliveryStatus],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 148 },
    },
  });

  if (record.witnesses.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      theme: "grid",
      margin: { left: 10, right: 10 },
      styles: { font: fontName, fontSize: 7, cellPadding: 1.4, textColor: [15, 23, 42], lineColor: [0, 0, 0], lineWidth: 0.25 },
      headStyles: { fillColor: [238, 242, 248], fontStyle: "bold", textColor: [15, 23, 42] },
      head: [["TANIK", "GÖREVİ"]],
      body: record.witnesses.map((witness) => [witness.fullName, witness.jobTitle || "-"]),
      columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 95 } },
    });
  }

  const finalY = (doc as any).lastAutoTable?.finalY || 205;
  autoTable(doc, {
    startY: Math.max(finalY + 8, 238),
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: { font: fontName, fontSize: 6.8, cellPadding: 2, halign: "center", valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.25, minCellHeight: 25 },
    body: [[signatureText("ÇALIŞAN", record.employeeName), signatureText("İŞVEREN / VEKİLİ", record.employerName), signatureText("İSG YETKİLİSİ")]],
    columnStyles: {
      0: { cellWidth: 190 / 3 },
      1: { cellWidth: 190 / 3 },
      2: { cellWidth: 190 / 3 },
    },
  });

  doc.setFontSize(7);
  doc.setTextColor(90, 96, 110);
  doc.text("Bu tutanak iş sağlığı ve güvenliği kuralları kapsamında bilgilendirme, ihtar ve tebliğ amacıyla düzenlenmiştir.", 105, 285, { align: "center" });
  doc.save(`ISG_Ceza_ve_Teblig_Tutanagi_${safeFileName(record.companyName || "Firma")}_${safeFileName(record.employeeName || "Calisan")}.pdf`);
}

function penaltyCheck(label: DisciplinaryActionType, selected: DisciplinaryActionType) {
  return `${label === selected ? "[X]" : "[ ]"} ${label}`;
}

function addPageNumbers(doc: any, fontName: string) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont(fontName, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(90, 96, 110);
    doc.text(`Sayfa ${page} / ${pageCount}`, 105, 287, { align: "center" });
  }
}

export async function generateDisciplinaryNoticePdf(record: DisciplinaryNoticeRecord) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontsLoaded = addInterFontsToJsPDF(doc);
  const fontName = fontsLoaded ? "Inter" : "helvetica";
  const margin = 10;
  const tableWidth = 190;
  const headerFill: [number, number, number] = [238, 242, 248];
  const commonStyles = {
    font: fontName,
    textColor: [15, 23, 42] as [number, number, number],
    lineColor: [0, 0, 0] as [number, number, number],
    lineWidth: 0.25,
  };

  doc.setFont(fontName, "normal");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, 10, tableWidth, 18);
  doc.line(52, 10, 52, 28);

  if (record.logoDataUrl) {
    try {
      doc.addImage(record.logoDataUrl, "PNG", 16, 12, 28, 13, undefined, "FAST");
    } catch {
      // Logo okunamazsa çıktı devam etsin.
    }
  }

  doc.setFont(fontName, "bold");
  doc.setFontSize(10.5);
  doc.text("İSG İHLALİ CEZA VE TEBLİĞ TUTANAĞI", 126, 20, { align: "center" });

  autoTable(doc, {
    startY: 31,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 5.9, cellPadding: 1.35, valign: "top" },
    body: [
      [
        "6331 sayılı İş Sağlığı ve Güvenliği Kanunu m.19 uyarınca çalışanlar; aldıkları eğitim ve işverenin talimatları doğrultusunda, kendilerinin ve hareketlerinden etkilenen diğer çalışanların sağlık ve güvenliklerini tehlikeye düşürmemekle yükümlüdür. 4857 sayılı İş Kanunu m.25/II kapsamında, işçinin kendi isteği veya savsaması yüzünden işin güvenliğini tehlikeye düşürmesi işveren için haklı fesih nedeni sayılır. Aşağıda bilgileri yer alan çalışanın iş sağlığı ve güvenliği kurallarına aykırı davranışı tespit edilmiş olup işbu tutanak düzenlenerek kendisine tebliğ edilmiştir.",
      ],
    ],
    columnStyles: { 0: { cellWidth: tableWidth } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.35, cellPadding: 1.25 },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "İŞYERİ VE ÇALIŞAN BİLGİLERİ", colSpan: 4 }]],
    body: [
      ["Firma / İşyeri", record.companyName || "-", "Çalışanın Adı Soyadı", record.employeeName || "-"],
      ["SGK Sicil No", record.workplaceRegistrationNumber || "-", "T.C. Kimlik No", record.employeeNationalId || "-"],
      ["Tehlike Sınıfı", record.hazardClass || "-", "Görevi", record.employeeJobTitle || "-"],
      ["İşveren / Vekili", record.employerName || "-", "İşe Giriş Tarihi", formatDateTr(record.employeeStartDate)],
      ["İstihdam Şekli", record.employmentStatus || "Kadrolu Çalışan", "Kadro İşvereni", record.payrollEmployerTitle || "-"],
      ["Kadro SGK Sicil No", record.payrollEmployerRegistryNumber || "-", "Kadro İşveren/Vekili", record.payrollEmployerRepresentative || "-"],
    ],
    columnStyles: {
      0: { cellWidth: 33, fontStyle: "bold" },
      1: { cellWidth: 67 },
      2: { cellWidth: 39, fontStyle: "bold" },
      3: { cellWidth: 51 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.2, cellPadding: 1.2 },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "OLAY BİLGİLERİ", colSpan: 8 }]],
    body: [[
      "Olay Tarihi",
      formatDateTr(record.incidentDate),
      "Olay Saati",
      record.incidentTime || "-",
      "Olay Yeri",
      record.incidentPlace || "-",
      "Tutanak Tarihi",
      formatDateTr(record.noticeDate),
    ]],
    columnStyles: {
      0: { cellWidth: 20, fontStyle: "bold" },
      1: { cellWidth: 27 },
      2: { cellWidth: 20, fontStyle: "bold" },
      3: { cellWidth: 22 },
      4: { cellWidth: 18, fontStyle: "bold" },
      5: { cellWidth: 40 },
      6: { cellWidth: 22, fontStyle: "bold" },
      7: { cellWidth: 21 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 5.9, cellPadding: 1.25, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "TESPİT EDİLEN İHLALLER", colSpan: 3 }], ["#", "İhlal / Aykırı Davranış", "Yasal Dayanak"]],
    body: record.selectedRules.map((rule, index) => [String(index + 1), rule.title, rule.legalReference || "-"]),
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 122 },
      2: { cellWidth: 58 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.2, cellPadding: 1.25 },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "UYGULANAN YAPTIRIM", colSpan: 4 }]],
    body: [[
      penaltyCheck("Sözlü Uyarı", record.penaltyType),
      penaltyCheck("Yazılı İhtar", record.penaltyType),
      penaltyCheck("Ücret Kesme Cezası", record.penaltyType),
      penaltyCheck("Yasal Savunma Talebi", record.penaltyType),
    ]],
    columnStyles: {
      0: { cellWidth: 47.5 },
      1: { cellWidth: 47.5 },
      2: { cellWidth: 47.5 },
      3: { cellWidth: 47.5 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.15, cellPadding: 1.2 },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "TANIKLAR", colSpan: 4 }], ["#", "Ad Soyadı", "Görevi", "İmza"]],
    body: (record.witnesses.length ? record.witnesses : [{ id: "empty", fullName: "-", jobTitle: "" }]).map((witness, index) => [
      String(index + 1),
      witness.fullName || "-",
      witness.jobTitle || "-",
      "",
    ]),
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 75 },
      2: { cellWidth: 65 },
      3: { cellWidth: 40 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 5.95, cellPadding: 1.3, valign: "top" },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "TEBLİĞ / TEBELLÜĞ", colSpan: 1 }]],
    body: [[
      `İşbu tutanak iki nüsha düzenlenmiş olup bir nüshası aşağıda belirtilen tarihte çalışana elden teslim edilmiştir.\n[ ] Tutanak okudum, bir nüshasını teslim aldım.   Tebliğ Tarihi: ${formatDateTr(record.deliveryDate)}   Durum: ${record.deliveryStatus}`,
    ]],
    columnStyles: { 0: { cellWidth: tableWidth } },
  });

  const explanation = [
    record.incidentDescription ? `Olay Açıklaması: ${record.incidentDescription}` : "",
    record.employeeDefense ? `Çalışan Savunması: ${record.employeeDefense}` : "",
    record.penaltyType === "Ücret Kesme Cezası" && (record.wageDeductionAmount || record.wageDeductionDayCount)
      ? `Ücret Kesme Bilgisi: ${record.wageDeductionAmount || "-"} TL / ${record.wageDeductionDayCount || "-"} gündelik`
      : "",
    record.penaltyType === "Yasal Savunma Talebi" && record.defensePeriodBusinessDays
      ? `Savunma Süresi: ${record.defensePeriodBusinessDays} iş günü`
      : "",
    record.penaltyNote ? `İşlem Notu: ${record.penaltyNote}` : "",
  ].filter(Boolean).join("\n");

  if (explanation) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 3,
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: { ...commonStyles, fontSize: 5.6, cellPadding: 1.2, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
      head: [[{ content: "AÇIKLAMA / SAVUNMA", colSpan: 1 }]],
      body: [[explanation]],
      columnStyles: { 0: { cellWidth: tableWidth } },
    });
  }

  if (record.employmentStatus && record.employmentStatus !== "Kadrolu Çalışan") {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 3,
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: { ...commonStyles, fontSize: 5.75, cellPadding: 1.25, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: [255, 247, 237], fontStyle: "bold", textColor: [124, 45, 18] },
      head: [[{ content: "ALT İŞVEREN / GEÇİCİ GÖREVLİ ŞERHİ", colSpan: 1 }]],
      body: [[
        "Bu tutanak olayın gerçekleştiği işyerindeki tespit ve bildirim amacıyla düzenlenmiştir. Yazılı ihtar, savunma isteme ve ücret kesme gibi disiplin yaptırımlarını uygulama yetkisi çalışanın iş sözleşmesinin tarafı olan kadro işverenine aittir.",
      ]],
      columnStyles: { 0: { cellWidth: tableWidth } },
    });
  }

  const finalY = (doc as any).lastAutoTable?.finalY || 215;
  const primaryEmployerSignatureTitle = record.employmentStatus && record.employmentStatus !== "Kadrolu Çalışan" ? "KADRO İŞVERENİ / VEKİLİ" : "İŞVEREN / VEKİLİ";
  const primaryEmployerSignatureName = record.employmentStatus && record.employmentStatus !== "Kadrolu Çalışan"
    ? record.payrollEmployerRepresentative || record.payrollEmployerTitle
    : record.employerName;
  autoTable(doc, {
    startY: Math.max(finalY + 6, 242),
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.2, cellPadding: 2, halign: "center", valign: "middle", minCellHeight: 24 },
    body: [[
      signatureText(primaryEmployerSignatureTitle, primaryEmployerSignatureName),
      signatureText("DÜZENLEYEN (İSG UZMANI)"),
      signatureText("ÇALIŞAN (TEBELLÜĞ EDEN)", record.employeeName),
    ]],
    columnStyles: {
      0: { cellWidth: tableWidth / 3 },
      1: { cellWidth: tableWidth / 3 },
      2: { cellWidth: tableWidth / 3 },
    },
  });

  addPageNumbers(doc, fontName);
  doc.save(`ISG_Ceza_ve_Teblig_Tutanagi_${safeFileName(record.companyName || "Firma")}_${safeFileName(record.employeeName || "Calisan")}.pdf`);
}

function formatCurrencyTr(value?: number) {
  return `${Number(value || 0).toLocaleString("tr-TR")} TL`;
}

export async function generateEmployerIpcNoticePdf(record: DisciplinaryNoticeRecord) {
  const { jsPDF, autoTable, addInterFontsToJsPDF } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontsLoaded = addInterFontsToJsPDF(doc);
  const fontName = fontsLoaded ? "Inter" : "helvetica";
  const margin = 10;
  const tableWidth = 190;
  const headerFill: [number, number, number] = [238, 242, 248];
  const commonStyles = {
    font: fontName,
    textColor: [15, 23, 42] as [number, number, number],
    lineColor: [0, 0, 0] as [number, number, number],
    lineWidth: 0.25,
  };

  doc.setFont(fontName, "normal");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, 10, tableWidth, 18);
  doc.line(52, 10, 52, 28);

  if (record.logoDataUrl) {
    try {
      doc.addImage(record.logoDataUrl, "PNG", 16, 12, 28, 13, undefined, "FAST");
    } catch {
      // Logo okunamazsa çıktı devam etsin.
    }
  }

  doc.setFont(fontName, "bold");
  doc.setFontSize(10.5);
  doc.text("İŞVERENE İDARİ PARA CEZASI TEBLİĞİ", 126, 18, { align: "center" });
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.text(record.companyName || "-", 126, 23, { align: "center" });

  autoTable(doc, {
    startY: 31,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 5.9, cellPadding: 1.35, valign: "top" },
    body: [[
      "6331 sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında işverenin yerine getirmekle yükümlü olduğu hususlarda tespit edilen aykırılık aşağıda belirtilmiştir. Bu belge, resmi ceza tutanağı yerine geçmez; işverene bilgilendirme, takip ve düzeltici faaliyet amacıyla hazırlanmış iç tebliğ niteliğindedir.",
    ]],
    columnStyles: { 0: { cellWidth: tableWidth } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.3, cellPadding: 1.25 },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "FİRMA VE TEBLİGAT BİLGİLERİ", colSpan: 4 }]],
    body: [
      ["Firma / İşyeri", record.companyName || "-", "İşveren / Vekili", record.employerName || "-"],
      ["Adres", record.companyAddress || "-", "SGK Sicil No", record.workplaceRegistrationNumber || "-"],
      ["Tehlike Sınıfı", record.hazardClass || "-", "Çalışan Sayısı Aralığı", record.ipcEmployeeRange || "-"],
      ["Düzenleyen (İSG Uzmanı)", record.employeeName || "-", "Tebliğ Tarihi", formatDateTr(record.deliveryDate)],
    ],
    columnStyles: {
      0: { cellWidth: 34, fontStyle: "bold" },
      1: { cellWidth: 66 },
      2: { cellWidth: 39, fontStyle: "bold" },
      3: { cellWidth: 51 },
    },
  });

  const ipcPenaltyLines = record.ipcPenaltyLines?.length
    ? record.ipcPenaltyLines
    : [{
        id: "legacy",
        ruleId: record.ipcRuleId || "",
        article: record.ipcRuleArticle || "-",
        title: record.ipcRuleTitle || "-",
        quantity: 1,
        unitAmount: record.ipcBaseAmount || 0,
        lineTotal: record.ipcPenaltyAmount || 0,
        correctiveAction: record.ipcExplanation || "",
      }];

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 5.9, cellPadding: 1.15, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "CEZA KALEMLERİ", colSpan: 6 }], ["#", "Madde", "Ceza Kalemi", "Adet", "Tutar", "Satır Tutarı"]],
    body: ipcPenaltyLines.map((line, index) => [
      String(index + 1),
      line.article || "-",
      `${line.title || "-"}${line.correctiveAction ? `\nAçıklama: ${line.correctiveAction}` : ""}`,
      String(line.quantity || 1),
      formatCurrencyTr(line.unitAmount),
      formatCurrencyTr(line.lineTotal),
    ]),
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 24 },
      2: { cellWidth: 88 },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 28 },
      5: { cellWidth: 28 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.2, cellPadding: 1.2 },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    body: [["Artırım Katsayısı", `${record.ipcMultiplier || 1}x`, "Toplam Tebligat Cezası", formatCurrencyTr(record.ipcPenaltyAmount), "Tebliğ Belge Tarihi", formatDateTr(record.noticeDate)]],
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 22 },
      2: { cellWidth: 42, fontStyle: "bold" },
      3: { cellWidth: 44 },
      4: { cellWidth: 28, fontStyle: "bold" },
      5: { cellWidth: 22 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.05, cellPadding: 1.35, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "AÇIKLAMA VE TALEP", colSpan: 1 }]],
    body: [[
      record.ipcExplanation ||
        "Yukarıda belirtilen aykırılığın 15 gün içinde giderilmesi, eksik belge ve uygulamaların tamamlanarak İSG birimine yazılı dönüş yapılması rica olunur.",
    ]],
    columnStyles: { 0: { cellWidth: tableWidth, minCellHeight: 24 } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.05, cellPadding: 1.35, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: headerFill, fontStyle: "bold", textColor: [15, 23, 42] },
    head: [[{ content: "İŞVEREN BEYANI / TAKİP NOTU", colSpan: 1 }]],
    body: [[record.ipcRequestNote || "İşveren tarafından yapılacak açıklama ve alınan aksiyonlar bu alana işlenir."]],
    columnStyles: { 0: { cellWidth: tableWidth, minCellHeight: 22 } },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 190;
  autoTable(doc, {
    startY: Math.max(finalY + 8, 228),
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { ...commonStyles, fontSize: 6.2, cellPadding: 2, halign: "center", valign: "middle", minCellHeight: 34 },
    body: [[
      signatureText("İŞVEREN / VEKİLİ", record.employerName),
      signatureText("DÜZENLEYEN (İSG UZMANI)", record.employeeName),
      signatureText("TEBLİĞ ALAN"),
    ]],
    columnStyles: {
      0: { cellWidth: tableWidth / 3 },
      1: { cellWidth: tableWidth / 3 },
      2: { cellWidth: tableWidth / 3 },
    },
  });

  addPageNumbers(doc, fontName);
  doc.save(`Isverene_IPC_Tebligi_${safeFileName(record.companyName || "Firma")}.pdf`);
}


