import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExternalLink, MapPinned, Plus, Trash2 } from "lucide-react";
import { buildDeterministicClientId } from "@/lib/clientIdentity";
import type { ADEPPlanData, ADEPRolePerson } from "@/lib/adepPlanSchema";
import {
  loadSavedEvacuationProjects,
  type SavedEvacuationProject,
} from "@/lib/evacuationProjectStorage";

interface Company {
  id: string;
  name: string;
  address: string;
  phone: string;
  employee_count: number;
  industry: string;
  hazard_class?: string | null;
}

interface ADEPGeneralInfoProps {
  data: {
    company_id?: string;
    plan_name: string;
    company_name: string;
    hazard_class: string;
    employee_count: number;
    sector: string;
  };
  planData: ADEPPlanData;
  onChange: (field: string, value: string | number) => void;
  onPlanDataChange: <K extends keyof ADEPPlanData>(section: K, data: ADEPPlanData[K]) => void;
}

const roleCards: Array<{
  key: keyof ADEPPlanData["gorevli_bilgileri"];
  title: string;
  description: string;
}> = [
  {
    key: "isveren_vekil",
    title: "İşveren / İşveren Vekili",
    description: "Planın işveren tarafındaki sorumlusu.",
  },
  {
    key: "isg_uzmani",
    title: "İş Güvenliği Uzmanı",
    description: "Belge numarası, iletişim ve unvan bilgileri.",
  },
  {
    key: "isyeri_hekimi",
    title: "İşyeri Hekimi",
    description: "Hekim iletişim ve sertifika bilgileri.",
  },
  {
    key: "calisan_temsilcisi",
    title: "Çalışan Temsilcisi",
    description: "Temsilci ve eğitim bilgileri.",
  },
  {
    key: "destek_elemani",
    title: "Destek Elemanı / Koordinatör",
    description: "Acil durum koordinasyon desteği veren kişi.",
  },
  {
    key: "bilgi_sahibi_kisi",
    title: "Bilgi Sahibi Kişi",
    description: "Birimler ve işyeri işleyişi hakkında bilgi sahibi kişi.",
  },
];

