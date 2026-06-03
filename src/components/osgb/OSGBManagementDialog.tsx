import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Archive,
  BarChart3,
  Building2,
  Expand,
  FileCheck,
  KeyRound,
  Link,
  Loader2,
  MapPin,
  RefreshCcw,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getOsgbPlatformDashboard,
  listOsgbFinanceWorkspace,
  listOsgbRequiredDocumentsWorkspace,
} from "@/lib/osgbPlatform";
import { OSGBCompaniesPanel } from "@/components/osgb/OSGBCompaniesPanel";
import { OSGBCompanyEmployeesPanel } from "@/components/osgb/OSGBCompanyEmployeesPanel";

const OSGBPersonnel = lazy(() => import("@/pages/OSGBPersonnel"));
const OSGBCompanyTracking = lazy(() => import("@/pages/OSGBCompanyTracking"));
const OSGBFinance = lazy(() => import("@/pages/Finance"));
const OSGBAssignments = lazy(() => import("@/pages/OSGBAssignments"));
const OsgbClientPortal = lazy(() => import("@/pages/OsgbClientPortal"));
const OSGBFieldVisits = lazy(() => import("@/pages/FieldVisits"));
const SafetyLibrary = lazy(() => import("@/pages/SafetyLibrary"));
const OsgbKatipSyncCenter = lazy(() => import("@/pages/OsgbKatipSyncCenter"));

interface OSGBManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OsgbManagementTab =
  | "dashboard"
  | "personnel"
  | "companies"
  | "employees"
  | "tracking"
  | "finance"
  | "assignments"
  | "authorization"
  | "visits"
  | "archive"
  | "katip";

const tabs: Array<{
  id: OsgbManagementTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "personnel", label: "Personel Havuzu", icon: Users },
  { id: "companies", label: "OSGB Firmaları", icon: Building2 },
  { id: "employees", label: "Firma Çalışanları", icon: UserRound },
  { id: "tracking", label: "Firma Takip", icon: ShieldCheck },
  { id: "finance", label: "Finans", icon: Wallet },
  { id: "assignments", label: "Personel Görevlendirme", icon: UserPlus },
  { id: "authorization", label: "Firma Yetkilendir", icon: KeyRound },
  { id: "visits", label: "Firma Ziyaretleri", icon: MapPin },
  { id: "archive", label: "Arşiv", icon: Archive },
  { id: "katip", label: "İSG-KATİP Senkronize", icon: Link },
];

const formatNumber = (value: number) => new Intl.NumberFormat("tr-TR").format(Math.round(value || 0));
const formatCurrency = (value: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value || 0);

function LoadingTab() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-2xl border border-slate-800 bg-slate-950/50">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
        Panel yükleniyor...
      </div>
    </div>
  );
}

