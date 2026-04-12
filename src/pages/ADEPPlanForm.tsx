
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Save,
  FileDown,
  Loader2,
  Shield,
  CalendarClock,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

import ADEPGeneralInfo from "@/components/adep/ADEPGeneralInfo";
import ADEPLegislationTab from "@/components/adep/ADEPLegislationTab";
import ADEPTeamsTab from "@/components/adep/ADEPTeamsTab";
import ADEPContactsTab from "@/components/adep/ADEPContactsTab";
import ADEPScenariosTab from "@/components/adep/ADEPScenariosTab";
import { generateADEPPDF } from "@/components/adep/ADEPPDFGenerator";

interface ADEPPlanData {
  mevzuat: {
    amac: string;
    kapsam: string;
    dayanak: string;
    tanimlar: string;
  };
  genel_bilgiler: {
    hazirlayanlar: Array<{ unvan: string; ad_soyad: string }>;
    hazirlanma_tarihi: string;
    gecerlilik_tarihi: string;
    revizyon_no: string;
    revizyon_tarihi: string;
  };
  isyeri_bilgileri: {
    adres: string;
    telefon: string;
    tehlike_sinifi: string;
    sgk_sicil_no: string;
  };
  toplanma_yeri: {
    aciklama: string;
    harita_url: string;
  };
}

interface ADEPFormData {
  plan_name: string;
  company_id: string;
  company_name: string;
  hazard_class: string;
  employee_count: number;
  sector: string;
  plan_data: ADEPPlanData;
}

const DEFAULT_PLAN_DATA: ADEPPlanData = {
  mevzuat: {
    amac: "Bu Acil Durum Eylem Planı, işyerinde meydana gelebilecek acil durumlarda çalışanların ve işyerinin güvenliğini sağlamak, can ve mal kayıplarını en aza indirmek amacıyla hazırlanmıştır.",
    kapsam: "Bu plan, işyerinde çalışan tüm personeli, ziyaretçileri ve işyeri tesislerini kapsar.",
    dayanak: "6331 sayılı İş Sağlığı ve Güvenliği Kanunu ve Acil Durumlar Hakkında Yönetmelik hükümlerine göre hazırlanmıştır.",
    tanimlar: "Acil Durum: İşyerinde meydana gelen ve derhal müdahale edilmesi gereken olaylar.\nTahliye: Acil durumda çalışanların güvenli alana yönlendirilmesi.\nToplanma Yeri: Tahliye sonrası çalışanların güvenli bir şekilde bir araya geldiği alan.",
  },
  genel_bilgiler: {
    hazirlayanlar: [{ unvan: "İş Güvenliği Uzmanı", ad_soyad: "" }],
    hazirlanma_tarihi: new Date().toISOString().split("T")[0],
    gecerlilik_tarihi: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    revizyon_no: "Rev. 0",
    revizyon_tarihi: new Date().toISOString().split("T")[0],
  },
  isyeri_bilgileri: {
    adres: "",
    telefon: "",
    tehlike_sinifi: "Çok Tehlikeli",
    sgk_sicil_no: "",
  },
  toplanma_yeri: {
    aciklama: "İşyerinin önündeki açık alan toplanma noktası olarak belirlenmiştir.",
    harita_url: "",
  },
};

