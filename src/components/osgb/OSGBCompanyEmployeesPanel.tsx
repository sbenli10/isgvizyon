import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, Plus, Search, Upload, UserRound, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createOsgbCompanyEmployee,
  listOsgbCompanyEmployees,
  listOsgbWorkspaceCompanies,
  type OsgbCompanyEmployeeRecord,
  type OsgbWorkspaceCompanyOption,
} from "@/lib/osgbPlatform";

const inputClass = "h-9 border-slate-700/70 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/40";
const selectTriggerClass = "h-9 border-slate-700/70 bg-slate-900/70 text-slate-100 focus:ring-blue-500/40";
const selectContentClass = "z-[130] border-slate-700 bg-slate-900 text-slate-100";

interface EmployeeFormState {
  companyId: string;
  fullName: string;
  tcNumber: string;
  jobTitle: string;
  department: string;
  phone: string;
  email: string;
  startDate: string;
}

const emptyForm: EmployeeFormState = {
  companyId: "",
  fullName: "",
  tcNumber: "",
  jobTitle: "",
  department: "",
  phone: "",
  email: "",
  startDate: "",
};

function NewEmployeeDialog({ open, onOpenChange, companies, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; companies: OsgbWorkspaceCompanyOption[]; onSaved: () => void }) {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...emptyForm, companyId: companies[0]?.id || "" });
  }, [companies, open]);

  const updateForm = (key: keyof EmployeeFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!organizationId || !user?.id) return toast.error("Çalışan kaydı için organizasyon bağlantısı gerekli.");
    if (!form.companyId || !form.fullName.trim()) return toast.error("Firma ve ad soyad zorunludur.");

    setSaving(true);
    try {
      await createOsgbCompanyEmployee({
        organizationId,
        userId: user.id,
        companyId: form.companyId,
        fullName: form.fullName,
        tcNumber: form.tcNumber,
        jobTitle: form.jobTitle,
        department: form.department,
        phone: form.phone,
        email: form.email,
        startDate: form.startDate,
      });
      toast.success("Çalışan kaydedildi.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çalışan kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] max-w-[760px] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">Yeni Çalışan</DialogTitle>
        <DialogDescription className="sr-only">OSGB firma çalışanı kaydı oluşturun.</DialogDescription>
        <div className="flex items-start justify-between border-b border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-300"><UserRound className="h-6 w-6" /></div>
            <div><h2 className="text-xl font-black text-white">Yeni Çalışan</h2><p className="mt-1 text-sm text-slate-400">Firma portalı ve OSGB takip akışları için çalışan kaydı ekleyin.</p></div>
          </div>
          <DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2"><Label className="text-slate-300">Firma *</Label><Select value={form.companyId} onValueChange={(value) => updateForm("companyId", value)}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Firma seçin" /></SelectTrigger><SelectContent className={selectContentClass}>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label className="text-slate-300">Ad Soyad *</Label><Input className={inputClass} value={form.fullName} onChange={(event) => updateForm("fullName", event.target.value)} placeholder="Ad Soyad" /></div>
          <div className="space-y-2"><Label className="text-slate-300">TC Kimlik No</Label><Input className={inputClass} value={form.tcNumber} onChange={(event) => updateForm("tcNumber", event.target.value)} placeholder="TC Kimlik No" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Görev/Unvan</Label><Input className={inputClass} value={form.jobTitle} onChange={(event) => updateForm("jobTitle", event.target.value)} placeholder="Görev/Unvan" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Departman</Label><Input className={inputClass} value={form.department} onChange={(event) => updateForm("department", event.target.value)} placeholder="Departman" /></div>
          <div className="space-y-2"><Label className="text-slate-300">Telefon</Label><Input className={inputClass} value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="Telefon" /></div>
          <div className="space-y-2"><Label className="text-slate-300">E-posta</Label><Input className={inputClass} type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="E-posta" /></div>
          <div className="space-y-2"><Label className="text-slate-300">İşe giriş tarihi</Label><div className="relative"><Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></div></div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 bg-slate-900/60 p-4"><DialogClose asChild><Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">İptal</Button></DialogClose><Button type="button" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-500" onClick={handleSave}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Kaydet</Button></div>
      </DialogContent>
    </Dialog>
  );
}

