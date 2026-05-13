import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Download, FileSpreadsheet, FileText, Plus, Save, Trash2 } from "lucide-react";
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
import { downloadAnnualWorkPlanPdf } from "@/lib/annualWorkPlanPdf";
import { downloadAnnualEvaluationPdf } from "@/lib/annualEvaluationPdf";
import { downloadAnnualTrainingPlanOfficialDocx } from "@/lib/annualTrainingPlanOfficialDocx";
import { downloadAnnualTrainingPlanPdf } from "@/lib/annualTrainingPlanPdf";

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

type AnnualPlansSection = "work-plan" | "annual-evaluation" | "annual-training";

type AnnualEvaluationWorkItem = {
  yapilanCalismalar: string;
  tarih: string;
  yapanKisiUnvani: string;
  tekrarSayisi: string;
  kullanilanYontem: string;
  sonucYorum: string;
};

type AnnualEvaluationCompanyFormState = {
  isyeriUnvani: string;
  sgkSicilNo: string;
  adres: string;
  telFax: string;
  eposta: string;
  iskolu: string;
  calisanErkek: string;
  calisanKadin: string;
  calisanGenc: string;
  calisanCocuk: string;
  calisanToplam: string;
};

type AnnualTrainingPlanItem = {
  egitimKonusu: string;
  egitimiVerecekKisiKurulus: string;
  planlananTarih: string;
  gerceklesenTarih: string;
  aciklamalar: string;
};

type AnnualTrainingPlanFormState = {
  isYeriUnvani: string;
  isYeriAdresi: string;
  isYeriSicilNo: string;
  isGuvenligiUzmani: string;
  isyeriHekimi: string;
  isverenVekili: string;
};

const currentYear = new Date().getFullYear();
const createEmptyAnnualEvaluationWork = (): AnnualEvaluationWorkItem => ({
  yapilanCalismalar: "",
  tarih: "",
  yapanKisiUnvani: "",
  tekrarSayisi: "",
  kullanilanYontem: "",
  sonucYorum: "",
});

