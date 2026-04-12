import { useEffect, useMemo, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssignmentTypeCards } from "@/components/assignment-letters/AssignmentTypeCards";
import { AssignmentFormModal, type AssignmentFormValues } from "@/components/assignment-letters/AssignmentFormModal";
import { AssignmentHistoryTable, type AssignmentHistoryItem } from "@/components/assignment-letters/AssignmentHistoryTable";
import {
  generateAssignmentPDF,
  type AssignmentPDFData,
  type AssignmentType,
  type HazardClass,
} from "@/lib/assignmentPdfGenerator";
import type { Company, Employee } from "@/types/companies";

interface CompanyRecord extends Company {
  logo_url?: string | null;
}

interface AssignmentLetterRow {
  id: string;
  company_id: string;
  employee_id: string;
  assignment_type: AssignmentType;
  start_date: string;
  duration: number;
  weekly_hours: number;
  created_at: string;
}

const defaultForm: AssignmentFormValues = {
  company_id: "",
  employee_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  duration: "12",
  weekly_hours: "2",
  hazard_class: "Az Tehlikeli",
};

const assignmentLabels: Record<AssignmentType, string> = {
  risk_assessment_team: "Risk Değerlendirme Ekibi Atama Yazısı",
  support_staff: "Destek Elemanı Atama Yazısı",
  employee_representative: "Çalışan Temsilcisi Atama Yazısı",
};

function normalizeHazardClass(value?: string | null): HazardClass {
  if (!value) return "Az Tehlikeli";
  if (value.includes("Çok") || value.includes("Ã‡ok")) return "Çok Tehlikeli";
  if (value.includes("Tehlikeli") && !value.includes("Az")) return "Tehlikeli";
  return "Az Tehlikeli";
}

function mapCompany(row: any): CompanyRecord {
  return {
    ...row,
    owner_id: row.user_id,
    company_name: row.name,
    nace_code: row.industry || "",
    hazard_class: normalizeHazardClass(row.hazard_class) as unknown as Company["hazard_class"],
    employee_count: Number(row.employee_count || 0),
    logo_url: row.logo_url || null,
  };
}

