import { supabase } from "@/integrations/supabase/client";
import {
  createOsgbTask,
  getOsgbCompanyOptions,
  type OsgbCompanyOption,
} from "@/lib/osgbOperations";

type IncidentLooseClient = typeof supabase & {
  from: (table: string) => {
    select: (...args: unknown[]) => IncidentQueryBuilder;
    insert: (value: unknown) => IncidentMutationBuilder;
    update: (value: unknown) => IncidentMutationBuilder;
    delete: () => IncidentMutationBuilder;
  };
};

type IncidentQueryBuilder = {
  eq: (column: string, value: unknown) => IncidentQueryBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => PromiseLike<{ data: unknown[] | null; error: Error | null }> & IncidentQueryBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
  select: (...args: unknown[]) => IncidentQueryBuilder;
};

type IncidentMutationBuilder = {
  eq: (column: string, value: unknown) => IncidentMutationBuilder;
  select: (...args: unknown[]) => IncidentMutationBuilder;
  single: () => Promise<{ data: unknown; error: Error | null }>;
  then?: Promise<unknown>["then"];
};

const db = supabase as IncidentLooseClient;

export type IncidentType = "work_accident" | "near_miss";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "action_required" | "closed";
export type IncidentActionStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled";
export type IncidentRootCauseCategory =
  | "human_error"
  | "unsafe_condition"
  | "training_gap"
  | "process_gap"
  | "equipment_failure"
  | "environmental_factor"
  | "contractor_issue"
  | "other";
export type IncidentClosureDecision =
  | "monitor_only"
  | "training_action"
  | "process_revision"
  | "capa_required";

interface IncidentCompanyRelation {
  company_name: string | null;
}

interface IncidentReportRow {
  id: string;
  user_id: string;
  company_id: string | null;
  incident_type: IncidentType;
  title: string;
  description: string;
  incident_date: string;
  location: string | null;
  affected_person: string | null;
  severity: IncidentSeverity;
  root_cause: string | null;
  immediate_action: string | null;
  corrective_action: string | null;
  status: IncidentStatus;
  reported_by: string | null;
  witness_info: string | null;
  accident_category: string | null;
  root_cause_category: IncidentRootCauseCategory | null;
  lost_time_days: number | null;
  requires_notification: boolean | null;
  closure_summary: string | null;
  closure_decision: IncidentClosureDecision | null;
  closure_notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
  capa_record_id: string | null;
  created_at: string;
  updated_at: string;
  company?: IncidentCompanyRelation | IncidentCompanyRelation[] | null;
}

