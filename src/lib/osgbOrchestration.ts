/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import {
  listIsgkatipCompanies,
  listIsgkatipComplianceFlags,
  listIsgkatipSyncLogs,
} from "@/domain/isgkatip/isgkatipQueries";
import {
  getOsgbPlatformDashboard,
  listOsgbFieldVisitsWorkspace,
  listOsgbFinanceWorkspace,
  listOsgbRequiredDocumentsWorkspace,
  type OsgbFieldVisitRecord,
  type OsgbRequiredDocumentRecord,
} from "@/lib/osgbPlatform";

export interface OsgbIsgKatipCompanyHealth {
  id: string;
  companyName: string;
  sgkNo: string | null;
  employeeCount: number;
  hazardClass: string | null;
  contractEnd: string | null;
  assignedMinutes: number;
  requiredMinutes: number;
  lastSyncedAt: string | null;
  flagCount: number;
  criticalFlagCount: number;
  needsAttention: boolean;
}

export interface OsgbIsgKatipSyncLog {
  id: string;
  action: string;
  status: string;
  source: string | null;
  createdAt: string;
  details: Record<string, any>;
}

export interface OsgbIsgKatipWorkspace {
  summary: {
    companyCount: number;
    criticalCompanies: number;
    openFlags: number;
    lastSyncAt: string | null;
  };
  extension: {
    isConnected: boolean;
    sourceMode: "organization" | "member_extension" | "none";
    sourceMemberCount: number;
    lastSyncAt: string | null;
    companyCount: number;
  };
  companies: OsgbIsgKatipCompanyHealth[];
  logs: OsgbIsgKatipSyncLog[];
}

export type OsgbAutomationKind = "document" | "finance" | "field_visit";

export interface OsgbAutomationAction {
  key: string;
  kind: OsgbAutomationKind;
  companyId: string;
  companyName: string;
  title: string;
  reason: string;
  actionLabel: string;
  priority: "medium" | "high" | "critical";
  dueDate: string | null;
  actionUrl: string;
}

export interface OsgbAutomationWorkspace {
  summary: {
    pendingActions: number;
    overdueDocuments: number;
    missingProofVisits: number;
    latePayers: number;
    openAutomationTasks: number;
  };
  actions: OsgbAutomationAction[];
}

export interface OsgbClientPortalLinkRecord {
  id: string;
  companyId: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  portalStatus: "active" | "paused" | "revoked";
  accessToken: string;
  expiresAt: string | null;
  lastViewedAt: string | null;
  overdueDocuments: number;
  openBalance: number;
}

export interface OsgbClientPortalWorkspace {
  links: OsgbClientPortalLinkRecord[];
  summary: {
    activeLinks: number;
    viewedLinks: number;
    companiesCovered: number;
  };
}

