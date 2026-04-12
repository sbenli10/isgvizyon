import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
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
import { cn } from "@/lib/utils";
import { useAccessRole } from "@/hooks/useAccessRole";
import { downloadCsv } from "@/lib/csvExport";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import {
  createOsgbTask,
  deleteOsgbTask,
  getOsgbCompanyOptions,
  listOsgbTasksPage,
  type OsgbCompanyOption,
  type OsgbTaskRecord,
  updateOsgbTaskStatus,
} from "@/lib/osgbOperations";

type TaskFormState = {
  companyId: string;
  title: string;
  description: string;
  priority: OsgbTaskRecord["priority"];
  status: OsgbTaskRecord["status"];
  assignedTo: string;
  dueDate: string;
};

const emptyForm: TaskFormState = {
  companyId: "",
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  assignedTo: "",
  dueDate: "",
};
const OSGB_TASKS_PAGE_SIZE = 10;
const OSGB_TASKS_CACHE_TTL = 5 * 60 * 1000;

const statusLabel: Record<OsgbTaskRecord["status"], string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const priorityLabel: Record<OsgbTaskRecord["priority"], string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

const badgeClass = {
  open: "bg-yellow-500/15 text-yellow-200 border-yellow-400/20",
  in_progress: "bg-sky-500/15 text-sky-200 border-sky-400/20",
  completed: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  cancelled: "bg-slate-500/15 text-slate-200 border-slate-400/20",
};

export default function OSGBTasks() {
  const { user } = useAuth();
  const { canManage } = useAccessRole();
  const [records, setRecords] = useState<OsgbTaskRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbCompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadData = async () => {
    if (!user?.id) return;
    const cacheKey = `osgb-tasks:${user.id}:${statusFilter}:${search}:${page}`;
    const cached = readOsgbPageCache<{
      records: OsgbTaskRecord[];
      companies: OsgbCompanyOption[];
      totalCount: number;
    }>(cacheKey, OSGB_TASKS_CACHE_TTL);
    if (cached) {
      setRecords(cached.records);
      setCompanies(cached.companies);
      setTotalCount(cached.totalCount);
      setLoading(false);
    }
    setLoading(true);
    try {
      const [taskResult, companyRows] = await Promise.all([
        listOsgbTasksPage(user.id, {
          page,
          pageSize: OSGB_TASKS_PAGE_SIZE,
          status: statusFilter,
          search,
        }),
        getOsgbCompanyOptions(user.id),
      ]);
      setRecords(taskResult.rows);
      setCompanies(companyRows);
      setTotalCount(taskResult.count);
      writeOsgbPageCache(cacheKey, {
        records: taskResult.rows,
        companies: companyRows,
        totalCount: taskResult.count,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OSGB görevleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, page, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const summary = useMemo(() => ({
    open: records.filter((item) => item.status === "open").length,
    inProgress: records.filter((item) => item.status === "in_progress").length,
    completed: records.filter((item) => item.status === "completed").length,
  }), [records]);
  const totalPages = Math.max(1, Math.ceil(totalCount / OSGB_TASKS_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openCreate = () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!user?.id || !form.title) {
      toast.error("Görev başlığı zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const saved = await createOsgbTask(user.id, {
        companyId: form.companyId || null,
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: form.status,
        assignedTo: form.assignedTo,
        dueDate: form.dueDate,
        source: "manual",
      });
      setRecords((prev) => [saved, ...prev]);
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Görev oluşturuldu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: OsgbTaskRecord["status"]) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    try {
      const updated = await updateOsgbTaskStatus(id, status);
      setRecords((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast.success("Görev durumu güncellendi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev durumu güncellenemedi.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!confirm("Bu görevi silmek istiyor musunuz?")) return;
    try {
      await deleteOsgbTask(id);
      setRecords((prev) => prev.filter((item) => item.id !== id));
      toast.success("Görev silindi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev silinemedi.");
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">OSGB Görev Motoru</h1>
              <p className="text-sm text-slate-400">Bot, uyarı merkezi ve manuel kayıtlar için merkezi görev listesi.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "osgb-gorevler.csv",
                ["Firma", "Başlık", "Öncelik", "Durum", "Termin", "Atanan"],
                records.map((record) => [
                  record.company?.company_name || "",
                  record.title,
                  priorityLabel[record.priority],
                  statusLabel[record.status],
                  record.due_date || "",
                  record.assigned_to || "",
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
            Yeni görev
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Görev verisi yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader className="pb-3"><CardDescription>Açık görev</CardDescription><CardTitle className="mt-2 text-3xl text-white">{summary.open}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader className="pb-3"><CardDescription>Devam eden</CardDescription><CardTitle className="mt-2 text-3xl text-white">{summary.inProgress}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader className="pb-3"><CardDescription>Tamamlanan</CardDescription><CardTitle className="mt-2 text-3xl text-white">{summary.completed}</CardTitle></CardHeader></Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Görev listesi</CardTitle>
          <CardDescription>Durum, öncelik ve sorumlu bazlı yönetim ekranı.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Görev, firma veya sorumlu ara" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                <SelectItem value="open">Açık</SelectItem>
                <SelectItem value="in_progress">Devam ediyor</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="cancelled">İptal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead>Görev</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Sorumlu</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">Yükleniyor...</TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">Eşleşen görev bulunamadı.</TableCell></TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id} className="border-slate-800">
                    <TableCell>
                      <div className="font-medium text-white">{record.title}</div>
                      <div className="text-xs text-slate-500">Kaynak: {record.source}</div>
                    </TableCell>
                    <TableCell>{record.company?.company_name || "-"}</TableCell>
                    <TableCell>{record.assigned_to || "-"}</TableCell>
                    <TableCell>{priorityLabel[record.priority]}</TableCell>
                    <TableCell><Badge className={cn("border", badgeClass[record.status])}>{statusLabel[record.status]}</Badge></TableCell>
                    <TableCell>{record.due_date || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {record.status !== "completed" ? (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(record.id, "completed")}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Tamamla
                          </Button>
                        ) : null}
                        {record.status === "open" ? (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(record.id, "in_progress")}>Başlat</Button>
                        ) : null}
                        <Button size="icon" variant="outline" onClick={() => handleDelete(record.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalCount > OSGB_TASKS_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>Sayfa {page} / {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Önceki</Button>
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Sonraki</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Yeni görev</DialogTitle>
            <DialogDescription>Bot dışında manuel OSGB operasyon görevi oluşturun.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={form.companyId || "__none"} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value === "__none" ? "" : value }))}>
                <SelectTrigger><SelectValue placeholder="Opsiyonel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Firma seçme</SelectItem>
                  {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Sorumlu</Label><Input value={form.assignedTo} onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Başlık</Label><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Öncelik</Label><Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as OsgbTaskRecord["priority"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Düşük</SelectItem><SelectItem value="medium">Orta</SelectItem><SelectItem value="high">Yüksek</SelectItem><SelectItem value="critical">Kritik</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Termin</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Açıklama</Label><Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
