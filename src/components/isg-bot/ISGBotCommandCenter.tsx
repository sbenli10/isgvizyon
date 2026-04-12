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
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createOsgbTask } from "@/lib/osgbOperations";
import { addInterFontsToJsPDF } from "@/utils/fonts";
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
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  high: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  medium: "bg-sky-500/15 text-sky-300 border-sky-500/30",
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
    legalReference:
      "İşyeri hekimi ve iş güvenliği uzmanı görevlendirme süreleri - 6331 sayılı Kanun ve ilgili yönetmelik",
    category: "Görevlendirme",
    defaultRoute: "/isg-bot?tab=compliance",
    template: "Eksik süreyi kapatacak sözleşme revizyonu hazırlayın ve görevlendirme sürelerini güncelleyin.",
  },
  CONTRACT_EXPIRED: {
    title: "Sözleşme süresi dolmuş veya bitişe yaklaşmış",
    legalReference: "Görevlendirme sürekliliği yükümlülüğü",
    category: "Sözleşme",
    defaultRoute: "/isg-bot?tab=audit",
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
    defaultRoute: "/isg-bot?tab=audit",
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
  const severityBase = { critical: 95, high: 78, medium: 55 }[params.severity];
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
      const orgId = user.id;
      const [companiesResponse, flagsResponse, alertsResponse, meetingsResponse, tasksResponse] =
        await Promise.all([
          supabase
            .from("isgkatip_companies")
            .select(
              "id, company_name, sgk_no, employee_count, hazard_class, assigned_minutes, required_minutes, compliance_status, risk_score, contract_end, contract_start, assigned_person_name, service_provider_name"
            )
            .eq("org_id", orgId)
            .eq("is_deleted", false),
          supabase
            .from("isgkatip_compliance_flags")
            .select("id, company_id, rule_name, severity, message, status, created_at")
            .eq("org_id", orgId)
            .eq("status", "OPEN"),
          supabase
            .from("isgkatip_predictive_alerts")
            .select("id, company_id, alert_type, severity, message, predicted_date, status")
            .eq("org_id", orgId)
            .eq("status", "ACTIVE"),
          supabase
            .from("board_meetings")
            .select("id, company_id, meeting_date, status")
            .eq("user_id", user.id),
          supabase
            .from("osgb_tasks")
            .select("id, status, priority, due_date")
            .eq("user_id", user.id),
        ]);

      if (companiesResponse.error) throw companiesResponse.error;
      if (flagsResponse.error) throw flagsResponse.error;
      if (alertsResponse.error) throw alertsResponse.error;
      if (meetingsResponse.error) throw meetingsResponse.error;
      if (tasksResponse.error) throw tasksResponse.error;

      const companyRows = (companiesResponse.data ?? []) as CompanyRecord[];
      setCompanies(companyRows);
      setFlags((flagsResponse.data ?? []) as ComplianceFlagRecord[]);
      setAlerts((alertsResponse.data ?? []) as PredictiveAlertRecord[]);
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
          severity:
            company.assigned_minutes < company.required_minutes * 0.5 ? "critical" : "high",
          legalReference: ruleCatalog.DURATION_CHECK.legalReference,
          route: ruleCatalog.DURATION_CHECK.defaultRoute,
          deadline: format(addDays(new Date(), 7), "yyyy-MM-dd"),
          assignedPerson:
            company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          suggestedOwner:
            company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          template: ruleCatalog.DURATION_CHECK.template,
          priorityScore: calculatePriorityScore({
            severity:
              company.assigned_minutes < company.required_minutes * 0.5 ? "critical" : "high",
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
          title:
            contractDays < 0
              ? "Sözleşme süresi dolmuş"
              : "Sözleşme bitiş tarihi yaklaşıyor",
          detail:
            contractDays < 0
              ? `Sözleşme ${Math.abs(contractDays)} gün önce sona ermiş.`
              : `Sözleşme ${contractDays} gün içinde sona erecek.`,
          severity,
          legalReference: ruleCatalog.CONTRACT_EXPIRED.legalReference,
          route: ruleCatalog.CONTRACT_EXPIRED.defaultRoute,
          deadline: format(addDays(new Date(), 3), "yyyy-MM-dd"),
          assignedPerson:
            company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          suggestedOwner:
            company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
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
          detail:
            "50+ çalışanlı firmada son 6 ay içinde kurul toplantısı kaydı bulunmuyor.",
          severity: "high",
          legalReference: ruleCatalog.BOARD_REQUIRED.legalReference,
          route: ruleCatalog.BOARD_REQUIRED.defaultRoute,
          deadline: format(addDays(new Date(), 10), "yyyy-MM-dd"),
          assignedPerson:
            company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          suggestedOwner:
            company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
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
            assignedPerson:
              company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
            suggestedOwner:
              company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
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
          deadline:
            alert.predicted_date?.slice(0, 10) || format(addDays(new Date(), 14), "yyyy-MM-dd"),
          assignedPerson:
            company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
          suggestedOwner:
            company.assigned_person_name || company.service_provider_name || "İSG Uzmanı",
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
          severity:
            selectedCompany.assigned_minutes < selectedCompany.required_minutes * 0.5 ? "critical" : "high",
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
        route: "/isg-bot?tab=audit",
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
        legalReference:
          meta?.legalReference || "İlgili mevzuat yükümlülüğünü doğrulayın ve düzeltici faaliyet başlatın.",
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
        const owner =
          company.assigned_person_name || company.service_provider_name || "Atanmamış";
        const hazardMatches =
          osgbHazardFilter === "ALL" || company.hazard_class === osgbHazardFilter;
        const expertMatches =
          osgbExpertFilter === "ALL" || owner === osgbExpertFilter;
        return hazardMatches && expertMatches;
      }),
    [companies, osgbExpertFilter, osgbHazardFilter]
  );

  const filteredRiskyPortfolio = useMemo(
    () =>
      [...filteredOsgbCompanies]
        .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
        .slice(0, 6),
    [filteredOsgbCompanies]
  );

  const filteredOsgbWorkload = useMemo(() => {
    const grouped = new Map<
      string,
      { name: string; companyCount: number; employeeCount: number; deficit: number }
    >();

    filteredOsgbCompanies.forEach((company) => {
      const owner =
        company.assigned_person_name || company.service_provider_name || "Atanmamış";
      const current = grouped.get(owner) ?? {
        name: owner,
        companyCount: 0,
        employeeCount: 0,
        deficit: 0,
      };
      current.companyCount += 1;
      current.employeeCount += company.employee_count || 0;
      current.deficit += Math.max(
        0,
        (company.required_minutes || 0) - (company.assigned_minutes || 0)
      );
      grouped.set(owner, current);
    });

    return Array.from(grouped.values()).sort((a, b) =>
      b.companyCount === a.companyCount
        ? b.employeeCount - a.employeeCount
        : b.companyCount - a.companyCount
    );
  }, [filteredOsgbCompanies]);

  const selectedOsgbExpertDetails = useMemo(() => {
    if (!selectedOsgbExpert || selectedOsgbExpert === "ALL") return null;

    const expertCompanies = filteredOsgbCompanies.filter((company) => {
      const owner =
        company.assigned_person_name || company.service_provider_name || "Atanmamış";
      return owner === selectedOsgbExpert;
    });

    if (expertCompanies.length === 0) return null;

    return {
      name: selectedOsgbExpert,
      companyCount: expertCompanies.length,
      employeeCount: expertCompanies.reduce(
        (sum, company) => sum + (company.employee_count || 0),
        0
      ),
      deficit: expertCompanies.reduce(
        (sum, company) =>
          sum + Math.max(0, (company.required_minutes || 0) - (company.assigned_minutes || 0)),
        0
      ),
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
      priority:
        item.severity === "critical"
          ? "Kritik"
          : item.severity === "high"
          ? "Yüksek"
          : "Orta",
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
    } finally {
      setExportingCompanyPdf(false);
    }
  };

  const openTaskDialog = (action: ActionItem) => {
    setSelectedAction(action);
    setTaskDraft({
      actionId: action.id,
      assignedPerson: action.suggestedOwner,
      deadline: action.deadline,
      priority:
        action.severity === "critical"
          ? "Kritik"
          : action.severity === "high"
          ? "Yüksek"
          : "Orta",
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
      severity:
        template.priority === "Kritik"
          ? "critical"
          : template.priority === "Yüksek"
          ? "high"
          : "medium",
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
        priority:
          taskDraft.priority === "Kritik"
            ? "critical"
            : taskDraft.priority === "Yüksek"
              ? "high"
              : "medium",
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
      <Card className="border-slate-800 bg-slate-950/60">
        <CardContent className="flex min-h-[260px] items-center justify-center">
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Bot komuta merkezi hazırlanıyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="h-6 w-6 text-cyan-400" />
                Operasyon Komuta Merkezi
              </CardTitle>
              <CardDescription className="max-w-3xl text-slate-400">
                Uzman, firma ve OSGB katmanlarında aynı veri setini farklı karar seviyelerine çevirir.
                Uzman için aksiyon, firma için özet, OSGB için portföy görünümü üretir.
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Firma</div><div className="mt-2 text-2xl font-semibold text-white">{companies.length}</div></CardContent></Card>
              <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Kritik açık</div><div className="mt-2 text-2xl font-semibold text-rose-300">{criticalFlagCount}</div></CardContent></Card>
              <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Yaklaşan iş</div><div className="mt-2 text-2xl font-semibold text-amber-300">{upcomingContractCount}</div></CardContent></Card>
              <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Açık görev</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{openTaskCount}</div></CardContent></Card>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={layer} onValueChange={(value) => setLayer(value as LayerMode)} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900 lg:w-[520px]">
              <TabsTrigger value="expert">Uzman Katmanı</TabsTrigger>
              <TabsTrigger value="company">Firma Katmanı</TabsTrigger>
              <TabsTrigger value="osgb">OSGB Katmanı</TabsTrigger>
            </TabsList>

            <TabsContent value="expert" className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-4">
                <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Kritik mevzuat açığı</p><p className="mt-2 text-3xl font-semibold text-white">{criticalFlagCount}</p></div><ShieldAlert className="h-8 w-8 text-rose-400" /></div></CardContent></Card>
                <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Üretilecek aksiyon</p><p className="mt-2 text-3xl font-semibold text-white">{expertActions.length}</p></div><ClipboardCheck className="h-8 w-8 text-cyan-400" /></div></CardContent></Card>
                <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><div><p className="text-sm text-slate-400">Ortalama öncelik skoru</p><p className="mt-2 text-3xl font-semibold text-white">{expertActions.length ? Math.round(expertActions.reduce((sum, action) => sum + action.priorityScore, 0) / expertActions.length) : 0}</p></div></CardContent></Card>
                <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Tahminsel uyarı</p><p className="mt-2 text-3xl font-semibold text-white">{alerts.length}</p></div><BellRing className="h-8 w-8 text-amber-400" /></div></CardContent></Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="border-slate-800 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle>Öncelik motoru</CardTitle>
                    <CardDescription>Severity, sözleşme günü, çalışan hacmi ve açık sayısına göre sıralama yapılır.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {expertActions.map((action) => (
                      <div key={action.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={severityBadgeClass[action.severity]}>{action.severity === "critical" ? "Kritik" : action.severity === "high" ? "Yüksek" : "Orta"}</Badge>
                              <Badge variant="outline" className="border-slate-700 text-slate-300">{action.companyName}</Badge>
                              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Skor {action.priorityScore}</Badge>
                            </div>
                            <h3 className="text-lg font-semibold text-white">{action.title}</h3>
                            <p className="text-sm text-slate-300">{action.detail}</p>
                            <p className="text-xs text-slate-500">Mevzuat dayanağı: {action.legalReference}</p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500"><span>Sorumlu: {action.suggestedOwner}</span><span>Termin: {formatDateLabel(action.deadline)}</span></div>
                          </div>
                          <div className="flex flex-col gap-2 lg:w-[220px]">
                            <Button onClick={() => openTaskDialog(action)} className="w-full">Görev ata</Button>
                            <Button variant="outline" className="w-full border-slate-700 text-slate-200" onClick={() => navigate(action.route)}>İlgili modüle git<ArrowRight className="ml-2 h-4 w-4" /></Button>
                          </div>
                        </div>
                        <Progress value={action.priorityScore} className="mt-3 h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="border-slate-800 bg-slate-900/70">
                    <CardHeader>
                      <CardTitle>Mevzuat kartları</CardTitle>
                      <CardDescription>En çok tetiklenen yükümlülük alanları ve yoğunlukları.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {legislationCards.map((item) => (
                        <div key={item.title} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white"><Gavel className="h-4 w-4 text-amber-400" />{item.title}</div>
                            <Badge variant="outline" className="border-slate-700 text-slate-300">{item.count} kayıt</Badge>
                          </div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">{item.category}</p>
                          <p className="mt-2 text-sm text-slate-300">{item.legalReference}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-slate-800 bg-slate-900/70">
                    <CardHeader>
                      <CardTitle>Aksiyon şablonları</CardTitle>
                      <CardDescription>Tekrarlanan operasyon akışları için hazır görev şablonları.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {expertTemplates.map((template) => (
                        <div key={template.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-white">{template.title}</h4>
                              <p className="mt-1 text-sm text-slate-300">{template.detail}</p>
                            </div>
                            <Badge variant="outline" className="border-slate-700 text-slate-300">{template.priority}</Badge>
                          </div>
                          <Button variant="outline" className="mt-3 w-full border-slate-700 text-slate-200" onClick={() => openTemplateDialog(template)}>Şablonu kullan</Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="company" className="space-y-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div><h3 className="text-lg font-semibold text-white">Firma karar özeti</h3><p className="text-sm text-slate-400">Teknik detay yerine yönetim için sade aksiyon özetleri gösterilir.</p></div>
                <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
                  <div className="w-full lg:w-[360px]"><Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}><SelectTrigger className="border-slate-700 bg-slate-950 text-slate-200"><SelectValue placeholder="Firma seçin" /></SelectTrigger><SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.company_name}</SelectItem>)}</SelectContent></Select></div>
                  <Button variant="outline" className="border-slate-700 text-slate-200" onClick={handleExportCompanySummary} disabled={!selectedCompany || exportingCompanyPdf}>
                    {exportingCompanyPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Yonetici PDF ozeti
                  </Button>
                </div>
              </div>

              {selectedCompany ? <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><p className="text-sm text-slate-400">Uyum durumu</p><p className="mt-2 text-2xl font-semibold text-white">{complianceLabels[selectedCompany.compliance_status] || "Bilinmiyor"}</p></CardContent></Card>
                  <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><p className="text-sm text-slate-400">Risk puanı</p><p className="mt-2 text-2xl font-semibold text-white">{selectedCompany.risk_score ?? 0}/100</p><Progress value={selectedCompany.risk_score ?? 0} className="mt-3 h-2" /></CardContent></Card>
                  <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><p className="text-sm text-slate-400">Açık uyumsuzluk</p><p className="mt-2 text-2xl font-semibold text-white">{selectedCompanyFlags.length}</p></CardContent></Card>
                  <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><p className="text-sm text-slate-400">Sözleşme bitişi</p><p className="mt-2 text-2xl font-semibold text-white">{formatDateLabel(selectedCompany.contract_end)}</p></CardContent></Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-6">
                    <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Yönetici özeti</CardTitle><CardDescription>Firma yetkilisi için teknik olmayan özet karar görünümü.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-slate-300">{companyManagementSummary && <><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-white"><Building2 className="h-4 w-4 text-cyan-400" />Genel durum</div><p>Uyum durumu: <strong>{companyManagementSummary.overallStatus}</strong> • Risk seviyesi: <strong>{companyManagementSummary.severityLevel}</strong></p><p className="mt-2">{companyManagementSummary.keyMessage}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-white"><Briefcase className="h-4 w-4 text-amber-400" />Yönetim notu</div><p>{companyManagementSummary.budgetNote}</p><p className="mt-2">{companyManagementSummary.contractNote}</p></div></>}</CardContent></Card>
                    <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Kritik eksikler</CardTitle><CardDescription>Firma yöneticisinin teknik terminolojiye boğulmadan görebileceği öncelikli açıklar.</CardDescription></CardHeader><CardContent className="space-y-3">
                      {selectedCompanyFlags.length === 0 && selectedCompanyAlerts.length === 0 && selectedCompany.assigned_minutes >= selectedCompany.required_minutes ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">Bu firma için şu an kritik açık görünmüyor. Periyodik izleme ve kurul takibi yeterli.</div> : <>
                        {selectedCompany.assigned_minutes < selectedCompany.required_minutes && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="font-semibold text-white">Hizmet süresi yetersiz</p><p className="mt-1 text-sm text-slate-300">Atanan süre {selectedCompany.assigned_minutes} dk, gerekli süre {selectedCompany.required_minutes} dk.</p></div>}
                        {selectedCompanyFlags.map((flag) => <div key={flag.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="flex items-center gap-2"><Badge variant="outline" className={flag.severity === "CRITICAL" ? severityBadgeClass.critical : severityBadgeClass.medium}>{flag.severity}</Badge><span className="font-medium text-white">{flag.rule_name}</span></div><p className="mt-2 text-sm text-slate-300">{flag.message}</p></div>)}
                        {selectedCompanyAlerts.map((alert) => <div key={alert.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><p className="font-semibold text-white">Yaklaşan risk uyarısı</p><p className="mt-1 text-sm text-slate-300">{alert.message}</p></div>)}
                      </>}
                    </CardContent></Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Aylık aksiyon planı</CardTitle><CardDescription>Bu ay tamamlanması gereken yönetim ve operasyon aksiyonları.</CardDescription></CardHeader><CardContent className="space-y-3">{companyMonthlyActionPlan.length === 0 ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">Bu ay için planlanmış kritik aksiyon görünmüyor.</div> : companyMonthlyActionPlan.map((item) => <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-white">{item.title}</h4><Badge variant="outline" className={severityBadgeClass[item.severity]}>{item.severity === "critical" ? "Kritik" : item.severity === "high" ? "Yuksek" : "Orta"}</Badge></div><p className="mt-1 text-sm text-slate-300">Sorumlu: {item.owner}</p><p className="text-sm text-slate-400">Termin: {item.due}</p></div><div className="flex flex-col items-end gap-2"><Badge variant="outline" className="border-slate-700 text-slate-300">{item.status}</Badge><Button size="sm" variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20" onClick={() => openCompanyPlanTaskDialog(item)}>Gorev olustur</Button></div></div></div>)}</CardContent></Card>
                    <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Yaklaşan işler ve yönetim aksiyonu</CardTitle><CardDescription>Yönetim tarafında gecikmeden alınması gereken kararlar.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-slate-300">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-white"><CalendarClock className="h-4 w-4 text-cyan-400" />Yaklaşan iş</div><p>Sözleşme bitiş tarihi: <strong>{formatDateLabel(selectedCompany.contract_end)}</strong></p><p className="mt-1">Son kurul kaydı: <strong>{selectedCompanyMeetings[0] ? formatDateLabel(selectedCompanyMeetings[0].meeting_date) : "Kayıt bulunmuyor"}</strong></p></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-white"><Building2 className="h-4 w-4 text-amber-400" />Yönetim aksiyonu</div><p>Öncelik, süre eksiği ve açık kritik uyumsuzlukları kapatmak. Karar mekanizması olarak kurul gündemi veya ek uzman süresi planlaması önerilir.</p></div>
                      <div className="flex gap-2"><Button className="flex-1" onClick={() => navigate("/isg-bot?tab=audit")}>Denetim özetine git</Button><Button variant="outline" className="flex-1 border-slate-700 text-slate-200" onClick={() => navigate("/board-meetings")}>Kurul işlemleri</Button></div>
                    </CardContent></Card>
                  </div>
                </div>
              </> : <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">Firma verisi bulunmuyor. Önce İSG-KATİP senkronizasyonu yapın.</div>}
            </TabsContent>

            <TabsContent value="osgb" className="space-y-6">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white"><SlidersHorizontal className="h-4 w-4 text-cyan-400" />Tehlike sinifi filtresi</div>
                  <Select value={osgbHazardFilter} onValueChange={setOsgbHazardFilter}>
                    <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{osgbHazardOptions.map((option) => <SelectItem key={option} value={option}>{option === "ALL" ? "Tum siniflar" : option}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white"><Users className="h-4 w-4 text-amber-400" />Uzman filtresi</div>
                  <Select value={osgbExpertFilter} onValueChange={setOsgbExpertFilter}>
                    <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{osgbExpertOptions.map((option) => <SelectItem key={option} value={option}>{option === "ALL" ? "Tum uzmanlar" : option}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white"><Briefcase className="h-4 w-4 text-emerald-400" />Uzman drill-down</div>
                  <Select value={selectedOsgbExpert} onValueChange={setSelectedOsgbExpert}>
                    <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["ALL", ...filteredOsgbWorkload.map((item) => item.name)].map((option) => <SelectItem key={option} value={option}>{option === "ALL" ? "Detay secilmedi" : option}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><p className="text-sm text-slate-400">Riskli firma</p><p className="mt-2 text-3xl font-semibold text-white">{filteredOsgbCompanies.filter((company) => (company.risk_score ?? 0) >= 70).length}</p></CardContent></Card>
                <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><p className="text-sm text-slate-400">Açık uyumsuzluk</p><p className="mt-2 text-3xl font-semibold text-white">{flags.filter((flag) => filteredOsgbCompanies.some((company) => company.id === flag.company_id)).length}</p></CardContent></Card>
                <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><p className="text-sm text-slate-400">Yoğun uzman</p><p className="mt-2 text-lg font-semibold text-white">{filteredOsgbWorkload[0]?.name ?? "Veri yok"}</p></CardContent></Card>
                <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-5"><p className="text-sm text-slate-400">Toplam çalışan</p><p className="mt-2 text-3xl font-semibold text-white">{filteredOsgbCompanies.reduce((sum, company) => sum + (company.employee_count || 0), 0)}</p></CardContent></Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Portföy risk görünümü</CardTitle><CardDescription>Hangi firmada hangi açık var sorusuna hızlı yanıt veren üst düzey tablo.</CardDescription></CardHeader><CardContent className="space-y-3">{filteredRiskyPortfolio.map((company) => { const companyOpenFlags = flags.filter((flag) => flag.company_id === company.id).length; const deficit = Math.max(0, company.required_minutes - company.assigned_minutes); return <div key={company.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="font-semibold text-white">{company.company_name}</h3><p className="mt-1 text-sm text-slate-400">Risk skoru {company.risk_score ?? 0} • {company.hazard_class} • {company.employee_count} çalışan</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">{companyOpenFlags} açık flag</Badge>{deficit > 0 && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">{deficit} dk eksik</Badge>}<Badge variant="outline" className="border-slate-700 text-slate-300">{company.assigned_person_name || company.service_provider_name || "Atanmamış"}</Badge></div></div></div>; })}</CardContent></Card>
                <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Uzman yoğunluk matrisi</CardTitle><CardDescription>Hangi uzmanın üzerinde kaç firma ve kaç çalışan yoğunluğu olduğunu gösterir.</CardDescription></CardHeader><CardContent className="space-y-3">{filteredOsgbWorkload.map((item) => <button type="button" key={item.name} className={`w-full rounded-xl border p-4 text-left transition ${selectedOsgbExpert === item.name ? "border-cyan-500/40 bg-cyan-500/10" : "border-slate-800 bg-slate-950/70 hover:border-slate-700"}`} onClick={() => setSelectedOsgbExpert(item.name)}><div className="flex items-center justify-between"><div><p className="font-semibold text-white">{item.name}</p><p className="text-sm text-slate-400">{item.companyCount} firma • {item.employeeCount} çalışan</p></div><div className="text-right"><p className="text-sm text-slate-400">Süre açığı</p><p className="text-lg font-semibold text-white">{item.deficit} dk</p></div></div></button>)}</CardContent></Card>
              </div>

              {selectedOsgbExpertDetails ? (
                <Card className="border-slate-800 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle>{selectedOsgbExpertDetails.name} uzman drill-down</CardTitle>
                    <CardDescription>Uzmanın sorumlu olduğu firmalar, açıklar ve risk dağılımı.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><p className="text-sm text-slate-400">Firma sayısı</p><p className="mt-2 text-2xl font-semibold text-white">{selectedOsgbExpertDetails.companyCount}</p></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><p className="text-sm text-slate-400">Toplam çalışan</p><p className="mt-2 text-2xl font-semibold text-white">{selectedOsgbExpertDetails.employeeCount}</p></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><p className="text-sm text-slate-400">Toplam süre açığı</p><p className="mt-2 text-2xl font-semibold text-white">{selectedOsgbExpertDetails.deficit} dk</p></div>
                    </div>
                    <div className="space-y-3">
                      {selectedOsgbExpertDetails.companies.map((company) => (
                        <div key={company.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <h4 className="font-semibold text-white">{company.companyName}</h4>
                              <p className="mt-1 text-sm text-slate-400">{company.hazardClass} • {company.employeeCount} çalışan • Risk skoru {company.riskScore}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">{company.openFlags} açık</Badge>
                              {company.deficit > 0 ? <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">{company.deficit} dk eksik</Badge> : <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Süre dengeli</Badge>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedAction && taskDraft)} onOpenChange={(open) => { if (!open) { setSelectedAction(null); setTaskDraft(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Görev atama detayları</DialogTitle>
            <DialogDescription>
              Bot tarafından üretilen aksiyonu doğrudan görev kaydına dönüştürün.
            </DialogDescription>
          </DialogHeader>

          {selectedAction && taskDraft && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={severityBadgeClass[selectedAction.severity]}>{selectedAction.severity === "critical" ? "Kritik" : selectedAction.severity === "high" ? "Yüksek" : "Orta"}</Badge>
                  <Badge variant="outline">Skor {selectedAction.priorityScore}</Badge>
                  <Badge variant="outline">{selectedAction.companyName}</Badge>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{selectedAction.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selectedAction.detail}</p>
                <p className="mt-2 text-xs text-muted-foreground">Mevzuat: {selectedAction.legalReference}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Atanacak kişi</label>
                  <Input value={taskDraft.assignedPerson} onChange={(e) => setTaskDraft({ ...taskDraft, assignedPerson: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Termin tarihi</label>
                  <Input type="date" value={taskDraft.deadline} onChange={(e) => setTaskDraft({ ...taskDraft, deadline: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Öncelik</label>
                <Select value={taskDraft.priority} onValueChange={(value) => setTaskDraft({ ...taskDraft, priority: value as TaskDraft["priority"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kritik">Kritik</SelectItem>
                    <SelectItem value="Yüksek">Yüksek</SelectItem>
                    <SelectItem value="Orta">Orta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Aksiyon şablonu / görev notu</label>
                <Textarea value={taskDraft.notes} onChange={(e) => setTaskDraft({ ...taskDraft, notes: e.target.value })} className="min-h-[140px]" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedAction(null); setTaskDraft(null); }}>İptal</Button>
            <Button onClick={() => void handleCreateTask()} disabled={Boolean(creatingTaskId)}>
              {creatingTaskId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Görevi oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
