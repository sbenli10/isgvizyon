import { useState, useEffect, useMemo } from "react";
import { 
  Calendar, Plus, Download, FileSpreadsheet, Users, 
  ClipboardList, Trash2, Save, Sparkles, CheckCircle2,
  AlertCircle, Clock, XCircle, Building2, ShieldCheck, TrendingUp, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  generateWorkPlanPDF, 
  generateTrainingPlanPDF,
  generateEvaluationReportPDF 
} from "@/utils/generateAnnualPlanPDF";
import type { 
  WorkPlanRow, 
  TrainingPlanRow, 
  TrainingPlanMeta,
  EvaluationRow, 
  MonthStatus,
  AnnualPlanData 
} from "@/types/annualPlans";
import { 
  WORK_PLAN_TEMPLATE, 
  TRAINING_PLAN_TEMPLATE, 
  MONTH_NAMES 
} from "@/types/annualPlans";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const currentYear = new Date().getFullYear();
const EDUCATION_TEMPLATE_MAX_ROWS = 12;
const EDUCATION_TEMPLATE_PATH = "/templates/yillik-egitim-template.xlsx";

export default function AnnualPlans() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("work_plan");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<"work_plan" | "training_plan" | "evaluation">("work_plan");

  // ✅ State Management
  const [workPlan, setWorkPlan] = useState<WorkPlanRow[]>([]);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlanRow[]>([]);
  const [evaluationReport, setEvaluationReport] = useState<EvaluationRow[]>([]);
  const [trainingMeta, setTrainingMeta] = useState<TrainingPlanMeta>({
    workplaceTitle: "",
    workplaceAddress: "",
    workplaceRegistrationNo: "",
    specialistName: "",
    doctorName: "",
    employerRepresentativeName: "",
    organizationLogoUrl: "",
  });

  const plannedWorkCount = useMemo(
    () =>
      workPlan.reduce(
        (sum, row) => sum + Object.values(row.months).filter((status) => status === "planned").length,
        0
      ),
    [workPlan]
  );
  const completedWorkCount = useMemo(
    () =>
      workPlan.reduce(
        (sum, row) => sum + Object.values(row.months).filter((status) => status === "completed").length,
        0
      ),
    [workPlan]
  );
  const activeWorkRows = useMemo(
    () => workPlan.filter((row) => row.activity_name.trim() || row.responsible.trim()).length,
    [workPlan]
  );

  // ✅ Load Data
  useEffect(() => {
    loadPlans();
  }, [selectedYear, user]);

  useEffect(() => {
    const loadOrganizationName = async () => {
      if (!user) return;
      const fallbackName = user.email || "İSGVizyon";

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id) {
        setOrganizationName(fallbackName);
        return;
      }

      const { data: organization } = await supabase
        .from("organizations")
        .select("name, logo_url")
        .eq("id", profile.organization_id)
        .single();

      setOrganizationName(organization?.name || fallbackName);
      setOrganizationLogoUrl(organization?.logo_url || "");
    };

    void loadOrganizationName();
  }, [user]);

  useEffect(() => {
    setTrainingMeta((prev) => ({
      ...prev,
      workplaceTitle: prev.workplaceTitle || organizationName,
      specialistName: prev.specialistName || (user?.email?.split("@")[0] ?? ""),
      organizationLogoUrl: prev.organizationLogoUrl || organizationLogoUrl,
    }));
  }, [organizationLogoUrl, organizationName, user]);

  const loadPlans = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("annual_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", selectedYear);

      if (error) throw error;

      if (data && data.length > 0) {
        data.forEach(plan => {
         if (plan.plan_type === "work_plan") {
        setWorkPlan((plan.plan_data as unknown) as WorkPlanRow[]);
        } else if (plan.plan_type === "training_plan") {
        const trainingData = plan.plan_data as unknown;
        if (Array.isArray(trainingData)) {
          setTrainingPlan(
            (trainingData as any[]).map((row) => ({
              id: row.id || crypto.randomUUID(),
              topic: row.topic || "",
              provider: row.provider || row.trainer || "",
              planned_date:
                row.planned_date ||
                (typeof row.planned_month === "number" ? MONTH_NAMES[row.planned_month] : ""),
              actual_date: row.actual_date || "",
              notes:
                row.notes ||
                [
                  typeof row.duration_hours === "number" ? `${row.duration_hours} saat` : null,
                  typeof row.target_participants === "number" ? `${row.target_participants} katılımcı` : null,
                ]
                  .filter(Boolean)
                  .join(" • "),
            }))
          );
        } else if (trainingData && typeof trainingData === "object") {
          const typedData = trainingData as { rows?: TrainingPlanRow[]; meta?: Partial<TrainingPlanMeta> };
          setTrainingPlan(typedData.rows || []);
          setTrainingMeta((prev) => ({
            ...prev,
            ...(typedData.meta || {}),
          }));
        }
        } else if (plan.plan_type === "evaluation_report") {
        setEvaluationReport((plan.plan_data as unknown) as EvaluationRow[]);
        }
        });
        toast.success(`${selectedYear} yılı planları yüklendi`);
      } else {
        // Boş başlat
        setWorkPlan([]);
        setTrainingPlan([]);
        setEvaluationReport([]);
        setTrainingMeta({
          workplaceTitle: organizationName,
          workplaceAddress: "",
          workplaceRegistrationNo: "",
          specialistName: user?.email?.split("@")[0] ?? "",
          doctorName: "",
          employerRepresentativeName: "",
          organizationLogoUrl,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Yükleme hatası: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ YENİ:
const savePlan = async (planType: 'work_plan' | 'training_plan' | 'evaluation_report') => {
  if (!user) return;

  setSaving(true);
  try {
    const planData = 
      planType === 'work_plan' ? workPlan :
      planType === 'training_plan' ? { rows: trainingPlan, meta: trainingMeta } :
      evaluationReport;

    // JSON serialization için type-safe dönüşüm
    const planDataJson = JSON.parse(JSON.stringify(planData));

    // Önce mevcut kaydı kontrol et
    const { data: existing } = await supabase
      .from("annual_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("year", selectedYear)
      .eq("plan_type", planType)
      .single();

    if (existing) {
      // Güncelle
      const { error } = await supabase
        .from("annual_plans")
        .update({ 
          plan_data: planDataJson, // ✅ Düzeltildi
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      // Yeni kayıt
      const { error } = await supabase
        .from("annual_plans")
        .insert({
          user_id: user.id,
          plan_type: planType,
          year: selectedYear,
          plan_data: planDataJson, // ✅ Düzeltildi
          title: `${selectedYear} ${
            planType === 'work_plan' ? 'Çalışma Planı' :
            planType === 'training_plan' ? 'Eğitim Planı' :
            'Değerlendirme Raporu'
          }`
        });

      if (error) throw error;
    }

    toast.success("✅ Plan kaydedildi");
  } catch (e: any) {
    console.error(e);
    toast.error(`❌ Kaydetme hatası: ${e.message}`);
  } finally {
    setSaving(false);
  }
};

  // ========================
  // WORK PLAN FUNCTIONS
  // ========================
  const addWorkPlanRow = () => {
    const newRow: WorkPlanRow = {
      id: crypto.randomUUID(),
      activity_name: "",
      responsible: "",
      months: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i, "empty"]))
    };
    setWorkPlan([...workPlan, newRow]);
  };

  const updateWorkPlanRow = (id: string, field: keyof WorkPlanRow, value: any) => {
    setWorkPlan(prev => prev.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const toggleMonthStatus = (rowId: string, monthIndex: number) => {
    setWorkPlan(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const currentStatus = row.months[monthIndex];
      const nextStatus: MonthStatus = 
        currentStatus === "empty" ? "planned" :
        currentStatus === "planned" ? "completed" :
        "empty";

      return {
        ...row,
        months: { ...row.months, [monthIndex]: nextStatus }
      };
    }));
  };

  const removeWorkPlanRow = (id: string) => {
    setWorkPlan(prev => prev.filter(row => row.id !== id));
  };

  const loadWorkPlanTemplate = () => {
    const templateWithIds = WORK_PLAN_TEMPLATE.map(row => ({
      ...row,
      id: crypto.randomUUID()
    }));
    setWorkPlan(templateWithIds);
    toast.success("✅ Şablon yüklendi");
  };

  // ========================
  // TRAINING PLAN FUNCTIONS
  // ========================
  const addTrainingPlanRow = () => {
    const newRow: TrainingPlanRow = {
      id: crypto.randomUUID(),
      topic: "",
      provider: "",
      planned_date: "",
      actual_date: "",
      notes: "",
    };
    setTrainingPlan([...trainingPlan, newRow]);
  };

  const updateTrainingPlanRow = (id: string, field: keyof TrainingPlanRow, value: any) => {
    setTrainingPlan(prev => prev.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const removeTrainingPlanRow = (id: string) => {
    setTrainingPlan(prev => prev.filter(row => row.id !== id));
  };

  const updateTrainingMeta = (field: keyof TrainingPlanMeta, value: string) => {
    setTrainingMeta((prev) => ({ ...prev, [field]: value }));
  };

  const loadTrainingPlanTemplate = () => {
    const templateWithIds = TRAINING_PLAN_TEMPLATE.map(row => ({
      ...row,
      id: crypto.randomUUID()
    }));
    setTrainingPlan(templateWithIds);
    toast.success("✅ Şablon yüklendi");
  };

  // ========================
  // EVALUATION REPORT FUNCTIONS
  // ========================
  const addEvaluationRow = () => {
    const newRow: EvaluationRow = {
      id: crypto.randomUUID(),
      activity: "",
      planned_date: "",
      actual_date: "",
      status: "pending",
      result_comment: ""
    };
    setEvaluationReport([...evaluationReport, newRow]);
  };

  const updateEvaluationRow = (id: string, field: keyof EvaluationRow, value: any) => {
    setEvaluationReport(prev => prev.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ));
  };
  
  const removeEvaluationRow = (id: string) => {
    setEvaluationReport(prev => prev.filter(row => row.id !== id));
  };

  const exportWorkPlanPDF = async () => {
    if (workPlan.length === 0) {
      toast.error("Dışa aktarılacak veri yok");
      return;
    }
    toast.info("📄 PDF oluşturuluyor...");
    try {
      const blob = await generateWorkPlanPDF(workPlan, selectedYear, user?.email || "İşyeri");
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Calisma-Plani-${selectedYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("✅ PDF indirildi");
    } catch (e: any) {
      toast.error(`❌ PDF hatası: ${e.message}`);
    }
  };
  const exportWorkPlanExcel = () => {
    if (workPlan.length === 0) {
      toast.error("Dışa aktarılacak veri yok");
      return;
    }
    const workbook = XLSX.utils.book_new();
    const companyLabel = organizationName || user?.email || "İSGVizyon";
    const wsData: Array<Array<string>> = [
      ["", "", "", `${selectedYear} YILI ÇALIŞMA PLANI`],
      ["İşletme / Kurum", companyLabel, "", `Yıl: ${selectedYear}`],
      ["Plan tipi", "Yıllık çalışma planı", "", "Kaynak: AnnualPlans"],
      [],
      ["Faaliyet", "Sorumlu", ...MONTH_NAMES.map((month) => month.substring(0, 3))],
      ...workPlan.map((row) => [
        row.activity_name || "-",
        row.responsible || "-",
        ...Array.from({ length: 12 }, (_, monthIndex) => {
          const status = row.months[monthIndex];
          return status === "planned" ? "P" : status === "completed" ? "✓" : "";
        }),
      ]),
      [],
      ["Lejant", "P = Planlandı", "✓ = Tamamlandı"],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    worksheet["!cols"] = [
      { wch: 36 },
      { wch: 24 },
      ...Array.from({ length: 12 }, () => ({ wch: 8 })),
    ];
    worksheet["!merges"] = [
      XLSX.utils.decode_range("D1:N1"),
      XLSX.utils.decode_range("B2:C2"),
    ];
    styleAnnualWorksheet(worksheet, "A1:N8", {
      titleCell: "D1",
      metaCells: ["A2", "A3"],
      headerRowIndex: 4,
      totalRows: wsData.length,
      stripedStartRow: 5,
      stripedColumns: 14,
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "YILLIK ÇALIŞMA");
    XLSX.writeFile(workbook, `Yillik-Calisma-Plani-${selectedYear}.xlsx`);
    toast.success("Excel çıktısı indirildi");
  };

  const exportTrainingPlanPDF = async () => {
    if (trainingPlan.length === 0) {
      toast.error("Dışa aktarılacak veri yok");
      return;
    }

    toast.info("📄 PDF oluşturuluyor...");
    try {
      const blob = await generateTrainingPlanPDF(
        trainingPlan,
        selectedYear,
        user?.email || "İşyeri",
        trainingMeta
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Egitim-Plani-${selectedYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("✅ PDF indirildi");
    } catch (e: any) {
      toast.error(`❌ PDF hatası: ${e.message}`);
    }
  };

  const exportTrainingPlanExcel = async () => {
    if (trainingPlan.length === 0) {
      toast.error("Dışa aktarılacak veri yok");
      return;
    }
    if (trainingPlan.length > EDUCATION_TEMPLATE_MAX_ROWS) {
      toast.warning(`Şablon düzeni en fazla ${EDUCATION_TEMPLATE_MAX_ROWS} eğitim satırı destekliyor. İlk ${EDUCATION_TEMPLATE_MAX_ROWS} satır kullanılacak.`);
    }
    try {
      const response = await fetch(EDUCATION_TEMPLATE_PATH, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Yıllık eğitim Excel şablonu yüklenemedi");
      }

      const zip = await JSZip.loadAsync(await response.arrayBuffer());
      const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
      const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
      const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");

      if (!workbookXml || !workbookRelsXml || !sharedStringsXml) {
        throw new Error("Template workbook yapısı okunamadı");
      }

      const sheetTarget = getWorkbookSheetTarget(workbookXml, workbookRelsXml, "YILLIK EĞİTİM");
      if (!sheetTarget) {
        throw new Error("YILLIK EĞİTİM sayfası template içinde bulunamadı");
      }

      const normalizedTarget = sheetTarget.startsWith("xl/") ? sheetTarget : `xl/${sheetTarget.replace(/^\/+/, "")}`;
      const sheetXml = await zip.file(normalizedTarget)?.async("string");
      if (!sheetXml) {
        throw new Error("YILLIK EĞİTİM sayfa XML'i okunamadı");
      }

      const parser = new DOMParser();
      const serializer = new XMLSerializer();
      const sheetDoc = parser.parseFromString(sheetXml, "application/xml");
      const sharedStringsDoc = parser.parseFromString(sharedStringsXml, "application/xml");
      const companyLabel = organizationName || user?.email || "İSGVizyon";
      const templateRows = trainingPlan.slice(0, EDUCATION_TEMPLATE_MAX_ROWS);

      setWorksheetSharedString(sheetDoc, sharedStringsDoc, "B2", `${selectedYear} YILI EĞİTİM PLANI`);
      setWorksheetSharedString(sheetDoc, sharedStringsDoc, "C3", trainingMeta.workplaceTitle || companyLabel || "0");
      setWorksheetSharedString(sheetDoc, sharedStringsDoc, "F3", trainingMeta.workplaceAddress || "0");
      setWorksheetSharedString(sheetDoc, sharedStringsDoc, "C4", trainingMeta.workplaceRegistrationNo || "0");
      setWorksheetSharedString(sheetDoc, sharedStringsDoc, "B22", trainingMeta.specialistName || "0");
      setWorksheetSharedString(sheetDoc, sharedStringsDoc, "D22", trainingMeta.doctorName || "0");
      setWorksheetSharedString(sheetDoc, sharedStringsDoc, "F22", trainingMeta.employerRepresentativeName || "0");

      templateRows.forEach((row, index) => {
        const rowNumber = 6 + index;
        setWorksheetSharedString(sheetDoc, sharedStringsDoc, `A${rowNumber}`, `${index + 1}`);
        setWorksheetSharedString(sheetDoc, sharedStringsDoc, `B${rowNumber}`, row.topic || "");
        setWorksheetSharedString(sheetDoc, sharedStringsDoc, `C${rowNumber}`, row.provider || "");
        setWorksheetSharedString(sheetDoc, sharedStringsDoc, `D${rowNumber}`, row.planned_date || "");
        setWorksheetSharedString(sheetDoc, sharedStringsDoc, `E${rowNumber}`, row.actual_date || "");
        setWorksheetSharedString(sheetDoc, sharedStringsDoc, `F${rowNumber}`, row.notes || "");
      });

      for (let index = templateRows.length; index < EDUCATION_TEMPLATE_MAX_ROWS; index += 1) {
        const rowNumber = 6 + index;
        ["A", "B", "C", "D", "E", "F"].forEach((column) => {
          setWorksheetSharedString(sheetDoc, sharedStringsDoc, `${column}${rowNumber}`, column === "A" ? `${index + 1}` : "");
        });
      }

      zip.file(normalizedTarget, serializer.serializeToString(sheetDoc));
      zip.file("xl/sharedStrings.xml", serializer.serializeToString(sharedStringsDoc));
      await removeCalcChainArtifacts(zip);

      const output = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(output);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Yillik-Egitim-Plani-${selectedYear}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Excel çıktısı referans şablon düzeniyle indirildi");
    } catch (e: any) {
      console.error(e);
      toast.error(`Excel export hatası: ${e.message}`);
    }
  };

  const exportEvaluationPDF = async () => {
    if (evaluationReport.length === 0) {
      toast.error("Dışa aktarılacak veri yok");
      return;
    }

    toast.info("📄 PDF oluşturuluyor...");
    try {
      const blob = await generateEvaluationReportPDF(evaluationReport, selectedYear, user?.email || "İşyeri");
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Degerlendirme-Raporu-${selectedYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("✅ PDF indirildi");
    } catch (e: any) {
      toast.error(`❌ PDF hatası: ${e.message}`);
    }
  };

  const exportEvaluationExcel = () => {
    if (evaluationReport.length === 0) {
      toast.error("Dışa aktarılacak veri yok");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const companyLabel = organizationName || user?.email || "İSGVizyon";
    const wsData: Array<Array<string>> = [
      ["", "", "", `${selectedYear} YILI DEĞERLENDİRME RAPORU`],
      ["İşletme / Kurum", companyLabel, "", `Yıl: ${selectedYear}`],
      ["Plan tipi", "Yıllık değerlendirme raporu", "", "Kaynak: AnnualPlans"],
      [],
      ["No", "Faaliyet", "Planlanan Tarih", "Gerçekleşen Tarih", "Durum", "Sonuç ve Yorum"],
      ...evaluationReport.map((row, index) => [
        `${index + 1}`,
        row.activity || "-",
        row.planned_date || "-",
        row.actual_date || "-",
        row.status === "completed" ? "Tamamlandı" : row.status === "pending" ? "Beklemede" : "İptal",
        row.result_comment || "-",
      ]),
      [],
      [
        "Özet",
        `Toplam faaliyet: ${evaluationReport.length}`,
        `Tamamlanan: ${evaluationReport.filter((row) => row.status === "completed").length}`,
      ],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 34 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 40 },
    ];
    worksheet["!merges"] = [
      XLSX.utils.decode_range("D1:F1"),
      XLSX.utils.decode_range("B2:C2"),
    ];
    styleAnnualWorksheet(worksheet, "A1:F8", {
      titleCell: "D1",
      metaCells: ["A2", "A3"],
      headerRowIndex: 4,
      totalRows: wsData.length,
      stripedStartRow: 5,
      stripedColumns: 6,
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "YILLIK DEĞERLENDİRME");
    XLSX.writeFile(workbook, `Yillik-Degerlendirme-Raporu-${selectedYear}.xlsx`);
    toast.success("Excel çıktısı indirildi");
  };

  const overviewCards = [
    {
      label: "Aktif faaliyet",
      value: activeWorkRows,
      description: "Takvimde işaretlenen veya sorumlusu belirlenen satırlar",
      icon: ClipboardList,
      tone: "from-cyan-500/20 via-cyan-500/10 to-transparent",
    },
    {
      label: "Planlanan adım",
      value: plannedWorkCount,
      description: "Aylık çalışma planında işaretlenen planlı adımlar",
      icon: Clock,
      tone: "from-amber-500/20 via-amber-500/10 to-transparent",
    },
    {
      label: "Tamamlanan adım",
      value: completedWorkCount,
      description: "Yıl içinde tamamlandı olarak kapatılan çalışmalar",
      icon: CheckCircle2,
      tone: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    },
  ];

  const workPlanProgress = plannedWorkCount + completedWorkCount;
  const completionRate = workPlanProgress === 0 ? 0 : Math.round((completedWorkCount / workPlanProgress) * 100);
  const previewRows = useMemo(() => {
    if (previewType === "work_plan") return workPlan;
    if (previewType === "training_plan") return trainingPlan;
    return evaluationReport;
  }, [previewType, workPlan, trainingPlan, evaluationReport]);
  const previewTitle =
    previewType === "work_plan"
      ? "YILLIK ÇALIŞMA"
      : previewType === "training_plan"
        ? "YILLIK EĞİTİM"
        : "YILLIK DEĞERLENDİRME";

  const openTemplatePreview = (type: "work_plan" | "training_plan" | "evaluation") => {
    setPreviewType(type);
    setPreviewOpen(true);
  };

  const findElementsByLocalName = (parent: Element | Document, localName: string) =>
    Array.from(parent.getElementsByTagName("*")).filter((node) => node.localName === localName);

  const appendSharedString = (sharedStringsDoc: Document, value: string) => {
    const sst = findElementsByLocalName(sharedStringsDoc, "sst")[0];
    if (!sst) {
      throw new Error("Shared strings alanı bulunamadı");
    }

    const si = sharedStringsDoc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "si");
    const t = sharedStringsDoc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "t");
    t.textContent = value;
    si.appendChild(t);
    sst.appendChild(si);

    const currentCount = Number(sst.getAttribute("count") || "0") + 1;
    const currentUnique = Number(sst.getAttribute("uniqueCount") || "0") + 1;
    sst.setAttribute("count", `${currentCount}`);
    sst.setAttribute("uniqueCount", `${currentUnique}`);

    return findElementsByLocalName(sharedStringsDoc, "si").length - 1;
  };

  const setWorksheetSharedString = (sheetDoc: Document, sharedStringsDoc: Document, cellRef: string, value: string) => {
    const worksheet = findElementsByLocalName(sheetDoc, "worksheet")[0];
    if (!worksheet) {
      throw new Error("Worksheet bulunamadı");
    }

    let sheetData = findElementsByLocalName(sheetDoc, "sheetData")[0];
    if (!sheetData) {
      sheetData = sheetDoc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "sheetData");
      worksheet.appendChild(sheetData);
    }

    const cellMatch = /^([A-Z]+)(\d+)$/.exec(cellRef);
    if (!cellMatch) {
      throw new Error(`Geçersiz hücre referansı: ${cellRef}`);
    }

    const [, targetColumn, targetRowStr] = cellMatch;
    const targetRow = Number(targetRowStr);
    const rows = findElementsByLocalName(sheetData, "row");
    let rowElement = rows.find((row) => Number(row.getAttribute("r")) === targetRow);

    if (!rowElement) {
      rowElement = sheetDoc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "row");
      rowElement.setAttribute("r", `${targetRow}`);
      sheetData.appendChild(rowElement);
    }

    const cells = findElementsByLocalName(rowElement, "c");
    let cellElement = cells.find((cell) => cell.getAttribute("r") === cellRef);
    if (!cellElement) {
      cellElement = sheetDoc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "c");
      cellElement.setAttribute("r", cellRef);
      rowElement.appendChild(cellElement);
    }

    Array.from(cellElement.childNodes).forEach((child) => cellElement?.removeChild(child));
    cellElement.setAttribute("t", "s");

    const valueIndex = appendSharedString(sharedStringsDoc, value);
    const v = sheetDoc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "v");
    v.textContent = `${valueIndex}`;
    cellElement.appendChild(v);

    const orderedCells = findElementsByLocalName(rowElement, "c").sort((a, b) => {
      const columnA = /^([A-Z]+)/.exec(a.getAttribute("r") || "")?.[1] || "";
      const columnB = /^([A-Z]+)/.exec(b.getAttribute("r") || "")?.[1] || "";
      return XLSX.utils.decode_col(columnA) - XLSX.utils.decode_col(columnB);
    });

    orderedCells.forEach((cell) => rowElement?.appendChild(cell));
  };

  const getWorkbookSheetTarget = (workbookXml: string, workbookRelsXml: string, sheetName: string) => {
    const parser = new DOMParser();
    const workbookDoc = parser.parseFromString(workbookXml, "application/xml");
    const relsDoc = parser.parseFromString(workbookRelsXml, "application/xml");

    const normalizeSheetName = (value: string | null) => (value || "").trim().replace(/\s+/g, " ");
    const targetName = normalizeSheetName(sheetName);
    const sheet = findElementsByLocalName(workbookDoc, "sheet").find(
      (item) => normalizeSheetName(item.getAttribute("name")) === targetName
    );
    if (!sheet) return null;

    const relationId = sheet.getAttribute("r:id");
    if (!relationId) return null;

    const relation = findElementsByLocalName(relsDoc, "Relationship").find((item) => item.getAttribute("Id") === relationId);
    return relation?.getAttribute("Target") || null;
  };

  const removeCalcChainArtifacts = async (zip: JSZip) => {
    zip.remove("xl/calcChain.xml");

    const workbookRelsPath = "xl/_rels/workbook.xml.rels";
    const workbookRelsXml = await zip.file(workbookRelsPath)?.async("string");
    if (workbookRelsXml) {
      const parser = new DOMParser();
      const serializer = new XMLSerializer();
      const relsDoc = parser.parseFromString(workbookRelsXml, "application/xml");
      findElementsByLocalName(relsDoc, "Relationship")
        .filter((relation) => relation.getAttribute("Type")?.includes("/calcChain"))
        .forEach((relation) => relation.parentNode?.removeChild(relation));
      zip.file(workbookRelsPath, serializer.serializeToString(relsDoc));
    }

    const contentTypesPath = "[Content_Types].xml";
    const contentTypesXml = await zip.file(contentTypesPath)?.async("string");
    if (contentTypesXml) {
      const parser = new DOMParser();
      const serializer = new XMLSerializer();
      const contentTypesDoc = parser.parseFromString(contentTypesXml, "application/xml");
      findElementsByLocalName(contentTypesDoc, "Override")
        .filter((override) => override.getAttribute("PartName") === "/xl/calcChain.xml")
        .forEach((override) => override.parentNode?.removeChild(override));
      zip.file(contentTypesPath, serializer.serializeToString(contentTypesDoc));
    }
  };

  const styleAnnualWorksheet = (
    worksheet: XLSX.WorkSheet,
    rangeRef: string,
    options: {
      titleCell?: string;
      metaCells?: string[];
      headerRowIndex: number;
      totalRows: number;
      stripedStartRow: number;
      stripedColumns: number;
    }
  ) => {
    const setCellStyle = (address: string, style: Record<string, unknown>) => {
      const cell = worksheet[address];
      if (!cell) return;
      (cell as XLSX.CellObject & { s?: Record<string, unknown> }).s = style;
    };

    if (options.titleCell) {
      setCellStyle(options.titleCell, {
        font: { bold: true, sz: 16, color: { rgb: "0F172A" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "E0F2FE" } },
      });
    }

    for (const metaCell of options.metaCells || []) {
      setCellStyle(metaCell, {
        font: { bold: true, color: { rgb: "1E293B" } },
        fill: { fgColor: { rgb: "E2E8F0" } },
      });
    }

    for (let col = 0; col < options.stripedColumns; col += 1) {
      const headerAddress = XLSX.utils.encode_cell({ r: options.headerRowIndex, c: col });
      setCellStyle(headerAddress, {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "thin", color: { rgb: "CBD5E1" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      });
    }

    for (let row = options.stripedStartRow; row < options.totalRows; row += 1) {
      const fillColor = row % 2 === 0 ? "F8FAFC" : "EEF2FF";
      for (let col = 0; col < options.stripedColumns; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        setCellStyle(address, {
          fill: { fgColor: { rgb: fillColor } },
          border: {
            top: { style: "thin", color: { rgb: "CBD5E1" } },
            bottom: { style: "thin", color: { rgb: "CBD5E1" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } },
          },
          alignment: { vertical: "center", wrapText: true },
        });
      }
    }
  };

  const trainingPlanNotes = [
    "*EĞİTİMLERİN SÜRESİ : Az tehlikeli işyerleri için en az 8 saat, tehlikeli işyerleri için en az 12 saat, çok tehlikeli işyerleri için en az 16 saat olarak her çalışan için düzenlenecektir.",
    "*EĞİTİMLERİN TEKRARI : Çok tehlikeli sınıfta yer alan işyerlerinde yılda en az 1 defa, tehlikeli sınıfta yer alan işyerlerinde 2 yılda en az 1 defa, az tehlikeli sınıfta yer alan işyerlerinde 3 yılda en az 1 defa yinelenir.",
    "*HİJYEN EĞİTİMİ ALINACAK İŞYERLERİ : Gıda üretimi ve perakende iş yerleri, insan tüketimi amaçlı sular ile doğal mineralli suların üretimini yapan iş yerleri ve benzeri alanlar.",
    "*EĞİTİMLERİN AMACI : Çalışanlarda iş sağlığı ve güvenliğine yönelik davranış değişikliği sağlamayı ve eğitimlerde aktarılan bilgilerin öneminin çalışanlarca kavranmasını sağlamaktır.",
    "*İlk Yardım Eğitimi Alması Gereken Personel Sayısı : Tehlike sınıfına göre yönetmelikte belirtilen asgari sayıda personel ilk yardımcı olarak planlanmalıdır.",
  ];

  // ========================
  // RENDER
  // ========================
  return (
    <div className="min-h-screen space-y-8 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_28%),linear-gradient(180deg,#020617,#0f172a)] p-4 md:p-6">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_32px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
        <div className="grid gap-6 border-b border-white/10 px-6 py-6 md:grid-cols-[minmax(0,1.4fr)_380px] md:px-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                Yıllık plan merkezi
              </Badge>
              <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                Excel şablon uyumlu çıktı
              </Badge>
            </div>
            <div className="space-y-3">
              <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
                  <Calendar className="h-6 w-6" />
                </span>
                Yıllık çalışma planı
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Yıllık çalışma planı, eğitim planı ve değerlendirme raporlarını tek merkezde yönetin.
                Özellikle <span className="font-medium text-white">YILLIK ÇALIŞMA</span> çıktısı,
                alışık olunan Excel şablon mantığını koruyarak daha temiz ve kurumsal bir formatta dışa aktarılır.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {overviewCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-br ${card.tone} p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</span>
                    <card.icon className="h-4 w-4 text-slate-200" />
                  </div>
                  <div className="text-3xl font-semibold text-white">{card.value}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{card.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">Operasyon özeti</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Kurum ve çıktı uyumu</h2>
              </div>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32 rounded-xl border-white/10 bg-slate-900/80 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 text-cyan-200" />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">Kurum</p>
                  <p className="mt-1 text-sm font-medium text-white">{organizationName || "İSGVizyon"}</p>
                  <p className="mt-1 text-xs leading-5 text-cyan-50/80">
                    Çıktılarda kurum adı üst bilgiye otomatik yerleştirilir.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Çıktı kalitesi</p>
                  <p className="mt-1 text-sm font-medium text-white">Yıllık çalışma planı hazırlık durumu</p>
                </div>
                <TrendingUp className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Tamamlanma oranı</span>
                <span className="font-medium text-white">%{completionRate}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-violet-300" />
                <div>
                  <p className="text-sm font-medium text-white">Excel şablonuna uygun çıktı</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Kullanıcılar yıllık çalışma planını hem PDF hem de <span className="text-slate-200">YILLIK ÇALIŞMA</span>
                    sayfa mantığına uygun Excel çıktısı olarak indirebilir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 px-6 py-6 md:px-8">
        <TabsList className="grid w-full grid-cols-1 rounded-2xl border border-white/10 bg-white/[0.03] p-2 md:grid-cols-3">
          <TabsTrigger value="work_plan" className="gap-2 rounded-xl text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <ClipboardList className="h-4 w-4" />
            Yıllık Çalışma
          </TabsTrigger>
          <TabsTrigger value="training_plan" className="gap-2 rounded-xl text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <Users className="h-4 w-4" />
            Yıllık Eğitim
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="gap-2 rounded-xl text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <FileSpreadsheet className="h-4 w-4" />
            Yıllık Değerlendirme
          </TabsTrigger>
        </TabsList>

        {/* ======================== */}
        {/* TAB 1: ÇALIŞMA PLANI */}
        {/* ======================== */}
        <TabsContent value="work_plan" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-white/10 bg-white/[0.03] text-slate-100">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Şablon uyumu</p>
                  <p className="mt-3 text-2xl font-semibold text-white">YILLIK ÇALIŞMA</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Çıktı, Excel çalışma planı düzenine uygun sütun ve ay kurgusuyla hazırlanır.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] text-slate-100">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sorumlu alan</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{organizationName || "Kurum"}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Üst bilgiye otomatik yazılır ve yıllık çalışma planı çıktısına taşınır.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/[0.03] text-slate-100">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Hazır aksiyon</p>
                  <p className="mt-3 text-2xl font-semibold text-white">PDF + Excel</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Kullanıcı aynı planı iki farklı çıktı formatında indirebilir.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-cyan-400/20 bg-cyan-400/10 text-slate-50">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">Kullanım</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Takvim ve faaliyet planı çıktısı</h3>
                <p className="mt-2 text-sm leading-6 text-cyan-50/85">
                  Buradaki planlama tablosu yıl boyunca yürütülecek faaliyetleri aylara dağıtmak için tasarlandı.
                  Şablon yükle, hücreleri işaretle ve sonra kurumsal çıktı al.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/10 bg-slate-950/60 text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
            <CardHeader>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="text-xl text-white">Yıllık Çalışma Planı ({selectedYear})</CardTitle>
                  <CardDescription className="mt-2 max-w-3xl text-slate-400">
                    Aylık takip için hücrelere tıklayın: <span className="text-slate-200">Boş</span> → <span className="text-amber-300">Planlandı</span> → <span className="text-emerald-300">Tamamlandı</span>.
                    İndirilen Excel dosyası kullanıcıların alıştığı yıllık çalışma şablon mantığını korur.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadWorkPlanTemplate}
                    className="gap-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                  >
                    <Sparkles className="h-4 w-4" />
                    Şablon Yükle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => savePlan('work_plan')}
                    disabled={saving}
                    className="gap-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                  >
                    <Save className="h-4 w-4" />
                    Kaydet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTemplatePreview("work_plan")}
                    className="gap-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                  >
                    <Eye className="h-4 w-4" />
                    Şablon Önizle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportWorkPlanExcel}
                    className="gap-2 border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel Şablonuna Uygun Çıktı
                  </Button>
                  <Button
                    size="sm"
                    onClick={exportWorkPlanPDF}
                    className="gap-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 text-slate-950 hover:opacity-95"
                  >
                    <Download className="h-4 w-4" />
                    PDF İndir
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80 p-2">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="w-[250px] text-slate-300">Faaliyet</TableHead>
                      <TableHead className="w-[150px] text-slate-300">Sorumlu</TableHead>
                      {MONTH_NAMES.map((month, idx) => (
                        <TableHead key={idx} className="w-[60px] text-center text-slate-300">
                          {month.substring(0, 3)}
                        </TableHead>
                      ))}
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workPlan.map(row => (
                      <TableRow key={row.id} className="border-white/10">
                        <TableCell>
                          <Input
                            value={row.activity_name}
                            onChange={(e) => updateWorkPlanRow(row.id, 'activity_name', e.target.value)}
                            placeholder="Faaliyet adı"
                            className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100 placeholder:text-slate-500"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.responsible}
                            onChange={(e) => updateWorkPlanRow(row.id, 'responsible', e.target.value)}
                            placeholder="Sorumlu"
                            className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100 placeholder:text-slate-500"
                          />
                        </TableCell>
                        {Object.entries(row.months).map(([monthIndex, status]) => (
                          <TableCell 
                            key={monthIndex}
                            className="p-1 text-center cursor-pointer"
                            onClick={() => toggleMonthStatus(row.id, parseInt(monthIndex))}
                          >
                            <div className={`h-8 w-full rounded flex items-center justify-center transition-all hover:scale-105 ${
                              status === "empty" ? "bg-slate-950/60 text-slate-500 ring-1 ring-white/10" :
                              status === "planned" ? "bg-amber-400 text-amber-950 font-bold" :
                              "bg-emerald-500 text-white font-bold"
                            }`}>
                              {status === "planned" ? "P" : status === "completed" ? "✓" : "-"}
                            </div>
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeWorkPlanRow(row.id)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button
                variant="outline"
                onClick={addWorkPlanRow}
                className="mt-4 w-full gap-2 border-dashed border-white/15 bg-white/[0.03] text-slate-100 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                Yeni faaliyet satırı ekle
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================== */}
        {/* TAB 2: EĞİTİM PLANI */}
        {/* ======================== */}
        <TabsContent value="training_plan" className="space-y-6">
          <Card className="border-white/10 bg-slate-950/60 text-slate-100">
            <CardHeader>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="text-white">Yıllık Eğitim Planı ({selectedYear})</CardTitle>
                  <CardDescription className="text-slate-400">
                    Excel’de kullandığınız resmi yıllık eğitim planı düzenine göre alanları doldurun ve şablona birebir uyumlu çıktı alın.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadTrainingPlanTemplate}
                    className="gap-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                  >
                    <Sparkles className="h-4 w-4" />
                    Şablon Yükle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => savePlan('training_plan')}
                    disabled={saving}
                    className="gap-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                  >
                    <Save className="h-4 w-4" />
                    Kaydet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTemplatePreview("training_plan")}
                    className="gap-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                  >
                    <Eye className="h-4 w-4" />
                    Şablon Önizle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTrainingPlanExcel}
                    className="gap-2 border-violet-400/30 bg-violet-400/10 text-violet-100 hover:bg-violet-400/15"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel Şablonuna Uygun Çıktı
                  </Button>
                  <Button
                    size="sm"
                    onClick={exportTrainingPlanPDF}
                    className="gap-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sky-500 text-white"
                  >
                    <Download className="h-4 w-4" />
                    PDF İndir
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-slate-300">İş Yeri Unvanı</Label>
                  <Input
                    value={trainingMeta.workplaceTitle}
                    onChange={(e) => updateTrainingMeta("workplaceTitle", e.target.value)}
                    placeholder="İş yeri unvanı"
                    className="h-10 border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">İş Yeri Adresi</Label>
                  <Input
                    value={trainingMeta.workplaceAddress}
                    onChange={(e) => updateTrainingMeta("workplaceAddress", e.target.value)}
                    placeholder="İş yeri adresi"
                    className="h-10 border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">İş Yeri Sicil No</Label>
                  <Input
                    value={trainingMeta.workplaceRegistrationNo}
                    onChange={(e) => updateTrainingMeta("workplaceRegistrationNo", e.target.value)}
                    placeholder="İş yeri sicil numarası"
                    className="h-10 border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">İş Güvenliği Uzmanı</Label>
                  <Input
                    value={trainingMeta.specialistName}
                    onChange={(e) => updateTrainingMeta("specialistName", e.target.value)}
                    placeholder="Uzman adı soyadı"
                    className="h-10 border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">İşyeri Hekimi</Label>
                  <Input
                    value={trainingMeta.doctorName}
                    onChange={(e) => updateTrainingMeta("doctorName", e.target.value)}
                    placeholder="Hekim adı soyadı"
                    className="h-10 border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">İşveren / İ.Vekili</Label>
                  <Input
                    value={trainingMeta.employerRepresentativeName}
                    onChange={(e) => updateTrainingMeta("employerRepresentativeName", e.target.value)}
                    placeholder="İşveren veya vekil adı"
                    className="h-10 border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80 p-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="w-[60px] text-slate-300">Sıra No</TableHead>
                    <TableHead className="min-w-[340px] text-slate-300">Eğitim Konusu</TableHead>
                    <TableHead className="min-w-[220px] text-slate-300">Eğitimi Verecek Kişi/Kuruluş</TableHead>
                    <TableHead className="min-w-[160px] text-slate-300">Planlanan Tarih</TableHead>
                    <TableHead className="min-w-[160px] text-slate-300">Gerçekleşen Tarih</TableHead>
                    <TableHead className="min-w-[220px] text-slate-300">Açıklamalar</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainingPlan.map((row, index) => (
                    <TableRow key={row.id} className="border-white/10">
                      <TableCell className="font-medium text-slate-300">{index + 1}</TableCell>
                      <TableCell>
                        <Textarea
                          value={row.topic}
                          onChange={(e) => updateTrainingPlanRow(row.id, 'topic', e.target.value)}
                          placeholder="Eğitim konusu"
                          className="min-h-[110px] border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.provider}
                          onChange={(e) => updateTrainingPlanRow(row.id, 'provider', e.target.value)}
                          placeholder="İş Güvenliği Uzmanı / Kuruluş"
                          className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.planned_date}
                          onChange={(e) => updateTrainingPlanRow(row.id, 'planned_date', e.target.value)}
                          placeholder="OCAK / SÜREKLİ / 3 YIL"
                          className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.actual_date}
                          onChange={(e) => updateTrainingPlanRow(row.id, 'actual_date', e.target.value)}
                          placeholder="Gerçekleşen tarih"
                          className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={row.notes}
                          onChange={(e) => updateTrainingPlanRow(row.id, 'notes', e.target.value)}
                          placeholder="Açıklamalar"
                          className="min-h-[110px] border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeTrainingPlanRow(row.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              <Button
                variant="outline"
                onClick={addTrainingPlanRow}
                className="mt-4 w-full gap-2 border-dashed border-white/15 bg-white/[0.03] text-slate-100 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                Eğitim Ekle
              </Button>

              {/* İstatistikler */}
              {trainingPlan.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-6">
                  <Card className="border-white/10 bg-white/[0.03] text-slate-100">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-primary">
                        {trainingPlan.length}
                      </div>
                      <p className="text-xs text-slate-400">Toplam Eğitim</p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-white/[0.03] text-slate-100">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-primary">
                        {trainingPlan.filter((row) => row.planned_date.toUpperCase().includes("SÜREKLİ")).length}
                      </div>
                      <p className="text-xs text-slate-400">Sürekli Plan</p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-white/[0.03] text-slate-100">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-primary">
                        {trainingPlan.filter((row) => row.actual_date.trim()).length}
                      </div>
                      <p className="text-xs text-slate-400">Gerçekleşen Kayıt</p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-white/[0.03] text-slate-100">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-success">
                        {trainingPlan.filter((row) => row.provider.toLowerCase().includes("iş güvenliği")).length}
                      </div>
                      <p className="text-xs text-slate-400">Uzman Destekli</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================== */}
        {/* TAB 3: DEĞERLENDİRME RAPORU */}
        {/* ======================== */}
        <TabsContent value="evaluation" className="space-y-6">
          <Card className="border-white/10 bg-slate-950/60 text-slate-100">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Yıllık Değerlendirme Raporu ({selectedYear})</CardTitle>
                  <CardDescription className="text-slate-400">
                    Gerçekleştirilen faaliyetlerin sonuçlarını kaydedin
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => savePlan('evaluation_report')}
                    disabled={saving}
                    className="gap-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                  >
                    <Save className="h-4 w-4" />
                    Kaydet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTemplatePreview("evaluation")}
                    className="gap-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                  >
                    <Eye className="h-4 w-4" />
                    Şablon Önizle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportEvaluationExcel}
                    className="gap-2 border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100 hover:bg-fuchsia-400/15"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel Şablonuna Uygun Çıktı
                  </Button>
                  <Button
                    size="sm"
                    onClick={exportEvaluationPDF}
                    className="gap-2 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500 text-white"
                  >
                    <Download className="h-4 w-4" />
                    PDF İndir
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="w-[200px] text-slate-300">Faaliyet</TableHead>
                    <TableHead className="w-[130px] text-slate-300">Planlanan Tarih</TableHead>
                    <TableHead className="w-[130px] text-slate-300">Gerçekleşen Tarih</TableHead>
                    <TableHead className="w-[120px] text-slate-300">Durum</TableHead>
                    <TableHead>Sonuç ve Yorum</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluationReport.map(row => (
                    <TableRow key={row.id} className="border-white/10">
                      <TableCell>
                        <Input
                          value={row.activity}
                          onChange={(e) => updateEvaluationRow(row.id, 'activity', e.target.value)}
                          placeholder="Faaliyet"
                          className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.planned_date}
                          onChange={(e) => updateEvaluationRow(row.id, 'planned_date', e.target.value)}
                          className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.actual_date}
                          onChange={(e) => updateEvaluationRow(row.id, 'actual_date', e.target.value)}
                          className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.status}
                          onValueChange={(value: "completed" | "pending" | "cancelled") => updateEvaluationRow(row.id, 'status', value)}
                        >
                          <SelectTrigger className="h-9 border-white/10 bg-slate-950/60 text-sm text-slate-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-success" />
                                Tamamlandı
                              </span>
                            </SelectItem>
                            <SelectItem value="pending">
                              <span className="flex items-center gap-2">
                                <AlertCircle className="h-3 w-3 text-warning" />
                                Beklemede
                              </span>
                            </SelectItem>
                            <SelectItem value="cancelled">
                              <span className="flex items-center gap-2">
                                <XCircle className="h-3 w-3 text-destructive" />
                                İptal
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={row.result_comment}
                          onChange={(e) => updateEvaluationRow(row.id, 'result_comment', e.target.value)}
                          placeholder="Sonuç ve değerlendirme..."
                          className="min-h-[60px] border-white/10 bg-slate-950/60 text-sm text-slate-100"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeEvaluationRow(row.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Button
                variant="outline"
                onClick={addEvaluationRow}
                className="mt-4 w-full gap-2 border-dashed border-white/15 bg-white/[0.03] text-slate-100 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                Değerlendirme Ekle
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden border-white/10 bg-slate-950/95 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">{previewTitle} şablon önizlemesi</DialogTitle>
            <DialogDescription className="text-slate-400">
              {organizationName || "İSGVizyon"} için doldurulmuş şablon görünümü. Bu ekran indirme öncesi düzeni kontrol etmek için hazırlanmıştır.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Yıllık plan çıktısı</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{selectedYear} {previewTitle}</h3>
                  <p className="mt-2 text-sm text-slate-600">İşletme / Kurum: {organizationName || user?.email || "İSGVizyon"}</p>
                  {previewType === "training_plan" && (
                    <div className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      Referans Excel görünümü
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Kaynak</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">Referans şablon düzeniyle eşleştirilmiş görünüm</p>
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-auto rounded-2xl border border-slate-200">
              {previewType === "work_plan" && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-900 hover:bg-slate-900">
                      <TableHead className="text-white">Faaliyet</TableHead>
                      <TableHead className="text-white">Sorumlu</TableHead>
                      {MONTH_NAMES.map((month, idx) => (
                        <TableHead key={idx} className="text-center text-white">{month.substring(0, 3)}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workPlan.map((row) => (
                      <TableRow key={row.id} className="odd:bg-slate-50">
                        <TableCell>{row.activity_name || "-"}</TableCell>
                        <TableCell>{row.responsible || "-"}</TableCell>
                        {Object.values(row.months).map((status, idx) => (
                          <TableCell key={idx} className="text-center">
                            {status === "planned" ? "P" : status === "completed" ? "✓" : "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {previewType === "training_plan" && (
                <div className="mx-auto w-full max-w-[980px] bg-white p-2 text-black">
                  <div className="relative border border-black">
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[128px] font-medium text-slate-500/35">
                      Sayfa 1
                    </div>

                    <div className="grid grid-cols-[1fr_120px] border-b border-black">
                      <div className="flex min-h-[74px] items-center justify-center px-6 text-center font-serif text-[18px] font-bold uppercase leading-tight md:text-[20px]">
                        İş Sağlığı ve Güvenliği Yıllık Eğitim Planı
                      </div>
                      <div className="flex items-center justify-center border-l border-black bg-white p-2">
                        {trainingMeta.organizationLogoUrl ? (
                          <img
                            src={trainingMeta.organizationLogoUrl}
                            alt="Kurum logosu"
                            className="max-h-12 w-auto object-contain"
                          />
                        ) : (
                          <div className="text-center font-serif text-[11px] font-bold text-amber-700">
                            {organizationName || "Logo"}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-b border-black py-2 text-center font-serif text-[15px] font-bold md:text-[17px]">
                      {selectedYear} Yılı Eğitim Planı
                    </div>

                    <div className="grid grid-cols-[1.15fr_1.25fr_1fr_1.35fr] border-b border-black text-[12px]">
                      <div className="border-r border-black px-3 py-8 text-center font-serif font-bold">İş Yeri Unvanı:</div>
                      <div className="border-r border-black px-3 py-8 text-center font-serif">{trainingMeta.workplaceTitle || organizationName || "0"}</div>
                      <div className="border-r border-black px-3 py-8 text-center font-serif font-bold">İş Yeri Adresi:</div>
                      <div className="px-3 py-8 text-center font-serif">{trainingMeta.workplaceAddress || "0"}</div>
                    </div>

                    <div className="grid grid-cols-[1.15fr_1.25fr_1fr_1.35fr] border-b border-black text-[12px]">
                      <div className="border-r border-black px-3 py-3 text-center font-serif font-bold">İş Yeri Sicil No:</div>
                      <div className="border-r border-black px-3 py-3 text-center font-serif">{trainingMeta.workplaceRegistrationNo || "0"}</div>
                      <div className="border-r border-black px-3 py-3 text-center font-serif font-bold"></div>
                      <div className="px-3 py-3 text-center font-serif">0</div>
                    </div>

                    <table className="w-full border-collapse text-[11px] md:text-[12px]">
                      <thead>
                        <tr className="border-b border-black bg-white">
                          <th className="w-[54px] border-r border-black px-1 py-3 text-center font-serif font-bold text-blue-900">Sıra No</th>
                          <th className="w-[42%] border-r border-black px-2 py-3 text-center font-serif font-bold text-blue-900">EĞİTİM KONUSU</th>
                          <th className="w-[18%] border-r border-black px-2 py-3 text-center font-serif font-bold text-blue-900">Eğitimi Verecek Kişi/Kuruluş</th>
                          <th className="w-[14%] border-r border-black px-2 py-3 text-center font-serif font-bold text-blue-900">Planlanan Tarih</th>
                          <th className="w-[14%] border-r border-black px-2 py-3 text-center font-serif font-bold text-blue-900">Gerçekleşen Tarih</th>
                          <th className="px-2 py-3 text-center font-serif font-bold text-blue-900">AÇIKLAMALAR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainingPlan.slice(0, EDUCATION_TEMPLATE_MAX_ROWS).map((row, index) => (
                          <tr key={row.id} className="align-top border-b border-black">
                            <td className="border-r border-black px-1 py-2 text-center font-serif font-bold">{index + 1}</td>
                            <td className="border-r border-black px-2 py-2 font-serif whitespace-pre-line">{row.topic || ""}</td>
                            <td className="border-r border-black px-2 py-2 text-center font-serif">{row.provider || ""}</td>
                            <td className="border-r border-black px-2 py-2 text-center font-serif">{row.planned_date || ""}</td>
                            <td className="border-r border-black px-2 py-2 text-center font-serif">{row.actual_date || ""}</td>
                            <td className="px-2 py-2 font-serif">{row.notes || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="space-y-1 border-t border-black px-1 py-4 text-[10px] leading-[1.45] md:text-[11px]">
                      {trainingPlanNotes.map((note) => (
                        <p key={note} className="font-serif font-semibold text-slate-900">
                          {note}
                        </p>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 border-t border-black text-center text-[12px]">
                      <div className="min-h-[120px] border-r border-black px-3 py-4">
                        <div className="font-serif font-bold underline">İş Güvenliği Uzmanı</div>
                        <div className="mt-8 font-serif">{trainingMeta.specialistName || "0"}</div>
                      </div>
                      <div className="min-h-[120px] border-r border-black px-3 py-4">
                        <div className="font-serif font-bold underline">İşyeri Hekimi</div>
                        <div className="mt-8 font-serif">{trainingMeta.doctorName || "0"}</div>
                      </div>
                      <div className="min-h-[120px] px-3 py-4">
                        <div className="font-serif font-bold underline">İşveren / İ.Vekili</div>
                        <div className="mt-8 font-serif">{trainingMeta.employerRepresentativeName || "0"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewType === "evaluation" && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-900 hover:bg-slate-900">
                      <TableHead className="text-white">No</TableHead>
                      <TableHead className="text-white">Faaliyet</TableHead>
                      <TableHead className="text-white">Planlanan</TableHead>
                      <TableHead className="text-white">Gerçekleşen</TableHead>
                      <TableHead className="text-white">Durum</TableHead>
                      <TableHead className="text-white">Sonuç ve Yorum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluationReport.map((row, index) => (
                      <TableRow key={row.id} className="odd:bg-slate-50">
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{row.activity || "-"}</TableCell>
                        <TableCell>{row.planned_date || "-"}</TableCell>
                        <TableCell>{row.actual_date || "-"}</TableCell>
                        <TableCell>{row.status === "completed" ? "Tamamlandı" : row.status === "pending" ? "Beklemede" : "İptal"}</TableCell>
                        <TableCell>{row.result_comment || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
              <span>Önizleme yalnızca şablon yapısını göstermek içindir.</span>
              <span>{Array.isArray(previewRows) ? previewRows.length : 0} satır görüntüleniyor</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
