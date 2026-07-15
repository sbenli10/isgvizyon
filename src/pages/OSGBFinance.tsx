import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  BadgeDollarSign,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOsgbManagedCompanies } from "@/hooks/useOsgbManagedCompanies";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getUserFacingErrorDescription,
  notifyUserFacingError,
} from "@/lib/userFacingError";
import {
  createOsgbFinanceRecord,
  createOsgbFixedExpense,
  createOsgbFixedExpenses,
  deleteOsgbFinanceRecord,
  deleteOsgbFixedExpense,
  duplicateFinanceNextMonth,
  listOsgbFixedExpenses,
  listOsgbFinanceRecords,
  markFinanceOverdue,
  markFinancePaid,
  markFinancePending,
  OSGB_FIXED_EXPENSE_ITEMS,
  updateOsgbFixedExpense,
  updateOsgbFinanceRecord,
  type OsgbFixedExpenseInput,
  type OsgbFixedExpenseRecord,
  type OsgbFixedExpenseStatus,
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

type FixedExpenseFormState = {
  expenseItem: string;
  period: string;
  amount: string;
  dueDate: string;
  status: OsgbFixedExpenseStatus;
  isRecurring: boolean;
  recurringPeriods: string[];
  notes: string;
};

type ManagedCompany = {
  id: string;
  companyName?: string | null;
  company_name?: string | null;
  sgkNo?: string | null;
  sgk_no?: string | null;
};

type Tone = "cyan" | "emerald" | "amber" | "rose" | "blue";
type FinanceTab = "income" | "expenses";

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FinanceFormState => ({
  companyId: "",
  period: currentPeriod(),
  amount: "",
  dueDate: "",
  invoiceNo: "",
  status: "pending",
  notes: "",
});

const emptyExpenseForm = (): FixedExpenseFormState => ({
  expenseItem: "",
  period: currentPeriod(),
  amount: "",
  dueDate: "",
  status: "pending",
  isRecurring: false,
  recurringPeriods: [currentPeriod()],
  notes: "",
});

const statusLabels: Record<OsgbFinanceStatus, string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  overdue: "Gecikti",
};

const expenseStatusLabels: Record<OsgbFixedExpenseStatus, string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  overdue: "Gecikti",
};

const statusClasses: Record<OsgbFinanceStatus, string> = {
  pending: "border-slate-500/50 bg-slate-500/20 text-slate-100",
  paid: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  overdue: "border-rose-400/40 bg-rose-500/15 text-rose-100",
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(Number(value || 0));

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
};

const formatMonthLabel = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
};

const parseAmount = (value: string) => {
  const normalized = value.trim().replace(/[₺\s]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value: unknown) => String(value || "").toLocaleLowerCase("tr-TR").trim();

const getCompanyLabel = (company: ManagedCompany | null | undefined) =>
  company?.companyName || company?.company_name || "Firma";

const getCompanySgkNo = (company: ManagedCompany | null | undefined) => company?.sgkNo || company?.sgk_no || null;

const daysUntil = (value: string | null | undefined) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const today = new Date(`${todayIso()}T00:00:00`);
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};

const isPastDue = (record: OsgbFinanceRecord) => record.status !== "paid" && daysUntil(record.dueDate) < 0;
const isDueToday = (record: OsgbFinanceRecord) => record.status !== "paid" && daysUntil(record.dueDate) === 0;

const isDueNextSevenDays = (record: OsgbFinanceRecord) => {
  const days = daysUntil(record.dueDate);
  return record.status !== "paid" && days > 0 && days <= 7;
};

const financeSearchText = (record: OsgbFinanceRecord) =>
  normalizeText([record.companyName, record.period, record.invoiceNo, record.notes].join(" "));

const expenseSearchText = (record: OsgbFixedExpenseRecord) =>
  normalizeText([record.expenseItem, record.period, record.notes].join(" "));

const parsePeriod = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  return { year: year || new Date().getFullYear(), month: month || new Date().getMonth() + 1 };
};

