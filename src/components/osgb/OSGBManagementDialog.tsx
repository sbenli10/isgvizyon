import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Archive,
  BarChart3,
  Building2,
  CheckCircle2,
  Download,
  Expand,
  FileCheck,
  FileText,
  Inbox,
  KeyRound,
  Link,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getOsgbClientPortalUploadSignedUrl,
  listOsgbClientPortalUploads,
  reviewOsgbClientPortalUpload,
  type OsgbClientPortalUploadRecord,
} from "@/lib/osgbOrchestration";
import {
  getOsgbPlatformDashboard,
  listOsgbRequiredDocumentsWorkspace,
} from "@/lib/osgbPlatform";
import { listOsgbFinanceRecords, type OsgbFinanceRecord } from "@/lib/osgbFinance";
import { OSGBCompaniesPanel } from "@/components/osgb/OSGBCompaniesPanel";
import { OSGBCompanyEmployeesPanel } from "@/components/osgb/OSGBCompanyEmployeesPanel";
import { OSGBArchivePanel } from "@/components/osgb/OSGBArchivePanel";
import { OSGBCompanyAuthorizationPanel } from "@/components/osgb/OSGBCompanyAuthorizationPanel";

const OSGBPersonnel = lazy(() => import("@/pages/OSGBPersonnel"));
const OSGBCompanyTracking = lazy(() => import("@/pages/OSGBCompanyTracking"));
const OSGBFinance = lazy(() => import("@/pages/OSGBFinance"));
const OSGBAssignments = lazy(() => import("@/pages/OSGBAssignments"));
const OSGBFieldVisits = lazy(() => import("@/pages/FieldVisits"));
const OsgbKatipSyncCenter = lazy(() => import("@/pages/OsgbKatipSyncCenter"));

interface OSGBManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: OsgbManagementTab;
}

export type OsgbManagementTab =
  | "dashboard"
  | "personnel"
  | "companies"
  | "employees"
  | "tracking"
  | "finance"
  | "assignments"
  | "authorization"
  | "visits"
  | "portalUploads"
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
  { id: "portalUploads", label: "Müşteri Gönderimleri", icon: Inbox },
  { id: "archive", label: "Arşiv", icon: Archive },
  { id: "katip", label: "İSG-KATİP Senkronize", icon: Link },
];

