// ====================================================
// RISK ANALYZER - PREDİCTİVE RISK ANALİZİ
// ====================================================

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Clock,
  Target,
  RefreshCw,
  Download,
  Loader2,
  Zap,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, addMonths } from "date-fns";

// ====================================================
// TYPES
// ====================================================
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
  details: any;
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

// ====================================================
// MAIN COMPONENT
// ====================================================
export default function RiskAnalyzer() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [predictiveAlerts, setPredictiveAlerts] = useState<PredictiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<number>(3); // months
  const [riskTrends, setRiskTrends] = useState<RiskTrend[]>([]);
  const [capacityProjections, setCapacityProjections] = useState<CapacityProjection[]>([]);

  useEffect(() => {
    loadRiskAnalysis();
  }, [timeframe]);

  // ====================================================
  // DATA LOADING
  // ====================================================
  const loadRiskAnalysis = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("isgkatip_companies")
        .select("*")
        .eq("org_id", user.id);

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Load predictive alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from("isgkatip_predictive_alerts")
        .select("*")
        .eq("org_id", user.id)
        .eq("status", "ACTIVE")
        .order("severity", { ascending: false });

      if (alertsError) throw alertsError;
      setPredictiveAlerts(alertsData || []);

      // Generate trend data
      generateRiskTrends(companiesData || []);

      // Generate capacity projections
      generateCapacityProjections(companiesData || []);

      toast.success("Risk analizi yüklendi");
    } catch (error: any) {
      console.error("❌ Load error:", error);
      toast.error("Risk analizi yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // TREND GENERATION
  // ====================================================
  const generateRiskTrends = (companiesData: Company[]) => {
    const trends: RiskTrend[] = [];

    for (let i = -5; i <= 0; i++) {
      const date = addMonths(new Date(), i);
      const monthLabel = format(date, "MMM yyyy");

      // Simulate historical data (in production, fetch from DB)
      const avgRisk = Math.max(
        0,
        companiesData.reduce((sum, c) => sum + c.risk_score, 0) /
          companiesData.length +
          Math.random() * 10 - 5
      );

      const criticalCount = companiesData.filter(
        (c) => c.risk_score >= 70
      ).length;

      const complianceRate =
        (companiesData.filter((c) => c.compliance_status === "COMPLIANT")
          .length /
          companiesData.length) *
        100;

      trends.push({
        month: monthLabel,
        avgRiskScore: Math.round(avgRisk),
        criticalCount,
        complianceRate: Math.round(complianceRate),
      });
    }

    setRiskTrends(trends);
  };

  const generateCapacityProjections = (companiesData: Company[]) => {
    const projections: CapacityProjection[] = [];

    // Current total capacity
    const currentCapacity = companiesData.reduce(
      (sum, c) => sum + c.assigned_minutes,
      0
    );

    for (let i = 0; i < timeframe; i++) {
      const date = addMonths(new Date(), i + 1);
      const monthLabel = format(date, "MMM yyyy");

      // Simulate growth (10% per month)
      const growthFactor = 1 + i * 0.1;
      const projectedDemand = Math.round(currentCapacity * growthFactor);
      const gap = projectedDemand - currentCapacity;

      projections.push({
        month: monthLabel,
        currentCapacity,
        projectedDemand,
        gap,
      });
    }

    setCapacityProjections(projections);
  };

  // ====================================================
  // PREDICTIVE ANALYSIS
  // ====================================================
  const runPredictiveAnalysis = async () => {
    toast.info("Tahminleme analizi çalıştırılıyor...");

    try {
      const newAlerts: any[] = [];

      // 1. Contract expiry predictions
      companies.forEach((company) => {
        if (company.contract_end) {
          const daysUntil = Math.floor(
            (new Date(company.contract_end).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
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
        }
      });

      // 2. Employee growth predictions
      const avgGrowthRate = 0.05; // 5% per month assumption
      companies.forEach((company) => {
        const projectedEmployees = Math.ceil(
          company.employee_count * (1 + avgGrowthRate * timeframe)
        );

        if (projectedEmployees > company.employee_count) {
          // Calculate new required minutes
          const newRequiredMinutes = calculateRequiredMinutes(
            projectedEmployees,
            company.hazard_class
          );
          const additionalMinutes =
            newRequiredMinutes - company.required_minutes;

          if (additionalMinutes > 0) {
            newAlerts.push({
              alert_type: "EMPLOYEE_GROWTH",
              severity: "INFO",
              message: `${company.company_name} için ${timeframe} ay içinde ${additionalMinutes} dk/ay ek süre gerekebilir`,
              predicted_date: null,
              confidence_score: 70,
              details: {
                company_id: company.id,
                current_employees: company.employee_count,
                projected_employees: projectedEmployees,
                additional_minutes: additionalMinutes,
              },
            });
          }
        }
      });

      // 3. Capacity overload predictions
      const totalAssigned = companies.reduce(
        (sum, c) => sum + c.assigned_minutes,
        0
      );
      const averageCapacity = 9600; // 160 hours/month per expert
      const expertCount = Math.ceil(totalAssigned / averageCapacity);

      const projectedDemand = Math.round(totalAssigned * 1.2); // 20% growth
      const projectedExperts = Math.ceil(projectedDemand / averageCapacity);

      if (projectedExperts > expertCount) {
        newAlerts.push({
          alert_type: "OVERLOAD_WARNING",
          severity: "WARNING",
          message: `${timeframe} ay içinde ${
            projectedExperts - expertCount
          } ek uzman gerekebilir`,
          predicted_date: null,
          confidence_score: 80,
          details: {
            current_experts: expertCount,
            projected_experts: projectedExperts,
            additional_needed: projectedExperts - expertCount,
          },
        });
      }

      // Save to database
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        for (const alert of newAlerts) {
          await supabase.from("isgkatip_predictive_alerts").upsert({
            org_id: user.id,
            ...alert,
            status: "ACTIVE",
          });
        }
      }

      toast.success(`${newAlerts.length} tahmin oluşturuldu`);
      await loadRiskAnalysis();
    } catch (error: any) {
      toast.error("Tahminleme hatası");
    }
  };

  // ====================================================
  // HELPER FUNCTIONS
  // ====================================================
  const calculateRequiredMinutes = (
    employeeCount: number,
    hazardClass: string
  ): number => {
    // Simplified calculation (use full logic from edge function)
    const baseMinutes = hazardClass === "Çok Tehlikeli" ? 60 : 30;
    return Math.ceil((employeeCount / 10) * baseMinutes);
  };

  const getRiskDistribution = () => {
    const distribution = [
      {
        name: "Düşük (0-20)",
        value: companies.filter((c) => c.risk_score < 20).length,
        color: "#10b981",
      },
      {
        name: "Orta (20-40)",
        value: companies.filter((c) => c.risk_score >= 20 && c.risk_score < 40)
          .length,
        color: "#f59e0b",
      },
      {
        name: "Yüksek (40-70)",
        value: companies.filter((c) => c.risk_score >= 40 && c.risk_score < 70)
          .length,
        color: "#f97316",
      },
      {
        name: "Kritik (70+)",
        value: companies.filter((c) => c.risk_score >= 70).length,
        color: "#ef4444",
      },
    ];

    return distribution.filter((d) => d.value > 0);
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

  // ====================================================
  // RENDER
  // ====================================================
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-primary" />
            Risk Analizi ve Tahminleme
          </h2>
          <p className="text-muted-foreground">
            Predictive analytics ve kapasite planlama
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={timeframe.toString()}
            onValueChange={(v) => setTimeframe(parseInt(v))}
          >
            <SelectTrigger className="w-[180px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Ay</SelectItem>
              <SelectItem value="6">6 Ay</SelectItem>
              <SelectItem value="12">12 Ay</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={runPredictiveAnalysis} variant="outline">
            <Zap className="h-4 w-4 mr-2" />
            Tahmin Çalıştır
          </Button>

          <Button onClick={loadRiskAnalysis}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
        </div>
      </div>

      {/* Risk Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Skoru Trendi</CardTitle>
          <CardDescription>Son 6 aylık risk skoru ortalaması</CardDescription>
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

      {/* Risk Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <Cell key={`cell-${index}`} fill={entry.color} />
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
            <CardDescription>
              {timeframe} aylık kapasite tahminleri
            </CardDescription>
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

      {/* Predictive Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Tahminleme Uyarıları ({predictiveAlerts.length})</CardTitle>
          <CardDescription>
            AI destekli risk ve kapasite tahminleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          {predictiveAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Henüz tahmin uyarısı yok</p>
              <Button
                onClick={runPredictiveAnalysis}
                variant="outline"
                className="mt-4"
              >
                <Zap className="h-4 w-4 mr-2" />
                İlk Tahmini Çalıştır
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {predictiveAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.severity === "CRITICAL"
                      ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                      : alert.severity === "WARNING"
                      ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                      : "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        alert.severity === "CRITICAL"
                          ? "bg-red-500"
                          : alert.severity === "WARNING"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                      } text-white`}
                    >
                      {getAlertIcon(alert.alert_type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{alert.message}</p>
                          {alert.predicted_date && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Tahmin Tarihi:{" "}
                              {format(
                                new Date(alert.predicted_date),
                                "dd MMMM yyyy"
                              )}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {alert.confidence_score}% güven
                          </Badge>
                          <Badge
                            variant={
                              alert.severity === "CRITICAL"
                                ? "destructive"
                                : "default"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>

                      {alert.details && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {JSON.stringify(alert.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capacity Gap Warning */}
      {capacityProjections.some((p) => p.gap > 1000) && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900 dark:text-orange-100">
                  Kapasite Açığı Tahmini
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  {timeframe} ay içinde toplam{" "}
                  {Math.max(...capacityProjections.map((p) => p.gap))} dakika/ay
                  kapasite açığı öngörülüyor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