export interface OsgbClientPortalUploadRecord {
  id: string;
  portalLinkId: string;
  companyId: string;
  companyName: string;
  requiredDocumentId: string | null;
  documentType: string | null;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number;
  note: string | null;
  submittedByName: string | null;
  submittedByEmail: string | null;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface OsgbExternalIntegrationRecord {
  id: string;
  organizationId: string;
  provider: "rest_api" | "custom_isgkatip";
  integrationName: string;
  baseUrl: string;
  apiPath: string;
  sourceKey: string | null;
  status: "active" | "inactive" | "error";
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface OsgbPublicClientPortalSnapshot {
  company: {
    id: string;
    companyName: string;
    hazardClass: string | null;
    employeeCount: number;
  };
  meta: {
    organizationName: string;
    contactName: string | null;
    contactEmail: string | null;
    expiresAt: string | null;
  };
  documents: Array<{
    id: string;
    documentType: string;
    requiredReason: string;
    riskIfMissing: string | null;
    dueDate: string | null;
    status: string;
    delayDays: number;
    riskLevel: string;
  }>;
  visits: Array<{
    id: string;
    plannedAt: string;
    completedAt: string | null;
    status: string;
    visitType: string;
    serviceSummary: string | null;
    nextActionSummary: string | null;
  }>;
  finance: {
    currentBalance: number;
    overdueBalance: number;
    collectionRiskScore: number;
    profitabilityScore: number;
  };
  uploads: Array<{
    id: string;
    fileName: string;
    note: string | null;
    reviewStatus: "pending" | "approved" | "rejected";
    reviewNote: string | null;
    submittedByName: string | null;
    submittedByEmail: string | null;
    createdAt: string;
    documentType: string | null;
  }>;
}

const portalUploadFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/osgb-client-portal-upload`;

const normalizePriority = (value: number) => {
  if (value >= 80) return "critical";
  if (value >= 50) return "high";
  return "medium";
};

const mapVisitAutomation = (visit: OsgbFieldVisitRecord): OsgbAutomationAction => ({
  key: `visit:${visit.id}`,
  kind: "field_visit",
  companyId: visit.companyId,
  companyName: visit.companyName,
  title: `${visit.companyName} ziyaret kaydi tamamlandi ama kanit seviyesi dusuk kaldi.`,
  reason: visit.proofMissingReasons.join(" | ") || "Check-in, check-out veya kanit dosyalari eksik.",
  actionLabel: "Kaniti tamamla",
  priority: visit.proofScore < 20 ? "critical" : "high",
  dueDate: visit.completedAt?.slice(0, 10) || visit.plannedAt.slice(0, 10),
  actionUrl: "/osgb/field-visits",
});

const mapDocumentAutomation = (document: OsgbRequiredDocumentRecord): OsgbAutomationAction => ({
  key: `document:${document.id}`,
  kind: "document",
  companyId: document.companyId,
  companyName: document.companyName,
  title: `${document.companyName} icin ${document.documentType} belgesi bekleniyor.`,
  reason: document.riskIfMissing || document.requiredReason,
  actionLabel: "Belge gorevi olustur",
  priority: document.riskLevel === "critical" ? "critical" : "high",
  dueDate: document.dueDate,
  actionUrl: "/osgb/documents",
});

export const listOsgbIsgKatipWorkspace = async (
  organizationId: string,
): Promise<OsgbIsgKatipWorkspace> => {
  const [companiesResponse, flagsResponse, logsResponse] = await Promise.all([
    listIsgkatipCompanies({
      organizationId,
      select:
        "id, org_id, company_name, sgk_no, employee_count, hazard_class, contract_end, assigned_minutes, required_minutes, last_synced_at",
      includeDeleted: true,
      orderBy: "company_name",
    }),
    listIsgkatipComplianceFlags({
      organizationId,
      select: "id, company_id, severity, status",
      status: "OPEN",
      orderByCreatedAtDesc: false,
    }),
    listIsgkatipSyncLogs({
      organizationId,
      select: "id, action, status, source, created_at, details",
      limit: 12,
    }),
  ]);

  const flagCounts = new Map<string, { total: number; critical: number }>();
  for (const row of flagsResponse ?? []) {
    const current = flagCounts.get(row.company_id) || { total: 0, critical: 0 };
    current.total += 1;
    if (String(row.severity || "").toUpperCase() === "CRITICAL") current.critical += 1;
    flagCounts.set(row.company_id, current);
  }

  const dedupedRows = new Map<string, any>();
  for (const row of companiesResponse ?? []) {
    const key = row.sgk_no || `${row.company_name}-${row.id}`;
    const current = dedupedRows.get(key);
    if (!current) {
      dedupedRows.set(key, row);
      continue;
    }

    const currentIsOrg = current.org_id === organizationId;
    const nextIsOrg = row.org_id === organizationId;
    if (!currentIsOrg && nextIsOrg) {
      dedupedRows.set(key, row);
      continue;
    }

    const currentSync = current.last_synced_at ? new Date(current.last_synced_at).getTime() : 0;
    const nextSync = row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
    if (nextSync > currentSync) {
      dedupedRows.set(key, row);
    }
  }

  const companies: OsgbIsgKatipCompanyHealth[] = Array.from(dedupedRows.values()).map((row: any) => {
    const counts = flagCounts.get(row.id) || { total: 0, critical: 0 };
    return {
      id: row.id,
      companyName: row.company_name || "Firma",
      sgkNo: row.sgk_no || null,
      employeeCount: Number(row.employee_count || 0),
      hazardClass: row.hazard_class || null,
      contractEnd: row.contract_end || null,
      assignedMinutes: Number(row.assigned_minutes || 0),
      requiredMinutes: Number(row.required_minutes || 0),
      lastSyncedAt: row.last_synced_at || null,
      flagCount: counts.total,
      criticalFlagCount: counts.critical,
      needsAttention: counts.critical > 0 || Number(row.assigned_minutes || 0) < Number(row.required_minutes || 0),
    };
  });

  const logs: OsgbIsgKatipSyncLog[] = (logsResponse ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    status: row.status,
    source: row.source || null,
    createdAt: row.created_at,
    details: row.details || {},
  }));

  const lastSyncAt = logs[0]?.createdAt || companies.map((company) => company.lastSyncedAt).filter(Boolean).sort().at(-1) || null;

  return {
    summary: {
      companyCount: companies.length,
      criticalCompanies: companies.filter((company) => company.needsAttention).length,
      openFlags: (flagsResponse ?? []).length,
      lastSyncAt,
    },
    extension: {
      isConnected: companies.length > 0 || logs.length > 0,
      sourceMode: companies.length > 0 || logs.length > 0 ? "organization" : "none",
      sourceMemberCount: 0,
      lastSyncAt,
      companyCount: companies.length,
    },
    companies,
    logs,
  };
};

export const runOsgbIsgKatipSyncRefresh = async (
  organizationId: string,
  userId: string,
) => {
  const companies = await listIsgkatipCompanies({
    organizationId,
    select: "sgk_no, company_name, employee_count, hazard_class, contract_start, contract_end, assigned_minutes",
    includeDeleted: true,
    orderBy: "company_name",
  });
  if (!(companies ?? []).length) {
    throw new Error("Senkronizasyon icin once ISGBot Chrome Extension ile firma verisi alinmis olmali.");
  }

  const { data, error } = await supabase.functions.invoke("isgkatip-sync", {
    body: {
      action: "BATCH_SYNC",
      data: {
        orgId: organizationId,
        userId,
        source: "osgb_sync_center",
        companies: (companies ?? []).map((company: any) => ({
          sgkNo: company.sgk_no,
          companyName: company.company_name,
          employeeCount: Number(company.employee_count || 0),
          hazardClass: company.hazard_class,
          contractStart: company.contract_start || null,
          contractEnd: company.contract_end || null,
          assignedMinutes: Number(company.assigned_minutes || 0),
        })),
      },
    },
  });

  if (error) throw error;
  if (data?.success === false) {
    throw new Error(data.error || "ISG-KATIP senkronizasyonu basarisiz oldu.");
  }

  return data?.summary || { total: companies.length, success: companies.length, errors: 0 };
};

export const listOsgbAutomationWorkspace = async (
  organizationId: string,
  userId: string,
): Promise<OsgbAutomationWorkspace> => {
  const [visits, documents, finance, tasks] = await Promise.all([
    listOsgbFieldVisitsWorkspace(organizationId),
    listOsgbRequiredDocumentsWorkspace(organizationId, userId),
    listOsgbFinanceWorkspace(organizationId, userId),
    (supabase as any)
      .from("osgb_tasks")
      .select("id")
      .eq("organization_id", organizationId)
      .like("source", "automation_%")
      .in("status", ["open", "in_progress"]),
  ]);

  if (tasks.error) throw tasks.error;

  const actions: OsgbAutomationAction[] = [];

  for (const visit of visits.visits.filter((item) => item.status === "completed" && !item.hasEnoughEvidence)) {
    actions.push(mapVisitAutomation(visit));
  }

  for (const document of documents.documents.filter((item) => item.status === "missing" && (item.delayDays > 0 || item.riskLevel === "critical" || item.riskLevel === "high"))) {
    actions.push(mapDocumentAutomation(document));
  }

  for (const company of finance.companies.filter((item) => item.overdueBalance > 0 || item.lateInvoiceCount > 0)) {
    actions.push({
      key: `finance:${company.companyId}`,
      kind: "finance",
      companyId: company.companyId,
      companyName: company.companyName,
      title: `${company.companyName} icin gecikmis tahsilat gorunuyor.`,
      reason: `${company.lateInvoiceCount} acik fatura ve ${company.overdueBalance.toLocaleString("tr-TR")} TL gecikmis bakiye var.`,
      actionLabel: "Tahsilat gorevi olustur",
      priority: normalizePriority(company.collectionRiskScore),
      dueDate: null,
      actionUrl: "/osgb/finance",
    });
  }

  return {
    summary: {
      pendingActions: actions.length,
      overdueDocuments: documents.documents.filter((item) => item.status === "missing" && item.delayDays > 0).length,
      missingProofVisits: visits.visits.filter((item) => item.status === "completed" && !item.hasEnoughEvidence).length,
      latePayers: finance.companies.filter((item) => item.lateInvoiceCount > 0).length,
      openAutomationTasks: (tasks.data ?? []).length,
    },
    actions,
  };
};

export const runOsgbAutomationBatch = async (
  organizationId: string,
  userId: string,
) => {
  const { data, error } = await supabase.functions.invoke("osgb-automation-batch", {
    body: {
      organizationId,
      userId,
      source: "automation_center",
    },
  });

  if (error) throw error;
  if (data?.success === false) {
    throw new Error(data.error || "Otomasyon batch calistirilamadi.");
  }

  const workspace = await listOsgbAutomationWorkspace(organizationId, userId);

  return {
    createdTasks: Number(data?.createdTasks || 0),
    suggestedActions: workspace.actions.length,
  };
};

const createPortalToken = () => crypto.randomUUID().replace(/-/g, "");

export const listOsgbClientPortalWorkspace = async (
  organizationId: string,
): Promise<OsgbClientPortalWorkspace> => {
  const [linksResponse, documentsResponse, accountsResponse] = await Promise.all([
    (supabase as any)
      .from("osgb_client_portal_links")
      .select("id, company_id, access_token, contact_name, contact_email, portal_status, expires_at, last_viewed_at, company:isgkatip_companies(company_name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("osgb_required_documents")
      .select("company_id, status, delay_days")
      .eq("organization_id", organizationId),
    (supabase as any)
      .from("osgb_finance_accounts")
      .select("company_id, overdue_balance")
      .eq("organization_id", organizationId),
  ]);

  if (linksResponse.error) throw linksResponse.error;
  if (documentsResponse.error) throw documentsResponse.error;
  if (accountsResponse.error) throw accountsResponse.error;

  const overdueDocsByCompany = new Map<string, number>();
  for (const row of documentsResponse.data ?? []) {
    if (row.status !== "missing" || Number(row.delay_days || 0) <= 0) continue;
    overdueDocsByCompany.set(row.company_id, (overdueDocsByCompany.get(row.company_id) || 0) + 1);
  }

  const openBalanceByCompany = new Map<string, number>();
  for (const row of accountsResponse.data ?? []) {
    openBalanceByCompany.set(row.company_id, Number(row.overdue_balance || 0));
  }

  const links: OsgbClientPortalLinkRecord[] = (linksResponse.data ?? []).map((row: any) => ({
    id: row.id,
    companyId: row.company_id,
    companyName: row.company?.company_name || "Firma",
    contactName: row.contact_name || null,
    contactEmail: row.contact_email || null,
    portalStatus: row.portal_status,
    accessToken: row.access_token,
    expiresAt: row.expires_at || null,
    lastViewedAt: row.last_viewed_at || null,
    overdueDocuments: overdueDocsByCompany.get(row.company_id) || 0,
    openBalance: openBalanceByCompany.get(row.company_id) || 0,
  }));

  return {
    links,
    summary: {
      activeLinks: links.filter((link) => link.portalStatus === "active").length,
      viewedLinks: links.filter((link) => Boolean(link.lastViewedAt)).length,
      companiesCovered: new Set(links.map((link) => link.companyId)).size,
    },
  };
};

export const createOsgbClientPortalLink = async (
  userId: string,
  organizationId: string,
  input: {
    companyId: string;
    contactName?: string | null;
    contactEmail?: string | null;
    expiresAt?: string | null;
  },
) => {
  const payload = {
    organization_id: organizationId,
    company_id: input.companyId,
    access_token: createPortalToken(),
    contact_name: input.contactName || null,
    contact_email: input.contactEmail || null,
    expires_at: input.expiresAt || null,
    created_by: userId,
  };

  const { data, error } = await (supabase as any)
    .from("osgb_client_portal_links")
    .insert(payload)
    .select("id, access_token")
    .single();

  if (error) throw error;
  return data as { id: string; access_token: string };
};

export const updateOsgbClientPortalLinkStatus = async (
  organizationId: string,
  linkId: string,
  status: "active" | "paused" | "revoked",
) => {
  const { error } = await (supabase as any)
    .from("osgb_client_portal_links")
    .update({
      portal_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", linkId)
    .eq("organization_id", organizationId);

  if (error) throw error;
};

export const getOsgbClientPortalSnapshot = async (
  token: string,
): Promise<OsgbPublicClientPortalSnapshot | null> => {
  const { data, error } = await supabase.rpc("get_osgb_client_portal_snapshot", {
    p_token: token,
  });

  if (error) throw error;
  if (!data) return null;

  return data as OsgbPublicClientPortalSnapshot;
};

export const listOsgbClientPortalUploads = async (
  organizationId: string,
): Promise<OsgbClientPortalUploadRecord[]> => {
  const { data, error } = await (supabase as any)
    .from("osgb_client_portal_uploads")
    .select(`
      id,
      portal_link_id,
      company_id,
      required_document_id,
      file_name,
      file_path,
      mime_type,
      file_size,
      note,
      submitted_by_name,
      submitted_by_email,
      review_status,
      reviewed_at,
      review_note,
      created_at,
      company:isgkatip_companies(company_name),
      document:osgb_required_documents(document_type)
    `)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    portalLinkId: row.portal_link_id,
    companyId: row.company_id,
    companyName: row.company?.company_name || "Firma",
    requiredDocumentId: row.required_document_id || null,
    documentType: row.document?.document_type || null,
    fileName: row.file_name,
    filePath: row.file_path,
    mimeType: row.mime_type || null,
    fileSize: Number(row.file_size || 0),
    note: row.note || null,
    submittedByName: row.submitted_by_name || null,
    submittedByEmail: row.submitted_by_email || null,
    reviewStatus: row.review_status,
    reviewedAt: row.reviewed_at || null,
    reviewNote: row.review_note || null,
    createdAt: row.created_at,
  }));
};

export const submitOsgbClientPortalUpload = async (input: {
  token: string;
  file: File;
  requiredDocumentId?: string | null;
  submittedByName?: string | null;
  submittedByEmail?: string | null;
  note?: string | null;
}) => {
  const formData = new FormData();
  formData.append("token", input.token);
  formData.append("file", input.file);
  if (input.requiredDocumentId) formData.append("requiredDocumentId", input.requiredDocumentId);
  if (input.submittedByName) formData.append("submittedByName", input.submittedByName);
  if (input.submittedByEmail) formData.append("submittedByEmail", input.submittedByEmail);
  if (input.note) formData.append("note", input.note);

  const response = await fetch(portalUploadFunctionUrl, {
    method: "POST",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || "Dosya portala yuklenemedi.");
  }

  return payload;
};

export const reviewOsgbClientPortalUpload = async (
  organizationId: string,
  userId: string,
  uploadId: string,
  status: "approved" | "rejected",
  reviewNote?: string | null,
) => {
  const { data: upload, error: uploadError } = await (supabase as any)
    .from("osgb_client_portal_uploads")
    .update({
      review_status: status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", uploadId)
    .select("id, required_document_id")
    .single();

  if (uploadError) throw uploadError;

  if (upload?.required_document_id) {
    const { error: documentError } = await (supabase as any)
      .from("osgb_required_documents")
      .update({
        status: status === "approved" ? "approved" : "missing",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", upload.required_document_id);

    if (documentError) throw documentError;
  }

  return upload;
};

export const getOsgbClientPortalUploadSignedUrl = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from("osgb-client-portal")
    .createSignedUrl(filePath, 60 * 30);

  if (error) throw error;
  return data?.signedUrl || null;
};

export const listOsgbClientPortalCompanyOptions = async (organizationId: string) => {
  const dashboard = await getOsgbPlatformDashboard(organizationId, { refreshCompliance: false });
  return dashboard.complianceRows.map((row) => ({
    companyId: row.companyId,
    companyName: row.companyName,
    hazardClass: row.hazardClass,
    deficitMinutes: row.deficitMinutes,
  }));
};

export const listOsgbExternalIntegrations = async (
  organizationId: string,
): Promise<OsgbExternalIntegrationRecord[]> => {
  const { data, error } = await (supabase as any)
    .from("osgb_external_integrations")
    .select("id, organization_id, provider, integration_name, base_url, api_path, source_key, status, last_synced_at, last_error, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    provider: row.provider,
    integrationName: row.integration_name,
    baseUrl: row.base_url,
    apiPath: row.api_path,
    sourceKey: row.source_key || null,
    status: row.status,
    lastSyncedAt: row.last_synced_at || null,
    lastError: row.last_error || null,
    createdAt: row.created_at,
  }));
};

export const upsertOsgbExternalIntegration = async (
  userId: string,
  organizationId: string,
  input: {
    provider: "rest_api" | "custom_isgkatip";
    integrationName: string;
    baseUrl: string;
    apiPath: string;
    sourceKey?: string | null;
    status?: "active" | "inactive" | "error";
  },
  id?: string,
) => {
  const payload = {
    organization_id: organizationId,
    provider: input.provider,
    integration_name: input.integrationName,
    base_url: input.baseUrl,
    api_path: input.apiPath,
    source_key: input.sourceKey || null,
    status: input.status || "active",
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? (supabase as any).from("osgb_external_integrations").update(payload).eq("organization_id", organizationId).eq("id", id)
    : (supabase as any).from("osgb_external_integrations").insert(payload);

  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return data;
};

export const pullOsgbExternalIntegration = async (
  organizationId: string,
  userId: string,
  integrationId?: string,
) => {
  const { data, error } = await supabase.functions.invoke("isgkatip-sync", {
    body: {
      action: "PULL_REMOTE_AND_SYNC",
      data: {
        orgId: organizationId,
        userId,
        source: "osgb_sync_center",
        integrationId: integrationId || null,
      },
    },
  });

  if (error) throw error;
  if (data?.success === false) {
    throw new Error(data.error || "Dis kaynaktan veri cekilemedi.");
  }

  return data;
};
