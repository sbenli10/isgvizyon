import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Download, FileUp, HeartPulse, Plus, RefreshCcw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createHealthSurveillanceTasks,
  deleteHealthSurveillanceFile,
  deleteHealthSurveillanceRecord,
  getHealthSurveillanceFileDownloadUrl,
  listHealthEmployeeOptions,
  listHealthSurveillanceFiles,
  listHealthSurveillanceRecords,
  listHealthSurveillanceRecordsPage,
  type HealthEmployeeOption,
  type HealthExamType,
  type HealthResultStatus,
  type HealthSurveillanceFileRecord,
  type HealthSurveillanceInput,
  type HealthSurveillanceRecord,
  type HealthWorkflowStatus,
  upsertHealthSurveillanceRecord,
  uploadHealthSurveillanceFile,
} from "@/lib/healthSurveillanceOperations";
import { readPageSessionCache, writePageSessionCache } from "@/lib/pageSessionCache";

type FormState = {
  employeeId: string;
  companyId: string;
  examType: HealthExamType;
  examDate: string;
  nextExamDate: string;
  physicianName: string;
  resultStatus: HealthResultStatus;
  status: HealthWorkflowStatus;
  restrictions: string;
  summary: string;
  notes: string;
};

type FileFormState = {
  reportDate: string;
  fileSummary: string;
  file: File | null;
};

const emptyForm: FormState = {
  employeeId: "",
  companyId: "",
  examType: "periodic",
  examDate: new Date().toISOString().slice(0, 10),
  nextExamDate: "",
  physicianName: "",
  resultStatus: "pending",
  status: "active",
  restrictions: "",
  summary: "",
  notes: "",
};

const emptyFileForm: FileFormState = {
  reportDate: new Date().toISOString().slice(0, 10),
  fileSummary: "",
  file: null,
};
const HEALTH_CACHE_TTL = 5 * 60 * 1000;
const HEALTH_RECORDS_PAGE_SIZE = 10;

const examTypeLabel: Record<HealthExamType, string> = {
  pre_employment: "İşe giriş",
  periodic: "Periyodik",
  return_to_work: "İşe dönüş",
  special: "Özel durum",
};

const resultLabel: Record<HealthResultStatus, string> = {
  fit: "Uygun",
  conditional_fit: "Şartlı uygun",
  unfit: "Uygun değil",
  pending: "Beklemede",
};

const statusLabel: Record<HealthWorkflowStatus, string> = {
  active: "Aktif",
  warning: "Yaklaşıyor",
  overdue: "Gecikti",
  completed: "Tamamlandı",
  archived: "Arşiv",
};

const statusClass: Record<HealthWorkflowStatus, string> = {
  active: "border-sky-400/20 bg-sky-500/15 text-sky-200",
  warning: "border-amber-400/20 bg-amber-500/15 text-amber-200",
  overdue: "border-red-400/20 bg-red-500/15 text-red-200",
  completed: "border-emerald-400/20 bg-emerald-500/15 text-emerald-200",
  archived: "border-slate-400/20 bg-slate-500/15 text-slate-200",
};

const resultClass: Record<HealthResultStatus, string> = {
  fit: "border-emerald-400/20 bg-emerald-500/15 text-emerald-200",
  conditional_fit: "border-amber-400/20 bg-amber-500/15 text-amber-200",
  unfit: "border-red-400/20 bg-red-500/15 text-red-200",
  pending: "border-slate-400/20 bg-slate-500/15 text-slate-200",
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("tr-TR") : "-");

