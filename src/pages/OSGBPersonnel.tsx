import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Upload,
  UserCog,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteOsgbPersonnel,
  getOsgbPersonnelAssignedMinutes,
  listOsgbPersonnelIdentity,
  listOsgbPersonnelPage,
  type OsgbPersonnelInput,
  type OsgbPersonnelRecord,
  upsertOsgbPersonnel,
} from "@/lib/osgbOperations";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { useAccessRole } from "@/hooks/useAccessRole";
import { downloadCsv } from "@/lib/csvExport";

type PersonnelFormState = {
  fullName: string;
  role: OsgbPersonnelRecord["role"];
  certificateNo: string;
  certificateExpiryDate: string;
  expertiseAreas: string;
  phone: string;
  email: string;
  monthlyCapacityMinutes: string;
  isActive: "active" | "passive";
  notes: string;
};

type ImportSummary = {
  addedCount: number;
  errorCount: number;
  errors: string[];
};

const emptyForm: PersonnelFormState = {
  fullName: "",
  role: "igu",
  certificateNo: "",
  certificateExpiryDate: "",
  expertiseAreas: "",
  phone: "",
  email: "",
  monthlyCapacityMinutes: "",
  isActive: "active",
  notes: "",
};

const roleLabels: Record<OsgbPersonnelRecord["role"], string> = {
  igu: "İGU",
  hekim: "İşyeri Hekimi",
  dsp: "DSP",
};

const roleIcons = {
  igu: ShieldCheck,
  hekim: Stethoscope,
  dsp: UserCog,
};

const roleBadgeClass: Record<OsgbPersonnelRecord["role"], string> = {
  igu: "bg-cyan-500/15 text-cyan-200 border-cyan-400/20",
  hekim: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  dsp: "bg-violet-500/15 text-violet-200 border-violet-400/20",
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const getCacheKey = (userId: string) => `personnel:${userId}`;
const PERSONNEL_PAGE_SIZE = 20;

const expectedColumns = [
  { key: "full_name", required: true, description: "Personelin ad soyadı" },
  { key: "role", required: true, description: "igu, hekim veya dsp" },
  { key: "monthly_capacity_minutes", required: true, description: "Aylık dakika kapasitesi" },
  { key: "certificate_no", required: false, description: "Belge numarası" },
  { key: "certificate_expiry_date", required: false, description: "YYYY-MM-DD formatında belge bitiş tarihi" },
  { key: "expertise_areas", required: false, description: "Virgülle ayrılmış uzmanlık alanları" },
  { key: "phone", required: false, description: "Telefon" },
  { key: "email", required: false, description: "E-posta" },
  { key: "is_active", required: false, description: "active veya passive" },
  { key: "notes", required: false, description: "Serbest açıklama" },
];

const columnAliases: Record<string, string> = {
  ad_soyad: "full_name",
  adsoyad: "full_name",
  full_name: "full_name",
  fullname: "full_name",
  isim: "full_name",
  rol: "role",
  role: "role",
  belge_no: "certificate_no",
  belge_numarasi: "certificate_no",
  certificate_no: "certificate_no",
  belge_gecerlilik_tarihi: "certificate_expiry_date",
  belge_bitis_tarihi: "certificate_expiry_date",
  certificate_expiry_date: "certificate_expiry_date",
  uzmanlik_alanlari: "expertise_areas",
  uzmanlik: "expertise_areas",
  expertise_areas: "expertise_areas",
  telefon: "phone",
  phone: "phone",
  eposta: "email",
  email: "email",
  aylik_kapasite: "monthly_capacity_minutes",
  aylik_kapasite_dakika: "monthly_capacity_minutes",
  monthly_capacity_minutes: "monthly_capacity_minutes",
  durum: "is_active",
  is_active: "is_active",
  notlar: "notes",
  notes: "notes",
};

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "_")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u");

const normalizeRole = (value: string): OsgbPersonnelRecord["role"] | null => {
  const normalized = normalizeKey(value);
  if (normalized === "igu" || normalized === "is_guvenligi_uzmani") return "igu";
  if (normalized === "hekim" || normalized === "isyeri_hekimi") return "hekim";
  if (normalized === "dsp" || normalized === "diger_saglik_personeli") return "dsp";
  return null;
};

const normalizeStatus = (value: string | undefined) => {
  const normalized = normalizeKey(value || "");
  if (["", "active", "aktif", "true", "1", "evet"].includes(normalized)) return true;
  if (["passive", "pasif", "false", "0", "hayir"].includes(normalized)) return false;
  return true;
};

