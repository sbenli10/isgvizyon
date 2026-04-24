//src\pages\BulkCAPA.tsx
import { Component, ReactNode, Suspense, lazy, useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Plus,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Calendar,
  Users,
  CheckCircle2,
  Eye,
  X,
  Upload,
  Cloud,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Building2,
  Shield,
  BriefcaseBusiness,
  ChevronRight,
  Check,
  ChevronsUpDown,
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouteOverlayCleanup } from "@/hooks/useRouteOverlayCleanup";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getBulkCapaLegalBasis } from "@/lib/bulkCapaLegalBasis";
import type {
  BulkCapaOfficialCompany,
  BulkCapaOfficialEntry,
  BulkCapaOfficialGeneralInfo,
  BulkCapaOfficialOrganization,
  BulkCapaOfficialProfileContext,
} from "@/lib/bulkCapaOfficialDocx";

// ? INTERFACE DEFINITIONS
// HazardEntry interface'ine ekle:
interface HazardEntry {
  id: string;
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  termin_date: string;
  related_department: string;
  notification_method: string; // ? YENI ALAN
  responsible_name: string;
  responsible_role: string;
  approver_name: string;
  approver_title: string;
  include_stamp: boolean;
  media_urls: string[];
  ai_analyzed: boolean;
}

interface BulkCAPAGeneralInfo {
  company_name: string;
  company_logo_url: string | null;
  provider_logo_url: string | null;
  area_region: string;
  observation_range: string;
  report_date: string;
  observer_name: string;
  observer_certificate_no: string;
  responsible_person: string;
  employer_representative_title: string;
  employer_representative_name: string;
  report_no: string;
}

interface OrganizationData {
  id: string; // ? EKLE
  name: string;
  slug: string;
  logo_url?: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
  industry?: string | null;
  employee_count?: number | null;
  notes?: string | null;
  logo_url?: string | null;
}

interface HistoricalFinding {
  id: string;
  inspection_id: string;
  location_name: string;
  description: string;
  risk_definition: string;
  corrective_action: string;
  preventive_action: string;
  priority: HazardEntry["importance_level"];
  due_date: string | null;
  created_at: string;
  is_resolved: boolean;
  assigned_to: string | null;
  similarity: number;
  source: "inspection" | "bulk_session";
}

interface BulkSessionHistoryRow {
  id: string;
  company_name: string | null;
  area_region: string | null;
  department_name: string | null;
  report_date: string | null;
  updated_at: string | null;
}

interface BulkEntryHistoryRow {
  id: string;
  session_id: string;
  description: string | null;
  risk_definition: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  priority: string | null;
  due_date: string | null;
  responsible_name: string | null;
  responsible_role: string | null;
  created_at: string | null;
}

interface BulkCAPATemplate {
  id: string;
  name: string;
  payload: any;
  created_at?: string | null;
}

interface AIAnalysisResult {
  description: string;
  riskDefinition: string;
  correctiveAction: string;
  preventiveAction: string;
  importance_level: "Düşük" | "Orta" | "Yüksek" | "Kritik";
}

interface ProfileContext {
  full_name: string | null;
  position: string | null;
  avatar_url: string | null;
  stamp_url: string | null;
}

interface BulkCAPADraftSnapshot {
  companyInputMode: "existing" | "manual";
  selectedCompanyId: string;
  manualCompanyName: string;
  generalInfo: BulkCAPAGeneralInfo;
  newEntry: HazardEntry;
  bulkSourceImages?: string[];
  entries: HazardEntry[];
  overallAnalysis: string;
  createMode: "single" | "bulk";
  createStep: "general" | "items";
}

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

type ModuleCardProps = {
  eyebrow: string;
  title: string;
  badge?: string;
  className?: string;
  children: ReactNode;
};

const BULK_CAPA_DRAFT_STORAGE_KEY_PREFIX = "bulk-capa-draft";
const BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY = `${BULK_CAPA_DRAFT_STORAGE_KEY_PREFIX}:fallback`;
const BULK_CAPA_DRAFT_LAST_KEY_STORAGE_KEY = `${BULK_CAPA_DRAFT_STORAGE_KEY_PREFIX}:last-key`;
const BULK_SOURCE_IMAGE_LIMIT = 12;
const BulkCapaPreviewDialog = lazy(() => import("@/components/bulk-capa/BulkCapaPreviewDialog"));
const loadBulkCapaAi = () => import("@/lib/ai/analyzeBulkCapa");
const loadBulkCapaDocx = () => import("@/lib/bulkCapaOfficialDocx");

const coerceText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
      .filter(Boolean)
      .join('\n');
  }
  if (value == null) return '';
  return String(value);
};

const buildMediaKey = (url: string, index: number) => {
  const head = typeof url === "string" ? url.slice(0, 48) : "";
  return `${head}-${index}`;
};

const fetchImageBytes = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.warn("Stamp image could not be loaded for export:", error);
    return null;
  }
};

const ModuleCard = ({ eyebrow, title, badge, className, children }: ModuleCardProps) => (
  <div
    className={cn(
      "group h-full rounded-[20px] border border-border/60 bg-background/70 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_18px_48px_rgba(59,130,246,0.16)]",
      className
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-base font-bold text-foreground">{title}</h3>
      </div>
      {badge ? (
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
          {badge}
        </span>
      ) : null}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

const getUserFriendlyErrorMessage = (error: unknown, context?: string) => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Bilinmeyen hata";

  const normalized = raw.toLowerCase();

  if (normalized.includes("quota")) {
    return "Tarayici geçici depolama alani doldugu için islem tamamlanamadi. Sayfayi yenileyip tekrar deneyin.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "Internet baglantisi veya servis erisimi sirasinda sorun olustu. Baglantiyi kontrol edip tekrar deneyin.";
  }
  if (normalized.includes("google api key") || normalized.includes("api anahtari")) {
    return "Yapay zeka servisi için gerekli API anahtari tanimli degil.";
  }
  if (normalized.includes("generatecontent") || normalized.includes("gemini api error")) {
    return "Yapay zeka servisi su anda yanit vermedi. Birkaç saniye sonra tekrar deneyin.";
  }
  if (normalized.includes("no text response") || normalized.includes("parse")) {
    return "Yapay zeka analizi tamamlandi ancak sonuç okunabilir formatta dönmedi. Tekrar deneyin.";
  }
  if (normalized.includes("invalid data url") || normalized.includes("base64") || normalized.includes("empty buffer")) {
    return "Yüklenen görsellerden biri islenemedi. Fotografi yeniden yükleyip tekrar deneyin.";
  }
  if (normalized.includes("storage upload")) {
    return "Rapor dosyasi arsive yüklenemedi. Dosya indirilebilir ancak buluta kaydedilemedi.";
  }
  if (normalized.includes("removechild") || normalized.includes("insertbefore") || normalized.includes("notfounderror")) {
    return "Sayfa görüntüsü beklenmeyen sekilde bozuldu. Sayfayi yenileyip islemi tekrar baslatin.";
  }

  if (context === "analysis") {
    return "Fotograf analizi tamamlanamadi. Fotograflari yeniden seçip tekrar deneyin.";
  }
  if (context === "overall-analysis") {
    return "Genel analiz olusturulamadi. Mevcut bulgular kaybolmadi, tekrar deneyebilirsiniz.";
  }
  if (context === "export") {
    return "Rapor olusturulurken hata olustu. Verileriniz duruyor, tekrar deneyebilirsiniz.";
  }

  return raw || "Beklenmeyen bir hata olustu.";
};

class BulkCAPAErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: getUserFriendlyErrorMessage(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("BulkCAPA runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-6">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Bu sayfada bir sorun olustu</h2>
                <p className="text-sm text-muted-foreground">{this.state.message}</p>
                <div className="flex gap-3">
                  <Button onClick={() => window.location.reload()}>Sayfayi yenile</Button>
                  <Button variant="outline" onClick={() => window.location.assign("/bulk-capa")}>
                    Sayfayi yeniden aç
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ? CONSTANTS
const DEPARTMENTS = [
  "Isveren",
  "Bakim",
  "Üretim",
  "Insan Kaynaklari",
  "Lojistik",
  "Kalite",
  "Satis",
  "Muhasebe",
  "Diger",
];

const ITEM_TEMPLATE_TAGS = [
  "KKD",
  "Elektrik",
  "İstifleme",
  "Yangın",
  "Makine",
  "Depolama",
  "Düşme Riski",
  "Kimyasal",
];



const IMPORTANCE_LEVELS = [
  { value: "Düşük", label: "Düşük", color: "bg-emerald-500/10 text-emerald-600" },
  { value: "Orta", label: "Orta", color: "bg-success/10 text-success" },
  { value: "Yüksek", label: "Yüksek", color: "bg-warning/10 text-warning" },
  {
    value: "Kritik",
    label: "Kritik",
    color: "bg-destructive/10 text-destructive",
  },
];

const QUICK_START_TEMPLATES = [
  {
    id: "electric",
    title: "Elektrik Riski",
    hint: "Pano, kablo, priz ve açikta enerji kaynaklari için hizli baslangiç.",
    importance_level: "Kritik" as const,
    related_department: "Bakim",
    notification_method: "E-mail + Telefon",
    description: "Elektrik güvenligi açisindan uygunsuzluk tespit edildi.",
    correctiveAction:
      "- Tehlike olusturan ekipmani derhal güvenli hale getirin\n- Yetkisiz erisimi engelleyin\n- Acil bakim müdahalesini baslatin",
    preventiveAction:
      "- Periyodik elektrik kontrollerini planlayin\n- Yetkili personel disinda müdahaleyi engelleyin\n- Kontrol listesine elektrik güvenligi maddeleri ekleyin",
    dueInDays: 3,
  },
  {
    id: "housekeeping",
    title: "Düzen ve Temizlik",
    hint: "Daginiklik, istifleme ve geçis alani uygunsuzluklari için.",
    importance_level: "Orta" as const,
    related_department: "Üretim",
    notification_method: "E-mail",
    description: "Çalisma alaninda düzen ve temizlik açisindan uygunsuzluk gözlemlendi.",
    correctiveAction:
      "- Uygunsuz alani derhal düzenleyin\n- Geçis yollarini açik hale getirin\n- Malzemeleri uygun alanlara tasiyin",
    preventiveAction:
      "- Günlük alan kontrolü tanimlayin\n- Sorumlu ekip belirleyin\n- Görsel düzen standartlarini yayinlayin",
    dueInDays: 7,
  },
  {
    id: "ppe",
    title: "KKD Eksikligi",
    hint: "Çalisanlarin koruyucu donanim kullanmadigi durumlar için.",
    importance_level: "Yüksek" as const,
    related_department: "Isveren",
    notification_method: "E-mail + Yüz Yüze",
    description: "Çalisanlarin gerekli kisisel koruyucu donanimi tam kullanmadigi görüldü.",
    correctiveAction:
      "- Eksik KKD kullanimini derhal tamamlatin\n- Ilgili çalisanlara anlik bilgilendirme yapin\n- Saha denetimini kayit altina alin",
    preventiveAction:
      "- KKD kullanim egitimini yenileyin\n- Bölüm bazli kontrol plani olusturun\n- KKD stok takibini düzenli hale getirin",
    dueInDays: 5,
  },
] as const;

const DATE_PRESETS = [
  { label: "3 gün", value: 3 },
  { label: "7 gün", value: 7 },
  { label: "14 gün", value: 14 },
  { label: "30 gün", value: 30 },
] as const;

const normalizeJsonStringContent = (value: string) => {
  let result = "";
  let inString = false;
  let escaping = false;

  for (const char of value) {
    if (escaping) {
      result += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaping = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString && (char === "\n" || char === "\r" || char === "\t")) {
      result += " ";
      continue;
    }

    result += char;
  }

  if (inString) {
    result += '"';
  }

  return result;
};

const tryParseAnalysisFromFields = (value: string): AIAnalysisResult | null => {
  const extractField = (fieldName: string) => {
    const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([\\s\\S]*?)(?<!\\\\)"`, "i");
    const match = value.match(regex);
    return match?.[1]?.replace(/\\"/g, '"').trim() || "";
  };

  const description = extractField("description");
  const riskDefinition = extractField("riskDefinition");
  const correctiveAction = extractField("correctiveAction");
  const preventiveAction = extractField("preventiveAction");
  const importanceLevel = extractField("importance_level");

  if (!description && !riskDefinition && !correctiveAction && !preventiveAction) {
    return null;
  }

  return {
    description: description || "Açiklama alinamadi",
    riskDefinition: riskDefinition || "Risk tanimi alinamadi",
    correctiveAction: correctiveAction || "- Islem belirtilmedi",
    preventiveAction: preventiveAction || "- Önlem belirtilmedi",
    importance_level: (importanceLevel as AIAnalysisResult["importance_level"]) || "Orta",
  };
};

const safeJsonParse = (jsonText: string): AIAnalysisResult | null => {
  try {
    if (!jsonText || jsonText.trim().length === 0) {
      throw new Error("Empty JSON string");
    }

    let cleaned = jsonText.trim();

    // ? ```json``` markdowni kaldir
    cleaned = cleaned.replace(/^```json\n?/i, "").replace(/\n?```$/i, "");
    cleaned = cleaned.replace(/^```\n?/i, "").replace(/\n?```$/i, "");
    cleaned = normalizeJsonStringContent(cleaned);

    const firstBraceIndex = cleaned.indexOf("{");
    const lastBraceIndex = cleaned.lastIndexOf("}");
    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      cleaned = cleaned.slice(firstBraceIndex, lastBraceIndex + 1);
    }

    // ? KESIK STRING'I KONTROL ET
    // Eger son karakter tirnak degilse (kesik string), tirnak ekle
    if (!cleaned.trim().endsWith("}")) {
      // Son field kesik kalmis, kapat
      if (cleaned.includes('"') && !cleaned.trim().endsWith('"')) {
        cleaned = cleaned.trim() + '" }';
      } else {
        cleaned = cleaned.trim() + " }";
      }
    }

    // Smart quotes düzelt
    cleaned = cleaned
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2015\u2013]/g, "-");

    // Eksik braces
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      cleaned += "}".repeat(openBraces - closeBraces);
    }

    

    // Trailing comma
    cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

    console.log("?? Cleaned JSON:", cleaned.substring(0, 300));

    const parsed = JSON.parse(cleaned);

    return {
      description: parsed.description || "Açiklama alinamadi",
      riskDefinition: parsed.riskDefinition || "Risk tanimi alinamadi",
      correctiveAction: parsed.correctiveAction || "- Islem belirtilmedi",
      preventiveAction: parsed.preventiveAction || "- Önlem belirtilmedi",
      importance_level: parsed.importance_level || "Orta",
    } as AIAnalysisResult;
  } catch (error) {
    console.error("JSON Parse Error:", error);
    console.error("Raw text:", jsonText.substring(0, 300));
    return tryParseAnalysisFromFields(normalizeJsonStringContent(jsonText));
  }
};

// ? DATA URL TO UINT8ARRAY (Buffer yerine)
const dataUrlToBuffer = (dataUrl: string): Uint8Array => {
  try {
    if (!dataUrl || !dataUrl.includes(",")) {
      throw new Error("Invalid data URL format");
    }

    // Base64 kismini al
    const base64Data = dataUrl.split(",")[1];
    
    if (!base64Data) {
      throw new Error("No base64 data found");
    }

    // ? atob ile decode et
    const binaryString = atob(base64Data);
    
    // ? Uint8Array'e çevir
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    if (bytes.length === 0) {
      throw new Error("Empty buffer");
    }

    return bytes;
  } catch (error) {
    console.error("Buffer conversion error:", error);
    throw error;
  }
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Logo okunamadi"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Logo okunamadi"));
    reader.readAsDataURL(file);
  });

const resolveMaybeSignedUrl = async (bucket: string, value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(value, 3600);
  return data?.signedUrl || null;
};

const downloadBlob = async (blob: Blob, fileName: string) => {
  const { saveAs } = await import("file-saver");
  saveAs(blob, fileName);
};

type DocxImageKind = "jpg" | "png" | "gif" | "bmp";

const inferDocxImageType = (value?: string | null): DocxImageKind => {
  if (!value) return "png";
  const lower = value.toLowerCase();
  if (lower.includes("image/jpeg") || lower.includes("image/jpg") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "jpg";
  }
  if (lower.includes("image/gif") || lower.endsWith(".gif")) {
    return "gif";
  }
  if (lower.includes("image/bmp") || lower.endsWith(".bmp")) {
    return "bmp";
  }
  return "png";
};

