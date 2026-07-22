import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Company, Employee } from "@/types/companies";
import {
  createClientId,
  createEmptyTrainingRecord,
  createTrainingDaysFromPreset,
  deleteTrainingRecord,
  downloadTrainingExcelTemplate,
  employeeToParticipant,
  emptyTrainingDay,
  exportTrainingParticipantsToExcel,
  generateTrainingAttendancePdf,
  loadCompanyEmployees,
  loadTrainingCompanies,
  loadTrainingHistory,
  loadTrainingRecord,
  manualTrainingTitle,
  maskNationalId,
  parseTrainingParticipantsExcel,
  participantKey,
  saveTrainingRecord,
  topicCatalog,
  trainingTitleOptions,
  validateTrainingForPdf,
  type AttendanceStatus,
  type CertificateStatus,
  type ParticipantSource,
  type SignatureStatus,
  type TrainingAttendanceRecord,
  type TrainingHistoryItem,
  type TrainingParticipant,
  type TrainingTopic,
} from "@/lib/trainingAttendance";

const trainingTypes = ["İlk eğitim", "Yenileme", "İlave eğitim", "İşe başlama", "Uzaktan eğitim", "Diğer"];
const methods = ["Yüz yüze", "Çevrim içi", "Hibrit"];
const durations = [1, 2, 4, 6, 8, 12, 16];
const attendanceStatuses: AttendanceStatus[] = ["Katıldı", "Katılmadı", "Kısmi katılım", "Mazeretli"];
const signatureStatuses: SignatureStatus[] = ["Bekliyor", "İmzalandı", "Dijital onay", "Uygulanamaz"];
const certificateStatuses: CertificateStatus[] = ["Bekliyor", "Oluşturuldu", "Aktarıldı"];

const emptyExternal = (): TrainingParticipant => ({
  id: createClientId("external"),
  source: "Harici",
  fullName: "",
  nationalId: "",
  jobTitle: "",
  department: "",
  phone: "",
  email: "",
  companyName: "",
  attendanceStatus: "Katıldı",
  signatureStatus: "Bekliyor",
  certificateStatus: "Bekliyor",
});

function companyDisplayName(company: Company) {
  return company.company_name || (company as unknown as { name?: string }).name || "Firma";
}

function companyAddress(company?: Company | null) {
  return [company?.address, company?.district, company?.city].filter(Boolean).join(", ");
}

