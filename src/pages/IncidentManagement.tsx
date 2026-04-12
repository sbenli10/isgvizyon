import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  ClipboardPlus,
  Download,
  Eye,
  FileUp,
  Lock,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { useAccessRole } from "@/hooks/useAccessRole";
import { downloadCsv } from "@/lib/csvExport";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import {
  closeIncidentReport,
  createIncidentCapaRecord,
  createIncidentTask,
  deleteIncidentAction,
  deleteIncidentAttachment,
  deleteIncidentReport,
  getIncidentAttachmentDownloadUrl,
  getIncidentCompanyOptions,
  listIncidentActions,
  listIncidentAttachments,
  listIncidentReportsPage,
  type IncidentClosureDecision,
  type IncidentActionInput,
  type IncidentActionRecord,
  type IncidentFormInput,
  type IncidentRootCauseCategory,
  type IncidentReportRecord,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
  updateIncidentActionStatus,
  upsertIncidentAction,
  upsertIncidentReport,
  uploadIncidentAttachment,
} from "@/lib/incidentOperations";
import type { OsgbCompanyOption } from "@/lib/osgbOperations";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type IncidentFormState = {
  companyId: string;
  incidentType: IncidentType;
  title: string;
  description: string;
  incidentDate: string;
  location: string;
  affectedPerson: string;
  severity: IncidentSeverity;
  rootCause: string;
  immediateAction: string;
  correctiveAction: string;
  status: IncidentStatus;
  reportedBy: string;
  witnessInfo: string;
  accidentCategory: string;
  rootCauseCategory: IncidentRootCauseCategory;
  lostTimeDays: string;
  requiresNotification: boolean;
};

type IncidentActionFormState = {
  actionTitle: string;
  ownerName: string;
  dueDate: string;
  notes: string;
};

type IncidentCloseFormState = {
  closureSummary: string;
  closureDecision: IncidentClosureDecision;
  closureNotes: string;
  createCapa: boolean;
};

const emptyIncidentForm: IncidentFormState = {
  companyId: "",
  incidentType: "near_miss",
  title: "",
  description: "",
  incidentDate: new Date().toISOString().slice(0, 16),
  location: "",
  affectedPerson: "",
  severity: "medium",
  rootCause: "",
  immediateAction: "",
  correctiveAction: "",
  status: "open",
  reportedBy: "",
  witnessInfo: "",
  accidentCategory: "",
  rootCauseCategory: "other",
  lostTimeDays: "0",
  requiresNotification: false,
};

const emptyActionForm: IncidentActionFormState = {
  actionTitle: "",
  ownerName: "",
  dueDate: "",
  notes: "",
};

const emptyCloseForm: IncidentCloseFormState = {
  closureSummary: "",
  closureDecision: "monitor_only",
  closureNotes: "",
  createCapa: false,
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const INCIDENT_PAGE_SIZE = 20;

const typeLabel: Record<IncidentType, string> = {
  work_accident: "İş Kazası",
  near_miss: "Ramak Kala",
};

const severityLabel: Record<IncidentSeverity, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

const statusLabel: Record<IncidentStatus, string> = {
  open: "Açık",
  investigating: "İnceleniyor",
  action_required: "Aksiyon Bekliyor",
  closed: "Kapatıldı",
};

const severityClass: Record<IncidentSeverity, string> = {
  low: "border-slate-400/20 bg-slate-500/15 text-slate-200",
  medium: "border-sky-400/20 bg-sky-500/15 text-sky-200",
  high: "border-orange-400/20 bg-orange-500/15 text-orange-200",
  critical: "border-red-400/20 bg-red-500/15 text-red-200",
};

const actionStatusLabel: Record<IncidentActionRecord["status"], string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};

const rootCauseCategoryLabel: Record<IncidentRootCauseCategory, string> = {
  human_error: "İnsan hatası",
  unsafe_condition: "Güvensiz durum",
  training_gap: "Eğitim eksikliği",
  process_gap: "Proses açığı",
  equipment_failure: "Ekipman arızası",
  environmental_factor: "Çevresel etken",
  contractor_issue: "Taşeron kaynaklı",
  other: "Diğer",
};

const closureDecisionLabel: Record<IncidentClosureDecision, string> = {
  monitor_only: "İzleme ile kapat",
  training_action: "Eğitim aksiyonu ile kapat",
  process_revision: "Proses revizyonu ile kapat",
  capa_required: "DÖF zorunlu",
};

const getCacheKey = (userId: string) => `incident-management:${userId}`;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("tr-TR") : "-";