// ? GENERATE WORD DOCUMENT - SUPABASE STORAGE'A YÜKLE
const generateWordDocument = async (
  entries: HazardEntry[],
  locationName: string,
  reportCompanyName: string,
  orgData: OrganizationData | null,
  selectedCompany: CompanyOption | null,
  user: any,
  orgId: string | null,
  overallAnalysis: string,
  profileContext: ProfileContext | null,
  generalInfo: BulkCAPAGeneralInfo,
  options?: {
    compact?: boolean;
  }
): Promise<Blob> => {
  try {
    const {
      Document,
      Packer,
      Table,
      TableRow,
      TableCell,
      Paragraph,
      TextRun,
      WidthType,
      AlignmentType,
      ImageRun,
    } = await import("docx");
    const compact = options?.compact ?? false;
    const today = new Date();
    const dateStr =
      generalInfo.report_date ||
      today.toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    const effectiveCompanyName = reportCompanyName || orgData?.name || "N/A";
    const effectiveLocation = generalInfo.area_region || locationName || "N/A";
    const approverName =
      [...entries].reverse().find((entry) => entry.approver_name)?.approver_name ||
      generalInfo.observer_name ||
      profileContext?.full_name ||
      user?.email ||
      "N/A";
    const approverTitle =
      [...entries].reverse().find((entry) => entry.approver_title)?.approver_title ||
      profileContext?.position ||
      "İş Güvenliği Uzmanı";
    const companyMetaLine = [
      selectedCompany?.industry ? `${selectedCompany.industry} sektörü` : null,
      selectedCompany?.employee_count ? `${selectedCompany.employee_count}+ çalışan` : null,
      effectiveLocation || null,
    ]
      .filter(Boolean)
      .join(" • ");
    const documentTitle = compact
      ? "Tekli Düzeltici ve Önleyici Faaliyet Formu"
      : "Düzeltici ve Önleyici Faaliyet Formu (DÖF)";
    const labelCellShading = { fill: "E5E7EB" };
    const sectionHeaderFill = "E9EEF9";
    const sectionHeaderText = "1F2937";
    const subtleTableBorders = {
      top: { color: "CBD5E1", style: "single", size: 6 },
      bottom: { color: "CBD5E1", style: "single", size: 6 },
      left: { color: "CBD5E1", style: "single", size: 6 },
      right: { color: "CBD5E1", style: "single", size: 6 },
      insideHorizontal: { color: "CBD5E1", style: "single", size: 4 },
      insideVertical: { color: "CBD5E1", style: "single", size: 4 },
    } as const;
    const sectionTitleSize = compact ? 20 : 24;
    const sectionCellLabelSize = compact ? 16 : 18;
    const sectionCellValueSize = compact ? 16 : 18;
    const mediaWidth = compact ? 240 : 320;
    const mediaHeight = compact ? 180 : 240;
    const overallTextSize = compact ? 17 : 20;
    const approvalTitleSize = compact ? 20 : 22;
    const approvalSectionLabelSize = compact ? 16 : 18;
    const approvalBodySize = compact ? 16 : 18;
    const approvalLeadSize = compact ? 18 : 20;

    const sections: any[] = [];
    const logoImageSource =
      generalInfo.company_logo_url || selectedCompany?.logo_url || orgData?.logo_url || null;
    const logoImageBytes = logoImageSource ? await fetchImageBytes(logoImageSource).catch(() => null) : null;
    const logoImageType = inferDocxImageType(logoImageSource);
    const providerLogoSource = generalInfo.provider_logo_url || orgData?.logo_url || null;
    const providerLogoBytes = providerLogoSource ? await fetchImageBytes(providerLogoSource).catch(() => null) : null;
    const providerLogoType = inferDocxImageType(providerLogoSource);

    // ? HEADER SECTION
    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: subtleTableBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 22, type: WidthType.PERCENTAGE },
                children: logoImageBytes
                  ? [
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: logoImageBytes,
                            type: logoImageType,
                            transformation: {
                              width: compact ? 56 : 72,
                              height: compact ? 56 : 72,
                            },
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ]
                  : [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: effectiveCompanyName.slice(0, 2).toUpperCase(),
                            bold: true,
                            size: compact ? 24 : 28,
                            color: "0F172A",
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                shading: { fill: "F8FAFC" },
                margins: { top: 160, bottom: 160, left: 120, right: 120 },
                borders: {
                  top: { color: "CBD5E1", space: 1, style: "single", size: 10 },
                  bottom: { color: "CBD5E1", space: 1, style: "single", size: 10 },
                  left: { color: "CBD5E1", space: 1, style: "single", size: 10 },
                  right: { color: "CBD5E1", space: 1, style: "single", size: 10 },
                },
              }),
              new TableCell({
                width: { size: 78, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: documentTitle,
                        bold: true,
                        size: compact ? 20 : 24,
                        color: "0F172A",
                      }),
                    ],
                    alignment: AlignmentType.LEFT,
                    spacing: { after: 80 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: effectiveCompanyName,
                        bold: true,
                        size: compact ? 18 : 20,
                        color: "1E293B",
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${effectiveLocation || "Konum belirtilmedi"} • ${dateStr}`,
                        size: compact ? 14 : 16,
                        color: "475569",
                      }),
                    ],
                    spacing: { before: 60 },
                  }),
                  ...(companyMetaLine
                    ? [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: companyMetaLine,
                              size: compact ? 14 : 16,
                              color: "64748B",
                            }),
                          ],
                          spacing: { before: 40 },
                        }),
                      ]
                    : []),
                  ...([
                    generalInfo.observation_range
                      ? new Paragraph({
                          children: [
                            new TextRun({
                              text: `Gözetim Aralığı: ${generalInfo.observation_range}`,
                              size: 15,
                              color: "64748B",
                            }),
                          ],
                          spacing: { before: 40 },
                        })
                      : null,
                    [generalInfo.report_no, generalInfo.observer_certificate_no]
                      .filter(Boolean)
                      .length
                      ? new Paragraph({
                          children: [
                            new TextRun({
                              text: [
                                generalInfo.report_no ? `Rapor No: ${generalInfo.report_no}` : null,
                                generalInfo.observer_certificate_no
                                  ? `Sertifika No: ${generalInfo.observer_certificate_no}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" • "),
                              size: compact ? 13 : 15,
                              color: "64748B",
                            }),
                          ],
                          spacing: { before: 30 },
                        })
                      : null,
                  ].filter(Boolean) as any[]),
                ],
                shading: { fill: "F8FAFC" },
                margins: { top: 160, bottom: 160, left: 160, right: 160 },
                borders: {
                  top: { color: "CBD5E1", space: 1, style: "single", size: 10 },
                  bottom: { color: "CBD5E1", space: 1, style: "single", size: 10 },
                  left: { color: "CBD5E1", space: 1, style: "single", size: 10 },
                  right: { color: "CBD5E1", space: 1, style: "single", size: 10 },
                },
              }),
            ],
          }),
        ],
      })
    );

    sections.push(new Paragraph({ children: [new TextRun("")] }));

    const infoRowLabelSize = compact ? 18 : 20;
    const infoRowValueSize = compact ? 18 : 20;

    const compactInfoRows = [
      { label: "Belge Tipi", value: "Tekli DÖF Tek Sayfa Formu" },
      { label: "Firma Adı", value: effectiveCompanyName },
      { label: "Bölüm", value: entries[0]?.related_department || "Belirtilmedi" },
      { label: "Sorumlu Kişi", value: entries[0]?.responsible_name || "Belirtilmedi" },
      { label: "Termin", value: entries[0]?.termin_date ? new Date(entries[0].termin_date).toLocaleDateString("tr-TR") : "Belirtilmedi" },
      { label: "Sorumlu Görev", value: entries[0]?.responsible_role || "Belirtilmedi" },
      { label: "Rapor Tarihi", value: dateStr },
      { label: "Bildirim Şekli", value: entries[0]?.notification_method || "E-mail" },
    ];

    const fullInfoRows = [
      { label: "Firma Adı", value: effectiveCompanyName },
      { label: "Sertifika No", value: generalInfo.observer_certificate_no || "Belirtilmedi" },
      { label: "Gözetim Tarih Aralığı", value: generalInfo.observation_range || "Belirtilmedi" },
      { label: "Sorumlu Kişi", value: generalInfo.responsible_person || "Belirtilmedi" },
      {
        label: "İşveren / İşveren Vekili",
        value:
          [generalInfo.employer_representative_title, generalInfo.employer_representative_name]
            .filter(Boolean)
            .join(" • ") || "Belirtilmedi",
      },
      { label: "Rapor No", value: generalInfo.report_no || "Belirtilmedi" },
      { label: "Alan / Bölge", value: effectiveLocation || "N/A" },
      { label: "Rapor Tarihi", value: dateStr },
      { label: "Gözetim Yapan (İSG Uzmanı)", value: generalInfo.observer_name || approverName },
      { label: "Bulgu Özeti", value: `${entries.length} bulgu (${entries.filter((e) => e.ai_analyzed).length} AI analiz)` },
      { label: "Bildirim Şekli", value: entries[0]?.notification_method || "E-mail" },
    ];

    const infoRows = compact ? compactInfoRows : fullInfoRows;

    // ? INFO TABLE (Firma, Saha, Tarih, vb.)
    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: subtleTableBorders,
        rows: infoRows.map(
          (row) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: row.label, bold: true, size: infoRowLabelSize })],
                    }),
                  ],
                  shading: labelCellShading,
                }),
                new TableCell({
                  width: { size: 70, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: row.value, size: infoRowValueSize })],
                    }),
                  ],
                }),
              ],
            })
        ),
      })
    );

    sections.push(new Paragraph({ children: [new TextRun("")] }));
    sections.push(new Paragraph({ children: [new TextRun("")] }));

    const approverEntry =
      [...entries].reverse().find((entry) => entry.approver_name || entry.approver_title) ||
      entries[0];
    const shouldRenderStamp = Boolean(approverEntry?.include_stamp && profileContext?.stamp_url);
    const stampImageSource = shouldRenderStamp ? profileContext?.stamp_url || null : null;
    const stampImageBytes = stampImageSource ? await fetchImageBytes(stampImageSource) : null;
    const stampImageType = inferDocxImageType(stampImageSource);

    // ? FINDINGS WITH IMAGES
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];

      // MADDE BAŞLIĞI
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: compact ? "Tekli Uygunsuzluk Kaydı" : `Madde ${index + 1} – Uygunsuzluk / Risk`,
              bold: true,
              size: sectionTitleSize,
              color: sectionHeaderText,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          shading: { fill: sectionHeaderFill },
        })
      );

      const findingTableRows = [];

      // ROW 1: Bulgu Açıklaması
      findingTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                      new TextRun({
                      text: "Bulgu Açıklaması",
                      bold: true,
                      size: sectionCellLabelSize,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: labelCellShading,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.description,
                      size: sectionCellValueSize,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        })
      );

      // ROW 2: Uygunsuzluk Tanımı
      findingTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                      new TextRun({
                      text: "Uygunsuzluk Tanımı",
                      bold: true,
                      size: sectionCellLabelSize,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: labelCellShading,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.riskDefinition,
                      size: sectionCellValueSize,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        })
      );

      // ROW 3: Düzeltici Faaliyet
      findingTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                      new TextRun({
                        text: "Düzeltici Faaliyet",
                        bold: true,
                        size: sectionCellLabelSize,
                      }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: labelCellShading,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.correctiveAction,
                      size: sectionCellValueSize,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        })
      );

      // ROW 4: Önleyici Faaliyet
      findingTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                      new TextRun({
                        text: "Önleyici Faaliyet",
                        bold: true,
                        size: sectionCellLabelSize,
                      }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: labelCellShading,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.preventiveAction,
                      size: sectionCellValueSize,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        })
      );

      // ROW 5: Bölüm
      findingTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Bölüm",
                      bold: true,
                      size: sectionCellLabelSize,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: labelCellShading,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.related_department,
                      size: sectionCellValueSize,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        })
      );

      // ROW 6: Önemlilik
      findingTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                      new TextRun({
                        text: "Önemlilik",
                        bold: true,
                        size: sectionCellLabelSize,
                      }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: labelCellShading,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.importance_level,
                      bold: true,
                      size: sectionCellValueSize,
                      color:
                        entry.importance_level === "Kritik"
                          ? "FF0000"
                          : entry.importance_level === "Yüksek"
                          ? "FFA500"
                          : "008000",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        })
      );

      // ROW 7: Termin
      findingTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                      new TextRun({
                        text: "Termin",
                        bold: true,
                        size: sectionCellLabelSize,
                      }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: labelCellShading,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: new Date(entry.termin_date).toLocaleDateString(
                        "tr-TR"
                      ),
                      size: sectionCellValueSize,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        })
      );

      // ? Fotoğraflar
      if (entry.media_urls && entry.media_urls.length > 0) {
        findingTableRows.push(
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Fotoğraflar (${entry.media_urls.length})`,
                        bold: true,
                        size: compact ? 18 : 20,
                        color: sectionHeaderText,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                shading: { fill: sectionHeaderFill },
                margins: { top: 100, bottom: 100 },
              }),
            ],
          })
        );

        for (let imgIdx = 0; imgIdx < entry.media_urls.length; imgIdx++) {
          try {
            const imageUrl = entry.media_urls[imgIdx];
            const uint8Array = dataUrlToBuffer(imageUrl);
            const imageType = inferDocxImageType(imageUrl);

            findingTableRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 2,
                    children: [
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: uint8Array as any,
                            type: imageType,
                            transformation: {
                              width: mediaWidth,
                              height: mediaHeight,
                            },
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100, after: 100 },
                      }),
                    ],
                    margins: { top: 150, bottom: 80, left: 100, right: 100 },
                    shading: { fill: "FFFFFF" },
                  }),
                ],
              })
            );

            findingTableRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 2,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Fotoğraf ${imgIdx + 1}/${entry.media_urls.length}`,
                            italics: true,
                            size: sectionCellValueSize,
                            color: "666666",
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 80 },
                      }),
                    ],
                    margins: { top: 0, bottom: 120, left: 100, right: 100 },
                    shading: { fill: "F5F5F5" },
                  }),
                ],
              })
            );
          } catch (err) {
            console.error(`Image error at index ${imgIdx}:`, err);
          }
        }
      }

      const findingTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: subtleTableBorders,
        rows: findingTableRows,
      });

      sections.push(findingTable);
      sections.push(new Paragraph({ children: [new TextRun("")] }));
      sections.push(
        new Paragraph({
          children: [new TextRun("")],
          spacing: { after: 400 },
        })
      );
    }

    if (overallAnalysis.trim()) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Genel Değerlendirme",
              bold: true,
              size: sectionTitleSize,
              color: sectionHeaderText,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 120 },
          shading: { fill: sectionHeaderFill },
        })
      );

      sections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: subtleTableBorders,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: overallAnalysis,
                          size: overallTextSize,
                        }),
                      ],
                      alignment: AlignmentType.LEFT,
                    }),
                  ],
                  margins: { top: 120, bottom: 120, left: 120, right: 120 },
                }),
              ],
            }),
          ],
        })
      );

      sections.push(new Paragraph({ children: [new TextRun("")] }));
    }

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Onaylayan (İş Güvenliği Uzmanı)",
            bold: true,
            size: approvalTitleSize,
          }),
        ],
        spacing: { before: 220, after: 140 },
      })
    );

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: subtleTableBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Kurum ve Uzman Bilgileri",
                        bold: true,
                        size: approvalSectionLabelSize,
                        color: "6B7280",
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                shading: { fill: "E5E7EB" },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Kaşe / İmza",
                        bold: true,
                        size: approvalSectionLabelSize,
                        color: "6B7280",
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                shading: { fill: "E5E7EB" },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Kurum",
                        bold: true,
                        size: compact ? 15 : 16,
                        color: "6B7280",
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: effectiveCompanyName,
                        bold: true,
                        size: approvalBodySize,
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Kurum onay alanı",
                        size: compact ? 15 : 16,
                        color: "6B7280",
                      }),
                    ],
                    spacing: { before: 40, after: 120 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Onaylayan",
                        bold: true,
                        size: compact ? 15 : 16,
                        color: "6B7280",
                      }),
                    ],
                    spacing: { before: 20 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: approverName,
                        bold: true,
                        size: approvalLeadSize,
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: approverTitle,
                        size: approvalBodySize,
                        italics: true,
                        color: "4B5563",
                      }),
                    ],
                    spacing: { before: 70 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Onaylayan uzman bilgileri resmî rapora eklenmiştir.",
                        size: compact ? 15 : 16,
                        color: "6B7280",
                      }),
                    ],
                    spacing: { before: 120 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Yetkili İmza: ________________________________",
                        size: approvalBodySize,
                        bold: true,
                      }),
                    ],
                    spacing: { before: 220 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Onay Tarihi: ${dateStr}`,
                        size: compact ? 15 : 16,
                        color: "6B7280",
                      }),
                    ],
                    spacing: { before: 90 },
                  }),
                ],
                margins: { top: 140, bottom: 140, left: 140, right: 140 },
                shading: { fill: "F8FAFC" },
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                children: stampImageBytes
                  ? [
                      ...(providerLogoBytes
                        ? [
                            new Paragraph({
                              children: [
                                new ImageRun({
                                  data: providerLogoBytes,
                                  type: providerLogoType,
                                  transformation: {
                                    width: 36,
                                    height: 36,
                                  },
                                }),
                              ],
                              alignment: AlignmentType.CENTER,
                              spacing: { after: 40 },
                            }),
                          ]
                        : []),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: effectiveCompanyName,
                            bold: true,
                            size: compact ? 15 : 16,
                            color: "4B5563",
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: stampImageBytes,
                            type: stampImageType,
                            transformation: {
                              width: compact ? 110 : 140,
                              height: compact ? 110 : 140,
                            },
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 60, after: 60 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Kurumsal Kaşe / Mühür",
                            size: compact ? 15 : 16,
                            italics: true,
                            color: "6B7280",
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ]
                  : [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: approverEntry?.include_stamp
                              ? "Kaşe veya mühür yüklenmemiş."
                              : "Kaşe eklenmeden oluşturuldu.",
                            italics: true,
                            size: approvalBodySize,
                            color: "6B7280",
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Onay Tarihi: ${dateStr}`,
                            size: compact ? 15 : 16,
                            color: "6B7280",
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 120 },
                      }),
                    ],
                margins: { top: 140, bottom: 140, left: 140, right: 140 },
                shading: { fill: "F8FAFC" },
              }),
            ],
          }),
        ],
      })
    );

    // ? Create document
    const doc = new Document({
      sections: [
        {
          children: sections,
        },
      ],
    });

    // ? Generate blob and return
    const blob = await Packer.toBlob(doc);
    return blob;

  } catch (error: any) {
    console.error("Word generation error:", error);
    throw error; // ? Hata firlat, handleSaveAndExport yakalayacak
  }
};

