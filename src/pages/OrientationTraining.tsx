import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  Download,
  FileImage,
  GraduationCap,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  companyDisplayName,
  createClientId,
  createEmptyOrientationTrainingRecord,
  employeeToOrientationParticipant,
  generateOrientationTrainingPdf,
  loadOrientationCompanies,
  loadOrientationCompanyEmployees,
  orientationDefaultTopics,
  saveOrientationTrainingRecord,
  validateOrientationTraining,
  type OrientationTrainingParticipant,
  type OrientationTrainingRecord,
} from "@/lib/orientationTraining";
import { cn } from "@/lib/utils";
import type { Company, Employee } from "@/types/companies";

const methods = ["Uygulamalı", "Teorik", "Teorik + Uygulamalı", "Saha anlatımı"];

const topicGroups = [
  { title: "İşyeri Tanıtımı", items: orientationDefaultTopics.slice(0, 5) },
  { title: "Görev ve Ekipman Tanıtımı", items: orientationDefaultTopics.slice(5, 8) },
  { title: "İşe / İşyerine Özgü İSG", items: orientationDefaultTopics.slice(8) },
];

const emptyManual = (): OrientationTrainingParticipant => ({
  id: createClientId("manual"),
  fullName: "",
  nationalId: "",
  jobTitle: "",
  department: "",
  startDate: null,
});

function participantKey(participant: Pick<OrientationTrainingParticipant, "employeeId" | "nationalId" | "fullName">) {
  if (participant.employeeId) return `employee:${participant.employeeId}`;
  const tc = participant.nationalId.replace(/\D/g, "");
  if (tc) return `tc:${tc}`;
  return `name:${participant.fullName.trim().toLocaleLowerCase("tr-TR")}`;
}

