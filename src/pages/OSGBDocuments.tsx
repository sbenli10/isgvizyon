import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Edit,
  FileCheck,
  Plus,
  RefreshCcw,
  Search,
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
import { cn } from "@/lib/utils";
import {
  createUpcomingDocumentTasks,
  deleteOsgbDocument,
  getOsgbCompanyOptions,
  getOsgbDocumentsOverview,
  listActionableOsgbDocuments,
  listOsgbDocumentsPage,
  type OsgbCompanyOption,
  type OsgbDocumentInput,
  type OsgbDocumentsOverview,
  type OsgbDocumentRecord,
  upsertOsgbDocument,
} from "@/lib/osgbOperations";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { useAccessRole } from "@/hooks/useAccessRole";
import { downloadCsv } from "@/lib/csvExport";

type DocumentFormState = {
  companyId: string;
  documentType: string;
  documentName: string;
  issueDate: string;
  expiryDate: string;
  status: OsgbDocumentRecord["status"];
  fileUrl: string;
  notes: string;
};

const emptyForm: DocumentFormState = {
  companyId: "",
  documentType: "risk_assessment",
  documentName: "",
  issueDate: "",
  expiryDate: "",
  status: "active",
  fileUrl: "",
  notes: "",
};

const statusLabel: Record<OsgbDocumentRecord["status"], string> = {
  active: "Aktif",
  warning: "Yaklaşıyor",
  expired: "Süresi Dolmuş",
  archived: "Arşiv",
};

