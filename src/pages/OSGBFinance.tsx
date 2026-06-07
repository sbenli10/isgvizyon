import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Edit3,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { utils, writeFile } from "xlsx";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createOsgbFinanceRecord,
  deleteOsgbFinanceRecord,
  duplicateFinanceNextMonth,
  listOsgbFinanceRecords,
  markFinanceOverdue,
  markFinancePaid,
  markFinancePending,
  updateOsgbFinanceRecord,
  type OsgbFinanceInput,
  type OsgbFinanceRecord,
  type OsgbFinanceStatus,
} from "@/lib/osgbFinance";
import { listOsgbCompanyTrackingWorkspace, type OsgbManagedCompanyRecord } from "@/lib/osgbPlatform";
import { cn } from "@/lib/utils";

type FinanceFormState = {
  companyId: string;
  period: string;
  amount: string;
  dueDate: string;
  invoiceNo: string;
  status: OsgbFinanceStatus;
  notes: string;
};

const defaultPeriod = () => new Date().toISOString().slice(0, 7);

const emptyForm = (): FinanceFormState => ({
  companyId: "",
  period: defaultPeriod(),
  amount: "",
  dueDate: "",
  invoiceNo: "",
  status: "pending",
  notes: "",
});

const statusLabels: Record<OsgbFinanceStatus, string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  overdue: "Gecikti",
};

const statusClasses: Record<OsgbFinanceStatus, string> = {
  pending: "border-slate-500/30 bg-slate-400/10 text-slate-200",
  paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  overdue: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
};

const parseAmount = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  return Number(normalized || 0);
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const isPastDue = (record: OsgbFinanceRecord) =>
  record.status !== "paid" && !!record.dueDate && record.dueDate < todayIso();

const isDueToday = (record: OsgbFinanceRecord) =>
  record.status !== "paid" && !!record.dueDate && record.dueDate === todayIso();

const isDueNextSevenDays = (record: OsgbFinanceRecord) => {
  if (record.status === "paid" || !record.dueDate) return false;
  const due = new Date(`${record.dueDate}T00:00:00`);
  const today = new Date(`${todayIso()}T00:00:00`);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  return diffDays > 0 && diffDays <= 7;
};

