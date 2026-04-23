import { useState, useEffect, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { 
  Building2, Users, FileSpreadsheet, Plus, Save, 
  ChevronRight, ChevronLeft, CheckCircle2, Upload,
  Download, Trash2, Edit, Eye, Search, Filter,
  Factory, Briefcase, HardHat, AlertTriangle,
  X, Check, ChevronsUpDown,
  Mail,
  Phone,
  MapPin,
  ImagePlus,
  Warehouse,
  GraduationCap,
  ShoppingCart,
  UtensilsCrossed,
  Truck,
  HeartPulse,
  LayoutGrid,
  Rows3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseEmployeeExcel, downloadEmployeeTemplate, type ParsedEmployee } from "@/utils/excelParser";
import { NACE_DATABASE, searchNACE, type NACECode } from "@/utils/naceDatabase";
import type { Company, Employee, RiskTemplate } from "@/types/companies";
import { cn } from "@/lib/utils";
import { useSafeMode } from "@/hooks/useSafeMode";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

interface NACEVirtualListProps {
  items: NACECode[];
  selectedCode: string | undefined;
  onSelect: (nace: NACECode) => void;
}

const NACEVirtualList: React.FC<NACEVirtualListProps> = ({ 
  items, 
  selectedCode, 
  onSelect 
}) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sonuç bulunamadı</p>
      </div>
    );
  }

  return (
    <List
      height={450}
      itemCount={items.length}
      itemSize={100}
      width="100%"
      overscanCount={5}
      style={{
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch"
      }}
    >
      {({ index, style }) => {
        const nace = items[index];
        const isSelected = selectedCode === nace.code;

        return (
          <div
            style={style}
            onClick={() => onSelect(nace)}
            className={cn(
              "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors border-b",
              isSelected && "bg-primary/10"
            )}
          >
            <Check
              className={cn(
                "h-5 w-5 mt-0.5 shrink-0",
                isSelected ? "opacity-100 text-primary" : "opacity-0"
              )}
            />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="font-mono text-xs">
                  {nace.code}
                </Badge>
                <Badge
                  className={cn(
                    "text-xs",
                    nace.hazard_class === "Çok Tehlikeli" &&
                      "bg-red-100 text-red-700 border-red-300",
                    nace.hazard_class === "Tehlikeli" &&
                      "bg-orange-100 text-orange-700 border-orange-300",
                    nace.hazard_class === "Az Tehlikeli" &&
                      "bg-green-100 text-green-700 border-green-300"
                  )}
                >
                  {nace.hazard_class}
                </Badge>
              </div>
              <p className="text-sm font-medium leading-tight">{nace.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {nace.industry_sector}
              </p>
            </div>
          </div>
        );
      }}
    </List>
  );
};

const SECTOR_TEMPLATES = [
  {
    id: "construction",
    name: "İnşaat Sektörü",
    industrySector: "İnşaat Sektörü",
    aliases: ["İnşaat", "Şantiye", "Yapı", "Altyapı"],
    icon: HardHat,
    description: "50+ inşaat risk maddesi",
    color: "text-orange-600 bg-orange-50 border-orange-200"
  },
  {
    id: "office",
    name: "Ofis Ortamı",
    industrySector: "Ofis Ortamı",
    aliases: ["Ofis", "Büro", "İdari Birim", "Çağrı Merkezi"],
    icon: Briefcase,
    description: "50+ ofis risk maddesi",
    color: "text-blue-600 bg-blue-50 border-blue-200"
  },
  {
    id: "manufacturing",
    name: "Üretim Tesisi",
    industrySector: "Üretim Tesisi",
    aliases: ["Üretim", "İmalat", "Fabrika", "Atölye"],
    icon: Factory,
    description: "50+ üretim risk maddesi",
    color: "text-purple-600 bg-purple-50 border-purple-200"
  },
  {
    id: "warehouse",
    name: "Depo ve Lojistik",
    industrySector: "Depo ve Lojistik",
    aliases: ["Depo", "Lojistik", "Sevkiyat", "Stok Alanı"],
    icon: Warehouse,
    description: "50+ depolama ve sevkiyat risk maddesi",
    color: "text-amber-700 bg-amber-50 border-amber-200"
  },
  {
    id: "healthcare",
    name: "Sağlık Kuruluşu",
    industrySector: "Sağlık Kuruluşu",
    aliases: ["Sağlık", "Hastane", "Klinik", "Poliklinik", "Laboratuvar"],
    icon: HeartPulse,
    description: "50+ sağlık hizmeti ve biyolojik risk maddesi",
    color: "text-rose-700 bg-rose-50 border-rose-200"
  },
  {
    id: "education",
    name: "Eğitim Kurumu",
    industrySector: "Eğitim Kurumu",
    aliases: ["Okul", "Eğitim", "Kurs", "Üniversite", "Yurt"],
    icon: GraduationCap,
    description: "50+ eğitim ortamı ve kampüs risk maddesi",
    color: "text-indigo-700 bg-indigo-50 border-indigo-200"
  },
  {
    id: "retail",
    name: "Mağaza ve Perakende",
    industrySector: "Mağaza ve Perakende",
    aliases: ["Mağaza", "Perakende", "Market", "AVM", "Satış Alanı"],
    icon: ShoppingCart,
    description: "50+ müşteri alanı ve perakende risk maddesi",
    color: "text-cyan-700 bg-cyan-50 border-cyan-200"
  },
  {
    id: "food",
    name: "Yeme İçme ve Mutfak",
    industrySector: "Yeme İçme ve Mutfak",
    aliases: ["Restoran", "Kafe", "Mutfak", "Gıda", "Yemekhane"],
    icon: UtensilsCrossed,
    description: "50+ mutfak, hijyen ve sıcak yüzey risk maddesi",
    color: "text-red-700 bg-red-50 border-red-200"
  },
  {
    id: "transport",
    name: "Taşımacılık ve Saha Operasyonu",
    industrySector: "Taşımacılık ve Saha Operasyonu",
    aliases: ["Taşımacılık", "Nakliye", "Servis", "Araç Filosu", "Saha Operasyonu"],
    icon: Truck,
    description: "50+ sürüş, yükleme ve saha operasyonu risk maddesi",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200"
  }
];

const VISIT_FREQUENCY_OPTIONS = [
  "Haftada 1 Defa",
  "15 Günde 1 Defa",
  "Ayda 1 Defa",
  "2 Ayda 1 Defa",
  "3 Ayda 1 Defa",
] as const;

const loadXlsx = () => import("xlsx");

function normalizeTemplateText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

function resolveSectorTemplateValue(industrySector?: string | null) {
  const normalizedSource = normalizeTemplateText(industrySector || "");
  if (!normalizedSource) return "";

  const matchedTemplate = SECTOR_TEMPLATES.find((template) => {
    const candidates = [template.industrySector, template.name, ...(template.aliases || [])];
    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeTemplateText(candidate);
      return (
        normalizedSource === normalizedCandidate ||
        normalizedSource.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedSource)
      );
    });
  });

  return matchedTemplate?.industrySector || industrySector || "";
}

