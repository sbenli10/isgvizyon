import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Flame,
  HardHat,
  Loader2,
  PenLine,
  Save,
  Shield,
  ShieldCheck,
  Upload,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  applyCompanyToWorkPermit,
  companyDisplayName,
  createEmptyWorkPermitRecord,
  generateWorkPermitPdf,
  loadWorkPermitCompanies,
  saveWorkPermitRecord,
  validateWorkPermit,
  workPermitPpeItems,
  workPermitSafetyChecks,
  workPermitTypes,
  type WorkPermitRecord,
  type WorkPermitType,
} from "@/lib/workPermit";
import type { Company } from "@/types/companies";

type WorkPermitTabId = "work-permit-job" | "work-permit-types" | "work-permit-checks" | "work-permit-ppe" | "work-permit-approval";

type WorkPermitTab = {
  id: WorkPermitTabId;
  label: string;
  icon: LucideIcon;
  done: boolean;
};

const tabOrder: WorkPermitTabId[] = ["work-permit-job", "work-permit-types", "work-permit-checks", "work-permit-ppe", "work-permit-approval"];

const permitTypeVisuals: Record<WorkPermitType, { icon: LucideIcon; iconClassName: string; tileClassName: string }> = {
  "hot-work": {
    icon: Flame,
    iconClassName: "text-orange-500",
    tileClassName: "hover:border-orange-300/60 data-[active=true]:border-orange-300 data-[active=true]:bg-orange-500/12",
  },
  "height-work": {
    icon: HardHat,
    iconClassName: "text-blue-400",
    tileClassName: "hover:border-blue-300/60 data-[active=true]:border-blue-300 data-[active=true]:bg-blue-500/12",
  },
  "confined-space": {
    icon: Wind,
    iconClassName: "text-violet-400",
    tileClassName: "hover:border-violet-300/60 data-[active=true]:border-violet-300 data-[active=true]:bg-violet-500/12",
  },
  "electrical-work": {
    icon: Zap,
    iconClassName: "text-amber-400",
    tileClassName: "hover:border-amber-300/60 data-[active=true]:border-amber-300 data-[active=true]:bg-amber-500/12",
  },
};

const inputClass = "border-slate-600 bg-slate-950/80 !text-white placeholder:!text-slate-400 focus:border-cyan-300";

function toggleValue<T extends string>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function PermitSection({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon: ReactNode;
  className: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-700 bg-slate-800 text-white shadow-2xl shadow-black/20">
      <CardHeader className={cn("px-6 py-5", className)}>
        <CardTitle className="flex items-center gap-2 text-lg font-black text-white">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-6">{children}</CardContent>
    </Card>
  );
}

function getWorkPermitTabs(record: WorkPermitRecord): WorkPermitTab[] {
  return [
    { id: "work-permit-job", label: "İş Bilgileri", icon: PenLine, done: Boolean((record.companyId || record.contractorName) && record.workLocation && record.workDetail) },
    { id: "work-permit-types", label: "İzin Türü", icon: AlertTriangle, done: record.permitTypes.length > 0 },
    { id: "work-permit-checks", label: "Kontroller", icon: Shield, done: record.safetyChecks.length > 0 },
    { id: "work-permit-ppe", label: "KKD", icon: HardHat, done: record.ppeItems.length > 0 },
    { id: "work-permit-approval", label: "Onay", icon: ShieldCheck, done: record.approvers.some((item) => item.fullName.trim()) },
  ];
}