const statusClass: Record<OsgbDocumentRecord["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  warning: "bg-yellow-500/15 text-yellow-200 border-yellow-400/20",
  expired: "bg-red-500/15 text-red-200 border-red-400/20",
  archived: "bg-slate-500/15 text-slate-200 border-slate-400/20",
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const getCacheKey = (userId: string) => `documents:${userId}`;
const DOCUMENT_PAGE_SIZE = 20;

export default function OSGBDocuments() {
  const { user } = useAuth();
  const { canManage } = useAccessRole();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<OsgbDocumentRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbCompanyOption[]>([]);
  const [overview, setOverview] = useState<OsgbDocumentsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [saving, setSaving] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OsgbDocumentRecord | null>(null);
  const [form, setForm] = useState<DocumentFormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [batchInfo, setBatchInfo] = useState<{ created: number; skipped: number } | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status && ["active", "warning", "expired", "archived"].includes(status)) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const loadData = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try {
      const cacheKey = `${getCacheKey(user.id)}:${statusFilter}:${companyFilter}:${search}:${page}`;
      const [documentResult, companyRows, documentOverview] = await Promise.all([
        listOsgbDocumentsPage(user.id, {
          page,
          pageSize: DOCUMENT_PAGE_SIZE,
          status: statusFilter,
          companyId: companyFilter,
          search,
        }),
        companies.length > 0 ? Promise.resolve(companies) : getOsgbCompanyOptions(user.id),
        getOsgbDocumentsOverview(user.id),
      ]);
      setRecords(documentResult.rows);
      setCompanies(companyRows);
      setOverview(documentOverview);
      setTotalCount(documentResult.count);
      writeOsgbPageCache(cacheKey, {
        records: documentResult.rows,
        companies: companyRows,
        overview: documentOverview,
        totalCount: documentResult.count,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OSGB evrak kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const cached = readOsgbPageCache<{
      records: OsgbDocumentRecord[];
      companies: OsgbCompanyOption[];
      overview: OsgbDocumentsOverview;
      totalCount: number;
    }>(`${getCacheKey(user.id)}:${statusFilter}:${companyFilter}:${search}:${page}`, CACHE_TTL_MS);
    if (cached) {
      setRecords(cached.records);
      setCompanies(cached.companies);
      setOverview(cached.overview);
      setTotalCount(cached.totalCount);
      setLoading(false);
      void loadData(true);
      return;
    }
    void loadData();
  }, [companyFilter, page, search, statusFilter, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [companyFilter, search, statusFilter]);

  const summary = useMemo(() => ({
    active: overview?.activeCount || 0,
    warning: overview?.warningCount || 0,
    expired: overview?.expiredCount || 0,
  }), [overview]);

  const filteredRecords = useMemo(() => records, [records]);
  const totalPages = Math.max(1, Math.ceil(totalCount / DOCUMENT_PAGE_SIZE));

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

  const openEdit = (record: OsgbDocumentRecord) => {
    setEditing(record);
    setForm({
      companyId: record.company_id,
      documentType: record.document_type,
      documentName: record.document_name,
      issueDate: record.issue_date || "",
      expiryDate: record.expiry_date || "",
      status: record.status,
      fileUrl: record.file_url || "",
      notes: record.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!user?.id || !form.companyId || !form.documentName) {
      toast.error("Firma ve doküman adı zorunludur.");
      return;
    }
    if (form.issueDate && form.expiryDate && new Date(form.issueDate) > new Date(form.expiryDate)) {
      toast.error("Geçerlilik tarihi düzenlenme tarihinden önce olamaz.");
      return;
    }
    if (form.status === "expired" && form.expiryDate && new Date(form.expiryDate) > new Date()) {
      toast.error("Durum süresi dolmuş ise bitiş tarihi geçmişte olmalıdır.");
      return;
    }

    setSaving(true);
    try {
      const payload: OsgbDocumentInput = {
        companyId: form.companyId,
        documentType: form.documentType,
        documentName: form.documentName,
        issueDate: form.issueDate,
        expiryDate: form.expiryDate,
        status: form.status,
        fileUrl: form.fileUrl,
        notes: form.notes,
      };
      await upsertOsgbDocument(user.id, payload, editing?.id);
      await loadData(true);
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Evrak kaydı güncellendi." : "Evrak kaydı oluşturuldu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Evrak kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!confirm("Bu evrak kaydını silmek istiyor musunuz?")) return;
    try {
      await deleteOsgbDocument(id);
      await loadData(true);
      toast.success("Evrak kaydı silindi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Evrak kaydı silinemedi.");
    }
  };

  const handleGenerateTasks = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!user?.id) return;
    setCreatingTasks(true);
    try {
      const actionableDocuments = await listActionableOsgbDocuments(user.id);
      const result = await createUpcomingDocumentTasks(user.id, actionableDocuments);
      setBatchInfo(result);
      if (result.created === 0 && result.skipped === 0) {
        toast.message("Görev üretilecek yaklaşan evrak bulunamadı.");
      } else {
        toast.success(`${result.created} görev oluşturuldu. ${result.skipped} kayıt zaten görevdeydi.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Otomatik evrak görevleri üretilemedi.");
    } finally {
      setCreatingTasks(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Evrak Takibi</h1>
              <p className="text-sm text-slate-400">Risk değerlendirmesi, ADEP, kurul ve diğer OSGB evraklarının merkezi takibi.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "osgb-evraklar.csv",
                ["Firma", "Tür", "Doküman", "Bitiş", "Durum"],
                filteredRecords.map((record) => [
                  record.company?.company_name || "",
                  record.document_type,
                  record.document_name,
                  record.expiry_date || "",
                  statusLabel[record.status],
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
          <Button variant="outline" onClick={() => void handleGenerateTasks()} disabled={creatingTasks || !canManage}>
            {creatingTasks ? "Üretiliyor..." : "Yaklaşan evraklardan görev üret"}
          </Button>
          <Button onClick={openCreate} disabled={!canManage}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni evrak
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Evrak verisi yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {batchInfo && (batchInfo.created > 0 || batchInfo.skipped > 0) ? (
        <Alert className="border-cyan-500/20 bg-cyan-500/10 text-cyan-100">
          <AlertTitle>Günlük evrak batch durumu</AlertTitle>
          <AlertDescription>
            {batchInfo.created} yeni görev üretildi, {batchInfo.skipped} kayıt mevcut görev nedeniyle atlandı.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <button type="button" onClick={() => setStatusFilter("active")} className="text-left"><Card className="border-slate-800 bg-slate-900/70 transition hover:border-emerald-500/30"><CardHeader className="pb-3"><CardDescription>Aktif</CardDescription><CardTitle className="mt-2 text-3xl text-white">{summary.active}</CardTitle></CardHeader></Card></button>
        <button type="button" onClick={() => setStatusFilter("warning")} className="text-left"><Card className="border-slate-800 bg-slate-900/70 transition hover:border-yellow-500/30"><CardHeader className="pb-3"><CardDescription>Yaklaşan</CardDescription><CardTitle className="mt-2 text-3xl text-white">{summary.warning}</CardTitle></CardHeader></Card></button>
        <button type="button" onClick={() => setStatusFilter("expired")} className="text-left"><Card className="border-slate-800 bg-slate-900/70 transition hover:border-red-500/30"><CardHeader className="pb-3"><CardDescription>Süresi dolmuş</CardDescription><CardTitle className="mt-2 text-3xl text-white">{summary.expired}</CardTitle></CardHeader></Card></button>
      </div>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Evrak listesi</CardTitle>
          <CardDescription>Şirket bazlı belge ve geçerlilik görünümü.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Doküman, tür, firma veya not ara" />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full lg:w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm firmalar</SelectItem>
                {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="warning">Yaklaşıyor</SelectItem>
                <SelectItem value="expired">Süresi Dolmuş</SelectItem>
                <SelectItem value="archived">Arşiv</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearch(""); setCompanyFilter("ALL"); setStatusFilter("ALL"); }}>
              Filtreyi temizle
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead>Firma</TableHead>
                <TableHead>Doküman</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Geçerlilik</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-slate-400">Yükleniyor...</TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-slate-400">Eşleşen evrak kaydı bulunamadı.</TableCell></TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id} className="border-slate-800">
                    <TableCell className="font-medium text-white">{record.company?.company_name || "Firma"}</TableCell>
                    <TableCell>{record.document_name}</TableCell>
                    <TableCell>{record.document_type}</TableCell>
                    <TableCell>{formatDate(record.expiry_date)}</TableCell>
                    <TableCell><Badge className={cn("border", statusClass[record.status])}>{statusLabel[record.status]}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="outline" onClick={() => openEdit(record)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="outline" onClick={() => handleDelete(record.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Toplam {totalCount} kayıt, sayfa {page} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Evrak kaydını düzenle" : "Yeni evrak kaydı"}</DialogTitle>
            <DialogDescription>Doküman tipi, geçerlilik tarihi ve notları yönetin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>
                  {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Doküman Türü</Label>
              <Select value={form.documentType} onValueChange={(value) => setForm((prev) => ({ ...prev, documentType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="risk_assessment">Risk Değerlendirmesi</SelectItem>
                  <SelectItem value="adep">Acil Durum Eylem Planı</SelectItem>
                  <SelectItem value="board_meeting">Kurul Toplantısı</SelectItem>
                  <SelectItem value="training">Eğitim Kaydı</SelectItem>
                  <SelectItem value="certificate">Sertifika</SelectItem>
                  <SelectItem value="other">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Doküman Adı</Label><Input value={form.documentName} onChange={(e) => setForm((prev) => ({ ...prev, documentName: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Durum</Label><Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as OsgbDocumentRecord["status"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Aktif</SelectItem><SelectItem value="warning">Yaklaşıyor</SelectItem><SelectItem value="expired">Süresi Dolmuş</SelectItem><SelectItem value="archived">Arşiv</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Düzenlenme Tarihi</Label><Input type="date" value={form.issueDate} onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Geçerlilik Tarihi</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Dosya URL</Label><Input value={form.fileUrl} onChange={(e) => setForm((prev) => ({ ...prev, fileUrl: e.target.value }))} placeholder="https://..." /></div>
            <div className="space-y-2 md:col-span-2"><Label>Not</Label><Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



