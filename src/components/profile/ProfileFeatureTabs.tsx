import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Download,
  Edit2,
  FileText,
  GraduationCap,
  MapPin,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ProfileMetricCard } from "./ProfileMetricCard";
import SettingsPage from "@/pages/Settings";
import { cn } from "@/lib/utils";
import { parseStorageObjectRef } from "@/lib/storageObject";
import { useSubscription } from "@/hooks/useSubscription";

type CompanyRow = {
  id: string;
  name: string;
  sgk_number?: string | null;
  email?: string | null;
  address?: string | null;
  branch_name?: string | null;
  employee_count?: number | null;
  hazard_class?: string | null;
  city?: string | null;
  visit_frequency?: string | null;
  used_minutes?: number | null;
  employer_representative_name?: string | null;
  occupational_safety_specialist_name?: string | null;
  workplace_doctor_name?: string | null;
  employee_representative_name?: string | null;
  knowledgeable_employee_name?: string | null;
};

type EmployeeRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  tc_number?: string | null;
  phone?: string | null;
  email?: string | null;
  start_date?: string | null;
  is_active?: boolean | null;
};

type GenericRecord = Record<string, any>;

const db = supabase as any;

const emptyText = "Henüz kayıt yok";

function getFriendlyEmployeeError(error: unknown) {
  const source = error && typeof error === "object" ? error as { code?: string; message?: string; details?: string } : {};
  const message = String(source.message || source.details || error || "").toLocaleLowerCase("tr-TR");

  if (source.code === "23502" || message.includes("not-null constraint") || message.includes("null value in column")) {
    if (message.includes("company_id")) return "Çalışanların ekleneceği firma bulunamadı. Lütfen firma seçimini kontrol edin.";
    if (message.includes("first_name") || message.includes("last_name") || message.includes("full_name")) return "Bazı çalışanlarda ad soyad bilgisi eksik. Lütfen Excel dosyasını kontrol edin.";
    if (message.includes("job_title")) return "Bazı çalışanlarda görev/pozisyon bilgisi eksik. Lütfen görev alanını doldurun.";
    if (message.includes("start_date")) return "İşe giriş tarihi artık zorunlu değil; veritabanı migration'ının uygulandığından emin olun.";
    return "Bazı zorunlu çalışan bilgileri eksik. Lütfen dosyadaki satırları kontrol edin.";
  }

  if (source.code === "23505" || message.includes("duplicate key") || message.includes("unique constraint")) {
    return "Aynı T.C. kimlik numarasına sahip çalışan bu firmada zaten kayıtlı. Lütfen mükerrer satırları kontrol edin.";
  }

  if (message.includes("on conflict")) {
    return "Çalışan eşleştirme kuralı veritabanında hazır değil. Lütfen ilgili unique index migration'ının uygulandığından emin olun.";
  }

  if (source.code === "23503" || message.includes("foreign key")) {
    return "Seçilen firma veya bağlantılı kayıt bulunamadı. Lütfen firmayı yeniden seçip tekrar deneyin.";
  }

  if (source.code === "42501" || message.includes("row-level security") || message.includes("permission")) {
    return "Bu çalışanları kaydetmek için yetkiniz doğrulanamadı. Lütfen oturumunuzu ve firma erişiminizi kontrol edin.";
  }

  if (message.includes("invalid input syntax") || message.includes("invalid date")) {
    return "Dosyada geçersiz tarih veya veri formatı var. Lütfen tarihleri gg.aa.yyyy ya da yyyy-aa-gg formatında kontrol edin.";
  }

  return "Çalışan kayıtları kaydedilemedi. Lütfen dosyadaki bilgileri kontrol edip tekrar deneyin.";
}

type SavedRiskItem = {
  id: string;
  category?: string | null;
  activity?: string | null;
  hazard_source?: string | null;
  risk_description?: string | null;
  current_measures?: string | null;
  probability?: number | null;
  severity?: number | null;
  risk_score?: number | null;
  risk_level?: string | null;
  additional_measures?: string | null;
  created_at?: string | null;
};

type RiskFormState = {
  category: string;
  subCategory: string;
  source: string;
  hazard: string;
  risk: string;
  affected: string;
  controls: string;
  probabilityBefore: string;
  frequencyBefore: string;
  severityBefore: string;
  probabilityAfter: string;
  frequencyAfter: string;
  severityAfter: string;
};

type BulkEmployeePreviewRow = {
  id: string;
  tcNo: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  startDate: string;
  department: string;
  jobTitle: string;
  insuredJobName: string;
  periodicExamDate: string;
};

const emptyRiskForm: RiskFormState = {
  category: "",
  subCategory: "",
  source: "",
  hazard: "",
  risk: "",
  affected: "Çalışanlar",
  controls: "",
  probabilityBefore: "1",
  frequencyBefore: "1",
  severityBefore: "1",
  probabilityAfter: "1",
  frequencyAfter: "1",
  severityAfter: "1",
};

const emptyBulkEmployeeRows: BulkEmployeePreviewRow[] = [
  
];

function toPositiveNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 1;
}

function getRiskLevel(score?: number | null) {
  if (!score) return "Düşük";
  if (score <= 4) return "Düşük";
  if (score <= 9) return "Orta";
  if (score <= 15) return "Yüksek";
  return "Çok Yüksek";
}

function parseSpreadsheetDate(value: unknown) {
  if (!value) return "";
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return excelEpoch.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const dotMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function formatPreviewDate(value: string) {
  if (!value) return "gg.aa.yyyy";
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return isoMatch ? `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}` : value;
}

function normalizeSpreadsheetHeader(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

function getSpreadsheetValue(row: GenericRecord, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeSpreadsheetHeader));
  const entry = Object.entries(row).find(([key]) => aliasSet.has(normalizeSpreadsheetHeader(key)));
  return entry?.[1] ?? "";
}

async function safeCount(table: string, filters?: (query: any) => any) {
  try {
    let query = db.from(table).select("id", { count: "exact", head: true });
    if (filters) query = filters(query);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.warn(`[Profile] ${table} sayısı alınamadı`, error);
    return 0;
  }
}

async function safeRows<T>(table: string, select = "*", limit = 50, filters?: (query: any) => any): Promise<T[]> {
  try {
    let query = db.from(table).select(select).limit(limit);
    if (filters) query = filters(query);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as T[];
  } catch (error) {
    console.warn(`[Profile] ${table} verisi alınamadı`, error);
    return [];
  }
}

function fullEmployeeName(employee: EmployeeRow) {
  return employee.full_name || [employee.first_name, employee.last_name].filter(Boolean).join(" ") || "İsimsiz çalışan";
}

async function loadCompanyById(companyId: string): Promise<CompanyRow | null> {
  try {
    const { data, error } = await db.from("companies").select("*").eq("id", companyId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: String(data.id),
      name: String(data.name || data.company_name || "İsimsiz firma"),
      sgk_number: data.sgk_number || data.sgk_workplace_number || data.workplace_registration_number || null,
      email: data.email || null,
      address: data.address || null,
      branch_name: data.branch_name || data.tracking_name || null,
      employee_count: typeof data.employee_count === "number" ? data.employee_count : null,
      hazard_class: data.hazard_class || null,
      city: data.city || null,
      visit_frequency: data.visit_frequency || null,
      used_minutes: typeof data.used_minutes === "number" ? data.used_minutes : null,
      employer_representative_name: data.employer_representative_name || null,
      occupational_safety_specialist_name: data.occupational_safety_specialist_name || null,
      workplace_doctor_name: data.workplace_doctor_name || null,
      employee_representative_name: data.employee_representative_name || null,
      knowledgeable_employee_name: data.knowledgeable_employee_name || null,
    };
  } catch (error) {
    console.warn("[Profile] çalışan firması alınamadı", error);
    return null;
  }
}

async function loadProfileCompanies(orgId?: string | null, userId?: string | null, limit = 250): Promise<CompanyRow[]> {
  const run = async (filter?: (query: any) => any) => {
    try {
      let query = db.from("companies").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(limit);
      if (filter) query = filter(query);
      const { data, error } = await query;
      if (error) throw error;
      return ((data || []) as GenericRecord[]).map((row) => ({
        id: String(row.id),
        name: String(row.name || row.company_name || "İsimsiz firma"),
        sgk_number: row.sgk_number || row.sgk_workplace_number || row.workplace_registration_number || null,
        email: row.email || null,
        address: row.address || null,
        branch_name: row.branch_name || row.tracking_name || null,
        employee_count: typeof row.employee_count === "number" ? row.employee_count : null,
        hazard_class: row.hazard_class || null,
        city: row.city || null,
        visit_frequency: row.visit_frequency || null,
        used_minutes: typeof row.used_minutes === "number" ? row.used_minutes : null,
        employer_representative_name: row.employer_representative_name || null,
        occupational_safety_specialist_name: row.occupational_safety_specialist_name || null,
        workplace_doctor_name: row.workplace_doctor_name || null,
        employee_representative_name: row.employee_representative_name || null,
        knowledgeable_employee_name: row.knowledgeable_employee_name || null,
      }));
    } catch (error) {
      console.warn("[Profile] firma listesi alınamadı", error);
      return [];
    }
  };

  if (orgId) {
    const organizationRows = await run((query) => query.eq("organization_id", orgId));
    if (organizationRows.length > 0) return organizationRows;
  }

  if (userId) {
    const userRows = await run((query) => query.eq("user_id", userId));
    if (userRows.length > 0) return userRows;
  }

  return run();
}

async function loadProfileEmployees(limit = 300): Promise<EmployeeRow[]> {
  try {
    const { data, error } = await db
      .from("employees")
      .select("id,first_name,last_name,full_name,company_id,job_title,department,tc_number,phone,email,start_date,is_active")
      .eq("is_active", true)
      .order("first_name", { ascending: true })
      .limit(limit);
    if (error) throw error;

    const employees = (data || []) as EmployeeRow[];
    const companyIds = Array.from(new Set(employees.map((employee) => employee.company_id).filter(Boolean)));
    if (companyIds.length === 0) return employees;

    const { data: companies } = await db.from("companies").select("id,name").in("id", companyIds);
    const companyMap = new Map<string, string>((companies || []).map((row: { id: string; name: string }) => [row.id, row.name]));
    return employees.map((employee) => ({
      ...employee,
      company_name: employee.company_id ? companyMap.get(employee.company_id) || null : null,
    }));
  } catch (error) {
    console.warn("[Profile] çalışan listesi alınamadı", error);
    return [];
  }
}

