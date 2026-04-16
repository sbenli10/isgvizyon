import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  MapPinned,
  PlayCircle,
  Plus,
  RefreshCcw,
  Signature,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessRole } from "@/hooks/useAccessRole";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  addOsgbFieldVisitEvidence,
  listOsgbFieldVisitsWorkspace,
  transitionOsgbFieldVisit,
  upsertOsgbFieldVisitWorkspace,
  type OsgbEvidenceType,
  type OsgbFieldVisitRecord,
  type OsgbFieldVisitType,
  type OsgbFieldVisitWorkspaceData,
} from "@/lib/osgbPlatform";
import { cn } from "@/lib/utils";

const visitTypeLabels: Record<OsgbFieldVisitType, string> = {
  onsite_visit: "Rutin saha ziyareti",
  board_meeting: "Kurul toplantısı",
  training: "Eğitim",
  risk_review: "Risk gözden geçirme",
  emergency_drill: "Tatbikat",
  health_surveillance: "Sağlık gözetimi",
  periodic_control: "Periyodik kontrol",
  document_delivery: "Belge teslimi",
  remote_consulting: "Uzaktan destek",
};

const statusLabels: Record<OsgbFieldVisitRecord["status"], string> = {
  planned: "Planlandı",
  in_progress: "Sahada",
  completed: "Tamamlandı",
  missed: "Kaçırıldı",
  cancelled: "İptal",
};

const evidenceTypeLabels: Record<OsgbEvidenceType, string> = {
  photo: "Fotoğraf",
  signature: "İmza",
  attendance_sheet: "Yoklama",
  meeting_minutes: "Tutanak",
  training_record: "Eğitim kaydı",
  gps: "GPS",
  document: "Belge",
  note: "Not",
};

type VisitFormState = {
  companyId: string;
  visitType: OsgbFieldVisitType;
  plannedAt: string;
  plannedEndAt: string;
  visitAddress: string;
  notes: string;
  nextActionSummary: string;
  complianceImpactMinutes: string;
  assignedPersonnelIds: string[];
};

type EvidenceFormState = {
  visitId: string;
  type: OsgbEvidenceType;
  title: string;
  fileUrl: string;
  metadata: string;
};

const emptyVisitForm: VisitFormState = {
  companyId: "",
  visitType: "onsite_visit",
  plannedAt: "",
  plannedEndAt: "",
  visitAddress: "",
  notes: "",
  nextActionSummary: "",
  complianceImpactMinutes: "",
  assignedPersonnelIds: [],
};

const emptyEvidenceForm: EvidenceFormState = {
  visitId: "",
  type: "photo",
  title: "",
  fileUrl: "",
  metadata: "",
};

const statusTone = (status: OsgbFieldVisitRecord["status"]) => {
  switch (status) {
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "in_progress":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";
    case "planned":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    default:
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  }
};