export default function ADEPPlanForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const [formData, setFormData] = useState<ADEPFormData>({
    plan_name: "",
    company_id: "",
    company_name: "",
    hazard_class: "Çok Tehlikeli",
    employee_count: 0,
    sector: "",
    plan_data: DEFAULT_PLAN_DATA,
  });

  useEffect(() => {
    if (id) {
      void fetchPlan();
    }
  }, [id]);

  const fetchPlan = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_plans")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const planData =
        typeof data.plan_data === "object" && data.plan_data !== null
          ? (data.plan_data as unknown as ADEPPlanData)
          : DEFAULT_PLAN_DATA;

      setFormData({
        plan_name: data.plan_name || "",
        company_id: "",
        company_name: data.company_name || "",
        hazard_class: data.hazard_class || "Çok Tehlikeli",
        employee_count: data.employee_count || 0,
        sector: data.sector || "",
        plan_data: planData,
      });
    } catch (error: any) {
      console.error("Plan fetch error:", error);
      toast.error("Plan yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updatePlanData = (section: string, data: any) => {
    setFormData((prev) => ({
      ...prev,
      plan_data: {
        ...prev.plan_data,
        [section]: data,
      },
    }));
  };

  const savePlan = async () => {
    if (!user) return;

    if (!formData.plan_name || !formData.company_name) {
      toast.error("Plan adı ve firma adı zorunludur");
      return;
    }

    setSaving(true);
    try {
      const planPayload = {
        user_id: user.id,
        plan_name: formData.plan_name,
        company_name: formData.company_name,
        sector: formData.sector,
        hazard_class: formData.hazard_class,
        employee_count: formData.employee_count,
        plan_data: formData.plan_data as any,
        status: "draft",
        updated_at: new Date().toISOString(),
      };

      if (id) {
        const { error } = await supabase
          .from("adep_plans")
          .update(planPayload)
          .eq("id", id);

        if (error) throw error;
        toast.success("Plan güncellendi");
      } else {
        const { data, error } = await supabase
          .from("adep_plans")
          .insert([
            {
              ...planPayload,
              created_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (error) throw error;
        toast.success("Plan oluşturuldu");
        navigate(`/adep-plans/${data.id}/edit`);
      }
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Kaydetme hatası: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!id) {
      toast.error("Önce planı kaydedin");
      return;
    }

    try {
      toast.info("PDF oluşturuluyor...");
      await generateADEPPDF(id);
      toast.success("PDF başarıyla oluşturuldu");
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast.error("PDF oluşturulamadı");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-900" />
            <div className="space-y-2">
              <div className="h-8 w-56 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-72 animate-pulse rounded bg-slate-900" />
            </div>
          </div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-slate-900" />
        </div>

        <div className="h-[720px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_35%,transparent_70%,rgba(255,255,255,0.04))]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_0.8fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/adep-plans")}
                className="h-12 w-12 rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                    ADEP Detay
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-200">
                    Liste ile uyumlu görünüm
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                  {id ? "ADEP Düzenle" : "Yeni ADEP Oluştur"}
                </h1>
                <p className="mt-2 text-sm text-slate-300">
                  Acil Durum Eylem Planı için temel bilgileri, ekipleri ve senaryoları tek akışta yönetin.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Plan Adı</div>
                <div className="mt-2 text-sm font-semibold text-white">{formData.plan_name || "Henüz girilmedi"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Firma</div>
                <div className="mt-2 text-sm font-semibold text-white">{formData.company_name || "Firma bekleniyor"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Tehlike Sınıfı</div>
                <div className="mt-2 text-sm font-semibold text-white">{formData.hazard_class || "Belirlenmedi"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Operasyon Kartı</div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-400">Revizyon</div>
                    <div className="mt-1 text-lg font-semibold text-white">{formData.plan_data.genel_bilgiler.revizyon_no || "Rev. 0"}</div>
                  </div>
                  <Shield className="h-6 w-6 text-emerald-300" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">Çalışan Sayısı</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <Building2 className="h-4 w-4 text-cyan-200" />
                    {formData.employee_count || 0} kişi
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/8 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200">Geçerlilik</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <CalendarClock className="h-4 w-4 text-amber-200" />
                    {formData.plan_data.genel_bilgiler.gecerlilik_tarihi || "Belirlenmedi"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={savePlan}
                  disabled={saving}
                  className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Kaydet
                </Button>
                {id && (
                  <Button
                    onClick={handleGeneratePDF}
                    className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                  >
                    <FileDown className="h-4 w-4" />
                    PDF İndir
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_24px_65px_rgba(2,6,23,0.32)]">
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
              <TabsTrigger value="legislation">Mevzuat</TabsTrigger>
              <TabsTrigger value="teams">Ekipler</TabsTrigger>
              <TabsTrigger value="contacts">İletişim</TabsTrigger>
              <TabsTrigger value="scenarios">Senaryolar</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-6">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.24)] md:p-6">
              <ADEPGeneralInfo
                data={formData}
                planData={formData.plan_data}
                onChange={(field: string, value: any) => updateFormData(field, value)}
                onPlanDataChange={updatePlanData}
              />
              </div>
            </TabsContent>

            <TabsContent value="legislation" className="mt-6">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.24)] md:p-6">
              <ADEPLegislationTab
                data={formData.plan_data.mevzuat}
                onChange={(data) => updatePlanData("mevzuat", data)}
              />
              </div>
            </TabsContent>

            <TabsContent value="teams" className="mt-6">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.24)] md:p-6">
              <ADEPTeamsTab planId={id} />
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="mt-6">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.24)] md:p-6">
              <ADEPContactsTab planId={id} />
              </div>
            </TabsContent>

            <TabsContent value="scenarios" className="mt-6">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.24)] md:p-6">
              <ADEPScenariosTab planId={id} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