export default function HealthSurveillance() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const employeeParam = searchParams.get("employeeId") || "ALL";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [taskRefreshing, setTaskRefreshing] = useState(false);
  const [records, setRecords] = useState<HealthSurveillanceRecord[]>([]);
  const [employees, setEmployees] = useState<HealthEmployeeOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HealthSurveillanceRecord | null>(null);
  const [fileTarget, setFileTarget] = useState<HealthSurveillanceRecord | null>(null);
  const [fileRows, setFileRows] = useState<HealthSurveillanceFileRecord[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fileForm, setFileForm] = useState<FileFormState>(emptyFileForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HealthWorkflowStatus | "ALL">("ALL");
  const [employeeFilter, setEmployeeFilter] = useState<string>(employeeParam);
  const [recordsPage, setRecordsPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadData = async (silent = false) => {
    if (!user?.id) return;
    const cacheKey = `health-surveillance:${user.id}`;
    const cached = readPageSessionCache<{
      records: HealthSurveillanceRecord[];
      employees: HealthEmployeeOption[];
      totalCount: number;
    }>(cacheKey, HEALTH_CACHE_TTL);

    if (cached && !silent) {
      setRecords(cached.records);
      setEmployees(cached.employees);
      setTotalCount(cached.totalCount);
      setLoading(false);
    }
    if (!silent) setLoading(true);
    try {
      const [recordRows, employeeRows] = await Promise.all([
        listHealthSurveillanceRecordsPage(user.id, {
          page: recordsPage,
          pageSize: HEALTH_RECORDS_PAGE_SIZE,
          status: statusFilter,
          employeeId: employeeFilter,
          search,
        }),
        listHealthEmployeeOptions(),
      ]);
      setRecords(recordRows.rows);
      setEmployees(employeeRows);
      setTotalCount(recordRows.count);
      writePageSessionCache(cacheKey, {
        records: recordRows.rows,
        employees: employeeRows,
        totalCount: recordRows.count,
      });
    } catch (error) {
      console.error(error);
      toast.error("Sağlık gözetimi verileri yüklenemedi");
    } finally {
      setLoading(false);
      setTaskRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, recordsPage, search, statusFilter, employeeFilter]);

  useEffect(() => {
    setEmployeeFilter(employeeParam);
  }, [employeeParam]);

  useEffect(() => {
    setRecordsPage(1);
  }, [search, statusFilter, employeeFilter]);

  const stats = useMemo(() => ({
    total: records.length,
    warning: records.filter((item) => item.status === "warning").length,
    overdue: records.filter((item) => item.status === "overdue").length,
    pending: records.filter((item) => item.result_status === "pending").length,
  }), [records]);
  const recordsTotalPages = Math.max(1, Math.ceil(totalCount / HEALTH_RECORDS_PAGE_SIZE));

  useEffect(() => {
    if (recordsPage > recordsTotalPages) setRecordsPage(recordsTotalPages);
  }, [recordsPage, recordsTotalPages]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, employeeId: employeeFilter !== "ALL" ? employeeFilter : "" });
    setDialogOpen(true);
  };

  const openEdit = (record: HealthSurveillanceRecord) => {
    setEditing(record);
    setForm({
      employeeId: record.employee_id,
      companyId: record.company_id || "",
      examType: record.exam_type,
      examDate: record.exam_date,
      nextExamDate: record.next_exam_date || "",
      physicianName: record.physician_name || "",
      resultStatus: record.result_status,
      status: record.status,
      restrictions: record.restrictions || "",
      summary: record.summary || "",
      notes: record.notes || "",
    });
    setDialogOpen(true);
  };

  const openFiles = async (record: HealthSurveillanceRecord) => {
    setFileTarget(record);
    setFileForm(emptyFileForm);
    setFileDialogOpen(true);
    try {
      setFileRows(await listHealthSurveillanceFiles(record.id));
    } catch {
      toast.error("Sağlık dosyaları yüklenemedi");
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!form.employeeId || !form.examDate) {
      toast.error("Çalışan ve muayene tarihi zorunludur");
      return;
    }
    if (form.nextExamDate && form.nextExamDate < form.examDate) {
      toast.error("Sonraki muayene tarihi muayene tarihinden önce olamaz");
      return;
    }

    const selectedEmployee = employees.find((item) => item.id === form.employeeId);
    setSaving(true);
    try {
      const payload: HealthSurveillanceInput = {
        employeeId: form.employeeId,
        companyId: form.companyId || selectedEmployee?.companyId || null,
        examType: form.examType,
        examDate: form.examDate,
        nextExamDate: form.nextExamDate || null,
        physicianName: form.physicianName,
        resultStatus: form.resultStatus,
        status: form.status,
        restrictions: form.restrictions,
        summary: form.summary,
        notes: form.notes,
      };
      await upsertHealthSurveillanceRecord(user.id, payload, editing?.id);
      toast.success(editing ? "Sağlık kaydı güncellendi" : "Sağlık kaydı eklendi");
      setDialogOpen(false);
      setForm(emptyForm);
      await loadData(true);
    } catch (error) {
      console.error(error);
      toast.error("Sağlık kaydı kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: HealthSurveillanceRecord) => {
    if (!window.confirm("Bu sağlık gözetimi kaydını silmek istediğine emin misin?")) return;
    try {
      await deleteHealthSurveillanceRecord(record.id);
      toast.success("Sağlık kaydı silindi");
      await loadData(true);
    } catch {
      toast.error("Sağlık kaydı silinemedi");
    }
  };

  const handleUpload = async () => {
    if (!user?.id || !fileTarget) return;
    if (!fileForm.file || !fileForm.reportDate) {
      toast.error("Dosya ve rapor tarihi zorunludur");
      return;
    }
    setUploading(true);
    try {
      await uploadHealthSurveillanceFile(user.id, fileTarget.id, fileForm.file, fileForm.reportDate, fileForm.fileSummary);
      setFileRows(await listHealthSurveillanceFiles(fileTarget.id));
      setFileForm(emptyFileForm);
      toast.success("Sağlık dosyası yüklendi");
    } catch (error) {
      console.error(error);
      toast.error("Sağlık dosyası yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (file: HealthSurveillanceFileRecord) => {
    try {
      const url = await getHealthSurveillanceFileDownloadUrl(file.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Dosya indirilemedi");
    }
  };

  const handleDeleteFile = async (file: HealthSurveillanceFileRecord) => {
    if (!window.confirm("Bu sağlık dosyasını silmek istediğine emin misin?")) return;
    try {
      await deleteHealthSurveillanceFile(file);
      if (fileTarget) setFileRows(await listHealthSurveillanceFiles(fileTarget.id));
      toast.success("Sağlık dosyası silindi");
    } catch {
      toast.error("Sağlık dosyası silinemedi");
    }
  };

  const refreshTasks = async () => {
    if (!user?.id) return;
    setTaskRefreshing(true);
    try {
      const result = await createHealthSurveillanceTasks(user.id, records, employees);
      toast.success("Görev taraması tamamlandı", { description: `${result.created} yeni görev, ${result.skipped} atlanan kayıt` });
    } catch {
      toast.error("Sağlık görevleri üretilemedi");
    } finally {
      setTaskRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_22%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_24%),linear-gradient(135deg,#020617_0%,#0b1220_42%,#111827_100%)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.48)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-100">Sağlık Gözetimi</Badge>
              <Badge className="border-blue-400/30 bg-blue-500/15 text-blue-100">Muayene + Uyarı + Görev</Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-50 lg:text-5xl">Muayene takibini yormayan bir sağlık operasyon akışıyla yönetin</h1>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 lg:text-base">
              İşe giriş, periyodik, işe dönüş ve özel durum muayenelerini tek kayıt akışında yönetin.
              Yaklaşan ve geciken muayeneler görev motoruna aktarılır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={refreshTasks} disabled={taskRefreshing}>
              <RefreshCcw className={`h-4 w-4 ${taskRefreshing ? "animate-spin" : ""}`} />
              Görevleri yenile
            </Button>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Yeni sağlık kaydı
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-700/70 bg-slate-950/60"><CardContent className="pt-6"><p className="text-sm text-slate-400">Toplam kayıt</p><p className="mt-2 text-3xl font-bold text-white">{stats.total}</p></CardContent></Card>
        <Card className="border-amber-500/20 bg-amber-500/10"><CardContent className="pt-6"><p className="text-sm text-amber-100/80">Yaklaşan</p><p className="mt-2 text-3xl font-bold text-white">{stats.warning}</p></CardContent></Card>
        <Card className="border-red-500/20 bg-red-500/10"><CardContent className="pt-6"><p className="text-sm text-red-100/80">Geciken</p><p className="mt-2 text-3xl font-bold text-white">{stats.overdue}</p></CardContent></Card>
        <Card className="border-slate-500/20 bg-slate-500/10"><CardContent className="pt-6"><p className="text-sm text-slate-100/80">Sonuç bekleyen</p><p className="mt-2 text-3xl font-bold text-white">{stats.pending}</p></CardContent></Card>
      </section>

      <Card className="border-slate-700/70 bg-slate-950/55">
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="text-white">Sağlık kayıtları</CardTitle>
            <CardDescription>Kayıtları çalışan, durum ve arama alanı ile daraltın. Detaya girmeden kritik bilgileri görün.</CardDescription>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Çalışan, firma veya hekim ara" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as HealthWorkflowStatus | 'ALL')}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="warning">Yaklaşıyor</SelectItem>
                <SelectItem value="overdue">Gecikti</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="archived">Arşiv</SelectItem>
              </SelectContent>
            </Select>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger><SelectValue placeholder="Çalışan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm çalışanlar</SelectItem>
                {employees.map((employee) => (<SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Çalışan</TableHead>
                <TableHead>Muayene</TableHead>
                <TableHead>Sonraki tarih</TableHead>
                <TableHead>Sonuç</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400">Kayıtlar yükleniyor...</TableCell></TableRow>
              ) : records.length > 0 ? (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{`${record.employee?.first_name || ''} ${record.employee?.last_name || ''}`.trim() || 'Çalışan'}</p>
                        <p className="text-xs text-slate-400">{record.company?.name || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{examTypeLabel[record.exam_type]}</p>
                        <p className="text-xs text-slate-400">Muayene: {formatDate(record.exam_date)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(record.next_exam_date)}</TableCell>
                    <TableCell><Badge variant="outline" className={resultClass[record.result_status]}>{resultLabel[record.result_status]}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={statusClass[record.status]}>{statusLabel[record.status]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => void openFiles(record)}><FileUp className="h-4 w-4" />Dosyalar</Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => openEdit(record)}><Activity className="h-4 w-4" />Düzenle</Button>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => void handleDelete(record)}><Trash2 className="h-4 w-4" />Sil</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400">Eşleşen sağlık gözetimi kaydı bulunamadı.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {totalCount > HEALTH_RECORDS_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>Sayfa {recordsPage} / {recordsTotalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRecordsPage((page) => Math.max(1, page - 1))} disabled={recordsPage === 1}>Önceki</Button>
                <Button variant="outline" size="sm" onClick={() => setRecordsPage((page) => Math.min(recordsTotalPages, page + 1))} disabled={recordsPage === recordsTotalPages}>Sonraki</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Sağlık kaydını düzenle" : "Yeni sağlık gözetimi kaydı"}</DialogTitle>
            <DialogDescription>Gerekli olan minimum alanlarla muayene akışını kaydedin. İleri tıbbi detayları sisteme yüklemek zorunda değilsiniz.</DialogDescription>
          </DialogHeader>
          <div className="grid flex-1 gap-4 overflow-y-auto py-1 pr-1 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Çalışan</Label>
              <Select value={form.employeeId} onValueChange={(value) => {
                const selected = employees.find((item) => item.id === value);
                setForm((prev) => ({ ...prev, employeeId: value, companyId: selected?.companyId || prev.companyId }));
              }}>
                <SelectTrigger><SelectValue placeholder="Çalışan seçin" /></SelectTrigger>
                <SelectContent>{employees.map((employee) => (<SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Muayene türü</Label>
              <Select value={form.examType} onValueChange={(value) => setForm((prev) => ({ ...prev, examType: value as HealthExamType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_employment">İşe giriş</SelectItem>
                  <SelectItem value="periodic">Periyodik</SelectItem>
                  <SelectItem value="return_to_work">İşe dönüş</SelectItem>
                  <SelectItem value="special">Özel durum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Muayene tarihi</Label><Input type="date" value={form.examDate} onChange={(e) => setForm((prev) => ({ ...prev, examDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Sonraki muayene tarihi</Label><Input type="date" value={form.nextExamDate} onChange={(e) => setForm((prev) => ({ ...prev, nextExamDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>İşyeri hekimi</Label><Input value={form.physicianName} onChange={(e) => setForm((prev) => ({ ...prev, physicianName: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Sonuç</Label>
              <Select value={form.resultStatus} onValueChange={(value) => setForm((prev) => ({ ...prev, resultStatus: value as HealthResultStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit">Uygun</SelectItem>
                  <SelectItem value="conditional_fit">Şartlı uygun</SelectItem>
                  <SelectItem value="unfit">Uygun değil</SelectItem>
                  <SelectItem value="pending">Beklemede</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Takip durumu</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as HealthWorkflowStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="warning">Yaklaşıyor</SelectItem>
                  <SelectItem value="overdue">Gecikti</SelectItem>
                  <SelectItem value="completed">Tamamlandı</SelectItem>
                  <SelectItem value="archived">Arşiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Kısıt / öneri</Label><Input value={form.restrictions} onChange={(e) => setForm((prev) => ({ ...prev, restrictions: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Kısa özet</Label><Textarea rows={3} value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Notlar</Label><Textarea rows={4} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700"><ShieldCheck className="mr-2 h-4 w-4" />{saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Sağlık dosyaları</DialogTitle>
            <DialogDescription>{fileTarget ? `${fileTarget.employee?.first_name || ''} ${fileTarget.employee?.last_name || ''}`.trim() : 'Çalışan'} için muayene formu, rapor veya destekleyici dosya yükleyin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 overflow-y-auto py-1 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-slate-700/70 bg-slate-950/60">
              <CardHeader><CardTitle className="text-base text-white">Yeni dosya</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Rapor tarihi</Label><Input type="date" value={fileForm.reportDate} onChange={(e) => setFileForm((prev) => ({ ...prev, reportDate: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Dosya</Label><Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(e) => setFileForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} /></div>
                <div className="space-y-2"><Label>Kısa açıklama</Label><Textarea rows={4} value={fileForm.fileSummary} onChange={(e) => setFileForm((prev) => ({ ...prev, fileSummary: e.target.value }))} /></div>
                <Button onClick={() => void handleUpload()} disabled={uploading} className="w-full bg-emerald-600 hover:bg-emerald-700"><FileUp className="mr-2 h-4 w-4" />{uploading ? 'Yükleniyor...' : 'Dosyayı yükle'}</Button>
              </CardContent>
            </Card>
            <Card className="border-slate-700/70 bg-slate-950/60">
              <CardHeader><CardTitle className="text-base text-white">Yüklenen dosyalar</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Dosya</TableHead><TableHead>Özet</TableHead><TableHead>İşlem</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {fileRows.length > 0 ? fileRows.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell>{formatDate(file.report_date)}</TableCell>
                        <TableCell>{file.file_name}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{file.file_summary || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => void handleDownloadFile(file)}><Download className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => void handleDeleteFile(file)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={4} className="h-24 text-center text-slate-400">Bu kayıt için henüz sağlık dosyası yüklenmedi.</TableCell></TableRow>}
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

