import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  ClipboardList,
  Download,
  ExternalLink,
  FileCheck2,
  Loader2,
  MapPinned,
  PackagePlus,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_ADEP_PLAN_DATA,
  HAZARD_CLASSES,
  mergeADEPPlanData,
  toCoreADEPPlanData,
  type ADEPPlanData,
  type ADEPTeamKey,
  type ADEPPerson,
  type ADEPMaterial,
  type HazardClass,
} from "@/lib/adepPlanSchema";
import {
  loadSavedEvacuationProjects,
  type SavedEvacuationProject,
} from "@/lib/evacuationProjectStorage";

type WizardTab = "company" | "professionals" | "teams" | "inventory";

interface CompanyOption {
  id: string;
  name: string;
  address?: string | null;
  employee_count?: number | null;
  industry?: string | null;
  hazard_class?: string | null;
  tax_number?: string | null;
  phone?: string | null;
}

const inputClassName =
  "border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20";

const mutedInputClassName =
  "border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500 focus-visible:border-amber-400 focus-visible:ring-amber-400/20";

const createPerson = (): ADEPPerson => ({ ad_soyad: "", tc_no: "", telefon: "" });
const createMaterial = (): ADEPMaterial => ({ equipment_name: "", quantity: "", location: "" });

const teamMeta: Array<{ key: ADEPTeamKey; title: string; description: string }> = [
  {
    key: "sondurme",
    title: "Söndürme Ekibi",
    description: "Yangın ve ilk müdahale organizasyonundan sorumlu ekip.",
  },
  {
    key: "kurtarma",
    title: "Kurtarma Ekibi",
    description: "Tahliye, arama ve kurtarma adımlarında görevli ekip.",
  },
  {
    key: "koruma",
    title: "Koruma Ekibi",
    description: "Alan güvenliği ve yönlendirme süreçlerinde görevli ekip.",
  },
  {
    key: "ilkyardim",
    title: "İlkyardım Ekibi",
    description: "İlk yardım desteği ve sağlık yönlendirmesi için görevli ekip.",
  },
];

