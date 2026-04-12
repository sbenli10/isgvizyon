import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Eye,
  Search,
  Loader2,
  TrendingUp,
  FileText,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Briefcase,
  TimerReset,
  Edit3,
  BellRing,
  CheckCheck,
  Camera,
  Upload,
  Paperclip,
  FileBadge2,
  Download,
  ExternalLink,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { differenceInCalendarDays, format, isPast, parseISO } from "date-fns";

type CAPAStatus = "Açık" | "Devam Ediyor" | "Tamamlandı";
type CAPAPriority = "Düşük" | "Orta" | "Yüksek" | "Kritik";

interface CAPARecord {
  id: string;
  org_id: string;
  user_id: string;
  non_conformity: string;
  root_cause: string;
  corrective_action: string;
  assigned_person: string;
  deadline: string;
  status: CAPAStatus;
  priority: CAPAPriority;
  notes?: string;
  document_urls?: string[];
  file_urls?: string[];
  media_urls?: string[];
  source?: "capa" | "findings";
  created_at: string;
  updated_at: string;
}

interface CAPAActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  tone: string;
  actorName?: string;
}

interface CAPAActivityLogRow {
  id: string;
  action_type: string;
  title: string;
  description: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
  capa_record_id?: string | null;
  finding_id?: string | null;
}

interface UploadedEvidenceItem {
  url: string;
  name: string;
  size: number;
  mime: string;
}

interface UploadProgressState {
  media: number;
  document: number;
  attachment: number;
}

const statusConfig: Record<CAPAStatus, { label: string; color: string; icon: string }> = {
  Açık: { label: "Açık", color: "bg-destructive/10 text-destructive border-destructive/30", icon: "🔴" },
  "Devam Ediyor": { label: "Devam Ediyor", color: "bg-warning/10 text-warning border-warning/30", icon: "🟡" },
  Tamamlandı: { label: "Tamamlandı", color: "bg-success/10 text-success border-success/30", icon: "✅" },
};

const priorityConfig: Record<CAPAPriority, { label: string; color: string; icon: string }> = {
  Kritik: { label: "Kritik", color: "bg-destructive/10 text-destructive border-destructive/30", icon: "🔴" },
  Yüksek: { label: "Yüksek", color: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: "🟠" },
  Orta: { label: "Orta", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30", icon: "🟡" },
  Düşük: { label: "Düşük", color: "bg-success/10 text-success border-success/30", icon: "🟢" },
};

const statusAccent: Record<CAPAStatus, string> = {
  Açık: "from-rose-500/15 via-rose-500/5 to-transparent",
  "Devam Ediyor": "from-amber-500/15 via-amber-500/5 to-transparent",
  Tamamlandı: "from-emerald-500/15 via-emerald-500/5 to-transparent",
};

const priorityWeight: Record<CAPAPriority, number> = {
  Kritik: 4,
  Yüksek: 3,
  Orta: 2,
  Düşük: 1,
};

const getCapaCacheKey = (userId: string) => `denetron:capa:${userId}`;
const CAPA_CACHE_LIMIT = 24;
const CAPA_CACHE_FALLBACK_LIMIT = 8;
const CAPA_NOTES_PREVIEW_LIMIT = 180;
let capaActivityLogsFeatureAvailable: boolean | null = null;

const compactCapaRecord = (record: CAPARecord): CAPARecord => ({
  id: record.id,
  org_id: record.org_id,
  user_id: record.user_id,
  non_conformity: (record.non_conformity || "").slice(0, 280),
  root_cause: (record.root_cause || "").slice(0, 180),
  corrective_action: (record.corrective_action || "").slice(0, 180),
  assigned_person: (record.assigned_person || "").slice(0, 80),
  deadline: record.deadline,
  status: record.status,
  priority: record.priority,
  notes: (record.notes || "").slice(0, CAPA_NOTES_PREVIEW_LIMIT),
  document_urls: [],
  file_urls: [],
  media_urls: [],
  source: record.source,
  created_at: record.created_at,
  updated_at: record.updated_at,
});

const isCapaActivityLogsMissingError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.status === 404 || message.includes("capa_activity_logs") || message.includes("relation") || message.includes("schema cache");
};

const handleCapaActivityLogsError = (error: any, context: string) => {
  if (isCapaActivityLogsMissingError(error)) {
    if (capaActivityLogsFeatureAvailable !== false) {
      console.warn(`CAPA activity logs unavailable during ${context}; continuing without activity history.`, error);
    }
    capaActivityLogsFeatureAvailable = false;
    return true;
  }

  console.error(`CAPA activity logs error during ${context}:`, error);
  return false;
};

const buildCapaCachePayload = (records: CAPARecord[], limit: number) =>
  JSON.stringify(records.slice(0, limit).map(compactCapaRecord));

const clearCapaCacheStorage = (cacheKey: string) => {
  try {
    sessionStorage.removeItem(cacheKey);
  } catch {
    // Ignore storage cleanup failures.
  }

  try {
    localStorage.removeItem(cacheKey);
  } catch {
    // Ignore storage cleanup failures.
  }
};

const loadCapaCache = (userId: string): CAPARecord[] | null => {
  const cacheKey = getCapaCacheKey(userId);
  const candidates = [() => sessionStorage.getItem(cacheKey), () => localStorage.getItem(cacheKey)];

  for (const read of candidates) {
    try {
      const raw = read();
      if (!raw) continue;
      return JSON.parse(raw) as CAPARecord[];
    } catch {
      continue;
    }
  }

  return null;
};

const saveCapaCache = (userId: string, records: CAPARecord[]) => {
  const cacheKey = getCapaCacheKey(userId);
  const payload = buildCapaCachePayload(records, CAPA_CACHE_LIMIT);

  try {
    sessionStorage.setItem(cacheKey, payload);
    return;
  } catch (error) {
    console.warn("CAPA session cache write failed:", error);
  }

  try {
    localStorage.setItem(cacheKey, payload);
    return;
  } catch (error) {
    console.warn("CAPA local cache write failed:", error);
  }

  clearCapaCacheStorage(cacheKey);

  try {
    sessionStorage.setItem(cacheKey, buildCapaCachePayload(records, CAPA_CACHE_FALLBACK_LIMIT));
  } catch (error) {
    console.warn("CAPA fallback cache write failed:", error);
  }
};

const emptyForm = {
  nonConformity: "",
  rootCause: "",
  correctiveAction: "",
  assignedPerson: "",
  deadline: "",
  priority: "Orta" as CAPAPriority,
  notes: "",
};

const MAX_MEDIA_FILES = 4;
const MAX_DOCUMENT_FILES = 4;
const MAX_ATTACHMENT_FILES = 4;
const CAPA_EVIDENCE_BUCKET = "capa-evidence";

