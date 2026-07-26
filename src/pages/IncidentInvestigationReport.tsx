import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Fish,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyCompanyToIncidentRecord,
  companyDisplayName,
  createClientId,
  createEmptyIncidentInvestigationRecord,
  formatDateTimeTr,
  generateIncidentInvestigationPdf,
  ishikawaCategories,
  loadIncidentInvestigationCompanies,
  loadIncidentInvestigationHistory,
  saveIncidentInvestigationRecord,
  validateIncidentInvestigation,
  type CorrectiveActionStatus,
  type IncidentCorrectiveAction,
  type IncidentInvestigationHistoryItem,
  type IncidentInvestigationRecord,
  type IshikawaKey,
} from "@/lib/incidentInvestigation";
import { cn } from "@/lib/utils";
import type { Company } from "@/types/companies";

const steps = [
  { title: "Genel Bilgiler", icon: ClipboardList, color: "from-blue-500 to-indigo-600" },
  { title: "5 Neden Analizi", icon: Search, color: "from-orange-500 to-red-500" },
  { title: "Kaza Nedenleri", icon: Fish, color: "from-cyan-500 to-teal-500" },
  { title: "DÖF", icon: Wrench, color: "from-emerald-500 to-green-500" },
  { title: "Deliller", icon: Camera, color: "from-violet-500 to-fuchsia-500" },
  { title: "Önizleme", icon: CheckCircle2, color: "from-slate-500 to-emerald-500" },
] as const;

const fiveWhyQuestions = [
  "Neden yaralandı?",
  "Neden bu durum oluştu?",
  "Neden önlem alınmadı?",
  "Neden sistem bunu engellemedi?",
  "Kök neden nedir?",
];

const categoryStyles: Record<IshikawaKey, string> = {
  man: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  machine: "border-orange-500/30 bg-orange-500/10 text-orange-100",
  method: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  material: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  measurement: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
  environment: "border-rose-500/30 bg-rose-500/10 text-rose-100",
};

