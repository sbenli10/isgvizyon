import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  FileImage,
  Flame,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyCompanyToDrillReport,
  companyDisplayName,
  createClientId,
  createEmptyEmergencyDrillReport,
  drillTeamRoles,
  drillTypes,
  employeeToDrillTeamMember,
  generateEmergencyDrillReportPdf,
  getScenarioTextForDrillType,
  loadEmergencyDrillCompanies,
  loadEmergencyDrillCompanyEmployees,
  saveEmergencyDrillReport,
  validateEmergencyDrillReport,
  type DrillChecklistAnswer,
  type EmergencyDrillReportRecord,
  type EmergencyDrillTeamMember,
} from "@/lib/emergencyDrillReport";
import { cn } from "@/lib/utils";
import type { Company, Employee } from "@/types/companies";

const scenarioCards = [
  { title: "Yangın Tatbikatı", icon: Flame, color: "text-red-300", bg: "bg-red-500/10" },
  { title: "Deprem Tatbikatı", icon: AlertTriangle, color: "text-amber-300", bg: "bg-amber-500/10" },
  { title: "Genel Tahliye Tatbikatı", icon: Building2, color: "text-blue-300", bg: "bg-blue-500/10" },
  { title: "Kimyasal Dökülme/Sızıntı Tatbikatı", icon: ShieldCheck, color: "text-violet-300", bg: "bg-violet-500/10" },
  { title: "İlk Yardım / İş Kazası Tatbikatı", icon: ClipboardCheck, color: "text-rose-300", bg: "bg-rose-500/10" },
  { title: "Doğalgaz/LPG Kaçağı Tatbikatı", icon: AlertTriangle, color: "text-orange-300", bg: "bg-orange-500/10" },
  { title: "Sel/Su Baskını Tatbikatı", icon: Building2, color: "text-cyan-300", bg: "bg-cyan-500/10" },
  { title: "Elektrik Yangını Tatbikatı", icon: Flame, color: "text-yellow-300", bg: "bg-yellow-500/10" },
  { title: "Sabotaj/Güvenlik Tehdidi Tatbikatı", icon: ShieldCheck, color: "text-slate-300", bg: "bg-slate-500/10" },
  { title: "Gıda Zehirlenmesi Tatbikatı", icon: AlertTriangle, color: "text-lime-300", bg: "bg-lime-500/10" },
];

const inputClass = "border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500";
const selectContentClass = "z-[90] max-h-80 border-slate-700 bg-slate-950 text-white";

const emptyManualMember = (): EmergencyDrillTeamMember => ({
  id: createClientId("manual-team"),
  fullName: "",
  teamRole: "Söndürme Ekibi",
});

function memberKey(member: Pick<EmergencyDrillTeamMember, "employeeId" | "fullName" | "teamRole">) {
  if (member.employeeId) return `employee:${member.employeeId}:${member.teamRole}`;
  return `manual:${member.fullName.trim().toLocaleLowerCase("tr-TR")}:${member.teamRole}`;
}

