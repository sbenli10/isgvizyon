import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Edit,
  NotebookPen,
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
  deleteOsgbNote,
  getOsgbCompanyOptions,
  listOsgbNotes,
  type OsgbCompanyOption,
  type OsgbNoteInput,
  type OsgbNoteRecord,
  upsertOsgbNote,
} from "@/lib/osgbOperations";
import { useAccessRole } from "@/hooks/useAccessRole";
import { downloadCsv } from "@/lib/csvExport";

type NoteFormState = {
  companyId: string;
  title: string;
  note: string;
  noteType: OsgbNoteRecord["note_type"];
};

const emptyForm: NoteFormState = {
  companyId: "",
  title: "",
  note: "",
  noteType: "general",
};

const typeLabel: Record<OsgbNoteRecord["note_type"], string> = {
  general: "Genel",
  finance: "Finans",
  document: "Evrak",
  assignment: "Atama",
  risk: "Risk",
};

export default function OSGBNotes() {
  const { user } = useAuth();
  const { canManage } = useAccessRole();
  const [records, setRecords] = useState<OsgbNoteRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbCompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OsgbNoteRecord | null>(null);
  const [form, setForm] = useState<NoteFormState>(emptyForm);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [noteRows, companyRows] = await Promise.all([
        listOsgbNotes(user.id),
        getOsgbCompanyOptions(user.id),
      ]);
      setRecords(noteRows);
      setCompanies(companyRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operasyon notları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesType = typeFilter === "ALL" || record.note_type === typeFilter;
      const matchesCompany = companyFilter === "ALL" || record.company_id === companyFilter;
      const matchesQuery = !query || [record.title || "", record.note, record.company?.company_name || ""].some((value) => value.toLowerCase().includes(query));
      return matchesType && matchesCompany && matchesQuery;
    });
  }, [records, search, typeFilter, companyFilter]);

  const openCreate = () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (record: OsgbNoteRecord) => {
    setEditing(record);
    setForm({
      companyId: record.company_id || "",
      title: record.title || "",
      note: record.note,
      noteType: record.note_type,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!user?.id || !form.note.trim()) {
      toast.error("Not içeriği zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const payload: OsgbNoteInput = {
        companyId: form.companyId || null,
        title: form.title,
        note: form.note,
        noteType: form.noteType,
      };
      const saved = await upsertOsgbNote(user.id, payload, editing?.id);
      setRecords((prev) => editing ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev]);
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Not güncellendi." : "Not eklendi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!confirm("Bu notu silmek istiyor musunuz?")) return;
    try {
      await deleteOsgbNote(id);
      setRecords((prev) => prev.filter((item) => item.id !== id));
      toast.success("Not silindi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not silinemedi.");
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <NotebookPen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Operasyon Notları</h1>
              <p className="text-sm text-slate-400">Firma bazlı operasyon hafızası, takip notları ve kısa aksiyon kayıtları.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "osgb-notlar.csv",
                ["Firma", "Başlık", "Tür", "Not", "Güncelleme"],
                filteredRecords.map((record) => [
                  record.company?.company_name || "",
                  record.title || "",
                  typeLabel[record.note_type],
                  record.note,
                  record.updated_at,
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
            Yeni not
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Notlar yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Not listesi</CardTitle>
          <CardDescription>Firma, tip ve serbest arama ile operasyon hafızasını filtreleyin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Başlık, not veya firma ara" />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full lg:w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm firmalar</SelectItem>
                {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm tipler</SelectItem>
                <SelectItem value="general">Genel</SelectItem>
                <SelectItem value="finance">Finans</SelectItem>
                <SelectItem value="document">Evrak</SelectItem>
                <SelectItem value="assignment">Atama</SelectItem>
                <SelectItem value="risk">Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-950/50" />)
            ) : filteredRecords.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
                Eşleşen not bulunamadı.
              </div>
            ) : (
              filteredRecords.map((record) => (
                <Card key={record.id} className="border-slate-800 bg-slate-950/40">
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg text-white">{record.title || "Başlıksız not"}</CardTitle>
                        <CardDescription className="pt-2">{record.company?.company_name || "Firma belirtilmedi"}</CardDescription>
                      </div>
                      <Badge variant="outline">{typeLabel[record.note_type]}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-5 text-sm leading-6 text-slate-300">{record.note}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{new Date(record.updated_at).toLocaleDateString("tr-TR")}</span>
                      <div className="flex gap-2">
                        <Button size="icon" variant="outline" onClick={() => openEdit(record)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="outline" onClick={() => handleDelete(record.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Notu düzenle" : "Yeni not"}</DialogTitle>
            <DialogDescription>Firma bazlı operasyon hafızasına yeni not ekleyin.</DialogDescription>
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
            <div className="space-y-2"><Label>Not Tipi</Label><Select value={form.noteType} onValueChange={(value) => setForm((prev) => ({ ...prev, noteType: value as OsgbNoteRecord["note_type"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">Genel</SelectItem><SelectItem value="finance">Finans</SelectItem><SelectItem value="document">Evrak</SelectItem><SelectItem value="assignment">Atama</SelectItem><SelectItem value="risk">Risk</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 md:col-span-2"><Label>Başlık</Label><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Not</Label><Textarea value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} className="min-h-[180px]" /></div>
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