interface IncidentAttachmentRow {
  id: string;
  report_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface IncidentActionRow {
  id: string;
  report_id: string;
  user_id: string;
  action_title: string;
  owner_name: string | null;
  due_date: string | null;
  status: IncidentActionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentReportRecord {
  id: string;
  user_id: string;
  company_id: string | null;
  incident_type: IncidentType;
  title: string;
  description: string;
  incident_date: string;
  location: string | null;
  affected_person: string | null;
  severity: IncidentSeverity;
  root_cause: string | null;
  immediate_action: string | null;
  corrective_action: string | null;
  status: IncidentStatus;
  reported_by: string | null;
  witness_info: string | null;
  accident_category: string | null;
  root_cause_category: IncidentRootCauseCategory | null;
  lost_time_days: number;
  requires_notification: boolean;
  closure_summary: string | null;
  closure_decision: IncidentClosureDecision | null;
  closure_notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
  capa_record_id: string | null;
  created_at: string;
  updated_at: string;
  company?: IncidentCompanyRelation | null;
}

export interface IncidentAttachmentRecord {
  id: string;
  report_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface IncidentActionRecord {
  id: string;
  report_id: string;
  user_id: string;
  action_title: string;
  owner_name: string | null;
  due_date: string | null;
  status: IncidentActionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentFormInput {
  companyId?: string | null;
  incidentType: IncidentType;
  title: string;
  description: string;
  incidentDate: string;
  location?: string | null;
  affectedPerson?: string | null;
  severity: IncidentSeverity;
  rootCause?: string | null;
  immediateAction?: string | null;
  correctiveAction?: string | null;
  status: IncidentStatus;
  reportedBy?: string | null;
  witnessInfo?: string | null;
  accidentCategory?: string | null;
  rootCauseCategory?: IncidentRootCauseCategory | null;
  lostTimeDays?: number;
  requiresNotification?: boolean;
  closureSummary?: string | null;
  closureDecision?: IncidentClosureDecision | null;
  closureNotes?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  capaRecordId?: string | null;
}

export interface IncidentActionInput {
  actionTitle: string;
  ownerName?: string | null;
  dueDate?: string | null;
  status?: IncidentActionStatus;
  notes?: string | null;
}

export interface IncidentClosureInput {
  status: "closed";
  closureSummary: string;
  closureDecision: IncidentClosureDecision;
  closureNotes?: string | null;
  createCapa?: boolean;
}

export interface IncidentReportPageParams {
  page: number;
  pageSize: number;
  search?: string;
  type?: IncidentType | "ALL";
  status?: IncidentStatus | "ALL";
}

export interface PagedIncidentReportResult {
  rows: IncidentReportRecord[];
  count: number;
}

const ensureIncidentReportRow = (row: unknown): IncidentReportRow =>
  row as IncidentReportRow;

const ensureIncidentAttachmentRow = (row: unknown): IncidentAttachmentRow =>
  row as IncidentAttachmentRow;

const ensureIncidentActionRow = (row: unknown): IncidentActionRow =>
  row as IncidentActionRow;

const normalizeCompany = (
  company: IncidentReportRow["company"],
): IncidentCompanyRelation | null => {
  if (!company) return null;
  return Array.isArray(company) ? company[0] ?? null : company;
};

const mapIncident = (row: IncidentReportRow): IncidentReportRecord => ({
  id: row.id,
  user_id: row.user_id,
  company_id: row.company_id,
  incident_type: row.incident_type,
  title: row.title,
  description: row.description,
  incident_date: row.incident_date,
  location: row.location,
  affected_person: row.affected_person,
  severity: row.severity,
  root_cause: row.root_cause,
  immediate_action: row.immediate_action,
  corrective_action: row.corrective_action,
  status: row.status,
  reported_by: row.reported_by,
  witness_info: row.witness_info,
  accident_category: row.accident_category,
  root_cause_category: row.root_cause_category,
  lost_time_days: Number(row.lost_time_days ?? 0),
  requires_notification: Boolean(row.requires_notification),
  closure_summary: row.closure_summary,
  closure_decision: row.closure_decision,
  closure_notes: row.closure_notes,
  closed_at: row.closed_at,
  closed_by: row.closed_by,
  capa_record_id: row.capa_record_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  company: normalizeCompany(row.company),
});

const mapAttachment = (row: IncidentAttachmentRow): IncidentAttachmentRecord => ({
  id: row.id,
  report_id: row.report_id,
  user_id: row.user_id,
  file_name: row.file_name,
  file_path: row.file_path,
  file_size: row.file_size == null ? null : Number(row.file_size),
  mime_type: row.mime_type,
  created_at: row.created_at,
});

const mapAction = (row: IncidentActionRow): IncidentActionRecord => ({
  id: row.id,
  report_id: row.report_id,
  user_id: row.user_id,
  action_title: row.action_title,
  owner_name: row.owner_name,
  due_date: row.due_date,
  status: row.status,
  notes: row.notes,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const getIncidentCompanyOptions = async (
  userId: string,
): Promise<OsgbCompanyOption[]> => getOsgbCompanyOptions(userId);

export const listIncidentReports = async (
  userId: string,
): Promise<IncidentReportRecord[]> => {
  const { data, error } = await db
    .from("incident_reports")
    .select("*, company:isgkatip_companies(company_name)")
    .eq("user_id", userId)
    .order("incident_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapIncident(ensureIncidentReportRow(row)));
};

export const listIncidentReportsPage = async (
  userId: string,
  params: IncidentReportPageParams,
): Promise<PagedIncidentReportResult> => {
  const { page, pageSize, search, type, status } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("incident_reports")
    .select("*, company:isgkatip_companies(company_name)", { count: "exact" })
    .eq("user_id", userId);

  if (type && type !== "ALL") {
    query = query.eq("incident_type", type);
  }

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }

  if (search?.trim()) {
    const term = search.trim();
    query = query.or(
      `title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%,affected_person.ilike.%${term}%,reported_by.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query
    .order("incident_date", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    rows: (data ?? []).map((row: unknown) => mapIncident(ensureIncidentReportRow(row))),
    count: count ?? 0,
  };
};

export const upsertIncidentReport = async (
  userId: string,
  input: IncidentFormInput,
  reportId?: string,
): Promise<IncidentReportRecord> => {
  const payload = {
    user_id: userId,
    company_id: input.companyId || null,
    incident_type: input.incidentType,
    title: input.title.trim(),
    description: input.description.trim(),
    incident_date: input.incidentDate,
    location: input.location?.trim() || null,
    affected_person: input.affectedPerson?.trim() || null,
    severity: input.severity,
    root_cause: input.rootCause?.trim() || null,
    immediate_action: input.immediateAction?.trim() || null,
    corrective_action: input.correctiveAction?.trim() || null,
    status: input.status,
    reported_by: input.reportedBy?.trim() || null,
    witness_info: input.witnessInfo?.trim() || null,
    accident_category: input.accidentCategory?.trim() || null,
    root_cause_category: input.rootCauseCategory || null,
    lost_time_days: input.lostTimeDays ?? 0,
    requires_notification: Boolean(input.requiresNotification),
    closure_summary: input.status === "closed" ? input.closureSummary?.trim() || null : null,
    closure_decision: input.status === "closed" ? input.closureDecision || null : null,
    closure_notes: input.status === "closed" ? input.closureNotes?.trim() || null : null,
    closed_at: input.status === "closed" ? input.closedAt || new Date().toISOString() : null,
    closed_by: input.status === "closed" ? input.closedBy || userId : null,
    capa_record_id: input.capaRecordId || null,
  };

  const query = reportId
    ? db.from("incident_reports").update(payload).eq("id", reportId)
    : db.from("incident_reports").insert(payload);

  const { data, error } = await query
    .select("*, company:isgkatip_companies(company_name)")
    .single();

  if (error) throw error;
  return mapIncident(ensureIncidentReportRow(data));
};

export const deleteIncidentReport = async (id: string): Promise<void> => {
  const { error } = await db.from("incident_reports").delete().eq("id", id);
  if (error) throw error;
};

export const listIncidentAttachments = async (
  reportId: string,
): Promise<IncidentAttachmentRecord[]> => {
  const { data, error } = await db
    .from("incident_attachments")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) =>
    mapAttachment(ensureIncidentAttachmentRow(row)),
  );
};

export const uploadIncidentAttachment = async (
  userId: string,
  reportId: string,
  file: File,
): Promise<IncidentAttachmentRecord> => {
  const safeFileName = `${userId}/${reportId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const { error: uploadError } = await supabase.storage
    .from("incident-files")
    .upload(safeFileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data, error } = await db
    .from("incident_attachments")
    .insert({
      user_id: userId,
      report_id: reportId,
      file_name: file.name,
      file_path: safeFileName,
      file_size: file.size,
      mime_type: file.type || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapAttachment(ensureIncidentAttachmentRow(data));
};

export const getIncidentAttachmentDownloadUrl = async (
  filePath: string,
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from("incident-files")
    .createSignedUrl(filePath, 3600);

  if (error) throw error;
  return data.signedUrl;
};

export const deleteIncidentAttachment = async (
  attachment: IncidentAttachmentRecord,
): Promise<void> => {
  const { error } = await db
    .from("incident_attachments")
    .delete()
    .eq("id", attachment.id);

  if (error) throw error;
  await supabase.storage.from("incident-files").remove([attachment.file_path]);
};

export const listIncidentActions = async (
  reportId: string,
): Promise<IncidentActionRecord[]> => {
  const { data, error } = await db
    .from("incident_actions")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapAction(ensureIncidentActionRow(row)));
};

export const upsertIncidentAction = async (
  userId: string,
  reportId: string,
  input: IncidentActionInput,
  actionId?: string,
): Promise<IncidentActionRecord> => {
  const payload = {
    user_id: userId,
    report_id: reportId,
    action_title: input.actionTitle.trim(),
    owner_name: input.ownerName?.trim() || null,
    due_date: input.dueDate || null,
    status: input.status || "open",
    notes: input.notes?.trim() || null,
  };

  const query = actionId
    ? db.from("incident_actions").update(payload).eq("id", actionId)
    : db.from("incident_actions").insert(payload);

  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return mapAction(ensureIncidentActionRow(data));
};

export const deleteIncidentAction = async (id: string): Promise<void> => {
  const { error } = await db.from("incident_actions").delete().eq("id", id);
  if (error) throw error;
};

export const updateIncidentActionStatus = async (
  actionId: string,
  status: IncidentActionStatus,
): Promise<IncidentActionRecord> => {
  const { data, error } = await db
    .from("incident_actions")
    .update({ status })
    .eq("id", actionId)
    .select("*")
    .single();

  if (error) throw error;
  return mapAction(ensureIncidentActionRow(data));
};

const getOrganizationId = async (userId: string): Promise<string> => {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return profile?.organization_id || userId;
};

export const createIncidentCapaRecord = async (
  userId: string,
  incident: IncidentReportRecord,
): Promise<string> => {
  const orgId = await getOrganizationId(userId);

  const { data, error } = await supabase
    .from("capa_records")
    .insert({
      org_id: orgId,
      user_id: userId,
      non_conformity: `[${incident.incident_type === "work_accident" ? "İş Kazası" : "Ramak Kala"}] ${incident.title}`,
      root_cause: incident.root_cause || "Incident kaydından otomatik oluşturuldu.",
      corrective_action:
        incident.corrective_action ||
        incident.immediate_action ||
        "Düzeltici faaliyet planı incident kaydı üzerinden netleştirilecektir.",
      assigned_person: incident.reported_by || incident.affected_person || "Atanmadı",
      deadline: new Date(
        Date.now() +
          (incident.severity === "critical"
            ? 3
            : incident.severity === "high"
              ? 5
              : 7) *
            24 *
            60 *
            60 *
            1000,
      )
        .toISOString()
        .slice(0, 10),
      status: "Açık",
      priority:
        incident.severity === "critical"
          ? "Kritik"
          : incident.severity === "high"
            ? "Yüksek"
            : incident.severity === "medium"
              ? "Orta"
              : "Düşük",
      notes: [
        `Incident kaydı: ${incident.title}`,
        `Olay tarihi: ${new Date(incident.incident_date).toLocaleDateString("tr-TR")}`,
        incident.location ? `Lokasyon: ${incident.location}` : null,
        incident.company?.company_name ? `Firma: ${incident.company.company_name}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

export const closeIncidentReport = async (
  userId: string,
  incident: IncidentReportRecord,
  input: IncidentClosureInput,
): Promise<IncidentReportRecord> => {
  let capaRecordId = incident.capa_record_id;

  if (input.createCapa && !capaRecordId) {
    capaRecordId = await createIncidentCapaRecord(userId, incident);
  }

  return upsertIncidentReport(
    userId,
    {
      companyId: incident.company_id,
      incidentType: incident.incident_type,
      title: incident.title,
      description: incident.description,
      incidentDate: incident.incident_date,
      location: incident.location,
      affectedPerson: incident.affected_person,
      severity: incident.severity,
      rootCause: incident.root_cause,
      immediateAction: incident.immediate_action,
      correctiveAction: incident.corrective_action,
      status: "closed",
      reportedBy: incident.reported_by,
      witnessInfo: incident.witness_info,
      accidentCategory: incident.accident_category,
      rootCauseCategory: incident.root_cause_category,
      lostTimeDays: incident.lost_time_days,
      requiresNotification: incident.requires_notification,
      closureSummary: input.closureSummary,
      closureDecision: input.closureDecision,
      closureNotes: input.closureNotes,
      closedAt: new Date().toISOString(),
      closedBy: userId,
      capaRecordId,
    },
    incident.id,
  );
};

export const createIncidentTask = async (
  userId: string,
  incident: IncidentReportRecord,
): Promise<void> => {
  const dueDate = new Date();
  dueDate.setDate(
    dueDate.getDate() +
      (incident.severity === "critical"
        ? 1
        : incident.severity === "high"
          ? 3
          : 7),
  );

  await createOsgbTask(userId, {
    companyId: incident.company_id,
    title: `${incident.incident_type === "work_accident" ? "İş kazası" : "Ramak kala"} aksiyonu: ${incident.title}`,
    description: [
      `Olay tarihi: ${new Date(incident.incident_date).toLocaleDateString("tr-TR")}`,
      incident.location ? `Lokasyon: ${incident.location}` : null,
      incident.corrective_action
        ? `Önerilen aksiyon: ${incident.corrective_action}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
    priority:
      incident.severity === "critical"
        ? "critical"
        : incident.severity === "high"
          ? "high"
          : "medium",
    status: "open",
    dueDate: dueDate.toISOString().slice(0, 10),
    source: "incident_management",
  });
};

