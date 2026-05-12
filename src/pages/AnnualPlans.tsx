import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Download, FileSpreadsheet, Plus, Save, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  downloadAnnualWorkPlanOfficialDocx,
  type AnnualWorkPlanCompanyInfo,
  type AnnualWorkPlanRow,
} from "@/lib/annualWorkPlanOfficialDocx";

const MONTH_HEADERS = [
  "OCAK",
  "ŞUBAT",
  "MART",
  "NİSAN",
  "MAYIS",
  "HAZİRAN",
  "TEMMUZ",
  "AĞUSTOS",
  "EYLÜL",
  "EKİM",
  "KASIM",
  "ARALIK",
] as const;

type CompanyOption = {
  id: string;
  name: string;
  address: string | null;
  tax_number: string | null;
  registry_no?: string | null;
};

type StoredAnnualPlanData = {
  version: "official-work-plan-v1";
  company: AnnualWorkPlanCompanyInfo & { companyId: string | null };
  rows: AnnualWorkPlanRow[];
};

const currentYear = new Date().getFullYear();

const baseRows = [
  {
    activity: "Yıllık Çalışma Planının Hazırlanması",
    period: "1 Kez / Yıl",
    responsible: "İşveren İş Güv Uzmanı İşyeri Hekimi",
    regulation:
      "29.12.2012/28512 / Değişiklik 18.12.2014/29209 / İş Sağlığı Ve Güvenliği Hizmetleri Yönetmeliği",
    currentStatus: "",
  },
  {
    activity: "Yıllık Eğitim Planın Yapılması",
    period: "1 Kez / Yıl",
    responsible: "İşveren İş Güv Uzmanı İşyeri Hekimi",
    regulation:
      "15.05.2013-28648 / Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik",
    currentStatus: "",
  },
  {
    activity: "İSG Kurul Toplantısı",
    period: "1 Kez / 1 Ay 1 Kez / 2 Ay 1 Kez / 3 Ay",
    responsible: "İSG Kurulu",
    regulation:
      "18.01.2013-28532 / İş Sağlığı Ve Güvenliği Kurulları Hakkında Yönetmelik / Madde 9 (1)-a",
    currentStatus: "MUAF",
  },
  {
    activity: "Risk Değerlendirme Ekibinin Eğitilmesi",
    period: "1 Kez",
    responsible: "İş Güv Uzmanı İş Yeri Hekimi",
    regulation:
      "15.05.2013-28648 / Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik 29.12.2012/28512 / İş Sağlığı Ve Güvenliği Risk Değerlendirmesi Yönetmeliği",
    currentStatus: "",
  },
  {
    activity: "Risk Değerlendirmesi Kontrolü / Yapılması",
    period: "1 Kez / 2 Yıl 1 Kez / 4 Yıl 1 Kez / 6 Yıl",
    responsible: "Risk Değerlendirme Ekibi",
    regulation:
      "29.12.2012/28512 / Değişiklik 18.12.2014/29209 / İş Sağlığı Ve Güvenliği Hizmetleri Yönetmeliği 29.12.2012/28512 / İş Sağlığı Ve Güvenliği Risk Değerlendirmesi Yönetmeliği",
    currentStatus: "",
  },
  {
    activity:
      "İşyeri Ortam Ölçümlerinin Kontrolü / Yapılması *Kimyasal Etkenler Ölçümü *Fiziksel Etkenler Ölçümü *Biyolojik Etkenler Ölçümü",
    period: "1 Kez",
    responsible: "İşveren İş Güv Uzmanı İş Yeri Hekimi",
    regulation:
      "29.12.2012/28512 / Değişiklik 18.12.2014/29209 / İş Sağlığı Ve Güvenliği Hizmetleri Yönetmeliği 20.08.2013/28741 / İş Hijyeni Ölçüm, Test Ve Analizi Yapan Lab . Hak. Yön.",
    currentStatus: "",
  },
  {
    activity: "Çalışanların Kişisel Maruziyet Ölçümleri Kontrolü / Sağlanması",
    period: "Belirli Periyot",
    responsible: "İşveren İş Güv Uzmanı İşyeri Hekimi",
    regulation:
      "29.12.2012/28512 / Değişiklik 18.12.2014/29209 / İş Sağlığı Ve Güvenliği Hizmetleri Yönetmeliği 20.08.2013/28741 / İş Hijyeni Ölçüm, Test Ve Analizi Yapan Lab . Hak. Yön.",
    currentStatus: "",
  },
  {
    activity: "Kaldırma İletme araçlarının periyodik kontrollerinin ve testlerinin yaptırılması",
    period: "1 / 12 Ay",
    responsible: "İşveren",
    regulation:
      "25.04.2013 -28628 / İş Ekipmanlarının Kullanımında Sağlık Ve Güvenlik Şartları Yönetmeliği / Ek III- Tablo.2",
    currentStatus: "",
  },
  {
    activity: "Basınçlı Kapların periyodik kontrollerinin ve testlerinin yaptırılması",
    period: "1 / 12 Ay",
    responsible: "İşveren",
    regulation:
      "25.04.2013 -28628 / İş Ekipmanlarının Kullanımında Sağlık Ve Güvenlik Şartları Yönetmeliği / Ek III-Tablo.1",
    currentStatus: "",
  },
  {
    activity:
      "Elektrik Tesisatların Periyodik İç tesisat ve Topraklama Kontrollerinin ve testlerinin yaptırılması",
    period: "1 / 12 Ay",
    responsible: "İşveren",
    regulation:
      "25.04.2013 -28628 / İş Ekipmanlarının Kullanımında Sağlık Ve Güvenlik Şartları Yönetmeliği / Ek III-Tablo.3",
    currentStatus: "",
  },
  {
    activity: "Acil Durum Planının Kontrolü / Güncellenmesi",
    period: "1 Kez / 2 Yıl 1 Kez / 4 Yıl 1 Kez / 6 Yıl",
    responsible: "İşveren İş Güv . Uzm. İş Yeri Hekimi",
    regulation: "18.06.2013-28681 / İşyerlerinde Acil Durumlar Hakkında Yönetmelik Madde 14",
    currentStatus: "",
  },
  {
    activity: "Acil Durum Ekiplerinin Güncellenmesi",
    period: "2 Kez / 1 Yıl",
    responsible: "İşveren İş Güv . Uzm. İş Yeri Hekimi",
    regulation: "18.06.2013-28681 / İşyerlerinde Acil Durumlar Hakkında Yönetmelik Madde 14",
    currentStatus: "",
  },
  {
    activity: "İş sağlığı ve Güvenliği Uyarı ikaz İşaret Levhalarının Kontrolü / Tespiti ve Asılması",
    period: "1 Kez",
    responsible: "İşveren İş Güv . Uzm.",
    regulation: "11.09.2013 - 28672 sayılı Sağlık ve Güvenlik İşaretleri Yönetmeliği Madde:5/1",
    currentStatus: "",
  },
  {
    activity:
      "Firma Acil Durum Tahliye Projesi Kontrolü / Oluşturulması (Kaçış yollarının, yangın merdivenlerinin, acil durum asansörlerinin, yangın dolaplarının, itfaiye su verme ve alma ağızlarının, toplanma alanın ve yangın pompalarının yerlerinin renkli olarak işaretlendiği proje)",
    period: "1 Kez / 2 Yıl 1 Kez / 4 Yıl 1 Kez / 6 Yıl",
    responsible: "İşveren İş Güv . Uzm. İş Yeri Hekimi",
    regulation:
      "18.06.2013-28681 / İşyerlerinde Acil Durumlar Hakkında Yönetmelik Madde 15 19/12/2007-26735 / Binaların Yangından Korunması HakkındaYönetmelik",
    currentStatus: "",
  },
  {
    activity: "Çalışanların İSG Eğitimleri (Genel-Sağlık-Teknik Konular)",
    period: "8 Saat / 12 Ay 12 Saat / 24 Ay 16 Saat / 36 Ay",
    responsible: "İş Güv Uzmanı İş Yeri Hekimi",
    regulation:
      "15.05.2013-28648 / Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik / Madde 6 (4)-b / Madde 15",
    currentStatus:
      "Çalışanların eğitimi işyerinin değişken yapısı ve personel sirkülasyonunun yoğunluğu nedeniyle işyerinde çalışmaya başlayan her çalışana bireysel veya toplu olarak verilmekte ve belgelenmektedir",
  },
  {
    activity: "İş Sağlığı ve Güvenliği Kurulu Eğitimi",
    period: "1 Kez / 2 Yıl 1 Kez / 4 Yıl 1 Kez / 6 Yıl",
    responsible: "İş Güv Uzmanı İş Yeri Hekimi",
    regulation:
      "R.G. 18 Ocak 2013/28532 / İş Sağlığı ve Güvenliği Kurulları Hakkında Yönetmelik / Madde 7",
    currentStatus: "MUAF",
  },
  {
    activity: "Yangın Ekipleri Eğitimi ve Yangın söndürme cihazların kontrolü",
    period: "2 Kez / Yıl",
    responsible: "İş Güv Uzmanı İş Yeri Hekimi",
    regulation:
      "R.G. 19 Aralık 2007/26735 / Binaların Yangından Korunması Hakkındaki Yönetmelik / Madde 129",
    currentStatus: "",
  },
  {
    activity: "Tüm Çalışanların Acil Durum Planı Bilgilendirilmesi / Eğitimi",
    period: "1 Kez / 2 Yıl 1 Kez / 4 Yıl 1 Kez / 6 Yıl",
    responsible: "İşveren İş Güv . Uzm. İş Yeri Hekimi",
    regulation: "18.06.2013-28681 / İşyerlerinde Acil Durumlar Hakkında Yönetmelik Madde 15",
    currentStatus: "",
  },
  {
    activity: "İşe Giriş ve Yıllık Periyodik Muayenelerin Kontrolü / Yapılması",
    period: "1 kez/1 Yıl 1 kez/3 Yıl 1 kez/5 Yıl",
    responsible: "İşveren İşyeri Hekimi Diğ . Sağlık Personeli",
    regulation:
      "20.07.2013-28713 Deşiklik 18.12.2014/29209 / İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik / Madde 9.c.3",
    currentStatus:
      "Çalışanların sağlık kontrolleri işyeri hekiminin belirlediği periyotlarda ve işe başlayan her personeli kapsayacak şekilde yapılmaktadır",
  },
  {
    activity: "Acil durum Tahliye Tatbikatının Yapılması ve Tatbikat Raporunun Tutulması",
    period: "1 Kez / Yıl",
    responsible: "İş Güv . Uzm. İş Yeri Hekimi",
    regulation: "18.06.2013-28681 / İşyerlerinde Acil Durumlar Hakkında Yönetmelik Madde 13",
    currentStatus: "",
  },
  {
    activity: "İçme Suyu Temininin Kontrolü / Sağlanması ve Uygunluğunun Analizi",
    period: "Belirli Periyot",
    responsible: "İşyeri Hekimi DSP",
    regulation:
      "20.07.2013-28713 Deşiklik 18.12.2014/29209 / İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik / Madde 2.a.5",
    currentStatus: "",
  },
  {
    activity: "Çalışanların Sosyal Alanlarının Fiziksel Uygunluğunun ve Hijyen Şartlarının Sağlanması / Takibi",
    period: "Belirli Periyot",
    responsible: "İşveren İş Güv Uzmanı",
    regulation:
      "17.07.2013/ 28710 - İşyeri Bina Ve Eklentilerinde Alınacak Sağlık Ve Güvenlik Önlemlerine İlişkin Yönetmelik",
    currentStatus: "",
  },
  {
    activity: "İşyerinde İSG gözetimlerininin / denetimlerinin yapılması",
    period: "Sürekli",
    responsible: "İşveren İş Güv Uzmanı İşyeri Hekimi Çal. Temsilcisi",
    regulation:
      "29.12.2012-28512 / İş Güvenliği Uzmanlarının Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik Madde 9 20.07.2013-28713 Deşiklik 18.12.2014/29209 / İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik",
    currentStatus: "",
  },
  {
    activity: "İş Kazası ve Meslek Hastalıkları Kaydı (Ramak kala olay, İlkyardım uygulanan kaza, İş günü kayıplı kaza, İş kazası)",
    period: "Sürekli",
    responsible: "İşveren İş Güv Uzmanı İşyeri Hekimi Çal. Temsilcisi",
    regulation:
      "29.12.2012-28512 / İş Güvenliği Uzmanlarının Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik Madde 9 20.07.2013-28713 Deşiklik 18.12.2014/29209 / İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik",
    currentStatus: "",
  },
  {
    activity: "Ek -2 Yıllık Değerlendirme Raporunun Tutulması",
    period: "1 Kez / Yıl",
    responsible: "İşveren İş Güv Uzmanı İşyeri Hekimi",
    regulation:
      "29.12.2012-28512 / İş Güvenliği Uzmanlarının Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik Madde 9 20.07.2013-28713 Deşiklik 18.12.2014/29209 / İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik",
    currentStatus: "",
  },
] satisfies Array<Omit<AnnualWorkPlanRow, "id" | "months">>;

