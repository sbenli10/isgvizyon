// ====================================================
// COMPLIANCE REPORT - DETAYLI UYUMLULUK RAPORU
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Filter,
  Search,
  FileText,
  Download,
  RefreshCw,
  Eye,
  CheckCheck,
  Ban,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ====================================================
// TYPES
// ====================================================
interface ComplianceFlag {
  id: string;
  company_id: string;
  company_name?: string;
  sgk_no?: string;
  rule_name: string;
  severity: "INFO" | "WARNING" | "CRITICAL" | "ERROR";
  message: string;
  details: any;
  status: "OPEN" | "RESOLVED" | "IGNORED";
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

interface CompanyInfo {
  id: string;
  company_name: string;
  sgk_no: string;
  employee_count: number;
  hazard_class: string;
  compliance_status: string;
  risk_score: number;
}

interface FilterState {
  severity: string;
  status: string;
  ruleType: string;
  searchTerm: string;
}

// ====================================================
// MAIN COMPONENT
// ====================================================
export default function ComplianceReport() {
  const [flags, setFlags] = useState<ComplianceFlag[]>([]);
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<ComplianceFlag | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    severity: "all",
    status: "all",
    ruleType: "all",
    searchTerm: "",
  });

  useEffect(() => {
    loadComplianceReport();
  }, []);

 type Severity = "INFO" | "WARNING" | "CRITICAL" | "ERROR";
    type FlagStatus = "OPEN" | "RESOLVED" | "IGNORED";

    function normalizeSeverity(value: string): Severity {
    const allowed: Severity[] = ["INFO", "WARNING", "CRITICAL", "ERROR"];
    if (allowed.includes(value as Severity)) {
        return value as Severity;
    }
    return "INFO";
    }

    function normalizeStatus(value: string): FlagStatus {
    const allowed: FlagStatus[] = ["OPEN", "RESOLVED", "IGNORED"];
    if (allowed.includes(value as FlagStatus)) {
        return value as FlagStatus;
    }
    return "OPEN";
    }

    // ====================================================
    // DATA LOADING
    // ====================================================

    const loadComplianceReport = async () => {
    setLoading(true);

    try {
        const {
        data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("Not authenticated");

        // --------------------------------------------------
        // 1️⃣ Companies
        // --------------------------------------------------
        const { data: companiesData, error: companiesError } = await supabase
        .from("isgkatip_companies")
        .select(
            "id, company_name, sgk_no, employee_count, hazard_class, compliance_status, risk_score"
        )
        .eq("org_id", user.id);

        if (companiesError) throw companiesError;

        const companies = companiesData ?? [];
        setCompanies(companies);

        // --------------------------------------------------
        // 2️⃣ Compliance Flags
        // --------------------------------------------------
        const { data: flagsData, error: flagsError } = await supabase
        .from("isgkatip_compliance_flags")
        .select("*")
        .eq("org_id", user.id)
        .order("created_at", { ascending: false });

        if (flagsError) throw flagsError;

        // --------------------------------------------------
        // 3️⃣ Normalize + Enrich
        // --------------------------------------------------
        const enrichedFlags: ComplianceFlag[] = (flagsData ?? []).map((flag) => {
        const company = companies.find((c) => c.id === flag.company_id);

        return {
            id: flag.id,
            org_id: flag.org_id,
            company_id: flag.company_id ?? "",
            rule_name: flag.rule_name,
            severity: normalizeSeverity(flag.severity),
            status: normalizeStatus(flag.status),
            message: flag.message,
            details: flag.details ?? {},
            resolution_notes: flag.resolution_notes ?? "",
            resolved_at: flag.resolved_at ?? null,
            resolved_by: flag.resolved_by ?? null,
            created_at: flag.created_at ?? "",
            updated_at: flag.updated_at ?? "",
            company_name: company?.company_name ?? "",
            sgk_no: company?.sgk_no ?? "",
        };
        });

        setFlags(enrichedFlags);
        toast.success("Compliance raporu yüklendi");
    } catch (error: any) {
        console.error("❌ Load error:", error);
        toast.error("Rapor yüklenemedi", {
        description: error.message,
        });
    } finally {
        setLoading(false);
    }
    };

  // ====================================================
  // FLAG ACTIONS
  // ====================================================
  const handleResolveFlag = async () => {
    if (!selectedFlag) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("isgkatip_compliance_flags")
        .update({
          status: "RESOLVED",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: resolutionNotes,
        })
        .eq("id", selectedFlag.id);

      if (error) throw error;

      toast.success("Flag çözüldü olarak işaretlendi");
      setResolveDialogOpen(false);
      setResolutionNotes("");
      setSelectedFlag(null);
      await loadComplianceReport();
    } catch (error: any) {
      toast.error("İşlem başarısız", { description: error.message });
    }
  };

  const handleIgnoreFlag = async (flag: ComplianceFlag) => {
    if (!confirm("Bu flag'i görmezden gelmek istediğinizden emin misiniz?"))
      return;

    try {
      const { error } = await supabase
        .from("isgkatip_compliance_flags")
        .update({ status: "IGNORED" })
        .eq("id", flag.id);

      if (error) throw error;

      toast.success("Flag görmezden gelindi");
      await loadComplianceReport();
    } catch (error: any) {
      toast.error("İşlem başarısız");
    }
  };

  const handleReopenFlag = async (flag: ComplianceFlag) => {
    try {
      const { error } = await supabase
        .from("isgkatip_compliance_flags")
        .update({
          status: "OPEN",
          resolved_at: null,
          resolved_by: null,
          resolution_notes: null,
        })
        .eq("id", flag.id);

      if (error) throw error;

      toast.success("Flag yeniden açıldı");
      await loadComplianceReport();
    } catch (error: any) {
      toast.error("İşlem başarısız");
    }
  };

  // ====================================================
  // FILTERING
  // ====================================================
  const filteredFlags = flags.filter((flag) => {
    const matchesSeverity =
      filters.severity === "all" || flag.severity === filters.severity;

    const matchesStatus =
      filters.status === "all" || flag.status === filters.status;

    const matchesRuleType =
      filters.ruleType === "all" || flag.rule_name.includes(filters.ruleType);

    const matchesSearch =
      !filters.searchTerm ||
      flag.company_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      flag.sgk_no?.includes(filters.searchTerm) ||
      flag.message.toLowerCase().includes(filters.searchTerm.toLowerCase());

    return matchesSeverity && matchesStatus && matchesRuleType && matchesSearch;
  });

  // ====================================================
  // STATS
  // ====================================================
  const stats = {
    total: flags.length,
    open: flags.filter((f) => f.status === "OPEN").length,
    resolved: flags.filter((f) => f.status === "RESOLVED").length,
    ignored: flags.filter((f) => f.status === "IGNORED").length,
    critical: flags.filter((f) => f.severity === "CRITICAL" && f.status === "OPEN")
      .length,
    warning: flags.filter((f) => f.severity === "WARNING" && f.status === "OPEN")
      .length,
  };

  // ====================================================
  // UI HELPERS
  // ====================================================
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "WARNING":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "INFO":
        return <Info className="h-5 w-5 text-blue-500" />;
      case "ERROR":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: "bg-red-500",
      WARNING: "bg-yellow-500",
      INFO: "bg-blue-500",
      ERROR: "bg-red-500",
    };

    return (
      <Badge className={`${colors[severity] || "bg-gray-500"} text-white`}>
        {severity}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: "bg-orange-500",
      RESOLVED: "bg-green-500",
      IGNORED: "bg-gray-500",
    };

    const labels: Record<string, string> = {
      OPEN: "Açık",
      RESOLVED: "Çözüldü",
      IGNORED: "Görmezden Gelindi",
    };

    return (
      <Badge className={`${colors[status] || "bg-gray-500"} text-white`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getRuleLabel = (ruleName: string) => {
    const labels: Record<string, string> = {
      DURATION_CHECK: "Süre Kontrolü",
      CONTRACT_EXPIRY: "Sözleşme Bitişi",
      KURUL_OBLIGATION: "Kurul Zorunluluğu",
      HAZARD_CLASS_CHECK: "Tehlike Sınıfı",
    };

    return labels[ruleName] || ruleName;
  };

  // ====================================================
  // EXPORT
  // ====================================================
  const exportToCSV = () => {
    const csvData = filteredFlags.map((flag) => ({
      "Firma Adı": flag.company_name,
      "SGK No": flag.sgk_no,
      Kural: getRuleLabel(flag.rule_name),
      Önem: flag.severity,
      Durum: flag.status,
      Mesaj: flag.message,
      Tarih: format(new Date(flag.created_at), "dd.MM.yyyy HH:mm"),
    }));

    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    toast.success("Rapor indirildi");
  };

  // ====================================================
  // RENDER
  // ====================================================
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-56 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-72 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-28 animate-pulse rounded bg-slate-800" />
            <div className="h-10 w-24 animate-pulse rounded bg-slate-800" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="h-8 w-16 animate-pulse rounded bg-slate-800" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-900" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-900/70" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Compliance Detay Raporu</h2>
          <p className="text-muted-foreground">
            Tüm uyumsuzluk bayrakları ve çözüm durumları
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            CSV İndir
          </Button>
          <Button onClick={loadComplianceReport}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Toplam Flag</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Açık</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">Çözüldü</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{stats.ignored}</div>
            <p className="text-xs text-muted-foreground">Görmezden</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">Kritik</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
            <p className="text-xs text-muted-foreground">Uyarı</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Firma veya mesaj ara..."
                className="pl-10"
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters({ ...filters, searchTerm: e.target.value })
                }
              />
            </div>

            <Select
              value={filters.severity}
              onValueChange={(v) => setFilters({ ...filters, severity: v })}
            >
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Önem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Önemler</SelectItem>
                <SelectItem value="CRITICAL">Kritik</SelectItem>
                <SelectItem value="WARNING">Uyarı</SelectItem>
                <SelectItem value="INFO">Bilgi</SelectItem>
                <SelectItem value="ERROR">Hata</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(v) => setFilters({ ...filters, status: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="OPEN">Açık</SelectItem>
                <SelectItem value="RESOLVED">Çözüldü</SelectItem>
                <SelectItem value="IGNORED">Görmezden Gelindi</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.ruleType}
              onValueChange={(v) => setFilters({ ...filters, ruleType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kural Türü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kurallar</SelectItem>
                <SelectItem value="DURATION">Süre Kontrolü</SelectItem>
                <SelectItem value="CONTRACT">Sözleşme</SelectItem>
                <SelectItem value="KURUL">Kurul</SelectItem>
                <SelectItem value="HAZARD">Tehlike Sınıfı</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Flags Table */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Bayrakları ({filteredFlags.length})</CardTitle>
          <CardDescription>
            Tespit edilen uyumsuzluklar ve çözüm durumları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFlags.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p>Filtreye uygun flag bulunamadı</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Önem</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Kural</TableHead>
                    <TableHead>Mesaj</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(flag.severity)}
                          {getSeverityBadge(flag.severity)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <div className="font-medium">{flag.company_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {flag.sgk_no}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">
                          {getRuleLabel(flag.rule_name)}
                        </Badge>
                      </TableCell>

                      <TableCell className="max-w-md">
                        <div className="truncate" title={flag.message}>
                          {flag.message}
                        </div>
                      </TableCell>

                      <TableCell>{getStatusBadge(flag.status)}</TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(flag.created_at), "dd.MM.yyyy HH:mm")}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedFlag(flag);
                              setResolveDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {flag.status === "OPEN" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedFlag(flag);
                                  setResolveDialogOpen(true);
                                }}
                              >
                                <CheckCheck className="h-4 w-4 text-green-600" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleIgnoreFlag(flag)}
                              >
                                <Ban className="h-4 w-4 text-gray-600" />
                              </Button>
                            </>
                          )}

                          {(flag.status === "RESOLVED" ||
                            flag.status === "IGNORED") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReopenFlag(flag)}
                            >
                              <RefreshCw className="h-4 w-4 text-orange-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Çözümü</DialogTitle>
            <DialogDescription>
              Bu flag'i çözüldü olarak işaretle ve notlar ekle
            </DialogDescription>
          </DialogHeader>

          {selectedFlag && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(selectedFlag.severity)}
                  <span className="font-semibold">{selectedFlag.company_name}</span>
                </div>
                <p className="text-sm">{selectedFlag.message}</p>
                <Badge variant="outline">
                  {getRuleLabel(selectedFlag.rule_name)}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution_notes">Çözüm Notları</Label>
                <Textarea
                  id="resolution_notes"
                  placeholder="Ne yapıldı? Nasıl çözüldü?"
                  rows={4}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResolveDialogOpen(false);
                setResolutionNotes("");
                setSelectedFlag(null);
              }}
            >
              İptal
            </Button>
            <Button onClick={handleResolveFlag}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Çözüldü Olarak İşaretle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
