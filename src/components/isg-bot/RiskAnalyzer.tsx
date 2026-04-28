import { useEffect, useState } from "react";
import { format, addMonths } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  Target,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  listIsgkatipCompanies,
  listIsgkatipPredictiveAlerts,
} from "@/domain/isgkatip/isgkatipQueries";
import { getIsgkatipOrgScope } from "@/domain/isgkatip/isgkatipOrgScope";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Company {
  id: string;
  company_name: string;
  sgk_no: string;
  employee_count: number;
  hazard_class: string;
  assigned_minutes: number;
  required_minutes: number;
  compliance_status: string;
  risk_score: number;
  contract_end: string | null;
}

interface PredictiveAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  predicted_date: string | null;
  confidence_score: number;
  details: Record<string, unknown> | null;
}

interface RiskTrend {
  month: string;
  avgRiskScore: number;
  criticalCount: number;
  complianceRate: number;
}

interface CapacityProjection {
  month: string;
  currentCapacity: number;
  projectedDemand: number;
  gap: number;
}

export default function RiskAnalyzer() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [predictiveAlerts, setPredictiveAlerts] = useState<PredictiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningPrediction, setRunningPrediction] = useState(false);
  const [timeframe, setTimeframe] = useState<number>(3);
  const [riskTrends, setRiskTrends] = useState<RiskTrend[]>([]);
  const [capacityProjections, setCapacityProjections] = useState<CapacityProjection[]>([]);

  useEffect(() => {
    void loadRiskAnalysis();
  }, [timeframe]);

  const loadRiskAnalysis = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Kullanıcı oturumu bulunamadı.");
      }

      const companiesData = await listIsgkatipCompanies({
        userId: user.id,
        select: "*",
      });

      const alertsData = await listIsgkatipPredictiveAlerts({
        userId: user.id,
        select: "*",
        status: "ACTIVE",
        orderBy: "created_at",
      });

      setCompanies((companiesData ?? []) as Company[]);
      setPredictiveAlerts((alertsData ?? []) as PredictiveAlert[]);
      generateRiskTrends((companiesData ?? []) as Company[]);
      generateCapacityProjections((companiesData ?? []) as Company[]);
    } catch (error) {
      console.error("Risk analysis load error:", error);
      toast.error("Risk analizi yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const generateRiskTrends = (companiesData: Company[]) => {
    if (companiesData.length === 0) {
      setRiskTrends([]);
      return;
    }

    const trends: RiskTrend[] = [];
    const avgRiskBase =
      companiesData.reduce((sum, company) => sum + company.risk_score, 0) /
      companiesData.length;

    for (let i = -5; i <= 0; i += 1) {
      const date = addMonths(new Date(), i);
      const monthLabel = format(date, "MMM yyyy");
      const trendFactor = i === 0 ? 1 : 1 + i * -0.03;
      const avgRiskScore = Math.max(0, Math.round(avgRiskBase * trendFactor));
      const criticalCount = companiesData.filter((company) => company.risk_score >= 70).length;
      const complianceRate = Math.round(
        (companiesData.filter((company) => company.compliance_status === "COMPLIANT").length /
          companiesData.length) *
          100
      );

      trends.push({
        month: monthLabel,
        avgRiskScore,
        criticalCount,
        complianceRate,
      });
    }

    setRiskTrends(trends);
  };

  const generateCapacityProjections = (companiesData: Company[]) => {
    if (companiesData.length === 0) {
      setCapacityProjections([]);
      return;
    }

    const currentCapacity = companiesData.reduce(
      (sum, company) => sum + company.assigned_minutes,
      0
    );
    const currentRequired = companiesData.reduce(
      (sum, company) => sum + company.required_minutes,
      0
    );

    const projections: CapacityProjection[] = [];
    for (let i = 0; i < timeframe; i += 1) {
      const date = addMonths(new Date(), i + 1);
      const monthLabel = format(date, "MMM yyyy");
      const projectedDemand = Math.round(currentRequired * (1 + (i + 1) * 0.08));

      projections.push({
        month: monthLabel,
        currentCapacity,
        projectedDemand,
        gap: projectedDemand - currentCapacity,
      });
    }

    setCapacityProjections(projections);
  };

  const calculateRequiredMinutes = (employeeCount: number, hazardClass: string): number => {
    const baseMinutes =
      hazardClass === "Çok Tehlikeli"
        ? 60
        : hazardClass === "Tehlikeli"
          ? 40
          : 20;

    return Math.ceil((employeeCount / 10) * baseMinutes);
  };

  const runPredictiveAnalysis = async () => {
    if (companies.length === 0) {
      toast.warning("Tahmin oluşturmak için önce firma senkronu yapılmalı.");
      return;
    }

    setRunningPrediction(true);
    toast.info("Tahminleme analizi çalıştırılıyor...");

    try {
      const { userId, organizationId } = await getIsgkatipOrgScope();
      const newAlerts: Omit<PredictiveAlert, "id">[] = [];

      companies.forEach((company) => {
        if (!company.contract_end) return;

        const daysUntil = Math.floor(
          (new Date(company.contract_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const monthsUntil = Math.floor(daysUntil / 30);

        if (monthsUntil > 0 && monthsUntil <= timeframe) {
          newAlerts.push({
            alert_type: "CONTRACT_EXPIRY",
            severity: monthsUntil <= 1 ? "CRITICAL" : "WARNING",
            message: `${company.company_name} sözleşmesi ${monthsUntil} ay içinde dolacak`,
            predicted_date: company.contract_end,
            confidence_score: 95,
            details: {
              company_id: company.id,
              sgk_no: company.sgk_no,
              days_until: daysUntil,
            },
          });
        }
      });

      const avgGrowthRate = 0.05;
      companies.forEach((company) => {
        const projectedEmployees = Math.ceil(
          company.employee_count * (1 + avgGrowthRate * timeframe)
        );
        const newRequiredMinutes = calculateRequiredMinutes(
          projectedEmployees,
          company.hazard_class
        );
        const additionalMinutes = newRequiredMinutes - company.required_minutes;

        if (additionalMinutes > 0) {
          newAlerts.push({
            alert_type: "EMPLOYEE_GROWTH",
            severity: additionalMinutes >= 180 ? "WARNING" : "INFO",
            message: `${company.company_name} için ${timeframe} ay içinde ${additionalMinutes} dk/ay ek süre gerekebilir`,
            predicted_date: null,
            confidence_score: 72,
            details: {
              company_id: company.id,
              current_employees: company.employee_count,
              projected_employees: projectedEmployees,
              additional_minutes: additionalMinutes,
            },
          });
        }
      });

      const totalAssigned = companies.reduce((sum, company) => sum + company.assigned_minutes, 0);
      const totalRequired = companies.reduce((sum, company) => sum + company.required_minutes, 0);
      const averageCapacity = 9600;
      const expertCount = Math.max(1, Math.ceil(totalAssigned / averageCapacity));
      const projectedDemand = Math.round(totalRequired * (1 + timeframe * 0.08));
      const projectedExperts = Math.ceil(projectedDemand / averageCapacity);

      if (projectedExperts > expertCount) {
        newAlerts.push({
          alert_type: "CAPACITY_PLANNING",
          severity: projectedExperts - expertCount >= 2 ? "CRITICAL" : "WARNING",
          message: `${timeframe} ay içinde ${projectedExperts - expertCount} ek uzman gerekebilir`,
          predicted_date: null,
          confidence_score: 81,
          details: {
            current_experts: expertCount,
            projected_experts: projectedExperts,
            additional_needed: projectedExperts - expertCount,
            current_required_minutes: totalRequired,
            projected_required_minutes: projectedDemand,
          },
        });
      }

      companies
        .filter(
          (company) =>
            company.risk_score >= 70 || company.compliance_status === "CRITICAL"
        )
        .slice(0, 5)
        .forEach((company) => {
          newAlerts.push({
            alert_type: "OVERLOAD_WARNING",
            severity: company.risk_score >= 85 ? "CRITICAL" : "WARNING",
            message: `${company.company_name} için yüksek risk ve uyum baskısı devam ediyor`,
            predicted_date: company.contract_end,
            confidence_score: 78,
            details: {
              company_id: company.id,
              risk_score: company.risk_score,
              compliance_status: company.compliance_status,
              required_minutes: company.required_minutes,
              assigned_minutes: company.assigned_minutes,
            },
          });
        });

      const { error: deleteError } = await supabase
        .from("isgkatip_predictive_alerts")
        .delete()
        .eq("org_id", organizationId)
        .eq("status", "ACTIVE");

      if (deleteError) throw deleteError;

      if (newAlerts.length > 0) {
        const rows = newAlerts.map((alert) => ({
          ...alert,
          org_id: organizationId,
          user_id: userId,
          status: "ACTIVE",
          company_id:
            typeof alert.details?.company_id === "string"
              ? (alert.details.company_id as string)
              : null,
        }));

        const { error: insertError } = await supabase
          .from("isgkatip_predictive_alerts")
          .insert(rows as never);

        if (insertError) throw insertError;
      }

      toast.success(`${newAlerts.length} tahmin oluşturuldu`);
      await loadRiskAnalysis();
    } catch (error: any) {
      console.error("Predictive analysis error:", error);
      toast.error(error?.message || "Tahminleme hatası");
    } finally {
      setRunningPrediction(false);
    }
  };

  const getRiskDistribution = () => {
    const distribution = [
      {
        name: "Düşük (0-20)",
        value: companies.filter((company) => company.risk_score < 20).length,
        color: "#10b981",
      },
      {
        name: "Orta (20-40)",
        value: companies.filter(
          (company) => company.risk_score >= 20 && company.risk_score < 40
        ).length,
        color: "#f59e0b",
      },
      {
        name: "Yüksek (40-70)",
        value: companies.filter(
          (company) => company.risk_score >= 40 && company.risk_score < 70
        ).length,
        color: "#f97316",
      },
      {
        name: "Kritik (70+)",
        value: companies.filter((company) => company.risk_score >= 70).length,
        color: "#ef4444",
      },
    ];

    return distribution.filter((item) => item.value > 0);
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "CONTRACT_EXPIRY":
        return <Calendar className="h-5 w-5" />;
      case "EMPLOYEE_GROWTH":
        return <Users className="h-5 w-5" />;
      case "CAPACITY_PLANNING":
        return <Target className="h-5 w-5" />;
      case "OVERLOAD_WARNING":
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-64 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-32 animate-pulse rounded bg-slate-800" />
            <div className="h-10 w-32 animate-pulse rounded bg-slate-800" />
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="h-[300px] animate-pulse rounded-xl bg-slate-900/70" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="h-[250px] animate-pulse rounded-xl bg-slate-900/70" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="h-[250px] animate-pulse rounded-xl bg-slate-900/70" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const riskDistribution = getRiskDistribution();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <BarChart3 className="h-7 w-7 text-primary" />
            Risk Analizi ve Tahminleme
          </h2>
          <p className="text-muted-foreground">
            AI destekli risk görünümü ve kapasite tahminleri
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={timeframe.toString()}
            onValueChange={(value) => setTimeframe(parseInt(value, 10))}
          >
            <SelectTrigger className="w-[180px]">
              <Clock className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Ay</SelectItem>
              <SelectItem value="6">6 Ay</SelectItem>
              <SelectItem value="12">12 Ay</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={runPredictiveAnalysis} variant="outline" disabled={runningPrediction}>
            {runningPrediction ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            {runningPrediction ? "Tahmin üretiliyor..." : "Tahmin Çalıştır"}
          </Button>

          <Button onClick={() => void loadRiskAnalysis()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Skoru Trendi</CardTitle>
          <CardDescription>Son 6 aylık risk skoru görünümü</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={riskTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgRiskScore"
                stroke="#ef4444"
                strokeWidth={2}
                name="Ort. Risk Skoru"
              />
              <Line
                type="monotone"
                dataKey="complianceRate"
                stroke="#10b981"
                strokeWidth={2}
                name="Uyum Oranı %"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Risk Dağılımı</CardTitle>
            <CardDescription>Firma bazında risk seviyeleri</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kapasite Projeksiyonu</CardTitle>
            <CardDescription>{timeframe} aylık kapasite tahminleri</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={capacityProjections}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="currentCapacity" fill="#3b82f6" name="Mevcut" />
                <Bar dataKey="projectedDemand" fill="#f59e0b" name="Tahmin" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tahminleme Uyarıları ({predictiveAlerts.length})</CardTitle>
          <CardDescription>AI destekli risk ve kapasite tahminleri</CardDescription>
        </CardHeader>
        <CardContent>
          {predictiveAlerts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Zap className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>Henüz tahmin uyarısı yok</p>
              <Button
                onClick={runPredictiveAnalysis}
                variant="outline"
                className="mt-4"
                disabled={runningPrediction}
              >
                {runningPrediction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                {runningPrediction ? "Tahmin üretiliyor..." : "İlk Tahmini Çalıştır"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {predictiveAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-4 ${
                    alert.severity === "CRITICAL"
                      ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                      : alert.severity === "WARNING"
                        ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                        : "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-lg p-2 text-white ${
                        alert.severity === "CRITICAL"
                          ? "bg-red-500"
                          : alert.severity === "WARNING"
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                      }`}
                    >
                      {getAlertIcon(alert.alert_type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{alert.message}</p>
                          {alert.predicted_date ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              Tahmin Tarihi:{" "}
                              {format(new Date(alert.predicted_date), "dd MMMM yyyy")}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {alert.confidence_score}% güven
                          </Badge>
                          <Badge
                            variant={
                              alert.severity === "CRITICAL" ? "destructive" : "default"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>

                      {alert.details ? (
                        <div className="mt-2 rounded-md bg-background/70 p-3 text-xs text-muted-foreground">
                          <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(alert.details, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {capacityProjections.some((projection) => projection.gap > 1000) ? (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-500" />
              <div>
                <p className="font-semibold text-orange-900 dark:text-orange-100">
                  Kapasite Açığı Tahmini
                </p>
                <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                  {timeframe} ay içinde toplam{" "}
                  {Math.max(...capacityProjections.map((projection) => projection.gap))} dakika/ay
                  kapasite açığı öngörülüyor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