const createInitialRows = (): AnnualWorkPlanRow[] =>
  baseRows.map((row, index) => ({
    id: `official-plan-row-${index + 1}`,
    months: Array.from({ length: 12 }, () => false),
    ...row,
  }));

const createEmptyRow = (): AnnualWorkPlanRow => ({
  id: crypto.randomUUID(),
  activity: "",
  period: "",
  responsible: "",
  regulation: "",
  currentStatus: "",
  months: Array.from({ length: 12 }, () => false),
});

const statCardClasses = [
  "border-sky-200/70 bg-gradient-to-br from-sky-50 via-background to-card dark:border-sky-500/20 dark:from-sky-500/15 dark:via-card dark:to-card",
  "border-amber-200/70 bg-gradient-to-br from-amber-50 via-background to-card dark:border-amber-500/20 dark:from-amber-500/15 dark:via-card dark:to-card",
  "border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-background to-card dark:border-emerald-500/20 dark:from-emerald-500/15 dark:via-card dark:to-card",
] as const;

const normalizeLoadedRows = (incoming: unknown): AnnualWorkPlanRow[] => {
  if (!Array.isArray(incoming)) {
    return createInitialRows();
  }

  return incoming.map((row, index) => {
    const source = (row || {}) as Partial<AnnualWorkPlanRow> & {
      activity_name?: string;
      months?: Record<number, unknown> | boolean[];
    };
    const months = Array.from({ length: 12 }, (_, monthIndex) => {
      if (Array.isArray(source.months)) {
        return Boolean(source.months[monthIndex]);
      }
      if (source.months && typeof source.months === "object") {
        const value = (source.months as Record<number, unknown>)[monthIndex];
        return value === true || value === "planned" || value === "completed" || value === "x";
      }
      return false;
    });

    return {
      id: source.id || `official-plan-row-${index + 1}`,
      activity: source.activity || source.activity_name || "",
      period: source.period || "",
      responsible: source.responsible || "",
      regulation: source.regulation || "",
      currentStatus: source.currentStatus || "",
      months,
    };
  });
};