function WizardProgress({ activeStep, onStepChange }: { activeStep: number; onStepChange: (index: number) => void }) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 px-5 py-4 shadow-xl shadow-black/10">
      <div className="grid grid-cols-6 gap-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const completed = index < activeStep;
          const active = index === activeStep;
          return (
            <button
              key={step.title}
              type="button"
              onClick={() => onStepChange(index)}
              aria-current={active ? "step" : undefined}
              aria-label={`${step.title} adımına geç`}
              className="group relative flex flex-col items-center gap-2 rounded-xl px-2 py-1 outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-white transition duration-200 group-hover:scale-105",
                  completed ? "bg-emerald-500" : active ? `bg-gradient-to-br ${step.color} ring-2 ring-white` : "bg-slate-700 text-slate-500 group-hover:text-slate-200",
                )}
              >
                {completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={cn("text-center text-[11px]", active ? "font-semibold text-white" : completed ? "text-slate-200" : "text-slate-500")}>
                {step.title}
              </span>
              {active ? <span className="absolute -bottom-4 h-1 w-full rounded-full bg-gradient-to-r from-red-500 to-orange-500" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyLanding({
  history,
  onCreate,
}: {
  history: IncidentInvestigationHistoryItem[];
  onCreate: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 text-white">
      <div className="rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 p-6 shadow-2xl shadow-red-950/30">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-9 w-9" />
              <h1 className="text-3xl font-bold tracking-normal">İş Kazası İnceleme Raporu</h1>
            </div>
            <p className="mt-3 text-sm text-white/90">Kök neden analizi ve düzeltici faaliyet takibi</p>
          </div>
          <Button type="button" onClick={onCreate} className="h-12 bg-white/15 px-6 text-base font-semibold text-white hover:bg-white/25">
            <Plus className="mr-2 h-5 w-5" />
            Yeni Rapor Oluştur
          </Button>
        </div>
      </div>

      {history.length ? (
        <Card className="border-slate-700 bg-slate-800/80 text-white">
          <CardHeader>
            <CardTitle>Son Raporlar</CardTitle>
            <CardDescription className="text-slate-300">Daha önce kaydedilen iş kazası inceleme raporları.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {history.map((item) => (
              <div key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/35 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-white">{item.companyName || "Firma belirtilmedi"}</p>
                  <p className="text-sm text-slate-400">
                    {formatDateTimeTr(item.incidentDateTime)} • {item.injuredEmployeeName || "Kazazede belirtilmedi"}
                  </p>
                </div>
                <Badge className={cn(item.status === "Tamamlandı" ? "bg-emerald-500/15 text-emerald-100" : "bg-amber-500/15 text-amber-100")}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-700 bg-slate-800/85 py-12 text-center text-white">
          <CardContent className="flex flex-col items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-50 text-rose-400">
              <ClipboardList className="h-10 w-10" />
            </div>
            <h2 className="mt-5 text-xl font-bold">Henüz rapor oluşturulmamış</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-blue-200">
              İlk iş kazası inceleme ve kök neden analiz raporunuzu oluşturarak kazaların tekrarını önlemeye başlayın.
            </p>
            <Button type="button" onClick={onCreate} className="mt-6 h-12 bg-gradient-to-r from-red-600 to-orange-500 px-6 text-base font-semibold text-white hover:from-red-500 hover:to-orange-400">
              <Plus className="mr-2 h-5 w-5" />
              İlk Raporunu Oluştur
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="rounded-2xl border border-red-500/35 bg-slate-900 p-5 shadow-sm shadow-red-950/20">
        <div className="flex items-center gap-2 font-bold text-red-400">
          <AlertTriangle className="h-5 w-5" />
          İş Kazası Raporu Hakkında
        </div>
        <p className="mt-3 text-sm font-medium leading-6 text-white">
          İş kazası inceleme raporu, iş yerinde meydana gelen kazaların kök nedenlerini tespit etmek ve tekrarını önlemek amacıyla düzenlenen yasal bir belgedir. 5 Neden Analizi, Kaza Nedenleri Analizi (6M Modeli) ve DÖF yöntemlerini kullanarak kapsamlı bir inceleme yapmanızı sağlar.
        </p>
      </div>
    </div>
  );
}

export default function IncidentInvestigationReport() {
  const { user, profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [history, setHistory] = useState<IncidentInvestigationHistoryItem[]>([]);
  const [record, setRecord] = useState<IncidentInvestigationRecord>(() => createEmptyIncidentInvestigationRecord(profile?.organization_id || null));
  const [step, setStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">("forward");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [ishikawaDrafts, setIshikawaDrafts] = useState<Record<IshikawaKey, string>>({
    man: "",
    machine: "",
    method: "",
    material: "",
    measurement: "",
    environment: "",
  });

  const selectedCompany = useMemo(() => companies.find((company) => company.id === record.companyId) || null, [companies, record.companyId]);
  const rootCauseCount = record.fiveWhyAnswers.filter((answer) => answer.trim()).length;
  const ishikawaCount = Object.values(record.ishikawa).reduce((total, items) => total + items.length, 0);
  const validationErrors = validateIncidentInvestigation(record);

  const patchRecord = (patch: Partial<IncidentInvestigationRecord>) => {
    setRecord((current) => ({ ...current, ...patch }));
  };

  const refreshHistory = async () => {
    try {
      setHistory(await loadIncidentInvestigationHistory());
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [companyRows] = await Promise.all([loadIncidentInvestigationCompanies(), refreshHistory()]);
        setCompanies(companyRows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Firma ve rapor verileri yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const startNewReport = () => {
    setRecord(createEmptyIncidentInvestigationRecord(profile?.organization_id || null));
    setStep(0);
    setSlideDirection("forward");
    setWizardOpen(true);
  };

  const goToStep = (nextStep: number) => {
    const clampedStep = Math.max(0, Math.min(steps.length - 1, nextStep));
    if (clampedStep === step) return;
    setSlideDirection(clampedStep > step ? "forward" : "backward");
    setStep(clampedStep);
  };

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    setRecord((current) => applyCompanyToIncidentRecord(current, company));
  };

  const updateFiveWhy = (index: number, value: string) => {
    setRecord((current) => {
      const next = [...current.fiveWhyAnswers];
      next[index] = value;
      return { ...current, fiveWhyAnswers: next };
    });
  };

  const addIshikawaItem = (key: IshikawaKey, directValue?: string) => {
    const value = (directValue || ishikawaDrafts[key]).trim();
    if (!value) return;
    if (record.ishikawa[key].some((item) => item.toLocaleLowerCase("tr-TR") === value.toLocaleLowerCase("tr-TR"))) {
      toast.info("Bu bulgu zaten eklendi.");
      return;
    }
    setRecord((current) => ({
      ...current,
      ishikawa: { ...current.ishikawa, [key]: [...current.ishikawa[key], value] },
    }));
    if (!directValue) {
      setIshikawaDrafts((current) => ({ ...current, [key]: "" }));
    }
  };

  const removeIshikawaItem = (key: IshikawaKey, index: number) => {
    setRecord((current) => ({
      ...current,
      ishikawa: { ...current.ishikawa, [key]: current.ishikawa[key].filter((_, itemIndex) => itemIndex !== index) },
    }));
  };

  const addCorrectiveAction = () => {
    const action: IncidentCorrectiveAction = {
      id: createClientId("dof"),
      actionType: "Yönetsel Önlem",
      action: "",
      responsible: "",
      targetDate: "",
      status: "Açık",
    };
    patchRecord({ correctiveActions: [...record.correctiveActions, action] });
  };

  const updateCorrectiveAction = (id: string, patch: Partial<IncidentCorrectiveAction>) => {
    patchRecord({
      correctiveActions: record.correctiveActions.map((action) => (action.id === id ? { ...action, ...patch } : action)),
    });
  };

  const removeCorrectiveAction = (id: string) => {
    patchRecord({ correctiveActions: record.correctiveActions.filter((action) => action.id !== id) });
  };

  useEffect(() => {
    if (wizardOpen && step === 3 && record.correctiveActions.length === 0) {
      setRecord((current) => ({
        ...current,
        correctiveActions: [
          {
            id: createClientId("dof"),
            actionType: "Yönetsel Önlem",
            action: "",
            responsible: "",
            targetDate: new Date().toISOString().slice(0, 10),
            status: "Açık",
          },
        ],
      }));
    }
  }, [wizardOpen, step, record.correctiveActions.length]);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fotoğraf en fazla 5 MB olabilir.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patchRecord({ evidencePhotoDataUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  };

  const saveRecord = async (status: IncidentInvestigationRecord["status"]) => {
    if (!user?.id) {
      toast.error("Kayıt için oturum bilgisi bulunamadı.");
      return null;
    }
    if (status === "Tamamlandı") {
      const errors = validateIncidentInvestigation(record);
      if (errors.length) {
        toast.error(errors[0]);
        return null;
      }
    }
    setSaving(true);
    try {
      const saved = await saveIncidentInvestigationRecord({ ...record, status }, user.id, profile?.organization_id || null);
      setRecord(saved);
      await refreshHistory();
      toast.success(status === "Tamamlandı" ? "Rapor tamamlandı." : "Taslak kaydedildi.");
      return saved;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rapor kaydedilemedi.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    const errors = validateIncidentInvestigation(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setPdfLoading(true);
    try {
      await generateIncidentInvestigationPdf(record);
      toast.success("PDF indirildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-slate-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        İş kazası raporu hazırlanıyor...
      </div>
    );
  }

  if (!wizardOpen) {
    return <EmptyLanding history={history} onCreate={startNewReport} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 text-white">
      <button type="button" onClick={() => setWizardOpen(false)} className="inline-flex items-center gap-2 text-sm text-blue-200 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Rapor Listesine Dön
      </button>

      <WizardProgress activeStep={step} onStepChange={goToStep} />

      <div
        key={step}
        className={cn(
          "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
          slideDirection === "forward" ? "motion-safe:slide-in-from-right-5" : "motion-safe:slide-in-from-left-5",
        )}
      >
      {step === 0 ? (
        <Card className="overflow-hidden border-slate-700 bg-slate-800 text-white">
          <CardHeader className="bg-gradient-to-r from-blue-700 to-blue-600">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="h-5 w-5" />
              1. Genel Bilgiler ve Kaza Özeti
            </CardTitle>
            <CardDescription className="text-blue-100">Kazanın temel bilgilerini girin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Firma *</Label>
                <Select value={record.companyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger className="mt-2 border-slate-600 bg-slate-950/50 text-white">
                    <SelectValue placeholder="Firma seçin" />
                  </SelectTrigger>
                  <SelectContent className="z-[80] border-slate-700 bg-slate-900 text-white">
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {companyDisplayName(company)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCompany ? (
                  <p className="mt-2 text-xs text-slate-400">
                    {record.workplaceRegistrationNumber || "SGK sicil yok"} • {record.hazardClass || "Tehlike sınıfı yok"}
                  </p>
                ) : null}
              </div>
              <div>
                <Label>Kaza Tarihi ve Saati *</Label>
                <Input type="datetime-local" value={record.incidentDateTime} onChange={(event) => patchRecord({ incidentDateTime: event.target.value })} className="mt-2 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400 [color-scheme:dark]" />
              </div>
              <div>
                <Label>Kaza Yeri / Bölümü *</Label>
                <Input value={record.incidentPlace} onChange={(event) => patchRecord({ incidentPlace: event.target.value })} placeholder="Örn: Bakım Atölyesi / Pres Hattı" className="mt-2 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-950/30 p-4">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-blue-100">Kazazede Bilgileri</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Ad Soyad *</Label>
                  <Input value={record.injuredEmployeeName} onChange={(event) => patchRecord({ injuredEmployeeName: event.target.value })} placeholder="Ad Soyad" className="mt-2 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
                </div>
                <div>
                  <Label>Görev</Label>
                  <Input value={record.injuredEmployeeJobTitle} onChange={(event) => patchRecord({ injuredEmployeeJobTitle: event.target.value })} placeholder="Örn: Torna Operatörü" className="mt-2 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
                </div>
                <div>
                  <Label>Kıdem</Label>
                  <Input value={record.injuredEmployeeSeniority} onChange={(event) => patchRecord({ injuredEmployeeSeniority: event.target.value })} placeholder="Örn: 3 yıl" className="mt-2 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <Label>Kaza Özeti *</Label>
              <p className="mt-1 text-xs text-blue-200">Olayın oluş şeklini teknik terimlere yorum katmadan, olduğu gibi ifade edin.</p>
              <Textarea value={record.incidentSummary} onChange={(event) => patchRecord({ incidentSummary: event.target.value })} placeholder="Örn: Çalışan, enerji kesilmeden makine koruyucusunu açmış ve hareketli parçaya müdahale ederken yaralanmıştır." className="mt-3 min-h-28 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="overflow-hidden border-slate-700 bg-slate-800 text-white shadow-2xl shadow-black/20">
          <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-orange-100" />
              2. Kök Neden Analizi (5 Neden)
            </CardTitle>
            <CardDescription className="text-orange-50">Her soruyu yanıtlayarak kök nedene ulaşın.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="rounded-lg border border-amber-400/45 bg-amber-500/10 p-3 text-xs font-semibold leading-5 text-amber-100">
              Püf Noktası: Bir kazanın görünen nedeni “tedbirsizlik” gibi durabilir ama kök neden sistemdedir.
              Zincirleme “neden?” sorularıyla gerçek nedeni bulun.
            </div>
            {fiveWhyQuestions.map((question, index) => {
              const answered = Boolean(record.fiveWhyAnswers[index].trim());
              return (
                <div key={question} className="relative">
                  <div
                    className={cn(
                      "grid gap-3 rounded-lg border bg-slate-900/45 p-3 md:grid-cols-[32px_1fr]",
                      answered ? "border-amber-500/80 bg-amber-950/15 shadow-[0_0_0_1px_rgba(245,158,11,0.18)]" : "border-slate-700",
                    )}
                  >
                    <span className={cn("mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", answered ? "bg-amber-500 text-white" : "bg-slate-800 text-blue-200")}>
                      {index + 1}
                    </span>
                    <div className="space-y-2">
                      <Input value={question} readOnly className="h-8 border-0 bg-slate-950/80 text-xs font-bold !text-white" />
                      <Textarea
                        value={record.fiveWhyAnswers[index]}
                        onChange={(event) => updateFiveWhy(index, event.target.value)}
                        placeholder="Yanıt yazın..."
                        className="min-h-14 resize-none border-0 bg-slate-950/80 text-sm !text-white placeholder:!text-slate-400"
                      />
                    </div>
                  </div>
                  {index < fiveWhyQuestions.length - 1 ? <div className="mx-auto my-2 h-4 w-px bg-slate-700/80" /> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {false && step === 1 ? (
        <Card className="overflow-hidden border-slate-700 bg-slate-800 text-white">
          <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-500">
            <CardTitle>2. Kök Neden Analizi (5 Neden)</CardTitle>
            <CardDescription className="text-orange-50">Her soruyu yanıtlayarak kök nedene ulaşın.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-3 text-sm text-amber-100">
              Püf noktası: Bir kazanın görünen nedeni “tedbirsizlik” gibi durabilir ama kök neden sistemdedir. Zincirleme “neden?” sorularıyla gerçek nedeni bulun.
            </div>
            {fiveWhyQuestions.map((question, index) => (
              <div key={question} className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/45 p-4 md:grid-cols-[32px_1fr]">
                <span className="pt-2 text-center font-semibold text-blue-200">{index + 1}</span>
                <div className="space-y-2">
                  <Input value={question} readOnly className="border-slate-600 bg-slate-950/80 font-semibold !text-white" />
                  <Textarea value={record.fiveWhyAnswers[index]} onChange={(event) => updateFiveWhy(index, event.target.value)} placeholder="Yanıt yazın..." className="min-h-16 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="overflow-hidden border-slate-700 bg-slate-800 text-white shadow-2xl shadow-black/20">
          <CardHeader className="bg-gradient-to-r from-cyan-600 to-cyan-500 px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Fish className="h-5 w-5 text-blue-100" />
              3. Kaza Nedenleri Analizi (6M Modeli)
            </CardTitle>
            <CardDescription className="text-cyan-50">Kazanın olası tüm nedenlerini 6 ana kategoride analiz edin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-5 md:p-6">
            <div className="space-y-2 rounded-xl border border-cyan-400/35 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">
              <p>
                <span className="font-bold text-amber-100">6M Modeli Nedir?</span> Bir kazanın tüm olası nedenlerini 6 ana başlık altında
                (Man, Machine, Method, Material, Measurement, Environment) sınıflandırarak kök nedene ulaşmayı sağlar.
              </p>
              <p>
                <span className="font-bold text-amber-100">Kritik Püf Noktası:</span> Çoğu uzman sadece “insan” faktörünü yazıp analizi
                bitirir. Oysa bir çalışanın dikkatsizliği, genellikle yetersiz eğitim sisteminden veya baskıcı termin süresinden kaynaklanır.
                Her başlık altında “Bu neden oldu?” sorusunu sorarak kılçıkları detaylandırın.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ishikawaCategories.map((category) => (
                <div key={category.key} className={cn("flex min-h-[165px] flex-col rounded-xl border p-4", categoryStyles[category.key])}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold">{category.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{category.subtitle}</p>
                    </div>
                    <Badge className="min-w-7 justify-center rounded-full bg-slate-950/40 text-white">{record.ishikawa[category.key].length}</Badge>
                  </div>

                  <div className="mb-3 mt-auto flex gap-2">
                    <Input
                      value={ishikawaDrafts[category.key]}
                      onChange={(event) => setIshikawaDrafts((current) => ({ ...current, [category.key]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addIshikawaItem(category.key);
                        }
                      }}
                      placeholder={`Örn: ${category.examples[0]}`}
                      className="h-9 border-0 bg-slate-950/80 !text-white placeholder:!text-slate-400"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => addIshikawaItem(category.key)}
                      className={cn(
                        "h-9 w-10 shrink-0 text-white",
                        category.key === "machine"
                          ? "bg-orange-600 hover:bg-orange-500"
                          : category.key === "method"
                            ? "bg-emerald-600 hover:bg-emerald-500"
                            : category.key === "material"
                              ? "bg-amber-600 hover:bg-amber-500"
                              : category.key === "measurement"
                                ? "bg-indigo-600 hover:bg-indigo-500"
                                : category.key === "environment"
                                  ? "bg-rose-600 hover:bg-rose-500"
                                  : "bg-blue-600 hover:bg-blue-500",
                      )}
                      aria-label={`${category.title} bulgusu ekle`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mb-3">
                    <p className="mb-1 text-[11px] text-slate-300">Örnek bulgular:</p>
                    <div className="flex flex-wrap gap-1">
                    {category.examples.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => addIshikawaItem(category.key, example)}
                        className="rounded bg-slate-950/45 px-2 py-1 text-[11px] text-slate-100 transition hover:bg-slate-900"
                      >
                        + {example}
                      </button>
                    ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {record.ishikawa[category.key].map((item, index) => (
                      <div key={`${item}-${index}`} className="flex min-h-8 items-center gap-2 rounded-md bg-slate-950/45 px-3 py-2 text-xs font-semibold text-white">
                        <span className="min-w-0 flex-1 truncate">{item}</span>
                        <button type="button" onClick={() => removeIshikawaItem(category.key, index)} aria-label="Bulguyu sil" className="text-rose-200 hover:text-rose-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-950/40 p-3 text-sm text-slate-200">
              6331 Sayılı İSG Kanunu: Bir iş kazası sonrası bilimsel analiz yöntemlerinin kullanılması, işverenin ve uzmanın teknik özen yükümlülüğünü yerine getirdiğinin en büyük kanıtıdır.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="overflow-hidden border-slate-700 bg-slate-800 text-white shadow-2xl shadow-black/20">
          <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-emerald-100" />
              4. Düzeltici ve Önleyici Faaliyetler (DÖF)
            </CardTitle>
            <CardDescription className="text-emerald-50">Müfettişlerin en çok dikkat ettiği bölüm.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-xs font-semibold leading-5 text-emerald-50">
              Önemli: Her kök neden için en az bir düzeltici faaliyet tanımlayın. Sorumlu kişi ve hedef tarih belirlemeyi unutmayın.
            </div>
            {record.correctiveActions.map((action, index) => (
              <div key={action.id} className="rounded-xl border border-slate-600/90 bg-slate-900/45 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-300">DÖF #{index + 1}</span>
                  {record.correctiveActions.length > 1 ? (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-200" onClick={() => removeCorrectiveAction(action.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-slate-300">Önlem Tipi</Label>
                    <Select value={action.actionType || "Yönetsel Önlem"} onValueChange={(value) => updateCorrectiveAction(action.id, { actionType: value })}>
                      <SelectTrigger className="mt-1 h-10 border-slate-600 bg-slate-950/80 !text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                        <SelectItem value="Yönetsel Önlem">Yönetsel Önlem</SelectItem>
                        <SelectItem value="Teknik Önlem">Teknik Önlem</SelectItem>
                        <SelectItem value="Eğitim / Bilgilendirme">Eğitim / Bilgilendirme</SelectItem>
                        <SelectItem value="KKD / Ekipman">KKD / Ekipman</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Sorumlu</Label>
                    <Input value={action.responsible} onChange={(event) => updateCorrectiveAction(action.id, { responsible: event.target.value })} placeholder="Bakım MD." className="mt-1 h-10 border-0 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs text-slate-300">Açıklama *</Label>
                    <Textarea value={action.action} onChange={(event) => updateCorrectiveAction(action.id, { action: event.target.value })} placeholder="Yapılacak faaliyeti detaylı açıklayın..." className="mt-1 min-h-16 resize-none border-0 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Hedef Tarih</Label>
                    <Input type="date" value={action.targetDate} onChange={(event) => updateCorrectiveAction(action.id, { targetDate: event.target.value })} className="mt-1 h-10 border-0 bg-slate-950/80 !text-white [color-scheme:dark]" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Durum</Label>
                    <Select value={action.status} onValueChange={(value) => updateCorrectiveAction(action.id, { status: value as CorrectiveActionStatus })}>
                      <SelectTrigger className="mt-1 h-10 border-emerald-400 bg-slate-950/80 !text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                        <SelectItem value="Açık">Açık</SelectItem>
                        <SelectItem value="Kapalı">Kapalı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addCorrectiveAction} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-400/45 bg-emerald-500/5 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10">
              <Plus className="h-4 w-4" />
              Yeni DÖF Ekle
            </button>
          </CardContent>
        </Card>
      ) : null}

      {false && step === 3 ? (
        <Card className="overflow-hidden border-slate-700 bg-slate-800 text-white">
          <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-500">
            <CardTitle>4. Düzeltici ve Önleyici Faaliyetler (DÖF)</CardTitle>
            <CardDescription className="text-emerald-50">Müfettişlerin en çok dikkat ettiği bölüm.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 p-3 text-sm text-emerald-50">
              Önemli: Her kök neden için en az bir düzeltici faaliyet tanımlayın. Sorumlu kişi ve hedef tarih belirlemeyi unutmayın.
            </div>
            {record.correctiveActions.map((action, index) => (
              <div key={action.id} className="rounded-xl border border-slate-700 bg-slate-900/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">DÖF #{index + 1}</h3>
                  <Button type="button" variant="ghost" size="icon" className="text-slate-400 hover:text-rose-200" onClick={() => removeCorrectiveAction(action.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <Label>Faaliyet</Label>
                    <Textarea value={action.action} onChange={(event) => updateCorrectiveAction(action.id, { action: event.target.value })} placeholder="Alınacak düzeltici / önleyici faaliyeti yazın." className="mt-2 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
                  </div>
                  <div>
                    <Label>Sorumlu</Label>
                    <Input value={action.responsible} onChange={(event) => updateCorrectiveAction(action.id, { responsible: event.target.value })} className="mt-2 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
                  </div>
                  <div>
                    <Label>Hedef Tarih</Label>
                    <Input type="date" value={action.targetDate} onChange={(event) => updateCorrectiveAction(action.id, { targetDate: event.target.value })} className="mt-2 border-slate-600 bg-slate-950/80 !text-white [color-scheme:dark]" />
                  </div>
                  <div>
                    <Label>Durum</Label>
                    <Select value={action.status} onValueChange={(value) => updateCorrectiveAction(action.id, { status: value as CorrectiveActionStatus })}>
                      <SelectTrigger className="mt-2 border-slate-600 bg-slate-950/50 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[80] border-slate-700 bg-slate-900 text-white">
                        <SelectItem value="Planlandı">Planlandı</SelectItem>
                        <SelectItem value="Devam Ediyor">Devam Ediyor</SelectItem>
                        <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addCorrectiveAction} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400/45 bg-emerald-500/5 px-4 py-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10">
              <Plus className="h-4 w-4" />
              Yeni DÖF Ekle
            </button>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="overflow-hidden border-slate-700 bg-slate-800 text-white">
          <CardHeader className="bg-gradient-to-r from-violet-600 to-fuchsia-500">
            <CardTitle>5. Fotoğraf ve Kritik Notlar</CardTitle>
            <CardDescription className="text-violet-50">Kaza yerini fotoğrafla belgeleyin ve kritik notlarınızı ekleyin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-lg border border-violet-400/35 bg-violet-500/10 p-3 text-sm leading-6 text-violet-50">
              <p className="font-semibold text-amber-100">Kritik Püf Noktaları</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Fotoğraflama: Olay yerini kaza olduğu haliyle her açıdan fotoğraflayın.</li>
                <li>Tanık ifadeleri: İfadeleri ayrı ayrı alın. Birbirinden etkilenmelerine izin vermeyin.</li>
                <li>Ramak kala ilişkisi: Bu kazanın daha önce ramak kala olarak bildirilip bildirilmediğini kontrol edin.</li>
              </ul>
            </div>
            <div>
              <Label>Kaza Yeri Fotoğrafı</Label>
              <label className="mt-2 flex min-h-32 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-violet-400/50 bg-slate-950/30 text-center text-violet-100 hover:bg-violet-500/10">
                {record.evidencePhotoDataUrl ? (
                  <div className="w-full p-3">
                    <img
                      src={record.evidencePhotoDataUrl}
                      alt="Eklenen kaza yeri fotoğrafı"
                      className="mx-auto max-h-72 w-full rounded-lg border border-violet-400/30 object-contain"
                    />
                    <span className="mt-3 block text-xs text-slate-300">Fotoğrafı değiştirmek için tekrar tıklayın.</span>
                  </div>
                ) : (
                  <>
                    <ImagePlus className="mb-2 h-8 w-8" />
                    <span className="font-semibold">Fotoğraf yüklemek için tıklayın</span>
                    <span className="mt-1 text-xs text-slate-400">JPG, PNG • Maks. 5 MB</span>
                  </>
                )}
                <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} className="hidden" />
              </label>
              {record.evidencePhotoDataUrl ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-emerald-200">Fotoğraf eklendi ve PDF çıktısına basılacak.</p>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-rose-200 hover:bg-rose-500/10 hover:text-rose-100" onClick={() => patchRecord({ evidencePhotoDataUrl: null })}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Kaldır
                  </Button>
                </div>
              ) : null}
            </div>
            <div>
              <Label>Kritik Notlar ve Gözlemler</Label>
              <Textarea value={record.criticalNotes} onChange={(event) => patchRecord({ criticalNotes: event.target.value })} placeholder="Olay yeri gözlemleri, tanık ifade özetleri, ramak kala kayıtları kontrolü, varsa ek notlar..." className="mt-2 min-h-28 border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card className="border-slate-700 bg-slate-800 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              6. Önizleme ve Son Kontrol
            </CardTitle>
            <CardDescription className="text-slate-300">Raporunuzu gözden geçirin ve kaydedin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-slate-950/45 p-4">
              <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                <p>Kaza Tarihi: <span className="text-white">{formatDateTimeTr(record.incidentDateTime)}</span></p>
                <p>Kaza Yeri: <span className="text-white">{record.incidentPlace || "-"}</span></p>
                <p>Kazazede: <span className="text-white">{record.injuredEmployeeName || "-"}</span></p>
                <p>Görev: <span className="text-white">{record.injuredEmployeeJobTitle || "-"}</span></p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-600 bg-slate-950/40 p-4 text-center">
                <p className="text-2xl font-bold text-orange-300">{rootCauseCount}/5</p>
                <p className="text-xs text-slate-300">Kök Neden</p>
              </div>
              <div className="rounded-xl border border-slate-600 bg-slate-950/40 p-4 text-center">
                <p className="text-2xl font-bold text-cyan-300">{ishikawaCount}</p>
                <p className="text-xs text-slate-300">Kaza Nedeni Bulgusu</p>
              </div>
              <div className="rounded-xl border border-slate-600 bg-slate-950/40 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-300">{record.correctiveActions.length}</p>
                <p className="text-xs text-slate-300">DÖF Aksiyonu</p>
              </div>
            </div>
            {validationErrors.length ? (
              <div className="rounded-xl border border-red-500/45 bg-red-500/10 p-4 text-sm text-red-100">
                <p className="font-semibold">Eksik Alanlar</p>
                <p className="mt-1">{validationErrors.join(", ")}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                Zorunlu alanlar tamam. Rapor kaydedilebilir ve PDF olarak indirilebilir.
              </div>
            )}
            <div className="rounded-xl border border-slate-700 bg-slate-900/55 p-4">
              <p className="font-semibold">İndirilen PDF'e kaşe/imza ekle</p>
              <Button type="button" size="sm" className="mt-3 bg-blue-600 hover:bg-blue-500">
                + Kaşe/İmza Ekle
              </Button>
              <p className="mt-3 text-xs text-amber-200">Ücretsiz pakette kaşenizin üzerine çapraz “İSGPratik” filigranı eklenir.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" disabled={step === 0} onClick={() => goToStep(step - 1)} className="text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-35">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Geri
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={() => goToStep(step + 1)} className="bg-gradient-to-r from-red-600 to-orange-500 px-6 text-white hover:from-red-500 hover:to-orange-400">
            İleri
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" onClick={() => void saveRecord("Taslak")} disabled={saving} className="bg-amber-700 hover:bg-amber-600">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Taslak Kaydet
            </Button>
            <Button type="button" onClick={() => void saveRecord("Tamamlandı")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Raporu Tamamla
            </Button>
            <Button type="button" onClick={() => void downloadPdf()} disabled={pdfLoading} className="bg-blue-600 hover:bg-blue-500">
              {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              PDF İndir
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