export default function OrientationTraining() {
  const { user, profile } = useAuth();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [record, setRecord] = useState<OrientationTrainingRecord>(() => createEmptyOrientationTrainingRecord(profile?.organization_id || null));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [manual, setManual] = useState<OrientationTrainingParticipant>(() => emptyManual());
  const [customTopic, setCustomTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const selectedCompany = useMemo(() => companies.find((company) => company.id === record.companyId) || null, [companies, record.companyId]);
  const participantKeys = useMemo(() => new Set(record.participants.map(participantKey)), [record.participants]);

  const patchRecord = (patch: Partial<OrientationTrainingRecord>) => setRecord((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setCompanies(await loadOrientationCompanies());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Firma listesi yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleCompanyChange = async (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    patchRecord({ companyId: company.id, companyName: companyDisplayName(company), participants: [] });
    setEmployees([]);
    setEmployeesLoading(true);
    try {
      setEmployees(await loadOrientationCompanyEmployees(company.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma çalışanları yüklenemedi.");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const addParticipant = (participant: OrientationTrainingParticipant) => {
    if (!participant.fullName.trim()) return;
    const key = participantKey(participant);
    if (participantKeys.has(key)) {
      toast.info("Bu çalışan zaten tutanak listesinde.");
      return;
    }
    patchRecord({ participants: [...record.participants, participant] });
  };

  const addManualParticipant = () => {
    if (!manual.fullName.trim()) {
      toast.error("Manuel çalışan için ad soyad girin.");
      return;
    }
    addParticipant({ ...manual, id: createClientId("manual") });
    setManual(emptyManual());
  };

  const toggleTopic = (topic: string, checked: boolean) => {
    patchRecord({
      topics: checked ? [...record.topics, topic] : record.topics.filter((item) => item !== topic),
    });
  };

  const addCustomTopic = () => {
    const topic = customTopic.trim();
    if (!topic) return;
    if (record.topics.includes(topic)) {
      toast.info("Bu konu zaten seçili.");
      return;
    }
    patchRecord({ topics: [...record.topics, topic] });
    setCustomTopic("");
  };

  const handleLogoFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo dosyası 2 MB'den küçük olmalı.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    patchRecord({ logoDataUrl: dataUrl });
  };

  const saveRecord = async () => {
    if (!user) return;
    const errors = validateOrientationTraining(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveOrientationTrainingRecord(record, user.id, profile?.organization_id || null);
      setRecord(saved);
      toast.success("İşbaşı / oryantasyon tutanağı kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tutanak kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    const errors = validateOrientationTraining(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setPdfLoading(true);
    try {
      await generateOrientationTrainingPdf(record);
      toast.success("PDF çıktı hazırlandı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101827] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 grid h-11 w-11 place-items-center rounded-2xl border border-emerald-400/25 bg-emerald-500/20 text-emerald-200">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">İşbaşı / Oryantasyon Eğitim Tutanağı</h1>
              <p className="text-sm text-slate-400">İşe yeni başlayan her çalışan için ayrı, tek sayfalık tutanak hazırlayın.</p>
              <Button type="button" size="sm" variant="outline" className="mt-3 h-8 border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15">
                <HelpCircle className="mr-2 h-4 w-4" />
                Nasıl Yapılır?
              </Button>
            </div>
          </div>
          <Button type="button" onClick={downloadPdf} disabled={pdfLoading} className="w-fit bg-emerald-500 text-slate-950 hover:bg-emerald-400">
            {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            PDF İndir
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Building2 className="h-4 w-4 text-emerald-300" />
                  Firma & Eğitim Bilgisi
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Firma</Label>
                  <Select value={record.companyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger className="mt-1 border-slate-700 bg-slate-950/60 text-white">
                      <SelectValue placeholder={loading ? "Firmalar yükleniyor..." : "Firma seçin"} />
                    </SelectTrigger>
                    <SelectContent className="z-[80] max-h-80 border-slate-700 bg-slate-950 text-white">
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {companyDisplayName(company)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Eğitim Tarihi</Label>
                  <Input type="date" value={record.trainingDate} onChange={(event) => patchRecord({ trainingDate: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Süre (saat)</Label>
                  <Input type="number" min={1} value={record.durationHours} onChange={(event) => patchRecord({ durationHours: Number(event.target.value || 0) })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Eğitim Yeri</Label>
                  <Input value={record.trainingPlace} onChange={(event) => patchRecord({ trainingPlace: event.target.value })} placeholder="örn. Üretim sahası" className="mt-1 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Eğitim Yöntemi</Label>
                  <Select value={record.trainingMethod} onValueChange={(value) => patchRecord({ trainingMethod: value })}>
                    <SelectTrigger className="mt-1 border-slate-700 bg-slate-950/60 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                      {methods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Eğitimi Veren (Eğitici / Görevli)</Label>
                  <Input value={record.trainerName} onChange={(event) => patchRecord({ trainerName: event.target.value })} placeholder="Eğitimi veren görevli / amir adı" className="mt-1 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Belge Tarihi</Label>
                  <Input type="date" value={record.documentDate} onChange={(event) => patchRecord({ documentDate: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-300 sm:col-span-2">
                  <label className="flex items-center gap-2"><Checkbox checked={record.includeSpecialistSignature} onCheckedChange={(checked) => patchRecord({ includeSpecialistSignature: Boolean(checked) })} />İGU imzası ekle</label>
                  <label className="flex items-center gap-2"><Checkbox checked={record.includeDoctorSignature} onCheckedChange={(checked) => patchRecord({ includeDoctorSignature: Boolean(checked) })} />İşyeri Hekimi imzası ekle</label>
                  <label className="flex items-center gap-2"><Checkbox checked={record.hideNationalId} onCheckedChange={(checked) => patchRecord({ hideNationalId: Boolean(checked) })} />T.C. No gizle</label>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Logo (PDF başlığı)</Label>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => void handleLogoFile(event.target.files?.[0])} />
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 text-xs text-slate-400 hover:border-emerald-400/40 hover:text-emerald-100">
                    <FileImage className="h-4 w-4" />
                    {record.logoDataUrl ? "Logo seçildi" : "Logo Yükle (PNG/JPG, <2 MB)"}
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <GraduationCap className="h-4 w-4 text-emerald-300" />
                  Eğitim Konuları
                </CardTitle>
                <span className="text-xs text-slate-400">{record.topics.length}/{orientationDefaultTopics.length}</span>
              </CardHeader>
              <CardContent className="max-h-[390px] space-y-4 overflow-y-auto pr-2 [scrollbar-color:rgba(16,185,129,.55)_transparent] [scrollbar-width:thin]">
                {topicGroups.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">{group.title}</p>
                    {group.items.map((topic) => (
                      <label key={topic} className="flex items-start gap-2 text-xs leading-5 text-slate-200">
                        <Checkbox checked={record.topics.includes(topic)} onCheckedChange={(checked) => toggleTopic(topic, Boolean(checked))} className="mt-0.5 border-emerald-400/60 data-[state=checked]:bg-emerald-500" />
                        {topic}
                      </label>
                    ))}
                  </div>
                ))}
                {record.topics.filter((topic) => !orientationDefaultTopics.includes(topic)).map((topic) => (
                  <div key={topic} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="min-w-0 flex-1">{topic}</span>
                    <button type="button" onClick={() => toggleTopic(topic, false)} className="text-slate-500 hover:text-rose-200">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Firmaya özgü konu ekle..." className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                  <Button type="button" size="icon" onClick={addCustomTopic} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
              <p className="font-semibold">Ücretsiz pakette kaşe/imza üzerinde “İSGPratik” filigranı eklenir.</p>
              <p className="mt-1 text-amber-100/80">Kaşeniz yoksa bu alandan logo yükleyin; PDF başlığına yerleşir.</p>
            </div>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Users className="h-4 w-4 text-emerald-300" />
                  Firma Çalışanları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedCompany ? (
                  <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-xs text-slate-400">Çalışanları görmek için bir firma seçin.</p>
                ) : employeesLoading ? (
                  <p className="flex items-center justify-center rounded-lg border border-dashed border-slate-700 p-8 text-xs text-slate-400">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Çalışanlar yükleniyor...
                  </p>
                ) : employees.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-xs text-slate-400">Bu firmada kayıtlı çalışan bulunamadı.</p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {employees.map((employee) => {
                      const participant = employeeToOrientationParticipant(employee);
                      const selected = participantKeys.has(participantKey(participant));
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => addParticipant(participant)}
                          disabled={selected}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition",
                            selected ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-950/40 text-slate-200 hover:border-emerald-400/30",
                          )}
                        >
                          <span>
                            <span className="block font-semibold">{participant.fullName}</span>
                            <span className="text-slate-500">{participant.jobTitle || "-"}</span>
                          </span>
                          {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="border-t border-slate-700 pt-4">
                  <Label className="text-xs text-slate-300">Manuel çalışan ekle</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={manual.fullName} onChange={(event) => setManual((current) => ({ ...current, fullName: event.target.value }))} placeholder="Ad Soyad" className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                    <Input value={manual.nationalId} onChange={(event) => setManual((current) => ({ ...current, nationalId: event.target.value }))} placeholder="T.C. No (ops.)" className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                    <Input value={manual.jobTitle} onChange={(event) => setManual((current) => ({ ...current, jobTitle: event.target.value }))} placeholder="Görevi / ünvanı" className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500 sm:col-span-2" />
                    <Button type="button" onClick={addManualParticipant} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 sm:col-span-2">
                      <Plus className="mr-2 h-4 w-4" />
                      Ekle
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <UserCheck className="h-4 w-4 text-emerald-300" />
                    Tutanak Alacaklar
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">Her çalışan için PDF içinde ayrı sayfa üretilir.</CardDescription>
                </div>
                <Badge className="border-slate-600 bg-slate-800 text-slate-200">{record.participants.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {record.participants.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-xs text-slate-400">Yukarıdan çalışan ekleyin.</p>
                ) : (
                  record.participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{participant.fullName}</p>
                        <p className="truncate text-xs text-slate-500">{participant.jobTitle || "-"}</p>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-rose-200" onClick={() => patchRecord({ participants: record.participants.filter((item) => item.id !== participant.id) })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={saveRecord} disabled={saving} className="bg-slate-800 text-white hover:bg-slate-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Kaydet
                  </Button>
                  <Button type="button" onClick={downloadPdf} disabled={pdfLoading} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                    {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    PDF İndir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
