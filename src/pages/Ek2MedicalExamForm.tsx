import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  ClipboardPlus,
  Download,
  FileText,
  Loader2,
  Plus,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  anamnesisQuestions,
  applyEk2Company,
  applyEk2Employee,
  createEmptyEk2MedicalExamRecord,
  generateEk2MedicalExamPdf,
  laboratoryItems,
  loadEk2Companies,
  loadEk2Employees,
  physicalExamItems,
  saveEk2MedicalExamRecord,
  validateEk2MedicalExam,
  type Ek2MedicalExamRecord,
  type YesNo,
} from "@/lib/ek2MedicalExam";

const inputClass = "h-9 border-slate-600 bg-slate-900/70 text-white placeholder:text-slate-500 focus:border-cyan-300";
const sectionContentClass = "space-y-4 bg-slate-800 p-5";
const bloodGroupOptions = ["A Rh+", "A Rh-", "B Rh+", "B Rh-", "AB Rh+", "AB Rh-", "0 Rh+", "0 Rh-"];
const educationOptions = ["İlkokul", "Ortaokul", "Lise", "Ön Lisans", "Lisans", "Y.Lisans", "Doktora"];
const maritalStatusOptions = ["Evli", "Bekâr", "Boşanmış", "Dul"];

function Section({
  title,
  icon,
  color,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-xl border-slate-700 bg-slate-800 text-white shadow-xl shadow-black/15">
      <CardHeader className={cn("flex flex-row items-center justify-between px-5 py-3", color)}>
        <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-normal text-white">
          {icon}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className={sectionContentClass}>{children}</CardContent>
    </Card>
  );
}

function YesNoGroup({ value, onChange }: { value: YesNo; onChange: (value: YesNo) => void }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <label className="flex items-center gap-1">
        <input type="radio" checked={value === "no"} onChange={() => onChange("no")} />
        Hayır
      </label>
      <label className="flex items-center gap-1">
        <input type="radio" checked={value === "yes"} onChange={() => onChange("yes")} />
        Evet
      </label>
    </div>
  );
}

