import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getIsgkatipOrgScope } from "./isgkatipOrgScope";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type IsgkatipCompanyRow = Tables["isgkatip_companies"]["Row"];
export type IsgkatipFlagRow = Tables["isgkatip_compliance_flags"]["Row"];
export type IsgkatipAlertRow = Tables["isgkatip_predictive_alerts"]["Row"];
export type IsgkatipSyncLogRow = Tables["isgkatip_sync_logs"]["Row"];
export type IsgkatipDeletedCompanyViewRow = Record<string, any>;
export interface ScopeParams {
  userId?: string;
  organizationId?: string;
}

const resolveOrganizationId = async (params?: ScopeParams): Promise<string> => {
  const scope = await getIsgkatipOrgScope(params);

  if (!scope?.organizationId) {
    throw new Error(
      "Organization scope bulunamadı. profiles.organization_id boş olabilir veya kullanıcı organization'a bağlı değildir.",
    );
  }

  return scope.organizationId;
};

// Dinamik select kullandığımız için Supabase'in otomatik tip inference'ı bazen bozuluyor.
// Bu helper ile tüm query fonksiyonları “data ?? []” döndürür ve TS2352'yi engelleriz.
const castRows = <TRow>(data: unknown): TRow[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data as TRow[];
  return [];
};

export const listIsgkatipCompanies = async (
  params?: ScopeParams & {
    select?: string;
    includeDeleted?: boolean;
    orderBy?: "risk_score" | "company_name";
    ascending?: boolean;
    limit?: number;
  },
): Promise<IsgkatipCompanyRow[]> => {
  const organizationId = await resolveOrganizationId(params);
  const {
    select = "*",
    includeDeleted = false,
    orderBy = "risk_score",
    ascending = orderBy === "company_name",
    limit,
  } = params || {};

  let query = supabase
    .from("isgkatip_companies")
    .select(select)
    .eq("org_id", organizationId);

  if (!includeDeleted) {
    query = query.eq("is_deleted", false);
  }

  query = query.order(orderBy, { ascending });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return castRows<IsgkatipCompanyRow>(data as unknown);
};

export const listIsgkatipComplianceFlags = async (
  params?: ScopeParams & {
    select?: string;
    status?: string;
    severity?: string;
    orderByCreatedAtDesc?: boolean;
    limit?: number;
  },
): Promise<IsgkatipFlagRow[]> => {
  const organizationId = await resolveOrganizationId(params);
  const {
    select = "*",
    status,
    severity,
    orderByCreatedAtDesc = true,
    limit,
  } = params || {};

  let query = supabase
    .from("isgkatip_compliance_flags")
    .select(select)
    .eq("org_id", organizationId);

  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);

  if (orderByCreatedAtDesc) {
    query = query.order("created_at", { ascending: false });
  }

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return castRows<IsgkatipFlagRow>(data as unknown);
};

export const listIsgkatipPredictiveAlerts = async (
  params?: ScopeParams & {
    select?: string;
    status?: string;
    orderBy?: "created_at" | "severity";
    ascending?: boolean;
    limit?: number;
  },
): Promise<IsgkatipAlertRow[]> => {
  const organizationId = await resolveOrganizationId(params);
  const {
    select = "*",
    status,
    orderBy = "created_at",
    ascending = false,
    limit,
  } = params || {};

  let query = supabase
    .from("isgkatip_predictive_alerts")
    .select(select)
    .eq("org_id", organizationId);

  if (status) query = query.eq("status", status);

  query = query.order(orderBy, { ascending });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return castRows<IsgkatipAlertRow>(data as unknown);
};

export const listIsgkatipSyncLogs = async (
  params?: ScopeParams & {
    select?: string;
    limit?: number;
  },
): Promise<IsgkatipSyncLogRow[]> => {
  const organizationId = await resolveOrganizationId(params);
  const { select = "*", limit = 12 } = params || {};

  const { data, error } = await supabase
    .from("isgkatip_sync_logs")
    .select(select)
    .eq("org_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return castRows<IsgkatipSyncLogRow>(data as unknown);
};

export const listIsgkatipDeletedCompaniesView = async (
  params?: ScopeParams & {
    select?: string;
    restoredOnly?: boolean;
  },
): Promise<IsgkatipDeletedCompanyViewRow[]> => {
  const organizationId = await resolveOrganizationId(params);
  const { select = "*", restoredOnly = false } = params || {};

  let query = supabase
    .from("isgkatip_deleted_companies_view")
    .select(select)
    .eq("org_id", organizationId);

  query = restoredOnly
    ? query.not("restored_at", "is", null)
    : query.is("restored_at", null);

  const { data, error } = await query.order("deleted_at", {
    ascending: false,
  });

  if (error) throw error;

  return castRows<IsgkatipDeletedCompanyViewRow>(data as unknown);
};