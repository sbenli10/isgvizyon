import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Download,
  Eye,
  FileSpreadsheet,
  FileUp,
  LifeBuoy,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { OsgbCompanyOption } from "@/lib/osgbOperations";
import { readPageSessionCache, writePageSessionCache } from "@/lib/pageSessionCache";
import {
  createPeriodicControlTasks,
  deletePeriodicControl,
  deletePeriodicControlReport,
  getPeriodicControlCompanyOptions,
  getPeriodicControlReportDownloadUrl,
  listPeriodicControlReportHistory,
  listPeriodicControlReportHistoryPage,
  listPeriodicControlReports,
  listPeriodicControls,
  listPeriodicControlsPage,
  type PeriodicControlInput,
  type PeriodicControlRecord,
  type PeriodicControlReportRecord,
  type PeriodicControlResult,
  type PeriodicControlStatus,
  upsertPeriodicControl,
  uploadPeriodicControlReport,
} from "@/lib/periodicControlOperations";

type ControlFormState = {
  companyId: string;
  equipmentName: string;
  controlCategory: string;
  location: string;
  responsibleVendor: string;
  standardReference: string;
  lastControlDate: string;
  nextControlDate: string;
  status: PeriodicControlStatus;
  resultStatus: PeriodicControlResult;
  notes: string;
};

type ReportFormState = {
  reportDate: string;
  reportSummary: string;
  file: File | null;
};

type PeriodicControlImportRow = Record<string, string>;

const emptyForm: ControlFormState = {
  companyId: "",
  equipmentName: "",
  controlCategory: "",
  location: "",
  responsibleVendor: "",
  standardReference: "",
  lastControlDate: "",
  nextControlDate: "",
  status: "scheduled",
  resultStatus: "not_evaluated",
  notes: "",
};

const emptyReportForm: ReportFormState = {
  reportDate: new Date().toISOString().slice(0, 10),
  reportSummary: "",
  file: null,
};
const PERIODIC_CACHE_TTL = 5 * 60 * 1000;
const PERIODIC_CONTROLS_PAGE_SIZE = 10;
const PERIODIC_REPORTS_PAGE_SIZE = 10;

const statusLabel: Record<PeriodicControlStatus, string> = {
  scheduled: "Planlandı",
  warning: "Yaklaşıyor",
  overdue: "Gecikti",
  completed: "Tamamlandı",
  inactive: "Pasif",
};

const statusClass: Record<PeriodicControlStatus, string> = {
  scheduled: "border-sky-400/20 bg-sky-500/15 text-sky-200",
  warning: "border-amber-400/20 bg-amber-500/15 text-amber-200",
  overdue: "border-red-400/20 bg-red-500/15 text-red-200",
  completed: "border-emerald-400/20 bg-emerald-500/15 text-emerald-200",
  inactive: "border-slate-400/20 bg-slate-500/15 text-slate-200",
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("tr-TR") : "-";

const normalizeHeader = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/\s+/g, "_");

const readWorkbookRows = (file: File): Promise<PeriodicControlImportRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
        resolve(
          rows.map((row) => {
            const normalized: PeriodicControlImportRow = {};
            Object.entries(row).forEach(([key, value]) => {
              normalized[normalizeHeader(key)] = String(value ?? "").trim();
            });
            return normalized;
          }),
        );
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadi."));
    reader.readAsArrayBuffer(file);
  });

