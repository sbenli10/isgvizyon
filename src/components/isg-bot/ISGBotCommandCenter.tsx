import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, differenceInDays, format } from "date-fns";
import jsPDF from "jspdf";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileWarning,
  Gavel,
  Loader2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Bot,
  RefreshCcw,
  ChevronRight,
  Play,
  FileText
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  listIsgkatipCompanies,
  listIsgkatipComplianceFlags,
  listIsgkatipPredictiveAlerts,
} from "@/domain/isgkatip/isgkatipQueries";
import { getIsgkatipOrgScope } from "@/domain/isgkatip/isgkatipOrgScope";
import { createOsgbTask } from "@/lib/osgbOperations";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import { downloadCsv } from "@/lib/csvExport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type LayerMode = "expert" | "company" | "osgb";
type Severity = "critical" | "high" | "medium";

type CompanyRecord = {
  id: string;
  company_name: string;
  sgk_no: string;
  employee_count: number;
  hazard_class: string;
  assigned_minutes: number;
  required_minutes: number;
  compliance_status: string;
  risk_score: number | null;
  contract_end: string | null;
  contract_start: string | null;
  assigned_person_name: string | null;
  service_provider_name: string | null;
};

type ComplianceFlagRecord = {
  id: string;
  company_id: string | null;
  rule_name: string;
  severity: string;
  message: string;
  status: string;
  created_at: string | null;
};

type PredictiveAlertRecord = {
  id: string;
  company_id: string | null;
  alert_type: string;
  severity: string;
  message: string;
  predicted_date: string | null;
  status: string;
};

type BoardMeetingRecord = {
  id: string;
  company_id: string;
  meeting_date: string;
  status: string | null;
};

type TaskRecord = {
  id: string;
  status: string | null;
  priority: string | null;
  deadline: string;
};

type ActionItem = {
  id: string;
  sourceId?: string;
  sourceType: "duration" | "contract" | "board" | "flag" | "alert";
  companyId?: string;
  companyName: string;
  title: string;
  detail: string;
  severity: Severity;
  legalReference: string;
  route: string;
  deadline: string;
  assignedPerson: string;
  template: string;
  priorityScore: number;
  suggestedOwner: string;
};

type TaskDraft = {
  actionId: string;
  assignedPerson: string;
  deadline: string;
  priority: "Kritik" | "Yüksek" | "Orta";
  notes: string;
};

type TemplateDefinition = {
  id: string;
  title: string;
  detail: string;
  legalReference: string;
  defaultRoute: string;
  priority: "Kritik" | "Yüksek" | "Orta";
};

type RuleMeta = {
  title: string;
  legalReference: string;
  category: string;
  defaultRoute: string;
  template: string;
};

type CompanyPlanItem = {
  id: string;
  title: string;
  owner: string;
  due: string;
  dueRaw: string;
  status: string;
  sourceType: ActionItem["sourceType"];
  legalReference: string;
  route: string;
  notes: string;
  severity: Severity;
  priorityScore: number;
};

const severityBadgeClass: Record<Severity, string> = {
  critical: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  medium: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
};

const complianceLabels: Record<string, string> = {
  COMPLIANT: "Uyumlu",
  WARNING: "Sınırda",
  CRITICAL: "Kritik",
  EXCESS: "Fazla",
  UNKNOWN: "Bilinmiyor",
};

const ruleCatalog: Record<string, RuleMeta> = {
  DURATION_CHECK: {
    title: "Asgari hizmet süresi uyumsuzluğu",
    legalReference: "İşyeri hekimi ve iş güvenliği uzmanı görevlendirme süreleri - 6331 sayılı Kanun ve ilgili yönetmelik",
    category: "Görevlendirme",
    defaultRoute: "/isg-bot?tab=compliance",
    template: "Eksik süreyi kapatacak sözleşme revizyonu hazırlayın bitirerek süre atamalarını güncelleyin.",
  },
  CONTRACT_EXPIRED: {
    title: "Sözleşme süresi dolmuş veya bitişe yaklaşmış",
    legalReference: "Görevlendirme sürekliliği yükümlülüğü",
    category: "Sözleşme",
    defaultRoute: "/isg-bot?tab=readiness",
    template: "Sözleşme yenileme sürecini başlatın ve onay tarihlerini doğrulayın.",
  },
  BOARD_REQUIRED: {
    title: "İSG kurulu takibi gerekli",
    legalReference: "İş Sağlığı ve Güvenliği Kurulları Hakkında Yönetmelik",
    category: "Kurul",
    defaultRoute: "/board-meetings",
    template: "Kurul toplantısı oluşturun, gündemi belirleyin ve zorunlu katılımcıları atayın.",
  },
  PREDICTIVE_ALERT: {
    title: "Öngörüsel risk uyarısı",
    legalReference: "Önleyici İSG yaklaşımı ve risklerin erken kapatılması",
    category: "Risk",
    defaultRoute: "/isg-bot?tab=risk",
    template: "Tahminsel uyarıyı doğrulayın, sahadaki etkisini değerlendirip önleyici görev açın.",
  },
};

const expertTemplates: TemplateDefinition[] = [
  {
    id: "contract-renewal",
    title: "Sözleşme yenileme akışı",
    detail: "Süresi dolan veya 30 gün içinde bitecek firmalar için yenileme görevi oluşturur.",
    legalReference: "Görevlendirme sürekliliği yükümlülüğü",
    defaultRoute: "/isg-bot?tab=readiness",
    priority: "Yüksek",
  },
  {
    id: "duration-remediation",
    title: "Eksik süre kapatma akışı",
    detail: "Asgari uzman/hekimi süresi yetersiz firmalar için düzeltici görev oluşturur.",
    legalReference: "İSG profesyoneli süre yükümlülükleri",
    defaultRoute: "/isg-bot?tab=compliance",
    priority: "Kritik",
  },
  {
    id: "board-launch",
    title: "Kurul toplantısı başlat",
    detail: "50+ çalışanlı firmalarda kurul oluşturma ve toplantı planlama görevi açar.",
    legalReference: "İSG Kurulları Hakkında Yönetmelik",
    defaultRoute: "/board-meetings",
    priority: "Yüksek",
  },
];

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Belirtilmedi";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd.MM.yyyy");
};

const getDaysLeft = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return differenceInDays(parsed, new Date());
};

const calculatePriorityScore = (params: {
  severity: Severity;
  contractDays?: number | null;
  riskScore?: number | null;
  employeeCount?: number;
  openFlagCount?: number;
}) => {
  const severityBase = { critical: 95, hıgh: 78, medium: 55 }[params.severity] || 60;
  const contractBoost =
    params.contractDays == null
      ? 0
      : params.contractDays < 0
      ? 18
      : params.contractDays <= 7
      ? 12
      : params.contractDays <= 30
      ? 6
      : 0;
  const riskBoost = Math.min(12, Math.round((params.riskScore ?? 0) / 10));
  const employeeBoost = params.employeeCount && params.employeeCount >= 50 ? 8 : 0;
  const flagBoost = Math.min(10, (params.openFlagCount ?? 0) * 2);
  return Math.min(100, severityBase + contractBoost + riskBoost + employeeBoost + flagBoost);
};

