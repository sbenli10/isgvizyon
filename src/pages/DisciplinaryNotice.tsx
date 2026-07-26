import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  Check,
  Download,
  FileImage,
  FileText,
  Gavel,
  HelpCircle,
  ChevronsUpDown,
  Loader2,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  calculateEmployerIpcPenalty,
  companyDisplayName,
  createClientId,
  createEmptyDisciplinaryNoticeRecord,
  deliveryStatuses,
  disciplinaryRuleCatalog,
  employeeToNoticeFields,
  employerIpcEmployeeRanges,
  employerIpcRuleCatalog,
  generateDisciplinaryNoticePdf,
  generateEmployerIpcNoticePdf,
  getCompanyRegistryNo,
  loadDisciplinaryNoticeCompanies,
  loadDisciplinaryNoticeEmployees,
  penaltyTypes,
  saveDisciplinaryNoticeRecord,
  validateDisciplinaryNotice,
  validateEmployerIpcNotice,
  violationTypes,
  type DisciplinaryNoticeRecord,
  type DisciplinaryWitness,
  type EmploymentStatusType,
  type EmployerIpcPenaltyLine,
} from "@/lib/disciplinaryNotice";
import { cn } from "@/lib/utils";
import type { Company, Employee } from "@/types/companies";

const tabItems = [
  { id: "employee", label: "Çalışana Ceza Tutanağı", icon: ShieldAlert },
  { id: "employer", label: "İşverenin İPC Belgesi", icon: FileText },
] as const;

const emptyWitness = (): DisciplinaryWitness => ({
  id: createClientId("witness"),
  fullName: "",
  jobTitle: "",
});

const violationCardClass: Record<string, string> = {
  "Kuralsız Çalışma": "border-rose-400 bg-rose-500/10 text-rose-100",
  "Atıl Koruyucu / Ekipman": "border-blue-400/40 bg-blue-500/10 text-blue-100",
  "Geçici Görevli Çalışan": "border-slate-500/50 bg-slate-800/70 text-slate-100",
  Diğer: "border-violet-400/45 bg-violet-500/10 text-violet-100",
};

const penaltyCardClass: Record<string, string> = {
  "Sözlü Uyarı": "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
  "Yazılı İhtar": "border-rose-400 bg-rose-500/10 text-rose-100",
  "Ücret Kesme Cezası": "border-rose-500 bg-rose-500/10 text-rose-100",
  "Yasal Savunma Talebi": "border-sky-400/40 bg-sky-500/10 text-sky-100",
};

const penaltyDescriptions: Record<string, string> = {
  "Sözlü Uyarı": "İlk/hafif ihlalde sözlü ikaz; tutanakla kayıt altına alınır.",
  "Yazılı İhtar": "Tekrarında fesih sürecine dayanak olacak yazılı uyarı.",
  "Ücret Kesme Cezası": "4857 md.38 - ayda en fazla iki gündelik kesilebilir.",
  "Yasal Savunma Talebi": "Çalışandan süre verilerek yazılı savunma istenir.",
};

const hazardOptions = ["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"];

const employmentStatusOptions: Array<{
  value: EmploymentStatusType;
  title: string;
  description: string;
  activeClassName: string;
}> = [
  {
    value: "Kadrolu Çalışan",
    title: "Kadrolu Çalışan",
    description: "Yukarıdaki işyerinin kendi sigortalı çalışanı.",
    activeClassName: "border-white/90 bg-slate-950/35 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.35)]",
  },
  {
    value: "Alt İşveren (Taşeron) Çalışanı",
    title: "Alt İşveren (Taşeron) Çalışanı",
    description: "SGK girişi alt işveren firmada; yaptırım yetkisi kendi işvereninde.",
    activeClassName: "border-white/90 bg-slate-950/35 text-rose-100 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]",
  },
  {
    value: "Geçici Görevli Çalışan",
    title: "Geçici Görevli Çalışan",
    description: "4857 md.7 ödünç iş ilişkisi; kadrosu başka işverende.",
    activeClassName: "border-rose-400 bg-rose-500/10 text-rose-100 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]",
  },
];

const getIpcProfileMultiplier = (employeeRange?: string, hazardClass?: string) => {
  if (employeeRange === "50 ve Üzeri Çalışan") {
    if (hazardClass === "Çok Tehlikeli") return 3;
    if (hazardClass === "Tehlikeli") return 2;
    return 1.5;
  }
  if (employeeRange === "10-49 Çalışan") {
    if (hazardClass === "Çok Tehlikeli") return 2;
    if (hazardClass === "Tehlikeli") return 1.5;
    return 1;
  }
  if (hazardClass === "Çok Tehlikeli") return 1.5;
  return 1;
};

const calculateIpcLineTotal = (quantity = 1, unitAmount = 0, multiplier = 1) => {
  const total = Number(quantity || 0) * Number(unitAmount || 0) * Number(multiplier || 1);
  return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
};