const downloadPeriodicControlTemplate = () => {
  const rows = [
    ["company_name", "equipment_name", "control_category", "location", "responsible_vendor", "standard_reference", "last_control_date", "next_control_date", "status", "result_status", "notes"],
    ["Benli AS", "Forklift 07", "Kaldirma Ekipmani", "Depo - Hat 2", "ABC Kontrol", "TS EN 1459", "2026-01-15", "2026-07-15", "scheduled", "not_evaluated", "Yariyil kontrol planina alindi"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "PeriyodikKontrol");
  XLSX.writeFile(workbook, "periyodik-kontrol-sablonu.xlsx");
};

export default function PeriodicControls() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [taskRefreshing, setTaskRefreshing] = useState(false);
  const [controls, setControls] = useState<PeriodicControlRecord[]>([]);
  const [reports, setReports] = useState<PeriodicControlReportRecord[]>([]);
  const [selectedReports, setSelectedReports] = useState<PeriodicControlReportRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbCompanyOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<PeriodicControlRecord | null>(null);
  const [uploadTarget, setUploadTarget] = useState<PeriodicControlRecord | null>(null);
  const [form, setForm] = useState<ControlFormState>(emptyForm);
  const [reportForm, setReportForm] = useState<ReportFormState>(emptyReportForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PeriodicControlStatus | "ALL">("ALL");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [controlsPage, setControlsPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [controlsTotalCount, setControlsTotalCount] = useState(0);
  const [reportsTotalCount, setReportsTotalCount] = useState(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async (silent = false) => {
    if (!user?.id) return;
    const cacheKey = `periodic-controls:${user.id}`;
    const cached = readPageSessionCache<{
      controls: PeriodicControlRecord[];
      reports: PeriodicControlReportRecord[];
      companies: OsgbCompanyOption[];
      controlsTotalCount: number;
      reportsTotalCount: number;
    }>(cacheKey, PERIODIC_CACHE_TTL);
    if (cached && !silent) {
      setControls(cached.controls);
      setReports(cached.reports);
      setCompanies(cached.companies);
      setControlsTotalCount(cached.controlsTotalCount);
      setReportsTotalCount(cached.reportsTotalCount);
      setLoading(false);
    }
    if (!silent) setLoading(true);

    try {
      const [controlRows, reportRows, companyRows] = await Promise.all([
        listPeriodicControlsPage(user.id, {
          page: controlsPage,
          pageSize: PERIODIC_CONTROLS_PAGE_SIZE,
          search,
          status: statusFilter,
          companyId: companyFilter,
        }),
        listPeriodicControlReportHistoryPage(user.id, {
          page: reportsPage,
          pageSize: PERIODIC_REPORTS_PAGE_SIZE,
        }),
        getPeriodicControlCompanyOptions(user.id),
      ]);

      setControls(controlRows.rows);
      setReports(reportRows.rows);
      setCompanies(companyRows);
      setControlsTotalCount(controlRows.count);
      setReportsTotalCount(reportRows.count);
      writePageSessionCache(cacheKey, {
        controls: controlRows.rows,
        reports: reportRows.rows,
        companies: companyRows,
        controlsTotalCount: controlRows.count,
        reportsTotalCount: reportRows.count,
      });
    } catch (error) {
      console.error(error);
      toast.error("Periyodik kontrol verileri yüklenemedi");
    } finally {
      setLoading(false);
      setTaskRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, controlsPage, reportsPage, search, statusFilter, companyFilter]);

  const reportControlMap = useMemo(() => new Map(controls.map((control) => [control.id, control])), [controls]);
  const controlsTotalPages = Math.max(1, Math.ceil(controlsTotalCount / PERIODIC_CONTROLS_PAGE_SIZE));
  const reportsTotalPages = Math.max(1, Math.ceil(reportsTotalCount / PERIODIC_REPORTS_PAGE_SIZE));

  const stats = useMemo(
    () => ({
      total: controls.length,
      warning: controls.filter((item) => item.status === "warning").length,
      overdue: controls.filter((item) => item.status === "overdue").length,
      completed: controls.filter((item) => item.status === "completed").length,
    }),
    [controls],
  );

  useEffect(() => {
    setControlsPage(1);
  }, [search, statusFilter, companyFilter]);

  useEffect(() => {
    setReportsPage(1);
  }, [reports.length]);

  useEffect(() => {
    if (controlsPage > controlsTotalPages) setControlsPage(controlsTotalPages);
  }, [controlsPage, controlsTotalPages]);

  useEffect(() => {
    if (reportsPage > reportsTotalPages) setReportsPage(reportsTotalPages);
  }, [reportsPage, reportsTotalPages]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (control: PeriodicControlRecord) => {
    setEditing(control);
    setForm({
      companyId: control.company_id || "",
      equipmentName: control.equipment_name,
      controlCategory: control.control_category,
      location: control.location || "",
      responsibleVendor: control.responsible_vendor || "",
      standardReference: control.standard_reference || "",
      lastControlDate: control.last_control_date || "",
      nextControlDate: control.next_control_date,
      status: control.status,
      resultStatus: control.result_status,
      notes: control.notes || "",
    });
    setDialogOpen(true);
  };

  const openUpload = async (control: PeriodicControlRecord) => {
    setUploadTarget(control);
    setReportForm(emptyReportForm);
    setUploadOpen(true);
    try {
      const rows = await listPeriodicControlReports(control.id);
      setSelectedReports(rows);
    } catch {
      toast.error("Kontrol raporları yüklenemedi");
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!form.equipmentName.trim() || !form.controlCategory.trim() || !form.nextControlDate) {
      toast.error("Ekipman adı, kontrol türü ve sonraki kontrol tarihi zorunludur");
      return;
    }

    if (form.lastControlDate && form.nextControlDate < form.lastControlDate) {
      toast.error("Sonraki kontrol tarihi son kontrol tarihinden önce olamaz");
      return;
    }

    setSaving(true);
    try {
      const payload: PeriodicControlInput = {
        companyId: form.companyId || null,
        equipmentName: form.equipmentName,
        controlCategory: form.controlCategory,
        location: form.location,
        responsibleVendor: form.responsibleVendor,
        standardReference: form.standardReference,
        lastControlDate: form.lastControlDate || null,
        nextControlDate: form.nextControlDate,
        status: form.status,
        resultStatus: form.resultStatus,
        notes: form.notes,
      };

      await upsertPeriodicControl(user.id, payload, editing?.id);
      toast.success(editing ? "Periyodik kontrol güncellendi" : "Periyodik kontrol eklendi");
      setDialogOpen(false);
      setForm(emptyForm);
      await loadData(true);
    } catch (error) {
      console.error(error);
      toast.error("Kayıt işlemi tamamlanamadı");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (control: PeriodicControlRecord) => {
    if (!window.confirm(`${control.equipment_name} kaydını silmek istediğine emin misin?`)) return;
    try {
      await deletePeriodicControl(control.id);
      toast.success("Periyodik kontrol silindi");
      await loadData(true);
    } catch {
      toast.error("Kayıt silinemedi");
    }
  };

  const handleUpload = async () => {
    if (!user?.id || !uploadTarget) return;
    if (!reportForm.file || !reportForm.reportDate) {
      toast.error("Rapor tarihi ve dosya zorunludur");
      return;
    }

    setUploading(true);
    try {
      await uploadPeriodicControlReport(
        user.id,
        uploadTarget.id,
        reportForm.file,
        reportForm.reportDate,
        reportForm.reportSummary,
      );
      toast.success("Rapor yüklendi");
      const [historyRows, reportRows] = await Promise.all([
        listPeriodicControlReports(uploadTarget.id),
        listPeriodicControlReportHistory(user.id),
      ]);
      setSelectedReports(historyRows);
      setReports(reportRows);
      setReportForm(emptyReportForm);
    } catch (error) {
      console.error(error);
      toast.error("Rapor yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadReport = async (report: PeriodicControlReportRecord) => {
    try {
      const url = await getPeriodicControlReportDownloadUrl(report.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Rapor indirilemedi");
    }
  };

  const handleDeleteReport = async (report: PeriodicControlReportRecord) => {
    if (!window.confirm(`${report.file_name} raporunu silmek istediğine emin misin?`)) return;
    try {
      await deletePeriodicControlReport(report);
      toast.success("Rapor silindi");
      if (uploadTarget) {
        setSelectedReports(await listPeriodicControlReports(uploadTarget.id));
      }
      if (user?.id) {
        setReports(await listPeriodicControlReportHistory(user.id));
      }
    } catch {
      toast.error("Rapor silinemedi");
    }
  };

  const refreshTasks = async () => {
    if (!user?.id) return;
    setTaskRefreshing(true);
    try {
      const result = await createPeriodicControlTasks(user.id, controls);
      toast.success("Görev taraması tamamlandı", {
        description: `${result.created} yeni görev, ${result.skipped} atlanan kayıt`,
      });
    } catch {
      toast.error("Görev üretimi tamamlanamadı");
    } finally {
      setTaskRefreshing(false);
    }
  };

  const handleBulkImport = async (file: File) => {
    if (!user?.id) return;

    try {
      const rows = await readWorkbookRows(file);
      if (rows.length === 0) {
        toast.error("Excel icinde satir bulunamadi.");
        return;
      }

      const companyMap = new Map(
        companies.map((company) => [company.companyName.toLocaleLowerCase("tr-TR"), company.id]),
      );
      const allowedStatuses = new Set<PeriodicControlStatus>(["scheduled", "warning", "overdue", "completed", "inactive"]);
      const allowedResults = new Set<PeriodicControlResult>(["not_evaluated", "suitable", "conditional", "unsuitable"]);
      const batchKeys = new Set<string>();
      let created = 0;
      const errors: string[] = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const equipmentName = row.equipment_name || row.ekipman_adi || row.ekipman;
        const controlCategory = row.control_category || row.kontrol_turu || row.kategori;
        const nextControlDate = row.next_control_date || row.sonraki_kontrol_tarihi;
        const lastControlDate = row.last_control_date || row.son_kontrol_tarihi || "";
        const companyName = row.company_name || row.firma || row.company || "";
        const statusValue = (row.status || "scheduled").toLowerCase() as PeriodicControlStatus;
        const resultValue = (row.result_status || "not_evaluated").toLowerCase() as PeriodicControlResult;
        const companyId = companyName ? companyMap.get(companyName.toLocaleLowerCase("tr-TR")) || null : null;
        const uniqueKey = `${companyId || "no-company"}::${equipmentName || ""}::${controlCategory || ""}`.toLocaleLowerCase("tr-TR");

        if (!equipmentName || !controlCategory || !nextControlDate) {
          errors.push(`Satir ${index + 2}: equipment_name, control_category ve next_control_date zorunludur.`);
          continue;
        }
        if (companyName && !companyId) {
          errors.push(`Satir ${index + 2}: \"${companyName}\" adina eslesen firma bulunamadi.`);
          continue;
        }
        if (!allowedStatuses.has(statusValue)) {
          errors.push(`Satir ${index + 2}: status alani scheduled, warning, overdue, completed veya inactive olmalidir.`);
          continue;
        }
        if (!allowedResults.has(resultValue)) {
          errors.push(`Satir ${index + 2}: result_status alani suitable, conditional, unsuitable veya not_evaluated olmalidir.`);
          continue;
        }
        if (lastControlDate && nextControlDate < lastControlDate) {
          errors.push(`Satir ${index + 2}: next_control_date, last_control_date tarihinden once olamaz.`);
          continue;
        }
        if (batchKeys.has(uniqueKey)) {
          errors.push(`Satir ${index + 2}: ayni ekipman ve kontrol turu ayni dosyada tekrar ediyor.`);
          continue;
        }

        batchKeys.add(uniqueKey);

        const payload: PeriodicControlInput = {
          companyId,
          equipmentName,
          controlCategory,
          location: row.location || row.lokasyon || "",
          responsibleVendor: row.responsible_vendor || row.kontrol_kurulusu || "",
          standardReference: row.standard_reference || row.standart_referans || "",
          lastControlDate: lastControlDate || null,
          nextControlDate,
          status: statusValue,
          resultStatus: resultValue,
          notes: row.notes || row.notlar || "",
        };

        try {
          await upsertPeriodicControl(user.id, payload);
          created += 1;
        } catch (error) {
          console.error(error);
          errors.push(`Satir ${index + 2}: kayit eklenemedi.`);
        }
      }

      await loadData(true);

      if (created > 0) {
        toast.success(`${created} periyodik kontrol kaydi ice aktarildi.`);
      }
      if (errors.length > 0) {
        toast.info(`${errors.length} satir atlandi: ${errors.slice(0, 3).join(" | ")}`);
      }
      if (created === 0 && errors.length > 0) {
        toast.error("Ice aktarma tamamlanamadi. Dosya icindeki satirlari kontrol edin.");
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Excel ice aktarma tamamlanamadi.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_22%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_24%),linear-gradient(135deg,#020617_0%,#0b1220_42%,#111827_100%)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.48)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-400/30 bg-cyan-500/15 text-cyan-100">Periyodik Kontrol</Badge>
              <Badge className="border-blue-400/30 bg-blue-500/15 text-blue-100">Rapor + Uyarı + Görev</Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-50 lg:text-5xl">
              Periyodik kontrol takibini rapor ve görev akışıyla yönetin
            </h1>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 lg:text-base">
              Kontrol gerektiren ekipmanları, rapor arşivini ve yaklaşan terminleri tek panelde toplayın.
              Yaklaşan veya geciken kayıtlar OSGB görev motoruna aktarılır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/periodic-controls/guide")}>
              <LifeBuoy className="h-4 w-4" />
              Nasıl kullanılır?
            </Button>
            <Button variant="outline" className="gap-2" onClick={downloadPeriodicControlTemplate}>
              <FileSpreadsheet className="h-4 w-4" />
              Şablon indir
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => importInputRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel ile yükle
            </Button>
            <Button variant="outline" className="gap-2" onClick={refreshTasks} disabled={taskRefreshing}>
              <Sparkles className={`h-4 w-4 ${taskRefreshing ? "animate-spin" : ""}`} />
              Görevleri yenile
            </Button>
            <Button className="gap-2 bg-cyan-600 hover:bg-cyan-700" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Yeni Periyodik Kontrol
            </Button>
          </div>
        </div>
      </section>


      <Card className="border-slate-700/70 bg-slate-950/55">
        <CardHeader>
          <CardTitle className="text-white">Toplu Excel içe aktarma</CardTitle>
          <CardDescription>
            Çok sayıda periyodik kontrol kaydını tek dosya ile sisteme yükleyin. Zorunlu alanlar:
            <span className="ml-1 font-medium text-slate-200">equipment_name, control_category, next_control_date</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm leading-7 text-slate-300">
            <p className="font-medium text-white">Beklenen kolonlar</p>
            <p>Opsiyonel kolonlar: company_name, location, responsible_vendor, standard_reference, last_control_date, status, result_status, notes</p>
            <p>status alanı şu değerlerden biri olmalıdır: scheduled, warning, overdue, completed, inactive</p>
            <p>result_status alanı şu değerlerden biri olmalıdır: not_evaluated, suitable, conditional, unsuitable</p>
            <p>Tarih alanlarını YYYY-MM-DD formatında girin. Aynı ekipman ve kontrol türünü aynı dosyada tekrar etmeyin.</p>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-cyan-100">Önerilen akış</p>
              <ol className="space-y-1 text-sm text-cyan-50/90">
                <li>1. Şablonu indir</li>
                <li>2. Satırları firma ve ekipman bazında doldur</li>
                <li>3. Excel ile yükle</li>
                <li>4. Atlanan satırlar varsa uyarıdan kontrol et</li>
              </ol>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={downloadPeriodicControlTemplate}>
                <FileSpreadsheet className="h-4 w-4" />
                Şablonu indir
              </Button>
              <Button className="gap-2 bg-cyan-600 hover:bg-cyan-700" onClick={() => importInputRef.current?.click()}>
                <FileSpreadsheet className="h-4 w-4" />
                Yüklemeyi başlat
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <section className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-700/70 bg-slate-950/60"><CardContent className="pt-6"><p className="text-sm text-slate-400">Toplam kayıt</p><p className="mt-2 text-3xl font-bold text-white">{stats.total}</p></CardContent></Card>
        <Card className="border-amber-500/20 bg-amber-500/10"><CardContent className="pt-6"><p className="text-sm text-amber-100/80">Yaklaşan</p><p className="mt-2 text-3xl font-bold text-white">{stats.warning}</p></CardContent></Card>
        <Card className="border-red-500/20 bg-red-500/10"><CardContent className="pt-6"><p className="text-sm text-red-100/80">Geciken</p><p className="mt-2 text-3xl font-bold text-white">{stats.overdue}</p></CardContent></Card>
        <Card className="border-emerald-500/20 bg-emerald-500/10"><CardContent className="pt-6"><p className="text-sm text-emerald-100/80">Tamamlanan</p><p className="mt-2 text-3xl font-bold text-white">{stats.completed}</p></CardContent></Card>
      </section>

      <Card className="border-slate-700/70 bg-slate-950/55">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-white">Kontrol listesi</CardTitle>
              <CardDescription>Kayıtları filtreleyin, düzenleyin ve rapor yükleme akışına geçin.</CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => void loadData(true)}>
              <RefreshCcw className="h-4 w-4" />
              Yenile
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ekipman, firma, lokasyon veya kategori ara" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PeriodicControlStatus | "ALL")}>
              <SelectTrigger><SelectValue placeholder="Durum filtrele" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                <SelectItem value="scheduled">Planlandı</SelectItem>
                <SelectItem value="warning">Yaklaşıyor</SelectItem>
                <SelectItem value="overdue">Gecikti</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="inactive">Pasif</SelectItem>
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger><SelectValue placeholder="Firma filtrele" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm firmalar</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ekipman</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Kontrol Türü</TableHead>
                <TableHead>Sonraki Termin</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400">Kayıtlar yükleniyor...</TableCell></TableRow>
              ) : controls.length > 0 ? (
                controls.map((control) => (
                  <TableRow key={control.id}>
                    <TableCell><div><p className="font-medium text-white">{control.equipment_name}</p><p className="text-xs text-slate-400">{control.location || "Lokasyon belirtilmedi"}</p></div></TableCell>
                    <TableCell>{control.company?.company_name || "-"}</TableCell>
                    <TableCell>{control.control_category}</TableCell>
                    <TableCell><div><p>{formatDate(control.next_control_date)}</p><p className="text-xs text-slate-400">Son kontrol: {formatDate(control.last_control_date)}</p></div></TableCell>
                    <TableCell><Badge variant="outline" className={statusClass[control.status]}>{statusLabel[control.status]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => void openUpload(control)}><FileUp className="h-4 w-4" />Rapor</Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => openEdit(control)}><Eye className="h-4 w-4" />Düzenle</Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => void handleDelete(control)}><Trash2 className="h-4 w-4" />Sil</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400">Eşleşen periyodik kontrol kaydı bulunamadı.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {controlsTotalCount > PERIODIC_CONTROLS_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>Sayfa {controlsPage} / {controlsTotalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setControlsPage((page) => Math.max(1, page - 1))} disabled={controlsPage === 1}>Önceki</Button>
                <Button variant="outline" size="sm" onClick={() => setControlsPage((page) => Math.min(controlsTotalPages, page + 1))} disabled={controlsPage === controlsTotalPages}>Sonraki</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-700/70 bg-slate-950/55">
        <CardHeader>
          <CardTitle className="text-white">Rapor geçmişi</CardTitle>
          <CardDescription>Yüklenen kontrol raporları burada kronolojik olarak görünür.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ekipman</TableHead>
                <TableHead>Rapor Tarihi</TableHead>
                <TableHead>Dosya</TableHead>
                <TableHead>Özet</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length > 0 ? (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{reportControlMap.get(report.control_id)?.equipment_name || "Kontrol kaydı"}</TableCell>
                    <TableCell>{formatDate(report.report_date)}</TableCell>
                    <TableCell>{report.file_name}</TableCell>
                    <TableCell className="max-w-[340px] truncate">{report.report_summary || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => void handleDownloadReport(report)}><Download className="h-4 w-4" />İndir</Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => void handleDeleteReport(report)}><Trash2 className="h-4 w-4" />Sil</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-slate-400">Henüz rapor yüklenmedi.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {reportsTotalCount > PERIODIC_REPORTS_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>Sayfa {reportsPage} / {reportsTotalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setReportsPage((page) => Math.max(1, page - 1))} disabled={reportsPage === 1}>Önceki</Button>
                <Button variant="outline" size="sm" onClick={() => setReportsPage((page) => Math.min(reportsTotalPages, page + 1))} disabled={reportsPage === reportsTotalPages}>Sonraki</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>


      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleBulkImport(file);
          event.target.value = "";
        }}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Periyodik Kontrolü Düzenle" : "Yeni Periyodik Kontrol"}</DialogTitle>
            <DialogDescription>Kontrol kalemini oluşturun veya güncelleyin. Kaydedilen terminler görev üretimi için kullanılır.</DialogDescription>
          </DialogHeader>
          <div className="grid flex-1 gap-4 overflow-y-auto py-1 pr-1 md:grid-cols-2">
            <div className="space-y-2"><Label>Ekipman adı</Label><Input value={form.equipmentName} onChange={(e) => setForm((prev) => ({ ...prev, equipmentName: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Kontrol türü</Label><Input value={form.controlCategory} onChange={(e) => setForm((prev) => ({ ...prev, controlCategory: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={form.companyId || "NONE"} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value === "NONE" ? "" : value }))}>
                <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Firma seçilmedi</SelectItem>
                  {companies.map((company) => (<SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Lokasyon</Label><Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Kontrol kuruluşu / uzman</Label><Input value={form.responsibleVendor} onChange={(e) => setForm((prev) => ({ ...prev, responsibleVendor: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Standart / referans</Label><Input value={form.standardReference} onChange={(e) => setForm((prev) => ({ ...prev, standardReference: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Son kontrol tarihi</Label><Input type="date" value={form.lastControlDate} onChange={(e) => setForm((prev) => ({ ...prev, lastControlDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Sonraki kontrol tarihi</Label><Input type="date" value={form.nextControlDate} onChange={(e) => setForm((prev) => ({ ...prev, nextControlDate: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as PeriodicControlStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Planlandı</SelectItem>
                  <SelectItem value="warning">Yaklaşıyor</SelectItem>
                  <SelectItem value="overdue">Gecikti</SelectItem>
                  <SelectItem value="completed">Tamamlandı</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sonuç</Label>
              <Select value={form.resultStatus} onValueChange={(value) => setForm((prev) => ({ ...prev, resultStatus: value as PeriodicControlResult }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_evaluated">Değerlendirilmedi</SelectItem>
                  <SelectItem value="suitable">Uygun</SelectItem>
                  <SelectItem value="conditional">Şartlı uygun</SelectItem>
                  <SelectItem value="unsuitable">Uygun değil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Notlar</Label><Textarea rows={4} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700"><ShieldCheck className="mr-2 h-4 w-4" />{saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Rapor Yükle ve Geçmişi Gör</DialogTitle>
            <DialogDescription>{uploadTarget?.equipment_name || "Periyodik kontrol"} için rapor yükleyin ve önceki raporları yönetin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 overflow-y-auto py-1 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-slate-700/70 bg-slate-950/60">
              <CardHeader><CardTitle className="text-base text-white">Yeni rapor</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Rapor tarihi</Label><Input type="date" value={reportForm.reportDate} onChange={(e) => setReportForm((prev) => ({ ...prev, reportDate: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Dosya</Label><Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(e) => setReportForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} /></div>
                <div className="space-y-2"><Label>Rapor özeti</Label><Textarea rows={5} value={reportForm.reportSummary} onChange={(e) => setReportForm((prev) => ({ ...prev, reportSummary: e.target.value }))} /></div>
                <Button onClick={() => void handleUpload()} disabled={uploading} className="w-full bg-cyan-600 hover:bg-cyan-700"><FileUp className="mr-2 h-4 w-4" />{uploading ? "Yükleniyor..." : "Raporu yükle"}</Button>
              </CardContent>
            </Card>

            <Card className="border-slate-700/70 bg-slate-950/60">
              <CardHeader><CardTitle className="text-base text-white">Kontrol geçmişi</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Rapor tarihi</TableHead><TableHead>Dosya</TableHead><TableHead>Özet</TableHead><TableHead>İşlem</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedReports.length > 0 ? (
                      selectedReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>{formatDate(report.report_date)}</TableCell>
                          <TableCell>{report.file_name}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{report.report_summary || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => void handleDownloadReport(report)}><Download className="h-4 w-4" /></Button>
                              <Button size="sm" variant="outline" onClick={() => void handleDeleteReport(report)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={4} className="h-24 text-center text-slate-400">Bu kayıt için henüz rapor yüklenmedi.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}






