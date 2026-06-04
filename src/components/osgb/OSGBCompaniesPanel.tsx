import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowUp,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  Grid2X2,
  List,
  Loader2,
  Plus,
  Search,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  listOsgbWorkspaceCompanies,
  listOsgbWorkspacePersonnel,
  type OsgbWorkspaceCompanyOption,
  type OsgbWorkspacePersonnelRecord,
} from "@/lib/osgbPlatform";

type CompanyStatusFilter = "all" | "approved" | "personnel_pending" | "workplace_pending" | "zero_employee" | "no_contract" | "planned";
type ViewMode = "list" | "grid";

const inputClass = "h-9 border-slate-700/70 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/40";
const selectTriggerClass = "h-9 min-w-[128px] border-slate-700/70 bg-slate-900/70 text-xs font-bold text-slate-100 focus:ring-blue-500/40";
const selectContentClass = "z-[130] border-slate-700 bg-slate-900 text-slate-100";

const formatNumber = (value: number | string | null | undefined) => {
  const numericValue =
    typeof value === "number"
      ? value
      : Number(String(value ?? 0).replace(",", "."));

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("tr-TR").format(numericValue);
};
const normalizeHazard = (value: string) => value.toLocaleLowerCase("tr-TR");

const isLowHazard = (value: string) => normalizeHazard(value).includes("az");
const isMediumHazard = (value: string) => normalizeHazard(value).includes("tehlikeli") && !normalizeHazard(value).includes("çok");
const isHighHazard = (value: string) => normalizeHazard(value).includes("çok");