const createEmptyAnnualTrainingPlanItem = (): AnnualTrainingPlanItem => ({
  egitimKonusu: "",
  egitimiVerecekKisiKurulus: "",
  planlananTarih: "",
  gerceklesenTarih: "",
  aciklamalar: "",
});

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
  const [selectedTrainingCompanyId, setSelectedTrainingCompanyId] = useState(searchParams.get("companyId") || "");
  const [activeSection, setActiveSection] = useState<AnnualPlansSection>("work-plan");
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
  const [exportingPdf, setExportingPdf] = useState(false);
  const [generatingAnnualEvaluationReport, setGeneratingAnnualEvaluationReport] = useState(false);
  const [generatingAnnualTrainingPlan, setGeneratingAnnualTrainingPlan] = useState(false);
  const [generatingAnnualTrainingPdf, setGeneratingAnnualTrainingPdf] = useState(false);
  const [annualEvaluationWorks, setAnnualEvaluationWorks] = useState<AnnualEvaluationWorkItem[]>([
    createEmptyAnnualEvaluationWork(),
  ]);
  const [annualEvaluationCompanyForm, setAnnualEvaluationCompanyForm] =
    useState<AnnualEvaluationCompanyFormState>({
    isyeriUnvani: "",
    sgkSicilNo: "",
    adres: "",
    telFax: "",
    eposta: "",
    iskolu: "",
    calisanErkek: "",
    calisanKadin: "",
    calisanGenc: "",
    calisanCocuk: "",
    calisanToplam: "",
  });
  const [annualTrainingPlanForm, setAnnualTrainingPlanForm] = useState<AnnualTrainingPlanFormState>({
    isYeriUnvani: "",
    isYeriAdresi: "",
    isYeriSicilNo: "",
    isGuvenligiUzmani: "",
    isyeriHekimi: "",
    isverenVekili: "",
  });
  const [annualTrainingPlanItems, setAnnualTrainingPlanItems] = useState<AnnualTrainingPlanItem[]>([
    createEmptyAnnualTrainingPlanItem(),
  ]);

  useEffect(() => {
    setCompanyForm((previous) => ({ ...previous, year: selectedYear }));
  }, [selectedYear]);

  useEffect(() => {
    setAnnualEvaluationCompanyForm((previous) => ({
      ...previous,
      isyeriUnvani: companyForm.companyName,
      sgkSicilNo: companyForm.registrationNumber,
      adres: companyForm.address,
    }));
  }, [companyForm.address, companyForm.companyName, companyForm.registrationNumber]);

  useEffect(() => {
    setAnnualTrainingPlanForm((previous) => ({
      ...previous,
      isYeriUnvani: companyForm.companyName,
      isYeriAdresi: companyForm.address,
      isYeriSicilNo: companyForm.registrationNumber,
    }));
  }, [companyForm.address, companyForm.companyName, companyForm.registrationNumber]);

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

  const loadOfficialTemplate = () => {
    setRows(createInitialRows());
    toast.success("Hazır resmi şablon yüklendi", {
      description:
        "Periyodik faaliyetler, periyot, sorumlu ve ilgili mevzuat alanları resmi matrise otomatik dolduruldu.",
    });
  };

  const handleAnnualEvaluationCompanyChange = (
    field: keyof AnnualEvaluationCompanyFormState,
    value: string,
  ) => {
    setAnnualEvaluationCompanyForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleAnnualEvaluationWorkChange = (
    index: number,
    field: keyof AnnualEvaluationWorkItem,
    value: string,
  ) => {
    setAnnualEvaluationWorks((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleAddAnnualEvaluationWork = () => {
    setAnnualEvaluationWorks((previous) => [...previous, createEmptyAnnualEvaluationWork()]);
  };

  const handleRemoveAnnualEvaluationWork = (index: number) => {
    setAnnualEvaluationWorks((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const handleAnnualTrainingPlanFormChange = (
    field: keyof AnnualTrainingPlanFormState,
    value: string,
  ) => {
    setAnnualTrainingPlanForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleAnnualTrainingPlanItemChange = (
    index: number,
    field: keyof AnnualTrainingPlanItem,
    value: string,
  ) => {
    setAnnualTrainingPlanItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleAddAnnualTrainingPlanItem = () => {
    setAnnualTrainingPlanItems((previous) => [...previous, createEmptyAnnualTrainingPlanItem()]);
  };

  const handleRemoveAnnualTrainingPlanItem = (index: number) => {
    setAnnualTrainingPlanItems((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const applyTrainingCompany = (company: CompanyOption) => {
    setSelectedTrainingCompanyId(company.id);
    setAnnualTrainingPlanForm((previous) => ({
      ...previous,
      isYeriUnvani: company.name || "",
      isYeriAdresi: company.address || "",
      isYeriSicilNo: company.registry_no || company.tax_number || "",
    }));
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

  const exportPdf = async () => {
    if (!ensureCompanySelected()) return;

    setExportingPdf(true);
    try {
      await downloadAnnualWorkPlanPdf({
        company: companyForm,
        rows,
      });
      toast.success("PDF çıktısı indirildi");
    } catch (error: any) {
      console.error("Annual work plan pdf export failed:", error);
      toast.error("PDF çıktısı oluşturulamadı", {
        description: error?.message || "Beklenmeyen hata",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGenerateAnnualEvaluationReport = async () => {
    setGeneratingAnnualEvaluationReport(true);

    try {
      await downloadAnnualEvaluationPdf({
        company: annualEvaluationCompanyForm,
        works: annualEvaluationWorks,
        year: selectedYear,
      });
      toast.success("Yıllık değerlendirme raporu PDF olarak oluşturuldu");
    } catch (error) {
      console.error("Annual evaluation report generation failed:", error);
      alert("Yıllık değerlendirme raporu oluşturulurken bir hata oluştu.");
    } finally {
      setGeneratingAnnualEvaluationReport(false);
    }
  };

  const handleGenerateAnnualTrainingPlan = async () => {
    setGeneratingAnnualTrainingPlan(true);

    try {
      await downloadAnnualTrainingPlanOfficialDocx({
        year: selectedYear,
        form: annualTrainingPlanForm,
        items: annualTrainingPlanItems,
      });
      toast.success("İSG yıllık eğitim planı oluşturuldu");
    } catch (error) {
      console.error("İSG yıllık eğitim planı oluşturma hatası:", error);
      alert("İSG yıllık eğitim planı oluşturulurken bir hata oluştu.");
    } finally {
      setGeneratingAnnualTrainingPlan(false);
    }
  };

  const handleGenerateAnnualTrainingPdf = async () => {
    setGeneratingAnnualTrainingPdf(true);

    try {
      await downloadAnnualTrainingPlanPdf({
        year: selectedYear,
        form: annualTrainingPlanForm,
        items: annualTrainingPlanItems,
      });
      toast.success("İSG yıllık eğitim planı PDF olarak oluşturuldu");
    } catch (error) {
      console.error("İSG yıllık eğitim planı PDF oluşturma hatası:", error);
      alert("İSG yıllık eğitim planı PDF oluşturulurken bir hata oluştu.");
    } finally {
      setGeneratingAnnualTrainingPdf(false);
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
                  planlayın ve resmi Word, Excel veya PDF çıktısı alın.
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
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setActiveSection("work-plan")}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  activeSection === "work-plan"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-background hover:bg-muted/60"
                }`}
              >
                <div className="text-sm font-semibold text-foreground">Yıllık Çalışma Planı</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Resmi matrisi yönetin, ayları işaretleyin ve Word, Excel, PDF çıktısı alın.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("annual-evaluation")}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  activeSection === "annual-evaluation"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-background hover:bg-muted/60"
                }`}
              >
                <div className="text-sm font-semibold text-foreground">YILLIK DEĞERLENDİRME RAPORU</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Değerlendirme alanlarını doldurun ve hazır şablondan `.docx` rapor üretin.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("annual-training")}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  activeSection === "annual-training"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-background hover:bg-muted/60"
                }`}
              >
                <div className="text-sm font-semibold text-foreground">İSG Yıllık Eğitim Planı</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  İş yeri, eğitim satırları ve imza bilgilerini girip dinamik Word çıktısı alın.
                </p>
              </button>
            </div>
          </CardContent>
        </Card>

        {activeSection === "work-plan" ? (
          <>
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
                      Ay hücrelerine tıklayarak resmi planlama işaretlerini kırmızı dolgu ile oluşturun. Tüm alanlar light ve
                      dark temada yüksek okunabilirlik için semantic tokenlarla düzenlendi.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={loadOfficialTemplate} className="gap-2">
                      <Download className="h-4 w-4" />
                      Hazır Şablonu Yükle
                    </Button>
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
                    <Button variant="outline" onClick={() => void exportPdf()} disabled={exportingPdf} className="gap-2">
                      <FileText className="h-4 w-4" />
                      {exportingPdf ? "Hazırlanıyor..." : "PDF Çıktısı"}
                    </Button>
                    <Button variant="secondary" onClick={() => void exportWord()} disabled={exportingWord} className="gap-2">
                      <Download className="h-4 w-4" />
                      {exportingWord ? "Hazırlanıyor..." : "Word Çıktısı"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">Hazır resmi şablon yükleme alanı</div>
                    </div>
                    <Button type="button" variant="outline" onClick={loadOfficialTemplate} className="gap-2">
                      <Download className="h-4 w-4" />
                      Şablonu Yeniden Doldur
                    </Button>
                  </div>
                </div>

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
          </>
        ) : null}

        {activeSection === "annual-evaluation" ? (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>YILLIK DEĞERLENDİRME RAPORU</CardTitle>
            <CardDescription className="mt-2 text-sm text-muted-foreground">
              Hazır Word şablonundaki değerlendirme raporu alanlarını doldurun ve tek tıkla
              `.docx` çıktısı alın.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-4 text-sm font-semibold text-foreground">İş Yeri Bilgileri</div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="İş Yerinin Unvanı Seç">
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
                      <SelectValue placeholder="Sistemdeki firmalarınızdan seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="İş Yerinin Unvanı">
                  <Input
                    value={annualEvaluationCompanyForm.isyeriUnvani}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("isyeriUnvani", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="SGK / Bölge Müdürlüğü Sicil No">
                  <Input
                    value={annualEvaluationCompanyForm.sgkSicilNo}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("sgkSicilNo", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="Adres" className="lg:col-span-2">
                  <Textarea
                    value={annualEvaluationCompanyForm.adres}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("adres", event.target.value)
                    }
                    className="min-h-[100px] bg-background"
                  />
                </Field>

                <Field label="Tel ve Fax">
                  <Input
                    value={annualEvaluationCompanyForm.telFax}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("telFax", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="E-posta">
                  <Input
                    value={annualEvaluationCompanyForm.eposta}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("eposta", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="İşkolu" className="lg:col-span-2">
                  <Input
                    value={annualEvaluationCompanyForm.iskolu}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("iskolu", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-4 text-sm font-semibold text-foreground">Çalışan Sayısı</div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Field label="Çalışan Sayısı Erkek">
                  <Input
                    type="number"
                    value={annualEvaluationCompanyForm.calisanErkek}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("calisanErkek", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="Çalışan Sayısı Kadın">
                  <Input
                    type="number"
                    value={annualEvaluationCompanyForm.calisanKadin}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("calisanKadin", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="Çalışan Sayısı Genç">
                  <Input
                    type="number"
                    value={annualEvaluationCompanyForm.calisanGenc}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("calisanGenc", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="Çalışan Sayısı Çocuk">
                  <Input
                    type="number"
                    value={annualEvaluationCompanyForm.calisanCocuk}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("calisanCocuk", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="Çalışan Sayısı Toplam">
                  <Input
                    type="number"
                    value={annualEvaluationCompanyForm.calisanToplam}
                    onChange={(event) =>
                      handleAnnualEvaluationCompanyChange("calisanToplam", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">Yapılan Çalışmalar</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Word şablonundaki tablo satırları bu listedeki çalışmalarla çoğaltılır.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddAnnualEvaluationWork}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Yeni Çalışma Ekle
                </Button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <Table className="min-w-[1320px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-16 text-center">Sıra No</TableHead>
                      <TableHead className="min-w-[220px]">Yapılan Çalışmalar</TableHead>
                      <TableHead className="min-w-[150px]">Tarih</TableHead>
                      <TableHead className="min-w-[220px]">Yapan Kişi ve Unvanı</TableHead>
                      <TableHead className="min-w-[140px]">Tekrar Sayısı</TableHead>
                      <TableHead className="min-w-[200px]">Kullanılan Yöntem</TableHead>
                      <TableHead className="min-w-[240px]">Sonuç ve Yorum</TableHead>
                      <TableHead className="w-28 text-center">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annualEvaluationWorks.map((item, index) => (
                      <TableRow key={`annual-evaluation-work-${index}`} className="align-top">
                        <TableCell className="pt-4 text-center text-sm font-semibold text-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={item.yapilanCalismalar}
                            onChange={(event) =>
                              handleAnnualEvaluationWorkChange(index, "yapilanCalismalar", event.target.value)
                            }
                            className="min-h-[110px] bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.tarih}
                            onChange={(event) =>
                              handleAnnualEvaluationWorkChange(index, "tarih", event.target.value)
                            }
                            placeholder="Örn. Ekim 20"
                            className="bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.yapanKisiUnvani}
                            onChange={(event) =>
                              handleAnnualEvaluationWorkChange(index, "yapanKisiUnvani", event.target.value)
                            }
                            className="bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.tekrarSayisi}
                            onChange={(event) =>
                              handleAnnualEvaluationWorkChange(index, "tekrarSayisi", event.target.value)
                            }
                            placeholder="Örn. 4 / Ekim 20"
                            className="bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.kullanilanYontem}
                            onChange={(event) =>
                              handleAnnualEvaluationWorkChange(index, "kullanilanYontem", event.target.value)
                            }
                            className="bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={item.sonucYorum}
                            onChange={(event) =>
                              handleAnnualEvaluationWorkChange(index, "sonucYorum", event.target.value)
                            }
                            className="min-h-[110px] bg-background"
                          />
                        </TableCell>
                        <TableCell className="pt-4 text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAnnualEvaluationWork(index)}
                            disabled={annualEvaluationWorks.length <= 1}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Sil
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void handleGenerateAnnualEvaluationReport()}
                disabled={generatingAnnualEvaluationReport}
                className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {generatingAnnualEvaluationReport
                    ? "PDF Oluşturuluyor..."
                    : "Yıllık Değerlendirme Raporu PDF Oluştur"}
                </Button>
              </div>
          </CardContent>
        </Card>
        ) : null}

        {activeSection === "annual-training" ? (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>İŞ SAĞLIĞI ve GÜVENLİĞİ YILLIK EĞİTİM PLANI</CardTitle>
            <CardDescription className="mt-2 text-sm text-muted-foreground">
              İş yeri bilgilerini, eğitim planı satırlarını ve imza alanlarını doldurun. Word şablonunda
              eğitim tablosu yalnızca eklediğiniz satır kadar çoğaltılmalıdır.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-4 text-sm font-semibold text-foreground">İş Yeri Bilgileri</div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="İş Yeri Unvanı Seç">
                  <Select
                    value={selectedTrainingCompanyId}
                    onValueChange={(value) => {
                      const company = companies.find((item) => item.id === value);
                      if (company) {
                        applyTrainingCompany(company);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Sistemdeki firmalarınızdan seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="İş Yeri Unvanı">
                  <Input
                    value={annualTrainingPlanForm.isYeriUnvani}
                    onChange={(event) =>
                      handleAnnualTrainingPlanFormChange("isYeriUnvani", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="İş Yeri Sicil No">
                  <Input
                    value={annualTrainingPlanForm.isYeriSicilNo}
                    onChange={(event) =>
                      handleAnnualTrainingPlanFormChange("isYeriSicilNo", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="İş Yeri Adresi" className="lg:col-span-2">
                  <Textarea
                    value={annualTrainingPlanForm.isYeriAdresi}
                    onChange={(event) =>
                      handleAnnualTrainingPlanFormChange("isYeriAdresi", event.target.value)
                    }
                    className="min-h-[110px] bg-background"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">Eğitim Planı Satırları</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Word şablonunda sabit 12 satır yerine tek bir Docxtemplater loop satırı kullanılmalıdır.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddAnnualTrainingPlanItem}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Yeni Eğitim Satırı Ekle
                </Button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <Table className="min-w-[1240px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-16 text-center">Sıra No</TableHead>
                      <TableHead className="min-w-[220px]">Eğitim Konusu</TableHead>
                      <TableHead className="min-w-[220px]">Eğitimi Verecek Kişi/Kuruluş</TableHead>
                      <TableHead className="min-w-[150px]">Planlanan Tarih</TableHead>
                      <TableHead className="min-w-[150px]">Gerçekleşen Tarih</TableHead>
                      <TableHead className="min-w-[240px]">Açıklamalar</TableHead>
                      <TableHead className="w-28 text-center">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annualTrainingPlanItems.map((item, index) => (
                      <TableRow key={`annual-training-plan-item-${index}`} className="align-top">
                        <TableCell className="pt-4 text-center text-sm font-semibold text-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={item.egitimKonusu}
                            onChange={(event) =>
                              handleAnnualTrainingPlanItemChange(index, "egitimKonusu", event.target.value)
                            }
                            className="min-h-[110px] bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.egitimiVerecekKisiKurulus}
                            onChange={(event) =>
                              handleAnnualTrainingPlanItemChange(index, "egitimiVerecekKisiKurulus", event.target.value)
                            }
                            className="bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={item.planlananTarih}
                            onChange={(event) =>
                              handleAnnualTrainingPlanItemChange(index, "planlananTarih", event.target.value)
                            }
                            placeholder="Örn. Ekim 2026"
                            className="bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={item.gerceklesenTarih}
                            onChange={(event) =>
                              handleAnnualTrainingPlanItemChange(index, "gerceklesenTarih", event.target.value)
                            }
                            placeholder="Örn. 20 Ekim 2026"
                            className="bg-background"
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={item.aciklamalar}
                            onChange={(event) =>
                              handleAnnualTrainingPlanItemChange(index, "aciklamalar", event.target.value)
                            }
                            className="min-h-[110px] bg-background"
                          />
                        </TableCell>
                        <TableCell className="pt-4 text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAnnualTrainingPlanItem(index)}
                            disabled={annualTrainingPlanItems.length <= 1}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Sil
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-4 text-sm font-semibold text-foreground">İmza / Onay Bilgileri</div>
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="İş Güvenliği Uzmanı">
                  <Input
                    value={annualTrainingPlanForm.isGuvenligiUzmani}
                    onChange={(event) =>
                      handleAnnualTrainingPlanFormChange("isGuvenligiUzmani", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="İşyeri Hekimi">
                  <Input
                    value={annualTrainingPlanForm.isyeriHekimi}
                    onChange={(event) =>
                      handleAnnualTrainingPlanFormChange("isyeriHekimi", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>

                <Field label="İşveren / İ.Vekili">
                  <Input
                    value={annualTrainingPlanForm.isverenVekili}
                    onChange={(event) =>
                      handleAnnualTrainingPlanFormChange("isverenVekili", event.target.value)
                    }
                    className="bg-background"
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleGenerateAnnualTrainingPdf()}
                disabled={generatingAnnualTrainingPdf}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                {generatingAnnualTrainingPdf
                  ? "PDF Oluşturuluyor..."
                  : "İSG Yıllık Eğitim Planı PDF Oluştur"}
              </Button>
              <Button
                type="button"
                onClick={() => void handleGenerateAnnualTrainingPlan()}
                disabled={generatingAnnualTrainingPlan}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {generatingAnnualTrainingPlan
                  ? "Word Oluşturuluyor..."
                  : "İSG Yıllık Eğitim Planı Word Oluştur"}
              </Button>
            </div>
          </CardContent>
        </Card>
        ) : null}
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
