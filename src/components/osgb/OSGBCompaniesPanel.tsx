import { useCallback, useEffect, useMemo, useState } from "react";
import { utils as xlsxUtils, writeFile, read, type WorkSheet } from "xlsx";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  Edit2,
  FileSpreadsheet,
  Grid2X2,
  List,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  deleteOsgbManagedCompany,
  listOsgbCompanyTrackingWorkspace,
  listOsgbWorkspacePersonnel,
  upsertOsgbManagedCompaniesFromExcel,
  upsertOsgbManagedCompany,
  type OsgbCompanyManagementInput,
  type OsgbManagedCompanyRecord,
  type OsgbWorkspacePersonnelRecord,
} from "@/lib/osgbPlatform";

type CompanyStatusFilter = "all" | "approved" | "pending_personnel" | "pending_workplace" | "zero_employees" | "missing_contract" | "planned";
type ViewMode = "list" | "grid";
type SortMode = "title" | "employee_desc" | "fee_desc";
type AssignmentStatus = NonNullable<OsgbCompanyManagementInput["assignmentApprovalStatus"]> | "automatic";

type PersistedAssignmentStatus = Exclude<AssignmentStatus, "automatic">;

const toPersistedAssignmentStatus = (
  value: AssignmentStatus,
): PersistedAssignmentStatus | null => {
  return value === "automatic" ? null : value;
};

const getCompanyDeficitMinutes = (company: OsgbManagedCompanyRecord) =>
  Math.max(
    0,
    Number(company.totalRequiredMinutes || 0) -
      Number(company.totalAssignedMinutes || 0),
  );
type CompanyFormState = {
  companyName: string;
  branchName: string;
  sgkNo: string;
  taxNumber: string;
  employeeCount: string;
  hazardClass: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
  naceCode: string;
  contractStart: string;
  contractEnd: string;
  monthlyFee: string;
  assignmentApprovalStatus: AssignmentStatus;
  visitFrequency: string;
  notes: string;
};

type BulkPreviewRow = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  input: OsgbCompanyManagementInput | null;
};

const inputClass = "h-9 border-slate-700/70 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/40";
const fieldClass = "mt-2 rounded-xl border-slate-700 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/40";
const selectTriggerClass = "h-9 min-w-[128px] border-slate-700/70 bg-slate-900/70 text-xs font-bold text-slate-100 focus:ring-blue-500/40";
const selectContentClass = "z-[130] border-slate-700 bg-slate-900 text-slate-100";

const assignmentStatusOptions = [
  { value: "automatic", label: "Otomatik (Atamalara göre)" },
  { value: "approved", label: "🟢 Tam Onaylı" },
  { value: "pending_personnel", label: "🟡 Personel Onayı Bekleniyor" },
  { value: "pending_workplace", label: "🟡 İşyeri Onayı Bekleniyor" },
  { value: "missing_contract", label: "🔴 İSG Profesyoneli Sözleşmesi Yok" },
  { value: "zero_employees", label: "🟣 Çalışan Sayısı 0" },
  { value: "planned", label: "🔵 Planlanan Atamalar" },
] as const;

const visitFrequencyOptions = [
  { value: "monthly_once", label: "Ayda 1 Defa" },
  { value: "monthly_twice", label: "Ayda 2 Defa" },
  { value: "monthly_three", label: "Ayda 3 Defa" },
  { value: "monthly_four", label: "Ayda 4 Defa" },
  { value: "weekly_once", label: "Her Hafta 1 Defa" },
  { value: "weekly_twice", label: "Her Hafta 2 Defa" },
  { value: "weekly_three", label: "Her Hafta 3 Defa" },
  { value: "every_two_months", label: "2 Ayda 1" },
  { value: "every_three_months", label: "3 Ayda 1" },
  { value: "every_four_months", label: "4 Ayda 1" },
] as const;

const templateHeaders = [
  "Firma Unvanı",
  "Takma Ad",
  "SGK Sicil No",
  "Vergi No",
  "Çalışan Sayısı",
  "Tehlike Sınıfı",
  "Adres Bilgisi",
  "Telefon",
  "E-posta",
  "Yetkili Kişi",
  "NACE Kodu",
  "Sözleşme Başlangıcı",
  "Sözleşme Bitişi",
  "Aylık Hizmet Bedeli",
  "Atama Durumu",
  "Ziyaret Sıklığı",
  "Notlar",
];