function MetricBox({ value, label, tone }: { value: string | number; label: string; tone: "slate" | "emerald" | "orange" | "rose" | "blue" | "purple" }) {
  const tones = {
    slate: "border-blue-400/25 bg-slate-800/70 text-blue-200",
    emerald: "border-emerald-400/35 bg-emerald-500/15 text-emerald-300",
    orange: "border-orange-400/35 bg-orange-500/15 text-orange-300",
    rose: "border-rose-400/35 bg-rose-500/15 text-rose-300",
    blue: "border-blue-400/35 bg-blue-500/15 text-blue-300",
    purple: "border-purple-400/35 bg-purple-500/15 text-purple-300",
  } as const;

  return (
    <div className={cn("min-w-[135px] rounded-xl border px-4 py-3 text-center shadow-sm", tones[tone])}>
      <div className="text-lg font-black leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-90">{label}</div>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, description, minHeight = "min-h-[240px]" }: { icon: typeof Building2; title: string; description: string; minHeight?: string }) {
  return (
    <div className={cn("grid place-items-center rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 text-center", minHeight)}>
      <div>
        <Icon className="mx-auto h-12 w-12 text-slate-600" />
        <h3 className="mt-4 text-base font-black text-slate-200">{title}</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function MissingAssignmentsDialog({ open, onOpenChange, companies, onOpenBulkAssignment }: { open: boolean; onOpenChange: (open: boolean) => void; companies: OsgbWorkspaceCompanyOption[]; onOpenBulkAssignment: () => void }) {
  const [service, setService] = useState("all");
  const [category, setCategory] = useState("all");
  const missingCompanies = companies.filter((company) => company.deficitMinutes > 0);

  const copySgkNumbers = async () => {
    const value = missingCompanies.map((company) => company.sgkNo).filter(Boolean).join("\n");
    if (!value) return toast.info("Kopyalanacak SGK No bulunamadı.");
    await navigator.clipboard.writeText(value);
    toast.success("SGK numaraları kopyalandı.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex h-[75vh] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">Eksik Ataması Olan Firmalar</DialogTitle>
        <DialogDescription className="sr-only">Eksik ataması olan firmaları filtreleyin.</DialogDescription>
        <div className="flex items-start justify-between border-b border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Eksik Ataması Olan Firmalar</h2>
              <p className="mt-1 text-sm text-slate-400">Toplam {missingCompanies.length} firmada hizmet eksikliği tespit edildi</p>
            </div>
          </div>
          <DialogClose asChild>
            <button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
          </DialogClose>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
            <span>Hizmet:</span>
            {[{ id: "all", label: "Tümü" }, { id: "igu", label: "İGU" }, { id: "ih", label: "İH" }, { id: "both", label: "İGU + İH" }].map((item) => (
              <button key={item.id} type="button" onClick={() => setService(item.id)} className={cn("rounded-lg border px-3 py-2 transition", service === item.id ? "border-blue-500 bg-blue-600 text-white" : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800")}>{item.label}</button>
            ))}
            <span className="ml-2">Kategori:</span>
            {[{ id: "all", label: "Tümü" }, { id: "planned", label: "Planlanan" }, { id: "no_contract", label: "Sözleşme Yok" }].map((item) => (
              <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={cn("rounded-lg border px-3 py-2 transition", category === item.id ? "border-blue-500 bg-slate-700 text-white" : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800")}>{item.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white" onClick={copySgkNumbers}><Copy className="mr-2 h-4 w-4" />Tüm SGK No Kopyala</Button>
            <Button type="button" className="bg-slate-500 text-white hover:bg-slate-400" onClick={onOpenBulkAssignment}><UserPlus className="mr-2 h-4 w-4" />Çoklu Atama Yap ({missingCompanies.length})</Button>
          </div>
        </div>

        <div className="grid flex-1 place-items-center bg-slate-950 p-8 text-center">
          {missingCompanies.length === 0 ? (
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-9 w-9" /></div>
              <h3 className="mt-5 text-xl font-black text-white">Harika!</h3>
              <p className="mt-2 text-sm text-slate-400">Şu an için ataması eksik olan herhangi bir firma bulunmuyor.</p>
            </div>
          ) : (
            <div className="w-full max-w-3xl space-y-2 text-left">
              {missingCompanies.map((company) => (
                <div key={company.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div><p className="font-bold text-white">{company.companyName}</p><p className="text-xs text-slate-400">{company.sgkNo || "SGK yok"} · Eksik {company.deficitMinutes} dk</p></div>
                  <span className="text-sm font-black text-rose-300">{company.deficitMinutes} dk</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-800 bg-slate-900/60 p-4">
          <DialogClose asChild><Button type="button" className="bg-slate-800 text-slate-100 hover:bg-slate-700">Kapat</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BulkAssignmentDialog({ open, onOpenChange, companies, personnel }: { open: boolean; onOpenChange: (open: boolean) => void; companies: OsgbWorkspaceCompanyOption[]; personnel: OsgbWorkspacePersonnelRecord[] }) {
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  const visiblePersonnel = personnel.filter((item) => item.full_name.toLocaleLowerCase("tr-TR").includes(personnelSearch.toLocaleLowerCase("tr-TR")));
  const visibleCompanies = companies.filter((item) => `${item.companyName} ${item.sgkNo || ""}`.toLocaleLowerCase("tr-TR").includes(companySearch.toLocaleLowerCase("tr-TR")));

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex h-[75vh] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">Toplu Atama Ekle</DialogTitle>
        <DialogDescription className="sr-only">Personel seçerek firmalara toplu atama yapın.</DialogDescription>
        <div className="flex items-start justify-between border-b border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300"><UserPlus className="h-6 w-6" /></div>
            <div><h2 className="text-xl font-black text-white">Toplu Atama Ekle</h2><p className="mt-1 text-sm text-slate-400">Personel havuzundan bir personel seç, atamak istediğin firmaları işaretle.</p></div>
          </div>
          <DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose>
        </div>

        <div className="flex-1 overflow-auto bg-slate-950">
          <section className="border-b border-slate-800 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-black text-white"><Users className="h-4 w-4 text-emerald-300" />Personel Havuzu <span className="text-xs text-slate-500">({personnel.length})</span></h3><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={personnelSearch} onChange={(event) => setPersonnelSearch(event.target.value)} placeholder="Personel ara..." /></div></div>
            {visiblePersonnel.length ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{visiblePersonnel.map((person) => <button key={person.id} type="button" onClick={() => setSelectedPersonnelId(person.id)} className={cn("rounded-xl border p-3 text-left transition", selectedPersonnelId === person.id ? "border-emerald-400 bg-emerald-500/15" : "border-slate-800 bg-slate-900/60 hover:border-slate-700")}><p className="font-bold text-white">{person.full_name}</p><p className="mt-1 text-xs text-slate-400">{person.role.toUpperCase()} · {person.monthly_capacity_minutes} dk</p></button>)}</div> : <div className="py-6 text-center text-sm text-slate-500">Personel bulunamadı. Önce “Personeller” sekmesinden personel ekleyin.</div>}
          </section>

          <section className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-black text-white"><Building2 className="h-4 w-4 text-blue-300" />OSGB Firmaları <span className="text-xs text-slate-500">({companies.length})</span></h3><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="h-9 border-slate-700 bg-slate-900 text-xs text-slate-100 hover:bg-slate-800" onClick={() => setSelectedCompanyIds(visibleCompanies.map((item) => item.id))}>Tümünü Seç</Button><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Firma, SGK No ara..." /></div></div></div>
            {visibleCompanies.length ? <div className="grid gap-2 md:grid-cols-2">{visibleCompanies.map((company) => <button key={company.id} type="button" onClick={() => toggleCompany(company.id)} className={cn("rounded-xl border p-3 text-left transition", selectedCompanyIds.includes(company.id) ? "border-blue-400 bg-blue-500/15" : "border-slate-800 bg-slate-900/60 hover:border-slate-700")}><p className="font-bold text-white">{company.companyName}</p><p className="mt-1 text-xs text-slate-400">{company.sgkNo || "SGK yok"} · {company.hazardClass}</p></button>)}</div> : <div className="grid min-h-[220px] place-items-center text-sm text-slate-500">Firma bulunamadı.</div>}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-3"><span className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white">{selectedCompanyIds.length} firma seçili</span><span className="text-xs italic text-slate-500">{selectedPersonnelId ? "Atama hazır" : "Önce personel seçin"}</span></div>
          <div className="flex gap-2"><DialogClose asChild><Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">İptal</Button></DialogClose><Button type="button" disabled={!selectedPersonnelId || selectedCompanyIds.length === 0} className="bg-slate-500 text-white hover:bg-slate-400 disabled:opacity-60" onClick={() => toast.info("Toplu atama işlemi için seçimler hazırlandı.")}><UserPlus className="mr-2 h-4 w-4" />Atamaları Yap ({selectedCompanyIds.length})</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveManagementDialog({ open, onOpenChange, companies }: { open: boolean; onOpenChange: (open: boolean) => void; companies: OsgbWorkspaceCompanyOption[] }) {
  const [tab, setTab] = useState<"available" | "archived">("available");
  const [search, setSearch] = useState("");
  const archiveableCompanies = companies.filter((company) => company.employeeCount === 0 || !company.contractEnd);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[100] bg-slate-950/80" className="z-[120] flex max-w-[720px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 p-0 text-slate-50 shadow-2xl [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">Arşiv Yönetimi</DialogTitle>
        <DialogDescription className="sr-only">Firmaları arşive taşı veya geri yükle.</DialogDescription>
        <div className="flex items-start justify-between border-b border-slate-700/70 p-5"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-700 text-slate-200"><Archive className="h-6 w-6" /></div><div><h2 className="text-xl font-black text-white">Arşiv Yönetimi</h2><p className="mt-1 text-sm text-slate-400">Firmaları arşive taşı veya geri yükle</p></div></div><DialogClose asChild><button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></DialogClose></div>
        <div className="grid grid-cols-2 border-b border-slate-700/70"><button type="button" onClick={() => setTab("available")} className={cn("px-4 py-4 text-sm font-bold transition", tab === "available" ? "border-b-2 border-blue-400 bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60")}>Arşivlenebilecek Firmalar ({archiveableCompanies.length})</button><button type="button" onClick={() => setTab("archived")} className={cn("px-4 py-4 text-sm font-bold transition", tab === "archived" ? "border-b-2 border-blue-400 bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60")}>Arşivdeki Firmalar (0)</button></div>
        <div className="space-y-4 p-5"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firma adı, takma ad veya SGK no ile ara..." /></div><div className="grid min-h-[180px] place-items-center text-center text-sm text-slate-400"><div><Archive className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-4">Arşivlenebilecek firma yok. (İSG Profesyoneli Sözleşmesi Yok / Çalışan Sayısı 0 kategorisi boş)</p></div></div></div>
        <div className="flex justify-end gap-3 border-t border-slate-700/70 bg-slate-900 p-4"><DialogClose asChild><Button type="button" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-white">Kapat</Button></DialogClose><Button type="button" disabled className="bg-slate-700 text-slate-300"><Archive className="mr-2 h-4 w-4" />Seçilenleri Arşive Taşı (0)</Button></div>
      </DialogContent>
    </Dialog>
  );
}

export function OSGBCompaniesPanel({ refreshKey }: { refreshKey: number }) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [companies, setCompanies] = useState<OsgbWorkspaceCompanyOption[]>([]);
  const [personnel, setPersonnel] = useState<OsgbWorkspacePersonnelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [hazardFilter, setHazardFilter] = useState("all");
  const [personnelFilter, setPersonnelFilter] = useState("all");
  const [titleFilter, setTitleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<CompanyStatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [missingDialogOpen, setMissingDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setCompanies([]);
      setPersonnel([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [companyRows, personnelRows] = await Promise.all([
        listOsgbWorkspaceCompanies(organizationId),
        listOsgbWorkspacePersonnel(organizationId, true),
      ]);
      setCompanies(companyRows);
      setPersonnel(personnelRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OSGB firmaları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const metrics = useMemo(() => ({
    total: companies.length,
    low: companies.filter((company) => isLowHazard(company.hazardClass)).length,
    medium: companies.filter((company) => isMediumHazard(company.hazardClass)).length,
    high: companies.filter((company) => isHighHazard(company.hazardClass)).length,
    igu: companies.reduce((sum, company) => sum + company.requiredMinutesByRole.igu, 0),
    ih: companies.reduce((sum, company) => sum + company.requiredMinutesByRole.hekim, 0),
  }), [companies]);

  const statusCounts = useMemo(() => ({
    all: companies.length,
    approved: companies.filter((company) => company.complianceStatus === "compliant").length,
    personnel_pending: companies.filter((company) => company.deficitMinutes > 0).length,
    workplace_pending: 0,
    zero_employee: companies.filter((company) => company.employeeCount === 0).length,
    no_contract: companies.filter((company) => !company.contractEnd).length,
    planned: companies.filter((company) => company.totalAssignedMinutes > 0).length,
  }), [companies]);

  const filteredCompanies = useMemo(() => {
    const normalized = `${search} ${listSearch}`.trim().toLocaleLowerCase("tr-TR");
    return companies.filter((company) => {
      if (hazardFilter !== "all" && !normalizeHazard(company.hazardClass).includes(hazardFilter)) return false;
      if (statusFilter === "approved" && company.complianceStatus !== "compliant") return false;
      if (statusFilter === "personnel_pending" && company.deficitMinutes <= 0) return false;
      if (statusFilter === "zero_employee" && company.employeeCount !== 0) return false;
      if (statusFilter === "no_contract" && company.contractEnd) return false;
      if (statusFilter === "planned" && company.totalAssignedMinutes <= 0) return false;
      if (!normalized) return true;
      return `${company.companyName} ${company.sgkNo || ""} ${company.hazardClass}`.toLocaleLowerCase("tr-TR").includes(normalized);
    });
  }, [companies, hazardFilter, listSearch, search, statusFilter]);

  const exportCompanies = () => {
    const header = ["Firma", "SGK No", "Tehlike", "Çalışan", "İGU dk", "İH dk"];
    const rows = filteredCompanies.map((company) => [company.companyName, company.sgkNo || "", company.hazardClass, String(company.employeeCount), String(company.requiredMinutesByRole.igu), String(company.requiredMinutesByRole.hekim)]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "osgb-firmalari.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const chips: Array<{ id: CompanyStatusFilter; label: string; count: number; dot: string }> = [
    { id: "all", label: "Tümü", count: statusCounts.all, dot: "bg-blue-400" },
    { id: "approved", label: "Tam Onaylı", count: statusCounts.approved, dot: "bg-emerald-400" },
    { id: "personnel_pending", label: "Personel Onayı Bekleniyor", count: statusCounts.personnel_pending, dot: "bg-amber-400" },
    { id: "workplace_pending", label: "İşyeri Onayı Bekleniyor", count: statusCounts.workplace_pending, dot: "bg-yellow-400" },
    { id: "zero_employee", label: "Çalışan Sayısı 0", count: statusCounts.zero_employee, dot: "bg-purple-400" },
    { id: "no_contract", label: "İSG Profesyonel Sözleşmesi Yok", count: statusCounts.no_contract, dot: "bg-rose-400" },
    { id: "planned", label: "Planlanan Atamalar", count: statusCounts.planned, dot: "bg-blue-300" },
  ];

  if (loading) return <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-300" /></div>;
  if (error) return <EmptyPanel icon={AlertTriangle} title="OSGB firmaları yüklenemedi." description={error} />;

  return (
    <div className="min-h-full space-y-3 bg-[#0b1426] text-slate-100">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firma, SGK No, il ara..." /></div>
          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            <Select value={hazardFilter} onValueChange={setHazardFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Tüm Tehlike" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">Tüm Tehlike</SelectItem><SelectItem value="az">Az Tehlikeli</SelectItem><SelectItem value="tehlikeli">Tehlikeli</SelectItem><SelectItem value="çok">Çok Tehlikeli</SelectItem></SelectContent></Select>
            <Select value={personnelFilter} onValueChange={setPersonnelFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Tüm Personel" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">Tüm Personel</SelectItem>{personnel.map((person) => <SelectItem key={person.id} value={person.id}>{person.full_name}</SelectItem>)}</SelectContent></Select>
            <Select value={titleFilter} onValueChange={setTitleFilter}><SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Unvan" /></SelectTrigger><SelectContent className={selectContentClass}><SelectItem value="all">Unvan</SelectItem><SelectItem value="igu">İGU</SelectItem><SelectItem value="hekim">İH</SelectItem><SelectItem value="dsp">DSP</SelectItem></SelectContent></Select>
            <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0 border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"><ArrowUp className="h-4 w-4" /></Button>
            <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1"><Button type="button" size="icon" className={cn("h-7 w-7", viewMode === "list" ? "bg-blue-600 text-white" : "bg-transparent text-slate-400 hover:bg-slate-800")} onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button><Button type="button" size="icon" className={cn("h-7 w-7", viewMode === "grid" ? "bg-blue-600 text-white" : "bg-transparent text-slate-400 hover:bg-slate-800")} onClick={() => setViewMode("grid")}><Grid2X2 className="h-4 w-4" /></Button></div>
            <Button type="button" className="h-9 shrink-0 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white" onClick={exportCompanies}><Download className="mr-2 h-4 w-4" />Dışa Aktar</Button>
            <Button type="button" className="h-9 shrink-0 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => toast.info("Toplu firma yükleme akışı hazırlanıyor.")}><Upload className="mr-2 h-4 w-4" />Toplu Firma Yükle</Button>
            <Button type="button" className="h-9 shrink-0 bg-blue-600 text-white hover:bg-blue-500" onClick={() => toast.info("Firma ekleme için Firma Takip ekranındaki mevcut akış kullanılacak.")}><Plus className="mr-2 h-4 w-4" />Firma Ekle</Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-stretch">
        <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"><MetricBox value={metrics.total} label="Toplam" tone="slate" /><MetricBox value={metrics.low} label="Az Tehlikeli" tone="emerald" /><MetricBox value={metrics.medium} label="Tehlikeli" tone="orange" /><MetricBox value={metrics.high} label="Çok Tehlikeli" tone="rose" /><MetricBox value={`${formatNumber(metrics.igu)} dk`} label="İGU" tone="blue" /><MetricBox value={`${formatNumber(metrics.ih)} dk`} label="İH" tone="purple" /></div>
        <div className="grid gap-2 sm:grid-cols-3 2xl:min-w-[520px]"><Button type="button" className="h-full min-h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm hover:from-violet-500 hover:to-purple-500" onClick={() => setMissingDialogOpen(true)}><AlertTriangle className="mr-2 h-4 w-4" />Eksik Atamaları Bul</Button><Button type="button" className="h-full min-h-12 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:from-emerald-500 hover:to-teal-500" onClick={() => setBulkDialogOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Toplu Atama Ekle</Button><Button type="button" className="h-full min-h-12 bg-slate-700 text-white shadow-sm hover:bg-slate-600" onClick={() => setArchiveDialogOpen(true)}><Archive className="mr-2 h-4 w-4" />Arşive Taşı</Button></div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => <button key={chip.id} type="button" onClick={() => setStatusFilter(chip.id)} className={cn("flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition", statusFilter === chip.id ? "border-blue-500 bg-blue-600 text-white" : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700")}><span className={cn("h-2 w-2 rounded-full", chip.dot)} />{chip.label} ({chip.count})</button>)}
      </div>

      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3"><h2 className="text-lg font-black text-white">OSGB Firmaları</h2><span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{filteredCompanies.length} kayıt</span></div>
          <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" className="h-9 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">Tümünü Seç</Button><div className="relative sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input className={cn(inputClass, "pl-9")} value={listSearch} onChange={(event) => setListSearch(event.target.value)} placeholder="Firma, SGK No ara..." /></div></div>
        </div>

        {filteredCompanies.length ? (
          <div className={cn(viewMode === "grid" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-2")}>
            {filteredCompanies.map((company) => (
              <div key={company.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4 transition hover:border-blue-500/35 hover:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-white">{company.companyName}</p><p className="mt-1 text-xs text-slate-400">{company.sgkNo || "SGK No yok"} · {company.hazardClass}</p></div><span className="rounded-lg bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-200">{company.employeeCount} çalışan</span></div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-blue-300">{company.requiredMinutesByRole.igu}</b><p className="text-slate-500">İGU dk</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-purple-300">{company.requiredMinutesByRole.hekim}</b><p className="text-slate-500">İH dk</p></div><div className="rounded-lg bg-slate-800/70 p-2"><b className="text-rose-300">{company.deficitMinutes}</b><p className="text-slate-500">Eksik</p></div></div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel icon={Building2} title="Firma bulunamadı." description="Henüz OSGB firmanız eklenmemiş. ‘Firma Ekle’ ile hizmet verdiğiniz firmaları ekleyin." />
        )}
      </div>

      <MissingAssignmentsDialog open={missingDialogOpen} onOpenChange={setMissingDialogOpen} companies={companies} onOpenBulkAssignment={() => { setMissingDialogOpen(false); setBulkDialogOpen(true); }} />
      <BulkAssignmentDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} companies={companies} personnel={personnel} />
      <ArchiveManagementDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen} companies={companies} />
    </div>
  );
}