const normalizeIpcLines = (lines: EmployerIpcPenaltyLine[] = [], multiplier = 1) =>
  lines.map((line) => ({
    ...line,
    quantity: Number(line.quantity || 1),
    unitAmount: Number(line.unitAmount || 0),
    lineTotal: calculateIpcLineTotal(line.quantity, line.unitAmount, multiplier),
  }));

export default function DisciplinaryNotice() {
  const { user, profile } = useAuth();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<"employee" | "employer">("employee");
  const [ipcRuleOpen, setIpcRuleOpen] = useState(false);
  const [record, setRecord] = useState<DisciplinaryNoticeRecord>(() => createEmptyDisciplinaryNoticeRecord(profile?.organization_id || null));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [manualWitness, setManualWitness] = useState<DisciplinaryWitness>(() => emptyWitness());
  const [customRule, setCustomRule] = useState("");
  const [customRuleReference, setCustomRuleReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const selectedCompany = useMemo(() => companies.find((company) => company.id === record.companyId) || null, [companies, record.companyId]);
  const selectedRuleIds = useMemo(() => new Set(record.selectedRules.map((rule) => rule.id)), [record.selectedRules]);
  const groupedRules = useMemo(() => {
    return disciplinaryRuleCatalog.reduce<Array<{ category: string; items: typeof disciplinaryRuleCatalog }>>((groups, rule) => {
      const current = groups.find((group) => group.category === rule.category);
      if (current) {
        current.items.push(rule);
      } else {
        groups.push({ category: rule.category, items: [rule] });
      }
      return groups;
    }, []);
  }, []);
  const patchRecord = (patch: Partial<DisciplinaryNoticeRecord>) => setRecord((current) => ({ ...current, ...patch }));

  const switchTab = (tab: "employee" | "employer") => {
    setActiveTab(tab);
    patchRecord({ noticeType: tab });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setCompanies(await loadDisciplinaryNoticeCompanies());
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
    const nextHazardClass = company.hazard_class || "";
    const nextMultiplier = getIpcProfileMultiplier(record.ipcEmployeeRange, nextHazardClass);

    patchRecord({
      companyId: company.id,
      companyName: companyDisplayName(company),
      companyAddress: [company.address, company.district, company.city].filter(Boolean).join(" / "),
      workplaceRegistrationNumber: getCompanyRegistryNo(company),
      hazardClass: nextHazardClass,
      employerName: company.employer_representative_name || "",
      employeeId: null,
      employeeName: activeTab === "employer" ? company.occupational_safety_specialist_name || "" : "",
      employeeNationalId: activeTab === "employer" ? company.occupational_safety_specialist_tc_no || "" : "",
      employeeJobTitle: activeTab === "employer" ? "İSG Uzmanı" : "",
      employeeDepartment: "",
      employeeStartDate: null,
      ipcMultiplier: nextMultiplier,
      ipcPenaltyAmount: calculateEmployerIpcPenalty(record.ipcBaseAmount, nextMultiplier),
    });

    setEmployees([]);
    setEmployeesLoading(true);
    try {
      setEmployees(await loadDisciplinaryNoticeEmployees(company.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Firma çalışanları yüklenemedi.");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    patchRecord(employeeToNoticeFields(employee));
  };

  const toggleRule = (ruleId: string, checked: boolean) => {
    const rule = disciplinaryRuleCatalog.find((item) => item.id === ruleId);
    if (!rule) return;
    patchRecord({
      selectedRules: checked ? [...record.selectedRules, rule] : record.selectedRules.filter((item) => item.id !== ruleId),
    });
  };

  const addCustomRule = () => {
    const title = customRule.trim();
    if (!title) {
      toast.error("Özel kural için açıklama girin.");
      return;
    }
    patchRecord({
      selectedRules: [
        ...record.selectedRules,
        {
          id: createClientId("custom-rule"),
          category: "Özel / İç Yönerge",
          title,
          legalReference: customRuleReference.trim() || "İşyeri iç yönergesi",
        },
      ],
    });
    setCustomRule("");
    setCustomRuleReference("");
  };

  const handleIpcRuleChange = (ruleId: string) => {
    const rule = employerIpcRuleCatalog.find((item) => item.id === ruleId);
    if (!rule) return;
    setRecord((current) => {
      const multiplier = current.ipcMultiplier || getIpcProfileMultiplier(current.ipcEmployeeRange, current.hazardClass);
      const nextLine: EmployerIpcPenaltyLine = {
        id: createClientId("ipc-line"),
        ruleId: rule.id,
        article: rule.article,
        title: rule.title,
        quantity: 1,
        unitAmount: rule.baseAmount,
        lineTotal: calculateIpcLineTotal(1, rule.baseAmount, multiplier),
        correctiveAction: "",
      };
      const lines = normalizeIpcLines([...(current.ipcPenaltyLines || []), nextLine], multiplier);
      return {
        ...current,
        ipcRuleId: rule.id,
        ipcRuleTitle: rule.title,
        ipcRuleArticle: rule.article,
        ipcBaseAmount: rule.baseAmount,
        ipcPenaltyLines: lines,
        ipcPenaltyAmount: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      };
    });
  };

  const updateIpcPenalty = (patch: Partial<DisciplinaryNoticeRecord>) => {
    setRecord((current) => {
      const baseAmount = Number(patch.ipcBaseAmount ?? current.ipcBaseAmount ?? 0);
      const employeeRange = patch.ipcEmployeeRange ?? current.ipcEmployeeRange;
      const hazardClass = patch.hazardClass ?? current.hazardClass;
      const multiplier = Number(patch.ipcMultiplier ?? getIpcProfileMultiplier(employeeRange, hazardClass));
      const lines = normalizeIpcLines((patch.ipcPenaltyLines as EmployerIpcPenaltyLine[] | undefined) ?? current.ipcPenaltyLines ?? [], multiplier);
      return {
        ...current,
        ...patch,
        ipcMultiplier: multiplier,
        ipcPenaltyLines: lines,
        ipcPenaltyAmount: lines.length ? lines.reduce((sum, line) => sum + line.lineTotal, 0) : calculateEmployerIpcPenalty(baseAmount, multiplier),
      };
    });
  };

  const updateIpcLine = (lineId: string, patch: Partial<EmployerIpcPenaltyLine>) => {
    setRecord((current) => {
      const multiplier = current.ipcMultiplier || getIpcProfileMultiplier(current.ipcEmployeeRange, current.hazardClass);
      const lines = normalizeIpcLines(
        (current.ipcPenaltyLines || []).map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
        multiplier,
      );
      return {
        ...current,
        ipcPenaltyLines: lines,
        ipcPenaltyAmount: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      };
    });
  };

  const removeIpcLine = (lineId: string) => {
    setRecord((current) => {
      const lines = (current.ipcPenaltyLines || []).filter((line) => line.id !== lineId);
      return {
        ...current,
        ipcPenaltyLines: lines,
        ipcPenaltyAmount: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      };
    });
  };

  const addCustomIpcLine = () => {
    const title = (record.ipcRuleTitle || "").trim();
    const article = (record.ipcRuleArticle || "").trim();
    if (!title || !article) {
      toast.error("Özel ceza kalemi için madde ve açıklama girin.");
      return;
    }
    const multiplier = record.ipcMultiplier || getIpcProfileMultiplier(record.ipcEmployeeRange, record.hazardClass);
    const nextLine: EmployerIpcPenaltyLine = {
      id: createClientId("ipc-line"),
      ruleId: record.ipcRuleId || "custom",
      article,
      title,
      quantity: 1,
      unitAmount: Number(record.ipcBaseAmount || 0),
      lineTotal: calculateIpcLineTotal(1, Number(record.ipcBaseAmount || 0), multiplier),
      correctiveAction: "",
    };
    updateIpcPenalty({ ipcPenaltyLines: [...(record.ipcPenaltyLines || []), nextLine] });
  };

  const addWitness = () => {
    if (!manualWitness.fullName.trim()) {
      toast.error("Tanık için ad soyad girin.");
      return;
    }
    patchRecord({
      witnesses: [...record.witnesses, { ...manualWitness, id: createClientId("witness") }],
    });
    setManualWitness(emptyWitness());
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
    const recordToSave = { ...record, noticeType: activeTab };
    const errors = activeTab === "employer" ? validateEmployerIpcNotice(recordToSave) : validateDisciplinaryNotice(recordToSave);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveDisciplinaryNoticeRecord(recordToSave, user.id, profile?.organization_id || null);
      setRecord(saved);
      toast.success(activeTab === "employer" ? "İşverene İPC tebliği kaydedildi." : "Ceza ve tebliğ tutanağı kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tutanak kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    const recordToPrint = { ...record, noticeType: activeTab };
    const errors = activeTab === "employer" ? validateEmployerIpcNotice(recordToPrint) : validateDisciplinaryNotice(recordToPrint);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setPdfLoading(true);
    try {
      if (activeTab === "employer") {
        await generateEmployerIpcNoticePdf(recordToPrint);
      } else {
        await generateDisciplinaryNoticePdf(recordToPrint);
      }
      toast.success("PDF çıktı hazırlandı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101827] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-rose-400/25 bg-rose-500/20 text-rose-200">
              <Gavel className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">İSG Ceza ve Tebliğ Tutanağı</h1>
              <p className="max-w-2xl text-sm text-slate-400">
                Çalışana yönelik kural ihlali tutanağı ve savunma/tebliğ belgesini firma bilgileriyle hazırlayın.
              </p>
              <Button type="button" size="sm" variant="outline" className="mt-3 h-8 border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15">
                <HelpCircle className="mr-2 h-4 w-4" />
                Nasıl Yapılır?
              </Button>
            </div>
          </div>
          <Button type="button" onClick={downloadPdf} disabled={pdfLoading} className="w-fit bg-rose-500 text-white hover:bg-rose-400">
            {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            PDF İndir
          </Button>
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-1">
          <div className="grid gap-1 sm:grid-cols-2">
            {tabItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition",
                    isActive ? (index === 0 ? "bg-rose-500 text-white shadow-lg shadow-rose-950/30" : "bg-slate-800 text-white shadow-lg shadow-black/20") : "text-slate-300 hover:bg-slate-800",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
          <CardContent className="space-y-3 p-4">
            <div>
              <Label className="text-xs text-slate-300">Logo (PDF başlığı - İSG logo alanı)</Label>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => void handleLogoFile(event.target.files?.[0])} />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 text-xs text-slate-400 hover:border-rose-400/40 hover:text-rose-100"
              >
                <FileImage className="h-4 w-4" />
                {record.logoDataUrl ? "Logo seçildi" : "Logo Yükle (opsiyonel)"}
              </button>
            </div>
            <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
              <AlertTriangle className="mb-2 h-4 w-4" />
              PDF çıktısında firma, çalışan, olay, ihlal kuralları ve tebliğ bilgileri otomatik yerleştirilir.
            </div>
          </CardContent>
        </Card>

        {activeTab === "employer" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-5">
              <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Building2 className="h-4 w-4 text-orange-300" />
                    Firma Bilgileri
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
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-slate-300">Adres</Label>
                    <Input value={record.companyAddress} onChange={(event) => patchRecord({ companyAddress: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">SGK Sicil No</Label>
                    <Input value={record.workplaceRegistrationNumber} onChange={(event) => patchRecord({ workplaceRegistrationNumber: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">İşveren / Vekil</Label>
                    <Input value={record.employerName} onChange={(event) => patchRecord({ employerName: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Düzenleyen (İSG Uzmanı)</Label>
                    <Input value={record.employeeName} onChange={(event) => patchRecord({ employeeName: event.target.value })} placeholder="Ad Soyad" className="mt-1 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Tebliğ Tarihi</Label>
                    <Input type="date" value={record.deliveryDate} onChange={(event) => patchRecord({ deliveryDate: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Belge Tarihi</Label>
                    <Input type="date" value={record.noticeDate} onChange={(event) => patchRecord({ noticeDate: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Tehlike Sınıfı</Label>
                    <Select value={record.hazardClass} onValueChange={(value) => updateIpcPenalty({ hazardClass: value })}>
                      <SelectTrigger className="mt-1 border-slate-700 bg-slate-950/60 text-white">
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                        {hazardOptions.map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Users className="h-4 w-4 text-orange-400" />
                    İşyeri Profili (Ceza Artırımı)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold text-slate-200">Çalışan Sayısı Aralığı</Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {employerIpcEmployeeRanges.map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => updateIpcPenalty({ ipcEmployeeRange: range })}
                        className={cn(
                          "h-10 rounded-xl border px-3 text-xs font-black transition",
                          record.ipcEmployeeRange === range
                            ? "border-orange-500 bg-slate-900 text-orange-400 shadow-[0_0_0_1px_rgba(249,115,22,0.45)]"
                            : "border-slate-700 bg-slate-900/70 text-slate-100 hover:border-orange-400/50 hover:text-orange-100",
                        )}
                      >
                        {range}
                      </button>
                    ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-200">Tehlike Sınıfı</Label>
                    <Select value={record.hazardClass || "Az Tehlikeli"} onValueChange={(value) => updateIpcPenalty({ hazardClass: value })}>
                      <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-600 bg-slate-800/80 text-base text-white">
                        <SelectValue placeholder="Seçiniz (varsayılan: Az Tehlikeli)" />
                      </SelectTrigger>
                      <SelectContent className="z-[80] border-slate-600 bg-slate-800 text-white">
                        <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                        <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                        <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/35 px-4 py-3 text-sm leading-5 text-slate-100">
                    <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <span>
                      6331 md.26/3 artırımı: <b>{record.ipcEmployeeRange || "10'dan Az Çalışan"}</b> × <b>{record.hazardClass || "Az Tehlikeli"}</b> profili için katsayı{" "}
                      <b className="text-orange-500">×{String(record.ipcMultiplier || getIpcProfileMultiplier(record.ipcEmployeeRange, record.hazardClass)).replace(".", ",")}</b>{" "}
                      (tutarlar resmi tablodan birebir alınır).
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">Açıklama ve Talep</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={record.ipcExplanation || ""}
                    onChange={(event) => patchRecord({ ipcExplanation: event.target.value })}
                    placeholder="Örn. Yukarıda belirtilen eksikliklerin 15 gün içinde giderilmesi, eksik belge ve uygulamaların tamamlanarak yazılı dönüş yapılması..."
                    className="min-h-32 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm text-white">
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                      Ceza Kalemleri
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-400">2026 resmi kataloğundan madde seçin; aynı madde birden fazla eksiklik için tekrar eklenebilir.</CardDescription>
                  </div>
                  <Badge className="border-orange-400/30 bg-orange-500/10 text-orange-200">Kalem</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Popover open={ipcRuleOpen} onOpenChange={setIpcRuleOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={ipcRuleOpen}
                          className="mt-1 h-auto min-h-11 w-full justify-between border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-white hover:bg-slate-900"
                        >
                          <span className="min-w-0 truncate">
                            Madde no veya konu ara…
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="z-[90] w-[var(--radix-popover-trigger-width)] border-slate-700 bg-slate-950 p-0 text-white">
                        <Command className="bg-slate-950 text-white">
                          <CommandInput placeholder="Madde no veya konu ara…" className="text-white placeholder:text-slate-500" />
                          <CommandList className="max-h-80">
                            <CommandEmpty>Ceza kalemi bulunamadı.</CommandEmpty>
                            <CommandGroup>
                              {employerIpcRuleCatalog.map((rule) => (
                                <CommandItem
                                  key={rule.id}
                                  value={`${rule.article} ${rule.title}`}
                                  onSelect={() => {
                                    handleIpcRuleChange(rule.id);
                                    setIpcRuleOpen(false);
                                  }}
                                  className="items-start gap-2 rounded-lg px-3 py-2 text-slate-100 data-[selected=true]:bg-orange-500/15 data-[selected=true]:text-orange-100"
                                >
                                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0 text-orange-400", record.ipcRuleId === rule.id ? "opacity-100" : "opacity-0")} />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{rule.article} — {rule.title}</span>
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {(record.ipcPenaltyLines || []).length ? (
                    <div className="space-y-3">
                      {(record.ipcPenaltyLines || []).map((line, index) => (
                        <div key={line.id} className="rounded-xl border border-slate-700 bg-slate-950/35 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-orange-400">
                                {index + 1}. Madde {line.article} — {line.title}
                              </p>
                              <p className="mt-1 text-[11px] leading-4 text-slate-500">Kanuni temel: {line.article} • Çalışan × Tehlike: {record.ipcEmployeeRange || "10'dan Az Çalışan"} × {record.hazardClass || "Az Tehlikeli"}</p>
                              <Badge className="mt-2 border-slate-600 bg-slate-800 text-[10px] text-slate-200">Resmi kalem</Badge>
                            </div>
                            <button type="button" onClick={() => removeIpcLine(line.id)} className="rounded-lg p-1 text-rose-400 hover:bg-rose-500/10 hover:text-rose-200" aria-label="Ceza kalemini sil">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-[80px_1fr_120px]">
                            <div>
                              <Label className="text-[11px] text-slate-300">Adet</Label>
                              <Input
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={(event) => updateIpcLine(line.id, { quantity: Number(event.target.value) })}
                                className="mt-1 h-9 border-slate-700 bg-slate-950/60 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-slate-300">Tutar (TL) — elle değiştirilebilir</Label>
                              <Input
                                type="number"
                                min={0}
                                value={line.unitAmount}
                                onChange={(event) => updateIpcLine(line.id, { unitAmount: Number(event.target.value) })}
                                className="mt-1 h-9 border-slate-700 bg-slate-950/60 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-slate-300">Satır Tutarı</Label>
                              <div className="mt-1 flex h-9 items-center rounded-lg border border-slate-700 bg-slate-950/60 px-3 text-sm font-black text-orange-400">
                                {line.lineTotal.toLocaleString("tr-TR")} TL
                              </div>
                            </div>
                          </div>
                          <p className="mt-2 text-[10px] text-slate-500">Resmi tablo tutarı / Tehlike × Çalışan: {line.unitAmount.toLocaleString("tr-TR")} TL × {String(record.ipcMultiplier || 1).replace(".", ",")}</p>
                          <div className="mt-3">
                            <Label className="text-[11px] text-slate-300">Düzeltici Açıklama (opsiyonel)</Label>
                            <Input
                              value={line.correctiveAction}
                              onChange={(event) => updateIpcLine(line.id, { correctiveAction: event.target.value })}
                              placeholder="örn. Depo bölümünde aylık periyodik kontroller yapılmıyor"
                              className="mt-1 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-4 text-center text-xs text-slate-400">
                      Henüz ceza kalemi eklenmedi. Yukarıdan madde arayıp seçin.
                    </div>
                  )}
                  <div className="rounded-lg border border-slate-700 bg-slate-950/30 p-3">
                    <Label className="text-xs text-slate-300">Serbest kural / ceza açıklaması</Label>
                    <Textarea value={record.ipcRuleTitle || ""} onChange={(event) => patchRecord({ ipcRuleId: "", ipcRuleTitle: event.target.value })} className="mt-2 min-h-20 border-slate-700 bg-slate-950/60 text-white" />
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                      <Input value={record.ipcRuleArticle || ""} onChange={(event) => patchRecord({ ipcRuleArticle: event.target.value })} placeholder="Madde / yasal dayanak" className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                      <Input type="number" value={record.ipcBaseAmount || 0} onChange={(event) => updateIpcPenalty({ ipcBaseAmount: Number(event.target.value) })} placeholder="Tutar (TL)" className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                      <Button type="button" onClick={addCustomIpcLine} className="bg-orange-500 text-white hover:bg-orange-400">
                        <Plus className="mr-2 h-4 w-4" />
                        Ekle
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-black text-white">Toplam Yükümlülük Cezası</p>
                    <p className="text-xl font-black text-orange-400">{Number(record.ipcPenaltyAmount || 0).toLocaleString("tr-TR")} TL</p>
                  </div>
                  <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                    Bu sayfadaki tutar alanı tebliğ belgesinde amaçlıdır. Kalem bazlı para cezası, çalışan sayısı ve tehlike sınıfı çarpımı ile bulunur; İSGVizyon tarafından bildirilen ve tebliğ edilen tutar, resmi tebliğ değerindeki bildirimi ifade eder.
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">İşveren Takip Notu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea value={record.ipcRequestNote || ""} onChange={(event) => patchRecord({ ipcRequestNote: event.target.value })} placeholder="Örn. Alınan aksiyon, ödeme planı veya düzeltici faaliyet notu..." className="min-h-28 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
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
        ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-5">
            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Building2 className="h-4 w-4 text-rose-300" />
                  Firma Bilgileri
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
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Adres</Label>
                  <Input value={record.companyAddress} onChange={(event) => patchRecord({ companyAddress: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">SGK Sicil No</Label>
                  <Input value={record.workplaceRegistrationNumber} onChange={(event) => patchRecord({ workplaceRegistrationNumber: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Tehlike Sınıfı</Label>
                  <Select value={record.hazardClass} onValueChange={(value) => patchRecord({ hazardClass: value })}>
                    <SelectTrigger className="mt-1 border-slate-700 bg-slate-950/60 text-white">
                      <SelectValue placeholder="Seçiniz" />
                    </SelectTrigger>
                    <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                      {["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"].map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-300">İşveren / Vekil</Label>
                  <Input value={record.employerName} onChange={(event) => patchRecord({ employerName: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Düzenleyen (İSG Uzmanı)</Label>
                  <Input placeholder="Ad Soyad" className="mt-1 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <UserRound className="h-4 w-4 text-rose-300" />
                  Çalışan Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Çalışan</Label>
                  <Select value={record.employeeId || ""} onValueChange={handleEmployeeChange} disabled={!record.companyId || employeesLoading}>
                    <SelectTrigger className="mt-1 border-slate-700 bg-slate-950/60 text-white">
                      <SelectValue placeholder={!record.companyId ? "Önce firma seçin" : employeesLoading ? "Çalışanlar yükleniyor..." : "Çalışan seçin veya elle girin"} />
                    </SelectTrigger>
                    <SelectContent className="z-[80] max-h-80 border-slate-700 bg-slate-950 text-white">
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name || `${employee.first_name} ${employee.last_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Ad Soyad</Label>
                  <Input value={record.employeeName} onChange={(event) => patchRecord({ employeeName: event.target.value, employeeId: null })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">T.C. Kimlik No</Label>
                  <Input value={record.employeeNationalId} onChange={(event) => patchRecord({ employeeNationalId: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Görevi</Label>
                  <Input value={record.employeeJobTitle} onChange={(event) => patchRecord({ employeeJobTitle: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Bölüm</Label>
                  <Input value={record.employeeDepartment} onChange={(event) => patchRecord({ employeeDepartment: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">İşe Giriş Tarihi</Label>
                  <Input type="date" value={record.employeeStartDate || ""} onChange={(event) => patchRecord({ employeeStartDate: event.target.value || null })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Tutanak Belge Tarihi</Label>
                  <Input type="date" value={record.noticeDate} onChange={(event) => patchRecord({ noticeDate: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div className="space-y-3 sm:col-span-2">
                  <Label className="text-sm font-bold text-slate-100">İstihdam Şekli</Label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {employmentStatusOptions.map((option) => {
                      const isActive = record.employmentStatus === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => patchRecord({ employmentStatus: option.value })}
                          className={cn(
                            "min-h-[86px] rounded-xl border p-4 text-left transition hover:border-slate-400/70 hover:bg-slate-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
                            isActive ? option.activeClassName : "border-slate-700 bg-slate-950/25 text-slate-100",
                          )}
                        >
                          <span className={cn("block text-sm font-extrabold leading-tight", isActive && option.value !== "Kadrolu Çalışan" ? "text-rose-300" : "text-white")}>
                            {option.title}
                          </span>
                          <span className="mt-1.5 block text-xs font-medium leading-4 text-slate-300">{option.description}</span>
                        </button>
                      );
                    })}
                  </div>
                  {record.employmentStatus !== "Kadrolu Çalışan" && (
                    <>
                      <div className="flex gap-3 rounded-xl border border-amber-400/45 bg-amber-500/10 p-3 text-xs font-semibold leading-5 text-amber-100">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <p>
                          Alt işveren (taşeron) veya geçici görevli çalışanlarda yazılı ihtar, savunma isteme ve ücret kesme gibi disiplin yaptırımlarını uygulama yetkisi, iş sözleşmesinin tarafı olan (kadro) işverenine aittir. Bu tutanak, olayın gerçekleştiği işyerindeki tespit ve bildirim işlevi görür; PDF çıktısına bu yönde şerh ve kadro işvereni imza alanı eklenir. Firma Bilgileri bölümüne olayın gerçekleştiği (tutanağın düzenlendiği) işyerini, aşağıya ise çalışanın SGK girişinin bulunduğu işvereni yazın.
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  {violationTypes.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => patchRecord({ violationType: item })}
                      className={cn(
                        "rounded-lg border p-3 text-left text-xs font-bold transition",
                        record.violationType === item ? violationCardClass[item] : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-rose-400/30",
                      )}
                    >
                      {item}
                      <span className="mt-1 block text-[10px] font-normal opacity-75">İhlal türünü belirtir.</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Olay Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-300">Olay Tarihi</Label>
                  <Input type="date" value={record.incidentDate} onChange={(event) => patchRecord({ incidentDate: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Olay Saati</Label>
                  <Input value={record.incidentTime} onChange={(event) => patchRecord({ incidentTime: event.target.value })} placeholder="--:--" className="mt-1 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Olay Yeri</Label>
                  <Input value={record.incidentPlace} onChange={(event) => patchRecord({ incidentPlace: event.target.value })} placeholder="örn. Üretim sahası, kaynak atölyesi" className="mt-1 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-300">Olay Açıklaması</Label>
                  <Textarea value={record.incidentDescription} onChange={(event) => patchRecord({ incidentDescription: event.target.value })} placeholder="Olayın gelişimi, yapılan uyarılar ve çalışanın davranışı..." className="mt-1 min-h-28 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Users className="h-4 w-4 text-rose-300" />
                  Tanıklar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={manualWitness.fullName} onChange={(event) => setManualWitness((current) => ({ ...current, fullName: event.target.value }))} placeholder="Ad Soyad" className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                  <Input value={manualWitness.jobTitle} onChange={(event) => setManualWitness((current) => ({ ...current, jobTitle: event.target.value }))} placeholder="Görevi (örn. Vardiya Amiri)" className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                  <Button type="button" onClick={addWitness} className="bg-rose-500 text-white hover:bg-rose-400">
                    <Plus className="mr-2 h-4 w-4" />
                    Ekle
                  </Button>
                </div>
                {record.witnesses.length ? (
                  <div className="space-y-2">
                    {record.witnesses.map((witness) => (
                      <div key={witness.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm">
                        <span className="text-white">{witness.fullName}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{witness.jobTitle || "-"}</span>
                          <button type="button" onClick={() => patchRecord({ witnesses: record.witnesses.filter((item) => item.id !== witness.id) })} className="text-slate-500 hover:text-rose-200">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <BookOpenCheck className="h-4 w-4 text-rose-300" />
                    İhlal Edilen Kurallar
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">Katalogdan seçin veya özel madde ekleyin.</CardDescription>
                </div>
                <Badge className="border-slate-600 bg-slate-800 text-slate-200">{record.selectedRules.length} seçili</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-[420px] space-y-4 overflow-y-auto pr-2 [scrollbar-color:rgba(244,63,94,.45)_transparent] [scrollbar-width:thin]">
                  {groupedRules.map((group) => (
                    <div key={group.category} className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-200">{group.category}</p>
                      {group.items.map((rule) => (
                        <label key={rule.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm transition hover:border-rose-400/35">
                          <Checkbox checked={selectedRuleIds.has(rule.id)} onCheckedChange={(checked) => toggleRule(rule.id, Boolean(checked))} className="mt-1 border-rose-400/60 data-[state=checked]:bg-rose-500" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-white">{rule.title}</span>
                            <span className="mt-1 block text-[11px] text-slate-500">{rule.legalReference}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-950/30 p-3">
                  <Label className="text-xs text-slate-300">Özel madde ekle</Label>
                  <Textarea value={customRule} onChange={(event) => setCustomRule(event.target.value)} placeholder="İhlal açıklaması..." className="mt-2 min-h-20 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                  <div className="mt-2 flex gap-2">
                    <Input value={customRuleReference} onChange={(event) => setCustomRuleReference(event.target.value)} placeholder="Yasal dayanak / iç yönerge" className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                    <Button type="button" onClick={addCustomRule} className="bg-rose-500 text-white hover:bg-rose-400">
                      <Plus className="mr-2 h-4 w-4" />
                      Ekle
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Gavel className="h-4 w-4 text-rose-400" />
                  Uygulanan Yaptırım
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {penaltyTypes.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => patchRecord({ penaltyType: item })}
                      className={cn(
                        "min-h-[76px] rounded-xl border p-4 text-left transition hover:border-slate-400/70 hover:bg-slate-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
                        record.penaltyType === item ? penaltyCardClass[item] : "border-slate-700 bg-slate-950/30 text-slate-100",
                      )}
                    >
                      <span className={cn("block text-sm font-extrabold leading-tight", record.penaltyType === item && (item === "Ücret Kesme Cezası" || item === "Yasal Savunma Talebi") ? "text-rose-300" : "text-white")}>
                        {item}
                      </span>
                      <span className="mt-1.5 block text-xs font-medium leading-4 text-slate-300">{penaltyDescriptions[item]}</span>
                      
                    </button>
                  ))}
                </div>
                {record.penaltyType === "Ücret Kesme Cezası" && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs font-bold text-slate-100">Kesinti Tutarı (TL)</Label>
                        <Input
                          value={record.wageDeductionAmount}
                          onChange={(event) => patchRecord({ wageDeductionAmount: event.target.value })}
                          placeholder="örn. 1.500"
                          className="mt-1 border-slate-700 bg-slate-800/80 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-100">Gündelik Sayısı</Label>
                        <Input
                          value={record.wageDeductionDayCount}
                          onChange={(event) => patchRecord({ wageDeductionDayCount: event.target.value })}
                          placeholder="en fazla 2"
                          className="mt-1 border-slate-700 bg-slate-800/80 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs font-extrabold leading-5 text-rose-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>Ücret kesme cezasını (4857 md.38) yalnızca çalışanın kendi (kadro) işvereni uygulayabilir. Bu tutanak, kadro işverenine yaptırım talebi/bildirimi niteliğinde düzenlenir.</p>
                    </div>
                    <div className="flex gap-3 rounded-xl border border-amber-400/45 bg-amber-500/10 p-3 text-xs font-semibold leading-5 text-amber-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                      <p>
                        4857 sayılı İş Kanunu md.38: Ücret kesme cezası sebepleriyle birlikte çalışana derhal bildirilir. Bir ayda iki gündelikten fazla kesinti yapılamaz. Kesilen tutarlar çalışanların eğitimi ve sosyal hizmetleri için Çalışma ve Sosyal Güvenlik Bakanlığı hesabına yatırılır.
                      </p>
                    </div>
                  </div>
                )}
                {record.penaltyType === "Yasal Savunma Talebi" && (
                  <div>
                    <Label className="text-xs font-bold text-slate-100">Savunma Süresi (iş günü)</Label>
                    <Input
                      value={record.defensePeriodBusinessDays}
                      onChange={(event) => patchRecord({ defensePeriodBusinessDays: event.target.value })}
                      placeholder="3"
                      className="mt-1 border-slate-700 bg-slate-800/80 text-white placeholder:text-slate-500"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs text-slate-300">Çalışanın Savunması</Label>
                  <Textarea value={record.employeeDefense} onChange={(event) => patchRecord({ employeeDefense: event.target.value })} placeholder="Çalışanın savunma veya beyanı..." className="mt-1 min-h-24 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Ceza / İşlem Notu</Label>
                  <Textarea value={record.penaltyNote} onChange={(event) => patchRecord({ penaltyNote: event.target.value })} placeholder="Uygulanan işlem, tekrar halinde yapılacak işlem..." className="mt-1 min-h-24 border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-slate-900/70 shadow-xl shadow-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Tebliğ / Tebellüğ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-300">Tebliğ Tarihi</Label>
                  <Input type="date" value={record.deliveryDate} onChange={(event) => patchRecord({ deliveryDate: event.target.value })} className="mt-1 border-slate-700 bg-slate-950/60 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-slate-300">Çalışanın İmza Durumu</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {deliveryStatuses.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => patchRecord({ deliveryStatus: item })}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-xs font-bold transition",
                          record.deliveryStatus === item ? "border-emerald-400 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-emerald-400/30",
                        )}
                      >
                        {record.deliveryStatus === item ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={saveRecord} disabled={saving} className="bg-slate-800 text-white hover:bg-slate-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Kaydet
                  </Button>
                  <Button type="button" onClick={downloadPdf} disabled={pdfLoading} className="bg-rose-500 text-white hover:bg-rose-400">
                    {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    PDF İndir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}