function mapEmployee(row: any): Employee {
  return {
    ...row,
    tc_number: row.tc_number || "",
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    job_title: row.job_title || "",
    start_date: row.start_date || new Date().toISOString().slice(0, 10),
    is_active: row.is_active !== false,
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
    company_id: row.company_id,
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

function buildDocumentNumber(row: AssignmentLetterRow) {
  const year = new Date(row.created_at || Date.now()).getFullYear();
  return `ATM-${year}-${row.id.slice(0, 8).toUpperCase()}`;
}

export default function AssignmentLetters() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [historyRows, setHistoryRows] = useState<AssignmentLetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeType, setActiveType] = useState<AssignmentType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentFormValues>(defaultForm);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setLoading(true);
    try {
      await Promise.all([loadCompanies(), loadEmployees(), loadHistory()]);
    } catch (error: any) {
      toast.error(`Atama yazıları verileri yüklenemedi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    const { data, error } = await (supabase as any)
      .from("companies")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    setCompanies((data || []).map(mapCompany));
  }

  async function loadEmployees() {
    const { data, error } = await (supabase as any)
      .from("employees")
      .select("*")
      .eq("is_active", true)
      .order("first_name", { ascending: true });

    if (error) throw error;
    setEmployees((data || []).map(mapEmployee));
  }

  async function loadHistory() {
    const { data, error } = await (supabase as any)
      .from("assignment_letters")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    setHistoryRows(data || []);
  }

  function resetModalState() {
    setModalOpen(false);
    setActiveType(null);
    setEditingId(null);
    setForm(defaultForm);
  }

  function openCreateModal(type: AssignmentType) {
    setEditingId(null);
    setActiveType(type);
    setForm(defaultForm);
    setModalOpen(true);
  }

  const historyItems = useMemo<AssignmentHistoryItem[]>(() => {
    return historyRows.map((row) => {
      const company = companies.find((item) => item.id === row.company_id);
      const employee = employees.find((item) => item.id === row.employee_id);
      return {
        id: row.id,
        companyName: company?.company_name || "Firma bulunamadı",
        employeeName: employee ? `${employee.first_name} ${employee.last_name}`.trim() : "Personel bulunamadı",
        assignmentTypeLabel: assignmentLabels[row.assignment_type] || row.assignment_type,
        createdAt: formatDate(row.created_at),
      };
    });
  }, [companies, employees, historyRows]);

  async function resolveCompanyLogoUrl(company?: CompanyRecord) {
    if (!company?.logo_url) return undefined;
    if (company.logo_url.startsWith("http") || company.logo_url.startsWith("data:")) {
      return company.logo_url;
    }

    const companyBucket = await supabase.storage.from("company-logos").createSignedUrl(company.logo_url, 3600);
    if (!companyBucket.error && companyBucket.data?.signedUrl) {
      return companyBucket.data.signedUrl;
    }

    const certificateBucket = await supabase.storage.from("certificate-files").createSignedUrl(company.logo_url, 3600);
    if (!certificateBucket.error && certificateBucket.data?.signedUrl) {
      return certificateBucket.data.signedUrl;
    }

    return undefined;
  }

  async function buildPdfData(
    type: AssignmentType,
    row: AssignmentLetterRow,
    hazardClass: HazardClass = "Az Tehlikeli"
  ): Promise<AssignmentPDFData | null> {
    const company = companies.find((item) => item.id === row.company_id);
    const employee = employees.find((item) => item.id === row.employee_id);
    if (!company || !employee) return null;

    const companyLogoUrl = await resolveCompanyLogoUrl(company);

    return {
      assignmentType: type,
      assignmentTitle: assignmentLabels[type],
      companyName: company.company_name,
      companyLogoUrl,
      employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
      employeeJobTitle: employee.job_title || "-",
      startDate: row.start_date,
      duration: Number(row.duration || 0),
      weeklyHours: Number(row.weekly_hours || 0),
      hazardClass,
      createdAt: row.created_at,
      documentNumber: buildDocumentNumber(row),
    };
  }

  async function handleCreateAssignment() {
    if (!activeType) return;
    if (!form.company_id || !form.employee_id || !form.start_date || !form.duration || !form.weekly_hours) {
      toast.error("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_id: form.company_id,
        employee_id: form.employee_id,
        assignment_type: activeType,
        start_date: form.start_date,
        duration: Number(form.duration),
        weekly_hours: Number(form.weekly_hours),
      };

      let savedRow: AssignmentLetterRow | null = null;

      if (editingId) {
        const { data, error } = await (supabase as any)
          .from("assignment_letters")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .single();

        if (error) throw error;
        savedRow = data as AssignmentLetterRow;
      } else {
        const { data, error } = await (supabase as any)
          .from("assignment_letters")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;
        savedRow = data as AssignmentLetterRow;
      }

      const pdfData = await buildPdfData(activeType, savedRow, form.hazard_class);
      if (!pdfData) {
        toast.error("Belge kaydedildi ancak PDF için firma veya personel bilgisi bulunamadı.");
      } else {
        await generateAssignmentPDF(pdfData);
      }

      toast.success(editingId ? "Atama yazısı güncellendi." : "Atama yazısı oluşturuldu.");
      resetModalState();
      await loadHistory();
    } catch (error: any) {
      toast.error(`Atama yazısı kaydedilemedi: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadHistoryItem(id: string) {
    const row = historyRows.find((item) => item.id === id);
    if (!row) {
      toast.error("Belge kaydı bulunamadı.");
      return;
    }

    const company = companies.find((item) => item.id === row.company_id);
    const hazardClass = normalizeHazardClass(company?.hazard_class);
    const pdfData = await buildPdfData(row.assignment_type, row, hazardClass);
    if (!pdfData) {
      toast.error("İlgili firma veya personel kaydı bulunamadı.");
      return;
    }

    await generateAssignmentPDF(pdfData);
  }

  function handleEditHistoryItem(id: string) {
    const row = historyRows.find((item) => item.id === id);
    if (!row) {
      toast.error("Düzenlenecek belge bulunamadı.");
      return;
    }

    const company = companies.find((item) => item.id === row.company_id);
    setEditingId(row.id);
    setActiveType(row.assignment_type);
    setForm({
      company_id: row.company_id,
      employee_id: row.employee_id,
      start_date: row.start_date,
      duration: String(row.duration ?? 12),
      weekly_hours: String(row.weekly_hours ?? 0),
      hazard_class: normalizeHazardClass(company?.hazard_class),
    });
    setModalOpen(true);
  }

  async function handleDeleteHistoryItem(id: string) {
    const confirmed = window.confirm("Bu atama yazısını silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    try {
      const { error } = await (supabase as any).from("assignment_letters").delete().eq("id", id);
      if (error) throw error;
      setHistoryRows((prev) => prev.filter((item) => item.id !== id));
      toast.success("Atama yazısı silindi.");
    } catch (error: any) {
      toast.error(`Belge silinemedi: ${error.message}`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            <ShieldCheck className="h-4 w-4" />
            Resmi Belge Modülü
          </div>
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-black tracking-tight text-foreground lg:text-4xl">
            <FileText className="h-8 w-8 text-primary" />
            Atama Yazıları
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground lg:text-base">
            İSG profesyonelleri için resmi atama ve görevlendirme belgeleri oluşturun.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="px-3 py-1">PDF üretimi</Badge>
          <Badge variant="secondary" className="px-3 py-1">Kurumsal belge akışı</Badge>
        </div>
      </section>
      <AssignmentTypeCards onCreate={openCreateModal} />

      <Card className="border-slate-700/70 bg-gradient-to-r from-slate-950/80 to-slate-900/60">
        <CardHeader>
          <CardTitle className="text-slate-100">Minimum Süre Kuralı</CardTitle>
          <CardDescription className="text-slate-400">
            Tehlike sınıfına göre sistem bilgi amaçlı minimum süre uyarısı gösterir.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">Az Tehlikeli: çalışan başına 10 dakika</div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">Tehlikeli: çalışan başına 20 dakika</div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">Çok Tehlikeli: çalışan başına 40 dakika</div>
        </CardContent>
      </Card>

      <AssignmentHistoryTable
        items={historyItems}
        onDownload={handleDownloadHistoryItem}
        onEdit={handleEditHistoryItem}
        onDelete={handleDeleteHistoryItem}
      />

      <AssignmentFormModal
        open={modalOpen}
        assignmentType={activeType}
        mode={editingId ? "edit" : "create"}
        value={form}
        companies={companies}
        employees={employees}
        saving={saving}
        onOpenChange={(open) => {
          if (!open) {
            resetModalState();
            return;
          }
          setModalOpen(true);
        }}
        onValueChange={(patch) => {
          setForm((prev) => {
            const next = { ...prev, ...patch };
            if (patch.company_id) {
              const company = companies.find((item) => item.id === patch.company_id);
              next.hazard_class = normalizeHazardClass(company?.hazard_class);
            }
            return next;
          });
        }}
        onSubmit={handleCreateAssignment}
      />

      {loading ? <div className="text-sm text-muted-foreground">Atama yazıları yükleniyor...</div> : null}
    </div>
  );
}
