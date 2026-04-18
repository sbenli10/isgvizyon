import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, LineChart as LineChartIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  getOsgbPlatformDashboard,
  listOsgbFinanceWorkspace,
  listOsgbRequiredDocumentsWorkspace,
  type OsgbFinancialEntryRecord,
  type OsgbPlatformDashboardData,
  type OsgbRequiredDocumentRecord,
} from "@/lib/osgbPlatform";

type ViewMode = "finance" | "documents";

export default function OSGBAnalytics() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dashboard, setDashboard] = useState<OsgbPlatformDashboardData | null>(null);
  const [financeRecords, setFinanceRecords] = useState<OsgbFinancialEntryRecord[]>([]);
  const [documentRecords, setDocumentRecords] = useState<OsgbRequiredDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const value = new Date();
    value.setMonth(value.getMonth() - 5);
    return value.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const organizationId = profile?.organization_id || null;

  const view = useMemo<ViewMode>(() => {
    const requested = searchParams.get("view");
    return requested === "documents" ? "documents" : "finance";
  }, [searchParams]);

  useEffect(() => {
    if (!organizationId || !user?.id) {
      setDashboard(null);
      setFinanceRecords([]);
      setDocumentRecords([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [dashboardData, financeData, documentsData] = await Promise.all([
          getOsgbPlatformDashboard(organizationId, { refreshCompliance: true }),
          listOsgbFinanceWorkspace(organizationId, user.id),
          listOsgbRequiredDocumentsWorkspace(organizationId, user.id),
        ]);

        setDashboard(dashboardData);
        setFinanceRecords(financeData.entries);
        setDocumentRecords(documentsData.documents);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Trend analizi yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [organizationId, user?.id]);

  const financeTrend = useMemo(() => {
    const fallback = dashboard?.complianceRows.map((row) => ({
      month: new Date().toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
      pendingAmount: Math.max(0, row.currentBalance),
      paidAmount: Math.max(0, row.estimatedMonthlyMargin),
      overdueAmount: Math.max(0, row.overdueBalance),
    })) ?? [];

    if (!startDate || !endDate) return fallback;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const monthMap = new Map<string, { month: string; pendingAmount: number; paidAmount: number; overdueAmount: number }>();

    for (const record of financeRecords) {
      const reference = record.dueDate || record.entryDate;
      if (!reference) continue;

      const date = new Date(reference);
      if (Number.isNaN(date.getTime()) || date < start || date > end) continue;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      if (!monthMap.has(key)) {
        monthMap.set(key, { month: label, pendingAmount: 0, paidAmount: 0, overdueAmount: 0 });
      }

      const row = monthMap.get(key)!;
      if (record.status === "open") row.pendingAmount += record.amount;
      if (record.status === "paid") row.paidAmount += record.amount;
      if (record.status === "overdue") row.overdueAmount += record.amount;
    }

    return Array.from(monthMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }, [dashboard?.complianceRows, endDate, financeRecords, startDate]);

  const documentTrend = useMemo(() => {
    if (!startDate || !endDate) {
      return [];
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const monthMap = new Map<string, { month: string; activeCount: number; warningCount: number; expiredCount: number }>();

    for (const record of documentRecords) {
      const reference = record.dueDate;
      if (!reference) continue;

      const date = new Date(reference);
      if (Number.isNaN(date.getTime()) || date < start || date > end) continue;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      if (!monthMap.has(key)) {
        monthMap.set(key, { month: label, activeCount: 0, warningCount: 0, expiredCount: 0 });
      }

      const row = monthMap.get(key)!;
      if (record.status === "approved") row.activeCount += 1;
      if (record.status === "submitted") row.warningCount += 1;
      if (record.status === "missing") {
        if (record.delayDays > 0) row.expiredCount += 1;
        else row.warningCount += 1;
      }
    }

    return Array.from(monthMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }, [documentRecords, endDate, startDate]);

  const hasManagedCompanies = (dashboard?.summary.totalCompanies || 0) > 0;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">OSGB Trend Analizi</h1>
          <p className="text-sm text-muted-foreground">Yalnızca OSGB havuzuna alınmış firmaların finans ve evrak trendlerini görüntüleyin.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/osgb/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard'a dön
          </Button>
          <Button variant={view === "finance" ? "default" : "outline"} onClick={() => navigate("/osgb/analytics?view=finance")}>
            <LineChartIcon className="mr-2 h-4 w-4" />
            Finans
          </Button>
          <Button variant={view === "documents" ? "default" : "outline"} onClick={() => navigate("/osgb/analytics?view=documents")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Evrak
          </Button>
        </div>
      </div>

      {!organizationId ? (
        <Alert>
          <AlertTitle>Organizasyon bulunamadı</AlertTitle>
          <AlertDescription>Trend analizi için önce bir OSGB organizasyonuna bağlı olmanız gerekir.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tarih aralığı</CardTitle>
          <CardDescription>Grafikler seçilen tarih aralığındaki managed firmalara göre yeniden hesaplanır.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Başlangıç</div>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Bitiş</div>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                const value = new Date();
                value.setMonth(value.getMonth() - 5);
                setStartDate(value.toISOString().slice(0, 10));
                setEndDate(new Date().toISOString().slice(0, 10));
              }}
            >
              Son 6 ay
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Trend analizi yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      ) : !organizationId || !hasManagedCompanies ? (
        <Card>
          <CardHeader>
            <CardTitle>Henüz yönetilen firma yok</CardTitle>
            <CardDescription>Trend analizi yalnızca OSGB Firma Takibi ekranında havuza alınmış firmalarla çalışır.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/osgb/company-tracking")}>Firma havuzunu aç</Button>
          </CardContent>
        </Card>
      ) : view === "finance" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Finans trend analizi</CardTitle>
              <CardDescription>Managed firmalarda bekleyen, ödenen ve geciken tahsilat akışı.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={financeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                  <XAxis dataKey="month" stroke="currentColor" />
                  <YAxis stroke="currentColor" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                  <Line type="monotone" dataKey="pendingAmount" name="Bekleyen" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="paidAmount" name="Ödendi" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="overdueAmount" name="Geciken" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Evrak trend analizi</CardTitle>
              <CardDescription>Managed firmalardaki onaylı, bekleyen ve geciken evrak dağılımı.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={documentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                  <XAxis dataKey="month" stroke="currentColor" />
                  <YAxis stroke="currentColor" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                  <Bar dataKey="activeCount" name="Onaylı" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="warningCount" name="Bekleyen" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expiredCount" name="Geciken" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