export function OSGBCompanyEmployeesPanel({ refreshKey }: { refreshKey: number }) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [companies, setCompanies] = useState<OsgbWorkspaceCompanyOption[]>([]);
  const [employees, setEmployees] = useState<OsgbCompanyEmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [newEmployeeOpen, setNewEmployeeOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setCompanies([]);
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [companyRows, employeeRows] = await Promise.all([
        listOsgbWorkspaceCompanies(organizationId),
        listOsgbCompanyEmployees(organizationId),
      ]);
      setCompanies(companyRows);
      setEmployees(employeeRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma çalışanları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const filteredEmployees = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("tr-TR");
    const rows = employees.filter((employee) => {
      if (companyFilter !== "all" && employee.companyId !== companyFilter) return false;
      if (!normalized) return true;
      return `${employee.fullName} ${employee.tcNumber || ""} ${employee.companyName}`.toLocaleLowerCase("tr-TR").includes(normalized);
    });

    return rows.sort((a, b) => {
      if (sort === "name_desc") return b.fullName.localeCompare(a.fullName, "tr-TR");
      if (sort === "date_desc") return (b.startDate || "").localeCompare(a.startDate || "");
      return a.fullName.localeCompare(b.fullName, "tr-TR");
    });
  }, [companyFilter, employees, search, sort]);

  if (loading) return <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-300" /></div>;

  return (
    <div className="min-h-full rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-slate-100 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300"><Users className="h-5 w-5" /></div>
          <div><h2 className="text-xl font-black text-white">Firma Çalışanları</h2><p className="mt-1 text-sm text-slate-400">OSGB firmalarınıza ait {employees.length} çalışan kaydı</p></div>
        </div>
        <div className="flex flex-wrap gap-2"><Button type="button" className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => toast.info("Toplu çalışan yükleme akışı hazırlanıyor.")}><Upload className="mr-2 h-4 w-4" />Toplu Yükle</Button><Button type="button" className="bg-blue-600 text-white hover:bg-blue-500" onClick={() => setNewEmployeeOpen(true)}><Plus className="mr-2 h-4 w-4" />Yeni Çalışan</Button></div>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(240px,0.9fr)_minmax(240px,2fr)_minmax(150px,0.35fr)]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="İsim veya TC Kimlik No ara..." /></div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Tüm Firmalar" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">Tüm Firmalar</SelectItem>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={setSort}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="İsim (A-Z)" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="name_asc">İsim (A-Z)</SelectItem><SelectItem value="name_desc">İsim (Z-A)</SelectItem><SelectItem value="date_desc">İşe giriş tarihi</SelectItem></SelectContent></Select>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{error}</div> : null}

      <div className="min-h-[260px] rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4">
        {filteredEmployees.length ? (
          <div className="space-y-2">
            {filteredEmployees.map((employee) => (
              <div key={employee.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/35 p-4 transition hover:border-blue-500/35 hover:bg-slate-900">
                <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 text-slate-300"><UserRound className="h-5 w-5" /></div><div><p className="font-black text-white">{employee.fullName}</p><p className="mt-1 text-xs text-slate-400">{employee.companyName} · {employee.tcNumber || "TC yok"}</p></div></div>
                <div className="text-right text-xs text-slate-400"><p>{employee.jobTitle || "Unvan yok"}</p><p>{employee.department || "Departman yok"}</p></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[245px] place-items-center text-center">
            <div>
              <Users className="mx-auto h-12 w-12 text-slate-600" />
              <h3 className="mt-4 text-base font-black text-slate-300">Henüz kayıtlı çalışan bulunmuyor.</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Firmalarınızın portallarında çalışan kayıtları oluşturulduğunda burada görünecek.</p>
            </div>
          </div>
        )}
      </div>

      <NewEmployeeDialog open={newEmployeeOpen} onOpenChange={setNewEmployeeOpen} companies={companies} onSaved={() => void loadData()} />
    </div>
  );
}