const addMonthsToPeriod = (period: string, count: number) => {
  const { year, month } = parsePeriod(period);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const alignDueDateToPeriod = (dueDate: string, period: string) => {
  if (!dueDate) return "";
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "";
  const { year, month } = parsePeriod(period);
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(due.getDate(), lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const makeInvoiceNo = (period: string, count: number) => {
  const year = period.slice(0, 4) || new Date().getFullYear().toString();
  return `IST-${year}-${String(count + 1).padStart(3, "0")}`;
};

const FINANCE_DEBUG = true;

const financeDebugLog = (event: string, payload?: Record<string, unknown>) => {
  if (!FINANCE_DEBUG) return;
  console.groupCollapsed(`[OSGBFinance] ${event}`);
  if (payload) {
    console.table(payload);
  }
  console.groupEnd();
};

const sumAmounts = (rows: OsgbFinanceRecord[]) => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
const sumExpenseAmounts = (rows: OsgbFixedExpenseRecord[]) =>
  rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

const buildStats = (rows: OsgbFinanceRecord[]) => {
  const total = sumAmounts(rows);
  const paidRows = rows.filter((record) => record.status === "paid");
  const overdueRows = rows.filter((record) => record.status === "overdue" || isPastDue(record));
  const pendingRows = rows.filter((record) => record.status === "pending" && !isPastDue(record));
  const paid = sumAmounts(paidRows);
  const pending = sumAmounts(pendingRows);
  const overdue = sumAmounts(overdueRows);
  const ratio = total > 0 ? Math.round((paid / total) * 100) : 0;

  return { total, paid, pending, overdue, ratio, paidRows, pendingRows, overdueRows };
};

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
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
}) => {
  const toneClass = {
    cyan: "text-cyan-300 bg-cyan-500/10",
    emerald: "text-emerald-300 bg-emerald-500/10",
    amber: "text-amber-300 bg-amber-500/10",
    rose: "text-rose-300 bg-rose-500/10",
    blue: "text-sky-300 bg-sky-500/10",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-800 bg-[#080f22] p-4 shadow-lg shadow-slate-950/30 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/30 hover:shadow-cyan-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p>
        </div>
        <span className={cn("rounded-xl p-2", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
};

const RadarCard = ({
  title,
  count,
  amount,
  description,
  icon: Icon,
}: {
  title: string;
  count: number;
  amount: number;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) => (
  <div className="rounded-xl border border-slate-700/70 bg-[#0b1428] p-4 transition duration-200 hover:border-cyan-400/30 hover:bg-[#101b31]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{title}</p>
        <p className="mt-3 text-2xl font-black text-white">{count}</p>
        <p className="mt-1 text-xs font-bold text-slate-300">{formatCurrency(amount)}</p>
      </div>
      <span className="rounded-xl bg-[#050a18] p-2 text-slate-300">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-4 text-xs font-semibold leading-5 text-slate-400">{description}</p>
  </div>
);

const FixedExpensesPanel = ({
  records,
  filteredRecords,
  loading,
  search,
  statusFilter,
  itemFilter,
  periodFilter,
  periods,
  stats,
  filteredTotal,
  onSearchChange,
  onStatusFilterChange,
  onItemFilterChange,
  onPeriodFilterChange,
  onResetFilters,
  onOpenCreate,
  onEdit,
  onDelete,
}: {
  records: OsgbFixedExpenseRecord[];
  filteredRecords: OsgbFixedExpenseRecord[];
  loading: boolean;
  search: string;
  statusFilter: OsgbFixedExpenseStatus | "all";
  itemFilter: string;
  periodFilter: string;
  periods: string[];
  stats: { total: number; paid: number; pending: number; overdue: number };
  filteredTotal: number;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: OsgbFixedExpenseStatus | "all") => void;
  onItemFilterChange: (value: string) => void;
  onPeriodFilterChange: (value: string) => void;
  onResetFilters: () => void;
  onOpenCreate: () => void;
  onEdit: (record: OsgbFixedExpenseRecord) => void;
  onDelete: (record: OsgbFixedExpenseRecord) => void;
}) => (
  <>
    <div className="grid gap-3 md:grid-cols-4">
      <KpiCard title={`${periodFilter === "all" ? currentPeriod() : periodFilter} Gider`} value={formatCurrency(stats.total)} subtitle={`${records.length} kayıt`} icon={Wallet} />
      <KpiCard title="Ödenen" value={formatCurrency(stats.paid)} subtitle="Kapanan giderler" icon={BadgeDollarSign} tone="emerald" />
      <KpiCard title="Bekleyen" value={formatCurrency(stats.pending)} subtitle="Takipteki giderler" icon={Clock3} tone="amber" />
      <KpiCard title="Geciken" value={formatCurrency(stats.overdue)} subtitle="Kritik giderler" icon={ShieldAlert} tone="rose" />
    </div>

    <section className="rounded-xl border border-slate-800 bg-[#070d1f] p-3 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Gider kalemi, dönem veya not ara"
            className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] pl-10 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as OsgbFixedExpenseStatus | "all")}>
          <SelectTrigger className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-40">
            <SelectValue placeholder="Tüm durumlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            <SelectItem value="pending">Beklemede</SelectItem>
            <SelectItem value="paid">Ödendi</SelectItem>
            <SelectItem value="overdue">Gecikti</SelectItem>
          </SelectContent>
        </Select>
        <Select value={itemFilter} onValueChange={onItemFilterChange}>
          <SelectTrigger className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-44">
            <SelectValue placeholder="Tüm kalemler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm kalemler</SelectItem>
            {OSGB_FIXED_EXPENSE_ITEMS.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={onPeriodFilterChange}>
          <SelectTrigger className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-40">
            <SelectValue placeholder="Tüm dönemler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm dönemler</SelectItem>
            {periods.map((period) => (
              <SelectItem key={period} value={period}>{period}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="secondary" onClick={onResetFilters} className="h-11 rounded-xl bg-slate-800 text-slate-100 hover:bg-slate-700">
          <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtreleri Sıfırla
        </Button>
        <Button type="button" onClick={onOpenCreate} className="h-11 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">
          <Plus className="mr-2 h-4 w-4" /> Yeni Gider
        </Button>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-400">
        {filteredRecords.length} kayıt gösteriliyor • Filtrelenen gider {formatCurrency(filteredTotal)} • Tüm dönemler {formatCurrency(sumExpenseAmounts(records))}
      </p>
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#050a18]">
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center text-slate-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sabit giderler yükleniyor...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
          <div className="rounded-2xl bg-slate-800 p-4 text-slate-300">
            <Search className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-black text-white">Henüz gider kaydı eklenmedi</h3>
          <p className="mt-2 max-w-lg text-sm text-slate-400">
            İlk sabit gider kaydınızı ekleyin. Tekrarlayan giderler için birden fazla ay seçebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {filteredRecords.map((record) => (
            <div key={record.id} className="grid gap-3 p-4 text-sm text-slate-200 transition hover:bg-slate-900/60 lg:grid-cols-[1.2fr_.7fr_.7fr_.7fr_.8fr_1fr_auto] lg:items-center">
              <div>
                <p className="font-black text-white"><FileText className="mr-2 inline h-4 w-4 text-cyan-300" />{record.expenseItem}</p>
                <p className="mt-1 text-xs text-slate-500">{record.isRecurring ? "Tekrarlayan gider" : "Tekil gider"}</p>
              </div>
              <div className="font-semibold">{formatMonthLabel(record.period)}</div>
              <div className="font-black text-white">{formatCurrency(record.amount)}</div>
              <div><Calendar className="mr-2 inline h-4 w-4 text-slate-400" />{formatDate(record.dueDate)}</div>
              <div><Badge className={cn("rounded-full", statusClasses[record.status])}>{expenseStatusLabels[record.status]}</Badge></div>
              <div className="min-w-0 truncate text-slate-400">{record.notes || "-"}</div>
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => onEdit(record)} className="h-8 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-blue-700">
                  <Edit3 className="mr-1 h-3 w-3" /> Düzenle
                </Button>
                <Button size="sm" onClick={() => onDelete(record)} className="h-8 rounded-full bg-rose-500/20 px-3 text-xs text-rose-100 hover:bg-rose-700">
                  <Trash2 className="mr-1 h-3 w-3" /> Sil
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  </>
);

export default function OSGBFinance() {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const { companies = [] } = useOsgbManagedCompanies(organizationId);

  const [records, setRecords] = useState<OsgbFinanceRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<OsgbFixedExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OsgbFinanceRecord | null>(null);
  const [editingExpenseRecord, setEditingExpenseRecord] = useState<OsgbFixedExpenseRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<OsgbFinanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OsgbFinanceRecord | null>(null);
  const [expenseDeleteTarget, setExpenseDeleteTarget] = useState<OsgbFixedExpenseRecord | null>(null);
  const [form, setForm] = useState<FinanceFormState>(emptyForm);
  const [expenseForm, setExpenseForm] = useState<FixedExpenseFormState>(emptyExpenseForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OsgbFinanceStatus | "all">("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<OsgbFixedExpenseStatus | "all">("all");
  const [expenseItemFilter, setExpenseItemFilter] = useState("all");
  const [expensePeriodFilter, setExpensePeriodFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<FinanceTab>("income");

  usePageDataTiming(loading);

  const companyNameById = useMemo(
    () => new Map(companies.map((company) => [company.id, getCompanyLabel(company as ManagedCompany)])),
    [companies],
  );

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company as ManagedCompany])),
    [companies],
  );

  const hydrateRecord = useCallback(
    (record: OsgbFinanceRecord): OsgbFinanceRecord => ({
      ...record,
      companyName: record.companyName || companyNameById.get(record.companyId) || "Firma",
    }),
    [companyNameById],
  );

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setRecords([]);
      setExpenseRecords([]);
      setError(null);
      setLoading(false);
      setExpensesLoading(false);
      return;
    }

    setLoading(true);
    setExpensesLoading(true);
    try {
      const [rows, fixedExpenseRows] = await Promise.all([
        listOsgbFinanceRecords(organizationId),
        listOsgbFixedExpenses(organizationId),
      ]);
      setRecords((rows || []).map(hydrateRecord));
      setExpenseRecords(fixedExpenseRows || []);
      setError(null);
    } catch (err) {
      setError(getUserFacingErrorDescription(err));
    } finally {
      setLoading(false);
      setExpensesLoading(false);
    }
  }, [hydrateRecord, organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const periods = useMemo(() => {
    const set = new Set(records.map((record) => record.period).filter(Boolean));
    set.add(currentPeriod());
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const term = normalizeText(search);

    return records.filter((record) => {
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      if (companyFilter !== "all" && record.companyId !== companyFilter) return false;
      if (periodFilter !== "all" && record.period !== periodFilter) return false;
      if (term && !financeSearchText(record).includes(term)) return false;
      return true;
    });
  }, [companyFilter, periodFilter, records, search, statusFilter]);

  const stats = useMemo(() => buildStats(records), [records]);

  const filteredTotal = useMemo(() => sumAmounts(filteredRecords), [filteredRecords]);

  const expensePeriods = useMemo(() => {
    const set = new Set(expenseRecords.map((record) => record.period).filter(Boolean));
    set.add(currentPeriod());
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [expenseRecords]);

  const filteredExpenseRecords = useMemo(() => {
    const term = normalizeText(expenseSearch);

    return expenseRecords.filter((record) => {
      if (expenseStatusFilter !== "all" && record.status !== expenseStatusFilter) return false;
      if (expenseItemFilter !== "all" && record.expenseItem !== expenseItemFilter) return false;
      if (expensePeriodFilter !== "all" && record.period !== expensePeriodFilter) return false;
      if (term && !expenseSearchText(record).includes(term)) return false;
      return true;
    });
  }, [expenseItemFilter, expensePeriodFilter, expenseRecords, expenseSearch, expenseStatusFilter]);

  const expenseStats = useMemo(() => {
    const total = sumExpenseAmounts(filteredExpenseRecords);
    const paid = sumExpenseAmounts(filteredExpenseRecords.filter((record) => record.status === "paid"));
    const pending = sumExpenseAmounts(filteredExpenseRecords.filter((record) => record.status === "pending"));
    const overdue = sumExpenseAmounts(filteredExpenseRecords.filter((record) => record.status === "overdue"));
    return { total, paid, pending, overdue };
  }, [filteredExpenseRecords]);

  const filteredExpenseTotal = useMemo(() => sumExpenseAmounts(filteredExpenseRecords), [filteredExpenseRecords]);

  const radar = useMemo(() => {
    const todayRows = records.filter(isDueToday);
    const nextSevenRows = records.filter(isDueNextSevenDays);
    return {
      overdue: stats.overdueRows,
      today: todayRows,
      nextSeven: nextSevenRows,
      pending: stats.pendingRows,
      paid: stats.paidRows,
    };
  }, [records, stats.overdueRows, stats.paidRows, stats.pendingRows]);

  const lastSixPeriods = useMemo(() => {
    const base = new Date(`${currentPeriod()}-01T00:00:00`);

    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(base);
      date.setMonth(base.getMonth() - (5 - index));
      const period = date.toISOString().slice(0, 7);
      const paidAmount = sumAmounts(records.filter((record) => record.period === period && record.status === "paid"));
      return { period, paidAmount };
    });
  }, [records]);

  const maxLastSixAmount = Math.max(1, ...lastSixPeriods.map((item) => item.paidAmount));

  const selectedCompany = useMemo(
    () => (companies as ManagedCompany[]).find((company) => company.id === form.companyId) || null,
    [companies, form.companyId],
  );
  const dialogPortalContainer = typeof document !== "undefined" ? document.body : null;

  useEffect(() => {
    financeDebugLog("dialog state changed", {
      dialogOpen,
      editingRecordId: editingRecord?.id || null,
      formCompanyId: form.companyId || null,
      formPeriod: form.period,
      companiesCount: companies.length,
    });
  }, [companies.length, dialogOpen, editingRecord?.id, form.companyId, form.period]);

  const openCreateDialog = () => {
    financeDebugLog("new record button clicked", {
      organizationId,
      userId: user?.id || null,
      companiesCount: companies.length,
      companyFilter,
      periodFilter,
      recordsCount: records.length,
      currentDialogOpen: dialogOpen,
    });

    const filteredCompanyExists = companies.some((company) => company.id === companyFilter);
    const firstCompanyId = companyFilter !== "all" && filteredCompanyExists ? companyFilter : companies[0]?.id || "";
    const period = periodFilter !== "all" ? periodFilter : currentPeriod();
    const nextForm = {
      ...emptyForm(),
      companyId: firstCompanyId,
      period,
      invoiceNo: makeInvoiceNo(period, records.length),
    };

    financeDebugLog("new record dialog prepared", {
      filteredCompanyExists,
      firstCompanyId: firstCompanyId || null,
      period,
      invoiceNo: nextForm.invoiceNo,
      willOpenDialog: true,
    });

    setEditingRecord(null);
    setForm(nextForm);
    setDialogOpen(true);
  };

  const openEditDialog = (record: OsgbFinanceRecord) => {
    setEditingRecord(record);
    setForm({
      companyId: record.companyId,
      period: record.period,
      amount: String(record.amount || ""),
      dueDate: record.dueDate || "",
      invoiceNo: record.invoiceNo || "",
      status: record.status,
      notes: record.notes || "",
    });
    setDialogOpen(true);
  };

  const buildInput = (): OsgbFinanceInput => ({
    companyId: form.companyId,
    companyName: getCompanyLabel(selectedCompany),
    period: form.period,
    amount: parseAmount(form.amount),
    invoiceNo: form.invoiceNo.trim() || null,
    dueDate: form.dueDate || null,
    status: form.status,
    notes: form.notes.trim() || null,
  });

  const handleSave = async () => {
    if (!organizationId || !user?.id) {
      toast.error("Oturum veya organizasyon bilgisi bulunamadı.");
      return;
    }

    const amount = parseAmount(form.amount);
    if (!form.companyId || !form.period || amount <= 0) {
      toast.error("Firma, dönem ve 0'dan büyük tutar zorunlu.");
      return;
    }

    setSaving(true);
    try {
      const input = buildInput();
      if (editingRecord) {
        await updateOsgbFinanceRecord(editingRecord.id, organizationId, input);
        toast.success("Finans kaydı güncellendi.");
      } else {
        await createOsgbFinanceRecord(user.id, organizationId, input);
        toast.success("Finans kaydı eklendi.");
      }
      setDialogOpen(false);
      setEditingRecord(null);
      await loadData();
    } catch (err) {
      notifyUserFacingError(err, {
        fallbackTitle: "Finans kaydı kaydedilemedi",
        fallbackDescription: "Tahsilat kaydı şu anda kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.",
      });
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
    } catch (err) {
      notifyUserFacingError(err, {
        fallbackTitle: "İşlem tamamlanamadı",
        fallbackDescription: "Seçili finans işlemi tamamlanamadı. Biraz sonra tekrar deneyin.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!organizationId || !deleteTarget) return;
    await runRecordAction(
      deleteTarget,
      () => deleteOsgbFinanceRecord(deleteTarget.id, organizationId),
      "Finans kaydı silindi.",
    );
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

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OSGB Finans");
    XLSX.writeFile(workbook, `osgb-finans-ekstre-${todayIso()}.xlsx`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCompanyFilter("all");
    setPeriodFilter("all");
  };

  const resetExpenseFilters = () => {
    setExpenseSearch("");
    setExpenseStatusFilter("all");
    setExpenseItemFilter("all");
    setExpensePeriodFilter("all");
  };

  const openCreateExpenseDialog = () => {
    const period = expensePeriodFilter !== "all" ? expensePeriodFilter : currentPeriod();
    setEditingExpenseRecord(null);
    setExpenseForm({
      ...emptyExpenseForm(),
      period,
      recurringPeriods: [period],
    });
    setExpenseDialogOpen(true);
  };

  const openEditExpenseDialog = (record: OsgbFixedExpenseRecord) => {
    setEditingExpenseRecord(record);
    setExpenseForm({
      expenseItem: record.expenseItem,
      period: record.period,
      amount: String(record.amount || ""),
      dueDate: record.dueDate || "",
      status: record.status,
      isRecurring: record.isRecurring,
      recurringPeriods: [record.period],
      notes: record.notes || "",
    });
    setExpenseDialogOpen(true);
  };

  const buildExpenseInputs = (): OsgbFixedExpenseInput[] => {
    const amount = parseAmount(expenseForm.amount);
    const selectedPeriods = expenseForm.isRecurring
      ? Array.from(new Set(expenseForm.recurringPeriods.length > 0 ? expenseForm.recurringPeriods : [expenseForm.period])).sort()
      : [expenseForm.period];

    const recurringGroupId =
      expenseForm.isRecurring && !editingExpenseRecord && typeof crypto !== "undefined"
        ? crypto.randomUUID()
        : editingExpenseRecord?.recurringGroupId || null;

    return selectedPeriods.map((period) => {
      const { year, month } = parsePeriod(period);
      return {
        expenseItem: expenseForm.expenseItem,
        periodYear: year,
        periodMonth: month,
        amount,
        dueDate: alignDueDateToPeriod(expenseForm.dueDate, period) || null,
        status: expenseForm.status,
        notes: expenseForm.notes.trim() || null,
        isRecurring: expenseForm.isRecurring,
        recurringGroupId,
      };
    });
  };

  const handleSaveExpense = async () => {
    if (!organizationId || !user?.id) {
      toast.error("Oturum veya organizasyon bilgisi bulunamadı.");
      return;
    }

    const amount = parseAmount(expenseForm.amount);
    if (!expenseForm.expenseItem || !expenseForm.period || amount <= 0) {
      toast.error("Gider kalemi, dönem ve 0'dan büyük tutar zorunlu.");
      return;
    }

    setExpenseSaving(true);
    try {
      const inputs = buildExpenseInputs();
      if (editingExpenseRecord) {
        await updateOsgbFixedExpense(editingExpenseRecord.id, organizationId, inputs[0]);
        toast.success("Sabit gider kaydı güncellendi.");
      } else if (inputs.length > 1) {
        await createOsgbFixedExpenses(user.id, organizationId, inputs);
        toast.success(`${inputs.length} dönem için sabit gider oluşturuldu.`);
      } else {
        await createOsgbFixedExpense(user.id, organizationId, inputs[0]);
        toast.success("Sabit gider kaydı eklendi.");
      }

      setExpenseDialogOpen(false);
      setEditingExpenseRecord(null);
      await loadData();
    } catch (err) {
      notifyUserFacingError(err, {
        fallbackTitle: "Sabit gider kaydedilemedi",
        fallbackDescription: "Sabit gider kaydı şu anda kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.",
      });
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!organizationId || !expenseDeleteTarget) return;

    setActionLoadingId(expenseDeleteTarget.id);
    try {
      await deleteOsgbFixedExpense(expenseDeleteTarget.id, organizationId);
      setExpenseDeleteTarget(null);
      await loadData();
      toast.success("Sabit gider kaydı silindi.");
    } catch (err) {
      notifyUserFacingError(err, {
        fallbackTitle: "Sabit gider silinemedi",
        fallbackDescription: "Sabit gider kaydı şu anda silinemedi. Sayfayı yenileyip tekrar deneyin.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!organizationId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <div>
            <h2 className="font-black">Organizasyon bağlantısı gerekli</h2>
            <p className="mt-1 text-sm text-amber-100/80">
              Finans ekranı için önce bir organizasyon/çalışma alanı oluşturun.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111c2e] p-3 text-slate-100 sm:p-4">
      <div className="space-y-4">
        <div className="grid rounded-xl border border-slate-700/70 bg-[#050a18] p-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveTab("income")}
            className={cn(
              "rounded-lg px-4 py-3 text-sm font-black transition",
              activeTab === "income"
                ? "bg-[#1a273c] text-white shadow-inner"
                : "text-slate-400 hover:bg-slate-900/70 hover:text-slate-100",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Tahsilatlar / Gelirler
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expenses")}
            className={cn(
              "rounded-lg px-4 py-3 text-sm font-bold transition",
              activeTab === "expenses"
                ? "bg-[#1a273c] text-white shadow-inner"
                : "text-slate-400 hover:bg-slate-900/70 hover:text-slate-100",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Sabit Giderler
            </span>
          </button>
        </div>

        {activeTab === "expenses" ? (
          <FixedExpensesPanel
            records={expenseRecords}
            filteredRecords={filteredExpenseRecords}
            loading={expensesLoading}
            search={expenseSearch}
            statusFilter={expenseStatusFilter}
            itemFilter={expenseItemFilter}
            periodFilter={expensePeriodFilter}
            periods={expensePeriods}
            stats={expenseStats}
            filteredTotal={filteredExpenseTotal}
            onSearchChange={setExpenseSearch}
            onStatusFilterChange={setExpenseStatusFilter}
            onItemFilterChange={setExpenseItemFilter}
            onPeriodFilterChange={setExpensePeriodFilter}
            onResetFilters={resetExpenseFilters}
            onOpenCreate={openCreateExpenseDialog}
            onEdit={openEditExpenseDialog}
            onDelete={setExpenseDeleteTarget}
          />
        ) : (
          <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            title="Toplam Alacak"
            value={formatCurrency(stats.total)}
            subtitle={`${records.length} kayıt`}
            icon={Wallet}
          />
          <KpiCard
            title="Tahsil Edilen"
            value={formatCurrency(stats.paid)}
            subtitle={`${radar.paid.length} tahsilat kapandı`}
            icon={BadgeDollarSign}
            tone="emerald"
          />
          <KpiCard
            title="Bekleyen Tahsilat"
            value={formatCurrency(stats.pending)}
            subtitle={`${radar.pending.length} kayıt takipte`}
            icon={Clock3}
            tone="amber"
          />
          <KpiCard
            title="Geciken Tahsilat"
            value={formatCurrency(stats.overdue)}
            subtitle={`${radar.overdue.length} kritik kayıt`}
            icon={ShieldAlert}
            tone="rose"
          />
          <KpiCard
            title="Tahsilat Oranı"
            value={`%${stats.ratio}`}
            subtitle={stats.total ? "Portföy tahsilat performansı" : "Henüz portföy yok"}
            icon={BarChart3}
            tone="blue"
          />
          <div className="rounded-xl border border-slate-800 bg-[#080f22] p-4 shadow-lg shadow-slate-950/30 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Son 6 Dönem</p>
                <p className="mt-3 text-base font-black text-white">Tahsilat Akışı</p>
                <p className="mt-1 text-xs text-slate-400">Dönem bazlı tahsil edilen kısım</p>
              </div>
              <span className="rounded-xl bg-slate-700/30 p-2 text-slate-300">
                <BarChart3 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 flex h-12 items-end gap-1 border-t border-dashed border-slate-700 pt-2">
              {lastSixPeriods.map((item) => (
                <div key={item.period} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-cyan-400/70"
                    style={{ height: `${Math.max(4, (item.paidAmount / maxLastSixAmount) * 34)}px` }}
                  />
                  <span className="text-[9px] text-slate-500">{item.period.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-800 bg-[#080f22] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                Tahsilat Radarı
              </p>
              <h2 className="text-sm font-black text-white">Günlük operasyona yön veren hızlı akışlar</h2>
            </div>
            <Badge className="border-slate-700 bg-slate-800 text-slate-200">Sorumlu Kayıtlar</Badge>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <RadarCard
              title="Geciken"
              count={radar.overdue.length}
              amount={stats.overdue}
              description="Vadesi geçmiş veya gecikti olarak işaretlenmiş kayıtlar."
              icon={ShieldAlert}
            />
            <RadarCard
              title="Bugün"
              count={radar.today.length}
              amount={sumAmounts(radar.today)}
              description="Bugün vadesi gelen kayıtlar."
              icon={Calendar}
            />
            <RadarCard
              title="7 Gün"
              count={radar.nextSeven.length}
              amount={sumAmounts(radar.nextSeven)}
              description="Önümüzdeki 7 gün içinde vadesi gelecek kayıtlar."
              icon={Clock3}
            />
            <RadarCard
              title="Bekleyen"
              count={radar.pending.length}
              amount={stats.pending}
              description="Takipte olan ancak gecikmemiş kayıtlar."
              icon={AlertTriangle}
            />
            <RadarCard
              title="Ödendi"
              count={radar.paid.length}
              amount={stats.paid}
              description="Tahsilatı tamamlanan kayıtlar."
              icon={CheckCircle2}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#070d1f] p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Label htmlFor="osgb-finance-search" className="sr-only">
                Arama
              </Label>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="osgb-finance-search"
                name="osgb_finance_search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Firma, dönem, fatura no veya not ara"
                className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] pl-10 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <Label htmlFor="osgb-finance-status-filter" className="sr-only">
              Durum filtresi
            </Label>
            <Select name="osgb_finance_status_filter" value={statusFilter} onValueChange={(value) => setStatusFilter(value as OsgbFinanceStatus | "all")}>
              <SelectTrigger id="osgb-finance-status-filter" aria-label="Durum filtresi" className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm durumlar</SelectItem>
                <SelectItem value="pending">Beklemede</SelectItem>
                <SelectItem value="paid">Ödendi</SelectItem>
                <SelectItem value="overdue">Gecikti</SelectItem>
              </SelectContent>
            </Select>
            <Label htmlFor="osgb-finance-company-filter" className="sr-only">
              Firma filtresi
            </Label>
            <Select name="osgb_finance_company_filter" value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger id="osgb-finance-company-filter" aria-label="Firma filtresi" className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-44">
                <SelectValue placeholder="Tüm firmalar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm firmalar</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {getCompanyLabel(company as ManagedCompany)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label htmlFor="osgb-finance-period-filter" className="sr-only">
              Dönem filtresi
            </Label>
            <Select name="osgb_finance_period_filter" value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger id="osgb-finance-period-filter" aria-label="Dönem filtresi" className="h-11 rounded-xl border-slate-700 bg-[#0f1a2f] font-bold text-slate-100 xl:w-40">
                <SelectValue placeholder="Tüm dönemler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm dönemler</SelectItem>
                {periods.map((period) => (
                  <SelectItem key={period} value={period}>
                    {period}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              onClick={resetFilters}
              className="h-11 rounded-xl bg-slate-800 text-slate-100 hover:bg-slate-700"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtreleri Sıfırla
            </Button>
            <Button
              type="button"
              onClick={exportStatement}
              disabled={filteredRecords.length === 0}
              className="h-11 rounded-xl bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Download className="mr-2 h-4 w-4" /> Ekstre İndir
            </Button>
            <Button
              type="button"
              onClick={openCreateDialog}
              className="h-11 rounded-xl bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(255,255,255,.9)] hover:bg-cyan-400"
            >
              <Plus className="mr-2 h-4 w-4" /> Yeni Kayıt
            </Button>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-400">
            {filteredRecords.length} kayıt görünüyor • Filtreli portföy {formatCurrency(filteredTotal)}
          </p>

          {companies.length === 0 && (
            <Alert className="mt-4 border-amber-500/50 bg-amber-500/10 text-amber-100">
              <Building2 className="h-4 w-4" />
              <AlertTitle>Finans kaydı eklemek için önce bir OSGB firması gerekli.</AlertTitle>
              <AlertDescription>Firma listesi oluştuktan sonra bu alan aylık tahsilat masası gibi çalışacak.</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="mt-4 border-rose-500/50 bg-rose-500/10 text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Finans kayıtları yüklenemedi</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#050a18]">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-slate-300">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finans kayıtları yükleniyor...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
              <div className="rounded-2xl bg-slate-800 p-4 text-slate-300">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Henüz finans kaydı eklenmedi</h3>
              <p className="mt-2 max-w-lg text-sm text-slate-400">
                İlk kaydı eklediğinizde üstteki özet, radar ve operasyon listesi anında oluşacak.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-[#070d1f] text-xs font-bold text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Firma</th>
                    <th className="px-4 py-3">Dönem</th>
                    <th className="px-4 py-3 text-right">Tutar</th>
                    <th className="px-4 py-3">Vade</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Not</th>
                    <th className="px-4 py-3 text-right">Hızlı İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const company = companyById.get(record.companyId);
                    const sgkNo = getCompanySgkNo(company);
                    const actionBusy = actionLoadingId === record.id;

                    return (
                      <tr
                        key={record.id}
                        className="border-t border-slate-800 text-slate-200 transition hover:bg-slate-900/60"
                      >
                        <td className="px-4 py-4">
                          <div className="font-black text-white">
                            <Building2 className="mr-2 inline h-4 w-4 text-cyan-300" />
                            {record.companyName || "-"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {sgkNo ? `SGK ${sgkNo}` : `Fatura ${record.invoiceNo || "-"}`}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold">{record.period}</td>
                        <td className="px-4 py-4 text-right font-black text-white">{formatCurrency(record.amount)}</td>
                        <td className="px-4 py-4">
                          <Calendar className="mr-2 inline h-4 w-4 text-slate-400" />
                          {formatDate(record.dueDate)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={cn("rounded-full", statusClasses[record.status])}>
                            {statusLabels[record.status]}
                          </Badge>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-4 text-slate-400">{record.notes || "-"}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={actionBusy || record.status === "paid"}
                              onClick={() =>
                                runRecordAction(
                                  record,
                                  () => markFinancePaid(record.id, organizationId),
                                  "Kayıt ödendi olarak işaretlendi.",
                                )
                              }
                              className="h-7 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-emerald-700"
                            >
                              Ödendi
                            </Button>
                            <Button
                              size="sm"
                              disabled={actionBusy || record.status === "pending"}
                              onClick={() =>
                                runRecordAction(
                                  record,
                                  () => markFinancePending(record.id, organizationId),
                                  "Kayıt beklemede olarak işaretlendi.",
                                )
                              }
                              className="h-7 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-slate-700"
                            >
                              Beklemede
                            </Button>
                            <Button
                              size="sm"
                              disabled={actionBusy || record.status === "overdue"}
                              onClick={() =>
                                runRecordAction(
                                  record,
                                  () => markFinanceOverdue(record.id, organizationId),
                                  "Kayıt gecikti olarak işaretlendi.",
                                )
                              }
                              className="h-7 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-rose-700"
                            >
                              Gecikti
                            </Button>
                            <Button
                              size="sm"
                              disabled={actionBusy || !user?.id}
                              onClick={() =>
                                user?.id &&
                                runRecordAction(
                                  record,
                                  () => duplicateFinanceNextMonth(user.id, organizationId, record),
                                  "Sonraki ay kaydı oluşturuldu.",
                                )
                              }
                              className="h-7 rounded-full bg-cyan-500/15 px-3 text-xs text-cyan-100 hover:bg-cyan-500/25"
                            >
                              <Copy className="mr-1 h-3 w-3" /> Sonraki Ay
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setDetailRecord(record)}
                              className="h-7 rounded-full bg-slate-800 px-3 text-xs text-slate-100 hover:bg-blue-700"
                            >
                              <Eye className="mr-1 h-3 w-3" /> Detay
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setDeleteTarget(record)}
                              className="h-7 rounded-full bg-rose-500/20 px-3 text-xs text-rose-100 hover:bg-rose-700"
                            >
                              <Trash2 className="mr-1 h-3 w-3" /> Sil
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </>
        )}
      </div>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent
          container={dialogPortalContainer}
          overlayClassName="z-[110] bg-slate-950/80 backdrop-blur-sm"
          className="z-[120] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-[22px] border-[#1b2942] bg-[#050a18] p-0 text-slate-100 shadow-2xl shadow-slate-950/60 sm:max-w-[330px] [&>button.absolute]:hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{editingExpenseRecord ? "Sabit gider kaydını düzenle" : "Sabit gider kaydı ekle"}</DialogTitle>
            <DialogDescription>Gider kalemi, dönem, tutar, vade, durum ve not bilgileriyle sabit gider formu.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start justify-between border-b border-[#1b2942] px-4 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-500">Yeni Gider</p>
              <h2 className="mt-2 text-base font-black text-white">
                {editingExpenseRecord ? "Sabit gider kaydını düzenle" : "Sabit gider kaydı ekle"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setExpenseDialogOpen(false)}
              className="rounded-full bg-[#111c2e] p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-10rem)] space-y-4 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="osgb-fixed-expense-item" className="text-xs font-bold text-slate-200">
                <FileText className="mr-2 inline h-3.5 w-3.5" />
                Gider Kalemi
              </Label>
              <Select value={expenseForm.expenseItem || undefined} onValueChange={(value) => setExpenseForm((current) => ({ ...current, expenseItem: value }))}>
                <SelectTrigger id="osgb-fixed-expense-item" className="h-9 rounded-xl border-cyan-400 bg-[#111a2d] px-3 text-sm font-semibold text-slate-100">
                  <SelectValue placeholder="Gider kalemi seçin" />
                </SelectTrigger>
                <SelectContent className="z-[140] rounded-none border border-slate-300 bg-[#111a2d] p-0 text-white shadow-xl">
                  {OSGB_FIXED_EXPENSE_ITEMS.map((item) => (
                    <SelectItem
                      key={item}
                      value={item}
                      className="rounded-none py-2 pl-3 pr-3 text-sm font-semibold text-white focus:bg-blue-600 focus:text-white data-[state=checked]:bg-blue-600 data-[state=checked]:text-white [&>span:first-child]:hidden"
                    >
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="osgb-fixed-expense-period" className="text-xs font-bold text-slate-200">Dönem</Label>
                <Input
                  id="osgb-fixed-expense-period"
                  name="osgb_fixed_expense_period"
                  type="month"
                  value={expenseForm.period}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      period: event.target.value,
                      recurringPeriods: current.recurringPeriods.includes(event.target.value)
                        ? current.recurringPeriods
                        : [event.target.value],
                    }))
                  }
                  className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="osgb-fixed-expense-amount" className="text-xs font-bold text-slate-200">Tutar (₺)</Label>
                <Input
                  id="osgb-fixed-expense-amount"
                  name="osgb_fixed_expense_amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      amount: event.target.value.startsWith("-") ? "" : event.target.value,
                    }))
                  }
                  className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="osgb-fixed-expense-due-date" className="text-xs font-bold text-slate-200">Vade Tarihi</Label>
                <Input
                  id="osgb-fixed-expense-due-date"
                  name="osgb_fixed_expense_due_date"
                  type="date"
                  value={expenseForm.dueDate}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, dueDate: event.target.value }))}
                  className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="osgb-fixed-expense-status" className="text-xs font-bold text-slate-200">Durum</Label>
                <Select value={expenseForm.status} onValueChange={(value) => setExpenseForm((current) => ({ ...current, status: value as OsgbFixedExpenseStatus }))}>
                  <SelectTrigger id="osgb-fixed-expense-status" className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[140] rounded-none border border-slate-300 bg-[#111a2d] p-0 text-white shadow-xl">
                    <SelectItem value="pending">Beklemede</SelectItem>
                    <SelectItem value="paid">Ödendi</SelectItem>
                    <SelectItem value="overdue">Gecikti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-[#30405d] bg-[#111a2d] p-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="osgb-fixed-expense-recurring"
                  checked={expenseForm.isRecurring}
                  disabled={Boolean(editingExpenseRecord)}
                  onCheckedChange={(checked) =>
                    setExpenseForm((current) => ({
                      ...current,
                      isRecurring: checked,
                      recurringPeriods: checked
                        ? Array.from(new Set([current.period, addMonthsToPeriod(current.period, 1), addMonthsToPeriod(current.period, 2)]))
                        : [current.period],
                    }))
                  }
                />
                <Label htmlFor="osgb-fixed-expense-recurring" className="text-xs font-bold text-slate-200">
                  <Copy className="mr-2 inline h-3.5 w-3.5" />
                  Tekrarlayan Gider
                </Label>
              </div>
              {expenseForm.isRecurring && !editingExpenseRecord ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }, (_, index) => addMonthsToPeriod(expenseForm.period, index)).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() =>
                        setExpenseForm((current) => ({
                          ...current,
                          recurringPeriods: current.recurringPeriods.includes(period)
                            ? current.recurringPeriods.filter((item) => item !== period)
                            : [...current.recurringPeriods, period],
                        }))
                      }
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-bold transition",
                        expenseForm.recurringPeriods.includes(period)
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                          : "border-slate-700 bg-[#050a18] text-slate-400 hover:border-slate-500",
                      )}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="osgb-fixed-expense-notes" className="text-xs font-bold text-slate-200">
                <FileText className="mr-2 inline h-3.5 w-3.5" />
                Notlar
              </Label>
              <Textarea
                id="osgb-fixed-expense-notes"
                name="osgb_fixed_expense_notes"
                value={expenseForm.notes}
                onChange={(event) => setExpenseForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Ek notlar..."
                className="min-h-20 resize-none rounded-xl border-[#30405d] bg-[#111a2d] text-sm font-semibold text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 border-t border-[#1b2942] px-4 py-3">
            <Button type="button" variant="secondary" onClick={() => setExpenseDialogOpen(false)} className="rounded-xl bg-[#111a2d] text-white hover:bg-slate-700">
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={expenseSaving || !expenseForm.expenseItem || !expenseForm.period || parseAmount(expenseForm.amount) <= 0}
              onClick={handleSaveExpense}
              className="rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {expenseSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          container={dialogPortalContainer}
          overlayClassName="z-[110] bg-slate-950/80 backdrop-blur-sm"
          className="z-[120] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-[22px] border-[#1b2942] bg-[#050a18] p-0 text-slate-100 shadow-2xl shadow-slate-950/60 sm:max-w-[350px] [&>button.absolute]:hidden"
        >
          {dialogOpen &&
            (() => {
              financeDebugLog("dialog content rendered", {
                companiesCount: companies.length,
                formCompanyId: form.companyId || null,
                formPeriod: form.period,
                formInvoiceNo: form.invoiceNo || null,
              });
              return null;
            })()}
          <DialogHeader className="sr-only">
            <DialogTitle>{editingRecord ? "Finans kaydını düzenle" : "Yeni finans kaydı ekle"}</DialogTitle>
            <DialogDescription>Firma, dönem, tutar, vade, durum ve not bilgileriyle finans kaydı formu.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start justify-between border-b border-[#1b2942] px-4 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-500">Yeni Tahsilat</p>
              <h2 className="mt-2 text-base font-black text-white">
                {editingRecord ? "Finans kaydını düzenle" : "Yeni finans kaydı ekle"}
              </h2>
              <p className="mt-1 max-w-[245px] text-xs font-medium leading-5 text-slate-400">
                Liste görünür kalırken kaydı hemen düzenleyin ve optimistik olarak işleyin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded-full bg-[#111c2e] p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto px-4 py-4">
            {companies.length === 0 && (
              <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-100">
                <Building2 className="h-4 w-4" />
                <AlertTitle>Firma listesi boş</AlertTitle>
                <AlertDescription>
                  Kayıt eklemek için önce OSGB Firmaları ekranından en az bir firma ekleyin.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="osgb-finance-company-id" className="text-xs font-bold text-slate-200">
                <Building2 className="mr-2 inline h-3.5 w-3.5" />
                Firma *
              </Label>
              {companies.length > 0 ? (
              <Select name="osgb_finance_company_id" value={form.companyId || companies[0]?.id} onValueChange={(value) => setForm((current) => ({ ...current, companyId: value }))}>
                <SelectTrigger id="osgb-finance-company-id" aria-label="Firma" className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100">
                  <SelectValue placeholder="Firma seçin" />
                </SelectTrigger>
                <SelectContent className="z-[10000] rounded-none border border-slate-300 bg-[#111a2d] p-0 text-white shadow-2xl">
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {getCompanyLabel(company as ManagedCompany)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              ) : (
                <div id="osgb-finance-company-id" className="flex h-9 items-center rounded-xl border border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-500">
                  Firma seçin
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="osgb-finance-period" className="text-xs font-bold text-slate-200">
                  <Calendar className="mr-2 inline h-3.5 w-3.5" />
                  Dönem
                </Label>
                <Input
                  id="osgb-finance-period"
                  name="osgb_finance_period"
                  type="month"
                  value={form.period}
                  onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
                  className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="osgb-finance-amount" className="text-xs font-bold text-slate-200">
                  <CreditCard className="mr-2 inline h-3.5 w-3.5" />
                  Tutar *
                </Label>
                <Input
                  id="osgb-finance-amount"
                  name="osgb_finance_amount"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="15.000"
                  className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="osgb-finance-due-date" className="text-xs font-bold text-slate-200">Vade Tarihi</Label>
                <Input
                  id="osgb-finance-due-date"
                  name="osgb_finance_due_date"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                  className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="osgb-finance-invoice-no" className="text-xs font-bold text-slate-200">Fatura No</Label>
                <Input
                  id="osgb-finance-invoice-no"
                  name="osgb_finance_invoice_no"
                  value={form.invoiceNo}
                  onChange={(event) => setForm((current) => ({ ...current, invoiceNo: event.target.value }))}
                  placeholder="IST-2026-001"
                  className="h-9 rounded-xl border-[#30405d] bg-[#111a2d] px-3 text-sm font-semibold text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="osgb-finance-status" className="text-xs font-bold text-slate-200">Durum</Label>
              <Select
                name="osgb_finance_status"
                value={form.status}
                onValueChange={(value) => setForm((current) => ({ ...current, status: value as OsgbFinanceStatus }))}
              >
                <SelectTrigger
                  id="osgb-finance-status"
                  aria-label="Durum"
                  className="h-9 rounded-full border-cyan-400 bg-[#111a2d] px-3 text-sm font-semibold text-slate-100 focus:ring-1 focus:ring-cyan-400 focus:ring-offset-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[140] rounded-none border border-slate-300 bg-[#111a2d] p-0 text-white shadow-xl">
                  <SelectItem
                    value="pending"
                    className="rounded-none py-2 pl-3 pr-3 text-sm font-semibold text-white focus:bg-blue-600 focus:text-white data-[state=checked]:bg-blue-600 data-[state=checked]:text-white [&>span:first-child]:hidden"
                  >
                    Beklemede
                  </SelectItem>
                  <SelectItem
                    value="paid"
                    className="rounded-none py-2 pl-3 pr-3 text-sm font-semibold text-white focus:bg-blue-600 focus:text-white data-[state=checked]:bg-blue-600 data-[state=checked]:text-white [&>span:first-child]:hidden"
                  >
                    Ödendi
                  </SelectItem>
                  <SelectItem
                    value="overdue"
                    className="rounded-none py-2 pl-3 pr-3 text-sm font-semibold text-white focus:bg-blue-600 focus:text-white data-[state=checked]:bg-blue-600 data-[state=checked]:text-white [&>span:first-child]:hidden"
                  >
                    Gecikti
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="osgb-finance-notes" className="text-xs font-bold text-slate-200">
                <FileText className="mr-2 inline h-3.5 w-3.5" />
                Notlar
              </Label>
              <Textarea
                id="osgb-finance-notes"
                name="osgb_finance_notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Tahsilat notu, mutabakat bilgisi veya operasyon açıklaması..."
                className="min-h-[100px] resize-none rounded-xl border-[#30405d] bg-[#111a2d] px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[#1b2942] px-4 py-3.5">
            <Button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="h-9 rounded-xl bg-[#111a2d] text-sm font-black text-white hover:bg-slate-700"
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 rounded-xl bg-cyan-500 text-sm font-black text-white hover:bg-cyan-400 disabled:opacity-60"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              {editingRecord ? "Güncelle" : "Kaydı Ekle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailRecord} onOpenChange={(open) => !open && setDetailRecord(null)}>
        <DialogContent className="border-slate-700 bg-[#060b1d] text-slate-100 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{detailRecord?.companyName || "Finans kaydı"}</DialogTitle>
            <DialogDescription className="text-slate-400">Tahsilat kaydı detayı</DialogDescription>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <span className="text-slate-500">Dönem:</span> {formatMonthLabel(detailRecord.period)}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <span className="text-slate-500">Tutar:</span> {formatCurrency(detailRecord.amount)}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <span className="text-slate-500">Vade:</span> {formatDate(detailRecord.dueDate)}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <span className="text-slate-500">Fatura No:</span> {detailRecord.invoiceNo || "-"}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <span className="text-slate-500">Durum:</span> {statusLabels[detailRecord.status]}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <span className="text-slate-500">Not:</span> {detailRecord.notes || "-"}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setDetailRecord(null)}
              className="bg-slate-800 text-white hover:bg-slate-700"
            >
              Kapat
            </Button>
            {detailRecord && (
              <Button
                type="button"
                onClick={() => {
                  const record = detailRecord;
                  setDetailRecord(null);
                  openEditDialog(record);
                }}
                className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Düzenle
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="border-slate-700 bg-[#060b1d] text-slate-100 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Finans kaydı silinsin mi?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Bu tahsilat kaydı silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              İptal
            </Button>
            <Button type="button" onClick={handleDelete} className="bg-rose-600 text-white hover:bg-rose-500">
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!expenseDeleteTarget} onOpenChange={(open) => !open && setExpenseDeleteTarget(null)}>
        <DialogContent className="border-slate-700 bg-[#060b1d] text-slate-100 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Sabit gider kaydı silinsin mi?</DialogTitle>
            <DialogDescription className="text-slate-400">
              {expenseDeleteTarget?.expenseItem || "Bu gider"} kaydı silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setExpenseDeleteTarget(null)}
              className="border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              İptal
            </Button>
            <Button type="button" onClick={handleDeleteExpense} className="bg-rose-600 text-white hover:bg-rose-500">
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