const proofTone = (visit: OsgbFieldVisitRecord) => {
  if (visit.proofLevel === "Güçlü") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (visit.proofLevel === "Orta") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return "border-rose-500/20 bg-rose-500/10 text-rose-200";
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function FieldVisits() {
  const { user, profile } = useAuth();
  const { canManage } = useAccessRole();
  const organizationId = profile?.organization_id || null;
  const [data, setData] = useState<OsgbFieldVisitWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [form, setForm] = useState<VisitFormState>(emptyVisitForm);
  const [evidenceForm, setEvidenceForm] = useState<EvidenceFormState>(emptyEvidenceForm);
  const [saving, setSaving] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const workspace = await listOsgbFieldVisitsWorkspace(organizationId);
      setData(workspace);
      setSelectedVisitId((current) => current || workspace.visits[0]?.id || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saha ziyaretleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedVisit = useMemo(
    () => data?.visits.find((visit) => visit.id === selectedVisitId) || data?.visits[0] || null,
    [data?.visits, selectedVisitId],
  );

  const actionableVisits = useMemo(
    () => (data?.visits || []).filter((visit) => visit.status !== "cancelled"),
    [data?.visits],
  );

  const togglePersonnel = (personnelId: string) => {
    setForm((current) => ({
      ...current,
      assignedPersonnelIds: current.assignedPersonnelIds.includes(personnelId)
        ? current.assignedPersonnelIds.filter((id) => id !== personnelId)
        : [...current.assignedPersonnelIds, personnelId],
    }));
  };

  const handleCreateVisit = async () => {
    if (!organizationId || !user?.id) return;
    if (!form.companyId || !form.plannedAt) {
      toast.error("Firma ve planlanan başlangıç zamanı zorunlu.");
      return;
    }

    setSaving(true);
    try {
      await upsertOsgbFieldVisitWorkspace(user.id, organizationId, {
        companyId: form.companyId,
        visitType: form.visitType,
        plannedAt: form.plannedAt,
        plannedEndAt: form.plannedEndAt || null,
        visitAddress: form.visitAddress || null,
        notes: form.notes || null,
        nextActionSummary: form.nextActionSummary || null,
        complianceImpactMinutes: Number(form.complianceImpactMinutes || 0),
        assignedPersonnelIds: form.assignedPersonnelIds,
      });
      setDialogOpen(false);
      setForm(emptyVisitForm);
      await loadData();
      toast.success("Ziyaret oluşturuldu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ziyaret oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (visit: OsgbFieldVisitRecord, status: OsgbFieldVisitRecord["status"]) => {
    try {
      await transitionOsgbFieldVisit(organizationId, visit.id, status);
      await loadData();
      toast.success(status === "in_progress" ? "Ziyaret başlatıldı." : "Ziyaret tamamlandı.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ziyaret durumu güncellenemedi.");
    }
  };

  const handleAddEvidence = async () => {
    if (!organizationId || !user?.id || !evidenceForm.visitId || !evidenceForm.title) {
      toast.error("Kanıt tipi ve başlık zorunlu.");
      return;
    }

    setSaving(true);
    try {
      let parsedMetadata: Record<string, unknown> = {};
      if (evidenceForm.metadata.trim()) {
        try {
          parsedMetadata = JSON.parse(evidenceForm.metadata);
        } catch {
          toast.error("Metadata alanı geçerli JSON olmalı.");
          setSaving(false);
          return;
        }
      }

      await addOsgbFieldVisitEvidence(user.id, organizationId, {
        visitId: evidenceForm.visitId,
        type: evidenceForm.type,
        title: evidenceForm.title,
        fileUrl: evidenceForm.fileUrl || null,
        metadata: parsedMetadata,
      });
      setEvidenceDialogOpen(false);
      setEvidenceForm(emptyEvidenceForm);
      await loadData();
      toast.success("Kanıt eklendi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kanıt eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organizasyon bağlantısı gerekli</AlertTitle>
          <AlertDescription>
            Saha hizmet ispatı modülü bir organizasyona bağlı çalışır. Önce profilinizden organizasyon oluşturun ya da bir kuruma bağlanın.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Saha Ziyareti ve Hizmet İspatı</h1>
              <p className="text-sm text-slate-400">
                Bu ay verilen hizmetleri zaman, personel ve kanıt düzeyi ile doğrulayın.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button onClick={() => setDialogOpen(true)} disabled={!canManage}>
            <Plus className="mr-2 h-4 w-4" />
            Ziyaret oluştur
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ziyaret verisi yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Bu ay planlanan ziyaret</CardDescription>
            <CardTitle className="text-3xl text-white">{data?.summary.totalVisits || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Tamamlanan hizmet</CardDescription>
            <CardTitle className="text-3xl text-white">{data?.summary.completedVisits || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Kanıtı zayıf kayıt</CardDescription>
            <CardTitle className="text-3xl text-white">{data?.summary.missingProofVisits || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Eksik süreye etkisi</CardDescription>
            <CardTitle className="text-3xl text-white">{data?.summary.totalComplianceImpactMinutes || 0} dk</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Bu ayın ziyaret listesi</CardTitle>
            <CardDescription>
              Ziyaretler tamamlandı mı, kanıtı var mı ve eksik hizmet süresine katkı sağladı mı burada görünür.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Yükleniyor...
              </div>
            ) : actionableVisits.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Bu ay için kayıtlı saha ziyareti bulunamadı.
              </div>
            ) : (
              actionableVisits.map((visit) => (
                <button
                  key={visit.id}
                  type="button"
                  onClick={() => setSelectedVisitId(visit.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    selectedVisit?.id === visit.id
                      ? "border-cyan-500/30 bg-cyan-500/10"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{visit.companyName}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {visitTypeLabels[visit.visitType]} • {formatDateTime(visit.plannedAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn("border", statusTone(visit.status))}>{statusLabels[visit.status]}</Badge>
                      <Badge className={cn("border", proofTone(visit))}>
                        {visit.status === "completed" && !visit.hasEnoughEvidence ? "Kanıt eksik" : `Kanıt: ${visit.proofLevel}`}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <div>Planlanan personel: <span className="text-slate-200">{visit.assignedPersonnel.length}</span></div>
                    <div>Süre: <span className="text-slate-200">{visit.durationMinutes || 0} dk</span></div>
                    <div>Mevzuat katkısı: <span className="text-slate-200">{visit.complianceImpactMinutes} dk</span></div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Ziyaret detayı</CardTitle>
            <CardDescription>
              Bu kart iki soruya cevap verir: Gerçekten hizmet verildi mi? Bunun kanıtı var mı?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedVisit ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Detay için soldan bir ziyaret seçin.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div>
                    <div className="text-lg font-semibold text-white">{selectedVisit.companyName}</div>
                    <div className="mt-1 text-sm text-slate-400">{visitTypeLabels[selectedVisit.visitType]}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn("border", statusTone(selectedVisit.status))}>{statusLabels[selectedVisit.status]}</Badge>
                    <Badge className={cn("border", proofTone(selectedVisit))}>Kanıt skoru {selectedVisit.proofScore}/100</Badge>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                      <CalendarClock className="h-4 w-4 text-cyan-300" />
                      Zaman akışı
                    </div>
                    <div className="space-y-2 text-sm text-slate-400">
                      <div>Planlandı: <span className="text-slate-200">{formatDateTime(selectedVisit.plannedAt)}</span></div>
                      <div>Başladı: <span className="text-slate-200">{formatDateTime(selectedVisit.startedAt)}</span></div>
                      <div>Tamamlandı: <span className="text-slate-200">{formatDateTime(selectedVisit.completedAt)}</span></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                      <MapPinned className="h-4 w-4 text-cyan-300" />
                      Konum doğrulaması
                    </div>
                    <div className="space-y-2 text-sm text-slate-400">
                      <div>Check-in: <span className="text-slate-200">{selectedVisit.checkInLocation || "Yok"}</span></div>
                      <div>Check-out: <span className="text-slate-200">{selectedVisit.checkOutLocation || "Yok"}</span></div>
                      <div>Adres: <span className="text-slate-200">{selectedVisit.visitAddress || "Belirtilmedi"}</span></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                      <ClipboardCheck className="h-4 w-4 text-cyan-300" />
                      Ne yapmalıyım?
                    </div>
                    <div className="space-y-2 text-sm text-slate-400">
                      <div>Durum: <span className="text-slate-200">{selectedVisit.status === "completed" ? "Hizmet işlendi." : "Süreç tamamlanmamış."}</span></div>
                      <div>Neden: <span className="text-slate-200">{selectedVisit.proofMissingReasons[0] || "Temel kanıtlar mevcut."}</span></div>
                      <div>Şimdi: <span className="text-slate-200">{selectedVisit.hasEnoughEvidence ? "Kaydı arşivleyebilirsiniz." : "Eksik kanıtı tamamlayın."}</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedVisit.status === "planned" ? (
                    <Button onClick={() => void handleTransition(selectedVisit, "in_progress")} disabled={!canManage}>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Ziyareti başlat
                    </Button>
                  ) : null}
                  {selectedVisit.status === "in_progress" ? (
                    <Button onClick={() => void handleTransition(selectedVisit, "completed")} disabled={!canManage}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Ziyareti tamamla
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEvidenceForm((current) => ({ ...current, visitId: selectedVisit.id }));
                      setEvidenceDialogOpen(true);
                    }}
                    disabled={!canManage}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Kanıt ekle
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                      <Users className="h-4 w-4 text-cyan-300" />
                      Bağlı personel
                    </div>
                    <div className="space-y-3">
                      {selectedVisit.assignedPersonnel.length === 0 ? (
                        <div className="text-sm text-slate-400">Bu ziyaret için henüz personel atanmadı.</div>
                      ) : (
                        selectedVisit.assignedPersonnel.map((person) => (
                          <div key={person.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
                            <div className="font-medium text-white">{person.fullName}</div>
                            <div className="mt-1 text-slate-400">
                              {person.role} • {person.attended ? "Katıldı" : "Katılım doğrulanmadı"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                      <Signature className="h-4 w-4 text-cyan-300" />
                      Eklenen kanıtlar
                    </div>
                    <div className="space-y-3">
                      {selectedVisit.evidence.length === 0 ? (
                        <div className="text-sm text-slate-400">Henüz kanıt eklenmedi.</div>
                      ) : (
                        selectedVisit.evidence.map((evidence) => (
                          <div key={evidence.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-white">{evidence.title}</div>
                              <Badge variant="outline">{evidenceTypeLabels[evidence.type]}</Badge>
                            </div>
                            <div className="mt-1 text-slate-400">{formatDateTime(evidence.capturedAt)}</div>
                            {evidence.fileUrl ? (
                              <a href={evidence.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-cyan-300 hover:underline">
                                Dosyayı aç
                              </a>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                    <Building2 className="h-4 w-4 text-cyan-300" />
                    Hizmet notu
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{selectedVisit.notes || "Bu ziyaret için henüz hizmet özeti girilmedi."}</p>
                  <div className="mt-3 text-sm text-slate-400">
                    Sonraki adım: <span className="text-slate-200">{selectedVisit.nextActionSummary || "Belirlenmedi"}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yeni saha ziyareti</DialogTitle>
            <DialogDescription>Planlanan hizmeti firmaya, personele ve dakika etkisine bağlayın.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((current) => ({ ...current, companyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>
                  {data?.companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ziyaret tipi</Label>
              <Select value={form.visitType} onValueChange={(value) => setForm((current) => ({ ...current, visitType: value as OsgbFieldVisitType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(visitTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Planlanan başlangıç</Label>
              <Input type="datetime-local" value={form.plannedAt} onChange={(event) => setForm((current) => ({ ...current, plannedAt: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Planlanan bitiş</Label>
              <Input type="datetime-local" value={form.plannedEndAt} onChange={(event) => setForm((current) => ({ ...current, plannedEndAt: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Adres</Label>
              <Input value={form.visitAddress} onChange={(event) => setForm((current) => ({ ...current, visitAddress: event.target.value }))} placeholder="Saha adresi veya ziyaret notu" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Hizmet özeti</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Bu ziyarette ne yapılacak?" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Sonraki adım</Label>
              <Textarea value={form.nextActionSummary} onChange={(event) => setForm((current) => ({ ...current, nextActionSummary: event.target.value }))} placeholder="Ziyaret sonrası ne takip edilecek?" />
            </div>
            <div className="space-y-2">
              <Label>Eksik süreye katkı (dk)</Label>
              <Input type="number" value={form.complianceImpactMinutes} onChange={(event) => setForm((current) => ({ ...current, complianceImpactMinutes: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Görevli personel</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {data?.personnel.map((person) => {
                  const active = form.assignedPersonnelIds.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => togglePersonnel(person.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition",
                        active
                          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                          : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700",
                      )}
                    >
                      <div className="font-medium">{person.full_name}</div>
                      <div className="text-xs text-slate-400">{person.role}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={() => void handleCreateVisit()} disabled={saving}>{saving ? "Kaydediliyor..." : "Ziyareti oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={evidenceDialogOpen} onOpenChange={setEvidenceDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Kanıt ekle</DialogTitle>
            <DialogDescription>Fotoğraf, imza veya belge kanıtı ekleyerek hizmet kaydını güçlendirin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Kanıt tipi</Label>
              <Select value={evidenceForm.type} onValueChange={(value) => setEvidenceForm((current) => ({ ...current, type: value as OsgbEvidenceType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(evidenceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Başlık</Label>
              <Input value={evidenceForm.title} onChange={(event) => setEvidenceForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Dosya URL</Label>
              <Input value={evidenceForm.fileUrl} onChange={(event) => setEvidenceForm((current) => ({ ...current, fileUrl: event.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Ek metadata (JSON)</Label>
              <Textarea value={evidenceForm.metadata} onChange={(event) => setEvidenceForm((current) => ({ ...current, metadata: event.target.value }))} placeholder='{"gps":"37.06, 37.37"}' />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={() => void handleAddEvidence()} disabled={saving}>{saving ? "Ekleniyor..." : "Kanıtı kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