export default function ISGBotCommandCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [layer, setLayer] = useState<LayerMode>("expert");
  const [loading, setLoading] = useState(true);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [flags, setFlags] = useState<ComplianceFlagRecord[]>([]);
  const [alerts, setAlerts] = useState<PredictiveAlertRecord[]>([]);
  const [meetings, setMeetings] = useState<BoardMeetingRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [exportingCompanyPdf, setExportingCompanyPdf] = useState(false);
  const [osgbHazardFilter, setOsgbHazardFilter] = useState<string>("ALL");
  const [osgbExpertFilter, setOsgbExpertFilter] = useState<string>("ALL");
  const [selectedOsgbExpert, setSelectedOsgbExpert] = useState<string>("ALL");

  useEffect(() => {
    if (!user) return;
    void loadCommandData();
  }, [user?.id]);

  const osgbExpertOptions = useMemo(
    () => [
      "ALL",
      ...Array.from(
        new Set(
          companies.map(
            (company) => company.assigned_person_name || company.service_provider_name || "Atanmamış"
          )
        )
      ),
    ],
    [companies]
  );

  useEffect(() => {
    if (selectedOsgbExpert !== "ALL" && !osgbExpertOptions.includes(selectedOsgbExpert)) {
      setSelectedOsgbExpert("ALL");
    }
  }, [osgbExpertOptions, selectedOsgbExpert]);

  const loadCommandData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [companiesResponse, flagsResponse, alertsResponse, meetingsResponse, tasksResponse] =
        await Promise.all([
          listIsgkatipCompanies({
            userId: user.id,
            select: "id, company_name, sgk_no, employee_count, hazard_class, assigned_minutes, required_minutes, compliance_status, risk_score, contract_end, contract_start, assigned_person_name, service_provider_name",
          }),
          listIsgkatipComplianceFlags({
            userId: user.id,
            select: "id, company_id, rule_name, severity, message, status, created_at",
            status: "OPEN",
            orderByCreatedAtDesc: false,
          }),
          listIsgkatipPredictiveAlerts({
            userId: user.id,
            select: "id, company_id, alert_type, severity, message, predicted_date, status",
            status: "ACTIVE",
          }),
          supabase
            .from("board_meetings")
            .select("id, company_id, meeting_date, status")
            .eq("user_id", user.id),
          supabase
            .from("osgb_tasks")
            .select("id, status, priority, due_date")
            .eq("organization_id", (await getIsgkatipOrgScope({ userId: user.id })).organizationId),
        ]);

      if (meetingsResponse.error) throw meetingsResponse.error;
      if (tasksResponse.error) throw tasksResponse.error;

      const companyRows = (companiesResponse ?? []) as CompanyRecord[];
      setCompanies(companyRows);
      setFlags((flagsResponse ?? []) as ComplianceFlagRecord[]);
      setAlerts((alertsResponse ?? []) as PredictiveAlertRecord[]);
      setMeetings((meetingsResponse.data ?? []) as BoardMeetingRecord[]);
      setTasks(
        ((tasksResponse.data ?? []) as any[]).map((task) => ({
          id: task.id,
          status: task.status,
          priority: task.priority,
          deadline: task.due_date,
        }))
      );
      setSelectedCompanyId((current) =>
        current && companyRows.some((item) => item.id === current)
          ? current
          : companyRows[0]?.id ?? ""
      );
    } catch (error: any) {
      console.error("ISG bot command center load error:", error);
      toast.error("Bot komuta merkezi yüklenemedi", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!companies.length) {
      toast.error("Dışa aktarılacak veri yok");
      return;
    }
    downloadCsv(
      "isg-bot-portfoy-raporu.csv",
      ["Firma Adı", "SGK Sicil No", "Çalışan Sayısı", "Tehlike Sınıfı", "Uyum Durumu", "Risk Skoru"],
      companies.map((c) => [
        c.company_name,
        c.sgk_no || "",
        c.employee_count,
        c.hazard_class,
        complianceLabels[c.compliance_status] || c.compliance_status,
        c.risk_score ?? 0,
      ])
    );
    toast.success("CSV raporu başarıyla indirildi.");
  };

  const expertActions = useMemo<ActionItem[]>(() => {
    const actions: ActionItem[] = [];

    companies.forEach((company) => {
      const companyFlags = flags.filter((flag) => flag.company_id === company.id);
      const companyAlerts = alerts.filter((alert) => alert.company_id === company.id);
      const contractDays = getDaysLeft(company.contract_end);
      const hasRecentMeeting = meetings.some(
        (meeting) =>
          meeting.company_id === company.id &&
          meeting.status !== "cancelled" &&
          differenceInDays(new Date(), new Date(meeting.meeting_date)) <= 180
      );

      if (company.assigned_minutes < company.required_minutes) {
        const deficit = company.required_minutes - company.assigned_minutes;
        actions.push({
          id: `duration-${company.id}`,
          sourceType: "duration",
          companyId: company.id,
          companyName: company.company_name,
          title: ruleCatalog.DURATION_CHECK.title,
          detail: `${deficit} dakika/ay eksik. Mevcut: ${company.assigned_minutes}, gerekli: ${company.required_minutes}.`,
          severity: company.assigned_minutes < company.required_minutes * 0.5 ? "critical" : "high",
          legalReference: ruleCatalog.DURATION_CHECK.legalReference,
          route: ruleCatalog.DURATION_CHECK.defaultRoute,
          deadline: format(addDays(new Date(), 7), "yyyy-MM-dd"),
          assignedPerson: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          suggestedOwner: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          template: ruleCatalog.DURATION_CHECK.template,
          priorityScore: calculatePriorityScore({
            severity: company.assigned_minutes < company.required_minutes * 0.5 ? "critical" : "high",
            riskScore: company.risk_score,
            employeeCount: company.employee_count,
            openFlagCount: companyFlags.length,
          }),
        });
      }

      if (contractDays !== null && contractDays <= 30) {
        const severity: Severity = contractDays < 0 ? "critical" : "high";
        actions.push({
          id: `contract-${company.id}`,
          sourceType: "contract",
          companyId: company.id,
          companyName: company.company_name,
          title: contractDays < 0 ? "Sözleşme süresi dolmuş" : "Sözleşme bitiş tarihi yaklaşıyor",
          detail: contractDays < 0 ? `Sözleşme ${Math.abs(contractDays)} gün önce sona ermiş.` : `Sözleşme ${contractDays} gün içinde sona erecek.`,
          severity,
          legalReference: ruleCatalog.CONTRACT_EXPIRED.legalReference,
          route: ruleCatalog.CONTRACT_EXPIRED.defaultRoute,
          deadline: format(addDays(new Date(), 3), "yyyy-MM-dd"),
          assignedPerson: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          suggestedOwner: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          template: ruleCatalog.CONTRACT_EXPIRED.template,
          priorityScore: calculatePriorityScore({
            severity,
            contractDays,
            riskScore: company.risk_score,
            employeeCount: company.employee_count,
            openFlagCount: companyFlags.length,
          }),
        });
      }

      if (company.employee_count >= 50 && !hasRecentMeeting) {
        actions.push({
          id: `board-${company.id}`,
          sourceType: "board",
          companyId: company.id,
          companyName: company.company_name,
          title: ruleCatalog.BOARD_REQUIRED.title,
          detail: "50+ çalışanlı firmada son 6 ay içinde kurul toplantısı kaydı bulunmuyor.",
          severity: "high",
          legalReference: ruleCatalog.BOARD_REQUIRED.legalReference,
          route: ruleCatalog.BOARD_REQUIRED.defaultRoute,
          deadline: format(addDays(new Date(), 10), "yyyy-MM-dd"),
          assignedPerson: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          suggestedOwner: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          template: ruleCatalog.BOARD_REQUIRED.template,
          priorityScore: calculatePriorityScore({
            severity: "high",
            riskScore: company.risk_score,
            employeeCount: company.employee_count,
            openFlagCount: companyFlags.length,
          }),
        });
      }

      companyFlags
        .filter((flag) => flag.severity === "CRITICAL" || flag.severity === "WARNING")
        .slice(0, 2)
        .forEach((flag) => {
          const meta = ruleCatalog[flag.rule_name] ?? {
            title: flag.rule_name,
            legalReference: "İlgili mevzuat kontrolü uzman tarafından doğrulanmalıdır.",
            category: "Uyum",
            defaultRoute: "/isg-bot?tab=compliance",
            template: "Uyumsuzluğu doğrulayın ve düzeltici faaliyet başlatın.",
          };
          const severity: Severity = flag.severity === "CRITICAL" ? "critical" : "medium";

          actions.push({
            id: `flag-${flag.id}`,
            sourceId: flag.id,
            sourceType: "flag",
            companyId: company.id,
            companyName: company.company_name,
            title: meta.title,
            detail: flag.message,
            severity,
            legalReference: meta.legalReference,
            route: meta.defaultRoute,
            deadline: format(addDays(new Date(), severity === "critical" ? 3 : 7), "yyyy-MM-dd"),
            assignedPerson: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
            suggestedOwner: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
            template: meta.template,
            priorityScore: calculatePriorityScore({
              severity,
              riskScore: company.risk_score,
              employeeCount: company.employee_count,
              openFlagCount: companyFlags.length,
            }),
          });
        });

      companyAlerts.slice(0, 1).forEach((alert) => {
        const severity: Severity = alert.severity === "CRITICAL" ? "critical" : "medium";
        actions.push({
          id: `alert-${alert.id}`,
          sourceId: alert.id,
          sourceType: "alert",
          companyId: company.id,
          companyName: company.company_name,
          title: ruleCatalog.PREDICTIVE_ALERT.title,
          detail: alert.message,
          severity,
          legalReference: ruleCatalog.PREDICTIVE_ALERT.legalReference,
          route: ruleCatalog.PREDICTIVE_ALERT.defaultRoute,
          deadline: alert.predicted_date?.slice(0, 10) || format(addDays(new Date(), 14), "yyyy-MM-dd"),
          assignedPerson: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          suggestedOwner: company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          template: ruleCatalog.PREDICTIVE_ALERT.template,
          priorityScore: calculatePriorityScore({
            severity,
            riskScore: company.risk_score,
            employeeCount: company.employee_count,
            openFlagCount: companyFlags.length,
          }),
        });
      });
    });

    return actions.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 12);
  }, [alerts, companies, flags, meetings]);

  const selectedCompany =
    companies.find((company) => company.id === selectedCompanyId) ?? companies[0] ?? null;
  const selectedCompanyFlags = useMemo(
    () => flags.filter((flag) => flag.company_id === selectedCompany?.id),
    [flags, selectedCompany?.id]
  );
  const selectedCompanyAlerts = useMemo(
    () => alerts.filter((alert) => alert.company_id === selectedCompany?.id),
    [alerts, selectedCompany?.id]
  );
  const selectedCompanyMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.company_id === selectedCompany?.id),
    [meetings, selectedCompany?.id]
  );

  const companyManagementSummary = useMemo(() => {
    if (!selectedCompany) return null;

    const contractDays = getDaysLeft(selectedCompany.contract_end);
    const severityLevel =
      (selectedCompany.risk_score ?? 0) >= 70 || selectedCompanyFlags.some((flag) => flag.severity === "CRITICAL")
        ? "Yüksek"
        : (selectedCompany.risk_score ?? 0) >= 50 || selectedCompanyFlags.length > 0
        ? "Orta"
        : "Düşük";

    return {
      overallStatus: complianceLabels[selectedCompany.compliance_status] || "Bilinmiyor",
      severityLevel,
      keyMessage:
        severityLevel === "Yüksek"
          ? "Firma yönetimi için öncelik kritik açıkların kapanması ve süre/sözleşme risklerinin düşürülmesi olmalı."
          : severityLevel === "Orta"
          ? "Firma kontrollü risk seviyesinde. Açık başlıklar zamanında kapatılırsa denetim baskısı düşer."
          : "Firma görünümü stabil. Periyodik izleme ve yaklaşan tarihler yeterli seviyede takip edilmeli.",
      budgetNote:
        selectedCompany.assigned_minutes < selectedCompany.required_minutes
          ? "Ek uzman/hekimi süresi planlaması bütçelendirilmelidir."
          : "İlave kapasite ihtiyacı şu an için görünmüyor.",
      contractNote:
        contractDays == null
          ? "Sözleşme bitiş tarihi sistemde tanımlı değil."
          : contractDays < 0
          ? "Sözleşme süresi dolmuş; yenileme kararı gecikmeden alınmalı."
          : contractDays <= 30
          ? "Sözleşme bu ay içinde yenileme kararına ihtiyaç duyuyor."
          : "Sözleşme tarafında yakın tarihli kritik baskı görünmüyor.",
    };
  }, [selectedCompany, selectedCompanyFlags]);

  const companyMonthlyActionPlan = useMemo(() => {
    if (!selectedCompany) return [] as CompanyPlanItem[];

    const items: CompanyPlanItem[] = [];
    const owner = selectedCompany.assigned_person_name || selectedCompany.service_provider_name || "İSG Uzmanı";
    const contractDays = getDaysLeft(selectedCompany.contract_end);
    const baseFlagCount = selectedCompanyFlags.length;

    if (selectedCompany.assigned_minutes < selectedCompany.required_minutes) {
      const dueRaw = format(addDays(new Date(), 5), "yyyy-MM-dd");
      items.push({
        id: `company-duration-${selectedCompany.id}`,
        title: "Uzman/hekimi süresi revizyonunu onayla",
        owner,
        due: formatDateLabel(dueRaw),
        dueRaw,
        status: "Bu hafta",
        sourceType: "duration",
        legalReference: ruleCatalog.DURATION_CHECK.legalReference,
        route: "/isg-bot?tab=compliance",
        notes: "Asgari hizmet süresi açığını kapatacak revizyon kararını başlatın ve görevlendirme sürelerini güncelleyin.",
        severity: selectedCompany.assigned_minutes < selectedCompany.required_minutes * 0.5 ? "critical" : "high",
        priorityScore: calculatePriorityScore({
          severity: selectedCompany.assigned_minutes < selectedCompany.required_minutes * 0.5 ? "critical" : "high",
          riskScore: selectedCompany.risk_score,
          employeeCount: selectedCompany.employee_count,
          openFlagCount: baseFlagCount,
        }),
      });
    }

    if (contractDays !== null && contractDays <= 30) {
      items.push({
        id: `company-contract-${selectedCompany.id}`,
        title: contractDays < 0 ? "Sözleşmeyi acilen yenile" : "Sözleşme yenileme kararını al",
        owner,
        due: formatDateLabel(selectedCompany.contract_end),
        dueRaw: selectedCompany.contract_end?.slice(0, 10) || format(addDays(new Date(), 3), "yyyy-MM-dd"),
        status: contractDays < 0 ? "Gecikmiş" : "Bu ay",
        sourceType: "contract",
        legalReference: ruleCatalog.CONTRACT_EXPIRED.legalReference,
        route: "/isg-bot?tab=readiness",
        notes: "Sözleşme yenileme sürecini başlatın, taraf onaylarını tamamlayın ve bitiş tarihini güncelleyin.",
        severity: contractDays < 0 ? "critical" : "high",
        priorityScore: calculatePriorityScore({
          severity: contractDays < 0 ? "critical" : "high",
          contractDays,
          riskScore: selectedCompany.risk_score,
          employeeCount: selectedCompany.employee_count,
          openFlagCount: baseFlagCount,
        }),
      });
    }

    if (selectedCompany.employee_count >= 50 && selectedCompanyMeetings.length === 0) {
      const dueRaw = format(addDays(new Date(), 10), "yyyy-MM-dd");
      items.push({
        id: `company-board-${selectedCompany.id}`,
        title: "İSG kurul toplantısını planla",
        owner,
        due: formatDateLabel(dueRaw),
        dueRaw,
        status: "Bu ay",
        sourceType: "board",
        legalReference: ruleCatalog.BOARD_REQUIRED.legalReference,
        route: "/board-meetings",
        notes: "Kurul toplantısını oluşturun, gündemi belirleyin ve katılımcıları atayın.",
        severity: "high",
        priorityScore: calculatePriorityScore({
          severity: "high",
          riskScore: selectedCompany.risk_score,
          employeeCount: selectedCompany.employee_count,
          openFlagCount: baseFlagCount,
        }),
      });
    }

    selectedCompanyFlags.slice(0, 3).forEach((flag, index) => {
      const dueRaw = format(addDays(new Date(), 7 + index * 3), "yyyy-MM-dd");
      const severity = flag.severity === "CRITICAL" ? "critical" : "medium";
      const meta = ruleCatalog[flag.rule_name];
      items.push({
        id: `company-flag-${flag.id}`,
        title: `${flag.rule_name} açığını kapat`,
        owner,
        due: formatDateLabel(dueRaw),
        dueRaw,
        status: flag.severity === "CRITICAL" ? "Öncelikli" : "Planlı",
        sourceType: "flag",
        legalReference: meta?.legalReference || "İlgili mevzuat yükümlülüğünü doğrulayın ve düzeltici faaliyet başlatın.",
        route: meta?.defaultRoute || "/isg-bot?tab=compliance",
        notes: flag.message,
        severity,
        priorityScore: calculatePriorityScore({
          severity,
          riskScore: selectedCompany.risk_score,
          employeeCount: selectedCompany.employee_count,
          openFlagCount: baseFlagCount,
        }),
      });
    });

    selectedCompanyAlerts.slice(0, 1).forEach((alert) => {
      const dueRaw = alert.predicted_date?.slice(0, 10) || format(addDays(new Date(), 12), "yyyy-MM-dd");
      const severity = alert.severity === "CRITICAL" ? "critical" : "medium";
      items.push({
        id: `company-alert-${alert.id}`,
        title: "Öngörüsel risk uyarısını saha kontrolü ile doğrula",
        owner,
        due: formatDateLabel(dueRaw),
        dueRaw,
        status: "Takip",
        sourceType: "alert",
        legalReference: ruleCatalog.PREDICTIVE_ALERT.legalReference,
        route: "/isg-bot?tab=risk",
        notes: alert.message,
        severity,
        priorityScore: calculatePriorityScore({
          severity,
          riskScore: selectedCompany.risk_score,
          employeeCount: selectedCompany.employee_count,
          openFlagCount: baseFlagCount,
        }),
      });
    });

    return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 6);
  }, [selectedCompany, selectedCompanyFlags, selectedCompanyAlerts, selectedCompanyMeetings]);

  const openTaskCount = tasks.filter((task) => task.status !== "completed").length;
  const criticalFlagCount = flags.filter((flag) => flag.severity === "CRITICAL").length;
  const upcomingContractCount = companies.filter((company) => {
    const days = getDaysLeft(company.contract_end);
    return days !== null && days <= 30;
  }).length;

  const legislationCards = useMemo(() => {
    const grouped = new Map<
      string,
      { title: string; legalReference: string; category: string; count: number }
    >();

    expertActions.forEach((action) => {
      const meta = Object.values(ruleCatalog).find(
        (rule) => rule.legalReference === action.legalReference
      ) ?? {
        title: action.title,
        legalReference: action.legalReference,
        category: "Uyum",
      };
      const current = grouped.get(meta.title) ?? {
        title: meta.title,
        legalReference: meta.legalReference,
        category: meta.category,
        count: 0,
      };
      current.count += 1;
      grouped.set(meta.title, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [expertActions]);

  const osgbHazardOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(companies.map((company) => company.hazard_class).filter(Boolean)))],
    [companies]
  );

  const filteredOsgbCompanies = useMemo(
    () =>
      companies.filter((company) => {
        const owner = company.assigned_person_name || company.service_provider_name || "Atanmamış";
        const hazardMatches = osgbHazardFilter === "ALL" || company.hazard_class === osgbHazardFilter;
        const expertMatches = osgbExpertFilter === "ALL" || owner === osgbExpertFilter;
        return hazardMatches && expertMatches;
      }),
    [companies, osgbExpertFilter, osgbHazardFilter]
  );

  const filteredRiskyPortfolio = useMemo(
    () => [...filteredOsgbCompanies].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 6),
    [filteredOsgbCompanies]
  );

  const filteredOsgbWorkload = useMemo(() => {
    const grouped = new Map<
      string,
      { name: string; companyCount: number; employeeCount: number; deficit: number }
    >();

    filteredOsgbCompanies.forEach((company) => {
      const owner = company.assigned_person_name || company.service_provider_name || "Atanmamış";
      const current = grouped.get(owner) ?? {
        name: owner,
        companyCount: 0,
        employeeCount: 0,
        deficit: 0,
      };
      current.companyCount += 1;
      current.employeeCount += company.employee_count || 0;
      current.deficit += Math.max(0, (company.required_minutes || 0) - (company.assigned_minutes || 0));
      grouped.set(owner, current);
    });

    return Array.from(grouped.values()).sort((a, b) =>
      b.companyCount === a.companyCount ? b.employeeCount - a.employeeCount : b.companyCount - a.companyCount
    );
  }, [filteredOsgbCompanies]);

  const selectedOsgbExpertDetails = useMemo(() => {
    if (!selectedOsgbExpert || selectedOsgbExpert === "ALL") return null;

    const expertCompanies = filteredOsgbCompanies.filter((company) => {
      const owner = company.assigned_person_name || company.service_provider_name || "Atanmamış";
      return owner === selectedOsgbExpert;
    });

    if (expertCompanies.length === 0) return null;

    return {
      name: selectedOsgbExpert,
      companyCount: expertCompanies.length,
      employeeCount: expertCompanies.reduce((sum, company) => sum + (company.employee_count || 0), 0),
      deficit: expertCompanies.reduce((sum, company) => sum + Math.max(0, (company.required_minutes || 0) - (company.assigned_minutes || 0)), 0),
      companies: expertCompanies
        .map((company) => ({
          id: company.id,
          companyName: company.company_name,
          hazardClass: company.hazard_class,
          employeeCount: company.employee_count,
          riskScore: company.risk_score ?? 0,
          openFlags: flags.filter((flag) => flag.company_id === company.id).length,
          deficit: Math.max(0, company.required_minutes - company.assigned_minutes),
        }))
        .sort((a, b) => b.riskScore - a.riskScore),
    };
  }, [filteredOsgbCompanies, flags, selectedOsgbExpert]);

  const prioritySuggestions = useMemo(
    () => [
      {
        id: "priority-action",
        title: "Bugün önce bunu yap",
        description: expertActions[0]?.title ?? "İlk senkron sonrası öncelikli iş burada görünecek.",
        actionLabel: expertActions[0] ? "Aksiyonu aç" : "Kurulum rehberine dön",
        onClick: () => {
          if (expertActions[0]) {
            openTaskDialog(expertActions[0]);
            return;
          }
          navigate("/docs/isg-bot-setup");
        },
      },
      {
        id: "contracts",
        title: "Eksik sözleşmeleri kontrol et",
        description: upcomingContractCount > 0 ? `${upcomingContractCount} firma için sözleşme takibi bekliyor.` : "Şu an yaklaşan sözleşme baskısı görünmüyor.",
        actionLabel: "Sözleşme görünümüne git",
        onClick: () => navigate("/isg-bot?tab=readiness"),
      },
      {
        id: "readiness",
        title: "Denetime hazır olmayan firmaları aç",
        description: criticalFlagCount > 0 ? `${criticalFlagCount} kritik açık denetim hazırlığını etkiliyor.` : "Denetim hazırlığı tarafında kritik açık görünmüyor.",
        actionLabel: "Denetim hazırlığını aç",
        onClick: () => navigate("/isg-bot?tab=readiness"),
      },
      {
        id: "boards",
        title: "Kurul gereken firmalara git",
        description: expertActions.some((action) => action.sourceType === "board") ? "Kurul toplantısı gerektiren firmalar bulundu." : "Şu an kurul açısından yeni bir baskı görünmüyor.",
        actionLabel: "Kurul işlemlerine git",
        onClick: () => navigate("/board-meetings"),
      },
    ],
    [criticalFlagCount, expertActions, navigate, upcomingContractCount]
  );

  const openCompanyPlanTaskDialog = (item: CompanyPlanItem) => {
    if (!selectedCompany) return;

    const action: ActionItem = {
      id: item.id,
      sourceType: item.sourceType,
      companyId: selectedCompany.id,
      companyName: selectedCompany.company_name,
      title: item.title,
      detail: item.notes,
      severity: item.severity,
      legalReference: item.legalReference,
      route: item.route,
      deadline: item.dueRaw,
      assignedPerson: item.owner,
      suggestedOwner: item.owner,
      template: item.notes,
      priorityScore: item.priorityScore,
    };

    setSelectedAction(action);
    setTaskDraft({
      actionId: item.id,
      assignedPerson: item.owner,
      deadline: item.dueRaw,
      priority: item.severity === "critical" ? "Kritik" : item.severity === "high" ? "Yüksek" : "Orta",
      notes: item.notes,
    });
  };

  const handleExportCompanySummary = () => {
    if (!selectedCompany || !companyManagementSummary) return;

    try {
      setExportingCompanyPdf(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const fontsLoaded = addInterFontsToJsPDF(doc);
      if (fontsLoaded) {
        doc.setFont("Inter", "bold");
      }

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("ISGVizyon Yonetici Ozet Raporu", 16, 17);

      doc.setTextColor(15, 23, 42);
      if (fontsLoaded) {
        doc.setFont("Inter", "bold");
      }
      doc.setFontSize(16);
      doc.text(selectedCompany.company_name, 16, 40);

      if (fontsLoaded) {
        doc.setFont("Inter", "normal");
      }
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Olusturma tarihi: ${format(new Date(), "dd.MM.yyyy HH:mm")}`, 16, 47);

      const summaryBlocks = [
        ["Uyum durumu", companyManagementSummary.overallStatus],
        ["Risk seviyesi", companyManagementSummary.severityLevel],
        ["Risk puani", `${selectedCompany.risk_score ?? 0}/100`],
        ["Acik uyumsuzluk", `${selectedCompanyFlags.length}`],
        ["Sozlesme bitisi", formatDateLabel(selectedCompany.contract_end)],
      ];

      let y = 58;
      summaryBlocks.forEach(([label, value], index) => {
        const boxX = 16 + (index % 2) * 90;
        const boxY = y + Math.floor(index / 2) * 22;
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(boxX, boxY, 84, 16, 2, 2);
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text(label, boxX + 4, boxY + 5);
        doc.setTextColor(15, 23, 42);
        if (fontsLoaded) {
          doc.setFont("Inter", "bold");
        }
        doc.setFontSize(11);
        doc.text(String(value), boxX + 4, boxY + 12);
        if (fontsLoaded) {
          doc.setFont("Inter", "normal");
        }
      });

      y += 54;
      doc.setTextColor(15, 23, 42);
      if (fontsLoaded) {
        doc.setFont("Inter", "bold");
      }
      doc.setFontSize(13);
      doc.text("Yonetici yorumu", 16, y);
      if (fontsLoaded) {
        doc.setFont("Inter", "normal");
      }
      doc.setFontSize(10);
      const summaryLines = doc.splitTextToSize(
        [
          companyManagementSummary.keyMessage,
          companyManagementSummary.budgetNote,
          companyManagementSummary.contractNote,
        ].join(" "),
        178
      );
      doc.text(summaryLines, 16, y + 7);

      y += 32 + summaryLines.length * 4;
      if (fontsLoaded) {
        doc.setFont("Inter", "bold");
      }
      doc.setFontSize(13);
      doc.text("Aylik aksiyon plani", 16, y);
      if (fontsLoaded) {
        doc.setFont("Inter", "normal");
      }

      const planItems = companyMonthlyActionPlan.length
        ? companyMonthlyActionPlan
        : [
            {
              id: "no-action",
              title: "Bu ay icin kritik aksiyon gorunmuyor",
              owner: "-",
              due: "-",
              dueRaw: format(new Date(), "yyyy-MM-dd"),
              status: "Izleme",
              sourceType: "flag" as const,
              legalReference: "-",
              route: "/isg-bot",
              notes: "Periyodik izleme ve mevcut duzeyin korunmasi yeterli.",
              severity: "medium" as const,
              priorityScore: 0,
            },
          ];

      y += 8;
      planItems.forEach((item) => {
        if (y > 255) {
          doc.addPage();
          y = 20;
        }
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(16, y, 178, 16, 2, 2);
        if (fontsLoaded) {
          doc.setFont("Inter", "bold");
        }
        doc.setFontSize(10);
        doc.text(item.title, 20, y + 6);
        if (fontsLoaded) {
          doc.setFont("Inter", "normal");
        }
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Sorumlu: ${item.owner}`, 20, y + 12);
        doc.text(`Termin: ${item.due}`, 95, y + 12);
        doc.text(`Durum: ${item.status}`, 150, y + 12);
        doc.setTextColor(15, 23, 42);
        y += 20;
      });

      const safeName = selectedCompany.company_name
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");
      doc.save(`isgvizyon-yonetici-ozeti-${safeName || "firma"}.pdf`);
    } catch (error: any) {
      toast.error("Yonetici PDF ozeti olusturulamadi", {
        description: error.message,
      });
    } companions: {
      setExportingCompanyPdf(false);
    }
  };

  const openTaskDialog = (action: ActionItem) => {
    setSelectedAction(action);
    setTaskDraft({
      actionId: action.id,
      assignedPerson: action.suggestedOwner,
      deadline: action.deadline,
      priority: action.severity === "critical" ? "Kritik" : action.severity === "high" ? "Yüksek" : "Orta",
      notes: action.template,
    });
  };

  const openTemplateDialog = (template: TemplateDefinition) => {
    setSelectedAction({
      id: `template-${template.id}`,
      sourceType: "flag",
      companyName: companies[0]?.company_name ?? "Portföy geneli",
      title: template.title,
      detail: template.detail,
      severity: template.priority === "Kritik" ? "critical" : template.priority === "Yüksek" ? "high" : "medium",
      legalReference: template.legalReference,
      route: template.defaultRoute,
      deadline: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      assignedPerson: companies[0]?.assigned_person_name || "İSG Uzmanı",
      suggestedOwner: companies[0]?.assigned_person_name || "İSG Uzmanı",
      template: template.detail,
      priorityScore: template.priority === "Kritik" ? 90 : template.priority === "Yüksek" ? 78 : 60,
    });
    setTaskDraft({
      actionId: `template-${template.id}`,
      assignedPerson: companies[0]?.assigned_person_name || "İSG Uzmanı",
      deadline: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      priority: template.priority,
      notes: template.detail,
    });
  };

  const handleCreateTask = async () => {
    if (!user || !selectedAction || !taskDraft) return;
    setCreatingTaskId(selectedAction.id);

    try {
      const savedTask = await createOsgbTask(user.id, {
        companyId: selectedAction.companyId || null,
        title: `[Bot] ${selectedAction.title}`,
        description: `${selectedAction.companyName}\n\n${selectedAction.detail}\n\nMevzuat: ${selectedAction.legalReference}\n\nÖnerilen aksiyon: ${taskDraft.notes}`,
        assignedTo: taskDraft.assignedPerson,
        dueDate: taskDraft.deadline,
        priority: taskDraft.priority === "Kritik" ? "critical" : taskDraft.priority === "Yüksek" ? "high" : "medium",
        source: "bot",
      });

      setTasks((prev) => [
        ...prev,
        {
          id: savedTask.id,
          status: savedTask.status,
          priority: savedTask.priority,
          deadline: savedTask.due_date,
        },
      ]);

      toast.success("Görev oluşturuldu", {
        description: `${selectedAction.companyName} için görev kaydı açıldı.`,
      });
      setSelectedAction(null);
      setTaskDraft(null);
    } catch (error: any) {
      console.error("ISG bot task create error:", error);
      toast.error("Görev oluşturulamadı", {
        description: error.message,
      });
    } finally {
      setCreatingTaskId(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex min-h-[300px] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium text-sm">Bot komuta merkezi verileri analiz ediliyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6 px-4">
      {/* ÜST KAMU UYARI ALANI */}
      <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl shadow-none">
        <CardContent className="flex flex-col gap-1 p-4 text-xs text-blue-800 dark:text-blue-300 font-medium">
          <div className="font-bold flex items-center gap-1.5 text-sm mb-0.5">
            <ShieldAlert className="h-4 w-4 text-blue-500" />
            Resmi Bilgilendirme ve Oturum Güvenliği
          </div>
          <p>ISGVizyon İSG Bot resmi bir kamu kurumu ürünü değildir. Bu komuta merkezi, yalnızca kendi yetkili İSG-KATİP oturumunuzda izin verdiğiniz verilerden üretilen akıllı analizleri gösterir.</p>
        </CardContent>
      </Card>

      {/* SAYFA BAŞLIK ALANI */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
            <Bot className="h-7 w-7 stroke-[2]" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              ISG-Bot Durum Merkezi
            </h1>
            <p className="text-sm text-muted-foreground">Yapay zeka denetim havuzu, risk analiz yükümlülükleri ve mevzuat uyumu.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadCommandData()} className="h-10 rounded-xl font-semibold border-border/80 shadow-sm transition-all hover:bg-muted">
          <RefreshCcw className="mr-2 h-4 w-4 text-muted-foreground" /> Paneli Yenile
        </Button>
      </div>

      {/* FERAH METRİK ÖZET KARTLARI */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm rounded-2xl border border-border/60 bg-card overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Takipteki Firma</span>
              <p className="text-2xl font-extrabold text-foreground tracking-tight">{companies.length}</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm rounded-2xl border border-border/60 bg-card overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Kritik Mevzuat Açığı</span>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">{criticalFlagCount}</p>
            </div>
            <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm rounded-2xl border border-border/60 bg-card overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Yaklaşan Sözleşme</span>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">{upcomingContractCount}</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <CalendarClock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm rounded-2xl border border-border/60 bg-card overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Aktif Açık Görev</span>
              <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">{openTaskCount}</p>
            </div>
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ANA 3 SÜTUNLU DASHBOARD DÜZENİ */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* SOL GRUP PANELİ */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={layer} onValueChange={(value) => setLayer(value as LayerMode)} className="space-y-5">
            <TabsList className="inline-flex w-auto p-1 bg-muted/60 backdrop-blur-sm rounded-xl border border-border/40">
              <TabsTrigger value="expert" className="rounded-lg text-sm font-semibold px-4 py-1.5 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                Uzman Akışı ve Bulgular
              </TabsTrigger>
              <TabsTrigger value="company" className="rounded-lg text-sm font-semibold px-4 py-1.5 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                Firma Karar Özeti
              </TabsTrigger>
              <TabsTrigger value="osgb" className="rounded-lg text-sm font-semibold px-4 py-1.5 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                OSGB Portföy Matrisi
              </TabsTrigger>
            </TabsList>

            {/* TAB CONTENT: UZMAN AKIŞI */}
            <TabsContent value="expert" className="space-y-5 mt-0 outline-none">
              <Card className="rounded-2xl border border-border/60 shadow-sm overflow-hidden bg-card">
                <CardHeader className="px-6 py-5 border-b border-border/40">
                  <CardTitle className="text-lg font-bold text-foreground">Sistem Tarafından Sıralanan Öncelikli İşler</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">Mevzuat açıkları ve uyumsuzluk skorlarına göre bugün öncelik verilmesi gereken başlıklar.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {expertActions.length ? expertActions.map((action) => (
                    <div key={action.id} className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-all hover:bg-muted/40 group">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn("font-bold text-xs rounded-md", severityBadgeClass[action.severity])}>
                              {action.severity === "critical" ? "Kritik" : action.severity === "high" ? "Yüksek" : "Orta"}
                            </Badge>
                            <Badge variant="secondary" className="font-semibold text-xs text-foreground bg-secondary/80 rounded-md">{action.companyName}</Badge>
                            <Badge variant="outline" className="font-bold text-xs border-purple-500/20 bg-purple-500/5 text-purple-700 dark:text-purple-300 rounded-md">Öncelik Skoru: {action.priorityScore}</Badge>
                          </div>
                          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors mt-1">{action.title}</h3>
                          <p className="text-sm text-muted-foreground font-medium leading-relaxed">{action.detail}</p>
                          <div className="text-xs text-muted-foreground/80 font-medium pt-1">Yasal Dayanak: <span className="italic">{action.legalReference}</span></div>
                        </div>
                        <div className="flex flex-col gap-1.5 lg:w-[140px] shrink-0">
                          <Button size="sm" onClick={() => openTaskDialog(action)} className="w-full rounded-lg font-semibold bg-primary hover:bg-primary/90 shadow-sm h-8 text-xs">Görev Tanımla</Button>
                          <Button size="sm" variant="outline" onClick={() => navigate(action.route)} className="w-full rounded-lg font-medium border-border/80 h-8 text-xs text-muted-foreground hover:text-foreground">Modüle Git</Button>
                        </div>
                      </div>
                      <Progress value={action.priorityScore} className="mt-3.5 h-1.5" />
                    </div>
                  )) : (
                    <div className="p-8 text-center border border-dashed rounded-xl bg-muted/10 text-muted-foreground font-medium text-sm">Aktif veya taranan kritik bir açık bulunmuyor.</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
                <Card className="rounded-2xl border border-border/60 shadow-sm bg-card">
                  <CardHeader><CardTitle className="text-base font-bold">En Çok Tekrar Eden Yükümlülükler</CardTitle></CardHeader>
                  <CardContent className="p-5 pt-0 space-y-3">
                    {legislationCards.map((item) => (
                      <div key={item.title} className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-1">
                        <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{item.category}</span><Badge variant="secondary" className="text-[10px] font-bold rounded px-1.5">{item.count} Kez</Badge></div>
                        <h4 className="text-sm font-bold text-foreground tracking-tight mt-0.5">{item.title}</h4>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">{item.legalReference}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-border/60 shadow-sm bg-card">
                  <CardHeader><CardTitle className="text-base font-bold">Sık Kullanılan İş Akış Şablonları</CardTitle></CardHeader>
                  <CardContent className="p-5 pt-0 space-y-3">
                    {expertTemplates.map((template) => (
                      <div key={template.id} className="rounded-xl border border-border/50 bg-muted/10 p-3.5 flex flex-col justify-between group">
                        <div>
                          <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{template.title}</h4><Badge variant="outline" className="text-[10px] font-semibold rounded">{template.priority}</Badge></div>
                          <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">{template.detail}</p>
                        </div>
                        <Button size="sm" variant="outline" className="mt-3 w-full border-border/80 font-semibold rounded-lg text-xs h-8" onClick={() => openTemplateDialog(template)}>Görevi Başlat</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB CONTENT: FİRMA ÖZETİ */}
            <TabsContent value="company" className="space-y-5 mt-0 outline-none">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/30 p-4 rounded-xl border">
                <div className="w-full sm:w-[280px]">
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="bg-background rounded-lg border-border/80"><SelectValue placeholder="Firma Seçiniz" /></SelectTrigger>
                    <SelectContent className="rounded-lg">{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.company_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold border-border/80 shrink-0" onClick={handleExportCompanySummary} disabled={!selectedCompany || exportingCompanyPdf}>
                  {exportingCompanyPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Yönetici Özet Raporu İndir
                </Button>
              </div>

              {selectedCompany ? (
                <div className="space-y-5">
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                    <Card className="p-4 rounded-xl border border-border/50 bg-card"><span className="text-xs font-bold text-muted-foreground uppercase">Uyum Seviyesi</span><p className="text-lg font-bold text-foreground mt-1">{complianceLabels[selectedCompany.compliance_status] || "Bilinmiyor"}</p></Card>
                    <Card className="p-4 rounded-xl border border-border/50 bg-card"><span className="text-xs font-bold text-muted-foreground uppercase">Mevcut Risk Skoru</span><p className="text-lg font-bold text-foreground mt-1">{selectedCompany.risk_score ?? 0}/100</p></Card>
                    <Card className="p-4 rounded-xl border border-border/50 bg-card"><span className="text-xs font-bold text-muted-foreground uppercase">Aktif Flag</span><p className="text-lg font-bold text-foreground mt-1">{selectedCompanyFlags.length}</p></Card>
                    <Card className="p-4 rounded-xl border border-border/50 bg-card"><span className="text-xs font-bold text-muted-foreground uppercase">Sözleşme Bitiş</span><p className="text-lg font-bold text-foreground mt-1">{formatDateLabel(selectedCompany.contract_end)}</p></Card>
                  </div>

                  <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
                    <Card className="rounded-xl border border-border/60 shadow-sm bg-card">
                      <CardHeader><CardTitle className="text-base font-bold">Yönetici Görüş Notları</CardTitle></CardHeader>
                      <CardContent className="p-5 pt-0 space-y-3 text-sm font-medium text-muted-foreground">
                        {companyManagementSummary && (
                          <>
                            <div className="p-3.5 rounded-xl border bg-muted/10 space-y-1">
                              <div className="font-bold text-foreground flex items-center gap-1.5 text-xs uppercase text-primary tracking-wide"><Building2 className="h-3.5 w-3.5" /> Genel Operasyon Uyumu</div>
                              <p className="text-xs">Uyum durumu <strong>{companyManagementSummary.overallStatus}</strong> • Kritiklik düzeyi <strong>{companyManagementSummary.severityLevel}</strong></p>
                              <p className="text-xs text-foreground/90 mt-1 leading-relaxed">{companyManagementSummary.keyMessage}</p>
                            </div>
                            <div className="p-3.5 rounded-xl border bg-muted/10 space-y-1">
                              <div className="font-bold text-foreground flex items-center gap-1.5 text-xs uppercase text-amber-600 tracking-wide"><Briefcase className="h-3.5 w-3.5" /> Bütçe ve Kaynak Planı</div>
                              <p className="text-xs leading-relaxed">{companyManagementSummary.budgetNote}</p>
                              <p className="text-xs text-foreground/90 mt-1 leading-relaxed">{companyManagementSummary.contractNote}</p>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border border-border/60 shadow-sm bg-card">
                      <CardHeader><CardTitle className="text-base font-bold">Mevcut Planlı Aksiyonlar</CardTitle></CardHeader>
                      <CardContent className="p-5 pt-0 space-y-2.5">
                        {companyMonthlyActionPlan.length === 0 ? (
                          <div className="p-6 text-center text-xs font-semibold text-emerald-600 bg-emerald-500/5 rounded-xl border border-emerald-500/15">Bu ay için atanmış acil yönetim aksiyonu bulunmuyor.</div>
                        ) : companyMonthlyActionPlan.map((item) => (
                          <div key={item.id} className="p-3 rounded-xl border bg-muted/10 flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <h4 className="font-bold text-foreground leading-snug">{item.title}</h4>
                              <p className="text-muted-foreground font-medium">Sorumlu: {item.owner} • Termin: {item.due}</p>
                            </div>
                            <Button size="sm" variant="outline" className="text-[10px] h-7 px-2 font-bold shrink-0 border-border/80 rounded-lg" onClick={() => openCompanyPlanTaskDialog(item)}>Aç</Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border rounded-xl font-medium text-sm text-muted-foreground">Lütfen yukarıdaki menüden özetini incelemek istediğiniz firmayı seçin.</div>
              )}
            </TabsContent>

            {/* TAB CONTENT: OSGB GÖRÜNÜMÜ */}
            <TabsContent value="osgb" className="space-y-5 mt-0 outline-none">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <div className="p-3 bg-muted/20 border rounded-xl">
                  <span className="text-xs font-bold text-muted-foreground block mb-1.5 uppercase">Tehlike Sınıfı</span>
                  <Select value={osgbHazardFilter} onValueChange={setOsgbHazardFilter}>
                    <SelectTrigger className="h-9 bg-background border-border/80 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-lg">{osgbHazardOptions.map((opt) => <SelectItem key={opt} value={opt}>{opt === "ALL" ? "Tüm Sınıflar" : opt}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="p-3 bg-muted/20 border rounded-xl">
                  <span className="text-xs font-bold text-muted-foreground block mb-1.5 uppercase">Sorumlu Uzman</span>
                  <Select value={osgbExpertFilter} onValueChange={setOsgbExpertFilter}>
                    <SelectTrigger className="h-9 bg-background border-border/80 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-lg">{osgbExpertOptions.map((opt) => <SelectItem key={opt} value={opt}>{opt === "ALL" ? "Tüm Uzmanlar" : opt}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="p-3 bg-muted/20 border rounded-xl">
                  <span className="text-xs font-bold text-muted-foreground block mb-1.5 uppercase">Uzman Detay Analizi</span>
                  <Select value={selectedOsgbExpert} onValueChange={setSelectedOsgbExpert}>
                    <SelectTrigger className="h-9 bg-background border-border/80 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-lg">{["ALL", ...filteredOsgbWorkload.map((i) => i.name)].map((opt) => <SelectItem key={opt} value={opt}>{opt === "ALL" ? "Seçim Yapılmadı" : opt}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
                <Card className="rounded-xl border border-border/60 shadow-sm bg-card">
                  <CardHeader><CardTitle className="text-base font-bold">Portföy Risk Dağılım Listesi</CardTitle></CardHeader>
                  <CardContent className="p-5 pt-0 space-y-2.5">
                    {filteredRiskyPortfolio.map((company) => {
                      const companyOpenFlags = flags.filter((f) => f.company_id === company.id).length;
                      const deficit = Math.max(0, company.required_minutes - company.assigned_minutes);
                      return (
                        <div key={company.id} className="p-3 rounded-xl border bg-muted/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                          <div>
                            <h4 className="font-bold text-foreground">{company.company_name}</h4>
                            <p className="text-muted-foreground font-medium mt-0.5">Risk Skoru: {company.risk_score ?? 0} • {company.hazard_class} • {company.employee_count} Çalışan</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[10px] font-bold rounded bg-rose-500/5 text-rose-700 dark:text-rose-400 border-rose-500/10">{companyOpenFlags} Açık Flag</Badge>
                            {deficit > 0 && <Badge variant="outline" className="text-[10px] font-bold rounded bg-amber-500/5 text-amber-700 dark:text-amber-400 border-amber-500/10">{deficit} Dk Eksik</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="rounded-xl border border-border/60 shadow-sm bg-card">
                  <CardHeader><CardTitle className="text-base font-bold">Uzman Görev ve Yoğunluk Endeksi</CardTitle></CardHeader>
                  <CardContent className="p-5 pt-0 space-y-2">
                    {filteredOsgbWorkload.map((item) => (
                      <button type="button" key={item.name} className={cn("w-full rounded-xl border p-3 text-left transition-all text-xs flex items-center justify-between gap-4", selectedOsgbExpert === item.name ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border/80 bg-muted/5 hover:bg-muted/20")} onClick={() => setSelectedOsgbExpert(item.name)}>
                        <div>
                          <p className="font-bold text-foreground">{item.name}</p>
                          <p className="text-muted-foreground font-medium mt-0.5">{item.companyCount} Firma • {item.employeeCount} Atanmış Çalışan</p>
                        </div>
                        <div className="text-right shrink-0"><span className="text-[10px] font-bold text-muted-foreground uppercase block">Kapasite Açığı</span><span className="font-bold text-foreground text-sm">{item.deficit} Dk</span></div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {selectedOsgbExpertDetails && (
                <Card className="rounded-xl border border-border/60 shadow-sm bg-card">
                  <CardHeader><CardTitle className="text-base font-bold">{selectedOsgbExpertDetails.name} Detaylı Atama Analizi</CardTitle></CardHeader>
                  <CardContent className="p-5 pt-0 space-y-4">
                    <div className="grid gap-3 grid-cols-3 text-center text-xs">
                      <div className="p-2.5 rounded-xl border bg-muted/10"><span className="text-[10px] font-bold text-muted-foreground uppercase">Firma Sayısı</span><p className="text-lg font-bold text-foreground mt-0.5">{selectedOsgbExpertDetails.companyCount}</p></div>
                      <div className="p-2.5 rounded-xl border bg-muted/10"><span className="text-[10px] font-bold text-muted-foreground uppercase">Çalışan Havuzu</span><p className="text-lg font-bold text-foreground mt-0.5">{selectedOsgbExpertDetails.employeeCount}</p></div>
                      <div className="p-2.5 rounded-xl border bg-muted/10"><span className="text-[10px] font-bold text-muted-foreground uppercase">Toplam Süre Açığı</span><p className="text-lg font-bold text-foreground mt-0.5">{selectedOsgbExpertDetails.deficit} Dk</p></div>
                    </div>
                    <div className="space-y-2">
                      {selectedOsgbExpertDetails.companies.map((company) => (
                        <div key={company.id} className="p-3 rounded-xl border bg-card flex items-center justify-between text-xs gap-3">
                          <div>
                            <h5 className="font-bold text-foreground">{company.companyName}</h5>
                            <p className="text-muted-foreground font-medium mt-0.5">{company.hazardClass} • {company.employeeCount} Çalışan • Risk Skoru: {company.riskScore}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[10px] font-medium rounded">{company.openFlags} Flag</Badge>
                            {company.deficit > 0 ? <Badge variant="outline" className="text-[10px] font-bold text-amber-600 bg-amber-500/5 rounded border-amber-500/20">{company.deficit} Dk Eksik</Badge> : <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-500/5 rounded border-emerald-500/20">Dengeli</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* SAĞ GRUP PANELİ: DİKEY OPERASYONEL RENKLİ REHBER & AKSİYON KARTLARI */}
        <div className="space-y-5">
          
          {/* REHBER: TURUNCU SOFT DEGRADE TEMA */}
          <Card className="rounded-2xl border border-orange-500/20 shadow-md bg-gradient-to-b from-orange-500/[0.03] to-transparent overflow-hidden">
            <CardHeader className="pb-3 border-b border-orange-500/10 bg-orange-500/[0.02]">
              <div className="flex items-center gap-2 text-sm font-bold text-orange-800 dark:text-orange-400">
                <Sparkles className="h-4 w-4 text-orange-500 stroke-[2.5]" />
                Akıllı Öneri ve Hızlı Eylemler
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {prioritySuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={suggestion.onClick}
                  className="w-full p-3 text-left rounded-xl border border-orange-500/10 bg-card hover:bg-orange-500/[0.04] hover:border-orange-500/30 transition-all flex items-center justify-between group gap-4 shadow-sm"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{suggestion.title}</div>
                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed line-clamp-1">{suggestion.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-orange-500/60 group-hover:text-orange-600 transition-colors shrink-0 group-hover:translate-x-0.5 duration-200" />
                </button>
              ))}
            </CardContent>
          </Card>

          {/* MOTOR: MAVİ SOFT DEGRADE TEMA */}
          <Card className="rounded-2xl border border-blue-500/20 shadow-md bg-gradient-to-b from-blue-500/[0.03] to-transparent overflow-hidden">
            <CardHeader className="pb-3 border-b border-blue-500/10 bg-blue-500/[0.02]">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-800 dark:text-blue-400">
                <Bot className="h-4 w-4 text-blue-500 stroke-[2.5]" />
                Denetim Motoru Durumu
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-500/[0.06] border border-blue-500/20 rounded-xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300 block">AI Core Tarayıcı</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Veri analizi kararlı durumda</span>
                </div>
                <Badge className="bg-blue-600 text-white font-bold rounded px-2 py-0.5 text-[10px] tracking-wide shadow-none border-0">AKTiF</Badge>
              </div>

              <div className="space-y-1.5">
                <Button 
                  onClick={() => {
                    toast.success("Denetim motoru tetiklendi", { description: "Tüm aktif portföy ve uyumsuzluk listeleri taranıyor." });
                    void loadCommandData();
                  }}
                  className="w-full h-10 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm text-xs flex items-center justify-between px-4"
                >
                  <span className="flex items-center gap-2"><Play className="h-3.5 w-3.5 fill-white stroke-none" /> Anlık Denetim Başlat</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate("/osgb/batch-logs")}
                  className="w-full h-10 rounded-xl font-semibold border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-xs text-left px-4 flex items-center justify-between"
                >
                  Sistem Log Defterini Aç
                  <FileText className="h-3.5 w-3.5 text-blue-500/60" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* EXPORT: MOR SOFT DEGRADE TEMA */}
          <Card className="rounded-2xl border border-purple-500/20 shadow-md bg-gradient-to-b from-purple-500/[0.03] to-transparent overflow-hidden">
            <CardHeader className="pb-3 border-b border-purple-500/10 bg-purple-500/[0.02]">
              <div className="flex items-center gap-2 text-sm font-bold text-purple-800 dark:text-purple-400">
                <FileWarning className="h-4 w-4 text-purple-500 stroke-[2.5]" />
                Analiz ve Rapor Çıktıları
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Button 
                variant="outline"
                onClick={handleExport}
                className="w-full h-10 rounded-xl font-semibold border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 text-xs px-4 flex items-center justify-between text-left"
              >
                <span>Genel Portföy CSV Çıktısı</span>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate("/osgb/analytics")}
                className="w-full h-10 rounded-xl font-semibold border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 text-xs px-4 flex items-center justify-between text-left"
              >
                <span>Gelişmiş Analitik Grafiklerini Aç</span>
                <BarChart3 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* DIALOG: GÖREV ATAMA DETAYLARI */}
      <Dialog open={Boolean(selectedAction && taskDraft)} onOpenChange={(open) => { if (!open) { setSelectedAction(null); setTaskDraft(null); } }}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Görev Atama Detayları</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Bot tarafından üretilen mevzuat aksiyonunu doğrudan resmi iş görevine dönüştürün.
            </DialogDescription>
          </DialogHeader>

          {selectedAction && taskDraft && (
            <div className="space-y-4 py-2 my-1 border-y max-h-[60vh] overflow-y-auto px-1">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("font-bold text-xs rounded", severityBadgeClass[selectedAction.severity])}>
                    {selectedAction.severity === "critical" ? "Kritik" : selectedAction.severity === "high" ? "Yüksek" : "Orta"}
                  </Badge>
                  <Badge variant="secondary" className="font-semibold text-xs rounded">{selectedAction.companyName}</Badge>
                  <Badge variant="outline" className="font-bold text-xs rounded border-purple-500/20 bg-purple-500/5 text-purple-700 dark:text-purple-300">Skor: {selectedAction.priorityScore}</Badge>
                </div>
                <h3 className="text-base font-bold text-foreground mt-2">{selectedAction.title}</h3>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{selectedAction.detail}</p>
                <div className="text-xs text-muted-foreground font-medium">Mevzuat: <span className="italic">{selectedAction.legalReference}</span></div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Atanacak Sorumlu Personel</label>
                  <Input value={taskDraft.assignedPerson} onChange={(e) => setTaskDraft({ ...taskDraft, assignedPerson: e.target.value })} className="rounded-lg h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Termin / Tamamlama Tarihi</label>
                  <Input type="date" value={taskDraft.deadline} onChange={(e) => setTaskDraft({ ...taskDraft, deadline: e.target.value })} className="rounded-lg h-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Görev Öncelik Seviyesi</label>
                <Select value={taskDraft.priority} onValueChange={(value) => setTaskDraft({ ...taskDraft, priority: value as TaskDraft["priority"] })}>
                  <SelectTrigger className="rounded-lg h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="Kritik">Kritik Öncelikli</SelectItem>
                    <SelectItem value="Yüksek">Yüksek Öncelikli</SelectItem>
                    <SelectItem value="Orta">Orta Seviye</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aksiyon Talimatı / Görev Notu</label>
                <Textarea value={taskDraft.notes} onChange={(e) => setTaskDraft({ ...taskDraft, notes: e.target.value })} className="min-h-[110px] rounded-lg text-sm leading-relaxed" />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setSelectedAction(null); setTaskDraft(null); }} className="rounded-lg h-9 text-xs">Vazgeç</Button>
            <Button onClick={() => void handleCreateTask()} disabled={Boolean(creatingTaskId)} className="rounded-lg h-9 text-xs font-semibold bg-primary hover:bg-primary/90">
              {creatingTaskId ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Görevi Kaydet ve Ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}