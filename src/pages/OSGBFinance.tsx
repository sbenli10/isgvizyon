import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CreditCard,
  Edit,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { useAccessRole } from "@/hooks/useAccessRole";
import { downloadCsv } from "@/lib/csvExport";
import {
  deleteOsgbFinance,
  getOsgbCompanyOptions,
  getOsgbFinanceOverview,
  listOsgbFinancePage,
  type OsgbFinanceCalendarItem,
  type OsgbCompanyOption,
  type OsgbFinanceInput,
  type OsgbFinanceOverview,
  type OsgbFinanceRecord,
  upsertOsgbFinance,
} from "@/lib/osgbOperations";

type FinanceFormState = {
  companyId: string;
  invoiceNo: string;
  servicePeriod: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: OsgbFinanceRecord["status"];
  paidAt: string;
  paymentNote: string;
};

const emptyForm: FinanceFormState = {
  companyId: "",
  invoiceNo: "",
  servicePeriod: "",
  invoiceDate: "",
  dueDate: "",
  amount: "",
  currency: "TRY",
  status: "pending",
  paidAt: "",
  paymentNote: "",
};

const statusLabel: Record<OsgbFinanceRecord["status"], string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  overdue: "Gecikmiş",
  cancelled: "İptal",
};

const statusClass: Record<OsgbFinanceRecord["status"], string> = {
  pending: "bg-yellow-500/15 text-yellow-200 border-yellow-400/20",
  paid: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  overdue: "bg-red-500/15 text-red-200 border-red-400/20",
  cancelled: "bg-slate-500/15 text-slate-200 border-slate-400/20",
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value || 0);

const CACHE_TTL_MS = 5 * 60 * 1000;
const getCacheKey = (userId: string) => `finance:${userId}`;
const FINANCE_PAGE_SIZE = 20;

