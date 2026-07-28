import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  FileCheck2,
  PackageCheck,
  Plus,
  Save,
  Shield,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  allPpeItems,
  companyName,
  createPpeFormNo,
  generatePpeZimmetPdf,
  loadPpeCompanies,
  loadPpeEmployees,
  ppeCategories,
  savePpeZimmetRecord,
  type PpeZimmetEmployee,
} from "@/lib/ppeZimmet";
import type { Company } from "@/types/companies";

const templateStorageKey = "isgvizyon-ppe-zimmet-templates";

type SavedTemplate = {
  id: string;
  name: string;
  itemIds: string[];
};

const today = new Date().toISOString().slice(0, 10);

const panelClass = "rounded-2xl border border-slate-700/80 bg-slate-800/80 shadow-xl shadow-black/10";
const panelHeaderClass = "flex items-center gap-2 rounded-t-2xl px-6 py-4 text-lg font-bold text-white";
const inputClass =
  "h-11 border-slate-600 bg-slate-900/60 text-white placeholder:text-slate-500 focus-visible:ring-violet-400";

function loadTemplates(): SavedTemplate[] {
  try {
    const raw = localStorage.getItem(templateStorageKey);
    return raw ? (JSON.parse(raw) as SavedTemplate[]) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: SavedTemplate[]) {
  localStorage.setItem(templateStorageKey, JSON.stringify(templates));
}

export default function PPEManagement() {
  const { user, profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<PpeZimmetEmployee[]>([]);
  const [formNo, setFormNo] = useState(() => createPpeFormNo());
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [manualEmployees, setManualEmployees] = useState<PpeZimmetEmployee[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [periodicControlDate, setPeriodicControlDate] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualTc, setManualTc] = useState("");
  const [manualJob, setManualJob] = useState("");
  const [sector, setSector] = useState("Genel");
  const [openCategories, setOpenCategories] = useState<string[]>(ppeCategories.map((category) => category.id));
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<"forward" | "backward">("forward");
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTemplates(loadTemplates());
    loadPpeCompanies()
      .then(setCompanies)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Firma listesi yüklenemedi.");
      })
      .finally(() => setLoadingCompanies(false));
  }, []);

  useEffect(() => {
    setEmployees([]);
    setSelectedEmployeeIds([]);
    if (!selectedCompanyId) return;
    setLoadingEmployees(true);
    loadPpeEmployees(selectedCompanyId)
      .then(setEmployees)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Firma çalışanları yüklenemedi.");
      })
      .finally(() => setLoadingEmployees(false));
  }, [selectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  const selectedEmployees = useMemo(() => {
    const systemEmployees = employees.filter((employee) => selectedEmployeeIds.includes(employee.id));
    return [...systemEmployees, ...manualEmployees];
  }, [employees, manualEmployees, selectedEmployeeIds]);

  const selectedItems = useMemo(
    () => allPpeItems.filter((item) => selectedItemIds.includes(item.id)),
    [selectedItemIds],
  );

  const steps = [
    { title: "Firma", description: "Firma Bilgileri", icon: Building2 },
    { title: "Çalışan", description: "Çalışan Seçimi", icon: UsersRound },
    { title: "KKD", description: "KKD Seçimi", icon: Shield },
    { title: "Teslim", description: "Teslim Bilgileri", icon: PackageCheck },
    { title: "Onay", description: "Son Kontrol", icon: FileCheck2 },
  ];

  const goToStep = (index: number) => {
    setStepDirection(index > activeStep ? "forward" : "backward");
    setActiveStep(index);
  };

  const validateCurrentStep = () => {
    if (activeStep === 0 && !selectedCompany) return "Devam etmek için firma seçin.";
    if (activeStep === 1 && selectedEmployees.length === 0) return "Devam etmek için en az bir çalışan seçin veya manuel çalışan ekleyin.";
    if (activeStep === 2 && selectedItems.length === 0) return "Devam etmek için en az bir KKD seçin.";
    if (activeStep === 3 && !deliveryDate) return "Devam etmek için teslim tarihi girin.";
    return "";
  };

  const nextStep = () => {
    const message = validateCurrentStep();
    if (message) {
      toast.error(message);
      return;
    }
    goToStep(Math.min(steps.length - 1, activeStep + 1));
  };

  const previousStep = () => goToStep(Math.max(0, activeStep - 1));

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  };

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
    );
  };

  const addManualEmployee = () => {
    if (!manualName.trim()) {
      toast.error("Manuel çalışan için ad soyad girin.");
      return;
    }
    setManualEmployees((current) => [
      ...current,
      {
        id: `manual-${Date.now()}`,
        fullName: manualName.trim(),
        tcNumber: manualTc.trim(),
        department: "",
        jobTitle: manualJob.trim(),
        isManual: true,
      },
    ]);
    setManualName("");
    setManualTc("");
    setManualJob("");
  };

  const selectAllItems = () => setSelectedItemIds(allPpeItems.map((item) => item.id));

  const saveTemplate = () => {
    if (selectedItemIds.length === 0) {
      toast.error("Şablon kaydetmek için en az bir KKD seçin.");
      return;
    }
    const name = window.prompt("Şablon adı");
    if (!name?.trim()) return;
    const nextTemplates = [
      ...templates,
      {
        id: `template-${Date.now()}`,
        name: name.trim(),
        itemIds: selectedItemIds,
      },
    ];
    setTemplates(nextTemplates);
    saveTemplates(nextTemplates);
    toast.success("KKD şablonu kaydedildi.");
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (template) {
      setSelectedItemIds(template.itemIds);
      toast.success(`${template.name} şablonu uygulandı.`);
    }
  };

  const buildRecord = () => ({
    formNo,
    companyId: selectedCompany?.id || "",
    companyName: selectedCompany ? companyName(selectedCompany) : "",
    deliveryDate,
    periodicControlDate,
    employees: selectedEmployees,
    selectedItemIds,
    selectedItems,
    deliveredBy,
  });

  const validate = () => {
    if (!selectedCompany) return "Firma seçin.";
    if (selectedEmployees.length === 0) return "En az bir çalışan seçin veya manuel çalışan ekleyin.";
    if (selectedItems.length === 0) return "En az bir KKD seçin.";
    if (!deliveryDate) return "Teslim tarihi girin.";
    return "";
  };

  const createPdf = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const record = buildRecord();
    setSaving(true);
    try {
      if (user?.id) {
        await savePpeZimmetRecord(record, user.id, profile?.organization_id);
      }
      await generatePpeZimmetPdf(record, selectedCompany);
      setFormNo(createPpeFormNo());
      toast.success("KKD zimmet formu oluşturuldu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "KKD zimmet formu oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 p-7 shadow-2xl shadow-violet-950/30">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">KKD Zimmet Formu</h1>
                <p className="mt-1 text-sm font-medium text-violet-100">Kişisel Koruyucu Donanım Teslim Belgesi</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/15 p-3 ring-1 ring-white/20">
              <span className="text-sm font-bold text-white">Form No:</span>
              <span className="rounded-lg border border-white/20 bg-slate-900/55 px-4 py-2 font-mono text-sm font-bold text-slate-200">
                {formNo}
              </span>
            </div>
          </div>
        </section>

        <nav className="rounded-2xl border border-slate-700/80 bg-slate-800/80 px-4 py-4 shadow-xl shadow-black/10">
          <div className="grid grid-cols-5 items-start gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === index;
              const isDone = index < activeStep;
              return (
                <button
                  type="button"
                  key={step.title}
                  onClick={() => goToStep(index)}
                  className="group relative flex min-w-0 flex-col items-center gap-2 rounded-xl px-2 py-1 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {index < steps.length - 1 && (
                    <span className="absolute left-[58%] top-5 hidden h-px w-[84%] bg-slate-600 md:block" />
                  )}
                  <span
                    className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border transition ${
                      isActive
                        ? "border-cyan-300 bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                        : isDone
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-600 bg-slate-700 text-slate-300 group-hover:border-slate-400"
                    }`}
                  >
                    {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <span className={`text-xs font-bold ${isActive ? "text-white" : "text-slate-300"}`}>{step.title}</span>
                  <span className="hidden text-[11px] font-medium text-slate-500 sm:block">{step.description}</span>
                  {isActive && <span className="absolute -bottom-4 h-1 w-16 rounded-full bg-gradient-to-r from-rose-500 to-orange-500" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div
          key={activeStep}
          className={`transition-all duration-300 ${
            stepDirection === "forward" ? "animate-in slide-in-from-right-6 fade-in" : "animate-in slide-in-from-left-6 fade-in"
          }`}
        >
        {activeStep === 0 && (
        <section className={panelClass}>
          <div className={`${panelHeaderClass} bg-slate-700/60`}>
            <Building2 className="h-5 w-5 text-cyan-300" />
            1. Firma Bilgileri
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-[1.5fr_0.7fr_0.7fr]">
            <div className="space-y-2">
              <Label>Firma Seçin *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder={loadingCompanies ? "Firmalar yükleniyor..." : "Firma arayın veya seçin..."} />
                </SelectTrigger>
                <SelectContent className="z-[80] border-slate-700 bg-slate-900 text-white">
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {companyName(company)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Teslim Tarihi</Label>
              <div className="relative">
                <Input className={inputClass} type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
                <CalendarDays className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Periyodik Kontrol Tarihi</Label>
              <div className="relative">
                <Input
                  className={inputClass}
                  type="date"
                  value={periodicControlDate}
                  onChange={(event) => setPeriodicControlDate(event.target.value)}
                />
                <CalendarDays className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
              </div>
            </div>
          </div>
        </section>
        )}

        {activeStep === 1 && (
        <section className={panelClass}>
          <div className={`${panelHeaderClass} bg-gradient-to-r from-blue-600 to-cyan-500`}>
            <UsersRound className="h-5 w-5 text-amber-200" />
            2. Çalışan Seçimi
          </div>
          <div className="space-y-4 p-6">
            <div className="rounded-xl border border-slate-700 bg-slate-900/35 p-4">
              <div className="mb-4 flex items-center gap-2 font-semibold text-white">
                <UsersRound className="h-4 w-4 text-cyan-300" />
                Firma Çalışanları
              </div>
              {!selectedCompanyId ? (
                <div className="flex min-h-24 items-center justify-center text-sm text-blue-200">Çalışanları görmek için bir firma seçin.</div>
              ) : loadingEmployees ? (
                <div className="flex min-h-24 items-center justify-center text-sm text-blue-200">Çalışanlar yükleniyor...</div>
              ) : employees.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm text-slate-400">Bu firmada kayıtlı çalışan bulunamadı.</div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {employees.map((employee) => {
                    const selected = selectedEmployeeIds.includes(employee.id);
                    return (
                      <button
                        type="button"
                        key={employee.id}
                        onClick={() => toggleEmployee(employee.id)}
                        className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
                          selected
                            ? "border-cyan-400 bg-cyan-500/15 text-white"
                            : "border-slate-700 bg-slate-950/40 text-slate-200 hover:border-cyan-500/60"
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-bold">{employee.fullName}</span>
                          <span className="text-xs text-slate-400">{employee.jobTitle || employee.department || "Görev bilgisi yok"}</span>
                        </span>
                        {selected && <Check className="h-4 w-4 text-cyan-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-700/35 p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold">
                <UserPlus className="h-4 w-4 text-emerald-300" />
                Manuel Çalışan Ekle
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_0.7fr]">
                <Input className={inputClass} placeholder="Ad Soyad *" value={manualName} onChange={(event) => setManualName(event.target.value)} />
                <Input className={inputClass} placeholder="TC Kimlik No" value={manualTc} onChange={(event) => setManualTc(event.target.value)} />
                <Input
                  className={inputClass}
                  placeholder="Departman/Görev"
                  value={manualJob}
                  onChange={(event) => setManualJob(event.target.value)}
                />
                <Button type="button" className="h-11 gap-2 bg-emerald-600 hover:bg-emerald-500" onClick={addManualEmployee}>
                  <Plus className="h-4 w-4" />
                  Ekle
                </Button>
              </div>
            </div>

            {selectedEmployees.length === 0 ? (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900/30 text-center">
                <UsersRound className="mb-3 h-10 w-10 text-slate-600" />
                <p className="font-semibold text-slate-400">Henüz çalışan eklenmedi</p>
                <p className="text-sm text-blue-200">Yukarıdan firma seçerek veya manuel olarak çalışan ekleyin.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4">
                <div className="mb-3 font-bold text-white">Teslim alacak çalışanlar ({selectedEmployees.length})</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {selectedEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between rounded-lg bg-slate-950/50 px-3 py-2">
                      <span>
                        <span className="block text-sm font-semibold">{employee.fullName}</span>
                        <span className="text-xs text-slate-400">{employee.tcNumber || "TC No yok"}</span>
                      </span>
                      {employee.isManual && (
                        <button
                          type="button"
                          aria-label="Manuel çalışanı kaldır"
                          onClick={() => setManualEmployees((current) => current.filter((item) => item.id !== employee.id))}
                          className="rounded-md p-2 text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {activeStep === 2 && (
        <section className={panelClass}>
          <div className={`${panelHeaderClass} bg-gradient-to-r from-purple-700 to-fuchsia-500`}>
            <Boxes className="h-5 w-5 text-amber-200" />
            3. KKD Seçimi
          </div>
          <div className="space-y-4 p-6">
            <div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/35 p-4 md:grid-cols-[1fr_130px]">
              <div className="space-y-2">
                <Label>Sektör Seçimi</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Sektör seçin" />
                  </SelectTrigger>
                  <SelectContent className="z-[80] border-slate-700 bg-slate-900 text-white">
                    {["Genel", "İnşaat", "Metal", "Kimya", "Gıda", "Sağlık", "Lojistik", "Enerji"].map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-center">
                <p className="text-xs text-blue-200">Seçili Ürün</p>
                <p className="text-lg font-black text-fuchsia-300">{selectedItemIds.length} KKD</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" className="bg-violet-700 hover:bg-violet-600" onClick={selectAllItems}>
                Tümünü Seç
              </Button>
              <Button type="button" variant="secondary" className="bg-slate-700 text-white hover:bg-slate-600" onClick={() => setSelectedItemIds([])}>
                Temizle
              </Button>
              <Button type="button" className="gap-2 bg-emerald-700 hover:bg-emerald-600" onClick={saveTemplate}>
                <Save className="h-4 w-4" />
                Şablonu Kaydet
              </Button>
              <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                <SelectTrigger className="h-10 w-44 border-slate-700 bg-blue-950/70 text-white">
                  <SelectValue placeholder="Şablonlarım" />
                </SelectTrigger>
                <SelectContent className="z-[80] border-slate-700 bg-slate-900 text-white">
                  {templates.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      Kayıtlı şablon yok
                    </SelectItem>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {ppeCategories.map((category) => {
                const isOpen = openCategories.includes(category.id);
                return (
                  <div key={category.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/45">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between bg-slate-700/45 px-4 py-3 text-left font-bold text-white"
                      onClick={() => toggleCategory(category.id)}
                    >
                      <span className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        {category.title}
                      </span>
                      <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="p-4">
                        <div className="mb-3 flex items-center justify-between text-xs">
                          <span className="font-semibold text-fuchsia-300">Kategoriyi Seç</span>
                          <button
                            type="button"
                            className="rounded-md bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/20"
                            onClick={() => {
                              const ids = category.items.map((item) => item.id);
                              setSelectedItemIds((current) => Array.from(new Set([...current, ...ids])));
                            }}
                          >
                            + Ekle
                          </button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-3">
                          {category.items.map((item) => {
                            const checked = selectedItemIds.includes(item.id);
                            return (
                              <label
                                key={item.id}
                                className={`flex min-h-[58px] cursor-pointer gap-2 rounded-lg border p-3 transition ${
                                  checked
                                    ? "border-violet-400 bg-violet-500/15"
                                    : "border-slate-600 bg-slate-950/30 hover:border-violet-500/60"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 accent-violet-500"
                                  checked={checked}
                                  onChange={() => toggleItem(item.id)}
                                />
                                <span>
                                  <span className="block text-sm font-semibold text-slate-100">{item.name}</span>
                                  <span className="text-xs text-slate-400">({item.standard})</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {activeStep === 3 && (
        <section className={panelClass}>
          <div className={`${panelHeaderClass} bg-slate-600/80`}>
            <PackageCheck className="h-5 w-5 text-amber-200" />
            4. Teslim Bilgileri
          </div>
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <Label>Teslim Eden (Ad Soyad / Ünvan)</Label>
              <Input
                className={inputClass}
                placeholder="İSG Uzmanı / Depo Sorumlusu vb."
                value={deliveredBy}
                onChange={(event) => setDeliveredBy(event.target.value)}
              />
            </div>

            <div className="rounded-xl border border-fuchsia-500/70 bg-fuchsia-950/30 p-4">
              <div className="mb-2 flex items-center gap-2 font-bold text-white">
                <FileCheck2 className="h-4 w-4 text-fuchsia-300" />
                KKD Zimmet Formu Hakkında
              </div>
              <p className="text-sm leading-6 text-fuchsia-50">
                KKD Zimmet Formu, çalışanlara teslim edilen kişisel koruyucu donanımların kayıt altına alındığı yasal
                belgedir. 6331 sayılı İş Sağlığı ve Güvenliği Kanunu gereği KKD teslimatlarının belgelenmesi zorunludur.
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-300">Tüm ekipmanlar CE işareti ve ilgili TS EN standartlarına uygun olmalıdır.</p>
            </div>
          </div>
        </section>
        )}

        {activeStep === 4 && (
          <section className={panelClass}>
            <div className={`${panelHeaderClass} bg-gradient-to-r from-emerald-600 to-teal-500`}>
              <FileCheck2 className="h-5 w-5 text-white" />
              5. Onay ve Son Kontrol
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4">
                  <p className="text-xs font-semibold text-slate-400">Firma</p>
                  <p className="mt-2 text-sm font-bold text-white">{selectedCompany ? companyName(selectedCompany) : "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4">
                  <p className="text-xs font-semibold text-slate-400">Çalışan</p>
                  <p className="mt-2 text-xl font-black text-cyan-300">{selectedEmployees.length}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4">
                  <p className="text-xs font-semibold text-slate-400">KKD</p>
                  <p className="mt-2 text-xl font-black text-fuchsia-300">{selectedItemIds.length}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4">
                  <p className="text-xs font-semibold text-slate-400">Teslim Tarihi</p>
                  <p className="mt-2 text-sm font-bold text-white">{deliveryDate || "-"}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-900/35 p-4">
                  <h3 className="mb-3 font-bold text-white">Teslim Alacak Çalışanlar</h3>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {selectedEmployees.length === 0 ? (
                      <p className="text-sm text-slate-400">Çalışan seçilmedi.</p>
                    ) : (
                      selectedEmployees.map((employee) => (
                        <div key={employee.id} className="rounded-lg bg-slate-950/45 px-3 py-2 text-sm">
                          <p className="font-semibold text-white">{employee.fullName}</p>
                          <p className="text-xs text-slate-400">{employee.tcNumber || "TC No yok"} • {employee.jobTitle || "Görev yok"}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/35 p-4">
                  <h3 className="mb-3 font-bold text-white">Seçilen KKD Listesi</h3>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {selectedItems.length === 0 ? (
                      <p className="text-sm text-slate-400">KKD seçilmedi.</p>
                    ) : (
                      selectedItems.map((item) => (
                        <div key={item.id} className="rounded-lg bg-slate-950/45 px-3 py-2 text-sm">
                          <p className="font-semibold text-white">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.standard}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                disabled={saving}
                className="h-12 w-full gap-2 rounded-xl bg-violet-700 text-base font-bold hover:bg-violet-600"
                onClick={createPdf}
              >
                <Download className="h-5 w-5" />
                PDF Oluştur ({selectedEmployees.length} Çalışan x {selectedItemIds.length} KKD)
              </Button>
            </div>
          </section>
        )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            disabled={activeStep === 0}
            onClick={previousStep}
          >
            <ArrowLeft className="h-4 w-4" />
            Geri
          </Button>
          {activeStep < steps.length - 1 ? (
            <Button type="button" className="gap-2 bg-orange-600 hover:bg-orange-500" onClick={nextStep}>
              İleri
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" className="gap-2 bg-emerald-600 hover:bg-emerald-500" onClick={createPdf} disabled={saving}>
              <Download className="h-4 w-4" />
              Formu Oluştur
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