function WorkPermitProgress({
  steps,
  activeTab,
  onTabChange,
}: {
  steps: WorkPermitTab[];
  activeTab: WorkPermitTabId;
  onTabChange: (tab: WorkPermitTabId) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 px-5 py-4 shadow-xl shadow-black/10">
      <div className="grid gap-3 sm:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = activeTab === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onTabChange(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-xl px-2 py-2 outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-300",
                isActive && "bg-white/7",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border transition",
                  isActive
                    ? "border-cyan-200 bg-cyan-500 text-white shadow-lg shadow-cyan-950/40"
                    : step.done
                      ? "border-emerald-400 bg-emerald-500 text-white"
                      : "border-slate-600 bg-slate-700/80 text-slate-400",
                )}
              >
                {step.done && !isActive ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={cn("text-center text-xs font-bold", isActive || step.done ? "text-white" : "text-slate-400")}>{step.label}</span>
              {index < steps.length - 1 ? <span className="absolute left-[calc(50%+28px)] top-7 hidden h-0.5 w-[calc(100%-56px)] bg-slate-700 group-hover:bg-slate-600 sm:block" /> : null}
              {isActive ? <span className="absolute bottom-0 h-1 w-14 rounded-full bg-gradient-to-r from-red-500 to-orange-400" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkPermitForm() {
  const { user, profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [record, setRecord] = useState<WorkPermitRecord>(() => createEmptyWorkPermitRecord(profile?.organization_id || null));
  const [activeTab, setActiveTab] = useState<WorkPermitTabId>("work-permit-job");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadWorkPermitCompanies()
      .then((rows) => {
        if (mounted) setCompanies(rows);
      })
      .catch((error) => {
        console.error("İş izin formu firma listesi yüklenemedi:", error);
        toast.error("Firma listesi yüklenemedi.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setRecord((current) => ({ ...current, organizationId: profile?.organization_id || current.organizationId || null }));
  }, [profile?.organization_id]);

  const selectedCompany = useMemo(() => companies.find((company) => company.id === record.companyId), [companies, record.companyId]);
  const steps = useMemo(() => getWorkPermitTabs(record), [record]);
  const activeIndex = tabOrder.indexOf(activeTab);

  const patchRecord = (patch: Partial<WorkPermitRecord>) => {
    setRecord((current) => ({ ...current, ...patch }));
  };

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    setRecord((current) => applyCompanyToWorkPermit(current, company));
  };

  const handleSignatureUpload = (approverId: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen PNG veya JPG formatında bir imza görseli yükleyin.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("İmza görseli en fazla 2 MB olabilir.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const signatureDataUrl = String(reader.result || "");
      setRecord((current) => ({
        ...current,
        approvers: current.approvers.map((item) => (item.id === approverId ? { ...item, signatureDataUrl } : item)),
      }));
    };
    reader.onerror = () => toast.error("İmza görseli okunamadı.");
    reader.readAsDataURL(file);
  };

  const clearSignature = (approverId: string) => {
    setRecord((current) => ({
      ...current,
      approvers: current.approvers.map((item) => (item.id === approverId ? { ...item, signatureDataUrl: undefined } : item)),
    }));
  };

  const goToPreviousTab = () => {
    if (activeIndex > 0) setActiveTab(tabOrder[activeIndex - 1]);
  };

  const goToNextTab = () => {
    if (activeIndex < tabOrder.length - 1) setActiveTab(tabOrder[activeIndex + 1]);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Kayıt için oturum açmanız gerekiyor.");
      return;
    }
    const errors = validateWorkPermit(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveWorkPermitRecord(record, user.id, profile?.organization_id || null);
      setRecord((current) => ({ ...current, id: String(saved.id || current.id), status: "Onaylandı" }));
      toast.success("İş izin formu kaydedildi.");
    } catch (error) {
      console.error("İş izin formu kaydedilemedi:", error);
      toast.error("İş izin formu kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    const errors = validateWorkPermit(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setPdfLoading(true);
    try {
      await generateWorkPermitPdf(record);
      toast.success("İş izin formu PDF çıktısı hazırlandı.");
    } catch (error) {
      console.error("İş izin formu PDF oluşturulamadı:", error);
      toast.error("PDF çıktısı oluşturulamadı.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-6">
        <header className="rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 p-6 shadow-2xl shadow-red-950/30">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-9 w-9" />
                <h1 className="text-3xl font-bold tracking-normal">İş İzin Formu</h1>
              </div>
              <p className="mt-3 max-w-2xl text-sm text-white/90">
                Riskli çalışmalar için izin türü, güvenlik kontrolleri, KKD listesi ve onay imzalarını sekmeli akışla hazırlayın.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleSave} disabled={saving} className="h-12 bg-white/15 px-5 font-semibold text-white hover:bg-white/25">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Kaydet
              </Button>
              <Button type="button" onClick={handlePdf} disabled={pdfLoading} className="h-12 bg-slate-950/25 px-5 font-semibold text-white hover:bg-slate-950/35">
                {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                PDF İndir
              </Button>
            </div>
          </div>
        </header>

        <WorkPermitProgress steps={steps} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="transition-all duration-300 ease-out animate-in fade-in-0 slide-in-from-right-4">
          {activeTab === "work-permit-job" ? (
            <PermitSection title="1. İş Tanımı ve Lokasyon" icon={<PenLine className="h-5 w-5" />} className="bg-gradient-to-r from-blue-700 to-blue-600">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Firma / Yüklenici Adı *</Label>
                  <Select value={record.companyId} onValueChange={handleCompanyChange} disabled={loading}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder={loading ? "Firmalar yükleniyor..." : "Firma seçin veya yazın..."} />
                    </SelectTrigger>
                    <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {companyDisplayName(company)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={record.contractorName}
                    onChange={(event) => patchRecord({ contractorName: event.target.value })}
                    placeholder="Listede yoksa firma / yüklenici adını yazın"
                    className={inputClass}
                  />
                  {selectedCompany ? (
                    <p className="text-xs text-slate-400">
                      {record.workplaceRegistrationNumber || "SGK sicil yok"} · {record.hazardClass || "Tehlike sınıfı yok"}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Çalışma Alanı / Lokasyon *</Label>
                  <Input value={record.workLocation} onChange={(event) => patchRecord({ workLocation: event.target.value })} placeholder="Örn: Kazan Dairesi, Çatı Katı" className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Yapılacak İşin Detayı</Label>
                <Textarea value={record.workDetail} onChange={(event) => patchRecord({ workDetail: event.target.value })} placeholder="Yapılacak işi detaylıca açıklayınız..." className={cn(inputClass, "min-h-24 resize-none")} />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Başlangıç Zamanı</Label>
                  <Input type="datetime-local" value={record.startDateTime} onChange={(event) => patchRecord({ startDateTime: event.target.value })} className={cn(inputClass, "[color-scheme:dark]")} />
                </div>
                <div className="space-y-2">
                  <Label>Bitiş Zamanı</Label>
                  <Input type="datetime-local" value={record.endDateTime} onChange={(event) => patchRecord({ endDateTime: event.target.value })} className={cn(inputClass, "[color-scheme:dark]")} />
                </div>
              </div>
            </PermitSection>
          ) : null}

          {activeTab === "work-permit-types" ? (
            <PermitSection title="2. İzin Türü" icon={<AlertTriangle className="h-5 w-5" />} className="bg-gradient-to-r from-orange-600 to-orange-500">
              <p className="-mt-2 text-xs text-orange-100">Birden fazla seçilebilir.</p>
              <div className="grid gap-4 md:grid-cols-2">
                {workPermitTypes.map((item) => {
                  const visual = permitTypeVisuals[item.id];
                  const Icon = visual.icon;
                  const active = record.permitTypes.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-active={active}
                      onClick={() => patchRecord({ permitTypes: toggleValue(record.permitTypes, item.id) })}
                      className={cn("flex min-h-16 items-center gap-4 rounded-lg border border-slate-600 bg-slate-950/55 px-4 text-left transition", visual.tileClassName)}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                        <Icon className={cn("h-5 w-5", visual.iconClassName)} />
                      </span>
                      <span>
                        <span className="block font-bold text-white">{item.label}</span>
                        <span className="mt-1 hidden text-xs text-slate-400 sm:block">{item.description}</span>
                      </span>
                      {active ? <Check className="ml-auto h-5 w-5 text-emerald-300" /> : null}
                    </button>
                  );
                })}
              </div>
            </PermitSection>
          ) : null}

          {activeTab === "work-permit-checks" ? (
            <PermitSection title="3. Güvenlik Önlemleri Kontrol Listesi" icon={<Shield className="h-5 w-5" />} className="bg-gradient-to-r from-emerald-600 to-green-500">
              <p className="text-sm text-slate-300">Aşağıdaki önlemlerin alındığını doğrulayınız.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {workPermitSafetyChecks.map((item) => {
                  const active = record.safetyChecks.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => patchRecord({ safetyChecks: toggleValue(record.safetyChecks, item) })}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition",
                        active ? "border-emerald-300 bg-emerald-500/15 text-white" : "border-slate-600 bg-slate-950/55 text-slate-200 hover:border-emerald-300/60",
                      )}
                    >
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", active ? "border-emerald-300 bg-emerald-400 text-slate-950" : "border-slate-300")}>
                        {active ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      {item}
                    </button>
                  );
                })}
              </div>
            </PermitSection>
          ) : null}

          {activeTab === "work-permit-ppe" ? (
            <PermitSection title="4. Gerekli Kişisel Koruyucu Donanımlar" icon={<HardHat className="h-5 w-5" />} className="bg-gradient-to-r from-violet-600 to-fuchsia-500">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {workPermitPpeItems.map((item) => {
                  const active = record.ppeItems.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => patchRecord({ ppeItems: toggleValue(record.ppeItems, item) })}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-sm font-medium transition",
                        active ? "border-violet-200 bg-violet-500/20 text-white" : "border-slate-600 bg-slate-950/55 text-slate-300 hover:border-violet-300/60 hover:text-white",
                      )}
                    >
                      {active ? "✓ " : ""}
                      {item}
                    </button>
                  );
                })}
              </div>
            </PermitSection>
          ) : null}

          {activeTab === "work-permit-approval" ? (
            <PermitSection title="5. Onay ve İmzalar" icon={<ShieldCheck className="h-5 w-5" />} className="bg-gradient-to-r from-slate-700 to-slate-600">
              <div className="grid gap-5 md:grid-cols-2">
                {record.approvers.map((approver, index) => (
                  <div key={approver.id} className="space-y-3">
                    <div className="space-y-2">
                      <Label>Başlık (PDF'de görünecek)</Label>
                      <Input
                        value={approver.title}
                        onChange={(event) => {
                          const next = record.approvers.map((item) => (item.id === approver.id ? { ...item, title: event.target.value } : item));
                          patchRecord({ approvers: next });
                        }}
                        className={inputClass}
                        placeholder={index === 0 ? "Formen / Mühendis / Şef vb." : "İSG Uzmanı / Amir / Müdür vb."}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ad Soyad</Label>
                      <Input
                        value={approver.fullName}
                        onChange={(event) => {
                          const next = record.approvers.map((item) => (item.id === approver.id ? { ...item, fullName: event.target.value } : item));
                          patchRecord({ approvers: next });
                        }}
                        className={inputClass}
                        placeholder="Ad Soyad"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>İmza Görseli</Label>
                      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-950/55 p-3 text-sm text-blue-200 transition hover:border-cyan-300 hover:bg-cyan-500/10">
                        {approver.signatureDataUrl ? (
                          <img src={approver.signatureDataUrl} alt={`${approver.fullName || "İmza"} imza önizlemesi`} className="max-h-16 max-w-full object-contain" />
                        ) : (
                          <>
                            <Upload className="h-5 w-5" />
                            <span>İmza yüklemek için tıklayın</span>
                            <span className="text-xs text-slate-400">PNG veya JPG, maks. 2 MB</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          className="sr-only"
                          onChange={(event) => handleSignatureUpload(approver.id, event.target.files?.[0])}
                        />
                      </label>
                      {approver.signatureDataUrl ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(approver.id)} className="h-8 px-2 text-xs text-red-200 hover:bg-red-500/10 hover:text-red-100">
                          İmzayı Kaldır
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </PermitSection>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={goToPreviousTab} disabled={activeIndex === 0} className="text-slate-200 hover:bg-white/5 hover:text-white">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Geri
          </Button>
          <div className="flex flex-col gap-2 text-center text-xs text-slate-400 sm:text-left">
            <span>{steps[activeIndex]?.label} sekmesi açık.</span>
            <span>Üstteki adımlara tıklayarak istediğiniz bölüme doğrudan geçebilirsiniz.</span>
          </div>
          <Button type="button" onClick={goToNextTab} disabled={activeIndex === tabOrder.length - 1} className="bg-gradient-to-r from-red-600 to-orange-500 font-bold text-white hover:from-red-500 hover:to-orange-400">
            İleri
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-center gap-2 font-bold">
            <CalendarClock className="h-4 w-4" />
            İzin süresi ve kapsamı
          </div>
          <p>Bu izin formu yalnızca seçilen izin türleri, belirtilen lokasyon, iş detayı ve tarih aralığı için geçerlidir.</p>
        </div>
      </div>
    </div>
  );
}
