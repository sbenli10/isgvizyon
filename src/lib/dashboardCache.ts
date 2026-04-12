import { supabase } from "@/integrations/supabase/client";

export type DashboardRiskLevel = "low" | "medium" | "high" | "critical";
export type DashboardInspectionStatus =
  | "completed"
  | "draft"
  | "in_progress"
  | "cancelled";

export interface DashboardInspection {
  id: string;
  location_name: string;
  risk_level: DashboardRiskLevel;
  status: DashboardInspectionStatus;
  created_at: string;
  org_id: string;
}

export interface DashboardFinding {
  id: string;
  description: string;
  due_date: string;
  is_resolved: boolean;
  inspection_id: string;
}

export interface DashboardSnapshot {
  orgId: string;
  activeInspections: number;
  openFindings: number;
  criticalRiskPercent: number;
  overdueActions: number;
  riskDistribution: Array<{ name: string; value: number; color: string }>;
  monthlyTrend: Array<{ month: string; denetimler: number }>;
  recentInspections: DashboardInspection[];
  timestamp: number;
}

export const DASHBOARD_CACHE_TTL = 10 * 60 * 1000;

export const getDashboardCacheKey = (userId: string) =>
  `denetron:dashboard:${userId}`;

const calculateRiskDistribution = (inspections: DashboardInspection[]) => {
  const dist: Record<DashboardRiskLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  inspections.forEach((inspection) => {
    if (inspection.risk_level in dist) {
      dist[inspection.risk_level] += 1;
    }
  });

  const colors: Record<DashboardRiskLevel, string> = {
    low: "#10b981",
    medium: "#f59e0b",
    high: "#f97316",
    critical: "#ef4444",
  };

  const labels: Record<DashboardRiskLevel, string> = {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek",
    critical: "Kritik",
  };

  return (Object.keys(dist) as DashboardRiskLevel[])
    .map((level) => ({
      name: labels[level],
      value: dist[level],
      color: colors[level],
    }))
    .filter((item) => item.value > 0);
};

const calculateMonthlyTrend = (inspections: DashboardInspection[]) => {
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const last6Months: Array<{ month: string; denetimler: number }> = [];
  const today = new Date();

  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthLabel = months[date.getMonth()];
    const count = inspections.filter((inspection) => {
      const inspectionDate = new Date(inspection.created_at);
      return (
        inspectionDate.getMonth() === date.getMonth() &&
        inspectionDate.getFullYear() === date.getFullYear()
      );
    }).length;

    last6Months.push({
      month: monthLabel,
      denetimler: count,
    });
  }

  return last6Months;
};

export const fetchDashboardSnapshot = async (
  orgId: string
): Promise<DashboardSnapshot> => {
  if (!orgId) {
    throw new Error("Kuruluş bilgisi bulunamadı.");
  }

  const { data: inspections, error: inspectionsError } = await supabase
    .from("inspections")
    .select("id, location_name, risk_level, status, created_at, org_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (inspectionsError) {
    throw new Error(`Denetim verileri alınamadı: ${inspectionsError.message}`);
  }

  const inspectionList = (inspections || []) as DashboardInspection[];
  let findingsList: DashboardFinding[] = [];

  if (inspectionList.length > 0) {
    const inspectionIds = inspectionList.map((inspection) => inspection.id);
    const { data: findings, error: findingsError } = await supabase
      .from("findings")
      .select("id, description, due_date, is_resolved, inspection_id")
      .in("inspection_id", inspectionIds);

    if (!findingsError) {
      findingsList = (findings || []) as DashboardFinding[];
    }
  }

  const activeInspections = inspectionList.filter(
    (inspection) => inspection.status === "in_progress"
  ).length;
  const openFindings = findingsList.filter((finding) => !finding.is_resolved).length;
  const criticalCount = inspectionList.filter(
    (inspection) => inspection.risk_level === "critical"
  ).length;
  const criticalRiskPercent =
    inspectionList.length > 0
      ? Math.round((criticalCount / inspectionList.length) * 100)
      : 0;
  const today = new Date();
  const overdueActions = findingsList.filter(
    (finding) =>
      !finding.is_resolved &&
      finding.due_date &&
      new Date(finding.due_date) < today
  ).length;

  return {
    orgId,
    activeInspections,
    openFindings,
    criticalRiskPercent,
    overdueActions,
    riskDistribution: calculateRiskDistribution(inspectionList),
    monthlyTrend: calculateMonthlyTrend(inspectionList),
    recentInspections: inspectionList.slice(0, 5),
    timestamp: Date.now(),
  };
};

export const readDashboardSnapshot = (userId: string): DashboardSnapshot | null => {
  try {
    const raw = sessionStorage.getItem(getDashboardCacheKey(userId));
    return raw ? (JSON.parse(raw) as DashboardSnapshot) : null;
  } catch {
    return null;
  }
};

export const writeDashboardSnapshot = (
  userId: string,
  snapshot: DashboardSnapshot
) => {
  sessionStorage.setItem(getDashboardCacheKey(userId), JSON.stringify(snapshot));
};