export default function EmergencyDrillReport() {
  const { user, profile } = useAuth();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [record, setRecord] = useState<EmergencyDrillReportRecord>(() => createEmptyEmergencyDrillReport(profile?.organization_id || null));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [manualMember, setManualMember] = useState<EmergencyDrillTeamMember>(() => emptyManualMember());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedTeamRole, setSelectedTeamRole] = useState("Söndürme Ekibi");
  const [customChecklist, setCustomChecklist] = useState("");
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const selectedCompany = useMemo(() => companies.find((company) => company.id === record.companyId) || null, [companies, record.companyId]);
  const memberKeys = useMemo(() => new Set(record.teamMembers.map(memberKey)), [record.teamMembers]);

  const patchRecord = (patch: Partial<EmergencyDrillReportRecord>) => setRecord((current) => ({ ...current, ...patch }));

  const handleScenarioChange = (drillType: string) => {
    patchRecord({
      drillType,
      scenarioText: getScenarioTextForDrillType(drillType),
    });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setCompanies(await loadEmergencyDrillCompanies());
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
    setRecord((current) => applyCompanyToDrillReport(current, company));
    setEmployees([]);
    setSelectedEmployeeId("");
    setEmployeesLoading(true);
    try {
      setEmployees(await loadEmergencyDrillCompanyEmployees(company.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma çalışanları yüklenemedi.");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const addMember = (member: EmergencyDrillTeamMember) => {
    if (!member.fullName.trim()) return;
    const key = memberKey(member);
    if (memberKeys.has(key)) {
      toast.info("Bu kişi aynı görevle zaten listeye ekli.");
      return;
    }
    patchRecord({ teamMembers: [...record.teamMembers, member] });
  };

  const addSelectedEmployee = () => {
    const employee = employees.find((item) => item.id === selectedEmployeeId);
    if (!employee) {
      toast.error("Ekip üyesi için çalışan seçin.");
      return;
    }
    addMember(employeeToDrillTeamMember(employee, selectedTeamRole));
  };

  const addManualMember = () => {
    if (!manualMember.fullName.trim()) {
      toast.error("Manuel ekip üyesi için ad soyad girin.");
      return;
    }
    addMember({ ...manualMember, id: createClientId("manual-team") });
    setManualMember(emptyManualMember());
  };

  const updateChecklistAnswer = (id: string, answer: DrillChecklistAnswer) => {
    patchRecord({
      checklist: record.checklist.map((item) => (item.id === id ? { ...item, answer } : item)),
    });
  };

  const addChecklistItem = () => {
    const question = customChecklist.trim();
    if (!question) return;
    patchRecord({
      checklist: [...record.checklist, { id: createClientId("check"), question, answer: "Evet" }],
    });
    setCustomChecklist("");
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
    const errors = validateEmergencyDrillReport(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveEmergencyDrillReport(record, user.id, profile?.organization_id || null);
      setRecord(saved);
      toast.success("Acil durum tatbikat tutanağı kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tutanak kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    const errors = validateEmergencyDrillReport(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setPdfLoading(true);
    try {
      await generateEmergencyDrillReportPdf(record);
      toast.success("PDF çıktı hazırlandı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101827] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 grid h-11 w-11 place-items-center rounded-2xl border border-orange-400/25 bg-orange-500/20 text-orange-200">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Acil Durum Tatbikat Tutanağı</h1>
              <p className="text-sm text-slate-400">Acil durum tatbikatını planlayın, ekipleri ve kontrol listesini kaydedin, PDF çıktısını alın.</p>
              <Button type="button" size="sm" variant="outline" className="mt-3 h-8 border-orange-400/30 bg-orange-500/10 text-orange-100 hover:bg-orange-500/15">
                <HelpCircle className="mr-2 h-4 w-4" />
                Nasıl Yapılır?
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800">
              Şablonlarım
            </Button>
            <Button type="button" variant="outline" className="border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800">
              Şablon Kaydet
            </Button>
            <Button type="button" onClick={downloadPdf} disabled={pdfLoading} className="bg-orange-500 text-white hover:bg-orange-400">
              {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              PDF İndir
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
          <p className="font-semibold">PDF'e kaşe/imza ekle alanı için logo yükleyebilirsiniz.</p>
          <p className="mt-1 text-amber-100/80">Kaşeniz yoksa tutanağı indirdikten sonra elle imzalayabilir veya kaşe alanlarını boş bırakabilirsiniz.</p>
        </div>

        <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <AlertTriangle className="h-4 w-4 text-orange-300" />
              Tatbikat Senaryosu Seçin
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">Hazır senaryoyu seçin; metni aşağıdan firma yapısına göre düzenleyebilirsiniz.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {scenarioCards.map((scenario) => {
              const Icon = scenario.icon;
              const active = record.drillType === scenario.title;
              return (
                <button
                  key={scenario.title}
                  type="button"
                  onClick={() => handleScenarioChange(scenario.title)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    active ? "border-orange-400/60 bg-orange-500/10" : "border-slate-700 bg-slate-950/35 hover:border-orange-400/30",
                  )}
                >
                  <span className={cn("mb-3 grid h-9 w-9 place-items-center rounded-lg", scenario.bg, scenario.color)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="block text-sm font-bold text-white">{scenario.title}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">~30-60 dk</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Building2 className="h-4 w-4 text-orange-300" />
                  Firma & Tatbikat Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Firma</Label>
                  <Select value={record.companyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger className={cn("mt-1", inputClass)}>
                      <SelectValue placeholder={loading ? "Firmalar yükleniyor..." : "Firma seçin"} />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {companyDisplayName(company)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Adres</Label>
                  <Input value={record.companyAddress} onChange={(event) => patchRecord({ companyAddress: event.target.value })} placeholder="İşyeri adresi" className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">SGK Sicil No</Label>
                  <Input value={record.workplaceRegistrationNumber} onChange={(event) => patchRecord({ workplaceRegistrationNumber: event.target.value })} className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Tehlike Sınıfı</Label>
                  <Select value={record.hazardClass || "Seçiniz"} onValueChange={(value) => patchRecord({ hazardClass: value === "Seçiniz" ? "" : value })}>
                    <SelectTrigger className={cn("mt-1", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="Seçiniz">Seçiniz</SelectItem>
                      <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                      <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                      <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Tatbikat Tarihi</Label>
                  <Input type="date" value={record.drillDate} onChange={(event) => patchRecord({ drillDate: event.target.value })} className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Tatbikat Yeri</Label>
                  <Input value={record.drillLocation} onChange={(event) => patchRecord({ drillLocation: event.target.value })} placeholder="Örn. Üretim sahası ve idari bina" className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Başlama Saati</Label>
                  <Input type="time" value={record.startTime} onChange={(event) => patchRecord({ startTime: event.target.value })} className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Bitiş Saati</Label>
                  <Input type="time" value={record.endTime} onChange={(event) => patchRecord({ endTime: event.target.value })} className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Tahliye Süresi (dk)</Label>
                  <Input type="number" min={0} value={record.durationMinutes} onChange={(event) => patchRecord({ durationMinutes: Number(event.target.value || 0) })} className={cn("mt-1", inputClass)} />
                </div>
                <div className="flex items-end gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-2"><Checkbox checked={record.isAnnounced} onCheckedChange={(checked) => patchRecord({ isAnnounced: Boolean(checked) })} />Haberli tatbikat</label>
                  <label className="flex items-center gap-2"><Checkbox checked={record.isPlanned} onCheckedChange={(checked) => patchRecord({ isPlanned: Boolean(checked) })} />Yıllık plan dahilinde</label>
                </div>
                <div>
                  <Label className="text-xs text-slate-300">İşveren / Vekili</Label>
                  <Input value={record.employerName} onChange={(event) => patchRecord({ employerName: event.target.value })} className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">İş Güvenliği Uzmanı</Label>
                  <Input value={record.specialistName} onChange={(event) => patchRecord({ specialistName: event.target.value })} className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Tatbikat Koordinatörü</Label>
                  <Input value={record.coordinatorName} onChange={(event) => patchRecord({ coordinatorName: event.target.value })} placeholder="Tatbikatı yöneten kişi" className={cn("mt-1", inputClass)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Belge Tarihi</Label>
                  <Input type="date" value={record.nextReviewDate} onChange={(event) => patchRecord({ nextReviewDate: event.target.value })} className={cn("mt-1", inputClass)} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Logo / Kaşe (PDF başlığı)</Label>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => void handleLogoFile(event.target.files?.[0])} />
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 text-xs text-slate-400 hover:border-orange-400/40 hover:text-orange-100">
                    <FileImage className="h-4 w-4" />
                    {record.logoDataUrl ? "Logo seçildi" : "Logo Yükle (PNG/JPG, <2 MB)"}
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <ClipboardCheck className="h-4 w-4 text-orange-300" />
                  Senaryo Metni
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={record.scenarioText} onChange={(event) => patchRecord({ scenarioText: event.target.value })} className="min-h-[180px] border-slate-700 bg-slate-950/60 text-xs leading-5 text-white placeholder:text-slate-500" />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Users className="h-4 w-4 text-orange-300" />
                    Görev Alan Ekipler
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">Firma çalışanlarını seçin veya manuel ekip üyesi ekleyin.</CardDescription>
                </div>
                <Badge className="border-orange-400/20 bg-orange-500/10 text-orange-100">{record.teamMembers.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={!selectedCompany || employeesLoading}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder={!selectedCompany ? "Firma seçin" : employeesLoading ? "Çalışanlar yükleniyor..." : "Çalışan seçin"} />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name || `${employee.first_name} ${employee.last_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedTeamRole} onValueChange={setSelectedTeamRole}>
                    <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {drillTeamRoles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addSelectedEmployee} className="bg-orange-500 text-white hover:bg-orange-400">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                  <Input value={manualMember.fullName} onChange={(event) => setManualMember((current) => ({ ...current, fullName: event.target.value }))} placeholder="Ad Soyad" className={inputClass} />
                  <Select value={manualMember.teamRole} onValueChange={(value) => setManualMember((current) => ({ ...current, teamRole: value }))}>
                    <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {drillTeamRoles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addManualMember} variant="outline" className="border-orange-400/30 bg-orange-500/10 text-orange-100 hover:bg-orange-500/15">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="max-h-56 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {record.teamMembers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">Henüz ekip üyesi eklenmedi.</p>
                  ) : (
                    record.teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{member.fullName}</p>
                          <p className="truncate text-xs text-slate-500">{member.teamRole}</p>
                        </div>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-rose-200" onClick={() => patchRecord({ teamMembers: record.teamMembers.filter((item) => item.id !== member.id) })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <ClipboardCheck className="h-4 w-4 text-orange-300" />
                  Değerlendirme Kontrol Listesi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgba(249,115,22,.55)_transparent] [scrollbar-width:thin]">
                  {record.checklist.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
                      <div className="flex gap-2">
                        <Input value={item.question} onChange={(event) => patchRecord({ checklist: record.checklist.map((row) => row.id === item.id ? { ...row, question: event.target.value } : row) })} className={cn("h-8 text-xs", inputClass)} />
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-rose-200" onClick={() => patchRecord({ checklist: record.checklist.filter((row) => row.id !== item.id) })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {(["Evet", "Hayır", "Kısmen"] as DrillChecklistAnswer[]).map((answer) => (
                          <button
                            key={answer}
                            type="button"
                            onClick={() => updateChecklistAnswer(item.id, answer)}
                            className={cn(
                              "rounded-md border px-2 py-1 text-[11px] font-semibold transition",
                              item.answer === answer ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white",
                            )}
                          >
                            {answer}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={customChecklist} onChange={(event) => setCustomChecklist(event.target.value)} placeholder="Özel değerlendirme sorusu ekle..." className={inputClass} />
                  <Button type="button" onClick={addChecklistItem} className="bg-orange-500 text-white hover:bg-orange-400">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <CalendarDays className="h-4 w-4 text-orange-300" />
                  Gözlem ve Sonuç
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={record.generalEvaluation} onChange={(event) => patchRecord({ generalEvaluation: event.target.value })} placeholder="Tatbikat sırasındaki gözlemler, genel değerlendirme..." className="min-h-[90px] border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                <Textarea value={record.detectedDeficiencies} onChange={(event) => patchRecord({ detectedDeficiencies: event.target.value })} placeholder="Tespit edilen eksiklikler..." className="min-h-[80px] border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                <Textarea value={record.correctiveActions} onChange={(event) => patchRecord({ correctiveActions: event.target.value })} placeholder="Yapılacak düzenlemeler / DÖF..." className="min-h-[80px] border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={saveRecord} disabled={saving} className="bg-slate-800 text-white hover:bg-slate-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Kaydet
                  </Button>
                  <Button type="button" onClick={downloadPdf} disabled={pdfLoading} className="bg-orange-500 text-white hover:bg-orange-400">
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
