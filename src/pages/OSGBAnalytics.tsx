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
  getOsgbOperationalSummary,
  listOsgbDocuments,
  listOsgbFinance,
  type OsgbDocumentRecord,
  type OsgbFinanceRecord,
  type OsgbOperationalSummary,
} from "@/lib/osgbOperations";

type ViewMode = "finance" | "documents";

export default function OSGBAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<OsgbOperationalSummary | null>(null);
  const [financeRecords, setFinanceRecords] = useState<OsgbFinanceRecord[]>([]);
  const [documentRecords, setDocumentRecords] = useState<OsgbDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const value = new Date();
    value.setMonth(value.getMonth() - 5);
    return value.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const view = useMemo<ViewMode>(() => {
    const requested = searchParams.get("view");
    return requested === "documents" ? "documents" : "finance";
  }, [searchParams]);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);
      try {
        const [result, financeRows, documentRows] = await Promise.all([
          getOsgbOperationalSummary(user.id),
          listOsgbFinance(user.id),
          listOsgbDocuments(user.id),
        ]);
        setSummary(result);
        setFinanceRecords(financeRows);
        setDocumentRecords(documentRows);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Trend analizi yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user?.id]);

  const financeTrend = useMemo(() => {
    if (!startDate || !endDate) return summary?.finance.monthlyTrend ?? [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const monthMap = new Map<string, { month: string; pendingAmount: number; paidAmount: number; overdueAmount: number }>();

    for (const record of financeRecords) {
      const reference = record.due_date || record.invoice_date;
      if (!reference) continue;
      const date = new Date(reference);
      if (Number.isNaN(date.getTime()) || date < start || date > end) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      if (!monthMap.has(key)) {
        monthMap.set(key, { month: label, pendingAmount: 0, paidAmount: 0, overdueAmount: 0 });
      }
      const row = monthMap.get(key)!;
      if (record.status === "pending") row.pendingAmount += record.amount;
      if (record.status === "paid") row.paidAmount += record.amount;
      if (record.status === "overdue") row.overdueAmount += record.amount;
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [endDate, financeRecords, startDate, summary?.finance.monthlyTrend]);

  const documentTrend = useMemo(() => {
    if (!startDate || !endDate) return summary?.documents.monthlyTrend ?? [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const monthMap = new Map<string, { month: string; activeCount: number; warningCount: number; expiredCount: number }>();

    for (const record of documentRecords) {
      const reference = record.expiry_date || record.created_at;
      if (!reference) continue;
      const date = new Date(reference);
      if (Number.isNaN(date.getTime()) || date < start || date > end) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
      if (!monthMap.has(key)) {
        monthMap.set(key, { month: label, activeCount: 0, warningCount: 0, expiredCount: 0 });
      }
      const row = monthMap.get(key)!;
      if (record.status === "active") row.activeCount += 1;
      if (record.status === "warning") row.warningCount += 1;
      if (record.status === "expired") row.expiredCount += 1;
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [documentRecords, endDate, startDate, summary?.documents.monthlyTrend]);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">OSGB Trend Analizi</h1>
          <p className="text-sm text-slate-400">Finans ve evrak trendlerini ayrı grafik ekranlarında detaylı inceleyin.</p>
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

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Tarih aralığı</CardTitle>
          <CardDescription>Grafikleri seçilen tarih aralığına göre yeniden hesaplar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <div className="text-sm text-slate-300">Başlangıç</div>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-300">Bitiş</div>
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
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTitle>Trend analizi yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading || !summary ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-[420px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
          <div className="h-[420px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        </div>
      ) : view === "finance" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-800 bg-slate-900/70 xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-white">Finans trend analizi</CardTitle>
              <CardDescription>Son 6 ayın bekleyen, ödenen ve geciken tahsilat hacmi.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={financeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }} />
                  <Line type="monotone" dataKey="pendingAmount" name="Bekleyen" stroke="#facc15" strokeWidth={2} />
                  <Line type="monotone" dataKey="paidAmount" name="Ödendi" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="overdueAmount" name="Geciken" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-800 bg-slate-900/70 xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-white">Evrak trend analizi</CardTitle>
              <CardDescription>Son 6 ayın aktif, yaklaşan ve süresi dolmuş evrak dağılımı.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={documentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }} />
                  <Bar dataKey="activeCount" name="Aktif" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="warningCount" name="Yaklaşan" fill="#facc15" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expiredCount" name="Süresi dolmuş" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
