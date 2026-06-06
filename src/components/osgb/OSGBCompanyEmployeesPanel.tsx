import { useCallback, useEffect, useMemo, useState } from "react";
import { utils as xlsxUtils, writeFile, read } from "xlsx";
import {
  Calendar,
  Download,
  Edit2,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  Users,
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
  createOsgbCompanyEmployee,
  deleteOsgbCompanyEmployee,
  listOsgbCompanyEmployees,
  listOsgbWorkspaceCompanies,
  updateOsgbCompanyEmployee,
  upsertOsgbCompanyEmployeesFromExcel,
  type OsgbCompanyEmployeeInput,
  type OsgbCompanyEmployeeRecord,
  type OsgbWorkspaceCompanyOption,
} from "@/lib/osgbPlatform";

const inputClass = "h-9 border-slate-700/70 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/40";
const textareaClass = "min-h-[84px] border-slate-700/70 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/40";
const selectTriggerClass = "h-9 border-slate-700/70 bg-slate-900/70 text-slate-100 focus:ring-blue-500/40";
const selectContentClass = "z-[130] border-slate-700 bg-slate-900 text-slate-100";
const ALL_COMPANIES = "all";

interface EmployeeFormState {
  companyId: string;
  tcNumber: string;
  firstName: string;
  lastName: string;
  position: string;
  birthDate: string;
  age: string;
  gender: string;
  startDate: string;
  department: string;
  trainingDate: string;
  periodicExamDate: string;
  upperBodySize: string;
  shoeSize: string;
  trainingTopic: string;
  occupation: string;
  phone: string;
  email: string;
  notes: string;
}

const emptyForm: EmployeeFormState = {
  companyId: "",
  tcNumber: "",
  firstName: "",
  lastName: "",
  position: "",
  birthDate: "",
  age: "",
  gender: "",
  startDate: "",
  department: "",
  trainingDate: "",
  periodicExamDate: "",
  upperBodySize: "",
  shoeSize: "",
  trainingTopic: "",
  occupation: "",
  phone: "",
  email: "",
  notes: "",
};

type BulkPreviewRow = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  input: OsgbCompanyEmployeeInput | null;
};

const templateHeaders = [
  "Firma",
  "TC Kimlik No",
  "Ad",
  "Soyad",
  "Pozisyon",
  "Doğum Tarihi",
  "Yaş",
  "Cinsiyet",
  "İşe Giriş Tarihi",
  "Çalıştığı Bölüm",
  "Eğitim Tarihi",
  "Periyodik Muayene Tarihi",
  "Üst Beden No",
  "Ayakkabı No",
  "Eğitim Konusu",
  "Meslek",
  "Telefon",
  "E-posta",
  "Notlar",
];