function normalizeCompanyImportHeader(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeHazardClass(value?: string | null): "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli" {
  const normalized = normalizeCompanyImportHeader(value || "");
  if (normalized.includes("cok")) return "Çok Tehlikeli";
  if (normalized.includes("tehlikeli")) return "Tehlikeli";
  return "Az Tehlikeli";
}

export default function CompanyManager() {
  const { user } = useAuth();
  const runtimeMode = useSafeMode();
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hazardFilter, setHazardFilter] = useState<string | null>(null);
  const [companyViewMode, setCompanyViewMode] = useState<"table" | "cards">("table");
  const [workspaceMode, setWorkspaceMode] = useState<"list" | "wizard" | "import">("list");
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  
  // Wizard State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportFileName, setBulkImportFileName] = useState("");
  const [bulkCompanyRows, setBulkCompanyRows] = useState<Array<{
    company_name: string;
    tax_number: string;
    nace_code: string;
    hazard_class: "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";
    industry_sector: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    employee_count: number;
  }>>([]);

  // Step 1: Temel Bilgiler
  const [formData, setFormData] = useState({
    company_name: "",
    tax_number: "",
    nace_code: "",
    hazard_class: "" as "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli" | "",
    industry_sector: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    logo_url: "",
    employee_count: 0,
    workplace_registration_number: "",
    sgk_workplace_number: "",
    visit_frequency: "Ayda 1 Defa",
    employer_representative_name: "",
    occupational_safety_specialist_name: "",
    workplace_doctor_name: "",
    employee_representative_name: "",
    knowledgeable_employee_name: "",
    fire_support_person_name: "",
    first_aid_support_person_name: "",
    evacuation_support_person_name: "",
  });
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // NACE Combobox State
  const [naceOpen, setNaceOpen] = useState(false);
  const [naceSearchQuery, setNaceSearchQuery] = useState("");
  const [selectedNACE, setSelectedNACE] = useState<NACECode | null>(null);

  // Step 2: Sektörel Şablon
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [riskTemplates, setRiskTemplates] = useState<RiskTemplate[]>([]);

  // Step 3: Çalışan Yükleme
  const [employeeFile, setEmployeeFile] = useState<File | null>(null);
  const [parsedEmployees, setParsedEmployees] = useState<ParsedEmployee[]>([]);
  const [existingEmployees, setExistingEmployees] = useState<Employee[]>([]);
  const [loadingExistingEmployees, setLoadingExistingEmployees] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [detailEmployeeSearchQuery, setDetailEmployeeSearchQuery] = useState("");
  const [detailEmployeeDepartmentFilter, setDetailEmployeeDepartmentFilter] = useState("all");
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState("all");
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeDraft, setEmployeeDraft] = useState<Partial<Employee>>({});
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  // ============================================
  // LOAD DATA
  // ============================================

  useEffect(() => {
    if (user) {
      loadCompanies();
      loadRiskTemplates();
    }
  }, [user]);

  useEffect(() => {
    if (runtimeMode.safeMode) {
      setCompanyViewMode("cards");
    }
  }, [runtimeMode.safeMode]);

  useEffect(() => {
    setShowAllCompanies(false);
  }, [hazardFilter, searchQuery, runtimeMode.safeMode]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user?.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedData = (data || []).map((item: any) => ({
        ...item,
        owner_id: item.user_id,
        company_name: item.name,
        tax_number: item.tax_number || "",
        nace_code: item.industry || "",
        hazard_class: item.hazard_class || "Az Tehlikeli",
        industry_sector: item.industry_sector || "",
        workplace_registration_number: item.workplace_registration_number || item.sgk_workplace_number || "",
        sgk_workplace_number: item.sgk_workplace_number || "",
        visit_frequency: item.visit_frequency || "Ayda 1 Defa",
        employer_representative_name: item.employer_representative_name || "",
        occupational_safety_specialist_name: item.occupational_safety_specialist_name || "",
        workplace_doctor_name: item.workplace_doctor_name || "",
        employee_representative_name: item.employee_representative_name || "",
        knowledgeable_employee_name: item.knowledgeable_employee_name || "",
        fire_support_person_name: item.fire_support_person_name || "",
        first_aid_support_person_name: item.first_aid_support_person_name || "",
        evacuation_support_person_name: item.evacuation_support_person_name || "",
        logo_url: item.logo_url || "",
      }));

      setCompanies(mappedData as Company[]);
      
    } catch (e: any) {
      console.error("❌ Veri çekme hatası:", e.message);
      toast.error(`Firmalar yüklenemedi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadRiskTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("risk_templates")
        .select("*");

      if (error) throw error;
      
      const templates = (data || []).map(template => ({
        ...template,
        risk_items: JSON.parse(JSON.stringify(template.risk_items))
      })) as RiskTemplate[];
      
      setRiskTemplates(templates);
    } catch (e: any) {
      console.error("Risk templates yüklenemedi:", e);
    }
  };

  const loadExistingEmployees = async (companyId: string) => {
    try {
      setLoadingExistingEmployees(true);
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (error) throw error;
      setExistingEmployees((data || []) as Employee[]);
    } catch (error: any) {
      console.error("Çalışanlar yüklenemedi:", error);
      toast.error(`Firma çalışanları yüklenemedi: ${error.message}`);
      setExistingEmployees([]);
    } finally {
      setLoadingExistingEmployees(false);
    }
  };

  const employeeDepartments = useMemo(() => {
    return Array.from(
      new Set(
        existingEmployees
          .map((employee) => (employee.department || "").trim())
          .filter((department) => department.length > 0)
      )
    ).sort((left, right) => left.localeCompare(right, "tr"));
  }, [existingEmployees]);

  const filteredExistingEmployees = useMemo(() => {
    const normalizedSearch = employeeSearchQuery.trim().toLocaleLowerCase("tr-TR");

    return existingEmployees.filter((employee) => {
      const matchesDepartment =
        employeeDepartmentFilter === "all" ||
        (employee.department || "").trim() === employeeDepartmentFilter;

      if (!matchesDepartment) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        employee.full_name,
        employee.first_name,
        employee.last_name,
        employee.tc_number,
        employee.insured_job_name,
        employee.job_title,
        employee.department,
        employee.phone,
        employee.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedSearch);
    });
  }, [employeeDepartmentFilter, employeeSearchQuery, existingEmployees]);

  const filteredDetailEmployees = useMemo(() => {
    const normalizedSearch = detailEmployeeSearchQuery.trim().toLocaleLowerCase("tr-TR");
    return existingEmployees.filter((employee) => {
      const matchesDepartment =
        detailEmployeeDepartmentFilter === "all" ||
        (employee.department || "").trim() === detailEmployeeDepartmentFilter;

      if (!matchesDepartment) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        employee.full_name,
        employee.first_name,
        employee.last_name,
        employee.tc_number,
        employee.insured_job_name,
        employee.job_title,
        employee.department,
        employee.phone,
        employee.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedSearch);
    });
  }, [detailEmployeeDepartmentFilter, detailEmployeeSearchQuery, existingEmployees]);

  const startEmployeeEdit = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setEmployeeDraft({
      full_name: employee.full_name || `${employee.first_name} ${employee.last_name}`.trim(),
      first_name: employee.first_name,
      last_name: employee.last_name,
      tc_number: employee.tc_number || "",
      job_title: employee.job_title,
      department: employee.department || "",
      start_date: employee.start_date || "",
      end_date: employee.end_date || "",
      gender: employee.gender || "",
      insured_job_code: employee.insured_job_code || "",
      insured_job_name: employee.insured_job_name || "",
      phone: employee.phone || "",
      email: employee.email || "",
    });
  };

  const cancelEmployeeEdit = () => {
    setEditingEmployeeId(null);
    setEmployeeDraft({});
  };

  const updateEmployeeDraft = (patch: Partial<Employee>) => {
    setEmployeeDraft((prev) => ({ ...prev, ...patch }));
  };

  const saveEmployeeEdit = async (employeeId: string) => {
    setSavingEmployeeId(employeeId);
    try {
      const payload = {
        full_name: (employeeDraft.full_name || `${employeeDraft.first_name || ""} ${employeeDraft.last_name || ""}`).trim(),
        first_name: (employeeDraft.first_name || "").trim(),
        last_name: (employeeDraft.last_name || "").trim(),
        tc_number: (employeeDraft.tc_number || "").trim() || null,
        job_title: (employeeDraft.job_title || "").trim(),
        department: (employeeDraft.department || "").trim() || null,
        start_date: (employeeDraft.start_date || "").trim() || null,
        end_date: (employeeDraft.end_date || "").trim() || null,
        gender: (employeeDraft.gender || "").trim() || null,
        insured_job_code: (employeeDraft.insured_job_code || "").trim() || null,
        insured_job_name: (employeeDraft.insured_job_name || "").trim() || null,
        phone: (employeeDraft.phone || "").trim() || null,
        email: (employeeDraft.email || "").trim() || null,
      };

      if (!payload.first_name || !payload.last_name || !payload.job_title) {
        toast.error("Ad, soyad ve görev alanları zorunludur.");
        return;
      }

      const { error } = await supabase.from("employees").update(payload).eq("id", employeeId);
      if (error) throw error;

      setExistingEmployees((prev) =>
        prev.map((employee) => (employee.id === employeeId ? { ...employee, ...payload, department: payload.department || undefined, phone: payload.phone || undefined, email: payload.email || undefined } : employee))
      );

      toast.success("Çalışan bilgileri güncellendi.");
      cancelEmployeeEdit();
    } catch (error: any) {
      toast.error(`Çalışan güncellenemedi: ${error.message}`);
    } finally {
      setSavingEmployeeId(null);
    }
  };

  const deleteExistingEmployee = async (employee: Employee) => {
    const confirmed = confirm(`${employee.first_name} ${employee.last_name} çalışanını firmadan kaldırmak istediğinize emin misiniz?`);
    if (!confirmed) return;

    setDeletingEmployeeId(employee.id);
    try {
      const { error } = await supabase.from("employees").update({ is_active: false }).eq("id", employee.id);
      if (error) throw error;

      setExistingEmployees((prev) => prev.filter((item) => item.id !== employee.id));
      toast.success("Çalışan pasif hale getirildi.");
      if (editingEmployeeId === employee.id) {
        cancelEmployeeEdit();
      }
    } catch (error: any) {
      toast.error(`Çalışan silinemedi: ${error.message}`);
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const syncCompanyLogoPreview = async (logoValue?: string | null) => {
    const nextValue = (logoValue || "").trim();
    if (!nextValue) {
      setLogoPreviewUrl("");
      return;
    }

    if (/^https?:\/\//i.test(nextValue) || nextValue.startsWith("data:")) {
      setLogoPreviewUrl(nextValue);
      return;
    }

    const { data, error } = await supabase.storage.from("company-logos").createSignedUrl(nextValue, 3600);
    if (error) {
      setLogoPreviewUrl("");
      return;
    }

    setLogoPreviewUrl(data?.signedUrl || "");
  };

  const handleCompanyLogoUpload = async (file: File) => {
    if (!user?.id) {
      toast.error("Logo yüklemek için kullanıcı bilgisi bulunamadı");
      return;
    }

    setUploadingLogo(true);
    const localPreview = URL.createObjectURL(file);
    setLogoPreviewUrl(localPreview);

    try {
      const fileExtension = file.name.split(".").pop() || "png";
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExtension}`;

      const { error } = await supabase.storage.from("company-logos").upload(fileName, file, {
        upsert: true,
        cacheControl: "3600",
      });

      if (error) throw error;

      setFormData((prev) => ({ ...prev, logo_url: fileName }));
      await syncCompanyLogoPreview(fileName);
      toast.success("Firma logosu yüklendi");
    } catch (error: any) {
      setLogoPreviewUrl("");
      toast.error(`Firma logosu yüklenemedi: ${error.message}`);
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploadingLogo(false);
    }
  };

  const clearCompanyLogo = () => {
    setFormData((prev) => ({ ...prev, logo_url: "" }));
    setLogoPreviewUrl("");
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleViewCompany = async (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setDetailEmployeeSearchQuery("");
      setDetailEmployeeDepartmentFilter("all");
      void loadExistingEmployees(companyId);
      if (company.logo_url && !/^https?:\/\//i.test(company.logo_url) && !company.logo_url.startsWith("data:")) {
        const { data } = await supabase.storage.from("company-logos").createSignedUrl(company.logo_url, 3600);
        setViewingCompany({ ...company, logo_url: data?.signedUrl || company.logo_url });
        return;
      }
      setViewingCompany(company);
    }
  };

  const handleEditCompany = (company: Company) => {
    setFormData({
      company_name: company.company_name,
      tax_number: company.tax_number,
      nace_code: company.nace_code,
      hazard_class: company.hazard_class,
      industry_sector: company.industry_sector || "",
      address: company.address || "",
      city: company.city || "",
      phone: company.phone || "",
      email: company.email || "",
      logo_url: company.logo_url || "",
      employee_count: company.employee_count || 0,
      workplace_registration_number: company.workplace_registration_number || company.sgk_workplace_number || "",
      sgk_workplace_number: company.sgk_workplace_number || "",
      visit_frequency: company.visit_frequency || "Ayda 1 Defa",
      employer_representative_name: company.employer_representative_name || "",
      occupational_safety_specialist_name: company.occupational_safety_specialist_name || "",
      workplace_doctor_name: company.workplace_doctor_name || "",
      employee_representative_name: company.employee_representative_name || "",
      knowledgeable_employee_name: company.knowledgeable_employee_name || "",
      fire_support_person_name: company.fire_support_person_name || "",
      first_aid_support_person_name: company.first_aid_support_person_name || "",
      evacuation_support_person_name: company.evacuation_support_person_name || "",
    });

    void syncCompanyLogoPreview(company.logo_url || "");

    const nace = NACE_DATABASE.find(n => n.code === company.nace_code);
    if (nace) {
      setSelectedNACE(nace);
    }

    if (company.industry_sector) {
      setSelectedTemplate(resolveSectorTemplateValue(company.industry_sector));
    }

    setEditingCompanyId(company.id);
    setWorkspaceMode("wizard");
    setWizardOpen(true);
    setCurrentStep(1);
    void loadExistingEmployees(company.id);
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`"${companyName}" firmasını silmek istediğinize emin misiniz?\n\n⚠️ Bu işlem geri alınamaz ve tüm ilişkili veriler (çalışanlar, risk değerlendirmeleri) silinecektir!`)) {
      return;
    }

    try {
      const existingCompany = companies.find((company) => company.id === companyId);
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", companyId);

      if (error) throw error;

      if (existingCompany?.logo_url && !/^https?:\/\//i.test(existingCompany.logo_url) && !existingCompany.logo_url.startsWith("data:")) {
        await supabase.storage.from("company-logos").remove([existingCompany.logo_url]);
      }

      toast.success(`✅ "${companyName}" firması silindi`);
      loadCompanies();
    } catch (error: any) {
      console.error("Delete company error:", error);
      toast.error(`❌ Firma silinemedi: ${error.message}`);
    }
  };

  const handleNACESelect = (nace: NACECode) => {
    const resolvedTemplateValue = resolveSectorTemplateValue(nace.industry_sector);
    setSelectedNACE(nace);
    setFormData(prev => ({
      ...prev,
      nace_code: nace.code,
      hazard_class: nace.hazard_class,
      industry_sector: nace.industry_sector
    }));
    setSelectedTemplate(resolvedTemplateValue);
    setNaceOpen(false);
    setNaceSearchQuery(""); // Reset search
    toast.success(`${nace.name} seçildi`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEmployeeFile(file);
    toast.info("📄 Excel dosyası işleniyor...");

    try {
      const employees = await parseEmployeeExcel(file);
      setParsedEmployees(employees);
      toast.success(`✅ ${employees.length} çalışan bulundu`);
    } catch (error: any) {
      toast.error(`❌ ${error.message}`);
      setEmployeeFile(null);
    }
  };

  const parseBulkCompanyFile = async (file: File) => {
    const XLSX = await loadXlsx();
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

    const parsedRows = rows
      .map((row) => {
        const entries = Object.entries(row).map(([key, value]) => [normalizeCompanyImportHeader(key), value] as const);
        const getValue = (...keys: string[]) => entries.find(([header]) => keys.includes(header))?.[1];

        const companyName = String(
          getValue("firmaunvani", "firmaadi", "companyname", "name", "unvan"),
        ).trim();
        if (!companyName) return null;

        const naceCode = String(getValue("nacekodu", "nacecode", "nace", "faaliyetkodu") || "").trim();
        const naceMatch = naceCode
          ? NACE_DATABASE.find((item) => item.code === naceCode) || searchNACE(naceCode)[0]
          : undefined;

        const hazardClass = String(getValue("tehlikesinifi", "hazardclass", "sinif") || "").trim();
        const sectorValue = String(getValue("sektor", "industrysector", "industry", "faaliyetalani") || "").trim();

        return {
          company_name: companyName,
          tax_number: String(getValue("vergino", "taxnumber", "taxno") || "").trim(),
          nace_code: naceCode || naceMatch?.code || "",
          hazard_class: hazardClass
            ? normalizeHazardClass(hazardClass)
            : normalizeHazardClass(naceMatch?.hazard_class),
          industry_sector: resolveSectorTemplateValue(sectorValue || naceMatch?.industry_sector || ""),
          address: String(getValue("adres", "address", "adresbilgisi") || "").trim(),
          city: String(getValue("sehir", "city", "il") || "").trim(),
          phone: String(getValue("telefon", "phone") || "").trim(),
          email: String(getValue("eposta", "email", "mail") || "").trim(),
          employee_count: Number(getValue("calisansayisi", "employeecount", "calisan") || 0),
        };
      })
      .filter(Boolean) as Array<{
      company_name: string;
      tax_number: string;
      nace_code: string;
      hazard_class: "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";
      industry_sector: string;
      address: string;
      city: string;
      phone: string;
      email: string;
      employee_count: number;
    }>;

    return parsedRows;
  };

  const handleBulkCompanyFileUpload = async (file: File | null) => {
    if (!file) return;
    try {
      const rows = await parseBulkCompanyFile(file);
      setBulkCompanyRows(rows);
      setBulkImportFileName(file.name);
      toast.success(`${rows.length} firma satırı hazırlandı`);
    } catch (error: any) {
      toast.error(`Firma dosyası okunamadı: ${error.message}`);
    }
  };

  const handleBulkCompanyImport = async () => {
    if (!user?.id || bulkCompanyRows.length === 0) {
      toast.error("İçe aktarılacak firma bulunamadı.");
      return;
    }

    setBulkImporting(true);
    let successCount = 0;
    const failedCompanies: string[] = [];

    try {
      for (const row of bulkCompanyRows) {
        try {
          const matchingTemplate = riskTemplates.find((template) => {
            const templateSector = resolveSectorTemplateValue(template.industry_sector);
            return templateSector === row.industry_sector || template.industry_sector === row.industry_sector;
          });

          const { data, error } = await supabase.rpc("create_company_with_data", {
            p_owner_id: user.id,
            p_company_data: row,
            p_risk_template_id: matchingTemplate?.id || null,
            p_employees: [],
          });

          if (error) throw error;

          const result = data as { success: boolean; error?: string };
          if (!result?.success) throw new Error(result?.error || "Kayıt başarısız");

          successCount += 1;
        } catch (error) {
          console.error("Bulk company import row failed:", row.company_name, error);
          failedCompanies.push(row.company_name);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} firma sisteme eklendi.`);
      }

      if (failedCompanies.length > 0) {
        toast.error(`${failedCompanies.length} firma eklenemedi: ${failedCompanies.slice(0, 3).join(", ")}${failedCompanies.length > 3 ? "..." : ""}`);
      }

      if (successCount > 0) {
        setBulkImportOpen(false);
        setWorkspaceMode("list");
        setBulkCompanyRows([]);
        setBulkImportFileName("");
        await loadCompanies();
      }
    } finally {
      setBulkImporting(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!formData.company_name || !formData.hazard_class) {
      toast.error("Lütfen zorunlu alanları doldurun");
      return;
    }

    if (
      formData.workplace_registration_number &&
      !/^\d+$/.test(formData.workplace_registration_number)
    ) {
      toast.error("SGK sicil no alanına sadece rakam giriniz");
      return;
    }

    setSaving(true);

    try {
      const template = riskTemplates.find((t) => {
        const templateSector = resolveSectorTemplateValue(t.industry_sector);
        return templateSector === selectedTemplate || t.industry_sector === selectedTemplate;
      });

      const employeesJson = parsedEmployees.map((emp) => ({
        full_name: emp.full_name || `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || null,
        first_name: emp.first_name || "",
        last_name: emp.last_name || "",
        tc_number: emp.tc_number || null,
        job_title: emp.job_title || emp.insured_job_name || "Belirtilmemiş",
        department: emp.department || null,
        start_date: emp.start_date || new Date().toISOString().split("T")[0],
        end_date: emp.end_date || null,
        employment_type: emp.employment_type || "Süresiz",
        birth_date: emp.birth_date || null,
        gender: emp.gender || null,
        insured_job_code: emp.insured_job_code || null,
        insured_job_name: emp.insured_job_name || emp.job_title || null,
        email: emp.email || null,
        phone: emp.phone || null,
      }));

      const isMissingLogoColumnError = (error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String((error as { message?: unknown }).message || "")
              : "";

        return message.toLocaleLowerCase("tr-TR").includes("logo_url");
      };

      const buildCompanyPayload = (includeLogo: boolean) => ({
        name: formData.company_name,
        tax_number: formData.tax_number || null,
        industry: formData.nace_code || null,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        ...(includeLogo ? { logo_url: formData.logo_url || null } : {}),
        employee_count: employeesJson.length || formData.employee_count,
        hazard_class: formData.hazard_class,
        workplace_registration_number: formData.workplace_registration_number || null,
        sgk_workplace_number: formData.workplace_registration_number || null,
        visit_frequency: formData.visit_frequency || null,
        employer_representative_name: formData.employer_representative_name || null,
        occupational_safety_specialist_name: formData.occupational_safety_specialist_name || null,
        workplace_doctor_name: formData.workplace_doctor_name || null,
        employee_representative_name: formData.employee_representative_name || null,
        knowledgeable_employee_name: formData.knowledgeable_employee_name || null,
        fire_support_person_name: formData.fire_support_person_name || null,
        first_aid_support_person_name: formData.first_aid_support_person_name || null,
        evacuation_support_person_name: formData.evacuation_support_person_name || null,
      });

      const buildRpcCompanyData = (includeLogo: boolean) => ({
        company_name: formData.company_name,
        tax_number: formData.tax_number || null,
        nace_code: formData.nace_code || null,
        hazard_class: formData.hazard_class,
        industry_sector: formData.industry_sector,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        ...(includeLogo ? { logo_url: formData.logo_url || null } : {}),
        employee_count: employeesJson.length || formData.employee_count,
        workplace_registration_number: formData.workplace_registration_number || null,
        sgk_workplace_number: formData.workplace_registration_number || null,
        visit_frequency: formData.visit_frequency || null,
        employer_representative_name: formData.employer_representative_name || null,
        occupational_safety_specialist_name: formData.occupational_safety_specialist_name || null,
        workplace_doctor_name: formData.workplace_doctor_name || null,
        employee_representative_name: formData.employee_representative_name || null,
        knowledgeable_employee_name: formData.knowledgeable_employee_name || null,
        fire_support_person_name: formData.fire_support_person_name || null,
        first_aid_support_person_name: formData.first_aid_support_person_name || null,
        evacuation_support_person_name: formData.evacuation_support_person_name || null,
      });

      if (editingCompanyId) {
        const existingCompany = companies.find((company) => company.id === editingCompanyId);
        let companyError: unknown = null;
        const firstUpdate = await (supabase as any)
          .from("companies")
          .update(buildCompanyPayload(true))
          .eq("id", editingCompanyId);

        companyError = firstUpdate.error;

        if (companyError && isMissingLogoColumnError(companyError)) {
          const retryUpdate = await (supabase as any)
            .from("companies")
            .update(buildCompanyPayload(false))
            .eq("id", editingCompanyId);
          companyError = retryUpdate.error;
          if (!companyError) {
            toast.warning("Firma kaydedildi, ancak logo alanı veritabanında henüz bulunmadığı için logo kaydı atlandı.");
          }
        }

        if (companyError) throw companyError;

        if (
          existingCompany?.logo_url &&
          existingCompany.logo_url !== formData.logo_url &&
          !/^https?:\/\//i.test(existingCompany.logo_url) &&
          !existingCompany.logo_url.startsWith("data:")
        ) {
          await supabase.storage.from("company-logos").remove([existingCompany.logo_url]);
        }

        if (employeesJson.length > 0) {
          const employeesToInsert = employeesJson.map(emp => ({
            ...emp,
            company_id: editingCompanyId,
            is_active: true,
          }));

          const { error: employeesError } = await supabase
            .from("employees")
            .insert(employeesToInsert);

          if (employeesError) throw employeesError;
        }

        toast.success("✅ Firma güncellendi!", {
          description: employeesJson.length > 0 
            ? `${employeesJson.length} çalışan eklendi`
            : "Firma bilgileri güncellendi"
        });

        setWizardOpen(false);
        setWorkspaceMode("list");
        setEditingCompanyId(null);
        resetWizard();
        loadCompanies();
        return;
      }

      let rpcResult = await supabase.rpc("create_company_with_data", {
        p_owner_id: user?.id,
        p_company_data: buildRpcCompanyData(true),
        p_risk_template_id: template?.id || null,
        p_employees: [],
      });

      if (rpcResult.error && isMissingLogoColumnError(rpcResult.error)) {
        rpcResult = await supabase.rpc("create_company_with_data", {
          p_owner_id: user?.id,
          p_company_data: buildRpcCompanyData(false),
          p_risk_template_id: template?.id || null,
          p_employees: [],
        });

        if (!rpcResult.error) {
          toast.warning("Firma kaydedildi, ancak logo alanı veritabanında henüz bulunmadığı için logo kaydı atlandı.");
        }
      }

      if (rpcResult.error) throw rpcResult.error;

      const result = rpcResult.data as {
        success: boolean;
        error?: string;
        company_id?: string;
        inserted_risks?: number;
        inserted_employees?: number;
      };

      if (!result.success) {
        throw new Error(result.error || "Bilinmeyen hata");
      }

      if (result.company_id && formData.logo_url) {
        const { error: logoUpdateError } = await (supabase as any)
          .from("companies")
          .update({ logo_url: formData.logo_url })
          .eq("id", result.company_id);

        if (logoUpdateError && !isMissingLogoColumnError(logoUpdateError)) throw logoUpdateError;
      }

      if (result.company_id) {
        const { error: extendedUpdateError } = await (supabase as any)
          .from("companies")
          .update({
            hazard_class: formData.hazard_class,
            workplace_registration_number: formData.workplace_registration_number || null,
            sgk_workplace_number: formData.workplace_registration_number || null,
            visit_frequency: formData.visit_frequency || null,
            employer_representative_name: formData.employer_representative_name || null,
            occupational_safety_specialist_name: formData.occupational_safety_specialist_name || null,
            workplace_doctor_name: formData.workplace_doctor_name || null,
            employee_representative_name: formData.employee_representative_name || null,
            knowledgeable_employee_name: formData.knowledgeable_employee_name || null,
            fire_support_person_name: formData.fire_support_person_name || null,
            first_aid_support_person_name: formData.first_aid_support_person_name || null,
            evacuation_support_person_name: formData.evacuation_support_person_name || null,
          })
          .eq("id", result.company_id);

        if (extendedUpdateError) throw extendedUpdateError;
      }

      let insertedEmployeesCount = result.inserted_employees || 0;
      if (result.company_id && employeesJson.length > 0) {
        const employeesToInsert = employeesJson.map((employee) => ({
          ...employee,
          company_id: result.company_id,
          is_active: true,
        }));

        const { error: employeesError } = await (supabase as any)
          .from("employees")
          .insert(employeesToInsert);

        if (employeesError) throw employeesError;
        insertedEmployeesCount = employeesToInsert.length;
      }

      toast.success("🎉 Firma başarıyla kaydedildi!", {
        description: `${result.inserted_risks || 0} risk, ${insertedEmployeesCount} çalışan eklendi`,
      });

      setWizardOpen(false);
      setWorkspaceMode("list");
      resetWizard();
      loadCompanies();
    } catch (e: unknown) {
      const error = e as Error;
      console.error("❌ Kaydetme Hatası:", error);
      toast.error(`❌ Kaydetme hatası: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setFormData({
      company_name: "",
      tax_number: "",
      nace_code: "",
      hazard_class: "",
      industry_sector: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      logo_url: "",
      employee_count: 0,
      workplace_registration_number: "",
      sgk_workplace_number: "",
      visit_frequency: "Ayda 1 Defa",
      employer_representative_name: "",
      occupational_safety_specialist_name: "",
      workplace_doctor_name: "",
      employee_representative_name: "",
      knowledgeable_employee_name: "",
      fire_support_person_name: "",
      first_aid_support_person_name: "",
      evacuation_support_person_name: "",
    });
    setLogoPreviewUrl("");
    setSelectedNACE(null);
    setNaceSearchQuery("");
    setSelectedTemplate("");
    setEmployeeFile(null);
    setParsedEmployees([]);
    setExistingEmployees([]);
    setEmployeeSearchQuery("");
    setEmployeeDepartmentFilter("all");
    setEditingEmployeeId(null);
    setEmployeeDraft({});
    setEditingCompanyId(null);
  };

  const goToStep = (step: number) => {
    if (step === 2 && currentStep === 1) {
      if (!formData.company_name || !formData.hazard_class) {
        toast.error("Lütfen zorunlu alanları doldurun");
        return;
      }
    }
    setCurrentStep(step);
  };

  // ============================================
  // FILTERED COMPANIES
  // ============================================

  const filteredCompanies = useMemo(() => {
    let result = companies;

    if (hazardFilter) {
      result = result.filter(c => c.hazard_class === hazardFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        company =>
          company.company_name.toLowerCase().includes(query) ||
          (company.tax_number || "").includes(query) ||
          (company.nace_code || "").includes(query) ||
          (company.workplace_registration_number || "").includes(query)
      );
    }

    return result;
  }, [companies, hazardFilter, searchQuery]);

  const displayedCompanies = useMemo(() => {
    if (!runtimeMode.lowDataMode || showAllCompanies) return filteredCompanies;
    return filteredCompanies.slice(0, runtimeMode.maxCompanyRows);
  }, [filteredCompanies, runtimeMode.lowDataMode, runtimeMode.maxCompanyRows, showAllCompanies]);

  const stats = useMemo(() => {
    return {
      total: companies.length,
      veryHazardous: companies.filter(c => c.hazard_class === "Çok Tehlikeli").length,
      hazardous: companies.filter(c => c.hazard_class === "Tehlikeli").length,
      lessHazardous: companies.filter(c => c.hazard_class === "Az Tehlikeli").length,
    };
  }, [companies]);

  const getCompanyRiskSummary = (company: Company) => {
    if (company.hazard_class === "Çok Tehlikeli") {
      return {
        tone: "border-red-400/20 bg-red-500/10 text-red-200",
        summary: "Kritik izleme gerekli",
        action: "Saha ritmi ve doküman güncelliği aylık kontrol edilmeli.",
      };
    }

    if (company.hazard_class === "Tehlikeli") {
      return {
        tone: "border-orange-400/20 bg-orange-500/10 text-orange-200",
        summary: "Yakın operasyon takibi önerilir",
        action: "Eğitim, risk şablonu ve çalışan akışı üç aylık gözden geçirilmeli.",
      };
    }

    return {
      tone: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      summary: "Standart takip ritmi yeterli",
      action: "Yıllık plan, çalışan listesi ve belge güncelliği düzenli izlenmeli.",
    };
  };

  const getCompanyWorkflowBadges = (company: Company) => {
    const hasTemplate = Boolean(resolveSectorTemplateValue(company.industry_sector || ""));
    const hasEmployees = Number(company.employee_count || 0) > 0;

    return {
      template: hasTemplate
        ? {
            label: "Şablon hazır",
            className: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
          }
        : {
            label: "Şablon bekliyor",
            className: "border-amber-400/20 bg-amber-500/10 text-amber-100",
          },
      employee: hasEmployees
        ? {
            label: "Çalışanlar yüklü",
            className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
          }
        : {
            label: "Yükleme bekliyor",
            className: "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100",
          },
    };
  };

  const getCompanyTabCounts = (company: Company) => {
    const contactCount = [company.address, company.phone, company.email].filter(Boolean).length;
    const riskCount = Number(Boolean(company.hazard_class)) + Number(Boolean(company.nace_code)) + Number(Boolean(resolveSectorTemplateValue(company.industry_sector)));

    return {
      logo: Number(Boolean(company.logo_url)),
      contact: contactCount,
      risk: riskCount,
      employee: existingEmployees.length || Number(company.employee_count || 0),
    };
  };

  // ============================================
  // WIZARD STEPS
  // ============================================

  const renderWizardStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.25)]">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">1. Adım · Temel Bilgiler</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Firma ünvanı, NACE, tehlike sınıfı ve iletişim kanallarını girerek kurumsal kaydın temel omurgasını oluşturun.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Firma Ünvanı *</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  placeholder="Örn: ABC İnşaat A.Ş."
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Sicil Numarası *</Label>
                <Input
                  value={formData.tax_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").substring(0, 11);
                    setFormData(prev => ({ ...prev, tax_number: value }));
                  }}
                  placeholder="10 veya 11 haneli"
                  maxLength={11}
                  className="mt-2"
                />
              </div>

              {/* ✅ NACE Combobox - 3178 KOD İÇİN OPTİMİZE EDİLMİŞ */}
                <div className="md:col-span-2">
                  <Label>NACE Kodu * (Yazarak Arayın)</Label>
                  <Popover open={naceOpen} onOpenChange={setNaceOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={naceOpen}
                        className="w-full justify-between mt-2"
                      >
                        {selectedNACE ? (
                          <span className="flex items-center gap-2">
                            <Badge variant="outline">{selectedNACE.code}</Badge>
                            <span className="truncate max-w-[140px] md:max-w-[400px]">
                              {selectedNACE.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            NACE kodu veya sektör adı ile arayın...
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                        className="w-[95vw] md:w-[750px] max-w-[750px] p-0"
                        align="center"
                      >
                      <Command shouldFilter={false}>
                        <div className="border-b p-3 md:p-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="NACE kodu veya sektör adı yazın (en az 2 karakter)..."
                              value={naceSearchQuery}
                              onChange={(e) => setNaceSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <span>
                              {naceSearchQuery.length >= 2
                                ? `${searchNACE(naceSearchQuery).length} sonuç`
                                : `${NACE_DATABASE.length} toplam kod`}
                            </span>
                            {naceSearchQuery && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setNaceSearchQuery("")}
                                className="h-6 text-xs"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Temizle
                              </Button>
                            )}
                          </div>
                        </div>

                        {naceSearchQuery.length > 0 && naceSearchQuery.length < 2 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            En az 2 karakter girin
                          </div>
                        ) : (
                          <NACEVirtualList
                            items={naceSearchQuery.length >= 2 ? searchNACE(naceSearchQuery) : NACE_DATABASE}
                            selectedCode={selectedNACE?.code}
                            onSelect={handleNACESelect}
                          />
                        )}
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* ✅ Seçili NACE Önizleme */}
                  {selectedNACE && (
                    <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-1">Seçili NACE:</p>
                          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                            <Badge variant="outline" className="font-mono">
                              {selectedNACE.code}
                            </Badge>
                            <Badge
                              className={cn(
                                "text-xs",
                                selectedNACE.hazard_class === "Çok Tehlikeli" &&
                                  "bg-red-100 text-red-700",
                                selectedNACE.hazard_class === "Tehlikeli" &&
                                  "bg-orange-100 text-orange-700",
                                selectedNACE.hazard_class === "Az Tehlikeli" &&
                                  "bg-green-100 text-green-700"
                              )}
                            >
                              {selectedNACE.hazard_class}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mt-1">{selectedNACE.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedNACE.industry_sector}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNACE(null);
                            setFormData(prev => ({
                              ...prev,
                              nace_code: "",
                              hazard_class: "",
                              industry_sector: ""
                            }));
                            setSelectedTemplate("");
                            setNaceSearchQuery("");
                          }}
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ✅ Bilgi Notu */}
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 İpucu: En az 2 karakter girerek arama yapabilirsiniz. 
                    Boş bırakırsanız tüm {NACE_DATABASE.length.toLocaleString()} kod gösterilir.
                  </p>
                </div>

              <div>
                <Label>Tehlike Sınıfı</Label>
                <div className={`mt-2 p-3 rounded-lg border-2 font-semibold ${
                  formData.hazard_class === "Çok Tehlikeli" 
                    ? "bg-red-50 border-red-300 text-red-700"
                    : formData.hazard_class === "Tehlikeli"
                    ? "bg-orange-50 border-orange-300 text-orange-700"
                    : formData.hazard_class === "Az Tehlikeli"
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "bg-slate-50 border-slate-300 text-slate-500"
                }`}>
                  {formData.hazard_class || "NACE kodu seçiniz"}
                </div>
              </div>

              <div>
                <Label>Şehir</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="İstanbul"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Adres</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Tam adres"
                className="mt-2"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Telefon</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="0555 123 4567"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>E-posta</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="info@firma.com"
                  className="mt-2"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Firma Logosu</Label>
                <div className="mt-2 rounded-2xl border border-dashed border-border bg-secondary/20 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-24 w-32 items-center justify-center overflow-hidden rounded-xl border bg-background">
                        {logoPreviewUrl ? (
                          <img src={logoPreviewUrl} alt="Firma logosu önizleme" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 px-3 text-center text-xs text-muted-foreground">
                            <ImagePlus className="h-5 w-5" />
                            Logo önizleme
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Kurumsal logo yükleyin</p>
                        <p className="text-xs text-muted-foreground">
                          Yüklediğiniz logo sertifika, atama yazıları ve diğer belge modüllerinde otomatik kullanılabilir.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <label>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && void handleCompanyLogoUpload(e.target.files[0])}
                        />
                        <Button type="button" variant="outline" className="gap-2" asChild>
                          <span>
                            {uploadingLogo ? <Upload className="h-4 w-4 animate-pulse" /> : <Upload className="h-4 w-4" />}
                            {formData.logo_url ? "Logoyu Güncelle" : "Logo Yükle"}
                          </span>
                        </Button>
                      </label>

                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                        onClick={clearCompanyLogo}
                        disabled={!formData.logo_url}
                      >
                        <Trash2 className="h-4 w-4" />
                        Logoyu Sil
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.25)]">
            <div className="rounded-2xl border border-indigo-400/15 bg-indigo-500/5 p-4">
              <p className="text-sm text-slate-200">
                <strong className="text-indigo-200">Zeki Özellik:</strong> Sektörünüze uygun risk şablonunu seçin. 
                Otomatik olarak 50+ risk maddesi firmaya atanacaktır.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {SECTOR_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedTemplate === template.industrySector
                      ? `ring-2 ring-primary ${template.color}`
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedTemplate(template.industrySector)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${template.color}`}>
                        <template.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {template.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {selectedTemplate === template.industrySector && (
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-semibold">Seçildi</span>
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Örnek alanlar: {template.aliases.slice(0, 3).join(", ")}
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {selectedTemplate && (
              <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                <p className="text-sm text-success font-semibold">
                  ✅ {SECTOR_TEMPLATES.find(t => t.industrySector === selectedTemplate)?.name || selectedTemplate} şablonu seçildi
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Bu şablondaki tüm risk maddeleri firmaya otomatik atanacaktır
                </p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.25)]">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">3. Adım · Çalışan Akışı</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Mevcut çalışanları gözden geçirin, yeni toplu yüklemeleri hazırlayın ve firmanın operasyon yapısını personel bazında tamamlayın.
              </p>
            </div>
            {editingCompanyId && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      Mevcut Firma Çalışanları
                    </p>
                    <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                      Firma düzenleme ekranındasınız. Sistemde kayıtlı çalışanları aşağıda görebilir, üzerine yeni çalışan yüklemesi yapabilirsiniz.
                    </p>
                  </div>
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {existingEmployees.length} kayıtlı çalışan
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_240px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      placeholder="Ad, TC, meslek, bölüm, telefon veya e-posta ile ara"
                      className="pl-10"
                    />
                  </div>

                  <select
                    value={employeeDepartmentFilter}
                    onChange={(e) => setEmployeeDepartmentFilter(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">Tüm departmanlar</option>
                    {employeeDepartments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 rounded-xl border bg-background">
                  {loadingExistingEmployees ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Firma çalışanları yükleniyor...
                    </div>
                  ) : existingEmployees.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Bu firmaya ait kayıtlı çalışan bulunamadı.
                    </div>
                  ) : filteredExistingEmployees.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Arama ve filtreye uygun çalışan bulunamadı.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ad Soyad</TableHead>
                            <TableHead>TC Kimlik No</TableHead>
                            <TableHead>Sigortalı Meslek</TableHead>
                            <TableHead>Bölüm</TableHead>
                            <TableHead>İşe Giriş</TableHead>
                            <TableHead>Telefon</TableHead>
                            <TableHead>Cinsiyet</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredExistingEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium">
                                {editingEmployeeId === employee.id ? (
                                  <div className="grid gap-2 md:grid-cols-2">
                                    <Input
                                      value={employeeDraft.first_name || ""}
                                      onChange={(e) => updateEmployeeDraft({ first_name: e.target.value })}
                                      placeholder="Ad"
                                    />
                                    <Input
                                      value={employeeDraft.last_name || ""}
                                      onChange={(e) => updateEmployeeDraft({ last_name: e.target.value })}
                                      placeholder="Soyad"
                                    />
                                  </div>
                                ) : (
                                  `${employee.first_name} ${employee.last_name}`
                                )}
                              </TableCell>
                              <TableCell>
                                {editingEmployeeId === employee.id ? (
                                  <Input
                                    value={employeeDraft.tc_number || ""}
                                    onChange={(e) => updateEmployeeDraft({ tc_number: e.target.value })}
                                    placeholder="TC Kimlik No"
                                  />
                                ) : (
                                  employee.tc_number || "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {editingEmployeeId === employee.id ? (
                                  <Input
                                    value={employeeDraft.insured_job_name || employeeDraft.job_title || ""}
                                    onChange={(e) => updateEmployeeDraft({ insured_job_name: e.target.value, job_title: e.target.value })}
                                    placeholder="Sigortalı Meslek"
                                  />
                                ) : (
                                  employee.insured_job_name || employee.job_title || "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {editingEmployeeId === employee.id ? (
                                  <Input
                                    value={employeeDraft.department || ""}
                                    onChange={(e) => updateEmployeeDraft({ department: e.target.value })}
                                    placeholder="Bölüm"
                                  />
                                ) : (
                                  employee.department || "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {editingEmployeeId === employee.id ? (
                                  <Input type="date" value={employeeDraft.start_date || ""} onChange={(e) => updateEmployeeDraft({ start_date: e.target.value })} />
                                ) : (
                                  employee.start_date || "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {editingEmployeeId === employee.id ? (
                                  <Input
                                    value={employeeDraft.gender || ""}
                                    onChange={(e) => updateEmployeeDraft({ gender: e.target.value })}
                                    placeholder="Cinsiyet"
                                  />
                                ) : (
                                  employee.gender || "-"
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {editingEmployeeId === employee.id ? (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => saveEmployeeEdit(employee.id)}
                                        disabled={savingEmployeeId === employee.id}
                                      >
                                        {savingEmployeeId === employee.id ? "Kaydediliyor..." : "Kaydet"}
                                      </Button>
                                      <Button type="button" size="sm" variant="ghost" onClick={cancelEmployeeEdit}>
                                        Vazgeç
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button type="button" size="sm" variant="outline" onClick={() => startEmployeeEdit(employee)}>
                                        Düzenle
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                                        onClick={() => void deleteExistingEmployee(employee)}
                                        disabled={deletingEmployeeId === employee.id}
                                      >
                                        {deletingEmployeeId === employee.id ? "Siliniyor..." : "Sil"}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>📋 Excel Şablonu:</strong> Çalışanlarınızı toplu olarak yüklemek için 
                önce şablon dosyasını indirin ve doldurun.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadEmployeeTemplate}
                className="mt-3 gap-2"
              >
                <Download className="h-4 w-4" />
                Excel Şablonunu İndir
              </Button>
            </div>

            <div>
              <Label>Excel/CSV Dosyası Yükle</Label>
              <div className="mt-2">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <Upload className="h-12 w-12 text-muted-foreground mb-3" />
                  <span className="text-sm font-semibold text-foreground">
                    {employeeFile ? employeeFile.name : "Dosya seçin veya sürükleyin"}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Excel (.xlsx, .xls) veya CSV formatı
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {parsedEmployees.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-foreground">
                    Bulunan Çalışanlar ({parsedEmployees.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEmployeeFile(null);
                      setParsedEmployees([]);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Temizle
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ad Soyad</TableHead>
                        <TableHead>TC Kimlik No</TableHead>
                        <TableHead>Sigortalı Meslek</TableHead>
                        <TableHead>İşe Giriş</TableHead>
                        <TableHead>Cinsiyet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedEmployees.slice(0, 5).map((emp) => (
                        <TableRow
                          key={
                            emp.tc_number ||
                            emp.email ||
                            `${emp.full_name || `${emp.first_name}-${emp.last_name}`}-${emp.start_date || "no-date"}`
                          }
                        >
                          <TableCell className="font-medium">
                            {emp.full_name || `${emp.first_name} ${emp.last_name}`.trim()}
                          </TableCell>
                          <TableCell>{emp.tc_number || "-"}</TableCell>
                          <TableCell>{emp.insured_job_name || emp.job_title || "-"}</TableCell>
                          <TableCell>{emp.start_date}</TableCell>
                          <TableCell>{emp.gender || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {parsedEmployees.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    +{parsedEmployees.length - 5} çalışan daha...
                  </p>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="theme-page-readable space-y-8 pb-8">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] shadow-[0_28px_80px_rgba(2,6,23,0.45)]">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.6fr_0.9fr] lg:px-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
                Firma Operasyon Merkezi
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-300">
                {stats.total} aktif kayıt
              </Badge>
            </div>

            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white lg:text-[2.55rem]">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 shadow-[0_10px_30px_rgba(34,211,238,0.2)]">
                  <Building2 className="h-6 w-6 text-cyan-200" />
                </span>
                Firma Yönetimi
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Müşteri firmalarınızı, tehlike sınıflarını, NACE eşleşmelerini ve çalışan yoğunluklarını daha premium bir operasyon paneli içinde yönetin. Bu görünüm, portföy baskısını ve öncelikli firmaları tek bakışta gösterecek şekilde yeniden kurgulandı.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Portföy Yoğunluğu</p>
                <p className="mt-3 text-2xl font-black text-white">{stats.total}</p>
                <p className="mt-1 text-xs text-slate-400">Sistemde takip edilen toplam müşteri firma</p>
              </div>
              <div className="rounded-2xl border border-red-400/15 bg-red-500/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-red-200/80">Kritik Sınıf</p>
                <p className="mt-3 text-2xl font-black text-white">{stats.veryHazardous}</p>
                <p className="mt-1 text-xs text-slate-400">Çok tehlikeli sınıfta öncelikli takip</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">Kurumsal Ölçek</p>
                <p className="mt-3 text-2xl font-black text-white">{companies.reduce((sum, company) => sum + (company.employee_count || 0), 0)}</p>
                <p className="mt-1 text-xs text-slate-400">Toplam çalışan kapasitesi</p>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Operasyon Özeti</p>
                <h2 className="mt-2 text-lg font-bold text-white">Portföy baskısını gösteren görünüm</h2>
              </div>
              <Badge className="rounded-full border border-white/10 bg-white/[0.06] text-slate-200">Canlı</Badge>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Tehlike Dağılımı</p>
                    <p className="mt-2 text-sm font-semibold text-white">Çok tehlikeli ve tehlikeli portföy dengesi</p>
                  </div>
                  <Factory className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-red-400/15 bg-red-500/5 px-3 py-2">
                    <p className="text-lg font-black text-white">{stats.veryHazardous}</p>
                    <p className="text-[11px] text-slate-400">Çok Tehlikeli</p>
                  </div>
                  <div className="rounded-xl border border-orange-400/15 bg-orange-500/5 px-3 py-2">
                    <p className="text-lg font-black text-white">{stats.hazardous}</p>
                    <p className="text-[11px] text-slate-400">Tehlikeli</p>
                  </div>
                  <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-3 py-2">
                    <p className="text-lg font-black text-white">{stats.lessHazardous}</p>
                    <p className="text-[11px] text-slate-400">Az Tehlikeli</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">Yönetim Notu</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Firma kartlarını tehlike sınıfına göre filtreleyin, düzenleyin ve çalışan yüklemeleriyle risk şablonlarını aynı akışta yönetin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <Button
            variant={workspaceMode === "list" ? "default" : "outline"}
            size="lg"
            className="gap-2 rounded-2xl"
            onClick={() => setWorkspaceMode("list")}
          >
            <Rows3 className="h-5 w-5" />
            Firma Listesi
          </Button>
          <Button
            variant={workspaceMode === "wizard" ? "default" : "outline"}
            size="lg"
            className="gap-2 rounded-2xl"
            onClick={() => {
              if (!editingCompanyId) resetWizard();
              setWorkspaceMode("wizard");
            }}
          >
            <Plus className="h-5 w-5" />
            Firma Sihirbazı
          </Button>
          <Button
            variant={workspaceMode === "import" ? "default" : "outline"}
            size="lg"
            className="gap-2 rounded-2xl"
            onClick={() => setWorkspaceMode("import")}
          >
            <Upload className="h-5 w-5" />
            Toplu Aktarım
          </Button>
        </div>
        {runtimeMode.safeMode ? (
          <Badge className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">
            Safe mode aktif · kart görünümü ve düşük veri modu açık
          </Badge>
        ) : null}
      </div>

      {workspaceMode === "wizard" && (
        <RouteErrorBoundary routeKey="companies:wizard" componentName="CompanyManagerWizard">
        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_28px_90px_rgba(2,6,23,0.55)]">
          <CardHeader>
            <CardTitle className="text-xl font-black text-white">
              {editingCompanyId ? "Firma Düzenle" : "Yeni Firma Ekle"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Firma kartını, ekip bilgisini ve operasyon ritmini tek ekranda tanımlayın.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.62))] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/75">Kurulum Akışı</p>
                  <p className="mt-2 text-sm text-slate-300">Firma kaydını temel bilgi, risk şablonu ve çalışan akışıyla birlikte yönetin.</p>
                </div>
                <Badge className="rounded-full border border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
                  Adım {currentStep}/3
                </Badge>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  { num: 1, label: "Temel Bilgiler", hint: "Kurumsal kayıt omurgası" },
                  { num: 2, label: "Risk Şablonu", hint: "Sektörel başlangıç paketi" },
                  { num: 3, label: "Çalışan Yükleme", hint: "Operasyon ekibi ve personel" }
                ].map((step) => {
                  const isActive = currentStep === step.num;
                  const isCompleted = currentStep > step.num;

                  return (
                    <button
                      key={step.num}
                      type="button"
                      onClick={() => goToStep(step.num)}
                      className={cn(
                        "group rounded-2xl border p-4 text-left transition-all",
                        isActive && "border-cyan-400/25 bg-cyan-500/10 shadow-[0_18px_35px_rgba(34,211,238,0.12)]",
                        isCompleted && "border-emerald-400/20 bg-emerald-500/10",
                        !isActive && !isCompleted && "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-black",
                          isActive && "border-cyan-400/30 bg-cyan-500/15 text-cyan-50",
                          isCompleted && "border-emerald-400/30 bg-emerald-500/15 text-emerald-50",
                          !isActive && !isCompleted && "border-white/10 bg-white/[0.04] text-slate-300"
                        )}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.num}
                        </div>
                        <Badge
                          className={cn(
                            "rounded-full border text-[10px] uppercase tracking-[0.18em]",
                            isActive && "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
                            isCompleted && "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
                            !isActive && !isCompleted && "border-white/10 bg-white/[0.04] text-slate-400"
                          )}
                        >
                          {isCompleted ? "Hazır" : isActive ? "Aktif" : "Sıradaki"}
                        </Badge>
                      </div>
                      <p className="mt-4 text-sm font-semibold text-white">{step.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{step.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-[400px]">
              {renderWizardStep()}
            </div>

            <div className="flex justify-between pt-6 border-t border-white/10">
              <Button variant="outline" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Geri
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setWorkspaceMode("list")}>
                  Listeye Dön
                </Button>
                {currentStep < 3 ? (
                  <Button onClick={() => goToStep(currentStep + 1)} className="gap-2">
                    İleri
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleSaveCompany} disabled={saving} className="gap-2 bg-success hover:bg-success/90">
                    {saving ? (
                      <>
                        <Save className="h-4 w-4 animate-spin" />
                        Kaydediliyor...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Firmayı Kaydet
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </RouteErrorBoundary>
      )}

      {workspaceMode === "import" && (
        <RouteErrorBoundary routeKey="companies:import" componentName="CompanyManagerImport">
        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_28px_90px_rgba(2,6,23,0.55)]">
          <CardHeader>
            <CardTitle className="text-xl font-black text-white">Toplu Firma Ekle</CardTitle>
            <CardDescription className="text-slate-400">
              Excel veya CSV dosyasından firmaları tek seferde sisteme ekleyin. Çalışan aktarımı bu akışta yapılmaz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.03] p-8 transition-colors hover:bg-white/[0.05]">
              <Upload className="mb-3 h-10 w-10 text-cyan-300" />
              <span className="text-sm font-semibold text-white">{bulkImportFileName || "Firma dosyası seçin"}</span>
              <span className="mt-1 text-xs text-slate-400">Excel (.xlsx, .xls) veya CSV</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => void handleBulkCompanyFileUpload(e.target.files?.[0] || null)} />
            </label>

            {bulkCompanyRows.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Önizleme ({bulkCompanyRows.length} firma)</p>
                  <Button variant="ghost" size="sm" className="text-red-300 hover:text-red-200" onClick={() => { setBulkCompanyRows([]); setBulkImportFileName(""); }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Temizle
                  </Button>
                </div>

                <div className="max-h-80 overflow-auto rounded-2xl border border-white/10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Firma</TableHead>
                        <TableHead>Vergi No</TableHead>
                        <TableHead>NACE</TableHead>
                        <TableHead>Tehlike</TableHead>
                        <TableHead>Çalışan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkCompanyRows.map((row) => (
                        <TableRow
                          key={`${row.tax_number || "no-tax"}-${row.nace_code || "no-nace"}-${row.company_name}`}
                        >
                          <TableCell className="font-medium">{row.company_name}</TableCell>
                          <TableCell>{row.tax_number || "-"}</TableCell>
                          <TableCell>{row.nace_code || "-"}</TableCell>
                          <TableCell>{row.hazard_class}</TableCell>
                          <TableCell>{row.employee_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4 text-sm text-slate-300">
                Beklenen alanlar: Firma unvanı, vergi no, NACE kodu, tehlike sınıfı, sektör, adres, şehir, telefon, e-posta, çalışan sayısı.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWorkspaceMode("list")}>Listeye Dön</Button>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void handleBulkCompanyImport()} disabled={bulkImporting || bulkCompanyRows.length === 0}>
                {bulkImporting ? "Ekleniyor..." : "Firmaları Ekle"}
              </Button>
            </div>
          </CardContent>
        </Card>
        </RouteErrorBoundary>
      )}

      {/* Stats */}
      {workspaceMode === "list" && (
      <RouteErrorBoundary routeKey="companies:list" componentName="CompanyManagerList">
      <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card 
          className={cn(
            "cursor-pointer border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] shadow-[0_18px_45px_rgba(2,6,23,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(2,6,23,0.42)]",
            hazardFilter === null && "ring-2 ring-cyan-400/60"
          )}
          onClick={() => setHazardFilter(null)}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-black text-white">
              {stats.total}
            </div>
            <p className="text-xs text-slate-400">Toplam Firma</p>
            {hazardFilter === null && (
              <Badge className="mt-2 border-cyan-400/20 bg-cyan-500/10 text-cyan-100" variant="default">Aktif görünüm</Badge>
            )}
          </CardContent>
        </Card>
        
        <Card 
          className={cn(
            "cursor-pointer border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] shadow-[0_18px_45px_rgba(2,6,23,0.35)] transition-all hover:-translate-y-0.5 hover:border-red-500/40 hover:shadow-[0_24px_60px_rgba(2,6,23,0.42)]",
            hazardFilter === "Çok Tehlikeli" && "ring-2 ring-red-500/70 bg-red-500/10"
          )}
          onClick={() => setHazardFilter("Çok Tehlikeli")}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {stats.veryHazardous}
            </div>
            <p className="text-xs text-slate-400">Çok Tehlikeli</p>
            {hazardFilter === "Çok Tehlikeli" && (
              <Badge className="mt-2 bg-red-600">Filtrelendi</Badge>
            )}
          </CardContent>
        </Card>
        
        <Card 
          className={cn(
            "cursor-pointer border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] shadow-[0_18px_45px_rgba(2,6,23,0.35)] transition-all hover:-translate-y-0.5 hover:border-orange-500/40 hover:shadow-[0_24px_60px_rgba(2,6,23,0.42)]",
            hazardFilter === "Tehlikeli" && "ring-2 ring-orange-500/70 bg-orange-500/10"
          )}
          onClick={() => setHazardFilter("Tehlikeli")}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {stats.hazardous}
            </div>
            <p className="text-xs text-slate-400">Tehlikeli</p>
            {hazardFilter === "Tehlikeli" && (
              <Badge className="mt-2 bg-orange-600">Filtrelendi</Badge>
            )}
          </CardContent>
        </Card>
        
        <Card 
          className={cn(
            "cursor-pointer border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] shadow-[0_18px_45px_rgba(2,6,23,0.35)] transition-all hover:-translate-y-0.5 hover:border-green-500/40 hover:shadow-[0_24px_60px_rgba(2,6,23,0.42)]",
            hazardFilter === "Az Tehlikeli" && "ring-2 ring-green-500/70 bg-green-500/10"
          )}
          onClick={() => setHazardFilter("Az Tehlikeli")}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {stats.lessHazardous}
            </div>
            <p className="text-xs text-slate-400">Az Tehlikeli</p>
            {hazardFilter === "Az Tehlikeli" && (
              <Badge className="mt-2 bg-green-600">Filtrelendi</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Firma adı, vergi no veya NACE kodu ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-2xl border-white/10 bg-slate-950/70 pl-10 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        {hazardFilter && (
          <Button 
            variant="outline" 
            className="h-12 gap-2 rounded-2xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
            onClick={() => setHazardFilter(null)}
          >
            <X className="h-4 w-4" />
            Filtreyi Kaldır
          </Button>
        )}
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          {!runtimeMode.safeMode ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCompanyViewMode("table")}
              className={cn(
                "h-10 rounded-xl px-3 text-slate-300 hover:bg-white/[0.08] hover:text-white",
                companyViewMode === "table" && "bg-cyan-500/10 text-cyan-100"
              )}
            >
              <Rows3 className="mr-2 h-4 w-4" />
              Tablo
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCompanyViewMode("cards")}
            className={cn(
              "h-10 rounded-xl px-3 text-slate-300 hover:bg-white/[0.08] hover:text-white",
              companyViewMode === "cards" && "bg-cyan-500/10 text-cyan-100"
            )}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            Kartlar
          </Button>
        </div>
      </div>
      {runtimeMode.lowDataMode && filteredCompanies.length > displayedCompanies.length && (
        <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
          Düşük veri modu nedeniyle ilk etapta {displayedCompanies.length} firma gösteriliyor.
          <Button variant="link" className="ml-2 h-auto p-0 text-amber-200" onClick={() => setShowAllCompanies(true)}>
            Tümünü yükle
          </Button>
        </div>
      )}

      {/* Companies Table */}
      <Card className="overflow-hidden border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.9))] shadow-[0_24px_60px_rgba(2,6,23,0.38)]">
        <CardHeader>
          <CardTitle className="text-white">Firmalar ({displayedCompanies.length}{displayedCompanies.length !== filteredCompanies.length ? ` / ${filteredCompanies.length}` : ""})</CardTitle>
          <CardDescription className="text-slate-400">
            {hazardFilter 
              ? `${hazardFilter} sınıfındaki firmalar` 
              : "Kayıtlı firmalarınızın listesi"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
            </div>
          ) : displayedCompanies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-slate-400">
                {hazardFilter 
                  ? `${hazardFilter} sınıfında firma bulunamadı` 
                  : "Henüz firma eklenmemiş"
                }
              </p>
            </div>
          ) : companyViewMode === "table" ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300">Firma Ünvanı</TableHead>
                  <TableHead className="text-slate-300">Vergi No</TableHead>
                  <TableHead className="text-slate-300">NACE</TableHead>
                  <TableHead className="text-slate-300">Tehlike Sınıfı</TableHead>
                  <TableHead className="text-slate-300">Çalışan</TableHead>
                  <TableHead className="text-slate-300">Şehir</TableHead>
                  <TableHead className="text-right text-slate-300">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedCompanies.map((company) => (
                  <TableRow
                    key={company.id}
                    data-company-row
                    className="border-white/10 hover:bg-white/[0.04]"
                  >
                    <TableCell className="font-semibold text-white">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-200">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-white">{company.company_name}</p>
                          <p className="text-xs text-slate-500">{company.industry_sector || "Sektör bilgisi yok"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {company.tax_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-slate-200">{company.nace_code}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        company.hazard_class === "Çok Tehlikeli"
                          ? "bg-red-500/15 text-red-200 border-red-400/20"
                          : company.hazard_class === "Tehlikeli"
                          ? "bg-orange-500/15 text-orange-200 border-orange-400/20"
                          : "bg-green-500/15 text-green-200 border-green-400/20"
                      }>
                        {company.hazard_class}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-slate-200">
                        <Users className="h-3 w-3" />
                        {company.employee_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{company.city || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleViewCompany(company.id)}
                          className="hover:bg-blue-500/10 hover:text-blue-500"
                          title="Görüntüle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleEditCompany(company)}
                          className="hover:bg-yellow-500/10 hover:text-yellow-500"
                          title="Düzenle"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleDeleteCompany(company.id, company.company_name)}
                          className="text-destructive hover:bg-red-500/10"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {displayedCompanies.map((company) => {
                const companyRisk = getCompanyRiskSummary(company);
                const companyWorkflow = getCompanyWorkflowBadges(company);

                return (
                  <div
                    key={company.id}
                    data-company-card
                    className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.32)] transition-all hover:-translate-y-0.5 hover:border-cyan-400/20 hover:shadow-[0_24px_60px_rgba(2,6,23,0.4)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 uppercase tracking-[0.18em]">
                            Portföy kartı
                          </span>
                          <span>
                            Son güncelleme{" "}
                            {new Date(((company as any).updated_at || (company as any).created_at || Date.now()) as string).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                          <span>
                            Oluşturulma{" "}
                            {new Date(((company as any).created_at || Date.now()) as string).toLocaleDateString("tr-TR")}
                          </span>
                          <span>
                            Son düzenleyen{" "}
                            {(company as any).updated_by_name || "Sistem"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                            {company.logo_url ? (
                              <img src={company.logo_url} alt={company.company_name} className="h-8 w-8 rounded-xl object-contain" />
                            ) : (
                              <Building2 className="h-5 w-5 text-cyan-200" />
                            )}
                          </div>
                          <div>
                            <p className="text-base font-bold text-white">{company.company_name}</p>
                            <p className="mt-1 text-xs text-slate-500">{company.industry_sector || "Sektör bilgisi yok"}</p>
                          </div>
                        </div>
                      </div>
                      <Badge className={cn("border", companyRisk.tone)}>{company.hazard_class}</Badge>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">NACE</p>
                        <p className="mt-2 text-sm font-semibold text-slate-100">{company.nace_code || "—"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Çalışan</p>
                        <p className="mt-2 text-sm font-semibold text-slate-100">{company.employee_count || 0}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className={cn("rounded-full border cursor-default", companyWorkflow.template.className)}>
                              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                              {companyWorkflow.template.label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="border-white/10 bg-slate-950 text-slate-100">
                            Sektör ve NACE bilgisine göre risk şablonu eşleşme durumunu gösterir.
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className={cn("rounded-full border cursor-default", companyWorkflow.employee.className)}>
                              <Users className="mr-1.5 h-3.5 w-3.5" />
                              {companyWorkflow.employee.label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="border-white/10 bg-slate-950 text-slate-100">
                            Firma için çalışan yükleme akışının tamamlanma seviyesini gösterir.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className={cn("mt-4 rounded-2xl border p-3", companyRisk.tone)}>
                      <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">Firma Risk Özeti</p>
                      <p className="mt-2 text-sm font-semibold">{companyRisk.summary}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{companyRisk.action}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                      <span>{company.city || "Şehir bilgisi yok"}</span>
                      <span>{company.phone || "Telefon bilgisi yok"}</span>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => handleViewCompany(company.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Görüntüle
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => handleEditCompany(company)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/10" onClick={() => handleDeleteCompany(company.id, company.company_name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      </RouteErrorBoundary>
      )}

      {/* View Modal */}
      {viewingCompany && (
        <RouteErrorBoundary routeKey="companies:view-modal" componentName="CompanyManagerViewModal">
        <Dialog open={!!viewingCompany} onOpenChange={() => setViewingCompany(null)}>
          <DialogContent className="max-w-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_28px_90px_rgba(2,6,23,0.55)]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <Building2 className="h-5 w-5 text-cyan-300" />
                {viewingCompany.company_name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {(() => {
                const companyRisk = getCompanyRiskSummary(viewingCompany);
                const tabCounts = getCompanyTabCounts(viewingCompany);
                return (
                  <Tabs defaultValue="logo" className="space-y-4">
                    <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                      <TabsTrigger value="logo" className={cn("group rounded-xl data-[state=active]:text-cyan-50", tabCounts.logo === 0 ? "data-[state=active]:bg-amber-500/12 text-amber-100" : "data-[state=active]:bg-cyan-500/12")}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" />
                          Logo
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-slate-300 transition-colors group-data-[state=active]:border-cyan-400/25 group-data-[state=active]:bg-cyan-500/15 group-data-[state=active]:text-cyan-50">
                            {tabCounts.logo}
                          </span>
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="iletisim" className={cn("group rounded-xl data-[state=active]:text-cyan-50", tabCounts.contact === 0 ? "data-[state=active]:bg-amber-500/12 text-amber-100" : "data-[state=active]:bg-cyan-500/12")}>
                        <span className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          İletişim
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-slate-300 transition-colors group-data-[state=active]:border-cyan-400/25 group-data-[state=active]:bg-cyan-500/15 group-data-[state=active]:text-cyan-50">
                            {tabCounts.contact}
                          </span>
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="risk" className={cn("group rounded-xl data-[state=active]:text-cyan-50", tabCounts.risk === 0 ? "data-[state=active]:bg-amber-500/12 text-amber-100" : "data-[state=active]:bg-cyan-500/12")}>
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Risk
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-slate-300 transition-colors group-data-[state=active]:border-cyan-400/25 group-data-[state=active]:bg-cyan-500/15 group-data-[state=active]:text-cyan-50">
                            {tabCounts.risk}
                          </span>
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="calisan" className={cn("group rounded-xl data-[state=active]:text-cyan-50", tabCounts.employee === 0 ? "data-[state=active]:bg-amber-500/12 text-amber-100" : "data-[state=active]:bg-cyan-500/12")}>
                        <span className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          Çalışan
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-slate-300 transition-colors group-data-[state=active]:border-cyan-400/25 group-data-[state=active]:bg-cyan-500/15 group-data-[state=active]:text-cyan-50">
                            {tabCounts.employee}
                          </span>
                        </span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="logo" className="mt-0">
                      <div className="grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.04] p-5 lg:grid-cols-[0.9fr_1.3fr]">
                        <div className="flex justify-center rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                          <div className="flex h-32 w-44 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                            {viewingCompany.logo_url ? (
                              <img src={viewingCompany.logo_url} alt="Firma logosu" className="max-h-full max-w-full object-contain" />
                            ) : (
                              <Building2 className="h-10 w-10 text-slate-600" />
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-slate-400">Vergi No</Label>
                              <p className="mt-1 font-mono font-semibold text-white">{viewingCompany.tax_number}</p>
                            </div>

                            <div>
                              <Label className="text-slate-400">NACE</Label>
                              <Badge variant="outline" className="mt-1 border-white/10 bg-white/[0.04] text-slate-200">{viewingCompany.nace_code}</Badge>
                            </div>

                            <div>
                              <Label className="text-slate-400">Sektör</Label>
                              <p className="mt-1 text-sm font-semibold text-white">{viewingCompany.industry_sector || "Henüz eşleşmedi"}</p>
                            </div>

                            <div>
                              <Label className="text-slate-400">Şehir</Label>
                              <p className="mt-1 text-sm font-semibold text-white">{viewingCompany.city || "Belirtilmedi"}</p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">Kurumsal Kimlik</p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              Logo, şirket adı ve NACE kaydıyla birlikte firma kartı operasyon merkezinde hazır. İsterseniz aynı akıştan kurumsal belge ve çalışan yapısını ilerletebilirsiniz.
                            </p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="iletisim" className="mt-0">
                      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Adres</p>
                            <div className="mt-3 flex items-start gap-3 text-sm text-slate-200">
                              <MapPin className="mt-0.5 h-4 w-4 text-cyan-300" />
                              <span>{viewingCompany.address || "Adres bilgisi bulunmuyor."}</span>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Telefon</p>
                              <div className="mt-3 flex items-center gap-3 text-sm text-slate-200">
                                <Phone className="h-4 w-4 text-cyan-300" />
                                <span className="font-mono">{viewingCompany.phone || "Telefon bilgisi bulunmuyor."}</span>
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">E-posta</p>
                              <div className="mt-3 flex items-center gap-3 text-sm text-slate-200">
                                <Mail className="h-4 w-4 text-cyan-300" />
                                <span>{viewingCompany.email || "E-posta bilgisi bulunmuyor."}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="risk" className="mt-0">
                      <div className="space-y-4 rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Tehlike Sınıfı</p>
                            <Badge className={cn(
                              "mt-3",
                              viewingCompany.hazard_class === "Çok Tehlikeli" && "bg-red-500/15 text-red-200 border-red-400/20",
                              viewingCompany.hazard_class === "Tehlikeli" && "bg-orange-500/15 text-orange-200 border-orange-400/20",
                              viewingCompany.hazard_class === "Az Tehlikeli" && "bg-green-500/15 text-green-200 border-green-400/20"
                            )}>
                              {viewingCompany.hazard_class}
                            </Badge>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Risk Şablonu</p>
                            <p className="mt-3 text-sm font-semibold text-white">
                              {resolveSectorTemplateValue(viewingCompany.industry_sector) ? "Sektörle eşleşti" : "Henüz seçilmedi"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Operasyon Ritmi</p>
                            <p className="mt-3 text-sm font-semibold text-white">{companyRisk.summary}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">Portföy Özeti</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            Firma kaydı, tehlike sınıfı, NACE eşleşmesi ve çalışan kapasitesiyle birlikte operasyona hazır durumda. Buradan düzenleme akışına geçebilir veya iletişim alanlarını doğrulayabilirsiniz.
                          </p>
                        </div>

                        <div className={cn("rounded-2xl border p-4", companyRisk.tone)}>
                          <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">Sonraki Önerilen Aksiyon</p>
                          <p className="mt-2 text-sm font-semibold">{companyRisk.summary}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-300">{companyRisk.action}</p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="calisan" className="mt-0">
                      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Çalışan Portföyü</p>
                            <p className="mt-2 text-sm text-slate-300">Aktif çalışan yükleme durumunu ve operasyona hazır listeyi inceleyin.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="border border-white/10 bg-white/[0.04] text-slate-200">
                              {loadingExistingEmployees ? "Yükleniyor" : `${existingEmployees.length} kayıt`}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-cyan-400/20 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/15"
                              onClick={() => {
                                const rawCompany = companies.find((company) => company.id === viewingCompany.id) || viewingCompany;
                                setViewingCompany(null);
                                handleEditCompany(rawCompany);
                                setCurrentStep(3);
                              }}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Çalışanları Yönet
                            </Button>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                          {loadingExistingEmployees
                            ? "Çalışan portföyü yükleniyor..."
                            : existingEmployees.length > 0
                            ? `${existingEmployees.length} aktif çalışan düzenleme akışına hazır.`
                            : "Henüz çalışan yüklenmemiş; Excel ile toplu yükleme başlatabilirsiniz."}
                        </p>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                              <Input
                                value={detailEmployeeSearchQuery}
                                onChange={(e) => setDetailEmployeeSearchQuery(e.target.value)}
                                placeholder="Çalışan adı, görev veya departman ara..."
                                className="h-11 rounded-2xl border-white/10 bg-white/[0.04] pl-10 text-slate-100 placeholder:text-slate-500"
                              />
                            </div>
                            <select
                              value={detailEmployeeDepartmentFilter}
                              onChange={(e) => setDetailEmployeeDepartmentFilter(e.target.value)}
                              className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 outline-none"
                            >
                              <option value="all">Tüm departmanlar</option>
                              {employeeDepartments.map((department) => (
                                <option key={department} value={department}>
                                  {department}
                                </option>
                              ))}
                            </select>
                          </div>
                          {loadingExistingEmployees ? (
                            <div className="space-y-3">
                              {[0, 1, 2].map((item) => (
                                <div key={item} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
                              ))}
                            </div>
                          ) : existingEmployees.length === 0 ? (
                            <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/5 p-4 text-sm text-slate-300">
                              Henüz çalışan yüklenmemiş. Şirket kartını düzenleyerek Excel ile personel yükleme akışını tamamlayabilirsiniz.
                            </div>
                          ) : filteredDetailEmployees.length === 0 ? (
                            <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4 text-sm text-slate-300">
                              Aramanıza uyan çalışan bulunamadı. Farklı bir isim, görev veya departman deneyin.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filteredDetailEmployees.slice(0, 5).map((employee) => (
                                <div key={employee.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{employee.first_name} {employee.last_name}</p>
                                    <p className="text-xs text-slate-500">{employee.job_title} · {employee.department || "Departman belirtilmedi"}</p>
                                  </div>
                                  <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-100">Aktif</Badge>
                                </div>
                              ))}
                              {filteredDetailEmployees.length > 5 && (
                                <p className="text-xs text-slate-500">+ {filteredDetailEmployees.length - 5} çalışan daha listede yer alıyor.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                );
              })()}

              <div className="flex gap-2 border-t border-white/10 pt-4">
                <Button className="rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 text-white hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-400" onClick={() => {
                  const rawCompany = companies.find((company) => company.id === viewingCompany.id) || viewingCompany;
                  setViewingCompany(null);
                  handleEditCompany(rawCompany);
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Düzenle
                </Button>
                <Button variant="outline" className="rounded-2xl border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => setViewingCompany(null)}>
                  Kapat
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </RouteErrorBoundary>
      )}
    </div>    
  );
}

