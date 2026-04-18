import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createOsgbTaskWorkspace, deleteOsgbTaskWorkspace, listOsgbManagedCompanyOptions, listOsgbTasksWorkspace, type OsgbManagedCompanyOption, type OsgbWorkspaceTaskRecord, updateOsgbTaskWorkspaceStatus } from "@/lib/osgbPlatform";

const emptyForm = { companyId: "", title: "", description: "", priority: "medium" as OsgbWorkspaceTaskRecord["priority"], status: "open" as OsgbWorkspaceTaskRecord["status"], assignedTo: "", dueDate: "" };

export default function OSGBTasks() {
  const { user, profile } = useAuth();
  const { canManageOperations } = useOsgbAccess();
  const organizationId = profile?.organization_id || null;
  const [records, setRecords] = useState<OsgbWorkspaceTaskRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbManagedCompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) return setLoading(false);
    setLoading(true);
    try {
      const [taskRows, companyRows] = await Promise.all([listOsgbTasksWorkspace(organizationId), listOsgbManagedCompanyOptions(organizationId)]);
      setRecords(taskRows);
      setCompanies(companyRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Görevler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const summary = useMemo(() => ({
    open: records.filter((item) => item.status === "open").length,
    inProgress: records.filter((item) => item.status === "in_progress").length,
    completed: records.filter((item) => item.status === "completed").length,
  }), [records]);

  const handleCreate = async () => {
    if (!organizationId || !user?.id || !form.title.trim()) return toast.error("Görev başlığı zorunlu.");
    try {
      const created = await createOsgbTaskWorkspace(user.id, organizationId, { companyId: form.companyId || null, title: form.title, description: form.description || null, priority: form.priority, status: form.status, assignedTo: form.assignedTo || null, dueDate: form.dueDate || null, source: "manual" });
      setRecords((prev) => [created, ...prev]);
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Görev oluşturuldu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev oluşturulamadı.");
    }
  };

  const handleStatusChange = async (record: OsgbWorkspaceTaskRecord, status: OsgbWorkspaceTaskRecord["status"]) => {
    try {
      const updated = await updateOsgbTaskWorkspaceStatus(organizationId, record.id, status);
      setRecords((prev) => prev.map((item) => item.id === record.id ? updated : item));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev durumu güncellenemedi.");
    }
  };

  const handleDelete = async (record: OsgbWorkspaceTaskRecord) => {
    try {
      await deleteOsgbTaskWorkspace(organizationId, record.id);
      setRecords((prev) => prev.filter((item) => item.id !== record.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev silinemedi.");
    }
  };

  if (!organizationId) return <div className="container mx-auto py-6"><Alert><AlertTitle>Organizasyon gerekli</AlertTitle><AlertDescription>Görev motoru organizasyon bazlı çalışır.</AlertDescription></Alert></div>;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></div><div><h1 className="text-3xl font-bold tracking-tight text-foreground">Görev Motoru</h1><p className="text-sm text-muted-foreground">Artık sadece managed firma havuzuna bağlı görevler burada görünür.</p></div></div>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void loadData()}><RefreshCcw className="mr-2 h-4 w-4" />Yenile</Button><Button onClick={() => setDialogOpen(true)} disabled={!canManageOperations}><Plus className="mr-2 h-4 w-4" />Görev Ekle</Button></div>
      </div>
      {error ? <Alert variant="destructive"><AlertTitle>Görevler yüklenemedi</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardDescription>Açık</CardDescription><CardTitle>{summary.open}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Devam Eden</CardDescription><CardTitle>{summary.inProgress}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Tamamlanan</CardDescription><CardTitle>{summary.completed}</CardTitle></CardHeader></Card>
      </div>
      <Card><CardHeader><CardTitle>Görev Listesi</CardTitle><CardDescription>Eski kullanıcı bazlı görevler yerine organizasyon ve managed firma odaklı liste.</CardDescription></CardHeader><CardContent className="space-y-3">{loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-muted/40" />) : records.length ? records.map((record) => <div key={record.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium text-foreground">{record.title}</div><div className="mt-1 text-sm text-muted-foreground">{record.companyName || "Genel görev"} · {record.assignedTo || "Atanmamış"}</div>{record.description ? <div className="mt-2 text-sm text-muted-foreground">{record.description}</div> : null}</div><div className="flex flex-wrap gap-2"><Badge variant="outline">{record.priority}</Badge><Badge variant="outline">{record.status}</Badge></div></div><div className="mt-4 flex flex-wrap gap-2">{record.status !== "completed" ? <Button size="sm" variant="outline" onClick={() => void handleStatusChange(record, "completed")}>Tamamla</Button> : null}{record.status === "open" ? <Button size="sm" variant="outline" onClick={() => void handleStatusChange(record, "in_progress")}>İlerle</Button> : null}{canManageOperations ? <Button size="sm" variant="outline" onClick={() => void handleDelete(record)}><Trash2 className="mr-2 h-4 w-4" />Sil</Button> : null}</div></div>) : <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-sm text-muted-foreground">Henüz görev yok. Otomasyon merkezi ya da manuel giriş ile görev oluşturabilirsiniz.</div>}</CardContent></Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>Yeni Görev</DialogTitle><DialogDescription>Görevler managed firma havuzuna bağlanır.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Firma</Label><Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}><SelectTrigger><SelectValue placeholder="Genel görev" /></SelectTrigger><SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Başlık</Label><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></div><div className="space-y-2"><Label>Açıklama</Label><Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Öncelik</Label><Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as OsgbWorkspaceTaskRecord["priority"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Düşük</SelectItem><SelectItem value="medium">Orta</SelectItem><SelectItem value="high">Yüksek</SelectItem><SelectItem value="critical">Kritik</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Durum</Label><Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as OsgbWorkspaceTaskRecord["status"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Açık</SelectItem><SelectItem value="in_progress">Devam ediyor</SelectItem><SelectItem value="completed">Tamamlandı</SelectItem><SelectItem value="cancelled">İptal</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Atanan kişi</Label><Input value={form.assignedTo} onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))} /></div><div className="space-y-2"><Label>Bitiş tarihi</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button><Button onClick={handleCreate} disabled={!canManageOperations}>Kaydet</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