// ? MAIN COMPONENT
function BulkCAPAContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const clientLogoInputRef = useRef<HTMLInputElement>(null);
  const providerLogoInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const activeAnalysisRef = useRef(0);
  const draftHydratedRef = useRef(false);
  const [entries, setEntries] = useState<HazardEntry[]>([]);
  const [orgData, setOrgData] = useState<OrganizationData | null>(null);
  const [profileContext, setProfileContext] = useState<ProfileContext | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [historicalFindings, setHistoricalFindings] = useState<HistoricalFinding[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [companyInputMode, setCompanyInputMode] = useState<"existing" | "manual">("existing");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [manualCompanyName, setManualCompanyName] = useState("");
  const [companyComboboxOpen, setCompanyComboboxOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFocusEntryId, setPreviewFocusEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [lastSingleInspectionId, setLastSingleInspectionId] = useState<string | null>(null);
  const [lastSingleCreatedAt, setLastSingleCreatedAt] = useState<string | null>(null);
  const [editBaselineEntry, setEditBaselineEntry] = useState<HazardEntry | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"single" | "bulk">("single");
  const [createStep, setCreateStep] = useState<"general" | "items">("general");
  const [bulkSourceImages, setBulkSourceImages] = useState<string[]>([]);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [overallAnalysis, setOverallAnalysis] = useState("");
  const [overallAnalyzing, setOverallAnalyzing] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState<"general" | "item">("general");
  const [templateName, setTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<BulkCAPATemplate[]>([]);
  const [savedItemTemplates, setSavedItemTemplates] = useState<BulkCAPATemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [suggestedGeneralTemplate, setSuggestedGeneralTemplate] = useState<BulkCAPATemplate | null>(null);
  const [suggestedTemplateReason, setSuggestedTemplateReason] = useState("");
  const [recentHeaderSuggestion, setRecentHeaderSuggestion] = useState<BulkCAPAGeneralInfo | null>(null);
  const [recentHeaderSuggestionReason, setRecentHeaderSuggestionReason] = useState("");

  useRouteOverlayCleanup(() => {
    setCompanyComboboxOpen(false);
    setPreviewOpen(false);
    setCreateDialogOpen(false);
    setTemplateDialogOpen(false);
  });

  const loadCompanyOptions = async (userId: string) => {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const rows = data || [];
    const withSignedUrls = await Promise.all(
      rows.map(async (company) => ({
        id: company.id,
        name: company.name,
        industry: company.industry,
        employee_count: company.employee_count,
        notes: company.notes,
        logo_url: await resolveMaybeSignedUrl("company-logos", (company as { logo_url?: string | null }).logo_url),
      }))
    );

    setCompanies(withSignedUrls);
  };
  const [itemTemplateTags, setItemTemplateTags] = useState<string[]>([]);
  const [generalInfo, setGeneralInfo] = useState<BulkCAPAGeneralInfo>({
    company_name: "",
    company_logo_url: null,
    provider_logo_url: null,
    area_region: "",
    observation_range: "",
    report_date: new Date().toISOString().split("T")[0],
    observer_name: "",
    observer_certificate_no: "",
    responsible_person: "İŞVEREN / İŞVEREN VEKİLİ",
    employer_representative_title: "İşveren / İşveren Vekili",
    employer_representative_name: "",
    report_no: "",
  });
  const [companySearch, setCompanySearch] = useState("");
  const draftStorageKey = user ? `${BULK_CAPA_DRAFT_STORAGE_KEY_PREFIX}:${user.id}` : null;
  const draftSnapshotRef = useRef<BulkCAPADraftSnapshot | null>(null);

  const restoreDraftFromStorage = (rawDraft: string | null) => {
    if (!rawDraft) {
      return false;
    }

    const parsedDraft = JSON.parse(rawDraft) as Partial<BulkCAPADraftSnapshot>;

    if (parsedDraft.companyInputMode === "existing" || parsedDraft.companyInputMode === "manual") {
      setCompanyInputMode(parsedDraft.companyInputMode);
    }
    if (typeof parsedDraft.selectedCompanyId === "string") {
      setSelectedCompanyId(parsedDraft.selectedCompanyId);
    }
    if (typeof parsedDraft.manualCompanyName === "string") {
      setManualCompanyName(parsedDraft.manualCompanyName);
    }
    if (parsedDraft.generalInfo) {
      setGeneralInfo((prev) => ({
        ...prev,
        ...parsedDraft.generalInfo,
      }));
    }
    if (parsedDraft.newEntry) {
      setNewEntry((prev) => ({
        ...prev,
        ...parsedDraft.newEntry,
      }));
    }
    if (Array.isArray(parsedDraft.bulkSourceImages)) {
      setBulkSourceImages(parsedDraft.bulkSourceImages.filter((item): item is string => typeof item === "string"));
    }
    if (Array.isArray(parsedDraft.entries)) {
      setEntries(parsedDraft.entries);
    }
    if (typeof parsedDraft.overallAnalysis === "string") {
      setOverallAnalysis(parsedDraft.overallAnalysis);
    }
    if (parsedDraft.createMode === "single" || parsedDraft.createMode === "bulk") {
      setCreateMode(parsedDraft.createMode);
    }
    if (parsedDraft.createStep === "general" || parsedDraft.createStep === "items") {
      setCreateStep(parsedDraft.createStep);
    }

    return true;
  };

  useEffect(() => {
    try {
      if (!user && !draftStorageKey) {
        draftHydratedRef.current = false;
      }

      const preferredKey =
        draftStorageKey ||
        window.localStorage.getItem(BULK_CAPA_DRAFT_LAST_KEY_STORAGE_KEY) ||
        BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY;

      const restored =
        restoreDraftFromStorage(window.localStorage.getItem(preferredKey)) ||
        restoreDraftFromStorage(window.localStorage.getItem(BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY));

      if (!restored) {
        draftHydratedRef.current = true;
        return;
      }
    } catch (error) {
      console.warn("Bulk CAPA draft could not be restored:", error);
    } finally {
      draftHydratedRef.current = true;
    }
  }, [draftStorageKey, user]);

  useEffect(() => {
    return () => {
      activeAnalysisRef.current += 1;
    };
  }, []);

  const [newEntry, setNewEntry] = useState<HazardEntry>({
    id: "",
    description: "",
    riskDefinition: "",
    correctiveAction: "",
    preventiveAction: "",
    importance_level: "Orta",
    termin_date: "",
    related_department: "Diger",
    notification_method: "E-mail", // ? DEFAULT DEGER
    responsible_name: "",
    responsible_role: "",
    approver_name: "",
    approver_title: "İş Güvenliği Uzmanı",
    include_stamp: true,
    media_urls: [],
    ai_analyzed: false,
  });

  const requiredFieldChecks = useMemo(() => [
    { label: "Bulgu açiklamasi", ready: newEntry.description.trim().length > 0 },
    { label: "Risk tanimi", ready: newEntry.riskDefinition.trim().length > 0 },
    { label: "Düzeltici faaliyet", ready: newEntry.correctiveAction.trim().length > 0 },
    { label: "Termin tarihi", ready: newEntry.termin_date.trim().length > 0 },
    { label: "Sorumlu kisi", ready: newEntry.responsible_name.trim().length > 0 },
  ], [newEntry.description, newEntry.riskDefinition, newEntry.correctiveAction, newEntry.termin_date, newEntry.responsible_name]);

  const missingRequiredFields = useMemo(() =>
    requiredFieldChecks
      .filter((field) => !field.ready)
      .map((field) => field.label),
    [requiredFieldChecks]
  );

  const completedFieldCount = useMemo(() =>
    requiredFieldChecks.filter((field) => field.ready).length,
    [requiredFieldChecks]
  );

  const formReady = useMemo(() =>
    completedFieldCount === requiredFieldChecks.length,
    [completedFieldCount, requiredFieldChecks.length]
  );

  const aiEntryCount = useMemo(() =>
    entries.filter((entry) => entry.ai_analyzed).length,
    [entries]
  );

  const criticalEntryCount = useMemo(() =>
    entries.filter((entry) => entry.importance_level === "Kritik").length,
    [entries]
  );

  const nearestDueEntry = useMemo(() =>
    entries
      .filter((entry) => entry.termin_date)
      .sort((a, b) => a.termin_date.localeCompare(b.termin_date))[0],
    [entries]
  );

  const activeHeroSummary = useMemo(() =>
    newEntry.ai_analyzed
      ? "AI taslagi hazir. Simdi kuruma uygun termin, sorumlu ve bildirim tercihlerini netlestirin."
      : "Fotograf, not veya hazir sablonla baslayin. Sistem ilk taslagi üretirken siz yalnizce son karari verin.",
    [newEntry.ai_analyzed]
  );

  const selectedCompany = useMemo(() =>
    companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  const selectedCompanyName = useMemo(() =>
    companyInputMode === "manual"
      ? manualCompanyName.trim()
      : selectedCompany?.name || "",
    [companyInputMode, manualCompanyName, selectedCompany?.name]
  );

  const itemStepGuidance = useMemo(() => !formReady
    ? `Bu maddeyi listeye eklemek için şu alanlari tamamlayin: ${missingRequiredFields.join(", ")}.`
    : entries.length > 0
    ? "Bu madde hazir. Isterseniz Bulguyu Ekle ile listeye alin, isiniz bittiyse Önizlemeye Geç ile raporu kontrol edin."
    : "Bu madde hazir. Bulguyu Ekle ile ilk maddeyi listeye alin, sonra yeni madde ekleyebilir veya önizlemeye geçebilirsiniz.",
    [formReady, entries.length, missingRequiredFields]
  );

  const reportCompanyName = useMemo(() =>
    generalInfo.company_name || selectedCompanyName || "",
    [generalInfo.company_name, selectedCompanyName]
  );

  useEffect(() => {
    if (!draftStorageKey || !draftHydratedRef.current) {
      return;
    }

    const snapshot: BulkCAPADraftSnapshot = {
      companyInputMode,
      selectedCompanyId,
      manualCompanyName,
      generalInfo,
      newEntry,
      bulkSourceImages,
      entries,
      overallAnalysis,
      createMode,
      createStep,
    };
    draftSnapshotRef.current = snapshot;

    const hasMeaningfulDraft =
      entries.length > 0 ||
      manualCompanyName.trim().length > 0 ||
      selectedCompanyId.trim().length > 0 ||
      overallAnalysis.trim().length > 0 ||
      generalInfo.company_name.trim().length > 0 ||
      generalInfo.area_region.trim().length > 0 ||
      generalInfo.observation_range.trim().length > 0 ||
      generalInfo.observer_name.trim().length > 0 ||
      generalInfo.employer_representative_name.trim().length > 0 ||
      generalInfo.report_no.trim().length > 0 ||
      newEntry.description.trim().length > 0 ||
      newEntry.riskDefinition.trim().length > 0 ||
      newEntry.correctiveAction.trim().length > 0 ||
      newEntry.preventiveAction.trim().length > 0 ||
      newEntry.media_urls.length > 0 ||
      bulkSourceImages.length > 0;

    try {
      if (!hasMeaningfulDraft) {
        if (draftStorageKey) {
          window.localStorage.removeItem(draftStorageKey);
        }
        window.localStorage.removeItem(BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY);
        return;
      }

      if (draftStorageKey) {
        window.localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
        window.localStorage.setItem(BULK_CAPA_DRAFT_LAST_KEY_STORAGE_KEY, draftStorageKey);
      }
      window.localStorage.setItem(BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Bulk CAPA draft could not be saved:", error);
    }
  }, [
    companyInputMode,
    bulkSourceImages,
    createMode,
    createStep,
    draftStorageKey,
    entries,
    generalInfo,
    manualCompanyName,
    newEntry,
    overallAnalysis,
    selectedCompanyId,
  ]);

  useEffect(() => {
    const flushDraft = () => {
      if (!draftSnapshotRef.current) return;

      try {
        const serialized = JSON.stringify(draftSnapshotRef.current);
        if (draftStorageKey) {
          window.localStorage.setItem(draftStorageKey, serialized);
          window.localStorage.setItem(BULK_CAPA_DRAFT_LAST_KEY_STORAGE_KEY, draftStorageKey);
        }
        window.localStorage.setItem(BULK_CAPA_DRAFT_FALLBACK_STORAGE_KEY, serialized);
      } catch (error) {
        console.warn("Bulk CAPA draft flush failed:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      flushDraft();
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [draftStorageKey]);

  const effectiveLocation = useMemo(() =>
    generalInfo.area_region || reportCompanyName,
    [generalInfo.area_region, reportCompanyName]
  );
  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return companies;
    return companies.filter((company) =>
      [company.name, company.industry, company.notes]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(query))
    );
  }, [companies, companySearch]);
  const previewEntries = useMemo(
    () => (previewFocusEntryId ? entries.filter((entry) => entry.id === previewFocusEntryId) : entries),
    [entries, previewFocusEntryId]
  );
  const focusedPreviewEntry = useMemo(
    () => (previewFocusEntryId ? entries.find((entry) => entry.id === previewFocusEntryId) || null : null),
    [entries, previewFocusEntryId]
  );
  const singleEditDiffs = useMemo(() => {
    if (!editingEntryId || !editBaselineEntry) return [];

    const fields: Array<{ key: keyof HazardEntry; label: string; priority: number; format?: (value: any) => string }> = [
      { key: "importance_level", label: "Öncelik", priority: 0 },
      { key: "termin_date", label: "Termin tarihi", priority: 1, format: (value) => (value ? new Date(value).toLocaleDateString("tr-TR") : "Belirtilmedi") },
      { key: "responsible_name", label: "Sorumlu kişi", priority: 2 },
      { key: "responsible_role", label: "Sorumlu görev", priority: 3 },
      { key: "description", label: "Bulgu açıklaması", priority: 4 },
      { key: "riskDefinition", label: "Uygunsuzluk tanımı", priority: 5 },
      { key: "correctiveAction", label: "Düzeltici faaliyet", priority: 6 },
      { key: "preventiveAction", label: "Önleyici faaliyet", priority: 7 },
      { key: "related_department", label: "Bölüm", priority: 8 },
      { key: "approver_name", label: "Onaylayan uzman", priority: 9 },
      { key: "approver_title", label: "Uzman ünvanı", priority: 10 },
    ];

    return fields
      .filter(({ key }) => coerceText(editBaselineEntry[key]) !== coerceText(newEntry[key]))
      .map(({ key, label, format }) => ({
        key,
        label,
        priority: fields.find((field) => field.key === key)?.priority ?? 99,
        before: format ? format(editBaselineEntry[key]) : coerceText(editBaselineEntry[key]) || "Belirtilmedi",
        after: format ? format(newEntry[key]) : coerceText(newEntry[key]) || "Belirtilmedi",
      }))
      .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label, "tr"));
  }, [editBaselineEntry, editingEntryId, newEntry]);
  const previewPageChunks = useMemo(() => {
    const chunkSize = 3;
    const chunks: HazardEntry[][] = [];
    for (let i = 0; i < previewEntries.length; i += chunkSize) {
      chunks.push(previewEntries.slice(i, i + chunkSize));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [previewEntries]);
  const normalizeFindingPriority = (priority?: string | null): HazardEntry["importance_level"] =>
    priority === "critical" || priority === "Kritik"
      ? "Kritik"
      : priority === "high" || priority === "Yüksek"
      ? "Yüksek"
      : "Orta";
  const creationOverviewCards = [
    {
      key: "single",
      eyebrow: "Tekli DÖF",
      title: "Tek bir bulgu için hızlı form",
      body: "Tek bir uygunsuzluk için hemen kayıt oluşturup Word çıktısı alabilirsiniz.",
    },
    {
      key: "bulk",
      eyebrow: "Çoklu DÖF",
      title: "Birden fazla bulgu için toplu akış",
      body: "Aynı saha çalışmasındaki birden çok bulguyu tek raporda toplayabilirsiniz.",
    },
    {
      key: "readiness",
      eyebrow: "Hazırlık",
      title: `${completedFieldCount}/${requiredFieldChecks.length} alan hazır`,
      body: "Eksik alanları tamamlayıp kaydı tekli ya da çoklu akışta ilerletebilirsiniz.",
    },
  ] as const;

  const setQuickDueDate = (days: number) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    setNewEntry((prev) => ({
      ...prev,
      termin_date: nextDate.toISOString().split("T")[0],
    }));
  };

  const handleGeneralInfoChange = <K extends keyof BulkCAPAGeneralInfo>(
    key: K,
    value: BulkCAPAGeneralInfo[K]
  ) => {
    setGeneralInfo((prev) => ({ ...prev, [key]: value }));
  };

  const handleCompanyModeChange = (mode: "existing" | "manual") => {
    setCompanyInputMode(mode);
    setCompanyComboboxOpen(false);
    setCompanySearch("");

    if (mode === "manual") {
      setManualCompanyName((prev) => prev || selectedCompany?.name || generalInfo.company_name || "");
      setSelectedCompanyId("");
      return;
    }

    if (!selectedCompanyId) {
      setGeneralInfo((prev) => ({
        ...prev,
        company_name: "",
        company_logo_url: null,
      }));
    }
  };

  const resetEntryDraft = () => {
    setNewEntry((prev) => ({
      id: "",
      description: "",
      riskDefinition: "",
      correctiveAction: "",
      preventiveAction: "",
      importance_level: "Orta",
      termin_date: "",
      related_department: "Diger",
      notification_method: "E-mail",
      responsible_name: prev.responsible_name,
      responsible_role: prev.responsible_role,
      approver_name: generalInfo.observer_name || profileContext?.full_name || "",
      approver_title: profileContext?.position || "İş Güvenliği Uzmanı",
      include_stamp: true,
      media_urls: [],
      ai_analyzed: false,
    }));
    setEditingEntryId(null);
    setEditBaselineEntry(null);
  };

  const loadSavedTemplates = async (orgId: string) => {
    setTemplatesLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("bulk_capa_templates")
        .select("id, name, payload, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalizedTemplates = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        payload: item.payload || {},
        created_at: item.created_at,
      }));

      setSavedTemplates(
        normalizedTemplates.filter((item: BulkCAPATemplate) => (item.payload?.template_scope || "general") === "general")
      );
      setSavedItemTemplates(
        normalizedTemplates.filter((item: BulkCAPATemplate) => item.payload?.template_scope === "item")
      );
    } catch (error) {
      console.warn("Bulk CAPA templates could not be loaded:", error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const applySavedTemplate = (template: BulkCAPATemplate) => {
    setGeneralInfo((prev) => ({
      ...prev,
      ...template.payload,
      company_name: template.payload.company_name || prev.company_name,
      report_date: template.payload.report_date || prev.report_date,
    }));
    if (template.payload.company_name) {
      setManualCompanyName(template.payload.company_name);
      setCompanyInputMode("manual");
      setSelectedCompanyId("");
    }
    setTemplateDialogOpen(false);
    toast.success(`"${template.name}" şablonu uygulandı`);
  };

  const applySavedItemTemplate = (template: BulkCAPATemplate) => {
    const payload = template.payload || {};
    const dueDate = payload.termin_date || newEntry.termin_date;

    setNewEntry((prev) => ({
      ...prev,
      description: payload.description || prev.description,
      riskDefinition: payload.riskDefinition || prev.riskDefinition,
      correctiveAction: payload.correctiveAction || prev.correctiveAction,
      preventiveAction: payload.preventiveAction || prev.preventiveAction,
      importance_level: payload.importance_level || prev.importance_level,
      related_department: payload.related_department || prev.related_department,
      notification_method: payload.notification_method || prev.notification_method,
      responsible_name: payload.responsible_name || prev.responsible_name,
      responsible_role: payload.responsible_role || prev.responsible_role,
      approver_name: payload.approver_name || prev.approver_name,
      approver_title: payload.approver_title || prev.approver_title,
      media_urls: Array.isArray(payload.media_urls) ? payload.media_urls : prev.media_urls,
      ai_analyzed: Boolean(payload.ai_analyzed) || prev.ai_analyzed,
      termin_date: dueDate,
    }));
    setItemTemplateTags(Array.isArray(payload.tags) ? payload.tags : []);

    setTemplateDialogOpen(false);
    toast.success(`"${template.name}" madde şablonu uygulandı`);
  };

  const saveCurrentTemplate = async () => {
    if (!orgData?.id || !user?.id) {
      toast.error("Şablon kaydetmek için oturum ve organizasyon bilgisi gerekli.");
      return;
    }
    if (!templateName.trim()) {
      toast.error("Şablon adı girin");
      return;
    }

    try {
      const payload = {
        ...generalInfo,
        provider_logo_url: null,
        template_scope: "general",
        company_name: reportCompanyName || generalInfo.company_name || "",
        default_department: newEntry.related_department || "",
      };

      const { error } = await (supabase as any).from("bulk_capa_templates").insert({
        org_id: orgData.id,
        user_id: user.id,
        name: templateName.trim(),
        company_name: reportCompanyName || generalInfo.company_name || "",
        template_scope: "general",
        payload,
      });

      if (error) throw error;

      toast.success("DÖF şablonu kaydedildi");
      setTemplateName("");
      setTemplateDialogOpen(false);
      await loadSavedTemplates(orgData.id);
    } catch (error) {
      toast.error(getUserFriendlyErrorMessage(error, "export"));
    }
  };

  const saveCurrentItemTemplate = async () => {
    if (!orgData?.id || !user?.id) {
      toast.error("Şablon kaydetmek için oturum ve organizasyon bilgisi gerekli.");
      return;
    }
    if (!templateName.trim()) {
      toast.error("Şablon adı girin");
      return;
    }
    if (!newEntry.description.trim() && !newEntry.correctiveAction.trim()) {
      toast.error("Madde şablonu kaydetmek için en azından bulgu veya faaliyet bilgisi girin");
      return;
    }

    try {
      const payload = {
        template_scope: "item",
        company_name: reportCompanyName || generalInfo.company_name || "",
        description: newEntry.description,
        riskDefinition: newEntry.riskDefinition,
        correctiveAction: newEntry.correctiveAction,
        preventiveAction: newEntry.preventiveAction,
        importance_level: newEntry.importance_level,
        related_department: newEntry.related_department,
        notification_method: newEntry.notification_method,
        responsible_name: newEntry.responsible_name,
        responsible_role: newEntry.responsible_role,
        approver_name: newEntry.approver_name,
        approver_title: newEntry.approver_title,
        termin_date: newEntry.termin_date,
        media_urls: newEntry.media_urls,
        ai_analyzed: newEntry.ai_analyzed,
        tags: itemTemplateTags,
      };

      const { error } = await (supabase as any).from("bulk_capa_templates").insert({
        org_id: orgData.id,
        user_id: user.id,
        name: templateName.trim(),
        company_name: reportCompanyName || generalInfo.company_name || "",
        template_scope: "item",
        payload,
      });

      if (error) throw error;

      toast.success("Madde şablonu kaydedildi");
      setTemplateName("");
      setTemplateDialogOpen(false);
      await loadSavedTemplates(orgData.id);
    } catch (error) {
      toast.error(getUserFriendlyErrorMessage(error, "export"));
    }
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    key: "company_logo_url" | "provider_logo_url"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Logo dosyasi 2MB sinirini asmamalidir.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      handleGeneralInfoChange(key, dataUrl);
      toast.success(key === "company_logo_url" ? "Hizmet alan firma logosu yüklendi" : "Hizmet veren firma logosu hazırlandı");
    } catch (error) {
      toast.error(getUserFriendlyErrorMessage(error, "export"));
    } finally {
      event.target.value = "";
    }
  };

  const generalInfoStepReady = Boolean(
    reportCompanyName.trim() &&
      generalInfo.report_date &&
      generalInfo.observer_name.trim()
  );

  const generalInfoReady = Boolean(
    reportCompanyName.trim() &&
      generalInfo.area_region.trim() &&
      generalInfo.observation_range.trim() &&
      generalInfo.report_date &&
      generalInfo.observer_name.trim() &&
      generalInfo.observer_certificate_no.trim() &&
      generalInfo.employer_representative_name.trim() &&
      generalInfo.report_no.trim()
  );

  const applyRecentHeaderSuggestion = () => {
    if (!recentHeaderSuggestion) return;
    setGeneralInfo((prev) => ({
      ...prev,
      ...recentHeaderSuggestion,
      provider_logo_url: prev.provider_logo_url,
    }));
    toast.success("Bu firmada son kullanılan rapor üst bilgisi uygulandı");
  };

  const applyTemplate = (template: (typeof QUICK_START_TEMPLATES)[number]) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + template.dueInDays);

    setNewEntry((prev) => ({
      ...prev,
      description: prev.description.trim() || template.description,
      correctiveAction: prev.correctiveAction.trim() || template.correctiveAction,
      preventiveAction: prev.preventiveAction.trim() || template.preventiveAction,
      importance_level: template.importance_level,
      related_department: template.related_department,
      notification_method: prev.notification_method.trim() || template.notification_method,
      termin_date: prev.termin_date || nextDate.toISOString().split("T")[0],
    }));

    toast.success(`${template.title} sablonu uygulandi`);
  };

  const goToBulkGeneralStep = () => {
    setPreviewOpen(false);
    setCreateDialogOpen(true);
    setCreateMode("bulk");
    setCreateStep("general");
  };

  const tokenizeForSimilarity = (value: string) =>
    value
      .toLocaleLowerCase("tr-TR")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);

  const normalizeCompanyMatchValue = (value: string) =>
    value
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const currentSimilarityBase = `${newEntry.description} ${newEntry.riskDefinition}`.trim();
  const currentWords = Array.from(new Set(tokenizeForSimilarity(currentSimilarityBase)));
  const hasDraftContextForHistory =
    entries.length > 0 ||
    newEntry.description.trim().length >= 12 ||
    newEntry.riskDefinition.trim().length >= 12;

  const calculateSimilarity = (candidate: HazardEntry) => {
    if (!currentWords.length) return 0;
    const candidateWords = Array.from(
      new Set(tokenizeForSimilarity(`${candidate.description} ${candidate.riskDefinition}`))
    );
    const overlap = candidateWords.filter((word) => currentWords.includes(word)).length;
    return overlap / Math.max(currentWords.length, 1);
  };

  useEffect(() => {
    const fetchHistoricalFindings = async () => {
      if (!orgData?.id || !reportCompanyName.trim() || !hasDraftContextForHistory) {
        setHistoricalFindings([]);
        setHistoricalLoading(false);
        return;
      }

      setHistoricalLoading(true);
      try {
        const normalizedCompanyName = normalizeCompanyMatchValue(reportCompanyName);
        const nextHistoricalFindings: HistoricalFinding[] = [];

        const { data: bulkSessionsData, error: bulkSessionsError } = await (supabase as any)
          .from("bulk_capa_sessions")
          .select("id, company_name, area_region, department_name, report_date, updated_at")
          .eq("org_id", orgData.id)
          .ilike("company_name", `%${reportCompanyName.trim()}%`)
          .order("updated_at", { ascending: false })
          .limit(20);

        if (bulkSessionsError) {
          throw bulkSessionsError;
        }

        const bulkSessions = ((bulkSessionsData || []) as BulkSessionHistoryRow[]).filter((session) => {
          const companyName = normalizeCompanyMatchValue(String(session.company_name || ""));
          return companyName && normalizedCompanyName ? companyName.includes(normalizedCompanyName) || normalizedCompanyName.includes(companyName) : true;
        });

        if (bulkSessions.length > 0) {
          const bulkSessionMap = new Map<string, BulkSessionHistoryRow>(bulkSessions.map((session) => [session.id, session]));
          const { data: bulkEntriesData, error: bulkEntriesError } = await (supabase as any)
            .from("bulk_capa_entries")
            .select("id, session_id, description, risk_definition, corrective_action, preventive_action, priority, due_date, responsible_name, responsible_role, created_at")
            .in("session_id", bulkSessions.map((session) => session.id))
            .order("created_at", { ascending: false })
            .limit(80);

          if (bulkEntriesError) {
            throw bulkEntriesError;
          }

          nextHistoricalFindings.push(
            ...((bulkEntriesData || []) as BulkEntryHistoryRow[]).map((entry) => {
              const session = bulkSessionMap.get(entry.session_id);
              const similarityBase = `${entry.description || ""} ${entry.risk_definition || ""}`.trim();
              const candidateWords = Array.from(new Set(tokenizeForSimilarity(similarityBase)));
              const overlap = candidateWords.filter((word) => currentWords.includes(word)).length;
              const similarity = currentWords.length ? overlap / Math.max(currentWords.length, 1) : 0;

              return {
                id: entry.id,
                inspection_id: entry.session_id,
                location_name: session?.area_region || session?.company_name || reportCompanyName,
                description: entry.description || "",
                risk_definition: entry.risk_definition || "",
                corrective_action: entry.corrective_action || "",
                preventive_action: entry.preventive_action || "",
                priority: normalizeFindingPriority(entry.priority),
                due_date: entry.due_date || null,
                created_at: entry.created_at || session?.updated_at || session?.report_date || new Date().toISOString(),
                is_resolved: false,
                assigned_to: entry.responsible_role || entry.responsible_name || session?.department_name || null,
                similarity,
                source: "bulk_session" as const,
              };
            })
          );
        }

        const { data: inspectionsData, error: inspectionsError } = await supabase
          .from("inspections")
          .select("id, location_name, created_at")
          .eq("org_id", orgData.id)
          .ilike("location_name", `%${reportCompanyName.trim()}%`)
          .order("created_at", { ascending: false })
          .limit(20);

        if (inspectionsError) {
          throw inspectionsError;
        }

        const inspections = inspectionsData || [];
        if (inspections.length === 0) {
          setHistoricalFindings([]);
          return;
        }

        const inspectionMap = new Map(
          inspections.map((inspection) => [inspection.id, inspection])
        );

        const { data: findingsData, error: findingsError } = await supabase
          .from("findings")
          .select(
            "id, inspection_id, description, risk_definition, action_required, preventive_action, priority, due_date, created_at, is_resolved, assigned_to"
          )
          .in(
            "inspection_id",
            inspections.map((inspection) => inspection.id)
          )
          .order("created_at", { ascending: false })
          .limit(40);

        if (findingsError) {
          throw findingsError;
        }

        nextHistoricalFindings.push(...((findingsData || []).map((finding) => {
          const inspection = inspectionMap.get(finding.inspection_id);
          const similarityBase = `${finding.description || ""} ${finding.risk_definition || ""}`.trim();
          const candidateWords = Array.from(new Set(tokenizeForSimilarity(similarityBase)));
          const overlap = candidateWords.filter((word) => currentWords.includes(word)).length;
          const similarity = currentWords.length ? overlap / Math.max(currentWords.length, 1) : 0;

          return {
            id: finding.id,
            inspection_id: finding.inspection_id,
            location_name: inspection?.location_name || reportCompanyName,
            description: finding.description || "",
            risk_definition: finding.risk_definition || "",
            corrective_action: finding.action_required || "",
            preventive_action: finding.preventive_action || "",
            priority: normalizeFindingPriority(finding.priority),
            due_date: finding.due_date,
            created_at: finding.created_at || inspection?.created_at || new Date().toISOString(),
            is_resolved: Boolean(finding.is_resolved),
            assigned_to: finding.assigned_to || null,
            similarity,
            source: "inspection" as const,
          };
        })) as HistoricalFinding[]);

        const deduplicatedHistoricalFindings = nextHistoricalFindings.filter(
          (entry, index, array) =>
            array.findIndex(
              (candidate) =>
                candidate.source === entry.source &&
                candidate.inspection_id === entry.inspection_id &&
                candidate.description === entry.description &&
                candidate.risk_definition === entry.risk_definition
            ) === index
        );

        setHistoricalFindings(deduplicatedHistoricalFindings);
      } catch (error) {
        console.error("Historical findings could not be loaded:", error);
        setHistoricalFindings([]);
      } finally {
        setHistoricalLoading(false);
      }
    };

    const debounceTimer = window.setTimeout(() => {
      void fetchHistoricalFindings();
    }, 650);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [entries.length, hasDraftContextForHistory, orgData?.id, reportCompanyName, currentWords.join("|")]);

  const historicalSimilarEntries = historicalFindings
    .filter((entry) => (currentWords.length ? entry.similarity >= 0.18 : true))
    .sort((a, b) => {
      if (currentWords.length) return b.similarity - a.similarity;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 4);

  const repeatedIssueCount = historicalFindings.filter((entry) => entry.similarity >= 0.18).length;
  const topHistoricalPriority = historicalSimilarEntries[0]?.priority;
  const historicalAssignedRole = historicalSimilarEntries.find((entry) => entry.assigned_to)?.assigned_to;
  const historicalAverageDueDays = historicalSimilarEntries
    .filter((entry) => entry.due_date)
    .map((entry) => {
      const createdAt = new Date(entry.created_at).getTime();
      const dueDate = new Date(entry.due_date as string).getTime();
      const diff = Math.round((dueDate - createdAt) / (1000 * 60 * 60 * 24));
      return Number.isFinite(diff) ? diff : null;
    })
    .filter((value): value is number => value !== null && value >= 0);

  const hasElectricalRisk = /elektrik|pano|kablo|priz|kaçak/i.test(
    `${newEntry.description} ${newEntry.riskDefinition}`
  );
  const hasFireRisk = /yangin|alev|yanici|parlama/i.test(
    `${newEntry.description} ${newEntry.riskDefinition}`
  );
  const hasPpeRisk = /kkd|baret|gözlük|eldiven|maske/i.test(
    `${newEntry.description} ${newEntry.riskDefinition}`
  );
  const hasHousekeepingRisk = /daginik|istif|temizlik|geçis|koridor/i.test(
    `${newEntry.description} ${newEntry.riskDefinition}`
  );
  const companyHazardBoost =
    selectedCompany?.industry && /metal|enerji|üretim|sanayi|lojistik|insaat/i.test(selectedCompany.industry)
      ? 1
      : 0;
  const repeatRiskBoost = repeatedIssueCount >= 2 ? 1 : 0;
  const keywordRiskBoost = hasElectricalRisk || hasFireRisk ? 2 : hasPpeRisk ? 1 : 0;
  const historicalPriorityBoost =
    topHistoricalPriority === "Kritik" ? 2 : topHistoricalPriority === "Yüksek" ? 1 : 0;
  const priorityScore = keywordRiskBoost + historicalPriorityBoost + repeatRiskBoost + companyHazardBoost;

  const suggestedPriority: HazardEntry["importance_level"] =
    priorityScore >= 3 || hasElectricalRisk || hasFireRisk
      ? "Kritik"
      : priorityScore >= 1 || hasPpeRisk
      ? "Yüksek"
      : newEntry.description.trim().length > 160
      ? "Yüksek"
      : newEntry.importance_level || "Orta";

  const mostFrequentHistoricalDepartment = historicalSimilarEntries.reduce<Record<string, number>>(
    (acc, entry) => {
      if (!entry.description) return acc;
      const matchedDepartment = DEPARTMENTS.find((department) =>
        new RegExp(department, "i").test(entry.description)
      );
      if (matchedDepartment) {
        acc[matchedDepartment] = (acc[matchedDepartment] || 0) + 1;
      }
      return acc;
    },
    {}
  );

  const historicalDepartmentSuggestion =
    Object.entries(mostFrequentHistoricalDepartment).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const suggestedDepartment =
    historicalDepartmentSuggestion ||
    (hasElectricalRisk
      ? "Bakim"
      : hasPpeRisk
      ? "Isveren"
      : hasHousekeepingRisk
      ? "Üretim"
      : newEntry.related_department || "Diger");

  const suggestedRole =
    historicalAssignedRole ||
    (hasElectricalRisk
      ? "Bakim Sorumlusu"
      : hasPpeRisk
      ? "Saha Sorumlusu"
      : hasHousekeepingRisk
      ? "Bölüm Yöneticisi"
      : "Ilgili Bölüm Sorumlusu");

  const historicalDueSuggestion =
    historicalAverageDueDays.length > 0
      ? Math.max(2, Math.min(21, Math.round(historicalAverageDueDays.reduce((sum, day) => sum + day, 0) / historicalAverageDueDays.length)))
      : null;

  const suggestedDueDays = historicalDueSuggestion ??
    (suggestedPriority === "Kritik" ? 3 : suggestedPriority === "Yüksek" ? 7 : 14);
  const historicalOpenCount = historicalFindings.filter((entry) => !entry.is_resolved).length;
  const companyContextSummary = selectedCompany
    ? [
        selectedCompany.industry ? `${selectedCompany.industry} sektöründe faaliyet gösteriyor.` : null,
        selectedCompany.employee_count ? `${selectedCompany.employee_count}+ çalisan ölçegi kayitli.` : null,
        selectedCompany.notes ? "Sirket notlari öneri paneline baglam olarak dahil edildi." : null,
      ]
        .filter(Boolean)
        .join(" ")
    : reportCompanyName
    ? `${reportCompanyName} için geçmis DÖF ve denetim kayitlari taraniyor.`
    : "Firma seçildiginde öneriler sirket baglamini daha net yansitir.";

  const historicalPriorityDistribution = historicalSimilarEntries.reduce<Record<string, number>>((acc, entry) => {
    if (!entry.priority) return acc;
    acc[entry.priority] = (acc[entry.priority] || 0) + 1;
    return acc;
  }, {});
  const historicalPriorityReference = Object.entries(historicalPriorityDistribution).sort((a, b) => b[1] - a[1])[0] || null;
  const recommendedPriorityValue = (historicalPriorityReference?.[0] as HazardEntry["importance_level"] | undefined) || suggestedPriority;
  const priorityUsesHistoricalData = Boolean(historicalPriorityReference);
  const responsibleUsesHistoricalData = Boolean(historicalAssignedRole);
  const dueUsesHistoricalData = Boolean(historicalDueSuggestion);
  const hasMeaningfulHistoricalData = historicalFindings.length > 0;
  const recommendationEvidenceSummary = reportCompanyName.trim()
    ? [
        `Firma: ${reportCompanyName}`,
        hasMeaningfulHistoricalData ? `${historicalFindings.length} geçmiş kayıt tarandı` : "Bu firma için geçmiş kayıt bulunmadı",
        currentWords.length ? `${currentWords.length} anahtar ifade karşılaştırıldı` : "Karşılaştırılacak bulgu metni henüz kısa",
      ].join(" • ")
    : "Firma seçildiğinde şirket geçmişi ve mevcut madde metni birlikte değerlendirilir.";
  const similarityEvidenceSummary = reportCompanyName.trim()
    ? `Bu liste, "${reportCompanyName}" adına yakın geçmiş kayıtlar içinden açıklama ve risk tanımı kelime örtüşmesine göre sıralanır.`
    : "Firma seçildiğinde geçmiş DÖF kayıtları aynı şirket adı üzerinden taranır.";
  const nextDofNumber = `DOF-${String(entries.length + 1).padStart(3, "0")}`;

  const analyzeImagesWithAI = async (
    imageUrls: string[]
  ): Promise<AIAnalysisResult | null> => {
    try {
      const { analyzeBulkCapaImages } = await loadBulkCapaAi();
      const analysis = await analyzeBulkCapaImages(imageUrls);
      return {
        ...analysis,
        description: coerceText(analysis.description).trim(),
        riskDefinition: coerceText(analysis.riskDefinition).trim(),
        correctiveAction: coerceText(analysis.correctiveAction).trim(),
        preventiveAction: coerceText(analysis.preventiveAction).trim(),
      };
    } catch (error) {
      console.error("AI analysis error:", error);
      return null;
    }
  };

  const getSuggestedTerminDate = (importanceLevel: HazardEntry["importance_level"]) => {
    const days =
      importanceLevel === "Kritik"
        ? 1
        : importanceLevel === "Yüksek"
        ? 3
        : importanceLevel === "Orta"
        ? 7
        : 14;

    const next = new Date();
    next.setDate(next.getDate() + days);
    return next.toISOString().split("T")[0];
  };

  const buildBulkEntryFromAnalysis = (analysis: AIAnalysisResult, imageUrl: string, index: number): HazardEntry => ({
    id: `bulk-ai-${Date.now()}-${index}`,
    description: coerceText(analysis.description).trim(),
    riskDefinition: coerceText(analysis.riskDefinition).trim(),
    correctiveAction: coerceText(analysis.correctiveAction).trim(),
    preventiveAction: coerceText(analysis.preventiveAction).trim(),
    importance_level: analysis.importance_level,
    termin_date: getSuggestedTerminDate(analysis.importance_level),
    related_department:
      newEntry.related_department?.trim() && newEntry.related_department !== "Diger"
        ? newEntry.related_department
        : generalInfo.area_region?.trim() || "Genel Saha",
    notification_method: "E-mail",
    responsible_name:
      generalInfo.employer_representative_name?.trim() ||
      generalInfo.responsible_person?.trim() ||
      "İşveren / İşveren Vekili",
    responsible_role:
      generalInfo.employer_representative_title?.trim() ||
      "İşveren / İşveren Vekili",
    approver_name:
      generalInfo.observer_name?.trim() ||
      profileContext?.full_name?.trim() ||
      user?.email ||
      "",
    approver_title:
      profileContext?.position?.trim() ||
      "İş Güvenliği Uzmanı",
    include_stamp: true,
    media_urls: [imageUrl],
    ai_analyzed: true,
  });

  const removeBulkSourceImage = (index: number) => {
    setBulkSourceImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleEditExistingEntry = (entryId: string) => {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) {
      toast.error("Düzenlenecek madde bulunamadı.");
      return;
    }

    setNewEntry({ ...entry });
    setEditingEntryId(entry.id);
    setEditBaselineEntry({ ...entry });
    setCreateDialogOpen(true);
    setCreateMode("bulk");
    setCreateStep("items");
    toast.info("Seçilen satır düzenleme modunda açıldı.");
  };

  const handleGenerateBulkDraftFromPhotos = async () => {
    if (!reportCompanyName.trim()) {
      toast.error("Önce firma bilgisini seçin veya manuel girin");
      setCreateStep("general");
      return;
    }

    if (!generalInfoStepReady) {
      toast.error("Önce genel bilgileri tamamlayın");
      setCreateStep("general");
      return;
    }

    if (bulkSourceImages.length === 0) {
      toast.error("Toplu DÖF için önce fotoğraf yükleyin");
      return;
    }

    setBulkGenerating(true);
    try {
      const generatedEntries: HazardEntry[] = [];

      for (let index = 0; index < bulkSourceImages.length; index += 1) {
        const imageUrl = bulkSourceImages[index];
        const analysis = await analyzeImagesWithAI([imageUrl]);
        if (!analysis) {
          continue;
        }

        generatedEntries.push(buildBulkEntryFromAnalysis(analysis, imageUrl, index));
      }

      if (generatedEntries.length === 0) {
        throw new Error("Yüklenen fotoğraflardan analiz üretilemedi.");
      }

      setEntries(generatedEntries);
      setPreviewFocusEntryId(null);

      const prompt = `Sen deneyimli bir iş sağlığı ve güvenliği uzmanısın.
Aşağıdaki toplu DÖF maddeleri için resmi raporda kullanılacak yönetici özetini yaz.

Kurallar:
- 1 kısa paragraf yaz.
- Genel risk yoğunluğunu, tekrar eden uygunsuzlukları ve öncelikli aksiyon temasını özetle.
- Düz metin üret.

Maddeler:
${generatedEntries
  .map(
    (entry, index) =>
      `${index + 1}. Bulgu: ${entry.description}\nRisk: ${entry.riskDefinition}\nDüzeltici Faaliyet: ${entry.correctiveAction}\nÖnleyici Faaliyet: ${entry.preventiveAction}\nÖnemlilik: ${entry.importance_level}`,
  )
  .join("\n\n")}`;

      try {
        const { generateBulkCapaOverallAnalysis } = await loadBulkCapaAi();
        const nextOverallAnalysis = coerceText(await generateBulkCapaOverallAnalysis(prompt)).trim();
        if (nextOverallAnalysis) {
          setOverallAnalysis(nextOverallAnalysis);
        }
      } catch (overallError) {
        console.warn("Bulk overall analysis generation skipped:", overallError);
      }

      toast.success(`${generatedEntries.length} fotoğraf analiz edildi ve toplu DÖF taslağı hazırlandı.`);
    } catch (error) {
      console.error("Bulk photo-first draft generation failed:", error);
      toast.error(getUserFriendlyErrorMessage(error, "analysis"));
    } finally {
      setBulkGenerating(false);
    }
  };

  // ? FETCH ORGANIZATION DATA
  useEffect(() => {
    const fetchOrgData = async () => {
      if (!user) {
        setCompanies([]);
        setLoading(false);
        return;
      }

      try {
        const [, profileResponse] = await Promise.all([
          loadCompanyOptions(user.id),
          supabase
            .from("profiles")
            .select("organization_id, full_name, position, avatar_url, stamp_url")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        const { data: profile, error: profileError } = profileResponse;

        if (profileError) {
          console.warn("Profile context could not be loaded:", profileError);
        }

        setProfileContext({
          full_name: profile?.full_name ?? null,
          position: profile?.position ?? null,
          avatar_url: profile?.avatar_url ?? null,
          stamp_url: profile?.stamp_url ?? null,
        });

        setNewEntry((prev) => ({
          ...prev,
          approver_name: prev.approver_name || profile?.full_name || "",
          approver_title: prev.approver_title || profile?.position || "İş Güvenliği Uzmanı",
          include_stamp: prev.include_stamp ?? true,
        }));
        setGeneralInfo((prev) => ({
          ...prev,
          observer_name: prev.observer_name || profile?.full_name || "",
          provider_logo_url: prev.provider_logo_url || null,
        }));

        if (profile?.organization_id) {
          const [orgResponse] = await Promise.all([
            supabase
              .from("organizations")
              .select("id, name, slug, logo_url")
              .eq("id", profile.organization_id)
              .single(),
            loadSavedTemplates(profile.organization_id),
          ]);

          const { data: org } = orgResponse;

          if (org) {
            setOrgData(org);
          }
        }
      } catch (error) {
        console.error("Error fetching org data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgData();
  }, [user]);

  useEffect(() => {
    if (companyInputMode === "existing" && selectedCompany) {
      setGeneralInfo((prev) => ({
        ...prev,
        company_name: selectedCompany.name,
        company_logo_url: prev.company_logo_url || selectedCompany.logo_url || null,
      }));
      return;
    }

    if (companyInputMode === "manual") {
      setGeneralInfo((prev) => ({
        ...prev,
        company_name: manualCompanyName.trim(),
      }));
    }
  }, [companyInputMode, manualCompanyName, selectedCompany]);

  useEffect(() => {
    const loadCompanyContextSuggestions = async () => {
      if (!orgData?.id || !reportCompanyName.trim()) {
        setSuggestedGeneralTemplate(null);
        setSuggestedTemplateReason("");
        setRecentHeaderSuggestion(null);
        setRecentHeaderSuggestionReason("");
        return;
      }

      try {
        const companyName = reportCompanyName.trim();
        const currentDepartment =
          newEntry.related_department && newEntry.related_department !== "Diger"
            ? newEntry.related_department
            : "";
        const normalizedCompanyName = companyName.toLocaleLowerCase("tr-TR");
        const normalizedDepartment = currentDepartment.toLocaleLowerCase("tr-TR");

        const exactDepartmentTemplate =
          savedTemplates.find((template) => {
            const templateCompanyName = String(template.payload?.company_name || "").toLocaleLowerCase("tr-TR");
            const templateDepartment = String(template.payload?.default_department || "").toLocaleLowerCase("tr-TR");
            return (
              templateCompanyName.includes(normalizedCompanyName) &&
              normalizedDepartment &&
              templateDepartment === normalizedDepartment
            );
          }) || null;

        const companyTemplate =
          savedTemplates.find((template) =>
            String(template.payload?.company_name || "")
              .toLocaleLowerCase("tr-TR")
              .includes(normalizedCompanyName)
          ) || null;

        const matchingTemplate = exactDepartmentTemplate || companyTemplate;

        setSuggestedGeneralTemplate(matchingTemplate);
        setSuggestedTemplateReason(
          exactDepartmentTemplate
            ? `Bu şablon aynı firma ve ${currentDepartment} bölümü için daha önce kullanıldığı için önerildi.`
            : matchingTemplate
            ? "Bu şablon aynı firmada daha önce kullanıldığı için önerildi."
            : ""
        );

        let data = null;
        let error = null;

        if (currentDepartment) {
          const response = await (supabase as any)
            .from("bulk_capa_sessions")
            .select(
              "company_name, area_region, observation_date_range, report_date, observer_name, observer_certificate_no, responsible_person, employer_representative_title, employer_representative_name, report_no, service_company_logo_url, department_name, updated_at"
            )
            .eq("org_id", orgData.id)
            .ilike("company_name", `%${companyName}%`)
            .eq("department_name", currentDepartment)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          data = response.data;
          error = response.error;
        }

        if (!data) {
          const response = await (supabase as any)
            .from("bulk_capa_sessions")
            .select(
              "company_name, area_region, observation_date_range, report_date, observer_name, observer_certificate_no, responsible_person, employer_representative_title, employer_representative_name, report_no, service_company_logo_url, department_name, updated_at"
            )
            .eq("org_id", orgData.id)
            .ilike("company_name", `%${companyName}%`)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          data = response.data;
          error = response.error;
        }

        if (error) throw error;

        if (data) {
          setRecentHeaderSuggestion({
            company_name: data.company_name || companyName,
            company_logo_url: data.service_company_logo_url || null,
            provider_logo_url: null,
            area_region: data.area_region || "",
            observation_range: data.observation_date_range || "",
            report_date: data.report_date || new Date().toISOString().split("T")[0],
            observer_name: data.observer_name || "",
            observer_certificate_no: data.observer_certificate_no || "",
            responsible_person: data.responsible_person || "İŞVEREN / İŞVEREN VEKİLİ",
            employer_representative_title: data.employer_representative_title || "İşveren / İşveren Vekili",
            employer_representative_name: data.employer_representative_name || "",
            report_no: data.report_no || "",
          });
          setRecentHeaderSuggestionReason(
            currentDepartment && data.department_name === currentDepartment
              ? `Bu üst bilgi aynı firma ve ${currentDepartment} bölümü için son kullanılan yapıdan getirildi.`
              : "Bu üst bilgi aynı firmada en son kullanılan rapor yapısından getirildi."
          );
        } else {
          setRecentHeaderSuggestion(null);
          setRecentHeaderSuggestionReason("");
        }
      } catch (error) {
        console.warn("Company context suggestions could not be loaded:", error);
        setSuggestedTemplateReason("");
        setRecentHeaderSuggestion(null);
        setRecentHeaderSuggestionReason("");
      }
    };

    void loadCompanyContextSuggestions();
  }, [newEntry.related_department, orgData?.id, reportCompanyName, savedTemplates]);
  // ? AI ANALYSIS HANDLER
  const handleAIAnalysis = async () => {
    if (newEntry.media_urls.length === 0) {
      toast.error("Lütfen en az bir fotograf yükleyin");
      return;
    }

    if (analyzing) return;

    const runId = Date.now();
    activeAnalysisRef.current = runId;
    setAnalyzing(true);

    try {
      const total = newEntry.media_urls.length;
      toast.info(`${total} fotograf analiz ediliyor`);

      let finalAnalysis = await analyzeImagesWithAI(newEntry.media_urls);

      if (!finalAnalysis) {
        const analyses: AIAnalysisResult[] = [];

        for (let i = 0; i < newEntry.media_urls.length; i++) {
          const analysis = await analyzeImagesWithAI([newEntry.media_urls[i]]);
          if (analysis) {
            analyses.push(analysis);
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        if (analyses.length === 0) {
          throw new Error("Fotograflar analiz edilemedi");
        }

        finalAnalysis = mergeAnalyses(analyses);
      }

      if (activeAnalysisRef.current !== runId) {
        return;
      }

      setNewEntry((prev) => ({
        ...prev,
        description: finalAnalysis.description,
        riskDefinition: finalAnalysis.riskDefinition,
        correctiveAction: finalAnalysis.correctiveAction,
        preventiveAction: finalAnalysis.preventiveAction,
        importance_level: finalAnalysis.importance_level,
        ai_analyzed: true,
      }));

      toast.success(`${total} fotograf için analiz tamamlandi`);
    } catch (error: any) {
      toast.error(getUserFriendlyErrorMessage(error, "analysis"));
      console.error("Analysis error:", error);
    } finally {
      if (activeAnalysisRef.current === runId) {
        setAnalyzing(false);
      }
    }
  };

  // ? MERGE ANALYSES
  const mergeAnalyses = (analyses: AIAnalysisResult[]): AIAnalysisResult => {
    const importancePriority = { Kritik: 4, Yüksek: 3, Orta: 2, Düşük: 1 };
    const maxImportance = analyses.reduce((max, curr) => {
      const currPriority = importancePriority[curr.importance_level] || 0;
      const maxPriority = importancePriority[max.importance_level] || 0;
      return currPriority > maxPriority ? curr : max;
    });

    const descriptions = analyses
      .map((a) => coerceText(a.description).trim())
      .filter(Boolean);
    const riskLines = analyses
      .map((a) => coerceText(a.riskDefinition).trim())
      .filter(Boolean);
    const correctiveActions = analyses
      .map((a) => coerceText(a.correctiveAction).trim())
      .filter(Boolean);
    const preventiveActions = analyses
      .map((a) => coerceText(a.preventiveAction).trim())
      .filter(Boolean);

    const shortRiskSummary = riskLines
      .slice(0, 3)
      .map((line) => line.split(".")[0].trim())
      .filter(Boolean)
      .join(". ");

    return {
      description: descriptions.slice(0, 2).join(" "),
      riskDefinition: shortRiskSummary
        ? `${shortRiskSummary}.`
        : riskLines[0] || "Genel risk degerlendirmesi tamamlandi.",
      correctiveAction: correctiveActions.slice(0, 3).join("\n"),
      preventiveAction: preventiveActions.slice(0, 3).join("\n"),
      importance_level: maxImportance.importance_level,
    };
  };
  const generateOverallAnalysis = async () => {
    if (entries.length === 0) {
      toast.error("Önce en az bir bulgu ekleyin");
      return;
    }

    setOverallAnalyzing(true);

    try {
      const prompt = `Sen deneyimli bir is sagligi ve güvenligi uzmanisin.
Asagidaki DÖF maddelerini birlikte degerlendir ve raporun sonuna eklenecek tek bir genel analiz yaz.

Kurallar:
- Kisa, net ve profesyonel yaz.
- Tek paragraf ya da en fazla 2 kisa paragraf üret.
- Tekrar eden maddeleri birlestir.
- Genel risk egilimini, ortak kök nedenleri ve kapanis degerlendirmesini özetle.
- Madde madde yazma.
- Sadece düz metin döndür.

DÖF maddeleri:
${entries
  .map(
    (entry, index) =>
      `${index + 1}. Bulgu: ${entry.description}\nRisk: ${entry.riskDefinition}\nDüzeltici Faaliyet: ${entry.correctiveAction}\nÖnleyici Faaliyet: ${entry.preventiveAction}\nBölüm: ${entry.related_department}\nÖnemlilik: ${entry.importance_level}`
  )
  .join("\n\n")}`;

      const { generateBulkCapaOverallAnalysis } = await loadBulkCapaAi();
      const textContent = coerceText(await generateBulkCapaOverallAnalysis(prompt)).trim();
      if (!textContent) {
        throw new Error("Genel analiz metni üretilemedi");
      }

      setOverallAnalysis(textContent);
      toast.success("Genel analiz olusturuldu");
    } catch (error: any) {
      console.error("Genel analiz hatasi:", error);
      toast.error(getUserFriendlyErrorMessage(error, "overall-analysis"));
    } finally {
      setOverallAnalyzing(false);
    }
  };

  // ? DRAG & DROP
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files) {
      processFiles(files);
    }
  };

  

  // ? PROCESS FILES
  const processFiles = (files: FileList) => {
    const currentImageCount = createMode === "bulk" ? bulkSourceImages.length : newEntry.media_urls.length;
    const limit = createMode === "bulk" ? BULK_SOURCE_IMAGE_LIMIT : 2;
    const remainingSlots = Math.max(0, limit - currentImageCount);
    if (remainingSlots === 0) {
      toast.error(createMode === "bulk" ? `En fazla ${BULK_SOURCE_IMAGE_LIMIT} fotograf ekleyebilirsiniz` : "En fazla 2 fotograf ekleyebilirsiniz");
      return;
    }

    const nextFiles = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.info(`Yalnizca ilk ${remainingSlots} fotograf eklendi`);
    }

    nextFiles.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Lütfen sadece görüntü dosyasi seçin");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Dosya boyutu 5MB'i asamaz");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (createMode === "bulk") {
          setBulkSourceImages((prev) => [...prev, dataUrl]);
        } else {
          setNewEntry((prev) => ({
            ...prev,
            media_urls: [...prev.media_urls, dataUrl],
            ai_analyzed: false,
          }));
        }
        toast.success("Fotograf eklendi");
      };
      reader.readAsDataURL(file);
    });
  };

  // ? HANDLE IMAGE UPLOAD
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(files);
    e.target.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
  };

  // ? REMOVE IMAGE
  const handleRemoveImage = (index: number) => {
    setNewEntry((prev) => ({
      ...prev,
      media_urls: prev.media_urls.filter((_, i) => i !== index),
      ai_analyzed: false,
    }));
  };

  // ? ADD ENTRY
  const handleAddEntry = (): HazardEntry | null => {
    if (!reportCompanyName.trim()) {
      toast.error("Lütfen önce firma seçin veya manuel firma adi girin");
      return null;
    }

    const normalizedEntry: HazardEntry = {
      ...newEntry,
      description: coerceText(newEntry.description),
      riskDefinition: coerceText(newEntry.riskDefinition),
      correctiveAction: coerceText(newEntry.correctiveAction),
      preventiveAction: coerceText(newEntry.preventiveAction),
      notification_method: coerceText(newEntry.notification_method),
      responsible_name: coerceText(newEntry.responsible_name),
      responsible_role: coerceText(newEntry.responsible_role),
      approver_name: coerceText(newEntry.approver_name),
      approver_title: coerceText(newEntry.approver_title),
    };

    const missingFields = [
      !normalizedEntry.description.trim() ? "Bulgu açiklamasi" : null,
      !normalizedEntry.riskDefinition.trim() ? "Risk tanimi" : null,
      !normalizedEntry.correctiveAction.trim() ? "Düzeltici faaliyet" : null,
      !newEntry.termin_date ? "Termin tarihi" : null,
      !normalizedEntry.responsible_name.trim() ? "Sorumlu kisi" : null,
    ].filter(Boolean) as string[];

    if (missingFields.length > 0) {
      toast.error(`Eksik alanlar: ${missingFields.join(", ")}`);
      return null;
    }

    const entry: HazardEntry = {
      ...normalizedEntry,
      id: editingEntryId || `entry-${Date.now()}`,
    };

    setEntries((prev) =>
      editingEntryId
        ? prev.map((item) => (item.id === editingEntryId ? entry : item))
        : [...prev, entry]
    );

    resetEntryDraft();
    setCreateStep("items");
    toast.success(editingEntryId ? "Tekli DÖF güncellendi." : "Bulgu eklendi. Yeni madde eklemeye devam edebilirsiniz.");
    return entry;
  };

  const handleOpenBulkPreview = () => {
    if (!generalInfoStepReady) {
      toast.error("Önizleme için önce firma, rapor tarihi ve gözlem yapan bilgisini girin");
      setCreateStep("general");
      return;
    }

    if (entries.length === 0) {
      toast.error("Önizleme için önce en az bir bulgu ekleyin");
      return;
    }

    setPreviewFocusEntryId(null);
    setPreviewOpen(true);
  };

  const handleCreateSingleDOF = () => {
    const addedEntry = handleAddEntry();
    if (addedEntry) {
      setCreateDialogOpen(false);
      setPreviewFocusEntryId(addedEntry.id);
      setPreviewOpen(true);
      toast.success("Tekli DÖF kaydı hazırlandı. Önizleme doğrudan açıldı.");
    }
  };

  const handleReturnSinglePreviewToEdit = () => {
    if (!focusedPreviewEntry) {
      toast.error("Düzenlenecek kayıt bulunamadı.");
      return;
    }

    setNewEntry({ ...focusedPreviewEntry });
    setEditingEntryId(focusedPreviewEntry.id);
    setEditBaselineEntry({ ...focusedPreviewEntry });
    setCreateMode("single");
    setCreateStep("items");
    setPreviewOpen(false);
    setCreateDialogOpen(true);
    toast.info("Tekli DÖF tekrar düzenleme modunda açıldı.");
  };

  const handleSaveSinglePreviewExport = async () => {
    if (!focusedPreviewEntry) {
      toast.error("Önizlenecek tekli DÖF kaydı bulunamadı.");
      return;
    }

    if (!reportCompanyName.trim()) {
      toast.error("Lütfen firma bilgisi girin.");
      return;
    }

    if (!orgData?.id) {
      toast.error("Kuruluş bilgisi bulunamadı.");
      return;
    }

    setSaving(true);

    try {
      let createdInspectionId: string | null = null;

      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (profile?.organization_id) {
          const { data: inspection, error: inspectionError } = await supabase
            .from("inspections")
            .insert({
              org_id: profile.organization_id,
              user_id: user.id,
              location_name: effectiveLocation,
              status: "completed",
              risk_level:
                focusedPreviewEntry.importance_level === "Kritik"
                  ? "high"
                  : focusedPreviewEntry.importance_level === "Yüksek"
                  ? "medium"
                  : "low",
              media_urls: focusedPreviewEntry.media_urls,
              notes: `Tekli DÖF Formu - ${focusedPreviewEntry.description}`,
              risk_definition: focusedPreviewEntry.riskDefinition,
              corrective_action: focusedPreviewEntry.correctiveAction,
              preventive_action: focusedPreviewEntry.preventiveAction,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!inspectionError && inspection) {
            createdInspectionId = inspection.id;
            setLastSingleInspectionId(inspection.id);
            setLastSingleCreatedAt(new Date().toISOString());
            const { error: findingError } = await supabase.from("findings").insert({
              inspection_id: inspection.id,
              user_id: user.id,
              description: focusedPreviewEntry.description,
              action_required: focusedPreviewEntry.correctiveAction,
              risk_definition: focusedPreviewEntry.riskDefinition,
              preventive_action: focusedPreviewEntry.preventiveAction,
              due_date: focusedPreviewEntry.termin_date,
              priority:
                focusedPreviewEntry.importance_level === "Kritik"
                  ? "critical"
                  : focusedPreviewEntry.importance_level === "Yüksek"
                  ? "high"
                  : focusedPreviewEntry.importance_level === "Düşük"
                  ? "low"
                  : "medium",
              notification_method: focusedPreviewEntry.notification_method,
            });

            if (findingError) {
              console.warn("Single DOF finding link failed:", findingError);
            }
          } else if (inspectionError) {
            console.warn("Single DOF inspection link failed:", inspectionError);
          }
        }
      }

      const compactWordBlob = await generateWordDocument(
        [focusedPreviewEntry],
        effectiveLocation,
        reportCompanyName,
        orgData,
        selectedCompany,
        user,
        orgData?.id || user?.id || null,
        focusedPreviewEntry.preventiveAction || overallAnalysis,
        profileContext,
        generalInfo,
        { compact: true }
      );

      const today = new Date();
      const safeCompanyName = (reportCompanyName || "firma")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 _-]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 80) || "firma";
      const singleFileName = `Tekli_DOF_${safeCompanyName}_${today.toISOString().split("T")[0]}.docx`;
      let savedReportUrl: string | null = null;
      let uploadError: { message?: string } | null = null;
      const reportStorageOwnerId = orgData?.id || user?.id || null;

      if (reportStorageOwnerId) {
        const storagePath = `${reportStorageOwnerId}/${singleFileName}`;
        const { data: uploadData, error } = await supabase.storage
          .from("dof-reports")
          .upload(storagePath, compactWordBlob, {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true,
          });

        uploadError = error;
        if (error) {
          console.warn("Single DOF storage upload failed:", error);
          toast.warning("Arşiv yüklemesi başarısız oldu, dosya yine de indirilecek.");
        } else if (uploadData?.path) {
          const { data: publicUrlData } = supabase.storage.from("dof-reports").getPublicUrl(uploadData.path);
          savedReportUrl = publicUrlData.publicUrl;
        }
      }

      if (user?.id) {
        const { error: reportError } = await supabase.from("reports").insert({
          org_id: orgData?.id || null,
          user_id: user.id,
          title: `Tekli DÖF - ${reportCompanyName}`,
          report_type: "inspection",
          generated_at: today.toISOString(),
          export_format: "docx",
          file_url: savedReportUrl,
          content: {
            report_kind: "single_dof",
            company_name: reportCompanyName,
            location: effectiveLocation,
            report_no: generalInfo.report_no || null,
            report_date: generalInfo.report_date || null,
            observer_name: generalInfo.observer_name || null,
            observer_certificate_no: generalInfo.observer_certificate_no || null,
            entry_id: focusedPreviewEntry.id,
            description: focusedPreviewEntry.description,
            importance_level: focusedPreviewEntry.importance_level,
            due_date: focusedPreviewEntry.termin_date,
            responsible_name: focusedPreviewEntry.responsible_name || null,
            responsible_role: focusedPreviewEntry.responsible_role || null,
            ai_analyzed: focusedPreviewEntry.ai_analyzed,
            inspection_id: createdInspectionId,
            storage_upload_ok: !uploadError,
            storage_error: uploadError?.message ?? null,
          },
        });

        if (reportError) {
          console.warn("Single DOF report archive failed:", reportError);
        }
      }

      await downloadBlob(compactWordBlob, singleFileName);
      toast.success(
        createdInspectionId
          ? "Tekli DÖF kaydedildi, Denetimler kaydına bağlandı ve Word çıktısı indirildi."
          : "Tekli DÖF kaydedildi ve Word çıktısı indirildi."
      );
    } catch (error) {
      console.error("Single preview export error:", error);
      toast.error(getUserFriendlyErrorMessage(error, "single-export"));
    } finally {
      setSaving(false);
    }
  };

  // ? DELETE ENTRY
  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.info("Bulgu silindi");
  };