const normalizeIdentityValue = (value: string | null | undefined) => normalizeKey(value || "");

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const downloadPersonnelTemplate = () => {
  const worksheet = XLSX.utils.json_to_sheet([
    {
      full_name: "Ahmet Yılmaz",
      role: "igu",
      monthly_capacity_minutes: 1800,
      certificate_no: "IGU-12345",
      certificate_expiry_date: "2027-12-31",
      expertise_areas: "İnşaat, Üretim",
      phone: "05551234567",
      email: "ahmet@example.com",
      is_active: "active",
      notes: "A sınıfı uzman",
    },
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "OSGB Personel");
  XLSX.writeFile(workbook, "osgb-personel-sablonu.xlsx");
};

const parsePersonnelExcel = async (file: File): Promise<OsgbPersonnelInput[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

  if (!rows.length) {
    throw new Error("Dosyada veri bulunamadı.");
  }

  const parsedRows: OsgbPersonnelInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const mapped: Record<string, string> = {};

    Object.entries(row).forEach(([key, value]) => {
      const normalizedColumn = columnAliases[normalizeKey(key)] || normalizeKey(key);
      mapped[normalizedColumn] = String(value ?? "").trim();
    });

    const fullName = mapped.full_name;
    const role = normalizeRole(mapped.role || "");
    const monthlyCapacity = Number(mapped.monthly_capacity_minutes || 0);

    if (!fullName) {
      errors.push(`Satır ${index + 2}: full_name zorunlu.`);
      return;
    }

    if (!role) {
      errors.push(`Satır ${index + 2}: role alanı igu, hekim veya dsp olmalı.`);
      return;
    }

    if (!monthlyCapacity || monthlyCapacity <= 0) {
      errors.push(`Satır ${index + 2}: monthly_capacity_minutes sıfırdan büyük olmalı.`);
      return;
    }

    if (mapped.certificate_expiry_date && !isIsoDate(mapped.certificate_expiry_date)) {
      errors.push(`Satır ${index + 2}: certificate_expiry_date YYYY-MM-DD formatında olmalı.`);
      return;
    }

    parsedRows.push({
      fullName,
      role,
      certificateNo: mapped.certificate_no || null,
      certificateExpiryDate: mapped.certificate_expiry_date || null,
      expertiseAreas: mapped.expertise_areas
        ? mapped.expertise_areas.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
      phone: mapped.phone || null,
      email: mapped.email || null,
      monthlyCapacityMinutes: monthlyCapacity,
      isActive: normalizeStatus(mapped.is_active),
      notes: mapped.notes || null,
    });
  });

  if (errors.length) {
    throw new Error(errors.slice(0, 6).join("\n"));
  }

  return parsedRows;
};

