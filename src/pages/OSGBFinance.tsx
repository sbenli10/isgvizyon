import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CopyPlus,
  Download,
  Eye,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessRole } from "@/hooks/useAccessRole";
import { useOsgbManagedCompanies } from "@/hooks/useOsgbManagedCompanies";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createOsgbFinanceRecord,
  deleteOsgbFinanceRecord,
  duplicateFinanceNextMonth,
  listOsgbFinanceRecords,
  markFinanceOverdue,
  markFinancePaid,
  updateOsgbFinanceRecord,
  type OsgbFinanceInput,
  type OsgbFinanceRecord,
  type OsgbFinanceStatus,
} from "@/lib/osgbFinance";

type FinanceFormState = {
  companyId: string;
  period: string;
  amount: string;
  dueDate: string;
  invoiceNo: string;
  status: OsgbFinanceStatus;
  notes: string;
};

const emptyForm: FinanceFormState = {
  companyId: "",
  period: new Date().toISOString().slice(0, 7),
  amount: "",
  dueDate: "",
  invoiceNo: "",
  status: "pending",
  notes: "",
};

const statusLabel: Record<OsgbFinanceStatus, string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  overdue: "Gecikti",
};

const statusClass: Record<OsgbFinanceStatus, string> = {
  pending: "border-amber-400/25 bg-amber-500/15 text-amber-100",
  paid: "border-emerald-400/25 bg-emerald-500/15 text-emerald-100",
  overdue: "border-rose-400/25 bg-rose-500/15 text-rose-100",
};

const statusOptions: Array<{ value: OsgbFinanceStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Tüm durumlar" },
  { value: "pending", label: "Bekleyen" },
  { value: "paid", label: "Ödendi" },
  { value: "overdue", label: "Geciken" },
];

const moneyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

const formatMoney = (value: number) => moneyFormatter.format(Number(value || 0));

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const daysBetween = (value: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const start = new Date(`${todayKey()}T00:00:00`).getTime();
  const target = new Date(`${value}T00:00:00`).getTime();
  return Math.ceil((target - start) / (24 * 60 * 60 * 1000));
};

const monthLabel = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
};