export default function ADEPWizard() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<WizardTab>("company");
  const [planId, setPlanId] = useState<string | null>(searchParams.get("id"));
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(searchParams.get("companyId"));
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [savedSketches, setSavedSketches] = useState<SavedEvacuationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planData, setPlanData] = useState<ADEPPlanData>(DEFAULT_ADEP_PLAN_DATA);

  const activeWorkspaceId = ((profile as any)?.active_workspace_id || profile?.organization_id || null) as string | null;

  const planName = useMemo(() => {
    const company = planData.firma_bilgileri.unvan || "Firma";
    return `${company} Acil Durum Eylem Planı`;
  }, [planData.firma_bilgileri.unvan]);

  useEffect(() => {
    setSavedSketches(loadSavedEvacuationProjects());
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      toast.error("ADEP hazırlamak için giriş yapmanız gerekiyor.");
      navigate("/auth");
      return;
    }

    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [companiesRes, planRes] = await Promise.all([
          (supabase as any)
            .from("companies")
            .select("id, name, address, employee_count, industry, hazard_class, tax_number, phone")
            .eq("is_active", true)
            .order("name"),
          planId
            ? supabase.from("adep_plans").select("*").eq("id", planId).single()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (companiesRes.error) throw companiesRes.error;
        const companyRows = (companiesRes.data || []) as CompanyOption[];
        setCompanies(companyRows);

        if (planRes.error) throw planRes.error;
        if (planRes.data) {
          const row = planRes.data as any;
          const nextData = mergeADEPPlanData(row.plan_data);
          setPlanData(nextData);
          setSelectedCompanyId(row.company_id || selectedCompanyId);
          return;
        }

        const routeCompany = selectedCompanyId
          ? companyRows.find((company) => company.id === selectedCompanyId)
          : null;
        if (routeCompany) {
          applyCompany(routeCompany, false);
        }
      } catch (error: any) {
        console.error("ADEP load failed:", error);
        toast.error("ADEP verisi yüklenemedi", {
          description: error?.message || "Beklenmeyen hata",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, planId]);

  const updatePlanData = (updater: (previous: ADEPPlanData) => ADEPPlanData) => {
    setPlanData((previous) => mergeADEPPlanData(updater(previous)));
  };

  const applyCompany = (company: CompanyOption, showToast = true) => {
    setSelectedCompanyId(company.id);
    updatePlanData((previous) => ({
      ...previous,
      firma_bilgileri: {
        ...previous.firma_bilgileri,
        unvan: company.name || "",
        adres: company.address || "",
        sgk_sicil_no: company.tax_number || previous.firma_bilgileri.sgk_sicil_no,
        tehlike_sinifi:
          HAZARD_CLASSES.find((hazardClass) => hazardClass === company.hazard_class) ||
          previous.firma_bilgileri.tehlike_sinifi,
        calisan_sayisi: company.employee_count || 0,
      },
    }));

    const nextParams = new URLSearchParams(searchParams);
    if (planId) nextParams.set("id", planId);
    nextParams.set("companyId", company.id);
    setSearchParams(nextParams, { replace: true });

    if (showToast) toast.success("Firma bilgileri forma aktarıldı");
  };

  const updateCompanyField = <K extends keyof ADEPPlanData["firma_bilgileri"]>(
    field: K,
    value: ADEPPlanData["firma_bilgileri"][K],
  ) => {
    updatePlanData((previous) => ({
      ...previous,
      firma_bilgileri: {
        ...previous.firma_bilgileri,
        [field]: value,
      },
    }));
  };

  const updateOsgbField = <K extends keyof ADEPPlanData["osgb_bilgileri"]>(
    field: K,
    value: ADEPPlanData["osgb_bilgileri"][K],
  ) => {
    updatePlanData((previous) => ({
      ...previous,
      osgb_bilgileri: {
        ...previous.osgb_bilgileri,
        [field]: value,
      },
    }));
  };

  const updateGeneralField = <K extends keyof ADEPPlanData["genel_bilgiler"]>(
    field: K,
    value: ADEPPlanData["genel_bilgiler"][K],
  ) => {
    updatePlanData((previous) => ({
      ...previous,
      genel_bilgiler: {
        ...previous.genel_bilgiler,
        [field]: value,
      },
    }));
  };

  const updatePerson = (
    group: "yetkililer",
    role: keyof ADEPPlanData["yetkililer"],
    field: string,
    value: string,
  ) => {
    updatePlanData((previous) => ({
      ...previous,
      [group]: {
        ...previous[group],
        [role]: {
          ...previous[group][role],
          [field]: value,
        },
      },
    }));
  };

  const updateTeamLeader = (teamKey: ADEPTeamKey, field: keyof ADEPPerson, value: string) => {
    updatePlanData((previous) => ({
      ...previous,
      ekipler: {
        ...previous.ekipler,
        [teamKey]: {
          ...previous.ekipler[teamKey],
          ekip_baskani: {
            ...previous.ekipler[teamKey].ekip_baskani,
            [field]: value,
          },
        },
      },
    }));
  };

  const updateTeamMember = (teamKey: ADEPTeamKey, index: number, field: keyof ADEPPerson, value: string) => {
    updatePlanData((previous) => {
      const nextMembers = [...previous.ekipler[teamKey].uyeler];
      nextMembers[index] = { ...nextMembers[index], [field]: value };
      return {
        ...previous,
        ekipler: {
          ...previous.ekipler,
          [teamKey]: {
            ...previous.ekipler[teamKey],
            uyeler: nextMembers,
          },
        },
      };
    });
  };

  const addTeamMember = (teamKey: ADEPTeamKey) => {
    updatePlanData((previous) => ({
      ...previous,
      ekipler: {
        ...previous.ekipler,
        [teamKey]: {
          ...previous.ekipler[teamKey],
          uyeler: [...previous.ekipler[teamKey].uyeler, createPerson()],
        },
      },
    }));
  };

  const removeTeamMember = (teamKey: ADEPTeamKey, index: number) => {
    updatePlanData((previous) => ({
      ...previous,
      ekipler: {
        ...previous.ekipler,
        [teamKey]: {
          ...previous.ekipler[teamKey],
          uyeler: previous.ekipler[teamKey].uyeler.filter((_, memberIndex) => memberIndex !== index),
        },
      },
    }));
  };

  const updateMaterial = (index: number, field: keyof ADEPMaterial, value: string) => {
    updatePlanData((previous) => {
      const materials = [...previous.malzeme_envanteri];
      materials[index] = { ...materials[index], [field]: value };
      return { ...previous, malzeme_envanteri: materials };
    });
  };

  const addMaterial = () => {
    updatePlanData((previous) => ({
      ...previous,
      malzeme_envanteri: [...previous.malzeme_envanteri, createMaterial()],
    }));
  };

  const removeMaterial = (index: number) => {
    updatePlanData((previous) => ({
      ...previous,
      malzeme_envanteri: previous.malzeme_envanteri.filter((_, materialIndex) => materialIndex !== index),
    }));
  };

  const handleSketchSelection = (projectId: string) => {
    updatePlanData((previous) => {
      if (projectId === "__none__") {
        return {
          ...previous,
          ekler: {
            ...previous.ekler,
            secili_kroki: null,
          },
        };
      }

      const selectedProject = savedSketches.find((project) => project.id === projectId);
      if (!selectedProject) {
        return previous;
      }

      return {
        ...previous,
        ekler: {
          ...previous.ekler,
          secili_kroki: {
            id: selectedProject.id,
            project_name: selectedProject.project_name,
            thumbnail_data_url: selectedProject.thumbnail_data_url || "",
            created_at: selectedProject.created_at,
          },
        },
      };
    });
  };

  const savePlan = async () => {
    if (!user) return null;
    if (!planData.firma_bilgileri.unvan.trim()) {
      toast.error("Firma ünvanı zorunludur.");
      setActiveTab("company");
      return null;
    }

    setSaving(true);
    try {
      const normalizedData = mergeADEPPlanData(planData);
      const payload = {
        user_id: user.id,
        company_id: selectedCompanyId,
        org_id: activeWorkspaceId,
        plan_name: planName,
        company_name: normalizedData.firma_bilgileri.unvan,
        sector: null,
        hazard_class: normalizedData.firma_bilgileri.tehlike_sinifi,
        employee_count: normalizedData.firma_bilgileri.calisan_sayisi,
        status: "draft",
        completion_percentage: 100,
        plan_data: toCoreADEPPlanData(normalizedData) as any,
        next_review_date: normalizedData.genel_bilgiler.gecerlilik_tarihi || null,
      };

      const query = planId
        ? supabase.from("adep_plans").update(payload).eq("id", planId).select().single()
        : supabase.from("adep_plans").insert(payload).select().single();

      const { data, error } = await query;
      if (error) throw error;

      const savedId = (data as any).id as string;
      setPlanId(savedId);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("id", savedId);
      if (selectedCompanyId) nextParams.set("companyId", selectedCompanyId);
      setSearchParams(nextParams, { replace: true });
      toast.success("ADEP taslağı kaydedildi");
      return savedId;
    } catch (error: any) {
      console.error("ADEP save failed:", error);
      toast.error("ADEP kaydedilemedi", {
        description: error?.message || "Beklenmeyen hata",
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const downloadWordReport = async () => {
    const savedId = await savePlan();
    if (!savedId) return;

    try {
      toast.info("Resmi Word raporu hazırlanıyor...");
      const { downloadADEPWordDocument } = await import("@/lib/adepOfficialDocx");
      await downloadADEPWordDocument(savedId);
      toast.success("Word raporu indirildi");
    } catch (error: any) {
      console.error("ADEP Word export failed:", error);
      toast.error("Word raporu oluşturulamadı", {
        description: error?.message || "Beklenmeyen hata",
      });
    }
  };

  const teamMemberCount = teamMeta.reduce((total, team) => total + planData.ekipler[team.key].uyeler.length + 1, 0);
  const materialCount = planData.malzeme_envanteri.filter((item) => item.equipment_name.trim()).length;

  if (loading || authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-5 py-4 text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          ADEP formu hazırlanıyor...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a_52%,#111827)] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="overflow-hidden border-cyan-400/20 bg-slate-950/80 shadow-[0_24px_80px_rgba(8,47,73,0.35)]">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Badge className="w-fit border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                  Resmi Word Şablonu
                </Badge>
                <div>
                  <h1 className="text-3xl font-bold tracking-[-0.04em] md:text-4xl">
                    Acil Durum Eylem Planı
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                    Sadece resmi şablonda gerekli olan firma, OSGB, yetkili, ekip ve malzeme bilgilerini doldurun;
                    sistem Word raporunu hazır formatta oluştursun.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[430px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Firma</div>
                  <div className="mt-2 truncate text-sm font-semibold">{planData.firma_bilgileri.unvan || "Seçilmedi"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Ekip Kişisi</div>
                  <div className="mt-2 text-sm font-semibold">{teamMemberCount}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Malzeme</div>
                  <div className="mt-2 text-sm font-semibold">{materialCount}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WizardTab)} className="space-y-5">
          <TabsList className="grid h-auto grid-cols-1 gap-2 rounded-[24px] border border-white/10 bg-slate-950/70 p-2 md:grid-cols-4">
            <TabsTrigger value="company" className="gap-2 rounded-2xl py-3 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
              <Building2 className="h-4 w-4" />
              Firma & OSGB
            </TabsTrigger>
            <TabsTrigger value="professionals" className="gap-2 rounded-2xl py-3 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
              <ShieldCheck className="h-4 w-4" />
              Yetkililer
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2 rounded-2xl py-3 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
              <Users className="h-4 w-4" />
              Ekipler
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2 rounded-2xl py-3 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
              <ClipboardList className="h-4 w-4" />
              Envanter & İndir
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-white/10 bg-slate-950/75 text-white">
                <CardHeader>
                  <CardTitle>Firma Bilgileri</CardTitle>
                  <CardDescription className="text-slate-400">
                    Kayıtlı firmadan otomatik doldurabilir veya alanları manuel düzenleyebilirsiniz.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Kayıtlı Firma Seç</Label>
                    <Select
                      value={selectedCompanyId || ""}
                      onValueChange={(companyId) => {
                        const company = companies.find((item) => item.id === companyId);
                        if (company) applyCompany(company);
                      }}
                    >
                      <SelectTrigger className={inputClassName}>
                        <SelectValue placeholder="Sistemdeki aktif firmalardan seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Firma Ünvanı">
                      <Input className={inputClassName} value={planData.firma_bilgileri.unvan} onChange={(event) => updateCompanyField("unvan", event.target.value)} />
                    </Field>
                    <Field label="SGK Sicil No">
                      <Input className={inputClassName} value={planData.firma_bilgileri.sgk_sicil_no} onChange={(event) => updateCompanyField("sgk_sicil_no", event.target.value)} />
                    </Field>
                  </div>

                  <Field label="Firma Adresi">
                    <Textarea className={`${inputClassName} min-h-[96px]`} value={planData.firma_bilgileri.adres} onChange={(event) => updateCompanyField("adres", event.target.value)} />
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tehlike Sınıfı">
                      <Select value={planData.firma_bilgileri.tehlike_sinifi} onValueChange={(value) => updateCompanyField("tehlike_sinifi", value as HazardClass)}>
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HAZARD_CLASSES.map((hazardClass) => (
                            <SelectItem key={hazardClass} value={hazardClass}>
                              {hazardClass}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Çalışan Sayısı">
                      <Input type="number" min={0} className={inputClassName} value={planData.firma_bilgileri.calisan_sayisi} onChange={(event) => updateCompanyField("calisan_sayisi", Number(event.target.value || 0))} />
                    </Field>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-950/75 text-white">
                <CardHeader>
                  <CardTitle>OSGB ve Belge Bilgileri</CardTitle>
                  <CardDescription className="text-slate-400">
                    Word şablonundaki kapak ve OSGB bilgi tabloları bu alanlardan dolar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Plan Başlığı">
                      <Input className={inputClassName} value={planData.genel_bilgiler.plan_basligi} onChange={(event) => updateGeneralField("plan_basligi", event.target.value)} />
                    </Field>
                    <Field label="Alt Başlık">
                      <Input className={inputClassName} value={planData.genel_bilgiler.plan_alt_basligi} onChange={(event) => updateGeneralField("plan_alt_basligi", event.target.value)} />
                    </Field>
                    <Field label="Hazırlanma Tarihi">
                      <Input type="date" className={inputClassName} value={planData.genel_bilgiler.hazirlanma_tarihi} onChange={(event) => updateGeneralField("hazirlanma_tarihi", event.target.value)} />
                    </Field>
                    <Field label="Geçerlilik Tarihi">
                      <Input type="date" className={inputClassName} value={planData.genel_bilgiler.gecerlilik_tarihi} onChange={(event) => updateGeneralField("gecerlilik_tarihi", event.target.value)} />
                    </Field>
                  </div>

                  <Field label="OSGB Ünvanı">
                    <Input className={mutedInputClassName} value={planData.osgb_bilgileri.unvan} onChange={(event) => updateOsgbField("unvan", event.target.value)} />
                  </Field>
                  <Field label="OSGB Adresi">
                    <Textarea className={`${mutedInputClassName} min-h-[82px]`} value={planData.osgb_bilgileri.adres} onChange={(event) => updateOsgbField("adres", event.target.value)} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="OSGB Telefon">
                      <Input className={mutedInputClassName} value={planData.osgb_bilgileri.telefon} onChange={(event) => updateOsgbField("telefon", event.target.value)} />
                    </Field>
                    <Field label="İletişim Bilgisi">
                      <Input className={mutedInputClassName} placeholder="web sitesi / e-posta" value={planData.osgb_bilgileri.iletisim_bilgisi} onChange={(event) => updateOsgbField("iletisim_bilgisi", event.target.value)} />
                    </Field>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-cyan-400/20 bg-slate-950/75 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPinned className="h-5 w-5 text-cyan-300" />
                  Ek-9 İşyeri Krokisi
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Tahliye Kroki Editörü&apos;nde kaydettiğiniz krokilerden birini seçin. Seçilen kroki Word çıktısında
                  otomatik olarak <span className="font-medium text-cyan-200">Ek-9 : İşyeri Krokisi</span> bölümüne eklenir.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <Field label="Kaydedilmiş Kroki Seç">
                    <Select
                      value={planData.ekler.secili_kroki?.id || "__none__"}
                      onValueChange={handleSketchSelection}
                    >
                      <SelectTrigger className={inputClassName}>
                        <SelectValue placeholder="Sistemden bir kroki seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Kroki bağlı değil</SelectItem>
                        {savedSketches.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.project_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {savedSketches.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                      Henüz kayıtlı kroki bulunamadı. Önce Tahliye Kroki Editörü&apos;nde bir kroki oluşturup kaydedin.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-sm text-slate-300">
                      Seçilen kroki bu plan kaydıyla birlikte saklanır ve Word çıktısında otomatik kullanılır.
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-cyan-400/30 bg-cyan-500/5 text-cyan-100 hover:bg-cyan-500/10"
                    onClick={() => navigate("/evacuation-editor/history")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Kroki Geçmişlerini Aç
                  </Button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                  {planData.ekler.secili_kroki?.thumbnail_data_url ? (
                    <div className="space-y-3">
                      <img
                        src={planData.ekler.secili_kroki.thumbnail_data_url}
                        alt={planData.ekler.secili_kroki.project_name}
                        className="h-52 w-full rounded-2xl object-cover"
                      />
                      <div className="space-y-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {planData.ekler.secili_kroki.project_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          Kaydedildi: {new Date(planData.ekler.secili_kroki.created_at).toLocaleString("tr-TR")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[208px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-slate-400">
                      Seçilen krokinin önizlemesi burada gösterilir.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="professionals">
            <div className="grid gap-5 lg:grid-cols-3">
              <PersonCard title="İşveren / İşveren Vekili" description="İmza ve detaylı kimlik kartında kullanılacak kişi.">
                <PersonFields person={planData.yetkililer.isveren_vekil} onChange={(field, value) => updatePerson("yetkililer", "isveren_vekil", field, value)} />
              </PersonCard>
              <PersonCard title="İş Güvenliği Uzmanı" description="Sertifika numarası Word şablonunda ayrıca basılır.">
                <PersonFields person={planData.yetkililer.isg_uzmani} showCertificate onChange={(field, value) => updatePerson("yetkililer", "isg_uzmani", field, value)} />
              </PersonCard>
              <PersonCard title="İşyeri Hekimi" description="Sertifika numarası Word şablonunda ayrıca basılır.">
                <PersonFields person={planData.yetkililer.isyeri_hekimi} showCertificate onChange={(field, value) => updatePerson("yetkililer", "isyeri_hekimi", field, value)} />
              </PersonCard>
            </div>
          </TabsContent>

          <TabsContent value="teams">
            <div className="grid gap-5 xl:grid-cols-2">
              {teamMeta.map((team) => (
                <Card key={team.key} className="border-white/10 bg-slate-950/75 text-white">
                  <CardHeader>
                    <CardTitle>{team.title}</CardTitle>
                    <CardDescription className="text-slate-400">{team.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                      <div className="mb-3 text-sm font-semibold text-cyan-100">Ekip Başkanı</div>
                      <PersonFields person={planData.ekipler[team.key].ekip_baskani} compact onChange={(field, value) => updateTeamLeader(team.key, field as keyof ADEPPerson, value)} />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Ekip Üyeleri</div>
                          <div className="text-xs text-slate-500">Gerektiği kadar üye ekleyebilirsiniz.</div>
                        </div>
                        <Button type="button" size="sm" onClick={() => addTeamMember(team.key)} className="gap-2 bg-cyan-500 text-white hover:bg-cyan-600">
                          <Plus className="h-4 w-4" />
                          Üye Ekle
                        </Button>
                      </div>

                      {planData.ekipler[team.key].uyeler.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-center text-sm text-slate-400">
                          Henüz üye eklenmedi.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {planData.ekipler[team.key].uyeler.map((member, index) => (
                            <div key={`${team.key}-${index}`} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_150px_150px_auto]">
                              <Input className={inputClassName} placeholder="Ad Soyad" value={member.ad_soyad} onChange={(event) => updateTeamMember(team.key, index, "ad_soyad", event.target.value)} />
                              <Input className={inputClassName} placeholder="T.C. Kimlik No" value={member.tc_no} onChange={(event) => updateTeamMember(team.key, index, "tc_no", event.target.value)} />
                              <Input className={inputClassName} placeholder="Telefon" value={member.telefon} onChange={(event) => updateTeamMember(team.key, index, "telefon", event.target.value)} />
                              <Button type="button" variant="outline" size="icon" onClick={() => removeTeamMember(team.key, index)} className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-5">
            <Card className="border-white/10 bg-slate-950/75 text-white">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Malzeme Envanteri</CardTitle>
                  <CardDescription className="text-slate-400">
                    Şablondaki Malzeme | Miktar/Yer | Malzeme | Miktar/Yer tablosuna ikili düzenle basılır.
                  </CardDescription>
                </div>
                <Button type="button" onClick={addMaterial} className="gap-2 bg-cyan-500 text-white hover:bg-cyan-600">
                  <PackagePlus className="h-4 w-4" />
                  Yeni Malzeme Ekle
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {planData.malzeme_envanteri.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-slate-400">
                    Henüz malzeme eklenmedi. Envanter tablosu boş olarak hazırlanır.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {planData.malzeme_envanteri.map((material, index) => (
                      <div key={index} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_170px_220px_auto]">
                        <Input className={inputClassName} placeholder="Malzeme adı" value={material.equipment_name} onChange={(event) => updateMaterial(index, "equipment_name", event.target.value)} />
                        <Input className={inputClassName} placeholder="Miktar" value={material.quantity} onChange={(event) => updateMaterial(index, "quantity", event.target.value)} />
                        <Input className={inputClassName} placeholder="Konum / yer" value={material.location || ""} onChange={(event) => updateMaterial(index, "location", event.target.value)} />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeMaterial(index)} className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Field label="Acil Toplanma Alanı Açıklaması">
                  <Textarea
                    className={`${inputClassName} min-h-[92px]`}
                    value={planData.toplanma_alani}
                    onChange={(event) => updatePlanData((previous) => ({ ...previous, toplanma_alani: event.target.value }))}
                  />
                </Field>

                <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/5 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-cyan-100">
                        <FileCheck2 className="h-5 w-5" />
                        <span className="font-semibold">Rapor Hazır mı?</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        Firma, yetkililer, ekip başkanları ve envanter bilgileri resmi Word şablonundaki ilgili tablolara basılır.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button type="button" variant="outline" disabled={saving} onClick={savePlan} className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Kaydet
                      </Button>
                      <Button type="button" disabled={saving} onClick={downloadWordReport} className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Word Olarak Raporu İndir
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-200">{label}</Label>
      {children}
    </div>
  );
}

function PersonCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-slate-950/75 text-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PersonFields({
  person,
  showCertificate = false,
  compact = false,
  onChange,
}: {
  person: ADEPPerson & { belge_no?: string };
  showCertificate?: boolean;
  compact?: boolean;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className={`grid gap-3 ${compact ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
      <Input className={inputClassName} placeholder="Ad Soyad" value={person.ad_soyad} onChange={(event) => onChange("ad_soyad", event.target.value)} />
      <Input className={inputClassName} placeholder="T.C. Kimlik No" value={person.tc_no} onChange={(event) => onChange("tc_no", event.target.value)} />
      <Input className={inputClassName} placeholder="Telefon" value={person.telefon} onChange={(event) => onChange("telefon", event.target.value)} />
      {showCertificate && (
        <Input className={inputClassName} placeholder="Sertifika / Belge No" value={person.belge_no || ""} onChange={(event) => onChange("belge_no", event.target.value)} />
      )}
    </div>
  );
}
