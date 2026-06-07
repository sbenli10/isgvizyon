import { useCallback, useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  BellRing,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  PieChart,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { invokeEdgeFunction } from "@/lib/ai/invokeEdgeFunction";
import {
  createOsgbTrackingReminderTask,
  listOsgbCompanyTrackingWorkspace,
  listOsgbFieldVisitsWorkspace,
  listOsgbFinanceWorkspace,
  listOsgbRequiredDocumentsWorkspace,
  type OsgbCompanyTrackingWorkspaceData,
  type OsgbFieldVisitWorkspaceData,
  type OsgbFinanceWorkspaceData,
  type OsgbManagedCompanyRecord,
  type OsgbRequiredDocumentsWorkspaceData,
} from "@/lib/osgbPlatform";
import { cn } from "@/lib/utils";

type RiskLabel = "Düşük" | "Orta" | "Yüksek" | "Kritik";
type StatusKey = "missing" | "planned" | "inProgress" | "completed" | "exempt";

type CompanyRisk = {
  company: OsgbManagedCompanyRecord;
  score: number;
  label: RiskLabel;
  reasons: string[];
  compliance: number;
  overdueCount: number;
  criticalCount: number;
  completedCount: number;
  totalActions: number;
};

type Reminder = {
  id: string;
  title: string;
  companyName: string;
  companyId: string | null;
  dueDate: string | null;
  risk: RiskLabel;
  action: "Evrak Takip" | "Hatırlat" | "Firma Detayı";
};

type AnalysisModel = {
  companies: OsgbManagedCompanyRecord[];
  risks: CompanyRisk[];
  reminders: Reminder[];
  statusDistribution: Array<{ key: StatusKey; label: string; value: number; color: string }>;
  riskDistribution: Array<{ label: RiskLabel; value: number; color: string }>;
  hazardSummary: Array<{ hazard: string; companyCount: number; avgCompliance: number; criticalCount: number; deficitMinutes: number }>;
  kpis: {
    totalCompanies: number;
    averageCompliance: number;
    overdue: number;
    critical: number;
    completed: number;
    progress: number;
    totalActions: number;
  };
};

const statusMeta: Record<StatusKey, { label: string; color: string }> = {
  missing: { label: "Eksik", color: "bg-rose-500" },
  planned: { label: "Planlandı", color: "bg-cyan-500" },
  inProgress: { label: "Devam Ediyor", color: "bg-violet-500" },
  completed: { label: "Tamamlandı", color: "bg-emerald-500" },
  exempt: { label: "Muaf", color: "bg-slate-500" },
};

const riskColors: Record<RiskLabel, string> = {
  Düşük: "bg-emerald-500",
  Orta: "bg-amber-500",
  Yüksek: "bg-orange-500",
  Kritik: "bg-rose-500",
};

const riskBadge: Record<RiskLabel, string> = {
  Düşük: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  Orta: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  Yüksek: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  Kritik: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

const formatPercent = (value: number) => `%${Math.round(Number.isFinite(value) ? value : 0)}`;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString("tr-TR") : "Tarih yok";
const daysUntil = (value: string | null) => {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.ceil(diff / 86_400_000);
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function riskLabelFromScore(score: number): RiskLabel {
  if (score >= 75) return "Kritik";
  if (score >= 55) return "Yüksek";
  if (score >= 30) return "Orta";
  return "Düşük";
}

function KpiCard({ title, value, description, icon: Icon, tone }: { title: string; value: string | number; description: string; icon: typeof Building2; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <div className={cn("grid h-11 w-11 place-items-center rounded-2xl", tone)}><Icon className="h-5 w-5" /></div>
      </div>
      <p className="mt-3 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children, action }: { title: string; icon: typeof Building2; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-200"><Icon className="h-5 w-5" /></div>
          <h3 className="text-base font-black text-white">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-center text-sm text-slate-400">{children}</div>;
}

function DistributionList({ rows, emptyText }: { rows: Array<{ label: string; value: number; color: string }>; emptyText: string }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (total === 0) return <EmptyState>{emptyText}</EmptyState>;
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const width = total > 0 ? Math.round((row.value / total) * 100) : 0;
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-300">
              <span>{row.label}</span><span>{row.value} kayıt</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800"><div className={cn("h-full rounded-full", row.color)} style={{ width: `${width}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function buildFallbackInsight(analysis: AnalysisModel) {
  const { kpis, risks, hazardSummary, reminders } = analysis;
  if (kpis.totalCompanies === 0) return "Henüz izlenecek firma bulunmuyor. OSGB Firmaları sekmesinden firma ekledikten sonra KPI ve risk takibi otomatik hesaplanır.";
  const risky = risks.filter((item) => item.label === "Kritik" || item.label === "Yüksek").length;
  const topHazard = [...hazardSummary].sort((a, b) => b.criticalCount - a.criticalCount)[0];
  return [
    `Mevcut KPI verilerine göre ${kpis.totalCompanies} firma izleniyor ve genel uyum seviyesi ${formatPercent(kpis.averageCompliance)}. ${kpis.critical} kritik kayıt olduğu için denetim ritminin düzenli gözden geçirilmesi önerilir.`,
    `• ${kpis.overdue} gecikmiş kayıt için sorumlu ve son tarih atayın.`,
    `• ${risky} yüksek/kritik riskli firmayı haftalık takip listesine alın.`,
    `• ${topHazard ? `${topHazard.hazard} sınıfındaki ${topHazard.companyCount} firmada eksik hizmet süresini kontrol edin.` : "Tehlike sınıfı verisi oluştuğunda sınıf bazlı ziyaret ritmini güncelleyin."}`,
    `• ${reminders.length} aktif hatırlatmayı Evrak Takip ve Firma Detayı aksiyonlarıyla kapatın.`,
  ].join("\n");
}

function buildAnalysis(
  workspace: OsgbCompanyTrackingWorkspaceData | null,
  documents: OsgbRequiredDocumentsWorkspaceData | null,
  visits: OsgbFieldVisitWorkspaceData | null,
  finance: OsgbFinanceWorkspaceData | null,
  selectedCompanyId: string,
): AnalysisModel {
  const allCompanies = workspace?.companies ?? [];
  const companies = selectedCompanyId === "all" ? allCompanies : allCompanies.filter((company) => company.id === selectedCompanyId);
  const companyIds = new Set(companies.map((company) => company.id));
  const docs = (documents?.documents ?? []).filter((doc) => companyIds.has(doc.companyId));
  const visitRows = (visits?.visits ?? []).filter((visit) => companyIds.has(visit.companyId));
  const financeCompanies = (finance?.companies ?? []).filter((company) => companyIds.has(company.companyId));
  const financeByCompany = new Map(financeCompanies.map((company) => [company.companyId, company]));
  const now = new Date();

  const statusCounts: Record<StatusKey, number> = {
    missing: docs.filter((doc) => doc.status === "missing").length + visitRows.filter((visit) => visit.status === "missed").length + companies.filter((company) => company.assignmentApprovalStatus === "missing_contract").length,
    planned: visitRows.filter((visit) => visit.status === "planned").length + companies.filter((company) => company.assignmentApprovalStatus === "planned").length,
    inProgress: docs.filter((doc) => doc.status === "submitted").length + visitRows.filter((visit) => visit.status === "in_progress").length,
    completed: docs.filter((doc) => doc.status === "approved").length + visitRows.filter((visit) => visit.status === "completed").length + companies.filter((company) => company.assignmentApprovalStatus === "approved").length,
    exempt: 0 + visitRows.filter((visit) => visit.status === "cancelled").length,
  };

  const risks: CompanyRisk[] = companies.map((company) => {
    const companyDocs = docs.filter((doc) => doc.companyId === company.id);
    const companyVisits = visitRows.filter((visit) => visit.companyId === company.id);
    const companyFinance = financeByCompany.get(company.id);
    const contractDays = daysUntil(company.contractEnd);
    const criticalDocs = companyDocs.filter((doc) => doc.status === "missing" && (doc.riskLevel === "critical" || doc.riskLevel === "high")).length;
    const overdueDocs = companyDocs.filter((doc) => doc.status === "missing" && doc.delayDays > 0).length;
    const overdueVisits = companyVisits.filter((visit) => visit.status !== "completed" && visit.status !== "cancelled" && new Date(visit.plannedAt) < now).length;
    const deficit = company.deficitMinutes || 0;
    const overdueBalance = companyFinance?.overdueBalance || 0;
    const reasons: string[] = [];
    let score = 0;

    if (criticalDocs > 0) { score += criticalDocs * 22; reasons.push("Eksik evrak"); }
    if (overdueDocs > 0) { score += overdueDocs * 14; reasons.push("Gecikmiş evrak"); }
    if (overdueVisits > 0) { score += overdueVisits * 16; reasons.push("Gecikmiş ziyaret"); }
    if (deficit > 0) { score += Math.min(28, Math.ceil(deficit / 60) * 8); reasons.push("Atama eksiği"); }
    if (overdueBalance > 0) { score += 18; reasons.push("Gecikmiş ödeme"); }
    if (company.assignmentApprovalStatus === "missing_contract") { score += 24; reasons.push("Sözleşme/atama eksiği"); }
    if (contractDays !== null && contractDays < 0) { score += 24; reasons.push("Sözleşme süresi doldu"); }
    else if (contractDays !== null && contractDays <= 30) { score += 12; reasons.push("Sözleşme bitişi yaklaşıyor"); }
    if (company.hazardClass === "Çok Tehlikeli") score += 8;
    else if (company.hazardClass === "Tehlikeli") score += 4;

    const cappedScore = clamp(score);
    const totalActions = companyDocs.length + companyVisits.length + 1;
    const completedCount = companyDocs.filter((doc) => doc.status === "approved").length + companyVisits.filter((visit) => visit.status === "completed").length + (company.assignmentApprovalStatus === "approved" ? 1 : 0);
    const overdueCount = overdueDocs + overdueVisits + (overdueBalance > 0 ? 1 : 0) + (contractDays !== null && contractDays < 0 ? 1 : 0);

    return {
      company,
      score: cappedScore,
      label: riskLabelFromScore(cappedScore),
      reasons: reasons.length ? Array.from(new Set(reasons)) : ["Risk kaydı yok"],
      compliance: clamp(100 - cappedScore),
      overdueCount,
      criticalCount: criticalDocs + (cappedScore >= 75 ? 1 : 0),
      completedCount,
      totalActions,
    };
  }).sort((a, b) => b.score - a.score);

  const reminders: Reminder[] = [];
  for (const risk of risks) {
    const contractDays = daysUntil(risk.company.contractEnd);
    if (contractDays !== null && contractDays <= 30) {
      reminders.push({ id: `contract-${risk.company.id}`, title: contractDays < 0 ? "Sözleşme süresi doldu" : "Sözleşme bitişi yaklaşıyor", companyName: risk.company.companyName, companyId: risk.company.id, dueDate: risk.company.contractEnd, risk: contractDays < 0 ? "Kritik" : "Yüksek", action: "Firma Detayı" });
    }
    if ((risk.company.deficitMinutes || 0) > 0) {
      reminders.push({ id: `deficit-${risk.company.id}`, title: "Eksik atama/hizmet süresi", companyName: risk.company.companyName, companyId: risk.company.id, dueDate: null, risk: risk.company.deficitMinutes > 240 ? "Kritik" : "Yüksek", action: "Hatırlat" });
    }
  }
  for (const doc of docs.filter((doc) => doc.status === "missing" && (doc.delayDays > 0 || doc.riskLevel === "critical" || doc.riskLevel === "high")).slice(0, 8)) {
    reminders.push({ id: `doc-${doc.id}`, title: `${doc.documentType} eksik`, companyName: doc.companyName, companyId: doc.companyId, dueDate: doc.dueDate, risk: doc.riskLevel === "critical" ? "Kritik" : "Yüksek", action: "Evrak Takip" });
  }
  for (const financeCompany of financeCompanies.filter((item) => item.overdueBalance > 0).slice(0, 5)) {
    reminders.push({ id: `finance-${financeCompany.companyId}`, title: "Gecikmiş ödeme/tahsilat", companyName: financeCompany.companyName, companyId: financeCompany.companyId, dueDate: null, risk: financeCompany.overdueBalance > 50_000 ? "Kritik" : "Yüksek", action: "Hatırlat" });
  }

  const riskDistribution = (["Düşük", "Orta", "Yüksek", "Kritik"] as RiskLabel[]).map((label) => ({ label, value: risks.filter((risk) => risk.label === label).length, color: riskColors[label] }));
  const hazardSummary = ["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"].map((hazard) => {
    const hazardRisks = risks.filter((risk) => risk.company.hazardClass === hazard);
    return {
      hazard,
      companyCount: hazardRisks.length,
      avgCompliance: hazardRisks.length ? Math.round(hazardRisks.reduce((sum, item) => sum + item.compliance, 0) / hazardRisks.length) : 0,
      criticalCount: hazardRisks.filter((risk) => risk.label === "Kritik").length,
      deficitMinutes: hazardRisks.reduce((sum, risk) => sum + (risk.company.deficitMinutes || 0), 0),
    };
  });

  const totalActions = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  const completed = statusCounts.completed;
  const kpis = {
    totalCompanies: companies.length,
    averageCompliance: risks.length ? Math.round(risks.reduce((sum, risk) => sum + risk.compliance, 0) / risks.length) : 0,
    overdue: risks.reduce((sum, risk) => sum + risk.overdueCount, 0),
    critical: risks.reduce((sum, risk) => sum + risk.criticalCount, 0),
    completed,
    progress: totalActions ? Math.round((completed / totalActions) * 100) : 0,
    totalActions,
  };

  return {
    companies,
    risks,
    reminders: reminders.slice(0, 10),
    statusDistribution: (Object.keys(statusMeta) as StatusKey[]).map((key) => ({ key, label: statusMeta[key].label, value: statusCounts[key], color: statusMeta[key].color })),
    riskDistribution,
    hazardSummary,
    kpis,
  };
}

function parseAiText(response: unknown) {
  if (typeof response === "string") return response;
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.analysis === "string") return record.analysis;
    if (typeof record.result === "string") return record.result;
  }
  return "";
}

export default function OSGBCompanyTracking() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { canAccessOsgb, isOsgbActive, isDemoActive, loading: accessLoading } = usePlanLimits();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbCompanyTrackingWorkspaceData | null>(null);
  const [documents, setDocuments] = useState<OsgbRequiredDocumentsWorkspaceData | null>(null);
  const [visits, setVisits] = useState<OsgbFieldVisitWorkspaceData | null>(null);
  const [finance, setFinance] = useState<OsgbFinanceWorkspaceData | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<{ text: string; source: "ai" | "system analizi"; createdAt: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setWorkspace(null); setDocuments(null); setVisits(null); setFinance(null); setLoading(false); return;
    }
    setLoading(true);
    try {
      const [companyData, visitData, documentData, financeData] = await Promise.all([
        listOsgbCompanyTrackingWorkspace(organizationId),
        listOsgbFieldVisitsWorkspace(organizationId, { refreshCompliance: false }),
        user?.id ? listOsgbRequiredDocumentsWorkspace(organizationId, user.id) : Promise.resolve(null),
        user?.id ? listOsgbFinanceWorkspace(organizationId, user.id) : Promise.resolve(null),
      ]);
      setWorkspace(companyData);
      setVisits(visitData);
      setDocuments(documentData);
      setFinance(financeData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma takibi verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, user?.id]);

  useEffect(() => { void loadData(); }, [loadData]);

  const analysis = useMemo(() => buildAnalysis(workspace, documents, visits, finance, selectedCompanyId), [workspace, documents, visits, finance, selectedCompanyId]);

  useEffect(() => {
    setAiInsight({ text: buildFallbackInsight(analysis), source: "system analizi", createdAt: new Date().toLocaleString("tr-TR") });
  }, [analysis]);

  const requestAiInsight = async () => {
    const prompt = `OSGB firma takip KPI verilerine göre kısa Türkçe öneri üret. 1 kısa paragraf ve 3-5 madde yaz. Veri: ${JSON.stringify({
      kpis: analysis.kpis,
      topRiskyCompanies: analysis.risks.slice(0, 5).map((risk) => ({ company: risk.company.companyName, risk: risk.label, score: risk.score, reasons: risk.reasons })),
      hazardSummary: analysis.hazardSummary,
      reminders: analysis.reminders.slice(0, 5).map((reminder) => ({ title: reminder.title, company: reminder.companyName, risk: reminder.risk })),
    })}`;
    setAiLoading(true);
    try {
      const response = await invokeEdgeFunction<unknown>("bulk-capa-analyze", { prompt });
      const text = parseAiText(response);
      if (!text) throw new Error("AI yanıt metni boş döndü.");
      setAiInsight({ text, source: "ai", createdAt: new Date().toLocaleString("tr-TR") });
      toast.success("AI önerisi hazırlandı.");
    } catch (err) {
      setAiInsight({ text: buildFallbackInsight(analysis), source: "system analizi", createdAt: new Date().toLocaleString("tr-TR") });
      toast.error("AI önerisi alınamadı, sistem önerisi gösteriliyor.");
    } finally {
      setAiLoading(false);
    }
  };

  const createReminder = async () => {
    if (!user?.id || !organizationId) return toast.error("Hatırlatma için organizasyon bağlantısı gerekli.");
    const target = analysis.reminders[0];
    try {
      const created = await createOsgbTrackingReminderTask({
        userId: user.id,
        organizationId,
        companyId: target?.companyId || null,
        title: target ? `Firma takibi: ${target.title}` : "Firma takibi genel hatırlatma",
        description: target ? `${target.companyName} için ${target.title} kontrol edilmeli.` : "Firma takibi KPI analizi için takip görevi oluşturuldu.",
        priority: target?.risk === "Kritik" ? "critical" : "high",
        dueDate: target?.dueDate || new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      });
      toast.success(created ? "Hatırlatma görevi oluşturuldu." : "Bu hatırlatma için açık görev zaten var.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hatırlatma oluşturulamadı.");
    }
  };

  if (accessLoading || loading) return <div className="grid min-h-[420px] place-items-center bg-[#0b1426]"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>;
  if (!(canAccessOsgb || isOsgbActive || isDemoActive)) return <EmptyState>OSGB Firma Takibi ayrı OSGB paketi kapsamındadır.</EmptyState>;
  if (!organizationId) return <EmptyState>OSGB Firma Takibi organizasyon bazlı çalışır.</EmptyState>;
  if (error) return <EmptyState>{error}</EmptyState>;

  return (
    <div className="min-h-full space-y-5 bg-[#0b1426] p-4 text-slate-100 md:p-6">
      <div className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-4 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <Label className="text-xs font-black uppercase tracking-wide text-cyan-200">Firma Seçimi</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="mt-2 h-11 max-w-xl border-slate-700 bg-slate-900 text-slate-100"><SelectValue placeholder="Firma seçin" /></SelectTrigger>
              <SelectContent className="z-[140] border-slate-700 bg-slate-900 text-slate-100">
                <SelectItem value="all">Tüm Firmalar - Genel Analiz</SelectItem>
                {(workspace?.companies ?? []).map((company) => <SelectItem key={company.id} value={company.id}>{company.companyName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-black uppercase tracking-wide text-slate-500">Hızlı İşlemler</span>
            <Button type="button" onClick={() => setSelectedCompanyId("all")} className="bg-slate-800 text-slate-100 hover:bg-slate-700"><RefreshCcw className="mr-2 h-4 w-4" />Sıfırla</Button>
            <Button type="button" onClick={() => navigate("/osgb/documents")} className="bg-cyan-600 text-white hover:bg-cyan-500"><FileText className="mr-2 h-4 w-4" />Evrak Takip</Button>
            <Button type="button" onClick={() => void createReminder()} className="bg-violet-600 text-white hover:bg-violet-500"><BellRing className="mr-2 h-4 w-4" />Hatırlat</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Toplam Firma" value={analysis.kpis.totalCompanies} description="Analiz kapsamındaki firma" icon={Building2} tone="bg-cyan-500/15 text-cyan-200" />
        <KpiCard title="Ortalama Uyum" value={formatPercent(analysis.kpis.averageCompliance)} description="Risk skoruna göre uyum" icon={Target} tone="bg-emerald-500/15 text-emerald-200" />
        <KpiCard title="Gecikmiş" value={analysis.kpis.overdue} description="Evrak, ziyaret, ödeme, sözleşme" icon={AlertTriangle} tone="bg-orange-500/15 text-orange-200" />
        <KpiCard title="Kritik" value={analysis.kpis.critical} description="Kritik risk/uyumsuzluk" icon={ShieldAlert} tone="bg-rose-500/15 text-rose-200" />
        <KpiCard title="Tamamlanan" value={analysis.kpis.completed} description="Kapanan takip aksiyonu" icon={CheckCircle2} tone="bg-blue-500/15 text-blue-200" />
        <KpiCard title="İlerleme" value={formatPercent(analysis.kpis.progress)} description={`${analysis.kpis.completed}/${analysis.kpis.totalActions} aksiyon`} icon={TrendingUp} tone="bg-violet-500/15 text-violet-200" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Durum Dağılımı" icon={PieChart}><DistributionList rows={analysis.statusDistribution} emptyText="Yeterli veri yok." /></Panel>
        <Panel title="Risk Dağılımı" icon={ShieldAlert}><DistributionList rows={analysis.riskDistribution} emptyText="Riskli firma kaydı bulunmuyor." /></Panel>
        <Panel title="En Riskli Firmalar" icon={AlertTriangle}>
          {analysis.risks.filter((risk) => risk.score > 0).length ? <div className="space-y-3">{analysis.risks.filter((risk) => risk.score > 0).slice(0, 5).map((risk) => <div key={risk.company.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{risk.company.companyName}</p><p className="mt-1 text-xs text-slate-400">{risk.company.hazardClass} • {risk.reasons.slice(0, 2).join(", ")}</p></div><span className={cn("rounded-full border px-2 py-1 text-xs font-black", riskBadge[risk.label])}>{risk.label} · {risk.score}</span></div></div>)}</div> : <EmptyState>Riskli firma kaydı bulunmuyor.</EmptyState>}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Tehlike Sınıfı Bazlı Durum" icon={ClipboardList}>
          <div className="space-y-3">{analysis.hazardSummary.map((row) => <details key={row.hazard} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3" open={row.companyCount > 0}><summary className="cursor-pointer font-bold text-white">{row.hazard}</summary><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300"><span>Firma: <b>{row.companyCount}</b></span><span>Ortalama uyum: <b>{formatPercent(row.avgCompliance)}</b></span><span>Kritik: <b>{row.criticalCount}</b></span><span>Eksik süre: <b>{row.deficitMinutes} dk</b></span></div></details>)}</div>
        </Panel>
        <Panel title="Kritik Hatırlatmalar" icon={BellRing}>
          {analysis.reminders.length ? <div className="space-y-3">{analysis.reminders.slice(0, 6).map((reminder) => <div key={reminder.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{reminder.title}</p><p className="mt-1 text-xs text-slate-400">{reminder.companyName} • {formatDate(reminder.dueDate)}</p></div><span className={cn("rounded-full border px-2 py-1 text-xs font-black", riskBadge[reminder.risk])}>{reminder.risk}</span></div><Button type="button" size="sm" className="mt-3 bg-slate-800 text-slate-100 hover:bg-cyan-600" onClick={() => reminder.action === "Evrak Takip" ? navigate("/osgb/documents") : reminder.action === "Hatırlat" ? void createReminder() : setSelectedCompanyId(reminder.companyId || "all")}>{reminder.action}</Button></div>)}</div> : <EmptyState>Aktif hatırlatma bulunmuyor.</EmptyState>}
        </Panel>
        <Panel title="AI Genel Öneri" icon={Bot} action={<Button type="button" size="sm" disabled={aiLoading} onClick={() => void requestAiInsight()} className="bg-amber-500 text-slate-950 hover:bg-amber-400"><Sparkles className="mr-2 h-4 w-4" />AI Öneri Al</Button>}>
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50 whitespace-pre-line">{aiLoading ? "AI önerisi hazırlanıyor..." : aiInsight?.text || "Yeterli veri yok."}</div>
          <p className="mt-3 text-xs text-slate-500">Kaynak: {aiInsight?.source || "system analizi"} • {aiInsight?.createdAt || new Date().toLocaleString("tr-TR")}</p>
        </Panel>
      </div>

      <Panel title="Sistem Analizi" icon={Wallet}>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-7 text-slate-300">
          {analysis.kpis.totalCompanies === 0 ? "Henüz izlenecek firma bulunmuyor." : `Toplam ${analysis.kpis.totalCompanies} firma için mevzuat izleme yapılıyor. Genel uyum seviyesi ${analysis.kpis.averageCompliance >= 80 ? "güçlü" : analysis.kpis.averageCompliance >= 55 ? "orta" : "zayıf"} (${formatPercent(analysis.kpis.averageCompliance)}). Kritik kayıt sayısı ${analysis.kpis.critical}. ${analysis.kpis.critical > 0 || analysis.kpis.overdue > 0 ? "Denetim ritmini artırın ve kritik hatırlatmaları kapatın." : "Denetim ritmini koruyun."}`}
        </div>
      </Panel>
    </div>
  );
}
