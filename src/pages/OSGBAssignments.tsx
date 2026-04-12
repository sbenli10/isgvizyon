import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Download,
  Gauge,
  Plus,
  RefreshCcw,
  Search,
  ShieldBan,
  Trash2,
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
  deleteOsgbAssignment,
  getAssignmentRecommendation,
  getOsgbCompanyAssignedMinutesTotal,
  getOsgbCompanyOptions,
  getOsgbPersonnelAssignedMinutesTotal,
  listActiveOsgbPersonnel,
  listOsgbAssignmentsPage,
  type OsgbAssignmentInput,
  type OsgbAssignmentRecord,
  type OsgbCompanyOption,
  type OsgbPersonnelRecord,
  upsertOsgbAssignment,
} from "@/lib/osgbOperations";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { useAccessRole } from "@/hooks/useAccessRole";
import { downloadCsv } from "@/lib/csvExport";

type AssignmentFormState = {
  companyId: string;
  personnelId: string;
  assignedRole: OsgbAssignmentRecord["assigned_role"];
  assignedMinutes: string;
  startDate: string;
  endDate: string;
  status: OsgbAssignmentRecord["status"];
  notes: string;
};

const emptyForm: AssignmentFormState = {
  companyId: "",
  personnelId: "",
  assignedRole: "igu",
  assignedMinutes: "",
  startDate: "",
  endDate: "",
  status: "active",
  notes: "",
};