export default function Ek2MedicalExamForm() {
  const { user, profile } = useAuth();
  const [record, setRecord] = useState<Ek2MedicalExamRecord>(() => createEmptyEk2MedicalExamRecord(profile?.organization_id || null));
  const [companies, setCompanies] = useState<Awaited<ReturnType<typeof loadEk2Companies>>>([]);
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof loadEk2Employees>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [doublePage, setDoublePage] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([loadEk2Companies(), loadEk2Employees()])
      .then(([companyRows, employeeRows]) => {
        if (!mounted) return;
        setCompanies(companyRows);
        setEmployees(employeeRows);
      })
      .catch((error) => {
        console.error("EK-2 verileri yüklenemedi:", error);
        toast.error("Firma ve çalışan verileri yüklenemedi.");
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

  const companyEmployees = useMemo(
    () => employees.filter((employee) => !record.companyId || employee.companyId === record.companyId),
    [employees, record.companyId],
  );

  const patchRecord = (patch: Partial<Ek2MedicalExamRecord>) => {
    setRecord((current) => ({ ...current, ...patch }));
  };

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    setRecord((current) => applyEk2Company(current, company));
  };

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    setRecord((current) => applyEk2Employee(current, employee));
  };

  const updateEmployee = (patch: Partial<Ek2MedicalExamRecord["employee"]>) => {
    setRecord((current) => ({ ...current, employee: { ...current.employee, ...patch } }));
  };

  const updateMedicalHistory = (key: keyof Ek2MedicalExamRecord["medicalHistory"], value: string) => {
    setRecord((current) => ({ ...current, medicalHistory: { ...current.medicalHistory, [key]: value } }));
  };

  const updateFamily = (key: keyof Ek2MedicalExamRecord["familyHistory"], value: YesNo) => {
    setRecord((current) => ({ ...current, familyHistory: { ...current.familyHistory, [key]: value } }));
  };

  const updateAnamnesis = (key: string, value: YesNo) => {
    setRecord((current) => ({
      ...current,
      anamnesis: { ...current.anamnesis, [key]: value },
      anamnesisNotes: value === "no" ? { ...current.anamnesisNotes, [key]: "" } : current.anamnesisNotes,
    }));
  };

  const updateAnamnesisNote = (key: string, value: string) => {
    setRecord((current) => ({ ...current, anamnesisNotes: { ...current.anamnesisNotes, [key]: value } }));
  };

  const updateSmokingStatus = (value: Ek2MedicalExamRecord["smokingStatus"]) => {
    setRecord((current) => ({
      ...current,
      smokingStatus: value,
      anamnesis: { ...current.anamnesis, "Sigara içiyor musunuz?": value === "no" ? "no" : "yes" },
      smokingDetails: value === "no" ? { quitBefore: "", smokedFor: "", cigarettesPerDay: "" } : current.smokingDetails,
    }));
  };

  const updatePhysicalExam = (key: string, patch: Partial<{ normal: boolean; note: string }>) => {
    setRecord((current) => ({ ...current, physicalExam: { ...current.physicalExam, [key]: { ...current.physicalExam[key], ...patch } } }));
  };

  const updateLaboratory = (key: string, patch: Partial<{ normal: boolean; note: string }>) => {
    setRecord((current) => ({ ...current, laboratory: { ...current.laboratory, [key]: { ...current.laboratory[key], ...patch } } }));
  };

  const updateOpinion = (patch: Partial<Ek2MedicalExamRecord["opinion"]>) => {
    setRecord((current) => ({ ...current, opinion: { ...current.opinion, ...patch } }));
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("Kayıt için oturum açmanız gerekiyor.");
      return;
    }
    const errors = validateEk2MedicalExam(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveEk2MedicalExamRecord(record, user.id, profile?.organization_id || null);
      setRecord((current) => ({ ...current, id: String(saved.id || current.id) }));
      toast.success("EK-2 muayene formu kaydedildi.");
    } catch (error) {
      console.error("EK-2 kaydedilemedi:", error);
      toast.error("EK-2 formu kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async (doctorOpinion = false) => {
    const errors = validateEk2MedicalExam(record);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    setPdfLoading(true);
    try {
      await generateEk2MedicalExamPdf(record, doublePage || doctorOpinion);
      toast.success(doctorOpinion ? "Hekim kanaat raporu hazırlandı." : "Muayene formu hazırlandı.");
    } catch (error) {
      console.error("EK-2 PDF oluşturulamadı:", error);
      toast.error("PDF oluşturulamadı.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6">
        <header className="rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 p-6 shadow-2xl shadow-pink-950/25">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-black">İşe Giriş / Periyodik Muayene Formu</h1>
              <p className="mt-1 text-sm font-semibold text-white/85">EK-2 Muayene Formu</p>
            </div>
          </div>
        </header>

        <Section title="İşyerinin" icon={<Building2 className="h-4 w-4" />} color="bg-slate-700">
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1.3fr_1fr]">
            <div className="space-y-1 lg:col-span-4">
              <Label>Firma Seçin</Label>
              <Select value={record.companyId} onValueChange={handleCompanyChange} disabled={loading}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder={loading ? "Firmalar yükleniyor..." : "Firma seçin"} />
                </SelectTrigger>
                <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Unvanı</Label>
              <Input className={inputClass} value={record.company.name} readOnly />
            </div>
            <div className="space-y-1">
              <Label>SGK Sicil No</Label>
              <Input className={inputClass} value={record.company.workplaceRegistrationNumber} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Adres</Label>
              <Input className={inputClass} value={record.company.address} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Tel / E-posta</Label>
              <Input className={inputClass} value={[record.company.phone, record.company.email].filter(Boolean).join(" / ")} readOnly />
            </div>
            <Input className="lg:col-span-4 h-8 border-blue-500 bg-blue-950/40 text-xs text-blue-100" value={record.workplaceDeclaration} onChange={(event) => patchRecord({ workplaceDeclaration: event.target.value })} />
          </div>
        </Section>

        <Section title="Çalışanın" icon={<UserRound className="h-4 w-4" />} color="bg-blue-600">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1 lg:col-span-3">
              <Label>Çalışan</Label>
              <Select value={record.employeeId} onValueChange={handleEmployeeChange} disabled={!record.companyId}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder={record.companyId ? "Çalışan seçin" : "Önce firma seçin"} />
                </SelectTrigger>
                <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                  {companyEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 lg:col-span-3">
              <Label>Ad Soyad</Label>
              <Input className={inputClass} value={record.employee.fullName} onChange={(event) => updateEmployee({ fullName: event.target.value })} />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label>TC Kimlik No</Label>
              <Input className={inputClass} value={record.employee.tcNumber} onChange={(event) => updateEmployee({ tcNumber: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Tel No</Label>
              <Input className={inputClass} value={record.employee.phone} onChange={(event) => updateEmployee({ phone: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Cinsiyet</Label>
              <Select value={record.employee.gender || "Belirtilmedi"} onValueChange={(value) => updateEmployee({ gender: value === "Belirtilmedi" ? "" : value })}>
                <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                <SelectContent className="z-[80] border-slate-700 bg-slate-950 text-white">
                  {["Belirtilmedi", "Erkek", "Kadın", "Diğer"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Doğum Yeri</Label>
              <Input className={inputClass} value={record.birthPlace} onChange={(event) => patchRecord({ birthPlace: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Doğum Tarihi</Label>
              <Input type="date" className={cn(inputClass, "[color-scheme:dark]")} value={record.employee.birthDate} onChange={(event) => updateEmployee({ birthDate: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Eğitim</Label>
              <Select value={record.education || "none"} onValueChange={(value) => patchRecord({ education: value === "none" ? "" : value })}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent className="z-[80] border-slate-700 bg-slate-800 text-white">
                  <SelectItem value="none">Seçin</SelectItem>
                  {educationOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Medeni Hali</Label>
              <Select value={record.maritalStatus || "none"} onValueChange={(value) => patchRecord({ maritalStatus: value === "none" ? "" : value })}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent className="z-[80] border-slate-700 bg-slate-800 text-white">
                  <SelectItem value="none">Seçin</SelectItem>
                  {maritalStatusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Çocuk</Label>
              <Input className={inputClass} value={record.children} onChange={(event) => patchRecord({ children: event.target.value })} />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label>Ev Adresi</Label>
              <Input className={inputClass} value={record.employee.address} onChange={(event) => updateEmployee({ address: event.target.value })} />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label>Mesleği</Label>
              <Input className={inputClass} value={record.employee.jobTitle} onChange={(event) => updateEmployee({ jobTitle: event.target.value })} />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label>Yaptığı İş</Label>
              <Input className={inputClass} value={record.employee.jobTitle} onChange={(event) => updateEmployee({ jobTitle: event.target.value })} />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label>Çalıştığı Bölüm</Label>
              <Input className={inputClass} value={record.employee.department} onChange={(event) => updateEmployee({ department: event.target.value })} />
            </div>
          </div>
        </Section>

        <Section title="Özgeçmişi" icon={<ClipboardPlus className="h-4 w-4" />} color="bg-emerald-600">
          <div className="grid gap-3 md:grid-cols-5">
            {[
              ["bloodType", "Kan Grubu"],
              ["congenitalChronicDisease", "Konjenital/Kronik Hastalık"],
              ["tetanus", "Tetanoz"],
              ["hepatitis", "Hepatit"],
              ["other", "Diğer"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                {key === "bloodType" ? (
                  <Select value={record.medicalHistory.bloodType || "none"} onValueChange={(value) => updateMedicalHistory("bloodType", value === "none" ? "" : value)}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent className="z-[80] border-slate-700 bg-slate-800 text-white">
                      <SelectItem value="none">Seçin</SelectItem>
                      {bloodGroupOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input className={inputClass} value={record.medicalHistory[key as keyof typeof record.medicalHistory]} onChange={(event) => updateMedicalHistory(key as keyof typeof record.medicalHistory, event.target.value)} />
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Soy Geçmişi" icon={<UserRound className="h-4 w-4" />} color="bg-violet-600">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["mother", "Anne"],
              ["father", "Baba"],
              ["sibling", "Kardeş"],
              ["child", "Çocuk"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <YesNoGroup value={record.familyHistory[key as keyof typeof record.familyHistory]} onChange={(value) => updateFamily(key as keyof typeof record.familyHistory, value)} />
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Tıbbi Anamnez"
          icon={<Stethoscope className="h-4 w-4" />}
          color="bg-orange-600"
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                type="button"
                className="h-7 bg-white/20 text-xs text-white hover:bg-white/30"
                onClick={() =>
                  patchRecord({
                    anamnesis: Object.fromEntries(anamnesisQuestions.map((item) => [item, "no" as YesNo])),
                    anamnesisNotes: {},
                    smokingStatus: "no",
                    smokingDetails: { quitBefore: "", smokedFor: "", cigarettesPerDay: "" },
                    alcoholDetails: { years: "", frequency: "" },
                    disabilityDetails: { reasonAndRate: "" },
                  })
                }
              >
                Tümünü Hayır
              </Button>
              <Button
                size="sm"
                type="button"
                className="h-7 bg-white/20 text-xs text-white hover:bg-white/30"
                onClick={() => patchRecord({ anamnesis: Object.fromEntries(anamnesisQuestions.map((item) => [item, "yes" as YesNo])), smokingStatus: "yes" })}
              >
                Tümünü Evet
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {anamnesisQuestions.map((question, index) => (
              <div key={question} className={cn("space-y-2 rounded-lg px-3 py-2 text-sm", index > 16 && "bg-slate-700/55")}>
                <div className="flex items-center justify-between gap-3">
                  <span>{index + 1}. {question}</span>
                  {question === "Sigara içiyor musunuz?" ? (
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={record.smokingStatus === "no"} onChange={() => updateSmokingStatus("no")} />
                        Hayır
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={record.smokingStatus === "quit"} onChange={() => updateSmokingStatus("quit")} />
                        Bırakmış
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={record.smokingStatus === "yes"} onChange={() => updateSmokingStatus("yes")} />
                        Evet
                      </label>
                    </div>
                  ) : (
                    <YesNoGroup value={record.anamnesis[question]} onChange={(value) => updateAnamnesis(question, value)} />
                  )}
                </div>
                {question === "Sigara içiyor musunuz?" && record.smokingStatus === "quit" ? (
                  <div className="grid gap-2 md:grid-cols-3">
                    <Input
                      className={inputClass}
                      placeholder="Ay/Yıl Önce"
                      value={record.smokingDetails.quitBefore}
                      onChange={(event) => patchRecord({ smokingDetails: { ...record.smokingDetails, quitBefore: event.target.value } })}
                    />
                    <Input
                      className={inputClass}
                      placeholder="Ay/Yıl İçmiş"
                      value={record.smokingDetails.smokedFor}
                      onChange={(event) => patchRecord({ smokingDetails: { ...record.smokingDetails, smokedFor: event.target.value } })}
                    />
                    <Input
                      className={inputClass}
                      placeholder="Adet/Gün İçmiş"
                      value={record.smokingDetails.cigarettesPerDay}
                      onChange={(event) => patchRecord({ smokingDetails: { ...record.smokingDetails, cigarettesPerDay: event.target.value } })}
                    />
                  </div>
                ) : null}
                {question === "Alkol alıyor musunuz?" && record.anamnesis[question] === "yes" ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      className={inputClass}
                      placeholder="Kaç Yıldır"
                      value={record.alcoholDetails.years}
                      onChange={(event) => patchRecord({ alcoholDetails: { ...record.alcoholDetails, years: event.target.value } })}
                    />
                    <Input
                      className={inputClass}
                      placeholder="Ne Sıklıkla"
                      value={record.alcoholDetails.frequency}
                      onChange={(event) => patchRecord({ alcoholDetails: { ...record.alcoholDetails, frequency: event.target.value } })}
                    />
                  </div>
                ) : null}
                {question === "Maluliyet aldınız mı?" && record.anamnesis[question] === "yes" ? (
                  <Input
                    className={inputClass}
                    placeholder="Nedeni ve oranı"
                    value={record.disabilityDetails.reasonAndRate}
                    onChange={(event) => patchRecord({ disabilityDetails: { ...record.disabilityDetails, reasonAndRate: event.target.value } })}
                  />
                ) : null}
                {question !== "Sigara içiyor musunuz?" && question !== "Alkol alıyor musunuz?" && question !== "Maluliyet aldınız mı?" && record.anamnesis[question] === "yes" ? (
                  <Input
                    className={inputClass}
                    placeholder="Açıklama"
                    value={record.anamnesisNotes[question] || ""}
                    onChange={(event) => updateAnamnesisNote(question, event.target.value)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Fizik Muayene Sonuçları" icon={<Stethoscope className="h-4 w-4" />} color="bg-cyan-600">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {physicalExamItems.map((item) => (
              <div key={item} className="space-y-1">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={record.physicalExam[item]?.normal || false} onChange={(event) => updatePhysicalExam(item, { normal: event.target.checked })} />
                  {item}
                </label>
                <Input className={inputClass} placeholder="Açıklama" value={record.physicalExam[item]?.note || ""} onChange={(event) => updatePhysicalExam(item, { note: event.target.value })} />
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              ["bloodPressure", "Tansiyon (TA)"],
              ["pulse", "Nabız (Nb)"],
              ["height", "Boy (cm)"],
              ["weight", "Kilo (kg)"],
              ["bmi", "VKİ"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input className={inputClass} value={record.vitals[key as keyof typeof record.vitals]} onChange={(event) => patchRecord({ vitals: { ...record.vitals, [key]: event.target.value } })} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Laboratuvar Bulguları" icon={<Stethoscope className="h-4 w-4" />} color="bg-indigo-600">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {laboratoryItems.map((item) => (
              <div key={item} className="space-y-1">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={record.laboratory[item]?.normal || false} onChange={(event) => updateLaboratory(item, { normal: event.target.checked })} />
                  {item}
                </label>
                <Input className={inputClass} placeholder="Açıklama" value={record.laboratory[item]?.note || ""} onChange={(event) => updateLaboratory(item, { note: event.target.value })} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Kanaat ve Sonuç" icon={<Check className="h-4 w-4" />} color="bg-green-600">
          <div className="space-y-3">
            <button type="button" onClick={() => updateOpinion({ fit: true, conditionalFit: false })} className={cn("w-full rounded-lg border p-4 text-sm", record.opinion.fit ? "border-emerald-300 bg-emerald-500/15" : "border-slate-600 bg-slate-900/60")}>
              ................. işinde bedenen ve ruhen çalışmaya elverişlidir.
            </button>
            <button type="button" onClick={() => updateOpinion({ fit: false, conditionalFit: true })} className={cn("w-full rounded-lg border p-4 text-sm", record.opinion.conditionalFit ? "border-amber-300 bg-amber-500/15" : "border-slate-600 bg-slate-900/60")}>
              ................. şartıyla çalışmaya elverişlidir.
            </button>
            <div className="grid gap-3 rounded-lg border border-slate-600 bg-slate-900/60 p-3 md:grid-cols-3">
              {[
                ["canWorkAtHeight", "Yüksekte Çalışabilir"],
                ["canWorkVeryDangerous", "Çok Tehlikeli İşlerde Çalışabilir"],
                ["canWorkNight", "Gece Çalışabilir"],
                ["heavyDangerousWorks", "Ağır ve Tehlikeli İşler"],
                ["shiftWork", "Vardiyalı İşler"],
                ["confinedSpace", "Kapalı Alanda"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(record.opinion[key as keyof typeof record.opinion])} onChange={(event) => updateOpinion({ [key]: event.target.checked } as Partial<typeof record.opinion>)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Muayene / Düzenleme Tarihi</Label>
              <Input type="date" className={cn(inputClass, "[color-scheme:dark]")} value={record.opinion.date} onChange={(event) => updateOpinion({ date: event.target.value })} />
            </div>
          </div>
        </Section>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => setDoublePage(false)} className={cn("bg-pink-600 text-white hover:bg-pink-500", !doublePage && "ring-2 ring-white/30")}>Tek Sayfa</Button>
          <Button type="button" onClick={() => setDoublePage(true)} className={cn("bg-slate-700 text-white hover:bg-slate-600", doublePage && "ring-2 ring-white/30")}>Çift Sayfa</Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="ml-auto bg-slate-700 text-white hover:bg-slate-600">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Kaydet
          </Button>
          <Button type="button" onClick={() => handlePdf(false)} disabled={pdfLoading} className="bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:from-pink-500 hover:to-rose-500">
            {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Muayene Formu Oluştur
          </Button>
          <Button type="button" onClick={() => handlePdf(true)} disabled={pdfLoading} className="bg-emerald-600 text-white hover:bg-emerald-500">
            <CalendarDays className="mr-2 h-4 w-4" />
            Hekim Kanaat Raporu
          </Button>
        </div>

        <div className="rounded-xl border border-pink-500/70 bg-pink-950/30 p-4 text-sm text-pink-100">
          <strong className="text-pink-200">Muayene Formu (EK-2) Hakkında</strong>
          <p className="mt-2">
            İşe giriş ve periyodik muayene formu, 6331 sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında çalışanların sağlık durumlarının değerlendirilmesi için kullanılan resmi bir belgedir.
          </p>
        </div>
      </div>
    </div>
  );
}
