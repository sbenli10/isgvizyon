import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { debounce } from "lodash";
import { supabase } from "@/integrations/supabase/client";
import { generateRisksWithGemini } from "@/services/geminiService";
import type { GeminiRiskResult } from "@/services/geminiService";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Download,
  Trash2,
  Loader2,
  Library,
  Search,
  X,
  Maximize2,
  Minimize2,
  FileText,
  Camera,
  CheckCircle2,
  Keyboard,
  BookOpen,
  MousePointer,
  Lightbulb,
  HelpCircle,
  Sparkles,
  Check,
  Share2,
  Save,
  Upload,
  Columns3,
  ListOrdered,
  CalendarClock,
  ClipboardList,
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  RiskAssessment,
  RiskItem,
  RiskItemStatus,
  RiskLibraryItem,
  RiskPackage,
  RiskClass
} from "@/types/risk-assessment";
import {
  FINE_KINNEY_SCALES,
  calculateRiskScore,
  getRiskClass,
  getRiskClassColor,
  getRiskClassLabel,
  RISK_SECTORS
} from "@/types/risk-assessment";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { SendReportModal } from "@/components/SendReportModal";
import * as XLSX from "xlsx";
import { buildRiskAssessmentPdf } from "@/lib/riskAssessmentPdfExport";
import { RISK_SECTOR_CATALOG, buildCatalogKey } from "@/lib/riskSectorCatalog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


let scrollLock = 0;

const SECTOR_UI_META: Record<string, { accent: string; hint: string }> = {
  otomotiv: { accent: "from-sky-500/20 to-cyan-500/10", hint: "Montaj, pres ve araç hattı riskleri" },
  insaat: { accent: "from-amber-500/20 to-orange-500/10", hint: "Yüksekte çalışma ve saha operasyon riskleri" },
  gida: { accent: "from-emerald-500/20 to-lime-500/10", hint: "Hijyen, sıcak yüzey ve üretim akışı riskleri" },
  metal: { accent: "from-cyan-500/20 to-blue-500/10", hint: "Kesme, taşlama, kaynak ve pres riskleri" },
  tekstil: { accent: "from-pink-500/20 to-rose-500/10", hint: "Makine, ergonomi ve lif maruziyeti riskleri" },
  kimya: { accent: "from-fuchsia-500/20 to-violet-500/10", hint: "Kimyasal maruziyet ve reaksiyon riskleri" },
  lojistik: { accent: "from-indigo-500/20 to-violet-500/10", hint: "Yükleme, istifleme ve sevkiyat riskleri" },
  enerji: { accent: "from-yellow-500/20 to-amber-500/10", hint: "Elektrik, saha ve bakım operasyon riskleri" },
  maden: { accent: "from-stone-500/20 to-zinc-500/10", hint: "Toz, göçük ve ağır ekipman riskleri" },
  saglik: { accent: "from-red-500/20 to-rose-500/10", hint: "Biyolojik, kesici-delici ve vardiya riskleri" },
  egitim: { accent: "from-blue-500/20 to-sky-500/10", hint: "Yoğunluk, tahliye ve ergonomi riskleri" },
  ofis: { accent: "from-slate-400/20 to-slate-500/10", hint: "Ergonomi ve ekranlı araç riskleri" },
  tarim: { accent: "from-lime-500/20 to-green-500/10", hint: "Makine, ilaçlama ve açık alan riskleri" },
  turizm: { accent: "from-teal-500/20 to-emerald-500/10", hint: "Konaklama, mutfak ve servis riskleri" },
  perakende: { accent: "from-orange-500/20 to-amber-500/10", hint: "Raf, müşteri alanı ve kasa operasyon riskleri" },
  ahsap: { accent: "from-amber-600/20 to-yellow-600/10", hint: "Ahşap tozu, kesici makineler ve mobilya riskleri" },
  plastik: { accent: "from-violet-500/20 to-fuchsia-500/10", hint: "Enjeksiyon, sıcak yüzey ve kalıp değişim riskleri" },
  kagit: { accent: "from-slate-300/20 to-slate-500/10", hint: "Oluklu hat, kesme ve toz yükü riskleri" },
  cimento: { accent: "from-zinc-500/20 to-stone-500/10", hint: "Toz, silo ve hazır beton operasyon riskleri" },
  seramik: { accent: "from-orange-400/20 to-amber-400/10", hint: "Fırın, kırılma ve toz maruziyeti riskleri" },
  liman: { accent: "from-sky-600/20 to-blue-600/10", hint: "Konteyner, rıhtım ve vinç operasyon riskleri" },
  havacilik: { accent: "from-cyan-400/20 to-sky-500/10", hint: "Hangar, apron ve yakıt operasyon riskleri" },
  denizcilik: { accent: "from-blue-600/20 to-indigo-600/10", hint: "Gemi içi bakım ve iskele operasyon riskleri" },
  akaryakit: { accent: "from-rose-500/20 to-orange-500/10", hint: "Yanıcı ortam ve dolum operasyon riskleri" },
  depoculuk: { accent: "from-indigo-400/20 to-violet-400/10", hint: "Raf, forklift ve yüksek istif riskleri" },
  ilac: { accent: "from-emerald-400/20 to-cyan-400/10", hint: "Steril alan, GMP ve kimyasal maruziyet riskleri" },
  laboratuvar: { accent: "from-fuchsia-400/20 to-pink-400/10", hint: "Numune, cam ekipman ve biyogüvenlik riskleri" },
  belediye: { accent: "from-slate-500/20 to-indigo-500/10", hint: "Saha hizmeti, altyapı ve bakım riskleri" },
  atik: { accent: "from-green-500/20 to-emerald-500/10", hint: "Ayrıştırma, biyolojik ve kesici atık riskleri" },
  guvenlik: { accent: "from-violet-500/20 to-purple-500/10", hint: "Devriye, gece vardiyası ve müdahale riskleri" },
  temizlik: { accent: "from-cyan-500/20 to-teal-500/10", hint: "Kimyasal, kaygan zemin ve ekipman riskleri" },
  cagri_merkezi: { accent: "from-slate-500/20 to-blue-500/10", hint: "Headset, vardiya ve stres yönetimi riskleri" },
};

const SECTOR_ALIAS_MAP: Record<string, string> = {
  "metal işleme": "metal",
  "lojistik & depo": "lojistik",
  "maden & taş ocağı": "maden",
  "ofis & hizmet": "ofis",
  "tarım & hayvancılık": "tarim",
  "turizm & otel": "turizm",
  "ahşap & mobilya": "ahsap",
  "plastik & enjeksiyon": "plastik",
  "çağrı merkezi": "cagri_merkezi",
  "özel güvenlik": "guvenlik",
  "atık yönetimi": "atik",
  "ilaç & medikal": "ilac",
  "çimento & beton": "cimento",
  "seramik & cam": "seramik",
  "liman & terminal": "liman",
  "akaryakıt & lpg": "akaryakit",
  "belediye hizmetleri": "belediye",
  "sağlık": "saglik",
  "eğitim": "egitim",
  "kimya": "kimya",
  "lojistik": "lojistik",
  "inşaat": "insaat",
  "gıda": "gida",
  "tekstil": "tekstil",
  "ofis": "ofis",
  "tarım": "tarim",
  "havacılık": "havacilik",
  "denizcilik": "denizcilik",
  "depoculuk": "depoculuk",
};

const normalizeSectorKey = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return SECTOR_ALIAS_MAP[normalized] || normalized;
};

type AssessmentMethod = "fine_kinney" | "l_matrix";

interface RiskAssessmentTemplateRecord {
  id: string;
  name: string;
  sector?: string | null;
  method: AssessmentMethod | string;
  payload: {
    assessment?: Partial<RiskAssessment>;
    items?: Array<Partial<RiskItem>>;
  };
  created_at: string;
}

const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const ensureMinimumCount = <T,>(items: T[], minCount: number, factory: (index: number) => T) => {
  const nextItems = [...items];
  while (nextItems.length < minCount) {
    nextItems.push(factory(nextItems.length));
  }
  return nextItems;
};

const COMMON_TEMPLATE_RISKS = [
  {
    hazard: "Acil Durum Hazırlığı",
    risk: "Acil durum ekiplerinin görev paylaşımı, yönlendirme levhaları ve kaçış akışının güncel olmaması.",
    category: "Acil Durum",
    o: 3,
    f: 3,
    s: 40,
    controls: ["Tahliye gecikmesi, panik, yaralanma", "Acil durum planı, tatbikat ve levha kontrolleri düzenli yapılmalı"],
  },
  {
    hazard: "Düzensiz Çalışma Alanı",
    risk: "Günlük housekeeping disiplininin zayıf olması nedeniyle geçiş yollarının ve çalışma alanlarının dağınık kalması.",
    category: "Housekeeping",
    o: 6,
    f: 6,
    s: 7,
    controls: ["Takılma, düşme, ekipman hasarı", "5S denetimi, vardiya sonu kontrol listesi ve alan sorumluluğu tanımlanmalı"],
  },
  {
    hazard: "Yetkisiz Müdahale",
    risk: "Bakım, elektrik veya proses ekipmanlarına yetkisiz personelin müdahale etmesi.",
    category: "Yetkilendirme",
    o: 3,
    f: 3,
    s: 40,
    controls: ["Elektrik çarpması, proses duruşu, yaralanma", "Yetkilendirme matrisi, LOTO ve izinli çalışma sistemi uygulanmalı"],
  },
  {
    hazard: "KKD Disiplini",
    risk: "İşe uygun kişisel koruyucu donanımın eksik, yanlış veya düzensiz kullanılması.",
    category: "Kişisel Koruyucu Donanım",
    o: 6,
    f: 6,
    s: 15,
    controls: ["Kesilme, göz yaralanması, maruziyet, travma", "Saha bazlı KKD matrisi, zimmet takibi ve vardiya denetimi uygulanmalı"],
  },
  {
    hazard: "Yetersiz Eğitim ve Bilgilendirme",
    risk: "Çalışanların işi, ekipmanı veya acil durum akışını yeterince bilmeden çalışmaya başlaması.",
    category: "Eğitim",
    o: 6,
    f: 3,
    s: 15,
    controls: ["Hatalı uygulama, ramak kala, proses sapması", "İşe başlangıç eğitimi, toolbox ve görev kartları güncellenmeli"],
  },
  {
    hazard: "Periyodik Kontrol Eksikliği",
    risk: "Ekipman, kaldırma araçları veya basınçlı sistemlerin periyodik kontrollerinin gecikmesi.",
    category: "Periyodik Kontrol",
    o: 3,
    f: 3,
    s: 40,
    controls: ["Ekipman arızası, ani duruş, ciddi yaralanma", "Periyodik kontrol takvimi ve etiket takibi dijital olarak sürdürülmeli"],
  },
];

export default function RiskAssessmentEditor() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const createdFromWizard = Boolean((location.state as { createdFromWizard?: boolean } | null)?.createdFromWizard);
  const activeCompanyId = searchParams.get("companyId") || "";
  const riskPhotoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // E-posta modal için state'ler
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [currentReportUrl, setCurrentReportUrl] = useState("");
  const [currentReportFilename, setCurrentReportFilename] = useState("");
  // State Management
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const bridgedAssessmentId = (location.state as { assessmentId?: string } | null)?.assessmentId || assessment?.id || "-";
  const [riskItems, setRiskItems] = useState<RiskItem[]>([]);
  const [library, setLibrary] = useState<RiskLibraryItem[]>([]);
  const [riskPackages, setRiskPackages] = useState<RiskPackage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollLeft = useRef(0); // Scroll pozisyonunu hafızada tutar, render tetiklemez
  const [editingCell, setEditingCell] = useState<{
    itemId: string;
    field: keyof RiskItem;
  } | null>(null);
  const [editValue, setEditValue] = useState<any>("");

  // YENİ: AI Risk Generator
  const [aiSector, setAiSector] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRisks, setAiRisks] = useState<Array<{
    id: string;
    hazard: string;
    risk: string;
    category: string;
    probability: number;
    frequency: number;
    severity: number;
    score: number;
    riskClass: RiskClass;
    controls: string[];
    selected: boolean;
  }>>([]);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiCategoryFilter, setAiCategoryFilter] = useState<string>("all");
  const [photoUploadingItemId, setPhotoUploadingItemId] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [showOrderColumn, setShowOrderColumn] = useState(true);
  const [showTerminColumn, setShowTerminColumn] = useState(true);
  const [showStatusColumns, setShowStatusColumns] = useState(true);
  const [showProposedControlsColumn, setShowProposedControlsColumn] = useState(true);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [riskTemplates, setRiskTemplates] = useState<RiskAssessmentTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedAiSector = useMemo(() => normalizeSectorKey(aiSector), [aiSector]);
  const selectedSectorOption = useMemo(
    () =>
      RISK_SECTORS.find(
        (sector) =>
          sector.id === aiSector ||
          sector.id === normalizedAiSector ||
          buildCatalogKey(sector.name) === buildCatalogKey(aiSector)
      ),
    [aiSector, normalizedAiSector]
  );
  const selectedSectorMeta = useMemo(
    () =>
      selectedSectorOption
        ? SECTOR_UI_META[normalizeSectorKey(selectedSectorOption.name)] ?? {
            accent: "from-slate-500/20 to-slate-700/10",
            hint: "Sektöre özel risk paketi ve önerilen önlemler",
          }
        : null,
    [selectedSectorOption]
  );
  const selectedSectorRiskPreview = useMemo(() => {
    if (!selectedSectorOption) return [];
    return generateMockRisksForSector(selectedSectorOption.name);
  }, [selectedSectorOption]);
  const currentAssessmentMethod = ((assessment?.method as AssessmentMethod | undefined) || "fine_kinney");
  const templatePayload = useMemo(
    () => ({
      assessment: assessment
        ? {
            sector: assessment.sector,
            method: currentAssessmentMethod,
            notes: assessment.notes,
            department: assessment.department,
            workplace_title: assessment.workplace_title,
            workplace_address: assessment.workplace_address,
          }
        : { method: currentAssessmentMethod },
      items: riskItems.map((item) => ({
        department: item.department,
        hazard: item.hazard,
        risk: item.risk,
        affected_people: item.affected_people,
        existing_controls: item.existing_controls,
        probability_1: item.probability_1,
        frequency_1: item.frequency_1,
        severity_1: item.severity_1,
        score_1: item.score_1,
        risk_class_1: item.risk_class_1,
        proposed_controls: item.proposed_controls,
        probability_2: item.probability_2,
        frequency_2: item.frequency_2,
        severity_2: item.severity_2,
        score_2: item.score_2,
        risk_class_2: item.risk_class_2,
        responsible_person: item.responsible_person,
        deadline: item.deadline,
        status: item.status,
        completion_date: item.completion_date,
        completed_activity: item.completed_activity,
      })),
    }),
    [assessment, currentAssessmentMethod, riskItems]
  );
  const selectedSectorDistribution = useMemo(() => {
    const bucket = { critical: 0, high: 0, monitored: 0 };
    selectedSectorRiskPreview.forEach((risk) => {
      if (risk.riskClass === "Çok Yüksek") bucket.critical += 1;
      else if (risk.riskClass === "Yüksek") bucket.high += 1;
      else bucket.monitored += 1;
    });
    return bucket;
  }, [selectedSectorRiskPreview]);


  interface AIRiskPanelProps {
    isAssessmentActive: boolean;
    aiGenerating: boolean;
    onGenerate: (sector: string) => void;
  }

// TAM BURAYA EKLE:
  useLayoutEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    if (scrollLock > 0) {
      container.scrollLeft = scrollLock;
    }
  }, [riskItems]);

// 2. Bileşen içine ekle
useLayoutEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScrollCapture = () => {
        if (container.scrollLeft !== 0) {
        scrollLock = container.scrollLeft;
        }
    };

    container.addEventListener('scroll', handleScrollCapture);
    
    // riskItems değiştiğinde (Render olduğunda) kilitlenen pozisyonu zorla uygula
    if (scrollLock > 0) {
        container.scrollLeft = scrollLock;
    }

    return () => container.removeEventListener('scroll', handleScrollCapture);
    }, [riskItems]);
 // 1. Şirket ve Kütüphane verilerini çek
 // 1. Şirket ve Kütüphane verilerini çek