const formatTimeLabel = (date: string) => {
  if (!date) return "--:--";
  try {
    return format(parseISO(date), "HH:mm");
  } catch {
    return "--:--";
  }
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "Boyut yok";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileKind = (name: string, mime?: string) => {
  const lower = `${mime || ""} ${name}`.toLowerCase();
  if (lower.includes("pdf")) return "Belge";
  if (lower.includes("doc")) return "Word";
  if (lower.includes("xls")) return "Excel";
  if (lower.includes("png") || lower.includes("jpg") || lower.includes("jpeg") || lower.includes("gif") || lower.includes("image/")) {
    return "Görsel";
  }
  return "Dosya";
};

const formatDateLabel = (date: string) => {
  if (!date) return "Belirtilmedi";
  try {
    return format(parseISO(date), "dd.MM.yyyy");
  } catch {
    return date;
  }
};

const getDeadlineLabel = (record: CAPARecord) => {
  if (!record.deadline) return "Termin tanımlanmadı";
  const dueDays = differenceInCalendarDays(parseISO(record.deadline), new Date());
  if (record.status === "Tamamlandı") return "Kapanış tamamlandı";
  if (dueDays < 0) return `${Math.abs(dueDays)} gündür gecikmiş`;
  if (dueDays === 0) return "Bugün kapanmalı";
  if (dueDays <= 3) return `${dueDays} gün içinde kontrol et`;
  return `${dueDays} gün takip süresi var`;
};

const getNextActionLabel = (record: CAPARecord) => {
  if (record.status === "Tamamlandı") return "Kapanış notlarını ve kanıtları doğrula, sonra arşiv akışına al.";
  if (record.status === "Devam Ediyor") return "İlerleme durumunu güncelle ve gerekiyorsa termin revizyonu yap.";
  if (record.priority === "Kritik") return "Bugün sorumlu kişiyle aksiyon planını netleştir ve ilk doğrulamayı planla.";
  return "Görevlendirmeyi kesinleştir ve ilk takip noktasını başlat.";
};

const getActionButtonLabel = (record: CAPARecord) => {
  if (record.status === "Tamamlandı") return "Kapanışı İncele";
  if (record.status === "Devam Ediyor") return "Takibi Aç";
  return "Aksiyonu Başlat";
};

const getFocusLabel = (record: CAPARecord) => {
  if (record.status === "Tamamlandı") return "Arşiv ve doğrulama";
  if (record.priority === "Kritik") return "Acil müdahale";
  if (record.status === "Devam Ediyor") return "Güncel takip";
  return "Atama ve başlangıç";
};

const getClosureEvidence = (record: CAPARecord) => {
  const noteLength = (record.notes || "").trim().length;
  const mediaCount = record.media_urls?.length || 0;
  const documentCount = record.document_urls?.length || 0;
  const fileCount = record.file_urls?.length || 0;
  const hasNotes = noteLength > 20;
  const hasMedia = mediaCount > 0;
  const hasDocument = documentCount > 0;
  const hasFile = fileCount > 0;
  const evidenceCount = [hasNotes, hasMedia, hasDocument, hasFile].filter(Boolean).length;
  const quality =
    evidenceCount >= 3 ? "Güçlü kapanış kanıtı" : evidenceCount >= 1 ? "Kısmi kapanış kanıtı" : "Kanıt bekleniyor";

  return {
    hasNotes,
    hasMedia,
    hasDocument,
    hasFile,
    mediaCount,
    documentCount,
    fileCount,
    quality,
  };
};

const getReminderPanel = (record: CAPARecord) => {
  const dueDays = record.deadline ? differenceInCalendarDays(parseISO(record.deadline), new Date()) : null;

  if (record.status === "Tamamlandı") {
    return {
      title: "Kapanış kontrolü",
      body: "Kapanış kanıtını ve doğrulama notunu kontrol edip arşivleme akışını tamamla.",
      badge: "Arşiv",
      tone: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    };
  }

  if (record.priority === "Kritik") {
    if (dueDays !== null && dueDays <= 0) {
      return {
        title: "Acil hatırlatma",
        body: "Kritik kayıt terminine ulaştı. Sorumlu kişiyle bugün durum güncellemesi al ve yöneticiye eskalasyon yap.",
        badge: "Bugün",
        tone: "border-rose-400/20 bg-rose-500/10 text-rose-100",
      };
    }

    return {
      title: "Kritik takip süresi",
      body: `Bu kayıt kritik seviyede. ${dueDays ?? "Belirsiz"} gün içinde en az bir ara kontrol ve sorumlu kişiye otomatik hatırlatma planla.`,
      badge: "Kritik",
      tone: "border-rose-400/20 bg-rose-500/10 text-rose-100",
    };
  }

  if (record.status === "Devam Ediyor") {
    return {
      title: "Takip hatırlatması",
      body: "İlerleyen aksiyon için ara durum güncellemesi al ve gerekiyorsa termin revizyonunu kayda geçir.",
      badge: "Takip",
      tone: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    };
  }

  return {
    title: "İlk takip planı",
    body: "Sorumlu kişiye açılış bilgisini ilet, ilk kontrol tarihini belirle ve kanıt beklentisini netleştir.",
    badge: "Başlangıç",
    tone: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
  };
};

const buildActivityFeed = (record: CAPARecord): CAPAActivityItem[] => {
  const items: CAPAActivityItem[] = [
    {
      id: `${record.id}-created`,
      title: "Kayıt oluşturuldu",
      description: `${formatDateLabel(record.created_at)} tarihinde aksiyon kaydı açıldı.`,
      timestamp: record.created_at,
      tone: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
      actorName: "İSGVİZYON",
    },
  ];

  if (record.assigned_person) {
    items.push({
      id: `${record.id}-assigned`,
      title: "Sorumlu atandı",
      description: `${record.assigned_person} için takip ve uygulama sorumluluğu tanımlandı.`,
      timestamp: record.updated_at || record.created_at,
      tone: "border-violet-400/20 bg-violet-400/10 text-violet-100",
      actorName: "İSGVİZYON",
    });
  }

  if (record.media_urls?.length) {
    items.push({
      id: `${record.id}-media`,
      title: "Kanıt görselleri eklendi",
      description: `${record.media_urls.length} adet görsel kanıt kayda bağlı.`,
      timestamp: record.updated_at || record.created_at,
      tone: "border-sky-400/20 bg-sky-400/10 text-sky-100",
      actorName: "İSGVİZYON",
    });
  }

  if ((record.notes || "").trim().length > 20) {
    items.push({
      id: `${record.id}-note`,
      title: "Operasyon notu güncellendi",
      description: "Kapanış veya takip notları kayıt içine işlendi.",
      timestamp: record.updated_at || record.created_at,
      tone: "border-white/10 bg-white/5 text-slate-200",
      actorName: "İSGVİZYON",
    });
  }

  if (record.status === "Devam Ediyor") {
    items.push({
      id: `${record.id}-progress`,
      title: "Uygulama süreci devam ediyor",
      description: "Aksiyon açıldı ve takip aşamasına taşındı.",
      timestamp: record.updated_at || record.created_at,
      tone: "border-amber-400/20 bg-amber-400/10 text-amber-100",
      actorName: "İSGVİZYON",
    });
  }

  if (record.status === "Tamamlandı") {
    items.push({
      id: `${record.id}-closed`,
      title: "Kapanış tamamlandı",
      description: "Kayıt tamamlandı durumuna alındı. Kanıt ve doğrulama notlarını kontrol et.",
      timestamp: record.updated_at || record.created_at,
      tone: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      actorName: "İSGVİZYON",
    });
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const mapLogsToFeed = (logs: CAPAActivityLogRow[]): CAPAActivityItem[] =>
  logs.map((log) => ({
    id: log.id,
    title: log.title,
    description: log.description || "Sistem kaydı işlendi.",
    timestamp: log.created_at,
    tone:
      log.action_type === "status_changed"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
        : log.action_type === "escalated"
          ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
        : log.action_type === "closed"
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
          : log.action_type === "created"
            ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
            : "border-white/10 bg-white/5 text-slate-200",
    actorName:
      typeof log.metadata?.actor_name === "string" && log.metadata.actor_name.trim().length > 0
        ? log.metadata.actor_name
        : "İSGVİZYON kullanıcısı",
  }));

const getEscalationLine = (record: CAPARecord, escalationLog?: CAPAActivityLogRow) => {
  if (escalationLog) {
    const actor =
      typeof escalationLog.metadata?.actor_name === "string" && escalationLog.metadata.actor_name.trim().length > 0
        ? escalationLog.metadata.actor_name
        : "İSGVİZYON kullanıcısı";
    return `${formatDateLabel(escalationLog.created_at)} ${formatTimeLabel(escalationLog.created_at)} · ${actor}`;
  }

  if (record.priority === "Kritik" && record.status !== "Tamamlandı") {
    return "Henüz eskalasyon kaydı oluşmadı. İlk kritik takip kaydı bir sonraki güncellemede işlenecek.";
  }

  return null;
};

const getEscalationSeverity = (
  record: CAPARecord,
  log?: CAPAActivityLogRow | null,
): { label: string; className: string } => {
  const dueDays =
    typeof log?.metadata?.dueDays === "number"
      ? log.metadata.dueDays
      : record.deadline
        ? differenceInCalendarDays(parseISO(record.deadline), new Date())
        : null;

  if (dueDays !== null && dueDays <= 0) {
    return {
      label: "Acil",
      className: "border-rose-400/30 bg-rose-400/15 text-rose-100",
    };
  }

  if (record.priority === "Kritik") {
    return {
      label: "Kritik",
      className: "border-amber-400/30 bg-amber-400/15 text-amber-100",
    };
  }

  return {
    label: "İzleme",
    className: "border-cyan-400/30 bg-cyan-400/15 text-cyan-100",
  };
};

const getUploadStatusLabel = (progress: number) => {
  if (progress >= 100) return "Tamamlandı";
  if (progress > 0) return "Yükleniyor";
  return "Bekliyor";
};


export default function CAPA() {
  const { user } = useAuth();
  const location = useLocation();

  const [records, setRecords] = useState<CAPARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | CAPAStatus>("all");
  const [searchText, setSearchText] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<CAPARecord | null>(null);
  const [detailActivityLogs, setDetailActivityLogs] = useState<CAPAActivityLogRow[]>([]);
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState("");
  const [escalationMap, setEscalationMap] = useState<Record<string, CAPAActivityLogRow>>({});
  const [escalationCountMap, setEscalationCountMap] = useState<Record<string, number>>({});
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    media: 0,
    document: 0,
    attachment: 0,
  });

  const [nonConformity, setNonConformity] = useState(emptyForm.nonConformity);
  const [rootCause, setRootCause] = useState(emptyForm.rootCause);
  const [correctiveAction, setCorrectiveAction] = useState(emptyForm.correctiveAction);
  const [assignedPerson, setAssignedPerson] = useState(emptyForm.assignedPerson);
  const [deadline, setDeadline] = useState(emptyForm.deadline);
  const [priority, setPriority] = useState<CAPAPriority>(emptyForm.priority);
  const [notes, setNotes] = useState(emptyForm.notes);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const resetForm = () => {
    setNonConformity(emptyForm.nonConformity);
    setRootCause(emptyForm.rootCause);
    setCorrectiveAction(emptyForm.correctiveAction);
    setAssignedPerson(emptyForm.assignedPerson);
    setDeadline(emptyForm.deadline);
    setPriority(emptyForm.priority);
    setNotes(emptyForm.notes);
    setMediaFiles([]);
    setDocumentFiles([]);
    setAttachmentFiles([]);
    setUploadProgress({ media: 0, document: 0, attachment: 0 });
    setEditingId(null);
  };

  useEffect(() => {
    if (!user) return;
    const cached = loadCapaCache(user.id);
    if (cached) {
      setRecords(cached);
      setLoading(false);
    }
    void fetchRecords(Boolean(cached));
  }, [user]);

  useEffect(() => {
    if (!location.state?.aiData) return;
    const { description, plan, justification, risk } = location.state.aiData;
    setNonConformity(description || "");
    setCorrectiveAction(plan || "");
    setRootCause(justification || "");
    if (risk === "High") setPriority("Kritik");
    else if (risk === "Medium") setPriority("Yüksek");
    else setPriority("Orta");
    setDialogOpen(true);
    toast.success("AI verisi DÖF formuna dolduruldu.");
  }, [location.state]);

  useEffect(() => {
    const loadDetailActivity = async () => {
      if (!detailsOpen || !detailRecord || !user?.id) {
        setDetailActivityLogs([]);
        return;
      }

      if (capaActivityLogsFeatureAvailable === false) {
        setDetailActivityLogs([]);
        return;
      }

      const targetColumn = detailRecord.source === "findings" ? "finding_id" : "capa_record_id";
      const { data, error } = await supabase
        .from("capa_activity_logs")
        .select("id, action_type, title, description, created_at, metadata")
        .eq("user_id", user.id)
        .eq(targetColumn, detailRecord.id)
        .order("created_at", { ascending: false });

      if (error) {
        handleCapaActivityLogsError(error, "detail activity load");
        setDetailActivityLogs([]);
        return;
      }

      capaActivityLogsFeatureAvailable = true;
      setDetailActivityLogs((data || []) as CAPAActivityLogRow[]);
    };

    void loadDetailActivity();
  }, [detailRecord, detailsOpen, user?.id]);

  const fetchRecords = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, full_name")
        .eq("id", user.id)
        .maybeSingle();

      setCurrentProfileName(profile?.full_name || user.email || "");

      const { data: capaData, error: capaError } = await supabase
        .from("capa_records")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (capaError && capaError.code !== "PGRST116") throw capaError;

      const capaRecords: CAPARecord[] = (capaData || []).map((record: any) => ({
        ...record,
        status: record.status as CAPAStatus,
        priority: record.priority as CAPAPriority,
        source: "capa",
        document_urls: Array.isArray(record.document_urls) ? record.document_urls : [],
        file_urls: Array.isArray(record.file_urls) ? record.file_urls : [],
        media_urls: record.media_urls || [],
        notes: record.notes || "",
      }));

      const { data: findingsData, error: findingsError } = await supabase
        .from("findings")
        .select(`
          *,
          inspection:inspections!inner(
            id,
            location_name,
            user_id,
            media_urls,
            notes,
            risk_definition,
            corrective_action,
            preventive_action
          )
        `)
        .eq("inspection.user_id", user.id)
        .order("created_at", { ascending: false });

      if (findingsError && findingsError.code !== "PGRST116") throw findingsError;

      const findingsAsCapa: CAPARecord[] = (findingsData || []).map((finding: any) => {
        const inspection = finding.inspection;
        return {
          id: finding.id,
          org_id: profile?.organization_id || user.id,
          user_id: finding.user_id || user.id,
          non_conformity: finding.description,
          root_cause: inspection?.risk_definition || "Toplu DÖF kaydından dönüştürülen bulgu.",
          corrective_action: inspection?.corrective_action || finding.action_required || "Belirtilmemiş",
          assigned_person: finding.assigned_to || "Atanmamış",
          deadline: finding.due_date || new Date().toISOString().split("T")[0],
          status: (finding.is_resolved ? "Tamamlandı" : "Açık") as CAPAStatus,
          priority: (
            finding.priority === "critical"
              ? "Kritik"
              : finding.priority === "high"
                ? "Yüksek"
                : finding.priority === "medium"
                  ? "Orta"
                  : "Düşük"
          ) as CAPAPriority,
          notes: [
            `Konum: ${inspection?.location_name || "Bilinmiyor"}`,
            "Kaynak: Toplu DÖF",
            `Fotoğraf: ${inspection?.media_urls?.length || 0} adet`,
            inspection?.preventive_action ? `Önleyici yaklaşım: ${inspection.preventive_action.slice(0, 120)}` : "",
            inspection?.notes || "",
            finding.resolution_notes || "",
          ]
            .filter(Boolean)
            .join("\n"),
          document_urls: [],
          file_urls: [],
          media_urls: inspection?.media_urls || [],
          source: "findings",
          created_at: finding.created_at,
          updated_at: finding.created_at,
        };
      });

      const allRecords = [...capaRecords, ...findingsAsCapa].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      let escalationLogs: CAPAActivityLogRow[] = [];

      if (capaActivityLogsFeatureAvailable !== false) {
        const { data, error } = await supabase
          .from("capa_activity_logs")
          .select("id, action_type, title, description, created_at, metadata, capa_record_id, finding_id")
          .eq("user_id", user.id)
          .eq("action_type", "escalated")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          handleCapaActivityLogsError(error, "escalation fetch");
        } else {
          capaActivityLogsFeatureAvailable = true;
          escalationLogs = (data || []) as CAPAActivityLogRow[];
        }
      }

      setRecords(allRecords);
      const nextEscalationMap = escalationLogs.reduce<Record<string, CAPAActivityLogRow>>((acc, log: any) => {
        const key = log.capa_record_id || log.finding_id;
        if (key && !acc[key]) {
          acc[key] = log as CAPAActivityLogRow;
        }
        return acc;
      }, {});
      const nextEscalationCountMap = escalationLogs.reduce<Record<string, number>>((acc, log: any) => {
        const key = log.capa_record_id || log.finding_id;
        if (key) acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      setEscalationMap(nextEscalationMap);
      setEscalationCountMap(nextEscalationCountMap);
      saveCapaCache(user.id, allRecords);
    } catch (error: any) {
      console.error("CAPA yükleme hatası:", error);
      toast.error(`Veriler çekilirken sorun oluştu: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const writeActivityLog = async ({
    capaRecordId,
    findingId,
    actionType,
    title,
    description,
    metadata,
  }: {
    capaRecordId?: string | null;
    findingId?: string | null;
    actionType: string;
    title: string;
    description: string;
    metadata?: Record<string, any>;
  }) => {
    if (!user?.id) return;
    if (capaActivityLogsFeatureAvailable === false) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("capa_activity_logs")
      .insert({
      user_id: user.id,
      org_id: profile?.organization_id || null,
      capa_record_id: capaRecordId ?? null,
      finding_id: findingId ?? null,
      action_type: actionType,
      title,
      description,
      metadata: {
        actor_name: currentProfileName || user.email || "İSGVİZYON kullanıcısı",
        ...(metadata ?? {}),
      },
      })
      .select("id, action_type, title, description, created_at, metadata, capa_record_id, finding_id")
      .maybeSingle();

    if (error) {
      handleCapaActivityLogsError(error, "activity log write");
      return null;
    }

    capaActivityLogsFeatureAvailable = true;
    return data as CAPAActivityLogRow | null;
  };

  const maybeWriteEscalationLog = async ({
    capaRecordId,
    findingId,
    nextPriority,
    nextStatus,
    nextDeadline,
  }: {
    capaRecordId?: string | null;
    findingId?: string | null;
    nextPriority: CAPAPriority;
    nextStatus: CAPAStatus;
    nextDeadline: string;
  }) => {
    if (nextPriority !== "Kritik" || nextStatus === "Tamamlandı") return;

    const dueDays = nextDeadline ? differenceInCalendarDays(parseISO(nextDeadline), new Date()) : null;
    const title = dueDays !== null && dueDays <= 0 ? "Otomatik eskalasyon işlendi" : "Kritik kayıt izlemeye alındı";
    const description =
      dueDays !== null && dueDays <= 0
        ? "Termin baskısı nedeniyle kayıt otomatik eskalasyon geçmişine işlendi."
        : "Kritik kayıt için erken takip ve yönetici bilgilendirme geçmişi oluşturuldu.";

    const insertedLog = await writeActivityLog({
      capaRecordId,
      findingId,
      actionType: "escalated",
      title,
      description,
      metadata: { dueDays },
    });

    const mapKey = capaRecordId || findingId;
    if (mapKey && insertedLog) {
      setEscalationMap((prev) => ({ ...prev, [mapKey]: insertedLog }));
      setEscalationCountMap((prev) => ({ ...prev, [mapKey]: (prev[mapKey] || 0) + 1 }));
    }
  };

  const handleFileSelection = (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: "media" | "document" | "attachment",
  ) => {
    const incoming = Array.from(event.target.files || []);
    const config =
      kind === "media"
        ? { limit: MAX_MEDIA_FILES, setter: setMediaFiles, label: "Fotoğraf" }
        : kind === "document"
          ? { limit: MAX_DOCUMENT_FILES, setter: setDocumentFiles, label: "Belge" }
          : { limit: MAX_ATTACHMENT_FILES, setter: setAttachmentFiles, label: "Dosya" };

    config.setter((prev) => {
      const merged = [...prev, ...incoming].slice(0, config.limit);
      if (incoming.length + prev.length > config.limit) {
        toast.info(`${config.label} alanında en fazla ${config.limit} dosya tutulabilir.`);
      }
      return merged;
    });

    event.target.value = "";
  };

  const removeSelectedFile = (kind: "media" | "document" | "attachment", index: number) => {
    const setter = kind === "media" ? setMediaFiles : kind === "document" ? setDocumentFiles : setAttachmentFiles;
    setter((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDropSelection = (
    event: React.DragEvent<HTMLLabelElement>,
    kind: "media" | "document" | "attachment",
  ) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    const syntheticEvent = {
      target: { files, value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFileSelection(syntheticEvent, kind);
  };

  const openEvidenceUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const isPreviewableEvidence = (url: string) => {
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".pdf") ||
      lower.includes("application/pdf") ||
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".gif") ||
      lower.startsWith("data:image")
    );
  };

  const isImageEvidence = (url: string) => {
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".gif") ||
      lower.startsWith("data:image")
    );
  };

  const downloadEvidenceUrl = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = url.split("/").pop() || "kanit-dosyasi";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Evidence download error:", error);
      toast.error("Dosya indirilemedi.");
    }
  };

  const getEvidenceMetaByUrl = (url: string) => {
    for (const log of detailActivityLogs) {
      const groups = [
        ...(Array.isArray(log.metadata?.mediaFiles) ? log.metadata.mediaFiles : []),
        ...(Array.isArray(log.metadata?.documentFiles) ? log.metadata.documentFiles : []),
        ...(Array.isArray(log.metadata?.fileFiles) ? log.metadata.fileFiles : []),
      ] as UploadedEvidenceItem[];

      const found = groups.find((item) => item.url === url);
      if (found) return found;
    }

    return null;
  };

  const uploadEvidenceFiles = async ({
    recordId,
    orgId,
  }: {
    recordId: string;
    orgId: string;
  }) => {
    if (!user?.id) {
      return {
        mediaUrls: [] as string[],
        documentUrls: [] as string[],
        fileUrls: [] as string[],
        mediaItems: [] as UploadedEvidenceItem[],
        documentItems: [] as UploadedEvidenceItem[],
        fileItems: [] as UploadedEvidenceItem[],
      };
    }

    const uploadGroup = async (
      files: File[],
      folder: string,
      progressKey: keyof UploadProgressState,
    ) => {
      const uploaded: UploadedEvidenceItem[] = [];
      if (files.length === 0) {
        setUploadProgress((prev) => ({ ...prev, [progressKey]: 0 }));
        return uploaded;
      }

      setUploadProgress((prev) => ({ ...prev, [progressKey]: 5 }));
      for (const file of files) {
        const safeName = `${folder}/${orgId}/${recordId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
        const { error } = await supabase.storage.from(CAPA_EVIDENCE_BUCKET).upload(safeName, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from(CAPA_EVIDENCE_BUCKET).getPublicUrl(safeName);
        uploaded.push({
          url: data.publicUrl,
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
        });
        setUploadProgress((prev) => ({
          ...prev,
          [progressKey]: Math.round((uploaded.length / files.length) * 100),
        }));
      }
      return uploaded;
    };

    const [mediaItems, documentItems, fileItems] = await Promise.all([
      uploadGroup(mediaFiles, "photos", "media"),
      uploadGroup(documentFiles, "documents", "document"),
      uploadGroup(attachmentFiles, "files", "attachment"),
    ]);

    return {
      mediaUrls: mediaItems.map((item) => item.url),
      documentUrls: documentItems.map((item) => item.url),
      fileUrls: fileItems.map((item) => item.url),
      mediaItems,
      documentItems,
      fileItems,
    };
  };

  const handleSubmit = async () => {
    if (!nonConformity || !rootCause || !correctiveAction || !assignedPerson || !deadline) {
      toast.error("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    try {
      setUploadProgress({ media: 0, document: 0, attachment: 0 });
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user?.id)
        .maybeSingle();

      const orgId = profile?.organization_id || user?.id;

      if (editingId) {
        const record = records.find((r) => r.id === editingId);

        if (record?.source === "findings") {
          if (mediaFiles.length || documentFiles.length || attachmentFiles.length) {
            toast.info("Toplu DÖF kaynaklı kayıtlarda yeni kanıt yüklemeleri Denetimler akışından yönetilir.");
          }
          const { error } = await supabase
            .from("findings")
            .update({
              description: nonConformity,
              action_required: correctiveAction,
              due_date: deadline,
              priority:
                priority === "Kritik"
                  ? "critical"
                  : priority === "Yüksek"
                    ? "high"
                    : priority === "Orta"
                      ? "medium"
                      : "low",
              resolution_notes: notes,
            })
            .eq("id", editingId);

          if (error) throw error;
          await writeActivityLog({
            findingId: editingId,
            actionType: "updated",
            title: "Bulgu aksiyonu güncellendi",
            description: "Toplu DÖF kaynağından gelen kayıt için aksiyon alanları güncellendi.",
            metadata: { priority, deadline, assignedPerson },
          });
          await maybeWriteEscalationLog({
            findingId: editingId,
            nextPriority: priority,
            nextStatus: (record.status || "Açık") as CAPAStatus,
            nextDeadline: deadline,
          });
        } else {
          const uploadedEvidence = await uploadEvidenceFiles({ recordId: editingId, orgId });
          const { error } = await supabase
            .from("capa_records")
            .update({
              non_conformity: nonConformity,
              root_cause: rootCause,
              corrective_action: correctiveAction,
              assigned_person: assignedPerson,
              deadline,
              priority,
              notes,
              media_urls: [...(record?.media_urls || []), ...uploadedEvidence.mediaUrls],
              document_urls: [...(record?.document_urls || []), ...uploadedEvidence.documentUrls],
              file_urls: [...(record?.file_urls || []), ...uploadedEvidence.fileUrls],
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingId);

          if (error) throw error;
          await writeActivityLog({
            capaRecordId: editingId,
            actionType: "updated",
            title: "CAPA kaydı güncellendi",
            description: "Aksiyon planı, sorumlu veya termin alanlarında güncelleme yapıldı.",
            metadata: {
              priority,
              deadline,
              assignedPerson,
              mediaCount: uploadedEvidence.mediaUrls.length,
              documentCount: uploadedEvidence.documentUrls.length,
              fileCount: uploadedEvidence.fileUrls.length,
            },
          });
          if (uploadedEvidence.mediaUrls.length) {
            await writeActivityLog({
              capaRecordId: editingId,
              actionType: "updated",
              title: "Fotoğraf kanıtı yüklendi",
              description: `${uploadedEvidence.mediaUrls.length} adet fotoğraf kanıtı kayda eklendi.`,
              metadata: { mediaCount: uploadedEvidence.mediaUrls.length, mediaFiles: uploadedEvidence.mediaItems },
            });
          }
          if (uploadedEvidence.documentUrls.length) {
            await writeActivityLog({
              capaRecordId: editingId,
              actionType: "updated",
              title: "Belge kanıtı yüklendi",
              description: `${uploadedEvidence.documentUrls.length} adet belge kayda eklendi.`,
              metadata: { documentCount: uploadedEvidence.documentUrls.length, documentFiles: uploadedEvidence.documentItems },
            });
          }
          if (uploadedEvidence.fileUrls.length) {
            await writeActivityLog({
              capaRecordId: editingId,
              actionType: "updated",
              title: "Ek dosya yüklendi",
              description: `${uploadedEvidence.fileUrls.length} adet ek dosya kayda eklendi.`,
              metadata: { fileCount: uploadedEvidence.fileUrls.length, fileFiles: uploadedEvidence.fileItems },
            });
          }
          await maybeWriteEscalationLog({
            capaRecordId: editingId,
            nextPriority: priority,
            nextStatus: (record?.status || "Açık") as CAPAStatus,
            nextDeadline: deadline,
          });
        }

        toast.success("DÖF kaydı güncellendi.");
      } else {
        const { data: createdRecord, error } = await supabase
          .from("capa_records")
          .insert({
            org_id: orgId,
            user_id: user?.id,
            non_conformity: nonConformity,
            root_cause: rootCause,
            corrective_action: correctiveAction,
            assigned_person: assignedPerson,
            deadline,
            status: "Açık",
            priority,
            notes,
          })
          .select("id")
          .single();

        if (error) throw error;
        const uploadedEvidence = await uploadEvidenceFiles({ recordId: createdRecord.id, orgId });
        if (uploadedEvidence.mediaUrls.length || uploadedEvidence.documentUrls.length || uploadedEvidence.fileUrls.length) {
          const { error: evidenceError } = await supabase
            .from("capa_records")
            .update({
              media_urls: uploadedEvidence.mediaUrls,
              document_urls: uploadedEvidence.documentUrls,
              file_urls: uploadedEvidence.fileUrls,
            })
            .eq("id", createdRecord.id);

          if (evidenceError) throw evidenceError;
        }
        if (uploadedEvidence.mediaUrls.length) {
          await writeActivityLog({
            capaRecordId: createdRecord.id,
            actionType: "updated",
            title: "Fotoğraf kanıtı yüklendi",
            description: `${uploadedEvidence.mediaUrls.length} adet fotoğraf kanıtı ilk kayda bağlandı.`,
            metadata: { mediaCount: uploadedEvidence.mediaUrls.length, mediaFiles: uploadedEvidence.mediaItems },
          });
        }
        if (uploadedEvidence.documentUrls.length) {
          await writeActivityLog({
            capaRecordId: createdRecord.id,
            actionType: "updated",
            title: "Belge kanıtı yüklendi",
            description: `${uploadedEvidence.documentUrls.length} adet belge ilk kayda bağlandı.`,
            metadata: { documentCount: uploadedEvidence.documentUrls.length, documentFiles: uploadedEvidence.documentItems },
          });
        }
        if (uploadedEvidence.fileUrls.length) {
          await writeActivityLog({
            capaRecordId: createdRecord.id,
            actionType: "updated",
            title: "Ek dosya yüklendi",
            description: `${uploadedEvidence.fileUrls.length} adet ek dosya ilk kayda bağlandı.`,
            metadata: { fileCount: uploadedEvidence.fileUrls.length, fileFiles: uploadedEvidence.fileItems },
          });
        }
        await writeActivityLog({
          capaRecordId: createdRecord?.id,
          actionType: "created",
          title: "CAPA kaydı oluşturuldu",
          description: "Yeni aksiyon planı sisteme eklendi ve takip akışı başlatıldı.",
          metadata: {
            priority,
            deadline,
            assignedPerson,
            mediaCount: uploadedEvidence.mediaUrls.length,
            documentCount: uploadedEvidence.documentUrls.length,
            fileCount: uploadedEvidence.fileUrls.length,
          },
        });
        await maybeWriteEscalationLog({
          capaRecordId: createdRecord.id,
          nextPriority: priority,
          nextStatus: "Açık",
          nextDeadline: deadline,
        });
        toast.success("Yeni DÖF kaydı oluşturuldu.");
      }

      resetForm();
      setDialogOpen(false);
      void fetchRecords();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "İşlem başarısız.");
    }
  };

  const handleEdit = (record: CAPARecord) => {
    setMediaFiles([]);
    setDocumentFiles([]);
    setAttachmentFiles([]);
    setNonConformity(record.non_conformity);
    setRootCause(record.root_cause);
    setCorrectiveAction(record.corrective_action);
    setAssignedPerson(record.assigned_person);
    setDeadline(record.deadline);
    setPriority(record.priority);
    setNotes(record.notes || "");
    setEditingId(record.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu DÖF kaydını silmek istediğinize emin misiniz?")) return;

    try {
      const record = records.find((r) => r.id === id);
      if (record?.source === "findings") {
        const { error } = await supabase.from("findings").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("capa_records").delete().eq("id", id);
        if (error) throw error;
      }

      setRecords((prev) => {
        const next = prev.filter((r) => r.id !== id);
        if (user?.id) saveCapaCache(user.id, next);
        return next;
      });
      setDetailsOpen(false);
      setDetailRecord(null);
      toast.success("DÖF kaydı silindi.");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme işlemi başarısız.");
    }
  };

  const updateStatus = async (id: string, status: CAPAStatus) => {
    try {
      const record = records.find((r) => r.id === id);
      if (record?.source === "findings") {
        const { error } = await supabase.from("findings").update({ is_resolved: status === "Tamamlandı" }).eq("id", id);
        if (error) throw error;
        await writeActivityLog({
          findingId: id,
          actionType: status === "Tamamlandı" ? "closed" : "status_changed",
          title: `Durum güncellendi: ${status}`,
          description: "Toplu DÖF bulgusunun durum bilgisi güncellendi.",
          metadata: { status },
        });
        await maybeWriteEscalationLog({
          findingId: id,
          nextPriority: record.priority,
          nextStatus: status,
          nextDeadline: record.deadline,
        });
      } else {
        const { error } = await supabase
          .from("capa_records")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        await writeActivityLog({
          capaRecordId: id,
          actionType: status === "Tamamlandı" ? "closed" : "status_changed",
          title: `Durum güncellendi: ${status}`,
          description: "CAPA kaydının durum bilgisi ve takip akışı güncellendi.",
          metadata: { status },
        });
        await maybeWriteEscalationLog({
          capaRecordId: id,
          nextPriority: record.priority,
          nextStatus: status,
          nextDeadline: record.deadline,
        });
      }

      setRecords((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, status } : r));
        if (user?.id) saveCapaCache(user.id, next);
        return next;
      });
      toast.success(`Durum güncellendi: ${status}`);
    } catch (error: any) {
      console.error("Update status error:", error);
      toast.error("Durum güncellenemedi.");
    }
  };

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const matchesStatus = filterStatus === "all" || record.status === filterStatus;
        const haystack = [record.non_conformity, record.assigned_person, record.root_cause, record.corrective_action, record.notes || ""]
          .join(" ")
          .toLowerCase();
        const matchesSearch = haystack.includes(searchText.toLowerCase());
        return matchesStatus && matchesSearch;
      }),
    [filterStatus, records, searchText],
  );

  const editingRecord = useMemo(
    () => (editingId ? records.find((record) => record.id === editingId) ?? null : null),
    [editingId, records],
  );

  const stats = useMemo(() => {
    const open = records.filter((r) => r.status === "Açık").length;
    const inProgress = records.filter((r) => r.status === "Devam Ediyor").length;
    const completed = records.filter((r) => r.status === "Tamamlandı").length;
    const overdue = records.filter((r) => r.status !== "Tamamlandı" && r.deadline && isPast(parseISO(r.deadline))).length;
    const critical = records.filter((r) => r.priority === "Kritik").length;
    const completionRate = records.length ? Math.round((completed / records.length) * 100) : 0;
    const highestPressure =
      records
        .filter((record) => record.status !== "Tamamlandı")
        .sort((a, b) => {
          const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        })[0] || null;

    return { total: records.length, open, inProgress, completed, overdue, critical, completionRate, highestPressure };
  }, [records]);

  const detailSummary = detailRecord
    ? [
        { label: "Aksiyon odağı", value: getFocusLabel(detailRecord), icon: <Sparkles className="h-4 w-4 text-cyan-300" /> },
        { label: "Takip süresi", value: getDeadlineLabel(detailRecord), icon: <TimerReset className="h-4 w-4 text-amber-300" /> },
        { label: "Kayıt kaynağı", value: detailRecord.source === "findings" ? "Toplu DÖF / bulgu" : "Manuel CAPA kaydı", icon: <Briefcase className="h-4 w-4 text-violet-300" /> },
      ]
    : [];
  const detailActivity = detailRecord
    ? detailActivityLogs.length > 0
      ? mapLogsToFeed(detailActivityLogs)
      : buildActivityFeed(detailRecord)
    : [];
  const detailEvidence = detailRecord ? getClosureEvidence(detailRecord) : null;
  const detailReminder = detailRecord ? getReminderPanel(detailRecord) : null;
  const previewEvidenceMeta = previewEvidenceUrl ? getEvidenceMetaByUrl(previewEvidenceUrl) : null;
  const detailEscalationTimeline = detailActivityLogs
    .filter((log) => log.action_type === "escalated")
    .map((log) => ({
      id: log.id,
      title: log.title,
      description: log.description || "Kritik kayıt için otomatik eskalasyon işlendi.",
      timestamp: log.created_at,
      severity: getEscalationSeverity(detailRecord!, log),
      actorName:
        typeof log.metadata?.actor_name === "string" && log.metadata.actor_name.trim().length > 0
          ? log.metadata.actor_name
          : "İSGVİZYON kullanıcısı",
    }));

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),linear-gradient(145deg,rgba(7,10,24,0.98),rgba(15,23,42,0.94))] p-6 shadow-[0_24px_90px_rgba(10,14,35,0.45)] lg:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:34px_34px] opacity-40" />
        <div className="relative grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" /> CAPA operasyon merkezi
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">Aksiyonları ata, takip et ve kapanışı standart bir akışla yönet.</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 lg:text-base">Bu alan denetim bulgularını aksiyona dönüştürmek için var. DÖF kayıtlarını sorumlu kişi, termin, öncelik ve kapanış kalitesi üzerinden tek panelde yönetiyoruz.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Toplam kayıt</p><p className="mt-3 text-3xl font-semibold text-white">{stats.total}</p><p className="mt-1 text-xs text-slate-400">Aksiyon havuzu</p></div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 backdrop-blur"><p className="text-xs uppercase tracking-[0.2em] text-rose-200/80">Açık + kritik</p><p className="mt-3 text-3xl font-semibold text-white">{stats.open + stats.critical}</p><p className="mt-1 text-xs text-rose-100/70">Öncelikli müdahale</p></div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 backdrop-blur"><p className="text-xs uppercase tracking-[0.2em] text-amber-100/80">Geciken kayıt</p><p className="mt-3 text-3xl font-semibold text-white">{stats.overdue}</p><p className="mt-1 text-xs text-amber-100/70">Termin baskısı</p></div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 backdrop-blur"><p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">Kapanış oranı</p><p className="mt-3 text-3xl font-semibold text-white">%{stats.completionRate}</p><p className="mt-1 text-xs text-emerald-100/70">Tamamlanan iş akışı</p></div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="h-11 gap-2 rounded-xl border-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Plus className="h-4 w-4" />Yeni aksiyon kaydı</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto border border-slate-700 bg-slate-950/95 sm:max-w-3xl">
                <DialogHeader className="space-y-3 border-b border-white/10 pb-4">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200"><Sparkles className="h-3.5 w-3.5" />{editingId ? "Aksiyon kaydı düzenleme" : "Yeni aksiyon planı"}</div>
                  <DialogTitle className="text-xl font-semibold text-white">{editingId ? "DÖF kaydını güncelle" : "Yeni DÖF / CAPA kaydı oluştur"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="space-y-2"><Label className="text-sm font-semibold text-slate-100">Uygunsuzluk tanımı</Label><Textarea placeholder="Bulgunun ne olduğunu açık ve ölçülebilir biçimde yazın." value={nonConformity} onChange={(e) => setNonConformity(e.target.value)} rows={4} className="border-white/10 bg-slate-900/80 text-slate-100" /></div>
                      <div className="space-y-2"><Label className="text-sm font-semibold text-slate-100">Kök neden analizi</Label><Textarea placeholder="Bu uygunsuzluk neden tekrar ediyor veya neden oluştu?" value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} className="border-white/10 bg-slate-900/80 text-slate-100" /></div>
                      <div className="space-y-2"><Label className="text-sm font-semibold text-slate-100">Düzeltici faaliyet</Label><Textarea placeholder="Sorumlu ekibin yapacağı somut aksiyonları listeleyin." value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={4} className="border-white/10 bg-slate-900/80 text-slate-100" /></div>
                    </div>
                    <div className="space-y-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
                      <div className="space-y-1"><p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Aksiyon mantığı</p><p className="text-sm text-slate-200">Bu ekran denetim kaydı tutmak için değil, kapatılacak işi yönetmek için tasarlandı.</p></div>
                      <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs text-slate-400">Zorunlu alanlar</p><ul className="space-y-2 text-sm text-slate-200"><li>• Uygunsuzluk tanımı</li><li>• Kök neden</li><li>• Düzeltici faaliyet</li><li>• Sorumlu kişi ve termin</li></ul></div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">Öncelik ve termin burada aksiyon baskısını belirler. Detaylı denetim bağlamı gerekiyorsa yine Denetimler sayfasından geliyoruz.</div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2 md:col-span-2 xl:col-span-1"><Label className="text-sm font-semibold text-slate-100">Sorumlu kişi</Label><Input placeholder="Ad Soyad" value={assignedPerson} onChange={(e) => setAssignedPerson(e.target.value)} className="border-white/10 bg-slate-900/80 text-slate-100" /></div>
                    <div className="space-y-2"><Label className="text-sm font-semibold text-slate-100">Termin</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="border-white/10 bg-slate-900/80 text-slate-100" /></div>
                    <div className="space-y-2"><Label className="text-sm font-semibold text-slate-100">Öncelik</Label><Select value={priority} onValueChange={(value: CAPAPriority) => setPriority(value)}><SelectTrigger className="border-white/10 bg-slate-900/80 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-950 text-slate-100"><SelectItem value="Düşük">🟢 Düşük</SelectItem><SelectItem value="Orta">🟡 Orta</SelectItem><SelectItem value="Yüksek">🟠 Yüksek</SelectItem><SelectItem value="Kritik">🔴 Kritik</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-5"><Label className="text-sm font-semibold text-slate-100">Operasyon notu</Label><Textarea placeholder="Kapanış kanıtı, yönetici notu veya ekip içi açıklamalar..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="border-white/10 bg-slate-900/80 text-slate-100" /></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Label className="text-sm font-semibold text-slate-100">Kapanış kanıtları</Label>
                        <p className="mt-1 text-sm text-slate-400">Dosya, belge ve fotoğraf kanıtlarını aynı kayda bağlayarak kapanış kalitesini güçlendirin.</p>
                      </div>
                      {editingRecord?.source === "findings" && (
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                          Bu kayıt için yeni kanıt yüklemeleri Denetimler akışında yönetilir
                        </span>
                      )}
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      {[
                        {
                          key: "media" as const,
                          label: "Fotoğraf kanıtı",
                          hint: "Saha görselleri ve doğrulama fotoğrafları",
                          icon: <Camera className="h-4 w-4 text-sky-300" />,
                          files: mediaFiles,
                        },
                        {
                          key: "document" as const,
                          label: "Belge yükle",
                          hint: "Form, tutanak, PDF veya resmi doküman",
                          icon: <FileBadge2 className="h-4 w-4 text-violet-300" />,
                          files: documentFiles,
                        },
                        {
                          key: "attachment" as const,
                          label: "Ek dosya",
                          hint: "Teknik çizim, Excel veya destekleyici dosya",
                          icon: <Paperclip className="h-4 w-4 text-amber-300" />,
                          files: attachmentFiles,
                        },
                      ].map((item) => (
                        <div key={item.key} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-white">
                            {item.icon}
                            {item.label}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-400">{item.hint}</p>
                          <label
                            className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-4 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/5"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDropSelection(event, item.key)}
                          >
                            <Upload className="h-4 w-4" />
                            Sürükle bırak veya dosya seç
                            <input
                              type="file"
                              className="hidden"
                              accept={item.key === "media" ? "image/*" : item.key === "document" ? ".pdf,.doc,.docx,.png,.jpg,.jpeg" : "*/*"}
                              multiple
                              onChange={(event) => handleFileSelection(event, item.key)}
                              disabled={Boolean(editingRecord?.source === "findings")}
                            />
                          </label>
                          {editingRecord && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              Mevcut kayıt:
                              {" "}
                              {item.key === "media"
                                ? `${editingRecord.media_urls?.length || 0} fotoğraf`
                                : item.key === "document"
                                  ? `${editingRecord.document_urls?.length || 0} belge`
                                  : `${editingRecord.file_urls?.length || 0} dosya`}
                            </p>
                          )}
                          <div className="mt-3 space-y-2">
                            {item.files.length > 0 ? (
                              item.files.map((file, index) => (
                                <div key={`${item.key}-${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-slate-200">{file.name}</div>
                                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                      <span>{getFileKind(file.name, file.type)}</span>
                                      <span>•</span>
                                      <span>{formatBytes(file.size)}</span>
                                    </div>
                                  </div>
                                  <button type="button" className="text-slate-400 transition hover:text-white" onClick={() => removeSelectedFile(item.key, index)}>
                                    Kaldır
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500">Henüz yeni dosya seçilmedi.</p>
                            )}
                          </div>
                          {uploadProgress[item.key] > 0 && (
                            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                              <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                                <span>Yükleme ilerlemesi</span>
                                <div className="flex items-center gap-2">
                                  <span className={`rounded-full border px-2 py-0.5 ${uploadProgress[item.key] >= 100 ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100" : "border-cyan-400/30 bg-cyan-400/15 text-cyan-100"}`}>
                                    {getUploadStatusLabel(uploadProgress[item.key])}
                                  </span>
                                  <span>%{uploadProgress[item.key]}</span>
                                </div>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-white/10">
                                <div
                                  className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-300 transition-all duration-300"
                                  style={{ width: `${uploadProgress[item.key]}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5">Vazgeç</Button><Button onClick={handleSubmit} className="gap-2 rounded-xl border-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300"><CheckCircle2 className="h-4 w-4" />{editingId ? "Aksiyon kaydını güncelle" : "Aksiyon kaydını oluştur"}</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operasyon özeti</p><h2 className="mt-2 text-lg font-semibold text-white">Takip baskısını gösteren özet</h2></div><TrendingUp className="h-5 w-5 text-cyan-300" /></div>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between text-sm text-slate-300"><span>Aktif iş yükü</span><span>{stats.open + stats.inProgress} kayıt</span></div><div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${Math.min(100, Math.max(12, stats.total ? ((stats.open + stats.inProgress) / stats.total) * 100 : 12))}%` }} /></div></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">En yüksek baskı</p>{stats.highestPressure ? <div className="mt-3 space-y-2"><p className="text-sm font-medium text-white">{stats.highestPressure.non_conformity}</p><div className="flex flex-wrap gap-2 text-xs"><span className={`rounded-full border px-2 py-1 ${priorityConfig[stats.highestPressure.priority].color}`}>{stats.highestPressure.priority}</span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">{getDeadlineLabel(stats.highestPressure)}</span></div></div> : <p className="mt-3 text-sm text-slate-400">Şu anda öne çıkan açık kayıt yok.</p>}</div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-slate-200">CAPA sayfasını denetim ekranından ayıran şey burada: bu ekran sorumlu, termin, ilerleme ve kapanış kalitesini yönetir.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[{ label: "Toplam kayıt", value: stats.total, hint: "Aksiyon havuzu", icon: <FileText className="h-4 w-4 text-cyan-300" />, tone: "border-white/10 bg-white/5" }, { label: "Açık kayıt", value: stats.open, hint: "İlk müdahale bekliyor", icon: <AlertTriangle className="h-4 w-4 text-rose-300" />, tone: "border-rose-500/20 bg-rose-500/5" }, { label: "Takipte", value: stats.inProgress, hint: "Devam eden aksiyon", icon: <Clock className="h-4 w-4 text-amber-300" />, tone: "border-amber-500/20 bg-amber-500/5" }, { label: "Tamamlandı", value: stats.completed, hint: "Kapanan kayıt", icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" />, tone: "border-emerald-500/20 bg-emerald-500/5" }, { label: "Geciken", value: stats.overdue, hint: "Takvim baskısı", icon: <TimerReset className="h-4 w-4 text-orange-300" />, tone: "border-orange-500/20 bg-orange-500/5" }].map((item) => <div key={item.label} className={`glass-card rounded-3xl border p-5 ${item.tone}`}><div className="flex items-center justify-between"><p className="text-sm text-slate-300">{item.label}</p>{item.icon}</div><p className="mt-4 text-3xl font-semibold text-white">{item.value}</p><p className="mt-1 text-xs text-slate-400">{item.hint}</p></div>)}
      </section>

      <section className="glass-card rounded-[28px] border border-white/10 p-5 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-2"><Label className="text-sm font-semibold text-slate-100">Kayıt ara</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input placeholder="Uygunsuzluk, sorumlu kişi, kök neden..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="h-11 border-white/10 bg-slate-950/70 pl-10 text-slate-100" /></div></div>
          <div className="space-y-2"><Label className="text-sm font-semibold text-slate-100">Durum filtresi</Label><Select value={filterStatus} onValueChange={(value: "all" | CAPAStatus) => setFilterStatus(value)}><SelectTrigger className="h-11 border-white/10 bg-slate-950/70 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-950 text-slate-100"><SelectItem value="all">Tüm durumlar</SelectItem><SelectItem value="Açık">🔴 Açık</SelectItem><SelectItem value="Devam Ediyor">🟡 Devam Ediyor</SelectItem><SelectItem value="Tamamlandı">✅ Tamamlandı</SelectItem></SelectContent></Select></div>
        </div>
      </section>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-300" /><p className="text-sm text-slate-400">CAPA kayıtları yükleniyor...</p></div>
      ) : filteredRecords.length === 0 ? (
        <div className="glass-card rounded-[28px] border border-white/10 p-12 text-center"><FileText className="mx-auto h-12 w-12 text-slate-500" /><h3 className="mt-4 text-lg font-semibold text-white">Gösterilecek aksiyon kaydı yok</h3><p className="mt-2 text-sm text-slate-400">Yeni bir CAPA kaydı oluşturarak atama ve takip akışını başlatabiliriz.</p></div>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {filteredRecords.map((record) => {
            const isOverdue = record.status !== "Tamamlandı" && record.deadline && isPast(parseISO(record.deadline));
            const statusInfo = statusConfig[record.status];
            const priorityInfo = priorityConfig[record.priority];
            const escalationLog = escalationMap[record.id];
            const escalationLine = getEscalationLine(record, escalationLog);
            const escalationCount = escalationCountMap[record.id] || 0;

            return (
              <article key={record.id} className={`group relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br ${statusAccent[record.status]} p-[1px] shadow-[0_20px_60px_rgba(3,8,24,0.35)] transition-transform duration-300 hover:-translate-y-1`}>
                <div className="rounded-[27px] bg-slate-950/95 p-5 lg:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${statusInfo.color}`}>{statusInfo.icon} {statusInfo.label}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${priorityInfo.color}`}>{priorityInfo.icon} {priorityInfo.label}</span>
                        {record.priority === "Kritik" && record.status !== "Tamamlandı" && <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100">Eskalasyon gerekli</span>}
                        {record.priority === "Kritik" && record.status !== "Tamamlandı" && <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">Kritik izleme aktif</span>}
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{record.source === "findings" ? "Toplu DÖF kaynağı" : "Manuel CAPA"}</span>
                      </div>
                      <div>
                        <h3 className="max-w-2xl text-lg font-semibold text-white">{record.non_conformity}</h3>
                        <p className="mt-1 text-sm text-slate-400">{getNextActionLabel(record)}</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => { setDetailRecord(record); setDetailsOpen(true); }} className="h-10 rounded-xl border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"><Eye className="mr-2 h-4 w-4" />Detayı aç</Button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sorumlu</p><p className="mt-2 text-sm font-medium text-white">{record.assigned_person}</p></div>
                    <div className={`rounded-2xl border p-4 ${isOverdue ? "border-destructive/25 bg-destructive/10" : "border-white/10 bg-white/5"}`}><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Termin</p><p className="mt-2 text-sm font-medium text-white">{formatDateLabel(record.deadline)}</p><p className={`mt-1 text-xs ${isOverdue ? "text-destructive" : "text-slate-400"}`}>{getDeadlineLabel(record)}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Aksiyon odağı</p><p className="mt-2 text-sm font-medium text-white">{getFocusLabel(record)}</p></div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Oluşturulma</p><p className="mt-2 text-sm font-medium text-white">{formatDateLabel(record.created_at)}</p></div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Kök neden özeti</p>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{record.root_cause}</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Sonraki önerilen aksiyon</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">{getNextActionLabel(record)}</p>
                      <Button onClick={() => { setDetailRecord(record); setDetailsOpen(true); }} className="mt-4 h-10 rounded-xl border-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                        {getActionButtonLabel(record)}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Kapanış kanıtı</p>
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-sm text-slate-200">
                        <span>Kanıt seviyesi</span>
                        <span>{getClosureEvidence(record).quality}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                          <div className="flex items-center gap-2 text-slate-300">
                            <CheckCheck className="h-4 w-4 text-emerald-300" />
                            Not
                          </div>
                          <p className="mt-2 text-white">{getClosureEvidence(record).hasNotes ? "Var" : "Eksik"}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                          <div className="flex items-center gap-2 text-slate-300">
                            <Camera className="h-4 w-4 text-sky-300" />
                            Fotoğraf
                          </div>
                          <p className="mt-2 text-white">{getClosureEvidence(record).mediaCount} adet</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                          <div className="flex items-center gap-2 text-slate-300">
                            <FileText className="h-4 w-4 text-violet-300" />
                            Belge
                          </div>
                          <p className="mt-2 text-white">{getClosureEvidence(record).documentCount} adet</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                          <div className="flex items-center gap-2 text-slate-300">
                            <Briefcase className="h-4 w-4 text-amber-300" />
                            Dosya
                          </div>
                          <p className="mt-2 text-white">{getClosureEvidence(record).fileCount} adet</p>
                        </div>
                      </div>
                    </div>
                    <div className={`rounded-2xl border p-4 ${getReminderPanel(record).tone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.18em]">Otomatik hatırlatma</p>
                        <BellRing className="h-4 w-4" />
                      </div>
                      <p className="mt-3 text-sm font-medium">{getReminderPanel(record).title}</p>
                      <p className="mt-2 text-sm leading-6 opacity-90">{getReminderPanel(record).body}</p>
                      <span className="mt-4 inline-flex rounded-full border border-current/20 px-2.5 py-1 text-xs">{getReminderPanel(record).badge}</span>
                      {escalationLine && (
                        <div className="mt-4 rounded-xl border border-current/20 bg-black/10 px-3 py-3 text-xs leading-5">
                          <span className="font-medium">Eskalasyon geçmişi:</span> {escalationLine}
                          {escalationCount > 0 && <span className="ml-2 rounded-full border border-current/20 px-2 py-0.5 text-[11px]">Toplam {escalationCount} uyarı</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">{record.media_urls && record.media_urls.length > 0 && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">📷 {record.media_urls.length} görsel</span>}<span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">ID: {record.id.slice(0, 8)}</span></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={record.status} onValueChange={(value: CAPAStatus) => updateStatus(record.id, value)}><SelectTrigger className="h-10 w-[180px] rounded-xl border-white/10 bg-slate-900/80 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-950 text-slate-100"><SelectItem value="Açık">🔴 Açık</SelectItem><SelectItem value="Devam Ediyor">🟡 Devam Ediyor</SelectItem><SelectItem value="Tamamlandı">✅ Tamamlandı</SelectItem></SelectContent></Select>
                      <Button variant="outline" onClick={() => handleEdit(record)} className="h-10 rounded-xl border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"><Edit2 className="mr-2 h-4 w-4" />Düzenle</Button>
                      <Button variant="ghost" onClick={() => handleDelete(record.id)} className="h-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Sil</Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Dialog open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setPreviewEvidenceUrl(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border border-slate-700 bg-slate-950/95 sm:max-w-5xl">
          {detailRecord && (
            <>
              <DialogHeader className="space-y-3 border-b border-white/10 pb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${statusConfig[detailRecord.status].color}`}>{statusConfig[detailRecord.status].icon} {statusConfig[detailRecord.status].label}</span><span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${priorityConfig[detailRecord.priority].color}`}>{priorityConfig[detailRecord.priority].icon} {priorityConfig[detailRecord.priority].label}</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{detailRecord.source === "findings" ? "Toplu DÖF / bulgu kaynağı" : "Manuel CAPA kaydı"}</span></div>
                    <DialogTitle className="max-w-3xl text-2xl font-semibold text-white">{detailRecord.non_conformity}</DialogTitle>
                    <p className="text-sm leading-6 text-slate-400">{getNextActionLabel(detailRecord)}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-right text-xs text-slate-200"><p className="font-medium text-cyan-200">Kayıt ID</p><p className="mt-1 font-mono text-sm text-white">{detailRecord.id}</p></div>
                </div>
              </DialogHeader>
              <div className="grid gap-6 pt-2 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">{detailSummary.map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>{item.icon}</div><p className="mt-3 text-sm font-medium leading-6 text-white">{item.value}</p></div>)}</div>
                  <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sorumlu kişi</p><p className="mt-3 text-base font-medium text-white">{detailRecord.assigned_person}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Termin</p><p className="mt-3 text-base font-medium text-white">{formatDateLabel(detailRecord.deadline)}</p></div></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Kök neden</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{detailRecord.root_cause}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Düzeltici faaliyet planı</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{detailRecord.corrective_action}</p></div>
                  {detailRecord.notes && <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Operasyon notu</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{detailRecord.notes}</p></div>}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Zaman çizelgesi</p>
                      <Clock className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {detailActivity.map((item) => (
                        <div key={item.id} className={`rounded-xl border px-4 py-3 ${item.tone}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{item.title}</p>
                            <span className="text-xs opacity-80">{formatDateLabel(item.timestamp)} · {formatTimeLabel(item.timestamp)}</span>
                          </div>
                          <p className="mt-2 text-sm opacity-90">{item.description}</p>
                          <p className="mt-2 text-xs opacity-75">{item.actorName || "İSGVİZYON"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {detailRecord.media_urls && detailRecord.media_urls.length > 0 && <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Fotoğraf kanıtları</p><span className="text-xs text-slate-400">{detailRecord.media_urls.length} medya</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{detailRecord.media_urls.map((url, idx) => { const isBase64 = url.startsWith("data:image"); const isHttpUrl = url.startsWith("http"); if (!isBase64 && !isHttpUrl) return null; return <div key={idx} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 text-left"><button type="button" className="block w-full text-left" onClick={() => openEvidenceUrl(url)}><img src={url} alt={`Fotoğraf ${idx + 1}`} className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105" onError={(event) => { (event.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Crect fill='%23111827' width='240' height='240'/%3E%3Ctext fill='%2394a3b8' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EYüklenemedi%3C/text%3E%3C/svg%3E"; }} /><div className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/35" /><span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white">{idx + 1}/{detailRecord.media_urls.length}</span></button><div className="flex items-center justify-end gap-2 border-t border-white/10 bg-slate-950/80 px-3 py-2"><Button type="button" size="sm" variant="ghost" onClick={() => openEvidenceUrl(url)} className="h-8 px-2 text-slate-200 hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" /></Button><Button type="button" size="sm" variant="ghost" onClick={() => void downloadEvidenceUrl(url)} className="h-8 px-2 text-slate-200 hover:bg-white/10"><Download className="h-3.5 w-3.5" /></Button></div></div>; })}</div></div>}
                </div>
                <div className="space-y-5">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Önerilen sonraki adım</p><h3 className="mt-2 text-lg font-semibold text-white">{getActionButtonLabel(detailRecord)}</h3></div><ShieldCheck className="h-5 w-5 text-cyan-300" /></div><p className="mt-3 text-sm leading-6 text-slate-200">{getNextActionLabel(detailRecord)}</p><Button onClick={() => handleEdit(detailRecord)} className="mt-4 h-10 w-full rounded-xl border-0 bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Edit3 className="mr-2 h-4 w-4" />Kaydı düzenle</Button></div>
                  {detailReminder && <div className={`rounded-2xl border p-5 ${detailReminder.tone}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] opacity-80">Otomatik hatırlatma</p><h3 className="mt-2 text-lg font-semibold">{detailReminder.title}</h3></div><BellRing className="h-5 w-5" /></div><p className="mt-3 text-sm leading-6 opacity-90">{detailReminder.body}</p><span className="mt-4 inline-flex rounded-full border border-current/20 px-2.5 py-1 text-xs">{detailReminder.badge}</span>{detailEscalationTimeline.length > 0 ? <div className="mt-4 rounded-xl border border-current/20 bg-black/10 px-3 py-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium uppercase tracking-[0.16em]">Eskalasyon geçmişi</p><span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px]">Toplam {detailEscalationTimeline.length} uyarı</span></div><div className="mt-3 space-y-3">{detailEscalationTimeline.map((item, index) => <div key={item.id} className="flex gap-3 text-xs"><div className="flex flex-col items-center"><span className="h-2.5 w-2.5 rounded-full bg-current" />{index !== detailEscalationTimeline.length - 1 && <span className="mt-1 h-full w-px bg-current/30" />}</div><div className="min-w-0 pb-2"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${item.severity.className}`}>{item.severity.label}</span></div><p className="mt-1 opacity-90">{item.description}</p><p className="mt-1 opacity-70">{formatDateLabel(item.timestamp)} · {formatTimeLabel(item.timestamp)} · {item.actorName}</p></div></div>)}</div></div> : getEscalationLine(detailRecord, escalationMap[detailRecord.id]) ? <div className="mt-4 rounded-xl border border-current/20 bg-black/10 px-3 py-3 text-xs leading-5"><span className="font-medium">Eskalasyon geçmişi:</span> {getEscalationLine(detailRecord, escalationMap[detailRecord.id])}{(escalationCountMap[detailRecord.id] || 0) > 0 && <span className="ml-2 rounded-full border border-current/20 px-2 py-0.5 text-[11px]">Toplam {escalationCountMap[detailRecord.id]} uyarı</span>}</div> : null}</div>}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Risk özeti</p><div className="mt-4 space-y-3 text-sm text-slate-300"><div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"><span>Öncelik seviyesi</span><span className={`rounded-full border px-2 py-1 text-xs ${priorityConfig[detailRecord.priority].color}`}>{detailRecord.priority}</span></div><div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"><span>Termin baskısı</span><span>{getDeadlineLabel(detailRecord)}</span></div><div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"><span>Kayıt kaynağı</span><span>{detailRecord.source === "findings" ? "Toplu DÖF" : "Manuel"}</span></div></div></div>
                  {detailEvidence && <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Kapanış kanıtı</p><div className="mt-4 space-y-3 text-sm text-slate-300"><div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"><span>Kanıt seviyesi</span><span>{detailEvidence.quality}</span></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"><p className="text-xs text-slate-400">Dosya</p><p className="mt-2 text-white">{detailEvidence.fileCount} adet</p></div><div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"><p className="text-xs text-slate-400">Belge</p><p className="mt-2 text-white">{detailEvidence.documentCount} adet</p></div><div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"><p className="text-xs text-slate-400">Fotoğraf</p><p className="mt-2 text-white">{detailEvidence.mediaCount} adet</p></div><div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3"><p className="text-xs text-slate-400">Kapanış notu</p><p className="mt-2 text-white">{detailEvidence.hasNotes ? "Var" : "Eksik"}</p></div></div><div className="grid gap-3"><div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Belge bağlantıları</p><span className="text-xs text-slate-500">{detailRecord.document_urls?.length || 0}</span></div><div className="mt-3 space-y-2">{detailRecord.document_urls && detailRecord.document_urls.length > 0 ? detailRecord.document_urls.map((url, index) => { const meta = getEvidenceMetaByUrl(url); return <div key={`document-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-200">{meta?.name || url.split('/').pop()}</p><p className="mt-1 text-[11px] text-slate-500">{getFileKind(meta?.name || url, meta?.mime)} • {formatBytes(meta?.size)}</p></div><div className="flex items-center gap-1">{isPreviewableEvidence(url) && <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewEvidenceUrl(url)} className="h-8 px-2 text-slate-200 hover:bg-white/10">Önizle</Button>}<Button type="button" size="sm" variant="ghost" onClick={() => openEvidenceUrl(url)} className="h-8 px-2 text-slate-200 hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" /></Button><Button type="button" size="sm" variant="ghost" onClick={() => void downloadEvidenceUrl(url)} className="h-8 px-2 text-slate-200 hover:bg-white/10"><Download className="h-3.5 w-3.5" /></Button></div></div></div>; }) : <p className="text-xs text-slate-500">Henüz belge eklenmedi.</p>}</div></div><div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ek dosyalar</p><span className="text-xs text-slate-500">{detailRecord.file_urls?.length || 0}</span></div><div className="mt-3 space-y-2">{detailRecord.file_urls && detailRecord.file_urls.length > 0 ? detailRecord.file_urls.map((url, index) => { const meta = getEvidenceMetaByUrl(url); return <div key={`file-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-200">{meta?.name || url.split('/').pop()}</p><p className="mt-1 text-[11px] text-slate-500">{getFileKind(meta?.name || url, meta?.mime)} • {formatBytes(meta?.size)}</p></div><div className="flex items-center gap-1"><Button type="button" size="sm" variant="ghost" onClick={() => openEvidenceUrl(url)} className="h-8 px-2 text-slate-200 hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" /></Button><Button type="button" size="sm" variant="ghost" onClick={() => void downloadEvidenceUrl(url)} className="h-8 px-2 text-slate-200 hover:bg-white/10"><Download className="h-3.5 w-3.5" /></Button></div></div></div>; }) : <p className="text-xs text-slate-500">Henüz ek dosya bulunmuyor.</p>}</div></div></div></div></div>}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Kurumsal aksiyonlar</p><div className="mt-4 space-y-2 text-sm text-slate-300"><p>• Termin yaklaşınca sorumlu kişiyi yeniden bilgilendir.</p><p>• Kritik kayıtlarda kapanış kanıtı olmadan tamamlandıya alma.</p><p>• Kapanan maddeleri aylık DÖF özet raporuna ekle.</p></div></div>
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5"><Button variant="outline" onClick={() => handleEdit(detailRecord)} className="h-11 rounded-xl border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"><Edit2 className="mr-2 h-4 w-4" />Düzenle</Button><Button variant="ghost" onClick={() => handleDelete(detailRecord.id)} className="h-11 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Sil</Button></div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(previewEvidenceUrl)} onOpenChange={(open) => { if (!open) setPreviewEvidenceUrl(null); }}>
        <DialogContent className="border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.97))] p-0 text-white sm:max-w-4xl">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Belge önizleme</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Kanıt dosyasını uygulama içinde inceleyin</h3>
                <p className="mt-2 text-sm text-slate-300">PDF ve görseller ayrı sekmeye gitmeden kontrol edilebilir. Gerekirse buradan açabilir veya indirebilirsiniz.</p>
                {previewEvidenceUrl && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                      {previewEvidenceMeta?.name || previewEvidenceUrl.split("/").pop() || "Kanıt dosyası"}
                    </span>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                      {getFileKind(previewEvidenceMeta?.name || previewEvidenceUrl, previewEvidenceMeta?.mime)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                      {formatBytes(previewEvidenceMeta?.size)}
                    </span>
                  </div>
                )}
              </div>
              {previewEvidenceUrl && (
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => openEvidenceUrl(previewEvidenceUrl)} className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-slate-100 hover:bg-white/10">
                    <ExternalLink className="mr-2 h-4 w-4" /> Aç
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void downloadEvidenceUrl(previewEvidenceUrl)} className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-slate-100 hover:bg-white/10">
                    <Download className="mr-2 h-4 w-4" /> İndir
                  </Button>
                </div>
              )}
            </div>
          </div>
          {previewEvidenceUrl && (
            <div className="px-6 py-6">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-50 shadow-[0_24px_80px_rgba(2,6,23,0.4)]">
                {isImageEvidence(previewEvidenceUrl) ? (
                  <img src={previewEvidenceUrl} alt="Belge önizleme" className="max-h-[72vh] w-full object-contain bg-white" />
                ) : (
                  <iframe src={previewEvidenceUrl} title="Belge önizleme" className="h-[72vh] w-full bg-white" />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