export default function ADEPGeneralInfo({
  data,
  planData,
  onChange,
  onPlanDataChange,
}: ADEPGeneralInfoProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [savedSketches, setSavedSketches] = useState<SavedEvacuationProject[]>([]);

  const readableInputClassName =
    "border-white/10 bg-slate-900/80 !text-white placeholder:text-slate-400 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20 focus-visible:ring-offset-0";

  const fetchCompanies = useCallback(async () => {
    if (!user) return;

    try {
      const { data: companiesData, error } = await supabase
        .from("companies")
        .select("id, name, address, phone, employee_count, industry, hazard_class")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCompanies((companiesData as Company[]) || []);
    } catch (error) {
      console.error("Companies fetch error:", error);
    }
  }, [user]);

  useEffect(() => {
    void fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    setSavedSketches(loadSavedEvacuationProjects());
  }, []);

  const preparers = useMemo(
    () =>
      (planData.genel_bilgiler.hazirlayanlar || []).map((preparer, index) => ({
        ...preparer,
        client_id:
          preparer.client_id ||
          buildDeterministicClientId("adep-preparer", [
            data.company_id || "no-company",
            index,
            "fallback",
          ]),
      })),
    [data.company_id, planData.genel_bilgiler.hazirlayanlar],
  );

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;

    onChange("company_id", companyId);
    onChange("company_name", company.name);
    onChange("employee_count", company.employee_count || 0);
    onChange("sector", company.industry || "");

    const nextHazardClass = company.hazard_class || data.hazard_class || "Tehlikeli";
    onChange("hazard_class", nextHazardClass);

    onPlanDataChange("isyeri_bilgileri", {
      ...planData.isyeri_bilgileri,
      adres: company.address || "",
      telefon: company.phone || "",
      tehlike_sinifi: nextHazardClass,
      is_kolu: company.industry || "",
    });
  };

  const updateNestedSection = <K extends keyof ADEPPlanData>(section: K, patch: Partial<ADEPPlanData[K]>) => {
    onPlanDataChange(section, {
      ...planData[section],
      ...patch,
    });
  };

  const handleSketchSelection = (projectId: string) => {
    if (projectId === "__none__") {
      updateNestedSection("ekler", { secili_kroki: null });
      return;
    }

    const selectedProject = savedSketches.find((project) => project.id === projectId);
    if (!selectedProject) return;

    updateNestedSection("ekler", {
      secili_kroki: {
        id: selectedProject.id,
        project_name: selectedProject.project_name,
        thumbnail_data_url: selectedProject.thumbnail_data_url || "",
        created_at: selectedProject.created_at,
      },
    });
  };

  const updateResponsiblePerson = (
    role: keyof ADEPPlanData["gorevli_bilgileri"],
    field: keyof ADEPRolePerson,
    value: string,
  ) => {
    onPlanDataChange("gorevli_bilgileri", {
      ...planData.gorevli_bilgileri,
      [role]: {
        ...planData.gorevli_bilgileri[role],
        [field]: value,
      },
    });
  };

  const addPreparer = () => {
    onPlanDataChange("genel_bilgiler", {
      ...planData.genel_bilgiler,
      hazirlayanlar: [
        ...preparers,
        {
          client_id: buildDeterministicClientId("adep-preparer", [
            data.company_id || "no-company",
            preparers.length,
            "manual",
          ]),
          unvan: "",
          ad_soyad: "",
        },
      ],
    });
  };

  const removePreparer = (index: number) => {
    onPlanDataChange("genel_bilgiler", {
      ...planData.genel_bilgiler,
      hazirlayanlar: preparers.filter((_, preparerIndex) => preparerIndex !== index),
    });
  };

  const updatePreparer = (index: number, field: "unvan" | "ad_soyad", value: string) => {
    const nextPreparers = [...preparers];
    nextPreparers[index] = {
      ...nextPreparers[index],
      [field]: value,
    };

    onPlanDataChange("genel_bilgiler", {
      ...planData.genel_bilgiler,
      hazirlayanlar: nextPreparers,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>İşyeri ve Belge Bilgileri</CardTitle>
          <CardDescription>
            Acil durum planının kapak, işyeri ve belge özetinde kullanılacak temel alanları doldurun.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan_name">Plan Adı</Label>
              <Input
                id="plan_name"
                value={data.plan_name}
                onChange={(e) => onChange("plan_name", e.target.value)}
                placeholder="2026 Acil Durum Eylem Planı"
                className={readableInputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Firma</Label>
              <Select value={data.company_id || ""} onValueChange={handleCompanySelect}>
                <SelectTrigger className={readableInputClassName}>
                  <SelectValue placeholder="Firma seçin" />
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">İşyeri Ünvanı</Label>
              <Input
                id="company_name"
                value={data.company_name}
                onChange={(e) => onChange("company_name", e.target.value)}
                placeholder="Firma ünvanı"
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sgk_sicil_no">SGK Sicil No</Label>
              <Input
                id="sgk_sicil_no"
                value={planData.isyeri_bilgileri.sgk_sicil_no}
                onChange={(e) =>
                  updateNestedSection("isyeri_bilgileri", { sgk_sicil_no: e.target.value })
                }
                placeholder="26 haneli sicil numarası"
                className={readableInputClassName}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hazard_class">Tehlike Sınıfı</Label>
              <Select
                value={data.hazard_class}
                onValueChange={(value) => {
                  onChange("hazard_class", value);
                  updateNestedSection("isyeri_bilgileri", { tehlike_sinifi: value });
                }}
              >
                <SelectTrigger className={readableInputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem>
                  <SelectItem value="Tehlikeli">Tehlikeli</SelectItem>
                  <SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_count">Çalışan Sayısı</Label>
              <Input
                id="employee_count"
                type="number"
                value={data.employee_count}
                onChange={(e) => onChange("employee_count", Number.parseInt(e.target.value, 10) || 0)}
                className={readableInputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_kolu">İşkolu / Sektör</Label>
              <Input
                id="is_kolu"
                value={planData.isyeri_bilgileri.is_kolu}
                onChange={(e) => {
                  onChange("sector", e.target.value);
                  updateNestedSection("isyeri_bilgileri", { is_kolu: e.target.value });
                }}
                placeholder="İşyeri faaliyet alanı"
                className={readableInputClassName}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Textarea
                id="address"
                value={planData.isyeri_bilgileri.adres}
                onChange={(e) => updateNestedSection("isyeri_bilgileri", { adres: e.target.value })}
                placeholder="İşyeri adresi"
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={planData.isyeri_bilgileri.telefon}
                onChange={(e) => updateNestedSection("isyeri_bilgileri", { telefon: e.target.value })}
                placeholder="0212 000 00 00"
                className={readableInputClassName}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="hazirlanma_tarihi">Hazırlama Tarihi</Label>
              <Input
                id="hazirlanma_tarihi"
                type="date"
                value={planData.genel_bilgiler.hazirlanma_tarihi}
                onChange={(e) =>
                  updateNestedSection("genel_bilgiler", { hazirlanma_tarihi: e.target.value })
                }
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gecerlilik_tarihi">Geçerlilik Tarihi</Label>
              <Input
                id="gecerlilik_tarihi"
                type="date"
                value={planData.genel_bilgiler.gecerlilik_tarihi}
                onChange={(e) =>
                  updateNestedSection("genel_bilgiler", { gecerlilik_tarihi: e.target.value })
                }
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revizyon_no">Revizyon No</Label>
              <Input
                id="revizyon_no"
                value={planData.genel_bilgiler.revizyon_no}
                onChange={(e) => updateNestedSection("genel_bilgiler", { revizyon_no: e.target.value })}
                placeholder="Rev. 0"
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revizyon_tarihi">Revizyon Tarihi</Label>
              <Input
                id="revizyon_tarihi"
                type="date"
                value={planData.genel_bilgiler.revizyon_tarihi}
                onChange={(e) =>
                  updateNestedSection("genel_bilgiler", { revizyon_tarihi: e.target.value })
                }
                className={readableInputClassName}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="plan_basligi">Kapak Başlığı</Label>
              <Input
                id="plan_basligi"
                value={planData.dokuman_bilgileri.plan_basligi}
                onChange={(e) =>
                  updateNestedSection("dokuman_bilgileri", { plan_basligi: e.target.value })
                }
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan_alt_basligi">Alt Başlık</Label>
              <Input
                id="plan_alt_basligi"
                value={planData.dokuman_bilgileri.plan_alt_basligi}
                onChange={(e) =>
                  updateNestedSection("dokuman_bilgileri", { plan_alt_basligi: e.target.value })
                }
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ay_yil">Ay / Yıl</Label>
              <Input
                id="ay_yil"
                value={planData.dokuman_bilgileri.ay_yil}
                onChange={(e) => updateNestedSection("dokuman_bilgileri", { ay_yil: e.target.value })}
                placeholder="Nisan 2026"
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dokuman_tarihi">Doküman Tarihi</Label>
              <Input
                id="dokuman_tarihi"
                type="date"
                value={planData.dokuman_bilgileri.dokuman_tarihi}
                onChange={(e) =>
                  updateNestedSection("dokuman_bilgileri", { dokuman_tarihi: e.target.value })
                }
                className={readableInputClassName}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OSGB Bilgileri</CardTitle>
          <CardDescription>
            Word şablonundaki OSGB başlığında kullanılacak kurum bilgilerini girin.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="osgb_unvan">OSGB Ünvanı</Label>
            <Input
              id="osgb_unvan"
              value={planData.osgb_bilgileri.unvan}
              onChange={(e) => updateNestedSection("osgb_bilgileri", { unvan: e.target.value })}
              placeholder="OSGB firma adı"
              className={readableInputClassName}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="osgb_adres">OSGB Adresi</Label>
            <Textarea
              id="osgb_adres"
              value={planData.osgb_bilgileri.adres}
              onChange={(e) => updateNestedSection("osgb_bilgileri", { adres: e.target.value })}
              placeholder="OSGB merkez adresi"
              className={readableInputClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="osgb_telefon">Telefon</Label>
            <Input
              id="osgb_telefon"
              value={planData.osgb_bilgileri.telefon}
              onChange={(e) => updateNestedSection("osgb_bilgileri", { telefon: e.target.value })}
              placeholder="0212 000 00 00"
              className={readableInputClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="osgb_web">Web</Label>
            <Input
              id="osgb_web"
              value={planData.osgb_bilgileri.web}
              onChange={(e) => updateNestedSection("osgb_bilgileri", { web: e.target.value })}
              placeholder="www.isgvizyon.com"
              className={readableInputClassName}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="osgb_email">E-posta</Label>
            <Input
              id="osgb_email"
              value={planData.osgb_bilgileri.email}
              onChange={(e) => updateNestedSection("osgb_bilgileri", { email: e.target.value })}
              placeholder="info@isgvizyon.com"
              className={readableInputClassName}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Hazırlayan Kişiler</CardTitle>
              <CardDescription>
                Planı hazırlayan ve onay sürecine dahil olan kişileri ekleyin.
              </CardDescription>
            </div>
            <Button onClick={addPreparer} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {preparers.map((preparer, index) => (
            <div key={preparer.client_id} className="flex items-start gap-4">
              <div className="grid flex-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ünvan</Label>
                  <Input
                    value={preparer.unvan}
                    onChange={(e) => updatePreparer(index, "unvan", e.target.value)}
                    placeholder="İş Güvenliği Uzmanı"
                    className={readableInputClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ad Soyad</Label>
                  <Input
                    value={preparer.ad_soyad}
                    onChange={(e) => updatePreparer(index, "ad_soyad", e.target.value)}
                    placeholder="Ahmet Yılmaz"
                    className={readableInputClassName}
                  />
                </div>
              </div>
              {index > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePreparer(index)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Görevli Kişiler</CardTitle>
          <CardDescription>
            Word şablonundaki resmi görevli tablosunu doldurmak için temel rol sahiplerini tanımlayın.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {roleCards.map((roleCard) => {
            const roleValue = planData.gorevli_bilgileri[roleCard.key];

            return (
              <div key={roleCard.key} className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800">
                <div className="mb-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {roleCard.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {roleCard.description}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Ad Soyad</Label>
                    <Input
                      value={roleValue.ad_soyad}
                      onChange={(e) =>
                        updateResponsiblePerson(roleCard.key, "ad_soyad", e.target.value)
                      }
                      placeholder="Ad Soyad"
                      className={readableInputClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ünvan / Görev</Label>
                    <Input
                      value={roleValue.unvan}
                      onChange={(e) =>
                        updateResponsiblePerson(roleCard.key, "unvan", e.target.value)
                      }
                      placeholder="Görev tanımı"
                      className={readableInputClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon</Label>
                    <Input
                      value={roleValue.telefon}
                      onChange={(e) =>
                        updateResponsiblePerson(roleCard.key, "telefon", e.target.value)
                      }
                      placeholder="05xx xxx xx xx"
                      className={readableInputClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TC No</Label>
                    <Input
                      value={roleValue.tc_no}
                      onChange={(e) =>
                        updateResponsiblePerson(roleCard.key, "tc_no", e.target.value)
                      }
                      placeholder="11 haneli TC"
                      className={readableInputClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Belge / Sertifika No</Label>
                    <Input
                      value={roleValue.belge_no}
                      onChange={(e) =>
                        updateResponsiblePerson(roleCard.key, "belge_no", e.target.value)
                      }
                      placeholder="Varsa belge numarası"
                      className={readableInputClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Eğitim Tarihi</Label>
                    <Input
                      type="date"
                      value={roleValue.egitim_tarihi}
                      onChange={(e) =>
                        updateResponsiblePerson(roleCard.key, "egitim_tarihi", e.target.value)
                      }
                      className={readableInputClassName}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Toplanma Yeri ve Ek Notları</CardTitle>
          <CardDescription>
            Toplanma alanı açıklamasını ve şablondaki ekler bölümünde yer alacak notları girin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MapPinned className="h-4 w-4 text-cyan-300" />
                  Sistem Kroki Bağlantısı
                </div>
                <p className="text-xs leading-5 text-slate-300">
                  Tahliye Kroki Editörü'nde kaydettiğiniz krokilerden birini seçin. Seçilen kroki ADEP planına bağlanır
                  ve PDF çıktısında Ek-9 sayfasında kullanılabilir.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/10"
                onClick={() => navigate("/evacuation-editor/history")}
              >
                <ExternalLink className="h-4 w-4" />
                Kroki Geçmişlerini Aç
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-2">
                <Label>Kayıtlı Kroki Seç</Label>
                <Select
                  value={planData.ekler.secili_kroki?.id || "__none__"}
                  onValueChange={handleSketchSelection}
                >
                  <SelectTrigger className={readableInputClassName}>
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
                {savedSketches.length === 0 ? (
                  <p className="text-xs text-amber-200/90">
                    Henüz kayıtlı kroki bulunamadı. Önce Tahliye Kroki Editörü'nde bir kroki oluşturup kaydedin.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                {planData.ekler.secili_kroki?.thumbnail_data_url ? (
                  <div className="space-y-3">
                    <img
                      src={planData.ekler.secili_kroki.thumbnail_data_url}
                      alt={planData.ekler.secili_kroki.project_name}
                      className="h-36 w-full rounded-xl object-cover"
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
                  <div className="flex min-h-[144px] items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-400">
                    Seçilen krokinin küçük önizlemesi burada gösterilir.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="toplanma_yeri">Toplanma Yeri Açıklaması</Label>
              <Textarea
                id="toplanma_yeri"
                value={planData.toplanma_yeri.aciklama}
                onChange={(e) => updateNestedSection("toplanma_yeri", { aciklama: e.target.value })}
                placeholder="Tahliye sonrası toplanma alanının açıklaması"
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="harita_url">Harita / Kroki Bağlantısı</Label>
              <Textarea
                id="harita_url"
                value={planData.toplanma_yeri.harita_url}
                onChange={(e) => updateNestedSection("toplanma_yeri", { harita_url: e.target.value })}
                placeholder="Kroki veya harita bağlantısı"
                className={readableInputClassName}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="organizasyon_semasi_notu">Organizasyon Şeması Notu</Label>
              <Textarea
                id="organizasyon_semasi_notu"
                value={planData.ekler.organizasyon_semasi_notu}
                onChange={(e) => updateNestedSection("ekler", { organizasyon_semasi_notu: e.target.value })}
                placeholder="Ek-1 organizasyon yapısı notu"
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tahliye_plani_notu">Tahliye Planı Notu</Label>
              <Textarea
                id="tahliye_plani_notu"
                value={planData.ekler.tahliye_plani_notu}
                onChange={(e) => updateNestedSection("ekler", { tahliye_plani_notu: e.target.value })}
                placeholder="Ek-8 tahliye planı notu"
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kroki_notu">Kroki Notu</Label>
              <Textarea
                id="kroki_notu"
                value={planData.ekler.kroki_notu}
                onChange={(e) => updateNestedSection("ekler", { kroki_notu: e.target.value })}
                placeholder="Ek-9 kroki bilgisi"
                className={readableInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ek_notlar">Ek Notlar</Label>
              <Textarea
                id="ek_notlar"
                value={planData.ekler.ek_notlar}
                onChange={(e) => updateNestedSection("ekler", { ek_notlar: e.target.value })}
                placeholder="Belgede yer almasını istediğiniz ek açıklamalar"
                className={readableInputClassName}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