export default function AnnualPlans() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedCompanyId, setSelectedCompanyId] = useState(searchParams.get("companyId") || "");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyForm, setCompanyForm] = useState<AnnualWorkPlanCompanyInfo>({
    companyName: "",
    address: "",
    registrationNumber: "",
    year: currentYear,
  });
  const [rows, setRows] = useState<AnnualWorkPlanRow[]>(createInitialRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    setCompanyForm((previous) => ({ ...previous, year: selectedYear }));
  }, [selectedYear]);

  useEffect(() => {
    if (!user) return;

    const loadPage = async () => {
      setLoading(true);
      try {
        const [companiesRes, annualPlanRes] = await Promise.all([
          (supabase as any)
            .from("companies")
            .select("*")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("annual_plans")
            .select("*")
            .eq("user_id", user.id)
            .eq("year", selectedYear)
            .eq("plan_type", "work_plan")
            .maybeSingle(),
        ]);

        if (companiesRes.error) throw companiesRes.error;
        setCompanies((companiesRes.data || []) as CompanyOption[]);

        if (annualPlanRes.error) throw annualPlanRes.error;

        const rawPlan = annualPlanRes.data?.plan_data as
          | StoredAnnualPlanData
          | AnnualWorkPlanRow[]
          | null
          | undefined;

        if (rawPlan && !Array.isArray(rawPlan) && rawPlan.version === "official-work-plan-v1") {
          setRows(normalizeLoadedRows(rawPlan.rows));
          setSelectedCompanyId(rawPlan.company.companyId || "");
          setCompanyForm({
            companyName: rawPlan.company.companyName || "",
            address: rawPlan.company.address || "",
            registrationNumber: rawPlan.company.registrationNumber || "",
            year: rawPlan.company.year || selectedYear,
          });
        } else if (Array.isArray(rawPlan)) {
          setRows(normalizeLoadedRows(rawPlan));
        } else {
          setRows(createInitialRows());
        }

        const routeCompanyId = searchParams.get("companyId");
        const targetCompanyId =
          routeCompanyId ||
          (!Array.isArray(rawPlan) && rawPlan?.version === "official-work-plan-v1"
            ? rawPlan.company.companyId
            : "");

        if (targetCompanyId && companiesRes.data) {
          const company = (companiesRes.data as CompanyOption[]).find((item) => item.id === targetCompanyId);
          if (company) {
            applyCompany(company);
          }
        }
      } catch (error: any) {
        console.error("Annual plans load failed:", error);
        toast.error("Yıllık çalışma planı yüklenemedi", {
          description: error?.message || "Beklenmeyen hata",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, user?.id]);

  const applyCompany = (company: CompanyOption) => {
    setSelectedCompanyId(company.id);
    setCompanyForm((previous) => ({
      ...previous,
      companyName: company.name || "",
      address: company.address || "",
      registrationNumber: company.registry_no || company.tax_number || "",
    }));
  };

  const updateRowField = (
    rowId: string,
    field: keyof Pick<AnnualWorkPlanRow, "activity" | "period" | "responsible" | "regulation" | "currentStatus">,
    value: string,
  ) => {
    setRows((previous) =>
      previous.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  };

  const toggleMonth = (rowId: string, monthIndex: number) => {
    setRows((previous) =>
      previous.map((row) => {
        if (row.id !== rowId) return row;
        const months = [...row.months];
        months[monthIndex] = !months[monthIndex];
        return { ...row, months };
      }),
    );
  };

  const addRow = () => {
    setRows((previous) => [...previous, createEmptyRow()]);
  };

  const removeRow = (rowId: string) => {
    setRows((previous) => previous.filter((row) => row.id !== rowId));
  };

  const activeMonthCount = useMemo(
    () => rows.reduce((total, row) => total + row.months.filter(Boolean).length, 0),
    [rows],
  );
  const completedRowCount = useMemo(
    () => rows.filter((row) => row.currentStatus.trim().length > 0).length,
    [rows],
  );

  const documentPayload = useMemo<StoredAnnualPlanData>(
    () => ({
      version: "official-work-plan-v1",
      company: {
        companyId: selectedCompanyId || null,
        ...companyForm,
      },
      rows,
    }),
    [companyForm, rows, selectedCompanyId],
  );

  const ensureCompanySelected = () => {
    if (!selectedCompanyId) {
      toast.warning("Önce firma seçin", {
        description: "Yıllık çalışma planını kaydetmek ve resmi çıktı almak için firma seçimi zorunludur.",
      });
      return false;
    }

    return true;
  };

  const savePlan = async () => {
    if (!user || !ensureCompanySelected()) return;

    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const payload = {
        user_id: user.id,
        year: selectedYear,
        plan_type: "work_plan",
        title: `${selectedYear} Yıllık Çalışma Planı`,
        description: `${companyForm.companyName} için resmi yıllık çalışma planı`,
        plan_data: documentPayload as unknown as any,
        updated_at: new Date().toISOString(),
      };

      const { data: existingPlan, error: existingPlanError } = await supabase
        .from("annual_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("year", selectedYear)
        .eq("plan_type", "work_plan")
        .maybeSingle();

      if (existingPlanError) throw existingPlanError;

      if (existingPlan?.id) {
        const { error } = await supabase
          .from("annual_plans")
          .update(payload)
          .eq("id", existingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("annual_plans").insert(payload);
        if (error) throw error;
      }

      toast.success("Değişiklikler kaydedildi");
    } catch (error: any) {
      console.error("Annual work plan save failed:", error);
      toast.error("Plan kaydedilemedi", {
        description: error?.message || "Beklenmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    if (!ensureCompanySelected()) return;

    setExportingExcel(true);
    try {
      const headerRow = [
        "PERİYODİK FAALİYETLER",
        "PERİYOT",
        "SORUMLU",
        "İLGİLİ MEVZUAT",
        "MEVCUT DURUM",
        ...MONTH_HEADERS,
      ];

      const dataRows = rows.map((row) => [
        row.activity,
        row.period,
        row.responsible,
        row.regulation,
        row.currentStatus,
        ...row.months.map((active) => (active ? "X" : "")),
      ]);

      const sheetData = [
        ["İŞ SAĞLIĞI ve GÜVENLİĞİ YILLIK ÇALIŞMA PLANI"],
        [`${selectedYear} YILI ÇALIŞMA PLANI`],
        ["İş Yeri Unvanı:", companyForm.companyName, "İş Yeri Adresi:", companyForm.address],
        ["İş Yeri Sicil No:", companyForm.registrationNumber],
        [],
        headerRow,
        ...dataRows,
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      worksheet["!cols"] = [
        { wch: 34 },
        { wch: 14 },
        { wch: 26 },
        { wch: 44 },
        { wch: 18 },
        ...Array.from({ length: 12 }, () => ({ wch: 8 })),
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Yıllık Çalışma");
      XLSX.writeFile(
        workbook,
        `Yillik-Calisma-Plani-${companyForm.companyName || "Firma"}-${selectedYear}.xlsx`,
      );

      toast.success("Excel çıktısı indirildi");
    } catch (error: any) {
      console.error("Annual work plan excel export failed:", error);
      toast.error("Excel çıktısı oluşturulamadı", {
        description: error?.message || "Beklenmeyen hata",
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const exportWord = async () => {
    if (!ensureCompanySelected()) return;

    setExportingWord(true);
    try {
      await downloadAnnualWorkPlanOfficialDocx({
        company: companyForm,
        rows,
      });
      toast.success("Resmi Word çıktısı indirildi");
    } catch (error: any) {
      console.error("Annual work plan word export failed:", error);
      toast.error("Word çıktısı oluşturulamadı", {
        description: error?.message || "Beklenmeyen hata",
      });
    } finally {
      setExportingWord(false);
    }
  };

  if (loading) {
    return (
      <div className="theme-page-readable min-h-screen bg-background px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center">
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="px-6 py-5 text-sm text-muted-foreground">
              Yıllık çalışma planı hazırlanıyor...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-page-readable min-h-screen bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
                Resmi Word Şablonu
              </div>
              <div>
                <CardTitle className="text-3xl tracking-tight">Yıllık çalışma planı</CardTitle>
                <CardDescription className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Bakanlık formatındaki yıllık çalışma planını firma bazında yönetin, ayları kırmızı işaretleme ile
                  planlayın ve resmi Word veya Excel çıktısı alın.
                </CardDescription>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              {[
                {
                  label: "Seçili firma",
                  value: companyForm.companyName || "Seçilmedi",
                  className: statCardClasses[0],
                },
                {
                  label: "İşaretli ay",
                  value: String(activeMonthCount),
                  className: statCardClasses[1],
                },
                {
                  label: "Durum girilen satır",
                  value: String(completedRowCount),
                  className: statCardClasses[2],
                },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${item.className}`}>
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Firma bilgileri
                </CardTitle>
                <CardDescription className="mt-2 text-sm text-muted-foreground">
                  Resmi şablondaki firma alanları bu bilgilerle doldurulur. Firma seçince alanlar otomatik gelir, isterseniz
                  manuel olarak güncelleyebilirsiniz.
                </CardDescription>
              </div>

              <div className="w-full xl:w-44">
                <Label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Plan yılı
                </Label>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(value) => setSelectedYear(Number(value))}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, index) => currentYear - 1 + index).map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <Label>Firma seç</Label>
              <Select
                value={selectedCompanyId}
                onValueChange={(value) => {
                  const company = companies.find((item) => item.id === value);
                  if (company) {
                    applyCompany(company);
                  }
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Sistemdeki aktif firmalardan seçim yapın" />
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

            <Field label="Firma unvanı">
              <Input
                value={companyForm.companyName}
                onChange={(event) =>
                  setCompanyForm((previous) => ({ ...previous, companyName: event.target.value }))
                }
                className="bg-background"
              />
            </Field>

            <Field label="İş yeri sicil / vergi no">
              <Input
                value={companyForm.registrationNumber}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    registrationNumber: event.target.value,
                  }))
                }
                className="bg-background"
              />
            </Field>

            <Field label="Firma adresi" className="lg:col-span-2">
              <Input
                value={companyForm.address}
                onChange={(event) =>
                  setCompanyForm((previous) => ({ ...previous, address: event.target.value }))
                }
                className="bg-background"
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle>Resmi yıllık plan matrisi</CardTitle>
                <CardDescription className="mt-2 text-sm text-muted-foreground">
                  Ay hücrelerine tıklayarak resmi planlama işaretlerini kırmızı <span className="font-medium text-foreground">X</span> ile
                  oluşturun. Tüm alanlar light ve dark temada yüksek okunabilirlik için semantic tokenlarla düzenlendi.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={addRow} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Yeni Satır
                </Button>
                <Button onClick={() => void savePlan()} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </Button>
                <Button variant="outline" onClick={() => void exportExcel()} disabled={exportingExcel} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  {exportingExcel ? "Hazırlanıyor..." : "Excel Aktar"}
                </Button>
                <Button variant="secondary" onClick={() => void exportWord()} disabled={exportingWord} className="gap-2">
                  <Download className="h-4 w-4" />
                  {exportingWord ? "Hazırlanıyor..." : "Word Çıktısı"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-border">
              <Table className="min-w-[1680px]">
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="min-w-[420px] align-middle text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      PERİYODİK FAALİYETLER
                    </TableHead>
                    <TableHead className="min-w-[150px] text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      PERİYOT
                    </TableHead>
                    <TableHead className="min-w-[240px] text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      SORUMLU
                    </TableHead>
                    <TableHead className="min-w-[320px] text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      İLGİLİ MEVZUAT
                    </TableHead>
                    <TableHead className="min-w-[160px] text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      MEVCUT DURUM
                    </TableHead>
                    {MONTH_HEADERS.map((month) => (
                      <TableHead
                        key={month}
                        className="w-[70px] min-w-[70px] text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        {month}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="align-top">
                      <TableCell className="bg-card">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Faaliyet
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                              onClick={() => removeRow(row.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Textarea
                            value={row.activity}
                            onChange={(event) => updateRowField(row.id, "activity", event.target.value)}
                            className="min-h-[112px] resize-none border-0 bg-transparent px-0 text-sm font-medium text-foreground shadow-none focus-visible:ring-0"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="bg-card">
                        <Textarea
                          value={row.period}
                          onChange={(event) => updateRowField(row.id, "period", event.target.value)}
                          className="min-h-[88px] resize-none border-0 bg-transparent px-0 text-sm text-foreground shadow-none focus-visible:ring-0"
                        />
                      </TableCell>
                      <TableCell className="bg-card">
                        <Textarea
                          value={row.responsible}
                          onChange={(event) => updateRowField(row.id, "responsible", event.target.value)}
                          className="min-h-[88px] resize-none border-0 bg-transparent px-0 text-sm text-foreground shadow-none focus-visible:ring-0"
                        />
                      </TableCell>
                      <TableCell className="bg-card">
                        <Textarea
                          value={row.regulation}
                          onChange={(event) => updateRowField(row.id, "regulation", event.target.value)}
                          className="min-h-[88px] resize-none border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
                        />
                      </TableCell>
                      <TableCell className="bg-card">
                        <Input
                          value={row.currentStatus}
                          onChange={(event) => updateRowField(row.id, "currentStatus", event.target.value)}
                          placeholder="Örn. Hazır / Muaf"
                          className="bg-muted"
                        />
                      </TableCell>

                      {row.months.map((active, monthIndex) => (
                        <TableCell
                          key={`${row.id}-${MONTH_HEADERS[monthIndex]}`}
                          className={`cursor-pointer px-0 text-center transition-colors ${
                            active
                              ? "bg-red-500/90 hover:bg-red-500/90 dark:bg-red-600/80 dark:hover:bg-red-600/80"
                              : "bg-card hover:bg-muted/60"
                          }`}
                          onClick={() => toggleMonth(row.id, monthIndex)}
                        >
                          <div className="flex min-h-[88px] items-center justify-center">
                            {active ? (
                              <div className="h-9 w-9 rounded-md bg-red-600/95 shadow-sm dark:bg-red-500/90" />
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Kullanım notu</p>
                <p className="mt-2 text-sm text-foreground">
                  Ay hücresine her tıklamada ilgili faaliyet için plan işareti açılır veya kapanır.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Resmi çıktı</p>
                <p className="mt-2 text-sm text-foreground">
                  Word çıktısı doğrudan <span className="font-medium">İŞ SAĞLIĞI ve GÜVENLİĞİ YILLIK ÇALIŞMA PLANI.docx</span> şablonuna yazılır.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Firma verisi</p>
                <p className="mt-2 text-sm text-foreground">
                  Üstteki firma kartında seçilen unvan, adres ve sicil/vergi numarası resmi şablonun başlık alanına taşınır.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm text-foreground">{label}</Label>
      {children}
    </div>
  );
}
