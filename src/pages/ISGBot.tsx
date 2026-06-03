import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  AlertCircle,
  Bot,
  Building2,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Chrome,
  Clock,
  Download,
  ExternalLink,
  FileDown,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  listIsgkatipCompanies,
  listIsgkatipComplianceFlags,
  type IsgkatipCompanyRow,
  type IsgkatipFlagRow,
} from "@/domain/isgkatip/isgkatipQueries";
import { useSubscription } from "@/hooks/useSubscription";
import {
  ISGVIZYON_CHROME_EXTENSION_ID,
  ISGVIZYON_CHROME_EXTENSION_URL,
  ISGVIZYON_EXTENSION_STATUS_MESSAGE,
} from "@/lib/constants/extension";
import { importOsgbCompaniesFromKatip } from "@/lib/osgbPlatform";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { addInterFontsToJsPDF } from "@/utils/fonts";
import {
  buildMultiAssignmentPlan,
  parsePersonnelText,
  parseSgkNumbers,
  type IsgbotPersonnel,
  type MultiAssignmentDryRunResult,
  type MultiAssignmentPlanRow,
} from "@/lib/isgbot/assignmentDryRun";
import { buildExcessDurationPreview, type ExcessDurationPreviewRow } from "@/lib/isgbot/excessDurationDryRun";
import {
  canApplyExcessDuration,
  canApplyMultiAssignment,
  createPlanHash,
  ISGBOT_APPLY_ENABLED,
  ISGBOT_PILOT_LIMIT,
} from "@/lib/isgbot/applyGuards";
import {
  exportApplyResultsCsv,
  normalizeApplyResult,
  summarizeApplyResults,
  type ApplyResultRow,
} from "@/lib/isgbot/applyResults";
import {
  sendExcessDurationApply,
  sendMultiAssignmentApply,
  validateAssignmentSurface,
  validateDurationSurface,
} from "@/lib/isgbot/extensionApply";

type FeatureId =
  | "multi-assignment"
  | "contract-download"
  | "contracts-need-update"
  | "excess-duration-update"
  | "contract-status-report"
  | "duration-analysis"
  | "change-tracking"
  | "company-import";

type FeatureTone = "violet" | "blue" | "amber" | "emerald" | "rose";

type BotFeature = {
  id: FeatureId;
  title: string;
  description: string;
  badge: string;
  status: "Aktif" | "Kısıtlı" | "Hazırlanıyor" | "Önizleme" | "Rapor" | "Analiz" | "PDF";
  cta: string;
  tone: FeatureTone;
  icon: typeof UserPlus;
};

type FeatureRuntimeState = {
  loading?: boolean;
  error?: string | null;
  info?: string | null;
  success?: string | null;
};

type SurfaceValidationResult = {
  pageContext?: {
    detectedModule?: string;
    confidence?: string;
  } | null;
  formSurface?: {
    found?: boolean;
    requiredFieldsFound?: number;
    requiredFieldsMissing?: string[];
    confidence?: string;
  } | null;
  canApply?: boolean;
  blockingReasons?: string[];
} | null;

type BotSnapshot = {
  companies: IsgkatipCompanyRow[];
  companyCount: number;
  lastSyncedAt: string | null;
  connectionStatus: "connected" | "waiting" | "offline";
};

type ImportTarget = "personal" | "osgb";

type ImportResult = {
  created: number;
  updated: number;
};

type ExistingCompanyIdentity = {
  id: string;
  name: string | null;
  tax_number: string | null;
  sgk_workplace_number: string | null;
  workplace_registration_number: string | null;
};

type KatipChangeType = "added" | "removed" | "updated";

type KatipChangeItem = {
  id: string;
  companyName: string;
  type: KatipChangeType;
  summary: string;
  details: string[];
  changeCategories?: string[];
};

type KatipChangeResult = {
  checkedAt: string;
  hasBaseline: boolean;
  changes: KatipChangeItem[];
  currentCount: number;
  previousCount: number;
};

type IsgbotOperationRow = {
  id: string;
  operation_type: string;
  operation_title: string;
  status: string;
  source: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  input_summary: Record<string, unknown> | null;
  result_summary: Record<string, unknown> | null;
  error_message: string | null;
  error_code: string | null;
  created_at: string | null;
};

type DurationStatus = "missing" | "critical" | "deficit" | "compliant" | "excess";

type DurationAnalysisRow = {
  id: string;
  companyName: string;
  sgkNo: string;
  hazardClass: string;
  employeeCount: number;
  assignedMinutes: number;
  requiredMinutes: number;
  diffMinutes: number;
  ratio: number | null;
  status: DurationStatus;
  statusLabel: string;
  recommendation: string;
};

type ContractUpdateCandidate = {
  id: string;
  companyName: string;
  sgkNo: string;
  currentStatus: string;
  issueCode?: string;
  issue: string;
  reason: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  recommendation: string;
  source: "Uyum bayrağı" | "Temel kontrol";
};

type ContractStatusColor = "red" | "gray" | "yellow" | "green" | "purple";

type ContractStatusReportRow = {
  id: string;
  companyName: string;
  sgkNo: string;
  employeeCount: number;
  hazardClass: string;
  safetyExpertStatus: string;
  physicianStatus: string;
  dspStatus: string;
  overallStatus: string;
  color: ContractStatusColor;
  missingField: string;
  recommendation: string;
};

const ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION = 1;
const ISGBOT_FORM_SURFACE_ERROR_MESSAGE =
  "İSG-KATİP form alanları doğrulanamadı. Sayfa yapısı değişmiş olabilir veya yanlış ekranda olabilirsiniz.";

type ExtensionInstallState =
  | "checking"
  | "not_installed"
  | "installed_no_auth"
  | "isgkatip_login_required"
  | "sync_ready"
  | "error";

type ExtensionStatus = {
  state: ExtensionInstallState;
  label: string;
  description: string;
  installed: boolean;
  authenticated: boolean;
  isgKatipReady: boolean;
  isgKatipOpen: boolean;
  version: string | null;
  extensionLastSyncedAt?: string | null;
  totalCompanies?: number | null;
  systemStatus?: string | null;
  source?: string | null;
  lastCheckedAt: string | null;
  error?: string | null;
};

type ExtensionPingResponse = {
  ok?: boolean;
  success?: boolean;
  installed?: boolean;
  authenticated?: boolean;
  isAuthenticated?: boolean;
  version?: string | null;
  extensionVersion?: string | null;
  isKatipSessionActive?: boolean;
  isReady?: boolean;
  lastSyncAt?: string | null;
  extensionLastSyncedAt?: string | null;
  totalCompanies?: number | null;
  systemStatus?: string | null;
  source?: string | null;
  isgKatip?: {
    state: "not_open" | "open" | "login_required" | "ready";
    hasTab: boolean;
    isLoggedIn: boolean;
    isTargetPage: boolean;
  };
};

const initialExtensionStatus: ExtensionStatus = {
  state: "checking",
  label: "Eklenti kontrol ediliyor",
  description: "Tarayıcı eklentisi bağlantısı doğrulanıyor.",
  installed: false,
  authenticated: false,
  isgKatipReady: false,
  isgKatipOpen: false,
  version: null,
  extensionLastSyncedAt: null,
  totalCompanies: null,
  systemStatus: null,
  source: null,
  lastCheckedAt: null,
};

const EXTENSION_STATUS_RESPONSE_SOURCE = "isgvizyon-extension-bridge";
const WEB_APP_STATUS_SOURCE = "isgvizyon-web-app";
const EXTENSION_STATUS_RESPONSE_MESSAGE = "ISGVIZYON_EXTENSION_STATUS_RESPONSE";
const LEGACY_EXTENSION_IDS = ["hgcbdpekhlgfnfofogfkhjccnkpbmlcj"];
const DEBUG_EXTENSION_STATUS = false;

const debugExtensionStatus = (...args: unknown[]) => {
  if (DEBUG_EXTENSION_STATUS) console.debug(...args);
};