const emptyForm: CompanyFormState = {
  companyName: "",
  branchName: "",
  sgkNo: "",
  taxNumber: "",
  employeeCount: "0",
  hazardClass: "Tehlikeli",
  address: "",
  phone: "",
  email: "",
  contactName: "",
  naceCode: "",
  contractStart: "",
  contractEnd: "",
  monthlyFee: "",
  assignmentApprovalStatus: "automatic",
  visitFrequency: "monthly_once",
  notes: "",
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

const COMPANY_FIELD_ALIASES = {
  companyName: ["Firma Unvanı", "Firma Ünvanı", "Firma Adı", "Firma Adi", "Şirket Adı", "Sirket Adi", "İşyeri Adı", "Isyeri Adi", "Ünvan", "Unvan", "Company Name", "company_name", "firm name"],
  branchName: ["Takma Ad", "Şube", "Sube", "Şube Adı", "Sube Adi", "Branch", "branch_name", "kısa ad", "kisa ad"],
  sgkNo: ["SGK Sicil No", "SGK No", "SGK", "İşyeri Sicil No", "Isyeri Sicil No", "Sicil No", "Workplace Registration No", "sgk_no", "sgkno"],
  taxNumber: ["Vergi No", "Vergi Numarası", "Vergi Numarasi", "VKN", "Tax No", "tax_number"],
  employeeCount: ["Çalışan Sayısı", "Calisan Sayisi", "Personel Sayısı", "Personel Sayisi", "İşçi Sayısı", "Isci Sayisi", "Employee Count", "employee_count"],
  hazardClass: ["Tehlike Sınıfı", "Tehlike Sinifi", "Risk Sınıfı", "Risk Sinifi", "Hazard Class", "hazard_class"],
  address: ["Adres", "Adres Bilgisi", "Firma Adresi", "İşyeri Adresi", "Isyeri Adresi", "Address"],
  phone: ["Telefon", "Tel", "Cep Telefonu", "Phone", "GSM"],
  email: ["E-posta", "Eposta", "Email", "Mail"],
  contactName: ["Yetkili Kişi", "Yetkili Kisi", "İlgili Kişi", "Ilgili Kisi", "Sorumlu", "Contact Name", "contact_name"],
  naceCode: ["NACE", "NACE Kodu", "Nace Code", "nace_code"],
  contractStart: ["Sözleşme Başlangıcı", "Sozlesme Baslangici", "Başlangıç Tarihi", "Baslangic Tarihi", "Contract Start", "contract_start"],
  contractEnd: ["Sözleşme Bitişi", "Sozlesme Bitisi", "Bitiş Tarihi", "Bitis Tarihi", "Contract End", "contract_end"],
  monthlyFee: ["Aylık Hizmet Bedeli", "Aylik Hizmet Bedeli", "Hizmet Bedeli", "Aylık Ücret", "Aylik Ucret", "Monthly Fee", "monthly_fee"],
  assignmentApprovalStatus: ["Atama Durumu", "Onay Durumu", "Sözleşme Durumu", "Sozlesme Durumu", "Assignment Status", "assignment_status"],
  visitFrequency: ["Ziyaret Sıklığı", "Ziyaret Sikligi", "Ziyaret Periyodu", "Visit Frequency", "visit_frequency"],
  notes: ["Notlar", "Not", "Açıklama", "Aciklama", "Notes"],
} as const;

type CompanyExcelField = keyof typeof COMPANY_FIELD_ALIASES;
const COMPANY_ALIAS_SETS = Object.fromEntries(Object.entries(COMPANY_FIELD_ALIASES).map(([key, aliases]) => [key, new Set(aliases.map(normalizeHeader))])) as Record<CompanyExcelField, Set<string>>;

function getCell(row: Record<string, unknown>, field: CompanyExcelField) {
  const aliasSet = COMPANY_ALIAS_SETS[field];
  const entry = Object.entries(row).find(([key]) => aliasSet.has(normalizeHeader(key)));
  const value = entry?.[1];
  return value === undefined || value === null ? "" : String(value).trim();
}

function getCellValue(sheet: WorkSheet, rowIndex: number, columnIndex: number, fallback: unknown) {
  const address = xlsxUtils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = sheet[address] as { v?: unknown; w?: string } | undefined;
  if (!cell) return fallback;
  const raw = cell.v === undefined || cell.v === null ? "" : String(cell.v).trim();
  const formatted = cell.w ? String(cell.w).trim() : "";
  if (/[eE][+-]?\d+/.test(raw) && formatted) return formatted;
  return cell.v ?? fallback;
}

function normalizeSgkNo(value: unknown) {
  return String(value ?? "").trim().replace(/\.0$/, "").replace(/\D/g, "");
}

function normalizeHazard(value: unknown) {
  const normalized = normalizeHeader(value);
  if (!normalized) return "";
  if (normalized === "az" || normalized.includes("aztehlikeli") || normalized.includes("low")) return "Az Tehlikeli";
  if (normalized.includes("coktehlikeli") || normalized.includes("high")) return "Çok Tehlikeli";
  if (normalized.includes("tehlikeli") || normalized.includes("medium")) return "Tehlikeli";
  return String(value || "").trim();
}

function normalizeAssignmentStatus(value: unknown): AssignmentStatus {
  const normalized = normalizeHeader(value);
  if (!normalized) return "automatic";
  if (normalized.includes("tamonay") || normalized.includes("approved")) return "approved";
  if (normalized.includes("personel") || normalized.includes("personnel")) return "pending_personnel";
  if (normalized.includes("isyeri") || normalized.includes("workplace")) return "pending_workplace";
  if (normalized.includes("sozlesmesiyok") || normalized.includes("missing") || normalized.includes("yok")) return "missing_contract";
  if (normalized.includes("calisansayisi0") || normalized.includes("zero")) return "zero_employees";
  if (normalized.includes("plan")) return "planned";
  return "automatic";
}

function normalizeVisitFrequency(value: unknown) {
  const normalized = normalizeHeader(value);
  if (!normalized) return "monthly_once";
  const exact = visitFrequencyOptions.find((item) => normalizeHeader(item.label) === normalized || normalizeHeader(item.value) === normalized);
  if (exact) return exact.value;
  if (normalized.includes("ayda1") || normalized.includes("monthlyonce")) return "monthly_once";
  if (normalized.includes("ayda2") || normalized.includes("monthlytwice")) return "monthly_twice";
  if (normalized.includes("ayda3") || normalized.includes("monthlythree")) return "monthly_three";
  if (normalized.includes("ayda4") || normalized.includes("monthlyfour")) return "monthly_four";
  if (normalized.includes("hafta1") || normalized.includes("weeklyonce")) return "weekly_once";
  if (normalized.includes("hafta2") || normalized.includes("weeklytwice")) return "weekly_twice";
  if (normalized.includes("hafta3") || normalized.includes("weeklythree")) return "weekly_three";
  if (normalized.includes("2ayda1") || normalized.includes("everytwomonths")) return "every_two_months";
  if (normalized.includes("3ayda1") || normalized.includes("everythreemonths")) return "every_three_months";
  if (normalized.includes("4ayda1") || normalized.includes("everyfourmonths")) return "every_four_months";
  return "monthly_once";
}

function parseOptionalDate(value: unknown) {
  if (!value) return { value: "", warning: false };
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? { value: "", warning: true } : { value: value.toISOString().slice(0, 10), warning: false };
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return { value: excelEpoch.toISOString().slice(0, 10), warning: false };
  }
  const text = String(value).trim();
  if (!text) return { value: "", warning: false };
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { value: text, warning: false };
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) return { value: `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`, warning: false };
  return { value: "", warning: true };
}

function parseMoney(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[₺\s]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/(?<=\d)\.(?=\d{3}(\D|$))/g, "");
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function assignmentLabel(value?: string | null) {
  const option = assignmentStatusOptions.find((item) => item.value === value);
  return option?.label || assignmentStatusOptions[0].label;
}

function visitFrequencyLabel(value?: string | null) {
  const option = visitFrequencyOptions.find((item) => item.value === value || item.label === value);
  return option?.label || value || "-";
}

function isBlankExcelRow(row: unknown[]) {
  return row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "");
}

