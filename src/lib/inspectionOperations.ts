import { supabase } from "@/integrations/supabase/client";

export type InspectionStatus = "completed" | "draft" | "in_progress" | "cancelled";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface InspectionListItem {
  id: string;
  org_id: string;
  user_id: string;
  location_name: string;
  equipment_category?: string | null;
  status: InspectionStatus;
  risk_level: RiskLevel;
  media_urls?: string[];
  notes?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface InspectionDetail extends InspectionListItem {
  media_urls: string[];
  notes?: string | null;
}

export interface InspectionListPage {
  items: InspectionListItem[];
  hasNextPage: boolean;
}

export interface InspectionSummary {
  totalCount: number;
  criticalOrHighCount: number;
  openCount: number;
}

type ListInspectionsPageParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: InspectionStatus | null;
};

type LooseClient = typeof supabase & {
  from: (table: string) => any;
};

const db = supabase as LooseClient;

const normalizeSearch = (value?: string) => value?.trim() ?? "";

export async function listInspectionsPage(
  userId: string,
  params: ListInspectionsPageParams,
): Promise<InspectionListPage> {
  const page = Math.max(0, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const search = normalizeSearch(params.search);

  let query = db
    .from("inspections")
    .select(
      "id, org_id, user_id, location_name, equipment_category, status, risk_level, completed_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (search) {
    query = query.or(
      `location_name.ilike.%${search}%,equipment_category.ilike.%${search}%`,
    );
  }

  const from = page * pageSize;
  const to = from + pageSize;

  const { data, error } = await query.range(from, to);
  if (error) throw error;

  const rows = (data as InspectionListItem[]) ?? [];
  return {
    items: rows.slice(0, pageSize),
    hasNextPage: rows.length > pageSize,
  };
}

export async function getInspectionDetail(
  userId: string,
  inspectionId: string,
): Promise<InspectionDetail> {
  const { data, error } = await db
    .from("inspections")
    .select(
      "id, org_id, user_id, location_name, equipment_category, status, risk_level, completed_at, created_at, media_urls, notes",
    )
    .eq("user_id", userId)
    .eq("id", inspectionId)
    .single();

  if (error) throw error;
  return data as InspectionDetail;
}

export async function getInspectionSummary(userId: string): Promise<InspectionSummary> {
  const [totalResult, criticalResult, openResult] = await Promise.all([
    db
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    db
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("risk_level", ["high", "critical"]),
    db
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["in_progress", "draft"]),
  ]);

  if (totalResult.error) throw totalResult.error;
  if (criticalResult.error) throw criticalResult.error;
  if (openResult.error) throw openResult.error;

  return {
    totalCount: totalResult.count ?? 0,
    criticalOrHighCount: criticalResult.count ?? 0,
    openCount: openResult.count ?? 0,
  };
}