const requestExtensionStatusViaBridge = (timeoutMs = 2200): Promise<ExtensionPingResponse | null> => {
  if (typeof window === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const requestId = `isgbot-status-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timer);
    };

    const finish = (response: ExtensionPingResponse | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const payload = event.data;
      if (
        payload?.source !== EXTENSION_STATUS_RESPONSE_SOURCE ||
        payload?.type !== EXTENSION_STATUS_RESPONSE_MESSAGE ||
        payload?.requestId !== requestId
      ) {
        return;
      }

      debugExtensionStatus("[ISGBot] status response received", { source: "bridge" });
      finish((payload.payload || null) as ExtensionPingResponse | null);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener("message", handleMessage);
    debugExtensionStatus("[ISGBot] status ping sent", { source: "bridge" });
    window.postMessage(
      {
        source: WEB_APP_STATUS_SOURCE,
        type: ISGVIZYON_EXTENSION_STATUS_MESSAGE,
        requestId,
      },
      window.location.origin,
    );
  });
};

const requestExtensionStatusDirectForId = (extensionId: string, timeoutMs = 1800): Promise<ExtensionPingResponse | null> => {
  const chromeRuntime = (window as any).chrome?.runtime;
  if (!chromeRuntime?.sendMessage) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);

    debugExtensionStatus("[ISGBot] status ping sent", { source: "direct" });
    chromeRuntime.sendMessage(
      extensionId,
      { type: ISGVIZYON_EXTENSION_STATUS_MESSAGE },
      (result: ExtensionPingResponse | undefined) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        const lastError = chromeRuntime.lastError;
        if (lastError) {
          resolve(null);
          return;
        }
        debugExtensionStatus("[ISGBot] status response received", { source: "direct" });
        resolve(result ?? null);
      },
    );
  });
};

const requestExtensionStatusDirect = async (timeoutMs = 1800): Promise<ExtensionPingResponse | null> => {
  const extensionIds = Array.from(new Set([ISGVIZYON_CHROME_EXTENSION_ID, ...LEGACY_EXTENSION_IDS]));

  for (const extensionId of extensionIds) {
    const response = await requestExtensionStatusDirectForId(extensionId, timeoutMs);
    if (response?.success) return response;
  }

  return null;
};

const getLatestIsoDate = (values: Array<string | null | undefined>) => {
  const latest = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((first, second) => second - first)[0];

  return typeof latest === "number" ? new Date(latest).toISOString() : null;
};

const normalizeHazardClass = (value: string | null) => {
  const normalized = String(value || "").toLocaleLowerCase("tr-TR");
  if (normalized.includes("çok")) return "Çok Tehlikeli";
  if (normalized.includes("tehlikeli")) return "Tehlikeli";
  return "Az Tehlikeli";
};

const normalizeImportText = (value: unknown) => String(value ?? "").trim();

const getRawErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;
    return String(maybeError.message || maybeError.error || maybeError.details || "");
  }
  return "";
};

const getIsgbotFriendlyErrorMessage = (
  error: unknown,
  fallback = "İşlem tamamlanamadı. Lütfen bağlantınızı, oturumunuzu ve seçili verileri kontrol edip tekrar deneyin.",
) => {
  const rawMessage = getRawErrorMessage(error);
  const normalized = rawMessage.toLocaleLowerCase("tr-TR");

  if (!rawMessage.trim()) return fallback;

  if (normalized.includes("cannot read properties") || normalized.includes("undefined") || normalized.includes("null")) {
    return "İşlem için gerekli verilerden biri eksik görünüyor. Lütfen listeyi yenileyip kayıt seçimini tekrar yapın.";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("network") || normalized.includes("err_failed")) {
    return "Sunucuya ulaşılamadı. İnternet bağlantınızı ve Supabase/eklenti erişimini kontrol edip tekrar deneyin.";
  }

  if (normalized.includes("jwt") || normalized.includes("unauthorized") || normalized.includes("auth") || normalized.includes("oturumu")) {
    return "Oturum doğrulanamadı. Lütfen çıkış yapıp tekrar giriş yapın, ardından işlemi yeniden deneyin.";
  }

  if (normalized.includes("row-level security") || normalized.includes("rls") || normalized.includes("permission denied")) {
    return "Bu işlem için yetkiniz doğrulanamadı. Kurum/organizasyon erişiminizi kontrol edip tekrar deneyin.";
  }

  if (normalized.includes("relation") || normalized.includes("does not exist") || normalized.includes("schema cache") || normalized.includes("42p01")) {
    return "Gerekli veritabanı tablosu veya migration eksik görünüyor. Lütfen sistem kurulumunu/migration durumunu kontrol edin.";
  }

  if (normalized.includes("duplicate") || normalized.includes("23505") || normalized.includes("unique")) {
    return "Bu kayıt sistemde zaten bulunuyor. Mevcut kaydı güncelleyebilir veya farklı bir kayıt seçebilirsiniz.";
  }

  if (normalized.includes("on conflict")) {
    return "Kayıt eşleştirme kuralı veritabanında eksik görünüyor. İlgili unique index migration’ı uygulanmalıdır.";
  }

  if (normalized.includes("not-null") || normalized.includes("null value") || normalized.includes("23502")) {
    return "Zorunlu alanlardan biri boş. Lütfen seçili kayıttaki firma adı, SGK no ve gerekli süre bilgilerini kontrol edin.";
  }

  if (normalized.includes("receiving end does not exist") || normalized.includes("message port") || normalized.includes("extension")) {
    return "Tarayıcı eklentisiyle bağlantı kurulamadı. Eklentinin açık, güncel ve İSG-KATİP oturumunun aktif olduğundan emin olun.";
  }

  if (normalized.includes("form") || normalized.includes("selector") || normalized.includes("alanları doğrulanamadı")) {
    return "İSG-KATİP form alanları doğrulanamadı. Sayfa yapısı değişmiş olabilir veya yanlış ekranda olabilirsiniz.";
  }

  if (normalized.includes("timeout") || normalized.includes("time out") || normalized.includes("zaman aşımı")) {
    return "İşlem zaman aşımına uğradı. İSG-KATİP sayfasının açık olduğundan emin olup tekrar deneyin.";
  }

  if (normalized.includes("organization")) {
    return "Organizasyon bilgisi bulunamadı. Lütfen hesap/kurum bağlantınızı kontrol edin.";
  }

  return fallback;
};

const normalizeCompanyMatchText = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("tr-TR");

const normalizeCompanyIdentifier = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const isKatipCompanyAlreadyImported = (company: IsgkatipCompanyRow, identities: ExistingCompanyIdentity[]) => {
  const sgkNo = normalizeCompanyIdentifier(company.sgk_no);
  const companyName = normalizeCompanyMatchText(company.company_name);

  return identities.some((identity) => {
    const identityNumbers = [
      identity.tax_number,
      identity.sgk_workplace_number,
      identity.workplace_registration_number,
    ]
      .map(normalizeCompanyIdentifier)
      .filter(Boolean);

    if (sgkNo && identityNumbers.includes(sgkNo)) return true;
    return Boolean(companyName && normalizeCompanyMatchText(identity.name) === companyName);
  });
};

const buildCompanyImportPayload = (row: IsgkatipCompanyRow, userId: string) => {
  const companyName = normalizeImportText(row.company_name);
  const sgkNo = normalizeImportText(row.sgk_no) || null;

  if (!companyName) {
    throw new Error("Aktarılacak firmalardan birinde firma adı eksik. Lütfen İSG-KATİP senkronunu yenileyip tekrar deneyin.");
  }

  return {
    user_id: userId,
    name: companyName,
    tax_number: sgkNo,
    industry: row.nace_code || null,
    employee_count: Number(row.employee_count || 0),
    hazard_class: normalizeHazardClass(row.hazard_class),
    workplace_registration_number: sgkNo,
    sgk_workplace_number: sgkNo,
    visit_frequency: "Ayda 1 Defa",
    is_active: true,
    updated_at: new Date().toISOString(),
  };
};

const loadExistingPersonalCompanyIdentities = async (userId: string): Promise<ExistingCompanyIdentity[]> => {
  const { data, error } = await (supabase as any)
    .from("companies")
    .select("id,name,tax_number,sgk_workplace_number,workplace_registration_number")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []) as ExistingCompanyIdentity[];
};

const importRowsToPersonalCompanies = async (
  userId: string,
  rows: IsgkatipCompanyRow[],
): Promise<ImportResult> => {
  if (rows.length === 0) return { created: 0, updated: 0 };

  const existing = await loadExistingPersonalCompanyIdentities(userId);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const sgkNo = normalizeImportText(row.sgk_no);
    const companyName = normalizeImportText(row.company_name).toLocaleLowerCase("tr-TR");
    const match = existing.find((item) => {
      const identifiers = [
        item.tax_number,
        item.sgk_workplace_number,
        item.workplace_registration_number,
      ].filter(Boolean);
      if (sgkNo && identifiers.includes(sgkNo)) return true;
      return String(item.name || "").trim().toLocaleLowerCase("tr-TR") === companyName;
    });

    const payload = buildCompanyImportPayload(row, userId);

    if (match?.id) {
      const { error } = await (supabase as any)
        .from("companies")
        .update(payload)
        .eq("id", match.id)
        .eq("user_id", userId);
      if (error) throw error;
      updated += 1;
    } else {
      const { data, error } = await (supabase as any)
        .from("companies")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select("id,name,tax_number,sgk_workplace_number,workplace_registration_number")
        .single();
      if (error) throw error;
      if (data) existing.push(data);
      created += 1;
    }
  }

  return { created, updated };
};

const loadIsgbotOperations = async (organizationId?: string | null): Promise<IsgbotOperationRow[]> => {
  if (!organizationId) return [];

  const { data, error } = await (supabase as any)
    .from("isgbot_operations")
    .select("id, operation_type, operation_title, status, source, started_at, finished_at, duration_ms, input_summary, result_summary, error_message, error_code, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    if (
      error.code === "42P01" ||
      String(error.message || "").toLocaleLowerCase("tr-TR").includes("isgbot_operations")
    ) {
      throw new Error("İSGBot işlem geçmişi tablosu henüz kurulmamış. Lütfen ilgili migration dosyasını uygulayın.");
    }
    throw error;
  }
  return (data ?? []) as IsgbotOperationRow[];
};

const startClientOperation = async (
  userId: string,
  organizationId: string | null | undefined,
  input: {
    operationType: string;
    operationTitle: string;
    source?: string;
    inputSummary?: Record<string, unknown>;
  },
) => {
  if (!organizationId) return { id: null as string | null, startedAt: Date.now() };

  const startedAt = Date.now();
  const { data, error } = await (supabase as any)
    .from("isgbot_operations")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      operation_type: input.operationType,
      operation_title: input.operationTitle,
      status: "started",
      source: input.source || "web_app",
      started_at: new Date(startedAt).toISOString(),
      input_summary: input.inputSummary || {},
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("ISGBot operation log start failed:", error);
    return { id: null as string | null, startedAt };
  }

  return { id: data?.id as string | null, startedAt };
};

const finishClientOperation = async (
  operation: { id: string | null; startedAt: number } | null,
  status: "success" | "partial" | "failed",
  resultSummary?: Record<string, unknown> | null,
  errorMessage?: string | null,
) => {
  if (!operation.id) return;

  const finishedAt = Date.now();
  const { error } = await (supabase as any)
    .from("isgbot_operations")
    .update({
      status,
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: Math.max(0, finishedAt - operation.startedAt),
      result_summary: resultSummary || null,
      error_message: errorMessage || null,
    })
    .eq("id", operation.id);

  if (error) {
    console.error("ISGBot operation log finish failed:", error);
  }
};

const botFeatures: BotFeature[] = [
  {
    id: "multi-assignment",
    title: "Çoklu Atama Yap",
    description: "Personel ve firma eşleştirme ekranını güvenli ön hazırlık modunda planlayın.",
    badge: "OSGB",
    status: "Kısıtlı",
    cta: "Önizlemeyi aç",
    tone: "violet",
    icon: UserPlus,
  },
  {
    id: "contract-download",
    title: "Atama Sözleşme Raporu İndir",
    description: "Aktif veya onay bekleyen atama kayıtlarından resmi olmayan PDF raporu oluşturun.",
    badge: "Rapor PDF",
    status: "PDF",
    cta: "Raporu aç",
    tone: "blue",
    icon: FileDown,
  },
  {
    id: "contracts-need-update",
    title: "Güncellenmesi Gereken Sözleşmeler",
    description: "Uyumsuz sözleşmeleri ve önerilen yeni süreleri görüntüleyin.",
    badge: "Aktif",
    status: "Aktif",
    cta: "Kontrol et",
    tone: "amber",
    icon: RefreshCw,
  },
  {
    id: "excess-duration-update",
    title: "Fazla Süre Önizleme ve Pilot Uygulama",
    description: "Fazla süre adaylarını güvenli analiz modunda değerlendirin.",
    badge: "Önizleme",
    status: "Önizleme",
    cta: "Önizlemeyi aç",
    tone: "emerald",
    icon: Layers,
  },
  {
    id: "contract-status-report",
    title: "Hizmet Alan İşyerleri İSG Sözleşme Durumu",
    description: "İSG profesyoneli sözleşme durumunu renk skalasıyla raporlayın.",
    badge: "Rapor",
    status: "Önizleme",
    cta: "Önizlemeyi aç",
    tone: "amber",
    icon: ShieldCheck,
  },
  {
    id: "duration-analysis",
    title: "Süre Analizi",
    description: "Personellerin kalan çalışma dakikalarını ve doluluk oranlarını analiz edin.",
    badge: "Analiz",
    status: "Önizleme",
    cta: "Veriyi gör",
    tone: "rose",
    icon: TimerReset,
  },
  {
    id: "change-tracking",
    title: "İSG-KATİP Değişiklik Takibi",
    description: "Son senkron ile önceki kayıtları karşılaştırın; yeni, silinen veya değişen firmaları görün.",
    badge: "Takip",
    status: "Aktif",
    cta: "Değişiklikleri gör",
    tone: "blue",
    icon: Clock,
  },
];

const toneStyles: Record<
  FeatureTone,
  {
    icon: string;
    card: string;
    glow: string;
    badge: string;
    button: string;
  }
> = {
  violet: {
    icon: "from-violet-500 to-fuchsia-500",
    card:
      "border-violet-300/25 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 dark:border-violet-300/20 dark:from-violet-700 dark:via-fuchsia-800 dark:to-purple-950",
    glow: "shadow-violet-950/30",
    badge: "border-violet-400/30 bg-violet-500/15 text-violet-200",
    button: "bg-violet-500 hover:bg-violet-400",
  },
  blue: {
    icon: "from-blue-500 to-cyan-500",
    card:
      "border-sky-300/25 bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-600 dark:border-sky-300/20 dark:from-blue-700 dark:via-sky-800 dark:to-cyan-950",
    glow: "shadow-blue-950/30",
    badge: "border-blue-400/30 bg-blue-500/15 text-blue-200",
    button: "bg-blue-500 hover:bg-blue-400",
  },
  amber: {
    icon: "from-amber-500 to-orange-500",
    card:
      "border-orange-300/25 bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 dark:border-orange-300/20 dark:from-orange-600 dark:via-amber-800 dark:to-orange-950",
    glow: "shadow-amber-950/30",
    badge: "border-amber-400/30 bg-amber-500/15 text-amber-200",
    button: "bg-amber-500 hover:bg-amber-400",
  },
  emerald: {
    icon: "from-emerald-500 to-teal-500",
    card:
      "border-emerald-300/25 bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700 dark:border-emerald-300/20 dark:from-emerald-700 dark:via-teal-800 dark:to-green-950",
    glow: "shadow-emerald-950/30",
    badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
    button: "bg-emerald-500 hover:bg-emerald-400",
  },
  rose: {
    icon: "from-rose-500 to-pink-500",
    card:
      "border-rose-300/25 bg-gradient-to-br from-rose-600 via-pink-600 to-rose-800 dark:border-rose-300/20 dark:from-rose-700 dark:via-pink-800 dark:to-rose-950",
    glow: "shadow-rose-950/30",
    badge: "border-rose-400/30 bg-rose-500/15 text-rose-200",
    button: "bg-rose-500 hover:bg-rose-400",
  },
};

const formatSyncLabel = (value: string | null) => {
  if (!value) return "Henüz senkron yapılmadı";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Son senkron bilgisi alınamadı";

  return parsed.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const getCompanyValue = (company: IsgkatipCompanyRow, key: string, fallback = "") => {
  const value = (company as Record<string, unknown>)[key];
  return value == null || value === "" ? fallback : String(value);
};

const getRawCompanyValue = (company: IsgkatipCompanyRow, key: string) =>
  (company as Record<string, unknown>)[key];

const hasSyncedCompanyValue = (company: IsgkatipCompanyRow, key: string) => {
  const value = getRawCompanyValue(company, key);
  return value !== null && typeof value !== "undefined" && String(value).trim() !== "";
};

const sanitizePdfFileName = (value: string) =>
  value
    .replace(/[\\/:*"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 90);

const formatReportDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("tr-TR");
};

const getNumericCompanyValue = (company: IsgkatipCompanyRow, key: string) => {
  const parsed = Number((company as Record<string, unknown>)[key] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isVeryDangerousHazard = (hazardClass: string) => {
  const normalized = hazardClass.toLocaleLowerCase("tr-TR");
  return normalized.includes("çok") || normalized.includes("cok");
};

const getTruthySyncedValue = (company: IsgkatipCompanyRow, key: string): boolean | null => {
  const value = getRawCompanyValue(company, key);
  if (value === null || typeof value === "undefined" || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLocaleLowerCase("tr-TR");
  if (["true", "1", "evet", "var", "yes", "active", "aktif"].includes(normalized)) return true;
  if (["false", "0", "hayır", "hayir", "yok", "no", "pasif"].includes(normalized)) return false;
  return null;
};

const getContractStatusText = (company: IsgkatipCompanyRow) => {
  const raw = getCompanyValue(company, "contract_status", "Aktif");
  if (!raw || raw === "Aktif") return "Aktif sözleşme";
  const normalized = raw.toLocaleLowerCase("tr-TR");
  if (normalized.includes("onay") || normalized.includes("pending") || normalized.includes("bekl")) {
    return "Onay bekleyen atama";
  }
  return raw;
};

const isPendingAssignment = (company: IsgkatipCompanyRow) => {
  const status = getContractStatusText(company).toLocaleLowerCase("tr-TR");
  return status.includes("onay") || status.includes("bekl") || status.includes("pending");
};

const getDurationComplianceText = (company: IsgkatipCompanyRow) => {
  const assigned = getNumericCompanyValue(company, "assigned_minutes");
  const required = getNumericCompanyValue(company, "required_minutes");
  const diff = assigned - required;
  if (!required) return "Gerekli süre hesaplanmamış";
  if (diff === 0) return "Asgari süre tam karşılanıyor";
  if (diff > 0) return `Asgari süreden ${diff} dk fazla`;
  return `Asgari süreden ${Math.abs(diff)} dk eksik`;
};

const prettifyTechnicalCode = (code: string) =>
  code
    .replace(/_/g, " ")
    .toLocaleLowerCase("tr-TR")
    .replace(/^\p{L}/u, (char) => char.toLocaleUpperCase("tr-TR"));

const getContractIssueLabel = (code?: string): string => {
  switch ((code || "").toLocaleUpperCase("tr-TR")) {
    case "DURATION_CHECK":
      return "Süre kontrolü gerekli";
    case "CONTRACT_STATUS_CHECK":
      return "Sözleşme durumu kontrolü gerekli";
    case "MISSING_END_DATE":
    case "MISSING_CONTRACT_END":
      return "Sözleşme bitiş tarihi eksik";
    case "MISSING_START_DATE":
    case "MISSING_CONTRACT_START":
      return "Sözleşme başlangıç tarihi eksik";
    case "EXPIRED_CONTRACT":
      return "Sözleşme süresi dolmuş";
    case "MISSING_CONTRACT":
      return "Sözleşme kaydı bulunamadı";
    case "PENDING_APPROVAL":
      return "Onay bekleyen sözleşme";
    case "PENDING_PERSONNEL_APPROVAL":
      return "Personel onayı bekleniyor";
    case "PENDING_COMPANY_APPROVAL":
      return "İşyeri onayı bekleniyor";
    case "MISSING_DSP":
      return "DSP bilgisi eksik";
    case "MISSING_PHYSICIAN":
      return "İşyeri hekimi bilgisi eksik";
    case "MISSING_SAFETY_EXPERT":
      return "İSG uzmanı bilgisi eksik";
    case "EMPLOYEE_COUNT_CHANGED":
      return "Çalışan sayısı değişmiş olabilir";
    case "HAZARD_CLASS_CHANGED":
      return "Tehlike sınıfı değişmiş olabilir";
    case "ASSIGNED_MINUTES_LOW":
      return "Atanmış süre gerekli süreden düşük";
    case "ASSIGNED_MINUTES_HIGH":
      return "Atanmış süre gerekli süreden fazla";
    case "DATA_MISSING":
      return "Gerekli veri eksik";
    case "UNKNOWN":
      return "Kontrol gerekli";
    default:
      return code ? prettifyTechnicalCode(code) : "Kontrol gerekli";
  }
};

const analyzeDurationRows = (companies: IsgkatipCompanyRow[]): DurationAnalysisRow[] =>
  companies.map((company, index) => {
    const hasAssigned = hasSyncedCompanyValue(company, "assigned_minutes");
    const hasRequired = hasSyncedCompanyValue(company, "required_minutes");
    const assignedMinutes = getNumericCompanyValue(company, "assigned_minutes");
    const requiredMinutes = getNumericCompanyValue(company, "required_minutes");
    const diffMinutes = assignedMinutes - requiredMinutes;
    const companyName = getCompanyValue(company, "company_name", `Firma ${index + 1}`);
    const hazardClass = getCompanyValue(company, "hazard_class", "-");
    const employeeCount = getNumericCompanyValue(company, "employee_count");

    if (!hasAssigned || !hasRequired || requiredMinutes <= 0) {
      return {
        id: company.id,
        companyName,
        sgkNo: getCompanyValue(company, "sgk_no", "-"),
        hazardClass,
        employeeCount,
        assignedMinutes,
        requiredMinutes,
        diffMinutes: 0,
        ratio: null,
        status: "missing",
        statusLabel: "Hesaplanamadı",
        recommendation: "Gerekli dakika ve atanmış dakika bilgileri İSG-KATİP senkron verisinde bulunmalıdır.",
      };
    }

    if (diffMinutes < 0) {
      const critical = assignedMinutes < requiredMinutes * 0.8;
      return {
        id: company.id,
        companyName,
        sgkNo: getCompanyValue(company, "sgk_no", "-"),
        hazardClass,
        employeeCount,
        assignedMinutes,
        requiredMinutes,
        diffMinutes,
        ratio: Math.round((assignedMinutes / requiredMinutes) * 100),
        status: critical ? "critical" : "deficit",
        statusLabel: critical ? "Kritik Eksik" : "Eksik Süre",
        recommendation: `${Math.abs(diffMinutes)} dk/ay ek atama veya sözleşme süre kontrolü önerilir.`,
      };
    }

    if (diffMinutes > 0) {
      return {
        id: company.id,
        companyName,
        sgkNo: getCompanyValue(company, "sgk_no", "-"),
        hazardClass,
        employeeCount,
        assignedMinutes,
        requiredMinutes,
        diffMinutes,
        ratio: Math.round((assignedMinutes / requiredMinutes) * 100),
        status: "excess",
        statusLabel: "Fazla Atama",
        recommendation: `${diffMinutes} dk/ay fazla atama görünüyor; manuel kontrol önerilir.`,
      };
    }

    return {
      id: company.id,
      companyName,
      sgkNo: getCompanyValue(company, "sgk_no", "-"),
      hazardClass,
      employeeCount,
      assignedMinutes,
      requiredMinutes,
      diffMinutes,
      ratio: 100,
      status: "compliant",
      statusLabel: "Tam Uyumlu",
      recommendation: "Mevcut süre asgari gereklilikle uyumlu görünüyor.",
    };
  });

const buildContractUpdateCandidates = (
  companies: IsgkatipCompanyRow[],
  flags: IsgkatipFlagRow[],
): ContractUpdateCandidate[] => {
  const candidates = new Map<string, ContractUpdateCandidate>();
  const companyById = new Map(companies.map((company) => [company.id, company]));

  flags
    .filter((flag) => String((flag as Record<string, unknown>).status || "OPEN").toLocaleUpperCase("tr-TR") === "OPEN")
    .forEach((flag) => {
      const companyId = String((flag as Record<string, unknown>).company_id || "");
      const company = companyById.get(companyId);
      if (!company) return;
      const issueCode = String((flag as Record<string, unknown>).rule_name || flag.id || "");
      const assigned = getNumericCompanyValue(company, "assigned_minutes");
      const required = getNumericCompanyValue(company, "required_minutes");
      const diff = assigned - required;

      let reason = String((flag as Record<string, unknown>).message || "Uyum bayrağı açık görünüyor.");
      let recommendation = "İSG-KATİP sözleşme ve süre bilgisi manuel kontrol edilmelidir.";

      if (issueCode.toLocaleUpperCase("tr-TR") === "DURATION_CHECK") {
        if (hasSyncedCompanyValue(company, "assigned_minutes") && hasSyncedCompanyValue(company, "required_minutes")) {
          if (assigned < required) {
            reason = "Atanmış süre gerekli süreden düşük görünüyor.";
          } else if (assigned > required) {
            reason = "Atanmış süre gerekli süreden fazla görünüyor.";
          } else {
            reason = "Sözleşme süresi mevzuat koşullarına göre yeniden kontrol edilmelidir.";
          }
        } else {
          reason = "Sözleşme süresi mevzuat koşullarına göre yeniden kontrol edilmelidir.";
        }
        recommendation = "Sözleşme süresini çalışan sayısı ve tehlike sınıfına göre yeniden kontrol edin.";
      }

      candidates.set(`${company.id}-flag-${issueCode}`, {
        id: `${company.id}-flag-${issueCode}`,
        companyName: getCompanyValue(company, "company_name", "Firma"),
        sgkNo: getCompanyValue(company, "sgk_no", "-"),
        currentStatus: getContractStatusText(company),
        issueCode,
        issue: getContractIssueLabel(issueCode),
        reason,
        severity: String((flag as Record<string, unknown>).severity || "WARNING").toLocaleUpperCase("tr-TR") as ContractUpdateCandidate["severity"],
        recommendation,
        source: "Uyum bayrağı",
      });
    });

  companies.forEach((company) => {
    const companyName = getCompanyValue(company, "company_name", "Firma");
    const sgkNo = getCompanyValue(company, "sgk_no", "-");
    const currentStatus = hasSyncedCompanyValue(company, "contract_status") ? getContractStatusText(company) : "Veri yok";
    const contractEnd = getCompanyValue(company, "contract_end");
    const assigned = getNumericCompanyValue(company, "assigned_minutes");
    const required = getNumericCompanyValue(company, "required_minutes");
    const statusLower = currentStatus.toLocaleLowerCase("tr-TR");
    const baseId = company.id;

    const addCandidate = (suffix: string, candidate: Omit<ContractUpdateCandidate, "id" | "companyName" | "sgkNo" | "currentStatus" | "source">) => {
      const id = `${baseId}-basic-${suffix}`;
      if (candidates.has(id)) return;
      candidates.set(id, {
        id,
        companyName,
        sgkNo,
        currentStatus,
        source: "Temel kontrol",
        ...candidate,
      });
    };

    if (!contractEnd) {
      addCandidate("missing-end", {
        issue: "Sözleşme bitiş tarihi yok",
        reason: "Sözleşme bitiş tarihi senkron verisinde bulunmuyor.",
        severity: "WARNING",
        recommendation: "Sözleşme tarihleri İSG-KATİP üzerinden kontrol edilmeli.",
      });
    } else {
      const endDate = new Date(contractEnd);
      if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
        addCandidate("expired", {
          issue: "Sözleşme bitmiş",
          reason: `Sözleşme bitiş tarihi ${formatReportDate(contractEnd)} görünüyor.`,
          severity: "CRITICAL",
          recommendation: "Sözleşme yenileme veya yeni atama süreci kontrol edilmeli.",
        });
      }
    }

    if (hasSyncedCompanyValue(company, "assigned_minutes") && hasSyncedCompanyValue(company, "required_minutes")) {
      if (required > assigned) {
        addCandidate("duration-deficit", {
          issue: "Eksik süre",
          reason: `Atanmış süre gerekli süreden ${required - assigned} dk eksik.`,
          severity: required - assigned >= 30 ? "CRITICAL" : "WARNING",
          recommendation: "Atama dakikaları veya çalışan sayısına göre gerekli süre yeniden kontrol edilmeli.",
        });
      } else if (assigned > required) {
        addCandidate("duration-excess", {
          issue: "Fazla atama",
          reason: `Atanmış süre gerekli süreden ${assigned - required} dk fazla.`,
          severity: "INFO",
          recommendation: "Fazla atama verisi manuel doğrulanmalı; otomatik güncelleme yapılmaz.",
        });
      }
    }

    if (statusLower.includes("onay") || statusLower.includes("bekl") || statusLower.includes("pending")) {
      addCandidate("pending-status", {
        issue: "Onay bekleyen sözleşme",
        reason: "Sözleşme onay bekliyor.",
        severity: "WARNING",
        recommendation: "Personel/işyeri onay durumu İSG-KATİP üzerinde takip edilmeli.",
      });
    }

    if (!hasSyncedCompanyValue(company, "contract_status")) {
      addCandidate("missing-status", {
        issue: "Sözleşme durumu eksik",
        reason: "Sözleşme durumu senkron verisinde bulunmuyor.",
        severity: "WARNING",
        recommendation: "Sözleşme durumu İSG-KATİP üzerinde manuel doğrulanmalı.",
      });
    }
  });

  return [...candidates.values()].sort((first, second) => {
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return order[first.severity] - order[second.severity];
  });
};

const buildContractStatusRows = (companies: IsgkatipCompanyRow[]): ContractStatusReportRow[] =>
  companies.map((company, index) => {
    const companyName = getCompanyValue(company, "company_name", `Firma ${index + 1}`);
    const sgkNo = getCompanyValue(company, "sgk_no", "-");
    const employeeCount = getNumericCompanyValue(company, "employee_count");
    const hazardClass = getCompanyValue(company, "hazard_class", "-");
    const rawStatus = getCompanyValue(company, "contract_status", "");
    const statusText = rawStatus ? getContractStatusText(company) : "";
    const normalizedStatus = statusText.toLocaleLowerCase("tr-TR");
    const physicianValue = getTruthySyncedValue(company, "has_physician");
    const dspValue = getTruthySyncedValue(company, "has_dsp");
    const expertValue = getTruthySyncedValue(company, "has_safety_expert");
    const dspRequired = isVeryDangerousHazard(hazardClass) && employeeCount >= 10;

    let color: ContractStatusColor = "purple";
    let overallStatus = "Hesaplanamayan / veri eksik";
    let missingField = "Sözleşme durumu";
    let recommendation = "Senkron verisinde sözleşme durumu net değil; İSG-KATİP üzerinden kontrol edin.";

    if (normalizedStatus.includes("yok") || normalizedStatus.includes("none") || normalizedStatus.includes("sözleşmesi yok")) {
      color = "red";
      overallStatus = "İSG profesyoneli sözleşmesi yok";
      missingField = "İSG profesyoneli sözleşmesi";
      recommendation = "Yetkili kişi İSG-KATİP sözleşme durumunu manuel kontrol etmelidir.";
    } else if (normalizedStatus.includes("personel") && (normalizedStatus.includes("onay") || normalizedStatus.includes("bekl"))) {
      color = "gray";
      overallStatus = "Personel onayı bekleniyor";
      missingField = "Personel onayı";
      recommendation = "Personel onay süreci takip edilmelidir.";
    } else if ((normalizedStatus.includes("işyeri") || normalizedStatus.includes("isyeri")) && (normalizedStatus.includes("onay") || normalizedStatus.includes("bekl"))) {
      color = "yellow";
      overallStatus = "İşyeri onayı bekleniyor";
      missingField = "İşyeri onayı";
      recommendation = "İşyeri onay süreci takip edilmelidir.";
    } else if (normalizedStatus.includes("aktif") || normalizedStatus.includes("active") || normalizedStatus.includes("tam") || normalizedStatus.includes("onaylı") || normalizedStatus.includes("onayli")) {
      color = "green";
      overallStatus = "Tam onaylı";
      missingField = "-";
      recommendation = "Aktif izleme yeterli; periyodik süre kontrollerini sürdürün.";
    }

    const safetyExpertStatus = expertValue === null ? (color === "green" ? "Var" : color === "red" ? "Yok" : "Veri yok") : expertValue ? "Var" : "Yok";
    const physicianStatus = physicianValue === null ? "Veri yok" : physicianValue ? "Var" : "Yok";
    const dspStatus = dspRequired
      ? dspValue === null
        ? "DSP verisi senkron kaydında bulunmuyor"
        : dspValue
          ? "Var"
          : "Eksik"
      : "Gerekli değil";

    return {
      id: company.id,
      companyName,
      sgkNo,
      employeeCount,
      hazardClass,
      safetyExpertStatus,
      physicianStatus,
      dspStatus,
      overallStatus,
      color,
      missingField,
      recommendation,
    };
  });

const downloadCsv = (fileName: string, rows: Array<Record<string, string | number>>) => {
  if (rows.length === 0) {
    toast.error("CSV oluşturmak için rapor satırı bulunamadı.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.map(escape).join(";"),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(";")),
  ].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const drawContractReportPdf = (rows: IsgkatipCompanyRow[]) => {
  if (rows.length === 0) {
    toast.error("PDF oluşturmak için en az bir firma seçin.");
    return;
  }

  try {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const interLoaded = addInterFontsToJsPDF(doc);
    const fontFamily = interLoaded ? "Inter" : "helvetica";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 34;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const setText = (size: number, color: [number, number, number], style: "normal" | "bold" = "normal") => {
      doc.setFont(fontFamily, style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
    };

    const drawFooter = () => {
      const footerY = pageHeight - 18;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12);
      setText(7, [100, 116, 139]);
      doc.text("İSGVİZYON Bot | İSG-KATİP Atama Sözleşmeleri Raporu", margin, footerY);
      doc.text(`Sayfa ${doc.getNumberOfPages()}`, pageWidth - margin, footerY, { align: "right" });
    };

    const addPageIfNeeded = (height: number) => {
      if (y + height <= pageHeight - 48) return;
      drawFooter();
      doc.addPage();
      y = margin;
    };

    const drawTitlePage = () => {
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, contentWidth, 98, 12, 12, "F");
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(margin + contentWidth - 138, y + 18, 104, 28, 9, 9, "F");
      setText(8, [255, 255, 255], "bold");
      doc.text("GÜNCEL RAPOR", margin + contentWidth - 86, y + 36, { align: "center" });
      setText(20, [255, 255, 255], "bold");
      doc.text("Toplu Atama Sözleşmeleri", margin + 22, y + 38);
      setText(10, [203, 213, 225]);
      doc.text("İSG-KATİP verilerine göre güncel firma ve atama süre raporu", margin + 22, y + 62);
      doc.text(`Oluşturma tarihi: ${new Date().toLocaleString("tr-TR")}`, margin + 22, y + 80);
      y += 120;

      const activeCount = rows.filter((row) => !isPendingAssignment(row)).length;
      const pendingCount = rows.length - activeCount;
      const totalEmployees = rows.reduce((sum, row) => sum + getNumericCompanyValue(row, "employee_count"), 0);
      const totalAssigned = rows.reduce((sum, row) => sum + getNumericCompanyValue(row, "assigned_minutes"), 0);
      const totalRequired = rows.reduce((sum, row) => sum + getNumericCompanyValue(row, "required_minutes"), 0);
      const summary = [
        ["Firma", rows.length],
        ["Aktif", activeCount],
        ["Onay Bekleyen", pendingCount],
        ["Çalışan", totalEmployees],
        ["Atanan dk", totalAssigned],
        ["Gerekli dk", totalRequired],
      ];

      const cardW = (contentWidth - 20) / 3;
      summary.forEach(([label, value], index) => {
        const x = margin + (index % 3) * (cardW + 10);
        const rowY = y + Math.floor(index / 3) * 62;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, rowY, cardW, 50, 10, 10, "FD");
        setText(7, [100, 116, 139], "bold");
        doc.text(String(label).toLocaleUpperCase("tr-TR"), x + 12, rowY + 17);
        setText(16, [15, 23, 42], "bold");
        doc.text(String(value), x + 12, rowY + 37);
      });
      y += 138;

      setText(12, [15, 23, 42], "bold");
      doc.text("Firma Özeti", margin, y);
      y += 12;

      const headers = ["Firma", "SGK Sicil", "Tehlike", "Çalışan", "Durum"];
      const widths = [160, 92, 82, 52, contentWidth - 386];
      doc.setFillColor(30, 64, 175);
      doc.rect(margin, y, contentWidth, 20, "F");
      let x = margin;
      setText(7, [255, 255, 255], "bold");
      headers.forEach((header, index) => {
        doc.text(header, x + 5, y + 13);
        x += widths[index];
      });
      y += 20;

      rows.slice(0, 18).forEach((company, index) => {
        addPageIfNeeded(24);
          doc.setFillColor(index % 2 === 0 ? 248 : 241, index % 2 === 0 ? 250 : 245, index % 2 === 0 ? 252 : 249);
        doc.rect(margin, y, contentWidth, 22, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, y, contentWidth, 22);
        x = margin;
        const cells = [
          getCompanyValue(company, "company_name", "Firma"),
          getCompanyValue(company, "sgk_no", "-"),
          getCompanyValue(company, "hazard_class", "-"),
          String(getNumericCompanyValue(company, "employee_count")),
          getDurationComplianceText(company),
        ];
        setText(6.8, [30, 41, 59]);
        cells.forEach((cell, cellIndex) => {
          const lines = doc.splitTextToSize(cell, widths[cellIndex] - 8) as string[];
          doc.text(lines.slice(0, 2), x + 5, y + 8);
          x += widths[cellIndex];
        });
        y += 22;
      });

      if (rows.length > 18) {
        y += 8;
        setText(8, [100, 116, 139]);
        doc.text(`Not: ${rows.length - 18} firma detay sayfalarında ayrıca listelenmiştir.`, margin, y);
        y += 14;
      }
    };

    const drawField = (label: string, value: string, x: number, fieldY: number, width: number) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, fieldY, width, 42, 8, 8, "FD");
      setText(6.5, [100, 116, 139], "bold");
      doc.text(label.toLocaleUpperCase("tr-TR"), x + 8, fieldY + 13);
      setText(8.5, [15, 23, 42], "bold");
      const lines = doc.splitTextToSize(value || "-", width - 16) as string[];
      doc.text(lines.slice(0, 2), x + 8, fieldY + 28);
    };

    const drawCompanyDetail = (company: IsgkatipCompanyRow, index: number) => {
      drawFooter();
      doc.addPage();
      y = margin;

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, contentWidth, 58, 10, 10, "F");
      setText(8, [147, 197, 253], "bold");
      doc.text(`FİRMA RAPORU #${index + 1}`, margin + 18, y + 18);
      setText(15, [255, 255, 255], "bold");
      const titleLines = doc.splitTextToSize(getCompanyValue(company, "company_name", "Firma"), contentWidth - 36) as string[];
      doc.text(titleLines.slice(0, 2), margin + 18, y + 39);
      y += 76;

      const colW = (contentWidth - 12) / 2;
      const fields = [
        ["SGK Sicil No", getCompanyValue(company, "sgk_no", "-")],
        ["NACE Kodu", getCompanyValue(company, "nace_code", "-")],
        ["Tehlike Sınıfı", getCompanyValue(company, "hazard_class", "-")],
        ["Çalışan Sayısı", String(getNumericCompanyValue(company, "employee_count"))],
        ["Sözleşme Başlangıcı", formatReportDate(getCompanyValue(company, "contract_start"))],
        ["Sözleşme Bitişi", formatReportDate(getCompanyValue(company, "contract_end"))],
        ["Atanan Süre", `${getNumericCompanyValue(company, "assigned_minutes")} dk/ay`],
        ["Gerekli Süre", `${getNumericCompanyValue(company, "required_minutes")} dk/ay`],
        ["Sözleşme Durumu", getContractStatusText(company)],
        ["Süre Uyum Durumu", getDurationComplianceText(company)],
      ];

      fields.forEach(([label, value], fieldIndex) => {
        const x = margin + (fieldIndex % 2) * (colW + 12);
        const fieldY = y + Math.floor(fieldIndex / 2) * 52;
        drawField(label, value, x, fieldY, colW);
      });
      y += Math.ceil(fields.length / 2) * 52 + 14;

      const assigned = getNumericCompanyValue(company, "assigned_minutes");
      const required = getNumericCompanyValue(company, "required_minutes");
      const ratio = required > 0 ? Math.min(1.25, assigned / required) : 0;
      const barWidth = contentWidth;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y, barWidth, 50, 10, 10, "F");
      setText(9, [15, 23, 42], "bold");
      doc.text("Atama Süresi Uyum Göstergesi", margin + 12, y + 17);
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin + 12, y + 29, barWidth - 24, 8, 4, 4, "F");
      doc.setFillColor(ratio >= 1 ? 16 : 245, ratio >= 1 ? 185 : 158, ratio >= 1 ? 129 : 11);
      doc.roundedRect(margin + 12, y + 29, Math.max(4, Math.min(barWidth - 24, (barWidth - 24) * ratio)), 8, 4, 4, "F");
      setText(7, [71, 85, 105]);
      doc.text(`${assigned} dk atandı / ${required || 0} dk gerekli`, margin + 12, y + 45);
      y += 66;

      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(margin, y, contentWidth, 62, 10, 10, "FD");
      setText(9, [30, 64, 175], "bold");
      doc.text("Profesyonel Değerlendirme", margin + 12, y + 18);
      setText(8, [30, 41, 59]);
      const note = `Bu rapor, İSG-KATİP üzerinden aktarılan güncel verilere göre hazırlanmıştır. Firma için sözleşme durumu, çalışan sayısı ve atama dakikaları kontrol edilerek asgari süre uyumu değerlendirilmelidir.`;
      doc.text(doc.splitTextToSize(note, contentWidth - 24), margin + 12, y + 35);
    };

    drawTitlePage();
    rows.forEach(drawCompanyDetail);
    drawFooter();

      const fileName =
        rows.length === 1
          ? `ISG_KATIP_Atama_Sozlesmesi_${sanitizePdfFileName(getCompanyValue(rows[0], "company_name", "Firma"))}.pdf`
          : `ISG_KATIP_Toplu_Atama_Sozlesmeleri_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    toast.success("PDF raporu hazırlandı", { description: `${rows.length} firma rapora eklendi.` });
  } catch (error) {
    console.error("Contract PDF export failed:", error);
    toast.error("PDF raporu oluşturulurken bir hata oluştu.");
  }
};

function BotFeatureCard({
  feature,
  onClick,
}: {
  feature: BotFeature;
  onClick: (feature: BotFeature) => void;
}) {
  const Icon = feature.icon;
  const styles = toneStyles[feature.tone];

  return (
    <button
      type="button"
      onClick={() => onClick(feature)}
      className={cn(
        "group relative flex min-h-[175px] w-full flex-col overflow-hidden rounded-2xl border p-5 text-left text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.24)] focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#0B1220] dark:shadow-[0_18px_60px_rgba(2,8,23,0.55)] dark:hover:shadow-[0_24px_75px_rgba(2,8,23,0.72)]",
        styles.card,
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/18 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-black/10 blur-3xl" />

      <div className="relative z-10 mb-4 flex items-start justify-between gap-4">
        <div className="rounded-xl border border-white/20 bg-white/16 p-2.5 text-white shadow-sm backdrop-blur">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className="border-white/20 bg-white/18 text-white shadow-sm backdrop-blur">
            {feature.badge}
          </Badge>
          <span className="rounded-full border border-white/15 bg-white/12 px-2.5 py-1 text-[10px] font-bold text-white/90 shadow-sm backdrop-blur">
            {feature.status}
          </span>
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1">
        <h3 className="text-base font-extrabold tracking-tight text-white">{feature.title}</h3>
        <p className="mt-1.5 line-clamp-2 min-h-[40px] text-xs font-medium leading-relaxed text-white/82">
          {feature.description}
        </p>
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-between gap-3">
        <span className="inline-flex h-8 items-center px-0 text-xs font-extrabold text-white transition group-hover:text-white/85">
          {feature.cta}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </span>
        <span className="rounded-full border border-white/15 bg-white/16 px-3 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur">
          Aç
        </span>
      </div>
    </button>
  );
}

function StatusAlert({
  loading,
  error,
  info,
  success,
  onRetry,
}: FeatureRuntimeState & {
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-blue-100">
        <Loader2 className="h-5 w-5 animate-spin" />
        <div>
          <p className="font-bold">İşlem hazırlanıyor</p>
          <p className="text-sm text-blue-100/75">İSG-KATİP bağlantısı ve aktarım verileri kontrol ediliyor.</p>
        </div>
      </div>
    );
  }

  if (error) {
    const friendlyError = getIsgbotFriendlyErrorMessage(error, error);
    return (
      <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4 text-rose-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1">
            <p className="font-black">Hata Oluştu</p>
            <p className="mt-1 text-sm leading-6 text-rose-100/80">{friendlyError}</p>
            {onRetry && (
              <Button
                type="button"
                size="sm"
                className="mt-3 rounded-xl bg-rose-500 text-white hover:bg-rose-400"
                onClick={onRetry}
              >
                Tekrar Dene
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (info) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4 text-blue-50">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
        <div>
          <p className="font-black">Bilgilendirme</p>
          <p className="mt-1 text-sm leading-6 text-blue-100/80">{info}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-50">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        <div>
          <p className="font-black">İşlem Tamamlandı</p>
          <p className="mt-1 text-sm leading-6 text-emerald-100/80">{success}</p>
        </div>
      </div>
    );
  }

  return null;
}

function EmptyState({ title, description, icon: Icon = Sparkles }: { title: string; description: string; icon: typeof Sparkles }) {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/90 p-6 text-center shadow-lg shadow-black/30">
      <div>
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-slate-300 ring-1 ring-white/10">
          <Icon className="h-5 w-5" />
        </div>
        <p className="font-black text-slate-100">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "blue" | "emerald" | "amber" | "rose" | "slate";
}) {
  const toneClass = {
    blue: "border-blue-400/25 bg-blue-500/10 text-blue-100",
    emerald: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-100",
    rose: "border-rose-400/25 bg-rose-500/10 text-rose-100",
    slate: "border-slate-500/35 bg-slate-800/70 text-slate-100",
  }[tone];

  return (
    <div className={cn("rounded-xl border p-3", toneClass)}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function MultiAssignmentPanel({
  companies,
  onRecordDryRun,
}: {
  companies: IsgkatipCompanyRow[];
  onRecordDryRun: (result: MultiAssignmentDryRunResult) => void;
}) {
  const [personnelText, setPersonnelText] = useState("");
  const [personnel, setPersonnel] = useState<IsgbotPersonnel[]>([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [sgkText, setSgkText] = useState("");
  const [parsedSgkInputs, setParsedSgkInputs] = useState<ReturnType<typeof parseSgkNumbers>>([]);
  const [plan, setPlan] = useState<MultiAssignmentDryRunResult | null>(null);

  const invalidSgkInputs = parsedSgkInputs.filter((input) => !input.valid);
  const validSgkNumbers = parsedSgkInputs.filter((input) => input.valid).map((input) => input.normalized);
  const matchPreview = useMemo(
    () => (validSgkNumbers.length ? buildMultiAssignmentPlan(companies, validSgkNumbers, personnel, selectedPersonnelId).matches : []),
    [companies, personnel, selectedPersonnelId, validSgkNumbers],
  );

  const handleParsePersonnel = () => {
    const result = parsePersonnelText(personnelText);
    setPersonnel(result.personnel);
    setSelectedPersonnelId(result.personnel[0]?.id ?? null);
    setPlan(null);

    if (!personnelText.trim()) {
      toast.error("Personel listesi boş.", {
        description: "Her satıra personel bilgisi ekleyin. Örn: Ad Soyad, TC, Rol, Belge No",
      });
      return;
    }

    if (result.personnel.length === 0) {
      toast.error("Personel okunamadı.", {
        description: "CSV/text formatını kontrol edip tekrar deneyin.",
      });
      return;
    }

    toast.success("Personel listesi hazırlandı", {
      description: `${result.personnel.length} personel okundu; ${result.invalidRows.length} satır uyarılı.`,
    });
  };

  const handleParseSgk = () => {
    const parsed = parseSgkNumbers(sgkText);
    setParsedSgkInputs(parsed);
    setPlan(null);

    if (!sgkText.trim() || parsed.length === 0) {
      toast.error("SGK sicil numarası girilmedi.");
      return;
    }

    toast.success("SGK listesi hazırlandı", {
      description: `${parsed.filter((input) => input.valid).length} geçerli SGK no; ${parsed.filter((input) => !input.valid).length} uyarı.`,
    });
  };

  const handleBuildPlan = () => {
    if (validSgkNumbers.length === 0) {
      toast.error("SGK sicil numarası girilmedi.");
      return;
    }

    if (personnel.length === 0 || !selectedPersonnelId) {
      toast.error("Personel seçilmedi.", {
        description: "Önce personel listesini ekleyip bir personel seçin.",
      });
      return;
    }

    const result = buildMultiAssignmentPlan(companies, validSgkNumbers, personnel, selectedPersonnelId);
    result.invalidInputs = invalidSgkInputs;
    result.parsedSgk = parsedSgkInputs;
    result.summary.invalid_input_count = invalidSgkInputs.length;
    result.summary.warning_count += invalidSgkInputs.length;
    setPlan(result);
    onRecordDryRun(result);

    const hasWarnings = result.summary.warning_count > 0 || result.summary.unmatched_sgk_count > 0;
    toast(hasWarnings ? "Atama önizlemesi uyarılı oluşturuldu" : "Atama önizlemesi oluşturuldu", {
      description: `${result.summary.planned_assignment_count} plan satırı hazırlandı. Gerçek İSG-KATİP ataması yapılmadı.`,
    });
  };

  const handleExportPlan = () => {
    if (!plan?.planRows.length) {
      toast.error("CSV için önce önizleme planı oluşturun.");
      return;
    }

    downloadCsv(
      `isgvizyon-coklu-atama-onizleme-${new Date().toISOString().slice(0, 10)}.csv`,
      plan.planRows.map((row) => ({
        Rapor: "İSGVİZYON Çoklu Atama Önizleme Raporu",
        "Firma Adı": row.companyName,
        "SGK No": row.sgkNo,
        "Personel": row.personnelName,
        "Rol": row.personnelRole,
        "Önerilen Dakika": row.suggestedMinutes,
        "Durum": row.status,
        Uyarılar: row.warnings.join(" | ") || "-",
      })),
    );
  };

  const clearPlan = () => setPlan(null);

  return (
    <div className="space-y-4">
      <Alert className="border-amber-400/25 bg-amber-500/10 text-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-300" />
        <AlertTitle>Önizleme Modu · Gerçek işlem yapılmaz</AlertTitle>
        <AlertDescription className="text-amber-100/80">
          Bu işlem İSG-KATİP üzerinde gerçek atama yapmaz. Sadece personel/firma eşleştirmesi, uyarı kontrolü ve önizleme planı oluşturur.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-black text-white">Personel Seçimi</h4>
              <Users className="h-4 w-4 text-violet-300" />
            </div>
            <Textarea
              value={personnelText}
              onChange={(event) => setPersonnelText(event.target.value)}
              className="min-h-[118px] border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500"
              placeholder={"Ad Soyad, TC, Rol, Belge No\nTC - Ad Soyad - Rol\nveya sadece TC"}
            />
            <Button className="mt-3 w-full rounded-xl bg-violet-500 text-white hover:bg-violet-400" onClick={handleParsePersonnel}>
              <Upload className="mr-2 h-4 w-4" />
              Personel Listesi Yükle
            </Button>
            {personnel.length > 0 && (
              <div className="mt-3 space-y-2">
                <Label className="text-xs text-slate-300">Atanacak personel</Label>
                <select
                  value={selectedPersonnelId ?? ""}
                  onChange={(event) => {
                    setSelectedPersonnelId(event.target.value || null);
                    setPlan(null);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-violet-400"
                >
                  {personnel.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName} · {person.role} · Kalan {person.remainingCapacityMinutes} dk
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
            <h4 className="mb-3 font-black text-white">SGK Sicil Numarası Giriş</h4>
            <Textarea
              value={sgkText}
              onChange={(event) => setSgkText(event.target.value)}
              className="min-h-[150px] border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500"
              placeholder="SGK sicil numaralarını yapıştırın veya yazın..."
            />
            <Button className="mt-3 w-full rounded-xl bg-violet-500 text-white hover:bg-violet-400" onClick={handleParseSgk}>
              Sicil Numaralarını Ekle
            </Button>
            {invalidSgkInputs.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                {invalidSgkInputs.slice(0, 4).map((input) => (
                  <p key={`${input.raw}-${input.reason}`}>{input.raw}: {input.reason}</p>
                ))}
                {invalidSgkInputs.length > 4 && <p>+{invalidSgkInputs.length - 4} uyarı daha</p>}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
          <h4 className="mb-3 font-black text-white">Firma Listesi</h4>
          {matchPreview.length === 0 ? (
            <EmptyState
              title="Henüz firma sorgulanmadı"
              description="SGK numaralarını ekleyip sorgulayın."
              icon={ShieldCheck}
            />
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {matchPreview.map((match) => (
                <div key={match.sgkNo} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{match.company?.company_name || match.sgkNo}</p>
                      <p className="mt-1 text-xs text-slate-400">SGK: {match.sgkNo}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 rounded-full",
                        match.status === "matched" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
                        match.status !== "matched" && "border-amber-400/30 bg-amber-500/10 text-amber-200",
                      )}
                    >
                      {match.status === "matched" ? "Bulundu" : match.status === "unmatched" ? "Bulunamadı" : match.status === "passive" ? "Pasif" : "Veri Eksik"}
                    </Badge>
                  </div>
                  {match.company && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <span>Çalışan: {match.company.employee_count ?? "-"}</span>
                      <span>Tehlike: {match.company.hazard_class || "-"}</span>
                      <span className="col-span-2">Sözleşme: {match.company.contract_status || "Veri yok"}</span>
                    </div>
                  )}
                  {match.warning && <p className="mt-2 text-xs text-amber-200">{match.warning}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-black text-white">Atama Planı ({plan?.planRows.length ?? 0})</h4>
            <Badge className="rounded-full bg-violet-500/15 text-violet-200 hover:bg-violet-500/15">Dry-Run</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <MetricTile label="Toplam Firma" value={plan?.summary.parsed_sgk_count ?? validSgkNumbers.length} tone="blue" />
            <MetricTile label="Planlanabilir" value={plan?.planRows.filter((row) => row.status === "Planlanabilir").length ?? 0} tone="emerald" />
            <MetricTile label="Uyarılı" value={plan?.planRows.filter((row) => row.status === "Uyarılı").length ?? 0} tone="amber" />
            <MetricTile label="Kapasite Yetersiz" value={plan?.summary.capacity_insufficient_count ?? 0} tone="rose" />
            <MetricTile label="Veri Eksik" value={plan?.summary.missing_data_count ?? 0} tone="slate" />
            <MetricTile label="Bulunamayan" value={plan?.summary.unmatched_sgk_count ?? 0} tone="amber" />
          </div>

          <div className="mt-4 grid gap-2">
            <Button className="rounded-xl bg-violet-500 text-white hover:bg-violet-400" onClick={handleBuildPlan}>
              Önizleme Planı Hazırla
            </Button>
            <Button variant="outline" className="rounded-xl border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800" onClick={handleExportPlan}>
              CSV Olarak İndir
            </Button>
            <Button variant="ghost" className="rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white" onClick={clearPlan}>
              Planı Temizle
            </Button>
          </div>

          {!plan ? (
            <EmptyState
              title="Henüz atama planı yok"
              description="Personel ve SGK listesini hazırlayıp önizleme oluşturun."
              icon={Layers}
            />
          ) : (
            <div className="mt-4 max-h-[330px] space-y-2 overflow-y-auto pr-1">
              {plan.planRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{row.companyName}</p>
                      <p className="mt-1 text-xs text-slate-400">{row.personnelName} · {row.personnelRole}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-violet-400/30 bg-violet-500/10 text-violet-200">
                      {row.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <span>SGK: {row.sgkNo}</span>
                    <span>Öneri: {row.suggestedMinutes} dk</span>
                    <span>Çalışan: {row.employeeCount}</span>
                    <span>Tehlike: {row.hazardClass}</span>
                  </div>
                  {row.warnings.length > 0 && (
                    <p className="mt-2 text-xs text-amber-200">{row.warnings.join(" | ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractDownloadPanel({
  runtime,
  onRun,
  companies,
  userId,
  organizationId,
  onOperationsRefresh,
}: {
  runtime: FeatureRuntimeState;
  onRun: () => void;
  companies: IsgkatipCompanyRow[];
  userId?: string | null;
  organizationId?: string | null;
  onOperationsRefresh: () => Promise<void> | void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localStatus, setLocalStatus] = useState<FeatureRuntimeState>({});

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    if (!normalizedQuery) return companies;

    return companies.filter((company) => {
      const haystack = [
        getCompanyValue(company, "company_name"),
        getCompanyValue(company, "sgk_no"),
        getCompanyValue(company, "hazard_class"),
        getCompanyValue(company, "nace_code"),
        getContractStatusText(company),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedQuery);
    });
  }, [companies, query]);

  const activeCompanies = useMemo(
    () => filteredCompanies.filter((company) => !isPendingAssignment(company)),
    [filteredCompanies],
  );
  const pendingCompanies = useMemo(
    () => filteredCompanies.filter((company) => isPendingAssignment(company)),
    [filteredCompanies],
  );
  const selectedRows = useMemo(
    () => companies.filter((company) => selectedIds.includes(String(company.id))),
    [companies, selectedIds],
  );

  const toggleCompany = useCallback((companyId: string) => {
    setSelectedIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId],
    );
  }, []);

  const selectRows = useCallback((rows: IsgkatipCompanyRow[]) => {
    setSelectedIds(rows.map((company) => String(company.id)));
  }, []);

  const exportRows = useCallback(async (rows: IsgkatipCompanyRow[], label: string) => {
    if (rows.length === 0) {
      setLocalStatus({ error: "PDF raporu oluşturmak için en az bir firma seçmelisiniz." });
      toast.error("PDF için firma seçin");
      return;
    }

    setLocalStatus({ loading: true });
    const operation =
      userId && organizationId
        ? await startClientOperation(userId, organizationId, {
            operationType: "contract_report_export",
            operationTitle: "Atama Sözleşme Raporu Dışa Aktarımı",
            source: "web_app",
            inputSummary: {
              label,
              company_count: rows.length,
            },
          })
        : null;

    try {
      drawContractReportPdf(rows);
      setLocalStatus({ success: `${label} için ${rows.length} firma rapora eklendi.` });
      await finishClientOperation(operation, "success", {
        count: rows.length,
        label,
        export_type: "pdf_report",
      });
      await onOperationsRefresh();
    } catch (error) {
      console.error("Contract report export failed:", error);
      const message = "PDF raporu oluşturulurken bir hata oluştu.";
      setLocalStatus({ error: message });
      await finishClientOperation(operation, "failed", null, message);
      await onOperationsRefresh();
    }
  }, [onOperationsRefresh, organizationId, userId]);

  const renderCompanyRows = (rows: IsgkatipCompanyRow[], emptyTitle: string, emptyDescription: string) => {
    if (rows.length === 0) {
      return <EmptyState title={emptyTitle} description={emptyDescription} icon={FileDown} />;
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            {rows.length} firma listelendi
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-slate-600 bg-slate-900/80 text-xs text-slate-100 hover:bg-slate-800"
              onClick={() => selectRows(rows)}
            >
              Tümünü Seç
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-blue-600 text-xs font-bold text-white hover:bg-blue-500"
              onClick={() => void exportRows(rows, "Liste")}
            >
              Bu Listeyi Rapor PDF Al
            </Button>
          </div>
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {rows.map((company) => {
            const companyId = String(company.id);
            const checked = selectedIds.includes(companyId);
            const employeeCount = getNumericCompanyValue(company, "employee_count");
            const assignedMinutes = getNumericCompanyValue(company, "assigned_minutes");
            const requiredMinutes = getNumericCompanyValue(company, "required_minutes");

            return (
              <div
                key={companyId}
                className={cn(
                  "rounded-2xl border bg-slate-900/90 p-3 shadow-lg shadow-black/20 transition hover:border-blue-400/45",
                  checked ? "border-blue-400/70 ring-1 ring-blue-400/30" : "border-slate-700/70",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-w-0 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCompany(companyId)}
                      className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500 focus:ring-blue-500"
                      aria-label={`${getCompanyValue(company, "company_name", "Firma")} seç`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-white">
                        {getCompanyValue(company, "company_name", "Firma")}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        SGK: {getCompanyValue(company, "sgk_no", "-")} · {getCompanyValue(company, "hazard_class", "-")} · {employeeCount} çalışan
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        Atanan: {assignedMinutes} dk/ay · Gerekli: {requiredMinutes} dk/ay · {getDurationComplianceText(company)}
                      </span>
                    </span>
                  </label>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge
                      className={cn(
                        "border text-[10px]",
                        isPendingAssignment(company)
                          ? "border-amber-400/30 bg-amber-500/15 text-amber-100"
                          : "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
                      )}
                    >
                      {getContractStatusText(company)}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-violet-600 text-xs font-bold text-white hover:bg-violet-500"
                      onClick={() => void exportRows([company], getCompanyValue(company, "company_name", "Firma"))}
                    >
                      Rapor PDF
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-100">
        <div className="flex items-start gap-3">
          <FileDown className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-extrabold text-white">Atama sözleşme raporu</p>
            <p className="mt-1 text-blue-100/80">
              Aktarılan güncel İSG-KATİP verilerinden tek firma, seçili firmalar veya tüm liste için PDF raporu oluşturabilirsiniz.
              Bu çıktı resmi İSG-KATİP sözleşme belgesi değil, İSGVİZYON rapor çıktısıdır.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/25 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Firma, SGK, tehlike sınıfı veya sözleşme durumu ara..."
            className="h-10 border-slate-700 bg-slate-950/80 pl-9 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 border-slate-600 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
            onClick={() => setSelectedIds([])}
            disabled={selectedIds.length === 0}
          >
            Seçimi Temizle
          </Button>
          <Button
            type="button"
            className="h-10 bg-violet-600 font-bold text-white hover:bg-violet-500"
            onClick={() => void exportRows(selectedRows, "Seçili firmalar")}
            disabled={selectedRows.length === 0 || localStatus.loading}
          >
            Seçili Rapor PDF ({selectedRows.length})
          </Button>
          <Button
            type="button"
            className="h-10 bg-emerald-600 font-bold text-white hover:bg-emerald-500"
            onClick={() => void exportRows(filteredCompanies, "Toplu rapor")}
            disabled={filteredCompanies.length === 0 || localStatus.loading}
          >
            Toplu Rapor PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-950/90 p-1">
          <TabsTrigger value="active" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Aktif Sözleşmeler ({activeCompanies.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Onay Bekleyen Atamalar ({pendingCompanies.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3">
          {renderCompanyRows(activeCompanies, "Aktif sözleşme bulunamadı", "Önce İSG-KATİP verisini aktarın veya arama filtresini temizleyin.")}
        </TabsContent>
        <TabsContent value="pending">
          {renderCompanyRows(pendingCompanies, "Onay bekleyen atama bulunamadı", "Onay bekleyen kayıtlar burada listelenir.")}
        </TabsContent>
      </Tabs>

      <StatusAlert {...localStatus} />
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function ContractDownloadPanelLegacy({
  runtime,
  onRun,
  companies,
}: {
  runtime: FeatureRuntimeState;
  onRun: () => void;
  companies: IsgkatipCompanyRow[];
}) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-950/90 p-1">
          <TabsTrigger value="active" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Aktif Sözleşmeler
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Onay Bekleyen Atamalar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3">
          {companies.length > 0 ? (
            companies.slice(0, 5).map((company) => (
              <div key={company.id} className="flex items-center justify-between rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
                <div>
                  <p className="font-bold text-white">{getCompanyValue(company, "company_name", "Firma")}</p>
                  <p className="text-sm text-slate-400">Sözleşme PDF aktarımı için hazır</p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-200">Aktif</Badge>
              </div>
            ))
          ) : (
            <EmptyState title="Aktif sözleşme bulunamadı" description="Önce İSG-KATİP verisini aktarın." icon={FileDown} />
          )}
        </TabsContent>
        <TabsContent value="pending">
          <EmptyState title="Onay bekleyen atama bulunamadı" description="Onay bekleyen kayıtlar burada listelenir." icon={Clock} />
        </TabsContent>
      </Tabs>

      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function ContractsNeedUpdatePanel({
  runtime,
  onRun,
  companies,
  flags,
}: {
  runtime: FeatureRuntimeState;
  onRun: () => void;
  companies: IsgkatipCompanyRow[];
  flags: IsgkatipFlagRow[];
}) {
  const candidates = buildContractUpdateCandidates(companies, flags);
  const severityClass: Record<ContractUpdateCandidate["severity"], string> = {
    CRITICAL: "border-rose-400/30 bg-rose-500/15 text-rose-100",
    WARNING: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    INFO: "border-blue-400/30 bg-blue-500/15 text-blue-100",
  };

  const exportRows = () => {
    if (candidates.length === 0) {
      toast.error("Dışa aktarılacak sözleşme adayı bulunamadı.");
      return;
    }

    downloadCsv(
      `isg-katip-sozlesme-guncelleme-adaylari-${new Date().toISOString().slice(0, 10)}.csv`,
      candidates.map((candidate) => ({
        "Firma Adı": candidate.companyName,
        "SGK No": candidate.sgkNo,
        "Mevcut Durum": candidate.currentStatus,
        "Sorun": candidate.issue,
        "Neden": candidate.reason,
        "Risk": candidate.severity,
        "Öneri": candidate.recommendation,
        "Kaynak": candidate.source,
      })),
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-300">
        Bu kontrol açık uyum bayraklarını ve temel sözleşme/süre kurallarını kullanarak manuel kontrol gerektiren kayıtları listeler.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button className="rounded-xl bg-amber-500 text-white hover:bg-amber-400" onClick={onRun}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Önizlemeyi Güncelle
        </Button>
        <Button
          variant="outline"
          className="rounded-xl border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-800"
          onClick={exportRows}
          disabled={candidates.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          CSV Olarak İndir
        </Button>
      </div>
      {candidates.length > 0 ? (
        <div className="grid gap-3">
          {candidates.slice(0, 12).map((candidate) => (
            <div key={candidate.id} className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-white">{candidate.companyName}</p>
                  <p className="mt-1 text-xs text-slate-400">SGK: {candidate.sgkNo} · Durum: {candidate.currentStatus}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={cn("rounded-full", severityClass[candidate.severity])}>
                    {candidate.severity === "CRITICAL" ? "Kritik" : candidate.severity === "WARNING" ? "Uyarı" : "Bilgi"}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-slate-600 bg-slate-950/70 text-slate-300">
                    {candidate.source}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <p className="rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-slate-200">
                  <span className="font-bold text-slate-100">Sorun:</span> {candidate.issue}
                </p>
                <p className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-blue-100">
                  <span className="font-bold">Neden?</span> {candidate.reason}
                </p>
                <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                  <span className="font-bold">Öneri:</span> {candidate.recommendation}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Güncelleme adayı görünmüyor" description="Aktarılan gerçek verilerde açık uyum bayrağı veya temel sözleşme/süre sorunu bulunamadı." icon={RefreshCw} />
      )}
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function ExcessDurationUpdatePanel({
  runtime,
  onRun,
  companies,
}: {
  runtime: FeatureRuntimeState;
  onRun: () => void;
  companies: IsgkatipCompanyRow[];
}) {
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const preview = useMemo(() => buildExcessDurationPreview(companies), [companies]);

  const handleGeneratePreview = () => {
    setPreviewGenerated(true);
    onRun();
  };

  const handleExport = () => {
    if (preview.rows.length === 0) {
      toast.error("CSV için indirilebilir fazla süre önizlemesi bulunamadı.");
      return;
    }

    downloadCsv(
      `isgvizyon-fazla-sure-onizleme-${new Date().toISOString().slice(0, 10)}.csv`,
      preview.rows.map((row) => ({
        Rapor: "İSGVİZYON Fazla Süre Önizleme Raporu",
        "Firma Adı": row.companyName,
        "SGK No": row.sgkNo,
        "Çalışan Sayısı": row.employeeCount,
        "Tehlike Sınıfı": row.hazardClass,
        "Mevcut Atanmış Dakika": row.assignedMinutes,
        "Gerekli Dakika": row.requiredMinutes,
        "Fazla Dakika": row.excessMinutes,
        "Önerilen Yeni Dakika": row.suggestedMinutes,
        "Risk/Etki Notu": row.impactNote,
        "Durum": row.status,
      })),
    );
  };

  return (
    <div className="space-y-4">
      <Alert className="border-emerald-400/25 bg-emerald-500/10 text-emerald-50">
        <Layers className="h-4 w-4 text-emerald-300" />
        <AlertTitle>Önizleme Modu · Gerçek işlem yapılmaz</AlertTitle>
        <AlertDescription className="text-emerald-100/80">
          Bu işlem yalnızca fazla atama önizlemesi oluşturur. İSG-KATİP üzerinde otomatik güncelleme yapılmaz.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricTile label="Analiz Edilen" value={preview.summary.analyzed_company_count} tone="blue" />
        <MetricTile label="Fazla Atama" value={preview.summary.excess_assignment_count} tone="amber" />
        <MetricTile label="Toplam Fazla Dk" value={preview.summary.total_excess_minutes} tone="rose" />
        <MetricTile label="Hesaplanamayan" value={preview.summary.missing_data_count} tone="slate" />
        <MetricTile label="Öneri" value={preview.summary.recommendation_count} tone="emerald" />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 sm:flex-row">
        <Button className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-400" onClick={handleGeneratePreview}>
          Önizleme Oluştur
        </Button>
        <Button variant="outline" className="rounded-xl border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800" onClick={handleExport}>
          CSV Olarak İndir
        </Button>
      </div>

      {preview.summary.analyzed_company_count === 0 && (
        <EmptyState
          title="Firma verisi bulunamadı"
          description="Önce İSG-KATİP üzerinden senkronizasyon yapın."
          icon={Layers}
        />
      )}

      {preview.summary.analyzed_company_count > 0 && preview.rows.length === 0 && (
        <EmptyState
          title="Fazla atanmış firma bulunamadı"
          description={
            preview.summary.missing_data_count > 0
              ? "Bazı firmalarda gerçek dakika verisi olmadığı için hesaplama yapılamadı."
              : "Atanmış dakika gerekli dakikadan yüksek olan kayıt bulunmadı."
          }
          icon={CheckCircle2}
        />
      )}

      {previewGenerated && preview.rows.length > 0 && (
        <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
          {preview.rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black text-white">{row.companyName}</p>
                  <p className="mt-1 text-xs text-slate-400">SGK: {row.sgkNo} · {row.hazardClass} · {row.employeeCount} çalışan</p>
                </div>
                <Badge variant="outline" className="rounded-full border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                  {row.status}
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
                <span>Atanmış: {row.assignedMinutes} dk</span>
                <span>Gerekli: {row.requiredMinutes} dk</span>
                <span>Fazla: {row.excessMinutes} dk</span>
                <span>Öneri: {row.suggestedMinutes} dk</span>
              </div>
              <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                {row.impactNote}
              </p>
            </div>
          ))}
        </div>
      )}

      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function ContractStatusReportPanel({ runtime, onRun, companies }: { runtime: FeatureRuntimeState; onRun: () => void; companies: IsgkatipCompanyRow[] }) {
  const [includeTimedOut, setIncludeTimedOut] = useState(false);
  const [includeZeroEmployees, setIncludeZeroEmployees] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [hazardFilter, setHazardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reportGenerated, setReportGenerated] = useState(false);
  const scale = [
    { color: "bg-rose-500", label: "Kırmızı", detail: "İSG Profesyoneli Sözleşmesi Yok" },
    { color: "bg-slate-300", label: "Beyaz/Gri", detail: "Personel Onayı Bekleniyor" },
    { color: "bg-amber-400", label: "Sarı", detail: "İşyeri Onayı Bekleniyor" },
    { color: "bg-emerald-500", label: "Yeşil", detail: "Tam Onaylı" },
    { color: "bg-violet-500", label: "Mor", detail: "Hesaplanamayan / veri eksik" },
  ];
  const rows = buildContractStatusRows(companies);

  const visibleRows = rows.filter((row) => {
    if (!includeZeroEmployees && row.employeeCount === 0) return false;
    if (!includeTimedOut && row.overallStatus.toLocaleLowerCase("tr-TR").includes("sonlan")) return false;
    if (onlyIssues && row.color === "green") return false;
    if (hazardFilter !== "all" && row.hazardClass !== hazardFilter) return false;
    if (statusFilter !== "all" && row.color !== statusFilter) return false;

    return true;
  });
  const hazardOptions = [...new Set(rows.map((row) => row.hazardClass).filter(Boolean))];
  const issueCount = rows.filter((row) => row.color !== "green").length;
  const colorClass: Record<ContractStatusColor, string> = {
    red: "border-rose-400/30 bg-rose-500/15 text-rose-100",
    gray: "border-slate-300/30 bg-slate-400/15 text-slate-100",
    yellow: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    green: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
    purple: "border-violet-400/30 bg-violet-500/15 text-violet-100",
  };

  const exportRows = () => {
    downloadCsv(
      `isg-katip-sozlesme-durumu-${new Date().toISOString().slice(0, 10)}.csv`,
      visibleRows.map((row) => ({
        "Firma adı": row.companyName,
        "SGK sicil no": row.sgkNo,
        "Çalışan sayısı": row.employeeCount,
        "Tehlike sınıfı": row.hazardClass,
        "Sözleşme durumu": row.overallStatus,
        "Eksik alan": row.missingField,
        "Önerilen aksiyon": row.recommendation,
      })),
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {scale.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
            <span className={cn("h-4 w-4 rounded-full ring-1 ring-white/30", item.color)} />
            <div>
              <p className="font-black text-white">{item.label}</p>
              <p className="text-sm text-slate-400">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input type="checkbox" checked={includeTimedOut} onChange={(event) => setIncludeTimedOut(event.target.checked)} className="mt-1 rounded border-slate-600 bg-slate-950" />
          Belirlenen sürede onaylanmadığı için sonlanan sözleşmeleri de göster
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input type="checkbox" checked={includeZeroEmployees} onChange={(event) => setIncludeZeroEmployees(event.target.checked)} className="mt-1 rounded border-slate-600 bg-slate-950" />
          Çalışan sayısı sıfıra düşen işyerlerini göster
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input type="checkbox" checked={onlyIssues} onChange={(event) => setOnlyIssues(event.target.checked)} className="mt-1 rounded border-slate-600 bg-slate-950" />
          Sadece eksik/uyumsuz olanları göster
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-slate-400">Tehlike sınıfı</Label>
            <select value={hazardFilter} onChange={(event) => setHazardFilter(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
              <option value="all">Tümü</option>
              {hazardOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Durum</Label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
              <option value="all">Tümü</option>
              <option value="red">İSG profesyoneli sözleşmesi yok</option>
              <option value="gray">Personel onayı bekleniyor</option>
              <option value="yellow">İşyeri onayı bekleniyor</option>
              <option value="green">Tam onaylı</option>
              <option value="purple">Hesaplanamayan / veri eksik</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-xl bg-amber-500 text-white hover:bg-amber-400" onClick={() => { setReportGenerated(true); onRun(); }}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          Raporu Oluştur ve Görüntüle
        </Button>
        <Button variant="outline" className="rounded-xl border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-800" onClick={exportRows} disabled={!reportGenerated || visibleRows.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          CSV Olarak İndir
        </Button>
      </div>

      {reportGenerated && visibleRows.length > 0 ? (
        <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
          {visibleRows.slice(0, 30).map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-white">{row.companyName}</p>
                  <p className="text-xs text-slate-400">
                    SGK: {row.sgkNo} · {row.hazardClass} · {row.employeeCount} çalışan
                  </p>
                </div>
                <Badge variant="outline" className={cn("w-fit rounded-full", colorClass[row.color])}>
                  {row.overallStatus}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-4">
                <span>Uzman: {row.safetyExpertStatus}</span>
                <span>Hekim: {row.physicianStatus}</span>
                <span>DSP: {row.dspStatus}</span>
                <span>Eksik: {row.missingField}</span>
              </div>
              <p className="mt-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">{row.recommendation}</p>
            </div>
          ))}
        </div>
      ) : reportGenerated ? (
        <EmptyState title="Raporlanacak firma verisi yok" description="Filtreleri değiştirin veya önce İSG-KATİP üzerinden firma ve sözleşme verilerinizi senkronize edin." icon={ShieldCheck} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
            <p className="text-xs text-slate-400">Toplam firma</p>
            <p className="mt-2 text-2xl font-black text-white">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4">
            <p className="text-xs text-rose-100/80">Eksik/uyumsuz</p>
            <p className="mt-2 text-2xl font-black text-rose-100">{issueCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
            <p className="text-xs text-emerald-100/80">Tam onaylı</p>
            <p className="mt-2 text-2xl font-black text-emerald-100">{rows.length - issueCount}</p>
          </div>
        </div>
      )}

      <Alert className="border-amber-400/25 bg-amber-500/10 text-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-300" />
        <AlertTitle>Analiz raporu</AlertTitle>
        <AlertDescription className="text-amber-100/80">
          Bu çıktı İSG-KATİP resmi sözleşme belgesi değil, İSGVİZYON analiz raporudur. Çok tehlikeli ve 10+ çalışan olan işyerleri için DSP bilgisi ayrıca kontrol edilir.
        </AlertDescription>
      </Alert>
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function DurationAnalysisPanel({ runtime, onRun, companies }: { runtime: FeatureRuntimeState; onRun: () => void; companies: IsgkatipCompanyRow[] }) {
  const rows = analyzeDurationRows(companies);
  const summary = {
    total: rows.length,
    deficit: rows.filter((row) => row.status === "deficit" || row.status === "critical").length,
    excess: rows.filter((row) => row.status === "excess").length,
    compliant: rows.filter((row) => row.status === "compliant").length,
    missing: rows.filter((row) => row.status === "missing").length,
  };
  const analyzableRows = rows.filter((row) => row.status !== "missing");
  const statusClass: Record<DurationStatus, string> = {
    missing: "border-slate-500/30 bg-slate-500/15 text-slate-200",
    critical: "border-rose-400/30 bg-rose-500/15 text-rose-100",
    deficit: "border-red-400/30 bg-red-500/15 text-red-100",
    compliant: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
    excess: "border-orange-400/30 bg-orange-500/15 text-orange-100",
  };

  const exportRows = () => {
    downloadCsv(
      `isg-katip-sure-analizi-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((row) => ({
        "Firma adı": row.companyName,
        "SGK sicil no": row.sgkNo,
        "Çalışan sayısı": row.employeeCount,
        "Tehlike sınıfı": row.hazardClass,
        "Gerekli dakika": row.requiredMinutes,
        "Atanmış dakika": row.assignedMinutes,
        "Fark": row.diffMinutes,
        "Sözleşme durumu": row.statusLabel,
        "Eksik alan": row.status === "missing" ? "required_minutes / assigned_minutes" : "-",
        "Önerilen aksiyon": row.recommendation,
      })),
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Toplam firma", summary.total, "border-blue-400/25 bg-blue-500/10 text-blue-100"],
          ["Eksik süreli", summary.deficit, "border-rose-400/25 bg-rose-500/10 text-rose-100"],
          ["Fazla atanmış", summary.excess, "border-orange-400/25 bg-orange-500/10 text-orange-100"],
          ["Tam uyumlu", summary.compliant, "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"],
          ["Hesaplanamayan", summary.missing, "border-slate-500/25 bg-slate-500/10 text-slate-100"],
        ].map(([label, value, className]) => (
          <div key={String(label)} className={cn("rounded-2xl border p-4", String(className))}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">{label}</p>
            <p className="mt-2 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-xl bg-rose-500 text-white hover:bg-rose-400" onClick={onRun}>
          <TimerReset className="mr-2 h-4 w-4" />
          Analizi İşlem Geçmişine Kaydet
        </Button>
        <Button variant="outline" className="rounded-xl border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-800" onClick={exportRows} disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          CSV Olarak İndir
        </Button>
      </div>

      {analyzableRows.length > 0 ? (
        <div className="grid gap-3">
          {rows.slice(0, 20).map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-bold text-white">{row.companyName}</p>
                <p className="text-xs text-slate-400">
                  SGK: {row.sgkNo} · {row.hazardClass} · {row.employeeCount} çalışan
                </p>
              </div>
              <Badge variant="outline" className={cn("w-fit rounded-full", statusClass[row.status])}>
                {row.statusLabel}
              </Badge>
            </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
                <span>Gerekli: {row.requiredMinutes || "-"} dk</span>
                <span>Atanmış: {row.assignedMinutes || "-"} dk</span>
                <span>Fark: {row.status === "missing" ? "-" : `${row.diffMinutes} dk`}</span>
                <span>Oran: {row.ratio === null ? "-" : `%${row.ratio}`}</span>
              </div>
              <p className="mt-3 rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">{row.recommendation}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Gerçek süre analizi için dakika verisi gerekli" description="Gerçek süre analizi için İSG-KATİP senkron verilerinde gerekli dakika ve atanmış dakika bilgileri bulunmalıdır." icon={TimerReset} />
      )}
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function KatipChangeTrackingPanel({
  runtime,
  result,
  onRun,
}: {
  runtime: FeatureRuntimeState;
  result: KatipChangeResult | null;
  onRun: () => void;
}) {
  const typeStyles: Record<KatipChangeType, { label: string; className: string }> = {
    added: {
      label: "Yeni",
      className: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
    },
    updated: {
      label: "Değişti",
      className: "border-blue-400/30 bg-blue-500/15 text-blue-200",
    },
    removed: {
      label: "Listede Yok",
      className: "border-rose-400/30 bg-rose-500/15 text-rose-200",
    },
  };
  const categorySummaries = result
    ? [
        {
          title: "Yeni eklenen firmalar",
          count: result.changes.filter((change) => change.type === "added").length,
          className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
        },
        {
          title: "Güncellenen firmalar",
          count: result.changes.filter((change) => change.type === "updated").length,
          className: "border-blue-400/25 bg-blue-500/10 text-blue-100",
        },
        {
          title: "Silinen/pasifleşen firmalar",
          count: result.changes.filter((change) => change.type === "removed").length,
          className: "border-rose-400/25 bg-rose-500/10 text-rose-100",
        },
        {
          title: "Çalışan sayısı değişenler",
          count: result.changes.filter((change) => change.changeCategories?.includes("Çalışan sayısı değişenler")).length,
          className: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
        },
        {
          title: "Tehlike sınıfı değişenler",
          count: result.changes.filter((change) => change.changeCategories?.includes("Tehlike sınıfı değişenler")).length,
          className: "border-amber-400/25 bg-amber-500/10 text-amber-100",
        },
        {
          title: "Sözleşme durumu değişenler",
          count: result.changes.filter((change) => change.changeCategories?.includes("Sözleşme durumu değişenler")).length,
          className: "border-violet-400/25 bg-violet-500/10 text-violet-100",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-50">İSG-KATİP Değişiklik Takibi</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Son İSG-KATİP firma listenizi önceki senkron kayıtlarıyla karşılaştırır; yeni, çıkan veya bilgisi değişen firmaları gösterir.
            </p>
          </div>
          <Button
            className="shrink-0 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/30 hover:bg-blue-400"
            onClick={onRun}
            disabled={runtime.loading}
          >
              {runtime.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Değişiklikleri Tara
          </Button>
        </div>
      </div>

      {!result && (
        <EmptyState
          title="Henüz değişiklik taraması yapılmadı"
          description="Taramayı başlattığınızda mevcut İSG-KATİP listeniz geçmiş kayıtlarla karşılaştırılır."
          icon={Clock}
        />
      )}

      {result && !result.hasBaseline && (
        <Alert className="border-amber-400/25 bg-amber-500/10 text-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-300" />
          <AlertTitle>Karşılaştırma geçmişi yok</AlertTitle>
          <AlertDescription className="text-amber-100/80">
            Değişiklik takibi için en az iki farklı İSG-KATİP senkron kaydı gerekir. İlk kayıt alındıktan sonraki senkronlarda değişiklikler burada görünür.
          </AlertDescription>
        </Alert>
      )}

      {result?.hasBaseline && result.changes.length === 0 && (
        <Alert className="border-emerald-400/25 bg-emerald-500/10 text-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <AlertTitle>Değişiklik yok</AlertTitle>
          <AlertDescription className="text-emerald-100/80">
            Son senkrona göre firma, çalışan sayısı, tehlike sınıfı, süre ve sözleşme alanlarında fark bulunmadı.
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Mevcut</p>
            <p className="mt-2 text-2xl font-black text-white">{result.currentCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Önceki</p>
            <p className="mt-2 text-2xl font-black text-white">{result.previousCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Fark</p>
            <p className="mt-2 text-2xl font-black text-white">{result.changes.length}</p>
          </div>
        </div>
      )}

      {result?.hasBaseline && result.changes.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categorySummaries.map((item) => (
            <div key={item.title} className={cn("rounded-2xl border p-3", item.className)}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-75">{item.title}</p>
              <p className="mt-2 text-2xl font-black">{item.count}</p>
            </div>
          ))}
        </div>
      )}

      {result && result.changes.length > 0 && (
        <div className="space-y-3">
          {result.changes.map((change) => {
            const style = typeStyles[change.type];
            return (
              <div
                key={`${change.type}-${change.id}`}
                className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-black text-white">{change.companyName}</h4>
                    <p className="mt-1 text-sm text-slate-400">{change.summary}</p>
                  </div>
                  <Badge variant="outline" className={cn("w-fit rounded-full", style.className)}>
                    {style.label}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {change.changeCategories && change.changeCategories.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-2">
                      {change.changeCategories.map((category) => (
                        <Badge key={`${change.id}-${category}`} variant="outline" className="rounded-full border-slate-600 bg-slate-950/70 text-slate-300">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {change.details.map((detail, detailIndex) => (
                    <div key={`${change.id}-detail-${detailIndex}`} className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      {detail}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function CompanyImportPanel({
  runtime,
  extensionStatus,
  companies,
  selectedIds,
  disabledIds,
  target,
  isOsgbPlan,
  hasOrganization,
  onLoadCompanies,
  onStartNewSync,
  onToggleCompany,
  onSelectAll,
  onClearSelection,
  onTargetChange,
  onImportSelected,
}: {
  runtime: FeatureRuntimeState;
  extensionStatus: ExtensionStatus;
  companies: IsgkatipCompanyRow[];
  selectedIds: string[];
  disabledIds: string[];
  target: ImportTarget;
  isOsgbPlan: boolean;
  hasOrganization: boolean;
  onLoadCompanies: () => void;
  onStartNewSync: () => void;
  onToggleCompany: (companyId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onTargetChange: (target: ImportTarget) => void;
  onImportSelected: () => void;
}) {
  const [query, setQuery] = useState("");
  const filteredCompanies = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    if (!term) return companies;

    return companies.filter((company) =>
      [company.company_name, company.sgk_no, company.hazard_class, company.nace_code]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term)),
    );
  }, [companies, query]);

  const selectedCount = selectedIds.length;
  const disabledIdSet = useMemo(() => new Set(disabledIds), [disabledIds]);
  const selectableFilteredCompanies = useMemo(
    () => filteredCompanies.filter((company) => !disabledIdSet.has(company.id)),
    [disabledIdSet, filteredCompanies],
  );
  const disabledCount = companies.filter((company) => disabledIdSet.has(company.id)).length;
  const allFilteredSelected =
    selectableFilteredCompanies.length > 0 && selectableFilteredCompanies.every((company) => selectedIds.includes(company.id));
  const osgbTargetDisabled = !isOsgbPlan || !hasOrganization;
  const syncReady = extensionStatus.state === "sync_ready";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-50">Firma aktarım akışı</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Son senkron verisini bu ekranda yükleyebilir veya yeni veri okumak için İSG-KATİP eklenti akışını başlatabilirsiniz.
            </p>
            <p className="mt-1 text-xs italic text-slate-500">
              OSGB kullanıcılarının operasyon takibi için OSGB Yönetim Panelini kullanmaları tavsiye edilir.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Button
          className="h-12 rounded-2xl bg-emerald-500 text-base font-black text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-400"
          onClick={onLoadCompanies}
          disabled={runtime.loading}
        >
          {runtime.loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
          Son Senkron Verisini Yükle
        </Button>
        <Button
          className="h-12 rounded-2xl bg-blue-500 text-base font-black text-white shadow-lg shadow-blue-950/30 hover:bg-blue-400"
          onClick={onStartNewSync}
          disabled={runtime.loading}
        >
          <ExternalLink className="mr-2 h-5 w-5" />
          İSG-KATİP’ten Yeni Senkron Başlat
        </Button>
      </div>

      {!syncReady ? (
        <Alert className="border-amber-400/25 bg-amber-500/10 text-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-300" />
          <AlertTitle>Yeni senkron için hazırlık gerekli</AlertTitle>
          <AlertDescription className="text-amber-100/80">
            {extensionStatus.installed
              ? "Yeni senkron için eklenti bağlantısı ve açık İSG-KATİP oturumu gereklidir."
              : "Yeni senkron için İSGVİZYON tarayıcı eklentisini kurmanız gerekir."}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-400/25 bg-emerald-500/10 text-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <AlertTitle>Senkron akışı hazır</AlertTitle>
          <AlertDescription className="text-emerald-100/80">
            İSG-KATİP sayfasında eklenti panelinden “Firmalarımı Oku” akışını başlatın. Onaydan sonra bu ekrandan son senkron verisini yükleyebilirsiniz.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onTargetChange("personal")}
          className={cn(
            "rounded-2xl border p-4 text-left transition",
            target === "personal"
              ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-50"
              : "border-slate-700/70 bg-slate-900/90 text-slate-200 hover:border-cyan-500/35",
          )}
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-cyan-300" />
            <span className="font-black">Firmalarım alanına aktar</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Profilim → Firmalarım listesindeki genel firma yönetimine ekler.</p>
        </button>

        <button
          type="button"
          onClick={() => !osgbTargetDisabled && onTargetChange("osgb")}
          disabled={osgbTargetDisabled}
          className={cn(
            "rounded-2xl border p-4 text-left transition",
            target === "osgb"
              ? "border-violet-400/50 bg-violet-500/15 text-violet-50"
              : "border-slate-700/70 bg-slate-900/90 text-slate-200 hover:border-violet-500/35",
            osgbTargetDisabled && "cursor-not-allowed opacity-55",
          )}
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-violet-300" />
            <span className="font-black">OSGB Firma Takibi’ne aktar</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Sadece OSGB paketi ve organizasyon hesabı olan kullanıcılar için aktif olur.
          </p>
        </button>
      </div>

      {companies.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-white">Aktarılacak firmaları seçin</h3>
              <p className="text-xs text-slate-400">
                {selectedCount} firma seçildi · {selectableFilteredCompanies.length} aktarılabilir · {disabledCount} zaten ekli
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-xl bg-blue-500 text-white hover:bg-blue-400"
                onClick={allFilteredSelected ? onClearSelection : onSelectAll}
                disabled={selectableFilteredCompanies.length === 0}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                {allFilteredSelected ? "Seçimi Temizle" : "Tümünü Seç"}
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-800" asChild>
                <a href={ISGVIZYON_CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Web Store
                </a>
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Firma, SGK, tehlike sınıfı veya NACE ara..."
              className="h-10 rounded-xl border-slate-700 bg-slate-950/90 pl-9 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {filteredCompanies.length === 0 ? (
              <EmptyState title="Eşleşen firma bulunamadı" description="Arama kriterini değiştirerek tekrar deneyin." icon={Search} />
            ) : (
              filteredCompanies.map((company) => {
                const checked = selectedIds.includes(company.id);
                const disabled = disabledIdSet.has(company.id);

                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => !disabled && onToggleCompany(company.id)}
                    disabled={disabled}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                      disabled
                        ? "cursor-not-allowed border-slate-700/60 bg-slate-950/45 opacity-60"
                        : checked
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-slate-700/70 bg-slate-950/70 hover:border-slate-500",
                    )}
                  >
                    <span className={cn("mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md border", disabled ? "border-slate-600 bg-slate-800 text-slate-400" : checked ? "border-emerald-400 bg-emerald-500 text-white" : "border-slate-600 bg-slate-900")}>
                      {disabled || checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="block truncate font-bold text-slate-100">{company.company_name}</span>
                        {disabled ? (
                          <Badge className="rounded-full border border-slate-500/30 bg-slate-700/60 text-[10px] text-slate-200 hover:bg-slate-700/60">
                            Zaten ekli
                          </Badge>
                        ) : (
                          <Badge className="rounded-full border border-emerald-400/25 bg-emerald-500/12 text-[10px] text-emerald-200 hover:bg-emerald-500/12">
                            Aktarılabilir
                          </Badge>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span>SGK: {company.sgk_no || "-"}</span>
                        <span>Çalışan: {company.employee_count || 0}</span>
                        <span>{company.hazard_class || "Az Tehlikeli"}</span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <Button
            className="h-11 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 font-black text-white shadow-lg shadow-violet-950/35 hover:from-violet-400 hover:to-blue-400"
            onClick={onImportSelected}
            disabled={runtime.loading || selectedCount === 0 || selectableFilteredCompanies.length === 0 || (target === "osgb" && osgbTargetDisabled)}
          >
            {runtime.loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
            Seçili {selectedCount} Firmayı Aktar
          </Button>
        </div>
      )}

      <StatusAlert {...runtime} onRetry={onLoadCompanies} />
    </div>
  );
}

function LegacyCompanyImportPanel({ runtime, onRun }: { runtime: FeatureRuntimeState; onRun: () => void }) {
  return (
    <div className="space-y-4">
      <Alert className="border-blue-400/25 bg-blue-500/10 text-blue-50">
        <Chrome className="h-4 w-4 text-blue-300" />
        <AlertTitle>Firmalarımı Aktar</AlertTitle>
        <AlertDescription className="text-blue-100/80">
          İSG-KATİP sayfasında eklenti panelinden “Firmalarımı Oku” işlemini başlatın, önizlemeyi kontrol edin ve ikinci onayla İSGVİZYON’a aktarın.
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="rounded-xl bg-blue-500 text-white hover:bg-blue-400" asChild>
          <a href={ISGVIZYON_CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Web Store’u Aç
          </a>
        </Button>
        <Button variant="outline" className="rounded-xl border-slate-700 bg-slate-950/50 text-slate-100 hover:bg-slate-800" onClick={onRun}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Bağlantıyı Kontrol Et
        </Button>
      </div>
      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function OperationHistoryPanel({
  operations,
  loading,
  notice,
  onRefresh,
}: {
  operations: IsgbotOperationRow[];
  loading: boolean;
  notice?: string | null;
  onRefresh: () => void;
}) {
  const statusClass = (status: string) => {
    if (status === "success") return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
    if (status === "partial") return "border-amber-400/30 bg-amber-500/15 text-amber-200";
    if (status === "failed") return "border-rose-400/30 bg-rose-500/15 text-rose-200";
    return "border-blue-400/30 bg-blue-500/15 text-blue-200";
  };

  const statusLabel = (status: string) => {
    if (status === "success") return "Başarılı";
    if (status === "partial") return "Kısmi başarı";
    if (status === "failed") return "Hatalı";
    return "Devam ediyor";
  };

  const summaryText = (operation: IsgbotOperationRow) => {
    const summary = operation.result_summary || {};
    if (summary.guidance_only) {
      return "Yönlendirme yapıldı; gerçek senkron İSG-KATİP eklenti panelinden başlatılır.";
    }

    const parts = [
      typeof summary.total === "number" ? `${summary.total} toplam` : null,
      typeof summary.imported === "number" ? `${summary.imported} aktarıldı` : null,
      typeof summary.inserted === "number" ? `${summary.inserted} yeni` : null,
      typeof summary.updated === "number" ? `${summary.updated} güncellendi` : null,
      typeof summary.skipped === "number" ? `${summary.skipped} atlandı` : null,
      typeof summary.errors === "number" ? `${summary.errors} hata` : null,
      typeof summary.changes === "number" ? `${summary.changes} değişiklik` : null,
      typeof summary.count === "number" ? `${summary.count} kayıt` : null,
      typeof summary.total_count === "number" ? `${summary.total_count} toplam` : null,
      typeof summary.selected_count === "number" ? `${summary.selected_count} seçili` : null,
      typeof summary.success_count === "number" ? `${summary.success_count} başarılı` : null,
      typeof summary.failed_count === "number" ? `${summary.failed_count} hatalı` : null,
      typeof summary.skipped_count === "number" ? `${summary.skipped_count} atlandı` : null,
    ].filter(Boolean);

    if (operation.error_message) return operation.error_message;
    return parts.length ? parts.join(" · ") : "Özet bilgisi yok";
  };

  return (
    <Card className="rounded-[24px] border-slate-500/20 bg-[#111827]/88 text-slate-50">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-400">İşlem Geçmişi</p>
            <p className="mt-1 text-xs text-slate-500">Son İSGBot işlemleri ve sonuç özetleri</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-800"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Yenile
          </Button>
        </div>

        {notice ? (
          <div className="mb-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
            {notice}
          </div>
        ) : null}

        {operations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/60 p-4 text-sm text-slate-400">
            Henüz işlem geçmişi yok. Senkron, aktarım veya değişiklik takibi çalıştırıldığında burada görünecek.
          </div>
        ) : (
          <div className="space-y-2">
            {operations.map((operation) => (
              <div key={operation.id} className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{operation.operation_title}</p>
                    <p className="mt-1 text-xs text-slate-400">{summaryText(operation)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{formatSyncLabel(operation.started_at || operation.created_at)}</p>
                  </div>
                  <Badge variant="outline" className={cn("w-fit rounded-full", statusClass(operation.status))}>
                    {statusLabel(operation.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MultiAssignmentPanelV2({
  companies,
  onRecordDryRun,
  extensionStatus,
  userId,
  organizationId,
  onOperationsRefresh,
}: {
  companies: IsgkatipCompanyRow[];
  onRecordDryRun: (result: MultiAssignmentDryRunResult) => void;
  extensionStatus: ExtensionStatus;
  userId?: string | null;
  organizationId?: string | null;
  onOperationsRefresh: () => Promise<void> | void;
}) {
  const [personnelText, setPersonnelText] = useState("");
  const [personnel, setPersonnel] = useState<IsgbotPersonnel[]>([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [sgkText, setSgkText] = useState("");
  const [parsedSgkInputs, setParsedSgkInputs] = useState<ReturnType<typeof parseSgkNumbers>>([]);
  const [plan, setPlan] = useState<MultiAssignmentDryRunResult | null>(null);
  const [planHash, setPlanHash] = useState<string | null>(null);
  const [selectedPlanRowIds, setSelectedPlanRowIds] = useState<string[]>([]);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [reviewedPlan, setReviewedPlan] = useState(false);
  const [acceptedRealChange, setAcceptedRealChange] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyInfo, setApplyInfo] = useState<string | null>(null);
  const [surfaceValidation, setSurfaceValidation] = useState<SurfaceValidationResult>(null);
  const [isValidatingSurface, setIsValidatingSurface] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyStage, setApplyStage] = useState("Hazır");
  const [applyResults, setApplyResults] = useState<ApplyResultRow[]>([]);

  const invalidSgkInputs = parsedSgkInputs.filter((input) => !input.valid);
  const validSgkNumbers = parsedSgkInputs.filter((input) => input.valid).map((input) => input.normalized);
  const matchPreview = useMemo(
    () => (validSgkNumbers.length ? buildMultiAssignmentPlan(companies, validSgkNumbers, personnel, selectedPersonnelId).matches : []),
    [companies, personnel, selectedPersonnelId, validSgkNumbers],
  );
  const selectedPlanRows = useMemo(
    () => plan?.planRows.filter((row) => selectedPlanRowIds.includes(row.id)) ?? [],
    [plan, selectedPlanRowIds],
  );
  const applySummary = useMemo(() => summarizeApplyResults(applyResults), [applyResults]);
  const guardResult = useMemo(
    () =>
      canApplyMultiAssignment({
        applyEnabled: ISGBOT_APPLY_ENABLED,
        extensionStatus,
        planRows: plan?.planRows ?? [],
        selectedRows: selectedPlanRows,
        planHash,
        confirmation: {
          reviewedPlan,
          acceptedRealChange,
          typedConfirmation,
        },
        pilotLimit: ISGBOT_PILOT_LIMIT,
      }),
    [acceptedRealChange, extensionStatus, plan?.planRows, planHash, reviewedPlan, selectedPlanRows, typedConfirmation],
  );

  const resetApplyState = () => {
    setSelectedPlanRowIds([]);
    setApplyDialogOpen(false);
    setReviewedPlan(false);
    setAcceptedRealChange(false);
    setTypedConfirmation("");
    setApplyError(null);
    setApplyInfo(null);
    setSurfaceValidation(null);
    setIsValidatingSurface(false);
    setApplyStage("Hazır");
    setApplyResults([]);
  };

  const validateApplySurface = useCallback(async () => {
    if (!ISGBOT_APPLY_ENABLED) {
      setSurfaceValidation(null);
      return false;
    }

    if (selectedPlanRows.length === 0) {
      setSurfaceValidation({
        canApply: false,
        blockingReasons: ["İşlem yapılacak kayıt seçilmedi."],
      });
      return false;
    }

    setIsValidatingSurface(true);
    try {
      const response = await validateAssignmentSurface({
        planHash,
        records: selectedPlanRows.map((row) => ({
          id: row.id,
          companyName: row.companyName,
          sgkNo: row.sgkNo,
          personnelName: row.personnelName,
          assignedMinutes: row.suggestedMinutes,
        })),
      });

      const nextValidation =
        (response?.validation as SurfaceValidationResult) ||
        ({
          canApply: false,
          blockingReasons: [response?.error || ISGBOT_FORM_SURFACE_ERROR_MESSAGE],
        } satisfies SurfaceValidationResult);

      setSurfaceValidation(nextValidation);
      return Boolean(response?.success && nextValidation?.canApply);
    } catch (error) {
      console.error("ISGBot assignment surface validation failed:", error);
      const message = getIsgbotFriendlyErrorMessage(error, ISGBOT_FORM_SURFACE_ERROR_MESSAGE);
      setSurfaceValidation({
        canApply: false,
        blockingReasons: [message],
      });
      return false;
    } finally {
      setIsValidatingSurface(false);
    }
  }, [planHash, selectedPlanRows]);

  const openApplyDialog = async () => {
    setApplyDialogOpen(true);
    await validateApplySurface();
  };

  useEffect(() => {
    setSurfaceValidation(null);
  }, [planHash, selectedPlanRowIds]);

  const handleParsePersonnel = () => {
    const result = parsePersonnelText(personnelText);
    setPersonnel(result.personnel);
    setSelectedPersonnelId(result.personnel[0]?.id ?? null);
    setPlan(null);
    setPlanHash(null);
    resetApplyState();

    if (!personnelText.trim()) {
      toast.error("Personel listesi boş.", {
        description: "Her satıra personel bilgisi ekleyin. Örn: Ad Soyad, TC, Rol, Belge No",
      });
      return;
    }

    if (result.personnel.length === 0) {
      toast.error("Personel okunamadı.", {
        description: "CSV/text formatını kontrol edip tekrar deneyin.",
      });
      return;
    }

    toast.success("Personel listesi hazırlandı", {
      description: `${result.personnel.length} personel okundu; ${result.invalidRows.length} satır uyarılı.`,
    });
  };

  const handleParseSgk = () => {
    const parsed = parseSgkNumbers(sgkText);
    setParsedSgkInputs(parsed);
    setPlan(null);
    setPlanHash(null);
    resetApplyState();

    if (!sgkText.trim() || parsed.length === 0) {
      toast.error("SGK sicil numarası girilmedi.");
      return;
    }

    toast.success("SGK listesi hazırlandı", {
      description: `${parsed.filter((input) => input.valid).length} geçerli SGK no; ${parsed.filter((input) => !input.valid).length} uyarı.`,
    });
  };

  const handleBuildPlan = () => {
    if (validSgkNumbers.length === 0) {
      toast.error("SGK sicil numarası girilmedi.");
      return;
    }

    if (personnel.length === 0 || !selectedPersonnelId) {
      toast.error("Personel seçilmedi.", {
        description: "Önce personel listesini ekleyip bir personel seçin.",
      });
      return;
    }

    const result = buildMultiAssignmentPlan(companies, validSgkNumbers, personnel, selectedPersonnelId);
    result.invalidInputs = invalidSgkInputs;
    result.parsedSgk = parsedSgkInputs;
    result.summary.invalid_input_count = invalidSgkInputs.length;
    result.summary.warning_count += invalidSgkInputs.length;
    setPlan(result);
    setPlanHash(
      createPlanHash({
        type: "multi_assignment_apply",
        selectedPersonnelId,
        rows: result.planRows.map((row) => ({
          id: row.id,
          companyName: row.companyName,
          sgkNo: row.sgkNo,
          personnelName: row.personnelName,
          personnelRole: row.personnelRole,
          suggestedMinutes: row.suggestedMinutes,
          status: row.status,
        })),
      }),
    );
    setSelectedPlanRowIds([]);
    setApplyResults(
      result.planRows.map((row) =>
        normalizeApplyResult({
          id: row.id,
          companyName: row.companyName,
          sgkNo: row.sgkNo,
          operationType: "Çoklu Atama",
          status: "pending",
        }),
      ),
    );
    setApplyError(null);
    setApplyInfo(
      `Canlı pilot mod aktiftir. İlk aşamada yalnızca seçili ${ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION} kayıt üzerinde gerçek İSG-KATİP işlemi denenmelidir.`,
    );
    onRecordDryRun(result);

    const hasWarnings = result.summary.warning_count > 0 || result.summary.unmatched_sgk_count > 0;
    toast(hasWarnings ? "Atama önizlemesi uyarılı oluşturuldu" : "Atama önizlemesi oluşturuldu", {
      description: `${result.summary.planned_assignment_count} plan satırı hazırlandı. Gerçek İSG-KATİP ataması yapılmadı.`,
    });
  };

  const handleExportPlan = () => {
    if (!plan?.planRows.length) {
      toast.error("CSV için önce dry-run planı oluşturun.");
      return;
    }

    downloadCsv(
      `isgvizyon-coklu-atama-onizleme-${new Date().toISOString().slice(0, 10)}.csv`,
      plan.planRows.map((row) => ({
        "Rapor": "İSGVİZYON Çoklu Atama Önizleme Raporu",
        "Firma Adı": row.companyName,
        "SGK No": row.sgkNo,
        "Personel": row.personnelName,
        "Rol": row.personnelRole,
        "Önerilen Dakika": row.suggestedMinutes,
        "Durum": row.status,
        "Uyarılar": row.warnings.join(" | ") || "-",
      })),
    );
  };

  const handleExportApplyResults = () => {
    const rows = applyResults.filter((row) => row.status !== "pending");
    if (rows.length === 0) {
      toast.error("Sonuç raporu için önce pilot işlemi çalıştırın.");
      return;
    }
    exportApplyResultsCsv("İSGVİZYON Gerçek İşlem Sonuç Raporu", rows, downloadCsv);
  };

  const clearPlan = () => {
    setPlan(null);
    setPlanHash(null);
    resetApplyState();
  };

  const togglePlanRow = (rowId: string) => {
    setSelectedPlanRowIds((current) => {
      if (current.includes(rowId)) {
        return current.filter((value) => value !== rowId);
      }
      if (current.length >= ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION) {
        toast.error(`Canlı pilot modda ilk aşamada en fazla ${ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION} kayıt seçebilirsiniz.`);
        return current;
      }
      return [...current, rowId];
    });
  };

  const handleApply = async () => {
    if (!userId || !organizationId) {
      setApplyError("Organizasyon bilgisi bulunamadı.");
      return;
    }

    if (!guardResult.allowed) {
      setApplyError(guardResult.reasons[0] || "Gerçek işlem için doğrulama başarısız.");
      return;
    }

    const validated = surfaceValidation?.canApply ? true : await validateApplySurface();
    if (!validated) {
      setApplyError(surfaceValidation?.blockingReasons?.[0] || "Form yüzeyi doğrulanmadan işlem başlatılamaz.");
      return;
    }

    const operation = await startClientOperation(userId, organizationId, {
      operationType: "multi_assignment_apply",
      operationTitle: "Çoklu Atama Pilot Apply",
      source: "web_app",
      inputSummary: {
        feature_id: "multi-assignment",
        plan_hash: planHash,
        selected_count: selectedPlanRows.length,
        pilot_limit: ISGBOT_PILOT_LIMIT,
      },
    });

    setIsApplying(true);
    setApplyError(null);
    setApplyInfo(null);
    setApplyStage("İSG-KATİP oturumu kontrol ediliyor");
    setApplyResults((current) =>
      current.map((row) =>
        selectedPlanRowIds.includes(row.id)
          ? { ...row, status: "processing", reason: null, processedAt: null }
          : row,
      ),
    );

    try {
      const response = await sendMultiAssignmentApply({
        operationId: operation.id,
        planHash,
        validation: surfaceValidation,
        records: selectedPlanRows.map((row) => ({
          id: row.id,
          companyId: row.id.split("-")[0],
          sgkNumber: row.sgkNo,
          companyName: row.companyName,
          personnelId: selectedPersonnelId,
          personnelName: row.personnelName,
          role: row.personnelRole,
          assignedMinutes: row.suggestedMinutes,
          contractType: row.contractStatus,
          warnings: row.warnings,
        })),
      });

      if (!response?.success && !response?.results?.length) {
        throw new Error(response?.error || "Pilot işlem başarısız oldu.");
      }

      setApplyStage(`Kayıt ${selectedPlanRows.length}/${selectedPlanRows.length} işlendi`);

      const resultMap = new Map(
        (response?.results || []).map((item) => [
          String(item.id || ""),
          normalizeApplyResult({
            id: String(item.id || ""),
            companyName: String(item.companyName || "Firma"),
            sgkNo: String(item.sgkNo || "-"),
            operationType: "Çoklu Atama",
            status: (item.status as ApplyResultRow["status"]) || "failed",
            reason: typeof item.reason === "string" ? item.reason : null,
            processedAt: typeof item.processedAt === "string" ? item.processedAt : new Date().toISOString(),
            stage: typeof item.stage === "string" ? item.stage : null,
            verificationStatus: typeof item.verificationStatus === "string" ? item.verificationStatus : null,
            selectorConfidence: typeof item.selectorConfidence === "string" ? item.selectorConfidence : null,
            durationMs: typeof item.durationMs === "number" ? item.durationMs : null,
          }),
        ]),
      );

      const mergedResults = (plan?.planRows || []).map((row) => {
        const matched = resultMap.get(row.id);
        if (matched) return matched;
        return normalizeApplyResult({
          id: row.id,
          companyName: row.companyName,
          sgkNo: row.sgkNo,
          operationType: "Çoklu Atama",
          status: selectedPlanRowIds.includes(row.id) ? "skipped" : "pending",
          reason: selectedPlanRowIds.includes(row.id) ? "Pilot işlem sonucu dönmedi." : null,
          processedAt: selectedPlanRowIds.includes(row.id) ? new Date().toISOString() : null,
        });
      });

      setApplyResults(mergedResults);
      const selectedResults = mergedResults.filter((row) => selectedPlanRowIds.includes(row.id));
      const summary = summarizeApplyResults(selectedResults);

      await finishClientOperation(
        operation,
        summary.failed_count > 0 && summary.success_count > 0 ? "partial" : summary.failed_count > 0 ? "failed" : "success",
        {
          ...summary,
          selected_count: selectedPlanRows.length,
          plan_hash: planHash,
          validate_surface_passed: Boolean(surfaceValidation?.canApply),
          validate_surface_confidence: surfaceValidation?.formSurface?.confidence || null,
          selector_confidence: surfaceValidation?.formSurface?.confidence || null,
          blocking_reasons: surfaceValidation?.blockingReasons || [],
          rows: selectedResults,
        },
        response?.error || null,
      );
      await onOperationsRefresh();

      setApplyDialogOpen(false);
      setApplyStage("Tamamlandı");
      setApplyInfo(
        summary.success_unverified_count > 0
          ? "İşlem gönderildi ancak İSG-KATİP ekranında sonuç doğrulanamadı. Lütfen kaydı manuel kontrol edin."
          : summary.failed_count > 0
            ? "Bazı kayıtlar işlenemedi. Sonuç raporunu kontrol edin."
            : `${summary.success_count} kayıt pilot modda işlendi.`,
      );
      toast.success("Pilot işlem tamamlandı", {
        description:
          summary.failed_count > 0
            ? `${summary.success_count} başarılı, ${summary.failed_count} hatalı, ${summary.skipped_count} atlandı.`
            : `${summary.success_count} kayıt işlendi.`,
      });
    } catch (error) {
      console.error("ISGBot multi assignment apply failed:", error);
      const message = getIsgbotFriendlyErrorMessage(error, "Pilot işlem sırasında beklenmeyen bir hata oluştu. Lütfen eklenti bağlantısını, İSG-KATİP oturumunu ve seçili kaydı kontrol edin.");
      await finishClientOperation(operation, "failed", {
        selected_count: selectedPlanRows.length,
        plan_hash: planHash,
        validate_surface_passed: Boolean(surfaceValidation?.canApply),
        validate_surface_confidence: surfaceValidation?.formSurface?.confidence || null,
        selector_confidence: surfaceValidation?.formSurface?.confidence || null,
        blocking_reasons: surfaceValidation?.blockingReasons || [],
      }, message);
      await onOperationsRefresh();
      setApplyStage("Hatalı");
      setApplyError(message);
      setApplyResults((current) =>
        current.map((row) =>
          selectedPlanRowIds.includes(row.id)
            ? { ...row, status: "failed", reason: message, processedAt: new Date().toISOString() }
            : row,
        ),
      );
      toast.error("Pilot işlem başlatılamadı", { description: message });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert className={cn("text-amber-50", ISGBOT_APPLY_ENABLED ? "border-amber-400/25 bg-amber-500/10" : "border-slate-500/25 bg-slate-500/10")}>
        <AlertCircle className="h-4 w-4 text-amber-300" />
        <AlertTitle>{ISGBOT_APPLY_ENABLED ? "Önizleme + Pilot Gerçek İşlem" : "Önizleme Modu · Gerçek işlem kapalı"}</AlertTitle>
        <AlertDescription className="text-amber-100/80">
          {ISGBOT_APPLY_ENABLED
            ? `Canlı pilot mod aktiftir. İlk aşamada yalnızca seçili ${ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION} kayıt üzerinde gerçek İSG-KATİP işlemi denenmelidir. Teknik pilot limit ${ISGBOT_PILOT_LIMIT} kayıttır ancak ilk canlı testte tek kayıt önerilir.`
            : "Bu işlem İSG-KATİP üzerinde gerçek atama yapmaz. Sadece personel/firma eşleştirmesi, uyarı kontrolü ve dry-run planı oluşturur."}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-black text-white">Personel Seçimi</h4>
              <Users className="h-4 w-4 text-violet-300" />
            </div>
            <Textarea value={personnelText} onChange={(event) => setPersonnelText(event.target.value)} className="min-h-[118px] border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500" placeholder={"Ad Soyad, TC, Rol, Belge No\nTC - Ad Soyad - Rol\nveya sadece TC"} />
            <Button className="mt-3 w-full rounded-xl bg-violet-500 text-white hover:bg-violet-400" onClick={handleParsePersonnel}>
              <Upload className="mr-2 h-4 w-4" />
              Personel Listesi Yükle
            </Button>
            {personnel.length > 0 && (
              <div className="mt-3 space-y-2">
                <Label className="text-xs text-slate-300">Atanacak personel</Label>
                <select
                  value={selectedPersonnelId ?? ""}
                  onChange={(event) => {
                    setSelectedPersonnelId(event.target.value || null);
                    setPlan(null);
                    setPlanHash(null);
                    resetApplyState();
                  }}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-violet-400"
                >
                  {personnel.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName} · {person.role} · Kalan {person.remainingCapacityMinutes} dk
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
            <h4 className="mb-3 font-black text-white">SGK Sicil Numarası Girişi</h4>
            <Textarea value={sgkText} onChange={(event) => setSgkText(event.target.value)} className="min-h-[150px] border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500" placeholder="SGK sicil numaralarını yapıştırın veya yazın..." />
            <Button className="mt-3 w-full rounded-xl bg-violet-500 text-white hover:bg-violet-400" onClick={handleParseSgk}>
              Sicil Numaralarını Ekle
            </Button>
            {invalidSgkInputs.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                {invalidSgkInputs.slice(0, 4).map((input) => (
                  <p key={`${input.raw}-${input.reason}`}>{input.raw}: {input.reason}</p>
                ))}
                {invalidSgkInputs.length > 4 && <p>+{invalidSgkInputs.length - 4} uyarı daha</p>}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
          <h4 className="mb-3 font-black text-white">Firma Listesi</h4>
          {matchPreview.length === 0 ? (
            <EmptyState title="Henüz firma sorgulanmadı" description="SGK numaralarını ekleyip sorgulayın." icon={ShieldCheck} />
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {matchPreview.map((match) => (
                <div key={match.sgkNo} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{match.company?.company_name || match.sgkNo}</p>
                      <p className="mt-1 text-xs text-slate-400">SGK: {match.sgkNo}</p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 rounded-full", match.status === "matched" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", match.status !== "matched" && "border-amber-400/30 bg-amber-500/10 text-amber-200")}>
                      {match.status === "matched" ? "Bulundu" : match.status === "unmatched" ? "Bulunamadı" : match.status === "passive" ? "Pasif" : "Veri Eksik"}
                    </Badge>
                  </div>
                  {match.company && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <span>Çalışan: {match.company.employee_count ?? "-"}</span>
                      <span>Tehlike: {match.company.hazard_class || "-"}</span>
                      <span className="col-span-2">Sözleşme: {match.company.contract_status || "Veri yok"}</span>
                    </div>
                  )}
                  {match.warning && <p className="mt-2 text-xs text-amber-200">{match.warning}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 transition hover:border-violet-500/40">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-black text-white">Atama Planı ({plan?.planRows.length ?? 0})</h4>
            <Badge className="rounded-full bg-violet-500/15 text-violet-200 hover:bg-violet-500/15">Dry-Run</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <MetricTile label="Toplam Firma" value={plan?.summary.parsed_sgk_count ?? validSgkNumbers.length} tone="blue" />
            <MetricTile label="Planlanabilir" value={plan?.planRows.filter((row) => row.status === "Planlanabilir").length ?? 0} tone="emerald" />
            <MetricTile label="Uyarılı" value={plan?.planRows.filter((row) => row.status === "Uyarılı").length ?? 0} tone="amber" />
            <MetricTile label="Kapasite Yetersiz" value={plan?.summary.capacity_insufficient_count ?? 0} tone="rose" />
            <MetricTile label="Veri Eksik" value={plan?.summary.missing_data_count ?? 0} tone="slate" />
            <MetricTile label="Bulunamayan" value={plan?.summary.unmatched_sgk_count ?? 0} tone="amber" />
          </div>

          <div className="mt-4 grid gap-2">
            <Button className="rounded-xl bg-violet-500 text-white hover:bg-violet-400" onClick={handleBuildPlan}>
              Önizleme Planı Hazırla
            </Button>
            <Button className="rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-500 disabled:bg-slate-700 disabled:text-slate-300" onClick={() => void openApplyDialog()} disabled={!ISGBOT_APPLY_ENABLED || !plan || selectedPlanRows.length === 0 || isApplying}>
              Gerçek İşlem İçin Onayla
            </Button>
            <Button variant="outline" className="rounded-xl border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800" onClick={handleExportPlan}>
              CSV Olarak İndir
            </Button>
            <Button variant="outline" className="rounded-xl border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20" onClick={handleExportApplyResults} disabled={applyResults.filter((row) => row.status !== "pending").length === 0}>
              Sonuç Raporunu İndir
            </Button>
            <Button variant="ghost" className="rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white" onClick={clearPlan}>
              Planı Temizle
            </Button>
          </div>

          {!plan ? (
            <EmptyState title="Henüz atama planı yok" description="Personel ve SGK listesini hazırlayıp önizleme oluşturun." icon={Layers} />
          ) : (
            <div className="mt-4 max-h-[330px] space-y-2 overflow-y-auto pr-1">
              {plan.planRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={selectedPlanRowIds.includes(row.id)} onChange={() => togglePlanRow(row.id)} disabled={!ISGBOT_APPLY_ENABLED || row.status === "Kapasite Yetersiz" || row.status === "Veri Eksik" || isApplying} className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-fuchsia-500 focus:ring-fuchsia-500" aria-label={`${row.companyName} apply seçimi`} />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white">{row.companyName}</p>
                        <p className="mt-1 text-xs text-slate-400">{row.personnelName} · {row.personnelRole}</p>
                      </div>
                    </label>
                    <Badge variant="outline" className="rounded-full border-violet-400/30 bg-violet-500/10 text-violet-200">
                      {row.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <span>SGK: {row.sgkNo}</span>
                    <span>Öneri: {row.suggestedMinutes} dk</span>
                    <span>Çalışan: {row.employeeCount}</span>
                    <span>Tehlike: {row.hazardClass}</span>
                  </div>
                  {row.warnings.length > 0 && <p className="mt-2 text-xs text-amber-200">{row.warnings.join(" | ")}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {applyInfo && (
        <Alert className="border-blue-400/25 bg-blue-500/10 text-blue-50">
          <CheckCircle2 className="h-4 w-4 text-blue-300" />
          <AlertTitle>Pilot işlem bilgisi</AlertTitle>
          <AlertDescription className="text-blue-100/80">{applyInfo}</AlertDescription>
        </Alert>
      )}

      {applyError && (
        <Alert className="border-rose-400/25 bg-rose-500/10 text-rose-50">
          <AlertCircle className="h-4 w-4 text-rose-300" />
          <AlertTitle>İşlem başlatılamadı</AlertTitle>
          <AlertDescription className="text-rose-100/80">{applyError}</AlertDescription>
        </Alert>
      )}

      {applyResults.some((row) => row.status !== "pending") && (
        <div className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-black text-white">Pilot işlem sonucu</h4>
              <p className="mt-1 text-xs text-slate-400">{applyStage}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <MetricTile label="Doğrulandı" value={applySummary.success_verified_count} tone="emerald" />
              <MetricTile label="Teyitsiz" value={applySummary.success_unverified_count} tone="blue" />
              <MetricTile label="Hatalı" value={applySummary.failed_count} tone="rose" />
              <MetricTile label="Atlandı" value={applySummary.skipped_count} tone="amber" />
              <MetricTile label="Toplam" value={applySummary.total_count} tone="blue" />
            </div>
          </div>
          <div className="space-y-2">
            {applyResults.filter((row) => row.status !== "pending").map((row) => (
              <div key={`result-${row.id}`} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{row.companyName}</p>
                    <p className="mt-1 text-xs text-slate-400">SGK: {row.sgkNo}</p>
                  </div>
                  <Badge variant="outline" className={cn("rounded-full", (row.status === "success" || row.status === "success_verified") && "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", row.status === "success_unverified" && "border-blue-400/30 bg-blue-500/10 text-blue-200", row.status === "failed" && "border-rose-400/30 bg-rose-500/10 text-rose-200", row.status === "skipped" && "border-amber-400/30 bg-amber-500/10 text-amber-200", row.status === "processing" && "border-blue-400/30 bg-blue-500/10 text-blue-200")}>
                    {row.status === "success_verified" ? "Doğrulanmış başarı" : row.status === "success_unverified" ? "Başarılı ama doğrulanamadı" : row.status === "success" ? "Başarılı" : row.status === "failed" ? "Hatalı" : row.status === "skipped" ? "Atlandı" : "İşleniyor"}
                  </Badge>
                </div>
                {row.status === "success_verified" ? (
                  <p className="mt-2 text-xs text-emerald-200">Doğrulanmış başarı: İşlem İSG-KATİP ekranında teyit edildi.</p>
                ) : null}
                {row.status === "success_unverified" ? (
                  <p className="mt-2 text-xs text-blue-200">İşlem gönderildi ancak İSG-KATİP ekranında sonuç doğrulanamadı. Lütfen kaydı manuel kontrol edin.</p>
                ) : null}
                {row.status === "skipped" ? (
                  <p className="mt-2 text-xs text-amber-200">Atlandı: Kayıt güvenlik veya veri eksikliği nedeniyle işleme alınmadı.</p>
                ) : null}
                {row.reason && <p className="mt-2 text-xs text-slate-300">{row.reason}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {row.processedAt ? <span>İşlem zamanı: {formatSyncLabel(row.processedAt)}</span> : null}
                  {row.stage ? <span>Aşama: {row.stage}</span> : null}
                  {row.verificationStatus ? <span>Doğrulama: {row.verificationStatus}</span> : null}
                  {row.selectorConfidence ? <span>Selector: {row.selectorConfidence}</span> : null}
                  {typeof row.durationMs === "number" ? <span>Süre: {row.durationMs} ms</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent overlayClassName="z-[65] bg-slate-950/90 backdrop-blur-md" className="z-[70] rounded-2xl border border-slate-700/70 bg-slate-950 text-slate-50 shadow-2xl shadow-black/70 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerçek İSG-KATİP İşlemi Onayı</DialogTitle>
            <DialogDescription className="text-slate-300">
              Bu işlem İSG-KATİP üzerinde gerçek değişiklik yapacaktır. Lütfen önizleme planındaki bilgileri kontrol edin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="İşlem türü" value="Pilot Atama" tone="violet" />
              <MetricTile label="Toplam kayıt" value={plan?.planRows.length ?? 0} tone="blue" />
              <MetricTile label="Seçili kayıt" value={selectedPlanRows.length} tone="emerald" />
              <MetricTile label="Uyarılı kayıt" value={selectedPlanRows.filter((row) => row.warnings.length > 0).length} tone="amber" />
              <MetricTile label="Atlanacak kayıt" value={(plan?.planRows.length ?? 0) - selectedPlanRows.length} tone="slate" />
              <MetricTile label="Tahmini süre" value={`${Math.max(1, selectedPlanRows.length)} dk`} tone="rose" />
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Plan hash / işlem referansı</p>
              <p className="mt-2 break-all text-sm font-bold text-white">{planHash || "-"}</p>
              <p className="mt-2 text-xs text-slate-400">Pilot mod: Teknik limit {ISGBOT_PILOT_LIMIT} kayıttır. İlk canlı testte yalnızca 1 kayıt seçilmelidir.</p>
            </div>
            <div className="rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4 text-sm text-blue-100">
              <p className="font-bold text-blue-50">Canlı pilot mod aktiftir.</p>
              <p className="mt-1">İlk aşamada yalnızca seçili 1 kayıt üzerinde gerçek İSG-KATİP işlemi denenmelidir.</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">İSG-KATİP form doğrulaması</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {isValidatingSurface
                      ? "İşlem yüzeyi kontrol ediliyor."
                      : surfaceValidation?.canApply
                        ? "Form yüzeyi doğrulandı."
                        : "Form yüzeyi doğrulanmadan işlem başlatılamaz."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
                  onClick={() => void validateApplySurface()}
                  disabled={isValidatingSurface}
                >
                  {isValidatingSurface ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Tekrar Doğrula
                </Button>
              </div>
              {surfaceValidation?.formSurface ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>Güven: {surfaceValidation.formSurface.confidence || "-"}</span>
                  <span>Bulunan alan: {surfaceValidation.formSurface.requiredFieldsFound ?? 0}</span>
                  <span>Modül: {surfaceValidation.pageContext?.detectedModule || "-"}</span>
                </div>
              ) : null}
              {surfaceValidation?.blockingReasons?.length ? (
                <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                  {surfaceValidation.blockingReasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input type="checkbox" checked={reviewedPlan} onChange={(event) => setReviewedPlan(event.target.checked)} className="mt-1 rounded border-slate-600 bg-slate-950" />
              Önizleme planını kontrol ettim.
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input type="checkbox" checked={acceptedRealChange} onChange={(event) => setAcceptedRealChange(event.target.checked)} className="mt-1 rounded border-slate-600 bg-slate-950" />
              Bu işlemin İSG-KATİP üzerinde gerçek değişiklik yapacağını kabul ediyorum.
            </label>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Pilot test kontrol listesi</p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <p>{extensionStatus.isgKatipReady ? "✓" : "•"} İSG-KATİP oturumu açık mı?</p>
                <p>{extensionStatus.isgKatipOpen ? "✓" : "•"} Doğru İSG-KATİP ekranı açık mı?</p>
                <p>{surfaceValidation?.canApply ? "✓" : "•"} Form yüzeyi doğrulandı mı?</p>
                <p>{planHash ? "✓" : "•"} Plan hash geçerli mi?</p>
                <p>{selectedPlanRows.length === ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION ? "✓" : "•"} Seçili kayıt sayısı ilk canlı test için 1 mi?</p>
                <p>{reviewedPlan && acceptedRealChange && typedConfirmation.trim().toLocaleUpperCase("tr-TR") === "ONAYLIYORUM" ? "✓" : "•"} Çift onay tamamlandı mı?</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Devam etmek için ONAYLIYORUM yazın.</Label>
              <Input value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            {guardResult.reasons.length > 0 && (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                {guardResult.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => setApplyDialogOpen(false)} disabled={isApplying}>
              Vazgeç
            </Button>
            <Button className="bg-fuchsia-600 text-white hover:bg-fuchsia-500" onClick={() => void handleApply()} disabled={!guardResult.allowed || !surfaceValidation?.canApply || isApplying || isValidatingSurface}>
              {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Pilot İşlemi Başlat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExcessDurationUpdatePanelV2({
  runtime,
  onRun,
  companies,
  extensionStatus,
  userId,
  organizationId,
  onOperationsRefresh,
}: {
  runtime: FeatureRuntimeState;
  onRun: () => void;
  companies: IsgkatipCompanyRow[];
  extensionStatus: ExtensionStatus;
  userId?: string | null;
  organizationId?: string | null;
  onOperationsRefresh: () => Promise<void> | void;
}) {
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [planHash, setPlanHash] = useState<string | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [reviewedPlan, setReviewedPlan] = useState(false);
  const [acceptedRealChange, setAcceptedRealChange] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyInfo, setApplyInfo] = useState<string | null>(null);
  const [surfaceValidation, setSurfaceValidation] = useState<SurfaceValidationResult>(null);
  const [isValidatingSurface, setIsValidatingSurface] = useState(false);
  const [applyStage, setApplyStage] = useState("Hazır");
  const [isApplying, setIsApplying] = useState(false);
  const [applyResults, setApplyResults] = useState<ApplyResultRow[]>([]);
  const preview = useMemo(() => buildExcessDurationPreview(companies), [companies]);
  const selectedRows = useMemo(
    () => preview.rows.filter((row) => selectedRowIds.includes(row.id)),
    [preview.rows, selectedRowIds],
  );
  const applySummary = useMemo(() => summarizeApplyResults(applyResults), [applyResults]);
  const guardResult = useMemo(
    () =>
      canApplyExcessDuration({
        applyEnabled: ISGBOT_APPLY_ENABLED,
        extensionStatus,
        previewRows: preview.rows,
        selectedRows,
        planHash,
        confirmation: {
          reviewedPlan,
          acceptedRealChange,
          typedConfirmation,
        },
        pilotLimit: ISGBOT_PILOT_LIMIT,
      }),
    [acceptedRealChange, extensionStatus, planHash, preview.rows, reviewedPlan, selectedRows, typedConfirmation],
  );

  const handleGeneratePreview = () => {
    setPreviewGenerated(true);
    setPlanHash(
      createPlanHash({
        type: "excess_duration_update_apply",
        rows: preview.rows.map((row) => ({
          id: row.id,
          companyName: row.companyName,
          sgkNo: row.sgkNo,
          assignedMinutes: row.assignedMinutes,
          requiredMinutes: row.requiredMinutes,
          suggestedMinutes: row.suggestedMinutes,
        })),
      }),
    );
    setSelectedRowIds([]);
    setApplyResults(
      preview.rows.map((row) =>
        normalizeApplyResult({
          id: row.id,
          companyName: row.companyName,
          sgkNo: row.sgkNo,
          operationType: "Fazla Süre Güncelleme",
          status: "pending",
        }),
      ),
    );
    setApplyInfo(
      `Canlı pilot mod aktiftir. İlk aşamada yalnızca seçili ${ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION} kayıt üzerinde gerçek İSG-KATİP işlemi denenmelidir.`,
    );
    setApplyError(null);
    setSurfaceValidation(null);
    setIsValidatingSurface(false);
    onRun();
  };

  const validateApplySurface = useCallback(async () => {
    if (!ISGBOT_APPLY_ENABLED) {
      setSurfaceValidation(null);
      return false;
    }

    if (selectedRows.length === 0) {
      setSurfaceValidation({
        canApply: false,
        blockingReasons: ["İşlem yapılacak kayıt seçilmedi."],
      });
      return false;
    }

    setIsValidatingSurface(true);
    try {
      const response = await validateDurationSurface({
        planHash,
        records: selectedRows.map((row) => ({
          id: row.id,
          companyName: row.companyName,
          sgkNo: row.sgkNo,
          currentAssignedMinutes: row.assignedMinutes,
          requiredMinutes: row.requiredMinutes,
          newAssignedMinutes: row.suggestedMinutes,
        })),
      });

      const nextValidation =
        (response?.validation as SurfaceValidationResult) ||
        ({
          canApply: false,
          blockingReasons: [response?.error || ISGBOT_FORM_SURFACE_ERROR_MESSAGE],
        } satisfies SurfaceValidationResult);

      setSurfaceValidation(nextValidation);
      return Boolean(response?.success && nextValidation?.canApply);
    } catch (error) {
      console.error("ISGBot duration surface validation failed:", error);
      const message = getIsgbotFriendlyErrorMessage(error, ISGBOT_FORM_SURFACE_ERROR_MESSAGE);
      setSurfaceValidation({
        canApply: false,
        blockingReasons: [message],
      });
      return false;
    } finally {
      setIsValidatingSurface(false);
    }
  }, [planHash, selectedRows]);

  const openApplyDialog = async () => {
    setApplyDialogOpen(true);
    await validateApplySurface();
  };

  useEffect(() => {
    setSurfaceValidation(null);
  }, [planHash, selectedRowIds]);

  const handleExport = () => {
    if (preview.rows.length === 0) {
      toast.error("CSV için indirilebilir fazla süre önizlemesi bulunamadı.");
      return;
    }

    downloadCsv(
      `isgvizyon-fazla-sure-onizleme-${new Date().toISOString().slice(0, 10)}.csv`,
      preview.rows.map((row) => ({
        "Rapor": "İSGVİZYON Fazla Süre Önizleme Raporu",
        "Firma Adı": row.companyName,
        "SGK No": row.sgkNo,
        "Çalışan Sayısı": row.employeeCount,
        "Tehlike Sınıfı": row.hazardClass,
        "Mevcut Atanmış Dakika": row.assignedMinutes,
        "Gerekli Dakika": row.requiredMinutes,
        "Fazla Dakika": row.excessMinutes,
        "Önerilen Yeni Dakika": row.suggestedMinutes,
        "Risk/Etki Notu": row.impactNote,
        "Durum": row.status,
      })),
    );
  };

  const handleExportApplyResults = () => {
    const rows = applyResults.filter((row) => row.status !== "pending");
    if (rows.length === 0) {
      toast.error("Sonuç raporu için önce pilot işlemi çalıştırın.");
      return;
    }
    exportApplyResultsCsv("İSGVİZYON Gerçek İşlem Sonuç Raporu", rows, downloadCsv);
  };

  const toggleRow = (rowId: string) => {
    setSelectedRowIds((current) => {
      if (current.includes(rowId)) return current.filter((value) => value !== rowId);
      if (current.length >= ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION) {
        toast.error(`Canlı pilot modda ilk aşamada en fazla ${ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION} kayıt seçebilirsiniz.`);
        return current;
      }
      return [...current, rowId];
    });
  };

  const handleApply = async () => {
    if (!userId || !organizationId) {
      setApplyError("Organizasyon bilgisi bulunamadı.");
      return;
    }

    if (!guardResult.allowed) {
      setApplyError(guardResult.reasons[0] || "Gerçek işlem için doğrulama başarısız.");
      return;
    }

    const validated = surfaceValidation?.canApply ? true : await validateApplySurface();
    if (!validated) {
      setApplyError(surfaceValidation?.blockingReasons?.[0] || "Form yüzeyi doğrulanmadan işlem başlatılamaz.");
      return;
    }

    const operation = await startClientOperation(userId, organizationId, {
      operationType: "excess_duration_update_apply",
      operationTitle: "Fazla Süre Pilot Apply",
      source: "web_app",
      inputSummary: {
        feature_id: "excess-duration-update",
        plan_hash: planHash,
        selected_count: selectedRows.length,
        pilot_limit: ISGBOT_PILOT_LIMIT,
      },
    });

    setIsApplying(true);
    setApplyError(null);
    setApplyInfo(null);
    setApplyStage("İSG-KATİP oturumu kontrol ediliyor");
    setApplyResults((current) =>
      current.map((row) =>
        selectedRowIds.includes(row.id)
          ? { ...row, status: "processing", reason: null, processedAt: null }
          : row,
      ),
    );

    try {
      const response = await sendExcessDurationApply({
        operationId: operation.id,
        planHash,
        validation: surfaceValidation,
        records: selectedRows.map((row) => ({
          id: row.id,
          companyId: row.id,
          sgkNo: row.sgkNo,
          companyName: row.companyName,
          currentAssignedMinutes: row.assignedMinutes,
          requiredMinutes: row.requiredMinutes,
          newAssignedMinutes: row.suggestedMinutes,
          differenceMinutes: row.excessMinutes,
        })),
      });

      if (!response?.success && !response?.results?.length) {
        throw new Error(response?.error || "Pilot işlem başarısız oldu.");
      }

      const resultMap = new Map(
        (response?.results || []).map((item) => [
          String(item.id || ""),
          normalizeApplyResult({
            id: String(item.id || ""),
            companyName: String(item.companyName || "Firma"),
            sgkNo: String(item.sgkNo || "-"),
            operationType: "Fazla Süre Güncelleme",
            status: (item.status as ApplyResultRow["status"]) || "failed",
            reason: typeof item.reason === "string" ? item.reason : null,
            processedAt: typeof item.processedAt === "string" ? item.processedAt : new Date().toISOString(),
            stage: typeof item.stage === "string" ? item.stage : null,
            verificationStatus: typeof item.verificationStatus === "string" ? item.verificationStatus : null,
            selectorConfidence: typeof item.selectorConfidence === "string" ? item.selectorConfidence : null,
            durationMs: typeof item.durationMs === "number" ? item.durationMs : null,
          }),
        ]),
      );

      const mergedResults = preview.rows.map((row) => {
        const matched = resultMap.get(row.id);
        if (matched) return matched;
        return normalizeApplyResult({
          id: row.id,
          companyName: row.companyName,
          sgkNo: row.sgkNo,
          operationType: "Fazla Süre Güncelleme",
          status: selectedRowIds.includes(row.id) ? "skipped" : "pending",
          reason: selectedRowIds.includes(row.id) ? "Pilot işlem sonucu dönmedi." : null,
          processedAt: selectedRowIds.includes(row.id) ? new Date().toISOString() : null,
        });
      });

      setApplyResults(mergedResults);
      setApplyStage("Tamamlandı");
      const selectedResults = mergedResults.filter((row) => selectedRowIds.includes(row.id));
      const summary = summarizeApplyResults(selectedResults);

      await finishClientOperation(
        operation,
        summary.failed_count > 0 && summary.success_count > 0 ? "partial" : summary.failed_count > 0 ? "failed" : "success",
        {
          ...summary,
          selected_count: selectedRows.length,
          plan_hash: planHash,
          total_reduced_minutes: selectedRows.reduce((sum, row) => sum + row.excessMinutes, 0),
          validate_surface_passed: Boolean(surfaceValidation?.canApply),
          validate_surface_confidence: surfaceValidation?.formSurface?.confidence || null,
          selector_confidence: surfaceValidation?.formSurface?.confidence || null,
          blocking_reasons: surfaceValidation?.blockingReasons || [],
          rows: selectedResults,
        },
        response?.error || null,
      );
      await onOperationsRefresh();

      setApplyDialogOpen(false);
      setApplyInfo(
        summary.success_unverified_count > 0
          ? "İşlem gönderildi ancak İSG-KATİP ekranında sonuç doğrulanamadı. Lütfen kaydı manuel kontrol edin."
          : summary.failed_count > 0
            ? "Bazı kayıtlar işlenemedi. Sonuç raporunu kontrol edin."
            : `${summary.success_count} kayıt pilot modda işlendi.`,
      );
    } catch (error) {
      console.error("ISGBot excess duration apply failed:", error);
      const message = getIsgbotFriendlyErrorMessage(error, "Pilot işlem sırasında beklenmeyen bir hata oluştu. Lütfen eklenti bağlantısını, İSG-KATİP oturumunu ve seçili kaydı kontrol edin.");
      await finishClientOperation(operation, "failed", {
        selected_count: selectedRows.length,
        plan_hash: planHash,
        total_reduced_minutes: selectedRows.reduce((sum, row) => sum + row.excessMinutes, 0),
        validate_surface_passed: Boolean(surfaceValidation?.canApply),
        validate_surface_confidence: surfaceValidation?.formSurface?.confidence || null,
        selector_confidence: surfaceValidation?.formSurface?.confidence || null,
        blocking_reasons: surfaceValidation?.blockingReasons || [],
      }, message);
      await onOperationsRefresh();
      setApplyStage("Hatalı");
      setApplyError(message);
      setApplyResults((current) =>
        current.map((row) =>
          selectedRowIds.includes(row.id)
            ? { ...row, status: "failed", reason: message, processedAt: new Date().toISOString() }
            : row,
        ),
      );
      toast.error("Pilot işlem başlatılamadı", { description: message });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert className={cn("text-emerald-50", ISGBOT_APPLY_ENABLED ? "border-emerald-400/25 bg-emerald-500/10" : "border-slate-500/25 bg-slate-500/10")}>
        <Layers className="h-4 w-4 text-emerald-300" />
        <AlertTitle>{ISGBOT_APPLY_ENABLED ? "Önizleme + Pilot Gerçek İşlem" : "Önizleme Modu · Gerçek işlem kapalı"}</AlertTitle>
        <AlertDescription className="text-emerald-100/80">
          {ISGBOT_APPLY_ENABLED
            ? `Canlı pilot mod aktiftir. İlk aşamada yalnızca seçili ${ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION} kayıt üzerinde gerçek İSG-KATİP işlemi denenmelidir. Teknik pilot limit ${ISGBOT_PILOT_LIMIT} kayıttır ancak ilk canlı testte tek kayıt önerilir.`
            : "Bu işlem yalnızca fazla atama önizlemesi oluşturur. İSG-KATİP üzerinde otomatik güncelleme yapılmaz."}
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricTile label="Analiz Edilen" value={preview.summary.analyzed_company_count} tone="blue" />
        <MetricTile label="Fazla Atama" value={preview.summary.excess_assignment_count} tone="amber" />
        <MetricTile label="Toplam Fazla Dk" value={preview.summary.total_excess_minutes} tone="rose" />
        <MetricTile label="Hesaplanamayan" value={preview.summary.missing_data_count} tone="slate" />
        <MetricTile label="Öneri" value={preview.summary.recommendation_count} tone="emerald" />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30 sm:flex-row sm:flex-wrap">
        <Button className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-400" onClick={handleGeneratePreview}>
          Önizleme Oluştur
        </Button>
        <Button variant="outline" className="rounded-xl border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800" onClick={handleExport}>
          CSV Olarak İndir
        </Button>
        <Button className="rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-500 disabled:bg-slate-700 disabled:text-slate-300" onClick={() => void openApplyDialog()} disabled={!ISGBOT_APPLY_ENABLED || !previewGenerated || selectedRows.length === 0 || isApplying}>
          Gerçek İşlem İçin Onayla
        </Button>
        <Button variant="outline" className="rounded-xl border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20" onClick={handleExportApplyResults} disabled={applyResults.filter((row) => row.status !== "pending").length === 0}>
          Sonuç Raporunu İndir
        </Button>
      </div>

      {previewGenerated && preview.rows.length > 0 && (
        <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
          {preview.rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={selectedRowIds.includes(row.id)} onChange={() => toggleRow(row.id)} disabled={!ISGBOT_APPLY_ENABLED || isApplying} className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-fuchsia-500 focus:ring-fuchsia-500" />
                  <div>
                    <p className="font-black text-white">{row.companyName}</p>
                    <p className="mt-1 text-xs text-slate-400">SGK: {row.sgkNo} · {row.hazardClass} · {row.employeeCount} çalışan</p>
                  </div>
                </label>
                <Badge variant="outline" className="rounded-full border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                  {row.status}
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
                <span>Atanmış: {row.assignedMinutes} dk</span>
                <span>Gerekli: {row.requiredMinutes} dk</span>
                <span>Fazla: {row.excessMinutes} dk</span>
                <span>Öneri: {row.suggestedMinutes} dk</span>
              </div>
              <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">{row.impactNote}</p>
            </div>
          ))}
        </div>
      )}

      {applyInfo && (
        <Alert className="border-blue-400/25 bg-blue-500/10 text-blue-50">
          <CheckCircle2 className="h-4 w-4 text-blue-300" />
          <AlertTitle>Pilot işlem bilgisi</AlertTitle>
          <AlertDescription className="text-blue-100/80">{applyInfo}</AlertDescription>
        </Alert>
      )}

      {applyError && (
        <Alert className="border-rose-400/25 bg-rose-500/10 text-rose-50">
          <AlertCircle className="h-4 w-4 text-rose-300" />
          <AlertTitle>İşlem başlatılamadı</AlertTitle>
          <AlertDescription className="text-rose-100/80">{applyError}</AlertDescription>
        </Alert>
      )}

      {applyResults.some((row) => row.status !== "pending") && (
        <div className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-lg shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-black text-white">Pilot işlem sonucu</h4>
              <p className="mt-1 text-xs text-slate-400">{applyStage}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <MetricTile label="Doğrulanmış" value={applySummary.success_verified_count} tone="emerald" />
              <MetricTile label="Teyitsiz" value={applySummary.success_unverified_count} tone="blue" />
              <MetricTile label="Hatalı" value={applySummary.failed_count} tone="rose" />
              <MetricTile label="Atlandı" value={applySummary.skipped_count} tone="amber" />
              <MetricTile label="Toplam" value={applySummary.total_count} tone="blue" />
            </div>
          </div>
          <div className="space-y-2">
            {applyResults.filter((row) => row.status !== "pending").map((row) => (
              <div key={`excess-result-${row.id}`} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{row.companyName}</p>
                    <p className="mt-1 text-xs text-slate-400">SGK: {row.sgkNo}</p>
                  </div>
                  <Badge variant="outline" className={cn("rounded-full", (row.status === "success" || row.status === "success_verified") && "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", row.status === "success_unverified" && "border-blue-400/30 bg-blue-500/10 text-blue-200", row.status === "failed" && "border-rose-400/30 bg-rose-500/10 text-rose-200", row.status === "skipped" && "border-amber-400/30 bg-amber-500/10 text-amber-200", row.status === "processing" && "border-blue-400/30 bg-blue-500/10 text-blue-200")}>
                    {row.status === "success_verified" ? "Doğrulanmış başarı" : row.status === "success_unverified" ? "Başarılı ama doğrulanamadı" : row.status === "success" ? "Başarılı" : row.status === "failed" ? "Hatalı" : row.status === "skipped" ? "Atlandı" : "İşleniyor"}
                  </Badge>
                </div>
                {row.status === "success_verified" ? (
                  <p className="mt-2 text-xs text-emerald-200">Doğrulanmış başarı: İşlem İSG-KATİP ekranında teyit edildi.</p>
                ) : null}
                {row.status === "success_unverified" ? (
                  <p className="mt-2 text-xs text-blue-200">İşlem gönderildi ancak İSG-KATİP ekranında sonuç doğrulanamadı. Lütfen kaydı manuel kontrol edin.</p>
                ) : null}
                {row.status === "skipped" ? (
                  <p className="mt-2 text-xs text-amber-200">Atlandı: Kayıt güvenlik veya veri eksikliği nedeniyle işleme alınmadı.</p>
                ) : null}
                {row.reason && <p className="mt-2 text-xs text-slate-300">{row.reason}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {row.processedAt ? <span>İşlem zamanı: {formatSyncLabel(row.processedAt)}</span> : null}
                  {row.stage ? <span>Aşama: {row.stage}</span> : null}
                  {row.verificationStatus ? <span>Doğrulama: {row.verificationStatus}</span> : null}
                  {row.selectorConfidence ? <span>Selector: {row.selectorConfidence}</span> : null}
                  {typeof row.durationMs === "number" ? <span>Süre: {row.durationMs} ms</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent overlayClassName="z-[65] bg-slate-950/90 backdrop-blur-md" className="z-[70] rounded-2xl border border-slate-700/70 bg-slate-950 text-slate-50 shadow-2xl shadow-black/70 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerçek İSG-KATİP İşlemi Onayı</DialogTitle>
            <DialogDescription className="text-slate-300">
              Bu işlem İSG-KATİP üzerinde gerçek değişiklik yapacaktır. Lütfen önizleme planındaki bilgileri kontrol edin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="İşlem türü" value="Pilot Süre Güncelleme" tone="emerald" />
              <MetricTile label="Toplam kayıt" value={preview.rows.length} tone="blue" />
              <MetricTile label="Seçili kayıt" value={selectedRows.length} tone="emerald" />
              <MetricTile label="Toplam azaltım" value={`${selectedRows.reduce((sum, row) => sum + row.excessMinutes, 0)} dk`} tone="rose" />
              <MetricTile label="Atlanacak kayıt" value={preview.rows.length - selectedRows.length} tone="slate" />
              <MetricTile label="Tahmini süre" value={`${Math.max(1, selectedRows.length)} dk`} tone="amber" />
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Plan hash / işlem referansı</p>
              <p className="mt-2 break-all text-sm font-bold text-white">{planHash || "-"}</p>
              <p className="mt-2 text-xs text-slate-400">Pilot mod: Teknik limit {ISGBOT_PILOT_LIMIT} kayıttır. İlk canlı testte yalnızca 1 kayıt seçilmelidir.</p>
            </div>
            <div className="rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4 text-sm text-blue-100">
              <p className="font-bold text-blue-50">Canlı pilot mod aktiftir.</p>
              <p className="mt-1">İlk aşamada yalnızca seçili 1 kayıt üzerinde gerçek İSG-KATİP işlemi denenmelidir.</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">İSG-KATİP form doğrulaması</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {isValidatingSurface
                      ? "İşlem yüzeyi kontrol ediliyor."
                      : surfaceValidation?.canApply
                        ? "Form yüzeyi doğrulandı."
                        : "Form yüzeyi doğrulanmadan işlem başlatılamaz."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
                  onClick={() => void validateApplySurface()}
                  disabled={isValidatingSurface}
                >
                  {isValidatingSurface ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Tekrar Doğrula
                </Button>
              </div>
              {surfaceValidation?.formSurface ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>Güven: {surfaceValidation.formSurface.confidence || "-"}</span>
                  <span>Bulunan alan: {surfaceValidation.formSurface.requiredFieldsFound ?? 0}</span>
                  <span>Modül: {surfaceValidation.pageContext?.detectedModule || "-"}</span>
                </div>
              ) : null}
              {surfaceValidation?.blockingReasons?.length ? (
                <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                  {surfaceValidation.blockingReasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input type="checkbox" checked={reviewedPlan} onChange={(event) => setReviewedPlan(event.target.checked)} className="mt-1 rounded border-slate-600 bg-slate-950" />
              Önizleme planını kontrol ettim.
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input type="checkbox" checked={acceptedRealChange} onChange={(event) => setAcceptedRealChange(event.target.checked)} className="mt-1 rounded border-slate-600 bg-slate-950" />
              Bu işlemin İSG-KATİP üzerinde gerçek değişiklik yapacağını kabul ediyorum.
            </label>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Pilot test kontrol listesi</p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <p>{extensionStatus.isgKatipReady ? "✓" : "•"} İSG-KATİP oturumu açık mı?</p>
                <p>{extensionStatus.isgKatipOpen ? "✓" : "•"} Doğru İSG-KATİP ekranı açık mı?</p>
                <p>{surfaceValidation?.canApply ? "✓" : "•"} Form yüzeyi doğrulandı mı?</p>
                <p>{planHash ? "✓" : "•"} Plan hash geçerli mi?</p>
                <p>{selectedRows.length === ISGBOT_LIVE_PILOT_RECOMMENDED_SELECTION ? "✓" : "•"} Seçili kayıt sayısı ilk canlı test için 1 mi?</p>
                <p>{reviewedPlan && acceptedRealChange && typedConfirmation.trim().toLocaleUpperCase("tr-TR") === "ONAYLIYORUM" ? "✓" : "•"} Çift onay tamamlandı mı?</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Devam etmek için ONAYLIYORUM yazın.</Label>
              <Input value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} className="border-slate-700 bg-slate-900 text-white" />
            </div>
            {guardResult.reasons.length > 0 && (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                {guardResult.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => setApplyDialogOpen(false)} disabled={isApplying}>
              Vazgeç
            </Button>
            <Button className="bg-fuchsia-600 text-white hover:bg-fuchsia-500" onClick={() => void handleApply()} disabled={!guardResult.allowed || !surfaceValidation?.canApply || isApplying || isValidatingSurface}>
              {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Pilot İşlemi Başlat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StatusAlert {...runtime} onRetry={onRun} />
    </div>
  );
}

function FeatureDialog({
  feature,
  open,
  onOpenChange,
  runtime,
  onRun,
  onMultiAssignmentDryRun,
  companies,
  flags,
  changeResult,
  extensionStatus,
  userId,
  organizationId,
  onOperationsRefresh,
}: {
  feature: BotFeature | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runtime: FeatureRuntimeState;
  onRun: () => void;
  onMultiAssignmentDryRun: (result: MultiAssignmentDryRunResult) => void;
  companies: IsgkatipCompanyRow[];
  flags: IsgkatipFlagRow[];
  changeResult: KatipChangeResult | null;
  extensionStatus: ExtensionStatus;
  userId?: string | null;
  organizationId?: string | null;
  onOperationsRefresh: () => Promise<void> | void;
}) {
  if (!feature) return null;
  const Icon = feature.icon;
  const styles = toneStyles[feature.tone];
  const canRunServerAction = feature.id === "change-tracking";
  const supportsPilotApply =
    ISGBOT_APPLY_ENABLED &&
    (feature.id === "multi-assignment" || feature.id === "excess-duration-update");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[55] bg-slate-950/85 backdrop-blur-md"
        className="z-[60] max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-0 text-slate-50 shadow-2xl shadow-black/70 sm:max-w-5xl [&>button]:rounded-xl [&>button]:text-slate-400 [&>button:hover]:bg-slate-800 [&>button:hover]:text-white"
      >
        <DialogHeader className="border-b border-slate-800/90 bg-slate-950/80 px-6 py-5 text-left">
          <div className="flex items-start gap-4">
            <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", styles.icon)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-2xl font-black text-slate-50">{feature.title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6 text-slate-300">{feature.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 bg-slate-950/35 px-6 py-5">
          {feature.id === "multi-assignment" && (
            <MultiAssignmentPanelV2
              companies={companies}
              onRecordDryRun={onMultiAssignmentDryRun}
              extensionStatus={extensionStatus}
              userId={userId}
              organizationId={organizationId}
              onOperationsRefresh={onOperationsRefresh}
            />
          )}
          {feature.id === "contract-download" && (
            <ContractDownloadPanel
              runtime={runtime}
              onRun={onRun}
              companies={companies}
              userId={userId}
              organizationId={organizationId}
              onOperationsRefresh={onOperationsRefresh}
            />
          )}
          {feature.id === "contracts-need-update" && <ContractsNeedUpdatePanel runtime={runtime} onRun={onRun} companies={companies} flags={flags} />}
          {feature.id === "excess-duration-update" && (
            <ExcessDurationUpdatePanelV2
              runtime={runtime}
              onRun={onRun}
              companies={companies}
              extensionStatus={extensionStatus}
              userId={userId}
              organizationId={organizationId}
              onOperationsRefresh={onOperationsRefresh}
            />
          )}
          {feature.id === "contract-status-report" && <ContractStatusReportPanel runtime={runtime} onRun={onRun} companies={companies} />}
          {feature.id === "duration-analysis" && <DurationAnalysisPanel runtime={runtime} onRun={onRun} companies={companies} />}
          {feature.id === "change-tracking" && <KatipChangeTrackingPanel runtime={runtime} result={changeResult} onRun={onRun} />}
        </div>

        <DialogFooter className="border-t border-slate-800/90 bg-slate-950/80 px-6 py-4 sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            İşlemler, kullanıcının kendi yetkili İSG-KATİP oturumunda görebildiği verilerle sınırlıdır.
          </p>
          {!canRunServerAction && feature.id !== "contract-download" && !supportsPilotApply && (
            <Badge variant="outline" className="rounded-xl border-blue-400/30 bg-blue-500/10 px-4 py-2 text-blue-100">
              Bu işlem şu anda yalnızca önizleme modundadır.
            </Badge>
          )}
          {supportsPilotApply && (
            <Badge variant="outline" className="rounded-xl border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-fuchsia-100">
              Önizleme tamamlandıktan sonra pilot gerçek işlem başlatılabilir.
            </Badge>
          )}
          {canRunServerAction && (
          <Button className={cn("rounded-xl text-white", styles.button)} onClick={onRun} disabled={runtime.loading}>
            {runtime.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Değişiklikleri Tara
          </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ISGBot() {
  const { user, profile } = useAuth();
  const { isOsgbPlan } = useSubscription();
  const [snapshot, setSnapshot] = useState<BotSnapshot>({
    companies: [],
    companyCount: 0,
    lastSyncedAt: null,
    connectionStatus: "offline",
  });
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>(initialExtensionStatus);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<BotFeature | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<ImportTarget>("personal");
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [existingPersonalCompanyIdentities, setExistingPersonalCompanyIdentities] = useState<ExistingCompanyIdentity[]>([]);
  const [changeResult, setChangeResult] = useState<KatipChangeResult | null>(null);
  const [complianceFlags, setComplianceFlags] = useState<IsgkatipFlagRow[]>([]);
  const [operationHistory, setOperationHistory] = useState<IsgbotOperationRow[]>([]);
  const [operationsNotice, setOperationsNotice] = useState<string | null>(null);
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [runtimeByFeature, setRuntimeByFeature] = useState<Partial<Record<FeatureId, FeatureRuntimeState>>>({});

  const checkExtensionStatus = useCallback(async () => {
    setExtensionStatus((current) => ({
      ...current,
      state: "checking",
      label: "Eklenti kontrol ediliyor",
      description: "Tarayıcı eklentisi bağlantısı doğrulanıyor.",
      error: null,
    }));

    const response = (await requestExtensionStatusViaBridge()) || (await requestExtensionStatusDirect());

    if (!response?.success) {
      const hasServerSync = snapshot.companyCount > 0 || Boolean(snapshot.lastSyncedAt);
      setExtensionStatus({
        state: hasServerSync ? "error" : "not_installed",
        label: hasServerSync ? "Canlı durum alınamıyor" : "Eklenti kurulu değil",
        description: hasServerSync
          ? "Sunucu verisi güncel; ancak tarayıcı eklentisinden canlı durum alınamıyor. Eklentiyi yenileyip tekrar kontrol edin."
          : "Tarayıcı eklentisi bulunamadı veya yanıt vermiyor. Lütfen eklentiyi kontrol edin ya da eklenti sayfasını yenileyin.",
        installed: false,
        authenticated: false,
        isgKatipReady: false,
        isgKatipOpen: false,
        version: null,
        extensionLastSyncedAt: null,
        totalCompanies: null,
        systemStatus: null,
        source: null,
        lastCheckedAt: new Date().toISOString(),
      });
      return;
    }

    const isAuthenticated = Boolean(response.authenticated ?? response.isAuthenticated);
    const isgKatipOpen = Boolean(response.isgKatip?.hasTab);
    const isgKatipReady = Boolean(
      response.isReady ||
        response.isKatipSessionActive ||
        response.isgKatip?.state === "ready" ||
        (response.isgKatip?.isLoggedIn && response.isgKatip?.isTargetPage),
    );
    const version = response.extensionVersion ?? response.version ?? null;
    const extensionLastSyncedAt = response.extensionLastSyncedAt ?? response.lastSyncAt ?? null;
    const commonStatus = {
      installed: true,
      isgKatipOpen,
      version,
      extensionLastSyncedAt,
      totalCompanies: response.totalCompanies ?? null,
      systemStatus: response.systemStatus ?? null,
      source: response.source ?? "extension",
      lastCheckedAt: new Date().toISOString(),
    };

    if (!isAuthenticated) {
      setExtensionStatus({
        ...commonStatus,
        state: "installed_no_auth",
        label: "Eklenti bağlı",
        description: "Eklenti kurulu ancak ISGVizyon oturumu uzantıya aktarılmamış. Lütfen eklenti üzerinden giriş yapın.",
        authenticated: false,
        isgKatipReady,
      });
      return;
    }

    if (!isgKatipReady) {
      setExtensionStatus({
        ...commonStatus,
        state: "isgkatip_login_required",
        label: "İSG-KATİP oturumu gerekli",
        description: isgKatipOpen
          ? "İSG-KATİP sekmesi açık görünüyor; senkron için oturumunuzu kontrol edin."
          : "Senkron için İSG-KATİP sayfasını açıp yetkili oturumunuzla giriş yapın.",
        authenticated: true,
        isgKatipReady: false,
      });
      return;
    }

    setExtensionStatus({
      ...commonStatus,
      state: "sync_ready",
      label: "Senkron hazır",
      description: "Eklenti bağlı ve İSG-KATİP oturumu hazır görünüyor.",
      authenticated: true,
      isgKatipReady: true,
    });
  }, [snapshot.companyCount, snapshot.lastSyncedAt]);

  const loadSnapshot = useCallback(async (options: { silent: boolean }) => {
    if (!user?.id) {
      setSnapshot({
        companies: [],
        companyCount: 0,
        lastSyncedAt: null,
        connectionStatus: "offline",
      });
      setLoadingSnapshot(false);
      return {
        companies: [],
        companyCount: 0,
        lastSyncedAt: null,
        connectionStatus: "offline" as const,
      };
    }

    if (!options.silent) setLoadingSnapshot(true);
    try {
      const rows = await listIsgkatipCompanies({
        userId: user.id,
        select:
          "id, company_name, sgk_no, last_synced_at, contract_start, contract_end, contract_status, risk_score, hazard_class, employee_count, nace_code, assigned_minutes, required_minutes",
        orderBy: "company_name",
        ascending: true,
      });

      const companyCount = rows.length;
      const lastSyncedAt = getLatestIsoDate(rows.map((row) => row.last_synced_at));
      const nextSnapshot = {
        companies: rows,
        companyCount,
        lastSyncedAt,
        connectionStatus: companyCount > 0 ? "connected" : "waiting",
      } as BotSnapshot;
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (error) {
      console.error("ISGBot snapshot load failed:", error);
      const message = getIsgbotFriendlyErrorMessage(
        error,
        "İSG-KATİP firma verileri yüklenemedi. Lütfen oturumunuzu, eklenti senkronunu ve internet bağlantınızı kontrol edin.",
      );
      const nextSnapshot = {
        companies: [],
        companyCount: 0,
        lastSyncedAt: null,
        connectionStatus: "waiting",
      } as BotSnapshot;
      setSnapshot(nextSnapshot);
      if (!options.silent) {
        setRuntime("company-import", { loading: false, error: message });
        toast.error("Firma verileri yüklenemedi", { description: message });
      }
      return nextSnapshot;
    } finally {
      if (!options.silent) setLoadingSnapshot(false);
    }
  }, [user?.id]);

  const loadOperations = useCallback(async () => {
    if (!profile?.organization_id) {
      setOperationHistory([]);
      return;
    }

    setLoadingOperations(true);
    try {
      const rows = await loadIsgbotOperations(profile.organization_id);
      setOperationHistory(rows);
      setOperationsNotice(null);
    } catch (error) {
      console.error("ISGBot operation history load failed:", error);
      const message = getIsgbotFriendlyErrorMessage(
        error,
        "İSGBot işlem kayıtları şu anda okunamadı. Lütfen daha sonra tekrar deneyin.",
      );
      setOperationsNotice(message);
      toast.error("İşlem geçmişi yüklenemedi", {
        description: message,
      });
    } finally {
      setLoadingOperations(false);
    }
  }, [profile?.organization_id]);

  const loadExistingPersonalCompanies = useCallback(async () => {
    if (!user?.id) {
      setExistingPersonalCompanyIdentities([]);
      return [];
    }

    try {
      const rows = await loadExistingPersonalCompanyIdentities(user.id);
      setExistingPersonalCompanyIdentities(rows);
      return rows;
    } catch (error) {
      console.error("ISGBot existing personal companies load failed:", error);
      setExistingPersonalCompanyIdentities([]);
      toast.warning("Mevcut firmalar kontrol edilemedi.", {
        description: getIsgbotFriendlyErrorMessage(
          error,
          "Daha önce eklediğiniz firmalar doğrulanamadı. Aktarım öncesi listeyi dikkatli kontrol edin.",
        ),
      });
      return [];
    }
  }, [user?.id]);

  const loadComplianceFlags = useCallback(async () => {
    if (!user?.id || !profile?.organization_id) {
      setComplianceFlags([]);
      return;
    }

    try {
      const flags = await listIsgkatipComplianceFlags({
        userId: user.id,
        organizationId: profile.organization_id,
        status: "OPEN",
        limit: 250,
      });
      setComplianceFlags(flags);
    } catch (error) {
      console.error("ISGBot compliance flags load failed:", error);
      setComplianceFlags([]);
    }
  }, [profile?.organization_id, user?.id]);

  const importRuntime = runtimeByFeature["company-import"] ?? {};
  const alreadyImportedCompanyIds = useMemo(
    () =>
      importTarget === "personal"
        ? snapshot.companies
            .filter((company) => isKatipCompanyAlreadyImported(company, existingPersonalCompanyIdentities))
            .map((company) => company.id)
        : [],
    [existingPersonalCompanyIdentities, importTarget, snapshot.companies],
  );

  useEffect(() => {
    if (!user?.id) {
      void loadSnapshot({ silent: true });
      return;
    }

    let cancelled = false;

    void loadSnapshot({ silent: false }).finally(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [loadSnapshot, user?.id]);

  useEffect(() => {
    void checkExtensionStatus();
  }, [checkExtensionStatus]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  useEffect(() => {
    void loadExistingPersonalCompanies();
  }, [loadExistingPersonalCompanies]);

  useEffect(() => {
    if (alreadyImportedCompanyIds.length === 0) return;
    setSelectedImportIds((current) => current.filter((id) => !alreadyImportedCompanyIds.includes(id)));
  }, [alreadyImportedCompanyIds]);

  useEffect(() => {
    void loadComplianceFlags();
  }, [loadComplianceFlags]);

  const hasSyncedCompanyData = snapshot.companyCount > 0;

  const connectionBadge = useMemo(() => {
    if (extensionStatus.state === "checking") {
      return {
        label: "Eklenti kontrol ediliyor",
        className: "border-slate-500/30 bg-slate-500/12 text-slate-200",
      };
    }

    if (extensionStatus.state === "sync_ready") {
      return {
        label: "Senkron hazır",
        className: "border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
      };
    }

    if (extensionStatus.state === "installed_no_auth") {
      return {
        label: "Eklenti bağlı, oturum gerekli",
        className: "border-blue-400/35 bg-blue-500/15 text-blue-200",
      };
    }

    if (extensionStatus.state === "isgkatip_login_required") {
      return {
        label: "İSG-KATİP oturumu gerekli",
        className: "border-amber-400/35 bg-amber-500/15 text-amber-200",
      };
    }

    if (extensionStatus.state === "error") {
      return {
        label: "Eklenti yanıt vermiyor",
        className: "border-amber-400/35 bg-amber-500/15 text-amber-200",
      };
    }

    return {
      label: "Eklenti kurulu değil",
      className: "border-rose-400/35 bg-rose-500/15 text-rose-200",
    };
  }, [extensionStatus.state]);

  const selectedRuntime = selectedFeature ? runtimeByFeature[selectedFeature.id] ?? {} : {};
  const extensionSyncIsNewer =
    Boolean(extensionStatus.extensionLastSyncedAt && snapshot.lastSyncedAt) &&
    new Date(extensionStatus.extensionLastSyncedAt!).getTime() > new Date(snapshot.lastSyncedAt!).getTime() + 60_000;

  const setRuntime = (featureId: FeatureId, next: FeatureRuntimeState) => {
    setRuntimeByFeature((current) => ({
      ...current,
      [featureId]: next,
    }));
  };

  const handleStartNewKatipSync = async () => {
    const status = extensionStatus.state;
    const operation =
      user?.id && profile?.organization_id
        ? await startClientOperation(user.id, profile.organization_id, {
            operationType: "isgkatip_batch_sync",
            operationTitle: "İSG-KATİP Yeni Senkron Yönlendirmesi",
            source: "web_app",
            inputSummary: {
              extension_state: status,
              guidance_only: true,
            },
          })
        : null;

    if (status === "not_installed") {
      const message = "Yeni senkron için ISGVizyon tarayıcı eklentisini kurmanız gerekir.";
      setRuntime("company-import", { loading: false, error: null, success: null, info: message });
      toast.info("Eklenti gerekli", { description: message });
      await finishClientOperation(operation, "partial", { guidance_only: true, reason: "extension_not_installed" });
      await loadOperations();
      window.open(ISGVIZYON_CHROME_EXTENSION_URL, "_blank", "noopener,noreferrer");
      return;
    }

    if (status === "installed_no_auth") {
      const message = "Eklenti bağlı ancak ISGVizyon oturumu uzantıya aktarılmamış. Lütfen eklenti panelinden giriş durumunu kontrol edin.";
      setRuntime("company-import", { loading: false, error: null, success: null, info: message });
      toast.info("Eklenti oturumu gerekli", { description: message });
      await checkExtensionStatus();
      await finishClientOperation(operation, "partial", { guidance_only: true, reason: "extension_auth_required" });
      await loadOperations();
      return;
    }

    if (status === "isgkatip_login_required" || status === "checking") {
      const message = "İSG-KATİP oturumu açılmalıdır. İSG-KATİP sayfasına gidip giriş yaptıktan sonra eklenti panelinden Firmalarımı Oku butonuna basın.";
      setRuntime("company-import", { loading: false, error: null, success: null, info: message });
      toast.info("İSG-KATİP oturumu gerekli", { description: "Sayfa açılıyor; giriş yaptıktan sonra eklenti panelinden senkronu başlatın." });
      window.open("https://isgkatip.csgb.gov.tr/kisi-kurum/kisi-karti/kisi-kartim", "_blank", "noopener,noreferrer");
      await checkExtensionStatus();
      await finishClientOperation(operation, "partial", { guidance_only: true, reason: "isgkatip_login_required" });
      await loadOperations();
      return;
    }

    const message =
      "İSG-KATİP sayfasına gidin, eklenti panelinden Firmalarımı Oku butonuna basın. Önizlemeyi onayladıktan sonra Son Senkron Verisini Yükle ile listeyi burada görebilirsiniz.";
    setRuntime("company-import", { loading: false, error: null, success: null, info: message });
    toast.info("Yeni senkron yönlendirmesi hazır", { description: "Gerçek okuma işlemi İSG-KATİP sayfasındaki eklenti panelinden başlatılır." });
    window.open("https://isgkatip.csgb.gov.tr/kisi-kurum/kisi-karti/kisi-kartim", "_blank", "noopener,noreferrer");
    await finishClientOperation(operation, "partial", { guidance_only: true, next_step: "extension_panel_sync" });
    await loadOperations();
  };

  const handleLoadImportCompanies = async () => {
    setRuntime("company-import", { loading: true, error: null, success: null });
    const operation =
      user?.id && profile?.organization_id
        ? await startClientOperation(user.id, profile.organization_id, {
            operationType: "get_companies",
            operationTitle: "Son Senkron Verisini Yükle",
            source: "web_app",
            inputSummary: { target: importTarget },
          })
        : null;

    try {
      const nextSnapshot = await loadSnapshot({ silent: true });
      await loadExistingPersonalCompanies();
      if (nextSnapshot.companyCount === 0) {
        setRuntime("company-import", {
          loading: false,
          info: "Firma verisi bulunamadı. Önce İSG-KATİP sayfasında eklenti panelinden senkronizasyon yapın.",
        });
        toast.info("Firma verisi bulunamadı", {
          description: "Önce İSG-KATİP üzerinden senkronizasyon yapmanız gerekir.",
        });
        await finishClientOperation(operation, "success", { count: 0 });
        await loadOperations();
        return;
      }

      setRuntime("company-import", {
        loading: false,
        success: "Firma listesi yüklendi. Aktarmak istediğiniz firmaları seçebilirsiniz.",
      });
      toast.success("Firma listesi yüklendi");
      await finishClientOperation(operation, "success", { count: nextSnapshot.companyCount });
      await loadOperations();
    } catch (error) {
      console.error("ISGBot company import load failed:", error);
      const message = getIsgbotFriendlyErrorMessage(
        error,
        "Firma listesi yüklenemedi. Lütfen eklenti bağlantınızı ve İSG-KATİP senkron durumunu kontrol edin.",
      );
      setRuntime("company-import", { loading: false, error: message });
      await finishClientOperation(operation, "failed", null, message);
      await loadOperations();
    }
  };

  const handleToggleImportCompany = (companyId: string) => {
    if (importTarget === "personal" && alreadyImportedCompanyIds.includes(companyId)) {
      toast.info("Bu firma zaten ekli", {
        description: "Daha önce Firmalarım alanına aktarılmış firmalar tekrar seçilemez.",
      });
      return;
    }

    setSelectedImportIds((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId],
    );
  };

  const handleSelectAllImportCompanies = () => {
    setSelectedImportIds(
      snapshot.companies
        .filter((company) => importTarget !== "personal" || !alreadyImportedCompanyIds.includes(company.id))
        .map((company) => company.id),
    );
  };

  const handleClearImportSelection = () => {
    setSelectedImportIds([]);
  };

  const handleImportTargetChange = (target: ImportTarget) => {
    setImportTarget(target);
    setSelectedImportIds([]);
  };

  const handleImportSelectedCompanies = async () => {
    if (!user?.id) {
      setRuntime("company-import", { loading: false, error: "Aktarım için önce giriş yapmalısınız." });
      return;
    }

    const selectedRows = snapshot.companies.filter(
      (company) =>
        selectedImportIds.includes(company.id) &&
        (importTarget !== "personal" || !alreadyImportedCompanyIds.includes(company.id)),
    );
    if (selectedRows.length === 0) {
      setRuntime("company-import", { loading: false, error: "Lütfen aktarılacak en az bir firma seçin." });
      return;
    }

    if (importTarget === "osgb" && (!isOsgbPlan || !profile?.organization_id)) {
      setRuntime("company-import", {
        loading: false,
        error: "OSGB Firma Takibi’ne aktarım için aktif OSGB paketi ve organizasyon hesabı gereklidir.",
      });
      return;
    }

    setRuntime("company-import", { loading: true, error: null, success: null });
    const operation =
      profile?.organization_id
        ? await startClientOperation(user.id, profile.organization_id, {
            operationType: "company_import",
            operationTitle: importTarget === "osgb" ? "OSGB Firma Takibine Aktarım" : "Firmalarım Alanına Aktarım",
            source: "web_app",
            inputSummary: {
              target: importTarget,
              selected: selectedRows.length,
            },
          })
        : null;

    try {
      if (importTarget === "osgb") {
        const imported = await importOsgbCompaniesFromKatip(user.id, profile!.organization_id!, selectedImportIds);
        setRuntime("company-import", {
          loading: false,
          success: `${imported} firma OSGB Firma Takibi sayfasına aktarıldı.`,
        });
        toast.success("OSGB firma takibine aktarıldı", { description: `${imported} firma işlendi.` });
        await finishClientOperation(operation, "success", {
          target: importTarget,
          total: selectedRows.length,
          imported,
          skipped: Math.max(0, selectedRows.length - imported),
        });
      } else {
        const result = await importRowsToPersonalCompanies(user.id, selectedRows);
        setRuntime("company-import", {
          loading: false,
          success: `${result.created} yeni firma eklendi, ${result.updated} firma güncellendi.`,
        });
        toast.success("Firmalarım alanına aktarıldı", {
          description: `${result.created} yeni · ${result.updated} güncellendi`,
        });
        await finishClientOperation(operation, "success", {
          target: importTarget,
          total: selectedRows.length,
          inserted: result.created,
          updated: result.updated,
          skipped: Math.max(0, selectedRows.length - result.created - result.updated),
        });
      }

      setSelectedImportIds([]);
      await loadSnapshot({ silent: true });
      await loadExistingPersonalCompanies();
      await loadComplianceFlags();
      await loadOperations();
    } catch (error) {
      console.error("ISGBot company import failed:", error);
      const message = getIsgbotFriendlyErrorMessage(
        error,
        "Firma aktarımı sırasında bir hata oluştu. Lütfen seçili firmaları, oturumunuzu ve firma verilerini kontrol edip tekrar deneyin.",
      );
      setRuntime("company-import", { loading: false, error: message });
      toast.error("Aktarım tamamlanamadı", { description: message });
      await finishClientOperation(operation, "failed", null, message);
      await loadOperations();
    }
  };

  const handleAnalyzeKatipChanges = async () => {
    if (!user?.id) {
      setRuntime("change-tracking", { loading: false, error: "Değişiklik takibi için önce giriş yapmalısınız." });
      return;
    }

    if (!profile?.organization_id) {
      setRuntime("change-tracking", {
        loading: false,
        error: "Değişiklik takibi için organizasyon bilgisi bulunamadı.",
      });
      return;
    }

    setRuntime("change-tracking", { loading: true, error: null, success: null });
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("ISGVizyon oturumu bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.");
      }

      const { data, error } = await supabase.functions.invoke("isgkatip-sync", {
        body: {
          action: "GET_CHANGE_TRACKING",
          data: {},
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || "Değişiklik takibi çalıştırılırken bir hata oluştu.");
      }

      const result = data?.result as KatipChangeResult;
      const currentRows = (data?.companies ?? []) as IsgkatipCompanyRow[];
      if (!result) {
        throw new Error("Değişiklik takibi sonucu alınamadı.");
      }

      setChangeResult(result);
      setSnapshot({
        companies: currentRows,
        companyCount: currentRows.length,
        lastSyncedAt: getLatestIsoDate(currentRows.map((row) => row.last_synced_at)),
        connectionStatus: currentRows.length > 0 ? "connected" : "waiting",
      });

      const success = !result.hasBaseline
        ? "Karşılaştırma için önce en az iki senkron kaydı gerekir."
        : result.changes.length === 0
          ? "Son senkrona göre değişiklik bulunmadı."
          : `${result.changes.length} değişiklik bulundu.`;

      setRuntime("change-tracking", { loading: false, success });
      toast.success("Değişiklik takibi tamamlandı", { description: success });
      await loadComplianceFlags();
      await loadOperations();
    } catch (error) {
      console.error("ISGBot change tracking failed:", error);
      const message = getIsgbotFriendlyErrorMessage(
        error,
        "Değişiklik takibi çalıştırılamadı. Lütfen eklenti bağlantınızı ve senkron verilerinizi kontrol edin.",
      );
      setRuntime("change-tracking", { loading: false, error: message });
      toast.error("Değişiklik takibi tamamlanamadı", { description: message });
      await loadOperations();
    }
  };

  const recordPreviewOperation = async (
    featureId: FeatureId,
    operationType: string,
    operationTitle: string,
    resultSummary: Record<string, unknown>,
  ) => {
    if (!user?.id || !profile?.organization_id) return;

    try {
      const operation = await startClientOperation(user.id, profile.organization_id, {
        operationType,
        operationTitle,
        source: "web_app",
        inputSummary: { feature_id: featureId },
      });
      await finishClientOperation(operation, "success", resultSummary);
      await loadOperations();
    } catch (error) {
      console.error("ISGBot preview operation log failed:", error);
      toast.warning("Önizleme hazırlandı ancak işlem geçmişi yazılamadı.", {
        description: getIsgbotFriendlyErrorMessage(
          error,
          "İşlem geçmişi kaydı şu anda oluşturulamadı. Önizleme sonucunu kullanabilirsiniz.",
        ),
      });
    }
  };

  const handleMultiAssignmentDryRun = (result: MultiAssignmentDryRunResult) => {
    void recordPreviewOperation(
      "multi-assignment",
      "multi_assignment_dry_run",
      "Çoklu Atama Önizlemesi",
      result.summary,
    );

    setRuntime("multi-assignment", {
      loading: false,
        success: `${result.summary.planned_assignment_count} önizleme plan satırı oluşturuldu; ${result.summary.warning_count} uyarı var.`,
      error: null,
        info: "Bu işlem yalnızca önizleme üretir; İSG-KATİP üzerinde gerçek atama yapılmaz.",
    });
  };

  const runFeatureAction = async (featureId: FeatureId) => {
    try {
      if (featureId === "change-tracking") {
        void handleAnalyzeKatipChanges();
        return;
      }

      if (featureId === "duration-analysis") {
        const rows = analyzeDurationRows(snapshot.companies);
        const issueCount = rows.filter((row) => row.status === "critical" || row.status === "deficit" || row.status === "excess").length;
        const missingCount = rows.filter((row) => row.status === "missing").length;
        await recordPreviewOperation(featureId, "duration_analysis_preview", "Süre Analizi Önizlemesi", {
          total: rows.length,
          issues: issueCount,
          missing: missingCount,
        });
        setRuntime(featureId, {
          loading: false,
          success: rows.length > 0 ? `${rows.length} firma analiz edildi; ${issueCount} sorun, ${missingCount} hesaplanamayan kayıt bulundu.` : null,
          info: rows.length === 0 ? "Firma verisi bulunamadı. Önce İSG-KATİP senkronizasyonu yapın." : null,
          error: null,
        });
        return;
      }

      if (featureId === "contracts-need-update") {
        const candidates = buildContractUpdateCandidates(snapshot.companies, complianceFlags);
        await recordPreviewOperation(featureId, "contracts_need_update_preview", "Güncellenmesi Gereken Sözleşmeler Önizlemesi", {
          total: snapshot.companies.length,
          issues: candidates.length,
          missing: 0,
        });
        setRuntime(featureId, {
          loading: false,
          success: candidates.length > 0 ? `${candidates.length} sözleşme/süre kontrol adayı bulundu.` : "Açık güncelleme adayı bulunmadı.",
          error: null,
          info: null,
        });
        return;
      }

      if (featureId === "contract-status-report") {
        const rows = buildContractStatusRows(snapshot.companies);
        const issueCount = rows.filter((row) => row.color !== "green").length;
        const missingCount = rows.filter((row) => row.color === "purple").length;
        await recordPreviewOperation(featureId, "contract_status_report_preview", "Sözleşme Durumu Rapor Önizlemesi", {
          total: rows.length,
          issues: issueCount,
          missing: missingCount,
        });
        setRuntime(featureId, {
          loading: false,
          success: `${rows.length} firma rapora alındı; ${issueCount} eksik/uyumsuz durum görünüyor.`,
          error: null,
          info: null,
        });
        return;
      }

      if (featureId === "excess-duration-update") {
        const preview = buildExcessDurationPreview(snapshot.companies);
        await recordPreviewOperation(featureId, "excess_duration_update_dry_run", "Fazla Süre Önizlemesi", {
          ...preview.summary,
          export_generated: false,
        });
        setRuntime(featureId, {
          loading: false,
          success: preview.rows.length > 0
            ? `${preview.rows.length} fazla atama önerisi oluşturuldu; toplam ${preview.summary.total_excess_minutes} dk fazla süre görünüyor.`
            : "Fazla atanmış firma bulunmadı.",
          error: null,
          info: "Bu işlem yalnızca önizleme üretir; İSG-KATİP üzerinde otomatik güncelleme yapılmaz.",
        });
        return;
      }

      setRuntime(featureId, {
        loading: false,
        success: null,
        error: null,
        info: "Bu işlem şu anda yalnızca önizleme modundadır. İSG-KATİP üzerinde otomatik değişiklik yapılmaz.",
      });
      toast.info("Önizleme modu", {
        description: "Bu özellik Sprint 1 kapsamında güvenli moda alındı; gerçek İSG-KATİP güncellemesi yapmaz.",
      });
    } catch (error) {
      console.error("ISGBot feature action failed:", error);
      const message = getIsgbotFriendlyErrorMessage(
        error,
        "İşlem çalıştırılamadı. Lütfen gerekli verilerin yüklü olduğundan emin olup tekrar deneyin.",
      );
      setRuntime(featureId, { loading: false, error: message, success: null, info: null });
      toast.error("İşlem tamamlanamadı", { description: message });
    }
  };

  const openFeature = (feature: BotFeature) => {
    setSelectedFeature(feature);
  };

  return (
    <div className="min-h-screen bg-[#0B1220] px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-500/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_35%),linear-gradient(135deg,#0F172A,#0B1220_55%,#111827)] p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 shadow-lg shadow-blue-950/40">
                <Bot className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-cyan-400/25 bg-cyan-500/12 text-cyan-200 hover:bg-cyan-500/12">
                    Akıllı Asistan
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full px-3 py-1", connectionBadge.className)}>
                    {connectionBadge.label}
                  </Badge>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">İSGVİZYON Bot</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  İSG-KATİP işlemlerinizi otomatikleştiren akıllı asistanınız.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge variant="outline" className="rounded-full border-slate-500/25 bg-white/5 px-3 py-1.5 text-slate-200">
                Chromium tarayıcı önerilir
              </Badge>
              {extensionStatus.version && (
                <Badge variant="outline" className="rounded-full border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-blue-200">
                  Eklenti sürümü: {extensionStatus.version}
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-slate-500/25 bg-white/5 text-slate-100 hover:bg-white/10"
                onClick={() => void checkExtensionStatus()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Bağlantıyı Kontrol Et
              </Button>
              <Button
                className="rounded-full bg-blue-500 text-white hover:bg-blue-400"
                asChild
              >
                <a href={ISGVIZYON_CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                  <Chrome className="mr-2 h-4 w-4" />
                  Web Store
                </a>
              </Button>
            </div>
          </div>

          {extensionStatus.state !== "sync_ready" && extensionStatus.state !== "checking" && (
            <Alert className="mt-6 border-amber-400/25 bg-amber-500/10 text-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-300" />
              <AlertTitle>{extensionStatus.label}</AlertTitle>
              <AlertDescription className="text-amber-100/80">
                {extensionStatus.description}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-xl bg-blue-500 text-white hover:bg-blue-400" asChild>
                    <a href={ISGVIZYON_CHROME_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                      <Chrome className="mr-2 h-4 w-4" />
                      Web Store
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl border-amber-300/30 bg-amber-500/10 text-amber-50 hover:bg-amber-500/20" asChild>
                    <a href="/docs/isg-bot-setup">
                      Kurulum Rehberi
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl border-emerald-300/30 bg-emerald-500/10 text-emerald-50 hover:bg-emerald-500/20" asChild>
                    <a href="https://isgkatip.csgb.gov.tr/kisi-kurum/kisi-karti/kisi-kartim" target="_blank" rel="noopener noreferrer">
                      İSG-KATİP’i Aç
                    </a>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {extensionStatus.state === "sync_ready" && (
            <Alert className="mt-6 border-emerald-400/25 bg-emerald-500/10 text-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <AlertTitle>Senkron hazır</AlertTitle>
              <AlertDescription className="text-emerald-100/80">
                Eklenti bağlı. Eklenti son senkron: {formatSyncLabel(extensionStatus.extensionLastSyncedAt)} · Sunucu son senkron:{" "}
                {formatSyncLabel(snapshot.lastSyncedAt)}
                {typeof extensionStatus.totalCompanies === "number" ? ` · Eklenti firma sayısı: ${extensionStatus.totalCompanies}` : ""}
              </AlertDescription>
            </Alert>
          )}

          {extensionSyncIsNewer && (
            <Alert className="mt-4 border-amber-400/25 bg-amber-500/10 text-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-300" />
              <AlertTitle>Eklenti ve sunucu senkronu farklı</AlertTitle>
              <AlertDescription className="text-amber-100/80">
                Eklenti verisi sunucuya aktarılmamış olabilir. Lütfen İSG-KATİP senkronizasyonunu tekrar çalıştırın veya
                Firmalarımı Aktar ekranından son senkron verisini yükleyin.
              </AlertDescription>
            </Alert>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-500/20 bg-[#0F172A]/92 p-5 shadow-2xl shadow-black/25 sm:p-7">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Kontrol Paneli</p>
              <h2 className="mt-2 text-2xl font-black text-white">Bot işlemlerini tek ekrandan yönetin</h2>
              <p className="mt-1 text-sm text-slate-400">
                {loadingSnapshot
                  ? "Bağlantı ve firma verisi kontrol ediliyor..."
                  : hasSyncedCompanyData
                    ? `${snapshot.companyCount} firma hazır · Sunucu son senkron: ${formatSyncLabel(snapshot.lastSyncedAt)}`
                    : "Firma verisi bulunamadı. Önce İSG-KATİP üzerinden senkronizasyon yapın."}
              </p>
            </div>

            <Button
              className="rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-6 text-white shadow-lg shadow-blue-950/30 hover:from-blue-400 hover:to-cyan-400"
              onClick={() => setImportDialogOpen(true)}
            >
              <Download className="mr-2 h-5 w-5" />
              Firmalarımı Aktar
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {botFeatures.map((feature) => (
              <BotFeatureCard key={feature.id} feature={feature} onClick={openFeature} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[24px] border-slate-500/20 bg-[#111827]/88 text-slate-50">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-slate-400">Hazır firma</p>
              <p className="mt-2 text-3xl font-black text-white">{snapshot.companyCount}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-slate-500/20 bg-[#111827]/88 text-slate-50">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-slate-400">Sunucu son senkron</p>
              <p className="mt-2 text-lg font-black text-white">{formatSyncLabel(snapshot.lastSyncedAt)}</p>
              {extensionStatus.extensionLastSyncedAt && (
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  Eklenti: {formatSyncLabel(extensionStatus.extensionLastSyncedAt)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-slate-500/20 bg-[#111827]/88 text-slate-50">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-slate-400">Veri gizliliği</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Şifre, çerez veya e-Devlet oturum bilgisi aktarılmaz.</p>
            </CardContent>
          </Card>
        </section>

        <OperationHistoryPanel
          operations={operationHistory}
          loading={loadingOperations}
          notice={operationsNotice}
          onRefresh={() => void loadOperations()}
        />
      </div>

      <FeatureDialog
        feature={selectedFeature}
        open={Boolean(selectedFeature)}
        onOpenChange={(open) => {
          if (!open) setSelectedFeature(null);
        }}
        runtime={selectedRuntime}
        onRun={() => selectedFeature && runFeatureAction(selectedFeature.id)}
        onMultiAssignmentDryRun={handleMultiAssignmentDryRun}
        companies={snapshot.companies}
        flags={complianceFlags}
        changeResult={changeResult}
        extensionStatus={extensionStatus}
        userId={user?.id}
        organizationId={profile?.organization_id}
        onOperationsRefresh={loadOperations}
      />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent
          overlayClassName="z-[55] bg-slate-950/85 backdrop-blur-md"
          className="z-[60] max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-0 text-slate-50 shadow-2xl shadow-black/70 sm:max-w-5xl [&>button]:rounded-xl [&>button]:text-slate-400 [&>button:hover]:bg-slate-800 [&>button:hover]:text-white"
        >
          <DialogHeader className="border-b border-slate-800/90 bg-slate-950/80 px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-50">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
                <Upload className="h-5 w-5" />
              </span>
              Firmalarımı Aktar
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              Chrome eklentisi üzerinden İSG-KATİP ekranında görünen firma ve sözleşme bilgilerini açık onayla aktarın.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-950/35 px-6 py-5">
            <CompanyImportPanel
              runtime={importRuntime}
              extensionStatus={extensionStatus}
              companies={snapshot.companies}
              selectedIds={selectedImportIds}
              disabledIds={alreadyImportedCompanyIds}
              target={importTarget}
              isOsgbPlan={isOsgbPlan}
              hasOrganization={Boolean(profile?.organization_id)}
              onLoadCompanies={handleLoadImportCompanies}
              onStartNewSync={() => void handleStartNewKatipSync()}
              onToggleCompany={handleToggleImportCompany}
              onSelectAll={handleSelectAllImportCompanies}
              onClearSelection={handleClearImportSelection}
              onTargetChange={handleImportTargetChange}
              onImportSelected={handleImportSelectedCompanies}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