const financeSearchText = (record: OsgbFinanceRecord) =>
  [record.companyName, record.period, record.invoiceNo, record.notes].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "cyan",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof Wallet;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "blue";
}) => {
  const tones = {
    cyan: "bg-cyan-500/10 text-cyan-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
    amber: "bg-amber-500/10 text-amber-300",
    rose: "bg-rose-500/10 text-rose-300",
    blue: "bg-blue-500/10 text-blue-300",
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#080f22] p-4 shadow-lg shadow-slate-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{title}</p>
          <p className="mt-3 text-xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p>
        </div>
        <span className={cn("rounded-xl p-2", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
};

const RadarCard = ({ title, count, amount, description, icon: Icon }: { title: string; count: number; amount: number; description: string; icon: typeof Wallet }) => (
  <div className="rounded-xl border border-slate-700/70 bg-[#0b1428] p-4">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-500">{title}</p>
      <span className="rounded-full bg-slate-950 p-2 text-slate-300">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-2 text-2xl font-black text-white">{count}</p>
    <p className="mt-1 text-xs font-semibold text-slate-300">{formatCurrency(amount)}</p>
    <p className="mt-3 text-xs text-slate-400">{description}</p>
  </div>
);

export default function OSGBFinance() {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [records, setRecords] = useState<OsgbFinanceRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbManagedCompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OsgbFinanceStatus | "all">("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OsgbFinanceRecord | null>(null);
  const [form, setForm] = useState<FinanceFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OsgbFinanceRecord | null>(null);
  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [financeRows, companyWorkspace] = await Promise.all([
        listOsgbFinanceRecords(organizationId),
        listOsgbCompanyTrackingWorkspace(organizationId),
      ]);
      setRecords(financeRows);
      setCompanies(companyWorkspace.companies);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Finans kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const periods = useMemo(() => Array.from(new Set(records.map((record) => record.period))).sort().reverse(), [records]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return records.filter((record) => {
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      if (companyFilter !== "all" && record.companyId !== companyFilter) return false;
      if (periodFilter !== "all" && record.period !== periodFilter) return false;
      if (term && !financeSearchText(record).includes(term)) return false;
      return true;
    });
  }, [companyFilter, periodFilter, records, search, statusFilter]);

  const stats = useMemo(() => {
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const paid = records.filter((record) => record.status === "paid").reduce((sum, record) => sum + record.amount, 0);
    const overdueRows = records.filter((record) => record.status === "overdue" || isPastDue(record));
    const overdue = overdueRows.reduce((sum, record) => sum + record.amount, 0);
    const pendingRows = records.filter((record) => record.status === "pending" && !isPastDue(record));
    const pending = pendingRows.reduce((sum, record) => sum + record.amount, 0);
    const ratio = total > 0 ? Math.round((paid / total) * 100) : 0;

    return { total, paid, pending, overdue, ratio, overdueRows, pendingRows };
  }, [records]);

  const radar = useMemo(() => {
    const dueToday = records.filter(isDueToday);
    const nextSeven = records.filter(isDueNextSevenDays);
    const paidRows = records.filter((record) => record.status === "paid");
    return {
      overdue: stats.overdueRows,
      today: dueToday,
      nextSeven,
      pending: stats.pendingRows,
      paid: paidRows,
    };
  }, [records, stats.overdueRows, stats.pendingRows]);

  const lastSixPeriods = useMemo(() => {
    const base = new Date(`${defaultPeriod()}-01T00:00:00`);
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(base);
      date.setMonth(base.getMonth() - (5 - index));
      const period = date.toISOString().slice(0, 7);
      const paidAmount = records
        .filter((record) => record.period === period && record.status === "paid")
        .reduce((sum, record) => sum + record.amount, 0);
      return { period, paidAmount };
    });
  }, [records]);

  const maxLastSixAmount = Math.max(1, ...lastSixPeriods.map((item) => item.paidAmount));

  const openCreateDialog = () => {
    setEditingRecord(null);
    setForm({ ...emptyForm(), companyId: companyFilter !== "all" ? companyFilter : companies[0]?.id || "" });
    setDialogOpen(true);
  };

  const openEditDialog = (record: OsgbFinanceRecord) => {
    setEditingRecord(record);
    setForm({
      companyId: record.companyId,
      period: record.period,
      amount: String(record.amount),
      dueDate: record.dueDate || "",
      invoiceNo: record.invoiceNo || "",
      status: record.status,
      notes: record.notes || "",
    });
    setDialogOpen(true);
  };

  const selectedCompany = companies.find((company) => company.id === form.companyId) || null;

  const buildInput = (): OsgbFinanceInput => ({
    companyId: form.companyId,
    companyName: selectedCompany?.companyName || null,
    period: form.period,
    amount: parseAmount(form.amount),
    invoiceNo: form.invoiceNo || null,
    dueDate: form.dueDate || null,
    status: form.status,
    notes: form.notes || null,
  });

  const handleSave = async () => {
    if (!organizationId || !user?.id) return;
    if (!form.companyId || !form.period || !form.amount) {
      toast.error("Firma, dönem ve tutar zorunlu.");
      return;
    }

    setSaving(true);
    try {
      if (editingRecord) {
        await updateOsgbFinanceRecord(editingRecord.id, organizationId, buildInput());
        toast.success("Finans kaydı güncellendi.");
      } else {
        await createOsgbFinanceRecord(user.id, organizationId, buildInput());
        toast.success("Finans kaydı eklendi.");
      }
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Finans kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const runRecordAction = async (record: OsgbFinanceRecord, action: () => Promise<unknown>, message: string) => {
    setActionLoadingId(record.id);
    try {
      await action();
      await loadData();
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!organizationId || !deleteTarget) return;
    await runRecordAction(deleteTarget, () => deleteOsgbFinanceRecord(deleteTarget.id, organizationId), "Finans kaydı silindi.");
    setDeleteTarget(null);
  };

  const exportStatement = () => {
    const rows = filteredRecords.map((record) => ({
      Firma: record.companyName || "-",
      Dönem: record.period,
      Tutar: record.amount,
      Vade: record.dueDate || "-",
      Durum: statusLabels[record.status],
      Not: record.notes || "-",
    }));
    const worksheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "OSGB Finans");
    writeFile(workbook, `osgb-finans-ekstre-${todayIso()}.xlsx`);
  };

  if (!organizationId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <div>
            <h2 className="font-black">Organizasyon bağlantısı gerekli</h2>
            <p className="mt-1 text-sm text-amber-100/80">Finans ekranı için önce bir organizasyon/çalışma alanı oluşturun.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111c2e] p-3 text-slate-100 sm:p-4">
      <div className="space-y-4">
        <div className="grid rounded-xl border border-slate-700/70 bg-[#050a18] p-1 sm:grid-cols-2">
          <button className="rounded-lg bg-[#1a273c] px-4 py-3 text-sm font-black text-white shadow-inner">
            <span className="inline-flex items-center gap-2"><CreditCard className="h-4 w-4" /> Tahsilatlar / Gelirler</span>
          </button>
          <button disabled className="rounded-lg px-4 py-3 text-sm font-bold text-slate-400">
            <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Sabit Giderler</span>
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard title="Toplam Alacak" value={formatCurrency(stats.total)} subtitle={`${records.length} kayıt`} icon={Wallet} />
          <KpiCard title="Tahsil Edilen" value={formatCurrency(stats.paid)} subtitle={`${radar.paid.length} tahsilat kapandı`} icon={BadgeDollarSign} tone="emerald" />
          <KpiCard title="Bekleyen Tahsilat" value={formatCurrency(stats.pending)} subtitle={`${radar.pending.length} kayıt takipte`} icon={Clock3} tone="amber" />
          <KpiCard title="Geciken Tahsilat" value={formatCurrency(stats.overdue)} subtitle={`${radar.overdue.length} kritik kayıt`} icon={ShieldAlert} tone="rose" />
          <KpiCard title="Tahsilat Oranı" value={`%${stats.ratio}`} subtitle={stats.total ? "Portföy tahsilat performansı" : "Henüz portföy yok"} icon={BarChart3} tone="blue" />
          <div className="rounded-xl border border-slate-800 bg-[#080f22] p-4 shadow-lg shadow-slate-950/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Son 6 Dönem</p>
                <p className="mt-3 text-base font-black text-white">Tahsilat Akışı</p>
                <p className="mt-1 text-xs text-slate-400">Dönem bazlı tahsil edilen kısım</p>
              </div>
              <span className="rounded-xl bg-slate-700/30 p-2 text-slate-300"><BarChart3 className="h-4 w-4" /></span>
            </div>
            <div className="mt-4 flex h-12 items-end gap-1 border-t border-dashed border-slate-700 pt-2">
              {lastSixPeriods.map((item) => (
                <div key={item.period} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-cyan-400/70" style={{ height: `${Math.max(4, (item.paidAmount / maxLastSixAmount) * 34)}px` }} />
                  <span className="text-[9px] text-slate-500">{item.period.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-800 bg-[#080f22] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Tahsilat Radarı</p>
              <h2 className="text-sm font-black text-white">Günlük operasyonu öne çeken hızlı akışları seçin</h2>
            </div>
            <Badge className="border-slate-700 bg-slate-800 text-slate-200">Sorumlu Kayıtlar</Badge>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <RadarCard title="Geciken" count={radar.overdue.length} amount={stats.overdue} description="Vadesi geçmiş veya gecikti olarak işaretlenmiş kayıtlar." icon={ShieldAlert} />
            <RadarCard title="Bugün" count={radar.today.length} amount={radar.today.reduce((sum, row) => sum + row.amount, 0)} description="Bugün vadesi gelen kayıtlar." icon={Calendar} />
            <RadarCard title="7 Gün" count={radar.nextSeven.length} amount={radar.nextSeven.reduce((sum, row) => sum + row.amount, 0)} description="Önümüzdeki 7 gün içinde vadesi gelecek kayıtlar." icon={Clock3} />
            <RadarCard title="Bekleyen" count={radar.pending.length} amount={stats.pending} description="Takipte olan ancak gecikmemiş kayıtlar." icon={AlertTriangle} />
            <RadarCard title="Ödendi" count={radar.paid.length} amount={stats.paid} description="Tahsilatı tamamlanan kayıtlar." icon={CheckCircle2} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#070d1f] p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firma, dönem, fatura no veya not ara" className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] pl-10 text-slate-100 placeholder:text-slate-500" />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OsgbFinanceStatus | "all")}>
              <SelectTrigger className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tüm durumlar</SelectItem><SelectItem value="pending">Beklemede</SelectItem><SelectItem value="paid">Ödendi</SelectItem><SelectItem value="overdue">Gecikti</SelectItem></SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-44"><SelectValue placeholder="Tüm firmalar" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tüm firmalar</SelectItem>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-40"><SelectValue placeholder="Tüm dönemler" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tüm dönemler</SelectItem>{periods.map((period) => <SelectItem key={period} value={period}>{period}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="secondary" onClick={() => { setSearch(""); setStatusFilter("all"); setCompanyFilter("all"); setPeriodFilter("all"); }} className="h-11 rounded-xl bg-slate-800 text-slate-100 hover:bg-slate-700">
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtreleri Sıfırla
            </Button>
            <Button type="button" onClick={exportStatement} disabled={filteredRecords.length === 0} className="h-11 rounded-xl bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50">
              <Download className="mr-2 h-4 w-4" /> Ekstre İndir
            </Button>
            <Button type="button" onClick={openCreateDialog} disabled={companies.length === 0} className="h-11 rounded-xl bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(255,255,255,.9)] hover:bg-cyan-400 disabled:opacity-50">
              <Plus className="mr-2 h-4 w-4" /> Yeni Kayıt
            </Button>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-400">{filteredRecords.length} kayıt görünüyor • Toplam portföy {formatCurrency(stats.total)}</p>

          {companies.length === 0 && (
            <Alert className="mt-4 border-amber-500/50 bg-amber-500/10 text-amber-100">
              <Building2 className="h-4 w-4" />
              <AlertTitle>Finans kaydı eklemek için önce bir OSGB firması gerekli.</AlertTitle>
              <AlertDescription>Firma listesi oluştuktan sonra bu alan aylık tahsilat masası gibi çalışacak.</AlertDescription>
            </Alert>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#050a18]">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-slate-300"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finans kayıtları yükleniyor...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
              <div className="rounded-2xl bg-slate-800 p-4 text-slate-300"><Search className="h-7 w-7" /></div>
              <h3 className="mt-4 text-base font-black text-white">Henüz finans kaydı eklenmedi</h3>
              <p className="mt-2 max-w-lg text-sm text-slate-400">İlk kaydı eklediğinizde üstteki özet, radar ve operasyon listesi anında oluşacak.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full text-left text-sm">
                <thead className="bg-[#070d1f] text-xs font-bold text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Firma</th><th className="px-4 py-3">Dönem</th><th className="px-4 py-3 text-right">Tutar</th><th className="px-4 py-3">Vade</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3">Not</th><th className="px-4 py-3 text-right">Hızlı İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-t border-slate-800 text-slate-200 hover:bg-slate-900/50">
                      <td className="px-4 py-4"><div className="font-black text-white"><Building2 className="mr-2 inline h-4 w-4 text-cyan-300" />{record.companyName || "-"}</div><div className="mt-1 text-xs text-slate-500">Fatura {record.invoiceNo || "-"}</div></td>
                      <td className="px-4 py-4 font-semibold">{record.period}</td>
                      <td className="px-4 py-4 text-right font-black text-white">{formatCurrency(record.amount)}</td>
                      <td className="px-4 py-4"><Calendar className="mr-2 inline h-4 w-4 text-slate-400" />{formatDate(record.dueDate)}</td>
                      <td className="px-4 py-4"><Badge className={cn("rounded-full", statusClasses[record.status])}>{statusLabels[record.status]}</Badge></td>
                      <td className="max-w-[220px] truncate px-4 py-4 text-slate-400">{record.notes || "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" disabled={actionLoadingId === record.id || record.status === "paid"} onClick={() => runRecordAction(record, () => markFinancePaid(record.id, organizationId), "Kayıt ödendi olarak işaretlendi.")} className="h-7 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-emerald-700">Ödendi</Button>
                          <Button size="sm" disabled={actionLoadingId === record.id || record.status === "pending"} onClick={() => runRecordAction(record, () => markFinancePending(record.id, organizationId), "Kayıt beklemede olarak işaretlendi.")} className="h-7 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-slate-700">Beklemede</Button>
                          <Button size="sm" disabled={actionLoadingId === record.id || record.status === "overdue"} onClick={() => runRecordAction(record, () => markFinanceOverdue(record.id, organizationId), "Kayıt gecikti olarak işaretlendi.")} className="h-7 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-rose-700">Gecikti</Button>
                          <Button size="sm" disabled={actionLoadingId === record.id || !user?.id} onClick={() => user?.id && runRecordAction(record, () => duplicateFinanceNextMonth(user.id, organizationId, record), "Sonraki ay kaydı oluşturuldu.")} className="h-7 rounded-full bg-cyan-500/15 px-3 text-xs text-cyan-100 hover:bg-cyan-500/25"><Copy className="mr-1 h-3 w-3" /> Sonraki Ay</Button>
                          <Button size="sm" onClick={() => openEditDialog(record)} className="h-7 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-blue-700"><Edit3 className="mr-1 h-3 w-3" /> Detay</Button>
                          <Button size="sm" onClick={() => setDeleteTarget(record)} className="h-7 rounded-full bg-rose-500/20 px-3 text-xs text-rose-100 hover:bg-rose-700"><Trash2 className="mr-1 h-3 w-3" /> Sil</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl border-slate-700 bg-[#060b1d] p-0 text-slate-100 shadow-2xl sm:max-w-[380px]">
          <div className="flex items-start justify-between border-b border-slate-800 px-5 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Yeni Tahsilat</p>
              <h2 className="mt-2 text-lg font-black text-white">{editingRecord ? "Finans kaydını düzenle" : "Yeni finans kaydı ekle"}</h2>
              <p className="mt-1 text-sm text-slate-400">Liste görünürken kaydı hemen düzenleyin ve optimistik olarak işleyin.</p>
            </div>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-full bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[calc(100vh-13rem)] space-y-4 overflow-y-auto px-5 py-5">
            <div className="space-y-2">
              <Label className="text-slate-200"><Building2 className="mr-2 inline h-4 w-4" />Firma *</Label>
              <Select value={form.companyId || undefined} onValueChange={(value) => setForm((current) => ({ ...current, companyId: value }))}>
                <SelectTrigger className="h-11 rounded-xl border-slate-600 bg-[#101a2e] text-slate-100"><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Dönem *</Label><Input type="month" value={form.period} onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))} className="h-11 rounded-xl border-slate-600 bg-[#101a2e] text-slate-100" /></div>
              <div className="space-y-2"><Label><CreditCard className="mr-2 inline h-4 w-4" />Tutar *</Label><Input value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} className="h-11 rounded-xl border-slate-600 bg-[#101a2e] text-slate-100" /></div>
              <div className="space-y-2"><Label>Vade Tarihi</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="h-11 rounded-xl border-slate-600 bg-[#101a2e] text-slate-100" /></div>
              <div className="space-y-2"><Label>Fatura No</Label><Input value={form.invoiceNo} onChange={(event) => setForm((current) => ({ ...current, invoiceNo: event.target.value }))} placeholder="IST-2026-001" className="h-11 rounded-xl border-slate-600 bg-[#101a2e] text-slate-100" /></div>
            </div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as OsgbFinanceStatus }))}>
                <SelectTrigger className="h-11 rounded-xl border-slate-600 bg-[#101a2e] text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pending">Beklemede</SelectItem><SelectItem value="paid">Ödendi</SelectItem><SelectItem value="overdue">Gecikti</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label><FileText className="mr-2 inline h-4 w-4" />Notlar</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Tahsilat notu, mutabakat bilgisi veya operasyon açıklaması..." className="min-h-[100px] rounded-xl border-slate-600 bg-[#101a2e] text-slate-100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-800 px-5 py-4">
            <Button type="button" onClick={() => setDialogOpen(false)} className="rounded-xl bg-slate-800 text-white hover:bg-slate-700">Vazgeç</Button>
            <Button type="button" onClick={handleSave} disabled={saving} className="rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}{editingRecord ? "Güncelle" : "Kaydı Ekle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-slate-700 bg-[#060b1d] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Finans kaydı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">Bu tahsilat kaydı silinecek. Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 text-white hover:bg-rose-500">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