export default function OSGBFinance() {
  const { user } = useAuth();
  const { canManage } = useAccessRole();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<OsgbFinanceRecord[]>([]);
  const [companies, setCompanies] = useState<OsgbCompanyOption[]>([]);
  const [calendarItems, setCalendarItems] = useState<OsgbFinanceCalendarItem[]>([]);
  const [overview, setOverview] = useState<OsgbFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OsgbFinanceRecord | null>(null);
  const [form, setForm] = useState<FinanceFormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [calendarView, setCalendarView] = useState<"weekly" | "monthly">("monthly");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status && ["pending", "paid", "overdue", "cancelled"].includes(status)) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const loadData = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try {
      const cacheKey = `${getCacheKey(user.id)}:${statusFilter}:${companyFilter}:${search}:${page}`;
      const [financeResult, companyRows, financeOverview] = await Promise.all([
        listOsgbFinancePage(user.id, {
          page,
          pageSize: FINANCE_PAGE_SIZE,
          status: statusFilter,
          companyId: companyFilter,
          search,
        }),
        companies.length > 0 ? Promise.resolve(companies) : getOsgbCompanyOptions(user.id),
        getOsgbFinanceOverview(user.id),
      ]);
      setRecords(financeResult.rows);
      setCompanies(companyRows);
      setCalendarItems(financeOverview.calendarItems);
      setOverview(financeOverview);
      setTotalCount(financeResult.count);
      writeOsgbPageCache(cacheKey, {
        records: financeResult.rows,
        companies: companyRows,
        calendarItems: financeOverview.calendarItems,
        overview: financeOverview,
        totalCount: financeResult.count,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OSGB finans kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const cached = readOsgbPageCache<{
      records: OsgbFinanceRecord[];
      companies: OsgbCompanyOption[];
      calendarItems: OsgbFinanceCalendarItem[];
      overview: OsgbFinanceOverview;
      totalCount: number;
    }>(`${getCacheKey(user.id)}:${statusFilter}:${companyFilter}:${search}:${page}`, CACHE_TTL_MS);
    if (cached) {
      setRecords(cached.records);
      setCompanies(cached.companies);
      setCalendarItems(cached.calendarItems);
      setOverview(cached.overview);
      setTotalCount(cached.totalCount);
      setLoading(false);
      void loadData(true);
      return;
    }
    void loadData();
  }, [companyFilter, page, search, statusFilter, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [companyFilter, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      pending: overview?.pendingAmount || 0,
      paid: overview?.paidAmount || 0,
      overdue: overview?.overdueAmount || 0,
    };
  }, [overview]);

  const filteredRecords = useMemo(() => {
    return records;
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(totalCount / FINANCE_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const groupedCalendar = useMemo(() => {
    const getWeekLabel = (value: string) => {
      const date = new Date(value);
      const day = date.getDay();
      const diff = date.getDate() - (day === 0 ? 6 : day - 1);
      const monday = new Date(date);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${monday.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })} - ${sunday.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}`;
    };

    return calendarItems.reduce<Record<string, OsgbFinanceCalendarItem[]>>((acc, item) => {
      const key = calendarView === "monthly" ? item.monthLabel : getWeekLabel(item.dueDate);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
  }, [calendarItems, calendarView]);

  const weeklyWorkload = useMemo(() => {
    const rows = Object.entries(
      calendarItems.reduce<Record<string, { label: string; totalAmount: number; count: number; overdueCount: number }>>((acc, item) => {
        const date = new Date(item.dueDate);
        const day = date.getDay();
        const diff = date.getDate() - (day === 0 ? 6 : day - 1);
        const monday = new Date(date);
        monday.setDate(diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const key = monday.toISOString().slice(0, 10);
        if (!acc[key]) {
          acc[key] = {
            label: `${monday.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })} - ${sunday.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}`,
            totalAmount: 0,
            count: 0,
            overdueCount: 0,
          };
        }
        acc[key].totalAmount += item.amount;
        acc[key].count += 1;
        if (item.isOverdue) acc[key].overdueCount += 1;
        return acc;
      }, {}),
    );

    return rows.sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
  }, [calendarItems]);

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
      invoiceNo: record.invoice_no || "",
      servicePeriod: record.service_period || "",
      invoiceDate: record.invoice_date || "",
      dueDate: record.due_date || "",
      amount: String(record.amount || ""),
      currency: record.currency || "TRY",
      status: record.status,
      paidAt: record.paid_at ? record.paid_at.slice(0, 10) : "",
      paymentNote: record.payment_note || "",
    });
    setDialogOpen(true);
  };

  const handleCalendarOpen = (calendarItem: OsgbFinanceCalendarItem) => {
    const matched = records.find((record) => record.id === calendarItem.id);
    if (!matched) {
      toast.error("İlgili finans kaydı bulunamadı.");
      return;
    }
    openEdit(matched);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!user?.id || !form.companyId || !form.amount) {
      toast.error("Firma ve tutar alanları zorunludur.");
      return;
    }
    if (Number(form.amount) <= 0) {
      toast.error("Tutar sıfırdan büyük olmalıdır.");
      return;
    }
    if (form.invoiceDate && form.dueDate && new Date(form.invoiceDate) > new Date(form.dueDate)) {
      toast.error("Vade tarihi fatura tarihinden önce olamaz.");
      return;
    }
    if (form.status === "paid" && !form.paidAt) {
      toast.error("Ödenen kayıt için ödeme tarihi girilmelidir.");
      return;
    }

    setSaving(true);
    try {
      const payload: OsgbFinanceInput = {
        companyId: form.companyId,
        invoiceNo: form.invoiceNo,
        servicePeriod: form.servicePeriod,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        amount: Number(form.amount),
        currency: form.currency || "TRY",
        status: form.status,
        paidAt: form.paidAt,
        paymentNote: form.paymentNote,
      };

      await upsertOsgbFinance(user.id, payload, editing?.id);
      await loadData(true);
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Finans kaydı güncellendi." : "Finans kaydı oluşturuldu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finans kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) {
      toast.error("Bu işlem için düzenleme yetkisi gerekiyor.");
      return;
    }
    if (!confirm("Bu finans kaydını silmek istiyor musunuz?")) return;
    try {
      await deleteOsgbFinance(id);
      await loadData(true);
      toast.success("Finans kaydı silindi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finans kaydı silinemedi.");
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Finans Yönetimi</h1>
              <p className="text-sm text-slate-400">Firma bazlı tahsilat, geciken ödeme ve fatura görünümü.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "osgb-finans.csv",
                ["Firma", "Fatura No", "Hizmet Dönemi", "Vade", "Tutar", "Durum"],
                filteredRecords.map((record) => [
                  record.company?.company_name || "",
                  record.invoice_no || "",
                  record.service_period || "",
                  record.due_date || "",
                  record.amount,
                  statusLabel[record.status],
                ]),
              )
            }
          >
            Dışa Aktar
          </Button>
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button onClick={openCreate} disabled={!canManage}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni kayıt
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Finans verisi yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <button type="button" onClick={() => setStatusFilter("pending")} className="text-left">
          <Card className="border-slate-800 bg-slate-900/70 transition hover:border-yellow-500/30">
            <CardHeader className="pb-3"><CardDescription>Bekleyen tahsilat</CardDescription><CardTitle className="mt-2 text-3xl text-white">{formatMoney(summary.pending, "TRY")}</CardTitle></CardHeader>
          </Card>
        </button>
        <button type="button" onClick={() => setStatusFilter("paid")} className="text-left">
          <Card className="border-slate-800 bg-slate-900/70 transition hover:border-emerald-500/30">
            <CardHeader className="pb-3"><CardDescription>Tahsil edilen</CardDescription><CardTitle className="mt-2 text-3xl text-white">{formatMoney(summary.paid, "TRY")}</CardTitle></CardHeader>
          </Card>
        </button>
        <button type="button" onClick={() => setStatusFilter("overdue")} className="text-left">
            <Card className="border-slate-800 bg-slate-900/70 transition hover:border-red-500/30">
              <CardHeader className="pb-3"><CardDescription>Geciken tahsilat</CardDescription><CardTitle className="mt-2 text-3xl text-white">{formatMoney(summary.overdue, "TRY")}</CardTitle></CardHeader>
            </Card>
        </button>
      </div>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-white">Ödeme durumu takvimi</CardTitle>
              <CardDescription>Gecikmiş ve önümüzdeki 60 gün içindeki tahsilatlar kronolojik görünür.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={calendarView === "weekly" ? "default" : "outline"} size="sm" onClick={() => setCalendarView("weekly")}>
                Haftalık
              </Button>
              <Button variant={calendarView === "monthly" ? "default" : "outline"} size="sm" onClick={() => setCalendarView("monthly")}>
                Aylık
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {calendarItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
              Takvimde gösterilecek finans kaydı bulunamadı.
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedCalendar).map(([month, items]) => (
                <div key={month} className="space-y-3">
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">{month}</div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleCalendarOpen(item)}
                        className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-950/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">{item.companyName}</div>
                            <div className="mt-1 text-xs text-slate-400">{item.invoiceNo || item.servicePeriod || "Fatura kaydı"}</div>
                          </div>
                          <Badge className={cn("border", item.isOverdue ? statusClass.overdue : statusClass.pending)}>
                            {item.isOverdue ? "Gecikmiş" : item.dayLabel}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-end justify-between">
                          <div className="text-xs text-slate-500">Vade: {formatDate(item.dueDate)}</div>
                          <div className="text-sm font-semibold text-white">{formatMoney(item.amount, item.currency)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Haftalık iş yükü görünümü</CardTitle>
          <CardDescription>Tahsilat ekibinin hafta bazında yoğunluğunu ve gecikmiş kayıt baskısını gösterir.</CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyWorkload.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
              Haftalık iş yükü için uygun finans kaydı bulunamadı.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-3">
              {weeklyWorkload.map((week) => (
                <div key={week.label} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-sm font-semibold text-white">{week.label}</div>
                  <div className="mt-3 space-y-1 text-sm text-slate-400">
                    <div>Planlanan tahsilat: <span className="text-slate-200">{week.count}</span></div>
                    <div>Toplam tutar: <span className="text-slate-200">{formatMoney(week.totalAmount, "TRY")}</span></div>
                    <div>Gecikmiş kayıt: <span className={cn("font-medium", week.overdueCount > 0 ? "text-red-300" : "text-emerald-300")}>{week.overdueCount}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Finans kayıtları</CardTitle>
          <CardDescription>OSGB müşteri tahsilat akışı ve ödeme durumu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Fatura no, firma, dönem veya not ara" />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full lg:w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm firmalar</SelectItem>
                {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm durumlar</SelectItem>
                <SelectItem value="pending">Bekliyor</SelectItem>
                <SelectItem value="paid">Ödendi</SelectItem>
                <SelectItem value="overdue">Gecikmiş</SelectItem>
                <SelectItem value="cancelled">İptal</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearch(""); setCompanyFilter("ALL"); setStatusFilter("ALL"); }}>
              Filtreyi temizle
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead>Firma</TableHead>
                <TableHead>Fatura No</TableHead>
                <TableHead>Dönem</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">Yükleniyor...</TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">Eşleşen finans kaydı bulunamadı.</TableCell></TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id} className="border-slate-800">
                    <TableCell className="font-medium text-white">{record.company?.company_name || "Firma"}</TableCell>
                    <TableCell>{record.invoice_no || "-"}</TableCell>
                    <TableCell>{record.service_period || "-"}</TableCell>
                    <TableCell>{formatMoney(record.amount, record.currency || "TRY")}</TableCell>
                    <TableCell>{formatDate(record.due_date)}</TableCell>
                    <TableCell>
                      <Badge className={cn("border", statusClass[record.status])}>{statusLabel[record.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="outline" onClick={() => openEdit(record)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="outline" onClick={() => handleDelete(record.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalCount > FINANCE_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>Sayfa {page} / {totalPages} • Toplam kayıt {totalCount}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Finans kaydını düzenle" : "Yeni finans kaydı"}</DialogTitle>
            <DialogDescription>Firma bazlı tahsilat ve ödeme takibini yönetin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Firma</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Firma seçin" /></SelectTrigger>
                <SelectContent>
                  {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Fatura No</Label><Input value={form.invoiceNo} onChange={(e) => setForm((prev) => ({ ...prev, invoiceNo: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Hizmet Dönemi</Label><Input value={form.servicePeriod} onChange={(e) => setForm((prev) => ({ ...prev, servicePeriod: e.target.value }))} placeholder="2026 Mart" /></div>
            <div className="space-y-2"><Label>Tutar</Label><Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Fatura Tarihi</Label><Input type="date" value={form.invoiceDate} onChange={(e) => setForm((prev) => ({ ...prev, invoiceDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Vade Tarihi</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Durum</Label><Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as OsgbFinanceRecord["status"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Bekliyor</SelectItem><SelectItem value="paid">Ödendi</SelectItem><SelectItem value="overdue">Gecikmiş</SelectItem><SelectItem value="cancelled">İptal</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Ödeme Tarihi</Label><Input type="date" value={form.paidAt} onChange={(e) => setForm((prev) => ({ ...prev, paidAt: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Not</Label><Textarea value={form.paymentNote} onChange={(e) => setForm((prev) => ({ ...prev, paymentNote: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



