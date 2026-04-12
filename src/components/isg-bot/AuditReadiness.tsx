// ====================================================
// DENETİME HAZIR MIYIM MODÜLÜ
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
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
  Download,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

interface AuditCheck {
  id: string;
  category: string;
  checkName: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details?: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface AuditScore {
  total: number;
  passed: number;
  warnings: number;
  failed: number;
  percentage: number;
  grade: string;
}

export default function AuditReadiness() {
  const [checks, setChecks] = useState<AuditCheck[]>([]);
  const [score, setScore] = useState<AuditScore | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runAuditCheck();
  }, []);

  const runAuditCheck = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Run comprehensive audit check
      const auditChecks: AuditCheck[] = [];

      // 1. Check for missing contracts
      const { data: companies } = await supabase
        .from("isgkatip_companies")
        .select("*")
        .eq("org_id", user.id);

      if (companies) {
        const missingContracts = companies.filter((c) => !c.contract_end);
        auditChecks.push({
          id: "missing_contracts",
          category: "Sözleşmeler",
          checkName: "Sözleşme Kontrolü",
          status: missingContracts.length === 0 ? "pass" : "fail",
          message:
            missingContracts.length === 0
              ? "Tüm firmalar için sözleşme mevcut"
              : `${missingContracts.length} firma için sözleşme eksik`,
          severity: "critical",
        });

        // 2. Check for expired contracts
        const expiredContracts = companies.filter(
          (c) => c.contract_end && new Date(c.contract_end) < new Date()
        );
        auditChecks.push({
          id: "expired_contracts",
          category: "Sözleşmeler",
          checkName: "Süresi Dolan Sözleşmeler",
          status: expiredContracts.length === 0 ? "pass" : "fail",
          message:
            expiredContracts.length === 0
              ? "Süresi dolan sözleşme yok"
              : `${expiredContracts.length} sözleşme süresi dolmuş`,
          severity: "critical",
        });

        // 3. Check for duration compliance
        const insufficientDuration = companies.filter(
          (c) => c.assigned_minutes < c.required_minutes
        );
        auditChecks.push({
          id: "duration_compliance",
          category: "Süre Uyumu",
          checkName: "Asgari Süre Kontrolü",
          status: insufficientDuration.length === 0 ? "pass" : "fail",
          message:
            insufficientDuration.length === 0
              ? "Tüm firmalar için süre yeterli"
              : `${insufficientDuration.length} firma için eksik süre`,
          severity: "critical",
        });

        // 4. Check for board obligation
        const largeCompanies = companies.filter((c) => c.employee_count >= 50);
        auditChecks.push({
          id: "board_obligation",
          category: "Kurul Zorunluluğu",
          checkName: "İSG Kurulu Kontrolü",
          status: largeCompanies.length === 0 ? "pass" : "warning",
          message:
            largeCompanies.length === 0
              ? "Kurul zorunluluğu olan firma yok"
              : `${largeCompanies.length} firma için kurul zorunlu`,
          severity: "high",
        });
      }

      // 5. Check for critical compliance flags
      const { data: criticalFlags } = await supabase
        .from("isgkatip_compliance_flags")
        .select("*")
        .eq("org_id", user.id)
        .eq("status", "OPEN")
        .eq("severity", "CRITICAL");

      auditChecks.push({
        id: "critical_flags",
        category: "Uyumsuzluk Bayrakları",
        checkName: "Kritik Bayrak Kontrolü",
        status: (criticalFlags?.length || 0) === 0 ? "pass" : "fail",
        message:
          (criticalFlags?.length || 0) === 0
            ? "Kritik bayrak yok"
            : `${criticalFlags?.length} kritik bayrak var`,
        severity: "critical",
      });

      // 6. Check for expiring contracts (next 30 days)
      const expiringContracts = companies?.filter((c) => {
        if (!c.contract_end) return false;
        const daysUntil = Math.floor(
          (new Date(c.contract_end).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return daysUntil > 0 && daysUntil <= 30;
      });

      auditChecks.push({
        id: "expiring_contracts",
        category: "Sözleşmeler",
        checkName: "Yaklaşan Bitişler",
        status: (expiringContracts?.length || 0) === 0 ? "pass" : "warning",
        message:
          (expiringContracts?.length || 0) === 0
            ? "30 gün içinde sona erecek sözleşme yok"
            : `${expiringContracts?.length} sözleşme 30 gün içinde dolacak`,
        severity: "medium",
      });

      // Calculate score
      const passed = auditChecks.filter((c) => c.status === "pass").length;
      const warnings = auditChecks.filter((c) => c.status === "warning").length;
      const failed = auditChecks.filter((c) => c.status === "fail").length;
      const percentage = Math.round((passed / auditChecks.length) * 100);

      const grade =
        percentage >= 90
          ? "A"
          : percentage >= 75
          ? "B"
          : percentage >= 60
          ? "C"
          : "D";

      setChecks(auditChecks);
      setScore({
        total: auditChecks.length,
        passed,
        warnings,
        failed,
        percentage,
        grade,
      });

      toast.success("Denetim kontrolü tamamlandı");
    } catch (error: any) {
      console.error("❌ Audit check error:", error);
      toast.error("Denetim kontrolü hatası");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    // Generate PDF report
    toast.info("Rapor indiriliyor...");
    // Implementation here
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 75) return "text-blue-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Denetime Hazır mıyım?
          </h1>
          <p className="text-muted-foreground mt-1">
            Kapsamlı denetim hazırlık kontrolü
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={downloadReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Rapor İndir
          </Button>
          <Button onClick={runAuditCheck} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Yeniden Kontrol Et
          </Button>
        </div>
      </div>

      {/* Score Card */}
      {score && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Denetim Hazırlık Skoru</CardTitle>
            <CardDescription>
              Toplam {score.total} kontrol yapıldı
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2 flex flex-col items-center justify-center">
                <div
                  className={`text-7xl font-bold ${getScoreColor(
                    score.percentage
                  )}`}
                >
                  {score.grade}
                </div>
                <div className="text-4xl font-bold text-muted-foreground mt-2">
                  {score.percentage}%
                </div>
                <Progress value={score.percentage} className="w-full mt-4" />
              </div>

              <div className="md:col-span-3 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-green-600">
                    {score.passed}
                  </div>
                  <div className="text-sm text-muted-foreground">Başarılı</div>
                </div>

                <div className="text-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-yellow-600">
                    {score.warnings}
                  </div>
                  <div className="text-sm text-muted-foreground">Uyarı</div>
                </div>

                <div className="text-center">
                  <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-red-600">
                    {score.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Başarısız</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checks List */}
      <div className="grid grid-cols-1 gap-4">
        {checks.map((check) => (
          <Card
            key={check.id}
            className={
              check.status === "fail"
                ? "border-red-500"
                : check.status === "warning"
                ? "border-yellow-500"
                : "border-green-500"
            }
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {getStatusIcon(check.status)}

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2">
                        {check.category}
                      </Badge>
                      <h3 className="font-semibold text-lg">{check.checkName}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {check.message}
                      </p>
                      {check.details && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {check.details}
                        </p>
                      )}
                    </div>

                    <Badge
                      variant={
                        check.severity === "critical"
                          ? "destructive"
                          : check.severity === "high"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {check.severity === "critical"
                        ? "Kritik"
                        : check.severity === "high"
                        ? "Yüksek"
                        : check.severity === "medium"
                        ? "Orta"
                        : "Düşük"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      {score && score.failed > 0 && (
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-100">
                  Denetim için hazır değilsiniz!
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {score.failed} kritik sorun tespit edildi. Lütfen bu sorunları
                  çözün.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {score && score.failed === 0 && score.warnings === 0 && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Denetim için hazırsınız! 🎉
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Tüm kontroller başarıyla geçildi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}