export default function OSGBPersonnel() {
  const { user } = useAuth();
  const { canManage } = useAccessRole();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [records, setRecords] = useState<OsgbPersonnelRecord[]>([]);
  const [assignedMinutesByPersonnel, setAssignedMinutesByPersonnel] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OsgbPersonnelRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [form, setForm] = useState<PersonnelFormState>(emptyForm);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);

  const loadData = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try {
      const personnelResult = await listOsgbPersonnelPage(user.id, {
        page,
        pageSize: PERSONNEL_PAGE_SIZE,
        role: roleFilter,
        status: statusFilter,
        search,
      });
      const assignmentSummary = await getOsgbPersonnelAssignedMinutes(
        user.id,
        personnelResult.rows.map((item) => item.id),
      );
      setRecords(personnelResult.rows);
      setAssignedMinutesByPersonnel(assignmentSummary);
      setTotalCount(personnelResult.count);
      writeOsgbPageCache(`${getCacheKey(user.id)}:${roleFilter}:${statusFilter}:${search}:${page}`, {
        records: personnelResult.rows,
        assignedMinutesByPersonnel: assignmentSummary,
        totalCount: personnelResult.count,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Personel havuzu yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const cached = readOsgbPageCache<{
      records: OsgbPersonnelRecord[];
      assignedMinutesByPersonnel: Record<string, number>;
      totalCount: number;
    }>(
      `${getCacheKey(user.id)}:${roleFilter}:${statusFilter}:${search}:${page}`,
      CACHE_TTL_MS,
    );
    if (cached) {
      setRecords(cached.records);
      setAssignedMinutesByPersonnel(cached.assignedMinutesByPersonnel);
      setTotalCount(cached.totalCount);
      setLoading(false);
      void loadData(true);
      return;
    }
    void loadData();
  }, [page, roleFilter, search, statusFilter, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, search, statusFilter]);

  const summary = useMemo(() => {
    const active = records.filter((item) => item.is_active).length;
    const expiringSoon = records.filter((item) => {
      if (!item.certificate_expiry_date) return false;
      const diff = new Date(item.certificate_expiry_date).getTime() - Date.now();
      return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 45;
    }).length;
    return {
      active,
      igu: records.filter((item) => item.role === "igu" && item.is_active).length,
      hekim: records.filter((item) => item.role === "hekim" && item.is_active).length,
      dsp: records.filter((item) => item.role === "dsp" && item.is_active).length,
      expiringSoon,
    };
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PERSONNEL_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (record: OsgbPersonnelRecord) => {
    setEditing(record);
    setForm({
      fullName: record.full_name,
      role: record.role,
      certificateNo: record.certificate_no || "",
      certificateExpiryDate: record.certificate_expiry_date || "",
      expertiseAreas: (record.expertise_areas || []).join(", "),
      phone: record.phone || "",
      email: record.email || "",
      monthlyCapacityMinutes: String(record.monthly_capacity_minutes || ""),
      isActive: record.is_active ? "active" : "passive",
      notes: record.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!user?.id || !form.fullName || !form.monthlyCapacityMinutes) {
      toast.error("Ad soyad ve aylık kapasite zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const payload: OsgbPersonnelInput = {
        fullName: form.fullName,
        role: form.role,
        certificateNo: form.certificateNo,
        certificateExpiryDate: form.certificateExpiryDate,
        expertiseAreas: form.expertiseAreas
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        phone: form.phone,
        email: form.email,
        monthlyCapacityMinutes: Number(form.monthlyCapacityMinutes),
        isActive: form.isActive === "active",
        notes: form.notes,
      };

      await upsertOsgbPersonnel(user.id, payload, editing?.id);
      await loadData(true);
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Personel kaydı güncellendi." : "Personel havuza eklendi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Personel kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!confirm("Bu personeli havuzdan silmek istiyor musunuz?")) return;
    try {
      await deleteOsgbPersonnel(id);
      await loadData(true);
      toast.success("Personel kaydı silindi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Personel kaydı silinemedi.");
    }
  };

  const handleExcelImport = async (file: File) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!user?.id) return;

    setImporting(true);
    try {
      const rows = await parsePersonnelExcel(file);
      const identityRows = await listOsgbPersonnelIdentity(user.id);
      const existingEmails = new Set(
        identityRows.map((record) => normalizeIdentityValue(record.email)).filter(Boolean),
      );
      const existingCertificateNos = new Set(
        identityRows.map((record) => normalizeIdentityValue(record.certificate_no)).filter(Boolean),
      );
      const batchEmails = new Set<string>();
      const batchCertificateNos = new Set<string>();
      const validRows: OsgbPersonnelInput[] = [];
      const importErrors: string[] = [];

      rows.forEach((row, index) => {
        const emailKey = normalizeIdentityValue(row.email);
        const certificateKey = normalizeIdentityValue(row.certificateNo);

        if (emailKey && (existingEmails.has(emailKey) || batchEmails.has(emailKey))) {
          importErrors.push(`Satır ${index + 2}: aynı e-posta ile mükerrer kayıt var (${row.email}).`);
          return;
        }

        if (certificateKey && (existingCertificateNos.has(certificateKey) || batchCertificateNos.has(certificateKey))) {
          importErrors.push(`Satır ${index + 2}: aynı belge no ile mükerrer kayıt var (${row.certificateNo}).`);
          return;
        }

        if (emailKey) batchEmails.add(emailKey);
        if (certificateKey) batchCertificateNos.add(certificateKey);
        validRows.push(row);
      });

      const savedRows: OsgbPersonnelRecord[] = [];
      for (const row of validRows) {
        const saved = await upsertOsgbPersonnel(user.id, row);
        savedRows.push(saved);
      }

      await loadData(true);
      setImportSummary({
        addedCount: savedRows.length,
        errorCount: importErrors.length,
        errors: importErrors,
      });
      setSummaryDialogOpen(true);

      if (savedRows.length) {
        toast.success(`${savedRows.length} personel kaydı içe aktarıldı.`);
      } else {
        toast.error("İçe aktarma tamamlandı ancak geçerli kayıt bulunamadı.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Excel içe aktarma başarısız oldu.";
      setImportSummary({
        addedCount: 0,
        errorCount: 1,
        errors: message.split("\n"),
      });
      setSummaryDialogOpen(true);
      toast.error("Excel içe aktarma başarısız oldu.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">OSGB Personel Havuzu</h1>
              <p className="text-sm text-slate-400">
                İGU, işyeri hekimi ve DSP personellerini tek havuzdan yönetin. Belge geçerlilikleri, uzmanlık alanları ve kapasite dolulukları birlikte izlenir.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleExcelImport(file);
              }
            }}
          />
          <Button variant="outline" onClick={() => downloadPersonnelTemplate()}>
            <Download className="mr-2 h-4 w-4" />
            Excel şablonu indir
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!canManage || importing}>
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "İçe aktarılıyor..." : "Excel ile yükle"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "osgb-personel.csv",
                ["Ad Soyad", "Rol", "Belge No", "Belge Bitiş", "Uzmanlık", "Kapasite"],
                records.map((record) => [
                  record.full_name,
                  roleLabels[record.role],
                  record.certificate_no || "",
                  record.certificate_expiry_date || "",
                  (record.expertise_areas || []).join(", "),
                  record.monthly_capacity_minutes,
                ]),
              )
            }
          >
            Dışa Aktar
          </Button>
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button onClick={openCreate} disabled={!canManage}>
            <Plus className="mr-2 h-4 w-4" />
            Personel ekle
          </Button>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <FileSpreadsheet className="h-5 w-5 text-cyan-300" />
            Excel ile toplu personel yükleme
          </CardTitle>
          <CardDescription>
            Kullanıcı tek tek personel eklemek zorunda kalmadan şablona göre Excel yükleyebilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm font-medium text-white">Excel dosyasında olması gereken kolonlar</div>
            <div className="space-y-2 text-sm text-slate-300">
              {expectedColumns.map((column) => (
                <div key={column.key} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <Badge variant={column.required ? "default" : "outline"}>
                    {column.required ? "Zorunlu" : "Opsiyonel"}
                  </Badge>
                  <div>
                    <div className="font-mono text-xs text-cyan-200">{column.key}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{column.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm font-medium text-white">Kullanıcıya söylenecekler</div>
            <div className="space-y-2 text-sm leading-6 text-slate-300">
              <p>1. Önce <span className="font-medium text-white">Excel şablonu indir</span> butonuna bas.</p>
              <p>2. İlk satırdaki kolon adlarını değiştirme.</p>
              <p>3. <span className="font-mono text-cyan-200">role</span> alanına sadece <span className="font-mono text-cyan-200">igu</span>, <span className="font-mono text-cyan-200">hekim</span> veya <span className="font-mono text-cyan-200">dsp</span> yaz.</p>
              <p>4. <span className="font-mono text-cyan-200">certificate_expiry_date</span> alanını <span className="font-mono text-cyan-200">YYYY-MM-DD</span> formatında gir.</p>
              <p>5. <span className="font-mono text-cyan-200">expertise_areas</span> alanında birden fazla uzmanlık varsa virgülle ayır.</p>
              <p>6. <span className="font-mono text-cyan-200">monthly_capacity_minutes</span> alanı sayı olmalı.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Toplam kayıt</CardDescription><CardTitle className="text-3xl text-white">{totalCount}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Bu sayfadaki İGU</CardDescription><CardTitle className="text-3xl text-white">{summary.igu}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Bu sayfadaki işyeri hekimi</CardDescription><CardTitle className="text-3xl text-white">{summary.hekim}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Bu sayfadaki DSP</CardDescription><CardTitle className="text-3xl text-white">{summary.dsp}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Bu sayfadaki belgesi yaklaşan</CardDescription><CardTitle className="text-3xl text-white">{summary.expiringSoon}</CardTitle></CardHeader></Card>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Personel verisi yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader className="pb-4">
          <CardTitle className="text-white">Filtreler</CardTitle>
          <CardDescription>Rol, durum ve arama ile personel havuzunu yönetin.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Arama</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, belge no, uzmanlık veya e-posta..." className="pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Tüm roller" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm roller</SelectItem>
                <SelectItem value="igu">İGU</SelectItem>
                <SelectItem value="hekim">İşyeri Hekimi</SelectItem>
                <SelectItem value="dsp">DSP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Durum</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Tüm durumlar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="passive">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Personel listesi</CardTitle>
          <CardDescription>Belge geçerliliği, uzmanlık alanı ve kapasite doluluğu birlikte gösterilir.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Personel havuzu yükleniyor...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead>Personel</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Belge / Geçerlilik</TableHead>
                  <TableHead>Uzmanlık alanı</TableHead>
                  <TableHead>Kapasite</TableHead>
                  <TableHead>Doluluk</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      Personel bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : records.map((record) => {
                  const assignedMinutes = assignedMinutesByPersonnel[record.id] || 0;
                  const ratio = record.monthly_capacity_minutes > 0 ? Math.round((assignedMinutes / record.monthly_capacity_minutes) * 100) : 0;
                  const RoleIcon = roleIcons[record.role];

                  return (
                    <TableRow key={record.id} className="border-slate-800">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">{record.full_name}</div>
                          <div className="text-xs text-slate-400">{record.email || "-"} {record.phone ? `• ${record.phone}` : ""}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleBadgeClass[record.role]}><RoleIcon className="mr-1 h-3.5 w-3.5" />{roleLabels[record.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div className="text-white">{record.certificate_no || "-"}</div>
                          <div className="flex items-center gap-1 text-slate-400">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatDate(record.certificate_expiry_date)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(record.expertise_areas || []).length > 0
                            ? record.expertise_areas?.map((item) => (
                                <Badge key={item} variant="outline" className="border-slate-700 text-slate-300">{item}</Badge>
                              ))
                            : <span className="text-xs text-slate-500">Tanımlanmadı</span>}
                        </div>
                      </TableCell>
                      <TableCell>{record.monthly_capacity_minutes} dk</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-white">{assignedMinutes} dk / %{Math.min(ratio, 999)}</div>
                          <div className="h-2 rounded-full bg-slate-800">
                            <div className={`h-2 rounded-full ${ratio >= 100 ? "bg-red-500" : ratio >= 80 ? "bg-yellow-500" : "bg-cyan-500"}`} style={{ width: `${Math.min(ratio, 100)}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(record)}>Düzenle</Button>
                          <Button size="sm" variant="ghost" className="text-rose-300 hover:text-rose-200" onClick={() => void handleDelete(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {totalCount > PERSONNEL_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>Sayfa {page} / {totalPages} • Toplam kayıt {totalCount}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Personel kaydını düzenle" : "Yeni personel ekle"}</DialogTitle>
            <DialogDescription>OSGB personel havuzuna yeni personel ekleyin veya mevcut kaydı güncelleyin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Ad soyad</Label>
              <Input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as PersonnelFormState["role"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="igu">İGU</SelectItem>
                  <SelectItem value="hekim">İşyeri Hekimi</SelectItem>
                  <SelectItem value="dsp">DSP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aylık kapasite (dk)</Label>
              <Input type="number" min="0" value={form.monthlyCapacityMinutes} onChange={(e) => setForm((prev) => ({ ...prev, monthlyCapacityMinutes: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Belge numarası</Label>
              <Input value={form.certificateNo} onChange={(e) => setForm((prev) => ({ ...prev, certificateNo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Belge geçerlilik tarihi</Label>
              <Input type="date" value={form.certificateExpiryDate} onChange={(e) => setForm((prev) => ({ ...prev, certificateExpiryDate: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Uzmanlık alanları</Label>
              <Input value={form.expertiseAreas} onChange={(e) => setForm((prev) => ({ ...prev, expertiseAreas: e.target.value }))} placeholder="İnşaat, üretim, perakende..." />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select value={form.isActive} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value as PersonnelFormState["isActive"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="passive">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notlar</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>İçe aktarma özeti</DialogTitle>
            <DialogDescription>
              Yükleme tamamlandıktan sonra eklenen ve hatalı satır sayısı burada gösterilir.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="mb-2 flex items-center gap-2 text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Başarılı kayıtlar
              </div>
              <div className="text-3xl font-bold text-white">{importSummary?.addedCount ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="mb-2 flex items-center gap-2 text-rose-200">
                <XCircle className="h-4 w-4" />
                Hatalı satırlar
              </div>
              <div className="text-3xl font-bold text-white">{importSummary?.errorCount ?? 0}</div>
            </div>
          </div>

          {importSummary?.errors.length ? (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-sm font-medium text-white">Hata detayları</div>
              <div className="space-y-2 text-sm text-slate-300">
                {importSummary.errors.slice(0, 8).map((item) => (
                  <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setSummaryDialogOpen(false)}>Tamam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