function normalizeHeader(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

function getCell(row: Record<string, unknown>, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  const entry = Object.entries(row).find(([key]) => aliasSet.has(normalizeHeader(key)));
  const value = entry?.[1];
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeTc(value: unknown) {
  const raw = value === undefined || value === null ? "" : String(value).trim();
  const digits = raw.replace(/\.0$/, "").replace(/\D/g, "");
  return digits.length > 11 ? digits.slice(-11) : digits.padStart(raw.startsWith("0") ? 11 : digits.length, "0");
}

function parseOptionalDate(value: unknown) {
  if (!value) return { value: "", warning: false };
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return { value: excelEpoch.toISOString().slice(0, 10), warning: false };
  }
  const text = String(value).trim();
  if (!text) return { value: "", warning: false };
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { value: text, warning: false };
  const dotMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return { value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, warning: false };
  }
  return { value: "", warning: true };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function toEmployeeInput(form: EmployeeFormState, organizationId: string, userId: string): OsgbCompanyEmployeeInput {
  return {
    organizationId,
    userId,
    companyId: form.companyId,
    tcNumber: form.tcNumber.replace(/\D/g, ""),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    position: form.position,
    jobTitle: form.position,
    birthDate: form.birthDate || null,
    age: form.age ? Number(form.age) : null,
    gender: form.gender,
    startDate: form.startDate || null,
    department: form.department,
    trainingDate: form.trainingDate || null,
    periodicExamDate: form.periodicExamDate || null,
    upperBodySize: form.upperBodySize,
    shoeSize: form.shoeSize,
    trainingTopic: form.trainingTopic,
    occupation: form.occupation,
    phone: form.phone,
    email: form.email,
    notes: form.notes,
  };
}

function employeeToForm(employee: OsgbCompanyEmployeeRecord): EmployeeFormState {
  return {
    companyId: employee.companyId,
    tcNumber: employee.tcNumber || "",
    firstName: employee.firstName || employee.fullName.split(" ")[0] || "",
    lastName: employee.lastName || employee.fullName.split(" ").slice(1).join(" "),
    position: employee.position || "",
    birthDate: employee.birthDate || "",
    age: employee.age ? String(employee.age) : "",
    gender: employee.gender || "",
    startDate: employee.startDate || "",
    department: employee.department || "",
    trainingDate: employee.trainingDate || "",
    periodicExamDate: employee.periodicExamDate || "",
    upperBodySize: employee.upperBodySize || "",
    shoeSize: employee.shoeSize || "",
    trainingTopic: employee.trainingTopic || "",
    occupation: employee.occupation || "",
    phone: employee.phone || "",
    email: employee.email || "",
    notes: employee.notes || "",
  };
}

function validateForm(form: EmployeeFormState) {
  if (!form.companyId) return "Firma seçimi zorunludur.";
  if (!/^\d{11}$/.test(form.tcNumber.replace(/\D/g, ""))) return "TC Kimlik No 11 haneli olmalıdır.";
  if (!form.firstName.trim()) return "Ad zorunludur.";
  if (!form.lastName.trim()) return "Soyad zorunludur.";
  return null;
}

function EmployeeDialog({
  open,
  onOpenChange,
  companies,
  employee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: OsgbWorkspaceCompanyOption[];
  employee: OsgbCompanyEmployeeRecord | null;
  onSaved: () => void;
}) {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(employee ? employeeToForm(employee) : { ...emptyForm, companyId: companies[0]?.id || "" });
  }, [companies, employee, open]);

  const updateForm = (key: keyof EmployeeFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!organizationId || !user?.id) return toast.error("Çalışan kaydı için organizasyon bağlantısı gerekli.");
    const validationError = validateForm(form);
    if (validationError) return toast.error(validationError);

    setSaving(true);
    try {
      const input = toEmployeeInput(form, organizationId, user.id);
      if (employee) {
        await updateOsgbCompanyEmployee(employee.id, input);
        toast.success("Çalışan güncellendi.");
      } else {
        await createOsgbCompanyEmployee(input);
        toast.success("Çalışan eklendi.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çalışan kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex max-h-[92vh] max-w-[920px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#1b2638] p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">{employee ? "Çalışan Bilgilerini Düzenle" : "Yeni Çalışan Ekle"}</DialogTitle>
        <DialogDescription className="sr-only">OSGB firma çalışanı kaydı oluşturun veya düzenleyin.</DialogDescription>
        <div className="flex items-start justify-between border-b border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300"><UserRound className="h-6 w-6" /></div>
            <div><h2 className="text-xl font-black text-white">{employee ? "Çalışan Bilgilerini Düzenle" : "Yeni Çalışan Ekle"}</h2><p className="mt-1 text-sm text-slate-400">Sadece Firma, TC Kimlik No, Ad ve Soyad zorunludur.</p></div>
          </div>
          <DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-3"><Label className="text-slate-300">Firma *</Label><Select value={form.companyId} onValueChange={(value) => updateForm("companyId", value)}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Firma seçin" /></SelectTrigger><SelectContent className={selectContentClass}>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label className="text-slate-300">TC Kimlik No *</Label><Input className={inputClass} value={form.tcNumber} onChange={(event) => updateForm("tcNumber", event.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="12345678901" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Ad *</Label><Input className={inputClass} value={form.firstName} onChange={(event) => updateForm("firstName", event.target.value)} placeholder="Ad" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Soyad *</Label><Input className={inputClass} value={form.lastName} onChange={(event) => updateForm("lastName", event.target.value)} placeholder="Soyad" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Pozisyon</Label><Input className={inputClass} value={form.position} onChange={(event) => updateForm("position", event.target.value)} placeholder="Pozisyon" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Doğum Tarihi</Label><Input type="date" className={inputClass} value={form.birthDate} onChange={(event) => updateForm("birthDate", event.target.value)} /></div>
          <div className="space-y-2"><Label className="text-slate-300">Yaş</Label><Input type="number" className={inputClass} value={form.age} onChange={(event) => updateForm("age", event.target.value)} placeholder="36" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Cinsiyet</Label><Select value={form.gender || "unspecified"} onValueChange={(value) => updateForm("gender", value === "unspecified" ? "" : value)}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Seçiniz" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="unspecified">Belirtilmedi</SelectItem><SelectItem value="Erkek">Erkek</SelectItem><SelectItem value="Kadın">Kadın</SelectItem><SelectItem value="Diğer">Diğer</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label className="text-slate-300">İşe Giriş Tarihi</Label><Input type="date" className={inputClass} value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></div>
          <div className="space-y-2"><Label className="text-slate-300">Çalıştığı Bölüm</Label><Input className={inputClass} value={form.department} onChange={(event) => updateForm("department", event.target.value)} placeholder="Bölüm" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Eğitim Tarihi</Label><Input type="date" className={inputClass} value={form.trainingDate} onChange={(event) => updateForm("trainingDate", event.target.value)} /></div>
          <div className="space-y-2"><Label className="text-slate-300">Periyodik Muayene (EK2)</Label><Input type="date" className={inputClass} value={form.periodicExamDate} onChange={(event) => updateForm("periodicExamDate", event.target.value)} /></div>
          <div className="space-y-2"><Label className="text-slate-300">Üst Beden No</Label><Input className={inputClass} value={form.upperBodySize} onChange={(event) => updateForm("upperBodySize", event.target.value)} placeholder="L" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Ayakkabı No</Label><Input className={inputClass} value={form.shoeSize} onChange={(event) => updateForm("shoeSize", event.target.value)} placeholder="42" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Eğitim Konusu</Label><Input className={inputClass} value={form.trainingTopic} onChange={(event) => updateForm("trainingTopic", event.target.value)} placeholder="Temel İSG Eğitimi" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Meslek</Label><Input className={inputClass} value={form.occupation} onChange={(event) => updateForm("occupation", event.target.value)} placeholder="Meslek" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Telefon</Label><Input className={inputClass} value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="Telefon" /></div>
          <div className="space-y-2"><Label className="text-slate-300">E-posta</Label><Input type="email" className={inputClass} value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="E-posta" /></div>
          <div className="space-y-2 lg:col-span-3"><Label className="text-slate-300">Notlar</Label><Textarea className={textareaClass} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Notlar" /></div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-700 bg-slate-950/50 p-4">
          <Button type="button" disabled={saving} onClick={() => onOpenChange(false)} className="bg-slate-700 text-white hover:bg-slate-600">İptal</Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()} className="bg-emerald-600 text-white hover:bg-emerald-500">{saving ? "Kaydediliyor..." : employee ? "Güncelle" : "Ekle"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BulkUploadDialog({ open, onOpenChange, companies, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; companies: OsgbWorkspaceCompanyOption[]; onSaved: () => void }) {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [companyId, setCompanyId] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<BulkPreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompanyId(companies[0]?.id || "");
    setFileName("");
    setPreviewRows([]);
  }, [companies, open]);

  const selectedCompany = companies.find((company) => company.id === companyId);
  const validRows = previewRows.filter((row) => row.valid && row.input);
  const invalidRows = previewRows.filter((row) => !row.valid);

  const downloadTemplate = () => {
    const worksheet = xlsxUtils.json_to_sheet([
      {
        Firma: "ABC İnşaat",
        "TC Kimlik No": "12345678901",
        Ad: "Ahmet",
        Soyad: "Yılmaz",
        Pozisyon: "Üretim Operatörü",
        "Doğum Tarihi": "1990-05-15",
        Yaş: 36,
        Cinsiyet: "Erkek",
        "İşe Giriş Tarihi": "2026-01-10",
        "Çalıştığı Bölüm": "Üretim",
        "Eğitim Tarihi": "2026-02-01",
        "Periyodik Muayene Tarihi": "2026-03-01",
        "Üst Beden No": "L",
        "Ayakkabı No": "42",
        "Eğitim Konusu": "Temel İSG Eğitimi",
        Meslek: "Makine Operatörü",
        Telefon: "0555 000 00 00",
        "E-posta": "ahmet.yilmaz@ornek.com",
        Notlar: "Örnek çalışan kaydı",
      },
    ], { header: templateHeaders });
    const workbook = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(workbook, worksheet, "Çalışanlar");
    writeFile(workbook, "osgb-calisan-toplu-yukleme-sablonu.xlsx");
  };

  const parseFile = async (file: File) => {
    if (!organizationId || !user?.id) return toast.error("Organizasyon bağlantısı gerekli.");
    if (!companyId) return toast.error("Önce çalışanların ekleneceği firmayı seçin.");

    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsxUtils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const parsed: BulkPreviewRow[] = rows.map((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const tcNumber = normalizeTc(getCell(row, ["TC Kimlik No", "TC", "Tc No"]));
      const firstName = getCell(row, ["Ad", "İsim", "Isim"]);
      const lastName = getCell(row, ["Soyad", "Soyisim"]);
      if (!tcNumber) errors.push("TC Kimlik No boş.");
      else if (!/^\d{11}$/.test(tcNumber)) errors.push("TC Kimlik No 11 haneli olmalı.");
      if (!firstName) errors.push("Ad boş.");
      if (!lastName) errors.push("Soyad boş.");

      const birthDate = parseOptionalDate(getCell(row, ["Doğum Tarihi", "Dogum Tarihi"]));
      const startDate = parseOptionalDate(getCell(row, ["İşe Giriş Tarihi", "Ise Giris Tarihi"]));
      const trainingDate = parseOptionalDate(getCell(row, ["Eğitim Tarihi", "Egitim Tarihi"]));
      const periodicExamDate = parseOptionalDate(getCell(row, ["Periyodik Muayene Tarihi", "Periyodik Muayene", "EK2"]));
      if (birthDate.warning) warnings.push("Doğum tarihi okunamadı, boş aktarılacak.");
      if (startDate.warning) warnings.push("İşe giriş tarihi okunamadı, boş aktarılacak.");
      if (trainingDate.warning) warnings.push("Eğitim tarihi okunamadı, boş aktarılacak.");
      if (periodicExamDate.warning) warnings.push("Periyodik muayene tarihi okunamadı, boş aktarılacak.");

      const ageRaw = getCell(row, ["Yaş", "Yas"]);
      const age = ageRaw && Number.isFinite(Number(ageRaw)) ? Number(ageRaw) : null;
      const input: OsgbCompanyEmployeeInput | null = errors.length ? null : {
        organizationId,
        userId: user.id,
        companyId,
        tcNumber,
        firstName,
        lastName,
        position: getCell(row, ["Pozisyon"]),
        jobTitle: getCell(row, ["Pozisyon"]),
        birthDate: birthDate.value || null,
        age,
        gender: getCell(row, ["Cinsiyet"]),
        startDate: startDate.value || null,
        department: getCell(row, ["Çalıştığı Bölüm", "Calistigi Bolum", "Bölüm", "Bolum"]),
        trainingDate: trainingDate.value || null,
        periodicExamDate: periodicExamDate.value || null,
        upperBodySize: getCell(row, ["Üst Beden No", "Ust Beden No"]),
        shoeSize: getCell(row, ["Ayakkabı No", "Ayakkabi No"]),
        trainingTopic: getCell(row, ["Eğitim Konusu", "Egitim Konusu"]),
        occupation: getCell(row, ["Meslek"]),
        phone: getCell(row, ["Telefon"]),
        email: getCell(row, ["E-posta", "Email", "Eposta"]),
        notes: getCell(row, ["Notlar", "Not"]),
      };

      return { rowNumber: index + 2, valid: errors.length === 0, errors, warnings, input };
    });
    setPreviewRows(parsed);
  };

  const handleUpload = async () => {
    if (!validRows.length) return;
    setUploading(true);
    try {
      await upsertOsgbCompanyEmployeesFromExcel(validRows.map((row) => row.input!));
      toast.success(`${validRows.length} çalışan yüklendi.`);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplu çalışan yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex max-h-[92vh] max-w-[920px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#1b2638] p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">Toplu Çalışan Yükle</DialogTitle>
        <DialogDescription className="sr-only">Excel ile çalışan listesi yükleyin.</DialogDescription>
        <div className="flex items-start justify-between border-b border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><FileSpreadsheet className="h-6 w-6" /></div><div><h2 className="text-xl font-black text-white">Toplu Çalışan Yükle</h2><p className="mt-1 text-sm text-slate-400">Excel ile çalışan listesi yükleyin — seçilen firmaya görevlendirilmiş tüm personele yansır.</p></div></div>
          <DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-2"><Label className="text-slate-300">Çalışanların Ekleneceği Firma *</Label><Select value={companyId} onValueChange={setCompanyId}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Firma seçin" /></SelectTrigger><SelectContent className={selectContentClass}>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex flex-wrap gap-2"><Button type="button" onClick={downloadTemplate} className="bg-slate-800 text-slate-100 hover:bg-slate-700"><Download className="mr-2 h-4 w-4" />Şablon Excel İndir</Button><label className="inline-flex h-10 cursor-pointer items-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"><Upload className="mr-2 h-4 w-4" />Excel Dosyası Seç<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseFile(file); event.currentTarget.value = ""; }} /></label>{fileName ? <span className="inline-flex items-center rounded-xl border border-slate-700 px-3 text-sm text-slate-300">{fileName}</span> : null}</div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-100">Firma kolonu şablonda bulunur fakat yükleme sırasında seçtiğiniz firma esas alınır. TC Kimlik No, Ad ve Soyad zorunludur.</div>
          {previewRows.length ? <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-3"><div className="mb-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">Geçerli: {validRows.length}</span><span className="rounded-full bg-rose-500/15 px-3 py-1 text-rose-200">Hatalı: {invalidRows.length}</span><span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">Firma: {selectedCompany?.companyName || "-"}</span></div><div className="max-h-72 overflow-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-slate-400"><tr><th className="p-2">Satır</th><th className="p-2">Durum</th><th className="p-2">TC</th><th className="p-2">Ad Soyad</th><th className="p-2">Uyarı/Hata</th></tr></thead><tbody>{previewRows.map((row) => <tr key={row.rowNumber} className="border-t border-slate-800"><td className="p-2">{row.rowNumber}</td><td className={cn("p-2 font-bold", row.valid ? "text-emerald-300" : "text-rose-300")}>{row.valid ? "Geçerli" : "Hatalı"}</td><td className="p-2">{row.input?.tcNumber || "-"}</td><td className="p-2">{row.input ? `${row.input.firstName} ${row.input.lastName}` : "-"}</td><td className="p-2 text-slate-400">{[...row.errors, ...row.warnings].join(" · ") || "-"}</td></tr>)}</tbody></table></div></div> : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-700 bg-slate-950/50 p-4"><Button type="button" disabled={uploading} onClick={() => onOpenChange(false)} className="bg-slate-700 text-white hover:bg-slate-600">İptal</Button><Button type="button" disabled={uploading || validRows.length === 0} onClick={() => void handleUpload()} className="bg-violet-600 text-white hover:bg-violet-500">{uploading ? "Yükleniyor..." : "Yükle"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

export function OSGBCompanyEmployeesPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [companies, setCompanies] = useState<OsgbWorkspaceCompanyOption[]>([]);
  const [employees, setEmployees] = useState<OsgbCompanyEmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [sort, setSort] = useState("name_asc");
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<OsgbCompanyEmployeeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OsgbCompanyEmployeeRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setCompanies([]);
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [companyRows, employeeRows] = await Promise.all([
        listOsgbWorkspaceCompanies(organizationId),
        listOsgbCompanyEmployees(organizationId),
      ]);
      setCompanies(companyRows);
      setEmployees(employeeRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma çalışanları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const filteredEmployees = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("tr-TR");
    const rows = employees.filter((employee) => {
      if (companyFilter !== ALL_COMPANIES && employee.companyId !== companyFilter) return false;
      if (!normalized) return true;
      return `${employee.fullName} ${employee.tcNumber || ""} ${employee.companyName}`.toLocaleLowerCase("tr-TR").includes(normalized);
    });

    return rows.sort((a, b) => {
      if (sort === "name_desc") return b.fullName.localeCompare(a.fullName, "tr-TR");
      if (sort === "date_desc") return (b.startDate || "").localeCompare(a.startDate || "");
      return a.fullName.localeCompare(b.fullName, "tr-TR");
    });
  }, [companyFilter, employees, search, sort]);

  const openCreateDialog = () => {
    setEditingEmployee(null);
    setEmployeeDialogOpen(true);
  };

  const openEditDialog = (employee: OsgbCompanyEmployeeRecord) => {
    setEditingEmployee(employee);
    setEmployeeDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteOsgbCompanyEmployee(deleteTarget.id);
      toast.success("Çalışan silindi.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Çalışan silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-300" /></div>;

  return (
    <div className="min-h-full rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-slate-100 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300"><Users className="h-5 w-5" /></div>
          <div><h2 className="text-xl font-black text-white">Firma Çalışanları</h2><p className="mt-1 text-sm text-slate-400">OSGB firmalarınıza ait çalışan kayıtlarını yönetin.</p></div>
        </div>
        <div className="flex flex-wrap gap-2"><Button type="button" className="bg-violet-600 text-white hover:bg-violet-500" onClick={() => setBulkDialogOpen(true)}><Upload className="mr-2 h-4 w-4" />Toplu Yükle</Button><Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" />Yeni Çalışan</Button></div>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)_minmax(160px,0.45fr)]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="İsim, TC Kimlik No ara..." /></div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Tüm Firmalar" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value={ALL_COMPANIES}>Tüm Firmalar</SelectItem>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={setSort}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="İsim (A-Z)" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="name_asc">İsim (A-Z)</SelectItem><SelectItem value="name_desc">İsim (Z-A)</SelectItem><SelectItem value="date_desc">İşe giriş tarihi</SelectItem></SelectContent></Select>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{error}</div> : null}

      <div className="min-h-[260px] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/50">
        {filteredEmployees.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-950/50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-3">Çalışan</th><th className="p-3">TC Kimlik No</th><th className="p-3">Firma</th><th className="p-3">Pozisyon</th><th className="p-3">Çalıştığı Bölüm</th><th className="p-3">İşe Giriş</th><th className="p-3">Periyodik Muayene</th><th className="p-3 text-right">İşlemler</th></tr></thead>
              <tbody>{filteredEmployees.map((employee) => (<tr key={employee.id} className="border-t border-slate-800 transition hover:bg-slate-800/40"><td className="p-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-slate-300"><UserRound className="h-4 w-4" /></div><div><p className="font-bold text-white">{employee.fullName}</p><p className="text-xs text-slate-500">{employee.email || employee.phone || "İletişim yok"}</p></div></div></td><td className="p-3 text-slate-300">{employee.tcNumber || "-"}</td><td className="p-3 text-slate-300">{employee.companyName}</td><td className="p-3 text-slate-300">{employee.position || "-"}</td><td className="p-3 text-slate-300">{employee.department || "-"}</td><td className="p-3 text-slate-300">{formatDate(employee.startDate)}</td><td className="p-3 text-slate-300">{formatDate(employee.periodicExamDate)}</td><td className="p-3"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => openEditDialog(employee)} className="text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"><Edit2 className="mr-1 h-4 w-4" />Düzenle</Button><Button size="sm" variant="ghost" onClick={() => setDeleteTarget(employee)} className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"><Trash2 className="mr-1 h-4 w-4" />Sil</Button></div></td></tr>))}</tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-[245px] place-items-center p-6 text-center">
            <div>
              <Users className="mx-auto h-12 w-12 text-slate-600" />
              <h3 className="mt-4 text-base font-black text-slate-300">Henüz kayıtlı çalışan bulunmuyor.</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Yeni çalışan ekleyebilir veya Excel ile toplu yükleme yapabilirsiniz.</p>
            </div>
          </div>
        )}
      </div>

      <EmployeeDialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen} companies={companies} employee={editingEmployee} onSaved={() => void loadData()} />
      <BulkUploadDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} companies={companies} onSaved={() => void loadData()} />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-slate-700 bg-slate-950 text-slate-50">
          <AlertDialogHeader><AlertDialogTitle>Çalışan Silinsin mi?</AlertDialogTitle><AlertDialogDescription className="text-slate-400">Bu çalışan kaydı silinecek. Bu işlem geri alınamaz.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deleting} className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700">İptal</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void handleDelete(); }} className="bg-rose-600 text-white hover:bg-rose-500">Sil</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
