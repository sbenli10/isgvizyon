import { useCallback, useEffect, useMemo, useState } from "react";
import { NotebookPen, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePersistentDraft } from "@/hooks/usePersistentDraft";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";
import { useOsgbManagedCompanies } from "@/hooks/useOsgbManagedCompanies";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteOsgbNoteWorkspace,
  listOsgbNotesWorkspace,
  type OsgbWorkspaceNoteRecord,
  upsertOsgbNoteWorkspace,
} from "@/lib/osgbPlatform";

const emptyForm = {
  companyId: "",
  title: "",
  note: "",
  noteType: "general" as OsgbWorkspaceNoteRecord["noteType"],
};

type NoteFormState = typeof emptyForm;

type NoteDraft = {
  mode: "create" | "edit";
  editingId: string | null;
  form: NoteFormState;
};

export default function OSGBNotes() {
  const { user, profile } = useAuth();
  const { canManageOperations } = useOsgbAccess();
  const organizationId = profile?.organization_id || null;
  const [records, setRecords] = useState<OsgbWorkspaceNoteRecord[]>([]);
  const { companies } = useOsgbManagedCompanies(organizationId);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pendingRestoredEditingId, setPendingRestoredEditingId] = useState<string | null>(null);
  const draftScope = useMemo(
    () => ({
      userId: user?.id,
      orgId: organizationId,
    }),
    [organizationId, user?.id],
  );
  const {
    clearDraft: clearNoteDraft,
    restoreDraft: restoreNoteDraft,
  } = usePersistentDraft<NoteDraft>({
    key: "osgb-notes:dialog",
    enabled: Boolean(user?.id && dialogOpen),
    autoRestore: false,
    version: 1,
    storage: "localStorage",
    ttlMs: 14 * 24 * 60 * 60 * 1000,
    debounceMs: 400,
    scope: draftScope,
    value: {
      mode: editingId ? "edit" : "create",
      editingId,
      form,
    },
  });

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const noteRows = await listOsgbNotesWorkspace(organizationId);
      setRecords(noteRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notlar yüklənemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user?.id) return;

    const draft = restoreNoteDraft();
    if (!draft?.form) return;
    const hasContent = Boolean(
      draft.editingId ||
        draft.form.companyId ||
        draft.form.title.trim() ||
        draft.form.note.trim(),
    );
    if (!hasContent) return;

    setForm(draft.form);
    setPendingRestoredEditingId(draft.mode === "edit" ? draft.editingId || null : null);
    setDialogOpen(true);
    toast.info("Kaydedilmemiş not taslağı geri yüklendi.");
  }, [restoreNoteDraft, user?.id]);

  useEffect(() => {
    if (!pendingRestoredEditingId || records.length === 0) return;

    const restoredRecord =
      records.find((record) => record.id === pendingRestoredEditingId) || null;
    setEditingId(restoredRecord?.id || null);
    if (!restoredRecord) {
      clearNoteDraft();
    }
    setPendingRestoredEditingId(null);
  }, [clearNoteDraft, pendingRestoredEditingId, records]);

  const summary = useMemo(
    () => ({
      total: records.length,
      finance: records.filter((item) => item.noteType === "finance").length,
      document: records.filter((item) => item.noteType === "document").length,
    }),
    [records],
  );

  const handleSave = async () => {
    if (!organizationId || !user?.id || !form.note.trim()) {
      toast.error("Not içeriği zorunlu.");
      return;
    }

    try {
      const saved = await upsertOsgbNoteWorkspace(
        user.id,
        organizationId,
        {
          companyId: form.companyId || null,
          title: form.title || null,
          note: form.note,
          noteType: form.noteType,
        },
        editingId || undefined,
      );

      setRecords((prev) =>
        editingId
          ? prev.map((item) => (item.id === editingId ? saved : item))
          : [saved, ...prev],
      );
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      clearNoteDraft();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not kaydedilemedi.");
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertTitle>Organizasyon gerekli</AlertTitle>
          <AlertDescription>Operasyon notları organizasyon bazlı çalışır.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <NotebookPen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Operasyon Notları</h1>
              <p className="text-sm text-muted-foreground">
                Managed firma havuzuna bağlı notlar burada tutulur.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button
            onClick={() => {
              const draft = restoreNoteDraft();
              if (draft?.form && draft.mode === "create") {
                const hasContent = Boolean(
                  draft.editingId ||
                    draft.form.companyId ||
                    draft.form.title.trim() ||
                    draft.form.note.trim(),
                );
                if (hasContent) {
                  setForm(draft.form);
                  setPendingRestoredEditingId(null);
                  setDialogOpen(true);
                  toast.info("Kaydedilmemiş not taslağı geri yüklendi.");
                  return;
                }
              }
              setDialogOpen(true);
            }}
            disabled={!canManageOperations}
          >
            <Plus className="mr-2 h-4 w-4" />
            Not Ekle
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Notlar yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Toplam</CardDescription>
            <CardTitle>{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Finans</CardDescription>
            <CardTitle>{summary.finance}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Evrak</CardDescription>
            <CardTitle>{summary.document}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Not Akışı</CardTitle>
          <CardDescription>
            Eski kullanıcı bazlı notlar yerine organizasyon ve firma odaklı ortak hafıza.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-muted/40" />
            ))
          ) : records.length ? (
            records.map((record) => (
              <div key={record.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{record.title || "Başlıksız not"}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {record.companyName || "Genel not"} · {new Date(record.updatedAt).toLocaleDateString("tr-TR")}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{record.note}</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{record.noteType}</Badge>
                    {canManageOperations ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const restoredDraft = restoreNoteDraft();
                          if (
                            restoredDraft?.form &&
                            restoredDraft.mode === "edit" &&
                            restoredDraft.editingId === record.id
                          ) {
                            setEditingId(record.id);
                            setForm(restoredDraft.form);
                            setDialogOpen(true);
                            toast.info("KaydedilmemiÅŸ dÃ¼zenleme taslaÄŸÄ± geri yÃ¼klendi.");
                            return;
                          }
                          setEditingId(record.id);
                          setForm({
                            companyId: record.companyId || "",
                            title: record.title || "",
                            note: record.note,
                            noteType: record.noteType,
                          });
                          setDialogOpen(true);
                        }}
                      >
                        Düzenle
                      </Button>
                    ) : null}
                    {canManageOperations ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await deleteOsgbNoteWorkspace(organizationId, record.id);
                          setRecords((prev) => prev.filter((item) => item.id !== record.id));
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Sil
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-sm text-muted-foreground">
              Henüz operasyon notu yok.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Notu Düzenle" : "Yeni Not"}</DialogTitle>
            <DialogDescription>Notlar managed firma havuzuna bağlanır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select
                value={form.companyId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Genel not" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Başlık</Label>
              <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Not Türü</Label>
              <Select
                value={form.noteType}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, noteType: value as OsgbWorkspaceNoteRecord["noteType"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Genel</SelectItem>
                  <SelectItem value="finance">Finans</SelectItem>
                  <SelectItem value="document">Evrak</SelectItem>
                  <SelectItem value="assignment">Atama</SelectItem>
                  <SelectItem value="risk">Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Not</Label>
              <Textarea value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingId(null);
                setForm(emptyForm);
                clearNoteDraft();
              }}
            >
              İptal
            </Button>
            <Button onClick={handleSave} disabled={!canManageOperations}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