const handleSaveAndExport = async () => {
  if (!reportCompanyName.trim()) {
    toast.error("Lütfen firma seçin veya manuel firma adi girin");
    return;
  }
  if (!generalInfoStepReady) {
    toast.error("Lütfen önce firma, rapor tarihi ve gözlem yapan bilgisini girin");
    setCreateDialogOpen(true);
    setCreateStep("general");
    return;
  }
  if (entries.length === 0) {
    toast.error("Lütfen en az bir bulgu ekleyin");
    return;
  }

  setSaving(true);

  try {
    let savedReportUrl: string | null = null;
    let reportFileName: string = "";
    let createdInspectionId: string | null = null;

    // ? 1. DATABASE KAYITLARI
    if (user) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (profile?.organization_id) {
          const { data: inspection, error: inspectionError } = await supabase
            .from("inspections")
            .insert({
              org_id: profile.organization_id,
              user_id: user.id,
              location_name: effectiveLocation,
              status: "completed",
              risk_level: "high",
              media_urls: entries.flatMap(e => e.media_urls),
              notes: `Toplu DÖF Formu - ${entries.length} bulgu (AI Analiz)`,
              risk_definition: entries.map((e, i) => `${i + 1}. ${e.riskDefinition}`).join('\n\n'),
              corrective_action: entries.map((e, i) => `${i + 1}. ${e.correctiveAction}`).join('\n\n'),
              preventive_action: entries.map((e, i) => `${i + 1}. ${e.preventiveAction}`).join('\n\n'),
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (inspectionError) throw inspectionError;

          if (inspection) {
            createdInspectionId = inspection.id;
            const { data: sessionRow, error: sessionError } = await (supabase as any)
              .from("bulk_capa_sessions")
              .insert({
                org_id: profile.organization_id,
                user_id: user.id,
                recipient_email: user.email || "",
                site_name: effectiveLocation,
                company_name: reportCompanyName,
                department_name: newEntry.related_department || null,
                organization_id: orgData?.id || null,
                overall_analysis: overallAnalysis || null,
                entries_count: entries.length,
                status: "completed",
                area_region: generalInfo.area_region || null,
                observation_date_range: generalInfo.observation_range || null,
                report_date: generalInfo.report_date || null,
                observer_name: generalInfo.observer_name || null,
                observer_certificate_no: generalInfo.observer_certificate_no || null,
                responsible_person: generalInfo.responsible_person || null,
                employer_representative_title: generalInfo.employer_representative_title || null,
                employer_representative_name: generalInfo.employer_representative_name || null,
                report_no: generalInfo.report_no || null,
                service_company_logo_url: generalInfo.company_logo_url || selectedCompany?.logo_url || null,
              })
              .select("id")
              .single();

            if (sessionError) {
              console.warn("bulk_capa_sessions insert failed:", sessionError);
            } else if (sessionRow?.id) {
              const bulkEntries = entries.map((entry) => ({
                session_id: sessionRow.id,
                description: entry.description,
                risk_definition: entry.riskDefinition,
                corrective_action: entry.correctiveAction,
                preventive_action: entry.preventiveAction,
                priority:
                  entry.importance_level === "Kritik"
                    ? "critical"
                    : entry.importance_level === "Yüksek"
                    ? "high"
                    : entry.importance_level === "Düşük"
                    ? "low"
                    : "medium",
                due_date: entry.termin_date || null,
                related_department: entry.related_department || null,
                notification_method: entry.notification_method || null,
                responsible_name: entry.responsible_name || null,
                responsible_role: entry.responsible_role || null,
                approver_name: entry.approver_name || null,
                approver_title: entry.approver_title || null,
                include_stamp: entry.include_stamp,
                media_urls: entry.media_urls || [],
                ai_analyzed: entry.ai_analyzed,
              }));

              const { error: bulkEntriesError } = await (supabase as any)
                .from("bulk_capa_entries")
                .insert(bulkEntries);

              if (bulkEntriesError) {
                console.warn("bulk_capa_entries insert failed:", bulkEntriesError);
              }
            }

            for (const entry of entries) {
              await supabase.from("findings").insert({
                inspection_id: inspection.id,
                user_id: user.id,
                description: entry.description,
                action_required: entry.correctiveAction,
                risk_definition: entry.riskDefinition,
                preventive_action: entry.preventiveAction,
                due_date: entry.termin_date,
                priority:
                  entry.importance_level === "Kritik"
                    ? "critical"
                    : entry.importance_level === "Yüksek"
                    ? "high"
                    : entry.importance_level === "Düşük"
                    ? "low"
                    : "medium",
                notification_method: entry.notification_method,
              });
            }
            toast.success("Veriler veritabanina kaydedildi");
          }
        }
      } catch (dbError) {
        console.warn("Database save failed:", dbError);
        toast.warning("Veritabani kaydi basarisiz, Word raporu olusturuluyor.");
      }
    }

    // ? 2. WORD DOKÜMANI OLUSTUR
    toast.info("Word raporu olusturuluyor");

    const { generateBulkCapaOfficialDocx } = await loadBulkCapaDocx();
    const wordBlob = await generateBulkCapaOfficialDocx({
      entries: entries.map(
        (entry): BulkCapaOfficialEntry => ({
          id: entry.id,
          description: entry.description,
          riskDefinition: entry.riskDefinition,
          correctiveAction: entry.correctiveAction,
          preventiveAction: entry.preventiveAction,
          importanceLevel: entry.importance_level,
          terminDate: entry.termin_date,
          relatedDepartment: entry.related_department,
          notificationMethod: entry.notification_method,
          responsibleName: entry.responsible_name,
          responsibleRole: entry.responsible_role,
          approverName: entry.approver_name,
          approverTitle: entry.approver_title,
          includeStamp: entry.include_stamp,
          mediaUrls: entry.media_urls,
          aiAnalyzed: entry.ai_analyzed,
        }),
      ),
      locationName: effectiveLocation,
      reportCompanyName,
      orgData: orgData as BulkCapaOfficialOrganization | null,
      selectedCompany: selectedCompany as BulkCapaOfficialCompany | null,
      overallAnalysis,
      profileContext: profileContext as BulkCapaOfficialProfileContext | null,
      generalInfo: {
        companyName: generalInfo.company_name,
        companyLogoUrl: generalInfo.company_logo_url,
        providerLogoUrl: generalInfo.provider_logo_url,
        areaRegion: generalInfo.area_region,
        observationRange: generalInfo.observation_range,
        reportDate: generalInfo.report_date,
        observerName: generalInfo.observer_name,
        observerCertificateNo: generalInfo.observer_certificate_no,
        responsiblePerson: generalInfo.responsible_person,
        employerRepresentativeTitle: generalInfo.employer_representative_title,
        employerRepresentativeName: generalInfo.employer_representative_name,
        reportNo: generalInfo.report_no,
      } as BulkCapaOfficialGeneralInfo,
    });

    const today = new Date();
    const safeSiteName = (effectiveLocation || "firma")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "saha";
    reportFileName = `DOF_Raporu_${safeSiteName}_${today.toISOString().split("T")[0]}.docx`;

    let uploadError: { message?: string } | null = null;
    const reportStorageOwnerId = orgData?.id || user?.id || null;

    if (reportStorageOwnerId) {
      const storagePath = `${reportStorageOwnerId}/${reportFileName}`;

      const { data: uploadData, error } = await supabase.storage
        .from("dof-reports")
        .upload(storagePath, wordBlob, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });

      uploadError = error;
      if (error) {
        console.error("Storage upload error:", error);
        toast.error(getUserFriendlyErrorMessage(`storage upload: ${error.message}`, "export"));
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("dof-reports")
          .getPublicUrl(uploadData.path);

        savedReportUrl = publicUrlData.publicUrl;
      }
    }

    if (user?.id) {
      const { error: dbError } = await supabase.from("reports").insert({
        org_id: orgData?.id || null,
        user_id: user.id,
        title: `DÖF Raporu - ${effectiveLocation}`,
        report_type: "inspection",
        generated_at: today.toISOString(),
        export_format: "docx",
        file_url: savedReportUrl,
        content: {
          company_name: reportCompanyName,
          report_no: generalInfo.report_no || null,
          report_date: generalInfo.report_date || null,
          observation_range: generalInfo.observation_range || null,
          observer_name: generalInfo.observer_name || null,
          observer_certificate_no: generalInfo.observer_certificate_no || null,
          employer_representative_name: generalInfo.employer_representative_name || null,
          employer_representative_title: generalInfo.employer_representative_title || null,
          responsible_person: generalInfo.responsible_person || null,
          area_region: generalInfo.area_region || null,
          company_logo_url: generalInfo.company_logo_url || null,
          provider_logo_url: generalInfo.provider_logo_url || null,
          inspection_id: createdInspectionId,
          report_kind: "dof",
          entries_count: entries.length,
          ai_analyzed_count: entries.filter((e) => e.ai_analyzed).length,
          location: effectiveLocation,
          overall_analysis: overallAnalysis || null,
          storage_upload_ok: !uploadError,
          storage_error: uploadError?.message ?? null,
        },
      });

      if (dbError) {
        console.error("Reports insert error:", dbError);
        toast.error(`Rapor kaydi olusturulamadi: ${dbError.message}`);
      } else {
        toast.success("Rapor arsivlendi");
      }
    } else {
      toast.info("Kullanıcı kaydı olmadan arşiv bağlantısı oluşturulamadı, Word dosyası indiriliyor.");
    }

    await downloadBlob(wordBlob, reportFileName);
    toast.info("E-posta için: Denetimler > Detay > E-posta Gönder");

    setEntries([]);
    setBulkSourceImages([]);
    setSelectedCompanyId("");
    setManualCompanyName("");
    setCompanyInputMode("existing");
    setOverallAnalysis("");
    setGeneralInfo({
      company_name: "",
      company_logo_url: null,
      provider_logo_url: null,
      area_region: "",
      observation_range: "",
      report_date: new Date().toISOString().split("T")[0],
      observer_name: profileContext?.full_name || "",
      observer_certificate_no: "",
      responsible_person: "İŞVEREN / İŞVEREN VEKİLİ",
      employer_representative_title: "İşveren / İşveren Vekili",
      employer_representative_name: "",
      report_no: "",
    });
    setCreateStep("general");
    setNewEntry({
      id: "",
      description: "",
      riskDefinition: "",
      correctiveAction: "",
      preventiveAction: "",
      importance_level: "Orta",
      termin_date: "",
      related_department: "Diger",
      notification_method: "E-mail",
      responsible_name: "",
      responsible_role: "",
      approver_name: generalInfo.observer_name || profileContext?.full_name || "",
      approver_title: profileContext?.position || "İş Güvenliği Uzmanı",
      include_stamp: true,
      media_urls: [],
      ai_analyzed: false,
    });

    toast.success("DÖF raporu olusturuldu");

    setTimeout(() => {
      navigate("/inspections");
    }, 3000);
  } catch (error: any) {
    console.error("Error:", error);
    toast.error(getUserFriendlyErrorMessage(error, "export"));
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-900" />
        </div>

        <div className="h-[720px] animate-pulse rounded-xl border border-primary/20 bg-slate-900/60" />
      </div>
    );
  }

  return (
    <div className="theme-page-readable space-y-8">
      <div className="rounded-[28px] border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.2),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] p-6 shadow-[0_28px_100px_rgba(15,23,42,0.45)] md:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200">
                Tekli ve çoklu DÖF oluşturma
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                Önce akışı seçin, sonra kaydı doldurun
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                Tekli veya çoklu DÖF oluşturun
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                Tek bir bulgu için tekli DÖF, birden fazla bulgu için çoklu DÖF seçin. Yapay zekâ ilk taslağı hazırlasın, siz de kuruma uygun hale getirip kaydı kolayca tamamlayın.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Açik maddeler</p>
                <p className="mt-3 text-3xl font-bold text-white">{entries.length}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">Toplu rapor için hazirlanan bulgular</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">AI hazirlananlar</p>
                <p className="mt-3 text-3xl font-bold text-white">{aiEntryCount}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">Fotograf veya nottan üretilen ilk taslaklar</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Kritik öncelik</p>
                <p className="mt-3 text-3xl font-bold text-white">{criticalEntryCount}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">Yakin takip gerektiren DÖF maddeleri</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Hızlı seçim rehberi
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Tekli mi, çoklu mu?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Tek bulgu için hızlı kayıt açın, aynı saha çalışmasındaki birden fazla bulgu için çoklu akışı kullanın. İsterseniz fotoğraf veya nottan yapay zekâ ile taslak da oluşturabilirsiniz.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">Hazirlik durumu</span>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                    {completedFieldCount}/{requiredFieldChecks.length}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-400">
                  {requiredFieldChecks.find((field) => !field.ready)?.label || "Bulgu listeye eklenebilir"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="text-sm font-semibold text-white">Yaklasan termin</span>
                <p className="mt-2 text-xs leading-6 text-slate-400">
                  {nearestDueEntry
                    ? `${new Date(nearestDueEntry.termin_date).toLocaleDateString("tr-TR")} • ${nearestDueEntry.related_department}`
                    : "Termin belirlenince burada öne çikarilir"}
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                <span className="text-sm font-semibold text-cyan-100">Nasıl karar verilir?</span>
                <ul className="mt-2 space-y-2 text-xs leading-6 text-cyan-50/90">
                  <li>• Tek bir uygunsuzluk varsa tekli DÖF seçin.</li>
                  <li>• Birden fazla uygunsuzluk varsa çoklu DÖF seçin.</li>
                  <li>• Fotoğraftan veya nottan başlamak isterseniz yapay zekâ ile taslak oluşturun.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card space-y-8 border border-primary/20 p-6 lg:p-8">
        <div className="space-y-6">
        <div className="rounded-[24px] border border-border/60 bg-background/70 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                Oluşturma tipi seçimi
              </p>
              <h3 className="text-lg font-bold text-foreground">
                Önce hangi akışı kullanacağınızı seçin
              </h3>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Tekli DÖF tek bir bulgu içindir. Çoklu DÖF ise aynı saha çalışmasındaki birden fazla bulguyu tek raporda toplamak içindir.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => {
                  resetEntryDraft();
                  setCreateMode("single");
                  setCreateStep("items");
                  setCreateDialogOpen(true);
                }}
                className="h-12 gap-2 gradient-primary border-0 text-foreground font-semibold"
              >
                <Plus className="h-4 w-4" />
                Tekli DÖF oluştur
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetEntryDraft();
                  setPreviewFocusEntryId(null);
                  setCreateMode("bulk");
                  setCreateStep("general");
                  setCreateDialogOpen(true);
                }}
                className="h-12 gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Çoklu DÖF oluştur
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {creationOverviewCards.map((card) => (
              <ModuleCard
                key={card.key}
                eyebrow={card.eyebrow}
                title={card.title}
                className="min-h-[172px] bg-secondary/20"
              >
                <p className="text-xs leading-6 text-muted-foreground">{card.body}</p>
              </ModuleCard>
            ))}
          </div>
        </div>

        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) setCreateStep(createMode === "bulk" ? "general" : "items");
          }}
        >
          <DialogContent className={cn("flex flex-col overflow-hidden border-primary/20 bg-slate-950/95 p-0 text-slate-100", createMode === "single" ? "max-h-[84vh] sm:max-w-xl lg:max-w-[860px]" : "max-h-[88vh] sm:max-w-2xl lg:max-w-3xl")}>
            <DialogHeader className={cn("border-b border-white/10 text-left", createMode === "single" ? "bg-[linear-gradient(135deg,rgba(8,145,178,0.92),rgba(16,185,129,0.86))] px-5 py-3.5" : "bg-[linear-gradient(135deg,rgba(124,58,237,0.92),rgba(168,85,247,0.86))] px-6 py-4")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className={cn("flex flex-wrap items-center gap-2", createMode === "single" ? "mb-2" : "mb-3")}>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
                      {createMode === "single" ? "Tekli DÖF" : "Çoklu DÖF"}
                    </span>
                    {createMode === "bulk" ? (
                      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                        1. Genel bilgiler → 2. Maddeler → 3. Önizleme
                      </span>
                    ) : (
                      <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                        Tek bulgu → Tek kayıt
                      </span>
                    )}
                  </div>
                  <DialogTitle className={cn("flex items-center gap-2 font-bold text-white", createMode === "single" ? "text-lg" : "text-xl")}>
                    {createMode === "single" ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                    {createMode === "single" ? "Tek bir bulgu için DÖF oluşturun" : "Birden fazla bulgu için çoklu DÖF oluşturun"}
                  </DialogTitle>
                  <DialogDescription className={cn("text-white/80", createMode === "single" ? "mt-1 text-[13px] leading-5" : "mt-2 text-sm")}>
                    {createMode === "single"
                      ? "Tek bir uygunsuzluğu hızlıca hazırlayın ve tek kayıt olarak ekleyin."
                      : "Önce rapor bilgilerini girin, sonra birden fazla bulguyu sırayla ekleyin."}
                  </DialogDescription>
                </div>
                <div className={cn("hidden rounded-2xl border border-white/15 bg-white/10 text-right text-xs text-white/80 sm:block", createMode === "single" ? "px-3 py-2.5" : "px-4 py-3")}>
                  <p className="font-semibold text-white">Aktif firma</p>
                  <p className="mt-1">{reportCompanyName || "Henüz seçilmedi"}</p>
                </div>
              </div>
            </DialogHeader>

            {createMode === "bulk" ? (
              <div className="border-b border-white/10 bg-slate-950/70 px-6 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  {[
                    { key: "general", label: "Genel Bilgiler" },
                    { key: "items", label: `Maddeler (${entries.length})` },
                    { key: "preview", label: "Önizleme" },
                  ].map((step, index) => (
                    <div key={step.key} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (step.key === "general") {
                            setPreviewOpen(false);
                            setCreateStep("general");
                            return;
                          }
                          if (step.key === "items") {
                            if (!generalInfoStepReady) {
                              toast.error("Önce firma, rapor tarihi ve gözlem yapan bilgisini girin");
                              return;
                            }
                            setPreviewOpen(false);
                            setCreateStep("items");
                            return;
                          }
                          if (entries.length === 0) {
                            toast.error("Önizleme için önce en az bir bulgu ekleyin");
                            return;
                          }
                          if (!generalInfoStepReady) {
                            toast.error("Önizleme için önce firma, rapor tarihi ve gözlem yapan bilgisini girin");
                            return;
                          }
                          setPreviewFocusEntryId(null);
                          setPreviewOpen(true);
                        }}
                        className={cn(
                          "rounded-full px-3 py-1.5 transition-colors",
                          (createStep === step.key || (step.key === "preview" && previewOpen))
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/5 text-slate-400 hover:bg-white/10"
                        )}
                      >
                        {step.label}
                      </button>
                      {index < 2 ? <ChevronRight className="h-3.5 w-3.5 text-slate-600" /> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 sm:px-6", createMode === "single" ? "py-3.5 sm:py-4" : "py-4 sm:py-5")}>
              {createMode === "bulk" && createStep === "general" ? (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
                    📋 Önce genel bilgileri doldurun. Bu bilgiler PDF raporunun üst sabit kısmında yer alacaktır.
                  </div>

                  {(suggestedGeneralTemplate || recentHeaderSuggestion) && (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {suggestedGeneralTemplate ? (
                        <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Önerilen şablon</p>
                          <p className="mt-2 text-base font-semibold text-white">{suggestedGeneralTemplate.name}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-200">
                            {suggestedTemplateReason || "Bu firmaya benzer kayıtlar için daha önce kaydedilmiş genel bilgi şablonu bulundu."}
                          </p>
                          <Button type="button" variant="outline" onClick={() => applySavedTemplate(suggestedGeneralTemplate)} className="mt-4 border-cyan-300/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15">
                            Şablonu Uygula
                          </Button>
                        </div>
                      ) : null}

                      {recentHeaderSuggestion ? (
                        <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">Son kullanılan üst bilgi</p>
                          <p className="mt-2 text-base font-semibold text-white">{recentHeaderSuggestion.area_region || "Alan belirtilmemiş"}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-200">
                            {recentHeaderSuggestionReason || "Bu firmada en son kullanılan rapor üst bilgisi bulundu. Tek tıkla yeniden uygulayabilirsiniz."}
                          </p>
                          <Button type="button" variant="outline" onClick={applyRecentHeaderSuggestion} className="mt-4 border-amber-300/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15">
                            Son Üst Bilgiyi Kullan
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-white">Firma *</Label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleCompanyModeChange("existing")} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${companyInputMode === "existing" ? "bg-primary/15 text-primary" : "bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>Firma seç</button>
                      <button type="button" onClick={() => handleCompanyModeChange("manual")} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${companyInputMode === "manual" ? "bg-primary/15 text-primary" : "bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>Manuel yaz</button>
                    </div>
                    {companyInputMode === "existing" ? (
                      <Popover open={companyComboboxOpen} onOpenChange={setCompanyComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" role="combobox" aria-expanded={companyComboboxOpen} className="h-12 w-full justify-between rounded-2xl border-white/15 bg-white/5 text-left font-normal text-white">
                            <span className="truncate">{selectedCompany ? selectedCompany.name : "Firma seçin veya arayın..."}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-border bg-card p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Firma ara..." value={companySearch} onValueChange={setCompanySearch} />
                            <CommandList>
                              <CommandEmpty>Bu aramada firma bulunamadı. İsterseniz manuel yaz moduna geçebilirsiniz.</CommandEmpty>
                              {filteredCompanies.map((company) => (
                                <CommandItem key={company.id} value={company.name} onSelect={() => { setSelectedCompanyId(company.id); setCompanyComboboxOpen(false); setCompanySearch(""); }}>
                                  <Check className={cn("mr-2 h-4 w-4", selectedCompanyId === company.id ? "opacity-100" : "opacity-0")} />
                                  {company.name}
                                </CommandItem>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input placeholder="Firma adını manuel yazın..." value={manualCompanyName} onChange={(e) => setManualCompanyName(e.target.value)} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                    )}
                    <p className="text-xs text-slate-400">
                      {companyInputMode === "existing"
                        ? companies.length > 0
                          ? "Sisteme eklediğiniz firmalar arasından seçim yapabilirsiniz."
                          : "Henüz kayıtlı firma bulunamadı. Manuel yaz modunu kullanabilirsiniz."
                        : "Firma sistemde yoksa adını manuel olarak yazabilirsiniz."}
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* Hizmet Alan Firma Logosu */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white">Hizmet Alan Firma Logosu</Label>

                      {(() => {
                        const src = generalInfo.company_logo_url ?? selectedCompany?.logo_url ?? "";
                        const hasLogo = Boolean(src);

                        return (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => clientLogoInputRef.current?.click()}
                              className="relative flex h-[84px] w-full items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-white/15 bg-white/5 text-sm text-slate-300 transition hover:border-primary/40 hover:bg-primary/10"
                            >
                              {hasLogo ? (
                                <>
                                  <img
                                    src={src}
                                    alt="Hizmet alan firma logosu"
                                    className="absolute inset-0 h-full w-full object-contain p-3"
                                  />
                                  <div className="absolute inset-0 bg-black/30" />
                                  <span className="relative z-10 text-sm font-semibold text-white">
                                    Logo Güncelle
                                  </span>
                                </>
                              ) : (
                                "Logo Yükle (max 2MB)"
                              )}
                            </button>

                            {hasLogo && (
                              <button
                                type="button"
                                className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-red-500/40 hover:bg-red-500/15"
                                onClick={() => {
                                  setGeneralInfo((prev) => ({ ...prev, company_logo_url: "" }));
                                  if (clientLogoInputRef.current) clientLogoInputRef.current.value = "";
                                }}
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      <input
                        ref={clientLogoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleLogoUpload(e, "company_logo_url")}
                      />
                    </div>

                    {/* Hizmet Veren Firma Logosu */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white">Hizmet Veren Firma Logosu</Label>

                      {(() => {
                        const src = generalInfo.provider_logo_url ?? "";
                        const hasLogo = Boolean(src);

                        return (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => providerLogoInputRef.current?.click()}
                              className="relative flex h-[84px] w-full items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-white/15 bg-white/5 text-sm text-slate-300 transition hover:border-primary/40 hover:bg-primary/10"
                            >
                              {hasLogo ? (
                                <>
                                  <img
                                    src={src}
                                    alt="Hizmet veren firma logosu"
                                    className="absolute inset-0 h-full w-full object-contain p-3"
                                  />
                                  <div className="absolute inset-0 bg-black/30" />
                                  <span className="relative z-10 text-sm font-semibold text-white">
                                    Logo Güncelle
                                  </span>
                                </>
                              ) : (
                                "Logo Yükle (opsiyonel)"
                              )}
                            </button>

                            {hasLogo && (
                              <button
                                type="button"
                                className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-red-500/40 hover:bg-red-500/15"
                                onClick={() => {
                                  setGeneralInfo((prev) => ({ ...prev, provider_logo_url: "" }));
                                  if (providerLogoInputRef.current) providerLogoInputRef.current.value = "";
                                }}
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      <input
                        ref={providerLogoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleLogoUpload(e, "provider_logo_url")}
                      />

                      <p className="text-xs text-slate-400">Sadece PDF çıktısında gösterilir, kaydedilmez.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white">Alan / Bölge</Label>
                      <Input value={generalInfo.area_region} onChange={(e) => handleGeneralInfoChange("area_region", e.target.value)} placeholder="Örn: Üretim Sahası, Depo Alanı" className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white">Gözetim Yapılan Tarih Aralığı</Label>
                      <Input value={generalInfo.observation_range} onChange={(e) => handleGeneralInfoChange("observation_range", e.target.value)} placeholder="Örn: Ocak - Aralık" className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white">Rapor Tarihi</Label>
                      <Input type="date" value={generalInfo.report_date} onChange={(e) => handleGeneralInfoChange("report_date", e.target.value)} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white">Rapor No</Label>
                      <Input value={generalInfo.report_no} onChange={(e) => handleGeneralInfoChange("report_no", e.target.value)} placeholder="Rapor numarası giriniz" className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-indigo-400/20 bg-indigo-400/5 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold text-white">Gözetim Yapan (İSG Uzmanı)</h4>
                        <p className="mt-1 text-sm text-slate-300">Kaşe seçimi ve uzman bilgileri rapor üst bilgisinde kullanılır.</p>
                      </div>
                      <button type="button" onClick={() => setNewEntry((prev) => ({ ...prev, include_stamp: !prev.include_stamp }))} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">Kaşe Ekle</button>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-200">Ad Soyad</Label>
                        <Input value={generalInfo.observer_name} onChange={(e) => { handleGeneralInfoChange("observer_name", e.target.value); setNewEntry((prev) => ({ ...prev, approver_name: e.target.value })); }} placeholder="Ad Soyad" className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-200">Sertifika No</Label>
                        <Input value={generalInfo.observer_certificate_no} onChange={(e) => handleGeneralInfoChange("observer_certificate_no", e.target.value)} placeholder="İSG Uzmanı Sertifika No" className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white">Sorumlu Kişi</Label>
                      <Input value={generalInfo.responsible_person} onChange={(e) => handleGeneralInfoChange("responsible_person", e.target.value)} placeholder="İŞVEREN/İŞVEREN VEKİLİ" className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white">İşveren/İşveren Vekili</Label>
                      <Input value={generalInfo.employer_representative_name} onChange={(e) => handleGeneralInfoChange("employer_representative_name", e.target.value)} placeholder="Ad Soyad" className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTemplateDialogOpen(true)}
                      className="h-12 w-full rounded-2xl border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                    >
                      Kaydedilmiş DÖF Şablonlarım
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTemplateName(`${reportCompanyName || "Yeni"} şablonu`);
                        setTemplateDialogOpen(true);
                      }}
                      className="h-12 rounded-2xl border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                    >
                      Şablon Olarak Kaydet
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${generalInfoStepReady ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                      {generalInfoStepReady ? "Madde girişine hazır" : "Zorunlu başlangıç alanları eksik"}
                    </span>
                    <Button type="button" disabled={!generalInfoStepReady} onClick={() => setCreateStep("items")} className="h-12 rounded-2xl bg-emerald-500 px-6 font-semibold text-white hover:bg-emerald-400">
                      Madde Eklemeye Geç
                    </Button>
                  </div>
                </div>
              ) : (
              <div className="space-y-5">
                <div className={cn("flex flex-col rounded-[24px] md:flex-row md:items-center md:justify-between", createMode === "single" ? "gap-2.5 border border-cyan-400/15 bg-cyan-400/5 p-3.5" : "gap-3 border border-primary/15 bg-primary/5 p-4")}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
                      {createMode === "single" ? "Tekli DÖF formu" : "Madde akışı"}
                    </p>
                    <p className={cn("text-slate-300", createMode === "single" ? "mt-1 text-[13px] leading-5" : "mt-2 text-sm leading-6")}>
                      {createMode === "single"
                        ? "Tek bir uygunsuzluğu hızlıca oluşturun. Yapay zekâ taslağı destekler, siz son kontrolü yapıp kaydı tamamlayın."
                        : "Tek bir maddeyi hazırlayıp listeye ekleyin veya kayıtlı madde şablonlarından hızlı başlangıç yapın."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTemplateDialogMode("item");
                        setTemplateDialogOpen(true);
                      }}
                      className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                    >
                      Madde Şablonlarım
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTemplateDialogMode("item");
                        setTemplateName(`${newEntry.related_department || "Yeni"} madde şablonu`);
                        setTemplateDialogOpen(true);
                      }}
                      className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                    >
                      Maddeyi Şablon Kaydet
                    </Button>
                  </div>
                </div>

                {createMode === "bulk" ? (
                  <div className="space-y-4 rounded-[24px] border border-emerald-400/20 bg-emerald-400/5 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Yeni toplu DÖF akışı</p>
                        <h4 className="mt-2 text-lg font-bold text-white">Fotoğraf yükle, sistem analiz etsin, resmi DÖF dosyan hazır olsun</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Toplu modda artık maddeleri tek tek yazmanız gerekmiyor. Fotoğrafları yükleyin; sistem her görseli ayrı bulguya çevirsin, toplu DÖF taslağını ve resmi Word çıktısını otomatik hazırlasın.
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                        {bulkSourceImages.length}/{BULK_SOURCE_IMAGE_LIMIT} fotoğraf
                      </span>
                    </div>

                    <div
                      ref={dropZoneRef}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={cn(
                        "rounded-[24px] border border-dashed px-5 py-8 text-center transition-all",
                        dragActive ? "border-emerald-300 bg-emerald-400/10" : "border-white/15 bg-white/5",
                      )}
                    >
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-emerald-200">
                        <Upload className="h-7 w-7" />
                      </div>
                      <p className="mt-4 text-base font-semibold text-white">Toplu DÖF için fotoğraf yükle</p>
                      <p className="mt-2 text-sm text-slate-300">
                        Aynı saha turuna ait görselleri bırakın veya seçin. Sistem her fotoğrafı ayrı uygunsuzluk maddesi olarak analiz edecektir.
                      </p>
                      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                        <Button type="button" variant="outline" onClick={() => bulkFileInputRef.current?.click()} className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10">
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Fotoğraf Seç
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void handleGenerateBulkDraftFromPhotos()}
                          disabled={bulkGenerating || bulkSourceImages.length === 0 || !generalInfoStepReady}
                          className="border-0 bg-emerald-500 font-semibold text-white hover:bg-emerald-400"
                        >
                          {bulkGenerating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Toplu taslak hazırlanıyor...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Fotoğrafları Analiz Et ve DÖF Taslağı Oluştur
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {bulkSourceImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                        {bulkSourceImages.map((imageUrl, imageIndex) => (
                          <div key={buildMediaKey(imageUrl, imageIndex)} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
                            <img src={imageUrl} alt={`Toplu DÖF fotoğraf ${imageIndex + 1}`} className="h-32 w-full object-cover" />
                            <div className="flex items-center justify-between px-3 py-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                Fotoğraf {imageIndex + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBulkSourceImage(imageIndex)}
                                className="h-8 w-8 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
                        Henüz toplu analiz için yüklenmiş fotoğraf yok.
                      </div>
                    )}
                    <input
                      ref={bulkFileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                ) : null}

                {createMode === "bulk" && editingEntryId ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Madde etiketleri</p>
                      <p className="mt-1 text-sm text-slate-300">Şablonları daha sonra daha hızlı bulmak için konu etiketleri seçin.</p>
                    </div>
                    {itemTemplateTags.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setItemTemplateTags([])}
                        className="text-xs font-semibold text-slate-400 transition hover:text-white"
                      >
                        Temizle
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ITEM_TEMPLATE_TAGS.map((tag) => {
                      const active = itemTemplateTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setItemTemplateTags((prev) =>
                              prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
                            )
                          }
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                            active
                              ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                              : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
                ) : null}

                {createMode === "bulk" && !editingEntryId ? (
                  <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Fotoğraf odaklı toplu akış</p>
                        <h4 className="mt-2 text-lg font-bold text-white">Maddeler tabloya otomatik düşer, gerekirse satır bazında düzenlenir</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-200">
                          Bu ekranda artık manuel madde girişi zorunlu değil. Fotoğrafları analiz ettikten sonra aşağıdaki resmi tablo oluşur. Herhangi bir satırı değiştirmek isterseniz listeden <span className="font-semibold text-white">Düzenle</span> butonunu kullanın.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/30 px-4 py-3 text-sm text-cyan-100">
                        {entries.length > 0
                          ? `${entries.length} satır hazırlandı`
                          : "Henüz analiz edilmiş satır yok"}
                      </div>
                    </div>
                  </div>
                ) : null}

                {createMode === "single" || editingEntryId ? (
                <>
                <div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)_152px]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">DÖF No</p>
                    <p className="mt-3 text-lg font-bold text-white">{nextDofNumber}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                    <div className="flex gap-3">
                      <span className="text-lg">💡</span>
                      <p className="text-xs leading-6 text-slate-200">
                        Hazırladığınız DÖF raporunu bir sonraki adımda firmaya kolayca e-posta ile gönderebilirsiniz.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Fotoğraf (Opsiyonel)</p>
                        <p className="mt-2 text-[11px] leading-5 text-slate-400">Max 2 foto • 5MB • Önerilen: 800x600px</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-slate-900/80 text-primary transition-colors hover:border-primary hover:bg-primary/10"
                      >
                        <Upload className="h-5 w-5" />
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </div>
                </div>

                {newEntry.media_urls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {newEntry.media_urls.map((url, idx) => (
                      <div key={buildMediaKey(url, idx)} className="group relative">
                        <img src={url} alt={`Upload ${idx}`} className="h-24 w-full rounded-2xl border border-white/10 object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute right-2 top-2 rounded-full bg-slate-950/80 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {createMode === "single" && editingEntryId ? (
                <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/5 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                          Düzenleme Özeti
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Aşağıda, önizlemeden geri döndüğünüz kayıtta değiştirdiğiniz alanları canlı olarak görebilirsiniz.
                        </p>
                      </div>
                      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                        {singleEditDiffs.length} alan değişti
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {singleEditDiffs.length > 0 ? (
                        singleEditDiffs.map((diff) => (
                          <div key={String(diff.key)} className="rounded-2xl border border-cyan-300/15 bg-slate-950/30 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-white">{diff.label}</p>
                              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                                Güncellendi
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                              <span className="mr-2 inline-flex rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                Önce
                              </span>
                              {diff.before}
                            </p>
                            <p className="mt-2 text-xs text-cyan-200">
                              <span className="mr-2 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                                Şimdi
                              </span>
                              {diff.after}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-sm text-emerald-200">
                          Henüz alan değişikliği yapılmadı. Formu güncelledikçe farklar burada görünecek.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-white">Firma *</Label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleCompanyModeChange("existing")} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${companyInputMode === "existing" ? "bg-primary/15 text-primary" : "bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>Kayıtlı firmadan seç</button>
                    <button type="button" onClick={() => handleCompanyModeChange("manual")} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${companyInputMode === "manual" ? "bg-primary/15 text-primary" : "bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>Manuel firma gir</button>
                  </div>
                  {companyInputMode === "existing" ? (
                    <Popover open={companyComboboxOpen} onOpenChange={setCompanyComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" role="combobox" aria-expanded={companyComboboxOpen} className="h-12 w-full justify-between rounded-2xl border-white/15 bg-white/5 text-left font-normal text-white">
                          <span className="truncate">{selectedCompany ? selectedCompany.name : "Firma seçin veya arayın..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-border bg-card p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Firma ara..." value={companySearch} onValueChange={setCompanySearch} />
                          <CommandList>
                            <CommandEmpty>Bu aramada firma bulunamadı. İsterseniz manuel firma girişi yapabilirsiniz.</CommandEmpty>
                            {filteredCompanies.map((company) => (
                              <CommandItem key={company.id} value={company.name} onSelect={() => { setSelectedCompanyId(company.id); setCompanyComboboxOpen(false); setCompanySearch(""); }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedCompanyId === company.id ? "opacity-100" : "opacity-0")} />
                                {company.name}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Input placeholder="Firma adını manuel yazın..." value={manualCompanyName} onChange={(e) => setManualCompanyName(e.target.value)} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                  )}
                  <p className="text-xs text-slate-400">
                    {companyInputMode === "existing"
                      ? companies.length > 0
                        ? "Sisteme eklediğiniz firmalardan seçim yapabilirsiniz."
                        : "Kayıtlı firma bulunamadı. Manuel giriş modunu kullanabilirsiniz."
                      : "Firma listede yoksa adını kendiniz yazabilirsiniz."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-white">Bölüm</Label>
                  <Input placeholder="Örn: Üretim Sahası, Depo Alanı" value={newEntry.related_department} onChange={(e) => setNewEntry((prev) => ({ ...prev, related_department: e.target.value }))} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <h4 className="text-lg font-semibold text-white">Bulgular</h4>
                    </div>
                    <span className="text-xs font-medium text-fuchsia-300">AI ile analiz edilir</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-sm font-medium text-slate-200">Açıklama (Sadece Burayı Doldur)* <span className="text-slate-400">(20-300 karakter)</span></Label>
                      <span className="text-xs text-slate-500">{newEntry.description.length}/300 karakter</span>
                    </div>
                    <Textarea placeholder="örn: Korkuluklar standartlara uygun değil, Uygun olmayan istifleme, Yetersiz aydınlatma v.b." value={newEntry.description} maxLength={300} onChange={(e) => setNewEntry((prev) => ({ ...prev, description: e.target.value }))} className="min-h-28 rounded-2xl border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm font-medium text-slate-200">Uygunsuzluk Tanımı <span className="text-slate-400">(AI ile oluşturulur)</span></Label>
                    <Textarea placeholder="Yapay zeka bu alanı otomatik dolduracak..." value={newEntry.riskDefinition} onChange={(e) => setNewEntry((prev) => ({ ...prev, riskDefinition: e.target.value }))} className="min-h-24 rounded-2xl border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500" />
                  </div>
                  <Button type="button" onClick={handleAIAnalysis} disabled={analyzing || newEntry.media_urls.length === 0} className="mt-4 h-12 w-full rounded-2xl border-0 bg-[linear-gradient(90deg,rgba(216,180,254,0.95),rgba(192,132,252,0.95),rgba(168,85,247,0.95))] font-semibold text-white shadow-[0_18px_40px_rgba(147,51,234,0.25)]">
                    {analyzing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Yapay zeka hazırlıyor...</>) : (<><Sparkles className="mr-2 h-4 w-4" />Yapay Zeka ile Hazırla</>)}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-white">Düzeltici Faaliyet</Label>
                  <Textarea placeholder="Yapay zeka bu alanı otomatik dolduracak veya manuel yazabilirsiniz..." value={newEntry.correctiveAction} onChange={(e) => setNewEntry((prev) => ({ ...prev, correctiveAction: e.target.value }))} className="min-h-28 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-white">Öncelik</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {IMPORTANCE_LEVELS.map((level) => (
                        <button key={level.value} type="button" onClick={() => setNewEntry((prev) => ({ ...prev, importance_level: level.value as HazardEntry["importance_level"] }))} className={cn("rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all", newEntry.importance_level === level.value ? level.color : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10")}>{level.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-white">Termin Tarihi</Label>
                    <Input type="date" value={newEntry.termin_date} onChange={(e) => setNewEntry((prev) => ({ ...prev, termin_date: e.target.value }))} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white" />
                    <button type="button" onClick={() => setQuickDueDate(suggestedDueDays)} className="text-xs font-medium text-primary hover:text-primary/80">➥ Önerilen termini uygula</button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-white">Sorumlu Kişi(ler)</Label>
                    <Input placeholder="Ad Soyad" value={newEntry.responsible_name} onChange={(e) => setNewEntry((prev) => ({ ...prev, responsible_name: e.target.value }))} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-white">Sorumlu Görev</Label>
                    <Input placeholder="Örn: Üretim Müdürü, Bakım Teknisyeni" value={newEntry.responsible_role} onChange={(e) => setNewEntry((prev) => ({ ...prev, responsible_role: e.target.value }))} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                  </div>
                </div>

                <div className="rounded-[24px] border border-indigo-400/20 bg-indigo-400/5 p-5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-300" />
                    <h4 className="text-lg font-semibold text-white">Onaylayan (İş Güvenliği Uzmanı)</h4>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-200">Ad Soyad</Label>
                      <Input placeholder="İSG Uzmanı Ad Soyad" value={newEntry.approver_name} onChange={(e) => setNewEntry((prev) => ({ ...prev, approver_name: e.target.value }))} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-200">Ünvan</Label>
                      <Input placeholder="İş Güvenliği Uzmanı" value={newEntry.approver_title} onChange={(e) => setNewEntry((prev) => ({ ...prev, approver_title: e.target.value }))} className="h-12 rounded-2xl border-white/15 bg-white/5 text-white placeholder:text-slate-500" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-indigo-300/20 bg-indigo-300/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-indigo-100">İSG Uzmanı Kaşesi Ekle</p>
                      <p className="mt-1 text-xs leading-5 text-indigo-200/80">Kaşe yüklemek için Profilim → Ayarlar → Kaşe Bilgisi Yükle bölümünü kullanın.</p>
                    </div>
                    <Switch checked={newEntry.include_stamp} onCheckedChange={(checked) => setNewEntry((prev) => ({ ...prev, include_stamp: checked }))} />
                  </div>
                </div>
                </>
                ) : null}

              </div>
              )}
            </div>
            {(createMode === "single" || createStep === "items") ? (
              <div className="border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${newEntry.ai_analyzed ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground"}`}>{newEntry.ai_analyzed ? "AI ile hazırlandı" : "Manuel giriş"}</span>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${formReady ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{formReady ? "Kayda hazır" : "Eksik alanlar var"}</span>
                        {createMode === "bulk" ? (
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                            {entries.length > 0 ? `${entries.length} madde listede` : "Henüz listeye eklenen madde yok"}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs leading-6 text-slate-300">
                        {itemStepGuidance}
                      </p>
                      {!formReady ? (
                        <div className="flex flex-wrap gap-2">
                          {missingRequiredFields.map((field) => (
                            <span key={field} className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
                              Eksik: {field}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    {createMode === "bulk" ? (
                      <Button type="button" variant="outline" onClick={goToBulkGeneralStep} className="h-12 rounded-2xl border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                        Genel Bilgilere Dön
                      </Button>
                    ) : null}
                    {createMode === "bulk" && entries.length > 0 ? (
                      <Button type="button" variant="outline" onClick={handleOpenBulkPreview} className="h-12 rounded-2xl border-primary/30 bg-primary/10 text-primary hover:bg-primary/15">
                        <Eye className="mr-2 h-5 w-5" />
                        Önizlemeye Geç
                      </Button>
                    ) : null}
                    {createMode === "single" || editingEntryId ? (
                      <Button onClick={createMode === "single" ? handleCreateSingleDOF : handleAddEntry} className="h-12 min-w-[220px] rounded-2xl border-0 bg-emerald-500 font-semibold text-white shadow-[0_18px_40px_rgba(16,185,129,0.25)] hover:bg-emerald-400">
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        {createMode === "single"
                          ? (editingEntryId ? "Değişiklikleri Kaydet" : "Tekli DÖF Oluştur")
                          : "Satır Değişikliklerini Kaydet"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="border-primary/20 bg-slate-950/95 text-slate-100 sm:max-w-xl">
            <DialogHeader className="border-b border-white/10 pb-4">
              <DialogTitle className="text-xl font-bold text-white">
                {templateDialogMode === "general" ? "DÖF Genel Bilgi Şablonları" : "DÖF Madde Şablonları"}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                {templateDialogMode === "general"
                  ? "Genel bilgiler adımını tekrar tekrar doldurmamak için şablon seçebilir veya mevcut alanları şablon olarak kaydedebilirsiniz."
                  : "Sık kullandığınız bulgu ve faaliyet yapısını şablon olarak kaydedip tek tıkla yeni maddeye uygulayabilirsiniz."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={templateDialogMode === "general" ? "Örn: Yıllık saha gözetim raporu" : "Örn: KKD uygunsuzluğu standart maddesi"}
                  className="h-11 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                />
                <Button
                  type="button"
                  onClick={() => void (templateDialogMode === "general" ? saveCurrentTemplate() : saveCurrentItemTemplate())}
                  className="h-11 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-400"
                >
                  Kaydet
                </Button>
              </div>

              <div className="space-y-3">
                {templatesLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Şablonlar yükleniyor...</div>
                ) : (templateDialogMode === "general" ? savedTemplates : savedItemTemplates).length > 0 ? (
                  (templateDialogMode === "general" ? savedTemplates : savedItemTemplates).map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => (templateDialogMode === "general" ? applySavedTemplate(template) : applySavedItemTemplate(template))}
                      className="w-full rounded-[20px] border border-white/10 bg-white/5 p-4 text-left transition hover:border-primary/35 hover:bg-primary/10"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{template.name}</p>
                          <p className="mt-2 text-xs leading-6 text-slate-400">
                            {templateDialogMode === "general"
                              ? `${template.payload.company_name || "Firma belirtilmedi"} • ${template.payload.area_region || "Alan belirtilmedi"} • ${template.payload.observation_range || "Tarih aralığı belirtilmedi"}`
                              : `${template.payload.related_department || "Bölüm belirtilmedi"} • ${template.payload.importance_level || "Öncelik yok"} • ${template.payload.notification_method || "Bildirim yok"}`}
                          </p>
                          {templateDialogMode === "item" && Array.isArray(template.payload.tags) && template.payload.tags.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {template.payload.tags.map((tag: string) => (
                                <span key={`${template.id}-${tag}`} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                                  {tag}
                                </span>
                              ))}
                              {Array.isArray(template.payload.media_urls) && template.payload.media_urls.length > 0 ? (
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                                  {template.payload.media_urls.length} fotoğraf kayıtlı
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-300">
                          Uygula
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-300">
                    {templateDialogMode === "general"
                      ? "Henüz kayıtlı bir DÖF şablonu yok. Genel bilgileri doldurup bu pencereden şablon olarak kaydedebilirsiniz."
                      : "Henüz kayıtlı bir madde şablonu yok. Sık kullandığınız bulgu ve faaliyet setlerini burada saklayabilirsiniz."}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <ModuleCard
            eyebrow="Kural tabanlı öneri"
            title="Karar özeti ve şirket geçmişi"
            badge={hasMeaningfulHistoricalData ? `${historicalFindings.length} kayıt` : "Canlı taslak"}
            className="border-primary/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(15,23,42,0.88))] xl:col-span-7"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">
                  Bu öneri şu verilere göre üretildi
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendationEvidenceSummary}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Firma geçmişi</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{historicalFindings.length}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Aynı firma için taranan geçmiş bulgu ve DÖF kaydı</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Açık kayıtlar</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{historicalOpenCount}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Aynı şirkette halen kapanmamış takip gerektiren kayıt</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tekrar sinyali</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{repeatedIssueCount}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Mevcut bulguya yakın içerikte bulunan geçmiş kayıt</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/70">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Karar referansları</p>
                    <p className="mt-1 text-xs text-muted-foreground">Önce geçmiş kayıtlar kullanılır; veri yetersizse tahmini fallback devreye girer.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
                      Kayıt tabanlı
                    </span>
                    {(!priorityUsesHistoricalData || !responsibleUsesHistoricalData || !dueUsesHistoricalData) ? (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                        Kısmen tahmini
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="divide-y divide-border/60">
                  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Öncelik referansı</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {priorityUsesHistoricalData
                            ? `${historicalPriorityReference?.[1] || 0} benzer kayıtta en sık görülen öncelik bu seviyede.`
                            : "Yeterli geçmiş eşleşme olmadığı için mevcut madde metni ve sektör sinyallerine göre tahmini üretildi."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      {!priorityUsesHistoricalData ? (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                          Tahmini
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${IMPORTANCE_LEVELS.find((level) => level.value === recommendedPriorityValue)?.color}`}>
                        {recommendedPriorityValue}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Sorumlu referansı</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {responsibleUsesHistoricalData
                            ? "Benzer geçmiş kayıtlarda görülen sorumlu ataması referans olarak gösteriliyor."
                            : "Geçmiş atama verisi yetersiz olduğu için bölüm ve risk tipine göre ilk rol önerisi üretildi."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      {!responsibleUsesHistoricalData ? (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                          Tahmini
                        </span>
                      ) : null}
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{suggestedDepartment}</p>
                        <p className="text-xs text-muted-foreground">{suggestedRole}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Termin referansı</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {dueUsesHistoricalData
                            ? "Benzer geçmiş kayıtlardaki ortalama kapanış süresine göre hesaplandı."
                            : "Geçmiş termin verisi yok; öncelik seviyesine göre standart takip süresi öneriliyor."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      {!dueUsesHistoricalData ? (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                          Tahmini
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickDueDate(suggestedDueDays)}
                        className="h-9 rounded-xl"
                      >
                        {suggestedDueDays} gün uygula
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Aktif firma bağlamı</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{reportCompanyName || "Firma henüz seçilmedi"}</p>
                <p className="mt-1 text-xs leading-6 text-cyan-50/90">{companyContextSummary}</p>
                {!reportCompanyName ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={goToBulkGeneralStep}
                      className="h-9 rounded-xl border-cyan-300/30 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/15"
                    >
                      Genel bilgilere git
                    </Button>
                    <p className="text-xs text-cyan-50/80">
                      Firma seçimi `Genel Bilgiler` adımındaki `Firma seç` alanından yapılıyor.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </ModuleCard>

          <div className="space-y-4 xl:col-span-5">
            <ModuleCard eyebrow="Kural tabanlı öneri" title="Geçmiş eşleşmeler" badge={`${historicalSimilarEntries.length} kayıt`}>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                      Tahmini eşleşme
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{similarityEvidenceSummary}</p>
                </div>

                {historicalLoading ? (
                  <div className="rounded-2xl border border-border/60 bg-secondary/10 p-4 text-sm text-muted-foreground">Firma geçmişi taranıyor...</div>
                ) : historicalSimilarEntries.length > 0 ? (
                  historicalSimilarEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{entry.location_name}</p>
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">{entry.description}</p>
                        </div>
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                          %{Math.round(entry.similarity * 100)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full bg-background px-2 py-1">{entry.priority}</span>
                        <span className="rounded-full bg-background px-2 py-1">{new Date(entry.created_at).toLocaleDateString("tr-TR")}</span>
                        <span className="rounded-full bg-background px-2 py-1">{entry.is_resolved ? "Kapatıldı" : "Açık"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/10 p-4 text-sm text-muted-foreground">
                    Bu firmaya ait güçlü eşleşen geçmiş kayıt bulunmadı. Yeni kayıtlar oluştukça burada daha anlamlı karşılaştırmalar görünecek.
                  </div>
                )}
              </div>
            </ModuleCard>

          </div>
        </section>

        {entries.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-border/60 bg-background/60 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold !text-slate-100">
                    Eklenen Bulgular ({entries.length})
                  </h3>
                  <p className="mt-1 text-sm !text-slate-300">
                    {createMode === "bulk"
                      ? "Yüklenen fotoğraflardan otomatik üretilen uygunsuzluklar burada listelenir. Gerekirse tek tek düzenleyebilir veya silebilirsiniz."
                      : "Her maddeyi `Bulguyu Ekle` ile listeye alın. Tüm maddeler tamamlanınca önizlemeye geçin."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Liste hazır
                    </span>
                  <Button type="button" onClick={handleOpenBulkPreview} className="h-10 rounded-2xl border-0 gradient-primary font-semibold text-slate-950">
                    <Eye className="mr-2 h-4 w-4" />
                    Önizlemeye Geç
                  </Button>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-[1120px] w-full border-collapse text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="border-b border-white/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em]">No</th>
                        <th className="border-b border-white/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em]">Tespit Edilen Uygunsuzluk</th>
                        <th className="border-b border-white/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em]">Risk Analizi</th>
                        <th className="border-b border-white/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em]">Mevzuat Dayanağı</th>
                        <th className="border-b border-white/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em]">Önerilen DÖF (Aksiyon)</th>
                        <th className="border-b border-white/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em]">Durum</th>
                        <th className="border-b border-white/10 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em]">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white text-slate-900">
                      {entries.map((entry, idx) => {
                        const legalBasis = getBulkCapaLegalBasis({
                          description: entry.description,
                          riskDefinition: entry.riskDefinition,
                          relatedDepartment: entry.related_department,
                        });

                        return (
                          <tr key={entry.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="align-top border-b border-slate-200 px-3 py-3 text-xs font-semibold text-slate-500" style={{ color: "#64748b" }}>
                              {idx + 1}
                            </td>
                            <td className="align-top border-b border-slate-200 px-3 py-3 text-sm leading-6 !text-slate-900" style={{ color: "#0f172a" }}>
                              {entry.description}
                            </td>
                            <td className="align-top border-b border-slate-200 px-3 py-3 text-sm leading-6 !text-rose-700" style={{ color: "#be123c" }}>
                              {entry.riskDefinition}
                            </td>
                            <td className="align-top border-b border-slate-200 px-3 py-3 text-sm leading-6 !text-slate-700" style={{ color: "#334155" }}>
                              {legalBasis}
                            </td>
                            <td className="align-top border-b border-slate-200 px-3 py-3 text-sm leading-6 !text-slate-900" style={{ color: "#0f172a" }}>
                              <div style={{ color: "#0f172a" }}>{entry.correctiveAction}</div>
                              {entry.preventiveAction ? (
                                <div className="mt-2 !text-slate-700" style={{ color: "#334155" }}>{entry.preventiveAction}</div>
                              ) : null}
                            </td>
                            <td className="align-top border-b border-slate-200 px-3 py-3">
                              <div className="flex flex-col gap-2">
                                <span
                                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    IMPORTANCE_LEVELS.find((level) => level.value === entry.importance_level)?.color
                                  }`}
                                >
                                  {entry.importance_level}
                                </span>
                                <span className="text-xs !text-slate-600" style={{ color: "#475569" }}>
                                  Termin: {entry.termin_date ? new Date(entry.termin_date).toLocaleDateString("tr-TR") : "-"}
                                </span>
                                <span className="text-xs !text-slate-600" style={{ color: "#475569" }}>
                                  Kanıt: {entry.media_urls.length} fotoğraf
                                </span>
                              </div>
                            </td>
                            <td className="align-top border-b border-slate-200 px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditExistingEntry(entry.id)}
                                  className="border-slate-300 bg-white !text-slate-900 hover:bg-slate-100 hover:!text-slate-950"
                                  style={{ color: "#0f172a" }}
                                >
                                  Düzenle
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[24px] border border-border/60 bg-secondary/20 p-6 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold !text-slate-100">Genel Analiz</h3>
                    <p className="mt-1 text-sm !text-slate-300">
                      Tüm DÖF maddeleri için tek bir yönetici özeti ve genel değerlendirme üretin.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={generateOverallAnalysis}
                    disabled={overallAnalyzing || entries.length === 0}
                    className="h-11 gap-2 border-0 gradient-primary font-semibold !text-slate-950"
                  >
                    {overallAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Genel analiz hazırlanıyor...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        AI ile Genel Analiz Oluştur
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  placeholder="Genel analiz burada yer alır. İsterseniz düzenleyebilirsiniz."
                  value={overallAnalysis}
                  onChange={(e) => setOverallAnalysis(e.target.value)}
                  className="min-h-32 resize-y border-border/50 bg-secondary/50 !text-slate-100 placeholder:!text-slate-400"
                />
              </div>

              <div className="rounded-[24px] border border-border/60 bg-background/60 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                      Çıktı Merkezi
                    </p>
                    <h3 className="mt-2 text-lg font-bold !text-slate-100">
                      Önizle, kaydet ve raporu indir
                    </h3>
                  </div>
                    <span className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs !text-slate-400">
                      Word çıktısı
                    </span>
                </div>

                <div className="mt-5 flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    className="h-11 flex-1 gap-2 !text-slate-100"
                    onClick={() => {
                      if (!generalInfoStepReady) {
                        toast.error("Önizleme için önce firma, rapor tarihi ve gözlem yapan bilgisini girin");
                        setCreateStep("general");
                        return;
                      }
                      setPreviewFocusEntryId(null);
                      setPreviewOpen(true);
                    }}
                    disabled={entries.length === 0}
                  >
                    <Eye className="h-4 w-4" />
                    Önizleme
                  </Button>
                  <Button
                    onClick={handleSaveAndExport}
                    disabled={saving || entries.length === 0 || !reportCompanyName.trim() || !generalInfoStepReady}
                    className={`h-11 flex-1 gap-2 border-0 font-semibold ${
                      saving || entries.length === 0 || !reportCompanyName.trim() || !generalInfoStepReady
                        ? "cursor-not-allowed bg-gray-500 !text-slate-200 opacity-50"
                        : "gradient-primary !text-slate-950"
                    }`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        İşleniyor...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Kaydet ve Word İndir
                      </>
                    )}
                  </Button>
                </div>

                <p className="mt-4 text-xs leading-6 !text-slate-400">
                  E-posta paylaşımı bu ekranda kaldırıldı. Raporu indirdikten sonra Denetimler sayfasındaki ilgili kayıt detayından paylaşabilirsiniz.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      <Suspense fallback={null}>
        <BulkCapaPreviewDialog
          open={previewOpen}
          onOpenChange={(open) => {
            setPreviewOpen(open);
            if (!open) setPreviewFocusEntryId(null);
          }}
          previewFocusEntryId={previewFocusEntryId}
          focusedPreviewEntry={focusedPreviewEntry}
          lastSingleInspectionId={lastSingleInspectionId}
          lastSingleCreatedAt={lastSingleCreatedAt}
          generalInfo={generalInfo}
          profileContext={profileContext}
          reportCompanyName={reportCompanyName}
          selectedCompany={selectedCompany}
          previewEntries={previewEntries}
          overallAnalysis={overallAnalysis}
          saving={saving}
          onClose={() => setPreviewOpen(false)}
          onReturnSinglePreviewToEdit={handleReturnSinglePreviewToEdit}
          onSaveSinglePreviewExport={handleSaveSinglePreviewExport}
          onOpenInspection={(inspectionId) => {
            setPreviewOpen(false);
            navigate("/inspections", {
              state: { focusInspectionId: inspectionId },
            });
          }}
        />
      </Suspense>
    </div>
  );
}

export default function BulkCAPA() {
  return (
    <BulkCAPAErrorBoundary>
      <BulkCAPAContent />
    </BulkCAPAErrorBoundary>
  );
}