useEffect(() => {
  if (user) {
    fetchCompanies();
    fetchLibrary();
    fetchRiskTemplates();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Burayı boş dizi yap, user değişimini AuthContext hallediyor zaten

useEffect(() => {
  if (profile?.organization_id) {
    void fetchRiskTemplates();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [profile?.organization_id]);

useEffect(() => {
  if (!activeCompanyId || companies.length === 0 || assessment?.company_id) return;
  if (!companies.some((company) => company.id === activeCompanyId)) return;
  setSelectedCompany((prev) => prev || activeCompanyId);
}, [activeCompanyId, assessment?.company_id, companies]);

useEffect(() => {
  const stateAssessmentId = (location.state as { assessmentId?: string } | null)?.assessmentId;
  if (stateAssessmentId) {
    fetchAssessmentById(stateAssessmentId);
    return;
  }
  const rawBridge = sessionStorage.getItem("risk-editor-bridge");
  if (!rawBridge) return;
  try {
    const bridge = JSON.parse(rawBridge) as { assessmentId?: string; createdAt?: number };
    if (bridge?.assessmentId && (!bridge.createdAt || Date.now() - bridge.createdAt < 5 * 60 * 1000)) {
      fetchAssessmentById(bridge.assessmentId);
    }
  } catch (error) {
    console.warn("risk-editor-bridge parse error", error);
  } finally {
    sessionStorage.removeItem("risk-editor-bridge");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.state])

  // Bileşen gövdesine ekle
useEffect(() => {
  console.log("RiskAssessmentEditor render oldu!");
});

useLayoutEffect(() => {
  const container = tableContainerRef.current;
  if (!container) return;

  const handleScrollLog = () => {
    // Sadece scroll 0 olduğunda log bas ki konsol dolmasın
    if (container.scrollLeft === 0) {
      console.warn("Scroll sıfırlandı. Tetikleyen olayı kontrol edin.", {
        activeElement: document.activeElement?.tagName, // O an hangi input/buton seçili?
        activeElementClass: document.activeElement?.className,
        reason: "Büyük ihtimalle bir Focus veya Render olayı"
      });
    }
  };

  container.addEventListener('scroll', handleScrollLog);
  return () => container.removeEventListener('scroll', handleScrollLog);
}, []);

  // 2. Kaydırma olayını yöneten fonksiyon (useCallback ile stabilize edildi)
  const handleScroll = useCallback(() => {
    if (tableContainerRef.current) {
      lastScrollLeft.current = tableContainerRef.current.scrollLeft;
    }
  }, []);

  // 3. Olay dinleyicisini bağla ve temizle
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    // 'passive: true' performansı artırır ve tarayıcıyı yormaz
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // 4. Tablo verisi (riskItems) güncellendiğinde pozisyonu koru
  // LayoutEffect kullanımı, tarayıcı çizim yapmadan hemen önce scroll'u sabitleyerek 'sıçrama' etkisini önler
  useEffect(() => {
    if (tableContainerRef.current && riskItems.length > 0) {
      // Mikro-gecikme (requestAnimationFrame) bazen DOM render hızı için gereklidir
      requestAnimationFrame(() => {
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollLeft = lastScrollLeft.current;
        }
      });
    }
  }, [riskItems]);

  // Auto-save
  const autoSave = useCallback(async () => {
    if (!assessment || saving) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("risk_assessments")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", assessment.id);
      if (error) throw error;
    } catch (error: any) {
      console.error("Auto-save error:", error);
    } finally {
      setSaving(false);
    }
  }, [assessment, saving]);

  const debouncedAutoSave = useMemo(
    () => debounce(() => autoSave(), 2000),
    [autoSave] // autoSave useCallback ile sarmalanmış olmalı
  );

  // ========================
  // FETCH FUNCTIONS
  // ========================

  const fetchCompanies = async () => {
    try {
      console.log("Fetching companies...");
      
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user?.id)
        .order("name");

      if (error) throw error;

      console.log(`Fetched ${data?.length || 0} companies`);
      setCompanies(data || []);
    } catch (error: any) {
      console.error("Fetch companies error:", error);
      toast.error("Firmalar yüklenemedi", {
        description: error.message
      });
    }
  };

  const fetchLibrary = async () => {
    try {
      console.log("Fetching risk library...");
      
      const { data, error } = await supabase
        .from("risk_library")
        .select("*")
        .eq("is_active", true)
        .order("sector, category, hazard");

      if (error) throw error;

      console.log(`Fetched ${data?.length || 0} library items`);
      setLibrary(data || []);
      
      // Risk Paketlerini Oluştur (katalog + yerleşik fallback)
      const packages = RISK_SECTOR_CATALOG.map((sectorDef) => {
        const targetCount = Math.max(sectorDef.itemCount, 40);
        const items = (data || []).filter((item) => {
          const itemSector = buildCatalogKey(item.sector || "");
          const sectorName = buildCatalogKey(sectorDef.name);
          return itemSector.includes(sectorName) || itemSector === sectorName;
        });

        const fallbackItems = generateMockRisksForSector(sectorDef.name).map((item, index) => ({
          id: `${sectorDef.code}-${index + 1}`,
          sector: sectorDef.name,
          category: item.category,
          hazard: item.hazard,
          risk: item.risk,
          typical_probability: item.probability,
          typical_frequency: item.frequency,
          typical_severity: item.severity,
          suggested_controls: item.controls,
          legal_reference: undefined,
          usage_count: 0,
          is_active: true,
        }));

        const resolvedItems: RiskLibraryItem[] =
          items.length >= targetCount
            ? (items.slice(0, targetCount) as RiskLibraryItem[])
            : [...(items as RiskLibraryItem[]), ...fallbackItems.slice(items.length, targetCount)];

        return {
          id: sectorDef.code,
          name: sectorDef.name,
          sector: sectorDef.name,
          item_count: targetCount,
          items: resolvedItems,
        };
      });

      setRiskPackages(packages);
      
    } catch (error: any) {
      console.error("Fetch library error:", error);
      toast.error("Risk kütüphanesi yüklenemedi", {
        description: error.message
      });
    }
  };

  const fetchRiskTemplates = async () => {
    if (!profile?.organization_id) {
      setRiskTemplates([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("risk_assessment_templates")
        .select("id, name, sector, method, payload, created_at")
        .eq("org_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRiskTemplates((data || []) as RiskAssessmentTemplateRecord[]);
    } catch (error: any) {
      console.error("Fetch risk templates error:", error);
      toast.error("Risk şablonları yüklenemedi", {
        description: error.message,
      });
    }
  };

  const updateAssessmentField = async (field: keyof RiskAssessment, value: unknown) => {
    if (!assessment) return;

    try {
      const { error } = await supabase
        .from("risk_assessments")
        .update({ [field]: value })
        .eq("id", assessment.id);

      if (error) throw error;
      setAssessment((prev) => (prev ? { ...prev, [field]: value } : prev));
    } catch (error: any) {
      console.error("Update assessment field error:", error);
      toast.error("Değerlendirme güncellenemedi", {
        description: error.message,
      });
    }
  };

  const saveCurrentAsTemplate = async () => {
    if (!user?.id || !profile?.organization_id) {
      toast.error("Şablon kaydetmek için organizasyon bilgisi gerekli");
      return;
    }

    if (!templateName.trim()) {
      toast.error("Şablon adı girin");
      return;
    }

    setTemplateSaving(true);
    try {
      const { error } = await supabase.from("risk_assessment_templates").insert({
        org_id: profile.organization_id,
        user_id: user.id,
        name: templateName.trim(),
        sector: assessment?.sector || selectedSectorOption?.name || null,
        method: currentAssessmentMethod,
        payload: templatePayload,
      } as any);

      if (error) throw error;

      toast.success("Şablon kaydedildi");
      setTemplateName("");
      void fetchRiskTemplates();
    } catch (error: any) {
      console.error("Save risk template error:", error);
      toast.error("Şablon kaydedilemedi", {
        description: error.message,
      });
    } finally {
      setTemplateSaving(false);
    }
  };

  const replaceAssessmentItemsFromTemplate = async (template: RiskAssessmentTemplateRecord) => {
    if (!assessment) {
      toast.error("Önce bir değerlendirme oluşturun");
      return;
    }

    const templateItems = template.payload?.items || [];
    const templateAssessment = template.payload?.assessment || {};
    const today = getTodayIsoDate();

    try {
      const { error: deleteError } = await supabase
        .from("risk_items")
        .delete()
        .eq("assessment_id", assessment.id);

      if (deleteError) throw deleteError;

      const nextItems = templateItems.map((item, index) => ({
        assessment_id: assessment.id,
        item_number: index + 1,
        department: item.department || "",
        hazard: item.hazard || "Yeni Tehlike",
        risk: item.risk || "Yeni Risk",
        affected_people: item.affected_people || "",
        existing_controls: item.existing_controls || "",
        probability_1: item.probability_1 ?? 3,
        frequency_1: item.frequency_1 ?? 3,
        severity_1: item.severity_1 ?? 3,
        score_1: item.score_1 ?? calculateRiskScore(item.probability_1 ?? 3, item.frequency_1 ?? 3, item.severity_1 ?? 3),
        risk_class_1: item.risk_class_1 ?? getRiskClass(item.score_1 ?? calculateRiskScore(item.probability_1 ?? 3, item.frequency_1 ?? 3, item.severity_1 ?? 3)),
        proposed_controls: item.proposed_controls || "",
        probability_2: item.probability_2 ?? 1,
        frequency_2: item.frequency_2 ?? 1,
        severity_2: item.severity_2 ?? 1,
        score_2: item.score_2 ?? 1,
        risk_class_2: item.risk_class_2 ?? "Kabul Edilebilir",
        responsible_person: item.responsible_person || "",
        deadline: item.deadline || today,
        status: item.status || "open",
        completion_date: item.completion_date || null,
        completed_activity: item.completed_activity || "",
        is_from_library: false,
        sort_order: index,
      }));

      const { data, error: insertError } = await supabase
        .from("risk_items")
        .insert(nextItems as any)
        .select("*")
        .order("sort_order");

      if (insertError) throw insertError;

      if (templateAssessment.method && templateAssessment.method !== assessment.method) {
        await updateAssessmentField("method", templateAssessment.method);
      }

      if (templateAssessment.sector && templateAssessment.sector !== assessment.sector) {
        await updateAssessmentField("sector", templateAssessment.sector);
      }

      setRiskItems((data || []) as RiskItem[]);
      setSelectedTemplateId(template.id);
      toast.success("Şablon uygulandı");
    } catch (error: any) {
      console.error("Apply risk template error:", error);
      toast.error("Şablon uygulanamadı", {
        description: error.message,
      });
    }
  };

  const importTemplateFile = async (file: File) => {
    if (!user?.id || !profile?.organization_id) {
      toast.error("Şablon içe aktarmak için organizasyon bilgisi gerekli");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const normalizeHeader = (value: unknown) =>
        String(value || "")
          .toLocaleLowerCase("tr-TR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

      const findRiskSheetName = () => {
        for (const candidateSheetName of workbook.SheetNames) {
          const candidateWorksheet = workbook.Sheets[candidateSheetName];
          if (!candidateWorksheet?.["!ref"]) continue;

          const candidateRange = XLSX.utils.decode_range(candidateWorksheet["!ref"]);
          const values: string[] = [];

          for (let rowIndex = candidateRange.s.r; rowIndex <= Math.min(candidateRange.e.r, 80); rowIndex += 1) {
            for (let colIndex = candidateRange.s.c; colIndex <= Math.min(candidateRange.e.c, 60); colIndex += 1) {
              const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
              const cell = candidateWorksheet[cellAddress];
              if (!cell?.v) continue;
              const normalizedValue = normalizeHeader(cell.v);
              if (normalizedValue) values.push(normalizedValue);
            }
          }

          const hasDepartment = values.some((value) => value === "faaliyet" || value.includes("faaliyet"));
          const hasHazard = values.some((value) => value === "tehlike" || value.includes("tehlike"));
          const hasRisk = values.some((value) => value === "risk" || value.includes("risk"));

          if (hasDepartment && hasHazard && hasRisk) {
            return candidateSheetName;
          }
        }

        return workbook.SheetNames[0];
      };

      const sheetName = findRiskSheetName();
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error("Excel içinde okunabilir sayfa bulunamadı.");
      }

      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      const hasHeaderToken = (cell: string, aliases: readonly string[]) =>
        aliases.some((alias) => {
          const normalizedAlias = normalizeHeader(alias);
          return cell === normalizedAlias || cell.includes(normalizedAlias);
        });

      const aliasMap = {
        department: ["faaliyet", "bolum", "bölüm", "birim", "ortam"],
        hazard: ["tehlike"],
        risk: ["risk", "riskin tanimi", "riskin tanımı"],
        existing_controls: ["mevcut durum"],
        affected_people: ["olasi sonuc", "olası sonuc", "olası sonuç", "etkilenen"],
        probability_1: ["olasilik o", "olasilik", "o1", "olasilik(o)"],
        frequency_1: ["frekans f", "frekans", "f1", "frekans(f)"],
        severity_1: ["siddet s", "siddet", "s1", "siddet(s)"],
        score_1: ["risk degeri r", "risk degeri", "risk değeri", "r1"],
        risk_class_1: ["riskin tanimi", "riskin tanımı", "risk sinifi", "risk sınıfı"],
        proposed_controls: [
          "duzeltici onleyici faaliyet",
          "düzeltici önleyici faaliyet",
          "yapilmasi gereken duzeltici onleyici faaliyet",
          "yapılması gereken düzeltici önleyici faaliyet",
          "onerilen dof",
          "önerilen döf",
          "onlemler",
          "önlemler",
          "pros",
        ],
        probability_2: ["olasilik(o) 2", "o2"],
        frequency_2: ["frekans(f) 2", "f2"],
        severity_2: ["siddet(s) 2", "s2"],
        score_2: ["risk degeri(r) 2", "risk degeri 2", "risk değeri 2", "r2"],
        risk_class_2: ["riskin tanimi 2", "risk tanimi 2", "risk sınıfı 2"],
        deadline: ["termin", "termin suresi", "termin süresi"],
        responsible_person: ["sorumlu"],
        completion_date: ["gerceklesme tarihi", "gerçeklesme tarihi", "gerçekleşme tarihi"],
        completed_activity: ["gerceklesen faaliyetler", "gerçeklesen faaliyetler", "gerçekleşen faaliyetler"],
        status: ["durum"],
      } as const;

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      const scannedCells: Array<{ row: number; col: number; value: string; raw: string }> = [];

      for (let rowIndex = range.s.r; rowIndex <= Math.min(range.e.r, 80); rowIndex += 1) {
        for (let colIndex = range.s.c; colIndex <= Math.min(range.e.c, 60); colIndex += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
          const cell = worksheet[cellAddress];
          if (!cell?.v) continue;
          const rawValue = String(cell.v || "").trim();
          const normalizedValue = normalizeHeader(cell.v);
          if (!normalizedValue) continue;
          scannedCells.push({ row: rowIndex, col: colIndex, value: normalizedValue, raw: rawValue });
        }
      }

      const findHeaderCell = (aliases: readonly string[], options?: { afterCol?: number; beforeCol?: number }) => {
        const matches = scannedCells
          .filter((cell) => {
            if (options?.afterCol !== undefined && cell.col <= options.afterCol) return false;
            if (options?.beforeCol !== undefined && cell.col >= options.beforeCol) return false;
            return hasHeaderToken(cell.value, aliases);
          })
          .map((cell) => {
            const exactScore = aliases.some((alias) => cell.value === normalizeHeader(alias)) ? 0 : 10;
            return { ...cell, score: exactScore + cell.row / 100 + cell.col / 1000 };
          })
          .sort((a, b) => a.score - b.score);

        return matches[0] || null;
      };

      const departmentHeader = findHeaderCell(aliasMap.department);
      const hazardHeader = findHeaderCell(aliasMap.hazard, { afterCol: departmentHeader?.col });
      const riskHeader = findHeaderCell(aliasMap.risk, { afterCol: hazardHeader?.col });

      if (!departmentHeader || !hazardHeader || !riskHeader) {
        throw new Error("Excel şablonunda başlık satırı bulunamadı. Tehlike, Risk ve Faaliyet sütunları gerekli.");
      }

      const detectedHeaderRow = Math.max(departmentHeader.row, hazardHeader.row, riskHeader.row);
      const headerSearchRows = new Set<number>([
        detectedHeaderRow - 2,
        detectedHeaderRow - 1,
        detectedHeaderRow,
        detectedHeaderRow + 1,
        detectedHeaderRow + 2,
      ]);
      const headerCells = scannedCells.filter((cell) => headerSearchRows.has(cell.row));
      const columnMap = Object.fromEntries(
        Object.entries(aliasMap).map(([field, aliases]) => {
          let match = headerCells.find((cell) => hasHeaderToken(cell.value, aliases));

          if (field === "department") match = departmentHeader;
          if (field === "hazard") match = hazardHeader;
          if (field === "risk") match = riskHeader;

          if (!match) {
            match = findHeaderCell(aliases);
          }

          return [field, match?.col ?? -1];
        })
      ) as Record<keyof typeof aliasMap, number>;

      if (columnMap.department === -1 || columnMap.hazard === -1 || columnMap.risk === -1) {
        throw new Error("Excel şablonunda temel sütunlar okunamadı. Faaliyet, Tehlike ve Risk alanlarını kontrol edin.");
      }

      const dataRows = rows.slice(detectedHeaderRow + 1).filter((row) =>
        row.some((cell) => String(cell || "").trim().length > 0)
      );

      const findValue = (row: (string | number | null)[], field: keyof typeof aliasMap) => {
        const headerIndex = columnMap[field];
        return headerIndex >= 0 ? row[headerIndex] : "";
      };

      const parseNumeric = (value: unknown, fallback: number) => {
        const parsedValue = Number(String(value || "").replace(",", "."));
        return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
      };

      const parseStatus = (value: unknown): RiskItemStatus => {
        const normalized = normalizeHeader(value);
        if (normalized.includes("tamam")) return "completed";
        if (normalized.includes("devam")) return "in_progress";
        return "open";
      };

      const items = dataRows.flatMap((row, index) => {
        const rawDepartment = String(findValue(row, "department")).trim();
        const rawHazard = String(findValue(row, "hazard")).trim();
        const rawRisk = String(findValue(row, "risk")).trim();

        if (!rawDepartment && !rawHazard && !rawRisk) {
          return [];
        }

        const normalizedDepartment = normalizeHeader(rawDepartment);
        const normalizedHazard = normalizeHeader(rawHazard);
        const normalizedRisk = normalizeHeader(rawRisk);
        const isRepeatedHeader =
          hasHeaderToken(normalizedDepartment, aliasMap.department) ||
          hasHeaderToken(normalizedHazard, aliasMap.hazard) ||
          normalizedRisk === "risk";

        if (isRepeatedHeader) {
          return [];
        }

        const probability1 = parseNumeric(findValue(row, "probability_1"), 3);
        const frequency1 = parseNumeric(findValue(row, "frequency_1"), 3);
        const severity1 = parseNumeric(findValue(row, "severity_1"), 3);
        const score1 = calculateRiskScore(probability1, frequency1, severity1);
        const probability2 = parseNumeric(findValue(row, "probability_2"), 1);
        const frequency2 = parseNumeric(findValue(row, "frequency_2"), 1);
        const severity2 = parseNumeric(findValue(row, "severity_2"), 1);
        const score2 = calculateRiskScore(probability2, frequency2, severity2);

        const item = {
          item_number: index + 1,
          department: rawDepartment,
          hazard: rawHazard || "Yeni tehlike",
          risk: rawRisk || "Yeni risk",
          existing_controls: String(findValue(row, "existing_controls")).trim(),
          affected_people: String(findValue(row, "affected_people")).trim(),
          probability_1: probability1,
          frequency_1: frequency1,
          severity_1: severity1,
          score_1: score1,
          risk_class_1: getRiskClass(score1),
          proposed_controls: String(findValue(row, "proposed_controls")).trim(),
          probability_2: probability2,
          frequency_2: frequency2,
          severity_2: severity2,
          score_2: score2,
          risk_class_2: getRiskClass(score2),
          responsible_person: String(findValue(row, "responsible_person")).trim(),
          deadline: String(findValue(row, "deadline")).trim() || getTodayIsoDate(),
          status: parseStatus(findValue(row, "status")),
          completion_date: String(findValue(row, "completion_date")).trim(),
          completed_activity: String(findValue(row, "completed_activity")).trim(),
        } satisfies Partial<RiskItem>;
        return [item];
      }).filter((item) => item.hazard || item.risk);

      if (items.length === 0) {
        throw new Error("Excel şablonunda içe aktarılacak risk maddesi bulunamadı.");
      }

      const parsed: RiskAssessmentTemplateRecord["payload"] = {
        assessment: {
          sector: assessment?.sector || selectedSectorOption?.name || sheetName,
          method: currentAssessmentMethod,
        },
        items,
      };
      const fallbackName = file.name.replace(/\.[^/.]+$/, "");

      const { error } = await supabase.from("risk_assessment_templates").insert({
        org_id: profile.organization_id,
        user_id: user.id,
        name: fallbackName,
        sector: parsed?.assessment?.sector || null,
        method: parsed?.assessment?.method || "fine_kinney",
        payload: parsed,
      } as any);

      if (error) throw error;

      toast.success("Excel şablonu içe aktarıldı");
      void fetchRiskTemplates();
    } catch (error: any) {
      console.error("Import risk template error:", error);
      toast.error("Excel şablonu içe aktarılamadı", {
        description: error.message,
      });
    }
  };

  const fetchAssessmentById = async (assessmentId: string) => {
    try {
      const { data, error } = await supabase.from("risk_assessments").select("*").eq("id", assessmentId).maybeSingle();
      if (error) throw error;
      if (!data) return;
      setAssessment(data as RiskAssessment);
      if (data.company_id) {
        setSelectedCompany(data.company_id);
      }
      await fetchRiskItems(data.id);
      toast.success("Risk değerlendirme editöre taşındı.", {
        description: "Sihirbazdan gelen kayıt detaylı madde yönetimi için açıldı.",
      });
    } catch (error: any) {
      console.error("Fetch assessment by id error:", error);
      toast.error("Risk değerlendirme kaydı açılamadı", { description: error.message });
    }
  };
  const fetchRiskItems = async (assessmentId: string) => {
    try {
      console.log("Fetching risk items for assessment:", assessmentId);
      
      const { data, error } = await supabase
        .from("risk_items")
        .select("*")
        .eq("assessment_id", assessmentId)
        .order("sort_order");

      if (error) throw error;

      // Gelen veriyi RiskItem tipine uygun hale getiriyoruz
      const mappedData = (data || []).map((item: any) => ({
        ...item,
        // Eğer veritabanında bu sütunlar henüz yoksa varsayılan değer atıyoruz
        probability_1: item.probability_1 ?? item.probability ?? 3,
        frequency_1: item.frequency_1 ?? item.frequency ?? 3,
        severity_1: item.severity_1 ?? item.severity ?? 3,
        score_1: item.score_1 ?? item.score ?? 27,
        risk_class_1: item.risk_class_1 ?? item.risk_class ?? "Kabul Edilebilir"
      })) as RiskItem[];

      console.log(`Fetched ${mappedData.length} risk items`);
      setRiskItems(mappedData);
      
    } catch (error: any) {
      console.error("Fetch risk items error:", error);
      toast.error("Risk maddeleri yüklenemedi");
    }
  };


    // ========================
  // AI RISK GENERATOR
  // ========================

    const generateAIRisks = async (sector: string) => {
    // Artık parametre olarak geliyor
    if (!sector || sector.trim().length < 2) {
      toast.error("Lütfen geçerli bir sektör girin");
      return;
    }

    if (!assessment) {
      toast.error("Önce bir değerlendirme oluşturun");
      return;
    }

    setAiGenerating(true);
    setAiSector(sector); // State'e kaydet
    
    toast.info("Google Gemini ile risk analizi başlatılıyor...", {
      description: `${sector} sektörü analiz ediliyor`,
      duration: 3000
    });

    try {
      const company = companies.find(c => c.id === assessment.company_id);
      const sectorLabel = selectedSectorOption?.name || sector;

      // Gerçek Gemini API çağrısı
      const geminiRisks = await generateRisksWithGemini(
        sectorLabel,
        company?.name
      );

      // Map to internal format
      const mappedRisks = geminiRisks.map((r: GeminiRiskResult, idx: number) => {
        const score = r.probability * r.frequency * r.severity;
        const riskClass = getRiskClass(score);

        return {
          id: `ai-${Date.now()}-${idx}`,
          hazard: r.hazard,
          risk: r.risk,
          category: r.category,
          probability: r.probability,
          frequency: r.frequency,
          severity: r.severity,
          score: score,
          riskClass: riskClass,
          controls: r.controls,
          selected: true
        };
      });

      const fallbackRisks = generateMockRisksForSector(selectedSectorOption?.name || sector);
      const dedupedRisks = [...mappedRisks];
      const existingKeys = new Set(dedupedRisks.map((item) => `${item.hazard}::${item.risk}`));

      for (const fallbackRisk of fallbackRisks) {
        const riskKey = `${fallbackRisk.hazard}::${fallbackRisk.risk}`;
        if (existingKeys.has(riskKey)) continue;
        dedupedRisks.push({
          ...fallbackRisk,
          id: `ai-fallback-${Date.now()}-${dedupedRisks.length}`,
        });
        existingKeys.add(riskKey);
        if (dedupedRisks.length >= 40) break;
      }

      const completedRiskSet = ensureMinimumCount(dedupedRisks.slice(0, 40), 40, (index) => {
        const fallbackRisk = fallbackRisks[index % fallbackRisks.length];
        return {
          ...fallbackRisk,
          id: `ai-fill-${Date.now()}-${index}`,
          selected: true,
        };
      });

      setAiRisks(completedRiskSet);
      setShowAiDialog(true);

      toast.success(`${completedRiskSet.length} risk maddesi oluşturuldu`, {
        description: "Sunucu tarafinda guvenli AI analizi ile olusturuldu",
        duration: 5000
      });
    } catch (error: any) {
      console.error("Gemini generation error:", error);
      
      let errorMessage = "Yapay zeka analizi başarısız";
      let errorDescription = error.message || "Bilinmeyen hata";

      if (error.message?.includes("API key")) {
        errorMessage = "AI Servis Yapilandirma Hatasi";
        errorDescription = "Sunucu tarafindaki AI secret ayarlarini kontrol edin.";
      } else if (error.message?.includes("quota")) {
        errorMessage = "Kota Aşıldı";
        errorDescription = "Günlük istek limitine ulaşıldı";
      } else if (error.message?.includes("safety")) {
        errorMessage = "Güvenlik Filtresi";
        errorDescription = "Farklı bir sektör ifadesi deneyin";
      }

      toast.error(errorMessage, {
        description: errorDescription,
        duration: 8000
      });

      const fallbackRisks = generateMockRisksForSector(selectedSectorOption?.name || sector);
      setAiRisks(fallbackRisks);
      setShowAiDialog(true);

      toast.info("Hazır risk paketi gösterildi", {
        description: "AI servisi yanıt veremediği için sektör bazlı yerleşik risk seti açıldı.",
        duration: 5000
      });
    } finally {
      setAiGenerating(false);
    }
  };
  // Mock risk generator (gerçekte OpenAI kullanacağız)
  function generateMockRisksForSector(sector: string): typeof aiRisks {
    const sectorLower = sector.toLowerCase();
    const catalogSector = RISK_SECTOR_CATALOG.find((item) => buildCatalogKey(item.name) === buildCatalogKey(sector));
    const targetCount = Math.max(catalogSector?.itemCount ?? 15, 40);
    
    // Sektöre özel risk templates
    const templates: Record<string, Array<{
      hazard: string;
      risk: string;
      category: string;
      o: number;
      f: number;
      s: number;
      controls: string[];
    }>> = {
      'otomotiv': [
        {
          hazard: "Forklift ve Yaya Etkileşimi",
          risk: "Forkliftin fabrika içinde hızlı kullanılması, kör noktalar ve yaya yollarının belirsizliği.",
          category: "Araç Güvenliği",
          o: 6, f: 6, s: 7,
          controls: ["Çarpışma, ezilme, uzuv kayıpları, ölüm", "Kalıcı işitme kaybı, stres, iletişim kazaları"]
        },
        {
          hazard: "Manuel Taşıma",
          risk: "Üretim hattında sürekli olarak 25kg üzeri malzemelerin elle taşınması.",
          category: "Ergonomi",
          o: 10, f: 10, s: 3,
          controls: ["Bel fıtığı, kas-iskelet sistemi hastalıkları", "Transpalet, vinç veya miknatıslı kaldırıcılar kullanılmalı"]
        },
        {
          hazard: "Üretim Makineleri",
          risk: "Presler, kompresörler ve motorların 85 dB(A) üzerinde gürültü yapması.",
          category: "Fiziksel Etkenler",
          o: 10, f: 10, s: 7,
          controls: ["Kalıcı işitme kaybı, stres, iletişim kazaları", "Kulaklık veya kulak tıkacı zorunlu, gürültü seviyesi ölçümleri"]
        },
        {
          hazard: "Yağ ve Su Sızıntıları",
          risk: "Makinelerden sızan yağların zemini kayganlaştırması.",
          category: "İş Sağlığı",
          o: 6, f: 6, s: 15,
          controls: ["Kayma, düşme, kırık, ezilme", "Düzenli temizlik, absorbent matlar, kaymaz ayakkabı"]
        },
        {
          hazard: "KKD Kullanımı",
          risk: "Çalışanların iş ayakkabısı, gözlük veya baret kullanmaması.",
          category: "Kişisel Koruyucu Donanım",
          o: 6, f: 10, s: 15,
          controls: ["Ayak ezilmesi, göz kayıtı, kafa travması", "KKE kullanımı zorunlu, eğitim ve denetim"]
        },
        {
          hazard: "Arızalı Alet Kullanımı",
          risk: "Çekiç saplarının gevşek, anahtar ağızlarının bozuk olması.",
          category: "El Aletleri",
          o: 3, f: 6, s: 7,
          controls: ["El ve parmak yaralanmaları", "Aylık kontrol, arızalı aletlerin imhası"]
        },
        {
          hazard: "Elektrik Panoları",
          risk: "Açık elektrik panolarına yetkisiz erişim.",
          category: "Elektrik",
          o: 1, f: 0.5, s: 100,
          controls: ["Elektrik çarpması, yanık, ölüm", "Panoların kilitli tutulması, yetkilendirme sistemi"]
        },
        {
          hazard: "Kaynak İşleri",
          risk: "Kapalı alanlarda kaynak dumanı solunması, UV ışınlarına maruziyet.",
          category: "Kimyasal/Fiziksel",
          o: 6, f: 6, s: 15,
          controls: ["Solunum yolu hastalıkları, cilt kanseri, göz yanıkları", "Havalandırma, FFP3 maske, kaynak gözlüğü/baretli"]
        },
        {
          hazard: "Yangın",
          risk: "Boya kabininde veya yağ deposunda yangın çıkma riski.",
          category: "Yangın",
          o: 1, f: 0.5, s: 40,
          controls: ["Maddi hasar, yaralanma, ölüm", "Yangın algılama sistemi, sprinkler, personel eğitimi"]
        },
        {
          hazard: "Kimyasal Maruziyeti",
          risk: "Solvent, tiner, boya gibi kimyasalların güvenlik bilgi formu olmadan kullanılması.",
          category: "Kimyasal",
          o: 6, f: 10, s: 7,
          controls: ["Zehirlenme, solunum problemleri, cilt tahrişi", "GBF sağlanmalı, havalandırma, eldiven ve maske"]
        }
      ],
      'inşaat': [
        {
          hazard: "Yüksekten Düşme",
          risk: "İskelelerde ve çatı kenarlarında korkuluk olmaması.",
          category: "Düşme",
          o: 6, f: 6, s: 100,
          controls: ["Ölüm, ağır yaralanma, felç", "Korkuluk, güvenlik ağı, emniyet kemeri kullanımı"]
        },
        {
          hazard: "Vinç Operasyonu",
          risk: "Vinç operatörünün yetkisiz veya eğitimsiz olması.",
          category: "Makine",
          o: 3, f: 6, s: 40,
          controls: ["Malzeme düşmesi, ezilme, ölüm", "Operatör sertifikası, periyodik bakım"]
        },
        {
          hazard: "Elektrik Hattı",
          risk: "Şantiyede açık elektrik kablolarının bulunması.",
          category: "Elektrik",
          o: 3, f: 3, s: 100,
          controls: ["Elektrik çarpması, ölüm", "Kabloların yalıtımı, RCD kullanımı"]
        },
        {
          hazard: "Göçük",
          risk: "Kazı çalışmalarında şev açısının yanlış hesaplanması.",
          category: "Yapısal",
          o: 1, f: 0.5, s: 100,
          controls: ["Gömülme, ölüm", "Şev hesabı, destek sistemi, kontrollü kazı"]
        },
        {
          hazard: "Toz Maruziyeti",
          risk: "Kesme ve delme işlerinde silika tozu solunması.",
          category: "Sağlık",
          o: 10, f: 10, s: 15,
          controls: ["Silikoz, akciğer hastalıkları", "Sulama, FFP3 maske, havalandırma"]
        }
      ],
      'gıda': [
        {
          hazard: "Kaygan Zemin",
          risk: "Üretim alanında su, yağ ve gıda artıklarının birikmesi.",
          category: "Kayma/Düşme",
          o: 10, f: 10, s: 7,
          controls: ["Düşme, kırık, bel yaralanması", "Sürekli temizlik, kaymaz zemin, iş ayakkabısı"]
        },
        {
          hazard: "Kesici Aletler",
          risk: "Et işleme bıçaklarının korumasız kullanılması.",
          category: "Kesme",
          o: 6, f: 10, s: 7,
          controls: ["Kesik, uzuv kaybı", "Cut Level 5 eldiven, koruyucu çelik mesh önlük"]
        },
        {
          hazard: "Sıcak Yüzeyler",
          risk: "Fırın, kazanlar ve buhar hatlarına temas.",
          category: "Yanık",
          o: 6, f: 6, s: 15,
          controls: ["Yanık, haşlanma", "Isıya dayanıklı eldiven, yalıtım, uyarı levhaları"]
        },
        {
          hazard: "Soğuk Hava Deposu",
          risk: "-25°C soğuk hava deposunda uzun süre çalışma.",
          category: "Termal",
          o: 6, f: 6, s: 7,
          controls: ["Hipotermi, donma", "Termal giysi, çalışma süre kısıtlaması, ısınma molası"]
        },
        {
          hazard: "Mikrobiyolojik",
          risk: "Hijyen kurallarına uyulmaması, çapraz kontaminasyon.",
          category: "Biyolojik",
          o: 6, f: 10, s: 3,
          controls: ["Gıda zehirlenmesi, hastalık yayılması", "El yıkama, sterilizasyon, HACCP uygulaması"]
        }
      ],
      'metal': [
        {
          hazard: "Taşlama ve Çapak Sıçraması",
          risk: "Metal işleme alanında koruyucusuz taşlama yapılması ve sıcak çapakların yayılması.",
          category: "Mekanik",
          o: 6, f: 6, s: 15,
          controls: ["Göz yaralanmaları, yanık, yüz travmaları", "Yüz siperi, gözlük ve kıvılcım perdesi kullanılmalı"]
        },
        {
          hazard: "Kaynak Dumanı",
          risk: "Kaynak yapılan alanlarda yetersiz havalandırma nedeniyle duman ve gaz maruziyeti oluşması.",
          category: "Kimyasal/Fiziksel",
          o: 6, f: 10, s: 7,
          controls: ["Solunum yolu irritasyonu, kronik maruziyet", "Lokal emiş sistemi, maske ve alan havalandırması"]
        }
      ],
      'tekstil': [
        {
          hazard: "Hareketli Makine Aksamı",
          risk: "Dikiş ve dokuma makinelerinde koruyucusuz kayış, kasnak ve iğne bölgelerine temas.",
          category: "Makine",
          o: 6, f: 6, s: 7,
          controls: ["El-parmak yaralanmaları, sıkışma", "Makine koruyucuları ve LOTO prosedürü uygulanmalı"]
        },
        {
          hazard: "Pamuk ve Elyaf Tozu",
          risk: "Üretim hattında biriken elyaf tozunun solunması ve havada asılı kalması.",
          category: "Toz Maruziyeti",
          o: 10, f: 6, s: 7,
          controls: ["Solunum yolu irritasyonu, astım", "Toz emiş sistemi ve düzenli temizlik planı uygulanmalı"]
        }
      ],
      'kimya': [
        {
          hazard: "Kimyasal Sıçrama",
          risk: "Transfer ve dolum sırasında kimyasalların çalışan cildine ve gözüne temas etmesi.",
          category: "Kimyasal",
          o: 6, f: 6, s: 15,
          controls: ["Yanık, tahriş, görme kaybı", "Siperlik, kimyasal göz duşu ve uygun eldiven kullanılmalı"]
        },
        {
          hazard: "Reaktif Maddenin Karışması",
          risk: "Uygunsuz depolama nedeniyle birbirine uyumsuz kimyasalların yan yana bulundurulması.",
          category: "Proses Güvenliği",
          o: 3, f: 3, s: 40,
          controls: ["Yangın, patlama, toksik gaz çıkışı", "Kimyasal uyumluluk matrisi ve ayrı depolama uygulanmalı"]
        }
      ],
      'lojistik': [
        {
          hazard: "Yüksek İstif",
          risk: "Depo raflarında dengesiz veya kapasite üstü istifleme yapılması.",
          category: "İstifleme",
          o: 6, f: 6, s: 15,
          controls: ["Malzeme düşmesi, ezilme", "Raf etiketleri, yük limitleri ve periyodik kontrol uygulanmalı"]
        },
        {
          hazard: "Sevkiyat Alanı Trafiği",
          risk: "Yaya yolları ile araç yollarının ayrışmaması nedeniyle çarpışma riski oluşması.",
          category: "Araç Güvenliği",
          o: 6, f: 10, s: 15,
          controls: ["Çarpışma, ezilme, ölüm", "Yaya bariyerleri, hız limiti ve saha yönlendirmesi yapılmalı"]
        }
      ],
      'saglik': [
        {
          hazard: "Kesici-Delici Alet Yaralanması",
          risk: "Enjektör ve bistüri gibi aletlerin uygunsuz toplanması nedeniyle yaralanma oluşması.",
          category: "Biyolojik",
          o: 6, f: 6, s: 15,
          controls: ["Enfeksiyon, kan yoluyla bulaş", "Kesici-delici kutuları ve eğitim uygulanmalı"]
        },
        {
          hazard: "Hasta Transferi",
          risk: "Yetersiz ekipmanla hasta kaldırma ve taşıma yapılması.",
          category: "Ergonomi",
          o: 10, f: 6, s: 7,
          controls: ["Bel-boyun yaralanmaları", "Transfer ekipmanları ve iki kişi kuralı uygulanmalı"]
        }
      ],
      'ofis': [
        {
          hazard: "Uzun Süre Ekranlı Çalışma",
          risk: "Monitör, sandalye ve masa düzeninin ergonomik olmaması.",
          category: "Ergonomi",
          o: 10, f: 10, s: 3,
          controls: ["Boyun-sırt ağrısı, göz yorgunluğu", "Ergonomik ekipman ve mola planı uygulanmalı"]
        },
        {
          hazard: "Elektrik Priz Yüklemesi",
          risk: "Çoklu prizlere yüksek yük bağlanması ve kablo karmaşası oluşması.",
          category: "Elektrik",
          o: 3, f: 3, s: 15,
          controls: ["Yangın, elektrik çarpması", "Yetkili tesisat kontrolü ve kablo düzeni sağlanmalı"]
        }
      ],
      'tarim': [
        {
          hazard: "Tarım Makinesi Kullanımı",
          risk: "Koruyucusuz PTO ve döner ekipmanlarla çalışılması.",
          category: "Makine",
          o: 6, f: 6, s: 40,
          controls: ["Uzuv kaptırma, ezilme", "Koruyucu muhafaza ve yetkili operatör uygulaması"]
        },
        {
          hazard: "Pestisit Uygulaması",
          risk: "İlaçlama sırasında uygun maske ve kıyafet olmadan çalışma yapılması.",
          category: "Kimyasal",
          o: 6, f: 6, s: 15,
          controls: ["Zehirlenme, cilt ve solunum maruziyeti", "Kimyasal KKD ve rüzgar yönü kontrolü uygulanmalı"]
        }
      ],
      'turizm': [
        {
          hazard: "Mutfak Sıcak Yüzeyleri",
          risk: "Yoğun mutfak akışında kızgın yağ ve sıcak ekipmana temas edilmesi.",
          category: "Yanık",
          o: 6, f: 6, s: 15,
          controls: ["Yanık ve haşlanma", "Isıya dayanıklı eldiven ve servis akış planı uygulanmalı"]
        },
        {
          hazard: "Islak Zemin",
          risk: "Otel ve restoran alanlarında hızlı temizlik sonrası zeminin kaygan kalması.",
          category: "Kayma/Düşme",
          o: 10, f: 6, s: 7,
          controls: ["Kayma, düşme ve kırık", "Uyarı levhası ve hızlı kurutma prosedürü uygulanmalı"]
        }
      ],
      'perakende': [
        {
          hazard: "Raflardan Ürün Düşmesi",
          risk: "Aşırı yükleme ve uygunsuz raf düzeni nedeniyle ürünlerin düşmesi.",
          category: "İstifleme",
          o: 6, f: 6, s: 7,
          controls: ["Baş ve omuz yaralanmaları", "Raf limitleri ve güvenli yerleşim uygulanmalı"]
        },
        {
          hazard: "Kasa Alanı Ergonomisi",
          risk: "Tekrarlı hareket ve ayakta uzun süre çalışma nedeniyle kas-iskelet zorlanması.",
          category: "Ergonomi",
          o: 10, f: 10, s: 3,
          controls: ["Boyun, bilek ve bel ağrıları", "Mola planı ve ergonomik çalışma düzeni oluşturulmalı"]
        }
      ],
      'ahsap': [
        {
          hazard: "Ahşap Tozu",
          risk: "Kesim ve zımpara işlemleri sırasında yoğun ahşap tozuna maruz kalınması.",
          category: "Toz Maruziyeti",
          o: 10, f: 6, s: 7,
          controls: ["Solunum yolu hastalıkları, yangın yükü", "Toz emiş sistemi ve FFP2 maske uygulanmalı"]
        },
        {
          hazard: "Dairesel Testere",
          risk: "Geri tepme ve koruyucu devre dışı kullanım nedeniyle ciddi yaralanma riski oluşması.",
          category: "Makine",
          o: 3, f: 6, s: 40,
          controls: ["Kesilme, uzuv kaybı", "Testere koruyucusu ve itme aparatları kullanılmalı"]
        }
      ],
      'plastik': [
        {
          hazard: "Enjeksiyon Kalıp Değişimi",
          risk: "Kalıp sökme-takma sırasında sıkışma ve sıcak yüzeye temas oluşması.",
          category: "Makine",
          o: 6, f: 6, s: 15,
          controls: ["Ezilme, yanık", "LOTO ve kalıp değişim prosedürü uygulanmalı"]
        },
        {
          hazard: "Granül Dökülmesi",
          risk: "Hammadde granüllerinin zemine dökülmesiyle kayganlık ve düşme riski oluşması.",
          category: "Kayma/Düşme",
          o: 10, f: 6, s: 7,
          controls: ["Kayma ve düşme", "Düzenli süpürme ve alan bariyeri uygulanmalı"]
        }
      ],
      'laboratuvar': [
        {
          hazard: "Cam Malzeme Kırılması",
          risk: "Numune işlemleri sırasında cam kapların kırılması ve kesik oluşması.",
          category: "Kesici/Delici",
          o: 6, f: 3, s: 7,
          controls: ["Kesik ve kontaminasyon", "Dayanıklı ekipman ve kırık cam kutusu kullanılmalı"]
        },
        {
          hazard: "Biyolojik Numune Maruziyeti",
          risk: "Numune açma ve aktarma sırasında aerosole maruz kalınması.",
          category: "Biyolojik",
          o: 3, f: 3, s: 40,
          controls: ["Enfeksiyon, kontaminasyon", "Biyogüvenlik kabini ve uygun KKD kullanılmalı"]
        }
      ],
      'atik': [
        {
          hazard: "Kesici Atık Teması",
          risk: "Ayrıştırma hattında kesici atıkların uygunsuz ayrılması nedeniyle yaralanma oluşması.",
          category: "Atık Yönetimi",
          o: 6, f: 6, s: 15,
          controls: ["Kesik, enfeksiyon", "Kalın eldiven ve kaynakta doğru ayrıştırma uygulanmalı"]
        },
        {
          hazard: "Biyolojik Atık Sızıntısı",
          risk: "Sızdıran atık torbaları nedeniyle biyolojik maruziyet oluşması.",
          category: "Biyolojik",
          o: 3, f: 3, s: 40,
          controls: ["Enfeksiyon, kötü koku, yayılım", "Sızdırmaz kap ve taşıma prosedürü uygulanmalı"]
        }
      ],
      'guvenlik': [
        {
          hazard: "Gece Devriyesi",
          risk: "Yetersiz aydınlatma ve tek başına devriye nedeniyle saldırı veya düşme riski oluşması.",
          category: "Operasyon",
          o: 6, f: 3, s: 15,
          controls: ["Yaralanma, travma", "Panik butonu, iletişim cihazı ve aydınlatma kontrolü uygulanmalı"]
        },
        {
          hazard: "Fiziksel Müdahale",
          risk: "Çatışmalı durumlarda eğitimsiz fiziksel müdahale yapılması.",
          category: "Davranışsal",
          o: 3, f: 3, s: 40,
          controls: ["Darp, ciddi yaralanma", "Müdahale eğitimi ve destek prosedürü uygulanmalı"]
        }
      ],
      'temizlik': [
        {
          hazard: "Kimyasal Karışım",
          risk: "Farklı temizlik kimyasallarının birbirine karıştırılması sonucu toksik gaz çıkması.",
          category: "Kimyasal",
          o: 3, f: 3, s: 40,
          controls: ["Zehirlenme, solunum yolu hasarı", "Etiketleme, eğitim ve ayrı kimyasal depolama uygulanmalı"]
        },
        {
          hazard: "Islak Yüzeyde Çalışma",
          risk: "Temizlik sonrası zeminde uyarı işareti olmadan çalışma sürmesi.",
          category: "Kayma/Düşme",
          o: 10, f: 10, s: 7,
          controls: ["Düşme, kırık, burkulma", "Islak zemin levhası ve çalışma alanı izolasyonu uygulanmalı"]
        }
      ],
      'cagri merkezi': [
        {
          hazard: "Uzun Süre Headset Kullanımı",
          risk: "Yüksek ses ve sürekli çağrı nedeniyle işitme ve stres yükü oluşması.",
          category: "Ergonomi/Psikososyal",
          o: 10, f: 10, s: 3,
          controls: ["Baş ağrısı, işitme yorgunluğu, stres", "Ses limiti, mola planı ve kaliteli headset sağlanmalı"]
        },
        {
          hazard: "Psikososyal Yük",
          risk: "Yoğun çağrı, performans baskısı ve vardiyalı çalışma nedeniyle tükenmişlik gelişmesi.",
          category: "Psikososyal",
          o: 10, f: 6, s: 7,
          controls: ["Stres, tükenmişlik, hata artışı", "Mola planı, vardiya dengelemesi ve destek hattı uygulanmalı"]
        }
      ]
    };

    const normalizedSector = normalizeSectorKey(sectorLower);
    const sectorSpecificRisks = templates[normalizedSector] || templates[sectorLower] || templates["otomotiv"];
    const baseRisks = [...sectorSpecificRisks, ...COMMON_TEMPLATE_RISKS];
    const risks = Array.from({ length: targetCount }, (_, index) => {
      const template = baseRisks[index % baseRisks.length];
      return {
        ...template,
        hazard: `${template.hazard}${index >= baseRisks.length ? ` ${index + 1}` : ""}`,
      };
    });

    const normalizedRisks = ensureMinimumCount(risks, targetCount, (index) => {
      const commonTemplate = COMMON_TEMPLATE_RISKS[index % COMMON_TEMPLATE_RISKS.length];
      return {
        ...commonTemplate,
        hazard: `${commonTemplate.hazard} #${index + 1}`,
        risk: `${commonTemplate.risk} (${sector})`,
      };
    });

    return normalizedRisks.map((r, idx) => {
      const score = r.o * r.f * r.s;
      const riskClass = getRiskClass(score);

      return {
        id: `ai-${Date.now()}-${idx}`,
        hazard: r.hazard,
        risk: r.risk,
        category: r.category,
        probability: r.o,
        frequency: r.f,
        severity: r.s,
        score: score,
        riskClass: riskClass,
        controls: r.controls,
        selected: true // Default: tümü seçili
      };
    });
  }

  const addSelectedAIRisks = async () => {
    if (!assessment) {
        toast.error("Önce bir değerlendirme oluşturun");
        return;
    }

    const selectedRisks = aiRisks.filter(r => r.selected);

    if (selectedRisks.length === 0) {
        toast.error("Lütfen en az bir risk seçin");
        return;
    }

    setLoading(true);
    toast.info(`${selectedRisks.length} risk tabloya ekleniyor...`);

    try {
        const today = getTodayIsoDate();
        const newItems: Partial<RiskItem>[] = selectedRisks.map((r, idx) => ({
        assessment_id: assessment.id,
        item_number: riskItems.length + idx + 1,
        department: r.category,
        hazard: r.hazard,
        risk: r.risk,
        affected_people: "",
        existing_controls: "",
        probability_1: r.probability,
        frequency_1: r.frequency,
        severity_1: r.severity,
        score_1: r.score,
        risk_class_1: r.riskClass,
        proposed_controls: r.controls.join('; '),
        probability_2: 1,
        frequency_2: 1,
        severity_2: 1,
        score_2: 1,
        risk_class_2: "Kabul Edilebilir",
        responsible_person: "",
        deadline: today,
        is_from_library: false,
        status: 'open',
        completed_activity: "",
        sort_order: riskItems.length + idx
        }));

        const { data, error } = await supabase
        .from("risk_items")
        .insert(newItems as any) // as any to bypass partial type check
        .select();

        if (error) throw error;

        if (data && data.length > 0) {
        // Map Supabase response to RiskItem type
        const mappedItems: RiskItem[] = data.map((item: any) => ({
            ...item,
            // Ensure all required fields exist
            probability_1: item.probability_1 || item.probability || 3,
            frequency_1: item.frequency_1 || item.frequency || 3,
            severity_1: item.severity_1 || item.severity || 3,
            score_1: item.score_1 || item.score || 27,
            risk_class_1: item.risk_class_1 || item.risk_class || "Olası",
            probability_2: item.probability_2 || 1,
            frequency_2: item.frequency_2 || 1,
            severity_2: item.severity_2 || 1,
            score_2: item.score_2 || 1,
            risk_class_2: item.risk_class_2 || "Kabul Edilebilir"
        }));

        setRiskItems(prev => [...prev, ...mappedItems]);
        setShowAiDialog(false);
        setAiRisks([]);
        setAiSector("");

        toast.success(`${mappedItems.length} risk başarıyla eklendi`, {
            description: "AI tarafından oluşturulan riskler tabloda",
            duration: 5000
        });
        }
    } catch (error: any) {
        console.error("Add AI risks error:", error);
        toast.error("Ekleme hatası", {
        description: error.message
        });
    } finally {
        setLoading(false);
    }
    };

  const toggleAIRiskSelection = (id: string) => {
    setAiRisks(prev => prev.map(r => 
      r.id === id ? { ...r, selected: !r.selected } : r
    ));
  };

  const selectAllAIRisks = () => {
    setAiRisks(prev => prev.map(r => ({ ...r, selected: true })));
  };

  const deselectAllAIRisks = () => {
    setAiRisks(prev => prev.map(r => ({ ...r, selected: false })));
  };

    // ========================
  // FULL SCREEN TOGGLE
  // ========================

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullScreen(true);
        toast.success("Tam ekran modu aktif", {
          description: "F11 veya ESC ile çıkabilirsiniz"
        });
      }).catch((err) => {
        console.error("Fullscreen error:", err);
        toast.error("Tam ekran açılamadı");
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullScreen(false);
          toast.info("Tam ekran kapatıldı");
        });
      }
    }
  };

  // Listen for fullscreen changes (ESC key)
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  // ========================
  // ASSESSMENT FUNCTIONS
  // ========================

  const createAssessment = async () => {
    if (!selectedCompany) {
      toast.error("Lütfen firma seçin");
      return;
    }

    setLoading(true);
    toast.info("Yeni değerlendirme oluşturuluyor...");

    try {
      const company = companies.find(c => c.id === selectedCompany);
      
      const assessorDisplayName =
        profile?.full_name?.trim() ||
        user?.user_metadata?.full_name?.trim() ||
        user?.user_metadata?.name?.trim() ||
        user?.email ||
        "";

      const { data, error } = await supabase
        .from("risk_assessments")
        .insert({
          user_id: user?.id,
          company_id: selectedCompany,
          assessment_name: `Risk Değerlendirmesi - ${company?.name || "Firma"} - ${format(new Date(), 'dd.MM.yyyy', { locale: tr })}`,
          assessment_date: new Date().toISOString().split('T')[0],
          method: "fine_kinney",
          status: 'draft',
          assessor_name: assessorDisplayName,
          occupational_safety_specialist_name: assessorDisplayName,
          next_review_date: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        console.log("Assessment created:", data.id);
        setAssessment(data as RiskAssessment);
        setRiskItems([]);
        
        toast.success("Yeni değerlendirme oluşturuldu", {
          description: `Form No: ${data.id.substring(0, 8).toUpperCase()}`,
          duration: 5000
        });
      }
    } catch (error: any) {
      console.error("Create assessment error:", error);
      toast.error("Oluşturma hatası", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // ========================
  // RISK ITEM FUNCTIONS
  // ========================

  const addFromPackage = async (packageId: string) => {
    if (!assessment) {
      toast.error("Önce bir değerlendirme oluşturun");
      return;
    }

    const pkg = riskPackages.find(p => p.id === packageId);
    if (!pkg) return;

    setLoading(true);
    toast.info(`${pkg.name} paketi ekleniyor... (${pkg.item_count} madde)`);

    try {
      const today = getTodayIsoDate();
      const newItems: Partial<RiskItem>[] = pkg.items.map((item, idx) => ({
        assessment_id: assessment.id,
        item_number: riskItems.length + idx + 1,
        department: pkg.name,
        hazard: item.hazard,
        risk: item.risk,
        affected_people: "",
        existing_controls: "",
        probability_1: item.typical_probability,
        frequency_1: item.typical_frequency,
        severity_1: item.typical_severity,
        score_1: calculateRiskScore(item.typical_probability, item.typical_frequency, item.typical_severity),
        risk_class_1: getRiskClass(calculateRiskScore(item.typical_probability, item.typical_frequency, item.typical_severity)),
        proposed_controls: item.suggested_controls.join('; '),
        probability_2: 0.5,
        frequency_2: 1,
        severity_2: 1,
        score_2: 0.5,
        risk_class_2: "Kabul Edilebilir",
        responsible_person: "",
        deadline: today,
        is_from_library: true,
        library_category: item.category || item.sector,
        status: 'open',
        completed_activity: "",
        sort_order: riskItems.length + idx
      }));

      const { data, error } = await supabase
        .from("risk_items")
        .insert(newItems as any)
        .select();

      if (error) throw error;

     if (data) {
        // Toplu eklemede gelen verileri RiskItem tipine dönüştür
        const newItems = (data as any[]).map(item => ({
        ...item,
        probability_1: item.probability_1 ?? 3,
        frequency_1: item.frequency_1 ?? 3,
        severity_1: item.severity_1 ?? 3,
        score_1: item.score_1 ?? 27,
        risk_class_1: item.risk_class_1 ?? "Kabul Edilebilir"
        })) as RiskItem[];

        setRiskItems(prev => [...prev, ...newItems]);
        
        toast.success(`${pkg.name} paketi eklendi`, {
        description: `${data.length} risk maddesi tabloya eklendi`,
        duration: 5000
        });
    }
    } catch (error: any) {
      console.error("Add package error:", error);
      toast.error("Paket ekleme hatası", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const addEmptyRisk = async () => {
    if (!assessment) {
      toast.error("Önce bir değerlendirme oluşturun");
      return;
    }

    try {
      const today = getTodayIsoDate();
      const newItem: Partial<RiskItem> = {
        assessment_id: assessment.id,
        item_number: riskItems.length + 1,
        department: "",
        hazard: "Yeni tehlike",
        risk: "Risk tanımı",
        affected_people: "",
        existing_controls: "",
        probability_1: 3,
        frequency_1: 3,
        severity_1: 3,
        score_1: 27,
        risk_class_1: "Olası",
        probability_2: 1,
        frequency_2: 1,
        severity_2: 1,
        score_2: 1,
        risk_class_2: "Kabul Edilebilir",
        responsible_person: "",
        deadline: today,
        status: 'open',
        completed_activity: "",
        is_from_library: false,
        sort_order: riskItems.length
      };

      const { data, error } = await supabase
        .from("risk_items")
        .insert(newItem as any)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Tekil veriyi önce unknown sonra RiskItem yaparak 'overlap' hatasını geçiyoruz
        const newItem = {
        ...(data as any),
        probability_1: (data as any).probability_1 ?? 3,
        frequency_1: (data as any).frequency_1 ?? 3,
        severity_1: (data as any).severity_1 ?? 3,
        score_1: (data as any).score_1 ?? 27,
        risk_class_1: (data as any).risk_class_1 ?? "Kabul Edilebilir"
        } as RiskItem;

        setRiskItems(prev => [...prev, newItem]);
        toast.success("Boş risk eklendi");
    }
    } catch (error: any) {
      console.error("Add risk error:", error);
      toast.error("Ekleme hatası", {
        description: error.message
      });
    }
  };

  const updateRiskItem = async (
    itemId: string,
    field: keyof RiskItem,
    value: any,
    stage?: 1 | 2 // Hangi aşama güncellenecek
  ) => {
    try {
      const item = riskItems.find(i => i.id === itemId);
      if (!item) return;

      let updateData: any = { [field]: value };

      // 1. AŞAMA Fine-Kinney güncellemesi
      if (stage === 1 && (field === 'probability_1' || field === 'frequency_1' || field === 'severity_1')) {
        const newProb = field === 'probability_1' ? value : item.probability_1;
        const newFreq = field === 'frequency_1' ? value : item.frequency_1;
        const newSev = field === 'severity_1' ? value : item.severity_1;
        
        const newScore = calculateRiskScore(newProb, newFreq, newSev);
        const newClass = getRiskClass(newScore);
        
        updateData = {
          ...updateData,
          score_1: newScore,
          risk_class_1: newClass
        };
      }

      // 2. AŞAMA Fine-Kinney güncellemesi
      if (stage === 2 && (field === 'probability_2' || field === 'frequency_2' || field === 'severity_2')) {
        const newProb = field === 'probability_2' ? value : (item.probability_2 || 1);
        const newFreq = field === 'frequency_2' ? value : (item.frequency_2 || 1);
        const newSev = field === 'severity_2' ? value : (item.severity_2 || 1);
        
        const newScore = calculateRiskScore(newProb, newFreq, newSev);
        const newClass = getRiskClass(newScore);
        
        updateData = {
          ...updateData,
          score_2: newScore,
          risk_class_2: newClass
        };
      }

      const { error } = await supabase
        .from("risk_items")
        .update(updateData)
        .eq("id", itemId);

      if (error) throw error;

      // Update local state
      setRiskItems(prev =>
        prev.map(i => i.id === itemId ? { ...i, ...updateData } : i)
      );

    } catch (error: any) {
      console.error("Update error:", error);
      toast.error("Güncelleme hatası", {
        description: error.message
      });
    }
  };

  const deleteRiskItem = async (itemId: string) => {
    if (!confirm("Bu riski silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("risk_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setRiskItems(prev => prev.filter(item => item.id !== itemId));
      toast.success("Risk silindi");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Silme hatası", {
        description: error.message
      });
    }
  };

  // ========================
  // EDIT FUNCTIONS
  // ========================

  const startEdit = (itemId: string, field: keyof RiskItem, currentValue: any) => {
    setEditingCell({ itemId, field });
    setEditValue(currentValue || "");
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    await updateRiskItem(editingCell.itemId, editingCell.field, editValue);
    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const loadImageAsDataUrl = async (url?: string | null) => {
    if (!url) return null;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn("Logo yüklenemedi:", error);
      return null;
    }
  };

  const uploadRiskItemPhoto = async (itemId: string, file: File) => {
    if (!user?.id || !assessment?.id) {
      toast.error("Fotoğraf yüklemek için oturum ve değerlendirme bilgisi gerekli");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen geçerli bir görsel seçin");
      return;
    }

    setPhotoUploadingItemId(itemId);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const storagePath = `${user.id}/${assessment.id}/${itemId}-${Date.now()}.${fileExt.toLowerCase()}`;

      const { error: uploadError } = await supabase.storage
        .from("risk-item-photos")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("risk-item-photos").getPublicUrl(storagePath);
      await updateRiskItem(itemId, "photo_url", data.publicUrl);
      toast.success("Risk maddesi fotoğrafı yüklendi");
    } catch (error: any) {
      console.error("Risk photo upload error:", error);
      toast.error("Fotoğraf yüklenemedi", {
        description: error.message,
      });
    } finally {
      setPhotoUploadingItemId(null);
      const input = riskPhotoInputRefs.current[itemId];
      if (input) input.value = "";
    }
  };

  const removeRiskItemPhoto = async (itemId: string, photoUrl?: string | null) => {
    try {
      if (photoUrl?.includes("/risk-item-photos/")) {
        const storagePath = photoUrl.split("/risk-item-photos/")[1];
        if (storagePath) {
          await supabase.storage.from("risk-item-photos").remove([storagePath]);
        }
      }

      await updateRiskItem(itemId, "photo_url", null);
      toast.success("Risk maddesi fotoğrafı kaldırıldı");
    } catch (error: any) {
      console.error("Risk photo remove error:", error);
      toast.error("Fotoğraf kaldırılamadı", {
        description: error.message,
      });
    }
  };

  const AIRiskPanel = ({ isAssessmentActive, aiGenerating, onGenerate }: AIRiskPanelProps) => {
    return (
      <Card className="border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.22),transparent_58%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] shadow-[0_22px_55px_rgba(88,28,135,0.28)]">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-fuchsia-200/75">AI Risk Asistanı</p>
              <h3 className="mt-2 text-lg font-bold text-foreground">Sektöre özel yeni risk üret</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Gemini destekli önerilerle sektörünüze uygun risk maddelerini, önlemleri ve başlangıç skorlarını hazır hale getirin.
              </p>
            </div>
            <Badge className="border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100">
              {aiGenerating ? "Analiz" : "Hazır"}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Model</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {selectedSectorOption ? `${selectedSectorOption.name} Paketi` : "Gemini 2.5 Flash"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Kapsam</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {selectedSectorOption ? `${selectedSectorRiskPreview.length} hazır risk + önlem` : "Risk + Önlem + Skor"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Durum</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {selectedSectorOption
                  ? `${selectedSectorDistribution.critical} kritik · ${selectedSectorDistribution.high} yüksek`
                  : isAssessmentActive
                    ? "Değerlendirme aktif"
                    : "Önce oturum başlatın"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sektör</Label>
            <Select value={aiSector} onValueChange={setAiSector}>
              <SelectTrigger className="h-12 rounded-2xl border-cyan-400/20 bg-gradient-to-r from-slate-950/90 via-slate-900 to-slate-950/90 text-slate-100 shadow-[0_12px_28px_rgba(15,23,42,0.28)]">
                {selectedSectorOption && selectedSectorMeta ? (
                  <div className="flex min-w-0 items-center gap-3 pr-6">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br ${selectedSectorMeta.accent}`}>
                      <span aria-hidden="true">{selectedSectorOption.icon}</span>
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-100">{selectedSectorOption.name}</span>
                        <Badge variant="outline" className="border-cyan-400/20 bg-cyan-500/10 px-2 py-0 text-[10px] text-cyan-200">
                          Aktif sektör
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{selectedSectorMeta.hint}</p>
                    </div>
                  </div>
                ) : (
                  <SelectValue placeholder="Sektör seçiniz..." />
                )}
              </SelectTrigger>
              <SelectContent
                position="popper"
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="border border-cyan-400/15 bg-slate-950/95 text-slate-100 backdrop-blur-xl"
              >
                {RISK_SECTORS.map((sector) => {
                  const meta = SECTOR_UI_META[normalizeSectorKey(sector.name)] ?? {
                    accent: "from-slate-500/20 to-slate-700/10",
                    hint: "Sektöre özel risk paketi ve önerilen önlemler",
                  };

                  return (
                  <SelectItem
                    key={sector.id}
                    value={sector.id}
                    className="rounded-xl px-3 py-3 text-slate-100 focus:bg-white/[0.08] focus:text-foreground"
                  >
                    <div className="flex min-w-[220px] max-w-full items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br ${meta.accent} text-base`}>
                        <span aria-hidden="true">{sector.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-100">{sector.id} · {sector.name}</p>
                        <p className="text-xs text-muted-foreground">{meta.hint}</p>
                      </div>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[10px] text-cyan-200">
                        {sector.itemCount} Madde
                      </Badge>
                    </div>
                  </SelectItem>
                )})}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/5 p-3 text-xs text-foreground">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
              <div>
                <p className="font-semibold text-slate-100">
                  {selectedSectorOption ? `${selectedSectorOption.name} için akıllı üretim notu` : "Akıllı üretim notu"}
                </p>
                <p className="mt-1 leading-5">
                  {selectedSectorOption
                    ? `${selectedSectorOption.name} sektörüne özel risk havuzu; kategori, olasılık, frekans, şiddet ve önerilen önlemlerle birlikte hazırlanır. Yapay zeka yanıt vermezse bile yerleşik sektör paketiyle üretim devam eder.`
                    : "Oluşturulan riskler sektöre göre kategori, olasılık, frekans, şiddet ve önerilen önlemlerle birlikte gelir. Seçtiğiniz maddeleri tabloya tek seferde ekleyebilirsiniz."}
                </p>
              </div>
            </div>
          </div>

          {selectedSectorOption ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-red-400/15 bg-red-500/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-red-200/70">Kritik Risk</p>
                <p className="mt-2 text-lg font-black text-foreground">{selectedSectorDistribution.critical}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Anında aksiyon gerektiren başlıklar</p>
              </div>
              <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">Yüksek Risk</p>
                <p className="mt-2 text-lg font-black text-foreground">{selectedSectorDistribution.high}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Kontrol planı gerektiren başlıklar</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/70">Risk Havuzu</p>
                <p className="mt-2 text-lg font-black text-foreground">{selectedSectorRiskPreview.length}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Seçili sektör için hazır öneri havuzu</p>
              </div>
            </div>
          ) : null}

          <Button
            onClick={() => onGenerate(aiSector)}
            disabled={!isAssessmentActive || aiGenerating}
            className="h-11 w-full gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 text-foreground shadow-[0_18px_40px_rgba(168,85,247,0.28)] hover:from-fuchsia-400 hover:via-violet-400 hover:to-indigo-400"
          >
            {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiGenerating ? "AI riskleri üretiyor..." : "AI ile risk üret"}
          </Button>
        </CardContent>
      </Card>
    );
  };

    // ========================
  // HELP DIALOG COMPONENT
  // ========================

  const HelpDialog = () => {
    return (
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto border border-white/10 bg-slate-950/95 shadow-[0_30px_80px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_14px_30px_rgba(99,102,241,0.3)]">
                <BookOpen className="h-5 w-5 text-foreground" />
              </div>
              Risk Analiz Editörü • Kullanım Kılavuzu
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              İki aşamalı Fine-Kinney yaklaşımıyla profesyonel risk değerlendirmesi.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basics" className="mt-4">
            <TabsList className="grid w-full grid-cols-4 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              <TabsTrigger value="basics" className="rounded-xl data-[state=active]:bg-indigo-500 data-[state=active]:text-foreground">Temel Bilgiler</TabsTrigger>
              <TabsTrigger value="scoring" className="rounded-xl data-[state=active]:bg-indigo-500 data-[state=active]:text-foreground">Skorlama</TabsTrigger>
              <TabsTrigger value="shortcuts" className="rounded-xl data-[state=active]:bg-indigo-500 data-[state=active]:text-foreground">Kısayollar</TabsTrigger>
              <TabsTrigger value="tips" className="rounded-xl data-[state=active]:bg-indigo-500 data-[state=active]:text-foreground">İpuçları</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="mt-4 space-y-4">
              <Card className="border border-white/10 bg-white/[0.04]"><CardContent className="space-y-3 p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100"><MousePointer className="h-5 w-5 text-indigo-400" />1. Başlangıç</h3>
                <ul className="space-y-2 text-sm text-foreground">
                  <li className="flex items-start gap-2"><Badge className="shrink-0 bg-indigo-600">1</Badge><span>Üst bölümden <strong>firma seçin</strong> ve <strong>Yeni Değerlendirme Başlat</strong> ile oturumu açın.</span></li>
                  <li className="flex items-start gap-2"><Badge className="shrink-0 bg-indigo-600">2</Badge><span><strong>Sol panelden</strong> sektörünüze uygun risk paketini seçin veya AI ile yeni risk üretin.</span></li>
                  <li className="flex items-start gap-2"><Badge className="shrink-0 bg-indigo-600">3</Badge><span>Paket yanındaki <strong>+</strong> butonuyla tüm maddeleri tabloya ekleyin.</span></li>
                  <li className="flex items-start gap-2"><Badge className="shrink-0 bg-indigo-600">4</Badge><span>İsterseniz <strong>Manuel Risk Ekle</strong> ile boş satır açıp değerlendirmeyi kendiniz ilerletin.</span></li>
                </ul>
              </CardContent></Card>

              <Card className="border border-white/10 bg-white/[0.04]"><CardContent className="space-y-3 p-4">
                <h3 className="text-lg font-semibold text-slate-100">Tabloda Düzenleme</h3>
                <ul className="space-y-2 text-sm text-foreground">
                  <li className="flex items-start gap-2"><span className="text-indigo-400">→</span><span><strong>Tehlike, Risk ve Önlemler</strong> alanlarına doğrudan tıklayarak düzenleme yapabilirsiniz.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400">→</span><span><strong>Enter</strong> ile kaydedin, <strong>ESC</strong> ile düzenlemeyi iptal edin.</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-400">→</span><span><strong>O, F, Ş</strong> seçimlerinden değer girin; skorlar otomatik hesaplanır.</span></li>
                </ul>
              </CardContent></Card>

              <Card className="border border-white/10 bg-white/[0.04]"><CardContent className="space-y-3 p-4">
                <h3 className="text-lg font-semibold text-slate-100">Dışa Aktarma</h3>
                <ul className="space-y-2 text-sm text-foreground">
                  <li className="flex items-start gap-2"><Download className="mt-0.5 h-4 w-4 shrink-0 text-green-400" /><span><strong>PDF İndir:</strong> profesyonel rapor formatında (landscape, A4).</span></li>
                  <li className="flex items-start gap-2"><Download className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" /><span><strong>Excel:</strong> Microsoft Excel üzerinde düzenlenebilir format.</span></li>
                </ul>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="scoring" className="mt-4 space-y-4">
              <Card className="border border-white/10 bg-white/[0.04]"><CardContent className="space-y-4 p-4">
                <h3 className="text-lg font-semibold text-slate-100">Fine-Kinney Formülü</h3>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="mb-2 text-center font-mono text-xl text-indigo-300">R = O × F × Ş</p>
                  <p className="text-center text-sm text-muted-foreground">Risk skoru = Olasılık × Frekans × Şiddet</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-red-300">1. Aşama (Mevcut Durum)</h4>
                    <p className="text-xs text-muted-foreground">Hiçbir önlem alınmadan, mevcut durumda riskin büyüklüğü.</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between rounded-xl bg-slate-950/70 p-2"><span>O (Olasılık)</span><span className="text-foreground">0.2 - 10</span></div>
                      <div className="flex justify-between rounded-xl bg-slate-950/70 p-2"><span>F (Frekans)</span><span className="text-foreground">0.5 - 10</span></div>
                      <div className="flex justify-between rounded-xl bg-slate-950/70 p-2"><span>Ş (Şiddet)</span><span className="text-foreground">1 - 100</span></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-green-300">2. Aşama (Kalıntı Risk)</h4>
                    <p className="text-xs text-muted-foreground">Önlemler alındıktan sonra kalan risk. Hedef kabul edilebilir seviyedir.</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between rounded-xl bg-slate-950/70 p-2"><span>Hedef</span><span className="text-green-300">R &lt; 20</span></div>
                      <div className="flex justify-between rounded-xl bg-slate-950/70 p-2"><span>İdeal</span><span className="text-green-300">R &lt; 10</span></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <h4 className="font-semibold text-slate-100">Risk Sınıfları</h4>
                  <div className="flex items-center justify-between rounded border border-red-600 bg-red-600/20 p-2"><span className="text-sm font-semibold text-red-300">Çok Yüksek (Esaslı)</span><Badge className="bg-red-600 text-foreground">R &gt; 400</Badge></div>
                  <div className="flex items-center justify-between rounded border border-orange-600 bg-orange-600/20 p-2"><span className="text-sm font-semibold text-orange-300">Yüksek (Tolerans)</span><Badge className="bg-orange-600 text-foreground">200 ≤ R ≤ 400</Badge></div>
                  <div className="flex items-center justify-between rounded border border-yellow-600 bg-yellow-600/20 p-2"><span className="text-sm font-semibold text-yellow-300">Önemli (Olası)</span><Badge className="bg-yellow-600 text-foreground">70 ≤ R &lt; 200</Badge></div>
                  <div className="flex items-center justify-between rounded border border-blue-600 bg-blue-600/20 p-2"><span className="text-sm font-semibold text-blue-300">Olası</span><Badge className="bg-blue-600 text-foreground">20 ≤ R &lt; 70</Badge></div>
                  <div className="flex items-center justify-between rounded border border-green-600 bg-green-600/20 p-2"><span className="text-sm font-semibold text-green-300">Kabul Edilebilir</span><Badge className="bg-green-600 text-foreground">R &lt; 20</Badge></div>
                </div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="shortcuts" className="mt-4 space-y-4">
              <Card className="border border-white/10 bg-white/[0.04]"><CardContent className="p-4">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100"><Keyboard className="h-5 w-5 text-indigo-400" />Klavye Kısayolları</h3>
                <div className="space-y-2">
                  {[
                    { keys: "Enter", desc: "Düzenlemeyi kaydet" },
                    { keys: "Escape", desc: "Düzenlemeyi iptal et / tam ekrandan çık" },
                    { keys: "F11", desc: "Tarayıcı tam ekran modu" },
                    { keys: "Tab", desc: "Sonraki alana geç" },
                    { keys: "Shift + Tab", desc: "Önceki alana geç" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-950/70 p-3">
                      <kbd className="rounded border border-slate-600 bg-slate-800 px-3 py-1 font-mono text-sm">{item.keys}</kbd>
                      <span className="text-sm text-foreground">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>

              <Card className="border border-white/10 bg-white/[0.04]"><CardContent className="p-4">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">Fare İşlemleri</h3>
                <div className="space-y-2 text-sm text-foreground">
                  <p>Hücreye tek tıklama → düzenleme modu</p>
                  <p>Risk paketine tıklama → detayları göster</p>
                  <p>+ butonu → paketi tabloya ekle</p>
                  <p>Çöp kutusu → riski sil</p>
                </div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="tips" className="mt-4 space-y-4">
              <Card className="border border-white/10 bg-white/[0.04]"><CardContent className="p-4">
                <div className="space-y-4">
                  <div className="mb-4 flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-400" /><h3 className="text-lg font-semibold text-slate-100">Profesyonel İpuçları</h3></div>
                  <div className="rounded-lg border border-green-700 bg-green-900/30 p-3"><p className="mb-1 text-sm font-semibold text-green-300">Etkili Önlemler Yazın</p><p className="text-xs text-muted-foreground">Önlemler spesifik ve uygulanabilir olmalı. Örnek: “KKE kullanılmalı” yerine “Cut Level 5 eldiven ve koruyucu gözlük kullanılmalı”.</p></div>
                  <div className="rounded-lg border border-blue-700 bg-blue-900/30 p-3"><p className="mb-1 text-sm font-semibold text-blue-300">Kalıntı Riski Düşürün</p><p className="text-xs text-muted-foreground">2. aşamada risk skorunu 20'nin altına indirmeyi hedefleyin. Bu kabul edilebilir seviyedir.</p></div>
                  <div className="rounded-lg border border-red-700 bg-red-900/30 p-3"><p className="mb-1 text-sm font-semibold text-red-300">Kritik Riskler Öncelikli</p><p className="text-xs text-muted-foreground">Kırmızı ve turuncu riskler (R &gt; 200) acil eylem gerektirir. Bu kayıtları öncelikli olarak ele alın.</p></div>
                </div>
              </CardContent></Card>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowHelp(false)} className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400">
              Anladım, başlayalım
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };
  // ========================
  // AI RESULTS DIALOG
  // ========================

  const AIResultsDialog = () => {
    const categoryOptions = Array.from(new Set(aiRisks.map((r) => r.category))).sort();
    const filteredRisks = aiCategoryFilter === "all" ? aiRisks : aiRisks.filter((r) => r.category === aiCategoryFilter);
    const selectedCount = aiRisks.filter((r) => r.selected).length;
    const aiRiskSummary = {
      critical: aiRisks.filter((r) => r.riskClass === "Çok Yüksek").length,
      high: aiRisks.filter((r) => r.riskClass === "Yüksek").length,
      notable: aiRisks.filter((r) => r.riskClass === "Önemli" || r.riskClass === "Olası").length,
    };

    return (
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden border border-fuchsia-400/20 bg-slate-950/95 p-0 shadow-[0_30px_80px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <DialogHeader className="shrink-0 border-b border-white/10 px-6 pb-4 pt-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-100">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-500 shadow-[0_18px_35px_rgba(168,85,247,0.28)]">
                <Sparkles className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <span>AI Tarafından Üretilen Riskler · {aiSector}</span>
                <p className="mt-1 text-sm font-normal text-muted-foreground">{aiRisks.length} risk maddesi • {selectedCount} seçili</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-5">
          <div className="shrink-0 flex flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAllAIRisks} className="gap-2 border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Tümünü Seç
              </Button>
              <Button size="sm" variant="outline" onClick={deselectAllAIRisks} className="gap-2 border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]">
                <X className="h-4 w-4 text-red-400" />
                Seçimi Temizle
              </Button>
            </div>
            <Badge className="border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100">{selectedCount} / {aiRisks.length} seçili</Badge>
          </div>

          <div className="grid shrink-0 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-red-200/75">Kritik Risk</p>
              <p className="mt-2 text-2xl font-black text-foreground">{aiRiskSummary.critical}</p>
              <p className="mt-1 text-xs text-red-100/70">Acil değerlendirme gerektiren maddeler</p>
            </div>
            <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-orange-200/75">Yüksek Risk</p>
              <p className="mt-2 text-2xl font-black text-foreground">{aiRiskSummary.high}</p>
              <p className="mt-1 text-xs text-orange-100/70">Önlem planı öncelikli maddeler</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/75">İzleme Havuzu</p>
              <p className="mt-2 text-2xl font-black text-foreground">{aiRiskSummary.notable}</p>
              <p className="mt-1 text-xs text-cyan-100/70">Kontrolle kabul edilebilir seviyeye indirilebilecek maddeler</p>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Kategori Filtreleri</p>
                <p className="mt-1 text-xs text-muted-foreground">İlgili risk grubuna odaklanmak için filtreleyin.</p>
              </div>
              <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground">
                {filteredRisks.length} görünür kayıt
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={aiCategoryFilter === "all" ? "default" : "outline"}
                onClick={() => setAiCategoryFilter("all")}
                className={aiCategoryFilter === "all" ? "bg-fuchsia-500 text-foreground hover:bg-fuchsia-400" : "border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Tümü
                <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
                  {aiRisks.length}
                </span>
              </Button>
              {categoryOptions.map((category) => (
                <Button
                  key={category}
                  size="sm"
                  variant={aiCategoryFilter === category ? "default" : "outline"}
                  onClick={() => setAiCategoryFilter(category)}
                  className={aiCategoryFilter === category ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"}
                >
                  <Library className="mr-1 h-3.5 w-3.5" />
                  {category}
                  <span className="ml-1 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px]">
                    {aiRisks.filter((risk) => risk.category === category).length}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          </div>

          <ScrollArea className="mt-4 min-h-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/40 pr-2">
            <div className="space-y-3 p-4 pr-5">
              {filteredRisks.map((risk) => (
                <div
                  key={risk.id}
                  onClick={() => toggleAIRiskSelection(risk.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${risk.selected ? "border-fuchsia-400/30 bg-fuchsia-500/10 shadow-[0_18px_35px_rgba(168,85,247,0.14)]" : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${risk.selected ? "border-fuchsia-500 bg-fuchsia-500" : "border-slate-600"}`}>
                        {risk.selected && <Check className="h-3 w-3 text-foreground" />}
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge variant="outline" className="mb-2 border-fuchsia-400/20 text-fuchsia-200 text-xs">{risk.category}</Badge>
                          <h4 className="text-sm font-semibold text-slate-100">{risk.hazard}</h4>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{risk.risk}</p>
                        </div>
                        <Badge className={`${getRiskClassColor(risk.riskClass)} shrink-0`}>{risk.score}</Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground">O: {risk.probability}</Badge>
                        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground">F: {risk.frequency}</Badge>
                        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground">Ş: {risk.severity}</Badge>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Önerilen Önlemler</p>
                        <ul className="space-y-1.5">
                          {risk.controls.map((control, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-foreground">
                              <span className="text-fuchsia-300">→</span>
                              <span>{control}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-4 flex shrink-0 flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setShowAiDialog(false)} className="border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]">
              İptal
            </Button>

            <Button onClick={addSelectedAIRisks} disabled={selectedCount === 0} className="gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 hover:from-fuchsia-400 hover:via-violet-400 hover:to-indigo-400">
              <Plus className="h-4 w-4" />
              {selectedCount} maddeyi tabloya ekle
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };
  // ========================
  // LEFT PANEL COMPONENT
  // ========================

  const RiskLibraryPanel = () => {
    const filteredPackages = riskPackages.filter((pkg) => {
      const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!selectedSectorOption) return matchesSearch;

      const normalizedPackageSector = buildCatalogKey(pkg.sector || "");
      const matchesSector =
        normalizedPackageSector === buildCatalogKey(selectedSectorOption.name) ||
        buildCatalogKey(pkg.name).includes(buildCatalogKey(selectedSectorOption.name));

      return matchesSearch && matchesSector;
    });

    return (
      <div className="flex h-auto flex-col border-b border-white/10 bg-slate-950/65 backdrop-blur-xl lg:h-full lg:border-b-0 lg:border-r">
        <div className="border-b border-white/10 p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Library className="h-5 w-5 text-cyan-300" />
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-100">Risk Kütüphanesi</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Hazır sektör paketleri ve AI önerileriyle tabloyu hızlıca doldurun.
              </p>
            </div>
            <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">{filteredPackages.length} paket</Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Risk paketi ara..."
              className="h-10 rounded-xl border-white/10 bg-slate-950/70 pl-9 text-slate-100 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="border-b border-white/10 p-4">
          <AIRiskPanel
            isAssessmentActive={!!assessment}
            aiGenerating={aiGenerating}
            onGenerate={generateAIRisks}
          />
        </div>

        <ScrollArea className="max-h-[32rem] lg:flex-1 lg:max-h-none">
          <div className="space-y-2 p-3">
            {filteredPackages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center">
                <Library className="mx-auto mb-3 h-12 w-12 text-slate-600" />
                <p className="text-sm font-semibold text-foreground">
                  {searchQuery ? "Sonuç bulunamadı" : "Henüz risk paketi görünmüyor"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {searchQuery ? "Arama terimini değiştirerek daha fazla paket görüntüleyebilirsiniz." : "Kütüphane yüklendiğinde sektör bazlı paketler burada listelenir."}
                </p>
              </div>
            ) : (
              filteredPackages.map((pkg, index) => (
                <Collapsible key={pkg.id}>
                  <CollapsibleTrigger asChild>
                    <div
                      className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border p-3 transition-all ${selectedPackage === pkg.id ? "border-cyan-400/30 bg-cyan-400/10 shadow-[0_12px_25px_rgba(34,211,238,0.12)]" : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"}`}
                      onClick={() => setSelectedPackage(pkg.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/80 text-xs font-black text-slate-100">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-100">{pkg.id} · {pkg.name}</p>
                          <p className="text-xs text-muted-foreground">{pkg.item_count} risk maddesi</p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-xl text-cyan-300 hover:bg-cyan-500/15"
                        onClick={(e) => {
                          e.stopPropagation();
                          addFromPackage(pkg.id);
                        }}
                        disabled={!assessment}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-2">
                    <div className="space-y-2 pl-12 pr-1">
                      {pkg.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                          <p className="line-clamp-2 text-xs text-foreground">{item.hazard}</p>
                        </div>
                      ))}
                      {pkg.items.length > 3 && (
                        <p className="py-1 text-center text-xs text-muted-foreground">+{pkg.items.length - 3} madde daha</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-white/10 bg-slate-950/85 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-foreground">
            <p>• Seçilen sektöre uygun riskler listelenir.</p>
            <p className="mt-1">• İSG mevzuatına uyumlu başlangıç kurgusu sunar.</p>
          </div>
        </div>
      </div>
    );
  };

  const RiskAnalysisTable = () => {
    if (riskItems.length === 0) {
      return (
        <div className="flex h-96 items-center justify-center">
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-8 py-10 text-center shadow-[0_20px_45px_rgba(15,23,42,0.28)]">
            <FileText className="mx-auto mb-4 h-20 w-20 text-slate-600" />
            <p className="mb-2 text-lg font-semibold text-foreground">
              Henüz risk eklenmedi
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Sol panelden risk paketi seçin veya manuel risk ekleyin.
            </p>
            <Button
              onClick={addEmptyRisk}
              className="gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-400 hover:via-violet-400 hover:to-fuchsia-400"
            >
              <Plus className="h-4 w-4" />
              Manuel Risk Ekle
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full overflow-x-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.98))] shadow-[0_30px_80px_rgba(15,23,42,0.4)]">
        <table className="w-full border-collapse text-sm" style={{ minWidth: '2000px' }}>
          {/* TABLE HEADER */}
          <thead className="sticky top-0 z-10">
            {/* Ana Başlık Satırı */}
            <tr className="bg-[linear-gradient(90deg,rgba(2,6,23,0.98),rgba(15,23,42,0.98),rgba(30,41,59,0.96))] shadow-[inset_0_-1px_0_rgba(255,255,255,0.07)]">
              {showOrderColumn ? (
                <th rowSpan={2} className="sticky left-0 z-20 w-16 border border-slate-700/80 bg-slate-950 px-2 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Risk Sıra No</div>
                </th>
              ) : null}
              <th rowSpan={2} className="min-w-[152px] border border-slate-700/80 px-2 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Faaliyet</div>
              </th>
              <th rowSpan={2} className="min-w-[112px] border border-slate-700/80 px-2 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Foto</div>
              </th>
              <th rowSpan={2} className="min-w-[280px] border border-slate-700/80 px-2 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Tehlike</div>
              </th>
              <th rowSpan={2} className="min-w-[300px] border border-slate-700/80 px-2 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Risk</div>
              </th>
              <th rowSpan={2} className="min-w-[220px] border border-slate-700/80 px-2 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Mevcut Durum</div>
              </th>
              <th rowSpan={2} className="min-w-[152px] border border-slate-700/80 px-2 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Olası Sonuç</div>
              </th>
                
              <th colSpan={5} className="border border-slate-700/80 bg-red-500/10 px-2 py-3">
                <div className="text-sm font-black tracking-[0.16em] text-red-200">RİSKİN DEĞERLENDİRİLMESİ</div>
              </th>

              {showProposedControlsColumn ? (
                <th rowSpan={2} className="min-w-[320px] border border-slate-700/80 bg-cyan-500/10 px-2 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Yapılması Gereken Düzeltici / Önleyici Faaliyet</div>
                </th>
              ) : null}

              <th colSpan={5} className="border border-slate-700/80 bg-emerald-500/10 px-2 py-3">
                <div className="text-sm font-black tracking-[0.16em] text-emerald-200">Düzeltici-Önleyici Faaliyet Gerçekleşmesi Durumunda Riskin Değerlendirilmesi</div>
              </th>

              <th colSpan={showStatusColumns ? 4 : 2} className="border border-slate-700/80 px-2 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Düzeltici / Önleyici Faaliyet Saha Aksiyon Planı</div>
              </th>
              <th rowSpan={2} className="w-20 border border-slate-700/80 px-2 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">İşlem</div>
              </th>
            </tr>

            <tr className="bg-slate-900/95">
              <th className="w-16 border border-slate-700/80 bg-red-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-red-300">O</div>
              </th>
              <th className="w-16 border border-slate-700/80 bg-red-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-red-300">F</div>
              </th>
              <th className="w-16 border border-slate-700/80 bg-red-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-red-300">Ş</div>
              </th>
              <th className="w-20 border border-slate-700/80 bg-red-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-red-300">Skor</div>
              </th>
              <th className="min-w-[100px] border border-slate-700/80 bg-red-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-red-300">Sınıf</div>
              </th>

              <th className="w-16 border border-slate-700/80 bg-emerald-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-300">O</div>
              </th>
              <th className="w-16 border border-slate-700/80 bg-emerald-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-300">F</div>
              </th>
              <th className="w-16 border border-slate-700/80 bg-emerald-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-300">Ş</div>
              </th>
              <th className="w-20 border border-slate-700/80 bg-emerald-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-300">Skor</div>
              </th>
              <th className="min-w-[100px] border border-slate-700/80 bg-emerald-500/5 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-300">Sınıf</div>
              </th>
              <th className="min-w-[132px] border border-slate-700/80 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Termin Süresi</div>
              </th>
              <th className="min-w-[160px] border border-slate-700/80 p-2">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Sorumlu</div>
              </th>
              {showStatusColumns ? (
                <>
                  <th className="min-w-[132px] border border-slate-700/80 p-2">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Gerçekleşme Tarihi</div>
                  </th>
                  <th className="min-w-[220px] border border-slate-700/80 p-2">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Gerçekleşen Faaliyetler</div>
                  </th>
                </>
              ) : null}
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody>
            {riskItems.map((item, idx) => (
              <tr
                key={item.id}
                className="border-b border-slate-800/70 transition-colors odd:bg-white/[0.015] even:bg-slate-950/35 hover:bg-white/[0.06]"
              >
                {/* NO */}
                {showOrderColumn ? (
                  <td className="sticky left-0 z-10 border border-slate-800/80 bg-slate-950 px-2 py-3 text-center">
                    <Badge variant="outline" className="border-slate-600 bg-slate-900/80 font-mono text-foreground">
                      {String(idx + 1).padStart(2, '0')}
                    </Badge>
                  </td>
                ) : null}

                {/* BÖLÜM/ORTAM */}
                <td className="border border-slate-800/80 px-2 py-3">
                  {editingCell?.itemId === item.id && editingCell.field === 'department' ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-9 rounded-xl border-white/10 bg-slate-950/80 text-xs text-slate-100 placeholder:text-muted-foreground"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEdit(item.id, 'department', item.department)}
                      className="min-h-[40px] cursor-pointer rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <p className="text-xs text-foreground">
                        {item.department || "—"}
                      </p>
                    </div>
                  )}
                </td>

                {/* FOTO */}
                <td className="border border-slate-800/80 px-2 py-3">
                  <div className="flex flex-col items-center gap-2">
                    <input
                      ref={(element) => {
                        riskPhotoInputRefs.current[item.id] = element;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void uploadRiskItemPhoto(item.id, file);
                        }
                      }}
                    />

                    {item.photo_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoUrl(item.photo_url || null)}
                        className="group relative h-16 w-16 overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/80 transition hover:border-cyan-300/40"
                      >
                        <img
                          src={item.photo_url}
                          alt={`Risk ${idx + 1} fotoğrafı`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/0 transition group-hover:bg-slate-950/20" />
                      </button>
                    ) : (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => riskPhotoInputRefs.current[item.id]?.click()}
                        disabled={photoUploadingItemId === item.id}
                        className="h-16 w-16 rounded-2xl border-dashed border-white/10 bg-white/[0.03] hover:border-indigo-400 hover:bg-indigo-500/10"
                      >
                        {photoUploadingItemId === item.id ? (
                          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
                        ) : (
                          <Camera className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                    )}

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => riskPhotoInputRefs.current[item.id]?.click()}
                        disabled={photoUploadingItemId === item.id}
                        className="h-7 rounded-full px-2 text-[10px] text-foreground hover:bg-white/10"
                      >
                        {item.photo_url ? "Değiştir" : "Yükle"}
                      </Button>
                      {item.photo_url && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void removeRiskItemPhoto(item.id, item.photo_url)}
                          className="h-7 rounded-full px-2 text-[10px] text-rose-300 hover:bg-rose-500/10"
                        >
                          Kaldır
                        </Button>
                      )}
                    </div>
                  </div>
                </td>

                {/* TEHLİKE */}
                <td className="border border-slate-800/80 px-2 py-3">
                  {editingCell?.itemId === item.id && editingCell.field === 'hazard' ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-2">
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-h-[84px] rounded-2xl border-white/10 bg-slate-950/80 text-xs text-slate-100 placeholder:text-muted-foreground resize-none"
                        autoFocus
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEdit(item.id, 'hazard', item.hazard)}
                      className="min-h-[72px] cursor-pointer rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <p className="text-xs text-foreground whitespace-pre-wrap">
                        {item.hazard}
                      </p>
                    </div>
                  )}
                </td>

                {/* RİSK */}
                <td className="border border-slate-800/80 px-2 py-3">
                  {editingCell?.itemId === item.id && editingCell.field === 'risk' ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-2">
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-h-[84px] rounded-2xl border-white/10 bg-slate-950/80 text-xs text-slate-100 placeholder:text-muted-foreground resize-none"
                        autoFocus
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEdit(item.id, 'risk', item.risk)}
                      className="min-h-[72px] cursor-pointer rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <p className="text-xs text-foreground whitespace-pre-wrap">
                        {item.risk}
                      </p>
                    </div>
                  )}
                </td>

                {/* MEVCUT DURUM */}
                <td className="border border-slate-800/80 px-2 py-3">
                  {editingCell?.itemId === item.id && editingCell.field === 'existing_controls' ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-2">
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-h-[84px] rounded-2xl border-white/10 bg-slate-950/80 text-xs text-slate-100 placeholder:text-muted-foreground resize-none"
                        autoFocus
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEdit(item.id, 'existing_controls', item.existing_controls)}
                      className="min-h-[72px] cursor-pointer rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <p className="text-xs text-foreground whitespace-pre-wrap">
                        {item.existing_controls || "—"}
                      </p>
                    </div>
                  )}
                </td>

                {/* ETKİLENEN */}
                <td className="border border-slate-800/80 px-2 py-3">
                  {editingCell?.itemId === item.id && editingCell.field === 'affected_people' ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-9 rounded-xl border-white/10 bg-slate-950/80 text-xs text-slate-100 placeholder:text-muted-foreground"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEdit(item.id, 'affected_people', item.affected_people)}
                      className="min-h-[40px] cursor-pointer rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <p className="text-xs text-foreground">
                        {item.affected_people || "—"}
                      </p>
                    </div>
                  )}
                </td>

                {/* 1. AŞAMA - O */}
                <td className="border border-slate-800/80 bg-red-900/10 p-2 text-center">
                  <Select
                    value={item.probability_1.toString()}
                    onValueChange={(value) => updateRiskItem(item.id, 'probability_1', parseFloat(value), 1)}
                  >
                    <SelectTrigger className="h-9 w-[72px] rounded-xl border-red-400/15 bg-slate-950/80 text-xs font-semibold text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                        position="popper" 
                        onCloseAutoFocus={(e) => e.preventDefault()} // Bu davranış gerekli.
                    >
                      {FINE_KINNEY_SCALES.probability.map(scale => (
                        <SelectItem key={scale.value} value={scale.value.toString()}>
                          {scale.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                {/* 1. AŞAMA - F */}
                <td className="border border-slate-800/80 bg-red-900/10 p-2 text-center">
                  <Select
                    value={item.frequency_1.toString()}
                    onValueChange={(value) => updateRiskItem(item.id, 'frequency_1', parseFloat(value), 1)}
                  >
                    <SelectTrigger className="h-9 w-[72px] rounded-xl border-red-400/15 bg-slate-950/80 text-xs font-semibold text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                        position="popper" 
                        onCloseAutoFocus={(e) => e.preventDefault()} // Bu davranış gerekli.
                    >                        
                      {FINE_KINNEY_SCALES.frequency.map(scale => (
                        <SelectItem key={scale.value} value={scale.value.toString()}>
                          {scale.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                {/* 1. AŞAMA - Ş */}
                <td className="border border-slate-800/80 bg-red-900/10 p-2 text-center">
                  <Select
                    value={item.severity_1.toString()}
                    onValueChange={(value) => updateRiskItem(item.id, 'severity_1', parseFloat(value), 1)}
                  >
                    <SelectTrigger className="h-9 w-[72px] rounded-xl border-red-400/15 bg-slate-950/80 text-xs font-semibold text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                    position="popper" 
                    onCloseAutoFocus={(e) => e.preventDefault()} // Bu davranış gerekli.
                    >
                      {FINE_KINNEY_SCALES.severity.map(scale => (
                        <SelectItem key={scale.value} value={scale.value.toString()}>
                          {scale.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                {/* 1. AŞAMA - Skor */}
                <td className="border border-slate-800/80 bg-red-900/10 p-2 text-center">
                  <Badge className="bg-red-600 text-foreground font-mono font-bold text-xs">
                    {item.score_1}
                  </Badge>
                </td>

                {/* 1. AŞAMA - Sınıf */}
                <td className="border border-slate-800/80 bg-red-900/10 p-2 text-center">
                  <Badge className={`${getRiskClassColor(item.risk_class_1)} font-semibold text-xs`}>
                    {getRiskClassLabel(item.risk_class_1)}
                  </Badge>
                </td>

                {/* YAPILMASI GEREKEN DÜZELTİCİ / ÖNLEYİCİ FAALİYET */}
                {showProposedControlsColumn ? (
                <td className="border border-slate-800/80 bg-cyan-900/10 px-2 py-3">
                  {editingCell?.itemId === item.id && editingCell.field === 'proposed_controls' ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-2">
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-h-[84px] rounded-2xl border-white/10 bg-slate-950/80 text-xs text-slate-100 placeholder:text-muted-foreground resize-none"
                        autoFocus
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEdit(item.id, 'proposed_controls', item.proposed_controls)}
                      className="min-h-[72px] cursor-pointer rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <p className="text-xs text-foreground whitespace-pre-wrap">
                        {item.proposed_controls || "—"}
                      </p>
                    </div>
                  )}
                </td>
                ) : null}

                {/* 2. AŞAMA - O */}
                <td className="border border-slate-800/80 bg-green-900/10 p-2 text-center">
                  <Select
                    value={(item.probability_2 || 1).toString()}
                    onValueChange={(value) => updateRiskItem(item.id, 'probability_2', parseFloat(value), 2)}
                  >
                    <SelectTrigger className="h-9 w-[72px] rounded-xl border-emerald-400/15 bg-slate-950/80 text-xs font-semibold text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                        position="popper" 
                        onCloseAutoFocus={(e) => e.preventDefault()} // Bu davranış gerekli.
                        >
                      {FINE_KINNEY_SCALES.probability.map(scale => (
                        <SelectItem key={scale.value} value={scale.value.toString()}>
                          {scale.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                {/* 2. AŞAMA - F */}
                <td className="border border-slate-800/80 bg-green-900/10 p-2 text-center">
                  <Select
                    value={(item.frequency_2 || 1).toString()}
                    onValueChange={(value) => updateRiskItem(item.id, 'frequency_2', parseFloat(value), 2)}
                  >
                    <SelectTrigger className="h-9 w-[72px] rounded-xl border-emerald-400/15 bg-slate-950/80 text-xs font-semibold text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                    position="popper" 
                    onCloseAutoFocus={(e) => e.preventDefault()} // Bu davranış gerekli.
                    >
                      {FINE_KINNEY_SCALES.frequency.map(scale => (
                        <SelectItem key={scale.value} value={scale.value.toString()}>
                          {scale.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                {/* 2. AŞAMA - Ş */}
                <td className="border border-slate-800/80 bg-green-900/10 p-2 text-center">
                  <Select
                    value={(item.severity_2 || 1).toString()}
                    onValueChange={(value) => updateRiskItem(item.id, 'severity_2', parseFloat(value), 2)}
                  >
                    <SelectTrigger className="h-9 w-[72px] rounded-xl border-emerald-400/15 bg-slate-950/80 text-xs font-semibold text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                    position="popper" 
                    onCloseAutoFocus={(e) => e.preventDefault()} // Bu davranış gerekli.
                    >
                      {FINE_KINNEY_SCALES.severity.map(scale => (
                        <SelectItem key={scale.value} value={scale.value.toString()}>
                          {scale.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                {/* 2. AŞAMA - Skor */}
                <td className="border border-slate-700 p-1 bg-green-900/10 text-center">
                  <Badge className="bg-green-600 text-foreground font-mono font-bold text-xs">
                    {item.score_2 || 0}
                  </Badge>
                </td>

                {/* 2. AŞAMA - Sınıf */}
                <td className="border border-slate-700 p-1 bg-green-900/10 text-center">
                  <Badge className={`${getRiskClassColor(item.risk_class_2 || "Kabul Edilebilir")} font-semibold text-xs`}>
                    {getRiskClassLabel(item.risk_class_2 || "Kabul Edilebilir")}
                  </Badge>
                </td>

                {/* TERMİN */}
                <td className="border border-slate-700 p-2">
                  <Input
                    type="date"
                    value={item.deadline || ""}
                    onChange={(e) => updateRiskItem(item.id, 'deadline', e.target.value)}
                    className="h-8 text-xs bg-slate-800 border-slate-600"
                  />
                </td>

                {/* SORUMLU */}
                <td className="border border-slate-700 p-2">
                  {editingCell?.itemId === item.id && editingCell.field === 'responsible_person' ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 text-xs bg-slate-800 border-slate-600"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEdit(item.id, 'responsible_person', item.responsible_person)}
                      className="cursor-pointer hover:bg-slate-800 p-2 rounded min-h-[32px]"
                    >
                      <p className="text-xs text-foreground">
                        {item.responsible_person || "—"}
                      </p>
                    </div>
                  )}
                </td>

                {showStatusColumns ? (
                  <>
                    <td className="border border-slate-700 p-2">
                      <Input
                        type="date"
                        value={item.completion_date || ""}
                        onChange={(e) => updateRiskItem(item.id, 'completion_date', e.target.value)}
                        className="h-8 text-xs bg-slate-800 border-slate-600"
                      />
                    </td>
                    <td className="border border-slate-700 p-2">
                      {editingCell?.itemId === item.id && editingCell.field === 'completed_activity' ? (
                        <div className="flex items-start gap-1">
                          <Textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="min-h-[84px] text-xs bg-slate-800 border-slate-600"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          onClick={() => startEdit(item.id, 'completed_activity', item.completed_activity)}
                          className="cursor-pointer hover:bg-slate-800 p-2 rounded min-h-[32px]"
                        >
                          <p className="text-xs text-foreground whitespace-pre-wrap">
                            {item.completed_activity || (item.status === "completed" ? "Tamamlandı" : "—")}
                          </p>
                        </div>
                      )}
                    </td>
                  </>
                ) : null}

                {/* İŞLEM */}
                <td className="border border-slate-700 p-1 text-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteRiskItem(item.id)}
                    className="h-8 w-8 text-red-400 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const exportToPDF = async () => {
    if (!assessment || riskItems.length === 0) {
      toast.error("PDF oluşturmak için veri yok");
      return;
    }

    toast.info("Profesyonel PDF oluşturuluyor...");

    try {
      const company = companies.find((c) => c.id === assessment.company_id);
      const doc = await buildRiskAssessmentPdf({
        assessment,
        riskItems,
        company,
        loadImageAsDataUrl,
      });

      doc.save(`Risk-Analiz-${assessment.id.substring(0, 8)}.pdf`);
      toast.success("PDF rapor indirildi");
    } catch (error: any) {
      console.error("PDF error:", error);
      toast.error("PDF oluşturma hatası");
    }
  };

// PDF export fonksiyonundan sonra:
// PDF Export ve Share Fonksiyonu
const exportToPDFAndShare = async () => {
  if (!assessment || riskItems.length === 0) {
    toast.error("Rapor oluşturmak için en az bir risk kaydı gerekli");
    return;
  }

  try {
    setSaving(true);
    toast.info("PDF raporu oluşturuluyor...");

    const company = companies.find((c) => c.id === assessment?.company_id);
    const doc = await buildRiskAssessmentPdf({
      assessment,
      riskItems,
      company,
      loadImageAsDataUrl,
    });

    const pdfBlob = doc.output("blob");

    if (!user?.id) {
      toast.error("Oturum bilgisi eksik. Lütfen tekrar giriş yapın.");
      return;
    }

    // 2. SUPABASE STORAGE'A YÜKLE
    const fileName = `risk-assessment-${assessment.id}-${Date.now()}.pdf`;
    const storagePath = `risk-reports/${user?.id}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("reports")
      .upload(storagePath, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      toast.error("Dosya yüklenemedi", { description: uploadError.message });
      return;
    }

    // 3. PUBLIC URL AL
    const { data: publicUrlData } = supabase.storage
      .from("reports")
      .getPublicUrl(uploadData.path);

    const reportUrl = publicUrlData.publicUrl;

    // 4. LOCAL İNDİR
    doc.save(fileName);
    toast.success("PDF indirildi");

    // 5. E-POSTA MODAL AÇ
    setCurrentReportUrl(reportUrl);
    setCurrentReportFilename(fileName);
    setSendModalOpen(true);
  } catch (error: any) {
    console.error("PDF export error:", error);
    toast.error(`PDF oluşturulamadı: ${error.message}`);
  } finally {
    setSaving(false);
  }
};
// ========================
  // EXCEL EXPORT
  // ========================

  const exportToExcel = () => {
    if (riskItems.length === 0) {
      toast.error("Dışa aktarılacak risk yok");
      return;
    }

    try {
      const company = companies.find((c) => c.id === assessment?.company_id);
      const exportData = riskItems.map((item, idx) => ({
        'No': idx + 1,
        'Bölüm': item.department || "",
        'Foto': item.photo_url ? "Var" : "Yok",
        'Foto URL': item.photo_url || "",
        'Tehlike': item.hazard,
        'Risk': item.risk,
        'Mevcut Durum': item.existing_controls || "",
        'Olası Sonuç': item.affected_people || "",
        // 1. AŞAMA
        'O1': item.probability_1,
        'F1': item.frequency_1,
        'Ş1': item.severity_1,
        'Skor1': item.score_1,
        'Sınıf1': item.risk_class_1,
        // ÖNLEMLER
        'Önlemler': item.proposed_controls || "",
        // 2. AŞAMA
        'O2': item.probability_2 || 0,
        'F2': item.frequency_2 || 0,
        'Ş2': item.severity_2 || 0,
        'Skor2': item.score_2 || 0,
        'Sınıf2': item.risk_class_2 || "Kabul Edilebilir",
        // DİĞER
        'Sorumlu': item.responsible_person || "",
        'Termin': item.deadline || "",
        'Gerçekleşme Tarihi': item.completion_date || "",
        'Gerçekleşen Faaliyetler': item.completed_activity || "",
      }));

      const headerRows = [
        ["KURUMSAL RİSK DEĞERLENDİRME ANALİZİ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["Firma", company?.name || "—", "", "Değerlendiren", assessment?.assessor_name || "—", "", "Bölüm", assessment?.department || "Tüm Bölümler", "", "Tarih", assessment?.assessment_date ? format(new Date(assessment.assessment_date), 'dd.MM.yyyy', { locale: tr }) : format(new Date(), 'dd.MM.yyyy', { locale: tr }), "", "", "", "", "", "", "", "", ""],
        ["Toplam Risk", riskItems.length, "", "Kritik Risk", riskItems.filter((i) => i.risk_class_1 === "Çok Yüksek").length, "", "Güvenli Kalıntı Risk", riskItems.filter((i) => i.risk_class_2 === "Kabul Edilebilir" || i.risk_class_2 === "Olası").length, "", "Oluşturulma", format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }), "", "", "", "", "", "", "", "", ""],
        ["TEMEL BİLGİLER", "", "", "", "", "", "1. AŞAMA · MEVCUT DURUM", "", "", "", "", "ÖNERİLEN ÖNLEMLER", "2. AŞAMA · KALINTI RİSK", "", "", "", "", "AKSİYON TAKİBİ", "", ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet(headerRows);
      XLSX.utils.sheet_add_json(ws, exportData, { origin: "A5" });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kurumsal Risk Analizi");

      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } },
        { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
        { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } },
        { s: { r: 1, c: 7 }, e: { r: 1, c: 8 } },
        { s: { r: 1, c: 10 }, e: { r: 1, c: 11 } },
        { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
        { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
        { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } },
        { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
        { s: { r: 3, c: 6 }, e: { r: 3, c: 10 } },
        { s: { r: 3, c: 12 }, e: { r: 3, c: 16 } },
        { s: { r: 3, c: 17 }, e: { r: 3, c: 19 } },
      ];
      ws["!cols"] = [
        { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
        { wch: 10 }, { wch: 16 }, { wch: 34 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 28 }
      ];
      ws["!rows"] = [{ hpt: 28 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 20 }];
      if (ws["A1"]) {
        ws["A1"].s = {
          font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: "0F172A" } }
        } as any;
      }
      const metaLabelStyle = {
        font: { bold: true, color: { rgb: "0F172A" } },
        alignment: { horizontal: "left", vertical: "center" },
        fill: { fgColor: { rgb: "E2E8F0" } },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "thin", color: { rgb: "CBD5E1" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      } as any;
      const metaValueStyle = {
        font: { color: { rgb: "1E293B" } },
        alignment: { horizontal: "left", vertical: "center" },
        fill: { fgColor: { rgb: "F8FAFC" } },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "thin", color: { rgb: "CBD5E1" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      } as any;
      ["A2", "D2", "G2", "J2", "A3", "D3", "G3", "J3"].forEach((cell) => {
        if (ws[cell]) ws[cell].s = metaLabelStyle;
      });
      ["B2", "E2", "H2", "K2", "B3", "E3", "H3", "K3"].forEach((cell) => {
        if (ws[cell]) ws[cell].s = metaValueStyle;
      });
      const groupHeaderStyles: Record<string, any> = {
        A4: { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "1D4ED8" } } },
        F4: { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "991B1B" } } },
        K4: { font: { bold: true, color: { rgb: "0F172A" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "67E8F9" } } },
        L4: { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "166534" } } },
        Q4: { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "7C3AED" } } },
      };
      Object.entries(groupHeaderStyles).forEach(([cell, style]) => {
        if (ws[cell]) ws[cell].s = style;
      });
      const columnHeaderStyles: Record<string, any> = {};
      ["A", "B", "C", "D", "E", "F"].forEach((col) => {
        columnHeaderStyles[`${col}5`] = { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "1E293B" } } };
      });
      ["G", "H", "I", "J", "K"].forEach((col) => {
        columnHeaderStyles[`${col}5`] = { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "7F1D1D" } } };
      });
      columnHeaderStyles["L5"] = { font: { bold: true, color: { rgb: "0F172A" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "A5F3FC" } } };
      ["M", "N", "O", "P", "Q"].forEach((col) => {
        columnHeaderStyles[`${col}5`] = { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "166534" } } };
      });
      ["R", "S", "T"].forEach((col) => {
        columnHeaderStyles[`${col}5`] = { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "6D28D9" } } };
      });
      Object.entries(columnHeaderStyles).forEach(([cell, style]) => {
        if (ws[cell]) ws[cell].s = style;
      });

      const fileName = `Kurumsal-Risk-Analizi-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Excel dosyası indirildi", {
        description: fileName
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Dışa aktarma hatası");
    }
  };
  const activeCompanyName =
    companies.find((company) => company.id === assessment?.company_id)?.name ||
    companies.find((company) => company.id === selectedCompany)?.name ||
    "Firma seçilmedi";

  const riskMetrics = useMemo(() => {
    const critical = riskItems.filter((item) => item.risk_class_1 === "Çok Yüksek").length;
    const high = riskItems.filter((item) => item.risk_class_1 === "Yüksek").length;
    const acceptable = riskItems.filter(
      (item) => item.risk_class_2 === "Kabul Edilebilir" || item.risk_class_2 === "Olası"
    ).length;

    return {
      total: riskItems.length,
      critical,
      high,
      acceptable,
    };
  }, [riskItems]);

  // ========================
  // MAIN RENDER
  // ========================

  return (
    <div className="theme-page-readable min-h-screen flex flex-col overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="border-b border-white/10 bg-slate-950/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_18px_45px_rgba(99,102,241,0.35)]">
              <FileText className="h-7 w-7 text-foreground" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">Risk Operasyon Merkezi</Badge>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-foreground">
                  2 Aşamalı Fine-Kinney
                </Badge>
                {saving && (
                  <Badge variant="outline" className="gap-2 animate-pulse border-indigo-500/40 bg-indigo-500/10 text-indigo-200">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Kaydediliyor
                  </Badge>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground xl:text-3xl">
                  Risk Analiz Editörü
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-foreground xl:text-base">
                  Risk maddelerini kurumsal bir editör deneyimiyle yönetin, AI desteğiyle yeni riskler üretin ve profesyonel PDF/Excel çıktıları alın.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_16px_40px_rgba(15,23,42,0.28)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Aktif Firma</p>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-foreground">{activeCompanyName}</p>
            </div>
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 shadow-[0_16px_40px_rgba(248,113,113,0.12)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-red-200/80">Kritik Risk</p>
              <p className="mt-2 text-2xl font-black text-red-100">{riskMetrics.critical}</p>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 shadow-[0_16px_40px_rgba(245,158,11,0.12)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/80">Yüksek Risk</p>
              <p className="mt-2 text-2xl font-black text-amber-100">{riskMetrics.high}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 shadow-[0_16px_40px_rgba(16,185,129,0.12)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">Kalıntı Güvenli</p>
              <p className="mt-2 text-2xl font-black text-emerald-100">{riskMetrics.acceptable}</p>
            </div>
          </div>
        </div>

        {createdFromWizard && (
          <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 shadow-[0_12px_32px_rgba(34,211,238,0.12)]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Sihirbazdan Taşındı</p>
                <p className="mt-1 text-sm text-cyan-50">Risk değerlendirme sihirbazında oluşturulan kayıt detaylı madde yönetimi için editöre aktarıldı.</p>
                <p className="mt-2 text-xs text-cyan-100/80">
                  Açan kullanıcı: {user?.email || "Bilinmiyor"} · Oluşturulma: {assessment?.created_at ? format(new Date(assessment.created_at), "dd.MM.yyyy HH:mm", { locale: tr }) : "-"}
                </p>
                <p className="mt-1 text-xs text-cyan-100/70">
                  Wizard ID / Kayıt No: {bridgedAssessmentId !== "-" ? bridgedAssessmentId.toString().substring(0, 8).toUpperCase() : "-"}
                </p>
                <p className="mt-1 text-xs text-cyan-100/70">
                  Firmaya bağlı kayıt: {activeCompanyName || "Firma eşleşmedi"} · İşyeri: {assessment?.workplace_title || "-"} · Tehlike sınıfı: {assessment?.sector || "-"}
                </p>
              </div>
              <Badge className="w-fit border-cyan-400/20 bg-cyan-500/15 text-cyan-100">Köprü Akışı Aktif</Badge>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"
              onClick={() => setShowHelp(true)}
            >
              <HelpCircle className="h-4 w-4" />
              Nasıl Kullanılır?
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"
              onClick={toggleFullScreen}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  Küçült
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  Tam Ekran
                </>
              )}
            </Button>

            {assessment && (
              <>
                <Badge variant="outline" className="gap-2 border-white/10 bg-white/[0.04] text-foreground">
                  <Building2 className="h-3 w-3" />
                  {activeCompanyName}
                </Badge>
                <Badge variant="outline" className="gap-2 border-white/10 bg-white/[0.04] font-mono text-foreground">
                  <FileText className="h-3 w-3" />
                  {assessment.id.substring(0, 8).toUpperCase()}
                </Badge>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"
              onClick={exportToExcel}
              disabled={!assessment || riskItems.length === 0}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>

            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-foreground shadow-[0_14px_30px_rgba(16,185,129,0.28)] hover:from-emerald-400 hover:to-cyan-400"
              onClick={exportToPDFAndShare}
              disabled={!assessment || riskItems.length === 0}
            >
              <Share2 className="h-4 w-4" />
              PDF Oluştur ve Gönder
            </Button>
          </div>
        </div>
      </div>
      {/* MAIN CONTENT */}
      {!assessment ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border border-white/10 bg-white/[0.04] shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <CardContent className="p-8">
                <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-xl">
                    <Badge className="border border-indigo-400/30 bg-indigo-500/10 text-indigo-200">Adım 1 · Kurulum</Badge>
                    <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground">
                      Firma ve değerlendirme oturumunu başlatın
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-foreground">
                      Risk tablolarını, AI önerilerini ve profesyonel çıktı akışını tek bir değerlendirme oturumu içinde yönetin. İlk adımda şirketi seçin ve çalışma alanını açın.
                    </p>
                  </div>
                  <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-sm lg:grid-cols-1">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Firma</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{companies.length} kayıtlı şirket</p>
                    </div>
                    <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-violet-200/80">Hazırlık</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">AI destekli analiz akışı hazır</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">Çıktı</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">PDF ve Excel rapor merkezi</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  {activeCompanyId ? (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">Firma baglami aktif</p>
                          <p className="text-sm text-muted-foreground">
                            Firma 360 icinden acildigi icin firma secimi otomatik uygulanir.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next = new URLSearchParams(searchParams);
                            next.delete("companyId");
                            setSearchParams(next);
                          }}
                        >
                          Baglami kaldir
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <Label className="mb-2 block text-foreground">Firma Seçin</Label>
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-slate-950/60 text-slate-100">
                        <SelectValue placeholder="Firma seçiniz..." />
                      </SelectTrigger>
                      <SelectContent position="popper" onCloseAutoFocus={(e) => e.preventDefault()}>
                        {companies.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Kayıtlı firma yok
                          </SelectItem>
                        ) : (
                          companies.map(company => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={createAssessment}
                    disabled={!selectedCompany || loading}
                    className="h-12 w-full gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-foreground shadow-[0_18px_40px_rgba(99,102,241,0.35)] hover:from-indigo-400 hover:via-violet-400 hover:to-fuchsia-400"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Oluşturuluyor...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        Yeni Değerlendirme Başlat
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
                <CardContent className="p-6">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300/80">Operasyon Özeti</p>
                  <h3 className="mt-3 text-xl font-bold text-foreground">Kullanıcıyı zorlamayan başlangıç akışı</h3>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    Firma seçimi sonrası risk kütüphanesi, AI üretim paneli ve iki aşamalı skor tablosu tek bir merkezde aktif olur.
                  </p>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs text-muted-foreground">Hazırlık durumu</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">Analiz motoru hazır</span>
                        <Badge className="bg-emerald-500/15 text-emerald-200">Canlı</Badge>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs text-muted-foreground">Masaüstü deneyimi</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">Geniş tablo, sol kütüphane ve yardım akışı optimize</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                      <p className="text-xs text-cyan-100/80">Bu modül neden güçlü?</p>
                      <ul className="mt-2 space-y-2 text-sm text-cyan-50">
                        <li>• Aynı ekranda kütüphane ve manuel giriş birlikte çalışır.</li>
                        <li>• AI sektöre göre başlangıç risk seti önerir.</li>
                        <li>• PDF ve Excel çıkışı doğrudan rapor akışına bağlıdır.</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden lg:flex-row lg:overflow-hidden">
          <div className="w-full shrink-0 lg:w-[24rem]">
            <RiskLibraryPanel />
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-visible lg:overflow-hidden">
            <div className="border-b border-white/10 bg-slate-950/50 px-5 py-4">
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.35)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-indigo-400/30 bg-indigo-500/10 text-indigo-200">Aktif Değerlendirme</Badge>
                    <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground">{activeCompanyName}</Badge>
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">Risk tablosunu kurum standardında yönetin</h2>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    Sol panelden paket ekleyin, AI ile yeni risk maddeleri oluşturun ve iki aşamalı Fine-Kinney skoru ile kalıntı riski hedef seviyeye indirin.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Toplam Madde</p>
                    <p className="mt-3 text-3xl font-black text-foreground">{riskMetrics.total}</p>
                  </div>
                  <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-red-200/80">Kritik Baskı</p>
                    <p className="mt-3 text-3xl font-black text-red-100">{riskMetrics.critical}</p>
                  </div>
                  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">Güvenli Hedef</p>
                    <p className="mt-3 text-3xl font-black text-emerald-100">{riskMetrics.acceptable}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-b border-white/10 bg-slate-950/80 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={currentAssessmentMethod}
                  onValueChange={(value) => {
                    void updateAssessmentField("method", value as AssessmentMethod);
                  }}
                  disabled={!assessment}
                >
                  <SelectTrigger className="h-10 min-w-[220px] rounded-xl border-indigo-400/25 bg-indigo-500/10 text-sm font-semibold text-indigo-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fine_kinney">FK (FINE-KINNEY)</SelectItem>
                    <SelectItem value="l_matrix">L5 (L-MATRİS)</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  size="sm"
                  variant={showOrderColumn ? "default" : "outline"}
                  onClick={() => setShowOrderColumn((prev) => !prev)}
                  className="gap-2 rounded-xl"
                >
                  <ListOrdered className="h-4 w-4" />
                  Sıra
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={showTerminColumn ? "default" : "outline"}
                  onClick={() => setShowTerminColumn((prev) => !prev)}
                  className="gap-2 rounded-xl"
                >
                  <CalendarClock className="h-4 w-4" />
                  Termin
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={showStatusColumns ? "default" : "outline"}
                  onClick={() => setShowStatusColumns((prev) => !prev)}
                  className="gap-2 rounded-xl"
                >
                  <ClipboardList className="h-4 w-4" />
                  Durum
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={showProposedControlsColumn ? "default" : "outline"}
                  onClick={() => setShowProposedControlsColumn((prev) => !prev)}
                  className="gap-2 rounded-xl"
                >
                  <Columns3 className="h-4 w-4" />
                  Pros
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void autoSave();
                    toast.success("Risk değerlendirmesi kaydedildi");
                  }}
                  className="gap-2 rounded-xl border-amber-400/25 bg-amber-500/10 text-amber-100"
                >
                  <Save className="h-4 w-4" />
                  Kaydet
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTemplateDialog(true)}
                  className="gap-2 rounded-xl border-cyan-400/25 bg-cyan-500/10 text-cyan-100"
                >
                  <Upload className="h-4 w-4" />
                  Şablon
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!assessment) return;
                    void supabase.from("risk_items").delete().eq("assessment_id", assessment.id).then(({ error }) => {
                      if (error) {
                        toast.error("Risk listesi temizlenemedi", { description: error.message });
                        return;
                      }
                      setRiskItems([]);
                      toast.success("Risk listesi temizlendi");
                    });
                  }}
                  disabled={!assessment || riskItems.length === 0}
                  className="gap-2 rounded-xl border-rose-400/25 bg-rose-500/10 text-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Sil
                </Button>
              </div>
            </div>
            <div className="border-b border-white/10 bg-slate-950/60 px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-2 border-white/10 bg-white/[0.04] text-foreground">
                  <FileText className="h-3 w-3" />
                  {riskItems.length} Risk Maddesi
                </Badge>

                {riskItems.length > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-4 bg-slate-600" />
                    <Badge className="border border-red-500/30 bg-red-500/10 text-red-200">
                      {riskMetrics.critical} Kritik
                    </Badge>
                    <Badge className="border border-orange-500/30 bg-orange-500/10 text-orange-200">
                      {riskMetrics.high} Yüksek
                    </Badge>
                    <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                      {riskMetrics.acceptable} Güvenli
                    </Badge>
                  </>
                )}
              </div>

              <Button
                onClick={addEmptyRisk}
                size="sm"
                variant="outline"
                className="gap-2 border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"
                disabled={!assessment}
              >
                <Plus className="h-4 w-4" />
                Manuel Risk Ekle
              </Button>
            </div>
            <div className="relative flex-1 overflow-auto lg:overflow-hidden">
              <div
                ref={tableContainerRef}
                className="min-h-[60vh] overflow-auto scroll-smooth lg:absolute lg:inset-0 lg:min-h-0"
                onScroll={handleScroll}
              >
                <RiskAnalysisTable />
              </div>
            </div>
          </div>
        </div>
      )}
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent className="max-w-3xl border border-white/10 bg-slate-950/95 text-foreground">
            <DialogHeader>
              <DialogTitle>Risk Şablonları</DialogTitle>
              <DialogDescription>
                Mevcut tabloyu şablon olarak kaydedin, kendi şablon dosyanızı içe alın ve daha sonra tekrar kullanın.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-template-name">Şablon Adı</Label>
                  <Input
                    id="risk-template-name"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Örn: Metal üretim temel şablonu"
                    className="border-white/10 bg-slate-900/80"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void saveCurrentAsTemplate()}
                    disabled={templateSaving || !assessment || riskItems.length === 0}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Şablonu Kaydet
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => templateFileInputRef.current?.click()}
                    className="gap-2 border-white/10 bg-white/[0.03]"
                  >
                    <Upload className="h-4 w-4" />
                    Şablon İçe Aktar
                  </Button>
                  <input
                    ref={templateFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void importTemplateFile(file);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  İçe aktarılacak dosya Excel formatında olmalı. Sistem ilk sayfadaki sütun başlıklarını okuyup şablona çevirir ve organizasyon içinde saklar.
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold">Kayıtlı Şablonlar</p>
                <ScrollArea className="h-72 pr-3">
                  <div className="space-y-3">
                    {riskTemplates.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                        Henüz kayıtlı risk şablonu yok.
                      </div>
                    ) : (
                      riskTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            selectedTemplateId === template.id
                              ? "border-cyan-400/40 bg-cyan-500/10"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{template.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {template.sector || "Genel"} · {template.method === "l_matrix" ? "L5 (L-MATRİS)" : "FK (FINE-KINNEY)"}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground">
                              {(template.payload?.items || []).length} madde
                            </Badge>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <Button
                  type="button"
                  disabled={!selectedTemplateId || !assessment}
                  onClick={() => {
                    const template = riskTemplates.find((item) => item.id === selectedTemplateId);
                    if (template) {
                      void replaceAssessmentItemsFromTemplate(template);
                      setShowTemplateDialog(false);
                    }
                  }}
                  className="w-full gap-2"
                >
                  <Check className="h-4 w-4" />
                  Seçili Şablonu Uygula
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={!!previewPhotoUrl} onOpenChange={(open) => !open && setPreviewPhotoUrl(null)}>
          <DialogContent className="max-w-4xl border border-cyan-400/20 bg-slate-950/95 p-0 shadow-[0_30px_80px_rgba(15,23,42,0.55)] backdrop-blur-xl">
            <div className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(8,47,73,0.95),rgba(15,23,42,0.98),rgba(17,24,39,0.95))] px-6 py-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-foreground">
                  <Camera className="h-4 w-4 text-cyan-300" />
                  Risk Maddesi Fotoğraf Önizlemesi
                </DialogTitle>
                <DialogDescription className="text-foreground">
                  Yüklenen görselin büyük görünümünü buradan kontrol edebilirsiniz.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="p-6">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-[0_20px_50px_rgba(15,23,42,0.35)]">
                {previewPhotoUrl ? (
                  <img
                    src={previewPhotoUrl}
                    alt="Risk maddesi fotoğraf önizlemesi"
                    className="max-h-[72vh] w-full object-contain bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_55%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))]"
                  />
                ) : null}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* AI Results Dialog */}
        <AIResultsDialog />


        <SendReportModal
          open={sendModalOpen}
          onOpenChange={setSendModalOpen}
          reportType="risk_assessment"
          reportUrl={currentReportUrl}
          reportFilename={
            `Risk_Raporu_${companies.find((c) => c.id === assessment?.company_id)?.name || "Firma"}.pdf`
          }
          companyName={
            companies.find((c) => c.id === assessment?.company_id)?.name || "Firma"
          }
        />
         <HelpDialog />
    </div>
  );
}