export default function IncidentManagement() {
  const { user } = useAuth();
  const { role, canManage, isViewer } = useAccessRole();

  const [records, setRecords] = useState<IncidentReportRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbCompanyOption[]>([]);
  const [attachments, setAttachments] = useState<
    Awaited<ReturnType<typeof listIncidentAttachments>>
  >([]);
  const [actions, setActions] = useState<IncidentActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [taskCreating, setTaskCreating] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [closeSaving, setCloseSaving] = useState(false);
  const [capaCreating, setCapaCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IncidentReportRecord | null>(null);
  const [selected, setSelected] = useState<IncidentReportRecord | null>(null);
  const [form, setForm] = useState<IncidentFormState>(emptyIncidentForm);
  const [actionForm, setActionForm] =
    useState<IncidentActionFormState>(emptyActionForm);
  const [closeForm, setCloseForm] = useState<IncidentCloseFormState>(emptyCloseForm);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<IncidentType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const canDelete = role === "admin" || role === "inspector";
  const canClose = role === "admin" || role === "inspector";
  const canCreateCapa = role === "admin" || role === "inspector";

  const loadCompanies = async () => {
    if (!user?.id) return;

    try {
      const companyRows = await getIncidentCompanyOptions(user.id);
      setCompanies(companyRows);
      writeOsgbPageCache(`${getCacheKey(user.id)}:companies`, { companyRows });
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Firma seçenekleri yüklenemedi.",
      );
    }
  };

  const loadData = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);

    try {
      const incidentResult = await listIncidentReportsPage(user.id, {
        page,
        pageSize: INCIDENT_PAGE_SIZE,
        search,
        type: typeFilter,
        status: statusFilter,
      });

      setRecords(incidentResult.rows);
      setTotalCount(incidentResult.count);
      writeOsgbPageCache(
        `${getCacheKey(user.id)}:${typeFilter}:${statusFilter}:${search}:${page}`,
        {
          incidentRows: incidentResult.rows,
          totalCount: incidentResult.count,
        },
      );
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "İş kazası ve ramak kala kayıtları yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const cached = readOsgbPageCache<{
      companyRows: OsgbCompanyOption[];
    }>(`${getCacheKey(user.id)}:companies`, CACHE_TTL_MS);

    if (cached) {
      setCompanies(cached.companyRows);
      void loadCompanies();
    } else {
      void loadCompanies();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const cached = readOsgbPageCache<{
      incidentRows: IncidentReportRecord[];
      totalCount: number;
    }>(`${getCacheKey(user.id)}:${typeFilter}:${statusFilter}:${search}:${page}`, CACHE_TTL_MS);

    if (cached) {
      setRecords(cached.incidentRows);
      setTotalCount(cached.totalCount);
      setLoading(false);
      void loadData(true);
      return;
    }

    void loadData();
  }, [page, search, statusFilter, typeFilter, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter]);

  const summary = useMemo(
    () => ({
      total: totalCount,
      workAccident: records.filter(
        (item) => item.incident_type === "work_accident",
      ).length,
      nearMiss: records.filter((item) => item.incident_type === "near_miss")
        .length,
      criticalOpen: records.filter(
        (item) => item.severity === "critical" && item.status !== "closed",
      ).length,
    }),
    [records, totalCount],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / INCIDENT_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const operationalInsights = useMemo(
    () => ({
      requiresNotification: records.filter((item) => item.requires_notification)
        .length,
      actionPending: records.filter((item) => item.status === "action_required")
        .length,
      thisMonth: records.filter((item) => {
        const incidentDate = new Date(item.incident_date);
        const now = new Date();
        return (
          incidentDate.getMonth() === now.getMonth() &&
          incidentDate.getFullYear() === now.getFullYear()
        );
      }).length,
      unresolvedHighRisk: records.filter(
        (item) =>
          (item.severity === "high" || item.severity === "critical") &&
          item.status !== "closed",
      ).length,
    }),
    [records],
  );

  const reporting = useMemo(() => {
    const closed = records.filter((item) => item.status === "closed");
    const linkedCapa = records.filter((item) => item.capa_record_id).length;
    const rootCauseBreakdown = Object.entries(
      records.reduce<Record<string, number>>((acc, item) => {
        const key = item.root_cause_category || "other";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([key, count]) => ({
        key: key as IncidentRootCauseCategory,
        label: rootCauseCategoryLabel[key as IncidentRootCauseCategory] || "Diğer",
        count,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);

    const closureDecisionBreakdown = Object.entries(
      closed.reduce<Record<string, number>>((acc, item) => {
        const key = item.closure_decision || "monitor_only";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([key, count]) => ({
        key: key as IncidentClosureDecision,
        label: closureDecisionLabel[key as IncidentClosureDecision] || "İzleme ile kapat",
        count,
      }))
      .sort((left, right) => right.count - left.count);

    return {
      closedCount: closed.length,
      openCount: records.length - closed.length,
      linkedCapa,
      pendingReview: records.filter(
        (item) =>
          item.status !== "closed" &&
          (item.severity === "high" || item.severity === "critical"),
      ).length,
      rootCauseBreakdown,
      closureDecisionBreakdown,
    };
  }, [records]);

  const resetIncidentForm = () => {
    setForm(emptyIncidentForm);
    setEditing(null);
  };

  const resetActionForm = () => {
    setActionForm(emptyActionForm);
  };

  const resetCloseForm = () => {
    setCloseForm(emptyCloseForm);
  };

  const openCreate = () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }

    resetIncidentForm();
    setDialogOpen(true);
  };

  const openEdit = (record: IncidentReportRecord) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }

    setEditing(record);
    setForm({
      companyId: record.company_id || "",
      incidentType: record.incident_type,
      title: record.title,
      description: record.description,
      incidentDate: record.incident_date.slice(0, 16),
      location: record.location || "",
      affectedPerson: record.affected_person || "",
      severity: record.severity,
      rootCause: record.root_cause || "",
      immediateAction: record.immediate_action || "",
      correctiveAction: record.corrective_action || "",
      status: record.status,
      reportedBy: record.reported_by || "",
      witnessInfo: record.witness_info || "",
      accidentCategory: record.accident_category || "",
      rootCauseCategory: record.root_cause_category || "other",
      lostTimeDays: String(record.lost_time_days ?? 0),
      requiresNotification: record.requires_notification,
    });
    setDialogOpen(true);
  };

  const openDetail = async (record: IncidentReportRecord) => {
    setSelected(record);
    setDetailOpen(true);
    setDetailLoading(true);
    resetActionForm();
    setCloseForm({
      closureSummary: record.closure_summary || "",
      closureDecision: record.closure_decision || "monitor_only",
      closureNotes: record.closure_notes || "",
      createCapa: !record.capa_record_id,
    });

    try {
      const [attachmentRows, actionRows] = await Promise.all([
        listIncidentAttachments(record.id),
        listIncidentActions(record.id),
      ]);

      setAttachments(attachmentRows);
      setActions(actionRows);
    } catch (detailError) {
      toast.error(
        detailError instanceof Error
          ? detailError.message
          : "Detaylar yüklenemedi.",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }

    if (!user?.id || !form.title.trim() || !form.description.trim()) {
      toast.error("Başlık ve açıklama zorunludur.");
      return;
    }

    const lostTimeDays = Number(form.lostTimeDays || "0");
    if (!Number.isFinite(lostTimeDays) || lostTimeDays < 0) {
      toast.error("İş günü kaybı alanı 0 veya daha büyük olmalıdır.");
      return;
    }

    setSaving(true);

    try {
      const payload: IncidentFormInput = {
        companyId: form.companyId || null,
        incidentType: form.incidentType,
        title: form.title,
        description: form.description,
        incidentDate: form.incidentDate,
        location: form.location,
        affectedPerson: form.affectedPerson,
        severity: form.severity,
        rootCause: form.rootCause,
        immediateAction: form.immediateAction,
        correctiveAction: form.correctiveAction,
        status: form.status,
        reportedBy: form.reportedBy,
        witnessInfo: form.witnessInfo,
        accidentCategory: form.accidentCategory,
        rootCauseCategory: form.rootCauseCategory,
        lostTimeDays,
        requiresNotification: form.requiresNotification,
      };

      await upsertIncidentReport(user.id, payload, editing?.id);
      await loadData(true);

      setDialogOpen(false);
      resetIncidentForm();
      toast.success(
        editing ? "Olay kaydı güncellendi." : "Olay kaydı oluşturuldu.",
      );
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Olay kaydı kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: IncidentReportRecord) => {
    if (!canDelete) {
      toast.error("Bu işlem için silme yetkisi gerekiyor.");
      return;
    }

    if (!confirm(`"${record.title}" kaydını silmek istiyor musunuz?`)) return;

    try {
      await deleteIncidentReport(record.id);
      await loadData(true);
      if (selected?.id === record.id) {
        setSelected(null);
        setDetailOpen(false);
      }
      toast.success("Olay kaydı silindi.");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Olay kaydı silinemedi.",
      );
    }
  };

  const handleAttachmentDownload = async (filePath: string) => {
    try {
      const signedUrl = await getIncidentAttachmentDownloadUrl(filePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      toast.error(
        downloadError instanceof Error
          ? downloadError.message
          : "Dosya indirilemedi.",
      );
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    if (!user?.id || !selected) return;

    setUploadingFile(true);
    try {
      const saved = await uploadIncidentAttachment(user.id, selected.id, file);
      setAttachments((prev) => [saved, ...prev]);
      toast.success("Dosya eklendi.");
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error
          ? uploadError.message
          : "Dosya yüklenemedi.",
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }

    const attachment = attachments.find((item) => item.id === attachmentId);
    if (!attachment) return;

    try {
      await deleteIncidentAttachment(attachment);
      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      toast.success("Dosya silindi.");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Dosya silinemedi.",
      );
    }
  };

  const handleCreateTask = async () => {
    if (!user?.id || !selected) return;

    setTaskCreating(true);
    try {
      await createIncidentTask(user.id, selected);
      toast.success("OSGB görevi oluşturuldu.");
    } catch (taskError) {
      toast.error(
        taskError instanceof Error
          ? taskError.message
          : "Görev oluşturulamadı.",
      );
    } finally {
      setTaskCreating(false);
    }
  };

  const handleCreateCapa = async () => {
    if (!user?.id || !selected) return;
    if (!canCreateCapa) {
      toast.error("Bu işlem için DÖF oluşturma yetkisi gerekiyor.");
      return;
    }
    if (selected.capa_record_id) {
      toast.info("Bu olay için zaten bağlı bir DÖF kaydı bulunuyor.");
      return;
    }

    setCapaCreating(true);
    try {
      const capaRecordId = await createIncidentCapaRecord(user.id, selected);
      const updated = {
        ...selected,
        capa_record_id: capaRecordId,
      };
      const saved = await upsertIncidentReport(
        user.id,
        {
          companyId: updated.company_id,
          incidentType: updated.incident_type,
          title: updated.title,
          description: updated.description,
          incidentDate: updated.incident_date,
          location: updated.location,
          affectedPerson: updated.affected_person,
          severity: updated.severity,
          rootCause: updated.root_cause,
          immediateAction: updated.immediate_action,
          correctiveAction: updated.corrective_action,
          status: updated.status,
          reportedBy: updated.reported_by,
          witnessInfo: updated.witness_info,
          accidentCategory: updated.accident_category,
          rootCauseCategory: updated.root_cause_category || "other",
          lostTimeDays: updated.lost_time_days,
          requiresNotification: updated.requires_notification,
          closureSummary: updated.closure_summary,
          closureDecision: updated.closure_decision,
          closureNotes: updated.closure_notes,
          closedAt: updated.closed_at,
          closedBy: updated.closed_by,
          capaRecordId,
        },
        updated.id,
      );

      setSelected(saved);
      await loadData(true);
      toast.success("Incident kaydından otomatik DÖF oluşturuldu.");
    } catch (capaError) {
      toast.error(
        capaError instanceof Error ? capaError.message : "DÖF kaydı oluşturulamadı.",
      );
    } finally {
      setCapaCreating(false);
    }
  };

  const handleActionSave = async () => {
    if (!user?.id || !selected) return;
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!actionForm.actionTitle.trim()) {
      toast.error("Aksiyon başlığı zorunludur.");
      return;
    }

    setActionSaving(true);
    try {
      const payload: IncidentActionInput = {
        actionTitle: actionForm.actionTitle,
        ownerName: actionForm.ownerName,
        dueDate: actionForm.dueDate || null,
        notes: actionForm.notes,
        status: "open",
      };

      const saved = await upsertIncidentAction(user.id, selected.id, payload);
      setActions((prev) => [saved, ...prev]);
      resetActionForm();
      toast.success("Aksiyon eklendi.");
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Aksiyon eklenemedi.",
      );
    } finally {
      setActionSaving(false);
    }
  };

  const handleActionDelete = async (actionId: string) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }

    try {
      await deleteIncidentAction(actionId);
      setActions((prev) => prev.filter((item) => item.id !== actionId));
      toast.success("Aksiyon silindi.");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Aksiyon silinemedi.",
      );
    }
  };

  const handleActionStatusChange = async (
    actionId: string,
    status: IncidentActionRecord["status"],
  ) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }

    try {
      const saved = await updateIncidentActionStatus(actionId, status);
      setActions((prev) => prev.map((item) => (item.id === actionId ? saved : item)));
      toast.success("Aksiyon durumu güncellendi.");
    } catch (statusError) {
      toast.error(
        statusError instanceof Error
          ? statusError.message
          : "Aksiyon durumu güncellenemedi.",
      );
    }
  };

  const openCloseWorkflow = () => {
    if (!selected) return;
    if (!canClose) {
      toast.error("Bu işlem için olay kapatma yetkisi gerekiyor.");
      return;
    }

    setCloseForm({
      closureSummary: selected.closure_summary || "",
      closureDecision: selected.closure_decision || "monitor_only",
      closureNotes: selected.closure_notes || "",
      createCapa:
        !selected.capa_record_id &&
        (selected.severity === "high" ||
          selected.severity === "critical" ||
          selected.status === "action_required"),
    });
    setCloseDialogOpen(true);
  };

  const handleCloseIncident = async () => {
    if (!user?.id || !selected) return;
    if (!canClose) {
      toast.error("Bu işlem için olay kapatma yetkisi gerekiyor.");
      return;
    }
    if (!closeForm.closureSummary.trim()) {
      toast.error("Kapatma özeti zorunludur.");
      return;
    }

    const incompleteActions = actions.filter(
      (item) => item.status !== "completed" && item.status !== "cancelled",
    ).length;
    if (incompleteActions > 0) {
      toast.error("Açık aksiyonlar tamamlanmadan olay kapatılamaz.");
      return;
    }

    setCloseSaving(true);
    try {
      const saved = await closeIncidentReport(user.id, selected, {
        status: "closed",
        closureSummary: closeForm.closureSummary,
        closureDecision: closeForm.closureDecision,
        closureNotes: closeForm.closureNotes,
        createCapa:
          closeForm.createCapa || closeForm.closureDecision === "capa_required",
      });

      setSelected(saved);
      await loadData(true);
      setCloseDialogOpen(false);
      toast.success("Olay kapatıldı.");
    } catch (closeError) {
      toast.error(
        closeError instanceof Error ? closeError.message : "Olay kapatılamadı.",
      );
    } finally {
      setCloseSaving(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                İş Kazası / Ramak Kala Merkezi
              </h1>
              <p className="text-sm text-slate-400">
                Olay kaydı, kök neden, aksiyon takibi ve görev üretimi tek
                ekranda yönetilir.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              downloadCsv(
                "is-kazasi-ramak-kala.csv",
                ["Tür", "Başlık", "Firma", "Şiddet", "Durum", "Tarih"],
                records.map((record) => [
                  typeLabel[record.incident_type],
                  record.title,
                  record.company?.company_name || "",
                  severityLabel[record.severity],
                  statusLabel[record.status],
                  formatDate(record.incident_date),
                ]),
              )
            }
          >
            <Download className="h-4 w-4" />
            Dışa Aktar
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => void loadData()}
          >
            <RefreshCcw className="h-4 w-4" />
            Yenile
          </Button>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Yeni Kayıt
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardDescription>Toplam kayıt</CardDescription>
            <CardTitle className="text-3xl text-white">
              {summary.total}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardDescription>Bu sayfadaki iş kazası</CardDescription>
            <CardTitle className="text-3xl text-white">
              {summary.workAccident}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardDescription>Bu sayfadaki ramak kala</CardDescription>
            <CardTitle className="text-3xl text-white">
              {summary.nearMiss}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardDescription>Bu sayfadaki kritik açık olay</CardDescription>
            <CardTitle className="text-3xl text-white">
              {summary.criticalOpen}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {isViewer && (
        <Alert className="border-slate-700 bg-slate-900/60 text-slate-100">
          <Lock className="h-4 w-4" />
          <AlertTitle>Görüntüleme yetkisi</AlertTitle>
          <AlertDescription>
            Bu rolde kayıtları inceleyebilirsiniz. Yeni kayıt, silme, olay kapatma
            ve DÖF oluşturma işlemleri kapalıdır.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-white">İleri Raporlama Özeti</CardTitle>
            <CardDescription>
              Kapanış kalitesi, DÖF bağlantısı ve açık inceleme yükünü tek blokta görün.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Kapatılan olay</p>
              <p className="mt-2 text-3xl font-semibold text-white">{reporting.closedCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Açık olay</p>
              <p className="mt-2 text-3xl font-semibold text-white">{reporting.openCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Bağlı DÖF</p>
              <p className="mt-2 text-3xl font-semibold text-white">{reporting.linkedCapa}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Üst seviye açık inceleme</p>
              <p className="mt-2 text-3xl font-semibold text-white">{reporting.pendingReview}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-white">Kök Neden Analizi</CardTitle>
            <CardDescription>
              En sık tekrar eden neden kümeleri ve kapanış karar dağılımı.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {reporting.rootCauseBreakdown.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                  Henüz kök neden kategorisi birikmedi.
                </div>
              ) : (
                reporting.rootCauseBreakdown.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                  >
                    <span className="text-sm text-slate-200">{item.label}</span>
                    <Badge variant="outline" className="border-slate-700 text-slate-100">
                      {item.count}
                    </Badge>
                  </div>
                ))
              )}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Kapanış kararı dağılımı</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {reporting.closureDecisionBreakdown.length === 0 ? (
                  <span className="text-sm text-slate-400">Henüz kapatılmış olay yok.</span>
                ) : (
                  reporting.closureDecisionBreakdown.map((item) => (
                    <Badge key={item.key} variant="outline" className="border-slate-700 text-slate-200">
                      {item.label}: {item.count}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-white">Operasyon Odağı</CardTitle>
            <CardDescription>
              Kullanıcının ilk bakışta müdahale etmesi gereken olay kümeleri.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-300/80">
                Resmi bildirim
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {operationalInsights.requiresNotification}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Bildirim veya ilave takip gerektiren kayıt sayısı.
              </p>
            </div>
            <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
              <p className="text-xs uppercase tracking-wide text-orange-300/80">
                Aksiyon bekleyen
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {operationalInsights.actionPending}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Kök neden çalışması veya aksiyon planı bekleyen olaylar.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-500/15 bg-sky-500/5 p-4">
              <p className="text-xs uppercase tracking-wide text-sky-300/80">
                Bu ay açılan
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {operationalInsights.thisMonth}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                İçinde bulunulan ayda sisteme alınan kayıtlar.
              </p>
            </div>
            <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-4">
              <p className="text-xs uppercase tracking-wide text-red-300/80">
                Açık yüksek risk
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {operationalInsights.unresolvedHighRisk}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Yüksek veya kritik seviyede kapanmamış olaylar.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-white">Önerilen Kullanım</CardTitle>
            <CardDescription>
              Bu modülün günlük operasyon akışındaki kısa kullanım sırası.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="font-medium text-white">1. Olayı kayda alın</p>
              <p className="mt-1 text-slate-400">
                Olay tipi, tarih, lokasyon, etkilenen kişi ve ilk müdahaleyi girin.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="font-medium text-white">2. Kök nedeni netleştirin</p>
              <p className="mt-1 text-slate-400">
                Olay açıklaması, kategori ve düzeltici/önleyici aksiyon alanlarını doldurun.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="font-medium text-white">3. Göreve dönüştürün</p>
              <p className="mt-1 text-slate-400">
                Detay ekranından OSGB görevi üretin, aksiyon planı ekleyin ve dosyaları yükleyin.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Veri yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-slate-800 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-white">Kayıtlar</CardTitle>
          <CardDescription>
            İş kazası ve ramak kala olaylarını filtreleyin, detayını açın veya
            düzenleyin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Başlık, açıklama, lokasyon veya kişi ile ara"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as IncidentType | "ALL")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tür" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm türler</SelectItem>
                <SelectItem value="work_accident">İş Kazası</SelectItem>
                <SelectItem value="near_miss">Ramak Kala</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as IncidentStatus | "ALL")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-sm text-slate-400">
              Olay kayıtları yükleniyor...
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tür</TableHead>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Firma ve Kişi</TableHead>
                    <TableHead>Şiddet</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Olay Tarihi</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-12 text-center text-sm text-slate-400"
                      >
                        Kayıt bulunamadı.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{typeLabel[record.incident_type]}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">
                              {record.title}
                            </p>
                            <p className="text-xs text-slate-400">
                              {record.location || "Lokasyon belirtilmedi"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">
                              {record.company?.company_name || "-"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {record.affected_person || "Kişi belirtilmedi"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={severityClass[record.severity]}>
                            {severityLabel[record.severity]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge variant="outline" className="border-slate-700 text-slate-200">
                              {statusLabel[record.status]}
                            </Badge>
                            {record.requires_notification && (
                              <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-200">
                                Bildirim gerekli
                              </Badge>
                            )}
                            {record.capa_record_id && (
                              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
                                DÖF bağlı
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">
                              {formatDate(record.incident_date)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {record.lost_time_days > 0
                                ? `${record.lost_time_days} gün kayıp`
                                : "Kayıp gün yok"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => void openDetail(record)}
                            >
                              <Eye className="h-4 w-4" />
                              Detay
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => openEdit(record)}
                              disabled={!canManage}
                            >
                              <ClipboardPlus className="h-4 w-4" />
                              Düzenle
                            </Button>
                            {canDelete && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-red-300"
                                onClick={() => void handleDelete(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Sil
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {totalCount > INCIDENT_PAGE_SIZE ? (
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Sayfa {page} / {totalPages} • Toplam kayıt {totalCount}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetIncidentForm();
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Olay Kaydını Düzenle"
                : "Yeni İş Kazası / Ramak Kala Kaydı"}
            </DialogTitle>
            <DialogDescription>
              Olayın detayını, kök nedenini ve düzeltici aksiyonlarını kayıt
              altına alın.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
              <Label>Olay türü</Label>
              <Select
                value={form.incidentType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    incidentType: value as IncidentType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work_accident">İş Kazası</SelectItem>
                  <SelectItem value="near_miss">Ramak Kala</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Firma</Label>
              <Select
                value={form.companyId || "NONE"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    companyId: value === "NONE" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Firma seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Firma seçilmedi</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Başlık</Label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Olay açıklaması</Label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                className="min-h-24"
              />
            </div>

            <div className="space-y-2">
              <Label>Olay tarihi</Label>
              <Input
                type="datetime-local"
                value={form.incidentDate}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    incidentDate: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Şiddet</Label>
              <Select
                value={form.severity}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    severity: value as IncidentSeverity,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(severityLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Durum</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    status: value as IncidentStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabel)
                    .filter(([value]) => value !== "closed")
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>İş günü kaybı</Label>
              <Input
                type="number"
                min="0"
                value={form.lostTimeDays}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    lostTimeDays: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Lokasyon</Label>
              <Input
                value={form.location}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Etkilenen kişi</Label>
              <Input
                value={form.affectedPerson}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    affectedPerson: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Bildirimi yapan</Label>
              <Input
                value={form.reportedBy}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    reportedBy: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Tanık / görgü bilgisi</Label>
              <Input
                value={form.witnessInfo}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    witnessInfo: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Kaza kategorisi</Label>
              <Input
                value={form.accidentCategory}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    accidentCategory: event.target.value,
                  }))
                }
                placeholder="Düşme, kesilme, çarpma, malzeme düşmesi vb."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Kök neden kategorisi</Label>
              <Select
                value={form.rootCauseCategory}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    rootCauseCategory: value as IncidentRootCauseCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rootCauseCategoryLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>İlk / acil müdahale</Label>
              <Textarea
                value={form.immediateAction}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    immediateAction: event.target.value,
                  }))
                }
                className="min-h-20"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Kök neden</Label>
              <Textarea
                value={form.rootCause}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    rootCause: event.target.value,
                  }))
                }
                className="min-h-20"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Düzeltici / önleyici aksiyon</Label>
              <Textarea
                value={form.correctiveAction}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    correctiveAction: event.target.value,
                  }))
                }
                className="min-h-20"
              />
            </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.requiresNotification}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      requiresNotification: event.target.checked,
                    }))
                  }
                />
                Resmi bildirim veya ilave takip gerektiriyor
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelected(null);
            setAttachments([]);
            setActions([]);
            resetActionForm();
            resetCloseForm();
          }
        }}
      >
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{selected?.title || "Olay detayı"}</DialogTitle>
            <DialogDescription>
              Dosya, aksiyon ve görev bağlantıları bu ekrandan yönetilir.
            </DialogDescription>
          </DialogHeader>
          {!selected || detailLoading ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-8 text-sm text-slate-400">
              Detaylar yükleniyor...
            </div>
          ) : (
            <Tabs defaultValue="summary" className="space-y-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-slate-700 bg-slate-900 text-slate-100">
                        {typeLabel[selected.incident_type]}
                      </Badge>
                      <Badge className={severityClass[selected.severity]}>
                        {severityLabel[selected.severity]}
                      </Badge>
                      <Badge variant="outline" className="border-slate-700 text-slate-200">
                        {statusLabel[selected.status]}
                      </Badge>
                      {selected.requires_notification && (
                        <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-200">
                          Resmi bildirim gerekli
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-white">
                        {selected.title}
                      </p>
                      <p className="text-sm text-slate-400">
                        {formatDate(selected.incident_date)} • {selected.company?.company_name || "Firma seçilmedi"} • {selected.location || "Lokasyon belirtilmedi"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Etkilenen kişi</p>
                      <p className="mt-2 font-medium text-white">{selected.affected_person || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">İş günü kaybı</p>
                      <p className="mt-2 font-medium text-white">{selected.lost_time_days}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Kategori</p>
                      <p className="mt-2 font-medium text-white">{selected.accident_category || "-"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <TabsList className="h-auto w-full justify-start rounded-xl bg-slate-900/70 p-1 lg:w-auto">
                  <TabsTrigger value="summary" className="rounded-lg px-4 py-2">Özet</TabsTrigger>
                  <TabsTrigger value="actions" className="rounded-lg px-4 py-2">Aksiyonlar</TabsTrigger>
                  <TabsTrigger value="attachments" className="rounded-lg px-4 py-2">Dosyalar</TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap gap-2">
                  {canCreateCapa && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => void handleCreateCapa()}
                      disabled={capaCreating || Boolean(selected.capa_record_id)}
                    >
                      <CheckCheck className="h-4 w-4" />
                      {selected.capa_record_id
                        ? "DÖF bağlı"
                        : capaCreating
                          ? "DÖF açılıyor..."
                          : "Otomatik DÖF aç"}
                    </Button>
                  )}
                  <Button
                    className="gap-2"
                    onClick={() => void handleCreateTask()}
                    disabled={taskCreating}
                  >
                    <ClipboardPlus className="h-4 w-4" />
                    {taskCreating ? "Görev oluşturuluyor..." : "OSGB görevi oluştur"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setDetailOpen(false);
                      openEdit(selected);
                    }}
                    disabled={!canManage}
                  >
                    <Eye className="h-4 w-4" />
                    Kaydı düzenle
                  </Button>
                  {canClose && selected.status !== "closed" && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={openCloseWorkflow}
                    >
                      <Lock className="h-4 w-4" />
                      Olayı kapat
                    </Button>
                  )}
                </div>
              </div>

              <TabsContent value="summary" className="mt-0">
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <Card className="border-slate-800 bg-slate-950/40">
                    <CardHeader>
                      <CardTitle className="text-white">Olay Açıklaması</CardTitle>
                      <CardDescription>Olayın ham anlatımı ve ilk kayıt bilgileri.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 text-sm text-slate-300">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Olay açıklaması</p>
                        <p className="mt-2 whitespace-pre-wrap">{selected.description}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">İlk / acil müdahale</p>
                        <p className="mt-2 whitespace-pre-wrap">{selected.immediate_action || "-"}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-800 bg-slate-950/40">
                    <CardHeader>
                      <CardTitle className="text-white">Operasyon Bilgileri</CardTitle>
                      <CardDescription>Takipte en çok ihtiyaç duyulan temel alanlar.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Bildirimi yapan</p>
                        <p className="mt-2">{selected.reported_by || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Tanık / görgü</p>
                        <p className="mt-2">{selected.witness_info || "-"}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Kök neden kategorisi</p>
                        <p className="mt-2">{rootCauseCategoryLabel[selected.root_cause_category || "other"]}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Kök neden</p>
                        <p className="mt-2 whitespace-pre-wrap">{selected.root_cause || "-"}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Düzeltici / önleyici aksiyon</p>
                        <p className="mt-2 whitespace-pre-wrap">{selected.corrective_action || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Bağlı DÖF</p>
                        <p className="mt-2">{selected.capa_record_id ? "Oluşturuldu" : "Yok"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Kapanış durumu</p>
                        <p className="mt-2">{selected.status === "closed" ? "Kapatıldı" : "Açık"}</p>
                      </div>
                      {selected.status === "closed" && (
                        <>
                          <div className="sm:col-span-2">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Kapatma özeti</p>
                            <p className="mt-2 whitespace-pre-wrap">{selected.closure_summary || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Kapanış kararı</p>
                            <p className="mt-2">
                              {selected.closure_decision
                                ? closureDecisionLabel[selected.closure_decision]
                                : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Kapanış tarihi</p>
                            <p className="mt-2">{formatDate(selected.closed_at)}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Kapanış notları</p>
                            <p className="mt-2 whitespace-pre-wrap">{selected.closure_notes || "-"}</p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="actions" className="mt-0">
                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                  <Card className="border-slate-800 bg-slate-950/40">
                    <CardHeader>
                      <CardTitle className="text-white">Yeni Aksiyon</CardTitle>
                      <CardDescription>Olay bazlı takip adımı ekleyin.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        placeholder="Aksiyon başlığı"
                        value={actionForm.actionTitle}
                        onChange={(event) =>
                          setActionForm((prev) => ({
                            ...prev,
                            actionTitle: event.target.value,
                          }))
                        }
                      />
                      <Input
                        placeholder="Sorumlu kişi"
                        value={actionForm.ownerName}
                        onChange={(event) =>
                          setActionForm((prev) => ({
                            ...prev,
                            ownerName: event.target.value,
                          }))
                        }
                      />
                      <Input
                        type="date"
                        value={actionForm.dueDate}
                        onChange={(event) =>
                          setActionForm((prev) => ({
                            ...prev,
                            dueDate: event.target.value,
                          }))
                        }
                      />
                      <Textarea
                        placeholder="Aksiyon notu"
                        value={actionForm.notes}
                        onChange={(event) =>
                          setActionForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        className="min-h-24"
                      />
                      <Button
                        onClick={() => void handleActionSave()}
                        disabled={actionSaving || !canManage}
                        className="w-full"
                      >
                        {actionSaving ? "Ekleniyor..." : "Aksiyon ekle"}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-800 bg-slate-950/40">
                    <CardHeader>
                      <CardTitle className="text-white">Açık Aksiyonlar</CardTitle>
                      <CardDescription>Bu olay için tanımlanan takip adımları.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {actions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-sm text-slate-400">
                          Henüz aksiyon eklenmedi.
                        </div>
                      ) : (
                        actions.map((action) => (
                          <div
                            key={action.id}
                            className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <p className="font-medium text-white">{action.action_title}</p>
                                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                                  <span>{action.owner_name || "Sorumlu atanmamış"}</span>
                                  <span>
                                    {action.due_date
                                      ? new Date(action.due_date).toLocaleDateString("tr-TR")
                                      : "Termin yok"}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-500">{action.notes || "Açıklama yok"}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{actionStatusLabel[action.status]}</Badge>
                                {canManage && action.status !== "completed" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleActionStatusChange(action.id, "completed")}
                                  >
                                    Tamamla
                                  </Button>
                                )}
                                {canManage && action.status === "open" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleActionStatusChange(action.id, "in_progress")}
                                  >
                                    Başlat
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-300"
                                    onClick={() => void handleActionDelete(action.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-0">
                <Card className="border-slate-800 bg-slate-950/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <FileUp className="h-4 w-4" />
                      Olay Dosyaları
                    </CardTitle>
                    <CardDescription>
                      Fotoğraf, tutanak ve destekleyici evrakları bu alanda yönetin.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {canManage && (
                      <label className="inline-flex">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            void handleAttachmentUpload(file);
                            event.target.value = "";
                          }}
                        />
                        <Button type="button" variant="outline" className="gap-2" asChild>
                          <span>{uploadingFile ? "Yükleniyor..." : "Dosya Ekle"}</span>
                        </Button>
                      </label>
                    )}

                    <div className="space-y-3">
                      {attachments.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-10 text-sm text-slate-400">
                          Bu olaya henüz dosya eklenmedi. Olay fotoğrafı, tutanak veya resmi belge yükleyebilirsiniz.
                        </div>
                      ) : (
                        attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4"
                          >
                            <div>
                              <p className="font-medium text-white">{attachment.file_name}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {formatDate(attachment.created_at)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void handleAttachmentDownload(attachment.file_path)
                                }
                              >
                                İndir
                              </Button>
                              {canManage && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-300"
                                  onClick={() => void handleAttachmentDelete(attachment.id)}
                                >
                                  Sil
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Olay Kapatma Workflow'u</DialogTitle>
            <DialogDescription>
              Olay ancak kapatma özeti tamamlanıp açık aksiyonlar kapatıldıktan sonra kapanır.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-100">
                  {selected ? typeLabel[selected.incident_type] : "Olay"}
                </Badge>
                {selected && <Badge className={severityClass[selected.severity]}>{severityLabel[selected.severity]}</Badge>}
              </div>
              <p className="mt-3 font-medium text-white">{selected?.title || "Olay seçilmedi"}</p>
              <p className="mt-1 text-slate-400">
                Açık aksiyon sayısı:{" "}
                {actions.filter((item) => item.status !== "completed" && item.status !== "cancelled").length}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Kapatma özeti</Label>
              <Textarea
                value={closeForm.closureSummary}
                onChange={(event) =>
                  setCloseForm((prev) => ({ ...prev, closureSummary: event.target.value }))
                }
                className="min-h-24"
                placeholder="Olayın nasıl sonuçlandığını, hangi adımların tamamlandığını yazın."
              />
            </div>

            <div className="space-y-2">
              <Label>Kapanış kararı</Label>
              <Select
                value={closeForm.closureDecision}
                onValueChange={(value) =>
                  setCloseForm((prev) => ({
                    ...prev,
                    closureDecision: value as IncidentClosureDecision,
                    createCapa:
                      value === "capa_required" ? true : prev.createCapa,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(closureDecisionLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kapanış notları</Label>
              <Textarea
                value={closeForm.closureNotes}
                onChange={(event) =>
                  setCloseForm((prev) => ({ ...prev, closureNotes: event.target.value }))
                }
                className="min-h-20"
                placeholder="Denetim, eğitim, proses değişikliği veya izleme notlarını girin."
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={closeForm.createCapa || closeForm.closureDecision === "capa_required"}
                disabled={closeForm.closureDecision === "capa_required"}
                onChange={(event) =>
                  setCloseForm((prev) => ({ ...prev, createCapa: event.target.checked }))
                }
              />
              Kapatırken incident kaydından otomatik DÖF aç
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => void handleCloseIncident()} disabled={closeSaving}>
              {closeSaving ? "Kapatılıyor..." : "Olayı kapat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