const formatNumber = (value: number) => new Intl.NumberFormat("tr-TR").format(Math.round(value || 0));
const formatCurrency = (value: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value || 0);
const formatBytes = (value: number) => {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};
const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
  const [finance, setFinance] = useState<OsgbFinanceRecord[]>([]);
  const [documents, setDocuments] = useState<Awaited<ReturnType<typeof listOsgbRequiredDocumentsWorkspace>> | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setDashboard(null);
      setFinance([]);
      setDocuments(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [dashboardData, financeData, documentData] = await Promise.all([
        getOsgbPlatformDashboard(organizationId, { refreshCompliance: false }),
        listOsgbFinanceRecords(organizationId),
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

  const paidAmount = finance.filter((entry) => entry.status === "paid").reduce((sum, entry) => sum + entry.amount, 0);
  const totalFinance = finance.reduce((sum, entry) => sum + entry.amount, 0);
  const pendingFinance = finance.filter((entry) => entry.status !== "paid").reduce((sum, entry) => sum + entry.amount, 0);
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

type PortalUploadFilter = "all" | "pending" | "approved" | "rejected";

const portalUploadStatusLabels: Record<OsgbClientPortalUploadRecord["reviewStatus"], string> = {
  pending: "İncelemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const portalUploadStatusClasses: Record<OsgbClientPortalUploadRecord["reviewStatus"], string> = {
  pending: "border-amber-400/25 bg-amber-500/15 text-amber-100",
  approved: "border-emerald-400/25 bg-emerald-500/15 text-emerald-100",
  rejected: "border-rose-400/25 bg-rose-500/15 text-rose-100",
};

function OSGBPortalUploadsPanel({ refreshKey }: { refreshKey: number }) {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [uploads, setUploads] = useState<OsgbClientPortalUploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PortalUploadFilter>("all");
  const [search, setSearch] = useState("");

  const loadUploads = useCallback(async () => {
    if (!organizationId) {
      setUploads([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await listOsgbClientPortalUploads(organizationId);
      setUploads(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Müşteri gönderimleri yüklenemedi.");
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadUploads();
  }, [loadUploads, refreshKey]);

  const filteredUploads = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");
    return uploads.filter((upload) => {
      const matchesStatus = statusFilter === "all" || upload.reviewStatus === statusFilter;
      const matchesSearch = !normalizedSearch || [
        upload.fileName,
        upload.companyName,
        upload.documentType,
        upload.submittedByName,
        upload.submittedByEmail,
        upload.note,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase("tr-TR").includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, uploads]);

  const groupedUploads = useMemo(() => {
    const groups = new Map<string, OsgbClientPortalUploadRecord[]>();
    filteredUploads.forEach((upload) => {
      const key = upload.companyName || "Firma";
      groups.set(key, [...(groups.get(key) || []), upload]);
    });
    return Array.from(groups.entries());
  }, [filteredUploads]);

  const pendingCount = uploads.filter((upload) => upload.reviewStatus === "pending").length;
  const approvedCount = uploads.filter((upload) => upload.reviewStatus === "approved").length;
  const rejectedCount = uploads.filter((upload) => upload.reviewStatus === "rejected").length;

  const handleDownload = async (upload: OsgbClientPortalUploadRecord) => {
    try {
      const signedUrl = await getOsgbClientPortalUploadSignedUrl(upload.filePath);
      if (!signedUrl) throw new Error("Dosya bağlantısı oluşturulamadı.");
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya açılamadı.");
    }
  };

  const handleReview = async (uploadId: string, status: "approved" | "rejected") => {
    if (!organizationId || !user?.id) return;
    setReviewingId(uploadId);
    try {
      await reviewOsgbClientPortalUpload(organizationId, user.id, uploadId, status);
      await loadUploads();
      toast.success(status === "approved" ? "Müşteri dosyası onaylandı." : "Müşteri dosyası reddedildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya durumu güncellenemedi.");
    } finally {
      setReviewingId(null);
    }
  };

  if (!organizationId) {
    return <EmptyDashboard message="Müşteri gönderimlerini görmek için önce OSGB organizasyon çalışma alanınız olmalı." />;
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%),linear-gradient(135deg,#111827,#10172a_60%,#09111f)] shadow-2xl shadow-black/25">
        <div className="flex flex-col gap-4 border-b border-slate-700/70 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-500/12 text-cyan-100">
              <Inbox className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Müşteri Portalı</p>
              <h2 className="mt-1 text-2xl font-black text-white">Müşteri Gönderimleri</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                Firma portalından yüklenen dosyaları firma bazında inceleyin, indirin, onaylayın veya reddedin.
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => void loadUploads()} disabled={loading} className="bg-cyan-600 text-white hover:bg-cyan-500">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Gönderimleri Yenile
          </Button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Toplam Dosya</p>
            <p className="mt-2 text-3xl font-black text-white">{uploads.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-200">İncelemede</p>
            <p className="mt-2 text-3xl font-black text-amber-100">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">Onaylanan</p>
            <p className="mt-2 text-3xl font-black text-emerald-100">{approvedCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-200">Reddedilen</p>
            <p className="mt-2 text-3xl font-black text-rose-100">{rejectedCount}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Firma, dosya adı, gönderen veya not ara..."
              className="border-slate-700 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "Tümü"],
              ["pending", "İncelemede"],
              ["approved", "Onaylanan"],
              ["rejected", "Reddedilen"],
            ] as Array<[PortalUploadFilter, string]>).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "border-slate-700 bg-slate-950/50 text-slate-300 hover:bg-slate-800 hover:text-white",
                  statusFilter === value && "border-cyan-400 bg-cyan-500/15 text-cyan-100",
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-5 text-sm text-rose-100">{error}</div>
      ) : null}

      {loading ? (
        <LoadingTab />
      ) : groupedUploads.length ? (
        <div className="space-y-4">
          {groupedUploads.map(([companyName, companyUploads]) => (
            <section key={companyName} className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70">
              <div className="flex flex-col gap-2 border-b border-slate-700/70 bg-slate-950/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{companyName}</h3>
                    <p className="text-xs text-slate-400">{companyUploads.length} gönderim</p>
                  </div>
                </div>
                <Badge className="w-fit border border-amber-400/20 bg-amber-500/10 text-amber-100">
                  {companyUploads.filter((upload) => upload.reviewStatus === "pending").length} incelemede
                </Badge>
              </div>
              <div className="divide-y divide-slate-800">
                {companyUploads.map((upload) => (
                  <article key={upload.id} className="grid gap-4 px-5 py-4 xl:grid-cols-[1fr_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="break-words text-base font-black text-white">{upload.fileName}</h4>
                        <Badge className={cn("border", portalUploadStatusClasses[upload.reviewStatus])}>
                          {portalUploadStatusLabels[upload.reviewStatus]}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>{upload.documentType || "Genel dosya"}</span>
                        <span>{formatBytes(upload.fileSize)}</span>
                        <span>{formatDateTime(upload.createdAt)}</span>
                        {upload.submittedByName || upload.submittedByEmail ? (
                          <span>{upload.submittedByName || "İsim yok"}{upload.submittedByEmail ? ` • ${upload.submittedByEmail}` : ""}</span>
                        ) : null}
                      </div>
                      {upload.note ? <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm leading-6 text-slate-300">{upload.note}</p> : null}
                      {upload.reviewNote ? <p className="mt-2 text-xs text-slate-500">İnceleme notu: {upload.reviewNote}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Button size="sm" variant="outline" onClick={() => void handleDownload(upload)} className="border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20">
                        <Download className="mr-2 h-4 w-4" />
                        Dosyayı Aç
                      </Button>
                      {upload.reviewStatus === "pending" ? (
                        <>
                          <Button size="sm" onClick={() => void handleReview(upload.id, "approved")} disabled={reviewingId === upload.id} className="bg-emerald-600 hover:bg-emerald-500">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Onayla
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleReview(upload.id, "rejected")} disabled={reviewingId === upload.id} className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                            <XCircle className="mr-2 h-4 w-4" />
                            Reddet
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
          <Inbox className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-lg font-black text-white">Müşteri gönderimi bulunamadı</p>
          <p className="mt-1 text-sm text-slate-400">Portal üzerinden dosya yüklendiğinde burada firma bazında listelenecek.</p>
        </div>
      )}
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
      return <OSGBCompanyAuthorizationPanel refreshKey={refreshKey} />;
    case "visits":
      return <OSGBFieldVisits />;
    case "portalUploads":
      return <OSGBPortalUploadsPanel refreshKey={refreshKey} />;
    case "archive":
      return <OSGBArchivePanel refreshKey={refreshKey} />;
    case "katip":
      return <OsgbKatipSyncCenter />;
    default:
      return <OSGBDialogDashboard refreshKey={refreshKey} />;
  }
}

export function OSGBManagementDialog({ open, onOpenChange, initialTab }: OSGBManagementDialogProps) {
  const [activeTab, setActiveTab] = useState<OsgbManagementTab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);

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