export default function OSGBFinance() {
  const { user, profile } = useAuth();
  const { canManage } = useAccessRole();
  const organizationId = profile?.organization_id || null;
  const { companies } = useOsgbManagedCompanies(organizationId);

  const [records, setRecords] = useState<OsgbFinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<OsgbFinanceRecord | null>(null);
  const [editing, setEditing] = useState<OsgbFinanceRecord | null>(null);
  const [form, setForm] = useState<FinanceFormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OsgbFinanceStatus | "ALL">("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("");

  usePageDataTiming(loading);

  const loadRecords = async () => {
    if (!organizationId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listOsgbFinanceRecords(organizationId, {
        search,
        status: statusFilter,
        companyId: companyFilter,
        period: periodFilter,
      });
      setRecords(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finans kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, [organizationId, search, statusFilter, companyFilter, periodFilter]);

  const companyNameById = useMemo(
    () => new Map(companies.map((company) => [company.id, company.companyName])),
    [companies],
  );

  const summary = useMemo(() => {
    const totalReceivable = records.reduce((sum, record) => sum + record.amount, 0);
    const paid = records.filter((record) => record.status === "paid").reduce((sum, record) => sum + record.amount, 0);
    const pending = records.filter((record) => record.status === "pending").reduce((sum, record) => sum + record.amount, 0);
    const overdue = records.filter((record) => record.status === "overdue").reduce((sum, record) => sum + record.amount, 0);
    const rate = totalReceivable > 0 ? Math.round((paid / totalReceivable) * 100) : 0;
    return { totalReceivable, paid, pending, overdue, rate };
  }, [records]);

  const radar = useMemo(() => {
    const today = todayKey();
    return {
      overdue: records.filter((record) => record.status === "overdue" || (record.status !== "paid" && daysBetween(record.due_date) < 0)).length,
      today: records.filter((record) => record.status !== "paid" && record.due_date === today).length,
      sevenDays: records.filter((record) => record.status !== "paid" && daysBetween(record.due_date) >= 0 && daysBetween(record.due_date) <= 7).length,
      pending: records.filter((record) => record.status === "pending").length,
      paid: records.filter((record) => record.status === "paid").length,
    };
  }, [records]);

  const lastSixPeriods = useMemo(() => {
    const periodMap = records.reduce<Record<string, { period: string; paid: number; expected: number }>>((acc, record) => {
      acc[record.period] ||= { period: record.period, paid: 0, expected: 0 };
      acc[record.period].expected += record.amount;
      if (record.status === "paid") acc[record.period].paid += record.amount;
      return acc;
    }, {});
    return Object.values(periodMap).sort((a, b) => a.period.localeCompare(b.period)).slice(-6);
  }, [records]);

  const maxFlow = Math.max(1, ...lastSixPeriods.map((item) => item.expected));

  const openCreate = () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (record: OsgbFinanceRecord) => {
    setEditing(record);
    setForm({
      companyId: record.company_id,
      period: record.period,
      amount: String(record.amount),
      dueDate: record.due_date || "",
      invoiceNo: record.invoice_no || "",
      status: record.status,
      notes: record.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!canManage || !organizationId || !user?.id) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!form.companyId || !form.period || !form.amount) {
      toast.error("Firma, dönem ve tutar alanları zorunludur.");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Tutar sıfırdan büyük olmalıdır.");
      return;
    }

    setSaving(true);
    try {
      const payload: OsgbFinanceInput = {
        organization_id: organizationId,
        company_id: form.companyId,
        company_name: companyNameById.get(form.companyId) || null,
        period: form.period,
        amount,
        invoice_no: form.invoiceNo.trim() || null,
        due_date: form.dueDate || null,
        status: form.status,
        notes: form.notes.trim() || null,
        created_by: user.id,
      };

      if (editing) {
        await updateOsgbFinanceRecord(editing.id, payload);
        toast.success("Finans kaydı güncellendi.");
      } else {
        await createOsgbFinanceRecord(payload);
        toast.success("Finans kaydı eklendi.");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finans kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (record: OsgbFinanceRecord, status: OsgbFinanceStatus) => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    try {
      if (status === "paid") await markFinancePaid(record.id);
      else if (status === "overdue") await markFinanceOverdue(record.id);
      else await updateOsgbFinanceRecord(record.id, { status: "pending" });
      toast.success(`Durum ${statusLabel[status]} olarak güncellendi.`);
      await loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Durum güncellenemedi.");
    }
  };

  const handleDuplicateNextMonth = async (record: OsgbFinanceRecord) => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    try {
      const duplicated = await duplicateFinanceNextMonth(record, user?.id);
      toast.success(`${duplicated.period} dönemi için yeni kayıt oluşturuldu.`);
      await loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sonraki ay kaydı oluşturulamadı.");
    }
  };

  const handleDelete = async (record: OsgbFinanceRecord) => {
    if (!canManage) return toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
    if (!window.confirm(`${record.company_name || "Firma"} finans kaydı silinsin mi?`)) return;
    try {
      await deleteOsgbFinanceRecord(record.id);
      toast.success("Finans kaydı silindi.");
      await loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finans kaydı silinemedi.");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setCompanyFilter("ALL");
    setPeriodFilter("");
  };

  const exportExcel = () => {
    const rows = records.map((record) => ({
      Firma: record.company_name || companyNameById.get(record.company_id) || "-",
      Dönem: record.period,
      Tutar: record.amount,
      Vade: record.due_date || "-",
      Durum: statusLabel[record.status],
      Not: record.notes || "-",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OSGB Ekstre");
    XLSX.writeFile(workbook, `osgb-finans-ekstre-${todayKey()}.xlsx`);
  };

  const kpiCards = [
    { title: "Toplam Alacak", value: formatMoney(summary.totalReceivable), icon: WalletCards, tone: "from-cyan-500/25 to-slate-900" },
    { title: "Tahsil Edilen", value: formatMoney(summary.paid), icon: CheckCircle2, tone: "from-emerald-500/25 to-slate-900" },
    { title: "Bekleyen Tahsilat", value: formatMoney(summary.pending), icon: Clock3, tone: "from-amber-500/25 to-slate-900" },
    { title: "Geciken Tahsilat", value: formatMoney(summary.overdue), icon: AlertCircle, tone: "from-rose-500/25 to-slate-900" },
    { title: "Tahsilat Oranı", value: `%${summary.rate}`, icon: TrendingUp, tone: "from-indigo-500/25 to-slate-900" },
  ];

  return (
    <div className="min-h-screen space-y-6 bg-[#06111f] p-4 text-slate-100 md:p-6">
      <div className="overflow-hidden rounded-[2rem] border border-cyan-400/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),linear-gradient(135deg,#0f172a,#020617)] p-6 shadow-2xl shadow-cyan-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-3 border-cyan-300/25 bg-cyan-400/10 text-cyan-100">OSGB Finans Yönetimi</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Tahsilat Yönetim Paneli</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Aylık firma tahsilatlarını, alacakları, gecikmeleri ve tahsilat performansını tek ekrandan takip edin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800" onClick={loadRecords}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Yenile
            </Button>
            <Button variant="outline" className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20" onClick={exportExcel} disabled={records.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Ekstre indir
            </Button>
            <Button className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Yeni Finans Kaydı
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <Alert className="border-rose-400/30 bg-rose-950/40 text-rose-100">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Finans kayıtları yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <Card key={card.title} className={cn("group border-white/10 bg-gradient-to-br p-px shadow-xl shadow-slate-950/30 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25", card.tone)}>
            <div className="rounded-xl bg-slate-950/70 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{card.title}</span>
                <card.icon className="h-5 w-5 text-cyan-200 transition group-hover:scale-110" />
              </div>
              <div className="mt-4 text-2xl font-bold text-white">{card.value}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-slate-800 bg-slate-950/70 text-slate-100 shadow-xl shadow-slate-950/30">
          <CardHeader>
            <CardTitle>Son 6 Dönem Tahsilat Akışı</CardTitle>
            <CardDescription className="text-slate-400">Beklenen gelir ve tahsil edilen tutar karşılaştırması.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastSixPeriods.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">Henüz dönem akışı oluşturacak veri yok.</div>
            ) : (
              lastSixPeriods.map((item) => (
                <div key={item.period} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 transition hover:border-cyan-400/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-white">{monthLabel(item.period)}</span>
                    <span className="text-slate-400">{formatMoney(item.paid)} / {formatMoney(item.expected)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(4, (item.expected / maxFlow) * 100)}%` }} />
                    <div className="-mt-3 h-3 rounded-full bg-emerald-400" style={{ width: `${Math.max(0, (item.paid / maxFlow) * 100)}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70 text-slate-100 shadow-xl shadow-slate-950/30">
          <CardHeader>
            <CardTitle>Tahsilat Radarı</CardTitle>
            <CardDescription className="text-slate-400">Vade ve durum bazlı canlı özet.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { label: "Geciken", value: radar.overdue, icon: AlertCircle, color: "text-rose-200" },
              { label: "Bugün", value: radar.today, icon: CalendarClock, color: "text-cyan-200" },
              { label: "7 Gün", value: radar.sevenDays, icon: Clock3, color: "text-indigo-200" },
              { label: "Bekleyen", value: radar.pending, icon: Banknote, color: "text-amber-200" },
              { label: "Ödendi", value: radar.paid, icon: CheckCircle2, color: "text-emerald-200" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-cyan-400/20 hover:bg-slate-900">
                <div className="flex items-center gap-3">
                  <item.icon className={cn("h-5 w-5", item.color)} />
                  <span className="text-sm text-slate-300">{item.label}</span>
                </div>
                <span className="text-xl font-bold text-white">{item.value}</span>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
                <span>Tahsilat oranı</span>
                <span>%{summary.rate}</span>
              </div>
              <Progress value={summary.rate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/80 text-slate-100 shadow-2xl shadow-slate-950/40">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle>Firma Tahsilat Ekstresi</CardTitle>
              <CardDescription className="text-slate-400">Firma, dönem, vade ve durum filtreleriyle finans kayıtlarını yönetin.</CardDescription>
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input className="border-slate-700 bg-slate-900 pl-9 text-slate-100" placeholder="Firma, fatura veya not ara" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OsgbFinanceStatus | "ALL")}>
                <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100"><SelectValue placeholder="Firma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tüm firmalar</SelectItem>
                  {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="border-slate-700 bg-slate-900 text-slate-100" type="month" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" className="text-slate-300 hover:bg-slate-900 hover:text-white" onClick={resetFilters}>Filtreleri sıfırla</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <Table>
              <TableHeader className="bg-slate-900/90">
                <TableRow className="border-slate-800 hover:bg-slate-900">
                  <TableHead className="text-slate-300">Firma</TableHead>
                  <TableHead className="text-slate-300">Dönem</TableHead>
                  <TableHead className="text-slate-300">Tutar</TableHead>
                  <TableHead className="text-slate-300">Vade</TableHead>
                  <TableHead className="text-slate-300">Durum</TableHead>
                  <TableHead className="text-slate-300">Not</TableHead>
                  <TableHead className="text-right text-slate-300">Hızlı İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-14 text-center text-slate-400">Yükleniyor...</TableCell></TableRow>
                ) : records.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-16 text-center text-slate-500">Henüz finans kaydı eklenmedi</TableCell></TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id} className="border-slate-800 transition hover:bg-cyan-400/5">
                      <TableCell>
                        <div className="font-semibold text-white">{record.company_name || companyNameById.get(record.company_id) || "Firma"}</div>
                        <div className="text-xs text-slate-500">{record.invoice_no || "Fatura no yok"}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">{record.period}</TableCell>
                      <TableCell className="font-medium text-cyan-100">{formatMoney(record.amount)}</TableCell>
                      <TableCell className="text-slate-300">{formatDate(record.due_date)}</TableCell>
                      <TableCell><Badge className={cn("border", statusClass[record.status])}>{statusLabel[record.status]}</Badge></TableCell>
                      <TableCell className="max-w-[220px] truncate text-slate-400">{record.notes || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" className="border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20" onClick={() => handleStatus(record, "paid")}>Ödendi</Button>
                          <Button size="sm" variant="outline" className="border-amber-400/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20" onClick={() => handleStatus(record, "pending")}>Beklemede</Button>
                          <Button size="sm" variant="outline" className="border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20" onClick={() => handleStatus(record, "overdue")}>Gecikti</Button>
                          <Button size="sm" variant="outline" className="border-cyan-400/25 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20" onClick={() => handleDuplicateNextMonth(record)}><CopyPlus className="mr-1 h-3 w-3" />Sonraki Ay</Button>
                          <Button size="sm" variant="outline" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={() => setDetailRecord(record)}><Eye className="mr-1 h-3 w-3" />Detay</Button>
                          <Button size="sm" variant="outline" className="border-slate-700 bg-slate-900 text-rose-200 hover:bg-rose-950" onClick={() => handleDelete(record)}><Trash2 className="mr-1 h-3 w-3" />Sil</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Finans kaydını düzenle" : "Yeni finans kaydı"}</DialogTitle>
            <DialogDescription className="text-slate-400">OSGB firma tahsilatı için dönem, tutar, vade ve durum bilgilerini girin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Firma *</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}>
                <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100"><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Dönem *</Label><Input className="border-slate-700 bg-slate-900 text-slate-100" type="month" value={form.period} onChange={(event) => setForm((prev) => ({ ...prev, period: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tutar *</Label><Input className="border-slate-700 bg-slate-900 text-slate-100" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="15000" /></div>
            <div className="space-y-2"><Label>Vade Tarihi</Label><Input className="border-slate-700 bg-slate-900 text-slate-100" type="date" value={form.dueDate} onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Fatura No</Label><Input className="border-slate-700 bg-slate-900 text-slate-100" value={form.invoiceNo} onChange={(event) => setForm((prev) => ({ ...prev, invoiceNo: event.target.value }))} placeholder="IST-2026-002" /></div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as OsgbFinanceStatus }))}>
                <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pending">Beklemede</SelectItem><SelectItem value="paid">Ödendi</SelectItem><SelectItem value="overdue">Gecikti</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Notlar</Label><Textarea className="min-h-24 border-slate-700 bg-slate-900 text-slate-100" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Tahsilat notları, mutabakat bilgileri veya müşteri açıklaması" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kayıdı Ekle"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailRecord)} onOpenChange={(open) => !open && setDetailRecord(null)}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Finans Kaydı Detayı</DialogTitle>
            <DialogDescription className="text-slate-400">Kayıt bilgileri ve notlar.</DialogDescription>
          </DialogHeader>
          {detailRecord ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Firma</span><span>{detailRecord.company_name || "-"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Dönem</span><span>{detailRecord.period}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Tutar</span><span>{formatMoney(detailRecord.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Vade</span><span>{formatDate(detailRecord.due_date)}</span></div>
              <div className="rounded-2xl bg-slate-900 p-4 text-slate-300">{detailRecord.notes || "Not girilmemiş."}</div>
              <DialogFooter>
                <Button
                  className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  onClick={() => {
                    openEdit(detailRecord);
                    setDetailRecord(null);
                  }}
                >
                  Düzenle
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