const statusLabel: Record<OsgbAssignmentRecord["status"], string> = {
  active: "Aktif",
  passive: "Pasif",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const roleLabel: Record<OsgbAssignmentRecord["assigned_role"], string> = {
  igu: "İGU",
  hekim: "İşyeri Hekimi",
  dsp: "DSP",
};

const statusClass: Record<OsgbAssignmentRecord["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  passive: "bg-slate-500/15 text-slate-200 border-slate-400/20",
  completed: "bg-cyan-500/15 text-cyan-200 border-cyan-400/20",
  cancelled: "bg-rose-500/15 text-rose-200 border-rose-400/20",
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const getCacheKey = (userId: string) => `assignments:${userId}`;
const ASSIGNMENT_PAGE_SIZE = 20;

export default function OSGBAssignments() {
  const { user } = useAuth();
  const { canManage } = useAccessRole();
  const [records, setRecords] = useState<OsgbAssignmentRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbCompanyOption[]>([]);
  const [personnel, setPersonnel] = useState<OsgbPersonnelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OsgbAssignmentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [form, setForm] = useState<AssignmentFormState>(emptyForm);
  const [personnelAssignedMinutes, setPersonnelAssignedMinutes] = useState(0);
  const [companyAssignedMinutes, setCompanyAssignedMinutes] = useState(0);

  const loadData = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try {
      const cacheKey = `${getCacheKey(user.id)}:${statusFilter}:${search}:${page}`;
      const [assignmentResult, companyRows] = await Promise.all([
        listOsgbAssignmentsPage(user.id, {
          page,
          pageSize: ASSIGNMENT_PAGE_SIZE,
          status: statusFilter,
          search,
        }),
        companies.length > 0 ? Promise.resolve(companies) : getOsgbCompanyOptions(user.id),
      ]);
      setRecords(assignmentResult.rows);
      setTotalCount(assignmentResult.count);
      setCompanies(companyRows);
      writeOsgbPageCache(cacheKey, {
        records: assignmentResult.rows,
        companies: companyRows,
        totalCount: assignmentResult.count,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Personel görevlendirme verisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const cached = readOsgbPageCache<{
      records: OsgbAssignmentRecord[];
      companies: OsgbCompanyOption[];
      totalCount: number;
    }>(`${getCacheKey(user.id)}:${statusFilter}:${search}:${page}`, CACHE_TTL_MS);
    if (cached) {
      setRecords(cached.records);
      setCompanies(cached.companies);
      setTotalCount(cached.totalCount);
      setLoading(false);
      void loadData(true);
      return;
    }
    void loadData();
  }, [page, search, statusFilter, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ASSIGNMENT_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const ensurePersonnelOptions = async () => {
    if (!user?.id || personnel.length > 0) return;
    setPersonnelLoading(true);
    try {
      const personnelRows = await listActiveOsgbPersonnel(user.id);
      setPersonnel(personnelRows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aktif personel listesi yüklenemedi.");
    } finally {
      setPersonnelLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id || !form.personnelId) {
      setPersonnelAssignedMinutes(0);
      return;
    }

    let active = true;
    void getOsgbPersonnelAssignedMinutesTotal(user.id, form.personnelId, editing?.id)
      .then((value) => {
        if (active) {
          setPersonnelAssignedMinutes(value);
        }
      })
      .catch(() => {
        if (active) {
          setPersonnelAssignedMinutes(0);
        }
      });

    return () => {
      active = false;
    };
  }, [editing?.id, form.personnelId, user?.id]);

  useEffect(() => {
    if (!user?.id || !form.companyId) {
      setCompanyAssignedMinutes(0);
      return;
    }

    let active = true;
    void getOsgbCompanyAssignedMinutesTotal(user.id, form.companyId, editing?.id)
      .then((value) => {
        if (active) {
          setCompanyAssignedMinutes(value);
        }
      })
      .catch(() => {
        if (active) {
          setCompanyAssignedMinutes(0);
        }
      });

    return () => {
      active = false;
    };
  }, [editing?.id, form.companyId, user?.id]);

  const livePersonnelCapacity = useMemo(() => {
    if (!form.personnelId) return null;
    const selected = personnel.find((item) => item.id === form.personnelId);
    if (!selected) return null;

    const requested = Number(form.assignedMinutes || 0);
    const totalProjected = personnelAssignedMinutes + requested;
    const remaining = selected.monthly_capacity_minutes - totalProjected;
    const ratio = selected.monthly_capacity_minutes > 0
      ? Math.round((totalProjected / selected.monthly_capacity_minutes) * 100)
      : 0;

    return {
      selected,
      currentAssigned: personnelAssignedMinutes,
      totalProjected,
      remaining,
      ratio,
      exceeded: remaining < 0,
    };
  }, [form.assignedMinutes, form.personnelId, personnel, personnelAssignedMinutes]);

  const liveCompanyRequirement = useMemo(() => {
    if (!form.companyId) return null;
    const selected = companies.find((item) => item.id === form.companyId);
    if (!selected) return null;

    const requested = Number(form.assignedMinutes || 0);
    const totalProjected = companyAssignedMinutes + requested;
    const required = selected.requiredMinutes || 0;
    const gap = Math.max(0, required - totalProjected);
    const ratio = required > 0 ? Math.round((totalProjected / required) * 100) : 0;

    return {
      selected,
      currentAssigned: companyAssignedMinutes,
      totalProjected,
      required,
      gap,
      ratio,
      stillInsufficient: gap > 0,
    };
  }, [companies, companyAssignedMinutes, form.assignedMinutes, form.companyId]);

  const regulationRecommendation = useMemo(() => {
    const selectedCompany = companies.find((item) => item.id === form.companyId);
    return getAssignmentRecommendation(
      selectedCompany,
      form.assignedRole,
      liveCompanyRequirement?.currentAssigned ?? 0,
    );
  }, [companies, form.assignedRole, form.companyId, liveCompanyRequirement?.currentAssigned]);

  const filteredRecords = useMemo(() => {
    return records;
  }, [records]);

  const summary = useMemo(() => {
    const active = filteredRecords.filter((item) => item.status === "active").length;
    const passive = filteredRecords.filter((item) => item.status === "passive").length;
    const completedOrCancelled = filteredRecords.filter((item) => item.status === "completed" || item.status === "cancelled").length;
    return {
      active,
      passive,
      completedOrCancelled,
    };
  }, [filteredRecords]);

  const openCreate = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    await ensurePersonnelOptions();
    setEditing(null);
    setForm(emptyForm);
    setCompanyAssignedMinutes(0);
    setPersonnelAssignedMinutes(0);
    setDialogOpen(true);
  };

  const openEdit = async (record: OsgbAssignmentRecord) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    await ensurePersonnelOptions();
    setEditing(record);
    setForm({
      companyId: record.company_id,
      personnelId: record.personnel_id,
      assignedRole: record.assigned_role,
      assignedMinutes: String(record.assigned_minutes || ""),
      startDate: record.start_date || "",
      endDate: record.end_date || "",
      status: record.status,
      notes: record.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!user?.id || !form.companyId || !form.personnelId || !form.assignedMinutes) {
      toast.error("Firma, personel ve dakika alanları zorunludur.");
      return;
    }
    if (Number(form.assignedMinutes) <= 0) {
      toast.error("Atanan dakika sıfırdan büyük olmalıdır.");
      return;
    }
    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      toast.error("Bitiş tarihi başlangıç tarihinden önce olamaz.");
      return;
    }
    if (livePersonnelCapacity?.exceeded) {
      toast.error("Seçilen personelin kapasitesi aşılıyor.");
      return;
    }

    setSaving(true);
    try {
      const payload: OsgbAssignmentInput = {
        companyId: form.companyId,
        personnelId: form.personnelId,
        assignedRole: form.assignedRole,
        assignedMinutes: Number(form.assignedMinutes),
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        notes: form.notes,
      };
      await upsertOsgbAssignment(user.id, payload, editing?.id);
      await loadData(true);
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Görevlendirme güncellendi." : "Personel firmaya atandı.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görevlendirme kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!confirm("Bu görevlendirmeyi silmek istiyor musunuz?")) return;
    try {
      await deleteOsgbAssignment(id);
      await loadData(true);
      toast.success("Görevlendirme silindi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görevlendirme silinemedi.");
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">OSGB Personel Görevlendirme</h1>
              <p className="text-sm text-slate-400">
                Her firmaya tek aktif atama kuralı ile personel görevlendirin. Mükerrer aktif atamalar hem uygulamada hem veritabanında engellenir.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "osgb-gorevlendirmeler.csv",
                ["Firma", "Personel", "Rol", "Atanan Dakika", "Baslangic", "Bitis", "Durum", "Not"],
                filteredRecords.map((record) => [
                  record.company?.company_name || "",
                  record.personnel?.full_name || "",
                  roleLabel[record.assigned_role],
                  record.assigned_minutes,
                  record.start_date || "",
                  record.end_date || "",
                  statusLabel[record.status],
                  record.notes || "",
                ]),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Dışa Aktar
          </Button>
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button onClick={() => void openCreate()} disabled={!canManage}>
            <Plus className="mr-2 h-4 w-4" />
            Görevlendirme oluştur
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Aktif atama</CardDescription><CardTitle className="text-3xl text-white">{summary.active}</CardTitle></CardHeader><CardContent className="text-xs text-slate-400">Şu an aktif durumda olan firma atamaları.</CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Toplam kayıt</CardDescription><CardTitle className="text-3xl text-white">{totalCount}</CardTitle></CardHeader><CardContent className="text-xs text-slate-400">Sunucu tarafında filtrelenen toplam görevlendirme sayısı.</CardContent></Card>
        <Card className="border-slate-800 bg-slate-950/70"><CardHeader className="pb-2"><CardDescription>Bu sayfadaki pasif/tamamlanan</CardDescription><CardTitle className="text-3xl text-white">{summary.passive + summary.completedOrCancelled}</CardTitle></CardHeader><CardContent className="text-xs text-slate-400">Görüntülenen sayfadaki aktif dışı görevlendirmeler.</CardContent></Card>
      </div>

      <Alert>
        <ShieldBan className="h-4 w-4" />
        <AlertTitle>Mükerrer atama engeli aktif</AlertTitle>
        <AlertDescription>Bir firmada aynı anda yalnızca bir aktif personel görevlendirmesi olabilir. Yeni aktif kayıt eklenmeye çalışılırsa işlem reddedilir.</AlertDescription>
      </Alert>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Görevlendirme verisi yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader className="pb-4">
          <CardTitle className="text-white">Filtreler</CardTitle>
          <CardDescription>Firma görevlendirmelerini hızlıca bulun ve yönetin.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="space-y-2">
            <Label>Arama</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Firma, personel veya rol ara..." className="pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Durum</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Tüm durumlar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="passive">Pasif</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="cancelled">İptal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Atama listesi</CardTitle>
          <CardDescription>Firma başına tek aktif atama standardı ile yönetilen atamalar.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Görevlendirme kayıtları yükleniyor...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead>Firma</TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Atanan süre</TableHead>
                  <TableHead>Tarih aralığı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      Görevlendirme bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.map((record) => (
                  <TableRow key={record.id} className="border-slate-800">
                    <TableCell className="font-medium text-white">{record.company?.company_name || "Firma"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-white">{record.personnel?.full_name || "-"}</div>
                        <div className="text-xs text-slate-400">{record.notes || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell>{roleLabel[record.assigned_role]}</TableCell>
                    <TableCell>{record.assigned_minutes} dk</TableCell>
                    <TableCell>{formatDate(record.start_date)} - {formatDate(record.end_date)}</TableCell>
                    <TableCell><Badge className={statusClass[record.status]}>{statusLabel[record.status]}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => void openEdit(record)}>Düzenle</Button>
                        <Button size="sm" variant="ghost" className="text-rose-300 hover:text-rose-200" onClick={() => void handleDelete(record.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {totalCount > ASSIGNMENT_PAGE_SIZE ? (
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
            <DialogTitle>{editing ? "Görevlendirme düzenle" : "Yeni görevlendirme oluştur"}</DialogTitle>
            <DialogDescription>Firma, personel ve dakika bilgilerini girin. Bir firmada tek aktif görevlendirme kuralı uygulanır.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Personel</Label>
              <Select value={form.personnelId} onValueChange={(value) => setForm((prev) => ({ ...prev, personnelId: value }))}>
                <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>
                  {personnelLoading ? (
                    <SelectItem value="__loading" disabled>Yükleniyor...</SelectItem>
                  ) : personnel.map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name} • {item.role.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Görevlendirme rolü</Label>
              <Select value={form.assignedRole} onValueChange={(value) => setForm((prev) => ({ ...prev, assignedRole: value as AssignmentFormState["assignedRole"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="igu">İGU</SelectItem>
                  <SelectItem value="hekim">İşyeri Hekimi</SelectItem>
                  <SelectItem value="dsp">DSP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Atanan süre (dk)</Label>
              <Input type="number" min="0" value={form.assignedMinutes} onChange={(e) => setForm((prev) => ({ ...prev, assignedMinutes: e.target.value }))} />
            </div>
            {regulationRecommendation ? (
              <div className="space-y-2 md:col-span-2">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Mevzuat öneri motoru</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <div>{regulationRecommendation.summary}</div>
                    <div className="text-xs text-slate-400">
                      Kişi başı öneri: {regulationRecommendation.perEmployeeMinutes} dk • Toplam öneri: {regulationRecommendation.recommendedMinutes} dk • Mevcut aktif toplam: {regulationRecommendation.currentAssignedMinutes} dk
                    </div>
                    <div className="text-xs text-slate-400">
                      Kalan mevzuat açığı: {regulationRecommendation.remainingGapMinutes} dk • Dayanak: {regulationRecommendation.legalReference}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          assignedMinutes: String(
                            regulationRecommendation.remainingGapMinutes > 0
                              ? regulationRecommendation.remainingGapMinutes
                              : regulationRecommendation.recommendedMinutes,
                          ),
                        }))
                      }
                    >
                      Önerilen dakikayı uygula
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            {liveCompanyRequirement ? (
              <div className="space-y-2 md:col-span-2">
                <Alert variant={liveCompanyRequirement.stillInsufficient ? "destructive" : "default"}>
                  <Gauge className="h-4 w-4" />
                  <AlertTitle>{liveCompanyRequirement.selected.companyName} için gerekli süre karşılaştırması</AlertTitle>
                  <AlertDescription>
                    Gerekli: {liveCompanyRequirement.required} dk • Mevcut aktif atama: {liveCompanyRequirement.currentAssigned} dk • Bu kayıtla toplam: {liveCompanyRequirement.totalProjected} dk • Kalan fark: {liveCompanyRequirement.gap} dk
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            {livePersonnelCapacity ? (
              <div className="space-y-2 md:col-span-2">
                <Alert variant={livePersonnelCapacity.exceeded ? "destructive" : "default"}>
                  <Gauge className="h-4 w-4" />
                  <AlertTitle>{livePersonnelCapacity.selected.full_name} için canlı kapasite görünümü</AlertTitle>
                  <AlertDescription>
                    Mevcut yük: {livePersonnelCapacity.currentAssigned} dk • Bu atama ile toplam: {livePersonnelCapacity.totalProjected} dk / {livePersonnelCapacity.selected.monthly_capacity_minutes} dk • Kalan: {livePersonnelCapacity.remaining} dk
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Başlangıç tarihi</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Bitiş tarihi</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as AssignmentFormState["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="passive">Pasif</SelectItem>
                  <SelectItem value="completed">Tamamlandı</SelectItem>
                  <SelectItem value="cancelled">İptal</SelectItem>
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
            <Button onClick={() => void handleSave()} disabled={saving || livePersonnelCapacity?.exceeded}>
              {saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