function uniqueParticipants(items: TrainingParticipant[]) {
  const seen = new Set<string>();
  return items.filter((participant) => {
    const key = participantKey(participant);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusBadgeVariant(status: TrainingAttendanceRecord["status"]) {
  if (status === "Kaydedildi" || status === "PDF hazır") return "bg-emerald-500/12 text-emerald-200 border-emerald-400/25";
  if (status === "Eksik bilgi var") return "bg-amber-500/12 text-amber-200 border-amber-400/25";
  return "bg-slate-500/12 text-slate-200 border-slate-400/20";
}

export default function TrainingAttendance() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [record, setRecord] = useState<TrainingAttendanceRecord>(() => createEmptyTrainingRecord(profile || undefined));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [external, setExternal] = useState<TrainingParticipant>(() => emptyExternal());
  const [externalError, setExternalError] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [history, setHistory] = useState<TrainingHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [excelImport, setExcelImport] = useState<Awaited<ReturnType<typeof parseTrainingParticipantsExcel>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === record.companyId) || null,
    [companies, record.companyId],
  );

  const departments = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean))) as string[],
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLocaleLowerCase("tr-TR");
    return employees.filter((employee) => {
      const fullName = `${employee.full_name || ""} ${employee.first_name || ""} ${employee.last_name || ""}`.toLocaleLowerCase("tr-TR");
      const matchesTerm =
        !term ||
        fullName.includes(term) ||
        (employee.job_title || "").toLocaleLowerCase("tr-TR").includes(term) ||
        (employee.department || "").toLocaleLowerCase("tr-TR").includes(term);
      const matchesDepartment = departmentFilter === "ALL" || employee.department === departmentFilter;
      return matchesTerm && matchesDepartment;
    });
  }, [departmentFilter, employeeSearch, employees]);

  const selectedTopicMinutes = record.days.reduce(
    (sum, day) => sum + day.topics.reduce((topicSum, topic) => topicSum + Number(topic.durationMinutes || 0), 0),
    0,
  );
  const expectedMinutes = Number(record.durationHours || 0) * 60;
  const durationMismatch = selectedTopicMinutes !== expectedMinutes;
  const selectedTrainingTitleValue = trainingTitleOptions.includes(record.title) ? record.title : manualTrainingTitle;

  const patchRecord = (patch: Partial<TrainingAttendanceRecord>) => {
    setDirty(true);
    setRecord((current) => ({ ...current, ...patch }));
  };

  const handleTrainingTitleChange = (title: string) => {
    if (title === manualTrainingTitle) {
      patchRecord({ title: "", days: [emptyTrainingDay(1, record.trainingDate)] });
      return;
    }

    const trainerName = record.trainerNames[0] || "";
    patchRecord({
      title,
      durationHours: 8,
      days: createTrainingDaysFromPreset(title, record.trainingDate, trainerName, record.location),
    });
  };

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const companyRows = await loadTrainingCompanies();
      setCompanies(companyRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma verileri yüklenemedi.");
    }

    try {
      setHistory(await loadTrainingHistory());
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleCompanyChange = async (companyId: string) => {
    if (record.participants.length && record.companyId !== companyId) {
      const confirmed = window.confirm("Firma değişirse mevcut katılımcı listeniz temizlenecek. Devam edilsin mi?");
      if (!confirmed) return;
    }

    const company = companies.find((item) => item.id === companyId);
    patchRecord({
      companyId,
      companyName: company ? companyDisplayName(company) : "",
      location: company ? companyAddress(company) : "",
      participants: [],
    });
    setSelectedEmployeeIds([]);

    try {
      setEmployees(await loadCompanyEmployees(companyId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma çalışanları yüklenemedi.");
      setEmployees([]);
    }
  };

  const addParticipants = (items: TrainingParticipant[]) => {
    const merged = uniqueParticipants([...record.participants, ...items]);
    const skipped = record.participants.length + items.length - merged.length;
    patchRecord({ participants: merged });
    if (skipped > 0) toast.info(`${skipped} tekrar eden katılımcı listeye eklenmedi.`);
  };

  const addSelectedEmployees = () => {
    if (!selectedCompany) {
      toast.warning("Önce firma seçin.");
      return;
    }
    const selected = employees
      .filter((employee) => selectedEmployeeIds.includes(employee.id))
      .map((employee) => employeeToParticipant(employee, companyDisplayName(selectedCompany)));
    if (!selected.length) {
      toast.info("Katılımcı eklemek için çalışan seçin.");
      return;
    }
    addParticipants(selected);
    setSelectedEmployeeIds([]);
  };

  const addExternalParticipant = () => {
    const fullName = external.fullName.trim();
    const nationalId = external.nationalId.replace(/\D/g, "");
    if (!fullName) {
      setExternalError("Ad Soyad zorunlu.");
      return;
    }
    if (nationalId && nationalId.length !== 11) {
      setExternalError("TC Kimlik No girilecekse 11 hane olmalı.");
      return;
    }
    const next = { ...external, fullName, nationalId, companyName: external.companyName || record.companyName };
    const exists = record.participants.some((participant) => participantKey(participant) === participantKey(next));
    if (exists) {
      setExternalError("Bu katılımcı zaten listede.");
      return;
    }
    addParticipants([next]);
    setExternal(emptyExternal());
    setExternalError("");
  };

  const updateParticipant = (id: string, patch: Partial<TrainingParticipant>) => {
    patchRecord({
      participants: record.participants.map((participant) =>
        participant.id === id ? { ...participant, ...patch } : participant,
      ),
    });
  };

  const removeParticipant = (id: string) => {
    patchRecord({ participants: record.participants.filter((participant) => participant.id !== id) });
  };

  const moveParticipant = (index: number, direction: -1 | 1) => {
    const next = [...record.participants];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchRecord({ participants: next });
  };

  const updateDay = (dayId: string, patch: Partial<Omit<TrainingAttendanceRecord["days"][number], "topics">>) => {
    patchRecord({
      days: record.days.map((day) => (day.id === dayId ? { ...day, ...patch } : day)),
    });
  };

  const updateTopic = (dayId: string, topicId: string, patch: Partial<TrainingTopic>) => {
    patchRecord({
      days: record.days.map((day) =>
        day.id === dayId
          ? { ...day, topics: day.topics.map((topic) => (topic.id === topicId ? { ...topic, ...patch } : topic)) }
          : day,
      ),
    });
  };

  const addTopic = (dayId: string, category: string, title: string) => {
    patchRecord({
      days: record.days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              topics: [
                ...day.topics,
                {
                  id: createClientId("topic"),
                  category,
                  title,
                  durationMinutes: 30,
                  trainerName: day.trainerName,
                  description: "",
                  isRequired: true,
                },
              ],
            }
          : day,
      ),
    });
  };

  const removeTopic = (dayId: string, topicId: string) => {
    patchRecord({
      days: record.days.map((day) =>
        day.id === dayId ? { ...day, topics: day.topics.filter((topic) => topic.id !== topicId) } : day,
      ),
    });
  };

  const moveTopic = (dayId: string, index: number, direction: -1 | 1) => {
    patchRecord({
      days: record.days.map((day) => {
        if (day.id !== dayId) return day;
        const next = [...day.topics];
        const target = index + direction;
        if (target < 0 || target >= next.length) return day;
        [next[index], next[target]] = [next[target], next[index]];
        return { ...day, topics: next };
      }),
    });
  };

  const saveRecord = async (status: TrainingAttendanceRecord["status"] = "Kaydedildi") => {
    if (!user?.id) {
      toast.error("Kayıt için oturum bulunamadı.");
      return null;
    }
    setSaving(true);
    try {
      const saved = await saveTrainingRecord({ ...record, status }, user.id, profile?.organization_id || null);
      setRecord(saved);
      setDirty(false);
      setHistory(await loadTrainingHistory());
      toast.success("Eğitim katılım kaydı kaydedildi.");
      return saved;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eğitim kaydı kaydedilemedi.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const previewPdf = async () => {
    const errors = validateTrainingForPdf(record);
    if (errors.length) {
      toast.error(errors[0]);
      patchRecord({ status: "Eksik bilgi var" });
      return;
    }
    const url = await generateTrainingAttendancePdf(record, false);
    setPreviewUrl(String(url));
    setPreviewOpen(true);
    patchRecord({ status: "PDF hazır" });
  };

  const downloadPdf = async () => {
    const errors = validateTrainingForPdf(record);
    if (errors.length) {
      toast.error(errors[0]);
      patchRecord({ status: "Eksik bilgi var" });
      return;
    }
    await generateTrainingAttendancePdf(record, true);
    await saveRecord("PDF hazır");
  };

  const handleExcelFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await parseTrainingParticipantsExcel(file, record.companyName);
      setExcelImport(parsed);
      setExcelDialogOpen(true);
    } catch {
      toast.error("Excel dosyası okunamadı. Lütfen .xlsx veya .xls formatında bir dosya seçin.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openHistoryItem = async (id?: string) => {
    if (!id) return;
    try {
      const loaded = await loadTrainingRecord(id);
      setRecord(loaded);
      setDirty(false);
      setHistoryOpen(false);
      if (loaded.companyId) setEmployees(await loadCompanyEmployees(loaded.companyId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kayıt açılamadı.");
    }
  };

  const newRecord = () => {
    if (dirty && !window.confirm("Kaydedilmemiş değişiklikler var. Yeni katılım formu açılsın mı?")) return;
    setRecord(createEmptyTrainingRecord(profile || undefined));
    setEmployees([]);
    setSelectedEmployeeIds([]);
    setDirty(false);
  };

  const sendToCertificates = async () => {
    const joined = record.participants.filter((participant) => participant.attendanceStatus === "Katıldı");
    if (!joined.length) {
      toast.warning("Sertifika için en az bir 'Katıldı' durumunda katılımcı olmalı.");
      return;
    }
    const saved = record.id ? record : await saveRecord("Kaydedildi");
    if (!saved) return;
    navigate("/dashboard/certificates", {
      state: {
        trainingAttendance: {
          trainingId: saved.id,
          title: saved.title,
          date: saved.trainingDate,
          durationHours: saved.durationHours,
          companyId: saved.companyId,
          companyName: saved.companyName,
          participants: joined.map((participant) => ({
            name: participant.fullName,
            tc_no: participant.nationalId,
            job_title: participant.jobTitle,
          })),
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 p-4 lg:p-6">
      <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
        <CardContent className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Eğitim Katılım Formu</h1>
                <Badge className={cn("border", statusBadgeVariant(record.status))}>{record.status}</Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Eğitim bilgilerini, katılımcıları ve konu planını tek ekrandan yönetin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={newRecord} className="gap-2">
              <Plus className="h-4 w-4" />
              Yeni Katılım
            </Button>
            <Button variant="secondary" onClick={() => void saveRecord("Kaydedildi")} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Taslağı Kaydet
            </Button>
            <Button variant="outline" onClick={() => void previewPdf()} className="gap-2">
              <Eye className="h-4 w-4" />
              Önizle
            </Button>
            <Button onClick={() => void downloadPdf()} className="gap-2">
              <Download className="h-4 w-4" />
              Formu İndir
            </Button>
            <Button onClick={() => void sendToCertificates()} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500">
              <Award className="h-4 w-4" />
              Sertifika Oluştur
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)} className="gap-2">
              <History className="h-4 w-4" />
              Geçmiş
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        <main className="col-span-12 space-y-5 xl:col-span-9">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-cyan-400" />
                Firma ve Eğitim Bilgileri
              </CardTitle>
              <CardDescription>Firma, eğitim kapsamı, eğitmen ve belge ayarlarını belirleyin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label>Firma *</Label>
                  <Select value={record.companyId} onValueChange={(value) => void handleCompanyChange(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Firma seçin" />
                    </SelectTrigger>
                    <SelectContent className="z-[140]">
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {companyDisplayName(company)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Eğitim başlığı *</Label>
                  <Select value={selectedTrainingTitleValue} onValueChange={handleTrainingTitleChange}>
                    <SelectTrigger className="font-semibold">
                      <SelectValue placeholder="Eğitim başlığı seçin" />
                    </SelectTrigger>
                    <SelectContent className="z-[140] max-h-[420px]">
                      {trainingTitleOptions.map((title) => (
                        <SelectItem key={title} value={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTrainingTitleValue === manualTrainingTitle && (
                    <Input
                      value={record.title}
                      onChange={(e) => patchRecord({ title: e.target.value })}
                      placeholder="Manuel eğitim başlığını yazın"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Eğitim tarihi *</Label>
                  <Input
                    type="date"
                    value={record.trainingDate}
                    onChange={(e) =>
                      patchRecord({
                        trainingDate: e.target.value,
                        days: record.days.map((day, index) => (index === 0 ? { ...day, trainingDate: e.target.value } : day)),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Eğitim süresi</Label>
                  <Select value={String(record.durationHours)} onValueChange={(value) => patchRecord({ durationHours: Number(value) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[140]">
                      {durations.map((duration) => (
                        <SelectItem key={duration} value={String(duration)}>
                          {duration} saat
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Eğitim türü</Label>
                  <Select value={record.trainingType} onValueChange={(value) => patchRecord({ trainingType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[140]">
                      {trainingTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Eğitim yöntemi</Label>
                  <Select value={record.trainingMethod} onValueChange={(value) => patchRecord({ trainingMethod: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[140]">
                      {methods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Eğitmenler</Label>
                  <Input
                    value={record.trainerNames.join(", ")}
                    onChange={(e) => patchRecord({ trainerNames: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
                    placeholder="Virgül ile birden fazla eğitmen ekleyin"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Eğitim yeri</Label>
                  <Input value={record.location} onChange={(e) => patchRecord({ location: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries({
                  safetyExpertSignature: "İş Güvenliği Uzmanı imza alanı",
                  doctorSignature: "İşyeri Hekimi imza alanı",
                  employerSignature: "İşveren / Vekili imza alanı",
                  employeeRepresentativeSignature: "Çalışan Temsilcisi imza alanı",
                  participantSignature: "Katılımcı imza sütunu",
                  companyLogo: "Firma logosunu göster",
                  isgVizyonLogo: "İSGVizyon logosunu göster",
                  pageNumbers: "Sayfa numarası göster",
                }).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(record.documentSettings[key as keyof typeof record.documentSettings])}
                      onChange={(e) =>
                        patchRecord({
                          documentSettings: { ...record.documentSettings, [key]: e.target.checked },
                        })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Açıklama / notlar</Label>
                <Textarea value={record.description} onChange={(e) => patchRecord({ description: e.target.value })} placeholder="PDF'ye aktarılacak eğitim notu..." />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-violet-400" />
                    Gün Detayları ve Konu Dağılımı
                  </CardTitle>
                  <CardDescription>Konuları günlere dağıtın, süreleri ve eğitmenleri düzenleyin.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={durationMismatch ? "destructive" : "secondary"}>
                    {selectedTopicMinutes} / {expectedMinutes} dk
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={() => patchRecord({ days: [...record.days, emptyTrainingDay(record.days.length + 1, record.trainingDate)] })}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Gün Ekle
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {durationMismatch && (
                <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Seçilen konu süreleri toplam eğitim süresiyle uyuşmuyor. PDF oluşturabilirsiniz ancak süreyi kontrol etmeniz önerilir.
                </div>
              )}

              {record.days.map((day, dayIndex) => (
                <div key={day.id} className="rounded-2xl border border-slate-200/80 bg-[#111827]/90 p-3 text-white shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-violet-600/70 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">
                        {dayIndex + 1}. Gün
                      </span>
                      <Input
                        type="date"
                        value={day.trainingDate}
                        onChange={(e) => updateDay(day.id, { trainingDate: e.target.value })}
                        className="h-8 w-[150px] border-slate-300/80 bg-slate-950/50 text-xs font-semibold text-white"
                      />
                      <div className="flex h-8 items-center rounded-md border border-slate-300/80 bg-slate-950/50 px-3 text-xs font-bold">
                        {Math.round(day.durationMinutes / 60)} Saat
                      </div>
                      <Input
                        value={record.location}
                        onChange={(e) => patchRecord({ location: e.target.value })}
                        placeholder="Örn: T. Salonu"
                        className="h-8 w-[170px] border-slate-300/80 bg-slate-950/50 text-xs font-semibold text-white placeholder:text-slate-400"
                      />
                      <div className="flex items-center gap-2 pl-1 text-xs font-semibold">
                        {methods.map((method) => (
                          <label key={method} className="flex items-center gap-1">
                            <input
                              type="radio"
                              checked={record.trainingMethod === method}
                              onChange={() => patchRecord({ trainingMethod: method })}
                              className="h-3 w-3 accent-emerald-400"
                            />
                            {method}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patchRecord({ days: record.days.filter((item) => item.id !== day.id) })}
                      disabled={record.days.length === 1}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Günü Sil
                    </Button>
                  </div>

                  <div className="rounded-lg border border-violet-500/70 bg-violet-950/20 px-3 py-2">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-violet-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {record.title || "Eğitim konuları"}
                    </div>
                    <ol className="space-y-1 pl-5 text-[11px] font-bold uppercase leading-tight text-white">
                      {day.topics.map((topic) => (
                        <li key={topic.id} className="list-decimal">
                          {topic.title}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
                    <details className="overflow-hidden rounded-xl border border-border/60 bg-card/70 text-foreground">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
                        Konu süreleri ve eğitmenleri düzenle
                      </summary>
                      <div className="overflow-x-auto border-t border-border/60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Konu</TableHead>
                            <TableHead className="w-24">Süre</TableHead>
                            <TableHead className="w-40">Eğitmen</TableHead>
                            <TableHead className="w-28">İşlem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {day.topics.map((topic, index) => (
                            <TableRow key={topic.id}>
                              <TableCell>
                                <Input value={topic.title} onChange={(e) => updateTopic(day.id, topic.id, { title: e.target.value })} />
                              </TableCell>
                              <TableCell>
                                <Input type="number" min={1} value={topic.durationMinutes} onChange={(e) => updateTopic(day.id, topic.id, { durationMinutes: Number(e.target.value) })} />
                              </TableCell>
                              <TableCell>
                                <Input value={topic.trainerName} onChange={(e) => updateTopic(day.id, topic.id, { trainerName: e.target.value })} />
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => moveTopic(day.id, index, -1)} aria-label="Konuyu yukarı taşı">
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => moveTopic(day.id, index, 1)} aria-label="Konuyu aşağı taşı">
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => removeTopic(day.id, topic.id)} aria-label="Konuyu sil">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </details>

                    <div className="rounded-xl border border-border/60 bg-card/70 p-3 text-foreground">
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} placeholder="Konu ara..." />
                      </div>
                      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                        {topicCatalog.map((group) => {
                          const items = group.topics.filter((topic) => topic.toLocaleLowerCase("tr-TR").includes(topicSearch.toLocaleLowerCase("tr-TR")));
                          if (!items.length) return null;
                          return (
                            <div key={group.category}>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.category}</p>
                              <div className="space-y-1">
                                {items.map((topic) => (
                                  <Button key={topic} variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => addTopic(day.id, group.category, topic)}>
                                    <Plus className="mr-2 h-3.5 w-3.5 shrink-0" />
                                    {topic}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </main>

        <aside className="col-span-12 xl:col-span-3">
          <Card className="sticky top-24 border-border/60 bg-card/85">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-emerald-400" />
                    Katılımcı Listesi
                  </CardTitle>
                  <CardDescription>{record.participants.length} katılımcı</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => patchRecord({ participants: [] })}>Temizle</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                <p className="mb-2 text-sm font-semibold">Firma çalışanları</p>
                {!record.companyId ? (
                  <p className="text-sm text-muted-foreground">Katılımcıları görüntülemek için önce firma seçin.</p>
                ) : employees.length === 0 ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Seçilen firmaya kayıtlı aktif çalışan bulunamadı.</p>
                    <Button variant="outline" size="sm" onClick={() => navigate("/employees")}>Çalışan ekleme ekranına git</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Çalışan ara..." />
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[140]">
                        <SelectItem value="ALL">Tüm departmanlar</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department} value={department}>{department}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedEmployeeIds(filteredEmployees.map((employee) => employee.id))}>Tümünü seç</Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedEmployeeIds([])}>Temizle</Button>
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {filteredEmployees.map((employee) => (
                        <label key={employee.id} className="flex cursor-pointer gap-2 rounded-xl border border-border/50 bg-card/70 p-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.includes(employee.id)}
                            onChange={(e) =>
                              setSelectedEmployeeIds((current) =>
                                e.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id),
                              )
                            }
                            className="mt-1 h-4 w-4 accent-primary"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{employee.full_name || `${employee.first_name} ${employee.last_name}`}</span>
                            <span className="block truncate text-xs text-muted-foreground">{maskNationalId(employee.tc_number)} · {employee.job_title || "Görev yok"}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <Button className="w-full gap-2" onClick={addSelectedEmployees}>
                      <Plus className="h-4 w-4" />
                      Seçilenleri Ekle
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                <p className="mb-2 text-sm font-semibold">Excel işlemleri</p>
                <div className="grid gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => void downloadTrainingExcelTemplate()}>
                    <FileSpreadsheet className="h-4 w-4" />
                    Şablon İndir
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Excel'den Yükle
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => void exportTrainingParticipantsToExcel(record)} disabled={!record.participants.length}>
                    <Download className="h-4 w-4" />
                    Excel'e Aktar
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => void handleExcelFile(e.target.files?.[0])} />
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                <p className="mb-2 text-sm font-semibold">Harici katılımcı</p>
                <div className="space-y-2">
                  <Input value={external.fullName} onChange={(e) => setExternal({ ...external, fullName: e.target.value })} placeholder="Ad Soyad *" />
                  <Input value={external.nationalId} onChange={(e) => setExternal({ ...external, nationalId: e.target.value })} placeholder="TC Kimlik No" />
                  <Input value={external.jobTitle} onChange={(e) => setExternal({ ...external, jobTitle: e.target.value })} placeholder="Görev" />
                  <Input value={external.department} onChange={(e) => setExternal({ ...external, department: e.target.value })} placeholder="Departman" />
                  {externalError && <p className="text-xs text-destructive">{externalError}</p>}
                  <Button className="w-full gap-2" onClick={addExternalParticipant}>
                    <Plus className="h-4 w-4" />
                    Listeye Ekle
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Seçilen Katılımcılar</CardTitle>
          <CardDescription>Katılım, imza ve sertifika durumlarını buradan yönetin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => patchRecord({ participants: record.participants.map((p) => ({ ...p, attendanceStatus: "Katıldı" })) })}>Tümünü katıldı yap</Button>
            <Button variant="outline" size="sm" onClick={() => patchRecord({ participants: record.participants.map((p) => ({ ...p, signatureStatus: "İmzalandı" })) })}>Tümünü imzalandı yap</Button>
            <Button variant="outline" size="sm" onClick={() => patchRecord({ participants: [...record.participants].sort((a, b) => a.fullName.localeCompare(b.fullName, "tr")) })}>Alfabetik sırala</Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>TC Kimlik No</TableHead>
                  <TableHead>Görev</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Katılım</TableHead>
                  <TableHead>İmza</TableHead>
                  <TableHead>Sertifika</TableHead>
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.participants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                      Henüz katılımcı eklenmedi. Firma çalışanı seçebilir, harici kişi ekleyebilir veya Excel yükleyebilirsiniz.
                    </TableCell>
                  </TableRow>
                ) : (
                  record.participants.map((participant, index) => (
                    <TableRow key={participant.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="min-w-48">
                        <Input value={participant.fullName} onChange={(e) => updateParticipant(participant.id, { fullName: e.target.value })} />
                      </TableCell>
                      <TableCell>{maskNationalId(participant.nationalId)}</TableCell>
                      <TableCell className="min-w-36">
                        <Input value={participant.jobTitle} onChange={(e) => updateParticipant(participant.id, { jobTitle: e.target.value })} />
                      </TableCell>
                      <TableCell className="min-w-36">
                        <Input value={participant.department} onChange={(e) => updateParticipant(participant.id, { department: e.target.value })} />
                      </TableCell>
                      <TableCell>{participant.source}</TableCell>
                      <TableCell>
                        <StatusSelect value={participant.attendanceStatus} values={attendanceStatuses} onChange={(value) => updateParticipant(participant.id, { attendanceStatus: value as AttendanceStatus })} />
                      </TableCell>
                      <TableCell>
                        <StatusSelect value={participant.signatureStatus} values={signatureStatuses} onChange={(value) => updateParticipant(participant.id, { signatureStatus: value as SignatureStatus })} />
                      </TableCell>
                      <TableCell>
                        <StatusSelect value={participant.certificateStatus} values={certificateStatuses} onChange={(value) => updateParticipant(participant.id, { certificateStatus: value as CertificateStatus })} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => moveParticipant(index, -1)} aria-label="Yukarı taşı">
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => moveParticipant(index, 1)} aria-label="Aşağı taşı">
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeParticipant(participant.id)} aria-label="Sil">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Excel Önizleme</DialogTitle>
            <DialogDescription>Geçerli satırları katılımcı listesine aktarabilirsiniz.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3">
                <p className="text-sm text-muted-foreground">Geçerli satır</p>
                <p className="text-2xl font-bold">{excelImport?.valid.length || 0}</p>
              </div>
              <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3">
                <p className="text-sm text-muted-foreground">Hatalı / tekrar</p>
                <p className="text-2xl font-bold">{excelImport?.invalid.length || 0}</p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Satır</TableHead>
                    <TableHead>Açıklama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(excelImport?.invalid || []).map((item) => (
                    <TableRow key={`${item.row}-${item.reason}`}>
                      <TableCell>{item.row}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                    </TableRow>
                  ))}
                  {excelImport?.invalid.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">Hatalı satır yok.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExcelDialogOpen(false)}>Vazgeç</Button>
              <Button
                onClick={() => {
                  addParticipants(excelImport?.valid || []);
                  setExcelDialogOpen(false);
                }}
                disabled={!excelImport?.valid.length}
              >
                Geçerli Satırları Aktar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[90vh] max-w-5xl">
          <DialogHeader>
            <DialogTitle>PDF Önizleme</DialogTitle>
            <DialogDescription>Belgeyi kontrol edip ardından indirebilirsiniz.</DialogDescription>
          </DialogHeader>
          {previewUrl ? <iframe title="Eğitim katılım PDF önizleme" src={previewUrl} className="h-full min-h-0 w-full rounded-xl border" /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Geçmiş Eğitimler</DialogTitle>
            <DialogDescription>Kaydedilmiş eğitim kayıtlarını açın, kopyalayın veya silin.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Eğitim</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Katılımcı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Kayıt geçmişi yok.</TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{item.companyName}</TableCell>
                      <TableCell>{item.trainingDate}</TableCell>
                      <TableCell>{item.durationHours} saat</TableCell>
                      <TableCell>{item.participantCount}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => void openHistoryItem(item.id)}>Aç</Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (!item.id || !window.confirm("Bu eğitim kaydı silinsin mi?")) return;
                              await deleteTrainingRecord(item.id);
                              setHistory(await loadTrainingHistory());
                              toast.success("Kayıt silindi.");
                            }}
                          >
                            Sil
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusSelect({
  value,
  values,
  onChange,
}: {
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[140]">
        {values.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