function EmptyDashboard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function SummaryCard({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  rows: Array<{ label: string; value: string | number; tone?: "emerald" | "amber" | "rose" | "cyan" | "slate" }>;
}) {
  const toneClasses = {
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    cyan: "text-cyan-300",
    slate: "text-slate-100",
  } as const;

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-lg shadow-black/20">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-black text-white">{title}</h3>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <span className="text-xs font-semibold text-slate-400">{row.label}</span>
            <span className={cn("text-sm font-black", toneClasses[row.tone || "slate"])}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OSGBDialogDashboard({ refreshKey }: { refreshKey: number }) {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof getOsgbPlatformDashboard>> | null>(null);
  const [finance, setFinance] = useState<Awaited<ReturnType<typeof listOsgbFinanceWorkspace>> | null>(null);
  const [documents, setDocuments] = useState<Awaited<ReturnType<typeof listOsgbRequiredDocumentsWorkspace>> | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setDashboard(null);
      setFinance(null);
      setDocuments(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [dashboardData, financeData, documentData] = await Promise.all([
        getOsgbPlatformDashboard(organizationId, { refreshCompliance: false }),
        user?.id ? listOsgbFinanceWorkspace(organizationId, user.id) : Promise.resolve(null),
        user?.id ? listOsgbRequiredDocumentsWorkspace(organizationId, user.id) : Promise.resolve(null),
      ]);
      setDashboard(dashboardData);
      setFinance(financeData);
      setDocuments(documentData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OSGB raporları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const personnelTotalCapacity = useMemo(
    () => dashboard?.personnelLoads.reduce((sum, item) => sum + item.monthlyCapacityMinutes, 0) ?? 0,
    [dashboard?.personnelLoads],
  );
  const personnelAssigned = useMemo(
    () => dashboard?.personnelLoads.reduce((sum, item) => sum + item.assignedMinutes, 0) ?? 0,
    [dashboard?.personnelLoads],
  );
  const personnelUtilization = personnelTotalCapacity > 0 ? Math.round((personnelAssigned / personnelTotalCapacity) * 100) : 0;

  if (!organizationId) {
    return <EmptyDashboard message="OSGB raporları için önce bir organizasyon çalışma alanına bağlanın." />;
  }

  if (loading) return <LoadingTab />;
  if (error) return <EmptyDashboard message={error} />;

  const paidAmount = finance?.entries.filter((entry) => entry.status === "paid").reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const totalFinance = finance?.entries.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const pendingFinance = finance?.entries.filter((entry) => entry.status !== "paid").reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const activeDocuments = documents?.documents.filter((document) => document.status === "approved" || document.status === "submitted").length ?? 0;
  const missingDocuments = documents?.overview.missing ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">OSGB Raporları</h2>
          <p className="mt-1 text-sm text-slate-400">Tüm OSGB firmalarının özet ve analiz raporları</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-800 hover:text-white">
            Firma Analizi
          </Button>
          <Button type="button" variant="outline" className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-800 hover:text-white">
            Personel Raporu
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Firmalar"
          icon={Building2}
          rows={[
            { label: "Toplam", value: formatNumber(dashboard?.summary.totalCompanies ?? 0), tone: "cyan" },
            { label: "Devam Eden Sözleşmeler", value: formatNumber(dashboard?.summary.activeContracts ?? 0), tone: "emerald" },
            { label: "Eksik Atama", value: formatNumber(dashboard?.summary.companiesWithGap ?? 0), tone: "rose" },
          ]}
        />
        <SummaryCard
          title="Personel"
          icon={Users}
          rows={[
            { label: "Toplam Kapasite", value: `${formatNumber(personnelTotalCapacity)} dk`, tone: "cyan" },
            { label: "Genel Doluluk", value: `%${personnelUtilization}`, tone: personnelUtilization > 90 ? "rose" : "emerald" },
            { label: "Aktif Atama", value: formatNumber(dashboard?.personnelLoads.reduce((sum, item) => sum + item.activeCompanyCount, 0) ?? 0), tone: "amber" },
          ]}
        />
        <SummaryCard
          title="Evraklar"
          icon={FileCheck}
          rows={[
            { label: "Toplam", value: formatNumber(documents?.overview.total ?? 0), tone: "cyan" },
            { label: "Aktif", value: formatNumber(activeDocuments), tone: "emerald" },
            { label: "Eksik/Süresi Dolmuş", value: formatNumber(missingDocuments + (documents?.overview.overdue ?? 0)), tone: "rose" },
          ]}
        />
        <SummaryCard
          title="Finans"
          icon={Wallet}
          rows={[
            { label: "Toplam", value: formatCurrency(totalFinance), tone: "cyan" },
            { label: "Ödenen", value: formatCurrency(paidAmount), tone: "emerald" },
            { label: "Bekleyen", value: formatCurrency(pendingFinance), tone: pendingFinance > 0 ? "amber" : "slate" },
          ]}
        />
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
        <h3 className="text-lg font-black text-white">Personel Kapasite Durumu (Genel)</h3>
        <div className="mt-4 space-y-3">
          {dashboard?.personnelLoads.length ? (
            dashboard.personnelLoads.map((person) => {
              const utilization = person.monthlyCapacityMinutes > 0 ? Math.round((person.assignedMinutes / person.monthlyCapacityMinutes) * 100) : 0;
              return (
                <div key={person.personnelId} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{person.fullName}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{person.role} · {person.activeCompanyCount} aktif firma</p>
                    </div>
                    <div className={cn("text-sm font-black", person.overloaded ? "text-rose-300" : "text-emerald-300")}>%{utilization}</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className={cn("h-full rounded-full", person.overloaded ? "bg-rose-400" : "bg-emerald-400")} style={{ width: `${Math.min(100, utilization)}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{formatNumber(person.assignedMinutes)} / {formatNumber(person.monthlyCapacityMinutes)} dk · Kalan {formatNumber(person.remainingMinutes)} dk</p>
                </div>
              );
            })
          ) : (
            <EmptyDashboard message="Personel bulunamadı." />
          )}
        </div>
      </div>
    </div>
  );
}

function renderTab(tab: OsgbManagementTab, refreshKey: number) {
  switch (tab) {
    case "dashboard":
      return <OSGBDialogDashboard refreshKey={refreshKey} />;
    case "personnel":
      return <OSGBPersonnel />;
    case "companies":
      return <OSGBCompaniesPanel refreshKey={refreshKey} />;
    case "employees":
      return <OSGBCompanyEmployeesPanel refreshKey={refreshKey} />;
    case "tracking":
      return <OSGBCompanyTracking />;
    case "finance":
      return <OSGBFinance />;
    case "assignments":
      return <OSGBAssignments />;
    case "authorization":
      return <OsgbClientPortal />;
    case "visits":
      return <OSGBFieldVisits />;
    case "archive":
      return <SafetyLibrary />;
    case "katip":
      return <OsgbKatipSyncCenter />;
    default:
      return <OSGBDialogDashboard refreshKey={refreshKey} />;
  }
}

export function OSGBManagementDialog({ open, onOpenChange }: OSGBManagementDialogProps) {
  const [activeTab, setActiveTab] = useState<OsgbManagementTab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[80] bg-slate-950/85 backdrop-blur-sm"
        className="z-[90] flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border border-slate-700/60 bg-slate-950 p-0 text-slate-50 shadow-2xl shadow-black/70 sm:h-[90vh] sm:max-h-[90vh] sm:w-[96vw] sm:max-w-[1800px] sm:rounded-2xl [&>button.absolute]:hidden"
      >
        <DialogTitle className="sr-only">OSGB Yönetim Paneli</DialogTitle>
        <DialogDescription className="sr-only">OSGB operasyonlarını tablarla yöneten büyük panel dialogu.</DialogDescription>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
              <BriefcaseIcon />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-white">OSGB Yönetim Paneli</h2>
              <p className="hidden text-xs text-slate-400 sm:block">Dashboard, firma, personel, finans ve İSG-KATİP operasyonları</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white" onClick={() => setRefreshKey((value) => value + 1)}>
              <RefreshCcw className="h-4 w-4" />
              <span className="sr-only">Yenile</span>
            </Button>
            <Button type="button" variant="outline" size="icon" className="hidden h-9 w-9 border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white sm:inline-flex">
              <Expand className="h-4 w-4" />
              <span className="sr-only">Tam ekran</span>
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white">
                <X className="h-4 w-4" />
                <span className="sr-only">Kapat</span>
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="shrink-0 overflow-x-auto border-b border-slate-800 bg-slate-950 px-3 py-3">
          <div className="flex min-w-max gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition",
                    active
                      ? "border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-950 p-4 sm:p-5">
          <div className="min-w-0 overflow-x-auto">
            <Suspense fallback={<LoadingTab />}>{renderTab(activeTab, refreshKey)}</Suspense>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BriefcaseIcon() {
  return <BarChart3 className="h-5 w-5" />;
}