function PanelShell({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-slate-800 bg-slate-950/80 text-slate-100 shadow-sm">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-xl font-black text-white">{title}</CardTitle>
          <CardDescription className="mt-1 text-slate-400">{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">{children}</div>;
}

function EmptyState({ title = emptyText, description }: { title?: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
      <Archive className="mx-auto h-10 w-10 text-slate-500" />
      <p className="mt-4 text-sm font-bold text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function ProfileOverview() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    companies: 0,
    employees: 0,
    capa: 0,
    controls: 0,
    meetings: 0,
    reports: 0,
    trainings: 0,
    documents: 0,
  });
  const [recentCompanies, setRecentCompanies] = useState<CompanyRow[]>([]);
  const [recentEmployees, setRecentEmployees] = useState<EmployeeRow[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const orgId = profile?.organization_id;
      const userId = user?.id;
      const userFilter = (query: any) => (userId ? query.eq("user_id", userId) : query);

      const [companyRows, employeeRows, capa, controls, meetings, reports, trainings, documents] =
        await Promise.all([
          loadProfileCompanies(orgId, userId, 1000),
          loadProfileEmployees(1000),
          safeCount("capa_records", userFilter),
          safeCount("periodic_controls", userFilter),
          safeCount("board_meetings", userFilter),
          safeCount("reports", userFilter),
          safeCount("trainings", userFilter),
          safeCount("company_documents", userFilter),
        ]);

      if (!active) return;
      setStats({ companies: companyRows.length, employees: employeeRows.length, capa, controls, meetings, reports, trainings, documents });
      setRecentCompanies(companyRows.slice(0, 5));
      setRecentEmployees(employeeRows.slice(0, 5));
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [profile?.organization_id, user?.id]);

  const cards = [
    ["Aktif Firma", stats.companies, "Sistemde takip edilen firma", Building2, "border-cyan-400/20 bg-gradient-to-br from-cyan-600 to-blue-700"],
    ["Toplam Çalışan", stats.employees, "Firma çalışan kayıtları", Users, "border-emerald-400/20 bg-gradient-to-br from-emerald-600 to-teal-700"],
    ["Açık DÖF", stats.capa, "Takip edilen uygunsuzluk ve aksiyon", AlertTriangle, "border-rose-400/20 bg-gradient-to-br from-rose-600 to-red-700"],
    ["Yaklaşan Periyodik Kontrol", stats.controls, "Planlanan kontrol kayıtları", CalendarDays, "border-amber-400/20 bg-gradient-to-br from-amber-600 to-orange-700"],
    ["Taslak Kurul Toplantısı", stats.meetings, "Kurul toplantısı kayıtları", ShieldCheck, "border-violet-400/20 bg-gradient-to-br from-violet-600 to-purple-700"],
    ["Bu Ay Oluşturulan Rapor", stats.reports, "Rapor ve çıktı arşivi", ClipboardList, "border-sky-400/20 bg-gradient-to-br from-sky-600 to-blue-700"],
    ["Eğitim Bekleyen Çalışan", stats.trainings, "Eğitim kayıt merkezi", GraduationCap, "border-indigo-400/20 bg-gradient-to-br from-indigo-600 to-blue-700"],
    ["Açık Evrak / Belge", stats.documents, "Evrak takip matrisi", FileText, "border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-600 to-pink-700"],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([title, value, description, icon, tone]) => (
          <ProfileMetricCard key={title} title={title} value={loading ? "..." : value} description={description} icon={icon} tone={tone} />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <PanelShell title="Yapılacak Kritik İşler" description="Açık DÖF, yaklaşan kontrol ve eksik evraklar tek bakışta izlenir.">
          <div className="space-y-3 text-sm text-slate-300">
            {[
              ["Açık DÖF", stats.capa],
              ["Yaklaşan kontrol", stats.controls],
              ["Eksik evrak", stats.documents],
              ["Eğitim bekleyen çalışan", stats.trainings],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/30 p-3">
                <span>{label}</span>
                <Badge className="bg-slate-800 text-slate-100">{value}</Badge>
              </div>
            ))}
          </div>
        </PanelShell>
        <PanelShell title="Son Aktiviteler" description="Son eklenen firma ve çalışan kayıtları.">
          <div className="space-y-3">
            {recentCompanies.length === 0 && recentEmployees.length === 0 ? (
              <EmptyState description="İlk firmayı ekleyerek başlayın." />
            ) : (
              <>
                {recentCompanies.map((company) => (
                  <div key={company.id} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-sm">
                    <p className="font-bold text-white">Son firma: {company.name}</p>
                    <p className="text-slate-500">{company.city || "Şehir bilgisi yok"}</p>
                  </div>
                ))}
                {recentEmployees.map((employee) => (
                  <div key={employee.id} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-sm">
                    <p className="font-bold text-white">Son çalışan: {fullEmployeeName(employee)}</p>
                    <p className="text-slate-500">{employee.company_name || employee.job_title || "Firma bilgisi yok"}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </PanelShell>
      </div>
    </div>
  );
}

export function ProfileCompaniesTab() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"edit" | "assignments" | "employees" | "reports" | "documents">("edit");
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [companyEmployees, setCompanyEmployees] = useState<EmployeeRow[]>([]);
  const [bulkCompanyOpen, setBulkCompanyOpen] = useState(false);
  const [bulkCompanyUploading, setBulkCompanyUploading] = useState(false);
  const companyFileInputRef = useRef<HTMLInputElement | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    email: "",
    branch_name: "",
    address: "",
    sgk_number: "",
    employee_count: "0",
    hazard_class: "Az Tehlikeli",
    visit_frequency: "Ayda 1 Defa",
    employer_representative_name: "",
    occupational_safety_specialist_name: "",
    workplace_doctor_name: "",
    employee_representative_name: "",
    knowledgeable_employee_name: "",
  });

  const loadCompanies = () => {
    void loadProfileCompanies(profile?.organization_id, user?.id, 500).then((rows) =>
      setCompanies(rows.sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"))),
    );
  };

  useEffect(() => {
    loadCompanies();
  }, [profile?.organization_id, user?.id]);

  const filtered = companies.filter((company) => company.name?.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));

  const openCompanyDialog = (company?: CompanyRow) => {
    setEditingCompany(company || null);
    setDialogTab("edit");
    setCompanyForm({
      name: company?.name || "",
      email: company?.email || "",
      branch_name: company?.branch_name || "",
      address: company?.address || "",
      sgk_number: company?.sgk_number || "",
      employee_count: String(company?.employee_count ?? 0),
      hazard_class: company?.hazard_class || "Az Tehlikeli",
      visit_frequency: company?.visit_frequency || "Ayda 1 Defa",
      employer_representative_name: company?.employer_representative_name || "",
      occupational_safety_specialist_name: company?.occupational_safety_specialist_name || "",
      workplace_doctor_name: company?.workplace_doctor_name || "",
      employee_representative_name: company?.employee_representative_name || "",
      knowledgeable_employee_name: company?.knowledgeable_employee_name || "",
    });
    setDialogOpen(true);
    if (company?.id) {
      void loadProfileEmployees(1000).then((rows) => setCompanyEmployees(rows.filter((employee) => employee.company_id === company.id)));
    } else {
      setCompanyEmployees([]);
    }
  };

  const saveCompany = async () => {
    if (!companyForm.name.trim()) {
      toast.error("Firma ünvanı zorunludur.");
      return;
    }
    setSavingCompany(true);
    const payload = {
      name: companyForm.name.trim(),
      email: companyForm.email.trim() || null,
      address: companyForm.address.trim() || null,
      sgk_workplace_number: companyForm.sgk_number.trim() || null,
      workplace_registration_number: companyForm.sgk_number.trim() || null,
      employee_count: Number(companyForm.employee_count || 0),
      hazard_class: companyForm.hazard_class,
      visit_frequency: companyForm.visit_frequency,
      employer_representative_name: companyForm.employer_representative_name.trim() || null,
      occupational_safety_specialist_name: companyForm.occupational_safety_specialist_name.trim() || null,
      workplace_doctor_name: companyForm.workplace_doctor_name.trim() || null,
      employee_representative_name: companyForm.employee_representative_name.trim() || null,
      knowledgeable_employee_name: companyForm.knowledgeable_employee_name.trim() || null,
      user_id: user?.id,
      organization_id: profile?.organization_id || null,
      is_active: true,
    };

    try {
      const query = editingCompany
        ? db.from("companies").update(payload).eq("id", editingCompany.id)
        : db.from("companies").insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast.success(editingCompany ? "Firma güncellendi." : "Firma kaydedildi.");
      setDialogOpen(false);
      loadCompanies();
    } catch (error: any) {
      toast.error("Firma kaydedilemedi.", { description: error.message });
    } finally {
      setSavingCompany(false);
    }
  };

  const archiveCompany = async (company: CompanyRow) => {
    try {
      const { error } = await db.from("companies").update({ is_active: false }).eq("id", company.id);
      if (error) throw error;
      toast.success("Firma arşivlendi.");
      loadCompanies();
    } catch (error: any) {
      toast.error("Firma arşivlenemedi.", { description: error.message });
    }
  };

  const downloadCompanyTemplate = async () => {
    const XLSX = await import("xlsx");
    const rows = [
      {
        "Firma Ünvanı": "ABC İnşaat",
        "SGK Sicil No": "12345678901234567890123456",
        Adres: "Firma adresi",
        "E-Posta": "isletme@ornek.com",
        "Çalışan Sayısı": 10,
        "Tehlike Sınıfı": "Az Tehlikeli",
        "Ziyaret Sıklığı": "Ayda 1 Defa",
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Firmalar");
    XLSX.writeFile(workbook, "firma-toplu-yukleme-sablonu.xlsx");
  };

  const importCompanies = async (file?: File | null) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Sadece .xlsx veya .xls formatında dosya yükleyebilirsiniz.");
      return;
    }

    setBulkCompanyUploading(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : null;
      const rows = sheet ? XLSX.utils.sheet_to_json<GenericRecord>(sheet, { defval: "" }) : [];
      const existingNames = new Set(companies.map((company) => normalizeSpreadsheetHeader(company.name)));
      const existingSgk = new Set(companies.map((company) => String(company.sgk_number || "").replace(/\D/g, "")).filter(Boolean));
      const payload = rows
        .map((row) => {
          const name = String(getSpreadsheetValue(row, ["Firma Ünvanı", "Firma Unvani", "Firma Adı", "Firma Adi", "Firma", "name", "company_name"]) || "").trim();
          const sgkNumber = String(getSpreadsheetValue(row, ["SGK Sicil No", "SGK No", "İşyeri Sicil No", "Isyeri Sicil No", "sgk_number"]) || "").trim();
          if (!name) return null;
          const normalizedName = normalizeSpreadsheetHeader(name);
          const normalizedSgk = sgkNumber.replace(/\D/g, "");
          if (existingNames.has(normalizedName) || (normalizedSgk && existingSgk.has(normalizedSgk))) return null;
          existingNames.add(normalizedName);
          if (normalizedSgk) existingSgk.add(normalizedSgk);
          return {
            name,
            email: String(getSpreadsheetValue(row, ["E-Posta", "Eposta", "Email", "email"]) || "").trim() || null,
            address: String(getSpreadsheetValue(row, ["Adres", "address"]) || "").trim() || null,
            sgk_workplace_number: sgkNumber || null,
            workplace_registration_number: sgkNumber || null,
            employee_count: Number(getSpreadsheetValue(row, ["Çalışan Sayısı", "Calisan Sayisi", "Çalışan", "Calisan", "employee_count"]) || 0),
            hazard_class: String(getSpreadsheetValue(row, ["Tehlike Sınıfı", "Tehlike Sinifi", "hazard_class"]) || "Az Tehlikeli").trim(),
            visit_frequency: String(getSpreadsheetValue(row, ["Ziyaret Sıklığı", "Ziyaret Sikligi", "visit_frequency"]) || "Ayda 1 Defa").trim(),
            user_id: user?.id,
            organization_id: profile?.organization_id || null,
            is_active: true,
          };
        })
        .filter(Boolean);

      if (payload.length === 0) {
        toast.error("Yüklenecek yeni firma bulunamadı.");
        return;
      }

      const { error } = await db.from("companies").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} firma yüklendi.`);
      setBulkCompanyOpen(false);
      loadCompanies();
    } catch (error: any) {
      toast.error("Toplu firma yükleme başarısız.", { description: error.message });
    } finally {
      setBulkCompanyUploading(false);
      if (companyFileInputRef.current) companyFileInputRef.current.value = "";
    }
  };

  const dialogTabs = [
    { id: "edit" as const, label: "Düzenle", icon: Building2, tone: "data-[active=true]:bg-blue-600" },
    { id: "assignments" as const, label: "Atamalar", icon: Users, tone: "data-[active=true]:bg-fuchsia-600" },
    { id: "employees" as const, label: "Çalışanlar", icon: Users, tone: "data-[active=true]:bg-emerald-600" },
    { id: "reports" as const, label: "Raporlar", icon: FileText, tone: "data-[active=true]:bg-orange-500" },
    { id: "documents" as const, label: "Evrak Takip", icon: ClipboardList, tone: "data-[active=true]:bg-cyan-600" },
  ];

  return (
    <PanelShell
      title="Firmalar"
      description="Firma kayıtlarını tablo görünümünde izleyin, yeni firma ekleyin ve firma içi atama alanlarını yönetin."
      action={<Button onClick={() => openCompanyDialog()} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" />Ekle</Button>}
    >
      <Toolbar>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Firma ara..." className="h-10 rounded-xl border-slate-700 bg-slate-900 pl-10" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-slate-700 bg-slate-900">Tümü</Button>
          <Button variant="outline" className="rounded-xl border-slate-700 bg-slate-900">A-Z</Button>
        </div>
      </Toolbar>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setBulkCompanyOpen(true)} className="rounded-xl border-slate-800 bg-slate-900"><Upload className="mr-2 h-4 w-4" />Toplu Yükle</Button>
        <p className="text-xs text-slate-500">Firmaların üzerine tıklayarak ayrıntılara ulaşabilirsiniz.</p>
      </div>
      {filtered.length === 0 ? (
        <EmptyState description="Firma eklemek için Ekle butonunu kullanın." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded border-slate-700 bg-slate-900" /></th>
                {["Firma Adı", "SGK Sicil No", "Çalışan", "Kullanılan Dk.", "Tehlike Sınıfı", "İşlemler"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-bold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((company) => (
                <tr key={company.id} className="cursor-pointer bg-slate-950/40 text-slate-200 hover:bg-slate-900/60" onClick={() => openCompanyDialog(company)}>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" className="rounded border-slate-700 bg-slate-900" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/20 text-blue-300"><Building2 className="h-4 w-4" /></span>
                      <span className="font-bold">{company.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{company.sgk_number || "-"}</td>
                  <td className="px-4 py-3">{company.employee_count ?? "-"}</td>
                  <td className="px-4 py-3"><span className="font-bold text-violet-300">{company.used_minutes ?? 0} dk.</span></td>
                  <td className="px-4 py-3"><Badge className="bg-emerald-500/10 text-emerald-300">{company.hazard_class || "Az Tehlikeli"}</Badge></td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openCompanyDialog(company)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => archiveCompany(company)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={bulkCompanyOpen} onOpenChange={setBulkCompanyOpen}>
        <DialogContent className="w-[calc(100vw-24px)] overflow-hidden border-slate-700 bg-slate-900 p-0 text-slate-100 sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-700 px-4 py-4">
            <DialogTitle className="flex items-center gap-3">
              <span className="text-emerald-300"><Building2 className="h-5 w-5" /></span>
              <span>Toplu Firma Yükle<span className="block text-sm font-normal text-slate-400">Excel dosyasından birden fazla firma ekleyin</span></span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-4 py-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
              İsgkatip Platformundan Dışa Aktarılan Belgelerinizi Yükleyebilirsiniz (Adres Bilgisini Manuel Girmelisiniz)
            </div>
            <div className="grid gap-3 sm:grid-cols-[164px_1fr]">
              <Button type="button" variant="outline" onClick={() => void downloadCompanyTemplate()} className="h-11 rounded-lg border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800">
                Şablon Excel İndir
              </Button>
              <Button type="button" onClick={() => companyFileInputRef.current?.click()} className="h-11 rounded-lg border border-dashed border-emerald-500 bg-transparent text-emerald-300 hover:bg-emerald-500/10">
                <Upload className="mr-2 h-4 w-4" />
                Excel Dosyası Seç
              </Button>
              <input ref={companyFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void importCompanies(event.target.files?.[0])} />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 border-t border-slate-700 px-4 py-4 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setBulkCompanyOpen(false)} disabled={bulkCompanyUploading} className="h-11 rounded-lg border-slate-600 bg-slate-700 text-white hover:bg-slate-600">
              İptal
            </Button>
            <Button type="button" onClick={() => companyFileInputRef.current?.click()} disabled={bulkCompanyUploading} className="h-11 rounded-lg bg-emerald-700 text-emerald-50 hover:bg-emerald-600">
              <Upload className="mr-2 h-4 w-4" />
              {bulkCompanyUploading ? "Yükleniyor..." : "Firmaları Yükle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto border-slate-700 bg-slate-900 text-slate-100 sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingCompany ? "Firma Düzenle" : "Firma Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 p-1">
            {dialogTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-active={dialogTab === tab.id}
                  onClick={() => setDialogTab(tab.id)}
                  className={`flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-bold text-slate-300 transition data-[active=true]:text-white ${tab.tone}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          {dialogTab === "edit" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <div className="flex items-center gap-3">
                  <button type="button" className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-400"><Upload className="h-5 w-5" /></button>
                  <div>
                    <p className="text-sm font-bold text-white">Firma Logosu</p>
                    <p className="text-xs text-slate-400">PNG, JPG (max 1MB)</p>
                  </div>
                </div>
                <div>
                  <Label>E-Posta</Label>
                  <Input value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} placeholder="isletme@ornek.com" className="mt-2 rounded-xl border-slate-700 bg-slate-800" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div><Label>Firma Ünvanı *</Label><Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="Örn: ABC Sanayi Ltd. Şti." className="mt-2 rounded-xl border-slate-700 bg-slate-800" /></div>
                <div><Label>Takma Ad <span className="text-xs text-slate-500">(max 15)</span></Label><Input maxLength={15} value={companyForm.branch_name} onChange={(e) => setCompanyForm({ ...companyForm, branch_name: e.target.value })} placeholder="Örn: Şube 1" className="mt-2 rounded-xl border-slate-700 bg-slate-800" /></div>
              </div>
              <div><Label>Adres</Label><Input value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} placeholder="Firma adresi..." className="mt-2 rounded-xl border-slate-700 bg-slate-800" /></div>
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div><Label>SGK Sicil No</Label><Input value={companyForm.sgk_number} onChange={(e) => setCompanyForm({ ...companyForm, sgk_number: e.target.value })} placeholder="Sadece rakam giriniz" className="mt-2 rounded-xl border-slate-700 bg-slate-800" /></div>
                <div><Label>Çalışan Sayısı</Label><Input type="number" value={companyForm.employee_count} onChange={(e) => setCompanyForm({ ...companyForm, employee_count: e.target.value })} className="mt-2 rounded-xl border-slate-700 bg-slate-800" /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Tehlike Sınıfı *</Label><Select value={companyForm.hazard_class} onValueChange={(value) => setCompanyForm({ ...companyForm, hazard_class: value })}><SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-800"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Az Tehlikeli">Az Tehlikeli</SelectItem><SelectItem value="Tehlikeli">Tehlikeli</SelectItem><SelectItem value="Çok Tehlikeli">Çok Tehlikeli</SelectItem></SelectContent></Select></div>
                <div><Label>Ziyaret Sıklığı</Label><Select value={companyForm.visit_frequency} onValueChange={(value) => setCompanyForm({ ...companyForm, visit_frequency: value })}><SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-800"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ayda 1 Defa">Ayda 1 Defa</SelectItem><SelectItem value="Ayda 2 Defa">Ayda 2 Defa</SelectItem><SelectItem value="3 Ayda 1 Defa">3 Ayda 1 Defa</SelectItem><SelectItem value="Yılda 1 Defa">Yılda 1 Defa</SelectItem></SelectContent></Select></div>
              </div>
            </div>
          ) : dialogTab === "assignments" ? (
            <div className="space-y-5">
              <div>
                <p className="border-l-4 border-blue-500 pl-3 text-sm font-black text-white">Risk Değerlendirme Ekibi</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Input placeholder="İşveren / Vekili" value={companyForm.employer_representative_name} onChange={(e) => setCompanyForm({ ...companyForm, employer_representative_name: e.target.value })} />
                  <Input placeholder="İş Güvenliği Uzmanı" value={companyForm.occupational_safety_specialist_name} onChange={(e) => setCompanyForm({ ...companyForm, occupational_safety_specialist_name: e.target.value })} />
                  <Input placeholder="İşyeri Hekimi" value={companyForm.workplace_doctor_name} onChange={(e) => setCompanyForm({ ...companyForm, workplace_doctor_name: e.target.value })} />
                  <Input placeholder="Çalışan Temsilcisi" value={companyForm.employee_representative_name} onChange={(e) => setCompanyForm({ ...companyForm, employee_representative_name: e.target.value })} />
                </div>
              </div>
              <div>
                <p className="border-l-4 border-emerald-500 pl-3 text-sm font-black text-white">Destek Elemanları Atamaları</p>
                <div className="mt-4 rounded-2xl border border-slate-700 p-4 text-center text-sm font-semibold text-amber-300">
                  Destek elemanları ataması yapmak için firma kaydedilmiş olmalıdır. Lütfen önce formun altındaki “Kaydet” butonuna tıklayarak firmayı kaydedin.
                </div>
              </div>
            </div>
          ) : dialogTab === "employees" ? (
            editingCompany ? (
              <div className="space-y-3">
                {companyEmployees.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700 p-6 text-center text-sm font-semibold text-slate-400">
                    Bu firmaya kayıtlı çalışan bulunamadı.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-700">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          {["Çalışan", "Görev", "Departman", "Telefon", "Durum"].map((head) => (
                            <th key={head} className="px-4 py-3 text-left font-bold">{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {companyEmployees.map((employee) => (
                          <tr key={employee.id} className="bg-slate-900/30">
                            <td className="px-4 py-3 font-bold text-white">{fullEmployeeName(employee)}</td>
                            <td className="px-4 py-3 text-slate-300">{employee.job_title || "-"}</td>
                            <td className="px-4 py-3 text-slate-300">{employee.department || "-"}</td>
                            <td className="px-4 py-3 text-slate-300">{employee.phone || "-"}</td>
                            <td className="px-4 py-3"><Badge className={employee.is_active === false ? "bg-slate-500/10 text-slate-300" : "bg-emerald-500/10 text-emerald-300"}>{employee.is_active === false ? "Pasif" : "Aktif"}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700 p-6 text-center text-sm font-semibold text-amber-300">
                Çalışan listesini görmek için firma kaydedilmiş olmalıdır. Lütfen önce firmayı kaydedin.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-slate-700 p-6 text-center text-sm font-semibold text-amber-300">
              {dialogTab === "reports" && "Raporları görmek için firma kaydedilmiş olmalıdır. Lütfen önce firmayı kaydedin."}
              {dialogTab === "documents" && "Önce firmayı kaydedin, evrak takibi için firma kimliği gereklidir."}
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-slate-700 bg-slate-700 text-white hover:bg-slate-600">İptal</Button>
            <Button onClick={saveCompany} disabled={savingCompany} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">{savingCompany ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

export function ProfileEmployeesTab() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"edit" | "trainings" | "health" | "ppe" | "documents">("edit");
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [employeeCompanyFallback, setEmployeeCompanyFallback] = useState<CompanyRow | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkCompanyId, setBulkCompanyId] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkEmployeePreviewRow[]>(emptyBulkEmployeeRows);
  const [bulkUploading, setBulkUploading] = useState(false);
  const employeeFileInputRef = useRef<HTMLInputElement | null>(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    company_id: "",
    full_name: "",
    first_name: "",
    last_name: "",
    tc_number: "",
    job_title: "",
    department: "",
    phone: "",
    email: "",
    start_date: "",
    gender: "",
    insured_job_code: "",
    insured_job_name: "",
  });

  useEffect(() => {
    void loadProfileEmployees(600).then(setEmployees);
    void loadProfileCompanies(profile?.organization_id, user?.id, 500).then(setCompanies);
  }, [profile?.organization_id, user?.id]);

  const filtered = employees.filter((employee) => fullEmployeeName(employee).toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));

  const loadEmployees = () => {
    void loadProfileEmployees(600).then(setEmployees);
  };

  const openBulkUploadDialog = () => {
    setBulkCompanyId((current) => current || companies[0]?.id || "");
    setBulkRows(emptyBulkEmployeeRows);
    setBulkUploadOpen(true);
  };

  const updateBulkRow = (rowId: string, field: keyof BulkEmployeePreviewRow, value: string) => {
    setBulkRows((current) => current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const removeBulkRow = (rowId: string) => {
    setBulkRows((current) => current.filter((row) => row.id !== rowId));
  };

  const downloadEmployeeTemplate = async () => {
    const XLSX = await import("xlsx");
    const rows = [
      {
        "TC No": "12345678950",
        Adı: "Ahmet",
        Soyadı: "Yılmaz",
        "Doğum T.": "15.05.1990",
        Cinsiyet: "E",
        "İşe Giriş T.": "01.03.2020",
        Bölüm: "Üretim",
        Pozisyon: "Operatör",
        Meslek: "Makine Operatörü",
        "Muayene T.": "15.06.2025",
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Çalışanlar");
    XLSX.writeFile(workbook, "calisan-toplu-yukleme-sablonu.xlsx");
  };

  const handleEmployeeFileUpload = async (file?: File | null) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Sadece .xlsx veya .xls formatında dosya yükleyebilirsiniz.");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : null;
      const rows = sheet ? XLSX.utils.sheet_to_json<GenericRecord>(sheet, { defval: "" }) : [];
      const parsedRows = rows
        .map((row, index) => ({
          id: `import-${Date.now()}-${index}`,
          tcNo: String(getSpreadsheetValue(row, ["TC No", "T.C. Kimlik No", "TC Kimlik No", "Kimlik No", "tc_number"])).trim(),
          firstName: String(getSpreadsheetValue(row, ["Adı", "Adi", "Ad", "İsim", "Isim", "first_name"])).trim(),
          lastName: String(getSpreadsheetValue(row, ["Soyadı", "Soyadi", "Soyad", "last_name"])).trim(),
          birthDate: parseSpreadsheetDate(getSpreadsheetValue(row, ["Doğum T.", "Dogum T.", "Doğum Tarihi", "Dogum Tarihi", "birth_date"])),
          gender: String(getSpreadsheetValue(row, ["Cinsiyet", "gender"])).trim(),
          startDate: parseSpreadsheetDate(getSpreadsheetValue(row, ["İşe Giriş T.", "Ise Giris T.", "İşe Giriş Tarihi", "Ise Giris Tarihi", "İşe Başlama", "Ise Baslama", "start_date"])),
          department: String(getSpreadsheetValue(row, ["Bölüm", "Bolum", "Departman", "Birim", "department"])).trim(),
          jobTitle: String(getSpreadsheetValue(row, ["Pozisyon", "Görev", "Gorev", "Ünvan", "Unvan", "Görevi", "Gorevi", "job_title"])).trim(),
          insuredJobName: String(getSpreadsheetValue(row, ["Meslek", "Sigortalı Meslek İsmi", "Sigortali Meslek Ismi", "Meslek İsmi", "Meslek Ismi", "insured_job_name"])).trim(),
          periodicExamDate: parseSpreadsheetDate(getSpreadsheetValue(row, ["Muayene T.", "Muayene Tarihi", "Periyodik Muayene Tarihi", "periodic_exam_date"])),
        }))
        .filter((row) => row.firstName || row.lastName || row.tcNo);

      if (parsedRows.length === 0) {
        toast.error("Dosyada aktarılacak çalışan bulunamadı.");
        return;
      }

      setBulkRows(parsedRows);
      toast.success(`${parsedRows.length} çalışan yüklenmeye hazır.`);
    } catch (error) {
      console.error("[Profile] çalışan Excel aktarımı başarısız", error);
      toast.error("Excel dosyası okunamadı.");
    } finally {
      if (employeeFileInputRef.current) employeeFileInputRef.current.value = "";
    }
  };

  const uploadBulkEmployees = async () => {
    if (!bulkCompanyId) {
      toast.error("Çalışanların ekleneceği firmayı seçin.");
      return;
    }

    const validRows = bulkRows.filter((row) => row.firstName.trim() || row.lastName.trim());
    if (validRows.length === 0) {
      toast.error("Yüklenecek geçerli çalışan bulunamadı.");
      return;
    }

    setBulkUploading(true);
    const payload = validRows.map((row) => ({
      company_id: bulkCompanyId,
      first_name: row.firstName.trim(),
      last_name: row.lastName.trim(),
      full_name: [row.firstName, row.lastName].map((value) => value.trim()).filter(Boolean).join(" "),
      tc_number: row.tcNo.trim() || null,
      gender: row.gender.trim() || null,
      start_date: parseSpreadsheetDate(row.startDate) || null,
      department: row.department.trim() || null,
      job_title: row.jobTitle.trim() || row.insuredJobName.trim() || "Belirtilmemiş",
      insured_job_name: row.insuredJobName.trim() || null,
      is_active: true,
    }));

    try {
      const { error } = await db.from("employees").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} çalışan seçili firmaya eklendi.`);
      setBulkUploadOpen(false);
      loadEmployees();
    } catch (error: any) {
      console.error("[Profile] toplu çalışan yükleme başarısız", error);
      toast.error("Toplu çalışan yükleme başarısız.", { description: getFriendlyEmployeeError(error) });
    } finally {
      setBulkUploading(false);
    }
  };

  const splitName = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { first_name: parts[0] || "", last_name: "" };
    return { first_name: parts.slice(0, -1).join(" "), last_name: parts.slice(-1).join(" ") };
  };

  const openEmployeeDialog = (employee?: EmployeeRow) => {
    const fullName = employee ? fullEmployeeName(employee) : "";
    const split = splitName(fullName);
    setEditingEmployee(employee || null);
    setDialogTab("edit");
    setEmployeeForm({
      company_id: employee?.company_id || "",
      full_name: fullName,
      first_name: employee?.first_name || split.first_name,
      last_name: employee?.last_name || split.last_name,
      tc_number: employee?.tc_number || "",
      job_title: employee?.job_title || "",
      department: employee?.department || "",
      phone: employee?.phone || "",
      email: employee?.email || "",
      start_date: employee?.start_date || "",
      gender: "",
      insured_job_code: "",
      insured_job_name: "",
    });
    setDialogOpen(true);
    setEmployeeCompanyFallback(null);
    if (employee?.company_id && !companies.some((company) => company.id === employee.company_id)) {
      void loadCompanyById(employee.company_id).then(setEmployeeCompanyFallback);
    }
  };

  const saveEmployee = async () => {
    const fullName = employeeForm.full_name.trim();
    const split = splitName(fullName);
    const firstName = employeeForm.first_name.trim() || split.first_name;
    const lastName = employeeForm.last_name.trim() || split.last_name;

    if (!employeeForm.company_id || !firstName) {
      toast.error("Firma ve çalışan adı zorunludur.");
      return;
    }

    setSavingEmployee(true);
    const payload = {
      company_id: employeeForm.company_id,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName || [firstName, lastName].filter(Boolean).join(" "),
      tc_number: employeeForm.tc_number.trim() || null,
      job_title: employeeForm.job_title.trim() || "Belirtilmemiş",
      department: employeeForm.department.trim() || null,
      phone: employeeForm.phone.trim() || null,
      email: employeeForm.email.trim() || null,
      start_date: employeeForm.start_date || null,
      gender: employeeForm.gender || null,
      insured_job_code: employeeForm.insured_job_code.trim() || null,
      insured_job_name: employeeForm.insured_job_name.trim() || null,
      is_active: true,
    };

    try {
      const query = editingEmployee
        ? db.from("employees").update(payload).eq("id", editingEmployee.id)
        : db.from("employees").insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast.success(editingEmployee ? "Çalışan güncellendi." : "Çalışan kaydedildi.");
      setDialogOpen(false);
      loadEmployees();
    } catch (error: any) {
      console.error("[Profile] çalışan kaydı başarısız", error);
      toast.error("Çalışan kaydedilemedi.", { description: getFriendlyEmployeeError(error) });
    } finally {
      setSavingEmployee(false);
    }
  };

  const archiveEmployee = async (employee: EmployeeRow) => {
    try {
      const { error } = await db.from("employees").update({ is_active: false }).eq("id", employee.id);
      if (error) throw error;
      toast.success("Çalışan pasife alındı.");
      loadEmployees();
    } catch (error: any) {
      toast.error("Çalışan pasife alınamadı.", { description: error.message });
    }
  };

  const employeeDialogTabs = [
    { id: "edit" as const, label: "Düzenle", icon: Users, tone: "data-[active=true]:bg-blue-600" },
    { id: "trainings" as const, label: "Eğitimler", icon: GraduationCap, tone: "data-[active=true]:bg-fuchsia-600" },
    { id: "health" as const, label: "Sağlık", icon: ShieldCheck, tone: "data-[active=true]:bg-emerald-600" },
    { id: "ppe" as const, label: "KKD", icon: ClipboardList, tone: "data-[active=true]:bg-orange-500" },
    { id: "documents" as const, label: "Evrak Takip", icon: FileText, tone: "data-[active=true]:bg-cyan-600" },
  ];

  return (
    <PanelShell
      title="Çalışanlar"
      description="Çalışan kayıtlarını tablo görünümünde izleyin, yeni çalışan ekleyin ve çalışan içi takip alanlarını yönetin."
      action={<Button onClick={() => openEmployeeDialog()} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" />Ekle</Button>}
    >
      <Toolbar>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Çalışan ara..." className="h-10 rounded-xl border-slate-700 bg-slate-900 pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          {["Eğitim", "EK2", "A-Z", "Rapor Al"].map((item) => (
            <Button key={item} variant="outline" className="rounded-xl border-slate-700 bg-slate-900">{item}</Button>
          ))}
        </div>
      </Toolbar>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={openBulkUploadDialog} className="rounded-xl border-slate-800 bg-slate-900"><Upload className="mr-2 h-4 w-4" />Toplu Yükle</Button>
        <p className="text-xs text-slate-500">Çalışanların üzerine tıklayarak ayrıntılara ulaşabilirsiniz.</p>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Henüz çalışan eklenmemiş" description="Çalışan eklemek için Ekle butonunu kullanın." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded border-slate-700 bg-slate-900" /></th>
                {["Çalışan", "Firma", "Görev", "Departman", "Telefon", "Durum", "İşlemler"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-bold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((employee) => (
                <tr key={employee.id} className="cursor-pointer bg-slate-950/40 text-slate-200 hover:bg-slate-900/60" onClick={() => openEmployeeDialog(employee)}>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" className="rounded border-slate-700 bg-slate-900" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-300"><Users className="h-4 w-4" /></span>
                      <span className="font-bold">{fullEmployeeName(employee)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{employee.company_name || "-"}</td>
                  <td className="px-4 py-3">{employee.job_title || "-"}</td>
                  <td className="px-4 py-3">{employee.department || "-"}</td>
                  <td className="px-4 py-3">{employee.phone || "-"}</td>
                  <td className="px-4 py-3"><Badge className={employee.is_active === false ? "bg-slate-500/10 text-slate-300" : "bg-emerald-500/10 text-emerald-300"}>{employee.is_active === false ? "Pasif" : "Aktif"}</Badge></td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openEmployeeDialog(employee)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => archiveEmployee(employee)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}>
        <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-20px)] overflow-hidden border-slate-700 bg-slate-900 p-0 text-slate-100 sm:max-w-5xl">
          <DialogHeader className="border-b border-slate-700 px-4 py-4 sm:px-5">
            <DialogTitle className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
                <FileText className="h-4 w-4" />
              </span>
              <span>
                Toplu Çalışan Yükle
                <span className="block text-sm font-normal text-slate-400">Excel dosyasından birden fazla çalışan ekleyin</span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100dvh-190px)] overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Çalışanların Ekleneceği Firma *</Label>
                <Select value={bulkCompanyId} onValueChange={setBulkCompanyId}>
                  <SelectTrigger className="h-11 rounded-lg border-slate-700 bg-slate-950/70">
                    <SelectValue placeholder="Firma seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                <Button type="button" variant="outline" onClick={() => void downloadEmployeeTemplate()} className="h-11 rounded-lg border-dashed border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700">
                  Şablon Excel İndir
                </Button>
                <Button type="button" onClick={() => employeeFileInputRef.current?.click()} className="h-11 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                  <Upload className="mr-2 h-4 w-4" />
                  Excel Dosyası Seç
                </Button>
                <input ref={employeeFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleEmployeeFileUpload(event.target.files?.[0])} />
              </div>

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-200">
                Not: Excel şablonunda “Meslek” ve “Periyodik Muayene Tarihi” kolonları bulunmaktadır. MYK belgesi gerektiren meslekler otomatik algılanır. Periyodik muayene tarihi girildiğinde EK-2 takibi otomatik yapılır.
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/30">
                <div className="border-b border-slate-700 px-3 py-3 text-sm font-black text-white">
                  {bulkRows.length} çalışan yüklenmeye hazır
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        {["#", "TC No", "Adı", "Soyadı", "Doğum T.", "Cinsiyet", "İşe Giriş T.", "Bölüm", "Pozisyon", "Meslek", "Muayene T.", "Sil"].map((head) => (
                          <th key={head} className="px-2 py-2 text-left font-semibold">{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, index) => (
                        <tr key={row.id} className="border-t border-slate-800">
                          <td className="px-2 py-1 text-slate-400">{index + 1}</td>
                          <td className="px-2 py-1"><Input value={row.tcNo} onChange={(event) => updateBulkRow(row.id, "tcNo", event.target.value)} className="h-8 w-28 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={row.firstName} onChange={(event) => updateBulkRow(row.id, "firstName", event.target.value)} className="h-8 w-24 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={row.lastName} onChange={(event) => updateBulkRow(row.id, "lastName", event.target.value)} className="h-8 w-24 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={formatPreviewDate(row.birthDate)} onChange={(event) => updateBulkRow(row.id, "birthDate", event.target.value)} className="h-8 w-24 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={row.gender || "-"} onChange={(event) => updateBulkRow(row.id, "gender", event.target.value)} className="h-8 w-16 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={formatPreviewDate(row.startDate)} onChange={(event) => updateBulkRow(row.id, "startDate", event.target.value)} className="h-8 w-24 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={row.department} onChange={(event) => updateBulkRow(row.id, "department", event.target.value)} className="h-8 w-24 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={row.jobTitle} onChange={(event) => updateBulkRow(row.id, "jobTitle", event.target.value)} className="h-8 w-28 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={row.insuredJobName} onChange={(event) => updateBulkRow(row.id, "insuredJobName", event.target.value)} className="h-8 w-32 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Input value={formatPreviewDate(row.periodicExamDate)} onChange={(event) => updateBulkRow(row.id, "periodicExamDate", event.target.value)} className="h-8 w-24 rounded border-slate-700 bg-slate-800 text-xs" /></td>
                          <td className="px-2 py-1"><Button type="button" size="icon" variant="ghost" onClick={() => removeBulkRow(row.id)} className="h-8 w-8 text-rose-400 hover:text-rose-300"><Trash2 className="h-4 w-4" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 border-t border-slate-700 px-4 py-4 sm:px-5">
            <Button type="button" variant="outline" onClick={() => setBulkUploadOpen(false)} className="h-11 rounded-lg border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
              İptal
            </Button>
            <Button type="button" onClick={uploadBulkEmployees} disabled={bulkUploading} className="h-11 rounded-lg bg-violet-600 text-white hover:bg-violet-500">
              <Upload className="mr-2 h-4 w-4" />
              {bulkUploading ? "Yükleniyor..." : "Yükle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-28px)] overflow-hidden border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl shadow-black/40 sm:max-w-4xl">
          <div className="flex max-h-[calc(100dvh-28px)] w-full flex-col [&>button]:hidden">
            <DialogHeader className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_36%),linear-gradient(135deg,#0f172a,#111827)] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl font-black text-white">
                    {editingEmployee ? "Çalışan Bilgilerini Düzenle" : "Yeni Çalışan Ekle"}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-slate-400">
                    Çalışan kimlik, görev ve takip bilgilerini tek pencerede yönetin.
                  </DialogDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-lg leading-none text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label="Kapat"
                >
                  ×
                </button>
              </div>
            </DialogHeader>
            <div className="border-b border-slate-800 px-6 py-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-1 sm:grid-cols-5">
            {employeeDialogTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-active={dialogTab === tab.id}
                  onClick={() => setDialogTab(tab.id)}
                      className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-black text-slate-300 transition data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-black/20 ${tab.tone}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
              </div>
          </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {dialogTab === "edit" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-400">Firma *</Label>
                        <Select value={employeeForm.company_id} onValueChange={(value) => setEmployeeForm({ ...employeeForm, company_id: value })}>
                          <SelectTrigger className="h-11 rounded-xl border-slate-700 bg-slate-800/90"><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                          <SelectContent>
                            {[...companies, ...(employeeCompanyFallback ? [employeeCompanyFallback] : [])]
                              .filter((company, index, list) => list.findIndex((item) => item.id === company.id) === index)
                              .map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-400">Ad Soyad *</Label>
                        <Input value={employeeForm.full_name} onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })} placeholder="Örn: Ahmet Yılmaz" className="h-11 rounded-xl border-slate-700 bg-slate-800/90 font-semibold" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-400">T.C. Kimlik No</Label>
                      <Input placeholder="T.C. kimlik numarası" value={employeeForm.tc_number} onChange={(e) => setEmployeeForm({ ...employeeForm, tc_number: e.target.value })} className="h-11 rounded-xl border-slate-700 bg-slate-800/90" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-400">Telefon</Label>
                      <Input placeholder="Telefon" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} className="h-11 rounded-xl border-slate-700 bg-slate-800/90" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-400">E-posta</Label>
                      <Input placeholder="E-posta" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="h-11 rounded-xl border-slate-700 bg-slate-800/90" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-400">İşe Giriş Tarihi</Label>
                      <Input type="date" value={employeeForm.start_date} onChange={(e) => setEmployeeForm({ ...employeeForm, start_date: e.target.value })} className="h-11 rounded-xl border-slate-700 bg-slate-800/90" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="mb-4 text-sm font-black text-white">Görev ve SGK Bilgileri</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-400">Görev / Ünvan</Label>
                        <Input placeholder="Örn: Kaynak Ustası" value={employeeForm.job_title} onChange={(e) => setEmployeeForm({ ...employeeForm, job_title: e.target.value })} className="h-11 rounded-xl border-slate-700 bg-slate-800/90" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-400">Departman</Label>
                        <Input placeholder="Departman" value={employeeForm.department} onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })} className="h-11 rounded-xl border-slate-700 bg-slate-800/90" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-400">Sigortalı Meslek Kodu</Label>
                        <Input placeholder="Sigortalı Meslek Kodu" value={employeeForm.insured_job_code} onChange={(e) => setEmployeeForm({ ...employeeForm, insured_job_code: e.target.value })} className="h-11 rounded-xl border-slate-700 bg-slate-800/90" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-400">Sigortalı Meslek İsmi</Label>
                        <Input placeholder="Sigortalı Meslek İsmi" value={employeeForm.insured_job_name} onChange={(e) => setEmployeeForm({ ...employeeForm, insured_job_name: e.target.value })} className="h-11 rounded-xl border-slate-700 bg-slate-800/90" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-8 text-center text-sm font-semibold text-amber-300">
                  {dialogTab === "trainings" && "Eğitim kayıtlarını görmek için çalışan kaydedilmiş olmalıdır. Lütfen önce çalışanı kaydedin."}
                  {dialogTab === "health" && "Sağlık gözetimi kayıtlarını görmek için çalışan kaydedilmiş olmalıdır. Lütfen önce çalışanı kaydedin."}
                  {dialogTab === "ppe" && "KKD zimmet kayıtlarını görmek için çalışan kaydedilmiş olmalıdır. Lütfen önce çalışanı kaydedin."}
                  {dialogTab === "documents" && "Evrak takibini görmek için çalışan kaydedilmiş olmalıdır. Lütfen önce çalışanı kaydedin."}
                </div>
              )}
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3 border-t border-slate-800 bg-slate-950/50 px-6 py-5 sm:space-x-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-11 rounded-xl border-slate-700 bg-slate-700 text-white hover:bg-slate-600">İptal</Button>
              <Button onClick={saveEmployee} disabled={savingEmployee} className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700">{savingEmployee ? "Kaydediliyor..." : "Kaydet"}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

export function ProfileTrainingsTab() {
  const { user, profile } = useAuth();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", starts_at: "", ends_at: "", valid_until: "", duration: "", description: "" });

  useEffect(() => {
    void loadProfileCompanies(profile?.organization_id, user?.id, 500).then(setCompanies);
  }, [profile?.organization_id, user?.id]);

  useEffect(() => {
    if (!companyId) {
      setEmployees([]);
      return;
    }
    void safeRows<EmployeeRow>("employees", "id,first_name,last_name,full_name,company_id", 300, (q) => q.eq("company_id", companyId)).then(setEmployees);
  }, [companyId]);

  const saveTraining = async () => {
    if (!companyId || !form.title) {
      toast.error("Firma ve eğitim başlığı zorunludur.");
      return;
    }
    try {
      const { data, error } = await db.from("trainings").insert({ ...form, company_id: companyId, user_id: user?.id }).select("id").single();
      if (error) throw error;
      if (selectedEmployees.length > 0) {
        const rows = selectedEmployees.map((employee_id) => ({ training_id: data.id, employee_id }));
        const { error: participantError } = await db.from("training_participants").insert(rows);
        if (participantError) throw participantError;
      }
      toast.success("Eğitim kaydı oluşturuldu.");
      setForm({ title: "", starts_at: "", ends_at: "", valid_until: "", duration: "", description: "" });
      setSelectedEmployees([]);
    } catch (error: any) {
      toast.error("Eğitim kaydı oluşturulamadı.", { description: error.message });
    }
  };

  return (
    <PanelShell title="Eğitmenler" description="Firma seçin, çalışanları belirleyin ve eğitim kaydını tamamlayın.">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-300">
        {["Firma Seçin", "Çalışan Seçin", "Eğitim Kaydı"].map((step, index) => (
          <Badge key={step} className="rounded-full bg-slate-800 text-slate-100">{index + 1}. {step}</Badge>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
          <Label>Firma Seçin</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-900"><SelectValue placeholder="Firma seçin" /></SelectTrigger>
            <SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
          <div className="flex items-center justify-between">
            <Label>Çalışan Seçin</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!companyId} onClick={() => setSelectedEmployees(employees.map((e) => e.id))}>Tümünü seç</Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedEmployees([])}>Temizle</Button>
            </div>
          </div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {!companyId ? <p className="text-sm text-slate-500">Önce firma seçin.</p> : employees.map((employee) => (
              <label key={employee.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950/50 p-2 text-sm">
                <input type="checkbox" checked={selectedEmployees.includes(employee.id)} onChange={(event) => setSelectedEmployees((prev) => event.target.checked ? [...prev, employee.id] : prev.filter((id) => id !== employee.id))} />
                {fullEmployeeName(employee)}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
          <Label>Eğitim Başlığı</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl border-slate-700 bg-slate-900" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="rounded-xl border-slate-700 bg-slate-900" />
            <Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="rounded-xl border-slate-700 bg-slate-900" />
            <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="rounded-xl border-slate-700 bg-slate-900" />
            <Input placeholder="Eğitim süresi" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="rounded-xl border-slate-700 bg-slate-900" />
          </div>
          <Textarea placeholder="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl border-slate-700 bg-slate-900" />
          <Button onClick={saveTraining} className="w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700">Eğitimleri Tamamla</Button>
        </div>
      </div>
    </PanelShell>
  );
}

export function ProfileDocumentsTab() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [documents, setDocuments] = useState<GenericRecord[]>([]);
  const [form, setForm] = useState({ company_id: "", document_type: "", report_date: "", valid_until: "", document_name: "", notes: "" });
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const documentTypes = ["Risk Analizi", "Acil Durum Planı", "Eğitim Katılım Formu", "Periyodik Kontrol Raporu", "İSG Kurulu Tutanağı", "Çalışma İzin Formu", "İş Kazası Bildirimi", "Meslek Hastalığı Bildirimi", "Sağlık Raporu", "Diğer"];

  const load = async () => {
    setCompanies(await loadProfileCompanies(profile?.organization_id, user?.id, 500));
    setDocuments(await safeRows<GenericRecord>("company_documents", "*", 500, (q) => (user?.id ? q.eq("user_id", user.id) : q)));
  };
  useEffect(() => { void load(); }, [profile?.organization_id, user?.id]);

  const save = async () => {
    if (!form.company_id || !form.document_type || !form.report_date || !form.document_name) {
      toast.error("Firma, evrak tipi, rapor tarihi ve evrak adı zorunludur.");
      return;
    }
    const { error } = await db.from("company_documents").insert({ ...form, user_id: user?.id, status: "valid" });
    if (error) {
      toast.error("Evrak kaydedilemedi.", { description: error.message });
      return;
    }
    toast.success("Evrak kaydedildi.");
    setOpen(false);
    setForm({ company_id: "", document_type: "", report_date: "", valid_until: "", document_name: "", notes: "" });
    void load();
  };

  const downloadDocumentTemplate = async () => {
    const XLSX = await import("xlsx");
    const rows = companies.map((company) => {
      const row: GenericRecord = { "Firma ID": company.id, "Firma Adı": company.name };
      documentTypes.forEach((type) => {
        row[type] = documents.some((document) => document.company_id === company.id && document.document_type === type) ? "X" : "";
      });
      return row;
    });
    const emptyRow = { "Firma ID": "", "Firma Adı": "", ...Object.fromEntries(documentTypes.map((type) => [type, ""])) };
    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [emptyRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Evrak Takip");
    XLSX.writeFile(workbook, "evrak-takip-toplu-yukleme-sablonu.xlsx");
  };

  const importDocumentTemplate = async (file?: File | null) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Sadece .xlsx veya .xls formatında dosya yükleyebilirsiniz.");
      return;
    }

    setBulkUploading(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : null;
      const rows = sheet ? XLSX.utils.sheet_to_json<GenericRecord>(sheet, { defval: "" }) : [];
      const existingKeys = new Set(documents.map((document) => `${document.company_id}-${document.document_type}`));
      const companyById = new Map(companies.map((company) => [company.id, company]));
      const companyByName = new Map(companies.map((company) => [normalizeSpreadsheetHeader(company.name), company]));
      const payload: GenericRecord[] = [];

      rows.forEach((row) => {
        const companyId = String(getSpreadsheetValue(row, ["Firma ID", "Firma Id", "company_id"]) || "").trim();
        const companyName = String(getSpreadsheetValue(row, ["Firma Adı", "Firma Adi", "Firma", "company_name"]) || "").trim();
        const company = companyById.get(companyId) || companyByName.get(normalizeSpreadsheetHeader(companyName));
        if (!company) return;

        documentTypes.forEach((type) => {
          const value = String(getSpreadsheetValue(row, [type]) || "").trim().toLocaleLowerCase("tr-TR");
          const marked = ["x", "var", "evet", "1", "true"].includes(value);
          const key = `${company.id}-${type}`;
          if (!marked || existingKeys.has(key)) return;
          existingKeys.add(key);
          payload.push({
            user_id: user?.id,
            organization_id: profile?.organization_id || null,
            company_id: company.id,
            document_type: type,
            document_name: type,
            status: "valid",
          });
        });
      });

      if (payload.length === 0) {
        toast.error("Yüklenecek yeni evrak işareti bulunamadı.");
        return;
      }

      const { error } = await db.from("company_documents").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} evrak kaydı eklendi.`);
      setBulkOpen(false);
      void load();
    } catch (error: any) {
      toast.error("Toplu evrak yükleme başarısız.", { description: error.message });
    } finally {
      setBulkUploading(false);
      if (documentFileInputRef.current) documentFileInputRef.current.value = "";
    }
  };

  return (
    <PanelShell title="Evrak Takip" description="Firma bazlı evrak durumlarını matris olarak izleyin." action={<Button onClick={() => setOpen(true)} className="rounded-xl bg-blue-600 text-white"><Plus className="mr-2 h-4 w-4" />Evrak Ekle</Button>}>
      <Toolbar>
        <Input placeholder="Firma veya evrak ara..." className="h-10 rounded-xl border-slate-700 bg-slate-900" />
        <Button onClick={() => setBulkOpen(true)} variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-100"><Upload className="mr-2 h-4 w-4" />Toplu Yükle</Button>
        <div className="flex flex-wrap gap-2 text-xs">
          {["Geçerli", "30 gün içinde dolacak", "Süresi dolmuş / Yok", "Eklenecek"].map((item) => <Badge key={item} className="bg-slate-800 text-slate-100">{item}</Badge>)}
        </div>
      </Toolbar>
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-slate-900 text-slate-400"><tr><th className="px-3 py-3 text-left">Firma</th>{documentTypes.map((type) => <th key={type} className="px-3 py-3 text-left">{type}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-800">
            {companies.map((company) => (
              <tr key={company.id} className="bg-slate-950/40">
                <td className="px-3 py-3 font-bold text-white">{company.name}</td>
                {documentTypes.map((type) => {
                  const exists = documents.some((doc) => doc.company_id === company.id && doc.document_type === type);
                  return <td key={type} className="px-3 py-3"><Badge className={exists ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}>{exists ? "Var" : "Yok"}</Badge></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] overflow-hidden border-slate-700 bg-slate-900 p-0 text-slate-100 sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-700 px-5 py-4">
            <DialogTitle className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <FileText className="h-5 w-5" />
              </span>
              <span>
                Excel ile Toplu Evrak Ekle
                <span className="block text-sm font-normal text-slate-400">Şablonu indirin, evrakları işaretleyin ve yükleyin</span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="flex flex-col gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-300 text-xs text-blue-200">i</span>
                <div>
                  <p className="text-sm font-semibold text-blue-100">1. Adım: Şablonu indirin</p>
                  <p className="mt-1 text-xs text-blue-200/80">Firmalarınızın listesi hazır gelecek. Var olan evrakların hücresine X yazın, olmayanları boş bırakın.</p>
                </div>
              </div>
              <Button onClick={() => void downloadDocumentTemplate()} className="shrink-0 rounded-xl bg-blue-600 text-white hover:bg-blue-500">
                Şablon İndir ({companies.length} firma)
              </Button>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 text-xs text-slate-400">
              2. Adım: Doldurduğunuz Excel dosyasını aşağıya yükleyin. Tarihler yükleme sonrasında girilecektir.
            </div>

            <button
              type="button"
              onClick={() => documentFileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void importDocumentTemplate(event.dataTransfer.files?.[0]);
              }}
              className="flex min-h-[130px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-950/20 p-6 text-center transition hover:border-emerald-400/70 hover:bg-slate-950/40"
            >
              <Upload className="mb-3 h-9 w-9 text-slate-400" />
              <span className="text-sm font-semibold text-white">Doldurduğunuz Excel dosyasını sürükleyip bırakın</span>
              <span className="mt-1 text-xs text-slate-400">veya dosya seçmek için tıklayın (.xlsx, .xls)</span>
            </button>
            <input ref={documentFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void importDocumentTemplate(event.target.files?.[0])} />
          </div>
          <DialogFooter className="border-t border-slate-700 px-5 py-4">
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkUploading} className="rounded-xl border-slate-700 bg-slate-800 text-white hover:bg-slate-700">
              İptal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100 sm:max-w-lg">
          <DialogHeader><DialogTitle>Yeni Evrak Ekle</DialogTitle><DialogDescription>Firma evrak takibine yeni kayıt ekleyin.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <Select value={form.company_id} onValueChange={(value) => setForm({ ...form, company_id: value })}><SelectTrigger><SelectValue placeholder="Firma *" /></SelectTrigger><SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            <Select value={form.document_type} onValueChange={(value) => setForm({ ...form, document_type: value })}><SelectTrigger><SelectValue placeholder="Evrak Tipi *" /></SelectTrigger><SelectContent>{documentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Evrak Adı *" value={form.document_name} onChange={(e) => setForm({ ...form, document_name: e.target.value })} />
            <Input type="date" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} />
            <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            <Textarea placeholder="Notlar" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>İptal</Button><Button onClick={save}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

function SimpleRecordsTab({ title, description, table, addLabel, fields }: { title: string; description: string; table: string; addLabel: string; fields: string[] }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<GenericRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GenericRecord>({});
  const load = () => safeRows<GenericRecord>(table, "*", 100, (q) => (user?.id ? q.eq("user_id", user.id) : q).order("created_at", { ascending: false })).then(setRows);
  useEffect(() => { void load(); }, [user?.id, table]);
  const save = async () => {
    const { error } = await db.from(table).insert({ ...form, user_id: user?.id });
    if (error) return toast.error("Kayıt oluşturulamadı.", { description: error.message });
    toast.success("Kayıt oluşturuldu.");
    setOpen(false);
    setForm({});
    void load();
  };
  return (
    <PanelShell title={title} description={description} action={<Button onClick={() => setOpen(true)} className="rounded-xl bg-blue-600 text-white"><Plus className="mr-2 h-4 w-4" />{addLabel}</Button>}>
      {rows.length === 0 ? <EmptyState description="İlk kaydı ekleyerek başlayın." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4"><p className="font-bold text-white">{row.title || row.document_name || row.risk_description || row.visit_type || "Kayıt"}</p><p className="mt-1 text-sm text-slate-400">{row.notes || row.description || row.status || "Detay bulunmuyor"}</p></div>)}</div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="border-slate-800 bg-slate-950 text-slate-100"><DialogHeader><DialogTitle>{addLabel}</DialogTitle></DialogHeader><div className="grid gap-3">{fields.map((field) => field.includes("notes") || field.includes("description") || field.includes("risk") ? <Textarea key={field} placeholder={field} value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} /> : <Input key={field} placeholder={field} value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />)}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>İptal</Button><Button onClick={save}>Kaydet</Button></DialogFooter></DialogContent></Dialog>
    </PanelShell>
  );
}

export function ProfileCompanyFollowTab() {
  const { user, profile } = useAuth();
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [hasOsgbAssignment, setHasOsgbAssignment] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAssignments = async () => {
      setLoadingAssignments(true);
      let assigned = false;

      if (user?.id) {
        try {
          const { count, error } = await db
            .from("osgb_assignments")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "active");
          if (!error && (count || 0) > 0) assigned = true;
        } catch (error) {
          console.warn("[Profile] OSGB kullanıcı görevlendirmesi kontrol edilemedi", error);
        }
      }

      if (!assigned && profile?.organization_id) {
        try {
          const { count, error } = await db
            .from("osgb_assignments")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", profile.organization_id)
            .eq("status", "active");
          if (!error && (count || 0) > 0) assigned = true;
        } catch (error) {
          console.warn("[Profile] OSGB organizasyon görevlendirmesi kontrol edilemedi", error);
        }
      }

      if (!active) return;
      setHasOsgbAssignment(assigned);
      setLoadingAssignments(false);
    };

    void checkAssignments();
    return () => {
      active = false;
    };
  }, [profile?.organization_id, user?.id]);

  if (loadingAssignments) {
    return (
      <PanelShell title="Firma Takip" description="OSGB görevlendirmeleri kontrol ediliyor.">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
          Görevlendirme bilgileri senkronize ediliyor...
        </div>
      </PanelShell>
    );
  }

  if (!hasOsgbAssignment) {
    return (
      <PanelShell title="Firma Takip" description="OSGB görevlendirmesi sonrası mevzuat takip ekranı burada açılır.">
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/45 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10">
            <ShieldCheck className="h-7 w-7 text-cyan-300" />
          </div>
          <h3 className="mt-5 text-xl font-black text-white">Henüz bir OSGB tarafından görevlendirilmediniz.</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Bir OSGB firması size görevlendirme yaptığında, atanan firmaların mevzuat checklist&apos;ini buradan takip edebilirsiniz.
          </p>
        </div>
      </PanelShell>
    );
  }

  return <SimpleRecordsTab title="Firma Takip" description="Atanan firmaların mevzuat checklist&apos;ini ve takip notlarını izleyin." table="company_follow_ups" addLabel="Takip Kaydı Ekle" fields={["company_id", "title", "follow_up_type", "due_date", "status", "notes"]} />;
}

export function ProfileArchiveTab() {
  return <SimpleRecordsTab title="Arşiv" description="Oluşturulan ve yüklenen dosyalarınızı firma ve belge tipine göre izleyin." table="reports" addLabel="Arşiv Kaydı Ekle" fields={["title", "report_type", "company_id", "notes"]} />;
}

export function ProfileRisksTab() {
  const { user, profile } = useAuth();
  const [query, setQuery] = useState("");
  const [risks, setRisks] = useState<SavedRiskItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RiskFormState>(emptyRiskForm);
  const riskFileInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    const rows = await safeRows<SavedRiskItem>(
      "saved_risk_items",
      "*",
      300,
      (q) => (user?.id ? q.eq("user_id", user.id) : q).order("created_at", { ascending: false })
    );
    setRisks(rows);
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const filteredRisks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    if (!term) return risks;
    return risks.filter((risk) =>
      [risk.category, risk.activity, risk.hazard_source, risk.risk_description, risk.current_measures]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term))
    );
  }, [query, risks]);

  const updateForm = (field: keyof RiskFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveRisk = async () => {
    if (!form.category.trim() || !form.hazard.trim() || !form.risk.trim() || !form.controls.trim()) {
      toast.error("Kategori, tehlike, risk ve kontrol tedbirleri zorunludur.");
      return;
    }

    setSaving(true);
    const probability = toPositiveNumber(form.probabilityBefore);
    const severity = toPositiveNumber(form.severityBefore);
    const riskScore = probability * severity;
    const { error } = await db.from("saved_risk_items").insert({
      user_id: user?.id,
      organization_id: profile?.organization_id || null,
      category: form.category.trim(),
      activity: form.subCategory.trim() || null,
      hazard_source: form.source.trim() || form.hazard.trim(),
      risk_description: form.risk.trim(),
      current_measures: form.controls.trim(),
      probability,
      severity,
      risk_score: riskScore,
      risk_level: getRiskLevel(riskScore),
      additional_measures: form.controls.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error("Risk maddesi kaydedilemedi.", { description: error.message });
      return;
    }

    toast.success("Risk maddesi eklendi.");
    setForm(emptyRiskForm);
    setAddOpen(false);
    void load();
  };

  const downloadTemplate = () => {
    const header = ["Kategori", "Alt Kategori", "Kaynak / Bölüm", "Tehlike", "Risk", "Etkilenen", "Kontrol Tedbirleri", "Olasılık", "Frekans", "Şiddet"];
    const example = ["İnşaat", "Yüksekte Çalışma", "Şantiye", "Kenar boşluğu", "Düşme sonucu yaralanma", "Çalışanlar", "Korkuluk ve emniyet kemeri kullanımı", "3", "2", "5"];
    const csv = [header, example].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "risk-maddesi-sablonu.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRiskFileUpload = async (file?: File | null) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Sadece .xlsx veya .xls formatında dosya yükleyebilirsiniz.");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : null;
      const rows = sheet ? XLSX.utils.sheet_to_json<GenericRecord>(sheet, { defval: "" }) : [];
      const payload = rows
        .map((row) => {
          const category = String(row["Kategori"] || row["category"] || "").trim();
          const hazard = String(row["Tehlike"] || row["hazard_source"] || "").trim();
          const risk = String(row["Risk"] || row["risk_description"] || "").trim();
          const controls = String(row["Kontrol Tedbirleri"] || row["current_measures"] || "").trim();
          const probability = toPositiveNumber(String(row["Olasılık"] || row["Olasilik"] || row["probability"] || "1"));
          const severity = toPositiveNumber(String(row["Şiddet"] || row["Siddet"] || row["severity"] || "1"));
          const riskScore = probability * severity;
          if (!category || !risk) return null;
          return {
            user_id: user?.id,
            organization_id: profile?.organization_id || null,
            category,
            activity: String(row["Alt Kategori"] || row["activity"] || "").trim() || null,
            hazard_source: String(row["Kaynak / Bölüm"] || row["Kaynak / Bolum"] || row["Kaynak"] || "").trim() || hazard || null,
            risk_description: risk,
            current_measures: controls || null,
            probability,
            severity,
            risk_score: riskScore,
            risk_level: getRiskLevel(riskScore),
            additional_measures: controls || null,
          };
        })
        .filter(Boolean);

      if (payload.length === 0) {
        toast.error("Aktarılacak geçerli risk maddesi bulunamadı.");
        return;
      }

      const { error } = await db.from("saved_risk_items").insert(payload);
      if (error) {
        toast.error("Risk maddeleri yüklenemedi.", { description: error.message });
        return;
      }

      toast.success(`${payload.length} risk maddesi yüklendi.`);
      setUploadOpen(false);
      void load();
    } catch (error) {
      console.error("[Profile] risk Excel aktarımı başarısız", error);
      toast.error("Excel dosyası okunamadı.");
    } finally {
      if (riskFileInputRef.current) riskFileInputRef.current.value = "";
    }
  };

  const riskInputClass = "h-10 rounded-lg border-slate-600 bg-slate-800/80 text-slate-100 placeholder:text-slate-500";
  const riskTextareaClass = "min-h-[48px] rounded-lg border-slate-600 bg-slate-800/80 text-slate-100 placeholder:text-slate-500";

  return (
    <div className="min-h-[520px] space-y-6 text-slate-100">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Risk ara..." className="h-9 rounded-lg border-slate-700 bg-slate-900/70 pl-9 text-sm text-slate-100 placeholder:text-slate-500 xl:max-w-[730px]" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-300">Toplam: {filteredRisks.length}</span>
          <Button type="button" size="sm" className="h-9 rounded-lg bg-emerald-600 px-3 text-white hover:bg-emerald-500"><Plus className="mr-1.5 h-4 w-4" />Klasör</Button>
          <Button type="button" size="sm" disabled className="h-9 rounded-lg bg-slate-800 px-3 text-slate-500 opacity-70">Toplu Taşı</Button>
          <Button type="button" size="sm" onClick={() => setUploadOpen(true)} className="h-9 rounded-lg bg-violet-600 px-3 text-white hover:bg-violet-500"><Upload className="mr-1.5 h-4 w-4" />Toplu Yükle</Button>
          <Button type="button" size="sm" onClick={() => setAddOpen(true)} className="h-9 rounded-lg bg-amber-500 px-3 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-400"><Plus className="mr-1.5 h-4 w-4" />Ekle</Button>
        </div>
      </div>

      {filteredRisks.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
          <TriangleAlert className="h-11 w-11 text-slate-500" />
          <p className="mt-4 text-sm text-slate-400">Henüz risk maddesi eklenmemiş</p>
          <Button type="button" onClick={() => setAddOpen(true)} className="mt-4 h-9 rounded-lg bg-amber-500 px-4 text-white hover:bg-amber-400"><Plus className="mr-1.5 h-4 w-4" />İlk Risk Maddesini Ekle</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredRisks.map((risk) => (
            <div key={risk.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300">{risk.category || "Kategori yok"}</p>
                  <h3 className="mt-2 line-clamp-2 font-bold text-white">{risk.risk_description || "Risk tanımı yok"}</h3>
                </div>
                <Badge className="shrink-0 bg-slate-800 text-slate-200">{risk.risk_level || getRiskLevel(risk.risk_score)}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-400">{risk.hazard_source || risk.activity || "Kaynak / bölüm bilgisi yok"}</p>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{risk.current_measures || "Kontrol tedbiri belirtilmemiş"}</p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-20px)] overflow-y-auto border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-700 px-5 py-4"><DialogTitle>Yeni Risk Maddesi Ekle</DialogTitle></DialogHeader>
          <div className="grid gap-4 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5"><Label>Kategori *</Label><Input className={riskInputClass} placeholder="Örn: İnşaat..." value={form.category} onChange={(event) => updateForm("category", event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Alt Kategori</Label><Input className={riskInputClass} placeholder="Opsiyonel" value={form.subCategory} onChange={(event) => updateForm("subCategory", event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Kaynak / Bölüm</Label><Input className={riskInputClass} placeholder="Örn: Üretim Alanı" value={form.source} onChange={(event) => updateForm("source", event.target.value)} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5"><Label>Tehlike *</Label><Textarea className={riskTextareaClass} placeholder="Tehlike tanımı..." value={form.hazard} onChange={(event) => updateForm("hazard", event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Risk *</Label><Textarea className={riskTextareaClass} placeholder="Risk tanımı..." value={form.risk} onChange={(event) => updateForm("risk", event.target.value)} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5"><Label>Etkilenen</Label><Input className={riskInputClass} value={form.affected} onChange={(event) => updateForm("affected", event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Kontrol Tedbirleri *</Label><Input className={riskInputClass} placeholder="Alınacak önlemler..." value={form.controls} onChange={(event) => updateForm("controls", event.target.value)} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-700 bg-slate-950/30 p-3">
                <p className="mb-3 text-sm font-bold">1. Aşama (Mevcut Durum)</p>
                <div className="grid grid-cols-3 gap-2">{[["probabilityBefore", "Olasılık (O)"], ["frequencyBefore", "Frekans (F)"], ["severityBefore", "Şiddet (Ş)"]].map(([field, label]) => <div key={field} className="space-y-1"><Label className="text-[10px] text-slate-400">{label}</Label><Input className={`${riskInputClass} text-center`} type="number" min="1" value={form[field as keyof RiskFormState]} onChange={(event) => updateForm(field as keyof RiskFormState, event.target.value)} /></div>)}</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/30 p-3">
                <p className="mb-3 text-sm font-bold">2. Aşama (Tedbir Sonrası)</p>
                <div className="grid grid-cols-3 gap-2">{[["probabilityAfter", "Olasılık (O)"], ["frequencyAfter", "Frekans (F)"], ["severityAfter", "Şiddet (Ş)"]].map(([field, label]) => <div key={field} className="space-y-1"><Label className="text-[10px] text-slate-400">{label}</Label><Input className={`${riskInputClass} text-center`} type="number" min="1" value={form[field as keyof RiskFormState]} onChange={(event) => updateForm(field as keyof RiskFormState, event.target.value)} /></div>)}</div>
              </div>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 border-t border-slate-800 px-5 py-4 sm:flex sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="h-10 rounded-lg border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700">İptal</Button>
            <Button type="button" onClick={saveRisk} disabled={saving} className="h-10 rounded-lg bg-amber-500 text-white hover:bg-amber-400">Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="w-[calc(100vw-20px)] border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-5xl">
          <DialogHeader className="border-b border-slate-700 px-5 py-4">
            <DialogTitle className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300"><FileText className="h-5 w-5" /></span><span>Toplu Risk Maddesi Yükleme<span className="block text-sm font-normal text-slate-400">Excel dosyasından birden fazla risk maddesi ekleyin</span></span></DialogTitle>
          </DialogHeader>
          <div className="px-5 py-5">
            <div className="flex min-h-[100px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-600 bg-slate-950/20 p-5 text-center sm:flex-row">
              <Button type="button" onClick={downloadTemplate} className="rounded-lg bg-slate-700 text-white hover:bg-slate-600">Şablon Excel İndir</Button>
              <Button type="button" className="rounded-lg bg-violet-600 text-white hover:bg-violet-500" onClick={() => riskFileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Excel Dosyası Seç</Button>
              <input ref={riskFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleRiskFileUpload(event.target.files?.[0])} />
              <p className="w-full text-xs text-slate-400 sm:w-auto">Desteklenen formatlar: .xlsx, .xls</p>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-800 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} className="rounded-lg border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700">Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileRisksTabOld() {
  return <SimpleRecordsTab title="Risklerim" description="Kaydedilmiş risk maddelerinizi Risk Sihirbazı içinde yeniden kullanın." table="saved_risk_items" addLabel="Risk Ekle" fields={["category", "activity", "hazard_source", "risk_description", "current_measures", "probability", "severity", "additional_measures"]} />;
}

export function ProfileReportsTab() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<GenericRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [editingReport, setEditingReport] = useState<GenericRecord | null>(null);
  const [editForm, setEditForm] = useState({ title: "", report_type: "" });

  const loadReports = async () => {
    setLoading(true);
    const [reportRows, companyRows] = await Promise.all([
      safeRows<GenericRecord>("reports", "*", 500, (reportQuery) => {
        let next = reportQuery.order("created_at", { ascending: false });
        if (user?.id) next = next.eq("user_id", user.id);
        return next;
      }),
      loadProfileCompanies(profile?.organization_id, user?.id, 500),
    ]);
    setReports(reportRows);
    setCompanies(companyRows);
    setLoading(false);
  };

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.organization_id]);

  const companyNameById = useMemo(() => {
    return new Map(companies.map((company) => [company.id, company.name]));
  }, [companies]);

  const getReportContent = (report: GenericRecord) => {
    return report.content && typeof report.content === "object" && !Array.isArray(report.content) ? report.content as GenericRecord : {};
  };

  const getReportCompanyName = (report: GenericRecord) => {
    const content = getReportContent(report);
    const companyId = report.company_id || content.company_id || content.companyId;
    return (
      report.company_name ||
      report.companyName ||
      content.company_name ||
      content.companyName ||
      content.companyTitle ||
      content.company_title ||
      (companyId ? companyNameById.get(String(companyId)) : "") ||
      "Firma bilgisi yok"
    );
  };

  const formatReportDate = (value?: string | null) => {
    if (!value) return "Tarih yok";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Tarih yok";
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const reportTypes = useMemo(() => {
    return Array.from(new Set(reports.map((report) => String(report.report_type || "Rapor")).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
  }, [reports]);

  const reportCompanies = useMemo(() => {
    return Array.from(new Set(reports.map(getReportCompanyName))).filter(Boolean).sort((a, b) => a.localeCompare(b, "tr"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, companyNameById]);

  const filteredReports = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("tr-TR");
    return reports.filter((report) => {
      const companyName = getReportCompanyName(report);
      const type = String(report.report_type || "Rapor");
      const title = String(report.title || "Başlıksız rapor");
      const matchesSearch = !search || `${title} ${companyName} ${type}`.toLocaleLowerCase("tr-TR").includes(search);
      const matchesType = typeFilter === "ALL" || type === typeFilter;
      const matchesCompany = companyFilter === "ALL" || companyName === companyFilter;
      return matchesSearch && matchesType && matchesCompany;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, query, typeFilter, companyFilter, companyNameById]);

  const openEditDialog = (report: GenericRecord) => {
    setEditingReport(report);
    setEditForm({
      title: String(report.title || ""),
      report_type: String(report.report_type || ""),
    });
  };

  const saveReport = async () => {
    if (!editingReport?.id) return;
    try {
      const { error } = await db
        .from("reports")
        .update({ title: editForm.title.trim() || "Başlıksız rapor", report_type: editForm.report_type.trim() || "Rapor" })
        .eq("id", editingReport.id);
      if (error) throw error;
      toast.success("Rapor güncellendi");
      setEditingReport(null);
      await loadReports();
    } catch (error) {
      console.error("[Profile] rapor güncellenemedi", error);
      toast.error("Rapor güncellenemedi");
    }
  };

  const deleteReport = async (report: GenericRecord) => {
    if (!report.id || !confirm("Bu rapor kaydını silmek istiyor musunuz?")) return;
    try {
      const { error } = await db.from("reports").delete().eq("id", report.id);
      if (error) throw error;
      toast.success("Rapor silindi");
      await loadReports();
    } catch (error) {
      console.error("[Profile] rapor silinemedi", error);
      toast.error("Rapor silinemedi");
    }
  };

  const downloadReport = async (report: GenericRecord) => {
    const content = getReportContent(report);
    const rawUrl = report.file_url || report.download_url || report.public_url || content.file_url || content.downloadUrl || content.publicUrl;
    if (!rawUrl) {
      toast.info("Bu rapor için indirilebilir dosya bulunamadı.");
      return;
    }

    const url = String(rawUrl);
    const storageRef = parseStorageObjectRef(url, "reports");

    if (!storageRef) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const { data, error } = await supabase.storage.from(storageRef.bucket).createSignedUrl(storageRef.path, 60 * 60);
      if (error || !data?.signedUrl) throw error || new Error("Signed URL oluşturulamadı");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("[Profile] rapor indirme bağlantısı oluşturulamadı", error);
      const message = String(error?.message || "");
      if (message.toLocaleLowerCase("tr-TR").includes("bucket not found")) {
        toast.error("Rapor dosya alanı bulunamadı", {
          description: `"${storageRef.bucket}" storage bucket'ı canlı veritabanında oluşturulmamış. Lütfen reports bucket migration'ını uygulayın.`,
        });
        return;
      }
      toast.error("Rapor indirme bağlantısı oluşturulamadı.");
    }
  };

  return (
    <div className="space-y-4 text-slate-100">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 lg:grid lg:grid-cols-[1fr_220px_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ara..."
            className="h-10 rounded-xl border-slate-700 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-900 text-slate-100">
            <SelectValue placeholder="Tip" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tip</SelectItem>
            {reportTypes.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="h-10 rounded-xl border-slate-700 bg-slate-900 text-slate-100">
            <SelectValue placeholder="Tüm Firmalar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tüm Firmalar</SelectItem>
            {reportCompanies.map((company) => (
              <SelectItem key={company} value={company}>{company}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
        <div className="hidden grid-cols-[34px_1.4fr_0.8fr_0.8fr_190px] items-center gap-3 border-b border-slate-800 px-4 py-3 text-xs font-semibold text-slate-400 lg:grid">
          <div className="h-5 w-5 rounded-md border border-slate-600" />
          <span>Rapor</span>
          <span>Tip</span>
          <span>Tarih</span>
          <span className="text-right">İşlemler</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Raporlar yükleniyor...</div>
        ) : filteredReports.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-300">Henüz rapor bulunmuyor</p>
            <p className="mt-1 text-xs text-slate-500">Rapor oluşturduğunuzda bu alanda listelenir.</p>
          </div>
        ) : (
          filteredReports.map((report) => {
            const title = String(report.title || "Başlıksız rapor");
            const type = String(report.report_type || "Rapor");
            const companyName = getReportCompanyName(report);
            const reportDate = formatReportDate(report.generated_at || report.created_at);

            return (
              <div key={report.id || `${title}-${reportDate}`} className="grid gap-3 border-b border-slate-800 px-4 py-4 last:border-b-0 lg:grid-cols-[34px_1.4fr_0.8fr_0.8fr_190px] lg:items-center">
                <div className="hidden h-5 w-5 rounded-md border border-slate-600 lg:block" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white sm:text-base">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Firma: {companyName}</p>
                </div>
                <Badge className="w-fit rounded-full bg-cyan-500/15 px-3 py-1 text-cyan-200 hover:bg-cyan-500/20">{type}</Badge>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  <span>{reportDate}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Button type="button" size="sm" onClick={() => void downloadReport(report)} className="h-8 rounded-lg bg-slate-700 px-3 text-xs text-white hover:bg-slate-600">
                    <Download className="mr-1.5 h-3.5 w-3.5" />İndir
                  </Button>
                  <Button type="button" size="sm" onClick={() => openEditDialog(report)} className="h-8 rounded-lg bg-indigo-600/40 px-3 text-xs text-indigo-100 hover:bg-indigo-600/60">
                    <Edit2 className="mr-1.5 h-3.5 w-3.5" />Düzenle
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => void deleteReport(report)} className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={Boolean(editingReport)} onOpenChange={(open) => !open && setEditingReport(null)}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Raporu Düzenle</DialogTitle>
            <DialogDescription>Rapor başlığı ve tip bilgisini güncelleyin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Rapor Başlığı</Label>
              <Input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} className="rounded-xl border-slate-700 bg-slate-900" />
            </div>
            <div className="space-y-2">
              <Label>Rapor Tipi</Label>
              <Input value={editForm.report_type} onChange={(event) => setEditForm((current) => ({ ...current, report_type: event.target.value }))} className="rounded-xl border-slate-700 bg-slate-900" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingReport(null)} className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">İptal</Button>
            <Button type="button" onClick={() => void saveReport()} className="bg-blue-600 text-white hover:bg-blue-500">Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type CompanyVisitRow = GenericRecord & {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  visit_date?: string | null;
  visit_time?: string | null;
  visit_type?: string | null;
  notes?: string | null;
  next_visit_date?: string | null;
};

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatVisitDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function ProfileVisitsTab() {
  const { user, profile } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date(`${today}T12:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [visits, setVisits] = useState<CompanyVisitRow[]>([]);
  const [companyNames, setCompanyNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadVisits = async () => {
      setLoading(true);
      const rows = await safeRows<CompanyVisitRow>("company_visits", "*", 700, (query) => {
        let next = query.order("visit_date", { ascending: false });
        if (user?.id) next = next.eq("user_id", user.id);
        return next;
      });

      const ids = Array.from(new Set(rows.map((row) => row.company_id).filter(Boolean))) as string[];
      const names = new Map<string, string>();

      if (ids.length > 0) {
        try {
          const { data } = await db.from("companies").select("id,name").in("id", ids);
          ((data || []) as { id: string; name?: string | null }[]).forEach((row) => {
            if (row.id) names.set(row.id, row.name || "İsimsiz firma");
          });
        } catch (error) {
          console.warn("[Profile] ziyaret firma adları alınamadı", error);
        }

        try {
          const { data } = await db.from("isgkatip_companies").select("id,company_name").in("id", ids);
          ((data || []) as { id: string; company_name?: string | null }[]).forEach((row) => {
            if (row.id && !names.has(row.id)) names.set(row.id, row.company_name || "İsimsiz İSG-KATİP firması");
          });
        } catch (error) {
          console.warn("[Profile] OSGB ziyaret firma adları alınamadı", error);
        }
      }

      if (!active) return;
      setVisits(rows);
      setCompanyNames(names);
      setLoading(false);
    };

    void loadVisits();
    return () => {
      active = false;
    };
  }, [profile?.organization_id, user?.id]);

  const monthLabel = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(currentMonth);
  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
    const blanks = Array.from({ length: mondayFirstOffset }, () => null);
    const days = Array.from({ length: lastDay.getDate() }, (_, index) => new Date(year, month, index + 1));
    return [...blanks, ...days];
  }, [currentMonth]);

  const visitDateSet = useMemo(() => new Set(visits.map((visit) => visit.visit_date).filter(Boolean)), [visits]);
  const selectedVisits = visits.filter((visit) => visit.visit_date === selectedDate);
  const visitedCompanyCount = new Set(visits.map((visit) => visit.company_id).filter(Boolean)).size;

  const changeMonth = (offset: number) => {
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  };

  const getCompanyName = (visit: CompanyVisitRow) =>
    visit.company_name || (visit.company_id ? companyNames.get(visit.company_id) : null) || "Firma bilgisi yok";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Firma Ziyaretlerim</h2>
          <p className="mt-1 text-sm text-slate-400">Geçmiş firma ziyaretlerinizi takip edin.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-[56px] rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-center">
            <p className="text-xl font-black text-white">{loading ? "..." : visits.length}</p>
            <p className="mt-1 text-[11px] text-slate-400">Ziyaret</p>
          </div>
          <div className="min-w-[56px] rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-center">
            <p className="text-xl font-black text-white">{loading ? "..." : visitedCompanyCount}</p>
            <p className="mt-1 text-[11px] text-slate-400">Firma</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
        <Card className="border-slate-700 bg-slate-900/65 text-slate-100">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-200 hover:bg-slate-800" onClick={() => changeMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="font-black capitalize text-white">{monthLabel}</p>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-200 hover:bg-slate-800" onClick={() => changeMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-[11px] text-slate-400">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-7 gap-2">
              {monthDays.map((day, index) => {
                if (!day) return <span key={`blank-${index}`} />;
                const iso = toIsoDate(day);
                const selected = iso === selectedDate;
                const hasVisit = visitDateSet.has(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                    className={cn(
                      "relative flex h-9 items-center justify-center rounded-xl text-sm font-semibold transition",
                      selected ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "text-slate-100 hover:bg-slate-800",
                    )}
                  >
                    {day.getDate()}
                    {hasVisit ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-cyan-300" /> : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[282px] border-slate-700 bg-slate-900/65 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-black text-white">
              <CalendarDays className="h-4 w-4 text-blue-300" />
              {formatVisitDateLabel(selectedDate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-[180px] items-center justify-center text-sm text-slate-400">Ziyaret kayıtları yükleniyor...</div>
            ) : selectedVisits.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
                <MapPin className="h-11 w-11 text-slate-600" />
                <p className="mt-4 text-sm text-slate-400">Bu tarihte ziyaret kaydınız bulunmuyor.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedVisits.map((visit) => (
                  <div key={visit.id} className="rounded-2xl border border-slate-700 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{getCompanyName(visit)}</p>
                        <p className="mt-1 text-xs text-slate-400">{visit.visit_type || "Firma ziyareti"}{visit.visit_time ? ` · ${String(visit.visit_time).slice(0, 5)}` : ""}</p>
                      </div>
                      <Badge className="w-fit rounded-lg bg-blue-500/15 text-blue-100">{visit.next_visit_date ? `Sonraki: ${formatVisitDateLabel(visit.next_visit_date)}` : "Tamamlandı"}</Badge>
                    </div>
                    {visit.notes ? <p className="mt-3 whitespace-pre-line text-xs leading-5 text-slate-400">{visit.notes}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ProfileSubscriptionTab() {
  const { loading, plan, status, demoState } = useSubscription();
  const demoEndsAt = demoState.endsAt ? new Date(demoState.endsAt) : null;
  const demoEndDateLabel = demoEndsAt && Number.isFinite(demoEndsAt.getTime())
    ? demoEndsAt.toLocaleDateString("tr-TR")
    : "-";
  const planLabel = demoState.isActive
    ? "OSGB Demo Üyelik"
    : plan === "osgb"
      ? "OSGB"
      : plan === "premium"
        ? "Uzman / Premium"
        : "Ücretsiz";
  const statusLabel = demoState.isActive
    ? `Demo Aktif • ${demoState.daysLeft} gün kaldı`
    : demoState.hasDemo && demoState.hasExpired
      ? "Demo Süresi Doldu"
      : status === "trial"
        ? "Deneme aktif"
        : status === "premium"
          ? "Aktif kullanım"
          : "Free kullanım";

  return (
    <PanelShell title="Abonelik" description="Paket, kullanım limitleri ve yükseltme işlemleri.">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          <CreditCard className="h-6 w-6 text-cyan-300" />
          <p className="mt-3 font-bold">Mevcut Paket</p>
          <p className="text-sm text-slate-400">{loading ? "Yükleniyor..." : planLabel}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          <CheckCircle2 className="h-6 w-6 text-emerald-300" />
          <p className="mt-3 font-bold">Durum</p>
          <p className="text-sm text-slate-400">{loading ? "Kontrol ediliyor..." : statusLabel}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          {demoState.hasDemo ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
              <p className="font-black">{demoState.isActive ? "OSGB Demo Üyelik" : "Demo Süresi Doldu"}</p>
              <p className="mt-2 text-xs text-amber-100/85">Bitiş: {demoEndDateLabel}</p>
              <p className="mt-1 text-xs text-amber-100/85">
                {demoState.isActive ? `Kalan: ${demoState.daysLeft} gün` : "Üyeliğe geçerek OSGB erişimini sürdürebilirsiniz."}
              </p>
            </div>
          ) : (
            <Button className="w-full rounded-xl bg-blue-600 text-white">Paket Yükselt</Button>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

export function ProfileSettingsTab() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-2">
      <SettingsPage />
    </div>
  );
}