function findHeaderRow(rows: unknown[][]) {
  const important: CompanyExcelField[] = ["companyName", "sgkNo", "hazardClass", "contactName", "phone"];
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 30).forEach((row, index) => {
    const normalizedCells = row.map(normalizeHeader);
    const hasField = (field: CompanyExcelField) => normalizedCells.some((cell) => COMPANY_ALIAS_SETS[field].has(cell));
    const score = important.filter(hasField).length + (hasField("companyName") && hasField("sgkNo") ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 3 ? bestIndex : -1;
}

function rowsFromWorksheet(sheet: WorkSheet) {
  const rawRows = xlsxUtils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const headerIndex = findHeaderRow(rawRows);
  if (headerIndex === -1) throw new Error("Excel başlık satırı bulunamadı. Firma Unvanı, SGK Sicil No ve diğer önemli kolonlardan en az 3 tanesi ilk 30 satırda yer almalı.");
  const headers = rawRows[headerIndex].map((cell) => String(cell ?? "").trim());
  return rawRows.slice(headerIndex + 1).filter((row) => !isBlankExcelRow(row)).map((row, index) => ({
    rowNumber: headerIndex + index + 2,
    row: headers.reduce<Record<string, unknown>>((acc, header, cellIndex) => {
      if (header) acc[header] = getCellValue(sheet, headerIndex + index + 1, cellIndex, row[cellIndex]);
      return acc;
    }, {}),
  }));
}

function MetricBox({ value, label, tone }: { value: string | number; label: string; tone: "slate" | "emerald" | "orange" | "rose" | "blue" | "purple" }) {
  const tones = {
    slate: "border-blue-400/25 bg-slate-800/70 text-blue-200",
    emerald: "border-emerald-400/35 bg-emerald-500/15 text-emerald-300",
    orange: "border-orange-400/35 bg-orange-500/15 text-orange-300",
    rose: "border-rose-400/35 bg-rose-500/15 text-rose-300",
    blue: "border-blue-400/35 bg-blue-500/15 text-blue-300",
    purple: "border-purple-400/35 bg-purple-500/15 text-purple-300",
  } as const;
  return <div className={cn("min-w-[135px] rounded-xl border px-4 py-3 text-center shadow-sm", tones[tone])}><div className="text-lg font-black leading-none">{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-90">{label}</div></div>;
}

function EmptyPanel({ icon: Icon, title, description, action, minHeight = "min-h-[240px]" }: { icon: typeof Building2; title: string; description: string; action?: React.ReactNode; minHeight?: string }) {
  return <div className={cn("grid place-items-center rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 text-center", minHeight)}><div><Icon className="mx-auto h-12 w-12 text-slate-600" /><h3 className="mt-4 text-base font-black text-slate-200">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div></div>;
}

function formFromCompany(company?: OsgbManagedCompanyRecord | null): CompanyFormState {
  if (!company) return emptyForm;
  return {
    companyName: company.companyName || "",
    branchName: company.branchName || "",
    sgkNo: company.sgkNo || "",
    taxNumber: company.taxNumber || "",
    employeeCount: String(company.employeeCount ?? 0),
    hazardClass: company.hazardClass || "Tehlikeli",
    address: company.address || "",
    phone: company.phone || "",
    email: company.email || "",
    contactName: company.contactName || "",
    naceCode: company.naceCode || "",
    contractStart: company.contractStart || "",
    contractEnd: company.contractEnd || "",
    monthlyFee: company.monthlyFee ? String(company.monthlyFee) : "",
    assignmentApprovalStatus: company.assignmentApprovalStatus || "automatic",
    visitFrequency: normalizeVisitFrequency(company.visitFrequency),
    notes: company.notes || "",
  };
}

function inputFromForm(form: CompanyFormState): OsgbCompanyManagementInput {
  return {
    companyName: form.companyName.trim(),
    branchName: form.branchName.trim() || null,
    sgkNo: normalizeSgkNo(form.sgkNo),
    taxNumber: form.taxNumber.trim() || null,
    employeeCount: Number.isFinite(Number(form.employeeCount)) ? Math.max(0, Number(form.employeeCount)) : 0,
    hazardClass: normalizeHazard(form.hazardClass) || form.hazardClass,
    address: form.address.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    contactName: form.contactName.trim() || null,
    naceCode: form.naceCode.trim() || null,
    contractStart: form.contractStart || null,
    contractEnd: form.contractEnd || null,
    monthlyFee: parseMoney(form.monthlyFee),
    assignmentApprovalStatus: form.assignmentApprovalStatus === "automatic" ? null : form.assignmentApprovalStatus,
    visitFrequency: normalizeVisitFrequency(form.visitFrequency),
    notes: form.notes.trim() || null,
    managementSource: "manual",
  };
}

function CompanyDialog({ open, onOpenChange, company, userId, organizationId, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; company: OsgbManagedCompanyRecord | null; userId: string | null; organizationId: string | null; onSaved: () => void }) {
  const [form, setForm] = useState<CompanyFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(formFromCompany(company));
  }, [company, open]);

  const update = (key: keyof CompanyFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!userId || !organizationId) return toast.error("Organizasyon bağlantısı gerekli.");
    const input = inputFromForm(form);
    if (!input.companyName) return toast.error("Firma Unvanı zorunludur.");
    if (!input.sgkNo) return toast.error("SGK Sicil No zorunludur.");
    if (!input.hazardClass) return toast.error("Tehlike Sınıfı zorunludur.");
    if (!input.contactName) return toast.error("Yetkili Kişi zorunludur.");
    if (!input.phone) return toast.error("Telefon zorunludur.");

    setSaving(true);
    try {
      await upsertOsgbManagedCompany(userId, organizationId, input, company?.id);
      toast.success(company ? "Firma güncellendi." : "Firma eklendi.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex max-h-[92vh] max-w-[900px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-700 bg-[#1b2638] p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden"><DialogTitle className="sr-only">{company ? "OSGB Firma Bilgilerini Düzenle" : "Yeni OSGB Firması Ekle"}</DialogTitle><DialogDescription className="sr-only">OSGB firma bilgilerini girin.</DialogDescription><div className="flex items-start justify-between border-b border-slate-700 bg-slate-900/70 p-5"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-300"><Building2 className="h-6 w-6" /></div><div><h2 className="text-xl font-black text-white">{company ? "OSGB Firma Bilgilerini Düzenle" : "Yeni OSGB Firması Ekle"}</h2><p className="mt-1 text-sm text-slate-400">Zorunlu alanlar: Firma Unvanı, SGK Sicil No, Tehlike Sınıfı, Yetkili Kişi ve Telefon.</p></div></div><DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose></div><div className="flex-1 space-y-4 overflow-y-auto p-5"><div className="grid gap-4 md:grid-cols-[1fr_180px]"><div><Label>Firma Unvanı *</Label><Input className={fieldClass} value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="ABC Mühendislik Ltd. Şti." /></div><div><Label>Takma Ad</Label><Input className={fieldClass} value={form.branchName} onChange={(e) => update("branchName", e.target.value)} placeholder="Şube 1" /></div></div><div className="grid gap-4 md:grid-cols-3"><div><Label>SGK Sicil No *</Label><Input className={fieldClass} value={form.sgkNo} onChange={(e) => update("sgkNo", e.target.value)} placeholder="12345678901234567890123456" /></div><div><Label>Vergi No</Label><Input className={fieldClass} value={form.taxNumber} onChange={(e) => update("taxNumber", e.target.value)} placeholder="1234567890" /></div><div><Label>Çalışan Sayısı</Label><Input type="number" className={fieldClass} value={form.employeeCount} onChange={(e) => update("employeeCount", e.target.value)} /></div></div><div className="grid gap-4 md:grid-cols-3"><div><Label>Tehlike Sınıfı *</Label><Select value={form.hazardClass} onValueChange={(value) => update("hazardClass", value)}><SelectTrigger className={cn(fieldClass, "h-10")}><SelectValue /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem><SelectItem value="Tehlikeli">Tehlikeli</SelectItem><SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem></SelectContent></Select></div><div><Label>Yetkili Kişi *</Label><Input className={fieldClass} value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Ahmet Yılmaz" /></div><div><Label>Telefon *</Label><Input className={fieldClass} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="0342 000 00 00" /></div></div><div className="grid gap-4 md:grid-cols-2"><div><Label>Adres Bilgisi</Label><Input className={fieldClass} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Gaziantep / Şehitkamil" /></div><div><Label>E-posta</Label><Input className={fieldClass} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="info@firma.com" /></div></div><div className="grid gap-4 md:grid-cols-4"><div><Label>NACE Kodu</Label><Input className={fieldClass} value={form.naceCode} onChange={(e) => update("naceCode", e.target.value)} placeholder="43.21.01" /></div><div><Label>Sözleşme Başlangıcı</Label><Input type="date" className={fieldClass} value={form.contractStart} onChange={(e) => update("contractStart", e.target.value)} /></div><div><Label>Sözleşme Bitişi</Label><Input type="date" className={fieldClass} value={form.contractEnd} onChange={(e) => update("contractEnd", e.target.value)} /></div><div><Label>Aylık Hizmet Bedeli</Label><Input className={fieldClass} value={form.monthlyFee} onChange={(e) => update("monthlyFee", e.target.value)} placeholder="15000" /></div></div><div className="grid gap-4 md:grid-cols-2"><div><Label>Atama Durumu</Label><Select value={form.assignmentApprovalStatus} onValueChange={(value) => update("assignmentApprovalStatus", value)}><SelectTrigger className={cn(fieldClass, "h-10")}><SelectValue /></SelectTrigger><SelectContent className={selectContentClass}>{assignmentStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div><Label>Ziyaret Sıklığı</Label><Select value={form.visitFrequency} onValueChange={(value) => update("visitFrequency", value)}><SelectTrigger className={cn(fieldClass, "h-10")}><SelectValue /></SelectTrigger><SelectContent className={selectContentClass}>{visitFrequencyOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div></div><div><Label>Notlar</Label><Textarea className={cn(fieldClass, "min-h-24")} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Firma hakkında notlar..." /></div></div><div className="flex shrink-0 justify-end gap-2 border-t border-slate-700 bg-slate-950/50 p-4"><Button type="button" disabled={saving} onClick={() => onOpenChange(false)} className="bg-slate-700 text-white hover:bg-slate-600">İptal</Button><Button type="button" disabled={saving} onClick={() => void save()} className="bg-blue-600 text-white hover:bg-blue-500">{saving ? "Kaydediliyor..." : company ? "Güncelle" : "Ekle"}</Button></div></DialogContent></Dialog>;
}

function BulkCompanyUploadDialog({ open, onOpenChange, userId, organizationId, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; userId: string | null; organizationId: string | null; onSaved: () => void }) {
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<BulkPreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const validRows = previewRows.filter((row) => row.valid && row.input);
  const invalidRows = previewRows.filter((row) => !row.valid);

  useEffect(() => {
    if (!open) {
      setFileName("");
      setPreviewRows([]);
    }
  }, [open]);

  const downloadTemplate = () => {
    const rows = [
      { "Firma Unvanı": "ABC Mühendislik Ltd. Şti.", "Takma Ad": "Şube 1", "SGK Sicil No": "12345678901234567890123456", "Vergi No": "1234567890", "Çalışan Sayısı": 25, "Tehlike Sınıfı": "Tehlikeli", "Adres Bilgisi": "Gaziantep / Şehitkamil", Telefon: "0342 000 00 00", "E-posta": "info@abcmuhendislik.com", "Yetkili Kişi": "Ahmet Yılmaz", "NACE Kodu": "43.21.01", "Sözleşme Başlangıcı": "2026-01-01", "Sözleşme Bitişi": "2026-12-31", "Aylık Hizmet Bedeli": 15000, "Atama Durumu": "Tam Onaylı", "Ziyaret Sıklığı": "Ayda 1 Defa", Notlar: "Örnek firma kaydı" },
      { "Firma Unvanı": "XYZ İnşaat A.Ş.", "Takma Ad": "Merkez", "SGK Sicil No": "98765432101234567890123456", "Vergi No": "9876543210", "Çalışan Sayısı": 60, "Tehlike Sınıfı": "Çok Tehlikeli", "Adres Bilgisi": "İstanbul", Telefon: "0212 000 00 00", "E-posta": "info@xyzinsaat.com", "Yetkili Kişi": "Mehmet Demir", "NACE Kodu": "41.20.01", "Sözleşme Başlangıcı": "2026-02-01", "Sözleşme Bitişi": "2027-02-01", "Aylık Hizmet Bedeli": 30000, "Atama Durumu": "Personel Onayı Bekleniyor", "Ziyaret Sıklığı": "Ayda 2 Defa", Notlar: "Örnek firma kaydı" },
    ];
    const sheet = xlsxUtils.json_to_sheet(rows, { header: templateHeaders });
    const book = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(book, sheet, "OSGB Firmaları");
    writeFile(book, "osgb-firma-toplu-yukleme-sablonu.xlsx");
  };

  const parseFile = async (file: File) => {
    if (!organizationId || !userId) return toast.error("Organizasyon bağlantısı gerekli.");
    setFileName(file.name);
    const workbook = read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const parsed = rowsFromWorksheet(sheet).map(({ row, rowNumber }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const companyName = getCell(row, "companyName");
      const sgkNo = normalizeSgkNo(getCell(row, "sgkNo"));
      const hazardClass = normalizeHazard(getCell(row, "hazardClass"));
      const contactName = getCell(row, "contactName");
      const phone = getCell(row, "phone");
      if (!companyName) errors.push("Firma Unvanı zorunlu.");
      if (!sgkNo) errors.push("SGK Sicil No zorunlu.");
      if (!hazardClass) errors.push("Tehlike Sınıfı zorunlu.");
      if (!contactName) errors.push("Yetkili Kişi zorunlu.");
      if (!phone) errors.push("Telefon zorunlu.");
      const contractStart = parseOptionalDate(getCell(row, "contractStart"));
      const contractEnd = parseOptionalDate(getCell(row, "contractEnd"));
      if (contractStart.warning) warnings.push("Sözleşme başlangıcı okunamadı, boş aktarılacak.");
      if (contractEnd.warning) warnings.push("Sözleşme bitişi okunamadı, boş aktarılacak.");
      const employeeCount = Number(getCell(row, "employeeCount"));
      const input: OsgbCompanyManagementInput | null = errors.length ? null : {
        companyName,
        branchName: getCell(row, "branchName") || null,
        sgkNo,
        taxNumber: getCell(row, "taxNumber") || null,
        employeeCount: Number.isFinite(employeeCount) ? Math.max(0, employeeCount) : 0,
        hazardClass,
        address: getCell(row, "address") || null,
        phone,
        email: getCell(row, "email") || null,
        contactName,
        naceCode: getCell(row, "naceCode") || null,
        contractStart: contractStart.value || null,
        contractEnd: contractEnd.value || null,
        monthlyFee: parseMoney(getCell(row, "monthlyFee")),
        assignmentApprovalStatus: toPersistedAssignmentStatus(normalizeAssignmentStatus(getCell(row, "assignmentApprovalStatus"))),
        visitFrequency: normalizeVisitFrequency(getCell(row, "visitFrequency")),
        notes: getCell(row, "notes") || null,
        managementSource: "import",
      };
      return { rowNumber, valid: errors.length === 0, errors, warnings, input };
    });
    setPreviewRows(parsed);
  };

  const upload = async () => {
    if (!userId || !organizationId || validRows.length === 0) return;
    setUploading(true);
    try {
      const result = await upsertOsgbManagedCompaniesFromExcel(userId, organizationId, validRows.map((row) => row.input!));
      toast.success(`${result.inserted} firma yüklendi, ${result.updated} kayıt güncellendi.`);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplu firma yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex max-h-[92vh] max-w-[920px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#1b2638] p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden"><DialogTitle className="sr-only">Toplu OSGB Firması Yükle</DialogTitle><DialogDescription className="sr-only">Excel ile OSGB firma listenizi yükleyin.</DialogDescription><div className="flex items-start justify-between border-b border-slate-700 bg-slate-900/70 p-5"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><FileSpreadsheet className="h-6 w-6" /></div><div><h2 className="text-xl font-black text-white">Toplu OSGB Firması Yükle</h2><p className="mt-1 text-sm text-slate-400">Excel ile OSGB firma listenizi yükleyin. Aynı SGK Sicil No varsa kayıt güncellenir, yoksa yeni firma eklenir.</p></div></div><DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose></div><div className="flex-1 space-y-4 overflow-y-auto p-5"><div className="flex flex-wrap gap-2"><Button type="button" onClick={downloadTemplate} className="bg-slate-800 text-slate-100 hover:bg-slate-700"><Download className="mr-2 h-4 w-4" />Şablon Excel İndir</Button><label className="inline-flex h-10 cursor-pointer items-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"><Upload className="mr-2 h-4 w-4" />Excel Dosyası Seç<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseFile(file); event.currentTarget.value = ""; }} /></label>{fileName ? <span className="inline-flex items-center rounded-xl border border-slate-700 px-3 text-sm text-slate-300">{fileName}</span> : null}</div><div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-100">Firma Unvanı, SGK Sicil No, Tehlike Sınıfı, Yetkili Kişi ve Telefon zorunludur. Parser farklı başlık varyasyonlarını ve ilk 30 satırdaki başlık satırlarını destekler.</div>{previewRows.length ? <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-3"><div className="mb-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">Toplam satır: {previewRows.length}</span><span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">Geçerli satır: {validRows.length}</span><span className="rounded-full bg-rose-500/15 px-3 py-1 text-rose-200">Hatalı satır: {invalidRows.length}</span></div><div className="max-h-72 overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-400"><tr><th className="p-2">Satır</th><th className="p-2">Durum</th><th className="p-2">Firma</th><th className="p-2">SGK</th><th className="p-2">Uyarı/Hata</th></tr></thead><tbody>{previewRows.map((row) => <tr key={row.rowNumber} className="border-t border-slate-800"><td className="p-2">{row.rowNumber}</td><td className={cn("p-2 font-bold", row.valid ? "text-emerald-300" : "text-rose-300")}>{row.valid ? "Geçerli" : "Hatalı"}</td><td className="p-2">{row.input?.companyName || "-"}</td><td className="p-2">{row.input?.sgkNo || "-"}</td><td className="p-2 text-slate-400">{[...row.errors, ...row.warnings].join(" · ") || "-"}</td></tr>)}</tbody></table></div></div> : null}</div><div className="flex shrink-0 justify-end gap-2 border-t border-slate-700 bg-slate-950/50 p-4"><Button type="button" disabled={uploading} onClick={() => onOpenChange(false)} className="bg-slate-700 text-white hover:bg-slate-600">İptal</Button><Button type="button" disabled={uploading || validRows.length === 0} onClick={() => void upload()} className="bg-violet-600 text-white hover:bg-violet-500">{uploading ? "Yükleniyor..." : "Yükle"}</Button></div></DialogContent></Dialog>;
}

function MissingAssignmentsDialog({ open, onOpenChange, companies, onOpenBulkAssignment }: { open: boolean; onOpenChange: (open: boolean) => void; companies: OsgbManagedCompanyRecord[]; onOpenBulkAssignment: () => void }) {
  const missingCompanies = companies.filter((company) => getCompanyDeficitMinutes(company) > 0);
  const copySgkNumbers = async () => { const value = missingCompanies.map((company) => company.sgkNo).filter(Boolean).join("\n"); if (!value) return toast.info("Kopyalanacak SGK No bulunamadı."); await navigator.clipboard.writeText(value); toast.success("SGK numaraları kopyalandı."); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex h-[75vh] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden"><DialogTitle className="sr-only">Eksik Ataması Olan Firmalar</DialogTitle><DialogDescription className="sr-only">Eksik ataması olan firmaları filtreleyin.</DialogDescription><div className="flex items-start justify-between border-b border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-amber-300"><AlertTriangle className="h-6 w-6" /></div><div><h2 className="text-xl font-black text-white">Eksik Ataması Olan Firmalar</h2><p className="mt-1 text-sm text-slate-400">Toplam {missingCompanies.length} firmada hizmet eksikliği tespit edildi</p></div></div><DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose></div><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-5 py-4"><Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white" onClick={copySgkNumbers}><Copy className="mr-2 h-4 w-4" />Tüm SGK No Kopyala</Button><Button type="button" className="bg-slate-500 text-white hover:bg-slate-400" onClick={onOpenBulkAssignment}><UserPlus className="mr-2 h-4 w-4" />Çoklu Atama Yap ({missingCompanies.length})</Button></div><div className="grid flex-1 place-items-center bg-slate-950 p-8 text-center">{missingCompanies.length === 0 ? <div><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-9 w-9" /></div><h3 className="mt-5 text-xl font-black text-white">Harika!</h3><p className="mt-2 text-sm text-slate-400">Şu an için ataması eksik olan herhangi bir firma bulunmuyor.</p></div> : <div className="w-full max-w-3xl space-y-2 text-left">{missingCompanies.map((company) => <div key={company.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div><p className="font-bold text-white">{company.companyName}</p><p className="text-xs text-slate-400">{company.sgkNo || "SGK yok"} · Eksik {getCompanyDeficitMinutes(company)} dk</p></div><span className="text-sm font-black text-rose-300">{getCompanyDeficitMinutes(company)} dk</span></div>)}</div>}</div><div className="flex justify-end border-t border-slate-800 bg-slate-900/60 p-4"><DialogClose asChild><Button type="button" className="bg-slate-800 text-slate-100 hover:bg-slate-700">Kapat</Button></DialogClose></div></DialogContent></Dialog>;
}

function BulkAssignmentDialog({ open, onOpenChange, companies, personnel }: { open: boolean; onOpenChange: (open: boolean) => void; companies: OsgbManagedCompanyRecord[]; personnel: OsgbWorkspacePersonnelRecord[] }) {
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const toggleCompany = (id: string) => setSelectedCompanyIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex h-[75vh] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden"><DialogTitle className="sr-only">Toplu Atama Ekle</DialogTitle><DialogDescription className="sr-only">Personel seçerek firmalara toplu atama yapın.</DialogDescription><div className="flex items-start justify-between border-b border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300"><UserPlus className="h-6 w-6" /></div><div><h2 className="text-xl font-black text-white">Toplu Atama Ekle</h2><p className="mt-1 text-sm text-slate-400">Personel havuzundan bir personel seç, atamak istediğin firmaları işaretle.</p></div></div><DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose></div><div className="grid flex-1 gap-4 overflow-hidden p-5 md:grid-cols-[320px_1fr]"><div className="overflow-auto rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="mb-3 text-sm font-black text-white">Personel</p>{personnel.map((person) => <button key={person.id} type="button" onClick={() => setSelectedPersonnelId(person.id)} className={cn("mb-2 w-full rounded-lg border p-3 text-left text-sm", selectedPersonnelId === person.id ? "border-emerald-400 bg-emerald-500/15 text-white" : "border-slate-800 bg-slate-950 text-slate-300")}>{person.full_name}<span className="ml-2 text-xs text-slate-500">{person.role}</span></button>)}</div><div className="overflow-auto rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="mb-3 text-sm font-black text-white">Firmalar</p>{companies.map((company) => <label key={company.id} className="mb-2 flex cursor-pointer items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300"><span>{company.companyName}</span><input type="checkbox" checked={selectedCompanyIds.includes(company.id)} onChange={() => toggleCompany(company.id)} /></label>)}</div></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/60 p-4"><span className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white">{selectedCompanyIds.length} firma seçili</span><div className="flex gap-2"><DialogClose asChild><Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">İptal</Button></DialogClose><Button type="button" disabled={!selectedPersonnelId || selectedCompanyIds.length === 0} className="bg-slate-500 text-white hover:bg-slate-400 disabled:opacity-60" onClick={() => toast.info("Toplu atama işlemi için seçimler hazırlandı.")}><UserPlus className="mr-2 h-4 w-4" />Atamaları Yap ({selectedCompanyIds.length})</Button></div></div></DialogContent></Dialog>;
}

function ArchiveManagementDialog({ open, onOpenChange, companies }: { open: boolean; onOpenChange: (open: boolean) => void; companies: OsgbManagedCompanyRecord[] }) {
  const archiveableCompanies = companies.filter((company) => company.employeeCount === 0 || !company.contractEnd);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex max-w-[720px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden"><DialogTitle className="sr-only">Arşiv Yönetimi</DialogTitle><DialogDescription className="sr-only">Firmaları arşive taşı veya geri yükle.</DialogDescription><div className="flex items-start justify-between border-b border-slate-700/70 p-5"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-700 text-slate-200"><Archive className="h-6 w-6" /></div><div><h2 className="text-xl font-black text-white">Arşiv Yönetimi</h2><p className="mt-1 text-sm text-slate-400">Firmaları arşive taşı veya geri yükle</p></div></div><DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose></div><div className="grid min-h-[180px] place-items-center p-5 text-center text-sm text-slate-400"><div><Archive className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-4">Arşivlenebilecek firma sayısı: {archiveableCompanies.length}</p></div></div><div className="flex justify-end gap-3 border-t border-slate-700/70 bg-slate-900 p-4"><DialogClose asChild><Button type="button" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-white">Kapat</Button></DialogClose></div></DialogContent></Dialog>;
}

export function OSGBCompaniesPanel({ refreshKey }: { refreshKey: number }) {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [companies, setCompanies] = useState<OsgbManagedCompanyRecord[]>([]);
  const [personnel, setPersonnel] = useState<OsgbWorkspacePersonnelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [hazardFilter, setHazardFilter] = useState("all");
  const [personnelFilter, setPersonnelFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("title");
  const [statusFilter, setStatusFilter] = useState<CompanyStatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [missingDialogOpen, setMissingDialogOpen] = useState(false);
  const [bulkAssignmentDialogOpen, setBulkAssignmentDialogOpen] = useState(false);
  const [bulkCompanyDialogOpen, setBulkCompanyDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<OsgbManagedCompanyRecord | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<OsgbManagedCompanyRecord | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) { setCompanies([]); setPersonnel([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [workspace, personnelRows] = await Promise.all([listOsgbCompanyTrackingWorkspace(organizationId), listOsgbWorkspacePersonnel(organizationId, true)]);
      setCompanies(workspace.companies);
      setPersonnel(personnelRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OSGB firmaları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void loadData(); }, [loadData, refreshKey]);

  const metrics = useMemo(() => ({
    total: companies.length,
    low: companies.filter((company) => normalizeHazard(company.hazardClass) === "Az Tehlikeli").length,
    medium: companies.filter((company) => normalizeHazard(company.hazardClass) === "Tehlikeli").length,
    high: companies.filter((company) => normalizeHazard(company.hazardClass) === "Çok Tehlikeli").length,
    igu: companies.reduce((sum, company) => sum + company.requiredMinutesByRole.igu, 0),
    ih: companies.reduce((sum, company) => sum + company.requiredMinutesByRole.hekim, 0),
  }), [companies]);

  const filteredCompanies = useMemo(() => {
    const normalized = `${search} ${listSearch}`.trim().toLocaleLowerCase("tr-TR");
    const sorted = companies.filter((company) => {
      if (hazardFilter !== "all" && normalizeHazard(company.hazardClass) !== hazardFilter) return false;
      if (statusFilter !== "all" && company.assignmentApprovalStatus !== statusFilter) return false;
      if (!normalized) return true;
      return `${company.companyName} ${company.branchName || ""} ${company.sgkNo || ""} ${company.address || ""} ${company.taxNumber || ""}`.toLocaleLowerCase("tr-TR").includes(normalized);
    });
    sorted.sort((a, b) => sortMode === "employee_desc" ? b.employeeCount - a.employeeCount : sortMode === "fee_desc" ? b.monthlyFee - a.monthlyFee : a.companyName.localeCompare(b.companyName, "tr"));
    return sorted;
  }, [companies, hazardFilter, listSearch, search, sortMode, statusFilter]);

  const exportCompanies = () => {
    const rows = filteredCompanies.map((company) => ({ "Firma Unvanı": company.companyName, "Takma Ad": company.branchName || "", "SGK Sicil No": company.sgkNo || "", "Vergi No": company.taxNumber || "", "Çalışan Sayısı": company.employeeCount, "Tehlike Sınıfı": company.hazardClass, "Yetkili Kişi": company.contactName || "", Telefon: company.phone || "", "E-posta": company.email || "", "NACE Kodu": company.naceCode || "", "Sözleşme Başlangıcı": company.contractStart || "", "Sözleşme Bitişi": company.contractEnd || "", "Aylık Hizmet Bedeli": company.monthlyFee, "Atama Durumu": assignmentLabel(company.assignmentApprovalStatus), "Ziyaret Sıklığı": visitFrequencyLabel(company.visitFrequency), Notlar: company.notes || "" }));
    const sheet = xlsxUtils.json_to_sheet(rows, { header: templateHeaders });
    const book = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(book, sheet, "OSGB Firmaları");
    writeFile(book, "osgb-firmalari.xlsx");
  };

  const openNewCompany = () => { setEditingCompany(null); setCompanyDialogOpen(true); };
  const openEditCompany = (company: OsgbManagedCompanyRecord) => { setEditingCompany(company); setCompanyDialogOpen(true); };
  const deleteCompany = async () => {
    if (!organizationId || !deletingCompany) return;
    try {
      await deleteOsgbManagedCompany(organizationId, deletingCompany.id, user?.id);
      toast.success("Firma listeden kaldırıldı.");
      setDeletingCompany(null);
      void loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma silinemedi.");
    }
  };

  const chips: Array<{ id: CompanyStatusFilter; label: string; count: number; dot: string }> = [
    { id: "all", label: "Tümü", count: companies.length, dot: "bg-blue-400" },
    { id: "approved", label: "Tam Onaylı", count: companies.filter((c) => c.assignmentApprovalStatus === "approved").length, dot: "bg-emerald-400" },
    { id: "pending_personnel", label: "Personel Onayı Bekleniyor", count: companies.filter((c) => c.assignmentApprovalStatus === "pending_personnel").length, dot: "bg-amber-400" },
    { id: "pending_workplace", label: "İşyeri Onayı Bekleniyor", count: companies.filter((c) => c.assignmentApprovalStatus === "pending_workplace").length, dot: "bg-yellow-400" },
    { id: "zero_employees", label: "Çalışan Sayısı 0", count: companies.filter((c) => c.assignmentApprovalStatus === "zero_employees" || c.employeeCount === 0).length, dot: "bg-purple-400" },
    { id: "missing_contract", label: "İSG Profesyonel Sözleşmesi Yok", count: companies.filter((c) => c.assignmentApprovalStatus === "missing_contract").length, dot: "bg-rose-400" },
    { id: "planned", label: "Planlanan Atamalar", count: companies.filter((c) => c.assignmentApprovalStatus === "planned").length, dot: "bg-blue-300" },
  ];

  if (loading) return <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-300" /></div>;
  if (error) return <EmptyPanel icon={AlertTriangle} title="OSGB firmaları yüklenemedi." description={error} />;

  return <div className="min-h-full space-y-3 bg-[#0b1426] text-slate-100"><div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 shadow-sm"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firma, SGK No, il ara..." /></div><div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0"><Select value={hazardFilter} onValueChange={setHazardFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Tüm Tehlike" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">Tüm Tehlike</SelectItem><SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem><SelectItem value="Tehlikeli">Tehlikeli</SelectItem><SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem></SelectContent></Select><Select value={personnelFilter} onValueChange={setPersonnelFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Tüm Personel" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">Tüm Personel</SelectItem>{personnel.map((person) => <SelectItem key={person.id} value={person.id}>{person.full_name}</SelectItem>)}</SelectContent></Select><Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Ünvan" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="title">Ünvan</SelectItem><SelectItem value="employee_desc">Çalışan Sayısı</SelectItem><SelectItem value="fee_desc">Aylık Hizmet Bedeli</SelectItem></SelectContent></Select><div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-1"><Button type="button" size="icon" className={cn("h-7 w-7", viewMode === "list" ? "bg-blue-600 text-white" : "bg-transparent text-slate-400 hover:bg-slate-800")} onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button><Button type="button" size="icon" className={cn("h-7 w-7", viewMode === "grid" ? "bg-blue-600 text-white" : "bg-transparent text-slate-400 hover:bg-slate-800")} onClick={() => setViewMode("grid")}><Grid2X2 className="h-4 w-4" /></Button></div><Button type="button" className="h-9 shrink-0 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white" onClick={exportCompanies}><Download className="mr-2 h-4 w-4" />Dışa Aktar</Button><Button type="button" className="h-9 shrink-0 bg-violet-600 text-white hover:bg-violet-500" onClick={() => setBulkCompanyDialogOpen(true)}><Upload className="mr-2 h-4 w-4" />Toplu Firma Yükle</Button><Button type="button" className="h-9 shrink-0 bg-blue-600 text-white hover:bg-blue-500" onClick={openNewCompany}><Plus className="mr-2 h-4 w-4" />Firma Ekle</Button></div></div></div><div className="flex flex-col gap-3 2xl:flex-row 2xl:items-stretch"><div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"><MetricBox value={metrics.total} label="Toplam" tone="slate" /><MetricBox value={metrics.low} label="Az Tehlikeli" tone="emerald" /><MetricBox value={metrics.medium} label="Tehlikeli" tone="orange" /><MetricBox value={metrics.high} label="Çok Tehlikeli" tone="rose" /><MetricBox value={`${metrics.igu} dk`} label="İGU" tone="blue" /><MetricBox value={`${metrics.ih} dk`} label="İH" tone="purple" /></div><div className="grid gap-2 sm:grid-cols-3 2xl:min-w-[520px]"><Button type="button" className="h-full min-h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm hover:from-violet-500 hover:to-purple-500" onClick={() => setMissingDialogOpen(true)}><AlertTriangle className="mr-2 h-4 w-4" />Eksik Atamaları Bul</Button><Button type="button" className="h-full min-h-12 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:from-emerald-500 hover:to-teal-500" onClick={() => setBulkAssignmentDialogOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Toplu Atama Ekle</Button><Button type="button" className="h-full min-h-12 bg-slate-700 text-white shadow-sm hover:bg-slate-600" onClick={() => setArchiveDialogOpen(true)}><Archive className="mr-2 h-4 w-4" />Arşive Taşı</Button></div></div><div className="flex gap-2 overflow-x-auto pb-1">{chips.map((chip) => <button key={chip.id} type="button" onClick={() => setStatusFilter(chip.id)} className={cn("flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition", statusFilter === chip.id ? "border-blue-500 bg-blue-600 text-white" : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700")}><span className={cn("h-2 w-2 rounded-full", chip.dot)} />{chip.label} ({chip.count})</button>)}</div><div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-sm"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><h2 className="text-lg font-black text-white">OSGB Firmaları</h2><span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{filteredCompanies.length} kayıt</span></div><div className="relative sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={listSearch} onChange={(event) => setListSearch(event.target.value)} placeholder="Firma, SGK No ara..." /></div></div>{filteredCompanies.length ? <div className={cn(viewMode === "grid" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-2")}>{filteredCompanies.map((company) => <div key={company.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4 transition hover:border-blue-500/35 hover:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-white">{company.companyName}</p><p className="mt-1 text-xs text-slate-400">{company.branchName ? `${company.branchName} · ` : ""}{company.sgkNo || "SGK No yok"} · {company.hazardClass}</p></div><div className="flex gap-2"><Button type="button" size="icon" className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-blue-600" onClick={() => openEditCompany(company)}><Edit2 className="h-4 w-4" /></Button><Button type="button" size="icon" className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-rose-600" onClick={() => setDeletingCompany(company)}><Trash2 className="h-4 w-4" /></Button></div></div><div className="mt-3 grid gap-2 text-xs md:grid-cols-3"><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">Vergi No</b><p className="text-slate-500">{company.taxNumber || "-"}</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">Çalışan</b><p className="text-blue-300">{company.employeeCount}</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">NACE</b><p className="text-slate-500">{company.naceCode || "-"}</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">Yetkili</b><p className="text-slate-500">{company.contactName || "-"}</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">Telefon</b><p className="text-slate-500">{company.phone || "-"}</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">E-posta</b><p className="truncate text-slate-500">{company.email || "-"}</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">Sözleşme</b><p className="text-slate-500">{formatDate(company.contractStart)} / {formatDate(company.contractEnd)}</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">Hizmet Bedeli</b><p className="text-emerald-300">{formatCurrency(company.monthlyFee)}</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-slate-200">Ziyaret</b><p className="text-slate-500">{visitFrequencyLabel(company.visitFrequency)}</p></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-blue-500/10 px-2 py-1 font-bold text-blue-200">{assignmentLabel(company.assignmentApprovalStatus)}</span><span className="rounded-lg bg-slate-800 px-2 py-1 text-slate-400">{company.address || "Adres yok"}</span></div></div>)}</div> : <EmptyPanel icon={Building2} title="Henüz OSGB firması eklenmemiş." description="Firma ekleyebilir veya Excel ile toplu yükleme yapabilirsiniz." action={<div className="flex flex-wrap justify-center gap-2"><Button type="button" className="bg-violet-600 text-white hover:bg-violet-500" onClick={() => setBulkCompanyDialogOpen(true)}><Upload className="mr-2 h-4 w-4" />Toplu Firma Yükle</Button><Button type="button" className="bg-blue-600 text-white hover:bg-blue-500" onClick={openNewCompany}><Plus className="mr-2 h-4 w-4" />Firma Ekle</Button></div>} />}</div><CompanyDialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen} company={editingCompany} userId={user?.id || null} organizationId={organizationId} onSaved={() => void loadData()} /><BulkCompanyUploadDialog open={bulkCompanyDialogOpen} onOpenChange={setBulkCompanyDialogOpen} userId={user?.id || null} organizationId={organizationId} onSaved={() => void loadData()} /><MissingAssignmentsDialog open={missingDialogOpen} onOpenChange={setMissingDialogOpen} companies={companies} onOpenBulkAssignment={() => { setMissingDialogOpen(false); setBulkAssignmentDialogOpen(true); }} /><BulkAssignmentDialog open={bulkAssignmentDialogOpen} onOpenChange={setBulkAssignmentDialogOpen} companies={companies} personnel={personnel} /><ArchiveManagementDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen} companies={companies} /><AlertDialog open={!!deletingCompany} onOpenChange={(open) => !open && setDeletingCompany(null)}><AlertDialogContent className="border-slate-700 bg-slate-900 text-slate-50"><AlertDialogHeader><AlertDialogTitle>Firma Silinsin mi?</AlertDialogTitle><AlertDialogDescription className="text-slate-400">Bu firma OSGB yönetim listesinden kaldırılacak. İlişkili kayıtlar korunabilir ancak aktif listede görünmez.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700">İptal</AlertDialogCancel><AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500" onClick={() => void deleteCompany()}>Sil</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}